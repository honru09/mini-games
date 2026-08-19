'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SW_URL = 'https://ghost.game/mini-games/sw.js';
const SCOPE_URL = new URL('.', SW_URL);
const source = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const CURRENT_CACHE_NAME = /const CACHE_VERSION='([^']+)'/.exec(source)[1];
const RENDERER_CACHE_MATCH = /const RENDERER_CACHE_VERSION='([^']+)'/.exec(source);
assert.ok(RENDERER_CACHE_MATCH && RENDERER_CACHE_MATCH[1] === 'ghost-game-renderer-v17-20260819',
  'the v17 renderer cache must remain a named, independently versioned cache');
const RENDERER_CACHE_NAME = RENDERER_CACHE_MATCH[1];
assert.notStrictEqual(RENDERER_CACHE_NAME, CURRENT_CACHE_NAME,
  'renderer entries must not share the offline shell/locale cache namespace');
const OLD_CACHE_NAME = 'ghost-game-shell-v11-20260815';
const handlers = new Map();
const stores = new Map();
const fetchCalls = [];
let rejectCachePut = false;
let claimCalls = 0;
let skipWaitingCalls = 0;

function requestUrl(input) {
  const raw = typeof input === 'string' ? input : input.url;
  return new URL(raw, SW_URL).href;
}

function basicResponse(body, init) {
  const response = new Response(body, init);
  Object.defineProperty(response, 'type', { value: 'basic' });
  return response;
}

