'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = value => fs.readFileSync(path.join(ROOT, value), 'utf8');
const json = value => JSON.parse(read(value));
const moduleSource = read('public/src/core/32-tournament-broadcast-overlay.js');
const adapterSource = read('public/tournament-broadcast-motion-entry.js');
const onlineSource = read('public/src/online/03-websocket.js');
const assetSource = read('public/src/core/06-assets.js');
const { readPresentationSource } = require('./presentation-source');
const templateSource = readPresentationSource();
const buildSource = read('scripts/build.js');
const packageJson = json('package.json');
const productLedger = json('requirements/PRODUCT_REQUIREMENTS_LEDGER.json');
const routing = json('requirements/MAINLINE_CONTROL_ROUTING.json');
const createModule = require(path.join(ROOT, 'public/src/core/32-tournament-broadcast-overlay.js'));
const familyManifest = json('art-source/platform/tournament-broadcast-overlay-v1/asset-family-manifest-v1.json');
const sha256 = value => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, value))).digest('hex').toUpperCase();

function pass(label) { console.log('PASS ' + label); }

for (const id of ['GAME-028', 'GAME-029', 'UI-034']) assert(read('art-source/production/ghost-game-art-program-v1/production-ledger-v1.json').includes(id));
assert.strictEqual(productLedger.requirements.find(item => item.id === 'GAME-028').status, 'planned');
assert(routing.routingGroups.find(group => group.id === 'future-expansion').ids.includes('GAME-028'));
assert(moduleSource.includes('Presentation-only'));
assert(!/\b(fetch|WebSocket|localStorage|sessionStorage|setInterval)\b/.test(moduleSource));
for (const fact of ['tournamentId', 'matchId', 'roomId', 'uid', 'token', 'permission', 'stream', 'video', 'reward']) {
  assert(!new RegExp('input\\.' + fact + '\\b').test(moduleSource), 'overlay must not consume ' + fact);
}
pass('P2-10 binds existing requirements and stays presentation-only');

assert.strictEqual(familyManifest.familyId, 'P-TOURNAMENT-BROADCAST-OVERLAY-V1');
assert.strictEqual(familyManifest.clearance, 'OWNER_AUTHORIZED_ART_CLEARANCE');
assert.strictEqual(familyManifest.featureFlag.id, 'mg_art_tournament_broadcast_overlay_v1');
assert.strictEqual(familyManifest.runtimeRasterBytesAdded, 0);
for (const file of familyManifest.runtimeFiles.concat(familyManifest.reviewFiles)) {
  assert.strictEqual(fs.statSync(path.join(ROOT, file.path)).size, file.bytes, file.path);
  assert.strictEqual(sha256(file.path), file.sha256, file.path);
}
pass('family manifest and runtime/review hashes are pinned');

assert.deepStrictEqual(Object.keys(createModule), ['create']);
assert(adapterSource.includes("from './vendor/gsap/3.15.0/esm/index.js'"));
assert(adapterSource.includes('gsap.timeline'));
assert(adapterSource.includes("clearProps: 'transform,opacity,visibility,will-change'"));
assert(!/\b(?:top|left|width|height)\s*:/.test(adapterSource));
assert(!/ScrollTrigger/.test(adapterSource));
pass('lazy local GSAP Core/Timeline adapter is transform-only and reversible');

function createDocument() {
  const listeners = new Map();
  const doc = {
    hidden: false,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); }
  };
  function classNames(node) { return String(node.className || '').split(/\s+/).filter(Boolean); }
  function find(node, selector, all) {
    const target = selector.startsWith('.') ? selector.slice(1) : selector;
    const result = [];
    (function walk(value) {
      if (classNames(value).includes(target)) result.push(value);
      (value.children || []).forEach(walk);
    })(node);
    return all ? result : result[0] || null;
  }
  doc.createElement = tagName => ({
    tagName: String(tagName).toUpperCase(), ownerDocument: doc, className: '', textContent: '', dataset: {}, attributes: {}, children: [], parentNode: null, hidden: false, isConnected: true,
    appendChild(child) { child.parentNode = this; child.isConnected = this.isConnected; this.children.push(child); return child; },
    removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; child.isConnected = false; return child; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    querySelector(selector) { return find(this, selector, false); },
    querySelectorAll(selector) { return find(this, selector, true); },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); else this.isConnected = false; }
  });
  doc._listeners = listeners;
  return doc;
}
function flatten(node) { return [node.textContent].concat((node.children || []).map(flatten)).join(' '); }

