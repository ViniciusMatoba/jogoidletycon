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
    this.floaters = [];
    this.isPaused = false;
    this.speed = 1.0;
    this.init();
  }

  init() {
    if (this.loadGame()) return;

    const startingClasses = Object.keys(HERO_CLASSES);
    const randomClass = startingClasses[Math.floor(Math.random() * startingClasses.length)];
    this.hireHero(randomClass, true);
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
    const count = this.heroes.length;
    if (count <= 3) return 80;
    if (count <= 5) return 250;
    return 600;
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
    this.spawner.update(actualDt, this.town, this.heroes, viewport);

    this.heroes.forEach(hero => {
      hero.update(actualDt, this.town, this.spawner.activeMonsters, this.addFloater.bind(this), viewport);
    });

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

  changeBiome(biomeId) {
    const config = BIOMES[biomeId];
    if (!config) return false;

    if (biomeId === 1 && this.town.buildings.townhall < 3) {
      return { success: false, reason: 'Requer Prefeitura Nivel 3 para liberar!' };
    }
    if (biomeId === 2 && this.town.buildings.townhall < 4) {
      return { success: false, reason: 'Requer Prefeitura Nivel 4 para liberar!' };
    }

    this.spawner.setBiome(biomeId);
    this.heroes.forEach(hero => {
      if (hero.state === 'SEARCHING_MONSTER' || hero.state === 'FIGHTING') {
        hero.state = 'SEARCHING_MONSTER';
        hero.wanderForest();
      }
    });

    return { success: true };
  }

  saveGame() {
    const data = {
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
        bossKillsCount: this.spawner.bossKillsCount
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
        state: h.state
      })),
      lastSavedTime: Date.now()
    };

    localStorage.setItem('idle_hunter_tycoon_save', JSON.stringify(data));
  }

  loadGame() {
    try {
      const saved = localStorage.getItem('idle_hunter_tycoon_save');
      if (!saved) return false;

      const data = JSON.parse(saved);
      if (!data || data.version !== SAVE_VERSION) return false;

      this.town.gold = data.town.gold;
      this.town.resources = data.town.resources;
      this.town.buildings = data.town.buildings;
      this.town.buildingPlacements = data.town.buildingPlacements || {};

      this.spawner.currentBiomeId = data.spawner.currentBiomeId;
      this.spawner.killsCount = data.spawner.killsCount;
      this.spawner.bossKillsCount = data.spawner.bossKillsCount;

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
          weapon: null, armor: null, helmet: null, necklace: null, gloves: null,
          ring: null, belt: null, boots: null, pants: null, accessory1: null,
          pet: null, weapon_skin: null, armor_skin: null, wings: null, accessory2: null
        }, hData.equipment);
        hero.cosmetics = hData.cosmetics || hero.cosmetics;
        hero.currentMap = hData.currentMap || 'town';
        hero.x = hData.x ?? hero.x;
        hero.y = hData.y ?? hero.y;
        hero.targetX = hData.targetX ?? hero.targetX;
        hero.targetY = hData.targetY ?? hero.targetY;
        hero.state = hData.state || hero.state;
        hero.recalculateStats();
        return hero;
      });

      const timePassedMs = Date.now() - data.lastSavedTime;
      if (timePassedMs > 5000) {
        this.simulateOfflineProgress(timePassedMs / 1000);
      }

      return true;
    } catch (e) {
      console.error('Falha ao carregar save:', e);
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
