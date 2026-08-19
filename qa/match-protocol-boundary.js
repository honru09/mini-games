#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'server', 'boundaries', 'match-protocol.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const SERVER_SOURCE = fs.readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
const { PROTOCOL_VERSIONS } = require('../server/gameplay/protocol');
const {
  createMatchProtocolBoundary,
  createJsonRuntimeMatchProtocolAdapter,
  createRuntimeMatchProtocolAdapter,
  createMemoryMatchProtocolAdapter,
} = require(MODULE_PATH);

let assertions = 0;
let failures = 0;

function check(label, run) {
  assertions += 1;
  try {
    run();
    console.log('PASS  ' + label);
  } catch (error) {
    failures += 1;
    console.error('FAIL  ' + label + ' :: ' + (error && error.message || error));
  }
}

function fixture() {
  const trace = [];
  const adapter = createMemoryMatchProtocolAdapter({ onEffect: effect => trace.push(effect) });
  const boundary = createMatchProtocolBoundary({ adapter, now: () => 1700000000123 });
  const session = { uid:'u-player', player:1 };
  const room = { id:'ROOM01', game:null, matchId:'match-01', gameplayResultSent:false };
  return { trace, adapter, boundary, session, room };
}

function effectKinds(trace) { return trace.map(effect => effect.kind + (effect.name ? ':' + effect.name : '')); }

check('module exports one deep boundary constructor and replaceable runtime/memory Adapters', () => {
  assert.deepStrictEqual(Object.keys(require(MODULE_PATH)).sort(), [
    'createMatchProtocolBoundary', 'createMemoryMatchProtocolAdapter', 'createRuntimeMatchProtocolAdapter',
  ].sort());
  const memory = createMemoryMatchProtocolAdapter();
  const runtime = createRuntimeMatchProtocolAdapter({
    send() {}, broadcast() {}, incrementMetric() {}, recordAction() {}, settle() {}, stop() {},
  });
  assert.deepStrictEqual(Object.keys(memory).sort(), ['commit','load','save'].sort());
  assert.deepStrictEqual(Object.keys(runtime).sort(), ['commit','load','save'].sort());
  const json = createJsonRuntimeMatchProtocolAdapter({
    read:() => ({ journal:[] }), write:() => {},
    send() {}, broadcast() {}, incrementMetric() {}, recordAction() {}, settle() {}, stop() {},
  });
  assert.deepStrictEqual(Object.keys(json).sort(), ['commit','load','save'].sort());
  assert(Object.isFrozen(memory) && Object.isFrozen(runtime));
  assert.deepStrictEqual(Object.keys(createMatchProtocolBoundary({ adapter:memory, now:() => 1 })).sort(), ['command','transition'].sort());
});

check('unknown message is not handled and produces no effects', () => {
  const runtime = fixture();
  const outcome = runtime.boundary.command({ type:'move', room:runtime.room, session:runtime.session, payload:{} });
  assert.deepStrictEqual(outcome, { handled:false });
  assert.deepStrictEqual(runtime.trace, []);
  assert(Object.isFrozen(outcome));
});

check('Tetris missing Authority and wrong match return stable gameplay_error effects', () => {
  const runtime = fixture();
  runtime.room.game = 'tetris';
  const missing = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload:{ matchId:'match-01', seq:1, action:{ type:'move_left' } } });
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.reason, 'ERR_PROTOCOL_VERSION');
  assert.deepStrictEqual(effectKinds(runtime.trace), ['metric:protocolErrors','send']);
  assert.strictEqual(runtime.trace[1].message.type, 'gameplay_error');
  assert.strictEqual(runtime.trace[1].message.payload.protocol, PROTOCOL_VERSIONS.tetrisRules);
  assert.strictEqual(runtime.trace[1].message.payload.code, 'ERR_PROTOCOL_VERSION');

  runtime.trace.length = 0;
  runtime.room.tetrisRuleAuthority = { acceptAction(){ throw new Error('must not run'); } };
  const wrong = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload:{ matchId:'other-match', seq:1, action:{ type:'move_left' } } });
  assert.strictEqual(wrong.reason, 'invalid_match');
  assert.deepStrictEqual(effectKinds(runtime.trace), ['metric:protocolErrors','send']);
  assert.strictEqual(runtime.trace[1].message.payload.code, 'ERR_INVALID_STATE');
  assert.strictEqual(runtime.trace[1].message.payload.reason, 'invalid_match');
});

