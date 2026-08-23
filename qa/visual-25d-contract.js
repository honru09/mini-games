'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const { readPresentationSource } = require('./presentation-source');
const files = {
  depth:read('public/src/core/23-depth-scene.js'),
  camera:read('public/src/core/25-camera-system.js'),
  mascot:read('public/src/core/26-ghost-mascot-motion.js'),
  transition:read('public/src/core/27-page-transition.js'),
  stage:read('public/src/core/28-game-stage-2_5d.js'),
  adapter:read('public/depth-motion-entry.js'),
  gomoku:read('public/src/games/gomoku.js'),
  ludo:read('public/src/games/ludo.js'),
  monopoly:read('public/src/games/monopoly.js'),
  xiangqi:read('public/src/games/xiangqi.js'),
  tetris:read('public/src/games/tetris.js'),
  tank:read('public/src/games/tank.js'),
  template:readPresentationSource(),
  build:read('scripts/build.js'),
};

assert.match(files.depth, /const STORAGE_KEY = 'mg_visual_25d_v1'/);
assert.match(files.depth, /background:Object\.freeze\(\{ z:-40, parallax:0, blur:0 \}\)/);
assert.match(files.depth, /midground:Object\.freeze\(\{ z:0, parallax:0, blur:0 \}\)/);
assert.match(files.depth, /foreground:Object\.freeze\(\{ z:28, parallax:0, blur:0 \}\)/);
assert.match(files.depth, /getItem\(STORAGE_KEY\) !== '0'/,
  '2.5D is the production default and exact zero provides a static rollback');
assert.match(files.depth, /cardCleanups = new Map\(\)/);
assert.doesNotMatch(files.depth, /pointermove|onGlobalPointer/,
  'global and per-card pointer tracking stay retired; CameraSystem owns semantic motion');
assert.match(files.template, /\.platform-scene-layer\{[^}]*display:none!important/,
  'the original ambient cloud/star theme must remain the platform background');
assert.match(files.template, /\.ambient-stars-b\{[^}]*animation:ghostStarTravel 20s linear infinite;/,
  'both dark-theme star fields travel outward in the same direction');
assert.doesNotMatch(files.template, /\.ambient-stars-b\{[^}]*animation:[^}]*reverse/,
  'the secondary star field must not reverse against the forward-travel view');
assert.match(files.template, /html\.visual-25d \[data-depth-layer="background"\][\s\S]{0,240}translate:0 0!important;filter:none!important/,
  'ambient layers stay crisp and do not follow the pointer');
assert.match(files.depth, /prefers-reduced-motion: reduce/);
assert.match(files.depth, /function destroy\(\)/);

