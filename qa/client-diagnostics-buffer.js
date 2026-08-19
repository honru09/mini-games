#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'public', 'src', 'core', '13-client-diagnostics-ring.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const ClientDiagnosticsRing = require(MODULE_PATH);
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

function protocolRecord(overrides) {
  return Object.assign({
    type: 'protocol_error',
    gameId: 'tank',
    reason: 'version_mismatch',
    protocol: 'tank-authority-v1',
    revision: 7,
    sequence: 9,
    baseRevision: 5,
    status: 400,
    matchId: 'match-secret-123',
    roomId: 'room-secret-456',
    playerId: 'player-secret-789',
    requestId: 'request-secret-abc'
  }, overrides || {});
}

check('UMD/CommonJS module exposes only the create seam', () => {
  exactKeys(ClientDiagnosticsRing, ['create']);
  assert.strictEqual(typeof ClientDiagnosticsRing.create, 'function');
  assert(Object.isFrozen(ClientDiagnosticsRing));
});

check('browser-global UMD export has the same narrow seam', () => {
  const context = vm.createContext({ globalThis: {}, Object, Set, Math, Date });
  vm.runInContext(SOURCE, context, { filename: '13-client-diagnostics-ring.js' });
  const browserApi = vm.runInContext('globalThis.ClientDiagnosticsRing', context);
  assert(browserApi);
  exactKeys(browserApi, ['create']);
  const ring = browserApi.create({ enabled: true });
  exactKeys(ring, ['clear', 'dispose', 'record', 'snapshot']);
});

check('instances are default-off and expose the fixed local envelope shape', () => {
  const ring = ClientDiagnosticsRing.create();
  exactKeys(ring, ['clear', 'dispose', 'record', 'snapshot']);
  const before = ring.snapshot();
  assert.deepStrictEqual(before, {
    status: 'disabled', enabled: false, capacity: 64, retentionMs: 300000, size: 0, records: []
  });
  assert(Object.isFrozen(before) && Object.isFrozen(before.records));
  assert.deepStrictEqual(ring.record(protocolRecord()), { accepted: false, reason: 'disabled' });
  assert.strictEqual(ring.snapshot().size, 0);
});

check('enabled rings retain only allowlisted, categorical, detached envelopes', () => {
  let time = 1000;
  const ring = ClientDiagnosticsRing.create({ enabled: true, now: () => time });
  const input = protocolRecord();
  const result = ring.record(input);
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.reason, null);
  assert(Object.isFrozen(result) && Object.isFrozen(result.record));
  assert.deepStrictEqual(result.record, {
    at: 1000,
    type: 'protocol_error',
    game: 'tank',
    reason: 'version_mismatch',
    protocol: 'tank-authority-v1',
    revision: 7,
    sequence: 9,
    baseRevision: 5,
    status: 400,
    match: result.record.match,
    room: result.record.room,
    player: result.record.player,
    request: result.record.request
  });
  ['match', 'room', 'player', 'request'].forEach(key => assert.match(result.record[key], /^[a-z]+-[0-9a-f]{16}$/));
  const rendered = JSON.stringify(ring.snapshot());
  ['match-secret-123', 'room-secret-456', 'player-secret-789', 'request-secret-abc'].forEach(raw => {
    assert(!rendered.includes(raw));
  });
  assert(!Object.prototype.hasOwnProperty.call(result.record, 'matchId'));
  input.gameId = 'gomoku';
  input.matchId = 'changed-later';
  assert.strictEqual(ring.snapshot().records[0].game, 'tank');
  time += 1;
  const repeated = ring.record(protocolRecord());
  assert.strictEqual(repeated.record.match, result.record.match);
});

check('only the three approved event types and categorical reasons are accepted', () => {
  const ring = ClientDiagnosticsRing.create({ enabled: true });
  assert.deepStrictEqual(ring.record(protocolRecord({ type: 'ordinary_log' })), { accepted: false, reason: 'unsupported_type' });
  assert.deepStrictEqual(ring.record(protocolRecord({ reason: 'free-form-user-copy' })), { accepted: false, reason: 'invalid_reason' });
  assert.deepStrictEqual(ring.record({
    type: 'unhandled_exception', gameId: 'platform', reason: 'type_error', errorCategory: 'type'
  }), { accepted: true, reason: null, record: ring.snapshot().records[0] });
  assert.strictEqual(ring.snapshot().records[0].error, 'type');
  assert.deepStrictEqual(ring.record(protocolRecord({ errorCategory: 'type' })), { accepted: false, reason: 'invalid_error_category' });
});

