'use strict';

/*
 * Tank Ghost3D P5 presenter contract.
 *
 * This suite deliberately checks the browser-facing source rather than a
 * replacement presenter.  Tank is a high-frequency authority game: a visual
 * bridge must never turn prediction, host relay, or a DOM render into an
 * authority fact.  The implementation under test is added by P5; until it
 * exists this file is an intentional, clean RED test.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const PRESENTER_FILE = path.join(ROOT, 'public', 'src', 'games', 'tank-ghost3d-presenter.js');
const TANK_FILE = path.join(ROOT, 'public', 'src', 'games', 'tank.js');
let assertions = 0;
let failures = 0;

function check(value, message) {
  assertions += 1;
  try { assert.ok(value, message); console.log('PASS  ' + message); }
  catch (error) { failures += 1; console.error('FAIL  ' + message); }
}

function source(file, label) {
  const exists = fs.existsSync(file);
  check(exists, label + ' exists');
  return exists ? fs.readFileSync(file, 'utf8') : '';
}

function segment(text, start, end) {
  const from = text.indexOf(start);
  const to = from < 0 ? -1 : text.indexOf(end, from + start.length);
  return from < 0 ? '' : text.slice(from, to < 0 ? text.length : to);
}

const presenter = source(PRESENTER_FILE, 'Tank P5 presenter');
const tank = source(TANK_FILE, 'Tank caller');

if (presenter) {
  check(/TankGhost3DPresenter/.test(presenter) && /create\s*:\s*create|create\s*[,}]/.test(presenter),
    'exports the frozen TankGhost3DPresenter deep Module');
  check(/create\s*\(\s*readModel\s*\)|function\s+create\s*\(\s*readModel\s*\)/.test(presenter),
    'Presenter accepts one readModel callback rather than a renderer/game socket surface');
  check(/commit\s*[:,]/.test(presenter) && /snapshot\s*[:,]/.test(presenter) && /dispose\s*[:,]/.test(presenter),
    'production interface is commit/snapshot/dispose');
  check(/mg_art_game_stage_wave_b_v1/.test(presenter) && /mg_ghost3d_tank_v1/.test(presenter) &&
    /getItem\(['"]mg_ghost3d_tank_v1['"]\)\s*===\s*['"]1['"]/.test(presenter),
    'feature gate is frozen behind exact one opt-in and Wave B');
  check(/tank-authority-v1/.test(presenter) && /receipt/i.test(presenter) && /serverTick/.test(presenter),
    'online projection has an explicit authority receipt and server tick guard');
  check(/committed/.test(presenter) && /online/.test(presenter) && /isReplaying|replay/i.test(presenter) && /authorityMode|accepted/.test(presenter),
    'local facts require an existing commit while replay and legacy relay stay DOM-only');
  check(/['"]local['"]/.test(presenter) && /['"]live['"]/.test(presenter) && /['"]reconcile['"]/.test(presenter),
    'frame source vocabulary is restricted to local/live/reconcile');
  check(/continuity/.test(presenter) && /['"]interpolate['"]/.test(presenter) && /['"]snap['"]/.test(presenter),
    'continuity is explicit rather than inferred by the renderer');
  check(/tank-3d-frame-v1/.test(presenter) && /playerCount/.test(presenter) && /projectiles/.test(presenter) &&
    /terminal/.test(presenter) && /winner/.test(presenter),
    'freezes the Tank P5 public frame vocabulary');
  check(/Object\.freeze|deepFreeze|freeze/.test(presenter),
    'projects immutable presentation data across the Foundation seam');
  check(/tank_ko/.test(presenter) && /tank_hit/.test(presenter) && /tank_fire/.test(presenter) && /tank_spawn/.test(presenter),
    'defines only the four approved bounded Tank semantic events');
  check(/tank_ko[\s\S]{0,220}tank_hit[\s\S]{0,220}tank_fire[\s\S]{0,220}tank_spawn/.test(presenter),
    'event priority is fixed as ko > hit > fire > spawn');
  check(/delta\s*===\s*2|serverTick\s*===\s*[^;\n]*\+\s*2/.test(presenter),
    'live semantic events require the known authority broadcast delta of exactly two ticks');
  check(!/\b(?:sendTankInput|sendMove|sendBotTankInput|onInput|emitInput|Raycaster)\b/.test(presenter),
    'Presenter contains no renderer-originated input or protocol send seam');
  // `replay` is intentionally a read-only reject guard in this module.  The
  // forbidden surface is the authority/economy/transport implementation, not
  // the vocabulary needed to keep replay strictly DOM-only.
  check(!/\b(?:reward|coins|owned|analytics|aiChoose|WebSocket|GLTFLoader|TextureLoader|asset_manifest)\b/i.test(presenter),
    'Presenter excludes authority-adjacent economy, AI, transport, and art concerns while retaining replay rejection');
  check(/generation/.test(presenter) && /adapterEpoch|adapterEpoch/.test(presenter) &&
    /context.?loss|contextLost/i.test(presenter) && /rendererBlocked|failure/i.test(presenter),
    'generation, adapter epoch, context loss, and sticky failure are local Presenter concerns');
  check(/loader\.load\('tank'/.test(presenter) &&
    /variant:variant/.test(presenter) && /sha256-5858d98dd19650f7-retry1/.test(presenter),
    'renderer loading is delegated to GameModuleLoader with the bounded Tank retry1 variant');
}

if (tank) {
  const authority = segment(tank, 'function onAuthoritySnapshot', 'function onAuthorityResult');
  const serialize = segment(tank, 'function snapshot(){', 'function finiteNumber(');
  const serialized = segment(tank, 'serialize:', 'fixedUpdate,');
  const smoothAt = authority.search(/server\.x\s*=\s*previous\.x\s*\+/);
  const receiptAt = authority.search(/(?:raw|authority)[A-Za-z0-9_]*Receipt|[A-Za-z0-9_]*Receipt[A-Za-z0-9_]*/i);
  check(authority.length > 0 && receiptAt >= 0 && smoothAt >= 0 && receiptAt < smoothAt,
    'accepted raw authority receipt is captured before DOM prediction smoothing');
  check(!/tank-host-relay-v1[\s\S]{0,180}Ghost3D/i.test(authority),
    'legacy host relay cannot be relabelled as a Tank Ghost3D authority source');
  check(!/authorityReceipt|tankGhost3D/i.test(serialize + serialized),
    'raw authority receipt never enters snapshot or serialize-compatible state');
  check(/render\(\);[\s\S]{0,420}tankGhost3D[A-Za-z0-9_]*\.commit\(\)/.test(tank) ||
    /commitTankGhost3D[A-Za-z0-9_]*\(\)/.test(tank),
    'Tank caller commits the Presenter only from its render-safe presentation tail');
  check(/opts\.isReplaying|isReplaying/.test(tank) && /tank-authority-v1/.test(tank),
    'caller keeps replay and non-authority mode distinguishable for DOM-only fallback');
}

