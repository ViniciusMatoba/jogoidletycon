/**
 * Gerador de sprites LPC para monstros — com variações por raridade.
 *
 * Uso:
 *   node generate_monster_sprite.mjs all              → gera todos
 *   node generate_monster_sprite.mjs goblin           → gera todas as variações do goblin
 *   node generate_monster_sprite.mjs goblin normal    → gera só a variação normal
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const LPC = 'C:/Users/Usuario/Desktop/Universal-LPC-Spritesheet-Character-Generator-master/Universal-LPC-Spritesheet-Character-Generator-master/spritesheets';
const OUT  = './assets/sprites';

// ─── LAYOUT CLÁSSICO LPC 832×1344 ────────────────────────────────────────────
const SHEET_W = 832;
const SHEET_H = 1344;

const ANIMATIONS = [
  { name: 'spellcast', frames: 7,  rows: 4, yStart: 0    },
  { name: 'thrust',    frames: 8,  rows: 4, yStart: 256  },
  { name: 'walk',      frames: 9,  rows: 4, yStart: 512  },
  { name: 'slash',     frames: 6,  rows: 4, yStart: 768  },
  { name: 'shoot',     frames: 13, rows: 4, yStart: 1024 },
  { name: 'hurt',      frames: 6,  rows: 1, yStart: 1280 },
];

// ─── PALETAS DE COR ───────────────────────────────────────────────────────────
const PALETTES = {
  // pele humana padrão (fonte para swap)
  light:        ['#F9D5BA','#E4A47C','#cc8665','#99423c','#271920'],

  // verdes para goblin/orc
  bright_green: ['#99D248','#75AE23','#5B8F11','#255E1D','#02280E'],
  dark_green:   ['#509E59','#508A48','#255E1D','#06410E','#011708'],

  // tons especiais
  zombie:       ['#DBCBAB','#C5B38F','#A79778','#928364','#281820'],
  pale:         ['#C8C4D0','#A090A8','#7A6880','#5A4858','#201828'],
  brown:        ['#C09050','#9A6830','#784818','#502A08','#200C02'],
  dark:         ['#5A4040','#402828','#2A1818','#180C0C','#080404'],
};

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function colorDist(r1,g1,b1, r2,g2,b2) {
  return Math.abs(r1-r2) + Math.abs(g1-g2) + Math.abs(b1-b2);
}

/** Troca a paleta de cor de um buffer RGBA. */
async function recolorBuffer(buf, fromPalette, toPalette) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data);
  const srcColors = fromPalette.map(hexToRgb);
  const dstColors = toPalette.map(hexToRgb);
  const THRESHOLD = 30;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i+3] < 10) continue;
    const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
    let bestIdx = -1, bestDist = THRESHOLD;
    for (let j = 0; j < srcColors.length; j++) {
      const d = colorDist(r,g,b, srcColors[j][0],srcColors[j][1],srcColors[j][2]);
      if (d < bestDist) { bestDist = d; bestIdx = j; }
    }
    if (bestIdx >= 0 && bestIdx < dstColors.length) {
      pixels[i]   = dstColors[bestIdx][0];
      pixels[i+1] = dstColors[bestIdx][1];
      pixels[i+2] = dstColors[bestIdx][2];
    }
  }

  return sharp(Buffer.from(pixels), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// ─── DEFINIÇÃO DOS MONSTROS E VARIAÇÕES ──────────────────────────────────────
/**
 * layers: lista de camadas em ordem de composição (bg → corpo → acessórios → fg)
 *   folder  : caminho relativo ao spritesheets/
 *   variant : arquivo sem .png dentro da pasta de animação (null = usa animName.png direto)
 *   recolor : { from, to } — paleta de origem e destino (opcional)
 */
const MONSTERS = {

  // ── BIOMA 0: CAVERNAS ──────────────────────────────────────────────────────

  esqueleto: {
    normal: {
      outputFile: 'monster_esqueleto_universal.png',
      layers: [
        { folder: 'body/bodies/skeleton',      variant: 'skeleton' },
        { folder: 'head/heads/skeleton/adult', variant: 'skeleton' },
        // sem arma nas fases iniciais
      ],
    },
    raro: {
      // Esqueleto com escudo — mais resistente
      outputFile: 'monster_esqueleto_raro_universal.png',
      layers: [
        { folder: 'body/bodies/skeleton',          variant: 'skeleton' },
        { folder: 'head/heads/skeleton/adult',     variant: 'skeleton' },
        { folder: 'shield/shield_round/round',     variant: null },
      ],
    },
    elite: {
      // Esqueleto com espada — versão elite
      outputFile: 'monster_esqueleto_elite_universal.png',
      layers: [
        { folder: 'body/bodies/skeleton',          variant: 'skeleton' },
        { folder: 'head/heads/skeleton/adult',     variant: 'skeleton' },
        { folder: 'weapon/sword/longsword',        variant: null },
      ],
    },
  },

  goblin: {
    normal: {
      // Pequeno, verde, com adaga
      outputFile: 'monster_goblin_universal.png',
      layers: [
        { folder: 'body/bodies/teen',        variant: null, recolor: { from: 'light', to: 'bright_green' } },
        { folder: 'head/heads/goblin/child', variant: null },
        { folder: 'weapon/sword/dagger',     variant: null },
      ],
    },
    raro: {
      // Goblin adulto verde claro com clava
      outputFile: 'monster_goblin_raro_universal.png',
      layers: [
        { folder: 'body/bodies/male',        variant: null, recolor: { from: 'light', to: 'bright_green' } },
        { folder: 'head/heads/goblin/adult', variant: null },
        { folder: 'weapon/blunt/club',       variant: null },
      ],
    },
    elite: {
      // Goblin adulto verde escuro com clava
      outputFile: 'monster_goblin_elite_universal.png',
      layers: [
        { folder: 'body/bodies/male',        variant: null, recolor: { from: 'light', to: 'dark_green' } },
        { folder: 'head/heads/goblin/adult', variant: null },
        { folder: 'weapon/blunt/club',       variant: null },
      ],
    },
  },

  capitao_orc: {
    normal: {
      outputFile: 'monster_capitao_orc_universal.png',
      layers: [
        { folder: 'body/bodies/muscular',   variant: null, recolor: { from: 'light', to: 'dark_green' } },
        { folder: 'head/heads/orc/male',    variant: null },
        { folder: 'torso/armour/plate/male', variant: null },
      ],
    },
  },

  // ── BIOMA 1: FLORESTA ──────────────────────────────────────────────────────

  lobisomen: {
    normal: {
      outputFile: 'monster_lobisomen_universal.png',
      layers: [
        // cauda bg (atrás do corpo)
        { folder: 'body/tail/wolf/adult/bg',  variant: 'fur_brown' },
        { folder: 'body/bodies/male',          variant: null, recolor: { from: 'light', to: 'brown' } },
        { folder: 'head/heads/wolf/male',      variant: null },
        // cauda fg (na frente do corpo)
        { folder: 'body/tail/wolf/adult/fg',  variant: 'fur_brown' },
      ],
    },
    raro: {
      // Lobisomen negro — mais raro e ameaçador
      outputFile: 'monster_lobisomen_raro_universal.png',
      layers: [
        { folder: 'body/tail/wolf/adult/bg',  variant: 'fur_black' },
        { folder: 'body/bodies/male',          variant: null, recolor: { from: 'light', to: 'dark' } },
        { folder: 'head/heads/wolf/male',      variant: null },
        { folder: 'body/tail/wolf/adult/fg',  variant: 'fur_black' },
      ],
    },
  },

  vampiro: {
    normal: {
      outputFile: 'monster_vampiro_universal.png',
      layers: [
        // capa bg (atrás do corpo)
        { folder: 'cape/solid/bg',             variant: null },
        { folder: 'body/bodies/male',           variant: null, recolor: { from: 'light', to: 'pale' } },
        { folder: 'head/heads/vampire/adult',   variant: null },
        // capa fg (na frente do corpo)
        { folder: 'cape/solid/fg',             variant: null },
      ],
    },
    raro: {
      // Vampiro com capa rasgada — mais antigo
      outputFile: 'monster_vampiro_raro_universal.png',
      layers: [
        { folder: 'cape/tattered/bg',          variant: null },
        { folder: 'body/bodies/male',           variant: null, recolor: { from: 'light', to: 'pale' } },
        { folder: 'head/heads/vampire/adult',   variant: null },
        { folder: 'cape/tattered/fg',          variant: null },
      ],
    },
  },

  orc: {
    normal: {
      outputFile: 'monster_orc_universal.png',
      layers: [
        { folder: 'body/bodies/male',    variant: null, recolor: { from: 'light', to: 'dark_green' } },
        { folder: 'head/heads/orc/male', variant: null },
      ],
    },
    raro: {
      // Orc com armadura de couro
      outputFile: 'monster_orc_raro_universal.png',
      layers: [
        { folder: 'body/bodies/muscular',       variant: null, recolor: { from: 'light', to: 'dark_green' } },
        { folder: 'head/heads/orc/male',         variant: null },
        { folder: 'torso/armour/leather/male',   variant: null },
      ],
    },
  },

  feiticeira: {
    normal: {
      outputFile: 'monster_feiticeira_universal.png',
      layers: [
        { folder: 'body/bodies/female',          variant: null },
        { folder: 'head/heads/human/female',      variant: null },
        // robe tem cores: black, blue, brown, dark_brown, dark_gray, forest_green, light_gray, purple, red, white
        { folder: 'torso/clothes/robe/female',    variant: 'purple' },
        // chapéu de mago (base = shape, belt + buckle = detalhes)
        { folder: 'hat/magic/wizard/base/adult',  variant: null },
      ],
    },
    raro: {
      // Feiticeira de robe negro
      outputFile: 'monster_feiticeira_raro_universal.png',
      layers: [
        { folder: 'body/bodies/female',          variant: null },
        { folder: 'head/heads/human/female',      variant: null },
        { folder: 'torso/clothes/robe/female',    variant: 'dark_brown' },
        { folder: 'hat/magic/wizard/base/adult',  variant: null },
      ],
    },
  },

  cavaleiro_sombrio: {
    normal: {
      outputFile: 'monster_cavaleiro_sombrio_universal.png',
      layers: [
        // capa bg (atrás)
        { folder: 'cape/solid/bg',            variant: null },
        { folder: 'body/bodies/male',          variant: null, recolor: { from: 'light', to: 'dark' } },
        { folder: 'torso/armour/plate/male',   variant: null },
        { folder: 'hat/helmet/close/male',     variant: null },
        // capa fg (frente)
        { folder: 'cape/solid/fg',            variant: null },
      ],
    },
  },

  lich: {
    normal: {
      outputFile: 'monster_lich_universal.png',
      layers: [
        // capa bg (atrás)
        { folder: 'cape/tattered/bg',          variant: null },
        { folder: 'body/bodies/skeleton',       variant: 'skeleton' },
        { folder: 'head/heads/skeleton/adult',  variant: 'skeleton' },
        // capa fg (frente)
        { folder: 'cape/tattered/fg',          variant: null },
      ],
    },
  },

  // ── BIOMA 2: PÂNTANO ───────────────────────────────────────────────────────

  rei_demonios: {
    normal: {
      outputFile: 'monster_rei_demonios_universal.png',
      layers: [
        // asas de morcego bg (atrás do corpo)
        { folder: 'body/wings/bat/adult/bg',              variant: 'dark_brown' },
        { folder: 'body/bodies/muscular',                  variant: null, recolor: { from: 'light', to: 'zombie' } },
        // chifres bg (atrás da cabeça)
        { folder: 'hat/accessory/horns_upward/bg/adult',   variant: null },
        { folder: 'head/heads/orc/male',                   variant: null },
        // chifres fg (na frente da cabeça)
        { folder: 'hat/accessory/horns_upward/fg/adult',   variant: null },
        // asas fg (na frente do corpo)
        { folder: 'body/wings/bat/adult/fg',              variant: 'dark_brown' },
      ],
    },
  },

  dragonborn_boss: {
    normal: {
      outputFile: 'monster_dragonborn_boss_universal.png',
      layers: [
        // asas de dragão bg
        { folder: 'body/wings/lizard/adult/bg',  variant: null },
        { folder: 'body/bodies/muscular',          variant: null, recolor: { from: 'light', to: 'zombie' } },
        { folder: 'torso/armour/plate/male',       variant: null },
        { folder: 'head/heads/orc/male',           variant: null },
        { folder: 'hat/helmet/horned/adult',       variant: null },
        // asas fg
        { folder: 'body/wings/lizard/adult/fg',   variant: null },
      ],
    },
  },
};

// ─── FUNÇÕES DE COMPOSIÇÃO ───────────────────────────────────────────────────

function findLayerSource(folder, animName, variant) {
  const base = path.join(LPC, folder);

  // 1. Mapeamento de possíveis nomes de subpastas/arquivos para a animação
  let possibleDirs = [animName];
  if (animName === 'slash') possibleDirs.push('attack_slash', 'attack_slash_reverse');
  if (animName === 'thrust') possibleDirs.push('attack_thrust');
  if (animName === 'spellcast') possibleDirs.push('cast');

  // Tenta achar em uma das subpastas mapeadas
  for (const d of possibleDirs) {
    if (variant) {
      // Ex: folder/attack_slash/purple.png
      const p = path.join(base, d, `${variant}.png`);
      if (fs.existsSync(p)) return { path: p, isSingleSheet: false };
    }
    // Ex: folder/attack_slash.png
    const p2 = path.join(base, `${d}.png`);
    if (fs.existsSync(p2)) return { path: p2, isSingleSheet: false };

    // Ex: primeira .png em folder/attack_slash/
    const dir = path.join(base, d);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
      if (files.length > 0) return { path: path.join(dir, files[0]), isSingleSheet: false };
    }
  }

  // 2. Se não achou pasta da animação, procura por um PNG consolidado na raiz da pasta
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    const files = fs.readdirSync(base).filter(f => f.endsWith('.png'));
    if (files.length > 0) {
      return { path: path.join(base, files[0]), isSingleSheet: true };
    }
  }

  return null;
}

