#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SHELL_SOURCE = fs.readFileSync(path.join(ROOT, 'public/src/core/02-app-shell.js'), 'utf8');
const I18N_SOURCE = fs.readFileSync(path.join(ROOT, 'public/src/core/00-i18n.js'), 'utf8');
const LOCALES = Object.fromEntries(['zh-CN', 'en-US', 'uk-UA'].map(lang => [
  lang,
  JSON.parse(fs.readFileSync(path.join(ROOT, 'public/locales', lang + '.json'), 'utf8').replace(/^\uFEFF/, '')),
]));

let failed = 0;
let assertions = 0;
function check(label, run) {
  assertions += 1;
  try {
    run();
    console.log('PASS', label);
  } catch (error) {
    failed += 1;
    console.error('FAIL', label, '::', error.message);
  }
}

function functionSource(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  if (!nextName) {
    if (start < 0) throw new Error('missing function seam: ' + name);
    return source.slice(start);
  }
  const end = source.indexOf('function ' + nextName + '(', start + 1);
  if (start < 0 || end <= start) throw new Error('missing function seam: ' + name);
  return source.slice(start, end);
}

function makeClassList() {
  const values = new Set();
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    toggle(name, force) {
      const active = force === undefined ? !values.has(name) : !!force;
      if (active) values.add(name); else values.delete(name);
      return active;
    },
    contains(name) { return values.has(name); },
  };
}

function makeRouteNode(route) {
  const attrs = { 'data-app-route': route };
  return {
    inert: route !== 'home',
    classList: makeClassList(),
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null; },
    setAttribute(name, value) { attrs[name] = String(value); },
    removeAttribute(name) { delete attrs[name]; },
  };
}

function makeRouteTarget(route, kind) {
  const attrs = { 'data-app-route-target': route, 'data-test-kind': kind };
  const listeners = {};
  return {
    listeners,
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null; },
    setAttribute(name, value) { attrs[name] = String(value); },
    removeAttribute(name) { delete attrs[name]; },
    addEventListener(name, listener) { listeners[name] = listener; },
    click() {
      if (typeof listeners.click === 'function') listeners.click({ currentTarget: this, preventDefault() {} });
    },
  };
}

function makeRouteHarness() {
  const routeNodes = ['home', 'games', 'playline', 'profile'].map(makeRouteNode);
  const topHome = makeRouteTarget('home', 'desktop');
  const topGames = makeRouteTarget('games', 'desktop');
  const bottomPlayline = makeRouteTarget('playline', 'mobile');
  const bottomProfile = makeRouteTarget('profile', 'mobile');
  const targets = [topHome, topGames, bottomPlayline, bottomProfile];
  const windowListeners = {};
  const historyCalls = [];
  const scrollCalls = [];
  const focusToken = { id: 'focused-before-navigation' };
  const location = { hash: '#/home' };
  const window = {
    scrollX: 0,
    scrollY: 0,
    addEventListener(name, listener) { windowListeners[name] = listener; },
    scrollTo(x, y) {
      scrollCalls.push([x, y]);
      this.scrollX = Number(x) || 0;
      this.scrollY = Number(y) || 0;
    },
  };
  const document = {
    activeElement: focusToken,
    querySelectorAll(selector) {
      if (selector === '[data-app-route]') return routeNodes;
      if (selector === '[data-app-route-target]') return targets;
      if (selector === '[data-hero-dot]') return [];
      return [];
    },
  };
  const context = {
    console,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Math,
    Set,
    Date,
    account: { uid: 'route-test' },
    GHOST_APP_ROUTES: ['home', 'games', 'playline', 'profile'],
    ghostAppRoute: 'home',
    immersiveGameShellState: { active: false },
    online: { ensureConnected() {} },
    document,
    window,
    location,
    history: {
      pushState(_state, _title, hash) { historyCalls.push(['push', hash]); location.hash = hash; },
      replaceState(_state, _title, hash) { historyCalls.push(['replace', hash]); location.hash = hash; },
    },
    showHub() {},
    renderGhostHome() {},
    renderGhostProfile() {},
    // Platform scene rendering is a separate visual owner; keep this route-scroll
    // harness focused on synchronous route/scroll ownership without loading images.
    refreshPlatformScene() {},
    resetGhostHeroTimer() {},
    setGhostHero() {},
    $() { return null; },
  };
  context.globalThis = context;
  const source = [
    functionSource(SHELL_SOURCE, 'routeFromHash', 'chatViewFromHash'),
    functionSource(SHELL_SOURCE, 'resetRouteDocumentScroll', 'setAppRoute'),
    functionSource(SHELL_SOURCE, 'setAppRoute', 'homePulseDayKey'),
    functionSource(SHELL_SOURCE, 'initGhostShell', ''),
    'globalThis.__routeApi = { setAppRoute, initGhostShell, getRoute: () => ghostAppRoute, setShellActive: active => { immersiveGameShellState.active = !!active; } };',
  ].join('\n');
  vm.runInNewContext(source, context, { filename: 'route-scroll-harness.js' });
  context.__routeApi.initGhostShell();
  return { context, api: context.__routeApi, topHome, topGames, bottomPlayline, bottomProfile, routeNodes, scrollCalls, historyCalls, focusToken, windowListeners, location, window, document };
}

