/* Ghost Game 2.5D depth scene: DOM/CSS spatial language with a static fallback. */
(function installDepthScene25D(root) {
  'use strict';

  const STORAGE_KEY = 'mg_visual_25d_v1';
  const DEPTH = Object.freeze({
    background:Object.freeze({ z:-40, parallax:.12, blur:2 }),
    midground:Object.freeze({ z:0, parallax:.35, blur:0 }),
    foreground:Object.freeze({ z:28, parallax:.7, blur:0 }),
  });
  const CARD_SELECTOR = '.game-card,.home-glass-card,.games-workspace-tab';
  const cardCleanups = new Map();
  let frame = 0;
  let pointer = { x:0, y:0 };
  let reducedQuery = null;
  let enabled = true;
  let runtimeOverride = null;
  let destroyed = false;

  function featureEnabled(){
    if(runtimeOverride!==null)return runtimeOverride;
    try { return typeof localStorage === 'undefined' || !localStorage || localStorage.getItem(STORAGE_KEY) !== '0'; }
    catch (_error) { return true; }
  }
  function reducedMotion(){ return !!(reducedQuery && reducedQuery.matches); }
  function clamp(value, minimum, maximum){ return Math.max(minimum, Math.min(maximum, Number(value) || 0)); }
  function setVariable(node, name, value){
    try { if(node && node.style) node.style.setProperty(name, value); } catch (_error) {}
  }
  function clearCard(card){
    if(!card)return;
    card.classList && card.classList.remove('depth-card25d','depth-card25d-active');
    ['--depth-card-x','--depth-card-y','--depth-card-rx','--depth-card-ry'].forEach(name=>{
      try{card.style.removeProperty(name);}catch(_error){}
    });
  }
  function queuePointerRender(){
    if(frame || !enabled || reducedMotion() || typeof requestAnimationFrame !== 'function')return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      const scene=typeof document!=='undefined'&&document.documentElement;
      setVariable(scene,'--depth-pointer-x',pointer.x.toFixed(4));
      setVariable(scene,'--depth-pointer-y',pointer.y.toFixed(4));
    });
  }
  function onGlobalPointer(event){
    if(!enabled || reducedMotion() || !event || event.pointerType==='touch')return;
    const width=Math.max(1,typeof innerWidth==='number'?innerWidth:1),height=Math.max(1,typeof innerHeight==='number'?innerHeight:1);
    pointer={x:clamp((event.clientX/width-.5)*2,-1,1),y:clamp((event.clientY/height-.5)*2,-1,1)};
    queuePointerRender();
  }
  function attachCard(card){
    if(!card || cardCleanups.has(card))return false;
    card.classList.add('depth-card25d');
    let localFrame=0,last=null;
    const render=()=>{
      localFrame=0;if(!last||!enabled||reducedMotion())return;
      const rect=card.getBoundingClientRect();if(!rect.width||!rect.height)return;
      const x=clamp((last.clientX-rect.left)/rect.width*2-1,-1,1),y=clamp((last.clientY-rect.top)/rect.height*2-1,-1,1);
      setVariable(card,'--depth-card-x',(x*5).toFixed(2)+'px');
      setVariable(card,'--depth-card-y',(y*4).toFixed(2)+'px');
      setVariable(card,'--depth-card-rx',(-y*2.4).toFixed(2)+'deg');
      setVariable(card,'--depth-card-ry',(x*3.4).toFixed(2)+'deg');
    };
    const move=event=>{if(event.pointerType==='touch')return;last=event;if(!localFrame)localFrame=requestAnimationFrame(render);};
    const enter=()=>card.classList.add('depth-card25d-active');
    const leave=()=>{last=null;card.classList.remove('depth-card25d-active');setVariable(card,'--depth-card-x','0px');setVariable(card,'--depth-card-y','0px');setVariable(card,'--depth-card-rx','0deg');setVariable(card,'--depth-card-ry','0deg');};
    card.addEventListener('pointermove',move,{passive:true});card.addEventListener('pointerenter',enter,{passive:true});card.addEventListener('pointerleave',leave,{passive:true});
    cardCleanups.set(card,()=>{if(localFrame)cancelAnimationFrame(localFrame);card.removeEventListener('pointermove',move);card.removeEventListener('pointerenter',enter);card.removeEventListener('pointerleave',leave);clearCard(card);});
    return true;
  }
  function assignLayers(){
    if(typeof document==='undefined')return;
    const ambient=document.getElementById('ambient-scene');
    if(ambient){ambient.classList.toggle('depth-scene25d',enabled);ambient.dataset.depthScene=enabled?'platform':'';}
    const mapping=[['.platform-scene-far,.ambient-stars-a,.ambient-clouds-a','background'],['.platform-scene-mid,.ambient-stars-b,.ambient-clouds-b','midground'],['.platform-scene-foreground','foreground']];
    mapping.forEach(([selector,token])=>document.querySelectorAll(selector).forEach(node=>{node.classList.toggle('depth-layer25d',enabled);node.dataset.depthLayer=enabled?token:'';}));
    const hero=document.getElementById('hero-banner');if(hero)hero.classList.toggle('depth-scene25d',enabled);
    const stage=document.getElementById('screen-game');if(stage)stage.classList.toggle('depth-stage25d',enabled);
  }
  function refresh(){
    if(destroyed)return snapshot();
    enabled=featureEnabled();
    if(typeof document==='undefined')return Object.freeze({enabled,reducedMotion:reducedMotion(),cards:0});
    const documentRoot=document.documentElement;
    if(documentRoot&&documentRoot.classList)documentRoot.classList.toggle('visual-25d',enabled);
    if(!enabled||reducedMotion()){
      pointer={x:0,y:0};
      setVariable(documentRoot,'--depth-pointer-x','0');
      setVariable(documentRoot,'--depth-pointer-y','0');
    }
    assignLayers();
    document.querySelectorAll(CARD_SELECTOR).forEach(card=>enabled?attachCard(card):(cardCleanups.get(card)&&cardCleanups.get(card)()));
    for(const [card,cleanup] of cardCleanups){if(!card.isConnected||!enabled){cleanup();cardCleanups.delete(card);}}
    if(root.GhostMascot25D&&typeof root.GhostMascot25D.refresh==='function')root.GhostMascot25D.refresh();
    return snapshot();
  }
  function setEnabled(value){
    runtimeOverride=value!==false;
    try{if(typeof localStorage!=='undefined'&&localStorage)localStorage.setItem(STORAGE_KEY,value===false?'0':'1');}catch(_error){}
    enabled=runtimeOverride;return refresh();
  }
  function snapshot(){return Object.freeze({enabled,reducedMotion:reducedMotion(),cards:cardCleanups.size,pointer:Object.freeze({...pointer}),depth:DEPTH});}
  function destroy(){
    if(destroyed)return;destroyed=true;
    if(frame&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);frame=0;
    for(const cleanup of cardCleanups.values())cleanup();cardCleanups.clear();
    if(root&&root.removeEventListener)root.removeEventListener('pointermove',onGlobalPointer);
    if(reducedQuery&&reducedQuery.removeEventListener)reducedQuery.removeEventListener('change',refresh);
    else if(reducedQuery&&reducedQuery.removeListener)reducedQuery.removeListener(refresh);
    if(typeof document!=='undefined'&&document.documentElement&&document.documentElement.classList){
      document.documentElement.classList.remove('visual-25d');
      setVariable(document.documentElement,'--depth-pointer-x','0');
      setVariable(document.documentElement,'--depth-pointer-y','0');
      enabled=false;assignLayers();
    }
  }
  if(typeof root.matchMedia==='function'){
    reducedQuery=root.matchMedia('(prefers-reduced-motion: reduce)');
    if(reducedQuery&&reducedQuery.addEventListener)reducedQuery.addEventListener('change',refresh);
    else if(reducedQuery&&reducedQuery.addListener)reducedQuery.addListener(refresh);
  }
  if(root&&root.addEventListener)root.addEventListener('pointermove',onGlobalPointer,{passive:true});
  const api=Object.freeze({STORAGE_KEY,DEPTH,refresh,setEnabled,snapshot,destroy,attachCard,isEnabled:()=>enabled&&!destroyed});
  root.DepthScene25D=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
  }
})(typeof globalThis!=='undefined'?globalThis:this);
