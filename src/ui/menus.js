import { BUILDINGS_CONFIG, CRAFT_RECIPES, ITEMS_INFO, BIOMES, HERO_CLASSES } from '../data/constants.js';

export function setupUI(game) {
  // 1. Controle de Janelas Modais Retro (Menu de Rodapé)
  const menuButtons = document.querySelectorAll('.menu-btn-retro');
  const modalOverlays = document.querySelectorAll('.modal-overlay');

  menuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const modal = document.getElementById(targetId);

      if (modal) {
        // Se o modal clicado já está aberto, fecha ele
        if (modal.classList.contains('active')) {
          modal.classList.remove('active');
          btn.classList.remove('active');
          return;
        }

        // Se não, fecha os outros e abre este
        menuButtons.forEach(b => b.classList.remove('active'));
        modalOverlays.forEach(m => m.classList.remove('active'));

        btn.classList.add('active');
        modal.classList.add('active');
      }
    });
  });

  // Configura fechamento de todos os modais (botão [X] ou cliques no overlay de fundo)
  modalOverlays.forEach(modal => {
    const closeBtn = modal.querySelector('.close-modal-btn');
    const closeAction = () => {
      modal.classList.remove('active');
      menuButtons.forEach(btn => {
        if (btn.getAttribute('data-target') === modal.id) {
          btn.classList.remove('active');
        }
      });
    };

    if (closeBtn) {
      closeBtn.addEventListener('click', closeAction);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAction();
      }
    });
  });

  // 2. Vinculação do Bioma
  const biomeSelect = document.getElementById('biome-select');
  if (biomeSelect) {
    biomeSelect.addEventListener('change', (e) => {
      const res = game.changeBiome(parseInt(e.target.value));
      if (!res.success && res.reason) {
        alert(res.reason);
        // Voltar seleção para o anterior
        biomeSelect.value = game.spawner.currentBiomeId;
      }
    });
  }

  // 3. Contratação de Heróis
  const hireButtons = document.querySelectorAll('.hire-btn');
  hireButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const cls = btn.getAttribute('data-class');
      const res = game.hireHero(cls);
      if (!res.success) {
        alert(res.reason);
      } else {
        alert(`Herói ${res.hero.name} contratado com sucesso!`);
      }
    });
  });

  // 4. Vinculação dos Edifícios e Craftings (Upgrades e Produções)
  setupBuildingUpgrades(game);
  setupCraftingButtons(game);

  // 5. Botão Reset de Jogo
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Tem certeza de que deseja resetar TODAS as suas construções e heróis? O progresso será perdido.')) {
        game.resetGame();
      }
    });
  }

  // 6. Configurar as Importações Rápidas (Cheat ou Compra Básica da Prefeitura)
  const importButtons = document.querySelectorAll('.import-btn');
  importButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.getAttribute('data-item');
      const qty = parseInt(btn.getAttribute('data-qty'));
      const cost = parseInt(btn.getAttribute('data-cost'));
      if (game.town.importMaterials(item, qty, cost)) {
        game.addFloater({ x: 200, y: 150, text: `+${qty} ${ITEMS_INFO[item].icon}`, color: '#3aff7d' });
      } else {
        alert('Ouro insuficiente na Prefeitura!');
      }
    });
  });
}

// Configura botões de upgrade de edifícios
function setupBuildingUpgrades(game) {
  const upgradeContainer = document.getElementById('buildings-list');
  if (!upgradeContainer) return;

  // Render inicial dos edifícios
  renderBuildings(game);
}

