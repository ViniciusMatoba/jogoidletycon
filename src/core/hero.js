import { HERO_CLASSES, ITEMS_INFO, CRAFT_RECIPES } from '../data/constants.js';

const HERO_NAMES = [
  'Alistair', 'Boran', 'Cedric', 'Dalia', 'Elysia', 
  'Fiona', 'Garrick', 'Hilda', 'Kaelen', 'Lyra', 
  'Morrigan', 'Rowan', 'Valerie', 'Zephyr', 'Gwen',
  'Tristan', 'Eldrin', 'Saria', 'Orion', 'Kael'
];

export class Hero {
  constructor(id, className) {
    this.id = id;
    this.name = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)] + ` (${HERO_CLASSES[className].name.substring(0, 3)})`;
    this.className = className;
    this.classConfig = HERO_CLASSES[className];

    // Características Cosméticas Físicas Aleatórias (Wow factor e individualidade)
    const hairColors = ['#f5d061', '#e65c40', '#7d4d33', '#2b2b2b', '#e0e0e0'];
    const skinColors = ['#ffd1a9', '#e0a97a', '#8c5835'];
    const hairStyles = ['short', 'long', 'spiky', 'bald'];
    const clothesColors = ['#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0'];

    this.cosmetics = {
      hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
      skinColor: skinColors[Math.floor(Math.random() * skinColors.length)],
      hairStyle: hairStyles[Math.floor(Math.random() * hairStyles.length)],
      clothesColor: clothesColors[Math.floor(Math.random() * clothesColors.length)]
    };

    // Status de Progressão
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = 100;
    this.gold = 50; // Começam com algum ouro para gastar na cidade

    // Status de Combate (Base + Equipamentos)
    this.equipment = {
      weapon: null, // Objeto de item de craft
      armor: null,
      helmet: null,
      necklace: null,
      gloves: null,
      ring: null,
      belt: null,
      boots: null,
      pants: null,
      accessory1: null,
      pet: null,
      weapon_skin: null,
      armor_skin: null,
      wings: null,
      accessory2: null
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

    // Posição no canvas (Cidade está à esquerda, Floresta à direita)
    // Cidade: X entre 50 e 350. Floresta: X entre 450 e 750.
    this.x = 100 + Math.random() * 100;
    this.y = 100 + Math.random() * 150;
    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 80; // Velocidade de pixels por segundo

    // Estados: 'IDLE_TOWN', 'SEARCHING_MONSTER', 'FIGHTING', 'RETURNING_TOWN',
    // 'RESTING_HOTEL', 'EATING_REST', 'HEALING_HOSP', 'DRINKING_TAVERN', 'SELLING_LOOT'
    this.state = 'IDLE_TOWN';
    this.targetMonster = null;
    this.cooldownTimer = 0;
    this.stateTimer = 0; // Para contar tempo em ações fixas
    
    // Histórico de logs de atividades do herói
    this.logs = [`Chegou à cidade.`];
  }

  // Recalcula os status somando a classe e equipamentos
  recalculateStats() {
    const classBase = HERO_CLASSES[this.className];
    
    // Crescimento de status por nível (ex: +10% por nível)
    const levelMult = 1 + (this.level - 1) * 0.12;

    this.maxHp = Math.round(classBase.baseHp * levelMult);
    this.atk = Math.round(classBase.baseAtk * levelMult);
    this.def = Math.round(classBase.baseDef * levelMult);
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

  // Escolhe novas coordenadas de alvo dentro da floresta
  wanderForest() {
    this.targetX = 510 + Math.random() * 410; // Área da Floresta
    this.targetY = 60 + Math.random() * 410;
  }

  // Escolhe novas coordenadas de alvo dentro da cidade
  wanderTown() {
    this.targetX = 60 + Math.random() * 370; // Área da Cidade
    this.targetY = 80 + Math.random() * 370;
  }

  // Define um prédio como alvo físico
  targetBuilding(buildingType) {
    // Coordenadas aproximadas dos edifícios no Canvas 960x540
    const positions = {
      townhall: { x: 230, y: 100 },
      hotel: { x: 130, y: 200 },
      restaurant: { x: 330, y: 200 },
      hospital: { x: 130, y: 340 },
      tavern: { x: 330, y: 340 },
      forge: { x: 230, y: 450 }
    };

    const pos = positions[buildingType] || { x: 230, y: 250 };
    // Pequena variação para heróis não ficarem sobrepostos
    this.targetX = pos.x + (Math.random() * 20 - 10);
    this.targetY = pos.y + (Math.random() * 20 - 10);
  }

  // Ciclo principal de atualização da IA do Herói
  update(dt, town, monsters, addFloater) {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);

    // Necessidades decaem de forma lenta
    // Decaem cerca de 0.8 pontos por segundo quando caçando
    const decayRate = this.state === 'FIGHTING' || this.state === 'SEARCHING_MONSTER' ? 0.6 : 0.15;
    this.hunger = Math.max(0, this.hunger - decayRate * dt);
    this.energy = Math.max(0, this.energy - decayRate * dt);
    this.mood = Math.max(0, this.mood - decayRate * dt);

    // 1. Executa de acordo com o estado
    switch (this.state) {
      case 'IDLE_TOWN':
        // Fica vagando na cidade um tempo antes de caçar ou atender necessidades
        if (this.moveTowardsTarget(dt)) {
          this.stateTimer += dt;
          if (this.stateTimer > 2) {
            this.stateTimer = 0;
            // Avaliar necessidades
            if (this.evaluateNeeds(town)) {
              return;
            }
            // Ir caçar
            this.state = 'SEARCHING_MONSTER';
            this.wanderForest();
            this.addLog(`Saindo para caçar monstros.`);
          } else {
            this.wanderTown();
          }
        }
        break;

      case 'SEARCHING_MONSTER':
        if (monsters.length === 0) {
          // Nenhum monstro no bioma ativo
          if (this.moveTowardsTarget(dt)) {
            this.wanderForest();
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
          
          if (minDist < 25) {
            this.state = 'FIGHTING';
            this.addLog(`Atacando ${closest.name}.`);
          } else {
            this.moveTowardsTarget(dt);
          }
        } else {
          // Vagueia
          if (this.moveTowardsTarget(dt)) {
            this.wanderForest();
          }
        }
        break;

      case 'FIGHTING':
        // Verifica se o monstro ainda existe e está vivo
        if (!this.targetMonster || this.targetMonster.hp <= 0) {
          this.targetMonster = null;
          // Verifica necessidades após luta
          if (this.evaluateNeeds(town)) return;
          this.state = 'SEARCHING_MONSTER';
          this.wanderForest();
          return;
        }

        // Batalha: Atacar se cooldown zerou
        if (this.cooldownTimer <= 0) {
          this.attackMonster(this.targetMonster, addFloater);
          this.cooldownTimer = 1 / this.spd;
        }

        // Se o herói morrer, ele volta imediatamente ao hospital
        if (this.hp <= 0) {
          this.hp = 1;
          this.state = 'RETURNING_TOWN';
          this.addLog(`Ficou inconsciente! Fugindo...`);
          this.targetBuilding('hospital');
        }
        break;

      case 'RETURNING_TOWN':
        // Movendo até o prédio alvo
        if (this.moveTowardsTarget(dt)) {
          // Identificar qual era o prédio destino
          this.enterBuilding(town);
        }
        break;

      case 'HEALING_HOSP':
        // Recuperar vida no hospital
        if (town.isBuilt('hospital') && town.resources.bandage_basic > 0 && this.gold >= 8) {
          const rate = town.getBuildingConfig('hospital').current.hpRecovery;
          this.hp = Math.min(this.maxHp, this.hp + rate * dt * 4);
          
          this.stateTimer += dt;
          if (this.stateTimer >= 2.5 || this.hp >= this.maxHp) {
            // Pagamento e finalização
            town.resources.bandage_basic--;
            town.gold += 8;
            this.gold -= 8;
            this.hp = this.maxHp;
            this.addLog(`Tratamento concluído.`);
            this.state = 'IDLE_TOWN';
            this.wanderTown();
          }
        } else {
          // Sem recursos no hospital, cura passiva lenta
          this.hp = Math.min(this.maxHp, this.hp + 2 * dt);
          if (this.hp >= this.maxHp) {
            this.state = 'IDLE_TOWN';
            this.wanderTown();
          }
        }
        break;

      case 'EATING_REST':
        if (town.isBuilt('restaurant') && town.resources.meal_cooked > 0 && this.gold >= 8) {
          const rate = town.getBuildingConfig('restaurant').current.foodRecovery;
          this.hunger = Math.min(100, this.hunger + rate * dt * 4);
          
          this.stateTimer += dt;
          if (this.stateTimer >= 2.5 || this.hunger >= 100) {
            town.resources.meal_cooked--;
            town.gold += 8;
            this.gold -= 8;
            this.hunger = 100;
            this.addLog(`Almoçou ensopado.`);
            this.state = 'IDLE_TOWN';
            this.wanderTown();
          }
        } else {
          // Sem comida, herói fica irritado mas volta a agir
          this.hunger = Math.min(100, this.hunger + 1.5 * dt);
          if (this.hunger >= 50) {
            this.state = 'IDLE_TOWN';
            this.wanderTown();
          }
        }
        break;

      case 'RESTING_HOTEL':
        if (town.isBuilt('hotel') && this.gold >= 6) {
          const rate = town.getBuildingConfig('hotel').current.energyRecovery;
          const goldEarned = town.getBuildingConfig('hotel').current.goldEarned;
          
          this.energy = Math.min(100, this.energy + rate * dt * 4);
          
          this.stateTimer += dt;
          if (this.stateTimer >= 3.0 || this.energy >= 100) {
            town.gold += goldEarned;
            this.gold -= goldEarned;
            this.energy = 100;
            this.addLog(`Dormiu no hotel.`);
            this.state = 'IDLE_TOWN';
            this.wanderTown();
          }
        } else {
          // Sem hotel construído ou sem ouro, cochila na rua de forma muito ineficiente
          this.energy = Math.min(100, this.energy + 2 * dt);
          if (this.energy >= 40) {
            this.state = 'IDLE_TOWN';
            this.wanderTown();
          }
        }
        break;

      case 'DRINKING_TAVERN':
        if (town.isBuilt('tavern') && town.resources.beer_refreshing > 0 && this.gold >= 8) {
          const rate = town.getBuildingConfig('tavern').current.moodRecovery;
          const goldEarned = town.getBuildingConfig('tavern').current.goldEarned;
          
          this.mood = Math.min(100, this.mood + rate * dt * 4);
          
          this.stateTimer += dt;
          if (this.stateTimer >= 2.5 || this.mood >= 100) {
            town.resources.beer_refreshing--;
            town.gold += goldEarned;
            this.gold -= goldEarned;
            this.mood = 100;
            this.addLog(`Bebeu na taverna.`);
            this.state = 'IDLE_TOWN';
            this.wanderTown();
          }
        } else {
          // Sem cerveja, recupera humor lentamente andando na praça
          this.mood = Math.min(100, this.mood + 2 * dt);
          if (this.mood >= 45) {
            this.state = 'IDLE_TOWN';
            this.wanderTown();
          }
        }
        break;

      case 'SELLING_LOOT':
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
          this.wanderTown();
        }
        break;
    }
  }

  // Avalia as necessidades do herói e define o estado apropriado
  evaluateNeeds(town) {
    // 1. Hospital (Vida)
    if (this.hp < this.maxHp * 0.35 && this.gold >= 8) {
      this.state = 'RETURNING_TOWN';
      this.addLog(`Indo ao Hospital para curar HP.`);
      this.targetBuilding('hospital');
      this.stateTimer = 0;
      return true;
    }
    // 2. Restaurante (Fome)
    if (this.hunger < 25 && this.gold >= 8) {
      this.state = 'RETURNING_TOWN';
      this.addLog(`Fome extrema. Indo ao restaurante.`);
      this.targetBuilding('restaurant');
      this.stateTimer = 0;
      return true;
    }
    // 3. Hotel (Energia)
    if (this.energy < 20 && this.gold >= 6) {
      this.state = 'RETURNING_TOWN';
      this.addLog(`Exausto. Indo dormir no hotel.`);
      this.targetBuilding('hotel');
      this.stateTimer = 0;
      return true;
    }
    // 4. Taverna (Humor)
    if (this.mood < 20 && this.gold >= 8) {
      this.state = 'RETURNING_TOWN';
      this.addLog(`Mau humor. Indo à Taverna beber.`);
      this.targetBuilding('tavern');
      this.stateTimer = 0;
      return true;
    }
    // 5. Prefeitura (Vender Loot)
    if (this.hasLootToSell()) {
      this.state = 'RETURNING_TOWN';
      this.addLog(`Inventário cheio. Indo vender loot.`);
      this.targetBuilding('townhall');
      this.stateTimer = 0;
      return true;
    }

    return false;
  }

  // Entra no edifício correspondente quando chega perto
  enterBuilding(town) {
    // Verifica qual prédio está mais próximo baseado nas posições predefinidas do canvas 960x540
    if (Math.abs(this.x - 230) < 30 && Math.abs(this.y - 100) < 30) {
      this.state = 'SELLING_LOOT';
      this.stateTimer = 0;
    } else if (Math.abs(this.x - 130) < 30 && Math.abs(this.y - 200) < 30) {
      this.state = 'RESTING_HOTEL';
      this.stateTimer = 0;
    } else if (Math.abs(this.x - 330) < 30 && Math.abs(this.y - 200) < 30) {
      this.state = 'EATING_REST';
      this.stateTimer = 0;
    } else if (Math.abs(this.x - 130) < 30 && Math.abs(this.y - 340) < 30) {
      this.state = 'HEALING_HOSP';
      this.stateTimer = 0;
    } else if (Math.abs(this.x - 330) < 30 && Math.abs(this.y - 340) < 30) {
      this.state = 'DRINKING_TAVERN';
      this.stateTimer = 0;
    } else {
      this.state = 'IDLE_TOWN';
      this.wanderTown();
    }
  }

  // Executa o ataque ao monstro
  attackMonster(monster, addFloater) {
    // Calcular dano com base na defesa do monstro
    const netDamage = Math.max(1, this.atk - monster.def);
    monster.takeDamage(netDamage, this, addFloater);
    
    // Mostrar flutuante de dano no Canvas
    addFloater({
      x: monster.x,
      y: monster.y - 15,
      text: `${netDamage}`,
      color: this.classConfig.magical ? '#c23aff' : '#ffffff',
      time: 0.8
    });

    // Se o monstro revidar (Simulado para simplificar e dar dano ao herói)
    // O monstro revida com 40% do dano base dele
    if (monster.hp > 0) {
      const monsterDmg = Math.max(1, Math.round(monster.atk * 0.45) - this.def);
      this.hp = Math.max(0, this.hp - monsterDmg);
      
      addFloater({
        x: this.x,
        y: this.y - 15,
        text: `-${monsterDmg}`,
        color: '#ff3d3d',
        time: 0.8
      });
    }
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
        if (slot in this.equipment) {
          const currentItem = this.equipment[slot];
          // Se o herói não tiver o item ou a receita for de maior tier
          if (!currentItem || recipe.tier > currentItem.tier) {
            if (this.gold >= recipe.cost.gold && this.canTownAffordRecipe(town, recipe)) {
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
      // Verifica se o herói ainda tem ouro e a cidade ainda tem materiais
      if (this.gold >= bestRecipe.cost.gold && this.canTownAffordRecipe(town, bestRecipe)) {
        this.gold -= bestRecipe.cost.gold;
        town.gold += bestRecipe.cost.gold;
        this.deductTownRecipeMaterials(town, bestRecipe);
        this.equipment[slot] = bestRecipe;
        this.addLog(`Comprou: ${bestRecipe.name}`);
        boughtAny = true;
      }
    }

    if (boughtAny) {
      this.recalculateStats();
    }
  }

  canTownAffordRecipe(town, recipe) {
    for (const res in recipe.cost) {
      if (res === 'gold') continue; // Ouro é pago pelo herói
      if ((town.resources[res] || 0) < recipe.cost[res]) {
        return false;
      }
    }
    return true;
  }

  deductTownRecipeMaterials(town, recipe) {
    for (const res in recipe.cost) {
      if (res === 'gold') continue;
      town.resources[res] -= recipe.cost[res];
    }
  }
}
