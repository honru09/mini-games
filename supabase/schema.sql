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

-- Playline Community P0：受限动态持久化合同。
-- post id/clientPostId 由 Node 服务签发或规范化；private_source 仅供 service_role
-- 做引用审计，任何列表/报告 projection 都不得返回它。删除保留 tombstone，过期
-- 由读取过滤，便于后续治理与非破坏清理。
create table if not exists playline_posts (
  id text primary key,
  seq bigserial not null unique,
  author_uid text not null references profiles(uid) on delete cascade,
  client_post_id text not null,
  audience text not null check (audience in ('all', 'friends')),
  content_kind text not null check (content_kind in ('text', 'game_share', 'result_share', 'record_share')),
  content_version integer not null default 1 check (content_version between 1 and 32),
  canonical_content jsonb not null,
  private_source jsonb not null default '{}'::jsonb,
  state text not null default 'active' check (state in ('active', 'deleted', 'hidden', 'expired')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '90 days'),
  check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  check (client_post_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  check (jsonb_typeof(canonical_content) = 'object'),
  check (octet_length(canonical_content::text) <= 32768),
  check (octet_length(private_source::text) <= 32768),
  check (deleted_at is null or state in ('deleted', 'hidden', 'expired'))
);
create unique index if not exists idx_playline_posts_author_client_post
  on playline_posts (author_uid, client_post_id);
create index if not exists idx_playline_posts_created_id
  on playline_posts (created_at desc, id desc);
create index if not exists idx_playline_posts_seq
  on playline_posts (seq desc);
create index if not exists idx_playline_posts_audience_created_id
  on playline_posts (audience, created_at desc, id desc);
create index if not exists idx_playline_posts_author_created
  on playline_posts (author_uid, created_at desc, id desc);
create index if not exists idx_playline_posts_state_expiry_created
  on playline_posts (state, expires_at, created_at desc, id desc);

-- 受限频控事件只保存作者、动作和时间；不保存正文、canonical source 或任何
-- 通用 analytics/report payload。过期事件可由 service-role 维护清理。
create table if not exists playline_rate_events (
  id bigserial primary key,
  author_uid text not null references profiles(uid) on delete cascade,
  event_kind text not null check (event_kind in ('publish', 'list', 'delete', 'report')),
  client_post_id text,
  post_id text references playline_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  check (client_post_id is null or client_post_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$')
);
create index if not exists idx_playline_rate_events_author_kind_created
  on playline_rate_events (author_uid, event_kind, created_at desc);
create index if not exists idx_playline_rate_events_post_created
  on playline_rate_events (post_id, created_at desc)
  where post_id is not null;

-- Direct Chat v1：消息正文只允许服务端 service_role 访问；浏览器永不直连。
create table if not exists direct_messages (
  seq bigserial primary key,
  id text not null unique,
  conversation_id text not null,
  a_uid text not null references profiles(uid) on delete cascade,
  b_uid text not null references profiles(uid) on delete cascade,
  sender_uid text not null references profiles(uid) on delete cascade,
  recipient_uid text not null references profiles(uid) on delete cascade,
  client_message_id text not null,
  body text not null,
  created_at timestamptz not null default now(),
  check (a_uid < b_uid),
  check (sender_uid <> recipient_uid),
  check (sender_uid in (a_uid, b_uid) and recipient_uid in (a_uid, b_uid)),
  check (conversation_id = 'dm:' || a_uid || '|' || b_uid),
  check (char_length(body) between 1 and 500),
  check (octet_length(body) <= 2000)
);
create unique index if not exists idx_direct_messages_sender_client
  on direct_messages (sender_uid, client_message_id);
create index if not exists idx_direct_messages_conversation_seq
  on direct_messages (conversation_id, seq desc);
create index if not exists idx_direct_messages_recipient_seq
  on direct_messages (recipient_uid, seq desc);

create table if not exists direct_message_reads (
  conversation_id text not null,
  uid text not null references profiles(uid) on delete cascade,
  peer_uid text not null references profiles(uid) on delete cascade,
  last_read_seq bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, uid),
  check (uid <> peer_uid),
  check (conversation_id = 'dm:' || least(uid, peer_uid) || '|' || greatest(uid, peer_uid)),
  check (last_read_seq >= 0)
);
create index if not exists idx_direct_message_reads_uid_updated
  on direct_message_reads (uid, updated_at desc);

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

create or replace function direct_message_payload_v1(p_row direct_messages) returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', (p_row).id,
    'seq', (p_row).seq::text,
    'conversation_id', (p_row).conversation_id,
    'sender_uid', (p_row).sender_uid,
    'recipient_uid', (p_row).recipient_uid,
    'client_message_id', (p_row).client_message_id,
    'body', (p_row).body,
    'created_at', (p_row).created_at
  );
$$;

revoke all on function direct_message_payload_v1(direct_messages) from public, anon, authenticated;

