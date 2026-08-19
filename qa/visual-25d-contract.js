'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const files = {
  depth:read('public/src/core/23-depth-scene.js'),
  camera:read('public/src/core/25-camera-system.js'),
  mascot:read('public/src/core/26-ghost-mascot-motion.js'),
  transition:read('public/src/core/27-page-transition.js'),
  stage:read('public/src/core/28-game-stage-2_5d.js'),
  adapter:read('public/depth-motion-entry.js'),
  gomoku:read('public/src/games/gomoku.js'),
  template:read('public/index-template.html'),
  build:read('scripts/build.js'),
};

assert.match(files.depth, /const STORAGE_KEY = 'mg_visual_25d_v1'/);
assert.match(files.depth, /background:Object\.freeze\(\{ z:-40, parallax:\.12, blur:2 \}\)/);
assert.match(files.depth, /midground:Object\.freeze\(\{ z:0, parallax:\.35, blur:0 \}\)/);
assert.match(files.depth, /foreground:Object\.freeze\(\{ z:28, parallax:\.7, blur:0 \}\)/);
assert.match(files.depth, /getItem\(STORAGE_KEY\) !== '0'/,
  '2.5D is the production default and exact zero provides a static rollback');
assert.match(files.depth, /cardCleanups = new Map\(\)/);
assert.match(files.depth, /removeEventListener\('pointermove',move\)/);
assert.match(files.depth, /prefers-reduced-motion: reduce/);
assert.match(files.depth, /function destroy\(\)/);

for (const mode of ['overview','hover','enter','active','focus','impact','result','exit']) {
  assert.match(files.camera, new RegExp("['\"]" + mode + "['\"]"), 'camera mode missing: ' + mode);
}
assert.match(files.camera, /const PRESETS=Object\.freeze/);
assert.match(files.camera, /onReducedChange/);
assert.match(files.camera, /removeEventListener\('change',onReducedChange\)/);
assert.match(files.transition, /clearTimeout\(activeTimer\)/);
assert.match(files.transition, /clearTimeout\(resetTimer\)/);
assert.match(files.transition, /removeEventListener\('pointerdown',capture,true\)/);
assert.match(files.mascot, /requestAnimationFrame\(renderGaze\)/,
  'pointer gaze must be frame-batched rather than allocate a tween for every event');
assert.match(files.mascot, /if\(!target\|\|!enabled\(\)\|\|reduced\(\)\)return null/,
  'disabled and reduced-motion modes must not create a mascot flight');
assert.match(files.mascot, /function destroy\(\)/);

