/* ================= 五子棋 ================= */
function checkGomokuWin(grid, r, c){
  const N = grid.length, p = grid[r][c];
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dr,dc] of dirs){
    let cnt = 1;
    for (const s of [1,-1]){
      let nr = r + dr*s, nc = c + dc*s;
      while (nr>=0 && nr<N && nc>=0 && nc<N && grid[nr][nc] === p){ cnt++; nr += dr*s; nc += dc*s; }
    }
    if (cnt >= 5) return true;
  }
  return false;
}
function gameGomoku(area, extra, n, opts){
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
  const N = 15, CELL = 34, PAD = 22, LOGICAL = PAD*2 + CELL*(N-1);
  let grid = Array.from({length:N}, () => Array(N).fill(-1));
  let cur = 0, over = false, hist = [], last = null, winLine = [];
  let boardTheme = opts.boardTheme === 'grass' ? 'grass' : 'classic';
  let cosmetic = normalizeCosmetic(opts.cosmetic);
  let spectator = !!opts.spectator, spectators = [], activePlayers = [0, 1];
  let startedAt = Date.now(), finishedAt = 0, ghost = null;
  let moveImpact = null, impactTimer = null, gomokuAudioSession = 0, gomokuAudioSequence = 0;
  let aiPending = false, aiEpoch = 0, aiTimer = null;
  // Board AI Worker is a local-only, default-off optimization.  The retained
  // synchronous search, learning path and applyMove() legality gate remain
  // authoritative; this broker only returns a candidate ID.
  let gomokuBoardAIBroker = null, gomokuBoardAIRequestSeq = 0, gomokuBoardAIRequestId = null;
  let gomokuBoardAISyncSolver = null;
  const GOMOKU_BOARD_AI_RULES = 'gomoku-local-v1';
  const GOMOKU_BOARD_AI_IDENTITY = 'gomoku-local-scope';
  function gomokuBoardAITechnicalFeature(name){
    try { return !!(opts && opts.technicalFeatures && opts.technicalFeatures[name] === true); }
    catch (_error) { return false; }
  }
  function gomokuBoardAIWorkerEnabled(){
    // Online authority, spectators and missing browser Worker support never
    // enter this local optimization path.
    return gomokuBoardAITechnicalFeature('boardAIWorkerV1') && !opts.online && !spectator;
  }
  function gomokuBoardAIWorkerFactory(){
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
  function gomokuBoardAIPosition(){
    return {
      board: grid.map(row => row.map(value => value === -1 ? '.' : String(value)).join('')).join('/'),
      last: last ? last.join(',') : null,
      moves: hist.length,
    };
  }
  function gomokuBoardAILegalCandidates(){
    // The shared Broker/Kernel contract caps a request at 200 candidates.  Do
    // not silently slice a Gomoku move set: when the complete legal set is
    // larger, skip the optimization and keep the existing local path intact.
    const candidates = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++){
      if (grid[r][c] === -1) candidates.push(r + ',' + c);
    }
    return candidates.length > 200 ? null : candidates;
  }
  function gomokuBoardAIBrokerForTurn(){
    if (!gomokuBoardAIWorkerEnabled()) return null;
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
    const Broker = root && root.BoardAIWorkerBroker;
    if (!Broker || typeof Broker.create !== 'function') return null;
    if (gomokuBoardAIBroker) return gomokuBoardAIBroker;
    try {
      const syncAdapter = request => {
        const Kernel = root && root.BoardAIKernel;
        if (Kernel && typeof Kernel.create === 'function'){
          try {
            if (!gomokuBoardAISyncSolver) gomokuBoardAISyncSolver = Kernel.create();
            const solved = gomokuBoardAISyncSolver.solve(request);
            if (solved && solved.accepted === true && Array.isArray(solved.ranked) && solved.ranked.length){
              return { choiceId:solved.ranked[0].id, ranked:solved.ranked };
            }
          } catch (_error) {}
        }
        return null;
      };
      syncAdapter.clear = () => {
        if (gomokuBoardAISyncSolver && typeof gomokuBoardAISyncSolver.clear === 'function'){
          try { gomokuBoardAISyncSolver.clear(); } catch (_error) {}
        }
        gomokuBoardAISyncSolver = null;
      };
      gomokuBoardAIBroker = Broker.create({
        enabled:true,
        workerOptIn:true,
        workerFactory:gomokuBoardAIWorkerFactory,
        syncAdapter,
      });
    } catch (_error) { gomokuBoardAIBroker = null; }
    return gomokuBoardAIBroker;
  }
  function cancelGomokuBoardAI(reason){
    const broker = gomokuBoardAIBroker;
    const requestId = gomokuBoardAIRequestId;
    gomokuBoardAIRequestId = null;
    if (!broker || !requestId || typeof broker.cancel !== 'function') return false;
    try { return broker.cancel(requestId, reason) === true; } catch (_error) { return false; }
  }
  function disposeGomokuBoardAI(){
    cancelGomokuBoardAI('dispose');
    const broker = gomokuBoardAIBroker;
    gomokuBoardAIBroker = null;
    if (broker && typeof broker.dispose === 'function'){
      try { broker.dispose(); } catch (_error) {}
    }
    gomokuBoardAISyncSolver = null;
  }
  let gomokuKeyboardCell = [Math.floor(N / 2), Math.floor(N / 2)], gomokuKeyboardFocusActive = false;
  // This is an equivalent, presentation-only touch route for the same
  // semantic cursor used by keyboard input. It deliberately never stores an
  // input mode in snapshots, Replay, or a network move payload.
  let gomokuTouchControls = null, gomokuTouchButtons = null, gomokuTouchListeners = [];
  // Wave C is a disposable process rail. It deliberately never participates
  // in the board, move history, stable snapshot, Replay payload, or AI state.
  const GOMOKU_WAVE_C_PROCESS_STEPS = ['turn','aim','select','place','impact','line','terminal'];
  let gomokuWaveCProcess = 'turn', gomokuWaveCProcessDetail = '';
  let gomokuWaveCProcessEpoch = 0, gomokuWaveCProcessRevision = 0;
  let gomokuWaveCTerminalPending = false, gomokuWaveCTerminalLocked = false, gomokuDestroyed = false;
  const gomokuWaveCProcessTimers = new Set();
  let gomokuWaveCProcessRail = null, gomokuWaveCProcessLabel = null, gomokuWaveCProcessSteps = [];
  // The optional Ghost3D bridge has its own presentation lifetime.  None of
  // these values are part of the Gomoku rule snapshot, Replay, or transport.
  let gomokuGhost3DSlot = null, gomokuGhost3DHost = null, gomokuGhost3DModule = null;
  let gomokuGhost3DGeneration = 0, gomokuGhost3DPresentationRevision = 0, gomokuGhost3DAcceptedRevision = null;
  let gomokuGhost3DLastFingerprint = '', gomokuGhost3DQueued = false, gomokuGhost3DImportPending = false;
  let gomokuGhost3DRecoverQueued = false, gomokuGhost3DPendingPlacement = null, gomokuGhost3DListeners = [];
  let gomokuGhost3DMediaQuery = null;
  // Wave B deliberately has its own local, presentation-only switch.  An
  // A missing key is the enabled default and only the exact string "0"
  // disables the slice. Unavailable storage still fails closed to Wave A.
  // This must never influence rules, snapshots, AI or network payloads.
  function gomokuWaveBEnabled(){
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      if (!storage || typeof storage.getItem !== 'function') return false;
      return storage.getItem('mg_art_game_stage_wave_b_v1') !== '0';
    } catch (_error) {
      return false;
    }
  }
  const gomokuWaveBActive = gomokuWaveBEnabled();
  // Ghost3D is a frozen developer experiment. The retained DOM/Canvas 2.5D
  // surface is the production presentation; only the exact local value "1"
  // opts into the renderer island. This never influences authoritative state.
  function gomokuGhost3DEnabled(){
    if (!gomokuWaveBActive) return false;
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      return !!storage && typeof storage.getItem === 'function' && storage.getItem('mg_ghost3d_gomoku_v1') === '1';
    } catch (_error) {
      return false;
    }
  }
  function gomokuGhost3DInitialQuality(){
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      const quality = storage && typeof storage.getItem === 'function' ? storage.getItem('mg_ghost3d_gomoku_quality_v1') : null;
      return quality === 'HIGH' || quality === 'BALANCED' || quality === 'LOW' ? quality : 'BALANCED';
    } catch (_error) {
      return 'BALANCED';
    }
  }
  const gomokuGhost3DActive = gomokuGhost3DEnabled();
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none';
  area.style.overscrollBehavior = 'contain';
  const turnHud = el('div', 'game-turn-hud gomoku-turn-hud');
  extra.appendChild(turnHud);
  function normalizeCosmetic(value){
    if (typeof value === 'string') return { default:value === 'glow' ? 'glow' : 'classic', players:{} };
    const source = value || {}, defaultSkin = source.default || source.pieces;
    return { default:defaultSkin === 'glow' ? 'glow' : 'classic', players:{ ...(source.players || {}) } };
  }
  function pieceSkin(player){ const value = cosmetic.players && cosmetic.players[player]; return value === 'glow' || (value && value.pieces === 'glow') ? 'glow' : cosmetic.default; }
  function updateHud(){
    const message = over ? (winLine.length ? t('gomoku_five_complete',cur+1) : t('match_over')) :
      (spectator ? t('spectator_player_turn',cur+1) : (opts.online ? t(cur === opts.myIdx ? 'your_turn' : 'opponent_turn') : t('player_turn',cur+1)));
    turnHud.textContent = message;
    updateGomokuWaveBPresentation(message);
  }
  function winningCells(r, c){
    const p = grid[r][c];
    for (const [dr, dc] of [[1,0],[0,1],[1,1],[1,-1]]){
      const cells = [[r, c]];
      for (const s of [1, -1]){
        const branch = [];
        let nr = r + dr * s, nc = c + dc * s;
        while (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] === p){ branch.push([nr, nc]); nr += dr * s; nc += dc * s; }
        if (s < 0) cells.unshift(...branch.reverse()); else cells.push(...branch);
      }
      if (cells.length >= 5) return cells;
    }
    return [];
  }
  function aiState(){
    return {
      board: grid.map(row => row.map(v => v === -1 ? '.' : String(v)).join('')).join('/'),
      turn: cur,
      last: last ? last.join(',') : null,
    };
  }
  const GOMOKU_DIRS = [[1,0],[0,1],[1,1],[1,-1]];
  const GOMOKU_MATE = 10000000;
  function gomokuCandidates(radius){
    const found = new Set();
    const reach = radius || 2;
    let hasStone = false;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++){
      if (grid[r][c] === -1) continue;
      hasStone = true;
      for (let dr = -reach; dr <= reach; dr++) for (let dc = -reach; dc <= reach; dc++){
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] === -1) found.add(nr + ',' + nc);
      }
    }
    if (!hasStone) return [[7,7]];
    return [...found].map(key => key.split(',').map(Number));
  }
  // Allis 风格威胁刻画：只扩展落点相关的五连、四和可升级为活四的三。
  function gomokuThreatProfile(r, c, p){
    const empty = { win:false, openFour:0, rushFour:0, openThree:0, score:-Infinity };
    if (r < 0 || r >= N || c < 0 || c >= N || grid[r][c] !== -1) return empty;
    grid[r][c] = p;
    const profile = { win:checkGomokuWin(grid, r, c), openFour:0, rushFour:0, openThree:0, score:0 };
    for (const [dr, dc] of GOMOKU_DIRS){
      const line = [];
      for (let step = -5; step <= 5; step++){
        const nr = r + dr * step, nc = c + dc * step;
        line.push(nr < 0 || nr >= N || nc < 0 || nc >= N ? 'O' : (grid[nr][nc] === p ? 'X' : (grid[nr][nc] === -1 ? '.' : 'O')));
      }
      const winningPoints = new Set();
      for (let start = 1; start <= 5; start++){
        const window = line.slice(start, start + 5);
        if (window.filter(ch => ch === 'X').length === 4 && window.filter(ch => ch === '.').length === 1){
          winningPoints.add(start + window.indexOf('.'));
        }
      }
      if (winningPoints.size >= 2) profile.openFour++;
      else if (winningPoints.size === 1) profile.rushFour++;

      let createsOpenFour = 0;
      for (let point = 1; point <= 9; point++){
        if (line[point] !== '.') continue;
        line[point] = 'X';
        const nextWins = new Set();
        for (let start = 0; start <= 6; start++){
          const window = line.slice(start, start + 5);
          if (window.filter(ch => ch === 'X').length === 4 && window.filter(ch => ch === '.').length === 1){
            nextWins.add(start + window.indexOf('.'));
          }
        }
        line[point] = '.';
        if (nextWins.size >= 2) createsOpenFour++;
      }
      if (createsOpenFour) profile.openThree++;
    }
    grid[r][c] = -1;
    const fours = profile.openFour + profile.rushFour;
    profile.score = profile.win ? GOMOKU_MATE :
      profile.openFour ? 1200000 + profile.openFour * 90000 :
      fours >= 2 ? 900000 + fours * 40000 :
      profile.rushFour ? 230000 + profile.rushFour * 18000 + profile.openThree * 9000 :
      profile.openThree >= 2 ? 95000 + profile.openThree * 7000 :
      profile.openThree ? 17000 : 0;
    return profile;
  }
  function gomokuNeighborValue(r, c, p){
    let own = 0, opp = 0;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++){
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const weight = Math.max(1, 4 - Math.max(Math.abs(dr), Math.abs(dc)));
      if (grid[nr][nc] === p) own += weight;
      else if (grid[nr][nc] === (p ^ 1)) opp += weight;
    }
    return own * 16 + opp * 11 - (Math.abs(r - 7) + Math.abs(c - 7)) * 2;
  }
  function gomokuCandidateDetails(r, c, p){
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= N || c < 0 || c >= N || grid[r][c] !== -1) return null;
    const attack = gomokuThreatProfile(r, c, p);
    const defense = gomokuThreatProfile(r, c, p ^ 1);
    const tier = attack.win ? 7 : defense.win ? 6 : attack.openFour ? 5 :
      (attack.openFour + attack.rushFour >= 2) ? 5 : defense.openFour ? 4 :
      (defense.openFour + defense.rushFour >= 2) ? 4 : attack.rushFour ? 3 :
      attack.openThree >= 2 ? 3 : defense.rushFour ? 2 : defense.openThree >= 2 ? 2 : attack.openThree ? 1 : 0;
    const value = attack.score + defense.score * 1.08 + gomokuNeighborValue(r, c, p);
    return { r, c, choice:r + ',' + c, attack, defense, tier, value, center:Math.abs(r - 7) + Math.abs(c - 7) };
  }
  function gomokuRankCandidates(p, limit){
    const ranked = gomokuCandidates(2).map(([r,c]) => gomokuCandidateDetails(r, c, p)).filter(Boolean)
      .sort((a, b) => b.tier - a.tier || b.value - a.value || a.center - b.center || a.r - b.r || a.c - b.c);
    if (!ranked.length) return [];
    const wins = ranked.filter(item => item.attack.win);
    if (wins.length) return wins;
    const blocks = ranked.filter(item => item.defense.win);
    if (blocks.length) return blocks;
    return ranked.slice(0, limit || ranked.length);
  }
  function gomokuBoardAIRanked(result, p){
    if (!result || result.ok !== true || !Array.isArray(result.ranked)) return [];
    return result.ranked.map(item => {
      if (!item || typeof item.id !== 'string' || !Number.isFinite(item.score)) return null;
      const parts = item.id.split(',').map(Number);
      const details = gomokuCandidateDetails(parts[0], parts[1], p);
      if (!details) return null;
      details.searchScore = item.score;
      return details;
    }).filter(Boolean);
  }
  function gomokuLeafValue(p){
    const ours = gomokuRankCandidates(p, 2);
    const theirs = gomokuRankCandidates(p ^ 1, 2);
    const ownThreat = ours.length ? ours[0].attack.score : 0;
    const oppThreat = theirs.length ? theirs[0].attack.score : 0;
    const ownBlock = ours.length ? ours[0].defense.score : 0;
    return ownThreat + ownBlock * .22 - oppThreat * 1.12;
  }
  function gomokuSearchMove(root, p, deadline, width){
    grid[root.r][root.c] = p;
    if (checkGomokuWin(grid, root.r, root.c)){ grid[root.r][root.c] = -1; return GOMOKU_MATE; }
    const replies = gomokuRankCandidates(p ^ 1, width.replies);
    let worst = Infinity, searched = 0;
    for (const reply of replies){
      if (Date.now() >= deadline && searched){ break; }
      grid[reply.r][reply.c] = p ^ 1;
      let lineScore;
      if (checkGomokuWin(grid, reply.r, reply.c)){
        lineScore = -GOMOKU_MATE + 1;
      } else {
        const counters = gomokuRankCandidates(p, width.counters);
        let bestCounter = -Infinity;
        for (const counter of counters){
          if (Date.now() >= deadline && bestCounter > -Infinity) break;
          grid[counter.r][counter.c] = p;
          const value = checkGomokuWin(grid, counter.r, counter.c)
            ? GOMOKU_MATE - 2
            : gomokuLeafValue(p) + counter.attack.score * .18 - reply.attack.score * .12;
          grid[counter.r][counter.c] = -1;
          if (value > bestCounter) bestCounter = value;
        }
        lineScore = bestCounter > -Infinity ? bestCounter : gomokuLeafValue(p);
      }
      grid[reply.r][reply.c] = -1;
      searched++;
      if (lineScore < worst) worst = lineScore;
      if (worst <= -GOMOKU_MATE / 2) break;
    }
    grid[root.r][root.c] = -1;
    if (!searched) worst = root.value;
    return worst + root.value * .035;
  }
  function gomokuDifficultyProfile(difficulty){
    const id = difficulty && difficulty.id;
    if (id === 'easy') return { roots:hist.length < 8 ? 9 : 8, replies:4, counters:2, deadline:45, candidates:6 };
    if (id === 'hard') return { roots:hist.length < 8 ? 24 : 22, replies:14, counters:9, deadline:260, candidates:12 };
    // 普通档保留原来的近优本地搜索宽度与预算。
    return { roots:hist.length < 8 ? 18 : 16, replies:10, counters:6, deadline:135, candidates:8 };
  }
  function cancelAIWork(){
    cancelGomokuBoardAI('cancel');
    aiEpoch++;
    if (aiTimer !== null){ clearTimeout(aiTimer); aiTimer = null; }
    aiPending = false;
  }
  function scheduleAI(){
    if (opts.destroyed || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    cancelAIWork();
    aiPending = true;
    showGomokuFinalVfx('thinking');
    updateGomokuWaveBPresentation(turnHud.textContent);
    const epoch = aiEpoch;
    const turn = cur;
    const state = aiState();
    const stateKey = JSON.stringify(state);
    setStatus(t('ai_thinking'));
    let timer = null;
    timer = setTimeout(async () => {
      if (aiTimer === timer) aiTimer = null;
      if (opts.destroyed || epoch !== aiEpoch || over || cur !== turn || JSON.stringify(aiState()) !== stateKey){
        if (epoch === aiEpoch){ aiPending = false; updateGomokuWaveBPresentation(turnHud.textContent); }
        return;
      }
      const difficulty = typeof aiDifficultyFromOptions === 'function' ? aiDifficultyFromOptions(opts) : { id:'hard' };
      const profile = gomokuDifficultyProfile(difficulty);
      const canonicalPosition = gomokuBoardAIPosition();
      const requestStateKey = JSON.stringify(canonicalPosition);
      const allLegalChoices = gomokuBoardAILegalCandidates();
      const allMoveByChoice = new Map((allLegalChoices || []).map(choice => [choice, choice.split(',').map(Number)]));
      let boardAIResult = null;
      // The bounded Worker/Kernel owns the expensive search when enabled.
      // If it is unavailable, invalid or the complete legal set is over 200,
      // the retained local search runs once as the failure/default fallback.
      const boardAI = gomokuBoardAIBrokerForTurn();
      const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
      const kernel = root && root.BoardAIKernel;
      if (boardAI && kernel && typeof kernel.hashPosition === 'function' && allLegalChoices && allLegalChoices.length){
        const positionHash = kernel.hashPosition('gomoku', GOMOKU_BOARD_AI_RULES, canonicalPosition, cur);
        if (typeof positionHash === 'string' && positionHash){
          const requestId = 'gomoku-board-ai-' + (++gomokuBoardAIRequestSeq);
          gomokuBoardAIRequestId = requestId;
          try {
            boardAIResult = await boardAI.request({
              requestId,
              gameId:'gomoku',
              rulesVersion:GOMOKU_BOARD_AI_RULES,
              solverVersion:typeof kernel.SOLVER_VERSION === 'string' ? kernel.SOLVER_VERSION : 'board-ai-kernel-v1',
              identity:GOMOKU_BOARD_AI_IDENTITY,
              matchGeneration:epoch,
              turn:cur,
              positionHash,
              legalCandidates:allLegalChoices,
              difficulty:typeof difficulty.id === 'string' ? difficulty.id : 'normal',
              budgetMs:Number.isFinite(profile.deadline) ? Math.max(1, Math.min(500, Math.floor(profile.deadline))) : 100,
              position:canonicalPosition,
            });
          } catch (_error) { boardAIResult = null; }
          if (gomokuBoardAIRequestId === requestId) gomokuBoardAIRequestId = null;
        }
      }
      if (opts.destroyed || epoch !== aiEpoch || over || cur !== turn || JSON.stringify(gomokuBoardAIPosition()) !== requestStateKey){
        if (epoch === aiEpoch){ aiPending = false; updateGomokuWaveBPresentation(turnHud.textContent); }
        return;
      }
      let roots = gomokuBoardAIRanked(boardAIResult, cur);
      if (!roots.length){
        roots = gomokuRankCandidates(cur, profile.roots);
        const deadline = Date.now() + profile.deadline;
        roots.forEach(item => { item.searchScore = gomokuSearchMove(item, cur, deadline, profile); });
        roots.sort((a, b) => b.searchScore - a.searchScore || b.tier - a.tier || b.value - a.value || a.r - b.r || a.c - b.c);
      }
      if (!roots.length){ aiPending = false; updateGomokuWaveBPresentation(turnHud.textContent); return; }
      const best = roots[0];
      const band = best.searchScore >= GOMOKU_MATE / 2 ? 1 : Math.max(90, Math.min(2400, Math.abs(best.searchScore) * .04));
      const near = roots.filter(item => item.tier === best.tier && item.searchScore >= best.searchScore - band)
        .slice(0, profile.candidates).sort((a, b) => b.searchScore - a.searchScore || a.r - b.r || a.c - b.c);
      const choices = near.map(item => item.choice);
      const moveByChoice = new Map(near.map(item => [item.choice, [item.r, item.c]]));
      const learningCandidates = near.map(item => ({ choice:item.choice, features:{
        quality:Math.max(-1, Math.min(1, 1 - Math.max(0, best.searchScore - item.searchScore) / Math.max(1, band))),
        tactical_tier:item.tier / 7,
        immediate_win:item.attack.win ? 1 : 0,
        immediate_block:item.defense.win ? 1 : 0,
        own_force:Math.min(1, (item.attack.openFour * 4 + item.attack.rushFour * 2 + item.attack.openThree) / 6),
        opp_force:Math.min(1, (item.defense.openFour * 4 + item.defense.rushFour * 2 + item.defense.openThree) / 6),
        center:Math.max(-1, 1 - item.center / 7),
      } }));
      const remoteAllowed = typeof aiDifficultyAllowsRemote === 'function' ? aiDifficultyAllowsRemote(difficulty) : difficulty.id === 'hard';
      const remoteProfile = typeof aiDifficultyRequestProfile === 'function' ? aiDifficultyRequestProfile(difficulty) : { id:'teacher', difficulty:difficulty.id };
      // 每档都上传规范化候选以保留个人学习；只有困难档采纳远端裁决。
      const remoteChoice = await aiChoose('gomoku', state, choices, remoteProfile, learningCandidates);
      if (opts.destroyed || epoch !== aiEpoch || over || cur !== turn || JSON.stringify(gomokuBoardAIPosition()) !== requestStateKey){
        if (epoch === aiEpoch){ aiPending = false; updateGomokuWaveBPresentation(turnHud.textContent); }
        return;
      }
      const localIndex = typeof aiDifficultyLocalChoiceIndex === 'function'
        ? aiDifficultyLocalChoiceIndex(difficulty, choices.length) : (difficulty.id === 'easy' ? Math.min(choices.length - 1, 1) : 0);
      const localChoice = choices[Math.max(0, localIndex)] || choices[0];
      const chosen = remoteAllowed && moveByChoice.has(remoteChoice)
        ? remoteChoice
        : localChoice;
      const gpArr = allMoveByChoice.get(chosen) || moveByChoice.get(chosen);
      if (!gpArr || !Number.isInteger(gpArr[0]) || !Number.isInteger(gpArr[1]) ||
          gpArr[0] < 0 || gpArr[0] >= N || gpArr[1] < 0 || gpArr[1] >= N || grid[gpArr[0]][gpArr[1]] !== -1){
        aiPending = false;
        updateGomokuWaveBPresentation(turnHud.textContent);
        return;
      }
      aiPending = false;
      updateGomokuWaveBPresentation(turnHud.textContent);
      aiSpeak(difficulty, 'think');
      if (opts.online && opts.ai && opts.ai.has(turn) && typeof opts.sendBotMove === 'function') opts.sendBotMove(turn, gpArr);
      if (applyMove(gpArr[0], gpArr[1]) && typeof confirmAIReady === 'function') {
        confirmAIReady('gomoku', chosen);
      }
    }, 550);
    aiTimer = timer;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas gomoku-board';
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('role', 'grid');
  canvas.setAttribute('aria-label', t('game_gomoku'));
  canvas.setAttribute('data-i18n-aria-label', 'game_gomoku');
  canvas.setAttribute('aria-rowcount', String(N));
  canvas.setAttribute('aria-colcount', String(N));
  const tabletopMode = () => typeof tabletopArtEnabled === 'function' && tabletopArtEnabled();
  const legacyArtEnabled = gameArtEnabled('gomoku');
  const stickerArtRequested = typeof stickerArtEnabled === 'function' && stickerArtEnabled('gomoku');
  let stickerArtActive = false, stickerArtState = stickerArtRequested ? 'loading' : 'disabled', stickerAssetProbe = null, stickerAssetUrl = '';
  const gomokuFinalArtRequested = typeof gomokuFinalArtEnabled === 'function' && gomokuFinalArtEnabled();
  let gomokuFinalArtActive = false, gomokuFinalArtState = gomokuFinalArtRequested ? 'loading' : 'disabled', gomokuFinalArtBoardUrl = '';
  const gomokuFinalArtPieceImages = new Map(), gomokuFinalArtPieceRequests = new Map();
  let gomokuFinalArtVfxHost = null, gomokuFinalArtVfxSeq = 0;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = LOGICAL * dpr; canvas.height = LOGICAL * dpr;
  const ctx = canvas.getContext('2d');
  let gomokuWaveBStage = null, gomokuWaveBFrame = null, gomokuWaveBMeta = null;
  let gomokuWaveBState = null, gomokuWaveBLastMove = null;
  function gomokuWaveBClass(node, className, enabled){
    if (!node || !node.classList) return;
    if (enabled) node.classList.add(className); else node.classList.remove(className);
  }
  function gomokuWaveBCoordinate(move){
    if (!Array.isArray(move) || move.length < 2) return '';
    const row = Number(move[0]), column = Number(move[1]);
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= N || column < 0 || column >= N) return '';
    return String.fromCharCode(65 + column) + String(row + 1);
  }
  function gomokuWaveCData(node, key, value){
    if (!node) return;
    const attribute = 'data-' + key;
    const datasetKey = key.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    if (value === null || value === undefined){
      if (typeof node.removeAttribute === 'function') node.removeAttribute(attribute);
      if (node.dataset) delete node.dataset[datasetKey];
      return;
    }
    if (node.dataset) node.dataset[datasetKey] = String(value);
    if (typeof node.setAttribute === 'function') node.setAttribute(attribute, String(value));
  }
  function clearGomokuWaveCProcessTimers(){
    gomokuWaveCProcessTimers.forEach(timer => clearTimeout(timer));
    gomokuWaveCProcessTimers.clear();
    impactTimer = null;
  }
  function gomokuWaveCLater(callback, delay){
    const epoch = gomokuWaveCProcessEpoch;
    let timer = null;
    timer = setTimeout(() => {
      gomokuWaveCProcessTimers.delete(timer);
      if (!gomokuDestroyed && !opts.destroyed && epoch === gomokuWaveCProcessEpoch) callback();
    }, Math.max(0, Number(delay) || 0));
    if (timer && typeof timer.unref === 'function') timer.unref();
    gomokuWaveCProcessTimers.add(timer);
    return timer;
  }
  function showGomokuOutcome(outcome){
    const quality = gomokuGhost3DInitialQuality();
    const rendererReady = gomokuGhost3DActive && gomokuGhost3DSlot &&
      gomokuGhost3DSlot.dataset && gomokuGhost3DSlot.dataset.ghost3dReady === 'true';
    const delay = rendererReady && !prefersReducedMotion() && quality !== 'LOW'
      ? (quality === 'HIGH' ? 980 : 860)
      : 0;
    const reveal = () => {
      if (!gomokuDestroyed && !opts.destroyed && over) showVictoryOverlay(area, outcome);
    };
    // Keep the authoritative result and accessible HUD immediate.  Only the
    // blocking result dialog waits long enough for the renderer-local win-line
    // read and terminal camera pose to become visible.  The same process timer
    // owner cancels this work on reset, restore, exit, or destroy.
    if (delay > 0) return gomokuWaveCLater(reveal, delay);
    reveal();
    return null;
  }
  function gomokuOutcomeAudio(winnerSlot, draw){
    const hasLocalAI = !!(opts.ai && typeof opts.ai.has === 'function' && opts.ai.size > 0);
    const terminalOnly = spectator || (!opts.online && !hasLocalAI);
    return {
      viewerSlot: terminalOnly ? null : (opts.online ? Number(opts.myIdx) : 0),
      audioType: draw ? 'match_draw' : (terminalOnly ? 'match_terminal' : undefined),
      audioId: 'gomoku-outcome-' + gomokuAudioSession + '-' + (draw ? 'draw' : String(winnerSlot))
    };
  }
  function gomokuWaveCTurnText(){
    if (over) return winLine.length ? t('gomoku_five_complete',cur+1) : t('gomoku_board_full_draw');
    if (spectator) return t('spectator_player_turn',cur+1);
    if (aiPending) return t('ai_thinking');
    if (opts.online && cur !== opts.myIdx) return t('gomoku_wait_opponent');
    return opts.online ? t('gomoku_your_turn_hint') : t('player_turn',cur+1);
  }
  function gomokuWaveCProcessText(){
    if (gomokuWaveCProcess === 'terminal') return winLine.length ? t('gomoku_five_complete',cur+1) : t('gomoku_board_full_draw');
    if (gomokuWaveCProcess === 'line') return t('gomoku_five_line');
    return gomokuWaveCTurnText();
  }
  function paintGomokuWaveCProcess(){
    if (!gomokuWaveBActive || !gomokuWaveBStage) return;
    [area, gomokuWaveBStage, gomokuWaveBFrame, canvas].forEach(node => gomokuWaveCData(node, 'gomoku-process', gomokuWaveCProcess));
    gomokuWaveCData(gomokuWaveBStage, 'gomoku-process-detail', gomokuWaveCProcessDetail);
    if (gomokuWaveCProcessRail){
      gomokuWaveCData(gomokuWaveCProcessRail, 'gomoku-process', gomokuWaveCProcess);
      if (gomokuWaveCProcessLabel) gomokuWaveCProcessLabel.textContent = gomokuWaveCProcessText();
    }
    gomokuWaveCProcessSteps.forEach((step, index) => {
      const active = step && step.dataset && step.dataset.gomokuProcessStep === gomokuWaveCProcess;
      gomokuWaveCData(step, 'gomoku-process-active', active ? 'true' : 'false');
      gomokuWaveCData(step, 'gomoku-process-index', index);
    });
  }
  function setGomokuWaveCProcess(next, detail){
    const process = GOMOKU_WAVE_C_PROCESS_STEPS.includes(next) ? next : 'turn';
    if (gomokuWaveCTerminalLocked && process !== 'terminal') return false;
    if (gomokuWaveCTerminalPending && !['place','impact','line','terminal'].includes(process)) return false;
    const processDetail = detail === undefined || detail === null ? '' : String(detail);
    if (process === gomokuWaveCProcess && processDetail === gomokuWaveCProcessDetail){
      paintGomokuWaveCProcess();
      return true;
    }
    gomokuWaveCProcess = process;
    gomokuWaveCProcessDetail = processDetail;
    gomokuWaveCProcessRevision++;
    paintGomokuWaveCProcess();
    // Foundation terminal state is intentionally latched.  A terminal visual
    // therefore receives a new presentation generation instead of trying to
    // reuse a host that may have accepted a prior terminal frame.
    if (process === 'terminal') restartGomokuGhost3DHost('terminal');
    else queueGomokuGhost3DFrame();
    return true;
  }
  function settleGomokuWaveCTerminal(detail){
    gomokuWaveCTerminalPending = false;
    gomokuWaveCTerminalLocked = true;
    setGomokuWaveCProcess('terminal', detail);
  }
  function resetGomokuWaveCProcess(next){
    gomokuWaveCProcessEpoch++;
    clearGomokuWaveCProcessTimers();
    moveImpact = null;
    gomokuGhost3DPendingPlacement = null;
    gomokuWaveCTerminalPending = false;
    gomokuWaveCTerminalLocked = next === 'terminal';
    setGomokuWaveCProcess(next || 'turn');
  }
  function startGomokuWaveCMoveProcess(r, c, outcome){
    gomokuWaveCProcessEpoch++;
    clearGomokuWaveCProcessTimers();
    moveImpact = null;
    const coordinate = gomokuWaveBCoordinate([r,c]);
    gomokuWaveCTerminalPending = outcome === 'line' || outcome === 'terminal';
    gomokuWaveCTerminalLocked = false;
    setGomokuWaveCProcess('place', coordinate);
    if (prefersReducedMotion()){
      if (outcome === 'turn') setGomokuWaveCProcess('turn');
      else settleGomokuWaveCTerminal(coordinate);
      return;
    }
    gomokuWaveCLater(() => setGomokuWaveCProcess('impact', coordinate), 90);
    if (outcome === 'line'){
      gomokuWaveCLater(() => setGomokuWaveCProcess('line', coordinate), 280);
      gomokuWaveCLater(() => settleGomokuWaveCTerminal(coordinate), 520);
    } else if (outcome === 'terminal'){
      gomokuWaveCLater(() => settleGomokuWaveCTerminal(coordinate), 330);
    } else {
      gomokuWaveCLater(() => setGomokuWaveCProcess('turn'), 330);
    }
  }
  function mountGomokuWaveBPresentation(){
    if (!gomokuWaveBActive) {
      area.appendChild(canvas);
      return;
    }
    gomokuWaveBStage = el('section', 'gomoku-wave-b-stage');
    gomokuWaveBStage.setAttribute('role', 'group');
    gomokuWaveBStage.setAttribute('aria-label', t('game_gomoku'));
    gomokuWaveBStage.dataset.gameStageWaveB = 'active';
    gomokuWaveBStage.dataset.gridSize = String(N);
    gomokuWaveBFrame = el('div', 'gomoku-wave-b-board-frame');
    gomokuWaveBFrame.dataset.gridSize = String(N);
    gomokuWaveBMeta = el('div', 'gomoku-wave-b-meta');
    gomokuWaveBMeta.setAttribute('role', 'status');
    gomokuWaveBMeta.setAttribute('aria-live', 'polite');
    gomokuWaveBState = el('output', 'gomoku-wave-b-state');
    gomokuWaveBState.setAttribute('aria-live', 'polite');
    gomokuWaveBLastMove = el('output', 'gomoku-wave-b-last-move', '—');
    gomokuWaveBLastMove.setAttribute('aria-live', 'polite');
    gomokuWaveBLastMove.dataset.coordinate = '';
    gomokuWaveCProcessRail = el('section', 'gomoku-wave-c-process');
    gomokuWaveCProcessRail.setAttribute('role', 'status');
    gomokuWaveCProcessRail.setAttribute('aria-live', 'polite');
    gomokuWaveCProcessLabel = el('output', 'gomoku-wave-c-process-label');
    const gomokuWaveCProcessTrack = el('div', 'gomoku-wave-c-process-track');
    gomokuWaveCProcessSteps = GOMOKU_WAVE_C_PROCESS_STEPS.map(step => {
      const node = el('span', 'gomoku-wave-c-process-step');
      gomokuWaveCData(node, 'gomoku-process-step', step);
      node.setAttribute('aria-hidden', 'true');
      gomokuWaveCProcessTrack.appendChild(node);
      return node;
    });
    gomokuWaveCProcessRail.appendChild(gomokuWaveCProcessLabel);
    gomokuWaveCProcessRail.appendChild(gomokuWaveCProcessTrack);
    gomokuWaveBMeta.appendChild(gomokuWaveBState);
    gomokuWaveBMeta.appendChild(gomokuWaveBLastMove);
    gomokuWaveBFrame.appendChild(canvas);
    mountGomokuGhost3DSlot();
    gomokuWaveBFrame.appendChild(gomokuWaveBMeta);
    gomokuWaveBStage.appendChild(gomokuWaveBFrame);
    gomokuWaveBStage.appendChild(gomokuWaveCProcessRail);
    area.appendChild(gomokuWaveBStage);
    gomokuWaveBClass(area, 'gomoku-wave-b-arena', true);
    area.dataset.gameStageWaveB = 'active';
    canvas.classList.add('gomoku-wave-b-board');
    canvas.dataset.gameStageWaveB = 'active';
    canvas.dataset.gridSize = String(N);
    gomokuWaveCData(gomokuWaveCProcessRail, 'gomoku-region', 'process');
    paintGomokuWaveCProcess();
  }
  function updateGomokuWaveBPresentation(message){
    if (!gomokuWaveBActive || !gomokuWaveBStage) return;
    const coordinate = gomokuWaveBCoordinate(last);
    const phase = over ? (winLine.length ? 'won' : 'draw') :
      (spectator ? 'spectating' : (aiPending ? 'thinking' : (opts.online && cur !== opts.myIdx ? 'waiting' : 'turn-' + (cur + 1))));
    gomokuWaveBStage.dataset.gomokuPhase = phase;
    gomokuWaveBStage.dataset.currentPlayer = over ? '' : String(cur + 1);
    gomokuWaveBFrame.dataset.gomokuPhase = phase;
    gomokuWaveBFrame.dataset.lastMove = coordinate;
    gomokuWaveBMeta.dataset.gomokuPhase = phase;
    gomokuWaveBMeta.dataset.hasLastMove = coordinate ? 'true' : 'false';
    gomokuWaveBState.textContent = aiPending ? t('ai_thinking') : String(message || '');
    gomokuWaveBLastMove.textContent = coordinate || '—';
    gomokuWaveBLastMove.dataset.coordinate = coordinate;
    gomokuWaveBLastMove.dataset.player = coordinate && last && grid[last[0]] ? String(grid[last[0]][last[1]]) : '';
    canvas.dataset.gomokuPhase = phase;
    canvas.dataset.lastMove = coordinate;
    paintGomokuWaveCProcess();
  }
  function releaseGomokuWaveBPresentation(){
    if (!gomokuWaveBStage) return;
    // Put the existing canvas back before removing the wrapper so destroy is
    // idempotent even when the caller does not immediately clear the arena.
    if (canvas.parentNode === gomokuWaveBFrame) area.appendChild(canvas);
    if (typeof gomokuWaveBStage.remove === 'function') gomokuWaveBStage.remove();
    else if (gomokuWaveBStage.parentNode && typeof gomokuWaveBStage.parentNode.removeChild === 'function') gomokuWaveBStage.parentNode.removeChild(gomokuWaveBStage);
    gomokuWaveBClass(area, 'gomoku-wave-b-arena', false);
    if (area.dataset) delete area.dataset.gameStageWaveB;
    gomokuWaveBClass(canvas, 'gomoku-wave-b-board', false);
    if (canvas.dataset){ delete canvas.dataset.gameStageWaveB; delete canvas.dataset.gridSize; delete canvas.dataset.gomokuPhase; delete canvas.dataset.lastMove; }
    gomokuWaveBStage = null; gomokuWaveBFrame = null; gomokuWaveBMeta = null; gomokuWaveBState = null; gomokuWaveBLastMove = null;
    gomokuWaveCProcessRail = null; gomokuWaveCProcessLabel = null; gomokuWaveCProcessSteps = [];
  }
  function mountGomokuGhost3DSlot(){
    if (!gomokuGhost3DActive || !gomokuWaveBFrame || gomokuGhost3DSlot) return null;
    const slot = el('div', 'gomoku-ghost3d-slot');
    slot.setAttribute('aria-hidden', 'true');
    slot.dataset.ghost3dReady = 'false';
    slot.dataset.ghost3dGeneration = String(gomokuGhost3DGeneration);
    gomokuGhost3DSlot = slot;
    gomokuWaveBFrame.appendChild(slot);
    return slot;
  }
  function gomokuGhost3DCurrent(generation){
    return !gomokuDestroyed && !opts.destroyed && !!gomokuGhost3DSlot && generation === gomokuGhost3DGeneration;
  }
  function gomokuGhost3DSetReady(ready, generation){
    if (!gomokuGhost3DCurrent(generation)) return false;
    const value = ready === true ? 'true' : 'false';
    gomokuGhost3DSlot.dataset.ghost3dReady = value;
    if (gomokuWaveBFrame && gomokuWaveBFrame.dataset) gomokuWaveBFrame.dataset.ghost3dReady = value;
    return ready === true;
  }
  function gomokuGhost3DReducedMotion(){
    try {
      if (typeof prefersReducedMotion === 'function') return !!prefersReducedMotion();
    } catch (_error) {}
    return !!(gomokuGhost3DMediaQuery && gomokuGhost3DMediaQuery.matches);
  }
  function gomokuGhost3DFactory(){
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
    const factory = root && root.Ghost3DFoundation;
    return factory && typeof factory.create === 'function' ? factory : null;
  }
  function gomokuGhost3DListen(target, type, handler, options){
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler, options);
    gomokuGhost3DListeners.push({ target, type, handler, options, legacy:false });
  }
  function gomokuGhost3DListenLegacy(target, type, handler){
    if (!target || typeof target.addListener !== 'function') return;
    target.addListener(handler);
    gomokuGhost3DListeners.push({ target, type, handler, legacy:true });
  }
  function releaseGomokuGhost3DListeners(){
    gomokuGhost3DListeners.forEach(listener => {
      if (!listener || !listener.target) return;
      if (listener.legacy && typeof listener.target.removeListener === 'function') listener.target.removeListener(listener.handler);
      else if (!listener.legacy && typeof listener.target.removeEventListener === 'function') listener.target.removeEventListener(listener.type, listener.handler, listener.options);
    });
    gomokuGhost3DListeners = [];
    gomokuGhost3DMediaQuery = null;
  }
  function applyGomokuGhost3DLifecycle(action, reason){
    const host = gomokuGhost3DHost;
    if (!host || typeof host.apply !== 'function') return false;
    try { return !!host.apply({ type:'lifecycle', action, reason }); }
    catch (_error) { return false; }
  }
  function installGomokuGhost3DListeners(){
    if (!gomokuGhost3DActive || gomokuGhost3DListeners.length) return;
    const doc = typeof document !== 'undefined' ? document : null;
    const root = typeof window !== 'undefined' ? window : null;
    gomokuGhost3DListen(doc, 'visibilitychange', () => {
      const hidden = !!(doc && doc.hidden);
      applyGomokuGhost3DLifecycle(hidden ? 'hidden' : 'visible', 'document');
    });
    gomokuGhost3DListen(root, 'ghostgame:shellchange', event => {
      const detail = event && event.detail ? event.detail : null;
      const active = !!(detail && detail.active === true && detail.gameId === 'gomoku');
      applyGomokuGhost3DLifecycle(active ? 'resume' : 'suspend', 'shell');
    });
    try {
      gomokuGhost3DMediaQuery = root && typeof root.matchMedia === 'function'
        ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    } catch (_error) {
      gomokuGhost3DMediaQuery = null;
    }
    if (gomokuGhost3DMediaQuery){
      const onChange = event => {
        const host = gomokuGhost3DHost;
        if (!host || typeof host.apply !== 'function') return;
        const reducedMotion = !!(event && typeof event.matches === 'boolean' ? event.matches : gomokuGhost3DMediaQuery.matches);
        try { host.apply({ type:'environment', reducedMotion }); } catch (_error) {}
      };
      if (typeof gomokuGhost3DMediaQuery.addEventListener === 'function') gomokuGhost3DListen(gomokuGhost3DMediaQuery, 'change', onChange);
      else gomokuGhost3DListenLegacy(gomokuGhost3DMediaQuery, 'change', onChange);
    }
    if (doc && doc.hidden) applyGomokuGhost3DLifecycle('hidden', 'document');
  }
  function gomokuGhost3DFreeze(value){
    if (Array.isArray(value)) return Object.freeze(value.map(gomokuGhost3DFreeze));
    if (value && typeof value === 'object'){
      const copy = {};
      Object.keys(value).forEach(key => { copy[key] = gomokuGhost3DFreeze(value[key]); });
      return Object.freeze(copy);
    }
    return value;
  }
  function gomokuGhost3DFrame(){
    const stones = [];
    for (let row = 0; row < N; row++) for (let col = 0; col < N; col++){
      if (grid[row][col] !== -1) stones.push({ row, col, player:grid[row][col] });
    }
    const lastPlayer = last && grid[last[0]] ? grid[last[0]][last[1]] : null;
    const lastMove = last && (lastPlayer === 0 || lastPlayer === 1)
      ? { row:last[0], col:last[1], player:lastPlayer } : null;
    let cursor = null;
    const candidate = ghost || (gomokuKeyboardFocusActive ? gomokuKeyboardCell : null);
    if (Array.isArray(candidate) && Number.isInteger(candidate[0]) && Number.isInteger(candidate[1]) &&
      candidate[0] >= 0 && candidate[0] < N && candidate[1] >= 0 && candidate[1] < N &&
      !over && !spectator && grid[candidate[0]][candidate[1]] === -1){
      cursor = { row:candidate[0], col:candidate[1] };
    }
    return {
      kind:'gomoku-3d-frame-v1',
      board:{
        size:N,
        stones,
        lastMove,
        winningLine:winLine.map(cell => ({ row:cell[0], col:cell[1] })),
      },
      turn:{ activePlayer:cur, canSelect:canPlaceLocalGomokuMove() },
      view:{ quarterTurns:gomokuViewTurns() === 2 ? 2 : 0 },
      cursor,
      process:{ stage:gomokuWaveCProcess, detail:gomokuWaveCProcessDetail, revision:gomokuWaveCProcessRevision },
      ended:!!over,
      terminal:gomokuWaveCProcess === 'terminal',
    };
  }
  function publishGomokuGhost3DFrame(generation){
    if (!gomokuGhost3DCurrent(generation) || !gomokuGhost3DHost || typeof gomokuGhost3DHost.apply !== 'function') return false;
    const next = gomokuGhost3DFrame();
    const fingerprint = JSON.stringify(next);
    if (fingerprint === gomokuGhost3DLastFingerprint && !gomokuGhost3DPendingPlacement) return false;
    const revision = ++gomokuGhost3DPresentationRevision;
    const frame = gomokuGhost3DFreeze({ ...next, revision });
    let result;
    try { result = gomokuGhost3DHost.apply({ type:'frame', frame }); }
    catch (_error) { return false; }
    if (!result || result.accepted !== true) return false;
    gomokuGhost3DLastFingerprint = fingerprint;
    gomokuGhost3DAcceptedRevision = revision;
    const placement = gomokuGhost3DPendingPlacement;
    if (placement && placement.generation === generation){
      gomokuGhost3DPendingPlacement = null;
      try {
        gomokuGhost3DHost.apply({ type:'motion', event:{
          type:'piece_placed', row:placement.row, col:placement.col, player:placement.player, revision,
        } });
      } catch (_error) {}
    }
    const stage = next.process && next.process.stage;
    const lastMove = next.board && next.board.lastMove;
    if (stage === 'line' && Array.isArray(next.board.winningLine) && next.board.winningLine.length >= 2){
      try {
        gomokuGhost3DHost.apply({ type:'motion', event:{
          type:'winning_line', winningLine:next.board.winningLine, winner:lastMove && lastMove.player, revision,
        } });
      } catch (_error) {}
    } else if (stage === 'terminal') {
      try {
        gomokuGhost3DHost.apply({ type:'motion', event:{
          type:'terminal', outcome:Array.isArray(next.board.winningLine) && next.board.winningLine.length >= 2 ? 'win' : 'draw',
          winningLine:next.board.winningLine, winner:lastMove && lastMove.player, revision,
        } });
      } catch (_error) {}
    }
    return true;
  }
  function queueGomokuGhost3DFrame(){
    if (!gomokuGhost3DActive || !gomokuGhost3DHost || gomokuGhost3DQueued || gomokuDestroyed || opts.destroyed) return;
    const generation = gomokuGhost3DGeneration;
    gomokuGhost3DQueued = true;
    Promise.resolve().then(() => {
      gomokuGhost3DQueued = false;
      publishGomokuGhost3DFrame(generation);
    });
  }
  function gomokuGhost3DHandleInput(command, _snapshot, generation){
    if (!gomokuGhost3DCurrent(generation) || !command || typeof command !== 'object' ||
      !Number.isSafeInteger(command.revision) || command.revision !== gomokuGhost3DAcceptedRevision) return false;
    const type = command.type;
    if (type === 'clear_aim'){
      ghost = null;
      if (gomokuWaveCProcess === 'aim' || gomokuWaveCProcess === 'select') setGomokuWaveCProcess('turn');
      draw();
      return true;
    }
    const row = command.row, col = command.col;
    if ((type !== 'aim_cell' && type !== 'select_cell') || !Number.isSafeInteger(row) || !Number.isSafeInteger(col) ||
      row < 0 || row >= N || col < 0 || col >= N) return false;
    if (type === 'aim_cell'){
      if (!canPlaceLocalGomokuMove() || grid[row][col] !== -1) return false;
      gomokuKeyboardFocusActive = true;
      setGomokuKeyboardCell(row, col);
      ghost = [row, col];
      setGomokuKeyboardProcess();
      draw();
      return true;
    }
    gomokuKeyboardFocusActive = true;
    setGomokuKeyboardCell(row, col);
    ghost = [row, col];
    return placeLocalGomokuMove(row, col);
  }
  function gomokuGhost3DForwardInput(input, generation){
    if (!gomokuGhost3DCurrent(generation) || !gomokuGhost3DHost || typeof gomokuGhost3DHost.apply !== 'function') return false;
    const message = input && input.type === 'input' ? input : { type:'input', command:input };
    try { return gomokuGhost3DHost.apply(message); }
    catch (_error) { return false; }
  }
  function gomokuGhost3DContextLost(reason, generation){
    if (!gomokuGhost3DCurrent(generation) || !gomokuGhost3DHost || typeof gomokuGhost3DHost.apply !== 'function') return false;
    gomokuGhost3DSetReady(false, generation);
    const safeReason = typeof reason === 'string' ? reason.slice(0, 96) : 'renderer';
    let result = null;
    try { result = gomokuGhost3DHost.apply({ type:'context-lost', reason:safeReason }); } catch (_error) {}
    queueGomokuGhost3DRecovery();
    return result;
  }
  function gomokuGhost3DSupported(module){
    if (!module || typeof module.isGomoku3DSupported !== 'function') return false;
    try { return module.isGomoku3DSupported() === true; }
    catch (_error) { return false; }
  }
  function gomokuGhost3DCreateAdapter(module, generation){
    const create = module && (typeof module.createGomoku3DAdapter === 'function'
      ? module.createGomoku3DAdapter : (typeof module.createAdapter === 'function' ? module.createAdapter : null));
    if (!create || !gomokuGhost3DCurrent(generation)) return null;
    try {
      return create({
        mountElement:gomokuGhost3DSlot,
        onInput:input => gomokuGhost3DForwardInput(input, generation),
        emitInput:input => gomokuGhost3DForwardInput(input, generation),
        onContextLost:reason => gomokuGhost3DContextLost(reason, generation),
        onError:() => gomokuGhost3DSetReady(false, generation),
        onReady:() => gomokuGhost3DSetReady(true, generation),
        quality:gomokuGhost3DInitialQuality(),
        reducedMotion:gomokuGhost3DReducedMotion(),
      });
    } catch (_error) {
      return null;
    }
  }
  function queueGomokuGhost3DRecovery(){
    if (!gomokuGhost3DActive || gomokuGhost3DRecoverQueued || !gomokuGhost3DModule || !gomokuGhost3DHost) return;
    const generation = gomokuGhost3DGeneration;
    gomokuGhost3DRecoverQueued = true;
    Promise.resolve().then(() => {
      gomokuGhost3DRecoverQueued = false;
      if (!gomokuGhost3DCurrent(generation) || !gomokuGhost3DHost || !gomokuGhost3DSupported(gomokuGhost3DModule)) return;
      const adapter = gomokuGhost3DCreateAdapter(gomokuGhost3DModule, generation);
      if (!adapter) return;
      let result = null;
      try { result = gomokuGhost3DHost.apply({ type:'recover', adapter }); } catch (_error) {}
      if (!result || result.accepted !== true){
        try { if (typeof adapter.dispose === 'function') adapter.dispose(); } catch (_error) {}
        gomokuGhost3DSetReady(false, generation);
      }
    });
  }
  function loadGomokuGhost3DModule(){
    if (!gomokuGhost3DActive || !gomokuGhost3DHost || !gomokuGhost3DSlot || gomokuDestroyed || opts.destroyed) return;
    if (gomokuGhost3DModule){ queueGomokuGhost3DRecovery(); return; }
    if (gomokuGhost3DImportPending) return;
    const generation = gomokuGhost3DGeneration;
    gomokuGhost3DImportPending = true;
    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null);
    const GameModuleLoader = root && root.GameModuleLoader;
    if (!GameModuleLoader || typeof GameModuleLoader.load !== 'function') {
      gomokuGhost3DImportPending = false;
      if (gomokuGhost3DCurrent(generation)) gomokuGhost3DSetReady(false, generation);
      return;
    }
    try { if (typeof GameModuleLoader.prefetch === 'function') GameModuleLoader.prefetch('gomoku'); } catch (_error) {}
    Promise.resolve(GameModuleLoader.load('gomoku', { resource:'renderer' })).then(result => {
      gomokuGhost3DImportPending = false;
      if (gomokuDestroyed || opts.destroyed || !gomokuGhost3DSlot) return;
      const module = result && result.ok === true ? result.module : null;
      if (!module) {
        if (gomokuGhost3DCurrent(generation)) gomokuGhost3DSetReady(false, generation);
        return;
      }
      gomokuGhost3DModule = module;
      if (!gomokuGhost3DCurrent(generation)){
        if (gomokuGhost3DHost) loadGomokuGhost3DModule();
        return;
      }
      if (gomokuGhost3DSupported(module)) queueGomokuGhost3DRecovery();
      else gomokuGhost3DSetReady(false, generation);
    }).catch(() => {
      gomokuGhost3DImportPending = false;
      if (gomokuGhost3DCurrent(generation)) gomokuGhost3DSetReady(false, generation);
    });
  }
  function restartGomokuGhost3DHost(_reason){
    if (!gomokuGhost3DActive || gomokuDestroyed || opts.destroyed || !gomokuGhost3DSlot) return false;
    const factory = gomokuGhost3DFactory();
    if (!factory) return false;
    const previous = gomokuGhost3DHost;
    const generation = ++gomokuGhost3DGeneration;
    const retainedPlacement = _reason === 'terminal' && gomokuGhost3DPendingPlacement
      ? { ...gomokuGhost3DPendingPlacement, generation } : null;
    gomokuGhost3DQueued = false;
    gomokuGhost3DRecoverQueued = false;
    gomokuGhost3DLastFingerprint = '';
    gomokuGhost3DAcceptedRevision = null;
    gomokuGhost3DPendingPlacement = retainedPlacement;
    gomokuGhost3DSetReady(false, generation);
    if (previous && typeof previous.dispose === 'function'){
      try { previous.dispose(); } catch (_error) {}
    }
    try {
      gomokuGhost3DHost = factory.create({
        quality:gomokuGhost3DInitialQuality(),
        reducedMotion:gomokuGhost3DReducedMotion(),
        onInput:(command, snapshot) => gomokuGhost3DHandleInput(command, snapshot, generation),
        onFailure:() => gomokuGhost3DSetReady(false, generation),
      });
    } catch (_error) {
      gomokuGhost3DHost = null;
      return false;
    }
    if (!gomokuGhost3DHost || typeof gomokuGhost3DHost.apply !== 'function'){
      gomokuGhost3DHost = null;
      return false;
    }
    if (gomokuGhost3DSlot.dataset) gomokuGhost3DSlot.dataset.ghost3dGeneration = String(generation);
    installGomokuGhost3DListeners();
    queueGomokuGhost3DFrame();
    loadGomokuGhost3DModule();
    return true;
  }
  function disposeGomokuGhost3DBridge(){
    gomokuGhost3DGeneration++;
    gomokuGhost3DQueued = false;
    gomokuGhost3DRecoverQueued = false;
    gomokuGhost3DPendingPlacement = null;
    const host = gomokuGhost3DHost;
    gomokuGhost3DHost = null;
    if (host && typeof host.dispose === 'function'){
      try { host.dispose(); } catch (_error) {}
    }
    releaseGomokuGhost3DListeners();
    if (gomokuGhost3DSlot){
      gomokuGhost3DSlot.dataset.ghost3dReady = 'false';
      if (typeof gomokuGhost3DSlot.remove === 'function') gomokuGhost3DSlot.remove();
      else if (gomokuGhost3DSlot.parentNode && typeof gomokuGhost3DSlot.parentNode.removeChild === 'function') gomokuGhost3DSlot.parentNode.removeChild(gomokuGhost3DSlot);
    }
    if (gomokuWaveBFrame && gomokuWaveBFrame.dataset) delete gomokuWaveBFrame.dataset.ghost3dReady;
    gomokuGhost3DSlot = null;
  }
  function addGomokuTouchListener(node, type, handler){
    node.addEventListener(type, handler);
    gomokuTouchListeners.push({ node, type, handler });
  }
  function setGomokuTouchTargetSize(button){
    // Keep the target size self-contained because this optional input surface
    // can render in either the Wave A fallback or Wave B command tray.
    button.style.minWidth = '44px';
    button.style.minHeight = '44px';
    button.style.width = '44px';
    button.style.height = '44px';
    button.style.justifySelf = 'center';
  }
  function updateGomokuTouchControls(){
    if (!gomokuTouchControls || !gomokuTouchButtons) return;
    const inputUnavailable = !!(opts.destroyed || gomokuDestroyed);
    const [row, column] = gomokuKeyboardCell;
    const canConfirm = !inputUnavailable && canPlaceLocalGomokuMove() && grid[row] && grid[row][column] === -1;
    Object.keys(gomokuTouchButtons.directions || {}).forEach(direction => {
      const button = gomokuTouchButtons.directions[direction];
      button.disabled = inputUnavailable;
      button.setAttribute('aria-disabled', inputUnavailable ? 'true' : 'false');
    });
    gomokuTouchButtons.confirm.disabled = !canConfirm;
    gomokuTouchButtons.confirm.setAttribute('aria-disabled', canConfirm ? 'false' : 'true');
    gomokuTouchControls.dataset.gomokuTouchState = inputUnavailable ? 'destroyed' : (canConfirm ? 'ready' : 'inspect');
    gomokuTouchControls.dataset.gomokuKeyboardCell = gomokuWaveBCoordinate(gomokuKeyboardCell);
  }
  function moveGomokuTouchCursor(direction, event){
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (opts.destroyed || gomokuDestroyed) return;
    const vector = { up:[-1,0], right:[0,1], down:[1,0], left:[0,-1] }[direction];
    if (!vector) return;
    gomokuKeyboardFocusActive = true;
    moveGomokuKeyboardCell(vector[0], vector[1]);
  }
  function confirmGomokuTouchCursor(event){
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (opts.destroyed || gomokuDestroyed) return false;
    gomokuKeyboardFocusActive = true;
    const placed = placeLocalGomokuMove(gomokuKeyboardCell[0], gomokuKeyboardCell[1]);
    if (!placed) updateGomokuTouchControls();
    return placed;
  }
  function mountGomokuTouchControls(){
    if (gomokuTouchControls) return;
    const controls = el('section', 'gomoku-touch-controls');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', t('game_gomoku'));
    controls.setAttribute('data-i18n-aria-label', 'game_gomoku');
    controls.dataset.gomokuTouchControls = 'true';
    controls.style.display = 'grid';
    controls.style.placeItems = 'center';
    controls.style.width = 'min(100%, 164px)';
    controls.style.margin = '0 auto';
    controls.style.touchAction = 'manipulation';
    const gridNode = el('div', 'gomoku-touch-control-grid');
    gridNode.style.display = 'grid';
    gridNode.style.gridTemplateColumns = 'repeat(3, minmax(44px, 1fr))';
    gridNode.style.gridTemplateAreas = '". up ." "left confirm right" ". down ."';
    gridNode.style.gap = '6px';
    gridNode.style.width = '100%';
    const directions = {};
    [
      ['up', 'tank_up', 'tank_up_aria'],
      ['right', 'tank_right', 'tank_right_aria'],
      ['down', 'tank_down', 'tank_down_aria'],
      ['left', 'tank_left', 'tank_left_aria'],
    ].forEach(([direction, textKey, ariaKey]) => {
      const button = el('button', 'btn gomoku-touch-control gomoku-touch-' + direction, t(textKey));
      button.type = 'button';
      button.setAttribute('data-i18n', textKey);
      button.setAttribute('data-i18n-aria-label', ariaKey);
      button.setAttribute('aria-label', t(ariaKey));
      button.dataset.gomokuTouchDirection = direction;
      button.style.gridArea = direction;
      setGomokuTouchTargetSize(button);
      addGomokuTouchListener(button, 'click', event => moveGomokuTouchCursor(direction, event));
      gridNode.appendChild(button);
      directions[direction] = button;
    });
    // The centered stone glyph has no language-specific visible copy. Its
    // accessible name reuses the existing localised Gomoku placement hint.
    const confirm = el('button', 'btn gomoku-touch-control gomoku-touch-confirm', '●');
    confirm.type = 'button';
    confirm.setAttribute('data-i18n-aria-label', 'gomoku_your_turn_hint');
    confirm.setAttribute('aria-label', t('gomoku_your_turn_hint'));
    confirm.dataset.gomokuTouchControl = 'confirm';
    confirm.style.gridArea = 'confirm';
    confirm.style.fontSize = '18px';
    setGomokuTouchTargetSize(confirm);
    addGomokuTouchListener(confirm, 'click', confirmGomokuTouchCursor);
    gridNode.appendChild(confirm);
    controls.appendChild(gridNode);
    extra.appendChild(controls);
    gomokuTouchControls = controls;
    gomokuTouchButtons = { directions, confirm };
    updateGomokuTouchControls();
  }
  function releaseGomokuTouchControls(){
    gomokuTouchListeners.forEach(({ node, type, handler }) => {
      if (node && typeof node.removeEventListener === 'function') node.removeEventListener(type, handler);
    });
    gomokuTouchListeners = [];
    if (gomokuTouchControls && typeof gomokuTouchControls.remove === 'function') gomokuTouchControls.remove();
    else if (gomokuTouchControls && gomokuTouchControls.parentNode && typeof gomokuTouchControls.parentNode.removeChild === 'function') gomokuTouchControls.parentNode.removeChild(gomokuTouchControls);
    gomokuTouchControls = null;
    gomokuTouchButtons = null;
  }
  mountGomokuWaveBPresentation();
  mountGomokuTouchControls();
  function clearBoardAsset(){
    if (canvas.style && typeof canvas.style.removeProperty === 'function') canvas.style.removeProperty('--game-board-art');
    else if (canvas.style) canvas.style['--game-board-art'] = 'none';
  }
  function gomokuFinalBoardRole(){ return 'board-' + (boardTheme === 'grass' ? 'grass' : 'wood'); }
  function gomokuFinalArtImageFactory(){
    try {
      if (typeof Image === 'function') return new Image();
      if (typeof document !== 'undefined' && document && typeof document.createElement === 'function') return document.createElement('img');
    } catch (_error) {}
    return null;
  }
  function ensureGomokuFinalPieceImage(skin){
    if (!gomokuFinalArtActive || typeof resolveGomokuFinalArtUrl !== 'function') return;
    const safeSkin = typeof GOMOKU_FINAL_ART_PIECES !== 'undefined' && GOMOKU_FINAL_ART_PIECES.includes(skin) ? skin : 'black-white';
    if (gomokuFinalArtPieceImages.has(safeSkin) || gomokuFinalArtPieceRequests.has(safeSkin)) return;
    const request = Promise.resolve(resolveGomokuFinalArtUrl('piece-' + safeSkin, prefersReducedMotion())).then(url => {
      if (!url || opts.destroyed) return;
      const image = gomokuFinalArtImageFactory();
      if (!image) return;
      image.decoding = 'async';
      image.onload = () => { gomokuFinalArtPieceImages.set(safeSkin, image); gomokuFinalArtPieceRequests.delete(safeSkin); draw(); };
      image.onerror = () => { gomokuFinalArtPieceRequests.delete(safeSkin); };
      image.src = url;
    }).catch(() => { gomokuFinalArtPieceRequests.delete(safeSkin); });
    gomokuFinalArtPieceRequests.set(safeSkin, request);
  }
  function gomokuFinalArtVfxParent(){
    const parent = canvas && canvas.parentNode;
    if (!parent || typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    if (!gomokuFinalArtVfxHost){
      gomokuFinalArtVfxHost = document.createElement('div');
      gomokuFinalArtVfxHost.className = 'gomoku-final-vfx-layer';
      gomokuFinalArtVfxHost.setAttribute('aria-hidden', 'true');
      gomokuFinalArtVfxHost.style.position = 'absolute';
      gomokuFinalArtVfxHost.style.inset = '0';
      gomokuFinalArtVfxHost.style.pointerEvents = 'none';
      gomokuFinalArtVfxHost.style.zIndex = '8';
      if (parent.style && !parent.style.position) parent.style.position = 'relative';
      parent.appendChild(gomokuFinalArtVfxHost);
    } else if (gomokuFinalArtVfxHost.parentNode !== parent) parent.appendChild(gomokuFinalArtVfxHost);
    return gomokuFinalArtVfxHost;
  }
  function clearGomokuFinalArtVfx(){
    gomokuFinalArtVfxSeq++;
    if (gomokuFinalArtVfxHost && gomokuFinalArtVfxHost.querySelectorAll) gomokuFinalArtVfxHost.querySelectorAll('.gomoku-final-vfx').forEach(node => node.remove());
  }
  function showGomokuFinalVfx(semantic, row, column){
    if (!gomokuFinalArtActive || typeof resolveGomokuFinalArtUrl !== 'function') return false;
    const roleMap = { last:'vfx-last-move', placement:'vfx-placement-impact', line:'vfx-five-line', draw:'vfx-draw-settle', thinking:'vfx-ai-thinking', spectate:'vfx-spectate', reconnect:'vfx-reconnect' };
    const role = roleMap[String(semantic || '')];
    if (!role) return false;
    const host = gomokuFinalArtVfxParent();
    if (!host) return false;
    const node = document.createElement('img'), request = ++gomokuFinalArtVfxSeq, reduced = prefersReducedMotion();
    node.className = 'gomoku-final-vfx'; node.alt = ''; node.dataset.gomokuFinalVfx = semantic; node.dataset.gomokuFinalVfxState = 'pending';
    const view = Number.isInteger(row) && Number.isInteger(column) ? gomokuViewCell(row, column) : [Math.floor(N / 2), Math.floor(N / 2)];
    node.style.left = ((PAD + view[1] * CELL) / LOGICAL * 100) + '%';
    node.style.top = ((PAD + view[0] * CELL) / LOGICAL * 100) + '%';
    host.appendChild(node);
    const remove = () => { if (node.parentNode) node.parentNode.removeChild(node); };
    Promise.resolve(resolveGomokuFinalArtUrl(role, reduced)).then(url => {
      if (request !== gomokuFinalArtVfxSeq || !node.isConnected) return;
      if (!url){ node.dataset.gomokuFinalVfxState = 'fallback'; setTimeout(remove, reduced ? 180 : 360); return; }
      node.onload = () => { if (request !== gomokuFinalArtVfxSeq || !node.isConnected) return; node.dataset.gomokuFinalVfxState = 'ready'; setTimeout(remove, reduced ? 260 : 920); };
      node.onerror = () => { node.dataset.gomokuFinalVfxState = 'fallback'; setTimeout(remove, reduced ? 180 : 300); };
      node.src = url;
    }).catch(() => { if (request === gomokuFinalArtVfxSeq && node.isConnected){ node.dataset.gomokuFinalVfxState = 'fallback'; setTimeout(remove, reduced ? 180 : 300); } });
    return true;
  }
  function drawGomokuFinalStone(x, y, player, skin){
    const safeSkin = typeof GOMOKU_FINAL_ART_PIECES !== 'undefined' && GOMOKU_FINAL_ART_PIECES.includes(skin) ? skin : 'black-white';
    ensureGomokuFinalPieceImage(safeSkin);
    const image = gomokuFinalArtPieceImages.get(safeSkin), radius = CELL * .42;
    ctx.save(); ctx.shadowColor = 'rgba(33,25,35,.34)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
    if (image && typeof ctx.drawImage === 'function'){
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
      try { ctx.drawImage(image, player === 0 ? 0 : 256, 0, 256, 512, x - radius, y - radius, radius * 2, radius * 2); ctx.restore(); return; }
      catch (_error) {}
    }
    const palette = {
      'black-white':['#15131A','#F8F2E8'],'jade':['#176D60','#BCE4C4'],'crystal':['#245BB7','#C6E8FF'],'glow':['#B86A12','#FFE59A'],'obsidian':['#090A10','#5F687C'],
    }[safeSkin] || ['#15131A','#F8F2E8'];
    const base = player === 0 ? palette[0] : palette[1], shine = player === 0 ? palette[1] : palette[0];
    const gradient = ctx.createRadialGradient(x - radius*.28, y - radius*.3, radius*.06, x, y, radius);
    if (gradient && gradient.addColorStop){ gradient.addColorStop(0, shine); gradient.addColorStop(.32, base); gradient.addColorStop(1, player === 0 ? '#05070b' : '#fffdf7'); }
    ctx.fillStyle = gradient || base; ctx.strokeStyle = '#211923'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFF9F2'; ctx.globalAlpha = .48; ctx.beginPath(); ctx.arc(x - radius*.32, y - radius*.36, radius*.14, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    if (safeSkin === 'glow' || safeSkin === 'crystal'){ ctx.strokeStyle = safeSkin === 'glow' ? '#F1B640' : '#508BF0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, radius - 3.5, 0, Math.PI*2); ctx.stroke(); }
    ctx.restore();
  }
  function initGomokuFinalArtSurface(){
    if (!gomokuFinalArtRequested || typeof resolveGomokuFinalArtUrl !== 'function') return;
    const role = gomokuFinalBoardRole(), reduced = prefersReducedMotion();
    Promise.resolve(resolveGomokuFinalArtUrl(role, reduced)).then(url => {
      if (opts.destroyed) return;
      if (!url){ gomokuFinalArtState = 'fallback'; applyPresentation(); draw(); return; }
      const probe = gomokuFinalArtImageFactory();
      if (!probe){ gomokuFinalArtState = 'fallback'; applyPresentation(); draw(); return; }
      let settled = false;
      const fallback = () => { if (settled || opts.destroyed) return; settled = true; gomokuFinalArtActive = false; gomokuFinalArtState = 'fallback'; applyPresentation(); draw(); };
      const activate = () => { if (settled || opts.destroyed) return; settled = true; gomokuFinalArtBoardUrl = url; gomokuFinalArtActive = true; gomokuFinalArtState = 'active'; applyPresentation(); draw(); };
      probe.onload = () => { if (typeof probe.decode !== 'function') activate(); else Promise.resolve(probe.decode()).then(activate, fallback); };
      probe.onerror = fallback; probe.decoding = 'async'; probe.src = url;
    }).catch(() => { if (!opts.destroyed){ gomokuFinalArtState = 'fallback'; applyPresentation(); draw(); } });
  }
  function applyPresentation(){
    const tabletop = tabletopMode();
    if (typeof markTabletopSurface === 'function') markTabletopSurface(canvas, 'gomoku-board', { variant: boardTheme });
    canvas.dataset.boardTheme = boardTheme;
    canvas.dataset.pieceSkin = cosmetic.default;
    canvas.dataset.stickerArt = stickerArtState;
    const finalMode = gomokuFinalArtActive && !stickerArtActive;
    canvas.dataset.gomokuFinalArt = finalMode ? gomokuFinalArtState : 'fallback';
    if (finalMode){
      canvas.classList.add('game-art-v1'); canvas.classList.add('game-art-gomoku-final-v1'); canvas.classList.remove('game-art-sticker-v1');
      setAssetCssUrl(canvas, '--game-board-art', gomokuFinalArtBoardUrl);
      canvas.style.backgroundColor = boardTheme === 'grass' ? '#AFC98E' : '#D6A66D'; canvas.style.backgroundImage = '';
    } else if (tabletop){
      canvas.classList.remove('game-art-gomoku-final-v1');
      canvas.classList.remove('game-art-v1'); canvas.classList.remove('game-art-sticker-v1'); clearBoardAsset();
      canvas.dataset.tabletopArt = 'wave-a';
      canvas.style.backgroundColor = '#F3E5C4';
      canvas.style.backgroundImage = 'linear-gradient(135deg,rgba(255,249,242,.86),rgba(243,229,196,.93))';
    } else if (boardTheme === 'grass'){
      canvas.classList.remove('game-art-gomoku-final-v1');
      delete canvas.dataset.tabletopArt;
      canvas.classList.remove('game-art-v1'); canvas.classList.remove('game-art-sticker-v1');
      canvas.style.backgroundColor = '#86a96b';
      canvas.style.backgroundImage = 'radial-gradient(circle at 20% 15%,rgba(255,255,255,.24),transparent 34%),repeating-linear-gradient(105deg,rgba(35,92,45,.13) 0 2px,transparent 2px 7px),linear-gradient(#9fc17f,#668e57)';
    } else if (stickerArtActive) {
      canvas.classList.remove('game-art-gomoku-final-v1');
      delete canvas.dataset.tabletopArt;
      canvas.classList.add('game-art-v1'); canvas.classList.add('game-art-sticker-v1');
      setAssetCssUrl(canvas, '--game-board-art', stickerAssetUrl);
      canvas.style.backgroundColor = '#F1B640'; canvas.style.backgroundImage = '';
    } else if (legacyArtEnabled) {
      delete canvas.dataset.tabletopArt;
      canvas.classList.add('game-art-v1'); canvas.classList.remove('game-art-sticker-v1');
      setAssetCssUrl(canvas, '--game-board-art', gameArtUrl('gomoku', 'board'));
      canvas.style.backgroundColor = '#d7a153'; canvas.style.backgroundImage = '';
    } else {
      delete canvas.dataset.tabletopArt;
      canvas.classList.remove('game-art-v1'); canvas.classList.remove('game-art-sticker-v1'); clearBoardAsset();
      canvas.style.backgroundColor = '#e6c58b';
      canvas.style.backgroundImage = 'linear-gradient(100deg,rgba(105,63,22,.12),transparent 35%,rgba(105,63,22,.08))';
    }
  }
  function drawStickerStone(x, y, player, skin){
    const radius = CELL * .42, base = player === 0 ? '#443443' : '#FFF9F2', shade = player === 0 ? '#211923' : '#F3E5C4';
    ctx.save();
    ctx.shadowColor = 'rgba(33,25,35,.28)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 2.5; ctx.shadowOffsetY = 3.5;
    ctx.fillStyle = base; ctx.strokeStyle = '#211923'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, radius - 1.5, 0, Math.PI*2); ctx.clip();
    ctx.fillStyle = shade; ctx.globalAlpha = player === 0 ? .62 : .9;
    ctx.fillRect(x, y, radius + 2, radius + 2); ctx.restore();
    ctx.fillStyle = player === 0 ? '#FFF9F2' : '#FFFFFF';
    ctx.beginPath(); ctx.arc(x - radius*.34, y - radius*.38, radius*.14, 0, Math.PI*2); ctx.fill();
    if (skin === 'glow'){
      ctx.strokeStyle = player === 0 ? '#508BF0' : '#E45CA4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, radius - 3.5, 0, Math.PI*2); ctx.stroke();
    }
  }
  function clearMoveImpact(){
    if (impactTimer){ clearTimeout(impactTimer); gomokuWaveCProcessTimers.delete(impactTimer); impactTimer = null; }
    moveImpact = null;
  }
  function triggerMoveImpact(r,c){
    clearMoveImpact();
    showGomokuFinalVfx('last', r, c);
    showGomokuFinalVfx('placement', r, c);
    const startedAt = Date.now(), reduced = prefersReducedMotion();
    moveImpact = { r, c, startedAt, reduced, epoch:gomokuWaveCProcessEpoch, expiresAt: reduced ? Infinity : startedAt + 680 };
    if (reduced) return;
    const tick = () => {
      if (opts.destroyed || gomokuDestroyed || !moveImpact || moveImpact.epoch !== gomokuWaveCProcessEpoch) return;
      if (Date.now() >= moveImpact.expiresAt){ clearMoveImpact(); draw(); return; }
      draw(); impactTimer = gomokuWaveCLater(tick, 50);
    };
    impactTimer = gomokuWaveCLater(tick, 16);
  }
  function drawMoveImpact(){
    if (!moveImpact) return;
    const view = gomokuViewCell(moveImpact.r, moveImpact.c), x = PAD + view[1]*CELL, y = PAD + view[0]*CELL;
    const elapsed = Math.max(0, Date.now() - moveImpact.startedAt);
    const progress = moveImpact.reduced ? 0 : Math.min(1, elapsed / Math.max(1, moveImpact.expiresAt - moveImpact.startedAt));
    const alpha = moveImpact.reduced ? .72 : Math.max(0, .82 * (1 - progress));
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = '#211923'; ctx.lineWidth = moveImpact.reduced ? 2.4 : 2.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, CELL * (.48 + progress * .68), 0, Math.PI*2); ctx.stroke();
    if (!moveImpact.reduced){
      for (let i=0;i<8;i++){
        const angle = i * Math.PI / 4, inner = CELL * (.62 + progress * .34), outer = CELL * (1.02 + progress * .28);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(angle)*inner, y + Math.sin(angle)*inner); ctx.lineTo(x + Math.cos(angle)*outer, y + Math.sin(angle)*outer); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawGomokuKeyboardFocus(){
    if (!gomokuKeyboardFocusActive || !Array.isArray(gomokuKeyboardCell)) return;
    const view = gomokuViewCell(gomokuKeyboardCell[0], gomokuKeyboardCell[1]);
    const x = PAD + view[1] * CELL, y = PAD + view[0] * CELL;
    ctx.save();
    ctx.strokeStyle = '#508BF0'; ctx.lineWidth = 2.4;
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(x, y, CELL * .48, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function gomokuViewTurns(){return opts.online&&!spectator&&Number(opts.myIdx)===1?2:0;}
  function gomokuViewCell(r,c){return typeof TabletopPerspective!=='undefined'&&TabletopPerspective?TabletopPerspective.squareCell(N,r,c,gomokuViewTurns()):[r,c];}
  function gomokuLogicalCell(r,c){return typeof TabletopPerspective!=='undefined'&&TabletopPerspective?TabletopPerspective.squareCell(N,r,c,gomokuViewTurns()):[r,c];}
  function draw(){
    const tabletop = tabletopMode();
    if (!tabletop && canvas.dataset.tabletopArt === 'wave-a') applyPresentation();
    if (typeof markTabletopSurface === 'function') markTabletopSurface(canvas, 'gomoku-board', { variant: boardTheme });
    canvas.dataset.viewQuarterTurns = String(gomokuViewTurns());
    const finalMode = gomokuFinalArtActive && !stickerArtActive;
    const stickerMode = tabletop || (stickerArtActive && boardTheme === 'classic');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LOGICAL, LOGICAL);
    ctx.strokeStyle = finalMode ? '#211923' : (tabletop ? '#443443' : (boardTheme === 'grass' ? 'rgba(30,61,31,.72)' : (stickerMode ? '#443443' : (legacyArtEnabled ? 'rgba(76,43,15,.68)' : '#8a6638'))));
    ctx.lineWidth = finalMode ? 2.6 : (stickerMode ? 3.2 : 1); ctx.lineCap = (finalMode || stickerMode) ? 'round' : 'butt';
    for (let i=0;i<N;i++){
      ctx.beginPath(); ctx.moveTo(PAD + i*CELL, PAD); ctx.lineTo(PAD + i*CELL, PAD + (N-1)*CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD, PAD + i*CELL); ctx.lineTo(PAD + (N-1)*CELL, PAD + i*CELL); ctx.stroke();
    }
    ctx.fillStyle = finalMode ? '#211923' : (stickerMode ? '#211923' : (legacyArtEnabled ? '#5b3615' : '#1d2433'));
    for (const [r,c] of [[3,3],[3,11],[7,7],[11,3],[11,11]]){
      ctx.beginPath(); ctx.arc(PAD + c*CELL, PAD + r*CELL, stickerMode ? 3.5 : 3, 0, Math.PI*2); ctx.fill();
    }
    for (let r=0;r<N;r++) for (let c=0;c<N;c++){
      if (grid[r][c] === -1) continue;
      const view = gomokuViewCell(r,c), x = PAD + view[1]*CELL, y = PAD + view[0]*CELL;
      const skin = pieceSkin(grid[r][c]);
      if (finalMode){ drawGomokuFinalStone(x, y, grid[r][c], skin); continue; }
      if (stickerMode){ drawStickerStone(x, y, grid[r][c], skin); continue; }
      const stone = ctx.createRadialGradient(x-CELL*.14, y-CELL*.16, CELL*.05, x, y, CELL*.44);
      if (stone && stone.addColorStop){
        if (grid[r][c] === 0){
          stone.addColorStop(0, skin === 'glow' ? '#7dd3fc' : '#586172'); stone.addColorStop(.32, skin === 'glow' ? '#1d4ed8' : '#202733'); stone.addColorStop(1, '#05070b');
        } else {
          stone.addColorStop(0, '#ffffff'); stone.addColorStop(.52, skin === 'glow' ? '#f0abfc' : '#f3efe4'); stone.addColorStop(1, skin === 'glow' ? '#9333ea' : '#c8c0af');
        }
      }
      ctx.save();
      ctx.shadowColor = 'rgba(8,12,22,.32)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
      ctx.fillStyle = stone || PLAYER_COLORS[grid[r][c]];
      ctx.beginPath(); ctx.arc(x, y, CELL*0.42, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = grid[r][c] === 0 ? 'rgba(255,255,255,.18)' : 'rgba(92,76,52,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, CELL*0.39, 0, Math.PI*2); ctx.stroke();
    }
    if (last){
      const lastView = gomokuViewCell(last[0],last[1]), x = PAD + lastView[1]*CELL, y = PAD + lastView[0]*CELL;
      ctx.strokeStyle = finalMode ? '#E45CA4' : (stickerMode ? '#EF665F' : (grid[last[0]][last[1]] === 1 ? '#111827' : '#fff')); ctx.lineWidth = (finalMode || stickerMode) ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, CELL * (stickerMode ? .12 : .18), 0, Math.PI*2);
      if (finalMode) { ctx.fillStyle = '#E45CA4'; ctx.fill(); } else if (stickerMode) { ctx.fillStyle = '#EF665F'; ctx.fill(); } else ctx.stroke();
    }
    if (ghost && !spectator && !over && grid[ghost[0]][ghost[1]] === -1){
      ctx.save(); ctx.globalAlpha = (finalMode || stickerMode) ? .5 : .36; ctx.fillStyle = cur === 0 ? '#211923' : '#FFF9F2';
      ctx.strokeStyle = (finalMode || stickerMode) ? '#443443' : ctx.fillStyle; ctx.lineWidth = (finalMode || stickerMode) ? 2 : 1;
      if ((finalMode || stickerMode) && typeof ctx.setLineDash === 'function') ctx.setLineDash([5,4]);
      const ghostView=gomokuViewCell(ghost[0],ghost[1]);
      ctx.beginPath(); ctx.arc(PAD + ghostView[1]*CELL, PAD + ghostView[0]*CELL, CELL*.4, 0, Math.PI*2);
      if (stickerMode) ctx.stroke(); else ctx.fill(); ctx.restore();
    }
    if (winLine.length){
      const first = winLine[0], end = winLine[winLine.length - 1];
      const firstView=gomokuViewCell(first[0],first[1]),endView=gomokuViewCell(end[0],end[1]);
      let x1 = PAD + firstView[1]*CELL, y1 = PAD + firstView[0]*CELL, x2 = PAD + endView[1]*CELL, y2 = PAD + endView[0]*CELL;
      if (finalMode || stickerMode){
        const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy)||1,offset=CELL*.48;
        x1 += -dy/length*offset; y1 += dx/length*offset; x2 += -dy/length*offset; y2 += dx/length*offset;
      }
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      if (finalMode){ ctx.strokeStyle='#211923'; ctx.lineWidth=8; ctx.stroke(); ctx.strokeStyle='#F1B640'; ctx.lineWidth=4; }
      else if (stickerMode){ ctx.strokeStyle='#211923'; ctx.lineWidth=7; ctx.stroke(); ctx.strokeStyle='#F1B640'; ctx.lineWidth=3.5; }
      else { ctx.strokeStyle='#facc15'; ctx.lineWidth=5; }
      ctx.stroke();
    }
    drawMoveImpact();
    drawGomokuKeyboardFocus();
    updateGomokuTouchControls();
    updateHud();
    queueGomokuGhost3DFrame();
  }
  function initStickerSurface(){
    if (!stickerArtRequested) return;
    Promise.resolve(resolveStickerArtUrl('gomoku', 'board')).then(url => {
      if (opts.destroyed) return;
      if (!url){ stickerArtState = 'fallback'; applyPresentation(); draw(); return; }
      stickerAssetUrl = url;
      const probe = document.createElement('img');
      let settled = false;
      stickerAssetProbe = probe; canvas._stickerAssetProbe = probe;
      probe.alt = ''; probe.decoding = 'async';
      const fallback = () => {
        if (settled || opts.destroyed || stickerAssetProbe !== probe) return;
        settled = true; stickerArtActive = false; stickerArtState = 'fallback'; applyPresentation(); draw();
      };
      const activate = () => {
        if (settled || opts.destroyed || stickerAssetProbe !== probe) return;
        if (!stickerArtEnabled('gomoku')) { fallback(); return; }
        settled = true; stickerArtActive = true; stickerArtState = 'active'; applyPresentation(); draw();
      };
      probe.addEventListener('load', () => {
        if (typeof probe.decode !== 'function'){ activate(); return; }
        let decoded;
        try { decoded = probe.decode(); }
        catch (error) { fallback(); return; }
        Promise.resolve(decoded).then(activate, fallback);
      });
      probe.addEventListener('error', fallback);
      probe.src = url;
    }).catch(() => {
      if (opts.destroyed) return;
      stickerArtState = 'fallback'; applyPresentation(); draw();
    });
  }
  function pointerCell(e){
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * LOGICAL;
    const y = (e.clientY - rect.top) / rect.height * LOGICAL;
    const view=[Math.round((y - PAD) / CELL), Math.round((x - PAD) / CELL)];
    return gomokuLogicalCell(view[0],view[1]);
  }
  function setGomokuKeyboardCell(r, c){
    const row = Math.max(0, Math.min(N - 1, Number.isInteger(r) ? r : Math.floor(N / 2)));
    const column = Math.max(0, Math.min(N - 1, Number.isInteger(c) ? c : Math.floor(N / 2)));
    gomokuKeyboardCell = [row, column];
    canvas.dataset.gomokuKeyboardCell = gomokuWaveBCoordinate(gomokuKeyboardCell);
    return gomokuKeyboardCell;
  }
  function canPlaceLocalGomokuMove(){
    return !opts.destroyed && !gomokuDestroyed && !over && !spectator &&
      (!opts.online || cur === opts.myIdx) && !(opts.ai && opts.ai.has(cur));
  }
  function setGomokuKeyboardProcess(){
    const [r, c] = gomokuKeyboardCell;
    if (canPlaceLocalGomokuMove() && grid[r][c] === -1) setGomokuWaveCProcess('aim', gomokuWaveBCoordinate(gomokuKeyboardCell));
    else if (gomokuWaveCProcess === 'aim' || gomokuWaveCProcess === 'select') setGomokuWaveCProcess('turn');
  }
  function moveGomokuKeyboardCell(dr, dc){
    setGomokuKeyboardCell(gomokuKeyboardCell[0] + dr, gomokuKeyboardCell[1] + dc);
    setGomokuKeyboardProcess();
    draw();
  }
  function placeLocalGomokuMove(r, c){
    if (!canPlaceLocalGomokuMove() || !Number.isInteger(r) || !Number.isInteger(c) ||
      r < 0 || r >= N || c < 0 || c >= N || grid[r][c] !== -1) return false;
    setGomokuKeyboardCell(r, c);
    setGomokuWaveCProcess('select', gomokuWaveBCoordinate([r, c]));
    if (opts.onProgress) opts.onProgress([r, c]);
    if (opts.online) opts.sendMove([r, c]);
    return applyMove(r, c);
  }
  function handleGomokuKeyboardFocus(){
    if (opts.destroyed || gomokuDestroyed) return;
    gomokuKeyboardFocusActive = true;
    setGomokuKeyboardCell(gomokuKeyboardCell[0], gomokuKeyboardCell[1]);
    draw();
  }
  function handleGomokuKeyboardBlur(){
    if (!gomokuKeyboardFocusActive) return;
    gomokuKeyboardFocusActive = false;
    draw();
  }
  function handleGomokuKeyboardInput(event){
    if (opts.destroyed || gomokuDestroyed) return;
    const key = event && event.key;
    const directions = {
      ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1],
    };
    if (Object.prototype.hasOwnProperty.call(directions, key)){
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      moveGomokuKeyboardCell(directions[key][0], directions[key][1]);
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar' || (event && event.code === 'Space')){
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      placeLocalGomokuMove(gomokuKeyboardCell[0], gomokuKeyboardCell[1]);
    }
  }
  canvas.addEventListener('mousemove', e => {
    if (!canPlaceLocalGomokuMove()) return;
    const [r, c] = pointerCell(e);
    ghost = Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < N && c >= 0 && c < N && grid[r][c] === -1 ? [r, c] : null;
    if (ghost) setGomokuWaveCProcess('aim', gomokuWaveBCoordinate(ghost));
    else if (gomokuWaveCProcess === 'aim' || gomokuWaveCProcess === 'select') setGomokuWaveCProcess('turn');
    draw();
  });
  canvas.addEventListener('pointerdown', e => {
    if (!canPlaceLocalGomokuMove()) return;
    const [r, c] = pointerCell(e);
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= N || c < 0 || c >= N || grid[r][c] !== -1) return;
    ghost = [r,c];
    setGomokuKeyboardCell(r, c);
    setGomokuWaveCProcess('select', gomokuWaveBCoordinate(ghost));
    draw();
  });
  canvas.addEventListener('mouseleave', () => {
    if (ghost){ ghost = null; draw(); }
    if (gomokuWaveCProcess === 'aim' || gomokuWaveCProcess === 'select') setGomokuWaveCProcess('turn');
  });
  canvas.addEventListener('click', e => {
    if (!canPlaceLocalGomokuMove()) return;
    const [r, c] = pointerCell(e);
    placeLocalGomokuMove(r, c);
  });
  canvas.addEventListener('focus', handleGomokuKeyboardFocus);
  canvas.addEventListener('blur', handleGomokuKeyboardBlur);
  canvas.addEventListener('keydown', handleGomokuKeyboardInput);
  function applyMove(r, c){
    if (Array.isArray(r)){ c = r[1]; r = r[0]; }
    r = Number(r); c = Number(c);
    if (over || !Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= N || c < 0 || c >= N || grid[r][c] !== -1) return false;
    cancelAIWork();
    grid[r][c] = cur; last = [r,c]; hist.push([r,c]);
    const moveAudioSequence = ++gomokuAudioSequence;
    audioCue('gomoku_place', { actionId:'gomoku-place-' + gomokuAudioSession + '-' + moveAudioSequence + '-' + r + '-' + c, reaction:'place' }, 1);
    if(typeof emitGameStage25DEvent==='function')emitGameStage25DEvent({type:'piece_landed',game:'gomoku',row:r,col:c,size:N,player:cur,reducedMotion:prefersReducedMotion()});
    if (gomokuGhost3DActive && gomokuGhost3DHost){
      gomokuGhost3DPendingPlacement = { row:r, col:c, player:cur, generation:gomokuGhost3DGeneration };
    }
    if (checkGomokuWin(grid, r, c)){
      over = true; finishedAt = Date.now(); winLine = winningCells(r, c); ghost = null; area.style.touchAction = 'auto';
      audioCue('gomoku_line', { actionId:'gomoku-line-' + gomokuAudioSession + '-' + moveAudioSequence, reaction:'score' }, 1);
      startGomokuWaveCMoveProcess(r, c, 'line');
      showGomokuFinalVfx('line', r, c);
      triggerMoveImpact(r,c);
      if (opts.onEnd) opts.onEnd([
        { slot: cur, coins: 1, rank: 1 },
        { slot: cur ^ 1, coins: 0, rank: 2 },
      ]);
      draw(); renderPlayers(cur, null);
      setStatus(t('result_winner',cur+1), true);
      showGomokuOutcome({
        winner: cur, winnerName: t('player_number',cur+1), emoji: '🎉',
        subtitle: t('gomoku_five_line'), coins: 1, ...gomokuOutcomeAudio(cur, false), onRestart: reset, onShare: () => shareGameLink('gomoku'), onInvite: online.room && online.isHost ? () => openInvitePicker() : null
      });
      if(typeof emitGameStage25DEvent==='function'){
        const viewer=opts.online?Number(opts.myIdx):0;
        emitGameStage25DEvent({type:'result',game:'gomoku',outcome:spectator?'draw':(cur===viewer?'win':'loss'),winner:cur});
      }
      return true;
    }
    if (hist.length === N*N){
      over = true; finishedAt = Date.now(); ghost = null; area.style.touchAction = 'auto';
      startGomokuWaveCMoveProcess(r, c, 'terminal');
      showGomokuFinalVfx('draw', r, c);
      triggerMoveImpact(r,c);
      if (opts.onEnd) opts.onEnd([
        { slot: 0, coins: 0, rank: 1 },
        { slot: 1, coins: 0, rank: 1 },
      ]);
      draw(); renderPlayers(cur, null);
      setStatus(t('result_draw'), false);
      showGomokuOutcome({
        winner: 0, emoji: '🤝', subtitle: t('gomoku_board_full_draw'), coins: 0, ...gomokuOutcomeAudio(0, true), onRestart: reset, onShare: () => shareGameLink('gomoku')
      });
      if(typeof emitGameStage25DEvent==='function')emitGameStage25DEvent({type:'result',game:'gomoku',outcome:'draw'});
      return true;
    }
    cur ^= 1;
    startGomokuWaveCMoveProcess(r, c, 'turn');
    triggerMoveImpact(r,c);
    draw(); renderPlayers(cur, null);
    setStatus(opts.online ? t(cur === opts.myIdx ? 'gomoku_your_turn_hint' : 'gomoku_wait_opponent') : t('player_turn',cur+1));
    scheduleAI();
    return true;
  }
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (Array.isArray(payload) && payload.length === 2) applyMove(payload);
  };
  if (!opts.online && !spectator){
    const undoBtn = el('button','btn',t('undo'));
    undoBtn.addEventListener('click', () => {
      if (spectator || over || !hist.length) return;
      cancelAIWork();
      resetGomokuWaveCProcess('turn');
      const [r,c] = hist.pop();
      grid[r][c] = -1;
      cur ^= 1;
      last = hist.length ? hist[hist.length-1] : null;
      draw(); renderPlayers(cur, null);
      setStatus(t('player_turn',cur+1));
      scheduleAI();
    });
    extra.appendChild(undoBtn);
  }
  function resetLocal(){
    gomokuAudioSession++;
    cancelAIWork();
    clearGomokuFinalArtVfx();
    resetGomokuWaveCProcess('turn');
    grid = Array.from({length:N}, () => Array(N).fill(-1));
    cur = 0; over = false; hist = []; last = null; winLine = []; ghost = null; startedAt = Date.now(); finishedAt = 0; gomokuAudioSequence = 0;
    setGomokuKeyboardCell(Math.floor(N / 2), Math.floor(N / 2));
    area.style.touchAction = spectator ? 'auto' : 'none';
    if (gomokuGhost3DHost) restartGomokuGhost3DHost('reset');
    applyPresentation();
    draw(); renderPlayers(0, null);
    setStatus(opts.online ? t(cur === opts.myIdx ? 'gomoku_your_turn_hint' : 'gomoku_wait_opponent') : t('player_turn',1));
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast(t('host_only_restart')); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  function setBoardTheme(theme){
    boardTheme = theme === 'grass' ? 'grass' : 'classic';
    applyPresentation(); draw();
    if (gomokuFinalArtActive || gomokuFinalArtState === 'loading') initGomokuFinalArtSurface();
    return boardTheme;
  }
  function setCosmetic(value){ cosmetic = normalizeCosmetic(value); draw(); return { default:cosmetic.default, players:{...cosmetic.players} }; }
  function setSpectators(value){
    const nextSpectator = Array.isArray(value) ? value.includes(opts.viewerId) : !!value;
    if (!spectator && nextSpectator) cancelAIWork();
    spectator = nextSpectator;
    spectators = Array.isArray(value) ? value.slice() : spectators;
    area.style.touchAction = spectator || over ? 'auto' : 'none';
    ghost = null;
    if (spectator) showGomokuFinalVfx('spectate');
    if (!over && (gomokuWaveCProcess === 'aim' || gomokuWaveCProcess === 'select')) setGomokuWaveCProcess('turn');
    draw();
    return spectator;
  }
  function startMatch(playerA, playerB){ activePlayers = [playerA, playerB]; resetLocal(); return { activePlayers: activePlayers.slice(), spectators: spectators.slice() }; }
  function getMatchStats(){ return { duration: Math.max(0, (finishedAt || Date.now()) - startedAt), moves: hist.length, winner: over && winLine.length ? cur : null }; }
  function reportGameResult(){ const stats = getMatchStats(); if (typeof opts.reportGameResult === 'function') opts.reportGameResult(stats); return stats; }
  function getPresentationState(){
    return {
      process:gomokuWaveCProcess,
      detail:gomokuWaveCProcessDetail,
      revision:gomokuWaveCProcessRevision,
      terminal:!!(over || gomokuWaveCTerminalPending || gomokuWaveCTerminalLocked),
    };
  }
  function snapshot(){ return { hist: hist.map(h => h.slice()), cur, over, last: last ? last.slice() : null }; }
  function onRestore(value){
    const state = value && value.state ? value.state : value;
    if (!state || !Array.isArray(state.hist)) return false;
    cancelAIWork();
    gomokuAudioSession++; gomokuAudioSequence = 0;
    clearGomokuFinalArtVfx();
    if (value && value.reconnecting === true) showGomokuFinalVfx('reconnect');
    if ((gomokuWaveCTerminalLocked || gomokuWaveCTerminalPending) && !state.over) return false;
    cancelGomokuBoardAI('restore');
    gomokuWaveCProcessEpoch++;
    clearGomokuWaveCProcessTimers();
    moveImpact = null;
    gomokuGhost3DPendingPlacement = null;
    grid = Array.from({length:N}, () => Array(N).fill(-1)); hist = [];
    state.hist.forEach((move, index) => { if (Array.isArray(move) && move.length === 2 && grid[move[0]] && grid[move[0]][move[1]] === -1){ grid[move[0]][move[1]] = index % 2; hist.push([move[0], move[1]]); } });
    cur = Number(state.cur) === 1 ? 1 : 0; over = !!state.over; last = Array.isArray(state.last) ? state.last.slice(0, 2) : (hist.length ? hist[hist.length - 1].slice() : null);
    winLine = over && last ? winningCells(last[0], last[1]) : [];
    gomokuWaveCTerminalPending = false;
    gomokuWaveCTerminalLocked = over;
    setGomokuWaveCProcess(over ? 'terminal' : 'turn');
    if (value && value.presentation){ boardTheme = value.presentation.boardTheme === 'grass' ? 'grass' : 'classic'; cosmetic = normalizeCosmetic(value.presentation.cosmetic); }
    applyPresentation(); draw(); renderPlayers(cur, null); return true;
  }
  if (gomokuFinalArtRequested) initGomokuFinalArtSurface();
  if (!tabletopMode()) initStickerSurface();
  resetLocal();
  if (gomokuGhost3DActive) restartGomokuGhost3DHost('mount');
  return {
    reset, onMove: opts.onMove, onRestart: resetLocal, snapshot, onRestore,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic:{default:cosmetic.default,players:{...cosmetic.players}} }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, startMatch, reportGameResult, getMatchStats, getPresentationState,
    whenIdle: () => Promise.resolve(),
    destroy: () => {
      gomokuDestroyed = true; opts.destroyed = true; stickerAssetProbe = null; cancelAIWork(); gomokuWaveCProcessEpoch++; clearGomokuWaveCProcessTimers(); clearGomokuFinalArtVfx(); gomokuFinalArtPieceImages.clear(); gomokuFinalArtPieceRequests.clear(); disposeGomokuBoardAI();
      if (typeof canvas.removeEventListener === 'function'){
        canvas.removeEventListener('focus', handleGomokuKeyboardFocus);
        canvas.removeEventListener('blur', handleGomokuKeyboardBlur);
        canvas.removeEventListener('keydown', handleGomokuKeyboardInput);
      }
      clearMoveImpact(); disposeGomokuGhost3DBridge(); releaseGomokuTouchControls(); releaseGomokuWaveBPresentation();
      area.style.touchAction = previousTouchAction; area.style.overscrollBehavior = previousOverscroll;
    },
  };
}
