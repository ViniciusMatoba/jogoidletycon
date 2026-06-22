import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC_WALK = './assets/sprites/monster_goblin.png';
const SRC_ATTACK = './assets/sprites/monster_goblin_attack.png';
const OUT_DIR = './assets/sprites';

async function compileGoblin(variantName, outputFile, baseImgSize, hueShift = 0) {
  console.log(`Compilando Goblin [Variante: ${variantName}] -> ${outputFile} (Tamanho: ${baseImgSize}px, Hue Shift: ${hueShift})`);

  if (!fs.existsSync(SRC_WALK) || !fs.existsSync(SRC_ATTACK)) {
    console.error('Erro: Spritesheets de entrada não encontradas!');
    process.exit(1);
  }

  const sharpWalk = sharp(SRC_WALK);
  const sharpAttack = sharp(SRC_ATTACK);

  const walkMeta = await sharpWalk.metadata();
  const attackMeta = await sharpAttack.metadata();

  const walkCellW = walkMeta.width / 4;
  const walkCellH = walkMeta.height / 4;

  const attackCellW = attackMeta.width / 4;
  const attackCellH = attackMeta.height / 4;

  // Direções no grid 4x4: 0 = S, 1 = W, 2 = E, 3 = N
  const dirs = ['S', 'W', 'E', 'N'];
  const walkFrames = { S: [], W: [], E: [], N: [] };
  const attackFrames = { S: [], W: [], E: [], N: [] };

  // Helper para extrair frames e aplicar efeitos (hue-shift)
  async function extractFrames(srcSharp, cellW, cellH, targetDict) {
    for (let row = 0; row < 4; row++) {
      const dir = dirs[row];
      for (let col = 0; col < 4; col++) {
        let frame = srcSharp
          .clone()
          .extract({ left: col * cellW, top: row * cellH, width: cellW, height: cellH })
          .resize(baseImgSize, baseImgSize);

        if (hueShift !== 0) {
          frame = frame.modulate({ hue: hueShift });
        }

        const buf = await frame.png().toBuffer();
        targetDict[dir].push(buf);
      }
    }
  }

  await extractFrames(sharpWalk, walkCellW, walkCellH, walkFrames);
  await extractFrames(sharpAttack, attackCellW, attackCellH, attackFrames);

  // LPC sheet properties: 832x1344 (13 columns x 21 rows of 64x64)
  const lpcCellW = 64;
  const lpcCellH = 64;
  const sheetW = 832;
  const sheetH = 1344;
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
    const targetW = Math.round(baseImgSize * scaleX);
    const targetH = Math.round(baseImgSize * scaleY);
    sImg = sImg.resize(targetW, targetH);

    if (rotate) {
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

    // Redimensionar para caber na célula de 64x64 caso a rotação tenha expandido os limites
    if (finalW > 64 || finalH > 64) {
      finalBuf = await sharp(finalBuf)
        .resize(Math.min(finalW, 64), Math.min(finalH, 64), { fit: 'inside' })
        .toBuffer();
      const resizedMeta = await sharp(finalBuf).metadata();
      finalW = resizedMeta.width;
      finalH = resizedMeta.height;
    }

    const left = Math.max(0, Math.min(64 - finalW, Math.round((64 - finalW) / 2) + offX));
    const top = Math.max(0, Math.min(64 - finalH, (64 - finalH) - 4 + offY));

    // Canvas temporário de 64x64 para garantir alinhamento perfeito sem vazamentos
    const frameBuffer = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{
      input: finalBuf,
      left: left,
      top: top
    }])
    .png()
    .toBuffer();

    compositeList.push({
      input: frameBuffer,
      left: col * lpcCellW,
      top: row * lpcCellH
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
      const tilts = [0, -4, -2, 0, 4, 2, 0, -2, 0]; 
      const bobs = [0, -1, -2, -1, -1, -2, -1, -1, 0]; 
      for (let col = 0; col < 9; col++) {
        const frameIdx = walkCycle[col];
        await addFrame(row, col, walkFrames[dir][frameIdx], { rotate: tilts[col], offY: bobs[col] });
      }
      // Frames vazios/idle no fim da linha
      for (let col = 9; col < 13; col++) {
        await addFrame(row, col, walkFrames[dir][0]);
      }
    }

    // --- LINHAS 12 A 15: ATAQUE MELEE / SLASH ---
    else if (row >= 12 && row <= 15) {
      // 6 frames de ataque (mapeando de monster_goblin_attack.png)
      // Quadro 0: Prep (Attack Frame 0)
      // Quadro 1: Windup (Attack Frame 1)
      // Quadro 2: Strike (Attack Frame 2)
      // Quadro 3: Swing finish (Attack Frame 3)
      // Quadro 4: Hold (Attack Frame 3 com leve delay)
      // Quadro 5: Recovery (Walk Frame 0)
      const attackCycle = [
        { source: 'attack', idx: 0, opts: { offY: -1 } },
        { source: 'attack', idx: 1, opts: { offY: -2 } },
        { source: 'attack', idx: 2, opts: { offY: 1, tint: { r: 255, g: 230, b: 180 } } }, // Brilho de impacto leve
        { source: 'attack', idx: 3, opts: { offY: 2 } },
        { source: 'attack', idx: 3, opts: { offY: 1 } },
        { source: 'walk',   idx: 0, opts: {} }
      ];

      for (let col = 0; col < 6; col++) {
        const step = attackCycle[col];
        const buf = step.source === 'attack' ? attackFrames[dir][step.idx] : walkFrames[dir][step.idx];
        await addFrame(row, col, buf, step.opts);
      }

      // Preencher o resto da linha
      for (let col = 6; col < 13; col++) {
        await addFrame(row, col, walkFrames[dir][0]);
      }
    }

    // --- LINHA 20: REAÇÃO A DANO E MORTE ---
    else if (row === 20) {
      // Reação de Dano (Frames 0-2)
      const hurtFrames = [
        { scaleX: 1.15, scaleY: 0.85, offY: 2, offX: -4, tint: { r: 255, g: 60, b: 60 } },
        { scaleX: 1.05, scaleY: 0.95, offY: 1, offX: -2, tint: { r: 255, g: 140, b: 140 } },
        { scaleX: 1.0, scaleY: 1.0, offX: 0 }
      ];
      for (let col = 0; col < 3; col++) {
        await addFrame(row, col, walkFrames.S[0], hurtFrames[col]);
      }

      // Reação de Morte (Frames 3-5)
      const deathFrames = [
        { rotate: 30, offY: 4, opacity: 0.8, tint: { r: 200, g: 100, b: 100 } },
        { rotate: 60, offY: 8, opacity: 0.5, tint: { r: 150, g: 50, b: 50 } },
        { rotate: 90, offY: 12, opacity: 0.1, tint: { r: 100, g: 20, b: 20 } }
      ];
      for (let col = 3; col < 6; col++) {
        await addFrame(row, col, walkFrames.S[0], deathFrames[col - 3]);
      }

      // Preencher o resto da linha
      for (let col = 6; col < 13; col++) {
        await addFrame(row, col, walkFrames.S[0], { opacity: 0.0 });
      }
    }

    // --- OUTRAS LINHAS (Spellcast, Thrust, Shoot) ---
    else {
      for (let col = 0; col < 13; col++) {
        await addFrame(row, col, walkFrames[dir][0]);
      }
    }
  }

  const outPath = path.join(OUT_DIR, outputFile);
  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite(compositeList)
  .png()
  .toFile(outPath);

  console.log(`✓ Spritesheet gerada: ${outPath}`);
}

async function main() {
  // 1. Goblin Normal: 48px, sem hue shift
  await compileGoblin('normal', 'monster_goblin_universal.png', 48, 0);

  // 2. Goblin Raro: 53px (um pouco maior), leve hue shift para um verde mais amarelado/musgo (+20)
  await compileGoblin('raro', 'monster_goblin_raro_universal.png', 53, 20);

  // 3. Goblin Elite: 58px (maior e imponente), hue shift para verde-escuro/azulado (cerca de 315 no circulo de 360)
  await compileGoblin('elite', 'monster_goblin_elite_universal.png', 58, 315);
}

main().catch(err => {
  console.error('Erro na compilação:', err);
  process.exit(1);
});
