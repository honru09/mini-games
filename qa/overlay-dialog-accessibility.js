'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.join(__dirname,'..');
const utils=fs.readFileSync(path.join(ROOT,'public/src/core/01-utils.js'),'utf8');
const roster=fs.readFileSync(path.join(ROOT,'public/src/ui/07-roster.js'),'utf8');
const modalStart=utils.indexOf('function showModal');
const modalEnd=utils.indexOf('function pipsHTML',modalStart);
const helperStart=utils.indexOf('function setupAccessibleOverlayDialog');
const helperEnd=utils.indexOf('function shareGameLink',helperStart);
const rewardStart=roster.indexOf('function showRewardBreakdown');
const rewardEnd=roster.indexOf('function applyGameResult',rewardStart);
assert(modalStart>=0&&modalEnd>modalStart,'missing rules modal source');
assert(helperStart>=0&&helperEnd>helperStart,'missing accessible overlay helper/victory source');
assert(rewardStart>=0&&rewardEnd>rewardStart,'missing reward breakdown source');

let fails=0;
function check(name,value,detail){console.log((value?'PASS  ':'FAIL  ')+name+(value||!detail?'':' :: '+detail));if(!value)fails++;}

function makeRuntime(){
  const documentListeners=new Map();
  let document;
  class Node {
    constructor(tag='div'){
      this.tagName=String(tag).toUpperCase();this.children=[];this.parentNode=null;this.className='';this.textContent='';this.attributes={};this.listeners=new Map();this.style={setProperty(k,v){this[k]=v;}};
      this.disabled=false;this.hidden=false;this.tabIndex=this.tagName==='BUTTON'?0:-1;this.isConnected=false;
      const tokens=new Set();
      this.classList={add:(...xs)=>xs.forEach(x=>tokens.add(x)),remove:(...xs)=>xs.forEach(x=>tokens.delete(x)),contains:x=>tokens.has(x)};
    }
    appendChild(child){if(child.parentNode&&child.parentNode!==this)child.remove();child.parentNode=this;this.children.push(child);child.setConnected(this.isConnected);return child;}
    setConnected(value){this.isConnected=!!value;this.children.forEach(child=>child.setConnected(value));}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;this.setConnected(false);}
    setAttribute(name,value){this.attributes[name]=String(value);if(name==='tabindex')this.tabIndex=Number(value);}
    getAttribute(name){return Object.prototype.hasOwnProperty.call(this.attributes,name)?this.attributes[name]:null;}
    addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
    removeEventListener(type,fn){const set=this.listeners.get(type);if(set)set.delete(fn);}
    dispatch(type,event={}){event.target=event.target||this;for(const fn of [...(this.listeners.get(type)||[])])fn(event);}
    focus(){document.activeElement=this;this.focusCount=(this.focusCount||0)+1;}
    contains(target){for(let node=target;node;node=node.parentNode)if(node===this)return true;return false;}
    querySelector(selector){return find(this,selector);}
    querySelectorAll(selector){return findAll(this,selector);}
  }
  function hasClass(node,name){return String(node.className||'').split(/\s+/).includes(name)||node.classList.contains(name);}
  function matchesSelector(node,selector){
    return String(selector||'').split(',').some(raw=>{
      const part=raw.trim().replace(/:not\(\[disabled\]\)|:not\(\[tabindex="-1"\]\)/g,'');
      if(!part)return false;
      if(part.startsWith('.'))return hasClass(node,part.slice(1));
      if(part==='button'||part==='input'||part==='select'||part==='textarea')return node.tagName===part.toUpperCase()&&!node.disabled;
      if(part==='[href]')return node.getAttribute('href')!==null;
      if(part==='[tabindex]')return node.getAttribute('tabindex')!==null;
      return false;
    });
  }
  function findAll(node,selector){const result=[];const walk=parent=>{for(const child of parent.children){if(matchesSelector(child,selector))result.push(child);walk(child);}};walk(node);return result;}
  function find(node,selector){return findAll(node,selector)[0]||null;}
  const body=new Node('body');body.setConnected(true);
  document={body,activeElement:null,createElement:tag=>new Node(tag),querySelector:selector=>find(body,selector),querySelectorAll:selector=>findAll(body,selector),
    addEventListener(type,fn){if(!documentListeners.has(type))documentListeners.set(type,new Set());documentListeners.get(type).add(fn);},
    removeEventListener(type,fn){const set=documentListeners.get(type);if(set)set.delete(fn);},
    dispatchKey(key,shiftKey=false){let prevented=0;const event={key,shiftKey,target:document.activeElement,preventDefault(){prevented++;}};for(const fn of [...(documentListeners.get('keydown')||[])])fn(event);return prevented;},
    listenerCount(type){return (documentListeners.get(type)||new Set()).size;}
  };
  const el=(tag,cls,text)=>{const node=new Node(tag);node.className=cls||'';if(text!==undefined&&text!==null)node.textContent=String(text);return node;};
  const labels={come_back:'再来一局',invite_player:'邀请玩家',share_button:'分享',reward_close:'关闭',reward_title_win:'胜利',reward_total:'总计',victory_podium_label:'比赛排名',victory_podium_rank:'名次'};
  const sandbox={console,document,Math,Array,Set,Map,Object,String,Number,Boolean,JSON,
    el,t:(key,...args)=>labels[key]||key+(args.length?' '+args.join(' '):''),sfx(){},clearHonruGameReaction(){},setHonruPlatformReaction(){},setHonruResultReaction(){},
    CURRENCY:'💵',online:{isSpectator:false},rewardReasonLabel:()=>'',signedReward:(value,suffix)=>value?((value>0?'+':'')+value+suffix):''};
  sandbox.window=sandbox;
  const context=vm.createContext(sandbox);
  vm.runInContext(utils.slice(modalStart,modalEnd),context,{filename:'rules-modal.js'});
  vm.runInContext(utils.slice(helperStart,helperEnd),context,{filename:'overlay-dialog-utils.js'});
  vm.runInContext(roster.slice(rewardStart,rewardEnd),context,{filename:'reward-dialog.js'});
  return {context,document,body,Node};
}