check('Tetris accepted action commits metrics, audit, battle/state and terminal once', () => {
  const runtime = fixture();
  runtime.room.game = 'tetris';
  let received = null;
  runtime.room.tetrisRuleAuthority = {
    revision:7,
    acceptAction(player,payload,now){
      received = { player, payload, now };
      return {
        ok:true,
        battle:{ target:0, lines:2 },
        stateEvent:{ type:'tetris_rule_state', payload:{ matchId:'match-01', revision:7 } },
        result:{ type:'tetris_rule_result', order:[1,0], payload:{ matchId:'match-01' } },
      };
    },
  };
  const payload = { matchId:'match-01', seq:4, action:{ type:'hard_drop' } };
  const outcome = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload });
  assert.deepStrictEqual(received, { player:1, payload, now:1700000000123 });
  assert.strictEqual(outcome.ok, true);
  assert.strictEqual(outcome.terminal, true);
  assert.strictEqual(runtime.room.gameplayResultSent, true);
  assert.deepStrictEqual(effectKinds(runtime.trace), [
    'metric:tetrisInputs','metric:garbageEvents','record','broadcast','broadcast','terminal',
  ]);
  assert.deepStrictEqual(runtime.trace[2].action, { protocol:PROTOCOL_VERSIONS.tetrisRules, action:{ type:'hard_drop' } });
  assert.deepStrictEqual(runtime.trace[3].message, { type:'tetris_rule_battle', payload:{ matchId:'match-01', revision:7, target:0, lines:2 } });
  assert.strictEqual(runtime.trace[5].cause, 'tetris_rule_authority');

  runtime.trace.length = 0;
  runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload:{...payload,seq:5} });
  assert(!runtime.trace.some(effect => effect.kind === 'terminal'));
});

check('rejected Tetris action maps Authority reason without leaking internals', () => {
  const runtime = fixture();
  runtime.room.tetrisRuleAuthority = { acceptAction(){ return { ok:false, reason:'ERR_INVALID_MOVE', secret:'do-not-leak' }; } };
  const outcome = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload:{ matchId:'match-01' } });
  assert.strictEqual(outcome.reason, 'ERR_INVALID_MOVE');
  assert.deepStrictEqual(effectKinds(runtime.trace), ['metric:invalidTetrisActions','metric:protocolErrors','send']);
  assert(!JSON.stringify(runtime.trace).includes('do-not-leak'));
});

check('Xiangqi timeout remains a rejected action with authoritative terminal effects', () => {
  const runtime = fixture();
  const timeout = { type:'xiangqi_rule_result', payload:{ winner:0, loser:1 } };
  runtime.room.xiangqiRuleAuthority = { acceptMove(){ return { ok:false, reason:'ERR_DEADLINE', timeout }; } };
  const outcome = runtime.boundary.command({ type:'xiangqi_action', room:runtime.room, session:runtime.session, payload:{ matchId:'match-01', seq:3, from:[0,0], to:[1,0] } });
  assert.strictEqual(outcome.ok, false);
  assert.strictEqual(outcome.terminal, true);
  assert.strictEqual(runtime.room.gameplayResultSent, true);
  assert.deepStrictEqual(effectKinds(runtime.trace), [
    'metric:invalidXiangqiMoves','metric:protocolErrors','metric:clockTimeouts','terminal',
  ]);
  assert.deepStrictEqual(runtime.trace[3].order, [0,1]);
  assert.strictEqual(runtime.trace[3].cause, 'xiangqi_rule_timeout');
});

check('late Xiangqi timeout callback does not re-broadcast an existing terminal', () => {
  const runtime = fixture();
  runtime.room.gameplayResultSent = true;
  runtime.room.xiangqiRuleAuthority = { acceptMove(){ return {
    ok:false, reason:'ERR_DEADLINE', timeout:{ type:'xiangqi_rule_result', payload:{ winner:0, loser:1 } },
  }; } };
  const outcome = runtime.boundary.command({ type:'xiangqi_action', room:runtime.room, session:runtime.session, payload:{ matchId:'match-01', seq:3 } });
  assert.strictEqual(outcome.ok, false);
  assert(!runtime.trace.some(item => item.kind === 'terminal'));
  assert.strictEqual(runtime.room.gameplayResultSent, true);
});

