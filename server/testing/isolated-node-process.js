'use strict';

/*
 * T7 test-only process seam.
 *
 * A lane callback runs in the parent test process, while a real server (or a
 * probe) must run in a fresh Node process.  This module owns the awkward parts
 * of that boundary: an environment snapshot, bounded stdout/stderr capture,
 * timeout/child cleanup, and a monotonic duration.  It deliberately does not
 * monkey-patch Date.now(), NODE_OPTIONS, require.cache, or any server module.
 * A fresh child therefore gets Node's normal per-process wall clock and module
 * cache; callers can prove those properties without pretending to virtualize
 * production time.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 120_000;
const DEFAULT_OUTPUT_LIMIT = 256 * 1024;
const MAX_OUTPUT_LIMIT = 4 * 1024 * 1024;
const KILL_GRACE_MS = 250;

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

function normalizeEnv(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('isolated_node_process_env_required');
  }
  const output = {};
  for (const [key, value] of Object.entries(source)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (value === undefined || value === null) continue;
    output[key] = String(value);
  }
  return frozen(output);
}

function normalizeArgs(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError('isolated_node_process_args_invalid');
  return value.map(item => String(item));
}

function finiteBound(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

function resolveScript(cwd, value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('isolated_node_process_script_required');
  }
  const script = path.resolve(cwd, value);
  let stat;
  try { stat = fs.statSync(script); }
  catch (_error) { throw new Error('isolated_node_process_script_missing'); }
  if (!stat.isFile()) throw new Error('isolated_node_process_script_invalid');
  return script;
}

function terminate(child) {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null || child.signalCode) {
      resolve();
      return;
    }
    let settled = false;
    let forceTimer = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      resolve();
    };
    child.once('close', finish);
    forceTimer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_error) {}
      // A killed child normally emits close.  Do not leave dispose() hanging
      // forever when the OS refuses a signal or an exotic test double is used.
      setTimeout(finish, KILL_GRACE_MS);
    }, KILL_GRACE_MS);
    try { child.kill('SIGTERM'); }
    catch (_error) { finish(); }
  });
}

function create(options = {}) {
  const cwd = path.resolve(String(options.cwd || process.cwd()));
  const execPath = path.resolve(String(options.execPath || process.execPath));
  const execArgv = normalizeArgs(options.execArgv);
  const baseEnv = normalizeEnv(options.env === undefined ? process.env : options.env);
  const defaultTimeoutMs = finiteBound(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1, MAX_TIMEOUT_MS);
  const defaultOutputLimit = finiteBound(options.maxOutputBytes, DEFAULT_OUTPUT_LIMIT, 1024, MAX_OUTPUT_LIMIT);
  const active = new Set();
  let disposed = false;

  async function run(input = {}) {
    if (disposed) throw new Error('isolated_node_process_disposed');
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('isolated_node_process_input_required');
    }
    const script = resolveScript(input.cwd === undefined ? cwd : path.resolve(cwd, String(input.cwd)), input.script);
    const args = normalizeArgs(input.args);
    if (input.env !== undefined && (!input.env || typeof input.env !== 'object' || Array.isArray(input.env))) {
      throw new TypeError('isolated_node_process_env_invalid');
    }
    const runEnv = normalizeEnv({ ...baseEnv, ...(input.env === undefined ? {} : input.env) });
    const timeoutMs = finiteBound(input.timeoutMs, defaultTimeoutMs, 1, MAX_TIMEOUT_MS);
    const outputLimit = finiteBound(input.maxOutputBytes, defaultOutputLimit, 1024, MAX_OUTPUT_LIMIT);
    const startedAt = monotonicNow();

    return await new Promise(resolve => {
      let stdout = '';
      let stderr = '';
      let outputBytes = 0;
      let timedOut = false;
      let outputLimitReached = false;
      let spawnError = false;
      let settled = false;
      let timeoutHandle = null;
      let child;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (child) active.delete(child);
        const code = child && Number.isInteger(child.exitCode) ? child.exitCode : null;
        const signal = child && child.signalCode ? String(child.signalCode) : null;
        const reason = timedOut ? 'timeout' : outputLimitReached ? 'output_limit' : spawnError ? 'spawn_error' : code === 0 ? '' : 'nonzero_exit';
        resolve(frozen({
          ok: reason === '',
          code,
          signal,
          pid: child && Number.isInteger(child.pid) ? child.pid : null,
          reason,
          stdout,
          stderr,
          durationMs: durationMs(startedAt),
        }));
      };

      const capture = (target, chunk) => {
        if (settled || outputLimitReached) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        outputBytes += buffer.length;
        if (outputBytes > outputLimit) {
          outputLimitReached = true;
          if (child) terminate(child).finally(finish);
          return;
        }
        if (target === 'stdout') stdout += buffer.toString('utf8');
        else stderr += buffer.toString('utf8');
      };

      try {
        child = spawn(execPath, [...execArgv, script, ...args], {
          cwd: input.cwd === undefined ? cwd : path.resolve(cwd, String(input.cwd)),
          env: runEnv,
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        active.add(child);
        child.stdout.on('data', chunk => capture('stdout', chunk));
        child.stderr.on('data', chunk => capture('stderr', chunk));
        child.once('error', () => { spawnError = true; });
        child.once('close', finish);
        timeoutHandle = setTimeout(() => {
          if (settled) return;
          timedOut = true;
          terminate(child).finally(finish);
        }, timeoutMs);
      } catch (_error) {
        spawnError = true;
        if (child) terminate(child).finally(finish);
        else finish();
      }
    });
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    await Promise.all([...active].map(terminate));
  }

  return frozen({ run, dispose });
}

module.exports = frozen({ create });
