// 端到端联机测试：真实 WebSocket 服务端 + 两个隔离的前端实例（DOM 桩）
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'index.html');
const SERVER = path.join(ROOT, 'server', 'index.js');
const PORT = 8099;
const html = fs.readFileSync(HTML_PATH, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const tmp = path.join(os.tmpdir(), 'mini-games-online-script.js');
fs.writeFileSync(tmp, script);
const allEnvs = [];
let serverOut = '';

/* ---------- DOM 桩（每个实例一套） ---------- */
function makeCtxProxy(){
  return new Proxy({}, {
    get(t, p){
      if (p in t) return t[p];
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
    value: '',
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
  'btn-create-room','btn-join-room','room-input','btn-settings','online-status','online-banner',
  'room-panel','room-code-big','room-info','room-status','room-actions',
  'btn-me','slots-row','lb-list','lb-note','lb-tab-all','lb-tab-online',
  'lobby-panel','lobby-list','player-list'];

function makeEnv(label, hash){
  const registry = new Map(IDs.map(id => {
    const e = makeEl('div');
    if (id === 'room-panel') e.className = 'room-panel hidden';
    if (id === 'online-banner' || id === 'screen-game') e.className = 'hidden';
    return [id, e];
  }));
  const lsStore = new Map();
  const document = {
    getElementById: id => registry.get(id) || null,
    createElement: tag => makeEl(tag),
    querySelectorAll: () => [],
    body: makeEl('body'),
  };
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, WebSocket, TextDecoder, TextEncoder,
    document,
    location: { protocol: 'http:', host: '127.0.0.1:' + PORT, hash: hash || '' },
    window: { devicePixelRatio: 1, location: { protocol: 'http:', host: '127.0.0.1:' + PORT, hash: hash || '' }, __gameInfo: null },
    module: { exports: {} },
    navigator: {},
    localStorage: {
      getItem: k => lsStore.has(k) ? lsStore.get(k) : null,
      setItem: (k, v) => lsStore.set(k, String(v)),
      removeItem: k => lsStore.delete(k),
    },
    fetch: async (url, init) => {
      let options = null;
      try { options = JSON.parse(init.body).options; } catch {}
      const choice = options && options.length ? options[0] : null;
      return { ok: true, json: async () => ({ choice }) };
    },
    AbortSignal: global.AbortSignal,
  };
  sandbox.window.window = sandbox.window;
  const context = vm.createContext(sandbox);
  vm.runInContext(script, context, { filename: label + '.js' });
  return {
    label,
    context,
    $: id => registry.get(id),
    area: () => registry.get('board-area'),
    status: () => registry.get('status-bar').textContent,
    onlineStatus: () => registry.get('online-status')._html,
    info: () => context.window.__gameInfo,
  };
}
function registerEnv(env){ allEnvs.push(env); return env; }

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(env, fn, desc, timeoutMs){
  const start = Date.now();
  while (Date.now() - start < timeoutMs){
    let v = null;
    try { v = await fn(); } catch {}
    if (v) return v;
    await sleep(50);
  }
  throw new Error(env.label + ' 等待超时: ' + desc);
}
function assert(name, cond){
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) process.exitCode = 1;
}
function btnByText(container, text){
  const stack = [container];
  while (stack.length){
    const n = stack.shift();
    if (n.children && n.children.length) stack.push(...n.children);
    if (n.textContent === text) return n;
  }
  return null;
}
function toClient(q, r, L){
  const x = L.ox + (q + r/2)*L.scale, y = L.oy + r*0.866*L.scale;
  return { clientX: x/560*520, clientY: y/600*520 };
}
function checkerLayout(bd){
  let minX=1e9, maxX=-1e9, minY=1e9, maxY=-1e9;
  for (const h of bd.holes){
    const x = h.q + h.r/2, y = h.r*0.866;
    minX=Math.min(minX,x); maxX=Math.max(maxX,x);
    minY=Math.min(minY,y); maxY=Math.max(maxY,y);
  }
  const scale = Math.min((560-70)/Math.max(1,maxX-minX), (600-70)/Math.max(1,maxY-minY));
  return { scale, ox: (560-(maxX+minX)*scale)/2, oy: (600-(maxY+minY)*scale)/2 };
}
async function setupOnlineGame(host, gameId, guestLabel){
  const guest = registerEnv(makeEnv(guestLabel));
  await waitFor(guest, () => /已连接服务器/.test(guest.onlineStatus()), '对方连接(' + gameId + ')', 5000);
  host.$('btn-create-room').dispatch('click');
  await waitFor(host, () => /房间已创建/.test(host.onlineStatus()), '创建房间(' + gameId + ')', 5000);
  host.info().startGame(gameId);
  await waitFor(host, () => host.$('room-status').textContent.includes('等待'), '等待模式(' + gameId + ')', 4000);
  await waitFor(guest, () => btnByText(guest.$('lobby-list'), '加入') !== null, '大厅出现等待房间(' + gameId + ')', 4000);
  const joinBtn = btnByText(guest.$('lobby-list'), '加入');
  joinBtn.dispatch('click');
  await waitFor(guest, () => /已加入房间/.test(guest.onlineStatus()), '大厅一键加入(' + gameId + ')', 5000);
  await waitFor(host, () => host.info().game !== null, '自动开局(' + gameId + ')', 5000);
  await waitFor(guest, () => guest.info().game !== null, '对方开局(' + gameId + ')', 5000);
  return { room: host.info().online.room, guest };
}

async function main(){
  /* 启动服务端 */
  const server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', d => serverOut += d);
  server.stderr.on('data', d => serverOut += d);
  await waitFor({ label: 'server' }, () => {
    try {
      const http = require('http');
      return new Promise(res => {
        http.get('http://127.0.0.1:' + PORT + '/', r => { res(r.statusCode === 200); r.resume(); })
          .on('error', () => res(false));
      });
    } catch { return false; }
  }, '服务端就绪', 8000);

  try{
    const host = registerEnv(makeEnv('host'));
    const guest = registerEnv(makeEnv('guest'));
    await waitFor(host, () => /已连接服务器/.test(host.onlineStatus()), '房主连接', 5000);
    await waitFor(guest, () => /已连接服务器/.test(guest.onlineStatus()), '对方连接', 5000);

    /* 1. 房主创建房间 */
    host.$('btn-create-room').dispatch('click');
    await waitFor(host, () => /房间已创建/.test(host.onlineStatus()), '房主拿到房间码', 5000);
    const roomMatch = host.onlineStatus().match(/>([A-Z0-9]{6})</);
    const room = roomMatch ? roomMatch[1] : '';
    assert('房主创建房间并拿到 6 位房间码', /^[A-Z0-9]{6}$/.test(room));
    await waitFor(host, () => !host.$('room-panel').classList.contains('hidden'), '房主房间面板出现', 4000);
    assert('大厅房间面板显示房间码', host.$('room-code-big').textContent === room);
    assert('房间面板显示人数 1/2 与等待状态', host.$('room-info').textContent.includes('1/2') && host.$('room-status').textContent.includes('等待玩家加入'));
    await waitFor(guest, () => btnByText(guest.$('lobby-list'), '加入') !== null, '大厅出现房主房间', 4000);
    assert('游戏大厅显示等待中的房间', guest.$('lobby-list').children.length >= 1);

    /* 2. 房主选择五子棋，进入等待模式 */
    host.info().startGame('gomoku');
    await waitFor(host, () => host.$('room-status').textContent.includes('五子棋') && host.$('room-status').textContent.includes('等待其他玩家加入'), '房主进入等待模式', 4000);
    assert('等待模式显示已选择五子棋', host.$('room-status').textContent.includes('五子棋'));
    assert('等待模式未开局', host.info().game === null);

    /* 3. 对方从大厅点击「加入」自动开局 */
    const joinBtn = btnByText(guest.$('lobby-list'), '加入');
    joinBtn.dispatch('click');
    await waitFor(guest, () => /已加入房间/.test(guest.onlineStatus()), '大厅加入房间', 5000);
    await waitFor(host, () => host.status().includes('你的回合'), '双方自动开局（房主）', 5000);
    await waitFor(guest, () => guest.status().includes('等待对方落子'), '双方自动开局（对方）', 5000);
    assert('大厅加入后自动开局', host.info().game !== null && guest.info().game !== null && guest.info().online.room === room);

    /* 4. 交替落子直到房主获胜 */
    const hostCanvas = host.area().children[0];
    const guestCanvas = guest.area().children[0];
    const stone = (env, canvas, r, c) => {
      const LOGICAL = 554, CELL = 34, PAD = 22;
      canvas.dispatch('click', { clientX: (PAD + c*CELL)/LOGICAL*520, clientY: (PAD + r*CELL)/LOGICAL*520 });
    };
    const hostMoves = [[7,3],[7,4],[7,5],[7,6],[7,7]];
    const guestMoves = [[3,3],[3,4],[3,5],[3,6]];
    const compareBoards = (step) => {
      const hs = host.info().game.snapshot();
      const gs = guest.info().game.snapshot();
      assert('第 ' + step + ' 步后双方棋盘一致', JSON.stringify(hs) === JSON.stringify(gs));
    };
    for (let i = 0; i < hostMoves.length; i++){
      await waitFor(host, () => host.status().includes('你的回合'), '房主回合 ' + i, 4000);
      stone(host, hostCanvas, hostMoves[i][0], hostMoves[i][1]);
      if (i < guestMoves.length){
        await waitFor(guest, () => guest.status().includes('你的回合'), '对方回合 ' + i, 4000);
        compareBoards(i + 1);
        stone(guest, guestCanvas, guestMoves[i][0], guestMoves[i][1]);
        await waitFor(host, () => host.status().includes('你的回合'), '房主再次回合 ' + i, 4000);
        compareBoards(i + 1);
      }
    }
    await waitFor(host, () => host.status().includes('获胜'), '房主获胜', 4000);
    await waitFor(guest, () => guest.status().includes('获胜'), '对方看到获胜', 4000);
    compareBoards(hostMoves.length);
    assert('双方都显示玩家1 获胜', host.status().includes('玩家1 获胜') && guest.status().includes('玩家1 获胜'));

    /* 4.5 金币结算、对局统计与排行榜实时更新 */
    await waitFor(host, () => host.info().leaderboard && host.info().leaderboard.total >= 2, '排行榜数据到达', 5000);
    const hostMe = host.info().roster.find(p => p.uid === host.info().deviceUid);
    const guestMe = guest.info().roster.find(p => p.uid === guest.info().deviceUid);
    assert('房主档案 +1 L金币（五子棋胜）', hostMe.coins === 1);
    assert('对方档案 +0 L金币（五子棋负）', guestMe.coins === 0);
    assert('双方档案各计 1 局', hostMe.total === 1 && guestMe.total === 1);
    assert('档案记录五子棋局数', hostMe.played.gomoku === 1 && guestMe.played.gomoku === 1);
    const lbUids = host.info().leaderboard.list.map(u => u.uid);
    assert('排行榜包含双方', lbUids.includes(host.info().deviceUid) && lbUids.includes(guest.info().deviceUid));
    await waitFor(host, () => {
      const u = host.info().leaderboard && host.info().leaderboard.list.find(x => x.uid === host.info().deviceUid);
      return u && u.coins === 1;
    }, '排行榜金币与服务端一致', 5000);
    assert('排行榜金币与服务端一致', host.info().leaderboard.list.find(u => u.uid === host.info().deviceUid).coins === 1);
    assert('在线状态：双方档案显示在线', host.info().leaderboard.list.find(u => u.uid === host.info().deviceUid).online === true &&
      host.info().leaderboard.list.find(u => u.uid === guest.info().deviceUid).online === true);

    /* 5. 房主重开一局，双方同步重置 */
    host.$('btn-restart').dispatch('click');
    await waitFor(host, () => host.status().includes('你的回合') && host.info().game.snapshot().hist.length === 0, '房主重开', 4000);
    await waitFor(guest, () => guest.status().includes('等待对方落子') && guest.info().game.snapshot().hist.length === 0, '对方重开', 4000);
    assert('重开一局后双方棋盘为空', host.info().game.snapshot().hist.length === 0 && guest.info().game.snapshot().hist.length === 0);

    /* 6. 对方断开，房主收到通知并回到大厅 */
    guest.context.window.__gameInfo.online.ws.close();
    await waitFor(host, () => /对方已离开/.test(host.onlineStatus()), '房主收到离开通知', 4000);
    assert('房主回到大厅且房间面板保留等待', host.$('screen-game').classList.contains('hidden') && !host.$('screen-hub').classList.contains('hidden') &&
      !host.$('room-panel').classList.contains('hidden') && host.$('room-status').textContent.includes('等待'));

    /* 7. 离开旧房间，准备多游戏联机测试 */
    const leaveBtn = btnByText(host.$('room-actions'), '离开房间');
    if (leaveBtn) leaveBtn.dispatch('click');
    await waitFor(host, () => host.$('room-panel').classList.contains('hidden'), '离开旧房间', 4000);

    /* 8. 飞行棋联机：掷骰/走子同步 */
    const ludoSetup = await setupOnlineGame(host, 'ludo', 'guest-ludo');
    const ludoGuest = ludoSetup.guest;
    let ludoMoved = false;
    for (let i = 0; i < 40 && !ludoMoved; i++){
      const hostDice = host.$('game-extra').children[0];
      const guestDice = ludoGuest.$('game-extra').children[0];
      const hActive = !hostDice.disabled;
      const gActive = !guestDice.disabled;
      if (hActive || gActive){
        const act = hActive ? host : ludoGuest;
        act.$('game-extra').children[0].dispatch('click');
        for (let w = 0; w < 10 && !ludoMoved; w++){
          await sleep(400);
          const movable = act.area().querySelectorAll('.tok').filter(t => t.classList.contains('movable'));
          if (movable.length){
            movable[0].dispatch('click');
            ludoMoved = true;
            break;
          }
          if (!act.$('game-extra').children[0].disabled) break;
        }
      } else {
        await sleep(400);
      }
      await sleep(400);
      const hs = host.info().game.snapshot();
      const gs = ludoGuest.info().game.snapshot();
      if (JSON.stringify(hs) !== JSON.stringify(gs)){
        assert('飞行棋：第 ' + (i+1) + ' 轮双方状态一致', false);
        break;
      }
    }
    assert('飞行棋：完成一次联机走子', ludoMoved);
    assert('飞行棋：双方状态完全一致', JSON.stringify(host.info().game.snapshot()) === JSON.stringify(ludoGuest.info().game.snapshot()));

    /* 9. 大富翁联机：掷骰/购买决策同步 */
    host.$('btn-back').dispatch('click');
    await waitFor(host, () => !host.$('screen-hub').classList.contains('hidden'), '飞行棋后回到大厅', 4000);
    const leaveBtn2 = btnByText(host.$('room-actions'), '离开房间');
    if (leaveBtn2) leaveBtn2.dispatch('click');
    await waitFor(host, () => host.$('room-panel').classList.contains('hidden'), '离开飞行棋房间', 4000);
    const monoSetup = await setupOnlineGame(host, 'monopoly', 'guest-mono');
    const mGuest = monoSetup.guest;
    for (let i = 0; i < 20; i++){
      const hRoll = host.area().children[0].querySelectorAll('button')[0];
      const gRoll = mGuest.area().children[0].querySelectorAll('button')[0];
      if (!hRoll.disabled) hRoll.dispatch('click');
      else if (!gRoll.disabled) gRoll.dispatch('click');
      await sleep(1200);
      const hBuy = host.$('game-extra').children[1];
      if (hBuy.children.length){ hBuy.children[hBuy.children.length-1].dispatch('click'); await sleep(500); }
      const gBuy = mGuest.$('game-extra').children[1];
      if (gBuy.children.length){ gBuy.children[gBuy.children.length-1].dispatch('click'); await sleep(500); }
      const hs = host.info().game.snapshot();
      const gs = mGuest.info().game.snapshot();
      if (JSON.stringify(hs) !== JSON.stringify(gs)){
        assert('大富翁：第 ' + (i+1) + ' 轮双方状态一致', false);
        break;
      }
    }
    assert('大富翁：多轮后双方状态一致', JSON.stringify(host.info().game.snapshot()) === JSON.stringify(mGuest.info().game.snapshot()));

    /* 10. 弹珠跳棋联机：走子同步 */
    host.$('btn-back').dispatch('click');
    await waitFor(host, () => !host.$('screen-hub').classList.contains('hidden'), '大富翁后回到大厅', 4000);
    const leaveBtn3 = btnByText(host.$('room-actions'), '离开房间');
    if (leaveBtn3) leaveBtn3.dispatch('click');
    await waitFor(host, () => host.$('room-panel').classList.contains('hidden'), '离开大富翁房间', 4000);
    const ckSetup = await setupOnlineGame(host, 'checker', 'guest-ck');
    const ckGuest = ckSetup.guest;
    const ckBd = require(tmp).makeCheckerBoard();
    const ckKey = ckBd.key;
    const L = checkerLayout(ckBd);
    const hCanvas = host.area().children[0];
    const src = ckBd.arms[0][0];
    const occ0 = new Map();
    ckBd.arms[0].forEach(h => occ0.set(ckKey(h), {pi:0,mi:0}));
    const holeSet0 = { set: new Set(ckBd.holes.map(ckKey)), key: ckKey };
    const dests0 = require(tmp).checkerReachable(holeSet0, occ0, src);
    hCanvas.dispatch('click', toClient(src.q, src.r, L));
    if (dests0.size){
      const [q, r] = [...dests0][0].split(',').map(Number);
      hCanvas.dispatch('click', toClient(q, r, L));
    }
    await waitFor(ckGuest, () => ckGuest.status().includes('玩家2'), '弹珠跳棋轮到对方', 4000);
    assert('弹珠跳棋：双方状态一致', JSON.stringify(host.info().game.snapshot()) === JSON.stringify(ckGuest.info().game.snapshot()));

    /* 11. 邀请流程：房主从玩家列表邀请在线玩家 */
    host.$('btn-back').dispatch('click');
    await waitFor(host, () => !host.$('screen-hub').classList.contains('hidden'), '弹珠跳棋后回到大厅', 4000);
    const leaveBtn4 = btnByText(host.$('room-actions'), '离开房间');
    if (leaveBtn4) leaveBtn4.dispatch('click');
    await waitFor(host, () => host.$('room-panel').classList.contains('hidden'), '离开弹珠跳棋房间', 4000);
    const invitee = registerEnv(makeEnv('guest-inv'));
    await waitFor(invitee, () => /已连接服务器/.test(invitee.onlineStatus()), '受邀者连接', 5000);
    host.$('btn-create-room').dispatch('click');
    await waitFor(host, () => /房间已创建/.test(host.onlineStatus()), '创建邀请房间', 5000);
    await waitFor(host, () => {
      const btns = host.$('player-list').querySelectorAll('button').filter(b => b.textContent === '邀请');
      return btns.length >= 1;
    }, '玩家列表出现邀请按钮', 4000);
    const invBtns = host.$('player-list').querySelectorAll('button').filter(b => b.textContent === '邀请');
    invBtns[invBtns.length - 1].dispatch('click');
    await waitFor(invitee, () => btnByText(invitee.context.document.body, '接受') !== null, '受邀者收到邀请弹窗', 4000);
    const acceptBtn = btnByText(invitee.context.document.body, '接受');
    acceptBtn.dispatch('click');
    await waitFor(invitee, () => invitee.info().online.room === host.info().online.room, '受邀者接受并加入房间', 4000);
    assert('邀请接受后双方进入同一房间', invitee.info().online.room === host.info().online.room && host.info().online.room !== null);

    /* 12. 多人数房间：玩家索引互不相同 + 不满人数也可开局 */
    invitee.context.window.__gameInfo.online.ws.close();
    await waitFor(host, () => /对方已离开/.test(host.onlineStatus()), '房主收到受邀者离开', 4000);
    const leaveInv = btnByText(host.$('room-actions'), '离开房间');
    if (leaveInv) leaveInv.dispatch('click');
    await waitFor(host, () => host.$('room-panel').classList.contains('hidden'), '离开邀请房间', 4000);

    host.info().playerCount = 4;
    host.$('btn-create-room').dispatch('click');
    await waitFor(host, () => /房间已创建/.test(host.onlineStatus()), '创建 4 人房间', 5000);
    const room4 = host.info().online.room;
    const g1 = registerEnv(makeEnv('guest-4p-1'));
    const g2 = registerEnv(makeEnv('guest-4p-2'));
    const g3 = registerEnv(makeEnv('guest-4p-3'));
    await waitFor(g1, () => /已连接服务器/.test(g1.onlineStatus()), '4人房玩家1连接', 5000);
    await waitFor(g2, () => /已连接服务器/.test(g2.onlineStatus()), '4人房玩家2连接', 5000);
    await waitFor(g3, () => /已连接服务器/.test(g3.onlineStatus()), '4人房玩家3连接', 5000);
    g1.info().online.join(room4);
    await waitFor(g1, () => g1.info().online.room === room4, '玩家1加入', 5000);
    g2.info().online.join(room4);
    await waitFor(g2, () => g2.info().online.room === room4, '玩家2加入', 5000);
    await waitFor(host, () => host.info().online.roomInfo && host.info().online.roomInfo.size === 3, '房主看到 3 人', 5000);
    const playersIdx = host.info().online.roomInfo.players.map(p => p.player);
    assert('多人数房间：玩家索引 0/1/2 互不相同', JSON.stringify(playersIdx) === JSON.stringify([0, 1, 2]));
    assert('多人数房间：各玩家身份不同', g1.info().online.player === 1 && g2.info().online.player === 2);

    /* 13. 不满人数开局：3 人玩大富翁 */
    host.info().startGame('monopoly');
    await waitFor(host, () => host.$('room-status').textContent.includes('大富翁'), '3 人房选择大富翁', 4000);
    const startBtn = [...host.$('room-actions').children].find(b => (b.textContent || '').includes('开始游戏'));
    assert('不满人数时显示开始按钮', !!startBtn);
    startBtn.dispatch('click');
    await waitFor(host, () => host.info().game !== null && host.info().playerCount === 3, '3 人自动开局（房主）', 5000);
    await waitFor(g1, () => g1.info().game !== null && g1.info().playerCount === 3, '3 人自动开局（玩家2）', 5000);
    await waitFor(g2, () => g2.info().game !== null && g2.info().playerCount === 3, '3 人自动开局（玩家3）', 5000);
    const monoSnap = host.info().game.snapshot();
    assert('大富翁 3 人局：players 数量为 3', monoSnap.players.length === 3);
    assert('大富翁 3 人局：玩家身份 0/1/2', host.info().online.player === 0 && g1.info().online.player === 1 && g2.info().online.player === 2);
    const g3Late = g3.info().online.room;
    assert('第 4 人未加入（仍在房外）', g3Late === null);

    /* 14. 结束本局：回大厅并可在同一房间切换游戏 */
    host.$('btn-end-game').dispatch('click');
    await waitFor(host, () => host.info().game === null && !host.$('screen-hub').classList.contains('hidden'), '房主结束本局回大厅', 5000);
    await waitFor(g1, () => g1.info().game === null && !g1.$('screen-hub').classList.contains('hidden'), '玩家2结束本局回大厅', 5000);
    await waitFor(g2, () => g2.info().game === null && g2.$('screen-hub').classList.contains('hidden') === false, '玩家3结束本局回大厅', 5000);
    assert('结束本局后房间保留', host.info().online.room === room4 && host.$('room-panel').classList.contains('hidden') === false);
    host.info().startGame('ludo');
    await waitFor(host, () => host.$('room-status').textContent.includes('飞行棋'), '同一房间切换为飞行棋', 4000);
    const startBtn2 = [...host.$('room-actions').children].find(b => (b.textContent || '').includes('开始游戏'));
    startBtn2.dispatch('click');
    await waitFor(host, () => host.info().game !== null && host.info().game.snapshot && host.info().game.snapshot().tokens.length === 3, '3 人飞行棋开局', 5000);
    await waitFor(g1, () => g1.info().game !== null && g1.info().game.snapshot && g1.info().game.snapshot().tokens.length === 3, '玩家2飞行棋开局', 5000);
    assert('切换游戏后 3 人飞行棋正常', host.info().game.snapshot().tokens.length === 3 && g1.info().game.snapshot().tokens.length === 3);
    host.$('btn-end-game').dispatch('click');
    await waitFor(host, () => host.info().game === null, '再次结束本局', 4000);

    /* 15. 人机模式：本地 AI 自动对局 */
    const aiEnv = registerEnv(makeEnv('ai-local'));
    await waitFor(aiEnv, () => /已连接服务器/.test(aiEnv.onlineStatus()), 'AI 环境连接', 5000);
    aiEnv.info().aiMode = true;
    aiEnv.info().playerCount = 2;
    aiEnv.info().startGame('tictactoe');
    aiEnv.area().querySelectorAll('.ttt-cell')[4].dispatch('click');
    await waitFor(aiEnv, () => aiEnv.info().game.snapshot().board.filter(v => v !== null).length === 2, 'AI 自动回应', 6000);
    for (let i = 0; i < 12; i++){
      if (aiEnv.info().game.snapshot().over) break;
      const cs = aiEnv.area().querySelectorAll('.ttt-cell');
      let clicked = false;
      for (const c of cs){ if (c && !c.disabled){ c.dispatch('click'); clicked = true; break; } }
      await sleep(1600);
    }
    assert('人机模式：AI 完整对局结束', aiEnv.info().game.snapshot().over);

    console.log(process.exitCode ? 'E2E_HAS_FAILURES' : 'E2E_ALL_PASS');
  } finally {
    for (const e of allEnvs){
      try { const ws = e.info().online.ws; if (ws) ws.close(); } catch {}
    }
    server.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 2500).unref();
  }
}

main().catch(err => {
  console.log('E2E_CRASH: ' + (err && err.stack || err));
  console.log('---- SERVER OUTPUT ----');
  console.log(serverOut.slice(-2000));
  process.exitCode = 2;
  process.exit(2);
});
