import { BUILDINGS_CONFIG, CRAFT_RECIPES, ITEMS_INFO, BIOMES, HERO_CLASSES } from '../data/constants.js';

import { getBuildingVisualStage } from './renderer.js';

let activeProfileHero = null;
let activeProfileTab = 'stats';
let pendingBuildingPlacement = null;
let pendingPlacementFlipped = false;
let activeBuildingKey = null;

let lastTownStateKey = '';
let wasTownModalActive = false;
let wasCraftModalActive = false;

let activeRecipeFilter = 'all';

const BUILDING_ACTION_LABELS = {
  townhall: { name: 'Centro da Cidade', icon: '🏛️', modalId: 'town-modal' },
  hotel: { name: 'Hotel', icon: '🏨', modalId: 'craft-modal' },
  restaurant: { name: 'Restaurante', icon: '🍲', modalId: 'craft-modal' },
  hospital: { name: 'Hospital', icon: '🏥', modalId: 'craft-modal' },
  tavern: { name: 'Taverna', icon: '🍺', modalId: 'craft-modal' },
  forge: { name: 'Forja', icon: '⚒️', modalId: 'craft-modal' },
  market: { name: 'Mercado da Vila', icon: '⚖️', modalId: 'market-modal' }
};

export function setupUI(game) {
  // 1. Controle de Janelas Modais Retro (Menu de Rodapé)
  const menuButtons = document.querySelectorAll('.menu-btn-retro');
  const modalOverlays = document.querySelectorAll('.modal-overlay');

  menuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      
      // Se for Cidade ou Caça, apenas mudamos a tela do canvas (e fechamos modais abertos)
      if (targetId === 'view-town') {
        if (window.gameRenderer) {
          window.gameRenderer.activeView = 'town';
        }
        menuButtons.forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-target') === 'view-town');
        });
        modalOverlays.forEach(m => {
          m.classList.remove('active');
        });
        return;
      }
      
      if (targetId === 'view-hunt') {
        if (window.gameRenderer) {
          window.gameRenderer.activeView = 'hunt';
        }
        menuButtons.forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-target') === 'view-hunt');
        });
        modalOverlays.forEach(m => {
          m.classList.remove('active');
        });
        return;
      }

      // Outros modais (Heróis, Inventário, Configurações) abrem normalmente como overlays
      const modal = document.getElementById(targetId);
      if (modal) {
        if (modal.classList.contains('active')) {
          modal.classList.remove('active');
          btn.classList.remove('active');
          // Re-ativa o botão da tela de fundo ativa
          const activeScreen = window.gameRenderer ? window.gameRenderer.activeView : 'town';
          menuButtons.forEach(b => {
            const t = b.getAttribute('data-target');
            if ((activeScreen === 'town' && t === 'view-town') || (activeScreen === 'hunt' && t === 'view-hunt')) {
              b.classList.add('active');
            }
          });
          return;
        }

        // Fecha outros overlays de gerenciamento
        menuButtons.forEach(b => {
          const t = b.getAttribute('data-target');
          if (t !== 'view-town' && t !== 'view-hunt') {
            b.classList.remove('active');
          }
        });
        modalOverlays.forEach(m => {
          m.classList.remove('active');
        });

        // Se o modal de inventário for aberto, atualiza o baú
        if (targetId === 'inventory-modal') {
          updateTownInventory(game);
        }

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
      // Re-ativa o botão da tela de fundo ativa
      const activeScreen = window.gameRenderer ? window.gameRenderer.activeView : 'town';
      menuButtons.forEach(b => {
        const t = b.getAttribute('data-target');
        if ((activeScreen === 'town' && t === 'view-town') || (activeScreen === 'hunt' && t === 'view-hunt')) {
          b.classList.add('active');
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

  // 2. Botão rápido de bioma no canvas (indicador clicavel)
  const biomeQuickBtn = document.getElementById('biome-quick-btn');
  if (biomeQuickBtn) {
    biomeQuickBtn.addEventListener('click', () => {
      if (window.gameRenderer) window.gameRenderer.activeView = 'hunt';
      menuButtons.forEach(b => {
        const t = b.getAttribute('data-target');
        b.classList.toggle('active', t === 'view-hunt');
      });
      modalOverlays.forEach(m => {
        m.classList.remove('active');
      });
      renderBiomeCards(game);
      const dModal = document.getElementById('dungeons-modal');
      if (dModal) dModal.classList.add('active');
    });
  }

  // 2.5 Botão rápido de nível dos monstros
  const monsterLevelBtn = document.getElementById('monster-level-btn');
  if (monsterLevelBtn) {
    monsterLevelBtn.addEventListener('click', () => {
      let lvl = game.spawner.monsterLevel || 2;
      lvl = lvl + 1;
      if (lvl > 4) lvl = 1;
      game.spawner.monsterLevel = lvl;

      // Limpar monstros ativos para gerar novos monstros no novo nível instantaneamente
      game.spawner.activeMonsters = [];
      if (window.gameRenderer && window.gameRenderer.activeView === 'hunt') {
        game.spawner.update(0, game.town, game.heroes, { width: window.gameRenderer.canvas.width, height: window.gameRenderer.canvas.height });
      }

      const difficultyNames = {
        1: 'Fácil',
        2: 'Normal',
        3: 'Difícil',
        4: 'Pesadelo'
      };
      const name = difficultyNames[lvl] || 'Normal';
      
      game.addFloater({
        x: window.gameRenderer ? window.gameRenderer.canvas.width / 2 : 480,
        y: window.gameRenderer ? window.gameRenderer.canvas.height / 2 - 50 : 220,
        text: `Dificuldade: ${name}!`,
        color: lvl === 1 ? '#a5d6a7' : (lvl === 3 ? '#ffb74d' : (lvl === 4 ? '#ff5252' : '#ffffff')),
        time: 1.2
      });

      game.saveGame();
      
      const levelNameEl = document.getElementById('current-monster-level-name');
      if (levelNameEl) {
        levelNameEl.innerText = `${name} (Lvl ${lvl})`;
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

  // Vinculação das abas de Crafting
  const craftTabButtons = document.querySelectorAll('.craft-tab-btn');
  craftTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      craftTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRecipeFilter = btn.getAttribute('data-filter');
      setupCraftingButtons(game);
    });
  });

  // 5. Botão Reset de Jogo
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Tem certeza de que deseja resetar TODAS as suas construções e heróis? O progresso será perdido.')) {
        game.resetGame();
      }
    });
  }

  // 6. Configurar as Importações Rápidas (Prefeitura)
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

  // 6.5 Configurar o toggle de compra automática (Mercado)
  const autobuyToggle = document.getElementById('market-autobuy-toggle');
  if (autobuyToggle) {
    autobuyToggle.checked = game.town.autoBuyHeroLoot;
    autobuyToggle.addEventListener('change', (e) => {
      game.town.autoBuyHeroLoot = e.target.checked;
      game.saveGame();
    });
  }

  // 7. Modal de Perfil Detalhado do Caçador
  const profileModal = document.getElementById('hero-profile-modal');
  if (profileModal) {
    const closeProfileBtn = document.getElementById('close-profile-btn');
    if (closeProfileBtn) {
      closeProfileBtn.addEventListener('click', () => {
        profileModal.classList.remove('active');
        activeProfileHero = null;
      });
    }
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) {
        profileModal.classList.remove('active');
        activeProfileHero = null;
      }
    });

    // Abas de Navegação internas do Perfil
    const tabBtns = profileModal.querySelectorAll('.profile-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeProfileTab = btn.getAttribute('data-tab');
        if (activeProfileHero) {
          refreshHeroProfile(activeProfileHero, game);
        }
      });
    });
  }

  const openFunctionsBtn = document.getElementById('building-open-functions-btn');
  if (openFunctionsBtn) {
    openFunctionsBtn.addEventListener('click', () => {
      if (!activeBuildingKey) return;
      openBuildingFunctions(activeBuildingKey, game, menuButtons);
    });
  }

  const upgradeDirectBtn = document.getElementById('building-upgrade-direct-btn');
  if (upgradeDirectBtn) {
    upgradeDirectBtn.addEventListener('click', () => {
      if (!activeBuildingKey) return;
      const result = game.town.upgradeBuilding(activeBuildingKey);
      if (result.success) {
        game.addFloater({ x: 480, y: 200, text: 'Evoluído!', color: '#3aff7d' });
        // Refresh building actions modal content
        openBuildingActions(activeBuildingKey);
        // Refresh building list if needed
        renderBuildings(game);
        game.saveGame();
      } else {
        alert(result.reason || 'Erro ao melhorar.');
      }
    });
  }

  const moveBuildingBtn = document.getElementById('building-move-btn');
  if (moveBuildingBtn) {
    moveBuildingBtn.addEventListener('click', () => {
      if (!activeBuildingKey || !window.gameRenderer) return;

      pendingBuildingPlacement = activeBuildingKey;
      const currentPlacement = game.town.getBuildingPlacement(activeBuildingKey);
      pendingPlacementFlipped = currentPlacement ? !!currentPlacement.flipped : false;

      window.gameRenderer.activeView = 'town';
      window.gameRenderer.pendingPlacement = activeBuildingKey;
      window.gameRenderer.pendingPlacementFlipped = pendingPlacementFlipped;
      window.gameRenderer.hoveredTile = null;

      const rotationControl = document.getElementById('rotation-control');
      if (rotationControl) rotationControl.style.display = 'flex';

      const actionsModal = document.getElementById('building-actions-modal');
      if (actionsModal) actionsModal.classList.remove('active');
      activeBuildingKey = null;
    });
  }

  // Teclado: R para rotacionar, Escape para cancelar posicionamento
  window.addEventListener('keydown', (e) => {
    if (pendingBuildingPlacement) {
      if (e.key === 'r' || e.key === 'R') {
        pendingPlacementFlipped = !pendingPlacementFlipped;
        if (window.gameRenderer) {
          window.gameRenderer.pendingPlacementFlipped = pendingPlacementFlipped;
        }
        game.addFloater({
          x: window.gameRenderer.canvas.width / 2,
          y: window.gameRenderer.canvas.height / 2 - 50,
          text: 'Rotacionado!',
          color: '#ffd54f'
        });
      } else if (e.key === 'Escape') {
        pendingBuildingPlacement = null;
        if (window.gameRenderer) {
          window.gameRenderer.pendingPlacement = null;
          window.gameRenderer.hoveredTile = null;
          window.gameRenderer.pendingPlacementFlipped = false;
        }
        const rotationControl = document.getElementById('rotation-control');
        if (rotationControl) rotationControl.style.display = 'none';
        game.addFloater({
          x: window.gameRenderer.canvas.width / 2,
          y: window.gameRenderer.canvas.height / 2 - 50,
          text: 'Cancelado',
          color: '#ff5252'
        });
      }
    }
  });

  const rotateBtn = document.getElementById('rotate-building-btn');
  if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
      if (pendingBuildingPlacement) {
        pendingPlacementFlipped = !pendingPlacementFlipped;
        if (window.gameRenderer) {
          window.gameRenderer.pendingPlacementFlipped = pendingPlacementFlipped;
        }
        game.addFloater({
          x: window.gameRenderer.canvas.width / 2,
          y: window.gameRenderer.canvas.height / 2 - 50,
          text: 'Rotacionado!',
          color: '#ffd54f'
        });
      }
    });
  }

  // 8. Cliques e Movimentação no Canvas (Evil Hunter Tycoon style)
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    let isMouseDown = false;
    let startX = 0;
    let startY = 0;
    let startCamX = 0;
    let startCamY = 0;

    canvas.addEventListener('mousedown', (e) => {
      if (!window.gameRenderer) return;
      isMouseDown = true;
      startX = e.clientX;
      startY = e.clientY;
      startCamX = window.gameRenderer.cameraX;
      startCamY = window.gameRenderer.cameraY;
      window.gameRenderer.isDragging = true;
      window.gameRenderer.hasDragged = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!window.gameRenderer) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if (isMouseDown && window.gameRenderer.activeView === 'town') {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          window.gameRenderer.hasDragged = true;
        }
        const maxCamX = window.gameRenderer.maxCameraX ?? 300;
        const maxCamY = window.gameRenderer.maxCameraY ?? 200;
        window.gameRenderer.cameraX = Math.max(-maxCamX, Math.min(maxCamX, startCamX - dx * scaleX));
        window.gameRenderer.cameraY = Math.max(-maxCamY, Math.min(maxCamY, startCamY - dy * scaleY));
      }

      if (pendingBuildingPlacement) {
        const x = (e.clientX - rect.left) * scaleX + window.gameRenderer.cameraX;
        const y = (e.clientY - rect.top) * scaleY + window.gameRenderer.cameraY;
        window.gameRenderer.hoveredTile = window.gameRenderer.screenToGrid(x, y, game.town);
      }
    });

    canvas.addEventListener('mouseup', () => {
      isMouseDown = false;
      if (window.gameRenderer) {
        window.gameRenderer.isDragging = false;
      }
    });

    canvas.addEventListener('mouseleave', () => {
      isMouseDown = false;
      if (window.gameRenderer) {
        window.gameRenderer.isDragging = false;
      }
    });

    // Suporte para Toques no Celular (Touch Events)
    canvas.addEventListener('touchstart', (e) => {
      if (!window.gameRenderer || e.touches.length === 0) return;
      isMouseDown = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startCamX = window.gameRenderer.cameraX;
      startCamY = window.gameRenderer.cameraY;
      window.gameRenderer.isDragging = true;
      window.gameRenderer.hasDragged = false;
    });

    canvas.addEventListener('touchmove', (e) => {
      if (!window.gameRenderer || e.touches.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if (isMouseDown && window.gameRenderer.activeView === 'town') {
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          window.gameRenderer.hasDragged = true;
        }
        const maxCamX = window.gameRenderer.maxCameraX ?? 300;
        const maxCamY = window.gameRenderer.maxCameraY ?? 200;
        window.gameRenderer.cameraX = Math.max(-maxCamX, Math.min(maxCamX, startCamX - dx * scaleX));
        window.gameRenderer.cameraY = Math.max(-maxCamY, Math.min(maxCamY, startCamY - dy * scaleY));
      }

      if (pendingBuildingPlacement) {
        const x = (e.touches[0].clientX - rect.left) * scaleX + window.gameRenderer.cameraX;
        const y = (e.touches[0].clientY - rect.top) * scaleY + window.gameRenderer.cameraY;
        window.gameRenderer.hoveredTile = window.gameRenderer.screenToGrid(x, y, game.town);
      }
    });

    canvas.addEventListener('touchend', () => {
      isMouseDown = false;
      if (window.gameRenderer) {
        window.gameRenderer.isDragging = false;
      }
    });

    canvas.addEventListener('click', (e) => {
      if (window.gameRenderer && window.gameRenderer.hasDragged) {
        window.gameRenderer.hasDragged = false;
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX + (window.gameRenderer ? window.gameRenderer.cameraX : 0);
      const y = (e.clientY - rect.top) * scaleY + (window.gameRenderer ? window.gameRenderer.cameraY : 0);

      const activeView = window.gameRenderer ? window.gameRenderer.activeView : 'town';

      if (activeView === 'town' && pendingBuildingPlacement && window.gameRenderer) {
        const tile = window.gameRenderer.screenToGrid(x, y, game.town);
        if (!tile) return;

        const result = game.town.buildAt(pendingBuildingPlacement, tile.col, tile.row, pendingPlacementFlipped);
        if (result.success) {
          const placed = pendingBuildingPlacement;
          pendingBuildingPlacement = null;
          pendingPlacementFlipped = false;
          window.gameRenderer.pendingPlacement = null;
          window.gameRenderer.hoveredTile = null;
          window.gameRenderer.pendingPlacementFlipped = false;
          const rotationControl = document.getElementById('rotation-control');
          if (rotationControl) rotationControl.style.display = 'none';
          game.addFloater({ x, y, text: result.moved ? 'Movido!' : 'Construido!', color: '#3aff7d' });
          renderBuildings(game);
          game.saveGame();
        } else {
          alert(result.reason || 'Nao foi possivel construir aqui.');
        }
        return;
      }
      
      // 1. Clicar em um caçador visível (aumentado para dist < 35 para melhor usabilidade mobile)
      let clickedHero = null;
      for (const h of game.heroes) {
        if (h.currentMap === activeView) {
          const dist = Math.sqrt((h.x - x) * (h.x - x) + (h.y - y) * (h.y - y));
          if (dist < 35) {
            clickedHero = h;
            break;
          }
        }
      }

      if (clickedHero) {
        openHeroProfile(clickedHero, game);
        return;
      }

      // 2. Clicar em construcoes posicionadas na cidade
      let clickedBuilding = false;
      if (activeView === 'town' && window.gameRenderer) {
        let clickedB = null;
        for (const placed of game.town.getPlacedBuildings()) {
          const pos = window.gameRenderer.getBuildingScreenPosition(game.town, placed.key);
          if (!pos) continue;
          const wSize = placed.key === 'townhall' ? 86 : 66;
          const hSize = placed.key === 'townhall' ? 86 : 66;
          const rx = pos.x - wSize / 2;
          const ry = pos.y - hSize + 8;
          if (x >= rx && x <= rx + wSize && y >= ry && y <= ry + hSize) {
            clickedB = placed;
            break;
          }
        }

        if (clickedB) {
          openBuildingActions(clickedB.key, game);
          clickedBuilding = true;
          return;
        }
      }

      // 3. Clicar em lote vazio na cidade para abrir modal de construção rápida
      if (activeView === 'town' && window.gameRenderer && !clickedBuilding && !pendingBuildingPlacement) {
        const tile = window.gameRenderer.screenToGrid(x, y, game.town);
        if (tile) {
          // Verifica se o lote é livre para um edifício padrão de 2x2
          const isFree = game.town.isAreaFree(tile.col, tile.row, { w: 2, h: 2 });
          if (isFree) {
            openBuildTileModal(tile.col, tile.row, game);
            return;
          }
        }
      }

      // 4. Clicar no Portal da Masmorra (Apenas em Hunt View)
      if (activeView === 'hunt') {
        const portalX = 480;
        const portalY = 100;
        const dist = Math.sqrt((x - portalX) * (x - portalX) + (y - (portalY - 20)) * (y - (portalY - 20)));
        if (dist < 40) {
          const modal = document.getElementById('dungeons-modal');
          if (modal) {
            modal.classList.add('active');
            menuButtons.forEach(b => {
              if (b.getAttribute('data-target') === 'dungeons-modal') b.classList.add('active');
              else b.classList.remove('active');
            });
            renderBiomeCards(game);
          }
        }
      }
    });
  }
}


