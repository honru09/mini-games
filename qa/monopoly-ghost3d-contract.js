'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MonopolyPresentationAdapter = require('../public/src/games/monopoly-presentation-adapter');
const Ghost3DFoundation = require('../public/src/core/08-ghost3d-foundation');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'monopoly.js'), 'utf8');
const EXECUTABLE = SOURCE;
const BRIDGE_SOURCE = SOURCE.includes('MONOPOLY_GHOST3D_STORAGE_KEY')
  ? SOURCE.slice(SOURCE.indexOf('MONOPOLY_GHOST3D_STORAGE_KEY'), SOURCE.indexOf('function rentOf'))
  : '';
const FRAME_SOURCE = SOURCE.includes('function monopolyGhost3DFrame')
  ? SOURCE.slice(SOURCE.indexOf('function monopolyGhost3DFrame'), SOURCE.indexOf('function monopolyGhost3DMotionFromPresentation'))
  : '';
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures += 1;
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
    insertBefore(child, before) {
      if (!child) return child;
      if (child.parentNode && typeof child.parentNode.removeChild === 'function') child.parentNode.removeChild(child);
      child.parentNode = this;
      const index = this.children.indexOf(before);
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
          if (message.type === 'motion' || message.type === 'lifecycle' || message.type === 'environment') return Object.freeze({ accepted: true, snapshot: snapshot() });
          return Object.freeze({ accepted: false, snapshot: snapshot() });
        },
        dispose() { state.disposed = true; row.disposed += 1; if (state.adapter && typeof state.adapter.dispose === 'function') state.adapter.dispose(); return snapshot(); },
        snapshot,
      };
    },
  };
}

