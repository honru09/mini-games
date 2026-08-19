'use strict';

const assert = require('assert');
const {
  MAX_CALLBACKS_PER_ADVANCE,
  MAX_TIMER_DELAY_MS,
  createManualClockTimerAdapter,
  createNodeClockTimerAdapter,
  createServerClockTimer,
} = require('../server/boundaries/server-clock-timer');
const {
  createMemoryMetricsAdapter,
  createOperationalMetricsBoundary,
} = require('../server/boundaries/operational-metrics');

const failures = [];
function check(name, fn) {
  try { fn(); console.log('PASS  ' + name); }
  catch (error) { failures.push(name + ': ' + error.message); console.log('FAIL  ' + name + ' :: ' + error.message); }
}

check('ServerClockTimer exposes only now/schedule/dispose', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 1000 });
  const clock = createServerClockTimer({ adapter });
  assert.deepStrictEqual(Object.keys(clock).sort(), ['dispose', 'now', 'schedule']);
  assert.strictEqual(clock.now(), 1000);
  control.dispose();
});

check('Manual one-shot fires only at the exact deadline with one sampled epoch', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 1000 });
  const clock = createServerClockTimer({ adapter });
  const seen = [];
  clock.schedule({ owner: 'one', delayMs: 100, run: ({ now }) => seen.push(now) });
  control.advanceBy(99);
  assert.deepStrictEqual(seen, []);
  control.advanceBy(1);
  assert.deepStrictEqual(seen, [1100]);
  control.advanceBy(1000);
  assert.deepStrictEqual(seen, [1100]);
});

check('Manual repeat is FIFO and catches up deterministically', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 0 });
  const clock = createServerClockTimer({ adapter });
  const seen = [];
  clock.schedule({ owner: 'repeat', delayMs: 50, repeat: true, run: ({ now }) => seen.push(now) });
  control.advanceBy(125);
  assert.deepStrictEqual(seen, [50, 100]);
  control.advanceBy(25);
  assert.deepStrictEqual(seen, [50, 100, 150]);
});

check('same owner replacement fences the old generation and old cancel cannot cancel new', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 0 });
  const clock = createServerClockTimer({ adapter });
  const seen = [];
  const oldLease = clock.schedule({ owner: 'owner', delayMs: 10, repeat: true, run: () => seen.push('old') });
  const newLease = clock.schedule({ owner: 'owner', delayMs: 20, run: () => seen.push('new') });
  assert(oldLease.ok && newLease.ok && newLease.generation > oldLease.generation);
  oldLease.cancel();
  control.advanceBy(20);
  assert.deepStrictEqual(seen, ['new']);
});

check('cancel and dispose are idempotent and remove all pending work', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 0 });
  const clock = createServerClockTimer({ adapter });
  const lease = clock.schedule({ owner: 'cancel', delayMs: 10, run: () => { throw new Error('should_not_run'); } });
  assert.strictEqual(lease.cancel(), true);
  assert.strictEqual(lease.cancel(), false);
  assert.strictEqual(control.pendingCount(), 0);
  clock.schedule({ owner: 'dispose-a', delayMs: 10, repeat: true, run: () => {} });
  clock.schedule({ owner: 'dispose-b', delayMs: 10, repeat: true, run: () => {} });
  assert.strictEqual(clock.dispose(), true);
  assert.strictEqual(clock.dispose(), false);
  assert.strictEqual(control.pendingCount(), 0);
  assert.strictEqual(clock.schedule({ owner: 'late', delayMs: 1, run: () => {} }).ok, false);
});

check('callback errors are isolated and repeating lease is stopped', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 0 });
  const errors = [];
  const clock = createServerClockTimer({ adapter, onError: (context) => errors.push(context) });
  clock.schedule({ owner: 'throws', delayMs: 1, repeat: true, run: () => { throw new Error('boom'); } });
  control.advanceBy(1);
  control.advanceBy(10);
  assert.strictEqual(errors.includes('server_clock_callback'), true);
  assert.strictEqual(control.pendingCount(), 0);
});

