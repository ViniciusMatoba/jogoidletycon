import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OPENAI_KEY = process.env.OPENAI_KEY || '';

const STYLE = 'pixel art icon, 64x64, transparent background, RPG idle game style, clean pixel art, no text, centered item';

const ASSETS = [
  { name: 'icon_gold',    prompt: `gold coin stack, shiny, ${STYLE}` },
  { name: 'icon_gem',     prompt: `blue crystal gem, sparkling, ${STYLE}` },
  { name: 'icon_wood',    prompt: `wooden log, brown, ${STYLE}` },
  { name: 'icon_stone',   prompt: `gray stone rock, ${STYLE}` },
  { name: 'icon_potion',  prompt: `red health potion bottle, glowing, ${STYLE}` },
  { name: 'icon_mana',    prompt: `blue mana potion bottle, glowing, ${STYLE}` },
];

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'icons');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function generateImage(asset) {
  console.log(`Gerando: ${asset.name}...`);

  const body = JSON.stringify({
    model: 'gpt-image-1',
    prompt: asset.prompt,
    n: 1,
    size: '1024x1024',
    quality: 'low',
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) { reject(new Error(json.error.message)); return; }
          const item = json.data[0];
          resolve({ url: item.url || null, b64: item.b64_json || null });
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function saveImage(result, name) {
  const filePath = path.join(OUTPUT_DIR, `${name}.png`);
  if (result.b64) {
    fs.writeFileSync(filePath, Buffer.from(result.b64, 'base64'));
    return filePath;
  }
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(result.url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(filePath); });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Gerando assets para Guilda Idle Tycoon ===\n');
  for (const asset of ASSETS) {
    try {
      const result = await generateImage(asset);
      const filePath = await saveImage(result, asset.name);
      console.log(`✓ Salvo: ${filePath}`);
      // Pausa entre requests para não estourar rate limit
      await new Promise(r => setTimeout(r, 1500));
    } catch(e) {
      console.error(`✗ Erro em ${asset.name}: ${e.message}`);
    }
  }
  console.log('\nConcluído! Assets em assets/icons/');
}

main();
