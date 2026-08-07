// WebSocket / HTTP 安全回归：服务端鉴权、权威结算、商城与 AI 边界。
// Node 20: node --experimental-websocket qa/security-online.js
// Node 22+: node qa/security-online.js
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const WAIT_MS = 5000;
const failures = [];
const clients = [];
let server = null;
let serverOut = '';
let sandboxRoot = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function pass(name){
  console.log('PASS  ' + name);
}

function fail(name, detail){
  failures.push({ name, detail: detail || '' });
  console.log('FAIL  ' + name + (detail ? ' :: ' + detail : ''));
}

function check(name, condition, detail){
  if (condition) pass(name);
  else fail(name, detail);
  return !!condition;
}

function requireValue(value, description){
  if (!value) throw new Error(description);
  return value;
}

function reservePort(){
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(err => err ? reject(err) : resolve(port));
    });
  });
}

function httpRequest(port, options = {}){
  const body = options.body === undefined
    ? null
    : (Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body)));
  const headers = { ...(options.headers || {}) };
  if (body && headers['Content-Length'] === undefined) headers['Content-Length'] = String(body.length);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: options.path || '/',
      method: options.method || 'GET',
      headers,
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        text: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.once('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitServer(port){
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline){
    if (server && server.exitCode !== null){
      throw new Error('服务端提前退出（code=' + server.exitCode + '）\n' + serverOut.slice(-3000));
    }
    try {
      const response = await httpRequest(port, { path: '/api/ip' });
      if (response.status === 200) return;
    } catch {}
    await sleep(80);
  }
  throw new Error('等待安全测试服务端就绪超时\n' + serverOut.slice(-3000));
}

class WsClient {
  constructor(label, url){
    this.label = label;
    this.url = url;
    this.ws = null;
    this.seq = 0;
    this.messages = [];
    this.closed = false;
  }

  async open(){
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(this.label + ' WebSocket 连接超时')), WAIT_MS);
      this.ws.addEventListener('message', event => {
        let message;
        try { message = JSON.parse(String(event.data)); }
        catch { message = { type: '__invalid_json__', raw: String(event.data) }; }
        this.messages.push({ seq: ++this.seq, message });
      });
      this.ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error(this.label + ' WebSocket 连接失败'));
      }, { once: true });
      this.ws.addEventListener('close', () => { this.closed = true; });
    });
    clients.push(this);
    return this;
  }

  mark(){ return this.seq; }

  send(message){
    if (!this.ws || this.ws.readyState !== 1) throw new Error(this.label + ' WebSocket 未连接');
    this.ws.send(JSON.stringify(message));
  }

  async waitAfter(mark, predicate, description, timeout = WAIT_MS){
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline){
      for (const entry of this.messages){
        if (entry.seq > mark && predicate(entry.message)) return entry.message;
      }
      if (this.closed) throw new Error(this.label + ' 已断开，等待：' + description);
      await sleep(20);
    }
    const tail = this.messages.slice(-8).map(x => x.message.type).join(', ');
    throw new Error(this.label + ' 等待超时：' + description + '；最近消息：' + (tail || '(无)'));
  }

  async request(message, predicate, description, timeout){
    const mark = this.mark();
    this.send(message);
    return this.waitAfter(mark, predicate, description, timeout);
  }

  close(){
    if (!this.ws) return;
    try {
      if (this.ws.readyState === 0 || this.ws.readyState === 1) this.ws.close();
    } catch {}
  }

  async waitClosed(description, timeout = WAIT_MS){
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline){
      if (this.closed || (this.ws && this.ws.readyState === 3)) return true;
      await sleep(20);
    }
    throw new Error(this.label + ' 等待断开超时：' + description);
  }
}

function isReject(message){
  if (!message || typeof message.type !== 'string') return false;
  return message.type === 'error' || message.type === 'auth_error' || message.type === 'forbidden' ||
    message.type === 'purchase_error' || message.type === 'result_error' || message.type === 'profile_error' ||
    /_rejected$/.test(message.type);
}

function rejectReason(message){
  if (!message) return '';
  return String(message.code || message.msg || (message.payload && (message.payload.code || message.payload.msg)) || '');
}

