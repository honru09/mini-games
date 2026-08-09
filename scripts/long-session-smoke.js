'use strict';

const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const WS_URL=process.argv[2]||'ws://127.0.0.1:8080/ws';
const DURATION_MINUTES=Math.max(1,Math.min(180,Number(process.env.SYNTHETIC_SESSION_MINUTES)||30));
const MESSAGE_INTERVAL_MS=Math.max(30000,Math.min(5*60000,Number(process.env.SYNTHETIC_MESSAGE_INTERVAL_MS)||120000));
const OUTPUT=process.env.SYNTHETIC_EVIDENCE_PATH||path.join(__dirname,'..','requirements','active','production-readiness-sprint-p0-20260809','evidence','synthetic-session-'+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)+'.json');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

class Client{
  constructor(label){this.label=label;this.messages=[];this.waiters=[];this.closedUnexpectedly=0;this.pingTimer=null;}
  async open(){
    this.ws=new WebSocket(WS_URL);this.ws.onmessage=event=>{let message;try{message=JSON.parse(event.data)}catch{return}let consumed=false;
      this.waiters=[...this.waiters].filter(waiter=>{if(!consumed&&waiter.p(message)){consumed=true;waiter.r(message);return false}return true});if(!consumed)this.messages.push(message);};
    this.ws.onclose=()=>{if(!this.intentionalClose)this.closedUnexpectedly++;};
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(this.label+' open timeout')),15000);this.ws.onopen=()=>{clearTimeout(timer);resolve();};this.ws.onerror=()=>{clearTimeout(timer);reject(new Error(this.label+' open failed'));};});
    this.intentionalClose=false;this.pingTimer=setInterval(()=>{if(this.ws.readyState===1)this.send('ping',{});},10000);return this;
  }
  send(type,payload){if(this.ws.readyState!==1)throw new Error(this.label+' socket not open');this.ws.send(JSON.stringify({type,payload}));}
  wait(predicate,label,timeout=15000){
    const found=this.messages.find(predicate);if(found){this.messages.splice(this.messages.indexOf(found),1);return Promise.resolve(found);}
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiters=this.waiters.filter(item=>item!==entry);reject(new Error(this.label+' timeout '+label));},timeout);
      const entry={p:predicate,r:message=>{clearTimeout(timer);resolve(message);}};this.waiters.push(entry);});
  }
  async register(username,password,name){this.send('register',{authVersion:2,username,password,name,lang:'zh-CN'});const result=await this.wait(message=>message.type==='registered','register');this.uid=result.payload.uid;this.token=result.payload.token;return this;}
  async hello(uid,token){this.uid=uid;this.token=token;this.send('hello',{uid,token,proto:2,capabilities:['direct-chat-v1']});const result=await this.wait(message=>message.type==='hello_ack','hello');if(!result.authenticated)throw new Error(this.label+' hello unauthenticated');return this;}
  close(){this.intentionalClose=true;if(this.pingTimer)clearInterval(this.pingTimer);try{this.ws.close();}catch{}}
}

function percentile(values,p){if(!values.length)return 0;const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];}
async function reconnect(client){const uid=client.uid,token=client.token,label=client.label;client.close();await sleep(800);const next=await new Client(label+'R').open();await next.hello(uid,token);return next;}

