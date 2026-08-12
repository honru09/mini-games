'use strict';

// Wave C remains a local presentation layer. This fast contract catches the
// original regression: the two game stages must fill their available Arena
// and expose a clear, disposable process without touching rules or wire data.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'public', 'index-template.html'), 'utf8');
const ludo = fs.readFileSync(path.join(root, 'public', 'src', 'games', 'ludo.js'), 'utf8');
const monopoly = fs.readFileSync(path.join(root, 'public', 'src', 'games', 'monopoly.js'), 'utf8');
const marker = '/* ================= Game Stage Wave C · Ludo / Monopoly =================';
const start = template.indexOf(marker);
const end = start >= 0 ? template.indexOf('</style>', start) : -1;
const css = start >= 0 && end > start ? template.slice(start, end) : '';
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

function sourceSegment(source, startToken, endToken) {
  const startAt = source.indexOf(startToken);
  const endAt = startAt >= 0 ? source.indexOf(endToken, startAt) : -1;
  return startAt >= 0 && endAt > startAt ? source.slice(startAt, endAt) : '';
}

const ludoSnapshot = sourceSegment(ludo, 'function snapshot(){', 'function onRestore(');
const monopolySnapshot = sourceSegment(monopoly, 'function snapshot(){', 'function animatePresentationFrame(');

check('Wave C density stylesheet exists', !!css);
check('both stages deliberately fill the Arena instead of retaining the 820px card cap',
  /\.(?:ludo|monopoly)-wave-b-stage[^\{]*\{[^}]*position:relative;[^}]*width:100%;[^}]*max-width:none;[^}]*min-height:clamp\(/.test(css),
  'expected full-width, uncapped stage geometry');
check('both boards are given a responsive physical playfield size on desktop, tablet and phone',
  ['--ludo-wave-c-board-size', '--monopoly-wave-c-board-size', '@media(max-width:900px)', '@media(max-width:720px)', '@media(max-height:600px) and (orientation:landscape)'].every(token => css.includes(token)));
check('Wave C adds code-native material, depth and transform-only motion seams',
  ['ludo-wave-c-process', 'monopoly-wave-c-process', 'perspective:', 'box-shadow:', 'will-change:transform', 'transform:translateZ(0)'].every(token => css.includes(token)) &&
  !/url\s*\(/i.test(css));
check('reduced motion explicitly settles both process rails without running motion',
  css.includes('@media(prefers-reduced-motion:reduce)') && css.includes('.ludo-wave-c-process') && css.includes('.monopoly-wave-c-process') && css.includes('transition:none!important'));

check('Ludo declares a presentation-only process vocabulary for dice → pick → move → capture/finish → ranking',
  /LUDO_WAVE_C_PROCESS_STEPS\s*=\s*\[[^\]]*'roll'[^\]]*'dice'[^\]]*'pick'[^\]]*'move'[^\]]*'capture'[^\]]*'finish'[^\]]*'ranking'/.test(ludo) &&
  ['ludo-wave-c-process', "'ludo-process'", 'setLudoWaveCProcess'].every(token => ludo.includes(token)));
check('Monopoly declares a presentation-only process vocabulary for roll → walk → land → buy/event/auction/trade → turn end',
  /MONOPOLY_WAVE_C_PROCESS_STEPS\s*=\s*\[[^\]]*'roll'[^\]]*'walk'[^\]]*'land'[^\]]*'buy'[^\]]*'event'[^\]]*'auction'[^\]]*'trade'[^\]]*'turn-end'/.test(monopoly) &&
  ['monopoly-wave-c-process', "'monopoly-process'", 'setMonopolyWaveCProcess'].every(token => monopoly.includes(token)));
check('Ludo process timers are tracked and cleared on reset, reconnect restore and destroy',
  /function clearLudoWaveCProcessTimers\(\)/.test(ludo) &&
  ['resetLocal(){\n    epoch++;\n    clearLudoWaveCProcessTimers();', 'function onRestore(value){', 'destroy: () => { epoch++; clearLudoWaveCProcessTimers();'].every(token => ludo.includes(token)));
check('Ludo idle waits for the visible token flight and every Wave C timer',
  /function ludoIsIdle\(\)\{[^}]*movingToken\s*===\s*null[^}]*ludoWaveCProcessTimers\.size\s*===\s*0/.test(ludo) &&
  /ludoWaveCProcessTimers\.delete\(timer\);[\s\S]{0,180}notifyLudoIdle\(\)/.test(ludo));
