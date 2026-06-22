import { Town } from './town.js';
import { Hero } from './hero.js';
import { MonsterSpawner } from './monster.js';
import { BIOMES, HERO_CLASSES } from '../data/constants.js';
import { getRandomTownPoint } from './navigation.js';

const SAVE_VERSION = 2;

export class Game {
  constructor() {
    this.town = new Town();
    this.spawner = new MonsterSpawner();
    this.heroes = [];
    this.pets = [];
    this.floaters = [];
    this.isPaused = false;
    this.speed = 1.0;
    this._pendingCloudSave = null; // preenchido por main.js antes de init()
  }

  init() {
    let loaded = false;
    // Se main.js injetou dados da nuvem, usa-os como save prioritário
    if (this._pendingCloudSave) {
      const ok = this._applyLoadedData(this._pendingCloudSave);
      this._pendingCloudSave = null;
      if (ok) loaded = true;
    }
    if (!loaded && this.loadGame()) {
      loaded = true;
    }

    if (loaded) {
      this.ensurePrototypePets();
      return;
    }

    const startingClasses = Object.keys(HERO_CLASSES);
    const randomClass = startingClasses[Math.floor(Math.random() * startingClasses.length)];
    this.hireHero(randomClass, true);
    this.ensurePrototypePets();
  }

  ensurePrototypePets() {
    if (this.pets.some(p => p.id === 'starter_fox')) return;

    const hiddenTownStates = new Set(['HEALING_HOSP', 'EATING_REST', 'RESTING_HOTEL', 'DRINKING_TAVERN', 'SELLING_LOOT']);
    const anchor = this.heroes.find(hero => hero.currentMap === 'town' && !hiddenTownStates.has(hero.state)) || { x: 360, y: 320 };
    this.pets.push({
      id: 'starter_fox',
      name: 'Raposa',
      assetKey: 'pet_fox_walk',
      x: anchor.x - 34,
      y: anchor.y + 18,
      targetX: anchor.x - 34,
      targetY: anchor.y + 18,
      facingDir: 'E',
      bobSeed: Math.random() * Math.PI * 2
    });
  }

  hireHero(className, free = false) {
    const maxHeroes = this.town.getMaxHeroes();
    if (this.heroes.length >= maxHeroes) {
      return { success: false, reason: `Prefeitura cheia! Limite: ${maxHeroes} herois.` };
    }

    const cost = this.getHiringCost();
    if (!free && this.town.gold < cost) {
      return { success: false, reason: `Ouro insuficiente na prefeitura (Custo: ${cost} Ouro).` };
    }

    if (!free) this.town.gold -= cost;

    const hero = new Hero(this.heroes.length + 1, className);
    const point = getRandomTownPoint(this.town);
    hero.x = point.x;
    hero.y = point.y;
    hero.targetX = point.x;
    hero.targetY = point.y;
    this.heroes.push(hero);
    this.saveGame();
    return { success: true, hero };
  }

  getHiringCost() {
    // Retorna custo zero para facilitar testes de variacoes
    return 0;
  }

  addFloater(config) {
    this.floaters.push({
      x: config.x,
      y: config.y,
      text: config.text,
      color: config.color || '#ffffff',
      timeLeft: config.time || 1.0,
      maxTime: config.time || 1.0,
      map: config.map || null
    });
  }