create or replace function send_direct_message_v1(
  p_id text,
  p_conversation_id text,
  p_a_uid text,
  p_b_uid text,
  p_sender_uid text,
  p_recipient_uid text,
  p_client_message_id text,
  p_body text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing direct_messages%rowtype;
  v_row direct_messages%rowtype;
begin
  select * into v_existing from direct_messages
    where sender_uid = p_sender_uid and client_message_id = p_client_message_id;
  if found then
    return jsonb_build_object(
      'duplicate', true,
      'conflict', v_existing.recipient_uid <> p_recipient_uid or v_existing.body <> p_body,
      'message', direct_message_payload_v1(v_existing)
    );
  end if;

  if p_sender_uid = p_recipient_uid
     or p_a_uid >= p_b_uid
     or p_conversation_id <> 'dm:' || p_a_uid || '|' || p_b_uid
     or not (p_sender_uid in (p_a_uid, p_b_uid) and p_recipient_uid in (p_a_uid, p_b_uid))
     or not exists (select 1 from friendships where a_uid = p_a_uid and b_uid = p_b_uid)
     or exists (select 1 from blocks where blocker_uid in (p_a_uid, p_b_uid) and blocked_uid in (p_a_uid, p_b_uid)) then
    return jsonb_build_object('allowed', false, 'reason', 'conversation_unavailable');
  end if;

  insert into direct_messages(id, conversation_id, a_uid, b_uid, sender_uid, recipient_uid, client_message_id, body)
    values(p_id, p_conversation_id, p_a_uid, p_b_uid, p_sender_uid, p_recipient_uid, p_client_message_id, p_body)
    returning * into v_row;
  return jsonb_build_object('allowed', true, 'duplicate', false, 'conflict', false, 'message', direct_message_payload_v1(v_row));
exception when unique_violation then
  select * into v_existing from direct_messages
    where sender_uid = p_sender_uid and client_message_id = p_client_message_id;
  if found then
    return jsonb_build_object(
      'duplicate', true,
      'conflict', v_existing.recipient_uid <> p_recipient_uid or v_existing.body <> p_body,
      'message', direct_message_payload_v1(v_existing)
    );
  end if;
  raise;
end;
$$;

revoke all on function send_direct_message_v1(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function send_direct_message_v1(text, text, text, text, text, text, text, text) to service_role;

create or replace function apply_direct_message_read_v1(
  p_conversation_id text,
  p_uid text,
  p_peer_uid text,
  p_last_read_seq bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
begin
  if p_uid = p_peer_uid
     or p_conversation_id <> 'dm:' || least(p_uid, p_peer_uid) || '|' || greatest(p_uid, p_peer_uid)
     or p_last_read_seq < 1
     or not exists (
       select 1 from direct_messages
       where conversation_id = p_conversation_id
         and recipient_uid = p_uid
         and seq = p_last_read_seq
     ) then
    raise exception 'invalid_direct_message_read';
  end if;
  insert into direct_message_reads(conversation_id, uid, peer_uid, last_read_seq, updated_at)
    values(p_conversation_id, p_uid, p_peer_uid, p_last_read_seq, now())
  on conflict (conversation_id, uid) do update
    set last_read_seq = greatest(direct_message_reads.last_read_seq, excluded.last_read_seq),
        peer_uid = excluded.peer_uid,
        updated_at = now()
  returning last_read_seq into v_seq;
  return jsonb_build_object('conversationId', p_conversation_id, 'uid', p_uid, 'lastReadSeq', v_seq::text);
end;
$$;

revoke all on function apply_direct_message_read_v1(text, text, text, bigint) from public, anon, authenticated;
grant execute on function apply_direct_message_read_v1(text, text, text, bigint) to service_role;

create or replace function list_direct_messages_v1(p_limit integer, p_offset integer) returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(direct_message_payload_v1(row_value) order by row_value.seq desc), '[]'::jsonb)
  from (
    select * from direct_messages
    order by seq desc
    limit greatest(1, least(coalesce(p_limit, 1000), 1000))
    offset greatest(0, coalesce(p_offset, 0))
  ) row_value;
$$;

revoke all on function list_direct_messages_v1(integer, integer) from public, anon, authenticated;
grant execute on function list_direct_messages_v1(integer, integer) to service_role;

create or replace function list_direct_message_reads_v1(p_limit integer, p_offset integer) returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'conversation_id', row_value.conversation_id,
    'uid', row_value.uid,
    'peer_uid', row_value.peer_uid,
    'last_read_seq', row_value.last_read_seq::text,
    'updated_at', row_value.updated_at
  ) order by row_value.updated_at desc), '[]'::jsonb)
  from (
    select * from direct_message_reads
    order by updated_at desc
    limit greatest(1, least(coalesce(p_limit, 1000), 1000))
    offset greatest(0, coalesce(p_offset, 0))
  ) row_value;
$$;

revoke all on function list_direct_message_reads_v1(integer, integer) from public, anon, authenticated;
grant execute on function list_direct_message_reads_v1(integer, integer) to service_role;

