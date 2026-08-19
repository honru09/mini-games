'use strict';

const crypto = require('crypto');

/*
 * ServerBoundaryAdapters T7 vertical slice.
 *
 * The external Interface is capture/handle/recordError.  Persistence varies
 * at one internal seam: the existing JSON runtime Adapter and an isolated
 * in-memory Adapter both satisfy load/save.  HTTP callers and tests therefore
 * exercise the same deep module without sharing its history or rate state.
 */

const ROUTES = new Set(['/api/metrics', '/api/metrics/history', '/api/metrics/export']);
const DEFAULT_HISTORY_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_HISTORY_LIMIT = 2016;
const DEFAULT_INCIDENT_LIMIT = 500;
const DEFAULT_RATE_LIMIT = 60;
const DEFAULT_RATE_WINDOW_MS = 60 * 1000;
const MAX_INCIDENT_NUMBER = Number.MAX_SAFE_INTEGER;

function frozen(value) {
  return Object.freeze(value);
}

function finiteInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function copyRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output = {};
  for (const [key, item] of Object.entries(value)) output[key] = item;
  return output;
}

function copyState(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    history: Array.isArray(source.history) ? source.history.map(copyRecord) : [],
    incidents: Array.isArray(source.incidents) ? source.incidents.map(copyRecord) : [],
  };
}

function createMemoryMetricsAdapter(initialState = {}) {
  let state = copyState(initialState);
  return frozen({
    load() {
      return copyState(state);
    },
    save(nextState) {
      state = copyState(nextState);
      return true;
    },
  });
}

function createJsonMetricsAdapter(options = {}) {
  const read = typeof options.read === 'function' ? options.read : null;
  const write = typeof options.write === 'function' ? options.write : null;
  if (!read || !write) throw new TypeError('metrics_adapter_callbacks_required');
  return frozen({
    load() {
      return copyState(read());
    },
    save(nextState) {
      write(copyState(nextState));
      return true;
    },
  });
}

function validAdapter(value) {
  return !!value && typeof value.load === 'function' && typeof value.save === 'function';
}

function safeNow(clock) {
  try {
    const value = Number(clock());
    if (Number.isFinite(value) && value >= 0) return value;
  } catch (_error) {}
  return Date.now();
}

function safeContext(value) {
  try {
    const text = String(value || '');
    return /^[a-z0-9_:-]{1,64}$/i.test(text) ? text : 'unknown';
  } catch (_error) {
    return 'unknown';
  }
}

function safeKind(error) {
  try {
    const text = String(typeof error === 'string' ? error : error && error.name || '');
    return /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(text) ? text : 'Error';
  } catch (_error) {
    return 'Error';
  }
}

function incidentCopy(value, shouldFreeze = true) {
  const fingerprint = String(value.fingerprint || '');
  const firstAt = finiteInteger(value.firstAt, 0, MAX_INCIDENT_NUMBER, 0);
  const lastAt = Math.max(firstAt, finiteInteger(value.lastAt, 0, MAX_INCIDENT_NUMBER, firstAt));
  const copy = {
    fingerprint: /^[a-f0-9]{16}$/.test(fingerprint) ? fingerprint : '',
    context: safeContext(value.context),
    kind: safeKind(value.kind),
    count: finiteInteger(value.count, 1, MAX_INCIDENT_NUMBER, 1),
    firstAt,
    lastAt,
  };
  return shouldFreeze ? frozen(copy) : copy;
}

