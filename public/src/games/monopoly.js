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
  let boardTheme = opts.boardTheme === 'grass' ? 'grass' : 'classic';
  let cosmetic = normalizeCosmetic(opts.cosmetic);
  let spectator = !!opts.spectator;
  let startedAt = Date.now(), finishedAt = 0;
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none';
  area.style.overscrollBehavior = 'contain';
  function normalizeCosmetic(value){
    const source=value||{},defaultToken=source.default||source.token;
    return {default:defaultToken==='car'?'car':'character',players:{...(source.players||{})}};
  }
  function tokenSkin(pi){const value=cosmetic.players&&cosmetic.players[pi];return value==='car'||(value&&value.token==='car')?'car':cosmetic.default;}
  // WebSocket 保证消息顺序，但不同客户端的动画计时并不同步；远端输入必须等本地逻辑阶段就绪。
  let remoteInputs = [];
  let drainingRemoteInputs = false;
  let epoch = 0;
  let idleWaiters = [];
  function isIdle(){ return over || ((phase === 'roll' || phase === 'buy') && !drainingRemoteInputs); }
  function notifyIdle(){
    if (!isIdle()) return;
    const waiters = idleWaiters.splice(0);
    waiters.forEach(resolve => resolve());
  }
  function whenIdle(){ return isIdle() ? Promise.resolve() : new Promise(resolve => idleWaiters.push(resolve)); }
  function later(fn, delay){
    const scheduledEpoch = epoch;
    return setTimeout(() => { if (scheduledEpoch === epoch) fn(); }, delay);
  }
  function invalidateAsync(){
    epoch++;
    const waiters = idleWaiters.splice(0);
    waiters.forEach(resolve => resolve());
  }
  let S = 520;
  const board = el('div','m-board');
  area.appendChild(board);
  const diceFaces = [makeDice3D(46, true), makeDice3D(46, true)];
  const center = el('div','m-center');
  const turnHud = el('div','game-turn-hud monopoly-turn-hud');
  const leaderHud = el('div','monopoly-leader-hud');
  const diceRow = el('div','dice-row');
  diceFaces.forEach(f => diceRow.appendChild(f.wrap));
  const rollBtn = el('button','btn btn-primary','🎲 掷骰子');
  rollBtn.addEventListener('click', roll);
  center.appendChild(turnHud);
  center.appendChild(leaderHud);
  center.appendChild(diceRow);
  center.appendChild(rollBtn);
  board.appendChild(center);
  let aiPending = false;
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    const gen = epoch;
    const turn = cur;
    setStatus('🤖 AI 思考中…');
    later(async () => {
      if (opts.destroyed || over || gen !== epoch || cur !== turn || !opts.ai.has(cur)){
        aiPending = false;
        return;
      }
      if (phase === 'roll'){
        const d1 = 1 + Math.floor(Math.random() * 6);
        const d2 = 1 + Math.floor(Math.random() * 6);
        aiPending = false;
        if (opts.online && typeof opts.sendBotMove === 'function'){ opts.sendBotMove(turn, { roll:[d1,d2] }); return; }
        applyRoll(d1, d2);
        return;
      }
      if (phase === 'buy'){
        const p = players[cur];
        const cell = CELLS[p.pos];
        // 启发式：买得起的便宜地就买，贵地保留现金
        let buy = p.money >= cell.price && (p.money - cell.price >= 800 || cell.price <= 400);
        if (opts.aiPersona && Math.random() < opts.aiPersona.randomness) buy = !buy;
        const choices = p.money >= cell.price ? ['buy', 'pass'] : ['pass'];
        const remoteChoice = await aiChoose('monopoly', {
          turn: cur, round, money: p.money, position: p.pos,
          property: { name: cell.name, price: cell.price, owner: cell.owner },
          owned: p.props.slice(),
        }, choices, opts.aiPersona);
        if (opts.destroyed || over || gen !== epoch || cur !== turn || phase !== 'buy' || players[cur].pos !== p.pos){
          aiPending = false;
          return;
        }
        const decision = choices.includes(remoteChoice) ? remoteChoice : (buy && choices.includes('buy') ? 'buy' : 'pass');
        aiPending = false;
        aiSpeak(opts.aiPersona, 'think');
        if (opts.online && typeof opts.sendBotMove === 'function'){ opts.sendBotMove(turn, { decision }); return; }
        applyDecision(cur, decision);
        return;
      }
      aiPending = false;
    }, 750);
  }
  const moneyRow = el('div','money-row');
  extra.appendChild(moneyRow);
  const actionRow = el('div');
  extra.appendChild(actionRow);
  const settleBtn = el('button','btn','⏹ 提前结算');
  settleBtn.addEventListener('click', () => {
    if (spectator || over) return;
    if (opts.online && !opts.isHost){ toast('只有房主可以提前结算'); return; }
    if (opts.onProgress) opts.onProgress({ decision: 'settle' });
    if (opts.online) opts.sendMove({ decision: 'settle' });
    remoteInputs.push({ payload: { decision: 'settle' }, trustedHost: true });
    drainRemoteInputs();
  });
  extra.appendChild(settleBtn);

  function rentOf(cell){ return Math.round(cell.price/3/10)*10; }
  function aliveList(){ return players.map((p,i)=>p.alive?i:-1).filter(i=>i>=0); }
  function netWorth(pi){
    const p = players[pi];
    if (!p) return 0;
    return p.money + p.props.reduce((sum, idx) => sum + Number(CELLS[idx] && CELLS[idx].price || 0), 0);
  }
  function identityOf(value){
    if (value < 2500) return '平民';
    if (value < 4000) return '小资';
    if (value < 6000) return '中产';
    if (value < 9000) return '富豪';
    return '大亨';
  }
  function placement(){
    return players.map((_, i) => i).sort((a, b) =>
      ((players[b].alive ? 1 : 0) - (players[a].alive ? 1 : 0)) ||
      (netWorth(b) - netWorth(a)) || a - b);
  }
  function showCashChange(pi, amount, reason){
    const pop = el('div','monopoly-cash-pop', (amount >= 0 ? '+' : '-') + '¥' + Math.abs(amount) + (reason ? ' · ' + reason : ''));
    pop.style.position = 'absolute'; pop.style.left = '50%'; pop.style.top = '58%';
    pop.style.transform = 'translate(-50%,-50%)'; pop.style.zIndex = '8';
    pop.style.padding = '7px 12px'; pop.style.borderRadius = '999px';
    pop.style.background = amount >= 0 ? 'rgba(16,185,129,.92)' : 'rgba(239,68,68,.92)';
    pop.style.color = '#fff'; pop.style.fontWeight = '800'; pop.style.pointerEvents = 'none';
    board.appendChild(pop);
    later(() => pop.remove(), 700);
  }
  function init(){
    players = Array.from({length:n}, () => ({ money: START_MONEY, pos: 0, visualPos: 0, alive: true, props: [], buildings: 0 }));
    CELLS.forEach(c => { if (c.type==='prop') c.owner = -1; });
    chanceDeck = CHANCE.map((c,i)=>i);
    if (!opts.online){
      for (let i=chanceDeck.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [chanceDeck[i],chanceDeck[j]]=[chanceDeck[j],chanceDeck[i]]; }
    }
    cur = 0; phase = 'roll'; over = false; winner = -1; round = 1; startedAt = Date.now(); finishedAt = 0;
  }
  function renderBoard(){
    const w = area.clientWidth || 520;
    S = Math.min(w, 540);
    board.style.width = S + 'px'; board.style.height = S + 'px';
    board.style.background = boardTheme === 'grass'
      ? 'radial-gradient(circle at 50% 45%,rgba(255,255,255,.82),rgba(236,253,245,.72) 42%,rgba(22,101,52,.34)),repeating-linear-gradient(105deg,#5f9f55 0 5px,#4f8e49 5px 9px)'
      : 'radial-gradient(circle at 50% 45%,rgba(255,255,255,.92),rgba(255,247,237,.88) 48%,rgba(146,64,14,.24)),repeating-linear-gradient(90deg,#c99b6b 0 8px,#b98555 8px 16px)';
    board.innerHTML = '';
    rollBtn.disabled = spectator || over || phase !== 'roll' || (opts.online && cur !== opts.myIdx) || (opts.ai && opts.ai.has(cur));
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
          od.textContent = String(cell.owner + 1);
          od.title = '玩家' + (cell.owner + 1) + ' 的地产';
          d.appendChild(od);
          const ownerBadge = el('span','property-owner-avatar','P' + (cell.owner + 1));
          ownerBadge.style.cssText = 'position:absolute;right:2px;bottom:2px;border-radius:999px;padding:1px 3px;font-size:9px;font-weight:800;color:#fff;background:' + PLAYER_COLORS[cell.owner] + ';';
          d.appendChild(ownerBadge);
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
      const pos = Number.isInteger(p.visualPos) ? p.visualPos : p.pos;
      const x = c + R*Math.cos(ang(pos)), y = c + R*Math.sin(ang(pos));
      const a = (pi / n) * Math.PI*2 - Math.PI/2;
      const m = el('div','m-marker');
      m.style.background = PLAYER_COLORS[pi];
      const skin = tokenSkin(pi);
      m.textContent = skin === 'car' ? '🚗' : '♟';
      m.title = '玩家' + (pi + 1) + ' · ' + (skin === 'car' ? 'Car' : 'Character');
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
    const leader = placement()[0];
    turnHud.textContent = spectator
      ? '观战 · 玩家' + (cur + 1) + ' 的回合'
      : (opts.online && cur === opts.myIdx ? '你的回合' : '玩家' + (cur + 1) + ' 的回合');
    leaderHud.textContent = leader === undefined ? '' : '领先：玩家' + (leader + 1) + ' · 净资产 ¥' + netWorth(leader);
    turnHud.style.cssText = 'font-weight:900;margin-bottom:3px;transition:opacity .2s ease;';
    leaderHud.style.cssText = 'font-size:10px;color:var(--muted);margin-bottom:5px;';
    board.appendChild(center);
    // 结束覆盖层
    if (over){
      const winnerName = '玩家' + (winner+1);
      const w = players[winner];
      showVictoryOverlay(area, {
        winner: winner, winnerName: winnerName,
        emoji: '🏆', subtitle: '资产 ¥' + (w ? w.money : 0), coins: 1, onRestart: reset
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
      const worth = netWorth(i);
      chip.appendChild(el('span','monopoly-identity', identityOf(worth) + ' · 净资产 ¥' + worth));
      chip.appendChild(el('span','monopoly-assets', '🏠 ' + p.props.length + ' · 🏢 ' + (p.buildings || 0) + ' · ' + (p.props.length ? p.props.map(idx => CELLS[idx].name.slice(0,1)).join(' ') : '无地产')));
      moneyRow.appendChild(chip);
    });
    renderPlayers(cur, players.map((p,i) => p.alive ? (identityOf(netWorth(i)) + ' · ¥' + p.money + ' · 🏠' + p.props.length) : '破产'), players.map(p => !p.alive));
  }
  function roll(){
    sfx('pop');
    if (spectator || over || phase !== 'roll') return;
    sfx('pop');
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    const d1 = 1 + Math.floor(Math.random()*6), d2 = 1 + Math.floor(Math.random()*6);
    if (opts.onProgress) opts.onProgress({ roll: [d1, d2] });
    if (opts.online) opts.sendMove({ roll: [d1, d2] });
    applyRoll(d1, d2);
  }
  function applyRoll(d1, d2){
    if (over || phase !== 'roll') return;
    const pi = cur;
    const actionEpoch = epoch;
    phase = 'moving';
    rollBtn.disabled = true;
    setStatus('玩家' + (pi+1) + ' 掷骰子…');
    diceFaces[0].roll(d1, () => {
      if (actionEpoch !== epoch) return;
      diceFaces[1].roll(d2, () => {
      if (actionEpoch !== epoch) return;
      movePlayer(pi, d1 + d2, () => {
        if (actionEpoch !== epoch) return;
        resolveCell(pi);
      });
      });
    });
  }
  function movePlayer(pi, steps, cb){
    const p = players[pi];
    const old = p.pos;
    const signed = Number(steps) || 0;
    const npos = ((old + signed) % CELLS.length + CELLS.length) % CELLS.length;
    if (signed > 0 && old + signed >= CELLS.length){
      p.money += 2000;
      toast('🚀 经过起点，获得 2000');
      showCashChange(pi, 2000, '经过起点');
    }
    p.pos = npos;
    if (prefersReducedMotion()){
      p.visualPos = npos;
      renderBoard();
      setStatus('玩家' + (pi+1) + ' 走到「' + CELLS[npos].name + '」');
      if (cb) cb();
      return;
    }
    const direction = signed < 0 ? -1 : 1;
    const total = Math.abs(signed);
    let step = 0;
    const motionDelay = total ? Math.max(55, Math.min(140, Math.floor(760 / total))) : 0;
    const advance = () => {
      if (step >= total){
        p.visualPos = npos;
        renderBoard();
        setStatus('玩家' + (pi+1) + ' 走到「' + CELLS[npos].name + '」');
        later(cb, 120);
        return;
      }
      step++;
      p.visualPos = ((old + direction * step) % CELLS.length + CELLS.length) % CELLS.length;
      renderBoard();
      later(advance, motionDelay);
    };
    advance();
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
      later(nextTurn, 500);
    } else if (cell.type === 'tax'){
      pay(pi, cell.amt, '缴纳了 ' + cell.amt + ' 税款');
      later(() => { if (!over) nextTurn(); }, 400);
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
          if (spectator) return;
          if (opts.online && cur !== opts.myIdx) return;
          if (opts.ai && opts.ai.has(cur)) return;
          if (opts.onProgress) opts.onProgress({ decision: 'buy' });
          if (opts.online) opts.sendMove({ decision: 'buy' });
          applyDecision(pi, 'buy');
        });
        const pass = el('button','btn','放弃');
        pass.addEventListener('click', () => {
          if (spectator) return;
          if (opts.online && cur !== opts.myIdx) return;
          if (opts.ai && opts.ai.has(cur)) return;
          if (opts.onProgress) opts.onProgress({ decision: 'pass' });
          if (opts.online) opts.sendMove({ decision: 'pass' });
          applyDecision(pi, 'pass');
        });
        actionRow.appendChild(buy); actionRow.appendChild(pass);
        drainRemoteInputs();
        if (phase === 'buy') { scheduleAI(); notifyIdle(); }
      } else if (cell.owner === pi){
        setStatus('玩家' + (pi+1) + ' 回到自己的地盘');
        later(nextTurn, 500);
      } else {
        const rent = rentOf(cell);
        pay(pi, rent, '向玩家' + (cell.owner+1) + ' 支付租金 ' + rent);
        later(() => { if (!over) nextTurn(); }, 450);
      }
    }
  }
  function applyDecision(pi, decision){
    if (over || phase !== 'buy' || pi !== cur || (decision !== 'buy' && decision !== 'pass')) return false;
    const p = players[pi];
    const cell = CELLS[p.pos];
    if (!cell || cell.type !== 'prop' || cell.owner !== -1) return false;
    playFeedback(decision === 'buy' ? 'score' : 'tap');
    if (decision === 'buy'){
      if (p.money >= cell.price){
        p.money -= cell.price; cell.owner = pi; p.props.push(p.pos);
        toast('🏠 购入「' + cell.name + '」');
        showCashChange(pi, -cell.price, '购买 ' + cell.name);
      } else {
        toast('资金不足，无法购买');
      }
    }
    phase = 'done';
    actionRow.innerHTML = '';
    renderBoard();
    later(nextTurn, 450);
    return true;
  }
  function pay(pi, amt, why){
    const p = players[pi];
    p.money -= amt;
    showCashChange(pi, -amt, why || '现金变化');
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
        notifyIdle();
        return;
      }
    }
    renderBoard();
    if (why) setStatus('玩家' + (pi+1) + ' ' + why);
  }
  function showChance(pi, depth){
    if (depth >= 3){ setStatus('机会卡连续触发，停止结算'); later(nextTurn, 500); return; }
    phase = 'chance';
    const idx = chanceDeck.shift();
    chanceDeck.push(idx);
    const card = CHANCE[idx];
    const modal = el('div','chance-modal');
    const box = el('div','chance-card');
    box.appendChild(el('div','emo','🎁'));
    box.appendChild(el('h3', null, '机会卡'));
    box.appendChild(el('p', null, card.text));
    const ok = el('button','btn btn-primary', (opts.online || spectator || (opts.ai && opts.ai.has(pi))) ? '翻牌中…' : '确定');
    ok.addEventListener('click', () => {
      modal.remove();
      applyChance(pi, card, depth);
    });
    box.appendChild(ok);
    modal.appendChild(box);
    board.appendChild(modal);
    if (opts.online || spectator || (opts.ai && opts.ai.has(pi))){
      ok.disabled = true;
      later(() => { modal.remove(); applyChance(pi, card, depth); }, 650);
    }
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
          if (alive.length === 1){ over = true; winner = alive[0]; ended = true; creditGame(); renderBoard(); setStatus('🏆 玩家' + (winner+1) + ' 获胜！', true); notifyIdle(); }
        }
      });
      if (ended) return;
    }
    else if (card.move !== undefined){
      setStatus('玩家' + (pi+1) + ' ' + (card.move > 0 ? '前进' : '后退') + Math.abs(card.move) + ' 格');
      movePlayer(pi, card.move, () => resolveCell(pi, depth+1));
      return;
    }
    else if (card.go){
      p.money += 2000;
      p.pos = 0;
      p.visualPos = 0;
      showCashChange(pi, 2000, '直达起点');
      renderBoard();
      setStatus('玩家' + (pi+1) + ' 直达起点，获得 2000');
    }
    later(() => { if (!over) nextTurn(); }, 600);
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
    drainRemoteInputs();
    if (phase === 'roll') { scheduleAI(); notifyIdle(); }
  }
  function settle(){
    if (over) return;
    over = true; finishedAt = Date.now(); area.style.touchAction = 'auto';
    creditGame();
    const order = placement();
    winner = order[0];
    renderBoard();
    const lines = order.map((i, k) =>
      (k+1) + '. 玩家' + (i+1) + ' — 净资产 ¥' + netWorth(i) + '（现金 ¥' + players[i].money + '）' + (players[i].alive ? '' : '（破产）'));
    showModal('🏆 结算 · 玩家' + (winner+1) + ' 获胜', lines, '确定');
    setStatus('🏆 玩家' + (winner+1) + ' 是最终赢家！', true);
    notifyIdle();
  }
  function creditGame(){
    const order = placement();
    const res = order.map((i, k) => ({ slot: i, coins: k === 0 ? 1 : 0, rank: k + 1 }));
    if (opts.onEnd) opts.onEnd(res);
  }
  function drainRemoteInputs(){
    if (drainingRemoteInputs || over) return;
    drainingRemoteInputs = true;
    try {
      while (remoteInputs.length && !over){
        const event = remoteInputs[0] || {};
        const payload = event.payload || {};
        if (payload.decision === 'settle'){
          // 提前结算也必须排在当前完整行动之后；buy 阶段尚未完成本回合。
          if (phase === 'buy'){
            // settle 可能先于当前玩家的购买决定到达；先完成该决定，再在下一 roll 边界结算。
            const decisionIdx = remoteInputs.findIndex((item, idx) => idx > 0 && item && item.payload &&
              item.payload.decision && item.payload.decision !== 'settle' && item.player === cur);
            if (decisionIdx < 0) break;
            const decision = remoteInputs.splice(decisionIdx, 1)[0].payload;
            applyDecision(cur, decision.decision);
            break;
          }
          if (phase !== 'roll') break;
          remoteInputs.shift();
          settle();
        } else {
          if (!Number.isInteger(event.player)){
            remoteInputs.shift();
            continue;
          }
          if (event.player !== cur){
            // 当前行动仍在动画中时，保留已到达的下一位玩家输入。
            if (phase !== 'roll' && phase !== 'buy') break;
            remoteInputs.shift();
            continue;
          }
          if (payload.roll){
          if (phase !== 'roll'){
            if (phase !== 'buy') break;
            remoteInputs.shift();
            continue;
          }
          remoteInputs.shift();
          applyRoll(payload.roll[0], payload.roll[1]);
          } else if (payload.decision){
          if (phase !== 'buy'){
            if (phase !== 'roll') break;
            remoteInputs.shift();
            continue;
          }
          remoteInputs.shift();
          applyDecision(cur, payload.decision);
          } else {
          remoteInputs.shift();
          }
        }
      }
    } finally {
      drainingRemoteInputs = false;
    }
  }
  opts.onMove = (payload, player) => {
    if (!payload) return;
    if (!payload.roll && !payload.decision) return;
    if (opts.online && !Number.isInteger(player)) return;
    remoteInputs.push({ payload, player });
    drainRemoteInputs();
  };
  function resetLocal(){
    invalidateAsync();
    init();
    remoteInputs = [];
    actionRow.innerHTML = '';
    rollBtn.disabled = false;
    diceFaces.forEach(f => f.reset());
    aiPending = false;
    renderBoard();
    setStatus('第 1/' + MAX_ROUND + ' 轮 · 玩家1 的回合，请掷骰子');
    notifyIdle();
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  init();
  renderBoard();
  setStatus('第 1/' + MAX_ROUND + ' 轮 · 玩家1 的回合，请掷骰子');
  function snapshot(){
    return {
      players: players.map(p => ({ money: p.money, pos: p.pos, alive: p.alive, props: p.props.slice(), buildings: p.buildings || 0 })),
      cur, phase, round, over, winner,
      owners: CELLS.map(c => c.owner),
      deck: chanceDeck.slice(),
    };
  }
  function onRestore(value){
    const state = value && value.state ? value.state : value;
    if (!state || !Array.isArray(state.players)) return false;
    invalidateAsync();
    players = state.players.map(p => ({
      money: Number(p.money) || 0, pos: Number(p.pos) || 0, visualPos: Number(p.pos) || 0,
      alive: p.alive !== false, props: Array.isArray(p.props) ? p.props.slice() : [], buildings: Number(p.buildings) || 0,
    }));
    cur = Number.isInteger(state.cur) ? state.cur : 0;
    phase = ['roll','buy','chance','moving','done'].includes(state.phase) ? state.phase : 'roll';
    round = Number(state.round) || 1; over = !!state.over; winner = Number.isInteger(state.winner) ? state.winner : -1;
    CELLS.forEach((cell, i) => { if (cell.type === 'prop') cell.owner = Array.isArray(state.owners) && Number.isInteger(state.owners[i]) ? state.owners[i] : -1; });
    chanceDeck = Array.isArray(state.deck) && state.deck.length ? state.deck.slice() : CHANCE.map((_, i) => i);
    if (value && value.presentation){ setBoardTheme(value.presentation.boardTheme); setCosmetic(value.presentation.cosmetic); }
    actionRow.innerHTML = ''; renderBoard(); notifyIdle(); return true;
  }
  function setBoardTheme(theme){ boardTheme = theme === 'grass' ? 'grass' : 'classic'; renderBoard(); return boardTheme; }
  function setCosmetic(value){ cosmetic = normalizeCosmetic(value); renderBoard(); return { default:cosmetic.default,players:{...cosmetic.players} }; }
  function setSpectators(value){ spectator = Array.isArray(value) ? value.includes(opts.viewerId) : !!value; renderBoard(); return spectator; }
  function getMatchStats(){
    const order = placement();
    return players.map((p, i) => ({
      duration: Math.max(0, (finishedAt || Date.now()) - startedAt), cash: p.money, netWorth: netWorth(i),
      properties: p.props.length, buildings: p.buildings || 0, placement: order.indexOf(i) + 1,
    }));
  }
  return {
    reset,
    onMove: opts.onMove,
    onRestart: resetLocal,
    destroy: () => {
      invalidateAsync();
      aiPending = false;
      remoteInputs = [];
      diceFaces.forEach(face => face.reset());
      area.style.touchAction = previousTouchAction;
      area.style.overscrollBehavior = previousOverscroll;
    },
    whenIdle,
    snapshot, onRestore,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic: { default:cosmetic.default,players:{...cosmetic.players} } }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, getMatchStats,
    getMultiplayerRequirement: () => ({ quickAuction: opts.online ? 'MONOPOLY_AUCTION_PROTOCOL_V1' : null }),
  };
}
