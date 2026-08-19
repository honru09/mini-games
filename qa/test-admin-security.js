// 测试管理员安全回归。
// Node 20: node --experimental-websocket qa/test-admin-security.js
// 合同：只有 TEST_ADMIN_ENABLED=1 且完整、合法的服务器环境配置才能创建此内部测试身份；
// 它不能由 uid、profile 字段或客户端能力伪造，也不能污染正式经济/回放/AI/分析数据。
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const WAIT_MS = 8000;
const ADMIN = Object.freeze({
  uid: 'u_testadminqa01',
  username: 'TestAdminQa01',
  password: 'GhostAdminQa!2026',
  name: 'Ghost QA Admin',
});
const ADMIN_ENV_KEYS = Object.freeze([
  'TEST_ADMIN_ENABLED', 'TEST_ADMIN_UID', 'TEST_ADMIN_USERNAME', 'TEST_ADMIN_PASSWORD', 'TEST_ADMIN_NAME',
]);
const OWNED_SENTINELS = Object.freeze({
  avatars: [30, 55],
  frames: [1, 8],
  effects: [1, 4],
  backgrounds: [7, 31],
  game_cosmetics: [2001, 2051],
});

const failures = [];
const clients = [];
const instances = [];

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

function check(name, value, detail){
  console.log((value ? 'PASS' : 'FAIL') + '  ' + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures.push(name);
  return !!value;
}

function reservePort(){
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function httpRequest(port, pathname){
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: pathname || '/api/ip', method: 'GET' }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    request.once('error', reject);
    request.end();
  });
}

async function waitServer(instance){
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline){
    if (instance.server.exitCode !== null) throw new Error(instance.label + ' 服务提前退出：' + instance.output.slice(-1200));
    try {
      const response = await httpRequest(instance.port, '/api/ip');
      if (response.status === 200) return;
    } catch {}
    await sleep(40);
  }
  throw new Error(instance.label + ' 服务启动超时');
}

function baseEnvironment(port, dataDir){
  const env = { ...process.env };
  for (const key of ADMIN_ENV_KEYS) delete env[key];
  return {
    ...env,
    PORT: String(port),
    DATA_DIR: dataDir,
    NODE_ENV: 'test',
    DEEPSEEK_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_KEY: '',
    TOURNAMENT_ADMIN_UIDS: '',
    ENABLE_CLUSTER_COORDINATION: '0',
    REWARD_TEST_MIN_DURATION_MS: '0',
    REWARD_TEST_MIN_ACTIONS: '0',
    REWARD_TEST_MIN_UNIQUE_ACTIONS: '0',
    REWARD_TEST_MIN_PLAYER_ACTIONS: '0',
    AUTH_SECRET: 'test-admin-qa-' + crypto.randomBytes(24).toString('hex'),
    SESSION_SECRET: 'test-admin-qa-' + crypto.randomBytes(24).toString('hex'),
  };
}

async function startServer(label, override = {}){
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-test-admin-'));
  const env = baseEnvironment(port, dataDir);
  for (const [key, value] of Object.entries(override)){
    if (value === undefined) delete env[key];
    else env[key] = String(value);
  }
  const instance = { label, port, dataDir, output: '', server: null };
  instance.server = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  instance.server.stdout.on('data', chunk => { instance.output = (instance.output + chunk).slice(-20000); });
  instance.server.stderr.on('data', chunk => { instance.output = (instance.output + chunk).slice(-20000); });
  instances.push(instance);
  await waitServer(instance);
  return instance;
}

async function stopServer(instance){
  if (!instance) return;
  if (instance.server && instance.server.exitCode === null){
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 1500);
      instance.server.once('exit', () => { clearTimeout(timer); resolve(); });
      try { instance.server.kill(); } catch { clearTimeout(timer); resolve(); }
    });
  }
  try { fs.rmSync(instance.dataDir, { recursive: true, force: true }); } catch {}
}

