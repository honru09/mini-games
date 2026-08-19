'use strict';

const path = require('path');

const rawFixturePath = String(process.argv[2] || '').trim();
const fixturePath = path.resolve(rawFixturePath || '.');
if (!rawFixturePath) {
  process.stderr.write('isolation_probe_fixture_required');
  process.exitCode = 2;
} else {
  const startedAt = process.hrtime.bigint();
  const fixture = require(fixturePath);
  fixture.touches = Number(fixture.touches || 0) + 1;
  const wallStart = Date.now();
  const wallEnd = Date.now();
  const elapsed = Number(process.hrtime.bigint() - startedAt) / 1e6;
  const resolvedFixture = require.resolve(fixturePath);
  process.stdout.write(JSON.stringify({
    pid: process.pid,
    env: {
      lane: process.env.TEST_ACCOUNT_NAMESPACE || '',
      marker: process.env.ISOLATION_MARKER || '',
      parentMutation: process.env.ISOLATION_PARENT_MUTATION || '',
    },
    cache: {
      fixturePath: resolvedFixture,
      fixtureLoadedPid: fixture.loadedPid,
      touches: fixture.touches,
      present: !!require.cache[resolvedFixture],
    },
    wallClock: {
      start: wallStart,
      end: wallEnd,
      monotonicDurationMs: Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : 0,
    },
  }));
}
