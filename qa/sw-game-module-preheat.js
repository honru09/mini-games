'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SW_URL = 'https://ghost.game/mini-games/sw.js';
const SCOPE_URL = new URL('.', SW_URL);
const source = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const rendererCacheName = /const RENDERER_CACHE_VERSION='([^']+)'/.exec(source);
const shellCacheName = /const CACHE_VERSION='([^']+)'/.exec(source);

assert.ok(shellCacheName && shellCacheName[1] === 'ghost-game-shell-v14-20260816', 'SW must use the v14 shell cache generation');
assert.ok(rendererCacheName && rendererCacheName[1] === 'ghost-game-renderer-v17-20260819', 'renderer entries must use the dedicated v17 cache after the Honru/context runtime update');

const DEFINITIONS = Object.freeze({
  gomoku: Object.freeze({ file: 'gomoku-entry.js', exports: Object.freeze(['isGomoku3DSupported', 'createGomoku3DAdapter']) }),
  ludo: Object.freeze({ file: 'ludo-entry.js', exports: Object.freeze(['isLudo3DSupported', 'createLudo3DAdapter']) }),
  monopoly: Object.freeze({ file: 'monopoly-entry.js', exports: Object.freeze(['isMonopoly3DSupported', 'createMonopoly3DAdapter']) }),
  xiangqi: Object.freeze({ file: 'xiangqi-entry.js', exports: Object.freeze(['isXiangqi3DSupported', 'createXiangqi3DAdapter']) }),
  tetris: Object.freeze({ file: 'tetris-entry.js', exports: Object.freeze(['isTetris3DSupported', 'createTetris3DAdapter']) }),
  tank: Object.freeze({ file: 'tank-entry.js', exports: Object.freeze(['isTank3DSupported', 'createTank3DAdapter']) })
});

function expectedDescriptors() {
  return Object.fromEntries(Object.entries(DEFINITIONS).map(([gameId, definition]) => {
    const bytes = fs.readFileSync(path.join(ROOT, 'public', 'three', definition.file));
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    return [gameId, {
      gameId,
      resource: 'renderer',
      variant: 'primary',
      url: `./three/${definition.file}?v=sha256-${sha256.slice(0, 16)}`,
      sha256,
      exports: [...definition.exports]
    }];
  }));
}

