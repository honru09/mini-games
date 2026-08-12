'use strict';

// Product Realignment P0 – final Game Stage pair.  This is intentionally a
// source + tiny DOM harness contract: process rails are presentation-only,
// never part of authority snapshots or Xiangqi/Tank wire payloads.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const tankSource = fs.readFileSync(path.join(ROOT, 'public/src/games/tank.js'), 'utf8');
const xiangqiSource = fs.readFileSync(path.join(ROOT, 'public/src/games/xiangqi.js'), 'utf8');
const failures = [];

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures.push(name);
}

function segment(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = start >= 0 ? source.indexOf(endToken, start) : -1;
  return start >= 0 && end > start ? source.slice(start, end) : '';
}

const tankSnapshot = segment(tankSource, 'function snapshot(){', 'function finiteNumber(');
const xqSnapshot = segment(xiangqiSource, 'function snapshot(){', 'function onRestore(');

check('Tank declares the eight observable presentation stages',
  /TANK_WAVE_C_PROCESS_STEPS\s*=\s*\[[^\]]*'spawn'[^\]]*'ready'[^\]]*'move'[^\]]*'fire'[^\]]*'hit'[^\]]*'ko'[^\]]*'score'[^\]]*'terminal'/.test(tankSource));
check('Xiangqi declares the seven observable presentation stages',
  /XIANGQI_WAVE_C_PROCESS_STEPS\s*=\s*\[[^\]]*'turn'[^\]]*'select'[^\]]*'move'[^\]]*'capture'[^\]]*'check'[^\]]*'clock'[^\]]*'terminal'/.test(xiangqiSource));
check('Tank and Xiangqi expose scoped process rails and setters',
  ['tank-wave-c-process', 'setTankWaveCProcess', 'data-tank-process',
    'xiangqi-wave-c-process', 'setXiangqiWaveCProcess', 'data-xiangqi-process']
    .every(token => tankSource.includes(token) || xiangqiSource.includes(token)));
check('process state stays out of authoritative snapshots',
  !/WaveC|wave-c|Process|processRail|tankProcess|xiangqiProcess/i.test(tankSnapshot) &&
  !/WaveC|wave-c|Process|processRail|tankProcess|xiangqiProcess/i.test(xqSnapshot));
