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
  owned jsonb not null default '{"avatars":[],"frames":[],"effects":[],"backgrounds":[],"game_cosmetics":[]}'::jsonb,
  game_cosmetics jsonb not null default '{}'::jsonb,
  pin_hash TEXT,
  username text,
  username_key text,
  password_hash text,
  auth_version text,
  companion_checkin_day text not null default '',
  lang VARCHAR(10) DEFAULT 'zh-CN',
  xp integer not null default 0,
  level integer not null default 1,
  streak integer not null default 0,
  best_streak integer not null default 0,
  wins jsonb not null default '{}'::jsonb,
  total_wins integer not null default 0,
  name_fx integer not null default 0,
  signature text not null default '',
  country_region varchar(2) not null default '',
  gender_tag varchar(24) not null default 'hidden',
  presence_preference varchar(16) not null default 'joinable',
  presence_visibility varchar(16) not null default 'everyone',
  showcase jsonb,
  achievements jsonb not null default '[]'::jsonb,
  playmates jsonb not null default '{}'::jsonb,
  daily jsonb not null default '{"play":0,"win":0,"streak":0}'::jsonb,
  daily_key text not null default '',
  daily_task_key text not null default '',
  daily_tasks jsonb not null default '{"play":0,"win":0,"streak":0,"claimed":[],"claimIds":{}}'::jsonb,
  auth_tokens jsonb not null default '[]'::jsonb,
  recent_results jsonb not null default '[]'::jsonb,
  purchase_requests jsonb not null default '[]'::jsonb,
  solo_rate jsonb not null default '[]'::jsonb,
  daily_first_win_date text not null default '',
  daily_ai_currency_key text not null default '',
  daily_ai_currency_earned integer not null default 0,
  xp_curve_version integer not null default 1,
  coins integer not null default 0,
  played jsonb not null default '{}'::jsonb,
  total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_profiles_pin on profiles (pin_hash) where pin_hash is not null;
create unique index if not exists idx_profiles_username_key on profiles (username_key) where username_key is not null;

-- 对局历史表（每位参与者每局一条结算记录；单机每局一条，方便审计/统计）
create table if not exists history (
  id bigserial primary key,
  uid text not null references profiles(uid) on delete cascade,
  game text not null,
  coins integer not null default 0,
  xp integer not null default 0,
  result_id text,
  match_id text,
  mode text not null default 'online',
  result text,
  placement integer,
  eligible boolean not null default true,
  blocked_reason text,
  created_at timestamptz not null default now()
);

-- 独立奖励流水：保存完整 Reward Breakdown、防刷信息与成长前后状态。
create table if not exists reward_history (
  id bigserial primary key,
  uid text not null references profiles(uid) on delete cascade,
  game text not null,
  mode text not null,
  result_id text not null,
  match_id text,
  result text not null,
  placement integer,
  opponent_ids jsonb not null default '[]'::jsonb,
  opponent_key text not null default '',
  duration_ms bigint not null default 0,
  meaningful_actions integer not null default 0,
  eligible boolean not null default true,
  blocked_reason text,
  base_currency integer not null default 0,
  base_xp integer not null default 0,
  reward_currency integer not null default 0,
  reward_xp integer not null default 0,
  reward_reason jsonb not null default '[]'::jsonb,
  level_before integer not null default 1,
  level_after integer not null default 1,
  streak_before integer not null default 0,
  streak_after integer not null default 0,
  breakdown jsonb not null default '[]'::jsonb,
  config_version text not null default '1.0',
  created_at timestamptz not null default now()
);

