import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Remove a cor de fundo (Chroma Key) e suaviza as bordas.
 * 
 * @param {string} inputPath Caminho do arquivo de entrada
 * @param {string} outputPath Caminho do arquivo de saída
 * @param {object} options Opções de remoção
 */
export async function makeTransparent(inputPath, outputPath, options = {}) {
  const keyColor = options.keyColor ?? { r: 255, g: 0, b: 255 }; // Padrão: Magenta
  const tolerance = options.tolerance ?? 45;
  const feather = options.feather ?? 25; // Transição suave nas bordas

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // Distância Manhattan (mais rápida e eficaz para cores primárias)
    const dist = Math.abs(r - keyColor.r) + Math.abs(g - keyColor.g) + Math.abs(b - keyColor.b);

    if (dist < tolerance) {
      pixels[i + 3] = 0; // Transparente total
    } else if (dist < tolerance + feather) {
      // Suavização gradual
      const factor = (dist - tolerance) / feather; // 0.0 a 1.0
      pixels[i + 3] = Math.round(a * factor);
      
      // Ajusta opcionalmente a cor das bordas para reduzir sangramento de cor (bleed)
      // Substitui o magenta residual pela cor média ou zera para evitar contorno rosa
      if (factor < 0.5) {
        pixels[i] = Math.round(r * factor);
        pixels[i + 1] = Math.round(g * factor);
        pixels[i + 2] = Math.round(b * factor);
      }
    }
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await sharp(Buffer.from(pixels), {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
  .png()
  .toFile(outputPath);

  console.log(`✓ Transparência aplicada com sucesso em: ${outputPath}`);
}

// Execução direta por CLI se necessário
if (process.argv[1] && (process.argv[1].endsWith('make_transparent.mjs') || process.argv[1].endsWith('make_transparent'))) {
  const [,, input, output, tol, feat] = process.argv;
  if (!input || !output) {
    console.log('Uso: node make_transparent.mjs <input> <output> [tolerance] [feather]');
    process.exit(1);
  }
  makeTransparent(input, output, {
    tolerance: tol ? parseInt(tol, 10) : undefined,
    feather: feat ? parseInt(feat, 10) : undefined
  }).catch(console.error);
}