export function renderBuildings(game) {
  const upgradeContainer = document.getElementById('buildings-list');
  if (!upgradeContainer) return;

  upgradeContainer.innerHTML = '';

  for (const bKey in BUILDINGS_CONFIG) {
    const config = game.town.getBuildingConfig(bKey);
    const itemEl = document.createElement('div');
    itemEl.className = 'building-card';

    // Status da construção
    const isBuilt = config.level > 0;
    const isMax = config.next === null;

    let costHtml = '';
    if (!isMax) {
      const costs = [];
      for (const res in config.next.cost) {
        const icon = res === 'gold' ? '🪙' : ITEMS_INFO[res]?.icon || '📦';
        const name = res === 'gold' ? 'Ouro' : ITEMS_INFO[res]?.name || res;
        const required = config.next.cost[res];
        const owned = res === 'gold' ? game.town.gold : game.town.resources[res] || 0;
        const isEnough = owned >= required;
        costs.push(`<span class="cost-item ${isEnough ? 'enough' : 'not-enough'}">${icon} ${required} (${owned})</span>`);
      }
      costHtml = `<div class="building-cost">Custo: ${costs.join(', ')}</div>`;
    }

    itemEl.innerHTML = `
      <div class="building-info-header">
        <span class="building-icon">${config.icon}</span>
        <div class="building-title-desc">
          <h4>${config.name} ${isBuilt ? `(Nív. ${config.level})` : '<span class="locked-text">(Bloqueado)</span>'}</h4>
          <p class="building-desc-text">${config.description}</p>
        </div>
      </div>
      <div class="building-perks">
        <p class="current-perk">Efeito Atual: ${isBuilt ? (config.current?.desc || 'Edifício Funcional') : 'Inativo'}</p>
        ${!isMax ? `<p class="next-perk">Próximo Nível: ${config.next.desc}</p>` : '<p class="max-perk">Nível Máximo Atingido!</p>'}
      </div>
      ${costHtml}
      <button class="upgrade-btn action-btn-retro ${isMax ? 'disabled' : ''}" data-building="${bKey}">
        ${isBuilt ? (isMax ? 'Nível Máximo' : 'Melhorar') : 'Construir'}
      </button>
    `;

    const button = itemEl.querySelector('.upgrade-btn');
    if (button && !isMax) {
      button.addEventListener('click', () => {
        const result = game.town.upgradeBuilding(bKey);
        if (result.success) {
          game.addFloater({ x: 200, y: 150, text: `Evoluído!`, color: '#3aff7d' });
          renderBuildings(game);
          game.saveGame();
        } else {
          alert(result.reason || 'Erro desconhecido ao melhorar.');
        }
      });
    }

    upgradeContainer.appendChild(itemEl);
  }
}

// Configura botões de craft
function setupCraftingButtons(game) {
  const craftContainer = document.getElementById('recipes-list');
  if (!craftContainer) return;

  craftContainer.innerHTML = '';

  for (const recipeKey in CRAFT_RECIPES) {
    const recipe = CRAFT_RECIPES[recipeKey];
    const isEquip = recipe.stats !== undefined;
    const resultItem = isEquip ? recipe : ITEMS_INFO[recipe.result];

    if (!resultItem) continue;

    const card = document.createElement('div');
    card.className = `recipe-card ${isEquip ? 'recipe-equip' : 'recipe-consumable'}`;

    // Montar custos
    const costs = [];
    for (const res in recipe.cost) {
      const icon = res === 'gold' ? '🪙' : ITEMS_INFO[res]?.icon || '📦';
      const required = recipe.cost[res];
      const owned = res === 'gold' ? 0 : game.town.resources[res] || 0; // Ouro de equip é do herói, consumíveis usam cidade
      
      costs.push(`<span>${icon} ${required}</span>`);
    }

    let targetText = '';
    if (isEquip) {
      const classesFormatted = recipe.class.map(c => HERO_CLASSES[c]?.name || c).join(', ');
      targetText = `<p class="recipe-target">Uso: <strong>${classesFormatted}</strong> (Grau ${recipe.tier})</p>
                    <p class="recipe-stats">Efeitos: +${recipe.stats.atk ? `${recipe.stats.atk} Atk` : ''} ${recipe.stats.hp ? `+${recipe.stats.hp} HP` : ''} ${recipe.stats.def ? `+${recipe.stats.def} Def` : ''}</p>`;
    } else {
      const sourceBuildingName = BUILDINGS_CONFIG[recipe.building]?.name || recipe.building;
      targetText = `<p class="recipe-target">Prédio: <strong>${sourceBuildingName}</strong></p>
                    <p class="recipe-desc">${resultItem.desc || ''}</p>`;
    }

    card.innerHTML = `
      <div class="recipe-header">
        <span class="recipe-icon">${resultItem.icon || '⚔️'}</span>
        <div class="recipe-title-section">
          <h4>${resultItem.name}</h4>
          ${targetText}
        </div>
      </div>
      <div class="recipe-cost-list">
        Custos: ${costs.join(' | ')}
      </div>
      <button class="craft-btn action-btn-retro ${isEquip ? 'disabled' : ''}" data-recipe="${recipeKey}" ${isEquip ? 'disabled' : ''}>
        ${isEquip ? 'Heróis Compram Auto' : 'Fabricar'}
      </button>
    `;

    const btn = card.querySelector('.craft-btn');
    if (btn && !isEquip) {
      btn.addEventListener('click', () => {
        const res = game.town.craftConsumable(recipeKey, 1);
        if (res.success) {
          game.addFloater({ x: 300, y: 200, text: `Fabricando...`, color: '#3aff7d' });
        } else {
          alert(res.reason);
        }
      });
    }

    craftContainer.appendChild(card);
  }
}

