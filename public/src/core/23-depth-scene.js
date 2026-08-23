/* Ghost Game 2.5D depth scene: DOM/CSS spatial language with a static fallback. */
(function installDepthScene25D(root) {
  'use strict';

  const STORAGE_KEY = 'mg_visual_25d_v1';
  const DEPTH = Object.freeze({
    background:Object.freeze({ z:-40, parallax:0, blur:0 }),
    midground:Object.freeze({ z:0, parallax:0, blur:0 }),
    foreground:Object.freeze({ z:28, parallax:0, blur:0 }),
  });
  const CARD_SELECTOR = '.game-card,.home-glass-card,.games-workspace-tab';
  const cardCleanups = new Map();
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
  function setVariable(node, name, value){
    try { if(node && node.style) node.style.setProperty(name, value); } catch (_error) {}
  }
  function settleCamera(reason){
    try{if(root.CameraSystem25D&&typeof root.CameraSystem25D.settle==='function')root.CameraSystem25D.settle(reason);}catch(_error){}
  }
  function clearCard(card){
    if(!card)return;
    card.classList && card.classList.remove('depth-card25d','depth-card25d-active');
    ['--depth-card-x','--depth-card-y','--depth-card-rx','--depth-card-ry'].forEach(name=>{
      try{card.style.removeProperty(name);}catch(_error){}
    });
  }
  function attachCard(card){
    if(!card || cardCleanups.has(card))return false;
    card.classList.add('depth-card25d');
    const enter=()=>card.classList.add('depth-card25d-active');
    const leave=()=>{card.classList.remove('depth-card25d-active');};
    card.addEventListener('pointerenter',enter,{passive:true});card.addEventListener('pointerleave',leave,{passive:true});
    cardCleanups.set(card,()=>{card.removeEventListener('pointerenter',enter);card.removeEventListener('pointerleave',leave);clearCard(card);});
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
    setVariable(documentRoot,'--depth-pointer-x','0');
    setVariable(documentRoot,'--depth-pointer-y','0');
    if(!enabled||reducedMotion()){
      settleCamera(enabled?'reduced_motion':'depth_disabled');
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
  function snapshot(){return Object.freeze({enabled,reducedMotion:reducedMotion(),cards:cardCleanups.size,pointer:Object.freeze({x:0,y:0}),depth:DEPTH});}
  function onVisibilityChange(){
    if(typeof document==='undefined')return;
    if(document.hidden)settleCamera('document_hidden');
    else refresh();
  }
  function destroy(){
    if(destroyed)return;destroyed=true;
    settleCamera('depth_destroy');
    for(const cleanup of cardCleanups.values())cleanup();cardCleanups.clear();
    if(typeof document!=='undefined'&&typeof document.removeEventListener==='function')document.removeEventListener('visibilitychange',onVisibilityChange);
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
  if(typeof document!=='undefined'&&typeof document.addEventListener==='function')document.addEventListener('visibilitychange',onVisibilityChange);
  const api=Object.freeze({STORAGE_KEY,DEPTH,refresh,setEnabled,snapshot,destroy,attachCard,isEnabled:()=>enabled&&!destroyed});
  root.DepthScene25D=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
  }
})(typeof globalThis!=='undefined'?globalThis:this);
