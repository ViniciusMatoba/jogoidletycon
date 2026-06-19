// Dados de Configuração e Constantes do Jogo (Versão Expandida - Folclore Brasileiro)

export const HERO_CLASSES = {
  WARRIOR: {
    name: 'Guerreiro',
    role: 'Tanque',
    baseHp: 180,
    baseAtk: 15,
    baseDef: 15,
    baseSpd: 1.0, // ataques por segundo
    magical: false,
    color: '#3a7dff', // Azul para tanque
    attackType: 'melee',
    attackRange: 38,
    keepAwayRange: 0,
    projectileColor: '#7ab8ff',
    impactColor: '#aad4ff',
    skills: [
      { name: 'Provocar', cd: 8, effect: 'taunt', duration: 4, desc: 'Atrai a atenção de todos os inimigos próximos.' },
      { name: 'Escudo Divino', cd: 15, effect: 'shield', amount: 50, desc: 'Cria uma barreira que absorve dano.' }
    ]
  },
  MERCENARY: {
    name: 'Mercenário',
    role: 'DPS Físico Corpo-a-Corpo',
    baseHp: 120,
    baseAtk: 32,
    baseDef: 6,
    baseSpd: 1.2,
    magical: false,
    color: '#ff3d3d', // Vermelho para dano bruto
    attackType: 'slash',
    attackRange: 30,
    keepAwayRange: 0,
    projectileColor: '#ff6060',
    impactColor: '#ff9090',
    skills: [
      { name: 'Golpe Brutal', cd: 6, effect: 'dmg_mult', mult: 2.0, desc: 'Causa 200% de dano físico instantâneo.' },
      { name: 'Fúria da Batalha', cd: 20, effect: 'atk_spd_buff', mult: 1.5, duration: 6, desc: 'Aumenta velocidade de ataque em 50%.' }
    ]
  },
  ARCHER: {
    name: 'Arqueiro',
    role: 'DPS Físico à Distância',
    baseHp: 100,
    baseAtk: 24,
    baseDef: 5,
    baseSpd: 1.4,
    magical: false,
    color: '#3aff7d', // Verde para agilidade
    attackType: 'arrow',
    attackRange: 220,
    keepAwayRange: 120,
    projectileColor: '#c8a040',
    impactColor: '#f0d060',
    skills: [
      { name: 'Tiro Duplo', cd: 5, effect: 'double_shot', desc: 'Atira duas flechas rapidamente.' },
      { name: 'Disparo de Precisão', cd: 12, effect: 'crit_buff', duration: 5, desc: 'Aumenta a chance de acerto crítico em 30%.' }
    ]
  },
  MAGE: {
    name: 'Mago',
    role: 'DPS Mágico à Distância',
    baseHp: 90,
    baseAtk: 28,
    baseDef: 3,
    baseSpd: 0.9,
    magical: true,
    color: '#c23aff', // Roxo para magia
    attackType: 'fireball',
    attackRange: 200,
    keepAwayRange: 110,
    projectileColor: '#ff6020',
    impactColor: '#ffaa40',
    skills: [
      { name: 'Bola de Fogo', cd: 7, effect: 'aoe_dmg', dmg: 40, desc: 'Causa dano mágico em área.' },
      { name: 'Congelamento', cd: 14, effect: 'stun', duration: 2.5, desc: 'Congela e paralisa o inimigo.' }
    ]
  },
  PRIEST: {
    name: 'Sacerdote',
    role: 'Suporte e Cura',
    baseHp: 110,
    baseAtk: 12,
    baseDef: 6,
    baseSpd: 0.9,
    magical: true,
    color: '#ffea3a', // Amarelo/Dourado para suporte/luz
    attackType: 'holy',
    attackRange: 180,
    keepAwayRange: 100,
    projectileColor: '#ffea3a',
    impactColor: '#fff8a0',
    skills: [
      { name: 'Luz Curativa', cd: 6, effect: 'heal', amount: 30, desc: 'Cura o herói aliado com menor vida.' },
      { name: 'Bênção da Força', cd: 18, effect: 'buff_atk', mult: 1.25, duration: 8, desc: 'Aumenta o ataque de todos os aliados em 25%.' }
    ]
  }
};