function isHelloResult(message){
  return !!message && (message.type === 'hello_ack' || isReject(message));
}

function helloAuthenticated(message){
  if (!message || message.type !== 'hello_ack') return false;
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
  return message.authenticated === true || payload.authenticated === true || message.auth === true || payload.auth === true;
}

function payloadOf(message){
  return message && message.payload && typeof message.payload === 'object' ? message.payload : {};
}

function profileOf(message){
  const payload = payloadOf(message);
  return payload.profile && typeof payload.profile === 'object' ? payload.profile : payload;
}

function tokenOf(message){
  const payload = payloadOf(message);
  return message && (message.token || payload.token || (payload.session && payload.session.token)) || '';
}

function uidOf(message){
  const payload = payloadOf(message);
  const profile = profileOf(message);
  return String(payload.uid || (profile && profile.uid) || '');
}

function matchIdOf(message){
  const payload = payloadOf(message);
  return String((message && (message.matchId || message.match_id)) || payload.matchId || payload.match_id || '');
}

function canonicalOwned(owned){
  const value = owned && typeof owned === 'object' ? owned : {};
  const out = {};
  for (const category of ['avatars', 'frames', 'effects', 'backgrounds']){
    out[category] = Array.isArray(value[category])
      ? [...new Set(value[category].map(Number).filter(Number.isInteger))].sort((a, b) => a - b)
      : [];
  }
  return out;
}

function protectedState(profile){
  return {
    coins: Number(profile && profile.coins || 0),
    xp: Number(profile && profile.xp || 0),
    level: Number(profile && profile.level || 1),
    total: Number(profile && profile.total || 0),
    played: JSON.stringify(profile && profile.played || {}),
    owned: JSON.stringify(canonicalOwned(profile && profile.owned)),
  };
}

function sameProtectedState(a, b){
  return JSON.stringify(protectedState(a)) === JSON.stringify(protectedState(b));
}

async function expectRejected(client, message, description){
  const response = await client.request(message, isReject, description + '应返回拒绝');
  pass(description + '被明确拒绝' + (rejectReason(response) ? '（' + rejectReason(response) + '）' : ''));
  return response;
}

async function register(client, account){
  const response = await client.request({
    type: 'register',
    payload: {
      uid: account.uid,
      pin: account.pin,
      name: account.name,
      avatar: 2,
      background: 0,
      frame: 8,
      effect: 4,
      nameFx: 4,
      coins: 999999,
      xp: 999999,
      level: 99,
      pin_hash: 'attacker-controlled',
      owned: {
        avatars: [30, 31, 55],
        frames: [1, 8],
        effects: [1, 4],
        backgrounds: [1, 10],
      },
    },
  }, message => message.type === 'registered' || isReject(message), client.label + ' 注册');
  if (response.type !== 'registered') throw new Error(client.label + ' 注册失败：' + rejectReason(response));
  return {
    uid: requireValue(uidOf(response), client.label + ' 注册响应缺少 uid'),
    token: requireValue(tokenOf(response), client.label + ' 注册响应缺少 token'),
    profile: profileOf(response),
  };
}

async function authenticate(label, url, account){
  const client = await new WsClient(label, url).open();
  const response = await client.request({
    type: 'hello',
    payload: { uid: account.uid, token: account.token, proto: 1 },
  }, isHelloResult, label + ' token hello');
  check(label + ' 携带 token 的 hello 通过认证', helloAuthenticated(response), JSON.stringify(response));
  return client;
}

async function getProfile(client, uid){
  const response = await client.request(
    { type: 'profile_get', payload: { uid } },
    message => message.type === 'profile_data' || isReject(message),
    '读取档案 ' + uid,
  );
  if (response.type !== 'profile_data') throw new Error('读取档案被拒绝：' + rejectReason(response));
  return profileOf(response);
}

async function waitProfile(client, uid, predicate, description, timeout = WAIT_MS){
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline){
    last = await getProfile(client, uid);
    if (predicate(last)) return last;
    await sleep(80);
  }
  throw new Error(description + ' 超时；最后档案=' + JSON.stringify(last));
}

