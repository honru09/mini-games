#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'public', 'src', 'core', '16-gameplay-input-gate.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const GameplayInputGate = require(MODULE_PATH);
let failures = 0;
let assertions = 0;

function check(label, run) {
  assertions += 1;
  try {
    run();
    console.log(`PASS  ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${label} :: ${error && error.message || error}`);
  }
}

function exactKeys(value, expected) {
  assert.deepStrictEqual(Object.keys(value).sort(), expected.slice().sort());
}

let nextSequence = 0;

function tetrisIntent(generation, id, type, sequence) {
  return {
    gameId: 'tetris', generation, id, type: type || 'move_left',
    sequence: sequence === undefined ? nextSequence++ : sequence
  };
}

function tankIntent(generation, id, sequence, direction, firing) {
  return {
    gameId: 'tank', generation, id, sequence,
    type: 'control_state', direction, firing
  };
}

let nextMatchId = 0;

function resetSession(gate, gameId, extras) {
  return gate.reset(Object.assign({
    gameId,
    matchId: `match-${gameId}-${nextMatchId++}`,
    revision: 0
  }, extras || {}));
}

check('UMD/CommonJS exposes only the create seam', () => {
  exactKeys(GameplayInputGate, ['create']);
  assert.strictEqual(typeof GameplayInputGate.create, 'function');
  assert(Object.isFrozen(GameplayInputGate));
});

check('browser-global UMD export has the same narrow seam without platform reads', () => {
  const sandbox = { globalThis: {}, Object, Array, String, Math, Number, RegExp, Symbol, Date };
  Object.defineProperty(sandbox.globalThis, 'document', { get() { throw new Error('must not inspect platform state'); } });
  const context = vm.createContext(sandbox);
  vm.runInContext(SOURCE, context, { filename: '16-gameplay-input-gate.js' });
  const browserApi = vm.runInContext('globalThis.GameplayInputGate', context);
  assert(browserApi);
  exactKeys(browserApi, ['create']);
  const gate = browserApi.create({ now: () => 0, onIntent() {} });
  exactKeys(gate, ['dispose', 'flush', 'reset', 'submit']);
  const session = resetSession(gate, 'tetris');
  assert.strictEqual(gate.submit(tetrisIntent(session.generation, 'vm-1')).accepted, true);
  assert.strictEqual(gate.flush().delivered, 1);
});

check('the default gate is inert until reset explicitly opens a game generation', () => {
  const gate = GameplayInputGate.create();
  assert.deepStrictEqual(gate.submit(tetrisIntent(0, 'cold-1')), {
    accepted: false, reason: 'disabled', generation: 0
  });
  assert.deepStrictEqual(gate.flush(), {
    accepted: false, reason: 'disabled', generation: 0, delivered: 0, droppedExpired: 0
  });
  assert.strictEqual(gate.reset({ gameId: 'tetris' }).reason, 'invalid_match');
  assert.strictEqual(gate.reset({ gameId: 'tetris', matchId: 'match-no-revision' }).reason, 'invalid_revision');
  assert.strictEqual(resetSession(gate, 'tetris', { bufferMs: 49 }).reason, 'invalid_buffer');
  assert.strictEqual(resetSession(gate, 'tetris', { bufferMs: 101 }).reason, 'invalid_buffer');
  assert.strictEqual(resetSession(gate, 'tetris', { bufferMs: 50 }).bufferMs, 50);
});

check('Tetris intents preserve order inside the fixed 50-100ms buffer', () => {
  let time = 0;
  const received = [];
  const gate = GameplayInputGate.create({ now: () => time, onIntent: intent => received.push(intent), bufferMs: 75 });
  const session = resetSession(gate, 'tetris');
  assert.strictEqual(session.bufferMs, 75);
  const left = tetrisIntent(session.generation, 't-1', 'move_left');
  const rotate = tetrisIntent(session.generation, 't-2', 'rotate_cw');
  assert.strictEqual(gate.submit(left).accepted, true);
  assert.strictEqual(gate.submit(rotate).accepted, true);
  assert.strictEqual(gate.submit(Object.assign(tetrisIntent(session.generation, 'tetris-bad-direction', 'hard_drop', 10), { direction: 'left' })).reason, 'invalid_type');
  assert.strictEqual(gate.submit({ gameId: 'tetris', generation: session.generation, id: 'tetris-bad-fire', sequence: 11, type: 'hard_drop', firing: false }).reason, 'invalid_type');
  time = 75;
  assert.deepStrictEqual(gate.flush(), {
    accepted: true, reason: null, generation: session.generation, delivered: 2, droppedExpired: 0
  });
  assert.deepStrictEqual(received, [
    Object.assign({}, left, { matchId: session.matchId, revision: session.revision }),
    Object.assign({}, rotate, { matchId: session.matchId, revision: session.revision })
  ]);
  assert(received.every(Object.isFrozen));
});