/*
 * VM coverage intentionally executes the production Presenter rather than a
 * look-alike. Module resolution is supplied by a private GameModuleLoader
 * object; production gains no mutable import hook or URL seam.
 */
function createNode(tag, ownerDocument) {
  const listeners = new Map();
  return {
    tagName:String(tag || 'div').toUpperCase(),
    ownerDocument,
    parentNode:null,
    children:[],
    dataset:{},
    attributes:{},
    className:'',
    style:{ cssText:'' },
    clientWidth:600,
    clientHeight:520,
    appendChild(child) {
      if (child && child.parentNode && typeof child.parentNode.removeChild === 'function') child.parentNode.removeChild(child);
      if (child) { child.parentNode = this; this.children.push(child); }
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      if (child) child.parentNode = null;
      return child;
    },
    remove() { if (this.parentNode && typeof this.parentNode.removeChild === 'function') this.parentNode.removeChild(this); },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (String(name).startsWith('data-')) {
        const key = String(name).slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
        this.dataset[key] = String(value);
      }
    },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
    addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(handler); },
    removeEventListener(name, handler) { const list = listeners.get(name); if (list) list.delete(handler); },
    dispatch(name, event) { (listeners.get(name) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount(name) { return name ? (listeners.get(name) || new Set()).size : Array.from(listeners.values()).reduce((total, list) => total + list.size, 0); }
  };
}

function findNode(root, className) {
  if (!root) return null;
  if (String(root.className || '').split(/\s+/).includes(className)) return root;
  for (const child of root.children || []) {
    const found = findNode(child, className);
    if (found) return found;
  }
  return null;
}