// =====================================================================
// BIOME CARD SELECTOR
// =====================================================================

// Configurações visuais de cada bioma (tema, ícones, descrição)
const BIOME_VISUAL = [
  {
    emoji: '⛰️',
    theme: 'biome-cave',
    gradient: 'linear-gradient(135deg, #2a2c35 0%, #3d3058 100%)',
    border: '#5e4f7d',
    levelRange: 'Nív. 1 — 15',
    diffStars: 1,
    diffLabel: 'Iniciante',
    description: 'Tocas subterrâneas repletas de criaturas do folclore urbano e extraterrestres. Ideal para heróis iniciantes.',
    unlockReq: null,
    monsterIcons: { normal: '🐀🧿💀🐷👽', miniboss: '👽🤡', boss: '🎒👻' }
  },
  {
    emoji: '🌲',
    theme: 'biome-forest',
    gradient: 'linear-gradient(135deg, #0d2218 0%, #1a3d20 100%)',
    border: '#2e6b35',
    levelRange: 'Nív. 15 — 30',
    diffStars: 2,
    diffLabel: 'Intermediário',
    description: 'Floresta densa e assombrada habitada por criaturas do folclore brasileiro clássico. Perigo elevado.',
    unlockReq: 'Prefeitura Nív. 3',
    monsterIcons: { normal: '🐺🧛🦎🐾🌿', miniboss: '🐰🐴', boss: '🐂🔥' }
  },
  {
    emoji: '🌿',
    theme: 'biome-swamp',
    gradient: 'linear-gradient(135deg, #0d1e16 0%, #1b3328 100%)',
    border: '#2e5544',
    levelRange: 'Nív. 30 — 50',
    diffStars: 3,
    diffLabel: 'Elite',
    description: 'Pântano sombrio e pestilento com os monstros mais temidos do folclore. Apenas heróis experientes sobrevivem.',
    unlockReq: 'Prefeitura Nív. 4',
    monsterIcons: { normal: '🦎🐺🧛🧜🐊', miniboss: '👁️🐾', boss: '🔥👁️' }
  }
];