check('Tank control_state preserves neutral, eight directions, and independent fire state', () => {
  const received = [];
  const gate = GameplayInputGate.create({ now: () => 0, onIntent: intent => received.push(intent) });
  const session = resetSession(gate, 'tank', { bufferMs: 100 });
  const states = [
    ['neutral', false], ['up', true], ['down', false], ['left', true], ['right', false],
    ['up_left', true], ['up_right', false], ['down_left', true], ['down_right', false]
  ];
  const intents = states.map(([direction, firing], sequence) =>
    tankIntent(session.generation, `tank-${sequence}`, sequence, direction, firing));
  intents.forEach(intent => assert.strictEqual(gate.submit(intent).accepted, true));
  assert.strictEqual(gate.submit(tankIntent(session.generation, 'tank-0', 9, 'neutral', false)).reason, 'duplicate');
  assert.strictEqual(gate.submit({ gameId: 'tank', generation: session.generation, id: 'tank-bad-1', sequence: 10, type: 'control_state', direction: 'northwest', firing: false }).reason, 'invalid_direction');
  assert.strictEqual(gate.submit({ gameId: 'tank', generation: session.generation, id: 'tank-bad-2', sequence: 11, type: 'control_state', direction: 'left', firing: 'yes' }).reason, 'invalid_firing');
  assert.strictEqual(gate.submit({ gameId: 'tank', generation: session.generation, id: 'tank-bad-3', sequence: 12, type: 'fire', direction: 'left', firing: true }).reason, 'invalid_type');
  assert.strictEqual(gate.submit({ gameId: 'tank', generation: session.generation, id: 'tank-bad-4', sequence: 13, type: 'control_state', direction: 'left', firing: true, raw: 'never' }).reason, 'unsupported_field');
  assert.strictEqual(gate.flush().delivered, 9);
  assert.deepStrictEqual(received, intents.map(intent => Object.assign({}, intent, {
    matchId: session.matchId, revision: session.revision
  })));
  assert(received.some(intent => intent.firing === true));
  assert(received.some(intent => intent.firing === false));

  const next = resetSession(gate, 'tank', { matchId: session.matchId, revision: session.revision + 1 });
  assert.strictEqual(gate.submit(tankIntent(session.generation, 'tank-old', 14, 'neutral', false)).reason, 'stale_generation');
  assert.strictEqual(gate.submit(tankIntent(next.generation, 'tank-new', 0, 'neutral', false)).accepted, true);

  let expiryTime = 0;
  const expiryGate = GameplayInputGate.create({ now: () => expiryTime, onIntent() {} });
  const expirySession = resetSession(expiryGate, 'tank', { bufferMs: 50 });
  expiryGate.submit(tankIntent(expirySession.generation, 'tank-expired', 0, 'down_right', true));
  expiryTime = 51;
  assert.strictEqual(expiryGate.flush().reason, 'expired');
});

check('duplicates, stale generations, invalid records, and expired intents fail closed', () => {
  let time = 0;
  const gate = GameplayInputGate.create({ now: () => time, onIntent() {} });
  const first = resetSession(gate, 'tetris', { bufferMs: 50 });
  assert.strictEqual(gate.submit(tetrisIntent(first.generation, 'same-1')).accepted, true);
  assert.strictEqual(gate.submit(tetrisIntent(first.generation, 'same-1')).reason, 'duplicate');
  assert.strictEqual(gate.submit({ gameId: 'tetris', generation: first.generation, id: 'bad-1', sequence: 20, type: 'move_left', key: 'ArrowLeft' }).reason, 'unsupported_field');
  assert.strictEqual(gate.submit({ gameId: 'tank', generation: first.generation, id: 'bad-2', sequence: 21, type: 'move' }).reason, 'wrong_game');
  assert.strictEqual(gate.submit(tetrisIntent(first.generation, 'ordered-1', 'move_left', 100)).accepted, true);
  assert.strictEqual(gate.submit(tetrisIntent(first.generation, 'reordered-1', 'move_left', 99)).reason, 'out_of_order');
  const second = resetSession(gate, 'tetris', { matchId: first.matchId, revision: first.revision + 1 });
  assert.strictEqual(gate.submit(tetrisIntent(first.generation, 'old-1')).reason, 'stale_generation');
  assert.strictEqual(gate.submit(tetrisIntent(second.generation, 'fresh-1')).accepted, true);
  time = 51;
  assert.deepStrictEqual(gate.flush(), {
    accepted: false, reason: 'expired', generation: second.generation, delivered: 0, droppedExpired: 1
  });
});

