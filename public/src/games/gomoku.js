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
  const N = 15, CELL = 34, PAD = 22, LOGICAL = PAD*2 + CELL*(N-1);
  let grid = Array.from({length:N}, () => Array(N).fill(-1));
  let cur = 0, over = false, hist = [], last = null, winLine = [];
  let boardTheme = opts.boardTheme === 'grass' ? 'grass' : 'classic';
  let cosmetic = normalizeCosmetic(opts.cosmetic);
  let spectator = !!opts.spectator, spectators = [], activePlayers = [0, 1];
  let startedAt = Date.now(), finishedAt = 0, ghost = null;
  let aiPending = false, aiEpoch = 0;
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
    turnHud.textContent = over ? (winLine.length ? '五连完成 · 玩家' + (cur + 1) : '本局结束') :
      (spectator ? '观战 · 玩家' + (cur + 1) + ' 的回合' : (opts.online ? (cur === opts.myIdx ? '你的回合' : '对方回合') : '玩家' + (cur + 1) + ' 的回合'));
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
  function gomokuLineScore(r, c, p){
    let best = 0;
    for (const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
      let cnt = 1, open = 0;
      for (const s of [1,-1]){
        let nr = r + dr*s, nc = c + dc*s;
        while (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] === p){ cnt++; nr += dr*s; nc += dc*s; }
        if (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] === -1) open++;
      }
      if (cnt >= 5) return 1e9;
      best = Math.max(best, Math.pow(cnt, 3) * (open + 1));
    }
    return best;
  }
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    const epoch = ++aiEpoch;
    const turn = cur;
    const state = aiState();
    const stateKey = JSON.stringify(state);
    setStatus('🤖 AI 思考中…');
    setTimeout(async () => {
      if (opts.destroyed || epoch !== aiEpoch || over || cur !== turn || JSON.stringify(aiState()) !== stateKey){
        if (epoch === aiEpoch) aiPending = false;
        return;
      }
      const empties = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === -1) empties.push(r + ',' + c);
      if (!empties.length){ aiPending = false; return; }
      let bestR = -1, bestC = -1, bestV = -1;
      const scored = [];
      for (const s of empties){
        const [r, c] = s.split(',').map(Number);
        const atk = gomokuLineScore(r, c, cur);
        const def = gomokuLineScore(r, c, cur ^ 1);
        const v = Math.max(atk, def * 1.1);
        scored.push({ choice: s, value: v, center: Math.abs(r - 7) + Math.abs(c - 7) });
        if (v > bestV){ bestV = v; bestR = r; bestC = c; }
      }
      const gomokuPick = aiPersonaMove(empties.length, empties.indexOf(bestR + ',' + bestC), opts.aiPersona);
      const fallback = empties[gomokuPick];
      const choices = scored.slice().sort((a, b) => b.value - a.value || a.center - b.center)
        .slice(0, 200).map(item => item.choice);
      const moveByChoice = new Map(empties.map(choice => [choice, choice.split(',').map(Number)]));
      const remoteChoice = await aiChoose('gomoku', state, choices, opts.aiPersona);
      if (opts.destroyed || epoch !== aiEpoch || over || cur !== turn || JSON.stringify(aiState()) !== stateKey){
        if (epoch === aiEpoch) aiPending = false;
        return;
      }
      const chosen = moveByChoice.has(remoteChoice) ? remoteChoice : fallback;
      const gpArr = moveByChoice.get(chosen);
      aiPending = false;
      aiSpeak(opts.aiPersona, 'think');
      if (opts.online && typeof opts.sendBotMove === 'function'){ opts.sendBotMove(turn, [gpArr[0], gpArr[1]]); return; }
      applyMove(gpArr[0], gpArr[1]);
    }, 550);
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas gomoku-board';
  const artEnabled = gameArtEnabled('gomoku');
  if (artEnabled){
    canvas.classList.add('game-art-v1');
    setAssetCssUrl(canvas, '--game-board-art', gameArtUrl('gomoku', 'board'));
  }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = LOGICAL * dpr; canvas.height = LOGICAL * dpr;
  area.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  function applyPresentation(){
    canvas.dataset.boardTheme = boardTheme;
    canvas.dataset.pieceSkin = cosmetic.default;
    if (boardTheme === 'grass'){
      canvas.classList.remove('game-art-v1');
      canvas.style.backgroundColor = '#86a96b';
      canvas.style.backgroundImage = 'radial-gradient(circle at 20% 15%,rgba(255,255,255,.24),transparent 34%),repeating-linear-gradient(105deg,rgba(35,92,45,.13) 0 2px,transparent 2px 7px),linear-gradient(#9fc17f,#668e57)';
    } else {
      if (artEnabled) canvas.classList.add('game-art-v1');
      canvas.style.backgroundColor = artEnabled ? '#d7a153' : '#e6c58b';
      if (!artEnabled) canvas.style.backgroundImage = 'linear-gradient(100deg,rgba(105,63,22,.12),transparent 35%,rgba(105,63,22,.08))';
    }
  }
  function draw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LOGICAL, LOGICAL);
    ctx.strokeStyle = boardTheme === 'grass' ? 'rgba(30,61,31,.72)' : (artEnabled ? 'rgba(76,43,15,.68)' : '#8a6638'); ctx.lineWidth = 1;
    for (let i=0;i<N;i++){
      ctx.beginPath(); ctx.moveTo(PAD + i*CELL, PAD); ctx.lineTo(PAD + i*CELL, PAD + (N-1)*CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD, PAD + i*CELL); ctx.lineTo(PAD + (N-1)*CELL, PAD + i*CELL); ctx.stroke();
    }
    ctx.fillStyle = artEnabled ? '#5b3615' : '#1d2433';
    for (const [r,c] of [[3,3],[3,11],[7,7],[11,3],[11,11]]){
      ctx.beginPath(); ctx.arc(PAD + c*CELL, PAD + r*CELL, 3, 0, Math.PI*2); ctx.fill();
    }
    for (let r=0;r<N;r++) for (let c=0;c<N;c++){
      if (grid[r][c] === -1) continue;
      const x = PAD + c*CELL, y = PAD + r*CELL;
      const skin = pieceSkin(grid[r][c]);
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
      ctx.strokeStyle = grid[last[0]][last[1]] === 1 ? '#111827' : '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(PAD + last[1]*CELL, PAD + last[0]*CELL, CELL*0.18, 0, Math.PI*2); ctx.stroke();
    }
    if (ghost && !spectator && !over && grid[ghost[0]][ghost[1]] === -1){
      ctx.save(); ctx.globalAlpha = .36; ctx.fillStyle = cur === 0 ? '#111827' : '#f8fafc';
      ctx.beginPath(); ctx.arc(PAD + ghost[1]*CELL, PAD + ghost[0]*CELL, CELL*.4, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
    if (winLine.length){
      const first = winLine[0], end = winLine[winLine.length - 1];
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(PAD + first[1]*CELL, PAD + first[0]*CELL); ctx.lineTo(PAD + end[1]*CELL, PAD + end[0]*CELL); ctx.stroke();
    }
    updateHud();
  }
  function pointerCell(e){
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * LOGICAL;
    const y = (e.clientY - rect.top) / rect.height * LOGICAL;
    return [Math.round((y - PAD) / CELL), Math.round((x - PAD) / CELL)];
  }
  canvas.addEventListener('mousemove', e => {
    if (spectator || over || (opts.online && cur !== opts.myIdx) || (opts.ai && opts.ai.has(cur))) return;
    const [r, c] = pointerCell(e);
    ghost = r >= 0 && r < N && c >= 0 && c < N && grid[r][c] === -1 ? [r, c] : null;
    draw();
  });
  canvas.addEventListener('mouseleave', () => { if (ghost){ ghost = null; draw(); } });
  canvas.addEventListener('click', e => {
    if (over || spectator) return;
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    const [r, c] = pointerCell(e);
    if (r < 0 || r >= N || c < 0 || c >= N) return;
    if (grid[r][c] !== -1) return;
    if (opts.onProgress) opts.onProgress([r, c]);
    if (opts.online) opts.sendMove([r, c]);
    applyMove(r, c);
  });
  function applyMove(r, c){
    if (Array.isArray(r)){ c = r[1]; r = r[0]; }
    r = Number(r); c = Number(c);
    if (over || !Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= N || c < 0 || c >= N || grid[r][c] !== -1) return false;
    aiEpoch++;
    playFeedback('place');
    grid[r][c] = cur; last = [r,c]; hist.push([r,c]);
    if (checkGomokuWin(grid, r, c)){
      over = true; finishedAt = Date.now(); winLine = winningCells(r, c); ghost = null; area.style.touchAction = 'auto';
      if (opts.onEnd) opts.onEnd([
        { slot: cur, coins: 1, rank: 1 },
        { slot: cur ^ 1, coins: 0, rank: 2 },
      ]);
      draw(); renderPlayers(cur, null);
      setStatus('🏆 玩家' + (cur+1) + ' 获胜！', true);
      showVictoryOverlay(area, {
        winner: cur, winnerName: '玩家' + (cur+1), emoji: '🎉',
        subtitle: '五子连线', coins: 1, onRestart: reset, onShare: () => shareGameLink('gomoku'), onInvite: online.room && online.isHost ? () => openInvitePicker() : null
      });
      return true;
    }
    if (hist.length === N*N){
      over = true; finishedAt = Date.now(); ghost = null; area.style.touchAction = 'auto';
      if (opts.onEnd) opts.onEnd([
        { slot: 0, coins: 0, rank: 1 },
        { slot: 1, coins: 0, rank: 1 },
      ]);
      draw(); renderPlayers(cur, null);
      setStatus(t('result_draw'), false);
      showVictoryOverlay(area, {
        winner: 0, emoji: '🤝', subtitle: '棋盘已满，平局', coins: 0, onRestart: reset, onShare: () => shareGameLink('gomoku')
      });
      return true;
    }
    cur ^= 1;
    draw(); renderPlayers(cur, null);
    setStatus(opts.online ? (cur === opts.myIdx ? '你的回合，点击棋盘落子' : '等待对方落子…') : ('玩家' + (cur+1) + ' 的回合'));
    scheduleAI();
    return true;
  }
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (Array.isArray(payload) && payload.length === 2) applyMove(payload);
  };
  if (!opts.online && !spectator){
    const undoBtn = el('button','btn','↩ 悔棋');
    undoBtn.addEventListener('click', () => {
      if (spectator || over || !hist.length) return;
      aiEpoch++; aiPending = false;
      const [r,c] = hist.pop();
      grid[r][c] = -1;
      cur ^= 1;
      last = hist.length ? hist[hist.length-1] : null;
      draw(); renderPlayers(cur, null);
      setStatus('玩家' + (cur+1) + ' 的回合');
      scheduleAI();
    });
    extra.appendChild(undoBtn);
  }
  function resetLocal(){
    aiEpoch++;
    grid = Array.from({length:N}, () => Array(N).fill(-1));
    cur = 0; over = false; hist = []; last = null; winLine = []; ghost = null; aiPending = false; startedAt = Date.now(); finishedAt = 0;
    area.style.touchAction = spectator ? 'auto' : 'none';
    applyPresentation();
    draw(); renderPlayers(0, null);
    setStatus(opts.online ? (cur === opts.myIdx ? '你的回合，点击棋盘落子' : '等待对方落子…') : '玩家1 的回合');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  function setBoardTheme(theme){ boardTheme = theme === 'grass' ? 'grass' : 'classic'; applyPresentation(); draw(); return boardTheme; }
  function setCosmetic(value){ cosmetic = normalizeCosmetic(value); draw(); return { default:cosmetic.default, players:{...cosmetic.players} }; }
  function setSpectators(value){ spectator = Array.isArray(value) ? value.includes(opts.viewerId) : !!value; spectators = Array.isArray(value) ? value.slice() : spectators; area.style.touchAction = spectator || over ? 'auto' : 'none'; ghost = null; draw(); return spectator; }
  function startMatch(playerA, playerB){ activePlayers = [playerA, playerB]; resetLocal(); return { activePlayers: activePlayers.slice(), spectators: spectators.slice() }; }
  function getMatchStats(){ return { duration: Math.max(0, (finishedAt || Date.now()) - startedAt), moves: hist.length, winner: over && winLine.length ? cur : null }; }
  function reportGameResult(){ const stats = getMatchStats(); if (typeof opts.reportGameResult === 'function') opts.reportGameResult(stats); return stats; }
  function snapshot(){ return { hist: hist.map(h => h.slice()), cur, over, last: last ? last.slice() : null }; }
  function onRestore(value){
    const state = value && value.state ? value.state : value;
    if (!state || !Array.isArray(state.hist)) return false;
    grid = Array.from({length:N}, () => Array(N).fill(-1)); hist = [];
    state.hist.forEach((move, index) => { if (Array.isArray(move) && move.length === 2 && grid[move[0]] && grid[move[0]][move[1]] === -1){ grid[move[0]][move[1]] = index % 2; hist.push([move[0], move[1]]); } });
    cur = Number(state.cur) === 1 ? 1 : 0; over = !!state.over; last = Array.isArray(state.last) ? state.last.slice(0, 2) : (hist.length ? hist[hist.length - 1].slice() : null);
    winLine = over && last ? winningCells(last[0], last[1]) : [];
    if (value && value.presentation){ boardTheme = value.presentation.boardTheme === 'grass' ? 'grass' : 'classic'; cosmetic = normalizeCosmetic(value.presentation.cosmetic); }
    applyPresentation(); draw(); renderPlayers(cur, null); return true;
  }
  resetLocal();
  return {
    reset, onMove: opts.onMove, onRestart: resetLocal, snapshot, onRestore,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic:{default:cosmetic.default,players:{...cosmetic.players}} }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, startMatch, reportGameResult, getMatchStats,
    destroy: () => { aiEpoch++; aiPending = false; area.style.touchAction = previousTouchAction; area.style.overscrollBehavior = previousOverscroll; },
  };
}
