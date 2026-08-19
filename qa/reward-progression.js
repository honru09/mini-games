'use strict';

const {
  PROTOCOL,
  DAILY_TASK_DEFS,
  createRewardProgressionPolicy,
  createRewardProgression,
  createMemoryRewardProgressionAdapter,
} = require('../server/boundaries/reward-progression');
const {
  VALID_GAMES,
  REWARD_CONFIG,
  dayKey,
  xpForLevel,
  levelFromXp,
  resolveMatchReward,
} = require('../server/reward-engine');

const failures = [];
function check(name, condition, detail) {
  if (condition) console.log('PASS  ' + name);
  else { failures.push({ name, detail: detail || '' }); console.log('FAIL  ' + name + (detail ? ' :: ' + detail : '')); }
}

const policy = createRewardProgressionPolicy({
  validGames: VALID_GAMES,
  dayKey,
  xpForLevel,
  levelFromXp,
  curveVersion: REWARD_CONFIG.level.curveVersion,
  normalizePlayerCharacter: value => value || null,
});
const adapter = createMemoryRewardProgressionAdapter();
const progression = createRewardProgression({
  policy,
  adapter,
  now: () => Date.UTC(2026, 7, 18, 12),
});

function user(overrides = {}) {
  return {
    uid: 'p7-user', ephemeral: false, coins: 0, xp: 0, level: 1, xpCurveVersion: 0,
    streak: 0, bestStreak: 0, dailyFirstWinDate: '2026-08-18',
    dailyAICurrencyKey: '2026-08-18', dailyAICurrencyEarned: 0,
    played: {}, total: 0, wins: {}, totalWins: 0, dailyKey: '2026-08-18',
    daily: { play: 0, win: 0, streak: 0 }, dailyTaskKey: '2026-08-18',
    dailyTasks: { play: 0, win: 0, streak: 0, claimed: [], claimIds: {} },
    achievements: [], recentResults: [], playmates: {}, ...(overrides || {}),
  };
}

function reward(profile, resultId, at, overrides = {}) {
  return resolveMatchReward({
    gameId: 'gomoku', mode: 'online', result: 'win', placement: 1, participantCount: 2,
    eligible: true, matchId: 'p7-match', resultId, now: at, repeatCount24h: 0, ...overrides,
  }, profile);
}

check('exports frozen protocol and daily task catalog', PROTOCOL === 'reward-progression-v1' && Object.isFrozen(DAILY_TASK_DEFS) && DAILY_TASK_DEFS.length === 4);

const first = user();
const at = Date.UTC(2026, 7, 18, 23, 59, 59, 999);
const firstReward = reward(first, 'p7-result-001', at);
const applied = progression.apply({ user: first, reward: firstReward, meta: { resultId: 'p7-result-001', matchId: 'p7-match', at } });
check('eligible apply mutates profile once through the Module', applied.ok && applied.status === 'applied' && first.total === 1 && first.played.gomoku === 1 && first.wins.gomoku === 1 && first.totalWins === 1);
check('daily and achievement side effects use injected event date', first.dailyKey === '2026-08-18' && first.daily.play === 1 && first.daily.win === 1 && first.dailyTasks.win === 1 && first.achievements.includes('first_win'));
check('row and audit effects are bounded and detached', applied.row && applied.row.at === at && adapter.state.history.length === 1 && adapter.state.rewardHistory.length === 1 && adapter.state.events.some(event => event.event === 'reward_granted'));

const beforeDuplicate = JSON.stringify(first);
const duplicate = progression.apply({ user: first, reward: firstReward, meta: { resultId: 'p7-result-001', matchId: 'p7-match', at } });
check('same resultId replay is a no-op duplicate', duplicate.ok && duplicate.status === 'duplicate' && JSON.stringify(first) === beforeDuplicate && adapter.state.history.length === 1);
const conflict = progression.apply({ user: first, reward: { ...firstReward, currency: firstReward.currency + 1 }, meta: { resultId: 'p7-result-001', matchId: 'p7-match', at } });
check('same resultId with changed reward fails closed', !conflict.ok && conflict.reason === 'reward_progression_idempotency_conflict');

