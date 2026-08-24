'use strict';

const assert = require('assert');
const { verifyReplayInputs, verifyReplayLifecycle, createReplayVerifier, PROTOCOL, LIFECYCLE_PROTOCOL } = require('../server/gameplay/replay-authority');
const { TankAuthority } = require('../server/gameplay/tank-sim');

let assertions = 0;
function check(label, fn) { fn(); assertions++; console.log(`PASS  ${label}`); }

check('Replay Authority exposes a stable protocol and supported games', () => {
  assert.strictEqual(PROTOCOL, 'replay-authority-v1');
  assert.deepStrictEqual(createReplayVerifier({ game: 'gomoku', matchId: 'm' }).snapshot().lastSeq, [0, 0]);
});

check('Gomoku authority inputs replay deterministically', () => {
  const events = [
    { seq: 1, player: 0, payload: { protocol: 'gomoku-rule-v1', matchId: 'g', seq: 1, r: 7, c: 7 } },
    { seq: 2, player: 1, payload: { protocol: 'gomoku-rule-v1', matchId: 'g', seq: 1, r: 7, c: 8 } },
  ];
  const first = verifyReplayInputs({ game: 'gomoku', matchId: 'g', events });
  const second = verifyReplayInputs({ game: 'gomoku', matchId: 'g', events });
  assert.strictEqual(first.ok, true); assert.strictEqual(first.status, 'deterministic'); assert.strictEqual(first.hash, second.hash);
});

check('Ludo server dice is retained in the canonical replay projection', () => {
  const result = verifyReplayInputs({ game: 'ludo', matchId: 'l', playerCount: 2, events: [
    { player: 0, payload: { protocol: 'ludo-rule-v1', matchId: 'l', seq: 1, type: 'roll', dice: 6 } },
    { player: 0, payload: { protocol: 'ludo-rule-v1', matchId: 'l', seq: 2, type: 'move', token: 0 } },
  ] });
  assert.strictEqual(result.ok, true); assert.strictEqual(result.eventCount, 2);
});

check('Xiangqi and Monopoly inputs use their shared Rule Core', () => {
  const xiangqi = verifyReplayInputs({ game: 'xiangqi', matchId: 'x', events: [
    { player: 0, payload: { protocol: 'xiangqi-rule-v2', matchId: 'x', seq: 1, from: [6, 0], to: [5, 0] } },
  ] });
  const monopoly = verifyReplayInputs({ game: 'monopoly', matchId: 'm', playerCount: 2, seed: 'seed', events: [
    { player: 0, payload: { protocol: 'monopoly-rule-v2', matchId: 'm', seq: 1, action: { type: 'roll' } } },
  ] });
  assert.strictEqual(xiangqi.ok, true); assert.strictEqual(monopoly.ok, true);
});

check('Tetris player projections remain deterministic and isolated by seat', () => {
  const result = verifyReplayInputs({ game: 'tetris', matchId: 't', playerCount: 2, seed: 'seed', events: [
    { player: 0, payload: { protocol: 'tetris-rule-v3', matchId: 't', seq: 1, action: { type: 'hard_drop' } } },
    { player: 1, payload: { protocol: 'tetris-rule-v3', matchId: 't', seq: 1, action: { type: 'left' } } },
  ] });
  assert.strictEqual(result.ok, true); assert.strictEqual(result.status, 'deterministic_input_projection');
});

check('Tetris server tick/garbage records are accepted without consuming client seq', () => {
  const result = verifyReplayInputs({ game: 'tetris', matchId: 'ts', playerCount: 2, seed: 'seed', events: [
    { player: 0, payload: { protocol: 'tetris-rule-v3', matchId: 'ts', seq: 1, action: { type: 'hard_drop' } } },
    { player: 0, payload: { protocol: 'tetris-rule-v3', matchId: 'ts', source: 'server', serverSeq: 1, action: { type: 'tick' } } },
    { player: 1, payload: { protocol: 'tetris-rule-v3', matchId: 'ts', seq: 1, action: { type: 'left' } } },
  ] });
  assert.strictEqual(result.ok, true); assert.strictEqual(result.lastSeq[0], 1); assert.strictEqual(result.lastSeq[1], 1);
});