try{
  const runtime=makeRuntime(),launcher=new runtime.Node('button');
  runtime.body.appendChild(launcher);runtime.context.modalLines=['Rule one'];launcher.focus();
  vm.runInContext("showModal('Rules',modalLines,'OK')",runtime.context);
  let modal=runtime.document.querySelector('.modal-backdrop'),card=modal.children[0],buttons=card.querySelectorAll('button');
  check('Rules 单按钮弹层仅安装一个 keydown listener',buttons.length===1&&runtime.document.listenerCount('keydown')===1);
  check('Rules 打开后聚焦唯一按钮',runtime.document.activeElement===buttons[0]);
  const rulesTabPrevented=runtime.document.dispatchKey('Tab');
  check('Rules 单按钮 Tab 阻止默认并保持焦点',rulesTabPrevented===1&&runtime.document.activeElement===buttons[0]);
  const rulesShiftTabPrevented=runtime.document.dispatchKey('Tab',true);
  check('Rules 单按钮 Shift+Tab 阻止默认并保持焦点',rulesShiftTabPrevented===1&&runtime.document.activeElement===buttons[0]);
  runtime.document.dispatchKey('Escape');
  check('Rules Esc 关闭、恢复原焦点并清理监听',!modal.isConnected&&runtime.document.activeElement===launcher&&runtime.document.listenerCount('keydown')===0);

  launcher.focus();vm.runInContext("showModal('Rules',modalLines,'OK')",runtime.context);modal=runtime.document.querySelector('.modal-backdrop');modal.dispatch('click',{target:modal});
  check('Rules 点击背景关闭、恢复原焦点并清理监听',!modal.isConnected&&runtime.document.activeElement===launcher&&runtime.document.listenerCount('keydown')===0);

  launcher.focus();vm.runInContext("showModal('Rules',modalLines,'OK')",runtime.context);modal=runtime.document.querySelector('.modal-backdrop');card=modal.children[0];buttons=card.querySelectorAll('button');buttons[0].dispatch('click',{target:buttons[0]});
  check('Rules 按钮关闭、恢复原焦点并清理监听',!modal.isConnected&&runtime.document.activeElement===launcher&&runtime.document.listenerCount('keydown')===0);
}catch(error){check('Rules modal 动态合同可执行',false,error&&error.stack||String(error));}