function createOperationalMetricsBoundary(options = {}) {
  const adapter = options.adapter;
  if (!validAdapter(adapter)) throw new TypeError('metrics_adapter_required');
  const clock = typeof options.now === 'function' ? options.now : Date.now;
  const currentMetrics = typeof options.currentMetrics === 'function' ? options.currentMetrics : () => ({});
  const safeSnapshot = typeof options.safeSnapshot === 'function' ? options.safeSnapshot : copyRecord;
  const alerts = typeof options.alerts === 'function' ? options.alerts : () => [];
  const historyCsv = typeof options.historyCsv === 'function' ? options.historyCsv : () => '';
  const incrementMetric = typeof options.incrementMetric === 'function' ? options.incrementMetric : () => {};
  const onAccess = typeof options.onAccess === 'function' ? options.onAccess : () => {};
  const adminToken = String(options.adminToken || '').trim();
  const thresholds = frozen(copyRecord(options.thresholds));
  const historyIntervalMs = finiteInteger(options.historyIntervalMs, 1, 24 * 60 * 60 * 1000, DEFAULT_HISTORY_INTERVAL_MS);
  const historyLimit = finiteInteger(options.historyLimit, 1, 10000, DEFAULT_HISTORY_LIMIT);
  const incidentLimit = finiteInteger(options.incidentLimit, 1, 5000, DEFAULT_INCIDENT_LIMIT);
  const rateLimit = finiteInteger(options.rateLimit, 1, 10000, DEFAULT_RATE_LIMIT);
  const rateWindowMs = finiteInteger(options.rateWindowMs, 1, 60 * 60 * 1000, DEFAULT_RATE_WINDOW_MS);
  const rateBuckets = new Map();

  function normalizeHistory(history) {
    return (Array.isArray(history) ? history : []).map(item => safeSnapshot(item)).slice(-historyLimit);
  }

  function normalizeIncidents(incidents) {
    return (Array.isArray(incidents) ? incidents : []).filter(item => item &&
      /^[a-f0-9]{16}$/.test(String(item.fingerprint || '')) && item.context && item.kind)
      .slice(-incidentLimit).map(item => incidentCopy(item, false));
  }

  function loadState() {
    const loaded = copyState(adapter.load());
    return { history: normalizeHistory(loaded.history), incidents: normalizeIncidents(loaded.incidents) };
  }

  function saveState(state) {
    adapter.save({
      history: normalizeHistory(state.history),
      incidents: normalizeIncidents(state.incidents),
    });
  }

  function capture(force = false) {
    const now = safeNow(clock);
    const current = frozen(safeSnapshot(currentMetrics()));
    const state = loadState();
    const last = state.history[state.history.length - 1];
    const lastAt = last ? Date.parse(last.generatedAt) : 0;
    if (force === true || !last || !Number.isFinite(lastAt) || now - lastAt >= historyIntervalMs) {
      state.history.push(current);
      state.history = state.history.slice(-historyLimit);
      saveState(state);
    }
    return current;
  }

  function payload(force) {
    const data = capture(force);
    const state = loadState();
    const previous = state.history.length > 1 ? state.history[state.history.length - 2] : {};
    return frozen({
      version: 'metrics-v2',
      data,
      alerts: frozen((alerts(data, previous, thresholds) || []).map(copyRecord)),
      incidents: frozen(state.incidents.slice(-50).reverse().map(incidentCopy)),
    });
  }

  function pruneRates(now) {
    if (rateBuckets.size <= 2048) return;
    for (const [key, values] of rateBuckets) {
      if (!values.some(at => now - at < rateWindowMs)) rateBuckets.delete(key);
      if (rateBuckets.size <= 1024) break;
    }
    while (rateBuckets.size > 2048) rateBuckets.delete(rateBuckets.keys().next().value);
  }

  function authorize(input) {
    if (!adminToken) return frozen({ ok: false, status: 503, reason: 'metrics_not_configured' });
    const now = safeNow(clock);
    const ip = String(input.ip || '');
    const recent = (rateBuckets.get(ip) || []).filter(at => now - at < rateWindowMs);
    if (recent.length >= rateLimit) {
      rateBuckets.set(ip, recent);
      return frozen({ ok: false, status: 429, reason: 'metrics_rate_limited' });
    }
    recent.push(now);
    rateBuckets.set(ip, recent);
    pruneRates(now);
    const header = String(input.authorization || '');
    const match = /^Bearer\s+(.+)$/.exec(header);
    let valid = false;
    if (match && match[1].length === adminToken.length) {
      try {
        valid = crypto.timingSafeEqual(Buffer.from(match[1]), Buffer.from(adminToken));
      } catch (_error) {
        valid = false;
      }
    }
    if (!valid) return frozen({ ok: false, status: 401, reason: 'metrics_unauthorized' });
    return frozen({ ok: true, status: 200, ip });
  }

  function response(status, headers, body, access) {
    const output = { handled: true, status, headers: frozen(headers), body: String(body) };
    if (access) output.access = access;
    return frozen(output);
  }

  function handle(input = {}) {
    const route = String(input.path || '');
    if (String(input.method || 'GET').toUpperCase() !== 'GET' || !ROUTES.has(route)) {
      return frozen({ handled: false });
    }
    const auth = authorize(input);
    if (!auth.ok) {
      return response(auth.status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }, JSON.stringify({ error: auth.reason }));
    }
    try {
      const metricsPayload = payload(route === '/api/metrics');
      const access = frozen({
        path: route.slice(0, 80),
        ipHash: crypto.createHash('sha256').update(auth.ip).digest('hex').slice(0, 16),
      });
      onAccess(access);
      if (route === '/api/metrics/export') {
        const state = loadState();
        return response(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="mini-games-metrics.csv"',
          'Cache-Control': 'no-store',
        }, '\ufeff' + historyCsv(state.history), access);
      }
      let output = metricsPayload;
      if (route === '/api/metrics/history') {
        const state = loadState();
        output = { ...metricsPayload, history: frozen(state.history.map(item => frozen(copyRecord(item)))) };
      }
      return response(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }, JSON.stringify(output), access);
    } catch (_error) {
      return response(500, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }, JSON.stringify({ error: 'metrics_unavailable' }));
    }
  }

  function recordError(context, error) {
    try { incrementMetric('serverErrors'); } catch (_error) {}
    const normalizedContext = safeContext(context);
    const kind = safeKind(error);
    const fingerprint = crypto.createHash('sha256').update(normalizedContext + '|' + kind).digest('hex').slice(0, 16);
    const now = safeNow(clock);
    try {
      const state = loadState();
      const existing = state.incidents.find(item => item.fingerprint === fingerprint);
      if (existing) {
        const count = finiteInteger(existing.count, 1, MAX_INCIDENT_NUMBER, 1);
        existing.count = count >= MAX_INCIDENT_NUMBER ? MAX_INCIDENT_NUMBER : count + 1;
        existing.lastAt = now;
      } else {
        state.incidents.push({ fingerprint, context: normalizedContext, kind, count: 1, firstAt: now, lastAt: now });
      }
      state.incidents = state.incidents.slice(-incidentLimit);
      saveState(state);
      return frozen({ recorded: true, fingerprint, context: normalizedContext, kind });
    } catch (_error) {
      return frozen({ recorded: false, fingerprint, context: normalizedContext, kind });
    }
  }

  return frozen({ capture, handle, recordError });
}

module.exports = frozen({
  createOperationalMetricsBoundary,
  createJsonMetricsAdapter,
  createMemoryMetricsAdapter,
});