check('Xiangqi accepted move preserves audit/event and result ordering', () => {
  const runtime = fixture();
  runtime.room.xiangqiRuleAuthority = { acceptMove(){ return {
    ok:true,
    event:{ type:'xiangqi_rule_state', payload:{ revision:2 } },
    result:{ type:'xiangqi_rule_result', order:[0,1], payload:{} },
  }; } };
  const payload = { matchId:'match-01', seq:2, from:[9,0], to:[8,0] };
  const outcome = runtime.boundary.command({ type:'xiangqi_action', room:runtime.room, session:{player:0}, payload });
  assert.strictEqual(outcome.ok, true);
  assert.deepStrictEqual(effectKinds(runtime.trace), ['metric:xiangqiMoves','record','broadcast','terminal']);
  assert.deepStrictEqual(runtime.trace[1].action, { protocol:PROTOCOL_VERSIONS.xiangqiRules, from:[9,0], to:[8,0] });
  assert.strictEqual(runtime.trace[3].cause, 'xiangqi_rule_authority');
});

check('Monopoly pass updates authoritative turn before audit/event and keeps auction metric', () => {
  const runtime = fixture();
  runtime.room.monopolyTurn = 0;
  runtime.room.monopolyRuleAuthority = {
    state:{ current:2 },
    acceptAction(){ return { ok:true, event:{ type:'monopoly_rule_state', payload:{ current:2 } } }; },
  };
  const payload = { matchId:'match-01', seq:6, action:{ type:'pass' } };
  const outcome = runtime.boundary.command({ type:'monopoly_action', room:runtime.room, session:{player:1}, payload });
  assert.strictEqual(outcome.ok, true);
  assert.strictEqual(runtime.room.monopolyTurn, 2);
  assert.deepStrictEqual(effectKinds(runtime.trace), [
    'metric:monopolyActions','metric:auctionCount','turn','record','broadcast',
  ]);
  assert.deepStrictEqual(runtime.trace[3].action, { protocol:PROTOCOL_VERSIONS.monopolyRules, action:{ type:'pass' } });
});

check('Authority and Adapter exceptions fail closed with categorical results', () => {
  const authorityRuntime = fixture();
  authorityRuntime.room.tetrisRuleAuthority = { acceptAction(){ throw new Error('Bearer secret-authority'); } };
  const authorityFailure = authorityRuntime.boundary.command({ type:'tetris_action', room:authorityRuntime.room, session:authorityRuntime.session, payload:{ matchId:'match-01' } });
  assert.strictEqual(authorityFailure.reason, 'match_protocol_unavailable');
  assert(!JSON.stringify(authorityFailure).includes('secret-authority'));
  assert.deepStrictEqual(effectKinds(authorityRuntime.trace), ['metric:protocolErrors','send']);

  const failingAdapter = Object.freeze({ commit(){ throw new Error('Bearer secret-adapter'); } });
  const boundary = createMatchProtocolBoundary({ adapter:failingAdapter, now:() => 1 });
  const adapterFailure = boundary.command({ type:'tetris_action', room:{matchId:'m',tetrisRuleAuthority:{acceptAction(){return{ok:true,stateEvent:{type:'state'}};}}}, session:{player:0}, payload:{matchId:'m'} });
  assert.strictEqual(adapterFailure.reason, 'match_protocol_unavailable');
  assert(!JSON.stringify(adapterFailure).includes('secret-adapter'));
});