function responseFor(url) {
  const parsed = new URL(url);
  const locale = /\/locales\/(zh-CN|en-US|uk-UA)\.json$/.exec(parsed.pathname);
  if (locale) {
    return basicResponse(fs.readFileSync(path.join(ROOT, 'public', 'locales', `${locale[1]}.json`)), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
  return basicResponse('shell', { status: 200 });
}

let networkFetch = async request => responseFor(requestUrl(request));

const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async addAll(inputs) {
        for (const input of inputs) {
          const url = requestUrl(input);
          store.set(url, responseFor(url));
        }
      },
      async match(input) {
        const hit = store.get(requestUrl(input));
        return hit ? hit.clone() : undefined;
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
  async keys() {
    return [...stores.keys()];
  },
  async delete(name) {
    return stores.delete(name);
  }
};

const self = {
  location: new URL(SW_URL),
  clients: { claim: async () => { claimCalls += 1; } },
  skipWaiting: async () => { skipWaitingCalls += 1; },
  addEventListener(type, handler) {
    handlers.set(type, handler);
  }
};

vm.runInNewContext(source, {
  self,
  caches,
  URL,
  Response,
  fetch: (request, init) => {
    fetchCalls.push({ url: requestUrl(request), cache: init && init.cache });
    return networkFetch(request, init);
  },
  Promise,
  Set
}, { filename: 'public/sw.js' });

function installServiceWorker() {
  let work;
  handlers.get('install')({ waitUntil(promise) { work = promise; } });
  assert.ok(work, 'install event must register cache population work');
  return work;
}

function activateServiceWorker() {
  let work;
  handlers.get('activate')({ waitUntil(promise) { work = promise; } });
  assert.ok(work, 'activate event must register cache cleanup and client claim work');
  return work;
}

function dispatchFetch(request) {
  let responsePromise;
  handlers.get('fetch')({
    request,
    respondWith(promise) { responsePromise = Promise.resolve(promise); }
  });
  return responsePromise;
}

function makeRequest(url, options = {}) {
  const request = new Request(url, { method: options.method || 'GET', headers: options.headers });
  const destination = options.destination || '';
  Object.defineProperty(request, 'destination', { value: destination });
  if (options.mode) Object.defineProperty(request, 'mode', { value: options.mode });
  return request;
}

async function assertRejectedLocaleInstall(buildBadResponse, label) {
  const probeHandlers = new Map();
  const sentinelUrl = new URL('sentinel.txt', SCOPE_URL).href;
  const probeStores = new Map([[OLD_CACHE_NAME, new Map([[sentinelUrl, new Response('keep-v11')]])]]);
  const probeCaches = {
    async open(name) {
      if (!probeStores.has(name)) probeStores.set(name, new Map());
      const store = probeStores.get(name);
      return {
        async addAll(inputs) {
          for (const input of inputs) store.set(requestUrl(input), responseFor(requestUrl(input)));
        },
        async match(input) {
          const response = store.get(requestUrl(input));
          return response ? response.clone() : undefined;
        },
        async put(input, response) {
          store.set(requestUrl(input), response.clone());
        }
      };
    },
    async keys() { return [...probeStores.keys()]; },
    async delete(name) { return probeStores.delete(name); }
  };
  const probeSelf = {
    location: new URL(SW_URL),
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener(type, handler) { probeHandlers.set(type, handler); }
  };
  const installFetches = [];
  vm.runInNewContext(source, {
    self: probeSelf,
    caches: probeCaches,
    URL,
    Response,
    fetch: (request, init) => {
      installFetches.push({ url: requestUrl(request), cache: init && init.cache });
      return /\/locales\//.test(new URL(requestUrl(request)).pathname)
        ? Promise.resolve(buildBadResponse())
        : Promise.resolve(responseFor(requestUrl(request)));
    },
    Promise,
    Set
  }, { filename: `public/sw.js:${label}` });
  let installWork;
  probeHandlers.get('install')({ waitUntil(promise) { installWork = promise; } });
  await assert.rejects(installWork, /invalid_locale_response/, `${label} must reject the new worker install`);
  assert.deepStrictEqual(await probeCaches.keys(), [OLD_CACHE_NAME], `${label} must delete only the rejected new cache generation`);
  assert.strictEqual(probeStores.has(RENDERER_CACHE_NAME), false,
    `${label} locale installation must not open the optional renderer cache`);
  assert.strictEqual(await (await (await probeCaches.open(OLD_CACHE_NAME)).match(sentinelUrl)).text(), 'keep-v11',
    `${label} must preserve the active v11 cache sentinel`);
  assert.ok(installFetches.length >= 1 && installFetches.every(call => call.cache === 'no-cache'),
    `${label} locale install fetches must bypass the HTTP cache`);
  assert.ok(!installFetches.some(call => /\/(?:three|vendor)\//.test(new URL(call.url).pathname)),
    `${label} locale installation must not fetch optional renderer, Three, or GSAP resources`);
}

async function main() {
  await assertRejectedLocaleInstall(() => basicResponse('{"error":"upstream"}', {
    status: 500,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }), '500 locale response');
  await assertRejectedLocaleInstall(() => basicResponse('<!doctype html><title>wrong response</title>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  }), 'HTML locale response');
  await assertRejectedLocaleInstall(() => basicResponse('{"nav_games":"Games"}', {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  }), 'no-store locale response');

  const oldSentinelUrl = new URL('sentinel.txt', SCOPE_URL).href;
  stores.set(OLD_CACHE_NAME, new Map([[oldSentinelUrl, new Response('keep-v11')]]));
  await installServiceWorker();
  const installedKeys = await caches.keys();
  assert.deepStrictEqual(installedKeys, [OLD_CACHE_NAME, CURRENT_CACHE_NAME],
    'install must create a separate cache generation without deleting the active v11 cache');
  assert.strictEqual(stores.has(RENDERER_CACHE_NAME), false,
    'install/login shell work must not even open the optional renderer cache');
  assert.strictEqual(await (await (await caches.open(OLD_CACHE_NAME)).match(oldSentinelUrl)).text(), 'keep-v11',
    'install must leave the active v11 cache untouched while the new worker waits');
  assert.strictEqual(skipWaitingCalls, 0, 'install must not force the waiting worker to activate');
  assert.strictEqual(claimCalls, 0, 'install must not claim clients before activation');
  const installLocaleFetches = fetchCalls.filter(call => /\/locales\//.test(new URL(call.url).pathname));
  assert.strictEqual(installLocaleFetches.length, 3, 'install must fetch each exact locale through the validated path');
  assert.ok(installLocaleFetches.every(call => call.cache === 'no-cache'),
    'install locale fetches must bypass the browser HTTP cache');
  assert.ok(!fetchCalls.some(call => /\/(?:three|vendor)\//.test(new URL(call.url).pathname)),
    'install/login shell work must not fetch optional renderer, Three, or GSAP resources');
  networkFetch = async () => { throw new TypeError('simulated offline network'); };

  const expectedNavLabels = { 'zh-CN': '游戏', 'en-US': 'Games', 'uk-UA': 'Ігри' };
  for (const [language, expectedLabel] of Object.entries(expectedNavLabels)) {
    const localeUrl = new URL(`locales/${language}.json`, SCOPE_URL).href;
    const localeResponse = dispatchFetch(makeRequest(localeUrl));
    assert.ok(localeResponse, `${language} offline fetch with an empty destination must be handled`);
    const locale = await (await localeResponse).json();
    assert.strictEqual(locale.nav_games, expectedLabel, `${language} must return its real cached dictionary`);
  }

  handlers.get('message')({ data: { type: 'SKIP_WAITING' } });
  assert.strictEqual(skipWaitingCalls, 1, 'the waiting worker activates only after an explicit SKIP_WAITING message');
  await activateServiceWorker();
  assert.deepStrictEqual(await caches.keys(), [CURRENT_CACHE_NAME], 'activation deletes the old cache only after the waiting boundary');
  assert.strictEqual(stores.has(RENDERER_CACHE_NAME), false,
    'activation must not fabricate a renderer cache when no renderer was requested');
  assert.strictEqual(claimCalls, 1, 'activation claims clients exactly once');

  const installedCacheName = CURRENT_CACHE_NAME;
  const installedCache = await caches.open(installedCacheName);
  const enLocaleUrl = new URL('locales/en-US.json', SCOPE_URL).href;
  await installedCache.put(enLocaleUrl, new Response(JSON.stringify({ nav_games: 'Games' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }));
  networkFetch = async request => responseFor(requestUrl(request));
  const refreshedLocale = await (await dispatchFetch(makeRequest(enLocaleUrl))).json();
  assert.strictEqual(refreshedLocale.shop_available_label, 'Available balance',
    'an online locale request must refresh a stale installed dictionary before the UI renders a newly introduced key');
  networkFetch = async () => { throw new TypeError('simulated offline network'); };
  const refreshedOfflineLocale = await (await dispatchFetch(makeRequest(enLocaleUrl))).json();
  assert.strictEqual(refreshedOfflineLocale.shop_available_label, 'Available balance',
    'the refreshed locale dictionary must remain available after the network goes offline again');
  const runtimeBadResponses = [
    ['500', () => basicResponse('{"error":"upstream"}', { status: 500, headers: { 'Content-Type': 'application/json' } })],
    ['HTML', () => basicResponse('<!doctype html><title>not a locale</title>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })],
    ['no-store', () => basicResponse('{"shop_available_label":"poisoned"}', { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })]
  ];
  for (const [label, buildResponse] of runtimeBadResponses) {
    networkFetch = async () => buildResponse();
    const unpoisonedLocale = await (await dispatchFetch(makeRequest(enLocaleUrl))).json();
    assert.strictEqual(unpoisonedLocale.shop_available_label, 'Available balance',
      `${label} response must not replace or bypass the last valid locale dictionary`);
  }

  await installedCache.put(enLocaleUrl, new Response(JSON.stringify({ nav_games: 'Games' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }));
  rejectCachePut = true;
  networkFetch = async request => responseFor(requestUrl(request));
  const quotaFreshLocale = await (await dispatchFetch(makeRequest(enLocaleUrl))).json();
  assert.strictEqual(quotaFreshLocale.shop_available_label, 'Available balance',
    'a cache quota failure must not discard an otherwise valid live locale response');
  rejectCachePut = false;
  networkFetch = async () => { throw new TypeError('simulated offline network'); };
  const staleAfterQuota = await (await dispatchFetch(makeRequest(enLocaleUrl))).json();
  assert.strictEqual(staleAfterQuota.shop_available_label, undefined,
    'a failed cache write must not pretend the refreshed dictionary was persisted');
  await installedCache.delete(enLocaleUrl);
  const missingOfflineResponse = await dispatchFetch(makeRequest(enLocaleUrl));
  assert.strictEqual(missingOfflineResponse.status, 503, 'offline locale without any valid cache returns an explicit 503 fallback');
  assert.deepStrictEqual(await missingOfflineResponse.json(), {}, 'the 503 locale fallback is a safe empty dictionary');
  await installedCache.put(enLocaleUrl, responseFor(enLocaleUrl));

  const zhLocaleUrl = new URL('locales/zh-CN.json', SCOPE_URL).href;
  assert.strictEqual(dispatchFetch(makeRequest(new URL('data/private.json', SCOPE_URL).href)), undefined,
    'unlisted JSON must not enter the service-worker cache');
  assert.strictEqual(dispatchFetch(makeRequest(new URL('data/private.json', SCOPE_URL).href, { destination: 'script' })), undefined,
    'unlisted JSON must stay uncached even when its destination claims to be a script');
  assert.strictEqual(dispatchFetch(makeRequest(new URL('api/profile', SCOPE_URL).href)), undefined,
    'API requests must remain outside the service-worker cache');
  assert.strictEqual(dispatchFetch(makeRequest(`${zhLocaleUrl}?v=1`)), undefined,
    'locale-like URLs with a non-sensitive query must not bypass exact allowlisting');
  assert.strictEqual(dispatchFetch(makeRequest(`${zhLocaleUrl}?v=1`, { destination: 'script' })), undefined,
    'query-bearing locale URLs must not fall through to destination-based caching');
  assert.strictEqual(dispatchFetch(makeRequest(zhLocaleUrl, { headers: { Authorization: 'Bearer redacted' } })), undefined,
    'authorized locale requests must remain outside the cache');
  assert.strictEqual(dispatchFetch(makeRequest(new URL('locales/fr-FR.json', SCOPE_URL).href)), undefined,
    'unknown locales must remain outside the cache');
  assert.strictEqual(dispatchFetch(makeRequest('https://cdn.example/locales/zh-CN.json')), undefined,
    'cross-origin locale-like URLs must remain outside the cache');
  assert.strictEqual(dispatchFetch(makeRequest(zhLocaleUrl, { method: 'POST' })), undefined,
    'non-GET locale requests must remain outside the cache');

  const shellCache = await caches.open(installedCacheName);
  const indexBefore = await (await shellCache.match('./index.html')).text();
  networkFetch = async () => {
    const response = new Response('{"not":"html"}', {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
    Object.defineProperty(response, 'type', { value: 'basic' });
    return response;
  };
  const jsonNavigation = dispatchFetch(makeRequest(new URL('data/public.json', SCOPE_URL).href, { mode: 'navigate' }));
  assert.ok(jsonNavigation, 'a navigation request must still use the network-first navigation handler');
  assert.strictEqual((await jsonNavigation).status, 200, 'the live JSON navigation response is returned to the browser');
  assert.strictEqual(await (await shellCache.match('./index.html')).text(), indexBefore,
    'a non-HTML navigation response must never overwrite the offline app shell');

  console.log('PWA_OFFLINE_I18N_ALL_PASS');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
