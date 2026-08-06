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
  let cur = 0, over = false, hist = [], last = null;
  let aiPending = false;
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
    if (aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    setStatus('🤖 AI 思考中…');
    setTimeout(() => {
      aiPending = false;
      if (over) return;
      const empties = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === -1) empties.push(r + ',' + c);
      if (!empties.length) return;
      let bestR = -1, bestC = -1, bestV = -1;
      for (const s of empties){
        const [r, c] = s.split(',').map(Number);
        const atk = gomokuLineScore(r, c, cur);
        const def = gomokuLineScore(r, c, cur ^ 1);
        const v = Math.max(atk, def * 1.1);
        if (v > bestV){ bestV = v; bestR = r; bestC = c; }
      }
      const gomokuPick = aiPersonaMove(empties.length, empties.indexOf(bestR + ',' + bestC), opts.aiPersona);
      const gpArr = empties[gomokuPick].split(',').map(Number);
      aiSpeak(opts.aiPersona, 'think');
      applyMove(gpArr[0], gpArr[1]);
    }, 550);
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = LOGICAL * dpr; canvas.height = LOGICAL * dpr;
  area.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  function draw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LOGICAL, LOGICAL);
    ctx.strokeStyle = '#b8c2d4'; ctx.lineWidth = 1;
    for (let i=0;i<N;i++){
      ctx.beginPath(); ctx.moveTo(PAD + i*CELL, PAD); ctx.lineTo(PAD + i*CELL, PAD + (N-1)*CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD, PAD + i*CELL); ctx.lineTo(PAD + (N-1)*CELL, PAD + i*CELL); ctx.stroke();
    }
    ctx.fillStyle = '#1d2433';
    for (const [r,c] of [[3,3],[3,11],[7,7],[11,3],[11,11]]){
      ctx.beginPath(); ctx.arc(PAD + c*CELL, PAD + r*CELL, 3, 0, Math.PI*2); ctx.fill();
    }
    for (let r=0;r<N;r++) for (let c=0;c<N;c++){
      if (grid[r][c] === -1) continue;
      ctx.fillStyle = PLAYER_COLORS[grid[r][c]];
      ctx.beginPath(); ctx.arc(PAD + c*CELL, PAD + r*CELL, CELL*0.42, 0, Math.PI*2); ctx.fill();
    }
    if (last){
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(PAD + last[1]*CELL, PAD + last[0]*CELL, CELL*0.18, 0, Math.PI*2); ctx.stroke();
    }
  }
  canvas.addEventListener('click', e => {
    if (over) return;
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * LOGICAL;
    const y = (e.clientY - rect.top) / rect.height * LOGICAL;
    const c = Math.round((x - PAD) / CELL), r = Math.round((y - PAD) / CELL);
    if (r < 0 || r >= N || c < 0 || c >= N) return;
    if (grid[r][c] !== -1) return;
    if (opts.online) opts.sendMove([r, c]);
    applyMove(r, c);
  });
  function applyMove(r, c){
    if (Array.isArray(r)){ c = r[1]; r = r[0]; }
    playFeedback('place');
    grid[r][c] = cur; last = [r,c]; hist.push([r,c]);
    if (checkGomokuWin(grid, r, c)){
      over = true;
      if (opts.onEnd) opts.onEnd([
        { slot: cur, coins: 1, rank: 1 },
        { slot: cur ^ 1, coins: 0, rank: 2 },
      ]);
      draw(); renderPlayers(cur, null);
      setStatus('🏆 玩家' + (cur+1) + ' 获胜！', true);
      showVictoryOverlay(area, {
        winner: cur, winnerName: '玩家' + (cur+1), emoji: '🎉',
        subtitle: '五子连线', coins: 1, onRestart: resetLocal, onShare: () => shareGameLink('gomoku'), onInvite: online.room && online.isHost ? () => openInvitePicker() : null
      });
      return;
    }
    if (hist.length === N*N){
      over = true;
      if (opts.onEnd) opts.onEnd([
        { slot: 0, coins: 0, rank: 1 },
        { slot: 1, coins: 0, rank: 1 },
      ]);
      draw(); renderPlayers(cur, null);
      setStatus(t('result_draw'), false);
      showVictoryOverlay(area, {
        winner: 0, emoji: '🤝', subtitle: '棋盘已满，平局', coins: 0, onRestart: resetLocal, onShare: () => shareGameLink('gomoku')
      });
      return;
    }
    cur ^= 1;
    draw(); renderPlayers(cur, null);
    setStatus(opts.online ? (cur === opts.myIdx ? '你的回合，点击棋盘落子' : '等待对方落子…') : ('玩家' + (cur+1) + ' 的回合'));
    scheduleAI();
  }
  opts.onMove = applyMove;
  if (!opts.online){
    const undoBtn = el('button','btn','↩ 悔棋');
    undoBtn.addEventListener('click', () => {
      if (over || !hist.length) return;
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
    grid = Array.from({length:N}, () => Array(N).fill(-1));
    cur = 0; over = false; hist = []; last = null; aiPending = false;
    draw(); renderPlayers(0, null);
    setStatus(opts.online ? (cur === opts.myIdx ? '你的回合，点击棋盘落子' : '等待对方落子…') : '玩家1 的回合');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot: () => ({ hist: hist.map(h => h.slice()), cur, over, last: last ? last.slice() : null }) };
}
