/* Honru as the 2.5D spatial guide: idle, pointer attention, game entry and result. */
(function installGhostMascot25D(root){
  'use strict';
  let host=null,frame=0,lastPointer=null,selectedCard=null,flightTimer=null,flight=null,destroyed=false;
  function reduced(){try{return !!root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_error){return false;}}
  function enabled(){return !destroyed&&!!(root.DepthScene25D&&root.DepthScene25D.isEnabled&&root.DepthScene25D.isEnabled());}
  function resolveHost(){return typeof document!=='undefined'?document.querySelector('.hero-honru[data-honru-brand-state]'):null;}
  function renderGaze(){
    frame=0;if(!host||!lastPointer||reduced()||!enabled())return;
    const rect=host.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height*.46;
    const dx=Math.max(-1,Math.min(1,(lastPointer.clientX-cx)/Math.max(1,innerWidth*.35))),dy=Math.max(-1,Math.min(1,(lastPointer.clientY-cy)/Math.max(1,innerHeight*.35)));
    host.style.setProperty('--honru-gaze-x',(dx*5).toFixed(2)+'px');host.style.setProperty('--honru-gaze-y',(dy*3).toFixed(2)+'px');host.style.setProperty('--honru-gaze-ry',(dx*4).toFixed(2)+'deg');host.style.setProperty('--honru-gaze-rx',(-dy*3).toFixed(2)+'deg');
  }
  function pointer(event){if(!host||!enabled()||event.pointerType==='touch')return;lastPointer=event;if(!frame)frame=requestAnimationFrame(renderGaze);}
  function mount(){
    if(destroyed||!enabled())return false;
    const next=resolveHost();if(next===host)return !!host;if(host)unmount();host=next;if(!host)return false;
    host.classList.add('honru-mascot25d');host.dataset.honruMotion='idle';root.addEventListener('pointermove',pointer,{passive:true});return true;
  }
  function unmount(){if(frame)cancelAnimationFrame(frame);frame=0;root.removeEventListener('pointermove',pointer);if(host){host.classList.remove('honru-mascot25d');delete host.dataset.honruMotion;['--honru-gaze-x','--honru-gaze-y','--honru-gaze-rx','--honru-gaze-ry'].forEach(name=>host.style.removeProperty(name));}host=null;}
  function selectCard(card){if(selectedCard&&selectedCard.dataset)delete selectedCard.dataset.depthSelected;selectedCard=card&&card.nodeType===1?card:null;if(selectedCard)selectedCard.dataset.depthSelected='true';return selectedCard;}
  function makeFlight(target){
    if(typeof document==='undefined'||!target)return null;
    const source=host&&host.querySelector('img'),flightNode=document.createElement('img');flightNode.className='honru-flight25d';flightNode.alt='';flightNode.setAttribute('aria-hidden','true');flightNode.src=source&&source.currentSrc||source&&source.src||(typeof assetUrl==='function'?assetUrl('brand/honru-mascot-v1.svg'):'assets/brand/honru-mascot-v1.svg');
    if(source&&source.getBoundingClientRect){const rect=source.getBoundingClientRect();flightNode.style.left=rect.left+'px';flightNode.style.top=rect.top+'px';flightNode.style.width=Math.max(1,rect.width)+'px';flightNode.style.height=Math.max(1,rect.height)+'px';}
    document.body.appendChild(flightNode);return flightNode;
  }
  function enterGame(card){
    const target=card||selectedCard;if(!target||!enabled()||reduced())return null;if(!host)mount();
    if(flightTimer){clearTimeout(flightTimer);flightTimer=null;}if(flight&&flight.isConnected)flight.remove();flight=makeFlight(target);
    if(root.CameraSystem25D)root.CameraSystem25D.to('enter',{target,stage:document.getElementById('screen-game'),mascot:flight,duration:.72});
    if(flight)flightTimer=setTimeout(()=>{flightTimer=null;if(flight&&flight.isConnected)flight.remove();flight=null;},900);
    return flight;
  }
  function result(outcome){if(host)host.dataset.honruMotion=outcome==='win'?'result-win':outcome==='loss'?'result-lose':'result-draw';if(root.CameraSystem25D)root.CameraSystem25D.to('result',{target:document.getElementById('board-area')});}
  function reset(){if(host)host.dataset.honruMotion='idle';selectCard(null);}
  function refresh(){if(enabled())return mount();unmount();return false;}
  function destroy(){if(destroyed)return;if(flightTimer)clearTimeout(flightTimer);flightTimer=null;if(flight&&flight.isConnected)flight.remove();flight=null;unmount();reset();destroyed=true;}
  function snapshot(){return Object.freeze({mounted:!!host,state:host&&host.dataset.honruMotion||'unmounted',selectedGame:selectedCard&&selectedCard.dataset.gameId||null,reducedMotion:reduced(),enabled:enabled()});}
  const api=Object.freeze({mount,unmount,refresh,selectCard,enterGame,result,reset,snapshot,destroy});root.GhostMascot25D=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();}
})(typeof globalThis!=='undefined'?globalThis:this);
