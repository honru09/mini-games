'use strict';

function createHeartbeatSweepIsolation(options = {}) {
  const recordError = typeof options.recordError === 'function' ? options.recordError : () => {};
  const recordFallback = typeof options.recordFallback === 'function' ? options.recordFallback : () => {};

  function run(context, operation) {
    if (typeof operation !== 'function') {
      try { recordError(context, new TypeError('heartbeat_sweep_operation_invalid')); }
      catch (error) { try { recordFallback('heartbeat_sweep_error_report', error); } catch {} }
      return false;
    }
    try {
      operation();
      return true;
    } catch (error) {
      // ServerClockTimer retires a repeating lease when its callback escapes
      // with an error. Keep that fail-closed timer policy while isolating each
      // heartbeat domain so one corrupt entity cannot stop future sweeps.
      try { recordError(context, error); }
      catch (reportError) { try { recordFallback('heartbeat_sweep_error_report', reportError); } catch {} }
      return false;
    }
  }

  return Object.freeze({ run });
}

module.exports = { createHeartbeatSweepIsolation };
