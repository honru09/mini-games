'use strict';

const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.COSMETIC_PROFILE_PORT)||8145;
const DATA=fs.mkdtempSync(path.join(ROOT,'data','cosmetic-profile-'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

class Client{
  constructor(name){this.name=name;this.messages=[];this.waiters=[];this.uid='';this.token='';}
  async connect(){this.ws=new WebSocket('ws://127.0.0.1:'+PORT+'/ws');this.ws.onmessage=event=>{const msg=JSON.parse(event.data);this.messages.push(msg);this.waiters.splice(0).forEach(resolve=>resolve());};await new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});}
  send(type,payload){this.ws.send(JSON.stringify({type,payload}));}
  async wait(type,timeout=6000,predicate=null){const end=Date.now()+timeout;while(Date.now()<end){const index=this.messages.findIndex(item=>item.type===type&&(!predicate||predicate(item)));if(index>=0)return this.messages.splice(index,1)[0];await new Promise(resolve=>{this.waiters.push(resolve);setTimeout(resolve,25);});}throw new Error(this.name+' wait '+type+'; queued='+JSON.stringify(this.messages.slice(-8)));}
  async register(index){this.send('register',{uid:'u_cosmetic'+String(index).padStart(2,'0'),pin:'CosmeticPin'+index,name:this.name});const registered=await this.wait('registered');this.uid=registered.payload.uid;this.token=registered.payload.token;this.send('hello',{uid:this.uid,token:this.token,proto:1,capabilities:['game-cosmetic-presentation-v1']});await this.wait('hello_ack');}
  close(){try{this.ws&&this.ws.close();}catch{}}
}

async function main(){
  const server=spawn(process.execPath,[path.join(ROOT,'server','index.js')],{env:{...process.env,PORT:String(PORT),DATA_DIR:DATA,NODE_ENV:'test',ENABLE_RULE_AUTHORITY_V2:'0',SUPABASE_URL:'',SUPABASE_KEY:'',DEEPSEEK_KEY:''},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
  const clients=[new Client('CosmeticHost'),new Client('CosmeticGuest')];
  try{
    for(let i=0;i<100&&!output.includes('已启动');i++)await sleep(50);if(!output.includes('已启动'))throw new Error('server start failed '+output);
    for(let i=0;i<clients.length;i++){await clients[i].connect();await clients[i].register(i+1);}
    const [host,guest]=clients;
    host.send('profile',{uid:host.uid,gameCosmetics:{tetris:{blockSkin:'neon',backgroundSkin:'grid'},tank:{tankSkin:'cyber'},gomoku:{pieceSkin:'unknown'}}});const hostProfile=(await host.wait('profile_ok')).payload;
    guest.send('profile',{uid:guest.uid,gameCosmetics:{tetris:{blockSkin:'classic',backgroundSkin:'classic'}}});await guest.wait('profile_ok');
    check('Cosmetic Profile：未购买装备不能伪造，未知 ID 回退默认',hostProfile.cosmeticSchemaVersion===1&&hostProfile.gameCosmetics.tetris.blockSkin==='classic'&&hostProfile.gameCosmetics.tetris.backgroundSkin==='classic'&&hostProfile.gameCosmetics.gomoku.pieceSkin==='classic');
    guest.send('profile_get',{uid:host.uid});const publicProfile=(await guest.wait('profile_data')).payload;
    check('Cosmetic Profile：公开档案只暴露装备 ID，不暴露 owned',publicProfile.gameCosmetics.tank.tankSkin==='classic'&&!Object.prototype.hasOwnProperty.call(publicProfile,'owned'));
    host.send('create',{capacity:2});const created=await host.wait('created');
    host.send('select_game',{game:'tetris'});
    await host.wait('room_update',6000,msg=>msg.payload&&msg.payload.game==='tetris');
    guest.send('join',{room:created.room});await guest.wait('joined');
    await host.wait('room_update',6000,msg=>msg.payload&&msg.payload.game==='tetris'&&msg.payload.size===2);
    guest.send('ready',{ready:true});
    await host.wait('room_update',6000,msg=>msg.payload&&msg.payload.game==='tetris'&&msg.payload.canStart===true);
    host.send('start');
    const hs=await host.wait('started'),gs=await guest.wait('started');
    const presentation=hs.presentation;
    check('Cosmetic Profile：装备经公开 Match Metadata 到双方 renderer',presentation.cosmeticSchemaVersion===1&&presentation.cosmetic.players[0].block==='classic'&&presentation.cosmetic.players[0].background==='classic'&&presentation.cosmetic.players[1].block==='classic'&&JSON.stringify(presentation)===JSON.stringify(gs.presentation));
    const serialized=JSON.stringify(presentation);
    check('Cosmetic Profile：比赛元数据不含私有经济/购买字段',!serialized.includes('owned')&&!serialized.includes('balance')&&!serialized.includes('price')&&!serialized.includes('purchase'));
    if(!failures.length)console.log('GAME_COSMETIC_PROFILE_ALL_PASS');
  } finally {clients.forEach(client=>client.close());server.kill();try{fs.rmSync(DATA,{recursive:true,force:true});}catch{}}
  if(failures.length){console.error('GAME_COSMETIC_PROFILE_FAILED:',failures.join('、'));process.exitCode=1;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