function cloneDescriptorMap(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizedDescriptorMap(value) {
  const output = {};
  for (const gameId of Object.keys(DEFINITIONS)) {
    const descriptor = value && value[gameId];
    output[gameId] = {
      gameId: descriptor && descriptor.gameId,
      resource: descriptor && descriptor.resource,
      variant: descriptor && descriptor.variant || 'primary',
      url: descriptor && (descriptor.url || descriptor.variants && descriptor.variants.primary),
      sha256: descriptor && descriptor.sha256,
      exports: descriptor && Array.isArray(descriptor.exports) ? [...descriptor.exports] : descriptor && descriptor.exports
    };
  }
  return output;
}

function requestUrl(input) {
  const raw = typeof input === 'string' ? input : input && input.url;
  return new URL(raw, SW_URL).href;
}

function basicResponse(body, init) {
  const response = new Response(body, init);
  Object.defineProperty(response, 'type', { value: 'basic' });
  return response;
}

function createHarness() {
  const handlers = new Map();
  const stores = new Map();
  const fetchCalls = [];
  let networkFetch = async input => responseFor(requestUrl(input));
  let rejectCachePut = false;
  let skipWaitingCalls = 0;
  const self = {
    location: new URL(SW_URL),
    crypto: crypto.webcrypto,
    clients: { claim: async () => undefined },
    skipWaiting: async () => { skipWaitingCalls += 1; },
    addEventListener(type, handler) { handlers.set(type, handler); }
  };

  function responseFor(url) {
    const parsed = new URL(url);
    const locale = /\/locales\/(zh-CN|en-US|uk-UA)\.json$/.exec(parsed.pathname);
    if (locale) {
      return basicResponse(fs.readFileSync(path.join(ROOT, 'public', 'locales', `${locale[1]}.json`)), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    const entry = /\/three\/([a-z-]+-entry\.js)$/.exec(parsed.pathname);
    if (entry) {
      return basicResponse(fs.readFileSync(path.join(ROOT, 'public', 'three', entry[1])), {
        status: 200,
        headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
      });
    }
    return basicResponse('<!doctype html><title>Ghost Game</title>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(inputs) {
          for (const input of inputs) store.set(requestUrl(input), responseFor(requestUrl(input)));
        },
        async match(input) {
          const response = store.get(requestUrl(input));
          return response ? response.clone() : undefined;
        },
        async put(input, response) {
          if (rejectCachePut) throw new Error('simulated_cache_quota');
          store.set(requestUrl(input), response.clone());
        },
        async delete(input) {
          return store.delete(requestUrl(input));
        }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };

  const context = { self, caches, URL, Response, Promise, Set, Uint8Array };
  context.fetch = (input, init) => {
    fetchCalls.push({ url: requestUrl(input), cache: init && init.cache });
    return networkFetch(input, init);
  };
  vm.runInNewContext(`${source}\n;globalThis.__rendererEntries=RENDERER_ENTRY_ALLOWLIST;globalThis.__tankRetryEntry=TANK_RETRY_DESCRIPTOR;`, context, { filename: 'public/sw.js' });

  function install() {
    let work;
    handlers.get('install')({ waitUntil(promise) { work = Promise.resolve(promise); } });
    assert.ok(work, 'install must register work');
    return work;
  }
  function dispatchMessage(data, options = {}) {
    let work;
    const sourceClient = options.source === undefined ? {
      id: 'client-1',
      url: 'https://ghost.game/mini-games/index.html',
      postMessage() {}
    } : options.source;
    handlers.get('message')({
      data,
      source: sourceClient,
      origin: options.origin === undefined ? 'https://ghost.game' : options.origin,
      ports: Array.isArray(options.ports) ? options.ports : [],
      waitUntil(promise) { work = Promise.resolve(promise); }
    });
    return work;
  }
  function dispatchFetch(url, destination = 'script') {
    const request = new Request(url);
    Object.defineProperty(request, 'destination', { value: destination });
    let response;
    handlers.get('fetch')({ request, respondWith(value) { response = Promise.resolve(value); } });
    return response;
  }
  return {
    handlers,
    stores,
    fetchCalls,
    self,
    get rendererEntries() { return context.__rendererEntries; },
    get tankRetryEntry() { return context.__tankRetryEntry; },
    get skipWaitingCalls() { return skipWaitingCalls; },
    get rejectCachePut() { return rejectCachePut; },
    set rejectCachePut(value) { rejectCachePut = value === true; },
    setNetworkFetch(value) { networkFetch = value; },
    install,
    dispatchMessage,
    dispatchFetch,
    cache(name) { return caches.open(name); },
    responseFor
  };
}

function descriptorMapFromLoader(value, seen) {
  if (!value || typeof value !== 'object') return null;
  const visited = seen || new Set();
  if (visited.has(value)) return null;
  visited.add(value);
  const keys = Object.keys(value);
  if (Object.keys(DEFINITIONS).every(key => {
    const descriptor = value[key];
    return descriptor && (typeof descriptor.url === 'string' || descriptor.variants && typeof descriptor.variants.primary === 'string') &&
      typeof descriptor.sha256 === 'string' && Array.isArray(descriptor.exports);
  })) return value;
  for (const key of keys.slice(0, 32)) {
    const nested = descriptorMapFromLoader(value[key], visited);
    if (nested) return nested;
  }
  return null;
}

async function main() {
  const expected = expectedDescriptors();
  const harness = createHarness();
  assert.deepStrictEqual(normalizedDescriptorMap(harness.rendererEntries), expected,
    'SW allowlist must bind every fixed renderer URL, full SHA-256, and required exports to the current entry bytes');
  const expectedTankRetry = {
    ...expected.tank,
    variant: 'retry1',
    url: `${expected.tank.url}-retry1`
  };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(harness.tankRetryEntry)), expectedTankRetry,
    'SW must bind the one Tank retry URL to the same full entry digest and exports');

  const shellMatch = source.match(/const SHELL=(\[[^;]+\]);/);
  assert.ok(shellMatch, 'shell list must remain statically auditable');
  const shell = JSON.parse(shellMatch[1].replace(/'/g, '"'));
  for (const forbidden of ['three/', 'vendor/three/', 'vendor/gsap/', 'route-motion-entry.js', 'surface-motion-entry.js']) {
    assert.ok(!shell.some(item => String(item).includes(forbidden)), `install shell must not preload ${forbidden}`);
  }

  await harness.install();
  assert.ok(!harness.stores.has(rendererCacheName[1]), 'install must not even open the renderer cache');
  assert.ok(!harness.fetchCalls.some(call => /\/(?:three|vendor)\//.test(new URL(call.url).pathname)),
    'install/login shell work must not fetch renderer, Three, or GSAP resources');

  const descriptor = expected.tetris;
  const absolute = new URL(descriptor.url, SW_URL).href;
  const invalidPayloads = [
    { ...descriptor, type: 'GAME_MODULE_WARMUP_V1' },
    { type: 'GAME_MODULE_WARMUP_V1', gameId: 'tetris', resource: 'renderer', variant: 'retry1' },
    { type: 'GAME_MODULE_WARMUP_V1', gameId: 'tetris', resource: 'worker', variant: 'primary' },
    { type: 'GAME_MODULE_WARMUP_V1', gameId: 'unknown', resource: 'renderer', variant: 'primary' },
    { type: 'GAME_MODULE_WARMUP_V1', gameId: 'tetris', resource: 'renderer', variant: 'primary', url: absolute }
  ];
  for (const payload of invalidPayloads) {
    const before = harness.fetchCalls.length;
    assert.strictEqual(harness.dispatchMessage(payload), undefined, 'invalid or URL-bearing warmup messages must not schedule work');
    assert.strictEqual(harness.fetchCalls.length, before, 'invalid warmup messages must not fetch');
  }
  assert.strictEqual(harness.dispatchMessage({ type: 'GAME_MODULE_WARMUP_V1', gameId: 'tetris', resource: 'renderer', variant: 'primary' }, {
    source: { id: 'cross-origin', url: 'https://evil.example/app', postMessage() {} },
    origin: 'https://evil.example'
  }), undefined, 'cross-origin senders must not warm an entry');
  assert.strictEqual(harness.dispatchMessage({ type: 'GAME_MODULE_WARMUP_V1', gameId: 'tetris', resource: 'renderer', variant: 'primary' }, { source: null }), undefined,
    'a non-Client sender must not warm an entry');

  let descriptorReply = null;
  harness.dispatchMessage({
    type: 'GAME_MODULE_DESCRIPTOR_CHECK_V1', gameId: 'tank', resource: 'renderer', variant: 'retry1', sha256: expected.tank.sha256
  }, { ports: [{ postMessage(value) { descriptorReply = value; } }] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(descriptorReply)), {
    type: 'GAME_MODULE_DESCRIPTOR_RESULT_V1', ok: true, cacheVersion: rendererCacheName[1],
    gameId: 'tank', resource: 'renderer', variant: 'retry1', url: expectedTankRetry.url, sha256: expected.tank.sha256
  }, 'current controller handshake must prove the exact Tank retry descriptor and cache generation');

  harness.setNetworkFetch(async input => harness.responseFor(requestUrl(input)));
  const warmup = harness.dispatchMessage({ type: 'GAME_MODULE_WARMUP_V1', gameId: 'tetris', resource: 'renderer', variant: 'primary' });
  assert.ok(warmup, 'a same-origin Client with the exact tuple must schedule bounded warmup work');
  await warmup;
  const rendererCache = await harness.cache(rendererCacheName[1]);
  assert.ok(await rendererCache.match(absolute), 'verified renderer bytes must be stored only in the renderer cache');
  const shellCache = await harness.cache(shellCacheName[1]);
  assert.strictEqual(await shellCache.match(absolute), undefined, 'renderer warmup must not pollute the shell cache');
  const warmFetches = harness.fetchCalls.filter(call => call.url === absolute);
  assert.strictEqual(warmFetches.length, 1, 'one explicit warmup must fetch only its fixed entry once');
  assert.ok(warmFetches.every(call => call.cache === 'no-cache'), 'warmup must bypass HTTP cache before verification');

  harness.fetchCalls.length = 0;
  const cachedEntry = await harness.dispatchFetch(absolute);
  assert.strictEqual(await cachedEntry.text(), fs.readFileSync(path.join(ROOT, 'public', 'three', 'tetris-entry.js'), 'utf8'),
    'a normal dynamic import request may reuse only verified renderer cache bytes');
  assert.strictEqual(harness.fetchCalls.length, 0, 'verified renderer cache hit must not network fetch');

  const tankRetryAbsolute = new URL(expectedTankRetry.url, SW_URL).href;
  harness.setNetworkFetch(async input => harness.responseFor(requestUrl(input)));
  const tankRetryResponse = await harness.dispatchFetch(tankRetryAbsolute);
  assert.strictEqual(tankRetryResponse.status, 200, 'the exact Tank retry URL may load after full digest verification');
  assert.ok(await rendererCache.match(tankRetryAbsolute), 'verified Tank retry bytes must enter only the renderer cache');
  assert.strictEqual(await shellCache.match(tankRetryAbsolute), undefined, 'Tank retry must never pollute the shell cache');

  for (const rejectedUrl of [
    new URL('./three/tank-entry.js?v=sha256-stale', SW_URL).href,
    new URL('./three/unknown-entry.js?v=sha256-deadbeefdeadbeef', SW_URL).href,
    new URL(`${expectedTankRetry.url}&unexpected=1`, SW_URL).href
  ]) {
    const beforeFetches = harness.fetchCalls.length;
    const rejected = await harness.dispatchFetch(rejectedUrl);
    assert.strictEqual(rejected.status, 503, 'unknown/stale renderer entry URL must fail closed');
    assert.strictEqual(harness.fetchCalls.length, beforeFetches, 'unknown/stale renderer entry URL must not reach generic network fetch');
    assert.strictEqual(await shellCache.match(rejectedUrl), undefined, 'unknown/stale renderer entry URL must not enter shell cache');
  }

  async function assertRejectedRenderer(label, responseFactory) {
    await rendererCache.delete(absolute);
    harness.setNetworkFetch(async () => responseFactory());
    const response = await harness.dispatchFetch(absolute);
    assert.strictEqual(response.status, 503, `${label} renderer response must fail closed`);
    assert.strictEqual(await rendererCache.match(absolute), undefined, `${label} renderer response must not enter cache`);
  }
  await assertRejectedRenderer('hash-mismatched', () => basicResponse('export const wrong=true;', {
    status: 200, headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
  }));
  await assertRejectedRenderer('wrong-MIME', () => basicResponse(fs.readFileSync(path.join(ROOT, 'public', 'three', 'tetris-entry.js')), {
    status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  }));
  await assertRejectedRenderer('no-store', () => basicResponse(fs.readFileSync(path.join(ROOT, 'public', 'three', 'tetris-entry.js')), {
    status: 200, headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }
  }));

  const originalCrypto = harness.self.crypto;
  harness.self.crypto = { subtle: { async digest() { throw new Error('simulated_crypto_failure'); } } };
  await assertRejectedRenderer('crypto-failure', () => harness.responseFor(absolute));
  harness.self.crypto = originalCrypto;

  await rendererCache.delete(absolute);
  harness.rejectCachePut = true;
  harness.setNetworkFetch(async () => harness.responseFor(absolute));
  const quotaResponse = await harness.dispatchFetch(absolute);
  assert.strictEqual(quotaResponse.status, 200, 'verified current dynamic import may continue if renderer-cache write hits quota');
  assert.strictEqual(await rendererCache.match(absolute), undefined, 'renderer quota failure must not claim a cached entry');
  harness.rejectCachePut = false;

  await rendererCache.delete(absolute);
  harness.setNetworkFetch(async () => { throw new TypeError('simulated network failure'); });
  const networkFailure = await harness.dispatchFetch(absolute);
  assert.strictEqual(networkFailure.status, 503, 'renderer network failure must become a safe import failure for the existing inline fallback');
  assert.strictEqual(await rendererCache.match(absolute), undefined, 'renderer network failure must not create a cache record');

  const loaderPath = path.join(ROOT, 'public', 'src', 'core', '14-game-module-loader.js');
  if (fs.existsSync(loaderPath)) {
    delete require.cache[require.resolve(loaderPath)];
    const loader = require(loaderPath);
    const loaderDescriptors = descriptorMapFromLoader(loader);
    assert.ok(loaderDescriptors, 'GameModuleLoader CommonJS export must expose the fixed descriptor map for SW parity checks');
    assert.deepStrictEqual(normalizedDescriptorMap(loaderDescriptors), expected,
      'Loader and SW must agree exactly on renderer URL, full SHA-256, and exports');
  } else {
    console.log('LOADER_MANIFEST_NOT_PRESENT_YET: SW descriptor parity will be asserted once T2 Loader lands.');
  }

  console.log('SW_GAME_MODULE_PREHEAT_ALL_PASS');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
