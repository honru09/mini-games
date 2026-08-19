'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'ludo.js'), 'utf8');
const EXECUTABLE = SOURCE;
const GHOST_INPUT_SOURCE = SOURCE.slice(SOURCE.indexOf('function ludoGhost3DHandleInput'), SOURCE.indexOf('function ludoGhost3DForwardInput'));
const APPLY_DICE_SOURCE = SOURCE.slice(SOURCE.indexOf('function applyDice(d)'), SOURCE.indexOf('function pick(pid, ti)'));
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
    dataset: {}, attributes: {}, textContent: '', clientWidth: 520, clientHeight: 520, disabled: false,
    style: {
      setProperty(key, item) { this[key] = String(item); },
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
    removeEventListener(type, handler) { if (listeners.has(type)) listeners.get(type).delete(handler); },
    dispatch(type, event) { (listeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
    setAttribute(key, item) {
      this.attributes[key] = String(item);
      if (String(key).startsWith('data-')) this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = String(item);
    },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    removeAttribute(key) {
      delete this.attributes[key];
      if (String(key).startsWith('data-')) delete this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())];
    },
    querySelector(selector) { return query(this, selector, false); },
    querySelectorAll(selector) { return query(this, selector, true); },
  };
  Object.defineProperty(value, 'innerHTML', {
    get() { return ''; },
    set(_item) { value.children.forEach(child => { child.parentNode = null; }); value.children = []; },
  });
  Object.defineProperty(value, 'className', {
    get() { return [...classes].join(' '); },
    set(input) { classes.clear(); String(input || '').split(/\s+/).filter(Boolean).forEach(item => classes.add(item)); },
  });
  value.classList = {
    add(...items) { items.forEach(item => classes.add(item)); },
    remove(...items) { items.forEach(item => classes.delete(item)); },
    contains(item) { return classes.has(item); },
  };
  return value;
}