function renderBiomeCards(game) {
  const container = document.getElementById('biome-cards-container');
  if (!container) return;

  const currentBiomeId = game.spawner.currentBiomeId;
  const townhallLevel = game.town.buildings.townhall || 0;

  container.innerHTML = BIOMES.map((biome, idx) => {
    const visual = BIOME_VISUAL[idx];
    const isActive = idx === currentBiomeId;

    // Verificar se está desbloqueado
    let isLocked = false;
    if (idx === 1 && townhallLevel < 3) isLocked = true;
    if (idx === 2 && townhallLevel < 4) isLocked = true;

    // Estrelas de dificuldade
    const stars = '⭐'.repeat(visual.diffStars) + '☆'.repeat(3 - visual.diffStars);

    // Monstros normais únicos (sem duplicatas)
    const uniqueNormal = [...new Map(biome.monsters.map(m => [m.name, m])).values()];
    const normalList = uniqueNormal.slice(0, 5).map(m =>
      `<span class="biome-monster-tag">${m.name}</span>`
    ).join('');

    const minibossList = biome.miniBosses.slice(0, 2).map(m =>
      `<span class="biome-monster-tag mini">${m.name}</span>`
    ).join('');

    const bossList = biome.bosses.slice(0, 2).map(m =>
      `<span class="biome-monster-tag boss">${m.name}</span>`
    ).join('');

    const activeClass = isActive ? 'biome-card--active' : '';
    const lockedClass = isLocked ? 'biome-card--locked' : '';

    return `
      <div class="biome-card ${activeClass} ${lockedClass}" data-biome-id="${idx}" style="background: ${visual.gradient}; border-color: ${isActive ? '#ffea3a' : visual.border};">
        <div class="biome-card-header">
          <span class="biome-card-emoji">${visual.emoji}</span>
          <div class="biome-card-title-col">
            <strong class="biome-card-name">${biome.name}</strong>
            <span class="biome-card-level">${visual.levelRange}</span>
          </div>
          ${isActive ? '<span class="biome-active-badge">✅ ATIVO</span>' : ''}
          ${isLocked ? '<span class="biome-locked-badge">🔒</span>' : ''}
        </div>

        <div class="biome-card-diff">
          <span class="biome-stars">${stars}</span>
          <span class="biome-diff-label">${visual.diffLabel}</span>
        </div>

        <p class="biome-card-desc">${visual.description}</p>

        <div class="biome-monster-section">
          <div class="biome-monster-row">
            <span class="biome-row-label">👾 Normais:</span>
            <div class="biome-monster-tags">${normalList}</div>
          </div>
          <div class="biome-monster-row">
            <span class="biome-row-label">⚠️ Mini-Boss:</span>
            <div class="biome-monster-tags">${minibossList}</div>
          </div>
          <div class="biome-monster-row">
            <span class="biome-row-label">💀 Boss:</span>
            <div class="biome-monster-tags">${bossList}</div>
          </div>
        </div>

        ${isLocked
          ? `<div class="biome-card-lock-info">🔒 Requer: <strong>${visual.unlockReq}</strong></div>`
          : isActive
            ? `<button class="biome-select-btn biome-btn--active" data-active-biome="true">✅ Zona Selecionada</button>`
            : `<button class="biome-select-btn" data-biome-id="${idx}">⚔️ Selecionar esta Zona</button>`
        }
      </div>
    `;
  }).join('');

  // Vincular cliques nos botões de seleção de nova zona
  container.querySelectorAll('.biome-select-btn[data-biome-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-biome-id'));
      const res = game.changeBiome(id);
      if (res && res.success === false && res.reason) {
        alert(res.reason);
      } else {
        renderBiomeCards(game); // Re-render para atualizar o estado ativo
        const dModal = document.getElementById('dungeons-modal');
        if (dModal) dModal.classList.remove('active');
        if (window.gameRenderer) {
          window.gameRenderer.activeView = 'hunt';
        }
      }
    });
  });

  // Vincular clique no botão da zona que já está ativa
  container.querySelectorAll('.biome-select-btn[data-active-biome]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dModal = document.getElementById('dungeons-modal');
      if (dModal) dModal.classList.remove('active');
      if (window.gameRenderer) {
        window.gameRenderer.activeView = 'hunt';
      }
    });
  });
}

