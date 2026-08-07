/* ================= 象棋 ================= */
function gameXiangqi(area, extra, n, opts){
  opts = opts || {};
  const COLS = 9, ROWS = 10;
  const PIECE = { 'k':'帅','a':'仕','e':'相','h':'马','r':'车','c':'炮','p':'兵' };
  const BLACK_PIECE = { 'k':'将','a':'士','e':'象','h':'马','r':'车','c':'炮','p':'卒' };
  const EMOJI = { '帅':'🤴','仕':'🧑‍⚖️','相':'🧓','马':'🐴','车':'🚗','炮':'💣','兵':'🪖','将':'👑','士':'🧑‍⚖️','象':'🐘','卒':'🪖' };
  let board = Array.from({length:ROWS}, () => Array(COLS).fill(null)); // {p, t}
  let cur = 0, over = false, winner = -1, selected = null, legalMoves = [], lastMove = null;
  let aiPending = false, aiEpoch = 0;
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
    return movesOf(p, r, c).filter(([nr,nc]) => {
      const from = board[r][c], to = board[nr][nc];
      board[r][c] = null; board[nr][nc] = from;
      const bad = isCheck(p);
      board[r][c] = from; board[nr][nc] = to;
      return !bad;
    });
  }
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    const gen = aiEpoch;
    const turn = cur;
    setStatus('🤖 AI 思考中…');
    setTimeout(async () => {
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn || !opts.ai.has(cur)){
        aiPending = false;
        return;
      }
      const all = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
        const piece = board[r][c];
        if (piece && piece.p === cur){
          legalMovesOf(cur, r, c).forEach(m => all.push({ from: [r,c], to: m }));
        }
      }
      if (!all.length){ aiPending = false; lose(cur); return; }
      const VAL = { 'p':1,'a':2,'e':2,'h':4,'c':4.5,'r':9,'k':100 };
      all.forEach(mv => {
        const target = board[mv.to[0]][mv.to[1]];
        mv.score = (target ? (VAL[target.t] * 10) : 0) + (Math.random() - 0.5) * 0.5;
      });
      const ranked = all.slice().sort((a, b) => b.score - a.score).slice(0, 180);
      const choices = ranked.map(mv => mv.from.join(',') + '>' + mv.to.join(','));
      const remoteChoice = await aiChoose('xiangqi', {
        board: board.map(row => row.map(item => item ? (item.p + item.t) : '--')),
        turn: cur, inCheck: isCheck(cur), lastMove,
      }, choices, opts.aiPersona);
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn){
        aiPending = false;
        return;
      }
      let xqPick = choices.indexOf(remoteChoice);
      if (xqPick < 0) xqPick = aiPersonaMove(ranked.length, 0, opts.aiPersona);
      const xqMv = ranked[xqPick];
      aiPending = false;
      aiSpeak(opts.aiPersona, 'think');
      doMove(xqMv.from, xqMv.to);
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
    playFeedback(board[to[0]][to[1]] ? 'capture' : 'move');
    board[from[0]][from[1]] = null;
    board[to[0]][to[1]] = piece;
    lastMove = [from, to];
    selected = null; legalMoves = [];
    cur ^= 1;
    // 判断对方是否被将死
    const all = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const p2 = board[r][c];
      if (p2 && p2.p === cur) legalMovesOf(cur, r, c).forEach(m => all.push([r,c,m]));
    }
    if (!all.length){
      over = true;
      winner = cur ^ 1;
      if (opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: cur, coins: 0, rank: 2 }]);
      render();
      return true;
    }
    render();
    setStatus(isCheck(cur) ? '⚠️ 玩家' + (cur+1) + ' 被将军！请应将' : '轮到玩家' + (cur+1));
    scheduleAI();
    return true;
  }
  function lose(pi){
    over = true;
    winner = pi ^ 1;
    if (opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: pi, coins: 0, rank: 2 }]);
    render();
  }
  function render(){
    const w = area.clientWidth || 520;
    const S = Math.min(w, 560);
    area.innerHTML = '';
    const wrap = el('div','xiangqi-wrap');
    const boardEl = el('div','xiangqi-board');
    boardEl.style.width = S + 'px'; boardEl.style.height = S * ROWS / COLS + 'px';
    const cs = S / COLS;
    const cv = document.createElement('canvas');
    cv.style.position = 'absolute'; cv.style.left = '0'; cv.style.top = '0';
    const dpr = window.devicePixelRatio || 1;
    cv.width = S*dpr; cv.height = S*ROWS/COLS*dpr;
    boardEl.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = '#e9c79a'; ctx.fillRect(0,0,S,S*ROWS/COLS);
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 1.4;
    const pad = cs/2;
    for (let c = 0; c < COLS; c++){
      ctx.beginPath(); ctx.moveTo(pad + c*cs, pad); ctx.lineTo(pad + c*cs, S - pad); ctx.stroke();
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
    // 河界
    ctx.setLineDash([6,5]);
    ctx.beginPath(); ctx.moveTo(pad, pad + 5*cs); ctx.lineTo(S - pad, pad + 5*cs); ctx.stroke();
    ctx.setLineDash([]);
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const piece = board[r][c];
        if (!piece) continue;
        const x = pad + c*cs, y = pad + r*cs;
        ctx.beginPath(); ctx.arc(x, y, cs*0.42, 0, Math.PI*2);
        ctx.fillStyle = piece.p === 0 ? '#fde2d3' : '#d9e6f2';
        ctx.fill();
        ctx.strokeStyle = piece.p === 0 ? '#b23a1f' : '#1f4e79';
        ctx.lineWidth = 1.6; ctx.stroke();
        const label = piece.p === 0 ? PIECE[piece.t] : BLACK_PIECE[piece.t];
        ctx.fillStyle = piece.p === 0 ? '#b23a1f' : '#1f4e79';
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
        ctx.fillStyle = 'rgba(34,160,107,.4)';
        ctx.beginPath(); ctx.arc(pad + nc*cs, pad + nr*cs, cs*0.18, 0, Math.PI*2); ctx.fill();
      });
    }
    boardEl.addEventListener('click', e => {
      if (over) return;
      if (opts.online && cur !== opts.myIdx) return;
      if (opts.ai && opts.ai.has(cur)) return;
      const rect = boardEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * S;
      const y = (e.clientY - rect.top) / (rect.height) * S * ROWS / COLS;
      const c = Math.round((x - pad) / cs), r = Math.round((y - pad) / cs);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      if (selected){
        if (legalMoves.some(([mr,mc]) => mr === r && mc === c)){
          if (opts.online) opts.sendMove({ from: selected, to: [r,c] });
          doMove(selected, [r,c]);
          return;
        }
        selected = null; legalMoves = [];
      }
      const piece = board[r][c];
      if (piece && piece.p === cur){
        selected = [r,c];
        legalMoves = legalMovesOf(cur, r, c);
      }
      render();
    });
    if (over){
      const winnerName = '玩家' + (winner+1);
      showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: '象棋获胜', coins: 1, onRestart: resetLocal
      });
    }
    wrap.appendChild(boardEl);
    area.appendChild(wrap);
    renderPlayers(cur, null);
  }
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (!payload || !Array.isArray(payload.from) || !Array.isArray(payload.to)) return;
    doMove(payload.from, payload.to);
  };
  function resetLocal(){
    aiEpoch++;
    initBoard();
    cur = 0; over = false; winner = -1; selected = null; legalMoves = []; lastMove = null; aiPending = false;
    render();
    setStatus('轮到玩家1，点击棋子走棋');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot: () => ({ board: board.map(r => r.map(x => x ? { p: x.p, t: x.t } : null)), cur, over, winner }) };
}
