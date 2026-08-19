'use strict';

const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),PORT=Number(process.env.TETRIS_FALLBACK_PORT)||8141;
const DATA=fs.mkdtempSync(path.join(ROOT,'data','tetris-fallback-')),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let server,output='';
class Client{
  constructor(name,index){this.name=name;this.index=index;this.messages=[];this.waiters=[];}
  async open(){this.ws=new WebSocket('ws://127.0.0.1:'+PORT+'/ws');this.ws.onmessage=event=>{const message=JSON.parse(event.data);let consumed=false;this.waiters=[...this.waiters].filter(waiter=>{if(!consumed&&waiter.p(message)){consumed=true;waiter.r(message);return false}return true});if(!consumed)this.messages.push(message);};await new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});return this;}
  send(type,payload){this.ws.send(JSON.stringify({type,payload}));}
  wait(predicate,label,timeout=6000){const found=this.messages.find(predicate);if(found){this.messages.splice(this.messages.indexOf(found),1);return Promise.resolve(found);}return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(this.name+' timeout '+label)),timeout),entry={p:predicate,r:message=>{clearTimeout(timer);resolve(message)}};this.waiters.push(entry);});}
  async register(){this.send('register',{uid:'u_tetrisfallback'+this.index,pin:'Fallback'+this.index,name:this.name});const registered=await this.wait(message=>message.type==='registered','register');this.send('hello',{uid:registered.payload.uid,token:registered.payload.token,capabilities:['tetris-rule-v3','tetris-battle-authority-v1']});await this.wait(message=>message.type==='hello_ack'&&message.authenticated,'hello');}
  close(){try{this.ws.close();}catch{}}
}
async function main(){
  server=spawn(process.execPath,[path.join(ROOT,'server','index.js')],{env:{...process.env,PORT:String(PORT),DATA_DIR:DATA,NODE_ENV:'test',SUPABASE_URL:'',SUPABASE_KEY:'',DEEPSEEK_KEY:'',ENABLE_RULE_AUTHORITY_V2:'1',TETRIS_GUIDELINE_SCORING:'0'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
  for(let i=0;i<120&&!output.includes('已启动');i++)await sleep(50);if(!output.includes('已启动'))throw new Error('server start failed '+output);
  const host=await new Client('FallbackHost',1).open(),guest=await new Client('FallbackGuest',2).open();
  try{
    await host.register();await guest.register();host.send('create',{capacity:2});const created=await host.wait(message=>message.type==='created','create');guest.send('join',{room:created.room});await guest.wait(message=>message.type==='joined','join');
    host.send('select_game',{game:'tetris'});await host.wait(message=>message.type==='room_update'&&message.payload.game==='tetris','select');await guest.wait(message=>message.type==='room_update'&&message.payload.game==='tetris','select peer');guest.send('ready',{ready:true});await host.wait(message=>message.type==='room_update'&&message.payload.canStart===true,'ready');host.send('start');
    const [a,b]=await Promise.all([host.wait(message=>message.type==='started','start host'),guest.wait(message=>message.type==='started','start guest')]);
    if(!a.gameplay||a.gameplay.protocol!=='tetris-battle-authority-v1'||!b.gameplay||b.gameplay.protocol!=='tetris-battle-authority-v1')throw new Error('rollback protocol mismatch '+JSON.stringify({a:a.gameplay,b:b.gameplay}));
    console.log('PASS  TETRIS_GUIDELINE_SCORING=0：两个 v3 客户端真实建房回退 v1 Coordination');
    console.log('TETRIS_PROTOCOL_FALLBACK_ONLINE_ALL_PASS');
  }finally{host.close();guest.close();}
}
main().catch(error=>{console.error('TETRIS_PROTOCOL_FALLBACK_ONLINE_FAILED '+(error.stack||error));process.exitCode=1;}).finally(async()=>{if(server&&server.exitCode===null)server.kill();await sleep(80);try{fs.rmSync(DATA,{recursive:true,force:true});}catch{}});
