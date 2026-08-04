// 设置 Render 服务环境变量（可只设置其中几个）
// 用法：RENDER_KEY=rnd_xxx [SUPABASE_URL=... SUPABASE_KEY=... DEEPSEEK_KEY=...] node scripts/render-env.js
const https = require('https');

const key = process.env.RENDER_KEY;
const SERVICE_ID = process.env.SERVICE_ID || 'srv-d9on79jl550s73f0roj0';
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_KEY || '').trim();
const deepseekKey = (process.env.DEEPSEEK_KEY || '').trim();
if (!key) {
  console.error('RENDER_KEY env missing');
  process.exit(1);
}
if (!supabaseUrl && !supabaseKey && !deepseekKey) {
  console.error('请至少提供一个环境变量（SUPABASE_URL / SUPABASE_KEY / DEEPSEEK_KEY）');
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
    const vars = [
      supabaseUrl ? ['SUPABASE_URL', supabaseUrl] : null,
      supabaseKey ? ['SUPABASE_KEY', supabaseKey] : null,
      deepseekKey ? ['DEEPSEEK_KEY', deepseekKey] : null,
    ].filter(Boolean);
    for (const [k, v] of vars){
      const r = await req('PUT', '/v1/services/' + SERVICE_ID + '/env-vars/' + encodeURIComponent(k), { value: v });
      console.log(k, '->', r.status, r.body.slice(0, 200));
    }
  } catch (e) {
    console.error('ERR:', e.message);
  }
})();
