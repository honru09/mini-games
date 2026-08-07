// AI 持续学习端到端回归：本地服务 + WebSocket 票据 + 已认证 AI API + JSON 持久化。
// Node 20: node --experimental-websocket qa/ai-learning-online.js
// Node 22+: node qa/ai-learning-online.js
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
const WAIT_MS = 6000;
const UID = 'u_ailearnonline';
const PIN = 'Learn2026';
const MODEL_KEY = UID + '|gomoku';
const AUTH_SEED = crypto.randomBytes(32).toString('hex');

let assertionCount = 0;
let dataDir = null;
let activeServer = null;
let combinedServerOutput = '';
const clients = [];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(name, condition, detail){
  assertionCount++;
  if (!condition){
    throw new Error(name + (detail ? ' :: ' + detail : ''));
  }
  console.log('PASS  ' + name);
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

function httpRequest(port, options = {}){
  const body = options.body === undefined ? null : Buffer.from(String(options.body));
  const headers = { ...(options.headers || {}) };
  if (body && headers['Content-Length'] === undefined) headers['Content-Length'] = String(body.length);
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: options.path || '/',
      method: options.method || 'GET',
      headers,
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try { data = JSON.parse(text); } catch {}
        resolve({ status: response.statusCode, headers: response.headers, text, data });
      });
    });
    request.once('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function waitForServer(instance){
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline){
    if (instance.child.exitCode !== null){
      throw new Error('服务端提前退出（code=' + instance.child.exitCode + '）\n' + instance.output.slice(-3000));
    }
    try {
      const response = await httpRequest(instance.port, { path: '/api/ip' });
      if (response.status === 200) return;
    } catch {}
    await sleep(50);
  }
  throw new Error('等待服务端启动超时\n' + instance.output.slice(-3000));
}

async function startServer(){
  const port = await reservePort();
  const origin = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, [SERVER], {
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
      AUTH_SECRET: AUTH_SEED,
      SESSION_SECRET: AUTH_SEED,
      ALLOWED_ORIGINS: origin,
      CORS_ORIGINS: origin,
      REWARD_TEST_MIN_DURATION_MS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const instance = { child, port, origin, output: '' };
  const capture = chunk => {
    instance.output = (instance.output + String(chunk)).slice(-20000);
    combinedServerOutput = (combinedServerOutput + String(chunk)).slice(-40000);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  activeServer = instance;
  await waitForServer(instance);
  return instance;
}

async function stopServer(instance){
  if (!instance || instance.child.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 2000);
    instance.child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try { instance.child.kill(); }
    catch {
      clearTimeout(timer);
      resolve();
    }
  });
  if (activeServer === instance) activeServer = null;
}

class WsClient {
  constructor(label, url){
    this.label = label;
    this.url = url;
    this.ws = null;
    this.messages = [];
    this.seq = 0;
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
    const tail = this.messages.slice(-8).map(entry => entry.message.type).join(', ');
    throw new Error(this.label + ' 等待超时：' + description + '；最近消息：' + (tail || '(无)'));
  }

