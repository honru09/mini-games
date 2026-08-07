'use strict';
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),crypto=require('crypto');
const WebSocket=global.WebSocket||require('ws');
const ROOT=path.join(__dirname,'..'),SERVER=path.join(ROOT,'server','index.js');
const port=19000+Math.floor(Math.random()*700),data=fs.mkdtempSync(path.join(ROOT,'data','social-'));
let server,fail=0,log='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function check(name,ok,detail){console.log((ok?'PASS ':'FAIL ')+name+(detail?' :: '+detail:''));if(!ok)fail++;}
class Client{
  constructor(name){this.name=name;this.messages=[];this.waiters=[];}
  async open(){this.ws=new WebSocket('ws://127.0.0.1:'+port+'/ws');this.ws.onmessage=event=>{let message;try{message=JSON.parse(event.data)}catch{return}let consumed=false;this.waiters=[...this.waiters].filter(waiter=>{if(!consumed&&waiter.p(message)){consumed=true;waiter.r(message);return false}return true});if(!consumed)this.messages.push(message)};await new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject});return this;}
  send(type,payload){this.ws.send(JSON.stringify({type,payload}));}
  wait(predicate,label,timeout=5000){const found=this.messages.find(predicate);if(found){this.messages.splice(this.messages.indexOf(found),1);return Promise.resolve(found)}return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiters=this.waiters.filter(item=>item!==entry);reject(new Error(this.name+' timeout '+label))},timeout);const entry={p:predicate,r:message=>{clearTimeout(timer);resolve(message)}};this.waiters.push(entry)});}
  async register(name){const uid='u_social'+crypto.randomBytes(6).toString('hex'),pin='Social'+crypto.randomBytes(5).toString('hex');this.send('register',{uid,pin,name,avatar:100});const message=await this.wait(item=>item.type==='registered','register');this.uid=message.payload.profile.uid;this.token=message.token||message.payload.token;this.messages=[];return this;}
  close(){try{this.ws.close()}catch{}}
}
async function start(){
  server=spawn(process.execPath,[SERVER],{env:{...process.env,PORT:String(port),DATA_DIR:data,NODE_ENV:'test',SUPABASE_URL:'',SUPABASE_KEY:'',DEEPSEEK_KEY:''},stdio:['ignore','pipe','pipe']});server.stdout.on('data',chunk=>log+=chunk);server.stderr.on('data',chunk=>log+=chunk);
  await new Promise((resolve,reject)=>{const started=Date.now();const poll=()=>require('http').get('http://127.0.0.1:'+port+'/',response=>{response.resume();response.statusCode===200?resolve():setTimeout(poll,30)}).on('error',()=>Date.now()-started>5000?reject(new Error('server not ready')):setTimeout(poll,30));poll()});
}
async function state(client,label){client.messages=client.messages.filter(message=>message.type!=='social_state');client.send('social_get');return client.wait(message=>message.type==='social_state',label);}
async function main(){
  await start();
  const a=await new Client('A').open(),b=await new Client('B').open(),c=await new Client('C').open();await Promise.all([a.register('好友甲'),b.register('好友乙'),c.register('举报者')]);
  const empty=await state(a,'empty');check('初始 Social Graph 为空',empty.payload.counts.friends===0&&empty.payload.counts.incoming===0);
  a.send('friend_request',{toUid:b.uid});const sent=await a.wait(message=>message.type==='social_ok'&&message.action==='sent','request sent');check('发送好友请求',!!sent.requestId);
  const incoming=await state(b,'incoming');const request=incoming.payload.incoming.find(item=>item.user.uid===a.uid);check('对方收到 Incoming Request',!!request);
  a.send('friend_request',{toUid:b.uid});const duplicate=await a.wait(message=>message.type==='social_ok'&&message.action==='idempotent','duplicate');check('重复好友请求幂等',duplicate.requestId===sent.requestId);
  b.send('friend_request_action',{action:'accept',requestId:request.id});await b.wait(message=>message.type==='social_ok'&&message.action==='accepted','accept');const friendsA=await state(a,'friends A'),friendsB=await state(b,'friends B');check('接受后双方只存在一条好友关系',friendsA.payload.friends.length===1&&friendsB.payload.friends.length===1);
  a.send('friend_remove',{uid:b.uid});await a.wait(message=>message.type==='social_ok'&&message.action==='removed','remove');const removed=await state(b,'removed state');check('移除好友后双方关系解除',removed.payload.friends.length===0);
  a.send('friend_request',{toUid:b.uid});const sent2=await a.wait(message=>message.type==='social_ok'&&message.action==='sent','request two');const incoming2=await state(b,'incoming two');const req2=incoming2.payload.incoming.find(item=>item.id===sent2.requestId);b.send('friend_request_action',{action:'decline',requestId:req2.id});await b.wait(message=>message.type==='social_ok'&&message.action==='declined','decline');check('好友请求可拒绝',(await state(a,'declined state')).payload.outgoing.length===0);
  a.send('friend_request',{toUid:b.uid});const sent3=await a.wait(message=>message.type==='social_ok'&&message.action==='sent','request three');a.send('friend_request_action',{action:'cancel',requestId:sent3.requestId});await a.wait(message=>message.type==='social_ok'&&message.action==='cancelled','cancel');check('发送方可取消请求',(await state(b,'cancelled state')).payload.incoming.length===0);
  a.send('block',{uid:b.uid});await a.wait(message=>message.type==='social_ok'&&message.action==='blocked','block');check('屏蔽进入本人私有 Block 列表',(await state(a,'blocked state')).payload.blocked.some(item=>item.uid===b.uid));
  b.send('friend_request',{toUid:a.uid});const blockedRequest=await b.wait(message=>message.type==='social_error'&&message.payload&&message.payload.reason==='blocked','blocked request');check('被屏蔽后不能发送好友请求',!!blockedRequest);
  a.send('create',{capacity:2,visibility:'public',allowSpectators:true});const created=await a.wait(message=>message.type==='created','create room');b.send('lobby');const hiddenLobby=await b.wait(message=>message.type==='lobby','blocked lobby');check('屏蔽关系隐藏公开房',!hiddenLobby.payload.some(room=>room.room===created.room));
  b.send('join',{room:created.room});const blockedJoin=await b.wait(message=>message.type==='social_error'&&message.payload&&message.payload.reason==='blocked','blocked join');check('屏蔽关系阻止直加入房',!!blockedJoin);
  a.send('invite',{toUid:b.uid});const blockedInvite=await a.wait(message=>message.type==='social_error'&&message.payload&&message.payload.reason==='blocked','blocked invite');check('屏蔽关系阻止房间邀请',!!blockedInvite);
  b.send('profile',{uid:b.uid,signature:'<b>恶意标签</b>可见文本'});await b.wait(message=>message.type==='profile_ok','profile signature');
  c.send('report',{targetUid:b.uid,reason:'harassment',contextType:'profile',contextId:b.uid,recentEventIds:['evt-1','evt-2']});const reported=await c.wait(message=>message.type==='social_ok'&&message.action==='reported','report');check('举报只创建 Moderation Intake',!!reported.reportId);
  c.send('report',{targetUid:b.uid,reason:'harassment',contextType:'profile',contextId:b.uid,recentEventIds:['evt-1']});const reportDuplicate=await c.wait(message=>message.type==='social_ok'&&message.action==='idempotent','report duplicate');check('短时间重复举报幂等',reportDuplicate.reportId===reported.reportId);
  const persisted=JSON.parse(fs.readFileSync(path.join(data,'leaderboard.json'),'utf8'));const report=persisted.reports.find(item=>item.id===reported.reportId);check('举报保存目标显示快照且过滤 HTML',report&&report.targetSnapshot&&report.targetSnapshot.signature==='恶意标签可见文本');
  a.send('unblock',{uid:b.uid});await a.wait(message=>message.type==='social_ok'&&message.action==='unblocked','unblock');a.send('friend_request',{toUid:b.uid});await a.wait(message=>message.type==='social_ok'&&message.action==='sent','request after unblock');const inbound=await state(b,'incoming after unblock');const finalRequest=inbound.payload.incoming.find(item=>item.user.uid===a.uid);b.send('friend_request_action',{action:'accept',requestId:finalRequest.id});await b.wait(message=>message.type==='social_ok'&&message.action==='accepted','accept after unblock');
  b.send('profile',{uid:b.uid,presencePreference:'invisible'});await b.wait(message=>message.type==='profile_ok','invisible');const privacy=await state(a,'presence privacy');const hiddenFriend=privacy.payload.friends.find(item=>item.uid===b.uid);check('隐身好友对普通用户显示离线',hiddenFriend&&hiddenFriend.presence==='offline');
  [a,b,c].forEach(client=>client.close());
}
main().catch(error=>{console.error('SOCIAL_GRAPH_CRASH',error.stack||error);fail++;}).finally(async()=>{if(server&&server.exitCode===null)server.kill();await sleep(100);try{fs.rmSync(data,{recursive:true,force:true})}catch{}console.log(fail?'SOCIAL_GRAPH_HAS_FAILURES':'SOCIAL_GRAPH_ALL_PASS');process.exitCode=fail?1:0;});
