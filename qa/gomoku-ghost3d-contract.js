'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'gomoku.js'), 'utf8');
const THREE_STRATEGY = fs.readFileSync(path.join(ROOT, 'requirements', 'THREEJS_OFFICIAL_INTEGRATION_STRATEGY_20260812.md'), 'utf8');
const GSAP_STRATEGY = fs.readFileSync(path.join(ROOT, 'requirements', 'GSAP_OFFICIAL_3D_MOTION_STRATEGY_20260812.md'), 'utf8');
const EXECUTABLE = SOURCE.replace("import('./three/gomoku-entry.js')", "__import3d('./three/gomoku-entry.js')");
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

function node(tag) {
  const classes = new Set();
  const listeners = new Map();
  const value = {
    tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null,
    dataset: {}, attributes: {}, textContent: '', clientWidth: 520, clientHeight: 520,
    style: {
      setProperty(key, item) { this[key] = String(item); },
      removeProperty(key) { delete this[key]; },
    },
    appendChild(child) {
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
    removeEventListener(type, handler) { if (listeners.has(type)) listeners.get(type).delete(handler); },
    dispatch(type, event) { (listeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...listeners.values()].reduce((count, set) => count + set.size, 0); },
    setAttribute(key, item) { this.attributes[key] = String(item); },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; },
  };
  Object.defineProperty(value, 'className', {
    get() { return [...classes].join(' '); },
    set(input) { classes.clear(); String(input || '').split(/\s+/).filter(Boolean).forEach(item => classes.add(item)); },
  });
  value.classList = {
    add(...items) { items.forEach(item => classes.add(item)); },
    remove(...items) { items.forEach(item => classes.delete(item)); },
    contains(item) { return classes.has(item); },
  };
  if (value.tagName === 'CANVAS') {
    value.getContext = () => ({
      setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, save() {}, restore() {}, clip() {}, fillRect() {}, setLineDash() {},
      createRadialGradient() { return { addColorStop() {} }; },
    });
  }
  return value;
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

function walk(value, visit) {
  if (Array.isArray(value)) return value.forEach(item => walk(item, visit));
  if (value && typeof value === 'object') {
    Object.keys(value).forEach(key => { visit(key, value[key]); walk(value[key], visit); });
  }
}

function makeFoundation(log) {
  return {
    create(options) {
      const state = { revision: null, terminal: false, frame: null, adapter: null, disposed: false };
      const row = { options, state, calls: [], disposed: 0 };
      log.hosts.push(row);
      const snapshot = () => Object.freeze({ revision: state.revision, terminal: state.terminal, frame: state.frame, adapterReady: !!state.adapter });
      return {
        apply(message) {
          row.calls.push(message);
          if (state.disposed) return Object.freeze({ accepted: false, reason: 'disposed', snapshot: snapshot() });
          if (!message || typeof message !== 'object') return Object.freeze({ accepted: false, reason: 'invalid', snapshot: snapshot() });
          if (message.type === 'frame') {
            if (state.terminal || !message.frame || !Number.isSafeInteger(message.frame.revision) || (state.revision !== null && message.frame.revision <= state.revision)) {
              return Object.freeze({ accepted: false, reason: 'frame_rejected', snapshot: snapshot() });
            }
            state.frame = message.frame;
            state.revision = message.frame.revision;
            state.terminal = message.frame.terminal === true;
            if (state.adapter && typeof state.adapter.render === 'function') state.adapter.render(state.frame, {}, () => {});
            return Object.freeze({ accepted: true, revision: state.revision, snapshot: snapshot() });
          }
          if (message.type === 'recover') {
            state.adapter = message.adapter;
            if (!state.adapter || typeof state.adapter.mount !== 'function' || typeof state.adapter.render !== 'function') {
              return Object.freeze({ accepted: false, reason: 'adapter', snapshot: snapshot() });
            }
            state.adapter.mount({}, () => {});
            if (state.frame) state.adapter.render(state.frame, {}, () => {});
            return Object.freeze({ accepted: true, snapshot: snapshot() });
          }
          if (message.type === 'context-lost') {
            if (state.adapter && typeof state.adapter.dispose === 'function') state.adapter.dispose();
            state.adapter = null;
            return Object.freeze({ accepted: true, snapshot: snapshot() });
          }
          if (message.type === 'input') {
            if (state.terminal || !message.command || message.command.revision !== state.revision) return Object.freeze({ accepted: false, reason: 'input', snapshot: snapshot() });
            const accepted = options.onInput ? options.onInput(message.command, snapshot()) !== false : true;
            return Object.freeze({ accepted, snapshot: snapshot() });
          }
          if (message.type === 'motion' || message.type === 'lifecycle' || message.type === 'environment') return Object.freeze({ accepted: true, snapshot: snapshot() });
          return Object.freeze({ accepted: false, reason: 'unknown', snapshot: snapshot() });
        },
        dispose() { state.disposed = true; row.disposed++; if (state.adapter && typeof state.adapter.dispose === 'function') state.adapter.dispose(); return snapshot(); },
        snapshot,
      };
    },
  };
}

function run(settings) {
  settings = settings || {};
  const area = node('div');
  const extra = node('div');
  const documentListeners = new Map();
  const windowListeners = new Map();
  const mediaListeners = new Set();
  const media = {
    matches: !!settings.reducedMotion,
    addEventListener(type, handler) { if (type === 'change') mediaListeners.add(handler); },
    removeEventListener(type, handler) { if (type === 'change') mediaListeners.delete(handler); },
    emit(matches) { this.matches = !!matches; mediaListeners.forEach(handler => handler({ matches: this.matches })); },
    listenerCount() { return mediaListeners.size; },
  };
  const document = {
    hidden: !!settings.hidden,
    createElement: node,
    addEventListener(type, handler) { if (!documentListeners.has(type)) documentListeners.set(type, new Set()); documentListeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (documentListeners.has(type)) documentListeners.get(type).delete(handler); },
    dispatch(type, event) { (documentListeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...documentListeners.values()].reduce((count, set) => count + set.size, 0); },
  };
  const values = {
    mg_art_game_stage_wave_b_v1: settings.waveB === undefined ? null : settings.waveB,
    mg_ghost3d_gomoku_v1: settings.ghost3d === undefined ? null : settings.ghost3d,
    mg_ghost3d_gomoku_quality_v1: settings.quality === undefined ? null : settings.quality,
  };
  const window = {
    devicePixelRatio: 1,
    localStorage: { getItem(key) { if (settings.storageThrows) throw new Error('blocked'); return values[key] === undefined ? null : values[key]; } },
    matchMedia() { return media; },
    addEventListener(type, handler) { if (!windowListeners.has(type)) windowListeners.set(type, new Set()); windowListeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (windowListeners.has(type)) windowListeners.get(type).delete(handler); },
    dispatch(type, event) { (windowListeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...windowListeners.values()].reduce((count, set) => count + set.size, 0); },
  };
  const log = { imports: 0, adapters: [], hosts: [] };
  let resolveImport = null;
  const module = {
    isGomoku3DSupported() { return settings.supported !== false; },
    createGomoku3DAdapter(options) {
      let ready = false;
      const record = { options, adapter: null, mountCalls: 0, renderCalls: 0, readyCalls: 0 };
      const adapter = {
        mount(_context, done) { record.mountCalls += 1; if (done) done(); },
        render(_frame, _context, done) { record.renderCalls += 1; if (!ready) { ready = true; record.readyCalls += 1; options.onReady(); } if (done) done(); },
        dispose() { adapter.disposed = (adapter.disposed || 0) + 1; },
      };
      record.adapter = adapter;
      log.adapters.push(record);
      return adapter;
    },
  };
  const sandbox = {
    console, window, document, Math, Number, String, Boolean, Array, Object, Set, Map, JSON, Promise, Date,
    setTimeout() { return 1; }, clearTimeout() {},
    el(tag, className, text) { const value = node(tag); value.className = className || ''; if (text !== undefined) value.textContent = String(text); return value; },
    t(key, ...args) { return key + (args.length ? ':' + args.join(',') : ''); },
    gameArtEnabled() { return false; }, stickerArtEnabled() { return false; }, tabletopArtEnabled() { return false; },
    prefersReducedMotion() { return !!settings.reducedMotion; }, playFeedback() {}, setStatus() {}, renderPlayers() {}, aiChoose: async () => null, aiSpeak() {}, confirmAIReady() {},
    online: { room: null, isHost: false }, toast() {}, showVictoryOverlay() {}, shareGameLink() {}, openInvitePicker() {},
    Ghost3DFoundation: makeFoundation(log),
    __import3d() {
      log.imports++;
      if (settings.deferImport) return new Promise(resolve => { resolveImport = resolve; });
      return Promise.resolve(module);
    },
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(EXECUTABLE, context, { filename: 'gomoku-ghost3d.js' });
  const game = context.gameGomoku(area, extra, 2, { ai: new Set(), online: false, myIdx: 0, isHost: true, sendMove() {}, sendRestart() {} });
  return { area, extra, game, log, document, window, media, module, resolveImport: () => resolveImport && resolveImport(module) };
}

async function settle(turns) {
  for (let index = 0; index < (turns || 10); index++) await Promise.resolve();
}

check('bridge has a strict independent default-off gate and no Wave A bypass',
  /function gomokuGhost3DEnabled\(\)[\s\S]{0,420}mg_ghost3d_gomoku_v1'\) === '1'/.test(SOURCE) &&
  /if \(!gomokuWaveBActive\) return false;/.test(SOURCE));
check('classic bridge only uses its ESM path and keeps engine objects out of the source',
  SOURCE.includes("import('./three/gomoku-entry.js')") && !/\bTHREE\b|\bgsap\b|ScrollTrigger/.test(SOURCE));
check('semantic frame has the frozen Gomoku-only shape and terminal derives only from Wave C terminal',
  /kind:'gomoku-3d-frame-v1'/.test(SOURCE) && /board:\{[\s\S]{0,260}size:N[\s\S]{0,260}stones[\s\S]{0,260}lastMove[\s\S]{0,260}winningLine/.test(SOURCE) &&
  /terminal:gomokuWaveCProcess === 'terminal'/.test(SOURCE) && /gomokuGhost3DFreeze/.test(SOURCE));
check('renderer input validates current revision and reuses keyboard/ghost/local placement seams',
  /function gomokuGhost3DHandleInput[\s\S]{0,520}command\.revision !== gomokuGhost3DAcceptedRevision/.test(SOURCE) &&
  /setGomokuKeyboardCell\(row, col\)/.test(SOURCE) && /placeLocalGomokuMove\(row, col\)/.test(SOURCE) && /type === 'clear_aim'/.test(SOURCE));
check('terminal/reset generation, deferred publication, recovery, and destroy invalidation are explicit',
  /restartGomokuGhost3DHost\('terminal'\)/.test(SOURCE) && /restartGomokuGhost3DHost\('reset'\)/.test(SOURCE) &&
  /Promise\.resolve\(\)\.then\(\(\) => \{[\s\S]{0,180}publishGomokuGhost3DFrame/.test(SOURCE) &&
  /queueGomokuGhost3DRecovery/.test(SOURCE) && /disposeGomokuGhost3DBridge\(\)/.test(SOURCE));
check('piece semantic motion is emitted only after a newly accepted frame',
  /result\.accepted !== true\) return false;[\s\S]{0,520}type:'motion',[\s\S]{0,180}type:'piece_placed'/.test(SOURCE));
check('the implementation ADR closes the same-origin relative ESM graph without an import map',
  THREE_STRATEGY.includes('ADR-20260812-GOMOKU-CLOSED-RELATIVE-ESM-GRAPH') &&
  GSAP_STRATEGY.includes('ADR-20260812-GOMOKU-CLOSED-RELATIVE-ESM-GRAPH') &&
  THREE_STRATEGY.includes("import * as THREE from '../vendor/three/r185/build/three.module.js';") &&
  GSAP_STRATEGY.includes("import * as THREE from '../vendor/three/r185/build/three.module.js';") &&
  !THREE_STRATEGY.includes('<script type="importmap">') &&
  !GSAP_STRATEGY.includes("import * as THREE from 'three';"));

(async () => {
  try {
    const off = run({ waveB: null, ghost3d: null });
    await settle();
    check('default-off creates no host, overlay, or module request while Wave B remains mounted',
      off.log.hosts.length === 0 && off.log.imports === 0 && !findByClass(off.area, 'gomoku-ghost3d-slot') && !!findByClass(off.area, 'gomoku-wave-b-stage'));
    off.game.destroy();

    const waveA = run({ waveB: '0', ghost3d: '1' });
    await settle();
    check('Wave B rollback blocks the technical host, import, and slot',
      waveA.log.hosts.length === 0 && waveA.log.imports === 0 && !findByClass(waveA.area, 'gomoku-ghost3d-slot') && !findByClass(waveA.area, 'gomoku-wave-b-stage'));
    waveA.game.destroy();

    const enabled = run({ waveB: null, ghost3d: '1', quality: 'LOW', reducedMotion: true });
    await settle();
    const frame = findByClass(enabled.area, 'gomoku-wave-b-board-frame');
    const slot = findByClass(enabled.area, 'gomoku-ghost3d-slot');
    const meta = findByClass(enabled.area, 'gomoku-wave-b-meta');
    const board = findByClass(enabled.area, 'gomoku-wave-b-board');
    const firstHost = enabled.log.hosts[0];
    const firstFrame = firstHost && firstHost.calls.find(call => call.type === 'frame');
    let invalidKey = false;
    if (firstFrame) walk(firstFrame.frame, key => { if (['adapter', 'renderer', 'canvas', 'engine', 'mesh', 'material', 'texture'].includes(key)) invalidKey = true; });
    check('enabled path lazy-loads exactly once and mounts the slot between canvas and meta',
      enabled.log.imports === 1 && enabled.log.hosts.length === 1 && !!slot && frame.children.indexOf(board) < frame.children.indexOf(slot) && frame.children.indexOf(slot) < frame.children.indexOf(meta),
      JSON.stringify({ imports:enabled.log.imports, hosts:enabled.log.hosts.length, slot:!!slot, frame:!!frame }));
    check('first adapter render owns readiness while canvas accessibility and controls remain intact',
      slot.dataset.ghost3dReady === 'true' && frame.dataset.ghost3dReady === 'true' && board.getAttribute('role') === 'grid' && board.getAttribute('tabindex') === '0' && !!findByClass(enabled.extra, 'gomoku-touch-controls'));
    check('accepted presentation frame is frozen, pure, and starts nonterminal',
      !!firstFrame && Object.isFrozen(firstFrame.frame) && Object.isFrozen(firstFrame.frame.board) && !invalidKey && firstFrame.frame.kind === 'gomoku-3d-frame-v1' && firstFrame.frame.board.size === 15 && firstFrame.frame.ended === false && firstFrame.frame.terminal === false && firstHost.options.quality === 'LOW');
    const adapter = enabled.log.adapters[0];
    const initialRevision = firstHost.state.revision;
    const aimed = adapter.options.emitInput({ type: 'aim_cell', row: 7, col: 7, revision: initialRevision });
    await settle();
    const selected = adapter.options.emitInput({ type: 'select_cell', row: 7, col: 7, revision: firstHost.state.revision });
    await settle();
    const stale = adapter.options.emitInput({ type: 'aim_cell', row: 7, col: 8, revision: initialRevision });
    check('adapter commands use the existing local path and reject a stale revision',
      aimed && selected && stale && stale.accepted === false && JSON.stringify(enabled.game.snapshot()) === JSON.stringify({ hist: [[7, 7]], cur: 1, over: false, last: [7, 7] }));
    check('the placement motion follows the accepted frame with the same cell/player/revision',
      firstHost.calls.some(call => call.type === 'motion' && call.event.type === 'piece_placed' && call.event.row === 7 && call.event.col === 7 && call.event.player === 0 && call.event.revision === firstHost.state.revision));
    adapter.options.onContextLost('test-loss');
    await settle();
    check('context loss falls back then recovers exactly one fresh adapter from the loaded module',
      enabled.log.adapters.length === 2 && enabled.log.adapters[0].adapter.disposed === 1 && slot.dataset.ghost3dReady === 'true' && firstHost.state.adapter === enabled.log.adapters[1].adapter &&
      enabled.log.adapters[1].mountCalls === 1 && enabled.log.adapters[1].renderCalls >= 1 && enabled.log.adapters[1].readyCalls === 1);
    enabled.document.hidden = true;
    enabled.document.dispatch('visibilitychange');
    enabled.window.dispatch('ghostgame:shellchange', { detail: { active: false, gameId: null } });
    enabled.media.emit(false);
    check('visibility, shell, and reduced-motion listeners inject only Foundation lifecycle/environment messages',
      firstHost.calls.some(call => call.type === 'lifecycle' && call.action === 'hidden') && firstHost.calls.some(call => call.type === 'lifecycle' && call.action === 'suspend') && firstHost.calls.some(call => call.type === 'environment' && call.reducedMotion === false));

    enabled.document.hidden = false;
    enabled.document.dispatch('visibilitychange');
    enabled.window.dispatch('ghostgame:shellchange', { detail: { active: true, gameId: 'gomoku' } });
    enabled.game.onRestart();
    await settle();
    [[7, 3], [0, 0], [7, 4], [0, 1], [7, 5], [0, 2], [7, 6], [0, 3], [7, 7]].forEach(move => enabled.game.onMove(move));
    await settle();
    const terminalHost = enabled.log.hosts.at(-1);
    const terminalFrame = terminalHost.calls.filter(call => call.type === 'frame').at(-1);
    check('terminal process creates a fresh host generation and only its terminal frame latches',
      enabled.log.hosts.length >= 2 && terminalHost !== firstHost && terminalFrame && terminalFrame.frame.ended === true && terminalFrame.frame.terminal === true);
    enabled.game.onRestart();
    await settle();
    const resetHost = enabled.log.hosts.at(-1);
    const resetFrame = resetHost.calls.find(call => call.type === 'frame');
    check('reset disposes the terminal host and creates a fresh nonterminal generation',
      resetHost !== terminalHost && resetFrame && resetFrame.frame.terminal === false && resetFrame.frame.ended === false);
    const listenersBeforeDestroy = enabled.document.listenerCount() + enabled.window.listenerCount() + enabled.media.listenerCount();
    enabled.game.destroy();
    check('destroy disposes the current host, removes slot, and cleans external listeners',
      listenersBeforeDestroy >= 3 && resetHost.disposed === 1 && !findByClass(enabled.area, 'gomoku-ghost3d-slot') && enabled.document.listenerCount() + enabled.window.listenerCount() + enabled.media.listenerCount() === 0);

    const staleReset = run({ waveB: null, ghost3d: '1', deferImport: true });
    await settle();
    const beforeResetHost = staleReset.log.hosts[0];
    staleReset.game.onRestart();
    const afterResetHost = staleReset.log.hosts.at(-1);
    staleReset.resolveImport();
    await settle();
    check('a delayed module result after reset recovers only the fresh host generation',
      staleReset.log.imports === 1 && beforeResetHost.disposed === 1 && afterResetHost !== beforeResetHost && afterResetHost.disposed === 0 && staleReset.log.adapters.length === 1);
    staleReset.game.destroy();

    const staleImport = run({ waveB: null, ghost3d: '1', deferImport: true });
    await settle();
    const staleHost = staleImport.log.hosts[0];
    staleImport.game.destroy();
    staleImport.resolveImport();
    await settle();
    check('a delayed module result after destroy cannot mount a stale adapter or revive the slot',
      staleImport.log.imports === 1 && staleHost.disposed === 1 && staleImport.log.adapters.length === 0 && !findByClass(staleImport.area, 'gomoku-ghost3d-slot'));
  } catch (error) {
    check('Gomoku Ghost3D VM contract executes', false, error && error.stack || String(error));
  }

  if (failures) {
    console.error('GOMOKU_GHOST3D_CONTRACT_FAILURES=' + failures);
    process.exitCode = 1;
  } else {
    console.log('GOMOKU_GHOST3D_CONTRACT_ALL_PASS');
  }
})();