export const BIOMES = [
  {
    id: 0,
    name: 'Cavernas Rasas',
    minLevel: 1,
    requiredBossKillsToUnlock: 0,
    targetKillsForBoss: 30,
    color: '#4a4f54',
    bgClass: 'shallow-caves',
    // Monstros normais mistos (originais + folclore brasileiro)
    monsters: [
      { name: 'Rato', hp: 50, atk: 6, def: 1, xp: 12, drops: [{ item: 'meat_raw', chance: 0.6 }, { item: 'rat_tail', chance: 0.5 }, { item: 'wood_rough', chance: 0.2 }] },
      { name: 'Zoio', hp: 45, atk: 7, def: 0, xp: 10, drops: [{ item: 'bat_wing', chance: 0.6 }, { item: 'guano', chance: 0.4 }] },
      { name: 'Caveira', hp: 60, atk: 8, def: 3, xp: 15, drops: [{ item: 'os_seco', chance: 0.5 }, { item: 'iron_ore', chance: 0.25 }] },
      { name: 'Caveira 2', hp: 40, atk: 9, def: 0, xp: 14, drops: [{ item: 'unha_pisadeira', chance: 0.6 }] },
      { name: 'Porco', hp: 55, atk: 7, def: 2, xp: 13, drops: [{ item: 'meat_raw', chance: 0.6 }, { item: 'wood_rough', chance: 0.3 }] },
      { name: 'Et', hp: 65, atk: 8, def: 1, xp: 15, drops: [{ item: 'iron_ore', chance: 0.4 }, { item: 'bat_wing', chance: 0.3 }] },
      { name: 'Et Varginha', hp: 70, atk: 10, def: 2, xp: 18, drops: [{ item: 'iron_ore', chance: 0.45 }, { item: 'rat_fang', chance: 0.1 }] }
    ],
    // Arrays de chefes para o spawner sortear
    miniBosses: [
      { name: 'Et Verde', hp: 200, atk: 15, def: 4, xp: 60, drops: [{ item: 'rat_fang', chance: 1.0 }, { item: 'iron_ore', chance: 0.5 }] },
      { name: 'Ciclops Mulher', hp: 190, atk: 17, def: 3, xp: 60, drops: [{ item: 'bananier_leaf', chance: 1.0 }, { item: 'wood_rough', chance: 0.6 }] }
    ],
    bosses: [
      { name: 'Home do Saco', hp: 600, atk: 25, def: 8, xp: 200, drops: [{ item: 'king_crown_fragment', chance: 1.0 }, { item: 'iron_ore', chance: 1.0 }] },
      { name: 'Saci-Pererê', hp: 550, atk: 28, def: 6, xp: 200, drops: [{ item: 'gorro_vermelho', chance: 1.0 }, { item: 'wood_rough', chance: 1.0 }] }
    ]
  },
  {
    id: 1,
    name: 'Floresta Escura',
    minLevel: 15,
    requiredBossKillsToUnlock: 1,
    targetKillsForBoss: 45,
    color: '#1d3b1e',
    bgClass: 'dark-forest',
    monsters: [
      { name: 'Lobisomen', hp: 160, atk: 18, def: 5, xp: 35, drops: [{ item: 'wolf_fur', chance: 0.6 }, { item: 'goblin_ear', chance: 0.5 }, { item: 'wood_rough', chance: 0.25 }] },
      { name: 'Vampiro', hp: 180, atk: 22, def: 4, xp: 40, drops: [{ item: 'wolf_fur', chance: 0.5 }, { item: 'meat_raw', chance: 0.5 }, { item: 'iron_ore', chance: 0.25 }] },
      { name: 'Lagarto', hp: 150, atk: 20, def: 3, xp: 38, drops: [{ item: 'spider_silk', chance: 0.55 }, { item: 'poison_gland', chance: 0.35 }] },
      { name: 'Capelobo', hp: 200, atk: 24, def: 6, xp: 48, drops: [{ item: 'garra_capelobo', chance: 0.5 }, { item: 'wood_rough', chance: 0.3 }] },
      { name: 'Caipora', hp: 170, atk: 21, def: 5, xp: 45, drops: [{ item: 'dente_queixada', chance: 0.5 }, { item: 'meat_raw', chance: 0.5 }] },
      { name: 'Quibungo', hp: 220, atk: 26, def: 8, xp: 50, drops: [{ item: 'couro_rigido', chance: 0.55 }, { item: 'poison_gland', chance: 0.35 }] },
      { name: 'Lobisomen', hp: 190, atk: 25, def: 5, xp: 44, drops: [{ item: 'wolf_fur', chance: 0.6 }, { item: 'meat_raw', chance: 0.5 }] },
      { name: 'Vampiro', hp: 175, atk: 23, def: 4, xp: 42, drops: [{ item: 'poison_gland', chance: 0.4 }, { item: 'couro_rigido', chance: 0.3 }] }
    ],
    miniBosses: [
      { name: 'Coelho Pascoa', hp: 700, atk: 45, def: 12, xp: 180, drops: [{ item: 'goblin_dagger', chance: 1.0 }, { item: 'wood_rough', chance: 0.8 }] },
      { name: 'Mula sem Cabeça', hp: 750, atk: 48, def: 10, xp: 180, drops: [{ item: 'ferradura_fogo', chance: 1.0 }, { item: 'iron_ore', chance: 0.8 }] },
      { name: 'Coelho Pascoa', hp: 800, atk: 50, def: 14, xp: 200, drops: [{ item: 'ferradura_fogo', chance: 0.8 }, { item: 'wood_rough', chance: 1.0 }] }
    ],
    bosses: [
      { name: 'Boi Brabo', hp: 2000, atk: 75, def: 20, xp: 600, drops: [{ item: 'queen_venom', chance: 1.0 }, { item: 'spider_silk', chance: 1.0 }] },
      { name: 'Curupira', hp: 1800, atk: 82, def: 18, xp: 600, drops: [{ item: 'cabelo_fogo', chance: 1.0 }, { item: 'wood_rough', chance: 1.0 }] }
    ]
  },
  {
    id: 2,
    name: 'Pântano Sombrio',
    minLevel: 30,
    requiredBossKillsToUnlock: 2,
    targetKillsForBoss: 60,
    color: '#2e3a35',
    bgClass: 'shadow-swamp',
    monsters: [
      { name: 'Lagarto', hp: 450, atk: 40, def: 12, xp: 90, drops: [{ item: 'slime_bubble', chance: 0.6 }, { item: 'herbs_wild', chance: 0.4 }] },
      { name: 'Lobisomen', hp: 400, atk: 45, def: 10, xp: 85, drops: [{ item: 'serpent_skin', chance: 0.6 }, { item: 'poison_gland', chance: 0.4 }] },
      { name: 'Vampiro', hp: 550, atk: 52, def: 18, xp: 110, drops: [{ item: 'crocodile_scale', chance: 0.6 }, { item: 'meat_raw', chance: 0.5 }] },
      { name: 'Ipupiara', hp: 480, atk: 46, def: 14, xp: 95, drops: [{ item: 'escama_ipupiara', chance: 0.5 }, { item: 'herbs_wild', chance: 0.3 }] },
      { name: 'Teju Jagua', hp: 600, atk: 50, def: 20, xp: 115, drops: [{ item: 'presa_teju', chance: 0.5 }, { item: 'steel_ore', chance: 0.35 }] },
      { name: 'Boto Sedutor', hp: 420, atk: 48, def: 8, xp: 92, drops: [{ item: 'chapeu_boto', chance: 0.5 }, { item: 'meat_raw', chance: 0.4 }] },
      { name: 'Caveira', hp: 460, atk: 42, def: 13, xp: 95, drops: [{ item: 'slime_bubble', chance: 0.5 }, { item: 'couro_rigido', chance: 0.4 }] }
    ],
    miniBosses: [
      { name: 'Ciclops Mulher', hp: 2200, atk: 95, def: 25, xp: 450, drops: [{ item: 'leech_tooth', chance: 1.0 }, { item: 'steel_ore', chance: 0.6 }] },
      { name: 'Mapinguari', hp: 2400, atk: 98, def: 22, xp: 450, drops: [{ item: 'garra_mapinguari', chance: 1.0 }, { item: 'steel_ore', chance: 0.7 }] }
    ],
    bosses: [
      { name: 'Boi Tata', hp: 6000, atk: 140, def: 40, xp: 1500, drops: [{ item: 'hydra_scale', chance: 1.0 }, { item: 'steel_ore', chance: 1.0 }] },
      { name: 'Boi Tata', hp: 5800, atk: 150, def: 35, xp: 1500, drops: [{ item: 'olho_boitata', chance: 1.0 }, { item: 'steel_ore', chance: 1.0 }] }
    ]
  }
];

