#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

if (typeof WebSocket === 'undefined') {
  const relaunched = spawnSync(process.execPath, ['--experimental-websocket', __filename], {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
  process.exit(relaunched.status === null ? 1 : relaunched.status);
}

const IsolatedServerTestGroup = require('../server/testing/isolated-test-group');
const IsolatedNodeProcess = require('../server/testing/isolated-node-process');
const { createMemoryMetricsAdapter, createOperationalMetricsBoundary } = require('../server/boundaries/operational-metrics');
const Metrics = require('../server/gameplay/metrics');
const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const NODE_PROBE = path.join(ROOT, 'server', 'testing', 'node-process-isolation-probe.js');
const NODE_FIXTURE = path.join(ROOT, 'server', 'testing', 'node-process-cache-fixture.js');
const NODE_HANG = path.join(ROOT, 'server', 'testing', 'node-process-hang.js');
const NODE_OUTPUT = path.join(ROOT, 'server', 'testing', 'node-process-output.js');

let assertions = 0;
let failures = 0;

async function check(label, run) {
  assertions += 1;
  try {
    await run();
    console.log(`PASS  ${label}`);
  } catch (error) {
    failures += 1;
    const detail = error && Array.isArray(error.errors)
      ? error.errors.map(item => item && item.message || item).join(' | ')
      : error && error.message || error;
    console.error(`FAIL  ${label} :: ${detail}`);
  }
}

function listenOnce(port, body) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((_request, response) => { response.end(body); });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      http.get({ host: '127.0.0.1', port, path: '/' }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => server.close(() => resolve(Buffer.concat(chunks).toString('utf8'))));
      }).on('error', error => server.close(() => reject(error)));
    });
  });
}

function pathEntryExists(target) {
  try { fs.lstatSync(target); return true; }
  catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function within(promise, milliseconds, reason) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(reason)), milliseconds);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

function requestServer(port, pathname = '/') {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: pathname }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
  });
}

async function waitForServer(record) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (record.child.exitCode !== null) throw new Error('lane_server_exited_' + record.child.exitCode);
    try {
      const response = await requestServer(record.port);
      if (response.status === 200) return response;
    } catch (_error) {}
    await delay(35);
  }
  throw new Error('lane_server_start_timeout_' + record.output.slice(-300));
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  try { await within(exited, 2000, 'lane_server_stop_timeout'); } catch (_error) {}
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    try { await within(exited, 2000, 'lane_server_kill_timeout'); } catch (_error) {}
  }
}

async function registerAccount(port, username) {
  const socket = new WebSocket('ws://127.0.0.1:' + port + '/ws');
  const messages = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('lane_websocket_open_timeout')), 5000);
    socket.onopen = () => { clearTimeout(timer); resolve(); };
    socket.onerror = () => { clearTimeout(timer); reject(new Error('lane_websocket_open_failed')); };
  });
  socket.onmessage = event => {
    try { messages.push(JSON.parse(String(event.data))); } catch (_error) {}
  };
  socket.send(JSON.stringify({
    type: 'register',
    payload: { authVersion: 2, username, password: 'LanePass!7x', lang: 'en-US' },
  }));
  const deadline = Date.now() + 8000;
  try {
    while (Date.now() < deadline) {
      const registered = messages.find(message => message && message.type === 'registered');
      if (registered) return registered;
      const failed = messages.find(message => message && (message.type === 'auth_error' || message.type === 'error'));
      if (failed) throw new Error('lane_register_failed_' + String(failed.reason || failed.type));
      await delay(20);
    }
    throw new Error('lane_register_timeout');
  } finally {
    try { socket.close(); } catch (_error) {}
  }
}