function loginResult(message){
  return !!message && (message.type === 'logged_in' || isReject(message));
}

async function login(label, url, pin){
  const client = await new WsClient(label, url).open();
  const response = await client.request({ type: 'login', payload: { pin } }, loginResult, label + ' PIN 登录');
  return { client, response };
}

function resultClaim(matchId, winnerSlot = 0){
  return {
    type: 'result',
    payload: {
      matchId,
      game: 'tictactoe',
      results: [
        { slot: 0, coins: winnerSlot === 0 ? 1 : 0, rank: winnerSlot === 0 ? 1 : 2 },
        { slot: 1, coins: winnerSlot === 1 ? 1 : 0, rank: winnerSlot === 1 ? 1 : 2 },
      ],
    },
  };
}

async function startFirstMatch(host, guest){
  const created = await host.request(
    { type: 'create', payload: { capacity: 2 } },
    message => message.type === 'created' || isReject(message),
    '创建安全测试房间',
  );
  if (created.type !== 'created') throw new Error('创建房间失败：' + rejectReason(created));
  const room = String(created.room || payloadOf(created).room || '');
  requireValue(room, 'created 响应缺少房间号');
  const hostRoomMark = host.mark();
  const joined = await guest.request(
    { type: 'join', payload: { room } },
    message => message.type === 'joined' || isReject(message),
    '加入安全测试房间',
  );
  if (joined.type !== 'joined') throw new Error('加入房间失败：' + rejectReason(joined));
  await host.waitAfter(hostRoomMark, message => message.type === 'room_update' && Number(payloadOf(message).size) === 2, '房主看到两位玩家');
  return startSelectedMatch(host, guest, null);
}

async function verifyMoveEnvelope(host, guest){
  const guestMark = guest.mark();
  host.send({ type: 'move', payload: 0 });
  const forwarded = await guest.waitAfter(guestMark, message => message.type === 'move', '井字棋数字落子被转发');
  check('井字棋数字 payload 不被服务端误丢弃', forwarded.payload === 0, JSON.stringify(forwarded));
  check('move 广播携带服务端认定的发送者编号', forwarded.player === 0, JSON.stringify(forwarded));
}

async function verifyMonopolyHostSettle(host, guest){
  const hostEndMark = host.mark();
  const guestEndMark = guest.mark();
  host.send({ type: 'end_game' });
  await Promise.all([
    host.waitAfter(hostEndMark, message => message.type === 'end_game', '权限测试前结束井字棋'),
    guest.waitAfter(guestEndMark, message => message.type === 'end_game', '对手同步结束井字棋'),
  ]);
  const hostStartMark = host.mark();
  const guestStartMark = guest.mark();
  host.send({ type: 'select_game', payload: { game: 'monopoly' } });
  await Promise.all([
    host.waitAfter(hostStartMark, message => message.type === 'started' || isReject(message), '房主开始大富翁权限测试'),
    guest.waitAfter(guestStartMark, message => message.type === 'started' || isReject(message), '对手进入大富翁权限测试'),
  ]);
  await expectRejected(guest, { type: 'move', payload: { decision: 'settle' } }, '非房主提前结算大富翁');
  const guestMoveMark = guest.mark();
  host.send({ type: 'move', payload: { decision: 'settle' } });
  const forwarded = await guest.waitAfter(guestMoveMark,
    message => message.type === 'move' && payloadOf(message).decision === 'settle', '房主提前结算广播');
  check('房主提前结算仍可正常广播', forwarded.player === 0, JSON.stringify(forwarded));
}

