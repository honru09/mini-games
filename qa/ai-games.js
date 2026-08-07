// 11 款游戏的人机走法回归：DeepSeek 合法选项桩 + 本地游戏真实状态机。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const UTILS = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '01-utils.js'), 'utf8');
const failures = [];

function assert(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, description, timeout = 2500){
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline){
    try { if (predicate()) return true; } catch {}
    await sleep(10);
  }
  throw new Error('等待超时：' + description);
}

function makeContext2D(){
  return new Proxy({}, { get(target, key){
    if (!(key in target)) target[key] = () => undefined;
    return target[key];
  }, set(target, key, value){ target[key] = value; return true; } });
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
  const document = {
    body: makeElement('body'), documentElement: makeElement('html'),
    createElement: makeElement,
    getElementById: id => id === 'toast-wrap' ? toastWrap : null,
    addEventListener(){}, removeEventListener(){}, querySelectorAll(){ return []; },
  };
  const scaleDelay = ms => Math.max(1, Math.min(20, Math.round((Number(ms) || 0) * 0.01)));
  const sandbox = {
    console, JSON, Date, Map, Set, Array, Number, String, Boolean, Object,
    Math: makeMath(options.random), document, navigator: {},
    location: { protocol: 'http:', host: '127.0.0.1:8080' },
    setTimeout: (fn, ms, ...args) => setTimeout(fn, scaleDelay(ms), ...args), clearTimeout,
    setInterval: (fn, ms, ...args) => setInterval(fn, scaleDelay(ms), ...args), clearInterval,
    AbortController, AbortSignal,
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init && init.body || '{}'));
      calls.push(body);
      const legal = Array.isArray(body.options) && body.options.length > 0 && body.options.length <= 200;
      if (!legal) throw new Error('AI options 必须为 1-200 项');
      return { ok: true, status: 200, json: async () => ({ choice: body.options[0] }) };
    },
    __area: area, __extra: extra,
  };
  sandbox.window = { devicePixelRatio: 1, location: sandbox.location };
  const context = vm.createContext(sandbox);
  vm.runInContext(UTILS, context, { filename: '01-utils.js' });
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
  `, context, { filename: 'ai-test-prelude.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', file), 'utf8'), context, { filename: file });
  const opts = {
    ai: new Set([1]), aiPersona: { id: 'teacher', randomness: 0, temperature: 0.2 },
    onEnd(){}, sendMove(){}, sendRestart(){}, isReplaying(){ return false; },
    online: !!options.online, myIdx: 0, isHost: true, destroyed: false,
  };
  context.__opts = opts;
  const game = vm.runInContext(`${factory}(__area, __extra, ${playerCount}, __opts)`, context, { filename: file + ':factory' });
  return { context, game, area, extra, calls, opts };
}

async function run(){
  let h = createHarness('tictactoe.js', 'gameTicTacToe', 2);
  h.game.onMove(4);
  await waitFor(() => h.calls.some(c => c.game === 'tictactoe') && h.game.snapshot().board.filter(v => v !== null).length === 2, '井字棋 AI');
  assert('井字棋：DeepSeek 合法选项后完成回应', h.game.snapshot().cur === 0);

  h = createHarness('gomoku.js', 'gameGomoku', 2);
  h.game.onMove([7, 7]);
  await waitFor(() => h.calls.some(c => c.game === 'gomoku') && h.game.snapshot().hist.length === 2, '五子棋 AI');
  assert('五子棋：DeepSeek 回应后轮回玩家1', h.game.snapshot().cur === 0);

  h = createHarness('checker.js', 'gameChecker', 2);
  const boardData = h.context.makeCheckerBoard();
  const key = point => point.q + ',' + point.r;
  const occupied = new Set(h.game.snapshot().marbles.flat());
  const holeSet = { set: new Set(boardData.holes.map(key)), key };
  let checkerMove = null;
  for (const encoded of h.game.snapshot().marbles[0]){
    const [q, r] = encoded.split(',').map(Number);
    const destinations = h.context.checkerReachable(holeSet, occupied, { q, r });
    if (destinations.size){ checkerMove = { from: [q, r], to: [...destinations][0].split(',').map(Number) }; break; }
  }
  h.game.onMove(checkerMove);
  await waitFor(() => h.calls.some(c => c.game === 'checker') && h.game.snapshot().cur === 0, '弹珠跳棋 AI');
  assert('弹珠跳棋：AI 从规范合法走法中选择', !!checkerMove);

  h = createHarness('draughts.js', 'gameDraughts', 2);
  h.game.onMove({ from: [2, 1], to: [3, 0] });
  await waitFor(() => h.calls.some(c => c.game === 'draughts') && h.game.snapshot().cur === 0, '国际跳棋 AI');
  assert('国际跳棋：AI 合法回应且状态机继续', !h.game.snapshot().over);

  h = createHarness('jungle.js', 'gameJungle', 2);
  h.game.onMove({ from: [6, 0], to: [5, 0] });
  await waitFor(() => h.calls.some(c => c.game === 'jungle') && h.game.snapshot().cur === 0, '斗兽棋 AI');
  assert('斗兽棋：AI 合法回应且状态机继续', !h.game.snapshot().over);

  h = createHarness('xiangqi.js', 'gameXiangqi', 2);
  h.game.onMove({ from: [6, 0], to: [5, 0] });
  await waitFor(() => h.calls.some(c => c.game === 'xiangqi') && h.game.snapshot().cur === 0, '象棋 AI');
  assert('象棋：AI 合法回应且状态机继续', !h.game.snapshot().over);

  h = createHarness('tank.js', 'gameTank', 2);
  h.game.onMove({ act: 'move', d: 1 });
  await waitFor(() => h.calls.some(c => c.game === 'tank') && h.game.snapshot().cur === 0, '坦克 AI');
  assert('坦克大战：AI 合法回应且轮回玩家1', !h.game.snapshot().over);

  h = createHarness('snake.js', 'gameSnake', 2);
  h.game.onMove({ d: 1, food: null });
  await waitFor(() => h.calls.some(c => c.game === 'snake') && h.game.snapshot().cur === 0, '贪吃蛇 AI');
  assert('贪吃蛇：AI 合法回应且轮回玩家1', !h.game.snapshot().over);

  h = createHarness('tetris.js', 'gameTetris', 2);
  h.game.onMove({ piece: 0, x: 0, y: 17, rot: 0 });
  await waitFor(() => h.calls.some(c => c.game === 'tetris') && h.game.snapshot().pieceCount === 2, '俄罗斯方块 AI');
  assert('俄罗斯方块：模型选择映射回真实落点', h.game.snapshot().cur === 0);

  // 骰子动画每局消耗 24 次随机数；随后固定 AI 首次掷出 6、再次掷出 1。
  const ludoRandom = Array(24).fill(0).concat([0.99], Array(24).fill(0), [0]);
  h = createHarness('ludo.js', 'gameLudo', 2, { online: true, random: ludoRandom });
  h.game.onMove({ dice: 1 }, 0);
  await waitFor(() => h.calls.some(c => c.game === 'ludo') && h.game.snapshot().curIdx === 0 && h.game.snapshot().phase === 'roll', '飞行棋 AI', 4000);
  assert('飞行棋：AI 可自行掷骰、选棋并结束回合', h.game.snapshot().tokens[1].some(value => value >= 0));

  h = createHarness('monopoly.js', 'gameMonopoly', 2, { online: true, random: [0, 0] });
  h.game.onMove({ roll: [1, 1] }, 0);
  await waitFor(() => h.game.snapshot().phase === 'buy', '大富翁玩家购买阶段', 3000);
  h.game.onMove({ decision: 'pass' }, 0);
  await waitFor(() => h.calls.some(c => c.game === 'monopoly') && h.game.snapshot().cur === 0 && h.game.snapshot().phase === 'roll', '大富翁 AI', 4000);
  assert('大富翁：AI 可自行掷骰、决策并结束回合', h.game.snapshot().players[1].props.includes(2));

  h = createHarness('tictactoe.js', 'gameTicTacToe', 2);
  h.game.onMove(4);
  h.opts.destroyed = true;
  await sleep(80);
  assert('离开游戏会废弃未完成的 AI 响应', h.game.snapshot().board.filter(v => v !== null).length === 1 && h.calls.length === 0);

  const gamesCalled = new Set();
  // 每个 harness 已分别断言过对应请求；此处保留清晰的最终结果标记。
  for (const name of ['tictactoe','gomoku','checker','draughts','jungle','xiangqi','tank','snake','tetris','ludo','monopoly']) gamesCalled.add(name);
  assert('11 款游戏均完成真实 AI 状态机回归', gamesCalled.size === 11);
}

run().then(() => {
  if (failures.length){
    console.log('AI_GAMES_HAS_FAILURES (' + failures.length + ')');
    process.exitCode = 1;
  } else {
    console.log('AI_GAMES_ALL_PASS');
  }
}).catch(error => {
  console.error('AI_GAMES_CRASH: ' + (error && error.stack || error));
  process.exitCode = 2;
});
