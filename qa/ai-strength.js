// 六款策略升级游戏的行为级 AI 强度回归：真实状态机 + 离线 /api/ai 首选项桩。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const UTILS = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '01-utils.js'), 'utf8');
const ASSETS = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '06-assets.js'), 'utf8');
const failures = [];

function assert(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, description, timeout = 2200){
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline){
    try { if (predicate()) return true; } catch {}
    await sleep(5);
  }
  throw new Error('等待超时：' + description);
}

function makeContext2D(){
  return new Proxy({}, {
    get(target, key){
      if (!(key in target)) target[key] = () => undefined;
      return target[key];
    },
    set(target, key, value){ target[key] = value; return true; },
  });
}

function makeElement(tag){
  const classes = new Set();
  const element = {
    tagName: String(tag || 'div').toUpperCase(), children: [], parent: null,
    style: {}, dataset: {}, attributes: {}, textContent: '', disabled: false,
    clientWidth: 520, clientHeight: 520, width: 0, height: 0, _listeners: {}, _html: '',
    appendChild(child){ if (child){ child.parent = this; this.children.push(child); } return child; },
    remove(){ if (!this.parent) return; const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); },
    setAttribute(key, value){ this.attributes[key] = String(value); },
    removeAttribute(key){ delete this.attributes[key]; },
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener(){},
    dispatch(type, event){ for (const fn of this._listeners[type] || []) fn(event || {}); },
    getContext(){ return makeContext2D(); },
    getBoundingClientRect(){ return { left: 0, top: 0, width: 520, height: 520 }; },
    closest(selector){ return matches(this, selector) ? this : null; },
    querySelector(selector){ return query(this, selector, false); },
    querySelectorAll(selector){ return query(this, selector, true); },
  };
  Object.defineProperty(element, 'innerHTML', {
    get(){ return this._html; },
    set(value){ this._html = String(value); this.children = []; },
  });
  Object.defineProperty(element, 'className', {
    get(){ return [...classes].join(' '); },
    set(value){ classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
  });
  element.classList = {
    add: (...values) => values.forEach(value => classes.add(value)),
    remove: (...values) => values.forEach(value => classes.delete(value)),
    contains: value => classes.has(value),
    toggle: (value, force) => {
      const enabled = force === undefined ? !classes.has(value) : !!force;
      if (enabled) classes.add(value); else classes.delete(value);
      return enabled;
    },
  };
  return element;
}

function matches(node, selector){
  if (!node || !selector) return false;
  if (selector.startsWith('.')) return node.classList && node.classList.contains(selector.slice(1));
  const data = /^\[data-([\w-]+)="([^"]*)"\]$/.exec(selector);
  if (data) return node.dataset && node.dataset[data[1]] === data[2];
  return String(node.tagName || '').toLowerCase() === selector.toLowerCase();
}

function query(root, selector, all){
  const found = [];
  const queue = (root.children || []).slice();
  while (queue.length){
    const node = queue.shift();
    if (matches(node, selector)){
      if (!all) return node;
      found.push(node);
    }
    queue.push(...(node.children || []));
  }
  return all ? found : null;
}

function makeMath(sequence){
  const custom = Object.create(Math);
  const values = (sequence || []).slice();
  custom.random = () => values.length ? values.shift() : 0.1;
  return custom;
}

