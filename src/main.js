import { Game }                        from './core/game.js';
import { GameRenderer }               from './ui/renderer.js?v=2';
import { setupUI, updateUI }          from './ui/menus.js?v=heroes-lpc-restore-1';
import { onAuth, logout }             from './core/auth.js';
import { loadFromCloud, saveToCloud,
         migrateLocalToCloud }        from './core/cloudSave.js';
import { showLoginScreen,
         hideLoginScreen }            from './ui/loginScreen.js';

let booted = false;

// ─── Frases de sabor (humor) para a tela de login ────────────────────────────

const FLAVOR_TEXTS = [
  '"Liderança é saber quem mandar lutar no seu lugar."',
  '"Nossos heróis nunca descansam. Porque você não deixa."',
  '"RPG idle: porque você é ocupado demais para jogar."',
  '"Os monstros têm medo dos nossos heróis. Dos nossos jogadores, nem tanto."',
  '"Salvar o mundo em segundo plano desde 2024."',
  '"Aviso: Este jogo pode causar produtividade acidental."',
  '"Seus heróis estão trabalhando. Você está logando. Perfeito."',
];

// ─── Tela de Login ────────────────────────────────────────────────────────────

function initLoginScreen() {
  const flavorEl = document.getElementById('login-flavor-text');
  if (flavorEl) {
    flavorEl.textContent = FLAVOR_TEXTS[Math.floor(Math.random() * FLAVOR_TEXTS.length)];
  }

  // Observa estado de autenticação
  onAuth(async (user) => {
    if (user) {
      await bootGame(user);
    } else {
      showLoginScreen(async (loggedUser) => {
        await bootGame(loggedUser);
      });
    }
  });
}

// ─── Boot do Jogo ─────────────────────────────────────────────────────────────

async function bootGame(user) {
  if (booted) return;
  booted = true;

  // Migra save local para a nuvem se for a primeira vez
  await migrateLocalToCloud(user.uid);

  // Carrega save da nuvem
  const cloudData = await loadFromCloud(user.uid);

  const game     = new Game();
  const renderer = new GameRenderer('game-canvas');
  window.game         = game;
  window.gameRenderer = renderer;
  window.currentUser  = user;
  renderer._addFloater = game.addFloater.bind(game);

  // Injeta save da nuvem antes do init
  if (cloudData) {
    game._pendingCloudSave = cloudData;
  }

  game.init();

  hideLoginScreen();
  _addUserBadge(user);

  function resizeCanvasToContainer() {
    const canvas    = renderer.canvas;
    const container = canvas.parentElement;
    if (!container) return;
    const rect      = container.getBoundingClientRect();
    const dpr       = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth  = Math.max(360, Math.floor(rect.width  * dpr));
    const nextHeight = Math.max(360, Math.floor(rect.height * dpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width  = nextWidth;
      canvas.height = nextHeight;
      renderer.ctx.imageSmoothingEnabled = false;
    }
  }

  resizeCanvasToContainer();
  window.addEventListener('resize', resizeCanvasToContainer);
  if ('ResizeObserver' in window && renderer.canvas.parentElement) {
    new ResizeObserver(resizeCanvasToContainer).observe(renderer.canvas.parentElement);
  }

  setupUI(game);

  const speedButtons = { 'speed-1x': 1.0, 'speed-2x': 2.0, 'speed-3x': 4.0 };
  for (const btnId in speedButtons) {
    const btn = document.getElementById(btnId);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      Object.keys(speedButtons).forEach(id => document.getElementById(id)?.classList.remove('active'));
      btn.classList.add('active');
      game.speed = speedButtons[btnId];
      game.addFloater({ x: 400, y: 30, text: `Velocidade: ${game.speed}x`, color: '#ffea3a', time: 0.7 });
    });
  }

  let lastTime      = performance.now();
  let uiUpdateTimer = 0;
  let autoSaveTimer = 0;

  function gameLoop(currentTime) {
    let dt = (currentTime - lastTime) / 1000;
    if (dt > 1.5) dt = 1.5;
    lastTime = currentTime;

    try {
      resizeCanvasToContainer();
      game.update(dt, { width: renderer.canvas.width, height: renderer.canvas.height });
      renderer.render(game, dt);

      uiUpdateTimer += dt;
      if (uiUpdateTimer >= 0.15) {
        updateUI(game);
        uiUpdateTimer = 0;
      }

      autoSaveTimer += dt;
      if (autoSaveTimer >= 6.0) {
        game.saveGame();
        autoSaveTimer = 0;
      }
    } catch (err) {
      console.error('[GameLoop Error]', err);
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

// ─── Badge de usuário logado (canto superior) ─────────────────────────────────

function _addUserBadge(user) {
  const header = document.querySelector('.town-header');
  if (!header) return;

  const badge = document.createElement('div');
  badge.className = 'user-badge';
  badge.innerHTML = `
    <img class="user-avatar" src="${user.photoURL || ''}" onerror="this.style.display='none'" alt="">
    <span class="user-name">${user.displayName || user.email || 'Aventureiro'}</span>
    <button class="user-logout-btn" id="btn-logout" title="Sair">↩</button>
  `;
  header.appendChild(badge);

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    if (confirm('Sair da conta? Seus heróis vão sentir sua falta. (Mentira.)')) {
      await logout();
      booted = false;
      window.location.reload();
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initLoginScreen, { once: true });
} else {
  initLoginScreen();
}
