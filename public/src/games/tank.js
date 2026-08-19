/* ================= 坦克大战 · Real-Time Arena ================= */
function gameTank(area, extra, n, opts){
  opts = opts || {};
  const playerCount = Math.max(2, Math.min(5, Number(n) || 2));
  const W = playerCount > 4 ? 17 : 15, H = 13;
  const FIXED_MS = 50, MATCH_MS = Math.max(10000, Number(opts.matchDurationMs) || 180000);
  const RELAY_PROTOCOL = 'tank-host-relay-v1', HOST_PLAYER = 0;
  const AUTH_PROTOCOL = 'tank-authority-v1';
  const authorityMode = !!(opts.online && opts.gameplayMeta && opts.gameplayMeta.protocol === AUTH_PROTOCOL && typeof opts.sendTankInput === 'function');
  const RELAY_SNAPSHOT_MS = Math.max(200, Math.min(1000, Number(opts.relaySnapshotMs) || 400));
  const DIRS = [[0,-1],[1,0],[0,1],[-1,0]]; // 上右下左
  const SPAWNS = [[1.5,1.5],[W-2.5,H-2.5],[W-2.5,1.5],[1.5,H-2.5],[Math.floor(W/2)+.5,Math.floor(H/2)+.5]];
  const SEASONS = ['spring','summer','autumn','winter'];
  const seasonLabel=value=>t('tank_season_'+value);
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  const previousDisplay = area.style.display || '', previousFlexDirection = area.style.flexDirection || '', previousAlignItems = area.style.alignItems || '', previousJustifyContent = area.style.justifyContent || '';
  area.style.touchAction = 'none'; area.style.overscrollBehavior = 'contain'; area.style.display = 'flex'; area.style.flexDirection = 'column'; area.style.alignItems = 'center'; area.style.justifyContent = 'flex-start';

  let grid = [], tanks = [], bullets = [], traces = [], effects = [];
  let over = false, winner = -1, cur = 0, destroyed = false;
  let startedAt = Date.now(), finishedAt = 0, remainingMs = MATCH_MS, lastLoopAt = Date.now(), accumulator = 0;
  let bulletSequence = 0, inputSequence = 0, authoritySequence = 0, lastAuthoritySequence = -1, aiEpoch = 0;
  let lastInputSequence = Array(playerCount).fill(-1), relayMatchId = '', resultCommitted = false, lastRelayAt = 0;
  let spectator = !!opts.spectator;
  let authorityServerTick = 0, authorityEndAt = 0;
  let season = chooseSeason(matchSeed());
  let cosmetic = { default:'classic', players:{}, ...(opts.cosmetic || {}) };
  let lastRenderAt = 0;
  const performanceStats={samples:0,lastFrameMs:0,maxFrameMs:0,longFrames:0};
  const transientTimers=new Set();
  const tankInputGateRequested=authorityMode&&tankTechnicalFeature('gameplayInputGateV1');
  let tankInputGate=null,tankInputGateGeneration=0,tankInputGateRevision=0,tankInputSemanticSequence=0;
  let tankInputDispatchAttempted=false,tankInputDispatchResult=false;
  const tankPredictionRequested=authorityMode&&tankTechnicalFeature('tankPredictionV1');
  let tankPredictionAdapter=null,tankPredictionMatchId=null,tankPredictionGeneration=0;
  const tankFeedbackRequested=tankTechnicalFeature('feedbackBusV1');
  const tankSpatialAudioRequested=tankFeedbackRequested&&tankTechnicalFeature('tankSpatialAudioV1');
  const tankHapticsRequested=tankFeedbackRequested&&tankTechnicalFeature('hapticsV1');
  let tankFeedbackBus=null,tankFeedbackAdapter=null,tankFeedbackSession=0,tankFeedbackCueSequence=0,tankMoveCueAt=0,tankMoveCueDirection=-1;
  let tankAudioAuthorityBaseline=null,tankAudioAuthorityMoveTick=-Infinity;
  const acceptedAudioCue = typeof emitAcceptedAudioCue === 'function' ? emitAcceptedAudioCue : null;
  const audioCue = (type, context, intensity, pan) => {
    let result = null;
    try {
      if (acceptedAudioCue) {
        result = acceptedAudioCue(type, context, intensity, pan);
        if (!result || result.reason !== 'unavailable') return result;
      } else if (typeof playFeedback === 'function') {
        const fallbackContext = context && typeof context === 'object' ? { ...context, audioType:type } : { audioType:type };
        return playFeedback(fallbackContext.reaction || 'tap', fallbackContext);
      }
    } catch (_error) {
      return { accepted:false, reason:'error' };
    }
    // Compatibility for the former default-off T3 Tank pilot. The unified
    // runtime is always attempted first; this path exists only in old/test
    // bundles where emitAudioCue is genuinely unavailable.
    if (result && result.reason === 'unavailable' && tankFeedbackBus) {
      const x = Number.isFinite(pan) ? (Math.max(-1,Math.min(1,pan)) + 1) * (Math.max(2,W)-1) / 2 : (Math.max(2,W)-1) / 2;
      const id = context && typeof context.actionId === 'string' ? context.actionId : undefined;
      const accepted = type === 'tank_fire'
        ? emitTankFeedback('tank_fire',x,intensity,id)
        : type === 'tank_hit' ? emitTankFeedback('tank_hit',x,intensity,id) : false;
      if (accepted) return { accepted:true, reason:'legacy_fallback' };
    }
    return result || { accepted:false, reason:'unavailable' };
  };
  // Wave C is presentation-only.  Keep its process/timers outside snapshots
  // so authority, input sequencing and replay payloads remain unchanged.
  const TANK_WAVE_C_PROCESS_STEPS = ['spawn','ready','move','fire','hit','ko','score','terminal'];
  let tankWaveCProcess = 'spawn', tankWaveCProcessDetail = '', tankWaveCProcessEpoch = 0, tankWaveCProcessRevision = 0;
  const tankWaveCProcessTimers = new Set();
  let tankWaveCProcessRail = null, tankWaveCProcessLabel = null, tankWaveCProcessSteps = [];
  let tankWaveCMoveQuietTimer = null, tankWaveCMoveQuietRevision = 0;
  const renderObjectIds=new WeakMap();
  let nextRenderObjectId=0,lastPlayersSignature='',lastStatusText='',victoryShown=false;
  const renderNodes={board:null,staticCells:new Map(),traces:new Map(),bullets:new Map(),tanks:new Map(),respawns:new Map(),effects:new Map(),time:null,scores:[]};

  function tankTechnicalFeature(name){
    try{return !!(opts&&opts.technicalFeatures&&opts.technicalFeatures[name]===true);}catch(_error){return false;}
  }
  function tankInputSessionId(){
    let value='';
    try{value=String(currentMatchId()||'');}catch(_error){value='';}
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)?value:'tank-session-'+Math.max(1,tankInputGateRevision);
  }
  function resetTankInputGate(){
    if(!tankInputGateRequested||typeof GameplayInputGate==='undefined'||!GameplayInputGate||typeof GameplayInputGate.create!=='function'){
      if(tankInputGate&&typeof tankInputGate.dispose==='function')tankInputGate.dispose();
      tankInputGate=null;tankInputGateGeneration=0;tankInputSemanticSequence=0;return false;
    }
    if(!tankInputGate){
      try{
        tankInputGate=GameplayInputGate.create({bufferMs:75,onIntent(intent){
          tankInputDispatchAttempted=true;tankInputDispatchResult=applyTankControlIntent(intent);
        }});
      }catch(_error){tankInputGate=null;return false;}
    }
    const revision=++tankInputGateRevision;
    let opened=null;
    try{opened=tankInputGate.reset({gameId:'tank',matchId:tankInputSessionId(),revision,enabled:true,bufferMs:75});}catch(_error){opened=null;}
    if(!opened||opened.accepted!==true){
      try{tankInputGate.dispose();}catch(_error){}
      tankInputGate=null;tankInputGateGeneration=0;tankInputSemanticSequence=0;return false;
    }
    tankInputGateGeneration=opened.generation;tankInputSemanticSequence=0;return true;
  }
  function disposeTankInputGate(){
    if(tankInputGate&&typeof tankInputGate.dispose==='function'){try{tankInputGate.dispose();}catch(_error){}}
    tankInputGate=null;tankInputGateGeneration=0;tankInputSemanticSequence=0;
  }
  function tankPredictionAvailable(){
    return tankPredictionRequested&&!spectator&&typeof TankPredictionAdapter!=='undefined'&&TankPredictionAdapter&&typeof TankPredictionAdapter.create==='function';
  }
  function disposeTankPrediction(){
    if(tankPredictionAdapter&&typeof tankPredictionAdapter.dispose==='function'){try{tankPredictionAdapter.dispose();}catch(_error){}}
    tankPredictionAdapter=null;tankPredictionMatchId=null;tankPredictionGeneration=0;
  }
  function resetTankPrediction(reason){
    if(!tankPredictionAvailable()){disposeTankPrediction();return false;}
    const matchId=tankInputSessionId(),playerIndex=controlledPlayer();
    if(tankPredictionAdapter&&tankPredictionMatchId===matchId){
      let reset=null;try{reset=tankPredictionAdapter.reset(reason||'reset');}catch(_error){reset=null;}
      if(reset&&reset.accepted===true){tankPredictionGeneration=reset.generation;return true;}
      disposeTankPrediction();
    }
    try{
      tankPredictionAdapter=TankPredictionAdapter.create({enabled:true,matchId,playerIndex,generation:0,maxUnacked:8,smoothingMs:100});
      tankPredictionMatchId=matchId;tankPredictionGeneration=0;return true;
    }catch(_error){disposeTankPrediction();return false;}
  }
  function submitTankPrediction(sequence,clientTick,input){
    if(!tankPredictionAdapter||tankPredictionMatchId!==tankInputSessionId())return null;
    try{return tankPredictionAdapter.submitLocalInput({matchId:tankPredictionMatchId,generation:tankPredictionGeneration,seq:sequence,clientTick,input:{...input}});}catch(_error){return null;}
  }
  function acceptTankPrediction(state){
    if(!tankPredictionAdapter||tankPredictionMatchId!==tankInputSessionId())return null;
    try{return tankPredictionAdapter.acceptAuthority(state);}catch(_error){return null;}
  }
  function tankFeedbackEnvironment(hidden){
    return{enabled:true,hidden:hidden===true,reducedMotion:tankGhost3DReducedMotion(),reducedEffects:false,muted:false,audioEnabled:tankSpatialAudioRequested,hapticsEnabled:tankHapticsRequested};
  }
  function tankUnifiedFeedbackAvailable(){
    return typeof emitAcceptedAudioCue === 'function' && typeof emitAudioCue === 'function';
  }
  function tankAudioContextFactory(){
    try{
      const Factory=(typeof AudioContext!=='undefined'&&AudioContext)||(typeof webkitAudioContext!=='undefined'&&webkitAudioContext);
      return Factory?new Factory():null;
    }catch(_error){return null;}
  }
  function tankVibrate(duration){
    try{return typeof navigator!=='undefined'&&navigator&&typeof navigator.vibrate==='function'?navigator.vibrate(duration):false;}catch(_error){return false;}
  }
  function initializeTankFeedback(){
    if(tankUnifiedFeedbackAvailable())return false;
    if(!tankFeedbackRequested||(!tankSpatialAudioRequested&&!tankHapticsRequested)||typeof FeedbackBus==='undefined'||!FeedbackBus||typeof FeedbackBus.create!=='function'||typeof LocalFeedbackAdapter==='undefined'||!LocalFeedbackAdapter||typeof LocalFeedbackAdapter.create!=='function')return false;
    if(!tankFeedbackBus){
      try{tankFeedbackBus=FeedbackBus.create({environment:tankFeedbackEnvironment(typeof document!=='undefined'&&document.visibilityState==='hidden')});}catch(_error){tankFeedbackBus=null;}
    }
    if(!tankFeedbackBus)return false;
    if(!tankFeedbackAdapter){
      try{tankFeedbackAdapter=LocalFeedbackAdapter.create({enabled:true,bus:tankFeedbackBus,audioContextFactory:tankAudioContextFactory,vibrate:tankVibrate});}catch(_error){tankFeedbackAdapter=null;}
    }
    return !!tankFeedbackAdapter;
  }
  function resetTankFeedback(){
    disposeTankFeedback();tankFeedbackSession++;tankFeedbackCueSequence=0;return initializeTankFeedback();
  }
  function disposeTankFeedback(){
    if(tankFeedbackAdapter&&typeof tankFeedbackAdapter.dispose==='function'){try{tankFeedbackAdapter.dispose();}catch(_error){}}
    if(tankFeedbackBus&&typeof tankFeedbackBus.dispose==='function'){try{tankFeedbackBus.dispose();}catch(_error){}}
    tankFeedbackAdapter=null;tankFeedbackBus=null;
  }
  function unlockTankFeedback(){
    if(!tankSpatialAudioRequested||!initializeTankFeedback()||!tankFeedbackAdapter||typeof tankFeedbackAdapter.unlock!=='function')return false;
    try{return tankFeedbackAdapter.unlock().accepted===true;}catch(_error){return false;}
  }
  function setTankFeedbackHidden(hidden){
    if(!tankFeedbackBus||typeof tankFeedbackBus.setEnvironment!=='function')return false;
    try{return tankFeedbackBus.setEnvironment({hidden:hidden===true,reducedMotion:tankGhost3DReducedMotion()}).accepted===true;}catch(_error){return false;}
  }
  function tankFeedbackPan(x){return Math.max(-1,Math.min(1,((Number(x)||0)/(Math.max(2,W)-1))*2-1));}
  function emitTankFeedback(type,x,intensity,id){
    if(!initializeTankFeedback()||!tankFeedbackBus||typeof tankFeedbackBus.emit!=='function')return false;
    const cueId=id||('tank-'+type.replace('tank_','')+'-'+tankFeedbackSession+'-'+(++tankFeedbackCueSequence));
    try{return tankFeedbackBus.emit({type,id:cueId,intensity:Math.max(0,Math.min(1,Number(intensity)||1)),pan:tankFeedbackPan(x)}).accepted===true;}catch(_error){return false;}
  }

  // Tank Ghost3D P5 is a deliberately narrow default presentation seam. The
  // presenter is allowed to see a frozen local commit or a cropped accepted
  // Authority receipt, never the input, relay, socket, reward, replay, or
  // full game-state objects used by this game.
  const TANK_GHOST3D_WAVE_B_STORAGE_KEY='mg_art_game_stage_wave_b_v1';
  const TANK_GHOST3D_STORAGE_KEY='mg_ghost3d_tank_v1';
  const TANK_GHOST3D_QUALITY_STORAGE_KEY='mg_ghost3d_tank_quality_v1';
  const TANK_GHOST3D_QUALITIES=new Set(['HIGH','BALANCED','LOW']);
  let tankGhost3DPresenter=null,tankGhost3DCommitActive=false;
  let tankGhost3DLocalEpoch=0,tankGhost3DResetEpoch=0,tankGhost3DSourceEpoch=0;
  let tankGhost3DLocalCommitted=false,tankGhost3DLocalDirty=true;
  let tankGhost3DAuthorityReceipt=null,tankGhost3DAuthorityReceiptEpoch=0,tankGhost3DAuthorityReceiptFingerprint='',tankGhost3DAuthoritySource='reconcile',tankGhost3DForcedDomOnly=false;

  function tankGhost3DNextEpoch(value){
    return Number.isSafeInteger(value)&&value<Number.MAX_SAFE_INTEGER?value+1:0;
  }
  function tankGhost3DStorage(){
    try{
      const storage=typeof window!=='undefined'&&window?window.localStorage:(typeof localStorage!=='undefined'?localStorage:null);
      return storage&&typeof storage.getItem==='function'?storage:null;
    }catch(_error){return null;}
  }
  function tankGhost3DWaveBActive(){
    const storage=tankGhost3DStorage();
    try{return !!storage&&storage.getItem(TANK_GHOST3D_WAVE_B_STORAGE_KEY)!=='0';}catch(_error){return false;}
  }
  function tankGhost3DEnabled(){
    const storage=tankGhost3DStorage();
    try{return !!storage&&storage.getItem(TANK_GHOST3D_WAVE_B_STORAGE_KEY)!=='0'&&storage.getItem(TANK_GHOST3D_STORAGE_KEY)==='1';}catch(_error){return false;}
  }
  function tankGhost3DQuality(){
    const storage=tankGhost3DStorage();
    try{const quality=storage?storage.getItem(TANK_GHOST3D_QUALITY_STORAGE_KEY):null;return TANK_GHOST3D_QUALITIES.has(quality)?quality:'BALANCED';}catch(_error){return 'BALANCED';}
  }
  function tankGhost3DReducedMotion(){
    try{
      if(typeof prefersReducedMotion==='function')return prefersReducedMotion()===true;
      return !!(typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }catch(_error){return false;}
  }
  function tankGhost3DReplay(){
    try{return !!(opts.isReplaying&&opts.isReplaying());}catch(_error){return true;}
  }
  function tankGhost3DShellActive(){
    try{
      if(typeof document==='undefined'||!document||typeof document.getElementById!=='function')return true;
      const stage=document.getElementById('screen-game');
      if(!stage||!stage.dataset)return false;
      if(stage.dataset.shellActive!=='true'||stage.dataset.shellGame!=='tank')return false;
      return !(stage.classList&&stage.classList.contains&&stage.classList.contains('hidden'));
    }catch(_error){return false;}
  }
  function tankGhost3DValue(value,key){try{return value&&value[key];}catch(_error){return undefined;}}
  function tankGhost3DPlainRecord(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    try{return Object.prototype.toString.call(value)==='[object Object]';}catch(_error){return false;}
  }
  function tankGhost3DFreeze(value){
    if(Array.isArray(value))return Object.freeze(value.map(tankGhost3DFreeze));
    if(value&&typeof value==='object'){
      const copy={};Object.keys(value).forEach(key=>{copy[key]=tankGhost3DFreeze(value[key]);});return Object.freeze(copy);
    }
    return value;
  }
  function tankGhost3DCopyGrid(value){
    if(!Array.isArray(value)||value.length!==H)return null;
    const copied=[];
    for(let row=0;row<H;row++){
      const source=value[row];if(!Array.isArray(source)||source.length!==W)return null;
      const next=[];for(let column=0;column<W;column++)next.push(source[column]);copied.push(next);
    }
    return copied;
  }
  function tankGhost3DCropAuthorityReceipt(state){
    if(!tankGhost3DPlainRecord(state))return null;
    const rawPlayers=tankGhost3DValue(state,'players'),rawProjectiles=tankGhost3DValue(state,'projectiles');
    const cells=tankGhost3DCopyGrid(tankGhost3DValue(state,'destructibles'));
    if(!Array.isArray(rawPlayers)||rawPlayers.length!==playerCount||!Array.isArray(rawProjectiles)||!cells)return null;
    const players=[];
    for(let index=0;index<rawPlayers.length;index++){
      const raw=rawPlayers[index];if(!tankGhost3DPlainRecord(raw))return null;
      players.push({id:tankGhost3DValue(raw,'id'),x:tankGhost3DValue(raw,'x'),y:tankGhost3DValue(raw,'y'),d:tankGhost3DValue(raw,'d'),hp:tankGhost3DValue(raw,'hp'),alive:tankGhost3DValue(raw,'alive'),invulnerableUntil:tankGhost3DValue(raw,'invulnerableUntil'),shots:tankGhost3DValue(raw,'shots'),hits:tankGhost3DValue(raw,'hits'),kills:tankGhost3DValue(raw,'kills'),deaths:tankGhost3DValue(raw,'deaths'),damage:tankGhost3DValue(raw,'damage')});
    }
    const projectiles=[];
    for(let index=0;index<rawProjectiles.length;index++){
      const raw=rawProjectiles[index];if(!tankGhost3DPlainRecord(raw))return null;
      projectiles.push({id:tankGhost3DValue(raw,'id'),owner:tankGhost3DValue(raw,'owner'),x:tankGhost3DValue(raw,'x'),y:tankGhost3DValue(raw,'y'),d:tankGhost3DValue(raw,'d')});
    }
    const rawOrder=tankGhost3DValue(state,'order');
    const order=Array.isArray(rawOrder)?rawOrder.slice():rawOrder;
    return tankGhost3DFreeze({protocol:tankGhost3DValue(state,'protocol'),matchId:tankGhost3DValue(state,'matchId'),serverTick:tankGhost3DValue(state,'serverTick'),serverNow:tankGhost3DValue(state,'serverNow'),season:tankGhost3DValue(state,'season'),destructibles:cells,players,projectiles,status:tankGhost3DValue(state,'status'),finished:tankGhost3DValue(state,'finished'),order});
  }
  function tankGhost3DAuthorityFingerprint(receipt){
    if(!receipt)return '';
    try{return JSON.stringify({protocol:receipt.protocol,matchId:receipt.matchId,serverTick:receipt.serverTick,season:receipt.season,destructibles:receipt.destructibles,players:receipt.players,projectiles:receipt.projectiles,status:receipt.status,finished:receipt.finished,order:receipt.order});}catch(_error){return '';}
  }
  function tankGhost3DFailClosedAuthorityReceipt(){
    tankGhost3DForcedDomOnly=true;
    tankGhost3DAuthorityReceipt=null;tankGhost3DAuthorityReceiptFingerprint='';tankGhost3DAuthoritySource='reconcile';
    disposeTankGhost3DPresenter();
  }
  function tankGhost3DRememberAuthorityReceipt(state,silent){
    const serverTick=tankGhost3DValue(state,'serverTick');
    if(!Number.isSafeInteger(serverTick)||serverTick<0){tankGhost3DFailClosedAuthorityReceipt();return 'invalid_tick';}
    const receipt=tankGhost3DCropAuthorityReceipt(state);
    const fingerprint=tankGhost3DAuthorityFingerprint(receipt);
    if(!receipt||!fingerprint){tankGhost3DFailClosedAuthorityReceipt();return 'invalid_receipt';}
    if(serverTick<=lastAuthoritySequence){
      if(serverTick===lastAuthoritySequence&&fingerprint===tankGhost3DAuthorityReceiptFingerprint)return 'duplicate_tick';
      tankGhost3DFailClosedAuthorityReceipt();return 'conflicting_tick';
    }
    tankGhost3DAuthorityReceipt=receipt;tankGhost3DAuthorityReceiptFingerprint=fingerprint;lastAuthoritySequence=serverTick;
    tankGhost3DAuthoritySource=silent===true?'reconcile':'live';
    tankGhost3DAuthorityReceiptEpoch=tankGhost3DNextEpoch(tankGhost3DAuthorityReceiptEpoch);
    tankGhost3DSourceEpoch=tankGhost3DAuthorityReceiptEpoch;
    tankGhost3DForcedDomOnly=false;
    return 'accepted';
  }
  function tankGhost3DMarkLocalCommitted(){
    if(!opts.online)tankGhost3DLocalDirty=true;
  }
  function tankGhost3DInvalidate(clearAuthority){
    tankGhost3DResetEpoch=tankGhost3DNextEpoch(tankGhost3DResetEpoch);
    tankGhost3DSourceEpoch=tankGhost3DNextEpoch(tankGhost3DSourceEpoch);
    tankGhost3DLocalCommitted=false;tankGhost3DLocalDirty=true;
    if(clearAuthority){tankGhost3DAuthorityReceipt=null;tankGhost3DAuthorityReceiptFingerprint='';tankGhost3DAuthoritySource='reconcile';tankGhost3DAuthorityReceiptEpoch=tankGhost3DSourceEpoch;}
  }
  function tankGhost3DLocalState(){
    return {width:W,height:H,season,cells:grid.map(row=>row.slice()),tanks:tanks.map(tank=>({id:tank.id,x:tank.x,y:tank.y,d:tank.d,hp:tank.hp,alive:tank.alive===true,invulnerableUntil:tank.invulnerableUntil,shots:tank.shots,hits:tank.hits,kills:tank.kills,deaths:tank.deaths,damage:tank.damage})),projectiles:bullets.slice(0,160).map(bullet=>({id:bullet.id,owner:bullet.owner,x:bullet.x,y:bullet.y,d:bullet.d})),terminal:over===true,winner:Number.isInteger(winner)?winner:-1};
  }
  function tankGhost3DReadModel(){
    const onlineMode=!!opts.online;
    const receipt=onlineMode&&authorityMode?tankGhost3DAuthorityReceipt:null;
    return {mountElement:renderNodes.board,waveBActive:tankGhost3DWaveBActive(),online:onlineMode,authorityMode:authorityMode===true,isReplaying:tankGhost3DReplay(),expectedMatchId:currentMatchId(),receipt,accepted:!!receipt,source:tankGhost3DAuthoritySource,receiptEpoch:tankGhost3DAuthorityReceiptEpoch,committed:!onlineMode&&tankGhost3DLocalCommitted,localState:!onlineMode?tankGhost3DLocalState():null,localEpoch:tankGhost3DLocalEpoch,resetEpoch:tankGhost3DResetEpoch,sourceEpoch:tankGhost3DSourceEpoch,playerCount,quality:tankGhost3DQuality(),reducedMotion:tankGhost3DReducedMotion(),hidden:!!(typeof document!=='undefined'&&document&&document.hidden),shellActive:tankGhost3DShellActive()};
  }
  function disposeTankGhost3DPresenter(){
    const presenter=tankGhost3DPresenter;tankGhost3DPresenter=null;
    if(presenter&&typeof presenter.dispose==='function'){try{presenter.dispose();}catch(_error){}}
  }
  function commitTankGhost3DPresenter(){
    if(tankGhost3DCommitActive)return false;
    if(!opts.online&&tankGhost3DLocalDirty){tankGhost3DLocalEpoch=tankGhost3DNextEpoch(tankGhost3DLocalEpoch);tankGhost3DLocalDirty=false;tankGhost3DLocalCommitted=true;}
    if(!tankGhost3DEnabled()||tankGhost3DForcedDomOnly||(opts.online&&(!authorityMode||!tankGhost3DAuthorityReceipt))){disposeTankGhost3DPresenter();return false;}
    if(!tankGhost3DPresenter){
      const factory=typeof TankGhost3DPresenter!=='undefined'?TankGhost3DPresenter:null;
      if(!factory||typeof factory.create!=='function')return false;
      try{tankGhost3DPresenter=factory.create(tankGhost3DReadModel);}catch(_error){tankGhost3DPresenter=null;return false;}
    }
    if(!tankGhost3DPresenter||typeof tankGhost3DPresenter.commit!=='function')return false;
    tankGhost3DCommitActive=true;
    try{tankGhost3DPresenter.commit();return true;}catch(_error){disposeTankGhost3DPresenter();return false;}finally{tankGhost3DCommitActive=false;}
  }

  // Authority/result ownership stays synchronous.  A ready optional renderer
  // may hold only the visual victory surface long enough to read its finite
  // result shot; LOW, reduced motion, import failure, DOM fallback, or a
  // missing accepted terminal frame reveal the permanent DOM result at once.
  function tankGhost3DTerminalPresentationDelay(){
    if(!tankGhost3DPresenter||typeof tankGhost3DPresenter.snapshot!=='function')return 0;
    let snapshot=null;try{snapshot=tankGhost3DPresenter.snapshot();}catch(_error){snapshot=null;}
    if(!snapshot||snapshot.ready!==true||snapshot.fallback===true||snapshot.terminal!==true||snapshot.reducedMotion===true||snapshot.quality==='LOW')return 0;
    return snapshot.quality==='HIGH'?420:320;
  }
  function retireTankGhost3DTerminalPresentation(){
    tankGhost3DInvalidate(true);tankGhost3DForcedDomOnly=true;disposeTankGhost3DPresenter();
  }
  function queueTankVictoryOverlay(){
    if(!over||victoryShown)return false;
    victoryShown=true;
    const terminalOnly = spectator || (!opts.online && !(opts.ai && typeof opts.ai.has === 'function' && opts.ai.size > 0));
    const reveal=()=>{
      if(destroyed||!over)return;
      showVictoryOverlay(area,{winner,winnerName:t('player_number',winner+1),emoji:'🏆',subtitle:t('tank_victory_subtitle'),coins:1,
        viewerSlot:terminalOnly ? null : (opts.online ? Number(opts.myIdx) : 0),
        audioType:terminalOnly ? 'match_terminal' : undefined,
        audioId:'tank-outcome-'+tankFeedbackSession+'-'+winner,
        onRestart:reset,onShare:()=>shareGameLink('tank')});
      retireTankGhost3DTerminalPresentation();
    };
    const delay=tankGhost3DTerminalPresentationDelay();
    if(delay>0)scheduleTransient(reveal,delay);else reveal();
    return true;
  }

  function clearTransientTimers(){transientTimers.forEach(timer=>clearTimeout(timer));transientTimers.clear();}
  function scheduleTransient(callback,delay){
    const timer=setTimeout(()=>{transientTimers.delete(timer);if(!destroyed)callback();},delay);
    if(timer&&typeof timer.unref==='function')timer.unref();transientTimers.add(timer);return timer;
  }
  function clearTankWaveCMoveQuietTimer(){
    tankWaveCMoveQuietRevision++;
    if (tankWaveCMoveQuietTimer !== null){
      clearTimeout(tankWaveCMoveQuietTimer);
      tankWaveCProcessTimers.delete(tankWaveCMoveQuietTimer);
      tankWaveCMoveQuietTimer = null;
    }
  }
  function clearTankWaveCProcessTimers(){
    clearTankWaveCMoveQuietTimer();
    tankWaveCProcessTimers.forEach(timer => clearTimeout(timer));
    tankWaveCProcessTimers.clear();
  }
  function scheduleTankWaveCProcess(callback, delay){
    const epoch = tankWaveCProcessEpoch;
    const timer = setTimeout(() => {
      tankWaveCProcessTimers.delete(timer);
      if (!destroyed && epoch === tankWaveCProcessEpoch) callback();
    }, Math.max(0, Number(delay) || 0));
    if (timer && typeof timer.unref === 'function') timer.unref();
    tankWaveCProcessTimers.add(timer);
    return timer;
  }
  function tankWaveCProcessText(){
    const player = Number(tankWaveCProcessDetail) + 1;
    if (tankWaveCProcess === 'spawn') return t('tank_realtime') + ' · ' + t('player_number', player);
    if (tankWaveCProcess === 'ready') return t('tank_control_hint');
    if (tankWaveCProcess === 'move') return t('tank_direction_neutral');
    if (tankWaveCProcess === 'fire') return t('tank_fire');
    if (tankWaveCProcess === 'hit') return t('tank_player_stats', player, 0, 0);
    if (tankWaveCProcess === 'ko') return t('tank_win_status', player, 0);
    if (tankWaveCProcess === 'score') return t('tank_score_line', player, 0, 0, 0);
    return t('match_over');
  }
  function tankWaveCData(node, key, value){
    if (!node) return;
    const datasetKey = key.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
    if (node.dataset) node.dataset[datasetKey] = String(value);
    if (node.setAttribute) node.setAttribute('data-' + key, String(value));
  }
  function paintTankWaveCProcess(){
    tankWaveCData(area, 'tank-process', tankWaveCProcess);
    if (renderNodes && renderNodes.board) tankWaveCData(renderNodes.board, 'tank-process', tankWaveCProcess);
    if (tankWaveCProcessRail){
      tankWaveCData(tankWaveCProcessRail, 'tank-process', tankWaveCProcess);
      if (tankWaveCProcessLabel) tankWaveCProcessLabel.textContent = tankWaveCProcessText();
      tankWaveCProcessSteps.forEach(step => {
        const active = step && step.dataset && step.dataset.tankProcessStep === tankWaveCProcess;
        tankWaveCData(step, 'tank-process-active', active ? 'true' : 'false');
        if (step && step.style){
          step.style.background = active ? 'linear-gradient(90deg,var(--accent,#435ac1),#f59e0b)' : 'rgba(76,43,21,.16)';
          step.style.boxShadow = active ? '0 2px 0 rgba(43,32,37,.2),0 5px 10px rgba(245,158,11,.28)' : 'inset 0 1px 1px rgba(255,255,255,.65)';
          step.style.transform = active && !(typeof prefersReducedMotion === 'function' && prefersReducedMotion()) ? 'translateY(-2px) scaleY(1.16)' : 'none';
        }
      });
    }
  }
  function setTankWaveCProcess(next, detail){
    const process = TANK_WAVE_C_PROCESS_STEPS.includes(next) ? next : 'ready';
    const processDetail = detail === undefined || detail === null ? '' : String(detail);
    if (process === tankWaveCProcess && processDetail === tankWaveCProcessDetail) return;
    if (process !== 'move') clearTankWaveCMoveQuietTimer();
    tankWaveCProcess = process;
    tankWaveCProcessDetail = processDetail;
    tankWaveCProcessRevision++;
    paintTankWaveCProcess();
  }
  function settleTankWaveCProcess(next, detail, delay){
    if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) { setTankWaveCProcess(next, detail); return; }
    const revision = tankWaveCProcessRevision;
    scheduleTankWaveCProcess(() => {
      if (revision === tankWaveCProcessRevision) setTankWaveCProcess(next, detail);
    }, delay);
  }
  function tankWaveCProcessBlocksMove(){
    return ['fire','hit','ko','score','spawn','terminal'].includes(tankWaveCProcess);
  }
  function noteTankWaveCMove(){
    if (tankWaveCProcessBlocksMove()) return;
    setTankWaveCProcess('move');
    if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) return;
    const revision = tankWaveCProcessRevision;
    clearTankWaveCMoveQuietTimer();
    const quietRevision = tankWaveCMoveQuietRevision;
    tankWaveCMoveQuietTimer = scheduleTankWaveCProcess(() => {
      if (quietRevision !== tankWaveCMoveQuietRevision || revision !== tankWaveCProcessRevision || tankWaveCProcess !== 'move') return;
      tankWaveCMoveQuietTimer = null;
      setTankWaveCProcess('ready');
    }, 180);
  }
  function renderObjectKey(value,prefix){
    if(!value||typeof value!=='object')return prefix+'-none';
    if(!renderObjectIds.has(value))renderObjectIds.set(value,prefix+'-'+(++nextRenderObjectId));
    return renderObjectIds.get(value);
  }
  function removeRenderNode(node){if(node&&typeof node.remove==='function')node.remove();}
  function syncRenderMap(map,items,keyFor,create,update){
    const active=new Set();
    items.forEach((item,index)=>{const key=keyFor(item,index);active.add(key);let node=map.get(key);if(!node){node=create(item,index);map.set(key,node);}update(node,item,index);});
    for(const [key,node] of map)if(!active.has(key)){removeRenderNode(node);map.delete(key);}
  }
  function removeVictoryOverlay(){const overlay=area.querySelector&&area.querySelector('.victory-overlay');if(overlay)removeRenderNode(overlay);victoryShown=false;}

  function currentMatchId(){
    const dynamic = typeof opts.getMatchId === 'function' ? opts.getMatchId() : null;
    if (dynamic) return String(dynamic);
    if (opts.matchId) return String(opts.matchId);
    if (typeof online !== 'undefined' && online && online.matchId) return String(online.matchId);
    return '';
  }
  function matchSeed(){ return currentMatchId(); }

  function chooseSeason(seed){
    if (!seed) return SEASONS[Math.floor(Math.random() * SEASONS.length) % SEASONS.length];
    let hash = 0; for (let i = 0; i < String(seed).length; i++) hash = ((hash * 31) + String(seed).charCodeAt(i)) >>> 0;
    return SEASONS[hash % SEASONS.length];
  }
  function emptyInput(){ return { up:false, right:false, down:false, left:false, fire:false }; }
  function normalizeInput(value){
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const input = emptyInput();
    Object.keys(input).forEach(key => { input[key] = source[key] === true; });
    if (input.up && input.down){ input.up = false; input.down = false; }
    if (input.left && input.right){ input.left = false; input.right = false; }
    return input;
  }
  function tankSemanticDirection(value){
    const input=normalizeInput(value),vertical=input.up?'up':(input.down?'down':''),horizontal=input.left?'left':(input.right?'right':'');
    return vertical&&horizontal?vertical+'_'+horizontal:(vertical||horizontal||'neutral');
  }
  function tankInputFromSemantic(intent){
    const input=emptyInput(),direction=String(intent&&intent.direction||'neutral');
    if(direction!=='neutral')direction.split('_').forEach(key=>{if(key==='up'||key==='down'||key==='left'||key==='right')input[key]=true;});
    input.fire=!!(intent&&intent.firing);return normalizeInput(input);
  }
  function applyTankControlIntent(intent){
    return applyPlayerInput(controlledPlayer(),tankInputFromSemantic(intent),true);
  }
  function dispatchTankInputIntent(value){
    const input=normalizeInput(value);
    if(!tankInputGate)return applyPlayerInput(controlledPlayer(),input,true);
    const sequence=++tankInputSemanticSequence;
    const intent={gameId:'tank',type:'control_state',direction:tankSemanticDirection(input),firing:input.fire,id:'tank-'+tankInputGateGeneration+'-'+sequence,sequence,generation:tankInputGateGeneration};
    let submitted=null;
    try{submitted=tankInputGate.submit(intent);}catch(_error){submitted=null;}
    if(!submitted||submitted.accepted!==true)return applyPlayerInput(controlledPlayer(),input,true);
    tankInputDispatchAttempted=false;tankInputDispatchResult=false;
    let flushed=null;
    try{flushed=tankInputGate.flush();}catch(_error){flushed=null;}
    if(tankInputDispatchAttempted||(flushed&&flushed.delivered>0))return tankInputDispatchResult;
    return applyPlayerInput(controlledPlayer(),input,true);
  }
  function resetRelayState(){
    relayMatchId = currentMatchId();
    inputSequence = 0; authoritySequence = 0; lastAuthoritySequence = -1;
    lastInputSequence = Array(playerCount).fill(-1); resultCommitted = false; lastRelayAt = 0;
    tankAudioAuthorityBaseline = null; tankAudioAuthorityMoveTick = -Infinity;
  }
  function buildMap(){
    grid = Array.from({length:H}, () => Array(W).fill(0));
    for (let c = 0; c < W; c++){ grid[0][c] = 3; grid[H-1][c] = 3; }
    for (let r = 0; r < H; r++){ grid[r][0] = 3; grid[r][W-1] = 3; }
    const bricks = [
      [3,3],[3,4],[4,3],[H-4,W-4],[H-4,W-5],[H-5,W-4],
      [2,Math.floor(W/2)],[H-3,Math.floor(W/2)],[Math.floor(H/2),2],[Math.floor(H/2),W-3],
      [5,Math.floor(W/2)-1],[5,Math.floor(W/2)],[5,Math.floor(W/2)+1],
      [7,Math.floor(W/2)-1],[7,Math.floor(W/2)],[7,Math.floor(W/2)+1],
    ];
    bricks.forEach(([r,c]) => { if (r > 0 && r < H-1 && c > 0 && c < W-1) grid[r][c] = 2; });
  }
  function createTank(id){
    const spawn = SPAWNS[id % SPAWNS.length];
    return {
      id, x:spawn[0], y:spawn[1], d:id % 2 ? 3 : 1, hp:3, alive:true,
      respawnAt:0, invulnerableUntil:startedAt + 1200, fireReadyAt:0, input:emptyInput(),
      kills:0, deaths:0, damage:0, shots:0, hits:0, placement:0,
    };
  }
  function resetLocal(){
    if (typeof releaseAllControls === 'function') releaseAllControls(false);
    aiEpoch++; aiPending.clear(); clearTransientTimers(); clearTankWaveCProcessTimers(); tankWaveCProcessEpoch++; tankGhost3DInvalidate(true); tankGhost3DForcedDomOnly=false; removeVictoryOverlay(); lastPlayersSignature='';lastStatusText='';buildMap();
    startedAt = Date.now(); finishedAt = 0; remainingMs = MATCH_MS; lastLoopAt = startedAt; accumulator = 0;
    tanks = Array.from({length:playerCount}, (_, i) => createTank(i));
    bullets = []; traces = []; effects = []; over = false; winner = -1; cur = 0; bulletSequence = 0; destroyed = false;
    resetRelayState();
    // The locally created spawn is the comparison baseline for the first live
    // Authority receipt.  A silent bootstrap replaces it without emitting.
    tankAudioAuthorityBaseline = tanks.map(tankAudioAuthorityState);
    resetTankPrediction('reset');
    resetTankInputGate();
    resetTankFeedback();
    authorityServerTick = 0;
    authorityEndAt = authorityMode && opts.gameplayMeta ? Number(opts.gameplayMeta.endAt) || 0 : 0;
    season = chooseSeason(matchSeed());
    setTankWaveCProcess('spawn');
    settleTankWaveCProcess('ready', controlledPlayer(), 220);
    render(); updateStatus();
  }
  function controlledPlayer(){ return opts.online ? Math.max(0, Number(opts.myIdx) || 0) : 0; }
  function canControl(){ return !destroyed && !spectator && !over && !(opts.isReplaying && opts.isReplaying()); }
  function isBlocked(x, y, ignoreId){
    const radius = .31;
    for (const [px,py] of [[x-radius,y-radius],[x+radius,y-radius],[x-radius,y+radius],[x+radius,y+radius]]){
      const r = Math.floor(py), c = Math.floor(px);
      if (!grid[r] || grid[r][c] === 2 || grid[r][c] === 3) return true;
    }
    return tanks.some(t => t.id !== ignoreId && t.alive && Math.hypot(t.x-x,t.y-y) < .65);
  }
  // Prediction is presentation-only, but a single endpoint check can still
  // draw a speculative segment through a wall corner.  Sweep the bounded
  // adapter displacement at a finer resolution than the tank radius.  The
  // hard cap keeps malformed/large corrections on the old authoritative
  // reconciliation path instead of turning this helper into a second solver.
  const TANK_PREDICTION_SWEEP_STEP = .08, TANK_PREDICTION_SWEEP_MAX_STEPS = 32;
  function tankPredictionPathClear(fromX, fromY, toX, toY, ignoreId){
    if (![fromX,fromY,toX,toY].every(Number.isFinite)) return false;
    const distance = Math.hypot(toX-fromX,toY-fromY);
    if (!Number.isFinite(distance) || distance > TANK_PREDICTION_SWEEP_STEP * TANK_PREDICTION_SWEEP_MAX_STEPS) return false;
    const steps = Math.max(1, Math.ceil(distance / TANK_PREDICTION_SWEEP_STEP));
    for (let step = 1; step <= steps; step++){
      const progress = step / steps;
      if (isBlocked(fromX + (toX-fromX) * progress, fromY + (toY-fromY) * progress, ignoreId)) return false;
    }
    return true;
  }
  function moveTank(tank, dx, dy, dt){
    if (!tank || !tank.alive) return;
    if (dx || dy){
      const beforeX=tank.x,beforeY=tank.y;
      noteTankWaveCMove();
      if (Math.abs(dx) >= Math.abs(dy)) tank.d = dx > 0 ? 1 : 3;
      else tank.d = dy > 0 ? 2 : 0;
      const length = Math.hypot(dx,dy) || 1, speed = 2.65;
      const nx = tank.x + dx / length * speed * dt;
      const ny = tank.y + dy / length * speed * dt;
      if (!isBlocked(nx,tank.y,tank.id)) tank.x = nx;
      if (!isBlocked(tank.x,ny,tank.id)) tank.y = ny;
      if (!traces.length || Date.now() - traces[traces.length-1].at > 90){
        traces.push({ x:tank.x, y:tank.y, at:Date.now(), type:'track', owner:tank.id });
        if (traces.length > 60) traces.splice(0, traces.length - 60);
      }
      const moved=Math.abs(tank.x-beforeX)>.0001||Math.abs(tank.y-beforeY)>.0001;
      const now=Date.now();
      if(moved&&!authorityMode&&!spectator&&tank.id===controlledPlayer()&&(tank.d!==tankMoveCueDirection||now-tankMoveCueAt>=180)){
        tankMoveCueAt=now;tankMoveCueDirection=tank.d;
        audioCue('tank_move',{actionId:'tank-move-'+tankFeedbackSession+'-'+(++tankFeedbackCueSequence),reaction:'move'},.28);
      }
    }
  }
  function fireTank(tank){
    const now = Date.now();
    if (!tank || !tank.alive || now < tank.fireReadyAt) return false;
    setTankWaveCProcess('fire', tank.id);
    tank.fireReadyAt = now + 420; tank.shots++;
    const d = DIRS[tank.d];
    bullets.push({ id:++bulletSequence, owner:tank.id, x:tank.x+d[0]*.55, y:tank.y+d[1]*.55, d:tank.d, ttl:2600 });
    effects.push({ x:tank.x+d[0]*.5, y:tank.y+d[1]*.5, type:'muzzle', at:now, ttl:140 });
    if (effects.length > 40) effects.splice(0, effects.length - 40);
    audioCue('tank_fire', { actionId:'tank-fire-' + tankFeedbackSession + '-' + tank.id + '-' + bulletSequence, reaction:'shoot' }, .9, tankFeedbackPan(tank.x));
    settleTankWaveCProcess('ready', tank.id, 180);
    tankGhost3DMarkLocalCommitted();
    return true;
  }
  function damageTank(target, owner, amount){
    const now = Date.now();
    if (!target.alive || now < target.invulnerableUntil) return false;
    target.hp -= amount;
    const shooter = tanks[owner];
    if (shooter){ shooter.damage += amount; shooter.hits++; }
    setTankWaveCProcess('hit', target.id);
    effects.push({ x:target.x, y:target.y, type:'impact', at:now, ttl:360 });
    audioCue('tank_hit', { actionId:'tank-hit-' + tankFeedbackSession + '-' + target.id + '-' + target.deaths + '-' + Math.max(0,target.hp), reaction:'capture' }, target.hp<=0?1:.8, tankFeedbackPan(target.x));
    if (target.hp <= 0){
      setTankWaveCProcess('ko', target.id);
      target.alive = false; target.deaths++; target.respawnAt = now + 2000; target.input = emptyInput();
      if (shooter && shooter.id !== target.id) shooter.kills++;
      effects.push({ x:target.x, y:target.y, type:'explosion', at:now, ttl:850 });
      traces.push({ x:target.x, y:target.y, at:now, type:'scorch', owner:target.id });
      audioCue('tank_ko', { actionId:'tank-ko-' + tankFeedbackSession + '-' + target.id + '-' + target.deaths, reaction:'capture' }, 1, tankFeedbackPan(target.x));
      settleTankWaveCProcess('score', owner, 260);
    }
    else settleTankWaveCProcess('ready', target.id, 220);
    tankGhost3DMarkLocalCommitted();
    return true;
  }
  function safestSpawn(tank){
    const candidates = SPAWNS.slice(0, playerCount);
    return candidates.slice().sort((a,b) => {
      const da = Math.min(...tanks.filter(t => t.alive && t.id !== tank.id).map(t => Math.hypot(t.x-a[0],t.y-a[1])).concat([99]));
      const db = Math.min(...tanks.filter(t => t.alive && t.id !== tank.id).map(t => Math.hypot(t.x-b[0],t.y-b[1])).concat([99]));
      return db-da;
    })[0] || SPAWNS[tank.id % SPAWNS.length];
  }
  function respawn(tank, now){
    const spawn = safestSpawn(tank);
    tank.x = spawn[0]; tank.y = spawn[1]; tank.d = tank.id % 2 ? 3 : 1; tank.hp = 3;
    tank.alive = true; tank.respawnAt = 0; tank.invulnerableUntil = now + 1500; tank.input = emptyInput();
    if(!spectator&&tank.id===controlledPlayer())audioCue('tank_respawn',{actionId:'tank-respawn-'+tankFeedbackSession+'-'+tank.id+'-'+tank.deaths,reaction:'place'},.65);
    setTankWaveCProcess('spawn', tank.id);
    effects.push({ x:tank.x, y:tank.y, type:'respawn', at:now, ttl:600 });
    settleTankWaveCProcess('ready', tank.id, 320);
    tankGhost3DMarkLocalCommitted();
  }
  function fixedUpdate(dt){
    if (over) return;
    const now = Date.now();
    if (authorityMode){
      remainingMs=Math.max(0,(authorityEndAt||now+remainingMs)-now);
      const local=tanks[controlledPlayer()];
      if(local&&local.alive){const input=local.input||emptyInput();moveTank(local,(input.right?1:0)-(input.left?1:0),(input.down?1:0)-(input.up?1:0),dt);}
      traces=traces.filter(item=>now-item.at<(item.type==='scorch'?7000:1600)).slice(-60);
      effects=effects.filter(item=>now-item.at<item.ttl).slice(-40);
      return;
    }
    remainingMs = Math.max(0, MATCH_MS - (now - startedAt));
    tanks.forEach(tank => {
      if (!tank.alive){ if (tank.respawnAt && now >= tank.respawnAt && remainingMs > 0) respawn(tank, now); return; }
      const input = tank.input || emptyInput();
      moveTank(tank, (input.right?1:0)-(input.left?1:0), (input.down?1:0)-(input.up?1:0), dt);
      if (input.fire) fireTank(tank);
    });
    const nextBullets = [];
    bullets.forEach(bullet => {
      const d = DIRS[bullet.d];
      bullet.x += d[0] * 8.2 * dt; bullet.y += d[1] * 8.2 * dt; bullet.ttl -= dt*1000;
      const r = Math.floor(bullet.y), c = Math.floor(bullet.x), cell = grid[r] && grid[r][c];
      if (bullet.ttl <= 0 || cell === 3) return;
      if (cell === 2){
        grid[r][c] = 0; effects.push({ x:bullet.x, y:bullet.y, type:'impact', at:now, ttl:320 });
        traces.push({ x:bullet.x, y:bullet.y, at:now, type:'scorch', owner:bullet.owner }); return;
      }
      const hit = tanks.find(t => t.id !== bullet.owner && t.alive && Math.hypot(t.x-bullet.x,t.y-bullet.y) < .46);
      if (hit){ damageTank(hit, bullet.owner, 1); return; }
      nextBullets.push(bullet);
    });
    bullets = nextBullets;
    traces = traces.filter(item => now - item.at < (item.type === 'scorch' ? 7000 : 1600)).slice(-60);
    effects = effects.filter(item => now - item.at < item.ttl).slice(-40);
    tankGhost3DMarkLocalCommitted();
    // 联机客端只做预测显示，最终计时与排名必须等待房主快照；人机模拟行为保持不变。
    if (remainingMs <= 0 && (!opts.online || opts.isHost)) finishMatch();
  }
  function ranking(){
    return tanks.map(t => t.id).sort((a,b) =>
      tanks[b].kills - tanks[a].kills || tanks[a].deaths - tanks[b].deaths || tanks[b].damage - tanks[a].damage || a-b);
  }
  function validOrder(value){
    return Array.isArray(value) && value.length === playerCount &&
      value.every(id => Number.isInteger(id) && id >= 0 && id < playerCount) && new Set(value).size === playerCount;
  }
  function resultsForOrder(order){
    return order.map((id,index) => ({ slot:id, rank:index+1, coins:index===0?1:0 }));
  }
  function commitFinal(order, broadcastFinal){
    if (resultCommitted || !validOrder(order)) return false;
    over = true; finishedAt = Date.now(); remainingMs = 0; winner = order[0];
    order.forEach((id, index) => tanks[id].placement = index + 1);
    resultCommitted = true;
    if (broadcastFinal) broadcastAuthoritativeState(order);
    if (opts.onEnd) opts.onEnd(resultsForOrder(order));
    clearTankWaveCProcessTimers();
    setTankWaveCProcess('score', winner);
    settleTankWaveCProcess('terminal', winner, 260);
    render(); setStatus(t('tank_win_status',winner+1,tanks[winner].kills), true);
    return true;
  }
  function finishMatch(){
    if (authorityMode) return false;
    // 休闲联机采用房主客户端权威；服务端仍只是附带可信 player 的房间中继。
    if (opts.online && !opts.isHost) return false;
    return commitFinal(ranking(), !!opts.online);
  }
  function loop(){
    if (destroyed) return;
    const now = Date.now(), elapsed = Math.min(250, Math.max(0, now - lastLoopAt));
    performanceStats.samples++;performanceStats.lastFrameMs=elapsed;performanceStats.maxFrameMs=Math.max(performanceStats.maxFrameMs,elapsed);if(elapsed>50)performanceStats.longFrames++;
    lastLoopAt = now; accumulator += elapsed;
    while (accumulator >= FIXED_MS){ fixedUpdate(FIXED_MS/1000); accumulator -= FIXED_MS; }
    if (opts.online && !authorityMode && opts.isHost && !over && now - lastRelayAt >= RELAY_SNAPSHOT_MS) broadcastAuthoritativeState();
    if (now - lastRenderAt >= 80){ render(); lastRenderAt = now; }
  }
  const simulationTimer = setInterval(loop, FIXED_MS);
  if (simulationTimer && typeof simulationTimer.unref === 'function') simulationTimer.unref();

  function relayActionPayload(value){
    return {
      ...(value || {}), protocol:RELAY_PROTOCOL, matchId:currentMatchId(), seq:++inputSequence,
    };
  }
  function getLocalInput(){
    const input = emptyInput();
    ['up','right','down','left'].forEach(key => { input[key] = !!(keyboardInput[key] || joystickMovement[key] || dpadMovement[key]); });
    input.fire = !!(keyboardInput.fire || fireHeld || firePointerIds.size > 0);
    return input;
  }
  function sendRelayAction(value){
    if(authorityMode){
      const input=value&&value.input?normalizeInput(value.input):getLocalInput();
      const sequence=++inputSequence,clientTick=authorityServerTick;
      submitTankPrediction(sequence,clientTick,input);
      opts.sendTankInput({seq:sequence,clientTick,input});
      return true;
    }
    if (!opts.online || typeof opts.sendMove !== 'function') return false;
    opts.sendMove(relayActionPayload(value));
    return true;
  }
  function applyPlayerInput(pi, value, shouldSend){
    const tank = tanks[pi]; if (!tank || !tank.alive) return false;
    tank.input = normalizeInput(value);
    if (shouldSend) sendRelayAction({ act:'input', input:{...tank.input} });
    return true;
  }
  function setPlayerInput(pi, value, shouldSend){
    if(shouldSend&&tankInputGate&&pi===controlledPlayer())return dispatchTankInputIntent(value);
    return applyPlayerInput(pi,value,shouldSend);
  }
  function pulseMove(pi, d, shouldSend){
    if (!Number.isInteger(d) || d < 0 || d > 3) return false;
    const input = emptyInput(); input[['up','right','down','left'][d]] = true;
    setPlayerInput(pi,input,shouldSend);
    scheduleTransient(() => { if (tanks[pi]) setPlayerInput(pi,emptyInput(),shouldSend); }, 180);
    return true;
  }
  function localInputChanged(){
    const pi = controlledPlayer();
    if (!canControl() || !tanks[pi] || (opts.ai && opts.ai.has(pi))) return;
    const input = getLocalInput();
    setPlayerInput(pi, input, true);
    if (opts.onProgress) opts.onProgress({ act:'input', input:{...input} });
  }
  function localShoot(){
    if (!canControl()) return false;
    unlockTankFeedback();
    if(authorityMode){
      keyboardInput.fire=true;localInputChanged();
      scheduleTransient(()=>{keyboardInput.fire=false;localInputChanged();},90);
      return true;
    }
    const fired = fireTank(tanks[controlledPlayer()]);
    if (!fired) return false;
    if (opts.onProgress) opts.onProgress({act:'shoot'});
    sendRelayAction({act:'shoot'});
    return true;
  }
  const keyboardInput = emptyInput(), joystickMovement = emptyInput(), dpadMovement = emptyInput();
  const firePointerIds = new Set(), dpadPointerIds = new Map();
  let fireHeld = false, joystickPointerId = null, joystickVector = { x:0, y:0, magnitude:0, direction:'neutral' };
  let lastDpadPointerAt = 0;
  const directionKeys = ['up','right','down','left'];
  const directionLabels = { up:'tank_direction_up', right:'tank_direction_right', down:'tank_direction_down', left:'tank_direction_left', neutral:'tank_direction_neutral' };
  function localizedDirection(direction){
    if (!direction || direction === 'neutral') return t(directionLabels.neutral);
    const dirs = direction === 'downright' ? ['down','right'] : direction === 'downleft' ? ['down','left'] : direction === 'upleft' ? ['up','left'] : direction === 'upright' ? ['up','right'] : [direction];
    return dirs.map(key => t(directionLabels[key])).join(' + ');
  }
  const joystickDirections = [
    { key:'right', dirs:['right'], x:1, y:0 }, { key:'downright', dirs:['down','right'], x:1, y:1 }, { key:'down', dirs:['down'], x:0, y:1 }, { key:'downleft', dirs:['down','left'], x:-1, y:1 },
    { key:'left', dirs:['left'], x:-1, y:0 }, { key:'upleft', dirs:['up','left'], x:-1, y:-1 }, { key:'up', dirs:['up'], x:0, y:-1 }, { key:'upright', dirs:['up','right'], x:1, y:-1 },
  ];
  function clearMovementState(target){ directionKeys.forEach(key => { target[key] = false; }); }
  function directionInput(direction){
    const input = emptyInput();
    (Array.isArray(direction) ? direction : [direction]).forEach(key => { if (directionKeys.includes(key)) input[key] = true; });
    return input;
  }
  function setJoystickVisual(direction, magnitude, x, y){
    joystickVector = { x, y, magnitude, direction };
    const knob = joystick && joystick.querySelector ? joystick.querySelector('.tank-joystick-knob') : null;
    if (knob){
      const limit = 34, px = Math.round(x * limit), py = Math.round(y * limit);
      knob.style.transform = 'translate(' + px + 'px,' + py + 'px)';
    }
    if (joystick){
      joystick.dataset.direction = direction;
      joystick.setAttribute('aria-valuenow', String(Math.round(magnitude * 100)));
      joystick.setAttribute('aria-valuetext', localizedDirection(direction));
    }
    if (joystickDirection){
      joystickDirection.textContent = localizedDirection(direction);
    }
  }
  function applyJoystickPoint(event){
    if (!canControl() || (joystickPointerId !== null && event.pointerId !== undefined && event.pointerId !== joystickPointerId)) return;
    const rect = joystick.getBoundingClientRect();
    const half = Math.max(1, Math.min(rect.width, rect.height) / 2), rawX = Number(event.clientX) - rect.left - rect.width / 2, rawY = Number(event.clientY) - rect.top - rect.height / 2;
    const radius = Math.max(1, half - 12), distance = Math.hypot(rawX, rawY), magnitude = Math.min(1, distance / radius);
    if (distance <= Math.max(12, radius * .18)){
      clearMovementState(joystickMovement); setJoystickVisual('neutral', 0, 0, 0); localInputChanged(); return;
    }
    const nx = rawX / distance, ny = rawY / distance;
    const sector = (Math.round((Math.atan2(ny, nx) + Math.PI * 2) / (Math.PI / 4)) + 8) % 8;
    const selected = joystickDirections[sector];
    const previousDirection = joystickVector.direction;
    clearMovementState(joystickMovement); Object.assign(joystickMovement, directionInput(selected.dirs));
    setJoystickVisual(selected.key, magnitude, nx * magnitude, ny * magnitude);
    localInputChanged();
  }
  function releaseJoystick(){
    const wasActive = joystickPointerId !== null || directionKeys.some(key => joystickMovement[key]);
    if (!wasActive) return;
    if (joystickPointerId !== null && joystick && typeof joystick.releasePointerCapture === 'function'){
      try { joystick.releasePointerCapture(joystickPointerId); } catch {}
    }
    joystickPointerId = null; clearMovementState(joystickMovement); setJoystickVisual('neutral', 0, 0, 0); localInputChanged();
  }
  function setFireState(pressed){
    const next = !!pressed;
    if (fireHeld === next && (!next || firePointerIds.size)) return;
    fireHeld = next;
    if (fireBtn){ fireBtn.setAttribute('aria-pressed', next ? 'true' : 'false'); fireBtn.classList.toggle('is-held', next); }
    localInputChanged();
  }
  function releaseFirePointer(event){
    if (event && event.pointerId !== undefined) firePointerIds.delete(event.pointerId);
    if (!firePointerIds.size) setFireState(false);
  }
  function releaseAllControls(shouldSend){
    clearMovementState(keyboardInput); clearMovementState(joystickMovement); clearMovementState(dpadMovement); keyboardInput.fire = false; fireHeld = false; firePointerIds.clear();
    if (joystickPointerId !== null && joystick && typeof joystick.releasePointerCapture === 'function'){try{joystick.releasePointerCapture(joystickPointerId);}catch{}}
    if (typeof dpadButtons !== 'undefined') Object.keys(dpadButtons).forEach(direction=>{const button=dpadButtons[direction],pointerId=dpadPointerIds.get(direction);if(pointerId!==undefined&&button&&typeof button.releasePointerCapture==='function'){try{button.releasePointerCapture(pointerId);}catch{}}});
    dpadPointerIds.clear(); joystickPointerId = null; setJoystickVisual('neutral', 0, 0, 0);
    if (fireBtn){ fireBtn.setAttribute('aria-pressed','false'); fireBtn.classList.remove('is-held'); }
    if (shouldSend) localInputChanged();
  }
  function handleKey(e, pressed){
    const map = { w:'up',W:'up',ArrowUp:'up', d:'right',D:'right',ArrowRight:'right', s:'down',S:'down',ArrowDown:'down', a:'left',A:'left',ArrowLeft:'left' };
    if (map[e.key]){
      if (canControl() && e.preventDefault) e.preventDefault();
      if (keyboardInput[map[e.key]] === pressed) return;
      if(pressed)unlockTankFeedback();
      keyboardInput[map[e.key]] = pressed; localInputChanged(); return;
    }
    if (e.key === ' ' || e.key === 'Spacebar'){
      if (canControl() && e.preventDefault) e.preventDefault();
      if (keyboardInput.fire === pressed) return;
      if(pressed)unlockTankFeedback();
      keyboardInput.fire = pressed; localInputChanged();
    }
  }
  const keyDown = e => handleKey(e,true), keyUp = e => handleKey(e,false);
  if (document.addEventListener){ document.addEventListener('keydown',keyDown); document.addEventListener('keyup',keyUp); }

  extra.innerHTML = '';
  const hud = el('div','tank-arena-hud');
  const controls = el('div','tank-realtime-controls tank-control-deck'); controls.setAttribute('data-tank-control-deck','');
  const joystickWrap = el('div','tank-joystick-wrap');
  const joystick = el('div','tank-joystick'); joystick.setAttribute('role','slider'); joystick.setAttribute('tabindex','0'); joystick.setAttribute('aria-valuemin','0'); joystick.setAttribute('aria-valuemax','100'); joystick.setAttribute('aria-valuenow','0'); joystick.setAttribute('aria-valuetext',t('tank_direction_neutral')); joystick.setAttribute('data-i18n-aria-label','tank_joystick_aria'); joystick.setAttribute('aria-label',t('tank_joystick_aria'));
  const joystickKnob = el('span','tank-joystick-knob','●'); joystickKnob.setAttribute('aria-hidden','true');
  const joystickDirection = el('span','tank-joystick-direction',t('tank_direction_neutral')); joystickDirection.setAttribute('data-i18n','tank_direction_neutral'); joystickDirection.setAttribute('aria-live','polite');
  joystick.appendChild(joystickKnob); joystick.appendChild(joystickDirection); joystickWrap.appendChild(joystick);
  const dpad = el('div','tank-dpad'); dpad.setAttribute('role','group'); dpad.setAttribute('data-i18n-aria-label','tank_dpad_label'); dpad.setAttribute('aria-label',t('tank_dpad_label'));
  const dpadButtons = {};
  directionKeys.forEach(direction => {
    const button = el('button','btn tank-dpad-button tank-dpad-'+direction,t('tank_'+direction)); button.type='button'; button.setAttribute('data-tank-direction',direction); button.setAttribute('data-i18n','tank_'+direction); button.setAttribute('data-i18n-aria-label','tank_'+direction+'_aria'); button.setAttribute('aria-label',t('tank_'+direction+'_aria')); dpad.appendChild(button); dpadButtons[direction]=button;
  });
  const fireBtn = el('button','btn btn-primary tank-fire',t('tank_fire')); fireBtn.type='button'; fireBtn.setAttribute('data-i18n','tank_fire'); fireBtn.setAttribute('data-i18n-aria-label','tank_fire_aria'); fireBtn.setAttribute('aria-label',t('tank_fire_aria')); fireBtn.setAttribute('aria-pressed','false');
  const hint = el('span','tank-control-hint',t('tank_control_hint')); hint.setAttribute('data-i18n','tank_control_hint');
  controls.appendChild(joystickWrap); controls.appendChild(dpad); controls.appendChild(fireBtn); controls.appendChild(hint); extra.appendChild(hud); extra.appendChild(controls);
  function beginJoystick(event){
    if (!canControl() || joystickPointerId !== null) return;
    unlockTankFeedback();
    if (event && event.preventDefault) event.preventDefault(); joystickPointerId = event && event.pointerId !== undefined ? event.pointerId : 'joystick';
    if (typeof joystick.setPointerCapture === 'function' && event && event.pointerId !== undefined){ try { joystick.setPointerCapture(event.pointerId); } catch {} }
    applyJoystickPoint(event || {clientX:0,clientY:0,pointerId:joystickPointerId});
  }
  function moveJoystick(event){ if (joystickPointerId !== null && (event.pointerId === undefined || event.pointerId === joystickPointerId)) applyJoystickPoint(event); }
  joystick.addEventListener('pointerdown',beginJoystick); joystick.addEventListener('pointermove',moveJoystick); joystick.addEventListener('pointerup',releaseJoystick); joystick.addEventListener('pointercancel',releaseJoystick); joystick.addEventListener('lostpointercapture',releaseJoystick);
  function beginDpad(direction,event){
    if (!canControl()) return; unlockTankFeedback(); if (event && event.preventDefault) event.preventDefault(); lastDpadPointerAt = Date.now(); dpadMovement[direction] = true;
    const button=dpadButtons[direction]; if(event&&event.pointerId!==undefined){dpadPointerIds.set(direction,event.pointerId);if(button&&typeof button.setPointerCapture==='function'){try{button.setPointerCapture(event.pointerId);}catch{}}}
    localInputChanged();
  }
  function endDpad(direction,event){
    if (!dpadMovement[direction] && !dpadPointerIds.has(direction)) return;
    const button=dpadButtons[direction], pointerId=event&&event.pointerId!==undefined?event.pointerId:dpadPointerIds.get(direction); if(pointerId!==undefined&&button&&typeof button.releasePointerCapture==='function'){try{button.releasePointerCapture(pointerId);}catch{}} dpadPointerIds.delete(direction);
    dpadMovement[direction] = false; localInputChanged();
  }
  directionKeys.forEach(direction => {
    const button=dpadButtons[direction]; button.addEventListener('pointerdown',e=>beginDpad(direction,e)); button.addEventListener('pointerup',e=>endDpad(direction,e)); button.addEventListener('pointercancel',e=>endDpad(direction,e)); button.addEventListener('lostpointercapture',e=>endDpad(direction,e));
    button.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.preventDefault)e.preventDefault();if(e.key==='Enter'||e.key===' ')beginDpad(direction,e);}); button.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' ')endDpad(direction);});
    button.addEventListener('click',e=>{if(Date.now()-lastDpadPointerAt<450)return;unlockTankFeedback();pulseMove(controlledPlayer(),directionKeys.indexOf(direction),true);});
  });
  function beginFire(event){
    if (!canControl()) return; unlockTankFeedback(); if (event && event.preventDefault) event.preventDefault(); if (event && event.pointerId !== undefined) firePointerIds.add(event.pointerId); setFireState(true);
    if (event && event.pointerId !== undefined && typeof fireBtn.setPointerCapture === 'function'){try{fireBtn.setPointerCapture(event.pointerId);}catch{}}
  }
  fireBtn.addEventListener('pointerdown',beginFire); fireBtn.addEventListener('pointerup',releaseFirePointer); fireBtn.addEventListener('pointercancel',releaseFirePointer); fireBtn.addEventListener('lostpointercapture',releaseFirePointer); fireBtn.addEventListener('click',localShoot);
  const onWindowBlur=()=>{releaseAllControls(true);resetTankInputGate();resetTankPrediction('blur');}, onVisibilityChange=()=>{const hidden=document.visibilityState==='hidden';setTankFeedbackHidden(hidden);if(hidden){releaseAllControls(true);resetTankInputGate();resetTankPrediction('hidden');}};
  if(typeof window!=='undefined'&&window.addEventListener){window.addEventListener('blur',onWindowBlur);window.addEventListener('pointerup',releaseFirePointer);window.addEventListener('pointercancel',releaseFirePointer);}
  if(document.addEventListener)document.addEventListener('visibilitychange',onVisibilityChange);

  /* Influence-map kiting：借鉴 AIIDE《Kiting in RTS Games Using Influence Maps》的
     “先避开高威胁区，再沿安全梯度取得射界”思路；这里只输出既合法又近优的动作。 */
  const AI_BULLET_SPEED = 8.2, AI_DANGER_HORIZON = 1.5, AI_MOVE_LOOKAHEAD = .58;
  function tankAIClamp(value,min,max){
    const number = Number(value);
    return Math.max(min,Math.min(max,Number.isFinite(number)?number:0));
  }
  function tankAIWallBetween(x1,y1,x2,y2){
    const distance = Math.hypot(x2-x1,y2-y1);
    if (distance < .72) return false;
    const dx=(x2-x1)/distance,dy=(y2-y1)/distance;
    for(let step=.42;step<distance-.34;step+=.2){
      const r=Math.floor(y1+dy*step),c=Math.floor(x1+dx*step);
      if(!grid[r]||grid[r][c]===2||grid[r][c]===3)return true;
    }
    return false;
  }
  function tankAIFireLine(from,target){
    if(!from||!target)return null;
    const vertical=Math.abs(from.x-target.x)<.44,horizontal=Math.abs(from.y-target.y)<.44;
    if(!vertical&&!horizontal)return null;
    const direction=vertical?(target.y<from.y?0:2):(target.x>from.x?1:3);
    const distance=vertical?Math.abs(target.y-from.y):Math.abs(target.x-from.x);
    if(distance<.7||tankAIWallBetween(from.x,from.y,target.x,target.y))return null;
    const blocked=tanks.some(t=>{
      if(!t.alive||t.id===from.id||t.id===target.id)return false;
      if(vertical&&Math.abs(t.x-from.x)<.48){
        return (t.y-from.y)*(target.y-from.y)>0&&Math.abs(t.y-from.y)<distance-.35;
      }
      if(horizontal&&Math.abs(t.y-from.y)<.48){
        return (t.x-from.x)*(target.x-from.x)>0&&Math.abs(t.x-from.x)<distance-.35;
      }
      return false;
    });
    return blocked?null:{direction,distance};
  }
  function tankAIProjectileApproach(bullet,x,y){
    if(!bullet||!DIRS[bullet.d])return null;
    const vector=DIRS[bullet.d],rx=x-bullet.x,ry=y-bullet.y;
    const along=rx*vector[0]+ry*vector[1],cross=Math.abs(rx*vector[1]-ry*vector[0]);
    const lifetime=Math.max(0,Math.min(AI_DANGER_HORIZON,(Number(bullet.ttl)||0)/1000));
    if(along<-.2||along>AI_BULLET_SPEED*lifetime+.45||cross>.78)return null;
    const rayX=bullet.x+vector[0]*Math.max(0,along),rayY=bullet.y+vector[1]*Math.max(0,along);
    if(tankAIWallBetween(bullet.x,bullet.y,rayX,rayY))return null;
    const eta=Math.max(0,along)/AI_BULLET_SPEED;
    const lane=tankAIClamp(1-cross/.78,0,1),imminence=tankAIClamp(1-eta/AI_DANGER_HORIZON,0,1);
    return {bullet,eta,cross,value:lane*imminence};
  }
  function tankAIBulletThreat(x,y,meId,ownerId){
    let value=0,urgent=null;
    bullets.forEach(bullet=>{
      if(bullet.owner===meId||(Number.isInteger(ownerId)&&bullet.owner!==ownerId))return;
      const approach=tankAIProjectileApproach(bullet,x,y);
      if(approach&&approach.value>value){value=approach.value;urgent=approach;}
    });
    return {value:tankAIClamp(value,0,1),urgent};
  }
  function tankAITargetInfo(me,target){
    const distance=Math.hypot(target.x-me.x,target.y-me.y),line=tankAIFireLine(target,me);
    const aimed=!!(line&&target.d===line.direction),projectile=tankAIBulletThreat(me.x,me.y,me.id,target.id).value;
    const proximity=tankAIClamp(1-distance/9,0,1);
    const threat=tankAIClamp((aimed ? .42 : line ? .18 : 0)+projectile*.38+proximity*.18+
      tankAIClamp(target.kills/5,0,1)*.16+tankAIClamp(target.damage/12,0,1)*.1,0,1);
    const lowHealth=tankAIClamp((4-Math.max(1,target.hp))/3,0,1);
    const protectedNow=Date.now()<target.invulnerableUntil;
    const opportunity=tankAIFireLine(me,target) ? .12 : 0;
    const priority=tankAIClamp(lowHealth*.5+threat*.38+proximity*.12+opportunity-(protectedNow ? .35 : 0),0,1);
    return {target,distance,threat,priority,lowHealth,protectedNow};
  }
  function tankAISelectTarget(me){
    return tanks.filter(t=>t.id!==me.id&&t.alive).map(t=>tankAITargetInfo(me,t)).sort((a,b)=>
      b.priority-a.priority||b.threat-a.threat||a.target.hp-b.target.hp||a.distance-b.distance||a.target.id-b.target.id)[0]||null;
  }
  function tankAICellPassable(r,c,meId){
    if(r<1||r>=H-1||c<1||c>=W-1||!grid[r]||grid[r][c]!==0)return false;
    return !tanks.some(t=>t.id!==meId&&t.alive&&Math.abs(t.x-(c+.5))<.62&&Math.abs(t.y-(r+.5))<.62);
  }
  function tankAICoverAt(x,y,me){
    const r=Math.floor(y),c=Math.floor(x);
    let adjacent=0,blockedLane=0,relevantLanes=0;
    DIRS.forEach(([dx,dy])=>{const row=r+dy,col=c+dx;if(!grid[row]||grid[row][col]===2||grid[row][col]===3)adjacent++;});
    tanks.forEach(enemy=>{
      if(enemy.id===me.id||!enemy.alive)return;
      if(Math.abs(enemy.x-x)<.44||Math.abs(enemy.y-y)<.44){
        relevantLanes++;
        if(tankAIWallBetween(enemy.x,enemy.y,x,y))blockedLane++;
      }
    });
    return tankAIClamp(adjacent*.18+(relevantLanes?blockedLane/relevantLanes*.48:0),0,1);
  }
  function tankAIBuildInfluence(me){
    // 敌人、未来弹道、障碍邻接和边界共同构成危险势场；墙本身为不可达极值。
    return Array.from({length:H},(_,r)=>Array.from({length:W},(_,c)=>{
      if(!tankAICellPassable(r,c,me.id)&&!(r===Math.floor(me.y)&&c===Math.floor(me.x))){
        return {danger:1,projectile:0,cover:0,boundary:1};
      }
      const x=c+.5,y=r+.5,projectile=tankAIBulletThreat(x,y,me.id).value;
      let enemyInfluence=0;
      tanks.forEach(enemy=>{
        if(enemy.id===me.id||!enemy.alive)return;
        const distance=Math.hypot(enemy.x-x,enemy.y-y),line=tankAIFireLine(enemy,{id:me.id,x,y});
        enemyInfluence+=tankAIClamp(1-distance/7,0,1)*.2;
        if(line)enemyInfluence+=enemy.d===line.direction ? .48 : .2;
      });
      const edge=Math.min(c-1,W-2-c,r-1,H-2-r);
      const boundary=tankAIClamp((1.35-edge)/1.35,0,1);
      const cover=tankAICoverAt(x,y,me);
      const danger=tankAIClamp(projectile+enemyInfluence+boundary*.22+cover*.04,0,1);
      return {danger,projectile,cover,boundary};
    }));
  }
  function tankAIFireDistance(me,target,influence){
    const distance=Array.from({length:H},()=>Array(W).fill(Infinity)),queue=[];
    if(!target)return distance;
    for(let r=1;r<H-1;r++)for(let c=1;c<W-1;c++){
      if(!tankAICellPassable(r,c,me.id)||influence[r][c].danger>.94)continue;
      const line=tankAIFireLine({id:me.id,x:c+.5,y:r+.5},target);
      if(!line||line.distance<1.35)continue;
      distance[r][c]=0;queue.push([r,c]);
    }
    for(let head=0;head<queue.length;head++){
      const [r,c]=queue[head],nextDistance=distance[r][c]+1;
      DIRS.forEach(([dx,dy])=>{
        const nr=r+dy,nc=c+dx;
        if(tankAICellPassable(nr,nc,me.id)&&nextDistance<distance[nr][nc]){
          distance[nr][nc]=nextDistance;queue.push([nr,nc]);
        }
      });
    }
    return distance;
  }
  function tankDifficultyProfile(difficulty){
    const id=difficulty&&difficulty.id;
    if(id==='easy')return{pathSearch:false,candidates:4};
    if(id==='hard')return{pathSearch:true,candidates:5};
    // 普通档保留既有危险图 + 火线最短路径近优策略。
    return{pathSearch:true,candidates:4};
  }
  function tankAIPlan(pi,difficulty){
    const me=tanks[pi];
    if(!me||!me.alive)return null;
    const profile=tankDifficultyProfile(difficulty);
    const targetInfo=tankAISelectTarget(me),target=targetInfo&&targetInfo.target;
    const influence=tankAIBuildInfluence(me),fireDistance=profile.pathSearch?tankAIFireDistance(me,target,influence):null;
    const currentCell=[Math.floor(me.y),Math.floor(me.x)],currentMap=influence[currentCell[0]][currentCell[1]]||{danger:1,cover:0};
    const currentBullet=tankAIBulletThreat(me.x,me.y,me.id),urgent=currentBullet.urgent;
    const currentFireDistance=fireDistance&&fireDistance[currentCell[0]]?fireDistance[currentCell[0]][currentCell[1]]:Infinity,ranked=[];
    DIRS.forEach(([dx,dy],direction)=>{
      const x=me.x+dx*AI_MOVE_LOOKAHEAD,y=me.y+dy*AI_MOVE_LOOKAHEAD;
      if(isBlocked(x,y,me.id))return;
      const r=Math.floor(y),c=Math.floor(x),map=influence[r]&&influence[r][c]||{danger:1,cover:0,boundary:1};
      const projectile=tankAIBulletThreat(x,y,me.id).value,danger=Math.max(map.danger,projectile);
      const line=target&&tankAIFireLine({id:me.id,x,y},target),aimed=!!(line&&line.direction===direction);
      const nextFireDistance=fireDistance&&fireDistance[r]&&fireDistance[r][c];
      let pathProgress=0;
      if(Number.isFinite(currentFireDistance)&&Number.isFinite(nextFireDistance))pathProgress=tankAIClamp((currentFireDistance-nextFireDistance)/2,-1,1);
      else if(!Number.isFinite(currentFireDistance)&&Number.isFinite(nextFireDistance))pathProgress=1;
      else if(Number.isFinite(currentFireDistance)&&!Number.isFinite(nextFireDistance))pathProgress=-1;
      let dodge=0;
      if(urgent){
        const perpendicular=(urgent.bullet.d%2)!==(direction%2),reduction=currentBullet.value-projectile;
        dodge=tankAIClamp((perpendicular ? .55 : -.45)+reduction*1.15,-1,1);
      }
      const targetDistance=target?Math.hypot(target.x-x,target.y-y):8;
      const kite=tankAIClamp(1-Math.abs(targetDistance-4.5)/4.5,-1,1);
      const features={
        threat:tankAIClamp(danger,0,1),line_of_sight:aimed ? 1 : line ? .45 : 0,dodge,
        path_progress:pathProgress,cover:tankAIClamp(map.cover,0,1),
        target_priority:targetInfo?tankAIClamp(targetInfo.priority,0,1):0,
        boundary_safety:tankAIClamp(1-(map.boundary||0),0,1),kite_distance:kite,quality:0,
      };
      let score=dodge*220-danger*175+pathProgress*86+features.cover*24+features.boundary_safety*18+kite*16;
      if(aimed)score+=118+(targetInfo?targetInfo.priority*38:0);
      if(targetDistance<1.7)score-=55;
      ranked.push({choice:'move:'+direction,score,features});
    });
    const shotTargets=tanks.filter(t=>t.id!==me.id&&t.alive).map(t=>{
      const line=tankAIFireLine(me,t),info=tankAITargetInfo(me,t);
      return line&&line.direction===me.d?{target:t,line,info}:null;
    }).filter(Boolean).sort((a,b)=>b.info.priority-a.info.priority||a.target.hp-b.target.hp||a.line.distance-b.line.distance||a.target.id-b.target.id);
    const shotTarget=shotTargets[0],fireReady=Date.now()>=me.fireReadyAt;
    const shotFeatures={
      threat:tankAIClamp(currentMap.danger,0,1),line_of_sight:shotTarget?1:0,
      dodge:urgent?tankAIClamp(-.55-currentBullet.value*.45,-1,0):0,path_progress:0,
      cover:tankAIClamp(currentMap.cover,0,1),target_priority:shotTarget?tankAIClamp(shotTarget.info.priority,0,1):(targetInfo?tankAIClamp(targetInfo.priority,0,1):0),
      boundary_safety:tankAIClamp(1-(currentMap.boundary||0),0,1),fire_ready:fireReady?1:-1,quality:0,
    };
    let shotScore=-currentMap.danger*170+shotFeatures.cover*14;
    if(shotTarget&&fireReady)shotScore+=285+shotTarget.info.priority*70+shotTarget.info.lowHealth*70;
    else if(!fireReady)shotScore-=150;
    else shotScore-=72;
    if(urgent)shotScore-=currentBullet.value*230;
    ranked.push({choice:'shoot',score:shotScore,features:shotFeatures});
    ranked.sort((a,b)=>b.score-a.score||a.choice.localeCompare(b.choice));
    const best=ranked[0],band=Math.max(16,Math.min(42,Math.abs(best.score)*.1+10));
    const near=ranked.filter(item=>item.score>=best.score-band).slice(0,profile.candidates);
    near.forEach(item=>{item.features.quality=tankAIClamp(1-(best.score-item.score)/Math.max(1,band),-1,1);});
    near.sort((a,b)=>b.score-a.score||a.choice.localeCompare(b.choice));
    return {me,targetInfo,influence,currentDanger:currentMap.danger,urgent,best,near,profile};
  }

  const aiPending = new Set(),aiThinkGate=new Map();
  async function scheduleAIPlayer(pi){
    if (destroyed || over || aiPending.has(pi) || !opts.ai || !opts.ai.has(pi) || !tanks[pi] || !tanks[pi].alive) return;
    const gate=aiThinkGate.get(pi),now=Date.now();
    if(gate&&gate.epoch===aiEpoch&&now<gate.readyAt)return;
    // 正常 650ms 调度不受影响；同时避免后台/测试的压缩计时器造成高频重复寻路。
    aiThinkGate.set(pi,{epoch:aiEpoch,readyAt:now+400});
    const difficulty=typeof aiDifficultyFromOptions === 'function' ? aiDifficultyFromOptions(opts) : {id:'hard'};
    const plan=tankAIPlan(pi,difficulty);
    if(!plan||!plan.near.length)return;
    aiPending.add(pi); const epoch = aiEpoch,plannedAt=Date.now();
    const choices=plan.near.map(item=>item.choice);
    const learningCandidates=plan.near.map(item=>({choice:item.choice,features:{...item.features}}));
    const remoteAllowed=typeof aiDifficultyAllowsRemote === 'function' ? aiDifficultyAllowsRemote(difficulty) : difficulty.id==='hard';
    const remoteProfile=typeof aiDifficultyRequestProfile === 'function' ? aiDifficultyRequestProfile(difficulty) : {id:'teacher',difficulty:difficulty.id};
    // 所有难度上传合法候选记录学习；远端选择仅在困难档影响实际输入。
    const remote = await aiChoose('tank', {
      season, remainingMs, player:pi,
      tanks:tanks.map(t => ({id:t.id,x:+t.x.toFixed(2),y:+t.y.toFixed(2),d:t.d,hp:t.hp,alive:t.alive,kills:t.kills,damage:t.damage})),
      bullets:bullets.map(b=>({owner:b.owner,x:+b.x.toFixed(2),y:+b.y.toFixed(2),d:b.d,ttl:Math.round(b.ttl)})),
      grid:grid.map(row => row.join('')),
      target:plan.targetInfo?{id:plan.targetInfo.target.id,priority:+plan.targetInfo.priority.toFixed(3),threat:+plan.targetInfo.threat.toFixed(3)}:null,
      localRanking:plan.near.map(item=>({choice:item.choice,score:+item.score.toFixed(2)})),
    }, choices, remoteProfile, learningCandidates);
    if (destroyed || over || epoch !== aiEpoch || !tanks[pi] || !tanks[pi].alive){ aiPending.delete(pi); return; }
    // 实时局面在模型等待期间仍会变化：旧选择必须在新影响图中仍属近优，否则立即重规划。
    const livePlan=Date.now()-plannedAt>120?tankAIPlan(pi,difficulty):plan;
    const liveChoices=livePlan?livePlan.near.map(item=>item.choice):[];
    const localIndex=typeof aiDifficultyLocalChoiceIndex === 'function'
      ? aiDifficultyLocalChoiceIndex(difficulty,liveChoices.length) : (difficulty.id==='easy'?Math.min(liveChoices.length-1,1):0);
    const localChoice=liveChoices[Math.max(0,localIndex)] || (livePlan?livePlan.best.choice:plan.best.choice);
    // 模型响应必须仍位于最新合法近优带内；否则执行难度对应的本地候选。
    const choice = remoteAllowed&&choices.includes(remote)&&liveChoices.includes(remote) ? remote : localChoice;
    aiPending.delete(pi);
    const actor=tanks[pi];
    if (choice === 'shoot'){
      if (authorityMode && typeof opts.sendBotTankInput === 'function') { opts.sendBotTankInput(pi, { input:{ fire:true, direction:actor.d }, clientTick:authorityServerTick }); aiPending.delete(pi); return; }
      if(fireTank(actor)&&opts.onProgress)opts.onProgress({act:'shoot'});
    } else {
      const direction = Number(choice.slice(-1));
      if (authorityMode && typeof opts.sendBotTankInput === 'function') { opts.sendBotTankInput(pi, { input:{ up:direction===0, right:direction===1, down:direction===2, left:direction===3 }, clientTick:authorityServerTick }); aiPending.delete(pi); return; }
      if (opts.onProgress) opts.onProgress({act:'move',d:direction});
      pulseMove(pi,direction,false);
    }
  }
  const aiTimer = setInterval(() => { if (opts.ai) opts.ai.forEach(pi => scheduleAIPlayer(pi)); }, 650);
  if (aiTimer && typeof aiTimer.unref === 'function') aiTimer.unref();

  function seasonBackground(){
    return {
      spring:'radial-gradient(circle at 20% 15%,rgba(255,255,255,.72),transparent 25%),linear-gradient(145deg,#8fcf75,#4f8f5d)',
      summer:'radial-gradient(circle at 80% 10%,rgba(255,244,163,.9),transparent 22%),linear-gradient(145deg,#53a653,#286b43)',
      autumn:'radial-gradient(circle at 25% 15%,rgba(255,225,153,.74),transparent 22%),linear-gradient(145deg,#c9893f,#824625)',
      winter:'radial-gradient(circle at 30% 20%,rgba(255,255,255,.95),transparent 30%),linear-gradient(145deg,#e5f4ff,#91abc2)',
    }[season];
  }
  function updateStatus(){
    if (over) return;
    const text=(spectator ? t('spectating_prefix') : '') + t('tank_realtime') + ' · ' + seasonLabel(season) + ' · ' + t('seconds_short',Math.ceil(remainingMs/1000));
    if(text!==lastStatusText){lastStatusText=text;setStatus(text);}
  }
  function ensureRenderTree(){
    if(renderNodes.board&&area.querySelector&&area.querySelector('.tank-board')===renderNodes.board)return renderNodes.board;
    // A rebuilt DOM root is a fresh visual generation.  The optional canvas
    // is recreated only after this new board is fully mounted.
    tankGhost3DInvalidate(false);
    area.innerHTML='';
    tankWaveCProcessRail = null; tankWaveCProcessLabel = null; tankWaveCProcessSteps = [];
    const board=el('div','tank-board realtime-arena season-'+season);
    board.style.touchAction='none';board.style.overscrollBehavior='contain';board.style.overflow='hidden';
    board.addEventListener('pointerdown',event=>{if(event.button===0)localShoot();});
    area.appendChild(board);renderNodes.board=board;
    renderNodes.staticCells.clear();renderNodes.traces.clear();renderNodes.bullets.clear();renderNodes.tanks.clear();renderNodes.respawns.clear();renderNodes.effects.clear();
    if(!renderNodes.time){
      renderNodes.time=el('strong','tank-time');hud.appendChild(renderNodes.time);
      for(let index=0;index<playerCount;index++){const score=el('span','tank-score-chip');renderNodes.scores.push(score);hud.appendChild(score);}
      hud.style.cssText='display:flex;gap:7px;justify-content:center;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:12px;';
    }
    tankWaveCProcessRail = el('section','tank-wave-c-process');
    tankWaveCProcessRail.setAttribute('role','status'); tankWaveCProcessRail.setAttribute('aria-live','polite');
    tankWaveCProcessLabel = el('output','tank-wave-c-process-label');
    const track = el('div','tank-wave-c-process-track');
    tankWaveCProcessSteps = TANK_WAVE_C_PROCESS_STEPS.map(step => {
      const node = el('span','tank-wave-c-process-step');
      node.dataset.tankProcessStep = step; node.setAttribute('data-tank-process-step',step); track.appendChild(node); return node;
    });
    tankWaveCProcessRail.appendChild(tankWaveCProcessLabel); tankWaveCProcessRail.appendChild(track); area.appendChild(tankWaveCProcessRail);
    tankWaveCProcessRail.style.cssText='display:grid;gap:7px;width:min(100%,' + Math.max(260, Math.min(640, Number(area.clientWidth) || 560)) + 'px);margin:10px auto 0;padding:9px 10px;box-sizing:border-box;border:1px solid rgba(43,32,37,.28);border-radius:14px;background:linear-gradient(135deg,rgba(67,90,193,.12),rgba(255,255,255,.68));box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 3px 0 rgba(76,43,21,.12);color:var(--stage-ink,var(--text));';
    tankWaveCProcessLabel.style.cssText='min-width:0;font-size:10px;font-weight:900;line-height:1.35;overflow-wrap:anywhere;';
    track.style.cssText='display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;min-height:8px;';
    tankWaveCProcessSteps.forEach(step => { step.style.cssText='display:block;min-width:0;height:7px;border-radius:999px;background:rgba(76,43,21,.16);box-shadow:inset 0 1px 1px rgba(255,255,255,.65);'; });
    paintTankWaveCProcess();
    return board;
  }
  function render(){
    if (destroyed) return;
    // Fit the map and its live process rail into the measured Arena.  The old
    // 620px cap made wide/tall stages look like a card inside a room; this
    // preserves the map ratio while taking every usable height/width pixel.
    const availableWidth = Math.max(240, Number(area.clientWidth) || 560);
    const availableHeight = Math.max(0, Number(area.clientHeight) || 0);
    const widthBudget = Math.max(240, Math.min(availableWidth - 16, 980));
    const heightBudget = availableHeight > 0 ? Math.max(240, (availableHeight - 76) * W / H) : widthBudget;
    const width = Math.min(widthBudget, heightBudget);
    const cell = width/W, height = cell*H;
    const board=ensureRenderTree();
    board.className='tank-board realtime-arena season-'+season;
    if (board.style && typeof board.style.setProperty === 'function') board.style.setProperty('--tank-wave-c-board-size', width+'px');
    const tabletop = typeof tabletopArtEnabled === 'function' && tabletopArtEnabled();
    if (typeof markTabletopSurface === 'function') markTabletopSurface(board, 'tank-arena', { variant: season });
    board.style.width = width+'px'; board.style.height = height+'px'; board.style.maxWidth='100%'; board.style.boxSizing='border-box'; board.style.margin='0 auto'; board.style.transform='translateZ(0)';
    board.style.background = tabletop
      ? 'radial-gradient(circle at 22% 16%,rgba(255,255,255,.35),transparent 22%),linear-gradient(135deg,#74b985,#3b7b62)'
      : seasonBackground();
    const staticItems=[];for(let r=0;r<H;r++)for(let c=0;c<W;c++)if(grid[r][c])staticItems.push({r,c,type:grid[r][c]});
    syncRenderMap(renderNodes.staticCells,staticItems,item=>item.r+':'+item.c,
      item=>{const node=el('div','tank-cell tank-ghost3d-dom-paint');node.style.zIndex='1';board.appendChild(node);return node;},
      (node,item)=>{node.className='tank-cell tank-ghost3d-dom-paint '+(item.type===3?'steel':'brick');node.style.left=item.c*cell+'px';node.style.top=item.r*cell+'px';node.style.width=cell+'px';node.style.height=cell+'px';});
    syncRenderMap(renderNodes.traces,traces,item=>renderObjectKey(item,'trace'),
      item=>{const node=el('div','tank-trace tank-ghost3d-dom-paint');board.appendChild(node);return node;},
      (node,item)=>{node.className='tank-trace tank-ghost3d-dom-paint '+item.type;node.textContent=item.type==='scorch'?'✹':'';node.style.cssText='position:absolute;z-index:2;left:'+((item.x-.18)*cell)+'px;top:'+((item.y-.18)*cell)+'px;width:'+(cell*.36)+'px;height:'+(cell*.36)+'px;opacity:.34;pointer-events:none;color:#312e2a;font-size:'+(cell*.28)+'px;';});
    syncRenderMap(renderNodes.bullets,bullets,item=>String(item.id),
      item=>{const node=el('div','tank-projectile tank-ghost3d-dom-paint','●');board.appendChild(node);return node;},
      (node,item)=>{node.style.cssText='position:absolute;z-index:3;left:'+((item.x-.12)*cell)+'px;top:'+((item.y-.12)*cell)+'px;width:'+(cell*.24)+'px;height:'+(cell*.24)+'px;color:#fde047;text-shadow:0 0 8px #fff;pointer-events:none;';});
    syncRenderMap(renderNodes.tanks,tanks,item=>String(item.id),
      tank=>{const node=el('div','tank-cell arena-tank');node._icon=el('span','tank-icon tank-ghost3d-dom-paint');node._hp=el('span','hp tank-hp-status');node.appendChild(node._icon);node.appendChild(node._hp);board.appendChild(node);return node;},
      (node,tank)=>{const skin=cosmetic.players&&cosmetic.players[tank.id]||cosmetic.default||'classic';node.className='tank-cell arena-tank tank'+tank.id+' skin-'+skin;node.style.display=tank.alive?'flex':'none';node.style.zIndex='8';node.style.left=((tank.x-.5)*cell)+'px';node.style.top=((tank.y-.5)*cell)+'px';node.style.width=cell+'px';node.style.height=cell+'px';node.style.transform='rotate('+(tank.d*90)+'deg)';node.style.filter=Date.now()<tank.invulnerableUntil?'drop-shadow(0 0 9px #fff) brightness(1.3)':'';node._icon.textContent=skin==='cyber'?'🤖':'🛡️';node._hp.textContent='♥'.repeat(Math.max(0,tank.hp));node._hp.style.transform='rotate('+(-tank.d*90)+'deg)';});
    syncRenderMap(renderNodes.respawns,tanks.filter(tank=>!tank.alive),item=>String(item.id),
      tank=>{const node=el('div','tank-respawn tank-ghost3d-status');board.appendChild(node);return node;},
      (node,tank)=>{node.textContent='↻ '+Math.max(1,Math.ceil((tank.respawnAt-Date.now())/1000));node.style.cssText='position:absolute;z-index:8;left:'+((tank.x-.45)*cell)+'px;top:'+((tank.y-.45)*cell)+'px;color:#fff;font-weight:900;text-shadow:0 1px 3px rgba(0,0,0,.88);pointer-events:none;';});
    syncRenderMap(renderNodes.effects,effects,item=>renderObjectKey(item,'effect'),
      item=>{const node=el('div','tank-effect tank-ghost3d-dom-paint');board.appendChild(node);return node;},
      (node,item)=>{node.className='tank-effect tank-ghost3d-dom-paint '+item.type;node.textContent=item.type==='explosion'?'💥':item.type==='respawn'?'✨':item.type==='muzzle'?'✦':'✹';node.style.cssText='position:absolute;z-index:5;left:'+((item.x-.45)*cell)+'px;top:'+((item.y-.45)*cell)+'px;width:'+cell+'px;height:'+cell+'px;font-size:'+(cell*.7)+'px;pointer-events:none;';});
    const timeText='⏱ '+Math.floor(remainingMs/60000)+':'+String(Math.ceil(remainingMs/1000)%60).padStart(2,'0')+' · '+seasonLabel(season);
    if(renderNodes.time.textContent!==timeText)renderNodes.time.textContent=timeText;
    ranking().forEach((id,index)=>{const tank=tanks[id],text=t('tank_score_line',id+1,tank.kills,tank.deaths,tank.damage);if(renderNodes.scores[index].textContent!==text)renderNodes.scores[index].textContent=text;});
    controls.style.display=spectator?'none':'flex';
    const playerRows=tanks.map(tank=>t('tank_player_stats',tank.kills,tank.deaths,tank.damage)),playersSignature=controlledPlayer()+'|'+playerRows.join('|');
    if(playersSignature!==lastPlayersSignature){lastPlayersSignature=playersSignature;renderPlayers(controlledPlayer(),playerRows);}
    updateStatus();
    // Safe tail only: DOM controls/HUD/board have already been painted and
    // the presenter receives no mutable game or input references.
    commitTankGhost3DPresenter();
    if(over)queueTankVictoryOverlay();
  }

  function syncRelayMatch(){
    const matchId = currentMatchId();
    if (matchId === relayMatchId) return matchId;
    relayMatchId = matchId; inputSequence = 0; authoritySequence = 0; lastAuthoritySequence = -1;
    lastInputSequence = Array(playerCount).fill(-1); resultCommitted = false; lastRelayAt = 0;
    return matchId;
  }
  function relayPayloadMatches(payload){
    const expected = syncRelayMatch();
    return !payload.matchId || !expected || String(payload.matchId) === expected;
  }
  function acceptInputSequence(pi,payload){
    if (!Object.prototype.hasOwnProperty.call(payload,'seq')) return true; // 兼容旧 act:move/shoot。
    const seq = Number(payload.seq);
    if (!Number.isSafeInteger(seq) || seq < 1 || seq <= lastInputSequence[pi]) return false;
    lastInputSequence[pi] = seq;
    if (opts.online && pi === controlledPlayer() && opts.isReplaying && opts.isReplaying()) inputSequence = Math.max(inputSequence,seq);
    return true;
  }
  function broadcastAuthoritativeState(finalOrder){
    if (authorityMode || !opts.online || !opts.isHost || typeof opts.sendMove !== 'function' || (opts.isReplaying && opts.isReplaying())) return false;
    const matchId = syncRelayMatch();
    if (!matchId) return false;
    const order = validOrder(finalOrder) ? finalOrder.slice() : null;
    const payload = {
      act:order ? 'authoritative_result' : 'authoritative_state', protocol:RELAY_PROTOCOL,
      matchId, authoritySeq:++authoritySequence, state:snapshot(),
    };
    if (order) payload.order = order;
    opts.sendMove(payload); lastRelayAt = Date.now();
    return true;
  }
  function applyAuthoritativeState(payload,player){
    const replaying = !!(opts.isReplaying && opts.isReplaying());
    const replayingHost = !!(opts.isHost && replaying);
    if (resultCommitted || !opts.online || (opts.isHost && !replayingHost) || player !== HOST_PLAYER || payload.protocol !== RELAY_PROTOCOL || !relayPayloadMatches(payload)) return false;
    const seq = Number(payload.authoritySeq);
    if (!Number.isSafeInteger(seq) || seq < 1 || seq <= lastAuthoritySequence) return false;
    const finalOrder = payload.act === 'authoritative_result' ? payload.order : null;
    if (payload.act === 'authoritative_result' && !validOrder(finalOrder)) return false;
    const localInput = !finalOrder && tanks[controlledPlayer()] ? getLocalInput() : null;
    if (!onRestore(payload.state,replaying)) return false;
    lastAuthoritySequence = seq;
    if (replayingHost) authoritySequence = Math.max(authoritySequence,seq);
    if (localInput && tanks[controlledPlayer()]) tanks[controlledPlayer()].input = localInput;
    if (finalOrder) commitFinal(finalOrder,false);
    return true;
  }
  opts.onMove = (payload, player) => {
    if(authorityMode)return;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
    const pi = opts.online ? Number(player) : (Number.isInteger(player) ? player : 0);
    if (!Number.isInteger(pi) || pi < 0 || pi >= tanks.length) return;
    if (payload.act === 'authoritative_state' || payload.act === 'authoritative_result'){
      applyAuthoritativeState(payload,pi); return;
    }
    if (over || !relayPayloadMatches(payload)) return;
    if (payload.protocol && payload.protocol !== RELAY_PROTOCOL) return;
    if (!['input','move','shoot'].includes(payload.act) || !acceptInputSequence(pi,payload)) return;
    if (payload.act === 'input' && payload.input) setPlayerInput(pi,payload.input,false);
    else if (payload.act === 'move') pulseMove(pi,Number(payload.d),false);
    else if (payload.act === 'shoot') fireTank(tanks[pi]);
  };
  function reset(){
    if (opts.online && !opts.isHost){ toast(t('host_only_restart')); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  function snapshot(){
    const compat = id => { const t=tanks[id]||createTank(id); return {r:Math.round(t.y),c:Math.round(t.x),d:t.d,lives:t.hp}; };
    return {
      version:3, mode:'realtime-deathmatch', authority:authorityMode?'server-authority':opts.online?'casual-host-relay':'local-simulation',
      tanks:tanks.map(t=>({ ...t,input:{...t.input} })), bullets:bullets.map(b=>({...b})),
      grid:grid.map(row=>row.slice()), season, remainingMs, startedAt, over, winner, cur,
      t0:compat(0), t1:compat(1),
    };
  }
  function finiteNumber(value,fallback,min,max){
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min,Math.min(max,number)) : fallback;
  }
  function sanitizeTank(value,id){
    const base=createTank(id), tank=value&&typeof value==='object'?value:{};
    return {
      ...base, id,
      x:finiteNumber(tank.x,base.x,.5,W-.5), y:finiteNumber(tank.y,base.y,.5,H-.5),
      d:Number.isInteger(tank.d)&&tank.d>=0&&tank.d<4?tank.d:base.d,
      hp:Math.max(0,Math.min(3,Math.floor(finiteNumber(tank.hp,base.hp,0,3)))), alive:tank.alive!==false,
      respawnAt:finiteNumber(tank.respawnAt,0,0,Date.now()+60000),
      invulnerableUntil:finiteNumber(tank.invulnerableUntil,0,0,Date.now()+60000),
      fireReadyAt:finiteNumber(tank.fireReadyAt,0,0,Date.now()+60000), input:normalizeInput(tank.input),
      kills:Math.max(0,Math.floor(Number(tank.kills)||0)), deaths:Math.max(0,Math.floor(Number(tank.deaths)||0)),
      damage:Math.max(0,Math.floor(Number(tank.damage)||0)), shots:Math.max(0,Math.floor(Number(tank.shots)||0)),
      hits:Math.max(0,Math.floor(Number(tank.hits)||0)),
      placement:Number.isInteger(tank.placement)&&tank.placement>=1&&tank.placement<=playerCount?tank.placement:0,
    };
  }
  function tankAudioAuthorityState(tank){
    if(!tank)return null;
    return {
      x:Number(tank.x), y:Number(tank.y), d:Number(tank.d), hp:Number(tank.hp),
      alive:tank.alive===true, shots:Number(tank.shots)||0, deaths:Number(tank.deaths)||0,
    };
  }
  function onRestore(value,silent){
    const state=value&&value.state?value.state:value;
    if (!state || !Array.isArray(state.tanks) || state.tanks.length !== playerCount || !Array.isArray(state.grid) ||
        state.grid.length !== H || state.grid.some(row=>!Array.isArray(row)||row.length!==W)) return false;
    resetTankInputGate();
    resetTankPrediction('restore');
    tankAudioAuthorityBaseline = null; tankAudioAuthorityMoveTick = -Infinity;
    // Restore/replay/legacy relay remain DOM-only.  Do not let a prior live
    // Authority receipt survive into a new visual generation.
    tankGhost3DInvalidate(true);tankGhost3DForcedDomOnly=true;
    aiEpoch++; clearTankWaveCProcessTimers(); tankWaveCProcessEpoch++;
    grid=state.grid.map(row=>row.map(v=>v===2||v===3?v:0));
    tanks=state.tanks.map((t,id)=>sanitizeTank(t,id));
    bullets=(Array.isArray(state.bullets)?state.bullets:[]).slice(0,128).map((b,index)=>({
      id:Number.isSafeInteger(Number(b&&b.id))?Number(b.id):index+1,
      owner:Number.isInteger(b&&b.owner)&&b.owner>=0&&b.owner<playerCount?b.owner:0,
      x:finiteNumber(b&&b.x,1,.01,W-.01), y:finiteNumber(b&&b.y,1,.01,H-.01),
      d:Number.isInteger(b&&b.d)&&b.d>=0&&b.d<4?b.d:0, ttl:finiteNumber(b&&b.ttl,0,0,3000),
    })).filter(b=>b.ttl>0);
    bulletSequence=bullets.reduce((max,b)=>Math.max(max,b.id),bulletSequence);
    season=SEASONS.includes(state.season)?state.season:'spring'; remainingMs=finiteNumber(state.remainingMs,0,0,MATCH_MS);
    startedAt=Date.now()-(MATCH_MS-remainingMs); over=!!state.over;
    winner=Number.isInteger(state.winner)&&state.winner>=0&&state.winner<playerCount?state.winner:-1;
    cur=Number.isInteger(state.cur)&&state.cur>=0&&state.cur<playerCount?state.cur:0;
    lastLoopAt=Date.now(); accumulator=0; traces=[]; effects=[];
    if (value&&value.presentation) setCosmetic(value.presentation.cosmetic);
    setTankWaveCProcess(over ? 'terminal' : 'ready', cur);
    if (!silent) render(); return true;
  }
  function onAuthoritySnapshot(state,silent){
    if(!authorityMode||!state||state.protocol!==AUTH_PROTOCOL||String(state.matchId||'')!==currentMatchId()||!Array.isArray(state.players)||state.players.length!==playerCount)return false;
    if (resultCommitted || over) return false;
    // The optional renderer has a stricter monotonic receipt boundary than
    // the retained DOM authority path.  An old, malformed, or conflicting
    // tick fails closed for Ghost3D but must still be reconciled by the
    // existing authoritative DOM simulation below.
    if(Number(state.serverTick)<authorityServerTick)tankGhost3DFailClosedAuthorityReceipt();
    const receiptStatus=tankGhost3DRememberAuthorityReceipt(state,silent===true);
    // An exact duplicate is already represented by the current DOM and 3D
    // receipt.  Treat it as an accepted no-op so callers retain the legacy
    // authority contract without allocating a new renderer frame.
    if(receiptStatus==='duplicate_tick')return true;
    // The retained DOM path may still reconcile a stale/conflicting receipt
    // for backwards compatibility, but audio must never treat that frame as
    // an accepted authority delta or let it replace the next cue baseline.
    const audioReceiptAccepted = receiptStatus === 'accepted';
    if(silent===true){resetTankInputGate();resetTankPrediction('authority-bootstrap');}
    const predictionReceipt=acceptTankPrediction(state);
    const predictionPresentation=predictionReceipt&&predictionReceipt.accepted===true?predictionReceipt.presentation:null;
    const old=tanks.slice(),localId=controlledPlayer(),serverTick=Math.max(0,Math.floor(Number(state.serverTick)||0));
    const previousAudioBaseline=Array.isArray(tankAudioAuthorityBaseline)?tankAudioAuthorityBaseline:null;
    const nextAudioBaseline=Array(playerCount).fill(null);
    authorityServerTick=Math.max(authorityServerTick,serverTick);
    const ack=Array.isArray(state.ack)?state.ack.slice(0,playerCount).map(value=>Math.max(0,Math.floor(Number(value)||0))):[];
    if(ack.length===playerCount){lastInputSequence=ack;inputSequence=Math.max(inputSequence,ack[localId]||0);}
    authorityEndAt=Number(state.endAt)||authorityEndAt;remainingMs=Math.max(0,Number(state.remainingMs)||0);season=SEASONS.includes(state.season)?state.season:season;
    grid=(Array.isArray(state.destructibles)?state.destructibles:grid).map(row=>Array.isArray(row)?row.map(v=>v===2||v===3?v:0):[]);
    let authorityPresentation = null;
    const noteAuthorityPresentation = (process, id) => {
      const priority = process === 'ko' ? 3 : process === 'spawn' ? 2 : 1;
      if (!authorityPresentation || priority > authorityPresentation.priority ||
          (priority === authorityPresentation.priority && id < authorityPresentation.id)){
        authorityPresentation = { process, id, priority };
      }
    };
    tanks=state.players.map((raw,id)=>{
      const server=sanitizeTank(raw,id),canonicalAudio=tankAudioAuthorityState(server),previous=old[id],previousAudio=previousAudioBaseline&&previousAudioBaseline[id];
      nextAudioBaseline[id]=canonicalAudio;
      if(previous){
        if(silent!==true&&audioReceiptAccepted&&previousAudio){
          if(server.shots>previousAudio.shots)audioCue('tank_fire',{actionId:'tank-fire-'+serverTick+'-'+id+'-'+server.shots,reaction:'shoot'},.72,tankFeedbackPan(server.x));
          if(server.hp<previousAudio.hp||previousAudio.alive&&!server.alive)audioCue('tank_hit',{actionId:'tank-hit-'+serverTick+'-'+id+'-'+server.hp+'-'+server.deaths,reaction:'capture'},previousAudio.alive&&!server.alive?1:.8,tankFeedbackPan(server.x));
          if(previousAudio.alive&&!server.alive)audioCue('tank_ko',{actionId:'tank-ko-'+serverTick+'-'+id+'-'+server.deaths,reaction:'capture'},1,tankFeedbackPan(server.x));
          else if(!previousAudio.alive&&server.alive)audioCue('tank_respawn',{actionId:'tank-respawn-'+serverTick+'-'+id+'-'+server.deaths,reaction:'place'},.65);
          const movedByAuthority=Math.hypot(server.x-previousAudio.x,server.y-previousAudio.y)>.06||server.d!==previousAudio.d;
          if(id===localId&&server.alive&&movedByAuthority&&
             (server.d!==tankMoveCueDirection||serverTick-tankAudioAuthorityMoveTick>=4)){
            tankAudioAuthorityMoveTick=serverTick;tankMoveCueDirection=server.d;
            audioCue('tank_move',{actionId:'tank-move-authority-'+serverTick+'-'+id,reaction:'move'},.28);
          }
        }
        const predictionCandidate=id===localId&&predictionPresentation?predictionPresentation:null;
        const predicted=predictionCandidate&&
          !isBlocked(predictionCandidate.x,predictionCandidate.y,localId)&&
          tankPredictionPathClear(server.x,server.y,predictionCandidate.x,predictionCandidate.y,localId)&&
          (!previous||tankPredictionPathClear(previous.x,previous.y,predictionCandidate.x,predictionCandidate.y,localId))
          ?predictionCandidate:null;
        const targetX=predicted?predictionPresentation.x:server.x,targetY=predicted?predictionPresentation.y:server.y;
        const distance=Math.hypot(previous.x-targetX,previous.y-targetY),factor=id===localId?(distance<.8?.35:1):.55;
        server.x=previous.x+(targetX-previous.x)*factor;server.y=previous.y+(targetY-previous.y)*factor;
        if(predicted)server.d=predictionPresentation.d;
        if(previous.alive&&!server.alive){effects.push({x:server.x,y:server.y,type:'explosion',at:Date.now(),ttl:850});noteAuthorityPresentation('ko',id);}
        else if(!previous.alive&&server.alive){effects.push({x:server.x,y:server.y,type:'respawn',at:Date.now(),ttl:600});noteAuthorityPresentation('spawn',id);}
        else if(distance>.06) noteAuthorityPresentation('move',id);
      }
      if(id===localId)server.input=getLocalInput();
      return server;
    });
    if (audioReceiptAccepted) tankAudioAuthorityBaseline=nextAudioBaseline;
    if (authorityPresentation){
      if (authorityPresentation.process === 'ko'){
        setTankWaveCProcess('ko', authorityPresentation.id);
        settleTankWaveCProcess('score', authorityPresentation.id, 260);
      } else if (authorityPresentation.process === 'spawn'){
        setTankWaveCProcess('spawn', authorityPresentation.id);
        settleTankWaveCProcess('ready', authorityPresentation.id, 320);
      } else noteTankWaveCMove();
    }
    bullets=(Array.isArray(state.projectiles)?state.projectiles:[]).slice(0,128).map((b,index)=>({id:Number(b.id)||index+1,owner:Number(b.owner)||0,x:Number(b.x)||0,y:Number(b.y)||0,d:Number(b.d)||0,ttl:Number(b.ttl)||0}));
    if(!silent)render();return true;
  }
  function onAuthorityResult(payload){
    const order=payload&&payload.order;if(!authorityMode||resultCommitted||!validOrder(order))return false;
    // Result authority completes immediately.  The optional renderer may
    // remain only when its preceding accepted terminal snapshot already owns
    // a finite result shot; Prediction is retired synchronously either way.
    disposeTankPrediction();
    if(Array.isArray(payload.stats))payload.stats.forEach((item,id)=>{if(tanks[id])Object.assign(tanks[id],sanitizeTank(item,id));});
    over=true;finishedAt=Date.now();remainingMs=0;winner=order[0];resultCommitted=true;order.forEach((id,index)=>{if(tanks[id])tanks[id].placement=index+1;});
    clearTankWaveCProcessTimers(); setTankWaveCProcess('score', winner);
    settleTankWaveCProcess('terminal', winner, 260);
    render();setStatus(t('tank_server_final',winner+1),true);return true;
  }
  function getMatchStats(){
    const order=ranking();
    return tanks.map(t=>({kills:t.kills,deaths:t.deaths,damage:t.damage,shots:t.shots,hits:t.hits,placement:t.placement||order.indexOf(t.id)+1}));
  }
  function getPerformanceStats(){return{...performanceStats,activeParticles:effects.length,activeProjectiles:bullets.length,trailCount:traces.length,caps:{particles:40,projectiles:128,trails:60}};}
  function setSeason(value){ season=SEASONS.includes(value)?value:'spring'; tankGhost3DMarkLocalCommitted(); render(); return season; }
  function setCosmetic(value){ cosmetic={default:'classic',players:{},...(value||{})}; cosmetic.default=cosmetic.default==='cyber'?'cyber':'classic'; render(); return cosmetic; }
  function setSpectators(value){ spectator=Array.isArray(value)?value.includes(opts.viewerId):!!value; tankGhost3DInvalidate(false); releaseAllControls(false); resetTankInputGate(); resetTankPrediction('spectator'); render(); return spectator; }
  function destroy(){
    if (!destroyed) releaseAllControls(true);
    destroyed=true; disposeTankGhost3DPresenter(); disposeTankInputGate(); disposeTankPrediction(); disposeTankFeedback(); aiEpoch++; tankWaveCProcessEpoch++; tankWaveCProcessRevision++; aiPending.clear(); aiThinkGate.clear(); clearTransientTimers(); clearTankWaveCProcessTimers(); clearInterval(simulationTimer); clearInterval(aiTimer);
    if (document.removeEventListener){ document.removeEventListener('keydown',keyDown); document.removeEventListener('keyup',keyUp); }
    if (document.removeEventListener) document.removeEventListener('visibilitychange',onVisibilityChange);
    if (typeof window!=='undefined' && window.removeEventListener){ window.removeEventListener('blur',onWindowBlur); window.removeEventListener('pointerup',releaseFirePointer); window.removeEventListener('pointercancel',releaseFirePointer); }
    area.style.touchAction=previousTouchAction; area.style.overscrollBehavior=previousOverscroll; area.style.display=previousDisplay; area.style.flexDirection=previousFlexDirection; area.style.alignItems=previousAlignItems; area.style.justifyContent=previousJustifyContent;
  }
  resetLocal();
  return { reset,onMove:opts.onMove,onRestart:resetLocal,destroy,snapshot,onRestore,onAuthoritySnapshot,onAuthorityResult,
    serialize:()=>({state:snapshot(),presentation:{season,cosmetic},stats:getMatchStats()}),
    fixedUpdate,getMatchStats,getPerformanceStats,setSeason,setCosmetic,renderCosmetic:setCosmetic,setSpectators,finishMatch,
    getPresentationState:()=>({process:tankWaveCProcess,detail:tankWaveCProcessDetail,epoch:tankWaveCProcessEpoch,revision:tankWaveCProcessRevision}),
    // moveLog 中的权威快照已包含完整状态，重连回放无需为每条实时事件等待动画。
    whenIdle:()=>Promise.resolve(),
    broadcastAuthoritativeState,
    getRelayState:()=>({
      protocol:authorityMode?AUTH_PROTOCOL:RELAY_PROTOCOL, role:opts.online?(opts.isHost?'host':'client'):'local', matchId:currentMatchId(),
      localInputSeq:inputSequence, authoritySeq:authoritySequence, lastAuthoritySeq:lastAuthoritySequence,
      serverTick:authorityServerTick, lastInputSeq:lastInputSequence.slice(), resultCommitted,
    }),
    getMultiplayerRequirement:()=>opts.online?'REALTIME_TANK_PROTOCOL_V1':null,
  };
}