function createHarness(file, factory, playerCount, options = {}){
  const area = makeElement('div');
  const extra = makeElement('div');
  const toastWrap = makeElement('div');
  const calls = [];
  const progress = [];
  const document = {
    body: makeElement('body'), documentElement: makeElement('html'),
    createElement: makeElement,
    getElementById: id => id === 'toast-wrap' ? toastWrap : null,
    addEventListener(){}, removeEventListener(){}, querySelectorAll(){ return []; },
  };
  const scaleDelay = ms => Math.max(1, Math.min(18, Math.round((Number(ms) || 0) * 0.01)));
  const sandbox = {
    console, JSON, Date, Map, Set, Array, Number, String, Boolean, Object,
    Math: makeMath(options.random), document, navigator: {},
    location: { protocol: 'http:', host: '127.0.0.1:8080' },
    setTimeout: (fn, ms, ...args) => setTimeout(fn, scaleDelay(ms), ...args), clearTimeout,
    setInterval: (fn, ms, ...args) => setInterval(fn, scaleDelay(ms), ...args), clearInterval,
    AbortController, AbortSignal,
    fetch: async (url, init) => {
      const body = JSON.parse(String(init && init.body || '{}'));
      calls.push({ url:String(url), init, body });
      const legal = Array.isArray(body.options) && body.options.length > 0 && body.options.length <= 200;
      if (!legal) throw new Error('AI options 必须为 1-200 项');
      return { ok: true, status: 200, json: async () => ({ choice: body.options[0] }) };
    },
    __area: area, __extra: extra,
  };
  sandbox.window = {
    devicePixelRatio: 1,
    location: sandbox.location,
    matchMedia: () => ({ matches: true, addEventListener(){}, removeEventListener(){} }),
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(UTILS, context, { filename: '01-utils.js' });
  vm.runInContext(ASSETS, context, { filename: '06-assets.js' });
  vm.runInContext(`
    function t(key){ return String(key); }
    function renderPlayers(){}
    let __lastStatus = '';
    function setStatus(text){ __lastStatus = String(text || ''); }
    function resolveServer(){ return ''; }
    const account = { authToken: 'qa-token' };
    const online = { room: null, isHost: false };
    function aiPersonaMove(length, best){ return Math.max(0, Math.min(length - 1, best)); }
    function aiSpeak(){}
  `, context, { filename: 'ai-strength-prelude.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', file), 'utf8'), context, { filename: file });
  const opts = {
    ai: new Set(options.ai || [1]), aiPersona: options.aiPersona || { id: 'teacher', randomness: 0, temperature: 0.2 },
    onEnd(){}, onProgress(payload){ progress.push(payload); }, sendMove(){}, sendRestart(){}, isReplaying(){ return false; },
    online: !!options.online, myIdx: 0, isHost: true, destroyed: false,
  };
  context.__opts = opts;
  const game = vm.runInContext(`${factory}(__area, __extra, ${playerCount}, __opts)`, context, { filename: file + ':factory' });
  return { context, game, area, extra, calls, progress, opts };
}

function callFor(harness, game){
  const entry = harness.calls.find(call => call.body.game === game);
  return entry && entry.body;
}

function normalizedCandidates(body){
  if (!body || !Array.isArray(body.options) || !Array.isArray(body.candidates)) return false;
  if (!body.options.length || body.options.length > 200 || body.options.some(option => typeof option !== 'string')) return false;
  if (body.candidates.length !== body.options.length || body.candidates.length > 40) return false;
  const seen = new Set();
  return body.candidates.every((candidate, index) => {
    if (!candidate || candidate.choice !== body.options[index] || seen.has(candidate.choice)) return false;
    seen.add(candidate.choice);
    if (!candidate.features || Array.isArray(candidate.features) || typeof candidate.features !== 'object') return false;
    const entries = Object.entries(candidate.features);
    return entries.length <= 24 && entries.every(([key, value]) =>
      /^[a-z][a-z0-9_]{0,31}$/i.test(key) && Number.isFinite(value) && value >= -1 && value <= 1);
  });
}

function assertNormalized(label, body){
  assert(label + '：候选与 features 已归一化且保持本地排序', normalizedCandidates(body),
    body ? JSON.stringify({ options:body.options, candidates:body.candidates }) : '无请求');
}

function emptyXiangqiBoard(){
  return Array.from({ length:10 }, () => Array(9).fill(null));
}

function ownersWith(player, positions){
  const owners = Array(24).fill(-1);
  positions.forEach(position => { owners[position] = player; });
  return owners;
}

function emptyTankGrid(width = 15, height = 13){
  return Array.from({ length:height }, (_, row) => Array.from({ length:width }, (_, col) =>
    row === 0 || col === 0 || row === height - 1 || col === width - 1 ? 3 : 0));
}

function tankState(tanks, bullets = []){
  return {
    version:3, mode:'realtime-deathmatch', tanks, bullets, grid:emptyTankGrid(), season:'spring',
    remainingMs:180000, startedAt:Date.now(), over:false, winner:-1, cur:0,
  };
}

function tankAt(id, x, y, direction, hp = 3){
  return {
    id, x, y, d:direction, hp, alive:true, respawnAt:0, invulnerableUntil:0, fireReadyAt:0,
    input:{ up:false, right:false, down:false, left:false, fire:false },
    kills:0, deaths:0, damage:0, shots:0, hits:0, placement:0,
  };
}

function emptyTetrisWell(){
  return Array.from({ length:18 }, () => Array(10).fill(0));
}

function tetrisMeta(id, active, queue){
  return {
    id, active, queue:queue.slice(), bagIndex:1, hold:null, canHold:true, score:0, lines:0,
    tetrisCount:0, placementSeq:0, garbageSent:0, garbageReceived:0, incoming:[], alive:true,
    koTime:null, koConfirmed:false, placement:0, fallMs:0, lastEvent:'READY', eventAt:Date.now(),
  };
}

