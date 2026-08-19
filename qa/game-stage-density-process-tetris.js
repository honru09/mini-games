'use strict';

// Wave C is deliberately presentation-only.  This runtime contract uses a
// controllable clock so it can prove that process timers never leak into the
// 18×10 rule snapshot, Authority payloads, Replay idle state, or a later game
// instance.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const UTILS = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '01-utils.js'), 'utf8');
const TETRIS = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tetris.js'), 'utf8');
let failures = 0;

function check(name, value, detail){
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

function makeClock(){
  let now = 1000, nextId = 1;
  const tasks = new Map();
  function createTask(callback, delay, interval){
    const id = { id:nextId++, unref(){ return this; } };
    tasks.set(id, { callback, due:now + Math.max(0, Number(delay) || 0), interval:Math.max(0, Number(interval) || 0) });
    return id;
  }
  function clear(id){ tasks.delete(id); }
  function advance(ms){
    const target = now + Math.max(0, Number(ms) || 0);
    let guard = 0;
    while (guard++ < 20000){
      let selected = null, selectedTask = null;
      for (const [id, task] of tasks){
        if (task.due <= target && (!selectedTask || task.due < selectedTask.due || (task.due === selectedTask.due && id.id < selected.id))){
          selected = id; selectedTask = task;
        }
      }
      if (!selectedTask) break;
      now = selectedTask.due;
      if (selectedTask.interval) selectedTask.due += selectedTask.interval;
      else tasks.delete(selected);
      selectedTask.callback();
    }
    now = target;
  }
  return {
    now:() => now,
    setTimeout:(callback, delay) => createTask(callback, delay, 0),
    clearTimeout:clear,
    setInterval:(callback, delay) => createTask(callback, delay, delay),
    clearInterval:clear,
    advance,
    runUntil(predicate, maxMs){
      const limit = now + (maxMs === undefined ? 5000 : maxMs);
      while (!predicate() && now < limit) advance(Math.min(25, limit - now));
      return !!predicate();
    },
    size:() => tasks.size,
    pendingTimeouts:() => [...tasks.values()].filter(task => !task.interval).length,
  };
}

function makeElement(tag){
  const classes = new Set();
  const style = {
    setProperty(key, value){ this[key] = String(value); },
    removeProperty(key){ delete this[key]; },
  };
  const node = {
    tagName:String(tag || 'div').toUpperCase(), children:[], parent:null, style, dataset:{}, attributes:{}, textContent:'',
    clientWidth:560, clientHeight:560, width:0, height:0, _listeners:{},
    appendChild(child){ if (child){ child.parent = this; this.children.push(child); } return child; },
    remove(){ if (!this.parent) return; const index = this.parent.children.indexOf(this); if (index >= 0) this.parent.children.splice(index, 1); this.parent = null; },
    setAttribute(key, value){ this.attributes[key] = String(value); if (String(key).startsWith('data-')) this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = String(value); },
    getAttribute(key){ return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    removeAttribute(key){ delete this.attributes[key]; if (String(key).startsWith('data-')) delete this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())]; },
    addEventListener(type, listener){ (this._listeners[type] = this._listeners[type] || []).push(listener); },
    removeEventListener(){},
    getBoundingClientRect(){ return { left:0, top:0, width:520, height:520 }; },
    querySelector(selector){ return query(this, selector, false); },
    querySelectorAll(selector){ return query(this, selector, true); },
  };
  Object.defineProperty(node, 'innerHTML', { get(){ return ''; }, set(_value){ this.children.forEach(child => { child.parent = null; }); this.children = []; } });
  Object.defineProperty(node, 'className', { get(){ return [...classes].join(' '); }, set(value){ classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(item => classes.add(item)); } });
  node.classList = {
    add(...items){ items.forEach(item => classes.add(item)); },
    remove(...items){ items.forEach(item => classes.delete(item)); },
    contains(item){ return classes.has(item); },
    toggle(item, force){ const on = force === undefined ? !classes.has(item) : !!force; if (on) classes.add(item); else classes.delete(item); return on; },
  };
  return node;
}