check('sensitive and unsupported fields fail closed without reaching the ring', () => {
  const ring = ClientDiagnosticsRing.create({ enabled: true });
  ['token', 'authToken', 'password', 'emailAddress', 'pin', 'prompt', 'url', 'body', 'text', 'content', 'message', 'stack', 'payload'].forEach(key => {
    const hostile = protocolRecord();
    hostile[key] = 'never-retain-this';
    assert.deepStrictEqual(ring.record(hostile), { accepted: false, reason: 'sensitive_field' });
  });
  const hiddenToken = protocolRecord();
  Object.defineProperty(hiddenToken, 'token', { value: 'never-retain-this', enumerable: false });
  assert.deepStrictEqual(ring.record(hiddenToken), { accepted: false, reason: 'sensitive_field' });
  const symbolField = protocolRecord();
  symbolField[Symbol('unapproved')] = 'never-retain-this';
  assert.deepStrictEqual(ring.record(symbolField), { accepted: false, reason: 'unsupported_field' });
  assert.deepStrictEqual(ring.record(protocolRecord({ debug: 'not-allowlisted' })), { accepted: false, reason: 'unsupported_field' });
  assert.deepStrictEqual(ring.record(protocolRecord({ matchId: '' })), { accepted: false, reason: 'invalid_identifier' });
  assert.deepStrictEqual(ring.record(protocolRecord({ revision: -1 })), { accepted: false, reason: 'invalid_number' });
  assert.strictEqual(ring.snapshot().size, 0);
});

check('protocol labels are bounded and remain categorical', () => {
  const ring = ClientDiagnosticsRing.create({ enabled: true });
  assert.strictEqual(ring.record(protocolRecord({ protocol: 'unknown' })).accepted, true);
  assert.deepStrictEqual(ring.record(protocolRecord({ protocol: 'a'.repeat(64) })), {
    accepted: false, reason: 'invalid_protocol'
  });
  assert.strictEqual(ring.snapshot().size, 1);
  assert.strictEqual(ring.snapshot().records[0].protocol, 'unknown');
});

check('the ring is a fixed FIFO of 64 records', () => {
  let time = 0;
  const ring = ClientDiagnosticsRing.create({ enabled: true, now: () => time });
  for (let index = 0; index < 70; index += 1) {
    assert.strictEqual(ring.record({ type: 'desync', reason: 'unknown', sequence: index }).accepted, true);
    time += 1;
  }
  const snapshot = ring.snapshot();
  assert.strictEqual(snapshot.capacity, 64);
  assert.strictEqual(snapshot.size, 64);
  assert.strictEqual(snapshot.records[0].sequence, 6);
  assert.strictEqual(snapshot.records[63].sequence, 69);
  assert(snapshot.records.every(Object.isFrozen));
});

check('records expire from transient memory after the fixed retention window', () => {
  let time = 0;
  const ring = ClientDiagnosticsRing.create({ enabled: true, now: () => time });
  assert.strictEqual(ring.record({ type: 'desync', reason: 'unknown' }).accepted, true);
  time = 300001;
  assert.strictEqual(ring.snapshot().size, 0);
});

check('clear and dispose erase local state and disposal is terminal', () => {
  const ring = ClientDiagnosticsRing.create({ enabled: true });
  ring.record({ type: 'desync', reason: 'unknown' });
  assert.deepStrictEqual(ring.clear(), { cleared: 1, status: 'enabled' });
  assert.strictEqual(ring.snapshot().size, 0);
  ring.record({ type: 'desync', reason: 'unknown' });
  const disposed = ring.dispose();
  assert.deepStrictEqual(disposed, {
    status: 'disposed', enabled: false, capacity: 64, retentionMs: 300000, size: 0, records: []
  });
  assert.deepStrictEqual(ring.record({ type: 'desync', reason: 'unknown' }), { accepted: false, reason: 'disposed' });
  assert.deepStrictEqual(ring.clear(), { cleared: 0, status: 'disposed' });
  assert.deepStrictEqual(ring.dispose(), disposed);
});

check('module has no transport, persistence, listener, or timer dependency', () => {
  [
    /\bfetch\b/i, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/,
    /indexedDB/, /addEventListener/, /setInterval/, /setTimeout/
  ].forEach(pattern => assert(!pattern.test(SOURCE), `forbidden dependency ${pattern}`));
});

if (failures) {
  console.error(`CLIENT_DIAGNOSTICS_BUFFER_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`CLIENT_DIAGNOSTICS_BUFFER_ALL_PASS assertions=${assertions}`);
}