async function startSelectedMatch(host, guest, previousMatchId){
  if (previousMatchId){
    const hostEndMark = host.mark();
    const guestEndMark = guest.mark();
    host.send({ type: 'end_game' });
    await Promise.all([
      host.waitAfter(hostEndMark, message => message.type === 'end_game', '房主结束上一局'),
      guest.waitAfter(guestEndMark, message => message.type === 'end_game', '对手结束上一局'),
    ]);
  }
  const hostMark = host.mark();
  const guestMark = guest.mark();
  host.send({ type: 'select_game', payload: { game: 'tictactoe' } });
  const [hostStarted, guestStarted] = await Promise.all([
    host.waitAfter(hostMark, message => message.type === 'started' || isReject(message), '房主收到 started'),
    guest.waitAfter(guestMark, message => message.type === 'started' || isReject(message), '对手收到 started'),
  ]);
  if (hostStarted.type !== 'started' || guestStarted.type !== 'started') throw new Error('对局启动失败');
  const hostMatchId = matchIdOf(hostStarted);
  const guestMatchId = matchIdOf(guestStarted);
  check('started 为双方下发相同 matchId', !!hostMatchId && hostMatchId === guestMatchId,
    'host=' + hostMatchId + ', guest=' + guestMatchId);
  if (previousMatchId) check('新一局使用新的 matchId', hostMatchId !== previousMatchId,
    'previous=' + previousMatchId + ', current=' + hostMatchId);
  return requireValue(hostMatchId, 'started 响应缺少 matchId');
}

async function settleMatch(host, guest, accounts, matchId){
  const beforeA = await getProfile(host, accounts.a.uid);
  const beforeB = await getProfile(guest, accounts.b.uid);

  host.send(resultClaim(matchId));
  await sleep(120);
  const pendingA = await getProfile(host, accounts.a.uid);
  const pendingB = await getProfile(guest, accounts.b.uid);
  check('只有一方 claim 时不结算', sameProtectedState(beforeA, pendingA) && sameProtectedState(beforeB, pendingB));

  guest.send(resultClaim(matchId));
  const settledA = await waitProfile(host, accounts.a.uid,
    profile => Number(profile.coins || 0) === Number(beforeA.coins || 0) + 1 && Number(profile.total || 0) === Number(beforeA.total || 0) + 1,
    '双方一致 claim 后胜方结算');
  const settledB = await waitProfile(guest, accounts.b.uid,
    profile => Number(profile.total || 0) === Number(beforeB.total || 0) + 1,
    '双方一致 claim 后负方结算');
  check('一致 claim 后由服务端给胜方 +$1', Number(settledA.coins || 0) === Number(beforeA.coins || 0) + 1);
  check('一致 claim 后双方各只增加一局', Number(settledA.total || 0) === Number(beforeA.total || 0) + 1 &&
    Number(settledB.total || 0) === Number(beforeB.total || 0) + 1);
  check('负方不能凭 result 获得金币', Number(settledB.coins || 0) === Number(beforeB.coins || 0));

  host.send(resultClaim(matchId));
  guest.send(resultClaim(matchId));
  await sleep(220);
  const replayA = await getProfile(host, accounts.a.uid);
  const replayB = await getProfile(guest, accounts.b.uid);
  check('重复 result 不重复加金币/场次', sameProtectedState(settledA, replayA) && sameProtectedState(settledB, replayB));
  return { a: replayA, b: replayB };
}

async function disputeMatch(host, guest, accounts, matchId){
  const beforeA = await getProfile(host, accounts.a.uid);
  const beforeB = await getProfile(guest, accounts.b.uid);
  await expectRejected(host, {
    type: 'result',
    payload: {
      game: 'tictactoe',
      results: [
        { slot: 0, coins: 1, rank: 1 },
        { slot: 1, coins: 0, rank: 2 },
      ],
    },
  }, '缺少 matchId 的 result');
  const afterInvalid = await getProfile(host, accounts.a.uid);
  check('缺少 matchId 不产生奖励', sameProtectedState(beforeA, afterInvalid));

  const hostClaimMark = host.mark();
  host.send(resultClaim(matchId, 0));
  await host.waitAfter(hostClaimMark, message => message.type === 'result_pending', '第一方 claim 等待共识');
  const hostDisputeMark = host.mark();
  const guestDisputeMark = guest.mark();
  guest.send(resultClaim(matchId, 1));
  await Promise.all([
    host.waitAfter(hostDisputeMark, message => message.type === 'result_error', '房主收到冲突结果拒绝'),
    guest.waitAfter(guestDisputeMark, message => message.type === 'result_error', '对手收到冲突结果拒绝'),
  ]);
  const afterA = await getProfile(host, accounts.a.uid);
  const afterB = await getProfile(guest, accounts.b.uid);
  check('双方 claim 不一致时整局不结算', sameProtectedState(beforeA, afterA) && sameProtectedState(beforeB, afterB));
}

