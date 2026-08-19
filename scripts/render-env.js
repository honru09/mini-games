// 设置 Render 服务环境变量（可只设置其中几个）
// 用法：RENDER_KEY=rnd_xxx [SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ENABLE_CLUSTER_COORDINATION=1 TELEMETRY_WEBHOOK_URL=... TELEMETRY_WEBHOOK_ALLOWLIST=... TEST_ADMIN_ENABLED=1 TEST_ADMIN_UID=... TEST_ADMIN_USERNAME=... TEST_ADMIN_PASSWORD=...] node scripts/render-env.js
const https = require('https');
const { isValidTestAdminUid } = require('../server/test-admin');

const key = process.env.RENDER_KEY;
const SERVICE_ID = process.env.SERVICE_ID || 'srv-d9on79jl550s73f0roj0';
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim();
const deepseekKey = (process.env.DEEPSEEK_KEY || '').trim();
const metricsAdminToken = (process.env.METRICS_ADMIN_TOKEN || '').trim();
const clusterEnabled = (process.env.ENABLE_CLUSTER_COORDINATION || '').trim();
const telemetryUrl = (process.env.TELEMETRY_WEBHOOK_URL || '').trim();
const telemetryToken = (process.env.TELEMETRY_WEBHOOK_TOKEN || '').trim();
const telemetryAllowlist = (process.env.TELEMETRY_WEBHOOK_ALLOWLIST || '').trim();
const tetrisScoring = (process.env.TETRIS_GUIDELINE_SCORING || '').trim();
const testAdminEnabled = (process.env.TEST_ADMIN_ENABLED || '').trim();
const testAdminUid = (process.env.TEST_ADMIN_UID || '').trim();
const testAdminUsername = (process.env.TEST_ADMIN_USERNAME || '').trim();
const testAdminPassword = process.env.TEST_ADMIN_PASSWORD || '';
const REQUEST_TIMEOUT_MS = 15000;
if (!key) {
  console.error('RENDER_KEY env missing');
  process.exit(1);
}
if (clusterEnabled && !/^[01]$/.test(clusterEnabled)) { console.error('ENABLE_CLUSTER_COORDINATION 只能是 0 或 1'); process.exit(1); }
if (tetrisScoring && !/^[01]$/.test(tetrisScoring)) { console.error('TETRIS_GUIDELINE_SCORING 只能是 0 或 1'); process.exit(1); }
if (testAdminEnabled && !/^[01]$/.test(testAdminEnabled)) { console.error('TEST_ADMIN_ENABLED 只能是 0 或 1'); process.exit(1); }
const hasAnyTestAdminValue = !!(testAdminEnabled || testAdminUid || testAdminUsername || testAdminPassword);
if (testAdminEnabled === '1' && !(testAdminUid && testAdminUsername && testAdminPassword)) {
  console.error('测试管理员配置必须同时提供 ENABLED / UID / USERNAME / PASSWORD');
  process.exit(1);
}
if (testAdminEnabled !== '1' && (testAdminUid || testAdminUsername || testAdminPassword)) {
  console.error('未启用测试管理员时不得写入 UID / USERNAME / PASSWORD');
  process.exit(1);
}
if (testAdminEnabled === '1') {
  if (!isValidTestAdminUid(testAdminUid)) { console.error('TEST_ADMIN_UID 格式无效'); process.exit(1); }
  if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{4,20}$/.test(testAdminUsername)) { console.error('TEST_ADMIN_USERNAME 格式无效'); process.exit(1); }
  if (testAdminPassword.length < 8 || testAdminPassword.length > 64 || !/^[\x20-\x7e]+$/.test(testAdminPassword)) { console.error('TEST_ADMIN_PASSWORD 格式无效'); process.exit(1); }
}
if (telemetryUrl && !/^https:\/\//i.test(telemetryUrl)) { console.error('TELEMETRY_WEBHOOK_URL 必须使用 HTTPS'); process.exit(1); }
if ((telemetryUrl || telemetryToken) && !telemetryAllowlist) { console.error('Telemetry URL/Token 需要同时提供 TELEMETRY_WEBHOOK_ALLOWLIST'); process.exit(1); }
if (telemetryAllowlist && !telemetryAllowlist.split(',').every(host => /^[A-Za-z0-9.-]+$/.test(host.trim()) && !/^localhost$/i.test(host.trim()))) { console.error('TELEMETRY_WEBHOOK_ALLOWLIST 格式无效'); process.exit(1); }
if (!supabaseUrl && !supabaseKey && !deepseekKey && !metricsAdminToken && !clusterEnabled && !telemetryUrl && !telemetryToken && !telemetryAllowlist && !tetrisScoring && !hasAnyTestAdminValue) {
  console.error('请至少提供一个受支持的环境变量（Supabase / DeepSeek / Metrics / Cluster / Telemetry / Test Admin）。');
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
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode || 0 }));
    });
    r.on('error', reject);
    r.setTimeout(REQUEST_TIMEOUT_MS, () => r.destroy(new Error('Render API 请求超时')));
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  try {
    const vars = [
      supabaseUrl ? ['SUPABASE_URL', supabaseUrl] : null,
      supabaseKey ? ['SUPABASE_SERVICE_ROLE_KEY', supabaseKey] : null,
      deepseekKey ? ['DEEPSEEK_KEY', deepseekKey] : null,
      metricsAdminToken ? ['METRICS_ADMIN_TOKEN', metricsAdminToken] : null,
      clusterEnabled ? ['ENABLE_CLUSTER_COORDINATION', clusterEnabled] : null,
      telemetryUrl ? ['TELEMETRY_WEBHOOK_URL', telemetryUrl] : null,
      telemetryToken ? ['TELEMETRY_WEBHOOK_TOKEN', telemetryToken] : null,
      telemetryAllowlist ? ['TELEMETRY_WEBHOOK_ALLOWLIST', telemetryAllowlist] : null,
      tetrisScoring ? ['TETRIS_GUIDELINE_SCORING', tetrisScoring] : null,
      testAdminUid ? ['TEST_ADMIN_UID', testAdminUid] : null,
      testAdminUsername ? ['TEST_ADMIN_USERNAME', testAdminUsername] : null,
      testAdminPassword ? ['TEST_ADMIN_PASSWORD', testAdminPassword] : null,
      // 最后才启用，避免 Render 在逐项更新期间以半配置状态重启。
      testAdminEnabled ? ['TEST_ADMIN_ENABLED', testAdminEnabled] : null,
    ].filter(Boolean);
    for (const [k, v] of vars){
      const r = await req('PUT', '/v1/services/' + SERVICE_ID + '/env-vars/' + encodeURIComponent(k), { value: v });
      if (r.status < 200 || r.status >= 300) throw new Error(k + ' 更新失败：HTTP ' + r.status + '（响应已隐藏）');
      console.log(k + ' 更新成功（HTTP ' + r.status + '，响应已隐藏）');
    }
  } catch (e) {
    console.error('ERR:', e.message);
    process.exitCode = 1;
  }
})();
