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
  let aiPending = false, aiEpoch = 0;
  function isWall(r,c){ return grid[r] && grid[r][c] === 2; }
  function isSteel(r,c){ return grid[r] && grid[r][c] === 3; }
  function occupied(r,c){
    if (r === t0.r && c === t0.c) return 0;
    if (r === t1.r && c === t1.c) return 1;
    return -1;
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
      const me = cur === 0 ? t0 : t1;
      const foe = cur === 0 ? t1 : t0;
      const actions = [{ option: 'shoot', act: 'shoot', score: 0 }];
      const shotDir = dirs[me.d];
      let rr = me.r + shotDir[0], cc = me.c + shotDir[1];
      while (rr >= 0 && rr < H && cc >= 0 && cc < W){
        if (rr === foe.r && cc === foe.c){ actions[0].score = 1000; break; }
        if (grid[rr][cc] === 3) break;
        if (grid[rr][cc] === 2){ actions[0].score = 35; break; }
        if (grid[rr][cc] === 4){
          const enemyBase = cur === 0 ? BASE1 : BASE0;
          if (rr === enemyBase[0] && cc === enemyBase[1]) actions[0].score = 900;
          break;
        }
        rr += shotDir[0]; cc += shotDir[1];
      }
      dirs.forEach((d, di) => {
        const nr = me.r + d[0], nc = me.c + d[1];
        if (nr < 0 || nr >= H || nc < 0 || nc >= W) return;
        if (grid[nr][nc] !== 0) return;
        if (occupied(nr, nc) >= 0) return;
        const distance = Math.abs(nr - foe.r) + Math.abs(nc - foe.c);
        actions.push({ option: 'move:' + di, act: 'move', d: di, score: 100 - distance * 4 });
      });
      let bestIdx = 0;
      actions.forEach((action, i) => { if (action.score > actions[bestIdx].score) bestIdx = i; });
      const choices = actions.map(action => action.option);
      const remoteChoice = await aiChoose('tank', {
        grid: grid.map(row => row.join('')),
        tanks: [{...t0}, {...t1}], turn: cur,
      }, choices, opts.aiPersona);
      if (opts.destroyed || over || gen !== aiEpoch || cur !== turn){
        aiPending = false;
        return;
      }
      let tankPick = choices.indexOf(remoteChoice);
      if (tankPick < 0) tankPick = aiPersonaMove(actions.length, bestIdx, opts.aiPersona);
      const action = actions[tankPick];
      aiPending = false;
      aiSpeak(opts.aiPersona, 'think');
      if (action.act === 'shoot') shoot();
      else moveTank(cur, action.d);
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
    if (over || pi !== cur || !Number.isInteger(d) || d < 0 || d >= dirs.length) return false;
    sfx('move');
    const me = pi === 0 ? t0 : t1;
    const nr = me.r + dirs[d][0], nc = me.c + dirs[d][1];
    if (nr < 0 || nr >= H || nc < 0 || nc >= W) return false;
    if (grid[nr][nc] !== 0) return false;
    if (occupied(nr, nc) >= 0) return false;
    me.d = d;
    me.r = nr; me.c = nc;
    endTurn();
    return true;
  }
  function shoot(){
    if (over) return false;
    playFeedback('capture');
    const me = cur === 0 ? t0 : t1;
    const foe = cur === 0 ? t1 : t0;
    const d = dirs[me.d];
    let rr = me.r + d[0], cc = me.c + d[1];
    while (rr >= 0 && rr < H && cc >= 0 && cc < W){
      if (grid[rr][cc] === 3){ break; }
      if (grid[rr][cc] === 2){ grid[rr][cc] = 0; break; }
      if (grid[rr][cc] === 4){
        const enemyBase = cur === 0 ? BASE1 : BASE0;
        if (rr !== enemyBase[0] || cc !== enemyBase[1]) break;
        over = true; winner = cur;
        if (opts.onEnd) opts.onEnd([{ slot: cur, coins: 1, rank: 1 }, { slot: cur ^ 1, coins: 0, rank: 2 }]);
        render();
        return true;
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
        return true;
      }
      rr += d[0]; cc += d[1];
    }
    render();
    endTurn();
    return true;
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
  DIR_KEYS.forEach((k, di) => {
    const b = el('button','btn',k);
    b.addEventListener('click', () => {
      if (over || (opts.isReplaying && opts.isReplaying())) return;
      if (opts.online && cur !== opts.myIdx) return;
      if (opts.ai && opts.ai.has(cur)) return;
      const me = cur === 0 ? t0 : t1;
      const nr = me.r + dirs[di][0], nc = me.c + dirs[di][1];
      if (nr < 0 || nr >= H || nc < 0 || nc >= W || grid[nr][nc] !== 0 || occupied(nr, nc) >= 0) return;
      if (opts.online) opts.sendMove({ act: 'move', d: di });
      moveTank(cur, di);
    });
    actions.appendChild(b);
  });
  const shootBtn = el('button','btn btn-primary','💥 开炮');
  shootBtn.addEventListener('click', () => {
    if (over || (opts.isReplaying && opts.isReplaying())) return;
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    if (opts.online) opts.sendMove({ act: 'shoot' });
    shoot();
  });
  actions.appendChild(shootBtn);
  extra.appendChild(actions);
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (!payload || over) return;
    if (payload.act === 'shoot') shoot();
    else if (payload.act === 'move'){
      const d = Number(payload.d);
      if (!Number.isInteger(d) || d < 0 || d >= dirs.length) return;
      moveTank(cur, d);
    }
  };
  function resetLocal(){
    aiEpoch++;
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