const nextDay = user({ dailyFirstWinDate: '2026-08-18' });
const nextAt = Date.UTC(2026, 7, 19, 0, 0, 0, 1);
const nextReward = reward(nextDay, 'p7-result-002', nextAt, { result: 'loss', placement: 2 });
const next = progression.apply({ user: nextDay, reward: nextReward, meta: { resultId: 'p7-result-002', matchId: 'p7-match-2', at: nextAt } });
check('cross-midnight projection resets daily AI key and uses meta.at day', next.ok && nextDay.dailyKey === '2026-08-19' && nextDay.dailyTaskKey === '2026-08-19' && nextDay.daily.play === 1);

const blocked = user({ streak: 4, bestStreak: 4 });
const blockedReward = reward(blocked, 'p7-result-003', at, { eligible: false, blockedReason: 'insufficient_actions' });
const blockedResult = progression.apply({ user: blocked, reward: blockedReward, meta: { resultId: 'p7-result-003', matchId: 'p7-match-3', at } });
check('blocked reward does not advance stats or daily', blockedResult.ok && blocked.total === 0 && blocked.coins === 0 && blocked.daily.play === 0 && blocked.achievements.length === 0);
const afk = user({ streak: 4, bestStreak: 4 });
const afkReward = reward(afk, 'p7-result-004', at, { eligible: false, blockedReason: 'afk' });
const afkResult = progression.apply({ user: afk, reward: afkReward, meta: { resultId: 'p7-result-004', matchId: 'p7-match-4', at } });
check('AFK only applies resolver streak reset', afkResult.ok && afk.streak === 0 && afk.total === 0 && afk.daily.play === 0);

const guest = user({ uid: 'guest-1', ephemeral: true });
const guestResult = progression.apply({ user: guest, reward: reward(guest, 'p7-result-005', at), meta: { resultId: 'p7-result-005', matchId: 'p7-match-5', at } });
check('guest projection stays in memory and remains marked ephemeral', guestResult.ok && guest.ephemeral === true && guestResult.row.ephemeral === true);

const hostile = user();
const hostileReward = Object.create(null);
Object.defineProperty(hostileReward, 'gameId', { get() { throw new Error('getter'); } });
const hostileResult = progression.apply({ user: hostile, reward: hostileReward, meta: { resultId: 'p7-result-006', matchId: 'p7-match-6', at } });
check('accessor-backed reward fails closed without executing projection', !hostileResult.ok && hostile.total === 0);
const malformedMeta = progression.apply({ user: hostile, reward: reward(hostile, 'p7-result-007', at), meta: { resultId: 'x' } });
check('malformed result identity is rejected', !malformedMeta.ok && malformedMeta.reason === 'reward_progression_invalid_meta');

const capped = user({ recentResults: Array.from({ length: 510 }, (_, index) => 'old-' + index) });
const cappedReward = reward(capped, 'p7-result-008', at, { result: 'draw', placement: 1 });
const cappedResult = progression.apply({ user: capped, reward: cappedReward, meta: { resultId: 'p7-result-008', matchId: 'p7-match-8', at } });
check('recent result journal stays bounded at 500', cappedResult.ok && capped.recentResults.length === 500 && capped.recentResults.at(-1) === 'p7-result-008');

const failedAdapter = createMemoryRewardProgressionAdapter();
const failing = createRewardProgression({ policy, adapter: Object.freeze({
  findResult: () => null,
  commit: () => ({ ok: false, reason: 'reward_progression_commit_failed' }),
}), now: () => at });
const rollbackUser = user({ uid: 'rollback-user' });
const rollbackSnapshot = JSON.stringify(rollbackUser);
const rollback = failing.apply({ user: rollbackUser, reward: reward(rollbackUser, 'p7-result-009', at), meta: { resultId: 'p7-result-009', matchId: 'p7-match-9', at } });
check('Adapter commit failure returns stable reason without mutating canonical user', !rollback.ok && rollback.reason === 'reward_progression_commit_failed' && JSON.stringify(rollbackUser) === rollbackSnapshot && failedAdapter.state.history.length === 0);

progression.dispose();
const disposed = progression.apply({ user: user(), reward: reward(user(), 'p7-result-010', at), meta: { resultId: 'p7-result-010', matchId: 'p7-match-10', at } });
check('dispose is terminal and fail-closed', !disposed.ok && disposed.reason === 'reward_progression_disposed');

if (failures.length) {
  console.error('REWARD_PROGRESSION_FAILED (' + failures.length + ' failures)');
  process.exitCode = 1;
} else {
  console.log('REWARD_PROGRESSION_ALL_PASS assertions=' + 15);
}