export const ITEMS_INFO = {
  // Loots Básicos Originais
  meat_raw: { name: 'Carne Crua', price: 2, icon: '🥩', type: 'loot', source: 'Todos os Biomas', rarity: 'common' },
  rat_tail: { name: 'Cauda de Rato', price: 1, icon: '🐀', type: 'loot', source: 'Cavernas Rasas', rarity: 'common' },
  bat_wing: { name: 'Asa de Morcego', price: 1, icon: '🦇', type: 'loot', source: 'Cavernas Rasas', rarity: 'common' },
  guano: { name: 'Guano', price: 2, icon: '💩', type: 'loot', source: 'Cavernas Rasas', rarity: 'common' },
  rat_fang: { name: 'Presa de Rato', price: 10, icon: '🦷', type: 'loot', source: 'Cavernas Rasas (MiniBoss)', rarity: 'rare' },
  king_crown_fragment: { name: 'Fragmento de Coroa', price: 50, icon: '👑', type: 'rare', source: 'Cavernas Rasas (Boss)', rarity: 'legendary' },

  goblin_ear: { name: 'Orelha de Goblin', price: 3, icon: '👂', type: 'loot', source: 'Floresta Escura', rarity: 'common' },
  wolf_fur: { name: 'Pele de Lobo', price: 4, icon: '🐺', type: 'loot', source: 'Floresta Escura', rarity: 'common' },
  spider_silk: { name: 'Teia de Aranha', price: 4, icon: '🕸️', type: 'loot', source: 'Floresta Escura', rarity: 'common' },
  poison_gland: { name: 'Glândula de Veneno', price: 6, icon: '🧪', type: 'loot', source: 'Floresta Escura / Pântano', rarity: 'common' },
  goblin_dagger: { name: 'Adaga Quebrada', price: 25, icon: '🗡️', type: 'loot', source: 'Floresta Escura (MiniBoss)', rarity: 'rare' },
  queen_venom: { name: 'Veneno da Rainha', price: 100, icon: '☣️', type: 'rare', source: 'Floresta Escura (Boss)', rarity: 'legendary' },

  slime_bubble: { name: 'Bolha de Slime', price: 8, icon: '🟢', type: 'loot', source: 'Pântano Sombrio', rarity: 'common' },
  serpent_skin: { name: 'Couro de Serpente', price: 9, icon: '🐍', type: 'loot', source: 'Pântano Sombrio', rarity: 'common' },
  crocodile_scale: { name: 'Escama de Crocodilo', price: 11, icon: '🐊', type: 'loot', source: 'Pântano Sombrio', rarity: 'common' },
  leech_tooth: { name: 'Dente de Sanguessuga', price: 50, icon: '🦷', type: 'loot', source: 'Pântano Sombrio (MiniBoss)', rarity: 'rare' },
  hydra_scale: { name: 'Escama de Hidra', price: 200, icon: '🐉', type: 'rare', source: 'Pântano Sombrio (Boss)', rarity: 'legendary' },

  // Loots do Folclore Brasileiro (Novos)
  os_seco: { name: 'Osso Ressecado', price: 2, icon: '💀', type: 'loot', source: 'Corpo-Seco', rarity: 'common' },
  unha_pisadeira: { name: 'Unha da Pisadeira', price: 2, icon: '💅', type: 'loot', source: 'Pisadeira', rarity: 'common' },
  bananier_leaf: { name: 'Folha de Bananeira', price: 10, icon: '🍃', type: 'loot', source: 'Chibamba', rarity: 'rare' },
  gorro_vermelho: { name: 'Gorro do Saci', price: 65, icon: '🧢', type: 'rare', source: 'Saci-Pererê', rarity: 'legendary' },

  garra_capelobo: { name: 'Garra de Capelobo', price: 5, icon: '🐾', type: 'loot', source: 'Capelobo', rarity: 'rare' },
  dente_queixada: { name: 'Dente de Queixada', price: 5, icon: '🦷', type: 'loot', source: 'Caipora', rarity: 'rare' },
  couro_rigido: { name: 'Couro Rígido', price: 6, icon: '🧥', type: 'loot', source: 'Quibungo', rarity: 'common' },
  ferradura_fogo: { name: 'Ferradura de Fogo', price: 30, icon: '🐴', type: 'loot', source: 'Mula sem Cabeça', rarity: 'rare' },
  cabelo_fogo: { name: 'Cabelo de Fogo', price: 120, icon: '🔥', type: 'rare', source: 'Curupira', rarity: 'legendary' },

  escama_ipupiara: { name: 'Escama de Ipupiara', price: 12, icon: '🧜‍♂️', type: 'loot', source: 'Ipupiara', rarity: 'rare' },
  presa_teju: { name: 'Presa de Teju', price: 12, icon: '🦷', type: 'loot', source: 'Teju Jagua', rarity: 'rare' },
  chapeu_boto: { name: 'Chapéu de Boto', price: 14, icon: '🎩', type: 'loot', source: 'Boto Sedutor', rarity: 'rare' },
  garra_mapinguari: { name: 'Garra de Mapinguari', price: 60, icon: '🐾', type: 'loot', source: 'Mapinguari', rarity: 'rare' },
  olho_boitata: { name: 'Olho do Boitatá', price: 250, icon: '👁️', type: 'rare', source: 'Boitatá', rarity: 'legendary' },

  // Matérias-Primas
  wood_rough: { name: 'Madeira Bruta', price: 3, icon: '🪵', type: 'material', source: 'Coleta', rarity: 'uncommon' },
  iron_ore: { name: 'Minério de Ferro', price: 5, icon: '🪨', type: 'material', source: 'Coleta', rarity: 'uncommon' },
  steel_ore: { name: 'Minério de Aço', price: 12, icon: '⛓️', type: 'material', source: 'Coleta', rarity: 'uncommon' },
  herbs_wild: { name: 'Ervas Selvagens', price: 4, icon: '🌿', type: 'material', source: 'Coleta', rarity: 'uncommon' },
  linho: { name: 'Tecido de Linho', price: 4, icon: '🧵', type: 'material', source: 'Coleta', rarity: 'uncommon' },

  // Consumíveis
  meal_cooked: { name: 'Ensopado Simples (T1)', price: 8, icon: '🍲', type: 'consumable', rarity: 'common' },
  bandage_basic: { name: 'Curativo Simples (T1)', price: 8, icon: '🩹', type: 'consumable', rarity: 'common' },
  beer_refreshing: { name: 'Cerveja Rústica (T1)', price: 8, icon: '🍺', type: 'consumable', rarity: 'common' },
  bed_disposable: { name: 'Cama de Palha (T1)', price: 8, icon: '🛏️', type: 'consumable', rarity: 'common' },

  meal_cooked_t2: { name: 'Churrasco de Lobo (T2)', price: 20, icon: '🍖', type: 'consumable', rarity: 'uncommon' },
  bandage_basic_t2: { name: 'Atadura Reforçada (T2)', price: 20, icon: '🧻', type: 'consumable', rarity: 'uncommon' },
  beer_refreshing_t2: { name: 'Suco de Caipora (T2)', price: 20, icon: '🍹', type: 'consumable', rarity: 'uncommon' },
  bed_disposable_t2: { name: 'Cama de Madeira (T2)', price: 20, icon: '🛌', type: 'consumable', rarity: 'uncommon' },

  meal_cooked_t3: { name: 'Banquete Real (T3)', price: 50, icon: '🍛', type: 'consumable', rarity: 'rare' },
  bandage_basic_t3: { name: 'Gaze Esterilizada (T3)', price: 50, icon: '📦', type: 'consumable', rarity: 'rare' },
  beer_refreshing_t3: { name: 'Hidromel Lendário (T3)', price: 50, icon: '🥂', type: 'consumable', rarity: 'rare' },
  bed_disposable_t3: { name: 'Cama de Pena (T3)', price: 50, icon: '👑', type: 'consumable', rarity: 'rare' }
};

