import { BIOMES, ITEMS_INFO } from '../data/constants.js';
import { getRandomHuntPoint, getHuntExitPoint } from './navigation.js';

function clampHuntPointLocal(point, width = 960, height = 540) {
  const w = width || 960;
  const h = height || 540;
  const minX = Math.max(42, w * 0.055);
  const maxX = Math.max(minX, w - minX);
  const minY = Math.max(70, h * 0.12);
  const maxY = Math.max(minY, h - Math.max(58, h * 0.13));
  const x = Number.isFinite(point?.x) ? point.x : (minX + maxX) * 0.5;
  const y = Number.isFinite(point?.y) ? point.y : (minY + maxY) * 0.5;

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y))
  };
}

export class Monster {
  constructor(config, isMiniBoss = false, isBoss = false, viewport = {}, monsterLevel = 2) {
    this.name = config.name;
    this.monsterLevel = monsterLevel;

    // Multiplicadores baseados no nível selecionado (1 a 4)
    const levelMultipliers = {
      1: { stat: 0.6, reward: 0.6 },
      2: { stat: 1.0, reward: 1.0 },
      3: { stat: 1.5, reward: 1.5 },
      4: { stat: 2.2, reward: 2.2 }
    };
    const mult = levelMultipliers[monsterLevel] || { stat: 1.0, reward: 1.0 };
    this.statMult = mult.stat;
    this.rewardMult = mult.reward;

    this.maxHp = Math.max(1, Math.round(config.hp * this.statMult));
    this.hp = this.maxHp;
    this.atk = Math.max(1, Math.round(config.atk * this.statMult));
    this.def = Math.max(0, Math.round(config.def * this.statMult));
    this.xpReward = Math.max(1, Math.round(config.xp * this.rewardMult));
    this.drops = config.drops;

    this.isMiniBoss = isMiniBoss;
    this.isBoss = isBoss;

    // Raridade visual: determina qual variação de sprite usar
    // miniBoss e boss sempre usam 'normal' (sprites base)
    if (!isMiniBoss && !isBoss) {
      const roll = Math.random();
      if (roll < 0.05) {
        this.variant = 'elite';   // 5% — variação elite (maior, diferente)
      } else if (roll < 0.20) {
        this.variant = 'raro';    // 15% — variação rara
      } else {
        this.variant = 'normal';  // 80% — padrão
      }
    } else {
      this.variant = 'normal';
    }

    // Posição no canvas (Tela cheia para campo de caça)
    const point = getRandomHuntPoint(viewport.width, viewport.height);
    this.x = point.x;
    this.y = point.y;
    this.targetX = this.x;
    this.targetY = this.y;

    // Velocidade de perseguição: boss é mais lento mas poderoso, mini-boss médio, normal mais rápido
    this.speed = isBoss ? 40 : (isMiniBoss ? 55 : 65);
    this.wanderTimer = Math.random() * 3;

    // Cooldown de ataque independente do monstro
    this.attackCooldown = 0;
    this.attackSpeed = isBoss ? 0.6 : (isMiniBoss ? 0.9 : 1.2); // Ataques por segundo
    this.targetHero = null; // Herói alvo atual
    this.aggroRange = isBoss ? 350 : (isMiniBoss ? 280 : 200); // Raio de detecção de herói
  }

  clampToHunt(viewport = {}) {
    const point = clampHuntPointLocal({ x: this.x, y: this.y }, viewport.width, viewport.height);
    this.x = point.x;
    this.y = point.y;
  }

