/* Semantic game events -> 2.5D camera/impact presentation. */
(function installGameStage25D(root){
  'use strict';
  const PHASES=Object.freeze({
    ludo:Object.freeze(['move','capture','takeoff','finish','ranking']),
    monopoly:Object.freeze(['walk','land','buy','event','auction','turn-end','terminal']),
    xiangqi:Object.freeze(['move','capture','check','terminal']),
    tetris:Object.freeze(['lock','line-clear','combo','b2b','t-spin','perfect-clear','garbage','terminal']),
    tank:Object.freeze(['spawn','fire','hit','ko','score','terminal']),
  });
  const IMPACT_PHASES=new Set(['capture','takeoff','finish','fire','hit','ko','lock','line-clear','combo','b2b','t-spin','perfect-clear','garbage']);
  const RESULT_PHASES=new Set(['ranking','terminal']);
  const FX_PROFILES=Object.freeze({
    ludo:Object.freeze({move:{kind:'sweep',tone:'motion',intensity:.72},capture:{kind:'burst',tone:'danger',intensity:1.45},takeoff:{kind:'lift',tone:'energy',intensity:1.08},finish:{kind:'burst',tone:'success',intensity:1.55},ranking:{kind:'result',tone:'success',intensity:.9}}),
    monopoly:Object.freeze({walk:{kind:'sweep',tone:'motion',intensity:.68},land:{kind:'ring',tone:'energy',intensity:.78},buy:{kind:'focus',tone:'success',intensity:.82},event:{kind:'burst',tone:'mystic',intensity:1.05},auction:{kind:'focus',tone:'warning',intensity:.9},'turn-end':{kind:'none',tone:'motion',intensity:.55},terminal:{kind:'result',tone:'success',intensity:1}}),
    xiangqi:Object.freeze({move:{kind:'sweep',tone:'motion',intensity:.7},capture:{kind:'slash',tone:'danger',intensity:1.5},check:{kind:'focus',tone:'danger',intensity:1.12},terminal:{kind:'result',tone:'danger',intensity:1}}),
    tetris:Object.freeze({lock:{kind:'ring',tone:'energy',intensity:.9},'line-clear':{kind:'sweep',tone:'energy',intensity:1.25},combo:{kind:'burst',tone:'warning',intensity:1.4},b2b:{kind:'burst',tone:'mystic',intensity:1.5},'t-spin':{kind:'spin',tone:'mystic',intensity:1.65},'perfect-clear':{kind:'result',tone:'success',intensity:1.72},garbage:{kind:'slash',tone:'danger',intensity:1.25},terminal:{kind:'result',tone:'energy',intensity:1}}),
    tank:Object.freeze({spawn:{kind:'ring',tone:'success',intensity:.9},fire:{kind:'slash',tone:'warning',intensity:1.05},hit:{kind:'burst',tone:'danger',intensity:1.3},ko:{kind:'burst',tone:'danger',intensity:1.85},score:{kind:'focus',tone:'success',intensity:.9},terminal:{kind:'result',tone:'warning',intensity:1}}),
  });
  const SURFACE_SELECTOR='.gomoku-wave-b-board-frame,.gomoku-board,.ludo-wave-b-board-frame,.ludo-board,.monopoly-wave-b-board-frame,.monopoly-wave-b-board,.m-board,.xiangqi-wave-c-stage,.xiangqi-board,.tetris-wave-b-main-well,.tetris-well,.tank-board';
  let marker=null,timer=null,recoveryTimer=null,effectNode=null,effectTimer=null,effectHost=null,phaseSurface=null,phaseArea=null,last=null,destroyed=false;
  function cancelRecovery(){if(recoveryTimer){clearTimeout(recoveryTimer);recoveryTimer=null;}}
  function clearEffect(){if(effectTimer){clearTimeout(effectTimer);effectTimer=null;}if(effectNode&&effectNode.isConnected)effectNode.remove();effectNode=null;if(effectHost&&effectHost.classList)effectHost.classList.remove('game-stage-fx-host25d');effectHost=null;}
  function clearPhaseState(){for(const node of [phaseSurface,phaseArea]){if(!node||!node.dataset)continue;delete node.dataset.gameStage25dPhase;delete node.dataset.gameStage25dGame;delete node.dataset.gameStage25dTone;}phaseSurface=null;phaseArea=null;}
  function clear(){if(timer){clearTimeout(timer);timer=null;}cancelRecovery();clearEffect();clearPhaseState();if(marker&&marker.isConnected)marker.remove();marker=null;}
  function reduced(event){if(event&&event.reducedMotion===true)return true;try{return !!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(_error){return false;}}
  function spectatorView(){try{return !!(typeof online!=='undefined'&&online&&(online.isSpectator||online.spectatorRoom));}catch(_error){return false;}}
  function cameraTo(mode,request){
    if(!root.CameraSystem25D)return null;
    if(spectatorView()&&typeof root.CameraSystem25D.spectatorTo==='function')return root.CameraSystem25D.spectatorTo(mode,{...(request||{}),composition:'spectator-neutral'});
    return root.CameraSystem25D.to(mode,request);
  }
  function setStyleVariable(node,name,value){if(!node||!node.style)return;try{if(typeof node.style.setProperty==='function')node.style.setProperty(name,value);else node.style[name]=value;}catch(_error){}}
  function profileFor(game,phaseName){const gameProfiles=FX_PROFILES[game];return gameProfiles&&gameProfiles[phaseName]||Object.freeze({kind:'none',tone:'motion',intensity:.65});}
  function surfaceFor(area){return area&&area.querySelector&&area.querySelector(SURFACE_SELECTOR)||area;}
  function markPhase(area,surface,game,phaseName,profile){phaseArea=area;phaseSurface=surface;for(const node of [area,surface]){if(!node||!node.dataset)continue;node.dataset.gameStage25dGame=game;node.dataset.gameStage25dPhase=phaseName;node.dataset.gameStage25dTone=profile.tone;}}
  function effectCount(kind,isReduced){if(isReduced||kind==='none'||kind==='focus')return 0;const compact=typeof root.innerWidth==='number'&&root.innerWidth<=640;if(kind==='result')return compact?4:6;if(kind==='burst'||kind==='spin')return compact?3:5;return compact?2:4;}
  function spawnEffect(area,surface,event,profile){
    clearEffect();if(!profile||profile.kind==='none'||typeof document==='undefined')return false;
    const isReduced=reduced(event),host=profile.kind==='result'?area:surface;if(!host||typeof host.appendChild!=='function')return false;
    effectHost=host;if(host.classList)host.classList.add('game-stage-fx-host25d');
    effectNode=document.createElement('span');effectNode.className='game-phase-fx25d';effectNode.setAttribute('aria-hidden','true');effectNode.dataset.fxKind=profile.kind;effectNode.dataset.fxTone=profile.tone;effectNode.dataset.fxMotion=isReduced?'static':'animated';
    const core=document.createElement('span');core.className='game-phase-fx25d-core';effectNode.appendChild(core);
    const count=effectCount(profile.kind,isReduced);for(let index=0;index<count;index++){
      const ray=document.createElement('span');ray.className='game-phase-fx25d-ray';setStyleVariable(ray,'--fx-angle',(index*360/Math.max(1,count)+(profile.kind==='spin'?22:0)).toFixed(2)+'deg');setStyleVariable(ray,'--fx-delay',(index*.026).toFixed(3)+'s');effectNode.appendChild(ray);
      if(profile.kind==='burst'||profile.kind==='spin'||profile.kind==='result'){
        const particle=document.createElement('span');particle.className='game-phase-fx25d-particle';setStyleVariable(particle,'--fx-angle',(index*360/Math.max(1,count)+18).toFixed(2)+'deg');setStyleVariable(particle,'--fx-distance',(34+index%3*9)+'px');setStyleVariable(particle,'--fx-delay',(index*.032).toFixed(3)+'s');effectNode.appendChild(particle);
      }
    }
    host.appendChild(effectNode);effectTimer=setTimeout(clearEffect,isReduced?180:(profile.kind==='result'?900:680));return true;
  }
  function eventDirection(event,phaseName){const value=Number(event&&event.detail);if(Number.isFinite(value))return Math.abs(Math.floor(value))%2?-1:1;return String(phaseName||'').length%2?-1:1;}
  function impact(event){
    const area=typeof document!=='undefined'&&document.getElementById('board-area');if(!area)return false;clear();
    const surface=area.querySelector&&area.querySelector('.gomoku-wave-b-board-frame,.gomoku-board')||area;
    const row=Math.max(0,Math.min(14,Number(event.row)||0)),col=Math.max(0,Math.min(14,Number(event.col)||0)),size=Math.max(2,Number(event.size)||15);
    const profile={kind:'ring',tone:event.terminal?'success':'warning',intensity:event.terminal?2.2:1.15};markPhase(area,surface,'gomoku','piece-landed',profile);
    marker=document.createElement('span');marker.className='game-impact25d';marker.setAttribute('aria-hidden','true');marker.dataset.fxTone=profile.tone;marker.dataset.fxMotion=reduced(event)?'static':'animated';
    const fallbackX=5+col/Math.max(1,size-1)*90,fallbackY=5+row/Math.max(1,size-1)*90;
    const xPct=Number.isFinite(Number(event.xPct))?Math.max(0,Math.min(100,Number(event.xPct))):fallbackX;
    const yPct=Number.isFinite(Number(event.yPct))?Math.max(0,Math.min(100,Number(event.yPct))):fallbackY;
    marker.style.left=xPct.toFixed(3)+'%';marker.style.top=yPct.toFixed(3)+'%';
    const core=document.createElement('span');core.className='game-impact25d-core';marker.appendChild(core);
    if(!reduced(event))for(let index=0;index<8;index++){
      const ray=document.createElement('span');ray.className='game-impact25d-ray';setStyleVariable(ray,'--impact-angle',(index*45+index%2*7)+'deg');setStyleVariable(ray,'--impact-delay',(index*.018).toFixed(3)+'s');marker.appendChild(ray);
      if(index%2===0){const mote=document.createElement('span');mote.className='game-impact25d-mote';setStyleVariable(mote,'--impact-angle',(index*45+22)+'deg');setStyleVariable(mote,'--impact-distance',(25+(index%3)*7)+'px');setStyleVariable(mote,'--impact-delay',(index*.022).toFixed(3)+'s');marker.appendChild(mote);}
    }
    surface.appendChild(marker);
    cameraTo('impact',{target:surface,focus:spectatorView()?'spectator:impact':'lastMove',intensity:profile.intensity,direction:spectatorView()?1:(col<(size-1)/2?-1:1),duration:.14});
    timer=setTimeout(()=>{if(timer){clearTimeout(timer);timer=null;}if(marker&&marker.isConnected)marker.remove();marker=null;clearPhaseState();if(spectatorView())cameraTo('overview',{target:surface,focus:'spectator:overview',duration:reduced(event)?.08:.16});else if(root.CameraSystem25D)root.CameraSystem25D.to('active',{target:surface,focus:'turn',duration:reduced(event)?.08:.16});},reduced(event)?180:620);return true;
  }
  function phase(event){
    const game=String(event.game||''),phaseName=String(event.phase||'');
    if(!PHASES[game]||!PHASES[game].includes(phaseName))return false;
    const area=typeof document!=='undefined'&&document.getElementById('board-area');if(!area)return false;
    const surface=surfaceFor(area),profile=profileFor(game,phaseName),isReduced=reduced(event),mode=RESULT_PHASES.has(phaseName)?'result':(IMPACT_PHASES.has(phaseName)?'impact':(phaseName==='spawn'?'enter':(phaseName==='select'||phaseName==='check'||phaseName==='auction'||phaseName==='buy'?'focus':'active')));
    if(mode==='result')clear();else{cancelRecovery();clearEffect();clearPhaseState();}
    markPhase(area,surface,game,phaseName,profile);spawnEffect(area,surface,event,profile);
    if(root.CameraSystem25D){
      const request={target:surface,stage:document.getElementById('screen-game'),focus:game+':'+phaseName,duration:isReduced?.08:.18,intensity:profile.intensity,direction:eventDirection(event,phaseName)};
      if(mode==='impact'){
        cameraTo('impact',{...request,focus:spectatorView()?'spectator:impact':request.focus});
        recoveryTimer=setTimeout(()=>{recoveryTimer=null;if(spectatorView())cameraTo('overview',{...request,focus:'spectator:overview',duration:isReduced?.08:.16});else if(root.CameraSystem25D)root.CameraSystem25D.to('active',{...request,focus:game+':active',duration:isReduced?.08:.16});},isReduced?180:300);
      }
      else cameraTo(mode,request);
    }
    if(mode==='result'&&root.GhostMascot25D)root.GhostMascot25D.result(event.outcome||'draw',{camera:false});
    return true;
  }
  function emit(value){
    if(destroyed)return false;
    const event=value&&typeof value==='object'?value:{type:String(value||'')};last={...event,at:Date.now()};
    if(event.type==='piece_landed'&&event.game==='gomoku')return impact(event);
    if((event.type==='phase'||event.type==='motion')&&event.game)return phase(event);
    if(event.type==='result'){
      clear();const area=typeof document!=='undefined'?document.getElementById('board-area'):null;
      const surface=surfaceFor(area),profile={kind:'result',tone:event.outcome==='win'?'success':(event.outcome==='loss'?'danger':'energy'),intensity:1};markPhase(area,surface,String(event.game||'game'),'terminal',profile);spawnEffect(area,surface,event,profile);
      cameraTo('result',{target:surface||area,stage:typeof document!=='undefined'&&document.getElementById('screen-game'),focus:spectatorView()?'spectator:result':event.outcome||'result'});
      if(root.GhostMascot25D)root.GhostMascot25D.result(event.outcome||'draw',{camera:false});
      return true;
    }
    if(event.type==='exit'){clear();if(root.PageTransition25D)root.PageTransition25D.exitGame();return true;}
    return false;
  }
  function onVisibilityChange(){if(typeof document!=='undefined'&&document.hidden)clear();}
  function destroy(){if(destroyed)return;destroyed=true;clear();if(typeof document!=='undefined'&&document.removeEventListener)document.removeEventListener('visibilitychange',onVisibilityChange);}
  if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',onVisibilityChange);
  const api=Object.freeze({FX_PROFILES,emit,clear,destroy,snapshot:()=>Object.freeze({last,marker:!!marker,effect:effectNode&&effectNode.dataset?Object.freeze({kind:effectNode.dataset.fxKind,tone:effectNode.dataset.fxTone,motion:effectNode.dataset.fxMotion}):null,destroyed})});root.GameStage25D=api;root.emitGameStage25DEvent=emit;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
