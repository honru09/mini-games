// Supabase 适配器回归：完全本地的 fake PostgREST，不访问真实项目或凭证。
// Node 20: node --experimental-websocket qa/supabase-adapter.js
// Node 22+: node qa/supabase-adapter.js
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const TEST_KEY = 'supabase-adapter-local-test-key';
const PIN = 'Adapter2026';
const UID = 'u_adapterseed';
const RESULT_ID = 'solo_adapter_20260807';
const failures = [];
const requests = [];
let app = null;
let fake = null;
let fakeProfile = null;
let appOutput = '';
let dataDir = null;
let failNextRewardTransaction = false;
let dropNextRewardResponse = false;
let failNextLearningRevision = false;
let fakeLearningModel = null;
let assertionCount = 0;
const appliedRewardIds = new Set();
const appliedPurchaseIds = new Set();
const appliedLearningIds = new Set();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(name, condition, detail){
  assertionCount++;
  if (condition) console.log('PASS  ' + name);
  else {
    failures.push({ name, detail: detail || '' });
    console.log('FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function legacyPinHash(pin){
  return crypto.createHash('sha256')
    .update('mg-pin:' + String(pin).trim().toLowerCase())
    .digest('hex');
}

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

function request(port, pathname){
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname }, res => {
      res.resume();
      res.once('end', () => resolve(res.statusCode));
    });
    req.once('error', reject);
  });
}

function postJSON(port, pathname, body, token){
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body || {});
    const req = http.request({
      host: '127.0.0.1', port, path: pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw),
        ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.once('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try { data = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, data, text });
      });
    });
    req.once('error', reject);
    req.end(raw);
  });
}

async function waitUntil(predicate, description, timeout = 6000){
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline){
    const value = await predicate();
    if (value) return value;
    if (app && app.exitCode !== null){
      throw new Error('服务端提前退出（code=' + app.exitCode + '），等待：' + description + '\n' + appOutput.slice(-3000));
    }
    await sleep(25);
  }
  throw new Error('等待超时：' + description + '\n' + appOutput.slice(-3000));
}