// Atualiza dinamicamente as tabelas de recursos e heróis a cada frame/tick
export function updateUI(game) {
  // 1. Atualizar Recursos Globais da Cidade na Barra Superior
  const goldEl = document.getElementById('town-gold');
  if (goldEl) goldEl.innerText = game.town.gold;

  const resourceElements = {
    'town-wood': 'wood_rough',
    'town-iron': 'iron_ore',
    'town-steel': 'steel_ore',
    'town-herbs': 'herbs_wild',
    'town-linho': 'linho',
    'town-meat': 'meat_raw',
    'town-rat-tail': 'rat_tail',
    'town-bat-wing': 'bat_wing',
    'town-spider-silk': 'spider_silk',
    'town-gorro-saci': 'gorro_vermelho',
    'town-cabelo-fogo': 'cabelo_fogo',
    'town-olho-boitata': 'olho_boitata',
    'town-ferradura-fogo': 'ferradura_fogo',
    'town-garra-mapinguari': 'garra_mapinguari',
    'town-folha-banana': 'bananier_leaf',
    
    // Consumíveis
    'town-meal': 'meal_cooked',
    'town-bandage': 'bandage_basic',
    'town-beer': 'beer_refreshing'
  };

  for (const id in resourceElements) {
    const el = document.getElementById(id);
    if (el) {
      const resKey = resourceElements[id];
      el.innerText = game.town.resources[resKey] || 0;
    }
  }

  // 2. Atualizar Lista de Heróis (Aba Heróis)
  updateHeroesTab(game);

  // 3. Atualizar Informações de Batalha (Lado Direito / Superior)
  const biomeNameEl = document.getElementById('current-biome-name');
  if (biomeNameEl) {
    const b = game.spawner.getBiomeConfig();
    biomeNameEl.innerText = b.name;
  }

  const killsCountEl = document.getElementById('kills-count');
  if (killsCountEl) {
    const b = game.spawner.getBiomeConfig();
    killsCountEl.innerText = `${game.spawner.killsCount} / ${b.targetKillsForBoss}`;
  }

  const bossCountEl = document.getElementById('boss-kills-count');
  if (bossCountEl) {
    bossCountEl.innerText = game.spawner.bossKillsCount;
  }

  // Atualizar Fila de Craft na UI
  const queueContainer = document.getElementById('craft-queue-list');
  if (queueContainer) {
    if (game.town.craftQueue.length === 0) {
      queueContainer.innerHTML = '<p class="empty-queue-text">Fila de fabricação vazia.</p>';
    } else {
      queueContainer.innerHTML = game.town.craftQueue.map(job => {
        const item = CRAFT_RECIPES[job.recipeId];
        const result = ITEMS_INFO[job.result];
        const progress = ((job.duration - job.timeLeft) / job.duration) * 100;
        return `
          <div class="queue-item">
            <span>${result.icon} ${result.name} (x${job.quantity})</span>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${progress}%"></div>
            </div>
            <span class="queue-time">${(job.timeLeft / 1000).toFixed(1)}s</span>
          </div>
        `;
      }).join('');
    }
  }

  // Atualizar Logs de Eventos de Caça
  const logsContainer = document.getElementById('system-logs');
  if (logsContainer) {
    logsContainer.innerHTML = game.spawner.logs.slice(0, 8).map(log => `<li>${log}</li>`).join('');
  }

  // Desabilitar botões de contratação se o limite for atingido
  const maxHeroes = game.town.getBuildingConfig('townhall').current.maxHeroes;
  const countHeroes = game.heroes.length;
  const hireBtnContainer = document.getElementById('hiring-cost-display');
  if (hireBtnContainer) {
    const cost = game.getHiringCost();
    hireBtnContainer.innerHTML = `Vagas: <strong>${countHeroes} / ${maxHeroes}</strong>. Custo do próximo herói: 🪙 <strong>${cost} Ouro</strong>`;
  }
}

// Renderiza a lista detalhada de heróis na aba correspondente
let lastSelectedHeroId = null;

