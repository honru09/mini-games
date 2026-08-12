'use strict';

// Wave C Gomoku is intentionally a source + tiny DOM contract. The process
// rail is disposable presentation state: it must never become part of the
// existing local rules, stable snapshot, serialized Replay data, or online
// move payload.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'gomoku.js'), 'utf8');
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

const snapshotSource = segment(SOURCE, 'function snapshot(){', 'function onRestore(');
const serializeSource = segment(SOURCE, 'serialize: () =>', 'setBoardTheme');
const processResetSource = segment(SOURCE, 'function resetGomokuWaveCProcess', 'function startGomokuWaveCMoveProcess');
const aiCancelSource = segment(SOURCE, 'function cancelAIWork()', 'function scheduleAI()');
const aiScheduleSource = segment(SOURCE, 'function scheduleAI()', 'const canvas =');
const touchMountSource = segment(SOURCE, 'function mountGomokuTouchControls()', 'function releaseGomokuTouchControls()');
const touchReleaseSource = segment(SOURCE, 'function releaseGomokuTouchControls()', 'mountGomokuWaveBPresentation();');

check('Gomoku declares the seven observable Wave C stages',
  /GOMOKU_WAVE_C_PROCESS_STEPS\s*=\s*\[[^\]]*'turn'[^\]]*'aim'[^\]]*'select'[^\]]*'place'[^\]]*'impact'[^\]]*'line'[^\]]*'terminal'/.test(SOURCE));
check('Gomoku exposes a scoped process rail, stable data attributes and a read-only presentation seam',
  ['gomoku-wave-c-process', 'gomoku-wave-c-process-label', 'gomoku-wave-c-process-step',
    'setGomokuWaveCProcess', 'getPresentationState', 'gomoku-process'].every(token => SOURCE.includes(token)) &&
  SOURCE.includes("'data-' + key"));
check('Wave C state stays out of Gomoku snapshots and serialized state',
  !/gomokuWaveC|wave-c|processRail|presentationState/i.test(snapshotSource) &&
  !/gomokuWaveC|wave-c|processRail|presentationState|gomokuKeyboard|keyboardCell/i.test(serializeSource) &&
  !/gomokuKeyboard|keyboardCell/i.test(snapshotSource));
