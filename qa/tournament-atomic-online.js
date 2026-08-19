'use strict';

const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.TOURNAMENT_ATOMIC_PORT)||8197;
const DATA=fs.mkdtempSync(path.join(ROOT,'data','tournament-atomic-online-'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const failures=[];
const QUARANTINED_MUTATIONS=[
  'match_expression','match_chat_send','move','bot_move','tank_input','bot_tank_input','tetris_lock_claim','tetris_attack_claim',
  'tetris_ko_claim','tetris_action','bot_tetris_action','tetris_state','xiangqi_action','monopoly_action','monopoly_auction_open',
  'monopoly_bid','monopoly_turn_end','game_state','result','start','restart','end_game','select_game','ready','room_settings','add_ai','remove_ai','invite',
];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

class Client{
  constructor(name){this.name=name;this.messages=[];this.history=[];this.waiters=[];this.uid='';this.token='';}
  async connect(){
    this.ws=new WebSocket('ws://127.0.0.1:'+PORT+'/ws');
    this.ws.onmessage=event=>{const message=JSON.parse(event.data);this.messages.push(message);this.history.push(message);this.waiters.splice(0).forEach(resolve=>resolve());};
    await new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});
  }
  send(type,payload){this.ws.send(JSON.stringify({type,payload}));}
  async waitWhere(type,predicate=()=>true,timeout=8000){
    const end=Date.now()+timeout;
    while(Date.now()<end){
      const index=this.messages.findIndex(item=>item.type===type&&predicate(item));
      if(index>=0)return this.messages.splice(index,1)[0];
      await new Promise(resolve=>{this.waiters.push(resolve);setTimeout(resolve,25);});
    }
    throw new Error(this.name+' wait '+type+'; queued='+JSON.stringify(this.messages.slice(-12)));
  }
  async register(index){
    this.send('register',{uid:'u_touratomic'+String(index).padStart(2,'0'),pin:'TourAtomicPin'+index,name:this.name});
    const registered=await this.waitWhere('registered');this.uid=registered.payload.uid;this.token=registered.payload.token;
    this.send('hello',{uid:this.uid,token:this.token,proto:2,capabilities:['tournament-orchestrator-v1']});
    const hello=await this.waitWhere('hello_ack');if(!hello.authenticated)throw new Error(this.name+' auth failed');
  }
  clear(){this.messages.length=0;}
  close(){try{this.ws&&this.ws.close();}catch{}}
}

async function createSettledSourceRoom(host,participant,survivors,label){
  const players=[host,participant,...survivors];
  host.send('create',{capacity:players.length,visibility:'public',allowSpectators:true});
  const room=(await host.waitWhere('created')).room;
  for(const client of [participant,...survivors]){client.send('join',{room});await client.waitWhere('joined',message=>message.room===room);}
  host.send('select_game',{game:'ludo'});
  await host.waitWhere('room_update',message=>message.payload&&message.payload.room===room&&message.payload.game==='ludo');
  for(const client of [participant,...survivors])client.send('ready',{ready:true});
  await host.waitWhere('room_update',message=>message.payload&&message.payload.room===room&&message.payload.canStart===true);
  host.send('start');
  const started=await host.waitWhere('started',message=>message.game==='ludo');
  for(const client of [participant,...survivors])await client.waitWhere('started',message=>message.matchId===started.matchId);
  const results=players.map((_client,slot)=>({slot,coins:slot===0?1:0,rank:slot+1}));
  for(const client of players)client.send('result',{matchId:started.matchId,game:'ludo',results});
  for(const client of players)await client.waitWhere('result_ok',message=>message.matchId===started.matchId);
  check('Tournament Atomic Online：'+label+' 源房保持已结算但未退出的 started 生命周期',!!started.matchId);
  return room;
}

function latestRoomProjection(client,room){
  return client.messages.filter(message=>message.type==='room_update'&&message.payload&&message.payload.room===room).map(message=>message.payload).pop()||null;
}

function hasForbiddenTargetWire(clients){
  const forbidden=new Set(['created','joined','started','tournament_match_assigned']);
  return clients.flatMap(client=>client.messages.filter(message=>forbidden.has(message.type)).map(message=>client.name+':'+message.type));
}

function placeholderRound(payload,tournamentId){
  return !!(payload&&payload.tournamentId===tournamentId&&payload.pairings&&payload.pairings.length===2&&
    payload.pairings.every(pairing=>String(pairing.matchRoomId).startsWith(tournamentId+'_r1_room')&&!pairing.roomMetadata));
}