check('Monopoly process timers are tracked and cleared by the shared async invalidator',
  /function clearMonopolyWaveCProcessTimers\(\)/.test(monopoly) && /function invalidateAsync\(\)\{[\s\S]{0,220}clearMonopolyWaveCProcessTimers\(\)/.test(monopoly));
const monopolyRoll = sourceSegment(monopoly, 'function roll(){', 'function applyRoll(');
const monopolyPay = sourceSegment(monopoly, 'function pay(', 'function showChance(');
check('Monopoly roll emits exactly one click sound after its action guards',
  (monopolyRoll.match(/sfx\('pop'\)/g) || []).length === 1 && monopolyRoll.indexOf("sfx('pop')") > monopolyRoll.indexOf("phase !== 'roll'"));
check('Monopoly bankruptcy settlement credits the surviving player exactly once',
  (monopolyPay.match(/creditGame\(\)/g) || []).length === 1);
check('new process state remains out of authoritative snapshots and serialized state',
  !/WaveC|wave-c|Process|processRail/i.test(ludoSnapshot) && !/WaveC|wave-c|Process|processRail/i.test(monopolySnapshot));
check('the two games do not introduce a GSAP or remote-asset runtime dependency',
  !/\bgsap\b|ScrollTrigger/.test(ludo + monopoly) && !/url\s*\(/i.test(css));

function createNode(tag) {
  const classes = new Set();
  const listeners = new Map();
  const node = {
    tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null, dataset: {}, attributes: {}, textContent: '',
    clientWidth: 640, clientHeight: 680, disabled: false,
    style: { setProperty(key, value) { this[key] = String(value); }, removeProperty(key) { delete this[key]; } },
    appendChild(child) {
      if (!child) return child;
      if (child.parentNode && child.parentNode.removeChild) child.parentNode.removeChild(child);
      child.parentNode = this; this.children.push(child); return child;
    },
    insertBefore(child, reference) {
      if (!child) return child;
      if (child.parentNode && child.parentNode.removeChild) child.parentNode.removeChild(child);
      child.parentNode = this;
      const index = this.children.indexOf(reference);
      if (index < 0) this.children.push(child); else this.children.splice(index, 0, child);
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      if (child) child.parentNode = null;
      return child;
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    setAttribute(key, value) {
      this.attributes[key] = String(value);
      if (String(key).startsWith('data-')) this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, char) => char.toUpperCase())] = String(value);
    },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    removeAttribute(key) {
      delete this.attributes[key];
      if (String(key).startsWith('data-')) delete this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, char) => char.toUpperCase())];
    },
    focus() {},
    querySelector(selector) { return query(this, selector, false); },
    querySelectorAll(selector) { return query(this, selector, true); },
  };
  Object.defineProperty(node, 'innerHTML', {
    get() { return ''; },
    set(_value) { node.children.forEach(child => { child.parentNode = null; }); node.children = []; },
  });
  Object.defineProperty(node, 'className', {
    get() { return [...classes].join(' '); },
    set(value) { classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(item => classes.add(item)); },
  });
  node.classList = {
    add(...items) { items.forEach(item => classes.add(item)); },
    remove(...items) { items.forEach(item => classes.delete(item)); },
    contains(item) { return classes.has(item); },
    toggle(item, force) { const next = force === undefined ? !classes.has(item) : !!force; if (next) classes.add(item); else classes.delete(item); return next; },
  };
  return node;
}

