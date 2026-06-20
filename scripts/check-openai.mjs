import https from 'https';

const OPENAI_KEY = process.env.OPENAI_KEY || '';

const req = https.request({
  hostname: 'api.openai.com',
  path: '/v1/models',
  method: 'GET',
  headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.error) { console.log('ERRO:', json.error.message); return; }
    const imageModels = json.data.filter(m => m.id.includes('dall') || m.id.includes('image'));
    console.log('Modelos de imagem disponíveis:');
    imageModels.forEach(m => console.log(' -', m.id));
    if (!imageModels.length) console.log('Nenhum modelo de imagem disponível nesta conta.');
  });
});
req.on('error', e => console.log('Erro:', e.message));
req.end();
