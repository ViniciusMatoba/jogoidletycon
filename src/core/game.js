import { Town } from './town.js';
import { Hero } from './hero.js';
import { MonsterSpawner } from './monster.js';
import { BIOMES, HERO_CLASSES } from '../data/constants.js';

export class Game {
  constructor() {
    this.town = new Town();
    this.spawner = new MonsterSpawner();
    this.heroes = [];
    this.floaters = []; // Números flutuantes de dano e itens coletados
    
    // Configurações do Loop
    this.isPaused = false;
    this.speed = 1.0; // Velocidade do jogo (1x, 2x, 4x)

    // Inicialização do Jogo
    this.init();
  }

  init() {
    // Tenta carregar do LocalStorage
    if (this.loadGame()) {
      return;
    }

    // Se for um jogo novo, contrata 3 heróis iniciais grátis
    this.hireHero('WARRIOR', true);  // Guerreiro (Tanque)
    this.hireHero('ARCHER', true);   // Arqueiro (DPS Físico)
    this.hireHero('MAGE', true);     // Mago (DPS Mágico)
  }

  // Contrata um novo herói
  hireHero(className, free = false) {
    const maxHeroes = this.town.getBuildingConfig('townhall').current.maxHeroes;
    if (this.heroes.length >= maxHeroes) {
      return { success: false, reason: `Prefeitura cheia! Limite: ${maxHeroes} heróis.` };
    }

    const cost = this.getHiringCost();
    if (!free && this.town.gold < cost) {
      return { success: false, reason: `Ouro insuficiente na prefeitura (Custo: ${cost} Ouro).` };
    }

    if (!free) {
      this.town.gold -= cost;
    }

    const newId = this.heroes.length + 1;
    const hero = new Hero(newId, className);
    this.heroes.push(hero);
    
    this.town.addResource('gold', 0); // Trigger UI update se necessário
    this.saveGame();

    return { success: true, hero };
  }

  getHiringCost() {
    // O custo escala de acordo com a quantidade atual de heróis
    const count = this.heroes.length;
    if (count <= 3) return 80;
    if (count <= 5) return 250;
    return 600;
  }

  // Adiciona um número flutuante no canvas
  addFloater(config) {
    this.floaters.push({
      x: config.x,
      y: config.y,
      text: config.text,
      color: config.color || '#ffffff',
      timeLeft: config.time || 1.0,
      maxTime: config.time || 1.0
    });
  }

  // Atualiza todo o estado do jogo (ticks)
  update(dt) {
    if (this.isPaused) return;

    // Multiplicador de velocidade do jogo
    const actualDt = dt * this.speed;

    // 1. Atualizar Spawner de monstros
    this.spawner.update(actualDt, this.town);

    // 2. Atualizar todos os Heróis
    this.heroes.forEach(hero => {
      hero.update(actualDt, this.town, this.spawner.activeMonsters, this.addFloater.bind(this));
    });

    // 3. Atualizar fila de craft da cidade
    this.town.updateCrafting(actualDt);

    // 4. Atualizar textos flutuantes
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const floater = this.floaters[i];
      floater.timeLeft -= actualDt;
      floater.y -= 15 * actualDt; // Sobe devagar
      if (floater.timeLeft <= 0) {
        this.floaters.splice(i, 1);
      }
    }
  }

  // Altera o bioma ativo (se desbloqueado)
  changeBiome(biomeId) {
    const config = BIOMES[biomeId];
    if (!config) return false;

    // Verificar requisitos: exige Prefeitura nível correspondente
    // Bioma 0 (Cavernas) -> Livre
    // Bioma 1 (Floresta) -> Prefeitura Lvl 3+
    // Bioma 2 (Pântano) -> Prefeitura Lvl 4+
    if (biomeId === 1 && this.town.buildings.townhall < 3) {
      return { success: false, reason: 'Requer Prefeitura Nível 3 para liberar!' };
    }
    if (biomeId === 2 && this.town.buildings.townhall < 4) {
      return { success: false, reason: 'Requer Prefeitura Nível 4 para liberar!' };
    }

    this.spawner.setBiome(biomeId);
    // Mandar todos os heróis caçadores voltarem a procurar monstros no novo bioma
    this.heroes.forEach(hero => {
      if (hero.state === 'SEARCHING_MONSTER' || hero.state === 'FIGHTING') {
        hero.state = 'SEARCHING_MONSTER';
        hero.wanderForest();
      }
    });

    return { success: true };
  }

  // --- Sistema de Salvamento / LocalStorage ---
  saveGame() {
    const data = {
      town: {
        gold: this.town.gold,
        resources: this.town.resources,
        buildings: this.town.buildings
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
        cosmetics: h.cosmetics
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
      if (!data) return false;

      // Restaura Cidade
      this.town.gold = data.town.gold;
      this.town.resources = data.town.resources;
      this.town.buildings = data.town.buildings;

      // Restaura Spawner
      this.spawner.currentBiomeId = data.spawner.currentBiomeId;
      this.spawner.killsCount = data.spawner.killsCount;
      this.spawner.bossKillsCount = data.spawner.bossKillsCount;

      // Restaura Heróis
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
        if (hData.cosmetics) {
          hero.cosmetics = hData.cosmetics;
        }
        hero.recalculateStats();
        return hero;
      });

      // Simular Progresso Offline
      const now = Date.now();
      const timePassedMs = now - data.lastSavedTime;
      if (timePassedMs > 5000) {
        this.simulateOfflineProgress(timePassedMs / 1000);
      }

      return true;
    } catch (e) {
      console.error('Falha ao carregar save:', e);
      return false;
    }
  }

  // Simulação rápida do progresso offline
  simulateOfflineProgress(secondsPassed) {
    // Limita o progresso offline a 4 horas (14400 segundos) para evitar travamentos
    const maxOffline = 14400;
    const simTime = Math.min(secondsPassed, maxOffline);
    
    // Roda a simulação em ticks largos (ex: fatias de 10 segundos)
    const tickSlice = 10;
    const slices = Math.floor(simTime / tickSlice);

    console.log(`Simulando progresso offline de ${simTime.toFixed(1)}s em ${slices} ticks...`);

    for (let i = 0; i < slices; i++) {
      // Simulação rápida:
      // 1. Spawner atualiza
      this.spawner.update(tickSlice, this.town);

      // 2. Heróis agem (reduzindo movimentação física para acelerar IA)
      this.heroes.forEach(hero => {
        // Ignora andar físico durante a simulação offline
        // Teleporta herói para perto do alvo para a IA rodar rápido
        hero.x = hero.targetX;
        hero.y = hero.targetY;
        hero.update(tickSlice, this.town, this.spawner.activeMonsters, () => {});
      });

      // 3. Crafting atualiza
      this.town.updateCrafting(tickSlice);
    }
  }

  // Apaga o save
  resetGame() {
    localStorage.removeItem('idle_hunter_tycoon_save');
    window.location.reload();
  }
}