async function runAccountAndProfileTests(wsUrl){
  const suffix = crypto.randomBytes(5).toString('hex');
  const accountA = { uid: 'u_seca' + suffix, pin: 'SecA' + suffix, name: '安全甲' };
  const accountB = { uid: 'u_secb' + suffix, pin: 'SecB' + suffix, name: '安全乙' };
  const bootstrapA = await new WsClient('register-A', wsUrl).open();
  const bootstrapB = await new WsClient('register-B', wsUrl).open();
  const registeredA = await register(bootstrapA, accountA);
  const registeredB = await register(bootstrapB, accountB);

  check('注册签发不可猜测的会话 token', registeredA.token.length >= 24 && registeredB.token.length >= 24 && registeredA.token !== registeredB.token);
  const ownedA = canonicalOwned(registeredA.profile.owned);
  const ownedB = canonicalOwned(registeredB.profile.owned);
  const forgedOwnedAbsent = owned => !owned.avatars.some(id => id >= 30) &&
    !owned.frames.some(id => id > 0) && !owned.effects.some(id => id > 0) && !owned.backgrounds.some(id => id > 0);
  check('注册忽略客户端伪造的付费 owned', forgedOwnedAbsent(ownedA) && forgedOwnedAbsent(ownedB),
    JSON.stringify({ a: ownedA, b: ownedB }));
  check('注册忽略客户端伪造的金币和 XP', Number(registeredA.profile.coins || 0) === 0 && Number(registeredA.profile.xp || 0) === 0);
  check('公开档案不泄露 pin_hash', !('pin_hash' in registeredA.profile) && !('pinHash' in registeredA.profile));
  bootstrapA.close();
  bootstrapB.close();
  await sleep(80);

  const authA = await authenticate('auth-A', wsUrl, { uid: registeredA.uid, token: registeredA.token });
  const authB = await authenticate('auth-B', wsUrl, { uid: registeredB.uid, token: registeredB.token });

  await expectRejected(authA, {
    type: 'login', payload: { pin: accountB.pin },
  }, '已认证连接直接登录其他账号');
  await expectRejected(authA, {
    type: 'hello', payload: { uid: registeredB.uid, token: registeredB.token, proto: 1 },
  }, '已认证连接用 hello 切换账号');
  const identityStillA = await getProfile(authA, registeredA.uid);
  check('身份切换被拒绝后仍保持原账号', identityStillA.uid === registeredA.uid);

  const attacker = await new WsClient('anonymous-attacker', wsUrl).open();
  const hello = await attacker.request(
    { type: 'hello', payload: { uid: registeredA.uid, proto: 1 } },
    isHelloResult,
    '无 token hello',
  );
  check('hello 只有 uid、没有 token 时不能认证', !helloAuthenticated(hello), JSON.stringify(hello));
  const publicB = await getProfile(attacker, registeredB.uid);
  check('他人公开档案不暴露 owned / playmates / daily',
    !('owned' in publicB) && !('playmates' in publicB) && !('daily' in publicB), JSON.stringify(Object.keys(publicB)));
  const beforeAnonymous = await getProfile(authA, registeredA.uid);
  await expectRejected(attacker, {
    type: 'profile',
    payload: { uid: registeredA.uid, name: '被匿名篡改', avatar: 27, xp: 999999 },
  }, '未认证 profile 修改');
  const afterAnonymous = await getProfile(authA, registeredA.uid);
  check('未认证连接不能修改任意档案', afterAnonymous.name === beforeAnonymous.name && sameProtectedState(beforeAnonymous, afterAnonymous));
  attacker.close();

  const beforeCross = await getProfile(authB, registeredB.uid);
  await expectRejected(authA, {
    type: 'profile',
    payload: { uid: registeredB.uid, name: '被跨账号篡改', avatar: 27 },
  }, '跨 uid profile 修改');
  const afterCross = await getProfile(authB, registeredB.uid);
  check('已认证用户不能修改其他 uid', afterCross.name === beforeCross.name && sameProtectedState(beforeCross, afterCross));

  const beforeForge = await getProfile(authA, registeredA.uid);
  const hackedPin = 'Hack' + suffix;
  const hackedPinHash = crypto.createHash('sha256').update('mg-pin:' + hackedPin.toLowerCase()).digest('hex');
  const profileMark = authA.mark();
  authA.send({
    type: 'profile',
    payload: {
      uid: registeredA.uid,
      name: '安全甲改名',
      avatar: 3,
      lang: 'en-US',
      coins: 999999,
      xp: 999999,
      level: 99,
      total: 999999,
      played: { tictactoe: 999999 },
      pin_hash: hackedPinHash,
      owned: { avatars: [55], frames: [8], effects: [4], backgrounds: [10] },
    },
  });
  await authA.waitAfter(profileMark, message => message.type === 'profile_ok' || isReject(message), 'profile 更新回执');
  const afterForge = await getProfile(authA, registeredA.uid);
  check('profile 不能伪造 owned / coins / XP / 场次', sameProtectedState(beforeForge, afterForge),
    JSON.stringify({ before: protectedState(beforeForge), after: protectedState(afterForge) }));
  check('profile 回执/读取不泄露 pin_hash', !('pin_hash' in afterForge) && !('pinHash' in afterForge));

  const originalLogin = await login('login-original-pin', wsUrl, accountA.pin);
  check('伪造 pin_hash 后原 PIN 仍能登录', originalLogin.response.type === 'logged_in', JSON.stringify(originalLogin.response));
  check('PIN 登录也签发 token', originalLogin.response.type !== 'logged_in' || tokenOf(originalLogin.response).length >= 24);
  const logoutToken = tokenOf(originalLogin.response);
  const logoutMark = originalLogin.client.mark();
  originalLogin.client.send({ type: 'logout' });
  await originalLogin.client.waitAfter(logoutMark, message => message.type === 'logged_out' || isReject(message), '退出登录回执');
  originalLogin.client.close();
  const revoked = await new WsClient('revoked-token', wsUrl).open();
  const revokedHello = await revoked.request(
    { type: 'hello', payload: { uid: registeredA.uid, token: logoutToken, proto: 1 } },
    isHelloResult,
    '退出后的 token hello',
  );
  check('logout 后当前 token 立即失效', !helloAuthenticated(revokedHello), JSON.stringify(revokedHello));
  revoked.close();
  const hackedLogin = await login('login-forged-pin', wsUrl, hackedPin);
  check('profile 提交的伪造 pin_hash 不可用于登录', hackedLogin.response.type !== 'logged_in', JSON.stringify(hackedLogin.response));
  hackedLogin.client.close();

  return {
    a: { ...registeredA, pin: accountA.pin },
    b: { ...registeredB, pin: accountB.pin },
    authA,
    authB,
  };
}