check('a fixed queue rejects overflow and reset clears queued work plus identity memory', () => {
  const delivered = [];
  const gate = GameplayInputGate.create({ now: () => 0, onIntent: intent => delivered.push(intent) });
  const session = resetSession(gate, 'tetris');
  for (let index = 0; index < 16; index += 1) {
    assert.strictEqual(gate.submit(tetrisIntent(session.generation, `q-${index}`)).accepted, true);
  }
  assert.strictEqual(gate.submit(tetrisIntent(session.generation, 'q-overflow')).reason, 'queue_full');
  const next = resetSession(gate, 'tetris');
  assert.strictEqual(next.cleared, 16);
  assert.strictEqual(gate.flush().delivered, 0);
  assert.strictEqual(gate.submit(tetrisIntent(next.generation, 'q-0')).accepted, true, 'reset permits a fresh generation to reuse local IDs');
  assert.strictEqual(gate.flush().delivered, 1);
  assert.strictEqual(delivered.length, 1);
});

check('the gate never observes hidden or reduced-motion state, so legal intents stay eligible', () => {
  const received = [];
  const gate = GameplayInputGate.create({ now: () => 0, onIntent: intent => received.push(intent) });
  const session = resetSession(gate, 'tetris');
  assert.strictEqual(gate.submit(tetrisIntent(session.generation, 'unaffected-1', 'hard_drop')).accepted, true);
  assert.strictEqual(gate.flush().delivered, 1);
  assert.strictEqual(received[0].type, 'hard_drop');
  [/document\s*\./, /matchMedia/, /visibilityState/, /navigator\s*\./].forEach(pattern => {
    assert(!pattern.test(SOURCE), `environment read ${pattern}`);
  });
});

check('a missing local adapter fails closed and never retains a replayable intent', () => {
  const gate = GameplayInputGate.create({ now: () => 0 });
  const session = resetSession(gate, 'tetris');
  assert.strictEqual(gate.submit(tetrisIntent(session.generation, 'no-adapter-1')).accepted, true);
  assert.deepStrictEqual(gate.flush(), {
    accepted: false, reason: 'no_adapter', generation: session.generation, delivered: 0, droppedExpired: 0
  });
  assert.strictEqual(gate.flush().delivered, 0);
});

check('adapter failures and lifecycle changes clear queued work without replaying it', () => {
  let gate;
  let calls = 0;
  gate = GameplayInputGate.create({
    now: () => 0,
    onIntent(intent) {
      calls += 1;
      if (intent.id === 'break-1') throw new Error('adapter failure');
    }
  });
  let session = resetSession(gate, 'tetris');
  gate.submit(tetrisIntent(session.generation, 'break-1'));
  gate.submit(tetrisIntent(session.generation, 'break-2'));
  assert.deepStrictEqual(gate.flush(), {
    accepted: false, reason: 'adapter_failed', generation: session.generation, delivered: 0, droppedExpired: 0
  });
  assert.strictEqual(calls, 1);
  assert.strictEqual(gate.flush().delivered, 0);

  const delivered = [];
  let changingGate;
  changingGate = GameplayInputGate.create({
    now: () => 0,
    onIntent(intent) {
      delivered.push(intent.id);
      resetSession(changingGate, 'tetris');
    }
  });
  session = resetSession(changingGate, 'tetris');
  changingGate.submit(tetrisIntent(session.generation, 'change-1'));
  changingGate.submit(tetrisIntent(session.generation, 'change-2'));
  assert.strictEqual(changingGate.flush().reason, 'generation_changed');
  assert.deepStrictEqual(delivered, ['change-1']);
});

check('dispose is terminal and the module has no persistence, transport, native listener, timer, or raw-device dependency', () => {
  const gate = GameplayInputGate.create({ now: () => 0, onIntent() {} });
  const session = resetSession(gate, 'tank');
  gate.submit(tankIntent(session.generation, 'dispose-1', 0, 'neutral', false));
  assert.deepStrictEqual(gate.dispose(), { status: 'disposed', generation: session.generation + 1, queued: 0 });
  assert.strictEqual(gate.submit(tankIntent(session.generation, 'dispose-2', 1, 'neutral', false)).reason, 'disposed');
  assert.strictEqual(resetSession(gate, 'tank').reason, 'disposed');
  [
    /\bfetch\b/i, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/,
    /addEventListener/, /removeEventListener/, /setInterval/, /setTimeout/, /KeyboardEvent/, /PointerEvent/, /TouchEvent/,
    /keyCode/, /clientX/, /clientY/, /pageX/, /pageY/, /movementX/, /movementY/
  ].forEach(pattern => assert(!pattern.test(SOURCE), `forbidden dependency ${pattern}`));
});

if (failures) {
  console.error(`GAMEPLAY_INPUT_GATE_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`GAMEPLAY_INPUT_GATE_ALL_PASS assertions=${assertions}`);
}