function matches(node, selector) {
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  const data = /^\[data-([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (data) {
    const key = data[1].replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
    return Object.prototype.hasOwnProperty.call(node.dataset, key) && (data[2] === undefined || node.dataset[key] === data[2]);
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function query(root, selector, all) {
  const found = [], queue = (root.children || []).slice();
  while (queue.length) {
    const node = queue.shift();
    if (matches(node, selector)) { if (!all) return node; found.push(node); }
    queue.push(...(node.children || []));
  }
  return all ? found : null;
}

function createClock() {
  let nextId = 1;
  const jobs = new Map();
  return {
    setTimeout(fn) { const id = nextId++; jobs.set(id, fn); return id; },
    clearTimeout(id) { jobs.delete(id); },
    size() { return jobs.size; },
    runUntil(predicate, limit) {
      let count = 0;
      while (!predicate() && jobs.size && count++ < (limit || 120)) {
        const entry = jobs.entries().next().value;
        jobs.delete(entry[0]); entry[1]();
      }
      return !!predicate();
    },
  };
}

function createRuntime(source, gameName, options) {
  const clock = createClock();
  const area = createNode('div');
  const extra = createNode('div');
  const settings = options || {};
  const sandbox = {
    console, JSON, Date, Math, Number, String, Boolean, Array, Object, Map, Set, Promise,
    window: { localStorage: { getItem() { return null; } } }, document: { createElement: createNode },
    PLAYER_COLORS: ['#e5484d', '#3b82f6', '#22a06b', '#f59e0b', '#8e6ad8'],
    PLAYER_BG: ['#fee2e2', '#dbeafe', '#dcfce7', '#fef3c7'],
    el(tag, className, value) { const node = createNode(tag); node.className = className || ''; if (value !== undefined) node.textContent = String(value); return node; },
    t(key, ...args) { return String(key) + (args.length ? ':' + args.join(',') : ''); },
    makeDice3D() { const wrap = createNode('div'); return { wrap, roll(value, done) { wrap.dataset.value = String(value); if (done) done(); }, reset() {} }; },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    sfx() {}, setStatus() {}, renderPlayers() {}, playFeedback() {}, toast() {}, showVictoryOverlay() {}, showModal() {}, shareGameLink() {},
    prefersReducedMotion() { return !!settings.reducedMotion; }, tabletopArtEnabled() { return false; }, markTabletopSurface() {},
    aiChoose: typeof settings.aiChoose === 'function' ? settings.aiChoose : async () => null,
    aiSpeak() {}, confirmAIReady() {},
  };
  sandbox.globalThis = sandbox;
  const context = require('vm').createContext(sandbox);
  require('vm').runInContext(source, context, { filename: gameName + '.js' });
  const shared = {
    online: !!settings.online, spectator: false, myIdx: 0, matchId: 'density-process', gameplayMeta: settings.gameplayMeta || null,
    ai: new Set(settings.aiSlots || []), isHost: true, sendMove() {}, sendRestart() {}, sendMonopolyAuctionOpen() {}, sendMonopolyBid() {}, onEnd() {},
    getPublicSeats() { return []; }, getMatchId() { return 'density-process'; }, isReplaying() { return false; },
  };
  const game = context[gameName === 'ludo' ? 'gameLudo' : 'gameMonopoly'](area, extra, 2, shared);
  return { area, extra, game, clock };
}

function monopolyState(position, phase) {
  return {
    players: [
      { money: 2000, pos: position, alive: true, props: [], buildings: 0 },
      { money: 2000, pos: 0, alive: true, props: [], buildings: 0 },
    ],
    cur: 0, phase: phase || 'roll', round: 1, over: false, winner: -1, owners: Array(24).fill(-1), deck: [0, 1, 2, 3],
  };
}

async function runRuntimeMatrix() {
try {
  let ludoRuntime = createRuntime(ludo, 'ludo');
  check('Ludo runtime starts its visual process at roll', ludoRuntime.area.dataset.ludoProcess === 'roll');
  ludoRuntime.game.onMove({ dice: 6 }, 0);
  check('Ludo dice resolves into the explicit pick process', ludoRuntime.area.dataset.ludoProcess === 'pick');
  ludoRuntime.game.onMove({ ti: 0 }, 0);
  const ludoMoveStarted = ludoRuntime.area.dataset.ludoProcess === 'move';
  let ludoIdleSettled = false;
  ludoRuntime.game.whenIdle().then(() => { ludoIdleSettled = true; });
  await Promise.resolve();
  check('Ludo whenIdle remains pending while the flight is visibly moving', ludoMoveStarted && !ludoIdleSettled);
  const ludoExtraTurnSettled = ludoRuntime.clock.runUntil(() => ludoRuntime.area.dataset.ludoProcess === 'roll' && ludoRuntime.clock.size() === 0);
  await Promise.resolve();
  check('Ludo six settles back to roll only after its queued flight finishes', ludoExtraTurnSettled && ludoIdleSettled);
  ludoRuntime.game.destroy();
  check('Ludo destroy clears queued process timers', ludoRuntime.clock.size() === 0);

  let resolveAiChoice = null;
  let aiChoiceStarted = false;
  ludoRuntime = createRuntime(ludo, 'ludo', {
    aiSlots:[0],
    aiChoose(){ aiChoiceStarted = true; return new Promise(resolve => { resolveAiChoice = resolve; }); },
  });
  ludoRuntime.game.onRestore({ tokens: [[0, -1, -1, -1], [-1, -1, -1, -1]], curIdx: 0, phase: 'roll', dice: 0, over: false, winner: -1 });
  ludoRuntime.game.onMove({ dice: 1 }, 0);
  let aiIdleSettled = false;
  ludoRuntime.game.whenIdle().then(() => { aiIdleSettled = true; });
  ludoRuntime.clock.runUntil(() => aiChoiceStarted);
  await Promise.resolve();
  const aiWaitedForDecision = aiChoiceStarted && !aiIdleSettled;
  if (resolveAiChoice) resolveAiChoice('token:0');
  await Promise.resolve();
  await Promise.resolve();
  ludoRuntime.clock.runUntil(() => ludoRuntime.clock.size() === 0);
  await Promise.resolve();
  check('Ludo whenIdle includes an in-flight asynchronous AI decision and its resulting move',
    aiWaitedForDecision && aiIdleSettled);
  ludoRuntime.game.destroy();

  ludoRuntime = createRuntime(ludo, 'ludo');
  ludoRuntime.game.onMove({ dice: 6 }, 0);
  ludoRuntime.game.onMove({ ti: 0 }, 0);
  ludoRuntime.game.onMove({ dice: 2 }, 0);
  const newerDiceReachedPick = ludoRuntime.area.dataset.ludoProcess === 'pick';
  ludoRuntime.clock.runUntil(() => ludoRuntime.clock.size() === 0);
  check('a settled prior flight cannot overwrite a newer extra-turn dice/pick process',
    newerDiceReachedPick && ludoRuntime.area.dataset.ludoProcess === 'pick');
  ludoRuntime.game.destroy();

  const reducedLudoRuntime = createRuntime(ludo, 'ludo', { reducedMotion: true });
  reducedLudoRuntime.game.onMove({ dice: 6 }, 0);
  reducedLudoRuntime.game.onMove({ ti: 0 }, 0);
  check('reduced-motion Ludo settles an extra turn directly to roll without a timer', reducedLudoRuntime.area.dataset.ludoProcess === 'roll' && reducedLudoRuntime.clock.size() === 0);
  reducedLudoRuntime.game.destroy();

  ludoRuntime = createRuntime(ludo, 'ludo');
  ludoRuntime.game.onRestore({ tokens: [[0, -1, -1, -1], [27, -1, -1, -1]], curIdx: 0, phase: 'pick', dice: 1, over: false, winner: -1 });
  ludoRuntime.game.onMove({ ti: 0 }, 0);
  const ludoCapture = ludoRuntime.clock.runUntil(() => ludoRuntime.area.dataset.ludoProcess === 'capture');
  const ludoCaptureSettled = ludoRuntime.clock.runUntil(() => ludoRuntime.area.dataset.ludoProcess === 'turn-end' && ludoRuntime.clock.size() === 0);
  check('Ludo capture receives its own process state, then settles to turn end', ludoCapture && ludoCaptureSettled);
  ludoRuntime.game.destroy();

  ludoRuntime = createRuntime(ludo, 'ludo');
  ludoRuntime.game.onRestore({ tokens: [[55, -1, -1, -1], [-1, -1, -1, -1]], curIdx: 0, phase: 'pick', dice: 1, over: false, winner: -1 });
  ludoRuntime.game.onMove({ ti: 0 }, 0);
  const ludoSingleFinish = ludoRuntime.clock.runUntil(() => ludoRuntime.area.dataset.ludoProcess === 'finish');
  const ludoSingleFinishSettled = ludoRuntime.clock.runUntil(() => ludoRuntime.area.dataset.ludoProcess === 'turn-end' && ludoRuntime.clock.size() === 0);
  check('one plane reaching home shows finish but does not falsely enter match ranking', ludoSingleFinish && ludoSingleFinishSettled);
  ludoRuntime.game.destroy();

  ludoRuntime = createRuntime(ludo, 'ludo');
  ludoRuntime.game.onRestore({ tokens: [[56, 56, 56, 55], [-1, -1, -1, -1]], curIdx: 0, phase: 'pick', dice: 1, over: false, winner: -1 });
  ludoRuntime.game.onMove({ ti: 3 }, 0);
  const ludoFinish = ludoRuntime.clock.runUntil(() => ludoRuntime.area.dataset.ludoProcess === 'finish');
  const ludoRanking = ludoRuntime.clock.runUntil(() => ludoRuntime.area.dataset.ludoProcess === 'ranking');
  check('Ludo finish advances to a stable ranking process', ludoFinish && ludoRanking);
  ludoRuntime.game.destroy();

  const monopolyRuntime = createRuntime(monopoly, 'monopoly');
  check('Monopoly runtime starts its visual process at roll', monopolyRuntime.area.dataset.monopolyProcess === 'roll');
  monopolyRuntime.game.onMove({ roll: [1, 1] }, 0);
  const monopolyWalk = monopolyRuntime.area.dataset.monopolyProcess === 'walk';
  monopolyRuntime.game.onRestore(monopolyState(0, 'roll'));
  check('Monopoly reconnect restore clears an in-flight walk timer', monopolyRuntime.clock.size() === 0 && monopolyRuntime.area.dataset.monopolyProcess === 'roll');
  monopolyRuntime.game.onMove({ roll: [1, 1] }, 0);
  const monopolyLand = monopolyRuntime.clock.runUntil(() => monopolyRuntime.area.dataset.monopolyProcess === 'land');
  const monopolyBuy = monopolyRuntime.clock.runUntil(() => monopolyRuntime.area.dataset.monopolyProcess === 'buy');
  check('Monopoly exposes roll → walk steps → land → buy separately', monopolyWalk && monopolyLand && monopolyBuy);
  monopolyRuntime.game.onMove({ decision: 'buy' }, 0);
  check('Monopoly purchase resolves to an explicit turn-end process', monopolyRuntime.area.dataset.monopolyProcess === 'turn-end');
  monopolyRuntime.game.destroy();
  check('Monopoly destroy clears queued process timers', monopolyRuntime.clock.size() === 0);

  const eventRuntime = createRuntime(monopoly, 'monopoly');
  eventRuntime.game.onRestore(monopolyState(23, 'roll'));
  eventRuntime.game.onMove({ roll: [1, 1] }, 0);
  check('Monopoly chance landing enters the event process', eventRuntime.clock.runUntil(() => eventRuntime.area.dataset.monopolyProcess === 'event'));
  eventRuntime.game.destroy();

  const auctionRuntime = createRuntime(monopoly, 'monopoly', { online: true, gameplayMeta: { protocol: 'monopoly-auction-v1' } });
  auctionRuntime.game.onAuctionEvent('auction_open', {
    protocol: 'monopoly-auction-v1', matchId: 'density-process',
    auction: { auctionId: 'density-auction', propertyId: 2, status: 'open', currentBid: 300, currentBidder: -1, endAt: Date.now() + 5000, eligiblePlayers: [0, 1], revision: 1 },
  });
  const tradeRail = auctionRuntime.area.querySelector('.monopoly-wave-c-process');
  check('Monopoly auction is explicit while trade remains read-only and unavailable', auctionRuntime.area.dataset.monopolyProcess === 'auction' && tradeRail && tradeRail.dataset.monopolyTrade === 'unavailable');
  auctionRuntime.game.destroy();

  const reducedRuntime = createRuntime(monopoly, 'monopoly', { reducedMotion: true });
  reducedRuntime.game.onMove({ roll: [1, 1] }, 0);
  check('reduced-motion Monopoly settles to buy without leaving a process timer', reducedRuntime.area.dataset.monopolyProcess === 'buy' && reducedRuntime.clock.size() === 0);
  reducedRuntime.game.destroy();
} catch (error) {
  check('Wave C process runtime matrix executes', false, error && error.stack || String(error));
}

if (failures) {
  console.error('GAME_STAGE_DENSITY_PROCESS_LUDO_MONOPOLY_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('GAME_STAGE_DENSITY_PROCESS_LUDO_MONOPOLY_ALL_PASS');
}
}

runRuntimeMatrix().catch(error => {
  console.error(error && error.stack || String(error));
  process.exitCode = 1;
});
