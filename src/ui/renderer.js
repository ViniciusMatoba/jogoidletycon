import { HERO_CLASSES, BIOMES, ITEMS_INFO } from '../data/constants.js';

import {
  getTownGridMetrics,
  gridToScreen,
  screenToGrid
} from '../core/navigation.js';

const BUILDING_LEVEL_SCALE = [1.0, 1.12, 1.26]; // escala visual por nível (índice = level - 1)

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
    this.pendingPlacement = null;
    this.pendingPlacementFlipped = false;
    this.hoveredTile = null;
    this.cameraX = 0;
    this.cameraY = 0;
    this.maxCameraX = 160;
    this.maxCameraY = 90;
    this.isDragging = false;
    this.hasDragged = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.startCamX = 0;
    this.startCamY = 0;
    this.loadImages();

    // Sistema de projéteis animados (flechas, bolas de fogo, raios sagrados)
    this.projectiles = [];
    this._impacts = [];
    this._meleeEffects = [];
    // Referência ao addFloater do game (injetada depois)
    this._addFloater = null;
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

      // Se o pixel superior esquerdo já for transparente, assume que a imagem é um PNG limpo,
      // mas ainda assim roda a passada global de despeckle (alguns PNGs "limpos" trazem halo residual)
      const alreadyTransparent = bgA < 50;

      // Função para verificar se a cor do pixel é considerada fundo (branco, cinza quadriculado,
      // ou qualquer tom acromático claro — cobre também o antialiasing entre branco e cinza)
      const isBackground = (r, g, b, a) => {
        if (a < 50) return true; // Já transparente

        if (!alreadyTransparent) {
          // Canto / Fundo original
          const distFromBg = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
          if (distFromBg < 40) return true;
        }

        // Acromático claro (branco puro ao cinza quadriculado, incluindo antialiasing
        // intermediário entre os dois tons — faixa ampliada de 150 a 256)
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        if (maxC > 150 && (maxC - minC) < 14) return true;

        return false;
      };

      // Adicionar bordas na fila como sementes
      const visited = new Uint8Array(width * height);
      const queue = [];

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

      // Loop do Flood Fill (8-direções para alcançar diagonais e não travar em corredores finos de antialiasing)
      let head = 0;
      while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        const idx = cy * width + cx;

        data[idx * 4 + 3] = 0;

        const dirs = [
          [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
          [cx + 1, cy + 1], [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1]
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

      // Segunda passada — despeckle global: qualquer pixel isolado (sem vizinhos opacos
      // suficientes) que ainda seja claro/acromático e não tenha sido alcançado pelo
      // flood-fill (preso em "ilhas" cercadas por linhas do sprite) também é removido.
      // Isso elimina o resíduo de antialiasing do quadriculado que sobrava como halo.
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (data[idx * 4 + 3] === 0) continue;

          const r = data[idx * 4];
          const g = data[idx * 4 + 1];
          const b = data[idx * 4 + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const isLightAchromatic = maxC > 165 && (maxC - minC) < 18;

          if (!isLightAchromatic) continue;

          // Conta vizinhos opacos e "coloridos" (não-fundo) num raio de 1
          let solidNeighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              const nidx = ny * width + nx;
              if (data[nidx * 4 + 3] === 0) continue;
              const nr = data[nidx * 4], ng = data[nidx * 4 + 1], nb = data[nidx * 4 + 2];
              const nMax = Math.max(nr, ng, nb), nMin = Math.min(nr, ng, nb);
              const nIsLight = nMax > 165 && (nMax - nMin) < 18;
              if (!nIsLight) solidNeighbors++;
            }
          }

          // Pixel claro isolado sem vizinhança sólida real ao redor: é resíduo de fundo
          if (solidNeighbors < 2) {
            data[idx * 4 + 3] = 0;
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
      'forge': 'assets/buildings/forge.png',
      'market': 'assets/buildings/market.png',      // Heróis
      'hero_warrior_walk': 'assets/sprites/guerreiro_walk.png',
      'hero_warrior_slash': 'assets/sprites/guerreiro_slash.png',
      'hero_warrior_thrust': 'assets/sprites/guerreiro_thrust.png',
      'hero_warrior_shoot': 'assets/sprites/guerreiro_shoot.png',
      'hero_warrior_cast': 'assets/sprites/guerreiro_cast.png',
      'hero_warrior_hurt': 'assets/sprites/guerreiro_hurt.png',
      'hero_warrior_idle': 'assets/sprites/guerreiro_idle.png',
      'hero_warrior_islash': 'assets/sprites/guerreiro_islash.png',
      'hero_mercenary': 'assets/sprites/hero_mercenary_universal.png',
      'hero_mage': 'assets/sprites/mago_universal.png',
      'hero_priest_walk': 'assets/sprites/sacer_walk.png',
      'hero_priest_slash': 'assets/sprites/sacer_slash.png',
      'hero_priest_thrust': 'assets/sprites/sacer_thrust.png',
      'hero_priest_shoot': 'assets/sprites/sacer_shoot.png',
      'hero_priest_cast': 'assets/sprites/sacer_cast.png',
      'hero_priest_hurt': 'assets/sprites/sacer_hurt.png',
      'hero_priest_idle': 'assets/sprites/sacer_idle.png',
      'hero_priest_islash': 'assets/sprites/sacer_islash.png',
      'hero_archer': 'assets/sprites/arqueira_universal.png',
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
      'monster_mapinguari': 'assets/sprites/mapinguari_universal.png',
      // Monstros LPC gerados programaticamente
      'monster_goblin':             'assets/sprites/monster_goblin_universal.png',
      'monster_esqueleto':          'assets/sprites/monster_esqueleto_universal.png',
      'monster_orc':                'assets/sprites/monster_orc_universal.png',
      'monster_cavaleiro_sombrio':  'assets/sprites/monster_cavaleiro_sombrio_universal.png',
      'monster_feiticeira':         'assets/sprites/monster_feiticeira_universal.png',
      'monster_capitao_orc':        'assets/sprites/monster_capitao_orc_universal.png',
      'monster_lich':               'assets/sprites/monster_lich_universal.png',
      'monster_rei_demonios':       'assets/sprites/monster_rei_demonios_universal.png',
      'monster_dragonborn_boss':    'assets/sprites/monster_dragonborn_boss_universal.png'
    };

    // -----------------------------------------------------------------
    // CARREGAMENTO DINÂMICO DE CAMADAS UNIVERSAIS DO HERÓI (LPC)
    // -----------------------------------------------------------------
    const bodies = ['male', 'female', 'muscular', 'skeleton', 'zombie', 'male_green', 'female_green', 'male_blue', 'female_blue'];
    for (const b of bodies) {
      assetsList[`body_${b}`] = `assets/sprites/body_${b}_universal.png`;
    }

    const hairStyles = ['plain', 'messy', 'loose', 'braid', 'mohawk'];
    const hairColors = ['black', 'brown', 'blonde', 'red', 'white', 'blue', 'green', 'purple', 'gold', 'pink'];
    for (const style of hairStyles) {
      for (const color of hairColors) {
        assetsList[`hair_${style}_${color}`] = `assets/sprites/hair_${style}_${color}_universal.png`;
      }
    }

    const armorTypes = ['heavy', 'medium', 'light'];
    const armorGenders = ['male', 'female'];
    for (const type of armorTypes) {
      for (let tier = 1; tier <= 3; tier++) {
        for (const gender of armorGenders) {
          assetsList[`armor_${type}_t${tier}_${gender}`] = `assets/sprites/armor_${type}_t${tier}_${gender}_universal.png`;
        }
      }
    }

    const helmets = ['armet', 'barbarian', 'magic_hat', 'headband'];
    for (const h of helmets) {
      assetsList[`helmet_${h}`] = `assets/sprites/helmet_${h}_universal.png`;
    }

    assetsList['weapon_longsword'] = 'assets/sprites/weapon_longsword_universal.png';
    assetsList['weapon_dagger']    = 'assets/sprites/weapon_dagger_universal.png';
    assetsList['weapon_bow']       = 'assets/sprites/weapon_bow_universal.png';
    assetsList['weapon_staff']     = 'assets/sprites/weapon_staff_universal.png';
    assetsList['weapon_shield']    = 'assets/sprites/weapon_shield_universal.png';

    for (const key in assetsList) {
      const img = new Image();
      img.src = assetsList[key];

      // Backgrounds de tela cheia NÃO devem passar pelo chroma key —
      // eles têm pixels claros (céu, chão, árvores) que seriam removidos incorretamente
      const isBackground = key.startsWith('bg_');

      img.onload = () => {
        if (isBackground) {
          img.loaded = true;
          this.images[key] = img;
          if (key.startsWith('tile_')) {
            this.patterns[key] = this.ctx.createPattern(img, 'repeat');
          }
        } else {
          const process = () => {
            const cleanCanvas = this.makeImageTransparent(img);
            cleanCanvas.loaded = true;
            this.images[key] = cleanCanvas;
            if (key.startsWith('tile_')) {
              this.patterns[key] = this.ctx.createPattern(cleanCanvas, 'repeat');
            }
          };
          if ('requestIdleCallback' in window) {
            requestIdleCallback(process);
          } else {
            setTimeout(process, 0);
          }
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

  getTownGridMetrics(town, width = this.canvas.width, height = this.canvas.height) {
    return getTownGridMetrics(town, width, height);
  }

  gridToScreen(col, row, metrics) {
    return gridToScreen(col, row, metrics);
  }

  screenToGrid(x, y, town) {
    return screenToGrid(x, y, town, this.canvas.width, this.canvas.height);
  }

  getBuildingScreenPosition(town, buildingType, metrics = null) {
    const placement = town.getBuildingPlacement(buildingType);
    if (!placement) return null;

    const footprint = town.getBuildingFootprint(buildingType);
    if (!metrics) metrics = this.getTownGridMetrics(town);
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

  drawTownGridTiles(town, width, height, time = performance.now()) {
    const metrics = this.getTownGridMetrics(town, width, height);
    const now = time;

    // Zona de construção: grid completo (sem restrição de borda)
    const BUILD_COL_MIN = 0, BUILD_COL_MAX = town.grid.cols;
    const BUILD_ROW_MIN = 0, BUILD_ROW_MAX = town.grid.rows;

    // Calcular quais células estão ocupadas por edifícios construídos
    const occupiedCells = new Set();
    town.getPlacedBuildings().forEach(placed => {
      const fp = placed.footprint;
      for (let dy = 0; dy < fp.h; dy++) {
        for (let dx = 0; dx < fp.w; dx++) {
          occupiedCells.add(`${placed.col + dx},${placed.row + dy}`);
        }
      }
    });

    if (this.pendingPlacement) {
      // === MODO DE COLOCAÇÃO: quadriculado completo + highlight da zona permitida ===
      for (let row = 0; row < town.grid.rows; row++) {
        for (let col = 0; col < town.grid.cols; col++) {
          const checker = (col + row) % 2 === 0;
          const inBuildZone = col >= BUILD_COL_MIN && col < BUILD_COL_MAX &&
                              row >= BUILD_ROW_MIN && row < BUILD_ROW_MAX;

          if (inBuildZone) {
            // Células na zona válida: verde pulsante mais forte
            const pulse = 0.25 + 0.10 * Math.sin(now * 0.002 + col * 0.5 + row * 0.7);
            this.drawIsoTile(col, row, metrics,
              checker ? `rgba(54, 120, 49, ${pulse})` : `rgba(38, 100, 38, ${pulse})`,
              'rgba(88, 180, 88, 0.25)'
            );
          } else {
            // Células fora da zona: tom escuro neutro
            this.drawIsoTile(col, row, metrics,
              checker ? 'rgba(30, 45, 30, 0.20)' : 'rgba(25, 38, 25, 0.20)',
              'rgba(20, 30, 20, 0.08)'
            );
          }
        }
      }
    } else {
      // === MODO NORMAL: marcar suavemente as áreas disponíveis para construção ===
      // Pulsação global sincronizada (0.12 a 0.22 de opacidade — visível sobre o bg_town)
      const globalPulse = 0.12 + 0.06 * Math.sin(now * 0.0015);

      for (let row = BUILD_ROW_MIN; row < BUILD_ROW_MAX; row++) {
        for (let col = BUILD_COL_MIN; col < BUILD_COL_MAX; col++) {
          const isOccupied = occupiedCells.has(`${col},${row}`);

          if (isOccupied) {
            // Célula ocupada por um prédio: marcação dourada discreta
            this.drawIsoTile(col, row, metrics,
              'rgba(200, 160, 60, 0.10)',
              'rgba(220, 180, 60, 0.30)'
            );
          } else {
            // Célula livre: marcação verde-menta pulsante — indica que é clicável
            const localPulse = globalPulse + 0.04 * Math.sin(now * 0.002 + col * 0.4 + row * 0.6);
            this.drawIsoTile(col, row, metrics,
              `rgba(80, 220, 110, ${localPulse})`,
              'rgba(60, 200, 90, 0.35)'
            );
          }
        }
      }
    }

    // Highlight do tile hovered durante colocação
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
    if (this.activeView === 'hunt') {
      this.cameraX = 0;
      this.cameraY = 0;
    }

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

    // Se for Cidade, desenha o background HD e as tiles sob translação
    if (this.activeView === 'town') {
      const bg = this.images['bg_town'];
      if (bg && bg.loaded) {
        // Calcular proporção para cobrir todo o canvas mantendo aspect ratio
        const bgNatW = bg.naturalWidth || bg.width || 1280;
        const bgNatH = bg.naturalHeight || bg.height || 720;
        const scaleX = (width + Math.abs(this.maxCameraX) * 2) / bgNatW;
        const scaleY = (height + Math.abs(this.maxCameraY) * 2) / bgNatH;
        const scale = Math.max(scaleX, scaleY);
        const bgW = bgNatW * scale;
        const bgH = bgNatH * scale;
        const bx = (width - bgW) / 2;
        const by = (height - bgH) / 2;
        this.ctx.drawImage(bg, bx, by, bgW, bgH);
      } else {
        // Fallback: fundo verde escuro com textura se o bg não carregar
        this.ctx.fillStyle = '#1e3320';
        this.ctx.fillRect(-this.maxCameraX, -this.maxCameraY, width + this.maxCameraX * 2, height + this.maxCameraY * 2);
      }
      this.drawTownGridTiles(game.town, width, height, time);
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
        forge: { name: 'Forja', icon: '⚒️' },
        market: { name: 'Mercado da Vila', icon: '⚖️' }
      };

      const townMetrics = this.getTownGridMetrics(game.town, width, height);
      game.town.getPlacedBuildings().forEach(placed => {
        const pos = this.getBuildingScreenPosition(game.town, placed.key, townMetrics);
        if (!pos) return;
        const meta = buildingLabels[placed.key] || { name: placed.key, icon: '🏠' };
        const b = { key: placed.key, x: pos.x, y: pos.y, name: meta.name, icon: meta.icon };
        renderList.push({
          y: b.y,
          render: () => this.drawBuildingIndividual(game.town, b, time)
        });
      });

      // Desenhar preview do prédio em posicionamento
      if (this.pendingPlacement && this.hoveredTile) {
        const footprint = game.town.getBuildingFootprint(this.pendingPlacement);
        const metrics = this.getTownGridMetrics(game.town, width, height);
        const center = this.gridToScreen(
          this.hoveredTile.col + footprint.w / 2,
          this.hoveredTile.row + footprint.h / 2,
          metrics
        );
        const bx = center.x;
        const by = center.y + metrics.tileH * footprint.h * 0.34;
        const meta = buildingLabels[this.pendingPlacement] || { name: this.pendingPlacement, icon: '🏠' };
        const b = { key: this.pendingPlacement, x: bx, y: by, name: meta.name, icon: meta.icon, isPreview: true };
        renderList.push({
          y: b.y,
          render: () => {
            this.ctx.save();
            this.ctx.globalAlpha = 0.6;
            this.drawBuildingIndividual(game.town, b);
            this.ctx.restore();
          }
        });
      }
      // Árvores decorativas participam do Y-sorting para Z-order correto com heróis/monstros
      this.trees.forEach(tree => {
        renderList.push({
          y: tree.y,
          render: () => this.drawPixelTree(tree.x, tree.y)
        });
      });

      // Heróis ativos na cidade (escondidos se estiverem dentro de um prédio construído)
      game.heroes.forEach(h => {
        if (h.currentMap === 'town') {
          const isInsideHospital = h.state === 'HEALING_HOSP' && game.town.isBuilt('hospital');
          const isInsideRestaurant = h.state === 'EATING_REST' && game.town.isBuilt('restaurant');
          const isInsideHotel = h.state === 'RESTING_HOTEL' && game.town.isBuilt('hotel');
          const isInsideTavern = h.state === 'DRINKING_TAVERN' && game.town.isBuilt('tavern');
          const isInsideMarket = h.state === 'SELLING_LOOT' && game.town.isBuilt('market');

          if (isInsideHospital || isInsideRestaurant || isInsideHotel || isInsideTavern || isInsideMarket) {
            return; // Esconde o caçador
          }

          renderList.push({
            y: h.y,
            render: () => this.drawHeroIndividual(h, time)
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
            render: () => this.drawMonsterIndividual(m, game, time)
          });
        }
      });

      // Heróis ativos na caçada
      game.heroes.forEach(h => {
        if (h.currentMap === 'hunt') {
          renderList.push({
            y: h.y,
            render: () => this.drawHeroIndividual(h, time)
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

    // 4. Desenhar Efeitos de Batalha (projéteis por classe)
    this.drawCombatEffects(game.heroes, dt, this._addFloater);

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
  drawTerrain(game, w, h, time = performance.now()) {
    const biome = game.spawner.getBiomeConfig();

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
  drawBuildingIndividual(town, b, time = performance.now()) {
    let level = town.buildings[b.key] || 0;
    if (b.isPreview && level === 0) level = 1;
    const isBuilt = b.isPreview ? true : level > 0;

    const bx = b.x;
    const by = b.y;

    const metrics = this.getTownGridMetrics(town);
    const fp = town.getBuildingFootprint(b.key);
    const isoFootprintW = (fp.w + fp.h) * metrics.tileW / 2;
    const baseSize = isoFootprintW * 1.05;

    const wSize = baseSize;
    const hSize = baseSize;

    const rx = bx - wSize / 2;
    const ry = by - hSize + 10;
    const rw = wSize;
    const rh = hSize - 10;

    this.ctx.save();

    if (b.isPreview) {
      this.ctx.globalAlpha = 0.6;
    }
    // Lote só no fallback geométrico (sem imagem) — com imagem PNG o lot causa "sombra" indesejada
    const hasImg = isBuilt && this.images[b.key]?.loaded;
    if (!hasImg) {
      this.drawBuildingLot(bx, by, wSize, hSize, isBuilt ? level : 1);
    }

    const isFlipped = b.isPreview ? !!this.pendingPlacementFlipped : !!(town.getBuildingPlacement(b.key)?.flipped);

    if (isBuilt) {
      const img = this.images[b.key];
      let iconY = by - hSize + 5; // caso: preview/sem imagem ainda carregada

      if (img && img.loaded) {
        this.ctx.save();
        
        // Variação de escala por nível (Nível 1: 1.0x, Nível 2: 1.12x, Nível 3: 1.26x)
        const scaleMult = BUILDING_LEVEL_SCALE[Math.min(level - 1, 2)];
        const imgBase = isoFootprintW * 1.5;
        const dw = imgBase * scaleMult;
        const dh = imgBase * scaleMult;
        
        const dx = bx - dw / 2;
        const dy = by - dh + 8;
        iconY = by - dh + 20; // caso: imagem PNG carregada

        if (isFlipped) {
          this.ctx.translate(bx, by);
          this.ctx.scale(-1, 1);
          this.ctx.translate(-bx, -by);
        }

        this.ctx.drawImage(img, dx, dy, dw, dh);
        this.ctx.restore();

        // Efeito premium no Nível 3: Brilhos dourados flutuando
        if (level >= 3 && !b.isPreview) {
          this.ctx.fillStyle = '#ffea3a';
          const time2 = time * 0.003;
          for (let i = 0; i < 4; i++) {
            const px = bx + Math.sin(time2 + i * 1.5) * (dw * 0.35);
            const py = by - dh * 0.75 + Math.cos(time2 * 0.8 + i * 2) * 10 - (time2 * 10 + i * 12) % 15;
            const pSize = 1.2 + Math.abs(Math.sin(time2 * 2 + i)) * 1.5;
            this.ctx.fillRect(px - pSize/2, py - pSize/2, pSize, pSize);
          }
        }
      } else {
        // Fallback geométrico
        this.ctx.save();
        if (isFlipped) {
          this.ctx.translate(bx, by);
          this.ctx.scale(-1, 1);
          this.ctx.translate(-bx, -by);
        }
        this.drawBuildingByStage(b, level, wSize, hSize);
        this.ctx.restore();

        const shape = this.getBuildingShape(b.key, level);
        const roofH = level === 1 ? 16 : 20;
        iconY = by - shape.bodyH - 8 - roofH + 6 - 6; // caso: fallback geométrico
      }

      // Desenhar ícone do prédio (fora do flip para não espelhar)
      this.ctx.save();
      this.ctx.font = '14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(b.icon, bx, iconY);
      this.ctx.restore();

      // Nível do Prédio
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '10px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`Lvl ${level}`, bx, by + 14);
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
      forge: { bodyW: 40, bodyH: 28 },
      market: { bodyW: 42, bodyH: 30 }
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

    if (key === 'market') {
      this.drawHangingSign(bx, bodyY - 5, '#8d6e63', '⚖️');
      
      // Desenhar bancada de madeira
      this.ctx.fillStyle = '#b0bec5';
      this.ctx.fillRect(bodyX + 4, by - 12, bodyW - 8, 3);
      
      // Toldo listrado (Vermelho e Branco) sobre a bancada
      this.ctx.fillStyle = '#d32f2f';
      this.ctx.fillRect(bodyX + 6, bodyY + 12, 6, 4);
      this.ctx.fillRect(bodyX + 18, bodyY + 12, 6, 4);
      this.ctx.fillRect(bodyX + 30, bodyY + 12, 6, 4);
      
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(bodyX + 12, bodyY + 12, 6, 4);
      this.ctx.fillRect(bodyX + 24, bodyY + 12, 6, 4);
      
      // Suportes do toldo
      this.ctx.fillStyle = '#5d4037';
      this.ctx.fillRect(bodyX + 4, bodyY + 16, 2, bodyH - 14);
      this.ctx.fillRect(bodyX + bodyW - 6, bodyY + 16, 2, bodyH - 14);
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

  // --- ELEMENTOS DE DECORAÇÃO DE BACKGROUND (MURAIS, LAMPIÃ•ES, PORTAIS) ---
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
    if (!town.isBuilt(bKey)) return null;
    const pos = this.getBuildingScreenPosition(town, bKey);
    if (!pos) return null;
    // offsets da chaminé relativo ao centro isométrico do prédio
    const chimneyOffsets = {
      restaurant: { dx: 20, dy: -30 },
      hospital:   { dx: 15, dy: -35 },
      tavern:     { dx: 22, dy: -28 },
      forge:      { dx: 18, dy: -25 }
    };
    const off = chimneyOffsets[bKey] || { dx: 14, dy: -16 };
    return { x: pos.x + off.dx, y: pos.y + off.dy };
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
  drawMonsterIndividual(monster, game, time = performance.now()) {
    const pos = this.toIso(monster.x, monster.y);

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

        const size = monster.isBoss ? 134 : (monster.isMiniBoss ? 100 : 78);
        this.ctx.drawImage(img, sx, sy, sw, sh, -size / 2, -size + 4, size, size);
      } else {
        // --- Static 1024x1024 image ---
        const isFighting = (game && game.heroes) ? game.heroes.some(h => h.currentMap === 'hunt' && h.targetMonster === monster) : false;
        if (!isFighting) {
          const bounce = Math.abs(Math.sin(time * 0.012)) * 2;
          this.ctx.translate(0, -bounce);
        }
        const size = monster.isBoss ? 118 : (monster.isMiniBoss ? 90 : 67);
        this.ctx.drawImage(img, -size / 2, -size + 2, size, size);
      }

      this.ctx.restore();

      // Nome do Monstro
      this.ctx.fillStyle = monster.isBoss ? '#ffea3a' : '#ff9f3a';
      this.ctx.font = monster.isBoss ? 'bold 10px monospace' : '9px monospace';
      this.ctx.textAlign = 'center';
      const nameOffset = isSpritesheet ? 
        (monster.isBoss ? 112 : (monster.isMiniBoss ? 84 : 67)) : 
        (monster.isBoss ? 100 : (monster.isMiniBoss ? 76 : 58));
      this.ctx.fillText(monster.name, pos.x, pos.y - nameOffset);

      // Barra de HP
      const hpPct = monster.hp / monster.maxHp;
      const barW = monster.isBoss ? 45 : (monster.isMiniBoss ? 30 : 20);
      const barH = 3;
      
      const barOffset = isSpritesheet ? 
        (monster.isBoss ? 98 : (monster.isMiniBoss ? 73 : 56)) : 
        (monster.isBoss ? 86 : (monster.isMiniBoss ? 64 : 48));
      this.ctx.fillStyle = '#2c2e33';
      this.ctx.fillRect(pos.x - barW / 2, pos.y - barOffset, barW, barH);
      this.ctx.fillStyle = '#ff3d3d';
      this.ctx.fillRect(pos.x - barW / 2, pos.y - barOffset, barW * hpPct, barH);

      // Indicador de AGGRO: brilho vermelho pulsante quando perseguindo her\u00f3i
      if (monster.targetHero) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 0.02);
        this.ctx.save();
        this.ctx.fillStyle = `rgba(255, 30, 30, ${0.5 + pulse * 0.4})`;
        this.ctx.font = 'bold 10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('!', pos.x, pos.y - nameOffset - 9);
        this.ctx.restore();
      }
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
  drawHeroIndividual(hero, time = performance.now()) {
    this.ctx.save();

    // Se for fantasma, desenhar com opacidade suave (35% transparente)
    if (hero.isGhost) {
      this.ctx.globalAlpha = 0.35;
    }

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

    let imgKey = 'hero_warrior';
    if (hero.className === 'WARRIOR') imgKey = 'hero_warrior';
    else if (hero.className === 'MERCENARY') imgKey = 'hero_mercenary';
    else if (hero.className === 'MAGE') imgKey = 'hero_mage';
    else if (hero.className === 'PRIEST') imgKey = 'hero_priest';
    else if (hero.className === 'ARCHER') imgKey = 'hero_archer';

    let img = this.images[imgKey];
    let isSplit = false;
    const isFighting = hero.state === 'FIGHTING';
    let action = 'walk';
    if (isFighting) {
      if (hero.className === 'ARCHER') action = 'shoot';
      else if (hero.className === 'MAGE' || hero.className === 'PRIEST') action = 'cast';
      else action = 'slash';
    }

    if (!img || !img.loaded) {
      const splitKey = `${imgKey}_${action}`;
      if (this.images[splitKey] && this.images[splitKey].loaded) {
        img = this.images[splitKey];
        isSplit = true;
      } else {
        // Fallbacks para classes alternativas
        if (hero.className === 'MERCENARY') imgKey = 'hero_warrior';
        else if (hero.className === 'PRIEST') imgKey = 'hero_mage';
        
        // Verifica se a classe do fallback também é split
        img = this.images[imgKey];
        if (!img || !img.loaded) {
          const fbSplitKey = `${imgKey}_${action}`;
          if (this.images[fbSplitKey] && this.images[fbSplitKey].loaded) {
            img = this.images[fbSplitKey];
            isSplit = true;
          }
        }
      }
    }

    // --- DESENHAR BRILHO DE RARIDADE (Aura sob os pés) ---
    if (hero.rarityGlow && hero.rarityGlow.enabled) {
      this.ctx.save();
      const pulse = 1 + Math.sin(time * 0.005 * hero.rarityGlow.pulseSpeed) * 0.15 * hero.rarityGlow.intensity;
      const radius = 22 * pulse;
      
      const grad = this.ctx.createRadialGradient(hx, hy + 2, 2, hx, hy + 2, radius);
      const colorHex = hero.rarityGlow.color;
      grad.addColorStop(0, colorHex + 'b0');
      grad.addColorStop(0.5, colorHex + '40');
      grad.addColorStop(1, colorHex + '00');
      
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.ellipse(hx, hy + 2, radius, radius * 0.35, 0, 0, Math.PI * 2);
      this.ctx.fill();

      if (hero.rarity === 'Lendário') {
        this.ctx.strokeStyle = '#ffea3a70';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.ellipse(hx, hy + 2, radius * 0.8, radius * 0.8 * 0.35, 0, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();
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

      const hasLayeredCosmetics = (hero.cosmetics && hero.cosmetics.bodyType);
      const isSpritesheet = (img.naturalWidth === 832 || img.width === 832 || isSplit);

      if (hasLayeredCosmetics) {
        // Escalar por 2.5x (otimização mobile)
        this.ctx.scale(2.5, 2.5);

        // --- LPC Spritesheet Cropping & Animation for Layered Heroes ---
        let action = 'walk';
        let colCount = 9;
        let rowOffset = 10; // Walk South por padrão
        const isFighting = hero.state === 'FIGHTING';

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

        // Configuração de animação com base no estado e classe
        if (isFighting) {
          if (hero.className === 'ARCHER') {
            action = 'shoot';
            colCount = 13;
            if (hero.facingDir === 'N') rowOffset = 16;
            else if (hero.facingDir === 'W') rowOffset = 17;
            else if (hero.facingDir === 'S') rowOffset = 18;
            else if (hero.facingDir === 'E') rowOffset = 19;
          } else if (hero.className === 'MAGE' || hero.className === 'PRIEST') {
            action = 'cast';
            colCount = 7;
            if (hero.facingDir === 'N') rowOffset = 0;
            else if (hero.facingDir === 'W') rowOffset = 1;
            else if (hero.facingDir === 'S') rowOffset = 2;
            else if (hero.facingDir === 'E') rowOffset = 3;
          } else {
            action = 'slash';
            colCount = 6;
            if (hero.facingDir === 'N') rowOffset = 12;
            else if (hero.facingDir === 'W') rowOffset = 13;
            else if (hero.facingDir === 'S') rowOffset = 14;
            else if (hero.facingDir === 'E') rowOffset = 15;
          }
        } else {
          action = 'walk';
          colCount = 9;
          if (hero.facingDir === 'N') rowOffset = 8;
          else if (hero.facingDir === 'W') rowOffset = 9;
          else if (hero.facingDir === 'S') rowOffset = 10;
          else if (hero.facingDir === 'E') rowOffset = 11;
        }

        // Frame index
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
        const size = 28;

        // Desenhar as Camadas
        // 1. Corpo
        const bodyImg = this.images[`body_${hero.cosmetics.bodyType}`];
        if (bodyImg && bodyImg.loaded) {
          this.ctx.drawImage(bodyImg, sx, sy, sw, sh, -size / 2, -size + 4, size, size);

          // 2. Cabelo (se houver)
          if (hero.cosmetics.hairStyle !== 'none') {
            const hairImg = this.images[`hair_${hero.cosmetics.hairStyle}_${hero.cosmetics.hairColor}`];
            if (hairImg && hairImg.loaded) {
              this.ctx.drawImage(hairImg, sx, sy, sw, sh, -size / 2, -size + 4, size, size);
            }
          }

          // 3. Armadura (se equipada)
          if (hero.equipment.armor) {
            let armorType = 'heavy';
            if (hero.className === 'MERCENARY' || hero.className === 'ARCHER') armorType = 'medium';
            else if (hero.className === 'MAGE' || hero.className === 'PRIEST') armorType = 'light';

            const armorImg = this.images[`armor_${armorType}_t${hero.equipment.armor.tier}_${hero.cosmetics.gender}`];
            if (armorImg && armorImg.loaded) {
              this.ctx.drawImage(armorImg, sx, sy, sw, sh, -size / 2, -size + 4, size, size);
            }
          }

          // 4. Capacete (se equipado)
          if (hero.equipment.helmet) {
            let helmetType = 'armet';
            if (hero.className === 'MERCENARY') helmetType = 'barbarian';
            else if (hero.className === 'ARCHER') helmetType = 'headband';
            else if (hero.className === 'MAGE') helmetType = 'magic_hat';
            else if (hero.className === 'PRIEST') helmetType = 'headband';

            const helmetImg = this.images[`helmet_${helmetType}`];
            if (helmetImg && helmetImg.loaded) {
              this.ctx.drawImage(helmetImg, sx, sy, sw, sh, -size / 2, -size + 4, size, size);
            }
          }

          // 5. Escudo (se Guerreiro com arma equipada)
          if (hero.className === 'WARRIOR' && hero.equipment.weapon) {
            const shieldImg = this.images['weapon_shield'];
            if (shieldImg && shieldImg.loaded) {
              this.ctx.drawImage(shieldImg, sx, sy, sw, sh, -size / 2, -size + 4, size, size);
            }
          }

          // 6. Arma (se equipada)
          if (hero.equipment.weapon) {
            let weaponType = 'longsword';
            if (hero.className === 'MERCENARY') weaponType = 'dagger';
            else if (hero.className === 'ARCHER') weaponType = 'bow';
            else if (hero.className === 'MAGE' || hero.className === 'PRIEST') weaponType = 'staff';

            const weaponImg = this.images[`weapon_${weaponType}`];
            if (weaponImg && weaponImg.loaded) {
              this.ctx.drawImage(weaponImg, sx, sy, sw, sh, -size / 2, -size + 4, size, size);
            }
          }
        }
      }
      else if (isSpritesheet) {
        // Escalar herói por 2.5x (otimização mobile)
        this.ctx.scale(2.5, 2.5);

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
          if (isSplit) {
            if (hero.facingDir === 'N') rowOffset = 0;
            else if (hero.facingDir === 'W') rowOffset = 1;
            else if (hero.facingDir === 'S') rowOffset = 2;
            else if (hero.facingDir === 'E') rowOffset = 3;
          } else {
            if (hero.facingDir === 'N') rowOffset = 12;
            else if (hero.facingDir === 'W') rowOffset = 13;
            else if (hero.facingDir === 'S') rowOffset = 14;
            else if (hero.facingDir === 'E') rowOffset = 15;
          }
        } else {
          colCount = 9; // Walk has 9 frames
          if (isSplit) {
            if (hero.facingDir === 'N') rowOffset = 0;
            else if (hero.facingDir === 'W') rowOffset = 1;
            else if (hero.facingDir === 'S') rowOffset = 2;
            else if (hero.facingDir === 'E') rowOffset = 3;
          } else {
            if (hero.facingDir === 'N') rowOffset = 8;
            else if (hero.facingDir === 'W') rowOffset = 9;
            else if (hero.facingDir === 'S') rowOffset = 10;
            else if (hero.facingDir === 'E') rowOffset = 11;
          }
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
        // Escalar herói e equipamentos juntos por 2.5x (otimização mobile)
        this.ctx.scale(2.5, 2.5);

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

  // --- EFEITOS DE BATALHA (Sistema de Projéteis por Classe) ---

  // Chamado pelo loop principal: lê pendingAttack dos heróis e cria projéteis
  drawCombatEffects(heroes, dt = 0.016, addFloater = null) {
    if (this.activeView !== 'hunt') return;

    // 1. Colher novos ataques dos heróis
    heroes.forEach(hero => {
      if (!hero.pendingAttack || hero.pendingAttack.consumed) return;
      const atk = hero.pendingAttack;
      atk.consumed = true;

      const type = atk.type;

      if (type === 'melee' || type === 'slash') {
        // Melee: efeito imediato no local do monstro
        this._spawnMeleeEffect(atk, hero.className);
      } else {
        // Ranged: criar projétil que voa até o alvo
        const speed = type === 'arrow' ? 320 : (type === 'holy' ? 200 : 260);
        const dx = atk.toX - atk.fromX;
        const dy = atk.toY - atk.fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (isNaN(dist) || dist <= 0) {
          // Se for inválido, dá dano imediato sem projétil para não travar
          const spawnFn = addFloater || this._addFloater;
          if (spawnFn) {
            spawnFn({
              x: atk.toX || 480,
              y: (atk.toY || 270) - 15,
              text: `${atk.damage}`,
              color: atk.color,
              time: 0.9,
              map: 'hunt'
            });
          }
          return;
        }

        this.projectiles.push({
          type,
          x: atk.fromX,
          y: atk.fromY,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          toX: atk.toX,
          toY: atk.toY,
          color: atk.color,
          impactColor: atk.impactColor,
          damage: atk.damage,
          dist,
          traveled: 0,
          time: 0,
          addFloater: addFloater || this._addFloater,
          trail: [],
          life: 1.0
        });
      }
    });

    // 2. Atualizar projéteis existentes
    this.projectiles = this.projectiles.filter(p => p.life > 0);

    this.projectiles.forEach(p => {
      p.time += dt;
      const step = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * dt;
      p.traveled += step;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Guardar rastro
      p.trail.push({ x: p.x, y: p.y, age: 0 });
      if (p.trail.length > 12) p.trail.shift();
      p.trail.forEach(t => t.age += dt);

      // Verificar colisão com o alvo
      const rx = p.toX - p.x;
      const ry = p.toY - p.y;
      const rem = Math.sqrt(rx * rx + ry * ry);

      // Limitar tempo de vida para o projétil nunca ficar preso
      if (isNaN(p.x) || isNaN(p.y) || isNaN(p.traveled) || p.time > 5) {
        p.life = 0;
        return;
      }

      if (rem < 10 || p.traveled >= p.dist) {
        // Impacto!
        this._spawnImpact(p);
        if (p.addFloater) {
          p.addFloater({
            x: p.toX,
            y: p.toY - 15,
            text: `${p.damage}`,
            color: p.color,
            time: 0.9,
            map: 'hunt'
          });
        }
        p.life = 0;
      }
    });

    // 3. Atualizar efeitos de impacto armazenados
    this._impacts = this._impacts.filter(imp => imp.life > 0);
    this._impacts.forEach(imp => {
      imp.time += dt;
      imp.life -= dt * 2.5;
    });

    // 4. Efeitos de postura (ranged: anel de carga)
    heroes.forEach(hero => {
      if (hero.state !== 'FIGHTING' || !hero.targetMonster) return;
      if (hero.keepAwayRange <= 0) return; // só ranged

      const cdPct = hero.cooldownTimer * hero.spd;
      if (cdPct > 0.65 && cdPct <= 1.0) {
        const chargePct = (1 - cdPct) / 0.35;
        this._drawCastingAura(hero, chargePct);
      }
    });

    // 5. Desenhar projéteis
    this.projectiles.forEach(p => this._drawProjectile(p));

    // 6. Desenhar impactos
    this._impacts.forEach(imp => this._drawImpact(imp));

    // 7. Efeitos melee salvos
    this._meleeEffects = this._meleeEffects.filter(e => e.life > 0);
    this._meleeEffects.forEach(e => {
      e.time += dt;
      e.life -= dt * 3;
      this._drawMeleeEffect(e);
    });
  }

  _spawnMeleeEffect(atk, className) {
    this._meleeEffects.push({
      type: atk.type,
      x: atk.toX,
      y: atk.toY,
      fromX: atk.fromX,
      fromY: atk.fromY,
      color: atk.color,
      impactColor: atk.impactColor,
      className,
      time: 0,
      life: 1.0
    });
  }

  _drawMeleeEffect(e) {
    const pos = this.toIso(e.x, e.y);
    const fromPos = this.toIso(e.fromX, e.fromY);
    const t = 1 - e.life;
    const alpha = Math.max(0, e.life);

    this.ctx.save();
    this.ctx.globalAlpha = alpha;

    if (e.className === 'WARRIOR') {
      // Arco largo de golpe (espada pesada)
      const angle = Math.atan2(pos.y - fromPos.y, pos.x - fromPos.x);
      const radius = 22 + t * 10;
      this.ctx.strokeStyle = e.color;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, radius, angle - 0.8, angle + 0.8);
      this.ctx.stroke();
      // Faíscas metálicas
      for (let i = 0; i < 5; i++) {
        const sparkAngle = angle - 0.9 + i * 0.45;
        const sparkLen = 8 + Math.random() * 10;
        this.ctx.strokeStyle = '#e8f4ff';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.ctx.lineTo(
          pos.x + Math.cos(sparkAngle) * sparkLen,
          pos.y + Math.sin(sparkAngle) * sparkLen
        );
        this.ctx.stroke();
      }
    } else {
      // Slash rápido do Mercenário (duas linhas cruzadas)
      const angle = Math.atan2(pos.y - fromPos.y, pos.x - fromPos.x);
      const r = 18 + t * 8;
      for (let i = -1; i <= 1; i += 2) {
        this.ctx.strokeStyle = i === -1 ? e.color : e.impactColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(
          pos.x - Math.cos(angle + i * 0.4) * r,
          pos.y - Math.sin(angle + i * 0.4) * r
        );
        this.ctx.lineTo(
          pos.x + Math.cos(angle + i * 0.4) * r,
          pos.y + Math.sin(angle + i * 0.4) * r
        );
        this.ctx.stroke();
      }
      // Gotinhas de sangue/dano
      for (let j = 0; j < 4; j++) {
        const da = (Math.random() - 0.5) * Math.PI;
        const dr = 6 + Math.random() * 12;
        this.ctx.fillStyle = e.color;
        this.ctx.beginPath();
        this.ctx.arc(
          pos.x + Math.cos(angle + da) * dr,
          pos.y + Math.sin(angle + da) * dr,
          1.5, 0, Math.PI * 2
        );
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  _drawCastingAura(hero, pct) {
    const pos = this.toIso(hero.x, hero.y);
    const color = hero.classConfig.projectileColor || '#ffffff';
    const radius = 14 + pct * 8;

    this.ctx.save();
    this.ctx.globalAlpha = pct * 0.6;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y - 20, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  _drawProjectile(p) {
    if (!isFinite(p.vx) || !isFinite(p.vy)) { p.life = 0; return; }
    const pos = this.toIso(p.x, p.y);
    this.ctx.save();

    if (p.type === 'arrow') {
      // Flecha: linha com ponta triangular
      const dx = p.vx;
      const dy = p.vy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const arrowLen = 14;

      // Rastro suave
      p.trail.forEach((t, i) => {
        const tp = this.toIso(t.x, t.y);
        const a = Math.max(0, (1 - t.age * 4) * 0.4);
        this.ctx.globalAlpha = a;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(tp.x, tp.y, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      });

      // Corpo da flecha
      this.ctx.globalAlpha = 0.95;
      this.ctx.strokeStyle = '#8b6020';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x - nx * arrowLen, pos.y - ny * arrowLen);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();

      // Ponta (triângulo)
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      const tipX = pos.x + nx * 4;
      const tipY = pos.y + ny * 4;
      const perpX = -ny * 3;
      const perpY = nx * 3;
      this.ctx.moveTo(tipX, tipY);
      this.ctx.lineTo(tipX - nx * 7 + perpX, tipY - ny * 7 + perpY);
      this.ctx.lineTo(tipX - nx * 7 - perpX, tipY - ny * 7 - perpY);
      this.ctx.closePath();
      this.ctx.fill();

    } else if (p.type === 'fireball') {
      // Bola de fogo: esfera com rastro
      p.trail.forEach((t, i) => {
        const tp = this.toIso(t.x, t.y);
        const a = Math.max(0, (1 - t.age * 3) * 0.5);
        const r = 4 * (1 - t.age * 2);
        if (r > 0) {
          this.ctx.globalAlpha = a;
          this.ctx.fillStyle = i % 2 === 0 ? '#ff4400' : '#ffaa00';
          this.ctx.beginPath();
          this.ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
          this.ctx.fill();
        }
      });
      // Núcleo
      this.ctx.globalAlpha = 1;
      const grad = this.ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 7);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#ffee00');
      grad.addColorStop(1, '#ff2200');
      this.ctx.fillStyle = grad;
      this.ctx.shadowColor = '#ff6600';
      this.ctx.shadowBlur = 12;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
      this.ctx.fill();

    } else if (p.type === 'holy') {
      // Raio de luz sagrado: estrela/cross pulsante
      const pulse = 0.8 + 0.2 * Math.sin(p.time * 15);
      const r = 6 * pulse;

      // Rastro de estrelinhas
      p.trail.forEach((t, i) => {
        if (i % 2 !== 0) return;
        const tp = this.toIso(t.x, t.y);
        const a = Math.max(0, (1 - t.age * 3) * 0.6);
        this.ctx.globalAlpha = a;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(tp.x, tp.y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      });

      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 14;

      // Cruz de luz
      const arms = 4;
      for (let i = 0; i < arms; i++) {
        const angle = (i / arms) * Math.PI * 2 + p.time * 3;
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.ctx.lineTo(
          pos.x + Math.cos(angle) * r * 2.5,
          pos.y + Math.sin(angle) * r * 2.5
        );
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeStyle = '#fffaaa';
        this.ctx.stroke();
      }
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  _spawnImpact(p) {
    if (!this._impacts) this._impacts = [];
    this._impacts.push({
      type: p.type,
      x: p.toX,
      y: p.toY,
      color: p.color,
      impactColor: p.impactColor,
      time: 0,
      life: 1.0
    });
  }

  _drawImpact(imp) {
    const pos = this.toIso(imp.x, imp.y);
    const t = imp.time;
    const alpha = Math.max(0, imp.life);

    this.ctx.save();
    this.ctx.globalAlpha = alpha;

    if (imp.type === 'arrow') {
      // Impacto de flecha: spike amarelo
      const r = 8 + t * 12;
      this.ctx.strokeStyle = imp.color;
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.ctx.lineTo(
          pos.x + Math.cos(angle) * r,
          pos.y + Math.sin(angle) * r
        );
        this.ctx.stroke();
      }
    } else if (imp.type === 'fireball') {
      // Explosão de fogo
      const r = 10 + t * 20;
      this.ctx.fillStyle = imp.impactColor;
      this.ctx.shadowColor = '#ff4400';
      this.ctx.shadowBlur = 20;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, r * 0.6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = '#ff8800';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (imp.type === 'holy') {
      // Burst de luz sagrada
      const r = 8 + t * 18;
      this.ctx.strokeStyle = imp.color;
      this.ctx.shadowColor = imp.color;
      this.ctx.shadowBlur = 18;
      this.ctx.lineWidth = 2.5;
      // Cruz
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x - r, pos.y); this.ctx.lineTo(pos.x + r, pos.y);
      this.ctx.moveTo(pos.x, pos.y - r); this.ctx.lineTo(pos.x, pos.y + r);
      this.ctx.stroke();
      this.ctx.globalAlpha = alpha * 0.4;
      this.ctx.fillStyle = imp.color;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, r * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
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



