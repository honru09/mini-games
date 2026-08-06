/* ================= 贪吃蛇 ================= */
function gameSnake(area, extra, n, opts){
  opts = opts || {};
  const W = 15, H = 15;
  const starts = [[1,1,1],[1,13,3],[13,13,3],[13,1,1]]; // r,c,d
  const dirs = [[-1,0],[0,1],[1,0],[0,-1]];
  let snakes = [];
  let food = [7,7];
  let cur = 0, over = false, winner = -1, aliveCount = 0;
  let aiPending = false;
  function scheduleAI(){
    if (aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    setStatus('🤖 AI 思考中…');
    setTimeout(async () => {
      aiPending = false;
      if (over) return;
      const s = snakes[cur];
      if (!s || !s.alive) return;
      const head = s.body[0];
      const legal = [];
      dirs.forEach((d, di) => {
        if ((di + 2) % 4 === s.d) return;
        const nr = head[0] + d[0], nc = head[1] + d[1];
        if (nr < 0 || nr >= H || nc < 0 || nc >= W) return;
        if (hitTest(nr, nc, cur, false)) return;
        legal.push(di);
      });
      if (!legal.length){ die(cur); return; }
      // 优先朝食物方向
      let best = legal[0], bestD = 1e9;
      legal.forEach(di => {
        const d = dirs[di];
        const nd = Math.abs(head[0]+d[0]-food[0]) + Math.abs(head[1]+d[1]-food[1]);
        if (nd < bestD){ bestD = nd; best = di; }
      });
      const snakePick = aiPersonaMove(legal.length, legal.indexOf(best), opts.aiPersona);
      aiSpeak(opts.aiPersona, 'think');
      step(cur, legal[snakePick], null);
    }, 650);
  }
  function hitTest(r, c, except, allowFood){
    if (r < 0 || r >= H || c < 0 || c >= W) return true;
    for (let i = 0; i < snakes.length; i++){
      const s = snakes[i];
      if (!s || !s.alive) continue;
      const body = allowFood && i === except ? s.body.slice(0, -1) : s.body;
      if (body.some(p => p[0] === r && p[1] === c)) return true;
    }
    return false;
  }
  function die(pi){
    snakes[pi].alive = false;
    aliveCount--;
    toast('💀 玩家' + (pi+1) + ' 的蛇撞了！');
    if (aliveCount <= 1){
      const alives = snakes.map((s, i) => s.alive ? i : -1).filter(i => i >= 0);
      if (alives.length === 1){
        over = true; winner = alives[0];
        if (opts.onEnd) opts.onEnd(snakes.map((s, i) => ({ slot: i, coins: i === winner ? 1 : 0, rank: i === winner ? 1 : 2 })));
      } else {
        over = true;
        let best = 0;
        snakes.forEach((s, i) => { if (s.score > snakes[best].score) best = i; });
        winner = best;
        if (opts.onEnd) opts.onEnd(snakes.map((s, i) => ({ slot: i, coins: i === winner ? 1 : 0, rank: i === winner ? 1 : 2 })));
      }
      render();
      return;
    }
    render();
    endTurn();
  }
  function step(pi, d, newFood){
    sfx('move');
    const s = snakes[pi];
    s.d = d;
    const head = s.body[0];
    const nr = head[0] + dirs[d][0], nc = head[1] + dirs[d][1];
    if (nr < 0 || nr >= H || nc < 0 || nc >= W){ die(pi); return; }
    if (hitTest(nr, nc, pi, false)){ die(pi); return; }
    s.body.unshift([nr, nc]);
    if (nr === food[0] && nc === food[1]){
      s.score++;
      if (newFood) food = newFood;
      else food = [1 + Math.floor(Math.random()*(H-2)), 1 + Math.floor(Math.random()*(W-2))];
      toast('🍎 玩家' + (pi+1) + ' 吃豆 +1！');
    } else {
      s.body.pop();
    }
    if (s.score >= 10){
      over = true; winner = pi;
      if (opts.onEnd) opts.onEnd(snakes.map((s2, i) => ({ slot: i, coins: i === pi ? 1 : 0, rank: i === pi ? 1 : 2 })));
      render();
      return;
    }
    render();
    endTurn();
  }
  function endTurn(){
    if (over) return;
    do { cur = (cur + 1) % snakes.length; } while (snakes[cur] && !snakes[cur].alive);
    render();
    setStatus('轮到玩家' + (cur+1) + '，选择方向');
    scheduleAI();
  }
  function render(){
    const w = area.clientWidth || 520;
    const S = Math.min(w, 540);
    area.innerHTML = '';
    const board = el('div','snake-board');
    board.style.width = S + 'px'; board.style.height = S + 'px';
    const cs = S / W;
    for (let r = 0; r < H; r++){
      for (let c = 0; c < W; c++){
        const cell = el('div','snake-cell');
        cell.style.left = (c*cs) + 'px'; cell.style.top = (r*cs) + 'px';
        cell.style.width = cs + 'px'; cell.style.height = cs + 'px';
        if (r % 2 === c % 2) cell.style.background = 'rgba(128,150,190,.06)';
        board.appendChild(cell);
      }
    }
    const foodEl = el('div','snake-cell');
    foodEl.style.left = (food[1]*cs) + 'px'; foodEl.style.top = (food[0]*cs) + 'px';
    foodEl.style.width = cs + 'px'; foodEl.style.height = cs + 'px';
    foodEl.style.background = '#e5484d'; foodEl.style.borderRadius = '50%';
    board.appendChild(foodEl);
    snakes.forEach((s, pi) => {
      if (!s || !s.alive) return;
      s.body.forEach((p, i) => {
        const seg = el('div','snake-cell' + (i === 0 ? ' head' + pi : ''));
        seg.style.left = (p[1]*cs) + 'px'; seg.style.top = (p[0]*cs) + 'px';
        seg.style.width = cs + 'px'; seg.style.height = cs + 'px';
        seg.style.background = PLAYER_COLORS[pi];
        if (i === 0) seg.style.boxShadow = '0 0 8px ' + PLAYER_COLORS[pi];
        board.appendChild(seg);
      });
    });
    if (over){
      const winnerName = '玩家' + (winner+1);
      showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: '得分 ' + snakes[winner].score, coins: 1, onRestart: resetLocal
      });
    }
    area.appendChild(board);
    renderPlayers(cur, snakes.map((s, i) => s.alive ? ('🍎 ' + s.score) : '💀 出局'));
  }
  extra.innerHTML = '';
  const actions = el('div','snake-actions');
  ['⬆','➡','⬇','⬅'].forEach((k, di) => {
    const b = el('button','btn',k);
    b.addEventListener('click', () => {
      if (over) return;
      if (opts.ai && opts.ai.has(cur)) return;
      const s = snakes[cur];
      if (!s || !s.alive) return;
      if ((di + 2) % 4 === s.d) return;
      if (opts.online){
        const nr = s.body[0][0] + dirs[di][0], nc = s.body[0][1] + dirs[di][1];
        const eat = nr === food[0] && nc === food[1];
        const nf = eat ? [1 + Math.floor(Math.random()*(H-2)), 1 + Math.floor(Math.random()*(W-2))] : null;
        opts.sendMove({ d: di, food: nf });
      }
      step(cur, di, null);
    });
    actions.appendChild(b);
  });
  extra.appendChild(actions);
  opts.onMove = payload => {
    if (!payload) return;
    if (payload.food) food = payload.food;
    step(cur, payload.d, payload.food || null);
  };
  function resetLocal(){
    snakes = starts.slice(0, n).map(([r, c, d]) => ({ body: [[r,c],[r - dirs[d][0], c - dirs[d][1]]], d, score: 0, alive: true }));
    food = [7,7];
    cur = 0; over = false; winner = -1; aliveCount = n; aiPending = false;
    render();
    setStatus('玩家1 的回合，选择方向');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot: () => ({ snakes: snakes.map(s => ({ body: s.body.map(b => b.slice()), d: s.d, score: s.score, alive: s.alive })), food: food.slice(), cur, over, winner }) };
}
