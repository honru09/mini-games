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
let appOutput = '';
let dataDir = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(name, condition, detail){
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
    coins: 7,
    played: { gomoku: 2 },
    total: 2,
  };

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
      if (req.method === 'POST' && (req.url.startsWith('/rest/v1/profiles?') || req.url === '/rest/v1/history')){
        // PostgREST 在未请求 representation 时可返回 201 且响应体为空。
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end();
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
      SUPABASE_URL: 'http://127.0.0.1:' + fakePort,
      SUPABASE_KEY: TEST_KEY,
      DEEPSEEK_KEY: '',
      ALLOWED_ORIGINS: '',
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
    loggedIn.payload.profile.name === 'Adapter Seed' && loggedIn.payload.profile.coins === 7);

  mark = client.mark();
  client.send({ type: 'profile', payload: { uid: UID, name: 'Synced User', lang: 'uk-UA' } });
  const profileOk = await client.waitAfter(mark, 'profile_ok');
  check('201 空 profile 响应不影响档案更新', profileOk && profileOk.payload &&
    profileOk.payload.name === 'Synced User' && profileOk.payload.lang === 'uk-UA');

  mark = client.mark();
  client.send({
    type: 'result',
    payload: { mode: 'solo', game: 'gomoku', coins: 1, resultId: RESULT_ID },
  });
  const resultOk = await client.waitAfter(mark, 'result_ok');
  check('201 空 history 响应不影响结算', resultOk && resultOk.payload && resultOk.payload.resultId === RESULT_ID);

  const historyPost = await waitUntil(() => requests.find(item =>
    item.method === 'POST' && item.url === '/rest/v1/history' && Array.isArray(item.body) &&
    item.body[0] && item.body[0].result_id === RESULT_ID), 'history 写入');
  const resultProfilePost = await waitUntil(() => requests.find(item =>
    item.method === 'POST' && item.url.startsWith('/rest/v1/profiles?') && item.body &&
    Array.isArray(item.body.recent_results) && item.body.recent_results.includes(RESULT_ID)), '结算后的 profile 同步');

  const requiredProfileFields = [
    'uid', 'pin_hash', 'owned', 'daily_key', 'auth_tokens', 'recent_results',
    'purchase_requests', 'solo_rate', 'coins', 'played', 'total', 'updated_at',
  ];
  check('profile 同步包含本轮关键字段', requiredProfileFields.every(field =>
    Object.prototype.hasOwnProperty.call(resultProfilePost.body, field)),
  '缺少：' + requiredProfileFields.filter(field => !Object.prototype.hasOwnProperty.call(resultProfilePost.body, field)).join(', '));
  check('solo_rate 从远端载入并在结算后同步', Array.isArray(resultProfilePost.body.solo_rate) &&
    resultProfilePost.body.solo_rate.length === 2 && resultProfilePost.body.solo_rate.every(Number.isFinite),
  JSON.stringify(resultProfilePost.body.solo_rate));
  check('PIN 登录后慢哈希迁移被同步', typeof resultProfilePost.body.pin_hash === 'string' &&
    resultProfilePost.body.pin_hash.startsWith('s2$'));
  check('history 同步包含幂等与模式字段', historyPost.body[0].uid === UID &&
    historyPost.body[0].game === 'gomoku' && historyPost.body[0].result_id === RESULT_ID &&
    historyPost.body[0].match_id === null && historyPost.body[0].mode === 'solo');
  check('所有 Supabase 请求只使用测试凭证', requests.every(item =>
    item.headers.apikey === TEST_KEY && item.headers.authorization === 'Bearer ' + TEST_KEY));

  await sleep(100);
  check('201 空响应未被记录为 Supabase 错误',
    !/Supabase (同步档案|写入历史)失败|supabase 201|无效 JSON/.test(appOutput), appOutput.slice(-1000));

  client.close();
  if (failures.length){
    throw new Error(failures.length + ' 项断言失败');
  }
  console.log('SUPABASE_ADAPTER_ALL_PASS (' + 10 + ' assertions)');
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
