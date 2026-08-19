/* Home -> Games -> Game Stage 2.5D transition coordinator. */
(function installPageTransition25D(root){
  'use strict';
  let selected=null,currentGame=null,activeTimer=null,resetTimer=null,destroyed=false;
  function enabled(){return !destroyed&&!!(root.DepthScene25D&&root.DepthScene25D.isEnabled&&root.DepthScene25D.isEnabled());}
  function select(card){selected=card&&card.nodeType===1?card:null;if(root.GhostMascot25D)root.GhostMascot25D.selectCard(selected);return !!selected;}
  function enterGame(gameId){
    if(destroyed)return false;currentGame=String(gameId||'');const card=selected||(typeof document!=='undefined'&&document.querySelector('.game-card[data-game-id="'+currentGame+'"]'));
    if(enabled()&&root.GhostMascot25D)root.GhostMascot25D.enterGame(card);
    if(activeTimer)clearTimeout(activeTimer);
    const settle=()=>{activeTimer=null;if(root.CameraSystem25D&&typeof document!=='undefined')root.CameraSystem25D.to('active',{target:document.getElementById('board-area'),stage:document.getElementById('screen-game'),focus:currentGame,duration:.58});};
    if(enabled())activeTimer=setTimeout(settle,560);else settle();
    return true;
  }
  function exitGame(){if(destroyed)return false;if(activeTimer){clearTimeout(activeTimer);activeTimer=null;}if(resetTimer){clearTimeout(resetTimer);resetTimer=null;}if(root.CameraSystem25D&&typeof document!=='undefined')root.CameraSystem25D.to('exit',{target:document.getElementById('screen-game'),focus:currentGame,duration:.46});currentGame=null;const finish=()=>{resetTimer=null;if(root.GhostMascot25D)root.GhostMascot25D.reset();if(root.CameraSystem25D&&typeof document!=='undefined')root.CameraSystem25D.to('overview',{target:document.getElementById('game-grid'),focus:'games',duration:.38});};if(enabled())resetTimer=setTimeout(finish,80);else finish();return true;}
  function route(from,to){if(!destroyed&&root.CameraSystem25D&&typeof document!=='undefined')root.CameraSystem25D.to('overview',{target:document.querySelector('[data-app-route="'+to+'"]'),focus:to,duration:.48});return {from,to};}
  function capture(event){const card=event&&event.target&&event.target.closest&&event.target.closest('.game-card');if(card)select(card);}
  if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
    document.addEventListener('pointerdown',capture,true);
  }
  function destroy(){if(destroyed)return;destroyed=true;if(activeTimer)clearTimeout(activeTimer);if(resetTimer)clearTimeout(resetTimer);activeTimer=null;resetTimer=null;if(typeof document!=='undefined'&&typeof document.removeEventListener==='function')document.removeEventListener('pointerdown',capture,true);if(root.GhostMascot25D)root.GhostMascot25D.reset();selected=null;currentGame=null;}
  const api=Object.freeze({select,enterGame,exitGame,route,destroy,snapshot:()=>Object.freeze({selected:selected&&selected.dataset.gameId||null,currentGame,destroyed})});root.PageTransition25D=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
