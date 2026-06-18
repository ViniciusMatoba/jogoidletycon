import { BUILDINGS_CONFIG, CRAFT_RECIPES, ITEMS_INFO } from '../data/constants.js';

export class Town {
  constructor() {
    this.gold = 300;
    this.resources = {
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

      wood_rough: 10,
      iron_ore: 5,
      steel_ore: 0,
      herbs_wild: 5,
      linho: 5,

      gem_ruby: 0,
      gem_emerald: 0,
      gem_sapphire: 0,

      meal_cooked: 2,
      bandage_basic: 2,
      beer_refreshing: 2,
      bed_disposable: 2,
      meal_cooked_t2: 0,
      bandage_basic_t2: 0,
      beer_refreshing_t2: 0,
      bed_disposable_t2: 0,
      meal_cooked_t3: 0,
      bandage_basic_t3: 0,
      beer_refreshing_t3: 0,
      bed_disposable_t3: 0
    };

    this.buildings = {
      townhall: 0,
      hotel: 0,
      restaurant: 0,
      hospital: 0,
      tavern: 0,
      forge: 0
    };

    this.autoBuyHeroLoot = false;
    this.grid = { cols: 14, rows: 12 };
    this.buildingFootprints = {
      townhall: { w: 3, h: 3 },
      hotel: { w: 2, h: 2 },
      restaurant: { w: 2, h: 2 },
      hospital: { w: 2, h: 2 },
      tavern: { w: 2, h: 2 },
      forge: { w: 2, h: 2 }
    };
    this.buildingPlacements = {};
    this.craftQueue = [];
  }

  isBuilt(buildingType) {
    return (this.buildings[buildingType] || 0) > 0;
  }

  getMaxHeroes() {
    const info = this.getBuildingConfig('townhall');
    return info?.current?.maxHeroes || 1;
  }

  getBuildingFootprint(buildingType) {
    return this.buildingFootprints[buildingType] || { w: 2, h: 2 };
  }

  getBuildingPlacement(buildingType) {
    return this.buildingPlacements[buildingType] || null;
  }

  getPlacedBuildings() {
    return Object.keys(this.buildingPlacements)
      .filter(key => this.isBuilt(key))
      .map(key => ({
        key,
        ...this.buildingPlacements[key],
        footprint: this.getBuildingFootprint(key)
      }));
  }

  isInsideGrid(col, row, footprint) {
    return col >= 0 && row >= 0 &&
      col + footprint.w <= this.grid.cols &&
      row + footprint.h <= this.grid.rows;
  }

  isAreaFree(col, row, footprint, ignoredBuilding = null) {
    if (!this.isInsideGrid(col, row, footprint)) return false;

    const test = { col, row, w: footprint.w, h: footprint.h };
    for (const key in this.buildingPlacements) {
      if (key === ignoredBuilding || !this.isBuilt(key)) continue;

      const placed = this.buildingPlacements[key];
      const fp = this.getBuildingFootprint(key);
      const other = { col: placed.col, row: placed.row, w: fp.w, h: fp.h };
      const overlaps = test.col < other.col + other.w &&
        test.col + test.w > other.col &&
        test.row < other.row + other.h &&
        test.row + test.h > other.row;

      if (overlaps) return false;
    }

    return true;
  }

  buildAt(buildingType, col, row) {
    const footprint = this.getBuildingFootprint(buildingType);
    if (!this.isAreaFree(col, row, footprint, buildingType)) {
      return { success: false, reason: 'Esse espaco nao comporta a construcao.' };
    }

    if (this.isBuilt(buildingType)) {
      this.buildingPlacements[buildingType] = { col, row };
      return { success: true, moved: true };
    }

    const result = this.upgradeBuilding(buildingType);
    if (!result.success) return result;

    this.buildingPlacements[buildingType] = { col, row };
    return { success: true, level: this.buildings[buildingType] };
  }

  getBuildingConfig(buildingType) {
    const level = this.buildings[buildingType] || 0;
    const config = BUILDINGS_CONFIG[buildingType];
    if (!config) return null;

    if (level === 0) {
      return {
        level: 0,
        next: config.upgrades[0],
        name: config.name,
        icon: config.icon,
        description: config.description
      };
    }

    const current = config.upgrades[level - 1];
    const next = config.upgrades[level] || null;
    return { level, current, next, name: config.name, icon: config.icon, description: config.description };
  }