function makeFoundation(log) {
  return {
    create(options) {
      const state = { disposed:false, frame:null, revision:null, adapter:null, usingFallback:true, suspended:false };
      const row = { options, state, calls:[], disposed:0 };
      const snapshot = () => Object.freeze({
        frame:state.frame,
        revision:state.revision,
        usingFallback:state.usingFallback,
        adapterReady:!!state.adapter,
        suspended:state.suspended
      });
      row.triggerFailure = () => {
        if (state.disposed) return false;
        if (typeof options.onFailure === 'function') options.onFailure({ phase:'render' }, snapshot());
        if (state.adapter && typeof state.adapter.dispose === 'function') state.adapter.dispose();
        state.adapter = null;
        state.usingFallback = true;
        return true;
      };
      log.hosts.push(row);
      return {
        apply(message) {
          row.calls.push(message);
          if (state.disposed || !message || typeof message !== 'object') return Object.freeze({ accepted:false, snapshot:snapshot() });
          if (message.type === 'frame') {
            const frame = message.frame;
            if (!frame || !Number.isSafeInteger(frame.revision) || (state.revision !== null && frame.revision <= state.revision)) {
              return Object.freeze({ accepted:false, snapshot:snapshot() });
            }
            state.frame = frame;
            state.revision = frame.revision;
            if (state.adapter && typeof state.adapter.render === 'function') state.adapter.render(frame);
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          if (message.type === 'recover') {
            const adapter = message.adapter;
            if (!adapter || typeof adapter.mount !== 'function' || typeof adapter.render !== 'function') return Object.freeze({ accepted:false, snapshot:snapshot() });
            state.adapter = adapter;
            state.usingFallback = false;
            if (adapter.mount() === false) { state.adapter = null; state.usingFallback = true; return Object.freeze({ accepted:false, snapshot:snapshot() }); }
            if (state.frame) adapter.render(state.frame);
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          if (message.type === 'context-lost') {
            if (state.adapter && typeof state.adapter.dispose === 'function') state.adapter.dispose();
            state.adapter = null;
            state.usingFallback = true;
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          if (message.type === 'motion') {
            const forwarded = !!(state.adapter && typeof state.adapter.motion === 'function' && state.adapter.motion(message.event) !== false);
            return Object.freeze({ accepted:true, forwarded, snapshot:snapshot() });
          }
          if (message.type === 'lifecycle') {
            state.suspended = message.action === 'hidden' || message.action === 'suspend';
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          return Object.freeze({ accepted:true, snapshot:snapshot() });
        },
        snapshot,
        dispose() {
          if (!state.disposed && state.adapter && typeof state.adapter.dispose === 'function') state.adapter.dispose();
          state.disposed = true;
          row.disposed += 1;
          return snapshot();
        }
      };
    }
  };
}

function createPresenterRuntime(settings) {
  const options = settings || {};
  const documentListeners = new Map();
  const windowListeners = new Map();
  const mediaListeners = new Set();
  const document = {
    hidden:false,
    visibilityState:'visible',
    createElement(tag) { return createNode(tag, document); },
    addEventListener(name, handler) { if (!documentListeners.has(name)) documentListeners.set(name, new Set()); documentListeners.get(name).add(handler); },
    removeEventListener(name, handler) { const list = documentListeners.get(name); if (list) list.delete(handler); },
    dispatch(name, event) { (documentListeners.get(name) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return Array.from(documentListeners.values()).reduce((total, list) => total + list.size, 0); }
  };
  const media = {
    matches:false,
    addEventListener(name, handler) { if (name === 'change') mediaListeners.add(handler); },
    removeEventListener(name, handler) { if (name === 'change') mediaListeners.delete(handler); },
    emit(matches) { this.matches = matches === true; mediaListeners.forEach(handler => handler({ matches:this.matches })); }
  };
  const values = {
    mg_art_game_stage_wave_b_v1:options.waveB === undefined ? null : options.waveB,
    mg_ghost3d_tank_v1:options.enabled === undefined ? '1' : options.enabled,
    mg_ghost3d_tank_quality_v1:options.quality || 'HIGH'
  };
  const log = { hosts:[], adapters:[], imports:0, importUrls:[] };
  let importAttempts = 0;
  let resolveImport = null;
  const renderer = {
    isTank3DSupported() { return options.supported !== false; },
    createTank3DAdapter(adapterOptions) {
      const entry = { options:adapterOptions, mounts:0, frames:[], motions:[], disposals:0, adapter:null };
      let announced = false;
      const adapter = {
        mount() {
          entry.mounts += 1;
          if (options.failMount) { adapterOptions.onError(new Error('mount_failure')); return false; }
          return true;
        },
        render(frame) {
          entry.frames.push(frame);
          if (!announced && options.neverReady !== true) { announced = true; adapterOptions.onReady(); }
          return true;
        },
        motion(event) { entry.motions.push(event); return true; },
        setQuality() { return true; },
        environment() { return true; },
        suspend() { return true; },
        resume() { return true; },
        contextLost() { return true; },
        dispose() { entry.disposals += 1; return true; }
      };
      entry.adapter = adapter;
      log.adapters.push(entry);
      if (options.constructorError) adapterOptions.onError(new Error('constructor_failure'));
      return adapter;
    }
  };
  function loadGameModule(_gameId, loadOptions) {
    const variant = loadOptions && loadOptions.variant === 'retry1' ? 'retry1' : 'primary';
    const url = variant === 'retry1'
      ? './three/tank-entry.js?v=sha256-5858d98dd19650f7-retry1'
      : './three/tank-entry.js?v=sha256-5858d98dd19650f7';
    log.imports += 1;
    log.importUrls.push(url);
    importAttempts += 1;
    if (options.importReject) return Promise.resolve({ ok:false, status:'fallback', reason:'import_failed', fallback:'inline' });
    if (options.importRejectOnce && importAttempts === 1) return Promise.resolve({ ok:false, status:'fallback', reason:'import_failed', fallback:'inline' });
    if (options.deferImport) return new Promise(resolve => { resolveImport = () => resolve({ ok:true, module:renderer }); });
    return Promise.resolve({ ok:true, module:renderer });
  }
  const sandbox = {
    console, Promise, Object, Array, Set, Map, Number, String, Boolean, JSON, Math, Date, Error,
    document,
    localStorage:{ getItem(key) { if (options.storageThrows) throw new Error('storage_blocked'); return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; } },
    Ghost3DFoundation:makeFoundation(log),
    matchMedia() { return media; },
    addEventListener(name, handler) { if (!windowListeners.has(name)) windowListeners.set(name, new Set()); windowListeners.get(name).add(handler); },
    removeEventListener(name, handler) { const list = windowListeners.get(name); if (list) list.delete(handler); },
    dispatchWindow(name, event) { (windowListeners.get(name) || new Set()).forEach(handler => handler(event || {})); },
    GameModuleLoader: { load: loadGameModule },
    module:{ exports:{} },
    exports:{}
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(presenter, sandbox, { filename:PRESENTER_FILE });
  return {
    api:sandbox.module.exports,
    document,
    mount:createNode('div', document),
    log,
    media,
    resolveImport() { if (resolveImport) resolveImport(); },
    listenerCount() { return Array.from(windowListeners.values()).reduce((total, list) => total + list.size, 0) + document.listenerCount(); }
  };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function terrain(width) { return Array.from({ length:13 }, () => Array(width || 15).fill(0)); }
function tankState(id, patch) {
  return Object.assign({ id, x:id === 0 ? 1.5 : 13.5, y:id === 0 ? 1.5 : 11.5, d:1, hp:3, alive:true, invulnerableUntil:0, shots:0, hits:0, kills:0, deaths:0, damage:0 }, patch || {});
}
function localState(patch) {
  return Object.assign({ width:15, height:13, season:'spring', cells:terrain(15), tanks:[tankState(0), tankState(1)], projectiles:[], terminal:false, winner:-1 }, patch || {});
}
function localModel(mount, epoch, patch) {
  const options = patch || {};
  return {
    mountElement:mount,
    waveBActive:options.waveBActive === undefined ? true : options.waveBActive,
    online:false,
    committed:options.committed === undefined ? true : options.committed,
    replay:options.replay === true,
    isReplaying:options.isReplaying === true,
    localState:options.state || localState(),
    playerCount:2,
    localEpoch:epoch,
    sourceEpoch:options.sourceEpoch === undefined ? epoch : options.sourceEpoch,
    resetEpoch:options.resetEpoch || 0,
    quality:options.quality || 'HIGH',
    reducedMotion:options.reducedMotion === true,
    hidden:options.hidden === true,
    shellActive:options.shellActive !== false
  };
}
function onlineModel(mount, tick, patch) {
  const options = patch || {};
  const state = options.state || localState();
  return {
    mountElement:mount,
    waveBActive:options.waveBActive === undefined ? true : options.waveBActive,
    online:true,
    authorityMode:options.authorityMode === undefined ? true : options.authorityMode,
    accepted:options.accepted === undefined ? true : options.accepted,
    replay:options.replay === true,
    isReplaying:options.isReplaying === true,
    source:options.source || 'live',
    expectedMatchId:'match-tank-1',
    receiptEpoch:options.receiptEpoch === undefined ? tick : options.receiptEpoch,
    playerCount:2,
    resetEpoch:options.resetEpoch || 0,
    sourceEpoch:options.sourceEpoch === undefined ? tick : options.sourceEpoch,
    quality:options.quality || 'HIGH',
    reducedMotion:options.reducedMotion === true,
    hidden:options.hidden === true,
    shellActive:options.shellActive !== false,
    receipt:{
      protocol:options.protocol === undefined ? 'tank-authority-v1' : options.protocol,
      matchId:options.matchId || 'match-tank-1',
      serverTick:tick,
      serverNow:0,
      width:state.width,
      height:state.height,
      season:state.season,
      destructibles:state.cells,
      players:state.tanks,
      projectiles:state.projectiles,
      status:state.terminal ? 'finished' : 'running',
      finished:state.terminal === true,
      order:state.terminal ? [0, 1] : undefined
    }
  };
}
function deeplyFrozen(value, seen) {
  if (!value || typeof value !== 'object') return true;
  const visited = seen || new Set();
  if (visited.has(value) || !Object.isFrozen(value)) return false;
  visited.add(value);
  const output = Object.keys(value).every(key => deeplyFrozen(value[key], visited));
  visited.delete(value);
  return output;
}
function frames(host) { return (host && host.calls || []).filter(call => call.type === 'frame'); }
function motions(host) { return (host && host.calls || []).filter(call => call.type === 'motion'); }
async function settle() { for (let turn = 0; turn < 8; turn += 1) await Promise.resolve(); }

function createTankNode(tag) {
  const classes = new Set();
  const listeners = new Map();
  const node = {
    tagName:String(tag || 'div').toUpperCase(), children:[], parentNode:null, dataset:{}, attributes:{}, textContent:'',
    style:{ setProperty(name, value) { this[name] = String(value); } }, clientWidth:560, clientHeight:560,
    appendChild(child) { if (child && child.parentNode && typeof child.parentNode.removeChild === 'function') child.parentNode.removeChild(child); if (child) { child.parentNode = this; this.children.push(child); } return child; },
    removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); if (child) child.parentNode = null; return child; },
    remove() { if (this.parentNode && typeof this.parentNode.removeChild === 'function') this.parentNode.removeChild(this); },
    setAttribute(name, value) { this.attributes[name] = String(value); if (String(name).startsWith('data-')) this.dataset[String(name).slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase())] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
    addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(handler); },
    removeEventListener(name, handler) { const list = listeners.get(name); if (list) list.delete(handler); },
    querySelector(selector) { return findTankNode(this, selector); },
    querySelectorAll() { return []; }
  };
  Object.defineProperty(node, 'innerHTML', { get() { return ''; }, set(_value) { node.children.forEach(child => { child.parentNode = null; }); node.children = []; } });
  Object.defineProperty(node, 'className', { get() { return Array.from(classes).join(' '); }, set(value) { classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); } });
  node.classList = { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, contains(name) { return classes.has(name); }, toggle(name, force) { const next = force === undefined ? !classes.has(name) : force === true; if (next) classes.add(name); else classes.delete(name); return next; } };
  return node;
}

function findTankNode(root, selector) {
  if (!root || typeof selector !== 'string' || !selector.startsWith('.')) return null;
  const className = selector.slice(1);
  const queue = (root.children || []).slice();
  while (queue.length) {
    const node = queue.shift();
    if (node && node.classList && node.classList.contains(className)) return node;
    if (node && Array.isArray(node.children)) queue.push(...node.children);
  }
  return null;
}

function createTankAuthorityBridgeRuntime() {
  const area = createTankNode('div');
  const extra = createTankNode('div');
  const body = createTankNode('body');
  const documentListeners = new Map();
  const windowListeners = new Map();
  const document = {
    body, hidden:false, visibilityState:'visible', createElement:createTankNode, getElementById() { return null; }, querySelectorAll() { return []; },
    addEventListener(name, handler) { if (!documentListeners.has(name)) documentListeners.set(name, new Set()); documentListeners.get(name).add(handler); },
    removeEventListener(name, handler) { const list = documentListeners.get(name); if (list) list.delete(handler); }
  };
  const storage = { getItem(key) { return key === 'mg_ghost3d_tank_v1' ? '1' : null; } };
  const window = {
    localStorage:storage, matchMedia() { return { matches:false }; },
    addEventListener(name, handler) { if (!windowListeners.has(name)) windowListeners.set(name, new Set()); windowListeners.get(name).add(handler); },
    removeEventListener(name, handler) { const list = windowListeners.get(name); if (list) list.delete(handler); }
  };
  const models = [];
  const audioCues = [];
  let disposals = 0;
  const TankGhost3DPresenter = {
    create(readModel) {
      let disposed = false;
      return {
        commit() { if (!disposed) models.push(readModel()); return Object.freeze({ accepted:true }); },
        snapshot() { return Object.freeze({}); },
        dispose() { if (!disposed) { disposed = true; disposals += 1; } return Object.freeze({}); }
      };
    }
  };
  const sandbox = {
    console, JSON, Date, Map, Set, Array, Number, String, Boolean, Object, Math, document, window, localStorage:storage,
    navigator:{ maxTouchPoints:0 }, location:{ protocol:'http:', host:'localhost' }, setTimeout, clearTimeout, setInterval, clearInterval,
    emitAudioCue(type, options) { audioCues.push({ type, options }); return { accepted:true }; },
    TankGhost3DPresenter, __area:area, __extra:extra
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const utilities = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '01-utils.js'), 'utf8');
  vm.runInContext(utilities, context, { filename:'01-utils.js' });
  vm.runInContext("function t(key){return String(key);} function renderPlayers(){} function setStatus(){} function tabletopArtEnabled(){return false;} function markTabletopSurface(){} function triggerHonruGameReaction(){} function shareGameLink(){} function prefersReducedMotion(){return false;}", context);
  vm.runInContext(tank, context, { filename:TANK_FILE });
  const matchId = 'tank-ghost3d-authority-receipt';
  context.__tankOpts = { ai:new Set(), online:true, myIdx:0, isHost:false, getMatchId() { return matchId; }, isReplaying() { return false; }, gameplayMeta:{ protocol:'tank-authority-v1', endAt:Date.now() + 180000 }, sendTankInput() {}, onEnd() {} };
  const game = vm.runInContext('gameTank(__area,__extra,2,__tankOpts)', context);
  return { game, models, audioCues, getDisposals:() => disposals, matchId };
}

function tankAuthorityReceipt(game, matchId, tick) {
  const state = game.snapshot();
  return {
    protocol:'tank-authority-v1', matchId, serverTick:tick, serverNow:Date.now(), endAt:Date.now() + 179000, remainingMs:179000, season:'spring',
    players:state.tanks.map(tank => Object.assign({}, tank)), projectiles:[], destructibles:state.grid.map(row => row.slice()), ack:[0, 0], finished:false, order:null
  };
}

function runTankAuthorityReceiptContract() {
  try {
    const zeroRuntime = createTankAuthorityBridgeRuntime();
    const zeroAccepted = zeroRuntime.game.onAuthoritySnapshot(tankAuthorityReceipt(zeroRuntime.game, zeroRuntime.matchId, 0));
    check(zeroAccepted === true && zeroRuntime.models.length === 1 && zeroRuntime.models[0].receipt.serverTick === 0,
      'the initial safe Authority tick zero is a valid first Tank Ghost3D receipt');
    zeroRuntime.game.destroy();

    const runtime = createTankAuthorityBridgeRuntime();
    const first = tankAuthorityReceipt(runtime.game, runtime.matchId, 4);
    const firstAccepted = runtime.game.onAuthoritySnapshot(first);
    const firstModel = runtime.models.at(-1);
    const duplicateAccepted = runtime.game.onAuthoritySnapshot(JSON.parse(JSON.stringify(first)));
    const duplicateModel = runtime.models.at(-1);
    check(firstAccepted === true && duplicateAccepted === true && firstModel && duplicateModel &&
      firstModel.receipt === duplicateModel.receipt && firstModel.receiptEpoch === duplicateModel.receiptEpoch,
      'same Authority tick keeps legacy DOM reconciliation but cannot replace or advance the Tank Ghost3D receipt');

    const acceptedDelta = tankAuthorityReceipt(runtime.game, runtime.matchId, 6);
    acceptedDelta.players[0].shots = 1;
    acceptedDelta.players[0].x += .2;
    const acceptedDeltaResult = runtime.game.onAuthoritySnapshot(acceptedDelta);
    const cuesAfterAcceptedDelta = runtime.audioCues.length;
    check(acceptedDeltaResult === true && cuesAfterAcceptedDelta > 0,
      'an accepted Authority delta may emit its semantic audio cue');

    const conflicting = tankAuthorityReceipt(runtime.game, runtime.matchId, 6);
    conflicting.players[0].x = 3.5;
    const modelsBeforeConflict = runtime.models.length;
    const conflictAccepted = runtime.game.onAuthoritySnapshot(conflicting);
    const cuesAfterConflict = runtime.audioCues.length;
    const modelsAfterConflict = runtime.models.length;
    check(conflictAccepted === true && modelsAfterConflict === modelsBeforeConflict && runtime.getDisposals() >= 1 &&
      cuesAfterConflict === cuesAfterAcceptedDelta,
      'a distinct duplicate Authority tick fails closed for 3D and cannot emit a stale audio delta');
    const recovery = JSON.parse(JSON.stringify(acceptedDelta));
    recovery.serverTick = 8;
    const recoveryAccepted = runtime.game.onAuthoritySnapshot(recovery);
    check(recoveryAccepted === true && runtime.audioCues.length === cuesAfterAcceptedDelta,
      'the next accepted Authority tick keeps the prior accepted audio baseline after a stale conflict');
    runtime.game.destroy();

    const malformedRuntime = createTankAuthorityBridgeRuntime();
    malformedRuntime.game.onAuthoritySnapshot(tankAuthorityReceipt(malformedRuntime.game, malformedRuntime.matchId, 4));
    const malformed = tankAuthorityReceipt(malformedRuntime.game, malformedRuntime.matchId, NaN);
    malformed.players[0].x = 3.5;
    const modelsBeforeMalformedTick = malformedRuntime.models.length;
    const priorDomX = malformedRuntime.game.snapshot().tanks[0].x;
    const malformedAccepted = malformedRuntime.game.onAuthoritySnapshot(malformed);
    check(malformedAccepted === true && malformedRuntime.models.length === modelsBeforeMalformedTick && malformedRuntime.getDisposals() >= 1 &&
      malformedRuntime.game.snapshot().tanks[0].x !== priorDomX,
      'malformed Authority tick fail-closes only the optional renderer while preserving existing DOM Authority reconciliation');
    malformedRuntime.game.destroy();
  } catch (error) {
    check(false, 'Tank Authority receipt VM harness executes: ' + (error && error.stack || String(error)));
  }
}

async function runDynamicContract() {
  try {
    const defaultOn = createPresenterRuntime({ enabled:null });
    const defaultPresenter = defaultOn.api.create(() => localModel(defaultOn.mount, 0));
    const defaultCommit = defaultPresenter.commit();
    await settle();
    check(defaultCommit.accepted === false && defaultCommit.reason === 'feature_disabled' && defaultOn.log.imports === 0 && defaultOn.log.hosts.length === 0 && !findNode(defaultOn.mount, 'tank-ghost3d-slot'),
      'missing key keeps Tank on the production DOM arena with no renderer work');
    defaultPresenter.dispose();

    const rollback = createPresenterRuntime({ enabled:'0' });
    const rollbackPresenter = rollback.api.create(() => localModel(rollback.mount, 0));
    const disabled = rollbackPresenter.commit();
    check(disabled.accepted === false && disabled.reason === 'feature_disabled' && rollback.log.imports === 0 && rollback.log.hosts.length === 0,
      'exact zero rollback keeps Tank DOM-only without creating a host or import');
    rollbackPresenter.dispose();

    const local = createPresenterRuntime({ enabled:'1' });
    let localFact = localModel(local.mount, 0);
    const localPresenter = local.api.create(() => localFact);
    const initial = localPresenter.commit();
    await settle();
    const localHost = local.log.hosts[0];
    const localInitial = frames(localHost)[0] && frames(localHost)[0].frame;
    check(initial.accepted === true && localPresenter.snapshot().ready === true && localInitial && deeplyFrozen(localInitial) &&
      localInitial.origin.source === 'local' && localInitial.origin.continuity === 'snap' && motions(localHost).length === 0,
      'first committed local projection is immutable and static until a real renderer draw');
    check(local.log.adapters.length === 1 && local.log.adapters[0].frames.length === 1 && local.mount.children.length === 1 &&
      findNode(local.mount, 'tank-ghost3d-slot').dataset.ghost3dReady === 'true',
      'first renderer recovery paints the frozen frame once and only then marks its inert slot ready');
    const duplicate = localPresenter.commit();
    check(duplicate.accepted === false && duplicate.reason === 'duplicate_frame' && frames(localHost).length === 1,
      'identical local epoch is deduplicated before a second renderer frame');
    const firing = clone(localFact.localState);
    firing.tanks[0].shots = 1;
    firing.projectiles = [{ id:1, owner:0, x:2.1, y:1.5, d:1 }];
    localFact = localModel(local.mount, 1, { state:firing });
    const localMotion = localPresenter.commit();
    await settle();
    const localFrame = frames(localHost).at(-1).frame;
    check(localMotion.accepted === true && localFrame.origin.continuity === 'interpolate' && motions(localHost).length === 1 &&
      motions(localHost)[0].event.type === 'tank_fire' && local.log.adapters[0].motions.length === 1,
      'one adjacent committed local fire becomes one bounded semantic event, not a DOM prediction event');
    const gapped = clone(firing);
    gapped.tanks[0].x = 3.5;
    localFact = localModel(local.mount, 3, { state:gapped });
    const localGap = localPresenter.commit();
    await settle();
    check(localGap.accepted === true && frames(localHost).at(-1).frame.origin.continuity === 'snap' && motions(localHost).length === 1,
      'local epoch gaps reconcile statically and never replay a missed shot');
    localFact = localModel(local.mount, 4, { state:firing, resetEpoch:1 });
    const localRestore = localPresenter.commit();
    await settle();
    const restoredHost = local.log.hosts.at(-1);
    check(localRestore.accepted === true && restoredHost !== localHost && frames(restoredHost)[0].frame.origin.continuity === 'snap' && motions(restoredHost).length === 0,
      'reset/root restoration creates a fresh static generation rather than transferring prior motion');
    const terminalState = clone(firing);
    terminalState.terminal = true;
    terminalState.winner = 0;
    localFact = localModel(local.mount, 5, { state:terminalState, resetEpoch:1 });
    const terminalCommit = localPresenter.commit();
    await settle();
    const terminalFrameCall = frames(restoredHost).at(-1);
    const terminalMotionCall = motions(restoredHost).at(-1);
    const terminalFrameIndex = restoredHost.calls.lastIndexOf(terminalFrameCall);
    const terminalMotionIndex = restoredHost.calls.lastIndexOf(terminalMotionCall);
    check(terminalCommit.accepted === true && terminalFrameCall && terminalFrameCall.frame.terminal === true &&
      terminalMotionCall && terminalMotionCall.event.type === 'terminal' && terminalMotionCall.event.revision === terminalFrameCall.frame.revision &&
      terminalMotionCall.event.winner === 0 && terminalFrameIndex >= 0 && terminalMotionIndex === terminalFrameIndex + 1 &&
      localPresenter.snapshot().terminal === true,
      'accepted terminal frame is followed once by its presentation-only result camera event');
    const terminalMotionCount = motions(restoredHost).length;
    const duplicateTerminal = localPresenter.commit();
    await settle();
    check(duplicateTerminal.accepted === false && duplicateTerminal.reason === 'duplicate_frame' && motions(restoredHost).length === terminalMotionCount,
      'duplicate terminal commit cannot replay the result camera event');
    localPresenter.dispose();

    const replay = createPresenterRuntime({ enabled:'1' });
    const replayPresenter = replay.api.create(() => localModel(replay.mount, 0, { isReplaying:true }));
    const replayResult = replayPresenter.commit();
    check(replayResult.accepted === false && replayResult.reason === 'history_dom_only' && replay.log.hosts.length === 0 && replay.log.imports === 0,
      'the caller-facing isReplaying signal is DOM-only and cannot create a 3D generation');
    replayPresenter.dispose();

    const online = createPresenterRuntime({ enabled:'1' });
    let authorityFact = onlineModel(online.mount, 10);
    const authorityPresenter = online.api.create(() => authorityFact);
    const onlineBaseline = authorityPresenter.commit();
    await settle();
    const onlineHost = online.log.hosts[0];
    check(onlineBaseline.accepted === true && frames(onlineHost)[0].frame.origin.source === 'live' && frames(onlineHost)[0].frame.origin.serverTick === 10 &&
      frames(onlineHost)[0].frame.origin.continuity === 'snap' && motions(onlineHost).length === 0,
      'only an accepted raw tank-authority-v1 receipt creates the first live 3D fact');
    const onlineFire = clone(authorityFact.receipt);
    onlineFire.players[0].shots = 1;
    onlineFire.projectiles = [{ id:7, owner:0, x:2.2, y:1.5, d:1 }];
    authorityFact = onlineModel(online.mount, 12, { state:{ width:onlineFire.width, height:onlineFire.height, season:onlineFire.season, cells:onlineFire.destructibles, tanks:onlineFire.players, projectiles:onlineFire.projectiles, terminal:false, winner:-1 } });
    const onlineMotion = authorityPresenter.commit();
    await settle();
    check(onlineMotion.accepted === true && frames(onlineHost).at(-1).frame.origin.continuity === 'interpolate' &&
      motions(onlineHost).length === 1 && motions(onlineHost)[0].event.type === 'tank_fire',
      'the known +2 authority broadcast cadence permits exactly one fact-backed motion');
    const duplicateOnline = authorityPresenter.commit();
    check(duplicateOnline.accepted === false && duplicateOnline.reason === 'duplicate_frame' && frames(onlineHost).length === 2,
      'same authoritative tick and projection deduplicate before motion or renderer work');
    // A heartbeat can advance a receipt tick without changing the visible
    // projection. It must not turn into an interpolation frame or an extra
    // renderer repaint merely because the transport tick advanced.
    const heartbeatState = clone(authorityFact.receipt);
    authorityFact = onlineModel(online.mount, 14, { state:{ width:heartbeatState.width, height:heartbeatState.height, season:heartbeatState.season, cells:heartbeatState.destructibles, tanks:heartbeatState.players, projectiles:heartbeatState.projectiles, terminal:false, winner:-1 } });
    const heartbeat = authorityPresenter.commit();
    check(heartbeat.accepted === false && heartbeat.reason === 'duplicate_frame' && frames(onlineHost).length === 2 && motions(onlineHost).length === 1,
      'same public authority fingerprint on a newer heartbeat tick is deduplicated rather than interpolated');
    const conflictState = clone(authorityFact.receipt);
    conflictState.players[0].x = 3.5;
    authorityFact = onlineModel(online.mount, 12, { state:{ width:conflictState.width, height:conflictState.height, season:conflictState.season, cells:conflictState.destructibles, tanks:conflictState.players, projectiles:conflictState.projectiles, terminal:false, winner:-1 } });
    const conflict = authorityPresenter.commit();
    check(conflict.accepted === false && conflict.reason === 'authority_tick_conflict' && authorityPresenter.snapshot().fallback === true && authorityPresenter.snapshot().ready === false,
      'same server tick with a distinct receipt fails closed rather than choosing a visual truth');
    authorityPresenter.dispose();

    const gap = createPresenterRuntime({ enabled:'1' });
    let gapFact = onlineModel(gap.mount, 20);
    const gapPresenter = gap.api.create(() => gapFact);
    gapPresenter.commit();
    await settle();
    const gapHost = gap.log.hosts[0];
    const gapState = clone(gapFact.receipt);
    gapState.players[0].shots = 1;
    gapState.projectiles = [{ id:9, owner:0, x:2.2, y:1.5, d:1 }];
    gapFact = onlineModel(gap.mount, 24, { state:{ width:gapState.width, height:gapState.height, season:gapState.season, cells:gapState.destructibles, tanks:gapState.players, projectiles:gapState.projectiles, terminal:false, winner:-1 } });
    gapPresenter.commit();
    await settle();
    check(frames(gapHost).at(-1).frame.origin.continuity === 'snap' && motions(gapHost).length === 0,
      'authority tick gaps remain a static reconciliation even when the receipt contains a fire delta');
    gapFact = onlineModel(gap.mount, 26, { source:'reconcile', state:{ width:gapState.width, height:gapState.height, season:gapState.season, cells:gapState.destructibles, tanks:gapState.players, projectiles:gapState.projectiles, terminal:false, winner:-1 }, sourceEpoch:99 });
    const reconcile = gapPresenter.commit();
    await settle();
    const reconcileHost = gap.log.hosts.at(-1);
    check(reconcile.accepted === true && frames(reconcileHost)[0].frame.origin.source === 'reconcile' && frames(reconcileHost)[0].frame.origin.continuity === 'snap' && motions(reconcileHost).length === 0,
      'reconcile/restore receipt starts a fresh static host and cannot replay live history');
    gapPresenter.dispose();

    const failure = createPresenterRuntime({ enabled:'1' });
    let failureFact = localModel(failure.mount, 0);
    const failurePresenter = failure.api.create(() => failureFact);
    failurePresenter.commit();
    await settle();
    const failedAdapter = failure.log.adapters[0];
    const failureGeneration = failurePresenter.snapshot().generation;
    failedAdapter.options.onError(new Error('forced-render-failure'));
    await settle();
    check(failurePresenter.snapshot().fallback === true && failurePresenter.snapshot().ready === false && failurePresenter.snapshot().generation === failureGeneration,
      'renderer error is sticky within its current generation and immediately restores DOM fallback');
    failureFact = localModel(failure.mount, 1);
    failurePresenter.commit();
    await settle();
    const stickyGeneration = failurePresenter.snapshot().generation;
    check(stickyGeneration === failureGeneration && failure.log.hosts.length === 1 && failure.log.adapters.length === 1 &&
      failurePresenter.snapshot().ready === false && failurePresenter.snapshot().fallback === true,
      'a hard renderer failure remains DOM-only across ordinary state ticks and does not self-retry in place');
    failureFact = localModel(failure.mount, 2, { resetEpoch:1 });
    failurePresenter.commit();
    await settle();
    const recoveredGeneration = failurePresenter.snapshot().generation;
    failedAdapter.options.onReady();
    failedAdapter.options.onContextLost('late-old-adapter');
    await settle();
    check(recoveredGeneration > failureGeneration && failure.log.hosts.length === 2 && failure.log.adapters.length === 2 &&
      failurePresenter.snapshot().ready === true && failurePresenter.snapshot().fallback === false,
      'a renderer retry occurs only through a fresh generation; stale failed-adapter callbacks cannot retake readiness');
    failurePresenter.dispose();

    const importFailure = createPresenterRuntime({ enabled:'1', importReject:true });
    let importFailureFact = localModel(importFailure.mount, 0);
    const importFailurePresenter = importFailure.api.create(() => importFailureFact);
    importFailurePresenter.commit();
    await settle();
    const importFailureGeneration = importFailurePresenter.snapshot().generation;
    const importFailureHosts = importFailure.log.hosts.length;
    const importFailureNext = localState();
    importFailureNext.tanks[0].x = 2.5;
    importFailureFact = localModel(importFailure.mount, 1, { state:importFailureNext });
    const importTick = importFailurePresenter.commit();
    await settle();
    check(importTick.accepted === true && importFailurePresenter.snapshot().generation === importFailureGeneration &&
      importFailure.log.hosts.length === importFailureHosts && importFailure.log.imports === 1 &&
      importFailurePresenter.snapshot().ready === false && importFailurePresenter.snapshot().fallback === true,
      'a lazy-import hard failure remains DOM-only for later ticks of the same generation and cannot self-retry');
    importFailurePresenter.dispose();

    const importRetry = createPresenterRuntime({ enabled:'1', importRejectOnce:true });
    let importRetryFact = localModel(importRetry.mount, 0);
    const importRetryPresenter = importRetry.api.create(() => importRetryFact);
    importRetryPresenter.commit();
    await settle();
    importRetryFact = localModel(importRetry.mount, 1, { resetEpoch:1 });
    const freshImportGeneration = importRetryPresenter.commit();
    await settle();
    check(freshImportGeneration.accepted === true && importRetry.log.imports === 2 && new Set(importRetry.log.importUrls).size === 2 &&
      importRetryPresenter.snapshot().ready === true && importRetryPresenter.snapshot().fallback === false,
      'a fresh Presenter generation retries one failed ESM key through a bounded distinct versioned URL');
    importRetryPresenter.dispose();

    const context = createPresenterRuntime({ enabled:'1' });
    const contextFact = localModel(context.mount, 0);
    const contextPresenter = context.api.create(() => contextFact);
    contextPresenter.commit();
    await settle();
    const oldContextHost = context.log.hosts[0];
    const oldContextAdapter = context.log.adapters[0];
    const beforeContextGeneration = contextPresenter.snapshot().generation;
    oldContextAdapter.options.onContextLost('webglcontextlost');
    await settle();
    const newContextHost = context.log.hosts.at(-1);
    oldContextAdapter.options.onReady();
    oldContextAdapter.options.onError(new Error('late'));
    await settle();
    check(newContextHost !== oldContextHost && oldContextHost.disposed === 1 && contextPresenter.snapshot().generation > beforeContextGeneration &&
      frames(newContextHost).length === 1 && frames(newContextHost)[0].frame.origin.continuity === 'snap' && motions(newContextHost).length === 0 &&
      contextPresenter.snapshot().ready === true,
      'context loss recovers only via a fresh static generation and rejects stale adapter callbacks');
    contextPresenter.dispose();

    const delayed = createPresenterRuntime({ enabled:'1', deferImport:true });
    const delayedPresenter = delayed.api.create(() => localModel(delayed.mount, 0));
    delayedPresenter.commit();
    const delayedHost = delayed.log.hosts[0];
    delayedPresenter.dispose();
    delayed.resolveImport();
    await settle();
    check(delayed.log.adapters.length === 0 && delayedHost.disposed === 1 && delayed.mount.children.length === 0 && delayed.listenerCount() === 0,
      'disposing before lazy import resolves prevents stale renderer recovery and removes inert paint state');
  } catch (error) {
    check(false, 'Tank Presenter dynamic VM harness executes: ' + (error && error.stack || String(error)));
  }
}

runTankAuthorityReceiptContract();
runDynamicContract().then(() => {
  if (failures) {
    console.error('TANK_GHOST3D_CONTRACT_FAILURES=' + failures + ' assertions=' + assertions);
    process.exitCode = 1;
  } else {
    console.log('TANK_GHOST3D_CONTRACT_ALL_PASS assertions=' + assertions);
  }
}, error => {
  check(false, 'Tank Presenter dynamic VM harness rejected: ' + (error && error.stack || String(error)));
  console.error('TANK_GHOST3D_CONTRACT_FAILURES=' + failures + ' assertions=' + assertions);
  process.exitCode = 1;
});
