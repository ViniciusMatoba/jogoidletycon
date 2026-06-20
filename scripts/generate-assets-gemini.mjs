import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GEMINI_KEY = process.env.GEMINI_KEY || '';

const STYLE = 'pixel art icon, RPG idle game style, clean pixel art, transparent background, centered, no text, 64x64 pixels';

const ASSETS = [
  { name: 'icon_gold',   prompt: `gold coin stack, shiny golden, pixel art RPG icon, ${STYLE}` },
  { name: 'icon_gem',    prompt: `blue crystal gem, sparkling, pixel art RPG icon, ${STYLE}` },
  { name: 'icon_wood',   prompt: `brown wooden log, pixel art RPG icon, ${STYLE}` },
  { name: 'icon_stone',  prompt: `gray stone rock pile, pixel art RPG icon, ${STYLE}` },
  { name: 'icon_potion', prompt: `red health potion bottle glowing, pixel art RPG icon, ${STYLE}` },
  { name: 'icon_mana',   prompt: `blue mana potion bottle glowing, pixel art RPG icon, ${STYLE}` },
];

const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'icons');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function generateImage(asset) {
  console.log(`Gerando: ${asset.name}...`);

  const body = JSON.stringify({
    contents: [{ parts: [{ text: asset.prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-3.1-flash-image:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: {
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
          const parts = json.candidates?.[0]?.content?.parts || [];
          const imgPart = parts.find(p => p.inlineData);
          if (!imgPart) { reject(new Error('Nenhuma imagem retornada')); return; }
          resolve(imgPart.inlineData.data);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Gerando assets via Gemini para Guilda Idle Tycoon ===\n');
  for (const asset of ASSETS) {
    try {
      const b64 = await generateImage(asset);
      const filePath = path.join(OUTPUT_DIR, `${asset.name}.png`);
      fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
      console.log(`✓ Salvo: ${filePath}`);
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {
      console.error(`✗ Erro em ${asset.name}: ${e.message}`);
    }
  }
  console.log('\nConcluído! Assets em assets/icons/');
}

main();
