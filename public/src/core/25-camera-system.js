/* Ghost Game 2.5D camera vocabulary: a DOM presentation state, never game authority. */
(function installCameraSystem25D(root){
  'use strict';
  const ENTRY_URL='./depth-motion-entry.js';
  const MODES=Object.freeze(['overview','hover','enter','active','focus','impact','result','exit']);
  const COMPOSITIONS=Object.freeze(['player','spectator-neutral']);
  const SPECTATOR_MODES=Object.freeze(['overview','focus','impact','result']);
  const PRESETS=Object.freeze({
    overview:Object.freeze({x:0,y:0,scale:1,rotation:0,rotationX:0,rotationY:0}),
    hover:Object.freeze({x:0,y:-3,scale:1.006,rotation:0,rotationX:-.4,rotationY:0}),
    enter:Object.freeze({x:0,y:-4,scale:1.018,rotation:0,rotationX:-.6,rotationY:.4}),
    active:Object.freeze({x:0,y:0,scale:1,rotation:0,rotationX:0,rotationY:0}),
    focus:Object.freeze({x:0,y:0,scale:1.006,rotation:0,rotationX:0,rotationY:0}),
    impact:Object.freeze({x:0,y:0,scale:1.004,rotation:0,rotationX:0,rotationY:0}),
    result:Object.freeze({x:0,y:-1,scale:1.012,rotation:0,rotationX:-.5,rotationY:0}),
    exit:Object.freeze({x:0,y:8,scale:.965,rotation:0,rotationX:0,rotationY:0}),
  });
  let state={x:0,y:0,scale:1,rotation:0,rotationX:0,rotationY:0,focus:'scene',mode:'overview',composition:'player'};
  let adapter=null,loader=null,loaderFailed=false,active=null,generation=0,reducedQuery=null,destroyed=false,lastTarget=null;
  function reduced(){return !!(reducedQuery&&reducedQuery.matches);}
  function hidden(){return typeof document!=='undefined'&&document.hidden===true;}
  function validMode(mode){return MODES.includes(mode)?mode:'overview';}
  function validComposition(value){return COMPOSITIONS.includes(String(value||''))?String(value):'player';}
  function validSpectatorMode(mode){return SPECTATOR_MODES.includes(String(mode||''))?String(mode):'overview';}
  function targetNode(value){return value&&value.nodeType===1?value:null;}
  function clearCameraDataset(node){if(!node||!node.dataset)return;delete node.dataset.camera25dMode;delete node.dataset.camera25dComposition;delete node.dataset.camera25dSpectator;delete node.dataset.camera25dFocus;}
  function settle(reason){
    generation+=1;const running=active;active=null;
    try{if(running&&running.kill)running.kill(reason||'settle');}catch(_error){}
    try{if(adapter&&adapter.settle)adapter.settle(reason||'settle');}catch(_error){}
  }
  function load(){
    if(destroyed||adapter||loaderFailed)return Promise.resolve(adapter);if(loader)return loader;
    loader=import(ENTRY_URL).then(moduleValue=>{
      if(!moduleValue||typeof moduleValue.createDepthMotionAdapter!=='function')throw new Error('invalid_depth_motion_adapter');
      const created=moduleValue.createDepthMotionAdapter();
      if(destroyed){try{if(created&&created.dispose)created.dispose();}catch(_error){}return null;}
      adapter=created;return adapter;
    }).catch(()=>{loaderFailed=true;adapter=null;return null;});
    return loader;
  }
  function staticApply(mode,options,composition){
    const target=targetNode(options&&options.target);if(target&&target.dataset){target.dataset.camera25dMode=mode;target.dataset.camera25dComposition=composition;target.dataset.camera25dSpectator=composition==='spectator-neutral'?'true':'false';}
    if(lastTarget&&lastTarget!==target)clearCameraDataset(lastTarget);
    lastTarget=target;
    const stage=typeof document!=='undefined'&&document.getElementById('screen-game');
    if(stage&&stage.dataset){stage.dataset.camera25dMode=mode;stage.dataset.camera25dComposition=composition;stage.dataset.camera25dSpectator=composition==='spectator-neutral'?'true':'false';stage.dataset.camera25dFocus=String(state.focus||'scene');}
  }
  function run(mode,options){
    if(destroyed)return Object.freeze({status:'destroyed',mode:validMode(mode),generation});
    const next=validMode(mode),request=options&&typeof options==='object'?options:{},requestGeneration=++generation;
    if(active&&active.kill){try{active.kill('replace');}catch(_error){}}active=null;
    const composition=validComposition(request.composition||state.composition);
    state={...state,...PRESETS[next],...request.state,mode:next,composition,focus:String(request.focus||request.targetId||state.focus||'scene')};
    staticApply(next,request,composition);
    try{root.dispatchEvent(new CustomEvent('ghostgame:camera25d',{detail:{mode:next,focus:state.focus,composition,spectator:composition==='spectator-neutral',generation:requestGeneration}}));}catch(_error){}
    if(reduced()||hidden()||!root.DepthScene25D||!root.DepthScene25D.isEnabled())return Object.freeze({status:'static',mode:next,generation:requestGeneration});
    if(adapter){
      try{active=adapter.run({mode:next,target:targetNode(request.target),stage:targetNode(request.stage),mascot:targetNode(request.mascot),duration:request.duration,intensity:request.intensity,direction:request.direction,onComplete(){if(requestGeneration!==generation)return;active=null;}});return Object.freeze({status:'animating',mode:next,generation:requestGeneration});}
      catch(_error){active=null;return Object.freeze({status:'static',mode:next,generation:requestGeneration});}
    }
    load().then(value=>{if(value&&!destroyed&&requestGeneration===generation)run(next,request);});
    return Object.freeze({status:'loading',mode:next,generation:requestGeneration});
  }
  function focus(targetId,options){return run('focus',{...(options||{}),targetId});}
  function shake(options){return run('impact',{...(options||{}),intensity:Number(options&&options.intensity)||3});}
  function compose(composition,options){
    const next=validComposition(composition),request=options&&typeof options==='object'?options:{};
    const mode=validMode(request.mode|| (next==='spectator-neutral'?'overview':'active'));
    return run(mode,{...request,composition:next,focus:request.focus|| (next==='spectator-neutral'?'spectator:overview':'scene')});
  }
  function spectatorTo(mode,options){
    const request=options&&typeof options==='object'?options:{};
    const next=validSpectatorMode(mode);
    return run(next,{...request,composition:'spectator-neutral',focus:request.focus||('spectator:'+next)});
  }
  function spectator(options){
    const request=options&&typeof options==='object'?options:{};
    return spectatorTo(request.mode||'overview',request);
  }
  function snapshot(){return Object.freeze({...state,generation,available:!!adapter,loading:!!(loader&&!adapter&&!loaderFailed),loaderFailed,reducedMotion:reduced(),documentHidden:hidden(),destroyed});}
  function onReducedChange(){if(reduced())settle('reduced_motion');}
  function destroy(){if(destroyed)return;destroyed=true;settle('destroy');try{if(adapter&&adapter.dispose)adapter.dispose();}catch(_error){}adapter=null;clearCameraDataset(lastTarget);clearCameraDataset(typeof document!=='undefined'&&document.getElementById('screen-game'));lastTarget=null;if(reducedQuery&&reducedQuery.removeEventListener)reducedQuery.removeEventListener('change',onReducedChange);else if(reducedQuery&&reducedQuery.removeListener)reducedQuery.removeListener(onReducedChange);}
  if(typeof root.matchMedia==='function'){reducedQuery=root.matchMedia('(prefers-reduced-motion: reduce)');if(reducedQuery&&reducedQuery.addEventListener)reducedQuery.addEventListener('change',onReducedChange);else if(reducedQuery&&reducedQuery.addListener)reducedQuery.addListener(onReducedChange);}
  const api=Object.freeze({MODES,PRESETS,COMPOSITIONS,SPECTATOR_MODES,to:run,focus,shake,compose,spectator,spectatorTo,settle,snapshot,destroy});root.CameraSystem25D=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