async function main(){
  const server=spawn(process.execPath,[path.join(ROOT,'server','index.js')],{
    env:{
      ...process.env,PORT:String(PORT),DATA_DIR:DATA,NODE_ENV:'test',
      TOURNAMENT_TEST_FAIL_SOURCE_RESET_INDEX:'0',TOURNAMENT_TEST_FAIL_ABORT_RELEASE_COUNT:'2',
      TOURNAMENT_TEST_FAIL_START_INDEX:'1',TOURNAMENT_ABORT_RETRY_LIMIT:'1',TOURNAMENT_ABORT_RETRY_MS:'250',
      ROOM_GRAPH_RECOVERY_SWEEP_MS:'3000',SPECTATOR_DELAY_MS:'5000',ENABLE_RULE_AUTHORITY_V2:'0',
      REWARD_TEST_MIN_DURATION_MS:'0',REWARD_TEST_MIN_ACTIONS:'0',REWARD_TEST_MIN_UNIQUE_ACTIONS:'0',REWARD_TEST_MIN_PLAYER_ACTIONS:'0',
      SUPABASE_URL:'',SUPABASE_KEY:'',DEEPSEEK_KEY:'',
    },
    stdio:['ignore','pipe','pipe'],
  });
  let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
  const clients=[
    new Client('AtomicHostA'),new Client('AtomicP2'),new Client('AtomicSurvivorA'),new Client('AtomicObserverA'),
    new Client('AtomicHostB'),new Client('AtomicP4'),new Client('AtomicSurvivorB'),new Client('AtomicSpectatorA'),
  ];
  try{
    for(let index=0;index<100&&!output.includes('已启动');index++)await sleep(50);
    if(!output.includes('已启动'))throw new Error('server start failed '+output);
    for(let index=0;index<clients.length;index++){await clients[index].connect();await clients[index].register(index+1);}
    const [host,p2,survivorA,observerA,p3,p4,survivorB,spectatorA]=clients;
    const sourceA=await createSettledSourceRoom(host,p2,[survivorA,observerA],'第一');
    const sourceB=await createSettledSourceRoom(p3,survivorB,[],'第二');
    spectatorA.send('spectate',{room:sourceA});
    await spectatorA.waitWhere('spectating',message=>message.payload&&message.payload.room===sourceA);
    p4.send('spectate',{room:sourceB});
    await p4.waitWhere('spectating',message=>message.payload&&message.payload.room===sourceB);

    const participants=[host,p2,p3,p4],participantIds=participants.map(client=>client.uid);
    host.send('tournament_create',{gameId:'gomoku',participants:participantIds});
    const waiting=await host.waitWhere('tournament_state',message=>message.payload&&message.payload.status==='waiting');
    const tournamentId=waiting.payload.tournamentId;
    for(const player of [p2,p3,p4])player.send('tournament_consent',{tournamentId,accepted:true});
    await host.waitWhere('tournament_state',message=>message.payload&&participantIds.every(uid=>message.payload.consents&&message.payload.consents[uid]===true));
    clients.forEach(client=>client.clear());
    const spectatorParticipantHistoryMark=p4.history.length;

    host.send('tournament_start',{tournamentId});
    const retryScheduled=await host.waitWhere('tournament_error',message=>message.reason==='tournament_room_cleanup_retry_scheduled',12000);
    await sleep(100);
    const projectionA=latestRoomProjection(survivorA,sourceA),projectionB=latestRoomProjection(survivorB,sourceB);
    const reassignedA=survivorA.messages.some(message=>message.type==='player_reassigned'&&message.payload&&message.payload.player===0);
    const observerReassigned=observerA.messages.some(message=>message.type==='player_reassigned'&&message.payload&&message.payload.player===1);
    const reassignedB=survivorB.messages.some(message=>message.type==='player_reassigned'&&message.payload&&message.payload.player===0);
    const observerHostChanged=observerA.messages.some(message=>message.type==='host_changed'&&message.payload&&message.payload.uid===survivorA.uid&&message.payload.player===0);
    const terminalPlayers=[survivorA,observerA,survivorB].every(client=>client.messages.some(message=>message.type==='end_game'));
    const terminalSpectator=spectatorA.messages.some(message=>message.type==='end_game');
    check('Tournament Atomic Online：首个 reset failure 后仍通知该源房 host transfer 与 Seat 压紧',
      retryScheduled.reason==='tournament_room_cleanup_retry_scheduled'&&reassignedA&&observerReassigned&&observerHostChanged&&projectionA&&projectionA.size===2&&
      projectionA.started===true&&projectionA.seats.filter(seat=>seat.type==='human').every(seat=>seat.ready===true)&&projectionA.host&&projectionA.host.uid===survivorA.uid,
      JSON.stringify({reassignedA,observerReassigned,observerHostChanged,projectionA}));
    check('Tournament Atomic Online：首个 reset failure 不会跳过后续 source change 的通知与投影',
      reassignedB&&projectionB&&projectionB.size===1&&projectionB.host&&projectionB.host.uid===survivorB.uid,
      JSON.stringify({reassignedB,projectionB}));
    check('Tournament Atomic Online：reset failure 同步终止剩余玩家，观众不经过 spectatorDelay',terminalPlayers&&terminalSpectator,
      JSON.stringify({terminalPlayers,terminalSpectator}));
    const blockedMutations=[];
    for(const mutation of QUARANTINED_MUTATIONS){
      survivorA.messages=survivorA.messages.filter(message=>!(message.type==='error'&&message.reason==='room_presence_quarantined'));
      survivorA.send(mutation,{matchId:'quarantine-probe',seatId:0,ready:true,dice:6});
      const blocked=await survivorA.waitWhere('error',message=>message.reason==='room_presence_quarantined',800);
      if(blocked.reason==='room_presence_quarantined')blockedMutations.push(mutation);
    }
    check('Tournament Atomic Online：源房恢复窗口 fail-closed 覆盖全部同房 mutation handler',
      blockedMutations.length===QUARANTINED_MUTATIONS.length,JSON.stringify({blockedMutations,expected:QUARANTINED_MUTATIONS}));
    const firstFailureWire=hasForbiddenTargetWire(participants);
    check('Tournament Atomic Online：source reset/abort retry 期间不提前暴露目标房 wire',firstFailureWire.length===0,firstFailureWire.join(','));

    const quarantined=await host.waitWhere('tournament_error',message=>message.reason==='tournament_room_cleanup_quarantined',8000);
    check('Tournament Atomic Online：目标房补偿连续失败进入单一恢复队列',quarantined.reason==='tournament_room_cleanup_quarantined');
    const recoveryHistoryMark=host.history.length;
    const recoveredSourceA=await survivorA.waitWhere('room_update',message=>message.payload&&message.payload.room===sourceA&&message.payload.started===false&&message.payload.size===2,8000);
    const recoveredSourceB=await survivorB.waitWhere('room_update',message=>message.payload&&message.payload.room===sourceB&&message.payload.started===false&&message.payload.size===1,8000);
    check('Tournament Atomic Online：失败源房由恢复队列最终 reset，且参赛者不回迁旧房',
      recoveredSourceA.payload.host.uid===survivorA.uid&&recoveredSourceA.payload.size===2&&
      new Set(recoveredSourceA.payload.seats.filter(seat=>seat.type==='human').map(seat=>seat.userId)).size===2&&
      recoveredSourceA.payload.seats.filter(seat=>seat.type==='human').every(seat=>seat.userId===survivorA.uid||seat.userId===observerA.uid)&&
      recoveredSourceA.payload.seats.find(seat=>seat.userId===observerA.uid).ready===false&&
      recoveredSourceB.payload.host.uid===survivorB.uid&&recoveredSourceB.payload.seats.filter(seat=>seat.type==='human').every(seat=>seat.userId===survivorB.uid));
    const rolledBack=(await host.waitWhere('tournament_state',message=>placeholderRound(message.payload,tournamentId),10000)).payload;
    check('Tournament Atomic Online：quarantine 恢复后 Guard/Orchestrator 精确回到可重试 placeholder',placeholderRound(rolledBack,tournamentId));
    const recoveryEvents=host.history.slice(recoveryHistoryMark);
    const sourceLobbyIndex=recoveryEvents.findIndex(message=>message.type==='lobby'&&Array.isArray(message.payload)&&message.payload.some(room=>room.room===sourceA&&room.started===false&&room.size===2));
    const placeholderIndex=recoveryEvents.findIndex(message=>message.type==='tournament_state'&&placeholderRound(message.payload,tournamentId));
    check('Tournament Atomic Online：源房恢复主动刷新大厅且早于赛事 placeholder 恢复',
      sourceLobbyIndex>=0&&sourceLobbyIndex<placeholderIndex,JSON.stringify({sequence:recoveryEvents.map(message=>message.type),sourceLobbyIndex,placeholderIndex}));
    host.send('test_room_graph_recovery_status',{});
    const recoveryStatus=await host.waitWhere('test_room_graph_recovery_status');
    check('Tournament Atomic Online：source/abort recovery 消费后队列清空且 sweep timer 停止',
      recoveryStatus.payload&&recoveryStatus.payload.queueSize===0&&recoveryStatus.payload.timerActive===false&&
      recoveryStatus.payload.sourceResetFaultArmed===false&&recoveryStatus.payload.abortReleaseFailuresRemaining===0,
      JSON.stringify(recoveryStatus.payload));

    participants.forEach(client=>client.clear());
    host.send('tournament_start',{tournamentId});
    const startFailed=await host.waitWhere('tournament_error',message=>message.reason==='tournament_room_start_failed',12000);
    await sleep(150);
    const startFailureWire=hasForbiddenTargetWire(participants);
    check('Tournament Atomic Online：第二桌 Authority 准备失败前仍不发送任何目标房可见 wire',
      startFailed.reason==='tournament_room_start_failed'&&startFailureWire.length===0,startFailureWire.join(','));
    host.send('tournament_get',{tournamentId});
    const authorityRolledBack=(await host.waitWhere('tournament_state',message=>placeholderRound(message.payload,tournamentId),8000)).payload;
    check('Tournament Atomic Online：Authority 失败补偿仍恢复同一可重试事务状态',placeholderRound(authorityRolledBack,tournamentId));

    participants.forEach(client=>client.clear());
    host.send('tournament_start',{tournamentId});
    const retried=(await host.waitWhere('tournament_state',message=>message.payload&&message.payload.tournamentId===tournamentId&&message.payload.pairings&&message.payload.pairings.length===2&&message.payload.pairings.every(pairing=>/^[A-Z0-9]{6}$/.test(pairing.matchRoomId)),12000)).payload;
    const assignments=[],assignedByUid=new Map(),startedByUid=new Map();
    for(const client of participants){
      const assigned=await client.waitWhere('tournament_match_assigned',message=>message.payload&&message.payload.tournamentId===tournamentId,8000);
      assignments.push(assigned.payload);
      assignedByUid.set(client.uid,assigned.payload);
      startedByUid.set(client.uid,await client.waitWhere('started',message=>message.matchId===assigned.payload.matchId,8000));
    }
    check('Tournament Atomic Online：两级补偿完成后同轮可安全重试并完整建立两桌',
      retried.pairings.length===2&&assignments.length===4&&new Set(assignments.map(item=>item.matchRoomId)).size===2);
    const spectatorParticipantEvents=p4.history.slice(spectatorParticipantHistoryMark);
    const p4Assignment=assignedByUid.get(p4.uid),p4Started=startedByUid.get(p4.uid);
    const spectateLeftIndex=spectatorParticipantEvents.findIndex(message=>message.type==='spectate_left');
    const roomWireIndex=spectatorParticipantEvents.findIndex(message=>(message.type==='created'||message.type==='joined')&&message.room===p4Assignment.matchRoomId);
    const startedIndex=spectatorParticipantEvents.findIndex(message=>message.type==='started'&&message.matchId===p4Assignment.matchId);
    const targetSeat=p4Started&&Array.isArray(p4Started.seats)?p4Started.seats.find(seat=>Number(seat.seatId)===Number(p4Assignment.player)):null;
    check('Tournament Atomic Online：spectator-only 参赛者按 spectate_left → 目标房 wire → started 顺序迁入有效玩家席',
      spectateLeftIndex>=0&&spectateLeftIndex<roomWireIndex&&roomWireIndex<startedIndex&&targetSeat&&targetSeat.userId===p4.uid,
      JSON.stringify({sequence:spectatorParticipantEvents.map(message=>message.type),spectateLeftIndex,roomWireIndex,startedIndex,targetSeat}));
    const survivorTargetWire=hasForbiddenTargetWire([survivorA,observerA,survivorB,spectatorA]);
    check('Tournament Atomic Online：非参赛 survivor 始终留在旧房且不接收赛事目标房 wire',survivorTargetWire.length===0,survivorTargetWire.join(','));
    if(!failures.length)console.log('TOURNAMENT_ATOMIC_ONLINE_ALL_PASS');
  } finally {
    clients.forEach(client=>client.close());server.kill();
    try{fs.rmSync(DATA,{recursive:true,force:true});}catch{}
  }
  if(failures.length){console.error('TOURNAMENT_ATOMIC_ONLINE_FAILED:',failures.join('、'));process.exitCode=1;}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