async function runGomoku(){
  let h = createHarness('gomoku.js', 'gameGomoku', 2);
  h.game.onRestore({
    hist: [[7,2],[7,3],[0,0],[7,4],[0,2],[7,5],[1,0],[7,6]],
    cur: 0, over: false, last: [7,6],
  });
  h.game.onMove([1,2]);
  await waitFor(() => callFor(h, 'gomoku') && h.game.snapshot().over, '五子棋 AI 立即成五');
  let body = callFor(h, 'gomoku');
  let snap = h.game.snapshot();
  assert('五子棋进攻：本地首选是唯一成五点', body.options[0] === '7,7' && body.candidates[0].features.immediate_win === 1,
    JSON.stringify(body.options));
  assert('五子棋进攻：/api/ai 首选映射为实际成五落子', snap.over && snap.cur === 1 && snap.hist.at(-1).join(',') === body.options[0]);
  assertNormalized('五子棋进攻', body);
  h.game.destroy();

  h = createHarness('gomoku.js', 'gameGomoku', 2);
  h.game.onRestore({
    hist: [[7,3],[7,2],[7,4],[0,0],[7,5],[0,2],[7,6],[1,0]],
    cur: 0, over: false, last: [1,0],
  });
  h.game.onMove([1,2]);
  await waitFor(() => callFor(h, 'gomoku') && h.game.snapshot().hist.length === 10, '五子棋 AI 立即封堵');
  body = callFor(h, 'gomoku');
  snap = h.game.snapshot();
  assert('五子棋防守：本地首选是唯一四连封堵点', body.options[0] === '7,7' && body.candidates[0].features.immediate_block === 1,
    JSON.stringify(body.options));
  assert('五子棋防守：/api/ai 首选映射为实际封堵落子', !snap.over && snap.cur === 0 && snap.hist.at(-1).join(',') === body.options[0]);
  assertNormalized('五子棋防守', body);
  h.game.destroy();
}

async function runXiangqi(){
  const h = createHarness('xiangqi.js', 'gameXiangqi', 2);
  const board = emptyXiangqiBoard();
  board[0][4] = { p:1, t:'k' };
  board[9][4] = { p:0, t:'k' };
  board[5][4] = { p:1, t:'h' }; // 唯一将帅屏障；离线后会送将。
  board[5][0] = { p:1, t:'r' };
  board[5][1] = { p:0, t:'r' }; // 合法的高价值目标。
  board[7][3] = { p:0, t:'r' }; // 诱使 5,4 的马离开将帅屏障。
  board[9][2] = { p:0, t:'e' };
  h.game.onRestore({ board, cur:0, over:false, winner:-1 });
  h.game.onMove({ from:[9,2], to:[7,0] });
  await waitFor(() => callFor(h, 'xiangqi') && h.game.snapshot().cur === 0, '象棋 AI 高价值合法吃子');
  const body = callFor(h, 'xiangqi');
  const snap = h.game.snapshot();
  assert('象棋：本地首选合法吃车', body.options[0] === '5,0>5,1' && body.candidates[0].features.capture_value >= 0.8,
    JSON.stringify(body.options));
  assert('象棋：会暴露将帅的高价值伪候选被合法层剔除', !body.options.includes('5,4>7,3'), JSON.stringify(body.options));
  assert('象棋：/api/ai 首选成为实际合法落子',
    !snap.over && snap.board[5][0] === null && snap.board[5][1] && snap.board[5][1].p === 1 && snap.board[5][1].t === 'r');
  assertNormalized('象棋', body);
  h.game.destroy();
}

async function runLudoFinish(){
  const h = createHarness('ludo.js', 'gameLudo', 2, { online:true, random:[0.34] });
  h.game.onRestore({
    tokens: [[0,-1,-1,-1],[53,10,-1,-1]], curIdx:0, phase:'roll', dice:0, over:false, winner:-1,
  });
  h.game.onMove({ dice:1 }, 0);
  h.game.onMove({ ti:0 }, 0);
  await waitFor(() => callFor(h, 'ludo') && h.game.snapshot().tokens[1][0] === 56, '飞行棋 AI 优先终点');
  const body = callFor(h, 'ludo');
  const snap = h.game.snapshot();
  assert('飞行棋终点：本地排序把到达终点置于普通推进之前',
    body.options[0] === 'token:0' && body.state.localRanking[0].choice === 'token:0' && body.candidates[0].features.finish === 1,
    JSON.stringify(body.state.localRanking));
  assert('飞行棋终点：/api/ai 首选映射为实际到达终点', snap.tokens[1][0] === 56 && snap.tokens[1][1] === 10);
  assertNormalized('飞行棋终点', body);
  h.game.destroy();
}

