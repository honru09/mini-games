-- 小游戏合集 · Supabase 数据库初始化脚本
-- 在 Supabase 控制台 → SQL Editor 里粘贴执行一次即可

-- 玩家档案表（所有注册玩家，uid 由前端本地生成，全局唯一）
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
  achievements jsonb not null default '[]'::jsonb,
  playmates jsonb not null default '{}'::jsonb,
  daily jsonb not null default '{"play":0,"win":0,"streak":0}'::jsonb,
  coins integer not null default 0,
  played jsonb not null default '{}'::jsonb,
  total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_profiles_pin on profiles (pin_hash) where pin_hash is not null;

-- 对局历史表（每局一条记录，方便日后审计/统计）
create table if not exists history (
  id bigserial primary key,
  uid text not null references profiles(uid) on delete cascade,
  game text not null,
  coins integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_coins on profiles (coins desc);
create index if not exists idx_history_uid on history (uid);
create index if not exists idx_history_created on history (created_at desc);

-- 常用管理查询（供日后在 Dashboard 使用）
-- 1) 全球总榜：select name, coins, total, played from profiles order by coins desc;
-- 2) 单游戏局数榜：select name, played->>'gomoku' as gomoku_games from profiles order by (played->>'gomoku')::int desc;
-- 3) 最近对局：select p.name, h.game, h.coins, h.created_at from history h join profiles p on p.uid = h.uid order by h.created_at desc limit 50;
