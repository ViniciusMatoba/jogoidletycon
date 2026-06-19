import { HERO_CLASSES, ITEMS_INFO, CRAFT_RECIPES } from '../data/constants.js';
import {
  getBuildingTownPoint,
  getHuntEntryPoint,
  getHuntExitPoint,
  getRandomHuntPoint,
  getRandomTownPoint,
  getTownExitPoint,
  isPointInsideTown
} from './navigation.js';

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

const MALE_NAMES = [
  'Arthur', 'Bernardo', 'Caio', 'Daniel', 'Erick', 'Felipe', 'Gabriel', 
  'Heitor', 'Igor', 'Lucas', 'Murilo', 'Rafael', 'Samuel', 'Thiago', 'Victor',
  'Kaelen', 'Valerius', 'Zephyr', 'Eldrin', 'Tristan', 'Boran', 'Orion', 'Kael'
];
const FEMALE_NAMES = [
  'Alice', 'Beatriz', 'Camila', 'Diana', 'Elisa', 'Fernanda', 'Gabriela', 
  'Helena', 'Isadora', 'Julia', 'Larissa', 'Marina', 'Natalia', 'Olivia', 
  'Rafaela', 'Sofia', 'Yasmin', 'Elysia', 'Lyra', 'Morrigan', 'Valerie', 'Saria'
];

function generateNickname(gender, rarity, bodyType, hairColor, className) {
  const isFem = gender === 'female';
  
  if (hairColor === 'red') {
    return isFem ? 'Cabelo de Fogo' : 'o Flamejante';
  }
  if (hairColor === 'gold') {
    return isFem ? 'a Dourada' : 'o Dourado';
  }
  if (hairColor === 'pink') {
    return isFem ? 'a Rosada' : 'o Rosado';
  }
  if (hairColor === 'blue') {
    return isFem ? 'a Gélida' : 'o Gélido';
  }
  
  if (rarity === 'Lendário') {
    const lendarios = isFem 
      ? ['a Lendária', 'a Divina', 'a Imortal', 'a Destruidora', 'a Soberana']
      : ['o Lendário', 'o Divino', 'o Imortal', 'o Destruidor', 'o Soberano'];
    return lendarios[Math.floor(Math.random() * lendarios.length)];
  }
  if (rarity === 'Épico') {
    const epicos = isFem 
      ? ['a Épica', 'a Imparável', 'a Corajosa', 'a Invencível', 'a Protetora']
      : ['o Épico', 'o Imparável', 'o Corajoso', 'o Invencível', 'o Protetor'];
    return epicos[Math.floor(Math.random() * epicos.length)];
  }
  if (rarity === 'Raro') {
    const raros = isFem
      ? ['a Audaz', 'a Destemida', 'a Veloz', 'a Caçadora']
      : ['o Audaz', 'o Destemido', 'o Veloz', 'o Caçador'];
    return raros[Math.floor(Math.random() * raros.length)];
  }
  
  if (className === 'WARRIOR') return isFem ? 'Escudo de Aço' : 'Escudo de Ferro';
  if (className === 'MERCENARY') return isFem ? 'Lâmina Silenciosa' : 'Lâmina Rápida';
  if (className === 'ARCHER') return isFem ? 'Olhos de Águia' : 'Mira Precisa';
  if (className === 'MAGE') return isFem ? 'a Arcana' : 'o Arcano';
  if (className === 'PRIEST') return isFem ? 'a Abençoada' : 'o Abençoado';
  
  return isFem ? 'a Aventureira' : 'o Aventureiro';
}

const RARITY_MULTIPLIERS = {
  'Comum': 1.0,
  'Normal': 1.1,
  'Raro': 1.3,
  'Épico': 1.6,
  'Lendário': 2.0
};

export const BUILDING_POSITIONS = {
  townhall: { x: 480, y: 150 },
  hotel: { x: 260, y: 240 },
  restaurant: { x: 700, y: 240 },
  hospital: { x: 200, y: 400 },
  tavern: { x: 760, y: 400 },
  forge: { x: 480, y: 430 },
  market: { x: 350, y: 340 }
};