-- Playline P0 RPC：数据库只保存 Node 已经裁决过的 canonical content，
-- 但仍在事务内检查作者、字段形状、幂等键、过期时间和关系可见性。
-- 所有返回值都是窄 projection；private_source/seq 永远不会进入读者结果。
create or replace function create_playline_post_v1(
  p_post_id text,
  p_author_uid text,
  p_client_post_id text,
  p_audience text,
  p_content_kind text,
  p_content_version integer default 1,
  p_canonical_content jsonb default '{}'::jsonb,
  p_private_source jsonb default '{}'::jsonb,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing playline_posts%rowtype;
  v_row playline_posts%rowtype;
  v_expires_at timestamptz;
  v_publish_count integer;
  v_same boolean;
begin
  if p_author_uid is null or btrim(p_author_uid) = ''
     or not exists (select 1 from profiles where uid = p_author_uid) then
    return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
      'reason', 'author_not_found');
  end if;
  if p_post_id is null or p_post_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
     or p_client_post_id is null or p_client_post_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$' then
    return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
      'reason', 'invalid_post_id');
  end if;
  if p_audience is null or p_audience not in ('all', 'friends') then
    return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
      'reason', 'invalid_audience');
  end if;
  if p_content_kind is null or p_content_kind not in ('text', 'game_share', 'result_share', 'record_share')
     or coalesce(p_content_version, 0) not between 1 and 32
     or p_canonical_content is null or jsonb_typeof(p_canonical_content) <> 'object'
     or jsonb_typeof(coalesce(p_private_source, '{}'::jsonb)) <> 'object'
     or octet_length(p_canonical_content::text) > 32768
     or octet_length(coalesce(p_private_source, '{}'::jsonb)::text) > 32768 then
    return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
      'reason', 'invalid_canonical_content');
  end if;

  -- The module has already resolved references. The RPC accepts only the safe
  -- canonical envelope and rejects private/audit identifiers if they leak in.
  if p_canonical_content ?| array[
      'source', 'privateSource', 'private_source', 'resultId', 'result_id',
      'replayId', 'replay_id', 'matchId', 'match_id', 'opponent', 'opponents',
      'opponentIds', 'opponent_ids', 'reward', 'coins', 'xp', 'seq'
    ] then
    return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
      'reason', 'invalid_canonical_content');
  end if;
  if p_content_kind = 'text' then
    if not (p_canonical_content ? 'text')
       or jsonb_typeof(p_canonical_content->'text') <> 'string'
       or char_length(p_canonical_content->>'text') not between 1 and 280
       or octet_length(p_canonical_content->>'text') > 1200
       or array_length(string_to_array(p_canonical_content->>'text', E'\n'), 1) > 4 then
      return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
        'reason', 'invalid_text');
    end if;
  elsif p_content_kind = 'game_share' then
    if jsonb_typeof(p_canonical_content->'gameId') <> 'string'
       or p_canonical_content->>'gameId' not in ('gomoku','ludo','monopoly','tank','tetris','xiangqi') then
      return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
        'reason', 'invalid_game');
    end if;
  elsif p_content_kind = 'result_share' then
    if jsonb_typeof(p_canonical_content->'gameId') <> 'string'
       or p_canonical_content->>'gameId' not in ('gomoku','ludo','monopoly','tank','tetris','xiangqi')
       or jsonb_typeof(p_canonical_content->'outcome') <> 'string'
       or (p_canonical_content ? 'mode' and jsonb_typeof(p_canonical_content->'mode') <> 'string') then
      return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
        'reason', 'invalid_result');
    end if;
  elsif p_content_kind = 'record_share' then
    if coalesce(jsonb_typeof(p_canonical_content->'record'), jsonb_typeof(p_canonical_content->'metric'), '') <> 'string' then
      return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
        'reason', 'invalid_record');
    end if;
  end if;

  v_expires_at := coalesce(p_expires_at, clock_timestamp() + interval '90 days');
  if v_expires_at <= clock_timestamp()
     or v_expires_at > clock_timestamp() + interval '90 days' + interval '1 minute' then
    return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
      'reason', 'invalid_expiry');
  end if;

  -- Serialize the author/client key so concurrent retries cannot create two rows
  -- or consume two rate slots.
  perform pg_advisory_xact_lock(hashtext('playline:' || p_author_uid || ':' || p_client_post_id));
  select * into v_existing
    from playline_posts
   where author_uid = p_author_uid and client_post_id = p_client_post_id
   for update;
  if found then
    v_same := v_existing.audience = p_audience
      and v_existing.content_kind = p_content_kind
      and v_existing.content_version = coalesce(p_content_version, 1)
      and v_existing.canonical_content = p_canonical_content;
    return jsonb_build_object(
      'created', false,
      'duplicate', true,
      'replayed', true,
      'conflict', not v_same,
      'reason', case when v_same then null else 'idempotency_conflict' end,
      'post', jsonb_build_object(
        'id', v_existing.id,
        'authorUid', v_existing.author_uid,
        'audience', v_existing.audience,
        'kind', v_existing.content_kind,
        'contentVersion', v_existing.content_version,
        'content', jsonb_strip_nulls(v_existing.canonical_content - array[
          'source','privateSource','private_source','resultId','result_id',
          'replayId','replay_id','matchId','match_id','opponent','opponents',
          'opponentIds','opponent_ids','reward','coins','xp','seq'
        ]::text[]),
        'createdAt', v_existing.created_at,
        'expiresAt', v_existing.expires_at,
        'state', v_existing.state
      )
    );
  end if;

  select count(*)::integer into v_publish_count
    from playline_rate_events
   where author_uid = p_author_uid
     and event_kind = 'publish'
     and created_at >= clock_timestamp() - interval '10 minutes';
  if v_publish_count >= 3 then
    return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
      'reason', 'rate_limited', 'retryAfter', 600);
  end if;
  select count(*)::integer into v_publish_count
    from playline_rate_events
   where author_uid = p_author_uid
     and event_kind = 'publish'
     and created_at >= clock_timestamp() - interval '24 hours';
  if v_publish_count >= 15 then
    return jsonb_build_object('created', false, 'duplicate', false, 'conflict', false,
      'reason', 'rate_limited', 'retryAfter', 86400);
  end if;

  insert into playline_posts(
    id, author_uid, client_post_id, audience, content_kind, content_version,
    canonical_content, private_source, state, expires_at
  ) values (
    p_post_id, p_author_uid, p_client_post_id, p_audience, p_content_kind,
    coalesce(p_content_version, 1), p_canonical_content, coalesce(p_private_source, '{}'::jsonb),
    'active', v_expires_at
  ) returning * into v_row;
  insert into playline_rate_events(author_uid, event_kind, client_post_id, post_id)
    values (p_author_uid, 'publish', p_client_post_id, v_row.id);
  return jsonb_build_object(
    'created', true, 'duplicate', false, 'replayed', false, 'conflict', false,
    'post', jsonb_build_object(
      'id', v_row.id,
      'authorUid', v_row.author_uid,
      'audience', v_row.audience,
      'kind', v_row.content_kind,
      'contentVersion', v_row.content_version,
      'content', jsonb_strip_nulls(v_row.canonical_content - array[
        'source','privateSource','private_source','resultId','result_id',
        'replayId','replay_id','matchId','match_id','opponent','opponents',
        'opponentIds','opponent_ids','reward','coins','xp','seq'
      ]::text[]),
      'createdAt', v_row.created_at,
      'expiresAt', v_row.expires_at,
      'state', v_row.state
    )
  );