function makePluralHarness() {
  const context = { console, Map, Set, WeakMap, Intl, Number, Math, String, Object, Array, RegExp, JSON, Date, Promise, __catalogs: LOCALES };
  context.globalThis = context;
  const source = I18N_SOURCE + [
    '',
    'LOCALES[\'en-US\'] = __catalogs[\'en-US\'];',
    'function __usePluralLocale(lang) { currentLang = lang; currentLocale = __catalogs[lang]; }',
    'globalThis.__pluralApi = { use: __usePluralLocale, tPlural, formatGamesCount, formatWinsCount, formatRemainingWins, formatGameRecord, formatMasteryJourneyGoal, formatMasteryNextHint, sourceFor: text => I18N_RENDERED_VALUES.get(String(text)), localizeSource: localizeRenderedSource };',
  ].join('\n');
  vm.runInNewContext(source, context, { filename: 'plural-harness.js' });
  return context.__pluralApi;
}

check('true desktop and mobile route targets reset all four primary routes to document top', () => {
  const h = makeRouteHarness();
  [
    [h.topHome, 'home', 1680],
    [h.topGames, 'games', 2190],
    [h.bottomPlayline, 'playline', 1470],
    [h.bottomProfile, 'profile', 1960],
  ].forEach(([target, route, scrollY]) => {
    h.window.scrollY = scrollY;
    target.click();
    assert.strictEqual(h.api.getRoute(), route);
    assert.strictEqual(h.location.hash, '#/' + route);
  });
  assert.deepStrictEqual(h.scrollCalls, [[0, 0], [0, 0], [0, 0], [0, 0]]);
});

check('history/hash navigation keeps native scroll restoration ownership', () => {
  const h = makeRouteHarness();
  h.window.scrollY = 740;
  h.location.hash = '#/games';
  h.windowListeners.hashchange();
  assert.strictEqual(h.api.getRoute(), 'games');
  assert.deepStrictEqual(h.scrollCalls, []);
  assert.deepStrictEqual(h.historyCalls, []);
  assert.strictEqual(h.document.activeElement, h.focusToken);
});

check('all programmatic routes reset by default while an explicit restoration path can opt out', () => {
  const h = makeRouteHarness();
  h.window.scrollY = 1300;
  h.api.setAppRoute('games');
  h.window.scrollY = 860;
  h.api.setAppRoute('games');
  assert.deepStrictEqual(h.scrollCalls, [[0, 0], [0, 0]]);

  h.window.scrollY = 620;
  h.api.setAppRoute('profile', { resetScroll: false, silentHash: true, reason: 'history_restore' });
  assert.deepStrictEqual(h.scrollCalls, [[0, 0], [0, 0]]);
  assert.strictEqual(h.window.scrollY, 620);
});

check('Route Motion still owns one synchronous commit and Game Stage blocks document scroll writes', () => {
  const h = makeRouteHarness();
  let commits = 0;
  h.context.GhostRouteMotion = {
    transition(request) {
      commits += 1;
      request.commit();
      return { status: 'entering' };
    },
  };
  h.window.scrollY = 1040;
  h.api.setAppRoute('playline', { reason: 'route_target' });
  assert.strictEqual(commits, 1);
  assert.deepStrictEqual(h.scrollCalls, [[0, 0]]);

  h.api.setShellActive(true);
  h.window.scrollY = 940;
  h.api.setAppRoute('profile', { reason: 'route_target' });
  assert.deepStrictEqual(h.scrollCalls, [[0, 0]]);
  assert.strictEqual(h.document.activeElement, h.focusToken);
});

check('all plural families stay locale-symmetric with compatible placeholders', () => {
  const bases = ['games_count', 'wins_count', 'remaining_wins', 'profile_played_together'];
  const categories = ['one', 'few', 'many', 'other'];
  for (const base of bases) {
    for (const category of categories) {
      const key = base + '_' + category;
      for (const lang of Object.keys(LOCALES)) assert.strictEqual(typeof LOCALES[lang][key], 'string', lang + ' missing ' + key);
      const signatures = Object.values(LOCALES).map(locale => (locale[key].match(/%[sd]/g) || []).join(','));
      assert.strictEqual(new Set(signatures).size, 1, key + ' has mismatched placeholder signatures');
    }
  }
});

