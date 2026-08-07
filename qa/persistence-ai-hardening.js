// P0 持久化/AI 确认协议静态契约回归。
// 行为级流程由 qa/ai-learning-online.js 与 qa/supabase-adapter.js 覆盖；
// 本脚本快速阻止关键安全边界被后续重构误删。
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');
const learning = fs.readFileSync(path.join(root, 'server', 'ai-learning.js'), 'utf8');
const utils = fs.readFileSync(path.join(root, 'public', 'src', 'core', '01-utils.js'), 'utf8');
const failures = [];
function check(name, condition){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name);
  if (!condition) failures.push(name);
}

check('普通档案同步使用 UID PATCH', /function sbSyncEditableProfile[\s\S]*method:\s*'PATCH'[\s\S]*profiles\?uid=eq\./.test(server));
check('普通档案 patch 不携带权威金币/成长字段', /function editableProfileDbRow[\s\S]*name_fx[\s\S]*function authProfileDbRow/.test(server) &&
  !/function sbSyncEditableProfile[\s\S]{0,1200}profileDbRow\(u\)/.test(server));
check('档案队列在出队时读取快照', /function sbProfileQueue[\s\S]*task 在真正出队时执行/.test(server) &&
  /function sbApplyRewardTransaction[\s\S]*sbProfileQueue\(uid, \(\) => \{[\s\S]*const profile = profileDbRow\(u\)/.test(server));
check('购买/奖励共用账号级串行队列', /sbApplyPurchaseTransaction[\s\S]*sbProfileQueue\(uid/.test(server) &&
  /sbApplyRewardTransaction[\s\S]*sbProfileQueue\(uid/.test(server));
check('AI API 不在建议返回时直接写学习决策', /function handleAI[\s\S]*const decisionId = null[\s\S]*recordAILearningDecision\(activeMatch/.test(server) === false);
check('AI 确认消息校验 match/result/decisionId', /function confirmSoloAIDecision[\s\S]*matchId[\s\S]*resultId[\s\S]*decisionId/.test(server));
check('AI 建议确认接口与 WebSocket 能力存在', /ai_decision_confirm/.test(server) && /ai_decision_confirm_v1/.test(server));
check('未确认 pending 在结算时清理', /未被客户端确认的 AI 建议全部丢弃/.test(server));
check('AI outbox 有周期重试与 revision 重基', /retryPendingAILearningSync\(\);/.test(server) &&
  /function rebasePendingAILearningGroup/.test(server) && /stale_ai_learning_revision/.test(server));
check('学习记录含 decisionId 幂等保护', /decisionId[\s\S]*confirmedAIDecisionIds/.test(learning));
check('客户端发送上下文并等待实际执行确认', /candidates:\s*learningCandidates,\s*context/.test(utils) &&
  /ai_decision_confirm/.test(utils) && /installAIConfirmationHooks/.test(utils));

if (failures.length){
  console.error('PERSISTENCE_AI_HARDENING_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('PERSISTENCE_AI_HARDENING_ALL_PASS');
}