(async () => {
  await check('test group exposes only create().run()', async () => {
    assert.deepStrictEqual(Object.keys(IsolatedServerTestGroup), ['create']);
    const group = IsolatedServerTestGroup.create();
    assert.deepStrictEqual(Object.keys(group), ['run']);
    assert(Object.isFrozen(IsolatedServerTestGroup));
    assert(Object.isFrozen(group));
  });

  await check('isolated lanes own distinct port, DATA_DIR, account namespace and injectable clock while shared lanes stay serial', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-t7-group-'));
    const contexts = [];
    const sharedOrder = [];
    let isolatedActive = 0;
    let isolatedPeak = 0;
    let arrivals = 0;
    let releaseBarrier;
    const barrier = new Promise(resolve => { releaseBarrier = resolve; });

    function isolatedRun(expectedClock) {
      return async context => {
        contexts.push(context);
        isolatedActive += 1;
        isolatedPeak = Math.max(isolatedPeak, isolatedActive);
        arrivals += 1;
        if (arrivals === 2) releaseBarrier();
        await barrier;
        assert.strictEqual(context.clock.now(), expectedClock);
        const username = context.account('alpha');
        assert(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{4,20}$/.test(username));
        const env = context.serverEnv({ SUPABASE_URL: 'must-be-kept-explicitly-empty' });
        assert.strictEqual(env.PORT, String(context.port));
        assert.strictEqual(env.DATA_DIR, context.dataDir);
        assert.strictEqual(env.TEST_ACCOUNT_NAMESPACE, context.accountNamespace);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(env, 'TEST_CLOCK_EPOCH_MS'), false);
        fs.writeFileSync(path.join(context.dataDir, 'lane.json'), JSON.stringify({ username, clock: context.clock.now() }));
        const heard = await listenOnce(context.port, context.name);
        assert.strictEqual(heard, context.name);

        const adapter = createMemoryMetricsAdapter();
        const boundary = createOperationalMetricsBoundary({
          adapter,
          now: context.clock.now,
          historyIntervalMs: 1,
          currentMetrics: () => ({ generatedAt: new Date(context.clock.now()).toISOString(), activeMatches: 0 }),
          safeSnapshot: Metrics.safeSnapshot,
        });
        boundary.capture(true);
        context.clock.advance(25);
        boundary.capture(false);
        assert.strictEqual(adapter.load().history.length, 2);
        isolatedActive -= 1;
        return { port: context.port, dataDir: context.dataDir, username, clock: context.clock.now() };
      };
    }

    const group = IsolatedServerTestGroup.create({ root, prefix: 'parallel' });
    try {
      const results = await group.run({
        isolated: [
          { name: 'metrics-a', clockStart: 1000, run: isolatedRun(1000) },
          { name: 'metrics-b', clockStart: 9000, run: isolatedRun(9000) },
        ],
        shared: [
          { name: 'global-one', run: async () => { sharedOrder.push('one:start', 'one:end'); return 'one'; } },
          { name: 'global-two', run: async () => { sharedOrder.push('two:start', 'two:end'); return 'two'; } },
        ],
      });

      assert.strictEqual(isolatedPeak, 2, 'isolated lanes did not overlap');
      assert.strictEqual(new Set(contexts.map(context => context.port)).size, 2);
      assert.strictEqual(new Set(contexts.map(context => context.dataDir)).size, 2);
      assert.strictEqual(new Set(contexts.map(context => context.accountNamespace)).size, 2);
      assert.strictEqual(new Set(results.filter(item => item.group === 'isolated').map(item => item.value.username)).size, 2);
      assert.deepStrictEqual(sharedOrder, ['one:start', 'one:end', 'two:start', 'two:end']);
      assert.deepStrictEqual(results.map(item => item.group), ['isolated', 'isolated', 'shared', 'shared']);
      assert(results.every(item => item.ok === true));
      assert(contexts.every(context => !fs.existsSync(context.dataDir)), 'lane DATA_DIR was not cleaned');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await check('failed isolated lane still releases DATA_DIR and reports a grouped failure', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-t7-failure-'));
    let dataDir = '';
    const group = IsolatedServerTestGroup.create({ root, prefix: 'failure' });
    try {
      await assert.rejects(() => group.run({
        isolated: [{
          name: 'broken-lane',
          clockStart: 1,
          run: async context => { dataDir = context.dataDir; throw new Error('expected lane failure'); },
        }],
        shared: [],
      }), /isolated_test_group_failed/);
      assert(dataDir && !fs.existsSync(dataDir));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await check('fresh Node children isolate wall clock, module cache and environment snapshots', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-t7-process-'));
    const parentDateNow = Date.now;
    const parentFixture = require(NODE_FIXTURE);
    parentFixture.touches = 37;
    const previousMutation = process.env.ISOLATION_PARENT_MUTATION;
    process.env.ISOLATION_PARENT_MUTATION = 'captured-before-group';
    const retainedNodes = [];
    const group = IsolatedServerTestGroup.create({ root, prefix: 'process' });

    async function probeLane(context) {
      retainedNodes.push(context.node);
      const result = await context.node.run({
        script: NODE_PROBE,
        args: [NODE_FIXTURE],
        env: { ISOLATION_MARKER: context.name },
      });
      assert.strictEqual(result.ok, true, result.stderr || result.reason);
      const payload = JSON.parse(result.stdout);
      assert(Number.isInteger(payload.pid) && payload.pid > 0);
      assert.strictEqual(payload.env.lane, context.accountNamespace);
      assert.strictEqual(payload.env.marker, context.name);
      assert.strictEqual(payload.env.parentMutation, 'captured-before-group');
      assert.strictEqual(payload.cache.touches, 1);
      assert.strictEqual(payload.cache.fixtureLoadedPid, payload.pid);
      assert.strictEqual(payload.cache.present, true);
      assert(Number.isFinite(payload.wallClock.start) && payload.wallClock.start > 1e12);
      assert(Number.isFinite(payload.wallClock.end) && payload.wallClock.end >= payload.wallClock.start);
      assert(Number.isFinite(payload.wallClock.monotonicDurationMs) && payload.wallClock.monotonicDurationMs >= 0);
      assert.strictEqual(context.clock.now() < 10000, true, 'lane clock must not be injected into the child wall clock');
      return payload;
    }

    try {
      process.env.ISOLATION_PARENT_MUTATION = 'mutated-after-group';
      const results = await group.run({
        isolated: [
          { name: 'process-a', clockStart: 1000, run: probeLane },
          { name: 'process-b', clockStart: 9000, run: probeLane },
        ],
        shared: [],
      });
      const payloads = results.map(item => item.value);
      assert.strictEqual(new Set(payloads.map(item => item.pid)).size, 2);
      assert.strictEqual(new Set(payloads.map(item => item.env.lane)).size, 2);
      assert.strictEqual(parentFixture.touches, 37, 'child require cache must not mutate the parent module object');
      assert.strictEqual(Date.now, parentDateNow, 'child process harness must not monkey-patch Date.now');
      assert.strictEqual(retainedNodes.length, 2);
      for (const node of retainedNodes) {
        assert.deepStrictEqual(Object.keys(node).sort(), ['dispose', 'run']);
        assert(Object.isFrozen(node));
        await assert.rejects(() => node.run({ script: NODE_PROBE, args: [NODE_FIXTURE] }), /isolated_node_process_disposed/);
      }
    } finally {
      if (previousMutation === undefined) delete process.env.ISOLATION_PARENT_MUTATION;
      else process.env.ISOLATION_PARENT_MUTATION = previousMutation;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await check('child runner bounds timeout/output and rejects invalid environment input', async () => {
    const runner = IsolatedNodeProcess.create({
      cwd: ROOT,
      env: { NODE_ENV: 'test', ISOLATION_PARENT_MUTATION: 'fixed' },
      timeoutMs: 1000,
      maxOutputBytes: 4096,
    });
    const timedOut = await runner.run({ script: NODE_HANG, timeoutMs: 200 });
    assert.strictEqual(timedOut.ok, false);
    assert.strictEqual(timedOut.reason, 'timeout');
    assert(Number.isInteger(timedOut.pid) && timedOut.pid > 0);
    const limited = await runner.run({ script: NODE_OUTPUT, args: ['8192'], maxOutputBytes: 1024 });
    assert.strictEqual(limited.ok, false);
    assert.strictEqual(limited.reason, 'output_limit');
    assert(limited.stdout.length <= 1024);
    await assert.rejects(() => runner.run({ script: NODE_PROBE, env: 'not-an-object' }), /isolated_node_process_env_invalid/);
    await runner.dispose();
    await assert.rejects(() => runner.run({ script: NODE_PROBE, args: [NODE_FIXTURE] }), /isolated_node_process_disposed/);
  });

  await check('lane cleanup unlinks live and dangling external directory links without traversing targets', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-t7-root-guard-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-t7-outside-'));
    const liveTarget = path.join(outside, 'live-target');
    const danglingTarget = path.join(outside, 'dangling-target');
    const detachedTarget = path.join(outside, 'detached-target');
    const linkedDataDirs = [];
    fs.mkdirSync(liveTarget);
    fs.mkdirSync(danglingTarget);
    fs.writeFileSync(path.join(liveTarget, 'keep.txt'), 'live');
    fs.writeFileSync(path.join(danglingTarget, 'keep.txt'), 'dangling');
    const group = IsolatedServerTestGroup.create({ root, prefix: 'guard' });
    try {
      await group.run({
        isolated: [
          {
          name: 'live-external-link',
          run: async context => {
            linkedDataDirs.push(context.dataDir);
            fs.rmdirSync(context.dataDir);
            fs.symlinkSync(liveTarget, context.dataDir, process.platform === 'win32' ? 'junction' : 'dir');
          },
          },
          {
            name: 'dangling-external-link',
            run: async context => {
              linkedDataDirs.push(context.dataDir);
              fs.rmdirSync(context.dataDir);
              fs.symlinkSync(danglingTarget, context.dataDir, process.platform === 'win32' ? 'junction' : 'dir');
              fs.renameSync(danglingTarget, detachedTarget);
            },
          },
        ],
        shared: [],
      });
      assert.strictEqual(fs.readFileSync(path.join(liveTarget, 'keep.txt'), 'utf8'), 'live');
      assert.strictEqual(fs.readFileSync(path.join(detachedTarget, 'keep.txt'), 'utf8'), 'dangling');
      assert(linkedDataDirs.every(target => !pathEntryExists(target)), 'lane link path was not unlinked');
    } finally {
      for (const target of linkedDataDirs) if (pathEntryExists(target)) fs.unlinkSync(target);
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  await check('two real server/index lanes concurrently consume distinct ports, DATA_DIRs and account namespaces', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-t7-real-servers-'));
    const group = IsolatedServerTestGroup.create({ root, prefix: 'real-server' });
    let activeServers = 0;
    let peakServers = 0;
    let readyServers = 0;
    let releaseReady;
    const bothReady = new Promise(resolve => { releaseReady = resolve; });

    async function runRealServer(context) {
      const record = { port: context.port, child: null, output: '' };
      let countedActive = false;
      const env = context.serverEnv({
        ...process.env,
        SUPABASE_URL: '',
        SUPABASE_KEY: '',
        DEEPSEEK_KEY: '',
        ENABLE_CLUSTER_COORDINATION: '0',
        TEST_ADMIN_ENABLED: '0',
      });
      record.child = spawn(process.execPath, [SERVER], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
      record.child.stdout.on('data', chunk => { record.output += String(chunk); });
      record.child.stderr.on('data', chunk => { record.output += String(chunk); });
      try {
        const landing = await waitForServer(record);
        assert.strictEqual(landing.status, 200);
        activeServers += 1;
        countedActive = true;
        peakServers = Math.max(peakServers, activeServers);
        readyServers += 1;
        if (readyServers === 2) releaseReady();
        await within(bothReady, 8000, 'real_server_parallel_barrier_timeout');

        const username = context.account('live');
        const registered = await registerAccount(context.port, username);
        assert.strictEqual(registered.payload.profile.username, username);
        const databasePath = path.join(context.dataDir, 'leaderboard.json');
        const database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
        const usernames = Object.values(database.users || {}).map(user => user && user.username).filter(Boolean);
        assert(usernames.includes(username));
        return {
          port: context.port,
          dataDir: context.dataDir,
          accountNamespace: context.accountNamespace,
          username,
          usernames,
        };
      } finally {
        if (countedActive) activeServers -= 1;
        await stopServer(record.child);
      }
    }

    try {
      const results = await group.run({
        isolated: [
          { name: 'real-server-a', run: runRealServer },
          { name: 'real-server-b', run: runRealServer },
        ],
        shared: [],
      });
      const lanes = results.map(result => result.value);
      assert.strictEqual(peakServers, 2);
      assert.strictEqual(new Set(lanes.map(lane => lane.port)).size, 2);
      assert.strictEqual(new Set(lanes.map(lane => lane.dataDir)).size, 2);
      assert.strictEqual(new Set(lanes.map(lane => lane.accountNamespace)).size, 2);
      assert.strictEqual(new Set(lanes.map(lane => lane.username)).size, 2);
      for (const lane of lanes) {
        assert.deepStrictEqual(lane.usernames, [lane.username]);
        assert.strictEqual(pathEntryExists(lane.dataDir), false);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  if (failures) {
    console.error(`SERVER_TEST_ISOLATION_FAILURES=${failures}/${assertions}`);
    process.exitCode = 1;
  } else {
    console.log(`SERVER_TEST_ISOLATION_ALL_PASS assertions=${assertions}`);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
