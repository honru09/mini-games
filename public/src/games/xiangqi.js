/* ================= 象棋 ================= */
function gameXiangqi(area, extra, n, opts){
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
  const COLS = 9, ROWS = 10;
  const PIECE = { 'k':'帅','a':'仕','e':'相','h':'马','r':'车','c':'炮','p':'兵' };
  const BLACK_PIECE = { 'k':'将','a':'士','e':'象','h':'马','r':'车','c':'炮','p':'卒' };
  const EMOJI = { '帅':'🤴','仕':'🧑‍⚖️','相':'🧓','马':'🐴','车':'🚗','炮':'💣','兵':'🪖','将':'👑','士':'🧑‍⚖️','象':'🐘','卒':'🪖' };
  function xiangqiPieceName(piece){return piece?t('xiangqi_piece_'+(piece.p===0?'red_':'black_')+piece.t):'';}
  function xiangqiCapturedName(label){
    for(const [type,name] of Object.entries(PIECE))if(name===label)return t('xiangqi_piece_red_'+type);
    for(const [type,name] of Object.entries(BLACK_PIECE))if(name===label)return t('xiangqi_piece_black_'+type);
    return label;
  }
  let board = Array.from({length:ROWS}, () => Array(COLS).fill(null)); // {p, t}
  let cur = 0, over = false, winner = -1, selected = null, legalMoves = [], lastMove = null;
  let aiPending = false, aiEpoch = 0;
  // Board AI Worker is a local-only, default-off optimization.  The retained
  // synchronous search and DeepSeek candidate seam remain authoritative
  // fallbacks; this broker only returns candidate IDs and never owns a move.
  let xiangqiBoardAIBroker = null, xiangqiBoardAIRequestSeq = 0, xiangqiBoardAIRequestId = null;
  let xiangqiBoardAISyncSolver = null;
  const XIANGQI_BOARD_AI_RULES = 'xiangqi-rule-v2';
  const XIANGQI_BOARD_AI_IDENTITY = 'xiangqi-local-scope';
  function xiangqiBoardAITechnicalFeature(name){
    try { return !!(opts && opts.technicalFeatures && opts.technicalFeatures[name] === true); }
    catch (_error) { return false; }
  }
  function xiangqiBoardAIWorkerEnabled(){
    // Online authority, spectators and missing browser Worker support never
    // enter this local optimization path.
    return xiangqiBoardAITechnicalFeature('boardAIWorkerV1') && !opts.online && !spectator;
  }
  function xiangqiBoardAIWorkerFactory(){
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
    if (!root || typeof root.Worker !== 'function') return null;
    try {
      const documentBase = root.document && typeof root.document.baseURI === 'string' ? root.document.baseURI : '';
      const workerUrl = documentBase && typeof root.URL === 'function'
        ? new root.URL('workers/board-ai-worker-v1.js', documentBase).toString()
        : 'workers/board-ai-worker-v1.js';
      return new root.Worker(workerUrl);
    } catch (_error) { return null; }
  }
  function xiangqiBoardAIPosition(){
    return {
      board: board.map(row => row.map(piece => piece ? { p:piece.p, t:piece.t } : null)),
      lastMove: lastMove ? { from:lastMove[0].slice(), to:lastMove[1].slice() } : null,
      moveCount,
    };
  }
  function xiangqiBoardAIBrokerForTurn(){
    if (!xiangqiBoardAIWorkerEnabled()) return null;
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
    const Broker = root && root.BoardAIWorkerBroker;
    if (!Broker || typeof Broker.create !== 'function') return null;
    if (xiangqiBoardAIBroker) return xiangqiBoardAIBroker;
    try {
      const syncAdapter = request => {
        const Kernel = root && root.BoardAIKernel;
        if (Kernel && typeof Kernel.create === 'function') {
          try {
            if (!xiangqiBoardAISyncSolver) xiangqiBoardAISyncSolver = Kernel.create();
            const solved = xiangqiBoardAISyncSolver.solve(request);
            if (solved && solved.accepted === true && Array.isArray(solved.ranked) && solved.ranked.length){
              return { choiceId:solved.ranked[0].id, ranked:solved.ranked };
            }
          } catch (_error) {}
        }
        return null;
      };
      syncAdapter.clear = () => {
        if (xiangqiBoardAISyncSolver && typeof xiangqiBoardAISyncSolver.clear === 'function'){
          try { xiangqiBoardAISyncSolver.clear(); } catch (_error) {}
        }
        xiangqiBoardAISyncSolver = null;
      };
      xiangqiBoardAIBroker = Broker.create({
        enabled:true,
        workerOptIn:true,
        workerFactory:xiangqiBoardAIWorkerFactory,
        // A deterministic candidate-only fallback keeps the old local path
        // alive even when Worker creation/CSP fails. No board/DOM state
        // crosses the broker boundary.
        syncAdapter,
      });
    } catch (_error) { xiangqiBoardAIBroker = null; }
    return xiangqiBoardAIBroker;
  }
  function cancelXiangqiBoardAI(reason){
    const broker = xiangqiBoardAIBroker;
    const requestId = xiangqiBoardAIRequestId;
    xiangqiBoardAIRequestId = null;
    if (!broker || !requestId || typeof broker.cancel !== 'function') return false;
    try { return broker.cancel(requestId, reason) === true; } catch (_error) { return false; }
  }
  function disposeXiangqiBoardAI(){
    cancelXiangqiBoardAI('dispose');
    const broker = xiangqiBoardAIBroker;
    xiangqiBoardAIBroker = null;
    if (broker && typeof broker.dispose === 'function'){
      try { broker.dispose(); } catch (_error) {}
    }
    xiangqiBoardAISyncSolver = null;
  }
  let boardTheme = opts.boardTheme === 'grass' ? 'grass' : 'classic';
  let cosmetic = normalizeCosmetic(opts.cosmetic);
  let spectator = !!opts.spectator;
  let startedAt = Date.now(), finishedAt = 0, moveCount = 0, captureCount = 0, checkCount = 0;
  let capturedPieces = [[], []], motion = null, motionEpoch = 0;
  let xiangqiKeyboardCell = [9, 4], xiangqiKeyboardMode = false, xiangqiKeyboardFocusPending = false;
  // Wave C presentation is deliberately local-only.  It visualizes the
  // existing authority state without changing Xiangqi Rule Core, clocks or
  // the online action protocol.
  const XIANGQI_WAVE_C_PROCESS_STEPS = ['turn','select','move','capture','check','clock','terminal'];
  let xiangqiWaveCProcess = 'turn', xiangqiWaveCProcessDetail = '', xiangqiWaveCProcessEpoch = 0, xiangqiWaveCProcessRevision = 0;
  const xiangqiWaveCProcessTimers = new Set();
  let xiangqiWaveCProcessRail = null, xiangqiWaveCProcessLabel = null, xiangqiWaveCProcessSteps = [], xiangqiWaveCBoard = null;
  let xiangqiPresentationResizeQueued = false, xiangqiPresentationResizeFrame = 0, xiangqiPresentationResizeObserver = null;
  let destroyed = false;
  // Ghost3D is a frozen developer experiment. The retained Canvas/2.5D board
  // is the production surface and only input owner; only exact "1" opts into
  // the renderer island. The bridge never participates in authority.
  const XIANGQI_GHOST3D_STORAGE_KEY = 'mg_ghost3d_xiangqi_v1';
  const XIANGQI_GHOST3D_QUALITY_STORAGE_KEY = 'mg_ghost3d_xiangqi_quality_v1';
  const XIANGQI_GHOST3D_QUALITIES = new Set(['HIGH','BALANCED','LOW']);
  const XIANGQI_GHOST3D_SOURCES = new Set(['live','room-restored','reconnect','spectator-bootstrap']);
  const XIANGQI_GHOST3D_PIECE_TYPES = new Set(['k','a','e','h','r','c','p']);
  function xiangqiGhost3DEnabled(){
    try{
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      return !!storage && typeof storage.getItem === 'function' && storage.getItem(XIANGQI_GHOST3D_STORAGE_KEY) === '1';
    }catch(_error){ return false; }
  }
  function xiangqiGhost3DInitialQuality(){
    try{
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      const value = storage && typeof storage.getItem === 'function' ? storage.getItem(XIANGQI_GHOST3D_QUALITY_STORAGE_KEY) : null;
      return XIANGQI_GHOST3D_QUALITIES.has(value) ? value : 'BALANCED';
    }catch(_error){ return 'BALANCED'; }
  }
  let xiangqiGhost3DActive = xiangqiGhost3DEnabled();
  let xiangqiGhost3DSlot = null, xiangqiGhost3DHost = null, xiangqiGhost3DModule = null;
  let xiangqiGhost3DGeneration = 0, xiangqiGhost3DAdapterEpoch = 0, xiangqiGhost3DPresentationRevision = 0;
  let xiangqiGhost3DLastFingerprint = '', xiangqiGhost3DImportPending = false, xiangqiGhost3DQueued = false, xiangqiGhost3DRecoverQueued = false;
  let xiangqiGhost3DPendingMotion = null, xiangqiGhost3DOnlineState = null, xiangqiGhost3DLocalLastMove = null;
  let xiangqiOutcomeScheduled = false, xiangqiOutcomeVisible = false, xiangqiOutcomeTimer = null, xiangqiOutcomePending = null;
  let xiangqiGhost3DListeners = [], xiangqiGhost3DMediaQuery = null;
  const RULE_PROTOCOL='xiangqi-rule-v2';
  const ruleAuthority=!!(opts.online&&opts.gameplayMeta&&opts.gameplayMeta.protocol===RULE_PROTOCOL&&typeof opts.sendXiangqiAction==='function'&&typeof XiangqiRules!=='undefined');
  const clockAuthority=!!(opts.online&&opts.gameplayMeta&&['xiangqi-clock-v1',RULE_PROTOCOL].includes(opts.gameplayMeta.protocol));
  let clockMoveSeq=0,xiangqiAuthorityAudioMoveNumber=0,xiangqiAuthorityAudioRevision=-1;
  let clockMode = ['rapid','blitz'].includes(opts.clockMode) ? opts.clockMode : 'casual';
  let clockRemaining = clockMode === 'rapid' ? [600000,600000] : clockMode === 'blitz' ? [180000,180000] : [null,null];
  let lastClockAt = Date.now();
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none'; area.style.overscrollBehavior = 'contain';
  const clockHud = el('div','xiangqi-clock-hud');
  const capturedHud = el('div','xiangqi-captured-hud');
  extra.appendChild(clockHud); extra.appendChild(capturedHud);
  function normalizeCosmetic(value){
    if (typeof value === 'string') return {default:value === 'jade' ? 'jade' : 'classic',players:{}};
    const source=value||{},base=source.default||source.pieces;
    return {default:base === 'jade' ? 'jade' : 'classic',players:{...(source.players||{})}};
  }
  function pieceSkin(player){const value=cosmetic.players&&cosmetic.players[player];return value === 'jade' || (value&&value.pieces==='jade') ? 'jade' : cosmetic.default;}
  function formatClock(value){
    if (value === null) return 'Casual';
    const seconds = Math.max(0, Math.ceil(value / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
  function syncClock(){
    const now = Date.now();
    if (!over && clockRemaining[cur] !== null) clockRemaining[cur] = Math.max(0, clockRemaining[cur] - (now - lastClockAt));
    lastClockAt = now;
  }
  function clearXiangqiWaveCProcessTimers(){
    xiangqiWaveCProcessTimers.forEach(timer => clearTimeout(timer));
    xiangqiWaveCProcessTimers.clear();
  }
  function scheduleXiangqiWaveCProcess(callback, delay){
    const epoch = xiangqiWaveCProcessEpoch;
    const timer = setTimeout(() => {
      xiangqiWaveCProcessTimers.delete(timer);
      if (!destroyed && epoch === xiangqiWaveCProcessEpoch) callback();
    }, Math.max(0, Number(delay) || 0));
    if (timer && typeof timer.unref === 'function') timer.unref();
    xiangqiWaveCProcessTimers.add(timer);
    return timer;
  }
  function scheduleXiangqiPresentationResize(){
    if (destroyed || xiangqiPresentationResizeQueued) return;
    xiangqiPresentationResizeQueued = true;
    const run = () => {
      xiangqiPresentationResizeQueued = false; xiangqiPresentationResizeFrame = 0;
      if (!destroyed) render();
    };
    if (typeof requestAnimationFrame === 'function') xiangqiPresentationResizeFrame = requestAnimationFrame(run);
    else Promise.resolve().then(run);
  }
  function installXiangqiPresentationResize(){
    const root = typeof window !== 'undefined' ? window : null;
    if (root && typeof root.addEventListener === 'function'){
      root.addEventListener('resize',scheduleXiangqiPresentationResize);
      root.addEventListener('orientationchange',scheduleXiangqiPresentationResize);
    }
    if (typeof ResizeObserver === 'function'){
      try { xiangqiPresentationResizeObserver = new ResizeObserver(scheduleXiangqiPresentationResize); xiangqiPresentationResizeObserver.observe(area); }
      catch (_error){ xiangqiPresentationResizeObserver = null; }
    }
  }
  function releaseXiangqiPresentationResize(){
    const root = typeof window !== 'undefined' ? window : null;
    if (root && typeof root.removeEventListener === 'function'){
      root.removeEventListener('resize',scheduleXiangqiPresentationResize);
      root.removeEventListener('orientationchange',scheduleXiangqiPresentationResize);
    }
    if (xiangqiPresentationResizeObserver && typeof xiangqiPresentationResizeObserver.disconnect === 'function') xiangqiPresentationResizeObserver.disconnect();
    xiangqiPresentationResizeObserver = null;
    if (xiangqiPresentationResizeFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(xiangqiPresentationResizeFrame);
    xiangqiPresentationResizeFrame = 0; xiangqiPresentationResizeQueued = false;
  }
  function xiangqiWaveCData(node, key, value){
    if (!node) return;
    const datasetKey = key.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
    if (node.dataset) node.dataset[datasetKey] = String(value);
    if (node.setAttribute) node.setAttribute('data-' + key, String(value));
  }
  function xiangqiWaveCProcessText(){
    if (xiangqiWaveCProcess === 'select') return t('xiangqi_initial_turn');
    if (xiangqiWaveCProcess === 'move') return t('player_turn', cur + 1);
    if (xiangqiWaveCProcess === 'capture') return t('xiangqi_captured_count', captureCount);
    if (xiangqiWaveCProcess === 'check') return t('xiangqi_player_in_check', cur + 1);
    if (xiangqiWaveCProcess === 'clock') return t('xiangqi_clock_active', cur + 1, formatClock(clockRemaining[cur]));
    if (xiangqiWaveCProcess === 'terminal') return t('match_over');
    return t('xiangqi_turn_status', spectator ? t('spectating_prefix') : '', t(cur === 0 ? 'xiangqi_red_side' : 'xiangqi_black_side'), t(opts.online && cur === opts.myIdx && !spectator ? 'your_turn' : 'thinking'));
  }
  function paintXiangqiWaveCProcess(){
    xiangqiWaveCData(area, 'xiangqi-process', xiangqiWaveCProcess);
    xiangqiWaveCData(xiangqiWaveCBoard, 'xiangqi-process', xiangqiWaveCProcess);
    if (xiangqiWaveCProcessRail){
      xiangqiWaveCData(xiangqiWaveCProcessRail, 'xiangqi-process', xiangqiWaveCProcess);
      if (xiangqiWaveCProcessLabel) xiangqiWaveCProcessLabel.textContent = xiangqiWaveCProcessText();
      xiangqiWaveCProcessSteps.forEach(step => {
        const active = step && step.dataset && step.dataset.xiangqiProcessStep === xiangqiWaveCProcess;
        xiangqiWaveCData(step, 'xiangqi-process-active', active ? 'true' : 'false');
        if (step && step.style){
          step.style.background = active ? 'linear-gradient(90deg,var(--accent,#435ac1),#f59e0b)' : 'rgba(76,43,21,.16)';
          step.style.boxShadow = active ? '0 2px 0 rgba(43,32,37,.2),0 5px 10px rgba(245,158,11,.28)' : 'inset 0 1px 1px rgba(255,255,255,.65)';
          step.style.transform = active && !(typeof prefersReducedMotion === 'function' && prefersReducedMotion()) ? 'translateY(-2px) scaleY(1.16)' : 'none';
        }
      });
    }
  }
  function setXiangqiWaveCProcess(next, detail){
    const process = XIANGQI_WAVE_C_PROCESS_STEPS.includes(next) ? next : 'turn';
    const processDetail = detail === undefined || detail === null ? '' : String(detail);
    if (process === xiangqiWaveCProcess && processDetail === xiangqiWaveCProcessDetail) return;
    xiangqiWaveCProcess = process;
    xiangqiWaveCProcessDetail = processDetail;
    xiangqiWaveCProcessRevision++;
    paintXiangqiWaveCProcess();
  }
  function settleXiangqiWaveCProcess(next, detail, delay){
    if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) { setXiangqiWaveCProcess(next, detail); return; }
    const revision = xiangqiWaveCProcessRevision;
    scheduleXiangqiWaveCProcess(() => {
      if (revision === xiangqiWaveCProcessRevision) setXiangqiWaveCProcess(next, detail);
    }, delay);
  }
  function pulseXiangqiWaveCClock(){
    if (over){
      setXiangqiWaveCProcess('terminal', winner);
      return;
    }
    setXiangqiWaveCProcess('clock', cur);
    settleXiangqiWaveCProcess('turn', cur, 180);
  }
  function xiangqiGhost3DFreeze(value){
    if (Array.isArray(value)) return Object.freeze(value.map(xiangqiGhost3DFreeze));
    if (value && typeof value === 'object'){
      const copy = {};
      Object.keys(value).forEach(key => { copy[key] = xiangqiGhost3DFreeze(value[key]); });
      return Object.freeze(copy);
    }
    return value;
  }
  function xiangqiGhost3DCoord(value){
    if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || !Number.isSafeInteger(value[1]) ||
        value[0] < 0 || value[0] >= ROWS || value[1] < 0 || value[1] >= COLS) return null;
    return [value[0], value[1]];
  }
  function xiangqiGhost3DPiece(value){
    if (!value || typeof value !== 'object' || (value.p !== 0 && value.p !== 1) || !XIANGQI_GHOST3D_PIECE_TYPES.has(value.t)) return null;
    return { p:value.p, t:value.t };
  }
  function xiangqiGhost3DSamePiece(left, right){
    if (left === null || left === undefined || right === null || right === undefined) return (left === null || left === undefined) && (right === null || right === undefined);
    return !!left && !!right && left.p === right.p && left.t === right.t;
  }
  function xiangqiGhost3DCloneBoard(value){
    if (!Array.isArray(value) || value.length !== ROWS) return null;
    const copied = [];
    for (let row = 0; row < ROWS; row++){
      if (!Array.isArray(value[row]) || value[row].length !== COLS) return null;
      const next = [];
      for (let col = 0; col < COLS; col++){
        const cell = value[row][col];
        if (cell === null){ next.push(null); continue; }
        const piece = xiangqiGhost3DPiece(cell);
        if (!piece) return null;
        next.push(piece);
      }
      copied.push(next);
    }
    return copied;
  }
  function xiangqiGhost3DCloneLastMove(value){
    if (value === null) return null;
    if (!value || typeof value !== 'object') return null;
    const from = xiangqiGhost3DCoord(value.from), to = xiangqiGhost3DCoord(value.to);
    if (!from || !to || !Object.prototype.hasOwnProperty.call(value, 'capture')) return null;
    if (value.capture === null) return { from, to, capture:null };
    const capture = xiangqiGhost3DPiece(value.capture);
    return capture ? { from, to, capture } : null;
  }
  function xiangqiGhost3DReadLocalLastMove(value){
    if (!Array.isArray(value) || value.length !== 2) return null;
    const from = xiangqiGhost3DCoord(value[0]), to = xiangqiGhost3DCoord(value[1]);
    return from && to ? { from, to, capture:null } : null;
  }
  function xiangqiGhost3DExpectedMatchId(){
    const value = typeof opts.getMatchId === 'function' ? opts.getMatchId() : opts.matchId;
    return typeof value === 'string' && value.length > 0 ? value : '';
  }
  function xiangqiGhost3DReadRuleState(value, source){
    if (!value || typeof value !== 'object' || !XIANGQI_GHOST3D_SOURCES.has(source) || value.protocol !== RULE_PROTOCOL) return null;
    const matchId = typeof value.matchId === 'string' ? value.matchId : '';
    const expectedMatchId = xiangqiGhost3DExpectedMatchId();
    if (!matchId || !expectedMatchId || matchId !== expectedMatchId || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
        typeof value.hash !== 'string' || !value.hash || (value.current !== 0 && value.current !== 1) ||
        !Number.isSafeInteger(value.moveNumber) || value.moveNumber < 0 || typeof value.check !== 'boolean' ||
        typeof value.terminal !== 'boolean' || ![-1,0,1].includes(value.winner)) return null;
    const boardValue = xiangqiGhost3DCloneBoard(value.board);
    const lastMoveValue = xiangqiGhost3DCloneLastMove(value.lastMove);
    if (!boardValue || (value.lastMove !== null && !lastMoveValue)) return null;
    return {
      origin:{ source, matchId, authorityRevision:value.revision, stateHash:value.hash },
      board:boardValue,
      current:value.current,
      moveNumber:value.moveNumber,
      lastMove:lastMoveValue,
      check:value.check,
      terminal:value.terminal,
      winner:value.winner,
    };
  }
  function xiangqiGhost3DLocalState(){
    const copiedBoard = xiangqiGhost3DCloneBoard(board);
    if (!copiedBoard || (cur !== 0 && cur !== 1) || !Number.isSafeInteger(moveCount) || moveCount < 0 || ![-1,0,1].includes(winner)) return null;
    const localMove = xiangqiGhost3DLocalLastMove || xiangqiGhost3DReadLocalLastMove(lastMove);
    return {
      origin:{ source:'local' },
      board:copiedBoard,
      current:cur,
      moveNumber:moveCount,
      lastMove:localMove ? { from:localMove.from.slice(), to:localMove.to.slice(), capture:localMove.capture ? { ...localMove.capture } : null } : null,
      check:!over && !!isCheck(cur),
      terminal:over === true,
      winner,
    };
  }
  function xiangqiGhost3DFrame(){
    const source = opts.online ? xiangqiGhost3DOnlineState : xiangqiGhost3DLocalState();
    if (!source || !source.board) return null;
    return {
      kind:'xiangqi-3d-frame-v1',
      origin:{ ...source.origin },
      board:source.board.map(row => row.map(piece => piece ? { p:piece.p, t:piece.t } : null)),
      current:source.current,
      moveNumber:source.moveNumber,
      lastMove:source.lastMove ? { from:source.lastMove.from.slice(), to:source.lastMove.to.slice(), capture:source.lastMove.capture ? { ...source.lastMove.capture } : null } : null,
      check:source.check === true,
      terminal:source.terminal === true,
      winner:source.winner,
    };
  }
  function xiangqiGhost3DOnlineMotion(previous, next, source){
    if (source !== 'live' || !previous || !next || previous.terminal || next.terminal ||
        previous.origin.matchId !== next.origin.matchId || next.origin.authorityRevision !== previous.origin.authorityRevision + 1 ||
        next.moveNumber !== previous.moveNumber + 1 || next.current !== (previous.current ^ 1) || !next.lastMove) return null;
    const from = next.lastMove.from, to = next.lastMove.to;
    const moved = previous.board[from[0]][from[1]], priorTarget = previous.board[to[0]][to[1]];
    if (!moved || moved.p !== previous.current || !xiangqiGhost3DSamePiece(next.board[to[0]][to[1]], moved) || next.board[from[0]][from[1]] !== null ||
        !xiangqiGhost3DSamePiece(priorTarget, next.lastMove.capture)) return null;
    let changed = 0;
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++){
      if (!xiangqiGhost3DSamePiece(previous.board[row][col], next.board[row][col])) changed++;
    }
    if (changed !== 2) return null;
    return { type:'piece_moved', player:moved.p, from:from.slice(), to:to.slice(), capture:priorTarget !== null };
  }
  function mountXiangqiGhost3DSlot(){
    if (!xiangqiGhost3DActive || !xiangqiWaveCBoard || xiangqiGhost3DSlot) return null;
    const slot = el('div','xiangqi-ghost3d-slot');
    slot.setAttribute('aria-hidden','true'); slot.setAttribute('role','presentation'); slot.setAttribute('tabindex','-1');
    slot.dataset.ghost3dReady = 'false'; slot.dataset.ghost3dGeneration = String(xiangqiGhost3DGeneration);
    slot.dataset.domCueActive = selected || xiangqiKeyboardMode ? 'true' : 'false';
    slot.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;';
    xiangqiGhost3DSlot = slot;
    xiangqiWaveCBoard.appendChild(slot);
    return slot;
  }
  function xiangqiGhost3DCurrent(generation){
    return xiangqiGhost3DActive && !destroyed && !opts.destroyed && !!xiangqiGhost3DSlot && generation === xiangqiGhost3DGeneration;
  }
  function xiangqiGhost3DNextAdapterEpoch(){
    xiangqiGhost3DAdapterEpoch++;
    return xiangqiGhost3DAdapterEpoch;
  }
  function xiangqiGhost3DAdapterCurrent(generation, adapterEpoch){
    return xiangqiGhost3DCurrent(generation) && adapterEpoch === xiangqiGhost3DAdapterEpoch;
  }
  function xiangqiGhost3DSetReady(ready, generation){
    if (!xiangqiGhost3DCurrent(generation)) return false;
    const value = ready === true ? 'true' : 'false';
    xiangqiGhost3DSlot.dataset.ghost3dReady = value;
    if (xiangqiWaveCBoard && xiangqiWaveCBoard.dataset) xiangqiWaveCBoard.dataset.ghost3dReady = value;
    return ready === true;
  }
  function xiangqiGhost3DHostFailed(generation){
    if (!xiangqiGhost3DCurrent(generation)) return false;
    // Foundation has switched to its own fallback.  Expire callbacks from the
    // failed adapter before any delayed ready/error/context notification can
    // revive this host.
    xiangqiGhost3DNextAdapterEpoch();
    xiangqiGhost3DPendingMotion = null;
    xiangqiGhost3DSetReady(false, generation);
    if (over) scheduleXiangqiOutcome(false);
    return true;
  }
  function xiangqiGhost3DAdapterFailed(generation, adapterEpoch){
    if (!xiangqiGhost3DAdapterCurrent(generation, adapterEpoch)) return false;
    xiangqiGhost3DNextAdapterEpoch();
    xiangqiGhost3DPendingMotion = null;
    xiangqiGhost3DSetReady(false, generation);
    if (over) scheduleXiangqiOutcome(false);
    return true;
  }
  function xiangqiGhost3DReducedMotion(){
    try { if (typeof prefersReducedMotion === 'function') return !!prefersReducedMotion(); } catch (_error) {}
    return !!(xiangqiGhost3DMediaQuery && xiangqiGhost3DMediaQuery.matches);
  }
  // Outcome presentation is deliberately separate from Rule/Replay completion:
  // the authoritative result is reported immediately, while a ready animated
  // renderer may briefly hold only the visual victory surface for its finite
  // result beat.  If the optional island is absent or fails, the surface is
  // revealed immediately through the permanent DOM path.
  function clearXiangqiOutcomeTimer(){
    if (xiangqiOutcomeTimer !== null) clearTimeout(xiangqiOutcomeTimer);
    xiangqiOutcomeTimer = null;
    xiangqiOutcomeScheduled = false;
    xiangqiOutcomeVisible = false;
    xiangqiOutcomePending = null;
  }
  function revealXiangqiOutcome(){
    xiangqiOutcomeTimer = null;
    xiangqiOutcomeScheduled = false;
    if (destroyed || opts.destroyed || !over || xiangqiOutcomeVisible || typeof xiangqiOutcomePending !== 'function') return false;
    const present = xiangqiOutcomePending;
    xiangqiOutcomePending = null;
    xiangqiOutcomeVisible = true;
    try { present(); } catch (_error) {}
    return true;
  }
  function scheduleXiangqiOutcome(rendererCanAnimate){
    if (destroyed || opts.destroyed || !over || xiangqiOutcomeVisible || typeof xiangqiOutcomePending !== 'function' || xiangqiOutcomeScheduled) return false;
    // null means the active optional island is still importing; wait for its
    // first accepted terminal frame or an explicit failure callback.
    if (rendererCanAnimate === null && xiangqiGhost3DActive && xiangqiGhost3DSlot &&
        xiangqiGhost3DSlot.dataset && xiangqiGhost3DSlot.dataset.ghost3dReady !== 'true') return false;
    const quality = xiangqiGhost3DInitialQuality();
    const ready = rendererCanAnimate === true && xiangqiGhost3DActive && xiangqiGhost3DSlot &&
      xiangqiGhost3DSlot.dataset && xiangqiGhost3DSlot.dataset.ghost3dReady === 'true' &&
      !xiangqiGhost3DReducedMotion() && quality !== 'LOW';
    const delay = ready ? (quality === 'HIGH' ? 420 : 320) : 0;
    if (delay <= 0) return revealXiangqiOutcome();
    xiangqiOutcomeScheduled = true;
    const outcomeEpoch = motionEpoch;
    xiangqiOutcomeTimer = setTimeout(() => {
      xiangqiOutcomeTimer = null;
      if (outcomeEpoch === motionEpoch) revealXiangqiOutcome();
    }, delay);
    if (xiangqiOutcomeTimer && typeof xiangqiOutcomeTimer.unref === 'function') xiangqiOutcomeTimer.unref();
    return true;
  }
  function queueXiangqiOutcome(present){
    if (!over || xiangqiOutcomeVisible || typeof present !== 'function') return false;
    xiangqiOutcomePending = present;
    if (!xiangqiGhost3DActive || !xiangqiGhost3DSlot) return scheduleXiangqiOutcome(false);
    if (xiangqiGhost3DSlot.dataset && xiangqiGhost3DSlot.dataset.ghost3dReady === 'true') return scheduleXiangqiOutcome(true);
    // Leave the callback pending until the bridge publishes the terminal frame
    // or explicitly enters fallback. This avoids a result dialog racing the
    // first ready frame during a lazy import.
    return true;
  }
  function xiangqiGhost3DFactory(){
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
    const factory = root && root.Ghost3DFoundation;
    return factory && typeof factory.create === 'function' ? factory : null;
  }
  function xiangqiGhost3DListen(target, type, handler, options){
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler, options);
    xiangqiGhost3DListeners.push({ target, type, handler, options, legacy:false });
  }
  function xiangqiGhost3DListenLegacy(target, type, handler){
    if (!target || typeof target.addListener !== 'function') return;
    target.addListener(handler);
    xiangqiGhost3DListeners.push({ target, type, handler, legacy:true });
  }
  function releaseXiangqiGhost3DListeners(){
    xiangqiGhost3DListeners.forEach(listener => {
      if (!listener || !listener.target) return;
      if (listener.legacy && typeof listener.target.removeListener === 'function') listener.target.removeListener(listener.handler);
      else if (!listener.legacy && typeof listener.target.removeEventListener === 'function') listener.target.removeEventListener(listener.type, listener.handler, listener.options);
    });
    xiangqiGhost3DListeners = [];
    xiangqiGhost3DMediaQuery = null;
  }
  function applyXiangqiGhost3DLifecycle(action, reason){
    const host = xiangqiGhost3DHost;
    if (!host || typeof host.apply !== 'function') return false;
    try { return !!host.apply({ type:'lifecycle', action, reason }); } catch (_error) { return false; }
  }
  function installXiangqiGhost3DListeners(){
    if (!xiangqiGhost3DActive || xiangqiGhost3DListeners.length) return;
    const doc = typeof document !== 'undefined' ? document : null;
    const root = typeof window !== 'undefined' ? window : null;
    xiangqiGhost3DListen(doc, 'visibilitychange', () => {
      applyXiangqiGhost3DLifecycle(doc && doc.hidden ? 'hidden' : 'visible', 'document');
    });
    xiangqiGhost3DListen(root, 'ghostgame:shellchange', event => {
      const detail = event && event.detail ? event.detail : null;
      applyXiangqiGhost3DLifecycle(detail && detail.active === true && detail.gameId === 'xiangqi' ? 'resume' : 'suspend', 'shell');
    });
    try { xiangqiGhost3DMediaQuery = root && typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-reduced-motion: reduce)') : null; }
    catch (_error){ xiangqiGhost3DMediaQuery = null; }
    if (xiangqiGhost3DMediaQuery){
      const onChange = event => {
        const host = xiangqiGhost3DHost;
        if (!host || typeof host.apply !== 'function') return;
        const reducedMotion = !!(event && typeof event.matches === 'boolean' ? event.matches : xiangqiGhost3DMediaQuery.matches);
        if (reducedMotion) xiangqiGhost3DPendingMotion = null;
        try { host.apply({ type:'environment', reducedMotion }); } catch (_error) {}
      };
      if (typeof xiangqiGhost3DMediaQuery.addEventListener === 'function') xiangqiGhost3DListen(xiangqiGhost3DMediaQuery, 'change', onChange);
      else xiangqiGhost3DListenLegacy(xiangqiGhost3DMediaQuery, 'change', onChange);
    }
    if (doc && doc.hidden) applyXiangqiGhost3DLifecycle('hidden', 'document');
  }
  function publishXiangqiGhost3DFrame(generation){
    if (!xiangqiGhost3DCurrent(generation) || !xiangqiGhost3DHost || typeof xiangqiGhost3DHost.apply !== 'function') return false;
    const next = xiangqiGhost3DFrame();
    if (!next){
      xiangqiGhost3DPendingMotion = null;
      xiangqiGhost3DSetReady(false, generation);
      return false;
    }
    const fingerprint = JSON.stringify(next);
    if (fingerprint === xiangqiGhost3DLastFingerprint && !xiangqiGhost3DPendingMotion) return false;
    const revision = xiangqiGhost3DPresentationRevision + 1;
    if (!Number.isSafeInteger(revision)){
      xiangqiGhost3DPendingMotion = null;
      xiangqiGhost3DSetReady(false, generation);
      return false;
    }
    const frame = xiangqiGhost3DFreeze({ ...next, revision });
    let result = null;
    try { result = xiangqiGhost3DHost.apply({ type:'frame', frame }); } catch (_error) {}
    if (!result || result.accepted !== true){
      xiangqiGhost3DPendingMotion = null;
      return false;
    }
    xiangqiGhost3DPresentationRevision = revision;
    xiangqiGhost3DLastFingerprint = fingerprint;
    const motion = xiangqiGhost3DPendingMotion;
    xiangqiGhost3DPendingMotion = null;
    let hostSnapshot = null;
    try { hostSnapshot = typeof xiangqiGhost3DHost.snapshot === 'function' ? xiangqiGhost3DHost.snapshot() : null; } catch (_error) {}
    const rendererCanAnimate = !hostSnapshot || (!hostSnapshot.suspended && hostSnapshot.usingFallback !== true && hostSnapshot.adapterReady !== false);
    const finiteRendererBeat = rendererCanAnimate && xiangqiGhost3DInitialQuality() !== 'LOW' && !xiangqiGhost3DReducedMotion();
    if (motion && motion.generation === generation && (motion.source === 'local' || motion.source === 'live') && !frame.terminal &&
        xiangqiGhost3DInitialQuality() !== 'LOW' && !xiangqiGhost3DReducedMotion() &&
        rendererCanAnimate){
      const event = {
        type:'piece_moved', revision, player:motion.player, from:motion.from.slice(), to:motion.to.slice(), capture:motion.capture === true,
        check:frame.check === true,
        eventId:generation + ':' + revision + ':' + motion.player + ':' + motion.from.join(',') + ':' + motion.to.join(','),
      };
      try { xiangqiGhost3DHost.apply({ type:'motion', event }); } catch (_error) {}
    }
    if (frame.terminal) {
      if (finiteRendererBeat) {
        const event = {
          type:'terminal', revision, winner:frame.winner, outcome:frame.winner >= 0 ? 'win' : 'draw',
          eventId:generation + ':' + revision + ':terminal',
        };
        try { xiangqiGhost3DHost.apply({ type:'motion', event }); } catch (_error) {}
      }
      scheduleXiangqiOutcome(finiteRendererBeat);
    }
    return true;
  }
  function queueXiangqiGhost3DFrame(){
    if (!xiangqiGhost3DActive || !xiangqiGhost3DHost || xiangqiGhost3DQueued || destroyed || opts.destroyed) return;
    const generation = xiangqiGhost3DGeneration;
    xiangqiGhost3DQueued = true;
    Promise.resolve().then(() => {
      xiangqiGhost3DQueued = false;
      publishXiangqiGhost3DFrame(generation);
    });
  }
  function xiangqiGhost3DContextLost(reason, generation, adapterEpoch){
    if (!xiangqiGhost3DAdapterCurrent(generation, adapterEpoch) || !xiangqiGhost3DHost || typeof xiangqiGhost3DHost.apply !== 'function') return false;
    xiangqiGhost3DNextAdapterEpoch();
    xiangqiGhost3DPendingMotion = null;
    xiangqiGhost3DSetReady(false, generation);
    let result = null;
    try { result = xiangqiGhost3DHost.apply({ type:'context-lost', reason:typeof reason === 'string' ? reason.slice(0,96) : 'renderer' }); } catch (_error) {}
    queueXiangqiGhost3DRecovery();
    return result;
  }
  function xiangqiGhost3DSupported(module){
    if (!module || typeof module.isXiangqi3DSupported !== 'function') return false;
    try { return module.isXiangqi3DSupported() === true; } catch (_error) { return false; }
  }
  function xiangqiGhost3DCreateAdapter(module, generation){
    const create = module && typeof module.createXiangqi3DAdapter === 'function' ? module.createXiangqi3DAdapter : null;
    if (!create || !xiangqiGhost3DCurrent(generation)) return null;
    const adapterEpoch = xiangqiGhost3DNextAdapterEpoch();
    try {
      return create({
        mountElement:xiangqiGhost3DSlot,
        onContextLost:reason => xiangqiGhost3DContextLost(reason, generation, adapterEpoch),
        onError:() => xiangqiGhost3DAdapterFailed(generation, adapterEpoch),
        onReady:() => xiangqiGhost3DAdapterCurrent(generation, adapterEpoch) && xiangqiGhost3DSetReady(!opts.online || !!xiangqiGhost3DOnlineState, generation),
        quality:xiangqiGhost3DInitialQuality(),
        reducedMotion:xiangqiGhost3DReducedMotion(),
      });
    } catch (_error) { return null; }
  }
  function queueXiangqiGhost3DRecovery(){
    if (!xiangqiGhost3DActive || xiangqiGhost3DRecoverQueued || !xiangqiGhost3DModule || !xiangqiGhost3DHost) return;
    const generation = xiangqiGhost3DGeneration;
    xiangqiGhost3DRecoverQueued = true;
    Promise.resolve().then(() => {
      xiangqiGhost3DRecoverQueued = false;
      if (!xiangqiGhost3DCurrent(generation) || !xiangqiGhost3DHost || !xiangqiGhost3DSupported(xiangqiGhost3DModule)) return;
      const adapter = xiangqiGhost3DCreateAdapter(xiangqiGhost3DModule, generation);
      const adapterEpoch = xiangqiGhost3DAdapterEpoch;
      if (!adapter) return;
      let result = null;
      try { result = xiangqiGhost3DHost.apply({ type:'recover', adapter }); } catch (_error) {}
      if (!result || result.accepted !== true){
        if (xiangqiGhost3DAdapterCurrent(generation, adapterEpoch)) xiangqiGhost3DNextAdapterEpoch();
        try { if (typeof adapter.dispose === 'function') adapter.dispose(); } catch (_error) {}
        xiangqiGhost3DSetReady(false, generation);
      } else queueXiangqiGhost3DFrame();
    });
  }
  function loadXiangqiGhost3DModule(){
    if (!xiangqiGhost3DActive || !xiangqiGhost3DHost || !xiangqiGhost3DSlot || destroyed || opts.destroyed) return;
    if (xiangqiGhost3DModule){ queueXiangqiGhost3DRecovery(); return; }
    if (xiangqiGhost3DImportPending) return;
    const generation = xiangqiGhost3DGeneration;
    xiangqiGhost3DImportPending = true;
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
    const GameModuleLoader = root && root.GameModuleLoader;
    if (!GameModuleLoader || typeof GameModuleLoader.load !== 'function') {
      xiangqiGhost3DImportPending = false;
      if (xiangqiGhost3DCurrent(generation)) xiangqiGhost3DSetReady(false, generation);
      return;
    }
    try { if (typeof GameModuleLoader.prefetch === 'function') GameModuleLoader.prefetch('xiangqi'); } catch (_error) {}
    Promise.resolve(GameModuleLoader.load('xiangqi', { resource:'renderer' })).then(result => {
      xiangqiGhost3DImportPending = false;
      if (destroyed || opts.destroyed || !xiangqiGhost3DSlot) return;
      const module = result && result.ok === true ? result.module : null;
      if (!module) {
        if (xiangqiGhost3DCurrent(generation)) xiangqiGhost3DSetReady(false, generation);
        return;
      }
      xiangqiGhost3DModule = module;
      if (!xiangqiGhost3DCurrent(generation)){
        if (xiangqiGhost3DHost) loadXiangqiGhost3DModule();
        return;
      }
      if (xiangqiGhost3DSupported(module)) queueXiangqiGhost3DRecovery();
      else xiangqiGhost3DSetReady(false, generation);
    }).catch(() => {
      xiangqiGhost3DImportPending = false;
      if (xiangqiGhost3DCurrent(generation)) xiangqiGhost3DSetReady(false, generation);
    });
  }
  function restartXiangqiGhost3DHost(_reason, deferFrame){
    if (!xiangqiGhost3DActive || destroyed || opts.destroyed || !xiangqiGhost3DSlot) return false;
    const factory = xiangqiGhost3DFactory();
    if (!factory) return false;
    const previous = xiangqiGhost3DHost;
    const generation = ++xiangqiGhost3DGeneration;
    xiangqiGhost3DNextAdapterEpoch();
    xiangqiGhost3DPresentationRevision = 0;
    xiangqiGhost3DQueued = false;
    xiangqiGhost3DRecoverQueued = false;
    xiangqiGhost3DLastFingerprint = '';
    xiangqiGhost3DPendingMotion = null;
    xiangqiGhost3DSetReady(false, generation);
    if (previous && typeof previous.dispose === 'function'){
      try { previous.dispose(); } catch (_error) {}
    }
    try {
      xiangqiGhost3DHost = factory.create({
        quality:xiangqiGhost3DInitialQuality(),
        reducedMotion:xiangqiGhost3DReducedMotion(),
        onFailure:() => xiangqiGhost3DHostFailed(generation),
      });
    } catch (_error) {
      xiangqiGhost3DHost = null;
      return false;
    }
    if (!xiangqiGhost3DHost || typeof xiangqiGhost3DHost.apply !== 'function'){
      xiangqiGhost3DHost = null;
      return false;
    }
    xiangqiGhost3DSlot.dataset.ghost3dGeneration = String(generation);
    installXiangqiGhost3DListeners();
    loadXiangqiGhost3DModule();
    if (!deferFrame) queueXiangqiGhost3DFrame();
    return true;
  }
  function disposeXiangqiGhost3DBridge(){
    xiangqiGhost3DGeneration++;
    xiangqiGhost3DNextAdapterEpoch();
    xiangqiGhost3DQueued = false;
    xiangqiGhost3DRecoverQueued = false;
    xiangqiGhost3DPendingMotion = null;
    xiangqiGhost3DOnlineState = null;
    xiangqiGhost3DLocalLastMove = null;
    xiangqiGhost3DLastFingerprint = '';
    const host = xiangqiGhost3DHost;
    xiangqiGhost3DHost = null;
    if (host && typeof host.dispose === 'function'){
      try { host.dispose(); } catch (_error) {}
    }
    releaseXiangqiGhost3DListeners();
    if (xiangqiGhost3DSlot){
      xiangqiGhost3DSlot.dataset.ghost3dReady = 'false';
      if (typeof xiangqiGhost3DSlot.remove === 'function') xiangqiGhost3DSlot.remove();
      else if (xiangqiGhost3DSlot.parentNode && typeof xiangqiGhost3DSlot.parentNode.removeChild === 'function') xiangqiGhost3DSlot.parentNode.removeChild(xiangqiGhost3DSlot);
    }
    if (xiangqiWaveCBoard && xiangqiWaveCBoard.dataset) delete xiangqiWaveCBoard.dataset.ghost3dReady;
    xiangqiGhost3DSlot = null;
  }
  function xiangqiGhost3DPrepareBoardRebuild(){
    const enabled = xiangqiGhost3DEnabled();
    if (!enabled){
      const active = xiangqiGhost3DActive || !!xiangqiGhost3DHost || !!xiangqiGhost3DSlot || xiangqiGhost3DListeners.length > 0;
      xiangqiGhost3DActive = false;
      if (active) disposeXiangqiGhost3DBridge();
      return null;
    }
    xiangqiGhost3DActive = true;
    const slot = xiangqiGhost3DSlot;
    if (slot && slot.parentNode && typeof slot.parentNode.removeChild === 'function') slot.parentNode.removeChild(slot);
    return slot || null;
  }
  function xiangqiGhost3DAdoptBoardSlot(boardEl, slot){
    if (!slot || !boardEl || typeof boardEl.appendChild !== 'function') return false;
    boardEl.appendChild(slot);
    xiangqiGhost3DSlot = slot;
    return true;
  }
  function syncXiangqiGhost3DDomCue(){
    if (!xiangqiGhost3DSlot || !xiangqiGhost3DSlot.dataset) return false;
    const active = !!selected || xiangqiKeyboardMode === true;
    xiangqiGhost3DSlot.dataset.domCueActive = active ? 'true' : 'false';
    return active;
  }
  function syncXiangqiGhost3DBridge(){
    const enabled = xiangqiGhost3DEnabled();
    if (!enabled){
      const active = xiangqiGhost3DActive || !!xiangqiGhost3DHost || !!xiangqiGhost3DSlot || xiangqiGhost3DListeners.length > 0;
      xiangqiGhost3DActive = false;
      if (active) disposeXiangqiGhost3DBridge();
      return false;
    }
    xiangqiGhost3DActive = true;
    const slot = mountXiangqiGhost3DSlot() || xiangqiGhost3DSlot;
    if (!slot) return false;
    syncXiangqiGhost3DDomCue();
    // An online renderer is intentionally unmounted until a full raw
    // authority projection exists; it must never render the optimistic DOM.
    if (opts.online && !xiangqiGhost3DOnlineState){
      xiangqiGhost3DSetReady(false, xiangqiGhost3DGeneration);
      return false;
    }
    if (!xiangqiGhost3DHost) restartXiangqiGhost3DHost('mount');
    else queueXiangqiGhost3DFrame();
    return !!xiangqiGhost3DHost;
  }
  function xiangqiGhost3DFailClosedOnline(){
    if (!xiangqiGhost3DHost || typeof xiangqiGhost3DHost.apply !== 'function') return false;
    const generation = xiangqiGhost3DGeneration;
    if (!xiangqiGhost3DCurrent(generation)) return false;
    xiangqiGhost3DNextAdapterEpoch();
    xiangqiGhost3DPendingMotion = null;
    xiangqiGhost3DSetReady(false, generation);
    if (over) scheduleXiangqiOutcome(false);
    try { xiangqiGhost3DHost.apply({ type:'context-lost', reason:'invalid-authority' }); } catch (_error) {}
    return false;
  }
  function xiangqiGhost3DObserveRuleState(value, source){
    const next = xiangqiGhost3DReadRuleState(value, source);
    if (!next){
      if (xiangqiGhost3DActive) xiangqiGhost3DFailClosedOnline();
      return null;
    }
    if (!xiangqiGhost3DEnabled()){
      syncXiangqiGhost3DBridge();
      return null;
    }
    const previous = xiangqiGhost3DOnlineState;
    if (source === 'live' && previous && previous.origin.matchId === next.origin.matchId && next.origin.authorityRevision <= previous.origin.authorityRevision) return null;
    const freshGeneration = source !== 'live' || !previous || previous.origin.matchId !== next.origin.matchId || (previous.terminal && !next.terminal);
    const motion = freshGeneration ? null : xiangqiGhost3DOnlineMotion(previous, next, source);
    xiangqiGhost3DOnlineState = next;
    if (freshGeneration){
      xiangqiGhost3DPendingMotion = null;
      if (xiangqiGhost3DHost) restartXiangqiGhost3DHost('online-' + source, true);
      else syncXiangqiGhost3DBridge();
    } else {
      xiangqiGhost3DPendingMotion = motion ? { ...motion, source:'live', generation:xiangqiGhost3DGeneration } : null;
      syncXiangqiGhost3DBridge();
      queueXiangqiGhost3DRecovery();
    }
    return next;
  }
  function xiangqiGhost3DPrepareLocalReset(reason){
    xiangqiGhost3DOnlineState = null;
    xiangqiGhost3DLocalLastMove = null;
    xiangqiGhost3DPendingMotion = null;
    if (!xiangqiGhost3DEnabled()){
      xiangqiGhost3DActive = false;
      if (xiangqiGhost3DHost || xiangqiGhost3DSlot || xiangqiGhost3DListeners.length) disposeXiangqiGhost3DBridge();
      return;
    }
    xiangqiGhost3DActive = true;
    if (xiangqiGhost3DHost) restartXiangqiGhost3DHost(reason || 'reset', true);
  }
  function xiangqiGhost3DPrepareRestore(){
    xiangqiGhost3DPendingMotion = null;
    if (opts.online) xiangqiGhost3DOnlineState = null;
    if (!xiangqiGhost3DEnabled()){
      xiangqiGhost3DActive = false;
      if (xiangqiGhost3DHost || xiangqiGhost3DSlot || xiangqiGhost3DListeners.length) disposeXiangqiGhost3DBridge();
      return;
    }
    xiangqiGhost3DActive = true;
    if (xiangqiGhost3DHost) restartXiangqiGhost3DHost('restore', true);
  }
  function xiangqiGhost3DQueueCommittedLocalMove(player, from, to, captured){
    if (opts.online || over || xiangqiGhost3DReducedMotion() || xiangqiGhost3DInitialQuality() === 'LOW'){
      xiangqiGhost3DPendingMotion = null;
      return false;
    }
    syncXiangqiGhost3DBridge();
    if (!xiangqiGhost3DHost) return false;
    xiangqiGhost3DPendingMotion = { type:'piece_moved', player, from:from.slice(), to:to.slice(), capture:!!captured, source:'local', generation:xiangqiGhost3DGeneration };
    queueXiangqiGhost3DFrame();
    return true;
  }
  function renderAux(){
    clockHud.innerHTML = '';
    for (let i = 0; i < 2; i++){
      const chip = el('span','xiangqi-clock' + (i === cur && !over ? ' active' : ''), t(i===0?'xiangqi_red_side':'xiangqi_black_side')+' '+formatClock(clockRemaining[i]));
      chip.style.cssText = 'display:inline-flex;margin:3px;padding:6px 10px;border-radius:999px;background:' + (i === cur && !over ? 'var(--accent)' : 'var(--card)') + ';color:' + (i === cur && !over ? '#fff' : 'var(--text)') + ';font-weight:800;';
      clockHud.appendChild(chip);
    }
    capturedHud.textContent = t('xiangqi_captured_summary',capturedPieces[0].length?capturedPieces[0].map(xiangqiCapturedName).join(' '):'—',capturedPieces[1].length?capturedPieces[1].map(xiangqiCapturedName).join(' '):'—');
    capturedHud.style.cssText = 'text-align:center;font-size:12px;color:var(--muted);margin:4px 0 8px;';
  }
  function initBoard(){
    board = Array.from({length:ROWS}, () => Array(COLS).fill(null));
    const setup = [
      ['r','h','e','a','k','a','e','h','r'],
      [null,null,null,null,null,null,null,null,null],
      [null,'c',null,null,null,null,null,'c',null],
      ['p',null,'p',null,'p',null,'p',null,'p'],
      [null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null],
      ['p',null,'p',null,'p',null,'p',null,'p'],
      [null,'c',null,null,null,null,null,'c',null],
      [null,null,null,null,null,null,null,null,null],
      ['r','h','e','a','k','a','e','h','r'],
    ];
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const t = setup[r][c];
        if (t) board[r][c] = { p: r < 5 ? 1 : 0, t };
      }
    }
  }
  function inPalace(r, c, p){
    return c >= 3 && c <= 5 && (p === 1 ? (r >= 0 && r <= 2) : (r >= 7 && r <= 9));
  }
  function findKing(p){
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      if (board[r][c] && board[r][c].p === p && board[r][c].t === 'k') return [r,c];
    }
    return null;
  }
  function isCheck(p){
    const k = findKing(p);
    if (!k) return true;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const piece = board[r][c];
      if (piece && piece.p !== p){
        if (movesOf(piece.p, r, c).some(([mr,mc]) => mr === k[0] && mc === k[1])) return true;
      }
    }
    return false;
  }
  function movesOf(p, r, c){
    const piece = board[r][c];
    if (!piece || piece.p !== p) return [];
    const res = [];
    const oppKing = findKing(p ^ 1);
    const canMoveTo = (nr, nc) => {
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
      if (board[nr][nc] && board[nr][nc].p === p) return false;
      return true;
    };
    if (piece.t === 'k'){
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const nr = r+dr, nc = c+dc;
        if (inPalace(nr, nc, p) && canMoveTo(nr,nc)) res.push([nr,nc]);
      }
      // 飞将
      if (oppKing && oppKing[1] === c){
        let blocked = false;
        for (let rr = Math.min(r, oppKing[0]) + 1; rr < Math.max(r, oppKing[0]); rr++){
          if (board[rr][c]){ blocked = true; break; }
        }
        if (!blocked) res.push(oppKing);
      }
    } else if (piece.t === 'a'){
      for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
        const nr = r+dr, nc = c+dc;
        if (inPalace(nr, nc, p) && canMoveTo(nr,nc)) res.push([nr,nc]);
      }
    } else if (piece.t === 'e'){
      for (const [dr,dc] of [[-2,-2],[-2,2],[2,-2],[2,2]]){
        const nr = r+dr, nc = c+dc;
        const eye = [r+dr/2, c+dc/2];
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const cross = p === 1 ? nr <= 4 : nr >= 5;
        if (!cross) continue;
        if (board[eye[0]][eye[1]]) continue;
        if (canMoveTo(nr,nc)) res.push([nr,nc]);
      }
    } else if (piece.t === 'h'){
      const legs = [[[-1,0],[-2,-1]],[[-1,0],[-2,1]],[[1,0],[2,-1]],[[1,0],[2,1]],[[0,-1],[-1,-2]],[[0,-1],[1,-2]],[[0,1],[-1,2]],[[0,1],[1,2]]];
      for (const [leg, step] of legs){
        const lr = r+leg[0], lc = c+leg[1];
        const nr = r+step[0], nc = c+step[1];
        if (!canMoveTo(nr,nc)) continue;
        if (board[lr][lc]) continue;
        res.push([nr,nc]);
      }
    } else if (piece.t === 'r'){
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        let nr = r+dr, nc = c+dc;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS){
          if (!board[nr][nc]){ res.push([nr,nc]); }
          else { if (board[nr][nc].p !== p) res.push([nr,nc]); break; }
          nr += dr; nc += dc;
        }
      }
    } else if (piece.t === 'c'){
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        let nr = r+dr, nc = c+dc, screen = false;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS){
          if (!screen){
            if (!board[nr][nc]) res.push([nr,nc]);
            else screen = true;
          } else {
            if (board[nr][nc]){
              if (board[nr][nc].p !== p) res.push([nr,nc]);
              break;
            }
          }
          nr += dr; nc += dc;
        }
      }
    } else if (piece.t === 'p'){
      const fwd = p === 1 ? 1 : -1;
      const nr = r + fwd;
      if (nr >= 0 && nr < ROWS && canMoveTo(nr, c)) res.push([nr, c]);
      if ((p === 1 && r >= 5) || (p === 0 && r <= 4)){
        for (const dc of [-1,1]){
          if (canMoveTo(r, c+dc)) res.push([r, c+dc]);
        }
      }
    }
    return res;
  }
  function legalMovesOf(p, r, c){
    if(ruleAuthority&&typeof XiangqiRules!=='undefined')return XiangqiRules.legalMovesForPiece({protocol:RULE_PROTOCOL,board:board.map(row=>row.map(piece=>piece?{...piece}:null)),current:cur,terminal:over},p,r,c);
    return movesOf(p, r, c).filter(([nr,nc]) => {
      const from = board[r][c], to = board[nr][nc];
      board[r][c] = null; board[nr][nc] = from;
      const bad = isCheck(p);
      board[r][c] = from; board[nr][nc] = to;
      return !bad;
    });
  }
  const XQ_VALUE = { p:100, a:250, e:260, h:470, c:500, r:1000, k:30000 };
  const XQ_MATE = 10000000;
  function xqPieceSquare(piece, r, c){
    const forward = piece.p === 0 ? 9 - r : r;
    const center = 4 - Math.abs(c - 4);
    const middleRank = 4.5 - Math.abs(r - 4.5);
    if (piece.t === 'p') return forward * 7 + center * (forward >= 5 ? 5 : 2) + (forward >= 5 ? 28 : 0);
    if (piece.t === 'h') return center * 10 + middleRank * 5 - ((c === 0 || c === 8) ? 18 : 0);
    if (piece.t === 'c') return center * 5 + middleRank * 3 + (forward >= 2 && forward <= 7 ? 10 : 0);
    if (piece.t === 'r') return center * 3 + middleRank * 2 + forward;
    if (piece.t === 'a') return c === 4 ? 14 : 8;
    if (piece.t === 'e') return center * 2 + (forward <= 4 ? 8 : 0);
    if (piece.t === 'k') return -Math.abs(c - 4) * 12 - forward * 5;
    return 0;
  }
  function xqAllLegal(p){
    const all = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const piece = board[r][c];
      if (!piece || piece.p !== p) continue;
      legalMovesOf(p, r, c).forEach(to => all.push({ from:[r,c], to }));
    }
    return all;
  }
  function xqMakeMove(move){
    const piece = board[move.from[0]][move.from[1]];
    const captured = board[move.to[0]][move.to[1]];
    board[move.from[0]][move.from[1]] = null;
    board[move.to[0]][move.to[1]] = piece;
    return captured;
  }
  function xqUndoMove(move, captured){
    board[move.from[0]][move.from[1]] = board[move.to[0]][move.to[1]];
    board[move.to[0]][move.to[1]] = captured;
  }
  function xqMoveKey(move){ return move.from.join(',') + '>' + move.to.join(','); }
  function xqMoveOrderScore(move){
    const piece = board[move.from[0]][move.from[1]];
    const target = board[move.to[0]][move.to[1]];
    if (!piece) return -Infinity;
    const capture = target ? (target.t === 'k' ? XQ_MATE : XQ_VALUE[target.t] * 12 - XQ_VALUE[piece.t]) : 0;
    return capture + xqPieceSquare(piece, move.to[0], move.to[1]) - xqPieceSquare(piece, move.from[0], move.from[1]);
  }
  function xqOrderedMoves(p, limit, capturesOnly){
    let moves = xqAllLegal(p);
    if (capturesOnly) moves = moves.filter(move => !!board[move.to[0]][move.to[1]]);
    moves.forEach(move => { move.order = xqMoveOrderScore(move); });
    moves.sort((a, b) => b.order - a.order || xqMoveKey(a).localeCompare(xqMoveKey(b)));
    return limit ? moves.slice(0, limit) : moves;
  }
  // 确定性局面评估：子力、位置、机动性、王区守卫/压力与将军状态。
  function xqEvaluate(perspective){
    const kings = [findKing(0), findKing(1)];
    if (!kings[perspective]) return -XQ_MATE;
    if (!kings[perspective ^ 1]) return XQ_MATE;
    const score = [0, 0], pressure = [0, 0];
    const mobilityWeight = { p:1, a:1, e:1, h:3, c:2, r:2, k:1 };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const piece = board[r][c];
      if (!piece) continue;
      const moves = movesOf(piece.p, r, c);
      score[piece.p] += XQ_VALUE[piece.t] + xqPieceSquare(piece, r, c) + moves.length * mobilityWeight[piece.t];
      const enemyKing = kings[piece.p ^ 1];
      if (enemyKing){
        for (const [mr, mc] of moves){
          const distance = Math.abs(mr - enemyKing[0]) + Math.abs(mc - enemyKing[1]);
          if (distance <= 1) pressure[piece.p] += distance ? 1 : 4;
        }
      }
    }
    for (let p = 0; p < 2; p++){
      const king = kings[p];
      let guards = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++){
        if (!dr && !dc) continue;
        const r = king[0] + dr, c = king[1] + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] && board[r][c].p === p) guards++;
      }
      score[p] += guards * 15 - pressure[p ^ 1] * 13;
      if (isCheck(p)) score[p] -= 190;
    }
    return score[perspective] - score[perspective ^ 1];
  }
  function xqBudgetExceeded(control){
    control.nodes++;
    if (control.nodes > control.maxNodes || Date.now() >= control.deadline){ control.stopped = true; return true; }
    return false;
  }
  function xqQuiescence(side, alpha, beta, qDepth, ply, control){
    if (xqBudgetExceeded(control)) return xqEvaluate(side);
    if (!findKing(side)) return -XQ_MATE + ply;
    if (!findKing(side ^ 1)) return XQ_MATE - ply;
    const checked = isCheck(side);
    const stand = xqEvaluate(side);
    if (!checked){
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (qDepth <= 0) return alpha;
    } else if (qDepth < 0){
      return stand;
    }
    const moves = xqOrderedMoves(side, checked ? 20 : 9, !checked);
    if (!moves.length) return checked ? -XQ_MATE + ply : alpha;
    for (const move of moves){
      const captured = xqMakeMove(move);
      const score = captured && captured.t === 'k'
        ? XQ_MATE - ply
        : -xqQuiescence(side ^ 1, -beta, -alpha, qDepth - 1, ply + 1, control);
      xqUndoMove(move, captured);
      if (control.stopped) return alpha;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }
  function xqNegamax(side, depth, alpha, beta, ply, control){
    if (xqBudgetExceeded(control)) return xqEvaluate(side);
    if (!findKing(side)) return -XQ_MATE + ply;
    if (!findKing(side ^ 1)) return XQ_MATE - ply;
    if (depth <= 0) return xqQuiescence(side, alpha, beta, 1, ply, control);
    const checked = isCheck(side);
    const width = checked ? 24 : (depth >= 3 ? 12 : (depth === 2 ? 16 : 19));
    const moves = xqOrderedMoves(side, width, false);
    if (!moves.length) return -XQ_MATE + ply;
    let best = -Infinity;
    for (const move of moves){
      const captured = xqMakeMove(move);
      const score = captured && captured.t === 'k'
        ? XQ_MATE - ply
        : -xqNegamax(side ^ 1, depth - 1, -beta, -alpha, ply + 1, control);
      xqUndoMove(move, captured);
      if (control.stopped) return best > -Infinity ? best : xqEvaluate(side);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }
  function xqDifficultyProfile(difficulty, pieceCount){
    const id = difficulty && difficulty.id;
    if (id === 'easy') return { rootWidth:10, maxDepth:2, deadline:65, maxNodes:1600, candidates:4 };
    if (id === 'hard') return { rootWidth:36, maxDepth:pieceCount <= 12 ? 5 : 4, deadline:280, maxNodes:12000, candidates:12 };
    // 普通档延续当前迭代加深预算。
    return { rootWidth:28, maxDepth:pieceCount <= 12 ? 4 : 3, deadline:190, maxNodes:7200, candidates:8 };
  }
  function xqSearchRoot(side, difficulty){
    const all = xqOrderedMoves(side, 0, false);
    if (!all.length) return [];
    const fallback = [];
    for (const move of all){
      const captured = xqMakeMove(move);
      const givesCheck = !!findKing(side ^ 1) && isCheck(side ^ 1);
      const score = captured && captured.t === 'k' ? XQ_MATE : xqEvaluate(side) + (givesCheck ? 26 : 0);
      xqUndoMove(move, captured);
      fallback.push({ move, score, givesCheck, captured, order:move.order });
    }
    fallback.sort((a, b) => b.score - a.score || b.order - a.order || xqMoveKey(a.move).localeCompare(xqMoveKey(b.move)));
    const pieceCount = board.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    const profile = xqDifficultyProfile(difficulty, pieceCount);
    let completed = fallback.slice(0, profile.rootWidth);
    const control = { deadline:Date.now() + profile.deadline, nodes:0, maxNodes:profile.maxNodes, stopped:false };
    for (let depth = 2; depth <= profile.maxDepth; depth++){
      const iteration = [];
      control.stopped = false;
      for (const base of completed){
        if (Date.now() >= control.deadline || control.nodes >= control.maxNodes){ control.stopped = true; break; }
        const move = base.move;
        const captured = xqMakeMove(move);
        const score = captured && captured.t === 'k'
          ? XQ_MATE
          : -xqNegamax(side ^ 1, depth - 1, -XQ_MATE, XQ_MATE, 1, control);
        xqUndoMove(move, captured);
        if (control.stopped) break;
        iteration.push({ move, score, givesCheck:base.givesCheck, captured:base.captured, order:base.order });
      }
      if (control.stopped || iteration.length !== completed.length) break;
      iteration.sort((a, b) => b.score - a.score || b.order - a.order || xqMoveKey(a.move).localeCompare(xqMoveKey(b.move)));
      completed = iteration;
    }
    return completed;
  }
  function xqBoardAIRanked(result, allMoveByChoice){
    if (!result || result.ok !== true || !Array.isArray(result.ranked)) return [];
    return result.ranked.map(item => {
      const move = item && allMoveByChoice.get(item.id);
      if (!move || !Number.isFinite(item.score)) return null;
      move.order = xqMoveOrderScore(move);
      const captured = xqMakeMove(move);
      const givesCheck = !!findKing(cur ^ 1) && isCheck(cur ^ 1);
      xqUndoMove(move, captured);
      return { move, score:item.score, givesCheck, captured, order:move.order };
    }).filter(Boolean);
  }
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    const gen = aiEpoch;
    const turn = cur;
    setStatus(t('ai_thinking'));
    setTimeout(async () => {
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn || !opts.ai.has(cur)){
        aiPending = false;
        return;
      }
      const difficulty = typeof aiDifficultyFromOptions === 'function' ? aiDifficultyFromOptions(opts) : { id:'hard' };
      const pieceCount = board.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
      const profile = xqDifficultyProfile(difficulty, pieceCount);
      const canonicalPosition = xiangqiBoardAIPosition();
      const requestStateKey = JSON.stringify({ board:canonicalPosition.board, cur, lastMove:canonicalPosition.lastMove, moveCount:canonicalPosition.moveCount });
      const allMoveByChoice = new Map(xqAllLegal(cur).map(item => [xqMoveKey(item), item]));
      let boardAIResult = null;
      // When enabled, the Worker/Kernel owns the expensive search. The old
      // xqSearchRoot path runs only when the bounded Board AI path is absent
      // or fails, so opt-in does not duplicate the same search on main.
      const boardAI = xiangqiBoardAIBrokerForTurn();
      const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
      const kernel = root && root.BoardAIKernel;
      if (boardAI && kernel && typeof kernel.hashPosition === 'function' && allMoveByChoice.size && allMoveByChoice.size <= 200){
        const positionHash = kernel.hashPosition('xiangqi', XIANGQI_BOARD_AI_RULES, canonicalPosition, cur);
        const legalCandidates = Array.from(allMoveByChoice.keys());
        if (typeof positionHash === 'string' && positionHash && legalCandidates.length){
          const requestId = 'xq-board-ai-' + (++xiangqiBoardAIRequestSeq);
          xiangqiBoardAIRequestId = requestId;
          try {
            boardAIResult = await boardAI.request({
              requestId,
              gameId:'xiangqi',
              rulesVersion:XIANGQI_BOARD_AI_RULES,
              solverVersion:typeof kernel.SOLVER_VERSION === 'string' ? kernel.SOLVER_VERSION : 'board-ai-kernel-v1',
              identity:XIANGQI_BOARD_AI_IDENTITY,
              matchGeneration:gen,
              turn:cur,
              positionHash,
              legalCandidates,
              difficulty:typeof difficulty.id === 'string' ? difficulty.id : 'normal',
              budgetMs:Number.isFinite(profile.deadline) ? Math.max(1, Math.min(500, Math.floor(profile.deadline))) : 100,
              position:canonicalPosition,
            });
          } catch (_error) { boardAIResult = null; }
          if (xiangqiBoardAIRequestId === requestId) xiangqiBoardAIRequestId = null;
        }
      }
      // Do not forward a cancelled/reset ticket into the existing remote
      // learning/candidate seam.  The Worker and remote paths share the same
      // generation/state fence, so a restore or destroy stops both branches.
      const workerStateKey = JSON.stringify({ board:board.map(row => row.map(item => item ? { p:item.p, t:item.t } : null)), cur, lastMove:lastMove ? { from:lastMove[0], to:lastMove[1] } : null, moveCount });
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn || workerStateKey !== requestStateKey){
        aiPending = false;
        return;
      }
      let ranked = xqBoardAIRanked(boardAIResult, allMoveByChoice);
      if (!ranked.length) ranked = xqSearchRoot(cur, difficulty);
      if (!ranked.length){ aiPending = false; lose(cur); return; }
      const best = ranked[0];
      const band = best.score >= XQ_MATE / 2 ? 1 : 48;
      const near = ranked.filter(item => item.score >= best.score - band).slice(0, profile.candidates)
        .sort((a, b) => b.score - a.score || xqMoveKey(a.move).localeCompare(xqMoveKey(b.move)));
      const choices = near.map(item => xqMoveKey(item.move));
      const moveByChoice = new Map(near.map(item => [xqMoveKey(item.move), item.move]));
      const learningCandidates = near.map(item => ({ choice:xqMoveKey(item.move), features:{
        quality:Math.max(-1, Math.min(1, 1 - Math.max(0, best.score - item.score) / Math.max(1, band))),
        search_value:Math.max(-1, Math.min(1, item.score / 1200)),
        capture_value:item.captured ? Math.min(1, XQ_VALUE[item.captured.t] / 1200) : 0,
        gives_check:item.givesCheck ? 1 : 0,
        move_order:Math.max(-1, Math.min(1, item.order / 1000)),
        search_depth:Math.min(1, profile.maxDepth / 5),
      } }));
      const remoteAllowed = typeof aiDifficultyAllowsRemote === 'function' ? aiDifficultyAllowsRemote(difficulty) : difficulty.id === 'hard';
      const remoteProfile = typeof aiDifficultyRequestProfile === 'function' ? aiDifficultyRequestProfile(difficulty) : { id:'teacher', difficulty:difficulty.id };
      // 候选会在所有难度中进入个性化学习；远端裁决仅能影响困难档。
      const remoteChoice = await aiChoose('xiangqi', {
        board: board.map(row => row.map(item => item ? (item.p + item.t) : '--')),
        turn: cur, inCheck: isCheck(cur), lastMove,
      }, choices, remoteProfile, learningCandidates);
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn ||
          JSON.stringify({ board:board.map(row => row.map(item => item ? { p:item.p, t:item.t } : null)), cur, lastMove:lastMove ? { from:lastMove[0], to:lastMove[1] } : null, moveCount }) !== requestStateKey){
        aiPending = false;
        return;
      }
      const localIndex = typeof aiDifficultyLocalChoiceIndex === 'function'
        ? aiDifficultyLocalChoiceIndex(difficulty, choices.length) : (difficulty.id === 'easy' ? Math.min(choices.length - 1, 1) : 0);
      const localChoice = choices[Math.max(0, localIndex)] || choices[0];
      const selectedChoice = remoteAllowed && moveByChoice.has(remoteChoice)
        ? remoteChoice
        : localChoice;
      const xqMv = allMoveByChoice.get(selectedChoice) || moveByChoice.get(selectedChoice);
      // Never trust a Worker/remote ID as an executable move.  Re-check the
      // current board and let doMove() perform the final authoritative Gate.
      if (!xqMv || !legalMovesOf(cur, xqMv.from[0], xqMv.from[1]).some(move => move[0] === xqMv.to[0] && move[1] === xqMv.to[1])){
        aiPending = false;
        return;
      }
      const executedChoice = xqMoveKey(xqMv);
      aiPending = false;
      aiSpeak(difficulty, 'think');
      if (opts.online && opts.ai && opts.ai.has(turn) && typeof opts.sendBotMove === 'function') opts.sendBotMove(turn, { from:xqMv.from, to:xqMv.to });
      if (doMove(xqMv.from, xqMv.to) && typeof confirmAIReady === 'function') {
        confirmAIReady('xiangqi', executedChoice);
      }
    }, 750);
  }
  function doMove(from, to){
    if (over || !Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2) return false;
    const coords = from.concat(to).map(Number);
    if (!coords.every(Number.isInteger)) return false;
    from = coords.slice(0, 2); to = coords.slice(2, 4);
    if (from[0] < 0 || from[0] >= ROWS || from[1] < 0 || from[1] >= COLS ||
        to[0] < 0 || to[0] >= ROWS || to[1] < 0 || to[1] >= COLS) return false;
    const piece = board[from[0]][from[1]];
    if (!piece || piece.p !== cur || !legalMovesOf(cur, from[0], from[1]).some(m => m[0] === to[0] && m[1] === to[1])) return false;
    syncClock();
    const captured = board[to[0]][to[1]];
    if (captured){
      capturedPieces[cur].push(captured.p === 0 ? PIECE[captured.t] : BLACK_PIECE[captured.t]);
      captureCount++;
    }
    const animateMove = !(typeof prefersReducedMotion === 'function' && prefersReducedMotion());
    setXiangqiWaveCProcess(captured ? 'capture' : 'move', cur);
    motion = animateMove ? { from: from.slice(), to: to.slice(), piece: { ...piece }, captured: captured ? { ...captured } : null } : null;
    const thisMotion = ++motionEpoch;
    board[from[0]][from[1]] = null;
    board[to[0]][to[1]] = piece;
    lastMove = [from, to];
    if (!opts.online) xiangqiGhost3DLocalLastMove = { from:from.slice(), to:to.slice(), capture:captured ? { p:captured.p, t:captured.t } : null };
    moveCount++;
    if(!ruleAuthority)audioCue(captured ? 'xiangqi_capture' : 'xiangqi_move', {
      actionId: 'xiangqi-move-' + moveCount + '-' + from[0] + '-' + from[1] + '-' + to[0] + '-' + to[1]
      , reaction: captured ? 'capture' : 'move'
    }, captured ? .9 : 1);
    selected = null; legalMoves = [];
    cur ^= 1;
    lastClockAt = Date.now();
    // 判断对方是否被将死
    const all = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const p2 = board[r][c];
      if (p2 && p2.p === cur) legalMovesOf(cur, r, c).forEach(m => all.push([r,c,m]));
    }
    if (!all.length){
      over = true; finishedAt = Date.now();
      winner = cur ^ 1;
      if(!ruleAuthority)audioCue('xiangqi_checkmate', { actionId:'xiangqi-checkmate-' + moveCount, reaction:'win' }, 1);
      if (opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: cur, coins: 0, rank: 2 }]);
      motion = null; motionEpoch++; clearXiangqiWaveCProcessTimers();
      xiangqiGhost3DPendingMotion = null;
      setXiangqiWaveCProcess('terminal', winner);
      render();
      return true;
    }
    const checked = isCheck(cur);
    if (checked) checkCount++;
    if(checked&&!ruleAuthority)audioCue('xiangqi_check', { actionId:'xiangqi-check-' + moveCount, reaction:'capture' }, .9);
    render();
    // Online clicks may have updated the retained DOM optimistically.  Their
    // renderer path is deliberately absent here and waits for raw authority.
    if (!opts.online) xiangqiGhost3DQueueCommittedLocalMove(piece.p, from, to, captured);
    setStatus(checked ? t('xiangqi_player_in_check',cur+1) : t('player_turn',cur+1));
    settleXiangqiWaveCProcess(checked ? 'check' : 'turn', cur, 280);
    if (animateMove) scheduleXiangqiWaveCProcess(() => { if (thisMotion === motionEpoch){ motion = null; render(); } }, 260);
    scheduleAI();
    return true;
  }
  function interactWithXiangqiCell(r, c){
    if (spectator || over || !Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    if (opts.online && cur !== opts.myIdx) return false;
    if (opts.ai && opts.ai.has(cur)) return false;
    if (selected){
      if (legalMoves.some(([mr,mc]) => mr === r && mc === c)){
        const from = selected.slice(), to = [r,c];
        xiangqiKeyboardMode = false;
        if (opts.onProgress) opts.onProgress({ from, to });
        if (opts.online){
          const move={from,to,seq:++clockMoveSeq};
          if(ruleAuthority&&typeof opts.sendXiangqiAction==='function')opts.sendXiangqiAction(move);else opts.sendMove(move);
        }
        return doMove(from, to);
      }
      selected = null; legalMoves = []; setXiangqiWaveCProcess('turn', cur);
    }
    const piece = board[r][c];
    if (piece && piece.p === cur){
      selected = [r,c];
      legalMoves = legalMovesOf(cur, r, c);
      setXiangqiWaveCProcess('select', r + ',' + c);
    }
    render();
    return true;
  }
  function lose(pi, reason, suppressReport){
    if (over) return;
    over = true; finishedAt = Date.now();
    winner = pi ^ 1;
    if (!suppressReport && opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: pi, coins: 0, rank: 2 }]);
    motion = null; motionEpoch++; clearXiangqiWaveCProcessTimers();
    xiangqiGhost3DPendingMotion = null;
    setXiangqiWaveCProcess('terminal', winner);
    render();
    if (reason) setStatus(t('xiangqi_win_reason',winner+1,reason), true);
  }
  function render(){
    // Treat the board and its process rail as one measured stage.  Desktop
    // and tablet place the rail beside the tall board; narrow/short screens
    // stack it below, keeping the complete 9×10 playfield in the Arena.
    const availableWidth = Math.max(220, Number(area.clientWidth) || 520);
    const availableHeight = Math.max(0, Number(area.clientHeight) || 0);
    const compactLandscape = availableWidth >= 480 && availableHeight > 0 && availableHeight < 450;
    const useSideProcessRail = (availableWidth >= 700 && availableHeight >= 450) || compactLandscape;
    const railWidth = Math.max(180, Math.min(260, Math.round(availableWidth * .25)));
    const widthBudget = Math.max(220, Math.min((useSideProcessRail ? availableWidth - railWidth - 24 : availableWidth - 16), 980));
    const stackedReserve = availableWidth < 480 ? 88 : 108;
    const heightReserve = compactLandscape ? 24 : (useSideProcessRail ? 56 : stackedReserve);
    const heightBudget = availableHeight > 0 ? Math.max(132, (availableHeight - heightReserve) * COLS / ROWS) : widthBudget;
    const S = Math.min(widthBudget, heightBudget);
    // render() rebuilds the Arena tree.  Preserve the optional presentation
    // slot across that rebuild so a mounted renderer never keeps a detached
    // canvas or observer; feature-off disposes before the old board is gone.
    const activeBoard = typeof document !== 'undefined' ? document.activeElement : null;
    const restoreBoardFocus = xiangqiKeyboardFocusPending || activeBoard === xiangqiWaveCBoard;
    xiangqiKeyboardFocusPending = false;
    const retainedXiangqiGhost3DSlot = xiangqiGhost3DPrepareBoardRebuild();
    Array.from(area.children || []).forEach(node => {
      if (node && node.id !== 'honru-game-reaction' && typeof node.remove === 'function') node.remove();
    });
    xiangqiWaveCProcessRail = null; xiangqiWaveCProcessLabel = null; xiangqiWaveCProcessSteps = []; xiangqiWaveCBoard = null;
    const wrap = el('div','xiangqi-wrap');
    wrap.classList.add('xiangqi-wave-c-stage');
    wrap.style.cssText='display:grid;grid-template-areas:' + (useSideProcessRail ? '"board process"' : '"board" "process"') + ';grid-template-columns:' + (useSideProcessRail ? 'minmax(0,1fr) ' + railWidth + 'px' : 'minmax(0,1fr)') + ';place-items:center;align-content:start;gap:10px;width:100%;height:100%;min-width:0;min-height:0;margin:0;padding:4px;box-sizing:border-box;';
    const boardEl = el('div','xiangqi-board');
    xiangqiWaveCBoard = boardEl;
    boardEl.setAttribute('role','grid'); boardEl.setAttribute('tabindex','0'); boardEl.setAttribute('aria-label',t('game_xiangqi'));
    boardEl.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space');
    const tabletop = typeof tabletopArtEnabled === 'function' && tabletopArtEnabled();
    if (typeof markTabletopSurface === 'function') markTabletopSurface(boardEl, 'xiangqi-board', { variant: boardTheme });
    const boardHeight = S * ROWS / COLS;
    boardEl.style.width = S + 'px'; boardEl.style.height = boardHeight + 'px'; boardEl.style.maxWidth = '100%'; boardEl.style.boxSizing = 'border-box'; boardEl.style.margin = '0 auto'; boardEl.style.position = 'relative'; boardEl.style.transform = 'translateZ(0)'; boardEl.style.gridArea = 'board';
    if (boardEl.style && typeof boardEl.style.setProperty === 'function') boardEl.style.setProperty('--xiangqi-wave-c-board-size', S + 'px');
    boardEl.style.touchAction = 'none'; boardEl.style.overscrollBehavior = 'contain';
    const cs = S / COLS;
    const cv = document.createElement('canvas');
    cv.style.position = 'absolute'; cv.style.left = '0'; cv.style.top = '0'; cv.style.width = S + 'px'; cv.style.height = boardHeight + 'px';
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1,Math.round(S*dpr)); cv.height = Math.max(1,Math.round(boardHeight*dpr));
    boardEl.appendChild(cv);
    xiangqiGhost3DAdoptBoardSlot(boardEl, retainedXiangqiGhost3DSlot);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if (tabletop){
      const grassPaper = boardTheme === 'grass';
      const paper = ctx.createLinearGradient ? ctx.createLinearGradient(0,0,S,boardHeight) : null;
      if (paper && paper.addColorStop){
        paper.addColorStop(0,grassPaper?'#F7F9E7':'#FFF9F2'); paper.addColorStop(.58,grassPaper?'#D7E8B6':'#F3E5C4'); paper.addColorStop(1,grassPaper?'#A7C27C':'#E7C57F'); ctx.fillStyle = paper;
      } else ctx.fillStyle = grassPaper ? '#D7E8B6' : '#F3E5C4';
      ctx.strokeStyle = grassPaper ? '#3A5E3B' : '#443443';
    } else if (boardTheme === 'grass'){
      const grass = ctx.createLinearGradient ? ctx.createLinearGradient(0,0,S,S*ROWS/COLS) : null;
      if (grass && grass.addColorStop){ grass.addColorStop(0,'#dff3c8'); grass.addColorStop(1,'#94c973'); ctx.fillStyle = grass; }
      else ctx.fillStyle = '#b7d995';
      ctx.strokeStyle = '#315f36';
    } else {
      const wood = ctx.createLinearGradient ? ctx.createLinearGradient(0,0,S,0) : null;
      if (wood && wood.addColorStop){ wood.addColorStop(0,'#f2d4a5'); wood.addColorStop(.5,'#dfb77b'); wood.addColorStop(1,'#f0cea0'); ctx.fillStyle = wood; }
      else ctx.fillStyle = '#e9c79a';
      ctx.strokeStyle = '#8a5a2b';
    }
    ctx.fillRect(0,0,S,boardHeight); ctx.lineWidth = tabletop ? 2.25 : 1.4; ctx.lineCap = tabletop ? 'round' : 'butt'; ctx.lineJoin = tabletop ? 'round' : 'miter';
    const pad = cs/2;
    const boardBottom = boardHeight - pad;
    for (let c = 0; c < COLS; c++){
      const x = pad + c*cs;
      ctx.beginPath();
      if (c === 0 || c === COLS - 1){
        ctx.moveTo(x, pad); ctx.lineTo(x, boardBottom);
      } else {
        ctx.moveTo(x, pad); ctx.lineTo(x, pad + 4*cs);
        ctx.moveTo(x, pad + 5*cs); ctx.lineTo(x, boardBottom);
      }
      ctx.stroke();
    }
    if (lastMove){
      lastMove.forEach(([r,c], idx) => {
        ctx.fillStyle = idx === 0 ? 'rgba(245,158,11,.24)' : 'rgba(245,158,11,.42)';
        ctx.beginPath(); ctx.arc(pad + c*cs, pad + r*cs, cs*(idx === 0 ? .26 : .48), 0, Math.PI*2); ctx.fill();
      });
    }
    for (let r = 0; r < ROWS; r++){
      ctx.beginPath(); ctx.moveTo(pad, pad + r*cs); ctx.lineTo(S - pad, pad + r*cs); ctx.stroke();
    }
    // 九宫斜线
    const palace = (r0) => {
      ctx.beginPath();
      ctx.moveTo(pad + 3*cs, pad + r0*cs); ctx.lineTo(pad + 5*cs, pad + (r0+2)*cs);
      ctx.moveTo(pad + 5*cs, pad + r0*cs); ctx.lineTo(pad + 3*cs, pad + (r0+2)*cs);
      ctx.stroke();
    };
    palace(0); palace(7);
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const piece = board[r][c];
        if (!piece) continue;
        const x = pad + c*cs, y = pad + r*cs;
        const skin = pieceSkin(piece.p);
        ctx.beginPath(); ctx.arc(x, y, cs*0.42, 0, Math.PI*2);
        if (tabletop){
          const jade = skin === 'jade';
          const base = jade ? (piece.p === 0 ? '#E2F4E6' : '#DDF4F2') : (piece.p === 0 ? '#FFF0E9' : '#EDF6F4');
          const shade = jade ? (piece.p === 0 ? '#8FBE9C' : '#80B8BE') : (piece.p === 0 ? '#E99A7B' : '#82AAB3');
          ctx.save();
          ctx.shadowColor = 'rgba(33,25,35,.22)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = Math.max(1,cs*.07); ctx.shadowOffsetY = Math.max(1.5,cs*.1);
          ctx.fillStyle = base; ctx.fill(); ctx.strokeStyle = '#211923'; ctx.lineWidth = Math.max(2,cs*.07); ctx.stroke(); ctx.restore();
          ctx.save(); ctx.beginPath(); ctx.arc(x,y,cs*.385,0,Math.PI*2); ctx.clip(); ctx.globalAlpha=.52; ctx.fillStyle=shade; ctx.fillRect(x,y,cs*.48,cs*.48); ctx.restore();
          ctx.fillStyle='#FFF9F2'; ctx.beginPath(); ctx.arc(x-cs*.14,y-cs*.16,cs*.07,0,Math.PI*2); ctx.fill();
        } else {
          ctx.fillStyle = skin === 'jade'
            ? (piece.p === 0 ? '#d1fae5' : '#cffafe')
            : (piece.p === 0 ? '#fde2d3' : '#d9e6f2');
          ctx.fill();
          ctx.strokeStyle = skin === 'jade'
            ? (piece.p === 0 ? '#b91c1c' : '#164e63')
            : (piece.p === 0 ? '#b23a1f' : '#1f4e79');
          ctx.lineWidth = skin === 'jade' ? 2.2 : 1.6; ctx.stroke();
        }
        const label = xiangqiPieceName(piece);
        ctx.fillStyle = piece.p === 0 ? (tabletop ? (skin === 'jade' ? '#A23D37' : '#B85245') : '#b23a1f') : (tabletop ? (skin === 'jade' ? '#1F6570' : '#315D78') : '#1f4e79');
        ctx.font = 'bold ' + (cs*0.5) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + 1);
        if (lastMove && ((lastMove[0][0] === r && lastMove[0][1] === c) || (lastMove[1][0] === r && lastMove[1][1] === c))){
          ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(x, y, cs*0.46, 0, Math.PI*2); ctx.stroke();
        }
      }
    }
    if (selected){
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(pad + selected[1]*cs, pad + selected[0]*cs, cs*0.46, 0, Math.PI*2); ctx.stroke();
      legalMoves.forEach(([nr,nc]) => {
        if (board[nr][nc]){
          ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(pad + nc*cs, pad + nr*cs, cs*0.31, 0, Math.PI*2); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(34,160,107,.5)';
          ctx.beginPath(); ctx.arc(pad + nc*cs, pad + nr*cs, cs*0.16, 0, Math.PI*2); ctx.fill();
        }
      });
    }
    if (xiangqiKeyboardMode && xiangqiKeyboardCell){
      const [keyboardRow,keyboardCol] = xiangqiKeyboardCell;
      ctx.save(); ctx.strokeStyle = '#4f6ef7'; ctx.lineWidth = Math.max(2.5,cs*.07); ctx.setLineDash([Math.max(3,cs*.11),Math.max(2,cs*.07)]);
      ctx.beginPath(); ctx.arc(pad + keyboardCol*cs, pad + keyboardRow*cs, cs*.48, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }
    if (motion){
      const renderedMotion = motion;
      const label = xiangqiPieceName(renderedMotion.piece);
      const mover = el('div','xiangqi-motion-piece',label);
      mover.style.cssText = 'position:absolute;z-index:4;width:' + (cs*.84) + 'px;height:' + (cs*.84) + 'px;line-height:' + (cs*.84) + 'px;text-align:center;border-radius:50%;font-weight:900;background:rgba(255,255,255,.9);box-shadow:0 8px 18px rgba(0,0,0,.25);pointer-events:none;transition:transform .24s cubic-bezier(.2,.8,.2,1);left:' + (pad + renderedMotion.from[1]*cs - cs*.42) + 'px;top:' + (pad + renderedMotion.from[0]*cs - cs*.42) + 'px;';
      boardEl.appendChild(mover);
      scheduleXiangqiWaveCProcess(() => {
        if (renderedMotion === motion && !destroyed) mover.style.transform = 'translate(' + ((renderedMotion.to[1]-renderedMotion.from[1])*cs) + 'px,' + ((renderedMotion.to[0]-renderedMotion.from[0])*cs) + 'px)';
      }, 0);
    }
    boardEl.addEventListener('click', e => {
      const rect = boardEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * S;
      const y = (e.clientY - rect.top) / (rect.height) * S * ROWS / COLS;
      const c = Math.round((x - pad) / cs), r = Math.round((y - pad) / cs);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      xiangqiKeyboardMode = false; xiangqiKeyboardCell = [r,c];
      interactWithXiangqiCell(r, c);
    });
    boardEl.addEventListener('keydown', event => {
      const key = event && event.key;
      const deltas = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] };
      if (Object.prototype.hasOwnProperty.call(deltas,key)){
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        const delta = deltas[key];
        xiangqiKeyboardCell = [
          Math.max(0,Math.min(ROWS-1,xiangqiKeyboardCell[0]+delta[0])),
          Math.max(0,Math.min(COLS-1,xiangqiKeyboardCell[1]+delta[1])),
        ];
        xiangqiKeyboardMode = true; xiangqiKeyboardFocusPending = true; render();
        return;
      }
      if (key === 'Enter' || key === ' ' || key === 'Spacebar'){
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        xiangqiKeyboardMode = true; xiangqiKeyboardFocusPending = true;
        interactWithXiangqiCell(xiangqiKeyboardCell[0], xiangqiKeyboardCell[1]);
        return;
      }
      if (key === 'Escape'){
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        selected = null; legalMoves = []; xiangqiKeyboardMode = false; xiangqiKeyboardFocusPending = true;
        setXiangqiWaveCProcess('turn', cur); render();
      }
    });
    wrap.appendChild(boardEl);
    xiangqiWaveCProcessRail = el('section','xiangqi-wave-c-process');
    xiangqiWaveCProcessRail.setAttribute('role','status'); xiangqiWaveCProcessRail.setAttribute('aria-live','polite');
    xiangqiWaveCProcessLabel = el('output','xiangqi-wave-c-process-label');
    const track = el('div','xiangqi-wave-c-process-track');
    xiangqiWaveCProcessSteps = XIANGQI_WAVE_C_PROCESS_STEPS.map(step => {
      const node = el('span','xiangqi-wave-c-process-step');
      node.dataset.xiangqiProcessStep = step; node.setAttribute('data-xiangqi-process-step',step); track.appendChild(node); return node;
    });
    xiangqiWaveCProcessRail.appendChild(xiangqiWaveCProcessLabel); xiangqiWaveCProcessRail.appendChild(track); wrap.appendChild(xiangqiWaveCProcessRail);
    xiangqiWaveCProcessRail.style.cssText='display:grid;grid-area:process;align-self:' + (useSideProcessRail ? 'stretch' : 'start') + ';gap:7px;width:' + (useSideProcessRail ? '100%' : 'min(100%,' + Math.max(240, Math.min(640, S)) + 'px)') + ';padding:9px 10px;box-sizing:border-box;border:1px solid rgba(43,32,37,.28);border-radius:14px;background:linear-gradient(135deg,rgba(67,90,193,.12),rgba(255,255,255,.68));box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 3px 0 rgba(76,43,21,.12);color:var(--stage-ink,var(--text));';
    xiangqiWaveCProcessLabel.style.cssText='min-width:0;font-size:10px;font-weight:900;line-height:1.35;overflow-wrap:anywhere;';
    track.style.cssText='display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;min-height:8px;';
    xiangqiWaveCProcessSteps.forEach(step => { step.style.cssText='display:block;min-width:0;height:7px;border-radius:999px;background:rgba(76,43,21,.16);box-shadow:inset 0 1px 1px rgba(255,255,255,.65);'; });
    area.appendChild(wrap);
    if (restoreBoardFocus && typeof boardEl.focus === 'function'){
      try { boardEl.focus({preventScroll:true}); } catch (_error){ try { boardEl.focus(); } catch (_ignored) {} }
    }
    syncXiangqiGhost3DBridge();
    if (over){
      const winnerName = t('player_number',winner+1);
      const terminalOnly = spectator || (!opts.online && !(opts.ai && typeof opts.ai.has === 'function' && opts.ai.size > 0));
      queueXiangqiOutcome(() => showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: t('xiangqi_victory_subtitle'), coins: 1,
        viewerSlot:terminalOnly ? null : (opts.online ? Number(opts.myIdx) : 0),
        audioType:terminalOnly ? 'match_terminal' : undefined,
        audioId:'xiangqi-outcome-'+String(xiangqiAuthorityAudioRevision>=0?xiangqiAuthorityAudioRevision:moveCount)+'-'+winner,
        onRestart: reset, onShare: () => shareGameLink('xiangqi')
      }));
    }
    paintXiangqiWaveCProcess();
    renderAux();
    const turnText = over ? t('match_over') : t('xiangqi_turn_status',spectator ? t('spectating_prefix') : '',t(cur === 0 ? 'xiangqi_red_side' : 'xiangqi_black_side'),t(opts.online && cur === opts.myIdx && !spectator ? 'your_turn' : 'thinking'));
    setStatus(turnText + (isCheck(cur) && !over ? t('xiangqi_check_suffix') : ''));
    renderPlayers(cur, capturedPieces.map(list => t('xiangqi_captured_count',list.length)));
  }
  opts.onMove = (payload, player) => {
    if(ruleAuthority)return;
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (!payload || !Array.isArray(payload.from) || !Array.isArray(payload.to)) return;
    doMove(payload.from, payload.to);
  };
  function resetLocal(){
    cancelXiangqiBoardAI('reset');
    aiEpoch++; destroyed = false; clearXiangqiWaveCProcessTimers(); clearXiangqiOutcomeTimer(); xiangqiWaveCProcessEpoch++;
    xiangqiGhost3DPrepareLocalReset('reset');
    initBoard();
    cur = 0; over = false; winner = -1; selected = null; legalMoves = []; lastMove = null; aiPending = false;
    xiangqiKeyboardCell = [9,4]; xiangqiKeyboardMode = false; xiangqiKeyboardFocusPending = false;
    startedAt = Date.now(); finishedAt = 0; moveCount = 0; captureCount = 0; checkCount = 0; capturedPieces = [[], []]; motion = null; motionEpoch++;
    if(clockAuthority){
      const state=opts.gameplayMeta&&opts.gameplayMeta.clock;clockMode='rapid';
      clockRemaining=state&&Array.isArray(state.remainingMsByPlayer)?state.remainingMsByPlayer.slice(0,2):[600000,600000];
    } else clockRemaining = clockMode === 'rapid' ? [600000,600000] : clockMode === 'blitz' ? [180000,180000] : [null,null];
    clockMoveSeq=0;xiangqiAuthorityAudioMoveNumber=0;xiangqiAuthorityAudioRevision=-1;lastClockAt = Date.now();
    setXiangqiWaveCProcess('turn', cur);
    render();
    setStatus(t('xiangqi_initial_turn'));
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast(t('host_only_restart')); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  function snapshot(){ return {
    board: board.map(r => r.map(x => x ? { p: x.p, t: x.t } : null)), cur, over, winner,
    lastMove: lastMove ? lastMove.map(x => x.slice()) : null, capturedPieces: capturedPieces.map(x => x.slice()),
    clockMode, clockRemaining: clockRemaining.slice(), moveCount, captureCount, checkCount,
  }; }
  function onRestore(value, bridgeOptions){
    const state = value && value.state ? value.state : value;
    if (!state || !Array.isArray(state.board) || state.board.length !== ROWS) return false;
    cancelXiangqiBoardAI('restore');
    if (!bridgeOptions || bridgeOptions.ghost3DHandled !== true) xiangqiGhost3DPrepareRestore();
    aiEpoch++; motionEpoch++; motion = null; clearXiangqiWaveCProcessTimers(); xiangqiWaveCProcessEpoch++;
    board = state.board.map(row => row.map(x => x && (x.p === 0 || x.p === 1) && PIECE[x.t] ? { p:x.p, t:x.t } : null));
    cur = state.cur === 1 ? 1 : 0; over = !!state.over; winner = Number.isInteger(state.winner) ? state.winner : -1;
    lastMove = Array.isArray(state.lastMove) ? state.lastMove.map(x => x.slice()) : null;
    if (!opts.online) xiangqiGhost3DLocalLastMove = xiangqiGhost3DReadLocalLastMove(lastMove);
    capturedPieces = Array.isArray(state.capturedPieces) ? state.capturedPieces.map(x => Array.isArray(x) ? x.slice() : []) : [[],[]];
    clockMode = ['rapid','blitz'].includes(state.clockMode) ? state.clockMode : 'casual';
    clockRemaining = Array.isArray(state.clockRemaining) ? state.clockRemaining.slice(0,2) : [null,null];
    moveCount = Number(state.moveCount) || 0; captureCount = Number(state.captureCount) || 0; checkCount = Number(state.checkCount) || 0;
    selected = null; legalMoves = []; aiPending = false; lastClockAt = Date.now();
    if (value && value.presentation){ setBoardTheme(value.presentation.boardTheme); setCosmetic(value.presentation.cosmetic); }
    setXiangqiWaveCProcess(over ? 'terminal' : (isCheck(cur) ? 'check' : 'turn'), cur);
    render(); return true;
  }
  function setBoardTheme(theme){ boardTheme = theme === 'grass' ? 'grass' : 'classic'; render(); return boardTheme; }
  function setCosmetic(value){ cosmetic = normalizeCosmetic(value); render(); return {default:cosmetic.default,players:{...cosmetic.players}}; }
  function setSpectators(value){
    const nextSpectator = Array.isArray(value) ? value.includes(opts.viewerId) : !!value;
    if (!spectator && nextSpectator){
      cancelXiangqiBoardAI('spectator');
      aiEpoch++;
      aiPending = false;
    }
    spectator = nextSpectator;
    selected = null; legalMoves = [];
    if (over) setXiangqiWaveCProcess('terminal', winner);
    else if (xiangqiWaveCProcess === 'select') setXiangqiWaveCProcess('turn', cur);
    render(); return spectator;
  }
  // Canvas text is not part of the DOM i18n pass, so the platform calls this
  // optional instance hook after a locale has finished loading.
  function onLanguageChange(){ render(); return true; }
  function setClockMode(mode){
    clockMode = ['rapid','blitz'].includes(mode) ? mode : 'casual';
    clockRemaining = clockMode === 'rapid' ? [600000,600000] : clockMode === 'blitz' ? [180000,180000] : [null,null];
    lastClockAt = Date.now(); pulseXiangqiWaveCClock(); renderAux(); return getClockState();
  }
  function getClockState(){ syncClock(); return { mode: clockMode, remaining: clockRemaining.slice(), authoritative: !opts.online }; }
  function setClockState(value){
    if (!value || !Array.isArray(value.remaining)) return false;
    clockMode = ['rapid','blitz'].includes(value.mode) ? value.mode : 'casual';
    clockRemaining = value.remaining.slice(0,2).map(v => v === null ? null : Math.max(0, Number(v) || 0)); lastClockAt = Date.now(); pulseXiangqiWaveCClock(); renderAux(); return true;
  }
  function onClockState(value){
    const state=value&&value.clock?value.clock:value;
    if(!clockAuthority||!state||state.protocol!=='xiangqi-clock-v1'||!Array.isArray(state.remainingMsByPlayer))return false;
    clockMode='rapid';clockRemaining=state.remainingMsByPlayer.slice(0,2).map(v=>Math.max(0,Number(v)||0));lastClockAt=Date.now();
    if(over){ setXiangqiWaveCProcess('terminal', winner); renderAux(); return true; }
    if(state.finished&&Number.isInteger(state.loser))lose(state.loser,t('xiangqi_clock_expired'),true);else renderAux();
    return true;
  }
  function onXiangqiRuleState(value, source = 'live'){
    if(!ruleAuthority||!value||value.protocol!==RULE_PROTOCOL||String(value.matchId||'')!==String(typeof opts.getMatchId==='function'?opts.getMatchId():opts.matchId||''))return false;
    // Preserve the full raw snapshot for the optional renderer before the
    // legacy DOM restore intentionally flattens revision/hash/capture data.
    // The same strict projection guards the retained DOM path so malformed
    // v2 authority data cannot partially rewrite either presentation.
    const rawProjection = xiangqiGhost3DReadRuleState(value, source);
    if (!rawProjection){
      if (xiangqiGhost3DActive) xiangqiGhost3DFailClosedOnline();
      return false;
    }
    const moveNumber = rawProjection.moveNumber;
    const revision = rawProjection.origin.authorityRevision;
    // WebSocket delivery is normally ordered, but reconnects, duplicate
    // callbacks, and test transports can present an older live snapshot after
    // a newer one.  Reject it before either the DOM restore or audio baseline
    // changes; otherwise a 5 -> 4 -> 5 sequence can replay the fifth move.
    if (source === 'live' && revision <= xiangqiAuthorityAudioRevision) return false;
    const previousLiveRevision = xiangqiAuthorityAudioRevision;
    const previousLiveMoveNumber = xiangqiAuthorityAudioMoveNumber;
    // A revision gap is still a valid authoritative snapshot, but it does not
    // prove which single move happened between frames.  Keep it silent and
    // let the next contiguous frame resume semantic move cues.
    const contiguousLiveMove = source === 'live' &&
      previousLiveRevision >= 0 &&
      revision === previousLiveRevision + 1 &&
      moveNumber === previousLiveMoveNumber + 1;
    const observed = xiangqiGhost3DObserveRuleState(value, source);
    const clock=value.clock||{};
    const restored = onRestore({board:value.board,cur:value.current,over:!!value.terminal,winner:value.winner,lastMove:value.lastMove?[value.lastMove.from,value.lastMove.to]:null,capturedPieces:[[],[]],clockMode:'rapid',clockRemaining:Array.isArray(clock.remainingMsByPlayer)?clock.remainingMsByPlayer:[600000,600000],moveCount:value.moveNumber,captureCount:0,checkCount:value.check?1:0}, { ghost3DHandled:true });
    if(restored){
      const acceptedMove=source==='live'&&value.lastMove&&moveNumber>xiangqiAuthorityAudioMoveNumber&&contiguousLiveMove;
      if(acceptedMove){
        const captured=!!value.lastMove.capture;
        audioCue(captured?'xiangqi_capture':'xiangqi_move',{actionId:'xiangqi-rule-'+revision+'-'+moveNumber+'-move',reaction:captured?'capture':'move'},captured?.9:1);
        if(value.terminal)audioCue('xiangqi_checkmate',{actionId:'xiangqi-rule-'+revision+'-checkmate',reaction:'win'},1);
        else if(value.check)audioCue('xiangqi_check',{actionId:'xiangqi-rule-'+revision+'-check',reaction:'capture'},.9);
      }
      if (source === 'live') {
        xiangqiAuthorityAudioMoveNumber = moveNumber;
        xiangqiAuthorityAudioRevision = revision;
      } else {
        xiangqiAuthorityAudioMoveNumber = Math.max(xiangqiAuthorityAudioMoveNumber, moveNumber);
        xiangqiAuthorityAudioRevision = Math.max(xiangqiAuthorityAudioRevision, revision);
      }
    }
    if (restored && observed && observed === xiangqiGhost3DOnlineState){
      syncXiangqiGhost3DBridge();
      queueXiangqiGhost3DRecovery();
      queueXiangqiGhost3DFrame();
    }
    return restored;
  }
  function onXiangqiRuleResult(value, source = 'live'){if(!ruleAuthority||!value||value.protocol!==RULE_PROTOCOL)return false;return onXiangqiRuleState(value.state||value, source);}
  function getMatchStats(){ return {
    duration: Math.max(0, (finishedAt || Date.now()) - startedAt), moves: moveCount, captures: captureCount,
    checks: checkCount, remainingTime: clockRemaining.slice(), winner,
  }; }
  function startMatch(playerA, playerB, spectators){ setSpectators(spectators || false); return { activePlayers:[playerA,playerB], spectators:spectators || [] }; }
  function reportGameResult(){ const result = getMatchStats(); if (typeof opts.reportGameResult === 'function') opts.reportGameResult(result); return result; }
  const clockTimer = setInterval(() => {
    if (over || clockRemaining[cur] === null) return;
    syncClock(); renderAux();
    if (!clockAuthority && clockRemaining[cur] <= 0) lose(cur, t('xiangqi_clock_expired'));
  }, 250);
  if (clockTimer && typeof clockTimer.unref === 'function') clockTimer.unref();
  installXiangqiPresentationResize();
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot, onRestore, onClockState,onXiangqiRuleState,onXiangqiRuleResult,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic:{default:cosmetic.default,players:{...cosmetic.players}} }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, onLanguageChange,
    setClockMode, getClockState, setClockState, getMatchStats, startMatch, reportGameResult,
    getTournamentRequirement: count => count > 2 ? 'TOURNAMENT_ORCHESTRATOR_V1' : null,
    getMultiplayerRequirement: () => opts.online ? (ruleAuthority?'XIANGQI_RULE_PROTOCOL_V2':(clockMode !== 'casual'?'XIANGQI_CLOCK_PROTOCOL_V1':null)) : null,
    getPresentationState: () => ({process:xiangqiWaveCProcess,detail:xiangqiWaveCProcessDetail,epoch:xiangqiWaveCProcessEpoch,revision:xiangqiWaveCProcessRevision}),
     destroy: () => { disposeXiangqiBoardAI(); destroyed = true; aiEpoch++; motionEpoch++; clearXiangqiOutcomeTimer(); xiangqiWaveCProcessEpoch++; xiangqiWaveCProcessRevision++; aiPending = false; clearXiangqiWaveCProcessTimers(); releaseXiangqiPresentationResize(); disposeXiangqiGhost3DBridge(); clearInterval(clockTimer); area.style.touchAction = previousTouchAction; area.style.overscrollBehavior = previousOverscroll; },
  };
}
