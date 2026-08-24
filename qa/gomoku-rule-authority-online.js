'use strict';

const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.GOMOKU_RULE_AUTHORITY_PORT)||8174;
const DATA=fs.mkdtempSync(path.join(ROOT,'data','gomoku-rule-authority-'));
const CAP='gomoku-rule-v1';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

class Client{
  constructor(name){this.name=name;this.messages=[];this.waiters=[];this.uid='';this.token='';}
  async connect(){this.ws=new WebSocket('ws://127.0.0.1:'+PORT+'/ws');this.ws.onmessage=event=>{const msg=JSON.parse(event.data);this.messages.push(msg);this.waiters.splice(0).forEach(resolve=>resolve());};await new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});}
  send(type,payload){this.ws.send(JSON.stringify({type,payload}));}
  async wait(type,timeout=6000,predicate=null){const end=Date.now()+timeout;while(Date.now()<end){const index=this.messages.findIndex(item=>item.type===type&&(!predicate||predicate(item)));if(index>=0)return this.messages.splice(index,1)[0];await new Promise(resolve=>{this.waiters.push(resolve);setTimeout(resolve,25);});}throw new Error(this.name+' wait '+type+'; queued='+JSON.stringify(this.messages.slice(-8)));}
  async register(index,capabilities=[CAP]){this.send('register',{uid:'u_gomokurule'+String(index).padStart(2,'0'),pin:'GomokuRulePin'+index,name:this.name});const msg=await this.wait('registered');this.uid=msg.payload.uid;this.token=msg.payload.token;this.send('hello',{uid:this.uid,token:this.token,proto:2,capabilities});const hello=await this.wait('hello_ack');if(!hello.authenticated)throw new Error(this.name+' auth failed');return hello;}
  close(){try{this.ws&&this.ws.close();}catch{}}
}

async function createStartedRoom(host,guest){
  host.send('create',{capacity:2});const created=await host.wait('created');guest.send('join',{room:created.room});await guest.wait('joined');
  host.send('select_game',{game:'gomoku'});await host.wait('room_update',6000,msg=>msg.payload&&msg.payload.game==='gomoku');await guest.wait('room_update',6000,msg=>msg.payload&&msg.payload.game==='gomoku');
  guest.send('ready',{ready:true});await host.wait('room_update',6000,msg=>msg.payload&&msg.payload.canStart===true);host.send('start');
  return{host:await host.wait('started'),guest:await guest.wait('started'),room:created.room};
}