function matches(value, selector) {
  if (selector.startsWith('.')) return value.classList && value.classList.contains(selector.slice(1));
  const data = /^\[data-([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (!data) return value.tagName.toLowerCase() === selector.toLowerCase();
  const key = data[1].replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
  return Object.prototype.hasOwnProperty.call(value.dataset, key) && (data[2] === undefined || value.dataset[key] === data[2]);
}

function query(root, selector, all) {
  const found = [];
  const queue = (root.children || []).slice();
  while (queue.length) {
    const value = queue.shift();
    if (matches(value, selector)) { if (!all) return value; found.push(value); }
    queue.push(...(value.children || []));
  }
  return all ? found : null;
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
  if (value && typeof value === 'object') Object.keys(value).forEach(key => { visit(key, value[key]); walk(value[key], visit); });
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
          if (state.disposed || !message || typeof message !== 'object') return Object.freeze({ accepted: false, snapshot: snapshot() });
          if (message.type === 'frame') {
            if (state.terminal || !message.frame || !Number.isSafeInteger(message.frame.revision) || (state.revision !== null && message.frame.revision <= state.revision)) return Object.freeze({ accepted: false, snapshot: snapshot() });
            state.frame = message.frame;
            state.revision = message.frame.revision;
            state.terminal = message.frame.terminal === true;
            if (state.adapter && typeof state.adapter.render === 'function') state.adapter.render(state.frame, {}, () => {});
            return Object.freeze({ accepted: true, revision: state.revision, snapshot: snapshot() });
          }
          if (message.type === 'recover') {
            state.adapter = message.adapter;
            if (!state.adapter || typeof state.adapter.mount !== 'function' || typeof state.adapter.render !== 'function') return Object.freeze({ accepted: false, snapshot: snapshot() });
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
            if (state.terminal || !message.command || message.command.revision !== state.revision) return Object.freeze({ accepted: false, snapshot: snapshot() });
            const accepted = options.onInput ? options.onInput(message.command, snapshot()) !== false : true;
            return Object.freeze({ accepted, snapshot: snapshot() });
          }
          if (message.type === 'motion' || message.type === 'lifecycle' || message.type === 'environment') return Object.freeze({ accepted: true, snapshot: snapshot() });
          return Object.freeze({ accepted: false, snapshot: snapshot() });
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
    addEventListener(type, handler) { if (!documentListeners.has(type)) documentListeners.set(type, new Set()); documentListeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (documentListeners.has(type)) documentListeners.get(type).delete(handler); },
    dispatch(type, event) { (documentListeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...documentListeners.values()].reduce((sum, set) => sum + set.size, 0); },
  };
  const values = {
    mg_art_game_stage_wave_b_v1: settings.waveB === undefined ? null : settings.waveB,
    mg_ghost3d_ludo_v1: settings.ghost3d === undefined ? null : settings.ghost3d,
    mg_ghost3d_ludo_quality_v1: settings.quality === undefined ? null : settings.quality,
  };
  const window = {
    localStorage: { getItem(key) { if (settings.storageThrows) throw new Error('blocked'); return values[key] === undefined ? null : values[key]; } },
    matchMedia() { return media; },
    addEventListener(type, handler) { if (!windowListeners.has(type)) windowListeners.set(type, new Set()); windowListeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (windowListeners.has(type)) windowListeners.get(type).delete(handler); },
    dispatch(type, event) { (windowListeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...windowListeners.values()].reduce((sum, set) => sum + set.size, 0); },
  };
  const log = { imports: 0, hosts: [], adapters: [] };
  let resolveImport = null;
  const module = {
    isLudo3DSupported() { return settings.supported !== false; },
    createLudo3DAdapter(options) {
      let ready = false;
      const record = { options, adapter: null, mountCalls: 0, renderCalls: 0, readyCalls: 0 };
      const adapter = {
        mount(_context, done) { record.mountCalls++; if (done) done(); },
        render(_frame, _context, done) { record.renderCalls++; if (!ready) { ready = true; record.readyCalls++; options.onReady(); } if (done) done(); },
        dispose() { adapter.disposed = (adapter.disposed || 0) + 1; },
      };
      record.adapter = adapter;
      log.adapters.push(record);
      return adapter;
    },
  };
  const math = Object.create(Math);
  math.random = () => 0.99;
  function loadGameModule() {
    log.imports++;
    if (settings.deferImport) return new Promise(resolve => { resolveImport = resolve; });
    return Promise.resolve({ ok:true, module });
  }
  const sandbox = {
    console, window, document, Math: math, Number, String, Boolean, Array, Object, Set, Map, JSON, Promise, Date,
    PLAYER_COLORS: ['#e5484d', '#3b82f6', '#22a06b', '#f59e0b'], PLAYER_BG: ['#fee2e2', '#dbeafe', '#dcfce7', '#fef3c7'],
    setTimeout() { return 1; }, clearTimeout() {},
    el(tag, className, text) { const value = node(tag); value.className = className || ''; if (text !== undefined) value.textContent = String(text); return value; },
    t(key, ...args) { return key + (args.length ? ':' + args.join(',') : ''); },
    tabletopArtEnabled() { return false; }, markTabletopSurface() {}, prefersReducedMotion() { return !!settings.reducedMotion; },
    makeDice3D() { const wrap = node('div'); return { wrap, roll(value, done) { wrap.dataset.value = String(value); if (done) done(); }, reset() {} }; },
    sfx() {}, setStatus() {}, renderPlayers() {}, playFeedback() {}, emitAcceptedAudioCue() {}, toast() {}, showVictoryOverlay() {}, shareGameLink() {}, aiChoose: async () => null, aiSpeak() {}, confirmAIReady() {},
    Ghost3DFoundation: makeFoundation(log),
    GameModuleLoader: { load: loadGameModule },
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(EXECUTABLE, context, { filename: 'ludo-ghost3d.js' });
  const game = context.gameLudo(area, extra, 2, { ai:new Set(), online:false, myIdx:0, isHost:true, sendMove() {}, sendRestart() {}, isReplaying() { return false; } });
  return { area, extra, game, log, document, window, media, resolveImport: () => resolveImport && resolveImport({ ok:true, module }) };
}

async function settle(turns) {
  for (let index = 0; index < (turns || 12); index++) await Promise.resolve();
}

check('bridge is frozen behind exact opt-in and cannot bypass Wave B',
  /function ludoGhost3DEnabled\(\)[\s\S]{0,420}storage\.getItem\(LUDO_GHOST3D_STORAGE_KEY\) === '1'/.test(SOURCE) &&
  /LUDO_GHOST3D_STORAGE_KEY = 'mg_ghost3d_ludo_v1'/.test(SOURCE) && /if \(!ludoWaveBActive\) return false;/.test(SOURCE));
check('bridge owns no engine objects and only requests its GameModuleLoader island lazily',
  /GameModuleLoader\.load\('ludo'/.test(SOURCE) && !/\bTHREE\b|\bgsap\b|ScrollTrigger/.test(SOURCE));
check('frame projects distinct seat and physical PID data with ranking-only terminal state',
  /kind:'ludo-3d-frame-v1'/.test(SOURCE) && /players:pids\.map\(\(pid, seat\) => \(\{ seat, pid, colour:pid \}\)\)/.test(SOURCE) &&
  /pieces:pids\.flatMap/.test(SOURCE) && /terminal:ludoWaveCProcess === 'ranking'/.test(SOURCE) && /status = ludoWaveBStatus\(\) === 'finished' \? 'ended'/.test(SOURCE));
check('renderer input validates revision and accepts only the existing token-pick seam',
  /command\.revision !== ludoGhost3DAcceptedRevision/.test(GHOST_INPUT_SOURCE) &&
  /if \(command\.type !== 'select_token'\) return false;/.test(GHOST_INPUT_SOURCE) && /pick\(curPid\(\), tokenIndex\);/.test(GHOST_INPUT_SOURCE) &&
  !/\broll\(/.test(GHOST_INPUT_SOURCE) && !/applyDice\(|applyPick\(/.test(GHOST_INPUT_SOURCE));
check('one composite piece motion is queued after a state transition and emitted only after accepted frame publication',
  /type:'piece_moved'[\s\S]{0,760}capturedTokens:[\s\S]{0,300}nextActiveSeat/.test(SOURCE) &&
  (SOURCE.match(/type:'piece_moved'/g) || []).length === 1 && !SOURCE.includes('dice_rolled') && !/queueLudoGhost3DMotion\(/.test(APPLY_DICE_SOURCE) &&
  /if \(!result \|\| result\.accepted !== true\) return false;[\s\S]{0,560}type:'motion'/.test(SOURCE));
check('terminal result beat is presentation-only and follows an accepted ranking frame',
  /frame\.terminal === true && frame\.process && frame\.process\.stage === 'ranking'/.test(SOURCE) &&
  /type:'terminal', winnerSeat:frame\.winnerSeat, standings:frame\.standings, revision/.test(SOURCE));
check('blocking podium dialog waits only for a ready animated ranking shot',
  /function queueLudoOutcome\(\)[\s\S]{0,760}dataset\.ghost3dReady === 'true'/.test(SOURCE) &&
  /rendererReady && !prefersReducedMotion\(\) && quality !== 'LOW'/.test(SOURCE) &&
  /quality === 'HIGH' \? 520 : 420/.test(SOURCE) &&
  /if \(ludoWaveCProcess !== 'ranking'\) return false;/.test(SOURCE) &&
  /ludoOutcomeTimer = setTimeout\([\s\S]{0,180}outcomeEpoch === epoch/.test(SOURCE) &&
  /function clearLudoOutcomeTimer\(\)/.test(SOURCE));
check('podium dialog timing stays outside rule and Replay idle ownership',
  /function ludoIsIdle\(\)\{[\s\S]{0,220}ludoWaveCProcessTimers\.size === 0;[\s\S]{0,40}\}/.test(SOURCE) &&
  !/function ludoIsIdle\(\)\{[^}]*ludoOutcome/.test(SOURCE));
check('reset, restore, recovery, and destroy explicitly invalidate local bridge work',
  /restartLudoGhost3DHost\('reset'\)/.test(SOURCE) && /restartLudoGhost3DHost\('restore'\)/.test(SOURCE) &&
  /queueLudoGhost3DRecovery/.test(SOURCE) && /disposeLudoGhost3DBridge\(\)/.test(SOURCE) && /ludoDestroyed = true/.test(SOURCE));
check('presentation-only bridge names stay out of snapshot and serialized rule state',
  !/function snapshot\(\)\{[^}]*ludoGhost3D/.test(SOURCE) && !/serialize:\s*\(\) => \(\{[^}]*ludoGhost3D/.test(SOURCE));

(async () => {
  try {
    const defaultOn = run({ waveB:null, ghost3d:null });
    await settle();
    check('missing key keeps the production Wave B surface and creates no renderer work',
      defaultOn.log.hosts.length === 0 && defaultOn.log.imports === 0 && !!findByClass(defaultOn.area, 'ludo-wave-b-stage') && !findByClass(defaultOn.area, 'ludo-ghost3d-slot'));
    defaultOn.game.destroy();

    const rollback = run({ waveB:null, ghost3d:'0' });
    await settle();
    check('exact Ghost3D rollback leaves the Wave B DOM fallback mounted',
      rollback.log.hosts.length === 0 && rollback.log.imports === 0 && !!findByClass(rollback.area, 'ludo-wave-b-stage') && !findByClass(rollback.area, 'ludo-ghost3d-slot'));
    rollback.game.destroy();

    const waveA = run({ waveB:'0', ghost3d:'1' });
    await settle();
    check('Wave A rollback blocks host, overlay, and module import',
      waveA.log.hosts.length === 0 && waveA.log.imports === 0 && !findByClass(waveA.area, 'ludo-wave-b-stage') && !findByClass(waveA.area, 'ludo-ghost3d-slot'));
    waveA.game.destroy();

    const enabled = run({ waveB:null, ghost3d:'1', quality:'invalid', reducedMotion:true });
    await settle();
    const frame = findByClass(enabled.area, 'ludo-wave-b-board-frame');
    const board = findByClass(enabled.area, 'ludo-wave-b-board');
    const slot = findByClass(enabled.area, 'ludo-ghost3d-slot');
    const meta = findByClass(enabled.area, 'ludo-wave-b-meta');
    const firstHost = enabled.log.hosts[0];
    const firstFrame = firstHost && firstHost.calls.find(call => call.type === 'frame');
    let deniedKey = false;
    if (firstFrame) walk(firstFrame.frame, key => { if (['adapter','renderer','canvas','engine','mesh','material','texture'].includes(key)) deniedKey = true; });
    check('enabled path creates one lazy host and places its overlay after the retained board before metadata',
      enabled.log.imports === 1 && enabled.log.hosts.length === 1 && !!slot && frame.children.indexOf(board) < frame.children.indexOf(slot) && frame.parentNode.children.indexOf(frame) < frame.parentNode.children.indexOf(meta));
    check('first successful render alone grants pointer readiness and invalid quality falls back to BALANCED',
      slot.dataset.ghost3dReady === 'true' && frame.dataset.ghost3dReady === 'true' && firstHost.options.quality === 'BALANCED');
    check('initial Ludo frame is frozen, pure, and preserves the two-player physical PID mapping',
      !!firstFrame && Object.isFrozen(firstFrame.frame) && Object.isFrozen(firstFrame.frame.board) && !deniedKey &&
      firstFrame.frame.kind === 'ludo-3d-frame-v1' && firstFrame.frame.board.players.map(player => player.pid).join(',') === '0,2' &&
      firstFrame.frame.board.pieces.length === 8 && firstFrame.frame.terminal === false && firstFrame.frame.status !== 'finished');
    const adapter = enabled.log.adapters[0];
    const initialRevision = firstHost.state.revision;
    const beforeRejectedRoll = JSON.stringify(enabled.game.snapshot());
    const rejectedRoll = adapter.options.emitInput({ type:'roll', revision:initialRevision });
    await settle();
    const afterRejectedRoll = JSON.stringify(enabled.game.snapshot());
    const dice = findByClass(enabled.extra, 'dice-btn');
    if (dice) dice.dispatch('click');
    await settle();
    const selected = adapter.options.emitInput({ type:'select_token', tokenIndex:0, revision:firstHost.state.revision });
    await settle();
    const stale = adapter.options.emitInput({ type:'select_token', tokenIndex:1, revision:initialRevision });
    check('renderer rejects roll while the existing DOM dice path enables the legal token selection',
      rejectedRoll && rejectedRoll.accepted === false && beforeRejectedRoll === afterRejectedRoll && !!dice && selected && selected.accepted === true &&
      stale && stale.accepted === false && enabled.game.snapshot().tokens[0][0] === 0);
    const motions = firstHost.calls.filter(call => call.type === 'motion');
    const moves = motions.filter(call => call.event.type === 'piece_moved');
    const move = moves[0];
    check('accepted movement emits exactly one same-revision composite event with actor/path/outcome details',
      motions.length === 1 && moves.length === 1 && !!move && move.event.revision === firstHost.state.revision && move.event.seat === 0 && move.event.tokenIndex === 0 &&
      Array.isArray(move.event.path) && move.event.path.length === 1 && move.event.from === -1 && move.event.destination === 0 && move.event.takeoff === true &&
      Array.isArray(move.event.capturedTokens) && move.event.extraTurn === true && move.event.nextActiveSeat === 0);
    adapter.options.onContextLost('test-loss');
    await settle();
    check('context loss disables pointer handoff then recovers a fresh adapter from the loaded module',
      enabled.log.adapters.length === 2 && enabled.log.adapters[0].adapter.disposed === 1 && enabled.log.adapters[1].mountCalls === 1 &&
      enabled.log.adapters[1].renderCalls >= 1 && slot.dataset.ghost3dReady === 'true');
    enabled.document.hidden = true;
    enabled.document.dispatch('visibilitychange');
    enabled.window.dispatch('ghostgame:shellchange', { detail:{ active:false, gameId:null } });
    enabled.media.emit(false);
    check('visibility, shell, and media listeners only forward Foundation lifecycle/environment messages',
      firstHost.calls.some(call => call.type === 'lifecycle' && call.action === 'hidden') &&
      firstHost.calls.some(call => call.type === 'lifecycle' && call.action === 'suspend') &&
      firstHost.calls.some(call => call.type === 'environment' && call.reducedMotion === false));

    enabled.game.onRestore({ tokens:[[56,56,56,55],[-1,-1,-1,-1]], curIdx:0, phase:'pick', dice:1, over:false, winner:-1 });
    await settle();
    const restoreHost = enabled.log.hosts.at(-1);
    enabled.game.onMove({ ti:3 }, 0);
    await settle();
    const terminalHost = enabled.log.hosts.at(-1);
    const terminalFrame = terminalHost.calls.filter(call => call.type === 'frame').at(-1);
    check('ranking creates a fresh terminal host only after the local ranking process settles',
      terminalHost !== restoreHost && terminalFrame && terminalFrame.frame.ended === true && terminalFrame.frame.terminal === true);
    check('terminal host receives one revision-bound podium camera event after its ranking frame',
      terminalHost.calls.some(call => call.type === 'motion' && call.event.type === 'terminal' &&
        call.event.winnerSeat === 0 && Array.isArray(call.event.standings) && call.event.revision === terminalHost.state.revision));
    enabled.game.onRestart();
    await settle();
    const resetHost = enabled.log.hosts.at(-1);
    const resetFrame = resetHost.calls.find(call => call.type === 'frame');
    check('reset replaces the terminal host with a fresh nonterminal generation',
      resetHost !== terminalHost && resetFrame && resetFrame.frame.terminal === false && resetFrame.frame.ended === false);
    const listenerCount = enabled.document.listenerCount() + enabled.window.listenerCount() + enabled.media.listenerCount();
    enabled.game.destroy();
    check('destroy disposes host, removes overlay, and clears DOM/media listeners',
      listenerCount >= 3 && resetHost.disposed === 1 && !findByClass(enabled.area, 'ludo-ghost3d-slot') &&
      enabled.document.listenerCount() + enabled.window.listenerCount() + enabled.media.listenerCount() === 0);

    const staleReset = run({ waveB:null, ghost3d:'1', deferImport:true });
    await settle();
    const beforeResetHost = staleReset.log.hosts[0];
    staleReset.game.onRestart();
    const afterResetHost = staleReset.log.hosts.at(-1);
    staleReset.resolveImport();
    await settle();
    check('a delayed import after reset only recovers the fresh host generation',
      staleReset.log.imports === 1 && beforeResetHost.disposed === 1 && afterResetHost !== beforeResetHost && afterResetHost.disposed === 0 && staleReset.log.adapters.length === 1);
    staleReset.game.destroy();

    const staleDestroy = run({ waveB:null, ghost3d:'1', deferImport:true });
    await settle();
    const staleHost = staleDestroy.log.hosts[0];
    staleDestroy.game.destroy();
    staleDestroy.resolveImport();
    await settle();
    check('a delayed import after destroy cannot mount an adapter or revive the overlay',
      staleDestroy.log.imports === 1 && staleHost.disposed === 1 && staleDestroy.log.adapters.length === 0 && !findByClass(staleDestroy.area, 'ludo-ghost3d-slot'));
  } catch (error) {
    check('Ludo Ghost3D VM contract executes', false, error && error.stack || String(error));
  }
  if (failures) {
    console.error('LUDO_GHOST3D_CONTRACT_FAILURES=' + failures);
    process.exitCode = 1;
  } else {
    console.log('LUDO_GHOST3D_CONTRACT_ALL_PASS');
  }
})();