async function buildAnimStrip(layers, anim) {
  const w = anim.frames * 64;
  const h = anim.rows * 64;

  const composites = [];

  for (const layer of layers) {
    const src = findLayerSource(layer.folder, anim.name, layer.variant);
    if (!src) continue;

    const meta = await sharp(src.path).metadata();
    let buf;

    if (src.isSingleSheet) {
      // Se for spritesheet único consolidado, o PNG tem o tamanho inteiro (ex: 832x1344).
      // Se a animação pedida iniciar após o fim do spritesheet, simplesmente pulamos.
      if (anim.yStart >= meta.height) {
        continue;
      }
      buf = await sharp(src.path)
        .ensureAlpha()
        .extract({
          left: 0,
          top: anim.yStart,
          width: Math.min(meta.width, w),
          height: Math.min(meta.height - anim.yStart, h)
        })
        .toBuffer();
    } else {
      // Se for um PNG específico de animação (já é uma tira ou grade recortada)
      buf = await sharp(src.path).ensureAlpha().toBuffer();
      const bufMeta = await sharp(buf).metadata();
      if (bufMeta.width > w || bufMeta.height > h) {
        buf = await sharp(buf).extract({
          left: 0, top: 0,
          width: Math.min(bufMeta.width, w),
          height: Math.min(bufMeta.height, h),
        }).toBuffer();
      }
    }

    // Palette swap
    if (layer.recolor && layer.recolor.from !== layer.recolor.to) {
      const fromPal = PALETTES[layer.recolor.from];
      const toPal   = PALETTES[layer.recolor.to];
      if (fromPal && toPal) {
        buf = await recolorBuffer(buf, fromPal, toPal);
      }
    }

    composites.push({ input: buf, left: 0, top: 0, blend: 'over' });
  }

  let result;
  if (composites.length === 0) {
    result = await sharp({
      create: { width: w, height: h, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
    }).png().toBuffer();
  } else {
    result = await sharp({
      create: { width: w, height: h, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
    }).composite(composites).png().toBuffer();
  }

  // Padding horizontal até 832px
  if (w < SHEET_W) {
    result = await sharp(result).extend({
      right: SHEET_W - w,
      background: { r:0,g:0,b:0,alpha:0 }
    }).png().toBuffer();
  }

  return result;
}

async function generateVariant(monsterName, variantName, def) {
  process.stdout.write(`  [${variantName}] `);
  const animBuffers = [];
  for (const anim of ANIMATIONS) {
    try {
      const buf = await buildAnimStrip(def.layers, anim);
      animBuffers.push(buf);
      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('x');
      const empty = await sharp({
        create: { width: SHEET_W, height: anim.rows * 64, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
      }).png().toBuffer();
      animBuffers.push(empty);
    }
  }

  const composites = ANIMATIONS.map((anim, i) => ({
    input: animBuffers[i],
    left: 0,
    top: anim.yStart,
    blend: 'over',
  }));

  const outPath = path.join(OUT, def.outputFile);
  await sharp({
    create: { width: SHEET_W, height: SHEET_H, channels: 4, background: { r:0,g:0,b:0,alpha:0 } }
  }).composite(composites).png().toFile(outPath);

  console.log(` ✅ ${def.outputFile}`);
}

async function generateMonster(name) {
  const variants = MONSTERS[name];
  if (!variants) {
    console.error(`Monstro "${name}" não encontrado. Disponíveis: ${Object.keys(MONSTERS).join(', ')}`);
    process.exit(1);
  }
  console.log(`\n🎨 ${name}`);
  for (const [variantName, def] of Object.entries(variants)) {
    await generateVariant(name, variantName, def);
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
const [monsterArg, variantArg] = process.argv.slice(2);

if (!monsterArg || monsterArg === 'all') {
  console.log(`Gerando ${Object.keys(MONSTERS).length} monstros...`);
  for (const name of Object.keys(MONSTERS)) {
    await generateMonster(name);
  }
} else if (variantArg && MONSTERS[monsterArg]?.[variantArg]) {
  console.log(`\n🎨 ${monsterArg} [${variantArg}]`);
  await generateVariant(monsterArg, variantArg, MONSTERS[monsterArg][variantArg]);
} else {
  await generateMonster(monsterArg);
}
