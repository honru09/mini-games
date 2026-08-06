/* ================= 国际跳棋 ================= */
function gameDraughts(area, extra, n, opts){
  opts = opts || {};
  const N = 8;
  let board = Array.from({length:N}, () => Array(N).fill(null)); // {p, king}
  let cur = 0, over = false, winner = -1, mustCapture = null;
  let aiPending = false;
  const cv = document.createElement('canvas');
  cv.className = 'drg-canvas';
  const dpr = window.devicePixelRatio || 1;
  cv.addEventListener('click', e => {
    if (over) return;
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    handleClick(0 | Math.floor(y * N), 0 | Math.floor(x * N));
  });
  function handleClick(r, c){
    if (mustCapture){
      const from = mustCapture;
      if (board[r][c] && board[r][c].p === cur && capturesFor(cur, r, c).length){ mustCapture = [r,c]; render(); return; }
      const caps = capturesFor(cur, from[0], from[1]);
      const hit = caps.find(cap => cap[0] === r && cap[1] === c);
      if (hit){
        if (opts.online) opts.sendMove({ from, to: [r,c], via: [hit[2],hit[3]] });
        applyMove(cur, from, [r,c], [hit[2],hit[3]]);
        mustCapture = null;
      }
      return;
    }
    if (board[r][c] && board[r][c].p === cur){
      mustCapture = [r,c];
      render();
    }
  }
  function initBoard(){
    board = Array.from({length:N}, () => Array(N).fill(null));
    for (let r = 0; r < 3; r++){
      for (let c = 0; c < N; c++){
        if ((r + c) % 2 === 1) board[r][c] = { p: 0, king: false };
      }
    }
    for (let r = 5; r < 8; r++){
      for (let c = 0; c < N; c++){
        if ((r + c) % 2 === 1) board[r][c] = { p: 1, king: false };
      }
    }
  }
  function capturesFor(pi, r, c){
    const piece = board[r][c];
    if (!piece || piece.p !== pi) return [];
    const res = [];
    const drs = piece.king ? [-1,1] : (pi === 0 ? [1] : [-1]);
    for (const dr of drs){
      for (const dc of [-1,1]){
        const mr = r + dr, mc = c + dc;
        const lr = r + 2*dr, lc = c + 2*dc;
        if (lr < 0 || lr >= N || lc < 0 || lc >= N) continue;
        const mid = board[mr] && board[mr][mc];
        if (mid && mid.p !== pi && !board[lr][lc]) res.push([lr, lc, mr, mc]);
      }
    }
    return res;
  }
  function allCaptures(pi){
    const res = [];
    for (let r = 0; r < N; r++){
      for (let c = 0; c < N; c++){
        if (board[r][c] && board[r][c].p === pi){
          capturesFor(pi, r, c).forEach(cap => res.push({ from: [r,c], to: [cap[0],cap[1]], via: [cap[2],cap[3]] }));
        }
      }
    }
    return res;
  }
  function simpleMoves(pi){
    const res = [];
    for (let r = 0; r < N; r++){
      for (let c = 0; c < N; c++){
        const piece = board[r][c];
        if (!piece || piece.p !== pi) continue;
        const drs = piece.king ? [-1,1] : (pi === 0 ? [1] : [-1]);
        for (const dr of drs){
          for (const dc of [-1,1]){
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
            if (!board[nr][nc]) res.push({ from: [r,c], to: [nr,nc] });
          }
        }
      }
    }
    return res;
  }
  function scheduleAI(){
    if (aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    setTimeout(() => {
      aiPending = false;
      if (over) return;
      const caps = allCaptures(cur);
      let moves = caps.length ? caps : simpleMoves(cur);
      if (!moves.length){ lose(cur); return; }
      let pick = moves[0];
      if (caps.length){
        pick = caps.sort((a, b) => {
          const ka = board[a.from[0]][a.from[1]].king ? 1 : 0, kb = board[b.from[0]][b.from[1]].king ? 1 : 0;
          return kb - ka;
        })[0];
      } else {
        let best = -1e9;
        moves.forEach(mv => {
          let v = (mv.to[0] === (cur === 0 ? 7 : 0) ? 3 : 0) - Math.abs(mv.to[0] - (cur === 0 ? 7 : 0));
          if (v > best){ best = v; pick = mv; }
        });
      }
      const drgPick = aiPersonaMove(moves.length, moves.indexOf(pick), opts.aiPersona);
      aiSpeak(opts.aiPersona, 'think');
      const drgMv = moves[drgPick];
      applyMove(cur, drgMv.from, drgMv.to);
    }, 600);
  }
  function applyMove(pi, from, to, via){
    const piece = board[from[0]][from[1]];
    board[from[0]][from[1]] = null;
    if (via) board[via[0]][via[1]] = null;
    let king = piece.king;
    if (!king && ((pi === 0 && to[0] === 7) || (pi === 1 && to[0] === 0))) king = true;
    board[to[0]][to[1]] = { p: pi, king };
    // 连跳
    if (via && capturesFor(pi, to[0], to[1]).length && !king){
      setTimeout(() => {
        // 简化：连续跳时保持回合
        const caps = capturesFor(pi, to[0], to[1]);
        if (caps.length){
          // 由玩家继续
          render();
          return;
        }
        endTurn();
      }, 200);
      render();
      return;
    }
    endTurn();
  }
  function lose(pi){
    over = true;
    winner = pi ^ 1;
    if (opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: pi, coins: 0, rank: 2 }]);
    render();
  }
  function countPieces(pi){
    let c = 0;
    for (let r = 0; r < N; r++) for (let x = 0; x < N; x++) if (board[r][x] && board[r][x].p === pi) c++;
    return c;
  }
  function endTurn(){
    if (over) return;
    cur ^= 1;
    if (!countPieces(cur) || !(allCaptures(cur).length || simpleMoves(cur).length)){
      lose(cur);
      return;
    }
    render();
    setStatus('轮到玩家' + (cur+1) + '，点击自己的棋子');
    scheduleAI();
  }
  function render(){
  // Add hint button for local mode
  extra.innerHTML = '';
  if (!opts.online) {
    const hintBtn = el('button','btn','💡 提示');
    hintBtn.addEventListener('click', () => {
      if (over) return;
      if (opts.ai && opts.ai.has(cur)) return;
      const caps = allCaptures(cur);
      if (caps.length) {
        mustCapture = caps[0].from;
        render();
        setStatus('必须吃子：点击高亮棋子');
        return;
      }
      const moves = simpleMoves(cur);
      if (moves.length) {
        const mv = moves[Math.floor(Math.random() * moves.length)];
        mustCapture = mv.from;
        render();
        setStatus('提示：点击高亮棋子移动');
      } else {
        toast('无子可动');
      }
    });
    extra.appendChild(hintBtn);
  }
    const w = area.clientWidth || 520;
    const S = Math.min(w, 560);
    area.innerHTML = '';
    cv.width = S*dpr; cv.height = S*dpr;
    area.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const cs = S / N;
    for (let r = 0; r < N; r++){
      for (let c = 0; c < N; c++){
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f1eee4' : '#7b5e3b';
        ctx.fillRect(c*cs, r*cs, cs, cs);
        const piece = board[r][c];
        if (piece){
          ctx.beginPath();
          ctx.arc((c+0.5)*cs, (r+0.5)*cs, cs*0.36, 0, Math.PI*2);
          ctx.fillStyle = piece.p === 0 ? '#e5484d' : '#3b82f6';
          ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
          if (piece.king){
            ctx.fillStyle = '#fbbf24';
            ctx.font = (cs*0.5) + 'px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('★', (c+0.5)*cs, (r+0.52)*cs);
          }
        }
      }
    }
    if (over){
      const winnerName = '玩家' + (winner+1);
      showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: '国际跳棋获胜', coins: 1, onRestart: resetLocal
      });
    }
    renderPlayers(cur, null);
  }
  opts.onMove = payload => {
    if (!payload) return;
    applyMove(cur, payload.from, payload.to, payload.via);
  };
  function resetLocal(){
    initBoard();
    cur = 0; over = false; winner = -1; mustCapture = null; aiPending = false;
    render();
    setStatus('轮到玩家1，点击自己的棋子');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot: () => ({ board: board.map(r => r.map(x => x ? { p: x.p, king: x.king } : null)), cur, over, winner }) };
}