async function assertInvalidConfigurationFailsBeforeListen(label, override){
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-test-admin-invalid-'));
  const env = baseEnvironment(port, dataDir);
  for (const [key, value] of Object.entries(override || {})){
    if (value === undefined) delete env[key];
    else env[key] = String(value);
  }
  const child = spawn(process.execPath, [SERVER], { cwd:ROOT, env, stdio:['ignore','pipe','pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output = (output + chunk).slice(-10000); });
  child.stderr.on('data', chunk => { output = (output + chunk).slice(-10000); });
  const exitCode = await new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 5000);
    child.once('exit', code => { clearTimeout(timer); resolve(code); });
  });
  if (exitCode === null){ try { child.kill(); } catch {} }
  check(label + '：配置错误在监听前 fail-closed', exitCode !== null && exitCode !== 0 && !output.includes(ADMIN.password),
    'exit=' + exitCode);
  try { fs.rmSync(dataDir, { recursive:true, force:true }); } catch {}
}

class Client {
  constructor(label, instance){
    this.label = label;
    this.instance = instance;
    this.messages = [];
    this.sequence = 0;
    this.closed = false;
  }

  async open(){
    this.ws = new WebSocket('ws://127.0.0.1:' + this.instance.port + '/ws');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(this.label + ' WebSocket 连接超时')), WAIT_MS);
      this.ws.addEventListener('message', event => {
        let message;
        try { message = JSON.parse(String(event.data)); }
        catch { message = { type: '__invalid_json__' }; }
        this.messages.push({ sequence: ++this.sequence, message });
      });
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error(this.label + ' WebSocket 连接失败')); }, { once: true });
      this.ws.addEventListener('close', () => { this.closed = true; });
    });
    clients.push(this);
    return this;
  }

  mark(){ return this.sequence; }

  send(type, payload){
    if (!this.ws || this.ws.readyState !== 1) throw new Error(this.label + ' WebSocket 未连接');
    this.ws.send(JSON.stringify({ type, payload }));
  }

  async waitAfter(mark, predicate, description, timeout = WAIT_MS){
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline){
      const entry = this.messages.find(item => item.sequence > mark && predicate(item.message));
      if (entry) return entry.message;
      if (this.closed) throw new Error(this.label + ' 已断开，等待：' + description);
      await sleep(16);
    }
    throw new Error(this.label + ' 等待超时：' + description + '；最近消息=' + this.messages.slice(-8).map(item => item.message.type).join(','));
  }

  request(type, payload, predicate, description, timeout){
    const mark = this.mark();
    this.send(type, payload);
    return this.waitAfter(mark, predicate, description, timeout);
  }

  close(){
    try {
      if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) this.ws.close();
    } catch {}
  }
}

function payloadOf(message){ return message && message.payload && typeof message.payload === 'object' ? message.payload : {}; }
function profileOf(message){ const payload = payloadOf(message); return payload.profile && typeof payload.profile === 'object' ? payload.profile : payload; }
function uidOf(message){ const payload = payloadOf(message); return String(payload.uid || (profileOf(message) && profileOf(message).uid) || ''); }
function tokenOf(message){ const payload = payloadOf(message); return String(message && (message.token || payload.token) || ''); }
function reasonOf(message){ return String(message && (message.reason || (message.payload && message.payload.reason) || message.code) || ''); }
function authSucceeded(message){ return !!message && (message.type === 'logged_in' || message.type === 'registered'); }
function authFailed(message){ return !!message && message.type === 'auth_error'; }
function isError(message){ return !!message && (message.type === 'error' || message.type === 'auth_error' || /_error$/.test(message.type)); }
function isHello(message){ return !!message && (message.type === 'hello_ack' || isError(message)); }
function isAuthenticated(message){ return !!message && message.type === 'hello_ack' && message.authenticated === true; }

async function login(client, username, password){
  return client.request('login', { authVersion: 2, username, password }, message => authSucceeded(message) || authFailed(message), client.label + ' 登录');
}

