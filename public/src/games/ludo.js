/* ================= 飞行棋 ================= */
function gameLudo(area, extra, n, opts){
  opts = opts || {};
  const TRACK = 52, HOME = 56;
  const pids = n === 2 ? [0,2] : (n === 3 ? [0,1,2] : [0,1,2,3]);
  const START = [0,13,26,39];
  const color = pid => PLAYER_COLORS[pid];
  let tokens = pids.map(() => Array(4).fill(-1));
  let curIdx = 0, phase = 'roll', dice = 0, over = false, winner = -1;
  let boardTheme = opts.boardTheme === 'grass' ? 'grass' : 'classic';
  let cosmetic = normalizeCosmetic(opts.cosmetic);
  let spectator = !!opts.spectator, startedAt = Date.now(), finishedAt = 0;
  let captures = 0, takeoffs = 0;
  let movingToken = null;
  let remoteInputs = [], drainingRemoteInputs = false, epoch = 0;
  let S = 520;
  // Wave C is a local, disposable process rail. It is deliberately kept out
  // of the rule state: the server and Replay still only see snapshot().
  const LUDO_WAVE_C_PROCESS_STEPS = ['roll','dice','pick','move','capture','finish','ranking','turn-end'];
  let ludoWaveCProcess = 'roll', ludoWaveCProcessDetail = '';
  let ludoWaveCProcessTimers = new Set();
  let ludoWaveCProcessRail = null, ludoWaveCProcessLabel = null, ludoWaveCProcessSteps = [];
  let ludoIdleWaiters = [];
  function ludoWaveCLater(callback, delay){
    let timer = null;
    timer = setTimeout(() => {
      ludoWaveCProcessTimers.delete(timer);
      try { callback(); }
      finally { notifyLudoIdle(); }
    }, delay);
    ludoWaveCProcessTimers.add(timer);
    return timer;
  }
  function clearLudoWaveCProcessTimers(){
    ludoWaveCProcessTimers.forEach(timer => clearTimeout(timer));
    ludoWaveCProcessTimers.clear();
  }
  function ludoIsIdle(){
    return phase !== 'rolling' && !drainingRemoteInputs && !aiPending && movingToken === null && ludoWaveCProcessTimers.size === 0;
  }
  function notifyLudoIdle(force){
    if (!force && !ludoIsIdle()) return;
    const waiters = ludoIdleWaiters.splice(0);
    waiters.forEach(resolve => resolve());
  }
  function whenLudoIdle(){ return ludoIsIdle() ? Promise.resolve() : new Promise(resolve => ludoIdleWaiters.push(resolve)); }
  // Wave B is intentionally a local presentation seam. A missing flag keeps
  // the code-native stage on, only the exact string "0" restores Wave A, and
  // unavailable storage fails closed without touching Ludo state or wire data.
  const LUDO_WAVE_B_STORAGE_KEY = 'mg_art_game_stage_wave_b_v1';
  function ludoWaveBEnabled(){
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      if (!storage || typeof storage.getItem !== 'function') return false;
      return storage.getItem(LUDO_WAVE_B_STORAGE_KEY) !== '0';
    } catch (_error) {
      return false;
    }
  }
  let ludoWaveBActive = ludoWaveBEnabled();
  let ludoWaveBMountFailed = false;
  let ludoWaveBStage = null, ludoWaveBBoardFrame = null, ludoWaveBMeta = null;
  let ludoWaveBTurn = null, ludoWaveBState = null, ludoWaveBRankings = null, ludoWaveBCommand = null;
  function ludoWaveBClass(node, className, enabled){
    if (!node || !node.classList) return;
    if (enabled) node.classList.add(className); else node.classList.remove(className);
  }
  function ludoWaveBData(node, name, value){
    if (!node) return;
    const attr = 'data-' + name;
    const key = name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    if (value === null || value === undefined){
      if (typeof node.removeAttribute === 'function') node.removeAttribute(attr);
      else if (node.dataset) delete node.dataset[key];
      return;
    }
    if (typeof node.setAttribute === 'function') node.setAttribute(attr, String(value));
    else if (node.dataset) node.dataset[key] = String(value);
  }
  function ludoWaveCProcessText(){
    if (ludoWaveCProcess === 'dice') return t('ludo_player_rolling', curIdx + 1);
    if (ludoWaveCProcess === 'pick') return t('ludo_choose_plane');
    if (ludoWaveCProcess === 'move') return t('ludo_move_complete', curIdx + 1);
    if (ludoWaveCProcess === 'capture') return t('ludo_captured', Number(ludoWaveCProcessDetail) || 1);
    if (ludoWaveCProcess === 'finish') return t('ludo_all_home');
    if (ludoWaveCProcess === 'ranking') return t('victory_podium_label');
    if (ludoWaveCProcess === 'turn-end') return t('ludo_next_turn', '', curIdx + 1);
    return t('ludo_roll_die');
  }
  function paintLudoWaveCProcess(){
    if (!ludoWaveBActive || !ludoWaveBStage) return;
    [area, ludoWaveBStage, board].forEach(node => ludoWaveBData(node, 'ludo-process', ludoWaveCProcess));
    if (ludoWaveCProcessRail){
      ludoWaveBData(ludoWaveCProcessRail, 'ludo-process', ludoWaveCProcess);
      if (ludoWaveCProcessLabel) ludoWaveCProcessLabel.textContent = ludoWaveCProcessText();
    }
    ludoWaveCProcessSteps.forEach((step, index) => {
      const active = step && step.dataset && step.dataset.ludoProcessStep === ludoWaveCProcess;
      ludoWaveBData(step, 'ludo-process-active', active ? 'true' : 'false');
      ludoWaveBData(step, 'ludo-process-index', index);
    });
  }
  function setLudoWaveCProcess(next, detail){
    ludoWaveCProcess = LUDO_WAVE_C_PROCESS_STEPS.includes(next) ? next : 'roll';
    ludoWaveCProcessDetail = detail === undefined || detail === null ? '' : String(detail);
    paintLudoWaveCProcess();
  }
  function settleLudoWaveCProcess(next, detail){
    // A following extra turn may already have advanced to dice/pick while the
    // previous token flight is finishing.  Never let an old visual callback
    // rewind that newer player-facing process.
    if (ludoWaveCProcess === 'dice' || ludoWaveCProcess === 'pick' || ludoWaveCProcess === 'ranking') return false;
    setLudoWaveCProcess(next, detail);
    return true;
  }
  const board = el('div','ludo-board');
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = spectator ? 'auto' : 'none';
  area.style.overscrollBehavior = 'contain';
  area.appendChild(board);
  const turnHud = el('div', 'game-turn-hud ludo-turn-hud');
  extra.appendChild(turnHud);
  const diceBtn = el('button','dice-btn');
  const dice3d = makeDice3D(58);
  diceBtn.appendChild(dice3d.wrap);
  diceBtn.addEventListener('click', roll);
  extra.appendChild(diceBtn);
  function mountLudoWaveBPresentation(){
    if (!ludoWaveBActive || ludoWaveBStage || ludoWaveBMountFailed) return;
    try {
    ludoWaveBStage = el('section', 'ludo-wave-b-stage');
    ludoWaveBStage.setAttribute('role', 'group');
    ludoWaveBStage.setAttribute('aria-label', t('game_ludo'));
    ludoWaveBBoardFrame = el('div', 'ludo-wave-b-board-frame');
    ludoWaveBBoardFrame.setAttribute('role', 'group');
    ludoWaveBBoardFrame.setAttribute('aria-label', t('game_ludo'));
    ludoWaveBMeta = el('div', 'ludo-wave-b-meta');
    ludoWaveBMeta.setAttribute('role', 'status');
    ludoWaveBMeta.setAttribute('aria-live', 'polite');
    ludoWaveBTurn = el('output', 'ludo-wave-b-turn');
    ludoWaveBState = el('output', 'ludo-wave-b-state');
    ludoWaveBState.setAttribute('aria-live', 'polite');
    ludoWaveCProcessRail = el('section', 'ludo-wave-c-process');
    ludoWaveCProcessRail.setAttribute('role', 'status');
    ludoWaveCProcessRail.setAttribute('aria-live', 'polite');
    ludoWaveCProcessLabel = el('output', 'ludo-wave-c-process-label');
    const ludoWaveCProcessTrack = el('div', 'ludo-wave-c-process-track');
    ludoWaveCProcessSteps = LUDO_WAVE_C_PROCESS_STEPS.map(step => {
      const node = el('span', 'ludo-wave-c-process-step');
      ludoWaveBData(node, 'ludo-process-step', step);
      node.setAttribute('aria-hidden', 'true');
      ludoWaveCProcessTrack.appendChild(node);
      return node;
    });
    ludoWaveCProcessRail.appendChild(ludoWaveCProcessLabel);
    ludoWaveCProcessRail.appendChild(ludoWaveCProcessTrack);
    ludoWaveBRankings = el('ol', 'ludo-wave-b-rankings ludo-wave-b-standings');
    ludoWaveBRankings.setAttribute('aria-label', t('victory_podium_label'));
    ludoWaveBData(ludoWaveBTurn, 'ludo-region', 'turn');
    ludoWaveBData(ludoWaveBState, 'ludo-region', 'state');
    ludoWaveBData(ludoWaveCProcessRail, 'ludo-region', 'process');
    ludoWaveBData(ludoWaveBRankings, 'ludo-region', 'rankings');
    ludoWaveBMeta.appendChild(ludoWaveBTurn);
    ludoWaveBMeta.appendChild(ludoWaveBState);
    ludoWaveBMeta.appendChild(ludoWaveCProcessRail);
    ludoWaveBMeta.appendChild(ludoWaveBRankings);
    ludoWaveBBoardFrame.appendChild(board);
    ludoWaveBStage.appendChild(ludoWaveBBoardFrame);
    ludoWaveBStage.appendChild(ludoWaveBMeta);
    area.appendChild(ludoWaveBStage);
    ludoWaveBCommand = el('div', 'ludo-wave-b-command');
    ludoWaveBCommand.appendChild(turnHud);
    ludoWaveBCommand.appendChild(diceBtn);
    extra.appendChild(ludoWaveBCommand);
    ludoWaveBClass(area, 'ludo-wave-b-arena', true);
    ludoWaveBClass(board, 'ludo-wave-b-board', true);
    ludoWaveBClass(turnHud, 'ludo-wave-b-turn-hud', true);
    ludoWaveBClass(diceBtn, 'ludo-wave-b-dice', true);
    ludoWaveBData(area, 'game-stage-wave-b', 'active');
    ludoWaveBData(area, 'ludo-stage', 'wave-b');
    ludoWaveBData(ludoWaveBStage, 'ludo-stage', 'wave-b');
    ludoWaveBData(ludoWaveBBoardFrame, 'ludo-region', 'board');
    ludoWaveBData(board, 'ludo-region', 'board');
    ludoWaveBData(ludoWaveBCommand, 'ludo-region', 'command');
    ludoWaveBData(turnHud, 'ludo-region', 'turn');
    ludoWaveBData(diceBtn, 'ludo-control', 'dice');
    paintLudoWaveCProcess();
    } catch (_error) {
      try { releaseLudoWaveBPresentation(); } catch (_cleanupError) {}
      ludoWaveBMountFailed = true;
      ludoWaveBActive = false;
    }
  }
  function releaseLudoWaveBPresentation(){
    if (ludoWaveBStage){
      if (board.parentNode === ludoWaveBBoardFrame) area.appendChild(board);
      if (turnHud.parentNode === ludoWaveBCommand) extra.appendChild(turnHud);
      if (diceBtn.parentNode === ludoWaveBCommand) extra.appendChild(diceBtn);
      if (ludoWaveBCommand && ludoWaveBCommand.parentNode === extra) extra.removeChild(ludoWaveBCommand);
      if (typeof ludoWaveBStage.remove === 'function') ludoWaveBStage.remove();
      else if (ludoWaveBStage.parentNode && typeof ludoWaveBStage.parentNode.removeChild === 'function') ludoWaveBStage.parentNode.removeChild(ludoWaveBStage);
    }
    ludoWaveBClass(area, 'ludo-wave-b-arena', false);
    ludoWaveBClass(board, 'ludo-wave-b-board', false);
    ludoWaveBClass(turnHud, 'ludo-wave-b-turn-hud', false);
    ludoWaveBClass(diceBtn, 'ludo-wave-b-dice', false);
    ludoWaveBData(area, 'game-stage-wave-b', null);
    ludoWaveBData(area, 'ludo-stage', null);
    ludoWaveBData(area, 'ludo-phase', null);
    ludoWaveBData(area, 'ludo-status', null);
    ludoWaveBData(area, 'ludo-active-player', null);
    ludoWaveBData(area, 'ludo-process', null);
    ludoWaveBData(board, 'ludo-region', null);
    ludoWaveBData(board, 'ludo-phase', null);
    ludoWaveBData(board, 'ludo-active-player', null);
    ludoWaveBData(board, 'ludo-process', null);
    ludoWaveBData(turnHud, 'ludo-region', null);
    ludoWaveBData(turnHud, 'ludo-phase', null);
    ludoWaveBData(diceBtn, 'ludo-control', null);
    ludoWaveBData(diceBtn, 'ludo-dice-state', null);
    ludoWaveBData(diceBtn, 'ludo-roll', null);
    ludoWaveBStage = null; ludoWaveBBoardFrame = null; ludoWaveBMeta = null;
    ludoWaveBTurn = null; ludoWaveBState = null; ludoWaveBRankings = null; ludoWaveBCommand = null;
    ludoWaveCProcessRail = null; ludoWaveCProcessLabel = null; ludoWaveCProcessSteps = [];
  }
  function syncLudoWaveBPresentation(){
    const enabled = ludoWaveBEnabled();
    if (!enabled || ludoWaveBMountFailed){
      if (ludoWaveBStage) releaseLudoWaveBPresentation();
      ludoWaveBActive = false;
      return;
    }
    ludoWaveBActive = true;
    if (!ludoWaveBStage) mountLudoWaveBPresentation();
  }
  function ludoWaveBStatus(){
    if (over) return 'finished';
    if (spectator) return 'spectating';
    if (opts.ai && opts.ai.has(curIdx)) return 'thinking';
    if (opts.online && curIdx !== opts.myIdx) return 'waiting';
    return 'active';
  }
  function ludoWaveBStateText(status){
    if (status === 'finished') return t('match_over');
    if (status === 'spectating') return t('spectator_player_action', curIdx + 1);
    if (status === 'thinking') return t('ai_thinking');
    if (status === 'waiting') return t('opponent_turn');
    if (phase === 'rolling') return t('ludo_player_rolling', curIdx + 1);
    return t(phase === 'pick' ? 'ludo_choose_plane' : 'ludo_roll_die');
  }
  function clearLudoWaveBRankings(){
    if (!ludoWaveBRankings || !ludoWaveBRankings.children) return;
    while (ludoWaveBRankings.children.length){
      ludoWaveBRankings.removeChild(ludoWaveBRankings.children[0]);
    }
  }
  function updateLudoWaveBPresentation(){
    if (!ludoWaveBActive || !ludoWaveBStage) return;
    const status = ludoWaveBStatus();
    ludoWaveBData(ludoWaveBStage, 'game-stage-wave-b', 'active');
    ludoWaveBData(ludoWaveBStage, 'ludo-stage', 'wave-b');
    ludoWaveBData(area, 'ludo-phase', phase);
    ludoWaveBData(area, 'ludo-status', status);
    ludoWaveBData(area, 'ludo-active-player', curIdx);
    ludoWaveBData(ludoWaveBStage, 'ludo-phase', phase);
    ludoWaveBData(ludoWaveBStage, 'ludo-status', status);
    ludoWaveBData(ludoWaveBStage, 'ludo-active-player', curIdx);
    ludoWaveBData(board, 'ludo-phase', phase);
    ludoWaveBData(board, 'ludo-active-player', curIdx);
    ludoWaveBData(turnHud, 'ludo-phase', phase);
    ludoWaveBData(diceBtn, 'ludo-dice-state', phase);
    ludoWaveBData(diceBtn, 'ludo-roll', dice);
    ludoWaveBTurn.textContent = t('stage_current_turn') + ': ' + t('player_number', curIdx + 1);
    ludoWaveBState.textContent = ludoWaveBStateText(status);
    clearLudoWaveBRankings();
    const stats = getMatchStats();
    const rankedPlayers = pids.map((_pid, index) => index).sort((a, b) => stats.placement[a] - stats.placement[b] || a - b);
    rankedPlayers.forEach(index => {
      const entry = el('li', 'ludo-wave-b-ranking');
      const finished = stats.piecesFinished[index];
      ludoWaveBData(entry, 'ludo-player', index);
      ludoWaveBData(entry, 'ludo-rank', stats.placement[index]);
      ludoWaveBData(entry, 'ludo-home', finished);
      ludoWaveBData(entry, 'ludo-active', index === curIdx ? 'true' : 'false');
      entry.setAttribute('aria-current', index === curIdx ? 'true' : 'false');
      entry.textContent = t('victory_podium_rank', stats.placement[index]) + ' · ' + t('player_number', index + 1) + ' · ' + t('ludo_home_progress', finished);
      ludoWaveBRankings.appendChild(entry);
    });
    paintLudoWaveCProcess();
  }
  mountLudoWaveBPresentation();
  let aiPending = false;
  function normalizeCosmetic(value){
    const source = value || {};
    return { base:'classic',piece:'classic',dice:'classic',...source,players:{...(source.players||{})} };
  }
  function playerCosmetic(pi){ return { base:cosmetic.base,piece:cosmetic.piece,dice:cosmetic.dice,...(cosmetic.players&&cosmetic.players[pi]||{}) }; }
  function aiClamp(value, scale){ return Math.max(-1, Math.min(1, value / (scale || 1))); }
  function tokenProgress(position){ return position < 0 ? 0 : Math.min(HOME, position); }
  function playerProgress(pi, state){
    return state[pi].reduce((sum, position) => sum + tokenProgress(position), 0) / (HOME * 4);
  }
  function developmentBalance(list){
    const values = list.map(tokenProgress);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const spread = values.reduce((sum, value) => sum + Math.abs(value - mean), 0) / (values.length * HOME);
    return Math.max(0, 1 - spread * 2);
  }
  function captureCount(pi, destination, state){
    if (destination < 0 || destination > 50) return 0;
    const landing = cellOf(pids[pi], destination);
    let count = 0;
    state.forEach((list, other) => {
      if (other === pi) return;
      list.forEach(position => {
        if (position >= 0 && position <= 50 && cellOf(pids[other], position) === landing) count++;
      });
    });
    return count;
  }
  function simulateLudoMove(pi, ti, roll, state){
    const next = state.map(list => list.slice());
    const from = next[pi][ti];
    const destination = advanceToken(from, roll);
    const captured = captureCount(pi, destination, next);
    next[pi][ti] = destination;
    if (captured){
      const landing = cellOf(pids[pi], destination);
      next.forEach((list, other) => {
        if (other === pi) return;
        list.forEach((position, index) => {
          if (position >= 0 && position <= 50 && cellOf(pids[other], position) === landing) list[index] = -1;
        });
      });
    }
    return { state:next, from, destination, captured };
  }
  function captureRisk(pi, position, state){
    // 本规则中终点走廊/终点不会与公共轨道相交；公共轨道的“安全”按未来一轮实际骰面威胁计算。
    if (position < 0 || position > 50) return 0;
    const landing = cellOf(pids[pi], position);
    let survival = 1;
    state.forEach((list, other) => {
      if (other === pi) return;
      let threateningRolls = 0;
      for (let roll = 1; roll <= 6; roll++){
        const canCapture = list.some(enemy => {
          if (enemy === -1) return roll === 6 && cellOf(pids[other], 0) === landing;
          if (enemy < 0 || enemy >= HOME) return false;
          const destination = advanceToken(enemy, roll);
          return destination <= 50 && cellOf(pids[other], destination) === landing;
        });
        if (canCapture) threateningRolls++;
      }
      survival *= 1 - threateningRolls / 6;
    });
    return Math.max(0, Math.min(1, 1 - survival));
  }
  function futureMoveValue(pi, ti, roll, state){
    const from = state[pi][ti];
    if ((from === -1 && roll !== 6) || from >= HOME) return -Infinity;
    const outcome = simulateLudoMove(pi, ti, roll, state);
    const gain = tokenProgress(outcome.destination) - tokenProgress(from);
    const finish = outcome.destination === HOME && from !== HOME;
    const takeoff = from === -1;
    const risk = captureRisk(pi, outcome.destination, outcome.state);
    return gain * 1.5 + (finish ? 145 : 0) + outcome.captured * 55 + (takeoff ? 20 : 0) - risk * 42;
  }
  function expectedNextTurn(pi, state, rollLimit){
    let total = 0;
    const maxRoll = Math.max(1, Math.min(6, Number(rollLimit) || 6));
    for (let roll = 1; roll <= maxRoll; roll++){
      let best = 0;
      for (let ti = 0; ti < 4; ti++) best = Math.max(best, futureMoveValue(pi, ti, roll, state));
      total += best;
    }
    return total / maxRoll;
  }
  function ludoDifficultyProfile(difficulty){
    const id = difficulty && difficulty.id;
    if (id === 'easy') return { rolls:3, candidates:4, futureWeight:.16, exposureWeight:0 };
    if (id === 'hard') return { rolls:6, candidates:6, futureWeight:.24, exposureWeight:12 };
    // 普通档维持既有六骰分支的近优本地策略。
    return { rolls:6, candidates:4, futureWeight:.2, exposureWeight:0 };
  }
  function evaluateLudoMove(pi, ti, profile){
    const before = tokens;
    const outcome = simulateLudoMove(pi, ti, dice, before);
    const ownProgress = playerProgress(pi, before);
    const leaderProgress = Math.max(...before.map((_, index) => playerProgress(index, before)));
    const catchup = Math.max(0, leaderProgress - ownProgress);
    const progressGain = tokenProgress(outcome.destination) - tokenProgress(outcome.from);
    const finish = outcome.destination === HOME && outcome.from !== HOME;
    const takeoff = outcome.from === -1;
    const safeLane = outcome.destination > 50;
    const oldRisk = captureRisk(pi, outcome.from, before);
    const risk = captureRisk(pi, outcome.destination, outcome.state);
    const balanceDelta = developmentBalance(outcome.state[pi]) - developmentBalance(before[pi]);
    const activeBefore = before[pi].filter(position => position >= 0 && position < HOME).length;
    const activeAfter = outcome.state[pi].filter(position => position >= 0 && position < HOME).length;
    const sortedProgress = before[pi].map(tokenProgress).slice().sort((a, b) => a - b);
    const developsLaggard = tokenProgress(outcome.from) <= sortedProgress[1];
    const future = expectedNextTurn(pi, outcome.state, profile.rolls);
    const teamExposure = profile.exposureWeight
      ? outcome.state[pi].reduce((sum, position) => sum + captureRisk(pi, position, outcome.state), 0) : 0;
    const score = progressGain * (1.7 + catchup * .8) + (finish ? 155 : 0) +
      outcome.captured * (58 + catchup * 30) + (takeoff ? 22 : 0) + (safeLane ? 16 : 0) +
      (oldRisk - risk) * 28 - risk * (38 + tokenProgress(outcome.destination) * .3) +
      balanceDelta * 24 + (activeAfter > activeBefore ? 7 : 0) + (developsLaggard ? 6 : 0) +
      future * profile.futureWeight - teamExposure * profile.exposureWeight;
    return { ti, choice:'token:' + ti, score, outcome, progressGain, finish, takeoff, safeLane,
      risk, oldRisk, balanceDelta, catchup, future, teamExposure, developsLaggard };
  }
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(curIdx)) return;
    aiPending = true;
    const gen = epoch;
    const turn = curIdx;
    setStatus(t('ai_thinking'));
    ludoWaveCLater(async () => {
      if (opts.destroyed || over || gen !== epoch || curIdx !== turn || !opts.ai.has(curIdx)){
        aiPending = false;
        return;
      }
      if (phase === 'roll'){
        const d = 1 + Math.floor(Math.random() * 6);
        aiPending = false;
        if (opts.online && typeof opts.sendBotMove === 'function') opts.sendBotMove(turn, { dice:d });
        applyDice(d);
        return;
      }
      if (phase === 'pick'){
        const mv = movable();
        if (!mv.length){ aiPending = false; nextTurn(t('ludo_no_movable')); return; }
        const difficulty = typeof aiDifficultyFromOptions === 'function' ? aiDifficultyFromOptions(opts) : { id:'hard' };
        const profile = ludoDifficultyProfile(difficulty);
        const ranked = mv.map(ti => evaluateLudoMove(curIdx, ti, profile)).sort((a, b) => b.score - a.score || a.ti - b.ti);
        const best = ranked[0];
        const band = Math.max(10, Math.min(24, Math.abs(best.score) * .08));
        const near = ranked.filter(item => item.score >= best.score - band).slice(0, profile.candidates);
        const choices = near.map(item => item.choice);
        const moveByChoice = new Map(near.map(item => [item.choice, item.ti]));
        const learningCandidates = near.map(item => ({ choice:item.choice, features:{
          quality:Math.max(-1, Math.min(1, 1 - Math.max(0, best.score - item.score) / Math.max(1, band))),
          progress_gain:aiClamp(item.progressGain, 6),
          finish:item.finish ? 1 : 0,
          capture:aiClamp(item.outcome.captured, 2),
          takeoff:item.takeoff ? 1 : 0,
          safe_position:item.safeLane || item.risk === 0 ? 1 : 0,
          capture_risk:aiClamp(-item.risk, 1),
          risk_reduction:aiClamp(item.oldRisk - item.risk, 1),
          balance:aiClamp(item.balanceDelta, .5),
          develops_laggard:item.developsLaggard ? 1 : 0,
          catchup:aiClamp(item.catchup, .5),
          future_expectation:aiClamp(item.future, 90),
          team_exposure:aiClamp(-item.teamExposure, 4),
        } }));
        const remoteAllowed = typeof aiDifficultyAllowsRemote === 'function' ? aiDifficultyAllowsRemote(difficulty) : difficulty.id === 'hard';
        const remoteProfile = typeof aiDifficultyRequestProfile === 'function' ? aiDifficultyRequestProfile(difficulty) : { id:'teacher', difficulty:difficulty.id };
        const requestStateKey = JSON.stringify({ tokens:tokens.map(list => list.slice()), curIdx, dice, phase });
        // 学习样本保留在所有难度；普通/简单只执行本地已排序的合法候选。
        const remoteChoice = await aiChoose('ludo', {
          tokens: tokens.map(list => list.slice()), turn: curIdx, dice, home: HOME,
          localRanking: near.map(item => ({ choice:item.choice, score:Math.round(item.score * 10) / 10 })),
        }, choices, remoteProfile, learningCandidates);
        if (opts.destroyed || over || gen !== epoch || curIdx !== turn || phase !== 'pick' ||
            JSON.stringify({ tokens:tokens.map(list => list.slice()), curIdx, dice, phase }) !== requestStateKey){
          aiPending = false;
          notifyLudoIdle();
          return;
        }
        const localIndex = typeof aiDifficultyLocalChoiceIndex === 'function'
          ? aiDifficultyLocalChoiceIndex(difficulty, choices.length) : (difficulty.id === 'easy' ? Math.min(choices.length - 1, 1) : 0);
        const localChoice = choices[Math.max(0, localIndex)] || choices[0];
        const chosen = remoteAllowed && moveByChoice.has(remoteChoice)
          ? moveByChoice.get(remoteChoice) : moveByChoice.get(localChoice);
        if (!movable().includes(chosen)){
          aiPending = false;
          notifyLudoIdle();
          return;
        }
        aiPending = false;
        aiSpeak(difficulty, 'think');
        if (opts.online && typeof opts.sendBotMove === 'function') opts.sendBotMove(turn, { ti:chosen });
        if (applyPick(curPid(), chosen) && typeof confirmAIReady === 'function') {
          confirmAIReady('ludo', 'token:' + chosen);
        }
        return;
      }
      aiPending = false;
      notifyLudoIdle();
    }, 700);
  }

  function curPid(){ return pids[curIdx]; }
  function canMove(t){ if (t === -1) return dice === 6; return t >= 0 && t < HOME; }
  function advanceToken(t, steps){
    if (t === -1) return 0;
    const next = t + steps;
    return next <= HOME ? next : Math.max(0, HOME - (next - HOME));
  }
  function movementPath(from, steps){
    if (from === -1) return [0];
    const path = [];
    for (let i = 1; i <= steps; i++){
      const raw = from + i;
      path.push(raw <= HOME ? raw : Math.max(0, HOME - (raw - HOME)));
    }
    return path;
  }
  function movable(){
    const arr = [];
    for (let i=0;i<4;i++) if (canMove(tokens[curIdx][i])) arr.push(i);
    return arr;
  }
  function cellOf(pid, t){ return (START[pid] + t) % TRACK; }
  function geometry(){
    const c = S/2, R = S*0.40;
    const viewPid=opts.online&&!spectator&&Number.isInteger(Number(opts.myIdx))?pids[Number(opts.myIdx)]:null;
    const viewQuarterTurns=typeof TabletopPerspective!=='undefined'&&TabletopPerspective&&viewPid!==null?TabletopPerspective.nearQuarterTurns(viewPid):0;
    const viewPoint=(x,y)=>typeof TabletopPerspective!=='undefined'&&TabletopPerspective?TabletopPerspective.quarterPoint(S,x,y,viewQuarterTurns):[x,y];
    const ang = i => (-90 + i * 360/TRACK) * Math.PI/180;
    const tpos = i => {const raw=[c + R*Math.cos(ang(i)), c + R*Math.sin(ang(i))];return viewPoint(raw[0],raw[1]);};
    const colPos = (pid, k) => {
      const [ex,ey] = tpos((START[pid] - 1 + TRACK) % TRACK);
      const t = (k+1)/5;
      return [c + (ex-c)*(1-t), c + (ey-c)*(1-t)];
    };
    const basePos = pid => {
      const m = S*0.035, b = S*0.19;
      const corners = [[m,m],[S-m-b,m],[S-m-b,S-m-b],[m,S-m-b]];
      const corner=corners[pid],center=viewPoint(corner[0]+b/2,corner[1]+b/2);return [center[0]-b/2,center[1]-b/2];
    };
    return { c, tpos, colPos, basePos, viewQuarterTurns };
  }
  function renderBoard(){
    syncLudoWaveBPresentation();
    const w = area.clientWidth || 520;
    const h = Number(area.clientHeight) || 0;
    const heightLimit = h > 320 ? Math.max(260, Math.min(680, h - 16)) : 640;
    S = Math.min(w, heightLimit);
    if (board.style && typeof board.style.setProperty === 'function') board.style.setProperty('--ludo-wave-c-board-size', S + 'px');
    board.style.width = S + 'px'; board.style.height = S + 'px';
    const tabletop = typeof tabletopArtEnabled === 'function' && tabletopArtEnabled();
    if (typeof markTabletopSurface === 'function') markTabletopSurface(board, 'ludo-board', { variant: boardTheme });
    board.dataset.boardTheme = boardTheme;
    board.dataset.baseSkin = cosmetic.base;
    board.dataset.pieceSkin = cosmetic.piece;
    board.style.background = tabletop
      ? 'radial-gradient(circle at 28% 20%,rgba(255,255,255,.72),transparent 24%),linear-gradient(135deg,#FFF9F2,#F3E5C4)'
      : boardTheme === 'grass'
      ? 'radial-gradient(circle at 50% 45%,rgba(255,255,255,.30),transparent 36%),repeating-linear-gradient(110deg,rgba(40,99,48,.12) 0 2px,transparent 2px 8px),linear-gradient(#a7c985,#668f58)'
      : 'var(--card)';
    board.innerHTML = '';
    const g = geometry();
    board.dataset.viewQuarterTurns = String(g.viewQuarterTurns);
    const cellSize = Math.max(20, Math.min(30, S*0.056));
    const tokSize = cellSize * 0.52;
    // 轨道格
    for (let i=0;i<TRACK;i++){
      const [x,y] = g.tpos(i);
      const cell = el('div','tcell' + (START.includes(i) ? ' start' : ''));
      cell.style.left = x + 'px'; cell.style.top = y + 'px';
      cell.style.width = cell.style.height = cellSize + 'px';
      cell.style.marginLeft = cell.style.marginTop = (-cellSize/2) + 'px';
      if (START.includes(i)){
        const pid = START.indexOf(i);
        cell.style.borderColor = color(pid);
      }
      cell.dataset.cell = i;
      board.appendChild(cell);
    }
    // 终点航线和中心
    const colSizes = [cellSize*0.85, cellSize*0.85, cellSize*0.85, cellSize*0.85, S*0.13];
    for (const pid of pids){
      for (let k=0;k<4;k++){
        const [x,y] = g.colPos(pid,k);
        const h = el('div','hcell');
        h.style.left = x + 'px'; h.style.top = y + 'px';
        h.style.width = h.style.height = colSizes[k] + 'px';
        h.style.marginLeft = h.style.marginTop = (-colSizes[k]/2) + 'px';
        h.style.borderColor = color(pid);
        board.appendChild(h);
      }
    }
    const center = el('div','ludo-center');
    const cs = S*0.13;
    center.style.left = center.style.top = (S/2) + 'px';
    center.style.width = center.style.height = cs + 'px';
    center.style.marginLeft = center.style.marginTop = (-cs/2) + 'px';
    center.textContent = '🏁';
    board.appendChild(center);
    // 基地
    for (const pid of pids){
      const [bx,by] = g.basePos(pid);
      const base = el('div','ludo-base');
      const b = S*0.19;
      base.style.left = bx + 'px'; base.style.top = by + 'px';
      base.style.width = base.style.height = b + 'px';
      base.style.borderColor = color(pid);
      const baseSkin = playerCosmetic(pids.indexOf(pid)).base;
      base.dataset.baseSkin = baseSkin === 'cyber' ? 'cyber' : 'classic';
      if (base.style.setProperty){
        base.style.setProperty('--ludo-player', color(pid));
        base.style.setProperty('--ludo-player-soft', PLAYER_BG[pid]);
      } else {
        base.style['--ludo-player'] = color(pid);
        base.style['--ludo-player-soft'] = PLAYER_BG[pid];
      }
      const emblem = el('span','ludo-base-emblem',base.dataset.baseSkin === 'cyber' ? '⌁' : '✦');
      emblem.setAttribute('aria-hidden','true');
      base.appendChild(emblem);
      for (let j=0;j<4;j++) base.appendChild(el('div','slot'));
      board.appendChild(base);
    }
    // 棋子
    const slots = [[0.28,0.28],[0.72,0.28],[0.28,0.72],[0.72,0.72]];
    const place = (parent, x, y, pid, ti) => {
      const tok = el('div','tok');
      tok.style.width = tok.style.height = tokSize + 'px';
      const skin = playerCosmetic(pids.indexOf(pid)).piece;
      tok.dataset.pieceSkin = skin === 'jet' ? 'jet' : 'classic';
      tok.style.background = skin === 'jet'
        ? 'linear-gradient(145deg,#f8fafc 0 20%,' + color(pid) + ' 45%,#111827 100%)'
        : color(pid);
      tok.style.left = x + 'px'; tok.style.top = y + 'px';
      tok.dataset.pid = pid; tok.dataset.ti = ti;
      if (phase === 'pick' && pid === curPid() && canMove(tokens[pids.indexOf(pid)][ti])){
        tok.classList.add('movable');
      }
      tok.addEventListener('click', () => { if (!spectator) pick(pid, ti); });
      parent.appendChild(tok);
    };
    // 收集每个格子的棋子
    const trackMap = new Map(), colMap = new Map(), baseMap = new Map();
    pids.forEach((pid, pi) => {
      tokens[pi].forEach((t, ti) => {
        if (movingToken && movingToken.pi === pi && movingToken.ti === ti) return;
        if (t === -1){
          const k = pid;
          if (!baseMap.has(k)) baseMap.set(k, []);
          baseMap.get(k).push([pid,ti]);
        } else if (t <= 50){
          const c = cellOf(pid,t);
          if (!trackMap.has(c)) trackMap.set(c, []);
          trackMap.get(c).push([pid,ti]);
        } else if (t < HOME){
          const k = pid + '-' + (t-51);
          if (!colMap.has(k)) colMap.set(k, []);
          colMap.get(k).push([pid,ti]);
        }
      });
    });
    for (const [c, list] of trackMap){
      const cell = board.querySelector('[data-cell="' + c + '"]');
      if (!cell) continue;
      list.slice(0,4).forEach(([pid,ti], j) => {
        const [sx,sy] = slots[j];
        place(cell, cellSize*sx, cellSize*sy, pid, ti);
      });
    }
    for (const [k, list] of colMap){
      const [pid, kk] = k.split('-').map(Number);
      const [x,y] = g.colPos(pid,kk);
      const host = el('div');
      host.style.left = x + 'px'; host.style.top = y + 'px';
      host.style.position = 'absolute';
      host.style.width = host.style.height = colSizes[kk] + 'px';
      list.slice(0,4).forEach(([pid2,ti], j) => {
        const [sx,sy] = slots[j];
        place(host, colSizes[kk]*sx, colSizes[kk]*sy, pid2, ti);
      });
      board.appendChild(host);
    }
    for (const [pid, list] of baseMap){
      const base = board.querySelectorAll('.ludo-base')[pids.indexOf(pid)];
      const slotsEls = base.querySelectorAll('.slot');
      list.slice(0,4).forEach(([pid2,ti], j) => {
        const s = slotsEls[j];
        place(s, '50%', '50%', pid2, ti);
      });
    }
    // 结束覆盖层
    if (over){
      const winnerName = t('player_number',pids.indexOf(winner)+1);
      const placement = getMatchStats().placement;
      showVictoryOverlay(area, {
        winner: pids.indexOf(winner), winnerName: winnerName,
        emoji: '🏆', subtitle: t('ludo_all_home'), coins: 1,
        podium: placement.map((rank,index) => ({ rank, name:t('player_number',index+1), color:PLAYER_COLORS[pids[index]] })),
        onRestart: reset, onShare: () => shareGameLink('ludo')
      });
    }
    const infos = pids.map(pid => {
      const pi = pids.indexOf(pid);
      const cnt = tokens[pi].filter(t => t === HOME).length;
      return t('ludo_home_progress',cnt);
    });
    diceBtn.disabled = spectator || over || phase !== 'roll' || (opts.online && curIdx !== opts.myIdx) || (opts.ai && opts.ai.has(curIdx));
    const diceSkin = playerCosmetic(curIdx).dice === 'cyber' ? 'cyber' : 'classic';
    diceBtn.dataset.diceSkin = diceSkin;
    dice3d.wrap.dataset.diceSkin = diceSkin;
    dice3d.wrap.setAttribute('aria-label', t(diceSkin==='cyber'?'ludo_dice_cyber':'ludo_dice_classic'));
    diceBtn.style.transition = 'filter .22s ease,transform .22s ease';
    turnHud.textContent = over ? t('match_over') : (spectator ? t('spectator_player_action',curIdx+1) : t('ludo_turn_phase',curIdx+1,t(phase === 'roll' ? 'ludo_roll_die' : 'ludo_choose_plane')));
    renderPlayers(curIdx, infos, null, pids.map(pid => PLAYER_COLORS[pid]));
    updateLudoWaveBPresentation();
  }
  function roll(){
    sfx('pop');
    if (spectator || over || phase !== 'roll') return;
    if (opts.isReplaying && opts.isReplaying()) return;
    if (opts.online && curIdx !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(curIdx)) return;
    const d = 1 + Math.floor(Math.random()*6);
    if (opts.onProgress) opts.onProgress({ dice: d });
    if (opts.online) opts.sendMove({ dice: d });
    applyDice(d);
  }
  function applyDice(d){
    if (over || phase !== 'roll' || !Number.isInteger(d) || d < 1 || d > 6) return false;
    const turn = curIdx;
    const gen = epoch;
    phase = 'rolling';
    dice = d;
    setLudoWaveCProcess('dice', d);
    diceBtn.disabled = true;
    updateLudoWaveBPresentation();
    setStatus(t('ludo_player_rolling',curIdx+1));
    dice3d.roll(dice, () => {
      if (gen !== epoch || over || curIdx !== turn || phase !== 'rolling') return;
      const mv = movable();
      if (!mv.length){
        setLudoWaveCProcess('turn-end');
        nextTurn(t('ludo_roll_no_move',curIdx+1,dice));
        return;
      }
      phase = 'pick';
      setLudoWaveCProcess('pick', dice);
      renderBoard();
      setStatus(t('ludo_roll_choose',curIdx+1,dice));
      drainRemoteInputs();
      if (phase === 'pick') scheduleAI();
      notifyLudoIdle();
    });
    return true;
  }
  function pick(pid, ti){
    if (spectator || over || phase !== 'pick' || pid !== curPid()) return;
    if (opts.isReplaying && opts.isReplaying()) return;
    if (opts.online && curIdx !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(curIdx)) return;
    const pi = pids.indexOf(pid);
    const arr = tokens[pi];
    if (!canMove(arr[ti])) return;
    if (opts.onProgress) opts.onProgress({ ti });
    if (opts.online) opts.sendMove({ ti });
    applyPick(pid, ti);
  }
  function applyPick(pid, ti){
    if (over || phase !== 'pick' || pid !== curPid() || !Number.isInteger(ti) || ti < 0 || ti >= 4) return false;
    const pi = pids.indexOf(pid);
    const arr = tokens[pi];
    if (pi < 0 || !canMove(arr[ti])) return false;
    const wasBase = arr[ti] === -1;
    const from = arr[ti], path = movementPath(from, dice), destination = advanceToken(from, dice);
    const capturedTokens = [];
    movingToken = { pi, ti, pid, from, path: path.slice(), destination };
    setLudoWaveCProcess('move', dice);
    arr[ti] = destination;
    if (wasBase) takeoffs++;
    if (arr[ti] <= 50){
      const cell = cellOf(pid, arr[ti]);
      let captured = 0;
      pids.forEach((p2, p2i) => {
        if (p2 === pid) return;
        for (let j=0;j<4;j++){
          const t2 = tokens[p2i][j];
          if (t2 >= 0 && t2 <= 50 && cellOf(p2,t2) === cell){
            capturedTokens.push({ pid:p2, pi:p2i, ti:j, position:t2 });
            tokens[p2i][j] = -1; captured++;
          }
        }
      });
      if (captured){ captures += captured; toast(t('ludo_captured',captured)); }
    }
    playFeedback(capturedTokens.length ? 'capture' : (wasBase ? 'place' : 'move'));
    if (arr.every(v => v === HOME)){
      over = true; winner = pid; finishedAt = Date.now(); area.style.touchAction = 'auto';
      const order = pids.map((p2, i) => i).sort((a, b) => {
        if (a === curIdx) return -1;
        if (b === curIdx) return 1;
        const homeDiff = tokens[b].filter(v => v === HOME).length - tokens[a].filter(v => v === HOME).length;
        if (homeDiff) return homeDiff;
        const progress = list => list.reduce((sum, value) => sum + (value === HOME ? HOME : Math.max(0, value)), 0);
        return progress(tokens[b]) - progress(tokens[a]);
      });
      const ranks = new Map(order.map((slot, index) => [slot, index + 1]));
      if (opts.onEnd) opts.onEnd(pids.map((p2, i) => ({ slot: i, coins: i === curIdx ? 1 : 0, rank: ranks.get(i) })));
      renderBoard();
      setStatus(t('result_winner',curIdx+1), true);
      animateTokenMove(movingToken, wasBase, capturedTokens, true, true, 'ranking');
      return true;
    }
    const stableProcess = dice === 6 ? 'roll' : 'turn-end';
    if (dice === 6){
      phase = 'roll';
      diceBtn.disabled = false;
      renderBoard();
      setStatus(t('ludo_roll_again',curIdx+1));
      drainRemoteInputs();
      if (phase === 'roll') scheduleAI();
    } else {
      nextTurn(t('ludo_move_complete',curIdx+1));
    }
    animateTokenMove(movingToken, wasBase, capturedTokens, destination === HOME, false, stableProcess);
    return true;
  }
  function tokenPoint(pid, position){
    const g = geometry();
    if (position === -1){ const [bx,by] = g.basePos(pid); return [bx + S*.095, by + S*.095]; }
    if (position <= 50) return g.tpos(cellOf(pid, position));
    if (position < HOME) return g.colPos(pid, position - 51);
    return [S/2, S/2];
  }
  function animateTokenMove(animation, wasBase, capturedTokens, reachedHome, matchFinished, stableProcess){
    if (!animation) return;
    const animationEpoch = epoch;
    const reduced = prefersReducedMotion();
    const steps = animation.path.length ? animation.path.slice() : [animation.destination];
    const settledProcess = matchFinished ? 'ranking' : (stableProcess === 'roll' ? 'roll' : 'turn-end');
    if (reduced){
      movingToken = null;
      renderBoard();
      setLudoWaveCProcess(settledProcess);
      notifyLudoIdle();
      return;
    }
    const flyer = el('div','ludo-flight-token ' + (wasBase ? 'takeoff' : 'moving'), playerCosmetic(animation.pi).piece === 'jet' ? '✈' : '●');
    const start = tokenPoint(animation.pid, animation.from);
    flyer.style.cssText = 'position:absolute;z-index:12;width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;font-weight:900;color:#fff;background:' + color(animation.pid) + ';box-shadow:0 7px 14px rgba(15,23,42,.3);pointer-events:none;transition:left .12s linear,top .12s linear,transform .12s ease;';
    flyer.style.left = (start[0]-13) + 'px'; flyer.style.top = (start[1]-13) + 'px';
    board.appendChild(flyer);
    let index = 0;
    const stepDelay = Math.max(75, Math.min(150, Math.floor(760 / Math.max(1, steps.length))));
    const advance = () => {
      if (animationEpoch !== epoch){ flyer.remove(); return; }
      if (index >= steps.length){
        if (capturedTokens.length){
          const impact = el('div','ludo-impact','💥'); const point = tokenPoint(animation.pid, animation.destination);
          impact.style.cssText = 'position:absolute;z-index:13;left:' + (point[0]-18) + 'px;top:' + (point[1]-18) + 'px;font-size:32px;pointer-events:none;'; board.appendChild(impact);
          settleLudoWaveCProcess('capture', capturedTokens.length);
          ludoWaveCLater(() => impact.remove(), 320);
        }
        if (reachedHome){
          flyer.textContent = '🏁';
          settleLudoWaveCProcess('finish');
        } else if (!capturedTokens.length) {
          settleLudoWaveCProcess(settledProcess);
        }
        flyer.style.transform = reachedHome ? 'scale(1.35)' : 'scale(.92)';
        ludoWaveCLater(() => {
          flyer.remove();
          if (animationEpoch === epoch && movingToken === animation){
            movingToken = null;
            renderBoard();
            settleLudoWaveCProcess(settledProcess);
          }
        }, reachedHome ? 220 : 100);
        return;
      }
      const point = tokenPoint(animation.pid, steps[index++]);
      flyer.style.left = (point[0]-13) + 'px'; flyer.style.top = (point[1]-13) + 'px';
      flyer.style.transform = wasBase && index === 1 ? 'scale(1.22) rotate(-12deg)' : 'scale(1)';
      ludoWaveCLater(advance, stepDelay);
    };
    ludoWaveCLater(advance, 20);
  }
  function nextTurn(msg){
    phase = 'roll';
    curIdx = (curIdx + 1) % pids.length;
    diceBtn.disabled = false;
    renderBoard();
    setStatus(t('ludo_next_turn',msg ? msg + t('message_separator') : '',curIdx+1));
    drainRemoteInputs();
    if (phase === 'roll') scheduleAI();
    notifyLudoIdle();
  }
  function drainRemoteInputs(){
    if (drainingRemoteInputs || over) return;
    drainingRemoteInputs = true;
    try {
      while (remoteInputs.length && !over){
        const event = remoteInputs[0] || {};
        const payload = event.payload || {};
        if (!Number.isInteger(event.player)){
          remoteInputs.shift();
          continue;
        }
        if (event.player !== curIdx){
          // 下一个玩家可能已在更快的客户端行动；当前骰子动画结束后再判断。
          if (phase === 'rolling') break;
          remoteInputs.shift();
          continue;
        }
        if (payload.dice !== undefined){
          if (phase === 'rolling') break;
          if (phase !== 'roll'){
            remoteInputs.shift();
            continue;
          }
          remoteInputs.shift();
          applyDice(Number(payload.dice));
          if (phase === 'rolling') break;
        } else if (payload.ti !== undefined){
          if (phase === 'rolling') break;
          if (phase !== 'pick'){
            remoteInputs.shift();
            continue;
          }
          remoteInputs.shift();
          applyPick(curPid(), Number(payload.ti));
        } else {
          remoteInputs.shift();
        }
      }
    } finally {
      drainingRemoteInputs = false;
      notifyLudoIdle();
    }
  }
  opts.onMove = (payload, player) => {
    if (!payload || (payload.dice === undefined && payload.ti === undefined)) return;
    if (opts.online && !Number.isInteger(player)) return;
    remoteInputs.push({ payload, player });
    drainRemoteInputs();
  };
  function resetLocal(){
    epoch++;
    clearLudoWaveCProcessTimers();
    tokens = pids.map(() => Array(4).fill(-1));
    curIdx = 0; phase = 'roll'; dice = 0; over = false; winner = -1; aiPending = false;
    startedAt = Date.now(); finishedAt = 0; captures = 0; takeoffs = 0; movingToken = null;
    area.style.touchAction = spectator ? 'auto' : 'none';
    remoteInputs = [];
    diceBtn.disabled = false;
    dice3d.reset();
    setLudoWaveCProcess('roll');
    renderBoard();
    setStatus(t('ludo_initial_turn'));
    notifyLudoIdle();
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast(t('host_only_restart')); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  function setBoardTheme(theme){ boardTheme = theme === 'grass' ? 'grass' : 'classic'; renderBoard(); return boardTheme; }
  function setCosmetic(value){ cosmetic = normalizeCosmetic(value); renderBoard(); return { ...cosmetic, players:{...cosmetic.players} }; }
  function setSpectators(value){ spectator = Array.isArray(value) ? value.includes(opts.viewerId) : !!value; area.style.touchAction = spectator || over ? 'auto' : 'none'; renderBoard(); return spectator; }
  function getMatchStats(){
    const order = pids.map((pid, index) => ({ index, finished: tokens[index].filter(v => v === HOME).length, progress: tokens[index].reduce((sum, v) => sum + Math.max(0, v), 0) }))
      .sort((a, b) => b.finished - a.finished || b.progress - a.progress || a.index - b.index);
    const rank = new Map(order.map((item, index) => [item.index, index + 1]));
    return { duration: Math.max(0, (finishedAt || Date.now()) - startedAt), piecesFinished: tokens.map(list => list.filter(v => v === HOME).length), captures, takeoffs, placement: pids.map((_, index) => rank.get(index)) };
  }
  function snapshot(){ return { tokens: tokens.map(t => t.slice()), curIdx, phase, dice, over, winner }; }
  function onRestore(value){
    const state = value && value.state ? value.state : value;
    if (!state || !Array.isArray(state.tokens) || state.tokens.length !== pids.length) return false;
    epoch++; clearLudoWaveCProcessTimers(); movingToken = null;
    tokens = state.tokens.map(list => Array.isArray(list) ? list.slice(0, 4).map(v => Math.max(-1, Math.min(HOME, Number(v) || 0))) : Array(4).fill(-1));
    curIdx = Math.max(0, Math.min(pids.length - 1, Number(state.curIdx) || 0)); phase = ['roll','rolling','pick'].includes(state.phase) ? state.phase : 'roll';
    dice = Math.max(0, Math.min(6, Number(state.dice) || 0)); over = !!state.over; winner = Number.isInteger(state.winner) ? state.winner : -1;
    setLudoWaveCProcess(over ? 'ranking' : (phase === 'rolling' ? 'dice' : (phase === 'pick' ? 'pick' : 'roll')));
    if (value && value.presentation){ boardTheme = value.presentation.boardTheme === 'grass' ? 'grass' : 'classic'; cosmetic = normalizeCosmetic(value.presentation.cosmetic); }
    renderBoard(); notifyLudoIdle(); return true;
  }
  renderBoard();
  setStatus(t('ludo_initial_turn'));
  return {
    reset, onMove: opts.onMove, onRestart: resetLocal,
    destroy: () => { epoch++; clearLudoWaveCProcessTimers(); aiPending = false; remoteInputs = []; dice3d.reset(); releaseLudoWaveBPresentation(); area.style.touchAction = previousTouchAction; area.style.overscrollBehavior = previousOverscroll; notifyLudoIdle(true); },
    whenIdle: whenLudoIdle,
    snapshot, onRestore,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic: { ...cosmetic, players:{...cosmetic.players} } }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, getMatchStats,
    getMultiplayerRequirement: () => n > 4 ? 'MULTI_TABLE_REQUIRED' : null,
  };
}