function updateHeroesTab(game) {
  const listEl = document.getElementById('heroes-list-container');
  if (!listEl) return;

  listEl.innerHTML = '';

  game.heroes.forEach(hero => {
    const card = document.createElement('div');
    const isSelected = lastSelectedHeroId === hero.id;
    card.className = `hero-row-card ${isSelected ? 'selected' : ''}`;
    
    const hpPct = (hero.hp / hero.maxHp) * 100;
    const hungerPct = hero.hunger;
    const energyPct = hero.energy;
    const moodPct = hero.mood;

    const classConfig = HERO_CLASSES[hero.className];

    // Formatar equipamentos
    const weaponName = hero.equipment.weapon ? hero.equipment.weapon.name : 'Nenhuma';
    const armorName = hero.equipment.armor ? hero.equipment.armor.name : 'Nenhuma';

    // Formatar inventário
    const invItems = [];
    for (const key in hero.inventory) {
      if (hero.inventory[key] > 0) {
        invItems.push(`${ITEMS_INFO[key]?.icon || '📦'} x${hero.inventory[key]}`);
      }
    }
    const invText = invItems.length > 0 ? invItems.join(' | ') : 'Vazio';

    card.innerHTML = `
      <div class="hero-summary-line" style="border-left: 5px solid ${hero.classConfig.color}">
        <div class="hero-name-lvl">
          <strong>${hero.name}</strong>
          <span class="hero-lvl-label">Lvl ${hero.level}</span>
        </div>
        <div class="hero-needs-bars">
          <div class="need-bar-mini" title="Vida">
            <span class="need-icon">❤️</span>
            <div class="bar"><div class="fill hp" style="width: ${hpPct}%"></div></div>
            <span class="val">${Math.round(hero.hp)}/${hero.maxHp}</span>
          </div>
          <div class="need-bar-mini" title="Fome">
            <span class="need-icon">🍲</span>
            <div class="bar"><div class="fill hunger" style="width: ${hungerPct}%"></div></div>
            <span class="val">${Math.round(hero.hunger)}/100</span>
          </div>
          <div class="need-bar-mini" title="Energia">
            <span class="need-icon">⚡</span>
            <div class="bar"><div class="fill energy" style="width: ${energyPct}%"></div></div>
            <span class="val">${Math.round(hero.energy)}/100</span>
          </div>
        </div>
        <div class="hero-action-label">
          <span class="state-badge state-${hero.state.toLowerCase()}">${formatHeroState(hero.state)}</span>
        </div>
      </div>
      
      ${isSelected ? `
        <div class="hero-details-drawer">
          <div class="details-grid">
            <div class="details-stats">
              <h5>Atributos</h5>
              <p>⚔️ Ataque: <strong>${hero.atk}</strong></p>
              <p>🛡️ Defesa: <strong>${hero.def}</strong></p>
              <p>⚡ Vel. Ataque: <strong>${hero.spd.toFixed(1)}/s</strong></p>
              <p>🪙 Ouro Individual: <strong>${hero.gold}</strong></p>
              <p>🌟 XP: <strong>${hero.xp} / ${hero.xpNeeded}</strong></p>
            </div>
            <div class="details-equipment">
              <h5>Equipamentos</h5>
              <p>🗡️ Arma: <span class="equip-item-tag ${hero.equipment.weapon ? 'tier-' + hero.equipment.weapon.tier : ''}">${weaponName}</span></p>
              <p>🛡️ Armadura: <span class="equip-item-tag ${hero.equipment.armor ? 'tier-' + hero.equipment.armor.tier : ''}">${armorName}</span></p>
            </div>
            <div class="details-inventory">
              <h5>Inventário Pessoal (Loots)</h5>
              <p>${invText}</p>
            </div>
          </div>
          <div class="details-logs">
            <h5>Logs de Atividades</h5>
            <ul>
              ${hero.logs.map(log => `<li>${log}</li>`).join('')}
            </ul>
          </div>
        </div>
      ` : ''}
    `;

    // Abrir/Fechar Detalhes ao Clicar
    card.addEventListener('click', (e) => {
      // Se clicou em algum sub-botão ou gaveta, não altera
      if (e.target.closest('.hero-details-drawer')) return;
      
      if (isSelected) {
        lastSelectedHeroId = null;
      } else {
        lastSelectedHeroId = hero.id;
      }
      updateHeroesTab(game);
    });

    listEl.appendChild(card);
  });
}

function formatHeroState(state) {
  const states = {
    'IDLE_TOWN': 'Vagando na Cidade',
    'SEARCHING_MONSTER': 'Buscando Monstros',
    'FIGHTING': '⚔️ Em Combate',
    'RETURNING_TOWN': 'Voltando para Cidade',
    'RESTING_HOTEL': '💤 Dormindo (Hotel)',
    'EATING_REST': '🍲 Comendo (Restaurante)',
    'HEALING_HOSP': '🩹 Em Tratamento (Hospital)',
    'DRINKING_TAVERN': '🍺 Bebendo (Taverna)',
    'SELLING_LOOT': '🪙 Vendendo Coletas'
  };
  return states[state] || state;
}