function startFakePostgrest(port){
  const now = Date.now();
  const seed = {
    uid: UID,
    name: 'Adapter Seed',
    avatar: 3,
    background: 2,
    frame: 1,
    effect: 0,
    owned: { avatars: [3], frames: [1], effects: [], backgrounds: [2] },
    pin_hash: legacyPinHash(PIN),
    lang: 'en-US',
    xp: 42,
    level: 2,
    streak: 1,
    best_streak: 3,
    name_fx: 0,
    achievements: ['first_game'],
    playmates: {},
    daily: { play: 1, win: 0, streak: 1 },
    daily_key: new Date().toISOString().slice(0, 10),
    auth_tokens: [],
    recent_results: ['solo_seed_existing'],
    purchase_requests: ['purchase_seed_existing'],
    solo_rate: [now - 1000],
    daily_first_win_date: '',
    daily_ai_currency_key: new Date().toISOString().slice(0, 10),
    daily_ai_currency_earned: 0,
    xp_curve_version: 1,
    coins: 37,
    played: { gomoku: 2 },
    total: 2,
    wins: { gomoku: 1 },
    total_wins: 1,
  };
  fakeProfile = seed;

  fake = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body = null;
      if (raw){
        try { body = JSON.parse(raw); }
        catch { body = raw; }
      }
      requests.push({ method: req.method, url: req.url, headers: req.headers, raw, body });

      if (req.method === 'GET' && req.url.startsWith('/rest/v1/profiles?')){
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([seed]));
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/rest/v1/reward_history?')){
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/rest/v1/ai_learning_models?')){
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(fakeLearningModel ? [fakeLearningModel] : []));
        return;
      }
      if (req.method === 'PATCH' && req.url.startsWith('/rest/v1/profiles?uid=eq.')){
        // 新档案同步协议只 PATCH 可编辑/认证字段；模拟 PostgREST 的 204 空响应。
        if (body && typeof body === 'object'){
          for (const field of ['name','avatar','background','frame','effect','lang','name_fx','pin_hash','auth_tokens']){
            if (Object.prototype.hasOwnProperty.call(body, field)) seed[field] = body[field];
          }
        }
        res.writeHead(204, { 'Content-Type': 'application/json' });
        res.end();
        return;
      }
      if (req.method === 'POST' && (req.url.startsWith('/rest/v1/profiles?') ||
          ['/rest/v1/history', '/rest/v1/reward_history', '/rest/v1/economy_ledger', '/rest/v1/analytics_events'].includes(req.url))){
        // PostgREST 在未请求 representation 时可返回 201 且响应体为空。
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end();
        return;
      }
      if (req.method === 'POST' && req.url === '/rest/v1/rpc/apply_reward_v1'){
        const resultId = body && body.p_reward && body.p_reward.result_id;
        if (failNextRewardTransaction){
          failNextRewardTransaction = false;
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end('{"error":"temporary_unavailable"}');
          return;
        }
        if (dropNextRewardResponse){
          dropNextRewardResponse = false;
          if (resultId) appliedRewardIds.add(resultId);
          req.socket.destroy();
          return;
        }
        if (resultId && appliedRewardIds.has(resultId)){
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ applied: false, duplicate: true, resultId }));
          return;
        }
        if (resultId) appliedRewardIds.add(resultId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ applied: true, duplicate: false, resultId }));
        return;
      }
      if (req.method === 'POST' && req.url === '/rest/v1/rpc/apply_purchase_v1'){
        const requestId = body && body.p_request_id;
        const category = body && body.p_category;
        const itemId = Number(body && body.p_item_id);
        const price = Number(body && body.p_price);
        const reply = payload => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ resultId: requestId, coins: seed.coins, owned: seed.owned,
            purchaseRequests: seed.purchase_requests, ...payload }));
        };
        if (requestId && (appliedPurchaseIds.has(requestId) || seed.purchase_requests.includes(requestId))){
          reply({ applied: false, duplicate: true });
          return;
        }
        const owned = seed.owned && Array.isArray(seed.owned[category]) ? seed.owned[category] : null;
        if (owned && owned.includes(itemId)){
          seed.purchase_requests = seed.purchase_requests.concat(requestId).slice(-100);
          reply({ applied: false, duplicate: false, alreadyOwned: true });
          return;
        }
        if (!owned || seed.coins < price){
          reply({ applied: false, duplicate: false, insufficient: true });
          return;
        }
        seed.coins -= price;
        owned.push(itemId);
        seed.purchase_requests = seed.purchase_requests.concat(requestId).slice(-100);
        appliedPurchaseIds.add(requestId);
        reply({ applied: true, duplicate: false });
        return;
      }
      if (req.method === 'POST' && req.url === '/rest/v1/rpc/apply_ai_learning_v1'){
        const resultId = body && body.p_result_id;
        if (failNextLearningRevision){
          failNextLearningRevision = false;
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end('{"error":"stale_ai_learning_revision"}');
          return;
        }
        const duplicate = resultId && appliedLearningIds.has(resultId);
        if (resultId) appliedLearningIds.add(resultId);
        if (body && body.p_model) fakeLearningModel = body.p_model;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ applied: !duplicate, duplicate: !!duplicate, resultId,
          revision: body && body.p_model && body.p_model.revision || 0 }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"not_found"}');
    });
  });
  return new Promise((resolve, reject) => {
    fake.once('error', reject);
    fake.listen(port, '127.0.0.1', resolve);
  });
}

class Client {
  constructor(url){
    this.url = url;
    this.ws = null;
    this.messages = [];
    this.seq = 0;
  }

  async open(){
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket 连接超时')), 5000);
      this.ws.addEventListener('message', event => {
        let message;
        try { message = JSON.parse(String(event.data)); }
        catch { message = { type: '__invalid_json__' }; }
        this.messages.push({ seq: ++this.seq, message });
      });
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket 连接失败')); }, { once: true });
    });
  }

  mark(){ return this.seq; }

  send(message){ this.ws.send(JSON.stringify(message)); }

  async waitAfter(mark, type, timeout = 5000){
    return waitUntil(() => {
      const hit = this.messages.find(entry => entry.seq > mark && entry.message.type === type);
      return hit && hit.message;
    }, 'WebSocket 消息 ' + type, timeout);
  }

  close(){
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) this.ws.close();
  }
}

function stopProcess(child){
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(resolve, 2000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill();
  });
}

async function closeServer(server){
  if (!server || !server.listening) return;
  await new Promise(resolve => server.close(resolve));
}

