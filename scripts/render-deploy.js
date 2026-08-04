// 手动触发 Render 部署
// 用法：RENDER_KEY=rnd_xxx [COMMIT=sha] node scripts/render-deploy.js
const https = require('https');

const key = process.env.RENDER_KEY;
const SERVICE_ID = process.env.SERVICE_ID || 'srv-d9on79jl550s73f0roj0';
const commit = (process.env.COMMIT || '').trim();
if (!key) {
  console.error('RENDER_KEY env missing');
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
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
      );
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  try {
    const payload = { clearCache: 'do_not_clear' };
    if (commit) payload.commitId = commit;
    const r = await req('POST', '/v1/services/' + SERVICE_ID + '/deploys', payload);
    console.log('status:', r.status);
    console.log('body:', r.body.slice(0, 400));
  } catch (e) {
    console.error('ERR:', e.message);
  }
})();
