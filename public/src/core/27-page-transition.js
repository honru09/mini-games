/* Home -> Games -> Game Stage 2.5D transition coordinator. */
(function installPageTransition25D(root){
  'use strict';
  let selected=null,currentGame=null,activeTimer=null,resetTimer=null,pendingRoute=null,generation=0,destroyed=false;
  function enabled(){return !destroyed&&!!(root.DepthScene25D&&root.DepthScene25D.isEnabled&&root.DepthScene25D.isEnabled());}
  function reduced(){try{return !!root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_error){return false;}}
  function animated(){return enabled()&&!reduced();}
  function select(card){selected=card&&card.nodeType===1?card:null;if(root.GhostMascot25D)root.GhostMascot25D.selectCard(selected);return !!selected;}
  function enterGame(gameId){
    if(destroyed)return false;const requestGeneration=++generation;currentGame=String(gameId||'');pendingRoute=null;const card=selected&&selected.dataset&&selected.dataset.gameId===currentGame?selected:(typeof document!=='undefined'&&document.querySelector('.game-card[data-game-id="'+currentGame+'"]'));if(card)select(card);
    if(enabled()&&root.GhostMascot25D)root.GhostMascot25D.enterGame(card);
    if(activeTimer)clearTimeout(activeTimer);
    if(resetTimer)clearTimeout(resetTimer);activeTimer=null;resetTimer=null;
    const gameFocus=currentGame;
    const settle=()=>{activeTimer=null;if(destroyed||requestGeneration!==generation)return;if(root.CameraSystem25D&&typeof document!=='undefined')root.CameraSystem25D.to('active',{target:document.getElementById('board-area'),stage:document.getElementById('screen-game'),focus:gameFocus,duration:.58});};
    if(animated())activeTimer=setTimeout(settle,720);else settle();
    return true;
  }
  function overviewRoute(to,duration){
    if(!root.CameraSystem25D||typeof document==='undefined')return;
    const routeTarget=document.querySelector('[data-app-route="'+to+'"]');
    root.CameraSystem25D.to('overview',{target:routeTarget||(to==='games'?document.getElementById('game-grid'):null),focus:to||'games',duration:duration||.48});
  }
  function exitGame(){
    if(destroyed)return false;const requestGeneration=++generation,gameFocus=currentGame;
    if(activeTimer)clearTimeout(activeTimer);if(resetTimer)clearTimeout(resetTimer);activeTimer=null;resetTimer=null;pendingRoute=null;
    if(root.CameraSystem25D&&typeof document!=='undefined')root.CameraSystem25D.to('exit',{target:document.getElementById('screen-game'),focus:gameFocus,duration:.46});
    currentGame=null;
    const finish=()=>{resetTimer=null;if(destroyed||requestGeneration!==generation)return;const route=pendingRoute;pendingRoute=null;if(root.GhostMascot25D)root.GhostMascot25D.reset();overviewRoute(route&&route.to||'games',route?.duration||.38);};
    if(animated())resetTimer=setTimeout(finish,480);else finish();return true;
  }
  function route(from,to){
    if(destroyed)return {from,to};
    if(resetTimer){pendingRoute={from,to,duration:.48};return {from,to,deferred:true};}
    generation+=1;pendingRoute=null;if(activeTimer){clearTimeout(activeTimer);activeTimer=null;}overviewRoute(to,.48);return {from,to};
  }
  function capture(event){const card=event&&event.target&&event.target.closest&&event.target.closest('.game-card');if(card)select(card);}
  if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
    document.addEventListener('pointerdown',capture,true);
  }
  function destroy(){if(destroyed)return;destroyed=true;generation+=1;if(activeTimer)clearTimeout(activeTimer);if(resetTimer)clearTimeout(resetTimer);activeTimer=null;resetTimer=null;pendingRoute=null;if(typeof document!=='undefined'&&typeof document.removeEventListener==='function')document.removeEventListener('pointerdown',capture,true);if(root.GhostMascot25D)root.GhostMascot25D.reset();selected=null;currentGame=null;}
  const api=Object.freeze({select,enterGame,exitGame,route,destroy,snapshot:()=>Object.freeze({selected:selected&&selected.dataset.gameId||null,currentGame,pendingRoute:pendingRoute&&pendingRoute.to||null,generation,destroyed})});root.PageTransition25D=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
