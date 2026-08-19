// Real-WebSocket regression for the server-only Engagement Integrity shadow.
// Node 20: node --experimental-websocket qa/engagement-integrity-online.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const WAIT_MS = 10000;
const METRICS_TOKEN = 'engagement-integrity-online-metrics-token-20260816';
const ADMIN = Object.freeze({ uid:'u_engadmin01', username:'EngAdmin01', password:'EngAdminPass9!' });
const IDENTITIES = Object.freeze({
  host:{ uid:'u_enghost01', pin:'EngHost901', name:'Integrity Host' },
  guest:{ uid:'u_engguest01', pin:'EngGuest902', name:'Integrity Guest' },
  spectator:{ uid:'u_engspect01', pin:'EngSpect903', name:'Integrity Spectator' },
});

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-engagement-integrity-'));
const liveServers = new Set();
const liveClients = new Set();
let failures = 0;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(name, condition, detail) {
  if (condition) console.log('PASS  ' + name);
  else {
    failures += 1;
    console.log('FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function metric(payload, name) {
  return Number(payload && payload.data && payload.data[name]) || 0;
}

function reasonOf(message) {
  return String(message && (message.reason || (message.payload && message.payload.reason)) || '');
}

function publicShape(value) {
  const paths = new Set();
  function walk(current, prefix) {
    if (Array.isArray(current)) {
      paths.add(prefix + ':array');
      current.forEach(item => walk(item, prefix + '[]'));
      return;
    }
    if (current && typeof current === 'object') {
      paths.add(prefix + ':object');
      Object.keys(current).sort().forEach(key => walk(current[key], prefix ? prefix + '.' + key : key));
      return;
    }
    paths.add(prefix + ':' + (current === null ? 'null' : typeof current));
  }
  walk(value, '$');
  return [...paths].sort();
}

function stablePublicValue(value) {
  if (Array.isArray(value)) return value.map(stablePublicValue);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (/^(?:matchId|resultId|replayId)$/.test(key) || /(?:At|Until|ExpiresAt)$/.test(key)) {
      out[key] = '<volatile>';
    } else {
      out[key] = stablePublicValue(value[key]);
    }
  }
  return out;
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen({ host:'127.0.0.1', port:0, exclusive:true }, () => {
      const address = probe.address();
      const port = address && typeof address === 'object' ? Number(address.port) : 0;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function httpRequest(port, requestPath, token) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host:'127.0.0.1', port, path:requestPath, method:'GET', timeout:1500,
      headers:token ? { Authorization:'Bearer ' + token } : {},
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch {}
        resolve({ status:response.statusCode, body, parsed });
      });
    });
    request.once('error', reject);
    request.once('timeout', () => request.destroy(new Error('HTTP timeout')));
    request.end();
  });
}

class Client {
  constructor(label, url) {
    this.label = label;
    this.url = url;
    this.messages = [];
    this.sequence = 0;
    this.closed = false;
    this.ws = null;
  }
  async open() {
    this.ws = new WebSocket(this.url);
    liveClients.add(this);
    this.ws.addEventListener('message', event => {
      try { this.messages.push({ sequence:++this.sequence, value:JSON.parse(String(event.data)) }); } catch {}
    });
    this.ws.addEventListener('close', () => { this.closed = true; });
    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(this.label + ' open timeout'));
      }, WAIT_MS);
      this.ws.addEventListener('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      }, { once:true });
      this.ws.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(this.label + ' WebSocket error'));
      }, { once:true });
    });
    return this;
  }
  mark() { return this.sequence; }
  send(type, payload) {
    assert(this.ws && this.ws.readyState === 1, this.label + ' WebSocket is not open');
    this.ws.send(JSON.stringify({ type, payload }));
  }
  async waitAfter(mark, predicate, description, timeout = WAIT_MS) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const entry = this.messages.find(item => item.sequence > mark && predicate(item.value));
      if (entry) return entry.value;
      if (this.closed) throw new Error(this.label + ' closed while waiting for ' + description);
      await sleep(20);
    }
    const tail = this.messages.slice(-10).map(item => item.value && item.value.type);
    throw new Error(this.label + ' timed out waiting for ' + description + '; tail=' + JSON.stringify(tail));
  }
  request(type, payload, predicate, description, timeout) {
    const mark = this.mark();
    this.send(type, payload);
    return this.waitAfter(mark, predicate, description, timeout);
  }
  async close() {
    if (!this.ws) return;
    if (this.ws.readyState === 0 || this.ws.readyState === 1) {
      try { this.ws.close(); } catch {}
    }
    const deadline = Date.now() + 1200;
    while (!this.closed && Date.now() < deadline) await sleep(20);
    liveClients.delete(this);
  }
}

