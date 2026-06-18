import { Game } from './core/game.js';
import { GameRenderer } from './ui/renderer.js';
import { setupUI, updateUI } from './ui/menus.js';

let booted = false;

function bootGame() {
  if (booted) return;
  booted = true;

  const game = new Game();
  const renderer = new GameRenderer('game-canvas');
  window.game = game;
  window.gameRenderer = renderer;

  function resizeCanvasToContainer() {
    const canvas = renderer.canvas;
    const container = canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(360, Math.floor(rect.width * dpr));
    const nextHeight = Math.max(360, Math.floor(rect.height * dpr));

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
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

  const speedButtons = {
    'speed-1x': 1.0,
    'speed-2x': 2.0,
    'speed-3x': 4.0
  };

  for (const btnId in speedButtons) {
    const btn = document.getElementById(btnId);
    if (!btn) continue;

    btn.addEventListener('click', () => {
      Object.keys(speedButtons).forEach(id => {
        document.getElementById(id)?.classList.remove('active');
      });

      btn.classList.add('active');
      game.speed = speedButtons[btnId];
      game.addFloater({ x: 400, y: 30, text: `Velocidade: ${game.speed}x`, color: '#ffea3a', time: 0.7 });
    });
  }

  let lastTime = performance.now();
  let uiUpdateTimer = 0;
  let autoSaveTimer = 0;

  function gameLoop(currentTime) {
    let dt = (currentTime - lastTime) / 1000;
    if (dt > 1.5) dt = 1.5;
    lastTime = currentTime;

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

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootGame, { once: true });
} else {
  bootGame();
}