-- 所有正式 💵 增减（奖励、升级里程碑、购买）均写入统一经济流水。
create table if not exists economy_ledger (
  id bigserial primary key,
  uid text not null references profiles(uid) on delete cascade,
  kind text not null,
  amount integer not null,
  balance_after integer not null,
  ref_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_economy_ledger_purchase_ref
  on economy_ledger (uid, ref_id)
  where kind = 'purchase' and ref_id is not null;

-- 轻量运营埋点；服务端独占写入，不向浏览器开放。
create table if not exists analytics_events (
  id bigserial primary key,
  event text not null,
  uid text references profiles(uid) on delete set null,
  match_id text,
  game text,
  mode text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 正式社交图谱：关系和审核入口由服务端维护，浏览器只通过 WebSocket 读取脱敏结果。
create table if not exists friend_requests (
  id text primary key,
  from_uid text not null references profiles(uid) on delete cascade,
  to_uid text not null references profiles(uid) on delete cascade,
  status text not null check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_uid <> to_uid)
);
create unique index if not exists idx_friend_requests_pending_pair
  on friend_requests (from_uid, to_uid) where status = 'pending';

create table if not exists friendships (
  id text primary key,
  a_uid text not null references profiles(uid) on delete cascade,
  b_uid text not null references profiles(uid) on delete cascade,
  created_at timestamptz not null default now(),
  check (a_uid < b_uid)
);
create unique index if not exists idx_friendships_pair on friendships (a_uid, b_uid);

create table if not exists blocks (
  id text primary key,
  blocker_uid text not null references profiles(uid) on delete cascade,
  blocked_uid text not null references profiles(uid) on delete cascade,
  target_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (blocker_uid <> blocked_uid)
);
create unique index if not exists idx_blocks_pair on blocks (blocker_uid, blocked_uid);

create table if not exists reports (
  id text primary key,
  reporter_uid text not null references profiles(uid) on delete cascade,
  target_uid text not null references profiles(uid) on delete cascade,
  reason text not null check (reason in ('harassment','inappropriate_name','cheating','spam','other')),
  context_type text not null default 'profile',
  context_id text not null default '',
  match_id text not null default '',
  recent_event_ids jsonb not null default '[]'::jsonb,
  target_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  check (reporter_uid <> target_uid)
);
create index if not exists idx_reports_target_created on reports (target_uid, created_at desc);

-- 个性化 AI 持续学习模型：每位玩家、每款游戏独立，避免一个客户端污染全局 AI。
-- weights/stats/mistakes 使用 JSONB，允许在不改表结构的前提下增加游戏特征、技能版本和训练统计。
create table if not exists ai_learning_models (
  uid text not null references profiles(uid) on delete cascade,
  game text not null check (game in ('gomoku','ludo','monopoly','tank','tetris','xiangqi')),
  model_version text not null,
  skill_version text not null,
  revision bigint not null default 0,
  weights jsonb not null default '{}'::jsonb,
  trust double precision not null default 0.28 check (trust between 0.05 and 0.65),
  learning_rate double precision not null default 0.08 check (learning_rate between 0.01 and 0.15),
  mistakes jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (uid, game)
);

-- 只保存局面哈希、归一化候选特征和赛果，不保存玩家的原始完整局面或对话文本。
create table if not exists ai_learning_experiences (
  id bigserial primary key,
  uid text not null references profiles(uid) on delete cascade,
  game text not null check (game in ('gomoku','ludo','monopoly','tank','tetris','xiangqi')),
  result_id text not null,
  match_id text,
  decision_index integer not null check (decision_index >= 0 and decision_index < 300),
  state_hash text not null check (state_hash ~ '^[a-f0-9]{32}$'),
  choice text not null,
  local_best text,
  option_rank integer not null default 0,
  candidate_count integer not null default 1,
  features jsonb not null default '{}'::jsonb,
  ai_outcome smallint not null check (ai_outcome between -1 and 1),
  human_result text not null check (human_result in ('win','draw','loss')),
  used_for_training boolean not null default false,
  model_version text not null,
  skill_version text not null,
  created_at timestamptz not null default now(),
  unique (uid, result_id, decision_index)
);

-- 旧环境迁移：CREATE TABLE IF NOT EXISTS 不会自动补列，以下语句可重复执行。
alter table profiles add column if not exists background integer not null default 0;
alter table profiles add column if not exists frame integer not null default 0;
alter table profiles add column if not exists effect integer not null default 0;
alter table profiles add column if not exists owned jsonb not null default '{"avatars":[],"frames":[],"effects":[],"backgrounds":[],"game_cosmetics":[]}'::jsonb;
alter table profiles add column if not exists game_cosmetics jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists pin_hash text;
alter table profiles add column if not exists username text;
alter table profiles add column if not exists username_key text;
alter table profiles add column if not exists password_hash text;
alter table profiles add column if not exists auth_version text;
alter table profiles add column if not exists companion_checkin_day text not null default '';
create unique index if not exists idx_profiles_username_key on profiles (username_key) where username_key is not null;
alter table profiles add column if not exists lang varchar(10) default 'zh-CN';
alter table profiles add column if not exists xp integer not null default 0;
alter table profiles add column if not exists level integer not null default 1;
alter table profiles add column if not exists streak integer not null default 0;
alter table profiles add column if not exists best_streak integer not null default 0;
alter table profiles add column if not exists wins jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists total_wins integer not null default 0;
alter table profiles add column if not exists name_fx integer not null default 0;
alter table profiles add column if not exists signature text not null default '';
alter table profiles add column if not exists country_region varchar(2) not null default '';
alter table profiles add column if not exists gender_tag varchar(24) not null default 'hidden';
alter table profiles add column if not exists presence_preference varchar(16) not null default 'joinable';
alter table profiles add column if not exists presence_visibility varchar(16) not null default 'everyone';
alter table profiles add column if not exists showcase jsonb;
alter table profiles add column if not exists achievements jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists playmates jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists daily jsonb not null default '{"play":0,"win":0,"streak":0}'::jsonb;
alter table profiles add column if not exists daily_key text not null default '';
alter table profiles add column if not exists daily_task_key text not null default '';
alter table profiles add column if not exists daily_tasks jsonb not null default '{"play":0,"win":0,"streak":0,"claimed":[],"claimIds":{}}'::jsonb;
alter table profiles add column if not exists auth_tokens jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists recent_results jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists purchase_requests jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists solo_rate jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists daily_first_win_date text not null default '';
alter table profiles add column if not exists daily_ai_currency_key text not null default '';
alter table profiles add column if not exists daily_ai_currency_earned integer not null default 0;
alter table profiles add column if not exists xp_curve_version integer not null default 1;
alter table history add column if not exists result_id text;
alter table history add column if not exists match_id text;
alter table history add column if not exists mode text not null default 'online';
alter table history add column if not exists xp integer not null default 0;
alter table history add column if not exists result text;
alter table history add column if not exists placement integer;
alter table history add column if not exists eligible boolean not null default true;
alter table history add column if not exists blocked_reason text;
alter table reward_history add column if not exists config_version text not null default '1.0';

-- 旧账号无论此前是否被错误标成 curveVersion=1，都按既有 level 补足最低累计 XP，绝不降级。
with level_floor as (
  select uid,
    greatest(level - 1, 0)::integer as steps,
    least(greatest(level - 1, 0), 33)::integer as uncapped_steps
  from profiles
)
update profiles p set
  xp = greatest(
    p.xp,
    (30 * f.uncapped_steps + 5 * f.uncapped_steps * (f.uncapped_steps + 1) / 2 +
      200 * greatest(f.steps - f.uncapped_steps, 0))::integer
  ),
  xp_curve_version = 1
from level_floor f
where p.uid = f.uid;

-- 仅为空的旧账号回填独立胜场；旧 history 中 coins>0 代表历史版本的胜者标记。
with wins_by_game as (
  select uid, game, count(*)::integer as wins
  from history
  where eligible is not false and (result = 'win' or (result is null and coins > 0))
  group by uid, game
), wins_by_user as (
  select uid, jsonb_object_agg(game, wins) as wins, sum(wins)::integer as total_wins
  from wins_by_game
  group by uid
)
update profiles p set wins = w.wins, total_wins = w.total_wins
from wins_by_user w
where p.uid = w.uid and p.wins = '{}'::jsonb and p.total_wins = 0;

create index if not exists idx_profiles_coins on profiles (coins desc);
create index if not exists idx_history_uid on history (uid);
create index if not exists idx_history_created on history (created_at desc);
create unique index if not exists idx_history_result on history (result_id) where result_id is not null;
create index if not exists idx_reward_history_uid_created on reward_history (uid, created_at desc);
create index if not exists idx_reward_history_opponents on reward_history (uid, opponent_key, created_at desc);
create index if not exists idx_reward_history_created on reward_history (created_at asc);
create unique index if not exists idx_reward_history_result on reward_history (result_id);
create index if not exists idx_economy_ledger_uid_created on economy_ledger (uid, created_at desc);
create unique index if not exists idx_economy_ledger_ref on economy_ledger (uid, kind, ref_id) where ref_id is not null;
create index if not exists idx_analytics_events_event_created on analytics_events (event, created_at desc);
create index if not exists idx_ai_learning_experiences_uid_game_created
  on ai_learning_experiences (uid, game, created_at desc);
create index if not exists idx_ai_learning_experiences_state
  on ai_learning_experiences (uid, game, state_hash, created_at desc);

-- 正式奖励以单个事务落库：锁定账号、检查 result_id 幂等、更新档案并同时写入三类流水。
create or replace function apply_reward_v1(
  p_profile jsonb,
  p_history jsonb,
  p_reward jsonb,
  p_ledger jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := p_reward->>'uid';
  v_result_id text := p_reward->>'result_id';
  v_reward_currency integer := coalesce((p_reward->>'reward_currency')::integer, 0);
  v_reward_xp integer := coalesce((p_reward->>'reward_xp')::integer, 0);
begin
  if v_uid is null or v_uid = '' or v_result_id is null or v_result_id = '' then
    raise exception 'invalid_reward_identity';
  end if;
  if coalesce(p_profile->>'uid', '') <> v_uid or coalesce(p_history->>'uid', '') <> v_uid then
    raise exception 'reward_uid_mismatch';
  end if;
  if coalesce(p_history->>'result_id', '') <> v_result_id or
      coalesce(p_history->>'game', '') <> coalesce(p_reward->>'game', '') or
      coalesce(p_history->>'mode', '') <> coalesce(p_reward->>'mode', '') or
      coalesce(p_history->>'match_id', '') <> coalesce(p_reward->>'match_id', '') or
      coalesce(p_history->>'result', '') <> coalesce(p_reward->>'result', '') then
    raise exception 'reward_history_contract_mismatch';
  end if;
  if coalesce((p_history->>'coins')::integer, 0) <> v_reward_currency or
      coalesce((p_history->>'xp')::integer, 0) <> v_reward_xp or
      coalesce((p_history->>'eligible')::boolean, true) <> coalesce((p_reward->>'eligible')::boolean, true) then
    raise exception 'reward_amount_contract_mismatch';
  end if;
  if v_reward_currency <> 0 and p_ledger is null then
    raise exception 'reward_ledger_missing';
  end if;
  if p_ledger is not null and (
      coalesce(p_ledger->>'uid', '') <> v_uid or
      coalesce(p_ledger->>'ref_id', '') <> v_result_id or
      coalesce((p_ledger->>'amount')::integer, 0) <> v_reward_currency or
      coalesce((p_ledger->>'balance_after')::integer, 0) <> coalesce((p_profile->>'coins')::integer, 0)
    ) then
    raise exception 'reward_ledger_contract_mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid));
  if exists (select 1 from reward_history where result_id = v_result_id) then
    return jsonb_build_object('applied', false, 'duplicate', true, 'resultId', v_result_id);
  end if;

  update profiles set
    name = coalesce(p_profile->>'name', name),
    avatar = coalesce((p_profile->>'avatar')::integer, avatar),
    background = coalesce((p_profile->>'background')::integer, background),
    frame = coalesce((p_profile->>'frame')::integer, frame),
    effect = coalesce((p_profile->>'effect')::integer, effect),
    owned = coalesce(p_profile->'owned', owned),
    game_cosmetics = coalesce(p_profile->'game_cosmetics', game_cosmetics),
    pin_hash = coalesce(p_profile->>'pin_hash', pin_hash),
    lang = coalesce(p_profile->>'lang', lang),
    xp = coalesce((p_profile->>'xp')::integer, xp),
    level = coalesce((p_profile->>'level')::integer, level),
    streak = coalesce((p_profile->>'streak')::integer, streak),
    best_streak = coalesce((p_profile->>'best_streak')::integer, best_streak),
    wins = coalesce(p_profile->'wins', wins),
    total_wins = coalesce((p_profile->>'total_wins')::integer, total_wins),
    name_fx = coalesce((p_profile->>'name_fx')::integer, name_fx),
    achievements = coalesce(p_profile->'achievements', achievements),
    playmates = coalesce(p_profile->'playmates', playmates),
    daily = coalesce(p_profile->'daily', daily),
    daily_key = coalesce(p_profile->>'daily_key', daily_key),
    daily_task_key = coalesce(p_profile->>'daily_task_key', daily_task_key),
    daily_tasks = coalesce(p_profile->'daily_tasks', daily_tasks),
    auth_tokens = coalesce(p_profile->'auth_tokens', auth_tokens),
    recent_results = coalesce(p_profile->'recent_results', recent_results),
    purchase_requests = coalesce(p_profile->'purchase_requests', purchase_requests),
    solo_rate = coalesce(p_profile->'solo_rate', solo_rate),
    daily_first_win_date = coalesce(p_profile->>'daily_first_win_date', daily_first_win_date),
    daily_ai_currency_key = coalesce(p_profile->>'daily_ai_currency_key', daily_ai_currency_key),
    daily_ai_currency_earned = coalesce((p_profile->>'daily_ai_currency_earned')::integer, daily_ai_currency_earned),
    xp_curve_version = coalesce((p_profile->>'xp_curve_version')::integer, xp_curve_version),
    coins = coalesce((p_profile->>'coins')::integer, coins),
    played = coalesce(p_profile->'played', played),
    total = coalesce((p_profile->>'total')::integer, total),
    updated_at = coalesce((p_profile->>'updated_at')::timestamptz, now())
  where uid = v_uid;
  if not found then raise exception 'reward_profile_missing'; end if;

  insert into history (uid, game, coins, xp, result_id, match_id, mode, result, placement, eligible, blocked_reason, created_at)
  values (
    v_uid, p_history->>'game', coalesce((p_history->>'coins')::integer, 0), coalesce((p_history->>'xp')::integer, 0),
    p_history->>'result_id', p_history->>'match_id', coalesce(p_history->>'mode', 'online'), p_history->>'result',
    (p_history->>'placement')::integer, coalesce((p_history->>'eligible')::boolean, true), p_history->>'blocked_reason',
    coalesce((p_history->>'created_at')::timestamptz, now())
  );

  insert into reward_history (
    uid, game, mode, result_id, match_id, result, placement, opponent_ids, opponent_key,
    duration_ms, meaningful_actions, eligible, blocked_reason, base_currency, base_xp,
    reward_currency, reward_xp, reward_reason, level_before, level_after, streak_before,
    streak_after, breakdown, config_version, created_at
  ) values (
    v_uid, p_reward->>'game', p_reward->>'mode', v_result_id, p_reward->>'match_id', p_reward->>'result',
    (p_reward->>'placement')::integer, coalesce(p_reward->'opponent_ids', '[]'::jsonb), coalesce(p_reward->>'opponent_key', ''),
    coalesce((p_reward->>'duration_ms')::bigint, 0), coalesce((p_reward->>'meaningful_actions')::integer, 0),
    coalesce((p_reward->>'eligible')::boolean, true), p_reward->>'blocked_reason',
    coalesce((p_reward->>'base_currency')::integer, 0), coalesce((p_reward->>'base_xp')::integer, 0),
    coalesce((p_reward->>'reward_currency')::integer, 0), coalesce((p_reward->>'reward_xp')::integer, 0),
    coalesce(p_reward->'reward_reason', '[]'::jsonb), coalesce((p_reward->>'level_before')::integer, 1),
    coalesce((p_reward->>'level_after')::integer, 1), coalesce((p_reward->>'streak_before')::integer, 0),
    coalesce((p_reward->>'streak_after')::integer, 0), coalesce(p_reward->'breakdown', '[]'::jsonb),
    coalesce(p_reward->>'config_version', '1.0'), coalesce((p_reward->>'created_at')::timestamptz, now())
  );

  if p_ledger is not null and coalesce((p_ledger->>'amount')::integer, 0) <> 0 then
    insert into economy_ledger (uid, kind, amount, balance_after, ref_id, metadata, created_at)
    values (
      v_uid, p_ledger->>'kind', (p_ledger->>'amount')::integer,
      coalesce((p_ledger->>'balance_after')::integer, 0), p_ledger->>'ref_id',
      coalesce(p_ledger->'metadata', '{}'::jsonb), coalesce((p_ledger->>'created_at')::timestamptz, now())
    );
  end if;

  return jsonb_build_object('applied', true, 'duplicate', false, 'resultId', v_result_id);
end;
$$;

revoke all on function apply_reward_v1(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function apply_reward_v1(jsonb, jsonb, jsonb, jsonb) to service_role;

-- 商城购买在数据库内重新检查余额/已拥有/requestId，并与经济流水同事务提交。
create or replace function apply_purchase_v1(
  p_uid text,
  p_category text,
  p_item_id integer,
  p_price integer,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins integer;
  v_owned jsonb;
  v_requests jsonb;
  v_expected_price integer;
begin
  v_expected_price := case p_category
    when 'avatars' then case p_item_id
      when 30 then 10 when 31 then 12 when 32 then 12 when 33 then 15 when 34 then 18 when 35 then 18
      when 36 then 10 when 37 then 10 when 38 then 12 when 39 then 12 when 40 then 15 when 41 then 18
      when 42 then 12 when 43 then 12 when 44 then 15 when 45 then 15 when 46 then 18 when 47 then 18
      when 48 then 12 when 49 then 15 when 50 then 15 when 51 then 18 when 52 then 22 when 53 then 22
      when 54 then 12 when 55 then 30 else null end
    when 'frames' then case p_item_id
      when 1 then 10 when 2 then 12 when 3 then 16 when 4 then 20 when 5 then 24 when 6 then 28
      when 7 then 32 when 8 then 36 else null end
    when 'effects' then case p_item_id
      when 1 then 10 when 2 then 12 when 3 then 12 when 4 then 20 else null end
    when 'backgrounds' then case p_item_id
      when 1 then 10 when 2 then 10 when 3 then 10 when 4 then 12 when 5 then 12 when 6 then 15
      when 7 then 18 when 8 then 18 when 9 then 22 when 10 then 20 else null end
    when 'game_cosmetics' then case p_item_id
      when 2001 then 8 when 2011 then 10 when 2012 then 10 when 2013 then 10 when 2021 then 12
      when 2031 then 14 when 2041 then 12 when 2042 then 12 when 2051 then 12 else null end
    else null
  end;
  if coalesce(p_uid, '') = '' or v_expected_price is null or p_price <> v_expected_price or
      coalesce(p_request_id, '') !~ '^[A-Za-z][A-Za-z0-9_-]{7,120}$' then
    raise exception 'invalid_purchase_request';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_uid));
  select coins, owned, purchase_requests into v_coins, v_owned, v_requests
  from profiles where uid = p_uid for update;
  if not found then raise exception 'purchase_profile_missing'; end if;
  v_owned := case when jsonb_typeof(v_owned) = 'object' then v_owned
    else '{"avatars":[],"frames":[],"effects":[],"backgrounds":[],"game_cosmetics":[]}'::jsonb end;
  v_requests := case when jsonb_typeof(v_requests) = 'array' then v_requests else '[]'::jsonb end;

  if exists (select 1 from jsonb_array_elements_text(v_requests) value where value = p_request_id) or
      exists (select 1 from economy_ledger where uid = p_uid and kind = 'purchase' and ref_id = p_request_id) then
    return jsonb_build_object('applied', false, 'duplicate', true, 'resultId', p_request_id,
      'coins', v_coins, 'owned', v_owned, 'purchaseRequests', v_requests);
  end if;
  if jsonb_typeof(v_owned->p_category) = 'array' and
      exists (select 1 from jsonb_array_elements_text(v_owned->p_category) value where value::integer = p_item_id) then
    v_requests := v_requests || jsonb_build_array(p_request_id);
    if jsonb_array_length(v_requests) > 100 then
      select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb) into v_requests
      from jsonb_array_elements(v_requests) with ordinality as recent(value, ordinality)
      where ordinality > jsonb_array_length(v_requests) - 100;
    end if;
    update profiles set purchase_requests = v_requests, updated_at = now()
    where uid = p_uid returning coins, owned, purchase_requests into v_coins, v_owned, v_requests;
    return jsonb_build_object('applied', false, 'duplicate', false, 'alreadyOwned', true, 'resultId', p_request_id,
      'coins', v_coins, 'owned', v_owned, 'purchaseRequests', v_requests);
  end if;
  if v_coins < p_price then
    return jsonb_build_object('applied', false, 'duplicate', false, 'insufficient', true, 'resultId', p_request_id,
      'coins', v_coins, 'owned', v_owned, 'purchaseRequests', v_requests);
  end if;

  v_requests := v_requests || jsonb_build_array(p_request_id);
  if jsonb_array_length(v_requests) > 100 then
    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb) into v_requests
    from jsonb_array_elements(v_requests) with ordinality as recent(value, ordinality)
    where ordinality > jsonb_array_length(v_requests) - 100;
  end if;

  update profiles set
    coins = coins - p_price,
    owned = jsonb_set(v_owned, array[p_category],
      (case when jsonb_typeof(v_owned->p_category) = 'array' then v_owned->p_category else '[]'::jsonb end) || jsonb_build_array(p_item_id), true),
    purchase_requests = v_requests,
    updated_at = now()
  where uid = p_uid
  returning coins, owned, purchase_requests into v_coins, v_owned, v_requests;

  insert into economy_ledger (uid, kind, amount, balance_after, ref_id, metadata, created_at)
  values (p_uid, 'purchase', -p_price, v_coins, p_request_id,
    jsonb_build_object('category', p_category, 'itemId', p_item_id, 'price', p_price), now());

  return jsonb_build_object('applied', true, 'duplicate', false, 'resultId', p_request_id,
    'coins', v_coins, 'owned', v_owned, 'purchaseRequests', v_requests);
