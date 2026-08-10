'use strict';

const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync(require('path').join(__dirname,'../public/src/online/03-websocket.js'),'utf8')+'\n;globalThis.__online=online;';
const hidden={classList:{add(){},remove(){}}};
const context={
  console,setTimeout,clearTimeout,setInterval,clearInterval,Date,Map,Set,URLSearchParams,
  WebSocket:function(){},location:{hostname:'127.0.0.1',protocol:'http:'},localStorage:{getItem(){return '';},setItem(){}},
  document:{},$:()=>hidden,t:key=>key,showHub(){},closeTournamentStateModal(){},currentGameId:null,
};
context.globalThis=context;
vm.runInNewContext(source,context,{filename:'03-websocket.js'});
const online=context.__online;
const failures=[];
function check(name,fn){try{fn();console.log('PASS  '+name)}catch(error){console.error('FAIL  '+name+' :: '+error.message);failures.push(name)}}
check('same WebSocket reset preserves negotiated capability',()=>{online.connected=true;online.capabilities=new Set(['match-expression-v1']);online.resetState();assert(online.capabilities.has('match-expression-v1'))});
check('real disconnect reset clears negotiated capability',()=>{online.connected=false;online.capabilities=new Set(['match-expression-v1']);online.resetState();assert.strictEqual(online.capabilities.size,0)});
check('queued room update cannot resurrect a room after local leave reset',()=>{online.connected=true;online.room='OLD001';online.roomInfo={room:'OLD001'};online.resetState();online.onMessage({type:'room_update',payload:{room:'OLD001',capacity:2,players:[],seats:[]}});assert.strictEqual(online.room,null);assert.strictEqual(online.roomInfo,null)});
check('source keeps the connected guard and close path order',()=>{assert(/if\(!this\.connected\)this\.capabilities=new Set\(\)/.test(source));const closed=source.indexOf('this.connected = false;');const reset=source.indexOf('this.resetState(shouldResume)',closed);assert(closed>=0&&reset>closed&&reset-closed<600)});
if(failures.length){console.error('SOCIAL_MATCH_CLIENT_LIFECYCLE_FAILED');process.exit(1)}else console.log('SOCIAL_MATCH_CLIENT_LIFECYCLE_ALL_PASS');