async function startServer(flag, label) {
  const port = await reservePort();
  const dataDir = path.join(tempRoot, label);
  const output = { text:'' };
  const env = {
    ...process.env,
    PORT:String(port),
    DATA_DIR:dataDir,
    NODE_ENV:'test',
    ALLOWED_ORIGINS:'http://127.0.0.1:' + port,
    SUPABASE_URL:'',
    SUPABASE_KEY:'',
    DEEPSEEK_KEY:'',
    ENABLE_CLUSTER_COORDINATION:'0',
    ENABLE_RULE_AUTHORITY_V2:'1',
    ENABLE_TANK_SNAPSHOT_DELTA_V2:'0',
    ENABLE_ENGAGEMENT_INTEGRITY_SHADOW:flag ? '1' : '0',
    TANK_MATCH_DURATION_MS:'10000',
    RECONNECT_GRACE_MS:'1000',
    REWARD_TEST_MIN_DURATION_MS:'0',
    REWARD_TEST_MIN_ACTIONS:'0',
    REWARD_TEST_MIN_UNIQUE_ACTIONS:'0',
    REWARD_TEST_MIN_PLAYER_ACTIONS:'0',
    METRICS_ADMIN_TOKEN:METRICS_TOKEN,
    TEST_ADMIN_ENABLED:'1',
    TEST_ADMIN_UID:ADMIN.uid,
    TEST_ADMIN_USERNAME:ADMIN.username,
    TEST_ADMIN_PASSWORD:ADMIN.password,
  };
  const child = spawn(process.execPath, [SERVER], { cwd:ROOT, env, stdio:['ignore','pipe','pipe'] });
  const instance = { child, port, dataDir, output, flag };
  liveServers.add(instance);
  child.stdout.on('data', chunk => { output.text = (output.text + String(chunk)).slice(-30000); });
  child.stderr.on('data', chunk => { output.text = (output.text + String(chunk)).slice(-30000); });
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(label + ' server exited before readiness\n' + output.text.slice(-3000));
    }
    try {
      const response = await httpRequest(port, '/', '');
      if (response.status === 200) return instance;
    } catch {}
    await sleep(50);
  }
  throw new Error(label + ' server readiness timeout\n' + output.text.slice(-3000));
}

async function stopServer(instance) {
  if (!instance) return;
  const child = instance.child;
  if (child && child.exitCode === null && child.signalCode === null) {
    await new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        try { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); } catch {}
        finish();
      }, 3000);
      child.once('exit', finish);
      try { child.kill(); } catch { finish(); }
    });
  }
  liveServers.delete(instance);
}

async function metrics(instance) {
  const response = await httpRequest(instance.port, '/api/metrics', METRICS_TOKEN);
  assert.strictEqual(response.status, 200, response.body);
  assert(response.parsed && response.parsed.version === 'metrics-v2', response.body);
  return response.parsed;
}

async function registerLegacy(client, identity) {
  const registered = await client.request('register', {
    uid:identity.uid, pin:identity.pin, name:identity.name, lang:'en-US',
  }, message => message.type === 'registered', identity.name + ' registration');
  const token = String(registered.token || (registered.payload && registered.payload.token) || '');
  const uid = String(registered.payload && registered.payload.uid || '');
  assert.strictEqual(uid, identity.uid, JSON.stringify(registered));
  assert(token, identity.name + ' token missing');
  const hello = await client.request('hello', {
    uid, token, proto:2, capabilities:['tank-authority-v1'],
  }, message => message.type === 'hello_ack', identity.name + ' hello');
  assert.strictEqual(hello.authenticated, true, JSON.stringify(hello));
  client.uid = uid;
  client.token = token;
  return hello;
}

async function loginAdmin(instance) {
  const client = await new Client('test-admin', 'ws://127.0.0.1:' + instance.port + '/ws').open();
  const loggedIn = await client.request('login', {
    authVersion:2, username:ADMIN.username, password:ADMIN.password,
  }, message => message.type === 'logged_in' || message.type === 'auth_error', 'test-admin login');
  assert.strictEqual(loggedIn.type, 'logged_in', JSON.stringify(loggedIn));
  const token = String(loggedIn.token || (loggedIn.payload && loggedIn.payload.token) || '');
  const hello = await client.request('hello', {
    uid:ADMIN.uid, token, proto:2, capabilities:['tank-authority-v1'],
  }, message => message.type === 'hello_ack', 'test-admin hello');
  assert.strictEqual(hello.authenticated, true, JSON.stringify(hello));
  return client;
}

