/* ================= 飞行棋 ================= */
function gameLudo(area, extra, n, opts){
  opts = opts || {};
  const TRACK = 52, HOME = 56;
  const pids = n === 2 ? [0,2] : (n === 3 ? [0,1,2] : [0,1,2,3]);
  const START = [0,13,26,39];
  const color = pid => PLAYER_COLORS[pid];
  let tokens = pids.map(() => Array(4).fill(-1));
  let curIdx = 0, phase = 'roll', dice = 0, over = false, winner = -1;
  let S = 520;
  const board = el('div','ludo-board');
  area.appendChild(board);
  const diceBtn = el('button','dice-btn');
  const dice3d = makeDice3D(58);
  diceBtn.appendChild(dice3d.wrap);
  diceBtn.addEventListener('click', roll);
  extra.appendChild(diceBtn);
  let aiPending = false;
  function scheduleAI(){
    if (aiPending || over) return;
    if (!opts.ai || !opts.ai.has(curIdx)) return;
    aiPending = true;
    setTimeout(async () => {
      aiPending = false;
      if (over) return;
      if (phase === 'roll'){ roll(); return; }
      if (phase === 'pick'){
        const mv = movable();
        if (!mv.length){ nextTurn('无子可动'); return; }
        // 启发式：优先击落/回家，其次推进
        let bestT = mv[0], bestS = -1e9;
        mv.forEach(ti => {
          const arr = tokens[curIdx];
          const curPos = arr[ti];
          const newPos = curPos === -1 ? 0 : Math.min(HOME, curPos + dice);
          let s = curPos === -1 ? 6 : (newPos === HOME ? 120 : newPos);
          if (newPos <= 50){
            const cell = cellOf(curPid(), newPos);
            let hit = 0;
            pids.forEach((p2, p2i) => {
              if (p2 === curPid()) return;
              for (let j = 0; j < 4; j++){
                const t2 = tokens[p2i][j];
                if (t2 >= 0 && t2 <= 50 && cellOf(p2, t2) === cell) hit++;
              }
            });
            s += hit * 45;
          }
          if (s > bestS){ bestS = s; bestT = ti; }
        });
        pick(curPid(), bestT);
      }
    }, 700);
  }

  function curPid(){ return pids[curIdx]; }
  function canMove(t){ if (t === -1) return dice === 6; if (t >= HOME) return false; return t + dice <= HOME; }
  function movable(){
    const arr = [];
    for (let i=0;i<4;i++) if (canMove(tokens[curIdx][i])) arr.push(i);
    return arr;
  }
  function cellOf(pid, t){ return (START[pid] + t) % TRACK; }
  function geometry(){
    const c = S/2, R = S*0.40;
    const ang = i => (-90 + i * 360/TRACK) * Math.PI/180;
    const tpos = i => [c + R*Math.cos(ang(i)), c + R*Math.sin(ang(i))];
    const colPos = (pid, k) => {
      const [ex,ey] = tpos((START[pid] - 1 + TRACK) % TRACK);
      const t = (k+1)/5;
      return [c + (ex-c)*(1-t), c + (ey-c)*(1-t)];
    };
    const basePos = pid => {
      const m = S*0.035, b = S*0.19;
      const corners = [[m,m],[S-m-b,m],[S-m-b,S-m-b],[m,S-m-b]];
      return corners[pid];
    };
    return { c, tpos, colPos, basePos };
  }
  function renderBoard(){
    const w = area.clientWidth || 520;
    S = Math.min(w, 540);
    board.style.width = S + 'px'; board.style.height = S + 'px';
    board.innerHTML = '';
    const g = geometry();
    const cellSize = Math.max(20, Math.min(30, S*0.056));
    const tokSize = cellSize * 0.52;
    // 轨道格
    for (let i=0;i<TRACK;i++){
      const [x,y] = g.tpos(i);
      const cell = el('div','tcell' + (START.includes(i) ? ' start' : ''));
      cell.style.left = x + 'px'; cell.style.top = y + 'px';
      cell.style.width = cell.style.height = cellSize + 'px';
      cell.style.marginLeft = cell.style.marginTop = (-cellSize/2) + 'px';
      if (START.includes(i)){
        const pid = START.indexOf(i);
        cell.style.borderColor = color(pid);
      }
      cell.dataset.cell = i;
      board.appendChild(cell);
    }
    // 终点航线和中心
    const colSizes = [cellSize*0.85, cellSize*0.85, cellSize*0.85, cellSize*0.85, S*0.13];
    for (const pid of pids){
      for (let k=0;k<4;k++){
        const [x,y] = g.colPos(pid,k);
        const h = el('div','hcell');
        h.style.left = x + 'px'; h.style.top = y + 'px';
        h.style.width = h.style.height = colSizes[k] + 'px';
        h.style.marginLeft = h.style.marginTop = (-colSizes[k]/2) + 'px';
        h.style.borderColor = color(pid);
        board.appendChild(h);
      }
    }
    const center = el('div','ludo-center');
    const cs = S*0.13;
    center.style.left = center.style.top = (S/2) + 'px';
    center.style.width = center.style.height = cs + 'px';
    center.style.marginLeft = center.style.marginTop = (-cs/2) + 'px';
    center.textContent = '🏁';
    board.appendChild(center);
    // 基地
    for (const pid of pids){
      const [bx,by] = g.basePos(pid);
      const base = el('div','ludo-base');
      const b = S*0.19;
      base.style.left = bx + 'px'; base.style.top = by + 'px';
      base.style.width = base.style.height = b + 'px';
      base.style.borderColor = color(pid);
      base.style.background = PLAYER_BG[pid];
      for (let j=0;j<4;j++) base.appendChild(el('div','slot'));
      board.appendChild(base);
    }
    // 棋子
    const slots = [[0.28,0.28],[0.72,0.28],[0.28,0.72],[0.72,0.72]];
    const place = (parent, x, y, pid, ti) => {
      const tok = el('div','tok');
      tok.style.width = tok.style.height = tokSize + 'px';
      tok.style.background = color(pid);
      tok.style.left = x + 'px'; tok.style.top = y + 'px';
      tok.dataset.pid = pid; tok.dataset.ti = ti;
      if (phase === 'pick' && pid === curPid() && canMove(tokens[pids.indexOf(pid)][ti])){
        tok.classList.add('movable');
      }
      tok.addEventListener('click', () => pick(pid, ti));
      parent.appendChild(tok);
    };
    // 收集每个格子的棋子
    const trackMap = new Map(), colMap = new Map(), baseMap = new Map();
    pids.forEach((pid, pi) => {
      tokens[pi].forEach((t, ti) => {
        if (t === -1){
          const k = pid;
          if (!baseMap.has(k)) baseMap.set(k, []);
          baseMap.get(k).push([pid,ti]);
        } else if (t <= 50){
          const c = cellOf(pid,t);
          if (!trackMap.has(c)) trackMap.set(c, []);
          trackMap.get(c).push([pid,ti]);
        } else if (t < HOME){
          const k = pid + '-' + (t-51);
          if (!colMap.has(k)) colMap.set(k, []);
          colMap.get(k).push([pid,ti]);
        }
      });
    });
    for (const [c, list] of trackMap){
      const cell = board.querySelector('[data-cell="' + c + '"]');
      if (!cell) continue;
      list.slice(0,4).forEach(([pid,ti], j) => {
        const [sx,sy] = slots[j];
        place(cell, cellSize*sx, cellSize*sy, pid, ti);
      });
    }
    for (const [k, list] of colMap){
      const [pid, kk] = k.split('-').map(Number);
      const [x,y] = g.colPos(pid,kk);
      const host = el('div');
      host.style.left = x + 'px'; host.style.top = y + 'px';
      host.style.position = 'absolute';
      host.style.width = host.style.height = colSizes[kk] + 'px';
      list.slice(0,4).forEach(([pid2,ti], j) => {
        const [sx,sy] = slots[j];
        place(host, colSizes[kk]*sx, colSizes[kk]*sy, pid2, ti);
      });
      board.appendChild(host);
    }
    for (const [pid, list] of baseMap){
      const base = board.querySelectorAll('.ludo-base')[pids.indexOf(pid)];
      const slotsEls = base.querySelectorAll('.slot');
      list.slice(0,4).forEach(([pid2,ti], j) => {
        const s = slotsEls[j];
        place(s, '50%', '50%', pid2, ti);
      });
    }
    // 结束覆盖层
    if (over){
      const ov = el('div','overlay');
      const card = el('div','overlay-card');
      card.appendChild(el('div','big','🏆'));
      card.appendChild(el('h3', null, '玩家' + (pids.indexOf(winner)+1) + ' 获胜！'));
      card.appendChild(el('p', null, '四架飞机全部归位'));
      const btn = el('button','btn btn-primary','再来一局');
      btn.addEventListener('click', reset);
      card.appendChild(btn);
      ov.appendChild(card);
      board.appendChild(ov);
    }
    const infos = pids.map(pid => {
      const pi = pids.indexOf(pid);
      const cnt = tokens[pi].filter(t => t === HOME).length;
      return '归位 ' + cnt + '/4';
    });
    diceBtn.disabled = over || phase !== 'roll' || (opts.online && curIdx !== opts.myIdx) || (opts.ai && opts.ai.has(curIdx));
    renderPlayers(curIdx, infos, null, pids.map(pid => PLAYER_COLORS[pid]));
  }
  function roll(){
    if (over || phase !== 'roll') return;
    if (opts.online && curIdx !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(curIdx)) return;
    const d = 1 + Math.floor(Math.random()*6);
    if (opts.online) opts.sendMove({ dice: d });
    applyDice(d);
  }
  function applyDice(d){
    dice = d;
    diceBtn.disabled = true;
    setStatus('玩家' + (curIdx+1) + ' 掷骰子…');
    dice3d.roll(dice, () => {
      const mv = movable();
      if (!mv.length){
        nextTurn('玩家' + (curIdx+1) + ' 掷出 ' + dice + '，无子可动');
        return;
      }
      phase = 'pick';
      renderBoard();
      setStatus('玩家' + (curIdx+1) + ' 掷出 ' + dice + '，点击高亮棋子移动');
      scheduleAI();
    });
  }
  function pick(pid, ti){
    if (over || phase !== 'pick' || pid !== curPid()) return;
    if (opts.online && curIdx !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(curIdx)) return;
    const pi = pids.indexOf(pid);
    const arr = tokens[pi];
    if (!canMove(arr[ti])) return;
    if (opts.online) opts.sendMove({ ti });
    applyPick(pid, ti);
  }
  function applyPick(pid, ti){
    const pi = pids.indexOf(pid);
    const arr = tokens[pi];
    arr[ti] = arr[ti] === -1 ? 0 : arr[ti] + dice;
    if (arr[ti] <= 50){
      const cell = cellOf(pid, arr[ti]);
      let captured = 0;
      pids.forEach((p2, p2i) => {
        if (p2 === pid) return;
        for (let j=0;j<4;j++){
          const t2 = tokens[p2i][j];
          if (t2 >= 0 && t2 <= 50 && cellOf(p2,t2) === cell){
            tokens[p2i][j] = -1; captured++;
          }
        }
      });
      if (captured) toast('💥 击落对方 ' + captured + ' 个棋子！');
    }
    if (arr.every(v => v === HOME)){
      over = true; winner = pid;
      if (opts.onEnd) opts.onEnd(pids.map((p2, i) => ({
        slot: i,
        coins: i === curIdx ? 1 : 0,
        rank: i === curIdx ? 1 : 2,
      })));
      renderBoard();
      setStatus('🏆 玩家' + (curIdx+1) + ' 获胜！', true);
      return;
    }
    if (dice === 6){
      phase = 'roll';
      diceBtn.disabled = false;
      renderBoard();
      setStatus('玩家' + (curIdx+1) + ' 掷出 6，再掷一次！');
      scheduleAI();
    } else {
      nextTurn('玩家' + (curIdx+1) + ' 完成移动');
    }
  }
  function nextTurn(msg){
    phase = 'roll';
    curIdx = (curIdx + 1) % pids.length;
    diceBtn.disabled = false;
    renderBoard();
    setStatus((msg ? msg + '，' : '') + '轮到玩家' + (curIdx+1) + '，请掷骰子');
    scheduleAI();
  }
  opts.onMove = payload => {
    if (payload && payload.dice !== undefined) applyDice(payload.dice);
    else if (payload && payload.ti !== undefined) applyPick(curPid(), payload.ti);
  };
  function resetLocal(){
    tokens = pids.map(() => Array(4).fill(-1));
    curIdx = 0; phase = 'roll'; dice = 0; over = false; winner = -1; aiPending = false;
    diceBtn.disabled = false;
    dice3d.reset();
    renderBoard();
    setStatus('玩家1 的回合，请掷骰子');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  renderBoard();
  setStatus('玩家1 的回合，请掷骰子');
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot: () => ({ tokens: tokens.map(t => t.slice()), curIdx, phase, dice, over, winner }) };
}
