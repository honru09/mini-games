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
check('Profile 保存公开游戏装备字段', /game_cosmetics\s+jsonb\s+not null/i.test(sql) && /add column if not exists game_cosmetics/i.test(sql));
check('用户名密码迁移列与大小写无关唯一索引可重复创建',
  ['username text','username_key text','password_hash text','auth_version text'].every(token=>sql.toLowerCase().includes(token)) &&
  /create unique index if not exists idx_profiles_username_key on profiles \(username_key\) where username_key is not null/i.test(sql));
check('空档案可从 history 回填独立 wins/total_wins', /wins_by_game[\s\S]*jsonb_object_agg\(game,\s*wins\)[\s\S]*total_wins/i.test(sql));
check('apply_reward_v1 使用账号级事务锁与 result_id 幂等', /create or replace function apply_reward_v1[\s\S]*pg_advisory_xact_lock[\s\S]*reward_history where result_id/i.test(sql));
check('RPC 校验 history/reward/ledger 一致性', [
  'reward_history_contract_mismatch', 'reward_amount_contract_mismatch',
  'reward_ledger_missing', 'reward_ledger_contract_mismatch',
].every(token => sql.includes(token)));
check('RPC 在同一函数写入档案与三类流水', [
  'update profiles set', 'insert into history', 'insert into reward_history', 'insert into economy_ledger',
].every(token => sql.toLowerCase().includes(token)));
check('七张服务端表全部启用 RLS', [
  'profiles', 'history', 'reward_history', 'economy_ledger', 'analytics_events',
  'ai_learning_models', 'ai_learning_experiences',
].every(table => new RegExp('alter table\\s+' + table + '\\s+enable row level security', 'i').test(sql)));
check('奖励 RPC 只授权 service_role', /revoke all on function apply_reward_v1[\s\S]*from public, anon, authenticated;[\s\S]*grant execute on function apply_reward_v1[\s\S]*to service_role;/i.test(sql));
check('apply_purchase_v1 在账号锁内校验价格、余额与幂等请求', /create or replace function apply_purchase_v1[\s\S]*v_expected_price[\s\S]*p_price\s*<>\s*v_expected_price[\s\S]*pg_advisory_xact_lock[\s\S]*economy_ledger where uid = p_uid and kind = 'purchase' and ref_id = p_request_id[\s\S]*v_coins\s*<\s*p_price/i.test(sql));
check('购买 RPC 原子更新档案与经济流水', /create or replace function apply_purchase_v1[\s\S]*update profiles set[\s\S]*insert into economy_ledger[\s\S]*return jsonb_build_object\('applied', true/i.test(sql));
check('购买 requestId 列表最多保留 100 条', /jsonb_array_length\(v_requests\)\s*>\s*100[\s\S]*jsonb_array_length\(v_requests\)\s*-\s*100/i.test(sql));
check('购买 RPC 只授权 service_role', /revoke all on function apply_purchase_v1[\s\S]*from public, anon, authenticated;[\s\S]*grant execute on function apply_purchase_v1[\s\S]*to service_role;/i.test(sql));
check('AI 学习表按玩家/游戏建模且经验不保存原始局面', /create table if not exists ai_learning_models[\s\S]*primary key\s*\(uid, game\)[\s\S]*create table if not exists ai_learning_experiences[\s\S]*state_hash text[\s\S]*unique\s*\(uid, result_id, decision_index\)/i.test(sql) &&
  !/ai_learning_experiences[\s\S]{0,1600}\braw_state\b/i.test(sql));
check('apply_ai_learning_v1 使用账号游戏锁、resultId 幂等与修订冲突保护', /create or replace function apply_ai_learning_v1[\s\S]*pg_advisory_xact_lock[\s\S]*ai_learning_experiences where uid = v_uid and result_id = p_result_id[\s\S]*v_revision <= v_current_revision[\s\S]*stale_ai_learning_revision/i.test(sql));
check('AI 学习经验与模型在同一 RPC 原子提交', /create or replace function apply_ai_learning_v1[\s\S]*insert into ai_learning_experiences[\s\S]*insert into ai_learning_models[\s\S]*return jsonb_build_object\('applied', true/i.test(sql));
check('AI 学习 RPC 只授权 service_role', /revoke all on function apply_ai_learning_v1[\s\S]*from public, anon, authenticated;[\s\S]*grant execute on function apply_ai_learning_v1[\s\S]*to service_role;/i.test(sql));

if (failures.length){
  console.error('SUPABASE_SCHEMA_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('SUPABASE_SCHEMA_ALL_PASS');
}
