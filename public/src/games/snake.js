/* ================= 贪吃蛇 ================= */
function gameSnake(area, extra, n, opts){
  opts = opts || {};
  const W = 15, H = 15;
  const starts = [[1,1,1],[1,13,3],[13,13,3],[13,1,1]]; // r,c,d
  const dirs = [[-1,0],[0,1],[1,0],[0,-1]];
  let snakes = [];
  let food = [7,7];
  let cur = 0, over = false, winner = -1, aliveCount = 0;
  let aiPending = false, aiEpoch = 0;
  function isValidFood(pos){
    return Array.isArray(pos) && pos.length === 2 && pos.every(Number.isInteger) &&
      pos[0] >= 1 && pos[0] < H - 1 && pos[1] >= 1 && pos[1] < W - 1 &&
      !snakes.some(s => s && s.alive && s.body.some(p => p[0] === pos[0] && p[1] === pos[1]));
  }
  function randomFood(){
    const free = [];
    for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++){
      if (isValidFood([r, c]) && !(r === food[0] && c === food[1])) free.push([r, c]);
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : food.slice();
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
      const s = snakes[cur];
      if (!s || !s.alive){ aiPending = false; return; }
      const head = s.body[0];
      const legal = [];
      dirs.forEach((d, di) => {
        if ((di + 2) % 4 === s.d) return;
        const nr = head[0] + d[0], nc = head[1] + d[1];
        if (nr < 0 || nr >= H || nc < 0 || nc >= W) return;
        if (hitTest(nr, nc, cur, false)) return;
        legal.push(di);
      });
      if (!legal.length){ aiPending = false; die(cur); return; }
      // 优先朝食物方向
      let best = legal[0], bestD = 1e9;
      legal.forEach(di => {
        const d = dirs[di];
        const nd = Math.abs(head[0]+d[0]-food[0]) + Math.abs(head[1]+d[1]-food[1]);
        if (nd < bestD){ bestD = nd; best = di; }
      });
      const choices = legal.map(di => 'dir:' + di);
      const remoteChoice = await aiChoose('snake', {
        snakes: snakes.map(item => ({ body: item.body, direction: item.d, score: item.score, alive: item.alive })),
        food: food.slice(), turn: cur,
      }, choices, opts.aiPersona);
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn){
        aiPending = false;
        return;
      }
      let snakePick = choices.indexOf(remoteChoice);
      if (snakePick < 0) snakePick = aiPersonaMove(legal.length, legal.indexOf(best), opts.aiPersona);
      aiPending = false;
      aiSpeak(opts.aiPersona, 'think');
      const di = legal[snakePick];
      const nr = head[0] + dirs[di][0], nc = head[1] + dirs[di][1];
      const nf = nr === food[0] && nc === food[1] ? randomFood() : null;
      if (opts.online) opts.sendMove({ d: di, food: nf });
      step(cur, di, nf);
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
      if (newFood) food = newFood.slice();
      else food = randomFood();
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
      if (opts.isReplaying && opts.isReplaying()) return;
      if (opts.online && cur !== opts.myIdx) return;
      if (opts.ai && opts.ai.has(cur)) return;
      const s = snakes[cur];
      if (!s || !s.alive) return;
      if ((di + 2) % 4 === s.d) return;
      if (opts.online){
        const nr = s.body[0][0] + dirs[di][0], nc = s.body[0][1] + dirs[di][1];
        const eat = nr === food[0] && nc === food[1];
        const nf = eat ? randomFood() : null;
        opts.sendMove({ d: di, food: nf });
        step(cur, di, nf);
        return;
      }
      step(cur, di, null);
    });
    actions.appendChild(b);
  });
  extra.appendChild(actions);
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (!payload) return;
    const d = Number(payload.d);
    if (!Number.isInteger(d) || d < 0 || d >= dirs.length) return;
    const s = snakes[cur];
    if (!s || !s.alive || (d + 2) % 4 === s.d) return;
    const nr = s.body[0][0] + dirs[d][0], nc = s.body[0][1] + dirs[d][1];
    const willEat = nr === food[0] && nc === food[1];
    const nextFood = Array.isArray(payload.food) ? payload.food.slice(0, 2) : null;
    if (willEat ? !isValidFood(nextFood) : nextFood !== null) return;
    step(cur, d, nextFood);
  };
  function resetLocal(){
    aiEpoch++;
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
