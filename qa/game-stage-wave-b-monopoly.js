'use strict';

// Monopoly Wave B is intentionally a presentation-only DOM seam.  This tiny
// harness protects the flag, rollback and state metadata without reaching into
// the Rule Core, WebSocket, rewards or the unapproved ART-036 asset boundary.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const UI_STATE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'monopoly-ui-state.js'), 'utf8');
const CHARACTER = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'monopoly-character-presentation.js'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'monopoly-presentation-adapter.js'), 'utf8');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'monopoly.js'), 'utf8');
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

function createNode(tag) {
  const classes = new Set();
  const listeners = new Map();
  const node = {
    tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null, dataset: {}, attributes: {}, textContent: '',
    clientWidth: 560, clientHeight: 560, disabled: false,
    style: { setProperty(key, value) { this[key] = String(value); }, removeProperty(key) { delete this[key]; } },
    appendChild(child) {
      if (!child) return child;
      if (child.parentNode && typeof child.parentNode.removeChild === 'function') child.parentNode.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, reference) {
      if (!child) return child;
      if (child.parentNode && typeof child.parentNode.removeChild === 'function') child.parentNode.removeChild(child);
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
    dispatch(type, event) { (listeners.get(type) || []).forEach(handler => handler(event || {})); },
    setAttribute(key, value) {
      this.attributes[key] = String(value);
      if (String(key).startsWith('data-')) this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = String(value);
    },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    removeAttribute(key) {
      delete this.attributes[key];
      if (String(key).startsWith('data-')) delete this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())];
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
    const key = data[1].replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    return Object.prototype.hasOwnProperty.call(node.dataset, key) && (data[2] === undefined || node.dataset[key] === data[2]);
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function query(root, selector, all) {
  const matchesList = [], queue = (root.children || []).slice();
  while (queue.length) {
    const node = queue.shift();
    if (matches(node, selector)) { if (!all) return node; matchesList.push(node); }
    queue.push(...(node.children || []));
  }
  return all ? matchesList : null;
}

function makeStorage(value, throws) {
  return { value, getItem() { if (throws) throw new Error('storage blocked'); return this.value; } };
}

function createHarness(store, options) {
  options = options || {};
  const area = createNode('div');
  const extra = createNode('div');
  let timerCount = 0;
  const sandbox = {
    console, JSON, Date, Math, Number, String, Boolean, Array, Object, Set, Map, Promise,
    window: { localStorage: store }, document: { createElement: createNode },
    PLAYER_COLORS: ['#e5484d', '#3b82f6', '#22a06b', '#f59e0b', '#8e6ad8'],
    el(tag, className, text) { const node = createNode(tag); node.className = className || ''; if (text !== undefined) node.textContent = String(text); return node; },
    t(key, ...args) { return String(key) + (args.length ? ':' + args.join(',') : ''); },
    makeDice3D() { const wrap = createNode('div'); return { wrap, roll(value, done) { wrap.dataset.value = String(value); if (done) done(); }, reset() {} }; },
    setTimeout() { timerCount++; return timerCount; }, clearTimeout() {},
    sfx() {}, setStatus() {}, renderPlayers() {}, tabletopArtEnabled() { return false; }, markTabletopSurface() {},
    prefersReducedMotion() { return !!options.reducedMotion; }, playFeedback() {}, toast() {}, showVictoryOverlay() {}, showModal() {}, shareGameLink() {},
    aiChoose: async () => null, aiSpeak() {}, confirmAIReady() {},
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(UI_STATE, context, { filename: 'monopoly-ui-state.js' });
  vm.runInContext(CHARACTER, context, { filename: 'monopoly-character-presentation.js' });
  vm.runInContext(ADAPTER, context, { filename: 'monopoly-presentation-adapter.js' });
  vm.runInContext(SOURCE, context, { filename: 'monopoly.js' });
  const game = context.gameMonopoly(area, extra, 2, {
    online: !!options.online, spectator: !!options.spectator, myIdx: options.myIdx === undefined ? 0 : options.myIdx,
    matchId: options.matchId || 'wave-b-match', gameplayMeta: options.gameplayMeta || null, isHost: true, ai: new Set(),
    sendMove() {}, sendRestart() {}, sendMonopolyAuctionOpen() {}, sendMonopolyBid() {}, onEnd() {},
    getPublicSeats() { return []; }, getMatchId() { return options.matchId || 'wave-b-match'; },
  });
  return { area, extra, game, timers: () => timerCount };
}

function restoredState(position, phase) {
  return {
    players: [
      { money: 2000, pos: position, alive: true, props: [], buildings: 0 },
      { money: 2000, pos: 0, alive: true, props: [], buildings: 0 },
    ],
    cur: 0, phase, round: 2, over: false, winner: -1, owners: Array(24).fill(-1), deck: [0, 1, 2, 3],
  };
}

const snapshotSegment = SOURCE.slice(SOURCE.indexOf('function snapshot(){'), SOURCE.indexOf('function animatePresentationFrame'));
check('Wave B owns the exact local flag and all Monopoly presentation seams',
  /function monopolyWaveBEnabled\(\)/.test(SOURCE) && /mg_art_game_stage_wave_b_v1/.test(SOURCE) && [
    'monopoly-wave-b-stage', 'monopoly-wave-b-arena', 'monopoly-wave-b-board-frame', 'monopoly-wave-b-board',
    'monopoly-wave-b-command', 'monopoly-wave-b-turn-hud', 'monopoly-wave-b-dice', 'monopoly-wave-b-state',
    'monopoly-wave-b-property', 'monopoly-wave-b-chance', 'monopoly-wave-b-auction', 'monopoly-wave-b-trade',
  ].every(token => SOURCE.includes(token)));
check('Wave B state is excluded from snapshots and does not invent a trading authority',
  !/monopolyWaveB|wave-b|game-stage-wave-b/i.test(snapshotSegment) && !/sendMonopolyTrade|tradeAuthority|openTrade/.test(SOURCE));

try {
  const store = makeStorage(null);
  let h = createHarness(store);
  const stage = h.area.querySelector('.monopoly-wave-b-stage');
  const frame = h.area.querySelector('.monopoly-wave-b-board-frame');
  const board = h.area.querySelector('.monopoly-wave-b-board');
  const dice = h.area.querySelector('[data-monopoly-control="dice"]');
  const state = h.area.querySelector('.monopoly-wave-b-state');
  const trade = h.area.querySelector('.monopoly-wave-b-trade');
  check('default flag mounts the entity board, turn, dice, state and safe trade seams',
    !!stage && !!frame && !!board && !!dice && !!state && !!trade && board.parentNode === frame &&
    h.area.classList.contains('monopoly-wave-b-arena') && stage.dataset.monopolyPhase === 'roll' &&
    stage.dataset.monopolyStatus === 'active' && dice.dataset.monopolyDiceState === 'roll' &&
    board.querySelectorAll('[data-monopoly-cell]').length === 24 && trade.dataset.monopolyTrade === 'unavailable');
  const beforeToggle = JSON.stringify(h.game.snapshot());
  const serialized = JSON.stringify(h.game.serialize());
  check('Wave B metadata stays out of the Monopoly snapshot and serialized game state',
    !/wave-b|monopolyPhase|monopolyCell|game-stage-wave-b/i.test(beforeToggle + serialized));

  store.value = '0';
  h.game.setBoardTheme('grass');
  check("exact '0' restores direct Wave A board and command nodes without changing the position state",
    !h.area.querySelector('.monopoly-wave-b-stage') && !h.area.classList.contains('monopoly-wave-b-arena') &&
    h.area.children.length === 1 && h.area.children[0].classList.contains('m-board') && h.extra.children.length === 4 &&
    JSON.stringify(h.game.snapshot()) === beforeToggle);
  store.value = '1';
  h.game.setBoardTheme('classic');
  check('runtime flag restoration only remounts presentation DOM and preserves the exact game state',
    !!h.area.querySelector('.monopoly-wave-b-stage') && h.extra.querySelector('.monopoly-wave-b-command') &&
    JSON.stringify(h.game.snapshot()) === beforeToggle);

  const buyRestored = h.game.onRestore(restoredState(2, 'buy')) === true;
  const propertyNode = h.area.querySelector('.monopoly-wave-b-property');
  const propertyValue = propertyNode && propertyNode.dataset.monopolyProperty;
  const chanceRestored = h.game.onRestore(restoredState(1, 'chance')) === true;
  const chanceNode = h.area.querySelector('.monopoly-wave-b-chance');
  const chanceStateNode = h.area.querySelector('.monopoly-wave-b-state');
  check('buy and chance states only update stable read-only presentation metadata',
    buyRestored && propertyValue === '2' && chanceRestored && chanceNode && chanceNode.dataset.monopolyChance === 'active' && chanceStateNode && chanceStateNode.dataset.monopolyState === 'chance',
    JSON.stringify({ buyRestored, propertyValue, chanceRestored, chance: chanceNode && chanceNode.dataset, state: chanceStateNode && chanceStateNode.dataset }));
  h.game.onRestart();
  check('reset clears transient chance metadata without removing the active Wave B stage',
    h.area.querySelector('.monopoly-wave-b-stage').dataset.monopolyPhase === 'roll' &&
    h.area.querySelector('.monopoly-wave-b-chance').dataset.monopolyChance === undefined);
  h.game.destroy();
  check('destroy releases wrappers and stale Wave B root marks while restoring Wave A children',
    !h.area.querySelector('.monopoly-wave-b-stage') && !h.area.classList.contains('monopoly-wave-b-arena') &&
    h.area.children.length === 1 && h.area.children[0].classList.contains('m-board') && h.extra.children.length === 4);

  h = createHarness(makeStorage('unexpected'));
  check("only exact '0' rolls back; unknown stored values retain Wave B", !!h.area.querySelector('.monopoly-wave-b-stage'));
  h.game.destroy();

  h = createHarness(makeStorage(null, true));
  check('storage access failure fail-closes to Wave A', !h.area.querySelector('.monopoly-wave-b-stage') && !h.area.classList.contains('monopoly-wave-b-arena'));
  h.game.destroy();

  const auctionHarness = createHarness(makeStorage(null), {
    online: true, myIdx: 0, matchId: 'auction-wave-b', gameplayMeta: { protocol: 'monopoly-auction-v1' },
  });
  const auctionAccepted = auctionHarness.game.onAuctionEvent('auction_open', {
    protocol: 'monopoly-auction-v1', matchId: 'auction-wave-b',
    auction: { auctionId: 'auction-1', propertyId: 2, status: 'open', currentBid: 300, currentBidder: -1, endAt: Date.now() + 5000, eligiblePlayers: [0, 1], revision: 1 },
  });
  check('auction metadata and bid controls consume the existing authority state without a trade control',
    auctionAccepted === true && auctionHarness.area.querySelector('.monopoly-wave-b-auction').dataset.monopolyAuction === 'active' &&
    auctionHarness.extra.querySelectorAll('[data-monopoly-control="bid"]').length === 2 &&
    auctionHarness.extra.querySelectorAll('[data-monopoly-control="trade"]').length === 0);
  auctionHarness.game.destroy();

  const reducedAuction = createHarness(makeStorage(null), {
    online: true, myIdx: 0, reducedMotion: true, matchId: 'auction-wave-b-reduced', gameplayMeta: { protocol: 'monopoly-auction-v1' },
  });
  reducedAuction.game.onAuctionEvent('auction_open', {
    protocol: 'monopoly-auction-v1', matchId: 'auction-wave-b-reduced',
    auction: { auctionId: 'auction-reduced', propertyId: 2, status: 'open', currentBid: 300, currentBidder: -1, endAt: Date.now() + 5000, eligiblePlayers: [0], revision: 1 },
  });
  check('reduced motion keeps auction presentation static and starts no countdown timer', reducedAuction.timers() === 0);
  reducedAuction.game.destroy();

  const waiting = createHarness(makeStorage(null), { online: true, myIdx: 1 });
  check('remote turn is a waiting-only presentation state', waiting.area.querySelector('.monopoly-wave-b-stage').dataset.monopolyStatus === 'waiting' && waiting.area.querySelector('[data-monopoly-control="dice"]').dataset.monopolyDiceState === 'waiting');
  waiting.game.destroy();
  const spectator = createHarness(makeStorage(null), { online: true, spectator: true });
  check('spectator state stays read-only and disables the existing dice control', spectator.area.querySelector('.monopoly-wave-b-stage').dataset.monopolyStatus === 'spectating' && spectator.area.querySelector('[data-monopoly-control="dice"]').disabled === true);
  spectator.game.destroy();

  const reduced = createHarness(makeStorage(null), { reducedMotion: true });
  reduced.game.onMove({ roll: [1, 1] }, 0);
  check('reduced-motion roll reaches existing buy state without a Wave B presentation timer', reduced.timers() === 0 && reduced.area.querySelector('.monopoly-wave-b-stage').dataset.monopolyPhase === 'buy');
  reduced.game.destroy();
} catch (error) {
  check('Wave B Monopoly runtime matrix executes', false, error && error.stack || String(error));
}

if (failures) {
  console.error('GAME_STAGE_WAVE_B_MONOPOLY_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('GAME_STAGE_WAVE_B_MONOPOLY_ALL_PASS');
}