export class Hero {
  constructor(id, className) {
    this.id = id;
    this.className = className;
    this.classConfig = HERO_CLASSES[className];

    // 1. Gênero (50/50)
    const gender = Math.random() < 0.5 ? 'male' : 'female';

    // 2. Raridade
    const roll = Math.random() * 100;
    let rarity = 'Comum';
    if (roll < 2) rarity = 'Lendário';
    else if (roll < 12) rarity = 'Épico';
    else if (roll < 30) rarity = 'Raro';
    else if (roll < 60) rarity = 'Normal';
    else rarity = 'Comum';

    this.rarity = rarity;

    // 3. Brilho da Raridade (Glow)
    this.rarityGlow = {
      enabled: rarity === 'Raro' || rarity === 'Épico' || rarity === 'Lendário',
      color: rarity === 'Lendário' ? '#ffea3a' : (rarity === 'Épico' ? '#d500f9' : '#00e5ff'),
      intensity: rarity === 'Lendário' ? 1.0 : (rarity === 'Épico' ? 0.7 : 0.4),
      pulseSpeed: rarity === 'Lendário' ? 2.5 : (rarity === 'Épico' ? 1.8 : 1.0)
    };

    // 4. Tipo de Corpo (Humano Padrão)
    let bodyType = gender === 'male' ? 'male' : 'female';

    // 5. Cabelo (Corte e Cor)
    let hairStyle = 'none';
    let hairColor = 'none';
    const styles = ['plain', 'messy', 'loose', 'braid', 'mohawk'];
    hairStyle = styles[Math.floor(Math.random() * styles.length)];

    let colors = ['black', 'brown', 'blonde', 'red', 'white'];
    if (rarity === 'Raro') {
      colors.push('blue', 'green');
    } else if (rarity === 'Épico' || rarity === 'Lendário') {
      colors.push('blue', 'green', 'purple', 'gold', 'pink');
    }
    hairColor = colors[Math.floor(Math.random() * colors.length)];

    this.cosmetics = {
      gender,
      bodyType,
      hairStyle,
      hairColor
    };

    // 6. Nome e Apelido
    const nameList = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
    const baseName = nameList[Math.floor(Math.random() * nameList.length)];
    const nickname = generateNickname(gender, rarity, bodyType, hairColor, className);
    this.name = `${baseName} ${nickname} (${HERO_CLASSES[className].name.substring(0, 3)})`;

    // Status de Progressão
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = 100;
    this.gold = 50; // Começam com algum ouro para gastar na cidade

    // Status de Combate (Base + Equipamentos)
    this.equipment = {
      weapon: null,
      armor: null,
      helmet: null,
      shield: null, // Novo slot para escudo visual
      necklace: null,
      gloves: null,
      ring: null,
      belt: null,
      boots: null
    };

    this.recalculateStats();

    // Vida atual começa cheia
    this.hp = this.maxHp;

    // Necessidades (0 a 100)
    this.hunger = 80 + Math.random() * 20; // Fome
    this.energy = 80 + Math.random() * 20; // Energia
    this.mood = 80 + Math.random() * 20;   // Humor

    // Inventário de Loot Coletado
    this.inventory = {};

    // Posição no canvas
    this.currentMap = 'town';
    this.tempTargetBuilding = null;
    this.destinationBuilding = null;
    this.x = 200 + Math.random() * 500;
    this.y = 150 + Math.random() * 250;
    this.targetX = this.x;
    this.targetY = this.y;
    this.x = 200 + Math.random() * 500;
    this.y = 150 + Math.random() * 250;
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 80; // Velocidade de pixels por segundo

    // Estados: 'IDLE_TOWN', 'SEARCHING_MONSTER', 'FIGHTING', 'RETURNING_TOWN', 'LEAVING_TOWN'
    // 'RESTING_HOTEL', 'EATING_REST', 'HEALING_HOSP', 'DRINKING_TAVERN', 'SELLING_LOOT'
    this.state = 'IDLE_TOWN';
    this.targetMonster = null;
    this.cooldownTimer = 0;
    this.stateTimer = 0; // Para contar tempo em ações fixas

    // Configuração de combate baseada na classe
    this.attackType = this.classConfig.attackType || 'melee';
    this.attackRange = this.classConfig.attackRange || 35;
    this.keepAwayRange = this.classConfig.keepAwayRange || 0;

    // Comunicação herói → renderer (para spawnar projéteis)
    this.pendingAttack = null;
    
    this.isGhost = false; // Estado de fantasma após morte

    // Histórico de logs de atividades do herói
    this.logs = [`Chegou à cidade.`];
  }

