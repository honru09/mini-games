'use strict';

const assert = require('assert');
const Metrics = require('../server/gameplay/metrics');
const {
  createMemoryMetricsAdapter,
  createOperationalMetricsBoundary,
} = require('../server/boundaries/operational-metrics');
const { ClusterCoordinator, safeMetrics } = require('../server/cluster-coordinator');

let checks = 0;
let failures = 0;

async function check(label, run) {
  checks += 1;
  try {
    await run();
    console.log('PASS  ' + label);
  } catch (error) {
    failures += 1;
    console.error('FAIL  ' + label + ' :: ' + (error && error.message || error));
  }
}

async function main() {
  const originalDateNow = Date.now;
  Date.now = () => { throw new Error('native_clock_must_not_be_read'); };
  try {
    await check('Gameplay snapshot signs generatedAt from the explicit server epoch', () => {
      assert.strictEqual(Metrics.snapshot({ activeMatches: 2 }, 1234).generatedAt, '1970-01-01T00:00:01.234Z');
      assert.strictEqual(Metrics.safeSnapshot({ activeMatches: 2 }, 2345).generatedAt, '1970-01-01T00:00:02.345Z');
      assert.strictEqual(Metrics.safeSnapshot({ generatedAt: 'trusted-upstream', activeMatches: 2 }, 9999).generatedAt, 'trusted-upstream');
    });

    await check('Operational Metrics samples one epoch and passes it through both snapshot seams', () => {
      const observed = [];
      const adapter = createMemoryMetricsAdapter();
      const boundary = createOperationalMetricsBoundary({
        adapter,
        now: () => 3456,
        currentMetrics: at => { observed.push(['current', at]); return Metrics.snapshot({ activeMatches: 1 }, at); },
        safeSnapshot: (input, at) => { observed.push(['safe', at]); return Metrics.safeSnapshot(input, at); },
      });
      const current = boundary.capture(true);
      assert.strictEqual(current.generatedAt, '1970-01-01T00:00:03.456Z');
      assert.deepStrictEqual(observed.slice(0, 2), [['current', 3456], ['safe', 3456]]);
      assert.strictEqual(adapter.load().history[0].generatedAt, current.generatedAt);
    });

    await check('Operational Metrics clock failure stays inside the injected seam', () => {
      const boundary = createOperationalMetricsBoundary({
        adapter: createMemoryMetricsAdapter(),
        now: () => { throw new Error('clock_adapter_failed'); },
        currentMetrics: at => Metrics.snapshot({ activeMatches: 0 }, at),
        safeSnapshot: Metrics.safeSnapshot,
      });
      assert.strictEqual(boundary.capture(true).generatedAt, '1970-01-01T00:00:00.000Z');
    });

    await check('Cluster metrics sanitizer uses its supplied epoch when generatedAt is absent', () => {
      assert.deepStrictEqual(safeMetrics({ activeMatches: 3, token: 'strip-me' }, 4567), {
        generatedAt: '1970-01-01T00:00:04.567Z',
        activeMatches: 3,
      });
    });

    await check('Cluster persistence receives the same injected epoch without changing payload shape', async () => {
      const calls = [];
      const coordinator = new ClusterCoordinator({
        enabled: true,
        instanceId: 'metrics-clock-test-instance',
        now: () => 5678,
        rpc: async (name, payload) => { calls.push({ name, payload }); return { id: '1' }; },
      });
      assert.strictEqual(await coordinator.recordMetrics({ activeMatches: 4 }), true);
      const append = calls.find(call => call.name === 'append_metrics_snapshot_v1');
      assert(append);
      assert.strictEqual(append.payload.p_generated_at, '1970-01-01T00:00:05.678Z');
      assert.deepStrictEqual(Object.keys(append.payload.p_payload).sort(), ['activeMatches', 'generatedAt']);
      coordinator.stop();
    });
  } finally {
    Date.now = originalDateNow;
  }

  if (failures) {
    console.error(`METRICS_CLOCK_SEAM_FAILURES=${failures}/${checks}`);
    process.exitCode = 1;
  } else {
    console.log(`METRICS_CLOCK_SEAM_ALL_PASS checks=${checks}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
