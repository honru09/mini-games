'use strict';

/* Focused contract for the presenter seam.  It runs the real browser-facing
 * source in a VM with a DOM/Renderer stand-in; it does not replace the
 * Presenter with a test implementation. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tetris-ghost3d-presenter.js'), 'utf8');
const GAME_SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tetris.js'), 'utf8');
// The presenter delegates module resolution to the production GameModuleLoader;
// the VM supplies a private loader object instead of rewriting production code.
const TEST_SOURCE = SOURCE;
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures += 1;
}

function makeNode(tag, ownerDocument) {
  const listeners = new Map();
  const node = {
    tagName:String(tag || 'div').toUpperCase(), ownerDocument, parentNode:null, children:[], dataset:{}, attributes:{},
    style:{ cssText:'', setProperty(key, value) { this[key] = String(value); }, removeProperty(key) { delete this[key]; } },
    appendChild(child) {
      if (!child) return child;
      if (child.parentNode && child.parentNode.removeChild) child.parentNode.removeChild(child);
      child.parentNode = this; this.children.push(child); return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      if (child) child.parentNode = null;
      return child;
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(key, value) {
      this.attributes[key] = String(value);
      if (String(key).startsWith('data-')) this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase())] = String(value);
    },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (listeners.has(type)) listeners.get(type).delete(handler); },
    dispatch(type, event) { (listeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
  };
  return node;
}

function find(root, className) {
  if (!root) return null;
  if (String(root.className || '').split(/\s+/).includes(className)) return root;
  for (const child of root.children || []) {
    const result = find(child, className);
    if (result) return result;
  }
  return null;
}

function well() { return Array.from({ length:18 }, () => Array(10).fill(0)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function lockedOWell() {
  const result = well();
  result[16][3] = result[16][4] = result[17][3] = result[17][4] = 1;
  return result;
}
function lockedIWell(base) {
  const result = clone(base);
  result[15][3] = result[15][4] = result[15][5] = result[15][6] = 1;
  return result;
}

function makeFoundation(log) {
  return {
    create(options) {
      const state = { disposed:false, frame:null, revision:null, adapter:null, usingFallback:true, suspended:false, suspendReasons:new Set() };
      const row = { options, state, calls:[], disposed:0 };
      const snapshot = () => Object.freeze({
        frame:state.frame, revision:state.revision, adapterReady:!!state.adapter, usingFallback:state.usingFallback,
        suspended:state.suspended,
      });
      row.triggerFailure = phase => {
        if (state.disposed) return false;
        if (typeof options.onFailure === 'function') options.onFailure({ phase:phase || 'render' }, snapshot());
        if (state.adapter && state.adapter.dispose) state.adapter.dispose();
        state.adapter = null; state.usingFallback = true;
        return true;
      };
      log.hosts.push(row);
      return {
        apply(message) {
          row.calls.push(message);
          if (state.disposed || !message || typeof message !== 'object') return Object.freeze({ accepted:false, snapshot:snapshot() });
          if (message.type === 'frame') {
            if (!message.frame || !Number.isSafeInteger(message.frame.revision) || (state.revision !== null && message.frame.revision <= state.revision)) return Object.freeze({ accepted:false, snapshot:snapshot() });
            state.frame = message.frame; state.revision = message.frame.revision;
            if (state.adapter && state.adapter.render) state.adapter.render(state.frame, {}, () => {});
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          if (message.type === 'recover') {
            const adapter = message.adapter;
            if (!adapter || typeof adapter.mount !== 'function' || typeof adapter.render !== 'function') return Object.freeze({ accepted:false, snapshot:snapshot() });
            state.adapter = adapter; state.usingFallback = false;
            adapter.mount({}, () => {});
            if (state.frame) adapter.render(state.frame, {}, () => {});
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          if (message.type === 'context-lost') {
            if (state.adapter && state.adapter.dispose) state.adapter.dispose();
            state.adapter = null; state.usingFallback = true;
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          if (message.type === 'lifecycle') {
            const reason = String(message.reason || 'manual');
            if (message.action === 'hidden') state.suspendReasons.add('hidden');
            else if (message.action === 'visible') state.suspendReasons.delete('hidden');
            else if (message.action === 'suspend') state.suspendReasons.add('manual:' + reason);
            else if (message.action === 'resume') state.suspendReasons.delete('manual:' + reason);
            state.suspended = state.suspendReasons.size > 0;
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          return Object.freeze({ accepted:true, snapshot:snapshot() });
        },
        snapshot,
        dispose() {
          if (!state.disposed && state.adapter && state.adapter.dispose) state.adapter.dispose();
          state.disposed = true; row.disposed += 1; return snapshot();
        },
      };
    },
  };
}

function runtime(settings) {
  settings = settings || {};
  const documentListeners = new Map();
  const windowListeners = new Map();
  const mediaListeners = new Set();
  const document = {
    hidden:false,
    createElement(tag) { return makeNode(tag, document); },
    addEventListener(type, handler) { if (!documentListeners.has(type)) documentListeners.set(type, new Set()); documentListeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (documentListeners.has(type)) documentListeners.get(type).delete(handler); },
    dispatch(type, event) { (documentListeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listeners() { return [...documentListeners.values()].reduce((total, set) => total + set.size, 0); },
  };
  const media = {
    matches:false,
    addEventListener(type, handler) { if (type === 'change') mediaListeners.add(handler); },
    removeEventListener(type, handler) { if (type === 'change') mediaListeners.delete(handler); },
    emit(matches) { this.matches = !!matches; mediaListeners.forEach(handler => handler({ matches:this.matches })); },
    listeners() { return mediaListeners.size; },
  };
  const values = {
    mg_art_game_stage_wave_b_v1:settings.waveB === undefined ? null : settings.waveB,
    mg_ghost3d_tetris_v1:settings.enabled === undefined ? null : settings.enabled,
  };
  const log = { hosts:[], adapters:[], imports:0 };
  let resolveImport = null;
  const renderer = {
    isTetris3DSupported() { return settings.supported !== false; },
    createTetris3DAdapter(options) {
      const entry = { options, mount:0, render:0, motion:0, adapter:null };
      let announced = false;
      const adapter = {
        mount() { entry.mount += 1; if (settings.failMount) options.onError(); return true; },
        render() { entry.render += 1; if (!announced) { announced = true; options.onReady(); } return true; },
        motion() { entry.motion += 1; return true; },
        setQuality() { return true; }, environment() { return true; }, suspend() { return true; }, resume() { return true; }, contextLost() { return true; },
        dispose() { adapter.disposed = (adapter.disposed || 0) + 1; return true; },
      };
      if (settings.syncConstructorError) options.onError(new Error('constructor-error'));
      if (settings.syncConstructorContextLost) options.onContextLost('constructor-context-loss');
      entry.adapter = adapter; log.adapters.push(entry); return adapter;
    },
  };
  function loadGameModule() {
    log.imports += 1;
    if (settings.deferImport) return new Promise(resolve => { resolveImport = resolve; });
    return Promise.resolve({ ok:true, module:renderer });
  }
  const sandbox = {
    console, Promise, Object, Array, Set, Map, Number, String, Boolean, JSON, Math, Error,
    document,
    localStorage:{ getItem(key) { if (settings.storageThrows) throw new Error('blocked'); return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; } },
    addEventListener(type, handler) { if (!windowListeners.has(type)) windowListeners.set(type, new Set()); windowListeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (windowListeners.has(type)) windowListeners.get(type).delete(handler); },
    dispatch(type, event) { (windowListeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    matchMedia() { return media; },
    Ghost3DFoundation:makeFoundation(log),
    GameModuleLoader: { load: loadGameModule },
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(TEST_SOURCE, context, { filename:'tetris-ghost3d-presenter.js' });
  const mount = document.createElement('div');
  return {
    context, document, media, values, log, renderer, mount,
    create(reader) { return context.TetrisGhost3DPresenter.create(reader); },
    resolveImport() { if (resolveImport) resolveImport({ ok:true, module:renderer }); },
    listeners() { return document.listeners() + [...windowListeners.values()].reduce((total, set) => total + set.size, 0) + media.listeners(); },
  };
}

function localModel(mount, overrides) {
  const extra = overrides || {};
  return {
    waveBActive:true, mountElement:mount, online:false, committed:true, source:'local',
    viewPlayer:0, playerCount:2, resetEpoch:0, sourceEpoch:0,
    state:{ well:well(), active:{ kind:0, rotation:0, x:3, y:0 }, alive:true, placementSeq:0 },
    terminal:false, winner:-1, quality:'HIGH', reducedMotion:false, shellActive:true,
    ...extra,
  };
}

function onlineModel(mount, revision, overrides) {
  const extra = overrides || {};
  return {
    waveBActive:true, mountElement:mount, online:true, committed:false, accepted:true, fullRuleAuthority:true,
    protocol:'tetris-rule-v3', source:'live', matchId:'tetris-contract-match', expectedMatchId:'tetris-contract-match',
    authorityRevision:revision, stateHash:'hash-' + revision, viewPlayer:0, playerCount:2, resetEpoch:0, sourceEpoch:0,
    state:{ well:well(), active:{ kind:0, rotation:0, x:3, y:0 }, alive:true, placementSeq:revision },
    terminal:false, winner:-1, quality:'HIGH', reducedMotion:false, shellActive:true,
    ...extra,
  };
}

function frames(host) { return (host && host.calls || []).filter(call => call.type === 'frame'); }
function motions(host) { return (host && host.calls || []).filter(call => call.type === 'motion'); }
async function settle(turns) { for (let index = 0; index < (turns || 10); index += 1) await Promise.resolve(); }

check('exports only the deep Presenter constructor and retains no renderer input seam',
  /TetrisGhost3DPresenter/.test(SOURCE) && /create\s*:\s*create/.test(SOURCE) && !/onInput\s*:|emitInput\s*:|type:\s*['"]input['"]/.test(SOURCE));
check('lazy renderer load is routed through the hash-versioned GameModuleLoader island',
  /GameModuleLoader/.test(SOURCE) && /loader\.load\('tetris'/.test(SOURCE) && !/ScrollTrigger|CSSPlugin|GLTFLoader|TextureLoader|asset_manifest|https?:\/\//.test(SOURCE));
check('production presenter exposes no mutable global renderer-import hook',
  !/__tetrisGhost3D(?:Test)?Import/.test(SOURCE));
check('frame projection names the single 18 by 10 well and excludes DOM/identity/economy state',
  /kind:'tetris-3d-frame-v1'/.test(SOURCE) && /var ROWS = 18/.test(SOURCE) && /var COLS = 10/.test(SOURCE) &&
  !/frame\.queue|frame\.score|frame\.coins|frame\.uid|frame\.canvas/.test(SOURCE));
check('semantic motion is guarded by generation-owned runtime lifecycle facts rather than stale caller flags',
  /if \(motion && !state\.documentHidden && state\.shellActive && rendererMayReceive\)/.test(SOURCE) &&
  /motion\.type === 'terminal' \? rendererCanReceiveMotion\(\) : canLockMotion\(\)/.test(SOURCE) &&
  !/if \(motion && !candidate\.hidden && candidate\.shellActive/.test(SOURCE));
check('terminal result presentation cannot delay rule completion or leak a timer across reset, restore, or destroy',
  /opts\.onEnd\)\{endReported=true;opts\.onEnd\([\s\S]{0,220}\);\}\s*render\(\)/.test(GAME_SOURCE) &&
  /updateStatus\(\);commitTetrisGhost3DPresenter\(\);if\(over&&!victoryShown\)queueTetrisOutcome\(\)/.test(GAME_SOURCE) &&
  /quality==='HIGH'\?520:420/.test(GAME_SOURCE) && /quality!=='LOW'/.test(GAME_SOURCE) &&
  /function removeVictoryOverlay\(\)\{clearTetrisOutcomeTimer\(\)/.test(GAME_SOURCE) &&
  /function onRestore\(value,source\)\{[\s\S]{0,500}clearTetrisOutcomeTimer\(\)/.test(GAME_SOURCE) &&
  /function destroy\(\)\{destroyed=true;clearTetrisOutcomeTimer\(\)/.test(GAME_SOURCE));

(async () => {
  try {
    const defaultOn = runtime({ enabled:null });
    let defaultModel = localModel(defaultOn.mount);
    const defaultPresenter = defaultOn.create(() => defaultModel);
    const defaultCommit = defaultPresenter.commit();
    await settle();
    check('missing key keeps Tetris on the production DOM well with no renderer work',
      defaultCommit.accepted === false && defaultCommit.reason === 'feature_disabled' && defaultOn.log.hosts.length === 0 && defaultOn.log.imports === 0 && !find(defaultOn.mount, 'tetris-ghost3d-slot'));
    defaultPresenter.dispose();
    const rollback = runtime({ enabled:'0' });
    const rollbackPresenter = rollback.create(() => localModel(rollback.mount));
    const rollbackCommit = rollbackPresenter.commit();
    await settle();
    check('exact zero rollback does not create slot, host, or optional import',
      rollbackCommit.accepted === false && rollbackCommit.reason === 'feature_disabled' && rollback.log.hosts.length === 0 && rollback.log.imports === 0 && !find(rollback.mount, 'tetris-ghost3d-slot'));
    rollbackPresenter.dispose();
    const blocked = runtime({ enabled:'yes', storageThrows:true });
    const blockedPresenter = blocked.create(() => localModel(blocked.mount));
    blockedPresenter.commit();
    await settle();
    check('unavailable storage remains an exact DOM fallback',
      blocked.log.hosts.length === 0 && blocked.log.imports === 0 && !find(blocked.mount, 'tetris-ghost3d-slot'));
    blockedPresenter.dispose();

    const local = runtime({ enabled:'1' });
    let model = localModel(local.mount, {
      state:{ well:well(), active:{ kind:1, rotation:0, x:3, y:16 }, alive:true, placementSeq:0 },
    });
    const presenter = local.create(() => model);
    const first = presenter.commit();
    await settle();
    const localHost = local.log.hosts[0];
    const slot = find(local.mount, 'tetris-ghost3d-slot');
    const initial = frames(localHost)[0] && frames(localHost)[0].frame;
    let forbidden = false;
    (function walk(value) {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value && typeof value === 'object') Object.keys(value).forEach(key => { if (['queue','score','lines','coins','uid','name','seat','avatar','reward','replay','token','canvas','adapter'].includes(key)) forbidden = true; walk(value[key]); });
    }(initial));
    check('explicit enable yields one frozen minimal current-well frame and inert slot',
      first.accepted === true && local.log.imports === 1 && local.log.hosts.length === 1 && !!slot &&
      slot.getAttribute('aria-hidden') === 'true' && slot.getAttribute('role') === 'presentation' && slot.getAttribute('tabindex') === '-1' &&
      slot.style.pointerEvents === 'none' && slot.style.zIndex === '3' && slot.dataset.ghost3dReady === 'true' && initial && Object.isFrozen(initial) && Object.isFrozen(initial.well) &&
      initial.well.length === 18 && initial.well.every(row => row.length === 10) && !forbidden,
      JSON.stringify({ imports:local.log.imports, hosts:local.log.hosts.length, frozen:initial && Object.isFrozen(initial) }));
    const factoryOptions = local.log.adapters[0] && local.log.adapters[0].options;
    check('adapter receives only lifecycle/render options and never a game input callback',
      factoryOptions && factoryOptions.mountElement === slot && typeof factoryOptions.onReady === 'function' && typeof factoryOptions.onError === 'function' &&
      typeof factoryOptions.onContextLost === 'function' && !Object.prototype.hasOwnProperty.call(factoryOptions, 'onInput') && !Object.prototype.hasOwnProperty.call(factoryOptions, 'command'));
    const lockedWell = lockedOWell();
    model = localModel(local.mount, {
      state:{ well:lockedWell, active:{ kind:0, rotation:0, x:3, y:0 }, alive:true, placementSeq:1 },
      trustedLock:{ type:'lock', kind:1, rotation:0, x:3, y:16, cleared:0, placementSeq:1 },
    });
    presenter.commit();
    await settle();
    const localMotion = motions(localHost).at(-1);
    check('one committed local lock produces the only revision-bound piece_locked motion after its frame',
      localMotion && localMotion.event.type === 'piece_locked' && localMotion.event.revision === localHost.state.revision &&
      localMotion.event.eventId === (presenter.snapshot().generation + ':' + localMotion.event.revision + ':0:1') && localMotion.event.player === 0 && localMotion.event.kind === 1 && localMotion.event.cleared === 0 &&
      motions(localHost).every(call => call.event.type === 'piece_locked'),
      JSON.stringify({ ready:presenter.snapshot().ready, fallback:presenter.snapshot().fallback, motions:motions(localHost).map(call => call.event), host:localHost.state }));
    model = localModel(local.mount, {
      state:{ well:lockedWell, active:null, alive:true, placementSeq:1 }, terminal:true, winner:0,
    });
    presenter.commit();
    await settle();
    const terminalFrameCall = frames(localHost).at(-1);
    const terminalMotionCall = motions(localHost).at(-1);
    const terminalFrameIndex = localHost.calls.lastIndexOf(terminalFrameCall);
    const terminalMotionIndex = localHost.calls.lastIndexOf(terminalMotionCall);
    check('accepted terminal frame is followed once by its presentation-only terminal motion',
      terminalFrameCall && terminalFrameCall.frame.terminal === true && terminalMotionCall && terminalMotionCall.event.type === 'terminal' &&
      terminalMotionCall.event.revision === terminalFrameCall.frame.revision && terminalMotionCall.event.winner === 0 && terminalMotionCall.event.outcome === 'win' &&
      terminalFrameIndex >= 0 && terminalMotionIndex === terminalFrameIndex + 1 && presenter.snapshot().motion === 'terminal');
    const terminalMotionCount = motions(localHost).length;
    presenter.commit();
    await settle();
    check('duplicate terminal commit cannot replay the result camera event', motions(localHost).length === terminalMotionCount);
    const replacement = local.document.createElement('div');
    model = localModel(replacement, { resetEpoch:1, state:{ well:lockedWell, active:null, alive:true, placementSeq:1 } });
    presenter.commit();
    await settle();
    const newHost = local.log.hosts.at(-1);
    check('DOM root rebuild creates a fresh host generation and reparents one optional slot',
      newHost !== localHost && localHost.disposed === 1 && slot.parentNode === replacement && find(replacement, 'tetris-ghost3d-slot') === slot);
    const rebuiltListenerCount = local.listeners();
    local.context.dispatch('ghostgame:shellchange', { detail:{ active:false, gameId:'tetris' } });
    const inactiveBeforeVisibility = newHost.state.suspended === true;
    local.document.hidden = true; local.document.dispatch('visibilitychange');
    local.document.hidden = false; local.document.dispatch('visibilitychange');
    const inactiveAfterVisibility = newHost.state.suspended === true;
    // The caller's unchanged model still says shellActive:true; only the
    // shell event may resume this generation, not a duplicate render commit.
    presenter.commit();
    await settle();
    const inactiveAfterDuplicateCommit = newHost.state.suspended === true;
    const environmentCallsBeforeMedia = newHost.calls.filter(call => call.type === 'environment').length;
    local.media.emit(true);
    await settle();
    const mediaAfterRebuild = presenter.snapshot().reducedMotion === true && newHost.calls.filter(call => call.type === 'environment').length > environmentCallsBeforeMedia;
    local.context.dispatch('ghostgame:shellchange', { detail:{ active:true, gameId:'tetris' } });
    check('fresh generation rebinds visibility/reduced-motion listeners and visibility never resumes an inactive shell',
      rebuiltListenerCount === 3 && inactiveBeforeVisibility && inactiveAfterVisibility && inactiveAfterDuplicateCommit && mediaAfterRebuild && newHost.state.suspended === false);
    local.media.emit(false);
    const summary = JSON.stringify(presenter.snapshot());
    check('diagnostic snapshot exposes no raw frame, DOM mount, renderer object, or serializable game state',
      !/"(?:frame|well|mount|slot|host)"\s*:/.test(summary) && Object.isFrozen(presenter.snapshot()), summary);
    const listenerCount = local.listeners();
    presenter.dispose();
    check('dispose is idempotent and removes slot and environment listeners',
      listenerCount >= 3 && !find(replacement, 'tetris-ghost3d-slot') && local.listeners() === 0 && presenter.dispose().status === 'disposed');

    const inconsistentLocks = [
      { kind:0, rotation:0, x:3, y:16, cleared:0, label:'kind' },
      { kind:1, rotation:1, x:3, y:16, cleared:0, label:'rotation' },
      { kind:1, rotation:0, x:2, y:16, cleared:0, label:'x' },
      { kind:1, rotation:0, x:3, y:15, cleared:0, label:'y' },
      { kind:1, rotation:0, x:3, y:16, cleared:1, label:'cleared' },
    ];
    let lockConsistencyRejected = true;
    for (const lock of inconsistentLocks) {
      const consistency = runtime({ enabled:'1' });
      let consistencyModel = localModel(consistency.mount, {
        state:{ well:well(), active:{ kind:1, rotation:0, x:3, y:16 }, alive:true, placementSeq:0 },
      });
      const consistencyPresenter = consistency.create(() => consistencyModel);
      consistencyPresenter.commit();
      await settle();
      consistencyModel = localModel(consistency.mount, {
        state:{ well:lockedOWell(), active:{ kind:0, rotation:0, x:3, y:0 }, alive:true, placementSeq:1 },
        trustedLock:{ type:'lock', kind:lock.kind, rotation:lock.rotation, x:lock.x, y:lock.y, cleared:lock.cleared, placementSeq:1 },
      });
      consistencyPresenter.commit();
      await settle();
      lockConsistencyRejected = lockConsistencyRejected && frames(consistency.log.hosts[0]).length === 2 && motions(consistency.log.hosts[0]).length === 0;
      consistencyPresenter.dispose();
    }
    check('piece_locked rejects kind/rotation/x/y/cleared metadata that cannot explain the prior active piece and target well transition', lockConsistencyRejected);

    const staticOnly = runtime({ enabled:'1' });
    let staticModel = localModel(staticOnly.mount, { reducedMotion:true, state:{ well:well(), active:{ kind:0, rotation:0, x:3, y:0 }, alive:false, placementSeq:0 } });
    const staticPresenter = staticOnly.create(() => staticModel);
    staticPresenter.commit();
    await settle();
    const staticHost = staticOnly.log.hosts[0];
    const koFrame = frames(staticHost).at(-1).frame;
    staticModel = localModel(staticOnly.mount, {
      reducedMotion:true,
      state:{ well:lockedWell, active:{ kind:0, rotation:0, x:3, y:0 }, alive:true, placementSeq:1 },
      trustedLock:{ type:'lock', kind:1, rotation:0, x:3, y:16, cleared:0, placementSeq:1 },
    });
    staticPresenter.commit();
    await settle();
    check('a player KO is not match terminal, while reduced motion accepts final frames with zero lock timeline',
      koFrame.alive === false && koFrame.terminal === false && motions(staticHost).length === 0 && staticPresenter.snapshot().reducedMotion === true);
    staticModel = localModel(staticOnly.mount, {
      reducedMotion:true, state:{ well:lockedWell, active:null, alive:true, placementSeq:1 }, terminal:true, winner:0,
    });
    staticPresenter.commit();
    await settle();
    check('reduced-motion still forwards terminal semantics so the renderer can apply its instant result pose',
      motions(staticHost).length === 1 && motions(staticHost)[0].event.type === 'terminal');
    staticPresenter.dispose();

    const lowOnly = runtime({ enabled:'1' });
    let lowModel = localModel(lowOnly.mount, { quality:'LOW' });
    const lowPresenter = lowOnly.create(() => lowModel);
    lowPresenter.commit();
    await settle();
    lowModel = localModel(lowOnly.mount, { quality:'LOW', state:{ well:well(), active:null, alive:true, placementSeq:0 }, terminal:true, winner:0 });
    lowPresenter.commit();
    await settle();
    check('LOW suppresses lock choreography but still forwards terminal semantics for a static result pose',
      motions(lowOnly.log.hosts[0]).length === 1 && motions(lowOnly.log.hosts[0])[0].event.type === 'terminal');
    lowPresenter.dispose();

    const fallbackOnly = runtime({ enabled:'1', supported:false });
    let fallbackModel = localModel(fallbackOnly.mount);
    const fallbackPresenter = fallbackOnly.create(() => fallbackModel);
    fallbackPresenter.commit();
    await settle();
    fallbackModel = localModel(fallbackOnly.mount, { state:{ well:well(), active:null, alive:true, placementSeq:0 }, terminal:true, winner:0 });
    fallbackPresenter.commit();
    await settle();
    check('fallback accepts the terminal frame but attempts no optional result motion',
      fallbackPresenter.snapshot().fallback === true && fallbackPresenter.snapshot().ready === false && motions(fallbackOnly.log.hosts[0]).length === 0);
    fallbackPresenter.dispose();

    const online = runtime({ enabled:'1' });
    let onlineState = onlineModel(online.mount, 0);
    const onlinePresenter = online.create(() => onlineState);
    onlinePresenter.commit();
    await settle();
    const onlineHost = online.log.hosts[0];
    const frameCount = frames(onlineHost).length;
    const optimisticWell = well(); optimisticWell[17][0] = 1;
    onlineState = onlineModel(online.mount, 0, { state:{ well:optimisticWell, active:{ kind:0, rotation:0, x:2, y:0 }, alive:true, placementSeq:0 } });
    const mismatch = onlinePresenter.commit();
    await settle();
    check('same authority revision optimistic mismatch immediately hides the optional slot without a new frame',
      mismatch.accepted === false && onlinePresenter.snapshot().ready === false && frames(onlineHost).length === frameCount);
    onlineState = onlineModel(online.mount, 0);
    const sameRevisionRecovery = onlinePresenter.commit();
    await settle();
    check('a matching same-revision snapshot cannot revive 3D after an optimistic mismatch',
      sameRevisionRecovery.accepted === false && onlinePresenter.snapshot().ready === false && frames(onlineHost).length === frameCount);
    const acceptedWell = lockedOWell();
    onlineState = onlineModel(online.mount, 1, {
      stateHash:'hash-1', state:{ well:acceptedWell, active:{ kind:0, rotation:0, x:3, y:15 }, alive:true, placementSeq:1, lastEvent:{ type:'lock', piece:1, rotation:0, x:3, y:16, cleared:0 } },
    });
    onlinePresenter.commit();
    await settle();
    const motionsBeforeReady = motions(onlineHost).length;
    check('post-mismatch reconciliation becomes visible statically and never replays the dropped lock',
      motionsBeforeReady === 0 && onlinePresenter.snapshot().ready === true);
    onlineState = onlineModel(online.mount, 2, {
      stateHash:'hash-2', state:{ well:lockedIWell(acceptedWell), active:{ kind:1, rotation:0, x:3, y:0 }, alive:true, placementSeq:2, lastEvent:{ type:'lock', piece:0, rotation:0, x:3, y:15, cleared:0 } },
    });
    onlinePresenter.commit();
    await settle();
    const onlineMotion = motions(onlineHost).at(-1);
    check('only consecutive accepted v3 live truth may restore and emit piece_locked',
      onlineMotion && onlineMotion.event.type === 'piece_locked' && onlineMotion.event.revision === onlineHost.state.revision &&
      onlinePresenter.snapshot().ready === true,
      JSON.stringify({ motion:onlineMotion && onlineMotion.event, summary:onlinePresenter.snapshot(), calls:onlineHost.calls.map(call => call.type) }));
    const beforeLegacy = frames(onlineHost).length;
    onlineState = onlineModel(online.mount, 3, { protocol:'tetris-battle-authority-v1' });
    const legacy = onlinePresenter.commit();
    await settle();
    check('legacy battle relay, malformed well, and stale authority state remain DOM-only/fail closed',
      legacy.accepted === false && frames(onlineHost).length === beforeLegacy &&
      (onlineState = onlineModel(online.mount, 0), onlinePresenter.commit().accepted === false) &&
      (onlineState = onlineModel(online.mount, 3, { state:{ well:Array.from({ length:17 }, () => Array(10).fill(0)), active:null, alive:true, placementSeq:3 } }), onlinePresenter.commit().accepted === false));
    onlineState = onlineModel(online.mount, 4, { source:'reconnect', sourceEpoch:1, stateHash:'hash-4', state:{ well:acceptedWell, active:null, alive:true, placementSeq:2 } });
    onlinePresenter.commit();
    await settle();
    const reconnectHost = online.log.hosts.at(-1);
    check('reconnect creates a static fresh generation and never replays lock motion',
      reconnectHost !== onlineHost && motions(reconnectHost).length === 0 && frames(reconnectHost).at(-1).frame.origin.source === 'reconnect');
    onlinePresenter.dispose();

    const sourceContinuity = runtime({ enabled:'1' });
    let sourceModel = onlineModel(sourceContinuity.mount, 0, {
      source:'reconnect', sourceEpoch:1, stateHash:'source-reconnect-0',
      state:{ well:well(), active:{ kind:1, rotation:0, x:3, y:16 }, alive:true, placementSeq:0 },
    });
    const sourcePresenter = sourceContinuity.create(() => sourceModel);
    sourcePresenter.commit();
    await settle();
    const sourceHost = sourceContinuity.log.hosts[0];
    sourceModel = onlineModel(sourceContinuity.mount, 1, {
      source:'live', stateHash:'source-live-1',
      state:{ well:lockedOWell(), active:{ kind:0, rotation:0, x:3, y:15 }, alive:true, placementSeq:1, lastEvent:{ type:'lock', piece:1, rotation:0, x:3, y:16, cleared:0 } },
    });
    sourcePresenter.commit();
    await settle();
    const restoreToLiveStatic = motions(sourceHost).length === 0;
    sourceModel = onlineModel(sourceContinuity.mount, 2, {
      source:'live', stateHash:'source-live-2',
      state:{ well:lockedIWell(lockedOWell()), active:{ kind:1, rotation:0, x:3, y:0 }, alive:true, placementSeq:2, lastEvent:{ type:'lock', piece:0, rotation:0, x:3, y:15, cleared:0 } },
    });
    sourcePresenter.commit();
    await settle();
    check('restore/reconcile to live transition remains static; only same-source consecutive live truth may animate',
      restoreToLiveStatic && motions(sourceHost).length === 1 && motions(sourceHost)[0].event.type === 'piece_locked');
    sourcePresenter.dispose();

    const withheld = runtime({ enabled:'1' });
    let withheldState = onlineModel(withheld.mount, 0);
    const withheldPresenter = withheld.create(() => withheldState);
    withheldPresenter.commit();
    await settle();
    withheldState = onlineModel(withheld.mount, 0, { accepted:false, protocol:null, optimistic:true });
    const withheldOptimistic = withheldPresenter.commit();
    await settle();
    withheldState = onlineModel(withheld.mount, 0);
    const withheldDuplicate = withheldPresenter.commit();
    await settle();
    check('caller-withheld optimistic v3 projection also blocks duplicate revision recovery until newer truth',
      withheldOptimistic.accepted === false && withheldDuplicate.accepted === false && withheldPresenter.snapshot().ready === false);
    withheldPresenter.dispose();

    const mountFailure = runtime({ enabled:'1', failMount:true });
    const failurePresenter = mountFailure.create(() => localModel(mountFailure.mount));
    failurePresenter.commit();
    await settle();
    const failedSlot = find(mountFailure.mount, 'tetris-ghost3d-slot');
    const failedAdapter = mountFailure.log.adapters[0];
    if (failedAdapter) { failedAdapter.options.onReady(); failedAdapter.options.onError(); failedAdapter.options.onContextLost('late'); }
    await settle();
    check('synchronous Foundation/adapter mount failure cannot re-activate stale callbacks or spin duplicate recovery',
      failurePresenter.snapshot().ready === false && failurePresenter.snapshot().fallback === true && mountFailure.log.adapters.length === 1 &&
      failedSlot && failedSlot.dataset.ghost3dReady === 'false');
    failurePresenter.dispose();

    for (const synchronousFailure of ['syncConstructorError', 'syncConstructorContextLost']) {
      const constructFailure = runtime({ enabled:'1', [synchronousFailure]:true });
      const constructPresenter = constructFailure.create(() => localModel(constructFailure.mount));
      constructPresenter.commit();
      await settle();
      const constructHost = constructFailure.log.hosts[0];
      const constructAdapter = constructFailure.log.adapters[0];
      check('constructor-time ' + synchronousFailure + ' cannot enter recover or revive a failed adapter',
        constructFailure.log.adapters.length === 1 && constructHost && !constructHost.calls.some(call => call.type === 'recover') &&
        constructAdapter && constructAdapter.adapter.disposed === 1 && constructPresenter.snapshot().ready === false && constructPresenter.snapshot().fallback === true);
      constructPresenter.dispose();
    }

    const contextRecovery = runtime({ enabled:'1' });
    let recoveryModel = localModel(contextRecovery.mount, {
      state:{ well:well(), active:{ kind:1, rotation:0, x:3, y:16 }, alive:true, placementSeq:0 },
    });
    const recoveryPresenter = contextRecovery.create(() => recoveryModel);
    recoveryPresenter.commit();
    await settle();
    const contextHost = contextRecovery.log.hosts[0];
    const contextAdapter = contextRecovery.log.adapters[0];
    const contextGeneration = recoveryPresenter.snapshot().generation;
    contextAdapter.options.onContextLost('webglcontextlost');
    await settle();
    const recoveredHost = contextRecovery.log.hosts.at(-1);
    const firstRecoveryFrame = frames(recoveredHost).at(-1) && frames(recoveredHost).at(-1).frame;
    const staticRecovery = motions(recoveredHost).length === 0;
    const recoveryHostCount = contextRecovery.log.hosts.length;
    contextAdapter.options.onReady();
    contextAdapter.options.onError(new Error('late-old-adapter'));
    contextAdapter.options.onContextLost('late-old-adapter');
    await settle();
    recoveryModel = localModel(contextRecovery.mount, {
      state:{ well:lockedOWell(), active:{ kind:0, rotation:0, x:3, y:0 }, alive:true, placementSeq:1 },
      trustedLock:{ type:'lock', kind:1, rotation:0, x:3, y:16, cleared:0, placementSeq:1 },
    });
    recoveryPresenter.commit();
    await settle();
    check('active context loss creates an isolated fresh generation with a static first frame; old adapter callbacks cannot revive it and the next valid lock remains singular',
      recoveredHost !== contextHost && contextHost.disposed === 1 && recoveryPresenter.snapshot().generation > contextGeneration &&
      firstRecoveryFrame && firstRecoveryFrame.revision === 1 && staticRecovery && motions(recoveredHost).length === 1 &&
      contextRecovery.log.hosts.length === recoveryHostCount && contextRecovery.log.adapters.length === 2 && recoveryPresenter.snapshot().ready === true,
      JSON.stringify({ generation:recoveryPresenter.snapshot().generation, hosts:contextRecovery.log.hosts.length, adapters:contextRecovery.log.adapters.length, oldDisposed:contextHost.disposed, firstRevision:firstRecoveryFrame && firstRecoveryFrame.revision, motions:motions(recoveredHost).length }));
    recoveryPresenter.dispose();

    const hardFailure = runtime({ enabled:'1' });
    let hardFailureModel = localModel(hardFailure.mount);
    const hardFailurePresenter = hardFailure.create(() => hardFailureModel);
    hardFailurePresenter.commit();
    await settle();
    const hardFailureAdapter = hardFailure.log.adapters[0];
    hardFailureAdapter.options.onError(new Error('render-failure'));
    await settle();
    const hardFailureWell = well(); hardFailureWell[17][0] = 1;
    hardFailureModel = localModel(hardFailure.mount, {
      state:{ well:hardFailureWell, active:{ kind:1, rotation:0, x:3, y:0 }, alive:true, placementSeq:1 },
      trustedLock:{ type:'lock', kind:0, rotation:0, x:0, y:17, cleared:0, placementSeq:1 },
    });
    hardFailurePresenter.commit();
    await settle();
    const stayedBlocked = hardFailure.log.adapters.length === 1 && hardFailurePresenter.snapshot().ready === false && hardFailurePresenter.snapshot().fallback === true;
    hardFailureModel = localModel(hardFailure.mount, { resetEpoch:1, state:{ well:hardFailureWell, active:null, alive:true, placementSeq:1 } });
    hardFailurePresenter.commit();
    await settle();
    check('generic renderer failure stays blocked across later frames and retries only in a fresh generation',
      stayedBlocked && hardFailure.log.adapters.length === 2 && hardFailurePresenter.snapshot().ready === true && hardFailurePresenter.snapshot().fallback === false,
      JSON.stringify({ adapters:hardFailure.log.adapters.length, snapshot:hardFailurePresenter.snapshot() }));
    hardFailurePresenter.dispose();

    const delayed = runtime({ enabled:'1', deferImport:true });
    let delayedState = localModel(delayed.mount);
    const delayedPresenter = delayed.create(() => delayedState);
    delayedPresenter.commit();
    const firstHost = delayed.log.hosts[0];
    const freshMount = delayed.document.createElement('div');
    delayedState = localModel(freshMount, { resetEpoch:1 });
    delayedPresenter.commit();
    const secondHost = delayed.log.hosts.at(-1);
    delayed.resolveImport();
    await settle();
    check('delayed lazy import is generation-guarded and mounts only the current root/adapter epoch',
      firstHost !== secondHost && firstHost.disposed === 1 && delayed.log.adapters.length === 1 && delayed.log.adapters[0].options.mountElement.parentNode === freshMount,
      JSON.stringify({ hosts:delayed.log.hosts.length, firstDisposed:firstHost.disposed, adapters:delayed.log.adapters.length, mount:delayed.log.adapters[0] && delayed.log.adapters[0].options.mountElement.parentNode === freshMount }));
    delayedPresenter.dispose();
  } catch (error) {
    check('Tetris Ghost3D Presenter VM contract executes', false, error && error.stack || String(error));
  }
  if (failures) {
    console.error('TETRIS_GHOST3D_CONTRACT_FAILURES=' + failures);
    process.exitCode = 1;
  } else {
    console.log('TETRIS_GHOST3D_CONTRACT_ALL_PASS');
  }
})();
