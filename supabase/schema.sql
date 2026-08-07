-- 小游戏合集 · Supabase 数据库初始化脚本
-- 在 Supabase 控制台 → SQL Editor 里粘贴执行一次即可

-- 玩家档案表（所有注册玩家；uid 可由客户端提出但由服务端校验/冲突回退）
create table if not exists profiles (
  uid text primary key,
  name text not null,
  avatar integer not null default 0,
  background integer not null default 0,
  frame integer not null default 0,
  effect integer not null default 0,
  owned jsonb not null default '{"avatars":[],"frames":[],"effects":[],"backgrounds":[]}'::jsonb,
  pin_hash TEXT,
  lang VARCHAR(10) DEFAULT 'zh-CN',
  xp integer not null default 0,
  level integer not null default 1,
  streak integer not null default 0,
  best_streak integer not null default 0,
  name_fx integer not null default 0,
  achievements jsonb not null default '[]'::jsonb,
  playmates jsonb not null default '{}'::jsonb,
  daily jsonb not null default '{"play":0,"win":0,"streak":0}'::jsonb,
  daily_key text not null default '',
  auth_tokens jsonb not null default '[]'::jsonb,
  recent_results jsonb not null default '[]'::jsonb,
  purchase_requests jsonb not null default '[]'::jsonb,
  solo_rate jsonb not null default '[]'::jsonb,
  coins integer not null default 0,
  played jsonb not null default '{}'::jsonb,
  total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_profiles_pin on profiles (pin_hash) where pin_hash is not null;

-- 对局历史表（每位参与者每局一条结算记录；单机每局一条，方便审计/统计）
create table if not exists history (
  id bigserial primary key,
  uid text not null references profiles(uid) on delete cascade,
  game text not null,
  coins integer not null default 0,
  result_id text,
  match_id text,
  mode text not null default 'online',
  created_at timestamptz not null default now()
);

-- 旧环境迁移：CREATE TABLE IF NOT EXISTS 不会自动补列，以下语句可重复执行。
alter table profiles add column if not exists background integer not null default 0;
alter table profiles add column if not exists frame integer not null default 0;
alter table profiles add column if not exists effect integer not null default 0;
alter table profiles add column if not exists owned jsonb not null default '{"avatars":[],"frames":[],"effects":[],"backgrounds":[]}'::jsonb;
alter table profiles add column if not exists pin_hash text;
alter table profiles add column if not exists lang varchar(10) default 'zh-CN';
alter table profiles add column if not exists xp integer not null default 0;
alter table profiles add column if not exists level integer not null default 1;
alter table profiles add column if not exists streak integer not null default 0;
alter table profiles add column if not exists best_streak integer not null default 0;
alter table profiles add column if not exists name_fx integer not null default 0;
alter table profiles add column if not exists achievements jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists playmates jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists daily jsonb not null default '{"play":0,"win":0,"streak":0}'::jsonb;
alter table profiles add column if not exists daily_key text not null default '';
alter table profiles add column if not exists auth_tokens jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists recent_results jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists purchase_requests jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists solo_rate jsonb not null default '[]'::jsonb;
alter table history add column if not exists result_id text;
alter table history add column if not exists match_id text;
alter table history add column if not exists mode text not null default 'online';

create index if not exists idx_profiles_coins on profiles (coins desc);
create index if not exists idx_history_uid on history (uid);
create index if not exists idx_history_created on history (created_at desc);
create unique index if not exists idx_history_result on history (result_id) where result_id is not null;

-- 服务端是唯一数据库访问方。启用 RLS 且不创建 anon/authenticated policy，
-- 浏览器端即使拿到公开项目地址也不能读取账号、令牌哈希或结算数据。
-- Node 服务必须使用仅保存在 Render 的 service_role secret；service_role 会绕过 RLS。
alter table profiles enable row level security;
alter table history enable row level security;
revoke all on table profiles from anon, authenticated;
revoke all on table history from anon, authenticated;
revoke all on sequence history_id_seq from anon, authenticated;

-- 常用管理查询（供日后在 Dashboard 使用）
-- 1) 全球总榜：select name, coins, total, played from profiles order by coins desc;
-- 2) 单游戏局数榜：select name, played->>'gomoku' as gomoku_games from profiles order by (played->>'gomoku')::int desc;
-- 3) 最近结算（同一联机 match 会按参与者出现多行）：select p.name, h.game, h.coins, h.match_id, h.created_at from history h join profiles p on p.uid = h.uid order by h.created_at desc limit 50;

-- 迁移说明：本文件包含可重复执行的 ADD COLUMN IF NOT EXISTS；Render 环境变量配置后，
-- 在 Supabase SQL Editor 执行一次，再用 service_role secret 运行 node scripts/supabase-status.js 验证字段。
