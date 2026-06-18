import { Game } from './core/game.js';
import { GameRenderer } from './ui/renderer.js';
import { setupUI, updateUI } from './ui/menus.js';

window.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar as instâncias principais
  const game = new Game();
  const renderer = new GameRenderer('game-canvas');

  // 2. Configurar os cliques e eventos da UI
  setupUI(game);

  // 3. Controles adicionais da UI de Velocidade do Jogo
  const speedButtons = {
    'speed-1x': 1.0,
    'speed-2x': 2.0,
    'speed-3x': 4.0
  };

  for (const btnId in speedButtons) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        // Remover classe ativa dos outros
        Object.keys(speedButtons).forEach(id => {
          document.getElementById(id)?.classList.remove('active');
        });
        
        // Adicionar ativo a este
        btn.classList.add('active');
        
        // Definir velocidade no game
        game.speed = speedButtons[btnId];
        game.addFloater({ x: 400, y: 30, text: `Velocidade: ${game.speed}x`, color: '#ffea3a', time: 0.7 });
      });
    }
  }

  // 4. Configurar Loops de Game, Renderização e Salvamento Automático
  let lastTime = performance.now();
  let uiUpdateTimer = 0;
  let autoSaveTimer = 0;

  function gameLoop(currentTime) {
    // Calcular delta time em segundos
    let dt = (currentTime - lastTime) / 1000;
    
    // Evitar saltos gigantescos se o jogador alternar abas
    if (dt > 1.5) dt = 1.5;
    
    lastTime = currentTime;

    // Atualizar lógica do Jogo
    game.update(dt);

    // Renderizar Canvas 2D
    renderer.render(game, dt);

    // Atualizar UI de Texto (DOM) a cada 0.15 segundos para performance suave
    uiUpdateTimer += dt;
    if (uiUpdateTimer >= 0.15) {
      updateUI(game);
      uiUpdateTimer = 0;
    }

    // Auto-salvamento a cada 6 segundos
    autoSaveTimer += dt;
    if (autoSaveTimer >= 6.0) {
      game.saveGame();
      autoSaveTimer = 0;
    }

    requestAnimationFrame(gameLoop);
  }

  // Iniciar Loop
  requestAnimationFrame(gameLoop);
});