  upgradeBuilding(buildingType) {
    const info = this.getBuildingConfig(buildingType);
    if (!info || !info.next) return { success: false, reason: 'Construcao desconhecida.' };

    if (buildingType !== 'townhall' && this.buildings.townhall <= 0) {
      return { success: false, reason: 'Construa o Centro da Cidade primeiro!' };
    }

    if (buildingType !== 'townhall' && this.buildings[buildingType] >= this.buildings.townhall) {
      return { success: false, reason: 'Melhore a Prefeitura antes para subir este predio!' };
    }

    const cost = info.next.cost;
    if (this.gold < (cost.gold || 0)) {
      return { success: false, reason: 'Ouro insuficiente na prefeitura!' };
    }

    for (const res in cost) {
      if (res === 'gold') continue;
      if ((this.resources[res] || 0) < cost[res]) {
        return { success: false, reason: `Falta de recurso: ${ITEMS_INFO[res]?.name || res}` };
      }
    }

    this.gold -= cost.gold || 0;
    for (const res in cost) {
      if (res !== 'gold') this.resources[res] -= cost[res];
    }

    this.buildings[buildingType] = (this.buildings[buildingType] || 0) + 1;
    return { success: true, level: this.buildings[buildingType] };
  }

  addResource(type, amount) {
    if (this.resources[type] !== undefined) {
      this.resources[type] += amount;
    } else if (type === 'gold') {
      this.gold += amount;
    } else {
      this.resources[type] = amount;
    }
  }

  buyLootFromHero(hero) {
    let transactionCount = 0;
    let goldPaid = 0;
    const itemsToSell = [];

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
      if (this.gold >= totalPrice) {
        this.gold -= totalPrice;
        hero.gold += totalPrice;
        hero.inventory[transaction.key] = 0;
        this.resources[transaction.key] = (this.resources[transaction.key] || 0) + transaction.qty;
        goldPaid += totalPrice;
        transactionCount++;
      } else {
        const maxAffordable = Math.floor(this.gold / transaction.price);
        if (maxAffordable > 0) {
          const partialPrice = maxAffordable * transaction.price;
          this.gold -= partialPrice;
          hero.gold += partialPrice;
          hero.inventory[transaction.key] -= maxAffordable;
          this.resources[transaction.key] = (this.resources[transaction.key] || 0) + maxAffordable;
          goldPaid += partialPrice;
          transactionCount++;
        }
        break;
      }
    }

    return { transactionCount, goldPaid };
  }

  craftConsumable(recipeId, quantity = 1) {
    const recipe = CRAFT_RECIPES[recipeId];
    if (!recipe) return { success: false, reason: 'Receita desconhecida.' };

    const building = recipe.building || 'forge';
    if (!this.isBuilt(building)) {
      return { success: false, reason: `É necessário construir o(a) ${BUILDINGS_CONFIG[building].name}!` };
    }

    const totalCost = {};
    for (const key in recipe.cost) {
      totalCost[key] = recipe.cost[key] * quantity;
    }

    for (const key in totalCost) {
      const owned = key === 'gold' ? this.gold : this.resources[key] || 0;
      if (owned < totalCost[key]) {
        return { success: false, reason: `Falta de recurso: ${key === 'gold' ? 'Ouro' : ITEMS_INFO[key]?.name || key}` };
      }
    }

    for (const key in totalCost) {
      if (key === 'gold') {
        this.gold -= totalCost[key];
      } else {
        this.resources[key] -= totalCost[key];
      }
    }

    const craftTime = 3000;
    const speedMult = this.getBuildingConfig(building).current?.craftSpeed || 1.0;
    const duration = (craftTime * quantity) / speedMult;
    const job = {
      id: Date.now() + Math.random(),
      recipeId,
      result: recipe.result || recipeId,
      quantity: quantity * (recipe.qty || 1),
      timeLeft: duration,
      duration,
      building
    };

    this.craftQueue.push(job);
    return { success: true, job };
  }

  updateCrafting(dt) {
    const completedJobs = [];

    for (let i = this.craftQueue.length - 1; i >= 0; i--) {
      const job = this.craftQueue[i];
      job.timeLeft -= dt;

      if (job.timeLeft <= 0) {
        this.addResource(job.result, job.quantity);
        completedJobs.push(job);
        this.craftQueue.splice(i, 1);
      }
    }

    return completedJobs;
  }

  importMaterials(itemKey, amount, costGold) {
    if (this.gold >= costGold) {
      this.gold -= costGold;
      this.addResource(itemKey, amount);
      return true;
    }
    return false;
  }
}