function openBuildingActions(buildingKey) {
  const modal = document.getElementById('building-actions-modal');
  if (!modal) return;

  activeBuildingKey = buildingKey;
  const meta = BUILDING_ACTION_LABELS[buildingKey] || { name: buildingKey, icon: '🏠' };
  const config = window.game?.town?.getBuildingConfig(buildingKey);

  const titleEl = document.getElementById('building-actions-title');
  const iconEl = document.getElementById('building-actions-icon');
  const nameEl = document.getElementById('building-actions-name');
  const levelEl = document.getElementById('building-actions-level');
  const upgradeInfoEl = document.getElementById('building-actions-upgrade-info');
  const upgradeBtn = document.getElementById('building-upgrade-direct-btn');

  if (titleEl) titleEl.innerText = meta.name.toUpperCase();
  if (iconEl) iconEl.innerText = meta.icon;
  if (nameEl) nameEl.innerText = meta.name;
  
  const level = config?.level || 0;
  if (levelEl) {
    levelEl.innerText = `Nível ${level} - ${getBuildingVisualStage(Math.max(level, 1)).name}`;
  }

  // Render upgrade info
  if (upgradeInfoEl && config) {
    const isMax = config.next === null;
    if (isMax) {
      upgradeInfoEl.innerHTML = `<span style="color: var(--border-gold); font-weight: bold;">Nível Máximo Atingido!</span>`;
      if (upgradeBtn) {
        upgradeBtn.classList.add('disabled');
        upgradeBtn.disabled = true;
        upgradeBtn.innerText = 'Max Lvl';
      }
    } else {
      let canUpgrade = true;
      const costs = [];
      for (const res in config.next.cost) {
        const icon = res === 'gold' ? '🪙' : ITEMS_INFO[res]?.icon || '📦';
        const required = config.next.cost[res];
        const owned = res === 'gold' ? window.game.town.gold : window.game.town.resources[res] || 0;
        const isEnough = owned >= required;
        if (!isEnough) {
          canUpgrade = false;
        }
        costs.push(`<span class="cost-item ${isEnough ? 'enough' : 'not-enough'}">${icon} ${required} (${owned})</span>`);
      }
      
      // Check townhall dependency
      if (buildingKey !== 'townhall') {
        if (window.game.town.buildings.townhall <= 0) {
          canUpgrade = false;
        } else if (window.game.town.buildings[buildingKey] >= window.game.town.buildings.townhall) {
          canUpgrade = false;
        }
      }

      upgradeInfoEl.innerHTML = `
        <div style="margin-bottom: 4px;"><strong>Próximo Nível:</strong> ${config.next.desc}</div>
        <div class="building-cost" style="font-size: 10px; display: flex; flex-wrap: wrap; gap: 5px;">Custo: ${costs.join(', ')}</div>
      `;

      if (upgradeBtn) {
        if (canUpgrade) {
          upgradeBtn.classList.remove('disabled');
          upgradeBtn.disabled = false;
        } else {
          upgradeBtn.classList.add('disabled');
          upgradeBtn.disabled = true;
        }
        upgradeBtn.innerText = 'Melhorar';
      }
    }
  }

  document.querySelectorAll('.modal-overlay').forEach(m => {
    if (m.id !== 'building-actions-modal') m.classList.remove('active');
  });
  modal.classList.add('active');
}

function refreshMarketUI(game) {
  const levelDisplay = document.getElementById('market-level-display');
  const taxDisplay = document.getElementById('market-tax-display');
  const taxDesc = document.getElementById('market-tax-description');
  const autobuyToggle = document.getElementById('market-autobuy-toggle');

  if (autobuyToggle) {
    autobuyToggle.checked = game.town.autoBuyHeroLoot;
  }

  if (levelDisplay && taxDisplay && taxDesc) {
    const level = game.town.buildings.market || 0;
    levelDisplay.innerText = `Nível ${level}`;

    const config = BUILDINGS_CONFIG.market?.upgrades[Math.max(level - 1, 0)];
    if (config) {
      const taxPercent = Math.round((config.sellTax ?? 0) * 100);
      taxDisplay.innerText = `${taxPercent}%`;

      if (taxPercent > 0) {
        taxDesc.innerHTML = `O mercado retém <strong style="color:#ffb74d">${taxPercent}%</strong> do valor dos itens vendidos pelos caçadores como taxa municipal. Melhore o mercado para reduzir a taxa!`;
      } else {
        taxDesc.innerHTML = `<strong style="color:#81c784">Isenção Fiscal Ativa!</strong> Os caçadores recebem 100% do ouro nas vendas de loots.`;
      }
    }
  }
}