  clampHuntTarget(viewport = {}) {
    const point = clampHuntPointLocal({ x: this.targetX, y: this.targetY }, viewport.width, viewport.height);
    this.targetX = point.x;
    this.targetY = point.y;
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
      const finalChance = drop.chance * this.rewardMult;
      let qty = 0;
      if (finalChance > 1.0) {
        qty = Math.floor(finalChance);
        const extraChance = finalChance - qty;
        if (Math.random() <= extraChance) {
          qty++;
        }
      } else {
        if (Math.random() <= finalChance) {
          qty = 1;
        }
      }

      if (qty > 0) {
        const itemInfo = ITEMS_INFO[drop.item];
        if (itemInfo) {
          attacker.lootItem(drop.item, qty);
          // Adiciona animação de loot flutuante
          addFloater({
            x: this.x,
            y: this.y - 30,
            text: `+${qty} ${itemInfo.icon}`,
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
      totalGold += 30 * this.rewardMult;
    } else if (this.isMiniBoss) {
      totalGold += 12 * this.rewardMult;
    }

    totalGold = Math.max(1, Math.round(totalGold));

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

  update(dt, heroes = [], viewport = {}, addFloater) {
    if (this.hp <= 0) return;

    // Decrementa temporizador de stun (atordoamento por congelamento)
    if (this.stunTimer === undefined) this.stunTimer = 0;
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return; // Monstros atordoados não agem ou se movem!
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.clampToHunt(viewport);
    this.clampHuntTarget(viewport);

    // --- Buscar o herói alvo (Provocação tem prioridade absoluta) ---
    let nearestHero = null;
    let nearestDist = Infinity;

    if (this.tauntedBy && this.tauntedBy.currentMap === 'hunt' && this.tauntedBy.hp > 0 && !this.tauntedBy.isGhost) {
      nearestHero = this.tauntedBy;
      const ddx = nearestHero.x - this.x;
      const ddy = nearestHero.y - this.y;
      nearestDist = Math.sqrt(ddx * ddx + ddy * ddy);
    } else {
      this.tauntedBy = null; // Limpa se herói morreu ou saiu
      
      if (heroes && Array.isArray(heroes)) {
        for (const h of heroes) {
          if (h.currentMap !== 'hunt' || h.hp <= 0 || h.isGhost) continue;
          const ddx = h.x - this.x;
          const ddy = h.y - this.y;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < nearestDist) {
            nearestDist = d;
            nearestHero = h;
          }
        }
      }
    }

    if (nearestHero && nearestDist <= this.aggroRange) {
      // Perseguir herói mais próximo ou provocador
      this.targetHero = nearestHero;
      this.targetX = nearestHero.x;
      this.targetY = nearestHero.y;
      this.clampHuntTarget(viewport);
      this.wanderTimer = 2.0; // Resetar timer de vaguear

      // --- ATAQUE INDEPENDENTE DO MONSTRO ---
      const attackReach = this.isBoss ? 55 : (this.isMiniBoss ? 45 : 35);
      if (nearestDist <= attackReach && this.attackCooldown <= 0) {
        this.attackCooldown = 1 / this.attackSpeed;
        const monsterDmg = Math.max(1, Math.round(this.atk * 0.5) - (nearestHero.def || 0));
        
        // Lógica de absorção do Escudo Divino
        let finalDamage = monsterDmg;
        if (nearestHero.shieldHp && nearestHero.shieldHp > 0) {
          if (nearestHero.shieldHp >= finalDamage) {
            nearestHero.shieldHp -= finalDamage;
            finalDamage = 0;
            if (addFloater) {
              addFloater({
                x: nearestHero.x,
                y: nearestHero.y - 25,
                text: `Absorvido! 🛡️`,
                color: '#00e5ff',
                time: 0.9,
                map: 'hunt'
              });
            }
          } else {
            finalDamage -= nearestHero.shieldHp;
            nearestHero.shieldHp = 0;
          }
        }

        if (finalDamage > 0) {
          nearestHero.hp = Math.max(0, nearestHero.hp - finalDamage);
          if (addFloater) {
            addFloater({
              x: nearestHero.x,
              y: nearestHero.y - 15,
              text: `-${finalDamage}`,
              color: '#ff3d3d',
              time: 0.8,
              map: 'hunt'
            });
          }
        }

        // Se herói for derrubado pelo monstro
        if (nearestHero.hp <= 0) {
          nearestHero.hp = 1;
          nearestHero.isGhost = true;
          nearestHero.addLog(`Derrubado por ${this.name}! Voltando como fantasma...`);
          if (nearestHero.currentMap === 'hunt') {
            const safeTown = (typeof town !== 'undefined' && town) ? town : window.game?.town;
            nearestHero.tempTargetBuilding = (safeTown && safeTown.isBuilt('hospital')) ? 'hospital' : 'townhall';
            nearestHero.state = 'RETURNING_TOWN';
            const huntExit = getHuntExitPoint(viewport.width, viewport.height);
            nearestHero.targetX = huntExit.x;
            nearestHero.targetY = huntExit.y;
          }
        }
      }
    } else {
      // Monstro sem alvo próximo: vaguear lentamente
      this.targetHero = null;
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        const point = getRandomHuntPoint(viewport.width, viewport.height);
        this.targetX = point.x;
        this.targetY = point.y;
        this.clampHuntTarget(viewport);
        this.wanderTimer = 3 + Math.random() * 4;
      }
    }

    // Movimentação
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Parar se já está no alcance de ataque do alvo (para não ficar sobreposto ao herói)
    const stopDist = this.targetHero ? (this.isBoss ? 50 : (this.isMiniBoss ? 40 : 30)) : 5;
    if (dist > stopDist && dist > 0.01) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }

    this.clampToHunt(viewport);
    this.clampHuntTarget(viewport);
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

    this.monsterLevel = 2; // Nível padrão: Normal

    // Baús de tesouro pendentes (aparecem no mapa após boss morrer)
    this.pendingChests = [];
    // Eventos de morte para o renderer exibir imagens de caveira/rip
    this.deathEvents = [];

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

  update(dt, town, heroes = [], viewport = {}, addFloater) {
    // Se heroes vier como viewport (compatibilidade se chamada antiga passar 3 args)
    let actualViewport = viewport;
    let actualHeroes = heroes;
    if (heroes && !Array.isArray(heroes)) {
      actualViewport = heroes;
      actualHeroes = [];
    }

    // 1. Atualizar e limpar monstros mortos
    for (let i = this.activeMonsters.length - 1; i >= 0; i--) {
      const monster = this.activeMonsters[i];
      if (!monster) continue;
      monster.update(dt, actualHeroes, actualViewport, addFloater);
      
      if (monster.hp <= 0) {
        // Monstro morreu
        this.activeMonsters.splice(i, 1);
        
        // Só conta como morte se for monstro normal
        if (!monster.isMiniBoss && !monster.isBoss) {
          this.killsCount++;
          this.checkSpecialSpawns(actualViewport);
          this.deathEvents.push({ type: 'monster', x: monster.x, y: monster.y });
        } else if (monster.isBoss) {
          this.bossSpawned = false;
          this.bossKillsCount++;
          this.logs.unshift(`CHEFE DERROTADO! ${monster.name} caiu!`);

          // Cada chefe derrotado recompensa a cidade
          town.addResource('gold', 100);

          this.deathEvents.push({ type: 'boss', x: monster.x, y: monster.y });

          // Chance de spawnar baú de tesouro (35% comum, 15% raro)
          const roll = Math.random();
          if (roll < 0.15) {
            this.pendingChests.push({ x: monster.x, y: monster.y, type: 'rare', collected: false });
          } else if (roll < 0.50) {
            this.pendingChests.push({ x: monster.x, y: monster.y, type: 'common', collected: false });
          }
        } else if (monster.isMiniBoss) {
          this.miniBossSpawned = false;
          this.logs.unshift(`Mini-Boss derrotado!`);
          this.deathEvents.push({ type: 'miniboss', x: monster.x, y: monster.y });
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
    const monster = new Monster(mConfig, false, false, viewport, this.monsterLevel);
    this.activeMonsters.push(monster);
  }

  spawnMiniBoss(viewport = {}) {
    const biome = this.getBiomeConfig();
    // Escolhe aleatoriamente da lista de mini boss
    const config = biome.miniBosses[Math.floor(Math.random() * biome.miniBosses.length)];
    const monster = new Monster(config, true, false, viewport, this.monsterLevel);
    this.activeMonsters.push(monster);
    this.miniBossSpawned = true;
    this.logs.unshift(`Cuidado! Um Mini-Boss apareceu: ${config.name}!`);
  }

  spawnBoss(viewport = {}) {
    const biome = this.getBiomeConfig();
    
    // Do NOT clear normal monsters! Let them exist together
    
    // Escolhe aleatoriamente da lista de bosses
    const config = biome.bosses[Math.floor(Math.random() * biome.bosses.length)];
    const monster = new Monster(config, false, true, viewport, this.monsterLevel);
    // Colocar o Boss no centro da arena de batalha (tela cheia)
    monster.x = (viewport.width || 960) * 0.5;
    monster.y = (viewport.height || 540) * 0.45;
    monster.targetX = monster.x;
    monster.targetY = monster.y;
    monster.clampToHunt(viewport);
    monster.clampHuntTarget(viewport);

    this.activeMonsters.push(monster);
    this.bossSpawned = true;
    this.logs.unshift(`ALERTA DE CHEFE! O poderoso ${config.name} despertou!`);
  }
}