function matches(node, selector){
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  const data = /^\[data-([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (data){
    const key = data[1].replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    return Object.prototype.hasOwnProperty.call(node.dataset, key) && (data[2] === undefined || node.dataset[key] === data[2]);
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function query(root, selector, all){
  const found = [], queue = (root.children || []).slice();
  while (queue.length){
    const node = queue.shift();
    if (matches(node, selector)){ if (!all) return node; found.push(node); }
    queue.push(...(node.children || []));
  }
  return all ? found : null;
}

function createRuntime(settings){
  settings = settings || {};
  const clock = makeClock();
  const area = makeElement('div');
  const extra = makeElement('div');
  const botActions = [];
  const documentListeners = {};
  class FakeDate extends Date {
    constructor(...args){ super(...(args.length ? args : [clock.now()])); }
    static now(){ return clock.now(); }
  }
  const document = {
    body:makeElement('body'), documentElement:makeElement('html'), createElement:makeElement,
    getElementById(){ return null; }, querySelectorAll(){ return []; },
    addEventListener(type, listener){ (documentListeners[type] = documentListeners[type] || []).push(listener); },
    removeEventListener(){},
  };
  const sandbox = {
    console, JSON, Date:FakeDate, Map, Set, Array, Number, String, Boolean, Object, Math, document,
    localStorage:{ getItem(){ return settings.waveB === '0' ? '0' : null; } },
    navigator:{ maxTouchPoints:0 }, location:{ protocol:'http:', host:'localhost:8080' },
    setTimeout:clock.setTimeout, clearTimeout:clock.clearTimeout, setInterval:clock.setInterval, clearInterval:clock.clearInterval,
    fetch:async(_url, init) => ({ ok:true, status:200, json:async() => ({ choice:JSON.parse(String(init && init.body || '{}')).options?.[0] }) }),
    prefersReducedMotion(){ return !!settings.reducedMotion; },
    TetrisRules:settings.tetrisRules,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = { devicePixelRatio:1, location:sandbox.location, matchMedia:() => ({ matches:!!settings.reducedMotion }) };
  const context = vm.createContext(sandbox);
  vm.runInContext(UTILS, context, { filename:'01-utils.js' });
  vm.runInContext(`
    function t(key,...args){ return String(key) + (args.length ? '(' + args.join(',') + ')' : ''); }
    function renderPlayers(){} function setStatus(){} function resolveServer(){ return ''; }
    function aiPersonaMove(length,best){ return Math.max(0,Math.min(length-1,best)); }
    function shareGameLink(){} function showVictoryOverlay(){} function playFeedback(){} function toast(){}
    const account={authToken:'qa'}; const online={room:null,isHost:false};
  `, context);
  vm.runInContext(TETRIS, context, { filename:'tetris.js' });
  context.__area = area; context.__extra = extra;
  const online = !!settings.online;
  const gameplayMeta = settings.gameplayMeta || (online ? { protocol:'tetris-battle-authority-v1', startAt:clock.now(), matchEndAt:clock.now() + 60000, matchSeed:'density-process' } : null);
  const shared = {
    ai:new Set(settings.aiSlots || []), online, spectator:!!settings.spectator, myIdx:0, hostIdx:0, isHost:true,
    matchId:'density-process', gameplayMeta, matchDurationMs:60000, onEnd(){},
    sendMove(){}, sendRestart(){}, sendTetrisLockClaim(){}, sendTetrisKOClaim(){}, sendTetrisState(){}, sendTetrisAction(){}, sendBotTetrisAction(seatId,action){botActions.push({seatId,action});},
    getMatchId(){ return 'density-process'; }, isReplaying(){ return !!settings.replaying; },
  };
  context.__shared = shared;
  const game = vm.runInContext('gameTetris(__area,__extra,2,__shared)', context);
  return { area, extra, game, clock, context, botActions };
}

function control(runtime, id){
  const node = runtime.extra.querySelector('[data-tetris-control="' + id + '"]');
  if (!node || !node._listeners.click || !node._listeners.click[0]) return false;
  node._listeners.click[0]({ preventDefault(){} });
  return true;
}

function process(runtime){ return runtime.area.dataset.tetrisProcess || ''; }

function armSingleClear(runtime, extraState){
  const snapshot = runtime.game.snapshot();
  const well = Array.from({ length:18 }, () => Array(10).fill(0));
  for (let column = 0; column < 6; column++) well[17][column] = 1;
  snapshot.wells[0] = well;
  Object.assign(snapshot.states[0], {
    active:{ kind:0, rotation:0, x:6, y:16 }, queue:[1,2,3,4], bagIndex:1, hold:null, canHold:true,
    score:0, lines:0, level:1, combo:-1, backToBack:false, backToBackCount:0, tSpins:0, tetrises:0, perfectClears:0,
    lastAction:null, scoringVersion:'advanced-battle-score-v1', tetrisCount:0, placementSeq:0, alive:true, koTime:null,
    koConfirmed:false, placement:0, fallMs:0, incoming:[], garbageSent:0, garbageReceived:0,
  }, extraState || {});
  return runtime.game.onRestore(snapshot);
}

function rulePlayer(id, event){
  return {
    player:id, seq:id === 0 ? 1 : 0, hash:'density-' + id,
    state:{
      protocol:'tetris-rule-v3', scoringVersion:'advanced-battle-score-v1', seed:'density-process', player:id,
      board:Array.from({ length:18 }, () => Array(10).fill(0)), active:{ kind:id, rotation:0, x:3, y:0 }, queue:[0,1,2,3], bagIndex:1,
      hold:null, canHold:true, score:id === 0 ? 100 : 0, lines:id === 0 ? 1 : 0, level:1, combo:id === 0 ? 0 : -1,
      backToBack:false, backToBackCount:0, tSpins:0, tetrises:0, perfectClears:0, lastAction:null,
      pieces:id === 0 ? 1 : 0, terminal:false, reason:null, lastEvent:event || null,
    },
    incoming:[], alive:true, koTime:null, placement:0,
  };
}

async function run(){
  const paintStart = TETRIS.indexOf('function paintTetrisWaveCProcess');
  const paintEnd = TETRIS.indexOf('function syncTetrisWaveCStage', paintStart);
  const paintBody = paintStart >= 0 && paintEnd > paintStart ? TETRIS.slice(paintStart, paintEnd) : '';
  const processRegionEnd = TETRIS.indexOf('const PRESENTATION_KEYS', paintStart);
  const processRegion = paintStart >= 0 && processRegionEnd > paintStart ? TETRIS.slice(paintStart, processRegionEnd) : '';
  check('Wave C declares the full disposable Tetris process chain',
    /TETRIS_WAVE_C_PROCESS_STEPS[\s\S]*spawn[\s\S]*fall[\s\S]*move[\s\S]*rotate[\s\S]*lock[\s\S]*line-clear[\s\S]*combo[\s\S]*b2b[\s\S]*t-spin[\s\S]*perfect-clear[\s\S]*garbage[\s\S]*terminal/.test(TETRIS));
  check('Wave C forbids ScrollTrigger and keeps the process outside snapshot/serialize fields',
    !/ScrollTrigger/.test(TETRIS) && !/tetrisWaveCProcess[^\n]{0,180}(?:states:|wells:|serialize:)/.test(TETRIS));
  check('Wave C paint writes only data/ARIA state and leaves Motion tokens to Master CSS',
    !!paintBody && !/\.style|\b(?:duration|ease|transition|opacity|transform|background)\b/i.test(paintBody), paintBody);
  check('Wave C process steps expose stable data identity and decorative aria state',
    /tetris-process-active/.test(paintBody) && /tetris-process-index/.test(paintBody) && /aria-hidden/.test(processRegion));

  let runtime = createRuntime();
  const initialLayout = runtime.area.querySelector('.tetris-battle-layout');
  const initialWell = runtime.area.querySelector('.main-board');
  const controls = runtime.extra.querySelectorAll('[data-tetris-control]');
  check('Wave C mounts a localized process rail alongside the Wave B arena without replacing its main well',
    runtime.area.classList.contains('tetris-wave-c') && !!runtime.area.querySelector('.tetris-wave-c-process') && process(runtime) === 'spawn' && !!initialWell,
    JSON.stringify({ root:runtime.area.className, process:process(runtime), rail:!!runtime.area.querySelector('.tetris-wave-c-process'), well:!!initialWell }));
  check('Wave C preserves all seven movable Tetris controls and their identity', controls.length === 7);
  check('Wave C process remains disposable outside the 18×10 snapshot and serialize payload',
    !/tetrisWaveC|tetris-process|wave-c/i.test(JSON.stringify(runtime.game.snapshot())) && !/tetrisWaveC|tetris-process|wave-c/i.test(JSON.stringify(runtime.game.serialize())));
  let idle = false;
  runtime.game.whenIdle().then(() => { idle = true; });
  await Promise.resolve();
  check('Wave C decorative timers do not block whenIdle or Replay timing', idle && runtime.clock.pendingTimeouts() > 0);

  const moved = control(runtime, 'left');
  check('player input exposes move process without rebuilding keyed Arena or controls', moved && process(runtime) === 'move' && runtime.area.querySelector('.tetris-battle-layout') === initialLayout && runtime.area.querySelector('.main-board') === initialWell && runtime.extra.querySelectorAll('[data-tetris-control]').every((node, index) => node === controls[index]));
  const rotated = control(runtime, 'rotate-cw');
  check('rotation supersedes a queued move process and remains explicit', rotated && process(runtime) === 'rotate');
  check('move and rotate settle into an active falling state', runtime.clock.runUntil(() => process(runtime) === 'fall') && process(runtime) === 'fall');

  check('restore accepts a legal pending-clear state', armSingleClear(runtime));
  const lockStarted = control(runtime, 'hard-drop');
  const lockSeen = lockStarted && process(runtime) === 'lock';
  const clearSeen = runtime.clock.runUntil(() => process(runtime) === 'line-clear');
  check('lock transitions through an explicit line-clear process', lockSeen && clearSeen);
  runtime.game.destroy();

  runtime = createRuntime();
  armSingleClear(runtime);
  control(runtime, 'hard-drop');
  const resetHadQueuedLock = process(runtime) === 'lock' && runtime.clock.pendingTimeouts() > 0;
  runtime.game.onRestart();
  runtime.clock.advance(500);
  check('reset invalidates an older lock/clear sequence before it can overwrite the new spawn', resetHadQueuedLock && process(runtime) === 'fall');
  runtime.game.destroy();

  // AI timers are instance-local work, not part of a Tetris snapshot.  A
  // restore must invalidate the old delayed callback and leave exactly one
  // fresh timer for a live, non-Replay state.
  const liveAI = createRuntime({ aiSlots:[1] });
  const liveSnapshot = liveAI.game.snapshot();
  const queuedBeforeRestore = liveAI.clock.pendingTimeouts();
  liveAI.game.onRestore(liveSnapshot);
  const queuedAfterRestore = liveAI.clock.pendingTimeouts();
  liveAI.clock.advance(2500);
  await Promise.resolve(); await Promise.resolve();
  const livePieceCount = liveAI.game.snapshot().pieceCount;
  check('AI restore cancels the stale timer and reschedules one live timer without duplicate placement',
    queuedBeforeRestore > queuedAfterRestore && queuedAfterRestore === 1 && livePieceCount === 1 && liveAI.clock.pendingTimeouts() === 1,
    JSON.stringify({ queuedBeforeRestore, queuedAfterRestore, livePieceCount, pending:liveAI.clock.pendingTimeouts() }));
  liveAI.game.destroy();

  const replayAI = createRuntime({ aiSlots:[1], replaying:true });
  const replayBefore = replayAI.game.snapshot();
  replayAI.clock.advance(3000);
  await Promise.resolve(); await Promise.resolve();
  check('Replay mode never auto-places an AI piece',
    replayAI.game.snapshot().pieceCount === replayBefore.pieceCount && replayAI.clock.pendingTimeouts() === 0);
  replayAI.game.destroy();

  const replayAuthority = createRuntime({
    online:true, aiSlots:[1], replaying:true,
    gameplayMeta:{ protocol:'tetris-rule-v3', startAt:1000, matchEndAt:61000, matchSeed:'density-replay-authority' },
    tetrisRules:{},
  });
  replayAuthority.clock.advance(3000);
  await Promise.resolve(); await Promise.resolve();
  check('Replay authority mode never emits a bot Tetris action',
    replayAuthority.botActions.length === 0 && replayAuthority.game.snapshot().pieceCount === 0,
    JSON.stringify(replayAuthority.botActions));
  replayAuthority.game.destroy();

  const destroyedAI = createRuntime({ aiSlots:[1] });
  destroyedAI.game.destroy();
  check('destroy clears delayed AI work together with game timers', destroyedAI.clock.size() === 0, String(destroyedAI.clock.size()));

  const authorityAI = createRuntime({
    online:true, aiSlots:[1],
    gameplayMeta:{ protocol:'tetris-rule-v3', startAt:1000, matchEndAt:61000, matchSeed:'density-live-authority' },
    tetrisRules:{},
  });
  const authorityRule = {
    protocol:'tetris-rule-v3', matchId:'density-process', startAt:1000, matchEndAt:61000, matchSeed:'density-live-authority', rulesetVersion:'tetris-rule-v3',
    revision:1, serverNow:1000, players:[rulePlayer(0),rulePlayer(1)], finished:false, order:null, inputCount:0,
  };
  authorityAI.game.onTetrisRuleState(authorityRule);
  authorityAI.clock.advance(500);
  const authorityQueued = authorityAI.clock.pendingTimeouts();
  authorityAI.clock.advance(2000);
  await Promise.resolve(); await Promise.resolve();
  check('live authority restore reschedules one bot action without duplicate timers',
    authorityQueued === 1 && authorityAI.botActions.length === 1 && authorityAI.clock.pendingTimeouts() === 0,
    JSON.stringify({ authorityQueued, botActions:authorityAI.botActions.length, pending:authorityAI.clock.pendingTimeouts() }));
  authorityAI.game.destroy();

  const scoringRules = {
    detectTSpin(){ return true; },
    resolveLockScore(state, details){
      return {
        clearType:'t-spin-single', tSpin:true, level:Math.max(1, Math.floor(state.lines / 10) + 1), combo:2,
        backToBack:true, backToBackCount:2, backToBackBonus:true, comboBonus:0, perfectClear:true, perfectClearBonus:0,
        scoreDelta:1200, attack:4, attackBreakdown:{ base:4, backToBack:1, combo:1, perfectClear:1 },
      };
    },
  };
  runtime = createRuntime({ tetrisRules:scoringRules });
  armSingleClear(runtime, { combo:1, backToBack:true, backToBackCount:1, tSpins:1, perfectClears:0 });
  control(runtime, 'hard-drop');
  const seen = [process(runtime)];
  for (let index = 0; index < 220; index++){
    runtime.clock.advance(25);
    if (seen[seen.length - 1] !== process(runtime)) seen.push(process(runtime));
  }
  const chain = ['lock','line-clear','t-spin','b2b','combo','perfect-clear'];
  let cursor = -1;
  const ordered = chain.every(step => { cursor = seen.indexOf(step, cursor + 1); return cursor >= 0; });
  check('scoring chain makes T-Spin, B2B, combo and perfect-clear separately actionable', ordered, JSON.stringify(seen));
  runtime.game.queueGarbage(0, 2, 1, 'density-garbage-1');
  check('incoming garbage enters its own presentation process without touching the rule state shape', process(runtime) === 'garbage' && runtime.game.snapshot().wells[0].length === 18);
  runtime.game.destroy();

  runtime = createRuntime();
  control(runtime, 'left');
  const pendingBeforeRestore = runtime.clock.pendingTimeouts();
  const restoredSnapshot = runtime.game.snapshot();
  const restored = runtime.game.onRestore(restoredSnapshot);
  check('restore invalidates queued process callbacks and settles directly to a stable state', pendingBeforeRestore > 0 && restored && runtime.clock.pendingTimeouts() === 0 && process(runtime) === 'fall');
  control(runtime, 'rotate-cw');
  const staleSnapshot = runtime.game.snapshot();
  runtime.game.finishMatch();
  runtime.clock.advance(1200);
  check('terminal is monotonic: late process timers cannot lower it', process(runtime) === 'terminal');
  check('a stale non-terminal restore is rejected after terminal outside Replay', runtime.game.onRestore(staleSnapshot) === false && process(runtime) === 'terminal');
  runtime.game.destroy();
  check('destroy clears the process timer set together with game timers', runtime.clock.size() === 0);

  const reduced = createRuntime({ reducedMotion:true });
  const reducedInitial = process(reduced);
  control(reduced, 'left');
  check('reduced-motion reaches the stable fall state without a process timer', reducedInitial === 'fall' && process(reduced) === 'fall' && reduced.clock.pendingTimeouts() === 0);
  reduced.game.destroy();

  const first = createRuntime();
  const second = createRuntime();
  control(first, 'left');
  check('process state is instance-local across concurrent Tetris arenas', process(first) === 'move' && process(second) === 'spawn' && first.area !== second.area);
  first.game.destroy(); second.game.destroy();

  const spectator = createRuntime({ spectator:true });
  check('spectator retains the readable process rail while the seven mutation controls are hidden', !!spectator.area.querySelector('.tetris-wave-c-process') && spectator.extra.querySelector('.tetris-actions').style.display === 'none');
  spectator.game.destroy();

  const authority = createRuntime({ online:true });
  control(authority, 'left');
  const authoritySnapshot = {
    protocol:'tetris-battle-authority-v1', matchId:'density-process', revision:1, startAt:authority.clock.now(), matchEndAt:authority.clock.now() + 60000, matchSeed:'density-process',
    players:[
      { alive:true, koTime:null, placement:0, placementSeq:0, incoming:[], garbageSent:0, garbageReceived:0, lastSeq:0 },
      { alive:true, koTime:null, placement:0, placementSeq:0, incoming:[], garbageSent:0, garbageReceived:0, lastSeq:0 },
    ],
    finished:false, order:null,
  };
  const authorityApplied = authority.game.onBattleSnapshot(authoritySnapshot);
  check('authority snapshot clears late client process timers and restores a stable visible phase', authorityApplied && authority.clock.pendingTimeouts() === 0 && process(authority) === 'fall');
  authority.game.onAuthorityResult({ matchId:'density-process', order:[0,1] });
  const staleAuthority = authority.game.onBattleSnapshot({ ...authoritySnapshot, revision:2 });
  check('late non-terminal authority snapshots cannot downgrade terminal presentation', process(authority) === 'terminal' && staleAuthority === false);
  authority.game.destroy();

  const ruleAuthority = createRuntime({
    online:true, gameplayMeta:{ protocol:'tetris-rule-v3', startAt:1000, matchEndAt:61000, matchSeed:'density-process' }, tetrisRules:{},
  });
  const rulePayload = {
    protocol:'tetris-rule-v3', matchId:'density-process', startAt:1000, matchEndAt:61000, matchSeed:'density-process', rulesetVersion:'tetris-rule-v3',
    revision:1, serverNow:1000, players:[
      rulePlayer(0, { type:'lock', clearType:'single', attack:0, scoreDelta:100, combo:0, backToBackBonus:false, perfectClear:false }),
      rulePlayer(1, null),
    ], finished:false, order:null, inputCount:1,
  };
  Object.assign(rulePayload.players[0].state, { combo:2, backToBack:true, backToBackCount:2, tSpins:1, perfectClears:1 });
  Object.assign(rulePayload.players[0].state.lastEvent, { clearType:'t-spin-single', combo:2, backToBackBonus:true, perfectClear:true });
  check('tetris-rule-v3 snapshots derive an authority-owned lock process without extending the wire payload', ruleAuthority.game.onTetrisRuleState(rulePayload) && process(ruleAuthority) === 'lock');
  const followRulePayload = JSON.parse(JSON.stringify(rulePayload));
  followRulePayload.revision = 2; followRulePayload.players[0].seq = 2; followRulePayload.players[0].state.active.y = 1; followRulePayload.players[0].state.lastEvent = null;
  ruleAuthority.clock.advance(25);
  ruleAuthority.game.onTetrisRuleState(followRulePayload);
  check('a newer authority gravity snapshot cannot erase the active scoring chain', ruleAuthority.clock.runUntil(() => process(ruleAuthority) === 'perfect-clear'));
  ruleAuthority.game.onTetrisRuleResult({ type:'tetris_rule_result', matchId:'density-process', protocol:'tetris-rule-v3', scoringVersion:'advanced-battle-score-v1', revision:3, serverNow:1000, order:[0,1], stats:[] });
  check('tetris-rule-v3 terminal ignores a subsequent stale non-terminal snapshot', ruleAuthority.game.onTetrisRuleState({ ...followRulePayload, revision:4 }) === false && process(ruleAuthority) === 'terminal');
  ruleAuthority.game.destroy();
}

run().catch(error => {
  check('Wave C Tetris runtime matrix executes', false, error && error.stack || String(error));
}).finally(() => {
  if (failures){ console.error('GAME_STAGE_DENSITY_PROCESS_TETRIS_FAILURES=' + failures); process.exitCode = 1; }
  else console.log('GAME_STAGE_DENSITY_PROCESS_TETRIS_ALL_PASS');
});