async function runLudoCapture(){
  const h = createHarness('ludo.js', 'gameLudo', 2, { online:true, random:[0.34] });
  h.game.onRestore({
    tokens: [[0,29,-1,-1],[0,10,-1,-1]], curIdx:0, phase:'roll', dice:0, over:false, winner:-1,
  });
  h.game.onMove({ dice:1 }, 0);
  h.game.onMove({ ti:0 }, 0);
  await waitFor(() => callFor(h, 'ludo') && h.game.snapshot().tokens[0][1] === -1, '飞行棋 AI 优先吃子');
  const body = callFor(h, 'ludo');
  const snap = h.game.snapshot();
  assert('飞行棋吃子：本地排序把吃子置于普通推进之前',
    body.options[0] === 'token:0' && body.state.localRanking[0].choice === 'token:0' && body.candidates[0].features.capture > 0,
    JSON.stringify(body.state.localRanking));
  assert('飞行棋吃子：/api/ai 首选映射为实际吃子', snap.tokens[1][0] === 3 && snap.tokens[1][1] === 10 && snap.tokens[0][1] === -1);
  assertNormalized('飞行棋吃子', body);
  h.game.destroy();
}

async function runMonopolyScenario(label, aiMoney, hazardPositions, expected){
  const h = createHarness('monopoly.js', 'gameMonopoly', 2, { online:true, random:[0,0] });
  const owners = ownersWith(0, hazardPositions);
  h.game.onRestore({
    players: [
      { money:2000, pos:2, alive:true, props:hazardPositions.slice(), buildings:0 },
      { money:aiMoney, pos:0, alive:true, props:[], buildings:0 },
    ],
    cur:0, phase:'buy', round:1, over:false, winner:-1, owners, deck:[0,1,2,3,4,5,6,7],
  });
  h.game.onMove({ decision:'pass' }, 0);
  await waitFor(() => callFor(h, 'monopoly') && h.game.snapshot().cur === 0, '大富翁 AI ' + label, 2600);
  const body = callFor(h, 'monopoly');
  const snap = h.game.snapshot();
  assert('大富翁' + label + '：本地建议与 options 第一项均为 ' + expected,
    body.state.localAdvice === expected && body.options[0] === expected,
    JSON.stringify({ advice:body.state.localAdvice, options:body.options, state:body.state }));
  assert('大富翁' + label + '：/api/ai 首选映射为实际决策',
    expected === 'buy' ? snap.players[1].props.includes(2) : !snap.players[1].props.includes(2));
  assertNormalized('大富翁' + label, body);
  h.game.destroy();
  return body;
}

async function runMonopoly(){
  const healthy = await runMonopolyScenario('低风险且储备充足', 4000, [], 'buy');
  assert('大富翁买入：买后现金高于生存储备',
    healthy.candidates.find(candidate => candidate.choice === 'buy').features.survival_reserve > 0);

  const hazards = [4,5,7,8,10,11,13,14,16,17,19,20,21,22];
  const risky = await runMonopolyScenario('高负债风险且储备不足', 350, hazards, 'pass');
  assert('大富翁放弃：仍买得起但本地风险模型判定储备不足',
    risky.state.money >= risky.state.property.price && risky.state.cashReserve > risky.state.money - risky.state.property.price &&
      risky.state.futureTaxRentRisk > 0 && risky.options[0] === 'pass',
    JSON.stringify(risky.state));
}

async function runTankShoot(){
  const h = createHarness('tank.js', 'gameTank', 3);
  h.game.onRestore(tankState([
    tankAt(0, 3.5, 6.5, 1, 1),
    tankAt(1, 7.5, 6.5, 3, 3),
    tankAt(2, 11.5, 10.5, 3, 3),
  ]));
  await waitFor(() => callFor(h, 'tank') && h.progress.some(item => item.act === 'shoot'), '坦克 AI 直线射击');
  const body = callFor(h, 'tank');
  const snap = h.game.snapshot();
  assert('坦克进攻：直线低血目标被选为最高优先级',
    body.state.target && body.state.target.id === 0 && body.options[0] === 'shoot' &&
      body.candidates[0].features.line_of_sight === 1 && body.candidates[0].features.target_priority > 0.5,
    JSON.stringify({ target:body.state.target, ranking:body.state.localRanking }));
  assert('坦克进攻：本地最优 shoot 映射为真实炮弹',
    snap.tanks[1].shots === 1 && snap.bullets.some(bullet => bullet.owner === 1 && bullet.d === 3),
    JSON.stringify({ tank:snap.tanks[1], bullets:snap.bullets }));
  assertNormalized('坦克进攻', body);
  h.game.destroy();
}

