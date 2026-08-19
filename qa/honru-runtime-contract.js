'use strict';

// Honru Runtime Integration P2 专项契约：所有者清除后默认开启、显式回滚、失败回退、生命周期与规则隔离。
// 零依赖；动态 VM DOM 覆盖运行时行为，静态断言固定跨模块边界。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const TEMPLATE = read('public/index-template.html');
const ASSETS = read('public/src/core/06-assets.js');
const SHELL = read('public/src/core/02-app-shell.js');
const UTILS = read('public/src/core/01-utils.js');
const FRAMEWORK = read('public/src/core/03-game-framework.js');
const ROSTER = read('public/src/ui/07-roster.js');
const ONLINE = read('public/src/online/03-websocket.js');
const REWARD = read('server/reward-engine.js');
const PROTOCOL = read('server/gameplay/protocol.js');
const TETRIS_RULES = read('shared/rules/tetris.js');
const GAME_FILES = ['gomoku.js', 'ludo.js', 'monopoly.js', 'tank.js', 'tetris.js', 'xiangqi.js'];
const GAME_SOURCES = Object.fromEntries(GAME_FILES.map(file => [file, read('public/src/games/' + file)]));
const SHARED_RULE_SOURCES = ['tetris.js', 'xiangqi.js', 'monopoly.js'].map(file => read('shared/rules/' + file));
const failures = [];

function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

function context2d(){
  const gradient = { addColorStop(){} };
  return new Proxy({}, { get(target, key){
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (!(key in target)) target[key] = () => undefined;
    return target[key];
  }, set(target, key, value){ target[key] = value; return true; } });
}