function tracedFoundation(log) {
  return {
    create(options) {
      const host = Ghost3DFoundation.create(options);
      const row = { options, calls: [], disposed: 0, state: host.snapshot() };
      log.hosts.push(row);
      return {
        apply(message) {
          row.calls.push(message);
          const result = host.apply(message);
          row.state = host.snapshot();
          return result;
        },
        dispose() {
          row.disposed += 1;
          row.state = host.dispose();
          return row.state;
        },
        snapshot() { row.state = host.snapshot(); return row.state; },
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
    mg_ghost3d_monopoly_v1: settings.ghost3d === undefined ? null : settings.ghost3d,
    mg_ghost3d_monopoly_quality_v1: settings.quality === undefined ? null : settings.quality,
  };
  let nextTimer = 1;
  const timers = [];
  const window = {
    localStorage: { getItem(key) { if (settings.storageThrows) throw new Error('blocked'); return values[key] === undefined ? null : values[key]; } },
    getComputedStyle() { return { paddingLeft: '0px', paddingRight: '0px' }; },
    matchMedia() { return media; },
    addEventListener(type, handler) { if (!windowListeners.has(type)) windowListeners.set(type, new Set()); windowListeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (windowListeners.has(type)) windowListeners.get(type).delete(handler); },
    dispatch(type, event) { (windowListeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...windowListeners.values()].reduce((sum, set) => sum + set.size, 0); },
    requestAnimationFrame(callback) { callback(); return 1; },
    cancelAnimationFrame() {},
  };
  const log = { imports: 0, hosts: [], adapters: [] };
  let resolveImport = null;
  const match = { value: settings.matchId || 'm-ghost3d-1' };
  const sandboxMath = Object.create(Math);
  sandboxMath.random = typeof settings.random === 'number' ? () => settings.random : Math.random;
  const module = {
    isMonopoly3DSupported() { return settings.supported !== false; },
    createMonopoly3DAdapter(options) {
      let ready = false;
      const record = { options, adapter: null, mountCalls: 0, renderCalls: 0, motionCalls: 0 };
      const adapter = {
        id: 'monopoly-three-r185',
        mount(_context, done) { record.mountCalls += 1; if (done) done(settings.adapterMountFailure ? new Error('adapter-mount-failure') : undefined); },
        render(_frame, _context, done) { record.renderCalls += 1; if (!ready) { ready = true; options.onReady(); } if (done) done(); },
        motion(_event, _context, done) { record.motionCalls += 1; if (done) done(); },
        setQuality(_quality, _context, done) { if (done) done(); },
        environment(_environment, _context, done) { if (done) done(); },
        suspend(_context, done) { if (done) done(); },
        resume(_context, done) { if (done) done(); },
        contextLost(_context, done) { if (done) done(); },
        dispose() { adapter.disposed = (adapter.disposed || 0) + 1; },
      };
      record.adapter = adapter;
      log.adapters.push(record);
      return adapter;
    },
  };
  function loadGameModule() {
    log.imports += 1;
    if (settings.deferImport) return new Promise(resolve => { resolveImport = resolve; });
    return Promise.resolve({ ok:true, module });
  }
  const sandbox = {
    console, window, document, Math: sandboxMath, Number, String, Boolean, Array, Object, Set, Map, JSON, Promise, Date,
    setTimeout(callback) { const timer = { id: nextTimer++, callback, active: true }; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer && typeof timer === 'object') timer.active = false; },
    el(tag, className, text) { const value = node(tag); value.className = className || ''; if (text !== undefined) value.textContent = String(text); return value; },
    t(key, ...args) { return key + (args.length ? ':' + args.join(',') : ''); },
    PLAYER_COLORS: ['#e5484d', '#3b82f6', '#22a06b', '#f59e0b', '#8b5cf6'],
    tabletopArtEnabled() { return false; }, markTabletopSurface() {}, prefersReducedMotion() { return !!settings.reducedMotion; },
    makeDice3D() { const wrap = node('div'); return { wrap, roll(_value, done) { if (done) done(); }, reset() {} }; },
    sfx() {}, setStatus() {}, renderPlayers() {}, playFeedback() {}, emitAcceptedAudioCue() {}, toast() {}, showVictoryOverlay() {}, shareGameLink() {}, aiChoose: async () => null, aiSpeak() {}, confirmAIReady() {},
    MonopolyCharacterPresentation: { project(input) { return input.players.map((player, seatId) => ({ displayPosition: Number(player.visualPos), character: { schemaVersion: 'player-character-v1', characterId: 'character-base-01', slots: { body: 'body-paper-01' } }, seatId })); } },
    MonopolyPresentationAdapter: settings.presentationAdapter || MonopolyPresentationAdapter,
    MonopolyRules: settings.online ? {} : undefined,
    Ghost3DFoundation: settings.realFoundation ? tracedFoundation(log) : makeFoundation(log),
    GameModuleLoader: { load: loadGameModule },
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(EXECUTABLE, context, { filename: 'monopoly-ghost3d.js' });
  const options = { ai: new Set(), online: !!settings.online, myIdx: 0, isHost: true, sendMove() {}, sendRestart() {}, isReplaying() { return false; } };
  if (settings.online) {
    options.gameplayMeta = { protocol: 'monopoly-rule-v2' };
    options.sendMonopolyAction = () => {};
    options.getMatchId = () => match.value;
    options.getPublicSeats = () => [];
  }
  const game = context.gameMonopoly(area, extra, settings.players || 2, options);
  function flushTimers(count) {
    let completed = 0;
    while (completed < (count || 1)) {
      const timer = timers.find(item => item.active);
      if (!timer) break;
      timer.active = false;
      timer.callback();
      completed += 1;
    }
    return completed;
  }
  return { area, extra, game, log, document, window, media, flushTimers, setMatchId(value) { match.value = value; }, resolveImport: () => resolveImport && resolveImport({ ok:true, module }) };
}

async function settle(turns) {
  for (let index = 0; index < (turns || 14); index += 1) await Promise.resolve();
}

function onlineAuthority(matchId, revision, overrides) {
  const source = overrides || {};
  const phase = source.phase || 'roll';
  const terminal = source.terminal === true;
  const winner = Number.isInteger(source.winner) ? source.winner : -1;
  const players = source.players || [{ id: 0, pos: 0, alive: true }, { id: 1, pos: 6, alive: true }];
  const state = {
    players,
    current: Number.isInteger(source.current) ? source.current : 0,
    round: Number.isInteger(source.round) ? source.round : 1,
    phase,
    terminal,
    winner,
    owners: source.owners || {},
    chanceDeck: [],
  };
  return {
    protocol: 'monopoly-rule-v2',
    matchId,
    revision,
    stateHash: source.stateHash || ('state-' + matchId + '-' + revision),
    phase,
    terminal,
    winner,
    state,
    transition: source.transition || null,
  };
}

function frameCalls(host) {
  return (host && host.calls || []).filter(call => call.type === 'frame');
}

function motionCalls(host) {
  return (host && host.calls || []).filter(call => call.type === 'motion');
}

function invalidDirectionPresentationAdapter() {
  return {
    create() {
      return {
        consume(input) {
          const authority = input.authority;
          const state = authority.state;
          return {
            accepted: true,
            frame: {
              protocol: 'monopoly-rule-v2',
              matchId: authority.matchId,
              revision: authority.revision,
              stateHash: authority.stateHash,
              players: state.players.map((player, index) => ({
                playerId: index,
                seatId: index,
                authorityPosition: player.pos,
                displayPosition: index === 0 ? 0 : player.pos,
                visible: player.alive !== false,
                presentation: null,
              })),
              animation: { mode: 'step', player: 0, from: 0, to: 2, steps: 2, direction: -1 },
              changes: { bankruptPlayers: [] },
            },
          };
        },
        reset() { return { accepted: true }; },
        destroy() {},
      };
    },
  };
}

check('bridge is frozen behind exact independent opt-in and cannot bypass Wave B',
  /const MONOPOLY_GHOST3D_STORAGE_KEY\s*=\s*'mg_ghost3d_monopoly_v1'/.test(SOURCE) &&
  /function monopolyGhost3DEnabled\(\)[\s\S]{0,420}storage\.getItem\(MONOPOLY_GHOST3D_STORAGE_KEY\)\s*===\s*'1'/.test(SOURCE) &&
  /if\(!monopolyWaveBActive\)return false;|if \(!monopolyWaveBActive\) return false;/.test(SOURCE));
check('bridge owns no engine objects and lazy-loads only through GameModuleLoader',
  /GameModuleLoader\.load\('monopoly'/.test(SOURCE) && !/\bTHREE\b|\bgsap\b|ScrollTrigger/.test(BRIDGE_SOURCE));
check('semantic frame remains a frozen Monopoly-only projection with no economic or authority mutations',
  /kind:'monopoly-3d-frame-v1'/.test(FRAME_SOURCE) && /cells:cells/.test(FRAME_SOURCE) && /index:index/.test(FRAME_SOURCE) && /ownerPlayerId/.test(FRAME_SOURCE) &&
  /playerId/.test(FRAME_SOURCE) && /authorityPosition/.test(FRAME_SOURCE) && /displayPosition/.test(FRAME_SOURCE) && /publicCharacter/.test(FRAME_SOURCE) &&
  /activePlayerId/.test(FRAME_SOURCE) && !/(?:money|price|dice|rng|canRoll|owned|reward|replay|ai)\s*:/.test(FRAME_SOURCE));
check('renderer cannot receive or send game commands; existing DOM controls remain the only mutation seams',
  !/monopolyGhost3DForwardInput|monopolyGhost3DHandleInput|type:'input'|onInput\s*:|emitInput\s*:/.test(BRIDGE_SOURCE) &&
  /rollBtn\.addEventListener\('click', roll\)/.test(SOURCE) && /renderRuleActions\(\)/.test(SOURCE));
check('only one semantic composite motion type exists and it is revision-bound after frame acceptance',
  (SOURCE.match(/type:'token_moved'/g) || []).length === 1 && /eventId/.test(BRIDGE_SOURCE) && /actorPlayerId/.test(BRIDGE_SOURCE) &&
  /if\s*\(!result\s*\|\|\s*result\.accepted\s*!==\s*true\)\s*return false;[\s\S]{0,1300}type:'motion'/.test(BRIDGE_SOURCE));
check('terminal result beat is presentation-only and scheduled after the accepted terminal frame',
  /if\(frame\.terminal&&rendererCanAnimate\)[\s\S]{0,520}type:'terminal'/.test(BRIDGE_SOURCE) &&
  /function queueMonopolyOutcome/.test(SOURCE) && /quality==='HIGH'\?520:420/.test(SOURCE));
check('token motion validates signed steps, exact direction, and circular target arithmetic before it can be queued',
  /function monopolyGhost3DTokenMoved/.test(BRIDGE_SOURCE) &&
  /forward&&travelDirection!==1/.test(BRIDGE_SOURCE) && /backward&&travelDirection!==-1/.test(BRIDGE_SOURCE) &&
  /signed!==travelDirection\*Math\.abs\(signed\)/.test(BRIDGE_SOURCE) && /start\+signed/.test(BRIDGE_SOURCE));
check('reset, restore, terminal, recovery, and destroy explicitly invalidate bridge generations',
  /restartMonopolyGhost3DHost\('reset'\)/.test(SOURCE) && /restartMonopolyGhost3DHost\('restore'\)/.test(SOURCE) &&
  /queueMonopolyGhost3DRecovery/.test(SOURCE) && /disposeMonopolyGhost3DBridge\(\)/.test(SOURCE) && /monopolyDestroyed\s*=\s*true/.test(SOURCE));
check('the local walk hold is cleared by async invalidation, context loss, host restart, and bridge dispose',
  /function invalidateAsync\(\)[\s\S]{0,360}monopolyGhost3DLocalWalkHold\s*=\s*null/.test(SOURCE) &&
  /function monopolyGhost3DContextLost\([\s\S]{0,420}monopolyGhost3DLocalWalkHold\s*=\s*null/.test(BRIDGE_SOURCE) &&
  /function restartMonopolyGhost3DHost\([\s\S]{0,720}monopolyGhost3DLocalWalkHold\s*=\s*null/.test(BRIDGE_SOURCE) &&
  /function disposeMonopolyGhost3DBridge\([\s\S]{0,420}monopolyGhost3DLocalWalkHold\s*=\s*null/.test(BRIDGE_SOURCE));
check('presentation-only bridge names stay out of snapshot and serialized rule state',
  !/function snapshot\(\)\{[^}]*monopolyGhost3D/.test(SOURCE) && !/serialize:\s*\(\) => \(\{[^}]*monopolyGhost3D/.test(SOURCE));

(async () => {
  try {
    const defaultOn = run({ waveB: null, ghost3d: null });
    await settle();
    check('missing key keeps the production Wave B surface and creates no renderer work',
      defaultOn.log.hosts.length === 0 && defaultOn.log.imports === 0 && !!findByClass(defaultOn.area, 'monopoly-wave-b-stage') && !findByClass(defaultOn.area, 'monopoly-ghost3d-slot'));
    defaultOn.game.destroy();

    const rollback = run({ waveB: null, ghost3d: '0' });
    await settle();
    check('exact Ghost3D rollback leaves the Wave B DOM fallback mounted',
      rollback.log.hosts.length === 0 && rollback.log.imports === 0 && !!findByClass(rollback.area, 'monopoly-wave-b-stage') && !findByClass(rollback.area, 'monopoly-ghost3d-slot'));
    rollback.game.destroy();

    const waveA = run({ waveB: '0', ghost3d: '1' });
    await settle();
    check('Wave A rollback blocks host, overlay, and module import',
      waveA.log.hosts.length === 0 && waveA.log.imports === 0 && !findByClass(waveA.area, 'monopoly-wave-b-stage') && !findByClass(waveA.area, 'monopoly-ghost3d-slot'));
    waveA.game.destroy();

    const enabled = run({ waveB: null, ghost3d: '1', quality: 'invalid', reducedMotion: true });
    await settle();
    const frame = findByClass(enabled.area, 'monopoly-wave-b-board-frame');
    const board = findByClass(enabled.area, 'monopoly-wave-b-board');
    const slot = findByClass(enabled.area, 'monopoly-ghost3d-slot');
    const firstHost = enabled.log.hosts[0];
    const firstFrame = firstHost && firstHost.calls.find(call => call.type === 'frame');
    let deniedKey = false;
    if (firstFrame) walk(firstFrame.frame, key => { if (['adapter', 'renderer', 'canvas', 'engine', 'mesh', 'material', 'texture', 'money', 'price', 'dice', 'rng', 'owned'].includes(key)) deniedKey = true; });
    check('enabled path creates one lazy host and puts its inert overlay after the permanent board',
      enabled.log.imports === 1 && enabled.log.hosts.length === 1 && !!slot && frame.children.indexOf(board) < frame.children.indexOf(slot));
    check('first successful semantic render alone marks renderer readiness and invalid quality falls back to BALANCED',
      slot.dataset.ghost3dReady === 'true' && frame.dataset.ghost3dReady === 'true' && firstHost.options.quality === 'BALANCED');
    check('initial frame is frozen, pure, nonterminal, and contains 24 cells plus the active public seats',
      !!firstFrame && Object.isFrozen(firstFrame.frame) && Object.isFrozen(firstFrame.frame.board) && !deniedKey &&
      firstFrame.frame.kind === 'monopoly-3d-frame-v1' && firstFrame.frame.board.cells.length === 24 &&
      firstFrame.frame.players.length === 2 && firstFrame.frame.players.every(player => player.playerId === player.seatId && player.visible === true) &&
      firstFrame.frame.turn.activePlayerId === 0 && firstFrame.frame.terminal === false && firstFrame.frame.origin.source === 'local');
    const adapter = enabled.log.adapters[0];
    const dice = findByClass(enabled.extra, 'monopoly-wave-b-dice') || findByClass(enabled.area, 'monopoly-wave-b-dice');
    const command = findByClass(enabled.extra, 'monopoly-wave-b-command');
    if (dice) dice.dispatch('click');
    await settle();
    check('renderer adapter receives no input callbacks while the visible Command-area DOM dice remains the live mutation control',
      !Object.prototype.hasOwnProperty.call(adapter.options, 'onInput') && !Object.prototype.hasOwnProperty.call(adapter.options, 'emitInput') &&
      !!dice && !!command && dice.parentNode === command && dice.dataset.monopolyGhost3dControl === 'dom-command',
      JSON.stringify({ dice:!!dice, command:!!command, commandOwned:!!dice&&dice.parentNode===command, hasOnInput:Object.prototype.hasOwnProperty.call(adapter.options, 'onInput'), hasEmitInput:Object.prototype.hasOwnProperty.call(adapter.options, 'emitInput') }));
    adapter.options.onContextLost('test-loss');
    await settle();
    check('context loss keeps the DOM surface and recovers only a fresh adapter from the loaded module',
      enabled.log.adapters.length === 2 && enabled.log.adapters[0].adapter.disposed === 1 && enabled.log.adapters[1].mountCalls === 1 && slot.dataset.ghost3dReady === 'true');
    const recoveredAdapter=enabled.log.adapters[1];
    recoveredAdapter.options.onError(new Error('current-adapter-not-ready'));
    adapter.options.onReady();
    const staleReadyCannotRevive=slot.dataset.ghost3dReady === 'false' && dice.parentNode !== command;
    recoveredAdapter.options.onReady();
    const recoveredAdapterCount=enabled.log.adapters.length;
    const recoveredDice=findByClass(enabled.extra, 'monopoly-wave-b-dice') || findByClass(enabled.area, 'monopoly-wave-b-dice');
    adapter.options.onError(new Error('late-old-adapter'));
    adapter.options.onContextLost('late-old-adapter');
    await settle();
    check('late callbacks from the disposed context-loss adapter cannot alter ready state, relocate the DOM dice, or recover again',
      staleReadyCannotRevive && enabled.log.adapters.length === recoveredAdapterCount && slot.dataset.ghost3dReady === 'true' &&
      !!recoveredDice && recoveredDice.parentNode === command && recoveredDice.dataset.monopolyGhost3dControl === 'dom-command',
      JSON.stringify({ staleReadyCannotRevive, adapters:enabled.log.adapters.length, ready:slot.dataset.ghost3dReady, commandOwned:!!recoveredDice&&recoveredDice.parentNode===command }));

    const failedMount = run({ waveB: null, ghost3d: '1', realFoundation: true, adapterMountFailure: true });
    await settle();
    const failedMountSlot = findByClass(failedMount.area, 'monopoly-ghost3d-slot');
    const failedMountDice = findByClass(failedMount.extra, 'monopoly-wave-b-dice') || findByClass(failedMount.area, 'monopoly-wave-b-dice');
    const failedMountCommand = findByClass(failedMount.extra, 'monopoly-wave-b-command');
    const failedMountAdapter = failedMount.log.adapters[0];
    const failedMountAdapterCount = failedMount.log.adapters.length;
    if (failedMountAdapter) {
      failedMountAdapter.options.onReady();
      failedMountAdapter.options.onError(new Error('late-after-foundation-fallback'));
      failedMountAdapter.options.onContextLost('late-after-foundation-fallback');
    }
    await settle();
    check('Foundation adapter failure invalidates every late adapter callback before fallback takes DOM ownership',
      !!failedMountAdapter && failedMountAdapter.adapter.disposed === 1 && failedMount.log.adapters.length === failedMountAdapterCount &&
      failedMountSlot.dataset.ghost3dReady === 'false' && !!failedMountDice && failedMountDice.parentNode !== failedMountCommand,
      JSON.stringify({ disposed:failedMountAdapter&&failedMountAdapter.adapter.disposed, adapters:failedMount.log.adapters.length, ready:failedMountSlot&&failedMountSlot.dataset.ghost3dReady, commandOwned:!!failedMountDice&&failedMountDice.parentNode===failedMountCommand }));
    failedMount.game.destroy();

    enabled.document.hidden = true;
    enabled.document.dispatch('visibilitychange');
    enabled.window.dispatch('ghostgame:shellchange', { detail: { active: false, gameId: null } });
    enabled.media.emit(false);
    check('visibility, shell, and reduced-motion listeners only inject Foundation lifecycle/environment messages',
      firstHost.calls.some(call => call.type === 'lifecycle' && call.action === 'hidden') &&
      firstHost.calls.some(call => call.type === 'lifecycle' && call.action === 'suspend') &&
      firstHost.calls.some(call => call.type === 'environment' && call.reducedMotion === false));
    const terminalState = { players: [{ money: 2000, pos: 0, alive: true, props: [] }, { money: 1700, pos: 5, alive: true, props: [] }], cur: 0, phase: 'finished', round: 3, over: true, winner: 0, owners: [], deck: [] };
    enabled.game.onRestore(terminalState);
    await settle();
    const terminalHost = enabled.log.hosts[enabled.log.hosts.length - 1];
    const terminalFrame = terminalHost.calls.filter(call => call.type === 'frame').slice(-1)[0];
    check('restore creates a fresh terminal generation only when the supplied authoritative state is terminal',
      terminalHost !== firstHost && terminalFrame && terminalFrame.frame.terminal === true && terminalFrame.frame.winnerPlayerId === 0);
    enabled.game.onRestart();
    await settle();
    const resetHost = enabled.log.hosts[enabled.log.hosts.length - 1];
    const resetFrame = resetHost.calls.find(call => call.type === 'frame');
    check('reset replaces the terminal host with a new nonterminal generation',
      resetHost !== terminalHost && resetFrame && resetFrame.frame.terminal === false);
    const listenerCount = enabled.document.listenerCount() + enabled.window.listenerCount() + enabled.media.listenerCount();
    enabled.game.destroy();
    check('destroy disposes the host, removes the overlay, and clears DOM/media listeners',
      listenerCount >= 5 && resetHost.disposed === 1 && !findByClass(enabled.area, 'monopoly-ghost3d-slot') &&
      enabled.document.listenerCount() + enabled.window.listenerCount() + enabled.media.listenerCount() === 0);

    const five = run({ waveB: null, ghost3d: '1', players: 5 });
    await settle();
    const fiveHost = five.log.hosts[0];
    const fiveFrame = fiveHost && fiveHost.calls.find(call => call.type === 'frame');
    check('2–5 player projection preserves all five public seats without changing rule capacity',
      !!fiveFrame && fiveFrame.frame.players.length === 5 && fiveFrame.frame.players.map(player => player.seatId).join(',') === '0,1,2,3,4');
    five.game.destroy();

    const localMotion = run({ waveB: null, ghost3d: '1', random: 0 });
    await settle();
    const localHost = localMotion.log.hosts[0];
    const localDice = findByClass(localMotion.extra, 'monopoly-wave-b-dice') || findByClass(localMotion.area, 'monopoly-wave-b-dice');
    if (localDice) localDice.dispatch('click');
    await settle();
    const walkFrame = frameCalls(localHost).find(call => call.frame.process.stage === 'walk' && call.frame.players[0].authorityPosition === 2);
    const walkMotion = motionCalls(localHost).find(call => call.event && call.event.actorPlayerId === 0 && call.event.to === 2);
    const framesBeforeDomStep = frameCalls(localHost).length;
    localMotion.flushTimers(1);
    await settle();
    const framesAfterDomStep = frameCalls(localHost).length;
    check('a committed local move emits one revision-bound token motion from committed position rather than dice state',
      !!walkFrame && !!walkMotion && walkFrame.frame.players[0].displayPosition === 0 &&
      walkMotion.event.revision === walkFrame.frame.revision && walkMotion.event.from === 0 &&
      walkMotion.event.to === 2 && walkMotion.event.steps === 2 && walkMotion.event.direction === 1 &&
      motionCalls(localHost).length === 1,
      JSON.stringify({ walkFrame: walkFrame && walkFrame.frame, walkMotion: walkMotion && walkMotion.event }));
    check('DOM visualPos walk frames keep the canonical 3D frame stable until land releases the local hold',
      framesAfterDomStep === framesBeforeDomStep && !!walkFrame &&
      frameCalls(localHost).filter(call => call.frame.process.stage === 'walk').length === 1,
      JSON.stringify({ framesBeforeDomStep, framesAfterDomStep, frames: frameCalls(localHost).map(call => ({ revision: call.frame.revision, stage: call.frame.process.stage, display: call.frame.players[0].displayPosition })) }));
    localMotion.flushTimers(1);
    await settle();
    const localLandFrame = frameCalls(localHost).slice(-1)[0];
    check('landing releases the hold into a final canonical display position without a second motion',
      !!localLandFrame && localLandFrame.frame.process.stage === 'land' && localLandFrame.frame.players[0].displayPosition === 2 && motionCalls(localHost).length === 1,
      JSON.stringify({ last: localLandFrame && localLandFrame.frame, motions: motionCalls(localHost).length }));
    localMotion.game.destroy();

    const online = run({ waveB: null, ghost3d: '1', online: true, matchId: 'm-bridge-1' });
    await settle();
    check('online opt-in waits for an accepted presentation origin before constructing a renderer host', online.log.hosts.length === 0);
    const onlineInitial = onlineAuthority('m-bridge-1', 0);
    const onlineInitialAccepted = online.game.onMonopolyRuleState(onlineInitial, null, 'live');
    await settle();
    const onlineHost = online.log.hosts[0];
    const onlineMove = onlineAuthority('m-bridge-1', 1, {
      phase: 'resolving',
      players: [{ id: 0, pos: 2, alive: true }, { id: 1, pos: 6, alive: true }],
      transition: { type: 'monopoly_transition', events: [{ type: 'move', player: 0, from: 0, to: 2, steps: 2 }] },
    });
    const onlineMoveAccepted = online.game.onMonopolyRuleState(onlineMove, onlineMove.transition, 'live');
    await settle();
    const onlineMotionCount = motionCalls(onlineHost).length;
    const reconnect = onlineAuthority('m-bridge-1', 2, { players: [{ id: 0, pos: 5, alive: true }, { id: 1, pos: 6, alive: true }] });
    const reconnectAccepted = online.game.onMonopolyRuleState(reconnect, null, 'reconnect');
    await settle();
    const reconnectHost = online.log.hosts[online.log.hosts.length - 1];
    const reconnectFrame = frameCalls(reconnectHost).slice(-1)[0];
    check('accepted live movement animates once, while reconnect replaces the generation and snaps',
      onlineInitialAccepted === true && onlineMoveAccepted === true && onlineMotionCount === 1 && reconnectAccepted === true &&
      online.log.hosts.length === 2 && reconnectHost !== onlineHost && onlineHost.disposed === 1 &&
      !!reconnectFrame && reconnectFrame.frame.origin.source === 'reconnect' && motionCalls(reconnectHost).length === 0,
      JSON.stringify({ initialAccepted: onlineInitialAccepted, moveAccepted: onlineMoveAccepted, oldMotions: motionCalls(onlineHost).length, reconnectAccepted, hosts: online.log.hosts.length, origin: reconnectFrame && reconnectFrame.frame.origin }));
    const restoredAccepted = online.game.onMonopolyRuleState(onlineAuthority('m-bridge-1', 3), null, 'room-restored');
    await settle();
    const restoredHost = online.log.hosts[online.log.hosts.length - 1];
    const restoredFrame = frameCalls(restoredHost).slice(-1)[0];
    const spectatorAccepted = online.game.onMonopolyRuleState(onlineAuthority('m-bridge-1', 4), null, 'spectator-bootstrap');
    await settle();
    const spectatorHost = online.log.hosts[online.log.hosts.length - 1];
    const spectatorFrame = frameCalls(spectatorHost).slice(-1)[0];
    check('room restore and spectator bootstrap each replace the generation and remain static snaps',
      restoredAccepted === true && spectatorAccepted === true && online.log.hosts.length === 4 &&
      restoredHost !== reconnectHost && spectatorHost !== restoredHost && reconnectHost.disposed === 1 && restoredHost.disposed === 1 &&
      restoredFrame && restoredFrame.frame.origin.source === 'room-restored' && motionCalls(restoredHost).length === 0 &&
      spectatorFrame && spectatorFrame.frame.origin.source === 'spectator-bootstrap' && motionCalls(spectatorHost).length === 0,
      JSON.stringify({ restoredAccepted, spectatorAccepted, hosts: online.log.hosts.length, restoredOrigin: restoredFrame && restoredFrame.frame.origin, spectatorOrigin: spectatorFrame && spectatorFrame.frame.origin }));
    online.setMatchId('m-bridge-2');
    const nextMatch = onlineAuthority('m-bridge-2', 0);
    const nextMatchAccepted = online.game.onMonopolyRuleState(nextMatch, null, 'started');
    await settle();
    const nextMatchHost = online.log.hosts[online.log.hosts.length - 1];
    const lateOldMatch = online.game.onMonopolyRuleState(onlineAuthority('m-bridge-1', 3), null, 'live');
    check('match replacement starts a fresh generation and late callbacks from the old match cannot revive it',
      nextMatchAccepted === true && online.log.hosts.length === 5 && nextMatchHost !== spectatorHost && spectatorHost.disposed === 1 && lateOldMatch === false &&
      online.log.hosts[online.log.hosts.length - 1] === nextMatchHost,
      JSON.stringify({ nextMatchAccepted, hosts: online.log.hosts.length, oldDisposed: spectatorHost.disposed, lateOldMatch }));
    const terminal = onlineAuthority('m-bridge-2', 1, { phase: 'finished', terminal: true, winner: 0 });
    const terminalAccepted = online.game.onMonopolyRuleState(terminal, null, 'live');
    await settle();
    const afterTerminalHost = online.log.hosts[online.log.hosts.length - 1];
    const restarted = onlineAuthority('m-bridge-2', 2);
    const restartedAccepted = online.game.onMonopolyRuleState(restarted, null, 'started');
    await settle();
    check('terminal-to-new-match creates a fresh generation before a new nonterminal frame can mount',
      terminalAccepted === true && restartedAccepted === true && online.log.hosts.length === 6 && afterTerminalHost.disposed === 1 &&
      online.log.hosts[online.log.hosts.length - 1] !== afterTerminalHost,
      JSON.stringify({ terminalAccepted, restartedAccepted, hosts: online.log.hosts.length, terminalDisposed: afterTerminalHost.disposed }));
    online.game.destroy();

    const onlineRejected = run({ waveB: null, ghost3d: '1', online: true, matchId: 'm-rejected-origin' });
    await settle();
    const rejectedInitial = onlineAuthority('m-rejected-origin', 0);
    const rejectedInitialAccepted = onlineRejected.game.onMonopolyRuleState(rejectedInitial, null, 'live');
    await settle();
    const rejectedHost = onlineRejected.log.hosts[0];
    const rejectedAdapter = onlineRejected.log.adapters[0];
    const rejectedSlot = findByClass(onlineRejected.area, 'monopoly-ghost3d-slot');
    const duplicateRejected = onlineRejected.game.onMonopolyRuleState(rejectedInitial, null, 'live');
    await settle();
    const hostsAfterRejectedOrigin = onlineRejected.log.hosts.length;
    const adaptersAfterRejectedOrigin = onlineRejected.log.adapters.length;
    if(rejectedAdapter){
      rejectedAdapter.options.onReady();
      rejectedAdapter.options.onContextLost('late-old-generation');
    }
    await settle();
    check('rejected online origin disposes stale renderer work, ignores old callbacks, and exposes only the Wave B fallback',
      rejectedInitialAccepted === true && duplicateRejected === false && rejectedHost.disposed === 1 &&
      rejectedAdapter && rejectedAdapter.adapter.disposed === 1 && onlineRejected.log.hosts.length === hostsAfterRejectedOrigin &&
      onlineRejected.log.adapters.length === adaptersAfterRejectedOrigin && rejectedSlot.dataset.ghost3dReady === 'false',
      JSON.stringify({ rejectedInitialAccepted, duplicateRejected, disposed: rejectedHost.disposed, adapterDisposed: rejectedAdapter && rejectedAdapter.adapter.disposed, hosts: onlineRejected.log.hosts.length, adapters: onlineRejected.log.adapters.length, ready: rejectedSlot.dataset.ghost3dReady }));
    const recoveredAccepted = onlineRejected.game.onMonopolyRuleState(onlineAuthority('m-rejected-origin', 1), null, 'live');
    await settle();
    const recoveredHost = onlineRejected.log.hosts[onlineRejected.log.hosts.length - 1];
    check('a later valid authority frame recovers through a fresh host without reviving the stale one',
      recoveredAccepted === true && onlineRejected.log.hosts.length === 2 && recoveredHost !== rejectedHost &&
      frameCalls(recoveredHost).length === 1 && rejectedHost.disposed === 1,
      JSON.stringify({ recoveredAccepted, hosts: onlineRejected.log.hosts.length, frames: frameCalls(recoveredHost).length }));
    onlineRejected.game.destroy();

    const invalidDirection = run({ waveB: null, ghost3d: '1', online: true, matchId: 'm-invalid-direction', presentationAdapter: invalidDirectionPresentationAdapter() });
    await settle();
    const invalidDirectionAccepted = invalidDirection.game.onMonopolyRuleState(onlineAuthority('m-invalid-direction', 0, {
      phase: 'resolving', players: [{ id: 0, pos: 2, alive: true }, { id: 1, pos: 6, alive: true }],
    }), null, 'live');
    await settle();
    const invalidDirectionHost = invalidDirection.log.hosts[0];
    check('malformed step direction fails closed to a snap frame and never sends token_moved',
      invalidDirectionAccepted === true && frameCalls(invalidDirectionHost).length === 1 && motionCalls(invalidDirectionHost).length === 0 &&
      frameCalls(invalidDirectionHost)[0].frame.players[0].displayPosition === 2,
      JSON.stringify({ accepted: invalidDirectionAccepted, frames: frameCalls(invalidDirectionHost).length, motions: motionCalls(invalidDirectionHost).length, display: frameCalls(invalidDirectionHost)[0] && frameCalls(invalidDirectionHost)[0].frame.players[0].displayPosition }));
    invalidDirection.game.destroy();

    const staleReset = run({ waveB: null, ghost3d: '1', deferImport: true });
    await settle();
    const beforeResetHost = staleReset.log.hosts[0];
    staleReset.game.onRestart();
    const afterResetHost = staleReset.log.hosts[staleReset.log.hosts.length - 1];
    staleReset.resolveImport();
    await settle();
    check('a delayed import after reset only recovers the fresh host generation',
      staleReset.log.imports === 1 && beforeResetHost.disposed === 1 && afterResetHost !== beforeResetHost && afterResetHost.disposed === 0 && staleReset.log.adapters.length === 1);
    staleReset.game.destroy();

    const staleDestroy = run({ waveB: null, ghost3d: '1', deferImport: true });
    await settle();
    const staleHost = staleDestroy.log.hosts[0];
    staleDestroy.game.destroy();
    staleDestroy.resolveImport();
    await settle();
    check('a delayed import after destroy cannot mount an adapter or revive the overlay',
      staleDestroy.log.imports === 1 && staleHost.disposed === 1 && staleDestroy.log.adapters.length === 0 && !findByClass(staleDestroy.area, 'monopoly-ghost3d-slot'));
  } catch (error) {
    check('Monopoly Ghost3D VM contract executes', false, error && error.stack || String(error));
  }
  if (failures) {
    console.error('MONOPOLY_GHOST3D_CONTRACT_FAILURES=' + failures);
    process.exitCode = 1;
  } else {
    console.log('MONOPOLY_GHOST3D_CONTRACT_ALL_PASS');
  }
})();