check('invalid schedules and adapter failures fail closed', () => {
  const { adapter } = createManualClockTimerAdapter({ startAt: 0 });
  const errors = [];
  const clock = createServerClockTimer({ adapter, onError: context => errors.push(context) });
  assert.strictEqual(clock.schedule({ owner: '', delayMs: 1, run: () => {} }).reason, 'clock_timer_invalid_schedule');
  assert.strictEqual(clock.schedule({ owner: 'bad', delayMs: -1, run: () => {} }).reason, 'clock_timer_invalid_schedule');
  assert.strictEqual(clock.schedule({ owner: 'bad', delayMs: '1', run: () => {} }).reason, 'clock_timer_invalid_schedule');
  assert.strictEqual(clock.schedule({ owner: 'bad', delayMs: 1.5, run: () => {} }).reason, 'clock_timer_invalid_schedule');
  assert.strictEqual(clock.schedule(null).reason, 'clock_timer_invalid_schedule');
  const hostile = {};
  Object.defineProperty(hostile, 'owner', { get() { throw new Error('owner_getter'); } });
  assert.strictEqual(clock.schedule(hostile).reason, 'clock_timer_invalid_schedule');
  assert.strictEqual(errors.includes('server_clock_schedule'), true);
  const broken = createServerClockTimer({
    adapter: { now: () => 0, arm: () => { throw new Error('arm'); }, disarm: () => true },
    onError: context => errors.push(context),
  });
  assert.strictEqual(broken.schedule({ owner: 'broken', delayMs: 1, run: () => {} }).reason, 'clock_timer_unavailable');
  assert.strictEqual(errors.includes('server_clock_arm'), true);
});

check('schedule parsing cannot revive a disposed or re-entered clock', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt:0 });
  let clock;
  const spec = {
    get owner() {
      clock.dispose();
      return 'hostile-owner';
    },
    delayMs:1,
    run:() => { throw new Error('must_not_run'); },
  };
  clock = createServerClockTimer({ adapter });
  const result = clock.schedule(spec);
  assert.deepStrictEqual(result, { ok:false, reason:'clock_timer_disposed' });
  assert.strictEqual(control.pendingCount(), 0);
});

check('clock rejects malformed samples and preserves the last valid epoch', () => {
  const samples = [100, null, '200', 100.5, 200];
  const errors = [];
  const clock = createServerClockTimer({
    adapter: { now: () => samples.shift(), arm: () => ({ id: 1 }), disarm: () => true },
    onError: context => errors.push(context),
  });
  assert.strictEqual(clock.now(), 100);
  assert.strictEqual(clock.now(), 100);
  assert.strictEqual(clock.now(), 100);
  assert.strictEqual(clock.now(), 100);
  assert.strictEqual(clock.now(), 200);
  assert.deepStrictEqual(errors, ['server_clock_now', 'server_clock_now', 'server_clock_now']);
  clock.dispose();
});

check('Node and Manual adapters reject delays that Node would overflow', () => {
  assert.strictEqual(MAX_TIMER_DELAY_MS, 0x7fffffff);
  let nodeDelay = null;
  const nodeAdapter = createNodeClockTimerAdapter({
    setTimeout:(_callback, delay) => { nodeDelay = delay; return { id:'max-delay' }; },
    clearTimeout:() => {},
  });
  const maxToken = nodeAdapter.arm(() => {}, MAX_TIMER_DELAY_MS, false);
  assert.strictEqual(nodeDelay, MAX_TIMER_DELAY_MS);
  assert.strictEqual(nodeAdapter.disarm(maxToken), true);
  assert.throws(() => nodeAdapter.arm(() => {}, MAX_TIMER_DELAY_MS + 1, false), /timer_delay_invalid/);
  const { adapter } = createManualClockTimerAdapter({ startAt: 0 });
  const manualMaxToken = adapter.arm(() => {}, MAX_TIMER_DELAY_MS, false);
  assert.strictEqual(adapter.disarm(manualMaxToken), true);
  assert.throws(() => adapter.arm(() => {}, MAX_TIMER_DELAY_MS + 1, false), /timer_delay_invalid/);
  const clock = createServerClockTimer({ adapter });
  assert.strictEqual(clock.schedule({ owner:'overflow', delayMs:MAX_TIMER_DELAY_MS + 1, run:() => {} }).reason, 'clock_timer_invalid_schedule');
  clock.dispose();
});