async function runResultAndPurchaseTests(context){
  const { authA, authB } = context;
  let matchId = await startFirstMatch(authA, authB);
  await verifyMoveEnvelope(authA, authB);
  await disputeMatch(authA, authB, context, matchId);
  matchId = await startSelectedMatch(authA, authB, matchId);
  await settleMatch(authA, authB, context, matchId);
  for (let i = 0; i < 2; i++){
    const next = await startSelectedMatch(authA, authB, matchId);
    matchId = next;
    await settleMatch(authA, authB, context, matchId);
  }

  const beforePurchase = await getProfile(authA, context.a.uid);
  check('合法一致结算可获得商城最低价所需 $3', Number(beforePurchase.coins || 0) === 3,
    'coins=' + Number(beforePurchase.coins || 0));
  const requestId = 'purchase-' + crypto.randomUUID();
  const purchase = {
    type: 'purchase',
    payload: { category: 'backgrounds', id: 1, price: 0, requestId },
  };
  const purchaseResponse = await authA.request(
    purchase,
    message => message.type === 'purchase_ok' || message.type === 'purchase_error' || isReject(message),
    '服务端购买背景 1',
  );
  check('合法商城购买成功', purchaseResponse.type === 'purchase_ok', JSON.stringify(purchaseResponse));
  const afterPurchase = await getProfile(authA, context.a.uid);
  check('purchase 忽略伪造 price 并按服务端定价扣 $3',
    Number(beforePurchase.coins || 0) - Number(afterPurchase.coins || 0) === 3,
    'before=' + beforePurchase.coins + ', after=' + afterPurchase.coins);
  check('purchase 只由服务端写入 owned', canonicalOwned(afterPurchase.owned).backgrounds.includes(1),
    JSON.stringify(afterPurchase.owned));

  authA.send(purchase);
  await sleep(160);
  const afterRequestReplay = await getProfile(authA, context.a.uid);
  check('相同 requestId 重放 purchase 幂等', sameProtectedState(afterPurchase, afterRequestReplay));

  authA.send({
    type: 'purchase',
    payload: { category: 'backgrounds', id: 1, price: -999999, requestId: 'purchase-' + crypto.randomUUID() },
  });
  await sleep(160);
  const afterOwnedRetry = await getProfile(authA, context.a.uid);
  check('已拥有商品用新 requestId 重试也不重复扣款', sameProtectedState(afterPurchase, afterOwnedRetry));

  await verifyMonopolyHostSettle(authA, authB);
  const endMarkA = authA.mark();
  const endMarkB = authB.mark();
  authA.send({ type: 'end_game' });
  await Promise.all([
    authA.waitAfter(endMarkA, message => message.type === 'end_game', '单机去重测试前结束房间对局'),
    authB.waitAfter(endMarkB, message => message.type === 'end_game', '对手收到房间结束'),
  ]);
  authA.send({ type: 'leave' });
  authB.send({ type: 'leave' });
  await sleep(120);
  const soloBefore = await getProfile(authA, context.a.uid);
  const soloId = 'solo_' + crypto.randomUUID();
  const soloResult = { type: 'result', payload: { mode: 'solo', resultId: soloId, game: 'tictactoe', coins: 1 } };
  const soloFirst = await authA.request(soloResult, message => message.type === 'result_ok' || isReject(message), '首次单机结算');
  check('合法单机 resultId 可结算', soloFirst.type === 'result_ok', JSON.stringify(soloFirst));
  const soloSettled = await getProfile(authA, context.a.uid);
  authA.send(soloResult);
  await sleep(160);
  const soloReplay = await getProfile(authA, context.a.uid);
  check('单机 resultId 重放不重复奖励',
    Number(soloSettled.coins || 0) === Number(soloBefore.coins || 0) + 1 && sameProtectedState(soloSettled, soloReplay));
}

