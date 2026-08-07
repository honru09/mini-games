// 线上 WebSocket 冒烟测试：两个客户端建房/加入/开局
// 用法：node scripts/ws-live-test.js [wss://.../ws]
const WS_URL = process.argv[2] || 'wss://mini-games-online.onrender.com/ws';
const uidA = 'wstest_a_' + Date.now();
const uidB = 'wstest_b_' + Date.now();

function client(uid, name) {
  const ws = new WebSocket(WS_URL);
  const log = [];
  ws.onerror = (e) => console.log(`[${name}] WS ERROR`, e.message || e);
  ws.onclose = (e) => console.log(`[${name}] WS CLOSED code=${e.code} reason=${e.reason}`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    log.push(msg);
    console.log(`[${name}]`, msg.type, JSON.stringify(msg.payload || {}).slice(0, 120));
  };
  return { ws, log, name };
}

function waitOpen(c) {
  return new Promise((resolve, reject) => {
    c.ws.addEventListener('open', () => resolve(), { once: true });
    c.ws.addEventListener('error', () => reject(new Error(c.name + ' 连接失败')), { once: true });
  });
}

function send(c, type, payload) {
  c.ws.send(JSON.stringify({ type, payload }));
}

function waitFor(c, type, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const existing = [...c.log].reverse().find(msg => msg.type === type);
    if (existing) { resolve(existing); return; }
    const t = setTimeout(() => reject(new Error(`${c.name} 未收到 ${type}`)), timeout);
    const check = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === type) {
        clearTimeout(t);
        c.ws.removeEventListener('message', check);
        resolve(msg);
      }
    };
    c.ws.addEventListener('message', check);
  });
}
const lastOf = (c, type) => [...c.log].reverse().find(m => m.type === type);
async function registerLive(c, name, suffix){
  const pending = waitFor(c, 'registered');
  send(c, 'register', {
    uid: 'u_live' + suffix,
    pin: ('Live' + suffix).replace(/[^A-Za-z0-9]/g, '').slice(0, 20),
    name,
    avatar: 0,
    ephemeral: true,
  });
  return pending;
}

(async () => {
  setTimeout(() => {
    console.error('MASTER TIMEOUT');
    process.exit(1);
  }, 60000).unref();
  const a = client(uidA, 'A');
  const b = client(uidB, 'B');
  await waitOpen(a);
  await waitOpen(b);
  await registerLive(a, '测试A', Date.now().toString(36) + 'a');
  await registerLive(b, '测试B', Date.now().toString(36) + 'b');

  send(a, 'create', { capacity: 2 });
  const created = await waitFor(a, 'created');
  const room = created.room;
  console.log('=== 房间创建成功:', room, '===');

  send(a, 'select_game', { game: 'gomoku' });
  const startedP = waitFor(a, 'started');
  send(b, 'join', { room });
  const started = await startedP;
  console.log('=== 自动开局成功:', started.game, '===');

  // 简单走一步棋验证同步
  send(a, 'move', { x: 7, y: 7 });
  const mv = await waitFor(b, 'move', 8000);
  console.log('=== 落子同步成功:', JSON.stringify(mv.payload), '===');

  a.ws.close();
  b.ws.close();

  /* ---- 场景2：4 人房间 + 不满人数开局 + 结束切游戏 ---- */
  const clients = [client('H'), client('P2'), client('P3')];
  for (const c of clients) await waitOpen(c);
  const liveSuffix = Date.now().toString(36);
  await Promise.all(clients.map((c, i) => registerLive(c, i === 0 ? '房主' : ('玩家' + (i + 1)), liveSuffix + i)));
  send(clients[0], 'create', { capacity: 4 });
  const created2 = await waitFor(clients[0], 'created');
  const room2 = created2.room;
  console.log('=== 4 人房间创建成功:', room2, '===');
  send(clients[0], 'select_game', { game: 'monopoly' });
  for (let i = 1; i < 3; i++){
    send(clients[i], 'join', { room: room2 });
    await waitFor(clients[i], 'joined');
  }
  for (let w = 0; w < 40; w++){
    const ru = lastOf(clients[0], 'room_update');
    if (ru && ru.payload.size === 3) break;
    await new Promise(r => setTimeout(r, 200));
  }
  const ru3 = lastOf(clients[0], 'room_update');
  const pIdx = ru3.payload.players.map(p => p.player);
  console.log('=== 玩家索引:', JSON.stringify(pIdx), '===');
  if (pIdx.join(',') !== '0,1,2') throw new Error('玩家索引异常');
  send(clients[0], 'start');
  const started3 = await waitFor(clients[0], 'started');
  console.log('=== 不满人数开局成功:', started3.size, '人局 ===');
  if (started3.size !== 3) throw new Error('人数错误');
  send(clients[0], 'end_game');
  await waitFor(clients[1], 'end_game');
  await new Promise(r => setTimeout(r, 500));
  const afterEnd = lastOf(clients[0], 'room_update');
  console.log('=== 结束本局后房间 game:', afterEnd.payload.game, 'started:', afterEnd.payload.started, '===');
  if (afterEnd.payload.game !== null || afterEnd.payload.started !== false) throw new Error('结束本局失败');
  clients.forEach(c => c.ws.close());
  console.log('\nLIVE TEST PASSED ✅');
  process.exit(0);
})().catch((e) => {
  console.error('LIVE TEST FAILED ❌', e.message);
  process.exit(1);
});