export const BUILDINGS_CONFIG = {
  townhall: {
    name: 'Prefeitura (Câmara)',
    icon: '🏛️',
    description: 'O centro nervoso da cidade. Controla os upgrades gerais da cidade.',
    upgrades: [
      { level: 1, cost: { gold: 100 }, maxHeroes: 3, desc: 'Permite abrigar até 3 heróis.' },
      { level: 2, cost: { gold: 500, wood_rough: 20, iron_ore: 10 }, maxHeroes: 5, desc: 'Permite abrigar até 5 heróis.' },
      { level: 3, cost: { gold: 1500, wood_rough: 50, iron_ore: 30, gorro_vermelho: 1 }, maxHeroes: 7, desc: 'Permite abrigar 7 heróis. Libera bioma 2.' }, // Requer item folclórico ou original
      { level: 4, cost: { gold: 4000, wood_rough: 100, steel_ore: 40, cabelo_fogo: 1 }, maxHeroes: 10, desc: 'Permite abrigar 10 heróis. Libera bioma 3.' }
    ]
  },
  hotel: {
    name: 'Hotel (Estalagem)',
    icon: '🏨',
    description: 'Onde os heróis dormem para recuperar energia. Gera ouro por hospedagem.',
    upgrades: [
      { level: 1, cost: { gold: 80, wood_rough: 5 }, energyRecovery: 5, goldEarned: 5, desc: 'Recupera +5 energia/s. Diária: 5 Ouro.' },
      { level: 2, cost: { gold: 300, wood_rough: 15, iron_ore: 5 }, energyRecovery: 10, goldEarned: 12, desc: 'Recupera +10 energia/s. Diária: 12 Ouro.' },
      { level: 3, cost: { gold: 1000, wood_rough: 40, iron_ore: 20 }, energyRecovery: 18, goldEarned: 25, desc: 'Recupera +18 energia/s. Diária: 25 Ouro.' }
    ]
  },
  restaurant: {
    name: 'Restaurante',
    icon: '🍴',
    description: 'Prepara refeições a partir de Carne Crua vendida pelos heróis.',
    upgrades: [
      { level: 1, cost: { gold: 120, wood_rough: 10 }, foodRecovery: 5, craftSpeed: 1.0, desc: 'Refeições restauram +5 fome/s.' },
      { level: 2, cost: { gold: 400, wood_rough: 25, iron_ore: 10 }, foodRecovery: 10, craftSpeed: 1.3, desc: 'Refeições restauram +10 fome/s e cozinha 30% mais rápido.' },
      { level: 3, cost: { gold: 1200, wood_rough: 60, steel_ore: 15 }, foodRecovery: 20, craftSpeed: 1.6, desc: 'Refeições restauram +20 fome/s e cozinha 60% mais rápido.' }
    ]
  },
  hospital: {
    name: 'Hospital',
    icon: '🏥',
    description: 'Cria curativos e cura ferimentos dos heróis em troca de Ouro.',
    upgrades: [
      { level: 1, cost: { gold: 150, wood_rough: 10, iron_ore: 5 }, hpRecovery: 8, desc: 'Tratamento cura +8 HP/s.' },
      { level: 2, cost: { gold: 500, wood_rough: 30, iron_ore: 15 }, hpRecovery: 18, desc: 'Tratamento cura +18 HP/s.' },
      { level: 3, cost: { gold: 1500, wood_rough: 80, steel_ore: 20 }, hpRecovery: 35, desc: 'Tratamento cura +35 HP/s.' }
    ]
  },
  tavern: {
    name: 'Taverna',
    icon: '🍺',
    description: 'Serve bebidas refrescantes para os heróis manterem o humor alto.',
    upgrades: [
      { level: 1, cost: { gold: 180, wood_rough: 12 }, moodRecovery: 6, goldEarned: 8, desc: 'Bebidas recuperam +6 humor/s. Diária: 8 Ouro.' },
      { level: 2, cost: { gold: 600, wood_rough: 35, iron_ore: 12 }, moodRecovery: 12, goldEarned: 18, desc: 'Bebidas recuperam +12 humor/s. Diária: 18 Ouro.' },
      { level: 3, cost: { gold: 1800, wood_rough: 90, steel_ore: 25 }, moodRecovery: 22, goldEarned: 35, desc: 'Bebidas recuperam +22 humor/s. Diária: 35 Ouro.' }
    ]
  },
  forge: {
    name: 'Forja e Oficina',
    icon: '⚒️',
    description: 'Onde o jogador fabrica armas e armaduras para vender para os heróis.',
    upgrades: [
      { level: 1, cost: { gold: 200, wood_rough: 15, iron_ore: 10 }, tierUnlocked: 1, desc: 'Permite craftar Equipamentos de Grau 1.' },
      { level: 2, cost: { gold: 800, wood_rough: 40, iron_ore: 25, gorro_vermelho: 1 }, tierUnlocked: 2, desc: 'Permite craftar Equipamentos de Grau 2.' },
      { level: 3, cost: { gold: 2500, wood_rough: 100, steel_ore: 50, cabelo_fogo: 1 }, tierUnlocked: 3, desc: 'Permite craftar Equipamentos de Grau 3.' }
    ]
  },
  market: {
    name: 'Mercado da Vila',
    icon: '⚖️',
    description: 'O centro do comércio local. Onde os heróis vendem o loot obtido na caça por ouro.',
    upgrades: [
      { level: 1, cost: { gold: 200, wood_rough: 15, iron_ore: 5 }, sellTax: 0.1, desc: 'Permite que heróis vendam loot. Taxa alfandegária municipal: 10%.' },
      { level: 2, cost: { gold: 600, wood_rough: 45, iron_ore: 20 }, sellTax: 0.05, desc: 'Melhora a eficiência comercial. Taxa reduzida para 5%.' },
      { level: 3, cost: { gold: 1800, wood_rough: 90, steel_ore: 30, gorro_vermelho: 1 }, sellTax: 0, desc: 'Isenção fiscal municipal total (0% de taxa).' }
    ]
  }
};