check('Manual time addition never crosses the safe-integer epoch', () => {
  const atLimit = createManualClockTimerAdapter({ startAt:Number.MAX_SAFE_INTEGER });
  assert.throws(() => atLimit.adapter.arm(() => {}, 1, false), /manual_timer_deadline_invalid/);
  assert.throws(() => atLimit.control.advanceBy(1), /manual_time_target_invalid/);
  const nearLimit = createManualClockTimerAdapter({ startAt:Number.MAX_SAFE_INTEGER - 1 });
  let runs = 0;
  nearLimit.adapter.arm(() => { runs += 1; }, 1, true);
  assert.throws(() => nearLimit.control.advanceBy(1), /manual_timer_deadline_invalid/);
  assert.strictEqual(runs, 1);
  assert.strictEqual(nearLimit.control.pendingCount(), 0);
});

check('Manual callback cap is deterministic and leaves cleanup possible', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 0 });
  const clock = createServerClockTimer({ adapter });
  clock.schedule({ owner:'cap', delayMs:1, repeat:true, run:() => {} });
  assert.throws(() => control.advanceBy(MAX_CALLBACKS_PER_ADVANCE + 1), /manual_timer_callback_limit/);
  assert.strictEqual(clock.dispose(), true);
  assert.strictEqual(control.pendingCount(), 0);
});

check('disarm and dispose faults are isolated behind stable contexts', () => {
  const errors = [];
  const adapter = {
    now: () => 0,
    arm: () => ({ id:'faulty' }),
    disarm: () => { throw new Error('disarm'); },
    dispose: () => { throw new Error('dispose'); },
  };
  const clock = createServerClockTimer({ adapter, onError: context => errors.push(context) });
  const lease = clock.schedule({ owner:'faults', delayMs:1, run:() => {} });
  assert.strictEqual(lease.cancel(), false);
  assert.strictEqual(clock.dispose(), true);
  assert.deepStrictEqual(errors, ['server_clock_disarm', 'server_clock_dispose']);
});

check('Manual equal-deadline owners remain FIFO', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 0 });
  const clock = createServerClockTimer({ adapter });
  const seen = [];
  clock.schedule({ owner:'fifo-a', delayMs:5, run:() => seen.push('a') });
  clock.schedule({ owner:'fifo-b', delayMs:5, run:() => seen.push('b') });
  control.advanceBy(5);
  assert.deepStrictEqual(seen, ['a', 'b']);
});

check('Operational Metrics composition uses the injected epoch and owned cadence', () => {
  const { adapter:timerAdapter, control } = createManualClockTimerAdapter({ startAt: 1000 });
  const clock = createServerClockTimer({ adapter:timerAdapter });
  const metricsAdapter = createMemoryMetricsAdapter();
  const boundary = createOperationalMetricsBoundary({
    adapter:metricsAdapter,
    now:() => clock.now(),
    historyIntervalMs:100,
    currentMetrics:() => ({ generatedAt:new Date(clock.now()).toISOString(), activeMatches:0 }),
  });
  const lease = clock.schedule({
    owner:'operational-metrics-history',
    delayMs:100,
    repeat:true,
    run:() => boundary.capture(false),
  });
  assert.strictEqual(lease.ok, true);
  control.advanceBy(99);
  assert.deepStrictEqual(metricsAdapter.load().history, []);
  control.advanceBy(1);
  assert.deepStrictEqual(metricsAdapter.load().history, [{ generatedAt:'1970-01-01T00:00:01.100Z', activeMatches:0 }]);
  assert.strictEqual(clock.dispose(), true);
  assert.strictEqual(control.pendingCount(), 0);
});

check('trigger-time Node clock failure is isolated and stops the lease', () => {
  const callbacks = [];
  let reads = 0;
  const errors = [];
  const adapter = createNodeClockTimerAdapter({
    now: () => {
      reads += 1;
      if (reads > 0) throw new Error('trigger_now');
      return 100;
    },
    setInterval: callback => { callbacks.push(callback); return { unref() {} }; },
    clearInterval: () => {},
  });
  const clock = createServerClockTimer({ adapter, onError: context => errors.push(context) });
  const lease = clock.schedule({ owner: 'trigger-now', delayMs: 1, repeat: true, run: () => { throw new Error('must_not_run'); } });
  assert.strictEqual(lease.ok, true);
  assert.strictEqual(callbacks.length, 1);
  assert.doesNotThrow(() => callbacks[0]());
  assert(errors.includes('server_clock_now'));
  assert.strictEqual(lease.cancel(), false);
  clock.dispose();
});