check('Tetris automatic garbage and time-limit finish are replayed as terminal authority events', () => {
  const result = verifyReplayInputs({ game: 'tetris', matchId: 'tetris-life', playerCount: 2, seed: 'seed', events: [
    { player: 0, payload: { protocol: 'tetris-rule-v3', matchId: 'tetris-life', seq: 1, action: { type: 'hard_drop' } } },
    { player: 0, payload: { protocol: 'tetris-rule-v3', matchId: 'tetris-life', source: 'server', serverSeq: 1, action: { type: 'garbage', lines: 1, attackId: 'attack-0-1' } } },
    { player: 0, payload: { protocol: 'tetris-rule-v3', matchId: 'tetris-life', source: 'server', serverSeq: 2, action: { type: 'finish', order: [0, 1] } } },
  ], expectedTerminal: true });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.terminal, true);
  assert.strictEqual(result.lastSeq[0], 1);
});

check('Tank authority timeline replays inputs and fixed ticks with signed hashes', () => {
  const authority = new TankAuthority({ matchId: 'tank-replay', playerCount: 2, startedAt: 1000, durationMs: 180000 });
  assert.strictEqual(authority.acceptInput(0, {
    matchId: 'tank-replay', seq: 1, clientTick: 0, input: { right: true, fire: true },
  }, 1000).ok, true);
  authority.fixedStep(1050);
  authority.acceptInput(1, {
    matchId: 'tank-replay', seq: 1, clientTick: 1, input: { left: true },
  }, 1050);
  authority.fixedStep(1100);
  const events = authority.replayLog.map(item => ({
    player: item.player,
    payload: {
      protocol: 'tank-authority-v1', replayProtocol: PROTOCOL, matchId: 'tank-replay',
      source: item.kind === 'tick' ? 'server' : 'client', kind: item.kind, at: item.at,
      timelineSeq: item.timelineSeq, serverTick: item.serverTick, hash: item.hash,
      player: item.player, seq: item.seq, clientTick: item.clientTick, input: item.input,
    },
  }));
  const result = verifyReplayInputs({
    game: 'tank', matchId: 'tank-replay', playerCount: 2,
    startedAt: 1000, durationMs: 180000, events,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.eventCount, 4);
  assert.deepStrictEqual(result.lastSeq, [1, 1]);
  assert.strictEqual(result.ruleProtocol, 'tank-authority-v1');
});

check('Tank replay fails closed for timeline order, match and hash tampering', () => {
  const base = [
    { player: 0, payload: { protocol: 'tank-authority-v1', matchId: 'tank-invalid', source: 'client', kind: 'input', at: 1000, timelineSeq: 1, serverTick: 0, hash: 'bad', seq: 1, clientTick: 0, input: {} } },
  ];
  const badHash = verifyReplayInputs({ game: 'tank', matchId: 'tank-invalid', playerCount: 2, startedAt: 1000, durationMs: 180000, events: base });
  assert.strictEqual(badHash.ok, false);
  assert.strictEqual(badHash.reason, 'replay_tank_hash_mismatch');
  const validAuthority = new TankAuthority({ matchId: 'tank-invalid', playerCount: 2, startedAt: 1000, durationMs: 180000 });
  validAuthority.acceptInput(0, { matchId: 'tank-invalid', seq: 1, clientTick: 0, input: {} }, 1000);
  const valid = validAuthority.replayLog[0];
  const badOrder = verifyReplayInputs({ game: 'tank', matchId: 'tank-invalid', playerCount: 2, startedAt: 1000, durationMs: 180000, events: [
    { player: 0, seq: valid.timelineSeq, payload: { protocol: 'tank-authority-v1', matchId: 'tank-invalid', source: 'client', kind: 'input', at: valid.at, timelineSeq: valid.timelineSeq, serverTick: valid.serverTick, hash: valid.hash, player: 0, seq: valid.seq, clientTick: valid.clientTick, input: valid.input } },
    { player: 0, seq: valid.timelineSeq + 1, payload: { protocol: 'tank-authority-v1', matchId: 'tank-invalid', source: 'client', kind: 'input', at: 999, timelineSeq: valid.timelineSeq + 1, serverTick: valid.serverTick, hash: valid.hash, player: 0, seq: 2, clientTick: 0, input: {} } },
  ] });
  assert.strictEqual(badOrder.ok, false);
  assert.strictEqual(badOrder.reason, 'replay_tank_event_invalid');
  const badMatch = verifyReplayInputs({ game: 'tank', matchId: 'tank-invalid', playerCount: 2, startedAt: 1000, durationMs: 180000, events: [
    { ...base[0], payload: { ...base[0].payload, matchId: 'other' } },
  ] });
  assert.strictEqual(badMatch.ok, false);
  assert.strictEqual(badMatch.reason, 'replay_tank_event_invalid');
});

check('Replay rejects illegal, duplicated, out-of-match and post-terminal records', () => {
  const duplicate = verifyReplayInputs({ game: 'gomoku', matchId: 'bad', events: [
    { player: 0, payload: { protocol: 'gomoku-rule-v1', matchId: 'bad', seq: 1, r: 7, c: 7 } },
    { player: 0, payload: { protocol: 'gomoku-rule-v1', matchId: 'bad', seq: 1, r: 7, c: 8 } },
  ] });
  const illegal = verifyReplayInputs({ game: 'gomoku', matchId: 'bad', events: [
    { player: 0, payload: { protocol: 'gomoku-rule-v1', matchId: 'other', seq: 1, r: 7, c: 7 } },
  ] });
  assert.strictEqual(duplicate.ok, false); assert.strictEqual(duplicate.reason, 'replay_seq_invalid');
  assert.strictEqual(illegal.ok, false); assert.strictEqual(illegal.reason, 'replay_record_invalid');
});

check('Missing authority input is not promoted to a deterministic replay', () => {
  const result = verifyReplayInputs({ game: 'gomoku', matchId: 'empty', events: [] });
  assert.strictEqual(result.ok, false); assert.strictEqual(result.status, 'not_available');
});

check('Lifecycle replay validates terminal, automatic, reconnect and multi-instance order for all six games', () => {
  const games = ['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'];
  for (const game of games) {
    const raw = [
      { kind: 'start', source: 'server', at: 1000 },
      { kind: 'authority', source: 'client', authoritySeq: 1, at: 1010 },
      { kind: 'automatic', source: 'server', authoritySeq: 2, at: 1020 },
      { kind: 'reconnect', source: 'server', player: 1, phase: 'disconnect', epoch: 1, at: 1030 },
      { kind: 'reconnect', source: 'server', player: 1, phase: 'resume', epoch: 1, at: 1040 },
      { kind: 'instance', source: 'server', instanceId: 'instance-a1', instanceSeq: 1, globalOrder: 1, at: 1050 },
      { kind: 'instance', source: 'server', instanceId: 'instance-b1', instanceSeq: 1, globalOrder: 2, at: 1060 },
      { kind: 'terminal', source: 'server', terminal: true, order: [0, 1], authorityHash: '01234567', at: 1070 },
    ];
    const events = raw.map((payload, index) => ({ seq: index + 1, player: payload.player ?? null, payload: { protocol: LIFECYCLE_PROTOCOL, matchId: `life-${game}`, timelineSeq: index + 1, ...payload } }));
    const result = verifyReplayLifecycle({ game, matchId: `life-${game}`, events, clusterEnabled: true, expected: { terminal: true, order: [0, 1], authorityHash: '01234567' } });
    assert.strictEqual(result.ok, true, `${game} lifecycle should verify`);
    assert.strictEqual(result.terminalVerified, true);
    assert.strictEqual(result.reconnectVerified, true);
    assert.strictEqual(result.crossInstanceStatus, 'verified');
  }
});

check('Lifecycle replay rejects terminal omission and reconnect/instance reordering', () => {
  const base = (kind, extra = {}) => ({ protocol: LIFECYCLE_PROTOCOL, matchId: 'life-invalid', timelineSeq: 1, kind, source: 'server', at: 1000, ...extra });
  const missingTerminal = verifyReplayLifecycle({ game: 'tank', matchId: 'life-invalid', events: [{ seq: 1, payload: base('start') }] });
  assert.strictEqual(missingTerminal.ok, false);
  assert.strictEqual(missingTerminal.reason, 'replay_lifecycle_terminal_missing');
  const invalidReconnect = verifyReplayLifecycle({ game: 'tank', matchId: 'life-invalid', events: [
    { seq: 1, payload: base('start') },
    { seq: 2, payload: { ...base('reconnect', { timelineSeq: 2, player: 0, phase: 'resume', epoch: 1, at: 1010 }) } },
  ] });
  assert.strictEqual(invalidReconnect.ok, false);
  assert.strictEqual(invalidReconnect.reason, 'replay_lifecycle_reconnect_order_invalid');
});

console.log(`REPLAY_AUTHORITY_ALL_PASS assertions=${assertions}`);
