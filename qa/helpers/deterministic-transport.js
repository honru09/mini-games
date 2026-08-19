'use strict';

/*
 * Deterministic, in-process transport for QA only.
 *
 * This module intentionally has no WebSocket, wall-clock, native timer, DOM,
 * persistence, or production-network dependency.  It gives tests a virtual
 * clock and a bounded event queue so latency and connection-epoch cases can be
 * replayed byte-for-byte.  It is not an operating-system network shaper.
 */

const crypto = require('crypto');

const EVIDENCE_CLASS = 'LOCAL_DETERMINISTIC_NETWORK_SIMULATION_ONLY';
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function integer(value, fallback = 0, minimum = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

function clone(value) {
  if (value === undefined || value === null) return value;
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch (_error) {}
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    if (Array.isArray(value)) return value.map(item => clone(item));
    if (value && typeof value === 'object') {
      const output = {};
      for (const key of Object.keys(value)) output[key] = clone(value[key]);
      return output;
    }
    return value;
  }
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function xorshift32(seed) {
  let state = (integer(seed, 1, 0) >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function endpointName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 96 || !/^[A-Za-z0-9._:-]+$/.test(name)) return null;
  return name;
}

function compareEvents(left, right) {
  return (left.deliverAt - right.deliverAt) || (left.order - right.order);
}

class DeterministicTransport {
  constructor(options = {}) {
    this.evidenceClass = EVIDENCE_CLASS;
    this.seed = integer(options.seed, 1, 0);
    this.now = integer(options.startAt, 0, 0);
    this.baseLatencyMs = integer(options.baseLatencyMs, 0, 0);
    this.jitterMs = integer(options.jitterMs, 0, 0);
    this.maxQueue = Math.min(100000, integer(options.maxQueue, 10000, 1));
    this._random = xorshift32(this.seed);
    this._nextPacketId = 1;
    this._nextOrder = 1;
    this._queue = [];
    this._endpoints = new Map();
    this._trace = [];
    this._disposed = false;
  }

  register(name, receive) {
    const id = endpointName(name);
    if (!id) throw new TypeError('deterministic_endpoint_invalid');
    if (typeof receive !== 'function') throw new TypeError('deterministic_receiver_required');
    if (this._endpoints.has(id)) throw new Error('deterministic_endpoint_duplicate');
    this._endpoints.set(id, { receive, connected: true, epoch: 1 });
    return Object.freeze({ endpoint: id, epoch: 1 });
  }

  endpoint(name) {
    const id = endpointName(name);
    const value = id && this._endpoints.get(id);
    return value ? Object.freeze({ endpoint: id, connected: value.connected, epoch: value.epoch }) : null;
  }

  connect(name) {
    const id = endpointName(name);
    const state = id && this._endpoints.get(id);
    if (!state) return { ok: false, reason: 'unknown_endpoint' };
    if (this._disposed) return { ok: false, reason: 'disposed' };
    if (!state.connected) state.epoch = Math.min(MAX_SAFE, state.epoch + 1);
    state.connected = true;
    return { ok: true, endpoint: id, epoch: state.epoch };
  }

  disconnect(name) {
    const id = endpointName(name);
    const state = id && this._endpoints.get(id);
    if (!state) return { ok: false, reason: 'unknown_endpoint' };
    if (this._disposed) return { ok: false, reason: 'disposed' };
    state.connected = false;
    state.epoch = Math.min(MAX_SAFE, state.epoch + 1);
    return { ok: true, endpoint: id, epoch: state.epoch };
  }

  _jitter(options, index) {
    if (Number.isFinite(Number(options.jitterOffsetMs))) return Number(options.jitterOffsetMs);
    const pattern = Array.isArray(options.jitterPatternMs) ? options.jitterPatternMs : null;
    if (pattern && pattern.length) return Number(pattern[index % pattern.length]) || 0;
    if (!this.jitterMs) return 0;
    return Math.floor(this._random() * ((this.jitterMs * 2) + 1)) - this.jitterMs;
  }

  _enqueue(event) {
    if (this._queue.length >= this.maxQueue) return { ok: false, reason: 'queue_full' };
    this._queue.push(event);
    return { ok: true };
  }

  send(options = {}) {
    if (this._disposed) return { ok: false, reason: 'disposed', packetIds: [] };
    const from = endpointName(options.from);
    const to = endpointName(options.to);
    const sender = from && this._endpoints.get(from);
    const receiver = to && this._endpoints.get(to);
    if (!sender || !receiver) return { ok: false, reason: 'unknown_endpoint', packetIds: [] };
    if (!sender.connected || !receiver.connected) return { ok: false, reason: 'endpoint_disconnected', packetIds: [] };
    const duplicateCount = Math.min(16, integer(options.duplicateCount, options.duplicate === true ? 1 : 0, 0));
    const base = integer(options.latencyMs, this.baseLatencyMs, 0);
    const extra = integer(options.extraDelayMs, 0, 0);
    const packetIds = [];
    const logicalId = this._nextPacketId++;
    const total = duplicateCount + 1;
    for (let index = 0; index < total; index += 1) {
      const jitter = this._jitter(options, index);
      const latency = Math.max(0, base + jitter + extra + integer(options.duplicateDelayMs, 0, 0) * (index > 0 ? index : 0));
      const packetId = index === 0 ? logicalId : this._nextPacketId++;
      const event = {
        evidenceClass: EVIDENCE_CLASS,
        packetId,
        logicalId,
        duplicateOf: index === 0 ? null : logicalId,
        duplicateIndex: index,
        from,
        to,
        channel: String(options.channel || 'default'),
        sentAt: this.now,
        deliverAt: this.now + latency,
        latencyMs: latency,
        sourceEpoch: sender.epoch,
        targetEpoch: receiver.epoch,
        payload: clone(options.payload),
        order: this._nextOrder++,
        metadata: clone(options.metadata || {}),
      };
      const queued = this._enqueue(event);
      if (!queued.ok) return { ok: false, reason: queued.reason, packetIds };
      packetIds.push(packetId);
    }
    return { ok: true, packetIds, logicalId };
  }

  advanceTo(target) {
    if (this._disposed) return { ok: false, reason: 'disposed', delivered: 0, dropped: 0 };
    const targetAt = integer(target, this.now, this.now);
    if (targetAt < this.now) return { ok: false, reason: 'time_reversed', delivered: 0, dropped: 0 };
    this.now = targetAt;
    let delivered = 0;
    let dropped = 0;
    while (true) {
      this._queue.sort(compareEvents);
      const event = this._queue[0];
      if (!event || event.deliverAt > this.now) break;
      this._queue.shift();
      const sender = this._endpoints.get(event.from);
      const receiver = this._endpoints.get(event.to);
      let status = 'delivered';
      let reason = null;
      if (!sender || !receiver || !sender.connected || !receiver.connected) {
        status = 'dropped';
        reason = 'endpoint_disconnected';
      } else if (sender.epoch !== event.sourceEpoch || receiver.epoch !== event.targetEpoch) {
        status = 'dropped';
        reason = 'stale_connection_epoch';
      }
      const record = {
        evidenceClass: EVIDENCE_CLASS,
        packetId: event.packetId,
        logicalId: event.logicalId,
        duplicateOf: event.duplicateOf,
        duplicateIndex: event.duplicateIndex,
        from: event.from,
        to: event.to,
        channel: event.channel,
        sentAt: event.sentAt,
        deliverAt: event.deliverAt,
        observedAt: this.now,
        latencyMs: event.latencyMs,
        sourceEpoch: event.sourceEpoch,
        targetEpoch: event.targetEpoch,
        status,
        reason,
      };
      if (status === 'delivered') {
        try {
          // A fresh clone on every delivery makes receiver mutation unable to
          // alter a queued duplicate or the evidence trace.
          receiver.receive(clone(event.payload), clone(record));
          delivered += 1;
        } catch (error) {
          record.status = 'receiver_error';
          record.reason = String(error && error.message || 'receiver_error').slice(0, 120);
          dropped += 1;
        }
      } else {
        dropped += 1;
      }
      this._trace.push(record);
    }
    return { ok: true, delivered, dropped, now: this.now, pending: this._queue.length };
  }

  advanceBy(delta) {
    const amount = integer(delta, 0, 0);
    return this.advanceTo(this.now + amount);
  }

  flush() {
    if (this._disposed) return { ok: false, reason: 'disposed', delivered: 0, dropped: 0 };
    let latest = this.now;
    for (const event of this._queue) latest = Math.max(latest, event.deliverAt);
    return this.advanceTo(latest);
  }

  pendingCount() {
    return this._queue.length;
  }

  trace() {
    return clone(this._trace);
  }

  snapshot() {
    return {
      evidenceClass: EVIDENCE_CLASS,
      seed: this.seed,
      now: this.now,
      pending: this._queue.length,
      endpoints: [...this._endpoints.entries()].map(([endpoint, state]) => ({ endpoint, connected: state.connected, epoch: state.epoch })),
      trace: this.trace(),
    };
  }

  traceDigest() {
    return digest(this._trace);
  }

  dispose() {
    if (this._disposed) return false;
    this._disposed = true;
    this._queue.length = 0;
    for (const state of this._endpoints.values()) state.connected = false;
    return true;
  }
}

module.exports = Object.freeze({
  EVIDENCE_CLASS,
  DeterministicTransport,
  clone,
  digest,
});
