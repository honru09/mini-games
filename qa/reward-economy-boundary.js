#!/usr/bin/env node
'use strict';

/* Local contract for the Reward/Economy persistence + outbox seam. */

const assert = require('assert');
const boundaryModule = require('../server/boundaries/reward-economy');
const {
  PROTOCOL,
  createRewardEconomyBoundary,
  createMemoryRewardEconomyAdapter,
  createJsonRuntimeRewardEconomyAdapter,
} = boundaryModule;

let assertions = 0;
let failures = 0;

async function check(label, run) {
  assertions += 1;
  try {
    await run();
    console.log('PASS  ' + label);
  } catch (error) {
    failures += 1;
    console.error('FAIL  ' + label + ' :: ' + (error && error.message || error));
  }
}

function row(overrides = {}) {
  return {
    uid: 'alice', game: 'gomoku', coins: 1, xp: 8, at: 1700000000000,
    resultId: 'result_0001', matchId: 'match_0001', mode: 'ai', result: 'win', placement: 1,
    opponentIds: ['ai'], opponentKey: 'ai', durationMs: 12000, meaningfulActions: 4,
    eligible: true, blockedReason: null, baseCurrency: 1, baseXp: 8,
    rewardReasons: ['base_reward'], levelBefore: 1, levelAfter: 1, streakBefore: 0, streakAfter: 0,
    breakdown: [{ code: 'base_reward', currency: 1, xp: 8 }],
    reward: { version: '1.0', gameId: 'gomoku', mode: 'ai', result: 'win', currency: 1, xp: 8 },
    economyRow: { uid: 'alice', kind: 'match_reward', amount: 1, balanceAfter: 1, refId: 'result_0001', metadata: { game: 'gomoku' }, at: 1700000000000 },
    ...overrides,
  };
}

