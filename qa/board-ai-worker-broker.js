'use strict';

const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'public', 'src', 'core', '19-board-ai-worker-broker.js');
delete require.cache[require.resolve(MODULE_PATH)];
const BoardAIWorkerBroker = require(MODULE_PATH);

const failures = [];
function check(label, condition, detail) {
  if (condition) console.log('PASS  ' + label);
  else {
    failures.push(label + (detail ? ' :: ' + detail : ''));
    console.log('FAIL  ' + label + (detail ? ' :: ' + detail : ''));
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(overrides = {}) {
  return {
    requestId: 'request-' + (overrides.requestId || 'one'),
    gameId: overrides.gameId || 'xiangqi',
    rulesVersion: overrides.rulesVersion || 'xiangqi-rule-v2',
    solverVersion: overrides.solverVersion || 'board-ai-kernel-v1',
    identity: overrides.identity || 'opaque-local-scope',
    matchGeneration: overrides.matchGeneration === undefined ? 1 : overrides.matchGeneration,
    turn: overrides.turn === undefined ? 0 : overrides.turn,
    positionHash: overrides.positionHash || 'state-one',
    legalCandidates: overrides.legalCandidates || ['0,0>1,0', '0,1>1,1'],
    difficulty: overrides.difficulty || 'normal',
    budgetMs: overrides.budgetMs === undefined ? 30 : overrides.budgetMs,
    position: overrides.position === undefined ? { board: [['p']], current: 0 } : overrides.position,
    ...overrides
  };
}

function workerResult(input, overrides = {}) {
  return {
    type: 'BOARD_AI_RESULT_V1',
    ok: true,
    requestId: input.requestId,
    gameId: input.gameId,
    rulesVersion: input.rulesVersion,
    solverVersion: input.solverVersion,
    matchGeneration: input.matchGeneration,
    turn: input.turn,
    positionHash: input.positionHash,
    choiceId: input.legalCandidates[0],
    ranked: [{ id: input.legalCandidates[0], score: 1 }, { id: input.legalCandidates[1] || input.legalCandidates[0], score: 0 }],
    ...overrides
  };
}

class FakeWorker {
  constructor() {
    this.messages = [];
    this.terminated = false;
    this.onmessage = null;
    this.onerror = null;
    this.onmessageerror = null;
  }
  postMessage(message) {
    this.messages.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data) {
    if (typeof this.onmessage === 'function') this.onmessage({ data });
  }
  crash() {
    if (typeof this.onerror === 'function') this.onerror({ type: 'error' });
  }
  messageError() {
    if (typeof this.onmessageerror === 'function') this.onmessageerror({ type: 'messageerror' });
  }
}

function syncChoice(input, choiceId) {
  const selected = choiceId || input.legalCandidates[0];
  const ordered = [selected, ...input.legalCandidates.filter(id => id !== selected)].slice(0, 2);
  return {
    choiceId: selected,
    ranked: ordered.map((id, index) => ({ id, score: 10 - index }))
  };
}

async function run() {
  check('公开 Module 只暴露 create', Object.keys(BoardAIWorkerBroker).join(',') === 'create');

  let defaultFactoryCalls = 0;
  const defaultBroker = BoardAIWorkerBroker.create({
    workerFactory() { defaultFactoryCalls += 1; throw new Error('must remain unused'); },
    syncAdapter() { throw new Error('must remain unused'); }
  });
  check('实例 Interface 仅 request/cancel/dispose', Object.keys(defaultBroker).sort().join(',') === 'cancel,dispose,request');
  const disabled = await defaultBroker.request(request());
  check('默认关闭不创建 Worker', disabled.ok === false && disabled.reason === 'disabled' && defaultFactoryCalls === 0);
  check('默认关闭结果冻结', Object.isFrozen(disabled));

  const unsupported = await BoardAIWorkerBroker.create({ enabled: true }).request(request({ gameId: 'tetris' }));
  check('只允许象棋与五子棋', unsupported.ok === false && unsupported.reason === 'unsupported_game');

  const privacy = await BoardAIWorkerBroker.create({ enabled: true }).request(request({ token: 'forbidden' }));
  check('顶层敏感字段 fail-closed', privacy.ok === false && privacy.reason === 'privacy_rejected');
  const nestedPrivacy = await BoardAIWorkerBroker.create({ enabled: true }).request(request({ position: { sessionToken: 'forbidden' } }));
  check('局面内敏感字段 fail-closed', nestedPrivacy.ok === false && nestedPrivacy.reason === 'privacy_rejected');
  const nonRecordPosition = await BoardAIWorkerBroker.create({ enabled: true }).request(request({ position: [['not-a-record']] }));
  check('局面必须是规范 plain record', nonRecordPosition.ok === false && nonRecordPosition.reason === 'invalid_position');
  const duplicateCandidate = await BoardAIWorkerBroker.create({ enabled: true }).request(request({ legalCandidates: ['0,0>1,0', '0,0>1,0'] }));
  check('候选 ID 必须唯一', duplicateCandidate.ok === false && duplicateCandidate.reason === 'duplicate_candidate');
  const generationZeroBroker = BoardAIWorkerBroker.create({ enabled: true, workerOptIn: false, syncAdapter: syncChoice });
  const generationZero = await generationZeroBroker.request(request({ requestId: 'generation-zero', matchGeneration: 0 }));
  check('generation 0 identity is preserved exactly', generationZero.ok === true && generationZero.matchGeneration === 0);
  generationZeroBroker.dispose();

  let worker = new FakeWorker();
  let workerFactoryCalls = 0;
  let syncCalls = 0;
  const broker = BoardAIWorkerBroker.create({
    enabled: true,
    workerOptIn: true,
    workerFactory() { workerFactoryCalls += 1; return worker; },
    syncAdapter(input) { syncCalls += 1; return syncChoice(input); }
  });
  const firstInput = request();
  const firstPromise = broker.request(firstInput);
  check('显式开启后惰性创建一个 Worker', workerFactoryCalls === 1 && worker.messages.length === 1);
  check('固定 Worker 搜索 wire', worker.messages[0].type === 'BOARD_AI_SEARCH_V1' && worker.messages[0].payload && worker.messages[0].payload.requestId === firstInput.requestId && !Object.prototype.hasOwnProperty.call(worker.messages[0].payload, 'token'));
  const busy = await broker.request(request({ requestId: 'two' }));
  check('单活跃 ticket 拒绝并发请求', busy.ok === false && busy.reason === 'busy');
  worker.emit(workerResult(firstInput));
  const first = await firstPromise;
  check('Worker 返回严格身份与候选后成功', first.ok === true && first.source === 'worker' && first.choiceId === firstInput.legalCandidates[0] && first.ranked.length === 2);
  check('Worker 成功不调用同步 Adapter', syncCalls === 0);
  check('成功结果只含有限评分', first.ranked.every(item => Number.isFinite(item.score) && firstInput.legalCandidates.includes(item.id)));
  worker.emit(workerResult(firstInput));
  await delay(0);
  check('重复/迟到结果不会再次结算', syncCalls === 0);

  worker = new FakeWorker();
  syncCalls = 0;
  const identityBroker = BoardAIWorkerBroker.create({
    enabled: true, workerOptIn: true, workerFactory() { return worker; },
    syncAdapter(input) { syncCalls += 1; return syncChoice(input, input.legalCandidates[1]); }
  });
  const identityInput = request({ requestId: 'identity' });
  const identityPromise = identityBroker.request(identityInput);
  worker.emit(workerResult(identityInput, { positionHash: 'wrong-state' }));
  const identity = await identityPromise;
  check('响应身份不符时仅一次同步回退', identity.ok === true && identity.source === 'sync' && identity.choiceId === identityInput.legalCandidates[1] && syncCalls === 1);

  worker = new FakeWorker();
  syncCalls = 0;
  const missingTypeBroker = BoardAIWorkerBroker.create({
    enabled: true, workerOptIn: true, workerFactory() { return worker; },
    syncAdapter(input) { syncCalls += 1; return syncChoice(input); }
  });
  const missingTypeInput = request({ requestId: 'missing-type' });
  const missingTypePromise = missingTypeBroker.request(missingTypeInput);
  const missingTypeResult = workerResult(missingTypeInput);
  delete missingTypeResult.type;
  worker.emit(missingTypeResult);
  const missingType = await missingTypePromise;
  check('缺失固定 result type 时仅一次同步回退', missingType.ok === true && missingType.source === 'sync' && syncCalls === 1 && worker.terminated);

  worker = new FakeWorker();
  syncCalls = 0;
  const scoreBroker = BoardAIWorkerBroker.create({
    enabled: true, workerOptIn: true, workerFactory() { return worker; },
    syncAdapter(input) { syncCalls += 1; return syncChoice(input); }
  });
  const scoreInput = request({ requestId: 'score' });
  const scorePromise = scoreBroker.request(scoreInput);
  worker.emit(workerResult(scoreInput, { ranked: [{ id: scoreInput.legalCandidates[0], score: Infinity }] }));
  const score = await scorePromise;
  check('非有限评分 fail-closed 并回退', score.ok === true && score.source === 'sync' && syncCalls === 1);

  worker = new FakeWorker();
  syncCalls = 0;
  const unorderedBroker = BoardAIWorkerBroker.create({
    enabled: true, workerOptIn: true, workerFactory() { return worker; },
    syncAdapter(input) { syncCalls += 1; return syncChoice(input); }
  });
  const unorderedInput = request({ requestId: 'unordered' });
  const unorderedPromise = unorderedBroker.request(unorderedInput);
  worker.emit(workerResult(unorderedInput, { choiceId:unorderedInput.legalCandidates[1], ranked:[
    { id:unorderedInput.legalCandidates[1], score:0 },
    { id:unorderedInput.legalCandidates[0], score:10 }
  ] }));
  const unordered = await unorderedPromise;
  check('未按固定顺序返回的 ranked fail-closed 并仅回退一次', unordered.ok === true && unordered.source === 'sync' && unordered.choiceId === unorderedInput.legalCandidates[0] && syncCalls === 1 && worker.terminated);

  worker = new FakeWorker();
  syncCalls = 0;
  const crashBroker = BoardAIWorkerBroker.create({
    enabled: true, workerOptIn: true, workerFactory() { return worker; },
    syncAdapter(input) { syncCalls += 1; return syncChoice(input); }
  });
  const crashInput = request({ requestId: 'crash' });
  const crashPromise = crashBroker.request(crashInput);
  worker.crash();
  const crashed = await crashPromise;
  check('Worker crash 一次同步回退并终止 Worker', crashed.ok === true && crashed.source === 'sync' && syncCalls === 1 && worker.terminated);

  worker = new FakeWorker();
  syncCalls = 0;
  const messageErrorBroker = BoardAIWorkerBroker.create({
    enabled: true, workerOptIn: true, workerFactory() { return worker; },
    syncAdapter(input) { syncCalls += 1; return syncChoice(input); }
  });
  const messageErrorInput = request({ requestId: 'message-error' });
  const messageErrorPromise = messageErrorBroker.request(messageErrorInput);
  worker.messageError();
  const messageError = await messageErrorPromise;
  check('Worker messageerror 一次同步回退', messageError.ok === true && messageError.source === 'sync' && syncCalls === 1);

  worker = new FakeWorker();
  let timeoutSyncCalls = 0;
  const timeoutBroker = BoardAIWorkerBroker.create({
    enabled: true, workerOptIn: true, timeoutGraceMs: 1, workerFactory() { return worker; },
    syncAdapter(input) { timeoutSyncCalls += 1; return syncChoice(input); }
  });
  const timeoutInput = request({ requestId: 'timeout', budgetMs: 5 });
  const timed = await timeoutBroker.request(timeoutInput);
  check('超时终止 Worker 且仅一次同步回退', timed.ok === true && timed.source === 'sync' && timeoutSyncCalls === 1 && worker.terminated);

  worker = new FakeWorker();
  const cancelBroker = BoardAIWorkerBroker.create({
    enabled: true, workerOptIn: true, workerFactory() { return worker; },
    syncAdapter(input) { return syncChoice(input); }
  });
  const cancelInput = request({ requestId: 'cancel' });
  const cancelPromise = cancelBroker.request(cancelInput);
  const cancelled = cancelBroker.cancel(cancelInput.requestId);
  const cancelResult = await cancelPromise;
  worker.emit(workerResult(cancelInput));
  await delay(0);
  check('取消发送固定 cancel wire', cancelled === true && worker.messages.some(message => message.type === 'BOARD_AI_CANCEL_V1' && message.requestId === cancelInput.requestId));
  check('取消与迟到结果 fail-closed', cancelResult.ok === false && cancelResult.reason === 'cancelled' && worker.terminated);

  worker = new FakeWorker();
  const disposeBroker = BoardAIWorkerBroker.create({
    enabled: true, workerOptIn: true, workerFactory() { return worker; },
    syncAdapter(input) { return syncChoice(input); }
  });
  const disposeInput = request({ requestId: 'dispose' });
  const disposePromise = disposeBroker.request(disposeInput);
  const disposal = disposeBroker.dispose();
  const disposed = await disposePromise;
  check('dispose 清理活跃 ticket 与 Worker', disposal.status === 'disposed' && disposed.ok === false && disposed.reason === 'disposed' && worker.terminated);
  const afterDispose = await disposeBroker.request(request({ requestId: 'after-dispose' }));
  check('dispose 后不再接收请求', afterDispose.ok === false && afterDispose.reason === 'disposed');

  const failedFallback = await BoardAIWorkerBroker.create({
    enabled: true,
    syncAdapter() { throw new Error('intentional'); }
  }).request(request({ requestId: 'fallback-failed' }));
  check('同步 Adapter 抛错仍 resolve', failedFallback.ok === false && failedFallback.reason === 'fallback_failed');

  if (failures.length) {
    console.error('\nBOARD_AI_WORKER_BROKER_FAILURES\n' + failures.map(item => '- ' + item).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('BOARD_AI_WORKER_BROKER_ALL_PASS');
  }
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
