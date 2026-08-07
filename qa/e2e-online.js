// 端到端联机测试：真实 WebSocket 服务端 + 两个隔离的前端实例（DOM 桩）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'index.html');
const SERVER = path.join(ROOT, 'server', 'index.js');
const PORT = Number(process.env.E2E_PORT) || 8099;
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
const TEST_ROOT = fs.mkdtempSync(path.join(ROOT, 'data', 'e2e-'));
const TEST_DATA_DIR = path.join(TEST_ROOT, 'server-data');
const html = fs.readFileSync(HTML_PATH, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const tmp = path.join(TEST_ROOT, 'frontend-script.js');
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
    _textContent: '',
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
  Object.defineProperty(e, 'textContent', {
    get(){ return this._textContent + this.children.map(child => child.textContent || '').join(''); },
    set(v){ this._textContent = String(v); this.children = []; },
  });
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
  'room-panel','room-code-big','room-info','seat-grid','room-status','room-actions',
  'btn-quick-join','btn-browse-rooms','btn-join-code','join-room-code','online-play-actions','hero-banner',
  'btn-me','slots-row','lb-list','lb-note','lb-tab-all','lb-tab-online',
  'lobby-panel','lobby-list','player-list'];

function makeEnv(label, hash, timerScale){
  const scale = timerScale || 1;
  const scaledDelay = ms => Math.max(0, Math.round((Number(ms) || 0) * scale));
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
    setTimeout: (fn, ms, ...args) => setTimeout(fn, scaledDelay(ms), ...args),
    clearTimeout,
    setInterval: (fn, ms, ...args) => setInterval(fn, scaledDelay(ms), ...args),
    clearInterval,
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
  // PIN 账号系统：每个测试环境注册一个唯一账号（本地立即生效，连接后同步到服务端）
  try {
    const pin = 'pin' + label.replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
    context.window.__gameInfo.registerAccount('测试' + label, pin, 0, 0);
  } catch {}
  return {
    label,
    context,
    $: id => registry.get(id),
    area: () => registry.get('board-area'),
    status: () => registry.get('status-bar').textContent,
    onlineStatus: () => registry.get('online-status')._html || registry.get('online-status').textContent,
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
async function setupOnlineGame(host, gameId, guestLabel, guestTimerScale){
  const guest = registerEnv(makeEnv(guestLabel, '', guestTimerScale));
  await waitFor(guest, () => /已连接服务器/.test(guest.onlineStatus()), '对方连接(' + gameId + ')', 5000);
  host.info().online.create({capacity:2,visibility:'public',allowSpectators:true});
  await waitFor(host, () => /房间已创建/.test(host.onlineStatus()), '创建房间(' + gameId + ')', 5000);
  host.info().startGame(gameId);
  await waitFor(host, () => host.$('room-status').textContent.includes('等待'), '等待模式(' + gameId + ')', 4000);
  const hostRoomCode=host.info().online.room;
  try { await waitFor(guest, () => [...guest.$('lobby-list').children].some(row=>row.dataset&&row.dataset.room===hostRoomCode), '大厅出现等待房间(' + gameId + ')', 4000); }
  catch(err){ console.log('LOBBY_DEBUG '+gameId+' hostRoom='+hostRoomCode+' hostLobby='+JSON.stringify(host.info().online.lobby)+' guestLobby='+JSON.stringify(guest.info().online.lobby)+' dom='+JSON.stringify([...guest.$('lobby-list').children].map(x=>x.dataset))); throw err; }
  const hostRow=[...guest.$('lobby-list').children].find(row=>row.dataset&&row.dataset.room===hostRoomCode);
  const joinBtn = btnByText(hostRow, '加入');
  joinBtn.dispatch('click');
  await waitFor(guest, () => /已加入房间/.test(guest.onlineStatus()), '大厅一键加入(' + gameId + ')', 5000);
  guest.info().online.setReady(true);
  await waitFor(guest,()=>guest.info().online.roomInfo&&(guest.info().online.roomInfo.seats||[]).some(seat=>seat.userId===guest.info().deviceUid&&seat.ready),'对方 READY('+gameId+')',5000);
  try { await waitFor(host,()=>host.info().online.roomInfo&&host.info().online.roomInfo.canStart,'READY('+gameId+')',5000); }
  catch(err){ console.log('READY_DEBUG '+gameId+' host='+JSON.stringify(host.info().online.roomInfo)+' guest='+JSON.stringify(guest.info().online.roomInfo)); throw err; }
  host.info().online.send({type:'start'});
  await waitFor(host, () => host.info().game !== null, '房主开始(' + gameId + ')', 5000);
  await waitFor(guest, () => guest.info().game !== null, '对方开局(' + gameId + ')', 5000);
  return { room: host.info().online.room, guest };
}

async function main(){
  /* 启动服务端 */
  const server = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: TEST_DATA_DIR,
      NODE_ENV: 'test',
      SUPABASE_URL: '',
      SUPABASE_KEY: '',
      DEEPSEEK_KEY: '',
      REWARD_TEST_MIN_DURATION_MS: '0',
      TANK_MATCH_DURATION_MS:'15000',
      TETRIS_MATCH_DURATION_MS:'15000',
    },
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
    host.info().online.create({capacity:2,visibility:'public',allowSpectators:true});
    await waitFor(host, () => /房间已创建/.test(host.onlineStatus()), '房主拿到房间码', 5000);
    const roomMatch = host.onlineStatus().match(/>([A-Z0-9]{6})</);
    const room = roomMatch ? roomMatch[1] : '';
    assert('房主创建房间并拿到 6 位房间码', /^[A-Z0-9]{6}$/.test(room));
    await waitFor(host, () => !host.$('room-panel').classList.contains('hidden'), '房主房间面板出现', 4000);
    assert('大厅房间面板显示房间码', host.$('room-code-big').textContent === room);
    assert('房间面板显示 1/2 席与等待状态', host.$('room-info').textContent.includes('1/2') && host.$('room-status').textContent.includes('请选择游戏'));
    await waitFor(guest, () => btnByText(guest.$('lobby-list'), '加入') !== null, '大厅出现房主房间', 4000);
    assert('游戏大厅显示等待中的房间', guest.$('lobby-list').children.length >= 1);

    /* 2. 房主选择五子棋，进入等待模式 */
    host.info().startGame('gomoku');
    await waitFor(host, () => host.info().online.roomInfo && host.info().online.roomInfo.game==='gomoku', '房主进入等待模式', 4000);
    assert('等待模式显示已选择五子棋', host.info().online.roomInfo.game==='gomoku');
    assert('等待模式未开局', host.info().game === null);

    /* 3. 对方从大厅加入、READY，房主开局 */
    const joinBtn = btnByText(guest.$('lobby-list'), '加入');
    joinBtn.dispatch('click');
    await waitFor(guest, () => /已加入房间/.test(guest.onlineStatus()), '大厅加入房间', 5000);
    guest.info().online.setReady(true);
    await waitFor(host,()=>host.info().online.roomInfo&&host.info().online.roomInfo.canStart,'房主看到 READY',5000);
    host.info().online.send({type:'start'});
    await waitFor(host, () => host.status().includes('你的回合'), '双方自动开局（房主）', 5000);
    await waitFor(guest, () => guest.status().includes('等待对方落子'), '双方自动开局（对方）', 5000);
    assert('READY 后由房主开局', host.info().game !== null && guest.info().game !== null && guest.info().online.room === room);

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
    assert('房主今日首次联机胜利获得 5💵 / 17 XP', hostMe.coins === 5 && hostMe.xp === 17);
    assert('对方联机失败仍获得 1💵 / 8 XP', guestMe.coins === 1 && guestMe.xp === 8);
    const rewardOverlay = host.context.document.body.children.find(node => node.classList && node.classList.contains('reward-breakdown-overlay'));
    assert('结算 UI 展示服务端 Reward Breakdown', !!rewardOverlay &&
      rewardOverlay.querySelectorAll('.reward-breakdown-row').length >= 2 && rewardOverlay.querySelectorAll('.reward-breakdown-total').length === 1);
    assert('双方档案各计 1 局', hostMe.total === 1 && guestMe.total === 1);
    assert('档案记录五子棋局数', hostMe.played.gomoku === 1 && guestMe.played.gomoku === 1);
    const lbUids = host.info().leaderboard.list.map(u => u.uid);
    assert('排行榜包含双方', lbUids.includes(host.info().deviceUid) && lbUids.includes(guest.info().deviceUid));
    await waitFor(host, () => {
      const u = host.info().leaderboard && host.info().leaderboard.list.find(x => x.uid === host.info().deviceUid);
      return u && u.coins === 5;
    }, '排行榜金币与服务端一致', 5000);
    assert('排行榜金币与服务端一致', host.info().leaderboard.list.find(u => u.uid === host.info().deviceUid).coins === 5);
    assert('在线状态：双方档案显示在线', host.info().leaderboard.list.find(u => u.uid === host.info().deviceUid).online === true &&
      host.info().leaderboard.list.find(u => u.uid === guest.info().deviceUid).online === true);

    /* 5. 房主重开一局，双方同步重置 */
    host.$('btn-restart').dispatch('click');
    await waitFor(host, () => host.status().includes('你的回合') && host.info().game.snapshot().hist.length === 0, '房主重开', 4000);
    await waitFor(guest, () => guest.status().includes('等待对方落子') && guest.info().game.snapshot().hist.length === 0, '对方重开', 4000);
    assert('重开一局后双方棋盘为空', host.info().game.snapshot().hist.length === 0 && guest.info().game.snapshot().hist.length === 0);

    /* 6. 对方断开，房主收到通知并回到大厅 */
    guest.context.window.__gameInfo.online.ws.close();
    await waitFor(host, () => host.info().game === null && host.info().online.roomInfo && host.info().online.roomInfo.size === 1, '房主收到离开通知', 4000);
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
      const hostDice = host.$('game-extra').querySelector('.dice-btn');
      const guestDice = ludoGuest.$('game-extra').querySelector('.dice-btn');
      const hActive = !hostDice.disabled;
      const gActive = !guestDice.disabled;
      if (hActive || gActive){
        const act = hActive ? host : ludoGuest;
        act.$('game-extra').querySelector('.dice-btn').dispatch('click');
        for (let w = 0; w < 10 && !ludoMoved; w++){
          await sleep(400);
          const movable = act.area().querySelectorAll('.tok').filter(t => t.classList.contains('movable'));
          if (movable.length){
            movable[0].dispatch('click');
            ludoMoved = true;
            break;
          }
          if (!act.$('game-extra').querySelector('.dice-btn').disabled) break;
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
    // 故意让对方的动画/逻辑计时更慢，稳定覆盖 decision/下一次 roll 抢在旧动画回调前到达的场景。
    const monoSetup = await setupOnlineGame(host, 'monopoly', 'guest-mono', 1.25);
    const mGuest = monoSetup.guest;
    const monoEnvs = [host, mGuest];
    const monoSnapshot = env => env.info().game.snapshot();
    const monoActor = player => monoEnvs.find(env => env.info().online.player === player);
    const monoRollButton = env => env.area().children[0].querySelectorAll('button')[0];
    const waitMonoConvergence = async (timeoutMs) => {
      const start = Date.now();
      let hs = null, gs = null;
      while (Date.now() - start < timeoutMs){
        hs = monoSnapshot(host);
        gs = monoSnapshot(mGuest);
        if (JSON.stringify(hs) === JSON.stringify(gs) && (hs.over || hs.phase === 'roll')) return true;
        await sleep(50);
      }
      console.log('大富翁持久分歧 host=' + JSON.stringify(hs));
      console.log('大富翁持久分歧 guest=' + JSON.stringify(gs));
      return false;
    };
    const waitMonoNextActor = async (startPlayer, turn) => {
      const actor = monoActor(startPlayer);
      if (!actor) return monoSnapshot(host);
      const start = Date.now();
      let passSent = false;
      while (Date.now() - start < 10000){
        const actorState = monoSnapshot(actor);
        if (actorState.over) return actorState;
        if (!passSent && actorState.cur === startPlayer && actorState.phase === 'buy'){
          const actionRow = actor.$('game-extra').children[1];
          const pass = actionRow.children[actionRow.children.length - 1];
          if (pass){
            pass.dispatch('click');
            passSent = true;
          }
        }
        for (const env of monoEnvs){
          const state = monoSnapshot(env);
          if (state.over) return state;
          if (state.phase !== 'roll' || state.cur === startPlayer) continue;
          const nextActor = monoActor(state.cur);
          if (!nextActor) continue;
          const nextState = monoSnapshot(nextActor);
          if (nextState.phase === 'roll' && nextState.cur === state.cur && !monoRollButton(nextActor).disabled){
            return nextState;
          }
        }
        await sleep(25);
      }
      throw new Error('大富翁第 ' + turn + ' 次行动未完成');
    };
    let monoState = monoSnapshot(host);
    let monoConsistent = true;
    for (let i = 0; i < 8 && !monoState.over; i++){
      const player = monoState.cur;
      const actor = monoActor(player);
      const ready = await waitFor(actor, () => {
        const state = monoSnapshot(actor);
        const roll = monoRollButton(actor);
        return state.phase === 'roll' && state.cur === player && roll && !roll.disabled;
      }, '大富翁玩家' + (player + 1) + ' 可掷骰（第 ' + (i + 1) + ' 次）', 10000);
      if (!ready) break;
      monoRollButton(actor).dispatch('click');
      if (i === 0) assert('大富翁：掷骰期间进入 moving 阶段', monoSnapshot(actor).phase === 'moving');
      monoState = await waitMonoNextActor(player, i + 1);
      if ((i + 1) % 4 === 0 || monoState.over){
        monoConsistent = await waitMonoConvergence(10000);
        assert('大富翁：第 ' + (i + 1) + ' 次行动完成后双方最终一致', monoConsistent);
        if (!monoConsistent) break;
        monoState = monoSnapshot(host);
      }
    }
    const monoFinalConsistent = monoConsistent && await waitMonoConvergence(10000);
    assert('大富翁：多轮动作完成后双方状态一致', monoFinalConsistent);

    /* 10. 坦克大战联机：房主权威中继、输入去重、快照校正与一致结算 */
    host.$('btn-back').dispatch('click');
    await waitFor(host, () => !host.$('screen-hub').classList.contains('hidden'), '大富翁后回到大厅', 4000);
    const leaveBtn3 = btnByText(host.$('room-actions'), '离开房间');
    if (leaveBtn3) leaveBtn3.dispatch('click');
    await waitFor(host, () => host.$('room-panel').classList.contains('hidden'), '离开大富翁房间', 4000);
    const tankSetup = await setupOnlineGame(host, 'tank', 'guest-tank');
    const tankGuest = tankSetup.guest;
    const tankHostActions = host.$('game-extra').querySelector('.tank-realtime-controls').children;
    const tankGuestActions = tankGuest.$('game-extra').querySelector('.tank-realtime-controls').children;
    assert('坦克大战：联机双方显示摇杆和开炮控件', tankHostActions.length === 2 && tankGuestActions.length === 2);
    const tankBeforeHostProfile = host.info().roster.find(p => p.uid === host.info().deviceUid);
    const tankBeforeGuestProfile = tankGuest.info().roster.find(p => p.uid === tankGuest.info().deviceUid);
    const tankBefore = {
      hostCoins:tankBeforeHostProfile.coins, hostTotal:tankBeforeHostProfile.total, hostPlayed:tankBeforeHostProfile.played.tank||0,
      guestCoins:tankBeforeGuestProfile.coins, guestTotal:tankBeforeGuestProfile.total, guestPlayed:tankBeforeGuestProfile.played.tank||0,
    };
    const tankInput = async (actor,observer,controls,x,y,key,label) => {
      const slot=actor.info().online.player;
      controls[0].dispatch('pointerdown',{clientX:x,clientY:y,buttons:1});
      await waitFor(observer,()=>observer.info().game.snapshot().tanks[slot].input[key]===true,label+'按下',4000);
      controls[0].dispatch('pointerup');
      await waitFor(observer,()=>observer.info().game.snapshot().tanks[slot].input[key]===false,label+'释放',4000);
    };
    await tankInput(tankGuest,host,tankGuestActions,500,260,'right','客方右移');
    await tankInput(tankGuest,host,tankGuestActions,260,20,'up','客方上移');
    tankGuestActions[1].dispatch('click');
    await waitFor(host,()=>host.info().game.snapshot().tanks[1].shots>=1,'客方射击同步',4000);
    await tankInput(host,tankGuest,tankHostActions,20,260,'left','房主左移');
    await tankInput(host,tankGuest,tankHostActions,260,500,'down','房主下移');
    tankHostActions[1].dispatch('click');
    await waitFor(tankGuest,()=>tankGuest.info().game.snapshot().tanks[0].shots>=1,'房主射击同步',4000);
    assert('坦克大战：正常实时输入覆盖双方奖励动作阈值',host.info().game.getRelayState().lastInputSeq[1]>=5&&tankGuest.info().game.getRelayState().lastInputSeq[0]>=5);
    const acceptedGuestSeq=host.info().game.getRelayState().lastInputSeq[1];
    tankGuest.info().online.sendMove({act:'input',protocol:'tank-host-relay-v1',matchId:host.info().online.matchId,seq:acceptedGuestSeq,input:{left:true}});
    await sleep(250);
    assert('坦克大战：重复 input seq 不会二次应用',host.info().game.getRelayState().lastInputSeq[1]===acceptedGuestSeq&&host.info().game.snapshot().tanks[1].input.left===false);
    const hostDirection = host.info().game.snapshot().tanks[0].d;
    host.info().game.onMove({ act: 'move', d: 99 }, 0);
    assert('坦克大战：非法远端方向被忽略', host.info().game.snapshot().tanks[0].d === hostDirection);
    const correctionSeq=tankGuest.info().game.getRelayState().lastAuthoritySeq;
    const drift=JSON.parse(JSON.stringify(tankGuest.info().game.snapshot()));
    drift.tanks[0].x=host.info().game.snapshot().tanks[0].x>7?1.5:13.5;
    tankGuest.info().game.onRestore(drift);
    await waitFor(tankGuest,()=>tankGuest.info().game.getRelayState().lastAuthoritySeq>correctionSeq&&
      Math.abs(tankGuest.info().game.snapshot().tanks[0].x-host.info().game.snapshot().tanks[0].x)<.2,'房主快照校正客方漂移',4000);
    assert('坦克大战：非房主由房主周期快照校正',Math.abs(tankGuest.info().game.snapshot().tanks[0].x-host.info().game.snapshot().tanks[0].x)<.2);
    const tankMatchId=host.info().online.matchId;
    const tankSocketBeforeReconnect=tankGuest.info().online.ws;
    tankGuest.info().online.send({type:'debug_disconnect'});
    await waitFor(tankGuest,()=>tankGuest.info().online.connected&&tankGuest.info().online.ws&&tankGuest.info().online.ws!==tankSocketBeforeReconnect&&tankGuest.info().online.matchId===tankMatchId&&tankGuest.info().game&&!tankGuest.info().online._replaying,'坦克客方重连并完成快照回放',8000);
    const rejoinedTankActions=tankGuest.$('game-extra').querySelector('.tank-realtime-controls').children;
    const guestSeqBeforeResume=host.info().game.getRelayState().lastInputSeq[1];
    await tankInput(tankGuest,host,rejoinedTankActions,500,260,'right','客方重连后右移');
    assert('坦克大战：重连后 input seq 延续且可继续操作',host.info().game.getRelayState().lastInputSeq[1]>guestSeqBeforeResume);
    assert('坦克大战：非房主不能自行结束正式联机局',tankGuest.info().game.finishMatch()===false&&!tankGuest.info().game.snapshot().over);
    assert('坦克大战：房主也不能越过服务端提前结束',host.info().game.finishMatch()===false&&!host.info().game.snapshot().over);
    await waitFor(tankGuest,()=>tankGuest.info().game.snapshot().over&&tankGuest.info().game.getRelayState().resultCommitted,'客方接收服务端最终排名',20000);
    await waitFor(host,()=>{
      const me=host.info().roster.find(p=>p.uid===host.info().deviceUid);
      return me&&me.total===tankBefore.hostTotal+1;
    },'坦克房主结算到账',5000);
    await waitFor(tankGuest,()=>{
      const me=tankGuest.info().roster.find(p=>p.uid===tankGuest.info().deviceUid);
      return me&&me.total===tankBefore.guestTotal+1;
    },'坦克客方结算到账',5000);
    const tankAfterHost=host.info().roster.find(p=>p.uid===host.info().deviceUid);
    const tankAfterGuest=tankGuest.info().roster.find(p=>p.uid===tankGuest.info().deviceUid);
    assert('坦克大战：双方一致 claim 完成唯一结算',tankAfterHost.played.tank===tankBefore.hostPlayed+1&&tankAfterGuest.played.tank===tankBefore.guestPlayed+1&&tankAfterHost.coins===tankBefore.hostCoins+3&&tankAfterGuest.coins===tankBefore.guestCoins+1);

    /* 11. 俄罗斯方块联机：确定性 7-Bag、房主校正、重连收敛、KO/最终名次 */
    host.$('btn-back').dispatch('click');
    await waitFor(host, () => !host.$('screen-hub').classList.contains('hidden'), '坦克大战后回到大厅', 4000);
    const leaveTank = btnByText(host.$('room-actions'), '离开房间');
    if (leaveTank) leaveTank.dispatch('click');
    await waitFor(host, () => host.$('room-panel').classList.contains('hidden'), '离开坦克房间', 4000);
    const tetrisSetup = await setupOnlineGame(host, 'tetris', 'guest-tetris');
    const tetrisGuest = tetrisSetup.guest;
    const tetrisHostActions = host.$('game-extra').querySelector('.tetris-actions').children;
    const tetrisGuestActions = tetrisGuest.$('game-extra').querySelector('.tetris-actions').children;
    assert('俄罗斯方块：联机双方显示完整七项触控操作', tetrisHostActions.length === 7 && tetrisGuestActions.length === 7);
    const tetrisMatchId=host.info().online.matchId;
    const tetrisInitialHost=host.info().game.snapshot(),tetrisInitialGuest=tetrisGuest.info().game.snapshot();
    assert('俄罗斯方块：同 matchId/玩家的 7-Bag 完全确定',tetrisInitialHost.bagSeed===tetrisMatchId&&tetrisInitialGuest.bagSeed===tetrisMatchId&&JSON.stringify(tetrisInitialHost.states.map(state=>state.queue))===JSON.stringify(tetrisInitialGuest.states.map(state=>state.queue)));
    const tetrisBefore = JSON.stringify(host.info().game.snapshot().wells);
    host.info().game.onMove({ piece: 99, x: 0, y: 17, rot: 0 }, 0);
    assert('俄罗斯方块：非法远端方块编号被忽略', JSON.stringify(host.info().game.snapshot().wells) === tetrisBefore);
    await sleep(3200);
    tetrisHostActions[6].dispatch('click');
    await waitFor(tetrisGuest, () => tetrisGuest.info().game.snapshot().pieceCount === 1, '俄罗斯方块房主落块同步', 4000);
    assert('俄罗斯方块：房主落块后双方逻辑井一致', JSON.stringify(host.info().game.snapshot().wells) === JSON.stringify(tetrisGuest.info().game.snapshot().wells));
    tetrisGuestActions[6].dispatch('click');
    await waitFor(host, () => host.info().game.snapshot().pieceCount === 2, '俄罗斯方块对方落块同步', 4000);
    assert('俄罗斯方块：双方无需轮次即可落块且逻辑井一致', JSON.stringify(host.info().game.snapshot().wells) === JSON.stringify(tetrisGuest.info().game.snapshot().wells));
    const acceptedTetrisSeq=host.info().game.snapshot().relay.seenSeq[1];
    const guestActiveBefore=JSON.stringify(host.info().game.snapshot().states[1].active);
    tetrisGuest.info().online.sendMove({act:'active',seq:acceptedTetrisSeq,piece:0,x:-4,y:-6,rot:0});
    await sleep(250);
    assert('俄罗斯方块：重复发送方 seq 不会二次应用',host.info().game.snapshot().relay.seenSeq[1]===acceptedTetrisSeq&&JSON.stringify(host.info().game.snapshot().states[1].active)===guestActiveBefore);
    assert('俄罗斯方块：非房主不能自行生成最终排名',tetrisGuest.info().game.finishMatch()===false&&!tetrisGuest.info().game.snapshot().over);
    assert('俄罗斯方块：房主也不能越过服务端生成最终排名',host.info().game.finishMatch()===false&&!host.info().game.snapshot().over);

    const beforeReconnectPieces=host.info().game.snapshot().pieceCount;
    tetrisGuest.info().online.send({type:'debug_disconnect'});
    await waitFor(host,()=>host.info().online.roomInfo&&(host.info().online.roomInfo.seats||[]).some(seat=>seat.type==='human'&&seat.userId===tetrisGuest.info().deviceUid&&seat.online===false),'俄罗斯方块客方异常掉线',4000);
    tetrisHostActions[6].dispatch('click');
    await waitFor(host,()=>host.info().game.snapshot().pieceCount===beforeReconnectPieces+1,'俄罗斯方块掉线期间房主落块',4000);
    await waitFor(tetrisGuest,()=>tetrisGuest.info().online.matchId===tetrisMatchId&&tetrisGuest.info().game&&tetrisGuest.info().game.snapshot().pieceCount===host.info().game.snapshot().pieceCount,'俄罗斯方块重连回放 moveLog',8000);
    assert('俄罗斯方块：重连保留 matchId 且 moveLog 收敛',tetrisGuest.info().online.matchId===tetrisMatchId&&JSON.stringify(tetrisGuest.info().game.snapshot().wells)===JSON.stringify(host.info().game.snapshot().wells));
    await waitFor(host,()=>host.info().game.snapshot().over,'俄罗斯方块服务端定时结算',18000);
    await waitFor(tetrisGuest,()=>tetrisGuest.info().game.snapshot().over,'俄罗斯方块客方接收服务端最终排名',4000);
    const tetrisPlacements=host.info().game.snapshot().states.map(state=>state.placement);
    assert('俄罗斯方块：服务端下发唯一最终名次',new Set(tetrisPlacements).size===2&&JSON.stringify(tetrisPlacements)===JSON.stringify(tetrisGuest.info().game.snapshot().states.map(state=>state.placement)));

    /* 12. 邀请流程：房主从玩家列表邀请在线玩家 */
    host.$('btn-back').dispatch('click');
    await waitFor(host, () => !host.$('screen-hub').classList.contains('hidden'), '俄罗斯方块后回到大厅', 4000);
    const leaveTetris = btnByText(host.$('room-actions'), '离开房间');
    if (leaveTetris) leaveTetris.dispatch('click');
    await waitFor(host, () => host.$('room-panel').classList.contains('hidden'), '离开俄罗斯方块房间', 4000);
    const invitee = registerEnv(makeEnv('guest-inv'));
    await waitFor(invitee, () => /已连接服务器/.test(invitee.onlineStatus()), '受邀者连接', 5000);
    host.info().online.create({capacity:2,visibility:'public',allowSpectators:true});
    await waitFor(host, () => /房间已创建/.test(host.onlineStatus()), '创建邀请房间', 5000);
    await waitFor(host, () => {
      const btns = host.$('player-list').querySelectorAll('button').filter(b => b.textContent === '邀请');
      return btns.length >= 1;
    }, '玩家列表出现邀请按钮', 4000);
    const invUid = invitee.info().deviceUid;
    const invRow = host.$('player-list').children.find(row => {
      return !!row.querySelector('[data-uid="' + invUid + '"]');
    });
    const invBtn = invRow && invRow.children.find(b => b.textContent === '邀请');
    if (!invBtn) throw new Error('未找到 guest-inv 的邀请按钮');
    invBtn.dispatch('click');
    await waitFor(invitee, () => btnByText(invitee.context.document.body, '接受') !== null, '受邀者收到邀请弹窗', 4000);
    const acceptBtn = btnByText(invitee.context.document.body, '接受');
    acceptBtn.dispatch('click');
    await waitFor(invitee, () => invitee.info().online.room === host.info().online.room, '受邀者接受并加入房间', 4000);
    assert('邀请接受后双方进入同一房间', invitee.info().online.room === host.info().online.room && host.info().online.room !== null);

    /* 13. 多人数房间：玩家索引互不相同 + 不满人数也可开局 */
    invitee.context.window.__gameInfo.online.ws.close();
    await waitFor(host, () => host.info().online.roomInfo && host.info().online.roomInfo.size === 1, '房主收到受邀者离开', 4000);
    const leaveInv = btnByText(host.$('room-actions'), '离开房间');
    if (leaveInv) leaveInv.dispatch('click');
    await waitFor(host, () => host.$('room-panel').classList.contains('hidden'), '离开邀请房间', 4000);

    host.info().playerCount = 4;
    host.info().online.create({capacity:4,visibility:'public',allowSpectators:true});
    await waitFor(host, () => /房间已创建/.test(host.onlineStatus()), '创建 4 人房间', 5000);
    const room4 = host.info().online.room;
    host.info().startGame('gomoku');
    await waitFor(host, () => host.info().online.roomInfo && host.info().online.roomInfo.game === 'gomoku', '4 人容量房按当前人数可选 2 人游戏', 4000);
    assert('房间容量不限制按当前人数选游戏', host.info().online.roomInfo.capacity === 4 && host.info().online.roomInfo.game === 'gomoku');
    const g1 = registerEnv(makeEnv('guest-4p-1'));
    const g2 = registerEnv(makeEnv('guest-4p-2'));
    const g3 = registerEnv(makeEnv('guest-4p-3'));
    await waitFor(g1, () => /已连接服务器/.test(g1.onlineStatus()), '4人房玩家1连接', 5000);
    await waitFor(g2, () => /已连接服务器/.test(g2.onlineStatus()), '4人房玩家2连接', 5000);
    await waitFor(g3, () => /已连接服务器/.test(g3.onlineStatus()), '4人房玩家3连接', 5000);
    g1.info().online.join(room4);
    await waitFor(g1, () => g1.info().online.room === room4, '玩家1加入', 5000);
    g2.info().online.join(room4);
    await waitFor(g2, () => /最多支持 2 人/.test(g2.onlineStatus()), '已选 2 人游戏时拒绝第 3 人加入', 4000);
    assert('已选游戏人数上限约束后续加入', g2.info().online.room === null);
    host.info().startGame('monopoly');
    await waitFor(host, () => host.info().online.roomInfo && host.info().online.roomInfo.game === 'monopoly', '切回多人游戏', 4000);
    g2.info().online.join(room4);
    await waitFor(g2, () => g2.info().online.room === room4, '玩家2加入', 5000);
    await waitFor(host, () => host.info().online.roomInfo && host.info().online.roomInfo.size === 3, '房主看到 3 人', 5000);
    const playersIdx = host.info().online.roomInfo.players.map(p => p.player);
    assert('多人数房间：玩家索引 0/1/2 互不相同', JSON.stringify(playersIdx) === JSON.stringify([0, 1, 2]));
    assert('多人数房间：各玩家身份不同', g1.info().online.player === 1 && g2.info().online.player === 2);

    /* 14. 不满人数开局：3 人玩大富翁 */
    host.info().startGame('monopoly');
    await waitFor(host, () => host.info().online.roomInfo&&host.info().online.roomInfo.game==='monopoly', '3 人房选择大富翁', 4000);
    g1.info().online.setReady(true);g2.info().online.setReady(true);
    await waitFor(host,()=>host.info().online.roomInfo&&host.info().online.roomInfo.canStart,'3 人房 READY',4000);
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

    /* 15. 结束本局：回大厅并可在同一房间切换游戏 */
    host.$('btn-end-game').dispatch('click');
    await waitFor(host, () => host.info().game === null && !host.$('screen-hub').classList.contains('hidden'), '房主结束本局回大厅', 5000);
    await waitFor(g1, () => g1.info().game === null && !g1.$('screen-hub').classList.contains('hidden'), '玩家2结束本局回大厅', 5000);
    await waitFor(g2, () => g2.info().game === null && g2.$('screen-hub').classList.contains('hidden') === false, '玩家3结束本局回大厅', 5000);
    assert('结束本局后房间保留', host.info().online.room === room4 && host.$('room-panel').classList.contains('hidden') === false);
    host.info().startGame('ludo');
    await waitFor(host, () => host.info().online.roomInfo&&host.info().online.roomInfo.game==='ludo', '同一房间切换为飞行棋', 4000);
    g1.info().online.setReady(true);g2.info().online.setReady(true);
    await waitFor(host,()=>host.info().online.roomInfo&&host.info().online.roomInfo.canStart,'飞行棋 READY',4000);
    const startBtn2 = [...host.$('room-actions').children].find(b => (b.textContent || '').includes('开始游戏'));
    startBtn2.dispatch('click');
    await waitFor(host, () => host.info().game !== null && host.info().game.snapshot && host.info().game.snapshot().tokens.length === 3, '3 人飞行棋开局', 5000);
    await waitFor(g1, () => g1.info().game !== null && g1.info().game.snapshot && g1.info().game.snapshot().tokens.length === 3, '玩家2飞行棋开局', 5000);
    await waitFor(g2, () => g2.info().game !== null && g2.info().game.snapshot && g2.info().game.snapshot().tokens.length === 3, '玩家3飞行棋开局', 5000);
    assert('切换游戏后 3 人飞行棋正常', host.info().game.snapshot().tokens.length === 3 && g1.info().game.snapshot().tokens.length === 3);

    /* 16. 三人局中间席位离开：旧局结束、房间保留、后续席位压紧 */
    const abandonedMatchId = host.info().online.matchId;
    assert('离房回归：三人旧局带有效 matchId', typeof abandonedMatchId === 'string' && abandonedMatchId.length > 0);
    assert('离房回归：离开前玩家索引为 0/1/2', host.info().online.player === 0 && g1.info().online.player === 1 && g2.info().online.player === 2);
    const leaveMiddle = btnByText(g1.$('room-actions'), '离开房间');
    assert('离房回归：对局中玩家2仍可主动离开', !!leaveMiddle);
    leaveMiddle.dispatch('click');
    await waitFor(g1, () => g1.info().online.room === null && g1.$('room-panel').classList.contains('hidden'), '玩家2主动离开三人局', 4000);
    await waitFor(host, () => host.info().game === null && host.info().online.room === room4 && host.info().online.roomInfo && host.info().online.roomInfo.size === 2 && host.info().online.roomInfo.started === false, '房主结束旧局但保留房间', 5000);
    await waitFor(g2, () => g2.info().game === null && g2.info().online.room === room4 && g2.info().online.player === 1 && g2.info().online.roomInfo && g2.info().online.roomInfo.size === 2 && g2.info().online.roomInfo.started === false, '原 slot 2 收到 player_reassigned', 5000);
    assert('离房回归：其余双方回到大厅且旧 matchId 清空', !host.$('screen-hub').classList.contains('hidden') && !g2.$('screen-hub').classList.contains('hidden') && host.info().online.matchId === null && g2.info().online.matchId === null);
    assert('离房回归：房间仍由原房主和原 slot 2 保留', host.info().online.room === room4 && g2.info().online.room === room4 && !host.$('room-panel').classList.contains('hidden') && !g2.$('room-panel').classList.contains('hidden'));
    assert('离房回归：player_reassigned 将原 slot 2 压紧为 slot 1', g2.info().online.player === 1 && JSON.stringify(host.info().online.roomInfo.players.map(p => p.player)) === JSON.stringify([0, 1]));

    /* 17. 压紧后的两人可重新开局并完成服务端共识结算 */
    const hostBeforeLifecycle = host.info().roster.find(p => p.uid === host.info().deviceUid);
    const g2BeforeLifecycle = g2.info().roster.find(p => p.uid === g2.info().deviceUid);
    const hostTotalBeforeLifecycle = hostBeforeLifecycle.total;
    const hostCoinsBeforeLifecycle = hostBeforeLifecycle.coins;
    const g2TotalBeforeLifecycle = g2BeforeLifecycle.total;
    const g2CoinsBeforeLifecycle = g2BeforeLifecycle.coins;
    const hostGomokuBeforeLifecycle = hostBeforeLifecycle.played.gomoku || 0;
    const g2GomokuBeforeLifecycle = g2BeforeLifecycle.played.gomoku || 0;
    host.info().startGame('gomoku');
    await waitFor(host, () => host.info().online.roomInfo && host.info().online.roomInfo.game === 'gomoku', '压紧后选择五子棋', 4000);
    g2.info().online.setReady(true);
    await waitFor(host,()=>host.info().online.roomInfo&&host.info().online.roomInfo.canStart,'压紧后 READY',4000);
    const compactedStartBtn = [...host.$('room-actions').children].find(b => (b.textContent || '').includes('开始游戏'));
    assert('离房回归：压紧后的两人房显示开始按钮', !!compactedStartBtn);
    compactedStartBtn.dispatch('click');
    await waitFor(host, () => host.info().game !== null && host.info().playerCount === 2 && host.info().online.matchId, '压紧后房主进入新局', 5000);
    await waitFor(g2, () => g2.info().game !== null && g2.info().playerCount === 2 && g2.info().online.matchId === host.info().online.matchId, '压紧后玩家2进入新局', 5000);
    assert('离房回归：新局使用新的 matchId', host.info().online.matchId !== abandonedMatchId);
    const compactedMoves = [
      [host, g2, [7,3]], [g2, host, [3,3]], [host, g2, [7,4]], [g2, host, [3,4]],
      [host, g2, [7,5]], [g2, host, [3,5]], [host, g2, [7,6]], [g2, host, [3,6]], [host, g2, [7,7]],
    ];
    for (let i = 0; i < compactedMoves.length; i++){
      const [actor, observer, coord] = compactedMoves[i];
      await waitFor(actor, () => {
        const snap = actor.info().game && actor.info().game.snapshot();
        return snap && !snap.over && snap.cur === actor.info().online.player && snap.hist.length === i;
      }, '压紧后五子棋行动 ' + (i + 1), 4000);
      stone(actor, actor.area().children[0], coord[0], coord[1]);
      await waitFor(observer, () => {
        const snap = observer.info().game && observer.info().game.snapshot();
        return snap && snap.hist.length === i + 1 && JSON.stringify(snap.last) === JSON.stringify(coord);
      }, '压紧后五子棋同步 ' + (i + 1), 4000);
    }
    await waitFor(host, () => host.info().game.snapshot().over && host.status().includes('玩家1 获胜'), '压紧后房主获胜', 4000);
    await waitFor(g2, () => g2.info().game.snapshot().over && g2.status().includes('玩家1 获胜'), '压紧后玩家2看到结果', 4000);
    await waitFor(host, () => {
      const me = host.info().roster.find(p => p.uid === host.info().deviceUid);
      return me && me.total === hostTotalBeforeLifecycle + 1 && me.coins === hostCoinsBeforeLifecycle + 3;
    }, '压紧后房主结算到账', 5000);
    await waitFor(g2, () => {
      const me = g2.info().roster.find(p => p.uid === g2.info().deviceUid);
      return me && me.total === g2TotalBeforeLifecycle + 1 && me.coins === g2CoinsBeforeLifecycle + 1;
    }, '压紧后玩家2结算到账', 5000);
    const hostAfterLifecycle = host.info().roster.find(p => p.uid === host.info().deviceUid);
    const g2AfterLifecycle = g2.info().roster.find(p => p.uid === g2.info().deviceUid);
    assert('离房回归：新局共识结算双方各计一局', hostAfterLifecycle.total === hostTotalBeforeLifecycle + 1 && g2AfterLifecycle.total === g2TotalBeforeLifecycle + 1);
    assert('离房回归：胜者 +3💵、败者 +1💵', hostAfterLifecycle.coins === hostCoinsBeforeLifecycle + 3 && g2AfterLifecycle.coins === g2CoinsBeforeLifecycle + 1);
    assert('离房回归：五子棋分类局数同步增加', hostAfterLifecycle.played.gomoku === hostGomokuBeforeLifecycle + 1 && g2AfterLifecycle.played.gomoku === g2GomokuBeforeLifecycle + 1);

    /* 18. 房主主动离开：转移房主；最后一名真人离开才关闭 */
    const closeLifecycleRoom = btnByText(host.$('room-actions'), '离开房间');
    assert('房主转移回归：原房主可主动离开', !!closeLifecycleRoom);
    closeLifecycleRoom.dispatch('click');
    await waitFor(host, () => host.info().online.room === null && host.$('room-panel').classList.contains('hidden'), '原房主离开旧房间', 4000);
    await waitFor(g2, () => g2.info().online.room===room4&&g2.info().online.isHost&&g2.info().game===null, '剩余玩家接任房主', 5000);
    assert('房主主动离开后房间保留',g2.info().online.room===room4&&g2.info().online.isHost);
    host.info().online.join(room4);await waitFor(host,()=>host.info().online.room===room4,'原房主重新加入保留房',5000);
    const g2Leave=btnByText(g2.$('room-actions'),'离开房间');g2Leave.dispatch('click');await waitFor(host,()=>host.info().online.isHost&&host.info().online.room===room4,'房主再次转移',5000);
    const finalLeave=btnByText(host.$('room-actions'),'离开房间');finalLeave.dispatch('click');await waitFor(host,()=>host.info().online.room===null,'最后真人离开关闭房间',5000);
    g2.info().online.create({capacity:2,visibility:'public',allowSpectators:true});
    await waitFor(g2, () => /房间已创建/.test(g2.onlineStatus()) && g2.info().online.room, '会话立即创建新房', 5000);
    const recycledRoom = g2.info().online.room;
    assert('关房回归：新房与已关闭房间不同', /^[A-Z0-9]{6}$/.test(recycledRoom) && recycledRoom !== room4);
    host.info().online.join(recycledRoom);
    await waitFor(host, () => host.info().online.room === recycledRoom, '原房主会话立即加入新房', 5000);
    await waitFor(g2, () => g2.info().online.roomInfo && g2.info().online.roomInfo.size === 2, '新房双方会话就位', 5000);
    assert('关房回归：旧房双方会话可立即重组新房', host.info().online.room === recycledRoom && g2.info().online.room === recycledRoom && host.info().online.player === 1 && g2.info().online.player === 0);

    /* 19. 人机模式：本地 AI 自动回应 */
    const aiEnv = registerEnv(makeEnv('ai-local'));
    await waitFor(aiEnv, () => /已连接服务器/.test(aiEnv.onlineStatus()), 'AI 环境连接', 5000);
    aiEnv.info().aiMode = true;
    aiEnv.info().playerCount = 2;
    aiEnv.info().launchGame('gomoku',2);
    stone(aiEnv, aiEnv.area().children[0], 7, 7);
    await waitFor(aiEnv, () => aiEnv.info().game.snapshot().hist.length === 2 && aiEnv.info().game.snapshot().cur === 0, 'AI 自动回应', 6000);
    assert('人机模式：五子棋 AI 自动回应并继续对局', aiEnv.info().game.snapshot().hist.length === 2);

    console.log(process.exitCode ? 'E2E_HAS_FAILURES' : 'E2E_ALL_PASS');
  } finally {
    for (const e of allEnvs){
      try { const ws = e.info().online.ws; if (ws) ws.close(); } catch {}
    }
    server.kill();
    try { fs.rmSync(TEST_ROOT, { recursive: true, force: true }); } catch {}
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
