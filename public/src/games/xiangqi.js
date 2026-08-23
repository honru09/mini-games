/* ================= 象棋 ================= */
function gameXiangqi(area, extra, n, opts){
  opts = opts || {};
  const scheduleFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn => setTimeout(fn, 0));
  const cancelFrame = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : (id => clearTimeout(id));
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
  let undoUsed = false, undoPending = false;
  const undoHistory = [];
  const allowUndo = opts.allowUndo !== false;
  let undoButton = null;
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
  function xiangqiOutcomeAudio(winnerSlot, terminalOnly){
    const viewerSlot = terminalOnly ? null : (opts.online ? Number(opts.myIdx) : 0);
    const audioId = 'xiangqi-outcome-' + String(Math.max(moveCount, xiangqiAuthorityAudioMoveNumber)) + '-' + String(winnerSlot);
    return { viewerSlot, audioId, reaction: viewerSlot === null ? 'draw' : (viewerSlot === winnerSlot ? 'win' : 'loss') };
  }
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
  let xiangqiFinalArtRequested = typeof xiangqiFinalArtEnabled === 'function' && xiangqiFinalArtEnabled();
  let xiangqiFinalArtActive = false, xiangqiFinalArtState = xiangqiFinalArtRequested ? 'loading' : 'disabled', xiangqiFinalArtAssetProbe = null, xiangqiFinalArtRequest = 0, xiangqiFinalArtAssets = null;
  const xiangqiFinalPieceImages = new Map();
  const XIANGQI_FINAL_ART_BOARD_ROLES = ['background','midground','foreground'];
  const XIANGQI_FINAL_ART_PIECE_ROLES = ['red-general','red-advisor','red-elephant','red-horse','red-chariot','red-cannon','red-soldier','black-general','black-advisor','black-elephant','black-horse','black-chariot','black-cannon','black-soldier'];
  const XIANGQI_FINAL_ART_VFX_ROLES = ['piece-land','check-alert','checkmate-burst','selected','capture','clock-warning'];
  function xiangqiPieceRole(p, t){
    const side = p === 0 ? 'red' : 'black';
    const typeMap = { 'k':'general', 'a':'advisor', 'e':'elephant', 'h':'horse', 'r':'chariot', 'c':'cannon', 'p':'soldier' };
    return 'piece-' + side + '-' + (typeMap[t] || 'soldier');
  }
  function loadXiangqiFinalArtImage(url){
    return new Promise(resolve => {
      if (!url){ resolve(null); return; }
      const img = typeof Image === 'function' ? new Image() : document.createElement('img');
      let settled = false;
      const finish = value => { if (settled) return; settled = true; resolve(value); };
      img.alt = ''; img.decoding = 'async';
      img.addEventListener('load', () => {
        if (typeof img.decode !== 'function'){ finish(img); return; }
        Promise.resolve(img.decode()).then(() => finish(img), () => finish(null));
      });
      img.addEventListener('error', () => finish(null));
      img.src = url;
    });
  }
  function initXiangqiFinalArtSurface(){
    if (!xiangqiFinalArtRequested || typeof resolveXiangqiFinalArtUrl !== 'function') return;
    const request = ++xiangqiFinalArtRequest, reduced = typeof prefersReducedMotion === 'function' && prefersReducedMotion();
    const roles = [
      ...XIANGQI_FINAL_ART_BOARD_ROLES.map(role => 'board-' + role),
      ...XIANGQI_FINAL_ART_PIECE_ROLES.map(role => 'piece-' + role),
      ...XIANGQI_FINAL_ART_VFX_ROLES.map(role => 'vfx-' + role),
    ];
    Promise.all(roles.map(role => resolveXiangqiFinalArtUrl(role, reduced))).then(urls => {
      if (destroyed || request !== xiangqiFinalArtRequest || urls.some(url => !url)) throw new Error('xiangqi-final-art-manifest');
      return Promise.all(urls.map(loadXiangqiFinalArtImage)).then(images => ({urls,images}));
    }).then(({urls,images}) => {
      if (destroyed || request !== xiangqiFinalArtRequest || images.some(image => !image)) throw new Error('xiangqi-final-art-decode');
      const boardCount = XIANGQI_FINAL_ART_BOARD_ROLES.length, pieceCount = XIANGQI_FINAL_ART_PIECE_ROLES.length;
      const boards = Object.fromEntries(XIANGQI_FINAL_ART_BOARD_ROLES.map((role,index) => [role,{url:urls[index],image:images[index]}]));
      xiangqiFinalPieceImages.clear();
      XIANGQI_FINAL_ART_PIECE_ROLES.forEach((role,index) => xiangqiFinalPieceImages.set('piece-' + role,images[boardCount+index]));
      xiangqiFinalArtAssets = {boards,vfx:Object.fromEntries(XIANGQI_FINAL_ART_VFX_ROLES.map((role,index) => [role,urls[boardCount+pieceCount+index]]))};
      xiangqiFinalArtAssetProbe = boards.background.image;xiangqiFinalArtActive = true;xiangqiFinalArtState = 'active';render();
    }).catch(() => {
      if (destroyed || request !== xiangqiFinalArtRequest) return;
      xiangqiFinalArtActive = false;xiangqiFinalArtState = 'fallback';xiangqiFinalArtAssets = null;xiangqiFinalPieceImages.clear();render();
    });
  }
  const XIANGQI_PRESENTATION_SOURCES = new Set(['live','room-restored','reconnect','spectator-bootstrap']);
  const XIANGQI_PRESENTATION_PIECE_TYPES = new Set(['k','a','e','h','r','c','p']);
  let xiangqiOutcomeScheduled = false, xiangqiOutcomeVisible = false, xiangqiOutcomeTimer = null;
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
  function clearXiangqiOutcomeTimer(){
    if (xiangqiOutcomeTimer){ clearTimeout(xiangqiOutcomeTimer); xiangqiOutcomeTimer = null; }
  }
  function scheduleXiangqiOutcome(immediate){
    clearXiangqiOutcomeTimer();
    if (!over) return;
    if (immediate || typeof prefersReducedMotion === 'function' && prefersReducedMotion()){
      xiangqiOutcomeVisible = true;
      if (typeof showVictoryOverlay === 'function') showVictoryOverlay(area, xiangqiOutcomeOptions());
      return;
    }
    xiangqiOutcomeTimer = setTimeout(() => {
      xiangqiOutcomeTimer = null;
      xiangqiOutcomeVisible = true;
      if (typeof showVictoryOverlay === 'function') showVictoryOverlay(area, xiangqiOutcomeOptions());
    }, 320);
  }
  function updateUndoButton(){
    if (!undoButton) return;
    const historyAvailable = opts.online ? moveCount > 0 : undoHistory.length > 0;
    const ready = allowUndo && !undoUsed && !over && historyAvailable;
    undoButton.disabled = !ready;
    undoButton.dataset.undoState = undoUsed ? 'used' : (ready ? 'ready' : 'unavailable');
  }
  function performUndo(){
    const historyAvailable = opts.online ? moveCount > 0 : undoHistory.length > 0;
    if (!allowUndo || undoUsed || over || !historyAvailable) return false;
    if (opts.online){
      const onlineUndoTurn = Number(opts.myIdx) === (cur ^ 1);
      if (!onlineUndoTurn) return false;
      undoPending = true;
      if (typeof opts.requestUndo === 'function') opts.requestUndo();
      updateUndoButton();
      return true;
    }
    const previous = undoHistory.pop();
    if (!previous) return false;
    undoUsed = true;
    undoPending = false;
    cancelAI();
    onRestore(previous);
    updateUndoButton();
    return true;
  }
  function xiangqiOutcomeOptions(){
    const terminalOnly = spectator || (!opts.online && !(opts.ai && typeof opts.ai.has === 'function' && opts.ai.size > 0));
    const draw = winner < 0;
    return {
      winner: draw ? 0 : winner,
      winnerName: draw ? t('match_draw') : t('player_number', winner + 1),
      emoji: draw ? '🤝' : '🏆',
      subtitle: draw ? t('match_draw') : t('xiangqi_checkmate'),
      coins: draw ? 0 : 1,
      viewerSlot: terminalOnly ? null : (opts.online ? Number(opts.myIdx) : 0),
      audioType: draw ? 'match_draw' : (terminalOnly ? 'match_terminal' : undefined),
      audioId: 'xiangqi-outcome-' + String(moveCount) + '-' + (draw ? 'draw' : String(winner)),
      onRestart: reset,
      onShare: () => typeof shareGameLink === 'function' ? shareGameLink('xiangqi') : null,
    };
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
        if (setup[r][c]) board[r][c] = { p: r < 5 ? 1 : 0, t: setup[r][c] };
      }
    }
  }
  function formatClock(ms){
    if (ms === null || ms === undefined) return '--:--';
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
  function syncClock(){
    if (clockRemaining[cur] === null) return;
    const now = Date.now();
    const elapsed = now - lastClockAt;
    lastClockAt = now;
    clockRemaining[cur] = Math.max(0, clockRemaining[cur] - elapsed);
  }
  function clearXiangqiWaveCProcessTimers(){
    xiangqiWaveCProcessTimers.forEach(id => clearTimeout(id));
    xiangqiWaveCProcessTimers.clear();
  }
  function scheduleXiangqiWaveCProcess(fn, delay){
    if (destroyed) return null;
    const epoch = xiangqiWaveCProcessEpoch;
    const timerId = setTimeout(() => {
      xiangqiWaveCProcessTimers.delete(timerId);
      if (destroyed || epoch !== xiangqiWaveCProcessEpoch) return;
      fn();
    }, delay);
    xiangqiWaveCProcessTimers.add(timerId);
    return timerId;
  }
  const viewerSlot = opts.online ? Number(opts.myIdx) : 0;
  function emitXiangqiStage25D(phase, detail, forceOutcome){
    if (typeof emitGameStage25DEvent !== 'function') return false;
    const isTerminal = phase === 'terminal' || over;
    const outcome = forceOutcome || (isTerminal ? (winner===viewerSlot?'win':'loss') : undefined);
    return emitGameStage25DEvent({type:'phase',game:'xiangqi',phase,detail:detail!==undefined?detail:xiangqiWaveCProcessDetail,reducedMotion:typeof prefersReducedMotion==='function'&&prefersReducedMotion(),outcome});
  }
  function setXiangqiWaveCProcess(step, detail, markRevision = true){
    if (!XIANGQI_WAVE_C_PROCESS_STEPS.includes(step)) return;
    xiangqiWaveCProcess = step;
    xiangqiWaveCProcessDetail = detail !== undefined && detail !== null ? String(detail) : '';
    if (markRevision) xiangqiWaveCProcessRevision++;
    renderXiangqiWaveCProcessRail();
    if (area && area.dataset) area.dataset.xiangqiProcess = xiangqiWaveCProcess;
    emitXiangqiStage25D(step, xiangqiWaveCProcessDetail);
  }
  function settleXiangqiWaveCProcess(step, detail, delay = 220){
    if (step !== 'turn' || (typeof prefersReducedMotion === 'function' && prefersReducedMotion())) setXiangqiWaveCProcess(step, detail);
    if (step === 'check') return;
    if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) {
      if (!over) setXiangqiWaveCProcess('turn', cur);
      return;
    }
    scheduleXiangqiWaveCProcess(() => {
      if (!over) setXiangqiWaveCProcess('turn', cur);
    }, delay);
  }
  function pulseXiangqiWaveCClock(){
    if (over) return;
    setXiangqiWaveCProcess('clock', clockRemaining[cur] !== null ? Math.ceil(clockRemaining[cur] / 1000) : '', false);
    scheduleXiangqiWaveCProcess(() => {
      if (!over && xiangqiWaveCProcess === 'clock') setXiangqiWaveCProcess('turn', cur, false);
    }, 180);
  }
  function xiangqiWaveCProcessText(){
    if (over) return t('match_over');
    if (xiangqiWaveCProcess === 'select') return t('xiangqi_initial_turn');
    if (xiangqiWaveCProcess === 'check') return t('xiangqi_player_in_check', cur + 1);
    if (xiangqiWaveCProcess === 'clock') return t('xiangqi_clock_active', cur + 1, formatClock(clockRemaining[cur]));
    if (xiangqiWaveCProcess === 'terminal') return t('match_over');
    return t('player_turn', cur + 1);
  }
  function renderXiangqiWaveCProcessRail(){
    if (!xiangqiWaveCProcessRail || !xiangqiWaveCProcessLabel) return;
    const activeIndex = XIANGQI_WAVE_C_PROCESS_STEPS.indexOf(xiangqiWaveCProcess);
    xiangqiWaveCProcessSteps.forEach((node, idx) => {
      if (!node) return;
      node.classList.toggle('active', idx === activeIndex);
      node.classList.toggle('passed', activeIndex >= 0 && idx < activeIndex);
    });
    xiangqiWaveCProcessLabel.textContent = xiangqiWaveCProcessText();
    xiangqiWaveCProcessRail.dataset.xiangqiProcess = xiangqiWaveCProcess;
    xiangqiWaveCProcessRail.dataset.xiangqiProcessDetail = xiangqiWaveCProcessDetail;
  }
  function installXiangqiPresentationResize(){
    if (typeof ResizeObserver === 'undefined') return;
    try {
      xiangqiPresentationResizeObserver = new ResizeObserver(() => {
        if (destroyed || xiangqiPresentationResizeQueued) return;
        xiangqiPresentationResizeQueued = true;
        xiangqiPresentationResizeFrame = scheduleFrame(() => {
          xiangqiPresentationResizeQueued = false;
          if (!destroyed) render();
        });
      });
      xiangqiPresentationResizeObserver.observe(area);
    } catch (_error) {}
  }
  function releaseXiangqiPresentationResize(){
    if (xiangqiPresentationResizeObserver){
      try { xiangqiPresentationResizeObserver.disconnect(); } catch (_error) {}
      xiangqiPresentationResizeObserver = null;
    }
    if (xiangqiPresentationResizeFrame) cancelFrame(xiangqiPresentationResizeFrame);
    xiangqiPresentationResizeQueued = false;
  }
  function inBounds(r, c){ return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function inPalace(p, r, c){
    if (c < 3 || c > 5) return false;
    return p === 0 ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
  }
  function rawMoves(p, t, r, c){
    const moves = [];
    if (t === 'k'){
      for (const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nr = r + dr, nc = c + dc;
        if (inPalace(p, nr, nc)) moves.push([nr, nc]);
      }
      // 飞将：照将判定
      const dr = p === 0 ? -1 : 1;
      let nr = r + dr;
      while (nr >= 0 && nr < ROWS){
        const target = board[nr][c];
        if (target){
          if (target.t === 'k') moves.push([nr, c]);
          break;
        }
        nr += dr;
      }
    } else if (t === 'a'){
      for (const [dr,dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nr = r + dr, nc = c + dc;
        if (inPalace(p, nr, nc)) moves.push([nr, nc]);
      }
    } else if (t === 'e'){
      for (const [dr,dc] of [[2,2],[2,-2],[-2,2],[-2,-2]]){
        const nr = r + dr, nc = c + dc;
        const eyeR = r + dr/2, eyeC = c + dc/2;
        const crossedRiver = p === 0 ? nr < 5 : nr > 4;
        if (inBounds(nr, nc) && !crossedRiver && !board[eyeR][eyeC]) moves.push([nr, nc]);
      }
    } else if (t === 'h'){
      const hDirs = [
        [-2,-1,-1,0], [-2,1,-1,0], [2,-1,1,0], [2,1,1,0],
        [-1,-2,0,-1], [1,-2,0,-1], [-1,2,0,1], [1,2,0,1]
      ];
      for (const [dr,dc,br,bc] of hDirs){
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && !board[r+br][c+bc]) moves.push([nr, nc]);
      }
    } else if (t === 'r'){
      for (const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)){
          moves.push([nr, nc]);
          if (board[nr][nc]) break;
          nr += dr; nc += dc;
        }
      }
    } else if (t === 'c'){
      for (const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)){
          if (!board[nr][nc]) moves.push([nr, nc]);
          else {
            nr += dr; nc += dc;
            while (inBounds(nr, nc)){
              if (board[nr][nc]){ moves.push([nr, nc]); break; }
              nr += dr; nc += dc;
            }
            break;
          }
          nr += dr; nc += dc;
        }
      }
    } else if (t === 'p'){
      const fwd = p === 0 ? -1 : 1;
      const crossed = p === 0 ? r < 5 : r > 4;
      if (inBounds(r + fwd, c)) moves.push([r + fwd, c]);
      if (crossed){
        if (inBounds(r, c - 1)) moves.push([r, c - 1]);
        if (inBounds(r, c + 1)) moves.push([r, c + 1]);
      }
    }
    return moves.filter(([nr,nc]) => !board[nr][nc] || board[nr][nc].p !== p);
  }
  function findKing(p){
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const piece = board[r][c];
        if (piece && piece.p === p && piece.t === 'k') return [r, c];
      }
    }
    return null;
  }
  function isCheck(p){
    const king = findKing(p);
    if (!king) return false;
    const opp = p ^ 1;
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const piece = board[r][c];
        if (piece && piece.p === opp){
          if (rawMoves(opp, piece.t, r, c).some(m => m[0] === king[0] && m[1] === king[1])) return true;
        }
      }
    }
    return false;
  }
  function legalMovesOf(p, r, c){
    const piece = board[r][c];
    if (!piece || piece.p !== p) return [];
    return rawMoves(p, piece.t, r, c).filter(([nr,nc]) => {
      const target = board[nr][nc];
      board[nr][nc] = piece; board[r][c] = null;
      const checked = isCheck(p);
      board[r][c] = piece; board[nr][nc] = target;
      return !checked;
    });
  }
  function doMove(from, to){
    const coords = from.concat(to).map(Number);
    if (!coords.every(Number.isInteger)) return false;
    from = coords.slice(0, 2); to = coords.slice(2, 4);
    if (from[0] < 0 || from[0] >= ROWS || from[1] < 0 || from[1] >= COLS ||
        to[0] < 0 || to[0] >= ROWS || to[1] < 0 || to[1] >= COLS) return false;
    const piece = board[from[0]][from[1]];
    if (!piece || piece.p !== cur || !legalMovesOf(cur, from[0], from[1]).some(m => m[0] === to[0] && m[1] === to[1])) return false;
    if (allowUndo && !undoUsed && !undoPending && !spectator) {
      undoHistory.push(snapshot());
      undoPending = true;
    }
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
    const checked = isCheck(cur);
    if (!all.length){
      over = true; finishedAt = Date.now();
      winner = cur ^ 1;
      if(!ruleAuthority)audioCue('xiangqi_checkmate', { actionId:'xiangqi-checkmate-' + moveCount, reaction:'win' }, 1);
      if (opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: cur, coins: 0, rank: 2 }]);
      motion = null; motionEpoch++; clearXiangqiWaveCProcessTimers();
      setXiangqiWaveCProcess('terminal', winner);
      if (typeof emitGameStage25DEvent === 'function') {
        const outcomeAudio = xiangqiOutcomeAudio(winner, spectator);
        emitGameStage25DEvent({
          type: 'piece_moved', game: 'xiangqi', from: from.slice(), to: to.slice(),
          player: cur ^ 1, captured: !!captured, check: checked, checkmate: true,
          winner, outcome: winner === Number(opts.myIdx) ? 'win' : (winner === -1 ? 'draw' : 'loss'),
          viewerSlot: outcomeAudio.viewerSlot, audioId: outcomeAudio.audioId,
          reducedMotion: typeof prefersReducedMotion === 'function' && prefersReducedMotion()
        });
      }
      render();
      scheduleXiangqiOutcome(false);
      updateUndoButton();
      return true;
    }
    if (checked) checkCount++;
    if(checked&&!ruleAuthority)audioCue('xiangqi_check', { actionId:'xiangqi-check-' + moveCount, reaction:'capture' }, .9);
    if (typeof emitGameStage25DEvent === 'function') {
      emitGameStage25DEvent({
        type: 'piece_moved', game: 'xiangqi', from: from.slice(), to: to.slice(),
        player: cur ^ 1, captured: !!captured, check: checked, checkmate: false,
        reducedMotion: typeof prefersReducedMotion === 'function' && prefersReducedMotion()
      });
      if (captured) {
        emitGameStage25DEvent({
          type: 'piece_captured', game: 'xiangqi', player: cur, piece: captured.t,
          reducedMotion: typeof prefersReducedMotion === 'function' && prefersReducedMotion()
        });
      }
      if (checked) {
        emitGameStage25DEvent({
          type: 'check', game: 'xiangqi', targetPlayer: cur,
          reducedMotion: typeof prefersReducedMotion === 'function' && prefersReducedMotion()
        });
      }
    }
    render();
    updateUndoButton();
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
    setXiangqiWaveCProcess('terminal', winner);
    if (typeof emitGameStage25DEvent === 'function') {
      const outcomeAudio = xiangqiOutcomeAudio(winner, spectator);
      emitGameStage25DEvent({
        type: 'checkmate', game: 'xiangqi', winner, loser: pi,
        outcome: winner === Number(opts.myIdx) ? 'win' : (winner === -1 ? 'draw' : 'loss'),
        viewerSlot: outcomeAudio.viewerSlot, audioId: outcomeAudio.audioId,
        reducedMotion: typeof prefersReducedMotion === 'function' && prefersReducedMotion()
      });
    }
    render();
    scheduleXiangqiOutcome(false);
    updateUndoButton();
    if (reason) setStatus(t('xiangqi_win_reason',winner+1,reason), true);
  }
  function setStatus(text, isWinner){
    if (typeof opts.setStatus === 'function') opts.setStatus(text, isWinner);
  }
  function cancelAI(){
    aiPending = false; aiEpoch++;
    cancelXiangqiBoardAI('cancel');
  }
  function xqDifficultyProfile(difficulty){
    const id = difficulty && difficulty.id;
    if (id === 'easy') return { depth:1, rootWidth:10, maxQuiescence:4, candidates:6, delay:380 };
    if (id === 'hard') return { depth:3, rootWidth:36, maxQuiescence:12, candidates:12, delay:120 };
    return { depth:2, rootWidth:28, maxQuiescence:8, candidates:8, delay:220 };
  }
  function xqCaptureValue(piece){
    return piece ? ({ k:1, r:.9, c:.55, h:.5, e:.32, a:.28, p:.16 }[piece.t] || .1) : 0;
  }
  function xqLearningCandidates(ranked){
    return ranked.map((item, index) => {
      const captureValue = xqCaptureValue(board[item.to[0]][item.to[1]]);
      return {
        choice:item.choice,
        features:{
          rank:index === 0 ? 1 : Math.max(-1, 1 - index / Math.max(1, ranked.length - 1) * 2),
          capture:captureValue > 0 ? 1 : 0,
          capture_value:captureValue
        }
      };
    });
  }
  function xqSearchRoot(player, difficulty){
    const profile = xqDifficultyProfile(difficulty), ranked = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece || piece.p !== player) continue;
      legalMovesOf(player, r, c).forEach(to => {
        const captured = board[to[0]][to[1]];
        const center = Math.abs(to[1] - 4) + Math.abs(to[0] - (player === 0 ? 6 : 3));
        ranked.push({ from:[r,c], to:to.slice(), choice:`${r},${c}>${to[0]},${to[1]}`, searchScore:xqCaptureValue(captured) * 1000 - center });
      });
    }
    ranked.sort((left, right) => right.searchScore - left.searchScore || left.choice.localeCompare(right.choice));
    return ranked.slice(0, profile.rootWidth || ranked.length);
  }
  function xqBoardAIRanked(result, allMoveByChoice){
    if (!result || result.ok !== true || !Array.isArray(result.ranked)) return [];
    return result.ranked.map(item => {
      if (!item || typeof item.id !== 'string' || !Number.isFinite(item.score)) return null;
      const move = allMoveByChoice.get(item.id);
      if (!move) return null;
      return { from:move.from.slice(), to:move.to.slice(), choice:move.choice, searchScore:item.score };
    }).filter(Boolean);
  }
  function scheduleAI(){
    if (!opts.ai || !opts.ai.has(cur) || over) return;
    const epoch = ++aiEpoch, gen = epoch;
    aiPending = true;
    const difficulty = typeof aiDifficultyFromOptions === 'function' ? aiDifficultyFromOptions(opts) : { id:'normal' };
    const profile = xqDifficultyProfile(difficulty);
    const all = [];
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const p2 = board[r][c];
        if (p2 && p2.p === cur){
          legalMovesOf(cur, r, c).forEach(m => all.push({ from:[r,c], to:m, choice:`${r},${c}>${m[0]},${m[1]}` }));
        }
      }
    }
    if (!all.length){
      lose(cur, t('xiangqi_resigns'));
      return;
    }
    const stateKey = JSON.stringify({ cur, board, moveCount });
    const requestStateKey = stateKey;
    const allMoveByChoice = new Map(all.map(item => [`${item.from[0]},${item.from[1]}>${item.to[0]},${item.to[1]}`, item]));
    const legalCandidates = Array.from(allMoveByChoice.keys());
    const choices = all.map(a => a.choice);
    const remoteAllowed = typeof aiDifficultyAllowsRemote === 'function' ? aiDifficultyAllowsRemote(difficulty) : difficulty.id === 'hard';
    const remoteProfile = typeof aiDifficultyRequestProfile === 'function' ? aiDifficultyRequestProfile(difficulty) : { id:'teacher', difficulty:difficulty.id };

    // Board AI Broker is candidate-only; the main thread remains authoritative.
    const broker = xiangqiBoardAIBrokerForTurn();
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
    const kernel = root && root.BoardAIKernel;
    const canonicalPosition = xiangqiBoardAIPosition();
    if (broker && kernel && typeof kernel.hashPosition === 'function' && allMoveByChoice.size <= 200){
      const requestId = 'xiangqi-board-ai-' + (++xiangqiBoardAIRequestSeq);
      xiangqiBoardAIRequestId = requestId;
      const positionHash = kernel.hashPosition('xiangqi', XIANGQI_BOARD_AI_RULES, canonicalPosition, cur);
      const request = {
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
        budgetMs:difficulty.id === 'hard' ? 220 : 120,
        position:canonicalPosition,
      };
      (async () => {
        let boardAIResult = null;
        try { boardAIResult = await broker.request(request); } catch (_error) { boardAIResult = null; }
        const result = boardAIResult;
        if (destroyed || epoch !== aiEpoch || !aiPending || xiangqiBoardAIRequestId !== requestId || JSON.stringify({ cur, board, moveCount }) !== stateKey) return;
        xiangqiBoardAIRequestId = null;
        aiPending = false;
        let ranked = xqBoardAIRanked(result, allMoveByChoice);
        if (!ranked.length) ranked = xqSearchRoot(cur, difficulty);
        const moveByChoice = new Map(ranked.map(item => [item.choice, item]));
        const rankedChoices = ranked.map(item => item.choice);
        const learningCandidates = xqLearningCandidates(ranked);
        let picked = ranked[0] || null;
        if (remoteAllowed && typeof aiChoose === 'function'){
          const remoteChoice = await aiChoose('xiangqi', { cur, board, lastMove }, rankedChoices.length ? rankedChoices : choices, remoteProfile, learningCandidates);
          picked = moveByChoice.get(remoteChoice) || picked;
        } else if (typeof aiChoose === 'function') {
          aiChoose('xiangqi', { cur, board, lastMove }, rankedChoices.length ? rankedChoices : choices, remoteProfile, learningCandidates).catch(() => {});
        }
        const xqMv = picked;
        if (xqMv && legalMovesOf(cur, xqMv.from[0], xqMv.from[1]).some(move => move[0] === xqMv.to[0] && move[1] === xqMv.to[1])) doMove(xqMv.from, xqMv.to);
      })();
      return;
    }

    setTimeout(async () => {
      if (destroyed || epoch !== aiEpoch || !aiPending || JSON.stringify({ cur, board, moveCount }) !== stateKey) return;
      aiPending = false;
      let ranked = xqSearchRoot(cur, difficulty);
      const moveByChoice = new Map(ranked.map(item => [item.choice, item]));
      const learningCandidates = xqLearningCandidates(ranked);
      let picked = ranked[0] || null;
      if (remoteAllowed && typeof aiChoose === 'function'){
        const remoteChoice = await aiChoose('xiangqi', { cur, board, lastMove }, ranked.map(item => item.choice), remoteProfile, learningCandidates);
        picked = moveByChoice.get(remoteChoice) || picked;
      } else if (typeof aiChoose === 'function') {
        aiChoose('xiangqi', { cur, board, lastMove }, ranked.map(item => item.choice), remoteProfile, learningCandidates).catch(() => {});
      }
      if (picked) doMove(picked.from, picked.to);
    }, profile.delay || 320);
  }
  function render(){
    const arenaSize = typeof measureGameStageArena === 'function' ? measureGameStageArena(area,520,0) : {width:Number(area.clientWidth)||520,height:Number(area.clientHeight)||0};
    const availableWidth = Math.max(220, arenaSize.width || 520);
    const availableHeight = Math.max(0, arenaSize.height || 0);
    const compactLandscape = availableWidth >= 360 && availableHeight > 0 && availableHeight < 450;
    const useSideProcessRail = (availableWidth >= 700 && availableHeight >= 450) || compactLandscape;
    const railWidth = Math.max(180, Math.min(260, Math.round(availableWidth * .25)));
    const widthBudget = Math.max(220, Math.min((useSideProcessRail ? availableWidth - railWidth - 24 : availableWidth - 16), 980));
    const stackedReserve = availableWidth < 480 ? 88 : 108;
    const heightReserve = compactLandscape ? 24 : (useSideProcessRail ? 56 : stackedReserve);
    const heightBudget = availableHeight > 0 ? Math.max(132, (availableHeight - heightReserve) * COLS / ROWS) : widthBudget;
    const S = Math.min(widthBudget, heightBudget);
    const activeBoard = typeof document !== 'undefined' ? document.activeElement : null;
    const restoreBoardFocus = xiangqiKeyboardFocusPending || activeBoard === xiangqiWaveCBoard;
    xiangqiKeyboardFocusPending = false;
    Array.from(area.children || []).forEach(node => {
      if (node && node.id !== 'honru-game-reaction' && typeof node.remove === 'function') node.remove();
    });
    xiangqiWaveCProcessRail = null; xiangqiWaveCProcessLabel = null; xiangqiWaveCProcessSteps = []; xiangqiWaveCBoard = null;
    const wrap = el('div','xiangqi-wrap');
    wrap.classList.add('xiangqi-wave-c-stage');
    wrap.style.cssText='display:grid;grid-template-areas:' + (useSideProcessRail ? '"board process"' : '"board" "process"') + ';grid-template-columns:' + (useSideProcessRail ? 'minmax(0,1fr) ' + railWidth + 'px' : 'minmax(0,1fr)') + ';place-items:center;align-content:start;gap:10px;width:100%;height:100%;min-width:0;min-height:0;margin:0;padding:4px;box-sizing:border-box;';
    const boardEl = el('div','xiangqi-board');
    xiangqiWaveCBoard = boardEl;
    boardEl.classList.toggle('xiangqi-final-art-v1',xiangqiFinalArtActive);boardEl.dataset.xiangqiFinalArt=xiangqiFinalArtState;
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
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const finalBoardArt = xiangqiFinalArtActive && xiangqiFinalArtAssets && xiangqiFinalArtAssets.boards && xiangqiFinalArtAssets.boards.background && xiangqiFinalArtAssets.boards.midground;
    if (finalBoardArt){
      ctx.clearRect(0,0,S,boardHeight);
      ctx.drawImage(xiangqiFinalArtAssets.boards.background.image,0,0,S,boardHeight);
      ctx.drawImage(xiangqiFinalArtAssets.boards.midground.image,0,0,S,boardHeight);
      ctx.strokeStyle = '#211923';
    } else if (tabletop){
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
    if (!finalBoardArt) ctx.fillRect(0,0,S,boardHeight); ctx.lineWidth = tabletop || finalBoardArt ? 2.25 : 1.4; ctx.lineCap = tabletop || finalBoardArt ? 'round' : 'butt'; ctx.lineJoin = tabletop || finalBoardArt ? 'round' : 'miter';
    const pad = cs/2;
    const boardBottom = boardHeight - pad;
    if (!finalBoardArt) for (let c = 0; c < COLS; c++){
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
    if (!finalBoardArt) for (let r = 0; r < ROWS; r++){
      ctx.beginPath(); ctx.moveTo(pad, pad + r*cs); ctx.lineTo(S - pad, pad + r*cs); ctx.stroke();
    }
    // 九宫斜线
    const palace = (r0) => {
      ctx.beginPath();
      ctx.moveTo(pad + 3*cs, pad + r0*cs); ctx.lineTo(pad + 5*cs, pad + (r0+2)*cs);
      ctx.moveTo(pad + 5*cs, pad + r0*cs); ctx.lineTo(pad + 3*cs, pad + (r0+2)*cs);
      ctx.stroke();
    };
    if (!finalBoardArt){ palace(0); palace(7); }
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const piece = board[r][c];
        if (!piece) continue;
        const x = pad + c*cs, y = pad + r*cs;
        const skin = pieceSkin(piece.p);
        const role = xiangqiPieceRole(piece.p, piece.t);
        const finalImg = xiangqiFinalArtActive ? xiangqiFinalPieceImages.get(role) : null;
        if (finalImg && typeof ctx.drawImage === 'function'){
          try {
            ctx.drawImage(finalImg, x - cs*0.44, y - cs*0.44, cs*0.88, cs*0.88);
            if (lastMove && ((lastMove[0][0] === r && lastMove[0][1] === c) || (lastMove[1][0] === r && lastMove[1][1] === c))){
              ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.4;
              ctx.beginPath(); ctx.arc(x, y, cs*0.46, 0, Math.PI*2); ctx.stroke();
            }
            continue;
          } catch (_error) {}
        }
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
    if (finalBoardArt && xiangqiFinalArtAssets.boards.foreground){
      ctx.drawImage(xiangqiFinalArtAssets.boards.foreground.image,0,0,S,boardHeight);
    }
    const finalVfxRole = {select:'selected',move:'piece-land',capture:'capture',check:'check-alert',clock:'clock-warning',terminal:'checkmate-burst'}[xiangqiWaveCProcess];
    const finalVfxUrl = xiangqiFinalArtActive && xiangqiFinalArtAssets && finalVfxRole ? xiangqiFinalArtAssets.vfx[finalVfxRole] : '';
    if (finalVfxUrl){
      const vfx = el('img','xiangqi-final-art-vfx');vfx.alt='';vfx.decoding='async';vfx.setAttribute('aria-hidden','true');vfx.dataset.xiangqiFinalArtVfx=finalVfxRole;vfx.src=finalVfxUrl;
      vfx.addEventListener('error',()=>{if(destroyed||!xiangqiFinalArtActive)return;xiangqiFinalArtActive=false;xiangqiFinalArtState='fallback';xiangqiFinalArtAssets=null;xiangqiFinalPieceImages.clear();render();});
      boardEl.appendChild(vfx);
    }
    if (motion){
      const renderedMotion = motion;
      const label = xiangqiPieceName(renderedMotion.piece);
      const mover = el('div','xiangqi-mover',label);
      mover.style.cssText = 'position:absolute;z-index:4;width:' + (cs*.84) + 'px;height:' + (cs*.84) + 'px;line-height:' + (cs*.84) + 'px;text-align:center;border-radius:50%;font-weight:900;background:rgba(255,255,255,.9);box-shadow:0 8px 18px rgba(0,0,0,.25);pointer-events:none;transition:transform .24s cubic-bezier(.2,.8,.2,1);left:' + (pad + renderedMotion.from[1]*cs - cs*.42) + 'px;top:' + (pad + renderedMotion.from[0]*cs - cs*.42) + 'px;';
      boardEl.appendChild(mover);
      scheduleFrame(() => {
        if (renderedMotion === motion && !destroyed) mover.style.transform = 'translate(' + ((renderedMotion.to[1]-renderedMotion.from[1])*cs) + 'px,' + ((renderedMotion.to[0]-renderedMotion.from[0])*cs) + 'px)';
      });
    }
    boardEl.addEventListener('click', e => {
      const rect = cv.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const c = Math.round((clickX - pad) / cs);
      const r = Math.round((clickY - pad) / cs);
      interactWithXiangqiCell(r, c);
    });
    boardEl.addEventListener('keydown', e => {
      if (spectator || over) return;
      const [r,c] = xiangqiKeyboardCell;
      let handled = false;
      if (e.key === 'ArrowUp' && r > 0){ xiangqiKeyboardCell = [r-1,c]; handled = true; }
      else if (e.key === 'ArrowDown' && r < ROWS-1){ xiangqiKeyboardCell = [r+1,c]; handled = true; }
      else if (e.key === 'ArrowLeft' && c > 0){ xiangqiKeyboardCell = [r,c-1]; handled = true; }
      else if (e.key === 'ArrowRight' && c < COLS-1){ xiangqiKeyboardCell = [r,c+1]; handled = true; }
      else if (e.key === 'Enter' || e.key === ' '){
        handled = true;
        interactWithXiangqiCell(r, c);
      } else if (e.key === 'Escape' && selected){
        handled = true;
        selected = null; legalMoves = []; setXiangqiWaveCProcess('turn', cur); render();
      }
      if (handled){
        e.preventDefault();
        xiangqiKeyboardMode = true; xiangqiKeyboardFocusPending = true; render();
      }
    });
    // Wave C Process Rail
    const rail = el('div','xiangqi-wave-c-process xiangqi-wave-c-process-rail');
    xiangqiWaveCProcessRail = rail;
    const labelWrap = el('div','xiangqi-wave-c-process-label-wrap');
    const label = el('span','xiangqi-wave-c-process-label');
    xiangqiWaveCProcessLabel = label;
    labelWrap.appendChild(label);
    rail.appendChild(labelWrap);
    const stepsWrap = el('div','xiangqi-wave-c-process-steps');
    xiangqiWaveCProcessSteps = XIANGQI_WAVE_C_PROCESS_STEPS.map(step => {
      const stepNode = el('div','xiangqi-wave-c-process-step');
      stepNode.dataset.step = step;
      stepsWrap.appendChild(stepNode);
      return stepNode;
    });
    rail.appendChild(stepsWrap);
    rail.setAttribute('data-xiangqi-process', xiangqiWaveCProcess);
    rail.style.gridArea = 'process';
    if (allowUndo && !undoButton){
      undoButton = el('button','btn xiangqi-undo-button',t('undo'));
      undoButton.type = 'button';
      undoButton.addEventListener('click', performUndo);
      extra.appendChild(undoButton);
    }
    wrap.appendChild(boardEl);
    wrap.appendChild(rail);
    area.appendChild(wrap);
    if (restoreBoardFocus && boardEl && typeof boardEl.focus === 'function') {
      try { boardEl.focus(); } catch (_error) {}
    }
    renderXiangqiWaveCProcessRail();
    renderAux();
    renderPlayers(cur, capturedPieces.map(list => t('xiangqi_captured_count',list.length)));
  }
  function normalizeCosmetic(cosmeticValue){
    const value = cosmeticValue && typeof cosmeticValue === 'object' ? cosmeticValue : {};
    return {
      default: value.default === 'jade' ? 'jade' : 'classic',
      players: value.players && typeof value.players === 'object' ? { ...value.players } : {},
    };
  }
  function pieceSkin(player){
    const value = cosmetic.players && cosmetic.players[player];
    return value === 'jade' || (value && value.pieces === 'jade') ? 'jade' : cosmetic.default;
  }
  function setClockMode(mode){
    if (!['casual','rapid','blitz'].includes(mode)) return clockMode;
    clockMode = mode;
    clockRemaining = clockMode === 'rapid' ? [600000,600000] : clockMode === 'blitz' ? [180000,180000] : [null,null];
    lastClockAt = Date.now();
    renderAux();
    return clockMode;
  }
  function getClockState(){ return { mode:clockMode, remaining:clockRemaining.slice(), authoritative: !opts.online || clockAuthority }; }
  function setClockState(state){
    if (!state || typeof state !== 'object') return false;
    if (['casual','rapid','blitz'].includes(state.mode)) clockMode = state.mode;
    if (Array.isArray(state.remaining)) clockRemaining = state.remaining.slice(0,2).map(v => v === null ? null : Math.max(0, Number(v) || 0));
    lastClockAt = Date.now();
    renderAux();
    if (!over) pulseXiangqiWaveCClock();
    return true;
  }
  function snapshot(){
    return {
      board: board.map(row => row.map(cell => cell ? { ...cell } : null)),
      cur, over, winner, lastMove: lastMove ? [lastMove[0].slice(), lastMove[1].slice()] : null,
      capturedPieces: [capturedPieces[0].slice(), capturedPieces[1].slice()],
      clockMode, clockRemaining: clockRemaining.slice(), moveCount, captureCount, checkCount
    };
  }
  function onRestore(value){
    if (value && value.state && typeof value.state === 'object' && !Array.isArray(value.board)) value = value.state;
    if (!value || typeof value !== 'object' || !Array.isArray(value.board)) return false;
    cancelXiangqiBoardAI('restore');
    cancelAI();
    board = value.board.map(row => row.map(cell => cell ? { ...cell } : null));
    cur = Number(value.cur) || 0;
    over = !!value.over;
    winner = Number.isInteger(value.winner) ? value.winner : -1;
    lastMove = Array.isArray(value.lastMove) ? [value.lastMove[0].slice(), value.lastMove[1].slice()] : null;
    capturedPieces = Array.isArray(value.capturedPieces) ? [value.capturedPieces[0].slice(), value.capturedPieces[1].slice()] : [[], []];
    if (['casual','rapid','blitz'].includes(value.clockMode)) clockMode = value.clockMode;
    if (Array.isArray(value.clockRemaining)) clockRemaining = value.clockRemaining.slice(0,2).map(v => v === null ? null : Math.max(0, Number(v) || 0));
    moveCount = Number(value.moveCount) || 0;
    captureCount = Number(value.captureCount) || 0;
    checkCount = Number(value.checkCount) || 0;
    lastClockAt = Date.now();
    clearXiangqiOutcomeTimer();
    motion = null; motionEpoch++;
    clearXiangqiWaveCProcessTimers();
    setXiangqiWaveCProcess(over ? 'terminal' : (checkCount > 0 ? 'check' : 'turn'), over ? winner : cur, false);
    render();
    updateUndoButton();
    return true;
  }
  function reset(){ return resetLocal(); }
  function resetLocal(){
    cancelXiangqiBoardAI('reset');
    over = false; winner = -1; cur = 0; selected = null; legalMoves = []; lastMove = null; motion = null;
    captureCount = 0; checkCount = 0; moveCount = 0; capturedPieces = [[], []];
    clockRemaining = clockMode === 'rapid' ? [600000,600000] : clockMode === 'blitz' ? [180000,180000] : [null,null];
    lastClockAt = Date.now();
    initBoard();
    clearXiangqiOutcomeTimer();
    xiangqiOutcomeScheduled = false; xiangqiOutcomeVisible = false;
    undoUsed = false; undoPending = false; undoHistory.length = 0;
    clearXiangqiWaveCProcessTimers();
    setXiangqiWaveCProcess('turn', cur);
    cancelAI();
    initXiangqiFinalArtSurface();
    render();
    updateUndoButton();
    setStatus(t('player_turn', cur + 1));
    return true;
  }
  function setBoardTheme(theme){ boardTheme = theme === 'grass' ? 'grass' : 'classic'; render(); return boardTheme; }
  function setCosmetic(value){ cosmetic = normalizeCosmetic(value); render(); return {default:cosmetic.default,players:{...cosmetic.players}}; }
  function setSpectators(value){
    const nextSpectator = !!value;
    if (!spectator && nextSpectator){
      cancelXiangqiBoardAI('spectator');
      aiEpoch++;
      aiPending = false;
    }
    spectator = nextSpectator;
    if (spectator){ selected = null; legalMoves = []; }
    updateUndoButton();
    render(); return spectator;
  }
  function onLanguageChange(){ render(); return true; }
  function onClockState(value){
    const state = value && value.clock ? value.clock : value;
    if(!clockAuthority||!state||state.protocol!=='xiangqi-clock-v1'||!Array.isArray(state.remainingMsByPlayer))return false;
    clockMode='rapid';clockRemaining=state.remainingMsByPlayer.slice(0,2).map(v=>Math.max(0,Number(v)||0));lastClockAt=Date.now();
    if(over){ setXiangqiWaveCProcess('terminal', winner); renderAux(); return true; }
    if(state.finished&&Number.isInteger(state.loser))lose(state.loser,t('xiangqi_clock_expired'),true);else renderAux();
    return true;
  }
  function onXiangqiRuleState(value, source = 'live'){
    if(!ruleAuthority||!value||value.protocol!==RULE_PROTOCOL||String(value.matchId||'')!==String(typeof opts.getMatchId==='function'?opts.getMatchId():opts.matchId||''))return false;
    const moveNumber = Number(value.moveNumber) || 0;
    const revision = Number(value.revision || (value.origin && value.origin.authorityRevision) || 0);
    if (source === 'live' && revision <= xiangqiAuthorityAudioRevision) return false;
    const previousLiveRevision = xiangqiAuthorityAudioRevision;
    const previousLiveMoveNumber = xiangqiAuthorityAudioMoveNumber;
    const contiguousLiveMove = source === 'live' &&
      previousLiveRevision >= 0 &&
      revision === previousLiveRevision + 1 &&
      moveNumber === previousLiveMoveNumber + 1;
    const clock=value.clock||{};
    const wasOver = over;
    const restored = onRestore({board:value.board,cur:value.current,over:!!value.terminal,winner:value.winner,lastMove:value.lastMove?[value.lastMove.from,value.lastMove.to]:null,capturedPieces:[[],[]],clockMode:'rapid',clockRemaining:Array.isArray(clock.remainingMsByPlayer)?clock.remainingMsByPlayer:[600000,600000],moveCount:value.moveNumber,captureCount:0,checkCount:value.check?1:0});
    if(restored){
      if(value.terminal&&!wasOver)emitXiangqiStage25D('terminal',winner);
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
    return restored;
  }
  function onXiangqiRuleResult(value, source = 'live'){if(!ruleAuthority||!value||value.protocol!==RULE_PROTOCOL)return false;return onXiangqiRuleState(value.state||value, source);}
  function getMatchStats(){ return {
    duration: Math.max(0, (finishedAt || Date.now()) - startedAt), moves: moveCount, captures: captureCount,
    checks: checkCount, remainingTime: clockRemaining.slice(), winner,
  }; }
  function startMatch(playerA, playerB, spectators){ setSpectators(spectators || false); return { activePlayers:[playerA,playerB], spectators:spectators || [] }; }
  function reportGameResult(){ const result = getMatchStats(); if (typeof opts.reportGameResult === 'function') opts.reportGameResult(result); return result; }
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (!payload || !Array.isArray(payload.from) || !Array.isArray(payload.to)) return;
    doMove(payload.from, payload.to);
  };
  const clockTimer = setInterval(() => {
    if (over || clockRemaining[cur] === null) return;
    syncClock(); renderAux();
    if (!clockAuthority && clockRemaining[cur] <= 0) lose(cur, t('xiangqi_clock_expired'));
  }, 250);
  if (clockTimer && typeof clockTimer.unref === 'function') clockTimer.unref();
  installXiangqiPresentationResize();
  if (xiangqiFinalArtRequested) initXiangqiFinalArtSurface();
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot, onRestore, onClockState,onXiangqiRuleState,onXiangqiRuleResult,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic:{default:cosmetic.default,players:{...cosmetic.players}} }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, onLanguageChange,
    setClockMode, getClockState, setClockState, getMatchStats, startMatch, reportGameResult,
    getTournamentRequirement: count => count > 2 ? 'TOURNAMENT_ORCHESTRATOR_V1' : null,
    getMultiplayerRequirement: () => opts.online ? (ruleAuthority?'XIANGQI_RULE_PROTOCOL_V2':(clockMode !== 'casual'?'XIANGQI_CLOCK_PROTOCOL_V1':null)) : null,
    getPresentationState: () => ({process:xiangqiWaveCProcess,detail:xiangqiWaveCProcessDetail,epoch:xiangqiWaveCProcessEpoch,revision:xiangqiWaveCProcessRevision}),
    destroy: () => { disposeXiangqiBoardAI(); destroyed = true; xiangqiFinalArtRequest++; xiangqiFinalArtAssetProbe = null; xiangqiFinalArtAssets = null; xiangqiFinalPieceImages.clear(); aiEpoch++; motionEpoch++; clearXiangqiOutcomeTimer(); xiangqiWaveCProcessEpoch++; xiangqiWaveCProcessRevision++; aiPending = false; clearXiangqiWaveCProcessTimers(); releaseXiangqiPresentationResize(); clearInterval(clockTimer); area.style.touchAction = previousTouchAction; area.style.overscrollBehavior = previousOverscroll; },
  };
}
