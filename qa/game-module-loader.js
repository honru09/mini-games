'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MessageChannel } = require('worker_threads');

const ROOT = path.resolve(__dirname, '..');
const loaderModule = require(path.join(ROOT, 'public', 'src', 'core', '14-game-module-loader.js'));
const { create, manifest } = loaderModule;

assert.strictEqual(typeof create, 'function', 'CommonJS exposes the test constructor');
assert.ok(manifest && typeof manifest === 'object', 'CommonJS exposes the frozen manifest');
assert.deepStrictEqual(Object.keys(manifest).sort(), ['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi']);

const expectedExports = {
  gomoku: ['isGomoku3DSupported', 'createGomoku3DAdapter'],
  ludo: ['isLudo3DSupported', 'createLudo3DAdapter'],
  monopoly: ['isMonopoly3DSupported', 'createMonopoly3DAdapter'],
  xiangqi: ['isXiangqi3DSupported', 'createXiangqi3DAdapter'],
  tetris: ['isTetris3DSupported', 'createTetris3DAdapter'],
  tank: ['isTank3DSupported', 'createTank3DAdapter'],
};

for (const [gameId, entry] of Object.entries(manifest)) {
  assert.strictEqual(entry.resource, 'renderer', `${gameId} is a renderer resource`);
  assert.match(entry.sha256, /^[a-f0-9]{64}$/, `${gameId} has a full SHA-256`);
  const diskHash = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, 'public', 'three', `${gameId}-entry.js`)))
    .digest('hex');
  assert.strictEqual(entry.sha256, diskHash, `${gameId} manifest digest matches its entry`);
  assert.deepStrictEqual([...entry.exports], expectedExports[gameId], `${gameId} export contract`);
  const primary = entry.variants.primary;
  assert.match(primary, new RegExp(`^\\./three/${gameId}-entry\\.js\\?v=sha256-[a-f0-9]{16}$`), `${gameId} primary URL is hash-versioned`);
  if (gameId === 'tank') {
    assert.match(entry.variants.retry1, /^\.\/three\/tank-entry\.js\?v=sha256-[a-f0-9]{16}-retry1$/, 'Tank retry1 is fixed and versioned');
  } else {
    assert.strictEqual(entry.variants.retry1, undefined, `${gameId} has no unapproved retry variant`);
  }
}

function frozenDeep(value) {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(frozenDeep);
}

function validModule(gameId, counters) {
  const result = {};
  const entry = manifest[gameId];
  entry.exports.forEach(name => {
    result[name] = function exportedFunction() {
      counters[name] = (counters[name] || 0) + 1;
      return true;
    };
  });
  return result;
}

