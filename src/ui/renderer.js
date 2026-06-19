import { HERO_CLASSES, BIOMES, ITEMS_INFO } from '../data/constants.js';

import {
  getTownGridMetrics,
  gridToScreen,
  screenToGrid
} from '../core/navigation.js';

const BUILDING_VISUAL_STAGES = [
  { key: 'straw', name: 'Palha', wall: '#8f6b38', wallDark: '#5d4428', roof: '#d0a84f', roofDark: '#8c6428', trim: '#4a301a', foundation: '#5c4938' },
  { key: 'wood', name: 'Madeira', wall: '#8a5632', wallDark: '#55321f', roof: '#7d3326', roofDark: '#4e2018', trim: '#2c1a12', foundation: '#6d5b48' },
  { key: 'stone', name: 'Pedra', wall: '#747d82', wallDark: '#3e484d', roof: '#6d4633', roofDark: '#3c281e', trim: '#252b2e', foundation: '#4f5a5f' },
  { key: 'brick', name: 'Tijolo', wall: '#9a4939', wallDark: '#5c2b24', roof: '#bd6b33', roofDark: '#743817', trim: '#2f2119', foundation: '#66706f' }
];

export function getBuildingVisualStage(level) {
  return BUILDING_VISUAL_STAGES[Math.min(Math.max(level, 1), BUILDING_VISUAL_STAGES.length) - 1];
}

