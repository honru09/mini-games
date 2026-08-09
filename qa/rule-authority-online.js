'use strict';

const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.RULE_AUTHORITY_ONLINE_PORT)||8137;
const DATA=fs.mkdtempSync(path.join(ROOT,'data','rule-authority-online-'));
const CAPS=['tetris-rule-v3','xiangqi-rule-v2','monopoly-rule-v2'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

class Client{
  constructor(name){this.name=name;this.messages=[];this.waiters=[];this.uid='';this.token='';}
  async connect(){this.ws=new WebSocket('ws://127.0.0.1:'+PORT+'/ws');this.ws.onmessage=event=>{const msg=JSON.parse(event.data);this.messages.push(msg);this.waiters.splice(0).forEach(resolve=>resolve());};await new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});}
  send(type,payload){this.ws.send(JSON.stringify({type,payload}));}
  async wait(type,timeout=6000,predicate=null){const end=Date.now()+timeout;while(Date.now()<end){const index=this.messages.findIndex(item=>item.type===type&&(!predicate||predicate(item)));if(index>=0)return this.messages.splice(index,1)[0];await new Promise(resolve=>{this.waiters.push(resolve);setTimeout(resolve,25);});}throw new Error(this.name+' wait '+type+'; queued='+JSON.stringify(this.messages.slice(-8)));}
  async register(index,capabilities=CAPS){this.send('register',{uid:'u_rulev2'+String(index).padStart(2,'0'),pin:'RuleV2Pin'+index,name:this.name});const msg=await this.wait('registered');this.uid=msg.payload.uid;this.token=msg.payload.token;this.send('hello',{uid:this.uid,token:this.token,proto:1,capabilities});const hello=await this.wait('hello_ack');if(!hello.authenticated)throw new Error(this.name+' auth failed');}
  close(){try{this.ws&&this.ws.close();}catch{}}
}

async function selectAndStart(host,guest,game){
  host.send('select_game',{game});
  await host.wait('room_update',6000,msg=>msg.payload&&msg.payload.game===game);
  await guest.wait('room_update',6000,msg=>msg.payload&&msg.payload.game===game);
  guest.send('ready',{ready:true});
  await host.wait('room_update',6000,msg=>msg.payload&&msg.payload.game===game&&msg.payload.canStart===true);
  host.send('start');
  const hs=await host.wait('started'),gs=await guest.wait('started');
  const expectedProtocol=game==='tetris'?'tetris-rule-v3':game+'-rule-v2';
  check(game+' Authority：双方协商同一规则协议与 matchId',hs.matchId===gs.matchId&&hs.gameplay&&hs.gameplay.protocol===expectedProtocol&&gs.gameplay&&gs.gameplay.protocol===expectedProtocol);
  return hs;
}