async function runAITests(port, token){
  const origin = 'http://127.0.0.1:' + port;
  const normalBody = JSON.stringify({
    game: 'tictactoe',
    state: { board: Array(9).fill(null) },
    options: ['0,0'],
  });
  const noToken = await httpRequest(port, {
    method: 'POST',
    path: '/api/ai',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: normalBody,
  });
  check('AI 接口无 token 返回 401', noToken.status === 401, 'status=' + noToken.status + ', body=' + noToken.text.slice(0, 160));

  const evilOrigin = await httpRequest(port, {
    method: 'POST',
    path: '/api/ai',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      Origin: 'https://evil.example',
    },
    body: normalBody,
  });
  check('AI 接口拒绝恶意 Origin', evilOrigin.status === 403, 'status=' + evilOrigin.status + ', body=' + evilOrigin.text.slice(0, 160));
  check('恶意 Origin 响应不返回通配 CORS', evilOrigin.headers['access-control-allow-origin'] !== '*');

  const oversized = JSON.stringify({
    game: 'tictactoe',
    state: 'x'.repeat(120000),
    options: ['0,0'],
  });
  const tooLarge = await httpRequest(port, {
    method: 'POST',
    path: '/api/ai',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      Origin: origin,
    },
    body: oversized,
  });
  check('AI 接口拒绝超限请求体（413）', tooLarge.status === 413,
    'status=' + tooLarge.status + ', body=' + tooLarge.text.slice(0, 160));

  let rateLimited = null;
  for (let i = 0; i < 20; i++){
    const response = await httpRequest(port, {
      method: 'POST',
      path: '/api/ai',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        Origin: origin,
      },
      body: normalBody,
    });
    if (response.status === 429){ rateLimited = response; break; }
  }
  check('AI 接口拒绝超过速率配额的请求（429）', !!rateLimited,
    rateLimited ? '' : '连续请求未触发速率限制');
}