check('clock error reporting is non-reentrant when the sink reads now()', () => {
  let nowReads = 0;
  let reportCalls = 0;
  let clock;
  const adapter = {
    now: () => { nowReads += 1; throw new Error('recursive_now'); },
    arm: () => ({ id: 'never' }),
    disarm: () => true,
  };
  clock = createServerClockTimer({ adapter, onError: () => { reportCalls += 1; clock.now(); } });
  assert.doesNotThrow(() => clock.now());
  assert.strictEqual(nowReads, 2);
  assert.strictEqual(reportCalls, 1);
  clock.dispose();
});

check('error reporting cannot let a stale owner callback run', () => {
  const callbacks = [];
  let oldRuns = 0;
  let replacementRuns = 0;
  let clock;
  const adapter = {
    now:() => 0,
    arm(callback) { callbacks.push(callback); return { id:callbacks.length }; },
    disarm:() => true,
  };
  clock = createServerClockTimer({
    adapter,
    onError:context => {
      if (context === 'server_clock_now') {
        clock.schedule({ owner:'replace-on-error', delayMs:1, run:() => { replacementRuns += 1; } });
      }
    },
  });
  const oldLease = clock.schedule({ owner:'replace-on-error', delayMs:1, repeat:true, run:() => { oldRuns += 1; } });
  callbacks[0](null);
  assert.strictEqual(oldRuns, 0);
  assert.strictEqual(oldLease.cancel(), false);
  callbacks[1](0);
  assert.strictEqual(replacementRuns, 1);
  clock.dispose();

  let disposeRuns = 0;
  let disposeCallback;
  const disposingAdapter = {
    now:() => 0,
    arm(callback) { disposeCallback = callback; return { id:'dispose' }; },
    disarm:() => true,
  };
  let disposingClock;
  disposingClock = createServerClockTimer({
    adapter:disposingAdapter,
    onError:context => { if (context === 'server_clock_now') disposingClock.dispose(); },
  });
  disposingClock.schedule({ owner:'dispose-on-error', delayMs:1, run:() => { disposeRuns += 1; } });
  disposeCallback(null);
  assert.strictEqual(disposeRuns, 0);
});

check('synchronous Adapter arm observes owner and cleans the late handle', () => {
  let runs = 0;
  let disarmed = 0;
  const adapter = {
    now: () => 7,
    arm(callback) {
      callback();
      return { id: 'late-handle' };
    },
    disarm(token) {
      if (token && token.id === 'late-handle') disarmed += 1;
      return true;
    },
  };
  const clock = createServerClockTimer({ adapter });
  const lease = clock.schedule({ owner: 'sync-arm', delayMs: 0, run: ({ now }) => { runs += now; } });
  assert.strictEqual(lease.ok, true);
  assert.strictEqual(runs, 7);
  assert.strictEqual(disarmed, 1);
  clock.dispose();
});

check('manual time cannot move backwards and never patches globals', () => {
  const beforeNow = Date.now;
  const beforeSetTimeout = global.setTimeout;
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 5 });
  assert.throws(() => control.advanceTo(4), /manual_time_target_invalid/);
  assert.strictEqual(Date.now, beforeNow);
  assert.strictEqual(global.setTimeout, beforeSetTimeout);
  adapter.dispose();
});