for (const mode of ['overview','hover','enter','active','focus','impact','result','exit']) {
  assert.match(files.camera, new RegExp("['\"]" + mode + "['\"]"), 'camera mode missing: ' + mode);
}
assert.match(files.camera, /const PRESETS=Object\.freeze/);
assert.match(files.camera, /onReducedChange/);
assert.match(files.camera, /removeEventListener\('change',onReducedChange\)/);
assert.match(files.camera, /if\(destroyed\)\{try\{if\(created&&created\.dispose\)created\.dispose\(\)/,
  'a lazy adapter resolving after camera destroy must dispose itself instead of leaking');
assert.match(files.camera, /reduced\(\)\|\|hidden\(\)\|\|!root\.DepthScene25D/,
  'late timers may update static camera state while hidden but must not restart GSAP');
assert.match(files.camera, /direction:request\.direction/,
  'semantic impact direction must reach the lazy GSAP adapter');
assert.match(files.transition, /clearTimeout\(activeTimer\)/);
assert.match(files.transition, /clearTimeout\(resetTimer\)/);
assert.match(files.transition, /removeEventListener\('pointerdown',capture,true\)/);
assert.match(files.transition, /function animated\(\)\{return enabled\(\)&&!reduced\(\);\}/);
assert.match(files.transition, /setTimeout\(settle,720\)/,
  'the active camera may replace entry only after the mascot flight timeline completes');
assert.match(files.transition, /setTimeout\(finish,480\)/,
  'the overview camera may replace exit only after the exit timeline completes');
assert.match(files.transition, /if\(resetTimer\)\{pendingRoute=/,
  'a route commit during exit must defer overview instead of killing the exit timeline');
assert.match(files.transition, /if\(resetTimer\)clearTimeout\(resetTimer\);activeTimer=null;resetTimer=null/,
  'a rapid re-entry must cancel the previous exit completion');
assert.doesNotMatch(files.mascot, /(?:document|root)\.addEventListener\(['"]pointer(?:move|leave)['"]/,
  'Honru spatial guide must not install a global pointer tracking listener');
assert.match(files.mascot, /host\.addEventListener\('pointermove',onMove/,
  'Honru gaze may track pointer movement only on its local mascot host');
assert.match(files.mascot, /host\.addEventListener\('pointerleave',onLeave/,
  'Honru gaze must reset when the local mascot host is left');
assert.match(files.mascot, /host\.removeEventListener\('pointermove',onMove\)/,
  'Honru local pointer movement listener must be cleaned up');
assert.match(files.mascot, /host\.removeEventListener\('pointerleave',onLeave\)/,
  'Honru local pointer leave listener must be cleaned up');
assert.match(files.mascot, /if\(!target\|\|!enabled\(\)\|\|reduced\(\)\)return null/,
  'disabled and reduced-motion modes must not create a mascot flight');
assert.match(files.mascot, /function destroy\(\)/);
assert.match(files.mascot, /const next=card&&card\.nodeType===1\?card:null/);
assert.match(files.mascot, /if\(next===selectedCard\)\{/,
  'reselecting the same card must preserve the already visible selected object');

assert.match(files.adapter, /vendor\/gsap\/3\.15\.0\/esm\/index\.js/);
assert.match(files.adapter, /gsap\.timeline\(\{defaults:\{overwrite:'auto'\}/);
assert.match(files.adapter, /autoAlpha/);
assert.match(files.adapter, /adapter:'depth-motion-25d-v3'/);
assert.match(files.adapter, /willChange:'transform,opacity'/,
  'only active camera targets should receive a temporary compositor hint');
assert.match(files.adapter, /direction=Number\(request\.direction\)<0\?-1:1/);
assert.match(files.adapter, /addLabel\('impact',0\)/);
const impactAdapterSource=(files.adapter.match(/else if\(mode==='impact'\)\{([\s\S]*?)\}\s*else if\(mode==='focus'\)/)||[])[1]||'';
assert.match(impactAdapterSource, /scale:pulse/,
  'accepted-action impact keeps a bounded scale pulse');
assert.doesNotMatch(impactAdapterSource, /\bx:|\by:|rotation:/,
  'accepted-action impact must not laterally shake or rotate the live input surface');
assert.match(files.adapter, /timeline\.kill\(\)/);
assert.match(files.adapter, /function dispose\(\)/);
assert.doesNotMatch(files.adapter, /ScrollTrigger|\.to\([^\n]+\{[^\n]*(?:top|left|width|height):/,
  'the camera adapter must stay timeline-only and animate compositor properties');

assert.match(files.gomoku, /emitGameStage25DEvent\(\s*\{\s*type:'piece_landed',game:'gomoku'/);
assert.match(files.gomoku, /emitGameStage25DEvent\(\{type:'result',game:'gomoku'/);
assert.doesNotMatch(files.gomoku, /CameraSystem25D\.(?:to|focus|shake)/,
  'gameplay may emit semantic presentation facts but may not choreograph the camera');
assert.match(files.stage, /event\.type==='piece_landed'&&event\.game==='gomoku'/);
assert.match(files.stage, /\.gomoku-wave-b-board-frame,\.gomoku-board/);
for (const [game, phases, source] of [
  ['ludo', ['move','capture','ranking'], files.ludo],
  ['monopoly', ['walk','land','terminal'], files.monopoly],
  ['xiangqi', ['move','capture','terminal'], files.xiangqi],
  ['tetris', ['lock','line-clear','terminal'], files.tetris],
  ['tank', ['fire','hit','terminal'], files.tank],
]) {
  assert.match(source, new RegExp("emitGameStage25DEvent\\(\\{type:'phase',game:'" + game + "'"), game + ' must emit semantic phase events');
  phases.forEach(phase => assert.match(files.stage, new RegExp("['\"]" + phase + "['\"]"), 'shared phase vocabulary missing: ' + phase));
}
assert.match(files.stage, /event\.type==='phase'\|\|event\.type==='motion'/);
assert.match(files.stage, /const IMPACT_PHASES=new Set/);
assert.match(files.stage, /const FX_PROFILES=Object\.freeze/);
for (const kind of ['ring','sweep','burst','lift','slash','focus','spin','result']) {
  assert.match(files.stage, new RegExp("kind:'" + kind + "'"), 'shared 2.5D FX kind missing: ' + kind);
}
assert.match(files.stage, /effectCount\(kind,isReduced\)/);
assert.match(files.stage, /root\.innerWidth<=640/,
  'compact screens must use a lower bounded effect count');
assert.match(files.stage, /duration:isReduced\?\.08:\.18/);
assert.match(files.stage, /document\.addEventListener\('visibilitychange',onVisibilityChange\)/);
assert.match(files.stage, /document\.removeEventListener\('visibilitychange',onVisibilityChange\)/);
assert.match(files.stage, /if\(mode==='impact'\)\{[\s\S]{0,180}cameraTo\('impact'/,
  'impact events must issue one non-displacing semantic impact request');
assert.doesNotMatch(files.stage, /CameraSystem25D\.shake/,
  'routine accepted actions must not move the live board through the legacy shake helper');
assert.match(files.stage, /recoveryTimer=setTimeout\([^\n]+CameraSystem25D\.to\('active'/,
  'non-Gomoku impact must recover to active through one cancellable presentation timer');
assert.match(files.stage, /if\(mode==='result'\)clear\(\);else\{cancelRecovery\(\);clearEffect\(\);clearPhaseState\(\);\}/,
  'every newer phase must cancel an older impact recovery before issuing its camera request');
assert.match(files.stage, /\.monopoly-wave-b-board-frame,\.monopoly-wave-b-board,\.m-board/,
  'Monopoly camera must target a real board node instead of falling back to the whole board area');
assert.match(files.stage, /if\(event\.type==='result'\)\{\s*clear\(\)/,
  'result must cancel a pending landing recovery before it can restore active camera state');
assert.doesNotMatch(files.stage, /lastPhaseKey/,
  'the shared bridge must not permanently deduplicate legitimate repeated phase events');
assert.match(files.stage, /GhostMascot25D\.result\([^\n]+\{camera:false\}\)/,
  'GameStage owns the result camera request and must suppress the mascot duplicate');
assert.match(files.template, /\.game-phase-fx25d\{/);
assert.match(files.template, /contain:layout paint/);
assert.match(files.template, /@media\(prefers-reduced-motion:reduce\)[\s\S]*\.game-phase-fx25d-ray,\.game-phase-fx25d-particle\{display:none\}/);
assert.match(files.template, /@media\(forced-colors:active\)[\s\S]*\.game-phase-fx25d/);
assert.match(files.ludo, /pids\[viewerIndex\] === winner \? 'win' : 'loss'/);
for (const source of [files.monopoly,files.xiangqi,files.tetris,files.tank]) {
  assert.match(source, /winner===\w+(?:\(\))?\?'win':'loss'/,
    'terminal mascot state must be derived from the local viewer rather than always celebrate');
}
assert.match(files.monopoly, /incomingTerminal&&!wasOver&&!reconnectGeneration&&!explicitNewMatch\)emitMonopolyTerminal25D\(\)/,
  'the first accepted live Monopoly authority terminal must publish its result camera');
assert.match(files.xiangqi, /setXiangqiWaveCProcess\(over \? 'terminal'[^\n]+false\)/);
assert.match(files.xiangqi, /value\.terminal&&!wasOver\)emitXiangqiStage25D\('terminal'/);
assert.match(files.tetris, /observeTetrisWaveCStates\(true,false\)/,
  'Tetris restore and viewer reconciliation must remain static');
assert.match(files.tank, /setTankWaveCProcess\(over \? 'terminal' : 'ready', cur, false\)/);
assert.match(files.tank, /commitFinal\(finalOrder,false,!replaying\)/,
  'Tank replay reconciliation must not replay a result camera');
assert.match(files.depth, /settleCamera\(enabled\?'reduced_motion':'depth_disabled'\)/);
assert.match(files.depth, /settleCamera\('document_hidden'\)/);
assert.match(files.depth, /removeEventListener\('visibilitychange',onVisibilityChange\)/);

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
  const raf=scheduler(),rootListeners=new Map(),documentListeners=new Map(),mediaListeners=new Set(),cameraSettles=[];
  const document={
    readyState:'complete',hidden:false,documentElement:rootNode,
    getElementById(id){return { 'ambient-scene':ambient,'hero-banner':hero,'screen-game':stage }[id]||null;},
    querySelectorAll(selector){if(selector.includes('.game-card'))return[card];if(selector.includes('platform-scene-far'))return[far];if(selector.includes('platform-scene-mid'))return[mid];if(selector.includes('platform-scene-foreground'))return[front];return[];},
    addEventListener(name,fn){if(!documentListeners.has(name))documentListeners.set(name,new Set());documentListeners.get(name).add(fn);},
    removeEventListener(name,fn){const set=documentListeners.get(name);if(set)set.delete(fn);},
    emit(name){const set=documentListeners.get(name);if(set)for(const fn of [...set])fn();},
  };
  const context={console,document,innerWidth:1000,innerHeight:800,localStorage:{getItem(){return setting;},setItem(_key,value){setting=value;}},
    requestAnimationFrame:callback=>raf.set(callback),cancelAnimationFrame:id=>raf.clear(id),
    CameraSystem25D:{settle(reason){cameraSettles.push(reason);}},
    matchMedia(){return{matches:false,addEventListener(_name,fn){mediaListeners.add(fn);},removeEventListener(_name,fn){mediaListeners.delete(fn);}};},
    addEventListener(name,fn){if(!rootListeners.has(name))rootListeners.set(name,new Set());rootListeners.get(name).add(fn);},
    removeEventListener(name,fn){const set=rootListeners.get(name);if(set)set.delete(fn);},
  };
  context.globalThis=context;vm.runInContext(files.depth,vm.createContext(context));
  return {context,api:context.DepthScene25D,rootNode,card,raf,rootListeners,documentListeners,mediaListeners,cameraSettles,document};
}

const depth=depthRuntime(null);
assert.strictEqual(depth.api.isEnabled(),true);
assert.ok(Object.isFrozen(depth.api.DEPTH)&&Object.isFrozen(depth.api.DEPTH.background));
assert.ok(depth.rootNode.classList.contains('visual-25d')&&depth.card.classList.contains('depth-card25d'));
depth.card.emit('pointerenter',{pointerType:'mouse'});
assert.ok(depth.card.classList.contains('depth-card25d-active'));
assert.deepStrictEqual(JSON.parse(JSON.stringify(depth.api.snapshot().pointer)),{x:0,y:0});
const disabled=depth.api.setEnabled(false);
assert.strictEqual(disabled.enabled,false);
assert.ok(!depth.rootNode.classList.contains('visual-25d')&&!depth.card.classList.contains('depth-card25d'));
assert.ok(depth.cameraSettles.includes('depth_disabled'));
depth.document.hidden=true;depth.document.emit('visibilitychange');
assert.ok(depth.cameraSettles.includes('document_hidden'));
depth.api.destroy();
assert.strictEqual(depth.card.listenerCount(),0);
assert.strictEqual(depth.mediaListeners.size,0);
assert.strictEqual(depth.documentListeners.get('visibilitychange').size,0);

function cameraRuntime(reducedMotion=true) {
  const mediaListeners=new Set(),events=[],stage=node(),target=node();
  const context={console,document:{hidden:false,getElementById(id){return id==='screen-game'?stage:null;}},CustomEvent:function(type,init){this.type=type;this.detail=init.detail;},
    dispatchEvent(event){events.push(event);},DepthScene25D:{isEnabled(){return true;}},
    matchMedia(){return{matches:reducedMotion,addEventListener(_name,fn){mediaListeners.add(fn);},removeEventListener(_name,fn){mediaListeners.delete(fn);}};},
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
const hiddenCamera=cameraRuntime(false);
hiddenCamera.context.document.hidden=true;
const hiddenCameraResult=hiddenCamera.api.to('active',{target:hiddenCamera.target,focus:'late-timer'});
assert.strictEqual(hiddenCameraResult.status,'static');
assert.strictEqual(hiddenCamera.api.snapshot().documentHidden,true);
hiddenCamera.api.destroy();

function stageRuntime() {
  const timers=scheduler(),surface=node(),area=node(),listeners=new Map();area.querySelector=()=>surface;
  const cameraCalls=[],mascotCalls=[],pageCalls=[];
  const document={hidden:false,getElementById(id){return id==='board-area'?area:null;},createElement(){return node();},
    addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
    removeEventListener(name,fn){const set=listeners.get(name);if(set)set.delete(fn);},
    emit(name){const set=listeners.get(name);if(set)for(const fn of [...set])fn();}};
  const context={console,Date,document,
    setTimeout:callback=>timers.set(callback),clearTimeout:id=>timers.clear(id),
    CameraSystem25D:{shake(value){cameraCalls.push(['shake',value]);},to(mode,value){cameraCalls.push([mode,value]);}},
    GhostMascot25D:{result(value,options){mascotCalls.push({value,camera:options&&options.camera});}},PageTransition25D:{exitGame(){pageCalls.push('exit');}},
  };
  context.globalThis=context;vm.runInContext(files.stage,vm.createContext(context));
  return {api:context.GameStage25D,area,surface,timers,cameraCalls,mascotCalls,pageCalls,listeners,document};
}
const stageRuntimeValue=stageRuntime();
assert.ok(Object.isFrozen(stageRuntimeValue.api.FX_PROFILES));
assert.strictEqual(stageRuntimeValue.api.emit({type:'piece_landed',game:'gomoku',row:7,col:8,size:15}),true);
assert.strictEqual(stageRuntimeValue.surface.children.length,1);
assert.strictEqual(stageRuntimeValue.cameraCalls[0][0],'impact');
assert.strictEqual(stageRuntimeValue.cameraCalls[0][1].direction,1);
const callsBeforeResult=stageRuntimeValue.cameraCalls.length;
assert.strictEqual(stageRuntimeValue.api.emit({type:'result',game:'gomoku',outcome:'win'}),true);
assert.strictEqual(stageRuntimeValue.surface.children.length,0);
assert.strictEqual(stageRuntimeValue.area.children.length,1);
assert.strictEqual(JSON.stringify(stageRuntimeValue.api.snapshot().effect),JSON.stringify({kind:'result',tone:'success',motion:'animated'}));
assert.strictEqual(stageRuntimeValue.timers.size,1);
stageRuntimeValue.timers.flush();
assert.strictEqual(stageRuntimeValue.cameraCalls.length,callsBeforeResult+1,
  'a pending impact recovery must not run after the terminal result');
assert.strictEqual(stageRuntimeValue.cameraCalls[callsBeforeResult][0],'result');
assert.deepStrictEqual(stageRuntimeValue.mascotCalls,[{value:'win',camera:false}]);
assert.strictEqual(stageRuntimeValue.api.emit({type:'exit',game:'gomoku'}),true);
assert.deepStrictEqual(stageRuntimeValue.pageCalls,['exit']);
stageRuntimeValue.api.clear();
assert.strictEqual(stageRuntimeValue.timers.size,0);
const callsBeforeFire=stageRuntimeValue.cameraCalls.length;
assert.strictEqual(stageRuntimeValue.api.emit({type:'phase',game:'tank',phase:'fire',detail:1,reducedMotion:true}),true);
assert.strictEqual(stageRuntimeValue.cameraCalls.length,callsBeforeFire+1);
assert.strictEqual(stageRuntimeValue.cameraCalls[callsBeforeFire][0],'impact');
assert.strictEqual(stageRuntimeValue.cameraCalls[callsBeforeFire][1].direction,-1);
assert.strictEqual(JSON.stringify(stageRuntimeValue.api.snapshot().effect),JSON.stringify({kind:'slash',tone:'warning',motion:'static'}));
assert.strictEqual(stageRuntimeValue.timers.size,2);
stageRuntimeValue.timers.flush();
assert.strictEqual(stageRuntimeValue.cameraCalls.at(-1)[0],'active');
assert.strictEqual(stageRuntimeValue.api.emit({type:'phase',game:'tetris',phase:'lock',detail:{piece:'I'}}),true);
assert.strictEqual(stageRuntimeValue.api.emit({type:'phase',game:'tetris',phase:'lock',detail:{piece:'I'}}),true,
  'separate accepted locks with the same detail remain visible presentation events');
assert.strictEqual(stageRuntimeValue.timers.size,2,
  'a newer impact keeps exactly one bounded FX cleanup and one camera recovery timer');
const callsBeforeNewerFocus=stageRuntimeValue.cameraCalls.length;
assert.strictEqual(stageRuntimeValue.api.emit({type:'phase',game:'xiangqi',phase:'check',detail:3}),true);
assert.strictEqual(stageRuntimeValue.timers.size,1,
  'a newer non-impact phase cancels the older impact recovery and retains only its FX cleanup');
stageRuntimeValue.timers.flush();
assert.strictEqual(stageRuntimeValue.cameraCalls.length,callsBeforeNewerFocus+1);
assert.strictEqual(stageRuntimeValue.cameraCalls.at(-1)[0],'focus');
stageRuntimeValue.api.clear();
assert.strictEqual(stageRuntimeValue.timers.size,0);
assert.strictEqual(stageRuntimeValue.api.emit({type:'phase',game:'tank',phase:'unknown'}),false);
assert.strictEqual(stageRuntimeValue.api.emit({type:'phase',game:'tank',phase:'ko',detail:1}),true);
assert.strictEqual(stageRuntimeValue.timers.size,2);
stageRuntimeValue.document.hidden=true;stageRuntimeValue.document.emit('visibilitychange');
assert.strictEqual(stageRuntimeValue.timers.size,0);
assert.strictEqual(stageRuntimeValue.api.snapshot().effect,null);
stageRuntimeValue.api.destroy();
assert.strictEqual(stageRuntimeValue.listeners.get('visibilitychange').size,0);
assert.strictEqual(stageRuntimeValue.api.emit({type:'phase',game:'tank',phase:'fire'}),false);

function transitionRuntime(reduceMotion){
  const timers=scheduler(),cameraCalls=[],mascotCalls=[],listeners=new Map();
  const stage=node(),area=node(),grid=node(),card=node(['game-card']),homeRoute=node(),gamesRoute=node();card.dataset.gameId='gomoku';
  const document={
    getElementById(id){return { 'screen-game':stage,'board-area':area,'game-grid':grid }[id]||null;},
    querySelector(selector){if(selector.includes('game-card'))return card;if(selector.includes('data-app-route="home"'))return homeRoute;if(selector.includes('data-app-route="games"'))return gamesRoute;return null;},
    addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
    removeEventListener(name,fn){const set=listeners.get(name);if(set)set.delete(fn);},
  };
  const context={console,document,setTimeout:callback=>timers.set(callback),clearTimeout:id=>timers.clear(id),
    matchMedia(){return{matches:reduceMotion};},DepthScene25D:{isEnabled(){return true;}},
    CameraSystem25D:{to(mode,value){cameraCalls.push([mode,value]);}},
    GhostMascot25D:{selectCard(){},enterGame(){mascotCalls.push('enter');},reset(){mascotCalls.push('reset');}},
  };
  context.globalThis=context;vm.runInContext(files.transition,vm.createContext(context));
  return{api:context.PageTransition25D,timers,cameraCalls,mascotCalls,listeners,homeRoute,gamesRoute};
}
const transition=transitionRuntime(false);
assert.strictEqual(transition.api.enterGame('gomoku'),true);
assert.strictEqual(transition.timers.size,1);
transition.timers.flush();
assert.strictEqual(transition.cameraCalls.at(-1)[0],'active');
assert.strictEqual(transition.api.exitGame(),true);
assert.strictEqual(transition.cameraCalls.at(-1)[0],'exit');
assert.strictEqual(transition.timers.size,1);
const deferredRoute=transition.api.route('games','home');
assert.strictEqual(deferredRoute.deferred,true);
assert.strictEqual(transition.cameraCalls.at(-1)[0],'exit',
  'same-tick route commit must not replace the exit camera');
transition.timers.flush();
assert.strictEqual(transition.cameraCalls.at(-1)[0],'overview');
assert.strictEqual(transition.cameraCalls.at(-1)[1].target,transition.homeRoute);
assert.strictEqual(transition.api.exitGame(),true);
assert.strictEqual(transition.api.enterGame('gomoku'),true);
assert.strictEqual(transition.timers.size,1,
  'rapid re-entry keeps only the new entrance completion timer');
const callsBeforeRapidReentryFlush=transition.cameraCalls.length;
transition.timers.flush();
assert.strictEqual(transition.cameraCalls.length,callsBeforeRapidReentryFlush+1);
assert.strictEqual(transition.cameraCalls.at(-1)[0],'active',
  'a cancelled exit completion must not pull the new game back to overview');
transition.api.destroy();
assert.strictEqual(transition.listeners.get('pointerdown').size,0);
const reducedTransition=transitionRuntime(true);
assert.strictEqual(reducedTransition.api.enterGame('gomoku'),true);
assert.strictEqual(reducedTransition.timers.size,0);
assert.strictEqual(reducedTransition.cameraCalls.at(-1)[0],'active');
assert.strictEqual(reducedTransition.api.exitGame(),true);
assert.strictEqual(reducedTransition.timers.size,0);
assert.deepStrictEqual(reducedTransition.cameraCalls.slice(-2).map(call=>call[0]),['exit','overview']);
reducedTransition.api.destroy();

console.log('VISUAL_25D_CONTRACT_ALL_PASS depth=3 camera=8 renderer=dom-css-canvas gsap=timeline fallback=static');
