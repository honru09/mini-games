/* ================= 坦克大战 ================= */
function gameTank(area, extra, n, opts){
  opts = opts || {};
  const W = 13, H = 13;
  const dirs = [[-1,0],[0,1],[1,0],[0,-1]]; // 上右下左
  const DIR_KEYS = ['⬆','➡','⬇','⬅'];
  const BASE0 = [1,1], BASE1 = [11,11], T0 = [2,1], T1 = [10,11];
  let grid = Array.from({length:H}, () => Array(W).fill(0));
  let t0 = { r:T0[0], c:T0[1], d:1, lives:3 };
  let t1 = { r:T1[0], c:T1[1], d:3, lives:3 };
  let cur = 0, over = false, winner = -1;
  let aiPending = false;
  function isWall(r,c){ return grid[r] && grid[r][c] === 2; }
  function isSteel(r,c){ return grid[r] && grid[r][c] === 3; }
  function occupied(r,c){
    if (r === t0.r && c === t0.c) return 0;
    if (r === t1.r && c === t1.c) return 1;
    return -1;
  }
  function scheduleAI(){
    if (aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    setTimeout(async () => {
      aiPending = false;
      if (over) return;
      const me = cur === 0 ? t0 : t1;
      const foe = cur === 0 ? t1 : t0;
      // 同排/同列且路径无障碍 → 射击
      if (me.r === foe.r || me.c === foe.c){
        const dr = Math.sign(foe.r - me.r), dc = Math.sign(foe.c - me.c);
        let rr = me.r + dr, cc = me.c + dc, blocked = false;
        while (rr >= 0 && rr < H && cc >= 0 && cc < W && !(rr === foe.r && cc === foe.c)){
          if (grid[rr][cc] !== 0){ blocked = true; break; }
          rr += dr; cc += dc;
        }
        if (!blocked){
          if (opts.online) opts.sendMove({ act: 'shoot' });
          shoot();
          return;
        }
      }
      // 朝对方靠近（贪心）
      const optsMoves = [];
      dirs.forEach((d, di) => {
        const nr = me.r + d[0], nc = me.c + d[1];
        if (nr < 0 || nr >= H || nc < 0 || nc >= W) return;
        if (grid[nr][nc] !== 0) return;
        if (occupied(nr, nc) >= 0) return;
        optsMoves.push(di);
      });
      if (!optsMoves.length){ if (opts.online) opts.sendMove({ act: 'shoot' }); shoot(); return; }
      let best = optsMoves[0], bestD = 1e9;
      optsMoves.forEach(di => {
        const d = dirs[di];
        const nd = Math.abs(me.r + d[0] - foe.r) + Math.abs(me.c + d[1] - foe.c);
        if (nd < bestD){ bestD = nd; best = di; }
      });
      if (opts.online) opts.sendMove({ act: 'move', d: best });
      moveTank(cur, best);
    }, 700);
  }
  function buildMap(){
    grid = Array.from({length:H}, () => Array(W).fill(0));
    for (let i = 0; i < W; i++){ grid[0][i] = 3; grid[H-1][i] = 3; }
    for (let i = 0; i < H; i++){ grid[i][0] = 3; grid[i][W-1] = 3; }
    const bricks = [[3,3],[3,4],[4,3],[8,8],[8,9],[9,8],[6,2],[6,10],[2,6],[10,6],[5,5],[5,6],[5,7],[7,5],[7,6],[7,7],[3,9],[9,3]];
    bricks.forEach(([r,c]) => { if (grid[r][c] === 0) grid[r][c] = 2; });
    grid[BASE0[0]][BASE0[1]] = 4;
    grid[BASE1[0]][BASE1[1]] = 4;
    grid[T0[0]][T0[1]] = 0;
    grid[T1[0]][T1[1]] = 0;
  }
  function moveTank(pi, d){
    const me = pi === 0 ? t0 : t1;
    me.d = d;
    const nr = me.r + dirs[d][0], nc = me.c + dirs[d][1];
    if (nr < 0 || nr >= H || nc < 0 || nc >= W) return;
    if (grid[nr][nc] !== 0) return;
    if (occupied(nr, nc) >= 0) return;
    me.r = nr; me.c = nc;
    endTurn();
  }
  function shoot(){
    const me = cur === 0 ? t0 : t1;
    const foe = cur === 0 ? t1 : t0;
    const d = dirs[me.d];
    let rr = me.r + d[0], cc = me.c + d[1];
    while (rr >= 0 && rr < H && cc >= 0 && cc < W){
      if (grid[rr][cc] === 3){ break; }
      if (grid[rr][cc] === 2){ grid[rr][cc] = 0; break; }
      if (grid[rr][cc] === 4){
        over = true; winner = cur;
        if (opts.onEnd) opts.onEnd([{ slot: cur, coins: 1, rank: 1 }, { slot: cur ^ 1, coins: 0, rank: 2 }]);
        render();
        return;
      }
      if (rr === foe.r && cc === foe.c){
        foe.lives--;
        if (foe.lives <= 0){
          over = true; winner = cur;
          if (opts.onEnd) opts.onEnd([{ slot: cur, coins: 1, rank: 1 }, { slot: cur ^ 1, coins: 0, rank: 2 }]);
        } else {
          if (cur === 0){ t1.r = T1[0]; t1.c = T1[1]; t1.d = 3; }
          else { t0.r = T0[0]; t0.c = T0[1]; t0.d = 1; }
          toast('💥 敌方坦克被击毁！');
        }
        render();
        endTurn();
        return;
      }
      rr += d[0]; cc += d[1];
    }
    render();
    endTurn();
  }
  function endTurn(){
    if (over) return;
    cur ^= 1;
    render();
    setStatus('轮到玩家' + (cur+1) + '，移动或开炮');
    scheduleAI();
  }
  function render(){
    const w = area.clientWidth || 520;
    const S = Math.min(w, 540);
    area.innerHTML = '';
    const board = el('div','tank-board');
    board.style.width = S + 'px'; board.style.height = S + 'px';
    const cs = S / W;
    for (let r = 0; r < H; r++){
      for (let c = 0; c < W; c++){
        const cell = el('div','tank-cell');
        cell.style.left = (c*cs) + 'px'; cell.style.top = (r*cs) + 'px';
        cell.style.width = cs + 'px'; cell.style.height = cs + 'px';
        if (grid[r][c] === 2) cell.classList.add('brick');
        else if (grid[r][c] === 3) cell.classList.add('steel');
        else if (grid[r][c] === 4) { cell.classList.add('base'); cell.textContent = '🏳️'; }
        board.appendChild(cell);
      }
    }
    const place = (t, cls, emoji) => {
      const tank = el('div','tank-cell ' + cls);
      tank.style.left = (t.c*cs) + 'px'; tank.style.top = (t.r*cs) + 'px';
      tank.style.width = cs + 'px'; tank.style.height = cs + 'px';
      tank.textContent = emoji;
      tank.style.transform = 'rotate(' + (t.d*90) + 'deg)';
      tank.appendChild(el('span','hp','♥'.repeat(Math.max(0,t.lives))));
      board.appendChild(tank);
    };
    place(t0, 'tank0', '🛡️');
    place(t1, 'tank1', '🛡️');
    if (over){
      const winnerName = '玩家' + (winner+1);
      showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: '坦克大战获胜', coins: 1, onRestart: resetLocal
      });
    }
    area.appendChild(board);
    renderPlayers(cur, [t0.lives + ' ❤', t1.lives + ' ❤']);
  }
  extra.innerHTML = '';
  const actions = el('div','tank-actions');
  if (!opts.online){
    DIR_KEYS.forEach((k, di) => {
      const b = el('button','btn',k);
      b.addEventListener('click', () => {
        if (over) return;
        if (opts.ai && opts.ai.has(cur)) return;
        if (opts.online) opts.sendMove({ act: 'move', d: di });
        moveTank(cur, di);
      });
      actions.appendChild(b);
    });
    const shootBtn = el('button','btn btn-primary','💥 开炮');
    shootBtn.addEventListener('click', () => {
      if (over) return;
      if (opts.ai && opts.ai.has(cur)) return;
      if (opts.online) opts.sendMove({ act: 'shoot' });
      shoot();
    });
    actions.appendChild(shootBtn);
  }
  extra.appendChild(actions);
  opts.onMove = payload => {
    if (!payload) return;
    if (payload.act === 'shoot') shoot();
    else if (payload.act === 'move') moveTank(cur, payload.d);
  };
  function resetLocal(){
    buildMap();
    t0 = { r:T0[0], c:T0[1], d:1, lives:3 };
    t1 = { r:T1[0], c:T1[1], d:3, lives:3 };
    cur = 0; over = false; winner = -1; aiPending = false;
    render();
    setStatus('玩家1 的回合，移动或开炮');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  resetLocal();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot: () => ({ t0: {...t0}, t1: {...t1}, cur, over, winner, grid: grid.map(r => r.slice()) }) };
}