async function registerRegular(client, suffix, extras){
  const username = 'Regular' + suffix;
  const response = await client.request('register', {
    authVersion: 2,
    username,
    password: 'Regular!Pass' + suffix,
    name: 'Regular ' + suffix,
    ...(extras || {}),
  }, message => authSucceeded(message) || authFailed(message), client.label + ' 注册');
  if (response.type !== 'registered') throw new Error(client.label + ' 注册失败：' + reasonOf(response));
  return { uid: uidOf(response), token: tokenOf(response), profile: profileOf(response), username, password: 'Regular!Pass' + suffix };
}

async function getProfile(client, uid){
  const response = await client.request('profile_get', { uid }, message => message.type === 'profile_data' || isError(message), client.label + ' 获取档案');
  if (response.type !== 'profile_data') throw new Error(client.label + ' 获取档案失败：' + reasonOf(response));
  return response.payload === null ? null : profileOf(response);
}

function ownedContains(profile, category, ids){
  const owned = profile && profile.owned && typeof profile.owned === 'object' ? profile.owned : {};
  const values = Array.isArray(owned[category]) ? owned[category].map(Number) : [];
  return ids.every(id => values.includes(id));
}

function adminProjection(profile){
  return {
    coins: Number(profile && profile.coins || 0),
    xp: Number(profile && profile.xp || 0),
    level: Number(profile && profile.level || 0),
    streak: Number(profile && profile.streak || 0),
    total: Number(profile && profile.total || 0),
    totalWins: Number(profile && profile.totalWins || 0),
    wins: JSON.stringify(profile && profile.wins || {}),
    owned: JSON.stringify(profile && profile.owned || {}),
  };
}

