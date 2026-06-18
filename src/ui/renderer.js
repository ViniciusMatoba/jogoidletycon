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
  }

  render(game, dt) {
    // Atualiza ciclo dia/noite
    this.dayNightCycle = (this.dayNightCycle + dt) % 90;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Limpar tela
    this.ctx.clearRect(0, 0, width, height);

    // 1. Desenhar Cenários Base (Cidade vs Zonas de Caça)
    this.drawTerrain(game, width, height);

    // 2. Desenhar Edifícios
    this.drawBuildings(game.town);

    // 3. Desenhar Monstros com Visual Pixel-Art
    this.drawMonsters(game.spawner.activeMonsters);

    // 4. Desenhar Heróis com Pixel-Art Customizada e Equipamento Dinâmico
    this.drawHeroes(game.heroes);

    // 5. Desenhar Efeitos de Batalha Avançados
    this.drawCombatEffects(game.heroes);

    // 6. Desenhar Filtro de Dia/Noite
    this.drawDayNightFilter(width, height);

    // 7. Desenhar Textos Flutuantes
    this.drawFloaters(game.floaters);
  }

  drawTerrain(game, w, h) {
    const biome = game.spawner.getBiomeConfig();

    // Cidade (Grama)
    this.ctx.fillStyle = '#395c2f';
    this.ctx.fillRect(0, 0, 400, h);

    // Floresta (Varia com o bioma)
    let forestColor = '#243b23';
    if (biome.id === 0) forestColor = '#242528'; // Cavernas Cinza Escuro
    if (biome.id === 1) forestColor = '#122412'; // Floresta Verde Escuro
    if (biome.id === 2) forestColor = '#1e2621'; // Pântano Escuro

    this.ctx.fillStyle = forestColor;
    this.ctx.fillRect(400, 0, 400, h);

    // Rio e Ponte
    this.ctx.fillStyle = '#2d6ab3';
    this.ctx.fillRect(388, 0, 14, h);

    this.ctx.fillStyle = '#6e4726'; // Madeira ponte
    this.ctx.fillRect(384, 185, 22, 35);
    
    this.ctx.fillStyle = '#452b16'; // Corrimões
    this.ctx.fillRect(384, 182, 22, 3);
    this.ctx.fillRect(384, 220, 22, 3);

    // Estradas de terra na cidade
    this.ctx.fillStyle = '#826442';
    this.ctx.fillRect(190, 80, 20, 250);
    this.ctx.fillRect(90, 145, 220, 15);
    this.ctx.fillRect(90, 245, 220, 15);
    this.ctx.fillRect(190, 195, 200, 15);

    // Decorações simples no chão (Graminhas e pedrinhas)
    this.ctx.fillStyle = '#ffea3a';
    this.ctx.fillRect(60, 70, 2, 2);
    this.ctx.fillRect(290, 60, 2, 2);
    
    // Árvores de Pixel Art simples na divisa da floresta (decorativo)
    this.drawPixelTree(420, 40);
    this.drawPixelTree(430, h - 80);
    this.drawPixelTree(360, 40);
    this.drawPixelTree(360, h - 85);
  }

  drawPixelTree(x, y) {
    this.ctx.save();
    // Tronco
    this.ctx.fillStyle = '#4d3319';
    this.ctx.fillRect(x - 3, y, 6, 15);
    // Folhas
    this.ctx.fillStyle = '#1b4018';
    this.ctx.beginPath();
    this.ctx.arc(x, y - 5, 12, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#265922';
    this.ctx.beginPath();
    this.ctx.arc(x - 3, y - 7, 7, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  drawBuildings(town) {
    const buildings = [
      { key: 'townhall', x: 200, y: 80, name: 'Prefeitura', icon: '🏛️' },
      { key: 'hotel', x: 100, y: 150, name: 'Hotel', icon: '🏨' },
      { key: 'restaurant', x: 300, y: 150, name: 'Restaurante', icon: '🍲' },
      { key: 'hospital', x: 100, y: 250, name: 'Hospital', icon: '🏥' },
      { key: 'tavern', x: 300, y: 250, name: 'Taverna', icon: '🍺' },
      { key: 'forge', x: 200, y: 320, name: 'Forja', icon: '⚒️' }
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

  // --- RENDERIZAÇÃO DOS MONSTROS EM PIXEL ART ---
  drawMonsters(monsters) {
    monsters.forEach(monster => {
      if (monster.hp <= 0) return;

      this.ctx.save();
      const time = performance.now();

      // Desenhar Sombra
      const shadowSize = monster.isBoss ? 16 : (monster.isMiniBoss ? 11 : 7);
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(monster.x, monster.y + 8, shadowSize * 1.2, shadowSize * 0.35, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Identificar e renderizar o monstro em pixel art com base no nome
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
        // Fallback genérico para monstros originais
        this.drawGenericMonster(monster);
      }

      // Nome do Monstro
      this.ctx.fillStyle = monster.isBoss ? '#ffea3a' : '#ff9f3a';
      this.ctx.font = monster.isBoss ? 'bold 10px monospace' : '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(monster.name, monster.x, monster.y - (monster.isBoss ? 24 : 14));

      // Barra de Vida
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

  // --- SPRITE PIXEL ART: SACI-PERERÊ ---
  drawSaci(x, y, time) {
    const jump = Math.abs(Math.sin(time * 0.012)) * 6; // Pulando freneticamente
    const py = y - jump;

    // Gorro Vermelho (Triângulo no topo)
    this.ctx.fillStyle = '#ff0000';
    this.ctx.beginPath();
    this.ctx.moveTo(x - 5, py - 10);
    this.ctx.lineTo(x + 5, py - 10);
    this.ctx.lineTo(x - 2, py - 17);
    this.ctx.closePath();
    this.ctx.fill();

    // Rosto (Marrom Escuro)
    this.ctx.fillStyle = '#5c3a21';
    this.ctx.fillRect(x - 4, py - 10, 8, 7);
    
    // Olho Branco e Boca
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x + 1, py - 8, 2, 2);
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(x + 2, py - 8, 1, 1);
    
    // Cachimbo
    this.ctx.fillStyle = '#8c5835';
    this.ctx.fillRect(x + 3, py - 5, 4, 1.5);
    this.ctx.fillStyle = '#ff9f3a'; // Ponta acesa
    this.ctx.fillRect(x + 7, py - 6, 1.5, 2);

    // Tronco / Calção Vermelho
    this.ctx.fillStyle = '#ff0000';
    this.ctx.fillRect(x - 4, py - 3, 8, 7);

    // Uma perna preta esticada
    this.ctx.fillStyle = '#2e1c10';
    this.ctx.fillRect(x - 1.5, py + 4, 3, 5);
  }

  // --- SPRITE PIXEL ART: CURUPIRA ---
  drawCurupira(x, y, time) {
    const walk = Math.sin(time * 0.015) * 2;

    // Cabelo de Fogo Vermelho/Laranja arrepiado
    this.ctx.fillStyle = '#ff6a00';
    this.ctx.fillRect(x - 6, y - 16, 12, 5);
    this.ctx.fillStyle = '#ff3c00';
    this.ctx.fillRect(x - 4, y - 18, 8, 3);

    // Rosto Verde/Bronze protetor
    this.ctx.fillStyle = '#ffd1a9';
    this.ctx.fillRect(x - 4, y - 11, 8, 7);
    // Olhinhos verdes brilhantes
    this.ctx.fillStyle = '#3aff7d';
    this.ctx.fillRect(x - 2, y - 9, 1.5, 1.5);
    this.ctx.fillRect(x + 1, y - 9, 1.5, 1.5);

    // Túnica de folhas verdes
    this.ctx.fillStyle = '#265922';
    this.ctx.fillRect(x - 5, y - 4, 10, 8);

    // Pernas (Bronze) e Pés Virados para Trás!
    this.ctx.fillStyle = '#ffd1a9';
    this.ctx.fillRect(x - 3, y + 4, 2, 4);
    this.ctx.fillRect(x + 1, y + 4, 2, 4);

    // Pés apontando para a ESQUERDA (enquanto ele anda para a DIREITA)
    this.ctx.fillStyle = '#c99a75';
    this.ctx.fillRect(x - 6, y + 7, 4, 1.5);
    this.ctx.fillRect(x - 2, y + 7, 4, 1.5);
  }

  // --- SPRITE PIXEL ART: MULA SEM CABEÇA ---
  drawMula(x, y, time) {
    const step = Math.sin(time * 0.016) * 3;

    // Corpo de cavalo marrom escuro
    this.ctx.fillStyle = '#4a2f1b';
    this.ctx.fillRect(x - 12, y - 2, 20, 8); // Tronco

    // Pernas
    this.ctx.fillStyle = '#2d1b0e';
    this.ctx.fillRect(x - 10, y + 6, 3, 5 + step);
    this.ctx.fillRect(x - 4, y + 6, 3, 5 - step);
    this.ctx.fillRect(x + 2, y + 6, 3, 5 + step);
    this.ctx.fillRect(x + 6, y + 6, 3, 5 - step);

    // Rabo preto
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(x - 15, y - 1, 3, 6);

    // Pescoço
    this.ctx.fillStyle = '#4a2f1b';
    this.ctx.fillRect(x + 4, y - 8, 5, 7);

    // Fogo Vivo no Lugar da Cabeça (Partículas oscilantes vermelhas e amarelas)
    const flameSize = 8 + Math.floor(Math.sin(time * 0.04) * 3);
    this.ctx.fillStyle = '#ff3c00';
    this.ctx.fillRect(x + 3, y - 8 - flameSize, 8, flameSize);
    
    this.ctx.fillStyle = '#ffea3a'; // Centro amarelo
    this.ctx.fillRect(x + 5, y - 6 - flameSize, 4, flameSize - 2);
  }

  // --- SPRITE PIXEL ART: BOITATÁ (SERPENTE DE FOGO) ---
  drawBoitata(x, y, time) {
    // Corpo articulado feito de 4 segmentos que ondulam
    for (let i = 0; i < 4; i++) {
      const offset = i * 8;
      const wave = Math.sin((time * 0.01) + i) * 6;
      
      const px = x - offset;
      const py = y + wave;

      // Segmento de fogo
      this.ctx.fillStyle = i === 0 ? '#ffea3a' : '#ff3c00'; // Cabeça amarela, corpo vermelho
      this.ctx.beginPath();
      this.ctx.arc(px, py, 6 - i, 0, Math.PI * 2);
      this.ctx.fill();

      // Olhos gigantes brilhantes de fogo na cabeça
      if (i === 0) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(px + 1, py - 4, 2, 2);
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(px + 2, py - 4, 1, 1);
      }
    }
  }

  // --- SPRITE PIXEL ART: MAPINGUARI ---
  drawMapinguari(x, y, time) {
    const sway = Math.sin(time * 0.008) * 1.5;

    // Grande corpo peludo verde-escuro de gigante (16x20)
    this.ctx.fillStyle = '#263321';
    this.ctx.fillRect(x - 10 + sway, y - 16, 20, 22);

    // Ombros e Braços longos com garras pretas
    this.ctx.fillStyle = '#141c11';
    this.ctx.fillRect(x - 13 + sway, y - 10, 3, 14); // Braço E
    this.ctx.fillRect(x + 10 + sway, y - 10, 3, 14); // Braço D
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x - 13 + sway, y + 4, 3, 2); // Garra E
    this.ctx.fillRect(x + 10 + sway, y + 4, 3, 2); // Garra D

    // Um único olho vermelho na testa
    this.ctx.fillStyle = '#ff0000';
    this.ctx.fillRect(x - 2 + sway, y - 12, 4, 4);
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x - 1 + sway, y - 11, 2, 2);

    // Boca gigante vertical na barriga (Aberta, vermelha por dentro com dentes brancos)
    this.ctx.fillStyle = '#8a0d0d'; // Fundo vermelho
    this.ctx.fillRect(x - 3 + sway, y - 4, 6, 8);
    // Dentes (pontos brancos)
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x - 3 + sway, y - 4, 1, 1);
    this.ctx.fillRect(x + 2 + sway, y - 4, 1, 1);
    this.ctx.fillRect(x - 3 + sway, y + 3, 1, 1);
    this.ctx.fillRect(x + 2 + sway, y + 3, 1, 1);

    // Pernas grossas
    this.ctx.fillStyle = '#141c11';
    this.ctx.fillRect(x - 6 + sway, y + 6, 4, 5);
    this.ctx.fillRect(x + 2 + sway, y + 6, 4, 5);
  }

  // --- OUTROS MONSTROS EM PIXEL ART ---
  drawCorpoSeco(x, y) {
    // Zumbi esquelético cinza e verde limão
    this.ctx.fillStyle = '#7a8578';
    this.ctx.fillRect(x - 4, y - 11, 8, 16); // Corpo
    
    // Cabeça de caveira verde-lodo
    this.ctx.fillStyle = '#a0b39c';
    this.ctx.fillRect(x - 3, y - 17, 6, 6);
    this.ctx.fillStyle = '#ff0000'; // Olhos vermelhos
    this.ctx.fillRect(x - 2, y - 15, 1, 1.5);
    this.ctx.fillRect(x + 1, y - 15, 1, 1.5);

    // Costelas (linhas pretas simples no peito)
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(x - 3, y - 9, 6, 1);
    this.ctx.fillRect(x - 3, y - 6, 6, 1);

    // Pernas finas
    this.ctx.fillStyle = '#616b5f';
    this.ctx.fillRect(x - 2, y + 5, 1.5, 4);
    this.ctx.fillRect(x + 0.5, y + 5, 1.5, 4);
  }

  drawPisadeira(x, y) {
    // Mulher extremamente magra, vestida de preto, com unhas brancas compridas
    this.ctx.fillStyle = '#111'; // Vestido preto rasgado
    this.ctx.fillRect(x - 3, y - 8, 6, 12);

    // Rosto enrugado pálido
    this.ctx.fillStyle = '#e8d5c4';
    this.ctx.fillRect(x - 3, y - 14, 6, 6);
    this.ctx.fillStyle = '#000'; // Olhos fundos
    this.ctx.fillRect(x - 2, y - 12, 1, 1);
    this.ctx.fillRect(x + 1, y - 12, 1, 1);

    // Braços com unhas brancas compridas
    this.ctx.fillStyle = '#e8d5c4';
    this.ctx.fillRect(x - 5, y - 6, 2, 6);
    this.ctx.fillRect(x + 3, y - 6, 2, 6);
    this.ctx.fillStyle = '#fff'; // Unhas brancas longas
    this.ctx.fillRect(x - 5, y, 1, 3);
    this.ctx.fillRect(x + 4, y, 1, 3);

    // Pernas cinza
    this.ctx.fillStyle = '#8f8175';
    this.ctx.fillRect(x - 2, y + 4, 1, 5);
    this.ctx.fillRect(x + 1, y + 4, 1, 5);
  }

  drawChibamba(x, y, time) {
    const shake = Math.sin(time * 0.035) * 2.5; // Tremendo/Dançando de forma bizarra

    // Envolto em folhas de bananeira verdes verticais (12x16)
    this.ctx.fillStyle = '#327329';
    this.ctx.fillRect(x - 6 + shake, y - 10, 12, 16);
    // Linhas das folhas
    this.ctx.fillStyle = '#1c4217';
    this.ctx.fillRect(x - 4 + shake, y - 10, 1.5, 16);
    this.ctx.fillRect(x + 2 + shake, y - 10, 1.5, 16);

    // Máscara escura aparecendo na fenda das folhas
    this.ctx.fillStyle = '#0f0f0f';
    this.ctx.fillRect(x - 3 + shake, y - 6, 6, 5);
    // Olhos brilhantes brancos
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x - 2 + shake, y - 4, 1, 1);
    this.ctx.fillRect(x + 1 + shake, y - 4, 1, 1);
  }

  drawCapelobo(x, y) {
    // Cabeça de tamanduá e corpo musculoso cinza-escuro (lobisomem-like)
    this.ctx.fillStyle = '#3a3f47';
    this.ctx.fillRect(x - 5, y - 8, 10, 13); // Corpo

    // Cabeça esticada de tamanduá (focinho longo para a direita)
    this.ctx.fillStyle = '#22252a';
    this.ctx.fillRect(x - 3, y - 14, 6, 6); // Cabeça base
    this.ctx.fillRect(x + 1, y - 12, 6, 3);  // Focinho esticado
    // Garra afiada
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x + 5, y + 2, 2, 2);

    // Pernas pretas
    this.ctx.fillStyle = '#1c1f24';
    this.ctx.fillRect(x - 3, y + 5, 2, 4);
    this.ctx.fillRect(x + 1, y + 5, 2, 4);
  }

  drawCaipora(x, y) {
    // Menina indígena montada em um pequeno porco do mato (Queixada)
    // 1. Porco do mato (Cinza escuro embaixo)
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(x - 7, y + 1, 14, 6); // Corpo do porco
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(x - 6, y + 7, 2, 3);  // Pernas do porco
    this.ctx.fillRect(x + 4, y + 7, 2, 3);
    this.ctx.fillStyle = '#fff'; // Presa branca pequena do porco
    this.ctx.fillRect(x + 7, y + 2, 1.5, 1.5);

    // 2. Caipora sentada em cima
    this.ctx.fillStyle = '#d9905f'; // Pele
    this.ctx.fillRect(x - 3, y - 7, 6, 8); // Tronco
    // Cabelo preto longo com pena
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(x - 4, y - 13, 8, 6);
    this.ctx.fillStyle = '#ff3c00'; // Pena vermelha na cabeça
    this.ctx.fillRect(x - 1, y - 16, 2, 3);
  }

  drawQuibungo(x, y) {
    // Humanoide peludo azulado/cinza com boca gigante nas costas
    this.ctx.fillStyle = '#2e3a4e';
    this.ctx.fillRect(x - 6, y - 10, 12, 15);

    // Cabeça no lugar normal (mas pequena e boba)
    this.ctx.fillStyle = '#d69e76';
    this.ctx.fillRect(x - 3, y - 15, 6, 5);

    // Boca gigante vertical no dorso (nas costas - representamos com corte vermelho/preto na lateral)
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x - 6, y - 6, 2, 8);
    this.ctx.fillStyle = '#ff0000';
    this.ctx.fillRect(x - 6, y - 4, 1, 4);
  }

  drawIpupiara(x, y, time) {
    // Sereia/Monstro das águas azul escuro e verde escamoso. Flutua oscilando
    const float = Math.sin(time * 0.01) * 3;
    const py = y + float;

    // Cauda de peixe verde escuro que ondula
    this.ctx.fillStyle = '#183c2e';
    this.ctx.fillRect(x - 4, py + 2, 8, 6);
    this.ctx.fillStyle = '#3c8568'; // Nadadeira
    this.ctx.fillRect(x - 6, py + 7, 12, 2);

    // Tronco muscular azul marinho
    this.ctx.fillStyle = '#21334f';
    this.ctx.fillRect(x - 4, py - 6, 8, 8);

    // Rosto com guelras (azul claro)
    this.ctx.fillStyle = '#5675a6';
    this.ctx.fillRect(x - 3, py - 11, 6, 5);
  }

  drawTejuJagua(x, y) {
    // Lagarto gigante com cauda e garras (7 cabeças de cachorro na lenda, faremos 1 cabeça de cão grande no limite do Canvas)
    this.ctx.fillStyle = '#263a23'; // Lagarto verde
    this.ctx.fillRect(x - 9, y - 2, 18, 9);
    // Cauda longa
    this.ctx.fillRect(x - 14, y + 2, 5, 2);

    // Cabeça de cachorro marrom
    this.ctx.fillStyle = '#613e23';
    this.ctx.fillRect(x + 5, y - 8, 7, 7);
    this.ctx.fillStyle = '#000'; // Olho e orelhas
    this.ctx.fillRect(x + 7, y - 6, 1, 1);
    this.ctx.fillRect(x + 4, y - 9, 2, 2);
  }

  drawBoto(x, y) {
    // Boto-cor-de-rosa em túnica branca elegante e chapéu de palha
    this.ctx.fillStyle = '#ffffff'; // Terno branco
    this.ctx.fillRect(x - 4, y - 7, 8, 12);

    // Rosto rosa
    this.ctx.fillStyle = '#ffb0b0';
    this.ctx.fillRect(x - 3, y - 12, 6, 5);

    // Chapéu de palha cobrindo o buraco de respirar na cabeça
    this.ctx.fillStyle = '#d9b48f';
    this.ctx.fillRect(x - 6, y - 14, 12, 2); // Aba do chapéu
    this.ctx.fillRect(x - 3, y - 17, 6, 3); // Copa do chapéu
  }

  drawRatoRei(x, y) {
    // Corpo de rato cinza grande (14x12)
    this.ctx.fillStyle = '#656b73';
    this.ctx.fillRect(x - 7, y - 6, 14, 12);
    // Nariz rosa
    this.ctx.fillStyle = '#ffa6a6';
    this.ctx.fillRect(x + 7, y - 2, 2, 2);
    // Coroa de ouro na cabeça!
    this.ctx.fillStyle = '#ffea3a';
    this.ctx.fillRect(x - 4, y - 9, 8, 3);
    this.ctx.fillRect(x - 3, y - 11, 2, 2);
    this.ctx.fillRect(x + 1, y - 11, 2, 2);
  }

  drawGenericMonster(monster) {
    // Desenho genérico caso surja um monstro de fallback (ex: Morcego)
    const size = monster.isBoss ? 16 : 8;
    this.ctx.fillStyle = monster.isBoss ? '#802616' : '#5e6875';
    this.ctx.beginPath();
    this.ctx.arc(monster.x, monster.y, size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // --- RENDERIZAÇÃO DOS HERÓIS EM PIXEL ART COM EQUIPAMENTO DINÂMICO ---
  drawHeroes(heroes) {
    heroes.forEach(hero => {
      this.ctx.save();
      const time = performance.now();

      // Pernas se movendo (Caminhada dinâmica baseada na velocidade física)
      // Se ele estiver lutando (FIGHTING), não caminha, fica firme
      const isWalking = hero.state === 'SEARCHING_MONSTER' || hero.state === 'RETURNING_TOWN' || hero.state === 'IDLE_TOWN';
      const step = isWalking ? Math.sin(time * 0.015) * 3 : 0;

      // Desenhar Sombra
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(hero.x, hero.y + 11, 10, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // 1. CAMADA 1: Pernas (Cor da pele/calça)
      this.ctx.fillStyle = hero.cosmetics.skinColor;
      this.ctx.fillRect(hero.x - 3.5, hero.y + 5, 2, 6 + step);
      this.ctx.fillRect(hero.x + 1.5, hero.y + 5, 2, 6 - step);
      
      // Sapatinhos marrons
      this.ctx.fillStyle = '#4a2c11';
      this.ctx.fillRect(hero.x - 4.5, hero.y + 10 + step, 3, 1.5);
      this.ctx.fillRect(hero.x + 0.5, hero.y + 10 - step, 3, 1.5);

      // 2. CAMADA 2: Corpo / Armadura Dinâmica
      let bodyColor = hero.cosmetics.clothesColor; // Roupa base padrão
      let borderGold = false;

      if (hero.equipment.armor) {
        const tier = hero.equipment.armor.tier;
        if (tier === 1) {
          // Armadura de Placa/Couro Ferro Rústica
          bodyColor = hero.className === 'WARRIOR' ? '#818b96' : '#634731'; // Cinza metal ou marrom couro
        } else if (tier === 2) {
          // Armadura de Aço Reforçada
          bodyColor = '#4e5a66'; // Cinza escuro azulado
        } else if (tier === 3) {
          // Armadura de Mapinguari/Lendária
          bodyColor = hero.equipment.armor.key.includes('mapinguari') ? '#ab5522' : '#cca93d'; // Laranja rústico ou Dourado
          borderGold = true;
        }
      }

      this.ctx.fillStyle = bodyColor;
      this.ctx.fillRect(hero.x - 5, hero.y - 4, 10, 10); // Tronco principal

      // Borda dourada brilhante de item lendário
      if (borderGold) {
        this.ctx.strokeStyle = '#ffea3a';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(hero.x - 5.5, hero.y - 4.5, 11, 11);
      }

      // Detalhe do cinto
      this.ctx.fillStyle = '#261c11';
      this.ctx.fillRect(hero.x - 5, hero.y + 3, 10, 1.5);

      // 3. CAMADA 3: Rosto e Cabelo Customizado
      // Rosto
      this.ctx.fillStyle = hero.cosmetics.skinColor;
      this.ctx.fillRect(hero.x - 4, yOffset(hero) - 10, 8, 7);
      
      // Olhos pretos
      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(hero.x - 2, yOffset(hero) - 8, 1, 1.5);
      this.ctx.fillRect(hero.x + 1, yOffset(hero) - 8, 1, 1.5);

      // Cabelo baseado no Estilo e Cor gerados
      this.ctx.fillStyle = hero.cosmetics.hairColor;
      const hairStyle = hero.cosmetics.hairStyle;
      const hy = yOffset(hero);

      if (hairStyle === 'short') {
        // Cabelo curto nas laterais e topo
        this.ctx.fillRect(hero.x - 4.5, hy - 11.5, 9, 2);
        this.ctx.fillRect(hero.x - 4.5, hy - 10, 1.5, 4);
        this.ctx.fillRect(hero.x + 3, hy - 10, 1.5, 4);
      } else if (hairStyle === 'long') {
        // Cabelo comprido descendo pelas costas/ombros
        this.ctx.fillRect(hero.x - 4.5, hy - 11.5, 9, 2);
        this.ctx.fillRect(hero.x - 4.5, hy - 10, 1.5, 9);
        this.ctx.fillRect(hero.x + 3, hy - 10, 1.5, 9);
      } else if (hairStyle === 'spiky') {
        // Arrepiado pontudo
        this.ctx.fillRect(hero.x - 4, hy - 11.5, 8, 2);
        this.ctx.fillRect(hero.x - 3, hy - 13.5, 1.5, 2);
        this.ctx.fillRect(hero.x + 1.5, hy - 13.5, 1.5, 2);
      } else {
        // Careca - sem desenho extra de cabelo
      }

      // Auréola amarela flutuando se for Sacerdote
      if (hero.className === 'PRIEST') {
        this.ctx.strokeStyle = '#ffea3a';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(hero.x, hy - 14, 2.5, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // 4. CAMADA 4: Arma Dinâmica na Mão
      this.drawHeroWeapon(hero);

      // Nome do Herói
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(hero.name, hero.x, hero.y - 20);

      // Barra de Vida
      const hpPct = Math.max(0, hero.hp / hero.maxHp);
      const barW = 20;
      const barH = 3;
      
      this.ctx.fillStyle = '#2c2e33';
      this.ctx.fillRect(hero.x - barW / 2, hero.y - 16, barW, barH);
      this.ctx.fillStyle = hpPct > 0.45 ? '#3aff7d' : '#ffea3a';
      if (hpPct < 0.2) this.ctx.fillStyle = '#ff3d3d';
      this.ctx.fillRect(hero.x - barW / 2, hero.y - 16, barW * hpPct, barH);

      // Balõezinhos de status (Necessidades)
      this.drawHeroNeedBubble(hero, 7);

      this.ctx.restore();
    });
  }

  // Desenha a arma dinâmica equipada do herói
  drawHeroWeapon(hero) {
    const isAttacking = hero.state === 'FIGHTING' && hero.cooldownTimer > 0;
    
    // Braço esticado para frente se estiver batendo, se não braço abaixado
    const wx = isAttacking ? hero.x + 5 : hero.x - 6.5;
    const wy = isAttacking ? hero.y + 1 : hero.y + 2;

    let weaponColor = '#bf9b30'; // Cor padrão (madeira/bronze)
    let isLendaria = false;

    // Detectar cor do metal/arma por tier
    if (hero.equipment.weapon) {
      const tier = hero.equipment.weapon.tier;
      if (tier === 1) weaponColor = '#818b96'; // Ferro (Cinza claro)
      if (tier === 2) weaponColor = '#4e5b66'; // Aço (Cinza escuro)
      if (tier === 3) {
        weaponColor = '#ffea3a'; // Lendário (Dourado/Fogo)
        isLendaria = true;
      }
    } else {
      // Sem arma - desenha mão livre do herói
      this.ctx.fillStyle = hero.cosmetics.skinColor;
      this.ctx.fillRect(wx, wy, 2, 2.5);
      return;
    }

    const slot = hero.equipment.weapon.slot;

    this.ctx.save();

    // Desenha a Arma
    if (hero.className === 'ARCHER') {
      // --- DESENHO ARCO ---
      this.ctx.strokeStyle = weaponColor;
      this.ctx.lineWidth = 1.5;
      
      // Arco curvado
      this.ctx.beginPath();
      if (isAttacking) {
        this.ctx.arc(wx + 2, wy, 5, -Math.PI/2, Math.PI/2);
      } else {
        this.ctx.arc(wx, wy, 5, Math.PI/2, -Math.PI/2, true);
      }
      this.ctx.stroke();

      // Corda do arco (Branco fosco)
      this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      if (isAttacking) {
        this.ctx.moveTo(wx + 2, wy - 5);
        this.ctx.lineTo(wx, wy); // Mão puxando
        this.ctx.lineTo(wx + 2, wy + 5);
      } else {
        this.ctx.moveTo(wx, wy - 5);
        this.ctx.lineTo(wx, wy + 5);
      }
      this.ctx.stroke();
    } else if (hero.className === 'MAGE' || hero.className === 'PRIEST') {
      // --- DESENHO CAJADO ---
      // Bastão
      this.ctx.fillStyle = '#6b4724';
      this.ctx.fillRect(wx + 1, wy - 8, 1.5, 12);
      
      // Gema brilhante na ponta
      this.ctx.fillStyle = hero.className === 'PRIEST' ? '#ffea3a' : '#c23aff'; // Amarela ou roxa
      this.ctx.fillRect(wx, wy - 11, 3.5, 3.5);
    } else {
      // --- DESENHO ESPADA ---
      // Lâmina
      this.ctx.fillStyle = weaponColor;
      if (isAttacking) {
        // Apontando na horizontal para a direita
        this.ctx.fillRect(wx, wy - 1, 9, 2);
        // Guarda marrom
        this.ctx.fillStyle = '#4a2c11';
        this.ctx.fillRect(wx - 1, wy - 3, 1.5, 6);
      } else {
        // Apontando na vertical para cima
        this.ctx.fillRect(wx, wy - 7, 2, 8);
        this.ctx.fillStyle = '#4a2c11';
        this.ctx.fillRect(wx - 2, wy - 1, 6, 1.5);
      }
    }

    this.ctx.restore();
  }

  // Pequeno offset do rosto caso pule ou ande
  yOffset(hero) {
    return hero.y;
  }

  drawHeroNeedBubble(hero, size) {
    let icon = '';
    
    if (hero.state === 'RESTING_HOTEL') icon = '💤';
    else if (hero.state === 'EATING_REST') icon = '🍲';
    else if (hero.state === 'HEALING_HOSP') icon = '🩹';
    else if (hero.state === 'DRINKING_TAVERN') icon = '🍺';
    else if (hero.state === 'SELLING_LOOT') icon = '🪙';

    if (icon !== '') {
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(icon, hero.x + 10, hero.y - size - 6);
    }
  }

  drawCombatEffects(heroes) {
    heroes.forEach(hero => {
      if (hero.state !== 'FIGHTING' || !hero.targetMonster) return;

      const monster = hero.targetMonster;
      this.ctx.save();

      // Projetil de Mago ou Flecha de Arqueiro
      if (hero.className === 'MAGE' && hero.cooldownTimer > 0.4) {
        const pct = (1 - hero.cooldownTimer);
        const px = hero.x + (monster.x - hero.x) * pct;
        const py = hero.y + (monster.y - hero.y) * pct;

        // Se usar magia lendária de Boitatá, a cor é de chamas
        const color = hero.equipment.weapon?.key.includes('boitata') ? '#ff4000' : '#c23aff';

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ffea3a';
        this.ctx.beginPath();
        this.ctx.arc(px - (monster.x - hero.x)*0.08, py - (monster.y - hero.y)*0.08, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

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

// Pequeno auxiliar para offset vertical do rosto
function yOffset(hero) {
  return hero.y;
}