(async () => {
  try {
    const { adapter, control } = createManualClockTimerAdapter({ startAt: 0 });
    const errors = [];
    let runs = 0;
    const clock = createServerClockTimer({ adapter, onError: context => errors.push(context) });
    clock.schedule({ owner:'async-reject', delayMs:1, repeat:true, run:() => {
      runs += 1;
      return Promise.reject(new Error('async_boom'));
    } });
    assert.strictEqual(control.advanceBy(3), 1);
    assert.strictEqual(control.advanceBy(MAX_CALLBACKS_PER_ADVANCE + 1), 1);
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(runs, 1);
    assert.deepStrictEqual(errors, ['server_clock_callback']);
    assert.strictEqual(control.pendingCount(), 0);
    console.log('PASS  asynchronous repeat rejection is single-flight and cancels once');
  } catch (error) {
    failures.push('asynchronous repeat rejection is single-flight and cancels once: ' + error.message);
    console.log('FAIL  asynchronous repeat rejection is single-flight and cancels once :: ' + error.message);
  }
  try {
    const { adapter, control } = createManualClockTimerAdapter({ startAt:0 });
    let release;
    let runs = 0;
    const clock = createServerClockTimer({ adapter });
    const lease = clock.schedule({ owner:'async-resolve', delayMs:1, repeat:true, run:() => {
      runs += 1;
      if (runs === 1) return new Promise(resolve => { release = resolve; });
      return undefined;
    } });
    assert.strictEqual(control.advanceBy(1), 1);
    assert.strictEqual(control.advanceBy(100), 1);
    assert.strictEqual(runs, 1);
    release();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(control.advanceBy(1), 1);
    assert.strictEqual(runs, 2);
    assert.strictEqual(lease.cancel(), true);
    console.log('PASS  asynchronous repeat resolution resumes without overlapping');
  } catch (error) {
    failures.push('asynchronous repeat resolution resumes without overlapping: ' + error.message);
    console.log('FAIL  asynchronous repeat resolution resumes without overlapping :: ' + error.message);
  }
  try {
    const cancelCase = createManualClockTimerAdapter({ startAt:0 });
    let releaseCancelled;
    let cancelledRuns = 0;
    const cancelClock = createServerClockTimer({ adapter:cancelCase.adapter });
    const lease = cancelClock.schedule({ owner:'pending-cancel', delayMs:1, repeat:true, run:() => {
      cancelledRuns += 1;
      return new Promise(resolve => { releaseCancelled = resolve; });
    } });
    cancelCase.control.advanceBy(1);
    assert.strictEqual(lease.cancel(), true);
    releaseCancelled();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(cancelCase.control.advanceBy(100), 0);
    assert.strictEqual(cancelledRuns, 1);

    const replacementCase = createManualClockTimerAdapter({ startAt:0 });
    let releaseOld;
    const seen = [];
    const replacementClock = createServerClockTimer({ adapter:replacementCase.adapter });
    replacementClock.schedule({ owner:'pending-owner', delayMs:1, repeat:true, run:() => {
      seen.push('old');
      return new Promise(resolve => { releaseOld = resolve; });
    } });
    replacementCase.control.advanceBy(1);
    replacementClock.schedule({ owner:'pending-owner', delayMs:1, run:() => seen.push('new') });
    releaseOld();
    await Promise.resolve();
    await Promise.resolve();
    replacementCase.control.advanceBy(1);
    assert.deepStrictEqual(seen, ['old', 'new']);

    const disposeCase = createManualClockTimerAdapter({ startAt:0 });
    let releaseDisposed;
    let disposedRuns = 0;
    const disposeClock = createServerClockTimer({ adapter:disposeCase.adapter });
    disposeClock.schedule({ owner:'pending-dispose', delayMs:1, repeat:true, run:() => {
      disposedRuns += 1;
      return new Promise(resolve => { releaseDisposed = resolve; });
    } });
    disposeCase.control.advanceBy(1);
    assert.strictEqual(disposeClock.dispose(), true);
    releaseDisposed();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(disposeCase.control.pendingCount(), 0);
    assert.strictEqual(disposedRuns, 1);
    console.log('PASS  pending asynchronous work stays fenced after cancel replacement and dispose');
  } catch (error) {
    failures.push('pending asynchronous work stays fenced after cancel replacement and dispose: ' + error.message);
    console.log('FAIL  pending asynchronous work stays fenced after cancel replacement and dispose :: ' + error.message);
  }
  const adapter = createNodeClockTimerAdapter();
  const clock = createServerClockTimer({ adapter });
  let fired = false;
  clock.schedule({ owner: 'node-smoke', delayMs: 10, run: () => { fired = true; } });
  await new Promise(resolve => setTimeout(resolve, 35));
  clock.dispose();
  if (!fired) failures.push('Node adapter one-shot did not fire');
  if (failures.length) {
    console.error('SERVER_CLOCK_TIMER_FAILED:', failures.join('、'));
    process.exitCode = 1;
  } else {
    console.log('SERVER_CLOCK_TIMER_ALL_PASS');
  }
})();