function dbFor(instance){
  const file = path.join(instance.dataDir, 'leaderboard.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

function rowReferencesUid(row, uid){
  if (!row || typeof row !== 'object') return false;
  if (String(row.uid || row.userId || row.ownerUid || '') === uid) return true;
  if (Array.isArray(row.uids) && row.uids.map(String).includes(uid)) return true;
  return false;
}

function hasTestAdminPollution(db, uid){
  const arrays = ['history', 'rewardHistory', 'economyLedger', 'events', 'replays', 'pendingRewardSync', 'pendingAILearningSync'];
  if (arrays.some(key => Array.isArray(db[key]) && db[key].some(row => rowReferencesUid(row, uid)))) return true;
  const learning = db.aiLearning && typeof db.aiLearning === 'object' ? db.aiLearning : {};
  if (JSON.stringify(learning).includes(uid)) return true;
  const user = db.users && db.users[uid];
  return !!(user && Array.isArray(user.purchaseRequests) && user.purchaseRequests.length);
}

async function assertNoConfiguredAdmin(instance, label){
  const attacker = await new Client(label + '-attacker', instance).open();
  const loginResponse = await login(attacker, ADMIN.username, ADMIN.password);
  check(label + '：默认/错误配置不能登录预设测试管理员', loginResponse.type !== 'logged_in', reasonOf(loginResponse));
  const hello = await attacker.request('hello', { uid: ADMIN.uid, token: 'not-a-real-test-admin-token', proto: 2 }, isHello, label + ' 伪造管理员 hello');
  check(label + '：仅 uid/token 伪造不能获得管理员身份', !isAuthenticated(hello) && hello.admin !== true, JSON.stringify(hello));
  attacker.close();
}

async function runFailClosedChecks(){
  const absent = await startServer('缺省配置');
  try {
    await assertNoConfiguredAdmin(absent, '未配置 TEST_ADMIN');
    check('未配置 TEST_ADMIN：服务日志不出现管理员密码', !absent.output.includes(ADMIN.password));
  } finally {
    await stopServer(absent);
  }
  await assertInvalidConfigurationFailsBeforeListen('缺少 TEST_ADMIN_PASSWORD', {
    TEST_ADMIN_ENABLED: '1',
    TEST_ADMIN_UID: ADMIN.uid,
    TEST_ADMIN_USERNAME: ADMIN.username,
    TEST_ADMIN_PASSWORD: '',
  });
}

async function runEnabledAttackRegression(){
  const instance = await startServer('已启用测试管理员', {
    TEST_ADMIN_ENABLED: '1',
    TEST_ADMIN_UID: ADMIN.uid,
    TEST_ADMIN_USERNAME: ADMIN.username,
    TEST_ADMIN_PASSWORD: ADMIN.password,
    TEST_ADMIN_NAME: ADMIN.name,
  });
  try {
    const suffix = crypto.randomBytes(4).toString('hex');
    const regular = await new Client('普通攻击者', instance).open();
    const regularAccount = await registerRegular(regular, suffix, {
      uid: ADMIN.uid,
      admin: true,
      isTestAdmin: true,
      roles: ['admin'],
      capabilities: ['*'],
      coins: Number.MAX_SAFE_INTEGER,
      xp: Number.MAX_SAFE_INTEGER,
      level: 999999,
      owned: { avatars: [55], frames: [8], effects: [4], backgrounds: [31], game_cosmetics: [2051] },
    });
    check('普通账号注册时忽略伪造管理员 uid', regularAccount.uid !== ADMIN.uid, regularAccount.uid);
    check('普通账号注册时不获得管理员余额/等级',
      Number(regularAccount.profile.coins || 0) === 0 && Number(regularAccount.profile.level || 0) === 1,
      JSON.stringify(adminProjection(regularAccount.profile)));

    const normalHello = await regular.request('hello', {
      uid: regularAccount.uid,
      token: regularAccount.token,
      proto: 2,
      capabilities: ['test-admin-v1', 'admin', '*'],
    }, isHello, '普通账号认证');
    check('普通账号携带伪造能力不会获得管理员权限', isAuthenticated(normalHello) && normalHello.admin !== true, JSON.stringify(normalHello));

    const normalBefore = await getProfile(regular, regularAccount.uid);
    const forgedProfile = await regular.request('profile', {
      uid: regularAccount.uid,
      name: 'Forged Admin',
      testAdmin: true,
      isTestAdmin: true,
      admin: true,
      accountKind: 'test_admin',
      superPermissions: ['all'],
      coins: Number.MAX_SAFE_INTEGER,
      xp: Number.MAX_SAFE_INTEGER,
      level: 999999,
      total: 999999,
      totalWins: 999999,
      wins: { gomoku: 999999 },
      owned: { avatars: [55], frames: [8], effects: [4], backgrounds: [31], game_cosmetics: [2051] },
    }, message => message.type === 'profile_ok' || isError(message), '普通账号篡改管理员字段');
    check('普通账号篡改管理员字段有回执但不提权', forgedProfile.type === 'profile_ok', reasonOf(forgedProfile));
    const normalAfter = await getProfile(regular, regularAccount.uid);
    check('普通账号不能伪造无限货币、满级、全 owned 或超级权限',
      JSON.stringify(adminProjection(normalBefore)) === JSON.stringify(adminProjection(normalAfter)) &&
      !normalAfter.testAdmin && !normalAfter.isTestAdmin && !normalAfter.admin,
      JSON.stringify(adminProjection(normalAfter)));

    const forgedAdminHello = await new Client('伪造管理员连接', instance).open();
    const spoofedHello = await forgedAdminHello.request('hello', {
      uid: ADMIN.uid,
      token: regularAccount.token,
      proto: 2,
      admin: true,
      capabilities: ['test-admin-v1', 'admin'],
    }, isHello, '普通 token 冒充管理员 uid');
    check('普通 token 不能借管理员 uid 冒充身份', !isAuthenticated(spoofedHello) && spoofedHello.admin !== true, JSON.stringify(spoofedHello));
    forgedAdminHello.close();

    const wrongPassword = await new Client('错误管理员密码', instance).open();
    const wrongLogin = await login(wrongPassword, ADMIN.username, ADMIN.password + 'x');
    check('测试管理员错误密码明确拒绝', wrongLogin.type === 'auth_error' && reasonOf(wrongLogin) === 'invalid_credentials', reasonOf(wrongLogin));
    wrongPassword.close();

    const admin = await new Client('真实测试管理员', instance).open();
    const loginResponse = await login(admin, ADMIN.username, ADMIN.password);
    check('完整服务器配置可登录测试管理员', loginResponse.type === 'logged_in', reasonOf(loginResponse));
    const adminUid = uidOf(loginResponse);
    const adminToken = tokenOf(loginResponse);
    check('测试管理员 UID 仅由服务器配置确定', adminUid === ADMIN.uid && adminToken.length >= 24, adminUid);
    const adminHello = await admin.request('hello', { uid: adminUid, token: adminToken, proto: 2 }, isHello, '测试管理员 hello');
    check('测试管理员拥有服务端赛事恢复权限', isAuthenticated(adminHello) && adminHello.admin === true, JSON.stringify(adminHello));

    const tournamentPeerB = await new Client('赛事测试玩家B', instance).open();
    const tournamentAccountB = await registerRegular(tournamentPeerB, suffix + 'b');
    const tournamentPeerC = await new Client('赛事测试玩家C', instance).open();
    const tournamentAccountC = await registerRegular(tournamentPeerC, suffix + 'c');
    const tournamentCreate = await admin.request('tournament_create', {
      gameId: 'gomoku',
      // 测试管理员是外部赛事所有者；参赛者仍必须是普通账号，避免把
      // 测试身份混入正式赛事积分和房间席位。
      participants: [regularAccount.uid, tournamentAccountB.uid, tournamentAccountC.uid],
    }, message => message.type === 'tournament_state' || isError(message), '测试管理员创建隔离赛事');
    check('测试管理员拥有赛事创建权限且不把自己混入参赛者',
      tournamentCreate.type === 'tournament_state' && reasonOf(tournamentCreate) !== 'admin_only',
      reasonOf(tournamentCreate));
    const tournamentId = String(payloadOf(tournamentCreate).tournamentId || payloadOf(tournamentCreate).id || 'tour_missing');

    const adminBefore = await getProfile(admin, adminUid);
    check('测试管理员拥有可表示的无限 G Coins 与最高等级',
      Number(adminBefore.coins) >= 1000000000000 && Number(adminBefore.level) >= 999,
      JSON.stringify({ coins: adminBefore.coins, xp: adminBefore.xp, level: adminBefore.level }));
    check('测试管理员拥有当前商城所有类别的高位商品',
      Object.entries(OWNED_SENTINELS).every(([category, ids]) => ownedContains(adminBefore, category, ids)),
      JSON.stringify(adminBefore.owned));

    const publicAdmin = await getProfile(regular, adminUid);
    check('普通玩家不能读取测试管理员公开档案', publicAdmin === null, JSON.stringify(publicAdmin));
    const leaderboard = await regular.request('leaderboard', {}, message => message.type === 'leaderboard', '普通玩家读取排行榜');
    const leaderboardRows = Array.isArray(payloadOf(leaderboard).list) ? payloadOf(leaderboard).list : [];
    check('排行榜不展示测试管理员', !leaderboardRows.some(row => String(row && row.uid) === adminUid), JSON.stringify(leaderboardRows.map(row => row && row.uid)));

    const purchaseBefore = await getProfile(admin, adminUid);
    const purchase = await admin.request('purchase', {
      category: 'backgrounds', id: 31, requestId: 'admin-purchase-' + crypto.randomUUID(),
    }, message => message.type === 'purchase_ok' || isError(message), '测试管理员购买已全拥有商品');
    check('无限货币测试管理员购买成功且不走余额不足', purchase.type === 'purchase_ok', reasonOf(purchase));
    const purchaseAfter = await getProfile(admin, adminUid);
    check('测试管理员购买不扣 G Coins 或改变经济状态',
      JSON.stringify(adminProjection(purchaseBefore)) === JSON.stringify(adminProjection(purchaseAfter)),
      JSON.stringify({ before: adminProjection(purchaseBefore), after: adminProjection(purchaseAfter) }));
    check('测试管理员购买不写正式经济/AI/分析数据', !hasTestAdminPollution(dbFor(instance), adminUid));

    const created = await admin.request('create', { capacity: 2, visibility: 'public', allowSpectators: true }, message => message.type === 'created' || isError(message), '测试管理员创建测试房间');
    check('测试管理员可创建隔离测试房间', created.type === 'created', reasonOf(created));
    const room = String(created.room || payloadOf(created).room || '');
    check('测试管理员创建返回有效房间号', /^[A-Z0-9]{4,12}$/.test(room), room);
    const regularLobby = await regular.request('lobby', {}, message => message.type === 'lobby', '普通玩家获取大厅');
    const normalRooms = Array.isArray(regularLobby.payload) ? regularLobby.payload : [];
    check('测试房间不出现在普通玩家大厅', !normalRooms.some(item => String(item && item.room) === room), JSON.stringify(normalRooms.map(item => item && item.room)));
    const joinAttempt = await regular.request('join', { room }, message => message.type === 'joined' || isError(message), '普通玩家尝试加入测试房间');
    check('普通玩家不能加入测试管理员房间且获得拒绝 reason',
      joinAttempt.type !== 'joined' && ['test_admin_isolated', 'test_room_forbidden', 'room_access_denied', 'room_not_found'].includes(reasonOf(joinAttempt)),
      reasonOf(joinAttempt));

    const addAi = await admin.request('add_ai', { difficulty: 'hard', persona: 'teacher' }, message => message.type === 'room_update' || isError(message), '测试管理员加入 AI 席位');
    check('测试管理员房间可加入 AI 以完成局内测试', addAi.type === 'room_update' && Number(payloadOf(addAi).aiCount) === 1, JSON.stringify(addAi));
    const selected = await admin.request('select_game', { game: 'gomoku' }, message => message.type === 'room_update' || isError(message), '测试管理员选择五子棋');
    check('测试管理员可选择局内游戏', selected.type === 'room_update' && payloadOf(selected).game === 'gomoku', JSON.stringify(selected));
    const started = await admin.request('start', {}, message => message.type === 'started' || isError(message), '测试管理员开始局内测试');
    check('测试管理员可开始含 AI 的测试局', started.type === 'started', reasonOf(started));
    const matchId = String(started.matchId || payloadOf(started).matchId || '');
    const moveMark = admin.mark();
    admin.send('move', [7, 7]);
    await sleep(140);
    const moveErrors = admin.messages.filter(entry => entry.sequence > moveMark && isError(entry.message));
    check('测试管理员局内操作仍经过正常规则路径', moveErrors.length === 0, moveErrors.length ? JSON.stringify(moveErrors.at(-1).message) : '');
    const settlement = await admin.request('result', {
      matchId,
      game: 'gomoku',
      results: [{ slot: 0, rank: 1, coins: 1 }, { slot: 1, rank: 2, coins: 0 }],
    }, message => message.type === 'result_ok' || isError(message), '测试管理员提交测试结果');
    check('测试管理员可完成测试局但不产生正式奖励', settlement.type === 'result_ok', reasonOf(settlement));
    const afterRoom = await getProfile(admin, adminUid);
    check('测试局不改变测试管理员的正式成长状态',
      JSON.stringify(adminProjection(purchaseAfter)) === JSON.stringify(adminProjection(afterRoom)),
      JSON.stringify({ before: adminProjection(purchaseAfter), after: adminProjection(afterRoom) }));
    check('测试局不写奖励、回放、AI 学习或分析污染', !hasTestAdminPollution(dbFor(instance), adminUid));
    await admin.request('leave', {}, message => message.type === 'peer_left' || message.type === 'left' || message.type === 'lobby' || isError(message), '测试管理员离开测试房间');

    const solo = await admin.request('solo_start', { game: 'gomoku', clientRunId: 'run_adminqa_' + crypto.randomBytes(8).toString('hex') }, message => message.type === 'solo_started' || isError(message), '测试管理员启动 AI 测试');
    check('测试管理员可启动 AI 测试', solo.type === 'solo_started', reasonOf(solo));
    const soloPayload = payloadOf(solo);
    const soloResult = await admin.request('result', {
      mode: 'ai', game: 'gomoku', matchId: soloPayload.matchId, resultId: soloPayload.resultId, result: 'win',
    }, message => message.type === 'result_ok' || isError(message), '测试管理员结束 AI 测试');
    check('测试管理员 AI 测试可得到受控结算回执', soloResult.type === 'result_ok', reasonOf(soloResult));
    check('测试管理员 AI 测试不写奖励、AI 学习或分析污染', !hasTestAdminPollution(dbFor(instance), adminUid));

    const normalRecover = await regular.request('tournament_recover', {
      tournamentId, pairingId: 'pair_missing', targetUid: regularAccount.uid,
    }, message => message.type === 'tournament_error' || isError(message), '普通玩家赛事恢复');
    check('普通玩家不能调用赛事恢复', reasonOf(normalRecover) === 'admin_only', reasonOf(normalRecover));
    const adminRecover = await admin.request('tournament_recover', {
      tournamentId, pairingId: 'pair_missing', targetUid: regularAccount.uid,
    }, message => message.type === 'tournament_error' || message.type === 'tournament_recovered' || isError(message), '测试管理员赛事恢复');
    check('测试管理员通过赛事恢复权限门而非 admin_only', reasonOf(adminRecover) !== 'admin_only', reasonOf(adminRecover));

    const logout = await admin.request('logout', {}, message => message.type === 'logged_out' || isError(message), '测试管理员退出登录');
    check('测试管理员可以正常退出并撤销当前 token', logout.type === 'logged_out', reasonOf(logout));
    const stale = await new Client('旧管理员 token', instance).open();
    const staleHello = await stale.request('hello', { uid: adminUid, token: adminToken, proto: 2 }, isHello, '旧管理员 token hello');
    check('测试管理员 logout 后旧 token 立即失效', !isAuthenticated(staleHello) && staleHello.admin !== true, JSON.stringify(staleHello));
    stale.close();

    const serializedDb = JSON.stringify(dbFor(instance));
    check('测试管理员凭据不写入本地持久数据库', !serializedDb.includes(ADMIN.password) && !serializedDb.includes(adminToken));
    check('测试管理员服务日志不回显凭据', !instance.output.includes(ADMIN.password) && !instance.output.includes(adminToken));
    tournamentPeerB.close();
    tournamentPeerC.close();
    regular.close();
    admin.close();
  } finally {
    await stopServer(instance);
  }
}

async function main(){
  if (typeof WebSocket !== 'function') throw new Error('当前 Node 未启用 WebSocket；Node 20 请用 --experimental-websocket 运行本测试');
  await runFailClosedChecks();
  await runEnabledAttackRegression();
}

main().catch(error => {
  check('测试管理员安全回归流程未崩溃', false, String(error && error.stack || error).replaceAll(ADMIN.password, '<redacted>'));
}).finally(async () => {
  for (const client of clients) client.close();
  for (const instance of instances) await stopServer(instance);
  if (failures.length){
    console.log('TEST_ADMIN_SECURITY_HAS_FAILURES (' + failures.length + ')');
    process.exitCode = 1;
  } else {
    console.log('TEST_ADMIN_SECURITY_ALL_PASS');
  }
});
