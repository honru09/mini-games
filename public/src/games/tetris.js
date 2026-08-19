/* ================= 俄罗斯方块 · Simultaneous Survival Battle ================= */
function gameTetris(area, extra, n, opts){
  opts = opts || {};
  const acceptedAudioCue = typeof emitAcceptedAudioCue === 'function' ? emitAcceptedAudioCue : null;
  const audioCue = (type, context, intensity, pan) => {
    try {
      if (acceptedAudioCue) return acceptedAudioCue(type, context, intensity, pan);
      if (typeof playFeedback === 'function') {
        const fallbackContext = context && typeof context === 'object' ? { ...context, audioType:type } : { audioType:type };
        return playFeedback(fallbackContext.reaction || 'tap', fallbackContext);
      }
    } catch (_error) {}
    return { accepted:false, reason:'unavailable' };
  };
  const COLS = 10, ROWS = 18, playerCount = Math.max(2, Math.min(5, Number(n) || 2));
  const MATCH_MS = Math.max(15000, Number(opts.matchDurationMs) || 300000);
  const AUTH_PROTOCOL='tetris-battle-authority-v1',RULE_PROTOCOL='tetris-rule-v3';
  const SCORING_VERSION='advanced-battle-score-v1';
  const fullRuleAuthority=!!(opts.online&&opts.gameplayMeta&&opts.gameplayMeta.protocol===RULE_PROTOCOL&&typeof opts.sendTetrisAction==='function'&&typeof TetrisRules!=='undefined');
  const authorityMode=!!(opts.online&&opts.gameplayMeta&&((opts.gameplayMeta.protocol===AUTH_PROTOCOL&&typeof opts.sendTetrisLockClaim==='function')||fullRuleAuthority));
  const SHAPES = [
    [[1,1,1,1]], [[1,1],[1,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]],
    [[0,1,1],[1,1,0]], [[1,1,0],[0,1,1]], [[0,1,0],[1,1,1]],
  ];
  const COLORS = ['#22d3ee','#facc15','#a78bfa','#fb923c','#34d399','#f87171','#e879f9'];
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none'; area.style.overscrollBehavior = 'contain';

  let states = [], wells = [], scores = [], over = false, winner = -1, cur = 0, pieceCount = 0;
  let startedAt = Date.now(), finishedAt = 0, remainingMs = MATCH_MS, destroyed = false, aiEpoch = 0;
  let observedPlayer = 0, controlled = opts.online ? Math.max(0, Number(opts.myIdx) || 0) : 0;
  const hostSlot = Number.isInteger(opts.hostIdx) ? opts.hostIdx : (opts.isHost ? controlled : 0);
  const RELAY_SYNC_MS = Math.max(500, Number(opts.relaySyncMs) || 1200);
  let spectator = !!opts.spectator, seq = 0, lastSeq = Array(playerCount).fill(0), presentationSeq = Array(playerCount).fill(0), ruleSeq = Array(playerCount).fill(0), countdownEndsAt = Date.now();
  let bagSeed = resolveMatchSeed(), garbageNonce = 0, relayRevision = 0, endReported = false, battleSeq=0, stateSeq=0, authorityRevision=0, matchEndAt=0, ruleStateApplied=false, tetrisAudioSequence=0;
  let seenAttacks = new Set(), pendingBattleScoring = new Map(), seenBattleAudioEvents = new Set();
  let cosmetic = { block:'classic', background:'classic', players:{}, ...(opts.cosmetic || {}) };
  let lastTickAt = Date.now(), lastRenderAt = 0;
  const performanceStats={samples:0,lastFrameMs:0,maxFrameMs:0,longFrames:0};
  let renderTree=null,lastPlayersSignature='',lastStatusText='',victoryShown=false;
  let tetrisOutcomeTimer=null,tetrisOutcomeScheduled=false,tetrisOutcomeEpoch=0;
  const miniViews=new Map();
  const tetrisInputGateRequested=fullRuleAuthority&&tetrisTechnicalFeature('gameplayInputGateV1');
  let tetrisInputGate=null,tetrisInputGateGeneration=0,tetrisInputGateRevision=0,tetrisInputSemanticSequence=0;
  let tetrisInputDispatchAttempted=false,tetrisInputDispatchResult=false;
  const WAVE_B_STORAGE_KEY='mg_art_game_stage_wave_b_v1';
  // Ghost3D P4 is a frozen, explicitly opted-in compatibility seam. It reads only already
  // committed local facts or accepted v3 authority facts; it cannot feed an
  // action, renderer command, or presentation-only state back into Tetris.
  const TETRIS_GHOST3D_STORAGE_KEY='mg_ghost3d_tetris_v1';
  const TETRIS_GHOST3D_QUALITY_STORAGE_KEY='mg_ghost3d_tetris_quality_v1';
  const TETRIS_GHOST3D_QUALITIES=new Set(['HIGH','BALANCED','LOW']);
  const TETRIS_GHOST3D_SOURCES=new Set(['local','live','room-restored','reconnect','spectator-bootstrap','reconcile']);
  let tetrisGhost3DPresenter=null,tetrisGhost3DAcceptedV3=null,tetrisGhost3DLocalLock=null;
  let tetrisGhost3DSource='local',tetrisGhost3DResetEpoch=0,tetrisGhost3DCommitActive=false;
  let tetrisPresentationResizeQueued=false,tetrisPresentationResizeFrame=0,tetrisPresentationResizeObserver=null;

  function tetrisTechnicalFeature(name){
    try{return !!(opts&&opts.technicalFeatures&&opts.technicalFeatures[name]===true);}catch(_error){return false;}
  }
  function tetrisInputSessionId(){
    let value='';
    try{value=String(resolveMatchId()||'');}catch(_error){value='';}
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)?value:'tetris-session-'+Math.max(1,tetrisInputGateRevision);
  }
  function resetTetrisInputGate(){
    if(!tetrisInputGateRequested||typeof GameplayInputGate==='undefined'||!GameplayInputGate||typeof GameplayInputGate.create!=='function'){
      if(tetrisInputGate&&typeof tetrisInputGate.dispose==='function')tetrisInputGate.dispose();
      tetrisInputGate=null;tetrisInputGateGeneration=0;tetrisInputSemanticSequence=0;return false;
    }
    if(!tetrisInputGate){
      try{
        tetrisInputGate=GameplayInputGate.create({bufferMs:75,onIntent(intent){
          tetrisInputDispatchAttempted=true;tetrisInputDispatchResult=executeTetrisInputIntent(intent&&intent.type);
        }});
      }catch(_error){tetrisInputGate=null;return false;}
    }
    const revision=++tetrisInputGateRevision;
    let opened=null;
    try{opened=tetrisInputGate.reset({gameId:'tetris',matchId:tetrisInputSessionId(),revision,enabled:true,bufferMs:75});}catch(_error){opened=null;}
    if(!opened||opened.accepted!==true){
      try{tetrisInputGate.dispose();}catch(_error){}
      tetrisInputGate=null;tetrisInputGateGeneration=0;tetrisInputSemanticSequence=0;return false;
    }
    tetrisInputGateGeneration=opened.generation;tetrisInputSemanticSequence=0;return true;
  }
  function disposeTetrisInputGate(){
    if(tetrisInputGate&&typeof tetrisInputGate.dispose==='function'){try{tetrisInputGate.dispose();}catch(_error){}}
    tetrisInputGate=null;tetrisInputGateGeneration=0;tetrisInputSemanticSequence=0;
  }

  // Wave B is deliberately a local presentation switch.  It does not enter a
  // snapshot, relay payload, Authority action, or any game-state calculation.
  function waveBEnabled(){
    try{
      if(typeof localStorage==='undefined'||!localStorage||typeof localStorage.getItem!=='function')return false;
      return localStorage.getItem(WAVE_B_STORAGE_KEY)!=='0';
    }catch(_error){return false;}
  }
  function tetrisGhost3DEnabled(){
    if(!waveBEnabled())return false;
    try{
      const storage=typeof window!=='undefined'?window.localStorage:null;
      return !!storage&&typeof storage.getItem==='function'&&storage.getItem(TETRIS_GHOST3D_STORAGE_KEY)==='1';
    }catch(_error){return false;}
  }
  function tetrisGhost3DInitialQuality(){
    try{
      const storage=typeof window!=='undefined'?window.localStorage:null;
      const value=storage&&typeof storage.getItem==='function'?storage.getItem(TETRIS_GHOST3D_QUALITY_STORAGE_KEY):null;
      return TETRIS_GHOST3D_QUALITIES.has(value)?value:'BALANCED';
    }catch(_error){return 'BALANCED';}
  }
  // P4 source continuity is a trust boundary.  Unknown local caller tags must
  // never be silently reclassified as a harmless static reconciliation.
  function tetrisGhost3DSourceName(value){return TETRIS_GHOST3D_SOURCES.has(value)?value:null;}
  function tetrisGhost3DStateProjection(state){
    if(!state||!validWell(state.well)||!validActive(state.active)||typeof state.alive!=='boolean'||!safeInt(state.placementSeq,0,Number.MAX_SAFE_INTEGER))return null;
    return{well:state.well.map(row=>row.slice()),active:state.active===null?null:{kind:state.active.kind,rotation:state.active.rotation,x:state.active.x,y:state.active.y},alive:state.alive,placementSeq:state.placementSeq};
  }
  function tetrisGhost3DStateFingerprint(state){
    const projection=tetrisGhost3DStateProjection(state);
    return projection?JSON.stringify(projection):'';
  }
  function tetrisGhost3DReadLock(event,placementSeq){
    if(!plainRecord(event)||event.type!=='lock'||!validKind(event.piece)||!safeInt(event.rotation,0,3)||!validCoord(event.x,-3,9)||!validCoord(event.y,-4,17)||!safeInt(event.cleared,0,4)||!safeInt(placementSeq,0,Number.MAX_SAFE_INTEGER))return null;
    return{type:'lock',kind:event.piece,rotation:event.rotation,x:event.x,y:event.y,cleared:event.cleared,placementSeq};
  }
  function tetrisGhost3DStaticGeneration(source,clearAccepted){
    tetrisGhost3DResetEpoch++;tetrisGhost3DSource=opts.online?tetrisGhost3DSourceName(source):'local';tetrisGhost3DLocalLock=null;
    if(clearAccepted)tetrisGhost3DAcceptedV3=null;
  }
  function tetrisGhost3DLegacyDomOnly(source){
    if(!opts.online)return;
    tetrisGhost3DStaticGeneration(source||'reconcile',true);
    if(tetrisGhost3DPresenter&&!tetrisGhost3DCommitActive)commitTetrisGhost3DPresenter();
  }
  function tetrisGhost3DRememberAcceptedV3(value,parsed,source){
    const normalized=tetrisGhost3DSourceName(source||'live');
    const nextPlayers=parsed.map(meta=>({
      hash:meta.hash,
      fingerprint:tetrisGhost3DStateFingerprint({well:meta.state.board,active:meta.state.active,alive:meta.alive&&!meta.state.terminal,placementSeq:meta.state.pieces}),
      lock:tetrisGhost3DReadLock(meta.state.lastEvent,meta.state.pieces),
      lastEvent:plainRecord(meta.state.lastEvent)?{...meta.state.lastEvent}:null,
    }));
    const previous=tetrisGhost3DAcceptedV3;
    if(previous&&previous.matchId===value.matchId&&previous.revision===value.revision){
      const changed=nextPlayers.some((entry,index)=>!previous.players[index]||previous.players[index].hash!==entry.hash);
      if(changed){tetrisGhost3DSource='reconcile';return false;}
      tetrisGhost3DSource=normalized;
      return true;
    }
    const fresh=!previous||previous.matchId!==value.matchId||normalized!=='live';
    if(fresh){tetrisGhost3DResetEpoch++;tetrisGhost3DLocalLock=null;}
    tetrisGhost3DAcceptedV3={matchId:value.matchId,revision:value.revision,source:normalized,players:nextPlayers};
    tetrisGhost3DSource=normalized;
    return true;
  }
  function tetrisGhost3DReadModel(){
    const mount=renderTree&&renderTree.mainWell&&renderTree.mainWell.root;
    const state=states[observedPlayer]||null;
    const expected=expectedMatchId();
    const projection=tetrisGhost3DStateProjection(state);
    const accepted=tetrisGhost3DAcceptedV3;
    const acceptedPlayer=accepted&&accepted.players&&accepted.players[observedPlayer];
    const onlineTrusted=!!(opts.online&&fullRuleAuthority&&accepted&&acceptedPlayer&&accepted.matchId===expected&&projection&&acceptedPlayer.fingerprint===tetrisGhost3DStateFingerprint(state));
    const localTrusted=!opts.online&&!!projection;
    const lock=onlineTrusted?acceptedPlayer.lock:(localTrusted&&tetrisGhost3DLocalLock&&tetrisGhost3DLocalLock.player===observedPlayer&&tetrisGhost3DLocalLock.placementSeq===projection.placementSeq?{type:'lock',kind:tetrisGhost3DLocalLock.kind,rotation:tetrisGhost3DLocalLock.rotation,x:tetrisGhost3DLocalLock.x,y:tetrisGhost3DLocalLock.y,cleared:tetrisGhost3DLocalLock.cleared,placementSeq:tetrisGhost3DLocalLock.placementSeq}:null);
    const modelState=(onlineTrusted||localTrusted)?{...projection,lastEvent:onlineTrusted?acceptedPlayer.lastEvent:null}:null;
    return{
      mount,mountElement:mount,waveBActive:!!(renderTree&&renderTree.waveB),online:!!opts.online,fullRuleAuthority:!!fullRuleAuthority,
      protocol:onlineTrusted?RULE_PROTOCOL:null,source:tetrisGhost3DSourceName(tetrisGhost3DSource),
      matchId:onlineTrusted?accepted.matchId:null,expectedMatchId:expected,authorityRevision:onlineTrusted?accepted.revision:null,stateHash:onlineTrusted?acceptedPlayer.hash:null,
      committed:localTrusted,accepted:onlineTrusted,acceptedV3:onlineTrusted,optimistic:!!(opts.online&&!onlineTrusted),resetEpoch:tetrisGhost3DResetEpoch,sourceEpoch:tetrisGhost3DResetEpoch,viewPlayer:observedPlayer,observedPlayer,playerCount,
      state:modelState,terminal:!!over,winner:safeInt(winner,-1,playerCount-1)?winner:-1,
      trustedLock:lock,lock,quality:tetrisGhost3DInitialQuality(),reducedMotion:tetrisWaveCReducedMotion(),
      hidden:!!(typeof document!=='undefined'&&document&&document.hidden),shellActive:tetrisGhost3DShellActive(),
    };
  }
  function tetrisGhost3DShellActive(){
    // An online game can continue while its Game Shell is hidden in the Hub.
    // The renderer must follow the real shell, rather than a timer's render
    // cadence; without this guard a retained instance could resume WebGL
    // between shell-change events.
    try{
      const stage=typeof document!=='undefined'&&document&&typeof document.getElementById==='function'?document.getElementById('screen-game'):null;
      if(!stage||!stage.dataset||stage.dataset.shellActive!=='true'||stage.dataset.shellGame!=='tetris')return false;
      return !(stage.classList&&typeof stage.classList.contains==='function'&&stage.classList.contains('hidden'));
    }catch(_error){return false;}
  }
  function disposeTetrisGhost3DPresenter(){
    const presenter=tetrisGhost3DPresenter;tetrisGhost3DPresenter=null;
    if(presenter&&typeof presenter.dispose==='function'){try{presenter.dispose();}catch(_error){}}
  }
  function commitTetrisGhost3DPresenter(){
    if(tetrisGhost3DCommitActive)return false;
    if(!tetrisGhost3DEnabled()){disposeTetrisGhost3DPresenter();return false;}
    if(!tetrisGhost3DPresenter){
      const factory=typeof TetrisGhost3DPresenter!=='undefined'?TetrisGhost3DPresenter:null;
      if(!factory||typeof factory.create!=='function')return false;
      try{tetrisGhost3DPresenter=factory.create(tetrisGhost3DReadModel);}catch(_error){tetrisGhost3DPresenter=null;return false;}
    }
    if(!tetrisGhost3DPresenter||typeof tetrisGhost3DPresenter.commit!=='function')return false;
    tetrisGhost3DCommitActive=true;
    try{tetrisGhost3DPresenter.commit();return true;}catch(_error){disposeTetrisGhost3DPresenter();return false;}finally{tetrisGhost3DCommitActive=false;}
  }
  function tetrisMainWellWidth(availableWidth,availableHeight){
    const width=Math.max(0,Number(availableWidth)||0),height=Math.max(0,Number(availableHeight)||0);
    let viewportLandscape=false;
    try{viewportLandscape=typeof window!=='undefined'&&Number(window.innerWidth)>Number(window.innerHeight);}catch(_error){}
    const compactLandscape=viewportLandscape&&width>=480&&height>0&&height<450;
    const widthBudget=compactLandscape?Math.max(72,width*.47):Math.max(112,width*(width<720?.72:.62));
    // Score, previews, process rail, and the retained controls keep their own
    // DOM space.  The canvas may cover only the resulting main-well content.
    const reserve=compactLandscape?66:(width<480?170:(width<720?148:118));
    // Portrait/narrow Game Stage scrolls previews/opponents below the well;
    // only a small frame reserve is needed to keep the complete 18x10 well
    // visible. Compact landscape and wider layouts retain their own budgets.
    const portraitScrollable=width<720&&!compactLandscape;
    const heightBudget=portraitScrollable?(height>0?Math.max(112,(height-20)*COLS/ROWS):360):(height>0?Math.max(72,(height-reserve)*COLS/ROWS):360);
    return Math.min(360,widthBudget,heightBudget);
  }
  function scheduleTetrisPresentationResize(){
    if(destroyed||tetrisPresentationResizeQueued)return;
    tetrisPresentationResizeQueued=true;
    const run=()=>{tetrisPresentationResizeQueued=false;tetrisPresentationResizeFrame=0;if(!destroyed)render();};
    if(typeof requestAnimationFrame==='function')tetrisPresentationResizeFrame=requestAnimationFrame(run);
    else Promise.resolve().then(run);
  }
  function installTetrisPresentationResize(){
    const root=typeof window!=='undefined'?window:null;
    if(root&&typeof root.addEventListener==='function'){
      root.addEventListener('resize',scheduleTetrisPresentationResize);
      root.addEventListener('orientationchange',scheduleTetrisPresentationResize);
    }
    if(typeof ResizeObserver==='function'){
      try{tetrisPresentationResizeObserver=new ResizeObserver(scheduleTetrisPresentationResize);tetrisPresentationResizeObserver.observe(area);}catch(_error){tetrisPresentationResizeObserver=null;}
    }
  }
  function releaseTetrisPresentationResize(){
    const root=typeof window!=='undefined'?window:null;
    if(root&&typeof root.removeEventListener==='function'){
      root.removeEventListener('resize',scheduleTetrisPresentationResize);
      root.removeEventListener('orientationchange',scheduleTetrisPresentationResize);
    }
    if(tetrisPresentationResizeFrame&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(tetrisPresentationResizeFrame);
    tetrisPresentationResizeFrame=0;tetrisPresentationResizeQueued=false;
    if(tetrisPresentationResizeObserver&&typeof tetrisPresentationResizeObserver.disconnect==='function')tetrisPresentationResizeObserver.disconnect();
    tetrisPresentationResizeObserver=null;
  }
  function setWaveBRoot(enabled){
    if(area&&area.classList)area.classList.toggle('tetris-wave-b',enabled);
    if(enabled){
      if(area&&typeof area.setAttribute==='function')area.setAttribute('data-tetris-stage','wave-b');
      else if(area&&area.dataset)area.dataset.tetrisStage='wave-b';
    }else{
      if(area&&typeof area.removeAttribute==='function')area.removeAttribute('data-tetris-stage');
      else if(area&&area.dataset)delete area.dataset.tetrisStage;
    }
    syncTetrisWaveCStage(enabled);
  }
  function setWaveBData(node,name,value){
    if(!node)return;
    const attribute='data-'+name;
    if(value===null||value===undefined){
      if(typeof node.removeAttribute==='function')node.removeAttribute(attribute);
      else if(node.dataset)delete node.dataset[name.replace(/-([a-z])/g,(_match,letter)=>letter.toUpperCase())];
      return;
    }
    if(typeof node.setAttribute==='function')node.setAttribute(attribute,String(value));
    else if(node.dataset)node.dataset[name.replace(/-([a-z])/g,(_match,letter)=>letter.toUpperCase())]=String(value);
  }

  // Wave C remains strictly disposable presentation.  The process rail is
  // intentionally kept in this closure instead of any Rule/Core snapshot so
  // simultaneous instances, reconnects, Replay, and authority payloads cannot
  // observe or restore an animation state.
  const TETRIS_WAVE_C_PROCESS_STEPS=Object.freeze(['spawn','fall','move','rotate','lock','line-clear','combo','b2b','t-spin','perfect-clear','garbage','terminal']);
  let tetrisWaveCProcess='spawn',tetrisWaveCProcessDetail=null,tetrisWaveCProcessEpoch=0,tetrisWaveCProcessRevision=0,tetrisWaveCProcessRun=0;
  const tetrisWaveCProcessTimers=new Set(),tetrisWaveCObserved=new Map();
  let tetrisWaveCProcessRail=null,tetrisWaveCProcessLabel=null,tetrisWaveCProcessSteps=[];

  function tetrisWaveCEnabled(){return waveBEnabled();}
  function tetrisWaveCReducedMotion(){
    try{
      if(typeof prefersReducedMotion==='function')return !!prefersReducedMotion();
      return !!(typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }catch(_error){return false;}
  }
  function tetrisWaveCVisiblePlayer(){return states[observedPlayer]?observedPlayer:(states[controlled]?controlled:0);}
  function tetrisWaveCStableProcess(){
    if(over)return'terminal';
    const state=states[tetrisWaveCVisiblePlayer()];
    return state&&state.alive&&state.active?'fall':'spawn';
  }
  function tetrisWaveCStepText(step,detail){
    const value=detail||{};
    if(step==='spawn')return t('tetris_event_spawn');
    if(step==='fall')return t('tetris_soft_drop');
    if(step==='move')return t(value.dx<0?'tetris_move_left':'tetris_move_right');
    if(step==='rotate')return t(value.direction<0?'tetris_rotate_left':'tetris_rotate_right');
    if(step==='lock')return t('tetris_event_lock');
    if(step==='line-clear')return t('tetris_event_clear',Math.max(0,Number(value.lines)||0));
    if(step==='combo')return t('tetris_event_combo',Math.max(1,(Number(value.combo)||0)+1));
    if(step==='b2b')return t('tetris_event_b2b');
    if(step==='t-spin'){
      const key={
        't-spin-zero':'tetris_event_tspin_zero','t-spin-single':'tetris_event_tspin_single',
        't-spin-double':'tetris_event_tspin_double','t-spin-triple':'tetris_event_tspin_triple',
      }[value.clearType]||'tetris_event_tspin_zero';
      return t(key);
    }
    if(step==='perfect-clear')return t('tetris_event_perfect_clear');
    if(step==='garbage')return value.incoming?t('tetris_event_incoming',Math.max(0,Number(value.lines)||0)):t('tetris_event_garbage',Math.max(0,Number(value.lines)||0));
    if(step==='terminal')return winner>=0?t('tetris_last_survivor',winner+1):t('tetris_status_ko');
    return t('tetris_event_ready');
  }
  function tetrisWaveCProcessText(){
    const state=states[tetrisWaveCVisiblePlayer()];
    if(!over&&state&&!state.alive)return t('tetris_status_ko');
    return tetrisWaveCStepText(tetrisWaveCProcess,tetrisWaveCProcessDetail);
  }
  function tetrisWaveCDetailValue(detail){
    if(!detail||typeof detail!=='object')return null;
    if(Number.isFinite(detail.lines))return String(Math.max(0,Math.floor(detail.lines)));
    if(Number.isFinite(detail.combo))return String(Math.max(0,Math.floor(detail.combo)));
    return null;
  }
  function clearTetrisWaveCProcessTimers(){
    tetrisWaveCProcessTimers.forEach(timer=>clearTimeout(timer));
    tetrisWaveCProcessTimers.clear();
  }
  function invalidateTetrisWaveCProcess(forgetObserved){
    tetrisWaveCProcessEpoch++;tetrisWaveCProcessRun++;clearTetrisWaveCProcessTimers();
    if(forgetObserved)tetrisWaveCObserved.clear();
  }
  function scheduleTetrisWaveCProcess(callback,delay,run){
    const epoch=tetrisWaveCProcessEpoch;
    const timer=setTimeout(()=>{
      tetrisWaveCProcessTimers.delete(timer);
      if(!destroyed&&epoch===tetrisWaveCProcessEpoch&&run===tetrisWaveCProcessRun)callback();
    },Math.max(0,Number(delay)||0));
    if(timer&&typeof timer.unref==='function')timer.unref();
    tetrisWaveCProcessTimers.add(timer);return timer;
  }
  function paintTetrisWaveCProcess(){
    const enabled=tetrisWaveCEnabled();
    if(area&&area.classList)area.classList.toggle('tetris-wave-c',enabled);
    setWaveBData(area,'tetris-process',enabled?tetrisWaveCProcess:null);
    setWaveBData(area,'tetris-process-revision',enabled?tetrisWaveCProcessRevision:null);
    const tree=renderTree;
    if(tree){
      setWaveBData(tree.layout,'tetris-process',enabled?tetrisWaveCProcess:null);
      setWaveBData(tree.mainWell&&tree.mainWell.root,'tetris-process',enabled?tetrisWaveCProcess:null);
    }
    if(!enabled||!tetrisWaveCProcessRail)return;
    const label=tetrisWaveCProcessText();
    setWaveBData(tetrisWaveCProcessRail,'tetris-process',tetrisWaveCProcess);
    setWaveBData(tetrisWaveCProcessRail,'tetris-process-detail',tetrisWaveCDetailValue(tetrisWaveCProcessDetail));
    if(tetrisWaveCProcessLabel&&tetrisWaveCProcessLabel.textContent!==label)tetrisWaveCProcessLabel.textContent=label;
    tetrisWaveCProcessSteps.forEach(step=>{
      const active=step&&step.dataset&&step.dataset.tetrisProcessStep===tetrisWaveCProcess;
      setWaveBData(step,'tetris-process-active',active?'true':'false');
      setWaveBData(step,'tetris-process-index',TETRIS_WAVE_C_PROCESS_STEPS.indexOf(step.dataset.tetrisProcessStep));
    });
  }
  function syncTetrisWaveCStage(enabled){
    if(!enabled){
      invalidateTetrisWaveCProcess(false);
      if(area&&area.classList)area.classList.remove('tetris-wave-c');
      setWaveBData(area,'tetris-process',null);setWaveBData(area,'tetris-process-revision',null);
      tetrisWaveCProcessRail=null;tetrisWaveCProcessLabel=null;tetrisWaveCProcessSteps=[];
      return;
    }
    paintTetrisWaveCProcess();
  }
  function setTetrisWaveCProcess(next,detail){
    let phase=TETRIS_WAVE_C_PROCESS_STEPS.includes(next)?next:'spawn';
    if(over&&phase!=='terminal')phase='terminal';
    tetrisWaveCProcess=phase;tetrisWaveCProcessDetail=detail&&typeof detail==='object'?{...detail}:null;tetrisWaveCProcessRevision++;
    paintTetrisWaveCProcess();
  }
  function beginTetrisWaveCSequence(entries,stable){
    const phases=(Array.isArray(entries)?entries:[]).filter(item=>item&&TETRIS_WAVE_C_PROCESS_STEPS.includes(item.phase));
    const target=TETRIS_WAVE_C_PROCESS_STEPS.includes(stable)?stable:tetrisWaveCStableProcess();
    clearTetrisWaveCProcessTimers();const run=++tetrisWaveCProcessRun;
    if(over){setTetrisWaveCProcess('terminal');return;}
    if(!tetrisWaveCEnabled()){setTetrisWaveCProcess(target);return;}
    if(tetrisWaveCReducedMotion()){setTetrisWaveCProcess(target);return;}
    if(!phases.length){setTetrisWaveCProcess(target);return;}
    const show=(index)=>{
      const current=phases[index];setTetrisWaveCProcess(current.phase,current.detail);
      scheduleTetrisWaveCProcess(()=>{
        if(index+1<phases.length)show(index+1);else setTetrisWaveCProcess(target);
      },current.phase==='lock'?130:170,run);
    };
    show(0);
  }
  function tetrisWaveCRecord(state){
    return{
      active:state&&state.active?state.active.kind+':'+state.active.rotation+':'+state.active.x+':'+state.active.y:'',
      placementSeq:state?state.placementSeq:0,lines:state?state.lines:0,combo:state?state.combo:-1,backToBackCount:state?state.backToBackCount:0,
      tSpins:state?state.tSpins:0,perfectClears:state?state.perfectClears:0,garbageSent:state?state.garbageSent:0,garbageReceived:state?state.garbageReceived:0,
      incoming:state?state.incoming.map(item=>item.id+':'+item.lines).join('|'):'',alive:!!(state&&state.alive),lastEvent:state?state.lastEvent:'',
    };
  }
  function rememberTetrisWaveCStates(){states.forEach(state=>tetrisWaveCObserved.set(state.id,tetrisWaveCRecord(state)));}
  function scoringFromTetrisWaveCState(state,previous){
    const token=/^SCORING:([a-z-]+):(-?\d+):([01]):([01])$/.exec(String(state&&state.lastEvent||''));
    const clearType=token?token[1]:(state&&state.tSpins>(previous&&previous.tSpins||0)?'t-spin-zero':'none');
    return{
      clearType,combo:token?Number(token[2]):state&&state.combo,backToBackBonus:token?token[3]==='1':!!(state&&state.backToBackCount>(previous&&previous.backToBackCount||0)),
      perfectClear:token?token[4]==='1':!!(state&&state.perfectClears>(previous&&previous.perfectClears||0)),tSpin:/^t-spin-/.test(clearType),
    };
  }
  function presentTetrisWaveCLock(pi,scoring,cleared){
    const state=states[pi],previous=tetrisWaveCObserved.get(pi);
    if(!state){return;}
    if(pi!==tetrisWaveCVisiblePlayer()){rememberTetrisWaveCStates();return;}
    const details=scoring||scoringFromTetrisWaveCState(state,previous),lines=Math.max(0,Number(cleared)||0),phases=[{phase:'lock',detail:details}];
    if(lines>0)phases.push({phase:'line-clear',detail:{lines}});
    if(details.tSpin||/^t-spin-/.test(details.clearType||''))phases.push({phase:'t-spin',detail:details});
    if(details.backToBackBonus)phases.push({phase:'b2b',detail:details});
    if(Number(details.combo)>=1)phases.push({phase:'combo',detail:details});
    if(details.perfectClear)phases.push({phase:'perfect-clear',detail:details});
    rememberTetrisWaveCStates();beginTetrisWaveCSequence(phases,tetrisWaveCStableProcess());
  }
  function presentTetrisWaveCSpawn(pi){
    if(pi!==tetrisWaveCVisiblePlayer()){rememberTetrisWaveCStates();return;}
    rememberTetrisWaveCStates();beginTetrisWaveCSequence([{phase:'spawn'}],tetrisWaveCStableProcess());
  }
  function presentTetrisWaveCMotion(pi,phase,detail){
    if(pi!==tetrisWaveCVisiblePlayer()){rememberTetrisWaveCStates();return;}
    rememberTetrisWaveCStates();beginTetrisWaveCSequence([{phase,detail:detail||{}}],tetrisWaveCStableProcess());
  }
  function presentTetrisWaveCFall(pi){
    if(pi!==tetrisWaveCVisiblePlayer()){rememberTetrisWaveCStates();return;}
    // A freshly spawned piece may begin falling while the preceding lock's
    // score chain is still being read.  Gravity must remain playable, but it
    // must not erase T-Spin/B2B/combo/perfect-clear feedback mid-sequence.
    if(tetrisWaveCProcessTimers.size&&['lock','line-clear','combo','b2b','t-spin','perfect-clear','garbage'].includes(tetrisWaveCProcess)){rememberTetrisWaveCStates();return;}
    clearTetrisWaveCProcessTimers();tetrisWaveCProcessRun++;rememberTetrisWaveCStates();setTetrisWaveCProcess(tetrisWaveCStableProcess());
  }
  function tetrisWaveCScoreChainActive(){return tetrisWaveCProcessTimers.size>0&&['lock','line-clear','combo','b2b','t-spin','perfect-clear'].includes(tetrisWaveCProcess);}
  function presentTetrisWaveCGarbage(pi,detail){
    if(pi!==tetrisWaveCVisiblePlayer()){rememberTetrisWaveCStates();return;}
    rememberTetrisWaveCStates();beginTetrisWaveCSequence([{phase:'garbage',detail:detail||{}}],tetrisWaveCStableProcess());
  }
  function observeTetrisWaveCStates(direct){
    if(over){rememberTetrisWaveCStates();setTetrisWaveCProcess('terminal');return;}
    const pi=tetrisWaveCVisiblePlayer(),state=states[pi],previous=tetrisWaveCObserved.get(pi);
    if(!state){setTetrisWaveCProcess('spawn');return;}
    if(direct){rememberTetrisWaveCStates();setTetrisWaveCProcess(tetrisWaveCStableProcess());return;}
    if(!previous){presentTetrisWaveCSpawn(pi);return;}
    const current=tetrisWaveCRecord(state),lineDelta=Math.max(0,state.lines-previous.lines),placementDelta=state.placementSeq>previous.placementSeq;
    if(!state.alive&&previous.alive){clearTetrisWaveCProcessTimers();tetrisWaveCProcessRun++;rememberTetrisWaveCStates();setTetrisWaveCProcess(tetrisWaveCStableProcess());return;}
    if(placementDelta){presentTetrisWaveCLock(pi,scoringFromTetrisWaveCState(state,previous),lineDelta);return;}
    if(current.garbageReceived>previous.garbageReceived||current.incoming!==previous.incoming){presentTetrisWaveCGarbage(pi,{lines:Math.max(0,current.garbageReceived-previous.garbageReceived)||incomingTotal(state),incoming:current.garbageReceived<=previous.garbageReceived});return;}
    if(tetrisWaveCScoreChainActive()){rememberTetrisWaveCStates();return;}
    if(current.active!==previous.active){
      if(!previous.active&&current.active){presentTetrisWaveCSpawn(pi);return;}
      const before=String(previous.active).split(':').map(Number),after=String(current.active).split(':').map(Number);
      if(before[1]!==after[1]){presentTetrisWaveCMotion(pi,'rotate',{direction:after[1]-before[1]});return;}
      if(before[2]!==after[2]){presentTetrisWaveCMotion(pi,'move',{dx:after[2]-before[2]});return;}
      if(before[3]!==after[3]){presentTetrisWaveCFall(pi);return;}
    }
    rememberTetrisWaveCStates();setTetrisWaveCProcess(tetrisWaveCStableProcess());
  }
  function enterTetrisWaveCTerminal(){invalidateTetrisWaveCProcess(false);rememberTetrisWaveCStates();setTetrisWaveCProcess('terminal');}
  function createTetrisWaveCProcessRail(){
    const rail=el('section','tetris-wave-c-process'),label=el('output','tetris-wave-c-process-label'),track=el('div','tetris-wave-c-process-track');
    rail.setAttribute('role','status');rail.setAttribute('aria-live','polite');track.setAttribute('aria-hidden','true');
    tetrisWaveCProcessSteps=TETRIS_WAVE_C_PROCESS_STEPS.map(step=>{
      const node=el('span','tetris-wave-c-process-step');setWaveBData(node,'tetris-process-step',step);node.setAttribute('aria-hidden','true');track.appendChild(node);return node;
    });
    rail.appendChild(label);rail.appendChild(track);tetrisWaveCProcessRail=rail;tetrisWaveCProcessLabel=label;paintTetrisWaveCProcess();return rail;
  }

  const PRESENTATION_KEYS = new Set(['well','active','queue','bagIndex','hold','canHold','score','lines','tetrisCount','placementSeq']);
  const TETRIS_STATE_KEYS = new Set(['matchId','player','seq','state','updatedAt']);
  const ACTIVE_KEYS = new Set(['kind','rotation','x','y']);
  const RELAY_ACTIVE_KEYS = new Set(['act','matchId','seq','piece','x','y','rot','hold','canHold','queue','bagIndex']);
  const ATTACK_ID_RE = /^[A-Za-z0-9:_-]{3,100}$/;
  function plainRecord(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  function onlyKeys(value,allowed){return plainRecord(value)&&Object.keys(value).every(key=>allowed.has(key));}
  function safeInt(value,min,max){return Number.isSafeInteger(value)&&value>=min&&value<=max;}
  function validKind(value){return safeInt(value,0,6);}
  function validCoord(value,min,max){return safeInt(value,min,max);}
  function validActive(value){
    if(value===null)return true;
    return onlyKeys(value,ACTIVE_KEYS)&&validKind(value.kind)&&safeInt(value.rotation,0,3)&&validCoord(value.x,-3,9)&&validCoord(value.y,-4,17);
  }
  function validQueue(value){return Array.isArray(value)&&value.length>=4&&value.length<=14&&value.every(validKind);}
  function validHold(value){return value===null||validKind(value);}
  function validWell(value){return Array.isArray(value)&&value.length===ROWS&&value.every(row=>Array.isArray(row)&&row.length===COLS&&row.every(cell=>cell===0||cell===1));}
  function resolveMatchId(){
    if(typeof opts.getMatchId==='function'){const current=opts.getMatchId();if(typeof current==='string'&&current)return current;}
    if(typeof opts.matchId==='string'&&opts.matchId)return opts.matchId;
    if(typeof online!=='undefined'&&online&&typeof online.matchId==='string'&&online.matchId)return online.matchId;
    return '';
  }
  function expectedMatchId(){return resolveMatchId()||resolveMatchSeed();}
  function validMatchId(value){return typeof value==='string'&&value.length>0&&value===expectedMatchId();}

  function removeRenderNode(node){if(node&&typeof node.remove==='function')node.remove();}
  function clearTetrisOutcomeTimer(){
    if(tetrisOutcomeTimer!==null)clearTimeout(tetrisOutcomeTimer);
    tetrisOutcomeTimer=null;tetrisOutcomeScheduled=false;tetrisOutcomeEpoch++;
  }
  function removeVictoryOverlay(){clearTetrisOutcomeTimer();const overlay=area.querySelector&&area.querySelector('.victory-overlay');if(overlay)removeRenderNode(overlay);victoryShown=false;}
  function revealTetrisOutcome(){
    tetrisOutcomeTimer=null;tetrisOutcomeScheduled=false;
    if(destroyed||opts.destroyed||!over||victoryShown||!states[winner])return false;
    victoryShown=true;
    const terminalOnly = spectator || (!opts.online && !(opts.ai && typeof opts.ai.has === 'function' && opts.ai.size > 0));
    showVictoryOverlay(area,{winner,winnerName:t('player_number',winner+1),emoji:'🏆',subtitle:t('tetris_victory_subtitle',states[winner].score),coins:1,
      viewerSlot:terminalOnly ? null : (opts.online ? controlled : 0),
      audioType:terminalOnly ? 'match_terminal' : undefined,
      audioId:'tetris-outcome-'+String(authorityRevision||relayRevision||tetrisAudioSequence)+'-'+winner,
      onRestart:reset,onShare:()=>shareGameLink('tetris')});
    return true;
  }
  function queueTetrisOutcome(){
    if(!over||victoryShown||tetrisOutcomeScheduled)return false;
    let presenterState=null;
    try{presenterState=tetrisGhost3DPresenter&&typeof tetrisGhost3DPresenter.snapshot==='function'?tetrisGhost3DPresenter.snapshot():null;}catch(_error){presenterState=null;}
    const quality=tetrisGhost3DInitialQuality();
    const rendererReady=!!(presenterState&&presenterState.enabled===true&&presenterState.ready===true&&presenterState.fallback===false);
    const delay=rendererReady&&!tetrisWaveCReducedMotion()&&quality!=='LOW'?(quality==='HIGH'?520:420):0;
    // Rule completion and opts.onEnd have already happened in commitFinal().
    // Only the blocking DOM result surface waits for the finite camera beat.
    if(delay<=0)return revealTetrisOutcome();
    tetrisOutcomeScheduled=true;
    const outcomeEpoch=++tetrisOutcomeEpoch;
    tetrisOutcomeTimer=setTimeout(()=>{
      tetrisOutcomeTimer=null;
      if(outcomeEpoch===tetrisOutcomeEpoch)revealTetrisOutcome();
    },delay);
    if(tetrisOutcomeTimer&&typeof tetrisOutcomeTimer.unref==='function')tetrisOutcomeTimer.unref();
    return true;
  }

  function emptyWell(){ return Array.from({length:ROWS}, () => Array(COLS).fill(0)); }
  function rotateCW(matrix){
    const rows=matrix.length, cols=matrix[0].length, out=Array.from({length:cols},()=>Array(rows).fill(0));
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) out[c][rows-1-r]=matrix[r][c];
    return out;
  }
  function rotateCCW(matrix){ return rotateCW(rotateCW(rotateCW(matrix))); }
  function shapeAt(kind, rotation){ let shape=SHAPES[kind]; for (let i=0;i<((rotation%4)+4)%4;i++) shape=rotateCW(shape); return shape; }
  function cloneWell(well){ return well.map(row=>row.slice()); }
  function collide(well, shape, x, y){
    for (let r=0;r<shape.length;r++) for (let c=0;c<shape[r].length;c++){
      if (!shape[r][c]) continue;
      const rr=y+r, cc=x+c;
      if (cc<0 || cc>=COLS || rr>=ROWS || (rr>=0 && well[rr][cc])) return true;
    }
    return false;
  }
  function lockInto(well, shape, x, y){
    const next=cloneWell(well);
    for (let r=0;r<shape.length;r++) for (let c=0;c<shape[r].length;c++) if (shape[r][c]){
      const rr=y+r, cc=x+c;
      if (rr<0 || cc<0 || cc>=COLS || rr>=ROWS) return {well:next,cleared:-1};
      next[rr][cc]=1;
    }
    let cleared=0;
    for (let r=ROWS-1;r>=0;r--) if (next[r].every(Boolean)){
      next.splice(r,1); next.unshift(Array(COLS).fill(0)); cleared++; r++;
    }
    return {well:next,cleared};
  }
  function boardHeight(well){
    for (let r=0;r<ROWS;r++) if (well[r].some(Boolean)) return ROWS-r;
    return 0;
  }
  function resolveMatchSeed(){
    if(opts.gameplayMeta&&opts.gameplayMeta.matchSeed)return String(opts.gameplayMeta.matchSeed);
    if (typeof opts.getMatchId === 'function'){
      const current=opts.getMatchId();if(current)return String(current);
    }
    if(opts.matchId)return String(opts.matchId);
    if(typeof online!=='undefined'&&online&&online.matchId)return String(online.matchId);
    return '';
  }
  function hashSeed(value){
    let hash=2166136261>>>0;
    for(let i=0;i<String(value).length;i++){hash^=String(value).charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}
    return hash||0x9e3779b9;
  }
  function seededRandom(value){
    let state=hashSeed(value);
    return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
  }
  function makeBag(player,bagIndex){
    const bag=[0,1,2,3,4,5,6];
    const random=opts.online&&bagSeed?seededRandom(bagSeed+'|p'+player+'|bag'+bagIndex):Math.random;
    for (let i=bag.length-1;i>0;i--){ const j=Math.floor(random()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
    return bag;
  }
  function appendBag(state){state.queue.push(...makeBag(state.id,state.bagIndex++));}
  function ensureQueue(state){while(state.queue.length<5)appendBag(state);}
  function nextKind(state){ ensureQueue(state); const kind=state.queue.shift(); ensureQueue(state); return kind; }
  function createState(id){
    const state={
      id,well:emptyWell(),active:null,queue:[],bagIndex:0,hold:null,canHold:true,score:0,lines:0,level:1,combo:-1,backToBack:false,backToBackCount:0,tSpins:0,tetrises:0,perfectClears:0,lastAction:null,scoringVersion:SCORING_VERSION,tetrisCount:0,placementSeq:0,
      garbageSent:0,garbageReceived:0,incoming:[],alive:true,koTime:null,koConfirmed:false,placement:0,fallMs:0,
      lastEvent:'READY',eventAt:Date.now(),
    };
    ensureQueue(state); return state;
  }
  function spawn(state, forcedKind, present){
    if (!state || !state.alive) return false;
    const kind=Number.isInteger(forcedKind)?forcedKind:nextKind(state), shape=shapeAt(kind,0);
    const active={kind,rotation:0,x:Math.floor((COLS-shape[0].length)/2),y:-Math.max(1,shape.length-1)};
    if (collide(state.well,shape,active.x,active.y)){ ko(state.id,'TOP OUT'); return false; }
    state.active=active; state.canHold=true; state.lastAction=null;
    if(present)presentTetrisWaveCSpawn(state.id);
    return true;
  }
  function resetLocal(){
    bagSeed=resolveMatchSeed();
    resetTetrisInputGate();
    invalidateTetrisWaveCProcess(true);
    tetrisGhost3DStaticGeneration(opts.online?'reconcile':'local',true);
    cancelAIWork();removeVictoryOverlay();lastPlayersSignature='';lastStatusText='';
    states=Array.from({length:playerCount},(_,i)=>createState(i)); wells=states.map(state=>state.well); scores=states.map(state=>state.score);
    over=false; winner=-1; cur=controlled; pieceCount=0; startedAt=authorityMode?Number(opts.gameplayMeta.startAt)||Date.now():Date.now(); finishedAt=0; remainingMs=MATCH_MS;
    countdownEndsAt=authorityMode?startedAt:startedAt+(opts.online?3000:0);matchEndAt=authorityMode?Number(opts.gameplayMeta.matchEndAt)||startedAt+MATCH_MS:startedAt+MATCH_MS;lastTickAt=Date.now(); seq=0;battleSeq=0;stateSeq=0;authorityRevision=0;ruleStateApplied=false;tetrisAudioSequence=0; pendingBattleScoring=new Map(); seenBattleAudioEvents=new Set(); lastSeq=Array(playerCount).fill(0); presentationSeq=Array(playerCount).fill(0); ruleSeq=Array(playerCount).fill(0); destroyed=false;
    garbageNonce=0;relayRevision=0;endReported=false;seenAttacks=new Set();
    states.forEach(state=>spawn(state)); observedPlayer=spectator?0:controlled;observeTetrisWaveCStates(false);render(); updateStatus();
    scheduleLiveAI(2500);
  }
  function sendRelay(payload){
    if(authorityMode){sendPresentation();return ++seq;}
    if(!opts.online||typeof opts.sendMove!=='function')return 0;
    const next=++seq;lastSeq[controlled]=Math.max(lastSeq[controlled]||0,next);
    opts.sendMove({...payload,matchId:resolveMatchId(),seq:next});return next;
  }
  function presentationState(){
    const state=states[controlled];return state?{well:state.well.map(row=>row.slice()),active:state.active?{...state.active}:null,queue:state.queue.slice(0,14),bagIndex:state.bagIndex,hold:state.hold,canHold:state.canHold,score:state.score,lines:state.lines,tetrisCount:state.tetrisCount,placementSeq:state.placementSeq}:null;
  }
  function sendPresentation(){if(!authorityMode||fullRuleAuthority||typeof opts.sendTetrisState!=='function')return false;const state=presentationState();if(!state)return false;opts.sendTetrisState({matchId:resolveMatchId(),seq:++stateSeq,state});return true;}
  function sendRuleAction(type){if(!fullRuleAuthority||typeof opts.sendTetrisAction!=='function')return false;opts.sendTetrisAction({matchId:resolveMatchId(),seq:++battleSeq,action:{type}});return true;}
  function syncArrays(){ wells=states.map(state=>state.well); scores=states.map(state=>state.score); }
  function canControl(){ return !destroyed && !spectator && !over && Date.now()>=countdownEndsAt && states[controlled] && states[controlled].alive && !(opts.isReplaying&&opts.isReplaying()); }
  function targetFor(from){
    for (let step=1;step<playerCount;step++){ const candidate=(from+step)%playerCount; if (states[candidate]&&states[candidate].alive) return candidate; }
    return -1;
  }
  function incomingTotal(state){ return state.incoming.reduce((sum,item)=>sum+item.lines,0); }
  function cancelIncoming(state, attack){
    let remaining=attack;
    for (let i=0;i<state.incoming.length && remaining>0;i++){
      const used=Math.min(remaining,state.incoming[i].lines); state.incoming[i].lines-=used; remaining-=used;
    }
    state.incoming=state.incoming.filter(item=>item.lines>0); return remaining;
  }
  function queueGarbage(target, lines, from, id){
    const state=states[target]; if (!state || !state.alive || lines<=0) return;
    const attackId=String(id||('g'+controlled+'-'+(++garbageNonce)));
    if(seenAttacks.has(attackId))return;seenAttacks.add(attackId);
    state.incoming.push({id:attackId,from,lines,applyAt:Date.now()+650});
    state.lastEvent='⚠ +'+incomingTotal(state); state.eventAt=Date.now();presentTetrisWaveCGarbage(target,{lines:incomingTotal(state),incoming:true}); render();
  }
  function applyGarbage(state,item){
    for (let line=0;line<item.lines;line++){
      if (state.well[0].some(Boolean)){ ko(state.id,'GARBAGE KO'); return; }
      const hole=Math.abs(String(item.id).split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0)+line)%COLS;
      state.well.shift(); state.well.push(Array.from({length:COLS},(_,c)=>c===hole?0:1)); state.garbageReceived++;
    }
    state.lastEvent='+'+item.lines+' GARBAGE'; state.eventAt=Date.now();presentTetrisWaveCGarbage(state.id,{lines:item.lines,incoming:false});
  }
  function resolveDueGarbage(state,now){
    const due=state.incoming.filter(item=>item.applyAt<=now), pending=state.incoming.filter(item=>item.applyAt>now);
    state.incoming=pending; due.forEach(item=>{ if (state.alive) applyGarbage(state,item); });
  }
  function attackFor(lines){ return [0,0,1,2,4][Math.max(0,Math.min(4,lines))]; }
  function scoringFor(state,details){
    if(typeof TetrisRules!=='undefined'&&TetrisRules&&typeof TetrisRules.resolveLockScore==='function')return TetrisRules.resolveLockScore(state,details);
    const cleared=Math.max(0,Math.min(4,Number(details&&details.cleared)||0)),combo=cleared>0?(Number.isInteger(state.combo)?state.combo:-1)+1:-1;
    return{clearType:['none','single','double','triple','tetris'][cleared],tSpin:false,level:Math.max(1,Math.floor(state.lines/10)+1),combo,backToBack:cleared===4,backToBackCount:cleared===4?(state.backToBackCount||0)+1:0,backToBackBonus:false,comboBonus:0,perfectClear:false,perfectClearBonus:0,scoreDelta:[0,100,300,500,800][cleared]||0,attack:attackFor(cleared),attackBreakdown:{base:attackFor(cleared),backToBack:0,combo:0,perfectClear:0}};
  }
  function scoringEventToken(scoring){return'SCORING:'+String(scoring.clearType||'none')+':'+String(scoring.combo)+':'+(scoring.backToBackBonus?'1':'0')+':'+(scoring.perfectClear?'1':'0');}
  function tetrisBattleAudioId(revision, attackId, suffix){
    const source=String(attackId||'');let hash=0;
    for(let i=0;i<source.length;i++)hash=(hash*31+source.charCodeAt(i))%1679616;
    return ('tetris-battle-'+Math.max(0,Number(revision)||0)+'-'+hash.toString(36)+'-'+String(suffix||'cue')).slice(0,48);
  }
  function applyPlacement(pi,data,deriveAttack,emit){
    const state=states[pi]; if (!state || !state.alive) return false;
    const kind=Number(data.piece),rotation=Number(data.rot||0),x=Number(data.x),y=Number(data.y);
    if (![kind,rotation,x,y].every(Number.isInteger)||kind<0||kind>=SHAPES.length||rotation<0||rotation>3) return false;
    const incomingPlacementSeq=Number(data.placementSeq);
    if(opts.online&&data.act==='lock'){
      if(state.active&&state.active.kind!==kind)return false;
      if(Number.isInteger(incomingPlacementSeq)&&(incomingPlacementSeq<=state.placementSeq||incomingPlacementSeq!==state.placementSeq+1))return false;
    }
    const shape=shapeAt(kind,rotation);
    if (collide(state.well,shape,x,y)||!collide(state.well,shape,x,y+1)) return false;
    const tSpin=typeof TetrisRules!=='undefined'&&TetrisRules&&typeof TetrisRules.detectTSpin==='function'?TetrisRules.detectTSpin(state.well,{kind,rotation,x,y},state.lastAction):false;
    const result=lockInto(state.well,shape,x,y);
    if (result.cleared<0){ ko(pi,'TOP OUT'); return false; }
    const perfectClear=result.cleared>0&&result.well.every(row=>row.every(cell=>cell===0)),scoring=scoringFor(state,{cleared:result.cleared,tSpin,perfectClear});
    state.well=result.well; state.active=null; state.lines+=result.cleared;state.level=Math.floor(state.lines/10)+1;
    state.placementSeq=Number.isInteger(incomingPlacementSeq)?incomingPlacementSeq:state.placementSeq+1;
    state.score+=scoring.scoreDelta;state.combo=scoring.combo;state.backToBack=scoring.backToBack;state.backToBackCount=scoring.backToBackCount;if(tSpin)state.tSpins++;if(result.cleared===4){state.tetrisCount++;state.tetrises++;}if(perfectClear)state.perfectClears++;state.lastAction=null;
    state.lastEvent=scoringEventToken(scoring); state.eventAt=Date.now();
    if(!opts.online){
      tetrisGhost3DSource='local';
      tetrisGhost3DLocalLock={player:pi,kind,rotation,x,y,cleared:result.cleared,placementSeq:state.placementSeq};
    }
    pieceCount++;
    let sent=0,target=-1,cancelled=0,attackId='a'+pi+'-'+state.placementSeq+'-'+String(resolveMatchSeed()).slice(-12);
    if (deriveAttack){
      const raw=(fullRuleAuthority||!opts.online)?scoring.attack:attackFor(result.cleared), before=raw;
      if(authorityMode){sent=raw;}
      else{sent=cancelIncoming(state,raw);cancelled=before-sent;if(sent>0){target=targetFor(pi);if(target>=0){state.garbageSent+=sent;queueGarbage(target,sent,pi,attackId);}}}
    } else if (Number.isInteger(Number(data.garbage))&&Number(data.garbage)>0&&Number(data.garbage)<=4&&Number.isInteger(data.target)&&data.target>=0&&data.target<states.length){
      sent=Number(data.garbage);target=Number(data.target);attackId=String(data.attackId||attackId);state.garbageSent+=sent;queueGarbage(target,sent,pi,attackId);
    }
    if (emit && opts.online){
      if(authorityMode&&!fullRuleAuthority){
        pendingBattleScoring.set(attackId,{player:pi,cleared:result.cleared,placementSeq:state.placementSeq});
        while(pendingBattleScoring.size>128){const first=pendingBattleScoring.keys().next().value;pendingBattleScoring.delete(first);}
      }
      if(authorityMode&&!fullRuleAuthority){opts.sendTetrisLockClaim({seq:++battleSeq,placementSeq:state.placementSeq,attackId,linesCleared:result.cleared,attack:attackFor(result.cleared),score:state.score,lines:state.lines,boardHeight:boardHeight(state.well),piece:kind,x,y,rot:rotation});sendPresentation();}
      else sendRelay({act:'lock',piece:kind,x,y,rot:rotation,placementSeq:state.placementSeq,garbage:sent,target,attackId});
    }
    if (emit&&opts.onProgress) opts.onProgress({act:'lock',piece:kind,x,y,rot:rotation,lines:result.cleared,garbageSent:sent,garbageCancelled:cancelled});
    if(!fullRuleAuthority){
      if(!authorityMode){
        const cueBase='tetris-local-' + pi + '-' + state.placementSeq;
        audioCue('tetris_lock', { actionId:cueBase + '-lock', reaction:'place' }, .8);
        if(result.cleared>0)audioCue('tetris_line_clear', { actionId:cueBase + '-clear', reaction:'score' }, Math.min(1,.55+result.cleared*.1));
      }
    }
    syncArrays(); spawn(state); presentTetrisWaveCLock(pi,scoring,result.cleared); render(); return true;
  }
  function lockActive(pi,emit){
    const state=states[pi]; if (!state||!state.active) return false;
    const active={...state.active}; return applyPlacement(pi,{piece:active.kind,x:active.x,y:active.y,rot:active.rotation},true,emit);
  }
  function moveActive(dx){
    if (!canControl()) return false; const state=states[controlled],active=state.active|| (spawn(state,undefined,true)&&state.active);
    if (!active) return false; const shape=shapeAt(active.kind,active.rotation);
    if (!collide(state.well,shape,active.x+dx,active.y)){ active.x+=dx;state.lastAction='move';presentTetrisWaveCMotion(controlled,'move',{dx}); if(fullRuleAuthority)sendRuleAction(dx<0?'left':'right');else{emitActive();audioCue('tetris_move',{actionId:'tetris-local-'+(++tetrisAudioSequence)+'-move',reaction:'move'},.35);} render(); return true; } return false;
  }
  function rotateActive(direction){
    if (!canControl()) return false; const state=states[controlled],active=state.active|| (spawn(state,undefined,true)&&state.active);
    if (!active) return false; const next=(active.rotation+(direction>0?1:3))%4,shape=shapeAt(active.kind,next);
    for (const kick of [0,-1,1,-2,2]) if (!collide(state.well,shape,active.x+kick,active.y)){ active.rotation=next; active.x+=kick;state.lastAction='rotate';presentTetrisWaveCMotion(controlled,'rotate',{direction}); if(fullRuleAuthority)sendRuleAction(direction>0?'rotate_cw':'rotate_ccw');else{emitActive();audioCue('tetris_rotate',{actionId:'tetris-local-'+(++tetrisAudioSequence)+'-rotate',reaction:'move'},.45);} render(); return true; }
    return false;
  }
  function softDrop(){
    if (!canControl()) return false; const state=states[controlled],active=state.active; if (!active) return false;
    const shape=shapeAt(active.kind,active.rotation);
    if (!collide(state.well,shape,active.x,active.y+1)){ active.y++;state.lastAction='drop';presentTetrisWaveCFall(controlled); if(fullRuleAuthority)sendRuleAction('soft_drop');else{emitActive();audioCue('tetris_soft_drop',{actionId:'tetris-local-'+(++tetrisAudioSequence)+'-soft',reaction:'move'},.3);} render(); return true; }
    const locked=lockActive(controlled,true);if(locked&&fullRuleAuthority)sendRuleAction('soft_drop');return locked;
  }
  function hardDrop(){
    if (!canControl()) return false; const state=states[controlled],active=state.active; if (!active) return false;
    const shape=shapeAt(active.kind,active.rotation); let distance=0;
    while (!collide(state.well,shape,active.x,active.y+1)){ active.y++; distance++; }if(distance>0)state.lastAction='drop';
    const locked=lockActive(controlled,true);if(locked){if(fullRuleAuthority)sendRuleAction('hard_drop');else audioCue('tetris_hard_drop',{actionId:'tetris-local-'+(++tetrisAudioSequence)+'-hard',reaction:'place'},.7);}return locked;
  }
  function hold(){
    if (!canControl()) return false; const state=states[controlled],active=state.active;
    if (!active||!state.canHold) return false; const previous=state.hold; state.hold=active.kind; state.active=null;state.lastAction=null;
    if (!spawn(state,previous===null?undefined:previous,true)) return false; state.canHold=false; if(fullRuleAuthority)sendRuleAction('hold');else{emitActive();audioCue('tetris_move',{actionId:'tetris-local-'+(++tetrisAudioSequence)+'-hold',reaction:'move'},.4);} render(); return true;
  }
  function executeTetrisInputIntent(type){
    if(type==='move_left')return moveActive(-1);
    if(type==='move_right')return moveActive(1);
    if(type==='soft_drop')return softDrop();
    if(type==='hard_drop')return hardDrop();
    if(type==='rotate_cw')return rotateActive(1);
    if(type==='rotate_ccw')return rotateActive(-1);
    if(type==='hold')return hold();
    return false;
  }
  function dispatchTetrisInputIntent(type){
    if(!tetrisInputGate)return executeTetrisInputIntent(type);
    const sequence=++tetrisInputSemanticSequence;
    const intent={gameId:'tetris',type,id:'tetris-'+tetrisInputGateGeneration+'-'+sequence,sequence,generation:tetrisInputGateGeneration};
    let submitted=null;
    try{submitted=tetrisInputGate.submit(intent);}catch(_error){submitted=null;}
    if(!submitted||submitted.accepted!==true)return executeTetrisInputIntent(type);
    tetrisInputDispatchAttempted=false;tetrisInputDispatchResult=false;
    let flushed=null;
    try{flushed=tetrisInputGate.flush();}catch(_error){flushed=null;}
    if(tetrisInputDispatchAttempted||(flushed&&flushed.delivered>0))return tetrisInputDispatchResult;
    return executeTetrisInputIntent(type);
  }
  function emitActive(){
    if (!opts.online||!states[controlled]||!states[controlled].active) return;
    const state=states[controlled],a=state.active;
    sendRelay({act:'active',piece:a.kind,x:a.x,y:a.y,rot:a.rotation,hold:state.hold,canHold:state.canHold,queue:state.queue.slice(0,14),bagIndex:state.bagIndex});
  }
  function ko(pi,reason,relayMeta){
    const state=states[pi];if(!state)return;
    const meta=relayMeta||{};
    if(!state.alive){
      if(meta.confirmed)state.koConfirmed=true;
      if(opts.online&&opts.isHost&&states.filter(item=>item.alive).length<=1&&states.filter(item=>!item.alive).every(item=>item.koConfirmed))finishMatch();
      return;
    }
    state.alive=false;state.koTime=Number(meta.koTime)||Date.now();state.active=null;state.incoming=[];state.lastEvent='KO';state.eventAt=Date.now();
    state.koConfirmed=!opts.online||pi===controlled||!!meta.confirmed;
    const alive=states.filter(item=>item.alive); state.placement=alive.length+1;
    if(!fullRuleAuthority&&!authorityMode)audioCue('tetris_ko', { actionId:'tetris-ko-' + pi + '-' + (state.koTime || Date.now()), reaction:'capture' }, 1);
    toast(t('tetris_ko_toast',pi+1,localizeTetrisReason(reason)));
    if (pi===controlled) spectator=true;
    if(!over)presentTetrisWaveCGarbage(pi,{lines:0,incoming:false});
    if(opts.online&&pi===controlled&&meta.emit!==false){if(authorityMode&&typeof opts.sendTetrisKOClaim==='function')opts.sendTetrisKOClaim({seq:++battleSeq,reason:String(reason||'TOP OUT').slice(0,40),boardHeight:boardHeight(state.well)});else sendRelay({act:'ko',reason:String(reason||'TOP OUT').slice(0,40),koTime:state.koTime});}
    if(alive.length<=1){
      if(alive[0])alive[0].placement=1;
      if(!opts.online||opts.isHost&&states.filter(item=>!item.alive).every(item=>item.koConfirmed))finishMatch();
    }
  }
  function finalOrder(){
    return states.map(state=>state.id).sort((a,b)=>{
      const A=states[a],B=states[b];
      if (A.alive!==B.alive) return A.alive?-1:1;
      if (A.alive) return boardHeight(A.well)-boardHeight(B.well)||B.lines-A.lines||B.score-A.score||a-b;
      return (B.koTime||0)-(A.koTime||0)||a-b;
    });
  }
  function validFinalOrder(order){return Array.isArray(order)&&order.length===playerCount&&new Set(order).size===playerCount&&order.every(id=>Number.isInteger(id)&&id>=0&&id<playerCount);}
  function commitFinal(order,fromRelay,suppressReport){
    if(!validFinalOrder(order))return false;
    over=true;finishedAt=Date.now();remainingMs=Math.max(0,MATCH_MS-(finishedAt-startedAt));winner=order[0];
    order.forEach((id,index)=>states[id].placement=index+1);
    enterTetrisWaveCTerminal();
    if(opts.online&&opts.isHost&&!fromRelay)sendRelay({act:'final',order:order.slice(),state:relaySnapshot(seq+1),protocol:'casual-host-relay-v1'});
    if(!suppressReport&&!endReported&&opts.onEnd){endReported=true;opts.onEnd(order.map((id,index)=>({slot:id,rank:index+1,coins:index===0?1:0})));}
    render();setStatus(t('tetris_last_survivor',winner+1),true);return true;
  }
  function finishMatch(){
    if(over||authorityMode||opts.online&&!opts.isHost)return false;
    return commitFinal(finalOrder(),false);
  }

  // Dellacherie 风格井面评估：高度之外同时惩罚洞、行列转换、深井和凹凸。
  // 这些特征既用于断网本地 AI，也作为归一化经验送入玩家专属学习模型。
  function boardMetrics(well){
    const heights=Array(COLS).fill(0);let holes=0,aggregateHeight=0,maxHeight=0,bumpiness=0,rowTransitions=0,columnTransitions=0,wells=0;
    for(let c=0;c<COLS;c++){
      let found=false;
      for(let r=0;r<ROWS;r++){
        if(well[r][c]){if(!found){found=true;heights[c]=ROWS-r;}}else if(found)holes++;
      }
      aggregateHeight+=heights[c];maxHeight=Math.max(maxHeight,heights[c]);
    }
    for(let c=0;c<COLS-1;c++)bumpiness+=Math.abs(heights[c]-heights[c+1]);
    for(let r=0;r<ROWS;r++){
      let previous=1;
      for(let c=0;c<COLS;c++){const occupied=well[r][c]?1:0;if(occupied!==previous)rowTransitions++;previous=occupied;}
      if(previous!==1)rowTransitions++;
    }
    for(let c=0;c<COLS;c++){
      let previous=0;
      for(let r=0;r<ROWS;r++){const occupied=well[r][c]?1:0;if(occupied!==previous)columnTransitions++;previous=occupied;}
      if(previous!==1)columnTransitions++;
    }
    for(let c=0;c<COLS;c++){
      let depth=0;
      for(let r=0;r<ROWS;r++){
        const left=c===0||well[r][c-1],right=c===COLS-1||well[r][c+1];
        if(!well[r][c]&&left&&right){depth++;wells+=depth;}else depth=0;
      }
    }
    return{heights,holes,aggregateHeight,maxHeight,bumpiness,rowTransitions,columnTransitions,wells};
  }
  function evaluatePlacement(well,kind,rotation,x,incoming){
    const shape=shapeAt(kind,rotation);let y=-shape.length;
    while(!collide(well,shape,x,y+1))y++;
    if(collide(well,shape,x,y))return null;
    const beforeClear=cloneWell(well),placed=[];
    for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++)if(shape[r][c]){
      const rr=y+r,cc=x+c;if(rr<0||cc<0||cc>=COLS||rr>=ROWS)return null;
      beforeClear[rr][cc]=1;placed.push([rr,cc]);
    }
    const fullRows=[];for(let r=0;r<ROWS;r++)if(beforeClear[r].every(Boolean))fullRows.push(r);
    const result=lockInto(well,shape,x,y);if(result.cleared<0)return null;
    const metrics=boardMetrics(result.well),cleared=result.cleared;
    const erodedPieceCells=cleared*placed.filter(cell=>fullRows.includes(cell[0])).length;
    const landingHeight=ROWS-(y+shape.length/2),attack=attackFor(cleared),cancelled=Math.min(Math.max(0,Number(incoming)||0),attack);
    const score=
      -4.5002*landingHeight+3.4181*erodedPieceCells-3.2179*metrics.rowTransitions-
      9.3487*metrics.columnTransitions-7.8993*metrics.holes-3.3856*metrics.wells-
      1.8*metrics.bumpiness-2.4*Math.max(0,metrics.maxHeight-12)**2+
      cancelled*32+Math.max(0,attack-cancelled)*18;
    return{kind,rotation,x,y,well:result.well,cleared,attack,cancelled,landingHeight,erodedPieceCells,...metrics,score};
  }
  function enumeratePlacements(well,kind,incoming){
    const options=[];
    for(let rotation=0;rotation<4;rotation++)for(let x=-2;x<COLS+2;x++){
      const candidate=evaluatePlacement(well,kind,rotation,x,incoming);if(candidate)options.push(candidate);
    }
    return options;
  }
  function tetrisDifficultyProfile(difficulty){
    const id=difficulty&&difficulty.id;
    if(id==='easy')return{placementLimit:12,lookahead:false,lookaheadWeight:0,candidates:4};
    if(id==='hard')return{placementLimit:48,lookahead:true,lookaheadWeight:.5,candidates:12};
    // 普通档维持原本 32 落点的一步前瞻及近优候选带。
    return{placementLimit:32,lookahead:true,lookaheadWeight:.35,candidates:8};
  }
  function aiOptions(state,difficulty){
    const profile=tetrisDifficultyProfile(difficulty);
    ensureQueue(state);
    const kind=state.active?state.active.kind:state.queue[0],next=state.queue[state.active?0:1];
    // 简单档只做受限单层评估；普通/困难档分别保留或扩大前瞻范围。
    const incoming=incomingTotal(state),options=enumeratePlacements(state.well,kind,incoming)
      .sort((a,b)=>b.score-a.score||a.rotation-b.rotation||a.x-b.x).slice(0,profile.placementLimit);
    options.forEach(candidate=>{
      if(!profile.lookahead||!Number.isInteger(next)){candidate.lookaheadScore=candidate.score;return;}
      const replies=enumeratePlacements(candidate.well,next,Math.max(0,incoming-candidate.attack));
      const bestReply=replies.reduce((best,item)=>!best||item.score>best.score?item:best,null);
      candidate.nextBest=bestReply?bestReply.score:0;
      candidate.lookaheadScore=candidate.score+(bestReply?bestReply.score*profile.lookaheadWeight:-500);
    });
    return options.sort((a,b)=>b.lookaheadScore-a.lookaheadScore||b.score-a.score||a.rotation-b.rotation||a.x-b.x);
  }
  function tetrisLearningFeatures(item,best,band,incoming){
    const quality=1-Math.max(0,best.lookaheadScore-item.lookaheadScore)/Math.max(1,band);
    return{
      quality:Math.max(-1,Math.min(1,quality)),lines_cleared:item.cleared/4,tetris:item.cleared===4?1:0,
      attack:item.attack/4,incoming_cancel:Math.min(1,item.cancelled/4),low_landing:1-Math.min(1,item.landingHeight/ROWS),
      low_stack:1-Math.min(1,item.maxHeight/ROWS),few_holes:1-Math.min(1,item.holes/18),
      smooth_surface:1-Math.min(1,item.bumpiness/36),row_stability:1-Math.min(1,item.rowTransitions/80),
      column_stability:1-Math.min(1,item.columnTransitions/50),well_control:1-Math.min(1,item.wells/60),
      pressure:Math.min(1,Math.max(0,incoming)/12),
    };
  }
  const aiPending=new Set();
  const aiTimers=new Map();
  function isTetrisReplaying(){return typeof opts.isReplaying==='function'&&!!opts.isReplaying();}
  function canRunAI(pi){
    const state=states[pi];
    return !destroyed&&!over&&!isTetrisReplaying()&&!!state&&state.alive&&!!opts.ai&&opts.ai.has(pi);
  }
  function cancelAIWork(){
    aiEpoch++;
    aiPending.clear();
    aiTimers.forEach(timer=>clearTimeout(timer));
    aiTimers.clear();
  }
  function scheduleLiveAI(delay){
    if(destroyed||over||isTetrisReplaying()||!opts.ai)return;
    opts.ai.forEach(pi=>{if(canRunAI(pi))queueAI(pi,delay);});
  }
  function queueAI(pi,delay){
    const existing=aiTimers.get(pi);if(existing)clearTimeout(existing);
    aiTimers.delete(pi);
    if(!canRunAI(pi))return false;
    const timer=setTimeout(()=>{
      if(aiTimers.get(pi)!==timer)return;
      aiTimers.delete(pi);
      if(canRunAI(pi))scheduleAI(pi);
    },Math.max(0,Number(delay)||0));
    if(timer&&typeof timer.unref==='function')timer.unref();aiTimers.set(pi,timer);return true;
  }
  async function scheduleAI(pi){
    const queued=aiTimers.get(pi);if(queued){clearTimeout(queued);aiTimers.delete(pi);}
    const state=states[pi]; if (!canRunAI(pi)||aiPending.has(pi)) return;
    const difficulty=typeof aiDifficultyFromOptions === 'function' ? aiDifficultyFromOptions(opts) : {id:'hard'};
    const profile=tetrisDifficultyProfile(difficulty);
    aiPending.add(pi);const epoch=aiEpoch,options=aiOptions(state,difficulty);
    if (!options.length){ aiPending.delete(pi); ko(pi,'TOP OUT'); return; }
    const best=options[0],band=Math.max(8,Math.min(48,Math.abs(best.lookaheadScore)*.035+8));
    const near=options.filter(item=>item.lookaheadScore>=best.lookaheadScore-band).slice(0,profile.candidates);
    const choices=near.map(item=>item.kind+':'+item.rotation+':'+item.x+':'+item.y);
    const incoming=incomingTotal(state),learningCandidates=near.map(item=>({choice:item.kind+':'+item.rotation+':'+item.x+':'+item.y,features:tetrisLearningFeatures(item,best,band,incoming)}));
    const remoteAllowed=typeof aiDifficultyAllowsRemote === 'function' ? aiDifficultyAllowsRemote(difficulty) : difficulty.id==='hard';
    const remoteProfile=typeof aiDifficultyRequestProfile === 'function' ? aiDifficultyRequestProfile(difficulty) : {id:'teacher',difficulty:difficulty.id};
    const requestStateKey=JSON.stringify({active:state.active?{...state.active}:null,well:state.well,queue:state.queue.slice(),incoming:state.incoming,placementSeq:state.placementSeq});
    // 非困难档仍提交候选用于个人学习，但不会采用远端落点。
    const remote=await aiChoose('tetris',{player:pi,well:state.well.map(row=>row.join('')),incoming,target:targetFor(pi),next:state.queue[0],localRanking:near.map(item=>({choice:item.kind+':'+item.rotation+':'+item.x+':'+item.y,score:+item.lookaheadScore.toFixed(2),holes:item.holes,height:item.maxHeight,lines:item.cleared}))},choices,remoteProfile,learningCandidates);
    const stateChanged=JSON.stringify({active:state.active?{...state.active}:null,well:state.well,queue:state.queue.slice(),incoming:state.incoming,placementSeq:state.placementSeq})!==requestStateKey;
    if (destroyed||over||epoch!==aiEpoch||isTetrisReplaying()||states[pi]!==state||stateChanged){
      aiPending.delete(pi);
      // A cancelled epoch belongs to reset/restore/reconnect/destroy.  Its
      // response must not enqueue a second timer beside the fresh snapshot
      // schedule; only a same-epoch state change is retryable.
      if(epoch===aiEpoch&&canRunAI(pi)&&state.alive)queueAI(pi,0);
      return;
    }
    const localIndex=typeof aiDifficultyLocalChoiceIndex === 'function'
      ? aiDifficultyLocalChoiceIndex(difficulty,choices.length) : (difficulty.id==='easy'?Math.min(choices.length-1,1):0);
    const remoteIndex=choices.indexOf(remote),index=remoteAllowed&&remoteIndex>=0?remoteIndex:Math.max(0,localIndex);
    const pick=near[index]||near[0];aiPending.delete(pi);
    if (fullRuleAuthority && opts.online && typeof opts.sendBotTetrisAction === 'function') { if(canRunAI(pi))opts.sendBotTetrisAction(pi, { type:'hard_drop' }); return; }
    state.active={kind:pick.kind,rotation:pick.rotation,x:pick.x,y:pick.y}; applyPlacement(pi,{piece:pick.kind,x:pick.x,y:pick.y,rot:pick.rotation},true,!!opts.online);
    if(canRunAI(pi))queueAI(pi,2500);
  }

  function tick(){
    if (destroyed||over) return;
    const now=Date.now(),dt=Math.min(250,Math.max(0,now-lastTickAt)); lastTickAt=now;
    performanceStats.samples++;performanceStats.lastFrameMs=dt;performanceStats.maxFrameMs=Math.max(performanceStats.maxFrameMs,dt);if(dt>50)performanceStats.longFrames++;
    remainingMs=authorityMode?Math.max(0,matchEndAt-now):Math.max(0,MATCH_MS-(now-startedAt));
    // tetris-rule-v3 的重力/锁定完全由服务端推进；客户端只做输入乐观展示，避免本地计时器与权威快照竞态。
    if(fullRuleAuthority){if(now-lastRenderAt>=100){render();lastRenderAt=now;}return;}
    states.forEach(state=>{
      if(!state.alive)return;
      if(opts.online&&!opts.isHost&&state.id!==controlled)return;
      if(!authorityMode)resolveDueGarbage(state,now);
      if(now<countdownEndsAt) return;
      if(opts.online&&state.id!==controlled) return;
      if(opts.ai&&opts.ai.has(state.id)) return;
      state.fallMs+=dt; const interval=Math.max(160,700-Math.floor(state.lines/10)*45);
      if(state.fallMs>=interval){ state.fallMs-=interval; const active=state.active|| (spawn(state,undefined,true)&&state.active); if(!active)return;
        const shape=shapeAt(active.kind,active.rotation); if(!collide(state.well,shape,active.x,active.y+1)){active.y++;presentTetrisWaveCFall(state.id);}else lockActive(state.id,state.id===controlled);
      }
    });
    if(remainingMs<=0&&!authorityMode&&(!opts.online||opts.isHost))finishMatch();syncArrays();
    if(now-lastRenderAt>=100){render();lastRenderAt=now;}
  }
  const gameTimer=setInterval(tick,50); if(gameTimer&&typeof gameTimer.unref==='function')gameTimer.unref();
  function emitHostSync(){
    if(!opts.online||!opts.isHost||destroyed||over||opts.isReplaying&&opts.isReplaying())return false;
    relayRevision++;const next=seq+1;
    sendRelay({act:'sync',revision:relayRevision,state:relaySnapshot(next),protocol:'casual-host-relay-v1'});return true;
  }
  const relayTimer=opts.online&&!authorityMode&&opts.isHost?setInterval(emitHostSync,RELAY_SYNC_MS):null;
  if(relayTimer&&typeof relayTimer.unref==='function')relayTimer.unref();

  function handleKey(event){
    if(!canControl())return;
    const key=event.key;
    if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','z','Z','x','X','c','C','Shift',' ','Spacebar'].includes(key)&&event.preventDefault)event.preventDefault();
    if(key==='ArrowLeft')dispatchTetrisInputIntent('move_left'); else if(key==='ArrowRight')dispatchTetrisInputIntent('move_right'); else if(key==='ArrowDown')dispatchTetrisInputIntent('soft_drop');
    else if(key==='ArrowUp'||key==='x'||key==='X')dispatchTetrisInputIntent('rotate_cw'); else if(key==='z'||key==='Z')dispatchTetrisInputIntent('rotate_ccw');
    else if(key==='c'||key==='C'||key==='Shift')dispatchTetrisInputIntent('hold'); else if(key===' '||key==='Spacebar')dispatchTetrisInputIntent('hard_drop');
  }
  if(document.addEventListener)document.addEventListener('keydown',handleKey);
  const onTetrisInputVisibilityChange=()=>{if(document.visibilityState==='hidden')resetTetrisInputGate();};
  if(tetrisInputGateRequested&&document.addEventListener)document.addEventListener('visibilitychange',onTetrisInputVisibilityChange);

  function localizeTetrisReason(reason){const key={ 'TOP OUT':'tetris_reason_top_out','GARBAGE KO':'tetris_reason_garbage_ko','REMOTE KO':'tetris_reason_remote_ko','SERVER KO':'tetris_reason_server_ko' }[String(reason||'').toUpperCase()];return key?t(key):String(reason||t('tetris_status_ko'));}
  function localizeTetrisEvent(value){const text=String(value||''),incoming=/^⚠ \+(\d+)$/.exec(text),garbage=/^\+(\d+) GARBAGE$/.exec(text),cleared=/^CLEAR ×(\d+)$/.exec(text),scoring=/^SCORING:([a-z-]+):(-?\d+):([01]):([01])$/.exec(text);if(incoming)return t('tetris_event_incoming',incoming[1]);if(garbage)return t('tetris_event_garbage',garbage[1]);if(cleared)return t('tetris_event_clear',cleared[1]);if(scoring){const key={none:'tetris_event_lock',single:'tetris_event_single',double:'tetris_event_double',triple:'tetris_event_triple',tetris:'tetris_event_tetris','t-spin-zero':'tetris_event_tspin_zero','t-spin-single':'tetris_event_tspin_single','t-spin-double':'tetris_event_tspin_double','t-spin-triple':'tetris_event_tspin_triple'}[scoring[1]]||'tetris_event_lock',parts=[t(key)],combo=Number(scoring[2]);if(scoring[3]==='1')parts.push(t('tetris_event_b2b'));if(combo>=1)parts.push(t('tetris_event_combo',combo+1));if(scoring[4]==='1')parts.push(t('tetris_event_perfect_clear'));return parts.join(' · ');}const key={KO:'tetris_status_ko',LOCK:'tetris_event_lock',HOLD:'tetris_hold',SPAWN:'tetris_event_spawn',SYNC:'tetris_event_sync',READY:'tetris_event_ready','TETRIS!':'tetris_event_tetris'}[text.toUpperCase()];return key?t(key):text;}
  extra.innerHTML=''; const battleHud=el('div','tetris-battle-hud'),actions=el('div','tetris-actions'),actionControls=[]; extra.appendChild(battleHud); extra.appendChild(actions);
  function addControl(label,fn,primary,ariaKey,controlId){const button=el('button','btn'+(primary?' btn-primary':''),label);if(ariaKey)button.setAttribute('aria-label',t(ariaKey));button.addEventListener('click',fn);actions.appendChild(button);actionControls.push({button,controlId});return button;}
  addControl('⬅',()=>dispatchTetrisInputIntent('move_left'),false,'tetris_move_left','left'); addControl('➡',()=>dispatchTetrisInputIntent('move_right'),false,'tetris_move_right','right'); addControl('↺',()=>dispatchTetrisInputIntent('rotate_ccw'),false,'tetris_rotate_left','rotate-ccw'); addControl('↻',()=>dispatchTetrisInputIntent('rotate_cw'),false,'tetris_rotate_right','rotate-cw');
  addControl('⬇',()=>dispatchTetrisInputIntent('soft_drop'),false,'tetris_soft_drop','soft-drop'); addControl(t('tetris_hold'),()=>dispatchTetrisInputIntent('hold'),false,'tetris_hold','hold'); addControl('⤓',()=>dispatchTetrisInputIntent('hard_drop'),true,'tetris_hard_drop','hard-drop');

  function syncWaveBCommandPresentation(enabled){
    battleHud.classList.toggle('tetris-wave-b-hud',enabled);actions.classList.toggle('tetris-wave-b-controls',enabled);
    setWaveBData(battleHud,'tetris-region',enabled?'battle-hud':null);setWaveBData(actions,'tetris-region',enabled?'controls':null);
    actionControls.forEach(({button,controlId})=>{
      button.classList.toggle('tetris-wave-b-control',enabled);
      setWaveBData(button,'tetris-control',enabled?controlId:null);
    });
  }

  function createWellView(mini){
    const root=el('div','tetris-well'+(mini?' mini-board':' main-board'));root.style.touchAction='none';
    if(typeof markTabletopSurface==='function')markTabletopSurface(root,'tetris-well',{variant:mini?'mini':'main'});
    return{root,mini,locked:new Map(),ghost:[],active:[],ko:null,assetUrl:''};
  }
  function setCellPosition(node,item,cell){node.style.display='block';node.style.left=item.x*cell+'px';node.style.top=item.y*cell+'px';node.style.width=cell+'px';node.style.height=cell+'px';}
  function updateCellPool(view,key,items,className,kind,cell){
    const pool=view[key];
    while(pool.length<items.length){const node=el('div','tetris-cell');pool.push(node);view.root.appendChild(node);}
    pool.forEach((node,index)=>{if(index>=items.length){node.style.display='none';return;}node.className=className+' kind-'+kind;setCellPosition(node,items[index],cell);node.style.backgroundColor=className.includes('ghost')?'':COLORS[kind];node.style.color=COLORS[kind];});
  }
  function updateWellView(view,state,width){
    const mini=view.mini,cell=width/COLS,height=cell*ROWS,well=view.root;
    well.style.width=width+'px';well.style.height=height+'px';
    if(well.style&&typeof well.style.setProperty==='function')well.style.setProperty('--tetris-cell-size',cell+'px');else well.style['--tetris-cell-size']=cell+'px';
    const playerCosmetic=cosmetic.players&&cosmetic.players[state.id]||{},background=playerCosmetic.background||cosmetic.background,block=playerCosmetic.block||cosmetic.block;
    const tabletop=typeof tabletopArtEnabled==='function'&&tabletopArtEnabled();
    if(typeof markTabletopSurface==='function')markTabletopSurface(well,'tetris-well',{variant:(mini?'mini-':'main-')+background});
    const artEnabled=!tabletop&&typeof gameArtEnabled==='function'&&gameArtEnabled('tetris');well.classList.toggle('game-art-v1',artEnabled);
    if(tabletop){
      view.assetUrl='';
      if(well.style&&typeof well.style.removeProperty==='function')well.style.removeProperty('--game-board-art');
      else if(well.style)well.style['--game-board-art']='none';
      well.style.backgroundImage='linear-gradient(rgba(33,25,35,.11) 1px,transparent 1px),linear-gradient(90deg,rgba(33,25,35,.11) 1px,transparent 1px),linear-gradient(135deg,#FFF9F2,#E7D3A7)';
    }else if(artEnabled){const url=gameArtUrl('tetris','board');if(url!==view.assetUrl){setAssetCssUrl(well,'--game-board-art',url);view.assetUrl=url;}well.style.backgroundImage='';}
    else{view.assetUrl='';well.style.backgroundImage=background==='grid'?'linear-gradient(rgba(34,211,238,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.12) 1px,transparent 1px)':'';}
    const occupied=new Set();
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(state.well[r][c]){
      const key=r+':'+c,kind=(r*COLS+c)%7;occupied.add(key);let node=view.locked.get(key);
      if(!node){node=el('div','tetris-cell');view.locked.set(key,node);well.appendChild(node);}
      node.className='tetris-cell is-locked kind-'+kind;setCellPosition(node,{x:c,y:r},cell);node.style.backgroundColor=COLORS[kind];node.style.boxShadow=block==='neon'?'inset 0 0 '+(cell*.35)+'px #fff,0 0 '+(cell*.35)+'px '+COLORS[kind]:'';
      if(node.style&&typeof node.style.setProperty==='function')node.style.setProperty('--tt-tetris-cosmetic-shadow',block==='neon'?'0 0 '+(cell*.35)+'px '+COLORS[kind]:'0 0 transparent');
    }
    for(const [key,node] of view.locked)if(!occupied.has(key)){removeRenderNode(node);view.locked.delete(key);}
    const activeCells=[],ghostCells=[];
    if(state.active&&state.alive){
      const shape=shapeAt(state.active.kind,state.active.rotation);let ghostY=state.active.y;while(!collide(state.well,shape,state.active.x,ghostY+1))ghostY++;
      for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++)if(shape[r][c]){
        if(!mini&&ghostY+r>=0)ghostCells.push({x:state.active.x+c,y:ghostY+r});
        if(state.active.y+r>=0)activeCells.push({x:state.active.x+c,y:state.active.y+r});
      }
      updateCellPool(view,'ghost',ghostCells,'tetris-cell ghost',state.active.kind,cell);
      updateCellPool(view,'active',activeCells,'tetris-cell is-active',state.active.kind,cell);
    }else{updateCellPool(view,'ghost',[],'tetris-cell ghost',0,cell);updateCellPool(view,'active',[],'tetris-cell is-active',0,cell);}
    if(!view.ko){view.ko=el('div','tetris-ko',t('tetris_status_ko'));well.appendChild(view.ko);}
    view.ko.style.cssText='position:absolute;inset:0;display:'+(state.alive?'none':'grid')+';place-items:center;background:rgba(2,6,23,.7);color:#fff;font-size:'+(mini?'18':'42')+'px;font-weight:950;z-index:8;';
  }
  function ensureRenderTree(){
    const waveB=waveBEnabled();setWaveBRoot(waveB);syncWaveBCommandPresentation(waveB);
    if(renderTree&&renderTree.waveB===waveB&&area.querySelector&&area.querySelector('.tetris-battle-layout')===renderTree.layout)return renderTree;
    area.innerHTML='';miniViews.clear();
    const layout=el('div','tetris-battle-layout'),mainBox=el('section','tetris-player-main'),mainScore=el('div','tetris-score'),mainWell=createWellView(false),mainNext=el('div','tetris-next'),side=el('aside','tetris-opponents'),compact=el('div','tetris-compact-status');
    layout.style.cssText='display:grid;grid-template-columns:minmax(220px,1fr) minmax(112px,.38fr);gap:12px;align-items:start;touch-action:none;';
    let mainScoreText=null,preview=null;
    if(waveB){
      layout.classList.add('tetris-wave-b-layout');setWaveBData(layout,'tetris-stage','wave-b');
      mainBox.classList.add('tetris-wave-b-main');setWaveBData(mainBox,'tetris-region','main');
      mainScore.classList.add('tetris-wave-b-score');setWaveBData(mainScore,'tetris-region','score');mainScoreText=el('span','tetris-score-summary');mainScore.appendChild(mainScoreText);
      mainWell.root.classList.add('tetris-wave-b-main-well');setWaveBData(mainWell.root,'tetris-region','main-well');
      mainNext.classList.add('tetris-wave-b-preview-deck');setWaveBData(mainNext,'tetris-region','preview');mainNext.setAttribute('role','status');
      const createPreview=(role,marker,label)=>{const slot=el('div','tetris-preview-slot tetris-preview-'+role),symbol=el('span','tetris-preview-marker',marker),value=el('strong','tetris-preview-value');setWaveBData(slot,'tetris-preview',role);if(label!==null)slot.appendChild(el('span','tetris-preview-label',label));slot.appendChild(symbol);slot.appendChild(value);mainNext.appendChild(slot);return value;};
      preview={hold:createPreview('hold','◇',t('tetris_hold')),next:createPreview('next','↪',null),incoming:createPreview('incoming','⚠',null)};
      side.classList.add('tetris-wave-b-opponents');setWaveBData(side,'tetris-region','opponents');
      compact.classList.add('tetris-wave-b-compact-status');setWaveBData(compact,'tetris-region','compact-opponents');
    }
    mainBox.appendChild(mainScore);mainBox.appendChild(mainWell.root);mainBox.appendChild(mainNext);
    const processRail=waveB?createTetrisWaveCProcessRail():null;
    if(processRail)mainBox.appendChild(processRail);
    layout.appendChild(mainBox);layout.appendChild(side);area.appendChild(layout);
    states.forEach(state=>{const card=el('button','tetris-mini-card');card.dataset.player=String(state.id);card.style.cssText='display:block;width:100%;margin-bottom:8px;padding:5px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--text);';
      if(waveB){card.classList.add('tetris-wave-b-opponent-card');setWaveBData(card,'tetris-region','opponent');setWaveBData(card,'tetris-player',state.id);}
      const title=el('div','tetris-mini-title'),well=createWellView(true),event=el('strong','tetris-event');card.appendChild(title);card.appendChild(well.root);card.appendChild(event);card.addEventListener('click',()=>{setObservedPlayer(state.id);});side.appendChild(card);miniViews.set(state.id,{card,title,well,event});});
    side.appendChild(compact);renderTree={layout,mainBox,mainScore,mainScoreText,mainWell,mainNext,preview,side,compact,processRail,waveB};paintTetrisWaveCProcess();return renderTree;
  }
  function render(){
    if(destroyed)return;const tree=ensureRenderTree(),width=Math.min(area.clientWidth||560,680),availableHeight=Math.max(0,Number(area.clientHeight)||0),main=states[observedPlayer]||states[0],mainWidth=tetrisMainWellWidth(width,availableHeight);
    const scoreText=t('tetris_score_line',main.id+1,main.score,main.lines,t(main.alive?'tetris_status_alive':'tetris_status_ko')),scoreTarget=tree.mainScoreText||tree.mainScore;if(scoreTarget.textContent!==scoreText)scoreTarget.textContent=scoreText;
    if(tree.waveB){setWaveBData(tree.mainScore,'tetris-player',main.id);setWaveBData(tree.mainScore,'tetris-score',main.score);setWaveBData(tree.mainScore,'tetris-lines',main.lines);setWaveBData(tree.mainScore,'tetris-alive',main.alive?'true':'false');}
    updateWellView(tree.mainWell,main,mainWidth);
    const queue=main.queue.slice(0,3).map(kind=>['I','O','J','L','S','Z','T'][kind]).join(' '),holdText=main.hold===null?'—':['I','O','J','L','S','Z','T'][main.hold],incoming=incomingTotal(main),nextText=t('tetris_hold_next',holdText,queue,incoming);
    if(tree.waveB&&tree.preview){
      if(tree.preview.hold.textContent!==holdText)tree.preview.hold.textContent=holdText;
      if(tree.preview.next.textContent!==queue)tree.preview.next.textContent=queue;
      const incomingText=String(incoming);if(tree.preview.incoming.textContent!==incomingText)tree.preview.incoming.textContent=incomingText;
      tree.mainNext.setAttribute('aria-label',nextText);setWaveBData(tree.mainNext,'tetris-hold',holdText);setWaveBData(tree.mainNext,'tetris-next',queue);setWaveBData(tree.mainNext,'tetris-incoming',incoming);
    }else if(tree.mainNext.textContent!==nextText)tree.mainNext.textContent=nextText;
    const opponents=states.filter(state=>state.id!==main.id),visible=new Set(opponents.slice(0,3).map(state=>state.id));
    states.forEach(state=>{const view=miniViews.get(state.id);if(!view)return;view.card.style.display=visible.has(state.id)?'grid':'none';if(!visible.has(state.id))return;
      const title=t('tetris_mini_title',state.id+1,t(state.alive?'tetris_status_alive':'tetris_status_ko'),state.score);if(view.title.textContent!==title)view.title.textContent=title;updateWellView(view.well,state,Math.min(112,width*.25));const showEvent=Date.now()-state.eventAt<1500,eventText=localizeTetrisEvent(state.lastEvent);view.event.style.display=showEvent?'block':'none';if(showEvent&&view.event.textContent!==eventText)view.event.textContent=eventText;
      if(tree.waveB){setWaveBData(view.card,'tetris-alive',state.alive?'true':'false');setWaveBData(view.card,'tetris-height',boardHeight(state.well));setWaveBData(view.card,'tetris-score',state.score);}});
    const compact=opponents.slice(3),compactText=compact.map(state=>t('tetris_compact_player',state.id+1,t(state.alive?'tetris_status_alive':'tetris_status_ko'),boardHeight(state.well))).join(' · ');tree.compact.style.display=compact.length?'block':'none';if(tree.compact.textContent!==compactText)tree.compact.textContent=compactText;
    const seconds=Math.ceil(Math.max(0,remainingMs)/1000),countdown=Math.ceil(Math.max(0,countdownEndsAt-Date.now())/1000),target=targetFor(controlled),hudText=countdown>0?t('tetris_countdown',countdown):('⏱ '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' · '+t('tetris_alive_ratio',states.filter(state=>state.alive).length,playerCount)+(authorityMode&&target>=0?' · '+t('tetris_target',target+1):''));
    if(battleHud.textContent!==hudText)battleHud.textContent=hudText;
    if(tree.waveB){setWaveBData(battleHud,'tetris-countdown',countdown);setWaveBData(battleHud,'tetris-alive',states.filter(state=>state.alive).length);setWaveBData(battleHud,'tetris-target',authorityMode&&target>=0?target:null);}actions.style.display=spectator?'none':'flex';
    const playerRows=states.map(state=>state.alive?t('tetris_player_lines',state.lines,incomingTotal(state)):t('tetris_status_ko')),playersSignature=controlled+'|'+playerRows.join('|');if(playersSignature!==lastPlayersSignature){lastPlayersSignature=playersSignature;renderPlayers(controlled,playerRows);}
    updateStatus();commitTetrisGhost3DPresenter();if(over&&!victoryShown)queueTetrisOutcome();
  }
  function updateStatus(){if(over)return;const countdown=Math.ceil(Math.max(0,countdownEndsAt-Date.now())/1000),text=countdown>0?t('tetris_countdown',countdown):(t(spectator?'spectating_prefix':'empty_text')+t('tetris_survival_status',states.filter(state=>state.alive).length));if(text!==lastStatusText){lastStatusText=text;setStatus(text);}}

  opts.onMove=(payload,player)=>{
    if(authorityMode)return;
    if(!plainRecord(payload))return;const pi=opts.online?player:(Number.isInteger(player)?player:0);if(!Number.isInteger(pi)||pi<0||pi>=states.length)return;
    if(opts.online&&(!validMatchId(payload.matchId)||!Number.isSafeInteger(payload.seq)))return;
    const incomingSeq=opts.online?payload.seq:(Number.isSafeInteger(payload.seq)?payload.seq:0);
    if(opts.online&&incomingSeq<=lastSeq[pi])return;
    if(incomingSeq){lastSeq[pi]=incomingSeq;if(pi===controlled)seq=Math.max(seq,incomingSeq);}
    if(over&&payload.act!=='final')return;
    if(payload.act==='sync'){
      if(opts.online&&pi===hostSlot)applyRelaySnapshot(payload.state);return;
    }
    if(payload.act==='final'){
      if(!opts.online||pi!==hostSlot)return;
      if(payload.state)applyRelaySnapshot(payload.state);
      commitFinal(Array.isArray(payload.order)?payload.order.map(Number):[],true);return;
    }
    if(over)return;
    if(payload.act==='active'){
      if(!onlyKeys(payload,RELAY_ACTIVE_KEYS))return;
      const state=states[pi],kind=payload.piece,x=payload.x,y=payload.y,rotation=payload.rot;
      if(!state.alive||!validKind(kind)||!validCoord(x,-3,9)||!validCoord(y,-4,17)||!safeInt(rotation,0,3)||!validQueue(payload.queue)||!validHold(payload.hold)||!safeInt(payload.bagIndex,0,1000000)||typeof payload.canHold!=='boolean')return;
      state.queue=payload.queue.slice();state.bagIndex=payload.bagIndex;state.hold=payload.hold;state.canHold=payload.canHold;state.active={kind,x,y,rotation};observeTetrisWaveCStates(false);render();return;
    }
    if(payload.act==='ko'){ko(pi,String(payload.reason||'REMOTE KO').slice(0,40),{emit:false,confirmed:true,koTime:payload.koTime});return;}
    const applied=applyPlacement(pi,payload,payload.act!=='lock',false);
    if(applied&&!opts.online&&opts.ai)opts.ai.forEach(aiPlayer=>scheduleAI(aiPlayer));
  };
  function authorityIncoming(items){
    if(!Array.isArray(items))return[];
    const seen=new Set(),out=[];
    for(const item of items){
      if(!plainRecord(item)||item.delivered===true||typeof item.attackId!=='string'||!ATTACK_ID_RE.test(item.attackId)||seen.has(item.attackId)||
         !safeInt(item.source,0,playerCount-1)||!safeInt(item.target,0,playerCount-1)||!safeInt(item.amount,1,12)||!Number.isFinite(item.applyAt))continue;
      seen.add(item.attackId);out.push({id:item.attackId,from:item.source,lines:item.amount,applyAt:item.applyAt});
      if(out.length>=100)break;
    }
    return out;
  }
  function onBattleEvent(event){
    tetrisGhost3DLegacyDomOnly('reconcile');
    if(!authorityMode||!plainRecord(event)||!validMatchId(event.matchId)||!safeInt(event.revision,1,Number.MAX_SAFE_INTEGER)||event.revision<=authorityRevision||
       !ATTACK_ID_RE.test(String(event.attackId||''))||!safeInt(event.source,0,playerCount-1)||(!safeInt(event.target,-1,playerCount-1))||!safeInt(event.amount,0,12)||!safeInt(event.cancelled,0,12))return false;
    if(over||seenBattleAudioEvents.has(String(event.attackId)))return false;
    invalidateTetrisWaveCProcess(false);
    const source=event.source,target=event.target,sourceIncoming=authorityIncoming(event.sourceIncoming),targetIncoming=authorityIncoming(event.targetIncoming);
    authorityRevision=event.revision;
    seenBattleAudioEvents.add(String(event.attackId));
    while(seenBattleAudioEvents.size>256){const first=seenBattleAudioEvents.values().next().value;seenBattleAudioEvents.delete(first);}
    if(states[source]){states[source].incoming=sourceIncoming;states[source].garbageSent+=event.amount;}
    if(states[target]){states[target].incoming=targetIncoming;states[target].lastEvent='⚠ +'+incomingTotal(states[target]);states[target].eventAt=Date.now();}
    // Lock/clear feedback is emitted only after the server accepts the claim.
    // The local token carries line count, which is intentionally absent from
    // the compact battle transition wire event.
    const scoring=pendingBattleScoring.get(String(event.attackId));
    pendingBattleScoring.delete(String(event.attackId));
    audioCue('tetris_lock',{actionId:tetrisBattleAudioId(event.revision,event.attackId,'lock'),reaction:'place'},.8);
    if(scoring&&scoring.cleared>0)audioCue('tetris_line_clear',{actionId:tetrisBattleAudioId(event.revision,event.attackId,'clear'),reaction:'score'},Math.min(1,.55+scoring.cleared*.1));
    observeTetrisWaveCStates(false);render();return true;
  }
  function onGarbageDue(event){
    tetrisGhost3DLegacyDomOnly('reconcile');
    if(!authorityMode||!plainRecord(event)||!validMatchId(event.matchId)||!safeInt(event.revision,1,Number.MAX_SAFE_INTEGER)||event.revision<=authorityRevision||
       !ATTACK_ID_RE.test(String(event.attackId||''))||!safeInt(event.source,0,playerCount-1)||!safeInt(event.target,0,playerCount-1)||!safeInt(event.amount,1,12)||
       (event.applyAt!==undefined&&!Number.isFinite(event.applyAt)))return false;
    if(over)return false;
    const target=event.target,state=states[target];if(!state)return false;
    const index=state.incoming.findIndex(item=>item.id===event.attackId);if(index<0||state.incoming[index].lines!==event.amount)return false;
    invalidateTetrisWaveCProcess(false);
    const pending=state.incoming.splice(index,1)[0];authorityRevision=event.revision;
    if(state.alive){
      applyGarbage(state,{id:pending.id,from:pending.from,lines:pending.lines,applyAt:Date.now()});
      if(target===controlled)audioCue('tetris_garbage',{actionId:tetrisBattleAudioId(event.revision,event.attackId,'garbage'),reaction:'capture'},.85);
    }
    syncArrays();render();if(target===controlled)sendPresentation();return true;
  }
  function onAuthorityKO(event){
    tetrisGhost3DLegacyDomOnly('reconcile');
    if(!authorityMode||!plainRecord(event)||!validMatchId(event.matchId)||!safeInt(event.revision,1,Number.MAX_SAFE_INTEGER)||event.revision<=authorityRevision||
       !safeInt(event.player,0,playerCount-1)||!safeInt(event.placement,1,playerCount)||!Number.isFinite(event.koTime))return false;
    if(over)return false;
    invalidateTetrisWaveCProcess(false);
    const player=event.player;if(!states[player])return false;authorityRevision=event.revision;
    ko(player,'SERVER KO',{emit:false,confirmed:true,koTime:event.koTime});states[player].placement=event.placement;
    audioCue('tetris_ko',{actionId:'tetris-authority-'+event.revision+'-'+player+'-ko',reaction:'capture'},1);
    render();return true;
  }
  function onAuthorityResult(payload){
    tetrisGhost3DLegacyDomOnly('reconcile');
    return !!(authorityMode&&plainRecord(payload)&&validMatchId(payload.matchId)&&validFinalOrder(Array.isArray(payload.order)?payload.order:[]))&&commitFinal(payload.order.slice(),true,true);
  }
  function validRuleEvent(value){return value===null||(plainRecord(value)&&typeof value.type==='string'&&value.type.length>0&&value.type.length<=32&&
    (value.type!=='garbage'||safeInt(value.lines,0,12))&&(value.type!=='lock'||(typeof value.clearType==='string'&&/^(?:none|single|double|triple|tetris|t-spin-(?:zero|single|double|triple))$/.test(value.clearType)&&safeInt(value.attack,0,12)&&safeInt(value.scoreDelta,0,1000000000))));}
  function ruleEventText(value){
    if(!value)return'SYNC';
    if(value.type==='garbage')return'+'+value.lines+' GARBAGE';
    if(value.type==='lock')return scoringEventToken({clearType:value.clearType,combo:Number.isInteger(value.combo)?value.combo:-1,backToBackBonus:value.backToBackBonus===true,perfectClear:value.perfectClear===true});
    return value.type.toUpperCase();
  }
  function parseRulePlayer(meta,id){
    if(!plainRecord(meta)||meta.player!==id||!safeInt(meta.seq,0,Number.MAX_SAFE_INTEGER)||meta.seq<ruleSeq[id]||typeof meta.hash!=='string'||meta.hash.length>128||
       !plainRecord(meta.state)||!Array.isArray(meta.incoming)||meta.incoming.length>100||typeof meta.alive!=='boolean'||
       (meta.koTime!==null&&!Number.isFinite(meta.koTime))||!safeInt(meta.placement,0,playerCount))return null;
    const data=meta.state;
    if(!onlyKeys(data,new Set(['protocol','scoringVersion','seed','player','board','active','queue','bagIndex','hold','canHold','score','lines','level','combo','backToBack','backToBackCount','tSpins','tetrises','perfectClears','lastAction','pieces','terminal','reason','lastEvent']))||
       data.protocol!==RULE_PROTOCOL||typeof data.seed!=='string'||data.seed.length>128||data.player!==id||!validWell(data.board)||!validActive(data.active)||!validQueue(data.queue)||
       !safeInt(data.bagIndex,0,1000000)||!validHold(data.hold)||typeof data.canHold!=='boolean'||!safeInt(data.score,0,1000000000)||!safeInt(data.lines,0,100000)||
       !safeInt(data.pieces,0,100000)||typeof data.terminal!=='boolean'||(data.reason!==null&&(typeof data.reason!=='string'||data.reason.length>64))||!validRuleEvent(data.lastEvent))return null;
    if(data.scoringVersion!==undefined&&(data.scoringVersion!==SCORING_VERSION||!safeInt(data.level,1,10001)||!safeInt(data.combo,-1,100000)||typeof data.backToBack!=='boolean'||!safeInt(data.backToBackCount,0,100000)||!safeInt(data.tSpins,0,100000)||!safeInt(data.tetrises,0,100000)||!safeInt(data.perfectClears,0,100000)||(data.lastAction!==null&&!['move','rotate','drop'].includes(data.lastAction))))return null;
    const incoming=authorityIncoming(meta.incoming);if(incoming.length!==meta.incoming.length)return null;
    return{seq:meta.seq,hash:meta.hash,state:data,incoming,alive:meta.alive,koTime:meta.koTime,placement:meta.placement};
  }
  function emitTetrisRuleAudio(value,parsed,reconnect,before){
    if(reconnect||!Array.isArray(parsed)||!Array.isArray(before))return false;
    let emitted=false;
    parsed.forEach((meta,id)=>{
      const prior=before[id]||{},event=meta&&meta.state&&meta.state.lastEvent;
      const acceptedAction=Number(meta.seq)>Number(prior.seq);
      const locked=event&&event.type==='lock'&&(acceptedAction||Number(meta.state.pieces)>Number(prior.pieces));
      const cueBase='tetris-rule-'+value.revision+'-'+id+'-'+meta.seq;
      if(id===controlled&&locked){
        audioCue('tetris_lock',{actionId:cueBase+'-lock',reaction:'place'},.8);emitted=true;
        if(event.clearType&&event.clearType!=='none'){
          const cleared=Number(meta.state.lines)-Number(prior.lines);
          audioCue('tetris_line_clear',{actionId:cueBase+'-clear',reaction:'score'},Math.min(1,.65+Math.max(0,cleared)*.08));emitted=true;
        }
      }else if(id===controlled&&acceptedAction&&event){
        if(event.type==='move')audioCue('tetris_move',{actionId:cueBase+'-move',reaction:'move'},.35);
        else if(event.type==='rotate')audioCue('tetris_rotate',{actionId:cueBase+'-rotate',reaction:'move'},.45);
        else if(event.type==='fall')audioCue('tetris_soft_drop',{actionId:cueBase+'-fall',reaction:'move'},.3);
        else if(event.type==='hold')audioCue('tetris_move',{actionId:cueBase+'-hold',reaction:'move'},.4);
        else return;
        emitted=true;
      }
      if(meta.alive===false&&(prior.alive!==false||acceptedAction)){
        audioCue('tetris_ko',{actionId:'tetris-rule-'+value.revision+'-'+id+'-ko',reaction:'capture'},1);emitted=true;
      }
    });
    return emitted;
  }
  function onTetrisRuleState(value,source){
    const allowed=new Set(['protocol','matchId','startAt','matchEndAt','matchSeed','rulesetVersion','revision','serverNow','players','finished','order','inputCount']);
    if(!fullRuleAuthority||!onlyKeys(value,allowed)||value.protocol!==RULE_PROTOCOL||!validMatchId(value.matchId)||!safeInt(value.revision,0,Number.MAX_SAFE_INTEGER)||value.revision<authorityRevision||
       !Number.isFinite(value.startAt)||!Number.isFinite(value.matchEndAt)||value.matchEndAt<value.startAt||typeof value.matchSeed!=='string'||value.matchSeed.length>128||
       value.rulesetVersion!==RULE_PROTOCOL||!Number.isFinite(value.serverNow)||!Array.isArray(value.players)||value.players.length!==playerCount||
       !safeInt(value.inputCount,0,1000000)||(value.finished!==true&&value.finished!==false)||(value.order!==null&&!validFinalOrder(value.order))){tetrisGhost3DLegacyDomOnly('reconcile');return false;}
    if(over&&!value.finished){tetrisGhost3DLegacyDomOnly('reconcile');return false;}
    const reconnect=source==='reconnect'||source==='room-restored'||source==='spectator-bootstrap'||source==='bootstrap'||!ruleStateApplied;
    const parsed=value.players.map((meta,id)=>parseRulePlayer(meta,id));if(parsed.some(item=>!item)){tetrisGhost3DLegacyDomOnly('reconcile');return false;}
    const beforeAudio=states.map((state,id)=>({seq:ruleSeq[id],pieces:state.placementSeq,lines:state.lines,alive:state.alive}));
    if(reconnect){cancelAIWork();resetTetrisInputGate();pendingBattleScoring.clear();seenBattleAudioEvents.clear();}
    authorityRevision=Math.max(authorityRevision,value.revision);startedAt=value.startAt;countdownEndsAt=startedAt;matchEndAt=value.matchEndAt;bagSeed=value.matchSeed;remainingMs=Math.max(0,matchEndAt-Date.now());
    parsed.forEach((meta,id)=>{const state=states[id],data=meta.state;ruleSeq[id]=meta.seq;state.well=data.board.map(row=>row.slice());state.active=data.active===null?null:{kind:data.active.kind,rotation:data.active.rotation,x:data.active.x,y:data.active.y};state.queue=data.queue.slice();state.bagIndex=data.bagIndex;state.hold=data.hold;state.canHold=data.canHold;state.score=data.score;state.lines=data.lines;state.scoringVersion=data.scoringVersion||SCORING_VERSION;state.level=safeInt(data.level,1,10001)?data.level:Math.floor(data.lines/10)+1;state.combo=safeInt(data.combo,-1,100000)?data.combo:-1;state.backToBack=data.backToBack===true;state.backToBackCount=safeInt(data.backToBackCount,0,100000)?data.backToBackCount:0;state.tSpins=safeInt(data.tSpins,0,100000)?data.tSpins:0;state.tetrises=safeInt(data.tetrises,0,100000)?data.tetrises:0;state.perfectClears=safeInt(data.perfectClears,0,100000)?data.perfectClears:0;state.lastAction=typeof data.lastAction==='string'?data.lastAction:null;state.tetrisCount=state.tetrises;state.placementSeq=data.pieces;state.alive=meta.alive&&!data.terminal;state.koTime=meta.koTime;state.placement=meta.placement;state.incoming=meta.incoming;state.lastEvent=ruleEventText(data.lastEvent);state.eventAt=Date.now();});
    // A rejoined client creates a fresh game instance, while the server keeps
    // the per-player action sequence.  Advance the local sender from the
    // accepted authoritative snapshot so its first post-reconnect command is
    // new instead of being rejected as stale.
    if(parsed[controlled]&&Number.isSafeInteger(parsed[controlled].seq))battleSeq=Math.max(battleSeq,parsed[controlled].seq);
    pieceCount=Math.max(pieceCount,parsed.reduce((sum,item)=>sum+item.state.pieces,0));ruleStateApplied=true;tetrisGhost3DRememberAcceptedV3(value,parsed,source||'live');emitTetrisRuleAudio(value,parsed,reconnect,beforeAudio);
    syncArrays();if(value.finished&&validFinalOrder(value.order||[]))commitFinal(value.order.slice(),true,true);else{observeTetrisWaveCStates(false);render();if(reconnect)scheduleLiveAI(2500);}return true;
  }
  function onTetrisRuleResult(value){return !!(fullRuleAuthority&&onlyKeys(value,new Set(['type','matchId','protocol','scoringVersion','revision','serverNow','order','stats']))&&value.protocol===RULE_PROTOCOL&&(value.scoringVersion===undefined||value.scoringVersion===SCORING_VERSION)&&validMatchId(value.matchId)&&safeInt(value.revision,1,Number.MAX_SAFE_INTEGER)&&validFinalOrder(Array.isArray(value.order)?value.order:[]))&&commitFinal(value.order.slice(),true,true);}
  function applyPresentation(player,value,incomingSeq){
    const state=states[player],data=value&&value.state?value.state:value;
    if(!state||!plainRecord(data)||!onlyKeys(data,PRESENTATION_KEYS)||!validWell(data.well)||!validActive(data.active)||!validQueue(data.queue)||!validHold(data.hold)||
       typeof data.canHold!=='boolean'||!safeInt(data.bagIndex,0,1000000)||!safeInt(data.score,0,1000000000)||!safeInt(data.lines,0,100000)||
       !safeInt(data.tetrisCount,0,25000)||!safeInt(data.placementSeq,0,100000)||data.placementSeq<state.placementSeq)return false;
    if(incomingSeq!==undefined&&(!Number.isSafeInteger(incomingSeq)||incomingSeq<=presentationSeq[player]))return false;
    state.well=data.well.map(row=>row.slice());state.active=data.active===null?null:{kind:data.active.kind,rotation:data.active.rotation,x:data.active.x,y:data.active.y};
    state.queue=data.queue.slice();state.bagIndex=data.bagIndex;state.hold=data.hold;state.canHold=data.canHold;
    state.score=data.score;state.lines=data.lines;state.tetrisCount=data.tetrisCount;state.placementSeq=data.placementSeq;
    if(incomingSeq!==undefined)presentationSeq[player]=incomingSeq;
    syncArrays();return true;
  }
  function onTetrisState(item){
    if(!authorityMode||!onlyKeys(item,TETRIS_STATE_KEYS)){tetrisGhost3DLegacyDomOnly('reconcile');return false;}
    tetrisGhost3DLegacyDomOnly('reconcile');
    const player=item.player;if(!safeInt(player,0,playerCount-1)||!validMatchId(item.matchId)||(item.updatedAt!==undefined&&!Number.isFinite(item.updatedAt)))return false;
    const incomingSeq=Number.isSafeInteger(item.seq)?item.seq:(item.state&&Number.isSafeInteger(item.state.seq)?item.state.seq:0);
    if(!safeInt(incomingSeq,1,Number.MAX_SAFE_INTEGER)||over)return false;
    const applied=applyPresentation(player,item.state,incomingSeq);if(applied){observeTetrisWaveCStates(false);render();}return applied;
  }
  function onBattleSnapshot(value){
    tetrisGhost3DLegacyDomOnly('reconcile');
    if(!authorityMode||!plainRecord(value)||value.protocol!==AUTH_PROTOCOL||!validMatchId(value.matchId)||!safeInt(value.revision,0,Number.MAX_SAFE_INTEGER)||value.revision<authorityRevision||
       !Number.isFinite(value.startAt)||!Number.isFinite(value.matchEndAt)||value.matchEndAt<value.startAt||!Array.isArray(value.players)||value.players.length!==playerCount)return false;
    if(over&&!value.finished)return false;
    cancelAIWork();
    pendingBattleScoring.clear(); seenBattleAudioEvents.clear();
    invalidateTetrisWaveCProcess(false);
    authorityRevision=Math.max(authorityRevision,value.revision);startedAt=value.startAt;countdownEndsAt=startedAt;matchEndAt=value.matchEndAt;bagSeed=typeof value.matchSeed==='string'?value.matchSeed:bagSeed;
    value.players.forEach((meta,id)=>{if(!states[id]||!plainRecord(meta))return;states[id].alive=meta.alive!==false;states[id].koTime=meta.koTime===null?null:(Number.isFinite(meta.koTime)?meta.koTime:null);states[id].placement=safeInt(meta.placement,0,playerCount)?meta.placement:0;states[id].placementSeq=Math.max(states[id].placementSeq,safeInt(meta.placementSeq,0,100000)?meta.placementSeq:0);states[id].incoming=authorityIncoming(meta.incoming);states[id].garbageSent=Math.max(states[id].garbageSent,safeInt(meta.garbageSent,0,1000000)?meta.garbageSent:0);states[id].garbageReceived=Math.max(states[id].garbageReceived,safeInt(meta.garbageReceived,0,1000000)?meta.garbageReceived:0);});
    if(value.players[controlled]&&safeInt(value.players[controlled].lastSeq,0,Number.MAX_SAFE_INTEGER))battleSeq=Math.max(battleSeq,value.players[controlled].lastSeq);
    remainingMs=Math.max(0,matchEndAt-Date.now());if(value.finished&&validFinalOrder(Array.isArray(value.order)?value.order:[]))commitFinal(value.order.slice(),true,true);else{observeTetrisWaveCStates(false);render();scheduleLiveAI(2500);}return true;
  }
  function reset(){if(opts.online&&!opts.isHost){toast(t('host_only_restart'));return;}if(opts.online){opts.sendRestart();return;}resetLocal();}
  function snapshot(){return{
    version:2,mode:'simultaneous-survival',wells:states.map(state=>state.well.map(row=>row.slice())),scores:states.map(state=>state.score),
    states:states.map(state=>({id:state.id,active:state.active?{...state.active}:null,queue:state.queue.slice(),bagIndex:state.bagIndex,hold:state.hold,canHold:state.canHold,score:state.score,lines:state.lines,scoringVersion:state.scoringVersion,level:state.level,combo:state.combo,backToBack:state.backToBack,backToBackCount:state.backToBackCount,tSpins:state.tSpins,tetrises:state.tetrises,perfectClears:state.perfectClears,lastAction:state.lastAction,tetrisCount:state.tetrisCount,placementSeq:state.placementSeq,garbageSent:state.garbageSent,garbageReceived:state.garbageReceived,incoming:state.incoming.map(item=>({...item})),alive:state.alive,koTime:state.koTime,koConfirmed:state.koConfirmed,placement:state.placement,fallMs:state.fallMs,lastEvent:state.lastEvent,eventAt:state.eventAt})),
    remainingMs,over,winner,pieceCount,cur,bagSeed,countdownRemainingMs:Math.max(0,countdownEndsAt-Date.now()),
    relay:{revision:relayRevision,seenSeq:lastSeq.slice(),seenAttacks:[...seenAttacks].slice(-500)},
  };}
  function validRelaySnapshot(state){
    if(!state||state.mode!=='simultaneous-survival'||!Array.isArray(state.wells)||state.wells.length!==playerCount||!Array.isArray(state.states)||state.states.length!==playerCount)return false;
    if(state.bagSeed&&bagSeed&&String(state.bagSeed)!==String(bagSeed))return false;
    // Local QA/replay snapshots from older clients did not carry the relay
    // bookkeeping block.  They are still safe to restore when the game is
    // running offline because no remote authority can be bypassed; online
    // snapshots must include the block so sequence/attack replay remains
    // fail-closed.
    const relay=state.relay || (!opts.online ? {
      revision:0,
      seenSeq:Array(playerCount).fill(0),
      seenAttacks:[],
    } : null);
    if (!relay) return false;
    if(!validWell(state.wells[0])||!state.wells.every(validWell)||!Number.isFinite(state.remainingMs)||state.remainingMs<0||state.remainingMs> MATCH_MS||
       !safeInt(state.pieceCount,0,1000000)||!plainRecord(relay)||!safeInt(relay.revision,0,Number.MAX_SAFE_INTEGER)||!Array.isArray(relay.seenSeq)||relay.seenSeq.length!==playerCount||
       !relay.seenSeq.every(value=>safeInt(value,0,Number.MAX_SAFE_INTEGER))||!Array.isArray(relay.seenAttacks)||relay.seenAttacks.length>500||
       !relay.seenAttacks.every(value=>typeof value==='string'&&ATTACK_ID_RE.test(value)))return false;
    return state.states.every(meta=>{
      if(!plainRecord(meta)||!validQueue(meta.queue)||!validActive(meta.active)||!safeInt(meta.bagIndex,0,1000000)||!validHold(meta.hold)||typeof meta.canHold!=='boolean'||
         !safeInt(meta.score,0,1000000000)||!safeInt(meta.lines,0,100000)||!safeInt(meta.tetrisCount,0,25000)||!safeInt(meta.placementSeq,0,100000)||
         typeof meta.alive!=='boolean'||(meta.koTime!==null&&!Number.isFinite(meta.koTime))||!Array.isArray(meta.incoming)||meta.incoming.length>100)return false;
      if(meta.scoringVersion!==undefined&&(meta.scoringVersion!==SCORING_VERSION||!safeInt(meta.level,1,10001)||!safeInt(meta.combo,-1,100000)||typeof meta.backToBack!=='boolean'||!safeInt(meta.backToBackCount,0,100000)||!safeInt(meta.tSpins,0,100000)||!safeInt(meta.tetrises,0,100000)||!safeInt(meta.perfectClears,0,100000)||(meta.lastAction!==null&&!['move','rotate','drop'].includes(meta.lastAction))))return false;
      return meta.incoming.every(item=>plainRecord(item)&&typeof item.id==='string'&&ATTACK_ID_RE.test(item.id)&&safeInt(item.from,0,playerCount-1)&&safeInt(item.lines,1,12)&&Number.isFinite(item.applyAt));
    });
  }
  function relaySnapshot(nextLocalSeq){
    const state=snapshot();state.relay.revision=relayRevision;
    if(Number.isInteger(nextLocalSeq))state.relay.seenSeq[controlled]=Math.max(state.relay.seenSeq[controlled]||0,nextLocalSeq);
    return state;
  }
  function applyRelaySnapshot(state){
    if(!validRelaySnapshot(state))return false;
    const relay=state.relay||{},seen=Array.isArray(relay.seenSeq)?relay.seenSeq:[];
    const localState=states[controlled],incomingLocal=state.states&&state.states[controlled];
    const preserveLocal=!!localState&&((Number(seen[controlled])||0)<seq||localState.alive&&incomingLocal&&incomingLocal.alive===false&&!incomingLocal.koConfirmed);
    if(!onRestore(state))return false;
    if(preserveLocal){states[controlled]=localState;spectator=!!opts.spectator||!localState.alive;syncArrays();}
    for(let i=0;i<playerCount;i++)lastSeq[i]=Math.max(lastSeq[i]||0,Number(seen[i])||0);
    seq=Math.max(seq,Number(seen[controlled])||0);relayRevision=Math.max(relayRevision,Number(relay.revision)||0);
    if(Array.isArray(relay.seenAttacks))relay.seenAttacks.forEach(id=>{if(typeof id==='string'&&id.length<=100)seenAttacks.add(id);});
    observeTetrisWaveCStates(true);render();return true;
  }
  function onRestore(value,source){
    const state=value&&value.state?value.state:value;if(!validRelaySnapshot(state)){tetrisGhost3DLegacyDomOnly(source||'room-restored');return false;}
    if(over&&state.over!==true&&!(opts.isReplaying&&opts.isReplaying())){tetrisGhost3DLegacyDomOnly(source||'room-restored');return false;}
    clearTetrisOutcomeTimer();
    pendingBattleScoring.clear(); seenBattleAudioEvents.clear();
    resetTetrisInputGate();
    tetrisGhost3DStaticGeneration(opts.online?tetrisGhost3DSourceName(source||'room-restored'):'reconcile',true);
    cancelAIWork();
    invalidateTetrisWaveCProcess(true);
    if(state.bagSeed)bagSeed=String(state.bagSeed);
    states=state.wells.map((well,id)=>{const base=createState(id),meta=state.states[id];base.well=well.map(row=>row.slice());
      base.active=meta.active===null?null:{kind:meta.active.kind,rotation:meta.active.rotation,x:meta.active.x,y:meta.active.y};base.queue=meta.queue.slice();base.bagIndex=meta.bagIndex;base.hold=meta.hold;base.canHold=meta.canHold;
      base.score=meta.score;base.lines=meta.lines;base.scoringVersion=meta.scoringVersion||SCORING_VERSION;base.level=safeInt(meta.level,1,10001)?meta.level:Math.floor(meta.lines/10)+1;base.combo=safeInt(meta.combo,-1,100000)?meta.combo:-1;base.backToBack=meta.backToBack===true;base.backToBackCount=safeInt(meta.backToBackCount,0,100000)?meta.backToBackCount:0;base.tSpins=safeInt(meta.tSpins,0,100000)?meta.tSpins:0;base.tetrises=safeInt(meta.tetrises,0,100000)?meta.tetrises:meta.tetrisCount;base.perfectClears=safeInt(meta.perfectClears,0,100000)?meta.perfectClears:0;base.lastAction=typeof meta.lastAction==='string'?meta.lastAction:null;base.tetrisCount=base.tetrises;base.placementSeq=meta.placementSeq;base.garbageSent=safeInt(meta.garbageSent,0,1000000)?meta.garbageSent:0;base.garbageReceived=safeInt(meta.garbageReceived,0,1000000)?meta.garbageReceived:0;
      base.incoming=meta.incoming.map(item=>({...item}));base.alive=meta.alive;base.koTime=meta.koTime;base.koConfirmed=meta.koConfirmed===true;base.placement=safeInt(meta.placement,0,playerCount)?meta.placement:0;base.fallMs=safeInt(meta.fallMs,0,1000000)?meta.fallMs:0;base.lastEvent=typeof meta.lastEvent==='string'?meta.lastEvent.slice(0,80):'READY';base.eventAt=Number.isFinite(meta.eventAt)?meta.eventAt:Date.now();return base;});
    remainingMs=Math.max(0,state.remainingMs);startedAt=Date.now()-(MATCH_MS-remainingMs);over=state.over===true;winner=safeInt(state.winner,-1,playerCount-1)?state.winner:-1;pieceCount=state.pieceCount;
    countdownEndsAt=Date.now()+Math.max(0,Number(state.countdownRemainingMs)||0);spectator=!!opts.spectator||(!states[controlled]||!states[controlled].alive);observedPlayer=Math.min(observedPlayer,states.length-1);lastTickAt=Date.now();
    if(value&&value.presentation)setCosmetic(value.presentation.cosmetic);syncArrays();observeTetrisWaveCStates(true);render();scheduleLiveAI(2500);return true;
  }
  function setCosmetic(value){cosmetic={block:'classic',background:'classic',players:{},...(value||{})};cosmetic.block=cosmetic.block==='neon'?'neon':'classic';cosmetic.background=cosmetic.background==='grid'?'grid':'classic';render();return cosmetic;}
  function setSpectators(value){spectator=Array.isArray(value)?value.includes(opts.viewerId):!!value;resetTetrisInputGate();if(spectator)observedPlayer=Math.min(observedPlayer,states.length-1);tetrisGhost3DStaticGeneration('reconcile',false);invalidateTetrisWaveCProcess(false);observeTetrisWaveCStates(true);render();return spectator;}
  function setObservedPlayer(pi){if(Number.isInteger(pi)&&states[pi]){observedPlayer=pi;tetrisGhost3DStaticGeneration('reconcile',false);invalidateTetrisWaveCProcess(false);observeTetrisWaveCStates(true);render();return true;}return false;}
  function setControlledPlayer(pi){if(opts.online||!Number.isInteger(pi)||!states[pi])return false;controlled=pi;cur=pi;observedPlayer=pi;spectator=!states[pi].alive;tetrisGhost3DStaticGeneration('reconcile',false);invalidateTetrisWaveCProcess(false);observeTetrisWaveCStates(true);render();return true;}
  function getMatchStats(){const order=finalOrder();return states.map(state=>({score:state.score,lines:state.lines,level:state.level,combo:state.combo,backToBackCount:state.backToBackCount,tSpins:state.tSpins,tetrisCount:state.tetrisCount,perfectClears:state.perfectClears,garbageSent:state.garbageSent,garbageReceived:state.garbageReceived,koTime:state.koTime,placement:state.placement||order.indexOf(state.id)+1}));}
  function getPerformanceStats(){return{...performanceStats,boardCount:states.length,activeCells:states.reduce((sum,state)=>sum+state.well.reduce((n,row)=>n+row.filter(Boolean).length,0),0),incomingCount:states.reduce((sum,state)=>sum+state.incoming.length,0)};}
  function destroy(){destroyed=true;clearTetrisOutcomeTimer();releaseTetrisPresentationResize();disposeTetrisGhost3DPresenter();disposeTetrisInputGate();invalidateTetrisWaveCProcess(true);cancelAIWork();clearInterval(gameTimer);if(relayTimer)clearInterval(relayTimer);if(document.removeEventListener){document.removeEventListener('keydown',handleKey);document.removeEventListener('visibilitychange',onTetrisInputVisibilityChange);}setWaveBRoot(false);syncWaveBCommandPresentation(false);area.style.touchAction=previousTouchAction;area.style.overscrollBehavior=previousOverscroll;}
  resetLocal();
  installTetrisPresentationResize();
  return{reset,onMove:opts.onMove,onRestart:resetLocal,destroy,snapshot,onRestore,onBattleEvent,onGarbageDue,onAuthorityKO,onAuthorityResult,onBattleSnapshot,onTetrisState,onTetrisRuleState,onTetrisRuleResult,
    serialize:()=>({state:snapshot(),presentation:{cosmetic},stats:getMatchStats()}),getMatchStats,getPerformanceStats,setCosmetic,renderCosmetic:setCosmetic,setSpectators,setObservedPlayer,setControlledPlayer,
    getTarget:targetFor,queueGarbage,finishMatch,emitHostSync,whenIdle:()=>Promise.resolve(),getMultiplayerRequirement:()=>opts.online?(fullRuleAuthority?'TETRIS_RULE_PROTOCOL_V2':'TETRIS_BATTLE_PROTOCOL_V1'):null,
  };
}
