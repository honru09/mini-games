'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../public/src/online/03-websocket.js'), 'utf8') + '\n;globalThis.__online=online;';
const hidden={classList:{add(){},remove(){}}};
const opens=[],cached=[],sent=[];
const context={console,setTimeout,clearTimeout,setInterval,clearInterval,Date,Math,Map,Set,URLSearchParams,
  WebSocket:function(){},location:{hostname:'127.0.0.1',protocol:'http:'},localStorage:{getItem(){return'';},setItem(){}},
  document:{},$:()=>hidden,t:key=>key,showHub(){},closeTournamentStateModal(){},currentGameId:null,
  account:{uid:'viewer',authToken:'token'},beginPublicProfileRequest(){},closeProfileLoading(){},
  finishPublicProfileRequest(profile,request){opens.push({profile,request});return true;},
  cacheServerProfilePresentation(profile){cached.push(profile);},updateAccountProfile(){},toast(){},
};
context.globalThis=context;
vm.runInNewContext(source,context,{filename:'03-websocket.js'});
const online=context.__online;online.connected=true;online._authenticated=true;online.send=message=>sent.push(message);

function request(uid){assert.strictEqual(online.requestProfile(uid),true);return online.pendingPublicProfile;}

const first=request('same-user');
assert.strictEqual(online.cancelPublicProfileRequest(first.requestId),true);
const second=request('same-user');
online.onMessage({type:'profile_data',payload:{uid:'same-user',name:'old'}});
assert.strictEqual(opens.length,0,'cancelled first response must not open the second request');
assert.strictEqual(cached.length,1,'late response may refresh the safe presentation cache');
online.onMessage({type:'profile_data',payload:{uid:'same-user',name:'new'}});
assert.strictEqual(opens.length,1,'the second ordered response opens once');
assert.strictEqual(opens[0].request.requestId,second.requestId,'the second request owns the open');

const third=request('other-user');
online.connected=false;online.resetState();
assert.strictEqual(third.active,false,'disconnect invalidates the active request');
assert.strictEqual(online.pendingPublicProfile,null,'disconnect clears the active request');
assert.strictEqual(online.publicProfileRequests.length,0,'disconnect clears the ordered queue');
assert.strictEqual(sent.every(item=>item.type==='profile_get'&&Object.keys(item.payload).join(',')==='uid'),true,'wire payload remains uid-only');
console.log('PROFILE_REQUEST_LIFECYCLE_ALL_PASS assertions=9');