(async () => {
  const doc = createDocument();
  const host = doc.createElement('div');
  let introCalls = 0;
  const api = createModule.create({
    root: { document: doc, matchMedia: () => ({ matches: false }) },
    loadAdapter: () => Promise.resolve({ createTournamentBroadcastMotionAdapter: () => ({ intro() { introCalls += 1; return { kill() {} }; }, settle() {}, dispose() {} }) })
  });
  assert.strictEqual(api.mount(host, { title: '', round: 1, maxRounds: 3 }), null);
  const handle = api.mount(host, {
    tone: 'live', kicker: ' TOUR\u0000NAMENT   FEED ', title: 'Cafe\u0301 Championship', status: 'Round in progress',
    round: 2, maxRounds: 3, roundLabel: 'ROUND 2/3', leaderLabel: 'CURRENT LEADER', leaderName: 'Ghost Alpha', leaderScore: '6 PTS', tablesLabel: 'ROUND TABLES', emptyLabel: 'WAITING',
    tables: [
      { label: 'TABLE 1', players: 'Alpha vs Beta', status: 'Playing', tone: 'live' },
      { label: 'TABLE 2', players: 'Gamma vs Delta', status: 'Complete', tone: 'complete' },
      { label: 'TABLE 3', players: 'Epsilon vs Zeta', status: 'Waiting', tone: 'waiting' },
      { label: 'TABLE 4', players: 'Overflow vs Hidden', status: 'Waiting', tone: 'waiting' }
    ]
  });
  assert(handle && handle.root.attributes['aria-hidden'] === 'true');
  assert.strictEqual(handle.snapshot().tables, 3);
  assert(flatten(handle.root).includes('Café Championship'));
  assert(!flatten(handle.root).includes('\u0000'));
  assert(!flatten(handle.root).includes('TABLE 4'));
  await Promise.resolve(); await Promise.resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(introCalls, 1);
  assert.strictEqual(doc._listeners.has('visibilitychange'), true);
  assert.strictEqual(handle.destroy(), true);
  assert.strictEqual(handle.destroy(), false);
  assert.strictEqual(doc._listeners.has('visibilitychange'), false);
  pass('bounded model, NFC cleanup, three-table cap, decorative semantics and cleanup');

  const reducedDoc = createDocument();
  const reducedHost = reducedDoc.createElement('div');
  let reducedLoads = 0;
  const reducedApi = createModule.create({ root: { document: reducedDoc, matchMedia: () => ({ matches: true }) }, loadAdapter: () => { reducedLoads += 1; return Promise.resolve(null); } });
  const reducedHandle = reducedApi.mount(reducedHost, { title: '赛事', status: '等待', round: 1, maxRounds: 1, roundLabel: '1/1', leaderLabel: '领先', tablesLabel: '桌况', emptyLabel: '等待' });
  await Promise.resolve();
  assert.strictEqual(reducedLoads, 0);
  assert(reducedHandle && reducedHandle.snapshot().adapterLoaded === false);
  reducedHandle.destroy();
  pass('reduced motion stays static and avoids loading GSAP');

  const dynamicReducedDoc = createDocument();
  const dynamicReducedHost = dynamicReducedDoc.createElement('div');
  let dynamicReducedListener = null;
  let resolveDynamicAdapter;
  let dynamicReducedIntroCalls = 0;
  const dynamicReducedQuery = {
    matches: false,
    addEventListener(type, listener) { if (type === 'change') dynamicReducedListener = listener; },
    removeEventListener(type, listener) { if (type === 'change' && dynamicReducedListener === listener) dynamicReducedListener = null; }
  };
  const dynamicReducedPending = new Promise(resolve => { resolveDynamicAdapter = resolve; });
  const dynamicReducedApi = createModule.create({
    root: { document: dynamicReducedDoc, matchMedia: () => dynamicReducedQuery },
    loadAdapter: () => dynamicReducedPending
  });
  const dynamicReducedHandle = dynamicReducedApi.mount(dynamicReducedHost, { title: 'Dynamic reduced motion', status: 'Live', round: 1, maxRounds: 1, roundLabel: '1/1', leaderLabel: 'Leader', tablesLabel: 'Tables', emptyLabel: 'Waiting' });
  await Promise.resolve(); await Promise.resolve();
  dynamicReducedQuery.matches = true;
  dynamicReducedListener({ matches: true });
  resolveDynamicAdapter({ createTournamentBroadcastMotionAdapter: () => ({ intro() { dynamicReducedIntroCalls += 1; return { kill() {} }; }, settle() {}, dispose() {} }) });
  await dynamicReducedPending; await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(dynamicReducedIntroCalls, 0);
  assert.strictEqual(dynamicReducedHandle.snapshot().adapterLoaded, true);
  dynamicReducedHandle.destroy();
  assert.strictEqual(dynamicReducedListener, null);
  pass('late adapter cannot animate after reduced-motion changes during load');

  const waitingDoc = createDocument();
  const waitingHost = waitingDoc.createElement('div');
  let waitingDot = 'unset';
  const waitingApi = createModule.create({
    root: { document: waitingDoc, matchMedia: () => ({ matches: false }) },
    loadAdapter: () => Promise.resolve({ createTournamentBroadcastMotionAdapter: () => ({ intro(payload) { waitingDot = payload.dot; return { kill() {} }; }, settle() {}, dispose() {} }) })
  });
  const waitingHandle = waitingApi.mount(waitingHost, { tone: 'waiting', title: 'Waiting tournament', status: 'Waiting', round: 0, maxRounds: 3, roundLabel: 'Waiting for round one', leaderLabel: 'Leader', tablesLabel: 'Tables', emptyLabel: 'Waiting' });
  assert(waitingHandle && waitingHandle.snapshot().round === 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(waitingDot, null);
  waitingHandle.destroy();
  pass('authoritative waiting round zero renders and keeps the live pulse disabled');

  assert(assetSource.includes("const TOURNAMENT_BROADCAST_OVERLAY_FLAG = 'mg_art_tournament_broadcast_overlay_v1'"));
  assert(assetSource.includes('function tournamentBroadcastOverlayEnabled()'));
  assert(onlineSource.includes("typeof GhostTournamentBroadcastOverlay.mount==='function'"));
  assert(onlineSource.includes("communityCardArtNode('card-tournament','tournament-card-art')"));
  assert(onlineSource.includes('removeTournamentModalNode(bd)'));
  assert(onlineSource.includes('mountOnlineOverlayDialog(bd,card,close'));
  assert(onlineSource.includes('__ghostTournamentDialogClose'));
  assert(onlineSource.includes("window.addEventListener('languagechange'"));
  assert(onlineSource.includes("t('tournament_broadcast_waiting_round')"));
  assert(onlineSource.includes("return !!(typeof online !== 'undefined' && online && online.isAdmin === true)"));
  assert(!onlineSource.includes('tournamentBroadcastOverlayEnabled()&&online.isAdmin=false'));
  pass('admin-only tournament entry, feature flag, legacy card fallback and modal disposal remain intact');

  for (const locale of ['zh-CN', 'en-US', 'uk-UA']) {
    const dict = json('public/locales/' + locale + '.json');
    for (const key of ['tournament_broadcast_label','tournament_broadcast_round','tournament_broadcast_waiting_round','tournament_broadcast_leader','tournament_broadcast_points','tournament_broadcast_tables','tournament_broadcast_table','tournament_broadcast_no_table']) {
      assert(typeof dict[key] === 'string' && dict[key].trim(), locale + ' missing ' + key);
    }
  }
  assert(templateSource.includes('@media(max-width:560px)'));
  assert(templateSource.includes('@media(prefers-reduced-motion:reduce)'));
  assert(templateSource.includes('@media(forced-colors:active)'));
  assert(!/tournament-broadcast[^}]*\b(?:top|left|width|height)\s*:[^;}]*transition/i.test(templateSource));
  assert(templateSource.includes('.tournament-broadcast-art'));
  assert(templateSource.includes('data-broadcast-tone="waiting"'));
  assert(templateSource.includes('data-broadcast-tone="finished"'));
  assert(moduleSource.includes("resolveCommunityReplayTournamentCardUrl('card-tournament'"));
  assert(moduleSource.includes("model.tone === 'live'"));
  assert(moduleSource.includes("reduceQuery.addEventListener('change', onReducedChange)"));
  assert(moduleSource.includes("reduceQuery.removeEventListener('change', onReducedChange)"));
  assert(adapterSource.includes('if (dot) next.fromTo(dot'));
  pass('three languages, narrow layout, reduced motion and forced colors contracts');

  const skillRouting = read('art-source/platform/tournament-broadcast-overlay-v1/SKILL_ROUTING.md');
  for (const skill of ['imagegen','ai-image-generation','gpt-image','image','happy-image-gen','html-to-image','website-screenshot','code-to-image','og-image']) assert(skillRouting.includes('`' + skill + '`:'), skill);
  assert(skillRouting.includes('html-to-image`: `APPLIED`') && skillRouting.includes('website-screenshot`: `NOT_APPLICABLE`'));
  assert(buildSource.includes("'core/32-tournament-broadcast-overlay.js'"));
  assert(packageJson.scripts['test:tournament-broadcast-overlay'].includes('qa/tournament-broadcast-overlay-v1.js'));
  assert(packageJson.scripts.pretest.includes('npm run test:tournament-broadcast-overlay'));
  pass('nine-skill routing, deterministic build and full-suite entry');

  console.log('TOURNAMENT_BROADCAST_OVERLAY_V1_ALL_PASS');
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
