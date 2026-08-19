#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'server', 'boundaries', 'operational-metrics.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const INDEX_SOURCE = fs.readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
const Metrics = require('../server/gameplay/metrics');
const {
  createOperationalMetricsBoundary,
  createJsonMetricsAdapter,
  createMemoryMetricsAdapter,
} = require(MODULE_PATH);

let assertions = 0;
let failures = 0;

function check(label, run) {
  assertions += 1;
  try {
    run();
    console.log(`PASS  ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${label} :: ${error && error.message || error}`);
  }
}

function exactKeys(value, expected) {
  assert.deepStrictEqual(Object.keys(value).sort(), expected.slice().sort());
}

function fixture(adapter, overrides = {}) {
  let now = 1_700_000_000_000;
  const accesses = [];
  const increments = [];
  const boundary = createOperationalMetricsBoundary({
    adapter,
    adminToken: 'metrics-boundary-token',
    now: () => now,
    historyIntervalMs: 100,
    historyLimit: 3,
    incidentLimit: 4,
    rateLimit: 4,
    rateWindowMs: 1000,
    thresholds: { serverErrors: 1 },
    currentMetrics: () => ({ generatedAt: new Date(now).toISOString(), activeMatches: 2, activeSpectators: 1 }),
    safeSnapshot: Metrics.safeSnapshot,
    alerts: Metrics.alerts,
    historyCsv: Metrics.historyCsv,
    incrementMetric: name => increments.push(name),
    onAccess: access => accesses.push(access),
    ...overrides,
  });
  return {
    boundary,
    accesses,
    increments,
    now: () => now,
    setNow: value => { now = value; },
  };
}

function request(pathname, token = 'metrics-boundary-token', ip = '127.0.0.1') {
  return { method: 'GET', path: pathname, authorization: token ? 'Bearer ' + token : '', ip };
}

check('module exposes one boundary constructor and two concrete Adapter constructors', () => {
  exactKeys(require(MODULE_PATH), [
    'createOperationalMetricsBoundary', 'createJsonMetricsAdapter', 'createMemoryMetricsAdapter',
  ]);
  const memory = createMemoryMetricsAdapter();
  let runtime = { history: [], incidents: [] };
  const json = createJsonMetricsAdapter({ read: () => runtime, write: next => { runtime = next; } });
  exactKeys(memory, ['load', 'save']);
  exactKeys(json, ['load', 'save']);
  assert.notStrictEqual(memory.load, json.load);
  assert(Object.isFrozen(memory) && Object.isFrozen(json));
});

check('memory Adapter owns detached state rather than exposing a shared test object', () => {
  const initial = { history: [{ generatedAt: '2026-01-01T00:00:00.000Z', activeMatches: 1 }], incidents: [] };
  const adapter = createMemoryMetricsAdapter(initial);
  initial.history[0].activeMatches = 99;
  const first = adapter.load();
  assert.strictEqual(first.history[0].activeMatches, 1);
  first.history[0].activeMatches = 77;
  assert.strictEqual(adapter.load().history[0].activeMatches, 1);
  adapter.save({ history: [{ generatedAt: '2026-01-02T00:00:00.000Z', activeMatches: 2 }], incidents: [] });
  assert.strictEqual(adapter.load().history[0].activeMatches, 2);
});

check('JSON runtime Adapter reads the current runtime object and commits detached replacement state', () => {
  let writes = 0;
  let runtime = { history: [], incidents: [] };
  const adapter = createJsonMetricsAdapter({
    read: () => runtime,
    write: next => { writes += 1; runtime = next; },
  });
  runtime = { history: [{ generatedAt: '2026-01-01T00:00:00.000Z', activeMatches: 3 }], incidents: [] };
  assert.strictEqual(adapter.load().history[0].activeMatches, 3);
  const next = { history: [{ generatedAt: '2026-01-02T00:00:00.000Z', activeMatches: 4 }], incidents: [] };
  adapter.save(next);
  next.history[0].activeMatches = 44;
  assert.strictEqual(writes, 1);
  assert.strictEqual(runtime.history[0].activeMatches, 4);
});

check('deep boundary Interface stays at capture/handle/recordError', () => {
  const runtime = fixture(createMemoryMetricsAdapter());
  exactKeys(runtime.boundary, ['capture', 'handle', 'recordError']);
  assert(Object.isFrozen(runtime.boundary));
  assert(!Object.prototype.hasOwnProperty.call(runtime.boundary, 'adapter'));
  assert(!Object.prototype.hasOwnProperty.call(runtime.boundary, 'history'));
  assert(!Object.prototype.hasOwnProperty.call(runtime.boundary, 'incidents'));
});