assert.match(files.adapter, /vendor\/gsap\/3\.15\.0\/esm\/index\.js/);
assert.match(files.adapter, /gsap\.timeline\(\{defaults:\{overwrite:'auto'\}/);
assert.match(files.adapter, /autoAlpha/);
assert.match(files.adapter, /timeline\.kill\(\)/);
assert.match(files.adapter, /function dispose\(\)/);
assert.doesNotMatch(files.adapter, /ScrollTrigger|\.to\([^\n]+\{[^\n]*(?:top|left|width|height):/,
  'the camera adapter must stay timeline-only and animate compositor properties');

assert.match(files.gomoku, /emitGameStage25DEvent\(\{type:'piece_landed',game:'gomoku'/);
assert.match(files.gomoku, /emitGameStage25DEvent\(\{type:'result',game:'gomoku'/);
assert.doesNotMatch(files.gomoku, /CameraSystem25D\.(?:to|focus|shake)/,
  'gameplay may emit semantic presentation facts but may not choreograph the camera');
assert.match(files.stage, /event\.type==='piece_landed'&&event\.game==='gomoku'/);
assert.match(files.stage, /\.gomoku-wave-b-board-frame,\.gomoku-board/);

for (const relative of [
  'server', 'shared', 'public/src/online', 'public/src/shop',
]) {
  const pending = [path.join(ROOT, relative)];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes:true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (/\.(?:js|json|sql)$/.test(entry.name)) {
        assert.doesNotMatch(fs.readFileSync(target, 'utf8'), /CameraSystem25D|GameStage25D|mg_visual_25d_v1/,
          path.relative(ROOT, target) + ' must stay outside the presentation camera layer');
      }
    }
  }
}

for (const moduleName of [
  'core/23-depth-scene.js', 'core/25-camera-system.js', 'core/26-ghost-mascot-motion.js',
  'core/27-page-transition.js', 'core/28-game-stage-2_5d.js',
]) assert.ok(files.build.includes(moduleName), 'build order is missing ' + moduleName);
assert.doesNotMatch([files.depth,files.camera,files.mascot,files.transition,files.stage,files.adapter].join('\n'),
  /three(?:\.module)?\.js|THREE\b|Ghost3DHost/,
  'the production 2.5D layer must not depend on Three or Ghost3D');

function classList(initial) {
  const values = new Set(initial || []);
  return {
    add(...names){ names.forEach(name => values.add(name)); },
    remove(...names){ names.forEach(name => values.delete(name)); },
    toggle(name, force){ if(force === undefined ? !values.has(name) : force) values.add(name); else values.delete(name); },
    contains(name){ return values.has(name); },
  };
}
function style() {
  const values = new Map();
  return {
    setProperty(name,value){ values.set(name,String(value)); },
    removeProperty(name){ values.delete(name); },
    getPropertyValue(name){ return values.get(name) || ''; },
  };
}
function node(classes) {
  const listeners = new Map();
  return {
    nodeType:1, dataset:{}, classList:classList(classes), style:style(), isConnected:true, children:[],
    addEventListener(name,handler){ if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(handler); },
    removeEventListener(name,handler){ const set=listeners.get(name);if(set)set.delete(handler); },
    emit(name,event){ const set=listeners.get(name);if(set)for(const handler of [...set])handler(event||{}); },
    listenerCount(){ return [...listeners.values()].reduce((sum,set)=>sum+set.size,0); },
    getBoundingClientRect(){ return {left:0,top:0,width:200,height:120}; },
    appendChild(child){ child.parentNode=this;child.isConnected=true;this.children.push(child);return child; },
    remove(){ this.isConnected=false;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this); },
    setAttribute(name,value){ this[name]=String(value); },
  };
}
function scheduler() {
  let id=0;const tasks=new Map();
  return {
    set(callback){ const key=++id;tasks.set(key,callback);return key; },
    clear(key){ tasks.delete(key); },
    flush(){ const batch=[...tasks.values()];tasks.clear();batch.forEach(callback=>callback()); },
    get size(){ return tasks.size; },
  };
}

function depthRuntime(setting) {
  const rootNode=node(),card=node(['game-card']),ambient=node(),hero=node(),stage=node();
  const far=node(),mid=node(),front=node();
  const raf=scheduler(),rootListeners=new Map(),mediaListeners=new Set();
  const document={
    readyState:'complete',documentElement:rootNode,
    getElementById(id){return { 'ambient-scene':ambient,'hero-banner':hero,'screen-game':stage }[id]||null;},
    querySelectorAll(selector){if(selector.includes('.game-card'))return[card];if(selector.includes('platform-scene-far'))return[far];if(selector.includes('platform-scene-mid'))return[mid];if(selector.includes('platform-scene-foreground'))return[front];return[];},
  };
  const context={console,document,innerWidth:1000,innerHeight:800,localStorage:{getItem(){return setting;},setItem(_key,value){setting=value;}},
    requestAnimationFrame:callback=>raf.set(callback),cancelAnimationFrame:id=>raf.clear(id),
    matchMedia(){return{matches:false,addEventListener(_name,fn){mediaListeners.add(fn);},removeEventListener(_name,fn){mediaListeners.delete(fn);}};},
    addEventListener(name,fn){if(!rootListeners.has(name))rootListeners.set(name,new Set());rootListeners.get(name).add(fn);},
    removeEventListener(name,fn){const set=rootListeners.get(name);if(set)set.delete(fn);},
  };
  context.globalThis=context;vm.runInContext(files.depth,vm.createContext(context));
  return {context,api:context.DepthScene25D,rootNode,card,raf,rootListeners,mediaListeners};
}

const depth=depthRuntime(null);
assert.strictEqual(depth.api.isEnabled(),true);
assert.ok(Object.isFrozen(depth.api.DEPTH)&&Object.isFrozen(depth.api.DEPTH.background));
assert.ok(depth.rootNode.classList.contains('visual-25d')&&depth.card.classList.contains('depth-card25d'));
depth.card.emit('pointerenter',{pointerType:'mouse'});
depth.card.emit('pointermove',{pointerType:'mouse',clientX:180,clientY:20});
depth.raf.flush();
assert.ok(depth.card.classList.contains('depth-card25d-active'));
assert.notStrictEqual(depth.card.style.getPropertyValue('--depth-card-ry'),'0deg');
const disabled=depth.api.setEnabled(false);
assert.strictEqual(disabled.enabled,false);
assert.ok(!depth.rootNode.classList.contains('visual-25d')&&!depth.card.classList.contains('depth-card25d'));
depth.api.destroy();
assert.strictEqual(depth.card.listenerCount(),0);
assert.strictEqual(depth.mediaListeners.size,0);

function cameraRuntime() {
  const mediaListeners=new Set(),events=[],stage=node(),target=node();
  const context={console,document:{getElementById(id){return id==='screen-game'?stage:null;}},CustomEvent:function(type,init){this.type=type;this.detail=init.detail;},
    dispatchEvent(event){events.push(event);},DepthScene25D:{isEnabled(){return true;}},
    matchMedia(){return{matches:true,addEventListener(_name,fn){mediaListeners.add(fn);},removeEventListener(_name,fn){mediaListeners.delete(fn);}};},
  };
  context.globalThis=context;vm.runInContext(files.camera,vm.createContext(context));
  return {context,api:context.CameraSystem25D,target,stage,events,mediaListeners};
}
const camera=cameraRuntime();
for(const mode of camera.api.MODES){
  const result=camera.api.to(mode,{target:camera.target,focus:mode});
  assert.strictEqual(result.status,'static');
  assert.strictEqual(camera.api.snapshot().mode,mode);
}
assert.strictEqual(camera.target.dataset.camera25dMode,'exit');
assert.ok(camera.events.length===8);
camera.api.destroy();
assert.strictEqual(camera.api.snapshot().destroyed,true);
assert.strictEqual(camera.mediaListeners.size,0);

function stageRuntime() {
  const timers=scheduler(),surface=node(),area=node();area.querySelector=()=>surface;
  const cameraCalls=[],mascotCalls=[],pageCalls=[];
  const context={console,Date,document:{getElementById(id){return id==='board-area'?area:null;},createElement(){return node();}},
    setTimeout:callback=>timers.set(callback),clearTimeout:id=>timers.clear(id),
    CameraSystem25D:{shake(value){cameraCalls.push(['shake',value]);},to(mode,value){cameraCalls.push([mode,value]);}},
    GhostMascot25D:{result(value){mascotCalls.push(value);}},PageTransition25D:{exitGame(){pageCalls.push('exit');}},
  };
  context.globalThis=context;vm.runInContext(files.stage,vm.createContext(context));
  return {api:context.GameStage25D,surface,timers,cameraCalls,mascotCalls,pageCalls};
}
const stageRuntimeValue=stageRuntime();
assert.strictEqual(stageRuntimeValue.api.emit({type:'piece_landed',game:'gomoku',row:7,col:8,size:15}),true);
assert.strictEqual(stageRuntimeValue.surface.children.length,1);
assert.strictEqual(stageRuntimeValue.cameraCalls[0][0],'shake');
assert.strictEqual(stageRuntimeValue.api.emit({type:'result',game:'gomoku',outcome:'win'}),true);
assert.deepStrictEqual(stageRuntimeValue.mascotCalls,['win']);
assert.strictEqual(stageRuntimeValue.api.emit({type:'exit',game:'gomoku'}),true);
assert.deepStrictEqual(stageRuntimeValue.pageCalls,['exit']);
stageRuntimeValue.api.clear();
assert.strictEqual(stageRuntimeValue.timers.size,0);

console.log('VISUAL_25D_CONTRACT_ALL_PASS depth=3 camera=8 renderer=dom-css-canvas gsap=timeline fallback=static');