async function main(){
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  dataDir = fs.mkdtempSync(path.join(ROOT, 'data', 'qa-supabase-adapter-'));
  const fakePort = await reservePort();
  await startFakePostgrest(fakePort);
  const appPort = await reservePort();

  app = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(appPort),
      DATA_DIR: dataDir,
      NODE_ENV: 'test',
      ENABLE_RULE_AUTHORITY_V2: '0',
      SUPABASE_URL: 'http://127.0.0.1:' + fakePort,
      SUPABASE_KEY: TEST_KEY,
      // The server prefers SERVICE_ROLE_KEY. Explicitly clear inherited
      // production credentials so this fake PostgREST test never emits them.
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_DB_URL: '',
      SUPABASE_RESTORE_DB_URL: '',
      DEEPSEEK_KEY: '',
      ALLOWED_ORIGINS: '',
      REWARD_TEST_MIN_DURATION_MS: '0',
      REWARD_SYNC_RETRY_MS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  app.stdout.on('data', chunk => { appOutput += String(chunk); });
  app.stderr.on('data', chunk => { appOutput += String(chunk); });

  await waitUntil(async () => {
    try { return (await request(appPort, '/api/ip')) === 200; }
    catch { return false; }
  }, '应用服务启动', 10000);
  await waitUntil(() => requests.some(item => item.method === 'GET'), 'Supabase 初始档案读取');

  const client = new Client('ws://127.0.0.1:' + appPort + '/ws');
  await client.open();

  let mark = client.mark();
  client.send({ type: 'login', payload: { pin: PIN } });
  const loggedIn = await client.waitAfter(mark, 'logged_in');
  check('fake Supabase 档案可用 PIN 登录', loggedIn && loggedIn.payload && loggedIn.payload.uid === UID,
    JSON.stringify(loggedIn && loggedIn.payload));
  check('登录返回远端档案字段', loggedIn && loggedIn.payload && loggedIn.payload.profile &&
    loggedIn.payload.profile.name === 'Adapter Seed' && loggedIn.payload.profile.coins === 37);

  const purchaseStart = requests.length;
  const purchaseId = 'purchase_adapter_atomic_20260807';
  mark = client.mark();
  client.send({ type: 'purchase', payload: { category: 'frames', id: 2, requestId: purchaseId } });
  const purchaseOk = await client.waitAfter(mark, 'purchase_ok');
  check('购买 RPC 原子扣款并发放商品', purchaseOk && purchaseOk.payload && purchaseOk.payload.profile &&
    purchaseOk.payload.profile.coins === 25 && purchaseOk.payload.profile.owned.frames.includes(2),
  JSON.stringify(purchaseOk && purchaseOk.payload));

  mark = client.mark();
  client.send({ type: 'purchase', payload: { category: 'frames', id: 2, requestId: purchaseId } });
  const replayedPurchase = await client.waitAfter(mark, 'purchase_ok');
  check('相同 purchase requestId 重放不重复扣款', replayedPurchase && replayedPurchase.payload &&
    replayedPurchase.payload.replayed === true && replayedPurchase.payload.profile.coins === 25,
  JSON.stringify(replayedPurchase && replayedPurchase.payload));

  mark = client.mark();
  client.send({ type: 'purchase', payload: {
    category: 'frames', id: 2, requestId: 'purchase_adapter_owned_20260807',
  } });
  const ownedPurchase = await client.waitAfter(mark, 'purchase_ok');
  check('已拥有商品使用新 requestId 不扣款', ownedPurchase && ownedPurchase.payload &&
    ownedPurchase.payload.alreadyOwned === true && ownedPurchase.payload.replayed !== true &&
    ownedPurchase.payload.profile.coins === 25, JSON.stringify(ownedPurchase && ownedPurchase.payload));

  // 制造“应用内缓存仍有余额、数据库余额已被其他进程消费”的并发窗口，确认最终由 RPC 拒绝。
  fakeProfile.coins = 0;
  mark = client.mark();
  client.send({ type: 'purchase', payload: {
    category: 'backgrounds', id: 10, requestId: 'purchase_adapter_insufficient_20260807',
  } });
  const insufficientPurchase = await client.waitAfter(mark, 'purchase_error');
  check('余额不足由购买 RPC 拒绝且不写入 requestId', insufficientPurchase && /余额不足/.test(insufficientPurchase.msg || '') &&
    !fakeProfile.purchase_requests.includes('purchase_adapter_insufficient_20260807'), JSON.stringify(insufficientPurchase));
  const purchaseRequests = requests.slice(purchaseStart).filter(item =>
    item.method === 'POST' && item.url === '/rest/v1/rpc/apply_purchase_v1');
  check('购买档案与经济流水只通过 apply_purchase_v1 提交', purchaseRequests.length === 4 &&
    !requests.slice(purchaseStart).some(item => item.method === 'POST' && item.url === '/rest/v1/economy_ledger'));

  mark = client.mark();
  client.send({ type: 'profile', payload: { uid: UID, name: 'Synced User', lang: 'uk-UA' } });
  const profileOk = await client.waitAfter(mark, 'profile_ok');
  check('201 空 profile 响应不影响档案更新', profileOk && profileOk.payload &&
    profileOk.payload.name === 'Synced User' && profileOk.payload.lang === 'uk-UA');

  mark = client.mark();
  const clientRunId = 'run_adapter_20260807';
  client.send({ type: 'solo_start', payload: { game: 'gomoku', clientRunId } });
  const soloStarted = await client.waitAfter(mark, 'solo_started');
  const ticket = soloStarted && soloStarted.payload || {};
  const aiResponse = await postJSON(appPort, '/api/ai', {
    game: 'gomoku',
    state: { board: 'adapter-private-board', turn: 1 },
    options: ['7,7', '7,8'],
    candidates: [
      { choice: '7,7', features: { quality: 1, center: 1 } },
      { choice: '7,8', features: { quality: .8, center: .9 } },
    ],
    persona: { id: 'teacher' },
    context: { matchId: ticket.matchId, resultId: ticket.resultId },
  }, loggedIn.payload.token);
  check('AI API 使用本地强候选并绑定当前服务端票据', aiResponse.status === 200 &&
    aiResponse.data && aiResponse.data.choice === '7,7' && aiResponse.data.strategyVersion === 'game-skill-v1', aiResponse.text);
  mark = client.mark();
  client.send({ type: 'ai_decision_confirm', payload: {
    game: 'gomoku', matchId: ticket.matchId, resultId: ticket.resultId,
    decisionId: aiResponse.data.decisionId, choice: aiResponse.data.choice,
  } });
  const aiConfirmed = await client.waitAfter(mark, 'ai_decision_confirmed');
  check('AI 学习建议在实际执行确认后才入缓存', aiConfirmed && aiConfirmed.payload &&
    aiConfirmed.payload.decisionId === aiResponse.data.decisionId, JSON.stringify(aiConfirmed));
  [[7,7],[7,8],[8,7],[8,8]].forEach(action => client.send({
    type: 'solo_progress', payload: { matchId: ticket.matchId, game: 'gomoku', action },
  }));
  mark = client.mark();
  client.send({
    type: 'result',
    payload: { mode: 'ai', game: 'gomoku', result: 'win', matchId: ticket.matchId, resultId: ticket.resultId },
  });
  const resultOk = await client.waitAfter(mark, 'result_ok');
  check('201 空奖励流水响应不影响结算', resultOk && resultOk.payload && resultOk.payload.resultId === ticket.resultId &&
    resultOk.payload.reward && resultOk.payload.reward.currency === 1 && resultOk.payload.reward.xp === 8);

  const rewardTransaction = await waitUntil(() => requests.find(item =>
    item.method === 'POST' && item.url === '/rest/v1/rpc/apply_reward_v1' && item.body &&
    item.body.p_reward && item.body.p_reward.result_id === ticket.resultId), '原子奖励事务');
  const historyRow = rewardTransaction.body.p_history;
  const rewardRow = rewardTransaction.body.p_reward;
  const ledgerRow = rewardTransaction.body.p_ledger;
  const resultProfile = rewardTransaction.body.p_profile;

  const requiredProfileFields = [
    'uid', 'pin_hash', 'owned', 'game_cosmetics', 'daily_key', 'auth_tokens', 'recent_results',
    'purchase_requests', 'solo_rate', 'daily_first_win_date', 'daily_ai_currency_key',
    'daily_ai_currency_earned', 'xp_curve_version', 'coins', 'played', 'total', 'wins', 'total_wins', 'updated_at',
  ];
  check('profile 同步包含本轮关键字段', requiredProfileFields.every(field =>
    Object.prototype.hasOwnProperty.call(resultProfile, field)),
  '缺少：' + requiredProfileFields.filter(field => !Object.prototype.hasOwnProperty.call(resultProfile, field)).join(', '));
  check('solo_rate 从远端载入并在结算后同步', Array.isArray(resultProfile.solo_rate) &&
    resultProfile.solo_rate.length === 2 && resultProfile.solo_rate.every(Number.isFinite),
  JSON.stringify(resultProfile.solo_rate));
  check('PIN 登录后慢哈希迁移被同步', typeof resultProfile.pin_hash === 'string' &&
    resultProfile.pin_hash.startsWith('s2$'));
  check('history 同步包含幂等、模式与奖励字段', historyRow.uid === UID &&
    historyRow.game === 'gomoku' && historyRow.result_id === ticket.resultId &&
    historyRow.match_id === ticket.matchId && historyRow.mode === 'ai' &&
    historyRow.coins === 1 && historyRow.xp === 8 && historyRow.eligible === true);
  check('reward_history 保存完整 Reward Breakdown', rewardRow.reward_currency === 1 &&
    rewardRow.reward_xp === 8 && rewardRow.config_version === '1.0' && Array.isArray(rewardRow.breakdown));
  check('economy_ledger 可审计本次 💵 变化', ledgerRow.kind === 'match_reward' &&
    ledgerRow.amount === 1 && Number.isInteger(ledgerRow.balance_after));
  check('奖励档案、历史、Reward Breakdown 与账本使用单个事务 RPC',
    !requests.some(item => item.method === 'POST' && ['/rest/v1/history','/rest/v1/reward_history','/rest/v1/economy_ledger'].includes(item.url)));
  const learningTransaction = await waitUntil(() => requests.find(item =>
    item.method === 'POST' && item.url === '/rest/v1/rpc/apply_ai_learning_v1' &&
    item.body && item.body.p_result_id === ticket.resultId), 'AI 学习原子事务');
  const learningModel = learningTransaction.body.p_model;
  const learningRows = learningTransaction.body.p_experiences;
  check('AI 胜负经验与个性化模型使用单个事务 RPC', learningModel.uid === UID &&
    learningModel.game === 'gomoku' && learningModel.revision === 1 && Array.isArray(learningRows) && learningRows.length === 1);
  check('AI 经验只保存局面哈希和归一化特征', /^[a-f0-9]{32}$/.test(learningRows[0].state_hash) &&
    learningRows[0].result_id === ticket.resultId && learningRows[0].used_for_training === true &&
    !JSON.stringify(learningTransaction.body).includes('adapter-private-board'));
  check('所有 Supabase 请求只使用测试凭证', requests.every(item =>
    item.headers.apikey === TEST_KEY && item.headers.authorization === 'Bearer ' + TEST_KEY));

  // 先故意让一次事务失败：客户端仍收到本地结算，服务端 outbox 必须自动重试同一 resultId。
  failNextRewardTransaction = true;
  // 再制造一次 AI 模型 revision 冲突，验证 outbox 能从远端模型重放 confirmed replay。
  failNextLearningRevision = true;
  mark = client.mark();
  client.send({ type: 'solo_start', payload: { game: 'gomoku', clientRunId: 'run_adapter_retry_20260807' } });
  const retryStarted = await client.waitAfter(mark, 'solo_started');
  const retryTicket = retryStarted && retryStarted.payload || {};
  const retryAI = await postJSON(appPort, '/api/ai', {
    game: 'gomoku', state: { board: 'adapter-retry-board', turn: 1 },
    options: ['6,6', '6,7'], candidates: [
      { choice: '6,6', features: { quality: 1, safety: .8 } },
      { choice: '6,7', features: { quality: .8, safety: .7 } },
    ], persona: { id: 'teacher' }, context: { matchId: retryTicket.matchId, resultId: retryTicket.resultId },
  }, loggedIn.payload.token);
  mark = client.mark();
  client.send({ type: 'ai_decision_confirm', payload: {
    game: 'gomoku', matchId: retryTicket.matchId, resultId: retryTicket.resultId,
    decisionId: retryAI.data && retryAI.data.decisionId, choice: retryAI.data && retryAI.data.choice,
  } });
  await client.waitAfter(mark, 'ai_decision_confirmed');
  [[6,6],[6,7],[7,6],[7,7]].forEach((payload, index) => client.send({
    type: 'solo_progress', payload: {
      matchId: retryTicket.matchId, game: 'gomoku',
      action: { actionId: 'act_adapter_retry_' + index, payload },
    },
  }));
  mark = client.mark();
  client.send({ type: 'result', payload: {
    mode: 'ai', game: 'gomoku', result: 'win', matchId: retryTicket.matchId, resultId: retryTicket.resultId,
  } });
  const retryResult = await client.waitAfter(mark, 'result_ok');
  check('Supabase 短暂失败不阻塞本地权威结算', retryResult && retryResult.payload &&
    retryResult.payload.reward && retryResult.payload.reward.eligible === true, JSON.stringify(retryResult));
  const retryTransactions = await waitUntil(() => {
    const attempts = requests.filter(item => item.method === 'POST' && item.url === '/rest/v1/rpc/apply_reward_v1' &&
      item.body && item.body.p_reward && item.body.p_reward.result_id === retryTicket.resultId);
    return attempts.length >= 2 ? attempts : null;
  }, '奖励 outbox 自动重试', 5000);
  check('Supabase 奖励事务失败后按相同 resultId 自动重试', retryTransactions.length >= 2 &&
    retryTransactions.every(item => item.body.p_reward.result_id === retryTicket.resultId),
  'attempts=' + retryTransactions.length);
  const retryLearningTransactions = await waitUntil(() => {
    const attempts = requests.filter(item => item.method === 'POST' && item.url === '/rest/v1/rpc/apply_ai_learning_v1' &&
      item.body && item.body.p_result_id === retryTicket.resultId);
    return attempts.length >= 2 ? attempts : null;
  }, 'AI 学习 revision 冲突后重试', 5000);
  await waitUntil(() => {
    if (!fs.existsSync(path.join(dataDir, 'leaderboard.json'))) return false;
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'leaderboard.json'), 'utf8'));
    return !(saved.pendingAILearningSync || []).some(item => item && item.resultId === retryTicket.resultId);
  }, 'AI 学习 revision 重基后清理 outbox', 5000);
  check('AI 学习 revision 冲突按 replay 重基并以连续 revision 重试', retryLearningTransactions.length >= 2 &&
    retryLearningTransactions[retryLearningTransactions.length - 1].body.p_model.revision >= 2,
  'attempts=' + retryLearningTransactions.length);

  // 模拟数据库已经提交，但 HTTP 响应在客户端收到前断开；下一次幂等重试返回 duplicate。
  dropNextRewardResponse = true;
  mark = client.mark();
  client.send({ type: 'solo_start', payload: { game: 'gomoku', clientRunId: 'run_adapter_duplicate_20260807' } });
  const duplicateStarted = await client.waitAfter(mark, 'solo_started');
  const duplicateTicket = duplicateStarted && duplicateStarted.payload || {};
  [[5,5],[5,6],[6,5],[6,6]].forEach((payload, index) => client.send({
    type: 'solo_progress', payload: {
      matchId: duplicateTicket.matchId, game: 'gomoku',
      action: { actionId: 'act_adapter_duplicate_' + index, payload },
    },
  }));
  mark = client.mark();
  client.send({ type: 'result', payload: {
    mode: 'ai', game: 'gomoku', result: 'win', matchId: duplicateTicket.matchId, resultId: duplicateTicket.resultId,
  } });
  await client.waitAfter(mark, 'result_ok');
  const duplicateAttempts = await waitUntil(() => {
    const attempts = requests.filter(item => item.method === 'POST' && item.url === '/rest/v1/rpc/apply_reward_v1' &&
      item.body && item.body.p_reward && item.body.p_reward.result_id === duplicateTicket.resultId);
    return attempts.length >= 2 ? attempts : null;
  }, '奖励事务丢失响应后的幂等确认', 5000);
  await waitUntil(() => {
    const dbFile = path.join(dataDir, 'leaderboard.json');
    if (!fs.existsSync(dbFile)) return false;
    const saved = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    return !(saved.pendingRewardSync || []).some(item => item && item.row && item.row.resultId === duplicateTicket.resultId);
  }, 'duplicate 回执清理奖励 outbox', 5000);
  check('RPC 已提交但响应丢失时，duplicate 回执作为成功终态并清理 outbox', duplicateAttempts.length === 2);

  await sleep(100);
  check('201 空响应不会被误判为 Supabase 解析错误',
    !/supabase 201|无效 JSON/.test(appOutput), appOutput.slice(-1000));

  client.close();
  if (failures.length){
    throw new Error(failures.length + ' 项断言失败');
  }
  console.log('SUPABASE_ADAPTER_ALL_PASS (' + assertionCount + ' assertions)');
}

main().catch(error => {
  console.error('SUPABASE_ADAPTER_FAILED:', error && error.stack || error);
  process.exitCode = 1;
}).finally(async () => {
  await stopProcess(app);
  await closeServer(fake);
  if (dataDir){
    try { fs.rmSync(dataDir, { recursive: true, force: true }); }
    catch {}
  }
});
