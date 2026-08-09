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
  function expectedNextTurn(pi, state){
    let total = 0;
    for (let roll = 1; roll <= 6; roll++){
      let best = 0;
      for (let ti = 0; ti < 4; ti++) best = Math.max(best, futureMoveValue(pi, ti, roll, state));
      total += best;
    }
    return total / 6;
  }
  function evaluateLudoMove(pi, ti){
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
    const future = expectedNextTurn(pi, outcome.state);
    const score = progressGain * (1.7 + catchup * .8) + (finish ? 155 : 0) +
      outcome.captured * (58 + catchup * 30) + (takeoff ? 22 : 0) + (safeLane ? 16 : 0) +
      (oldRisk - risk) * 28 - risk * (38 + tokenProgress(outcome.destination) * .3) +
      balanceDelta * 24 + (activeAfter > activeBefore ? 7 : 0) + (developsLaggard ? 6 : 0) + future * .2;
    return { ti, choice:'token:' + ti, score, outcome, progressGain, finish, takeoff, safeLane,
      risk, oldRisk, balanceDelta, catchup, future, developsLaggard };
  }
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(curIdx)) return;
    aiPending = true;
    const gen = epoch;
    const turn = curIdx;
    setStatus(t('ai_thinking'));
    setTimeout(async () => {
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
        const ranked = mv.map(ti => evaluateLudoMove(curIdx, ti)).sort((a, b) => b.score - a.score || a.ti - b.ti);
        const best = ranked[0];
        const band = Math.max(10, Math.min(24, Math.abs(best.score) * .08));
        const near = ranked.filter(item => item.score >= best.score - band).slice(0, 4);
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
        } }));
        const remoteChoice = await aiChoose('ludo', {
          tokens: tokens.map(list => list.slice()), turn: curIdx, dice, home: HOME,
          localRanking: near.map(item => ({ choice:item.choice, score:Math.round(item.score * 10) / 10 })),
        }, choices, opts.aiPersona, learningCandidates);
        if (opts.destroyed || over || gen !== epoch || curIdx !== turn || phase !== 'pick'){
          aiPending = false;
          return;
        }
        const chosen = moveByChoice.has(remoteChoice) ? moveByChoice.get(remoteChoice) : best.ti;
        if (!movable().includes(chosen)){
          aiPending = false;
          return;
        }
        aiPending = false;
        aiSpeak(opts.aiPersona, 'think');
        if (opts.online && typeof opts.sendBotMove === 'function') opts.sendBotMove(turn, { ti:chosen });
        if (applyPick(curPid(), chosen) && typeof confirmAIReady === 'function') {
          confirmAIReady('ludo', 'token:' + chosen);
        }
        return;
      }
      aiPending = false;
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
    const ang = i => (-90 + i * 360/TRACK) * Math.PI/180;
    const tpos = i => [c + R*Math.cos(ang(i)), c + R*Math.sin(ang(i))];
    const colPos = (pid, k) => {
      const [ex,ey] = tpos((START[pid] - 1 + TRACK) % TRACK);
      const t = (k+1)/5;
      return [c + (ex-c)*(1-t), c + (ey-c)*(1-t)];
    };
    const basePos = pid => {
      const m = S*0.035, b = S*0.19;
      const corners = [[m,m],[S-m-b,m],[S-m-b,S-m-b],[m,S-m-b]];
      return corners[pid];
    };
    return { c, tpos, colPos, basePos };
  }
  function renderBoard(){
    const w = area.clientWidth || 520;
    S = Math.min(w, 540);
    board.style.width = S + 'px'; board.style.height = S + 'px';
    board.dataset.boardTheme = boardTheme;
    board.dataset.baseSkin = cosmetic.base;
    board.dataset.pieceSkin = cosmetic.piece;
    board.style.background = boardTheme === 'grass'
      ? 'radial-gradient(circle at 50% 45%,rgba(255,255,255,.30),transparent 36%),repeating-linear-gradient(110deg,rgba(40,99,48,.12) 0 2px,transparent 2px 8px),linear-gradient(#a7c985,#668f58)'
      : 'var(--card)';
    board.innerHTML = '';
    const g = geometry();
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
      showVictoryOverlay(area, {
        winner: pids.indexOf(winner), winnerName: winnerName,
        emoji: '🏆', subtitle: t('ludo_all_home'), coins: 1, onRestart: reset
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
    diceBtn.disabled = true;
    setStatus(t('ludo_player_rolling',curIdx+1));
    dice3d.roll(dice, () => {
      if (gen !== epoch || over || curIdx !== turn || phase !== 'rolling') return;
      const mv = movable();
      if (!mv.length){
        nextTurn(t('ludo_roll_no_move',curIdx+1,dice));
        return;
      }
      phase = 'pick';
      renderBoard();
      setStatus(t('ludo_roll_choose',curIdx+1,dice));
      drainRemoteInputs();
      if (phase === 'pick') scheduleAI();
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
      animateTokenMove(movingToken, wasBase, capturedTokens, true);
      return true;
    }
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
    animateTokenMove(movingToken, wasBase, capturedTokens, destination === HOME);
    return true;
  }
  function tokenPoint(pid, position){
    const g = geometry();
    if (position === -1){ const [bx,by] = g.basePos(pid); return [bx + S*.095, by + S*.095]; }
    if (position <= 50) return g.tpos(cellOf(pid, position));
    if (position < HOME) return g.colPos(pid, position - 51);
    return [S/2, S/2];
  }
  function animateTokenMove(animation, wasBase, capturedTokens, finished){
    if (!animation) return;
    const animationEpoch = epoch;
    const reduced = prefersReducedMotion();
    const steps = animation.path.length ? animation.path.slice() : [animation.destination];
    if (reduced){ movingToken = null; renderBoard(); return; }
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
          setTimeout(() => impact.remove(), 320);
        }
        if (finished) flyer.textContent = '🏁';
        flyer.style.transform = finished ? 'scale(1.35)' : 'scale(.92)';
        setTimeout(() => {
          flyer.remove();
          if (animationEpoch === epoch && movingToken === animation){ movingToken = null; renderBoard(); }
        }, finished ? 220 : 100);
        return;
      }
      const point = tokenPoint(animation.pid, steps[index++]);
      flyer.style.left = (point[0]-13) + 'px'; flyer.style.top = (point[1]-13) + 'px';
      flyer.style.transform = wasBase && index === 1 ? 'scale(1.22) rotate(-12deg)' : 'scale(1)';
      setTimeout(advance, stepDelay);
    };
    setTimeout(advance, 20);
  }
  function nextTurn(msg){
    phase = 'roll';
    curIdx = (curIdx + 1) % pids.length;
    diceBtn.disabled = false;
    renderBoard();
    setStatus(t('ludo_next_turn',msg ? msg + t('message_separator') : '',curIdx+1));
    drainRemoteInputs();
    if (phase === 'roll') scheduleAI();
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
    tokens = pids.map(() => Array(4).fill(-1));
    curIdx = 0; phase = 'roll'; dice = 0; over = false; winner = -1; aiPending = false;
    startedAt = Date.now(); finishedAt = 0; captures = 0; takeoffs = 0; movingToken = null;
    area.style.touchAction = spectator ? 'auto' : 'none';
    remoteInputs = [];
    diceBtn.disabled = false;
    dice3d.reset();
    renderBoard();
    setStatus(t('ludo_initial_turn'));
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
    epoch++; movingToken = null;
    tokens = state.tokens.map(list => Array.isArray(list) ? list.slice(0, 4).map(v => Math.max(-1, Math.min(HOME, Number(v) || 0))) : Array(4).fill(-1));
    curIdx = Math.max(0, Math.min(pids.length - 1, Number(state.curIdx) || 0)); phase = ['roll','rolling','pick'].includes(state.phase) ? state.phase : 'roll';
    dice = Math.max(0, Math.min(6, Number(state.dice) || 0)); over = !!state.over; winner = Number.isInteger(state.winner) ? state.winner : -1;
    if (value && value.presentation){ boardTheme = value.presentation.boardTheme === 'grass' ? 'grass' : 'classic'; cosmetic = normalizeCosmetic(value.presentation.cosmetic); }
    renderBoard(); return true;
  }
  renderBoard();
  setStatus(t('ludo_initial_turn'));
  return {
    reset, onMove: opts.onMove, onRestart: resetLocal,
    destroy: () => { epoch++; aiPending = false; remoteInputs = []; dice3d.reset(); area.style.touchAction = previousTouchAction; area.style.overscrollBehavior = previousOverscroll; },
    whenIdle: () => new Promise(resolve => {
      const wait = () => (phase !== 'rolling' && !drainingRemoteInputs) ? resolve() : setTimeout(wait, 20);
      wait();
    }),
    snapshot, onRestore,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic: { ...cosmetic, players:{...cosmetic.players} } }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, getMatchStats,
    getMultiplayerRequirement: () => n > 4 ? 'MULTI_TABLE_REQUIRED' : null,
  };
}