  request(message, predicate, description, timeout){
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
}

function isReject(message){
  return !!message && typeof message.type === 'string' &&
    (message.type === 'error' || message.type === 'auth_error' || message.type === 'result_error' ||
      message.type === 'forbidden' || /_rejected$/.test(message.type));
}

function readDB(){
  const file = path.join(dataDir, 'leaderboard.json');
  if (!fs.existsSync(file)) throw new Error('持久化文件不存在：' + file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function register(client){
  const response = await client.request({
    type: 'register',
    payload: { uid: UID, pin: PIN, name: 'AI Learning QA', avatar: 1, background: 0, lang: 'zh-CN' },
  }, message => message.type === 'registered' || isReject(message), '注册测试账号');
  check('注册非临时账号并签发 token', response.type === 'registered' && response.payload &&
    response.payload.uid === UID && typeof response.payload.token === 'string' && response.payload.token.length > 20,
  JSON.stringify(response));
  return { uid: response.payload.uid, token: response.payload.token };
}

async function authenticate(client, account){
  const response = await client.request({
    type: 'hello', payload: { uid: account.uid, token: account.token, proto: 1 },
  }, message => message.type === 'hello_ack' || isReject(message), 'token 鉴权');
  check('WebSocket token 鉴权成功', response.type === 'hello_ack' &&
    (response.authenticated === true || (response.payload && response.payload.authenticated === true)),
  JSON.stringify(response));
}

async function startSolo(client, clientRunId){
  const response = await client.request({
    type: 'solo_start', payload: { game: 'gomoku', clientRunId },
  }, message => message.type === 'solo_started' || isReject(message), '签发人机票据');
  check('solo_start 返回服务端 matchId/resultId', response.type === 'solo_started' && response.payload &&
    /^ai_[A-Za-z0-9_-]{10,120}$/.test(String(response.payload.matchId || '')) &&
    /^ai_result_[A-Za-z0-9_-]{10,120}$/.test(String(response.payload.resultId || '')),
  JSON.stringify(response));
  return response.payload;
}

async function chooseAI(instance, token, marker, options, candidates, ticket, client){
  const response = await httpRequest(instance.port, {
    method: 'POST',
    path: '/api/ai',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      Origin: instance.origin,
    },
    body: JSON.stringify({
      game: 'gomoku',
      state: { board: marker, turn: 1, privateSequence: [3, 1, 4, 1, 5] },
      options,
      candidates,
      persona: { id: 'teacher' },
      context: ticket ? { matchId: ticket.matchId, resultId: ticket.resultId } : null,
    }),
  });
  check('已认证 POST /api/ai 接受 options+candidates', response.status === 200 && response.data &&
    response.data.choice === options[0] && response.data.strategyVersion === 'game-skill-v1',
  'status=' + response.status + ', body=' + response.text.slice(0, 500));
  if (response.data && response.data.decisionId && ticket && client){
    const mark = client.mark();
    client.send({ type: 'ai_decision_confirm', payload: {
      game: 'gomoku', matchId: ticket.matchId, resultId: ticket.resultId,
      decisionId: response.data.decisionId, choice: response.data.choice,
    } });
    const confirmed = await client.waitAfter(mark, message => message.type === 'ai_decision_confirmed', '确认 AI 实际执行建议');
    check('AI 建议必须经客户端确认后才进入学习缓存', confirmed && confirmed.payload &&
      confirmed.payload.decisionId === response.data.decisionId, JSON.stringify(confirmed));
  }
  return response.data;
}

function sendProgress(client, ticket, prefix, actions){
  actions.forEach((payload, index) => client.send({
    type: 'solo_progress',
    payload: {
      matchId: ticket.matchId,
      game: 'gomoku',
      action: { actionId: 'act_' + prefix + '_' + index, payload },
    },
  }));
}

async function settle(client, ticket, result){
  const response = await client.request({
    type: 'result',
    payload: {
      mode: 'ai', game: 'gomoku', result,
      matchId: ticket.matchId, resultId: ticket.resultId,
    },
  }, message => (message.type === 'result_ok' || isReject(message)) &&
    (!message.payload || !message.payload.resultId || message.payload.resultId === ticket.resultId),
  '完成人机结算');
  check('足量唯一进度得到有效 result_ok', response.type === 'result_ok' && response.payload &&
    response.payload.resultId === ticket.resultId && response.payload.reward && response.payload.reward.eligible === true,
  JSON.stringify(response));
  return response;
}

function modelOf(db){
  return db && db.aiLearning && db.aiLearning.models && db.aiLearning.models[MODEL_KEY];
}

function experiencesOf(db){
  return db && db.aiLearning && Array.isArray(db.aiLearning.experiences) ? db.aiLearning.experiences : [];
}

async function run(){
  if (typeof WebSocket !== 'function'){
    throw new Error('当前 Node 未启用 WebSocket；Node 20 请用 --experimental-websocket 运行本测试');
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-ai-learning-'));
  console.log('INFO  临时 DATA_DIR：' + dataDir);

  let instance = await startServer();
  let client = await new WsClient('first-run', 'ws://127.0.0.1:' + instance.port + '/ws').open();
  const account = await register(client);
  await authenticate(client, account);

  const firstMarker = 'raw-private-board-first-' + crypto.randomUUID();
  const firstTicket = await startSolo(client, 'run_ai_learning_first_20260807');
  await chooseAI(instance, account.token, firstMarker, ['7,7', '7,8'], [
    { choice: '7,7', features: { quality: 1, center: 1, safety: .9 } },
    { choice: '7,8', features: { quality: .8, center: .9, safety: .7 } },
  ], firstTicket, client);
  // 模拟 DeepSeek 慢响应/客户端超时后的“只拿到建议但未实际执行”：
  // 服务端会签发 pending decisionId，但在结算前不应把它写进 aiDecisions。
  const unconfirmed = await chooseAI(instance, account.token, 'raw-private-board-unconfirmed-' + crypto.randomUUID(),
    ['8,8', '8,9'], [
      { choice: '8,8', features: { quality: .7, safety: .6 } },
      { choice: '8,9', features: { quality: .6, safety: .5 } },
    ], firstTicket, null);
  check('未确认的慢 AI 建议只保留短期 pending 票据', typeof (unconfirmed && unconfirmed.decisionId) === 'string',
    JSON.stringify(unconfirmed));
  sendProgress(client, firstTicket, 'first', [[7,7], [7,8], [8,7], [8,8]]);

  const pendingDB = readDB();
  check('未结算 pending 对局不会持久化训练', !modelOf(pendingDB) && experiencesOf(pendingDB).length === 0);
  check('未配置 Supabase 时 AI 学习 outbox 保持为空', Array.isArray(pendingDB.pendingAILearningSync) &&
    pendingDB.pendingAILearningSync.length === 0);

  await settle(client, firstTicket, 'win');
  const firstDB = readDB();
  const firstModel = modelOf(firstDB);
  const firstExperiences = experiencesOf(firstDB);
  check('首次赛果生成 revision=1 的五子棋个性化模型', firstModel && firstModel.uid === UID &&
    firstModel.game === 'gomoku' && firstModel.revision === 1,
  JSON.stringify(firstModel));
  check('模型统计记录训练局、AI 决策和人类胜利', firstModel.stats.matches === 1 &&
    firstModel.stats.trainingMatches === 1 && firstModel.stats.decisions === 1 &&
    firstModel.stats.aiLosses === 1 && firstModel.stats.aiWins === 0 && firstModel.stats.draws === 0,
  JSON.stringify(firstModel.stats));
  check('未实际执行的 AI 建议不会形成幽灵决策', firstModel.stats.decisions === 1 && firstExperiences.length === 1,
    JSON.stringify({ decisions: firstModel.stats.decisions, experiences: firstExperiences.length }));
  check('首局即产生可泛化权重更新而非只记流水', firstModel.stats.trainingDecisions === 1 &&
    firstModel.stats.updates >= 1 && Object.keys(firstModel.weights || {}).length > 0,
  JSON.stringify({ stats:firstModel.stats, weights:firstModel.weights }));
  check('经验绑定首局赛果且用于训练', firstExperiences.length === 1 &&
    firstExperiences[0].resultId === firstTicket.resultId && firstExperiences[0].humanResult === 'win' &&
    firstExperiences[0].aiOutcome === -1 && firstExperiences[0].usedForTraining === true,
  JSON.stringify(firstExperiences));
  check('经验只保存 state_hash，不保存原始局面', /^[a-f0-9]{32}$/.test(firstExperiences[0].stateHash) &&
    !Object.prototype.hasOwnProperty.call(firstExperiences[0], 'state') &&
    !JSON.stringify(firstDB.aiLearning).includes(firstMarker));
  check('本地模式没有待同步 AI 学习记录', firstDB.pendingAILearningSync.length === 0);

  const duplicate = await client.request({
    type: 'result', payload: {
      mode: 'ai', game: 'gomoku', result: 'win',
      matchId: firstTicket.matchId, resultId: firstTicket.resultId,
    },
  }, message => message.type === 'result_ok' || isReject(message), '重复提交相同 resultId');
  check('重复 result 返回 replayed 回执', duplicate.type === 'result_ok' && duplicate.payload && duplicate.payload.replayed === true,
    JSON.stringify(duplicate));
  const duplicateDB = readDB();
  check('重复 result 不会二次学习', modelOf(duplicateDB).revision === 1 &&
    modelOf(duplicateDB).stats.matches === 1 && experiencesOf(duplicateDB).length === 1);

  client.close();
  await stopServer(instance);

  const persistedBeforeRestart = JSON.stringify(firstDB.aiLearning);
  instance = await startServer();
  client = await new WsClient('second-run', 'ws://127.0.0.1:' + instance.port + '/ws').open();
  await authenticate(client, account);
  const restartedDB = readDB();
  check('重启同一 DATA_DIR 后模型与经验仍存在', JSON.stringify(restartedDB.aiLearning) === persistedBeforeRestart &&
    modelOf(restartedDB).revision === 1 && experiencesOf(restartedDB).length === 1);

  const secondMarker = 'raw-private-board-second-' + crypto.randomUUID();
  const secondTicket = await startSolo(client, 'run_ai_learning_second_20260807');
  await chooseAI(instance, account.token, secondMarker, ['6,6', '6,7'], [
    { choice: '6,6', features: { quality: .95, center: .85, safety: .8 } },
    { choice: '6,7', features: { quality: .7, center: .75, safety: .6 } },
  ], secondTicket, client);
  sendProgress(client, secondTicket, 'second', [[6,6], [6,7], [7,6], [7,7]]);
  const secondPendingDB = readDB();
  check('重启后的第二局在 result 前仍不预先训练', modelOf(secondPendingDB).revision === 1 &&
    experiencesOf(secondPendingDB).length === 1);

  await settle(client, secondTicket, 'loss');
  const finalDB = readDB();
  const finalModel = modelOf(finalDB);
  const finalExperiences = experiencesOf(finalDB);
  const secondExperience = finalExperiences.find(row => row.resultId === secondTicket.resultId);
  check('不同赛果使持久模型 revision 递增', finalModel.revision === 2 && finalModel.stats.matches === 2 &&
    finalModel.stats.trainingMatches === 2 && finalModel.stats.decisions === 2 &&
    finalModel.stats.trainingDecisions === 2 && finalModel.stats.updates >= 2,
  JSON.stringify(finalModel));
  check('第二种赛果更新 AI 胜负统计', finalModel.stats.aiLosses === 1 &&
    finalModel.stats.aiWins === 1 && finalModel.stats.draws === 0,
  JSON.stringify(finalModel.stats));
  check('第二局 loss 经验正确且用于训练', finalExperiences.length === 2 && secondExperience &&
    secondExperience.humanResult === 'loss' && secondExperience.aiOutcome === 1 && secondExperience.usedForTraining === true);
  check('重启后的新经验同样不泄露原始局面', secondExperience && /^[a-f0-9]{32}$/.test(secondExperience.stateHash) &&
    !Object.prototype.hasOwnProperty.call(secondExperience, 'state') &&
    !JSON.stringify(finalDB.aiLearning).includes(firstMarker) && !JSON.stringify(finalDB.aiLearning).includes(secondMarker));
  check('两次已应用 resultId 被持久记录且无学习 pending', finalDB.aiLearning.appliedResults.includes(UID + '|' + firstTicket.resultId) &&
    finalDB.aiLearning.appliedResults.includes(UID + '|' + secondTicket.resultId) &&
    Array.isArray(finalDB.pendingAILearningSync) && finalDB.pendingAILearningSync.length === 0);

  console.log('AI_LEARNING_ONLINE_ALL_PASS (' + assertionCount + ' assertions)');
}

run().catch(error => {
  console.error('AI_LEARNING_ONLINE_FAILED:', error && error.stack || String(error));
  if (combinedServerOutput) console.error('---- SERVER OUTPUT ----\n' + combinedServerOutput.slice(-4000));
  process.exitCode = 1;
}).finally(async () => {
  for (const client of clients) client.close();
  await stopServer(activeServer);
  if (dataDir){
    try { fs.rmSync(dataDir, { recursive: true, force: true }); }
    catch {}
  }
});