end;
$$;

revoke all on function apply_purchase_v1(text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function apply_purchase_v1(text, text, integer, integer, text) to service_role;

-- 将一局经服务端票据验证的 AI 经验与新模型版本原子提交；result_id 重放不会二次训练。
create or replace function apply_ai_learning_v1(
  p_model jsonb,
  p_result_id text,
  p_experiences jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := p_model->>'uid';
  v_game text := p_model->>'game';
  v_revision bigint := coalesce((p_model->>'revision')::bigint, 0);
  v_current_revision bigint;
  v_count integer;
begin
  if coalesce(v_uid, '') = '' or v_game not in ('gomoku','ludo','monopoly','tank','tetris','xiangqi') or
      coalesce(p_result_id, '') = '' or v_revision <= 0 or
      coalesce(p_model->>'model_version', '') = '' or coalesce(p_model->>'skill_version', '') = '' then
    raise exception 'invalid_ai_learning_payload';
  end if;
  if jsonb_typeof(coalesce(p_model->'weights', '{}'::jsonb)) <> 'object' or
      jsonb_typeof(coalesce(p_model->'mistakes', '[]'::jsonb)) <> 'array' or
      jsonb_typeof(coalesce(p_model->'stats', '{}'::jsonb)) <> 'object' or
      jsonb_typeof(coalesce(p_experiences, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_ai_learning_payload';
  end if;
  if jsonb_array_length(p_experiences) < 1 or jsonb_array_length(p_experiences) > 300 or
      jsonb_array_length(coalesce(p_model->'mistakes', '[]'::jsonb)) > 80 then
    raise exception 'invalid_ai_learning_payload';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_experiences) item
    where item->>'uid' <> v_uid or item->>'game' <> v_game or item->>'result_id' <> p_result_id or
      coalesce(item->>'state_hash', '') !~ '^[a-f0-9]{32}$' or
      coalesce(item->>'choice', '') = '' or
      coalesce(item->>'human_result', '') not in ('win','draw','loss') or
      coalesce((item->>'ai_outcome')::integer, 9) not between -1 and 1 or
      coalesce((item->>'decision_index')::integer, -1) not between 0 and 299 or
      jsonb_typeof(coalesce(item->'features', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'ai_learning_contract_mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai-learning:' || v_uid || ':' || v_game));
  if exists (select 1 from ai_learning_experiences where uid = v_uid and result_id = p_result_id) then
    select revision into v_current_revision from ai_learning_models where uid = v_uid and game = v_game;
    return jsonb_build_object('applied', false, 'duplicate', true, 'resultId', p_result_id,
      'revision', coalesce(v_current_revision, v_revision));
  end if;

  select revision into v_current_revision from ai_learning_models where uid = v_uid and game = v_game for update;
  if found and v_revision <= v_current_revision then
    raise exception 'stale_ai_learning_revision';
  end if;

  insert into ai_learning_experiences (
    uid, game, result_id, match_id, decision_index, state_hash, choice, local_best,
    option_rank, candidate_count, features, ai_outcome, human_result, used_for_training,
    model_version, skill_version, created_at
  )
  select
    item->>'uid', item->>'game', item->>'result_id', nullif(item->>'match_id', ''),
    (item->>'decision_index')::integer, item->>'state_hash', left(item->>'choice', 240),
    nullif(left(coalesce(item->>'local_best', ''), 240), ''),
    greatest(0, coalesce((item->>'option_rank')::integer, 0)),
    greatest(1, coalesce((item->>'candidate_count')::integer, 1)),
    coalesce(item->'features', '{}'::jsonb), (item->>'ai_outcome')::smallint,
    item->>'human_result', coalesce((item->>'used_for_training')::boolean, false),
    coalesce(item->>'model_version', p_model->>'model_version'),
    coalesce(item->>'skill_version', p_model->>'skill_version'),
    coalesce((item->>'created_at')::timestamptz, now())
  from jsonb_array_elements(p_experiences) item;
  get diagnostics v_count = row_count;

  insert into ai_learning_models (
    uid, game, model_version, skill_version, revision, weights, trust,
    learning_rate, mistakes, stats, updated_at
  ) values (
    v_uid, v_game, p_model->>'model_version', p_model->>'skill_version', v_revision,
    coalesce(p_model->'weights', '{}'::jsonb), (p_model->>'trust')::double precision,
    (p_model->>'learning_rate')::double precision, coalesce(p_model->'mistakes', '[]'::jsonb),
    coalesce(p_model->'stats', '{}'::jsonb), coalesce((p_model->>'updated_at')::timestamptz, now())
  )
  on conflict (uid, game) do update set
    model_version = excluded.model_version,
    skill_version = excluded.skill_version,
    revision = excluded.revision,
    weights = excluded.weights,
    trust = excluded.trust,
    learning_rate = excluded.learning_rate,
    mistakes = excluded.mistakes,
    stats = excluded.stats,
    updated_at = excluded.updated_at;

  return jsonb_build_object('applied', true, 'duplicate', false, 'resultId', p_result_id,
    'revision', v_revision, 'experiences', v_count);
end;
$$;

revoke all on function apply_ai_learning_v1(jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function apply_ai_learning_v1(jsonb, text, jsonb) to service_role;

-- 服务端是唯一数据库访问方。启用 RLS 且不创建 anon/authenticated policy，
-- 浏览器端即使拿到公开项目地址也不能读取账号、令牌哈希或结算数据。
-- Node 服务必须使用仅保存在 Render 的 service_role secret；service_role 会绕过 RLS。
alter table profiles enable row level security;
alter table history enable row level security;
alter table reward_history enable row level security;
alter table economy_ledger enable row level security;
alter table analytics_events enable row level security;
alter table ai_learning_models enable row level security;
alter table ai_learning_experiences enable row level security;
alter table friend_requests enable row level security;
alter table friendships enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;
revoke all on table profiles from anon, authenticated;
revoke all on table history from anon, authenticated;
revoke all on table reward_history from anon, authenticated;
revoke all on table economy_ledger from anon, authenticated;
revoke all on table analytics_events from anon, authenticated;
revoke all on table ai_learning_models from anon, authenticated;
revoke all on table ai_learning_experiences from anon, authenticated;
revoke all on table friend_requests from public, anon, authenticated;
revoke all on table friendships from public, anon, authenticated;
revoke all on table blocks from public, anon, authenticated;
revoke all on table reports from public, anon, authenticated;
revoke all on sequence history_id_seq from anon, authenticated;
revoke all on sequence reward_history_id_seq from anon, authenticated;
revoke all on sequence economy_ledger_id_seq from anon, authenticated;
revoke all on sequence analytics_events_id_seq from anon, authenticated;
revoke all on sequence ai_learning_experiences_id_seq from anon, authenticated;

-- 常用管理查询（供日后在 Dashboard 使用）
-- 1) 全球总榜：select name, coins, total, played from profiles order by coins desc;
-- 2) 单游戏局数榜：select name, played->>'gomoku' as gomoku_games from profiles order by (played->>'gomoku')::int desc;
-- 3) 最近结算（同一联机 match 会按参与者出现多行）：select p.name, h.game, h.coins, h.xp, h.match_id, h.created_at from history h join profiles p on p.uid = h.uid order by h.created_at desc limit 50;
-- 4) 奖励审计：select uid, game, mode, result, reward_currency, reward_xp, eligible, blocked_reason from reward_history order by created_at desc limit 100;
-- 5) 经济收支：select kind, sum(amount) from economy_ledger group by kind order by kind;

-- 迁移说明：本文件包含可重复执行的 ADD COLUMN IF NOT EXISTS；Render 环境变量配置后，
-- 在 Supabase SQL Editor 执行一次，再用 service_role secret 运行 node scripts/supabase-status.js 验证字段。