exception when unique_violation then
  if exists (select 1 from playline_posts where id = p_post_id) then
    return jsonb_build_object('created', false, 'duplicate', false, 'conflict', true,
      'reason', 'post_id_conflict');
  end if;
  raise;
end;
$$;

revoke all on function create_playline_post_v1(text, text, text, text, text, integer, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function create_playline_post_v1(text, text, text, text, text, integer, jsonb, jsonb, timestamptz)
  to service_role;

create or replace function list_playline_posts_v1(
  p_actor_uid text,
  p_scope text,
  p_before_seq text default null,
  p_snapshot bigint default null,
  p_limit integer default 20
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 30));
  v_before_seq bigint;
  v_snapshot timestamptz := to_timestamp(coalesce(p_snapshot, (extract(epoch from clock_timestamp()) * 1000)::bigint) / 1000.0);
  v_posts jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_next_cursor text := null;
  v_list_count integer;
  v_count integer;
begin
  if p_actor_uid is null or btrim(p_actor_uid) = ''
     or not exists (select 1 from profiles where uid = p_actor_uid) then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated', 'posts', '[]'::jsonb);
  end if;
  if p_scope is null or p_scope not in ('all', 'friends') then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_scope', 'posts', '[]'::jsonb);
  end if;
  select count(*)::integer into v_list_count
    from playline_rate_events
   where author_uid = p_actor_uid
     and event_kind = 'list'
     and created_at >= clock_timestamp() - interval '1 minute';
  if v_list_count >= 60 then
    return jsonb_build_object('allowed', false, 'reason', 'rate_limited', 'posts', '[]'::jsonb,
      'retryAfter', 60);
  end if;
  insert into playline_rate_events(author_uid, event_kind) values (p_actor_uid, 'list');

  -- Node signs the public cursor and passes only the decoded internal sequence
  -- to this service-role RPC. Browser roles cannot execute this function.
  if p_before_seq is not null and btrim(p_before_seq) <> '' then
    if p_before_seq !~ '^[0-9]{1,40}$' then
      return jsonb_build_object('allowed', false, 'reason', 'invalid_cursor', 'posts', '[]'::jsonb);
    end if;
    begin v_before_seq := p_before_seq::bigint; exception when others then v_before_seq := null; end;
    if v_before_seq is null or v_before_seq <= 0 then
      return jsonb_build_object('allowed', false, 'reason', 'invalid_cursor', 'posts', '[]'::jsonb);
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', row_value.id,
      'seq', row_value.seq::text,
      'authorUid', row_value.author_uid,
      'audience', row_value.audience,
      'kind', row_value.content_kind,
      'clientPostId', row_value.client_post_id,
      'normalizedText', case when row_value.content_kind = 'text' then row_value.canonical_content->>'text' else null end,
      'safeSnapshot', jsonb_strip_nulls(row_value.canonical_content - array[
        'source','privateSource','private_source','resultId','result_id',
        'replayId','replay_id','matchId','match_id','opponent','opponents',
        'opponentIds','opponent_ids','reward','coins','xp','seq'
      ]::text[]),
      'createdAt', floor(extract(epoch from row_value.created_at) * 1000)::bigint,
      'deletedAt', 0,
      'tombstone', false
    ) order by row_value.seq desc), '[]'::jsonb)
    into v_posts
    from (
      select p.id, p.seq, p.author_uid, p.client_post_id, p.audience, p.content_kind,
             p.canonical_content, p.created_at
        from playline_posts p
        join profiles pr on pr.uid = p.author_uid
       where p.state = 'active'
         and p.expires_at > clock_timestamp()
         and p.created_at <= v_snapshot
         and (v_before_seq is null or p.seq < v_before_seq)
         -- Every read re-checks both directions of Block; no cached audience
         -- snapshot can bypass a current social graph decision.
         and not exists (
           select 1 from blocks b
            where (b.blocker_uid = p_actor_uid and b.blocked_uid = p.author_uid)
               or (b.blocker_uid = p.author_uid and b.blocked_uid = p_actor_uid)
         )
         and (
           (p_scope = 'all' and (p.audience = 'all' or p.author_uid = p_actor_uid))
           or
           (p_scope = 'friends' and (
             p.author_uid = p_actor_uid
             or exists (
               select 1 from friendships f
                where f.a_uid = least(p_actor_uid, p.author_uid)
                  and f.b_uid = greatest(p_actor_uid, p.author_uid)
             )
           ))
         )
       order by p.seq desc
       limit v_limit + 1
    ) row_value;

  v_count := jsonb_array_length(v_posts);
  if v_count > v_limit then
    v_has_more := true;
    v_next_cursor := v_posts->(v_limit - 1)->>'seq';
    v_posts := v_posts - v_limit;
  end if;
  return jsonb_build_object(
    'allowed', true,
    'records', v_posts,
    'hasMore', v_has_more,
    'lastSeq', v_next_cursor,
    'snapshot', floor(extract(epoch from v_snapshot) * 1000)::bigint
  );
end;
$$;

revoke all on function list_playline_posts_v1(text, text, text, bigint, integer)
  from public, anon, authenticated;
grant execute on function list_playline_posts_v1(text, text, text, bigint, integer)
  to service_role;