export class GameRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas com ID ${canvasId} nÃ£o encontrado!`);
    }
    this.ctx = this.canvas.getContext('2d');

    // Desabilitar suavizaÃ§Ã£o para garantir visual de pixels nÃ­tido
    this.ctx.imageSmoothingEnabled = false;

    // Ciclo de dia e noite
    this.dayNightCycle = 0;

    // Lista de partÃ­culas de fumaÃ§a das chaminÃ©s
    this.smokeParticles = [];

    // Lista de Ã¡rvores fixas no mapa para Y-sorting
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
    this.pendingPlacement = null;
    this.hoveredTile = null;
    this.cameraX = 0;
    this.cameraY = 0;
    this.isDragging = false;
    this.hasDragged = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.startCamX = 0;
    this.startCamY = 0;
    this.loadImages();
  }

  // Remove fundos falsos (brancos, pretos ou quadriculados) em tempo real via Canvas
  makeImageTransparent(img) {
    const tempCanvas = document.createElement('canvas');
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);

    try {
      const imageData = tempCtx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Cor de fundo padrão (pixel superior esquerdo)
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];
      const bgA = data[3];

      // Se o pixel superior esquerdo já for transparente, assume que a imagem é um PNG limpo e pula o processamento
      if (bgA < 50) {
        return tempCanvas;
      }

      // Usando Flood-Fill a partir das bordas para remover o fundo quadriculado/sólido
      const visited = new Uint8Array(width * height);
      const queue = [];

      // Função para verificar se a cor do pixel é considerada fundo (branco, cinza quadriculado ou igual à cor do canto)
      const isBackground = (r, g, b, a) => {
        if (a < 50) return true; // Já transparente
        
        // Canto / Fundo original
        const distFromBg = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        if (distFromBg < 35) return true;
        
        // Branco (fake png)
        if (r > 230 && g > 230 && b > 230) return true;
        
        // Cinza quadriculado (fake png)
        if (r > 175 && r < 215 && g > 175 && g < 215 && b > 175 && b < 215) {
          // Garante que é cinza neutro
          if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && Math.abs(r - b) < 8) {
            return true;
          }
        }
        
        return false;
      };

      // Adicionar bordas na fila como sementes
      // Linha superior e inferior
      for (let x = 0; x < width; x++) {
        const idxTop = x;
        const idxBot = (height - 1) * width + x;
        
        if (isBackground(data[idxTop * 4], data[idxTop * 4 + 1], data[idxTop * 4 + 2], data[idxTop * 4 + 3])) {
          queue.push(x, 0);
          visited[idxTop] = 1;
        }
        if (isBackground(data[idxBot * 4], data[idxBot * 4 + 1], data[idxBot * 4 + 2], data[idxBot * 4 + 3])) {
          queue.push(x, height - 1);
          visited[idxBot] = 1;
        }
      }

      // Coluna esquerda e direita
      for (let y = 0; y < height; y++) {
        const idxLeft = y * width;
        const idxRight = y * width + (width - 1);
        
        if (!visited[idxLeft] && isBackground(data[idxLeft * 4], data[idxLeft * 4 + 1], data[idxLeft * 4 + 2], data[idxLeft * 4 + 3])) {
          queue.push(0, y);
          visited[idxLeft] = 1;
        }
        if (!visited[idxRight] && isBackground(data[idxRight * 4], data[idxRight * 4 + 1], data[idxRight * 4 + 2], data[idxRight * 4 + 3])) {
          queue.push(width - 1, y);
          visited[idxRight] = 1;
        }
      }

      // Loop do Flood Fill
      let head = 0;
      while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        const idx = cy * width + cx;
        
        // Zera a opacidade (torna transparente)
        data[idx * 4 + 3] = 0;

        // Vizinhos (4-direções)
        const dirs = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1]
        ];

        for (const [nx, ny] of dirs) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;
            if (!visited[nidx]) {
              const nr = data[nidx * 4];
              const ng = data[nidx * 4 + 1];
              const nb = data[nidx * 4 + 2];
              const na = data[nidx * 4 + 3];
              
              if (isBackground(nr, ng, nb, na)) {
                visited[nidx] = 1;
                queue.push(nx, ny);
              }
            }
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
      // Edificios
      'townhall': 'assets/buildings/townhall.png',
      'hotel': 'assets/buildings/hotel.png',
      'restaurant': 'assets/buildings/restaurant.png',
      'hospital': 'assets/buildings/hospital.png',
      'tavern': 'assets/buildings/tavern.png',
      'forge': 'assets/buildings/forge.png',      // HerÃ³is
      'hero_warrior': 'assets/sprites/hero_warrior.png',
      'hero_mercenary': 'assets/sprites/hero_mercenary.png',
      'hero_mage': 'assets/sprites/hero_mage.png',
      'hero_priest': 'assets/sprites/hero_priest.png',
      'hero_archer': 'assets/sprites/hero_archer.png',
      // Monstros
      'monster_gravida_taubate': 'assets/sprites/Gravida Taubate_universal.png',
      'monster_home_do_saco': 'assets/sprites/Home do Saco_universal.png',
      'monster_boi_brabo': 'assets/sprites/boi brabo_universal.png',
      'monster_boi_tata': 'assets/sprites/boi tata_universal.png',
      'monster_caveira_2': 'assets/sprites/caveira 2_universal.png',
      'monster_caveira': 'assets/sprites/caveira_universal.png',
      'monster_ciclops_mulher': 'assets/sprites/ciclops mulher_universal.png',
      'monster_coelho_pascoa': 'assets/sprites/coelho pascoa_universal.png',
      'monster_et_varginha': 'assets/sprites/et varginha_universal.png',
      'monster_et_verde': 'assets/sprites/et verde_universal.png',
      'monster_et': 'assets/sprites/et_universal.png',
      'monster_lagarto': 'assets/sprites/lagarto_universal.png',
      'monster_lobisomen': 'assets/sprites/lobisomen_universal.png',
      'monster_porco': 'assets/sprites/porco_universal.png',
      'monster_rato': 'assets/sprites/rato_universal.png',
      'monster_vampiro': 'assets/sprites/vampiro_universal.png',
      'monster_zoio': 'assets/sprites/zoio_universal.png',
      'monster_saci_perere': 'assets/sprites/saci_perere_universal.png',
      'monster_curupira': 'assets/sprites/curupira_universal.png',
      'monster_mula_sem_cabeca': 'assets/sprites/mula_sem_cabeca_universal.png',
      'monster_capelobo': 'assets/sprites/capelobo_universal.png',
      'monster_caipora': 'assets/sprites/caipora_universal.png',
      'monster_quibungo': 'assets/sprites/quibungo_universal.png',
      'monster_ipupiara': 'assets/sprites/ipupiara_universal.png',
      'monster_teju_jagua': 'assets/sprites/teju_jagua_universal.png',
      'monster_boto_sedutor': 'assets/sprites/boto_sedutor_universal.png',
      'monster_mapinguari': 'assets/sprites/mapinguari_universal.png'
    };

    for (const key in assetsList) {
      const img = new Image();
      img.src = assetsList[key];
      img.onload = () => {
        const cleanCanvas = this.makeImageTransparent(img);
        cleanCanvas.loaded = true;
        this.images[key] = cleanCanvas;
        
        // Se for um tile de solo, cria o padrÃ£o de repetiÃ§Ã£o do Canvas
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

  // CÃ¢mera Top-Down ClÃ¡ssica (2D Ortogonal vista de cima): Mapeia as coordenadas 1:1 diretamente
  toIso(x, y) {
    return { x: x, y: y };
  }

  // FunÃ§Ã£o auxiliar para interpolar linearmente entre dois pontos
  interpolate(p1, p2, t) {
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    };
  }

  getTownGridMetrics(town, width = this.canvas.width, height = this.canvas.height) {
    return getTownGridMetrics(town, width, height);
  }

  gridToScreen(col, row, metrics) {
    return gridToScreen(col, row, metrics);
  }

  screenToGrid(x, y, town) {
    return screenToGrid(x, y, town, this.canvas.width, this.canvas.height);
  }

  getBuildingScreenPosition(town, buildingType) {
    const placement = town.getBuildingPlacement(buildingType);
    if (!placement) return null;

    const footprint = town.getBuildingFootprint(buildingType);
    const metrics = this.getTownGridMetrics(town);
    const center = this.gridToScreen(
      placement.col + footprint.w / 2,
      placement.row + footprint.h / 2,
      metrics
    );

    return {
      x: center.x,
      y: center.y + metrics.tileH * footprint.h * 0.34
    };
  }

  drawIsoTile(col, row, metrics, fill, stroke = 'rgba(24, 34, 28, 0.75)') {
    const p = this.gridToScreen(col, row, metrics);
    const hw = metrics.tileW / 2;
    const hh = metrics.tileH / 2;

    this.ctx.beginPath();
    this.ctx.moveTo(p.x, p.y);
    this.ctx.lineTo(p.x + hw, p.y + hh);
    this.ctx.lineTo(p.x, p.y + metrics.tileH);
    this.ctx.lineTo(p.x - hw, p.y + hh);
    this.ctx.closePath();
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    this.ctx.strokeStyle = stroke;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  drawTownGridBg(town, width, height) {
    this.ctx.fillStyle = '#172118';
    this.ctx.fillRect(0, 0, width, height);

    const skyBand = this.ctx.createLinearGradient(0, 0, 0, height);
    skyBand.addColorStop(0, '#101820');
    skyBand.addColorStop(1, '#1f2c1d');
    this.ctx.fillStyle = skyBand;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawTownGridTiles(town, width, height) {
    const metrics = this.getTownGridMetrics(town, width, height);

    for (let row = 0; row < town.grid.rows; row++) {
      for (let col = 0; col < town.grid.cols; col++) {
        const checker = (col + row) % 2 === 0;
        this.drawIsoTile(col, row, metrics, checker ? '#365f31' : '#31582e');
      }
    }

    if (this.pendingPlacement && this.hoveredTile) {
      const footprint = town.getBuildingFootprint(this.pendingPlacement);
      const canPlace = town.isAreaFree(this.hoveredTile.col, this.hoveredTile.row, footprint, this.pendingPlacement);
      for (let y = 0; y < footprint.h; y++) {
        for (let x = 0; x < footprint.w; x++) {
          this.drawIsoTile(
            this.hoveredTile.col + x,
            this.hoveredTile.row + y,
            metrics,
            canPlace ? 'rgba(88, 214, 141, 0.55)' : 'rgba(255, 75, 75, 0.55)',
            canPlace ? '#d7ff9b' : '#ffdddd'
          );
        }
      }
    }
  }

  drawTownGridLabel(town, width, height) {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 8, 6, 0.55)';
    const labelBoxW = Math.min(width < 520 ? width - 24 : 520, width - 24);
    this.ctx.fillRect(12, 12, labelBoxW, 34);
    this.ctx.strokeStyle = '#6d5638';
    this.ctx.strokeRect(12.5, 12.5, labelBoxW, 34);
    this.ctx.fillStyle = '#f1d78a';
    this.ctx.font = `${width < 520 ? 11 : 14}px monospace`;
    this.ctx.textAlign = 'left';
    const label = width < 520
      ? (this.pendingPlacement ? 'Toque em um espaco livre' : (town.isBuilt('townhall') ? 'Centro construido: expanda a vila' : 'Construa o Centro da Cidade'))
      : (this.pendingPlacement
        ? 'Escolha um espaco livre para posicionar a construcao'
        : town.isBuilt('townhall')
          ? 'Centro construido: expanda a vila posicionando novas construcoes'
          : 'Cidade em fundacao: construa o Centro da Cidade para desbloquear a vila');
    this.ctx.fillText(label, 22, 34);
    this.ctx.restore();
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

    // 1. Desenhar Background da Tela Ativa (Estático/sem translação)
    if (this.activeView === 'town') {
      this.drawTownGridBg(game.town, width, height);
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

    // === INICIALIZAR MUNDO (Salvar e aplicar translação da câmera) ===
    this.ctx.save();
    this.ctx.translate(-this.cameraX, -this.cameraY);

    // Se for Cidade, desenha as tiles sob translação
    if (this.activeView === 'town') {
      this.drawTownGridTiles(game.town, width, height);
    }

    // 2. Criar a lista de objetos para ordenação por profundidade (Y-sorting)
    const renderList = [];

    if (this.activeView === 'town') {
      const buildingLabels = {
        townhall: { name: 'Centro da Cidade', icon: '🏛️' },
        hotel: { name: 'Hotel', icon: '🏨' },
        restaurant: { name: 'Restaurante', icon: '🍲' },
        hospital: { name: 'Hospital', icon: '🏥' },
        tavern: { name: 'Taverna', icon: '🍺' },
        forge: { name: 'Forja', icon: '⚒️' }
      };

      game.town.getPlacedBuildings().forEach(placed => {
        const pos = this.getBuildingScreenPosition(game.town, placed.key);
        if (!pos) return;
        const meta = buildingLabels[placed.key] || { name: placed.key, icon: '🏠' };
        const b = { key: placed.key, x: pos.x, y: pos.y, name: meta.name, icon: meta.icon };
        renderList.push({
          y: b.y,
          render: () => this.drawBuildingIndividual(game.town, b)
        });
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
            render: () => this.drawMonsterIndividual(m, game)
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

    // 6. Desenhar Textos Flutuantes
    this.drawFloaters(game.floaters);

    // === RESTAURAR MUNDO (Sair da translação para desenhar UI e filtros fixos) ===
    this.ctx.restore();

    // 5. Desenhar Filtro de Dia/Noite
    this.drawDayNightFilter(width, height);

    // Desenhar Label Box do Mapa em Cidade
    if (this.activeView === 'town') {
      this.drawTownGridLabel(game.town, width, height);
    }
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
    if (biome.id === 2) forestColor = '#1b231e'; // PÃ¢ntano/IgarapÃ©s

    this.ctx.fillStyle = this.patterns['tile_dirt'] || forestColor;
    this.ctx.fillRect(480, 0, w - 480, h);

    // 4. Fosso de Ãgua da Cidade (Moat) - X = 450 a 480
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

    // 6. Caminhos de cobblestone na cidade (ligando prÃ©dios e saindo no portÃ£o)
    this.ctx.fillStyle = '#546e7a';
    this.ctx.fillRect(222, 100, 16, 350); // Estrada principal norte-sul
    this.ctx.fillRect(120, 192, 220, 16); // Estrada horizontal superior
    this.ctx.fillRect(120, 332, 220, 16); // Estrada horizontal inferior
    this.ctx.fillRect(230, 262, 210, 16); // Caminho atÃ© o portÃ£o

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
    
    // CorrimÃ£o da ponte
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
    
    // Muralha Direita (com portÃ£o de 250 a 290)
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

    // Pilares do PortÃ£o
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

  // --- DESENHO DE ÃRVORE RETRÃ” TOP-DOWN ---
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

  // --- RENDER DE EDIFÃCIO (COM IMAGEM PIXEL ART E LOTES FISICOS) ---
  drawBuildingIndividual(town, b) {
    const level = town.buildings[b.key];
    const isBuilt = level > 0;

    const bx = b.x;
    const by = b.y;

    const wSize = b.key === 'townhall' ? 76 : 60;
    const hSize = b.key === 'townhall' ? 76 : 60;

    this.ctx.save();

    this.drawBuildingLot(bx, by, wSize, hSize, isBuilt ? level : 1);

    if (isBuilt) {
      this.drawBuildingByStage(b, level, wSize, hSize);

      // NÃ­vel do PrÃ©dio
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

      // Viga do telhado (triÃ¢ngulo)
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
      this.ctx.fillText('ðŸ”¨', bx, by + 4);
      
      // RÃ³tulo: ðŸ”’ Trancado
      this.ctx.fillStyle = '#b0bec5';
      this.ctx.font = '9px monospace';
      this.ctx.fillText('ðŸ”’ Trancado', bx, by + 16);
    }

    this.ctx.restore();
  }

  drawBuildingLot(bx, by, wSize, hSize, level) {
    const stage = getBuildingVisualStage(level);
    const rx = bx - wSize / 2;
    const ry = by - hSize + 10;
    const rw = wSize;
    const rh = hSize - 10;

    this.ctx.fillStyle = stage.foundation;
    this.ctx.fillRect(rx, ry, rw, rh);
    this.ctx.strokeStyle = '#221917';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(rx, ry, rw, rh);

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    this.ctx.fillRect(rx + 4, ry + 4, 3, 3);
    this.ctx.fillRect(rx + rw - 8, ry + 6, 4, 2);

    if (level >= 3) {
      this.ctx.fillStyle = '#394246';
      for (let x = rx + 6; x < rx + rw - 6; x += 12) {
        this.ctx.fillRect(x, ry + rh - 7, 8, 3);
      }
    }
  }

  drawBuildingByStage(b, level, wSize, hSize) {
    const stage = getBuildingVisualStage(level);
    const bx = b.x;
    const by = b.y;
    const shape = this.getBuildingShape(b.key, level);
    const bodyW = shape.bodyW;
    const bodyH = shape.bodyH;
    const roofH = level === 1 ? 16 : 20;
    const bodyX = bx - bodyW / 2;
    const bodyY = by - bodyH - 8;
    const roofY = bodyY - roofH + 6;

    this.ctx.save();

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    this.ctx.fillRect(bodyX + 3, by - 9, bodyW, 7);

    this.ctx.fillStyle = stage.wallDark;
    this.ctx.fillRect(bodyX + 4, bodyY + 4, bodyW, bodyH);
    this.ctx.fillStyle = stage.wall;
    this.ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

    if (stage.key === 'wood') {
      this.ctx.fillStyle = stage.wallDark;
      for (let x = bodyX + 7; x < bodyX + bodyW - 3; x += 11) {
        this.ctx.fillRect(x, bodyY + 2, 2, bodyH - 4);
      }
    }

    if (stage.key === 'stone' || stage.key === 'brick') {
      this.ctx.strokeStyle = stage.wallDark;
      this.ctx.lineWidth = 1;
      for (let y = bodyY + 7; y < bodyY + bodyH - 2; y += 8) {
        this.ctx.beginPath();
        this.ctx.moveTo(bodyX + 2, y);
        this.ctx.lineTo(bodyX + bodyW - 2, y);
        this.ctx.stroke();
      }
      for (let x = bodyX + 10; x < bodyX + bodyW - 3; x += 14) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, bodyY + 7);
        this.ctx.lineTo(x, bodyY + bodyH - 2);
        this.ctx.stroke();
      }
    }

    this.ctx.fillStyle = stage.roofDark;
    this.ctx.beginPath();
    this.ctx.moveTo(bx - bodyW / 2 - 5, bodyY + 2);
    this.ctx.lineTo(bx + bodyW / 2 + 5, bodyY + 2);
    this.ctx.lineTo(bx + 3, roofY + 3);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = stage.roof;
    this.ctx.beginPath();
    this.ctx.moveTo(bx - bodyW / 2 - 7, bodyY);
    this.ctx.lineTo(bx + bodyW / 2 + 7, bodyY);
    this.ctx.lineTo(bx, roofY);
    this.ctx.closePath();
    this.ctx.fill();

    if (stage.key === 'straw') {
      this.ctx.strokeStyle = stage.roofDark;
      this.ctx.lineWidth = 1;
      for (let x = bx - bodyW / 2; x <= bx + bodyW / 2; x += 7) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, bodyY - 1);
        this.ctx.lineTo(bx, roofY + 2);
        this.ctx.stroke();
      }
    } else {
      this.ctx.fillStyle = stage.roofDark;
      for (let x = bx - bodyW / 2 - 2; x < bx + bodyW / 2; x += 9) {
        this.ctx.fillRect(x, bodyY - 2, 6, 3);
      }
    }

    this.ctx.fillStyle = stage.trim;
    this.ctx.fillRect(bx - 6, by - 18, 12, 18);

    const isNight = this.isNightTime();
    const windowColor = isNight ? '#ffea3a' : '#172027';
    this.ctx.fillStyle = windowColor;
    this.ctx.fillRect(bodyX + 7, bodyY + 13, 7, 7);
    this.ctx.fillRect(bodyX + bodyW - 14, bodyY + 13, 7, 7);

    if (level >= 2 && b.key !== 'hotel') {
      this.ctx.fillStyle = stage.trim;
      this.ctx.fillRect(bodyX + bodyW - 8, roofY + 5, 6, 13);
      this.ctx.fillStyle = '#1a120d';
      this.ctx.fillRect(bodyX + bodyW - 7, roofY + 3, 4, 3);
    }

    this.drawBuildingTypeDetails(b.key, bx, by, bodyX, bodyY, bodyW, bodyH, roofY, stage, level, windowColor);

    if (level >= 4) {
      this.ctx.fillStyle = '#c39b34';
      this.ctx.fillRect(bx - 2, roofY - 19, 4, 10);
      this.ctx.fillStyle = '#d63c2f';
      this.ctx.fillRect(bx + 2, roofY - 19, 10, 5);
    }

    this.ctx.font = '13px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(b.icon, bx, roofY - 6);

    this.ctx.restore();
  }

  getBuildingShape(key, level) {
    const shapes = {
      townhall: { bodyW: 50, bodyH: level >= 2 ? 40 : 34 },
      hotel: { bodyW: 44, bodyH: level >= 2 ? 38 : 30 },
      restaurant: { bodyW: 40, bodyH: 29 },
      hospital: { bodyW: 42, bodyH: 31 },
      tavern: { bodyW: 42, bodyH: 30 },
      forge: { bodyW: 40, bodyH: 28 }
    };
    return shapes[key] || { bodyW: 38, bodyH: 27 };
  }

  drawBuildingTypeDetails(key, bx, by, bodyX, bodyY, bodyW, bodyH, roofY, stage, level, windowColor) {
    this.ctx.save();

    if (key === 'townhall') {
      const towerW = level >= 3 ? 18 : 14;
      const towerH = level >= 2 ? 25 : 16;
      this.ctx.fillStyle = stage.wallDark;
      this.ctx.fillRect(bx - towerW / 2 + 2, roofY - towerH + 2, towerW, towerH);
      this.ctx.fillStyle = stage.wall;
      this.ctx.fillRect(bx - towerW / 2, roofY - towerH, towerW, towerH);
      this.ctx.fillStyle = stage.roof;
      this.ctx.fillRect(bx - towerW / 2 - 3, roofY - towerH - 5, towerW + 6, 5);
      this.ctx.fillStyle = windowColor;
      this.ctx.fillRect(bx - 3, roofY - towerH + 8, 6, 6);
      this.ctx.fillStyle = '#c39b34';
      this.ctx.fillRect(bx - 1, roofY - towerH - 13, 2, 8);
      this.ctx.fillStyle = '#d63c2f';
      this.ctx.fillRect(bx + 1, roofY - towerH - 13, 9, 5);
    }

    if (key === 'hotel') {
      this.ctx.fillStyle = stage.wallDark;
      this.ctx.fillRect(bodyX + 5, bodyY - 12, bodyW - 10, 13);
      this.ctx.fillStyle = stage.wall;
      this.ctx.fillRect(bodyX + 3, bodyY - 14, bodyW - 10, 13);
      this.ctx.fillStyle = stage.roof;
      this.ctx.fillRect(bodyX + 1, bodyY - 17, bodyW - 5, 5);
      this.ctx.fillStyle = windowColor;
      this.ctx.fillRect(bodyX + 9, bodyY - 8, 6, 5);
      this.ctx.fillRect(bodyX + bodyW - 18, bodyY - 8, 6, 5);
      this.ctx.fillStyle = '#f1d78a';
      this.ctx.font = 'bold 7px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('INN', bx, bodyY - 20);
    }

    if (key === 'restaurant') {
      this.drawHangingSign(bx, bodyY - 5, '#d08731', '🍲');
      this.ctx.fillStyle = '#2b1a11';
      this.ctx.fillRect(bodyX + bodyW - 8, roofY + 5, 6, 14);
      this.ctx.fillStyle = '#c9c2a5';
      this.ctx.fillRect(bodyX + bodyW - 7, roofY + 2, 4, 3);
      this.ctx.fillStyle = '#f0d08a';
      this.ctx.fillRect(bodyX + 6, by - 8, bodyW - 12, 3);
    }

    if (key === 'hospital') {
      this.ctx.fillStyle = '#f4efe3';
      this.ctx.fillRect(bx - 3, roofY - 11, 6, 18);
      this.ctx.fillRect(bx - 9, roofY - 5, 18, 6);
      this.ctx.fillStyle = '#c43a32';
      this.ctx.fillRect(bx - 2, roofY - 10, 4, 16);
      this.ctx.fillRect(bx - 8, roofY - 4, 16, 4);
      if (level >= 2) {
        this.ctx.fillStyle = '#d8e9ef';
        this.ctx.fillRect(bodyX + 6, bodyY + bodyH - 9, bodyW - 12, 4);
      }
    }

    if (key === 'tavern') {
      this.drawHangingSign(bx, bodyY - 6, '#7c4a2a', '🍺');
      this.ctx.fillStyle = '#3a2115';
      this.ctx.fillRect(bodyX + 5, by - 14, bodyW - 10, 4);
      this.ctx.fillStyle = '#c39b34';
      this.ctx.fillRect(bodyX + 8, by - 13, 4, 2);
      this.ctx.fillRect(bodyX + bodyW - 12, by - 13, 4, 2);
      if (level >= 3) {
        this.ctx.fillStyle = '#5e2d1e';
        this.ctx.fillRect(bodyX - 5, bodyY + 8, 6, 15);
      }
    }

    if (key === 'forge') {
      this.ctx.fillStyle = '#2b1a11';
      this.ctx.fillRect(bodyX + bodyW - 8, roofY + 2, 8, 20);
      this.ctx.fillStyle = '#1a100b';
      this.ctx.fillRect(bodyX + bodyW - 10, roofY, 12, 4);
      this.ctx.fillStyle = '#ff7a2d';
      this.ctx.fillRect(bodyX + 8, bodyY + bodyH - 13, 8, 6);
      this.ctx.fillStyle = '#ffd36a';
      this.ctx.fillRect(bodyX + 10, bodyY + bodyH - 11, 4, 3);
      this.ctx.fillStyle = '#394246';
      this.ctx.fillRect(bodyX + bodyW - 22, by - 8, 15, 4);
      this.ctx.fillRect(bodyX + bodyW - 18, by - 12, 5, 4);
    }

    this.ctx.restore();
  }

  drawHangingSign(x, y, color, icon) {
    this.ctx.save();
    this.ctx.strokeStyle = '#2c1a12';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 12, y - 4);
    this.ctx.lineTo(x + 12, y - 4);
    this.ctx.moveTo(x - 8, y - 4);
    this.ctx.lineTo(x - 8, y + 5);
    this.ctx.moveTo(x + 8, y - 4);
    this.ctx.lineTo(x + 8, y + 5);
    this.ctx.stroke();

    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - 13, y + 4, 26, 12);
    this.ctx.strokeStyle = '#2c1a12';
    this.ctx.strokeRect(x - 13, y + 4, 26, 12);
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(icon, x, y + 14);
    this.ctx.restore();
  }

  // --- ELEMENTOS DE DECORAÃ‡ÃƒO DE BACKGROUND (MURAIS, LAMPIÃ•ES, PORTAIS) ---
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
    
    // LampiÃ£o
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
    
    // Ãgua
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
    this.ctx.fillText('PORTAL DA CAÃ‡A', x, y - 52);
    
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

  // --- DETALHES DE BIOMAS DE CAÃ‡A ---
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

  // --- PARTÃCULAS DE FUMAÃ‡A DAS CHAMINÃ‰S ---
  getChaminePos(town, bKey) {
    const buildings = {
      restaurant: { x: 700, y: 240 },
      hospital: { x: 200, y: 400 },
      tavern: { x: 760, y: 400 },
      forge: { x: 480, y: 430 }
    };
    
    const pos = buildings[bKey];
    if (!pos || !town.isBuilt(bKey)) return null;
    
    // A chaminÃ© cartesiana fica na parte superior direita do prÃ©dio
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
  drawMonsterIndividual(monster, game) {
    const pos = this.toIso(monster.x, monster.y);
    const time = performance.now();

    this.ctx.save();

    const name = monster.name;
    const formattedName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, '_');
    const imgKey = `monster_${formattedName}`;

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

      const isSpritesheet = (img.naturalWidth === 832 || img.width === 832);

      if (isSpritesheet) {
        // --- LPC Spritesheet Cropping & Animation ---
        let rowOffset = 10; // Walk South
        let colCount = 9;
        
        // Scan heroes to see if they are fighting this monster
        const targetHero = (game && game.heroes) ? game.heroes.find(h => h.currentMap === 'hunt' && h.targetMonster === monster) : null;
        const isFighting = targetHero !== null && targetHero !== undefined;

        // Calculate direction
        const dx = monster.targetX - monster.x;
        const dy = monster.targetY - monster.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!monster.facingDir) {
          monster.facingDir = 'S';
        }

        if (dist > 2) {
          if (Math.abs(dx) > Math.abs(dy)) {
            monster.facingDir = dx > 0 ? 'E' : 'W';
          } else {
            monster.facingDir = dy > 0 ? 'S' : 'N';
          }
        } else if (isFighting && targetHero) {
          const hx = targetHero.x - monster.x;
          const hy = targetHero.y - monster.y;
          if (Math.abs(hx) > Math.abs(hy)) {
            monster.facingDir = hx > 0 ? 'E' : 'W';
          } else {
            monster.facingDir = hy > 0 ? 'S' : 'N';
          }
        }

        if (isFighting) {
          colCount = 6; // Slash has 6 frames
          if (monster.facingDir === 'N') rowOffset = 12;
          else if (monster.facingDir === 'W') rowOffset = 13;
          else if (monster.facingDir === 'S') rowOffset = 14;
          else if (monster.facingDir === 'E') rowOffset = 15;
        } else {
          colCount = 9; // Walk has 9 frames
          if (monster.facingDir === 'N') rowOffset = 8;
          else if (monster.facingDir === 'W') rowOffset = 9;
          else if (monster.facingDir === 'S') rowOffset = 10;
          else if (monster.facingDir === 'E') rowOffset = 11;
        }

        // Frame selection
        let frameIndex = 0;
        if (isFighting) {
          frameIndex = Math.floor(time * 0.008) % colCount;
        } else if (dist > 2) {
          frameIndex = Math.floor(time * 0.012) % colCount;
        } else {
          frameIndex = 0;
        }

        const sx = frameIndex * 64;
        const sy = rowOffset * 64;
        const sw = 64;
        const sh = 64;

        const size = monster.isBoss ? 96 : (monster.isMiniBoss ? 72 : 56);
        this.ctx.drawImage(img, sx, sy, sw, sh, -size / 2, -size + 4, size, size);
      } else {
        // --- Static 1024x1024 image ---
        const isFighting = (game && game.heroes) ? game.heroes.some(h => h.currentMap === 'hunt' && h.targetMonster === monster) : false;
        if (!isFighting) {
          const bounce = Math.abs(Math.sin(time * 0.012)) * 2;
          this.ctx.translate(0, -bounce);
        }
        const size = monster.isBoss ? 84 : (monster.isMiniBoss ? 64 : 48);
        this.ctx.drawImage(img, -size / 2, -size + 2, size, size);
      }

      this.ctx.restore();

      // Nome do Monstro
      this.ctx.fillStyle = monster.isBoss ? '#ffea3a' : '#ff9f3a';
      this.ctx.font = monster.isBoss ? 'bold 10px monospace' : '9px monospace';
      this.ctx.textAlign = 'center';
      const nameOffset = isSpritesheet ? 
        (monster.isBoss ? 80 : (monster.isMiniBoss ? 60 : 48)) : 
        (monster.isBoss ? 72 : (monster.isMiniBoss ? 54 : 42));
      this.ctx.fillText(monster.name, pos.x, pos.y - nameOffset);

      // Barra de HP
      const hpPct = monster.hp / monster.maxHp;
      const barW = monster.isBoss ? 45 : (monster.isMiniBoss ? 30 : 20);
      const barH = 3;
      
      const barOffset = isSpritesheet ? 
        (monster.isBoss ? 70 : (monster.isMiniBoss ? 52 : 40)) : 
        (monster.isBoss ? 62 : (monster.isMiniBoss ? 46 : 34));
      this.ctx.fillStyle = '#2c2e33';
      this.ctx.fillRect(pos.x - barW / 2, pos.y - barOffset, barW, barH);
      this.ctx.fillStyle = '#ff3d3d';
      this.ctx.fillRect(pos.x - barW / 2, pos.y - barOffset, barW * hpPct, barH);
    } else {
      // --- FALLBACK PROCEDURAL ORIGINAL ---
      const shadowSize = monster.isBoss ? 16 : (monster.isMiniBoss ? 11 : 7);
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(pos.x, pos.y + 8, shadowSize * 1.2, shadowSize * 0.35, 0, 0, Math.PI * 2);
      this.ctx.fill();

      if (name.includes('Saci-PererÃª')) {
        this.drawSaci(pos.x, pos.y, time);
      } else if (name.includes('Curupira')) {
        this.drawCurupira(pos.x, pos.y, time);
      } else if (name.includes('Mula sem CabeÃ§a')) {
        this.drawMula(pos.x, pos.y, time);
      } else if (name.includes('BoitatÃ¡')) {
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

    // CalÃ§Ã£o e perna
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

    // CÃ¡lculo do Dash de Combate
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

    // PosiÃ§Ã£o cartesiana do herÃ³i com o dash aplicado
    const cartX = hero.x + dx;
    const cartY = hero.y + dy;

    // ProjeÃ§Ã£o isomÃ©trica (Top-Down Ã© 1:1)
    const pos = this.toIso(cartX, cartY);
    const hx = pos.x;
    const hy = pos.y;

    const isWalking = hero.state === 'SEARCHING_MONSTER' || hero.state === 'RETURNING_TOWN' || hero.state === 'IDLE_TOWN';
    const step = isWalking ? Math.sin(time * 0.015) * 3 : 0;

    let imgKey = 'hero_warrior';
    if (hero.className === 'WARRIOR') imgKey = 'hero_warrior';
    else if (hero.className === 'MERCENARY') imgKey = 'hero_mercenary';
    else if (hero.className === 'MAGE') imgKey = 'hero_mage';
    else if (hero.className === 'PRIEST') imgKey = 'hero_priest';
    else if (hero.className === 'ARCHER') imgKey = 'hero_archer';

    let img = this.images[imgKey];
    if (!img || !img.loaded) {
      if (hero.className === 'MERCENARY') imgKey = 'hero_warrior';
      else if (hero.className === 'PRIEST') imgKey = 'hero_mage';
      img = this.images[imgKey];
    }

    if (img && img.loaded) {
      // --- DESENHAR HERÓI COM SPRITE DE PIXEL ART ---
      this.ctx.save();
      
      // Sombra
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(hx, hy + 4, 12, 3.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Transladar para o ponto de base dos pés no chão
      this.ctx.translate(hx, hy);

      const isSpritesheet = (img.naturalWidth === 832 || img.width === 832);

      if (isSpritesheet) {
        // Escalar herói por 1.8x
        this.ctx.scale(1.8, 1.8);

        // --- LPC Spritesheet Cropping & Animation for Heroes ---
        let rowOffset = 10; // Walk South
        let colCount = 9;
        const isFighting = hero.state === 'FIGHTING';

        // Calculate direction
        const dx = hero.targetX - hero.x;
        const dy = hero.targetY - hero.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!hero.facingDir) {
          hero.facingDir = 'S';
        }

        if (dist > 2) {
          if (Math.abs(dx) > Math.abs(dy)) {
            hero.facingDir = dx > 0 ? 'E' : 'W';
          } else {
            hero.facingDir = dy > 0 ? 'S' : 'N';
          }
        } else if (isFighting && hero.targetMonster) {
          const mx = hero.targetMonster.x - hero.x;
          const my = hero.targetMonster.y - hero.y;
          if (Math.abs(mx) > Math.abs(my)) {
            hero.facingDir = mx > 0 ? 'E' : 'W';
          } else {
            hero.facingDir = my > 0 ? 'S' : 'N';
          }
        }

        if (isFighting) {
          colCount = 6; // Slash has 6 frames
          if (hero.facingDir === 'N') rowOffset = 12;
          else if (hero.facingDir === 'W') rowOffset = 13;
          else if (hero.facingDir === 'S') rowOffset = 14;
          else if (hero.facingDir === 'E') rowOffset = 15;
        } else {
          colCount = 9; // Walk has 9 frames
          if (hero.facingDir === 'N') rowOffset = 8;
          else if (hero.facingDir === 'W') rowOffset = 9;
          else if (hero.facingDir === 'S') rowOffset = 10;
          else if (hero.facingDir === 'E') rowOffset = 11;
        }

        // Frame selection
        let frameIndex = 0;
        if (isFighting) {
          frameIndex = Math.floor(time * 0.008) % colCount;
        } else if (dist > 2) {
          frameIndex = Math.floor(time * 0.012) % colCount;
        } else {
          frameIndex = 0;
        }

        const sx = frameIndex * 64;
        const sy = rowOffset * 64;
        const sw = 64;
        const sh = 64;

        const size = 28; // Standard size inside scaled context
        this.ctx.drawImage(img, sx, sy, sw, sh, -size / 2, -size + 4, size, size);
      } else {
        // Escalar herói e equipamentos juntos por 1.8x
        this.ctx.scale(1.8, 1.8);

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

        // 1. DESENHAR ASAS (Atrás do corpo)
        this.drawHeroWingsStacked(hero, time);

        // 2. DESENHAR SPRITE CENTRADO (Corpo Base)
        const wSize = 28;
        const hSize = 28;
        this.ctx.drawImage(img, -wSize / 2, -hSize + 2, wSize, hSize);

        // 3. DESENHAR ARMADURA (Por cima do corpo)
        this.drawHeroArmorStacked(hero);

        // 4. DESENHAR CAPACETE (Por cima da cabeça)
        this.drawHeroHelmetStacked(hero);

        // 5. DESENHAR ARMA (Por cima de tudo)
        this.drawHeroWeaponStacked(hero);
      }

      this.ctx.restore();

      // Texto de Nome e Barra de Vida (não rotacionam/balançam)
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(hero.name, hx, hy - 54);

      // Barra de Vida
      const hpPct = Math.max(0, hero.hp / hero.maxHp);
      const barW = 20;
      const barH = 3;
      
      this.ctx.fillStyle = '#2c2e33';
      this.ctx.fillRect(hx - barW / 2, hy - 48, barW, barH);
      this.ctx.fillStyle = hpPct > 0.45 ? '#3aff7d' : '#ffea3a';
      if (hpPct < 0.2) this.ctx.fillStyle = '#ff3d3d';
      this.ctx.fillRect(hx - barW / 2, hy - 48, barW * hpPct, barH);

      // Auréola flutuante se Sacerdote
      if (hero.className === 'PRIEST') {
        this.ctx.strokeStyle = '#ffea3a';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(hx, hy - 60, 2.5, 0, Math.PI * 2);
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

      // Corpo / Armadura DinÃ¢mica
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

      // Cabelo e ChapÃ©us
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

      // Arma DinÃ¢mica
      this.drawHeroWeapon(hx, hy, hero);

      // Nome do HerÃ³i
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

  // --- RENDERING MODULAR DE EQUIPAMENTOS SOBREPOSTOS NO SPRITE PIXEL ART ---
  drawHeroWingsStacked(hero, time) {
    if (!hero.equipment.wings) return;
    
    this.ctx.save();
    const flap = Math.sin(time * 0.012) * 4;
    
    this.ctx.fillStyle = '#424242';
    this.ctx.strokeStyle = '#212121';
    this.ctx.lineWidth = 1;
    
    // Asa Esquerda
    this.ctx.beginPath();
    this.ctx.moveTo(-3, -12);
    this.ctx.lineTo(-15 - flap, -18);
    this.ctx.lineTo(-12 - flap, -6);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // Asa Direita
    this.ctx.beginPath();
    this.ctx.moveTo(3, -12);
    this.ctx.lineTo(15 + flap, -18);
    this.ctx.lineTo(12 + flap, -6);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  drawHeroArmorStacked(hero) {
    if (!hero.equipment.armor) return;
    
    const tier = hero.equipment.armor.tier;
    this.ctx.save();
    
    if (hero.className === 'WARRIOR' || hero.className === 'MERCENARY') {
      this.ctx.fillStyle = tier === 3 ? '#cca93d' : (tier === 2 ? '#4e5a66' : '#818b96');
      this.ctx.fillRect(-6, -15, 3, 3);
      this.ctx.fillRect(3, -15, 3, 3);
      this.ctx.fillRect(-4, -14, 8, 6);
      
      if (tier === 3) {
        this.ctx.fillStyle = '#ffea3a';
        this.ctx.fillRect(-2, -12, 4, 2);
      }
    } else if (hero.className === 'ARCHER') {
      this.ctx.fillStyle = tier === 3 ? '#bf360c' : (tier === 2 ? '#8d6e63' : '#a1887f');
      this.ctx.fillRect(-4, -14, 8, 5);
      this.ctx.fillStyle = '#3e2723';
      this.ctx.fillRect(-3, -14, 1, 5);
      this.ctx.fillRect(2, -11, 1, 2);
    } else {
      this.ctx.fillStyle = tier === 3 ? '#4a148c' : (tier === 2 ? '#0288d1' : '#b0bec5');
      this.ctx.fillRect(-4, -14, 8, 7);
      this.ctx.fillStyle = '#ffea3a';
      this.ctx.fillRect(-4, -8, 8, 1);
    }
    
    this.ctx.restore();
  }

  drawHeroHelmetStacked(hero) {
    if (!hero.equipment.helmet) return;
    
    const tier = hero.equipment.helmet.tier;
    this.ctx.save();
    
    if (hero.className === 'WARRIOR' || hero.className === 'MERCENARY') {
      this.ctx.fillStyle = tier === 3 ? '#cca93d' : (tier === 2 ? '#4e5a66' : '#818b96');
      this.ctx.fillRect(-5, -27, 10, 4);
      this.ctx.fillRect(-6, -23, 12, 2);
      this.ctx.fillRect(-1, -21, 2, 3);
      
      this.ctx.fillStyle = tier === 3 ? '#2979ff' : '#ff1744';
      this.ctx.fillRect(-1, -29, 2, 2);
    } else if (hero.className === 'ARCHER') {
      this.ctx.fillStyle = tier === 3 ? '#d84315' : (tier === 2 ? '#2e7d32' : '#5d4037');
      this.ctx.fillRect(-5, -26, 10, 3);
      this.ctx.fillRect(-6, -23, 3, 4);
      this.ctx.fillRect(3, -23, 3, 4);
    } else {
      if (hero.className === 'MAGE') {
        this.ctx.fillStyle = tier === 3 ? '#4a148c' : (tier === 2 ? '#0288d1' : '#511b85');
        this.ctx.fillRect(-6, -24, 12, 2);
        this.ctx.beginPath();
        this.ctx.moveTo(-4, -24);
        this.ctx.lineTo(4, -24);
        this.ctx.lineTo(0, -31);
        this.ctx.closePath();
        this.ctx.fill();
      } else {
        this.ctx.fillStyle = tier === 3 ? '#ffea3a' : (tier === 2 ? '#80deea' : '#b0bec5');
        this.ctx.fillRect(-5, -24, 10, 2);
        this.ctx.fillStyle = tier === 3 ? '#d500f9' : '#00e5ff';
        this.ctx.fillRect(-1, -25, 2, 2);
      }
    }
    
    this.ctx.restore();
  }

  drawHeroWeaponStacked(hero) {
    if (!hero.equipment.weapon) return;
    
    const tier = hero.equipment.weapon.tier;
    const isAttacking = hero.state === 'FIGHTING' && hero.cooldownTimer > 0;
    const wx = isAttacking ? 6 : -6;
    const wy = isAttacking ? -8 : -10;
    
    let weaponColor = '#bf9b30';
    if (tier === 1) weaponColor = '#818b96';
    if (tier === 2) weaponColor = '#4e5b66';
    if (tier === 3) weaponColor = '#ffea3a';
    
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
      
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
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

      // Arqueiro (ParÃ¡bola 2D clÃ¡ssica)
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
        this.ctx.fillText('ðŸŒ™ Noite', 14, 19);
      }
      this.ctx.restore();
    } else {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.fillRect(8, 8, 55, 16);
      this.ctx.fillStyle = '#3aff7d';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('â˜€ï¸ Dia', 16, 19);
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



