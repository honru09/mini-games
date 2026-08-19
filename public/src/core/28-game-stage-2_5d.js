/* Semantic game events -> 2.5D camera/impact presentation. */
(function installGameStage25D(root){
  'use strict';
  let marker=null,timer=null,last=null;
  function clear(){if(timer){clearTimeout(timer);timer=null;}if(marker&&marker.isConnected)marker.remove();marker=null;}
  function impact(event){
    const area=typeof document!=='undefined'&&document.getElementById('board-area');if(!area)return false;clear();
    const surface=area.querySelector&&area.querySelector('.gomoku-wave-b-board-frame,.gomoku-board')||area;
    const row=Math.max(0,Math.min(14,Number(event.row)||0)),col=Math.max(0,Math.min(14,Number(event.col)||0)),size=Math.max(2,Number(event.size)||15);
    marker=document.createElement('span');marker.className='game-impact25d';marker.setAttribute('aria-hidden','true');marker.style.left=((col+.5)/size*100).toFixed(3)+'%';marker.style.top=((row+.5)/size*100).toFixed(3)+'%';surface.appendChild(marker);
    if(root.CameraSystem25D)root.CameraSystem25D.shake({target:surface,focus:'lastMove',intensity:event.terminal?2.2:1.15,duration:.18});
    timer=setTimeout(clear,event.reducedMotion?180:620);return true;
  }
  function emit(value){
    const event=value&&typeof value==='object'?value:{type:String(value||'')};last={...event,at:Date.now()};
    if(event.type==='piece_landed'&&event.game==='gomoku')return impact(event);
    if(event.type==='result'){if(root.CameraSystem25D)root.CameraSystem25D.to('result',{target:document.getElementById('board-area'),focus:event.outcome||'result'});if(root.GhostMascot25D)root.GhostMascot25D.result(event.outcome);return true;}
    if(event.type==='exit'){clear();if(root.PageTransition25D)root.PageTransition25D.exitGame();return true;}
    return false;
  }
  const api=Object.freeze({emit,clear,snapshot:()=>Object.freeze({last,marker:!!marker})});root.GameStage25D=api;root.emitGameStage25DEvent=emit;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