async function selectTankAndStart(host, guest) {
  const selectMark = host.mark();
  host.send('select_game', { game:'tank' });
  await host.waitAfter(selectMark, message => message.type === 'room_update' && message.payload && message.payload.game === 'tank', 'Tank selection');
  if (guest) {
    const readyMark = host.mark();
    guest.send('ready', { ready:true });
    await host.waitAfter(readyMark, message => message.type === 'room_update' && message.payload && message.payload.canStart === true, 'guest ready');
  }
  const hostMark = host.mark();
  const guestMark = guest && guest.mark();
  host.send('start', {});
  const startedHost = await host.waitAfter(hostMark, message => message.type === 'started' && message.game === 'tank', 'host Tank start');
  const startedGuest = guest && await guest.waitAfter(guestMark, message => message.type === 'started' && message.game === 'tank', 'guest Tank start');
  if (startedGuest) assert.strictEqual(startedGuest.matchId, startedHost.matchId);
  return startedHost;
}

async function runRegularScenario(flag) {
  const instance = await startServer(flag, flag ? 'shadow-on' : 'shadow-off');
  const url = 'ws://127.0.0.1:' + instance.port + '/ws';
  const host = await new Client((flag ? 'on' : 'off') + '-host', url).open();
  const guest = await new Client((flag ? 'on' : 'off') + '-guest', url).open();
  const spectator = await new Client((flag ? 'on' : 'off') + '-spectator', url).open();
  try {
    const helloHost = await registerLegacy(host, IDENTITIES.host);
    await registerLegacy(guest, IDENTITIES.guest);
    await registerLegacy(spectator, IDENTITIES.spectator);
    const created = await host.request('create', {
      capacity:2, visibility:'private', allowSpectators:true,
    }, message => message.type === 'created', 'room creation');
    const room = String(created.room || '');
    assert(room, JSON.stringify(created));
    await guest.request('join', { room }, message => message.type === 'joined', 'room join');
    const started = await selectTankAndStart(host, guest);
    const matchId = String(started.matchId || '');
    assert(matchId, JSON.stringify(started));
    await spectator.request('spectate', { room }, message => message.type === 'spectating', 'spectator join');

    const during = await metrics(instance);
    check((flag ? 'flag 1' : 'flag 0') + ' is reflected only in numeric admin metrics',
      metric(during, 'engagementIntegrityShadowEnabled') === (flag ? 1 : 0));
    check((flag ? 'flag 1 creates one human cohort analyzer' : 'flag 0 creates no analyzer'),
      metric(during, 'engagementIntegrityActiveAnalyzers') === (flag ? 1 : 0), JSON.stringify(during.data));

    const acceptedMark = host.mark();
    host.send('tank_input', { matchId, seq:1, clientTick:0, input:{ right:true } });
    const acceptedSnapshot = await host.waitAfter(acceptedMark,
      message => message.type === 'tank_snapshot' && message.payload && Array.isArray(message.payload.ack) && message.payload.ack[0] >= 1,
      'accepted Tank input snapshot');

    const duplicate = await host.request('tank_input', {
      matchId, seq:1, clientTick:0, input:{ left:true },
    }, message => message.type === 'gameplay_error' && reasonOf(message) === 'stale_seq', 'duplicate Tank input');
    const invalidTick = await host.request('tank_input', {
      matchId, seq:2, clientTick:999999, input:{ up:true },
    }, message => message.type === 'gameplay_error' && reasonOf(message) === 'invalid_tick', 'invalid Tank tick');
    const invalidMatch = await guest.request('tank_input', {
      matchId:'wrong-match', seq:1, clientTick:0, input:{ left:true },
    }, message => message.type === 'gameplay_error' && reasonOf(message) === 'invalid_match', 'invalid Tank match');
    const guestAcceptedMark = guest.mark();
    guest.send('tank_input', { matchId, seq:1, clientTick:0, input:{ left:true } });
    await guest.waitAfter(guestAcceptedMark,
      message => message.type === 'tank_snapshot' && message.payload && Array.isArray(message.payload.ack) && message.payload.ack[1] >= 1,
      'guest accepted Tank input');
    const spectatorRejected = await spectator.request('tank_input', {
      matchId, seq:1, clientTick:0, input:{ fire:true },
    }, message => message.type === 'spectator_error', 'spectator Tank mutation rejection');

    const rateMark = host.mark();
    const burstLastSeq = 81;
    for (let seq = 2; seq <= burstLastSeq; seq += 1) {
      host.send('tank_input', {
        matchId, seq, clientTick:0,
        input:{ up:seq % 2 === 0, right:seq % 2 === 1, fire:seq % 7 === 0 },
      });
    }
    // A same-socket sentinel proves the whole burst was consumed before metrics
    // are sampled. Under a loaded full gate the 1s Authority window may slide,
    // so the accepted total is intentionally observed instead of hard-coded.
    host.send('tank_input', {
      matchId:'wrong-after-rate-burst', seq:burstLastSeq + 1, clientTick:0,
      input:{ left:true },
    });
    const rateLimited = await host.waitAfter(rateMark,
      message => message.type === 'gameplay_error' && reasonOf(message) === 'rate_limited',
      'Tank authority rate limit');
    await host.waitAfter(rateMark,
      message => message.type === 'gameplay_error' && reasonOf(message) === 'invalid_match',
      'post-rate Tank burst sentinel');

    const beforeSettlement = await metrics(instance);
    const acceptedInputCount = metric(beforeSettlement, 'tankInputs');
    check((flag ? 'shadow counts only accepted Tank Authority inputs' : 'default-off records no shadow inputs'),
      metric(beforeSettlement, 'engagementIntegrityHumanAccepted') === (flag ? acceptedInputCount : 0), JSON.stringify(beforeSettlement.data));
    check('duplicate, invalid match/tick, rate-limit and spectator paths do not inflate normal Tank input count',
      acceptedInputCount >= 41 && acceptedInputCount < burstLastSeq + 1, JSON.stringify(beforeSettlement.data));

    const hostResultMark = host.mark();
    const guestResultMark = guest.mark();
    host.send('end_game', {});
    const [hostResult, guestResult, matchResult] = await Promise.all([
      host.waitAfter(hostResultMark, message => message.type === 'result_ok' && message.payload && message.payload.reward, 'host result'),
      guest.waitAfter(guestResultMark, message => message.type === 'result_ok' && message.payload && message.payload.reward, 'guest result'),
      guest.waitAfter(guestResultMark, message => message.type === 'match_result', 'public match result'),
    ]);
    const afterSettlement = await metrics(instance);
    check((flag ? 'settlement finalizes then disposes the human audit' : 'default-off settlement has no audit lifecycle'),
      metric(afterSettlement, 'engagementIntegrityActiveAnalyzers') === 0 &&
        metric(afterSettlement, 'engagementIntegrityFinalizedMatches') === (flag ? 1 : 0), JSON.stringify(afterSettlement.data));
    check('shadow audit does not change Tank forfeit rewards',
      hostResult.payload.reward.result === 'loss' && guestResult.payload.reward.result === 'win' &&
        hostResult.payload.reward.currency === 1 && guestResult.payload.reward.currency === 5,
      JSON.stringify({ host:hostResult.payload.reward, guest:guestResult.payload.reward }));

    return {
      instance, host, guest, spectator, room, helloHost, started, acceptedSnapshot,
      duplicate, invalidTick, invalidMatch, spectatorRejected, rateLimited,
      hostResult, guestResult, matchResult, afterSettlement,
    };
  } catch (error) {
    error.serverOutput = instance.output.text;
    throw error;
  }
}

