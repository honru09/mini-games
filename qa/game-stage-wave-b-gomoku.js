'use strict';

// Wave B is presentation-only. This contract intentionally runs Gomoku in a
// tiny DOM so the new visual seam cannot accidentally alter its rule model,
// socket contract, or lifecycle cleanup.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'gomoku.js'), 'utf8');
let failures = 0;
function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

function createNode(tag) {
  const classes = new Set();
  const listeners = new Map();
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [], parentNode: null, dataset: {}, attributes: {}, textContent: '',
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
    dispatch(type, event) { (listeners.get(type) || []).forEach(handler => handler(event || {})); },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 520, height: 520 }; },
  };
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
  if (node.tagName === 'CANVAS') {
    const context = {
      setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, save() {}, restore() {}, clip() {}, fillRect() {}, setLineDash() {},
      createRadialGradient() { return { addColorStop() {} }; },
    };
    node.getContext = () => context;
  }
  return node;
}

function findByClass(root, className) {
  if (!root) return null;
  if (root.classList && root.classList.contains(className)) return root;
  for (const child of root.children || []) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

function run(flag, options) {
  options = options || {};
  const area = createNode('div');
  const extra = createNode('div');
  let timers = 0;
  const localStorage = {
    getItem() {
      if (options.storageThrows) throw new Error('storage blocked');
      return flag;
    },
  };
  const window = { devicePixelRatio: 1, localStorage };
  const sandbox = {
    console, window, document: { createElement: createNode }, Date, Math, Number, String, Array, Object, Set, Map, JSON, Promise,
    setTimeout() { timers++; return timers; }, clearTimeout() {},
    el(tag, className, text) { const node = createNode(tag); node.className = className || ''; if (text !== undefined) node.textContent = String(text); return node; },
    t(key, ...args) { return key + (args.length ? ':' + args.join(',') : ''); },
    gameArtEnabled() { return false; }, stickerArtEnabled() { return false; }, tabletopArtEnabled() { return false; },
    prefersReducedMotion() { return !!options.reducedMotion; }, playFeedback() {}, setStatus() {}, renderPlayers() {}, aiChoose: async () => null, aiSpeak() {},
    online: { room: null, isHost: false }, toast() {}, showVictoryOverlay() {}, shareGameLink() {}, openInvitePicker() {},
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(SOURCE, context, { filename: 'gomoku.js' });
  const instance = context.gameGomoku(area, extra, 2, {});
  return { area, extra, instance, timers: () => timers };
}

// Red-light source contract. The exact state values are intentionally stable
// so shared CSS can be developed separately without becoming a rule consumer.
check('Wave B resolves its own safe local flag', /function gomokuWaveBEnabled\(\)/.test(SOURCE) && /mg_art_game_stage_wave_b_v1/.test(SOURCE));
check('Wave B has a stable arena, frame, status and last-move seam', ['gomoku-wave-b-stage', 'gomoku-wave-b-arena', 'gomoku-wave-b-board-frame', 'gomoku-wave-b-meta', 'gomoku-wave-b-state', 'gomoku-wave-b-last-move', 'gomoku-wave-b-board'].every(token => SOURCE.includes(token)));
check('Wave B keeps its state out of the rule snapshot', !/function snapshot\(\)\{[^}]*gomokuWaveB/.test(SOURCE));
check('Wave B cleanup is part of the normal destroy lifecycle', /destroy:\s*\(\)\s*=>\s*\{[\s\S]*releaseGomokuWaveBPresentation\(\)/.test(SOURCE));

try {
  const active = run(null);
  const stage = findByClass(active.area, 'gomoku-wave-b-stage');
  const frame = findByClass(active.area, 'gomoku-wave-b-board-frame');
  const meta = findByClass(active.area, 'gomoku-wave-b-meta');
  const state = findByClass(active.area, 'gomoku-wave-b-state');
  const lastMove = findByClass(active.area, 'gomoku-wave-b-last-move');
  const board = findByClass(active.area, 'gomoku-wave-b-board');
  check('default flag mounts a compact Wave B board stage', !!stage && !!frame && !!meta && !!state && !!lastMove && !!board && board.parentNode === frame && board.dataset.gridSize === '15' && active.area.classList.contains('gomoku-wave-b-arena'));
  check('empty board exposes a neutral last-move value and a localized turn state', lastMove && lastMove.textContent === '—' && state && state.textContent === 'player_turn:1' && stage.dataset.gomokuPhase === 'turn-1');
  active.instance.onMove([7, 7], 0);
  const snapshot = active.instance.snapshot();
  check('a move updates only presentation metadata and preserves the snapshot contract', lastMove.textContent === 'H8' && stage.dataset.gomokuPhase === 'turn-2' && board.dataset.lastMove === 'H8' && JSON.stringify(snapshot) === JSON.stringify({ hist: [[7, 7]], cur: 1, over: false, last: [7, 7] }));
  active.instance.destroy();
  check('destroy removes the Wave B wrapper and stale flag class', !findByClass(active.area, 'gomoku-wave-b-stage') && !active.area.classList.contains('gomoku-wave-b-arena') && active.area.children.length === 1 && active.area.children[0].classList.contains('gomoku-board'));

  const rollback = run('0');
  check("exact '0' strictly retains the old direct-canvas Wave A DOM", !findByClass(rollback.area, 'gomoku-wave-b-stage') && rollback.area.children.length === 1 && rollback.area.children[0].classList.contains('gomoku-board') && !rollback.area.classList.contains('gomoku-wave-b-arena'));
  rollback.instance.destroy();
  const unknown = run('unexpected');
  check("only exact '0' rolls back; other stored values keep the default Wave B", !!findByClass(unknown.area, 'gomoku-wave-b-stage') && unknown.area.classList.contains('gomoku-wave-b-arena'));
  unknown.instance.destroy();
  const blocked = run(null, { storageThrows: true });
  check('storage access failure fails closed to Wave A', !findByClass(blocked.area, 'gomoku-wave-b-stage') && !blocked.area.classList.contains('gomoku-wave-b-arena'));
  blocked.instance.destroy();
  const reduced = run(null, { reducedMotion: true });
  reduced.instance.onMove([7, 7], 0);
  check('reduced-motion move keeps Wave B status static and starts no presentation timer', reduced.timers() === 0 && findByClass(reduced.area, 'gomoku-wave-b-last-move').textContent === 'H8');
  reduced.instance.destroy();
} catch (error) {
  check('Wave B Gomoku runtime matrix executes', false, error && error.stack || String(error));
}

if (failures) {
  console.error('GAME_STAGE_WAVE_B_GOMOKU_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('GAME_STAGE_WAVE_B_GOMOKU_ALL_PASS');
}