export const CRAFT_RECIPES = {
  // Consumíveis
  // --- TIER 1 ---
  meal_cooked: { result: 'meal_cooked', cost: { meat_raw: 2 }, qty: 1, building: 'restaurant' },
  bandage_basic: { result: 'bandage_basic', cost: { herbs_wild: 1, linho: 1 }, qty: 1, building: 'hospital' },
  beer_refreshing: { result: 'beer_refreshing', cost: { wood_rough: 1, meat_raw: 1 }, qty: 1, building: 'tavern' },
  bed_disposable: { result: 'bed_disposable', cost: { wood_rough: 3 }, qty: 1, building: 'hotel' },

  // --- TIER 2 ---
  meal_cooked_t2: { result: 'meal_cooked_t2', cost: { meat_raw: 3, wood_rough: 1 }, qty: 1, building: 'restaurant' },
  bandage_basic_t2: { result: 'bandage_basic_t2', cost: { herbs_wild: 2, linho: 2, wolf_fur: 1 }, qty: 1, building: 'hospital' },
  beer_refreshing_t2: { result: 'beer_refreshing_t2', cost: { wood_rough: 2, bananier_leaf: 1 }, qty: 1, building: 'tavern' },
  bed_disposable_t2: { result: 'bed_disposable_t2', cost: { wood_rough: 6, linho: 1 }, qty: 1, building: 'hotel' },

  // --- TIER 3 ---
  meal_cooked_t3: { result: 'meal_cooked_t3', cost: { meat_raw: 4, herbs_wild: 1, dente_queixada: 1 }, qty: 1, building: 'restaurant' },
  bandage_basic_t3: { result: 'bandage_basic_t3', cost: { herbs_wild: 3, linho: 3, spider_silk: 2 }, qty: 1, building: 'hospital' },
  beer_refreshing_t3: { result: 'beer_refreshing_t3', cost: { wood_rough: 3, chapeu_boto: 1 }, qty: 1, building: 'tavern' },
  bed_disposable_t3: { result: 'bed_disposable_t3', cost: { wood_rough: 10, linho: 2, couro_rigido: 1 }, qty: 1, building: 'hotel' },

  // EQUIPAMENTOS ORIGINAIS E LENDÁRIOS DO FOLCLORE
  // --- GRAU 1 ---
  sword_t1: { name: 'Espada de Ferro Curta', slot: 'weapon', icon: '⚔️', class: ['WARRIOR', 'MERCENARY'], tier: 1, cost: { iron_ore: 5, wood_rough: 2, gold: 50 }, stats: { atk: 12 } },
  bow_t1: { name: 'Arco de Bordo Simples', slot: 'weapon', icon: '🏹', class: ['ARCHER'], tier: 1, cost: { wood_rough: 6, gold: 50 }, stats: { atk: 10 } },
  staff_t1: { name: 'Cajado Rúnico Rústico', slot: 'weapon', icon: '🔮', class: ['MAGE', 'PRIEST'], tier: 1, cost: { wood_rough: 5, iron_ore: 1, gold: 50 }, stats: { atk: 9 } },
  
  // Equipamento Lendário Tier 1 do Folclore (Gorro do Saci)
  cajado_saci_t1: { name: 'Cajado de Saci', slot: 'weapon', icon: '🔮', class: ['MAGE', 'PRIEST'], tier: 1, cost: { wood_rough: 3, gorro_vermelho: 1, gold: 80 }, stats: { atk: 18 } },
  
  armor_t1_heavy: { name: 'Armadura de Placas Rústica', slot: 'armor', icon: '🛡️', class: ['WARRIOR'], tier: 1, cost: { iron_ore: 8, gold: 60 }, stats: { hp: 40, def: 8 } },
  armor_t1_medium: { name: 'Gibão de Couro Cru', slot: 'armor', icon: '🧥', class: ['ARCHER', 'MERCENARY'], tier: 1, cost: { rat_tail: 6, gold: 60 }, stats: { hp: 25, def: 4 } },
  armor_t1_light: { name: 'Toga de Tecido Rústica', slot: 'armor', icon: '👗', class: ['MAGE', 'PRIEST'], tier: 1, cost: { linho: 6, gold: 60 }, stats: { hp: 15, def: 2 } },

  // Novos itens Grau 1
  helmet_t1_heavy: { name: 'Elmo de Ferro Rústico', slot: 'helmet', icon: '🪖', class: ['WARRIOR'], tier: 1, cost: { iron_ore: 4, gold: 40 }, stats: { def: 3 } },
  helmet_t1_medium: { name: 'Capuz de Caçador Rústico', slot: 'helmet', icon: '👒', class: ['ARCHER', 'MERCENARY'], tier: 1, cost: { rat_tail: 4, gold: 40 }, stats: { def: 2 } },
  helmet_t1_light: { name: 'Tiara de Linho Rúnica', slot: 'helmet', icon: '👑', class: ['MAGE', 'PRIEST'], tier: 1, cost: { linho: 4, gold: 40 }, stats: { def: 1 } },
  gloves_t1: { name: 'Luvas de Couro', slot: 'gloves', icon: '🧤', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 1, cost: { rat_tail: 3, gold: 30 }, stats: { def: 1, atk: 1 } },
  ring_t1: { name: 'Anel de Cobre', slot: 'ring', icon: '💍', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 1, cost: { iron_ore: 2, gold: 30 }, stats: { hp: 10 } },
  necklace_t1: { name: 'Colar de Dente de Rato', slot: 'necklace', icon: '📿', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 1, cost: { rat_tail: 3, gold: 30 }, stats: { hp: 15 } },
  belt_t1: { name: 'Cinto de Couro Simples', slot: 'belt', icon: '🥋', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 1, cost: { rat_tail: 3, gold: 30 }, stats: { def: 1 } },
  boots_t1: { name: 'Botas de Couro Rústicas', slot: 'boots', icon: '🥾', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 1, cost: { bat_wing: 4, gold: 35 }, stats: { def: 1, hp: 10 } },

  // --- GRAU 2 ---
  sword_t2: { name: 'Espada de Aço Afiada', slot: 'weapon', icon: '⚔️', class: ['WARRIOR', 'MERCENARY'], tier: 2, cost: { iron_ore: 15, goblin_dagger: 1, gold: 200 }, stats: { atk: 35 } },
  bow_t2: { name: 'Arco Composto Reforçado', slot: 'weapon', icon: '🏹', class: ['ARCHER'], tier: 2, cost: { wood_rough: 20, spider_silk: 3, gold: 200 }, stats: { atk: 30 } },
  staff_t2: { name: 'Cajado de Salgueiro da Selva', slot: 'weapon', icon: '🔮', class: ['MAGE', 'PRIEST'], tier: 2, cost: { wood_rough: 15, poison_gland: 2, gold: 200 }, stats: { atk: 28 } },
  
  // Equipamentos Lendários Tier 2 do Folclore (Mula e Curupira)
  bow_mula_t2: { name: 'Arco de Fogo da Mula', slot: 'weapon', icon: '🏹', class: ['ARCHER'], tier: 2, cost: { wood_rough: 12, ferradura_fogo: 1, gold: 300 }, stats: { atk: 52 } },
  sword_curupira_t2: { name: 'Lâmina Curupira', slot: 'weapon', icon: '⚔️', class: ['WARRIOR', 'MERCENARY'], tier: 2, cost: { iron_ore: 10, cabelo_fogo: 1, gold: 320 }, stats: { atk: 60 } },

  armor_t2_heavy: { name: 'Armadura de Malha de Aço', slot: 'armor', icon: '🛡️', class: ['WARRIOR'], tier: 2, cost: { iron_ore: 20, wood_rough: 5, gold: 250 }, stats: { hp: 120, def: 22 } },
  armor_t2_medium: { name: 'Cota de Couro Reforçado', slot: 'armor', icon: '🧥', class: ['ARCHER', 'MERCENARY'], tier: 2, cost: { wolf_fur: 12, spider_silk: 2, gold: 250 }, stats: { hp: 80, def: 12 } },
  armor_t2_light: { name: 'Túnica de Linho Encantada', slot: 'armor', icon: '👗', class: ['MAGE', 'PRIEST'], tier: 2, cost: { linho: 15, spider_silk: 2, gold: 250 }, stats: { hp: 50, def: 7 } },

  // Novos itens Grau 2
  helmet_t2_heavy: { name: 'Elmo de Aço Soldado', slot: 'helmet', icon: '🪖', class: ['WARRIOR'], tier: 2, cost: { iron_ore: 10, gold: 120 }, stats: { def: 8 } },
  helmet_t2_medium: { name: 'Capuz do Caçador Invisível', slot: 'helmet', icon: '👒', class: ['ARCHER', 'MERCENARY'], tier: 2, cost: { wolf_fur: 8, gold: 120 }, stats: { def: 5 } },
  helmet_t2_light: { name: 'Coroa de Linho Iluminada', slot: 'helmet', icon: '👑', class: ['MAGE', 'PRIEST'], tier: 2, cost: { linho: 10, gold: 120 }, stats: { def: 3 } },
  gloves_t2: { name: 'Luvas de Aço Escovado', slot: 'gloves', icon: '🧤', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 2, cost: { iron_ore: 6, gold: 100 }, stats: { def: 3, atk: 4 } },
  ring_t2: { name: 'Anel de Prata Encantado', slot: 'ring', icon: '💍', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 2, cost: { spider_silk: 2, gold: 100 }, stats: { hp: 30 } },
  necklace_t2: { name: 'Amuleto Goblin de Proteção', slot: 'necklace', icon: '📿', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 2, cost: { goblin_ear: 4, gold: 100 }, stats: { hp: 40 } },
  belt_t2: { name: 'Cinto com Fivela de Ferro', slot: 'belt', icon: '🥋', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 2, cost: { iron_ore: 4, gold: 80 }, stats: { def: 4 } },
  boots_t2: { name: 'Grevas de Aço Flexíveis', slot: 'boots', icon: '🥾', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 2, cost: { iron_ore: 6, gold: 110 }, stats: { def: 4, hp: 30 } },

  // --- GRAU 3 ---
  sword_t3: { name: 'Lâmina do Flagelo Dracônico', slot: 'weapon', icon: '⚔️', class: ['WARRIOR', 'MERCENARY'], tier: 3, cost: { steel_ore: 20, leech_tooth: 2, hydra_scale: 1, gold: 800 }, stats: { atk: 95 } },
  bow_t3: { name: 'Arco do Vento Sombrio', slot: 'weapon', icon: '🏹', class: ['ARCHER'], tier: 3, cost: { steel_ore: 10, serpent_skin: 8, hydra_scale: 1, gold: 800 }, stats: { atk: 82 } },
  staff_t3: { name: 'Cetro do Pântano Eterno', slot: 'weapon', icon: '🔮', class: ['MAGE', 'PRIEST'], tier: 3, cost: { steel_ore: 10, queen_venom: 1, gold: 800 }, stats: { atk: 78 } },
  
  // Equipamento Lendário Tier 3 do Folclore (Boitatá e Mapinguari)
  sword_boitata_t3: { name: 'Lâmina Flamejante de Boitatá', slot: 'weapon', icon: '⚔️', class: ['WARRIOR', 'MERCENARY'], tier: 3, cost: { steel_ore: 15, olho_boitata: 1, gold: 1200 }, stats: { atk: 140 } },
  armor_mapinguari_t3: { name: 'Gibão de Couro de Mapinguari', slot: 'armor', icon: '🧥', class: ['ARCHER', 'MERCENARY'], tier: 3, cost: { serpent_skin: 10, garra_mapinguari: 1, gold: 900 }, stats: { hp: 280, def: 38 } },

  armor_t3_heavy: { name: 'Muralha de Aço Escamada', slot: 'armor', icon: '🛡️', class: ['WARRIOR'], tier: 3, cost: { steel_ore: 25, crocodile_scale: 8, gold: 1000 }, stats: { hp: 350, def: 55 } },
  armor_t3_medium: { name: 'Armadura de Escamas de Hidra', slot: 'armor', icon: '🧥', class: ['ARCHER', 'MERCENARY'], tier: 3, cost: { serpent_skin: 15, crocodile_scale: 5, gold: 1000 }, stats: { hp: 220, def: 32 } },
  armor_t3_light: { name: 'Manto do Mago Arquimago', slot: 'armor', icon: '👗', class: ['MAGE', 'PRIEST'], tier: 3, cost: { linho: 30, slime_bubble: 12, gold: 1000 }, stats: { hp: 150, def: 18 } },

  // Novos itens Grau 3
  helmet_t3_heavy: { name: 'Elmo de Hidra Gigante', slot: 'helmet', icon: '🪖', class: ['WARRIOR'], tier: 3, cost: { steel_ore: 15, crocodile_scale: 4, gold: 400 }, stats: { def: 20 } },
  helmet_t3_medium: { name: 'Capuz das Sombras do Pântano', slot: 'helmet', icon: '👒', class: ['ARCHER', 'MERCENARY'], tier: 3, cost: { serpent_skin: 8, gold: 400 }, stats: { def: 12 } },
  helmet_t3_light: { name: 'Diadema de Boitatá Celestial', slot: 'helmet', icon: '👑', class: ['MAGE', 'PRIEST'], tier: 3, cost: { linho: 20, slime_bubble: 6, gold: 400 }, stats: { def: 8 } },
  gloves_t3: { name: 'Manoplas Dracônicas', slot: 'gloves', icon: '🧤', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 3, cost: { steel_ore: 10, gold: 350 }, stats: { def: 8, atk: 12 } },
  ring_t3: { name: 'Anel de Aço Rúnico', slot: 'ring', icon: '💍', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 3, cost: { steel_ore: 5, gold: 450 }, stats: { hp: 100 } },
  necklace_t3: { name: 'Colar de Escamas de Crocodilo', slot: 'necklace', icon: '📿', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 3, cost: { crocodile_scale: 4, gold: 450 }, stats: { hp: 120 } },
  belt_t3: { name: 'Cinto de Couro de Serpente', slot: 'belt', icon: '🥋', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 3, cost: { serpent_skin: 4, gold: 300 }, stats: { def: 10 } },
  boots_t3: { name: 'Botas do Caminhante do Pântano', slot: 'boots', icon: '🥾', class: ['WARRIOR', 'MERCENARY', 'ARCHER', 'MAGE', 'PRIEST'], tier: 3, cost: { serpent_skin: 5, gold: 380 }, stats: { def: 10, hp: 80 } }
};
