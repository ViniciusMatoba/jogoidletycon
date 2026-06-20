import https from 'https';

const GEMINI_KEY = process.env.GEMINI_KEY || '';

const req = https.request({
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models?key=${GEMINI_KEY}`,
  method: 'GET',
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.error) { console.log('ERRO:', json.error.message); return; }
    console.log('Modelos com suporte a imagem:');
    json.models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .filter(m => m.name.includes('image') || m.name.includes('imagen') || m.name.includes('flash'))
      .forEach(m => console.log(' -', m.name));
  });
});
req.on('error', e => console.log('Erro:', e.message));
req.end();
