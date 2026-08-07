// Supabase schema 静态契约回归：不访问真实项目，防止关键事务/RLS 迁移被误删。
'use strict';

const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
const failures = [];
function check(name, condition){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name);
  if (!condition) failures.push(name);
}

check('旧等级迁移按既有 level 补足最低 XP', /旧账号[\s\S]*xp\s*=\s*greatest\([\s\S]*xp_curve_version\s*=\s*1/i.test(sql));
check('空档案可从 history 回填独立 wins/total_wins', /wins_by_game[\s\S]*jsonb_object_agg\(game,\s*wins\)[\s\S]*total_wins/i.test(sql));
check('apply_reward_v1 使用账号级事务锁与 result_id 幂等', /create or replace function apply_reward_v1[\s\S]*pg_advisory_xact_lock[\s\S]*reward_history where result_id/i.test(sql));
check('RPC 校验 history/reward/ledger 一致性', [
  'reward_history_contract_mismatch', 'reward_amount_contract_mismatch',
  'reward_ledger_missing', 'reward_ledger_contract_mismatch',
].every(token => sql.includes(token)));
check('RPC 在同一函数写入档案与三类流水', [
  'update profiles set', 'insert into history', 'insert into reward_history', 'insert into economy_ledger',
].every(token => sql.toLowerCase().includes(token)));
check('九张服务端表全部启用 RLS', [
  'profiles', 'history', 'reward_history', 'economy_ledger', 'analytics_events',
  'friend_requests', 'friendships', 'blocks', 'reports',
].every(table => new RegExp('alter table\\s+' + table + '\\s+enable row level security', 'i').test(sql)));
check('Social Graph 表具备唯一关系与身份外键', /create table if not exists friend_requests[\s\S]*from_uid text not null references profiles[\s\S]*to_uid text not null references profiles[\s\S]*idx_friend_requests_pending_pair/i.test(sql) &&
  /create table if not exists friendships[\s\S]*unique \(a_uid, b_uid\)[\s\S]*check \(a_uid < b_uid\)/i.test(sql) &&
  /create table if not exists blocks[\s\S]*unique \(blocker_uid, blocked_uid\)/i.test(sql));
check('举报表只接受固定原因并保存最小上下文', /create table if not exists reports[\s\S]*harassment[\s\S]*inappropriate_name[\s\S]*recent_event_ids jsonb[\s\S]*target_snapshot jsonb/i.test(sql));
check('Social Graph 表不授权 anon/authenticated', ['friend_requests','friendships','blocks','reports'].every(table =>
  new RegExp('revoke all on table\\s+' + table + '\\s+from anon, authenticated', 'i').test(sql)));
check('奖励 RPC 只授权 service_role', /revoke all on function apply_reward_v1[\s\S]*from public, anon, authenticated;[\s\S]*grant execute on function apply_reward_v1[\s\S]*to service_role;/i.test(sql));
check('apply_purchase_v1 在账号锁内校验价格、余额与幂等请求', /create or replace function apply_purchase_v1[\s\S]*v_expected_price[\s\S]*p_price\s*<>\s*v_expected_price[\s\S]*pg_advisory_xact_lock[\s\S]*economy_ledger where uid = p_uid and kind = 'purchase' and ref_id = p_request_id[\s\S]*v_coins\s*<\s*p_price/i.test(sql));
check('购买 RPC 原子更新档案与经济流水', /create or replace function apply_purchase_v1[\s\S]*update profiles set[\s\S]*insert into economy_ledger[\s\S]*return jsonb_build_object\('applied', true/i.test(sql));
check('购买 requestId 列表最多保留 100 条', /jsonb_array_length\(v_requests\)\s*>\s*100[\s\S]*jsonb_array_length\(v_requests\)\s*-\s*100/i.test(sql));
check('购买 RPC 只授权 service_role', /revoke all on function apply_purchase_v1[\s\S]*from public, anon, authenticated;[\s\S]*grant execute on function apply_purchase_v1[\s\S]*to service_role;/i.test(sql));

if (failures.length){
  console.error('SUPABASE_SCHEMA_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('SUPABASE_SCHEMA_ALL_PASS');
}