try{
  const runtime=makeRuntime(),launcher=new runtime.Node('button'),area=new runtime.Node('div');
  runtime.body.appendChild(launcher);runtime.body.appendChild(area);launcher.focus();
  runtime.context.area=area;runtime.context.restartCount=0;
  vm.runInContext("showVictoryOverlay(area,{winner:0,winnerName:'A',coins:0,onRestart(){restartCount++;},onInvite(){},onShare(){}})",runtime.context);
  let overlay=area.children[0],card=overlay.children.find(node=>String(node.className).includes('victory-card')),buttons=card.querySelectorAll('button');
  check('Victory 使用命名 dialog 与 aria-modal',card.getAttribute('role')==='dialog'&&card.getAttribute('aria-modal')==='true'&&card.getAttribute('aria-label'));
  check('Victory 打开后聚焦主操作',runtime.document.activeElement===buttons[0]&&buttons[0].textContent==='再来一局');
  buttons[buttons.length-1].focus();const tabPrevented=runtime.document.dispatchKey('Tab');
  check('Victory Tab 在末项循环到首项',tabPrevented===1&&runtime.document.activeElement===buttons[0]);
  const shiftPrevented=runtime.document.dispatchKey('Tab',true);
  check('Victory Shift+Tab 在首项循环到末项',shiftPrevented===1&&runtime.document.activeElement===buttons[buttons.length-1]);
  const escapePrevented=runtime.document.dispatchKey('Escape');
  check('Victory Esc 关闭并恢复原焦点',escapePrevented===1&&!overlay.isConnected&&runtime.document.activeElement===launcher&&runtime.document.listenerCount('keydown')===0);

  launcher.focus();vm.runInContext("showVictoryOverlay(area,{winner:0,winnerName:'A',coins:0,onRestart(){restartCount++;}})",runtime.context);
  overlay=area.children[0];overlay.dispatch('click',{target:overlay});
  check('Victory 点击背景关闭并恢复原焦点',!overlay.isConnected&&runtime.document.activeElement===launcher);

  launcher.focus();vm.runInContext("showVictoryOverlay(area,{winner:0,winnerName:'A',coins:0,onRestart(){restartCount++;}})",runtime.context);
  overlay=area.children[0];card=overlay.children.find(node=>String(node.className).includes('victory-card'));buttons=card.querySelectorAll('button');buttons[0].dispatch('click',{target:buttons[0]});
  check('Victory 主操作复用统一关闭生命周期',!overlay.isConnected&&runtime.document.activeElement===launcher&&runtime.context.restartCount===1);

  launcher.focus();vm.runInContext("showVictoryOverlay(area,{winner:0,winnerName:'A',coins:0,podium:[{rank:2,name:'B',color:'#00f'},{rank:1,name:'A',color:'#f00'}],onRestart(){restartCount++;}})",runtime.context);
  overlay=area.children[0];card=overlay.children.find(node=>String(node.className).includes('victory-card'));const podium=card.querySelector('.victory-podium'),podiumRows=podium&&podium.querySelectorAll('.victory-podium-row');
  check('Victory 排名台使用命名有序列表并按真实名次排序',!!podium&&podium.tagName==='OL'&&podium.getAttribute('aria-label')==='比赛排名'&&podiumRows.length===2&&podiumRows[0].getAttribute('data-rank')==='1'&&podiumRows[0].children[1].textContent==='A');
  runtime.document.dispatchKey('Escape');

  launcher.focus();runtime.context.reward={eligible:true,result:'win',participantCount:2,placement:1,breakdown:[],currency:1,xp:8,levelBefore:1,levelAfter:1};
  vm.runInContext('showRewardBreakdown(reward)',runtime.context);
  overlay=runtime.document.querySelector('.reward-breakdown-overlay');card=overlay.children[0];buttons=card.querySelectorAll('button');
  check('Reward 使用命名 dialog 与 aria-modal',card.getAttribute('role')==='dialog'&&card.getAttribute('aria-modal')==='true'&&card.getAttribute('aria-label')==='胜利');
  check('Reward 打开后聚焦关闭按钮',runtime.document.activeElement===buttons[0]&&buttons[0].textContent==='关闭');
  runtime.document.dispatchKey('Escape');
  check('Reward Esc 关闭并恢复原焦点',!overlay.isConnected&&runtime.document.activeElement===launcher&&runtime.document.listenerCount('keydown')===0);

  launcher.focus();vm.runInContext('showRewardBreakdown(reward)',runtime.context);overlay=runtime.document.querySelector('.reward-breakdown-overlay');overlay.dispatch('click',{target:overlay});
  check('Reward 点击背景关闭并恢复原焦点',!overlay.isConnected&&runtime.document.activeElement===launcher&&runtime.document.listenerCount('keydown')===0);
}catch(error){check('Overlay dialog 动态合同可执行',false,error&&error.stack||String(error));}

