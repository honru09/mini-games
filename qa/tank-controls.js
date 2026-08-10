/* Tank Controls P0：摇杆、D-pad、独立开火和输入释放专项合同。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tank.js'), 'utf8');
const template = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const failures = [];
function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}
function makeElement(tag){
  const classes = new Set();
  const node = { tagName:String(tag || 'div').toUpperCase(), children:[], parent:null, style:{}, dataset:{}, attributes:{}, textContent:'', disabled:false, _listeners:{}, _html:'', clientWidth:560, clientHeight:560,
    appendChild(child){ if(child){ child.parent=this; this.children.push(child); } return child; },
    remove(){ if(!this.parent)return; const index=this.parent.children.indexOf(this); if(index>=0)this.parent.children.splice(index,1); },
    setAttribute(key,value){ this.attributes[key]=String(value); }, getAttribute(key){ return this.attributes[key]; }, removeAttribute(key){ delete this.attributes[key]; },
    addEventListener(type,fn){ (this._listeners[type]=this._listeners[type]||[]).push(fn); },
    removeEventListener(type,fn){ if(!this._listeners[type])return; this._listeners[type]=fn?this._listeners[type].filter(item=>item!==fn):[]; },
    dispatch(type,event){ const payload=event||{}; if(payload.target===undefined)payload.target=this; (this._listeners[type]||[]).slice().forEach(fn=>fn(payload)); },
    setPointerCapture(pointerId){ this._capturedPointer=pointerId; }, releasePointerCapture(pointerId){ if(this._capturedPointer===pointerId)this._capturedPointer=null; },
    getBoundingClientRect(){ return {left:0,top:0,width:200,height:200}; },
    querySelector(selector){ return query(this,selector,false); }, querySelectorAll(selector){ return query(this,selector,true); },
  };
  Object.defineProperty(node,'innerHTML',{get(){return node._html;},set(value){node._html=String(value);node.children=[];}});
  Object.defineProperty(node,'className',{get(){return [...classes].join(' ');},set(value){classes.clear();String(value||'').split(/\s+/).filter(Boolean).forEach(item=>classes.add(item));}});
  node.classList={add:(...values)=>values.forEach(value=>classes.add(value)),remove:(...values)=>values.forEach(value=>classes.delete(value)),contains:value=>classes.has(value),toggle:(value,force)=>{const next=force===undefined?!classes.has(value):!!force;if(next)classes.add(value);else classes.delete(value);return next;}};
  return node;
}
function query(root,selector,all){
  const found=[], queue=(root.children||[]).slice();
  while(queue.length){ const node=queue.shift(); if(selector[0]==='.' && node.classList && node.classList.contains(selector.slice(1))){ if(!all)return node; found.push(node); } queue.push(...(node.children||[])); }
  return all ? found : null;
}
function harness(){
  const area=makeElement('div'), extra=makeElement('div'), body=makeElement('body'), docListeners={}, windowListeners={};
  const document={body,visibilityState:'visible',createElement:makeElement,getElementById:()=>null,querySelectorAll:()=>[],addEventListener(type,fn){(docListeners[type]=docListeners[type]||[]).push(fn);},removeEventListener(type,fn){if(!docListeners[type])return;docListeners[type]=fn?docListeners[type].filter(item=>item!==fn):[];},dispatch(type,event){(docListeners[type]||[]).slice().forEach(fn=>fn(event||{}));}};
  const window={matchMedia:()=>({matches:false}),addEventListener(type,fn){(windowListeners[type]=windowListeners[type]||[]).push(fn);},removeEventListener(type,fn){if(!windowListeners[type])return;windowListeners[type]=fn?windowListeners[type].filter(item=>item!==fn):[];},dispatch(type,event){(windowListeners[type]||[]).slice().forEach(fn=>fn(event||{}));}};
  const sandbox={console,JSON,Date,Map,Set,Array,Number,String,Boolean,Object,Math,document,window,navigator:{maxTouchPoints:2},location:{protocol:'http:',host:'localhost'},setTimeout,clearTimeout,setInterval,clearInterval,__area:area,__extra:extra};
  const context=vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'public','src','core','01-utils.js'),'utf8'),context,{filename:'01-utils.js'});
  vm.runInContext(`function t(key,...args){return String(key)+(args.length?'('+args.join(',')+')':'');} function renderPlayers(){} function setStatus(){} function tabletopArtEnabled(){return true;} function markTabletopSurface(){} function triggerHonruGameReaction(){}`,context);
  vm.runInContext(source,context,{filename:'tank.js'});
  const opts={ai:new Set(),onEnd(){},sendMove(){},sendRestart(){},isReplaying(){return false;},online:false,myIdx:0,isHost:true}; context.__opts=opts;
  const game=vm.runInContext('gameTank(__area,__extra,2,__opts)',context);
  return {area,extra,document,window,game};
}

check('源码不使用 stopPropagation 破坏 Game Shell 事件传播', !/stopPropagation\s*\(/.test(source));
check('源码实现 Pointer Capture 与丢失捕获释放', /setPointerCapture/.test(source) && /lostpointercapture/.test(source));
check('源码实现 blur/visibility/destroy 统一清理', /onWindowBlur/.test(source) && /visibilitychange/.test(source) && /releaseAllControls/.test(source) && /removeEventListener/.test(source));
check('模板提供八方向摇杆、D-pad、独立开火与安全区样式', ['tank-control-deck','tank-joystick-knob','tank-dpad-button','tank-fire','safe-area-inset-bottom'].every(token=>template.includes(token)));

const h=harness(), joystick=h.extra.querySelector('.tank-joystick'), fire=h.extra.querySelector('.tank-fire'), dpadRight=h.extra.querySelector('.tank-dpad-right');
joystick.dispatch('pointerdown',{pointerId:1,clientX:190,clientY:100,buttons:1,preventDefault(){}});
check('摇杆主方向映射为向右', h.game.snapshot().tanks[0].input.right===true && h.game.snapshot().tanks[0].input.up===false);
joystick.dispatch('pointermove',{pointerId:1,clientX:190,clientY:10,buttons:1});
check('摇杆斜向映射为上+右且有方向反馈', h.game.snapshot().tanks[0].input.right===true && h.game.snapshot().tanks[0].input.up===true && joystick.dataset.direction==='upright' && joystick.querySelector('.tank-joystick-knob').style.transform);
joystick.dispatch('pointerup',{pointerId:1});
check('摇杆释放回中并清除移动', Object.values(h.game.snapshot().tanks[0].input).every(value=>value===false));

fire.dispatch('pointerdown',{pointerId:2,preventDefault(){}});
joystick.dispatch('pointerdown',{pointerId:3,clientX:190,clientY:100,buttons:1,preventDefault(){}});
joystick.dispatch('pointerup',{pointerId:3});
check('独立开火不被摇杆释放清除', h.game.snapshot().tanks[0].input.fire===true && h.game.snapshot().tanks[0].input.right===false);
fire.dispatch('pointerup',{pointerId:2});
check('开火指针释放后停止', h.game.snapshot().tanks[0].input.fire===false);

dpadRight.dispatch('pointerdown',{pointerId:4,preventDefault(){}});
check('D-pad 按住可移动', h.game.snapshot().tanks[0].input.right===true);
dpadRight.dispatch('pointerup',{pointerId:4});
check('D-pad 释放可停下', h.game.snapshot().tanks[0].input.right===false);

h.document.dispatch('keydown',{key:'d',preventDefault(){}});
h.document.dispatch('keydown',{key:' ',preventDefault(){}});
check('键盘方向与 Space 可同时输入', h.game.snapshot().tanks[0].input.right===true && h.game.snapshot().tanks[0].input.fire===true);
h.window.dispatch('blur');
check('窗口失焦清除所有输入', Object.values(h.game.snapshot().tanks[0].input).every(value=>value===false));
h.document.visibilityState='hidden'; h.document.dispatch('visibilitychange');
check('页面隐藏保持中性输入', Object.values(h.game.snapshot().tanks[0].input).every(value=>value===false));
h.game.destroy();
check('销毁后重复失焦不抛异常且输入保持中性', (()=>{try{h.window.dispatch('blur');return Object.values(h.game.snapshot().tanks[0].input).every(value=>value===false);}catch{return false;}})());

if(failures.length){console.error('TANK_CONTROLS_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('TANK_CONTROLS_ALL_PASS');
