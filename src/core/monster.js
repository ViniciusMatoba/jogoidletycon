import { BIOMES, ITEMS_INFO } from '../data/constants.js';

export class Monster {
  constructor(config, isMiniBoss = false, isBoss = false) {
    this.name = config.name;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.atk = config.atk;
    this.def = config.def;
    this.xpReward = config.xp;
    this.drops = config.drops;

    this.isMiniBoss = isMiniBoss;
    this.isBoss = isBoss;

    // Posição no canvas (Área da floresta no canto superior/médio direito)
    this.x = 520 + Math.random() * 200;
    this.y = 80 + Math.random() * 160;
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 30; // Monstros andam devagar
    this.wanderTimer = Math.random() * 3;
  }

  takeDamage(amount, attacker, addFloater) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.die(attacker, addFloater);
    }
  }

  die(attacker, addFloater) {
    // Premiar XP ao herói
    attacker.gainXp(this.xpReward);

    // Calcular Drops
    this.drops.forEach(drop => {
      if (Math.random() <= drop.chance) {
        const itemInfo = ITEMS_INFO[drop.item];
        if (itemInfo) {
          attacker.lootItem(drop.item, 1);
          // Adiciona animação de loot flutuante
          addFloater({
            x: this.x,
            y: this.y - 30,
            text: `+1 ${itemInfo.icon}`,
            color: '#ffea3a',
            time: 1.2
          });
        }
      }
    });

    // Se for Boss ou Mini Boss, dá ouro extra diretamente ao herói
    if (this.isBoss) {
      attacker.gold += 30;
      attacker.addLog(`Derrotou o Boss ${this.name}! Ganhou +30 Ouro.`);
    } else if (this.isMiniBoss) {
      attacker.gold += 12;
      attacker.addLog(`Derrotou o Mini-Boss ${this.name}! Ganhou +12 Ouro.`);
    }
  }

  update(dt) {
    if (this.hp <= 0) return;

    // Vagueia devagar se não estiver lutando
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.targetX = 520 + Math.random() * 200;
      this.targetY = 80 + Math.random() * 160;
      this.wanderTimer = 3 + Math.random() * 4;
    }

    // Movimentação simples
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }
}

export class MonsterSpawner {
  constructor() {
    this.currentBiomeId = 0;
    this.killsCount = 0;       // Contador de monstros normais derrotados
    this.bossKillsCount = 0;   // Quantos chefes principais foram derrotados neste bioma
    this.activeMonsters = [];
    this.maxNormalMonsters = 4;
    
    // Status do spawn especial
    this.bossSpawned = false;
    this.miniBossSpawned = false;

    // Logs do spawn
    this.logs = ['Spawner inicializado nas Cavernas Rasas.'];
  }

  getBiomeConfig() {
    return BIOMES[this.currentBiomeId];
  }

  setBiome(biomeId) {
    this.currentBiomeId = biomeId;
    this.killsCount = 0;
    this.bossSpawned = false;
    this.miniBossSpawned = false;
    this.activeMonsters = []; // Limpa monstros antigos
    this.logs.unshift(`Bioma alterado para: ${BIOMES[biomeId].name}`);
  }

  update(dt, town) {
    // 1. Limpar monstros mortos e acumular mortes
    const initialCount = this.activeMonsters.length;
    
    for (let i = this.activeMonsters.length - 1; i >= 0; i--) {
      const monster = this.activeMonsters[i];
      monster.update(dt);
      
      if (monster.hp <= 0) {
        // Monstro morreu
        this.activeMonsters.splice(i, 1);
        
        // Só conta como morte se for monstro normal
        if (!monster.isMiniBoss && !monster.isBoss) {
          this.killsCount++;
          this.checkSpecialSpawns();
        } else if (monster.isBoss) {
          this.bossSpawned = false;
          this.bossKillsCount++;
          this.logs.unshift(`CHEFE DERROTADO! ${monster.name} caiu!`);
          
          // Desbloquear melhorias de bioma se for o caso
          // Cada chefe derrotado aumenta o progresso da cidade
          town.addResource('gold', 100); // Recompensa global para a cidade
        } else if (monster.isMiniBoss) {
          this.miniBossSpawned = false;
          this.logs.unshift(`Mini-Boss derrotado!`);
        }
      }
    }

    // 2. Spawnar monstros normais se necessário
    if (!this.bossSpawned && this.activeMonsters.length < this.maxNormalMonsters) {
      this.spawnNormalMonster();
    }
  }

  checkSpecialSpawns() {
    const biome = this.getBiomeConfig();
    
    // Cada 12 mortes, spawna um Mini-Boss (se não houver um ativo)
    if (this.killsCount > 0 && this.killsCount % 12 === 0 && !this.miniBossSpawned && !this.bossSpawned) {
      this.spawnMiniBoss();
    }

    // Ao atingir a quantidade necessária, spawna o Boss
    if (this.killsCount >= biome.targetKillsForBoss && !this.bossSpawned) {
      this.spawnBoss();
    }
  }

  spawnNormalMonster() {
    const biome = this.getBiomeConfig();
    // Escolhe um monstro normal aleatório da lista do bioma
    const mConfig = biome.monsters[Math.floor(Math.random() * biome.monsters.length)];
    const monster = new Monster(mConfig);
    this.activeMonsters.push(monster);
  }

  spawnMiniBoss() {
    const biome = this.getBiomeConfig();
    // Escolhe aleatoriamente da lista de mini boss
    const config = biome.miniBosses[Math.floor(Math.random() * biome.miniBosses.length)];
    const monster = new Monster(config, true, false);
    this.activeMonsters.push(monster);
    this.miniBossSpawned = true;
    this.logs.unshift(`Cuidado! Um Mini-Boss apareceu: ${config.name}!`);
  }

  spawnBoss() {
    const biome = this.getBiomeConfig();
    
    // Limpar monstros normais para focar no Boss
    this.activeMonsters = [];
    
    // Escolhe aleatoriamente da lista de bosses
    const config = biome.bosses[Math.floor(Math.random() * biome.bosses.length)];
    const monster = new Monster(config, false, true);
    // Colocar o Boss no centro da arena de batalha
    monster.x = 640;
    monster.y = 150;
    monster.targetX = 640;
    monster.targetY = 150;
    
    this.activeMonsters.push(monster);
    this.bossSpawned = true;
    this.logs.unshift(`ALERTA DE CHEFE! O poderoso ${config.name} despertou!`);
  }
}
