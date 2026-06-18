import { HERO_CLASSES, BIOMES, ITEMS_INFO } from '../data/constants.js';

export class GameRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas com ID ${canvasId} não encontrado!`);
    }
    this.ctx = this.canvas.getContext('2d');

    // Desabilitar suavização para garantir visual de pixels nítido
    this.ctx.imageSmoothingEnabled = false;

    // Ciclo de dia e noite
    this.dayNightCycle = 0;

    // Lista de partículas de fumaça das chaminés
    this.smokeParticles = [];
  }

  render(game, dt) {
    // Atualiza ciclo dia/noite
    this.dayNightCycle = (this.dayNightCycle + dt) % 90;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Limpar tela
    this.ctx.clearRect(0, 0, width, height);

    // 1. Desenhar Cenários Base
    this.drawTerrain(game, width, height);

    // 2. Atualizar e Desenhar Partículas de Fumaça
    this.updateAndDrawSmoke(game.town, dt);

    // 3. Desenhar Edifícios
    this.drawBuildings(game.town);

    // 4. Desenhar Monstros com Visual Pixel-Art
    this.drawMonsters(game.spawner.activeMonsters);

    // 5. Desenhar Heróis (Com Customização, Equipamento Dinâmico e Dashs)
    this.drawHeroes(game.heroes);

    // 6. Desenhar Efeitos de Batalha
    this.drawCombatEffects(game.heroes);

    // 7. Desenhar Filtro de Dia/Noite
    this.drawDayNightFilter(width, height);

    // 8. Desenhar Textos Flutuantes
    this.drawFloaters(game.floaters);
  }

  drawTerrain(game, w, h) {
    const biome = game.spawner.getBiomeConfig();
    const time = performance.now();

    // Cidade (Grama)
    this.ctx.fillStyle = '#395c2f';
    this.ctx.fillRect(0, 0, 470, h);

    // Floresta (Varia com o bioma)
    let forestColor = '#243b23';
    if (biome.id === 0) forestColor = '#222326'; // Cavernas
    if (biome.id === 1) forestColor = '#102210'; // Mata Fechada
    if (biome.id === 2) forestColor = '#1b231e'; // Igarapés

    this.ctx.fillStyle = forestColor;
    this.ctx.fillRect(490, 0, w - 490, h);

    // Rio Animado (X = 470 a 490, correnteza correndo de cima para baixo)
    this.ctx.fillStyle = '#2d6ab3';
    this.ctx.fillRect(470, 0, 20, h);

    // Ondas no Rio (Correnteza animada)
    this.ctx.fillStyle = '#5c99e6';
    const waveOffset = (time * 0.04) % 40;
    for (let y = -20; y < h; y += 30) {
      const wy = y + waveOffset;
      // Ondulações horizontais curtas
      this.ctx.fillRect(473, wy, 4, 3);
      this.ctx.fillRect(482, wy + 12, 5, 3);
    }

    // Ponte de madeira (X = 466 a 494, Y = 250 a 290)
    this.ctx.fillStyle = '#6e4726'; // Tábuas principais
    this.ctx.fillRect(464, 250, 32, 40);
    
    // Desenha tábuas individuais da ponte (Linhas de pixels pretos)
    this.ctx.fillStyle = '#452b16';
    for (let py = 254; py < 290; py += 6) {
      this.ctx.fillRect(464, py, 32, 1.5);
    }

    // Corrimões
    this.ctx.fillStyle = '#452b16';
    this.ctx.fillRect(464, 247, 32, 3);
    this.ctx.fillRect(464, 290, 32, 3);

    // Estradas de terra na cidade (Conectando as novas posições 960x540)
    this.ctx.fillStyle = '#826442';
    // Estrada principal norte-sul (X=220 a 240)
    this.ctx.fillRect(220, 100, 20, 350);
    // Ramificações para prédios
    this.ctx.fillRect(120, 195, 220, 15);
    this.ctx.fillRect(120, 335, 220, 15);
    // Estrada até a ponte
    this.ctx.fillRect(230, 262, 240, 15);

    // Árvores de Pixel Art detalhadas (Wow factor)
    this.drawPixelTree(530, 60);
    this.drawPixelTree(880, 80);
    this.drawPixelTree(910, 440);
    this.drawPixelTree(540, h - 80);
    this.drawPixelTree(420, 50);
    this.drawPixelTree(420, h - 90);
    this.drawPixelTree(60, 280);
  }

  drawPixelTree(x, y) {
    this.ctx.save();
    // Tronco
    this.ctx.fillStyle = '#4d3319';
    this.ctx.fillRect(x - 3, y, 6, 18);
    // Folhas em camadas pixeladas
    this.ctx.fillStyle = '#163b13';
    this.ctx.beginPath();
    this.ctx.arc(x, y - 6, 14, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#20541d';
    this.ctx.beginPath();
    this.ctx.arc(x - 4, y - 10, 9, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#2d7328';
    this.ctx.beginPath();
    this.ctx.arc(x + 3, y - 8, 7, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  // --- PARTÍCULAS DE FUMAÇA DAS CHAMINÉS ---
  updateAndDrawSmoke(town, dt) {
    const chaminers = {
      restaurant: { x: 330 + 14, y: 200 - 16 },
      hospital: { x: 130 + 14, y: 340 - 16 },
      tavern: { x: 330 + 14, y: 340 - 16 },
      forge: { x: 230 + 14, y: 450 - 16 }
    };

    // Chance de criar nova fumaça em prédios construídos
    for (const bKey in chaminers) {
      if (town.isBuilt(bKey) && Math.random() < 0.04) {
        const pos = chaminers[bKey];
        this.smokeParticles.push({
          x: pos.x + (Math.random() * 4 - 2),
          y: pos.y,
          size: 2 + Math.random() * 3,
          alpha: 0.6 + Math.random() * 0.3,
          vx: Math.random() * 6 - 3,
          vy: -20 - Math.random() * 15,
          life: 1.2 + Math.random() * 0.8
        });
      }
    }

    // Desenhar e atualizar fumaça
    this.ctx.save();
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += 1.5 * dt; // Fumaça dispersa/cresce
      p.alpha = Math.max(0, p.alpha - 0.5 * dt);

      if (p.life <= 0 || p.alpha <= 0) {
        this.smokeParticles.splice(i, 1);
        continue;
      }

      this.ctx.fillStyle = `rgba(160, 160, 160, ${p.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawBuildings(town) {
    const buildings = [
      { key: 'townhall', x: 230, y: 100, name: 'Prefeitura', icon: '🏛️' },
      { key: 'hotel', x: 130, y: 200, name: 'Hotel', icon: '🏨' },
      { key: 'restaurant', x: 330, y: 200, name: 'Restaurante', icon: '🍲' },
      { key: 'hospital', x: 130, y: 340, name: 'Hospital', icon: '🏥' },
      { key: 'tavern', x: 330, y: 340, name: 'Taverna', icon: '🍺' },
      { key: 'forge', x: 230, y: 450, name: 'Forja', icon: '⚒️' }
    ];

    buildings.forEach(b => {
      const level = town.buildings[b.key];
      const isBuilt = level > 0;

      this.ctx.save();

      if (!isBuilt) {
        this.ctx.globalAlpha = 0.45;
      }

      // Base da casa
      this.ctx.fillStyle = '#5c4530';
      this.ctx.fillRect(b.x - 22, b.y - 12, 44, 28);

      // Telhado
      this.ctx.fillStyle = isBuilt ? '#8c3523' : '#575251';
      this.ctx.beginPath();
      this.ctx.moveTo(b.x - 26, b.y - 12);
      this.ctx.lineTo(b.x + 26, b.y - 12);
      this.ctx.lineTo(b.x, b.y - 28);
      this.ctx.closePath();
      this.ctx.fill();

      // Porta
      this.ctx.fillStyle = '#2e1c0c';
      this.ctx.fillRect(b.x - 6, b.y + 6, 12, 10);

      // Chaminé (Forja, Restaurante, Hospital, Taverna)
      if (b.key !== 'townhall' && b.key !== 'hotel') {
        this.ctx.fillStyle = '#3d2e20';
        this.ctx.fillRect(b.x + 11, b.y - 18, 6, 10);
      }

      // Janelas acesas
      if (isBuilt) {
        const isNight = this.isNightTime();
        this.ctx.fillStyle = isNight ? (Math.random() > 0.05 ? '#ffea3a' : '#aa9e27') : '#2e1c0c';
        this.ctx.fillRect(b.x - 14, b.y - 4, 6, 6);
        this.ctx.fillRect(b.x + 8, b.y - 4, 6, 6);
      }

      this.ctx.font = '14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(b.icon, b.x, b.y - 32);

      this.ctx.globalAlpha = 1.0;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'center';
      
      const label = isBuilt ? `Lvl ${level}` : '🔒 Trancado';
      this.ctx.fillText(label, b.x, b.y + 24);

      this.ctx.restore();
    });
  }

  // --- RENDER MONSTROS ---
  drawMonsters(monsters) {
    monsters.forEach(monster => {
      if (monster.hp <= 0) return;

      this.ctx.save();
      const time = performance.now();

      // Sombra
      const shadowSize = monster.isBoss ? 16 : (monster.isMiniBoss ? 11 : 7);
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(monster.x, monster.y + 8, shadowSize * 1.2, shadowSize * 0.35, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Identifica criatura
      const name = monster.name;

      if (name.includes('Saci-Pererê')) {
        this.drawSaci(monster.x, monster.y, time);
      } else if (name.includes('Curupira')) {
        this.drawCurupira(monster.x, monster.y, time);
      } else if (name.includes('Mula sem Cabeça')) {
        this.drawMula(monster.x, monster.y, time);
      } else if (name.includes('Boitatá')) {
        this.drawBoitata(monster.x, monster.y, time);
      } else if (name.includes('Mapinguari')) {
        this.drawMapinguari(monster.x, monster.y, time);
      } else if (name.includes('Corpo-Seco')) {
        this.drawCorpoSeco(monster.x, monster.y);
      } else if (name.includes('Pisadeira')) {
        this.drawPisadeira(monster.x, monster.y);
      } else if (name.includes('Chibamba')) {
        this.drawChibamba(monster.x, monster.y, time);
      } else if (name.includes('Capelobo')) {
        this.drawCapelobo(monster.x, monster.y);
      } else if (name.includes('Caipora')) {
        this.drawCaipora(monster.x, monster.y);
      } else if (name.includes('Quibungo')) {
        this.drawQuibungo(monster.x, monster.y);
      } else if (name.includes('Ipupiara')) {
        this.drawIpupiara(monster.x, monster.y, time);
      } else if (name.includes('Teju')) {
        this.drawTejuJagua(monster.x, monster.y);
      } else if (name.includes('Boto')) {
        this.drawBoto(monster.x, monster.y);
      } else if (name.includes('Rato Rei')) {
        this.drawRatoRei(monster.x, monster.y);
      } else {
        this.drawGenericMonster(monster);
      }

      // Nome do Monstro
      this.ctx.fillStyle = monster.isBoss ? '#ffea3a' : '#ff9f3a';
      this.ctx.font = monster.isBoss ? 'bold 10px monospace' : '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(monster.name, monster.x, monster.y - (monster.isBoss ? 24 : 14));

      // Barra de HP
      const hpPct = monster.hp / monster.maxHp;
      const barW = monster.isBoss ? 45 : (monster.isMiniBoss ? 30 : 20);
      const barH = 3;
      
      this.ctx.fillStyle = '#2c2e33';
      this.ctx.fillRect(monster.x - barW / 2, monster.y - (monster.isBoss ? 20 : 10), barW, barH);
      this.ctx.fillStyle = '#ff3d3d';
      this.ctx.fillRect(monster.x - barW / 2, monster.y - (monster.isBoss ? 20 : 10), barW * hpPct, barH);

      this.ctx.restore();
    });
  }

  // --- DRAW MONSTER PROCEDURAL PIXELS ---
  drawSaci(x, y, time) {
    const jump = Math.abs(Math.sin(time * 0.012)) * 6;
    const py = y - jump;

    // Redemoinho de poeira cinza sob a perna dele
    this.ctx.fillStyle = 'rgba(160,160,160, 0.4)';
    const offsetWave = Math.sin(time * 0.03) * 4;
    this.ctx.fillRect(x - 5 + offsetWave, y + 5, 10, 1.5);
    this.ctx.fillRect(x - 3 - offsetWave, y + 8, 6, 1.5);

    // Gorro
    this.ctx.fillStyle = '#ff0000';
    this.ctx.beginPath();
    this.ctx.moveTo(x - 4, py - 9);
    this.ctx.lineTo(x + 4, py - 9);
    this.ctx.lineTo(x - 1, py - 16);
    this.ctx.closePath();
    this.ctx.fill();

    // Rosto marrom
    this.ctx.fillStyle = '#5c3a21';
    this.ctx.fillRect(x - 3.5, py - 9, 7, 6);
    // Olho
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x + 1, py - 7, 2, 2);
    // Cachimbo
    this.ctx.fillStyle = '#8c5835';
    this.ctx.fillRect(x + 2, py - 4, 3.5, 1.5);
    this.ctx.fillStyle = '#ff9f3a';
    this.ctx.fillRect(x + 5.5, py - 5, 1, 2);

    // Calção vermelho e perna
    this.ctx.fillStyle = '#ff0000';
    this.ctx.fillRect(x - 3.5, py - 3, 7, 6);
    this.ctx.fillStyle = '#2e1c10';
    this.ctx.fillRect(x - 1, py + 3, 2, 5);
  }

  drawCurupira(x, y, time) {
    // Cabelo de Fogo oscilando de cor (Brasas dinâmicas)
    const flameVal = Math.sin(time * 0.04) * 2;
    this.ctx.fillStyle = Math.random() > 0.4 ? '#ff5500' : '#ffaa00';
    this.ctx.fillRect(x - 6, y - 16 - flameVal, 12, 5 + flameVal);

    // Rosto
    this.ctx.fillStyle = '#ffd1a9';
    this.ctx.fillRect(x - 4, y - 11, 8, 7);
    this.ctx.fillStyle = '#3aff7d'; // Olho verde
    this.ctx.fillRect(x + 1, y - 9, 1.5, 1.5);

    // Túnica
    this.ctx.fillStyle = '#265922';
    this.ctx.fillRect(x - 5, y - 4, 10, 8);

    // Pernas e pés invertidos
    this.ctx.fillStyle = '#ffd1a9';
    this.ctx.fillRect(x - 3, y + 4, 2, 4);
    this.ctx.fillRect(x + 1, y + 4, 2, 4);

    // Pés de trás para a esquerda
    this.ctx.fillStyle = '#c99a75';
    this.ctx.fillRect(x - 6, y + 7, 4, 1.5);
    this.ctx.fillRect(x - 2, y + 7, 4, 1.5);
  }

  drawMula(x, y, time) {
    const step = Math.sin(time * 0.016) * 3;

    // Corpo cavalo
    this.ctx.fillStyle = '#4a2f1b';
    this.ctx.fillRect(x - 11, y - 2, 18, 8);

    this.ctx.fillStyle = '#2d1b0e';
    this.ctx.fillRect(x - 9, y + 6, 2.5, 5 + step);
    this.ctx.fillRect(x - 4, y + 6, 2.5, 5 - step);
    this.ctx.fillRect(x + 2, y + 6, 2.5, 5 + step);
    this.ctx.fillRect(x + 5, y + 6, 2.5, 5 - step);

    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(x - 14, y - 1, 3, 6);

    this.ctx.fillStyle = '#4a2f1b';
    this.ctx.fillRect(x + 3, y - 8, 5, 7);

    // Fogo Vivo na Cabeça
    const flameSize = 8 + Math.floor(Math.sin(time * 0.04) * 3);
    this.ctx.fillStyle = '#ff3c00';
    this.ctx.fillRect(x + 2, y - 8 - flameSize, 8, flameSize);
    this.ctx.fillStyle = '#ffea3a';
    this.ctx.fillRect(x + 4, y - 6 - flameSize, 4, flameSize - 2);
  }

  drawBoitata(x, y, time) {
    // Serpente longa de fogo
    for (let i = 0; i < 6; i++) {
      const offset = i * 6;
      const wave = Math.sin((time * 0.012) + i * 0.8) * 5;
      const px = x - offset;
      const py = y + wave;

      this.ctx.fillStyle = i === 0 ? '#ffea3a' : (i % 2 === 0 ? '#ff3c00' : '#ff9f3a');
      this.ctx.beginPath();
      this.ctx.arc(px, py, 6 - i * 0.7, 0, Math.PI * 2);
      this.ctx.fill();

      if (i === 0) {
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(px + 1, py - 3, 2, 2);
      }
    }
  }

  drawMapinguari(x, y, time) {
    const sway = Math.sin(time * 0.008) * 1.5;

    this.ctx.fillStyle = '#263321';
    this.ctx.fillRect(x - 9 + sway, y - 15, 18, 20);

    // Braços articulados se movendo
    const armWave = Math.sin(time * 0.015) * 3;
    this.ctx.fillStyle = '#141c11';
    this.ctx.fillRect(x - 12 + sway, y - 9 + armWave, 3, 12);
    this.ctx.fillRect(x + 9 + sway, y - 9 - armWave, 3, 12);
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x - 12 + sway, y + 3 + armWave, 3, 2);
    this.ctx.fillRect(x + 9 + sway, y + 3 - armWave, 3, 2);

    // Olho
    this.ctx.fillStyle = '#ff0000';
    this.ctx.fillRect(x - 2 + sway, y - 11, 4, 4);

    // Boca da Barriga
    this.ctx.fillStyle = '#8a0d0d';
    this.ctx.fillRect(x - 3 + sway, y - 3, 6, 7);
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x - 3 + sway, y - 3, 1, 1);
    this.ctx.fillRect(x + 2 + sway, y - 3, 1, 1);
  }

  drawCorpoSeco(x, y) {
    this.ctx.fillStyle = '#7a8578';
    this.ctx.fillRect(x - 3.5, y - 10, 7, 14);
    this.ctx.fillStyle = '#a0b39c';
    this.ctx.fillRect(x - 2.5, y - 16, 5, 6);
    this.ctx.fillStyle = '#ff0000';
    this.ctx.fillRect(x - 1.5, y - 14, 1, 1);
    this.ctx.fillRect(x + 0.5, y - 14, 1, 1);
  }

  drawPisadeira(x, y) {
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(x - 3, y - 8, 6, 12);
    this.ctx.fillStyle = '#e8d5c4';
    this.ctx.fillRect(x - 2.5, y - 13, 5, 5);
    this.ctx.fillStyle = '#fff'; // Unhas compridas
    this.ctx.fillRect(x - 5, y - 5, 2, 5);
    this.ctx.fillRect(x + 3, y - 5, 2, 5);
  }

  drawChibamba(x, y, time) {
    const shake = Math.sin(time * 0.035) * 2;
    this.ctx.fillStyle = '#327329';
    this.ctx.fillRect(x - 5 + shake, y - 9, 10, 14);
    this.ctx.fillStyle = '#0f0f0f';
    this.ctx.fillRect(x - 2.5 + shake, y - 5, 5, 4);
  }

  drawCapelobo(x, y) {
    this.ctx.fillStyle = '#3a3f47';
    this.ctx.fillRect(x - 5, y - 7, 10, 12);
    this.ctx.fillStyle = '#22252a';
    this.ctx.fillRect(x - 3, y - 13, 6, 6);
    this.ctx.fillRect(x + 1, y - 11, 5, 2.5);
  }

  drawCaipora(x, y) {
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(x - 6, y + 1, 12, 5);
    this.ctx.fillStyle = '#d9905f';
    this.ctx.fillRect(x - 2.5, y - 6, 5, 7);
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(x - 3, y - 11, 6, 5);
  }

  drawQuibungo(x, y) {
    this.ctx.fillStyle = '#2e3a4e';
    this.ctx.fillRect(x - 5, y - 9, 10, 13);
    this.ctx.fillStyle = '#d69e76';
    this.ctx.fillRect(x - 2.5, y - 14, 5, 5);
  }

  drawIpupiara(x, y, time) {
    const float = Math.sin(time * 0.01) * 3;
    const py = y + float;
    this.ctx.fillStyle = '#183c2e';
    this.ctx.fillRect(x - 3.5, py + 2, 7, 5);
    this.ctx.fillStyle = '#3c8568';
    this.ctx.fillRect(x - 5, py + 7, 10, 1.5);
    this.ctx.fillStyle = '#21334f';
    this.ctx.fillRect(x - 3.5, py - 5, 7, 7);
  }

  drawTejuJagua(x, y) {
    this.ctx.fillStyle = '#263a23';
    this.ctx.fillRect(x - 8, y - 1, 16, 8);
    this.ctx.fillStyle = '#613e23';
    this.ctx.fillRect(x + 4, y - 7, 6, 6);
  }

  drawBoto(x, y) {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x - 3.5, y - 6, 7, 11);
    this.ctx.fillStyle = '#ffb0b0';
    this.ctx.fillRect(x - 2.5, y - 11, 5, 5);
    this.ctx.fillStyle = '#d9b48f';
    this.ctx.fillRect(x - 5, y - 13, 10, 2);
  }

  drawRatoRei(x, y) {
    this.ctx.fillStyle = '#656b73';
    this.ctx.fillRect(x - 6, y - 5, 12, 10);
    this.ctx.fillStyle = '#ffea3a';
    this.ctx.fillRect(x - 3.5, y - 8, 7, 3);
  }

  drawGenericMonster(monster) {
    const size = monster.isBoss ? 15 : 7;
    this.ctx.fillStyle = monster.isBoss ? '#802616' : '#5e6875';
    this.ctx.beginPath();
    this.ctx.arc(monster.x, monster.y, size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // --- RENDER HERÓIS E DASHS ---
  drawHeroes(heroes) {
    heroes.forEach(hero => {
      this.ctx.save();
      const time = performance.now();

      // Cálculo do Dash de Combate
      let dx = 0;
      let dy = 0;
      if (hero.state === 'FIGHTING' && hero.targetMonster) {
        const monster = hero.targetMonster;
        // Avanço rápido nos primeiros 40% do ciclo de cooldown de ataque
        const cdPct = hero.cooldownTimer * hero.spd; // entre 0 e 1
        if (cdPct > 0.6) {
          // Dash de avanço rápido
          const dashPct = (cdPct - 0.6) / 0.4; // entre 0 e 1
          const dist = 12 * Math.sin(dashPct * Math.PI); // Dash de ida e volta suave
          const mx = monster.x - hero.x;
          const my = monster.y - hero.y;
          const len = Math.sqrt(mx * mx + my * my);
          if (len > 5) {
            dx = (mx / len) * dist;
            dy = (my / len) * dist;
          }
        }
      }

      const hx = hero.x + dx;
      const hy = hero.y + dy;

      const isWalking = hero.state === 'SEARCHING_MONSTER' || hero.state === 'RETURNING_TOWN' || hero.state === 'IDLE_TOWN';
      const step = isWalking ? Math.sin(time * 0.015) * 3 : 0;

      // Sombra
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(hx, hy + 11, 10, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // 1. Pernas
      this.ctx.fillStyle = hero.cosmetics.skinColor;
      this.ctx.fillRect(hx - 3.5, hy + 5, 2, 6 + step);
      this.ctx.fillRect(hx + 1.5, hy + 5, 2, 6 - step);
      this.ctx.fillStyle = '#4a2c11'; // Sapatos
      this.ctx.fillRect(hx - 4.5, hy + 10 + step, 3, 1.5);
      this.ctx.fillRect(hx + 0.5, hy + 10 - step, 3, 1.5);

      // 2. Corpo / Armadura Dinâmica
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

      this.ctx.fillStyle = bodyColor;
      this.ctx.fillRect(hx - 5, hy - 4, 10, 10); // Tronco

      if (isLendaria) {
        this.ctx.strokeStyle = '#ffea3a';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(hx - 5.5, hy - 4.5, 11, 11);
      }

      // Detalhes da classe: Guerreiro recebe escudo nas costas
      if (hero.className === 'WARRIOR' && !isLendaria) {
        // Escudo de ferro redondo nas costas
        this.ctx.fillStyle = '#656e78';
        this.ctx.strokeStyle = '#32373c';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(hx - 4, hy + 1, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }

      // Cinto
      this.ctx.fillStyle = '#261c11';
      this.ctx.fillRect(hx - 5, hy + 3, 10, 1.5);

      // 3. Rosto
      this.ctx.fillStyle = hero.cosmetics.skinColor;
      this.ctx.fillRect(hx - 4, hy - 11, 8, 7);
      
      // Olhos
      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(hx - 2, hy - 9, 1, 1.5);
      this.ctx.fillRect(hx + 1, hy - 9, 1, 1.5);

      // Cabelo e Chapéus
      this.ctx.fillStyle = hero.cosmetics.hairColor;
      const hairStyle = hero.cosmetics.hairStyle;

      if (hero.className === 'MAGE') {
        // --- CHAPÉU DE BRUXO DE ABAS LARGAS ROXO (Mago) ---
        this.ctx.fillStyle = '#511b85';
        this.ctx.fillRect(hx - 7, hy - 12, 14, 2); // Aba
        this.ctx.beginPath(); // Cone
        this.ctx.moveTo(hx - 4, hy - 12);
        this.ctx.lineTo(hx + 4, hy - 12);
        this.ctx.lineTo(hx, hy - 20);
        this.ctx.closePath();
        this.ctx.fill();
      } else if (hero.className === 'WARRIOR') {
        // --- ELMO COM PLUMA (Guerreiro) ---
        this.ctx.fillStyle = '#818b96';
        this.ctx.fillRect(hx - 4.5, hy - 13, 9, 3); // Base do elmo
        this.ctx.fillStyle = '#ff3d3d'; // Pluma vermelha balançando
        const plumaOffset = Math.sin(time * 0.015) * 1.5;
        this.ctx.fillRect(hx - 1 + plumaOffset, hy - 16, 3, 3);
      } else {
        // Cabelos normais
        if (hairStyle === 'short') {
          this.ctx.fillRect(hx - 4.5, hy - 12.5, 9, 2);
          this.ctx.fillRect(hx - 4.5, hy - 11, 1.5, 4);
          this.ctx.fillRect(hx + 3, hy - 11, 1.5, 4);
        } else if (hairStyle === 'long') {
          this.ctx.fillRect(hx - 4.5, hy - 12.5, 9, 2);
          this.ctx.fillRect(hx - 4.5, hy - 11, 1.5, 9);
          this.ctx.fillRect(hx + 3, hy - 11, 1.5, 9);
        } else if (hairStyle === 'spiky') {
          this.ctx.fillRect(hx - 4, hy - 12.5, 8, 2);
          this.ctx.fillRect(hx - 3, hy - 14.5, 1.5, 2);
          this.ctx.fillRect(hx + 1.5, hy - 14.5, 1.5, 2);
        }
      }

      // Auréola flutuante se Sacerdote
      if (hero.className === 'PRIEST') {
        this.ctx.strokeStyle = '#ffea3a';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(hx, hy - 14, 2.5, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // 4. Arma Dinâmica
      this.drawHeroWeapon(hx, hy, hero);

      // Nome do Herói
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(hero.name, hx, hy - 21);

      // Barra de Vida
      const hpPct = Math.max(0, hero.hp / hero.maxHp);
      const barW = 20;
      const barH = 3;
      
      this.ctx.fillStyle = '#2c2e33';
      this.ctx.fillRect(hx - barW / 2, hy - 17, barW, barH);
      this.ctx.fillStyle = hpPct > 0.45 ? '#3aff7d' : '#ffea3a';
      if (hpPct < 0.2) this.ctx.fillStyle = '#ff3d3d';
      this.ctx.fillRect(hx - barW / 2, hy - 17, barW * hpPct, barH);

      // Balões de status
      this.drawHeroNeedBubble(hx, hy, 7);

      this.ctx.restore();
    });
  }

  drawHeroWeapon(hx, hy, hero) {
    const isAttacking = hero.state === 'FIGHTING' && hero.cooldownTimer > 0;
    const wx = isAttacking ? hx + 5 : hx - 6.5;
    const wy = isAttacking ? hy + 1 : hy + 2;

    let weaponColor = '#bf9b30'; // Bronze base
    let isLendaria = false;

    if (hero.equipment.weapon) {
      const tier = hero.equipment.weapon.tier;
      if (tier === 1) weaponColor = '#818b96'; // Ferro
      if (tier === 2) weaponColor = '#4e5b66'; // Aço
      if (tier === 3) {
        weaponColor = '#ffea3a'; // Lendária
        isLendaria = true;
      }
    } else {
      // Punho fechado
      this.ctx.fillStyle = hero.cosmetics.skinColor;
      this.ctx.fillRect(wx, wy, 2, 2.5);
      return;
    }

    this.ctx.save();

    if (hero.className === 'ARCHER') {
      // Arco
      this.ctx.strokeStyle = weaponColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      if (isAttacking) {
        this.ctx.arc(wx + 2, wy, 5, -Math.PI/2, Math.PI/2);
      } else {
        this.ctx.arc(wx, wy, 5, Math.PI/2, -Math.PI/2, true);
      }
      this.ctx.stroke();

      // Corda
      this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      if (isAttacking) {
        this.ctx.moveTo(wx + 2, wy - 5);
        this.ctx.lineTo(wx, wy);
        this.ctx.lineTo(wx + 2, wy + 5);
      } else {
        this.ctx.moveTo(wx, wy - 5);
        this.ctx.lineTo(wx, wy + 5);
      }
      this.ctx.stroke();
    } else if (hero.className === 'MAGE' || hero.className === 'PRIEST') {
      // Cajado
      this.ctx.fillStyle = '#6b4724';
      this.ctx.fillRect(wx + 1, wy - 8, 1.5, 12);
      this.ctx.fillStyle = hero.className === 'PRIEST' ? '#ffea3a' : '#c23aff';
      this.ctx.fillRect(wx, wy - 11, 3.5, 3.5);
    } else {
      // Espada
      this.ctx.fillStyle = weaponColor;
      if (isAttacking) {
        this.ctx.fillRect(wx, wy - 1, 9, 2);
        this.ctx.fillStyle = '#4a2c11';
        this.ctx.fillRect(wx - 1, wy - 3, 1.5, 6);
      } else {
        this.ctx.fillRect(wx, wy - 7, 2, 8);
        this.ctx.fillStyle = '#4a2c11';
        this.ctx.fillRect(wx - 2, wy - 1, 6, 1.5);
      }
    }

    this.ctx.restore();
  }

  drawHeroNeedBubble(hx, hy, size) {
    let icon = '';
    
    if (heroNeed(hx, hy) === 'hotel') icon = '💤';
    else if (heroNeed(hx, hy) === 'restaurant') icon = '🍲';
    else if (heroNeed(hx, hy) === 'hospital') icon = '🩹';
    else if (heroNeed(hx, hy) === 'tavern') icon = '🍺';

    // Para evitar poluição, só extraímos o estado da IA do herói no loop
  }

  drawHeroNeedBubble(hx, hy, size) {
    // Sobrescrito via loops anteriores no render
  }

  // Desenha efeitos de ataques avançados
  drawCombatEffects(heroes) {
    heroes.forEach(hero => {
      if (hero.state !== 'FIGHTING' || !hero.targetMonster) return;

      const monster = hero.targetMonster;
      this.ctx.save();

      // Mago
      if (hero.className === 'MAGE' && hero.cooldownTimer > 0.4) {
        const pct = (1 - hero.cooldownTimer);
        const px = hero.x + (monster.x - hero.x) * pct;
        const py = hero.y + (monster.y - hero.y) * pct;

        const color = hero.equipment.weapon?.key.includes('boitata') ? '#ff3c00' : '#c23aff';

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ffea3a';
        this.ctx.beginPath();
        this.ctx.arc(px - (monster.x - hero.x)*0.08, py - (monster.y - hero.y)*0.08, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Arqueiro
      if (hero.className === 'ARCHER' && hero.cooldownTimer > 0.3) {
        const pct = (1 - hero.cooldownTimer);
        const px = hero.x + (monster.x - hero.x) * pct;
        const py = hero.y + (monster.y - hero.y) * pct - Math.sin(pct * Math.PI) * 20;

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(px, py);
        this.ctx.lineTo(px + 4, py + (monster.y - hero.y)*0.05);
        this.ctx.stroke();
      }

      this.ctx.restore();
    });
  }

  drawDayNightFilter(w, h) {
    let alpha = 0.0;
    const t = this.dayNightCycle;

    if (t > 40 && t <= 50) {
      alpha = ((t - 40) / 10) * 0.42;
    } else if (t > 50 && t <= 80) {
      alpha = 0.42;
    } else if (t > 80 && t <= 90) {
      alpha = 0.42 - ((t - 80) / 10) * 0.42;
    }

    if (alpha > 0.01) {
      this.ctx.save();
      this.ctx.fillStyle = `rgba(15, 12, 42, ${alpha})`;
      this.ctx.fillRect(0, 0, w, h);
      
      if (t > 50 && t <= 80) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.fillRect(8, 8, 55, 16);
        this.ctx.fillStyle = '#ffea3a';
        this.ctx.font = '9px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('🌙 Noite', 14, 19);
      }
      this.ctx.restore();
    } else {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.fillRect(8, 8, 55, 16);
      this.ctx.fillStyle = '#3aff7d';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('☀️ Dia', 16, 19);
      this.ctx.restore();
    }
  }

  isNightTime() {
    const t = this.dayNightCycle;
    return t > 48 && t <= 82;
  }

  drawFloaters(floaters) {
    floaters.forEach(f => {
      this.ctx.save();
      const alpha = Math.max(0, f.timeLeft / f.maxTime);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = f.color;
      this.ctx.font = 'bold 10px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(f.text, f.x, f.y);
      this.ctx.restore();
    });
  }
}

function heroNeed(hx, hy) {
  // Retorna vazio para simplificação do bubble na UI do canvas
  return '';
}