async function main() {
  const messages = [];
  const sw = { controller: null };
  const controller = {
    postMessage(message, ports) {
      messages.push(message);
      if (message.type !== 'GAME_MODULE_DESCRIPTOR_CHECK_V1') return;
      const entry = manifest[message.gameId];
      const port = ports && ports[0];
      queueMicrotask(() => port.postMessage({
        type: 'GAME_MODULE_DESCRIPTOR_RESULT_V1', ok: true,
        cacheVersion: 'ghost-game-renderer-v17-20260819',
        gameId: message.gameId, resource: message.resource, variant: message.variant,
        url: entry.variants[message.variant], sha256: entry.sha256
      }));
    }
  };
  sw.controller = controller;
  const counters = {};
  let importCalls = 0;
  let resolveImport;
  const pendingImport = new Promise(resolve => { resolveImport = resolve; });
  const moduleValue = validModule('gomoku', counters);
  const loader = create({
    serviceWorker: sw,
    importModule(url) {
      importCalls += 1;
      assert.strictEqual(url, manifest.gomoku.variants.primary);
      return pendingImport;
    },
  });

  assert.deepStrictEqual(loader.prefetch('gomoku'), {
    accepted: true, gameId: 'gomoku', resource: 'renderer', variant: 'primary', reason: 'queued'
  });
  assert.deepStrictEqual(messages, [{ type: 'GAME_MODULE_WARMUP_V1', gameId: 'gomoku', resource: 'renderer', variant: 'primary' }]);
  assert.deepStrictEqual(loader.prefetch('../gomoku-entry.js'), { accepted: false, reason: 'invalid_game' });
  assert.strictEqual(loader.prefetch('gomoku').accepted, true, 'prefetch only sends another safe intent');
  assert.strictEqual(importCalls, 0, 'prefetch does not import');
  assert.strictEqual(Object.keys(counters).length, 0, 'prefetch does not call module exports');

  const first = loader.load('gomoku');
  const second = loader.load('gomoku');
  assert.strictEqual(first, second, 'same game load is single-flight');
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(importCalls, 1, 'single-flight performs one import');
  resolveImport(moduleValue);
  const [loaded, loadedAgain] = await Promise.all([first, second]);
  assert.strictEqual(loaded.ok, true);
  assert.strictEqual(loaded.module, moduleValue);
  assert.strictEqual(loadedAgain.module, moduleValue);
  assert.ok(frozenDeep(loaded), 'load result is deeply frozen');
  assert.deepStrictEqual(counters, {}, 'loader validates exports but never invokes them');
  const cached = await loader.load('gomoku');
  assert.strictEqual(cached.module, moduleValue);
  assert.strictEqual(importCalls, 1, 'successful module is cached');

  assert.strictEqual((await loader.load('gomoku', { resource: 'game' })).reason, 'invalid_resource');
  assert.strictEqual((await loader.load('gomoku', { variant: 'retry1' })).reason, 'invalid_variant');
  assert.strictEqual((await loader.load('gomoku', { variant: '../three/tank-entry.js' })).reason, 'invalid_variant');
  assert.strictEqual((await loader.load('not-a-game')).reason, 'invalid_game');

  const noWorker = create({ importModule: () => Promise.resolve(validModule('tank', {})) });
  assert.deepStrictEqual(noWorker.prefetch('tank'), {
    accepted: false, gameId: 'tank', resource: 'renderer', variant: 'primary', reason: 'no_service_worker'
  });

  let failureCalls = 0;
  const retryLoader = create({
    importModule(url) {
      failureCalls += 1;
      if (failureCalls === 1) return Promise.reject(new Error('private failure text must not escape'));
      assert.strictEqual(url, manifest.ludo.variants.primary);
      return Promise.resolve(validModule('ludo', {}));
    },
  });
  const failed = await retryLoader.load('ludo');
  assert.deepStrictEqual({ ok: failed.ok, status: failed.status, reason: failed.reason, fallback: failed.fallback },
    { ok: false, status: 'fallback', reason: 'import_failed', fallback: 'inline' });
  assert.ok(frozenDeep(failed), 'failure result is frozen');
  const recovered = await retryLoader.load('ludo');
  assert.strictEqual(recovered.ok, true, 'failed loads are not negatively cached');
  assert.strictEqual(failureCalls, 2);

  let tankUrls = [];
  const tankLoader = create({
    importModule(url) {
      tankUrls.push(url);
      return Promise.resolve(validModule('tank', {}));
    },
  });
  assert.strictEqual((await tankLoader.load('tank', { variant: 'retry1' })).ok, true);
  assert.deepStrictEqual(tankUrls, [manifest.tank.variants.retry1], 'Tank retry1 is explicit and bounded');

  let invalidModuleCalls = 0;
  const invalidLoader = create({ importModule: () => { invalidModuleCalls += 1; return Promise.resolve({}); } });
  assert.strictEqual((await invalidLoader.load('xiangqi')).reason, 'module_invalid');
  assert.strictEqual((await invalidLoader.load('xiangqi')).reason, 'module_invalid');
  assert.strictEqual(invalidModuleCalls, 2, 'invalid modules are not cached as successes');

  let blockedImports = 0;
  const silentControllerLoader = create({
    serviceWorker: { controller: { postMessage() {} } },
    messageChannelFactory: () => new MessageChannel(),
    setTimeout(callback) { queueMicrotask(callback); return 1; },
    clearTimeout() {},
    importModule() { blockedImports += 1; return Promise.resolve(validModule('gomoku', {})); }
  });
  assert.strictEqual((await silentControllerLoader.load('gomoku')).reason, 'service_worker_descriptor_unavailable',
    'an old/silent controlling SW must fail to the inline renderer');
  assert.strictEqual(blockedImports, 0, 'an old/silent controlling SW must not permit an unverified import');

  const mismatchControllerLoader = create({
    serviceWorker: { controller: { postMessage(message, ports) {
      if (message.type === 'GAME_MODULE_DESCRIPTOR_CHECK_V1') queueMicrotask(() => ports[0].postMessage({
        type: 'GAME_MODULE_DESCRIPTOR_RESULT_V1', ok: true, cacheVersion: 'ghost-game-renderer-stale',
        gameId: message.gameId, resource: message.resource, variant: message.variant,
        url: manifest[message.gameId].variants[message.variant], sha256: manifest[message.gameId].sha256
      }));
    } } },
    messageChannelFactory: () => new MessageChannel(),
    importModule() { blockedImports += 1; return Promise.resolve(validModule('gomoku', {})); }
  });
  assert.strictEqual((await mismatchControllerLoader.load('gomoku')).reason, 'service_worker_descriptor_mismatch',
    'a stale cache generation must fail closed before import');
  assert.strictEqual(blockedImports, 0, 'a stale descriptor response must not permit import');

  const changingServiceWorker = { controller: null };
  const firstController = { postMessage(message, ports) {
    if (message.type !== 'GAME_MODULE_DESCRIPTOR_CHECK_V1') return;
    changingServiceWorker.controller = { postMessage() {} };
    queueMicrotask(() => ports[0].postMessage({
      type: 'GAME_MODULE_DESCRIPTOR_RESULT_V1', ok: true, cacheVersion: 'ghost-game-renderer-v17-20260819',
      gameId: message.gameId, resource: message.resource, variant: message.variant,
      url: manifest[message.gameId].variants[message.variant], sha256: manifest[message.gameId].sha256
    }));
  } };
  changingServiceWorker.controller = firstController;
  const changedControllerLoader = create({
    serviceWorker: changingServiceWorker,
    messageChannelFactory: () => new MessageChannel(),
    importModule() { blockedImports += 1; return Promise.resolve(validModule('gomoku', {})); }
  });
  assert.strictEqual((await changedControllerLoader.load('gomoku')).reason, 'service_worker_changed',
    'controller replacement during descriptor proof must invalidate stale work');
  assert.strictEqual(blockedImports, 0, 'controller replacement must not permit the stale import');

  console.log('GAME_MODULE_LOADER_ALL_PASS');
}

main().catch(error => {
  console.error(error && error.stack || String(error));
  process.exitCode = 1;
});