check('capture hides cadence, sanitization and bounded history behind its result', () => {
  const adapter = createMemoryMetricsAdapter();
  const runtime = fixture(adapter);
  const first = runtime.boundary.capture(false);
  assert.deepStrictEqual(first, {
    generatedAt: '2023-11-14T22:13:20.000Z', activeMatches: 2, activeSpectators: 1,
  });
  assert.strictEqual(adapter.load().history.length, 1);
  runtime.setNow(runtime.now() + 99);
  runtime.boundary.capture(false);
  assert.strictEqual(adapter.load().history.length, 1);
  runtime.setNow(runtime.now() + 1);
  runtime.boundary.capture(false);
  assert.strictEqual(adapter.load().history.length, 2);
  for (let index = 0; index < 5; index += 1) {
    runtime.setNow(runtime.now() + 100);
    runtime.boundary.capture(false);
  }
  assert.strictEqual(adapter.load().history.length, 3);
});

check('HTTP result preserves metrics-v2 JSON, history and CSV wire shapes', () => {
  const adapter = createMemoryMetricsAdapter();
  const runtime = fixture(adapter);
  const current = runtime.boundary.handle(request('/api/metrics'));
  assert.strictEqual(current.handled, true);
  assert.strictEqual(current.status, 200);
  assert.strictEqual(current.headers['Content-Type'], 'application/json');
  assert.strictEqual(current.headers['Cache-Control'], 'no-store');
  const payload = JSON.parse(current.body);
  assert.strictEqual(payload.version, 'metrics-v2');
  assert.strictEqual(payload.data.activeMatches, 2);
  assert(Array.isArray(payload.alerts) && Array.isArray(payload.incidents));

  const history = runtime.boundary.handle(request('/api/metrics/history'));
  const historyPayload = JSON.parse(history.body);
  assert.strictEqual(history.status, 200);
  assert(Array.isArray(historyPayload.history) && historyPayload.history.length === 1);

  const exported = runtime.boundary.handle(request('/api/metrics/export'));
  assert.strictEqual(exported.status, 200);
  assert.strictEqual(exported.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.strictEqual(exported.headers['Content-Disposition'], 'attachment; filename="mini-games-metrics.csv"');
  assert(exported.body.startsWith('\ufeff"generatedAt"'));
  assert.strictEqual(runtime.accesses.length, 3);
  assert(runtime.accesses.every(access => /^\/api\/metrics/.test(access.path) && /^[a-f0-9]{16}$/.test(access.ipHash)));
});

check('authorization and per-IP rate limiting remain result-only and token-safe', () => {
  const missing = createOperationalMetricsBoundary({ adapter: createMemoryMetricsAdapter() });
  const unavailable = missing.handle(request('/api/metrics'));
  assert.strictEqual(unavailable.status, 503);
  assert.deepStrictEqual(JSON.parse(unavailable.body), { error: 'metrics_not_configured' });

  const runtime = fixture(createMemoryMetricsAdapter(), { rateLimit: 2, rateWindowMs: 1000 });
  const denied = runtime.boundary.handle(request('/api/metrics', 'wrong-token', '10.0.0.1'));
  assert.strictEqual(denied.status, 401);
  assert.deepStrictEqual(JSON.parse(denied.body), { error: 'metrics_unauthorized' });
  const deniedAgain = runtime.boundary.handle(request('/api/metrics', 'wrong-token', '10.0.0.1'));
  assert.strictEqual(deniedAgain.status, 401);
  const limited = runtime.boundary.handle(request('/api/metrics', 'metrics-boundary-token', '10.0.0.1'));
  assert.strictEqual(limited.status, 429);
  assert.deepStrictEqual(JSON.parse(limited.body), { error: 'metrics_rate_limited' });
  assert.strictEqual(runtime.accesses.length, 0);
  assert(!denied.body.includes('wrong-token'));
});

check('access audit failure fails closed without leaking the audit exception', () => {
  const runtime = fixture(createMemoryMetricsAdapter(), {
    onAccess() { throw new Error('Bearer secret-audit-token'); },
  });
  const result = runtime.boundary.handle(request('/api/metrics'));
  assert.strictEqual(result.status, 500);
  assert.deepStrictEqual(JSON.parse(result.body), { error: 'metrics_unavailable' });
  assert(!result.body.includes('secret-audit-token'));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'access'), false);
});