check('Adapter effect failure rolls back Authority state before a retry', () => {
  const authority = {
    matchId:'match-01',
    lastSeq:[0, 0],
    revision:0,
    state:{ pieces:0 },
    acceptAction(player, payload){
      this.lastSeq[player] = payload.seq;
      this.revision += 1;
      this.state.pieces += 1;
      return { ok:true, stateEvent:{ type:'tetris_rule_state', payload:{ matchId:'match-01', revision:this.revision } } };
    },
  };
  const adapter = createRuntimeMatchProtocolAdapter({
    send() {},
    broadcast(){ throw new Error('effect transport failed'); },
    incrementMetric() {},
    recordAction() {},
    settle() {},
    stop() {},
  });
  const boundary = createMatchProtocolBoundary({ adapter, now:() => 1 });
  const session = { player:0 };
  const room = { matchId:'match-01', started:true, clients:new Map([[session, 0]]), gameplayResultSent:false, tetrisRuleAuthority:authority };
  const failed = boundary.command({ type:'tetris_action', room, session, payload:{ matchId:'match-01', seq:1, action:{ type:'hard_drop' } } });
  assert.strictEqual(failed.reason, 'match_protocol_unavailable');
  assert.deepStrictEqual(authority.lastSeq, [0, 0]);
  assert.strictEqual(authority.revision, 0);
  assert.strictEqual(authority.state.pieces, 0);
});

check('runtime Adapter applies the fixed effect vocabulary in order', () => {
  const calls = [];
  const session = { id:'session' };
  const room = { gameplayResultSent:false, monopolyTurn:0 };
  const adapter = createRuntimeMatchProtocolAdapter({
    send(target,message){ calls.push(['send',target,message]); },
    broadcast(target,message){ calls.push(['broadcast',target,message]); },
    incrementMetric(name){ calls.push(['metric',name]); },
    recordAction(target,player,action){ calls.push(['record',target,player,action]); },
    settle(target,order,cause){ calls.push(['settle',target,order,cause]); },
    stop(target){ calls.push(['stop',target]); },
  });
  const result = adapter.commit({ room, session, effects:[
    {kind:'metric',name:'protocolErrors'},
    {kind:'send',message:{type:'gameplay_error'}},
    {kind:'turn',value:2},
    {kind:'record',player:1,action:{type:'pass'}},
    {kind:'broadcast',message:{type:'state'}},
    {kind:'terminal',message:{type:'result'},order:[1,0],cause:'test_authority'},
  ] });
  assert.deepStrictEqual(result, {ok:true,applied:6});
  assert.strictEqual(room.monopolyTurn, 2);
  assert.strictEqual(room.gameplayResultSent, true);
  assert.deepStrictEqual(calls.map(call => call[0]), ['metric','send','record','broadcast','broadcast','settle','stop']);
});

check('Adapters expose detached load/save state and JSON callbacks', () => {
  const initial = { journal:[{ at:1, effects:[{ kind:'metric', name:'x' }] }] };
  const memory = createMemoryMatchProtocolAdapter({ initialState:initial });
  initial.journal[0].at = 99;
  const loaded = memory.load();
  assert.strictEqual(loaded.journal[0].at, 1);
  loaded.journal[0].at = 88;
  assert.strictEqual(memory.load().journal[0].at, 1);
  memory.save({ journal:[{ at:2, effects:[] }] });
  assert.strictEqual(memory.load().journal[0].at, 2);
  let jsonState = { journal:[] };
  const json = createJsonRuntimeMatchProtocolAdapter({
    read:() => jsonState, write:next => { jsonState = next; },
    send() {}, broadcast() {}, incrementMetric() {}, recordAction() {}, settle() {}, stop() {},
  });
  const next = { journal:[{ at:3, effects:[] }] };
  json.save(next); next.journal[0].at = 44;
  assert.strictEqual(json.load().journal[0].at, 3);
});

check('generation/match fences reject stale callbacks before Authority invocation', () => {
  const runtime = fixture();
  runtime.room.started = true;
  runtime.room.matchGeneration = 4;
  let calls = 0;
  runtime.room.tetrisRuleAuthority = {
    matchId:'match-01', lastSeq:[0,0],
    acceptAction(){ calls += 1; return { ok:true, stateEvent:{type:'tetris_rule_state',payload:{matchId:'match-01',revision:1}} }; },
  };
  const first = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload:{matchId:'match-01',generation:4,seq:1,action:{type:'hard_drop'}} });
  assert.strictEqual(first.ok, true);
  runtime.trace.length = 0;
  const stale = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload:{matchId:'match-01',generation:3,seq:2,action:{type:'hard_drop'}} });
  assert.strictEqual(stale.reason, 'stale_generation');
  assert.strictEqual(calls, 1);
  assert.strictEqual(runtime.trace[1].message.payload.code, 'ERR_INVALID_STATE');
  assert.strictEqual(runtime.trace[1].message.payload.reason, 'stale_generation');
  runtime.trace.length = 0;
  runtime.room.matchId = 'match-02';
  const staleMatch = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload:{matchId:'match-01',generation:4,seq:2,action:{type:'hard_drop'}} });
  assert.strictEqual(staleMatch.reason, 'invalid_match');
  assert.strictEqual(calls, 1);
});

