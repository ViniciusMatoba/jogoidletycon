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

    // Lista de árvores fixas no mapa para Y-sorting
    this.trees = [
      { x: 530, y: 60 },
      { x: 880, y: 80 },
      { x: 910, y: 440 },
      { x: 540, y: 460 },
      { x: 420, y: 50 },
      { x: 420, y: 450 },
      { x: 60, y: 280 }
    ];

    // Dicionário de imagens dos assets
    this.images = {};
    // Dicionário de padrões (patterns) de repetição de solo
    this.patterns = {};
    this.loadImages();
  }

  // Remove fundos falsos (brancos, pretos ou quadriculados) em tempo real via Canvas
  makeImageTransparent(img) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth || img.width;
    tempCanvas.height = img.naturalHeight || img.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);

    try {
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imageData.data;

      // Cor de fundo padrão (pixel superior esquerdo)
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];
      const bgA = data[3];

      // Tolerância para variação de cores
      const tolerance = 45;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 1. Remover se for idêntico/próximo à cor do canto superior esquerdo
        const distFromBg = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        if (distFromBg < tolerance) {
          data[i + 3] = 0;
          continue;
        }

        // 2. Remover fundo branco dominante típico de falsos PNGs de IA
        if (bgR > 180 && bgG > 180 && bgB > 180) {
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0;
            continue;
          }
        }

        // 3. Remover fundo preto dominante
        if (bgR < 60 && bgG < 60 && bgB < 60) {
          if (r < 40 && g < 40 && b < 40) {
            data[i + 3] = 0;
            continue;
          }
        }

        // 4. Remover quadriculado falso cinza/branco
        const isWhite = r > 240 && g > 240 && b > 240;
        const isGray = r > 180 && r < 210 && g > 180 && g < 210 && b > 180 && b < 210;
        if ((isWhite || isGray) && (bgR > 180 && bgG > 180 && bgB > 180)) {
          const x = (i / 4) % tempCanvas.width;
          const y = Math.floor((i / 4) / tempCanvas.width);
          // Se for perto das bordas externas, removemos
          if (x < 15 || x > tempCanvas.width - 15 || y < 15 || y > tempCanvas.height - 15) {
            data[i + 3] = 0;
          }
        }
      }

      tempCtx.putImageData(imageData, 0, 0);
      return tempCanvas;
    } catch (e) {
      console.error("Erro ao remover fundo do asset:", e);
      return img;
    }
  }

  // Carrega os assets de pixel art
  loadImages() {
    const assetsList = {
      // Solo / Texturas de Terreno
      'tile_grass': 'assets/terrain/tile_grass.png',
      'tile_dirt': 'assets/terrain/tile_dirt.png',
      'tile_water': 'assets/terrain/tile_water.png',
      'tile_road': 'assets/terrain/tile_road.png',
      // Edifícios
      'townhall': 'assets/buildings/townhall.png',
      'hotel': 'assets/buildings/hotel.png',
      'restaurant': 'assets/buildings/restaurant.png',
      'hospital': 'assets/buildings/hospital.png',
      'tavern': 'assets/buildings/tavern.png',
      'forge': 'assets/buildings/forge.png',
      // Heróis
      'hero_warrior': 'assets/sprites/hero_warrior.png',
      'hero_mage': 'assets/sprites/hero_mage.png',
      'hero_archer': 'assets/sprites/hero_archer.png',
      // Monstros
      'monster_saci': 'assets/sprites/monster_saci.png',
      'monster_curupira': 'assets/sprites/monster_curupira.png'
    };

    for (const key in assetsList) {
      const img = new Image();
      img.src = assetsList[key];
      img.onload = () => {
        // Aplica recorte de fundos transparentes em tempo real
        const cleanCanvas = this.makeImageTransparent(img);
        cleanCanvas.loaded = true;
        this.images[key] = cleanCanvas;
        
        // Se for um tile de solo, cria o padrão de repetição do Canvas
        if (key.startsWith('tile_')) {
          this.patterns[key] = this.ctx.createPattern(cleanCanvas, 'repeat');
        }
      };
      img.onerror = () => {
        console.warn(`Erro ao carregar imagem para ${key}: ${assetsList[key]}`);
        img.loaded = false;
      };
      this.images[key] = img;
    }
  }

  // Transforma coordenadas 2D cartesianas (0..960, 0..540) para 2.5D Isométrico
  toIso(x, y) {
    const scaleX = 0.64;
    const scaleY = 0.32;
    const offsetX = 350;
    const offsetY = 30;
    return {
      x: offsetX + (x - y) * scaleX,
      y: offsetY + (x + y) * scaleY
    };
  }

  // Função auxiliar para interpolar linearmente entre dois pontos
  interpolate(p1, p2, t) {
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    };
  }

  render(game, dt) {
    // Atualiza ciclo dia/noite
    this.dayNightCycle = (this.dayNightCycle + dt) % 90;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Limpar tela
    this.ctx.clearRect(0, 0, width, height);

    // 1. Desenhar Cenários Base (Terreno, Rio, Ponte, Estradas)
    this.drawTerrain(game, width, height);

    // 2. Criar a lista de objetos para ordenação por profundidade (Y-sorting)
    const renderList = [];

    // Adicionar as árvores estáticas
    this.trees.forEach(t => {
      renderList.push({
        y: t.y,
        render: () => this.drawPixelTree(t.x, t.y)
      });
    });

    // Adicionar os edifícios
    const buildings = [
      { key: 'townhall', x: 230, y: 100, name: 'Prefeitura', icon: '🏛️' },
      { key: 'hotel', x: 130, y: 200, name: 'Hotel', icon: '🏨' },
      { key: 'restaurant', x: 330, y: 200, name: 'Restaurante', icon: '🍲' },
      { key: 'hospital', x: 130, y: 340, name: 'Hospital', icon: '🏥' },
      { key: 'tavern', x: 330, y: 340, name: 'Taverna', icon: '🍺' },
      { key: 'forge', x: 230, y: 450, name: 'Forja', icon: '⚒️' }
    ];
    buildings.forEach(b => {
      renderList.push({
        y: b.y,
        render: () => this.drawBuildingIndividual(game.town, b)
      });
    });

    // Adicionar monstros ativos
    game.spawner.activeMonsters.forEach(m => {
      if (m.hp > 0) {
        renderList.push({
          y: m.y,
          render: () => this.drawMonsterIndividual(m)
        });
      }
    });

    // Adicionar heróis ativos
    game.heroes.forEach(h => {
      renderList.push({
        y: h.y,
        render: () => this.drawHeroIndividual(h)
      });
    });

    // Ordenar por Y cartesiano (menores Ys desenhados primeiro, maiores Ys desenhados depois)
    renderList.sort((a, b) => a.y - b.y);

    // Renderizar todos os elementos ordenados por profundidade
    renderList.forEach(obj => {
      obj.render();
    });

    // 3. Atualizar e Desenhar Partículas de Fumaça (no ar, acima de tudo)
    this.updateAndDrawSmoke(game.town, dt);

    // 4. Desenhar Efeitos de Batalha (projéteis)
    this.drawCombatEffects(game.heroes);

    // 5. Desenhar Filtro de Dia/Noite
    this.drawDayNightFilter(width, height);

    // 6. Desenhar Textos Flutuantes
    this.drawFloaters(game.floaters);
  }

  // --- RENDERIZADORES DE TERRENO ---
  drawTerrain(game, w, h) {
    const biome = game.spawner.getBiomeConfig();
    const time = performance.now();

    // -------------------------------------------------------------
    // DESENHAR SOLO DEITADO (Transformação isométrica de contexto)
    // Isso garante que os padrões de textura fiquem inclinados e deitados no chão
    // -------------------------------------------------------------
    this.ctx.save();
    
    // Aplica a matriz de projeção isométrica do terreno (escalaX, escalaY, etc.)
    this.ctx.transform(0.64, 0.32, -0.64, 0.32, 350, 30);

    // Cidade (Grama)
    this.ctx.fillStyle = this.patterns['tile_grass'] || '#395c2f';
    this.ctx.fillRect(0, 0, 470, 540);

    // Floresta (Terra)
    let forestColor = '#243b23';
    if (biome.id === 0) forestColor = '#222326'; // Cavernas
    if (biome.id === 1) forestColor = '#102210'; // Mata Fechada
    if (biome.id === 2) forestColor = '#1b231e'; // Igarapés

    this.ctx.fillStyle = this.patterns['tile_dirt'] || forestColor;
    this.ctx.fillRect(490, 0, 470, 540);

    // Rio Animado (X = 470 a 490)
    this.ctx.fillStyle = this.patterns['tile_water'] || '#2d6ab3';
    this.ctx.fillRect(470, 0, 20, 540);

    // Estradas de terra na cidade e até a ponte
    this.ctx.fillStyle = this.patterns['tile_road'] || '#826442';
    // Estrada principal norte-sul (X=220 a 240, Y=100 a 450)
    this.ctx.fillRect(220, 100, 20, 350);
    // Ramificação horizontal 1
    this.ctx.fillRect(120, 195, 220, 15);
    // Ramificação horizontal 2
    this.ctx.fillRect(120, 335, 220, 15);
    // Estrada até a ponte
    this.ctx.fillRect(230, 262, 240, 15);

    this.ctx.restore(); // Restaura contexto para sprites em pé
    // -------------------------------------------------------------

    // Desenha Ponte de madeira (Ponte fica em pé, mas alinhada às margens)
    this.ctx.fillStyle = '#6e4726'; // Tábuas principais
    this.drawIsoPolygon([
      { x: 464, y: 250 },
      { x: 496, y: 250 },
      { x: 496, y: 290 },
      { x: 464, y: 290 }
    ]);
    
    // Desenha tábuas individuais da ponte
    this.ctx.strokeStyle = '#452b16';
    this.ctx.lineWidth = 1.5;
    for (let py = 254; py < 290; py += 6) {
      const leftPoint = this.toIso(464, py);
      const rightPoint = this.toIso(496, py);
      this.ctx.beginPath();
      this.ctx.moveTo(leftPoint.x, leftPoint.y);
      this.ctx.lineTo(rightPoint.x, rightPoint.y);
      this.ctx.stroke();
    }

    // Corrimões
    this.ctx.strokeStyle = '#452b16';
    this.ctx.lineWidth = 3;
    
    const cnStart = this.toIso(464, 247);
    const cnEnd = this.toIso(496, 247);
    this.ctx.beginPath();
    this.ctx.moveTo(cnStart.x, cnStart.y);
    this.ctx.lineTo(cnEnd.x, cnEnd.y);
    this.ctx.stroke();
    
    const csStart = this.toIso(464, 290);
    const csEnd = this.toIso(496, 290);
    this.ctx.beginPath();
    this.ctx.moveTo(csStart.x, csStart.y);
    this.ctx.lineTo(csEnd.x, csEnd.y);
    this.ctx.stroke();

    // Ondas no Rio (Correnteza animada)
    this.ctx.strokeStyle = '#5c99e6';
    this.ctx.lineWidth = 2;
    const waveOffset = (time * 0.04) % 40;
    for (let y = -20; y < 540; y += 30) {
      const wy = y + waveOffset;
      const p1Start = this.toIso(475, wy);
      const p1End = this.toIso(475, wy + 4);
      this.ctx.beginPath();
      this.ctx.moveTo(p1Start.x, p1Start.y);
      this.ctx.lineTo(p1End.x, p1End.y);
      this.ctx.stroke();

      const p2Start = this.toIso(485, wy + 12);
      const p2End = this.toIso(485, wy + 16);
      this.ctx.beginPath();
      this.ctx.moveTo(p2Start.x, p2Start.y);
      this.ctx.lineTo(p2End.x, p2End.y);
      this.ctx.stroke();
    }
  }

  // Desenha um polígono a partir de pontos cartesianos projetados para isométrico
  drawIsoPolygon(points) {
    this.ctx.beginPath();
    points.forEach((pt, idx) => {
      const isoPt = this.toIso(pt.x, pt.y);
      if (idx === 0) {
        this.ctx.moveTo(isoPt.x, isoPt.y);
      } else {
        this.ctx.lineTo(isoPt.x, isoPt.y);
      }
    });
    this.ctx.closePath();
    this.ctx.fill();
  }

  // --- DESENHO DE ÁRVORE RETRÔ ISOMÉTRICA ---
  drawPixelTree(x, y) {
    const pos = this.toIso(x, y);
    const tx = pos.x;
    const ty = pos.y;

    this.ctx.save();
    // Tronco (sobe verticalmente da base projetada)
    this.ctx.fillStyle = '#4d3319';
    this.ctx.fillRect(tx - 3, ty - 18, 6, 18);

    // Folhas em camadas pixeladas
    this.ctx.fillStyle = '#163b13';
    this.ctx.beginPath();
    this.ctx.arc(tx, ty - 24, 14, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#20541d';
    this.ctx.beginPath();
    this.ctx.arc(tx - 4, ty - 28, 9, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#2d7328';
    this.ctx.beginPath();
    this.ctx.arc(tx + 3, ty - 26, 7, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  // --- RENDER DE EDIFÍCIO (COM IMAGEM PIXEL ART / FALLBACK 3D) ---
  drawBuildingIndividual(town, b) {
    const level = town.buildings[b.key];
    const isBuilt = level > 0;

    this.ctx.save();

    if (!isBuilt) {
      this.ctx.globalAlpha = 0.45;
    }

    const bx = b.x;
    const by = b.y;

    const img = this.images[b.key];
    if (img && img.loaded) {
      // --- DESENHAR COM IMAGEM DE ASSET ISOMÉTRICO PIXEL ART (Transparência corrigida) ---
      const pos = this.toIso(bx, by);
      
      const wSize = b.key === 'townhall' ? 76 : 60;
      const hSize = b.key === 'townhall' ? 76 : 60;
      
      this.ctx.drawImage(img, pos.x - wSize / 2, pos.y - hSize + 8, wSize, hSize);

      // Emoji de Identificação
      this.ctx.font = '14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(b.icon, pos.x, pos.y - hSize + 4);

      // Rótulo de Lvl
      this.ctx.globalAlpha = 1.0;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'center';
      const label = isBuilt ? `Lvl ${level}` : '🔒 Trancado';
      this.ctx.fillText(label, pos.x, pos.y + 12);
    } else {
      // --- FALLBACK VETORIAL 3D PROCEDURAL ---
      const size = 22;

      // Vértices da base no chão isométrico
      const sul = this.toIso(bx, by + size);
      const leste = this.toIso(bx + size, by);
      const norte = this.toIso(bx, by - size);
      const oeste = this.toIso(bx - size, by);

      const H = 24;

      // Vértices do topo
      const sul_t = { x: sul.x, y: sul.y - H };
      const leste_t = { x: leste.x, y: leste.y - H };
      const norte_t = { x: norte.x, y: norte.y - H };
      const oeste_t = { x: oeste.x, y: oeste.y - H };

      // Face Esquerda
      this.ctx.fillStyle = isBuilt ? '#5c4530' : '#45382e';
      this.ctx.beginPath();
      this.ctx.moveTo(oeste.x, oeste.y);
      this.ctx.lineTo(sul.x, sul.y);
      this.ctx.lineTo(sul_t.x, sul_t.y);
      this.ctx.lineTo(oeste_t.x, oeste_t.y);
      this.ctx.closePath();
      this.ctx.fill();

      // Face Direita
      this.ctx.fillStyle = isBuilt ? '#423122' : '#332922';
      this.ctx.beginPath();
      this.ctx.moveTo(sul.x, sul.y);
      this.ctx.lineTo(leste.x, leste.y);
      this.ctx.lineTo(leste_t.x, leste_t.y);
      this.ctx.lineTo(sul_t.x, sul_t.y);
      this.ctx.closePath();
      this.ctx.fill();

      // Telhado
      const centro_base = this.toIso(bx, by);
      const telhado_ponta = { x: centro_base.x, y: centro_base.y - H - 16 };

      this.ctx.fillStyle = isBuilt ? '#9c3d28' : '#575251';
      this.ctx.beginPath();
      this.ctx.moveTo(oeste_t.x, oeste_t.y);
      this.ctx.lineTo(sul_t.x, sul_t.y);
      this.ctx.lineTo(telhado_ponta.x, telhado_ponta.y);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.fillStyle = isBuilt ? '#732a1b' : '#3d3938';
      this.ctx.beginPath();
      this.ctx.moveTo(sul_t.x, sul_t.y);
      this.ctx.lineTo(leste_t.x, leste_t.y);
      this.ctx.lineTo(telhado_ponta.x, telhado_ponta.y);
      this.ctx.closePath();
      this.ctx.fill();

      // Porta
      if (isBuilt) {
        const porta_esq = this.interpolate(oeste, sul, 0.4);
        const porta_dir = this.interpolate(oeste, sul, 0.6);
        this.ctx.fillStyle = '#2e1c0c';
        this.ctx.beginPath();
        this.ctx.moveTo(porta_esq.x, porta_esq.y);
        this.ctx.lineTo(porta_dir.x, porta_dir.y);
        this.ctx.lineTo(porta_dir.x, porta_dir.y - 8);
        this.ctx.lineTo(porta_esq.x, porta_esq.y - 8);
        this.ctx.closePath();
        this.ctx.fill();
      }

      // Janelas
      if (isBuilt) {
        const isNight = this.isNightTime();
        this.ctx.fillStyle = isNight ? (Math.random() > 0.05 ? '#ffea3a' : '#aa9e27') : '#2e1c0c';
        const janela_dir_pos = this.interpolate(sul_t, leste_t, 0.5);
        this.ctx.fillRect(janela_dir_pos.x - 2, janela_dir_pos.y + 4, 4, 4);
        const janela_esq_pos = this.interpolate(oeste_t, sul_t, 0.5);
        this.ctx.fillRect(janela_esq_pos.x - 2, janela_esq_pos.y + 4, 4, 4);
      }

      // Chaminé
      if (isBuilt && b.key !== 'townhall' && b.key !== 'hotel') {
        const chamine_base = this.interpolate(norte_t, leste_t, 0.5);
        const cx = chamine_base.x;
        const cy = chamine_base.y - 4;
        this.ctx.fillStyle = '#3d2e20';
        this.ctx.fillRect(cx - 3, cy - 8, 5, 8);
        this.ctx.fillStyle = '#1c150e';
        this.ctx.fillRect(cx - 4, cy - 9, 7, 2);
      }

      // Emoji e Rótulo
      this.ctx.font = '14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(b.icon, telhado_ponta.x, telhado_ponta.y - 6);

      this.ctx.globalAlpha = 1.0;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'center';
      const label = isBuilt ? `Lvl ${level}` : '🔒 Trancado';
      this.ctx.fillText(label, sul.x, sul.y + 12);
    }

    this.ctx.restore();
  }

  // --- PARTÍCULAS DE FUMAÇA DAS CHAMINÉS ---
  getChaminePos(town, bKey) {
    const buildings = {
      restaurant: { x: 330, y: 200 },
      hospital: { x: 130, y: 340 },
      tavern: { x: 330, y: 340 },
      forge: { x: 230, y: 450 }
    };
    
    const pos = buildings[bKey];
    if (!pos || !town.isBuilt(bKey)) return null;
    
    const bx = pos.x;
    const by = pos.y;
    const size = 22;
    const H = 24;
    
    const leste = this.toIso(bx + size, by);
    const norte = this.toIso(bx, by - size);
    
    const leste_t = { x: leste.x, y: leste.y - H };
    const norte_t = { x: norte.x, y: norte.y - H };
    
    const chamine_base = this.interpolate(norte_t, leste_t, 0.5);
    return {
      x: chamine_base.x,
      y: chamine_base.y - 13
    };
  }

  updateAndDrawSmoke(town, dt) {
    const chaminers = ['restaurant', 'hospital', 'tavern', 'forge'];

    chaminers.forEach(bKey => {
      const pos = this.getChaminePos(town, bKey);
      if (pos && Math.random() < 0.04) {
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
    });

    this.ctx.save();
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += 1.5 * dt;
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

  // --- RENDER MONSTROS ---
  drawMonsterIndividual(monster) {
    const pos = this.toIso(monster.x, monster.y);
    const time = performance.now();

    this.ctx.save();

    const name = monster.name;
    const imgKey = name.includes('Saci-Pererê') ? 'monster_saci' : 
                   name.includes('Curupira') ? 'monster_curupira' : null;
    const img = imgKey ? this.images[imgKey] : null;

    if (img && img.loaded) {
      // --- DESENHAR MONSTRO COM SPRITE DE PIXEL ART E BOUNCE (Transparência corrigida) ---
      this.ctx.save();
      
      // Sombra
      const shadowSize = monster.isBoss ? 14 : 7;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(pos.x, pos.y + 1, shadowSize * 1.2, shadowSize * 0.35, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Translações para animações
      this.ctx.translate(pos.x, pos.y);

      // Bounce de caminhada se monstro ativo
      const isFighting = monster.targetHero !== null;
      if (!isFighting) {
        const bounce = Math.abs(Math.sin(time * 0.012)) * 2;
        this.ctx.translate(0, -bounce);
      }

      // Desenhar sprite
      const size = monster.isBoss ? 40 : (monster.isMiniBoss ? 32 : 24);
      this.ctx.drawImage(img, -size / 2, -size + 2, size, size);

      this.ctx.restore();

      // Nome do Monstro
      this.ctx.fillStyle = monster.isBoss ? '#ffea3a' : '#ff9f3a';
      this.ctx.font = monster.isBoss ? 'bold 10px monospace' : '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(monster.name, pos.x, pos.y - (monster.isBoss ? 32 : 22));

      // Barra de HP
      const hpPct = monster.hp / monster.maxHp;
      const barW = monster.isBoss ? 45 : (monster.isMiniBoss ? 30 : 20);
      const barH = 3;
      
      this.ctx.fillStyle = '#2c2e33';
      this.ctx.fillRect(pos.x - barW / 2, pos.y - (monster.isBoss ? 28 : 18), barW, barH);
      this.ctx.fillStyle = '#ff3d3d';
      this.ctx.fillRect(pos.x - barW / 2, pos.y - (monster.isBoss ? 28 : 18), barW * hpPct, barH);
    } else {
      // --- FALLBACK PROCEDURAL ORIGINAL ---
      const shadowSize = monster.isBoss ? 16 : (monster.isMiniBoss ? 11 : 7);
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(pos.x, pos.y + 8, shadowSize * 1.2, shadowSize * 0.35, 0, 0, Math.PI * 2);
      this.ctx.fill();

      if (name.includes('Saci-Pererê')) {
        this.drawSaci(pos.x, pos.y, time);
      } else if (name.includes('Curupira')) {
        this.drawCurupira(pos.x, pos.y, time);
      } else if (name.includes('Mula sem Cabeça')) {
        this.drawMula(pos.x, pos.y, time);
      } else if (name.includes('Boitatá')) {
        this.drawBoitata(monster.x, monster.y, time);
      } else if (name.includes('Mapinguari')) {
        this.drawMapinguari(pos.x, pos.y, time);
      } else if (name.includes('Corpo-Seco')) {
        this.drawCorpoSeco(pos.x, pos.y);
      } else if (name.includes('Pisadeira')) {
        this.drawPisadeira(pos.x, pos.y);
      } else if (name.includes('Chibamba')) {
        this.drawChibamba(pos.x, pos.y, time);
      } else if (name.includes('Capelobo')) {
        this.drawCapelobo(pos.x, pos.y);
      } else if (name.includes('Caipora')) {
        this.drawCaipora(pos.x, pos.y);
      } else if (name.includes('Quibungo')) {
        this.drawQuibungo(pos.x, pos.y);
      } else if (name.includes('Ipupiara')) {
        this.drawIpupiara(pos.x, pos.y, time);
      } else if (name.includes('Teju')) {
        this.drawTejuJagua(pos.x, pos.y);
      } else if (name.includes('Boto')) {
        this.drawBoto(pos.x, pos.y);
      } else if (name.includes('Rato Rei')) {
        this.drawRatoRei(pos.x, pos.y);
      } else {
        this.drawGenericMonster(monster, pos.x, pos.y);
      }

      // Nome do Monstro
      this.ctx.fillStyle = monster.isBoss ? '#ffea3a' : '#ff9f3a';
      this.ctx.font = monster.isBoss ? 'bold 10px monospace' : '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(monster.name, pos.x, pos.y - (monster.isBoss ? 24 : 14));

      // Barra de HP
      const hpPct = monster.hp / monster.maxHp;
      const barW = monster.isBoss ? 45 : (monster.isMiniBoss ? 30 : 20);
      const barH = 3;
      
      this.ctx.fillStyle = '#2c2e33';
      this.ctx.fillRect(pos.x - barW / 2, pos.y - (monster.isBoss ? 20 : 10), barW, barH);
      this.ctx.fillStyle = '#ff3d3d';
      this.ctx.fillRect(pos.x - barW / 2, pos.y - (monster.isBoss ? 20 : 10), barW * hpPct, barH);
    }

    this.ctx.restore();
  }

  // --- DRAW MONSTER PROCEDURAL PIXELS ---
  drawSaci(x, y, time) {
    const jump = Math.abs(Math.sin(time * 0.012)) * 6;
    const py = y - jump;

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

    // Rosto
    this.ctx.fillStyle = '#5c3a21';
    this.ctx.fillRect(x - 3.5, py - 9, 7, 6);
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x + 1, py - 7, 2, 2);
    // Cachimbo
    this.ctx.fillStyle = '#8c5835';
    this.ctx.fillRect(x + 2, py - 4, 3.5, 1.5);
    this.ctx.fillStyle = '#ff9f3a';
    this.ctx.fillRect(x + 5.5, py - 5, 1, 2);

    // Calção e perna
    this.ctx.fillStyle = '#ff0000';
    this.ctx.fillRect(x - 3.5, py - 3, 7, 6);
    this.ctx.fillStyle = '#2e1c10';
    this.ctx.fillRect(x - 1, py + 3, 2, 5);
  }

  drawCurupira(x, y, time) {
    const flameVal = Math.sin(time * 0.04) * 2;
    this.ctx.fillStyle = Math.random() > 0.4 ? '#ff5500' : '#ffaa00';
    this.ctx.fillRect(x - 6, y - 16 - flameVal, 12, 5 + flameVal);

    this.ctx.fillStyle = '#ffd1a9';
    this.ctx.fillRect(x - 4, y - 11, 8, 7);
    this.ctx.fillStyle = '#3aff7d';
    this.ctx.fillRect(x + 1, y - 9, 1.5, 1.5);

    this.ctx.fillStyle = '#265922';
    this.ctx.fillRect(x - 5, y - 4, 10, 8);

    this.ctx.fillStyle = '#ffd1a9';
    this.ctx.fillRect(x - 3, y + 4, 2, 4);
    this.ctx.fillRect(x + 1, y + 4, 2, 4);

    this.ctx.fillStyle = '#c99a75';
    this.ctx.fillRect(x - 6, y + 7, 4, 1.5);
    this.ctx.fillRect(x - 2, y + 7, 4, 1.5);
  }

  drawMula(x, y, time) {
    const step = Math.sin(time * 0.016) * 3;

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

    const flameSize = 8 + Math.floor(Math.sin(time * 0.04) * 3);
    this.ctx.fillStyle = '#ff3c00';
    this.ctx.fillRect(x + 2, y - 8 - flameSize, 8, flameSize);
    this.ctx.fillStyle = '#ffea3a';
    this.ctx.fillRect(x + 4, y - 6 - flameSize, 4, flameSize - 2);
  }

  drawBoitata(x, y, time) {
    for (let i = 0; i < 6; i++) {
      const offset = i * 6;
      const wave = Math.sin((time * 0.012) + i * 0.8) * 5;
      const cartX = x - offset;
      const cartY = y + wave;
      
      const pos = this.toIso(cartX, cartY);

      this.ctx.fillStyle = i === 0 ? '#ffea3a' : (i % 2 === 0 ? '#ff3c00' : '#ff9f3a');
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 6 - i * 0.7, 0, Math.PI * 2);
      this.ctx.fill();

      if (i === 0) {
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(pos.x + 1, pos.y - 3, 2, 2);
      }
    }
  }

  drawMapinguari(x, y, time) {
    const sway = Math.sin(time * 0.008) * 1.5;

    this.ctx.fillStyle = '#263321';
    this.ctx.fillRect(x - 9 + sway, y - 15, 18, 20);

    const armWave = Math.sin(time * 0.015) * 3;
    this.ctx.fillStyle = '#141c11';
    this.ctx.fillRect(x - 12 + sway, y - 9 + armWave, 3, 12);
    this.ctx.fillRect(x + 9 + sway, y - 9 - armWave, 3, 12);
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x - 12 + sway, y + 3 + armWave, 3, 2);
    this.ctx.fillRect(x + 9 + sway, y + 3 - armWave, 3, 2);

    this.ctx.fillStyle = '#ff0000';
    this.ctx.fillRect(x - 2 + sway, y - 11, 4, 4);

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
    this.ctx.fillStyle = '#fff';
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

  drawGenericMonster(monster, x, y) {
    const size = monster.isBoss ? 15 : 7;
    this.ctx.fillStyle = monster.isBoss ? '#802616' : '#5e6875';
    this.ctx.beginPath();
    this.ctx.arc(x, y, size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // --- RENDER HEROIS ---
  drawHeroIndividual(hero) {
    this.ctx.save();
    const time = performance.now();

    // Cálculo do Dash de Combate
    let dx = 0;
    let dy = 0;
    if (hero.state === 'FIGHTING' && hero.targetMonster) {
      const monster = hero.targetMonster;
      const cdPct = hero.cooldownTimer * hero.spd;
      if (cdPct > 0.6) {
        const dashPct = (cdPct - 0.6) / 0.4;
        const dist = 12 * Math.sin(dashPct * Math.PI);
        const mx = monster.x - hero.x;
        const my = monster.y - hero.y;
        const len = Math.sqrt(mx * mx + my * my);
        if (len > 5) {
          dx = (mx / len) * dist;
          dy = (my / len) * dist;
        }
      }
    }

    // Posição cartesiana do herói com o dash aplicado
    const cartX = hero.x + dx;
    const cartY = hero.y + dy;

    // Projeção isométrica
    const pos = this.toIso(cartX, cartY);
    const hx = pos.x;
    const hy = pos.y;

    const isWalking = hero.state === 'SEARCHING_MONSTER' || hero.state === 'RETURNING_TOWN' || hero.state === 'IDLE_TOWN';
    const step = isWalking ? Math.sin(time * 0.015) * 3 : 0;

    const imgKey = (hero.className === 'WARRIOR' || hero.className === 'MERCENARY') ? 'hero_warrior' : 
                   (hero.className === 'MAGE' || hero.className === 'PRIEST') ? 'hero_mage' : 'hero_archer';
    const img = this.images[imgKey];

    if (img && img.loaded) {
      // --- DESENHAR HERÓI COM SPRITE DE PIXEL ART E ANIMAÇÕES PROCEDURAIS (Transparência corrigida) ---
      this.ctx.save();
      
      // Sombra
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(hx, hy + 1, 8, 2.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Transladar para o ponto de base dos pés no chão isométrico
      this.ctx.translate(hx, hy);

      // Efeito de caminhada (bounce e inclinação leve)
      if (isWalking) {
        const bounce = Math.abs(Math.sin(time * 0.015)) * 3;
        this.ctx.translate(0, -bounce);
        const angle = Math.sin(time * 0.015) * 0.04;
        this.ctx.rotate(angle);
      }

      // Efeito de ataque (squash & stretch)
      if (hero.state === 'FIGHTING' && hero.targetMonster) {
        const cdPct = hero.cooldownTimer * hero.spd;
        if (cdPct > 0.6) {
          const attackFactor = Math.sin(((cdPct - 0.6) / 0.4) * Math.PI);
          this.ctx.scale(1 + attackFactor * 0.2, 1 - attackFactor * 0.15);
        }
      }

      // Desenhar sprite centrado
      const wSize = 28;
      const hSize = 28;
      this.ctx.drawImage(img, -wSize / 2, -hSize + 2, wSize, hSize);

      this.ctx.restore();

      // Texto de Nome e Barra de Vida (não rotacionam/balançam)
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(hero.name, hx, hy - 30);

      // Barra de Vida
      const hpPct = Math.max(0, hero.hp / hero.maxHp);
      const barW = 20;
      const barH = 3;
      
      this.ctx.fillStyle = '#2c2e33';
      this.ctx.fillRect(hx - barW / 2, hy - 26, barW, barH);
      this.ctx.fillStyle = hpPct > 0.45 ? '#3aff7d' : '#ffea3a';
      if (hpPct < 0.2) this.ctx.fillStyle = '#ff3d3d';
      this.ctx.fillRect(hx - barW / 2, hy - 26, barW * hpPct, barH);

      // Auréola flutuante se Sacerdote
      if (hero.className === 'PRIEST') {
        this.ctx.strokeStyle = '#ffea3a';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(hx, hy - 33, 2.5, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    } else {
      // --- FALLBACK VETORIAL ORIGINAL ---
      // Sombra
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(hx, hy + 11, 10, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Pernas
      this.ctx.fillStyle = hero.cosmetics.skinColor;
      this.ctx.fillRect(hx - 3.5, hy + 5, 2, 6 + step);
      this.ctx.fillRect(hx + 1.5, hy + 5, 2, 6 - step);
      this.ctx.fillStyle = '#4a2c11';
      this.ctx.fillRect(hx - 4.5, hy + 10 + step, 3, 1.5);
      this.ctx.fillRect(hx + 0.5, hy + 10 - step, 3, 1.5);

      // Corpo / Armadura Dinâmica
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
      this.ctx.fillRect(hx - 5, hy - 4, 10, 10);

      if (isLendaria) {
        this.ctx.strokeStyle = '#ffea3a';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(hx - 5.5, hy - 4.5, 11, 11);
      }

      if (hero.className === 'WARRIOR' && !isLendaria) {
        this.ctx.fillStyle = '#656e78';
        this.ctx.strokeStyle = '#32373c';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(hx - 4, hy + 1, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      }

      this.ctx.fillStyle = '#261c11';
      this.ctx.fillRect(hx - 5, hy + 3, 10, 1.5);

      // Rosto
      this.ctx.fillStyle = hero.cosmetics.skinColor;
      this.ctx.fillRect(hx - 4, hy - 11, 8, 7);
      
      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(hx - 2, hy - 9, 1, 1.5);
      this.ctx.fillRect(hx + 1, hy - 9, 1, 1.5);

      // Cabelo e Chapéus
      this.ctx.fillStyle = hero.cosmetics.hairColor;
      const hairStyle = hero.cosmetics.hairStyle;

      if (hero.className === 'MAGE') {
        this.ctx.fillStyle = '#511b85';
        this.ctx.fillRect(hx - 7, hy - 12, 14, 2);
        this.ctx.beginPath();
        this.ctx.moveTo(hx - 4, hy - 12);
        this.ctx.lineTo(hx + 4, hy - 12);
        this.ctx.lineTo(hx, hy - 20);
        this.ctx.closePath();
        this.ctx.fill();
      } else if (hero.className === 'WARRIOR') {
        this.ctx.fillStyle = '#818b96';
        this.ctx.fillRect(hx - 4.5, hy - 13, 9, 3);
        this.ctx.fillStyle = '#ff3d3d';
        const plumaOffset = Math.sin(time * 0.015) * 1.5;
        this.ctx.fillRect(hx - 1 + plumaOffset, hy - 16, 3, 3);
      } else {
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

      if (hero.className === 'PRIEST') {
        this.ctx.strokeStyle = '#ffea3a';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(hx, hy - 14, 2.5, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Arma Dinâmica
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
    }

    this.ctx.restore();
  }

  drawHeroWeapon(hx, hy, hero) {
    const isAttacking = hero.state === 'FIGHTING' && hero.cooldownTimer > 0;
    const wx = isAttacking ? hx + 5 : hx - 6.5;
    const wy = isAttacking ? hy + 1 : hy + 2;

    let weaponColor = '#bf9b30';
    let isLendaria = false;

    if (hero.equipment.weapon) {
      const tier = hero.equipment.weapon.tier;
      if (tier === 1) weaponColor = '#818b96';
      if (tier === 2) weaponColor = '#4e5b66';
      if (tier === 3) {
        weaponColor = '#ffea3a';
        isLendaria = true;
      }
    } else {
      this.ctx.fillStyle = hero.cosmetics.skinColor;
      this.ctx.fillRect(wx, wy, 2, 2.5);
      return;
    }

    this.ctx.save();

    if (hero.className === 'ARCHER') {
      this.ctx.strokeStyle = weaponColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      if (isAttacking) {
        this.ctx.arc(wx + 2, wy, 5, -Math.PI/2, Math.PI/2);
      } else {
        this.ctx.arc(wx, wy, 5, Math.PI/2, -Math.PI/2, true);
      }
      this.ctx.stroke();

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
      this.ctx.fillStyle = '#6b4724';
      this.ctx.fillRect(wx + 1, wy - 8, 1.5, 12);
      this.ctx.fillStyle = hero.className === 'PRIEST' ? '#ffea3a' : '#c23aff';
      this.ctx.fillRect(wx, wy - 11, 3.5, 3.5);
    } else {
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

  // --- EFEITOS DE BATALHA ---
  drawCombatEffects(heroes) {
    heroes.forEach(hero => {
      if (hero.state !== 'FIGHTING' || !hero.targetMonster) return;

      const monster = hero.targetMonster;
      this.ctx.save();

      // Mago
      if (hero.className === 'MAGE' && hero.cooldownTimer > 0.4) {
        const pct = (1 - hero.cooldownTimer);
        const cartX = hero.x + (monster.x - hero.x) * pct;
        const cartY = hero.y + (monster.y - hero.y) * pct;
        
        const pos = this.toIso(cartX, cartY);
        const color = hero.equipment.weapon?.key.includes('boitata') ? '#ff3c00' : '#c23aff';

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        const cartBackX = hero.x + (monster.x - hero.x) * (pct - 0.05);
        const cartBackY = hero.y + (monster.y - hero.y) * (pct - 0.05);
        const posBack = this.toIso(cartBackX, cartBackY);

        this.ctx.fillStyle = '#ffea3a';
        this.ctx.beginPath();
        this.ctx.arc(posBack.x, posBack.y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Arqueiro (Parábola tridimensional)
      if (hero.className === 'ARCHER' && hero.cooldownTimer > 0.3) {
        const pct = (1 - hero.cooldownTimer);
        const cartX = hero.x + (monster.x - hero.x) * pct;
        const cartY = hero.y + (monster.y - hero.y) * pct;
        
        const pos = this.toIso(cartX, cartY);
        const arrowHeight = Math.sin(pct * Math.PI) * 20;
        const py = pos.y - arrowHeight;

        const cartNextX = hero.x + (monster.x - hero.x) * (pct + 0.05);
        const cartNextY = hero.y + (monster.y - hero.y) * (pct + 0.05);
        
        const posNext = this.toIso(cartNextX, cartNextY);
        const nextHeight = Math.sin((pct + 0.05) * Math.PI) * 20;
        const nextY = posNext.y - nextHeight;

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, py);
        this.ctx.lineTo(posNext.x, nextY);
        this.ctx.stroke();
      }

      this.ctx.restore();
    });
  }

  // --- FILTRO DIA/NOITE ---
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

  // --- TEXTOS FLUTUANTES ---
  drawFloaters(floaters) {
    floaters.forEach(f => {
      this.ctx.save();
      const alpha = Math.max(0, f.timeLeft / f.maxTime);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = f.color;
      this.ctx.font = 'bold 10px monospace';
      this.ctx.textAlign = 'center';
      
      const pos = this.toIso(f.x, f.y);
      this.ctx.fillText(f.text, pos.x, pos.y - 18);
      this.ctx.restore();
    });
  }
}