check('English selects one/other games, wins, and remaining-wins forms', () => {
  const api = makePluralHarness();
  api.use('en-US');
  for (const count of [1, 2, 5, 11, 21, 22, 25]) {
    assert.strictEqual(api.formatGamesCount(count), count + (count === 1 ? ' game' : ' games'));
    assert.strictEqual(api.formatWinsCount(count), count + (count === 1 ? ' win' : ' wins'));
    assert.strictEqual(api.formatRemainingWins(count), count + (count === 1 ? ' more win' : ' more wins'));
  }
  assert.strictEqual(api.formatGameRecord(1, 1, '100%'), '1 game · 1 win · 100%');
});

check('Ukrainian selects one/few/many grammar for games, wins, and journey remaining wins', () => {
  const api = makePluralHarness();
  api.use('uk-UA');
  const expected = new Map([[1, 'гра'], [2, 'гри'], [4, 'гри'], [5, 'ігор'], [11, 'ігор'], [21, 'гра'], [22, 'гри'], [25, 'ігор']]);
  for (const [count, noun] of expected) assert.strictEqual(api.formatGamesCount(count), count + ' ' + noun);
  const wins = new Map([[1, 'перемога'], [2, 'перемоги'], [5, 'перемог'], [11, 'перемог'], [21, 'перемога'], [22, 'перемоги'], [25, 'перемог']]);
  const together = new Map([[1, 'спільна гра'], [2, 'спільні гри'], [5, 'спільних ігор'], [11, 'спільних ігор'], [21, 'спільна гра'], [22, 'спільні гри'], [25, 'спільних ігор']]);
  for (const [count, noun] of wins) {
    assert.strictEqual(api.formatWinsCount(count), count + ' ' + noun);
    assert.strictEqual(api.formatRemainingWins(count), 'ще ' + count + ' ' + noun);
  }
  for (const [count, phrase] of together) assert.strictEqual(api.tPlural('profile_played_together', count), count + ' ' + phrase);
  assert.strictEqual(api.formatGameRecord(1, 1, '100%'), '1 гра · 1 перемога · 100%');
  assert.strictEqual(api.formatMasteryJourneyGoal('Ґомоку', 1, 'Перший камінь'), 'Ґомоку · ще 1 перемога до «Перший камінь»');
  assert.strictEqual(api.formatMasteryNextHint(2, 10), 'ще 2 перемоги до титулу за 10 перемог');
});

check('runtime language changes re-select a target locale plural category from the logical count source', () => {
  const api = makePluralHarness();
  api.use('en-US');
  const games = api.formatGamesCount(5);
  const record = api.formatGameRecord(5, 5, '100%');
  const goal = api.formatMasteryJourneyGoal('Gomoku', 5, 'First Stone');
  api.use('uk-UA');
  assert.strictEqual(api.localizeSource(api.sourceFor(games)), '5 ігор');
  assert.strictEqual(api.localizeSource(api.sourceFor(record)), '5 ігор · 5 перемог · 100%');
  assert.strictEqual(api.localizeSource(api.sourceFor(goal)), 'Gomoku · ще 5 перемог до «First Stone»');
});

check('Chinese remains stable and invalid counts fail closed to zero', () => {
  const api = makePluralHarness();
  api.use('zh-CN');
  assert.strictEqual(api.formatGamesCount(1), '1 局');
  assert.strictEqual(api.formatWinsCount(1), '1 胜');
  assert.strictEqual(api.formatRemainingWins(1), '还差1胜');
  assert.strictEqual(api.formatGameRecord(1, 1, '100%'), '1 局 · 1 胜 · 100%');
  api.use('uk-UA');
  assert.strictEqual(api.formatGamesCount('not-a-number'), '0 ігор');
  assert.strictEqual(api.formatGamesCount(-1), '0 ігор');
  assert.strictEqual(api.formatWinsCount(-2.8), '0 перемог');
  assert.strictEqual(api.formatRemainingWins(Number.NEGATIVE_INFINITY), 'ще 0 перемог');
});

if (failed) {
  console.error('ROUTE_SCROLL_PLURAL_FAILURES=' + failed + ' assertions=' + assertions);
  process.exitCode = 1;
} else {
  console.log('ROUTE_SCROLL_PLURAL_ALL_PASS assertions=' + assertions);
}