check('sequence fence rejects duplicates before Authority and permits corrected rejected retries', () => {
  const runtime = fixture();
  runtime.room.tetrisRuleAuthority = { matchId:'match-01', lastSeq:[0,1], acceptAction(){ throw new Error('must not run'); } };
  const duplicate = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload:{matchId:'match-01',seq:1,action:{type:'hard_drop'}} });
  assert.strictEqual(duplicate.reason, 'ERR_DUPLICATE_ACTION');
  let acceptedCalls = 0;
  let reject = true;
  runtime.room.tetrisRuleAuthority = {
    matchId:'match-01', lastSeq:[0,0],
    acceptAction(){ acceptedCalls += 1; if (reject) return {ok:false,reason:'ERR_INVALID_MOVE'}; return {ok:true,stateEvent:{type:'tetris_rule_state',payload:{matchId:'match-01',revision:1}}}; },
  };
  const rejected = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:{player:0}, payload:{matchId:'match-01',seq:1,action:{type:'bad'}} });
  assert.strictEqual(rejected.reason, 'ERR_INVALID_MOVE');
  reject = false;
  const retry = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:{player:0}, payload:{matchId:'match-01',seq:1,action:{type:'hard_drop'}} });
  assert.strictEqual(retry.ok, true);
  assert.strictEqual(acceptedCalls, 2);
});

check('transition pipeline preserves per-game ordering and terminal idempotency', () => {
  const tetris = fixture();
  tetris.room.started = true;
  let transitionCalls = 0;
  tetris.room.tetrisRuleAuthority = { matchId:'match-01', revision:0, advance(){
    transitionCalls += 1;
    if (transitionCalls > 1) return { changed:false };
    return { changed:true, stateEvent:{type:'tetris_rule_state',payload:{matchId:'match-01',revision:1}},
      result:{type:'tetris_result',payload:{matchId:'match-01',revision:1},order:[0,1]} };
  } };
  const advanced = tetris.boundary.transition({type:'tetris_transition',room:tetris.room,session:tetris.session,payload:{matchId:'match-01'}});
  assert.strictEqual(advanced.ok, true);
  assert.deepStrictEqual(effectKinds(tetris.trace), ['metric:tetrisSnapshots','broadcast','terminal']);
  tetris.trace.length = 0;
  const duplicate = tetris.boundary.transition({type:'tetris_transition',room:tetris.room,session:tetris.session,payload:{matchId:'match-01'}});
  assert.strictEqual(duplicate.ok, true);
  assert(!tetris.trace.some(item => item.kind === 'terminal'));

  const xiangqi = fixture();
  xiangqi.room.started = true;
  xiangqi.room.xiangqiRuleAuthority = { matchId:'match-01', revision:0, advance(){ return {
    changed:true, event:{type:'clock_timeout',payload:{matchId:'match-01',revision:1,winner:0,loser:1}},
    result:{type:'xiangqi_result',payload:{matchId:'match-01',revision:1},order:[0,1]},
  }; } };
  const timeout = xiangqi.boundary.transition({type:'xiangqi_transition',room:xiangqi.room,session:xiangqi.session,payload:{matchId:'match-01'}});
  assert.strictEqual(timeout.terminal, true);
  assert.deepStrictEqual(effectKinds(xiangqi.trace), ['terminal']);
});

