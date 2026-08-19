'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'xiangqi.js'), 'utf8');
const WEBSOCKET_SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'online', '03-websocket.js'), 'utf8');
const EXECUTABLE = SOURCE;
const BRIDGE_SOURCE = SOURCE.slice(SOURCE.indexOf("const XIANGQI_GHOST3D_STORAGE_KEY"), SOURCE.indexOf('function renderAux'));
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
    dataset: {}, attributes: {}, textContent: '', clientWidth: 520, clientHeight: 600,
    style: { setProperty(key, item) { this[key] = String(item); }, removeProperty(key) { delete this[key]; } },
    appendChild(child) {
      if (!child) return child;
      if (child.parentNode && typeof child.parentNode.removeChild === 'function') child.parentNode.removeChild(child);
      child.parentNode = this; this.children.push(child); return child;
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
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (listeners.has(type)) listeners.get(type).delete(handler); },
    dispatch(type, event) { (listeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...listeners.values()].reduce((count, set) => count + set.size, 0); },
    setAttribute(key, item) {
      this.attributes[key] = String(item);
      if (String(key).startsWith('data-')) this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = String(item);
    },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    removeAttribute(key) {
      delete this.attributes[key];
      if (String(key).startsWith('data-')) delete this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())];
    },
    getBoundingClientRect() { return { left:0, top:0, width:this.clientWidth, height:this.clientHeight }; },
  };
  Object.defineProperty(value, 'innerHTML', {
    get() { return ''; },
    set(_input) { value.children.forEach(child => { child.parentNode = null; }); value.children = []; },
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
  if (value.tagName === 'CANVAS') {
    const canvasLog = { currentPath:[], strokedPaths:[], lineDashes:[] };
    const context = {
      setTransform() {}, fillRect() {},
      beginPath() { canvasLog.currentPath = []; },
      moveTo(x,y) { canvasLog.currentPath.push({ type:'move', x, y }); },
      lineTo(x,y) { canvasLog.currentPath.push({ type:'line', x, y }); },
      stroke() { if (canvasLog.currentPath.length) canvasLog.strokedPaths.push(canvasLog.currentPath.slice()); },
      arc() {}, fill() {}, save() {}, restore() {}, clip() {}, fillText() {},
      setLineDash(value) { canvasLog.lineDashes.push(Array.from(value || [])); },
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
    };
    value.canvasLog = canvasLog;
    value.getContext = () => context;
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

function findByTag(root, tagName) {
  if (!root) return null;
  if (root.tagName === String(tagName || '').toUpperCase()) return root;
  for (const child of root.children || []) {
    const found = findByTag(child, tagName);
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
      const state = { revision:null, terminal:false, frame:null, adapter:null, disposed:false, suspended:false, usingFallback:false };
      const row = { options, state, calls:[], disposed:0 };
      // This deliberately mirrors Foundation's observable failure boundary:
      // the host callback fires while the active adapter is still current,
      // then Foundation tears the adapter down and enters its fallback.  The
      // bridge must invalidate that adapter's callbacks during the callback.
      row.triggerFailure = function triggerFailure(phase) {
        if (state.disposed) return false;
        if (typeof options.onFailure === 'function') options.onFailure({ phase:phase || 'render' }, snapshot());
        if (state.adapter && typeof state.adapter.dispose === 'function') state.adapter.dispose();
        state.adapter = null;
        state.usingFallback = true;
        return true;
      };
      log.hosts.push(row);
      const snapshot = () => Object.freeze({
        revision:state.revision, terminal:state.terminal, frame:state.frame, adapterReady:!!state.adapter,
        suspended:state.suspended, usingFallback:state.usingFallback,
      });
      return {
        apply(message) {
          row.calls.push(message);
          if (state.disposed || !message || typeof message !== 'object') return Object.freeze({ accepted:false, snapshot:snapshot() });
          if (message.type === 'frame') {
            if (state.terminal || !message.frame || !Number.isSafeInteger(message.frame.revision) || (state.revision !== null && message.frame.revision <= state.revision)) return Object.freeze({ accepted:false, snapshot:snapshot() });
            state.frame = message.frame; state.revision = message.frame.revision; state.terminal = message.frame.terminal === true;
            if (state.adapter && typeof state.adapter.render === 'function') state.adapter.render(state.frame, {}, () => {});
            return Object.freeze({ accepted:true, revision:state.revision, snapshot:snapshot() });
          }
          if (message.type === 'recover') {
            state.adapter = message.adapter; state.usingFallback = false;
            if (!state.adapter || typeof state.adapter.mount !== 'function' || typeof state.adapter.render !== 'function') return Object.freeze({ accepted:false, snapshot:snapshot() });
            state.adapter.mount({}, () => {});
            if (state.frame) state.adapter.render(state.frame, {}, () => {});
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          if (message.type === 'context-lost') {
            if (state.adapter && typeof state.adapter.dispose === 'function') state.adapter.dispose();
            state.adapter = null; state.usingFallback = true;
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          if (message.type === 'lifecycle') {
            state.suspended = message.action === 'hidden' || message.action === 'suspend';
            return Object.freeze({ accepted:true, snapshot:snapshot() });
          }
          if (message.type === 'environment' || message.type === 'motion') return Object.freeze({ accepted:true, snapshot:snapshot() });
          return Object.freeze({ accepted:false, snapshot:snapshot() });
        },
        dispose() {
          state.disposed = true; row.disposed += 1;
          if (state.adapter && typeof state.adapter.dispose === 'function') state.adapter.dispose();
          return snapshot();
        },
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
    matches:!!settings.reducedMotion,
    addEventListener(type, handler) { if (type === 'change') mediaListeners.add(handler); },
    removeEventListener(type, handler) { if (type === 'change') mediaListeners.delete(handler); },
    emit(matches) { this.matches = !!matches; mediaListeners.forEach(handler => handler({ matches:this.matches })); },
    listenerCount() { return mediaListeners.size; },
  };
  const document = {
    hidden:!!settings.hidden,
    createElement:node,
    addEventListener(type, handler) { if (!documentListeners.has(type)) documentListeners.set(type, new Set()); documentListeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (documentListeners.has(type)) documentListeners.get(type).delete(handler); },
    dispatch(type, event) { (documentListeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...documentListeners.values()].reduce((count, set) => count + set.size, 0); },
  };
  const values = {
    mg_ghost3d_xiangqi_v1: settings.ghost3d === undefined ? null : settings.ghost3d,
    mg_ghost3d_xiangqi_quality_v1: settings.quality === undefined ? null : settings.quality,
  };
  const window = {
    devicePixelRatio:Number.isFinite(settings.dpr) && settings.dpr > 0 ? settings.dpr : 1,
    localStorage:{ getItem(key) { if (settings.storageThrows) throw new Error('blocked'); return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; } },
    matchMedia() { return media; },
    addEventListener(type, handler) { if (!windowListeners.has(type)) windowListeners.set(type, new Set()); windowListeners.get(type).add(handler); },
    removeEventListener(type, handler) { if (windowListeners.has(type)) windowListeners.get(type).delete(handler); },
    dispatch(type, event) { (windowListeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    listenerCount() { return [...windowListeners.values()].reduce((count, set) => count + set.size, 0); },
  };
  const log = { imports:0, hosts:[], adapters:[], audioCues:[] };
  let resolveImport = null;
  const module = {
    isXiangqi3DSupported() { return settings.supported !== false; },
    createXiangqi3DAdapter(options) {
      let announced = false;
      const record = { options, adapter:null, mountCalls:0, renderCalls:0, motionCalls:0 };
      const adapter = {
        mount() { record.mountCalls += 1; return true; },
        render() { record.renderCalls += 1; if (!announced) { announced = true; options.onReady(); } return true; },
        motion() { record.motionCalls += 1; return true; },
        setQuality() { return true; }, environment() { return true; }, suspend() { return true; }, resume() { return true; }, contextLost() { return true; },
        dispose() { adapter.disposed = (adapter.disposed || 0) + 1; return true; },
      };
      record.adapter = adapter; log.adapters.push(record); return adapter;
    },
  };
  const match = { value:settings.matchId || 'xiangqi-contract-match' };
  function loadGameModule() {
    log.imports += 1;
    if (settings.deferImport) return new Promise(resolve => { resolveImport = resolve; });
    return Promise.resolve({ ok:true, module });
  }
  const sandbox = {
    console, window, document, Math, Number, String, Boolean, Array, Object, Set, Map, JSON, Promise, Date,
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return { unref() {} }; }, clearInterval() {},
    el(tag, className, text) { const value = node(tag); value.className = className || ''; if (text !== undefined) value.textContent = String(text); return value; },
    t(key, ...args) { return key + (args.length ? ':' + args.join(',') : ''); },
    tabletopArtEnabled() { return false; }, markTabletopSurface() {}, prefersReducedMotion() { return !!settings.reducedMotion; },
    playFeedback() {}, emitAcceptedAudioCue(type, context, intensity, pan) { log.audioCues.push({ type, context, intensity, pan }); return { accepted:true }; }, setStatus() {}, renderPlayers() {}, aiChoose:async () => null, aiSpeak() {}, confirmAIReady() {}, toast() {}, showVictoryOverlay() {}, shareGameLink() {},
    Ghost3DFoundation:makeFoundation(log), XiangqiRules:settings.online ? {} : undefined,
    GameModuleLoader: { load: loadGameModule },
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(EXECUTABLE, context, { filename:'xiangqi-ghost3d.js' });
  const options = { ai:new Set(), online:!!settings.online, myIdx:0, isHost:true, sendMove() {}, sendRestart() {} };
  if (settings.online) {
    options.gameplayMeta = { protocol:'xiangqi-rule-v2' };
    options.sendXiangqiAction = () => {};
    options.getMatchId = () => match.value;
  }
  const game = context.gameXiangqi(area, extra, 2, options);
  return { area, extra, game, log, document, window, media, module, setMatchId(value) { match.value = value; }, resolveImport() { if (resolveImport) resolveImport({ ok:true, module }); } };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function frameCalls(host) { return (host && host.calls || []).filter(call => call.type === 'frame'); }
function motionCalls(host) { return (host && host.calls || []).filter(call => call.type === 'motion'); }
async function settle(turns) { for (let index = 0; index < (turns || 12); index += 1) await Promise.resolve(); }

function authority(matchId, revision, board, overrides) {
  const source = overrides || {};
  return {
    protocol:'xiangqi-rule-v2', matchId, revision, hash:source.hash || ('hash-' + matchId + '-' + revision), board:clone(board),
    current:source.current === 1 ? 1 : 0, moveNumber:Number.isSafeInteger(source.moveNumber) ? source.moveNumber : revision,
    lastMove:Object.prototype.hasOwnProperty.call(source, 'lastMove') ? source.lastMove : null,
    check:source.check === true, terminal:source.terminal === true, winner:Number.isInteger(source.winner) ? source.winner : -1,
    clock:{ remainingMsByPlayer:[600000,600000] },
  };
}

check('renderer experiment requires exact local one opt-in',
  /function xiangqiGhost3DEnabled\(\)[\s\S]{0,360}storage\.getItem\(XIANGQI_GHOST3D_STORAGE_KEY\) === '1'/.test(SOURCE));
check('bridge stays renderer-free and lazy-loads only through GameModuleLoader',
  /GameModuleLoader\.load\('xiangqi'/.test(SOURCE) && !/\bTHREE\b|\bgsap\b|ScrollTrigger/.test(BRIDGE_SOURCE));
check('frame contract is a frozen 10 by 9 Xiangqi-only projection',
  /kind:'xiangqi-3d-frame-v1'/.test(BRIDGE_SOURCE) && /xiangqiGhost3DCloneBoard/.test(BRIDGE_SOURCE) && /ROWS/.test(BRIDGE_SOURCE) && /COLS/.test(BRIDGE_SOURCE) && /xiangqiGhost3DFreeze/.test(BRIDGE_SOURCE));
check('renderer has no reverse input seam and the DOM click/keyboard routes remain present',
  !/onInput\s*:|emitInput\s*:|type:'input'|type:\s*'input'/.test(BRIDGE_SOURCE) &&
  /boardEl\.addEventListener\('click'/.test(SOURCE) && /boardEl\.addEventListener\('keydown'/.test(SOURCE) &&
  /boardEl\.setAttribute\('role','grid'\); boardEl\.setAttribute\('tabindex','0'\)/.test(SOURCE));
check('raw authority source is captured before flattening and public API accepts source',
  /function onXiangqiRuleState\(value, source = 'live'\)/.test(SOURCE) && /xiangqiGhost3DReadRuleState\(value, source\)/.test(SOURCE) && /onRestore\(\{board:value\.board/.test(SOURCE));
check('live, reconnect, and both spectator entry paths tag Xiangqi authority snapshots explicitly',
  /onXiangqiRuleState\(msg\.payload\|\|msg,'live'\)/.test(WEBSOCKET_SOURCE) &&
  /onXiangqiRuleState\(p\.xiangqiRuleSnapshot,'reconnect'\)/.test(WEBSOCKET_SOURCE) &&
  (WEBSOCKET_SOURCE.match(/onXiangqiRuleState\(p\.xiangqiRuleSnapshot,'spectator-bootstrap'\)/g) || []).length === 2);
check('generation and adapter epoch invalidation cover host failure and context recovery',
  /function xiangqiGhost3DHostFailed/.test(BRIDGE_SOURCE) && /xiangqiGhost3DNextAdapterEpoch\(\)/.test(BRIDGE_SOURCE) && /function xiangqiGhost3DContextLost/.test(BRIDGE_SOURCE));
check('accepted check and terminal facts remain presentation-only finite camera beats',
  /check:frame\.check === true/.test(BRIDGE_SOURCE) && /if \(frame\.terminal\)/.test(BRIDGE_SOURCE) && /type:'terminal'/.test(BRIDGE_SOURCE) &&
  /function queueXiangqiOutcome/.test(SOURCE) && /quality === 'HIGH' \? 420 : 320/.test(SOURCE));

(async () => {
  try {
    const defaultOn = run({ ghost3d:null });
    await settle();
    check('missing key keeps Xiangqi on the production DOM board with no renderer work',
      defaultOn.log.hosts.length === 0 && defaultOn.log.imports === 0 && !findByClass(defaultOn.area, 'xiangqi-ghost3d-slot'));
    defaultOn.game.destroy();

    const canvasMap = run({ ghost3d:'0', dpr:2 });
    const canvasBoard = findByClass(canvasMap.area, 'xiangqi-board');
    const canvas = findByTag(canvasBoard, 'canvas');
    const cssWidth = parseFloat(canvas && canvas.style.width);
    const cssHeight = parseFloat(canvas && canvas.style.height);
    const boardWidth = parseFloat(canvasBoard && canvasBoard.style.width);
    const boardHeight = parseFloat(canvasBoard && canvasBoard.style.height);
    const epsilon = .001;
    const paths = canvas && canvas.canvasLog ? canvas.canvasLog.strokedPaths : [];
    const straightPaths = paths.filter(path => path.length >= 2 && path.every(point => point.type === 'move' || point.type === 'line'));
    const verticalSegments = straightPaths.flatMap(path => {
      const segments = [];
      for (let index = 0; index + 1 < path.length; index += 2) {
        const start = path[index], end = path[index + 1];
        if (start.type === 'move' && end.type === 'line' && Math.abs(start.x - end.x) < epsilon) segments.push([start,end]);
      }
      return segments;
    });
    const horizontalSegments = straightPaths.flatMap(path => {
      const segments = [];
      for (let index = 0; index + 1 < path.length; index += 2) {
        const start = path[index], end = path[index + 1];
        if (start.type === 'move' && end.type === 'line' && Math.abs(start.y - end.y) < epsilon) segments.push([start,end]);
      }
      return segments;
    });
    const fullHeightVerticals = verticalSegments.filter(segment =>
      Math.abs(segment[0].y - boardWidth / 18) < epsilon && Math.abs(segment[1].y - (boardHeight - boardWidth / 18)) < epsilon);
    check('permanent Canvas map pins CSS pixels separately from its DPR backing store',
      !!canvas && Math.abs(cssWidth - boardWidth) < epsilon && Math.abs(cssHeight - boardHeight) < epsilon &&
      canvas.width === Math.round(cssWidth * 2) && canvas.height === Math.round(cssHeight * 2),
      JSON.stringify({ cssWidth, cssHeight, backingWidth:canvas && canvas.width, backingHeight:canvas && canvas.height }));
    check('permanent Canvas map draws all ten ranks and only the two borders across the river',
      horizontalSegments.length === 10 && verticalSegments.length === 16 && fullHeightVerticals.length === 2 &&
      canvas.canvasLog.lineDashes.every(dash => dash.length === 0),
      JSON.stringify({ horizontal:horizontalSegments.length, vertical:verticalSegments.length, fullHeight:fullHeightVerticals.length, dashes:canvas.canvasLog.lineDashes }));
    canvasMap.game.destroy();

    const rollback = run({ ghost3d:'0' });
    await settle();
    check('exact local zero performs no host creation, slot mount, or module request',
      rollback.log.hosts.length === 0 && rollback.log.imports === 0 && !findByClass(rollback.area, 'xiangqi-ghost3d-slot'));
    rollback.game.destroy();
    const blocked = run({ ghost3d:'yes', storageThrows:true });
    await settle();
    check('blocked storage leaves the DOM-only fallback untouched',
      blocked.log.hosts.length === 0 && blocked.log.imports === 0 && !findByClass(blocked.area, 'xiangqi-ghost3d-slot'));
    blocked.game.destroy();

    const keyboard = run({ ghost3d:'0' });
    let keyboardBoard = findByClass(keyboard.area, 'xiangqi-board');
    let preventedKeys = 0;
    keyboardBoard.dispatch('keydown', { key:'Enter', preventDefault(){ preventedKeys += 1; } });
    keyboardBoard = findByClass(keyboard.area, 'xiangqi-board');
    keyboardBoard.dispatch('keydown', { key:'ArrowUp', preventDefault(){ preventedKeys += 1; } });
    keyboardBoard = findByClass(keyboard.area, 'xiangqi-board');
    keyboardBoard.dispatch('keydown', { key:'Enter', preventDefault(){ preventedKeys += 1; } });
    keyboardBoard = findByClass(keyboard.area, 'xiangqi-board');
    const keyboardState = keyboard.game.snapshot();
    check('permanent DOM board supports a complete keyboard select and legal move without Renderer input',
      keyboardBoard.getAttribute('role') === 'grid' && keyboardBoard.getAttribute('tabindex') === '0' && preventedKeys === 3 &&
      keyboardState.board[9][4] === null && keyboardState.board[8][4] && keyboardState.board[8][4].p === 0 && keyboardState.board[8][4].t === 'k' &&
      keyboard.log.hosts.length === 0 && keyboard.log.imports === 0);
    keyboard.game.destroy();

    const cue = run({ ghost3d:'1', quality:'BALANCED' });
    await settle();
    const cueSlot = findByClass(cue.area, 'xiangqi-ghost3d-slot');
    let cueBoard = findByClass(cue.area, 'xiangqi-board');
    const cueInitiallyClear = cueSlot && cueSlot.dataset.domCueActive === 'false';
    cueBoard.dispatch('keydown', { key:'Enter', preventDefault(){} });
    cueBoard = findByClass(cue.area, 'xiangqi-board');
    const selectionRevealsDom = cueSlot.dataset.domCueActive === 'true';
    cueBoard.dispatch('keydown', { key:'ArrowUp', preventDefault(){} });
    cueBoard = findByClass(cue.area, 'xiangqi-board');
    const cursorRevealsDom = cueSlot.dataset.domCueActive === 'true';
    cueBoard.dispatch('keydown', { key:'Enter', preventDefault(){} });
    await settle();
    check('opt-in Renderer yields to DOM selection/legal/keyboard cues and returns after commit',
      cueInitiallyClear && selectionRevealsDom && cursorRevealsDom && cueSlot.dataset.domCueActive === 'false' &&
      motionCalls(cue.log.hosts[0]).length === 1);
    cue.game.destroy();

    const local = run({ ghost3d:'1', quality:'BALANCED' });
    await settle();
    const localHost = local.log.hosts[0];
    const localSlot = findByClass(local.area, 'xiangqi-ghost3d-slot');
    const initial = frameCalls(localHost)[0];
    let forbidden = false;
    if (initial) walk(initial.frame, key => { if (['clock','uid','name','seat','reward','coins','xp','actionId','replay','ai','token','canvas','adapter'].includes(key)) forbidden = true; });
    check('enabled local bridge creates one pure frozen static frame and read-only slot',
      local.log.imports === 1 && local.log.hosts.length === 1 && !!localSlot && localSlot.getAttribute('aria-hidden') === 'true' &&
      localSlot.getAttribute('role') === 'presentation' && localSlot.getAttribute('tabindex') === '-1' && /pointer-events:none/.test(localSlot.style.cssText || '') &&
      !!initial && Object.isFrozen(initial.frame) && Object.isFrozen(initial.frame.board) && initial.frame.kind === 'xiangqi-3d-frame-v1' &&
      initial.frame.board.length === 10 && initial.frame.board.every(row => row.length === 9) && !forbidden,
      JSON.stringify({ imports:local.log.imports, hosts:local.log.hosts.length, frozen:initial && Object.isFrozen(initial.frame) }));
    const adapter = local.log.adapters[0];
    check('adapter factory receives only presentation lifecycle options',
      !!adapter && !Object.prototype.hasOwnProperty.call(adapter.options, 'onInput') && !Object.prototype.hasOwnProperty.call(adapter.options, 'emitInput') &&
      adapter.options.mountElement === localSlot && typeof adapter.options.onReady === 'function' && typeof adapter.options.onContextLost === 'function');
    local.game.onMove({ from:[6,0], to:[5,0] });
    await settle();
    const localMotion = motionCalls(localHost).at(-1);
    check('a committed legal local move emits exactly one revision-bound piece_moved after its frame',
      !!localMotion && localMotion.event.type === 'piece_moved' && localMotion.event.player === 0 &&
      JSON.stringify(localMotion.event.from) === JSON.stringify([6,0]) && JSON.stringify(localMotion.event.to) === JSON.stringify([5,0]) &&
      localMotion.event.capture === false && localMotion.event.revision === localHost.state.revision && typeof localMotion.event.eventId === 'string');
    const hostsBeforeRebuild = local.log.hosts.length;
    local.game.setBoardTheme('grass');
    await settle();
    const rebuiltBoard = findByClass(local.area, 'xiangqi-board');
    check('render rebuild reparents the one optional slot without duplicate hosts or detached ownership',
      local.log.hosts.length === hostsBeforeRebuild && localSlot.parentNode === rebuiltBoard && findByClass(rebuiltBoard, 'xiangqi-ghost3d-slot') === localSlot);
    const snapshotText = JSON.stringify(local.game.snapshot());
    const serializedText = JSON.stringify(local.game.serialize());
    check('snapshot and serialize remain isolated from flags, bridge revisions, and renderer objects',
      !/ghost3d|mg_ghost3d|adapter|canvas|eventId/i.test(snapshotText) && !/ghost3d|mg_ghost3d|adapter|canvas|eventId/i.test(serializedText));
    adapter.options.onContextLost('test-context-loss');
    await settle();
    const recovered = local.log.adapters.at(-1);
    const adaptersAfterRecovery = local.log.adapters.length;
    adapter.options.onReady(); adapter.options.onError(); adapter.options.onContextLost('late');
    await settle();
    check('context loss replaces only the adapter epoch and stale callbacks cannot revive or duplicate it',
      local.log.adapters.length === 2 && adapter.adapter.disposed === 1 && recovered !== adapter && local.log.adapters.length === adaptersAfterRecovery && localSlot.dataset.ghost3dReady === 'true');
    const listenerCount = local.document.listenerCount() + local.window.listenerCount() + local.media.listenerCount();
    local.game.destroy();
    check('destroy disposes the host, slot, and document/window/media listeners',
      listenerCount >= 3 && localHost.disposed === 1 && !findByClass(local.area, 'xiangqi-ghost3d-slot') &&
      local.document.listenerCount() + local.window.listenerCount() + local.media.listenerCount() === 0);

    const failedHostRun = run({ ghost3d:'1', quality:'BALANCED' });
    await settle();
    const failedHost = failedHostRun.log.hosts[0];
    const failedAdapter = failedHostRun.log.adapters[0];
    const failedSlot = findByClass(failedHostRun.area, 'xiangqi-ghost3d-slot');
    const foundationFailureApplied = failedHost && failedHost.triggerFailure('render');
    failedAdapter.options.onReady();
    failedAdapter.options.onError();
    failedAdapter.options.onContextLost('late-after-foundation-failure');
    await settle();
    check('Foundation render failure enters fallback and old adapter callbacks cannot revive the optional canvas',
      foundationFailureApplied === true && failedHost.state.usingFallback === true && failedAdapter.adapter.disposed === 1 &&
      failedHostRun.log.adapters.length === 1 && failedSlot.dataset.ghost3dReady === 'false');
    failedHostRun.game.destroy();

    const audioOrder = run({ ghost3d:'0', online:true, matchId:'xiangqi-audio-order' });
    await settle();
    const audioStart = audioOrder.game.snapshot().board;
    const audioMoved = clone(audioStart); audioMoved[5][0] = audioMoved[6][0]; audioMoved[6][0] = null;
    const audioGap = clone(audioMoved); audioGap[4][0] = audioGap[5][0]; audioGap[5][0] = null;
    const audioFirst = audioOrder.game.onXiangqiRuleState(authority('xiangqi-audio-order', 0, audioStart, { current:0, moveNumber:0, lastMove:null }), 'live');
    const audioSecond = audioOrder.game.onXiangqiRuleState(authority('xiangqi-audio-order', 1, audioMoved, { current:1, moveNumber:1, lastMove:{ from:[6,0], to:[5,0], capture:null } }), 'live');
    const cuesAfterSecond = audioOrder.log.audioCues.length;
    const staleRejected = audioOrder.game.onXiangqiRuleState(authority('xiangqi-audio-order', 0, audioStart, { current:0, moveNumber:0, lastMove:null }), 'live') === false;
    const duplicateRejected = audioOrder.game.onXiangqiRuleState(authority('xiangqi-audio-order', 1, audioMoved, { current:1, moveNumber:1, lastMove:{ from:[6,0], to:[5,0], capture:null } }), 'live') === false;
    const gapAccepted = audioOrder.game.onXiangqiRuleState(authority('xiangqi-audio-order', 3, audioGap, { current:0, moveNumber:3, lastMove:{ from:[5,0], to:[4,0], capture:null } }), 'live') === true;
    const cuesAfterGap = audioOrder.log.audioCues.length;
    const contiguousAfterGap = audioOrder.game.onXiangqiRuleState(authority('xiangqi-audio-order', 4, audioGap, { current:1, moveNumber:4, lastMove:{ from:[4,0], to:[5,0], capture:null } }), 'live') === true;
    check('Ghost3D-off live authority audio rejects stale/duplicate snapshots and keeps revision gaps silent',
      audioFirst === true && audioSecond === true && cuesAfterSecond === 1 && staleRejected && duplicateRejected &&
      gapAccepted && cuesAfterGap === 1 && contiguousAfterGap && audioOrder.log.audioCues.length === 2 && audioOrder.log.hosts.length === 0);
    audioOrder.game.destroy();

    const online = run({ ghost3d:'1', online:true, matchId:'xiangqi-online' });
    await settle();
    const start = online.game.snapshot().board;
    const first = authority('xiangqi-online', 0, start, { current:0, moveNumber:0, lastMove:null });
    const firstAccepted = online.game.onXiangqiRuleState(first, 'live');
    await settle();
    const onlineHost = online.log.hosts[0];
    const firstFrame = frameCalls(onlineHost).at(-1);
    const moved = clone(start); moved[5][0] = moved[6][0]; moved[6][0] = null;
    const second = authority('xiangqi-online', 1, moved, { current:1, moveNumber:1, lastMove:{ from:[6,0], to:[5,0], capture:null } });
    const secondAccepted = online.game.onXiangqiRuleState(second, 'live');
    await settle();
    const onlineMotion = motionCalls(onlineHost).at(-1);
    check('online first state snaps while one continuous raw authority move emits the sole semantic motion',
      firstAccepted === true && secondAccepted === true && firstFrame && firstFrame.frame.origin.source === 'live' && motionCalls(onlineHost).length === 1 &&
      onlineMotion && onlineMotion.event.type === 'piece_moved' && onlineMotion.event.capture === false && onlineMotion.event.player === 0);
    const framesBeforeStale = frameCalls(onlineHost).length;
    const motionsBeforeStale = motionCalls(onlineHost).length;
    online.game.onXiangqiRuleState(second, 'live');
    const gap = authority('xiangqi-online', 3, moved, { current:1, moveNumber:3, lastMove:{ from:[6,0], to:[5,0], capture:null } });
    online.game.onXiangqiRuleState(gap, 'live');
    await settle();
    check('duplicate/stale raw state adds no frame and a revision gap snaps with no manufactured move',
      frameCalls(onlineHost).length === framesBeforeStale + 1 && motionCalls(onlineHost).length === motionsBeforeStale);
    const beforeMalformed = JSON.stringify(online.game.snapshot());
    const malformed = authority('xiangqi-online', 4, moved.slice(0,9), { current:0, moveNumber:4, lastMove:null });
    const malformedAccepted = online.game.onXiangqiRuleState(malformed, 'live');
    const shortRow = authority('xiangqi-online', 4, moved, { current:0, moveNumber:4, lastMove:null }); shortRow.board[0].pop();
    const badCell = authority('xiangqi-online', 4, moved, { current:0, moveNumber:4, lastMove:null }); badCell.board[0][0] = { p:0, t:'z' };
    const badCurrent = authority('xiangqi-online', 4, moved, { current:0, moveNumber:4, lastMove:null }); badCurrent.current = 2;
    const badWinner = authority('xiangqi-online', 4, moved, { current:0, moveNumber:4, lastMove:null }); badWinner.winner = 2;
    const badCapture = authority('xiangqi-online', 4, moved, { current:0, moveNumber:4, lastMove:{ from:[6,0], to:[5,0], capture:{ p:2, t:'p' } } });
    const malformedVariants = [shortRow,badCell,badCurrent,badWinner,badCapture];
    const variantsRejected = malformedVariants.every(item => online.game.onXiangqiRuleState(item, 'live') === false);
    await settle();
    check('malformed dimensions, cells, current, winner, and capture leave both DOM and renderer untouched',
      malformedAccepted === false && variantsRejected && JSON.stringify(online.game.snapshot()) === beforeMalformed && onlineHost.state.usingFallback === true);
    const terminal = authority('xiangqi-online', 4, moved, { current:1, moveNumber:4, lastMove:null, terminal:true, winner:0 });
    const terminalAccepted = online.game.onXiangqiRuleState(terminal, 'live');
    await settle();
    const terminalFrame = frameCalls(onlineHost).at(-1);
    check('terminal authority fact is a static terminal frame, never an inferred motion',
      terminalAccepted === true && terminalFrame && terminalFrame.frame.terminal === true && motionCalls(onlineHost).length === motionsBeforeStale);
    const oldHost = onlineHost;
    const reconnect = authority('xiangqi-online', 5, start, { current:0, moveNumber:0, lastMove:null });
    online.game.onXiangqiRuleState(reconnect, 'reconnect');
    await settle();
    const reconnectHost = online.log.hosts.at(-1);
    const reconnectFrame = frameCalls(reconnectHost).at(-1);
    const restore = authority('xiangqi-online', 6, start, { current:0, moveNumber:0, lastMove:null });
    online.game.onXiangqiRuleState(restore, 'room-restored');
    await settle();
    const restoreHost = online.log.hosts.at(-1);
    const spectator = authority('xiangqi-online', 7, start, { current:0, moveNumber:0, lastMove:null });
    online.game.onXiangqiRuleState(spectator, 'spectator-bootstrap');
    await settle();
    const spectatorHost = online.log.hosts.at(-1);
    check('reconnect, room restore, and spectator bootstrap replace generations and remain static',
      reconnectHost !== oldHost && oldHost.disposed === 1 && reconnectFrame && reconnectFrame.frame.origin.source === 'reconnect' && motionCalls(reconnectHost).length === 0 &&
      restoreHost !== reconnectHost && reconnectHost.disposed === 1 && frameCalls(restoreHost).at(-1).frame.origin.source === 'room-restored' && motionCalls(restoreHost).length === 0 &&
      spectatorHost !== restoreHost && restoreHost.disposed === 1 && frameCalls(spectatorHost).at(-1).frame.origin.source === 'spectator-bootstrap' && motionCalls(spectatorHost).length === 0);
    online.game.destroy();

    const captureOnline = run({ ghost3d:'1', online:true, matchId:'xiangqi-capture' });
    await settle();
    const captureStart = Array.from({ length:10 }, () => Array(9).fill(null));
    captureStart[6][0] = { p:0, t:'p' }; captureStart[5][0] = { p:1, t:'p' };
    captureOnline.game.onXiangqiRuleState(authority('xiangqi-capture', 0, captureStart, { current:0, moveNumber:0, lastMove:null }), 'live');
    await settle();
    const capturedBoard = clone(captureStart); capturedBoard[5][0] = { p:0, t:'p' }; capturedBoard[6][0] = null;
    captureOnline.game.onXiangqiRuleState(authority('xiangqi-capture', 1, capturedBoard, { current:1, moveNumber:1, lastMove:{ from:[6,0], to:[5,0], capture:{ p:1, t:'p' } } }), 'live');
    await settle();
    const captureMotion = motionCalls(captureOnline.log.hosts[0]).at(-1);
    check('capture is encoded only as capture:true on the same piece_moved event',
      captureMotion && captureMotion.event.type === 'piece_moved' && captureMotion.event.capture === true && !captureOnline.log.hosts[0].calls.some(call => call.type === 'motion' && call.event.type !== 'piece_moved'));
    captureOnline.game.destroy();

    const delayed = run({ ghost3d:'1', deferImport:true });
    await settle();
    const delayedOldHost = delayed.log.hosts[0];
    delayed.game.onRestart();
    const delayedNewHost = delayed.log.hosts.at(-1);
    delayed.resolveImport();
    await settle();
    check('a delayed import after reset recovers only the current host generation',
      delayed.log.imports === 1 && delayedOldHost.disposed === 1 && delayedNewHost !== delayedOldHost && delayed.log.adapters.length === 1);
    delayed.game.destroy();
  } catch (error) {
    check('Xiangqi Ghost3D VM contract executes', false, error && error.stack || String(error));
  }
  if (failures) {
    console.error('XIANGQI_GHOST3D_CONTRACT_FAILURES=' + failures);
    process.exitCode = 1;
  } else {
    console.log('XIANGQI_GHOST3D_CONTRACT_ALL_PASS');
  }
})();
