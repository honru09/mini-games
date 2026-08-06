/* ================= 迷你大富翁 ================= */
function gameMonopoly(area, extra, n, opts){
  opts = opts || {};
  const CELLS = [
    {name:'起点', type:'go', emo:'💰'},
    {name:'机会', type:'chance', emo:'🎁'},
    {name:'蓝湾', type:'prop', price:300, col:'#60a5fa'},
    {name:'纳税', type:'tax', amt:500, emo:'🧾'},
    {name:'绿谷', type:'prop', price:350, col:'#34d399'},
    {name:'车站', type:'prop', price:400, col:'#94a3b8'},
    {name:'机会', type:'chance', emo:'🎁'},
    {name:'金街', type:'prop', price:450, col:'#fbbf24'},
    {name:'红山', type:'prop', price:500, col:'#f87171'},
    {name:'休息', type:'rest', emo:'☕'},
    {name:'紫苑', type:'prop', price:550, col:'#a78bfa'},
    {name:'橙园', type:'prop', price:600, col:'#fb923c'},
    {name:'机会', type:'chance', emo:'🎁'},
    {name:'黄都', type:'prop', price:650, col:'#facc15'},
    {name:'青湖', type:'prop', price:700, col:'#22d3ee'},
    {name:'纳税', type:'tax', amt:700, emo:'🧾'},
    {name:'粉港', type:'prop', price:750, col:'#f472b6'},
    {name:'白塔', type:'prop', price:800, col:'#cbd5e1'},
    {name:'机会', type:'chance', emo:'🎁'},
    {name:'灰堡', type:'prop', price:850, col:'#9ca3af'},
    {name:'棕野', type:'prop', price:900, col:'#a16207'},
    {name:'车站', type:'prop', price:950, col:'#64748b'},
    {name:'黑金', type:'prop', price:1000, col:'#334155'},
    {name:'机会', type:'chance', emo:'🎁'},
  ];
  const CHANCE = [
    {text:'意外之财，获得 800', v:800},
    {text:'房屋维修，支出 600', v:-600},
    {text:'前进 3 格', move:3},
    {text:'后退 2 格', move:-2},
    {text:'直达起点，获得 2000', go:true},
    {text:'大家赞助你，每人给你 200', each:200},
    {text:'请大家吃饭，给每人 200', each:-200},
    {text:'投资回报，获得 500', v:500},
  ];
  const START_MONEY = 2000;
  const MAX_ROUND = 30;
  let players = [], cur = 0, phase = 'roll', over = false, winner = -1, round = 1;
  let chanceDeck = [];
  let S = 520;
  const board = el('div','m-board');
  area.appendChild(board);
  const diceFaces = [makeDice3D(46, true), makeDice3D(46, true)];
  const center = el('div','m-center');
  const diceRow = el('div','dice-row');
  diceFaces.forEach(f => diceRow.appendChild(f.wrap));
  const rollBtn = el('button','btn btn-primary','🎲 掷骰子');
  rollBtn.addEventListener('click', roll);
  center.appendChild(diceRow);
  center.appendChild(rollBtn);
  board.appendChild(center);
  let aiPending = false;
  function scheduleAI(){
    if (aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    setStatus('🤖 AI 思考中…');
    setTimeout(async () => {
      aiPending = false;
      if (over) return;
      if (phase === 'roll'){ roll(); return; }
      if (phase === 'buy'){
        const p = players[cur];
        const cell = CELLS[p.pos];
        // 启发式：买得起的便宜地就买，贵地保留现金
        const buy = p.money >= cell.price && (p.money - cell.price >= 800 || cell.price <= 400);
        if (opts.aiPersona && Math.random() < opts.aiPersona.randomness) buy = !buy;
        aiSpeak(opts.aiPersona, 'think');
        applyDecision(cur, buy ? 'buy' : 'pass');
      }
    }, 750);
  }
  const moneyRow = el('div','money-row');
  extra.appendChild(moneyRow);
  const actionRow = el('div');
  extra.appendChild(actionRow);
  const settleBtn = el('button','btn','⏹ 提前结算');
  settleBtn.addEventListener('click', () => {
    if (over) return;
    if (opts.online && !opts.isHost){ toast('只有房主可以提前结算'); return; }
    if (opts.online) opts.sendMove({ decision: 'settle' });
    settle();
  });
  extra.appendChild(settleBtn);

  function rentOf(cell){ return Math.round(cell.price/3/10)*10; }
  function aliveList(){ return players.map((p,i)=>p.alive?i:-1).filter(i=>i>=0); }
  function init(){
    players = Array.from({length:n}, () => ({ money: START_MONEY, pos: 0, alive: true, props: [] }));
    CELLS.forEach(c => { if (c.type==='prop') c.owner = -1; });
    chanceDeck = CHANCE.map((c,i)=>i);
    if (!opts.online){
      for (let i=chanceDeck.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [chanceDeck[i],chanceDeck[j]]=[chanceDeck[j],chanceDeck[i]]; }
    }
    cur = 0; phase = 'roll'; over = false; winner = -1; round = 1;
  }
  function renderBoard(){
    const w = area.clientWidth || 520;
    S = Math.min(w, 540);
    board.style.width = S + 'px'; board.style.height = S + 'px';
    board.innerHTML = '';
    rollBtn.disabled = over || phase !== 'roll' || (opts.online && cur !== opts.myIdx) || (opts.ai && opts.ai.has(cur));
    const c = S/2, R = S*0.40;
    const ang = i => (-90 + i * 360/CELLS.length) * Math.PI/180;
    const cellSize = Math.min(54, Math.floor(S*0.105));
    CELLS.forEach((cell, i) => {
      const x = c + R*Math.cos(ang(i)), y = c + R*Math.sin(ang(i));
      const d = el('div','m-cell');
      d.style.left = (x - cellSize/2) + 'px'; d.style.top = (y - cellSize/2) + 'px';
      d.style.width = d.style.height = cellSize + 'px';
      if (cell.type === 'prop'){
        d.style.borderColor = cell.col;
        const st = el('div','stripe'); st.style.background = cell.col;
        d.appendChild(st);
        d.appendChild(el('span', null, cell.name));
        d.appendChild(el('span', null, String(cell.price)));
        if (cell.owner >= 0){
          const od = el('div','owner-dot');
          od.style.background = PLAYER_COLORS[cell.owner];
          d.appendChild(od);
        }
      } else {
        d.style.borderColor = '#d7deea';
        d.appendChild(el('span','emo', cell.emo));
        d.appendChild(el('span', null, cell.name));
      }
      board.appendChild(d);
    });
    // 棋子标记
    players.forEach((p, pi) => {
      if (!p.alive) return;
      const pos = p.pos;
      const x = c + R*Math.cos(ang(pos)), y = c + R*Math.sin(ang(pos));
      const a = (pi / n) * Math.PI*2 - Math.PI/2;
      const m = el('div','m-marker');
      m.style.background = PLAYER_COLORS[pi];
      m.style.left = (x + Math.cos(a)*7) + 'px';
      m.style.top = (y + Math.sin(a)*7) + 'px';
      board.appendChild(m);
    });
    // 中心
    const cs = S*0.40;
    center.style.left = (S/2) + 'px'; center.style.top = (S/2) + 'px';
    center.style.width = center.style.height = cs + 'px';
    center.style.marginLeft = center.style.marginTop = (-cs/2) + 'px';
    center.style.fontSize = Math.max(11, cs*0.085) + 'px';
    board.appendChild(center);
    // 结束覆盖层
    if (over){
      const winnerName = '玩家' + (winner+1);
      const w = players[winner];
      showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: '资产 ¥' + (w ? w.money : 0), coins: 1, onRestart: resetLocal
      });
    }
    renderMoney();
  }
  function renderMoney(){
    moneyRow.innerHTML = '';
    players.forEach((p, i) => {
      const chip = el('div','money-chip' + (i===cur && !over ? ' active' : '') + (!p.alive ? ' bankrupt' : ''));
      const dot = el('span','dot'); dot.style.background = PLAYER_COLORS[i];
      chip.appendChild(dot);
      chip.appendChild(el('span', null, '玩家' + (i+1)));
      chip.appendChild(el('span','amt', '¥' + p.money));
      moneyRow.appendChild(chip);
    });
    renderPlayers(cur, players.map((p,i) => p.alive ? ('资产 ¥' + p.money) : '破产'), players.map(p => !p.alive));
  }
  function roll(){
    sfx('pop');
    if (over || phase !== 'roll') return;
    sfx('pop');
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    const d1 = 1 + Math.floor(Math.random()*6), d2 = 1 + Math.floor(Math.random()*6);
    if (opts.online) opts.sendMove({ roll: [d1, d2] });
    applyRoll(d1, d2);
  }
  function applyRoll(d1, d2){
    rollBtn.disabled = true;
    setStatus('玩家' + (cur+1) + ' 掷骰子…');
    diceFaces[0].roll(d1, () => {
      diceFaces[1].roll(d2, () => {
      movePlayer(cur, d1 + d2, () => {
        rollBtn.disabled = false;
        resolveCell(cur);
      });
      });
    });
  }
  function movePlayer(pi, steps, cb){
    const p = players[pi];
    const old = p.pos;
    const npos = (old + steps) % CELLS.length;
    if (old + steps >= CELLS.length){
      p.money += 2000;
      toast('🚀 经过起点，获得 2000');
    }
    p.pos = npos;
    renderBoard();
    setStatus('玩家' + (pi+1) + ' 走到「' + CELLS[npos].name + '」');
    setTimeout(cb, 350);
  }
  function resolveCell(pi, depth){
    if (over) return;
    const p = players[pi];
    if (!p.alive) { nextTurn(); return; }
    const cell = CELLS[p.pos];
    if (cell.type === 'go'){
      nextTurn();
    } else if (cell.type === 'rest'){
      setStatus('玩家' + (pi+1) + ' 在「休息」喝茶，无事发生');
      setTimeout(nextTurn, 500);
    } else if (cell.type === 'tax'){
      pay(pi, cell.amt, '缴纳了 ' + cell.amt + ' 税款');
      setTimeout(() => { if (!over) nextTurn(); }, 400);
    } else if (cell.type === 'chance'){
      showChance(pi, depth || 0);
    } else if (cell.type === 'prop'){
      if (cell.owner === -1){
        phase = 'buy';
        renderBoard();
        setStatus('玩家' + (pi+1) + ' 要购买「' + cell.name + '」（¥' + cell.price + '）吗？');
        actionRow.innerHTML = '';
        const buy = el('button','btn btn-primary','购买 ¥' + cell.price);
        buy.addEventListener('click', () => {
          if (opts.online && cur !== opts.myIdx) return;
          if (opts.ai && opts.ai.has(cur)) return;
          if (opts.online) opts.sendMove({ decision: 'buy' });
          applyDecision(pi, 'buy');
        });
        const pass = el('button','btn','放弃');
        pass.addEventListener('click', () => {
          if (opts.online && cur !== opts.myIdx) return;
          if (opts.ai && opts.ai.has(cur)) return;
          if (opts.online) opts.sendMove({ decision: 'pass' });
          applyDecision(pi, 'pass');
        });
        actionRow.appendChild(buy); actionRow.appendChild(pass);
        scheduleAI();
      } else if (cell.owner === pi){
        setStatus('玩家' + (pi+1) + ' 回到自己的地盘');
        setTimeout(nextTurn, 500);
      } else {
        const rent = rentOf(cell);
        pay(pi, rent, '向玩家' + (cell.owner+1) + ' 支付租金 ' + rent);
        setTimeout(() => { if (!over) nextTurn(); }, 450);
      }
    }
  }
  function applyDecision(pi, decision){
    playFeedback(decision === 'buy' ? 'score' : 'tap');
    const p = players[pi];
    const cell = CELLS[p.pos];
    if (decision === 'buy'){
      if (p.money >= cell.price){
        p.money -= cell.price; cell.owner = pi; p.props.push(p.pos);
        toast('🏠 购入「' + cell.name + '」');
      } else {
        toast('资金不足，无法购买');
      }
    }
    phase = 'done';
    actionRow.innerHTML = '';
    renderBoard();
    setTimeout(nextTurn, 450);
  }
  function pay(pi, amt, why){
    const p = players[pi];
    p.money -= amt;
    if (p.money < 0){
      p.alive = false;
      p.props.forEach(idx => CELLS[idx].owner = -1);
      p.props = [];
      toast('💀 玩家' + (pi+1) + ' 破产出局！');
      const alive = aliveList();
      if (alive.length === 1){
        over = true; winner = alive[0];
        creditGame();
        renderBoard();
        setStatus('🏆 玩家' + (winner+1) + ' 获胜！', true);
        return;
      }
    }
    renderBoard();
    if (why) setStatus('玩家' + (pi+1) + ' ' + why);
  }
  function showChance(pi, depth){
    if (depth >= 3){ setStatus('机会卡连续触发，停止结算'); setTimeout(nextTurn, 500); return; }
    phase = 'chance';
    const idx = chanceDeck.shift();
    chanceDeck.push(idx);
    const card = CHANCE[idx];
    if (opts.online || (opts.ai && opts.ai.has(pi))){
      applyChance(pi, card, depth);
      return;
    }
    const modal = el('div','chance-modal');
    const box = el('div','chance-card');
    box.appendChild(el('div','emo','🎁'));
    box.appendChild(el('h3', null, '机会卡'));
    box.appendChild(el('p', null, card.text));
    const ok = el('button','btn btn-primary','确定');
    ok.addEventListener('click', () => {
      modal.remove();
      applyChance(pi, card, depth);
    });
    box.appendChild(ok);
    modal.appendChild(box);
    board.appendChild(modal);
  }
  function applyChance(pi, card, depth){
    const p = players[pi];
    if (!p.alive) return;
    if (card.v !== undefined) pay(pi, -card.v, '抽取机会卡');
    else if (card.each !== undefined){
      if (card.each > 0){
        let got = 0;
        players.forEach((q, qi) => { if (qi !== pi && q.alive){ q.money -= card.each; got += card.each; } });
        p.money += got;
        renderBoard();
        setStatus('玩家' + (pi+1) + ' 收到每人 ' + card.each + ' 的赞助');
      } else {
        let aliveOthers = 0;
        players.forEach((q, qi) => {
          if (qi !== pi && q.alive){ q.money += -card.each; aliveOthers++; }
        });
        p.money += card.each * aliveOthers;
        renderBoard();
        setStatus('玩家' + (pi+1) + ' 请每人吃了 ' + (-card.each) + ' 的大餐');
      }
      // 检查其他人破产
      let ended = false;
      players.forEach((q, qi) => {
        if (qi !== pi && q.alive && q.money < 0){
          q.alive = false;
          q.props.forEach(idx => CELLS[idx].owner = -1);
          q.props = [];
          toast('💀 玩家' + (qi+1) + ' 破产出局！');
          const alive = aliveList();
          if (alive.length === 1){ over = true; winner = alive[0]; ended = true; creditGame(); renderBoard(); setStatus('🏆 玩家' + (winner+1) + ' 获胜！', true); }
        }
      });
      if (ended) return;
    }
    else if (card.move !== undefined){
      const steps = ((card.move % CELLS.length) + CELLS.length) % CELLS.length;
      const old = p.pos;
      const npos = (old + steps) % CELLS.length;
      if (old + steps >= CELLS.length){
        p.money += 2000;
        toast('🚀 经过起点，获得 2000');
      }
      p.pos = npos;
      renderBoard();
      setStatus('玩家' + (pi+1) + ' ' + (card.move > 0 ? '前进' : '后退') + Math.abs(card.move) + ' 格');
      setTimeout(() => resolveCell(pi, depth+1), 450);
      return;
    }
    else if (card.go){
      p.money += 2000;
      p.pos = 0;
      renderBoard();
      setStatus('玩家' + (pi+1) + ' 直达起点，获得 2000');
    }
    setTimeout(() => { if (!over) nextTurn(); }, 600);
  }
  function nextTurn(){
    if (over) return;
    phase = 'roll';
    actionRow.innerHTML = '';
    if (cur === n - 1) round++;
    cur = (cur + 1) % n;
    while (!players[cur].alive) cur = (cur + 1) % n;
    if (round > MAX_ROUND){ settle(); return; }
    renderBoard();
    setStatus('第 ' + Math.min(round, MAX_ROUND) + '/' + MAX_ROUND + ' 轮 · 轮到玩家' + (cur+1) + '，请掷骰子');
    scheduleAI();
  }
  function settle(){
    if (over) return;
    over = true;
    creditGame();
    const order = players.map((p, i) => i).sort((a, b) =>
      ((players[b].alive ? 1 : 0) - (players[a].alive ? 1 : 0)) || (players[b].money - players[a].money));
    winner = order[0];
    renderBoard();
    const lines = order.map((i, k) =>
      (k+1) + '. 玩家' + (i+1) + ' — ¥' + players[i].money + (players[i].alive ? '' : '（破产）'));
    showModal('🏆 结算 · 玩家' + (winner+1) + ' 获胜', lines, '确定');
    setStatus('🏆 玩家' + (winner+1) + ' 是最终赢家！', true);
  }
  function creditGame(){
    const order = players.map((p, i) => i).sort((a, b) =>
      ((players[b].alive ? 1 : 0) - (players[a].alive ? 1 : 0)) || (players[b].money - players[a].money));
    const res = order.map((i, k) => ({ slot: i, coins: k === 0 ? 1 : 0, rank: k + 1 }));
    if (opts.onEnd) opts.onEnd(res);
  }
  opts.onMove = payload => {
    if (!payload) return;
    if (payload.roll) applyRoll(payload.roll[0], payload.roll[1]);
    else if (payload.decision === 'settle') settle();
    else if (payload.decision) applyDecision(cur, payload.decision);
  };
  function resetLocal(){
    init();
    actionRow.innerHTML = '';
    rollBtn.disabled = false;
    diceFaces.forEach(f => f.reset());
    aiPending = false;
    renderBoard();
    setStatus('第 1/' + MAX_ROUND + ' 轮 · 玩家1 的回合，请掷骰子');
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  init();
  renderBoard();
  setStatus('第 1/' + MAX_ROUND + ' 轮 · 玩家1 的回合，请掷骰子');
  return {
    reset,
    onMove: opts.onMove,
    onRestart: resetLocal,
    snapshot: () => ({
      players: players.map(p => ({ money: p.money, pos: p.pos, alive: p.alive, props: p.props.slice() })),
      cur, phase, round, over, winner,
      owners: CELLS.map(c => c.owner),
      deck: chanceDeck.slice(),
    }),
  };
}
