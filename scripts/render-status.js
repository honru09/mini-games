// Render 服务状态查询
// 用法：RENDER_KEY=rnd_xxx node scripts/render-status.js
const https = require('https');

const key = process.env.RENDER_KEY;
const SERVICE_ID = process.env.SERVICE_ID || 'srv-d9on79jl550s73f0roj0';
const REQUEST_TIMEOUT_MS = 15000;
if (!key) {
  console.error('RENDER_KEY env missing');
  process.exit(1);
}

function req(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      host: 'api.render.com',
      path,
      method,
      headers: {
        Authorization: 'Bearer ' + key,
        Accept: 'application/json',
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
    r.setTimeout(REQUEST_TIMEOUT_MS, () => r.destroy(new Error('Render API 请求超时')));
    r.end();
  });
}

(async () => {
  try {
    const svc = await req('GET', '/v1/services/' + SERVICE_ID);
    if (svc.status < 200 || svc.status >= 300) throw new Error('查询服务失败：HTTP ' + svc.status + '（响应已隐藏）');
    const s = JSON.parse(svc.body);
    console.log('== service ==');
    console.log(
      JSON.stringify(
        {
          id: s.id,
          name: s.name,
          url: s.serviceDetails?.url,
          suspended: s.suspended,
          serviceDetails: {
            plan: s.serviceDetails?.plan,
            env: s.serviceDetails?.env,
            numInstances: s.serviceDetails?.numInstances,
            runtime: s.serviceDetails?.runtime,
          },
        },
        null,
        2
      )
    );

    const deploys = await req('GET', '/v1/services/' + SERVICE_ID + '/deploys?limit=5');
    if (deploys.status < 200 || deploys.status >= 300) throw new Error('查询部署失败：HTTP ' + deploys.status + '（响应已隐藏）');
    const d = JSON.parse(deploys.body);
    const list = Array.isArray(d) ? d.map((x) => x.deploy || x) : d.deploys || [];
    console.log('\n== deploys ==');
    for (const dep of list) {
      console.log(
        dep.id,
        '| status:',
        dep.status,
        '| commit:',
        dep.commit?.id,
        '| createdAt:',
        dep.createdAt,
        '| finishedAt:',
        dep.finishedAt || '-'
      );
    }
  } catch (e) {
    console.error('ERR:', e.message);
    process.exitCode = 1;
  }
})();
