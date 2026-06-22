import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// Grade do grid LPC
const LPC_CELL_W = 64;
const LPC_CELL_H = 64;
const SHEET_W = 832;
const SHEET_H = 1344;

// Direções: 0 = S, 1 = W, 2 = E, 3 = N
const DIRS = ['S', 'W', 'E', 'N'];

/**
 * Compila a folha LPC de um monstro.
 */
export async function compileMonster(options) {
  const {
    name,
    walkPath,
    attackPath, // Opcional (se omitido, usa Fluxo A procedural)
    outputPath,
    spriteSize = 64, // Tamanho final do sprite recortado (dentro de 64x64)
  } = options;

  console.log(`\n⚙️ Compilando Monstro: ${name}`);
  console.log(`  - Caminhada: ${walkPath}`);
  console.log(`  - Ataque: ${attackPath ? attackPath : 'Procedural (Fluxo A)'}`);
  console.log(`  - Tamanho Sprite: ${spriteSize}px`);
  console.log(`  - Destino: ${outputPath}`);

  if (!fs.existsSync(walkPath)) {
    throw new Error(`Caminho de caminhada não encontrado: ${walkPath}`);
  }

  const sharpWalk = sharp(walkPath);
  const walkMeta = await sharpWalk.metadata();
  const walkCellW = walkMeta.width / 4;
  const walkCellH = walkMeta.height / 4;

  const walkFrames = { S: [], W: [], E: [], N: [] };
  const attackFrames = { S: [], W: [], E: [], N: [] };

  // Helper para extrair frames 4x4
  async function extractFrames(srcSharp, cellW, cellH, targetDict) {
    for (let row = 0; row < 4; row++) {
      const dir = DIRS[row];
      for (let col = 0; col < 4; col++) {
        const frame = srcSharp
          .clone()
          .extract({ left: col * cellW, top: row * cellH, width: cellW, height: cellH })
          .resize(spriteSize, spriteSize);
        const buf = await frame.png().toBuffer();
        targetDict[dir].push(buf);
      }
    }
  }

  await extractFrames(sharpWalk, walkCellW, walkCellH, walkFrames);

  let hasAttackSheet = false;
  if (attackPath && fs.existsSync(attackPath)) {
    hasAttackSheet = true;
    const sharpAttack = sharp(attackPath);
    const attackMeta = await sharpAttack.metadata();
    const attackCellW = attackMeta.width / 4;
    const attackCellH = attackMeta.height / 4;
    await extractFrames(sharpAttack, attackCellW, attackCellH, attackFrames);
  }

  const compositeList = [];

  // Helper para colar frame composto no grid LPC
  async function addFrame(row, col, baseBuffer, opts = {}) {
    const scaleX = opts.scaleX ?? 1.0;
    const scaleY = opts.scaleY ?? 1.0;
    const offX = opts.offX ?? 0;
    const offY = opts.offY ?? 0;
    const tint = opts.tint ?? null;
    const opacity = opts.opacity ?? 1.0;
    const rotate = opts.rotate ?? 0;

    let sImg = sharp(baseBuffer);
    const targetW = Math.round(spriteSize * scaleX);
    const targetH = Math.round(spriteSize * scaleY);
    sImg = sImg.resize(targetW, targetH);

    if (rotate !== 0) {
      sImg = sImg.rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    if (tint) {
      sImg = sImg.tint(tint);
    }
    if (opacity < 1.0) {
      sImg = sImg.ensureAlpha(opacity);
    }

    let finalBuf = await sImg.toBuffer();
    let finalMeta = await sharp(finalBuf).metadata();
    let finalW = finalMeta.width;
    let finalH = finalMeta.height;

    // Garante que cabe na célula de 64x64
    if (finalW > 64 || finalH > 64) {
      finalBuf = await sharp(finalBuf)
        .resize(Math.min(finalW, 64), Math.min(finalH, 64), { fit: 'inside' })
        .toBuffer();
      const resizedMeta = await sharp(finalBuf).metadata();
      finalW = resizedMeta.width;
      finalH = resizedMeta.height;
    }

    // Centraliza horizontalmente e ancora verticalmente na base (com margem de 4px)
    const left = Math.max(0, Math.min(64 - finalW, Math.round((64 - finalW) / 2) + offX));
    const top = Math.max(0, Math.min(64 - finalH, (64 - finalH) - 4 + offY));

    const frameBuffer = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{ input: finalBuf, left, top }])
    .png()
    .toBuffer();

    compositeList.push({
      input: frameBuffer,
      left: col * LPC_CELL_W,
      top: row * LPC_CELL_H
    });
  }

  // Montagem das 21 linhas
  for (let row = 0; row < 21; row++) {
    let dir = 'S';
    if (row % 4 === 0) dir = 'N';
    else if (row % 4 === 1) dir = 'W';
    else if (row % 4 === 2) dir = 'S';
    else if (row % 4 === 3) dir = 'E';

    // --- LINHAS 8 A 11: CAMINHADA ---
    if (row >= 8 && row <= 11) {
      const walkCycle = [0, 1, 2, 3, 0, 1, 2, 3, 0];
      const tilts = [0, -3, -1, 0, 3, 1, 0, -1, 0]; // Leve bamboleio de caminhada
      const bobs = [0, -1, -2, -1, -1, -2, -1, -1, 0];  // Leve pulo vertical
      for (let col = 0; col < 9; col++) {
        const frameIdx = walkCycle[col];
        await addFrame(row, col, walkFrames[dir][frameIdx], { rotate: tilts[col], offY: bobs[col] });
      }
      for (let col = 9; col < 13; col++) {
        await addFrame(row, col, walkFrames[dir][0]);
      }
    }

    // --- LINHAS 12 A 15: ATAQUE MELEE ---
    else if (row >= 12 && row <= 15) {
      if (hasAttackSheet) {
        // FLUXO B (Spritesheet de ataque real)
        const attackCycle = [
          { source: 'attack', idx: 0, opts: { offY: -1 } },
          { source: 'attack', idx: 1, opts: { offY: -2 } },
          { source: 'attack', idx: 2, opts: { offY: 1, tint: { r: 255, g: 230, b: 180 } } },
          { source: 'attack', idx: 3, opts: { offY: 2 } },
          { source: 'attack', idx: 3, opts: { offY: 1 } },
          { source: 'walk',   idx: 0, opts: {} }
        ];

        for (let col = 0; col < 6; col++) {
          const step = attackCycle[col];
          const buf = step.source === 'attack' ? attackFrames[dir][step.idx] : walkFrames[dir][step.idx];
          await addFrame(row, col, buf, step.opts);
        }
      } else {
        // FLUXO A (Criação procedural a partir de caminhada)
        // Definir deslocamento de lunge por direção
        let lungeX = 0, lungeY = 0;
        let windX = 0, windY = 0;
        let strikeTilt = 0, windTilt = 0;

        if (dir === 'N') { windY = 4; lungeY = -12; strikeTilt = -10; windTilt = 10; }
        else if (dir === 'S') { windY = -4; lungeY = 12; strikeTilt = 10; windTilt = -10; }
        else if (dir === 'W') { windX = 4; lungeX = -12; strikeTilt = -12; windTilt = 8; }
        else if (dir === 'E') { windX = -4; lungeX = 12; strikeTilt = 12; windTilt = -8; }

        const procAttackCycle = [
          // Frame 0: Prep (recuo leve)
          { idx: 0, opts: { offX: Math.round(windX / 2), offY: Math.round(windY / 2), rotate: Math.round(windTilt / 2) } },
          // Frame 1: Windup (recuo máximo)
          { idx: 1, opts: { offX: windX, offY: windY, rotate: windTilt } },
          // Frame 2: Strike (Investida rápida + Flash de impacto)
          { idx: 2, opts: { offX: lungeX, offY: lungeY, rotate: strikeTilt, tint: { r: 255, g: 230, b: 180 } } },
          // Frame 3: Follow-through (avanço residual)
          { idx: 3, opts: { offX: Math.round(lungeX * 0.7), offY: Math.round(lungeY * 0.7), rotate: Math.round(strikeTilt * 0.7) } },
          // Frame 4: Hold (retornando)
          { idx: 0, opts: { offX: Math.round(lungeX * 0.3), offY: Math.round(lungeY * 0.3) } },
          // Frame 5: Recovery
          { idx: 0, opts: {} }
        ];

        for (let col = 0; col < 6; col++) {
          const step = procAttackCycle[col];
          await addFrame(row, col, walkFrames[dir][step.idx], step.opts);
        }
      }

      for (let col = 6; col < 13; col++) {
        await addFrame(row, col, walkFrames[dir][0]);
      }
    }

    // --- LINHA 20: REAÇÃO A DANO E MORTE ---
    else if (row === 20) {
      // Dano sofrido (Frames 0-2): Achatamento vermelho e empurrão para trás
      const hurtFrames = [
        { scaleX: 1.18, scaleY: 0.82, offY: 3, offX: -4, tint: { r: 255, g: 50, b: 50 } },
        { scaleX: 1.08, scaleY: 0.92, offY: 1, offX: -2, tint: { r: 255, g: 120, b: 120 } },
        { scaleX: 1.0, scaleY: 1.0, offX: 0 }
      ];
      for (let col = 0; col < 3; col++) {
        await addFrame(row, col, walkFrames.S[0], hurtFrames[col]);
      }

      // Morte (Frames 3-5): Queda física, inclinação para o lado e fade-out
      const deathFrames = [
        { rotate: 30, offY: 6, opacity: 0.8, tint: { r: 200, g: 80, b: 80 } },
        { rotate: 60, offY: 10, opacity: 0.45, tint: { r: 140, g: 40, b: 40 } },
        { rotate: 90, offY: 14, opacity: 0.1, tint: { r: 90, g: 10, b: 10 } }
      ];
      for (let col = 3; col < 6; col++) {
        await addFrame(row, col, walkFrames.S[0], deathFrames[col - 3]);
      }

      for (let col = 6; col < 13; col++) {
        await addFrame(row, col, walkFrames.S[0], { opacity: 0.0 });
      }
    }

    // --- OUTRAS LINHAS (Spellcast, Thrust, Shoot) ---
    // Copia o frame parado de caminhada para preencher a planilha LPC
    else {
      for (let col = 0; col < 13; col++) {
        await addFrame(row, col, walkFrames[dir][0]);
      }
    }
  }

  // Gera o arquivo final composite
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite(compositeList)
  .png()
  .toFile(outputPath);

  console.log(`✓ Planilha Universal LPC gerada: ${outputPath}`);
}

// Execução por CLI
if (process.argv[1] && (process.argv[1].endsWith('compile_monster.mjs') || process.argv[1].endsWith('compile_monster'))) {
  const [,, name, walk, attack, output, size] = process.argv;
  if (!name || !walk || !output) {
    console.log('Uso: node compile_monster.mjs <name> <walk_path> <attack_path_or_null> <output_path> [sprite_size]');
    process.exit(1);
  }
  
  const atk = (attack === 'null' || attack === 'none') ? undefined : attack;
  const sz = size ? parseInt(size, 10) : undefined;

  compileMonster({
    name,
    walkPath: walk,
    attackPath: atk,
    outputPath: output,
    spriteSize: sz
  }).catch(console.error);
}
