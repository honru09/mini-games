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
  let aiPending = false, aiEpoch = 0;
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
        if (v > bestV){ bestV = v; best = { x, y, sh, rot }; }
      }
    }
    return best;
  }
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    const gen = aiEpoch;
    const turn = cur;
    const count = pieceCount;
    setStatus('🤖 AI 思考中…');
    setTimeout(async () => {
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn || !opts.ai.has(cur)){
        aiPending = false;
        return;
      }
      const idx = 0 | Math.floor(Math.random() * SHAPES.length);
      const candidates = [];
      const seenShapes = new Set();
      for (let rot = 0; rot < 4; rot++){
        let sh = SHAPES[idx];
        for (let i = 0; i < rot; i++) sh = rotate(sh);
        const shapeKey = JSON.stringify(sh);
        if (seenShapes.has(shapeKey)) continue;
        seenShapes.add(shapeKey);
        for (let x = -3; x <= COLS; x++){
          let y = 0;
          while (!collide(wells[cur], sh, x, y + 1)) y++;
          if (collide(wells[cur], sh, x, y)) continue;
          candidates.push({ option: 'rot:' + rot + ',x:' + x + ',y:' + y, x, y, sh, rot,
            score: evaluatePlacement(wells[cur], sh, x, y) });
        }
      }
      if (!candidates.length){ aiPending = false; topOut(cur); return; }
      let bestIdx = 0;
      candidates.forEach((candidate, i) => { if (candidate.score > candidates[bestIdx].score) bestIdx = i; });
      const choices = candidates.map(candidate => candidate.option);
      const remoteChoice = await aiChoose('tetris', {
        well: wells[cur].map(row => row.join('')), score: scores[cur],
        piece: idx, turn: cur, pieceCount,
      }, choices, opts.aiPersona);
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn || pieceCount !== count){
        aiPending = false;
        return;
      }
      let chosenIdx = choices.indexOf(remoteChoice);
      if (chosenIdx < 0) chosenIdx = bestIdx;
      const chosen = candidates[chosenIdx];
      aiPending = false;
      aiSpeak(opts.aiPersona, 'think');
      applyPlacement(cur, idx, chosen.x, chosen.y, chosen.sh);
    }, 700);
  }
  function applyPlacement(pi, idx, x, y, sh){
    const res = lock(wells[pi], sh, x, y);
    playFeedback(res.cleared > 0 ? 'score' : 'place');
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
      if (pi === cur && (piece || humanSh)){
        for (let r = 0; r < (piece ? piece.sh : humanSh).length; r++){
          for (let c = 0; c < (piece ? piece.sh[r] : humanSh[r]).length; c++){
            if ((piece ? piece.sh[r][c] : humanSh[r][c])){
              const cellEl = el('div','tetris-cell');
              cellEl.style.left = (((piece ? piece.x : humanX)+c)*cell) + 'px'; cellEl.style.top = (((piece ? piece.y : humanY)+r)*cell) + 'px';
              cellEl.style.width = cell + 'px'; cellEl.style.height = cell + 'px';
              cellEl.style.background = COLORS[(piece ? piece.idx : humanIdx) % 7];
              well.appendChild(cellEl);
            }
          }
        }
      }
      box.appendChild(well);
      wrap.appendChild(box);
    });
    if (over){
      const winnerName = '玩家' + (winner+1);
      showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: '得分 ' + Math.max(0, scores[winner]), coins: 1, onRestart: resetLocal
      });
    }
    area.appendChild(wrap);
    renderPlayers(cur, scores.map((s, i) => s < 0 ? '💀' : (s + ' 分')));
  }
  extra.innerHTML = '';
  // Human player controls: keyboard + buttons
  let humanX = 0, humanY = 0, humanSh = null, humanIdx = 0, humanRot = 0;

  function canControl(){
    if (over || (opts.isReplaying && opts.isReplaying())) return false;
    if (opts.online && cur !== opts.myIdx) return false;
    if (opts.ai && opts.ai.has(cur)) return false;
    return true;
  }
  
  function spawnHumanPiece() {
    humanIdx = 0 | Math.floor(Math.random() * SHAPES.length);
    humanSh = SHAPES[humanIdx];
    humanRot = 0;
    humanX = Math.floor((COLS - humanSh[0].length) / 2);
    humanY = 0;
    if (collide(wells[cur], humanSh, humanX, humanY)) { topOut(cur); return false; }
    return true;
  }
  
  function moveHuman(dx) {
    if (!humanSh || over) return;
    if (!collide(wells[cur], humanSh, humanX + dx, humanY)) {
      humanX += dx;
      render();
    }
  }
  
  function rotateHuman() {
    if (!humanSh || over) return;
    const rotated = rotate(humanSh);
    if (!collide(wells[cur], rotated, humanX, humanY)) {
      humanSh = rotated;
      humanRot = (humanRot + 1) % 4;
      render();
    }
  }
  
  function dropHuman() {
    if (!humanSh || over) return;
    if (!collide(wells[cur], humanSh, humanX, humanY + 1)) {
      humanY++;
      render();
    } else {
      lockHuman();
    }
  }
  
  function hardDropHuman() {
    if (!humanSh || over) return;
    while (!collide(wells[cur], humanSh, humanX, humanY + 1)) humanY++;
    lockHuman();
  }
  
  function lockHuman() {
    if (!humanSh || over) return;
    if (opts.online) {
      opts.sendMove({ piece: humanIdx, x: humanX, y: humanY, rot: humanRot });
    }
    applyPlacement(cur, humanIdx, humanX, humanY, humanSh);
    humanSh = null;
  }
  
  function handleTetrisKey(e) {
    if (!canControl()) return;
    if (!humanSh && !spawnHumanPiece()) return;
    switch(e.key) {
      case 'ArrowLeft': e.preventDefault(); moveHuman(-1); break;
      case 'ArrowRight': e.preventDefault(); moveHuman(1); break;
      case 'ArrowDown': e.preventDefault(); dropHuman(); break;
      case 'ArrowUp': e.preventDefault(); rotateHuman(); break;
      case ' ': case 'Spacebar': e.preventDefault(); hardDropHuman(); break;
    }
  }
  
  // Listen for keys globally when this game is active
  if (document.addEventListener) document.addEventListener('keydown', handleTetrisKey);
  const actions = el('div','tetris-actions');
  const control = (label, fn) => {
    const b = el('button','btn',label);
    b.addEventListener('click', () => {
      if (!canControl()) return;
      if (!humanSh && !spawnHumanPiece()) return;
      fn();
    });
    actions.appendChild(b);
  };
  control('⬅', () => moveHuman(-1));
  control('➡', () => moveHuman(1));
  control('↻', rotateHuman);
  control('⬇', dropHuman);
  control('⤓', hardDropHuman);
  if (!opts.online){
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
  }
  extra.appendChild(actions);
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (!payload || over) return;
    const idx = Number(payload.piece), x = Number(payload.x), y = Number(payload.y), rot = Number(payload.rot || 0);
    if (![idx, x, y, rot].every(Number.isInteger) || idx < 0 || idx >= SHAPES.length || rot < 0 || rot > 3) return;
    let sh = SHAPES[idx];
    for (let i = 0; i < rot; i++) sh = rotate(sh);
    if (collide(wells[cur], sh, x, y) || !collide(wells[cur], sh, x, y + 1)) return;
    applyPlacement(cur, idx, x, y, sh);
  };
  function resetLocal(){
    aiEpoch++;
    wells = Array.from({length: n}, () => Array.from({length: ROWS}, () => Array(COLS).fill(0)));
    scores = Array(n).fill(0);
    cur = 0; over = false; winner = -1; piece = null; pieceCount = 0; aiPending = false;
    humanSh = null; humanRot = 0;
    render();
    setStatus('玩家1 的回合，点「放一个」放置方块');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, destroy: () => {
    aiEpoch++; aiPending = false;
    if (document.removeEventListener) document.removeEventListener('keydown', handleTetrisKey);
  }, snapshot: () => ({ wells: wells.map(w => w.map(r => r.slice())), scores: scores.slice(), cur, over, winner, pieceCount }) };
}