try{
  const runtime=makeRuntime(),launcher=new runtime.Node('button'),area=new runtime.Node('div');
  runtime.body.appendChild(launcher);runtime.body.appendChild(area);runtime.context.area=area;runtime.context.restartCount=0;launcher.focus();
  vm.runInContext("showVictoryOverlay(area,{winner:0,winnerName:'A',coins:0,onRestart(){restartCount++;}})",runtime.context);
  const first=area.querySelectorAll('.victory-overlay')[0];
  vm.runInContext("showVictoryOverlay(area,{winner:0,winnerName:'B',coins:0,onRestart(){restartCount++;}})",runtime.context);
  const overlays=area.querySelectorAll('.victory-overlay');
  check('Victory 连续创建统一关闭旧 overlay，区域内只保留一个',!first.isConnected&&overlays.length===1&&overlays[0].isConnected);
  check('Victory 连续创建只保留一个 keydown listener',runtime.document.listenerCount('keydown')===1);
}catch(error){check('Victory 连续创建动态合同可执行',false,error&&error.stack||String(error));}

try{
  const runtime=makeRuntime(),launcher=new runtime.Node('button'),area=new runtime.Node('div');
  runtime.body.appendChild(launcher);runtime.body.appendChild(area);runtime.context.area=area;runtime.context.restartCount=0;launcher.focus();
  vm.runInContext("showVictoryOverlay(area,{winner:0,winnerName:'A',coins:0,onRestart(){restartCount++;}})",runtime.context);
  const stale=area.querySelectorAll('.victory-overlay')[0];stale.remove();
  vm.runInContext("showVictoryOverlay(area,{winner:0,winnerName:'B',coins:0,onRestart(){restartCount++;}})",runtime.context);
  const current=area.querySelectorAll('.victory-overlay')[0];
  check('Victory 外部 remove 后新建会回收旧 keydown listener',area.querySelectorAll('.victory-overlay').length===1&&runtime.document.listenerCount('keydown')===1);
  const focusCountBeforeClose=launcher.focusCount;
  runtime.document.dispatchKey('Escape');
  const focusCountAfterClose=launcher.focusCount;
  current.dispatch('click',{target:current});
  check('Victory 统一 close 幂等，不重复恢复焦点或残留监听',!current.isConnected&&runtime.document.activeElement===launcher&&runtime.document.listenerCount('keydown')===0&&focusCountAfterClose===focusCountBeforeClose+1&&launcher.focusCount===focusCountAfterClose);
}catch(error){check('Victory 外部删除与幂等关闭动态合同可执行',false,error&&error.stack||String(error));}

try{
  const runtime=makeRuntime(),launcher=new runtime.Node('button'),parentOverlay=new runtime.Node('div'),parentCard=new runtime.Node('div'),parentClose=new runtime.Node('button');
  runtime.body.appendChild(launcher);launcher.focus();parentCard.appendChild(parentClose);parentOverlay.appendChild(parentCard);runtime.body.appendChild(parentOverlay);
  const parentCloseDialog=runtime.context.setupAccessibleOverlayDialog(parentOverlay,parentCard,parentClose,'Parent');
  const childOverlay=new runtime.Node('div'),childCard=new runtime.Node('div'),childClose=new runtime.Node('button');
  childCard.appendChild(childClose);childOverlay.appendChild(childCard);runtime.body.appendChild(childOverlay);
  const childCloseDialog=runtime.context.setupAccessibleOverlayDialog(childOverlay,childCard,childClose,'Child');
  const firstEsc=runtime.document.dispatchKey('Escape');
  check('嵌套 dialog 首次 Esc 只关闭顶部子层',firstEsc===1&&!childOverlay.isConnected&&parentOverlay.isConnected&&runtime.document.listenerCount('keydown')===1&&runtime.document.activeElement===parentClose);
  const secondEsc=runtime.document.dispatchKey('Escape');
  check('嵌套 dialog 第二次 Esc 再关闭父层并清理监听',secondEsc===1&&!parentOverlay.isConnected&&runtime.document.listenerCount('keydown')===0&&runtime.document.activeElement===launcher);
  parentCloseDialog();childCloseDialog();
}catch(error){check('嵌套 dialog topmost registry 动态合同可执行',false,error&&error.stack||String(error));}

if(fails){console.error('OVERLAY_DIALOG_ACCESSIBILITY_FAILURES='+fails);process.exitCode=1;}else console.log('OVERLAY_DIALOG_ACCESSIBILITY_ALL_PASS');
