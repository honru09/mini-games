// 轻量 DOM 桩 + 游戏功能冒烟测试（Node 运行，无真实浏览器）
'use strict';
const fs = require('fs');
const path = require('path');

const HTML_PATH = process.argv[2] || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

/* ---------- DOM 桩 ---------- */
function makeCtxProxy(){
  return new Proxy({}, {
    get(t, p){
      if (p in t) return t[p];
      if (p === 'canvas') return null;
      if (p === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      return (...args) => undefined;
    },
    set(t, p, v){ t[p] = v; return true; },
  });
}
function makeEl(tag){
  const classes = new Set();
  const e = {
    tagName: String(tag).toUpperCase(),
    children: [],
    parent: null,
    style: {},
    dataset: {},
    attributes: {},
    textContent: '',
    _html: '',
    disabled: false,
    clientWidth: 520,
    width: 0,
    height: 0,
    _listeners: {},
    focus(){},
    setAttribute(k, v){
      this.attributes[k] = String(v);
      if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v);
    },
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    dispatch(type, ev){ (this._listeners[type] || []).forEach(fn => fn(ev || {})); },
    appendChild(c){ c.parent = this; this.children.push(c); return c; },
    remove(){
      if (!this.parent) return;
      const i = this.parent.children.indexOf(this);
      if (i >= 0) this.parent.children.splice(i, 1);
    },
    getContext(){ return ctx; },
    getBoundingClientRect(){ return { left: 0, top: 0, width: 520, height: 520 }; },
    querySelector(sel){ return this._q(sel, false); },
    querySelectorAll(sel){ return this._q(sel, true); },
    _q(sel, all){
      const out = [];
      const stack = this.children.slice();
      while (stack.length){
        const n = stack.shift();
        if (matchSel(n, sel)){ if (!all) return n; out.push(n); }
        stack.push(...n.children);
      }
      return all ? out : null;
    },
  };
  Object.defineProperty(e, 'innerHTML', {
    get(){ return this._html; },
    set(v){ this._html = String(v); this.children = []; },
  });
  Object.defineProperty(e, 'className', {
    get(){ return [...classes].join(' '); },
    set(v){ classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
  });
  e.classList = {
    add: c => classes.add(c),
    remove: c => classes.delete(c),
    toggle: (c, force) => {
      const on = force === undefined ? !classes.has(c) : !!force;
      if (on) classes.add(c); else classes.delete(c);
      return on;
    },
    contains: c => classes.has(c),
  };
  return e;
}
function matchSel(n, sel){
  if (sel.startsWith('.')) return n.classList.contains(sel.slice(1));
  const m = /^\[data-([\w-]+)="([^"]*)"\]$/.exec(sel);
  if (m) return n.dataset[m[1]] === m[2];
  return n.tagName.toLowerCase() === sel.toLowerCase();
}
const ctx = makeCtxProxy();

const IDs = ['count-group','btn-back','btn-restart','btn-rules','btn-end-game','btn-theme','count-label','mode-group','screen-hub','screen-game','game-title',
  'player-bar','status-bar','board-area','game-extra','toast-wrap','game-grid',
  'btn-create-room','btn-join-room','room-input','btn-settings-page','online-status','online-banner',
  'room-panel','room-code-big','room-info','room-status','room-actions',
  'btn-me','slots-row','persona-row','lb-list','lb-note','lb-tab-all','lb-tab-online',
  'lobby-panel','lobby-list','player-list'];
const registry = new Map(IDs.map(id => {
  const e = makeEl('div');
  if (id === 'room-panel') e.className = 'room-panel hidden';
  if (id === 'online-banner' || id === 'screen-game') e.className = 'hidden';
  return [id, e];
}));
global.document = {
  getElementById: id => registry.get(id) || null,
  createElement: tag => makeEl(tag),
  querySelectorAll: () => [],
  querySelector: () => null,
  body: makeEl('body'),
  documentElement: makeEl('html'),
  addEventListener(){},
  removeEventListener(){},
};
global.window = { devicePixelRatio: 1, location: { hash: '' }, __gameInfo: null };
global.location = { hash: '' };
global.WebSocket = class {
  constructor(){} send(){} close(){}
};
const lsStore = new Map();
global.localStorage = {
  getItem: k => lsStore.has(k) ? lsStore.get(k) : null,
  setItem: (k, v) => lsStore.set(k, String(v)),
  removeItem: k => lsStore.delete(k),
};
global.fetch = async (url, init) => {
  let options = null;
  try { options = JSON.parse(init.body).options; } catch {}
  const choice = options && options.length ? options[0] : null;
  return { ok: true, json: async () => ({ choice }) };
};
global.AbortSignal = global.AbortSignal || { timeout: () => undefined };

