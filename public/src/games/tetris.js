/* ================= 俄罗斯方块 ================= */
function gameTetris(area, extra, n, opts){
  opts = opts || {};
  const COLS = 10, ROWS = 18;
  const SHAPES = [
    [[1,1,1,1]],                                   // I
    [[1,1],[1,1]],                                 // O
    [[1,0,0],[1,1,1]],                             // J
    [[0,0,1],[1,1,1]],                             // L
    [[0,1,1],[1,1,0]],                             // S
    [[1,1,0],[0,1,1]],                             // Z
    [[0,1,0],[1,1,1]],                             // T
  ];
  const COLORS = ['#22d3ee','#facc15','#a78bfa','#fb923c','#34d399','#f87171','#e879f9'];
  let wells = [];
  let scores = [];
  let cur = 0, over = false, winner = -1;
  let piece = null; // {shape, x, y, rot}
  let pieceCount = 0;
  const MAX_PIECES = 8;
  let aiPending = false;
  function rotate(m){
    const rows = m.length, cols = m[0].length;
    const out = Array.from({length: cols}, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[c][rows-1-r] = m[r][c];
    return out;
  }
  function cloneWell(w){ return w.map(r => r.slice()); }
  function collide(well, sh, x, y){
    for (let r = 0; r < sh.length; r++){
      for (let c = 0; c < sh[r].length; c++){
        if (!sh[r][c]) continue;
        const rr = y + r, cc = x + c;
        if (cc < 0 || cc >= COLS || rr >= ROWS) return true;
        if (rr >= 0 && well[rr][cc]) return true;
      }
    }
    return false;
  }
  function lock(well, sh, x, y){
    const w = cloneWell(well);
    for (let r = 0; r < sh.length; r++){
      for (let c = 0; c < sh[r].length; c++){
        if (sh[r][c]){
          const rr = y + r, cc = x + c;
          if (rr < 0) return { well: w, cleared: -1 }; // top out
          w[rr][cc] = 1;
        }
      }
    }
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--){
      if (w[r].every(v => v)){
        w.splice(r, 1);
        w.unshift(Array(COLS).fill(0));
        cleared++; r++;
      }
    }
    return { well: w, cleared };
  }
  function evaluatePlacement(well, sh, x, y){
    const res = lock(well, sh, x, y);
    if (res.cleared === -1) return -1e9;
    let height = 0, holes = 0;
    for (let c = 0; c < COLS; c++){
      let colH = 0, found = false;
      for (let r = 0; r < ROWS; r++){
        if (res.well[r][c]){ if (!found){ found = true; colH = ROWS - r; } }
        else if (found) holes++;
      }
      height = Math.max(height, colH);
    }
    return res.cleared * 1000 - height * 2 - holes * 3;
  }
  function aiBestPlacement(well, shape){
    let best = null, bestV = -1e9;
    for (let rot = 0; rot < 4; rot++){
      let sh = shape;
      for (let i = 0; i < rot; i++) sh = rotate(sh);
      for (let x = -3; x <= COLS; x++){
        let y = 0;
        while (!collide(well, sh, x, y + 1)) y++;
        if (collide(well, sh, x, y)) continue;
        const v = evaluatePlacement(well, sh, x, y);
        if (v > bestV){ bestV = v; best = { x, y, sh }; }
      }
    }
    return best;
  }
  function scheduleAI(){
    if (aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    setTimeout(() => {
      aiPending = false;
      if (over) return;
      if (!piece) return;
      const idx = 0 | Math.floor(Math.random() * SHAPES.length);
      const best = aiBestPlacement(wells[cur], SHAPES[idx]);
      if (!best){ topOut(cur); return; }
      if (opts.online) opts.sendMove({ piece: idx, x: best.x, y: best.y, rot: best.rot || 0, sh: best.sh });
      applyPlacement(cur, idx, best.x, best.y, best.sh);
    }, 700);
  }
  function applyPlacement(pi, idx, x, y, sh){
    const res = lock(wells[pi], sh, x, y);
    if (res.cleared === -1){ topOut(pi); return; }
    wells[pi] = res.well;
    const pts = [0, 100, 300, 500, 800][Math.min(4, res.cleared)];
    scores[pi] += pts;
    pieceCount++;
    piece = null;
    render();
    if (pieceCount >= MAX_PIECES * n){
      over = true;
      winner = scores.reduce((a, b, i) => b > scores[a] ? i : a, 0);
      if (opts.onEnd) opts.onEnd(scores.map((s, i) => ({ slot: i, coins: i === winner ? 1 : 0, rank: i === winner ? 1 : 2 })));
      render();
      return;
    }
    endTurn();
  }
  function topOut(pi){
    scores[pi] = -1;
    toast('💀 玩家' + (pi+1) + ' 方块堆到顶出局！');
    over = true;
    winner = scores.reduce((a, b, i) => b > scores[a] ? i : a, 0);
    if (opts.onEnd) opts.onEnd(scores.map((s, i) => ({ slot: i, coins: i === winner ? 1 : 0, rank: i === winner ? 1 : 2 })));
    render();
  }
  function endTurn(){
    if (over) return;
    cur = (cur + 1) % n;
    piece = null;
    render();
    setStatus('轮到玩家' + (cur+1) + '，自动放置方块（AI）或点「放一个」');
    scheduleAI();
  }
  function render(){
    const w = area.clientWidth || 520;
    const S = Math.min(w, 540);
    area.innerHTML = '';
    const wrap = el('div','tetris-wrap');
    wells.forEach((wdata, pi) => {
      const colW = S / n - 10;
      const cell = Math.min(22, colW / COLS);
      const boardW = cell * COLS, boardH = cell * ROWS;
      const box = el('div');
      box.style.width = boardW + 'px';
      box.appendChild(el('div','tetris-score','玩家' + (pi+1) + ' · ' + Math.max(0, scores[pi]) + ' 分' + (pi === cur && !over ? ' ⏩' : '')));
      const well = el('div','tetris-well');
      well.style.width = boardW + 'px'; well.style.height = boardH + 'px';
      for (let r = 0; r < ROWS; r++){
        for (let c = 0; c < COLS; c++){
          if (wdata[r][c]){
            const cellEl = el('div','tetris-cell');
            cellEl.style.left = (c*cell) + 'px'; cellEl.style.top = (r*cell) + 'px';
            cellEl.style.width = cell + 'px'; cellEl.style.height = cell + 'px';
            cellEl.style.background = COLORS[(r*COLS+c) % 7];
            well.appendChild(cellEl);
          }
        }
      }
      if (pi === cur && piece){
        for (let r = 0; r < piece.sh.length; r++){
          for (let c = 0; c < piece.sh[r].length; c++){
            if (piece.sh[r][c]){
              const cellEl = el('div','tetris-cell');
              cellEl.style.left = ((piece.x+c)*cell) + 'px'; cellEl.style.top = ((piece.y+r)*cell) + 'px';
              cellEl.style.width = cell + 'px'; cellEl.style.height = cell + 'px';
              cellEl.style.background = COLORS[piece.idx % 7];
              well.appendChild(cellEl);
            }
          }
        }
      }
      box.appendChild(well);
      wrap.appendChild(box);
    });
    if (over){
      const ov = el('div','overlay');
      const card = el('div','overlay-card');
      card.appendChild(el('div','big','🏆'));
      card.appendChild(el('h3', null, '玩家' + (winner+1) + ' 获胜！'));
      card.appendChild(el('p', null, '得分 ' + Math.max(0, scores[winner])));
      const btn = el('button','btn btn-primary','再来一局');
      btn.addEventListener('click', reset);
      card.appendChild(btn);
      ov.appendChild(card);
      wrap.appendChild(ov);
    }
    area.appendChild(wrap);
    renderPlayers(cur, scores.map((s, i) => s < 0 ? '💀' : (s + ' 分')));
  }
  extra.innerHTML = '';
  if (!opts.online){
    const actions = el('div','tetris-actions');
    const placeBtn = el('button','btn btn-primary','🧱 放一个');
    placeBtn.addEventListener('click', () => {
      if (over) return;
      if (opts.ai && opts.ai.has(cur)) return;
      const idx = 0 | Math.floor(Math.random() * SHAPES.length);
      const best = aiBestPlacement(wells[cur], SHAPES[idx]);
      if (!best){ topOut(cur); return; }
      applyPlacement(cur, idx, best.x, best.y, best.sh);
    });
    actions.appendChild(placeBtn);
    extra.appendChild(actions);
  }
  opts.onMove = payload => {
    if (!payload) return;
    applyPlacement(cur, payload.piece, payload.x, payload.y, payload.sh);
  };
  function resetLocal(){
    wells = Array.from({length: n}, () => Array.from({length: ROWS}, () => Array(COLS).fill(0)));
    scores = Array(n).fill(0);
    cur = 0; over = false; winner = -1; piece = null; pieceCount = 0; aiPending = false;
    render();
    setStatus('玩家1 的回合，点「放一个」放置方块');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot: () => ({ wells: wells.map(w => w.map(r => r.slice())), scores: scores.slice(), cur, over, winner }) };
}