create or replace function delete_playline_post_v1(
  p_author_uid text,
  p_post_id text,
  p_request_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row playline_posts%rowtype;
  v_delete_count integer;
begin
  if p_author_uid is null or btrim(p_author_uid) = ''
     or not exists (select 1 from profiles where uid = p_author_uid) then
    return jsonb_build_object('deleted', false, 'duplicate', false, 'reason', 'not_authenticated');
  end if;
  if p_post_id is null or p_post_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$' then
    return jsonb_build_object('deleted', false, 'duplicate', false, 'reason', 'invalid_post_id');
  end if;
  perform pg_advisory_xact_lock(hashtext('playline-delete:' || p_post_id));
  select * into v_row from playline_posts where id = p_post_id for update;
  if not found then
    -- A missing target is an idempotent tombstone response; do not reveal whether
    -- a different author's post ever existed.
    return jsonb_build_object('deleted', false, 'duplicate', true, 'postId', p_post_id);
  end if;
  if v_row.author_uid <> p_author_uid then
    return jsonb_build_object('deleted', false, 'duplicate', false, 'reason', 'delete_forbidden');
  end if;
  if v_row.state <> 'active' or v_row.deleted_at is not null then
    return jsonb_build_object('deleted', true, 'duplicate', true, 'postId', v_row.id,
      'state', v_row.state, 'deletedAt', v_row.deleted_at);
  end if;
  select count(*)::integer into v_delete_count
    from playline_rate_events
   where author_uid = p_author_uid
     and event_kind = 'delete'
     and created_at >= clock_timestamp() - interval '1 minute';
  if v_delete_count >= 20 then
    return jsonb_build_object('deleted', false, 'duplicate', false, 'reason', 'rate_limited',
      'retryAfter', 60);
  end if;
  update playline_posts
     set state = 'deleted', deleted_at = clock_timestamp()
   where id = v_row.id;
  insert into playline_rate_events(author_uid, event_kind, post_id)
    values (p_author_uid, 'delete', v_row.id);
  return jsonb_build_object('deleted', true, 'duplicate', false, 'postId', v_row.id,
    'state', 'deleted', 'deletedAt', (select deleted_at from playline_posts where id = v_row.id));
end;
$$;

revoke all on function delete_playline_post_v1(text, text, text)
  from public, anon, authenticated;
grant execute on function delete_playline_post_v1(text, text, text)
  to service_role;

create or replace function resolve_playline_report_target_v1(
  p_reporter_uid text,
  p_post_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_uid text;
  v_audience text;
begin
  if p_reporter_uid is null or btrim(p_reporter_uid) = ''
     or not exists (select 1 from profiles where uid = p_reporter_uid) then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;
  select author_uid, audience into v_author_uid, v_audience
    from playline_posts
   where id = p_post_id
     and state = 'active'
     and expires_at > clock_timestamp();
  if not found or v_author_uid = p_reporter_uid
     or exists (
       select 1 from blocks b
        where (b.blocker_uid = p_reporter_uid and b.blocked_uid = v_author_uid)
           or (b.blocker_uid = v_author_uid and b.blocked_uid = p_reporter_uid)
     )
     or not (
       v_audience = 'all'
       or exists (
         select 1 from friendships f
          where f.a_uid = least(p_reporter_uid, v_author_uid)
            and f.b_uid = greatest(p_reporter_uid, v_author_uid)
       )
     ) then
    return jsonb_build_object('allowed', false, 'reason', 'post_unavailable');
  end if;
  -- Only IDs/context are returned. The caller may now create a normal report row;
  -- this RPC intentionally never copies canonical content into reports/analytics.
  return jsonb_build_object(
    'allowed', true,
    'postId', p_post_id,
    'targetUid', v_author_uid,
    'contextType', 'playline',
    'contextId', p_post_id
  );
end;
$$;

revoke all on function resolve_playline_report_target_v1(text, text)
  from public, anon, authenticated;
grant execute on function resolve_playline_report_target_v1(text, text)
  to service_role;

create or replace function purge_playline_posts_v1(p_now bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := to_timestamp(coalesce(p_now, (extract(epoch from clock_timestamp()) * 1000)::bigint) / 1000.0);
  v_expired integer := 0;
begin
  update playline_posts set state = 'expired', deleted_at = coalesce(deleted_at, v_now)
   where state = 'active' and expires_at <= v_now;
  get diagnostics v_expired = row_count;
  delete from playline_rate_events where created_at < v_now - interval '90 days';
  return jsonb_build_object('ok', true, 'expired', v_expired);
end;
$$;

revoke all on function purge_playline_posts_v1(bigint) from public, anon, authenticated;
grant execute on function purge_playline_posts_v1(bigint) to service_role;

-- 多实例协调与跨实例持久事件（durable polling baseline）。
-- 这些表只允许 service_role 通过受限 RPC 访问；事件 payload 严禁聊天正文、凭证和任意用户原文。
create table if not exists cluster_instances (
  instance_id text primary key,
  deployment_id text not null default '',
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint cluster_instances_id_ck check (instance_id ~ '^[A-Za-z0-9._:-]{8,128}$'),
  constraint cluster_instances_metadata_ck check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096)
);

create table if not exists cluster_leases (
  lease_key text primary key,
  holder_instance_id text references cluster_instances(instance_id) on delete set null,
  fencing_token bigint not null default 0,
  lease_until timestamptz not null default to_timestamp(0),
  updated_at timestamptz not null default now(),
  constraint cluster_leases_key_ck check (lease_key ~ '^[a-z0-9._:-]{3,96}$'),
  constraint cluster_leases_token_ck check (fencing_token >= 0)
);

create table if not exists platform_events (
  id bigint generated by default as identity primary key,
  topic text not null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  origin_instance_id text references cluster_instances(instance_id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint platform_events_topic_ck check (topic in ('direct_message','direct_message_read','reward_sync','ai_learning_sync','metrics_snapshot')),
  constraint platform_events_dedupe_ck check (dedupe_key ~ '^[A-Za-z0-9._:-]{3,160}$'),
  constraint platform_events_payload_ck check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8192),
  constraint platform_events_expiry_ck check (expires_at > created_at),
  unique(topic, dedupe_key)
);
create index if not exists idx_platform_events_topic_id on platform_events(topic, id);
create index if not exists idx_platform_events_expiry on platform_events(expires_at);

create table if not exists cluster_event_cursors (
  consumer_id text not null,
  topic text not null,
  last_event_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (consumer_id, topic),
  constraint cluster_event_cursors_consumer_ck check (consumer_id ~ '^[A-Za-z0-9._:-]{8,128}$'),
  constraint cluster_event_cursors_topic_ck check (topic in ('direct_message','direct_message_read','reward_sync','ai_learning_sync','metrics_snapshot')),
  constraint cluster_event_cursors_id_ck check (last_event_id >= 0)
);

create table if not exists metrics_snapshots (
  id bigint generated by default as identity primary key,
  instance_id text references cluster_instances(instance_id) on delete set null,
  generated_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint metrics_snapshots_payload_ck check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536),
  unique(instance_id, generated_at)
);
create index if not exists idx_metrics_snapshots_generated_at on metrics_snapshots(generated_at desc);

create or replace function platform_event_payload_allowed_v1(p_topic text, p_payload jsonb) returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) = 'object'
    and octet_length(coalesce(p_payload, '{}'::jsonb)::text) <= 8192
    and not (coalesce(p_payload, '{}'::jsonb)::text ~* '"(body|text|message|password|pin|token|secret|prompt|authorization)"[[:space:]]*:')
    and case p_topic
      when 'direct_message' then
        coalesce((select bool_and(key = any(array['messageId','senderUid','recipientUid'])) from jsonb_object_keys(coalesce(p_payload,'{}'::jsonb)) as payload_keys(key)), true)
        and coalesce(p_payload->>'messageId','') ~ '^[A-Za-z0-9._:-]{3,128}$'
      when 'direct_message_read' then
        coalesce((select bool_and(key = any(array['conversationId','readerUid','peerUid','throughSeq'])) from jsonb_object_keys(coalesce(p_payload,'{}'::jsonb)) as payload_keys(key)), true)
        and coalesce(p_payload->>'throughSeq','') ~ '^[0-9]{1,30}$'
      when 'reward_sync' then
        coalesce((select bool_and(key = any(array['resultId','uid','game'])) from jsonb_object_keys(coalesce(p_payload,'{}'::jsonb)) as payload_keys(key)), true)
      when 'ai_learning_sync' then
        coalesce((select bool_and(key = any(array['resultId','uid','game','revision'])) from jsonb_object_keys(coalesce(p_payload,'{}'::jsonb)) as payload_keys(key)), true)
      when 'metrics_snapshot' then
        coalesce((select bool_and(key = any(array['snapshotId','generatedAt'])) from jsonb_object_keys(coalesce(p_payload,'{}'::jsonb)) as payload_keys(key)), true)
      else false
    end;
