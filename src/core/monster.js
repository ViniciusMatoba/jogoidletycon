import { BIOMES, ITEMS_INFO } from '../data/constants.js';
import { getRandomHuntPoint } from './navigation.js';

export class Monster {
  constructor(config, isMiniBoss = false, isBoss = false, viewport = {}) {
    this.name = config.name;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.atk = config.atk;
    this.def = config.def;
    this.xpReward = config.xp;
    this.drops = config.drops;

    this.isMiniBoss = isMiniBoss;
    this.isBoss = isBoss;

    // Posição no canvas (Tela cheia para campo de caça)
    const point = getRandomHuntPoint(viewport.width, viewport.height);
    this.x = point.x;
    this.y = point.y;
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 30; // Monstros andam devagar
    this.wanderTimer = Math.random() * 3;
  }

  takeDamage(amount, attacker, addFloater, town) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.die(attacker, addFloater, town);
    }
  }

  die(attacker, addFloater, town) {
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
            time: 1.2,
            map: 'hunt'
          });
        }
      }
    });

    // Calcular Ouro dropado
    const baseGold = Math.max(1, Math.round(this.xpReward * 0.25 + Math.random() * 2));
    let totalGold = baseGold;

    if (this.isBoss) {
      totalGold += 30;
    } else if (this.isMiniBoss) {
      totalGold += 12;
    }

    const tax = Math.floor(totalGold * 0.1); // 10% de imposto
    const netGold = totalGold - tax;

    attacker.gold += netGold;
    if (tax > 0 && town) {
      town.gold += tax;
    }

    // Adiciona animação de ouro flutuante
    addFloater({
      x: this.x + 15,
      y: this.y - 15,
      text: `+${netGold} 🪙`,
      color: '#ffd700',
      time: 1.2,
      map: 'hunt'
    });

    if (tax > 0) {
      addFloater({
        x: this.x - 15,
        y: this.y - 15,
        text: `+${tax} 🪙 (Imposto)`,
        color: '#3aff7d',
        time: 1.2,
        map: 'hunt'
      });
    }

    // Registra o abate nos logs do herói
    if (this.isBoss) {
      attacker.addLog(`Derrotou o Boss ${this.name}! Ganhou +${netGold} Ouro (Imposto: ${tax}).`);
    } else if (this.isMiniBoss) {
      attacker.addLog(`Derrotou o Mini-Boss ${this.name}! Ganhou +${netGold} Ouro (Imposto: ${tax}).`);
    } else {
      attacker.addLog(`Derrotou ${this.name}! Ganhou +${netGold} Ouro.`);
    }
  }

  update(dt, heroes = [], viewport = {}) {
    if (this.hp <= 0) return;

    // Scan if any hero is attacking this monster
    const attacker = (heroes && Array.isArray(heroes)) ? heroes.find(h => h.currentMap === 'hunt' && h.targetMonster === this) : null;

    if (attacker) {
      // If being attacked, do NOT wander!
      // Move directly towards the attacking hero so we stay in combat!
      this.targetX = attacker.x;
      this.targetY = attacker.y;
      this.wanderTimer = 1.0; // Reset wander timer
    } else {
      // Vagueia devagar se não estiver lutando
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        const point = getRandomHuntPoint(viewport.width, viewport.height);
        this.targetX = point.x;
        this.targetY = point.y;
        this.wanderTimer = 3 + Math.random() * 4;
      }
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

  update(dt, town, heroes = [], viewport = {}) {
    // Se heroes vier como viewport (compatibilidade se chamada antiga passar 3 args)
    let actualViewport = viewport;
    let actualHeroes = heroes;
    if (heroes && !Array.isArray(heroes)) {
      actualViewport = heroes;
      actualHeroes = [];
    }

    // 1. Limpar monstros mortos e acumular mortes
    for (let i = this.activeMonsters.length - 1; i >= 0; i--) {
      const monster = this.activeMonsters[i];
      if (!monster) continue;
      monster.update(dt, actualHeroes, actualViewport);
      
      if (monster.hp <= 0) {
        // Monstro morreu
        this.activeMonsters.splice(i, 1);
        
        // Só conta como morte se for monstro normal
        if (!monster.isMiniBoss && !monster.isBoss) {
          this.killsCount++;
          this.checkSpecialSpawns(actualViewport);
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

    // 2. Spawnar monstros normais se necessário (mantém maxNormalMonsters normais ativos)
    const normalCount = this.activeMonsters.filter(m => !m.isBoss && !m.isMiniBoss).length;
    if (normalCount < this.maxNormalMonsters) {
      this.spawnNormalMonster(actualViewport);
    }
  }

  checkSpecialSpawns(viewport = {}) {
    const biome = this.getBiomeConfig();
    if (this.killsCount > 0 && this.killsCount % 12 === 0 && !this.miniBossSpawned && !this.bossSpawned) {
      this.spawnMiniBoss(viewport);
    }

    // Ao atingir a quantidade necessária, spawna o Boss
    if (this.killsCount >= biome.targetKillsForBoss && !this.bossSpawned) {
      this.spawnBoss(viewport);
    }
  }

  spawnNormalMonster(viewport = {}) {
    const biome = this.getBiomeConfig();
    // Escolhe um monstro normal aleatório da lista do bioma
    const mConfig = biome.monsters[Math.floor(Math.random() * biome.monsters.length)];
    const monster = new Monster(mConfig, false, false, viewport);
    this.activeMonsters.push(monster);
  }

  spawnMiniBoss(viewport = {}) {
    const biome = this.getBiomeConfig();
    // Escolhe aleatoriamente da lista de mini boss
    const config = biome.miniBosses[Math.floor(Math.random() * biome.miniBosses.length)];
    const monster = new Monster(config, true, false, viewport);
    this.activeMonsters.push(monster);
    this.miniBossSpawned = true;
    this.logs.unshift(`Cuidado! Um Mini-Boss apareceu: ${config.name}!`);
  }

  spawnBoss(viewport = {}) {
    const biome = this.getBiomeConfig();
    
    // Do NOT clear normal monsters! Let them exist together
    
    // Escolhe aleatoriamente da lista de bosses
    const config = biome.bosses[Math.floor(Math.random() * biome.bosses.length)];
    const monster = new Monster(config, false, true, viewport);
    // Colocar o Boss no centro da arena de batalha (tela cheia)
    monster.x = (viewport.width || 960) * 0.5;
    monster.y = (viewport.height || 540) * 0.45;
    monster.targetX = monster.x;
    monster.targetY = monster.y;
    
    this.activeMonsters.push(monster);
    this.bossSpawned = true;
    this.logs.unshift(`ALERTA DE CHEFE! O poderoso ${config.name} despertou!`);
  }
}
