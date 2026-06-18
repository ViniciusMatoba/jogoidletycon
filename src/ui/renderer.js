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
    this.activeView = 'town';
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
      // Backgrounds de tela cheia por IA
      'bg_town': 'assets/terrain/bg_town.png',
      'bg_cave': 'assets/terrain/bg_cave.png',
      'bg_forest': 'assets/terrain/bg_forest.png',
      'bg_swamp': 'assets/terrain/bg_swamp.png',
      // Solo / Texturas de Terreno (Seamless)
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

  // Câmera Top-Down Clássica (2D Ortogonal vista de cima): Mapeia as coordenadas 1:1 diretamente
  toIso(x, y) {
    return { x: x, y: y };
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
    const time = performance.now();
    const biome = game.spawner.getBiomeConfig();

    // Limpar tela
    this.ctx.clearRect(0, 0, width, height);

    // 1. Desenhar Background da Tela Ativa
    if (this.activeView === 'town') {
      const bg = this.images['bg_town'];
      if (bg && bg.loaded) {
        this.ctx.drawImage(bg, 0, 0, width, height);
      } else {
        this.ctx.fillStyle = '#7a6b5e';
        this.ctx.fillRect(0, 0, width, height);
      }
    } else {
      let bgKey = 'bg_forest';
      if (biome.id === 0) bgKey = 'bg_cave';
      else if (biome.id === 2) bgKey = 'bg_swamp';

      const bg = this.images[bgKey];
      if (bg && bg.loaded) {
        this.ctx.drawImage(bg, 0, 0, width, height);
      } else {
        this.ctx.fillStyle = biome.id === 0 ? '#222326' : (biome.id === 2 ? '#1b231e' : '#102210');
        this.ctx.fillRect(0, 0, width, height);
      }

      // Filtro de tom verde pantanoso para o pântano
      if (biome.id === 2) {
        this.ctx.fillStyle = 'rgba(46, 125, 50, 0.15)';
        this.ctx.fillRect(0, 0, width, height);
      }
    }

    // 2. Criar a lista de objetos para ordenação por profundidade (Y-sorting)
    const renderList = [];

    if (this.activeView === 'town') {
      // Edifícios da Cidade (Novas coordenadas de tela cheia)
      const buildings = [
        { key: 'townhall', x: 480, y: 150, name: 'Prefeitura', icon: '🏛️' },
        { key: 'hotel', x: 260, y: 240, name: 'Hotel', icon: '🏨' },
        { key: 'restaurant', x: 700, y: 240, name: 'Restaurante', icon: '🍲' },
        { key: 'hospital', x: 200, y: 400, name: 'Hospital', icon: '🏥' },
        { key: 'tavern', x: 760, y: 400, name: 'Taverna', icon: '🍺' },
        { key: 'forge', x: 480, y: 430, name: 'Forja', icon: '⚒️' }
      ];
      buildings.forEach(b => {
        renderList.push({
          y: b.y,
          render: () => this.drawBuildingIndividual(game.town, b)
        });
      });

      // Postes de Lampião
      const lamps = [
        { x: 360, y: 240 },
        { x: 600, y: 240 },
        { x: 340, y: 400 },
        { x: 580, y: 400 }
      ];
      lamps.forEach(l => {
        renderList.push({
          y: l.y,
          render: () => this.drawStreetLamp(l.x, l.y)
        });
      });

      // Poço de Água
      renderList.push({
        y: 130,
        render: () => this.drawWaterWell(280, 130)
      });

      // Barris e Caixas
      renderList.push({
        y: 430,
        render: () => this.drawBarrel(440, 430)
      });
      renderList.push({
        y: 430,
        render: () => this.drawBox(520, 430)
      });
      renderList.push({
        y: 400,
        render: () => this.drawBarrel(720, 400)
      });
      renderList.push({
        y: 400,
        render: () => this.drawBox(240, 400)
      });

      // Heróis ativos na cidade
      game.heroes.forEach(h => {
        if (h.currentMap === 'town') {
          renderList.push({
            y: h.y,
            render: () => this.drawHeroIndividual(h)
          });
        }
      });

    } else {
      // === RENDER VIEW HUNT ===
      // Portal de Caça
      renderList.push({
        y: 100,
        render: () => this.drawDungeonPortal(480, 100, time)
      });

      // Elementos de Caça dinâmicos de Bioma Y-sorted
      const huntDecorations = [
        { x: 150, y: 140 },
        { x: 300, y: 120 },
        { x: 700, y: 150 },
        { x: 820, y: 180 },
        { x: 200, y: 280 },
        { x: 780, y: 320 },
        { x: 180, y: 440 },
        { x: 400, y: 460 },
        { x: 600, y: 440 },
        { x: 850, y: 420 },
        { x: 350, y: 300 },
        { x: 580, y: 280 }
      ];

      huntDecorations.forEach((pt, index) => {
        const typeIdx = index % 3;
        if (biome.id === 0) { // Cavernas
          if (typeIdx === 2) {
            // Osso plano desenhado direto
            this.drawBone(pt.x, pt.y);
          } else {
            renderList.push({
              y: pt.y,
              render: () => {
                if (typeIdx === 0) this.drawCrystal(pt.x, pt.y, time, index);
                else this.drawWeb(pt.x, pt.y);
              }
            });
          }
        } else if (biome.id === 1) { // Floresta
          renderList.push({
            y: pt.y,
            render: () => {
              if (typeIdx === 0) this.drawMushroom(pt.x, pt.y);
              else if (typeIdx === 1) this.drawShrub(pt.x, pt.y);
              else this.drawFlower(pt.x, pt.y);
            }
          });
        } else if (biome.id === 2) { // Pântano
          if (typeIdx === 0) {
            // Poça de lama plana
            this.drawMudPool(pt.x, pt.y);
          } else {
            renderList.push({
              y: pt.y,
              render: () => {
                if (typeIdx === 1) this.drawReeds(pt.x, pt.y);
                else this.drawPoisonFlower(pt.x, pt.y, time);
              }
            });
          }
        }
      });

      // Monstros ativos
      game.spawner.activeMonsters.forEach(m => {
        if (m.hp > 0) {
          renderList.push({
            y: m.y,
            render: () => this.drawMonsterIndividual(m)
          });
        }
      });

      // Heróis ativos na caçada
      game.heroes.forEach(h => {
        if (h.currentMap === 'hunt') {
          renderList.push({
            y: h.y,
            render: () => this.drawHeroIndividual(h)
          });
        }
      });
    }

    // Ordenar e renderizar objetos Y-sorted
    renderList.sort((a, b) => a.y - b.y);
    renderList.forEach(obj => obj.render());

    // 3. Atualizar e Desenhar Partículas de Fumaça (Apenas em Town View)
    if (this.activeView === 'town') {
      this.updateAndDrawSmoke(game.town, dt);
    }

    // 4. Desenhar Efeitos de Batalha (projéteis)
    this.drawCombatEffects(game.heroes);

    // 5. Desenhar Filtro de Dia/Noite
    this.drawDayNightFilter(width, height);

    // 6. Desenhar Textos Flutuantes
    this.drawFloaters(game.floaters);
  }

  // --- RENDERIZADORES DE TERRENO TOP-DOWN ---
  drawTerrain(game, w, h) {
    const biome = game.spawner.getBiomeConfig();
    const time = performance.now();

    // 1. Grama Geral de Fundo
    this.ctx.fillStyle = this.patterns['tile_grass'] || '#395c2f';
    this.ctx.fillRect(0, 0, w, h);

    // 2. Cidade (Solo de terra batida dentro das muralhas)
    this.ctx.fillStyle = '#7a6b5e';
    this.ctx.fillRect(0, 35, 440, h - 60);
    
    // Pequenos pontos de matinho nas bordas internas
    this.ctx.fillStyle = '#5c4d3c';
    this.ctx.fillRect(10, 48, 4, 3);
    this.ctx.fillRect(400, 70, 6, 2);
    this.ctx.fillRect(50, 450, 8, 3);

    // 3. Floresta (Terra batida de acordo com o Bioma)
    let forestColor = '#243b23';
    if (biome.id === 0) forestColor = '#222326'; // Cavernas
    if (biome.id === 1) forestColor = '#102210'; // Mata Fechada
    if (biome.id === 2) forestColor = '#1b231e'; // Pântano/Igarapés

    this.ctx.fillStyle = this.patterns['tile_dirt'] || forestColor;
    this.ctx.fillRect(480, 0, w - 480, h);

    // 4. Fosso de Água da Cidade (Moat) - X = 450 a 480
    this.ctx.fillStyle = this.patterns['tile_water'] || '#2d6ab3';
    this.ctx.fillRect(450, 0, 30, h);

    // Ondas no Fosso (correnteza descendo verticalmente)
    this.ctx.strokeStyle = '#5c99e6';
    this.ctx.lineWidth = 1.5;
    const waveOffset = (time * 0.04) % 40;
    for (let y = -20; y < h; y += 40) {
      const wy = y + waveOffset;
      this.ctx.beginPath();
      this.ctx.moveTo(455, wy);
      this.ctx.lineTo(455, wy + 5);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(470, wy + 15);
      this.ctx.lineTo(470, wy + 20);
      this.ctx.stroke();
    }

    // 5. Desenhar as Muralhas de Pedra da Cidade
    this.drawStoneWall(this.ctx, h);

    // 6. Caminhos de cobblestone na cidade (ligando prédios e saindo no portão)
    this.ctx.fillStyle = '#546e7a';
    this.ctx.fillRect(222, 100, 16, 350); // Estrada principal norte-sul
    this.ctx.fillRect(120, 192, 220, 16); // Estrada horizontal superior
    this.ctx.fillRect(120, 332, 220, 16); // Estrada horizontal inferior
    this.ctx.fillRect(230, 262, 210, 16); // Caminho até o portão

    // Detalhe de tijolos na estrada
    this.ctx.fillStyle = '#37474f';
    for (let ex = 120; ex < 340; ex += 24) {
      this.ctx.fillRect(ex, 192, 1.5, 16);
      this.ctx.fillRect(ex, 332, 1.5, 16);
    }
    for (let ey = 100; ey < 450; ey += 24) {
      this.ctx.fillRect(222, ey, 16, 1.5);
    }
    for (let ex = 230; ex < 440; ex += 24) {
      this.ctx.fillRect(ex, 262, 1.5, 16);
    }

    // 7. Ponte de Madeira Cruzando o Fosso (X = 446 a 484, Y = 250 a 290)
    this.ctx.fillStyle = '#5d4037';
    this.ctx.fillRect(446, 250, 38, 40);
    
    this.ctx.strokeStyle = '#3e2723';
    this.ctx.lineWidth = 2;
    for (let py = 254; py < 290; py += 6) {
      this.ctx.beginPath();
      this.ctx.moveTo(446, py);
      this.ctx.lineTo(484, py);
      this.ctx.stroke();
    }
    
    // Corrimão da ponte
    this.ctx.fillStyle = '#3e2723';
    this.ctx.fillRect(446, 247, 38, 3);
    this.ctx.fillRect(446, 290, 38, 3);
    
    // Cercas ao longo do fosso
    this.drawFences(h);
  }

  drawStoneWall(ctx, h) {
    ctx.save();
    
    const wallColor = '#5c6773';
    const mortarColor = '#212529';
    
    ctx.fillStyle = wallColor;
    
    // Muralha Superior e Inferior
    ctx.fillRect(0, 35, 440, 10);
    ctx.fillRect(0, h - 25, 440, 10);
    
    // Muralha Direita (com portão de 250 a 290)
    ctx.fillRect(440, 40, 10, 210);
    ctx.fillRect(440, 290, 10, h - 310);
    
    // Tijolos
    ctx.strokeStyle = mortarColor;
    ctx.lineWidth = 1;
    
    for (let wy = 45; wy < 250; wy += 8) {
      ctx.beginPath(); ctx.moveTo(440, wy); ctx.lineTo(450, wy); ctx.stroke();
    }
    for (let wy = 295; wy < h - 25; wy += 8) {
      ctx.beginPath(); ctx.moveTo(440, wy); ctx.lineTo(450, wy); ctx.stroke();
    }
    for (let wx = 10; wx < 440; wx += 16) {
      ctx.beginPath(); ctx.moveTo(wx, 35); ctx.lineTo(wx, 45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx, h - 25); ctx.lineTo(wx, h - 15); ctx.stroke();
    }

    // Ameias
    ctx.fillStyle = '#454d57';
    for (let wy = 40; wy < 250; wy += 16) {
      ctx.fillRect(447, wy, 3, 8);
    }
    for (let wy = 290; wy < h - 20; wy += 16) {
      ctx.fillRect(447, wy, 3, 8);
    }
    for (let wx = 10; wx < 440; wx += 20) {
      ctx.fillRect(wx, 32, 10, 3);
      ctx.fillRect(wx, h - 28, 10, 3);
    }

    // Pilares do Portão
    ctx.fillStyle = '#37474f';
    ctx.fillRect(438, 245, 14, 5);
    ctx.fillRect(438, 290, 14, 5);
    ctx.strokeRect(438, 245, 14, 5);
    ctx.strokeRect(438, 290, 14, 5);
    
    ctx.restore();
  }

  drawFences(h) {
    this.ctx.save();
    this.ctx.fillStyle = '#5c4530';
    this.ctx.strokeStyle = '#3e2723';
    this.ctx.lineWidth = 1;

    for (let y = 4; y < h; y += 12) {
      if (y >= 246 && y <= 294) continue;
      this.ctx.fillRect(445, y, 2, 8);
      if (y + 12 < h && !(y + 12 >= 246 && y + 12 <= 294)) {
        this.ctx.beginPath();
        this.ctx.moveTo(446, y + 2);
        this.ctx.lineTo(446, y + 14);
        this.ctx.moveTo(446, y + 5);
        this.ctx.lineTo(446, y + 17);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }

  // --- DESENHO DE ÁRVORE RETRÔ TOP-DOWN ---
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

  // --- RENDER DE EDIFÍCIO (COM IMAGEM PIXEL ART E LOTES FISICOS) ---
  drawBuildingIndividual(town, b) {
    const level = town.buildings[b.key];
    const isBuilt = level > 0;

    const bx = b.x;
    const by = b.y;

    const wSize = b.key === 'townhall' ? 76 : 60;
    const hSize = b.key === 'townhall' ? 76 : 60;

    this.ctx.save();

    // 1. Fundação do Lote (Terra/pedra compactada)
    const rx = bx - wSize / 2;
    const ry = by - hSize + 10;
    const rw = wSize;
    const rh = hSize - 10;

    this.ctx.fillStyle = '#3a2e2b';
    this.ctx.fillRect(rx, ry, rw, rh);
    this.ctx.strokeStyle = '#221917';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(rx, ry, rw, rh);

    // Detalhes de solo do lote
    this.ctx.fillStyle = '#2d2321';
    this.ctx.fillRect(rx + 4, ry + 4, 3, 3);
    this.ctx.fillRect(rx + rw - 8, ry + 6, 4, 2);

    if (isBuilt) {
      // --- SE CONSTRUÍDO: Desenhar prédio por cima da base ---
      const img = this.images[b.key];
      if (img && img.loaded) {
        this.ctx.drawImage(img, bx - wSize / 2, by - hSize + 8, wSize, hSize);

        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(b.icon, bx, by - hSize + 4);
      } else {
        // Fallback vetorial original
        this.ctx.fillStyle = '#5c4530';
        this.ctx.fillRect(bx - 22, by - 12, 44, 28);

        this.ctx.fillStyle = '#8c3523';
        this.ctx.beginPath();
        this.ctx.moveTo(bx - 26, by - 12);
        this.ctx.lineTo(bx + 26, by - 12);
        this.ctx.lineTo(bx, by - 28);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.fillStyle = '#2e1c0c';
        this.ctx.fillRect(bx - 6, by + 6, 12, 10);

        if (b.key !== 'townhall' && b.key !== 'hotel') {
          this.ctx.fillStyle = '#3d2e20';
          this.ctx.fillRect(bx + 11, by - 18, 6, 10);
        }

        const isNight = this.isNightTime();
        this.ctx.fillStyle = isNight ? (Math.random() > 0.05 ? '#ffea3a' : '#aa9e27') : '#2e1c0c';
        this.ctx.fillRect(bx - 14, by - 4, 6, 6);
        this.ctx.fillRect(bx + 8, by - 4, 6, 6);

        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(b.icon, bx, by - 32);
      }

      // Nível do Prédio
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`Lvl ${level}`, bx, by + 12);
    } else {
      // --- SE TRANCADO: Desenhar estrutura de madeira (scaffolding) ---
      const beamColor = '#5d4037';
      const plankColor = '#8d6e63';
      
      this.ctx.strokeStyle = beamColor;
      this.ctx.lineWidth = 3;
      
      // Postes verticais principais
      this.ctx.beginPath();
      this.ctx.moveTo(rx + 8, ry + rh - 2); this.ctx.lineTo(rx + 8, ry + 12);
      this.ctx.moveTo(rx + rw - 8, ry + rh - 2); this.ctx.lineTo(rx + rw - 8, ry + 12);
      this.ctx.moveTo(bx, ry + rh - 2); this.ctx.lineTo(bx, ry + 6);
      this.ctx.stroke();

      // Vigas horizontais
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.moveTo(rx + 8, ry + 16); this.ctx.lineTo(rx + rw - 8, ry + 16);
      this.ctx.moveTo(rx + 8, ry + rh - 12); this.ctx.lineTo(rx + rw - 8, ry + rh - 12);
      this.ctx.stroke();
      
      // Vigas diagonais cruzadas
      this.ctx.strokeStyle = '#4e342e';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(rx + 8, ry + 16); this.ctx.lineTo(bx, ry + rh - 12);
      this.ctx.moveTo(bx, ry + 16); this.ctx.lineTo(rx + 8, ry + rh - 12);
      this.ctx.moveTo(bx, ry + 16); this.ctx.lineTo(rx + rw - 8, ry + rh - 12);
      this.ctx.moveTo(rx + rw - 8, ry + 16); this.ctx.lineTo(bx, ry + rh - 12);
      this.ctx.stroke();

      // Viga do telhado (triângulo)
      this.ctx.strokeStyle = beamColor;
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.moveTo(rx + 8, ry + 16); this.ctx.lineTo(bx, ry + 2);
      this.ctx.lineTo(rx + rw - 8, ry + 16);
      this.ctx.stroke();
      
      // Placa de obra pendurada
      this.ctx.fillStyle = plankColor;
      this.ctx.fillRect(bx - 20, by - 26, 40, 10);
      this.ctx.strokeStyle = '#4e342e';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(bx - 20, by - 26, 40, 10);
      
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '8px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(b.name, bx, by - 18);
      
      // Martelo flutuante no centro
      this.ctx.font = '14px Arial';
      this.ctx.fillText('🔨', bx, by + 4);
      
      // Rótulo: 🔒 Trancado
      this.ctx.fillStyle = '#b0bec5';
      this.ctx.font = '9px monospace';
      this.ctx.fillText('🔒 Trancado', bx, by + 16);
    }

    this.ctx.restore();
  }

  // --- ELEMENTOS DE DECORAÇÃO DE BACKGROUND (MURAIS, LAMPIÕES, PORTAIS) ---
  drawStreetLamp(x, y) {
    this.ctx.save();
    
    // Post
    this.ctx.fillStyle = '#455a64';
    this.ctx.fillRect(x - 2, y - 32, 4, 32);
    
    // Base
    this.ctx.fillStyle = '#263238';
    this.ctx.fillRect(x - 4, y - 4, 8, 4);
    
    // Haste horizontal
    this.ctx.fillStyle = '#455a64';
    this.ctx.fillRect(x - 2, y - 32, 10, 2);
    
    // Lampião
    this.ctx.fillStyle = '#37474f';
    this.ctx.fillRect(x + 5, y - 30, 4, 6);
    
    const isNight = this.isNightTime();
    
    this.ctx.fillStyle = isNight ? '#ffeb3b' : '#78909c';
    this.ctx.fillRect(x + 6, y - 28, 2, 3);
    
    if (isNight) {
      const grad = this.ctx.createRadialGradient(x + 7, y - 27, 2, x + 7, y - 27, 36);
      grad.addColorStop(0, 'rgba(255, 235, 59, 0.45)');
      grad.addColorStop(0.3, 'rgba(255, 235, 59, 0.15)');
      grad.addColorStop(1, 'rgba(255, 235, 59, 0)');
      
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(x + 7, y - 27, 36, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.restore();
  }

  drawWaterWell(x, y) {
    this.ctx.save();
    
    // Base de pedra
    this.ctx.fillStyle = '#78909c';
    this.ctx.fillRect(x - 14, y - 8, 28, 8);
    this.ctx.fillStyle = '#455a64';
    this.ctx.strokeRect(x - 14, y - 8, 28, 8);
    
    // Textura
    this.ctx.fillStyle = '#37474f';
    this.ctx.fillRect(x - 10, y - 6, 4, 3);
    this.ctx.fillRect(x + 6, y - 5, 5, 2);
    
    // Água
    this.ctx.fillStyle = '#1565c0';
    this.ctx.fillRect(x - 11, y - 8, 22, 1);
    
    // Suportes
    this.ctx.fillStyle = '#5d4037';
    this.ctx.fillRect(x - 11, y - 22, 3, 14);
    this.ctx.fillRect(x + 8, y - 22, 3, 14);
    
    // Telhado
    this.ctx.fillStyle = '#8d6e63';
    this.ctx.beginPath();
    this.ctx.moveTo(x - 16, y - 22);
    this.ctx.lineTo(x + 16, y - 22);
    this.ctx.lineTo(x, y - 30);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.strokeStyle = '#5d4037';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 16, y - 22);
    this.ctx.lineTo(x + 16, y - 22);
    this.ctx.lineTo(x, y - 30);
    this.ctx.closePath();
    this.ctx.stroke();
    
    // Balde e corda
    this.ctx.fillStyle = '#5d4037';
    this.ctx.fillRect(x - 2, y - 14, 4, 4);
    this.ctx.strokeStyle = '#d7ccc8';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - 22);
    this.ctx.lineTo(x, y - 14);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawDungeonPortal(x, y, time) {
    this.ctx.save();
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + 4, 24, 6, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Portal roxo pulsante
    const pulse = Math.sin(time * 0.005) * 2;
    const grad = this.ctx.createRadialGradient(x, y - 20, 2, x, y - 20, 18 + pulse);
    grad.addColorStop(0, '#ea80fc');
    grad.addColorStop(0.5, '#4a148c');
    grad.addColorStop(1, '#000000');
    
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y - 20, 16 + pulse/2, 22 + pulse, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Arco de pedra
    this.ctx.fillStyle = '#37474f';
    this.ctx.strokeStyle = '#212121';
    this.ctx.lineWidth = 1.5;
    
    this.ctx.fillRect(x - 20, y - 36, 6, 36);
    this.ctx.strokeRect(x - 20, y - 36, 6, 36);
    this.ctx.fillRect(x + 14, y - 36, 6, 36);
    this.ctx.strokeRect(x + 14, y - 36, 6, 36);
    
    const blocks = [
      { bx: x - 20, by: y - 41, w: 7, h: 6 },
      { bx: x - 14, by: y - 45, w: 8, h: 6 },
      { bx: x - 6, by: y - 47, w: 12, h: 6 },
      { bx: x + 6, by: y - 45, w: 8, h: 6 },
      { bx: x + 13, by: y - 41, w: 7, h: 6 }
    ];
    
    blocks.forEach(b => {
      this.ctx.fillStyle = '#455a64';
      this.ctx.fillRect(b.bx, b.by, b.w, b.h);
      this.ctx.strokeRect(b.bx, b.by, b.w, b.h);
    });
    
    this.ctx.fillStyle = '#ea80fc';
    this.ctx.font = 'bold 9px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PORTAL DA CAÇA', x, y - 52);
    
    this.ctx.restore();
  }

  drawBarrel(x, y) {
    this.ctx.save();
    this.ctx.fillStyle = '#795548';
    this.ctx.fillRect(x - 6, y - 12, 12, 12);
    this.ctx.strokeStyle = '#3e2723';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - 6, y - 12, 12, 12);
    
    this.ctx.fillStyle = '#9e9e9e';
    this.ctx.fillRect(x - 6, y - 10, 12, 1.5);
    this.ctx.fillRect(x - 6, y - 3, 12, 1.5);
    
    this.ctx.strokeStyle = '#5d4037';
    this.ctx.beginPath();
    this.ctx.moveTo(x - 2, y - 12); this.ctx.lineTo(x - 2, y);
    this.ctx.moveTo(x + 2, y - 12); this.ctx.lineTo(x + 2, y);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  drawBox(x, y) {
    this.ctx.save();
    this.ctx.fillStyle = '#a1887f';
    this.ctx.fillRect(x - 7, y - 11, 14, 11);
    this.ctx.strokeStyle = '#4e342e';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - 7, y - 11, 14, 11);
    
    this.ctx.beginPath();
    this.ctx.moveTo(x - 7, y - 11); this.ctx.lineTo(x + 7, y);
    this.ctx.moveTo(x + 7, y - 11); this.ctx.lineTo(x - 7, y);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  // --- DETALHES DE BIOMAS DE CAÇA ---
  drawCrystal(x, y, time, index) {
    const bounce = Math.sin((time * 0.003) + index) * 2;
    const cy = y - 6 + bounce;
    
    this.ctx.fillStyle = index % 2 === 0 ? 'rgba(0, 229, 255, 0.25)' : 'rgba(224, 64, 251, 0.25)';
    this.ctx.beginPath();
    this.ctx.arc(x, cy, 8, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = index % 2 === 0 ? '#00e5ff' : '#e040fb';
    this.ctx.beginPath();
    this.ctx.moveTo(x, cy - 6);
    this.ctx.lineTo(x + 3, cy);
    this.ctx.lineTo(x, cy + 6);
    this.ctx.lineTo(x - 3, cy);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x - 1, cy - 2, 2, 4);
  }

  drawWeb(x, y) {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 0.8;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 8, y - 8); this.ctx.lineTo(x + 8, y + 8);
    this.ctx.moveTo(x + 8, y - 8); this.ctx.lineTo(x - 8, y + 8);
    this.ctx.strokeRect(x - 4, y - 4, 8, 8);
    this.ctx.stroke();
  }

  drawBone(x, y) {
    this.ctx.fillStyle = '#e0e0e0';
    this.ctx.fillRect(x - 3, y - 3, 6, 5);
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(x - 2, y - 1, 1, 1);
    this.ctx.fillRect(x + 1, y - 1, 1, 1);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x - 6, y + 2, 12, 1.5);
  }

  drawMushroom(x, y) {
    this.ctx.fillStyle = '#f5f5f5';
    this.ctx.fillRect(x - 1, y, 2, 4);
    
    this.ctx.fillStyle = '#d32f2f';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 3.5, Math.PI, 0);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x - 1.5, y - 2, 1, 1);
    this.ctx.fillRect(x + 1, y - 1.5, 1, 1);
  }

  drawShrub(x, y) {
    this.ctx.fillStyle = '#1b5e20';
    this.ctx.beginPath();
    this.ctx.arc(x, y + 1, 5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#2e7d32';
    this.ctx.beginPath();
    this.ctx.arc(x - 2, y - 1, 3.5, 0, Math.PI * 2);
    this.ctx.arc(x + 2, y, 3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawFlower(x, y) {
    this.ctx.fillStyle = '#4caf50';
    this.ctx.fillRect(x - 0.5, y - 2, 1, 6);
    
    this.ctx.fillStyle = '#ff80ab';
    this.ctx.beginPath();
    this.ctx.arc(x - 1.5, y - 3, 1.5, 0, Math.PI * 2);
    this.ctx.arc(x + 1.5, y - 3, 1.5, 0, Math.PI * 2);
    this.ctx.arc(x, y - 4.5, 1.5, 0, Math.PI * 2);
    this.ctx.arc(x, y - 1.5, 1.5, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#ffff00';
    this.ctx.beginPath();
    this.ctx.arc(x, y - 3, 1, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawMudPool(x, y) {
    this.ctx.fillStyle = '#3e2723';
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + 2, 10, 3, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawReeds(x, y) {
    this.ctx.strokeStyle = '#2e7d32';
    this.ctx.lineWidth = 1.2;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 3, y + 4); this.ctx.lineTo(x - 1, y - 4);
    this.ctx.moveTo(x, y + 4); this.ctx.lineTo(x, y - 6);
    this.ctx.moveTo(x + 3, y + 4); this.ctx.lineTo(x + 1, y - 3);
    this.ctx.stroke();

    this.ctx.fillStyle = '#5d4037';
    this.ctx.fillRect(x - 1.5, y - 4, 1, 2);
    this.ctx.fillRect(x - 0.5, y - 6, 1, 2);
  }

  drawPoisonFlower(x, y, time) {
    this.ctx.fillStyle = '#7b1fa2';
    this.ctx.fillRect(x - 0.5, y - 1, 1, 5);
    
    const glow = Math.abs(Math.sin(time * 0.005)) * 2;
    this.ctx.fillStyle = 'rgba(186, 104, 200, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(x, y - 3, 3 + glow, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#9c27b0';
    this.ctx.fillRect(x - 1.5, y - 4.5, 3, 3);
  }

  // --- PARTÍCULAS DE FUMAÇA DAS CHAMINÉS ---
  getChaminePos(town, bKey) {
    const buildings = {
      restaurant: { x: 700, y: 240 },
      hospital: { x: 200, y: 400 },
      tavern: { x: 760, y: 400 },
      forge: { x: 480, y: 430 }
    };
    
    const pos = buildings[bKey];
    if (!pos || !town.isBuilt(bKey)) return null;
    
    // A chaminé cartesiana fica na parte superior direita do prédio
    return {
      x: pos.x + 14,
      y: pos.y - 16
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

  // --- RENDER MONSTROS TOP-DOWN ---
  drawMonsterIndividual(monster) {
    const pos = this.toIso(monster.x, monster.y);
    const time = performance.now();

    this.ctx.save();

    const name = monster.name;
    const imgKey = name.includes('Saci-Pererê') ? 'monster_saci' : 
                   name.includes('Curupira') ? 'monster_curupira' : null;
    const img = imgKey ? this.images[imgKey] : null;

    if (img && img.loaded) {
      // --- DESENHAR MONSTRO COM SPRITE DE PIXEL ART E BOUNCE ---
      this.ctx.save();
      
      // Sombra sob os pés
      const shadowSize = monster.isBoss ? 14 : 7;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(pos.x, pos.y + 4, shadowSize * 1.0, shadowSize * 0.35, 0, 0, Math.PI * 2);
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

    // Projeção isométrica (Top-Down é 1:1)
    const pos = this.toIso(cartX, cartY);
    const hx = pos.x;
    const hy = pos.y;

    const isWalking = hero.state === 'SEARCHING_MONSTER' || hero.state === 'RETURNING_TOWN' || hero.state === 'IDLE_TOWN';
    const step = isWalking ? Math.sin(time * 0.015) * 3 : 0;

    const imgKey = (hero.className === 'WARRIOR' || hero.className === 'MERCENARY') ? 'hero_warrior' : 
                   (hero.className === 'MAGE' || hero.className === 'PRIEST') ? 'hero_mage' : 'hero_archer';
    const img = this.images[imgKey];

    if (img && img.loaded) {
      // --- DESENHAR HERÓI COM SPRITE DE PIXEL ART E ANIMAÇÕES PROCEDURAIS ---
      this.ctx.save();
      
      // Sombra
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(hx, hy + 4, 8, 2.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Transladar para o ponto de base dos pés no chão
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
    if (this.activeView !== 'hunt') return;
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

      // Arqueiro (Parábola 2D clássica)
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
      if (f.map && f.map !== this.activeView) return;
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