function makeElement(tag, imageDecode){
  const classes = new Set();
  const style = { setProperty(key, value){ this[key] = value; }, removeProperty(key){ delete this[key]; } };
  const node = {
    tagName: String(tag || 'div').toUpperCase(), children: [], parent: null,
    style, dataset: {}, attributes: {}, textContent: '', disabled: false, hidden: false,
    clientWidth: 560, clientHeight: 560, width: 0, height: 0, _listeners: {}, _html: '', id: '',
    appendChild(child){ if (child){ child.parent = this; this.children.push(child); } return child; },
    removeChild(child){ const index = this.children.indexOf(child); if (index >= 0){ this.children.splice(index, 1); child.parent = null; } return child; },
    remove(){ if (this.parent) this.parent.removeChild(this); },
    setAttribute(key, value){ this.attributes[key] = String(value); if (key === 'id') this.id = String(value); },
    getAttribute(key){ if (key === 'id') return this.id || null; return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    removeAttribute(key){ delete this.attributes[key]; },
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener(type, fn){ const list = this._listeners[type] || []; const index = list.indexOf(fn); if (index >= 0) list.splice(index, 1); },
    dispatch(type, event){ for (const fn of this._listeners[type] || []) fn(event || {}); },
    getContext(){ return context2d(); },
    getBoundingClientRect(){ return { left:0, top:0, width:520, height:520 }; },
    querySelector(selector){ return query(this, selector, false); },
    querySelectorAll(selector){ return query(this, selector, true); },
    closest(selector){ let current = this; while (current){ if (matches(current, selector)) return current; current = current.parent; } return null; },
    focus(){}, select(){},
  };
  if (node.tagName === 'IMG' && imageDecode) node.decode = () => imageDecode(node);
  Object.defineProperty(node, 'isConnected', { get(){ let current = this; while (current){ if (current.__documentRoot) return true; current = current.parent; } return false; } });
  Object.defineProperty(node, 'childNodes', { get(){ return this.children; } });
  Object.defineProperty(node, 'innerHTML', { get(){ return this._html; }, set(value){ this._html = String(value); this.children.forEach(child => { child.parent = null; }); this.children = []; } });
  Object.defineProperty(node, 'className', { get(){ return [...classes].join(' '); }, set(value){ classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(item => classes.add(item)); } });
  node.classList = {
    add: (...values) => values.forEach(value => classes.add(value)),
    remove: (...values) => values.forEach(value => classes.delete(value)),
    contains: value => classes.has(value),
    toggle: (value, force) => { const enabled = force === undefined ? !classes.has(value) : !!force; if (enabled) classes.add(value); else classes.delete(value); return enabled; },
  };
  return node;
}

function matches(node, selector){
  if (!node || !selector) return false;
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector.startsWith('.')) return node.classList && node.classList.contains(selector.slice(1));
  const data = /^\[data-([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (data) return node.dataset && Object.prototype.hasOwnProperty.call(node.dataset, data[1]) && (data[2] === undefined || node.dataset[data[1]] === data[2]);
  return String(node.tagName || '').toLowerCase() === selector.toLowerCase();
}

function query(root, selector, all){
  const selectors = String(selector).split(',').map(value => value.trim()).filter(Boolean);
  const found = [], queue = (root.children || []).slice();
  while (queue.length){
    const node = queue.shift();
    if (selectors.some(item => matches(node, item))){ if (!all) return node; found.push(node); }
    queue.push(...(node.children || []));
  }
  return all ? found : null;
}

function localStorageStub(initial){
  const data = new Map(Object.entries(initial || {}));
  return {
    getItem(key){ return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value){ data.set(String(key), String(value)); },
    removeItem(key){ data.delete(String(key)); },
    clear(){ data.clear(); },
    _data: data,
  };
}

function validManifest(){
  const states = ['idle','thinking','surprised','win','lose','recover','waiting-invite','check-in','playful'];
  return { assets:[{
    asset_id:'P-HONRU-STATES-V1', runtime_id:'honru', status:'ready', clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',
    feature_flags:{ operator:'all', enabled_value:'1', default_enabled:true, ids:['mg_art_honru_states_v1','mg_art_honru_game_reactions_v1'] },
    variants:Object.fromEntries(states.map(state => [state, 'public/assets/brand/honru/states-v1/honru-' + state + '-v1.webp'])),
  }] };
}

function runtimeHarness(){
  let manifest = validManifest();
  let decodeMode = 'resolve';
  let decodeResolve = null;
  const timers = new Map(); let timerId = 0;
  const storage = localStorageStub();
  const imageDecode = () => {
    if (decodeMode === 'reject') return Promise.reject(new Error('decode rejected'));
    if (decodeMode === 'defer') return new Promise(resolve => { decodeResolve = resolve; });
    return Promise.resolve();
  };
  const body = makeElement('body', imageDecode); body.__documentRoot = true;
  const html = makeElement('html', imageDecode); html.__documentRoot = true;
  const board = makeElement('div', imageDecode); board.id = 'board-area'; body.appendChild(board);
  const screenHub = makeElement('section', imageDecode); screenHub.id = 'screen-hub'; screenHub.classList.add('hidden'); body.appendChild(screenHub);
  const screenGame = makeElement('section', imageDecode); screenGame.id = 'screen-game'; body.appendChild(screenGame);
  const endButton = makeElement('button', imageDecode); endButton.id = 'btn-end-game'; body.appendChild(endButton);
  const document = {
    body, documentElement:html, hidden:false,
    createElement: tag => makeElement(tag, imageDecode),
    getElementById: id => query(body, '#' + id, false),
    querySelector: selector => query(body, selector, false),
    querySelectorAll: selector => query(body, selector, true),
    addEventListener(){}, removeEventListener(){},
  };
  const sandbox = {
    console, JSON, Date, Map, Set, Array, Number, String, Boolean, Object, Math, Promise,
    document, localStorage:storage, navigator:{}, location:{ hash:'', protocol:'http:', host:'localhost:8080' },
    fetch:async () => ({ ok:true, json:async () => manifest }),
    queueMicrotask,
    setTimeout(fn, ms){ const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id){ timers.delete(id); }, setInterval(){ return ++timerId; }, clearInterval(){},
    AbortController, AbortSignal,
    online:{ _replaying:false, room:null, spectatorRoom:null, game:null },
    normalizeTheme:value => value === 'dark' ? 'dark' : 'light',
    THEME_LIST:[], currentLang:'zh-CN', account:null, authModalEl:null,
    t:key => String(key), toast(){}, renderRoomPanel(){}, renderGhostHome(){}, renderGhostProfile(){},
    releaseModalScrollLock(){}, resolveServer(){ return ''; }, openAuthModal(){}, setLanguage:async () => true,
  };
  sandbox.window = { devicePixelRatio:1, location:sandbox.location, matchMedia:() => ({ matches:false }), addEventListener(){} };
  sandbox.$ = id => document.getElementById(id);
  sandbox.el = (tag, className, text) => { const node = document.createElement(tag); node.className = className || ''; if (text !== undefined) node.textContent = String(text); return node; };
  sandbox.elRaw = sandbox.el;
  const context = vm.createContext(sandbox);
  vm.runInContext(ASSETS, context, { filename:'06-assets.js' });
  vm.runInContext(SHELL, context, { filename:'02-app-shell.js' });
  vm.runInContext(FRAMEWORK, context, { filename:'03-game-framework.js' });
  return {
    context, document, body, board, storage, timers,
    setManifest(value){ manifest = value; vm.runInContext('runtimeAssetManifestPromise=null', context); },
    setDecodeMode(value){ decodeMode = value; },
    resolveDecode(){ if (decodeResolve){ const resolve = decodeResolve; decodeResolve = null; resolve(); } },
  };
}

function gameplayHarness(file, factory, count){
  const storage = localStorageStub();
  const body = makeElement('body'); body.__documentRoot = true;
  const area = makeElement('div'); area.id = 'board-area'; body.appendChild(area);
  const extra = makeElement('div'); body.appendChild(extra);
  const listeners = {};
  const document = {
    body, documentElement:makeElement('html'), hidden:false, createElement:makeElement,
    getElementById:id => id === 'toast-wrap' ? body : query(body, '#' + id, false),
    querySelector:selector => query(body, selector, false), querySelectorAll:selector => query(body, selector, true),
    addEventListener(type, fn){ (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn){ const list = listeners[type] || []; const index = list.indexOf(fn); if (index >= 0) list.splice(index, 1); },
  };
  const sandbox = {
    console, JSON, Date, Map, Set, Array, Number, String, Boolean, Object, Math,
    document, localStorage:storage, navigator:{ maxTouchPoints:0 }, location:{ protocol:'http:', host:'localhost:8080' },
    setTimeout, clearTimeout, setInterval, clearInterval, AbortController, AbortSignal,
    fetch:async (_url, init) => { const request = JSON.parse(String(init && init.body || '{}')); return { ok:true, status:200, json:async () => ({ choice:request.options && request.options[0] }) }; },
    __area:area, __extra:extra, __feedback:[],
  };
  sandbox.window = { devicePixelRatio:1, location:sandbox.location, matchMedia:queryValue => ({ matches:queryValue === '(prefers-reduced-motion: reduce)' }) };
  const context = vm.createContext(sandbox);
  vm.runInContext(UTILS, context, { filename:'01-utils.js' });
  vm.runInContext(ASSETS, context, { filename:'06-assets.js' });
  vm.runInContext(`
    function t(key,...args){return String(key)+(args.length?'('+args.join(',')+')':'');}
    function renderPlayers(){} function setStatus(){} function resolveServer(){return '';}
    function aiPersonaMove(length,best){return Math.max(0,Math.min(length-1,best));}
    function aiSpeak(){} function shareGameLink(){} function openInvitePicker(){}
    const account={authToken:'qa'}; const online={room:null,isHost:false,_replaying:false};
    playFeedback=(kind,context)=>__feedback.push({kind,context});
    triggerHonruGameReaction=(kind,context)=>__feedback.push({kind,context});
  `, context, { filename:'honru-game-prelude.js' });
  if (file === 'tetris.js') vm.runInContext(TETRIS_RULES, context, { filename:'shared/rules/tetris.js' });
  vm.runInContext(GAME_SOURCES[file], context, { filename:file });
  const opts = { ai:new Set(), onEnd(){}, sendMove(){}, sendRestart(){}, isReplaying(){ return false; }, online:false, myIdx:0, isHost:true, destroyed:false };
  context.__opts = opts;
  const game = vm.runInContext(`${factory}(__area,__extra,${count},__opts)`, context, { filename:file + ':factory' });
  return { context, storage, area, extra, game, opts, feedback:sandbox.__feedback };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

async function run(){
  check('Honru 仅保留品牌、签到与局内反应，前端不再提供助手聊天',
    !/id="(?:chat-tab-honru|honru-chat-view|honru-dock|companion-form|companion-input)"|btn-home-honru/.test(TEMPLATE) &&
    /function petHonru\(\)[\s\S]*?type:'companion_checkin'/.test(SHELL) &&
    !/\/api\/companion|sendCompanion|renderCompanion/.test(SHELL));
  const runtime = runtimeHarness();
  const enabled = () => vm.runInContext('honruStatesEnabled()', runtime.context);
  const reactionsEnabled = () => vm.runInContext('honruGameReactionsEnabled()', runtime.context);
  const resolveState = state => { runtime.context.__state = state; return vm.runInContext('resolveHonruStateUrl(__state)', runtime.context); };

  const flagValues = [undefined, '', '0', '1', 'true'];
  let matrixOk = true;
  for (const master of flagValues){
    for (const game of flagValues){
      runtime.storage.clear();
      if (master !== undefined) runtime.storage.setItem('mg_art_honru_states_v1', master);
      if (game !== undefined) runtime.storage.setItem('mg_art_honru_game_reactions_v1', game);
      const expectedState = master === undefined || master === '1';
      const expectedReaction = expectedState && (game === undefined || game === '1');
      if (enabled() !== expectedState || reactionsEnabled() !== expectedReaction) matrixOk = false;
    }
  }
  check('所有者清除双旗标矩阵：缺失默认开、显式字符串 1 开、其他值关闭，局内分闸门不连带关闭平台状态', matrixOk);
  runtime.context.localStorage = { getItem(){ return 1; } };
  check('非字符串数值 1 不能绕过严格旗标判断', enabled() === false);
  runtime.context.localStorage = { getItem(){ throw new Error('blocked storage'); } };
  check('localStorage 异常时默认关闭', enabled() === false);
  runtime.context.localStorage = runtime.storage;
  runtime.storage.setItem('mg_art_honru_states_v1', '1');
  runtime.storage.setItem('mg_art_honru_game_reactions_v1', '1');

  check('未知状态 ID 被资产解析层拒绝', await resolveState('../win') === '' && await resolveState('victory') === '');
  runtime.setManifest({ assets:'not-an-array' });
  check('坏 Manifest 静默拒绝且不产生路径', await resolveState('win') === '');
  const traversal = validManifest();
  traversal.assets[0].variants.win = 'public/assets/brand/honru/states-v1/../../secret.webp';
  runtime.setManifest(traversal);
  check('Manifest 越界/路径替换被精确路径合同拒绝', await resolveState('win') === '');
  runtime.setManifest(validManifest());
  check('合法 Manifest 只返回版本化本地当前状态路径', await resolveState('win') === 'assets/brand/honru/states-v1/honru-win-v1.webp');

  runtime.body.classList.add('game-active');
  runtime.setDecodeMode('reject');
  const fallbackImage = runtime.document.createElement('img'); fallbackImage.src = 'assets/brand/honru-mascot-v1.svg';
  runtime.context.__image = fallbackImage;
  const rejected = await vm.runInContext("applyHonruStateImage(__image,'win')", runtime.context);
  check('WebP decode reject 时保持旧 v1 fallback 且无裸错误', rejected === false && fallbackImage.src === 'assets/brand/honru-mascot-v1.svg' && fallbackImage.dataset.honruState === 'fallback',
    JSON.stringify({ rejected, src:fallbackImage.src, state:fallbackImage.dataset.honruState }));

  runtime.setDecodeMode('defer');
  const pendingImage = runtime.document.createElement('img'); pendingImage.src = 'assets/brand/honru-mascot-v1.svg'; runtime.context.__image = pendingImage;
  const pending = vm.runInContext("applyHonruStateImage(__image,'thinking')", runtime.context);
  for (let i = 0; i < 8; i++) await tick();
  runtime.storage.setItem('mg_art_honru_states_v1', '0');
  runtime.resolveDecode();
  const revoked = await pending;
  check('资源加载期间关闭素材总开关会取消激活并恢复 v1', revoked === false && pendingImage.src === 'assets/brand/honru-mascot-v1.svg' && pendingImage.dataset.honruState === 'fallback',
    JSON.stringify({ revoked, src:pendingImage.src, state:pendingImage.dataset.honruState }));
  runtime.storage.setItem('mg_art_honru_states_v1', '1');runtime.storage.setItem('mg_art_honru_game_reactions_v1', '1'); runtime.setDecodeMode('resolve');

  runtime.context.online._replaying = true;
  const replayBlocked = vm.runInContext("triggerHonruGameReaction('move')", runtime.context); await tick();
  check('重连 moveLog replay 期间禁止 Honru 反应', replayBlocked === false && !runtime.document.getElementById('honru-game-reaction'));
  runtime.context.online._replaying = false;
  const explicitReplayBlocked = vm.runInContext("triggerHonruGameReaction('move',{replay:true})", runtime.context); await tick();
  check('显式 Replay 上下文同样禁止表现触发', explicitReplayBlocked === false && !runtime.document.getElementById('honru-game-reaction'));

  vm.runInContext("clearHonruGameReaction();triggerHonruGameReaction('win')", runtime.context); await tick(); await tick();
  const winNode = runtime.document.getElementById('honru-game-reaction');
  vm.runInContext("triggerHonruGameReaction('move')", runtime.context); await tick();
  check('终局优先级阻止低优先级高频操作覆盖胜利', winNode && winNode.dataset.honruState === 'win' && runtime.document.getElementById('honru-game-reaction') === winNode);
  vm.runInContext("clearHonruGameReaction();triggerHonruGameReaction('score')", runtime.context); await tick();
  const playfulNode = runtime.document.getElementById('honru-game-reaction');
  vm.runInContext("triggerHonruGameReaction('capture')", runtime.context); await tick();
  const captureNode = runtime.document.getElementById('honru-game-reaction');
  check('P0-08 高优先级 capture Context 可替换 score，同时保留旧 playful fallback 语义', playfulNode && captureNode && captureNode !== playfulNode && captureNode.dataset.honruContext === 'capture' && captureNode.dataset.honruState === 'playful');

  vm.runInContext(`registerGame('honru-contract',()=>({reset(){},destroy(){}}));__instance=createGameInstance('honru-contract',{}, {},2,{})`, runtime.context);
  vm.runInContext("clearHonruGameReaction();triggerHonruGameReaction('place')", runtime.context); await tick();
  vm.runInContext('__instance.restart()', runtime.context);
  check('统一 restart 生命周期清理反应节点和计时器', !runtime.document.getElementById('honru-game-reaction'));
  vm.runInContext("triggerHonruGameReaction('place')", runtime.context); await tick();
  vm.runInContext('__instance.destroy()', runtime.context);
  check('统一 destroy 生命周期清理反应节点和计时器', !runtime.document.getElementById('honru-game-reaction'));
  check('结算 Overlay 的再来一局按钮也清理 Honru 表现层', /const again =[\s\S]*?clearHonruGameReaction\(\)[\s\S]*?opts\.onRestart\(\)/.test(UTILS));

  vm.runInContext(ROSTER.match(/function showHub\(\)\{[\s\S]*?\n\}/)[0], runtime.context, { filename:'showHub-extract.js' });
  vm.runInContext("document.body.classList.add('game-active');triggerHonruGameReaction('place')", runtime.context); await tick();
  vm.runInContext('showHub()', runtime.context);
  check('showHub 离开游戏时清理反应并退出 game-active', !runtime.document.getElementById('honru-game-reaction') && !runtime.body.classList.contains('game-active'));

  const resultFunction = ROSTER.match(/function resultForSlot\(results, slot\)\{[\s\S]*?\n\}/)[0];
  vm.runInContext(resultFunction, runtime.context, { filename:'resultForSlot-extract.js' });
  const outcomes = vm.runInContext(`[
    resultForSlot([{slot:0,coins:1,rank:1},{slot:1,coins:0,rank:2}],0),
    resultForSlot([{slot:0,coins:0,rank:2},{slot:1,coins:1,rank:1}],0),
    resultForSlot([{slot:0,coins:0,rank:1},{slot:1,coins:0,rank:1}],0)
  ]`, runtime.context);
  check('本地结算按当前玩家真实 win/loss/draw 映射', Array.from(outcomes).join(',') === 'win,loss,draw');
  vm.runInContext("document.body.classList.add('game-active');clearHonruGameReaction()", runtime.context);
  const spectatorResult = vm.runInContext("setHonruResultReaction('win',{spectator:true})", runtime.context); await tick();
  const spectatorNode = runtime.document.getElementById('honru-game-reaction');
  check('观众结算使用中性 spectator Context，不显示个人胜负语义', spectatorResult === true && spectatorNode && spectatorNode.dataset.honruContext === 'spectator' && spectatorNode.dataset.honruState === 'waiting-invite');
  check('联机结果仅从服务端 Reward Breakdown result 映射', /setHonruResultReaction\(reward\.result,\s*\{\s*source:'reward',\s*spectator:!!\(online&&online\.isSpectator\)\s*\}\)/.test(ROSTER));
  check('胜利 Overlay 不再无条件触发 Honru win', !/function showVictoryOverlay[\s\S]*?setHonru(?:Result|Game)Reaction\(['"]win['"]/.test(UTILS));

  const ludo = gameplayHarness('ludo.js', 'gameLudo', 2);
  ludo.opts.online = true;
  ludo.game.onMove({ dice:6 }, 0);
  await ludo.game.whenIdle();
  ludo.feedback.length = 0;
  ludo.game.onMove({ ti:99 }, 0);
  check('飞行棋无效选子不触发 Honru/音效反馈', ludo.feedback.length === 0 && ludo.game.snapshot().phase === 'pick');
  ludo.game.onMove({ ti:0 }, 0);
  check('飞行棋反馈只在合法 applyPick 成功后触发', ludo.feedback.length === 1 && ludo.feedback[0].kind === 'place' && ludo.game.snapshot().tokens[0][0] === 0);
  ludo.game.destroy();

  const xiangqi = gameplayHarness('xiangqi.js', 'gameXiangqi', 2);
  const reaction = makeElement('div'); reaction.id = 'honru-game-reaction'; xiangqi.area.appendChild(reaction);
  xiangqi.game.onMove({ from:[6,0], to:[5,0] });
  check('象棋 render 重绘保留 board-area 的 Honru 表现节点', reaction.isConnected && xiangqi.area.children.includes(reaction));
  xiangqi.game.destroy();

  const factories = {
    'gomoku.js':['gameGomoku',2], 'ludo.js':['gameLudo',2], 'monopoly.js':['gameMonopoly',2],
    'tank.js':['gameTank',2], 'tetris.js':['gameTetris',2], 'xiangqi.js':['gameXiangqi',2],
  };
  let snapshotIsolation = true, snapshotNoFields = true;
  for (const [file, [factory, count]] of Object.entries(factories)){
    const harness = gameplayHarness(file, factory, count);
    harness.storage.setItem('mg_art_honru_states_v1', '0');
    harness.storage.setItem('mg_art_honru_game_reactions_v1', '0');
    const before = JSON.stringify(harness.game.snapshot());
    harness.storage.setItem('mg_art_honru_states_v1', '1');
    harness.storage.setItem('mg_art_honru_game_reactions_v1', '1');
    const after = JSON.stringify(harness.game.snapshot());
    snapshotIsolation = snapshotIsolation && before === after;
    snapshotNoFields = snapshotNoFields && !/honru|reaction|presentationState/i.test(after);
    harness.game.destroy();
  }
  check('六款游戏规则 snapshot 在显式关闭与开启前后逐字一致', snapshotIsolation);
  check('六款游戏 snapshot 不含 Honru 表现字段', snapshotNoFields);

  const forbiddenBoundary = /honru(?:State|Reaction)|honru-game-reaction|mg_art_honru/i;
  check('Gameplay 协议注册表不含 Honru 表现字段', !forbiddenBoundary.test(PROTOCOL) && !/honru-(?:state|reaction)/i.test(ONLINE));
  check('奖励解析器不读取 Honru 表现字段', !forbiddenBoundary.test(REWARD));
  check('三套共享 Rule Core 不读取 Honru 表现字段', SHARED_RULE_SOURCES.every(source => !forbiddenBoundary.test(source)));
  check('六游戏只允许象棋 DOM 重绘保留钩子，不把状态写入规则', GAME_FILES.every(file => {
    const hits = GAME_SOURCES[file].match(/honru[^'"\s)]*/ig) || [];
    return file === 'xiangqi.js' ? hits.length === 1 && /honru-game-reaction/.test(GAME_SOURCES[file]) : hits.length === 0;
  }));

  check('playFeedback 对 Honru hook 有异常隔离', /function playFeedback\(kind, context\)[\s\S]*?try\s*\{[\s\S]*?triggerHonruGameReaction\(kind, context\)[\s\S]*?\}\s*catch\s*\{\}/.test(UTILS));
  check('playFeedback 由微任务延后挂载，避免象棋合法动作后的 render 清除', /function triggerHonruGameReaction[\s\S]*?queueMicrotask\(run\)/.test(SHELL));
  check('AI thinking 走共享表现 hook 且不污染学习确认', /function aiSpeak[\s\S]*?kind === 'think'[\s\S]*?triggerHonruGameReaction\('think'/.test(read('public/src/core/05-ai-personas.js')));

  if (failures.length){
    console.error('HONRU_RUNTIME_CONTRACT_FAILURES=' + failures.length + ' :: ' + failures.join('、'));
    process.exitCode = 1;
  } else {
    console.log('HONRU_RUNTIME_CONTRACT_ALL_PASS');
  }
}

run().catch(error => {
  console.error('HONRU_RUNTIME_CONTRACT_CRASH:', error && error.stack || error);
  process.exitCode = 1;
});