async function runWebSocketAbuseTests(wsUrl, account){
  const oversized = await new WsClient('oversized-frame', wsUrl).open();
  oversized.ws.send(JSON.stringify({ type: 'lobby', padding: 'x'.repeat(70000) }));
  await oversized.waitClosed('超过 64KB 的消息应被关闭');
  pass('WebSocket 拒绝超过 64KB 的客户端消息');

  const flood = await authenticate('message-flood', wsUrl, account);
  for (let i = 0; i < 220 && !flood.closed && flood.ws.readyState === 1; i++) flood.send({ type: 'lobby' });
  await flood.waitClosed('10 秒内消息洪泛应被关闭');
  pass('WebSocket 消息频控会关闭洪泛连接');
}

function stageIsolatedServer(){
  const dataRoot = path.join(ROOT, 'data');
  fs.mkdirSync(dataRoot, { recursive: true });
  sandboxRoot = fs.mkdtempSync(path.join(dataRoot, 'security-'));
  return SERVER;
}

async function stopServer(){
  if (!server || server.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1500);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
    try { server.kill(); } catch { clearTimeout(timer); resolve(); }
  });
}

async function main(){
  if (typeof WebSocket !== 'function'){
    throw new Error('当前 Node 未启用 WebSocket；Node 20 请用 --experimental-websocket 运行本测试');
  }
  const port = await reservePort();
  if (port === 8099 || port === 8123) throw new Error('动态端口意外命中其他 QA 保留端口');
  const serverPath = stageIsolatedServer();
  const dataDir = path.join(sandboxRoot, 'data');
  const allowedOrigin = 'http://127.0.0.1:' + port;
  console.log('INFO  独立端口 ' + port + '；临时数据目录 ' + dataDir);
  server = spawn(process.execPath, [serverPath], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      NODE_ENV: 'test',
      DEEPSEEK_KEY: '',
      SUPABASE_URL: '',
      SUPABASE_KEY: '',
      RENDER_KEY: '',
      AUTH_SECRET: 'qa-only-' + crypto.randomBytes(32).toString('hex'),
      SESSION_SECRET: 'qa-only-' + crypto.randomBytes(32).toString('hex'),
      ALLOWED_ORIGINS: allowedOrigin,
      CORS_ORIGINS: allowedOrigin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { serverOut = (serverOut + chunk).slice(-20000); });
  server.stderr.on('data', chunk => { serverOut = (serverOut + chunk).slice(-20000); });
  await waitServer(port);

  const wsUrl = 'ws://127.0.0.1:' + port + '/ws';
  const context = await runAccountAndProfileTests(wsUrl);
  await runResultAndPurchaseTests(context);
  await runAITests(port, context.a.token);
  await runWebSocketAbuseTests(wsUrl, { uid: context.a.uid, token: context.a.token });
}

main().catch(error => {
  fail('安全回归流程未崩溃', error && error.stack || String(error));
}).finally(async () => {
  for (const client of clients) client.close();
  await stopServer();
  if (sandboxRoot){
    try { fs.rmSync(sandboxRoot, { recursive: true, force: true }); } catch {}
  }
  if (failures.length){
    console.log('SECURITY_HAS_FAILURES (' + failures.length + ')');
    if (serverOut) console.log('---- SERVER OUTPUT ----\n' + serverOut.slice(-3000));
    process.exitCode = 1;
  } else {
    console.log('SECURITY_ALL_PASS');
  }
});
