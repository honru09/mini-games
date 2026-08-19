'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.join(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const template=read('public/index-template.html');
const shell=read('public/src/core/02-app-shell.js');
const utils=read('public/src/core/01-utils.js');
const roster=read('public/src/ui/07-roster.js');
let fails=0;
function check(name,value,detail){console.log((value?'PASS  ':'FAIL  ')+name+(value||!detail?'':' :: '+detail));if(!value)fails++;}

const slots={header:'game-stage-header',seats:'game-stage-seats',arena:'board-area',command:'game-stage-command',overlay:'game-stage-overlay'};
const viewportMeta=(template.match(/<meta name="viewport" content="([^"]+)">/)||[])[1]||'';
check('Viewport 保留浏览器缩放且沉浸 Shell 仅局部锁滚动',viewportMeta.includes('width=device-width')&&viewportMeta.includes('initial-scale=1')&&!/maximum-scale|user-scalable/i.test(viewportMeta));
for(const [slot,id] of Object.entries(slots)){
  check(`Shell 插槽 ${slot} 唯一且绑定稳定 ID`,(template.match(new RegExp(`id="${id}"`,'g'))||[]).length===1&&new RegExp(`id="${id}"[^>]*data-game-shell-slot="${slot}"|data-game-shell-slot="${slot}"[^>]*id="${id}"`).test(template));
}
check('Seat/Arena/Command 声明显式内部滚动区',['game-stage-seats','board-area','game-stage-command'].every(id=>new RegExp(`id="${id}"[^>]*data-game-scroll-region|data-game-scroll-region[^>]*id="${id}"`).test(template)));
check('Overlay 是空的非交互扩展层',/id="game-stage-overlay"[^>]*><\/div>/.test(template)&&/\.game-stage-overlay\{[^}]*pointer-events:none/.test(template));
check('Stage 使用 fixed 视口、dvh 与四向安全区',/#screen-game\.game-stage\{[^}]*position:fixed[^}]*inset:0[^}]*height:100vh[^}]*height:100dvh[^}]*safe-area-inset-top[^}]*safe-area-inset-right[^}]*safe-area-inset-bottom[^}]*safe-area-inset-left/.test(template));
check('html/body 对局态锁定文档滚动与滚动链',/html\.game-active,body\.game-active\{[^}]*overflow:hidden[^}]*overscroll-behavior:none/.test(template)&&/body\.game-active\{[^}]*position:fixed[^}]*width:100%/.test(template));
check('Game main/Arena/Command 都限制在视口内部',/\.game-stage-main\{[^}]*min-height:0[^}]*overflow:hidden/.test(template)&&/\.game-stage-arena\{[^}]*min-height:0[^}]*overflow:auto[^}]*overscroll-behavior:contain/.test(template)&&/\.game-stage-command\{[^}]*max-height:100%[^}]*overflow:auto[^}]*overscroll-behavior:contain/.test(template));
check('Tetris 七项局内操作在全尺寸保持 44px 触控下限',/\.game-stage-command \.tetris-actions \.btn\{[^}]*min-width:44px[^}]*min-height:44px/.test(template));
check('内部滚动条细化且 Seat Rail 隐藏原生滚动槽',/\.game-stage-arena,\.game-stage-command\{[^}]*scrollbar-width:thin/.test(template)&&/\.game-stage-seats \.player-bar\{scrollbar-width:none\}/.test(template)&&/\.game-stage-seats \.player-bar::-webkit-scrollbar\{display:none\}/.test(template));
check('手机单列与低高度横屏紧凑双列合同存在',/@media\(max-width:720px\)[\s\S]*grid-template-rows:minmax\(0,1fr\) auto/.test(template)&&/@media\(max-height:600px\) and \(orientation:landscape\)[\s\S]*game-stage-main[\s\S]*grid-template-columns:minmax\(0,1fr\) minmax\(210px,280px\)/.test(template));
check('showGame 两分支都进入 Shell 且 showHub/认证退出',((roster.match(/enterImmersiveGameShell\(/g)||[]).length>=2)&&/function showHub\([\s\S]*?exitImmersiveGameShell\(/.test(roster)&&/function requireGhostAuth\([\s\S]*?exitImmersiveGameShell\(/.test(shell));
check('showGame 两分支在隐藏 Hub 前捕获滚动与焦点',((roster.match(/\$\('screen-game'\)\.classList\.remove\('hidden'\);\s*if \(typeof enterImmersiveGameShell[\s\S]{0,180}?\$\('screen-hub'\)\.classList\.add\('hidden'\);/g)||[]).length===2));
check('规则弹层复用统一 dialog、Tab/Esc 与焦点恢复生命周期',/function showModal\([\s\S]*?setupAccessibleOverlayDialog\(bd, card, ok, title\)/.test(utils)&&/function setupAccessibleOverlayDialog\([\s\S]*?setAttribute\('role', 'dialog'\)[\s\S]*?setAttribute\('aria-modal', 'true'\)/.test(utils)&&/function setupAccessibleOverlayDialog\([\s\S]*?previousFocus\.focus\(\{ preventScroll:true \}\)[\s\S]*?event\.key === 'Escape'[\s\S]*?event\.key !== 'Tab'/.test(utils));

const start=shell.indexOf('const GAME_SHELL_SCROLL_KEYS');
const end=shell.indexOf('const GAME_STAGE_FALLBACK_COLORS');
check('Shell 控制器有独立可执行边界',start>=0&&end>start);
const controller=start>=0&&end>start?shell.slice(start,end):'';
check('输入控制器从不停止事件传播',controller&&!/stopPropagation\s*\(/.test(controller));
check('Wheel/Touch 使用可移除非 passive 监听',/addEventListener\('wheel',[^,]+,\{capture:true,passive:false\}\)/.test(controller)&&/addEventListener\('touchmove',[^,]+,\{capture:true,passive:false\}\)/.test(controller)&&/removeEventListener\('wheel'/.test(controller)&&/removeEventListener\('touchmove'/.test(controller));
check('内部事件只构造 active/gameId detail',/ghostgame:shellchange/.test(controller)&&/detail:\{active:!!active,gameId:gameId\?String\(gameId\):null\}/.test(controller));

function classList(){const set=new Set();return {add:(...xs)=>xs.forEach(x=>set.add(x)),remove:(...xs)=>xs.forEach(x=>set.delete(x)),contains:x=>set.has(x),values:()=>[...set]};}
function node(name,parent){
  const attributes={};
  const value={name,parent:parent||null,dataset:{},classList:classList(),isConnected:true,disabled:false,hidden:false,tabIndex:0,scrollHeight:100,clientHeight:100,scrollWidth:100,clientWidth:100,focusCount:0,
    focus(){this.focusCount++;sandbox.document.activeElement=this;},contains(target){for(let cur=target;cur;cur=cur.parent)if(cur===this)return true;return false;},
    closest(selector){for(let cur=this;cur;cur=cur.parent){if(selector==='[data-game-scroll-region]'&&cur.dataset&&Object.prototype.hasOwnProperty.call(cur.dataset,'gameScrollRegion'))return cur;if(selector==='.modal-backdrop'&&cur.classList&&cur.classList.contains('modal-backdrop'))return cur;}return null;},
    setAttribute(k,v){attributes[k]=String(v);},getAttribute(k){return attributes[k]||null;},removeAttribute(k){delete attributes[k];},querySelectorAll(){return this.focusables||[];}};
  return value;
}
const html=node('html'),body=node('body',html),stage=node('stage',body),returnFocus=node('return',body),gameCard=node('game-card',body),first=node('first',stage),last=node('last',stage),scrollRegion=node('scroll',stage),input=node('input',stage),modal=node('modal',body),modalChild=node('modal-child',modal);
modal.classList.add('modal-backdrop');scrollRegion.dataset.gameScrollRegion='';stage.focusables=[first,last];stage.tabIndex=-1;
input.tagName='INPUT';first.tagName=last.tagName=returnFocus.tagName=gameCard.tagName='BUTTON';gameCard.dataset.gameId='gomoku';stage.tagName='SECTION';modalChild.tagName='BUTTON';
const listeners=new Map();const events=[];const scrollCalls=[];
const sandbox={console,Set,Map,Array,Object,String,Number,Math,JSON,
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
  requestAnimationFrame:fn=>{fn();return 1;},
  window:{scrollX:17,scrollY:91,scrollTo:(x,y)=>scrollCalls.push([x,y]),dispatchEvent:event=>events.push(event)},
  document:{body,documentElement:html,activeElement:returnFocus,getElementById:id=>id==='screen-game'?stage:null,querySelector:()=>null,querySelectorAll:selector=>selector==='[data-game-id]'?[gameCard]:[],
    addEventListener(type,fn,options){listeners.set(type,{fn,options});},removeEventListener(type,fn){const row=listeners.get(type);if(row&&row.fn===fn)listeners.delete(type);}}
};
try{
  vm.runInNewContext(controller,sandbox,{filename:'immersive-shell-controller.js'});
  const entered=sandbox.enterImmersiveGameShell('gomoku');
  check('进入保存滚动/焦点并激活 html/body/Stage',entered&&html.classList.contains('game-active')&&body.classList.contains('game-active')&&stage.dataset.shellActive==='true'&&stage.getAttribute('aria-hidden')==='false'&&stage.focusCount===1);
  check('进入只安装一组键盘/滚轮/触摸监听',listeners.size===3&&listeners.has('keydown')&&listeners.has('wheel')&&listeners.has('touchmove'));
  sandbox.enterImmersiveGameShell('gomoku');
  check('重复进入不重复安装监听或覆盖返回焦点',listeners.size===3&&stage.focusCount===1);
  let prevented=0,stopped=0;
  listeners.get('keydown').fn({key:' ',target:stage,preventDefault(){prevented++;},stopPropagation(){stopped++;},shiftKey:false});
  check('Space 只阻止页面默认行为且不停止传播',prevented===1&&stopped===0);
  listeners.get('keydown').fn({key:'ArrowDown',target:input,preventDefault(){prevented++;},stopPropagation(){stopped++;},shiftKey:false});
  check('表单方向键编辑语义让行',prevented===1&&stopped===0);
  sandbox.document.activeElement=last;
  listeners.get('keydown').fn({key:'Tab',target:last,preventDefault(){prevented++;},shiftKey:false});
  check('Tab 在 Shell 尾部循环到首项',sandbox.document.activeElement===first&&prevented===2);
  listeners.get('wheel').fn({target:stage,preventDefault(){prevented++;}});
  listeners.get('wheel').fn({target:scrollRegion,preventDefault(){prevented++;}});
  listeners.get('wheel').fn({target:modalChild,preventDefault(){prevented++;}});
  check('Wheel 锁页面但让行内部滚动区与外部 Modal',prevented===3);
  const exited=sandbox.exitImmersiveGameShell();
  check('退出移除监听/class并恢复 aria/scroll/focus',exited&&listeners.size===0&&!html.classList.contains('game-active')&&!body.classList.contains('game-active')&&stage.getAttribute('aria-hidden')==='true'&&scrollCalls.length===1&&scrollCalls[0][0]===17&&scrollCalls[0][1]===91&&returnFocus.focusCount===1);
  check('Shell change 只广播进入/退出白名单字段',events.length===2&&JSON.stringify(events.map(e=>e.detail))===JSON.stringify([{active:true,gameId:'gomoku'},{active:false,gameId:null}]));
  check('重复退出保持幂等且不二次恢复',sandbox.exitImmersiveGameShell()===false&&scrollCalls.length===1&&returnFocus.focusCount===1);
  html.classList.add('game-active');body.classList.add('game-active');stage.dataset.shellActive='stale';stage.dataset.shellGame='stale';
  sandbox.exitImmersiveGameShell();
  check('状态失同步时重复退出仍清理残留 class 与 Stage 标记',!html.classList.contains('game-active')&&!body.classList.contains('game-active')&&!stage.dataset.shellActive&&!stage.dataset.shellGame&&stage.getAttribute('aria-hidden')==='true');
  sandbox.document.activeElement=returnFocus;returnFocus.isConnected=false;
  sandbox.window.scrollX=0;sandbox.window.scrollY=222;
  sandbox.enterImmersiveGameShell('gomoku');sandbox.exitImmersiveGameShell();
  check('入口按钮已销毁时回退聚焦对应游戏卡片',gameCard.focusCount===1&&sandbox.document.activeElement===gameCard&&scrollCalls.at(-1)[1]===222);
  sandbox.document.activeElement=body;returnFocus.isConnected=true;
  sandbox.enterImmersiveGameShell('gomoku');sandbox.exitImmersiveGameShell();
  check('入口弹层销毁后 Body 焦点回退对应游戏卡片',gameCard.focusCount===2&&sandbox.document.activeElement===gameCard);
}catch(error){check('Shell 控制器运行时合同可执行',false,error&&error.stack||String(error));}

try{
  const degradedStage=node('degraded-stage');degradedStage.tabIndex=-1;
  const degradedHtml=node('degraded-html'),degradedBody=node('degraded-body',degradedHtml);
  const degraded={console,Set,Map,Array,Object,String,Number,Math,JSON,requestAnimationFrame:fn=>fn(),window:{scrollX:0,scrollY:0,scrollTo(){}},document:{body:degradedBody,documentElement:degradedHtml,activeElement:null,getElementById:id=>id==='screen-game'?degradedStage:null}};
  vm.runInNewContext(controller,degraded,{filename:'immersive-shell-degraded.js'});
  check('精简 DOM 缺少事件 API 时仍可进入和退出',degraded.enterImmersiveGameShell('gomoku')===true&&degraded.exitImmersiveGameShell()===true);
}catch(error){check('精简 DOM 能力降级不阻塞开局',false,error&&error.stack||String(error));}

if(fails){console.error('IMMERSIVE_GAME_SHELL_FAILURES='+fails);process.exitCode=1;}else console.log('IMMERSIVE_GAME_SHELL_ALL_PASS');
