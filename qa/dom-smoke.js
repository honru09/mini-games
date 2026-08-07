// 轻量 DOM 桩 + 游戏功能冒烟测试（Node 运行，无真实浏览器）
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = process.argv[2] || path.join(ROOT, 'public', 'index.html');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json');
const html = fs.readFileSync(HTML_PATH, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const assetManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

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
  'room-panel','room-code-big','room-info','seat-grid','room-status','room-actions',
  'btn-quick-join','btn-browse-rooms','btn-join-code','join-room-code','online-play-actions','hero-banner',
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
  const nodeText = node => String(node && node.textContent || '') + ((node && node.children) || []).map(nodeText).join('');
  const stack = [root];
  while (stack.length){
    const n = stack.shift();
    if (n.children && n.children.length) stack.push(...n.children);
    if (String(n.tagName).toUpperCase() === 'BUTTON' && nodeText(n).includes(text)) return n;
  }
  return null;
}

async function main(){
  /* 大厅渲染 */
  check('大厅渲染 6 张精选游戏卡', $('game-grid').children.length === 6);
  check('运行时只注册 6 个精选游戏 ID',
    JSON.stringify(Object.keys(G.GAMES)) === JSON.stringify(['gomoku','ludo','monopoly','tank','tetris','xiangqi']));
  check('默认人数为 2', G.playerCount === 2);
  check('大厅彻底移除本地热座入口与全局人数选择', !/data-mode=["']local["']/.test(html) && !/id=["']count-group["']/.test(html));
  check('Avatar v2 固定六主题 48 款、注册仅 12 款免费',G.avatarCatalog.length===48&&new Set(G.avatarCatalog.map(item=>item.theme)).size===6&&G.freeAvatarIds.length===12&&G.avatarCatalog.filter(item=>item.animated).length===12);
  const cards = $('game-grid').children;
  const gomokuCard = cards.find(card => card.dataset.gameId === 'gomoku');
  const tetrisCard = cards.find(card => card.dataset.gameId === 'tetris');
  check('五子棋大厅卡接入 16:9 美术封面', gomokuCard && gomokuCard.classList.contains('has-cover') && !!gomokuCard.querySelector('.game-cover'));
  check('俄罗斯方块大厅卡接入 16:9 美术封面', tetrisCard && tetrisCard.classList.contains('has-cover') && !!tetrisCard.querySelector('.game-cover'));
  const failedCover = gomokuCard && gomokuCard.querySelector('.game-cover');
  const failedCoverImg = failedCover && failedCover.querySelector('img');
  if (failedCoverImg) failedCoverImg.dispatch('error');
  check('封面加载失败时保留 Emoji fallback', failedCover && failedCover.classList.contains('asset-failed') && failedCoverImg.style.display === 'none');

  const manifestIds = assetManifest.assets.map(asset => asset.asset_id);
  const integratedPaths = [];
  assetManifest.assets.filter(asset => asset.status === 'integrated').forEach(asset => {
    if (asset.runtime_path) integratedPaths.push(asset.runtime_path);
    if (asset.variants) integratedPaths.push(...Object.values(asset.variants));
  });
  check('asset manifest 锁定 6 个 runtime ID', assetManifest.productBaseline.gameCount === 6 && JSON.stringify(assetManifest.productBaseline.runtimeIds) === JSON.stringify(Object.keys(G.GAMES)));
  check('asset manifest 的 asset ID 唯一', new Set(manifestIds).size === manifestIds.length);
  check('asset manifest 的 integrated 文件全部存在', integratedPaths.every(file => file.startsWith('public/assets/') && fs.existsSync(path.join(ROOT, ...file.split('/')))));

  localStorage.setItem('mg_art_gomoku_v1', '0');
  G.renderHub();
  const rollbackGomokuCard = $('game-grid').children.find(card => card.dataset.gameId === 'gomoku');
  G.playerCount = 2; G.launchGame('gomoku',2);
  check('五子棋 feature flag 关闭后回退 Emoji 大厅卡', rollbackGomokuCard && !rollbackGomokuCard.classList.contains('has-cover'));
  check('五子棋 feature flag 关闭后仍可开局', area().children[0] && !area().children[0].classList.contains('game-art-v1'));
  localStorage.removeItem('mg_art_gomoku_v1');
  G.renderHub();

  /* 各游戏初始化（支持的人数组合） */
  const combos = [
    ['gomoku', 2],
    ['ludo', 2], ['ludo', 3], ['ludo', 4],
    ['monopoly', 2], ['monopoly', 3], ['monopoly', 4], ['monopoly', 5],
    ['tank', 2],
    ['tetris', 2], ['tetris', 3], ['tetris', 4],
    ['xiangqi', 2],
  ];
  for (const [id, n] of combos){
    G.playerCount = n;
    try{
      G.launchGame(id,n);
      const ok = area().children.length > 0;
      check(id + ' p' + n + ' 初始化成功', ok);
    }catch(err){
      check(id + ' p' + n + ' 初始化成功', false);
      console.log('    ERROR: ' + err.message);
    }
  }

  G.playerCount = 2; G.launchGame('gomoku',2);
  check('五子棋 Canvas 接入木纹底材且规则层仍由 Canvas 绘制', area().children[0].classList.contains('game-art-v1'));

  G.playerCount = 2; G.launchGame('tetris',2);
  let tetrisWell = area().querySelector('.tetris-well');
  check('俄罗斯方块 DOM 井接入玻璃底材与 CSS 精确网格', tetrisWell && tetrisWell.classList.contains('game-art-v1'));
  G.game.onMove({ piece: 0, x: 0, y: 17, rot: 0 }, 0);
  const tetrisSnapshot = G.game.snapshot();
  const tetrisValues = new Set(tetrisSnapshot.wells.flat(2));
  check('俄罗斯方块美术不改变 18x10 二值状态', tetrisSnapshot.wells.every(well => well.length === 18 && well.every(row => row.length === 10)) && [...tetrisValues].every(value => value === 0 || value === 1));
  const tetrisSnapshotText = JSON.stringify(tetrisSnapshot);
  check('俄罗斯方块快照不写入美术状态', !/(cosmetic|blockSkin|backgroundSkin|presentation)/i.test(tetrisSnapshotText));

  localStorage.setItem('mg_art_tetris_v1', '0');
  G.launchGame('tetris',2);
  tetrisWell = area().querySelector('.tetris-well');
  check('俄罗斯方块 feature flag 关闭后仍可开局并使用 CSS fallback', tetrisWell && !tetrisWell.classList.contains('game-art-v1'));
  localStorage.removeItem('mg_art_tetris_v1');

  /* 不支持的人数组合应被拦截 */
  G.playerCount = 3;
  const titleBefore = $('game-title').textContent;
  const areaCountBefore = area().children.length;
  G.launchGame('gomoku',3);
  check('3 人点五子棋被拦截（不进入游戏）',
    $('game-title').textContent === titleBefore && area().children.length === areaCountBefore);

  /* 五子棋：模拟横排五连 */
  G.playerCount = 2; G.launchGame('gomoku',2);
  const gomokuCanvas = area().children[0];
  const placeStone = (r, c) => {
    const LOGICAL = 520, CELL = 34, PAD = 22;
    const x = PAD + c*CELL, y = PAD + r*CELL;
    gomokuCanvas.dispatch('click', { clientX: x/LOGICAL*520, clientY: y/LOGICAL*520 });
  };
  [[7,3],[3,3],[7,4],[3,4],[7,5],[3,5],[7,6],[3,6],[7,7]].forEach(([r,c]) => placeStone(r,c));
  check('五子棋：玩家1 五连获胜', $('status-bar').textContent.includes('获胜'));

  /* 飞行棋：掷骰直到出现可移动棋子并移动一次 */
  G.playerCount = 4; G.launchGame('ludo',4);
  const ludoBoard = area().children[0];
  const diceBtn = $('game-extra').querySelector('.dice-btn');
  let moved = false;
  G.game.onMove({ dice: 6 }, 0);
  // 等待骰子状态机真正空闲，避免高负载 CI 中固定延时先于动画完成。
  if (G.game._raw && typeof G.game._raw.whenIdle === 'function') await G.game._raw.whenIdle();
  const movable = ludoBoard.querySelectorAll('.tok').filter(t => t.classList.contains('movable'));
  if (movable.length){
    movable[0].dispatch('click');
    moved = true;
  }
  check('飞行棋：完成一次起飞/移动', moved);
  check('飞行棋：轨道 52 格', ludoBoard.querySelectorAll('.tcell').length === 52);
  check('飞行棋：移动后骰子按钮重新可用', moved && !diceBtn.disabled);
  const chipDots = $('player-bar').children.map(c => c.children[0].style.background);
  check('飞行棋：4 人时玩家颜色正确（红/蓝/绿/黄）',
    chipDots[0] === '#e5484d' && chipDots[1] === '#3b82f6' && chipDots[2] === '#22a06b' && chipDots[3] === '#f59e0b');

  /* 迷你大富翁：走 5 回合不报错 */
  G.playerCount = 3; G.launchGame('monopoly',3);
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

  /* 规则弹层 */
  G.playerCount = 2; G.launchGame('ludo',2);
  $('btn-rules').dispatch('click');
  const backdrops = document.body.children.filter(c => c.classList.contains('modal-backdrop') && !c.classList.contains('auth-backdrop'));
  check('规则弹层可打开', backdrops.length === 1);
  backdrops.forEach(b => b.remove());

  /* 大富翁：轮次显示 + 提前结算 */
  G.playerCount = 3; G.launchGame('monopoly',3);
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

  // 内部规则回归：无服务端票据时不得进入正式经济与成长。
  G.playerCount = 2; G.launchGame('gomoku',2);
  const settlementBoard = area().children[0];
  const placeSettlement = (r, c) => {
    const LOGICAL = 520, CELL = 34, PAD = 22;
    settlementBoard.dispatch('click', { clientX: (PAD + c*CELL)/LOGICAL*520, clientY: (PAD + r*CELL)/LOGICAL*520 });
  };
  [[7,3],[3,3],[7,4],[3,4],[7,5],[3,5],[7,6],[3,6],[7,7]].forEach(([r,c]) => placeSettlement(r,c));
  const roster2 = JSON.parse(localStorage.getItem('mg_roster'));
  const devAfter = roster2.find(p => p.uid === devUid).coins;
  const p2 = roster2.find(p => p.name === '玩家2');
  check('内部规则回归不增加正式金币', devAfter - devBefore === 0);
  check('内部规则回归不修改客户端权威场次', p2 && p2.coins - p2Before.coins === 0 && p2.total - p2Before.total === 0);
  check('本地排行榜仍可正常渲染', $('lb-list').children.length >= 2);

  /* 人机模式：AI 自动回应落子 */
  G.aiMode = true;
  G.playerCount = 2;
  G.launchGame('gomoku',2);
  const aiCanvas = area().children[0];
  const LOGICAL_AI = 520, CELL_AI = 34, PAD_AI = 22;
  aiCanvas.dispatch('click', { clientX: (PAD_AI + 7*CELL_AI)/LOGICAL_AI*520, clientY: (PAD_AI + 7*CELL_AI)/LOGICAL_AI*520 });
  await sleep(1600);
  const aiSnapshot = G.game.snapshot();
  check('人机模式：五子棋 AI 自动回应并轮回玩家1', aiSnapshot.hist.length === 2 && aiSnapshot.cur === 0);
  G.aiMode = false;

  /* AI 奖励票据：断线缓存、重试队列与错误后停止重放 */
  {
    const online = G.online;
    const oldSend = online.send;
    const oldConnected = online.connected;
    const oldAuthenticated = online._authenticated;
    const oldRewardVersion = online.rewardVersion;
    const sent = [];
    online.send = message => sent.push(message);
    online.pendingSoloClaims = [];
    online._soloClaimsLoaded = true;
    online.soloMatch = null;
    online.connected = true;
    online._authenticated = true;
    online.rewardVersion = '1.0';
    const match = online.beginSoloMatch('gomoku');
    const startRequest = sent.find(message => message.type === 'solo_start');
    check('AI 奖励票据会自动发起并带 clientRunId', !!(startRequest && startRequest.payload.clientRunId === match.clientRunId));
    online.onMessage({ type: 'solo_started', payload: {
      game: 'gomoku', clientRunId: match.clientRunId, matchId: 'ai_dom_ticket', resultId: 'ai_result_dom_ticket',
    } });
    online.connected = false;
    online.reportSoloProgress('gomoku', [7, 7]);
    online.submitSoloResult('gomoku', 'win');
    check('AI 断线时缓存有效操作和待结算结果', online.soloMatch && online.soloMatch.pendingActions.length === 1 && online.soloMatch.pendingResult === 'win');
    online.connected = true;
    online.flushSoloMatch();
    const replayedProgress = sent.find(message => message.type === 'solo_progress');
    check('AI 恢复连接后先补操作再进入持久化结算队列', !!replayedProgress &&
      replayedProgress.payload.action && /^act_/.test(replayedProgress.payload.action.actionId || '') &&
      online.pendingSoloClaims.length === 1 && !online.soloMatch);
    online.onMessage({ type: 'result_error', matchId: 'ai_dom_ticket', resultId: 'ai_result_dom_ticket', payload: {
      matchId: 'ai_dom_ticket', resultId: 'ai_result_dom_ticket',
    }, msg: '测试拒绝' });
    check('AI 结算错误会清理队列并停止重复提交', online.pendingSoloClaims.length === 0);
    online.send = oldSend;
    online.connected = oldConnected;
    online._authenticated = oldAuthenticated;
    online.rewardVersion = oldRewardVersion;
    online.soloMatch = null;
    online.pendingSoloClaims = [];
  }

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
  check('联机模式隐藏角色选择', $('persona-row').classList.contains('hidden'));

  // 商城、设置弹层与房间面板初始状态
  check('头像商城实现已进入构建产物', /function\s+openShop\s*\(/.test(script) && /shop-grid/.test(script));
  check('商城不直接调用 HTMLCollection.forEach', !/\.children\s*\.forEach\s*\(/.test(script));
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