async function exerciseMixedCohorts(result) {
  const { instance, host, guest, spectator } = result;
  const regularHumanAccepted = metric(result.afterSettlement, 'engagementIntegrityHumanAccepted');
  spectator.send('leave', {});
  guest.send('leave', {});
  await sleep(120);
  const selectMark = host.mark();
  host.send('select_game', { game:'tank' });
  await host.waitAfter(selectMark, message => message.type === 'room_update' && message.payload && message.payload.game === 'tank', 'mixed Tank selection');
  const aiMark = host.mark();
  host.send('add_ai', { difficulty:'normal', persona:'teacher' });
  await host.waitAfter(aiMark, message => message.type === 'room_update' && message.payload && Array.isArray(message.payload.seats) && message.payload.seats.some(seat => seat.type === 'ai'), 'AI seat');
  const startMark = host.mark();
  host.send('start', {});
  const started = await host.waitAfter(startMark, message => message.type === 'started' && message.game === 'tank', 'mixed Tank start');
  const matchId = String(started.matchId || '');
  const active = await metrics(instance);
  check('mixed Tank match creates separately bounded human and AI analyzers',
    metric(active, 'engagementIntegrityActiveAnalyzers') === 2, JSON.stringify(active.data));
  const inputMark = host.mark();
  host.send('tank_input', { matchId, seq:1, clientTick:0, input:{ down:true } });
  host.send('bot_tank_input', { matchId, seatId:1, seq:1, clientTick:0, input:{ up:true, fire:true } });
  await host.waitAfter(inputMark, message => message.type === 'tank_snapshot' && message.payload &&
    Array.isArray(message.payload.ack) && message.payload.ack[0] >= 1 && message.payload.ack[1] >= 1, 'mixed cohort inputs');
  const resultMark = host.mark();
  host.send('end_game', {});
  await host.waitAfter(resultMark, message => message.type === 'result_ok', 'mixed result');
  const finalized = await metrics(instance);
  const expectedHumanAccepted = regularHumanAccepted + 1;
  check('human and AI accepted counts stay in separate cohorts',
    metric(finalized, 'engagementIntegrityHumanAccepted') === expectedHumanAccepted &&
      metric(finalized, 'engagementIntegrityAiAccepted') === 1 &&
      metric(finalized, 'engagementIntegrityHumanFinalizedAccepted') === expectedHumanAccepted &&
      metric(finalized, 'engagementIntegrityAiFinalizedAccepted') === 1,
    JSON.stringify(finalized.data));
  check('mixed settlement disposes both bounded analyzers',
    metric(finalized, 'engagementIntegrityActiveAnalyzers') === 0 &&
      metric(finalized, 'engagementIntegrityFinalizedMatches') === 2,
    JSON.stringify(finalized.data));
  return finalized;
}

