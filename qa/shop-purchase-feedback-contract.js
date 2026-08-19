'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const shopSource = read('public/src/shop/06-shop.js');
const onlineSource = read('public/src/online/03-websocket.js');
const serverSource = read('server/index.js');
const template = read('public/index-template.html');
let failed = false;
function check(ok,message){ console.log((ok?'PASS  ':'FAIL  ')+message); if(!ok) failed=true; }

class ClassList {
  constructor(node){ this.node=node; this.values=new Set(String(node.className||'').split(/\s+/).filter(Boolean)); }
  sync(){ this.node.className=[...this.values].join(' '); }
  add(...names){ names.forEach(name=>this.values.add(name)); this.sync(); }
  remove(...names){ names.forEach(name=>this.values.delete(name)); this.sync(); }
  toggle(name,force){ const next=force===undefined?!this.values.has(name):!!force; if(next)this.values.add(name);else this.values.delete(name);this.sync();return next; }
  contains(name){ return this.values.has(name); }
}
class Node {
  constructor(className,text){ this.className=className||'';this.textContent=text||'';this.attributes={};this.disabled=false;this.isConnected=true;this.classList=new ClassList(this); }
  setAttribute(name,value){this.attributes[name]=String(value);}
  removeAttribute(name){delete this.attributes[name];}
}

const sends=[],timers=new Map();let timerSeq=0;
const status=new Node('shop-purchase-status hidden','');
const modal={isConnected:true,querySelector(selector){return selector==='.shop-purchase-status'?status:null;}};
const account={uid:'formal-a',ephemeral:false};
const sandbox={
  console,Number,String,Array,Object,Math,Set,Map,
  account,SHOP:{avatars:[{id:30,name:'Avatar'}]},
  shopItemName:()=> 'Avatar',
  online:{connected:true,send(message){sends.push(message);}},
  activeShopModal:modal,
  toast(){},
  t:(key,...args)=>key+(args.length?':'+args.join('|'):''),
  translateServerMessage:(_message,reason,fallback)=>reason||fallback,
  crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},
  setTimeout(fn){const id=++timerSeq;timers.set(id,fn);return id;},
  clearTimeout(id){timers.delete(id);},
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
const runtimeSource=shopSource.slice(0,shopSource.indexOf('function collectionRarityBadge'));
vm.runInContext(runtimeSource,context,{filename:'shop-purchase-feedback-runtime.js'});
context.modal=modal;
vm.runInContext('activeShopModal=modal',context);

const buttonA=new Node('btn','Buy');
context.button=buttonA;
vm.runInContext("requestPurchase('avatars',30,button)",context);
check(sends.length===1&&sends[0].type==='purchase'&&sends[0].payload.requestId.startsWith('buy_'),'first click sends one request with a client requestId');
check(buttonA.disabled&&buttonA.attributes['aria-busy']==='true'&&/shop_purchase_pending/.test(status.textContent),'pending state disables button and announces through the live region');
vm.runInContext("requestPurchase('avatars',30,button)",context);
check(sends.length===1&&/shop_purchase_busy/.test(status.textContent),'rapid duplicate click does not send a second mutation');
const mismatch=vm.runInContext("finishShopPurchaseFeedback(true,{requestId:'buy_other',category:'avatars',id:30},'')",context);
check(mismatch===false&&buttonA.disabled,'mismatched late response cannot settle the active purchase');
const requestId=sends[0].payload.requestId;
context.response={requestId,category:'avatars',id:30};
const settled=vm.runInContext("finishShopPurchaseFeedback(true,response,'')",context);
check(settled===true&&!buttonA.disabled&&!('aria-busy'in buttonA.attributes)&&/shop_purchase_success/.test(status.textContent),'matching success clears pending and announces the purchased item');

const buttonB=new Node('btn','Buy');context.button=buttonB;
vm.runInContext("requestPurchase('avatars',30,button)",context);
const requestIdB=sends[1].payload.requestId;context.response={requestId:requestIdB,category:'avatars',id:30,msg:'no'};
const errored=vm.runInContext("finishShopPurchaseFeedback(false,response,'insufficient_balance')",context);
check(errored===true&&!buttonB.disabled&&status.attributes.role==='alert'&&/insufficient_balance/.test(status.textContent),'matching error restores controls and uses an assertive localized reason');

const buttonC=new Node('btn','Buy');context.button=buttonC;
vm.runInContext("requestPurchase('avatars',30,button)",context);
const requestIdC=sends[2].payload.requestId;
const timeout=[...timers.values()][0];timeout();
context.response={requestId:requestIdC,category:'avatars',id:30};
check(!buttonC.disabled&&/shop_purchase_timeout/.test(status.textContent)&&vm.runInContext("finishShopPurchaseFeedback(true,response,'')",context)===false,'timeout unlocks UI and a later stale response cannot overwrite the live status');

context.account.ephemeral=true;const buttonGuest=new Node('btn','Buy');context.button=buttonGuest;
vm.runInContext("requestPurchase('avatars',30,button)",context);
check(sends.length===3,'guest purchase remains blocked before WebSocket send');
context.account.ephemeral=false;

check(/shop-purchase-status/.test(template)&&/aria-live','polite'/.test(shopSource)&&/aria-busy/.test(shopSource),'shop exposes a dedicated live status and busy button semantics');
check(/finishShopPurchaseFeedback\(true,payload/.test(onlineSource)&&/finishShopPurchaseFeedback\(false/.test(onlineSource)&&/clearShopPurchaseFeedback\(\{silent:true\}\)/.test(onlineSource),'WebSocket success/error/disconnect paths own the feedback lifecycle');
const purchaseSection=serverSource.slice(serverSource.indexOf("if (type === 'purchase')"),serverSource.indexOf("if (type === 'logout')"));
const responseFragments=[...purchaseSection.matchAll(/type:\s*'purchase_(?:ok|error)'[\s\S]{0,260}/g)].map(match=>match[0]);
check(responseFragments.length>=8&&responseFragments.every(fragment=>/requestId/.test(fragment)),'all purchase success/error responses echo request correlation metadata');
for(const lang of ['zh-CN','en-US','uk-UA']){
  const locale=JSON.parse(read(`public/locales/${lang}.json`));
  check(['shop_purchase_pending','shop_purchase_success','shop_purchase_failed','shop_purchase_timeout','shop_purchase_busy','shop_purchase_cancelled'].every(key=>typeof locale[key]==='string'&&locale[key].trim()),`${lang} contains the complete purchase feedback copy`);
}
check(!/u\.coins\s*[-+]=|owned\[[^\]]+\]\.push/.test(runtimeSource),'client feedback state never deducts balance or grants ownership');

if(failed)process.exitCode=1;else console.log('SHOP_PURCHASE_FEEDBACK_CONTRACT_ALL_PASS');