function openBuildingFunctions(buildingKey, game, menuButtons) {
  const meta = BUILDING_ACTION_LABELS[buildingKey] || { modalId: 'town-modal' };
  const modalId = meta.modalId;
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const actionsModal = document.getElementById('building-actions-modal');
  if (actionsModal) actionsModal.classList.remove('active');

  if (buildingKey === 'market') {
    refreshMarketUI(game);
  }

  // Filter crafting if opening craft-modal
  if (modalId === 'craft-modal') {
    activeRecipeFilter = buildingKey;
    
    // Hide the tabs row to restrict crafting to this building
    const tabRow = modal.querySelector('.craft-tabs-row');
    if (tabRow) tabRow.style.display = 'none';

    // Set dynamic title
    const titleEl = document.getElementById('craft-modal-title');
    if (titleEl) {
      const bConfig = BUILDINGS_CONFIG[buildingKey];
      const name = bConfig ? bConfig.name.toUpperCase() : 'PRODUÇÃO';
      titleEl.innerText = `${name} - PRODUÇÃO E MATERIAIS`;
    }

    setupCraftingButtons(game);
  } else {
    activeRecipeFilter = 'all';
  }

  if (modalId === 'town-modal') {
    renderBuildings(game);
  }

  modal.classList.add('active');
  
  // Ensure the active footer button remains view-town since we are operating in the town!
  menuButtons.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-target') === 'view-town');
  });

  if (modalId === 'town-modal') {
    setTimeout(() => {
      const card = document.querySelector(`[data-building="${buildingKey}"]`)?.closest('.building-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  activeBuildingKey = null;
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
    const currentVisualStage = getBuildingVisualStage(Math.max(config.level, 1));
    const nextVisualStage = !isMax ? getBuildingVisualStage(config.level + 1) : null;

    let canUpgrade = true;
    if (isMax) {
      canUpgrade = false;
    } else {
      // Check cost
      for (const res in config.next.cost) {
        const required = config.next.cost[res];
        const owned = res === 'gold' ? game.town.gold : game.town.resources[res] || 0;
        if (owned < required) {
          canUpgrade = false;
          break;
        }
      }
      // Check townhall dependency
      if (bKey !== 'townhall') {
        if (game.town.buildings.townhall <= 0) {
          canUpgrade = false;
        } else if (game.town.buildings[bKey] >= game.town.buildings.townhall) {
          canUpgrade = false;
        }
      }
    }

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
        <p class="visual-perk">Visual: ${isBuilt ? currentVisualStage.name : 'Projeto inicial'}${nextVisualStage && nextVisualStage.name !== currentVisualStage.name ? ` -> ${nextVisualStage.name}` : ''}</p>
        <p class="current-perk">Efeito Atual: ${isBuilt ? (config.current?.desc || 'Edifício Funcional') : 'Inativo'}</p>
        ${!isMax ? `<p class="next-perk">Próximo Nível: ${config.next.desc}</p>` : '<p class="max-perk">Nível Máximo Atingido!</p>'}
      </div>
      ${costHtml}
      <button class="upgrade-btn action-btn-retro ${!canUpgrade ? 'disabled' : ''}" data-building="${bKey}" ${!canUpgrade ? 'disabled' : ''}>
        ${isBuilt ? (isMax ? 'Nível Máximo' : 'Melhorar') : 'Construir'}
      </button>
    `;

    const button = itemEl.querySelector('.upgrade-btn');
    if (button && canUpgrade) {
      button.addEventListener('click', () => {
        if (!isBuilt) {
          pendingBuildingPlacement = bKey;
          pendingPlacementFlipped = false;
          if (window.gameRenderer) {
            window.gameRenderer.activeView = 'town';
            window.gameRenderer.pendingPlacement = bKey;
            window.gameRenderer.pendingPlacementFlipped = false;
          }
          const rotationControl = document.getElementById('rotation-control');
          if (rotationControl) rotationControl.style.display = 'flex';
          document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
          alert('Escolha um espaco livre no mapa para posicionar a construcao.');
          return;
        }

        const result = game.town.upgradeBuilding(bKey);
        if (result.success) {
          game.addFloater({ x: 200, y: 150, text: 'Evoluido!', color: '#3aff7d' });
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

  // Atualiza título da seção de receitas e botão de limpar filtro
  const header = document.querySelector('.recipes-column h3');
  if (header) {
    if (activeRecipeFilter === 'all') {
      header.innerText = 'Receitas de Equipamentos & Consumíveis';
    } else {
      const bConfig = BUILDINGS_CONFIG[activeRecipeFilter];
      const name = bConfig ? bConfig.name : activeRecipeFilter;
      header.innerHTML = `Receitas de ${name} <button id="clear-craft-filter-btn" class="action-btn-retro" style="font-size: 8px; padding: 2px 4px; margin-left: 8px;">Ver Todas</button>`;
      
      const clearBtn = document.getElementById('clear-craft-filter-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          activeRecipeFilter = 'all';
          setupCraftingButtons(game);
        });
      }
    }
  }

  craftContainer.innerHTML = '';

  for (const recipeKey in CRAFT_RECIPES) {
    const recipe = CRAFT_RECIPES[recipeKey];
    const isEquip = recipe.stats !== undefined;

    // Filter out locked equipment slots (helmet, ring, necklace, belt, pants, wings, pet, etc.)
    if (isEquip && !['weapon', 'armor', 'gloves', 'boots'].includes(recipe.slot)) {
      continue;
    }

    // Filtragem por prédio
    if (activeRecipeFilter !== 'all') {
      if (activeRecipeFilter === 'forge') {
        if (!isEquip) continue;
      } else {
        if (isEquip || recipe.building !== activeRecipeFilter) continue;
      }
    }

    const resultItem = isEquip ? recipe : ITEMS_INFO[recipe.result];
    if (!resultItem) continue;

    const card = document.createElement('div');
    card.className = `recipe-card ${isEquip ? 'recipe-equip' : 'recipe-consumable'}`;

    let canCraft = true;
    let craftReason = "";
    const buildingKey = recipe.building || 'forge';
    if (!game.town.isBuilt(buildingKey)) {
      canCraft = false;
      craftReason = `Requer ${BUILDINGS_CONFIG[buildingKey]?.name}`;
    } else {
      // Check building level tier requirement
      let recipeTier = 1;
      if (isEquip) {
        recipeTier = recipe.tier || 1;
      } else {
        if (recipeKey.endsWith('_t3')) recipeTier = 3;
        else if (recipeKey.endsWith('_t2')) recipeTier = 2;
      }

      const bLevel = game.town.buildings[buildingKey] || 0;
      if (bLevel < recipeTier) {
        canCraft = false;
        craftReason = `Requer Nív. ${recipeTier}`;
      }
    }

    if (canCraft) {
      for (const res in recipe.cost) {
        const required = recipe.cost[res];
        const owned = res === 'gold' ? game.town.gold : game.town.resources[res] || 0;
        if (owned < required) {
          canCraft = false;
          break;
        }
      }
    }

    // Montar custos
    const costs = [];
    for (const res in recipe.cost) {
      const icon = res === 'gold' ? '🪙' : ITEMS_INFO[res]?.icon || '📦';
      const required = recipe.cost[res];
      const owned = res === 'gold' ? game.town.gold : game.town.resources[res] || 0;
      const isEnough = owned >= required;
      
      costs.push(`<span class="cost-item ${isEnough ? 'enough' : 'not-enough'}">${icon} ${required} (${owned})</span>`);
    }

    let targetText = '';
    if (isEquip) {
      const classesFormatted = recipe.class.map(c => HERO_CLASSES[c]?.name || c).join(', ');
      targetText = `<p class="recipe-target">Uso: <strong>${classesFormatted}</strong> (Grau ${recipe.tier}) ${craftReason ? `<span style="color:#ff3d3d;">(${craftReason})</span>` : ''}</p>
                    <p class="recipe-stats">Efeitos: +${recipe.stats.atk ? `${recipe.stats.atk} Atk` : ''} ${recipe.stats.hp ? `+${recipe.stats.hp} HP` : ''} ${recipe.stats.def ? `+${recipe.stats.def} Def` : ''}</p>`;
    } else {
      const sourceBuildingName = BUILDINGS_CONFIG[recipe.building]?.name || recipe.building;
      targetText = `<p class="recipe-target">Prédio: <strong>${sourceBuildingName}</strong> ${craftReason ? `<span style="color:#ff3d3d;">(${craftReason})</span>` : ''}</p>
                    <p class="recipe-desc">${resultItem.desc || ''}</p>`;
    }

    const btnDisabled = !canCraft;

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
      <button class="craft-btn action-btn-retro ${btnDisabled ? 'disabled' : ''}" data-recipe="${recipeKey}" ${btnDisabled ? 'disabled' : ''}>
        Fabricar
      </button>
    `;

    const btn = card.querySelector('.craft-btn');
    if (btn && canCraft) {
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
  // 0. Controlar visibilidade e sincronizar o seletor de nível dos monstros
  const activeView = window.gameRenderer ? window.gameRenderer.activeView : 'town';
  const monsterLevelBtn = document.getElementById('monster-level-btn');
  if (monsterLevelBtn) {
    if (activeView === 'hunt') {
      monsterLevelBtn.style.display = 'flex';
      
      const lvl = game.spawner.monsterLevel || 2;
      const difficultyNames = {
        1: 'Fácil',
        2: 'Normal',
        3: 'Difícil',
        4: 'Pesadelo'
      };
      const name = difficultyNames[lvl] || 'Normal';
      const levelNameEl = document.getElementById('current-monster-level-name');
      if (levelNameEl && levelNameEl.innerText !== `${name} (Lvl ${lvl})`) {
        levelNameEl.innerText = `${name} (Lvl ${lvl})`;
      }
    } else {
      monsterLevelBtn.style.display = 'none';
    }
  }

  // 1. Atualizar Recursos Globais da Cidade na Barra Superior
  const goldEl = document.getElementById('town-gold');
  if (goldEl) goldEl.innerText = game.town.gold;

  // Atualizar vagas de heróis no topo minimalista
  const heroesCountEl = document.getElementById('town-heroes-count');
  if (heroesCountEl) {
    const maxHeroes = game.town.getMaxHeroes();
    heroesCountEl.innerText = `${game.heroes.length} / ${maxHeroes}`;
  }

  // Detectar mudança de estado para re-renderização suave
  const currentTownStateKey = JSON.stringify({
    gold: game.town.gold,
    buildings: game.town.buildings,
    resources: game.town.resources
  });
  const stateChanged = currentTownStateKey !== lastTownStateKey;
  if (stateChanged) {
    lastTownStateKey = currentTownStateKey;
    // Atualizar Armazém de Recursos da Prefeitura
    updateTownInventory(game);
  }

  // Re-renderização dos modais em tempo real caso estejam ativos
  const townModal = document.getElementById('town-modal');
  const townActive = townModal && townModal.classList.contains('active');
  if (townActive) {
    if (stateChanged || !wasTownModalActive) {
      renderBuildings(game);
    }
  }
  wasTownModalActive = townActive;

  const craftModal = document.getElementById('craft-modal');
  const craftActive = craftModal && craftModal.classList.contains('active');
  if (craftActive) {
    if (stateChanged || !wasCraftModalActive) {
      setupCraftingButtons(game);
    }
  }
  wasCraftModalActive = craftActive;

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
  const maxHeroesForHiring = game.town.getMaxHeroes();
  const countHeroes = game.heroes.length;
  const hireBtnContainer = document.getElementById('hiring-cost-display');
  if (hireBtnContainer) {
    const cost = game.getHiringCost();
    hireBtnContainer.innerHTML = `Vagas: <strong>${countHeroes} / ${maxHeroesForHiring}</strong>. Custo do próximo herói: 🪙 <strong>${cost} Ouro</strong>`;
  }

  // Atualizar modal de perfil em tempo real se aberto
  const profileModal = document.getElementById('hero-profile-modal');
  if (profileModal && profileModal.classList.contains('active') && activeProfileHero) {
    refreshHeroProfile(activeProfileHero, game);
  }
}

// Injeta dinamicamente os materiais e provisões no baú do modal prefeitura
function updateTownInventory(game) {
  const gridEl = document.getElementById('town-inventory-grid');
  if (!gridEl) return;

  gridEl.innerHTML = '';

  for (const key in game.town.resources) {
    const qty = game.town.resources[key];
    const info = ITEMS_INFO[key] || CRAFT_RECIPES[key];
    if (info && qty > 0) {
      let rarity = 'common';
      if (info.rarity) {
        rarity = info.rarity;
      } else if (info.stats) {
        if (info.name.includes('Saci') || info.name.includes('Mula') || info.name.includes('Curupira') || info.name.includes('Boitatá') || info.name.includes('Mapinguari')) {
          rarity = 'legendary';
        } else if (info.tier === 3) {
          rarity = 'rare';
        } else if (info.tier === 2) {
          rarity = 'uncommon';
        }
      }

      const card = document.createElement('div');
      card.className = `inventory-item-card item-rarity-${rarity}`;
      card.title = `${info.name} (Origem: ${info.source || 'Cidade'})`;
      card.innerHTML = `
        <span class="inv-icon">${info.icon || '📦'}</span>
        <span class="inv-name">${info.name}</span>
        <span class="inv-qty-badge">${qty}</span>
      `;
      gridEl.appendChild(card);
    }
  }
}

// Abre a ficha detalhada do caçador
export function openHeroProfile(hero, game) {
  const modal = document.getElementById('hero-profile-modal');
  if (!modal) return;

  activeProfileHero = hero;
  activeProfileTab = 'stats';

  // Configura aba ativa visualmente
  const tabBtns = modal.querySelectorAll('.profile-tab-btn');
  tabBtns.forEach(btn => {
    if (btn.getAttribute('data-tab') === 'stats') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Nome do Herói
  const nameEl = document.getElementById('profile-hero-name');
  if (nameEl) nameEl.innerText = hero.name;

  // Botão de Trava de Perfil (Apenas cosmético)
  const lockBtn = modal.querySelector('.lock-profile-btn');
  if (lockBtn) {
    let isLocked = false;
    lockBtn.onclick = () => {
      isLocked = !isLocked;
      lockBtn.innerText = isLocked ? 'ðŸ”’' : 'ðŸ”“';
    };
  }

  // Abrir o modal
  modal.classList.add('active');

  // Atualização inicial imediata
  refreshHeroProfile(hero, game);
}

// Atualiza o modal de perfil com dados dinâmicos do caçador
function refreshHeroProfile(hero, game) {
  // Ouro Individual
  const goldEl = document.getElementById('profile-hero-gold');
  if (goldEl) goldEl.innerText = Math.round(hero.gold).toLocaleString();

  // Barra de EXP
  const expFill = document.getElementById('profile-exp-fill');
  const expText = document.getElementById('profile-exp-text');
  if (expFill && expText) {
    const pct = (hero.xp / hero.xpNeeded) * 100;
    expFill.style.width = `${pct}%`;
    expText.innerText = `EXP ${Math.round(hero.xp)} / ${hero.xpNeeded}`;
  }

  // Renderização dos 8 slots de equipamento
  const slots = [
    'helmet', 'necklace', 'armor', 'weapon', 'gloves',
    'ring', 'belt', 'boots'
  ];

  slots.forEach(slot => {
    const slotEl = document.querySelector(`.slot-${slot.replace('_', '-')}`);
    if (slotEl) {
      const isLocked = !['weapon', 'armor', 'gloves', 'boots'].includes(slot);
      const item = hero.equipment[slot];

      if (isLocked) {
        slotEl.className = `equip-slot slot-${slot.replace('_', '-')} slot-locked`;
        slotEl.innerHTML = `<span class="slot-placeholder">🔒</span>`;
        const slotNamesPt = {
          helmet: 'Elmo',
          necklace: 'Colar',
          ring: 'Anel',
          belt: 'Cinturão'
        };
        const slotName = slotNamesPt[slot] || slot.toUpperCase();
        slotEl.title = `${slotName} (Desenvolvimento Futuro)`;
      } else if (item) {
        let rarity = 'common';
        if (item.rarity) {
          rarity = item.rarity;
        } else if (item.stats) {
          if (item.name.includes('Saci') || item.name.includes('Mula') || item.name.includes('Curupira') || item.name.includes('Boitatá') || item.name.includes('Mapinguari')) {
            rarity = 'legendary';
          } else if (item.tier === 3) {
            rarity = 'rare';
          } else if (item.tier === 2) {
            rarity = 'uncommon';
          }
        }

        slotEl.className = `equip-slot slot-${slot.replace('_', '-')} equipped item-rarity-${rarity}`;
        const starsCount = Math.min(5, item.tier + 2);
        const starsHtml = '<span>✦</span>'.repeat(starsCount);

        slotEl.innerHTML = `
          <span class="slot-placeholder">${item.icon || '⚔️'}</span>
          <div class="slot-stars">${starsHtml}</div>
        `;
        slotEl.title = `${item.name} (Grau ${item.tier})`;
      } else {
        slotEl.className = `equip-slot slot-${slot.replace('_', '-')}`;
        
        const placeholders = {
          helmet: '🪖', necklace: '📿', armor: '🧥', weapon: '⚔️', gloves: '🧤',
          ring: '💍', belt: '🥋', boots: '🥾'
        };
        slotEl.innerHTML = `<span class="slot-placeholder">${placeholders[slot]}</span>`;
        const slotNamesPt = {
          helmet: 'Elmo',
          necklace: 'Colar',
          armor: 'Armadura',
          weapon: 'Arma',
          gloves: 'Luvas',
          ring: 'Anel',
          belt: 'Cinturão',
          boots: 'Botas'
        };
        const slotName = slotNamesPt[slot] || slot.toUpperCase();
        slotEl.title = `Slot Vazio: ${slotName}`;
      }
    }
  });

  // Atualizar painel de conteúdo da aba selecionada
  const panel = document.querySelector('.profile-stats-panel');
  if (panel) {
    if (activeProfileTab === 'stats') {
      panel.innerHTML = `
        <div class="profile-needs-col">
          <div class="profile-need-bar hp-bar" title="Vida (HP)">
            <div class="fill" style="width: ${(hero.hp / hero.maxHp) * 100}%"></div>
            <span>HP ${Math.round(hero.hp)}/${hero.maxHp}</span>
          </div>
          <div class="profile-need-bar hunger-bar" title="Fome (Satiety)">
            <div class="fill" style="width: ${hero.hunger}%"></div>
            <span>Fome ${Math.round(hero.hunger)}/100</span>
          </div>
          <div class="profile-need-bar mood-bar" title="Humor (Mood)">
            <div class="fill" style="width: ${hero.mood}%"></div>
            <span>Humor ${Math.round(hero.mood)}/100</span>
          </div>
          <div class="profile-need-bar energy-bar" title="Energia (Stamina)">
            <div class="fill" style="width: ${hero.energy}%"></div>
            <span>Energia ${Math.round(hero.energy)}/100</span>
          </div>
        </div>
        <div class="profile-combat-col">
          <div class="combat-stat-line">
            <span class="label">⚔️ ATK</span>
            <span class="value">${hero.atk}</span>
          </div>
          <div class="combat-stat-line">
            <span class="label">ðŸ›¡ï¸ DEF</span>
            <span class="value">${hero.def}</span>
          </div>
          <div class="combat-stat-line">
            <span class="label">ðŸ’¥ CRIT</span>
            <span class="value">${hero.className === 'ARCHER' ? '30%' : '8%'}</span>
          </div>
          <div class="combat-stat-line">
            <span class="label">⚡ ATK SPD</span>
            <span class="value">${hero.spd.toFixed(2)}/s</span>
          </div>
          <div class="combat-stat-line">
            <span class="label">ðŸ‘¤ Evasion</span>
            <span class="value">${hero.className === 'MERCENARY' ? '15%' : '5%'}</span>
          </div>
        </div>
      `;
    } else if (activeProfileTab === 'skills') {
      const skillsHtml = hero.classConfig.skills.map(s => `
        <div class="profile-skill-row" style="margin-bottom: 6px;">
          <strong style="color: #ff9f3a; font-size: 13px;">${s.name}</strong> <span style="color: #a08c80; font-size: 11px;">(cd: ${s.cd}s)</span>
          <p style="color: #e2e8f0; font-size: 11px; margin-top: 1px;">${s.desc}</p>
        </div>
      `).join('');
      panel.innerHTML = `
        <div style="width: 100%; display: flex; flex-direction: column; overflow-y: auto; max-height: 120px; text-align: left; padding: 4px;">
          ${skillsHtml}
        </div>
      `;
    } else if (activeProfileTab === 'traits') {
      panel.innerHTML = `
        <div style="width: 100%; text-align: left; font-size: 13px; font-family: var(--font-retro); display: flex; flex-direction: column; gap: 4px; padding: 4px;">
          <div><span style="color: #a08c80;">Classe:</span> <strong style="color: ${hero.classConfig.color};">${hero.classConfig.name}</strong></div>
          <div><span style="color: #a08c80;">Pele:</span> <span style="display: inline-block; width: 10px; height: 10px; background-color: ${hero.cosmetics.skinColor}; border: 1px solid #000; vertical-align: middle;"></span> ${hero.cosmetics.skinColor}</div>
          <div><span style="color: #a08c80;">Cabelo:</span> <span style="display: inline-block; width: 10px; height: 10px; background-color: ${hero.cosmetics.hairColor}; border: 1px solid #000; vertical-align: middle;"></span> ${hero.cosmetics.hairColor} (${hero.cosmetics.hairStyle})</div>
          <div><span style="color: #a08c80;">Túnica:</span> <span style="display: inline-block; width: 10px; height: 10px; background-color: ${hero.cosmetics.clothesColor}; border: 1px solid #000; vertical-align: middle;"></span> ${hero.cosmetics.clothesColor}</div>
          <div><span style="color: #a08c80;">Status:</span> <span style="color: #3aff7d;">${formatHeroState(hero.state)}</span></div>
        </div>
      `;
    } else if (activeProfileTab === 'inventory') {
      const invItems = [];
      for (const key in hero.inventory) {
        if (hero.inventory[key] > 0) {
          const info = ITEMS_INFO[key] || CRAFT_RECIPES[key];
          let rarity = 'common';
          if (info) {
            if (info.rarity) {
              rarity = info.rarity;
            } else if (info.stats) {
              if (info.name.includes('Saci') || info.name.includes('Mula') || info.name.includes('Curupira') || info.name.includes('Boitatá') || info.name.includes('Mapinguari')) {
                rarity = 'legendary';
              } else if (info.tier === 3) {
                rarity = 'rare';
              } else if (info.tier === 2) {
                rarity = 'uncommon';
              }
            }
          }
          const icon = info?.icon || '📦';
          const name = info?.name || key;
          invItems.push(`<span class="item-rarity-${rarity}" style="padding: 2px 5px; border-radius: 2px; display: inline-block; margin: 2px;">${icon} ${name} x${hero.inventory[key]}</span>`);
        }
      }
      const invHtml = invItems.length > 0 ? invItems.join(' ') : '<span style="color: #a08c80;">Mochila vazia</span>';
      const logsHtml = hero.logs.map(log => `<li style="font-family: monospace; font-size: 9.5px; color: #8892b0; margin-bottom: 2px; list-style: none;">&gt; ${log}</li>`).join('');

      panel.innerHTML = `
        <div style="width: 100%; display: flex; flex-direction: column; text-align: left; font-family: var(--font-retro); font-size: 12px; gap: 6px; overflow-y: auto; max-height: 120px; padding: 4px;">
          <div>
            <strong style="color: #ff9f3a;">Inventário do Herói:</strong>
            <div style="margin-top: 3px;">${invHtml}</div>
          </div>
          <div style="border-top: 1px solid #3d2b1f; padding-top: 4px;">
            <strong style="color: #ff9f3a;">Atividades:</strong>
            <ul style="padding: 0; margin: 3px 0 0 0;">${logsHtml}</ul>
          </div>
        </div>
      `;
    }
  }

  // Desenhar avatar no Canvas
  drawHeroOnProfileCanvas(hero);
}

// Desenha o sprite ampliado e nítido do herói no canvas da ficha de perfil
function drawHeroOnProfileCanvas(hero) {
  const canvas = document.getElementById('hero-profile-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const scale = 5;
  ctx.scale(scale, scale);
  
  const hx = (canvas.width / 2) / scale;
  const hy = ((canvas.height / 2) / scale) + 2; 
  const step = 0; // standing still

  // Sombra
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(hx, hy + 11, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 1. Pernas
  ctx.fillStyle = hero.cosmetics.skinColor;
  ctx.fillRect(hx - 3.5, hy + 5, 2, 6);
  ctx.fillRect(hx + 1.5, hy + 5, 2, 6);
  
  let bootsColor = '#4a2c11';
  if (hero.equipment.boots) {
    bootsColor = '#1a1a1a'; // Ex: botas escuras
  }
  ctx.fillStyle = bootsColor;
  ctx.fillRect(hx - 4.5, hy + 10, 3, 1.5);
  ctx.fillRect(hx + 0.5, hy + 10, 3, 1.5);

  // 2. Corpo
  let bodyColor = hero.cosmetics.clothesColor;
  let isLendaria = false;

  if (hero.equipment.armor) {
    const tier = hero.equipment.armor.tier;
    if (tier === 1) {
      bodyColor = hero.className === 'WARRIOR' ? '#818b96' : '#634731';
    } else if (tier === 2) {
      bodyColor = '#4e5a66';
    } else if (tier === 3) {
      bodyColor = (hero.equipment.armor.key && hero.equipment.armor.key.includes('mapinguari')) ? '#ab5522' : '#cca93d';
      isLendaria = true;
    }
  }

  ctx.fillStyle = bodyColor;
  ctx.fillRect(hx - 5, hy - 4, 10, 10); 

  if (isLendaria) {
    ctx.strokeStyle = '#ffea3a';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(hx - 5.5, hy - 4.5, 11, 11);
  }

  // Guerreiro Escudo
  if (hero.className === 'WARRIOR' && !isLendaria) {
    ctx.fillStyle = '#656e78';
    ctx.strokeStyle = '#32373c';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(hx - 4, hy + 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Cinto
  ctx.fillStyle = '#261c11';
  ctx.fillRect(hx - 5, hy + 3, 10, 1.5);

  // 3. Rosto
  ctx.fillStyle = hero.cosmetics.skinColor;
  ctx.fillRect(hx - 4, hy - 11, 8, 7);
  
  // Olhos
  ctx.fillStyle = '#111';
  ctx.fillRect(hx - 2, hy - 9, 1, 1.5);
  ctx.fillRect(hx + 1, hy - 9, 1, 1.5);

  // Cabelo ou Elmo
  ctx.fillStyle = hero.cosmetics.hairColor;
  const hairStyle = hero.cosmetics.hairStyle;

  if (hero.equipment.helmet) {
    ctx.fillStyle = '#8e8e8e';
    ctx.fillRect(hx - 4.5, hy - 13, 9, 3);
  } else if (hero.className === 'MAGE') {
    ctx.fillStyle = '#511b85';
    ctx.fillRect(hx - 7, hy - 12, 14, 2); 
    ctx.beginPath(); 
    ctx.moveTo(hx - 4, hy - 12);
    ctx.lineTo(hx + 4, hy - 12);
    ctx.lineTo(hx, hy - 20);
    ctx.closePath();
    ctx.fill();
  } else if (hero.className === 'WARRIOR') {
    ctx.fillStyle = '#818b96';
    ctx.fillRect(hx - 4.5, hy - 13, 9, 3); 
    ctx.fillStyle = '#ff3d3d'; 
    ctx.fillRect(hx - 1, hy - 16, 3, 3);
  } else {
    if (hairStyle === 'short') {
      ctx.fillRect(hx - 4.5, hy - 12.5, 9, 2);
      ctx.fillRect(hx - 4.5, hy - 11, 1.5, 4);
      ctx.fillRect(hx + 3, hy - 11, 1.5, 4);
    } else if (hairStyle === 'long') {
      ctx.fillRect(hx - 4.5, hy - 12.5, 9, 2);
      ctx.fillRect(hx - 4.5, hy - 11, 1.5, 9);
      ctx.fillRect(hx + 3, hy - 11, 1.5, 9);
    } else if (hairStyle === 'spiky') {
      ctx.fillRect(hx - 4, hy - 12.5, 8, 2);
      ctx.fillRect(hx - 3, hy - 14.5, 1.5, 2);
      ctx.fillRect(hx + 1.5, hy - 14.5, 1.5, 2);
    }
  }

  // Priests halo
  if (hero.className === 'PRIEST') {
    ctx.strokeStyle = '#ffea3a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(hx, hy - 14, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Asas / Wings (Cosmético se equipado!)
  if (hero.equipment.wings) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(hx - 12, hy - 6, 7, 10);
    ctx.fillRect(hx + 5, hy - 6, 7, 10);
  }

  // 4. Arma Dinâmica
  const wx = hx - 6.5;
  const wy = hy + 2;

  let weaponColor = '#bf9b30'; 

  if (hero.equipment.weapon) {
    const tier = hero.equipment.weapon.tier;
    if (tier === 1) weaponColor = '#818b96';
    if (tier === 2) weaponColor = '#4e5b66';
    if (tier === 3) weaponColor = '#ffea3a';
  }

  if (hero.equipment.weapon) {
    if (hero.className === 'ARCHER') {
      ctx.strokeStyle = weaponColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(wx, wy, 5, Math.PI/2, -Math.PI/2, true);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(wx, wy - 5);
      ctx.lineTo(wx, wy + 5);
      ctx.stroke();
    } else if (hero.className === 'MAGE' || hero.className === 'PRIEST') {
      ctx.fillStyle = '#6b4724';
      ctx.fillRect(wx + 1, wy - 8, 1.5, 12);
      ctx.fillStyle = hero.className === 'PRIEST' ? '#ffea3a' : '#c23aff';
      ctx.fillRect(wx, wy - 11, 3.5, 3.5);
    } else {
      ctx.fillStyle = weaponColor;
      ctx.fillRect(wx + 1, wy - 8, 1.5, 10);
      ctx.fillStyle = '#4a2c11';
      ctx.fillRect(wx - 1, wy - 1, 5.5, 1.5);
      ctx.fillRect(wx + 1, wy + 2, 1.5, 2);
    }
  } else {
    ctx.fillStyle = hero.cosmetics.skinColor;
    ctx.fillRect(wx, wy, 2, 2.5);
  }

  ctx.restore();
}

// Renderiza a lista de heróis simplificada (clicar abre a ficha detalhada)
function updateHeroesTab(game) {
  const listEl = document.getElementById('heroes-list-container');
  if (!listEl) return;

  listEl.innerHTML = '';

  game.heroes.forEach(hero => {
    const card = document.createElement('div');
    card.className = `hero-row-card`;
    
    const hpPct = (hero.hp / hero.maxHp) * 100;
    const hungerPct = hero.hunger;
    const energyPct = hero.energy;

    card.innerHTML = `
      <div class="hero-summary-line" style="border-left: 5px solid ${hero.classConfig.color}">
        <div class="hero-name-lvl">
          <strong>${hero.name}</strong>
          <span class="hero-lvl-label">Lvl ${hero.level}</span>
        </div>
        <div class="hero-needs-bars">
          <div class="need-bar-mini" title="Vida">
            <span class="need-icon">â¤ï¸</span>
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
    `;

    // Clicar no card abre o modal detalhado
    card.addEventListener('click', () => {
      openHeroProfile(hero, game);
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
    'SELLING_LOOT': '💰 Vendendo Coletas'
  };
  return states[state] || state;
}

function openBuildTileModal(col, row, game) {
  const modal = document.getElementById('build-tile-modal');
  const optionsContainer = document.getElementById('build-tile-options');
  if (!modal || !optionsContainer) return;

  optionsContainer.innerHTML = '';

  // Lista de edifícios que podem ser construídos
  const buildables = ['townhall', 'hotel', 'restaurant', 'hospital', 'tavern', 'forge', 'market'];

  buildables.forEach(bKey => {
    const config = BUILDINGS_CONFIG[bKey];
    const isBuilt = game.town.isBuilt(bKey);

    // Se já estiver construído, não mostramos na lista (apenas um edifício de cada tipo é permitido)
    if (isBuilt) return;

    // Verificar se o jogador tem recursos suficientes
    let canAfford = true;
    let costTextList = [];
    const cost = config.cost;

    for (const resKey in cost) {
      const required = cost[resKey];
      const owned = resKey === 'gold' ? game.town.gold : (game.town.resources[resKey] || 0);
      if (owned < required) {
        canAfford = false;
        costTextList.push(`<span style="color: #ff5252;">${required} ${resKey === 'gold' ? 'Ouro' : formatResourceName(resKey)}</span>`);
      } else {
        costTextList.push(`<span style="color: #4caf50;">${required} ${resKey === 'gold' ? 'Ouro' : formatResourceName(resKey)}</span>`);
      }
    }

    const costText = costTextList.join(', ');
    const optionEl = document.createElement('div');
    optionEl.className = 'build-option-item';
    optionEl.style = 'background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;';
    
    // Ícones correspondentes
    const icons = { townhall: '🏛️', hotel: '🏨', restaurant: '🍲', hospital: '🏥', tavern: '🍺', forge: '⚒️', market: '⚖️' };
    const icon = icons[bKey] || '🏠';

    optionEl.innerHTML = `
      <div style="text-align: left; flex: 1;">
        <strong style="color: #ffd54f; font-size: 11px;">${icon} ${config.name}</strong>
        <p style="font-size: 9px; margin: 2px 0 0 0; color: #b0bec5; line-height: 1.3;">Custo: ${costText}</p>
      </div>
      <button class="action-btn-retro ${canAfford ? '' : 'disabled'}" style="padding: 4px 8px; font-size: 10px;" ${canAfford ? '' : 'disabled'}>Construir</button>
    `;

    const buildBtn = optionEl.querySelector('button');
    if (canAfford) {
      buildBtn.addEventListener('click', () => {
        const result = game.town.buildAt(bKey, col, row);
        if (result.success) {
          modal.classList.remove('active');
          game.addFloater({ 
            x: window.gameRenderer.canvas.width / 2, 
            y: window.gameRenderer.canvas.height / 2 - 50, 
            text: 'Construído!', 
            color: '#3aff7d' 
          });
          game.saveGame();
          renderBuildings(game);
        } else {
          alert(result.reason || 'Erro ao construir.');
        }
      });
    }

    optionsContainer.appendChild(optionEl);
  });

  if (optionsContainer.children.length === 0) {
    optionsContainer.innerHTML = `<div style="color: #a08c80; font-size: 11px; text-align: center; padding: 10px;">Todos os edifícios já foram construídos na cidade!</div>`;
  }

  modal.classList.add('active');
}

function formatResourceName(res) {
  const names = {
    wood_rough: 'Mad. Bruta',
    iron_ore: 'Min. Ferro',
    steel_ore: 'Min. Aço',
    herbs_wild: 'Ervas',
    linho: 'Linho',
    meat_raw: 'Carne Crua'
  };
  return names[res] || res;
}