check('timer transition Adapter failure restores Authority checkpoint', () => {
  const adapter = createRuntimeMatchProtocolAdapter({
    send() {},
    broadcast(){ throw new Error('transition transport failed'); },
    incrementMetric() {}, recordAction() {}, settle() {}, stop() {},
  });
  const boundary = createMatchProtocolBoundary({ adapter, now:() => 1 });
  const authority = {
    matchId:'match-01', revision:0, finished:false,
    advance(){ this.revision += 1; this.finished = true; return {
      changed:true,
      event:{ type:'monopoly_rule_state', payload:{ matchId:'match-01', revision:this.revision } },
      result:{ type:'monopoly_result', payload:{ matchId:'match-01', revision:this.revision }, order:[0,1] },
    }; },
  };
  const session = { player:0 };
  const room = { matchId:'match-01', started:true, clients:new Map([[session, 0]]), gameplayResultSent:false, monopolyRuleAuthority:authority };
  const failed = boundary.transition({ type:'monopoly_transition', room, session, payload:{ matchId:'match-01' } });
  assert.strictEqual(failed.reason, 'match_protocol_unavailable');
  assert.strictEqual(authority.revision, 0);
  assert.strictEqual(authority.finished, false);
});

check('malformed terminal order fails closed before any terminal side effect', () => {
  const runtime = fixture();
  runtime.room.tetrisRuleAuthority = {
    matchId:'match-01', revision:1,
    acceptAction(){ return {
      ok:true,
      stateEvent:{ type:'tetris_rule_state', payload:{ matchId:'match-01', revision:1 } },
      result:{ type:'tetris_result', payload:{ matchId:'match-01' }, order:[0,0,9] },
    }; },
  };
  const outcome = runtime.boundary.command({ type:'tetris_action', room:runtime.room, session:runtime.session, payload:{ matchId:'match-01', seq:1, action:{ type:'hard_drop' } } });
  assert.strictEqual(outcome.reason, 'match_protocol_unavailable');
  assert.strictEqual(runtime.room.gameplayResultSent, false);
  assert(!runtime.trace.some(item => item.kind === 'terminal'));
});

check('adapter/authority faults fail closed and restore local room mutation', () => {
  const calls = [];
  const adapter = createRuntimeMatchProtocolAdapter({
    send() { calls.push('send'); }, broadcast() { calls.push('broadcast'); }, incrementMetric() { calls.push('metric'); },
    recordAction() { calls.push('record'); }, settle() { calls.push('settle'); }, stop() { throw new Error('adapter fault'); },
  });
  const room = { matchId:'m', gameplayResultSent:false, monopolyTurn:0 };
  const out = adapter.commit({room,session:{},effects:[
    {kind:'turn',value:2}, {kind:'terminal',message:{type:'result'},order:[0,1],cause:'authority'},
  ]});
  assert.strictEqual(out.ok, false);
  assert.strictEqual(room.monopolyTurn, 0);
  assert.strictEqual(room.gameplayResultSent, false);
  assert.deepStrictEqual(calls, ['broadcast','settle']);
});

check('server consumes the single command Interface for all three human Rule Authority messages', () => {
  assert(SERVER_SOURCE.includes("require('./boundaries/match-protocol')"));
  assert(SERVER_SOURCE.includes("matchProtocolBoundary.command({type,room:r,session:this,payload})"));
  assert(SERVER_SOURCE.includes('matchProtocolBoundary.transition'));
  assert(SERVER_SOURCE.includes('runMatchProtocolTransition'));
  assert(SERVER_SOURCE.includes("type:'xiangqi_action',room:r,session:this,player:seat.seatId"));
  assert(SERVER_SOURCE.includes("type:'monopoly_action',room:r,session:this,player:seat.seatId"));
  assert(SERVER_SOURCE.includes("type:'tetris_action',room:r,session:this,player:seat.seatId"));
  assert(!SERVER_SOURCE.includes("if (type === 'tetris_action'){"));
  assert(!SERVER_SOURCE.includes("if (type === 'xiangqi_action'){"));
  assert(!SERVER_SOURCE.includes("if (type === 'monopoly_action'){"));
});

check('Module stays independent of transport, rooms, Reward, Replay, Chat and Supabase', () => {
  [/WebSocket/, /server\/index/, /\bReward\b/, /\bReplay\b/, /\bChat\b/, /\bSupabase\b/, /sendText/, /socket/i]
    .forEach(pattern => assert(!pattern.test(SOURCE), 'unexpected coupling ' + pattern));
});

if (failures) {
  console.error('MATCH_PROTOCOL_BOUNDARY_FAILURES=' + failures + '/' + assertions);
  process.exitCode = 1;
} else {
  console.log('MATCH_PROTOCOL_BOUNDARY_ALL_PASS assertions=' + assertions);
}
