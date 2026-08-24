'use strict';

// Outbound transport deadline seam. Native AbortController remains the
// cancellation primitive, while all deadline scheduling is owned by the
// injected ServerClockTimer. The module contains no fetch, persistence or
// protocol knowledge.
const MAX_TIMEOUT_MS = 0x7fffffff;

function finiteTimeout(value) {
  const timeout = Number(value);
  return Number.isSafeInteger(timeout) && timeout >= 1 && timeout <= MAX_TIMEOUT_MS ? timeout : null;
}

function createTransportDeadline(options = {}) {
  const timer = options.timer;
  if (!timer || typeof timer.schedule !== 'function' || typeof timer.now !== 'function') {
    throw new TypeError('transport_deadline_timer_required');
  }
  const onError = typeof options.onError === 'function' ? options.onError : () => {};
  const prefix = String(options.ownerPrefix || 'transport-deadline:').trim() || 'transport-deadline:';
  const active = new Set();
  let sequence = 0;
  let disposed = false;

  function report(context, error) {
    try { onError(context, error); } catch (_) {}
  }

  function open(spec = {}) {
    if (disposed) return { ok: false, reason: 'transport_deadline_disposed' };
    const timeoutMs = finiteTimeout(spec.timeoutMs);
    if (timeoutMs === null) return { ok: false, reason: 'transport_deadline_invalid' };
    const parentSignal = spec.signal && typeof spec.signal.addEventListener === 'function' ? spec.signal : null;
    const label = String(spec.label || 'request').replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 48) || 'request';
    const owner = prefix + label + ':' + (++sequence % 1000000000);
    const controller = new AbortController();
    const entry = { owner, controller, lease: null, done: false, parentSignal, onParentAbort: null, abort: null };

    function cleanup() {
      active.delete(entry);
      if (entry.parentSignal && entry.onParentAbort) {
        try { entry.parentSignal.removeEventListener('abort', entry.onParentAbort); } catch (_) {}
      }
      if (entry.lease && typeof entry.lease.cancel === 'function') {
        try { entry.lease.cancel(); } catch (error) { report('transport_deadline_cancel', error); }
      }
    }

    function abort(reason) {
      if (entry.done) return false;
      entry.done = true;
      try { controller.abort(reason); } catch (error) { report('transport_deadline_abort', error); }
      cleanup();
      return true;
    }
    entry.abort = abort;

    entry.onParentAbort = () => abort(parentSignal.reason || new Error('transport_parent_aborted'));
    if (parentSignal && parentSignal.aborted) {
      abort(parentSignal.reason || new Error('transport_parent_aborted'));
      return { ok: true, owner, signal: controller.signal, deadlineAt: timer.now(), cancel: () => false, aborted: true };
    }
    if (parentSignal) {
      try { parentSignal.addEventListener('abort', entry.onParentAbort, { once: true }); }
      catch (error) { report('transport_deadline_parent_listener', error); return { ok: false, reason: 'transport_deadline_invalid' }; }
    }

    let deadlineAt;
    try { deadlineAt = timer.now() + timeoutMs; }
    catch (error) { report('transport_deadline_now', error); cleanup(); return { ok: false, reason: 'transport_deadline_clock_unavailable' }; }
    if (!Number.isSafeInteger(deadlineAt) || deadlineAt < timeoutMs) {
      cleanup();
      return { ok: false, reason: 'transport_deadline_clock_unavailable' };
    }
    const lease = timer.schedule({
      owner,
      delayMs: timeoutMs,
      run: () => abort(new Error('transport_deadline_exceeded')),
    });
    if (!lease || lease.ok !== true) {
      report('transport_deadline_schedule', new Error(lease && lease.reason || 'clock_timer_unavailable'));
      cleanup();
      return { ok: false, reason: lease && lease.reason || 'transport_deadline_schedule_failed' };
    }
    entry.lease = lease;
    active.add(entry);
    return {
      ok: true,
      owner,
      signal: controller.signal,
      deadlineAt,
      cancel: () => abort(new Error('transport_cancelled')),
    };
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    for (const entry of [...active]) entry.abort(new Error('transport_deadline_disposed'));
    active.clear();
    return true;
  }

  return Object.freeze({ open, dispose, activeCount: () => active.size });
}

module.exports = { createTransportDeadline, finiteTimeout };
