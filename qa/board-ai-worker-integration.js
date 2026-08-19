'use strict';

// Real Broker -> classic Worker VM -> shared Kernel integration.  The three
// dedicated unit suites can each pass while their wire shapes still drift;
// this test owns the cross-module seam.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const KERNEL_PATH = path.join(ROOT, 'public', 'src', 'core', '18-board-ai-kernel.js');
const BROKER_PATH = path.join(ROOT, 'public', 'src', 'core', '19-board-ai-worker-broker.js');
const WORKER_PATH = path.join(ROOT, 'public', 'workers', 'board-ai-worker-v1.js');
const kernelSource = fs.readFileSync(KERNEL_PATH, 'utf8');
const workerSource = fs.readFileSync(WORKER_PATH, 'utf8');
const Kernel = require(KERNEL_PATH);
const Broker = require(BROKER_PATH);

function copy(value) { return JSON.parse(JSON.stringify(value)); }

class VmWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    this.onmessageerror = null;
    this.terminated = false;
    const owner = this;
    const sandbox = {
      console,
      Object, Array, String, Number, Boolean, Math, Date, Map, Set, JSON, RegExp,
      Uint32Array, Error, TypeError, RangeError,
      importScripts(value) {
        if (value !== '../src/core/18-board-ai-kernel.js') throw new Error('unexpected import');
        vm.runInContext(kernelSource, context, { filename:'18-board-ai-kernel.js' });
      },
      postMessage(value) {
        if (!owner.terminated && typeof owner.onmessage === 'function') owner.onmessage({ data:copy(value) });
      },
    };
    sandbox.self = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(workerSource, context, { filename:'board-ai-worker-v1.js' });
    this.context = context;
  }
  postMessage(value) {
    if (this.terminated) throw new Error('terminated');
    this.context.onmessage({ data:copy(value) });
  }
  terminate() { this.terminated = true; }
}

function gomokuPosition() {
  const rows = Array.from({ length:15 }, () => Array(15).fill('.'));
  rows[7][3] = '0'; rows[7][4] = '0'; rows[7][5] = '0'; rows[7][6] = '0';
  rows[0][0] = '1'; rows[0][1] = '1'; rows[1][1] = '1'; rows[2][2] = '1';
  return { board:rows.map(row => row.join('')).join('/'), last:'2,2', moves:8 };
}

function request(id) {
  const position = gomokuPosition();
  return {
    requestId:id,
    gameId:'gomoku',
    rulesVersion:'gomoku-local-v1',
    solverVersion:Kernel.SOLVER_VERSION,
    identity:'opaque-match-scope',
    matchGeneration:3,
    turn:0,
    positionHash:Kernel.hashPosition('gomoku', 'gomoku-local-v1', position, 0),
    legalCandidates:['7,7', '6,7', '8,7'],
    difficulty:'hard',
    budgetMs:500,
    position,
  };
}

async function run() {
  let worker;
  let workerFactoryCalls = 0;
  let syncCalls = 0;
  const broker = Broker.create({
    enabled:true,
    workerOptIn:true,
    workerFactory() { workerFactoryCalls += 1; worker = new VmWorker(); return worker; },
    syncAdapter() { syncCalls += 1; return null; },
  });
  const result = await broker.request(request('integration-worker'));
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.source, 'worker');
  assert.strictEqual(result.choiceId, '7,7');
  assert.strictEqual(result.matchGeneration, 3);
  assert.strictEqual(syncCalls, 0);
  assert(worker && !worker.terminated, 'successful worker must remain available for the next turn');
  const reused = await broker.request(request('integration-worker-reuse'));
  assert.strictEqual(reused.ok, true);
  assert.strictEqual(workerFactoryCalls, 1, 'one game instance must reuse one healthy Worker');
  broker.dispose();
  assert.strictEqual(worker.terminated, true, 'dispose must terminate the retained Worker');

  const solver = Kernel.create();
  const fallbackBroker = Broker.create({
    enabled:true,
    workerOptIn:false,
    syncAdapter(input) {
      const solved = solver.solve(input);
      return solved.accepted ? { choiceId:solved.ranked[0].id, ranked:solved.ranked } : null;
    },
  });
  const fallback = await fallbackBroker.request(request('integration-sync'));
  assert.strictEqual(fallback.ok, true);
  assert.strictEqual(fallback.source, 'sync');
  assert.strictEqual(fallback.choiceId, '7,7');
  fallbackBroker.dispose();

  console.log('BOARD_AI_WORKER_INTEGRATION_ALL_PASS');
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
