/* Replay facts -> reversible 2.5D presentation. Never owns replay data or rules. */
(function installReplayCinematic25D(root){
  'use strict';
  const ENTRY_URL='./replay-cinematic-entry.js';
  const STATES=Object.freeze(['idle','overview','playing','paused','seeking','result']);
  let state='idle',host=null,overlay=null,total=0,index=0,destroyed=false,adapter=null,loader=null,loaderFailed=false,active=null,generation=0;
  function reduced(){try{return !!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(_error){return false;}}
  function hidden(){return typeof document!=='undefined'&&document.hidden===true;}
  function node(value){return value&&value.nodeType===1?value:null;}
  function settle(reason){generation+=1;const running=active;active=null;try{if(running&&running.kill)running.kill(reason||'settle');}catch(_error){}try{if(adapter&&adapter.settle)adapter.settle(reason||'settle');}catch(_error){}}
  function load(){
    if(destroyed||adapter||loaderFailed)return Promise.resolve(adapter);if(loader)return loader;
    loader=import(ENTRY_URL).then(moduleValue=>{if(!moduleValue||typeof moduleValue.createReplayCinematicAdapter!=='function')throw new Error('invalid_replay_cinematic_adapter');const created=moduleValue.createReplayCinematicAdapter();if(destroyed){try{created&&created.dispose&&created.dispose();}catch(_error){}return null;}adapter=created;return adapter;}).catch(()=>{loaderFailed=true;adapter=null;return null;});return loader;
  }
  function animate(next){
    if(reduced()||hidden()||!overlay)return 'static';const requestGeneration=++generation;
    if(active&&active.kill)try{active.kill('replace');}catch(_error){}active=null;
    if(adapter){try{active=adapter.run({state:next,overlay,layers:overlay.querySelectorAll?overlay.querySelectorAll('.replay-cinematic25d-layer'):[],onComplete(){if(requestGeneration===generation)active=null;}});return 'animating';}catch(_error){return 'static';}}
    load();return 'loading';
  }
  function camera(mode,focus,target){
    if(!root.CameraSystem25D||typeof root.CameraSystem25D.to!=='function')return null;
    return root.CameraSystem25D.to(mode,{target:node(target)||host,stage:host,focus:'replay:'+focus,duration:reduced()?.08:(mode==='result'?.28:.18),intensity:.72,composition:'player'});
  }
  function removeOverlay(){if(overlay&&overlay.isConnected&&typeof overlay.remove==='function')overlay.remove();overlay=null;}
  function setState(next){state=STATES.includes(next)?next:'idle';if(host&&host.dataset)host.dataset.replay25dState=state;if(overlay&&overlay.dataset)overlay.dataset.replay25dState=state;animate(state);}
  function makeOverlay(target){
    if(typeof document==='undefined'||!target||typeof target.appendChild!=='function')return null;
    const wrap=document.createElement('span');wrap.className='replay-cinematic25d';wrap.setAttribute('aria-hidden','true');
    for(const layer of ['background','midground','foreground']){const item=document.createElement('span');item.className='replay-cinematic25d-layer replay-cinematic25d-'+layer;item.dataset.replayLayer=layer;wrap.appendChild(item);}
    target.appendChild(wrap);return wrap;
  }
  function begin(options){
    if(destroyed)return false;end('replace');const request=options&&typeof options==='object'?options:{};
    host=node(request.stage)||(typeof document!=='undefined'&&document.getElementById('screen-game'));const target=node(request.target)||(typeof document!=='undefined'&&document.getElementById('board-area'))||host;
    total=Math.max(0,Math.floor(Number(request.total)||0));index=0;overlay=makeOverlay(target);if(host&&host.classList)host.classList.add('replay-cinematic-active');
    if(overlay&&overlay.style&&typeof overlay.style.setProperty==='function'){overlay.style.setProperty('--replay-progress','0');overlay.style.setProperty('--replay-direction','1');}
    setState('overview');camera('overview','overview',target);return true;
  }
  function beat(options){
    if(destroyed||state==='idle')return false;const request=options&&typeof options==='object'?options:{};
    total=Math.max(total,Math.floor(Number(request.total)||0));index=Math.max(0,Math.min(total,Math.floor(Number(request.index)||0)));
    const seeking=request.seeking===true;setState(seeking?'seeking':'playing');
    if(overlay&&overlay.style&&typeof overlay.style.setProperty==='function'){overlay.style.setProperty('--replay-progress',total?String(index/total):'0');overlay.style.setProperty('--replay-direction',Number(request.direction)<0?'-1':'1');}
    camera('focus',seeking?'seek':'beat',node(request.target));return true;
  }
  function pause(options){if(destroyed||state==='idle')return false;setState('paused');camera('overview','paused',options&&options.target);return true;}
  function complete(options){if(destroyed||state==='idle')return false;index=total;setState('result');if(overlay&&overlay.style&&typeof overlay.style.setProperty==='function')overlay.style.setProperty('--replay-progress','1');camera('result','result',options&&options.target);return true;}
  function end(reason){
    settle(reason||'replay_end');
    if(host&&host.classList)host.classList.remove('replay-cinematic-active');
    if(host&&host.dataset)delete host.dataset.replay25dState;removeOverlay();host=null;state='idle';total=0;index=0;
    try{if(root.CameraSystem25D&&typeof root.CameraSystem25D.settle==='function')root.CameraSystem25D.settle(reason||'replay_end');}catch(_error){}
    return true;
  }
  function onVisibilityChange(){if(hidden())settle('document_hidden');}
  function destroy(){if(destroyed)return;end('replay_destroy');destroyed=true;try{adapter&&adapter.dispose&&adapter.dispose();}catch(_error){}adapter=null;if(typeof document!=='undefined'&&document.removeEventListener)document.removeEventListener('visibilitychange',onVisibilityChange);}
  if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',onVisibilityChange);
  const api=Object.freeze({STATES,begin,beat,pause,complete,end,settle,destroy,snapshot:()=>Object.freeze({state,total,index,reducedMotion:reduced(),documentHidden:hidden(),overlay:!!overlay,adapterAvailable:!!adapter,loaderFailed,destroyed})});
  root.ReplayCinematic25D=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