  // Recalcula os status somando a classe e equipamentos
  recalculateStats() {
    const classBase = HERO_CLASSES[this.className];
    
    // Crescimento de status por nível (ex: +10% por nível)
    const levelMult = 1 + (this.level - 1) * 0.12;

    // Multiplicador de Raridade
    const rarityMult = RARITY_MULTIPLIERS[this.rarity] || 1.0;

    this.maxHp = Math.round(classBase.baseHp * levelMult * rarityMult);
    this.atk = Math.round(classBase.baseAtk * levelMult * rarityMult);
    this.def = Math.round(classBase.baseDef * levelMult * rarityMult);
    this.spd = classBase.baseSpd; // Ataques por segundo

    // Somar bônus de todos os equipamentos equipados
    for (const slot in this.equipment) {
      const item = this.equipment[slot];
      if (item && item.stats) {
        this.atk += item.stats.atk || 0;
        this.maxHp += item.stats.hp || 0;
        this.def += item.stats.def || 0;
      }
    }
  }

  addLog(msg) {
    this.logs.unshift(msg); // Adiciona no início
    if (this.logs.length > 5) this.logs.pop(); // Mantém os 5 mais recentes
  }

  // Verifica se o inventário tem itens para vender
  hasLootToSell() {
    let count = 0;
    for (const key in this.inventory) {
      count += this.inventory[key] || 0;
    }
    return count >= 4; // Volta a vender quando junta 4 loots
  }

  // Adiciona XP
  gainXp(amount) {
    this.xp += amount;
    this.addLog(`Ganhou +${amount} XP`);
    if (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level++;
      this.xpNeeded = Math.round(this.level * 120);
      this.recalculateStats();
      this.hp = this.maxHp; // Cura ao subir de nível
      this.addLog(`Subiu para o Nível ${this.level}!`);
    }
  }

  // Dá um item para o inventário do herói
  lootItem(itemKey, qty = 1) {
    this.inventory[itemKey] = (this.inventory[itemKey] || 0) + qty;
  }

