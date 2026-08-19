// Supabase 只读连通性/迁移检查，不打印任何凭证。
// 必须使用仅保存在服务端的 service_role secret，不能使用 anon/publishable key。
// PowerShell: $env:SUPABASE_URL='https://...'; $env:SUPABASE_KEY='sb_secret_...'; node scripts/supabase-status.js
'use strict';

const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '');
if (!url || !key){
  console.error('SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 未设置；请提供服务端 service_role 凭证，不能在本地猜测或生成。');
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
async function probeRpc(name, body, expected){
  const res = await fetch(url + '/rest/v1/rpc/' + name, {
    method:'POST', headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json','Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(10000),
  });
  const text=await res.text();
  return expected(res.status,text);
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
    ['direct_messages', 'direct_messages?select=id,seq,conversation_id,sender_uid,recipient_uid,client_message_id,created_at&limit=1'],
    ['direct_message_reads', 'direct_message_reads?select=conversation_id,uid,peer_uid,last_read_seq,updated_at&limit=1'],
    ['cluster_instances', 'cluster_instances?select=instance_id,deployment_id,heartbeat_at,expires_at&limit=1'],
    ['cluster_leases', 'cluster_leases?select=lease_key,holder_instance_id,fencing_token,lease_until&limit=1'],
    ['platform_events', 'platform_events?select=id,topic,dedupe_key,origin_instance_id,created_at,expires_at&limit=1'],
    ['cluster_event_cursors', 'cluster_event_cursors?select=consumer_id,topic,last_event_id,updated_at&limit=1'],
    ['metrics_snapshots', 'metrics_snapshots?select=id,instance_id,generated_at,created_at&limit=1'],
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
  const rpcProbes = [
    ['send_direct_message_v1',{p_id:'',p_conversation_id:'',p_a_uid:'',p_b_uid:'',p_sender_uid:'',p_recipient_uid:'',p_client_message_id:'',p_body:''},(status,text)=>status===200&&/conversation_unavailable/i.test(text)],
    ['apply_direct_message_read_v1',{p_conversation_id:'',p_uid:'',p_peer_uid:'',p_last_read_seq:0},(status,text)=>status===400&&/invalid_direct_message_read/i.test(text)],
    ['claim_cluster_lease_v1',{p_lease_key:'',p_instance_id:'',p_ttl_seconds:0,p_deployment_id:'',p_metadata:{}},(status,text)=>status===400&&/invalid_cluster_lease_request/i.test(text)],
    ['append_platform_event_v1',{p_topic:'',p_dedupe_key:'',p_payload:{},p_origin_instance_id:'',p_lease_key:null,p_fencing_token:null},(status,text)=>status===400&&/invalid_platform_event/i.test(text)],
    ['get_direct_message_by_id_v1',{p_id:'__missing_status_probe__'},(status,text)=>status===200&&/^\s*null\s*$/.test(text)],
    ['cleanup_cluster_data_v1',{p_instance_id:'__missing_status_probe__',p_fencing_token:0},(status,text)=>status===400&&/stale_cluster_fencing_token/i.test(text)],
  ];
  for(const [name,body,predicate] of rpcProbes){
    if(!(await probeRpc(name,body,predicate))){console.error(name+' RPC 不存在、权限异常或入口校验漂移（响应已隐藏）。');process.exitCode=1;return;}
  }
  console.log('必需字段与奖励/购买/AI 学习/Direct Chat/Cluster/PubSub/Telemetry RPC 检查通过。');
})().catch(err => {
  console.error('Supabase 检查失败：' + (err && err.message || String(err)));
  process.exitCode = 1;
});
