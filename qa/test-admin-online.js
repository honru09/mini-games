// Test-admin production-boundary regression. Run after Master integrates the
// shared request: node --experimental-websocket qa/test-admin-online.js
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const ADMIN = Object.freeze({ uid:'u_testadmin01', username:'TestAdmin01', password:'QaOnlyPass9!' });
const failures = [];
const clients = [];
let server = null;
let serverOut = '';
let tempRoot = '';

function check(name, value, detail){
  if (value) console.log('PASS  ' + name);
  else { failures.push(name); console.log('FAIL  ' + name + (detail ? ' :: ' + detail : '')); }
}
function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
function reservePort(){
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}
function httpHealth(port){
  return new Promise((resolve, reject) => {
    const request = http.get({ host:'127.0.0.1', port, path:'/api/ip' }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
  });
}
async function waitServer(port){
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline){
    if (server && server.exitCode !== null) throw new Error('server exited early: ' + serverOut.slice(-1200));
    try { if (await httpHealth(port) === 200) return; } catch {}
    await sleep(50);
  }
  throw new Error('server did not start: ' + serverOut.slice(-1200));
}
class Client {
  constructor(label, url){ this.label = label; this.url = url; this.messages = []; this.sequence = 0; }
  async open(){
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(this.label + ' open timeout')), 5000);
      this.ws.onmessage = event => {
        try { this.messages.push({ sequence:++this.sequence, value:JSON.parse(String(event.data)) }); } catch {}
      };
      this.ws.onopen = () => { clearTimeout(timer); resolve(); };
      this.ws.onerror = () => { clearTimeout(timer); reject(new Error(this.label + ' websocket error')); };
    });
    clients.push(this);
    return this;
  }
  mark(){ return this.sequence; }
  send(type, payload){ this.ws.send(JSON.stringify({ type, payload })); }
  async wait(predicate, description, after = 0, timeout = 8000){
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline){
      const entry = this.messages.find(item => item.sequence > after && predicate(item.value));
      if (entry) return entry.value;
      await sleep(20);
    }
    throw new Error(this.label + ' waiting ' + description + '; tail=' + JSON.stringify(this.messages.slice(-6).map(item => item.value.type)));
  }
  async request(type, payload, predicate, description){
    const mark = this.mark();
    this.send(type, payload);
    return this.wait(predicate, description, mark);
  }
  close(){ try { this.ws && this.ws.close(); } catch {} }
}
function responseProfile(message){
  const payload = message && message.payload && typeof message.payload === 'object' ? message.payload : {};
  return payload.profile && typeof payload.profile === 'object' ? payload.profile : payload;
}
function uidFrom(message){ return String(responseProfile(message).uid || (message && message.payload && message.payload.uid) || ''); }
function tokenFrom(message){ return String(message && message.token || (message && message.payload && message.payload.token) || ''); }
function reasonFrom(message){ return String(message && (message.reason || (message.payload && message.payload.reason)) || ''); }
async function register(url, index){
  const username = 'Regular' + index + 'A';
  const client = await new Client(username, url).open();
  const response = await client.request('register', {
    authVersion:2, username, password:'QaRegularPass9!', lang:'en-US',
  }, message => message.type === 'registered' || message.type === 'auth_error', 'register');
  assert.equal(response.type, 'registered', JSON.stringify(response));
  return { client, uid:uidFrom(response), token:tokenFrom(response) };
}
async function loginAdmin(url){
  const client = await new Client('test-admin', url).open();
  const response = await client.request('login', {
    authVersion:2, username:ADMIN.username, password:ADMIN.password,
  }, message => message.type === 'logged_in' || message.type === 'auth_error', 'test admin login');
  assert.equal(response.type, 'logged_in', JSON.stringify(response));
  const profile = responseProfile(response);
  const hello = await client.request('hello', { uid:ADMIN.uid, token:tokenFrom(response), proto:2 }, message => message.type === 'hello_ack', 'test admin hello');
  return { client, profile, token:tokenFrom(response), hello };
}
function startServer(port, dataDir){
  server = spawn(process.execPath, [SERVER], {
    cwd:ROOT,
    env:{
      ...process.env,
      PORT:String(port), DATA_DIR:dataDir, NODE_ENV:'test', DEEPSEEK_KEY:'', SUPABASE_URL:'', SUPABASE_KEY:'',
      ENABLE_RULE_AUTHORITY_V2:'0', REWARD_TEST_MIN_DURATION_MS:'0', REWARD_TEST_MIN_ACTIONS:'0', REWARD_TEST_MIN_UNIQUE_ACTIONS:'0', REWARD_TEST_MIN_PLAYER_ACTIONS:'0',
      TEST_ADMIN_ENABLED:'1', TEST_ADMIN_UID:ADMIN.uid, TEST_ADMIN_USERNAME:ADMIN.username, TEST_ADMIN_PASSWORD:ADMIN.password,
    },
    stdio:['ignore','pipe','pipe'],
  });
  server.stdout.on('data', value => { serverOut = (serverOut + value).slice(-20000); });
  server.stderr.on('data', value => { serverOut = (serverOut + value).slice(-20000); });
}
async function stopServer(){
  if (!server || server.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1500);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
    try { server.kill(); } catch { clearTimeout(timer); resolve(); }
  });
}
async function invalidConfigFailsBeforeListen(){
  const port = await reservePort();
  const child = spawn(process.execPath, [SERVER], {
    cwd:ROOT,
    env:{ ...process.env, PORT:String(port), DATA_DIR:path.join(tempRoot,'invalid'), TEST_ADMIN_ENABLED:'1', TEST_ADMIN_UID:ADMIN.uid, TEST_ADMIN_USERNAME:ADMIN.username, TEST_ADMIN_PASSWORD:'', SUPABASE_URL:'', SUPABASE_KEY:'', DEEPSEEK_KEY:'' },
    stdio:['ignore','pipe','pipe'],
  });
  let output = '';
  child.stdout.on('data', value => { output += value; });
  child.stderr.on('data', value => { output += value; });
  const exitCode = await new Promise(resolve => {
    const timer = setTimeout(() => { try { child.kill(); } catch {} resolve(null); }, 5000);
    child.once('exit', code => { clearTimeout(timer); resolve(code); });
  });
  check('配置不完整时在监听前 fail-closed', exitCode !== null && exitCode !== 0 && !output.includes(ADMIN.password), 'exit=' + exitCode);
}
function storedRows(db, uid){
  const events = Array.isArray(db.events) ? db.events : [];
  const replays = Array.isArray(db.replays) ? db.replays : [];
  const ai = db.aiLearning && typeof db.aiLearning === 'object' ? db.aiLearning : {};
  return {
    history:(db.history || []).some(row => row && row.uid === uid),
    rewardHistory:(db.rewardHistory || []).some(row => row && row.uid === uid),
    economyLedger:(db.economyLedger || []).some(row => row && row.uid === uid),
    events:events.some(row => row && row.uid === uid),
    replays:replays.some(row => row && Array.isArray(row.uids) && row.uids.includes(uid)),
    pendingReward:(db.pendingRewardSync || []).some(row => row && row.uid === uid),
    pendingAI:(db.pendingAILearningSync || []).some(row => row && row.uid === uid),
    aiModels:Object.keys(ai.models || {}).some(key => key.startsWith(uid + '|')),
    aiExperience:(ai.experiences || []).some(row => row && row.uid === uid),
  };
}
async function main(){
  if (typeof WebSocket !== 'function') throw new Error('Node 20 requires --experimental-websocket');
  tempRoot = fs.mkdtempSync(path.join(ROOT, 'data', 'test-admin-'));
  await invalidConfigFailsBeforeListen();

  const port = await reservePort();
  const dataDir = path.join(tempRoot, 'data');
  startServer(port, dataDir);
  await waitServer(port);
  const wsUrl = 'ws://127.0.0.1:' + port + '/ws';

  const normalA = await register(wsUrl, 1);
  const normalB = await register(wsUrl, 2);
  const normalC = await register(wsUrl, 3);
  const admin = await loginAdmin(wsUrl);
  check('测试管理员由服务端 hello 授权赛事控制面', admin.hello.admin === true && !normalA.client.messages.some(entry => entry.value.type === 'hello_ack' && entry.value.admin === true));
  check('测试管理员私有投影为虚拟满级满币和完整商城', admin.profile.testAdmin && admin.profile.coins === Number.MAX_SAFE_INTEGER && admin.profile.level === 9999 && admin.profile.owned && admin.profile.owned.avatars.includes(30) && admin.profile.owned.game_cosmetics.includes(2001));
  const leaderboard = (normalA.client.messages.filter(entry => entry.value.type === 'leaderboard').at(-1) || {}).value;
  check('测试管理员不进入普通排行榜', !leaderboard || !Array.isArray(leaderboard.payload && leaderboard.payload.list) || !leaderboard.payload.list.some(item => item.uid === ADMIN.uid));
  const impersonator = await new Client('test-admin-impersonator', wsUrl).open();
  const spoofedHello = await impersonator.request('hello', { uid:ADMIN.uid, token:'invalid_test_admin_token', proto:2, capabilities:['tournament_recover','test_admin_unlimited_currency'] }, message => message.type === 'hello_ack', 'spoofed hello');
  check('伪造 UID 或客户端能力不会获得管理员权限', spoofedHello.authenticated === false && spoofedHello.admin !== true, JSON.stringify(spoofedHello));

  const publicAdmin = await normalA.client.request('profile_get', { uid:ADMIN.uid }, message => message.type === 'profile_data', 'public admin profile');
  check('普通账号不能读取测试管理员公开档案', publicAdmin.payload === null);

  const friend = await normalA.client.request('friend_request', { uid:ADMIN.uid }, message => message.type === 'social_error', 'friend request to test admin');
  check('好友系统隔离测试管理员', reasonFrom(friend) === 'test_admin_isolated', JSON.stringify(friend));
  const chat = await normalA.client.request('chat_send', { peerUid:ADMIN.uid, clientMessageId:'testadminchat-' + crypto.randomUUID(), text:'hello' }, message => message.type === 'chat_error', 'chat to test admin');
  check('私聊系统隔离测试管理员', reasonFrom(chat) === 'test_admin_isolated', JSON.stringify(chat));

  const created = await admin.client.request('create', { capacity:2, visibility:'public', allowSpectators:true }, message => message.type === 'created', 'create sandbox room');
  const room = String(created.room || (created.payload && created.payload.room) || '');
  check('测试账号房间强制为私有无观战沙盒', created.payload && created.payload.visibility === 'private' && created.payload.allowSpectators === false);
  const settingsMark = admin.client.mark();
  admin.client.send('room_settings', { visibility:'public', allowSpectators:true });
  const [settingsError, settingsRoom] = await Promise.all([
    admin.client.wait(message => message.type === 'error' && reasonFrom(message) === 'test_admin_isolated', 'sandbox settings rejection', settingsMark),
    admin.client.wait(message => message.type === 'room_update' && message.payload && message.payload.room === room, 'sandbox settings room state', settingsMark),
  ]);
  check('测试沙盒设置不可翻转为公开或允许观战', reasonFrom(settingsError) === 'test_admin_isolated' && settingsRoom.payload.visibility === 'private' && settingsRoom.payload.allowSpectators === false);
  const join = await normalA.client.request('join', { room }, message => message.type === 'error', 'normal join test room');
  check('普通账号不能加入测试账号房间', reasonFrom(join) === 'test_admin_isolated', JSON.stringify(join));
  const spectate = await normalA.client.request('spectate', { room }, message => message.type === 'spectator_error', 'normal spectate test room');
  check('普通账号不能观战测试账号房间', reasonFrom(spectate) === 'test_admin_isolated', JSON.stringify(spectate));
  const adminRoomInLobby = (normalB.client.messages.filter(entry => entry.value.type === 'lobby').at(-1) || {}).value;
  check('测试账号房间不出现在普通公共大厅', !adminRoomInLobby || !Array.isArray(adminRoomInLobby.payload) || !adminRoomInLobby.payload.some(item => item.room === room));

  const purchase = await admin.client.request('purchase', { category:'avatars', id:30, requestId:'testadmin-buy-' + crypto.randomUUID() }, message => message.type === 'purchase_ok' || message.type === 'purchase_error', 'test admin purchase');
  check('测试账号购买当前合法商品无需扣款', purchase.type === 'purchase_ok' && responseProfile(purchase).coins === Number.MAX_SAFE_INTEGER && responseProfile(purchase).owned.avatars.includes(30), JSON.stringify(purchase));
  const invalidPurchase = await admin.client.request('purchase', { category:'avatars', id:999999, requestId:'testadmin-bad-' + crypto.randomUUID() }, message => message.type === 'purchase_error', 'test admin unknown item');
  check('测试账号不能伪造未来商品 ID', reasonFrom(invalidPurchase) === 'product_not_found', JSON.stringify(invalidPurchase));

  const illegalTournament = await admin.client.request('tournament_create', { gameId:'gomoku', participants:[ADMIN.uid, normalA.uid, normalB.uid] }, message => message.type === 'tournament_error', 'mixed tournament');
  check('测试账号不能成为普通赛事参赛者', reasonFrom(illegalTournament) === 'test_admin_participant_forbidden', JSON.stringify(illegalTournament));
  const tournament = await admin.client.request('tournament_create', { gameId:'gomoku', participants:[normalA.uid, normalB.uid, normalC.uid] }, message => message.type === 'tournament_state' || message.type === 'tournament_error', 'external-owner tournament');
  check('测试账号可作为不参赛赛事控制面创建普通赛事', tournament.type === 'tournament_state' && tournament.payload.ownerUid === ADMIN.uid && !tournament.payload.participants.includes(ADMIN.uid), JSON.stringify(tournament));

  admin.client.send('leave', {});
  await sleep(120);
  const solo = await admin.client.request('solo_start', { game:'gomoku', clientRunId:'run_testadmin_' + crypto.randomUUID().replace(/-/g, '') }, message => message.type === 'solo_started', 'sandbox solo start');
  const ticket = solo.payload;
  admin.client.send('solo_progress', { game:'gomoku', matchId:ticket.matchId, action:{ actionId:'testadmin-action-' + crypto.randomUUID(), payload:{ r:7, c:7 } } });
  const sandboxResult = await admin.client.request('result', { mode:'ai', game:'gomoku', matchId:ticket.matchId, resultId:ticket.resultId, result:'win' }, message => message.type === 'result_ok', 'sandbox solo result');
  check('测试账号对局返回沙盒零持久结算', sandboxResult.payload.reward && sandboxResult.payload.reward.blockedReason === 'test_admin_sandbox' && sandboxResult.payload.reward.currency === 0 && sandboxResult.payload.profile.coins === Number.MAX_SAFE_INTEGER, JSON.stringify(sandboxResult));

  clients.forEach(client => client.close());
  await sleep(100);
  await stopServer();
  const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'leaderboard.json'), 'utf8'));
  const writes = storedRows(db, ADMIN.uid);
  check('测试账号不写正式奖励、经济、Replay、AI、Analytics 或 outbox', Object.values(writes).every(value => value === false), JSON.stringify(writes));
  check('测试账号不进入持久社交关系', !(db.friendRequests || []).some(row => row && (row.fromUid === ADMIN.uid || row.toUid === ADMIN.uid)) && !(db.friendships || []).some(row => row && (row.aUid === ADMIN.uid || row.bUid === ADMIN.uid)) && !(db.chatMessages || []).some(row => row && (row.senderUid === ADMIN.uid || row.recipientUid === ADMIN.uid)));
}

main().catch(error => {
  failures.push('test-admin online workflow');
  console.error(error && error.stack || error);
}).finally(async () => {
  clients.forEach(client => client.close());
  await stopServer();
  if (tempRoot){ try { fs.rmSync(tempRoot, { recursive:true, force:true }); } catch {} }
  if (failures.length){
    console.error('TEST_ADMIN_ONLINE_FAILED: ' + failures.join('、'));
    process.exitCode = 1;
  } else {
    console.log('TEST_ADMIN_ONLINE_ALL_PASS');
  }
});