async function main() {
  await check('module exposes one protocol and the two Adapter constructors', () => {
    assert.strictEqual(PROTOCOL, 'reward-economy-v1');
    assert.strictEqual(typeof createRewardEconomyBoundary, 'function');
    assert.strictEqual(typeof createMemoryRewardEconomyAdapter, 'function');
    assert.strictEqual(typeof createJsonRuntimeRewardEconomyAdapter, 'function');
  });

  await check('memory Adapter detaches pending rows in both directions', () => {
    const source = { pendingRewardSync: [{ uid: 'alice', row: row(), queuedAt: 1 }] };
    const adapter = createMemoryRewardEconomyAdapter(source);
    source.pendingRewardSync[0].row.coins = 99;
    assert.strictEqual(adapter.load().pendingRewardSync[0].row.coins, 1);
    const loaded = adapter.load();
    loaded.pendingRewardSync[0].row.coins = 77;
    assert.strictEqual(adapter.load().pendingRewardSync[0].row.coins, 1);
  });

  await check('JSON Adapter preserves canonical and legacy pending shapes', () => {
    let runtime = { pending: [] };
    const canonical = createJsonRuntimeRewardEconomyAdapter({ shape: 'canonical', read: () => runtime, write: next => { runtime = next; } });
    canonical.save({ pendingRewardSync: [{ uid: 'alice', row: row(), queuedAt: 1 }] });
    assert.strictEqual(runtime.pending.length, 1);
    runtime = { pendingRewardSync: [{ uid: 'alice', row: row({ resultId: 'result_0002' }), queuedAt: 2 }] };
    const legacy = createJsonRuntimeRewardEconomyAdapter({ shape: 'legacy', read: () => runtime, write: next => { runtime = next; } });
    assert.strictEqual(legacy.load().pendingRewardSync[0].row.resultId, 'result_0002');
    legacy.save({ pendingRewardSync: [] });
    assert.deepStrictEqual(runtime.pendingRewardSync, []);
  });

  const adapter = createMemoryRewardEconomyAdapter();
  const remoteCalls = [];
  let remoteMode = 'ok';
  const boundary = createRewardEconomyBoundary({
    adapter,
    enabled: true,
    now: () => 1700000000100,
    isExcluded: uid => uid === 'admin' || uid === 'guest',
    remoteApply: async input => {
      remoteCalls.push({ uid: input.uid, resultId: input.row.resultId });
      if (remoteMode === 'fail') return false;
      if (remoteMode === 'duplicate') return { duplicate: true, resultId: input.row.resultId };
      return { applied: true, resultId: input.row.resultId };
    },
  });

  await check('boundary exposes only enqueue/retry/dispose', () => {
    assert.deepStrictEqual(Object.keys(boundary).sort(), ['dispose', 'enqueue', 'retry']);
    assert(Object.isFrozen(boundary));
  });

  await check('disabled and excluded actors are no-ops without outbox writes', async () => {
    const disabled = createRewardEconomyBoundary({ adapter: createMemoryRewardEconomyAdapter(), enabled: false });
    const skipped = await disabled.enqueue({ uid: 'alice', row: row() });
    assert(skipped.ok && skipped.skipped && skipped.reason === 'disabled');
    const admin = await boundary.enqueue({ uid: 'admin', user: { uid: 'admin' }, row: row({ uid: 'admin', resultId: 'admin_result' }) });
    const guest = await boundary.enqueue({ uid: 'guest', user: { uid: 'guest' }, row: row({ uid: 'guest', resultId: 'guest_result' }) });
    assert(admin.ok && admin.reason === 'excluded_actor' && guest.ok && guest.reason === 'excluded_actor');
    assert.strictEqual(adapter.load().pendingRewardSync.length, 0);
  });

  await check('enqueue persists before remote apply and clears on success', async () => {
    remoteMode = 'ok';
    const result = await boundary.enqueue({ uid: 'alice', user: { uid: 'alice' }, row: row() });
    assert(result.ok && result.synced === true && result.queued === false);
    assert.strictEqual(remoteCalls[0].resultId, 'result_0001');
    assert.strictEqual(adapter.load().pendingRewardSync.length, 0);
  });

  remoteMode = 'fail';
  await check('remote failure returns a stable reason and retains the outbox entry', async () => {
    const result = await boundary.enqueue({ uid: 'alice', user: { uid: 'alice' }, row: row({ resultId: 'result_fail' }) });
    assert.strictEqual(result.reason, 'server_unavailable');
    assert.strictEqual(result.queued, true);
    assert.strictEqual(adapter.load().pendingRewardSync.length, 1);
  });

  await check('same resultId retry is idempotent and does not duplicate pending rows', async () => {
    const again = await boundary.enqueue({ uid: 'alice', user: { uid: 'alice' }, row: row({ resultId: 'result_fail' }) });
    assert.strictEqual(again.reason, 'server_unavailable');
    assert.strictEqual(adapter.load().pendingRewardSync.length, 1);
    const conflict = await boundary.enqueue({ uid: 'alice', row: row({ resultId: 'result_fail', coins: 2 }) });
    assert.strictEqual(conflict.reason, 'idempotency_conflict');
  });

  await check('retry drains the same resultId after the remote recovers', async () => {
    remoteMode = 'ok';
    const result = await boundary.retry({ userResolver: () => ({ uid: 'alice' }) });
    assert(result.ok && result.attempted === 1 && result.synced === 1 && result.pending === 0);
    assert.strictEqual(adapter.load().pendingRewardSync.length, 0);
  });

  await check('remote duplicate is a successful terminal state', async () => {
    remoteMode = 'duplicate';
    const result = await boundary.enqueue({ uid: 'alice', row: row({ resultId: 'result_duplicate' }) });
    assert(result.ok && result.synced === true && result.duplicate === true);
    assert.strictEqual(adapter.load().pendingRewardSync.length, 0);
  });

  await check('same-account mutations serialize remote calls', async () => {
    remoteMode = 'ok';
    const order = [];
    const serialBoundary = createRewardEconomyBoundary({
      adapter: createMemoryRewardEconomyAdapter(),
      remoteApply: async ({ row: current }) => { order.push('start:' + current.resultId); await new Promise(resolve => setTimeout(resolve, 5)); order.push('end:' + current.resultId); return true; },
    });
    await Promise.all([
      serialBoundary.enqueue({ uid: 'alice', row: row({ resultId: 'result_a' }) }),
      serialBoundary.enqueue({ uid: 'alice', row: row({ resultId: 'result_b' }) }),
    ]);
    assert.deepStrictEqual(order, ['start:result_a', 'end:result_a', 'start:result_b', 'end:result_b']);
  });

  await check('malformed rows fail closed without retaining sensitive fields', async () => {
    const result = await boundary.enqueue({ uid: 'alice', row: { uid: 'alice', resultId: 'bad', token: 'secret' } });
    assert.strictEqual(result.reason, 'invalid_reward_row');
    assert(!JSON.stringify(adapter.load()).includes('secret'));
  });

  await check('Adapter failure is categorical and does not acknowledge', async () => {
    const broken = createRewardEconomyBoundary({
      adapter: Object.freeze({ load() { throw new Error('private storage detail'); }, save() { throw new Error('private storage detail'); } }),
      remoteApply: async () => true,
    });
    const result = await broken.enqueue({ uid: 'alice', row: row({ resultId: 'result_broken' }) });
    assert.strictEqual(result.reason, 'server_unavailable');
    assert.strictEqual(result.synced, undefined);
  });

  await check('dispose is terminal', async () => {
    assert.strictEqual(boundary.dispose(), true);
    assert.strictEqual((await boundary.enqueue({ uid: 'alice', row: row({ resultId: 'result_after_dispose' }) })).reason, 'boundary_disposed');
    assert.strictEqual((await boundary.retry()).reason, 'boundary_disposed');
  });

  if (failures) {
    console.error('REWARD_ECONOMY_BOUNDARY_FAILURES=' + failures + '/' + assertions);
    process.exitCode = 1;
  } else {
    console.log('REWARD_ECONOMY_BOUNDARY_ALL_PASS assertions=' + assertions);
  }
}

main().catch(error => {
  console.error('REWARD_ECONOMY_BOUNDARY_CRASH', error && error.stack || error);
  process.exitCode = 1;
});
