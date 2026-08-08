// Economy & Progression v1.0：纯服务端奖励配置与计算回归。
'use strict';

const {
  VALID_GAMES,
  REWARD_CONFIG,
  xpRequiredForNextLevel,
  xpForLevel,
  levelFromXp,
  evaluateEligibility,
  normalizeRoomResults,
  resolveMatchReward,
} = require('../server/reward-engine');

const failures = [];
function check(name, condition, detail){
  if (condition) console.log('PASS  ' + name);
  else {
    failures.push({ name, detail: detail || '' });
    console.log('FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
}
function profile(overrides){
  return {
    xp: 0, level: 1, streak: 0, bestStreak: 0,
    dailyFirstWinDate: '', dailyAICurrencyKey: '', dailyAICurrencyEarned: 0,
    ...(overrides || {}),
  };
}
function applyReward(user, reward){
  user.xp = reward.xpAfter;
  user.level = reward.levelAfter;
  user.streak = reward.streakAfter;
  user.bestStreak = reward.bestStreakAfter;
  user.dailyFirstWinDate = reward.dailyFirstWinDateAfter;
  user.dailyAICurrencyKey = reward.dailyAICurrencyKeyAfter;
  user.dailyAICurrencyEarned = reward.dailyAICurrencyEarnedAfter;
}
function reward(user, input){
  return resolveMatchReward({
    gameId: 'gomoku', mode: 'online', result: 'win', placement: 1, participantCount: 2,
    eligible: true, now: Date.UTC(2026, 7, 7, 12), repeatCount24h: 0,
    ...(input || {}),
  }, user);
}

const expectedGames = ['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'];
check('奖励配置只包含当前 6 款游戏', JSON.stringify(VALID_GAMES) === JSON.stringify(expectedGames) &&
  JSON.stringify(Object.keys(REWARD_CONFIG.games)) === JSON.stringify(expectedGames));
check('6 款游戏初始权重均为 1.0', expectedGames.every(id => REWARD_CONFIG.games[id].weight === 1));
for (const gameId of expectedGames){
  const multiplayerGame = ['ludo', 'monopoly', 'tetris'].includes(gameId);
  const onlineReward = reward(profile({ dailyFirstWinDate: '2026-08-07' }), {
    gameId, mode: 'online', participantCount: multiplayerGame ? 4 : 2, placement: 1, result: 'win',
  });
  const aiReward = reward(profile(), { gameId, mode: 'ai', participantCount: 2, placement: 1, result: 'win' });
  const unsupportedReward = reward(profile(), { gameId, mode: 'legacy', eligible: false, blockedReason: 'invalid_mode' });
  check(gameId + ' 奖励模式严格区分联机/AI',
    onlineReward.currency === (multiplayerGame ? 4 : 3) && aiReward.currency === 1 && aiReward.xp === 8 &&
    unsupportedReward.currency === 0 && unsupportedReward.xp === 0 && unsupportedReward.blockedReason === 'invalid_mode');
}

check('等级曲线 Lv1→Lv2 需要 35 XP', xpRequiredForNextLevel(1) === 35 && xpForLevel(2) === 35);
check('等级曲线 Lv34+ 每级封顶 200 XP', xpRequiredForNextLevel(34) === 200 && xpRequiredForNextLevel(80) === 200);
check('累计 XP 与等级边界一致', levelFromXp(34) === 1 && levelFromXp(35) === 2 && levelFromXp(xpForLevel(20)) === 20);

const eligible = evaluateEligibility({
  gameId: 'gomoku', mode: 'online', matchId: 'm', resultId: 'r', identitiesValid: true,
  consensusValid: true, durationMs: 15000, meaningfulActions: 9, uniqueActions: 8, distinctActors: 2,
});
const tooShort = evaluateEligibility({
  gameId: 'gomoku', mode: 'online', matchId: 'm', resultId: 'r', identitiesValid: true,
  consensusValid: true, durationMs: 100, meaningfulActions: 9, uniqueActions: 8, distinctActors: 2,
});
check('有效比赛校验同时检查时间、操作和参与者', eligible.eligible === true && tooShort.blockedReason === 'match_too_short');

const firstUser = profile();
const firstWin = reward(firstUser);
check('联机 1v1 今日首胜为 5💵 / 17 XP', firstWin.currency === 5 && firstWin.xp === 17 && firstWin.dailyFirstWinGranted === true, JSON.stringify(firstWin));
applyReward(firstUser, firstWin);
const secondWin = reward(firstUser);
check('同日第二次联机胜利为 3💵 / 12 XP', secondWin.currency === 3 && secondWin.xp === 12 && !secondWin.dailyFirstWinGranted);
applyReward(firstUser, secondWin);
const thirdWin = reward(firstUser);
check('3 连胜只增加 +2 XP', thirdWin.currency === 3 && thirdWin.xp === 14 && thirdWin.streakAfter === 3);

const draw = reward(profile({ dailyFirstWinDate: '2026-08-07' }), { result: 'draw', placement: 1 });
const loss = reward(profile({ dailyFirstWinDate: '2026-08-07' }), { result: 'loss', placement: 2 });
check('联机 1v1 平局为 2💵 / 10 XP', draw.currency === 2 && draw.xp === 10);
check('联机 1v1 失败仍有 1💵 / 8 XP', loss.currency === 1 && loss.xp === 8);

const multi = [1, 2, 3, 4].map(placement => reward(profile({ dailyFirstWinDate: '2026-08-07' }), {
  gameId: 'monopoly', participantCount: 4, placement, result: placement === 1 ? 'win' : 'loss',
}));
check('多人名次奖励为 4/3/2/1💵 与 14/12/10/8 XP',
  JSON.stringify(multi.map(item => [item.currency, item.xp])) === JSON.stringify([[4,14],[3,12],[2,10],[1,8]]));
const validRanks = normalizeRoomResults([
  { slot: 2, coins: 0, rank: 3 }, { slot: 0, coins: 1, rank: 1 }, { slot: 1, coins: 0, rank: 2 },
], 3);
const forgedRanks = normalizeRoomResults([
  { slot: 0, coins: 1, rank: 1 }, { slot: 1, coins: 0, rank: 1 }, { slot: 2, coins: 0, rank: 1 },
], 3);
const validDraw = normalizeRoomResults([{ slot: 0, coins: 0, rank: 1 }, { slot: 1, coins: 0, rank: 1 }], 2);
check('多人结算只接受唯一 1..N 名次，1v1 仍允许合法平局', !!validRanks && forgedRanks === null && !!validDraw);

const repeat11 = reward(profile({ dailyFirstWinDate: '2026-08-07' }), { repeatCount24h: 10 });
const repeat21 = reward(profile({ dailyFirstWinDate: '2026-08-07' }), { repeatCount24h: 20 });
check('第 11–20 场重复对手货币减半并向下取整', repeat11.currency === 1 && repeat11.xp === 12 && repeat11.repeatTier === 'reduced');
check('第 21 场起重复对手货币为 0、XP 为 50%', repeat21.currency === 0 && repeat21.xp === 6 && repeat21.repeatTier === 'exhausted');

const aiUser = profile({ dailyAICurrencyKey: '2026-08-07', dailyAICurrencyEarned: 2 });
const aiThird = reward(aiUser, { mode: 'ai', result: 'win', repeatCount24h: 0 });
applyReward(aiUser, aiThird);
const aiCapped = reward(aiUser, { mode: 'ai', result: 'win', repeatCount24h: 0 });
check('AI 胜利为 1💵 / 8 XP，且每日最多 3💵', aiThird.currency === 1 && aiThird.xp === 8 && aiCapped.currency === 0 && aiCapped.xp === 8);
const aiDraw = reward(profile(), { mode: 'ai', result: 'draw' });
const aiLoss = reward(profile(), { mode: 'ai', result: 'loss' });
check('AI 平/负分别为 0💵/6 XP、0💵/5 XP', aiDraw.currency === 0 && aiDraw.xp === 6 && aiLoss.currency === 0 && aiLoss.xp === 5);

const blocked = reward(profile(), { eligible: false, blockedReason: 'insufficient_actions' });
const afk = reward(profile({ streak: 4, bestStreak: 4 }), { eligible: false, blockedReason: 'afk' });
check('无效局奖励与 XP 均为 0', blocked.currency === 0 && blocked.xp === 0 && blocked.blockedReason === 'insufficient_actions');
check('AFK 不获失败奖励并中断联机连胜', afk.currency === 0 && afk.xp === 0 && afk.streakAfter === 0);

const levelUser = profile({ xp: xpForLevel(5) - 1, level: 4, dailyFirstWinDate: '2026-08-07' });
const levelUp = reward(levelUser, { mode: 'online', result: 'loss', placement: 2 });
check('跨越每 5 级里程碑额外获得 5💵', levelUp.levelAfter >= 5 && levelUp.currency === 6 &&
  levelUp.breakdown.some(item => item.code === 'level_milestone' && item.currency === 5));

if (failures.length){
  console.error('REWARD_SYSTEM_FAILED (' + failures.length + ' failures)');
  process.exitCode = 1;
} else {
  console.log('REWARD_SYSTEM_ALL_PASS');
}