async function exerciseTestAdminExclusion(result, baseline) {
  const { instance } = result;
  const admin = await loginAdmin(instance);
  try {
    const created = await admin.request('create', { capacity:2, visibility:'public', allowSpectators:true }, message => message.type === 'created', 'admin room');
    const room = String(created.room || '');
    const selectedMark = admin.mark();
    admin.send('select_game', { game:'tank' });
    await admin.waitAfter(selectedMark, message => message.type === 'room_update' && message.payload && message.payload.game === 'tank', 'admin Tank selection');
    const aiMark = admin.mark();
    admin.send('add_ai', { difficulty:'normal', persona:'teacher' });
    await admin.waitAfter(aiMark, message => message.type === 'room_update' && message.payload && Array.isArray(message.payload.seats) && message.payload.seats.some(seat => seat.type === 'ai'), 'admin AI seat');
    const startMark = admin.mark();
    admin.send('start', {});
    const started = await admin.waitAfter(startMark, message => message.type === 'started' && message.game === 'tank', 'admin Tank start');
    assert(room && started.matchId);
    const active = await metrics(instance);
    check('Test Admin sandbox creates no engagement analyzer', metric(active, 'engagementIntegrityActiveAnalyzers') === 0, JSON.stringify(active.data));
    const inputMark = admin.mark();
    admin.send('tank_input', { matchId:started.matchId, seq:1, clientTick:0, input:{ right:true } });
    admin.send('bot_tank_input', { matchId:started.matchId, seatId:1, seq:1, clientTick:0, input:{ left:true } });
    await admin.waitAfter(inputMark, message => message.type === 'tank_snapshot' && message.payload && Array.isArray(message.payload.ack) && message.payload.ack[0] >= 1 && message.payload.ack[1] >= 1, 'admin accepted inputs');
    const observed = await metrics(instance);
    check('accepted Test Admin human/AI inputs are excluded from both cohorts',
      metric(observed, 'engagementIntegrityHumanAccepted') === metric(baseline, 'engagementIntegrityHumanAccepted') &&
        metric(observed, 'engagementIntegrityAiAccepted') === metric(baseline, 'engagementIntegrityAiAccepted') &&
        metric(observed, 'engagementIntegrityExcludedTestAdmin') === 2,
      JSON.stringify(observed.data));
    const endMark = admin.mark();
    admin.send('end_game', {});
    const sandboxResult = await admin.waitAfter(endMark, message => message.type === 'result_ok', 'admin sandbox result');
    check('Test Admin exclusion leaves its existing virtual reward response intact',
      sandboxResult.payload && sandboxResult.payload.reward && sandboxResult.payload.reward.blockedReason === 'test_admin_sandbox' && sandboxResult.payload.virtual === true,
      JSON.stringify(sandboxResult));
    const finalMetrics = await metrics(instance);
    check('Test Admin settlement does not finalize a shadow audit',
      metric(finalMetrics, 'engagementIntegrityFinalizedMatches') === metric(baseline, 'engagementIntegrityFinalizedMatches') &&
        metric(finalMetrics, 'engagementIntegrityActiveAnalyzers') === 0,
      JSON.stringify(finalMetrics.data));
  } finally {
    await admin.close();
  }
}