$$;
revoke all on function platform_event_payload_allowed_v1(text, jsonb) from public, anon, authenticated;

create or replace function claim_cluster_lease_v1(
  p_lease_key text,
  p_instance_id text,
  p_ttl_seconds integer,
  p_deployment_id text default '',
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row cluster_leases%rowtype;
  v_now timestamptz := clock_timestamp();
  v_ttl integer := greatest(5, least(coalesce(p_ttl_seconds, 30), 300));
  v_takeover boolean;
begin
  if coalesce(p_lease_key,'') !~ '^[a-z0-9._:-]{3,96}$'
     or coalesce(p_instance_id,'') !~ '^[A-Za-z0-9._:-]{8,128}$'
     or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_metadata,'{}'::jsonb)::text) > 4096 then
    raise exception 'invalid_cluster_lease_request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cluster-lease:' || p_lease_key, 0));
  insert into cluster_instances(instance_id,deployment_id,started_at,heartbeat_at,expires_at,metadata)
    values(p_instance_id,left(coalesce(p_deployment_id,''),160),v_now,v_now,v_now + make_interval(secs=>v_ttl*3),coalesce(p_metadata,'{}'::jsonb))
  on conflict(instance_id) do update set deployment_id=excluded.deployment_id,heartbeat_at=v_now,
    expires_at=v_now + make_interval(secs=>v_ttl*3),metadata=excluded.metadata;
  insert into cluster_leases(lease_key,holder_instance_id,fencing_token,lease_until,updated_at)
    values(p_lease_key,p_instance_id,1,v_now + make_interval(secs=>v_ttl),v_now)
  on conflict(lease_key) do nothing;
  select * into v_row from cluster_leases where lease_key=p_lease_key for update;
  v_takeover := v_row.holder_instance_id is null or v_row.lease_until <= v_now;
  if v_takeover then
    update cluster_leases set holder_instance_id=p_instance_id,fencing_token=fencing_token+1,
      lease_until=v_now + make_interval(secs=>v_ttl),updated_at=v_now where lease_key=p_lease_key returning * into v_row;
  elsif v_row.holder_instance_id = p_instance_id then
    update cluster_leases set lease_until=v_now + make_interval(secs=>v_ttl),updated_at=v_now
      where lease_key=p_lease_key returning * into v_row;
  end if;
  return jsonb_build_object('claimed',v_row.holder_instance_id=p_instance_id,'leaseKey',p_lease_key,
    'holderInstanceId',v_row.holder_instance_id,'fencingToken',v_row.fencing_token::text,'leaseUntil',v_row.lease_until);