  // Movimentação simples em direção ao alvo
  moveTowardsTarget(dt) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.x = this.targetX;
      this.y = this.targetY;
      return true; // Chegou
    }

    this.x += (dx / dist) * this.speed * dt;
    this.y += (dy / dist) * this.speed * dt;
    return false; // Ainda andando
  }

  // Escolhe novas coordenadas de alvo dentro do mapa de caça (tela cheia)
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

  wanderForest(viewport = {}) {
    const point = getRandomHuntPoint(viewport.width, viewport.height);
    this.targetX = point.x;
    this.targetY = point.y;
  }

  // Escolhe novas coordenadas de alvo dentro da cidade (tela cheia)
  wanderTown(town, viewport = {}) {
    if (!town) return;
    const point = getRandomTownPoint(town, viewport.width, viewport.height);
    this.targetX = point.x;
    this.targetY = point.y;
  }

  // Define um prédio como alvo físico
  targetBuilding(buildingType, town, viewport = {}) {
    if (!town) return;
    this.destinationBuilding = buildingType;
    const pos = getBuildingTownPoint(town, buildingType, viewport.width, viewport.height) ||
      BUILDING_POSITIONS[buildingType] ||
      getRandomTownPoint(town, viewport.width, viewport.height);
    // Pequena variação para heróis não ficarem sobrepostos
    this.targetX = pos.x + (Math.random() * 12 - 6);
    this.targetY = pos.y + (Math.random() * 8 - 4);
  }


  // Ciclo principal de atualização da IA do Herói
  update(dt, town, monsters, addFloater, viewport = {}, allHeroes = []) {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);

    // Repulsion Separation from other heroes
    let sepX = 0;
    let sepY = 0;
    let count = 0;
    for (const other of allHeroes) {
      if (other !== this && other.currentMap === this.currentMap) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 40 && dist > 0) {
          sepX += dx / dist;
          sepY += dy / dist;
          count++;
        }
      }
    }
    if (count > 0) {
      this.x += (sepX / count) * 20 * dt;
      this.y += (sepY / count) * 20 * dt;
    }

    if (this.currentMap === 'town' && town && !isPointInsideTown(town, this.x, this.y, viewport.width, viewport.height)) {
      const point = getRandomTownPoint(town, viewport.width, viewport.height);
      this.x = point.x;
      this.y = point.y;
      this.wanderTown(town, viewport);
    }

    if (this.currentMap === 'hunt') {
      this.clampToHunt(viewport);
      this.clampHuntTarget(viewport);
    }

    // Necessidades decaem de forma lenta
    const decayRate = this.state === 'FIGHTING' || this.state === 'SEARCHING_MONSTER' ? 0.6 : 0.15;
    this.hunger = Math.max(0, this.hunger - decayRate * dt);
    this.energy = Math.max(0, this.energy - decayRate * dt);
    this.mood = Math.max(0, this.mood - decayRate * dt);

    // 1. Executa de acordo com o estado
    switch (this.state) {
      case 'IDLE_TOWN':
        this.moveTowardsTarget(dt);
        this.stateTimer += dt;
        if (this.stateTimer > 2) {
          this.stateTimer = 0;
          // Avaliar necessidades antes de ir ca?ar
          if (this.evaluateNeeds(town, viewport)) {
            return;
          }
          // Ir ca?ar: primeiro anda at? o port?o de sa?da no mapa da cidade.
          this.state = 'LEAVING_TOWN';
          const exitPoint = getTownExitPoint(town, viewport.width, viewport.height);
          this.targetX = exitPoint.x;
          this.targetY = exitPoint.y;
          this.addLog(`Indo para o port?o de ca?a.`);
        }
        break;

      case 'LEAVING_TOWN':
        {
          const exitPoint = getTownExitPoint(town, viewport.width, viewport.height);
          this.targetX = exitPoint.x;
          this.targetY = exitPoint.y;
        }
        if (this.moveTowardsTarget(dt)) {
          // Chegou no port?o da cidade. Teleporta para o port?o do mapa de ca?a.
          const huntEntry = getHuntEntryPoint(viewport.width, viewport.height);
          this.x = huntEntry.x;
          this.y = huntEntry.y;
          this.currentMap = 'hunt';
          this.state = 'SEARCHING_MONSTER';
          this.wanderForest(viewport);
          this.addLog(`Entrou no campo de ca?a.`);
        }
        break;

      case 'SEARCHING_MONSTER':
        if (monsters.length === 0) {
          if (this.moveTowardsTarget(dt)) {
            this.wanderForest(viewport);
          }
          return;
        }

        // Achar o monstro mais próximo
        let closest = null;
        let minDist = Infinity;
        for (const monster of monsters) {
          if (monster.hp <= 0) continue;
          const dx = monster.x - this.x;
          const dy = monster.y - this.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist) {
            minDist = d;
            closest = monster;
          }
        }

        if (closest) {
          this.targetMonster = closest;
          this.targetX = closest.x;
          this.targetY = closest.y;
          this.clampHuntTarget(viewport);
          
          if (minDist < 25) {
            this.state = 'FIGHTING';
            this.addLog(`Atacando ${closest.name}.`);
          } else {
            this.moveTowardsTarget(dt);
          }
        } else {
          if (this.moveTowardsTarget(dt)) {
            this.wanderForest(viewport);
          }
        }
        break;

      case 'FIGHTING':
        if (!this.targetMonster || this.targetMonster.hp <= 0) {
          this.targetMonster = null;
          if (this.evaluateNeeds(town, viewport)) return;
          this.state = 'SEARCHING_MONSTER';
          this.wanderForest(viewport);
          return;
        }

        {
          const mdx = this.targetMonster.x - this.x;
          const mdy = this.targetMonster.y - this.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy) || 0.01;

          if (this.keepAwayRange > 0) {
            // === ATAQUE A DISTÂNCIA ===
            // Mantém distancia mínima (foge se monstro se aproximar)
            if (mdist < this.keepAwayRange) {
              // Recuar: mover para longe do monstro
              const nx = mdx / mdist;
              const ny = mdy / mdist;
              this.targetX = this.x - nx * (this.keepAwayRange + 30);
              this.targetY = this.y - ny * (this.keepAwayRange + 30);
              this.clampHuntTarget(viewport);
              this.moveTowardsTarget(dt);
              this.clampToHunt(viewport);
            } else if (mdist <= this.attackRange) {
              // Dentro do alcance: parar e atacar
              this.targetX = this.x;
              this.targetY = this.y;
              if (this.cooldownTimer <= 0) {
                this.attackMonster(this.targetMonster, addFloater, town);
                this.cooldownTimer = 1 / this.spd;
              }
            } else {
              // Fora do alcance: avançar até o alcance máximo
              this.targetX = this.targetMonster.x;
              this.targetY = this.targetMonster.y;
              this.clampHuntTarget(viewport);
              this.moveTowardsTarget(dt);
              this.clampToHunt(viewport);
            }
          } else {
            // === ATAQUE CORPO-A-CORPO ===
            if (mdist > this.attackRange) {
              this.targetX = this.targetMonster.x;
              this.targetY = this.targetMonster.y;
              this.clampHuntTarget(viewport);
              this.moveTowardsTarget(dt);
              this.clampToHunt(viewport);
            } else if (this.cooldownTimer <= 0) {
              this.attackMonster(this.targetMonster, addFloater, town);
              this.cooldownTimer = 1 / this.spd;
            }
          }
        }

        // Se o herói morrer, ele foge
        if (this.hp <= 0) {
          this.hp = 1;
          this.isGhost = true;
          this.addLog(`Ficou inconsciente! Voltando como fantasma...`);
          const fallbackTarget = town.isBuilt('hospital') ? 'hospital' : 'townhall';
          if (this.currentMap === 'hunt') {
            this.tempTargetBuilding = fallbackTarget;
            const huntExit = getHuntExitPoint(viewport.width, viewport.height);
            this.targetX = huntExit.x;
            this.targetY = huntExit.y; // Ir para a saída
            this.state = 'RETURNING_TOWN';
          } else {
            this.state = 'RETURNING_TOWN';
            this.targetBuilding(fallbackTarget, town, viewport);
          }
        }
        break;

      case 'RETURNING_TOWN':
        if (this.moveTowardsTarget(dt)) {
          if (this.currentMap === 'hunt') {
            // Chegou no portão de saída do campo de caça. Teleporta para o portão de entrada da cidade!
            const townEntry = getTownExitPoint(town, viewport.width, viewport.height);
            this.x = townEntry.x;
            this.y = townEntry.y;
            this.currentMap = 'town';
            this.targetBuilding(this.tempTargetBuilding, town, viewport);
            this.tempTargetBuilding = null;
            this.addLog(`Voltou para a cidade.`);
          } else {
            // Chegou no prédio em town
            this.enterBuilding(town, viewport);
          }
        }
        break;

      case 'HEALING_HOSP':
        // Recuperar vida no hospital
        const hospLevel = town.buildings.hospital || 0;
        const hospResKey = hospLevel === 3 ? 'bandage_basic_t3' : (hospLevel === 2 ? 'bandage_basic_t2' : 'bandage_basic');
        
        if (town.isBuilt('hospital') && (town.resources[hospResKey] || 0) > 0 && this.gold >= 8) {
          const rate = town.getBuildingConfig('hospital').current.hpRecovery;
          this.hp = Math.min(this.maxHp, this.hp + rate * dt * 4);
          
          this.stateTimer += dt;
          if (this.stateTimer >= 2.5 || this.hp >= this.maxHp) {
            // Pagamento e finalização
            town.resources[hospResKey]--;
            town.gold += 8;
            this.gold -= 8;
            this.hp = this.maxHp;
            this.isGhost = false;
            this.addLog(`Tratamento concluído.`);
            this.state = 'IDLE_TOWN';
            this.wanderTown(town, viewport);
          }
        } else {
          // Sem recursos no hospital, cura passiva lenta
          this.hp = Math.min(this.maxHp, this.hp + 2 * dt);
          if (this.hp >= this.maxHp) {
            this.isGhost = false;
            this.state = 'IDLE_TOWN';
            this.wanderTown(town, viewport);
          }
        }
        break;

      case 'EATING_REST':
        const restLevel = town.buildings.restaurant || 0;
        const restResKey = restLevel === 3 ? 'meal_cooked_t3' : (restLevel === 2 ? 'meal_cooked_t2' : 'meal_cooked');

        if (town.isBuilt('restaurant') && (town.resources[restResKey] || 0) > 0 && this.gold >= 8) {
          const rate = town.getBuildingConfig('restaurant').current.foodRecovery;
          this.hunger = Math.min(100, this.hunger + rate * dt * 4);
          
          this.stateTimer += dt;
          if (this.stateTimer >= 2.5 || this.hunger >= 100) {
            town.resources[restResKey]--;
            town.gold += 8;
            this.gold -= 8;
            this.hunger = 100;
            this.addLog(`Almoçou ensopado.`);
            this.state = 'IDLE_TOWN';
            this.wanderTown(town, viewport);
          }
        } else {
          // Sem comida, herói fica irritado mas volta a agir
          this.hunger = Math.min(100, this.hunger + 1.5 * dt);
          if (this.hunger >= 50) {
            this.state = 'IDLE_TOWN';
            this.wanderTown(town, viewport);
          }
        }
        break;

      case 'RESTING_HOTEL':
        const hotelLevel = town.buildings.hotel || 0;
        const hotelResKey = hotelLevel === 3 ? 'bed_disposable_t3' : (hotelLevel === 2 ? 'bed_disposable_t2' : 'bed_disposable');

        if (town.isBuilt('hotel') && (town.resources[hotelResKey] || 0) > 0 && this.gold >= 6) {
          const rate = town.getBuildingConfig('hotel').current.energyRecovery;
          const goldEarned = town.getBuildingConfig('hotel').current.goldEarned;
          
          this.energy = Math.min(100, this.energy + rate * dt * 4);
          
          this.stateTimer += dt;
          if (this.stateTimer >= 3.0 || this.energy >= 100) {
            town.resources[hotelResKey]--;
            town.gold += goldEarned;
            this.gold -= goldEarned;
            this.energy = 100;
            this.addLog(`Dormiu no hotel.`);
            this.state = 'IDLE_TOWN';
            this.wanderTown(town, viewport);
          }
        } else {
          // Sem hotel construído ou sem ouro, cochila na rua de forma muito ineficiente
          this.energy = Math.min(100, this.energy + 2 * dt);
          if (this.energy >= 40) {
            this.state = 'IDLE_TOWN';
            this.wanderTown(town, viewport);
          }
        }
        break;

      case 'DRINKING_TAVERN':
        const tavernLevel = town.buildings.tavern || 0;
        const tavernResKey = tavernLevel === 3 ? 'beer_refreshing_t3' : (tavernLevel === 2 ? 'beer_refreshing_t2' : 'beer_refreshing');

        if (town.isBuilt('tavern') && (town.resources[tavernResKey] || 0) > 0 && this.gold >= 8) {
          const rate = town.getBuildingConfig('tavern').current.moodRecovery;
          const goldEarned = town.getBuildingConfig('tavern').current.goldEarned;
          
          this.mood = Math.min(100, this.mood + rate * dt * 4);
          
          this.stateTimer += dt;
          if (this.stateTimer >= 2.5 || this.mood >= 100) {
            town.resources[tavernResKey]--;
            town.gold += goldEarned;
            this.gold -= goldEarned;
            this.mood = 100;
            this.addLog(`Bebeu na taverna.`);
            this.state = 'IDLE_TOWN';
            this.wanderTown(town, viewport);
          }
        } else {
          // Sem cerveja, recupera humor lentamente andando na praça
          this.mood = Math.min(100, this.mood + 2 * dt);
          if (this.mood >= 45) {
            this.state = 'IDLE_TOWN';
            this.wanderTown(town, viewport);
          }
        }
        break;

      case 'SELLING_LOOT':
        if (!town.autoBuyHeroLoot) {
          this.state = 'IDLE_TOWN';
          this.wanderTown(town, viewport);
          break;
        }
        this.stateTimer += dt;
        if (this.stateTimer >= 1.5) {
          const result = town.buyLootFromHero(this);
          if (result.goldPaid > 0) {
            this.addLog(`Vendeu materiais por +${result.goldPaid} ouro.`);
            // Tentar comprar novos equipamentos se tiver ouro
            this.buyEquipmentFromShops(town);
          } else {
            this.addLog(`Prefeitura sem ouro para comprar meus itens.`);
          }
          this.state = 'IDLE_TOWN';
          this.wanderTown(town, viewport);
        }
        break;
    }

    if (this.currentMap === 'hunt') {
      this.clampToHunt(viewport);
      this.clampHuntTarget(viewport);
    }
  }

  // Avalia as necessidades do herói e define o estado apropriado
  evaluateNeeds(town, viewport = {}) {
    if (this.isGhost) {
      const target = town.isBuilt('hospital') ? 'hospital' : 'townhall';
      this.state = 'RETURNING_TOWN';
      this.stateTimer = 0;
      if (this.currentMap === 'hunt') {
        this.tempTargetBuilding = target;
        const huntExit = getHuntExitPoint(viewport.width, viewport.height);
        this.targetX = huntExit.x;
        this.targetY = huntExit.y;
      } else {
        this.targetBuilding(target, town, viewport);
      }
      return true;
    }

    let target = null;
    let logMsg = "";

    // Obter as chaves de recursos correspondentes aos níveis atuais das construções
    const hospLevel = town.buildings.hospital || 0;
    const hospResKey = hospLevel === 3 ? 'bandage_basic_t3' : (hospLevel === 2 ? 'bandage_basic_t2' : 'bandage_basic');

    const restLevel = town.buildings.restaurant || 0;
    const restResKey = restLevel === 3 ? 'meal_cooked_t3' : (restLevel === 2 ? 'meal_cooked_t2' : 'meal_cooked');

    const hotelLevel = town.buildings.hotel || 0;
    const hotelResKey = hotelLevel === 3 ? 'bed_disposable_t3' : (hotelLevel === 2 ? 'bed_disposable_t2' : 'bed_disposable');

    const tavernLevel = town.buildings.tavern || 0;
    const tavernResKey = tavernLevel === 3 ? 'beer_refreshing_t3' : (tavernLevel === 2 ? 'beer_refreshing_t2' : 'beer_refreshing');

    // 1. Hospital (Vida)
    if (this.hp < this.maxHp * 0.35) {
      if (town.isBuilt('hospital') && (town.resources[hospResKey] || 0) > 0 && this.gold >= 8) {
        target = 'hospital';
        logMsg = `Indo ao Hospital para curar HP.`;
      } else if (!town.isBuilt('hospital')) {
        target = 'townhall';
        logMsg = `Ferido. Sem hospital, retornando para descansar na praça central.`;
      }
    }
    // 2. Restaurante (Fome)
    else if (this.hunger < 25) {
      if (town.isBuilt('restaurant') && (town.resources[restResKey] || 0) > 0 && this.gold >= 8) {
        target = 'restaurant';
        logMsg = `Fome extrema. Indo ao restaurante.`;
      } else if (!town.isBuilt('restaurant')) {
        target = 'townhall';
        logMsg = `Fome extrema. Sem restaurante, voltando para descansar na praça.`;
      }
    }
    // 3. Hotel (Energia)
    else if (this.energy < 20) {
      if (town.isBuilt('hotel') && (town.resources[hotelResKey] || 0) > 0 && this.gold >= 6) {
        target = 'hotel';
        logMsg = `Exausto. Indo dormir no hotel.`;
      } else if (!town.isBuilt('hotel')) {
        target = 'townhall';
        logMsg = `Exausto. Sem hotel, voltando para tirar um cochilo na praça.`;
      }
    }
    // 4. Taverna (Humor)
    else if (this.mood < 20) {
      if (town.isBuilt('tavern') && (town.resources[tavernResKey] || 0) > 0 && this.gold >= 8) {
        target = 'tavern';
        logMsg = `Mau humor. Indo à Taverna beber.`;
      } else if (!town.isBuilt('tavern')) {
        target = 'townhall';
        logMsg = `Triste. Sem taverna, voltando para relaxar na praça.`;
      }
    }
    // 5. Mercado (Vender Loot)
    else if (town.autoBuyHeroLoot && this.hasLootToSell() && town.isBuilt('market')) {
      target = 'market';
      logMsg = `Inventário cheio. Indo vender loot no mercado.`;
    }

    if (target) {
      this.state = 'RETURNING_TOWN';
      this.addLog(logMsg);
      this.stateTimer = 0;
      if (this.currentMap === 'hunt') {
        this.tempTargetBuilding = target;
        const huntExit = getHuntExitPoint(viewport.width, viewport.height);
        this.targetX = huntExit.x;
        this.targetY = huntExit.y;
      } else {
        this.targetBuilding(target, town, viewport);
      }
      return true;
    }

    return false;
  }

  // Entra no edifício correspondente quando chega perto
  enterBuilding(town, viewport = {}) {
    let closestBuilding = this.destinationBuilding;
    let isTownhallFallback = (closestBuilding === 'townhall');
    let minDist = closestBuilding && (town.isBuilt(closestBuilding) || isTownhallFallback) ? 0 : Infinity;

    if (!closestBuilding || (!town.isBuilt(closestBuilding) && !isTownhallFallback)) {
      closestBuilding = null;
      for (const placed of town.getPlacedBuildings()) {
        const pos = getBuildingTownPoint(town, placed.key, viewport.width, viewport.height);
        if (!pos) continue;
        const dx = this.x - pos.x;
        const dy = this.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closestBuilding = placed.key;
        }
      }
    }

    if (minDist < 40) {
      this.destinationBuilding = null;
      if (closestBuilding === 'market') {
        this.state = 'SELLING_LOOT';
        this.stateTimer = 0;
      } else if (closestBuilding === 'hotel') {
        this.state = 'RESTING_HOTEL';
        this.stateTimer = 0;
      } else if (closestBuilding === 'restaurant') {
        this.state = 'EATING_REST';
        this.stateTimer = 0;
      } else if (closestBuilding === 'hospital') {
        this.state = 'HEALING_HOSP';
        this.stateTimer = 0;
      } else if (closestBuilding === 'tavern') {
        this.state = 'DRINKING_TAVERN';
        this.stateTimer = 0;
      } else if (closestBuilding === 'townhall') {
        // Se veio para descansar na prefeitura/praça central por falta de edifícios
        if (this.hp < this.maxHp * 0.35) {
          this.state = 'HEALING_HOSP';
        } else if (this.hunger < 25) {
          this.state = 'EATING_REST';
        } else if (this.energy < 20) {
          this.state = 'RESTING_HOTEL';
        } else if (this.mood < 20) {
          this.state = 'DRINKING_TAVERN';
        } else {
          this.state = 'IDLE_TOWN';
          this.wanderTown(town, viewport);
        }
        this.stateTimer = 0;
      } else {
        this.state = 'IDLE_TOWN';
        this.wanderTown(town, viewport);
      }
    } else {
      this.state = 'IDLE_TOWN';
      this.wanderTown(town, viewport);
    }
  }

  // Executa o ataque ao monstro (dano do herói ao monstro)
  attackMonster(monster, addFloater, town) {
    const netDamage = Math.max(1, this.atk - (monster.def || 0));
    monster.takeDamage(netDamage, this, addFloater, town);

    // Registrar ataque pendente para o renderer criar o efeito visual
    this.pendingAttack = {
      type: this.attackType,
      fromX: this.x,
      fromY: this.y,
      toX: monster.x,
      toY: monster.y,
      color: this.classConfig.projectileColor || '#ffffff',
      impactColor: this.classConfig.impactColor || '#ffffff',
      damage: netDamage,
      consumed: false
    };

    // Floater de dano simples (posicionado no monstro)
    const isRanged = this.keepAwayRange > 0;
    if (!isRanged) {
      // Melee: floater imediato
      addFloater({
        x: monster.x,
        y: monster.y - 15,
        text: `${netDamage}`,
        color: this.classConfig.projectileColor || '#ffffff',
        time: 0.8,
        map: 'hunt'
      });
    }
    // Ranged: o renderer adiciona o floater quando o projétil chega
  }

  // Tenta comprar equipamentos melhores na oficina da cidade
  buyEquipmentFromShops(town) {
    if (!town.isBuilt('forge')) return;

    const forgeTier = town.buildings.forge;

    // Para cada slot de equipamento, vamos encontrar a melhor receita disponível
    const bestRecipesBySlot = {};

    for (const recipeKey in CRAFT_RECIPES) {
      const recipe = CRAFT_RECIPES[recipeKey];
      
      // Filtra por equipamento, classe do herói e tier permitido pela Forja
      if (recipe.stats && recipe.class.includes(this.className) && recipe.tier <= forgeTier) {
        const slot = recipe.slot;
        if (slot in this.equipment && ['weapon', 'armor', 'gloves', 'boots'].includes(slot)) {
          const currentItem = this.equipment[slot];
          // Se o herói não tiver o item ou a receita for de maior tier
          if (!currentItem || recipe.tier > currentItem.tier) {
            if (this.gold >= recipe.cost.gold && (town.resources[recipeKey] || 0) > 0) {
              const bestForSlot = bestRecipesBySlot[slot];
              if (!bestForSlot || recipe.tier > bestForSlot.tier) {
                bestRecipesBySlot[slot] = { key: recipeKey, ...recipe };
              }
            }
          }
        }
      }
    }

    // Comprar os melhores itens encontrados para cada slot
    let boughtAny = false;
    for (const slot in bestRecipesBySlot) {
      const bestRecipe = bestRecipesBySlot[slot];
      // Verifica se o herói ainda tem ouro e a cidade tem no estoque
      if (this.gold >= bestRecipe.cost.gold && (town.resources[bestRecipe.key] || 0) > 0) {
        this.gold -= bestRecipe.cost.gold;
        town.gold += bestRecipe.cost.gold;
        town.resources[bestRecipe.key]--;
        this.equipment[slot] = bestRecipe;
        this.addLog(`Comprou: ${bestRecipe.name}`);
        boughtAny = true;
      }
    }

    if (boughtAny) {
      this.recalculateStats();
    }
  }

  deductTownRecipeMaterials(town, recipe) {
    for (const res in recipe.cost) {
      if (res === 'gold') continue;
      town.resources[res] -= recipe.cost[res];
    }
  }
}
