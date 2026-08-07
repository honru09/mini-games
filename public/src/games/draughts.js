/* ================= 国际跳棋 ================= */
function gameDraughts(area, extra, n, opts){
  opts = opts || {};
  const N = 8;
  let board = Array.from({length:N}, () => Array(N).fill(null)); // {p, king}
  let cur = 0, over = false, winner = -1, mustCapture = null, captureChain = false;
  let aiPending = false, aiEpoch = 0;
  function aiState(){
    return {
      board: board.map(row => row.map(piece => piece ? (String(piece.p) + (piece.king ? 'K' : 'M')) : '--')),
      turn: cur,
      forcedFrom: captureChain && mustCapture ? mustCapture.join(',') : null,
    };
  }
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
    if (captureChain && mustCapture){
      const from = mustCapture;
      const move = capturesFor(cur, from[0], from[1])
        .map(cap => ({ from: from.slice(), to: [cap[0],cap[1]], via: [cap[2],cap[3]] }))
        .find(m => m.to[0] === r && m.to[1] === c);
      if (!move) return;
      if (opts.online) opts.sendMove({ from, to: move.to, via: move.via });
      applyMove(cur, from, move.to, move.via);
      return;
    }
    if (board[r][c] && board[r][c].p === cur){
      const forced = allCaptures(cur);
      const candidates = forced.length ? forced : simpleMoves(cur);
      if (!candidates.some(m => m.from[0] === r && m.from[1] === c)) return;
      mustCapture = [r, c];
      render();
      return;
    }
    if (mustCapture){
      const from = mustCapture;
      const forced = allCaptures(cur);
      const candidates = (forced.length ? forced : simpleMoves(cur)).filter(m => m.from[0] === from[0] && m.from[1] === from[1]);
      const move = candidates.find(m => m.to[0] === r && m.to[1] === c);
      if (!move) return;
      if (opts.online) opts.sendMove({ from, to: move.to, via: move.via || null });
      applyMove(cur, from, move.to, move.via || null);
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
  function legalTurnMoves(pi){
    if (captureChain && mustCapture){
      return capturesFor(pi, mustCapture[0], mustCapture[1]).map(cap => ({
        from: mustCapture.slice(), to: [cap[0],cap[1]], via: [cap[2],cap[3]],
      }));
    }
    const captures = allCaptures(pi);
    return captures.length ? captures : simpleMoves(pi);
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
      const moves = legalTurnMoves(cur);
      if (!moves.length){ aiPending = false; lose(cur); return; }
      const caps = moves.filter(move => move.via);
      let pick = moves[0];
      if (caps.length){
        pick = caps.slice().sort((a, b) => {
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
      const fallback = moves[drgPick];
      const canonical = move => move.from.join(',') + '>' + move.to.join(',');
      const choices = moves.slice(0, 200).map(canonical);
      const moveByChoice = new Map(moves.map(move => [canonical(move), move]));
      const remoteChoice = await aiChoose('draughts', state, choices, opts.aiPersona);
      if (opts.destroyed || epoch !== aiEpoch || over || cur !== turn || JSON.stringify(aiState()) !== stateKey){
        if (epoch === aiEpoch) aiPending = false;
        return;
      }
      const drgMv = moveByChoice.has(remoteChoice) ? moveByChoice.get(remoteChoice) : fallback;
      aiPending = false;
      aiSpeak(opts.aiPersona, 'think');
      applyMove(cur, drgMv.from, drgMv.to, drgMv.via || null);
    }, 600);
  }
  function applyMove(pi, from, to, via){
    if (over || pi !== cur || !Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2) return false;
    const coords = from.concat(to).map(Number);
    if (!coords.every(Number.isInteger) || coords.some(v => v < 0 || v >= N)) return false;
    from = coords.slice(0, 2); to = coords.slice(2, 4);
    const legal = legalTurnMoves(pi);
    const move = legal.find(m => m.from[0] === from[0] && m.from[1] === from[1] && m.to[0] === to[0] && m.to[1] === to[1]);
    if (!move) return false;
    via = move.via || null;
    const piece = board[from[0]][from[1]];
    aiEpoch++;
    playFeedback(via ? 'capture' : 'move');
    board[from[0]][from[1]] = null;
    if (via) board[via[0]][via[1]] = null;
    const wasKing = piece.king;
    let king = wasKing;
    if (!king && ((pi === 0 && to[0] === 7) || (pi === 1 && to[0] === 0))) king = true;
    board[to[0]][to[1]] = { p: pi, king };
    // 连跳
    const promoted = !wasKing && king;
    if (via && capturesFor(pi, to[0], to[1]).length && !promoted){
      mustCapture = to.slice();
      captureChain = true;
      render();
      setStatus('玩家' + (cur+1) + ' 继续跳吃');
      scheduleAI();
      return true;
    }
    mustCapture = null;
    captureChain = false;
    endTurn();
    return true;
  }
  function lose(pi){
    aiEpoch++; aiPending = false; captureChain = false; mustCapture = null;
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
    captureChain = false; mustCapture = null;
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
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (!payload || !Array.isArray(payload.from) || !Array.isArray(payload.to)) return;
    applyMove(cur, payload.from, payload.to, payload.via);
  };
  function resetLocal(){
    aiEpoch++;
    initBoard();
    cur = 0; over = false; winner = -1; mustCapture = null; captureChain = false; aiPending = false;
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