function comparePublicContracts(off, on) {
  const pairs = [
    ['hello', off.helloHost, on.helloHost],
    ['started', off.started, on.started],
    ['accepted tank snapshot', off.acceptedSnapshot, on.acceptedSnapshot],
    ['duplicate rejection', off.duplicate, on.duplicate],
    ['invalid tick rejection', off.invalidTick, on.invalidTick],
    ['invalid match rejection', off.invalidMatch, on.invalidMatch],
    ['spectator rejection', off.spectatorRejected, on.spectatorRejected],
    ['rate-limit rejection', off.rateLimited, on.rateLimited],
    ['host result/reward', off.hostResult, on.hostResult],
    ['guest result/reward', off.guestResult, on.guestResult],
    ['match result', off.matchResult, on.matchResult],
  ];
  for (const [label, left, right] of pairs) {
    check('flag 0/1 preserve public ' + label + ' field shape',
      JSON.stringify(publicShape(left)) === JSON.stringify(publicShape(right)),
      JSON.stringify({ off:publicShape(left), on:publicShape(right) }));
  }
  check('flag 0/1 advertise identical capabilities',
    JSON.stringify((off.helloHost.capabilities || []).slice().sort()) === JSON.stringify((on.helloHost.capabilities || []).slice().sort()));
  for (const [label, left, right] of [
    ['duplicate rejection', off.duplicate, on.duplicate],
    ['invalid tick rejection', off.invalidTick, on.invalidTick],
    ['invalid match rejection', off.invalidMatch, on.invalidMatch],
    ['spectator rejection', off.spectatorRejected, on.spectatorRejected],
    ['rate-limit rejection', off.rateLimited, on.rateLimited],
    ['host result/reward', off.hostResult, on.hostResult],
    ['guest result/reward', off.guestResult, on.guestResult],
    ['match result', off.matchResult, on.matchResult],
  ]) {
    check('flag 0/1 preserve public ' + label + ' values',
      JSON.stringify(stablePublicValue(left)) === JSON.stringify(stablePublicValue(right)),
      JSON.stringify({ off:stablePublicValue(left), on:stablePublicValue(right) }));
  }
}

async function cleanup() {
  await Promise.all([...liveClients].map(client => client.close().catch(() => {})));
  for (const instance of [...liveServers]) await stopServer(instance);
  try { fs.rmSync(tempRoot, { recursive:true, force:true, maxRetries:5, retryDelay:50 }); }
  catch (error) {
    failures += 1;
    console.error('ENGAGEMENT_INTEGRITY_ONLINE_CLEANUP_ERROR', error && error.message || error);
  }
  if (fs.existsSync(tempRoot)) {
    failures += 1;
    console.error('ENGAGEMENT_INTEGRITY_ONLINE_DATA_DIR_REMAINS', tempRoot);
  }
}

async function main() {
  if (typeof WebSocket !== 'function') throw new Error('Node 20 requires --experimental-websocket');
  const off = await runRegularScenario(false);
  await Promise.all([off.host.close(), off.guest.close(), off.spectator.close()]);
  await stopServer(off.instance);
  const on = await runRegularScenario(true);
  comparePublicContracts(off, on);
  const mixedMetrics = await exerciseMixedCohorts(on);
  await exerciseTestAdminExclusion(on, mixedMetrics);
  check('shadow analyzer reported no integration errors', metric(await metrics(on.instance), 'engagementIntegrityErrors') === 0);
}

main().catch(error => {
  failures += 1;
  console.error('ENGAGEMENT_INTEGRITY_ONLINE_CRASH', error && error.stack || error);
  if (error && error.serverOutput) console.error(String(error.serverOutput).slice(-5000));
}).finally(async () => {
  await cleanup();
  console.log(failures ? 'ENGAGEMENT_INTEGRITY_ONLINE_HAS_FAILURES' : 'ENGAGEMENT_INTEGRITY_ONLINE_ALL_PASS');
  process.exitCode = failures ? 1 : 0;
});