check('Wave C uses no GSAP, ScrollTrigger, or remote visual dependency', !/\bgsap\b|ScrollTrigger|https?:\/\//i.test(SOURCE));
check('presentation timers have an epoch guard and are cleared by reset, restore, and destroy',
  /clearGomokuWaveCProcessTimers\(\)/.test(SOURCE) && /gomokuWaveCProcessEpoch/.test(SOURCE) &&
  /function resetLocal\(\)[\s\S]{0,240}resetGomokuWaveCProcess\('turn'\)/.test(SOURCE) && /clearGomokuWaveCProcessTimers\(\)/.test(processResetSource) &&
  /function onRestore\(value\)[\s\S]{0,520}clearGomokuWaveCProcessTimers\(\)/.test(SOURCE) &&
  /destroy:\s*\(\)\s*=>\s*\{[\s\S]{0,520}clearGomokuWaveCProcessTimers\(\)/.test(SOURCE));
check('reduced motion reaches an explanatory stable process without queued presentation work',
  /prefersReducedMotion\(\)[\s\S]{0,300}setGomokuWaveCProcess/.test(SOURCE));
check('presentation timers never make Replay wait for Gomoku idle', /whenIdle:\s*\(\)\s*=>\s*Promise\.resolve\(\)/.test(SOURCE));
check('Gomoku owns an AI timeout and cancels it through one instance-local seam',
  /let aiPending\s*=\s*false,\s*aiEpoch\s*=\s*0,\s*aiTimer\s*=\s*null/.test(SOURCE) &&
  /clearTimeout\(aiTimer\)/.test(aiCancelSource) && /aiTimer\s*=\s*null/.test(aiCancelSource));
check('AI scheduling replaces prior work and reset, restore, and destroy all call the cancellation seam',
  /cancelAIWork\(\)/.test(aiScheduleSource) && /aiTimer\s*=\s*timer/.test(aiScheduleSource) &&
  /function resetLocal\(\)[\s\S]{0,120}cancelAIWork\(\)/.test(SOURCE) &&
  /function onRestore\(value\)[\s\S]{0,360}cancelAIWork\(\)/.test(SOURCE) &&
  /destroy:\s*\(\)\s*=>\s*\{[\s\S]{0,220}cancelAIWork\(\)/.test(SOURCE));
check('Gomoku canvas exposes a localizable focusable grid and shared keyboard placement seam',
  /canvas\.setAttribute\('tabindex',\s*'0'\)/.test(SOURCE) && /canvas\.setAttribute\('role',\s*'grid'\)/.test(SOURCE) &&
  /data-i18n-aria-label',\s*'game_gomoku'/.test(SOURCE) && /handleGomokuKeyboardInput/.test(SOURCE) &&
  /placeLocalGomokuMove/.test(SOURCE));
check('Gomoku owns a localised touch equivalent with four directions, a semantic confirm, and 44px targets',
  /gomoku-touch-controls/.test(touchMountSource) && /gomokuTouchDirection/.test(touchMountSource) &&
  /gomokuTouchControl\s*=\s*'confirm'/.test(touchMountSource) && /data-i18n',\s*textKey/.test(touchMountSource) &&
  /data-i18n-aria-label',\s*'gomoku_your_turn_hint'/.test(touchMountSource) &&
  /style\.minWidth\s*=\s*'44px'/.test(SOURCE) && /style\.minHeight\s*=\s*'44px'/.test(SOURCE) &&
  /releaseGomokuTouchControls\(\)/.test(touchReleaseSource));

function makeNode(tag) {
  const classes = new Set();
  const listeners = new Map();
  const node = {
    tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null,
    dataset: {}, attributes: {}, textContent: '', clientWidth: 520, clientHeight: 520,
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
    removeEventListener(type, handler) { if (listeners.has(type)) listeners.get(type).delete(handler); },
    dispatch(type, event) { (listeners.get(type) || new Set()).forEach(handler => handler(event || {})); },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; },
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
    node.getContext = () => ({
      setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, save() {}, restore() {}, clip() {}, fillRect() {}, setLineDash() {},
      createRadialGradient() { return { addColorStop() {} }; },
    });
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

function run(settings) {
  settings = settings || {};
  let now = 1000, nextTimer = 1;
  const jobs = new Map();
  const area = makeNode('div');
  const extra = makeNode('div');
  const localStorage = { getItem() { return settings.waveBFlag === undefined ? null : settings.waveBFlag; } };
  const window = {
    devicePixelRatio: 1, localStorage,
    matchMedia(query) { return { matches: !!settings.reducedMotion && query === '(prefers-reduced-motion: reduce)' }; },
  };
  const sandbox = {
    console, window, document: { createElement: makeNode }, Math, Number, String, Boolean, Array, Object, Set, Map, JSON, Promise,
    Date: { now: () => now },
    setTimeout(fn, delay) {
      const id = nextTimer++;
      jobs.set(id, { fn, due: now + Math.max(0, Number(delay) || 0) });
      return id;
    },
    clearTimeout(id) { jobs.delete(id); },
    el(tag, className, text) { const node = makeNode(tag); node.className = className || ''; if (text !== undefined) node.textContent = String(text); return node; },
    t(key, ...args) { return key + (args.length ? ':' + args.join(',') : ''); },
    gameArtEnabled() { return false; }, stickerArtEnabled() { return false; }, tabletopArtEnabled() { return false; },
    prefersReducedMotion() { return !!settings.reducedMotion; }, playFeedback() {}, setStatus() {}, renderPlayers() {}, aiChoose: async () => null, aiSpeak() {}, confirmAIReady() {},
    online: { room: null, isHost: false }, toast() {}, showVictoryOverlay() {}, shareGameLink() {}, openInvitePicker() {},
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(SOURCE, context, { filename: 'gomoku.js' });
  const opts = { ai: new Set(), online: false, myIdx: 0, isHost: true, onEnd() {}, sendMove() {}, sendRestart() {}, ...settings.opts };
  context.__opts = opts;
  const game = vm.runInContext('gameGomoku(__area,__extra,2,__opts)', vm.createContext({ ...sandbox, __area: area, __extra: extra, gameGomoku: context.gameGomoku }));
  function flush(limit) {
    let count = 0;
    const max = limit === undefined ? 200 : limit;
    while (jobs.size && count < max) {
      const [id, job] = [...jobs.entries()].sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      jobs.delete(id);
      now = job.due;
      job.fn();
      count++;
    }
    return count;
  }
  function flushThrough(until, limit) {
    let count = 0;
    const max = limit === undefined ? 200 : limit;
    while (jobs.size && count < max) {
      const [id, job] = [...jobs.entries()].sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (job.due > until) break;
      jobs.delete(id);
      now = job.due;
      job.fn();
      count++;
    }
    return count;
  }
  return { area, extra, game, jobs, flush, flushThrough, opts };
}

function key(node, value) {
  let prevented = false;
  node.dispatch('keydown', { key: value, code: value === ' ' ? 'Space' : '', preventDefault() { prevented = true; } });
  return prevented;
}

function tap(node) {
  let prevented = false;
  node.dispatch('click', { preventDefault() { prevented = true; } });
  return prevented;
}

try {
  const live = run();
  const rail = findByClass(live.area, 'gomoku-wave-c-process');
  const board = findByClass(live.area, 'gomoku-wave-b-board');
  check('default Wave B stage mounts a Gomoku process rail', !!rail && !!board && live.game.getPresentationState().process === 'turn');
  board.dispatch('mousemove', { clientX: 260, clientY: 260 });
  check('a legal hover exposes aim without changing the board', live.game.getPresentationState().process === 'aim' && live.game.snapshot().hist.length === 0);
  board.dispatch('pointerdown', { clientX: 260, clientY: 260 });
  check('pointer selection is observable before placement', live.game.getPresentationState().process === 'select');
  board.dispatch('click', { clientX: 260, clientY: 260 });
  check('placement is observable while the stable snapshot stays unchanged in shape',
    live.game.getPresentationState().process === 'place' && JSON.stringify(live.game.snapshot()) === JSON.stringify({ hist:[[7,7]], cur:1, over:false, last:[7,7] }));
  live.flush();
  check('ordinary impact settles to the next stable turn', live.game.getPresentationState().process === 'turn' && live.jobs.size === 0);
  live.game.destroy();
  check('destroy clears every disposable Gomoku presentation callback', live.jobs.size === 0);

  const touch = run({ reducedMotion:true });
  const touchControls = findByClass(touch.extra, 'gomoku-touch-controls');
  const touchUp = findByClass(touch.extra, 'gomoku-touch-up');
  const touchRight = findByClass(touch.extra, 'gomoku-touch-right');
  const touchDown = findByClass(touch.extra, 'gomoku-touch-down');
  const touchLeft = findByClass(touch.extra, 'gomoku-touch-left');
  const touchConfirm = findByClass(touch.extra, 'gomoku-touch-confirm');
  const touchButtons = [touchUp, touchRight, touchDown, touchLeft, touchConfirm];
  check('touch control deck mounts five localised controls with 44px-equivalent targets',
    !!touchControls && touchControls.getAttribute('role') === 'group' && touchControls.dataset.gomokuTouchState === 'ready' &&
    touchButtons.every(button => button && button.style.minWidth === '44px' && button.style.minHeight === '44px' && button.style.width === '44px' && button.style.height === '44px') &&
    touchUp.getAttribute('data-i18n') === 'tank_up' && touchRight.getAttribute('data-i18n-aria-label') === 'tank_right_aria' &&
    touchConfirm.getAttribute('data-i18n-aria-label') === 'gomoku_your_turn_hint');
  const rightPrevented = tap(touchRight);
  check('a touch direction moves the shared semantic cursor without mutating Gomoku rules',
    rightPrevented && findByClass(touch.area, 'gomoku-wave-b-board').dataset.gomokuKeyboardCell === 'I8' && touchControls.dataset.gomokuKeyboardCell === 'I8' && touch.game.snapshot().hist.length === 0);
  const touchConfirmPrevented = tap(touchConfirm);
  check('touch confirm uses the normal legal placement route and keeps the stable snapshot contract',
    touchConfirmPrevented && JSON.stringify(touch.game.snapshot()) === JSON.stringify({ hist:[[7,8]], cur:1, over:false, last:[7,8] }));
  touch.game.destroy();

  const keyboard = run({ reducedMotion:true });
  const keyboardBoard = findByClass(keyboard.area, 'gomoku-wave-b-board');
  check('keyboard board has stable grid semantics and a centered semantic focus',
    keyboardBoard && keyboardBoard.getAttribute('tabindex') === '0' && keyboardBoard.getAttribute('role') === 'grid' &&
    keyboardBoard.getAttribute('aria-label') === 'game_gomoku' && keyboardBoard.dataset.gomokuKeyboardCell === 'H8');
  for (let index = 0; index < 20; index++) key(keyboardBoard, 'ArrowUp');
  for (let index = 0; index < 20; index++) key(keyboardBoard, 'ArrowLeft');
  check('keyboard arrows clamp semantic focus at the board boundary without mutating rules',
    keyboardBoard.dataset.gomokuKeyboardCell === 'A1' && JSON.stringify(keyboard.game.snapshot()) === JSON.stringify({ hist:[], cur:0, over:false, last:null }));
  keyboard.game.onRestart();
  const enterPrevented = key(keyboardBoard, 'Enter');
  check('Enter uses the normal local placement path without changing the snapshot contract',
    enterPrevented && JSON.stringify(keyboard.game.snapshot()) === JSON.stringify({ hist:[[7,7]], cur:1, over:false, last:[7,7] }));
  keyboard.game.destroy();

  const space = run({ reducedMotion:true });
  const spaceBoard = findByClass(space.area, 'gomoku-wave-b-board');
  const spacePrevented = key(spaceBoard, ' ');
  check('Space is an equivalent keyboard placement action',
    spacePrevented && JSON.stringify(space.game.snapshot()) === JSON.stringify({ hist:[[7,7]], cur:1, over:false, last:[7,7] }));
  space.game.destroy();

  let spectatorSends = 0;
  const spectatorKeyboard = run({ reducedMotion:true, opts:{ online:true, myIdx:0, spectator:true, sendMove() { spectatorSends++; } } });
  const spectatorBoard = findByClass(spectatorKeyboard.area, 'gomoku-wave-b-board');
  key(spectatorBoard, 'ArrowRight');
  key(spectatorBoard, 'Enter');
  check('spectators can inspect keyboard focus but cannot place or send a keyboard move',
    spectatorBoard.dataset.gomokuKeyboardCell === 'I8' && spectatorSends === 0 && spectatorKeyboard.game.snapshot().hist.length === 0);
  spectatorKeyboard.game.destroy();

  let spectatorTouchSends = 0;
  const spectatorTouch = run({ reducedMotion:true, opts:{ online:true, myIdx:0, spectator:true, sendMove() { spectatorTouchSends++; } } });
  const spectatorTouchRight = findByClass(spectatorTouch.extra, 'gomoku-touch-right');
  const spectatorTouchConfirm = findByClass(spectatorTouch.extra, 'gomoku-touch-confirm');
  tap(spectatorTouchRight);
  const spectatorTouchConfirmPrevented = tap(spectatorTouchConfirm);
  check('spectators can inspect with touch controls but cannot confirm, mutate, or send a move',
    spectatorTouchRight.disabled === false && spectatorTouchConfirm.disabled === true && spectatorTouchConfirmPrevented &&
    findByClass(spectatorTouch.area, 'gomoku-wave-b-board').dataset.gomokuKeyboardCell === 'I8' && spectatorTouchSends === 0 && spectatorTouch.game.snapshot().hist.length === 0);
  spectatorTouch.game.destroy();

  let waitingSends = 0;
  const waitingKeyboard = run({ reducedMotion:true, opts:{ online:true, myIdx:1, sendMove() { waitingSends++; } } });
  const waitingBoard = findByClass(waitingKeyboard.area, 'gomoku-wave-b-board');
  key(waitingBoard, 'Enter');
  check('a non-current online player cannot place or send a keyboard move', waitingSends === 0 && waitingKeyboard.game.snapshot().hist.length === 0);
  waitingKeyboard.game.destroy();

  let waitingTouchSends = 0;
  const waitingTouch = run({ reducedMotion:true, opts:{ online:true, myIdx:1, sendMove() { waitingTouchSends++; } } });
  const waitingTouchConfirm = findByClass(waitingTouch.extra, 'gomoku-touch-confirm');
  const waitingTouchConfirmPrevented = tap(waitingTouchConfirm);
  check('a non-current online player sees touch confirm disabled and cannot send a move',
    waitingTouchConfirm.disabled === true && waitingTouchConfirmPrevented && waitingTouchSends === 0 && waitingTouch.game.snapshot().hist.length === 0);
  waitingTouch.game.destroy();

  const touchLifecycle = run({ reducedMotion:true });
  const lifecycleControls = findByClass(touchLifecycle.extra, 'gomoku-touch-controls');
  const lifecycleRight = findByClass(touchLifecycle.extra, 'gomoku-touch-right');
  const lifecycleConfirm = findByClass(touchLifecycle.extra, 'gomoku-touch-confirm');
  tap(lifecycleRight);
  touchLifecycle.game.onRestore({ hist:[[7,8]], cur:1, over:false, last:[7,8] });
  const restoredSnapshot = JSON.stringify(touchLifecycle.game.snapshot());
  const restoreTapPrevented = tap(lifecycleConfirm);
  check('restore updates the shared touch cursor permission when its focused cell becomes occupied',
    lifecycleControls.dataset.gomokuKeyboardCell === 'I8' && lifecycleConfirm.disabled === true && restoreTapPrevented && JSON.stringify(touchLifecycle.game.snapshot()) === restoredSnapshot && touchLifecycle.jobs.size === 0);
  touchLifecycle.game.onRestart();
  check('reset recenters the touch cursor and restores a legal confirm affordance',
    lifecycleControls.dataset.gomokuKeyboardCell === 'H8' && lifecycleConfirm.disabled === false && touchLifecycle.jobs.size === 0);
  const lifecycleSnapshot = JSON.stringify(touchLifecycle.game.snapshot());
  touchLifecycle.game.destroy();
  const destroyedTouchTapPrevented = tap(lifecycleRight) || tap(lifecycleConfirm);
  check('destroy removes touch listeners and the control deck without residual callbacks',
    !findByClass(touchLifecycle.extra, 'gomoku-touch-controls') && !destroyedTouchTapPrevented && JSON.stringify(touchLifecycle.game.snapshot()) === lifecycleSnapshot && touchLifecycle.jobs.size === 0);

  const destroyedKeyboard = run({ reducedMotion:true });
  const destroyedBoard = findByClass(destroyedKeyboard.area, 'gomoku-wave-b-board');
  key(destroyedBoard, 'Enter');
  const destroyedSnapshot = JSON.stringify(destroyedKeyboard.game.snapshot());
  destroyedKeyboard.game.destroy();
  key(destroyedBoard, 'ArrowRight');
  key(destroyedBoard, 'Enter');
  check('destroy removes keyboard input and leaves no callback work behind',
    JSON.stringify(destroyedKeyboard.game.snapshot()) === destroyedSnapshot && destroyedKeyboard.jobs.size === 0);

  const aiReset = run({ reducedMotion:true, opts:{ ai:new Set([1]) } });
  aiReset.game.onMove([7,7], 0);
  check('a scheduled AI turn owns exactly one cancellable timeout', aiReset.jobs.size === 1);
  aiReset.game.onRestart();
  check('reset clears the pending AI timeout instead of only invalidating its epoch', aiReset.jobs.size === 0);
  aiReset.game.destroy();

  const aiRestore = run({ reducedMotion:true, opts:{ ai:new Set([1]) } });
  aiRestore.game.onMove([7,7], 0);
  const restoreState = aiRestore.game.snapshot();
  const restoreAccepted = aiRestore.game.onRestore(restoreState);
  check('restore clears the pending AI timeout and preserves the authoritative snapshot',
    restoreAccepted === true && aiRestore.jobs.size === 0 && JSON.stringify(aiRestore.game.snapshot()) === JSON.stringify(restoreState));
  aiRestore.game.destroy();

  const aiDestroyed = run({ reducedMotion:true, opts:{ ai:new Set([1]) } });
  aiDestroyed.game.onMove([7,7], 0);
  aiDestroyed.game.destroy();
  check('destroy clears a pending AI timeout', aiDestroyed.jobs.size === 0);

  const aiReplacement = run({ reducedMotion:true, opts:{ ai:new Set([0,1]) } });
  aiReplacement.game.onMove([7,7], 0);
  const firstAiTimer = [...aiReplacement.jobs.keys()][0];
  aiReplacement.game.onMove([7,8], 1);
  const secondAiTimer = [...aiReplacement.jobs.keys()][0];
  check('a replacement AI schedule clears the prior timer before registering one current job',
    aiReplacement.jobs.size === 1 && secondAiTimer !== firstAiTimer && aiReplacement.game.snapshot().hist.length === 2);
  aiReplacement.game.destroy();

  const reset = run();
  reset.game.onMove([7,7], 0);
  reset.game.onRestart();
  reset.flush();
  check('reset invalidates old process callbacks and returns directly to a clean turn',
    reset.game.getPresentationState().process === 'turn' && reset.jobs.size === 0 && reset.game.snapshot().hist.length === 0);
  reset.game.destroy();

  const terminal = run();
  [[7,3],[0,0],[7,4],[0,1],[7,5],[0,2],[7,6],[0,3],[7,7]].forEach(move => terminal.game.onMove(move));
  check('winning placement begins the terminal process chain', terminal.game.getPresentationState().process === 'place' && terminal.game.getPresentationState().terminal === true);
  const staleDuringLine = terminal.game.onRestore({ hist:[[7,7]], cur:1, over:false, last:[7,7] });
  check('a late nonterminal restore cannot interrupt a pending terminal line', staleDuringLine === false && terminal.game.getPresentationState().process === 'place');
  terminal.flush();
  check('winning line settles at terminal after its local process sequence', terminal.game.getPresentationState().process === 'terminal');
  const staleRestore = terminal.game.onRestore({ hist:[[7,7]], cur:1, over:false, last:[7,7] });
  check('a late nonterminal restore cannot downgrade a terminal result', staleRestore === false && terminal.game.getPresentationState().process === 'terminal');
  terminal.game.destroy();

  const restored = run();
  const terminalState = { hist:[[7,3],[0,0],[7,4],[0,1],[7,5],[0,2],[7,6],[0,3],[7,7]], cur:0, over:true, last:[7,7] };
  restored.game.onRestore(terminalState);
  check('restore enters terminal directly and leaves no old visual callback queued', restored.game.getPresentationState().process === 'terminal' && restored.jobs.size === 0);
  restored.game.setSpectators(true);
  check('spectator state cannot downgrade a restored terminal', restored.game.getPresentationState().process === 'terminal');
  restored.game.destroy();

  const remote = run({ opts:{ online:true, myIdx:0, spectator:true } });
  remote.game.onMove([7,7], 0);
  remote.flush();
  check('spectator and online moves share the disposable stable process path', remote.game.getPresentationState().process === 'turn' && remote.game.snapshot().hist.length === 1);
  remote.game.destroy();

  const ai = run({ opts:{ ai:new Set([1]) } });
  ai.game.onMove([7,7], 0);
  ai.flushThrough(1400);
  const aiLabel = findByClass(ai.area, 'gomoku-wave-c-process-label');
  check('AI thinking keeps the rail at a stable local turn without changing its rule snapshot',
    ai.game.getPresentationState().process === 'turn' && aiLabel && /ai_thinking/.test(aiLabel.textContent) && ai.game.snapshot().hist.length === 1);
  ai.game.destroy();

  const reduced = run({ reducedMotion:true });
  reduced.game.onMove([7,7], 0);
  check('reduced motion goes directly to stable turn with no process timer', reduced.game.getPresentationState().process === 'turn' && reduced.jobs.size === 0);
  reduced.game.destroy();
} catch (error) {
  check('Gomoku Wave C runtime harness executes', false, error && error.stack || String(error));
}

if (failures.length) {
  console.error('GAME_STAGE_DENSITY_PROCESS_GOMOKU_FAILURES=' + failures.length);
  process.exitCode = 1;
} else {
  console.log('GAME_STAGE_DENSITY_PROCESS_GOMOKU_ALL_PASS');
}