async function main(){
  const server=spawn(process.execPath,[path.join(ROOT,'server','index.js')],{env:{...process.env,PORT:String(PORT),DATA_DIR:DATA,NODE_ENV:'test',ENABLE_RULE_AUTHORITY_V2:'1',SUPABASE_URL:'',SUPABASE_KEY:'',DEEPSEEK_KEY:'',REWARD_TEST_MIN_DURATION_MS:'0'},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
  const clients=[];
  try{
    for(let i=0;i<100&&!output.includes('已启动');i++)await sleep(50);if(!output.includes('已启动'))throw new Error('server start failed '+output);
    const host=new Client('RuleHost'),guest=new Client('RuleGuest');clients.push(host,guest);await host.connect();await guest.connect();await host.register(1);await guest.register(2);
    host.send('create',{capacity:2});const created=await host.wait('created');guest.send('join',{room:created.room});await guest.wait('joined');

    const tetris=await selectAndStart(host,guest,'tetris');await sleep(Math.max(0,Number(tetris.gameplay.startAt)-Date.now()+50));
    host.send('tetris_action',{matchId:tetris.matchId,seq:1,action:{type:'hard_drop'}});const ts1=await host.wait('tetris_rule_state'),ts2=await guest.wait('tetris_rule_state');
    check('Tetris v3 Online：Action→Server State/Hash 广播',ts1.payload.players[0].hash&&ts1.payload.players[0].hash===ts2.payload.players[0].hash&&ts1.payload.players[0].seq===1&&ts1.payload.players[0].state.pieces>=1,JSON.stringify({host:ts1.payload.players[0],guest:ts2.payload.players[0]}));
    host.send('tetris_action',{matchId:tetris.matchId,seq:1,action:{type:'hard_drop'}});const tErr=await host.wait('gameplay_error');check('Tetris v3 Online：重复 seq 返回统一错误码',tErr.payload.code==='ERR_DUPLICATE_ACTION');

    guest.send('debug_disconnect',{});await host.wait('peer_status');const resumed=new Client('RuleGuestResume');clients.push(resumed);await resumed.connect();resumed.uid=guest.uid;resumed.token=guest.token;resumed.send('hello',{uid:resumed.uid,token:resumed.token,proto:1,capabilities:CAPS});await resumed.wait('hello_ack');const rejoined=await resumed.wait('rejoined');
    check('Tetris v3 Online：重连快照含完整规则状态',rejoined.payload.matchId===tetris.matchId&&rejoined.payload.tetrisRuleSnapshot&&rejoined.payload.tetrisRuleSnapshot.protocol==='tetris-rule-v3'&&rejoined.payload.tetrisRuleSnapshot.players[0].seq===1&&rejoined.payload.tetrisRuleSnapshot.players[0].state.pieces>=1);
    host.send('end_game',{});await host.wait('end_game');await resumed.wait('end_game');

    const xiangqi=await selectAndStart(host,resumed,'xiangqi');host.send('xiangqi_action',{matchId:xiangqi.matchId,seq:1,from:[6,0],to:[5,0]});const xs1=await host.wait('xiangqi_rule_state'),xs2=await resumed.wait('xiangqi_rule_state');
    check('Xiangqi v2 Online：合法走子由服务端验证并同步棋钟',xs1.payload.hash===xs2.payload.hash&&xs1.payload.current===1&&xs1.payload.clock.activePlayer===1&&Array.isArray(xs1.payload.lastMove&&xs1.payload.lastMove.from));
    resumed.send('xiangqi_action',{matchId:xiangqi.matchId,seq:1,from:[3,0],to:[5,0]});const xErr=await resumed.wait('gameplay_error');check('Xiangqi v2 Online：非法走子返回统一错误码',xErr.payload.code==='ERR_INVALID_MOVE');
    host.send('end_game',{});await host.wait('end_game');await resumed.wait('end_game');

    const monopoly=await selectAndStart(host,resumed,'monopoly');host.send('monopoly_action',{matchId:monopoly.matchId,seq:1,action:{type:'roll'}});const ms1=await host.wait('monopoly_rule_state'),ms2=await resumed.wait('monopoly_rule_state');
    const rollEvent=ms1.transition&&Array.isArray(ms1.transition.events)&&ms1.transition.events.find(event=>event&&event.type==='roll'),dice=rollEvent&&rollEvent.dice;
    check('Monopoly v2 Online：Server RNG 与完整棋盘状态广播',ms1.payload.stateHash===ms2.payload.stateHash&&Array.isArray(dice)&&dice.length===2&&dice.every(value=>Number.isInteger(value)&&value>=1&&value<=6),JSON.stringify({transition:ms1.transition,payload:ms1.payload}));
    host.send('monopoly_action',{matchId:monopoly.matchId,seq:1,action:{type:'roll'}});const mErr=await host.wait('gameplay_error');check('Monopoly v2 Online：重复动作返回统一错误码',mErr.payload.code==='ERR_DUPLICATE_ACTION');

    const oldCaps=['tetris-rule-v2','tetris-battle-authority-v1'];
    const oldHost=new Client('OldTetrisHost'),oldGuest=new Client('OldTetrisGuest');clients.push(oldHost,oldGuest);
    await oldHost.connect();await oldGuest.connect();await oldHost.register(3,oldCaps);await oldGuest.register(4,oldCaps);
    oldHost.send('create',{capacity:2});const oldRoom=await oldHost.wait('created');oldGuest.send('join',{room:oldRoom.room});await oldGuest.wait('joined');
    oldHost.send('select_game',{game:'tetris'});await oldHost.wait('room_update',6000,msg=>msg.payload&&msg.payload.game==='tetris');await oldGuest.wait('room_update',6000,msg=>msg.payload&&msg.payload.game==='tetris');
    oldGuest.send('ready',{ready:true});await oldHost.wait('room_update',6000,msg=>msg.payload&&msg.payload.canStart===true);oldHost.send('start');
    const oldStartedHost=await oldHost.wait('started'),oldStartedGuest=await oldGuest.wait('started');
    check('Tetris 滚动发布：旧 v2 严格客户端不接收 v3 字段并回退 v1 Coordination',oldStartedHost.gameplay&&oldStartedHost.gameplay.protocol==='tetris-battle-authority-v1'&&oldStartedGuest.gameplay&&oldStartedGuest.gameplay.protocol==='tetris-battle-authority-v1');
    if(!failures.length)console.log('RULE_AUTHORITY_ONLINE_ALL_PASS');
  } finally {clients.forEach(client=>client.close());server.kill();try{fs.rmSync(DATA,{recursive:true,force:true});}catch{}}
  if(failures.length){console.error('RULE_AUTHORITY_ONLINE_FAILED:',failures.join('、'));process.exitCode=1;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