  update(dt, viewport = {}) {
    if (this.isPaused) return;

    const actualDt = dt * this.speed;
    this.spawner.update(actualDt, this.town, this.heroes, viewport, this.addFloater.bind(this));

    this.heroes.forEach(hero => {
      hero.update(actualDt, this.town, this.spawner.activeMonsters, this.addFloater.bind(this), viewport, this.heroes);
    });

    this.updatePets(actualDt, viewport);
    this.town.updateCrafting(actualDt);

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const floater = this.floaters[i];
      floater.timeLeft -= actualDt;
      floater.y -= 15 * actualDt;
      if (floater.timeLeft <= 0) {
        this.floaters.splice(i, 1);
      }
    }
  }

  updatePets(dt, viewport = {}) {
    if (!this.pets.length) return;

    const hiddenTownStates = new Set(['HEALING_HOSP', 'EATING_REST', 'RESTING_HOTEL', 'DRINKING_TAVERN', 'SELLING_LOOT']);
    const townHeroes = this.heroes.filter(hero => hero.currentMap === 'town' && !hiddenTownStates.has(hero.state));
    const leader = townHeroes[0];
    const width = viewport.width || 960;
    const height = viewport.height || 540;
    const minX = 24;
    const maxX = Math.max(minX, Math.min(width - 24, 430));
    const minY = 70;
    const maxY = Math.max(minY, height - 72);

    this.pets.forEach((pet, index) => {
      let targetX = width * 0.54 + index * 24;
      let targetY = height * 0.62 + index * 14;

      if (leader) {
        const side = index % 2 === 0 ? -1 : 1;
        const drift = Math.sin(performance.now() * 0.0012 + pet.bobSeed) * 6;
        targetX = leader.x + side * 34 + drift;
        targetY = leader.y + 18 + Math.cos(performance.now() * 0.001 + pet.bobSeed) * 4;
      }

      pet.targetX = Math.max(minX, Math.min(maxX, targetX));
      pet.targetY = Math.max(minY, Math.min(maxY, targetY));

      const dx = pet.targetX - pet.x;
      const dy = pet.targetY - pet.y;
      const dist = Math.hypot(dx, dy);
      const speed = 78;

      if (!leader && dist > 180) {
        pet.x = pet.targetX;
        pet.y = pet.targetY;
        return;
      }

      if (dist > 1) {
        const step = Math.min(dist, speed * dt);
        pet.x += (dx / dist) * step;
        pet.y += (dy / dist) * step;

        if (Math.abs(dx) > Math.abs(dy)) {
          pet.facingDir = dx >= 0 ? 'E' : 'W';
        } else {
          pet.facingDir = dy >= 0 ? 'S' : 'N';
        }
      }
    });
  }

  changeBiome(biomeId) {
    const config = BIOMES[biomeId];
    if (!config) return false;

    if (biomeId === 1 && this.town.buildings.townhall < 3) {
      return { success: false, reason: 'Requer Prefeitura Nivel 3 para liberar!' };
    }
    if (biomeId === 2 && this.town.buildings.townhall < 4) {
      return { success: false, reason: 'Requer Prefeitura Nivel 4 para liberar!' };
    }
    if (biomeId === 3 && this.town.buildings.townhall < 5) {
      return { success: false, reason: 'Requer Prefeitura Nivel 5 para liberar!' };
    }
    if (biomeId === 4 && this.town.buildings.townhall < 6) {
      return { success: false, reason: 'Requer Prefeitura Nivel 6 para liberar!' };
    }
    if (biomeId === 5 && this.town.buildings.townhall < 7) {
      return { success: false, reason: 'Requer Prefeitura Nivel 7 para liberar!' };
    }
    if (biomeId === 6 && this.town.buildings.townhall < 8) {
      return { success: false, reason: 'Requer Prefeitura Nivel 8 para liberar!' };
    }

    this.spawner.setBiome(biomeId);
    this.heroes.forEach(hero => {
      if (hero.state === 'SEARCHING_MONSTER' || hero.state === 'FIGHTING') {
        hero.state = 'SEARCHING_MONSTER';
        hero.wanderForest();
      }
    });

    this.saveGame();
    return { success: true };
  }

  _buildSaveData() {
    return {
      version: SAVE_VERSION,
      town: {
        gold: this.town.gold,
        resources: this.town.resources,
        buildings: this.town.buildings,
        buildingPlacements: this.town.buildingPlacements
      },
      spawner: {
        currentBiomeId: this.spawner.currentBiomeId,
        killsCount: this.spawner.killsCount,
        bossKillsCount: this.spawner.bossKillsCount,
        monsterLevel: this.spawner.monsterLevel || 2
      },
      heroes: this.heroes.map(h => ({
        name: h.name,
        className: h.className,
        level: h.level,
        xp: h.xp,
        xpNeeded: h.xpNeeded,
        gold: h.gold,
        hunger: h.hunger,
        energy: h.energy,
        mood: h.mood,
        hp: h.hp,
        inventory: h.inventory,
        equipment: h.equipment,
        cosmetics: h.cosmetics,
        currentMap: h.currentMap,
        x: h.x,
        y: h.y,
        targetX: h.targetX,
        targetY: h.targetY,
        state: h.state,
        isGhost: h.isGhost || false
      })),
      lastSavedTime: Date.now()
    };
  }

  saveGame() {
    const data = this._buildSaveData();
    localStorage.setItem('idle_hunter_tycoon_save', JSON.stringify(data));

    if (window.currentUser) {
      import('./cloudSave.js').then(({ saveToCloud }) => {
        saveToCloud(window.currentUser.uid, data);
      }).catch(() => {});
    }
  }

  _applyLoadedData(data) {
    try {
      if (!data || data.version !== SAVE_VERSION) return false;

      this.town.gold = data.town.gold;
      this.town.resources = data.town.resources;
      this.town.buildings = data.town.buildings;
      this.town.buildingPlacements = data.town.buildingPlacements || {};

      this.spawner.currentBiomeId = data.spawner.currentBiomeId;
      this.spawner.killsCount = data.spawner.killsCount;
      this.spawner.bossKillsCount = data.spawner.bossKillsCount;
      this.spawner.monsterLevel = data.spawner.monsterLevel || 2;

      this.heroes = data.heroes.map((hData, index) => {
        const hero = new Hero(index + 1, hData.className);
        hero.name = hData.name;
        hero.level = hData.level;
        hero.xp = hData.xp;
        hero.xpNeeded = hData.xpNeeded;
        hero.gold = hData.gold;
        hero.hunger = hData.hunger;
        hero.energy = hData.energy;
        hero.mood = hData.mood;
        hero.hp = hData.hp;
        hero.inventory = hData.inventory;
        hero.equipment = Object.assign({
          weapon: null, armor: null, helmet: null, shield: null, necklace: null, gloves: null,
          ring: null, belt: null, boots: null
        }, hData.equipment);
        hero.applyStarterEquipment();
        hero.cosmetics = hData.cosmetics || hero.cosmetics;
        hero.currentMap = hData.currentMap || 'town';
        hero.x = hData.x ?? hero.x;
        hero.y = hData.y ?? hero.y;
        hero.targetX = hData.targetX ?? hero.targetX;
        hero.targetY = hData.targetY ?? hero.targetY;
        hero.state = hData.state || hero.state;
        hero.isGhost = !!hData.isGhost;
        hero.recalculateStats();
        return hero;
      });

      const timePassedMs = Date.now() - data.lastSavedTime;
      if (timePassedMs > 5000) {
        this.simulateOfflineProgress(timePassedMs / 1000);
      }

      return true;
    } catch (e) {
      console.error('Falha ao aplicar save:', e);
      return false;
    }
  }

  loadGame() {
    try {
      const saved = localStorage.getItem('idle_hunter_tycoon_save');
      if (!saved) return false;
      return this._applyLoadedData(JSON.parse(saved));
    } catch (e) {
      console.error('Falha ao carregar save local:', e);
      return false;
    }
  }

  simulateOfflineProgress(secondsPassed) {
    const maxOffline = 14400;
    const simTime = Math.min(secondsPassed, maxOffline);
    const tickSlice = 10;
    const slices = Math.floor(simTime / tickSlice);

    for (let i = 0; i < slices; i++) {
      this.spawner.update(tickSlice, this.town, this.heroes);
      this.heroes.forEach(hero => {
        hero.x = hero.targetX;
        hero.y = hero.targetY;
        hero.update(tickSlice, this.town, this.spawner.activeMonsters, () => {});
      });
      this.town.updateCrafting(tickSlice);
    }
  }

  resetGame() {
    localStorage.removeItem('idle_hunter_tycoon_save');
    window.location.reload();
  }
}
