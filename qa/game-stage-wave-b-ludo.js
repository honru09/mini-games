'use strict';

// Wave B is presentation-only.  This contract uses a small DOM to prove that
// its seams never become part of Ludo rules, snapshots, or socket payloads.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'ludo.js'), 'utf8');
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
    clientWidth: 520, clientHeight: 520, disabled: false,
    style: {
      setProperty(key, value) { this[key] = String(value); },
      removeProperty(key) { delete this[key]; },
    },
    appendChild(child) {
      if (!child) return child;
      if (child.parentNode && typeof child.parentNode.removeChild === 'function') child.parentNode.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      if (child) child.parentNode = null;
      return child;
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    setAttribute(key, value) {
      this.attributes[key] = String(value);
      if (String(key).startsWith('data-')) this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = String(value);
    },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    removeAttribute(key) {
      delete this.attributes[key];
      if (String(key).startsWith('data-')) delete this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())];
    },
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
    const key = data[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    return Object.prototype.hasOwnProperty.call(node.dataset, key) && (data[2] === undefined || node.dataset[key] === data[2]);
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function query(root, selector, all) {
  const found = [];
  const queue = (root.children || []).slice();
  while (queue.length) {
    const node = queue.shift();
    if (matches(node, selector)) { if (!all) return node; found.push(node); }
    queue.push(...(node.children || []));
  }
  return all ? found : null;
}

function storage(value, throws) {
  return { value, getItem() { if (throws) throw new Error('storage blocked'); return this.value; } };
}

function createHarness(store, options) {
  options = options || {};
  const area = createNode('div');
  const extra = createNode('div');
  const sandbox = {
    console, JSON, Date, Math, Number, String, Array, Object, Map, Set, Promise,
    window: { localStorage: store },
    PLAYER_COLORS: ['#e5484d', '#3b82f6', '#22a06b', '#f59e0b'],
    PLAYER_BG: ['#fee2e2', '#dbeafe', '#dcfce7', '#fef3c7'],
    el(tag, className, text) {
      const node = createNode(tag); node.className = className || '';
      if (options.mountThrows && String(className || '').includes('ludo-wave-b-stage')) {
        const setAttribute = node.setAttribute;
        node.setAttribute = function(key, value) { if (key === 'role') throw new Error('presentation unavailable'); return setAttribute.call(this, key, value); };
      }
      if (text !== undefined) node.textContent = String(text); return node;
    },
    t(key, ...args) { return String(key) + (args.length ? ':' + args.join(',') : ''); },
    makeDice3D() { const wrap = createNode('div'); return { wrap, roll(value, done) { wrap.dataset.value = String(value); done(); }, reset() {} }; },
    setTimeout, clearTimeout,
    sfx() {}, setStatus() {}, renderPlayers() {}, playFeedback() {}, prefersReducedMotion() { return !!options.reducedMotion; },
    toast() {}, showVictoryOverlay() {}, shareGameLink() {}, confirmAIReady() {}, aiSpeak() {}, aiChoose: async () => null,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(SOURCE, context, { filename: 'ludo.js' });
  const game = context.gameLudo(area, extra, options.players || 2, {
    online: !!options.online, spectator: !!options.spectator, myIdx: options.myIdx === undefined ? 0 : options.myIdx,
    ai: new Set(), isHost: true, sendMove() {}, sendRestart() {}, onEnd() {}, isReplaying() { return false; },
  });
  return { area, extra, game };
}

check('Wave B owns a local safe flag resolver', /function ludoWaveBEnabled\(\)/.test(SOURCE) && /mg_art_game_stage_wave_b_v1/.test(SOURCE));
check('Wave B declares stable board, command, turn, state and ranking seams', [
  'ludo-wave-b-stage', 'ludo-wave-b-arena', 'ludo-wave-b-board-frame', 'ludo-wave-b-board',
  'ludo-wave-b-command', 'ludo-wave-b-turn-hud', 'ludo-wave-b-dice', 'ludo-wave-b-turn',
  'ludo-wave-b-state', 'ludo-wave-b-rankings', 'ludo-wave-b-standings', 'ludo-control', 'ludo-rank', 'ludo-stage',
].every(token => SOURCE.includes(token)));
check('Wave B presentation state stays out of the Ludo snapshot declaration', !/function snapshot\(\)\{[^}]*ludoWaveB|function snapshot\(\)\{[^}]*gameStageWaveB/.test(SOURCE));
check('Wave B introduces no GSAP runtime or animation dependency', !/\bgsap\b|ScrollTrigger/.test(SOURCE));

try {
  let h = createHarness(storage(null));
  const stage = h.area.querySelector('.ludo-wave-b-stage');
  const board = h.area.querySelector('.ludo-wave-b-board');
  const state = h.area.querySelector('.ludo-wave-b-state');
  const rankings = h.area.querySelector('.ludo-wave-b-rankings');
  const dice = h.extra.querySelector('[data-ludo-control="dice"]');
  check('default flag mounts a Wave B arena with board, command, state and rankings', !!stage && !!board && !!state && !!rankings && !!dice && h.area.classList.contains('ludo-wave-b-arena') && board.parentNode.classList.contains('ludo-wave-b-board-frame'));
  check('initial turn state is localized and exposes dice/active-player metadata', stage.dataset.ludoStage === 'wave-b' && h.area.dataset.ludoStage === 'wave-b' && stage.dataset.ludoPhase === 'roll' && stage.dataset.ludoStatus === 'active' && stage.dataset.ludoActivePlayer === '0' && h.area.dataset.ludoPhase === 'roll' && h.area.dataset.ludoStatus === 'active' && state.textContent === 'ludo_roll_die' && dice.dataset.ludoDiceState === 'roll');
  check('rankings expose all player presentation values without mutating the snapshot', rankings.children.length === 2 && rankings.children.every(item => item.dataset.ludoRank && item.dataset.ludoHome === '0') && JSON.stringify(h.game.snapshot()) === JSON.stringify({ tokens:[[-1,-1,-1,-1],[-1,-1,-1,-1]], curIdx:0, phase:'roll', dice:0, over:false, winner:-1 }));
  check('serialize keeps Wave B fields out of state and presentation payloads', !/ludo-wave-b|ludoWaveB|game-stage-wave-b|ludoPhase/.test(JSON.stringify(h.game.serialize())));
  h.game.onMove({ dice: 6 }, 0);
  check('a legal dice update refreshes only the Wave B state seam', stage.dataset.ludoPhase === 'pick' && state.textContent === 'ludo_choose_plane' && dice.dataset.ludoDiceState === 'pick' && h.game.snapshot().phase === 'pick' && h.game.snapshot().dice === 6);
  h.game.destroy();
  check('destroy releases wrappers and Wave B root marks while retaining Wave A children', !h.area.classList.contains('ludo-wave-b-arena') && !h.area.querySelector('.ludo-wave-b-stage') && h.area.children.length === 1 && h.area.children[0].classList.contains('ludo-board') && h.extra.children.length === 2, JSON.stringify({ areaChildren:h.area.children.length, areaClasses:h.area.className, first:h.area.children[0] && h.area.children[0].className, extraChildren:h.extra.children.length }));

  h = createHarness(storage('0'));
  check("exact '0' strictly retains the current direct Wave A board and command DOM", !h.area.classList.contains('ludo-wave-b-arena') && !h.area.querySelector('.ludo-wave-b-stage') && h.area.children.length === 1 && h.area.children[0].classList.contains('ludo-board') && h.extra.children.length === 2 && !h.extra.querySelector('[data-ludo-control="dice"]'));
  h.game.destroy();

  h = createHarness(storage('unexpected'));
  check("only exact '0' rolls back; unknown stored values keep Wave B", h.area.classList.contains('ludo-wave-b-arena') && !!h.area.querySelector('.ludo-wave-b-stage'));
  h.game.destroy();

  const toggledStorage = storage(null);
  h = createHarness(toggledStorage);
  toggledStorage.value = '0'; h.game.renderCosmetic({});
  const rolledBack = !h.area.classList.contains('ludo-wave-b-arena') && !h.area.querySelector('.ludo-wave-b-stage') && h.extra.children.length === 2;
  toggledStorage.value = '1'; h.game.renderCosmetic({});
  check('runtime flag changes only remount presentation DOM and preserve the exact position state', rolledBack && h.area.classList.contains('ludo-wave-b-arena') && !!h.area.querySelector('.ludo-wave-b-stage') && JSON.stringify(h.game.snapshot().tokens) === JSON.stringify([[-1,-1,-1,-1],[-1,-1,-1,-1]]), JSON.stringify({ rolledBack, areaChildren:h.area.children.length, areaClasses:h.area.className, stage:!!h.area.querySelector('.ludo-wave-b-stage'), tokens:h.game.snapshot().tokens }));
  h.game.destroy();

  h = createHarness(storage(null, true));
  check('storage access failure fails closed to Wave A', !h.area.classList.contains('ludo-wave-b-arena') && !h.area.querySelector('.ludo-wave-b-stage'));
  h.game.destroy();

  h = createHarness(storage(null), { mountThrows: true });
  check('presentation construction failure also fails closed to Wave A without resetting rules', !h.area.classList.contains('ludo-wave-b-arena') && !h.area.querySelector('.ludo-wave-b-stage') && h.area.children.length === 1 && h.extra.children.length === 2 && h.game.snapshot().phase === 'roll');
  h.game.destroy();

  h = createHarness(storage(null), { online: true, myIdx: 1 });
  check('remote active player is marked as a waiting state without changing turn ownership', h.area.querySelector('.ludo-wave-b-stage').dataset.ludoStatus === 'waiting' && h.area.querySelector('.ludo-wave-b-state').textContent === 'opponent_turn' && h.game.snapshot().curIdx === 0);
  h.game.destroy();

  h = createHarness(storage(null), { spectator: true });
  check('spectator state is exposed as read-only presentation metadata', h.area.querySelector('.ludo-wave-b-stage').dataset.ludoStatus === 'spectating' && h.extra.querySelector('[data-ludo-control="dice"]').disabled === true && h.area.querySelector('.ludo-wave-b-state').textContent === 'spectator_player_action:1');
  h.game.destroy();
} catch (error) {
  check('Wave B Ludo runtime matrix executes', false, error && error.stack || String(error));
}

if (failures) {
  console.error('GAME_STAGE_WAVE_B_LUDO_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('GAME_STAGE_WAVE_B_LUDO_ALL_PASS');
}
