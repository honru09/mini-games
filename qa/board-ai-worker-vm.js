'use strict';

/* T4 classic-worker wire contract with a same-origin importScripts VM. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const KERNEL_PATH = path.join(ROOT, 'public', 'src', 'core', '18-board-ai-kernel.js');
const WORKER_PATH = path.join(ROOT, 'public', 'workers', 'board-ai-worker-v1.js');
const Kernel = require(KERNEL_PATH);
const workerSource = fs.readFileSync(WORKER_PATH, 'utf8');
const kernelSource = fs.readFileSync(KERNEL_PATH, 'utf8');
const failures = [];

function check(name, condition, detail) {
  try { assert.ok(condition, detail || name); console.log('PASS  ' + name); }
  catch (error) { failures.push(name); console.log('FAIL  ' + name + (detail ? ' :: ' + detail : ' :: ' + error.message)); }
}

function position() {
  const rows = Array.from({ length: 15 }, () => Array(15).fill('.'));
  rows[7][3] = '0'; rows[7][4] = '0'; rows[7][5] = '0'; rows[7][6] = '0';
  rows[0][0] = '1'; rows[0][1] = '1'; rows[1][1] = '1'; rows[2][2] = '1';
  return { board: rows.map(row => row.join('')).join('/'), last: '2,2', moves: 8 };
}

function createHarness() {
  const sent = [];
  const sandbox = {
    console,
    Object, Array, String, Number, Boolean, Math, Date, Map, Set, JSON, RegExp,
    Uint32Array, Error, TypeError, RangeError,
    postMessage(value) { sent.push(JSON.parse(JSON.stringify(value))); },
    importScripts(value) {
      if (value !== '../src/core/18-board-ai-kernel.js') throw new Error('unexpected import ' + value);
      vm.runInContext(kernelSource, context, { filename: '18-board-ai-kernel.js' });
    },
  };
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(workerSource, context, { filename: 'board-ai-worker-v1.js' });
  return { sent, context };
}

check('worker uses fixed wire identifiers', /BOARD_AI_SEARCH_V1/.test(workerSource) && /BOARD_AI_CANCEL_V1/.test(workerSource) && /BOARD_AI_RESULT_V1/.test(workerSource));
check('worker imports only the same-origin kernel', /importScripts\('\.\.\/src\/core\/18-board-ai-kernel\.js'\)/.test(workerSource));
check('worker has no DOM, network, storage, dynamic-code, or forbidden-domain dependency', !/\b(?:document|window|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|eval|Function|token|uid|chat|reward|replay)\b/i.test(workerSource));

const harness = createHarness();
const value = position();
const hash = Kernel.hashPosition('gomoku', 'gomoku-local-v1', value, 0);
harness.context.onmessage({ data: {
  type: 'BOARD_AI_SEARCH_V1',
  payload: {
    requestId: 'vm-search-1', gameId: 'gomoku', rulesVersion: 'gomoku-local-v1', solverVersion: Kernel.SOLVER_VERSION,
    identity: 'opaque-scope', matchGeneration: 9, turn: 0, positionHash: hash, position: value,
    legalCandidates: ['7,7', '6,7', '8,7'], difficulty: 'hard', budgetMs: 500,
  }
} });
const result = harness.sent.pop();
check('worker emits one result message', result && result.type === 'BOARD_AI_RESULT_V1');
check('worker echoes the request binding', result && result.requestId === 'vm-search-1' && result.gameId === 'gomoku' && result.rulesVersion === 'gomoku-local-v1' && result.solverVersion === Kernel.SOLVER_VERSION && result.matchGeneration === 9 && result.turn === 0 && result.positionHash === hash);
check('worker result is candidate-id-only and chooses the winning point', result && result.ok === true && result.choiceId === '7,7' && result.ranked[0].id === '7,7' && result.ranked.every(row => Object.keys(row).sort().join(',') === 'id,score' && Number.isFinite(row.score)));

harness.context.onmessage({ data: { type: 'BOARD_AI_CANCEL_V1', requestId: 'vm-cancel-1' } });
harness.context.onmessage({ data: {
  type: 'BOARD_AI_SEARCH_V1',
  payload: {
    requestId: 'vm-cancel-1', gameId: 'gomoku', rulesVersion: 'gomoku-local-v1', solverVersion: Kernel.SOLVER_VERSION,
    identity: 'opaque-scope', matchGeneration: 9, turn: 0, positionHash: hash, position: value,
    legalCandidates: ['7,7'], difficulty: 'normal', budgetMs: 500,
  }
} });
const cancelled = harness.sent.pop();
check('pre-cancelled request fails closed', cancelled && cancelled.ok === false && cancelled.reason === 'cancelled' && cancelled.requestId === 'vm-cancel-1');

harness.context.onmessage({ data: { type: 'BOARD_AI_SEARCH_V1', payload: { requestId: 'bad' } } });
const malformed = harness.sent.pop();
check('malformed wire payload fails closed', malformed && malformed.type === 'BOARD_AI_RESULT_V1' && malformed.ok === false && malformed.reason === 'invalid_request');

if (failures.length) {
  console.error('BOARD_AI_WORKER_VM_HAS_FAILURES=' + failures.length);
  process.exitCode = 1;
} else {
  console.log('BOARD_AI_WORKER_VM_ALL_PASS');
}
