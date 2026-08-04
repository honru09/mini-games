// 设置 Render 服务环境变量
// 用法：RENDER_KEY=rnd_xxx SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=anonKey node scripts/render-env.js
const https = require('https');

const key = process.env.RENDER_KEY;
const SERVICE_ID = process.env.SERVICE_ID || 'srv-d9on79jl550s73f0roj0';
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_KEY || '').trim();
if (!key) {
  console.error('RENDER_KEY env missing');
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL / SUPABASE_KEY env missing');
  process.exit(1);
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      host: 'api.render.com',
      path,
      method,
      headers: {
        Authorization: 'Bearer ' + key,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      );
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  try {
    const payload = {
      envVars: [
        { key: 'SUPABASE_URL', value: supabaseUrl },
        { key: 'SUPABASE_KEY', value: supabaseKey },
      ],
    };
    const r = await req('PUT', '/v1/services/' + SERVICE_ID + '/env-vars', payload);
    console.log('status:', r.status);
    console.log('body:', r.body);
  } catch (e) {
    console.error('ERR:', e.message);
  }
})();