check('operational errors deduplicate through both Adapters and expose only categorical results', () => {
  for (const adapter of [
    createMemoryMetricsAdapter(),
    createJsonMetricsAdapter({
      read: () => state,
      write: next => { state = next; },
    }),
  ]) {
    var state = { history: [], incidents: [] };
    const runtime = fixture(adapter);
    const first = runtime.boundary.recordError('ws_handler', new TypeError('secret message one'));
    runtime.setNow(runtime.now() + 5);
    const second = runtime.boundary.recordError('ws_handler', new TypeError('different secret message'));
    assert.deepStrictEqual(first, second);
    const stored = adapter.load();
    assert.strictEqual(stored.incidents.length, 1);
    assert.strictEqual(stored.incidents[0].count, 2);
    assert.strictEqual(stored.incidents[0].context, 'ws_handler');
    assert.strictEqual(stored.incidents[0].kind, 'TypeError');
    assert(!JSON.stringify(stored).includes('secret message'));
    assert.deepStrictEqual(runtime.increments, ['serverErrors', 'serverErrors']);
  }
});

check('malicious persisted incidents from both Adapters are re-sanitized before the Metrics wire', () => {
  const maliciousState = () => ({
    history: [],
    incidents: [{
      fingerprint: '0123456789abcdef',
      context: 'Bearer secret-token-value',
      kind: 'Bearer secret-token-value',
      count: Infinity,
      firstAt: Infinity,
      lastAt: -Infinity,
    }],
  });
  let jsonState = maliciousState();
  const adapters = [
    createMemoryMetricsAdapter(maliciousState()),
    createJsonMetricsAdapter({ read: () => jsonState, write: next => { jsonState = next; } }),
  ];
  for (const adapter of adapters) {
    const runtime = fixture(adapter);
    const result = runtime.boundary.handle(request('/api/metrics'));
    assert.strictEqual(result.status, 200);
    const payload = JSON.parse(result.body);
    assert.strictEqual(payload.incidents.length, 1);
    assert.deepStrictEqual(payload.incidents[0], {
      fingerprint: '0123456789abcdef',
      context: 'unknown',
      kind: 'Error',
      count: 1,
      firstAt: 0,
      lastAt: 0,
    });
    assert(!result.body.includes('secret-token-value'));
    for (const key of ['count', 'firstAt', 'lastAt']) {
      assert(Number.isSafeInteger(payload.incidents[0][key]));
    }
  }
});

check('adapter failure is contained as a stable HTTP/error result', () => {
  const failing = Object.freeze({
    load() { throw new Error('storage unavailable'); },
    save() { throw new Error('storage unavailable'); },
  });
  const runtime = fixture(failing);
  const httpResult = runtime.boundary.handle(request('/api/metrics'));
  assert.strictEqual(httpResult.status, 500);
  assert.deepStrictEqual(JSON.parse(httpResult.body), { error: 'metrics_unavailable' });
  const errorResult = runtime.boundary.recordError('handler', new Error('private details'));
  assert.strictEqual(errorResult.recorded, false);
  assert.strictEqual(errorResult.context, 'handler');
  assert.strictEqual(errorResult.kind, 'Error');
});

check('server/index uses the JSON Adapter and boundary result without changing the old routes', () => {
  assert(INDEX_SOURCE.includes("require('./boundaries/operational-metrics')"));
  assert(INDEX_SOURCE.includes('createJsonMetricsAdapter'));
  assert(INDEX_SOURCE.includes('createOperationalMetricsBoundary'));
  assert(INDEX_SOURCE.includes("'/api/metrics/history'"));
  assert(INDEX_SOURCE.includes("'/api/metrics/export'"));
  assert(INDEX_SOURCE.includes('operationalMetricsBoundary.handle'));
  assert(INDEX_SOURCE.includes('operationalMetricsBoundary.capture'));
  assert(!/function metricsAdminAuthorized\s*\(/.test(INDEX_SOURCE));
  assert(!/function operationalMetricsPayload\s*\(/.test(INDEX_SOURCE));
});

check('module does not know about WebSocket, player profiles, rewards or Supabase', () => {
  [
    /WebSocket/, /\bprofiles?\b/i, /\breward\b/i, /\bSupabase\b/i,
    /server\/index/, /leaderboard\.json/, /DATA_DIR/,
  ].forEach(pattern => assert(!pattern.test(SOURCE), `unexpected coupling ${pattern}`));
});

if (failures) {
  console.error(`SERVER_BOUNDARY_ADAPTERS_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`SERVER_BOUNDARY_ADAPTERS_ALL_PASS assertions=${assertions}`);
}
