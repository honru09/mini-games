/* ================= 斗兽棋 ================= */
function gameJungle(area, extra, n, opts){
  opts = opts || {};
  const COLS = 9, ROWS = 7;
  const RANK = { '鼠':1,'猫':2,'狗':3,'狼':4,'豹':5,'虎':6,'狮':7,'象':8 };
  const PIECES = ['象','狮','虎','豹','狼','狗','猫','鼠'];
  const EMOJI = { '象':'🐘','狮':'🦁','虎':'🐯','豹':'🐆','狼':'🐺','狗':'🐶','猫':'🐱','鼠':'🐭' };
  let board = Array.from({length:ROWS}, () => Array(COLS).fill(null)); // {p, type}
  let cur = 0, over = false, winner = -1, selected = null, legalMoves = [];
  let aiPending = false, aiEpoch = 0;
  function aiState(){
    return {
      board: board.map(row => row.map(piece => piece ? (String(piece.p) + piece.type) : '--')),
      turn: cur,
    };
  }
  function isWater(r,c){ return r >= 2 && r <= 4 && ((c >= 1 && c <= 3) || (c >= 5 && c <= 7)); }
  function denOf(p){ return p === 0 ? [3,0] : [3,8]; }
  function trapOf(p){
    const d = denOf(p);
    if (p === 0) return [[3,1],[2,0],[4,0]];
    return [[3,7],[2,8],[4,8]];
  }
  function initBoard(){
    board = Array.from({length:ROWS}, () => Array(COLS).fill(null));
    const row0 = ['象','狮','虎','豹','狼','狗','猫','鼠']; // 蓝方（上方）
    row0.forEach((t, i) => {
      const col = i < 4 ? i : i + 1; // 0-3 与 5-8，4 是兽穴
      board[0][col] = { p: 1, type: t };
    });
    const row6 = ['鼠','猫','狗','狼','豹','虎','狮','象']; // 红方（下方）
    row6.forEach((t, i) => {
      const col = i < 4 ? i : i + 1;
      board[6][col] = { p: 0, type: t };
    });
  }
  function inBoard(r,c){ return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function canCapture(att, def, r, c){
    if (!def) return true;
    if (att.p === def.p) return false;
    let ar = RANK[att.type], dr = RANK[def.type];
    if (isWater(r,c)){
      if (def.type === '鼠') return att.type === '鼠';
      return false;
    }
    const trap = trapOf(att.p);
    if (trap.some(([tr,tc]) => tr === r && tc === c)) dr = 0;
    if (att.type === '鼠' && def.type === '象') return true;
    return ar > dr;
  }
  function movesOf(p, r, c){
    const piece = board[r][c];
    if (!piece || piece.p !== p) return [];
    const res = [];
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr,dc] of dirs){
      const nr = r + dr, nc = c + dc;
      if (!inBoard(nr,nc)) continue;
      const d0 = denOf(p);
      if (nr === d0[0] && nc === d0[1]) continue; // 不能进自己兽穴
      if (board[nr][nc] && board[nr][nc].p === p) continue;
      if (isWater(nr,nc)){
        if (piece.type !== '鼠') continue;
        if (canCapture(piece, board[nr][nc], nr, nc)) res.push([nr,nc]);
        continue;
      }
      if (canCapture(piece, board[nr][nc], nr, nc)) res.push([nr,nc]);
    }
    // 狮/虎跳河
    if (piece.type === '狮' || piece.type === '虎'){
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        let nr = r + dr, nc = c + dc;
        if (isWater(nr,nc)){
          let jumped = false, blockedByRat = false;
          while (inBoard(nr,nc) && isWater(nr,nc)){
            if (board[nr][nc]){ blockedByRat = true; break; }
            nr += dr; nc += dc; jumped = true;
          }
          if (jumped && !blockedByRat && inBoard(nr,nc)){
            const d0 = denOf(p);
            if (!(nr === d0[0] && nc === d0[1]) && canCapture(piece, board[nr][nc], nr, nc)) res.push([nr,nc]);
          }
        }
      }
    }
    return res;
  }
  function allMoves(p){
    const all = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
      const piece = board[r][c];
      if (piece && piece.p === p) movesOf(p, r, c).forEach(to => all.push({ from: [r,c], to }));
    }
    return all;
  }
  function lose(pi){
    if (over) return;
    aiEpoch++; aiPending = false;
    over = true; winner = pi ^ 1;
    if (opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: pi, coins: 0, rank: 2 }]);
    render();
    setStatus('🏆 玩家' + (winner+1) + ' 获胜！', true);
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
      const all = allMoves(cur);
      if (!all.length){ aiPending = false; lose(cur); return; }
      const d0 = denOf(cur);
      let best = all[0], bestV = -1e9;
      const scored = [];
      all.forEach(mv => {
        const target = board[mv.to[0]][mv.to[1]];
        let v = target ? (RANK[target.type] * 10) : 0;
        if (target && target.type === '象' && board[mv.from[0]][mv.from[1]].type === '鼠') v = 80;
        v += (Math.abs(mv.to[0] - d0[0]) + Math.abs(mv.to[1] - d0[1])) * 2;
        scored.push({ mv, score: v });
        if (v > bestV){ bestV = v; best = mv; }
      });
      const jPick = aiPersonaMove(all.length, all.indexOf(best), opts.aiPersona);
      const fallback = all[jPick];
      const canonical = move => move.from.join(',') + '>' + move.to.join(',');
      const choices = scored.slice().sort((a, b) => b.score - a.score).slice(0, 200).map(item => canonical(item.mv));
      const moveByChoice = new Map(all.map(move => [canonical(move), move]));
      const remoteChoice = await aiChoose('jungle', state, choices, opts.aiPersona);
      if (opts.destroyed || epoch !== aiEpoch || over || cur !== turn || JSON.stringify(aiState()) !== stateKey){
        if (epoch === aiEpoch) aiPending = false;
        return;
      }
      const jMv = moveByChoice.has(remoteChoice) ? moveByChoice.get(remoteChoice) : fallback;
      aiPending = false;
      aiSpeak(opts.aiPersona, 'think');
      if (opts.online) opts.sendMove({ from: jMv.from, to: jMv.to });
      doMove(jMv.from, jMv.to);
    }, 650);
  }
  function doMove(from, to){
    if (over || !Array.isArray(from) || !Array.isArray(to) || from.length !== 2 || to.length !== 2) return false;
    const coords = from.concat(to).map(Number);
    if (!coords.every(Number.isInteger)) return false;
    from = coords.slice(0, 2); to = coords.slice(2, 4);
    if (from[0] < 0 || from[0] >= ROWS || from[1] < 0 || from[1] >= COLS ||
        to[0] < 0 || to[0] >= ROWS || to[1] < 0 || to[1] >= COLS) return false;
    const piece = board[from[0]][from[1]];
    if (!piece || piece.p !== cur || !movesOf(cur, from[0], from[1]).some(m => m[0] === to[0] && m[1] === to[1])) return false;
    aiEpoch++;
    playFeedback(board[to[0]][to[1]] ? 'capture' : 'move');
    board[from[0]][from[1]] = null;
    board[to[0]][to[1]] = piece;
    selected = null; legalMoves = [];
    const d1 = denOf(cur ^ 1);
    if (to[0] === d1[0] && to[1] === d1[1]){
      over = true; winner = cur;
      if (opts.onEnd) opts.onEnd([{ slot: cur, coins: 1, rank: 1 }, { slot: cur ^ 1, coins: 0, rank: 2 }]);
      render();
      return true;
    }
    const cnt0 = board.flat().filter(x => x && x.p === 0).length;
    const cnt1 = board.flat().filter(x => x && x.p === 1).length;
    if (cnt1 === 0 || cnt0 === 0){
      over = true;
      winner = cnt1 === 0 ? 0 : 1;
      if (opts.onEnd) opts.onEnd([{ slot: winner, coins: 1, rank: 1 }, { slot: winner ^ 1, coins: 0, rank: 2 }]);
      render();
      return true;
    }
    cur ^= 1;
    if (!allMoves(cur).length){ lose(cur); return true; }
    render();
    setStatus('轮到玩家' + (cur+1) + '，点击棋子');
    scheduleAI();
    return true;
  }
  function render(){
  // Add hint button for local mode
  extra.innerHTML = '';
  if (!opts.online) {
    const hintBtn = el('button','btn','💡 提示');
    hintBtn.addEventListener('click', () => {
      if (over) return;
      if (opts.ai && opts.ai.has(cur)) return;
      const all = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
        const piece = board[r][c];
        if (piece && piece.p === cur) movesOf(cur, r, c).forEach(m => all.push({from:[r,c],to:m}));
      }
      if (!all.length) { toast('无子可动'); return; }
      // Prefer captures
      const caps = all.filter(mv => board[mv.to[0]][mv.to[1]] && board[mv.to[0]][mv.to[1]].p !== cur);
      const pick = caps.length ? caps[Math.floor(Math.random() * caps.length)] : all[Math.floor(Math.random() * all.length)];
      selected = pick.from;
      legalMoves = movesOf(cur, pick.from[0], pick.from[1]);
      render();
      setStatus('提示：点击高亮棋子走棋');
    });
    extra.appendChild(hintBtn);
  }
    const w = area.clientWidth || 520;
    const S = Math.min(w, 540);
    area.innerHTML = '';
    const boardEl = el('div','jungle-board');
    boardEl.style.width = S + 'px'; boardEl.style.height = S * ROWS / COLS + 'px';
    const cs = S / COLS;
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        const cell = el('div','j-cell');
        cell.style.left = (c*cs) + 'px'; cell.style.top = (r*cs) + 'px';
        cell.style.width = cs + 'px'; cell.style.height = cs + 'px';
        if (isWater(r,c)) cell.classList.add('water');
        const trap = trapOf(0).concat(trapOf(1));
        if (trap.some(([tr,tc]) => tr === r && tc === c)) cell.classList.add('trap');
        if ((r === 3 && c === 0) || (r === 3 && c === 8)) cell.classList.add('den');
        const piece = board[r][c];
        if (piece){
          cell.textContent = EMOJI[piece.type];
          cell.classList.add('king' + piece.p);
          const sub = el('span','j-sub', piece.type);
          cell.appendChild(sub);
        }
        if (selected && selected[0] === r && selected[1] === c) cell.classList.add('sel');
        if (legalMoves.some(([lr,lc]) => lr === r && lc === c)) cell.style.boxShadow = '0 0 0 3px rgba(34,160,107,.6)';
        cell.addEventListener('click', () => {
          if (over) return;
          if (opts.online && cur !== opts.myIdx) return;
          if (opts.ai && opts.ai.has(cur)) return;
          if (selected){
            if (legalMoves.some(([lr,lc]) => lr === r && lc === c)){
              if (opts.online) opts.sendMove({ from: selected, to: [r,c] });
              doMove(selected, [r,c]);
              return;
            }
            selected = null; legalMoves = [];
          }
          const piece = board[r][c];
          if (piece && piece.p === cur){
            selected = [r,c];
            legalMoves = movesOf(cur, r, c);
          }
          render();
        });
        boardEl.appendChild(cell);
      }
    }
    if (over){
      const winnerName = '玩家' + (winner+1);
      showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: '斗兽棋获胜', coins: 1, onRestart: resetLocal
      });
    }
    area.appendChild(boardEl);
    const cnt = [board.flat().filter(x => x && x.p === 0).length, board.flat().filter(x => x && x.p === 1).length];
    renderPlayers(cur, ['🐘x' + cnt[0], '🐘x' + cnt[1]]);
  }
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (!payload || !Array.isArray(payload.from) || !Array.isArray(payload.to)) return;
    doMove(payload.from, payload.to);
  };
  function resetLocal(){
    aiEpoch++;
    initBoard();
    cur = 0; over = false; winner = -1; selected = null; legalMoves = []; aiPending = false;
    render();
    setStatus('轮到玩家1，点击棋子');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot: () => ({ board: board.map(r => r.map(x => x ? { p: x.p, type: x.type } : null)), cur, over, winner }) };
}
