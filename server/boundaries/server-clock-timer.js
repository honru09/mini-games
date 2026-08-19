'use strict';

// Server-wide wall-clock/timer seam.  Business modules receive only now(),
// schedule(), and dispose(); native handles and deterministic test controls
// stay behind the Adapter seam.
const MAX_CALLBACKS_PER_ADVANCE = 10000;
const MAX_TIMER_DELAY_MS = 0x7fffffff;

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function timerDelay(value) {
  const delay = finiteNonNegative(value);
  return delay !== null && delay <= MAX_TIMER_DELAY_MS ? delay : null;
}

function addTime(left, right) {
  const value = left + right;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function createNodeClockTimerAdapter(options = {}) {
  const readNow = typeof options.now === 'function' ? options.now : () => Date.now();
  const setTimeoutFn = typeof options.setTimeout === 'function' ? options.setTimeout : setTimeout;
  const setIntervalFn = typeof options.setInterval === 'function' ? options.setInterval : setInterval;
  const clearTimeoutFn = typeof options.clearTimeout === 'function' ? options.clearTimeout : clearTimeout;
  const clearIntervalFn = typeof options.clearInterval === 'function' ? options.clearInterval : clearInterval;
  const handles = new Set();
  return Object.freeze({
    now() {
      return readNow();
    },
    arm(callback, delayMs, repeat) {
      if (typeof callback !== 'function') throw new TypeError('timer_callback_required');
      const delay = timerDelay(delayMs);
      const repeats = repeat === true;
      if (delay === null || (repeats && delay < 1)) throw new TypeError('timer_delay_invalid');
      const entry = { handle: null, repeat: repeats, active: true };
      const fire = () => {
        if (!entry.active) return;
        // The ServerClockTimer module samples and guards now() at its seam.
        // Reading the clock here would let a trigger-time clock exception
        // escape the module and terminate the Node process.
        callback();
      };
      entry.handle = entry.repeat ? setIntervalFn(fire, Math.max(1, delay)) : setTimeoutFn(fire, delay);
      if (entry.handle && typeof entry.handle.unref === 'function') entry.handle.unref();
      // A test adapter may invoke a callback synchronously before returning a
      // native handle.  Do not retain an already-cancelled entry in the
      // adapter registry.
      if (entry.active) handles.add(entry);
      return entry;
    },
    disarm(token) {
      if (!token || !token.active) return false;
      token.active = false;
      handles.delete(token);
      if (token.repeat) clearIntervalFn(token.handle);
      else clearTimeoutFn(token.handle);
      return true;
    },
    dispose() {
      for (const token of [...handles]) {
        if (token.repeat) clearIntervalFn(token.handle);
        else clearTimeoutFn(token.handle);
        token.active = false;
      }
      handles.clear();
    },
  });
}

function createManualClockTimerAdapter(options = {}) {
  let current = finiteNonNegative(options.startAt);
  if (current === null) current = 0;
  let sequence = 0;
  let nextId = 1;
  let disposed = false;
  const queue = new Map();

  function nextDue() {
    let selected = null;
    for (const item of queue.values()) {
      if (!item.active) continue;
      if (!selected || item.dueAt < selected.dueAt || (item.dueAt === selected.dueAt && item.sequence < selected.sequence)) selected = item;
    }
    return selected;
  }

  function arm(callback, delayMs, repeat) {
    if (disposed) throw new Error('manual_timer_disposed');
    if (typeof callback !== 'function') throw new TypeError('timer_callback_required');
    const delay = timerDelay(delayMs);
    const repeats = repeat === true;
    if (delay === null || (repeats && delay < 1)) throw new TypeError('timer_delay_invalid');
    const dueAt = addTime(current, delay);
    if (dueAt === null) throw new RangeError('manual_timer_deadline_invalid');
    const item = { id: nextId++, callback, repeat: repeats, interval: Math.max(1, delay), dueAt, sequence: sequence++, active: true };
    queue.set(item.id, item);
    return item;
  }

  function disarm(token) {
    if (!token || !token.active) return false;
    token.active = false;
    queue.delete(token.id);
    return true;
  }

  function drain(target) {
    let count = 0;
    while (true) {
      const item = nextDue();
      if (!item || item.dueAt > target) break;
      if (++count > MAX_CALLBACKS_PER_ADVANCE) throw new Error('manual_timer_callback_limit');
      const dueAt = item.dueAt;
      current = dueAt;
      if (!item.repeat) {
        item.active = false;
        queue.delete(item.id);
      }
      const result = item.callback(dueAt);
      if (item.repeat && item.active) {
        // A deterministic advance cannot await an asynchronous owner.  Move
        // the next deadline beyond this advance so a rejected Promise cannot
        // be invoked thousands of times before its microtask cancels the
        // lease.  Synchronous owners retain exact catch-up semantics.
        const nextDeadline = addTime(result && typeof result.then === 'function' ? target : dueAt, item.interval);
        if (nextDeadline === null) {
          item.active = false;
          queue.delete(item.id);
          throw new RangeError('manual_timer_deadline_invalid');
        }
        item.dueAt = nextDeadline;
        item.sequence = sequence++;
      }
    }
    current = target;
    return count;
  }

  const adapter = {
    now: () => current,
    arm,
    disarm,
    dispose() {
      disposed = true;
      for (const item of queue.values()) item.active = false;
      queue.clear();
    },
  };
  const control = {
    advanceBy(deltaMs) {
      const delta = finiteNonNegative(deltaMs);
      if (delta === null) throw new TypeError('manual_time_delta_invalid');
      const target = addTime(current, delta);
      if (target === null) throw new TypeError('manual_time_target_invalid');
      return drain(target);
    },
    advanceTo(value) {
      const target = finiteNonNegative(value);
      if (target === null || target < current) throw new TypeError('manual_time_target_invalid');
      return drain(target);
    },
    pendingCount: () => queue.size,
    current: () => current,
    dispose: () => adapter.dispose(),
  };
  return { adapter: Object.freeze(adapter), control: Object.freeze(control) };
}

function createServerClockTimer(options = {}) {
  const adapter = options.adapter || createNodeClockTimerAdapter();
  if (!adapter || typeof adapter.now !== 'function' || typeof adapter.arm !== 'function' || typeof adapter.disarm !== 'function') throw new TypeError('clock_timer_adapter_invalid');
  const onError = typeof options.onError === 'function' ? options.onError : () => {};
  const owners = new Map();
  let generation = 0;
  let lifecycleRevision = 0;
  let lastNow = 0;
  let disposed = false;
  let reportingError = false;

  function report(context, error) {
    // Error reporting is deliberately fail-silent and non-reentrant.  A
    // metrics/error sink may itself ask for now(); if the Adapter clock is
    // failing, reporting must not recurse until the stack overflows.
    if (reportingError) return;
    reportingError = true;
    try { onError(context, error); } catch (_) {}
    finally { reportingError = false; }
  }
  function readNow(value) {
    const number = finiteNonNegative(value);
    if (number === null) {
      report('server_clock_now', new Error('clock_now_invalid'));
      return lastNow;
    }
    lastNow = number;
    return number;
  }
  function now() {
    if (disposed) return lastNow;
    try { return readNow(adapter.now()); } catch (error) { report('server_clock_now', error); return lastNow; }
  }
  function schedule(spec = {}) {
    if (disposed) return { ok: false, reason: 'clock_timer_disposed' };
    const parseRevision = lifecycleRevision;
    let owner;
    let delayMs;
    let repeat;
    let run;
    try {
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return { ok: false, reason: 'clock_timer_invalid_schedule' };
      owner = typeof spec.owner === 'string' ? spec.owner.trim() : '';
      delayMs = timerDelay(spec.delayMs);
      repeat = spec.repeat === true;
      run = spec.run;
    } catch (error) {
      if (disposed) return { ok: false, reason: 'clock_timer_disposed' };
      report('server_clock_schedule', error);
      return { ok: false, reason: 'clock_timer_invalid_schedule' };
    }
    if (disposed) return { ok: false, reason: 'clock_timer_disposed' };
    if (lifecycleRevision !== parseRevision) {
      report('server_clock_schedule', new Error('clock_timer_reentrant_schedule'));
      return { ok: false, reason: 'clock_timer_invalid_schedule' };
    }
    if (!owner || delayMs === null || (repeat && delayMs < 1) || typeof run !== 'function') return { ok: false, reason: 'clock_timer_invalid_schedule' };
    const previous = owners.get(owner);
    if (previous) previous.cancel();
    const token = { owner, generation: ++generation, active: true, running: false, pending: null, adapterToken: null, cancel: null };
    const cancel = () => {
      if (!token.active) return false;
      token.active = false;
      if (owners.get(owner) === token) owners.delete(owner);
      lifecycleRevision += 1;
      try { return adapter.disarm(token.adapterToken) !== false; } catch (error) { report('server_clock_disarm', error); return false; }
    };
    token.cancel = cancel;
    // Register before arming so a synchronous Adapter callback observes the
    // current owner/generation.  The returned handle is still fenced below if
    // that callback cancelled the lease before arm() returned.
    owners.set(owner, token);
    lifecycleRevision += 1;
    try {
      token.adapterToken = adapter.arm(at => {
        if (!token.active || disposed || owners.get(owner) !== token) return;
        if (token.running) return token.pending;
        let eventNow;
        try {
          eventNow = readNow(at === undefined ? adapter.now() : at);
        } catch (error) {
          report('server_clock_now', error);
          cancel();
          return;
        }
        if (!token.active || disposed || owners.get(owner) !== token) return;
        try {
          const result = run({ owner, generation: token.generation, now: eventNow });
          if (result && typeof result.then === 'function') {
            token.running = true;
            const pending = Promise.resolve(result).then(
              () => {
                token.running = false;
                if (token.pending === pending) token.pending = null;
                if (!repeat && token.active) cancel();
              },
              error => {
                token.running = false;
                if (token.pending === pending) token.pending = null;
                report('server_clock_callback', error);
                cancel();
              },
            );
            token.pending = pending;
            return pending;
          }
        } catch (error) {
          report('server_clock_callback', error);
          cancel();
        }
        if (!repeat && token.active) cancel();
      }, delayMs, repeat);
      if (!token.active || disposed || owners.get(owner) !== token) {
        try { adapter.disarm(token.adapterToken); } catch (error) { report('server_clock_disarm', error); }
      }
    } catch (error) {
      report('server_clock_arm', error);
      token.active = false;
      if (owners.get(owner) === token) owners.delete(owner);
      return { ok: false, reason: 'clock_timer_unavailable' };
    }
    return Object.freeze({ ok: true, generation: token.generation, cancel });
  }
  function dispose() {
    if (disposed) return false;
    disposed = true;
    lifecycleRevision += 1;
    for (const token of [...owners.values()]) token.active && (() => { token.active = false; try { adapter.disarm(token.adapterToken); } catch (error) { report('server_clock_dispose', error); } })();
    owners.clear();
    try { if (typeof adapter.dispose === 'function') adapter.dispose(); } catch (error) { report('server_clock_dispose', error); }
    generation += 1;
    return true;
  }
  return Object.freeze({ now, schedule, dispose });
}

module.exports = {
  MAX_CALLBACKS_PER_ADVANCE,
  MAX_TIMER_DELAY_MS,
  createNodeClockTimerAdapter,
  createManualClockTimerAdapter,
  createServerClockTimer,
};
