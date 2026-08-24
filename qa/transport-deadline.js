'use strict';

const assert = require('assert');
const { createServerClockTimer, createManualClockTimerAdapter } = require('../server/boundaries/server-clock-timer');
const { createTransportDeadline, finiteTimeout } = require('../server/boundaries/transport-deadline');

const errors = [];
const manual = createManualClockTimerAdapter({ startAt: 1000 });
const timer = createServerClockTimer({ adapter: manual.adapter, onError: (context, error) => errors.push({ context, error }) });
const deadline = createTransportDeadline({ timer, ownerPrefix: 'qa-transport:', onError: (context, error) => errors.push({ context, error }) });

assert.strictEqual(finiteTimeout(1), 1);
assert.strictEqual(finiteTimeout(0), null);
assert.strictEqual(finiteTimeout(Infinity), null);

const first = deadline.open({ label: 'fetch', timeoutMs: 100 });
assert.strictEqual(first.ok, true);
assert.strictEqual(first.signal.aborted, false);
assert.strictEqual(deadline.activeCount(), 1);
manual.control.advanceBy(99);
assert.strictEqual(first.signal.aborted, false);
manual.control.advanceBy(1);
assert.strictEqual(first.signal.aborted, true);
assert.strictEqual(deadline.activeCount(), 0);

const second = deadline.open({ label: 'cancel', timeoutMs: 100 });
assert.strictEqual(second.ok, true);
assert.strictEqual(second.cancel(), true);
assert.strictEqual(second.signal.aborted, true);
assert.strictEqual(second.cancel(), false);
assert.strictEqual(manual.control.pendingCount(), 0);

const parent = new AbortController();
const third = deadline.open({ label: 'parent', timeoutMs: 100, signal: parent.signal });
assert.strictEqual(third.ok, true);
parent.abort(new Error('parent_abort'));
assert.strictEqual(third.signal.aborted, true);
assert.strictEqual(manual.control.pendingCount(), 0);

const disposed = deadline.open({ label: 'dispose', timeoutMs: 100 });
assert.strictEqual(disposed.ok, true);
assert.strictEqual(deadline.dispose(), true);
assert.strictEqual(disposed.signal.aborted, true);
assert.strictEqual(deadline.dispose(), false);
assert.strictEqual(deadline.activeCount(), 0);
assert.strictEqual(manual.control.pendingCount(), 0);
assert.strictEqual(errors.length, 0);
timer.dispose();
console.log('TRANSPORT_DEADLINE_ALL_PASS');
