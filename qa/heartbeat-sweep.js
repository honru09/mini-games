'use strict';

const assert = require('assert');
const { createServerClockTimer, createManualClockTimerAdapter } = require('../server/boundaries/server-clock-timer');
const { createHeartbeatSweepIsolation } = require('../server/boundaries/heartbeat-sweep-isolation');

const failures = [];
function check(name, run) {
  try { run(); console.log('PASS  ' + name); }
  catch (error) { failures.push(name + ': ' + error.message); console.log('FAIL  ' + name + ' :: ' + error.message); }
}

check('Heartbeat isolation keeps the same tick and later repeat ticks alive', () => {
  const { adapter, control } = createManualClockTimerAdapter({ startAt: 1000 });
  const clock = createServerClockTimer({ adapter });
  const errors = [];
  const fallbackErrors = [];
  const isolation = createHeartbeatSweepIsolation({
    recordError: (context, error) => errors.push([context, error.message]),
    recordFallback: (context, error) => fallbackErrors.push([context, error.message]),
  });
  const guestCloseArgs = [];
  const normalCloseArgs = [];
  let tournamentRuns = 0;
  let resumeRuns = 0;
  let ticks = 0;
  const guest = { close: intentional => guestCloseArgs.push(intentional) };
  const normal = { close: intentional => normalCloseArgs.push(intentional) };

  const lease = clock.schedule({
    owner: 'heartbeat-sweep',
    delayMs: 100,
    repeat: true,
    run: () => {
      ticks += 1;
      isolation.run('heartbeat_session_sweep', () => { throw new Error('session_fault_' + ticks); });
      isolation.run('heartbeat_guest_expiry_close', () => guest.close(true));
      isolation.run('heartbeat_session_timeout_close', () => normal.close());
      isolation.run('heartbeat_room_idle_sweep', () => { throw new Error('room_fault_' + ticks); });
      isolation.run('heartbeat_tournament_sweep', () => { tournamentRuns += 1; });
      isolation.run('heartbeat_resume_expiry_sweep', () => { resumeRuns += 1; });
    },
  });

  assert.strictEqual(lease.ok, true);
  assert.strictEqual(control.advanceBy(100), 1);
  assert.strictEqual(ticks, 1);
  assert.strictEqual(tournamentRuns, 1);
  assert.strictEqual(resumeRuns, 1);
  assert.strictEqual(control.pendingCount(), 1);
  assert.strictEqual(control.advanceBy(100), 1);
  assert.strictEqual(ticks, 2);
  assert.strictEqual(tournamentRuns, 2);
  assert.strictEqual(resumeRuns, 2);
  assert.deepStrictEqual(guestCloseArgs, [true, true]);
  assert.deepStrictEqual(normalCloseArgs, [undefined, undefined]);
  assert.deepStrictEqual(errors, [
    ['heartbeat_session_sweep', 'session_fault_1'],
    ['heartbeat_room_idle_sweep', 'room_fault_1'],
    ['heartbeat_session_sweep', 'session_fault_2'],
    ['heartbeat_room_idle_sweep', 'room_fault_2'],
  ]);
  assert.deepStrictEqual(fallbackErrors, []);
  assert.strictEqual(lease.cancel(), true);
  assert.strictEqual(clock.dispose(), true);
  assert.strictEqual(control.pendingCount(), 0);
});

check('Heartbeat isolation contains error-reporter faults and invalid operations', () => {
  const fallbacks = [];
  const isolation = createHeartbeatSweepIsolation({
    recordError: () => { throw new Error('reporter_fault'); },
    recordFallback: (context, error) => fallbacks.push([context, error.message]),
  });
  assert.strictEqual(isolation.run('heartbeat_bad_operation', null), false);
  assert.strictEqual(isolation.run('heartbeat_domain_fault', () => { throw new Error('domain_fault'); }), false);
  assert.deepStrictEqual(fallbacks, [
    ['heartbeat_sweep_error_report', 'reporter_fault'],
    ['heartbeat_sweep_error_report', 'reporter_fault'],
  ]);
  assert.deepStrictEqual(Object.keys(isolation), ['run']);
});

if (failures.length) {
  console.error('HEARTBEAT_SWEEP_FAILED:', failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('HEARTBEAT_SWEEP_ALL_PASS');
}