check('no GSAP or remote asset runtime dependency is introduced',
  !/\bgsap\b|ScrollTrigger|https?:\/\//i.test(tankSource + xiangqiSource));
check('Tank geometry is not capped by the old 620px width', !/Math\.min\([^\n]*620/.test(tankSource));
check('Xiangqi geometry is not capped by the old 560px width', !/Math\.min\(w,\s*560\)/.test(xiangqiSource));
check('presentation timers use explicit epoch/revision guards and cleanup',
  /clearTankWaveCProcessTimers\(\)/.test(tankSource) && /clearXiangqiWaveCProcessTimers\(\)/.test(xiangqiSource) &&
  /tankWaveCProcessEpoch|xiangqiWaveCProcessEpoch|motionEpoch/.test(tankSource + xiangqiSource) &&
  /destroy[\s\S]{0,500}clear(?:Tank|Xiangqi)WaveCProcessTimers/.test(tankSource + xiangqiSource));
check('reduced motion settles directly without queued process callbacks',
  /prefersReducedMotion\(\)[\s\S]{0,220}setTankWaveCProcess/.test(tankSource) &&
  /prefersReducedMotion\(\)[\s\S]{0,220}setXiangqiWaveCProcess/.test(xiangqiSource));
check('Tank replay remains non-blocking while presentation timers are local-only',
  /whenIdle\s*:\s*\(\)\s*=>\s*Promise\.resolve\(\)/.test(tankSource));

function makeElement(tag) {
  const classes = new Set();
  const listeners = new Map();
  const node = {
    tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null,
    style: { setProperty(key, value) { this[key] = String(value); }, removeProperty(key) { delete this[key]; } },
    dataset: {}, attributes: {}, textContent: '', clientWidth: 640, clientHeight: 620,
    appendChild(child) { if (child) { if (child.parentNode) child.parentNode.removeChild(child); child.parentNode = this; this.children.push(child); } return child; },
    removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); if (child) child.parentNode = null; return child; },
    insertBefore(child, before) { if (child && child.parentNode) child.parentNode.removeChild(child); const i = this.children.indexOf(before); if (i < 0) this.children.push(child); else this.children.splice(i, 0, child); if (child) child.parentNode = this; return child; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { if (!listeners.has(type)) return; if (fn) listeners.get(type).delete(fn); else listeners.delete(type); },
    dispatch(type, event) { const payload = event || {}; if (payload.target === undefined) payload.target = this; (listeners.get(type) || new Set()).forEach(fn => fn(payload)); },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    classList: null,
    querySelector(selector) { return query(this, selector, false); },
    querySelectorAll(selector) { return query(this, selector, true); },
    getBoundingClientRect() {
      const width = Number.parseFloat(this.style.width) || this.clientWidth || 640;
      const height = Number.parseFloat(this.style.height) || this.clientHeight || 620;
      return { left: 0, top: 0, width, height };
    },
    setPointerCapture(id) { this._pointer = id; }, releasePointerCapture(id) { if (this._pointer === id) this._pointer = null; },
    focus() {},
  };
  if (String(tag || '').toLowerCase() === 'canvas') {
    node.getContext = () => ({
      setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
      stroke() {}, arc() {}, fill() {}, save() {}, restore() {}, clip() {}, fillText() {},
      createLinearGradient() { return { addColorStop() {} }; },
      setLineDash() {},
    });
  }
  Object.defineProperty(node, 'innerHTML', { get() { return ''; }, set() { node.children.slice().forEach(child => { child.parentNode = null; }); node.children = []; } });
  Object.defineProperty(node, 'className', { get() { return [...classes].join(' '); }, set(value) { classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(item => classes.add(item)); } });
  node.classList = { add(...items) { items.forEach(item => classes.add(item)); }, remove(...items) { items.forEach(item => classes.delete(item)); }, contains(item) { return classes.has(item); }, toggle(item, force) { const next = force === undefined ? !classes.has(item) : !!force; if (next) classes.add(item); else classes.delete(item); return next; } };
  return node;
}

function query(root, selector, all) {
  const found = [], queue = (root.children || []).slice();
  while (queue.length) {
    const node = queue.shift();
    const match = selector[0] === '.' && node.classList && node.classList.contains(selector.slice(1));
    if (match) { if (!all) return node; found.push(node); }
    queue.push(...(node.children || []));
  }
  return all ? found : null;
}

function runtime(source, entry, settings) {
  const jobs = new Map(); let nextJob = 1;
  const intervals = new Map(); let nextInterval = 1;
  const area = makeElement('div'); const extra = makeElement('div');
  area.clientWidth = settings && settings.width || 640; area.clientHeight = settings && settings.height || 620;
  const documentListeners = new Map(), windowListeners = new Map();
  const document = {
    visibilityState: 'visible', createElement: makeElement,
    addEventListener(type, fn) { if (!documentListeners.has(type)) documentListeners.set(type, new Set()); documentListeners.get(type).add(fn); },
    removeEventListener(type, fn) { if (!documentListeners.has(type)) return; if (fn) documentListeners.get(type).delete(fn); else documentListeners.delete(type); },
    dispatch(type, event) { (documentListeners.get(type) || new Set()).forEach(fn => fn(event || {})); },
  };
  const window = {
    devicePixelRatio: 1, matchMedia: query => ({ matches: !!(settings && settings.reducedMotion && query === '(prefers-reduced-motion: reduce)') }),
    addEventListener(type, fn) { if (!windowListeners.has(type)) windowListeners.set(type, new Set()); windowListeners.get(type).add(fn); },
    removeEventListener(type, fn) { if (!windowListeners.has(type)) return; if (fn) windowListeners.get(type).delete(fn); else windowListeners.delete(type); },
    dispatch(type, event) { (windowListeners.get(type) || new Set()).forEach(fn => fn(event || {})); },
  };
  const sandbox = {
    console, JSON, Date, Math, Number, String, Boolean, Array, Object, Map, Set, Promise,
    document, window, navigator: { maxTouchPoints: 2 }, location: { protocol: 'http:', host: 'localhost' },
    setTimeout(fn, delay) { const id = nextJob++; jobs.set(id, { fn, delay }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    setInterval(fn, delay) { const id = nextInterval++; intervals.set(id, { fn, delay }); return id; },
    clearInterval(id) { intervals.delete(id); },
    __area: area, __extra: extra,
    el(tagName, className, text) { const node = makeElement(tagName); node.className = className || ''; if (text !== undefined) node.textContent = String(text); return node; },
    t(key, ...args) { return String(key) + (args.length ? ':' + args.join(',') : ''); },
    renderPlayers() {}, setStatus() {}, playFeedback() {}, toast() {}, showVictoryOverlay() {}, shareGameLink() {},
    haptic() {}, tabletopArtEnabled() { return true; }, markTabletopSurface() {},
    prefersReducedMotion() { return !!(settings && settings.reducedMotion); },
    aiChoose: async () => null, aiSpeak() {}, confirmAIReady() {}, triggerHonruGameReaction() {},
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  // utility helpers used by both game modules
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/src/core/01-utils.js'), 'utf8'), context);
  vm.runInContext(source, context, { filename: entry + '.js' });
  const opts = { ai: new Set(), online: false, myIdx: 0, isHost: true, isReplaying: () => false, onEnd() {}, sendMove() {}, sendRestart() {}, ...((settings && settings.opts) || {}) };
  context.__opts = opts;
  const game = vm.runInContext(`${entry}(__area,__extra,2,__opts)`, context);
  return {
    area, extra, game, jobs, intervals,
    flush(limit = 100) { let count = 0; while (jobs.size && count++ < limit) { const [id, job] = jobs.entries().next().value; jobs.delete(id); job.fn(); } return count; },
  };
}

// Runtime checks execute even while the source checks above are red.  Keep
// failures bounded so this contract remains useful during implementation.
try {
  const tank = runtime(tankSource, 'gameTank', { width: 960, height: 560 });
  check('Tank creates a visible process rail', !!tank.area.querySelector('.tank-wave-c-process'));
  check('Tank exposes a stage state on the Arena', !!tank.area.dataset.tankProcess);
  const tankBoard = tank.area.querySelector('.tank-board');
  check('Tank desktop board uses most available Arena space', tankBoard && Number.parseFloat(tankBoard.style.width) >= 500,
    tankBoard && tankBoard.style.width);
  check('Tank starts at spawn and settles to ready through a presentation-only timer',
    tank.game.getPresentationState().process === 'spawn' && tank.jobs.size > 0);
  tank.flush();
  check('Tank spawn reaches a stable ready stage', tank.game.getPresentationState().process === 'ready');
  tank.game.onMove({ act:'move', d:1 }, 0); tank.game.fixedUpdate(.05);
  check('Tank movement is observable without changing the input contract', tank.game.getPresentationState().process === 'move');
  let tankState = tank.game.snapshot();
  tankState.grid = tankState.grid.map((row, r) => row.map((cell, c) => r === 0 || r === 12 || c === 0 || c === 14 ? 3 : 0));
  tankState.tanks[0].x = 2.5; tankState.tanks[0].y = 2.5; tankState.tanks[0].d = 1; tankState.tanks[0].invulnerableUntil = 0;
  tankState.tanks[1].x = 4.5; tankState.tanks[1].y = 2.5; tankState.tanks[1].hp = 2; tankState.tanks[1].invulnerableUntil = 0;
  tankState.tanks.forEach(player => { player.input = {}; });
  tank.game.onRestore(tankState); tank.game.onMove({ act:'shoot' }, 0);
  check('Tank fire is observable immediately', tank.game.getPresentationState().process === 'fire');
  for (let index = 0; index < 6; index++) tank.game.fixedUpdate(.05);
  check('Tank hit is observable while authority-shaped stats remain intact',
    tank.game.getPresentationState().process === 'hit' && tank.game.getMatchStats()[0].hits === 1);
  tankState = tank.game.snapshot(); tankState.tanks[0].fireReadyAt = 0; tankState.tanks[1].hp = 1; tankState.tanks.forEach(player => { player.input = {}; });
  tank.game.onRestore(tankState); tank.game.onMove({ act:'shoot' }, 0);
  for (let index = 0; index < 6; index++) tank.game.fixedUpdate(.05);
  check('Tank KO is observable separately from a surviving hit',
    tank.game.getPresentationState().process === 'ko' && tank.game.getMatchStats()[0].kills === 1);
  tank.game.finishMatch();
  check('Tank result first exposes score before terminal', tank.game.getPresentationState().process === 'score');
  tank.flush();
  check('Tank terminal settles after the result process', tank.game.getPresentationState().process === 'terminal');
  tank.game.destroy();
  check('Tank destroy clears every presentation callback', tank.jobs.size === 0);

  const reducedTank = runtime(tankSource, 'gameTank', { width: 390, height: 844, reducedMotion: true });
  check('reduced-motion Tank goes directly to ready with no queued presentation callback',
    reducedTank.game.getPresentationState().process === 'ready' && reducedTank.jobs.size === 0);
  reducedTank.game.destroy();

  const authorityTank = runtime(tankSource, 'gameTank', { width:960, height:560, opts:{
    online:true, matchId:'qa-tank-process-authority', gameplayMeta:{ protocol:'tank-authority-v1' }, sendTankInput() {},
  } });
  authorityTank.flush();
  const authorityTankBase = authorityTank.game.snapshot();
  const authorityTankState = (serverTick, offset, knockedOut) => ({
    protocol:'tank-authority-v1', matchId:'qa-tank-process-authority', serverTick,
    endAt:Date.now() + 170000, remainingMs:170000, season:'spring', destructibles:authorityTankBase.grid,
    players:authorityTankBase.tanks.map((tank, id) => ({
      ...tank, x:tank.x + offset, alive:knockedOut && id === 0 ? false : tank.alive, hp:knockedOut && id === 0 ? 0 : tank.hp,
    })), projectiles:[], ack:[0,0],
  });
  authorityTank.game.onAuthoritySnapshot(authorityTankState(1, .5, false));
  const authorityMoveRevision = authorityTank.game.getPresentationState().revision;
  authorityTank.game.onAuthoritySnapshot(authorityTankState(2, 1, false));
  check('Tank high-frequency authority movement coalesces to one stable process state',
    authorityTank.game.getPresentationState().process === 'move' && authorityTank.game.getPresentationState().revision === authorityMoveRevision);
  authorityTank.game.onAuthoritySnapshot(authorityTankState(3, 1.2, true));
  check('Tank authority KO wins over same-snapshot movement and remains stable through the next tick',
    authorityTank.game.getPresentationState().process === 'ko');
  authorityTank.game.onAuthoritySnapshot(authorityTankState(4, 1.4, true));
  check('Tank later movement snapshots cannot overwrite an active authority KO process',
    authorityTank.game.getPresentationState().process === 'ko');
  authorityTank.game.onAuthorityResult({ order:[1,0] });
  check('Tank late authority snapshots cannot reopen a settled final process',
    authorityTank.game.onAuthoritySnapshot(authorityTankState(5, 1.6, false)) === false && authorityTank.game.getPresentationState().process === 'score');
  authorityTank.flush();
  check('Tank final process still settles to terminal after rejecting a late snapshot', authorityTank.game.getPresentationState().process === 'terminal');
  authorityTank.game.destroy();
  check('Tank authority process quiet timer is cleared on destroy', authorityTank.jobs.size === 0);

  const xq = runtime(xiangqiSource, 'gameXiangqi', { width: 960, height: 620 });
  check('Xiangqi creates a visible process rail', !!xq.area.querySelector('.xiangqi-wave-c-process'));
  check('Xiangqi exposes a stage state on the Arena', !!xq.area.dataset.xiangqiProcess);
  const xqBoard = xq.area.querySelector('.xiangqi-board');
  check('Xiangqi desktop board uses most available Arena space', xqBoard && Number.parseFloat(xqBoard.style.width) >= 500,
    xqBoard && xqBoard.style.width);
  const xqWidth = Number.parseFloat(xqBoard.style.width), xqCell = xqWidth / 9, xqPad = xqCell / 2;
  xqBoard.dispatch('click', { clientX:xqPad, clientY:xqPad + 6 * xqCell });
  check('Xiangqi selection is observable', xq.game.getPresentationState().process === 'select');
  const selectedBoard = xq.area.querySelector('.xiangqi-board');
  selectedBoard.dispatch('click', { clientX:xqPad, clientY:xqPad + 5 * xqCell });
  check('Xiangqi move is observable before it settles', xq.game.getPresentationState().process === 'move');
  xq.flush();
  check('Xiangqi ordinary move settles to turn after its motion callback', xq.game.getPresentationState().process === 'turn');
  const captureBoard = Array.from({ length:10 }, () => Array(9).fill(null));
  captureBoard[0][4] = { p:1, t:'k' }; captureBoard[9][4] = { p:0, t:'k' }; captureBoard[6][4] = { p:0, t:'p' };
  captureBoard[8][0] = { p:0, t:'r' }; captureBoard[7][0] = { p:1, t:'p' };
  xq.game.onRestore({ board:captureBoard, cur:0, over:false, winner:-1, lastMove:null, capturedPieces:[[],[]], clockMode:'casual', clockRemaining:[null,null], moveCount:0, captureCount:0, checkCount:0 });
  xq.game.onMove({ from:[8,0], to:[7,0] }, 0);
  check('Xiangqi capture is observable before it settles', xq.game.getPresentationState().process === 'capture');
  xq.flush();
  const checkBoard = Array.from({ length:10 }, () => Array(9).fill(null));
  checkBoard[0][4] = { p:1, t:'k' }; checkBoard[9][4] = { p:0, t:'k' }; checkBoard[2][3] = { p:0, t:'r' };
  xq.game.onRestore({ board:checkBoard, cur:0, over:false, winner:-1, lastMove:null, capturedPieces:[[],[]], clockMode:'casual', clockRemaining:[null,null], moveCount:0, captureCount:0, checkCount:0 });
  xq.game.onMove({ from:[2,3], to:[2,4] }, 0); xq.flush();
  check('Xiangqi check is observable after a legal checking move', xq.game.getPresentationState().process === 'check');
  xq.game.setClockState({ mode:'rapid', remaining:[590000,580000] });
  const xqClockLabel = xq.area.querySelector('.xiangqi-wave-c-process-label');
  check('Xiangqi clock state is observable without falsely announcing expiry',
    xq.game.getPresentationState().process === 'clock' &&
    xqClockLabel && /xiangqi_clock_active/.test(xqClockLabel.textContent) && !/xiangqi_clock_expired/.test(xqClockLabel.textContent));
  const terminal = xq.game.snapshot(); terminal.over = true; terminal.winner = 0;
  xq.game.onRestore(terminal);
  const pendingAfterRestore = xq.jobs.size;
  xq.flush();
  check('Xiangqi restore clears old motion/process callbacks before stable terminal',
    pendingAfterRestore === 0 && xq.game.getPresentationState().process === 'terminal');
  xq.game.destroy();
  check('Xiangqi destroy clears every presentation callback', xq.jobs.size === 0);

  const reducedXq = runtime(xiangqiSource, 'gameXiangqi', { width:390, height:844, reducedMotion:true });
  reducedXq.game.onMove({ from:[6,0], to:[5,0] }, 0);
  check('reduced-motion Xiangqi reaches stable turn with no mover or queued callback',
    reducedXq.game.getPresentationState().process === 'turn' && !reducedXq.area.querySelector('.xiangqi-motion-piece') && reducedXq.jobs.size === 0);
  reducedXq.game.destroy();

  const authorityClockXq = runtime(xiangqiSource, 'gameXiangqi', { width:960, height:620, opts:{
    online:true, matchId:'qa-xiangqi-clock-process', gameplayMeta:{ protocol:'xiangqi-clock-v1' },
  } });
  authorityClockXq.game.onRestore({ board:checkBoard, cur:1, over:false, winner:-1, lastMove:null, capturedPieces:[[],[]], clockMode:'rapid', clockRemaining:[590000,580000], moveCount:1, captureCount:0, checkCount:1 });
  authorityClockXq.game.onClockState({ protocol:'xiangqi-clock-v1', remainingMsByPlayer:[589000,580000], activePlayer:1 });
  check('Xiangqi passive authority clock sync cannot overwrite an active check process',
    authorityClockXq.game.getPresentationState().process === 'check' && authorityClockXq.jobs.size === 0);
  const authorityTerminal = authorityClockXq.game.snapshot(); authorityTerminal.over = true; authorityTerminal.winner = 0;
  authorityClockXq.game.onRestore(authorityTerminal);
  authorityClockXq.game.setSpectators(true);
  check('Xiangqi spectator updates cannot downgrade a restored terminal process',
    authorityClockXq.game.getPresentationState().process === 'terminal');
  authorityClockXq.game.onClockState({ protocol:'xiangqi-clock-v1', remainingMsByPlayer:[588000,580000], activePlayer:1 });
  check('Xiangqi late clock sync cannot downgrade a restored terminal process',
    authorityClockXq.game.getPresentationState().process === 'terminal' && authorityClockXq.jobs.size === 0);
  authorityClockXq.game.destroy();

  const viewports = [
    { name:'desktop', width:1280, height:720 }, { name:'tablet', width:768, height:680 },
    { name:'390 portrait', width:390, height:844 }, { name:'844 landscape', width:844, height:390 },
  ];
  viewports.forEach(viewport => {
    const tankViewport = runtime(tankSource, 'gameTank', viewport);
    const tankField = tankViewport.area.querySelector('.tank-board');
    const tankWidth = Number.parseFloat(tankField && tankField.style.width), tankHeight = Number.parseFloat(tankField && tankField.style.height);
    const expectedTankWidth = Math.min(
      Math.max(240, Math.min(viewport.width - 16, 980)),
      Math.max(240, (viewport.height - 76) * 15 / 13)
    );
    const tankFits = Math.abs(tankWidth - expectedTankWidth) < 2 && tankHeight <= viewport.height - 48;
    check('Tank ' + viewport.name + ' has an Arena-filling usable playfield', !!tankField && tankFits, tankField && tankField.style.width + ' × ' + tankField.style.height);
    tankViewport.game.destroy();

    const xqViewport = runtime(xiangqiSource, 'gameXiangqi', viewport);
    const xqField = xqViewport.area.querySelector('.xiangqi-board');
    const xqFieldWidth = Number.parseFloat(xqField && xqField.style.width), xqFieldHeight = Number.parseFloat(xqField && xqField.style.height);
    const sideRail = viewport.width >= 700 && viewport.height >= 450;
    const railWidth = Math.max(180, Math.min(260, Math.round(viewport.width * .25)));
    const expectedXqWidth = Math.min(
      Math.max(220, Math.min((sideRail ? viewport.width - railWidth - 24 : viewport.width - 16), 980)),
      Math.max(220, (viewport.height - 16) * 9 / 10)
    );
    const xqFits = Math.abs(xqFieldWidth - expectedXqWidth) < 2 && xqFieldHeight <= viewport.height - 8;
    check('Xiangqi ' + viewport.name + ' has an Arena-filling usable playfield', !!xqField && xqFits, xqField && xqField.style.width + ' × ' + xqField.style.height);
    xqViewport.game.destroy();
  });
} catch (error) {
  check('Tank/Xiangqi runtime harness executes', false, error && error.stack || String(error));
}

if (failures.length) {
  console.error('GAME_STAGE_DENSITY_PROCESS_TANK_XIANGQI_FAILURES=' + failures.length);
  process.exitCode = 1;
} else {
  console.log('GAME_STAGE_DENSITY_PROCESS_TANK_XIANGQI_ALL_PASS');
}
