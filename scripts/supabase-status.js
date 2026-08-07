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
async function checkRewardRpc(){
  const res = await fetch(url + '/rest/v1/rpc/apply_reward_v1', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    // 空身份必定在函数入口抛错并回滚；只确认 RPC 已暴露，不写入数据。
    body: JSON.stringify({ p_profile: {}, p_history: {}, p_reward: {}, p_ledger: null }),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  return res.status === 400 && /invalid_reward_identity/i.test(text);
}
async function checkPurchaseRpc(){
  const res = await fetch(url + '/rest/v1/rpc/apply_purchase_v1', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    // 空身份和无效商品会在读取/写入 profiles 前失败，仅用于确认 RPC 已暴露。
    body: JSON.stringify({ p_uid: '', p_category: '', p_item_id: -1, p_price: -1, p_request_id: '' }),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  return res.status === 400 && /invalid_purchase_request/i.test(text);
}
async function checkAILearningRpc(){
  const res = await fetch(url + '/rest/v1/rpc/apply_ai_learning_v1', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    // 无效空载荷在任何读写前失败，只用于确认 RPC 和权限已刷新。
    body: JSON.stringify({ p_model: {}, p_result_id: '', p_experiences: [] }),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  return res.status === 400 && /invalid_ai_learning_payload/i.test(text);
}
(async () => {
  const base = await check('profiles?select=uid&limit=1');
  if (!base.ok){
    console.error('Supabase 连接失败：HTTP ' + base.status + '（响应已隐藏）');
    process.exitCode = 1;
    return;
  }
  console.log('Supabase REST 连接正常。');
  const required = await check('profiles?select=uid,auth_tokens,recent_results,purchase_requests,solo_rate,daily_key,daily_first_win_date,daily_ai_currency_key,daily_ai_currency_earned,xp_curve_version,wins,total_wins&limit=1');
  if (!required.ok){
    console.error('数据库迁移未完成：缺少本轮新增列（HTTP ' + required.status + '）。请在 SQL Editor 执行 supabase/schema.sql。');
    process.exitCode = 1;
    return;
  }
  const history = await check('history?select=uid,result_id,match_id,mode,xp,result,placement,eligible,blocked_reason&limit=1');
  if (!history.ok){
    console.error('history 表迁移未完成（HTTP ' + history.status + '）。请执行 supabase/schema.sql。');
    process.exitCode = 1;
    return;
  }
  for (const tableCheck of [
    ['reward_history', 'reward_history?select=uid,result_id,reward_currency,reward_xp,eligible,config_version&limit=1'],
    ['economy_ledger', 'economy_ledger?select=uid,kind,amount,balance_after&limit=1'],
    ['analytics_events', 'analytics_events?select=event,uid,match_id&limit=1'],
    ['ai_learning_models', 'ai_learning_models?select=uid,game,model_version,skill_version,revision,weights,trust,stats&limit=1'],
    ['ai_learning_experiences', 'ai_learning_experiences?select=uid,game,result_id,decision_index,state_hash,ai_outcome,used_for_training&limit=1'],
  ]){
    const result = await check(tableCheck[1]);
    if (!result.ok){
      console.error(tableCheck[0] + ' 表迁移未完成（HTTP ' + result.status + '）。请执行 supabase/schema.sql。');
      process.exitCode = 1;
      return;
    }
  }
  if (!(await checkRewardRpc())){
    console.error('apply_reward_v1 RPC 不存在、未刷新到 PostgREST，或入口校验异常；请重新执行 supabase/schema.sql。');
    process.exitCode = 1;
    return;
  }
  if (!(await checkPurchaseRpc())){
    console.error('apply_purchase_v1 RPC 不存在、未刷新到 PostgREST，或入口校验异常；请重新执行 supabase/schema.sql。');
    process.exitCode = 1;
    return;
  }
  if (!(await checkAILearningRpc())){
    console.error('apply_ai_learning_v1 RPC 不存在、未刷新到 PostgREST，或入口校验异常；请重新执行 supabase/schema.sql。');
    process.exitCode = 1;
    return;
  }
  console.log('必需字段与奖励/购买/AI 学习 RPC 检查通过（含个性化 AI 模型与经验表）。');
})().catch(err => {
  console.error('Supabase 检查失败：' + (err && err.message || String(err)));
  process.exitCode = 1;
});
