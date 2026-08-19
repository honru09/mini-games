'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const IsolatedNodeProcess = require('./isolated-node-process');

function frozen(value) {
  return Object.freeze(value);
}

function monotonicNow() {
  return process.hrtime.bigint();
}

function durationMs(startedAt) {
  const elapsed = Number(monotonicNow() - startedAt) / 1e6;
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : 0;
}

function environmentSnapshot(source) {
  const output = {};
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source : process.env;
  for (const [key, value] of Object.entries(input)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (value === undefined || value === null) continue;
    output[key] = String(value);
  }
  return frozen(output);
}

function safeName(value, fallback) {
  const text = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  return text || fallback;
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const reservation = http.createServer();
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', () => {
      const address = reservation.address();
      if (!address || !address.port) {
        reservation.close();
        reject(new Error('test_lane_port_unavailable'));
        return;
      }
      resolve({ port: address.port, reservation });
    });
  });
}

function closeServer(server) {
  return new Promise(resolve => {
    if (!server || !server.listening) { resolve(); return; }
    server.close(() => resolve());
  });
}

function assertChildPath(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  const outsideRoot = !relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
  if (outsideRoot) throw new Error('test_lane_data_dir_outside_root');
  return resolvedTarget;
}

function lstatEntry(target) {
  try { return fs.lstatSync(target); }
  catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function removeLaneData(root, dataDir) {
  if (!dataDir) return;
  const lanePath = assertChildPath(root, dataDir);
  const entry = lstatEntry(lanePath);
  if (!entry) return;
  if (entry.isSymbolicLink()) {
    fs.unlinkSync(lanePath);
    return;
  }
  const resolvedRoot = fs.realpathSync(root);
  const resolvedDataDir = fs.realpathSync(lanePath);
  assertChildPath(resolvedRoot, resolvedDataDir);
  fs.rmSync(resolvedDataDir, { recursive: true, force: true });
}

function createClock(start) {
  let current = Number.isFinite(Number(start)) ? Number(start) : Date.now();
  return frozen({
    now() { return current; },
    advance(milliseconds) {
      const delta = Number(milliseconds);
      if (!Number.isFinite(delta) || delta < 0) throw new TypeError('test_lane_clock_delta_invalid');
      current += delta;
      return current;
    },
    set(value) {
      const next = Number(value);
      if (!Number.isFinite(next) || next < current) throw new TypeError('test_lane_clock_rollback');
      current = next;
      return current;
    },
  });
}

function accountFactory(namespace) {
  let sequence = 0;
  return label => {
    sequence += 1;
    const suffix = String(label || 'user').replace(/[^A-Za-z0-9]/g, '').slice(0, 5) || 'user';
    return (namespace + suffix + sequence.toString(36)).slice(0, 20);
  };
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') throw new TypeError('test_group_plan_required');
  const isolated = Array.isArray(plan.isolated) ? plan.isolated : [];
  const shared = Array.isArray(plan.shared) ? plan.shared : [];
  if (!isolated.length) throw new TypeError('test_group_isolated_lane_required');
  const names = new Set();
  for (const entry of [...isolated, ...shared]) {
    if (!entry || typeof entry.run !== 'function') throw new TypeError('test_group_run_required');
    const name = safeName(entry.name, 'lane');
    if (names.has(name)) throw new TypeError('test_group_name_duplicate');
    names.add(name);
  }
  return { isolated, shared };
}

function create(options = {}) {
  const root = path.resolve(String(options.root || os.tmpdir()));
  const prefix = safeName(options.prefix, 'mini-games-lane');
  const processCwd = path.resolve(String(options.cwd || process.cwd()));
  const inheritedEnv = environmentSnapshot(options.env);
  const childTimeoutMs = options.childTimeoutMs;
  const childOutputLimit = options.childOutputLimit;

  async function prepare(entry, index) {
    fs.mkdirSync(root, { recursive: true });
    const name = safeName(entry.name, 'lane-' + index);
    const reservation = await reservePort();
    let dataDir = '';
    let node = null;
    try {
      dataDir = fs.mkdtempSync(path.join(root, prefix + '-' + name + '-'));
      const namespace = ('T7' + crypto.randomBytes(3).toString('hex') + index.toString(36)).slice(0, 10);
      const clock = createClock(entry.clockStart);
      const account = accountFactory(namespace);
      const laneEnv = {
        ...inheritedEnv,
        PORT: String(reservation.port),
        DATA_DIR: dataDir,
        NODE_ENV: 'test',
        TEST_ACCOUNT_NAMESPACE: namespace,
      };
      node = IsolatedNodeProcess.create({
        cwd: processCwd,
        env: laneEnv,
        timeoutMs: childTimeoutMs,
        maxOutputBytes: childOutputLimit,
      });
      const context = {
        name,
        port: reservation.port,
        dataDir,
        accountNamespace: namespace,
        clock,
        account,
        node,
        serverEnv(extra = {}) {
          return frozen({
            ...inheritedEnv,
            ...extra,
            PORT: String(reservation.port),
            DATA_DIR: dataDir,
            NODE_ENV: 'test',
            TEST_ACCOUNT_NAMESPACE: namespace,
          });
        },
      };
      return { entry, reservation: reservation.reservation, dataDir, node, context: frozen(context) };
    } catch (error) {
      if (node) await node.dispose();
      await closeServer(reservation.reservation);
      removeLaneData(root, dataDir);
      throw error;
    }
  }

  async function executeIsolated(prepared) {
    const startedAt = monotonicNow();
    await closeServer(prepared.reservation);
    try {
      const value = await prepared.entry.run(prepared.context);
      return frozen({ name: prepared.context.name, group: 'isolated', ok: true, durationMs: durationMs(startedAt), value });
    } finally {
      await prepared.node.dispose();
      removeLaneData(root, prepared.dataDir);
    }
  }

  async function run(plan) {
    const groups = validatePlan(plan);
    const prepared = [];
    try {
      for (let index = 0; index < groups.isolated.length; index += 1) {
        prepared.push(await prepare(groups.isolated[index], index));
      }
    } catch (error) {
      await Promise.all(prepared.map(item => closeServer(item.reservation)));
      await Promise.all(prepared.map(item => item.node.dispose()));
      prepared.forEach(item => removeLaneData(root, item.dataDir));
      throw error;
    }
    const portSet = new Set(prepared.map(item => item.context.port));
    const directorySet = new Set(prepared.map(item => item.context.dataDir));
    const accountSet = new Set(prepared.map(item => item.context.accountNamespace));
    if (portSet.size !== prepared.length || directorySet.size !== prepared.length || accountSet.size !== prepared.length) {
      await Promise.all(prepared.map(item => closeServer(item.reservation)));
      await Promise.all(prepared.map(item => item.node.dispose()));
      prepared.forEach(item => removeLaneData(root, item.dataDir));
      throw new Error('test_group_isolation_collision');
    }

    const isolatedSettled = await Promise.allSettled(prepared.map(executeIsolated));
    const isolatedResults = [];
    const errors = [];
    isolatedSettled.forEach((item, index) => {
      if (item.status === 'fulfilled') isolatedResults.push(item.value);
      else errors.push(new Error(prepared[index].context.name + ': ' + String(item.reason && item.reason.message || item.reason)));
    });
    if (errors.length) throw new AggregateError(errors, 'isolated_test_group_failed');

    const sharedResults = [];
    for (const entry of groups.shared) {
      const name = safeName(entry.name, 'shared');
      const startedAt = monotonicNow();
      const value = await entry.run();
      sharedResults.push(frozen({ name, group: 'shared', ok: true, durationMs: durationMs(startedAt), value }));
    }
    return frozen([...isolatedResults, ...sharedResults]);
  }

  return frozen({ run });
}

module.exports = frozen({ create });
