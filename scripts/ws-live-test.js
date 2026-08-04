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

(async () => {
  setTimeout(() => {
    console.error('MASTER TIMEOUT');
    process.exit(1);
  }, 60000).unref();
  const a = client(uidA, 'A');
  const b = client(uidB, 'B');
  await waitOpen(a);
  await waitOpen(b);
  send(a, 'hello', { uid: uidA });
  send(b, 'hello', { uid: uidB });
  send(a, 'profile', { uid: uidA, name: '测试A', avatar: 1 });
  send(b, 'profile', { uid: uidB, name: '测试B', avatar: 2 });

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
  console.log('\nLIVE TEST PASSED ✅');
  process.exit(0);
})().catch((e) => {
  console.error('LIVE TEST FAILED ❌', e.message);
  process.exit(1);
});
