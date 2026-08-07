// Supabase 只读连通性/迁移检查，不打印任何凭证。
// 必须使用仅保存在服务端的 service_role secret，不能使用 anon/publishable key。
// PowerShell: $env:SUPABASE_URL='https://...'; $env:SUPABASE_KEY='sb_secret_...'; node scripts/supabase-status.js
'use strict';

const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = String(process.env.SUPABASE_KEY || '');
if (!url || !key){
  console.error('SUPABASE_URL 与 SUPABASE_KEY 未设置；请提供服务端 service_role 凭证，不能在本地猜测或生成。');
  process.exit(2);
}
if (!/^https:\/\/[^/]+\.supabase\.co$/i.test(url)){
  console.error('SUPABASE_URL 格式异常（应为 https://<project>.supabase.co）。');
  process.exit(2);
}
async function check(path){
  const res = await fetch(url + '/rest/v1/' + path, {
    headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}
(async () => {
  const base = await check('profiles?select=uid&limit=1');
  if (!base.ok){
    console.error('Supabase 连接失败：HTTP ' + base.status + '（响应已隐藏）');
    process.exitCode = 1;
    return;
  }
  console.log('Supabase REST 连接正常。');
  const required = await check('profiles?select=uid,auth_tokens,recent_results,purchase_requests,solo_rate,daily_key&limit=1');
  if (!required.ok){
    console.error('数据库迁移未完成：缺少本轮新增列（HTTP ' + required.status + '）。请在 SQL Editor 执行 supabase/schema.sql。');
    process.exitCode = 1;
    return;
  }
  const history = await check('history?select=uid,result_id,match_id,mode&limit=1');
  if (!history.ok){
    console.error('history 表迁移未完成（HTTP ' + history.status + '）。请执行 supabase/schema.sql。');
    process.exitCode = 1;
    return;
  }
  console.log('必需字段检查通过（profiles/history）。');
})().catch(err => {
  console.error('Supabase 检查失败：' + (err && err.message || String(err)));
  process.exitCode = 1;
});
