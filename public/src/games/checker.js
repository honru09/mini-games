/* ================= 弹珠跳棋 ================= */
function makeCheckerBoard(){
  const key = h => h.q + ',' + h.r;
  const hex = [];
  for (let q=-4;q<=4;q++) for (let r=-4;r<=4;r++) if (Math.abs(q+r) <= 4) hex.push({q,r});
  const base = [];
  for (let k=1;k<=4;k++) for (let j=0;j<=4-k;j++) base.push({q:4+k, r:-4+j});
  const rots = [
    (q,r) => [q,r],
    (q,r) => [-r,q+r],
    (q,r) => [-q-r,q],
    (q,r) => [-q,-r],
    (q,r) => [r,-q-r],
    (q,r) => [q+r,-q],
  ];
  const arms = rots.map(R => base.map(p => { const [q,r] = R(p.q,p.r); return {q,r}; }));
  const holes = hex.slice();
  const seen = new Set(hex.map(key));
  for (const arm of arms) for (const h of arm){
    const k = key(h);
    if (!seen.has(k)){ seen.add(k); holes.push(h); }
  }
  return { holes, arms, key };
}
function checkerReachable(holeSet, occupied, hole){
  const key = holeSet.key;
  const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  const res = new Set();
  for (const [dq,dr] of DIRS){
    const q = hole.q+dq, r = hole.r+dr;
    if (holeSet.set.has(key({q,r})) && !occupied.has(key({q,r}))) res.add(key({q,r}));
  }
  const seen = new Set([key(hole)]);
  const queue = [hole];
  while (queue.length){
    const cur = queue.shift();
    for (const [dq,dr] of DIRS){
      const mq = cur.q+dq, mr = cur.r+dr;
      if (!holeSet.set.has(key({q:mq,r:mr})) || !occupied.has(key({q:mq,r:mr}))) continue;
      const nq = mq+dq, nr = mr+dr;
      const nk = key({q:nq,r:nr});
      if (!holeSet.set.has(key({q:nq,r:nr})) || occupied.has(nk) || seen.has(nk)) continue;
      seen.add(nk); res.add(nk); queue.push({q:nq,r:nr});
    }
  }
  return res;
}
function gameChecker(area, extra, n, opts){
  opts = opts || {};
  const boardData = makeCheckerBoard();
  const { holes, arms, key } = boardData;
  const holeSet = { set: new Set(holes.map(key)), key };
  const cornerSel = n === 2 ? [0,3] : n === 3 ? [0,2,4] : n === 4 ? [0,2,3,5] : [0,1,2,3,4];
  const targetKey = c => arms[(c+3)%6].map(key);
  let marbles = [], cur = 0, over = false, winner = -1, selected = null, dests = null, history = [];
  let aiPending = false;
  function scheduleAI(){
    if (aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    setTimeout(async () => {
      aiPending = false;
      if (over) return;
      const occ = occupiedMap();
      const list = [];
      marbles[cur].forEach(m => {
        const d = checkerReachable(holeSet, occ, m);
        for (const dk of d){
          const [q, r] = dk.split(',').map(Number);
          const isJump = Math.abs(q - m.q) + Math.abs(r - m.r) > 1;
          list.push({ from: m, to: {q, r}, isJump });
        }
      });
      if (!list.length){ toast('AI 无子可动'); return; }
      // 启发式：优先跳吃，其次向对角营地推进
      const target = arms[(cornerSel[cur] + 3) % 6].map(key);
      const tSet = new Set(target);
      let best = list[0], bestS = -1e9;
      list.forEach(mv => {
        let s = mv.isJump ? 12 : 0;
        s += tSet.has(key(mv.to)) ? 6 : 0;
        s -= Math.abs(mv.to.q - mv.from.q) + Math.abs(mv.to.r - mv.from.r);
        if (s > bestS){ bestS = s; best = mv; }
      });
      applyCheckerMove(best.from, best.to);
    }, 700);
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  const dpr = window.devicePixelRatio || 1;
  const W = 560, H = 600;
  canvas.width = W*dpr; canvas.height = H*dpr;
  area.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!opts.online){
    const undoBtn = el('button','btn','↩ 悔棋');
    undoBtn.addEventListener('click', () => {
      if (over || !history.length) return;
      const h = history.pop();
      marbles[h.pi][h.mi] = h.from;
      cur = h.pi;
      selected = null; dests = null;
      const ov = area.querySelector('.overlay'); if (ov) ov.remove();
      draw();
      renderPlayers(cur, progressInfos());
      setStatus('已悔棋，轮到玩家' + (cur+1) + '，点击自己的棋子');
    });
    extra.appendChild(undoBtn);
    const hintBtn = el('button','btn','💡 提示');
    hintBtn.addEventListener('click', () => {
      if (over) return;
      const occ = occupiedMap();
      for (let mi = 0; mi < marbles[cur].length; mi++){
        const d = checkerReachable(holeSet, occ, marbles[cur][mi]);
        if (d.size){
          selected = marbles[cur][mi]; dests = d;
          draw();
          setStatus('玩家' + (cur+1) + ' 的可移动弹珠已高亮');
          return;
        }
      }
      toast('当前无子可动');
    });
    extra.appendChild(hintBtn);
  }
  function occupiedMap(){
    const m = new Map();
    marbles.forEach((list, pi) => list.forEach((h, mi) => m.set(key(h), {pi, mi})));
    return m;
  }
  function computeLayout(){
    const spacing = 34;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const h of holes){
      const x = h.q + h.r/2, y = h.r * 0.866;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const scale = Math.min((W-70)/Math.max(1,maxX-minX), (H-70)/Math.max(1,maxY-minY));
    const ox = (W - (maxX+minX)*scale)/2, oy = (H - (maxY+minY)*scale)/2;
    return { scale, ox, oy };
  }
  function draw(){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    const L = computeLayout();
    const rHole = Math.max(6, 0.42*L.scale);
    const rMarble = Math.max(5, 0.36*L.scale);
    const toXY = h => [L.ox + (h.q + h.r/2)*L.scale, L.oy + h.r*0.866*L.scale];
    // 洞
    for (const h of holes){
      const [x,y] = toXY(h);
      ctx.beginPath(); ctx.arc(x,y,rHole,0,Math.PI*2);
      ctx.fillStyle = '#eef1f6'; ctx.fill();
      ctx.strokeStyle = '#c6cfdd'; ctx.lineWidth = 1; ctx.stroke();
    }
    // 各角落淡色提示
    cornerSel.forEach((c, pi) => {
      const col = PLAYER_COLORS[pi];
      for (const h of arms[c]){
        const [x,y] = toXY(h);
        ctx.beginPath(); ctx.arc(x,y,rHole,0,Math.PI*2);
        ctx.fillStyle = PLAYER_BG[pi]; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // 目标营地
      for (const h of arms[(c+3)%6]){
        const [x,y] = toXY(h);
        ctx.beginPath(); ctx.arc(x,y,rHole,0,Math.PI*2);
        ctx.strokeStyle = col; ctx.setLineDash([3,3]); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    // 可落点
    if (dests){
      for (const dk of dests){
        const [q,r] = dk.split(',').map(Number);
        const [x,y] = toXY({q,r});
        ctx.beginPath(); ctx.arc(x,y,rHole*0.55,0,Math.PI*2);
        ctx.fillStyle = 'rgba(34,160,107,.35)'; ctx.fill();
      }
    }
    // 棋子
    marbles.forEach((list, pi) => list.forEach(h => {
      const [x,y] = toXY(h);
      ctx.beginPath(); ctx.arc(x,y,rMarble,0,Math.PI*2);
      ctx.fillStyle = PLAYER_COLORS[pi]; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }));
    // 选中
    if (selected){
      const [x,y] = toXY(selected);
      ctx.beginPath(); ctx.arc(x,y,rMarble+4,0,Math.PI*2);
      ctx.strokeStyle = PLAYER_COLORS[cur]; ctx.lineWidth = 3; ctx.stroke();
    }
  }
  canvas.addEventListener('click', e => {
    if (over) return;
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * W;
    const py = (e.clientY - rect.top) / rect.height * H;
    const L = computeLayout();
    let best = null, bestD = 1e9;
    for (const h of holes){
      const x = L.ox + (h.q + h.r/2)*L.scale, y = L.oy + h.r*0.866*L.scale;
      const d = (x-px)*(x-px) + (y-py)*(y-py);
      if (d < bestD){ bestD = d; best = h; }
    }
    if (!best || bestD > (L.scale*0.55)*(L.scale*0.55)){ selected = null; dests = null; draw(); return; }
    const bk = key(best);
    const occ = occupiedMap();
    if (selected){
      if (dests && dests.has(bk)){
        if (opts.online) opts.sendMove({ from: [selected.q, selected.r], to: [best.q, best.r] });
        applyCheckerMove(selected, best);
        return;
      }
      selected = null; dests = null;
    }
    const occAt = occ.get(bk);
    if (occAt && occAt.pi === cur){
      selected = best;
      dests = checkerReachable(holeSet, occ, best);
    }
    draw();
  });
  function applyCheckerMove(fromHole, toHole){
    const occ = occupiedMap();
    const hit = occ.get(key(fromHole));
    history.push({ pi: hit.pi, mi: hit.mi, from: {q:fromHole.q, r:fromHole.r}, to: {q:toHole.q, r:toHole.r} });
    marbles[hit.pi][hit.mi] = toHole;
    selected = null; dests = null;
    const target = new Set(targetKey(cornerSel[cur]));
    if (marbles[cur].every(m => target.has(key(m)))){
      over = true; winner = cur;
      if (opts.onEnd) opts.onEnd(marbles.map((list, i) => ({
        slot: i,
        coins: i === cur ? 1 : 0,
        rank: i === cur ? 1 : 2,
      })));
      draw();
      setStatus('🏆 玩家' + (cur+1) + ' 获胜！', true);
      showCheckerOver();
      return;
    }
    nextPlayer();
  }
  function nextPlayer(){
    cur = (cur + 1) % n;
    // 跳过无子可动的玩家
    let guard = 0;
    while (guard++ < n){
      const occ = occupiedMap();
      const anyMove = marbles[cur].some(m => checkerReachable(holeSet, occ, m).size > 0);
      if (anyMove) break;
      toast('玩家' + (cur+1) + ' 无子可动，跳过');
      cur = (cur + 1) % n;
    }
    renderPlayers(cur, progressInfos());
    setStatus('轮到玩家' + (cur+1) + '，点击自己的棋子');
    scheduleAI();
  }
  function progressInfos(){
    return marbles.map((list, pi) => {
      const t = new Set(targetKey(cornerSel[pi]));
      const cnt = list.filter(m => t.has(key(m))).length;
      return '归位 ' + cnt + '/10';
    });
  }
  function showCheckerOver(){
    const winnerName = '玩家' + (winner+1);
    showVictoryOverlay(area, {
      winner: winner, winnerName: winnerName,
      emoji: '🏆', subtitle: '10 颗弹珠全部到达对角营地', coins: 1, onRestart: resetLocal
    });
  }
  opts.onMove = payload => {
    if (payload && payload.from && payload.to){
      applyCheckerMove({ q: payload.from[0], r: payload.from[1] }, { q: payload.to[0], r: payload.to[1] });
    }
  };
  function resetLocal(){
    marbles = cornerSel.map(c => arms[c].map(h => ({q:h.q, r:h.r})));
    cur = 0; over = false; winner = -1; selected = null; dests = null; history = []; aiPending = false;
    const ov = area.querySelector('.overlay'); if (ov) ov.remove();
    draw();
    renderPlayers(0, progressInfos());
    setStatus('轮到玩家1，点击自己的棋子');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  reset();
  return {
    reset,
    onMove: opts.onMove,
    onRestart: resetLocal,
    snapshot: () => ({
      marbles: marbles.map(list => list.map(key)),
      cur, over, winner,
      history: history.map(h => ({ pi: h.pi, mi: h.mi, from: key(h.from), to: key(h.to) })),
    }),
  };
}