async function main(){
  const server=spawn(process.execPath,[path.join(ROOT,'server','index.js')],{env:{...process.env,PORT:String(PORT),DATA_DIR:DATA,NODE_ENV:'test',ENABLE_RULE_AUTHORITY_V2:'1',SUPABASE_URL:'',SUPABASE_KEY:'',DEEPSEEK_KEY:'',REWARD_TEST_MIN_DURATION_MS:'0',REWARD_TEST_MIN_ACTIONS:'0',REWARD_TEST_MIN_UNIQUE_ACTIONS:'0',REWARD_TEST_MIN_PLAYER_ACTIONS:'0'},stdio:['ignore','pipe','pipe']});
  let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);const clients=[];
  try{
    for(let i=0;i<100&&!output.includes('已启动');i++)await sleep(50);if(!output.includes('已启动'))throw new Error('server start failed '+output);
    const host=new Client('GomokuHost'),guest=new Client('GomokuGuest');clients.push(host,guest);await host.connect();await guest.connect();
    const hello=await host.register(1);await guest.register(2);
    check('Gomoku Online：服务端声明 gomoku-rule-v1 capability',Array.isArray(hello.capabilities)&&hello.capabilities.includes(CAP.replace(/-/g,'_')));
    const started=await createStartedRoom(host,guest);
    check('Gomoku Online：双方协商同一权威协议与 matchId',started.host.matchId===started.guest.matchId&&started.host.gameplay&&started.host.gameplay.protocol===CAP&&started.guest.gameplay&&started.guest.gameplay.protocol===CAP);

    host.send('gomoku_action',{matchId:started.host.matchId,seq:1,row:7,col:7});
    const firstHost=await host.wait('gomoku_rule_state'),firstGuest=await guest.wait('gomoku_rule_state');
    check('Gomoku Online：合法动作广播同一服务端 Board/Hash',firstHost.payload.hash===firstGuest.payload.hash&&firstHost.payload.board[7][7]===0&&firstHost.payload.current===1&&firstHost.payload.lastSeq.join(',')==='1,0');

    guest.send('gomoku_action',{matchId:started.host.matchId,seq:1,row:7,col:7});
    const occupied=await guest.wait('gameplay_error');
    check('Gomoku Online：占用位置返回统一错误码',occupied.payload&&occupied.payload.code==='ERR_INVALID_MOVE');
    guest.send('gomoku_action',{matchId:started.host.matchId,seq:1,row:0,col:0});
    const retryHost=await host.wait('gomoku_rule_state'),retryGuest=await guest.wait('gomoku_rule_state');
    check('Gomoku Online：非法动作不消耗 seq，同 seq 修正后可成功',retryHost.payload.hash===retryGuest.payload.hash&&retryHost.payload.lastSeq.join(',')==='1,1'&&retryHost.payload.board[0][0]===1);

    guest.send('debug_disconnect',{});await host.wait('peer_status');
    const resumed=new Client('GomokuGuestResume');clients.push(resumed);await resumed.connect();resumed.uid=guest.uid;resumed.token=guest.token;resumed.send('hello',{uid:resumed.uid,token:resumed.token,proto:2,capabilities:[CAP]});await resumed.wait('hello_ack');const rejoined=await resumed.wait('rejoined');
    check('Gomoku Online：重连快照恢复完整棋盘、Revision、Last Seq 与 Hash',rejoined.payload.matchId===started.host.matchId&&rejoined.payload.gomokuRuleSnapshot&&rejoined.payload.gomokuRuleSnapshot.protocol===CAP&&rejoined.payload.gomokuRuleSnapshot.board[7][7]===0&&rejoined.payload.gomokuRuleSnapshot.board[0][0]===1&&rejoined.payload.gomokuRuleSnapshot.lastSeq.join(',')==='1,1'&&rejoined.payload.gomokuRuleSnapshot.hash);
    resumed.send('undo',{matchId:started.host.matchId});const undoHost=await host.wait('gomoku_rule_state'),undoGuest=await resumed.wait('gomoku_rule_state');
    check('Gomoku Online：Authority Undo 回滚棋盘但保持 Revision/Last Seq 单调',undoHost.payload.hash===undoGuest.payload.hash&&undoHost.payload.revision===3&&undoHost.payload.board[0][0]===-1&&undoHost.payload.current===1&&undoHost.payload.lastSeq.join(',')==='1,1');
    resumed.send('undo',{matchId:started.host.matchId});const undoError=await resumed.wait('gameplay_error');check('Gomoku Online：每局只允许一次 Undo',undoError.payload.reason==='ERR_UNDO_ALREADY_USED');
    resumed.send('gomoku_action',{matchId:started.host.matchId,seq:2,row:0,col:0});const replayHost=await host.wait('gomoku_rule_state');await resumed.wait('gomoku_rule_state');

    const spectator=new Client('GomokuSpectator');clients.push(spectator);await spectator.connect();await spectator.register(5);spectator.send('spectate_join',{roomId:started.room,matchId:started.host.matchId});const spectating=await spectator.wait('spectate_joined');
    check('Gomoku Online：观众初始载荷直接携带完整权威快照',spectating.payload&&spectating.payload.gomokuRuleSnapshot&&spectating.payload.gomokuRuleSnapshot.hash===replayHost.payload.hash);
    spectator.send('gomoku_action',{matchId:started.host.matchId,seq:1,row:4,col:4});const spectatorError=await spectator.wait('spectator_error');check('Gomoku Online：观众对权威动作保持只读',spectatorError.reason==='spectator_readonly');

    host.send('move',[8,8]);const legacyMoveError=await host.wait('gameplay_error');check('Gomoku Online：Authority 对局拒绝 legacy move',legacyMoveError.payload.reason==='legacy_move_rejected');
    host.send('game_state',{matchId:started.host.matchId,snapshot:{hist:[[1,1]],cur:1,over:false}});const snapshotError=await host.wait('gameplay_error');check('Gomoku Online：Authority 对局拒绝客户端快照',snapshotError.payload.reason==='client_snapshot_rejected');
    host.send('result',{matchId:started.host.matchId,game:'gomoku',results:[{slot:0,rank:1,coins:1},{slot:1,rank:2,coins:0}]});const resultError=await host.wait('result_error');check('Gomoku Online：Authority 对局拒绝客户端结算 claim',resultError.reason==='authoritative_result_required');

    const continuation=[[0,7,8],[1,0,1],[0,7,9],[1,0,2],[0,7,10],[1,0,3],[0,7,11]],seq=[1,2];
    for(const [player,row,col] of continuation){const sender=player===0?host:resumed;sender.send('gomoku_action',{matchId:started.host.matchId,seq:++seq[player],row,col});await host.wait('gomoku_rule_state');await resumed.wait('gomoku_rule_state');}
    const hostResult=await host.wait('gomoku_result'),guestResult=await resumed.wait('gomoku_result');
    check('Gomoku Online：五连只由服务端生成终局、Hash 与名次',hostResult.matchId===started.host.matchId&&hostResult.revision===guestResult.revision&&hostResult.stats&&hostResult.stats.reason==='FIVE_IN_A_ROW'&&hostResult.order.join(',')==='0,1');
    host.send('restart',{});const restartedHost=await host.wait('restart'),restartedGuest=await resumed.wait('restart');
    check('Gomoku Online：Restart 创建新 matchId 与全新 Authority',restartedHost.matchId!==started.host.matchId&&restartedHost.matchId===restartedGuest.matchId&&restartedHost.gameplay&&restartedHost.gameplay.protocol===CAP&&restartedHost.gameplay.revision===0);
    host.send('gomoku_action',{matchId:restartedHost.matchId,seq:1,row:6,col:6});const restartedState=await host.wait('gomoku_rule_state');await resumed.wait('gomoku_rule_state');check('Gomoku Online：Restart 后动作序号从 1 重新开始',restartedState.payload.revision===1&&restartedState.payload.lastSeq.join(',')==='1,0');
    host.send('end_game',{});await host.wait('end_game');await resumed.wait('end_game');

    const oldHost=new Client('LegacyGomokuHost'),oldGuest=new Client('LegacyGomokuGuest');clients.push(oldHost,oldGuest);await oldHost.connect();await oldGuest.connect();await oldHost.register(3,[]);await oldGuest.register(4,[]);
    const legacy=await createStartedRoom(oldHost,oldGuest);
    check('Gomoku 滚动发布：任一旧客户端存在时回退原 move 中继',!legacy.host.gameplay&&!legacy.guest.gameplay);
    oldHost.send('move',[7,7]);const relayed=await oldGuest.wait('move');check('Gomoku 滚动发布：旧客户端仍可收到原始落子消息',Array.isArray(relayed.payload)&&relayed.payload.join(',')==='7,7'&&relayed.player===0);

    const aiHost=new Client('GomokuAIHost');clients.push(aiHost);await aiHost.connect();await aiHost.register(8);aiHost.send('create',{capacity:2});const aiRoom=await aiHost.wait('created');aiHost.send('add_ai',{difficulty:'hard',persona:'teacher'});await aiHost.wait('room_update',6000,msg=>msg.payload&&msg.payload.aiCount===1);aiHost.send('select_game',{game:'gomoku'});await aiHost.wait('room_update',6000,msg=>msg.payload&&msg.payload.game==='gomoku'&&msg.payload.canStart===true);aiHost.send('start');const aiStarted=await aiHost.wait('started');
    aiHost.send('gomoku_action',{matchId:aiStarted.matchId,seq:1,row:7,col:7});await aiHost.wait('gomoku_rule_state');aiHost.send('bot_move',{seatId:1,payload:[0,0]});const aiState=await aiHost.wait('gomoku_rule_state');
    check('Gomoku Online：AI Controller 与真人共用同一 Authority/Seq/Hash',aiStarted.gameplay&&aiStarted.gameplay.protocol===CAP&&aiState.payload.current===0&&aiState.payload.board[0][0]===1&&aiState.payload.lastSeq.join(',')==='1,1'&&aiState.payload.hash);
    aiHost.send('end_game',{});await aiHost.wait('end_game');

    const upgradeHost=new Client('GomokuUpgradeHost'),upgradeGuest=new Client('GomokuUpgradeGuest');clients.push(upgradeHost,upgradeGuest);await upgradeHost.connect();await upgradeGuest.connect();await upgradeHost.register(9);await upgradeGuest.register(10);const upgradeStarted=await createStartedRoom(upgradeHost,upgradeGuest);upgradeGuest.send('debug_disconnect',{});await upgradeHost.wait('peer_status');const incompatible=new Client('GomokuOldResume');clients.push(incompatible);await incompatible.connect();incompatible.uid=upgradeGuest.uid;incompatible.token=upgradeGuest.token;incompatible.send('hello',{uid:incompatible.uid,token:incompatible.token,proto:2,capabilities:[]});await incompatible.wait('hello_ack');const incompatibleResume=await incompatible.wait('resume_expired');
    check('Gomoku Online：Authority 对局不向缺 capability 的重连客户端动态降级',incompatibleResume.payload&&incompatibleResume.payload.reason==='protocol_upgrade_required'&&incompatibleResume.payload.protocol===CAP&&incompatibleResume.payload.room===upgradeStarted.room);

    if(!failures.length)console.log('GOMOKU_RULE_AUTHORITY_ONLINE_ALL_PASS');
  }finally{clients.forEach(client=>client.close());server.kill();try{fs.rmSync(DATA,{recursive:true,force:true});}catch{}}
  if(failures.length){console.error('GOMOKU_RULE_AUTHORITY_ONLINE_FAILED:',failures.join('、'));process.exitCode=1;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
