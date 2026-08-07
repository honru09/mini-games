// AI 持续学习单元回归：不联网、不启动服务，验证个性化经验库与防投毒边界。
'use strict';

const {
  normalizeStore, getModel, stateHash, chooseLearnedCandidate, recordDecision,
  applyMatchLearning, modelDbRow, experienceDbRow,
} = require('../server/ai-learning');

const failures = [];
function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

const store = normalizeStore();
const uid = 'u_ai_learning_qa';
const game = 'gomoku';
const state = { board: 'qa-board', turn: 1 };
const candidates = [
  { choice: 'safe', features: { safety: 1, aggression: 0 } },
  { choice: 'risky', features: { safety: 0, aggression: 1 } },
];

let pick = chooseLearnedCandidate(store, uid, game, state, ['safe', 'risky'], candidates, 'risky');
check('冷启动保持本地强策略优先', pick.choice === 'safe', JSON.stringify(pick));

const match = { completed: false, aiDecisions: [] };
const badDecision = {
  ...pick,
  choice: 'risky', localBest: 'safe', upstreamChoice: 'risky', optionRank: 1,
  candidateCount: 2, candidates,
};
recordDecision(match, badDecision);
const learned = applyMatchLearning(store, {
  uid, game, resultId: 'ai_result_learning_loss_1', matchId: 'ai_learning_match_1',
  humanResult: 'win', eligible: true, decisions: match.aiDecisions,
});
check('AI 失败会写入可训练经验', learned && !learned.duplicate && learned.experiences.length === 1 &&
  learned.experiences[0].aiOutcome === -1 && learned.experiences[0].usedForTraining === true);
check('失败后降低偏离本地最优的模型信任', learned.model.trust < 0.28, String(learned.model.trust));
check('失败状态记入错误记忆但不保存原始局面', learned.model.mistakes.length === 1 &&
  learned.model.mistakes[0].stateHash === stateHash(state) && !JSON.stringify(learned).includes('qa-board'));

pick = chooseLearnedCandidate(store, uid, game, state, ['safe', 'risky'], candidates, 'risky');
check('再次遇到同类状态会避开已知失败选择', pick.choice === 'safe' && pick.source !== 'deepseek+learned');

const beforeDuplicateRevision = learned.model.revision;
const duplicate = applyMatchLearning(store, {
  uid, game, resultId: 'ai_result_learning_loss_1', matchId: 'ai_learning_match_1',
  humanResult: 'win', eligible: true, decisions: match.aiDecisions,
});
check('相同 resultId 重放不重复训练', duplicate.duplicate === true && duplicate.model.revision === beforeDuplicateRevision);

const weightsBeforeInvalid = JSON.stringify(getModel(store, uid, game).weights);
const invalid = applyMatchLearning(store, {
  uid, game, resultId: 'ai_result_learning_invalid_2', matchId: 'ai_learning_match_2',
  humanResult: 'loss', eligible: false, decisions: match.aiDecisions,
});
check('无效/可疑对局只审计不更新策略权重', invalid && JSON.stringify(invalid.model.weights) === weightsBeforeInvalid &&
  invalid.experiences.every(row => row.usedForTraining === false));

const draw = applyMatchLearning(store, {
  uid, game, resultId: 'ai_result_learning_draw_3', matchId: 'ai_learning_match_3',
  humanResult: 'draw', eligible: true, decisions: match.aiDecisions,
});
check('平局进入经验库并作为中性反馈', draw && draw.experiences[0].aiOutcome === 0 && draw.model.stats.draws === 1);

const baselineStore = normalizeStore();
const baselineUid = 'u_ai_learning_baseline_qa';
const baselinePick = chooseLearnedCandidate(baselineStore, baselineUid, game, state, ['safe', 'risky'], candidates, null);
const baselineMatch = { completed: false, aiDecisions: [] };
recordDecision(baselineMatch, { ...baselinePick, candidateCount: 2 });
const baselineWin = applyMatchLearning(baselineStore, {
  uid: baselineUid, game, resultId: 'ai_result_baseline_win_4', matchId: 'ai_learning_match_4',
  humanResult: 'loss', eligible: true, decisions: baselineMatch.aiDecisions,
});
check('AI 选择本地第一候选获胜时仍会强化可泛化特征', baselineWin.model.weights.safety > 0 &&
  baselineWin.model.weights.aggression < 0 && baselineWin.model.stats.updates > 0,
  JSON.stringify(baselineWin.model.weights));

const baselineLossStore = normalizeStore();
const baselineLossUid = 'u_ai_learning_baseline_loss_qa';
const baselineLossPick = chooseLearnedCandidate(baselineLossStore, baselineLossUid, game, state, ['safe', 'risky'], candidates, null);
const baselineLossMatch = { completed: false, aiDecisions: [] };
recordDecision(baselineLossMatch, { ...baselineLossPick, candidateCount: 2 });
const baselineLoss = applyMatchLearning(baselineLossStore, {
  uid: baselineLossUid, game, resultId: 'ai_result_baseline_loss_5', matchId: 'ai_learning_match_5',
  humanResult: 'win', eligible: true, decisions: baselineLossMatch.aiDecisions,
});
check('AI 选择本地第一候选失败时会尝试近优反事实并形成错误记忆',
  baselineLoss.model.weights.safety < 0 && baselineLoss.model.weights.aggression > 0 &&
  baselineLoss.model.mistakes.some(item => item.choice === 'safe' && item.betterChoice === 'risky'),
  JSON.stringify({ weights:baselineLoss.model.weights, mistakes:baselineLoss.model.mistakes }));

const modelRow = modelDbRow(draw.model);
const experienceRow = experienceDbRow(draw.experiences[0]);
check('模型行包含版本、修订、权重、错误记忆与统计', modelRow.uid === uid && modelRow.game === game &&
  modelRow.revision >= 3 && modelRow.model_version === 'personal-linear-v2' && modelRow.skill_version &&
  modelRow.weights && modelRow.mistakes && modelRow.stats);
check('经验行使用 resultId+decisionIndex 幂等所需字段', experienceRow.result_id === 'ai_result_learning_draw_3' &&
  experienceRow.decision_index === 0 && /^[a-f0-9]{32}$/.test(experienceRow.state_hash));

if (failures.length){
  console.log('AI_LEARNING_HAS_FAILURES (' + failures.length + ')');
  process.exitCode = 1;
} else {
  console.log('AI_LEARNING_ALL_PASS');
}
