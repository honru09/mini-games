'use strict';
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),PORT=Number(process.env.LUDO_RULE_AUTHORITY_PORT)||8175,DATA=fs.mkdtempSync(path.join(ROOT,'data','ludo-rule-authority-')),CAP='ludo-rule-v1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),failures=[];
const check=(name,value)=>{console.log((value?'PASS':'FAIL')+'  '+name);if(!value)failures.push(name);};
class Client{
  constructor(name){this.name=name;this.messages=[];this.waiters=[];}
  async connect(){this.ws=new WebSocket('ws://127.0.0.1:'+PORT+'/ws');this.ws.onmessage=e=>{this.messages.push(JSON.parse(e.data));this.waiters.splice(0).forEach(r=>r());};await new Promise((r,j)=>{this.ws.onopen=r;this.ws.onerror=j;});}
  send(type,payload){this.ws.send(JSON.stringify({type,payload}));}
  async wait(type,timeout=6000,predicate=null){const end=Date.now()+timeout;while(Date.now()<end){const i=this.messages.findIndex(x=>x.type===type&&(!predicate||predicate(x)));if(i>=0)return this.messages.splice(i,1)[0];await new Promise(r=>{this.waiters.push(r);setTimeout(r,25);});}throw Error(this.name+' wait '+type);}
  close(){try{this.ws.close();}catch{}}
}
async function main(){
  const server=spawn(process.execPath,[path.join(ROOT,'server','index.js')],{env:{...process.env,PORT:String(PORT),DATA_DIR:DATA,NODE_ENV:'test',ENABLE_RULE_AUTHORITY_V2:'1',ENABLE_LUDO_RULE_AUTHORITY:'1',SUPABASE_URL:'',SUPABASE_KEY:'',DEEPSEEK_KEY:'',REWARD_TEST_MIN_DURATION_MS:'0',REWARD_TEST_MIN_ACTIONS:'0',REWARD_TEST_MIN_UNIQUE_ACTIONS:'0',REWARD_TEST_MIN_PLAYER_ACTIONS:'0'},stdio:['ignore','pipe','pipe']});
  let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);const clients=[];
  try{
    for(let i=0;i<120&&!output.includes('已启动');i++)await sleep(50);if(!output.includes('已启动'))throw Error('server start failed');
    const host=new Client('host'),guest=new Client('guest');clients.push(host,guest);await host.connect();await guest.connect();
    const register=async(client,index)=>{client.send('register',{uid:'u_ludo'+index,pin:'LudoRulePin'+index,name:'Ludo'+index});const reg=await client.wait('registered');client.send('hello',{uid:reg.payload.uid,token:reg.payload.token,proto:2,capabilities:[CAP]});await client.wait('hello_ack');};
    await register(host,1);await register(guest,2);host.send('create',{capacity:2});const created=await host.wait('created');guest.send('join',{room:created.room});await guest.wait('joined');host.send('select_game',{game:'ludo'});await host.wait('room_update',6000,x=>x.payload&&x.payload.game==='ludo');await guest.wait('room_update',6000,x=>x.payload&&x.payload.game==='ludo');guest.send('ready',{ready:true});await host.wait('room_update',6000,x=>x.payload&&x.payload.canStart===true);host.send('start');const started=await host.wait('started');await guest.wait('started');
    check('Ludo Online：协商 ludo-rule-v1',started.gameplay&&started.gameplay.protocol===CAP);
    host.send('ludo_action',{matchId:started.matchId,seq:1,action:{type:'roll'}});const state=await host.wait('ludo_rule_state');await guest.wait('ludo_rule_state');check('Ludo Online：服务端生成骰面并广播快照',state.payload.matchId===started.matchId&&state.payload.hash&&Number.isInteger(state.payload.revision));
    if(state.payload.phase==='pick'){const token=state.payload.tokens[0].findIndex(v=>v===-1);host.send('ludo_action',{matchId:started.matchId,seq:2,action:{type:'move',token}});const moved=await host.wait('ludo_rule_state');await guest.wait('ludo_rule_state');check('Ludo Online：起飞动作由服务端接收',moved.payload.tokens[0][token]===0&&moved.payload.revision===2);}
    host.send('move',{dice:6});const rejected=await host.wait('gameplay_error');check('Ludo Online：Authority 拒绝 legacy move',rejected.payload&&rejected.payload.reason==='legacy_move_rejected');
    if(!failures.length)console.log('LUDO_RULE_AUTHORITY_ONLINE_ALL_PASS');
  }finally{clients.forEach(client=>client.close());server.kill();try{fs.rmSync(DATA,{recursive:true,force:true});}catch{}}
  if(failures.length){console.error('LUDO_RULE_AUTHORITY_ONLINE_FAILED:',failures.join('、'));process.exitCode=1;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
