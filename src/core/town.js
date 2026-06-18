import { BUILDINGS_CONFIG, CRAFT_RECIPES, ITEMS_INFO } from '../data/constants.js';

export class Town {
  constructor() {
    this.gold = 300; // Ouro inicial da cidade
    this.resources = {
      // Loots básicos coletados
      meat_raw: 5,
      rat_tail: 0,
      bat_wing: 0,
      guano: 0,
      rat_fang: 0,
      king_crown_fragment: 0,
      
      goblin_ear: 0,
      wolf_fur: 0,
      spider_silk: 0,
      poison_gland: 0,
      goblin_dagger: 0,
      queen_venom: 0,

      slime_bubble: 0,
      serpent_skin: 0,
      crocodile_scale: 0,
      leech_tooth: 0,
      hydra_scale: 0,

      // Matérias primas
      wood_rough: 10,
      iron_ore: 5,
      steel_ore: 0,
      herbs_wild: 5,
      linho: 5,

      // Gemas
      gem_ruby: 0,
      gem_emerald: 0,
      gem_sapphire: 0,

      // Consumíveis fabricados
      meal_cooked: 2,
      bandage_basic: 2,
      beer_refreshing: 2
    };

    this.buildings = {
      townhall: 1, // Prefeitura começa no nível 1
      hotel: 0,    // Outros prédios começam bloqueados (nível 0)
      restaurant: 0,
      hospital: 0,
      tavern: 0,
      forge: 0
    };

    // Fila de fabricação em andamento
    this.craftQueue = [];
  }

  // Verifica se o prédio está construído
  isBuilt(buildingType) {
    return this.buildings[buildingType] > 0;
  }

  // Obtém configuração do nível atual do prédio
  getBuildingConfig(buildingType) {
    const level = this.buildings[buildingType];
    const config = BUILDINGS_CONFIG[buildingType];
    if (!config) return null;
    
    // Se o nível for 0 (não construído), retorna os dados de custo de construção (nível 1)
    if (level === 0) {
      return { level: 0, next: config.upgrades[0], name: config.name, icon: config.icon, description: config.description };
    }
    
    const current = config.upgrades[level - 1];
    const next = config.upgrades[level] || null;
    return { level, current, next, name: config.name, icon: config.icon, description: config.description };
  }

  // Constrói ou melhora um prédio
  upgradeBuilding(buildingType) {
    const info = this.getBuildingConfig(buildingType);
    if (!info || !info.next) return false;

    const cost = info.next.cost;

    // Verificar se a prefeitura atende o requisito de nível se necessário
    if (buildingType !== 'townhall' && this.buildings[buildingType] >= this.buildings.townhall) {
      return { success: false, reason: 'Melhore a Prefeitura antes para subir este prédio!' };
    }

    // Verificar ouro e recursos
    if (this.gold < (cost.gold || 0)) {
      return { success: false, reason: 'Ouro insuficiente na prefeitura!' };
    }

    for (const res in cost) {
      if (res === 'gold') continue;
      if ((this.resources[res] || 0) < cost[res]) {
        return { success: false, reason: `Falta de recurso: ${ITEMS_INFO[res]?.name || res}` };
      }
    }

    // Deduzir custos
    this.gold -= cost.gold || 0;
    for (const res in cost) {
      if (res === 'gold') continue;
      this.resources[res] -= cost[res];
    }

    // Incrementar nível
    this.buildings[buildingType]++;
    return { success: true, level: this.buildings[buildingType] };
  }

  // Adiciona recursos à prefeitura
  addResource(type, amount) {
    if (this.resources[type] !== undefined) {
      this.resources[type] += amount;
    } else {
      this.resources[type] = amount;
    }
  }

  // Compra loot do inventário de um herói
  buyLootFromHero(hero) {
    let transactionCount = 0;
    let goldPaid = 0;
    const itemsToSell = [];

    // Encontrar itens de loot do herói
    for (const itemKey in hero.inventory) {
      const qty = hero.inventory[itemKey];
      if (qty > 0) {
        const itemInfo = ITEMS_INFO[itemKey];
        if (itemInfo && (itemInfo.type === 'loot' || itemInfo.type === 'rare')) {
          itemsToSell.push({ key: itemKey, qty, price: itemInfo.price });
        }
      }
    }

    for (const transaction of itemsToSell) {
      const totalPrice = transaction.qty * transaction.price;
      
      // Prefeitura precisa ter ouro para pagar
      if (this.gold >= totalPrice) {
        this.gold -= totalPrice;
        hero.gold += totalPrice;
        hero.inventory[transaction.key] = 0;
        this.resources[transaction.key] += transaction.qty;
        goldPaid += totalPrice;
        transactionCount++;
      } else {
        // Compra parcial se não tiver ouro suficiente
        const maxAffordable = Math.floor(this.gold / transaction.price);
        if (maxAffordable > 0) {
          const partialPrice = maxAffordable * transaction.price;
          this.gold -= partialPrice;
          hero.gold += partialPrice;
          hero.inventory[transaction.key] -= maxAffordable;
          this.resources[transaction.key] += maxAffordable;
          goldPaid += partialPrice;
          transactionCount++;
        }
        break; // Sem ouro para o resto
      }
    }

    return { transactionCount, goldPaid };
  }

  // Inicia o craft de um consumível
  craftConsumable(recipeId, quantity = 1) {
    const recipe = CRAFT_RECIPES[recipeId];
    if (!recipe) return { success: false, reason: 'Receita desconhecida.' };

    const building = recipe.building;
    if (!this.isBuilt(building)) {
      return { success: false, reason: `É necessário construir o(a) ${BUILDINGS_CONFIG[building].name}!` };
    }

    // Calcular custo total
    const totalCost = {};
    for (const key in recipe.cost) {
      totalCost[key] = recipe.cost[key] * quantity;
    }

    // Verificar se possui recursos
    for (const key in totalCost) {
      if ((this.resources[key] || 0) < totalCost[key]) {
        return { success: false, reason: `Falta de recurso: ${ITEMS_INFO[key]?.name || key}` };
      }
    }

    // Deduzir recursos
    for (const key in totalCost) {
      this.resources[key] -= totalCost[key];
    }

    // Adicionar na fila de fabricação
    const craftTime = 3000; // 3 segundos base por item
    const speedMult = this.getBuildingConfig(building).current?.craftSpeed || 1.0;
    const duration = (craftTime * quantity) / speedMult;

    const job = {
      id: Date.now() + Math.random(),
      recipeId,
      result: recipe.result,
      quantity: quantity * recipe.qty,
      timeLeft: duration,
      duration: duration,
      building
    };

    this.craftQueue.push(job);
    return { success: true, job };
  }

  // Atualiza a fila de craft (executado a cada tick)
  updateCrafting(dt) {
    const completedJobs = [];
    
    for (let i = this.craftQueue.length - 1; i >= 0; i--) {
      const job = this.craftQueue[i];
      job.timeLeft -= dt;
      
      if (job.timeLeft <= 0) {
        // Craft completo!
        this.addResource(job.result, job.quantity);
        completedJobs.push(job);
        this.craftQueue.splice(i, 1);
      }
    }

    return completedJobs;
  }

  // Compra de matérias primas adicionais pela prefeitura (Importações básicas)
  importMaterials(itemKey, amount, costGold) {
    if (this.gold >= costGold) {
      this.gold -= costGold;
      this.addResource(itemKey, amount);
      return true;
    }
    return false;
  }
}