async function main(){
  if(/^wss:\/\/mini-games-online\.onrender\.com\/ws$/i.test(WS_URL)&&process.env.SYNTHETIC_PRODUCTION_CONFIRM!=='CREATE_PERSISTENT_QA_ACCOUNTS'){
    throw new Error('production confirmation required: SYNTHETIC_PRODUCTION_CONFIRM=CREATE_PERSISTENT_QA_ACCOUNTS');
  }
  const startedAt=Date.now(),runId=startedAt.toString(36)+crypto.randomBytes(3).toString('hex');
  const usernameA=('QaPrA'+runId).slice(0,20),usernameB=('QaPrB'+runId).slice(0,20);
  const passwordA='Q!'+crypto.randomBytes(14).toString('base64url'),passwordB='Q!'+crypto.randomBytes(14).toString('base64url');
  let a=await new Client('A').open(),b=await new Client('B').open();
  const evidence={schemaVersion:1,kind:'formal-friend-ws-synthetic-v1',url:WS_URL,durationMinutes:DURATION_MINUTES,startedAt:new Date(startedAt).toISOString(),
    accountUsernames:[usernameA,usernameB],accountUids:[],messagesSent:0,messagesReceived:0,readReceipts:0,reconnects:0,latencyMs:[],errors:[],unexpectedCloses:0,ui:false,
    boundary:'Formal production accounts and WebSocket Direct Chat; not browser UI, second browser, physical device, or network shaping proof'};
  try{
    await a.register(usernameA,passwordA,'QA长会话A');await b.register(usernameB,passwordB,'QA长会话B');evidence.accountUids=[a.uid,b.uid];
    a.send('friend_request',{toUid:b.uid});const request=await a.wait(message=>message.type==='social_ok'&&message.action==='sent','friend request');
    b.send('friend_request_action',{action:'accept',requestId:request.requestId});await b.wait(message=>message.type==='social_ok'&&message.action==='accepted','friend accept');
    const endAt=startedAt+DURATION_MINUTES*60000;let nextMessageAt=Date.now(),sequence=0,nextReconnectAt=startedAt+Math.floor((endAt-startedAt)/3);
    while(Date.now()<endAt){
      if(Date.now()>=nextReconnectAt&&evidence.reconnects<2){
        if(evidence.reconnects===0)b=await reconnect(b);else a=await reconnect(a);evidence.reconnects++;
        const current=evidence.reconnects===1?b:a;current.send('chat_list',{limit:10});await current.wait(message=>message.type==='chat_state','post reconnect chat state');
        nextReconnectAt=startedAt+Math.floor((endAt-startedAt)*(evidence.reconnects+1)/3);
      }
      if(Date.now()>=nextMessageAt){
        const sender=sequence%2===0?a:b,recipient=sequence%2===0?b:a,clientMessageId='synthetic_'+runId+'_'+String(sequence).padStart(4,'0');
        const body='Synthetic session '+String(sequence+1);const sentAt=Date.now();sender.send('chat_send',{peerUid:recipient.uid,clientMessageId,text:body});
        const [ack,incoming]=await Promise.all([sender.wait(message=>message.type==='chat_send_ok'&&message.payload.clientMessageId===clientMessageId,'send ack'),recipient.wait(message=>message.type==='chat_message'&&message.payload.message.text===body,'incoming')]);
        evidence.messagesSent++;evidence.messagesReceived++;evidence.latencyMs.push(Date.now()-sentAt);
        recipient.send('chat_read',{peerUid:sender.uid,throughSeq:ack.payload.seq});await sender.wait(message=>message.type==='chat_read_ok'&&message.payload.throughSeq===ack.payload.seq,'read receipt');evidence.readReceipts++;
        sequence++;nextMessageAt=Date.now()+MESSAGE_INTERVAL_MS;
      }
      await sleep(Math.min(1000,Math.max(100,nextMessageAt-Date.now())));
    }
  }catch(error){evidence.errors.push(String(error&&error.message||error));throw error;}
  finally{
    evidence.endedAt=new Date().toISOString();evidence.elapsedMs=Date.now()-startedAt;evidence.unexpectedCloses=(a&&a.closedUnexpectedly||0)+(b&&b.closedUnexpectedly||0);
    evidence.latency={min:evidence.latencyMs.length?Math.min(...evidence.latencyMs):0,max:evidence.latencyMs.length?Math.max(...evidence.latencyMs):0,
      average:evidence.latencyMs.length?Math.round(evidence.latencyMs.reduce((sum,value)=>sum+value,0)/evidence.latencyMs.length):0,p95:percentile(evidence.latencyMs,.95)};
    evidence.status=!evidence.errors.length&&evidence.messagesSent===evidence.messagesReceived&&evidence.messagesSent===evidence.readReceipts&&evidence.elapsedMs>=DURATION_MINUTES*60000-5000?'PASS':'FAIL';
    delete evidence.latencyMs;fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,JSON.stringify(evidence,null,2)+'\n');
    if(a)a.close();if(b)b.close();console.log('SYNTHETIC_SESSION_'+evidence.status);console.log(OUTPUT);
  }
}
main().catch(error=>{console.error('SYNTHETIC_SESSION_CRASH '+String(error&&error.message||error));process.exitCode=1;});