end;
$$;
revoke all on function claim_cluster_lease_v1(text,text,integer,text,jsonb) from public, anon, authenticated;
grant execute on function claim_cluster_lease_v1(text,text,integer,text,jsonb) to service_role;

create or replace function renew_cluster_lease_v1(
  p_lease_key text,
  p_instance_id text,
  p_fencing_token bigint,
  p_ttl_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
  v_now timestamptz := clock_timestamp();
  v_ttl integer := greatest(5, least(coalesce(p_ttl_seconds, 30), 300));
begin
  update cluster_leases set lease_until=v_now + make_interval(secs=>v_ttl),updated_at=v_now
    where lease_key=p_lease_key and holder_instance_id=p_instance_id and fencing_token=p_fencing_token and lease_until>v_now
    returning lease_until into v_until;
  if v_until is not null then
    update cluster_instances set heartbeat_at=v_now,expires_at=v_now + make_interval(secs=>v_ttl*3) where instance_id=p_instance_id;
  end if;
  return jsonb_build_object('renewed',v_until is not null,'leaseKey',p_lease_key,'fencingToken',p_fencing_token::text,'leaseUntil',v_until);
end;
$$;
revoke all on function renew_cluster_lease_v1(text,text,bigint,integer) from public, anon, authenticated;
grant execute on function renew_cluster_lease_v1(text,text,bigint,integer) to service_role;

create or replace function append_platform_event_v1(
  p_topic text,
  p_dedupe_key text,
  p_payload jsonb,
  p_origin_instance_id text,
  p_lease_key text default null,
  p_fencing_token bigint default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row platform_events%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if coalesce(p_dedupe_key,'') !~ '^[A-Za-z0-9._:-]{3,160}$'
     or not platform_event_payload_allowed_v1(p_topic,p_payload) then
    raise exception 'invalid_platform_event';
  end if;
  if not exists(select 1 from cluster_instances where instance_id=p_origin_instance_id and expires_at>v_now) then
    raise exception 'inactive_cluster_instance';
  end if;
  if p_lease_key is not null and not exists(
    select 1 from cluster_leases where lease_key=p_lease_key and holder_instance_id=p_origin_instance_id
      and fencing_token=p_fencing_token and lease_until>v_now
  ) then
    raise exception 'stale_cluster_fencing_token';
  end if;
  insert into platform_events(topic,dedupe_key,payload,origin_instance_id,created_at,expires_at)
    values(p_topic,p_dedupe_key,p_payload,p_origin_instance_id,v_now,v_now+interval '7 days')
  on conflict(topic,dedupe_key) do update set dedupe_key=excluded.dedupe_key
  returning * into v_row;
  return jsonb_build_object('id',v_row.id::text,'topic',v_row.topic,'duplicate',v_row.created_at<v_now,
    'createdAt',v_row.created_at,'expiresAt',v_row.expires_at);
end;
$$;
revoke all on function append_platform_event_v1(text,text,jsonb,text,text,bigint) from public, anon, authenticated;
grant execute on function append_platform_event_v1(text,text,jsonb,text,text,bigint) to service_role;

create or replace function list_platform_events_v1(p_consumer_id text,p_topic text,p_limit integer) returns jsonb
language sql
security definer
set search_path = public
as $$
  with cursor_value as (
    select coalesce(
      (select last_event_id from cluster_event_cursors where consumer_id=p_consumer_id and topic=p_topic),
      (select coalesce(min(event.id)-1,0) from platform_events event
        where event.topic=p_topic and event.created_at >= coalesce((select started_at from cluster_instances where instance_id=p_consumer_id),clock_timestamp())),
      0
    ) as last_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',row_value.id::text,'topic',row_value.topic,
    'payload',row_value.payload,'originInstanceId',row_value.origin_instance_id,'createdAt',row_value.created_at)
    order by row_value.id), '[]'::jsonb)
  from (
    select event.* from platform_events event,cursor_value cursor
      where event.topic=p_topic and event.id>cursor.last_id and event.expires_at>clock_timestamp()
      order by event.id limit greatest(1,least(coalesce(p_limit,100),500))
  ) row_value;
$$;
revoke all on function list_platform_events_v1(text,text,integer) from public, anon, authenticated;
grant execute on function list_platform_events_v1(text,text,integer) to service_role;

create or replace function commit_cluster_cursor_v1(p_consumer_id text,p_topic text,p_last_event_id bigint) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  if coalesce(p_consumer_id,'') !~ '^[A-Za-z0-9._:-]{8,128}$' or p_last_event_id<0 then raise exception 'invalid_cluster_cursor'; end if;
  insert into cluster_event_cursors(consumer_id,topic,last_event_id,updated_at)
    values(p_consumer_id,p_topic,p_last_event_id,clock_timestamp())
  on conflict(consumer_id,topic) do update set last_event_id=greatest(cluster_event_cursors.last_event_id,excluded.last_event_id),updated_at=clock_timestamp()
  returning last_event_id into v_id;
  return jsonb_build_object('consumerId',p_consumer_id,'topic',p_topic,'lastEventId',v_id::text);
end;
$$;
revoke all on function commit_cluster_cursor_v1(text,text,bigint) from public, anon, authenticated;
grant execute on function commit_cluster_cursor_v1(text,text,bigint) to service_role;