/* ---------- 载入游戏脚本 ---------- */
const tmp = path.join(__dirname, '..', 'data', '.smoke-script-' + process.pid + '.js');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, script);
require(tmp);
const G = global.window.__gameInfo;
const $ = id => registry.get(id);
const area = () => $('board-area');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(name, cond){
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) fails++;
}
function findBtnByText(root, text){
  const stack = [root];
  while (stack.length){
    const n = stack.shift();
    if (n.children && n.children.length) stack.push(...n.children);
    if (String(n.tagName).toUpperCase() === 'BUTTON' && (n.textContent || '').includes(text)) return n;
  }
  return null;
}

async function main(){
  /* 大厅渲染 */
  check('大厅渲染 11 张游戏卡', $('game-grid').children.length === 11);
  check('默认人数为 2', G.playerCount === 2);

  /* 各游戏初始化（支持的人数组合） */
  const combos = [
    ['tictactoe', 2], ['gomoku', 2],
    ['ludo', 2], ['ludo', 3], ['ludo', 4],
    ['monopoly', 2], ['monopoly', 3], ['monopoly', 4], ['monopoly', 5],
    ['checker', 2], ['checker', 3], ['checker', 4], ['checker', 5],
    ['tank', 2],
    ['snake', 2], ['snake', 3], ['snake', 4],
    ['tetris', 2], ['tetris', 3], ['tetris', 4],
    ['draughts', 2], ['jungle', 2], ['xiangqi', 2],
  ];
  for (const [id, n] of combos){
    G.playerCount = n;
    try{
      G.startGame(id);
      const ok = area().children.length > 0;
      check(id + ' p' + n + ' 初始化成功', ok);
    }catch(err){
      check(id + ' p' + n + ' 初始化成功', false);
      console.log('    ERROR: ' + err.message);
    }
  }

  /* 不支持的人数组合应被拦截 */
  G.playerCount = 3;
  const titleBefore = $('game-title').textContent;
  const areaCountBefore = area().children.length;
  G.startGame('tictactoe');
  check('3 人点井字棋被拦截（不进入游戏）',
    $('game-title').textContent === titleBefore && area().children.length === areaCountBefore);

  /* 井字棋：模拟完整对局 */
  G.playerCount = 2; G.startGame('tictactoe');
  const tttCells = () => area().querySelectorAll('.ttt-cell');
  [0,3,1,4,2].forEach((idx, turn) => {
    const cell = tttCells()[idx];
    cell.dispatch('click');
  });
  check('井字棋：玩家1 三连获胜', $('status-bar').textContent.includes('获胜'));

  /* 五子棋：模拟横排五连 */
  G.startGame('gomoku');
  const gomokuCanvas = area().children[0];
  const placeStone = (r, c) => {
    const LOGICAL = 554, CELL = 34, PAD = 22;
    const x = PAD + c*CELL, y = PAD + r*CELL;
    gomokuCanvas.dispatch('click', { clientX: x/LOGICAL*520, clientY: y/LOGICAL*520 });
  };
  [[7,3],[3,3],[7,4],[3,4],[7,5],[3,5],[7,6],[3,6],[7,7]].forEach(([r,c]) => placeStone(r,c));
  check('五子棋：玩家1 五连获胜', $('status-bar').textContent.includes('获胜'));

  /* 飞行棋：掷骰直到出现可移动棋子并移动一次 */
  G.playerCount = 4; G.startGame('ludo');
  const ludoBoard = area().children[0];
  const diceBtn = $('game-extra').children[0];
  let moved = false;
  for (let i = 0; i < 30 && !moved; i++){
    diceBtn.dispatch('click');
    await sleep(700);
    const movable = ludoBoard.querySelectorAll('.tok').filter(t => t.classList.contains('movable'));
    if (movable.length){
      movable[0].dispatch('click');
      moved = true;
    }
  }
  check('飞行棋：完成一次起飞/移动', moved);
  check('飞行棋：轨道 52 格', ludoBoard.querySelectorAll('.tcell').length === 52);
  check('飞行棋：移动后骰子按钮重新可用', moved && !diceBtn.disabled);
  const chipDots = $('player-bar').children.map(c => c.children[0].style.background);
  check('飞行棋：4 人时玩家颜色正确（红/蓝/绿/黄）',
    chipDots[0] === '#e5484d' && chipDots[1] === '#3b82f6' && chipDots[2] === '#22a06b' && chipDots[3] === '#f59e0b');

  /* 迷你大富翁：走 5 回合不报错 */
  G.playerCount = 3; G.startGame('monopoly');
  const mBoard = area().children[0];
  const mRollBtn = mBoard.querySelectorAll('button')[0];
  for (let i = 0; i < 5; i++){
    mRollBtn.dispatch('click');
    await sleep(750);
    const buyBtns = $('game-extra').children[1].children;
    if (buyBtns.length) buyBtns[buyBtns.length - 1].dispatch('click'); // 点“放弃”
    await sleep(300);
  }
  check('大富翁：24 格棋盘', mBoard.querySelectorAll('.m-cell').length === 24);
  check('大富翁：5 回合后仍有玩家存活', !$('status-bar').textContent.includes('获胜') || $('status-bar').textContent.includes('最终赢家'));

  /* 弹珠跳棋：选中棋子并移动一步 */
  G.playerCount = 2; G.startGame('checker');
  const cCanvas = area().children[0];
  const bd = global.__checkerBoard || (() => {
    const mod = require(tmp);
    return mod.makeCheckerBoard();
  })();
  const L = (() => {
    const spacing = 34;
    let minX=1e9, maxX=-1e9, minY=1e9, maxY=-1e9;
    for (const h of bd.holes){
      const x = h.q + h.r/2, y = h.r*0.866;
      minX=Math.min(minX,x); maxX=Math.max(maxX,x);
      minY=Math.min(minY,y); maxY=Math.max(maxY,y);
    }
    const scale = Math.min((560-70)/Math.max(1,maxX-minX), (600-70)/Math.max(1,maxY-minY));
    return { scale, ox: (560-(maxX+minX)*scale)/2, oy: (600-(maxY+minY)*scale)/2 };
  })();
  const toClient = (q, r) => {
    const x = L.ox + (q + r/2)*L.scale, y = L.oy + r*0.866*L.scale;
    return { clientX: x/560*520, clientY: y/600*520 };
  };
  const marbleHole = bd.arms[0][0]; // 玩家1 的一颗弹珠
  cCanvas.dispatch('click', toClient(marbleHole.q, marbleHole.r));
  // 计算可达点并点击第一个
  const key = bd.key;
  const occ = new Map();
  bd.arms[0].forEach(h => occ.set(key(h), {pi:0,mi:0}));
  const holeSet = { set: new Set(bd.holes.map(key)), key };
  const dests = require(tmp).checkerReachable(holeSet, occ, marbleHole);
  const first = [...dests][0];
  if (first){
    const [q, r] = first.split(',').map(Number);
    cCanvas.dispatch('click', toClient(q, r));
  }
  check('弹珠跳棋：选中并移动弹珠', $('status-bar').textContent.includes('玩家2'));
  check('弹珠跳棋：棋盘 121 洞', bd.holes.length === 121);

  /* 规则弹层 */
  G.playerCount = 2; G.startGame('ludo');
  $('btn-rules').dispatch('click');
  const backdrops = document.body.children.filter(c => c.classList.contains('modal-backdrop') && !c.classList.contains('auth-backdrop'));
  check('规则弹层可打开', backdrops.length === 1);
  backdrops.forEach(b => b.remove());

  /* 弹珠跳棋：悔棋 + 提示 */
  G.startGame('checker');
  const c2 = area().children[0];
  const cBd = require(tmp).makeCheckerBoard();
  const cKey = cBd.key;
  const cOcc = new Map();
  cBd.arms[0].forEach(h => cOcc.set(cKey(h), {pi:0,mi:0}));
  const cHoleSet = { set: new Set(cBd.holes.map(cKey)), key: cKey };
  const dests2 = require(tmp).checkerReachable(cHoleSet, cOcc, cBd.arms[0][0]);
  const first2 = [...dests2][0];
  c2.dispatch('click', toClient(cBd.arms[0][0].q, cBd.arms[0][0].r));
  if (first2){
    const [q, r] = first2.split(',').map(Number);
    c2.dispatch('click', toClient(q, r));
  }
  check('弹珠跳棋：移动后轮到玩家2', $('status-bar').textContent.includes('玩家2'));
  $('game-extra').children[0].dispatch('click'); // 悔棋
  check('弹珠跳棋：悔棋回到玩家1', $('status-bar').textContent.includes('玩家1') && $('status-bar').textContent.includes('悔棋'));
  $('game-extra').children[1].dispatch('click'); // 提示
  check('弹珠跳棋：提示高亮可移动棋子', $('status-bar').textContent.includes('高亮'));

  /* 大富翁：轮次显示 + 提前结算 */
  G.playerCount = 3; G.startGame('monopoly');
  check('大富翁：显示轮次', $('status-bar').textContent.includes('第 1/30 轮'));
  $('game-extra').children[2].dispatch('click'); // 提前结算
  check('大富翁：提前结算出结果', $('status-bar').textContent.includes('最终赢家'));
  const settleModals = document.body.children.filter(c => c.classList.contains('modal-backdrop') && !c.classList.contains('auth-backdrop'));
  check('大富翁：结算排名弹层', settleModals.length >= 1);
  settleModals.forEach(m => m.remove());

  /* 用户档案与积分 */
  // 注册账号（PIN 系统）：不再自动建档，需显式注册
  const acc = G.registerAccount('小明', 'abc123', 0, 0);
  check('注册账号成功且获得唯一 uid', !!acc && /^u_[a-z0-9]+$/.test(acc.uid));
  check('账号注册待确认状态已保存且不含明文 PIN', (() => {
    const saved = JSON.parse(localStorage.getItem('mg_account'));
    return saved && saved.uid === acc.uid && /^d/.test(saved.device || '') && !Object.prototype.hasOwnProperty.call(saved, 'pin');
  })());
  G.online.onMessage({ type: 'registered', payload: { uid: acc.uid, token: 'qa-session-token-0123456789abcdef', profile: acc } });
  check('服务端确认后只持久化 session token', (() => {
    const saved = JSON.parse(localStorage.getItem('mg_account'));
    return saved && saved.registered === true && saved.authToken === 'qa-session-token-0123456789abcdef' && !Object.prototype.hasOwnProperty.call(saved, 'pin');
  })());
  const savedUid = acc.uid;
  G.loadRoster(); // 模拟刷新
  check('服务端确认后刷新可在同设备恢复同一账号', G.deviceUid === savedUid);
  const acc2 = G.registerAccount('小明2', 'abc124', 1, 0);
  check('账号唯一：再次注册生成不同 uid', !!acc2 && acc2.uid !== acc.uid);
  G.registerAccount('小明', 'abc123', 0, 0); // 恢复主账号
  const roster0 = JSON.parse(localStorage.getItem('mg_roster'));
  check('档案已持久化', Array.isArray(roster0) && roster0.length >= 1);
  check('大厅渲染档案按钮与玩家槽位', $('btn-me').children.length >= 2 && $('slots-row').children.length === G.playerCount);

  // 编辑我的档案（昵称 + 头像）
  $('btn-me').dispatch('click');
  let modalBd = document.body.children.find(c => c.classList.contains('modal-backdrop') && !c.classList.contains('auth-backdrop'));
  check('点击我的档案弹出详情小框', !!modalBd);
  const editBtn = findBtnByText(modalBd.children[0], '编辑档案');
  check('档案弹层含编辑入口', !!editBtn);
  if (editBtn) editBtn.dispatch('click');
  modalBd = document.body.children.find(c => c.classList.contains('modal-backdrop') && !c.classList.contains('auth-backdrop'));
  let card = modalBd.children[0];
  const nickInput = card.querySelector('.nick-input') || card.children[1];
  nickInput.value = '小明';
  const avGrid = card.querySelector('.avatar-grid') || card;
  const avOpts = avGrid.querySelectorAll('.avatar-opt');
  if (avOpts.length > 1) avOpts[1].dispatch('click');
  const saveBtn = card.children.filter(c => c.textContent === '保存')[0] || findBtnByText(card, '保存');
  saveBtn.dispatch('click');
  const roster1 = JSON.parse(localStorage.getItem('mg_roster'));
  check('档案昵称保存成功', roster1.some(p => p.name === '小明'));
  check('我的档案按钮显示新昵称', $('btn-me').children[1].textContent.includes('小明'));
  const devUid = G.deviceUid;
  const devBefore = roster1.find(p => p.uid === devUid).coins;
  const p2Before = roster1.find(p => p.name === '玩家2') || { coins: 0, total: 0 };

  // 本地井字棋结算：胜者 +1 金币，负者 +0
  G.playerCount = 2; G.startGame('tictactoe');
  const tttCells2 = () => area().querySelectorAll('.ttt-cell');
  [0,3,1,4,2].forEach(idx => tttCells2()[idx].dispatch('click'));
  const roster2 = JSON.parse(localStorage.getItem('mg_roster'));
  const devAfter = roster2.find(p => p.uid === devUid).coins;
  const p2 = roster2.find(p => p.name === '玩家2');
  check('井字棋胜者 +1 金币', devAfter - devBefore === 1);
  check('井字棋负者 +0 金币且计 1 局', p2 && p2.coins - p2Before.coins === 0 && p2.total - p2Before.total === 1);
  check('排行榜已渲染本局成绩', $('lb-list').children.length >= 2);

  // 五子棋结算：胜者 +1 金币
  const devBefore2 = devAfter;
  G.startGame('gomoku');
  const g2 = area().children[0];
  const place2 = (r, c) => {
    const LOGICAL = 554, CELL = 34, PAD = 22;
    g2.dispatch('click', { clientX: (PAD + c*CELL)/LOGICAL*520, clientY: (PAD + r*CELL)/LOGICAL*520 });
  };
  [[7,3],[3,3],[7,4],[3,4],[7,5],[3,5],[7,6],[3,6],[7,7]].forEach(([r,c]) => place2(r,c));
  const devAfter2 = JSON.parse(localStorage.getItem('mg_roster')).find(p => p.uid === devUid).coins;
  check('五子棋胜者 +1 金币', devAfter2 - devBefore2 === 1);

  /* 人机模式：AI 自动回应落子 */
  G.aiMode = true;
  G.playerCount = 2;
  G.startGame('tictactoe');
  const aiCells = () => area().querySelectorAll('.ttt-cell');
  aiCells()[4].dispatch('click'); // 玩家1 走中心
  await sleep(1600);
  const aiBoard = G.game.snapshot().board;
  check('人机模式：AI 自动回应落子', aiBoard.filter(v => v !== null).length === 2);
  let aiOver = false;
  for (let i = 0; i < 12 && !aiOver; i++){
    if (G.game.snapshot().over){ aiOver = true; break; }
    const cells = area().querySelectorAll('.ttt-cell');
    let clicked = false;
    for (const c of cells){
      if (c && !c.disabled){ c.dispatch('click'); clicked = true; break; }
    }
    if (!clicked) await sleep(300);
    await sleep(1400);
  }
  aiOver = aiOver || G.game.snapshot().over;
  check('人机模式：完整对局可结束', aiOver);
  G.aiMode = false;

  // AI 角色化（Phase 4）
  check('AI_PERSONAS 定义 5 个角色', G.personas && G.personas.length === 5);
  const personaBefore = G.currentPersona.id;
  G.setAiPersona('gambler');
  check('切换 AI 角色生效', G.currentPersona.id === 'gambler' && G.currentPersona.randomness >= 0.3);
  G.setAiPersona(personaBefore);
  G.aiMode = true;
  G.renderPersonaRow();
  check('人机模式渲染角色选择卡', $('persona-row').children.length >= 2 && $('persona-row').querySelectorAll('.persona-card').length === 5);
  G.aiMode = false;
  G.renderPersonaRow();
  check('本地模式隐藏角色选择', $('persona-row').classList.contains('hidden'));

  // 设置弹层与房间面板初始状态
  $('btn-settings-page').dispatch('click');
  const stBd = document.body.children.find(c => c.classList.contains('modal-backdrop'));
  check('设置弹层可打开', !!stBd);
  if (stBd) stBd.remove();
  check('未建房时房间面板隐藏', $('room-panel').classList.contains('hidden'));

  console.log(fails ? ('FAILURES=' + fails) : 'ALL_PASS');
  try { fs.unlinkSync(tmp); } catch {}
  process.exit(fails ? 1 : 0);
}

main().catch(err => { try { fs.unlinkSync(tmp); } catch {} console.log('TEST_CRASH: ' + err.stack); process.exit(2); });