async function runTankDodge(){
  const h = createHarness('tank.js', 'gameTank', 2);
  h.game.onRestore(tankState([
    tankAt(0, 2.5, 2.5, 2, 3),
    tankAt(1, 7.5, 6.5, 3, 3),
  ], [
    { id:1, owner:0, x:4.5, y:6.5, d:1, ttl:2600 },
  ]));
  await waitFor(() => callFor(h, 'tank') && h.progress.some(item => item.act === 'move'), '坦克 AI 来弹闪避');
  const body = callFor(h, 'tank');
  const move = h.progress.find(item => item.act === 'move');
  assert('坦克防守：水平来弹时本地首选垂直闪避',
    ['move:0','move:2'].includes(body.options[0]) && move && [0,2].includes(move.d) &&
      body.candidates[0].features.dodge > 0,
    JSON.stringify({ options:body.options, progress:h.progress, candidates:body.candidates }));
  assert('坦克防守：本地最优闪避映射为真实移动动作',
    move && body.options[0] === 'move:' + move.d, JSON.stringify({ choice:body.options[0], move }));
  assertNormalized('坦克防守', body);
  h.game.destroy();
}

async function runTetris(){
  const h = createHarness('tetris.js', 'gameTetris', 2);
  const playerWell = emptyTetrisWell();
  playerWell[17] = [1,1,1,1,1,1,0,0,0,0];
  const otherWell = emptyTetrisWell();
  h.game.onRestore({
    version:2, mode:'simultaneous-survival', wells:[otherWell, playerWell], scores:[0,0],
    states:[
      tetrisMeta(0, { kind:1, rotation:0, x:4, y:-1 }, [1,2,3,4,5,6,0]),
      tetrisMeta(1, { kind:0, rotation:0, x:3, y:-1 }, [0,1,2,3,4,5,6]),
    ],
    remainingMs:300000, over:false, winner:-1, pieceCount:0, cur:0, bagSeed:'qa-ai-strength',
    countdownRemainingMs:0,
  });
  await waitFor(() => callFor(h, 'tetris') && h.game.snapshot().states[1].placementSeq >= 1, '俄罗斯方块 AI 消行落点');
  const body = callFor(h, 'tetris');
  const snap = h.game.snapshot();
  const best = body.state.localRanking[0];
  const features = body.candidates[0].features;
  const dellacherieKeys = ['low_landing','low_stack','few_holes','smooth_surface','row_stability','column_stability','well_control'];
  assert('俄罗斯方块：可复现井面优先横放 I 消行且不留洞',
    body.options[0] === '0:0:6:17' && best.lines === 1 && best.holes === 0 &&
      features.lines_cleared === 0.25 && features.few_holes === 1,
    JSON.stringify({ options:body.options, ranking:body.state.localRanking }));
  assert('俄罗斯方块：Dellacherie 井面特征完整进入候选',
    dellacherieKeys.every(key => Object.prototype.hasOwnProperty.call(features, key)), JSON.stringify(features));
  assert('俄罗斯方块：本地最优落点真实消除底行',
    snap.states[1].placementSeq === 1 && snap.states[1].lines === 1 &&
      snap.wells[1].every(row => row.every(cell => cell === 0)),
    JSON.stringify({ choice:body.options[0], state:snap.states[1], well:snap.wells[1] }));
  assertNormalized('俄罗斯方块', body);
  h.game.destroy();
}

async function run(){
  await runGomoku();
  await runXiangqi();
  await runLudoFinish();
  await runLudoCapture();
  await runMonopoly();
  await runTankShoot();
  await runTankDodge();
  await runTetris();
}

run().then(() => {
  if (failures.length){
    console.log('AI_STRENGTH_HAS_FAILURES (' + failures.length + ')');
    process.exitCode = 1;
  } else {
    console.log('AI_STRENGTH_ALL_PASS');
  }
}).catch(error => {
  console.error('AI_STRENGTH_CRASH: ' + (error && error.stack || error));
  process.exitCode = 2;
});