create or replace function append_metrics_snapshot_v1(p_instance_id text,p_generated_at timestamptz,p_payload jsonb) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row metrics_snapshots%rowtype;
begin
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' or octet_length(coalesce(p_payload,'{}'::jsonb)::text)>65536
     or coalesce(p_payload,'{}'::jsonb)::text ~* '"(body|text|message|password|pin|token|secret|prompt|authorization)"[[:space:]]*:' then
    raise exception 'invalid_metrics_snapshot';
  end if;
  insert into metrics_snapshots(instance_id,generated_at,payload) values(p_instance_id,p_generated_at,p_payload)
  on conflict(instance_id,generated_at) do update set payload=excluded.payload returning * into v_row;
  return jsonb_build_object('id',v_row.id::text,'generatedAt',v_row.generated_at);
end;
$$;
revoke all on function append_metrics_snapshot_v1(text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function append_metrics_snapshot_v1(text,timestamptz,jsonb) to service_role;

create or replace function get_direct_message_by_id_v1(p_id text) returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce((select direct_message_payload_v1(row_value) from direct_messages row_value where row_value.id=p_id), 'null'::jsonb);
$$;
revoke all on function get_direct_message_by_id_v1(text) from public, anon, authenticated;
grant execute on function get_direct_message_by_id_v1(text) to service_role;

create or replace function cleanup_cluster_data_v1(p_instance_id text,p_fencing_token bigint) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_events integer := 0;
  v_metrics integer := 0;
  v_cursors integer := 0;
  v_instances integer := 0;
begin
  if not exists(
    select 1 from cluster_leases where lease_key='maintenance:outbox' and holder_instance_id=p_instance_id
      and fencing_token=p_fencing_token and lease_until>v_now
  ) then raise exception 'stale_cluster_fencing_token'; end if;
  delete from platform_events where expires_at<=v_now; get diagnostics v_events=row_count;
  delete from metrics_snapshots where generated_at<v_now-interval '30 days'; get diagnostics v_metrics=row_count;
  delete from cluster_event_cursors cursor_row where cursor_row.updated_at<v_now-interval '7 days'
    and not exists(select 1 from cluster_instances instance_row where instance_row.instance_id=cursor_row.consumer_id and instance_row.expires_at>v_now);
  get diagnostics v_cursors=row_count;
  delete from cluster_instances instance_row where instance_row.expires_at<v_now-interval '1 day'
    and not exists(select 1 from cluster_leases lease_row where lease_row.holder_instance_id=instance_row.instance_id and lease_row.lease_until>v_now);
  get diagnostics v_instances=row_count;
  return jsonb_build_object('events',v_events,'metrics',v_metrics,'cursors',v_cursors,'instances',v_instances,'cleanedAt',v_now);
end;
$$;
revoke all on function cleanup_cluster_data_v1(text,bigint) from public, anon, authenticated;
grant execute on function cleanup_cluster_data_v1(text,bigint) to service_role;

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
alter table direct_messages enable row level security;
alter table direct_message_reads enable row level security;
alter table cluster_instances enable row level security;
alter table cluster_leases enable row level security;
alter table platform_events enable row level security;
alter table cluster_event_cursors enable row level security;
alter table metrics_snapshots enable row level security;
alter table playline_posts enable row level security;
alter table playline_rate_events enable row level security;
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
revoke all on table direct_messages from public, anon, authenticated;
revoke all on table direct_message_reads from public, anon, authenticated;
revoke all on table cluster_instances from public, anon, authenticated;
revoke all on table cluster_leases from public, anon, authenticated;
revoke all on table platform_events from public, anon, authenticated;
revoke all on table cluster_event_cursors from public, anon, authenticated;
revoke all on table metrics_snapshots from public, anon, authenticated;
revoke all on table playline_posts from public, anon, authenticated;
revoke all on table playline_rate_events from public, anon, authenticated;
grant all on table playline_posts to service_role;
grant all on table playline_rate_events to service_role;
revoke all on sequence history_id_seq from anon, authenticated;
revoke all on sequence reward_history_id_seq from anon, authenticated;
revoke all on sequence economy_ledger_id_seq from anon, authenticated;
revoke all on sequence analytics_events_id_seq from anon, authenticated;
revoke all on sequence ai_learning_experiences_id_seq from anon, authenticated;
revoke all on sequence direct_messages_seq_seq from public, anon, authenticated;
revoke all on sequence platform_events_id_seq from public, anon, authenticated;
revoke all on sequence metrics_snapshots_id_seq from public, anon, authenticated;
revoke all on sequence playline_posts_seq_seq from public, anon, authenticated;
revoke all on sequence playline_rate_events_id_seq from public, anon, authenticated;
grant usage, select on sequence playline_posts_seq_seq to service_role;
grant usage, select on sequence playline_rate_events_id_seq to service_role;

-- 常用管理查询（供日后在 Dashboard 使用）
-- 1) 全球总榜：select name, coins, total, played from profiles order by coins desc;
-- 2) 单游戏局数榜：select name, played->>'gomoku' as gomoku_games from profiles order by (played->>'gomoku')::int desc;
-- 3) 最近结算（同一联机 match 会按参与者出现多行）：select p.name, h.game, h.coins, h.xp, h.match_id, h.created_at from history h join profiles p on p.uid = h.uid order by h.created_at desc limit 50;
-- 4) 奖励审计：select uid, game, mode, result, reward_currency, reward_xp, eligible, blocked_reason from reward_history order by created_at desc limit 100;
-- 5) 经济收支：select kind, sum(amount) from economy_ledger group by kind order by kind;

-- 迁移说明：本文件包含可重复执行的 ADD COLUMN IF NOT EXISTS；Render 环境变量配置后，
-- 在 Supabase SQL Editor 执行一次，再用 service_role secret 运行 node scripts/supabase-status.js 验证字段。
