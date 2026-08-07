/* ================= 五子棋 ================= */
function checkGomokuWin(grid, r, c){
  const N = grid.length, p = grid[r][c];
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dr,dc] of dirs){
    let cnt = 1;
    for (const s of [1,-1]){
      let nr = r + dr*s, nc = c + dc*s;
      while (nr>=0 && nr<N && nc>=0 && nc<N && grid[nr][nc] === p){ cnt++; nr += dr*s; nc += dc*s; }
    }
    if (cnt >= 5) return true;
  }
  return false;
}
function gameGomoku(area, extra, n, opts){
  opts = opts || {};
  const N = 15, CELL = 34, PAD = 22, LOGICAL = PAD*2 + CELL*(N-1);
  let grid = Array.from({length:N}, () => Array(N).fill(-1));
  let cur = 0, over = false, hist = [], last = null, winLine = [];
  let boardTheme = opts.boardTheme === 'grass' ? 'grass' : 'classic';
  let cosmetic = normalizeCosmetic(opts.cosmetic);
  let spectator = !!opts.spectator, spectators = [], activePlayers = [0, 1];
  let startedAt = Date.now(), finishedAt = 0, ghost = null;
  let aiPending = false, aiEpoch = 0;
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none';
  area.style.overscrollBehavior = 'contain';
  const turnHud = el('div', 'game-turn-hud gomoku-turn-hud');
  extra.appendChild(turnHud);
  function normalizeCosmetic(value){
    if (typeof value === 'string') return { default:value === 'glow' ? 'glow' : 'classic', players:{} };
    const source = value || {}, defaultSkin = source.default || source.pieces;
    return { default:defaultSkin === 'glow' ? 'glow' : 'classic', players:{ ...(source.players || {}) } };
  }
  function pieceSkin(player){ const value = cosmetic.players && cosmetic.players[player]; return value === 'glow' || (value && value.pieces === 'glow') ? 'glow' : cosmetic.default; }
  function updateHud(){
    turnHud.textContent = over ? (winLine.length ? t('gomoku_five_complete',cur+1) : t('match_over')) :
      (spectator ? t('spectator_player_turn',cur+1) : (opts.online ? t(cur === opts.myIdx ? 'your_turn' : 'opponent_turn') : t('player_turn',cur+1)));
  }
  function winningCells(r, c){
    const p = grid[r][c];
    for (const [dr, dc] of [[1,0],[0,1],[1,1],[1,-1]]){
      const cells = [[r, c]];
      for (const s of [1, -1]){
        const branch = [];
        let nr = r + dr * s, nc = c + dc * s;
        while (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] === p){ branch.push([nr, nc]); nr += dr * s; nc += dc * s; }
        if (s < 0) cells.unshift(...branch.reverse()); else cells.push(...branch);
      }
      if (cells.length >= 5) return cells;
    }
    return [];
  }
  function aiState(){
    return {
      board: grid.map(row => row.map(v => v === -1 ? '.' : String(v)).join('')).join('/'),
      turn: cur,
      last: last ? last.join(',') : null,
    };
  }
  const GOMOKU_DIRS = [[1,0],[0,1],[1,1],[1,-1]];
  const GOMOKU_MATE = 10000000;
  function gomokuCandidates(radius){
    const found = new Set();
    const reach = radius || 2;
    let hasStone = false;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++){
      if (grid[r][c] === -1) continue;
      hasStone = true;
      for (let dr = -reach; dr <= reach; dr++) for (let dc = -reach; dc <= reach; dc++){
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] === -1) found.add(nr + ',' + nc);
      }
    }
    if (!hasStone) return [[7,7]];
    return [...found].map(key => key.split(',').map(Number));
  }
  // Allis 风格威胁刻画：只扩展落点相关的五连、四和可升级为活四的三。
  function gomokuThreatProfile(r, c, p){
    const empty = { win:false, openFour:0, rushFour:0, openThree:0, score:-Infinity };
    if (r < 0 || r >= N || c < 0 || c >= N || grid[r][c] !== -1) return empty;
    grid[r][c] = p;
    const profile = { win:checkGomokuWin(grid, r, c), openFour:0, rushFour:0, openThree:0, score:0 };
    for (const [dr, dc] of GOMOKU_DIRS){
      const line = [];
      for (let step = -5; step <= 5; step++){
        const nr = r + dr * step, nc = c + dc * step;
        line.push(nr < 0 || nr >= N || nc < 0 || nc >= N ? 'O' : (grid[nr][nc] === p ? 'X' : (grid[nr][nc] === -1 ? '.' : 'O')));
      }
      const winningPoints = new Set();
      for (let start = 1; start <= 5; start++){
        const window = line.slice(start, start + 5);
        if (window.filter(ch => ch === 'X').length === 4 && window.filter(ch => ch === '.').length === 1){
          winningPoints.add(start + window.indexOf('.'));
        }
      }
      if (winningPoints.size >= 2) profile.openFour++;
      else if (winningPoints.size === 1) profile.rushFour++;

      let createsOpenFour = 0;
      for (let point = 1; point <= 9; point++){
        if (line[point] !== '.') continue;
        line[point] = 'X';
        const nextWins = new Set();
        for (let start = 0; start <= 6; start++){
          const window = line.slice(start, start + 5);
          if (window.filter(ch => ch === 'X').length === 4 && window.filter(ch => ch === '.').length === 1){
            nextWins.add(start + window.indexOf('.'));
          }
        }
        line[point] = '.';
        if (nextWins.size >= 2) createsOpenFour++;
      }
      if (createsOpenFour) profile.openThree++;
    }
    grid[r][c] = -1;
    const fours = profile.openFour + profile.rushFour;
    profile.score = profile.win ? GOMOKU_MATE :
      profile.openFour ? 1200000 + profile.openFour * 90000 :
      fours >= 2 ? 900000 + fours * 40000 :
      profile.rushFour ? 230000 + profile.rushFour * 18000 + profile.openThree * 9000 :
      profile.openThree >= 2 ? 95000 + profile.openThree * 7000 :
      profile.openThree ? 17000 : 0;
    return profile;
  }
  function gomokuNeighborValue(r, c, p){
    let own = 0, opp = 0;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++){
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const weight = Math.max(1, 4 - Math.max(Math.abs(dr), Math.abs(dc)));
      if (grid[nr][nc] === p) own += weight;
      else if (grid[nr][nc] === (p ^ 1)) opp += weight;
    }
    return own * 16 + opp * 11 - (Math.abs(r - 7) + Math.abs(c - 7)) * 2;
  }
  function gomokuRankCandidates(p, limit){
    const ranked = gomokuCandidates(2).map(([r,c]) => {
      const attack = gomokuThreatProfile(r, c, p);
      const defense = gomokuThreatProfile(r, c, p ^ 1);
      let tier = attack.win ? 7 : defense.win ? 6 : attack.openFour ? 5 :
        (attack.openFour + attack.rushFour >= 2) ? 5 : defense.openFour ? 4 :
        (defense.openFour + defense.rushFour >= 2) ? 4 : attack.rushFour ? 3 :
        attack.openThree >= 2 ? 3 : defense.rushFour ? 2 : defense.openThree >= 2 ? 2 : attack.openThree ? 1 : 0;
      const value = attack.score + defense.score * 1.08 + gomokuNeighborValue(r, c, p);
      return { r, c, choice:r + ',' + c, attack, defense, tier, value, center:Math.abs(r - 7) + Math.abs(c - 7) };
    }).sort((a, b) => b.tier - a.tier || b.value - a.value || a.center - b.center || a.r - b.r || a.c - b.c);
    if (!ranked.length) return [];
    const wins = ranked.filter(item => item.attack.win);
    if (wins.length) return wins;
    const blocks = ranked.filter(item => item.defense.win);
    if (blocks.length) return blocks;
    return ranked.slice(0, limit || ranked.length);
  }
  function gomokuLeafValue(p){
    const ours = gomokuRankCandidates(p, 2);
    const theirs = gomokuRankCandidates(p ^ 1, 2);
    const ownThreat = ours.length ? ours[0].attack.score : 0;
    const oppThreat = theirs.length ? theirs[0].attack.score : 0;
    const ownBlock = ours.length ? ours[0].defense.score : 0;
    return ownThreat + ownBlock * .22 - oppThreat * 1.12;
  }
  function gomokuSearchMove(root, p, deadline){
    grid[root.r][root.c] = p;
    if (checkGomokuWin(grid, root.r, root.c)){ grid[root.r][root.c] = -1; return GOMOKU_MATE; }
    const replies = gomokuRankCandidates(p ^ 1, 10);
    let worst = Infinity, searched = 0;
    for (const reply of replies){
      if (Date.now() >= deadline && searched){ break; }
      grid[reply.r][reply.c] = p ^ 1;
      let lineScore;
      if (checkGomokuWin(grid, reply.r, reply.c)){
        lineScore = -GOMOKU_MATE + 1;
      } else {
        const counters = gomokuRankCandidates(p, 6);
        let bestCounter = -Infinity;
        for (const counter of counters){
          if (Date.now() >= deadline && bestCounter > -Infinity) break;
          grid[counter.r][counter.c] = p;
          const value = checkGomokuWin(grid, counter.r, counter.c)
            ? GOMOKU_MATE - 2
            : gomokuLeafValue(p) + counter.attack.score * .18 - reply.attack.score * .12;
          grid[counter.r][counter.c] = -1;
          if (value > bestCounter) bestCounter = value;
        }
        lineScore = bestCounter > -Infinity ? bestCounter : gomokuLeafValue(p);
      }
      grid[reply.r][reply.c] = -1;
      searched++;
      if (lineScore < worst) worst = lineScore;
      if (worst <= -GOMOKU_MATE / 2) break;
    }
    grid[root.r][root.c] = -1;
    if (!searched) worst = root.value;
    return worst + root.value * .035;
  }
  function gomokuPersonaBonus(item){
    const id = opts.aiPersona && opts.aiPersona.id;
    if (id === 'gambler') return item.attack.openFour * 24 + item.attack.rushFour * 12 + item.attack.openThree * 5;
    if (id === 'mean') return item.attack.rushFour * 18 + item.attack.openThree * 4;
    if (id === 'tsundere') return item.defense.rushFour * 14 + item.defense.openThree * 4;
    if (id === 'cute') return Math.max(0, 9 - item.center);
    return -item.center * .1;
  }
  function scheduleAI(){
    if (opts.destroyed || aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    const epoch = ++aiEpoch;
    const turn = cur;
    const state = aiState();
    const stateKey = JSON.stringify(state);
    setStatus(t('ai_thinking'));
    setTimeout(async () => {
      if (opts.destroyed || epoch !== aiEpoch || over || cur !== turn || JSON.stringify(aiState()) !== stateKey){
        if (epoch === aiEpoch) aiPending = false;
        return;
      }
      const roots = gomokuRankCandidates(cur, hist.length < 8 ? 18 : 16);
      if (!roots.length){ aiPending = false; return; }
      const deadline = Date.now() + 135;
      roots.forEach(item => { item.searchScore = gomokuSearchMove(item, cur, deadline); });
      roots.sort((a, b) => b.searchScore - a.searchScore || b.tier - a.tier || b.value - a.value || a.r - b.r || a.c - b.c);
      const best = roots[0];
      const band = best.searchScore >= GOMOKU_MATE / 2 ? 1 : Math.max(90, Math.min(2400, Math.abs(best.searchScore) * .04));
      const near = roots.filter(item => item.tier === best.tier && item.searchScore >= best.searchScore - band)
        .slice(0, 8).sort((a, b) => (b.searchScore + gomokuPersonaBonus(b)) - (a.searchScore + gomokuPersonaBonus(a)) || a.r - b.r || a.c - b.c);
      const choices = near.map(item => item.choice);
      const moveByChoice = new Map(near.map(item => [item.choice, [item.r, item.c]]));
      const learningCandidates = near.map(item => ({ choice:item.choice, features:{
        quality:Math.max(-1, Math.min(1, 1 - Math.max(0, best.searchScore - item.searchScore) / Math.max(1, band))),
        tactical_tier:item.tier / 7,
        immediate_win:item.attack.win ? 1 : 0,
        immediate_block:item.defense.win ? 1 : 0,
        own_force:Math.min(1, (item.attack.openFour * 4 + item.attack.rushFour * 2 + item.attack.openThree) / 6),
        opp_force:Math.min(1, (item.defense.openFour * 4 + item.defense.rushFour * 2 + item.defense.openThree) / 6),
        center:Math.max(-1, 1 - item.center / 7),
      } }));
      const remoteChoice = await aiChoose('gomoku', state, choices, opts.aiPersona, learningCandidates);
      if (opts.destroyed || epoch !== aiEpoch || over || cur !== turn || JSON.stringify(aiState()) !== stateKey){
        if (epoch === aiEpoch) aiPending = false;
        return;
      }
      const chosen = moveByChoice.has(remoteChoice) ? remoteChoice : choices[0];
      const gpArr = moveByChoice.get(chosen);
      aiPending = false;
      aiSpeak(opts.aiPersona, 'think');
      if (applyMove(gpArr[0], gpArr[1]) && typeof confirmAIReady === 'function') {
        confirmAIReady('gomoku', chosen);
      }
    }, 550);
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas gomoku-board';
  const artEnabled = gameArtEnabled('gomoku');
  if (artEnabled){
    canvas.classList.add('game-art-v1');
    setAssetCssUrl(canvas, '--game-board-art', gameArtUrl('gomoku', 'board'));
  }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = LOGICAL * dpr; canvas.height = LOGICAL * dpr;
  area.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  function applyPresentation(){
    canvas.dataset.boardTheme = boardTheme;
    canvas.dataset.pieceSkin = cosmetic.default;
    if (boardTheme === 'grass'){
      canvas.classList.remove('game-art-v1');
      canvas.style.backgroundColor = '#86a96b';
      canvas.style.backgroundImage = 'radial-gradient(circle at 20% 15%,rgba(255,255,255,.24),transparent 34%),repeating-linear-gradient(105deg,rgba(35,92,45,.13) 0 2px,transparent 2px 7px),linear-gradient(#9fc17f,#668e57)';
    } else {
      if (artEnabled) canvas.classList.add('game-art-v1');
      canvas.style.backgroundColor = artEnabled ? '#d7a153' : '#e6c58b';
      if (!artEnabled) canvas.style.backgroundImage = 'linear-gradient(100deg,rgba(105,63,22,.12),transparent 35%,rgba(105,63,22,.08))';
    }
  }
  function draw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LOGICAL, LOGICAL);
    ctx.strokeStyle = boardTheme === 'grass' ? 'rgba(30,61,31,.72)' : (artEnabled ? 'rgba(76,43,15,.68)' : '#8a6638'); ctx.lineWidth = 1;
    for (let i=0;i<N;i++){
      ctx.beginPath(); ctx.moveTo(PAD + i*CELL, PAD); ctx.lineTo(PAD + i*CELL, PAD + (N-1)*CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD, PAD + i*CELL); ctx.lineTo(PAD + (N-1)*CELL, PAD + i*CELL); ctx.stroke();
    }
    ctx.fillStyle = artEnabled ? '#5b3615' : '#1d2433';
    for (const [r,c] of [[3,3],[3,11],[7,7],[11,3],[11,11]]){
      ctx.beginPath(); ctx.arc(PAD + c*CELL, PAD + r*CELL, 3, 0, Math.PI*2); ctx.fill();
    }
    for (let r=0;r<N;r++) for (let c=0;c<N;c++){
      if (grid[r][c] === -1) continue;
      const x = PAD + c*CELL, y = PAD + r*CELL;
      const skin = pieceSkin(grid[r][c]);
      const stone = ctx.createRadialGradient(x-CELL*.14, y-CELL*.16, CELL*.05, x, y, CELL*.44);
      if (stone && stone.addColorStop){
        if (grid[r][c] === 0){
          stone.addColorStop(0, skin === 'glow' ? '#7dd3fc' : '#586172'); stone.addColorStop(.32, skin === 'glow' ? '#1d4ed8' : '#202733'); stone.addColorStop(1, '#05070b');
        } else {
          stone.addColorStop(0, '#ffffff'); stone.addColorStop(.52, skin === 'glow' ? '#f0abfc' : '#f3efe4'); stone.addColorStop(1, skin === 'glow' ? '#9333ea' : '#c8c0af');
        }
      }
      ctx.save();
      ctx.shadowColor = 'rgba(8,12,22,.32)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
      ctx.fillStyle = stone || PLAYER_COLORS[grid[r][c]];
      ctx.beginPath(); ctx.arc(x, y, CELL*0.42, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = grid[r][c] === 0 ? 'rgba(255,255,255,.18)' : 'rgba(92,76,52,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, CELL*0.39, 0, Math.PI*2); ctx.stroke();
    }
    if (last){
      ctx.strokeStyle = grid[last[0]][last[1]] === 1 ? '#111827' : '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(PAD + last[1]*CELL, PAD + last[0]*CELL, CELL*0.18, 0, Math.PI*2); ctx.stroke();
    }
    if (ghost && !spectator && !over && grid[ghost[0]][ghost[1]] === -1){
      ctx.save(); ctx.globalAlpha = .36; ctx.fillStyle = cur === 0 ? '#111827' : '#f8fafc';
      ctx.beginPath(); ctx.arc(PAD + ghost[1]*CELL, PAD + ghost[0]*CELL, CELL*.4, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
    if (winLine.length){
      const first = winLine[0], end = winLine[winLine.length - 1];
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(PAD + first[1]*CELL, PAD + first[0]*CELL); ctx.lineTo(PAD + end[1]*CELL, PAD + end[0]*CELL); ctx.stroke();
    }
    updateHud();
  }
  function pointerCell(e){
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * LOGICAL;
    const y = (e.clientY - rect.top) / rect.height * LOGICAL;
    return [Math.round((y - PAD) / CELL), Math.round((x - PAD) / CELL)];
  }
  canvas.addEventListener('mousemove', e => {
    if (spectator || over || (opts.online && cur !== opts.myIdx) || (opts.ai && opts.ai.has(cur))) return;
    const [r, c] = pointerCell(e);
    ghost = r >= 0 && r < N && c >= 0 && c < N && grid[r][c] === -1 ? [r, c] : null;
    draw();
  });
  canvas.addEventListener('mouseleave', () => { if (ghost){ ghost = null; draw(); } });
  canvas.addEventListener('click', e => {
    if (over || spectator) return;
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    const [r, c] = pointerCell(e);
    if (r < 0 || r >= N || c < 0 || c >= N) return;
    if (grid[r][c] !== -1) return;
    if (opts.onProgress) opts.onProgress([r, c]);
    if (opts.online) opts.sendMove([r, c]);
    applyMove(r, c);
  });
  function applyMove(r, c){
    if (Array.isArray(r)){ c = r[1]; r = r[0]; }
    r = Number(r); c = Number(c);
    if (over || !Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= N || c < 0 || c >= N || grid[r][c] !== -1) return false;
    aiEpoch++;
    playFeedback('place');
    grid[r][c] = cur; last = [r,c]; hist.push([r,c]);
    if (checkGomokuWin(grid, r, c)){
      over = true; finishedAt = Date.now(); winLine = winningCells(r, c); ghost = null; area.style.touchAction = 'auto';
      if (opts.onEnd) opts.onEnd([
        { slot: cur, coins: 1, rank: 1 },
        { slot: cur ^ 1, coins: 0, rank: 2 },
      ]);
      draw(); renderPlayers(cur, null);
      setStatus(t('result_winner',cur+1), true);
      showVictoryOverlay(area, {
        winner: cur, winnerName: t('player_number',cur+1), emoji: '🎉',
        subtitle: t('gomoku_five_line'), coins: 1, onRestart: reset, onShare: () => shareGameLink('gomoku'), onInvite: online.room && online.isHost ? () => openInvitePicker() : null
      });
      return true;
    }
    if (hist.length === N*N){
      over = true; finishedAt = Date.now(); ghost = null; area.style.touchAction = 'auto';
      if (opts.onEnd) opts.onEnd([
        { slot: 0, coins: 0, rank: 1 },
        { slot: 1, coins: 0, rank: 1 },
      ]);
      draw(); renderPlayers(cur, null);
      setStatus(t('result_draw'), false);
      showVictoryOverlay(area, {
        winner: 0, emoji: '🤝', subtitle: t('gomoku_board_full_draw'), coins: 0, onRestart: reset, onShare: () => shareGameLink('gomoku')
      });
      return true;
    }
    cur ^= 1;
    draw(); renderPlayers(cur, null);
    setStatus(opts.online ? t(cur === opts.myIdx ? 'gomoku_your_turn_hint' : 'gomoku_wait_opponent') : t('player_turn',cur+1));
    scheduleAI();
    return true;
  }
  opts.onMove = (payload, player) => {
    if (opts.online && (!Number.isInteger(player) || player !== cur)) return;
    if (Array.isArray(payload) && payload.length === 2) applyMove(payload);
  };
  if (!opts.online && !spectator){
    const undoBtn = el('button','btn',t('undo'));
    undoBtn.addEventListener('click', () => {
      if (spectator || over || !hist.length) return;
      aiEpoch++; aiPending = false;
      const [r,c] = hist.pop();
      grid[r][c] = -1;
      cur ^= 1;
      last = hist.length ? hist[hist.length-1] : null;
      draw(); renderPlayers(cur, null);
      setStatus(t('player_turn',cur+1));
      scheduleAI();
    });
    extra.appendChild(undoBtn);
  }
  function resetLocal(){
    aiEpoch++;
    grid = Array.from({length:N}, () => Array(N).fill(-1));
    cur = 0; over = false; hist = []; last = null; winLine = []; ghost = null; aiPending = false; startedAt = Date.now(); finishedAt = 0;
    area.style.touchAction = spectator ? 'auto' : 'none';
    applyPresentation();
    draw(); renderPlayers(0, null);
    setStatus(opts.online ? t(cur === opts.myIdx ? 'gomoku_your_turn_hint' : 'gomoku_wait_opponent') : t('player_turn',1));
  }
  function reset(){
    if (opts.online && !opts.isHost){ toast(t('host_only_restart')); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  function setBoardTheme(theme){ boardTheme = theme === 'grass' ? 'grass' : 'classic'; applyPresentation(); draw(); return boardTheme; }
  function setCosmetic(value){ cosmetic = normalizeCosmetic(value); draw(); return { default:cosmetic.default, players:{...cosmetic.players} }; }
  function setSpectators(value){ spectator = Array.isArray(value) ? value.includes(opts.viewerId) : !!value; spectators = Array.isArray(value) ? value.slice() : spectators; area.style.touchAction = spectator || over ? 'auto' : 'none'; ghost = null; draw(); return spectator; }
  function startMatch(playerA, playerB){ activePlayers = [playerA, playerB]; resetLocal(); return { activePlayers: activePlayers.slice(), spectators: spectators.slice() }; }
  function getMatchStats(){ return { duration: Math.max(0, (finishedAt || Date.now()) - startedAt), moves: hist.length, winner: over && winLine.length ? cur : null }; }
  function reportGameResult(){ const stats = getMatchStats(); if (typeof opts.reportGameResult === 'function') opts.reportGameResult(stats); return stats; }
  function snapshot(){ return { hist: hist.map(h => h.slice()), cur, over, last: last ? last.slice() : null }; }
  function onRestore(value){
    const state = value && value.state ? value.state : value;
    if (!state || !Array.isArray(state.hist)) return false;
    grid = Array.from({length:N}, () => Array(N).fill(-1)); hist = [];
    state.hist.forEach((move, index) => { if (Array.isArray(move) && move.length === 2 && grid[move[0]] && grid[move[0]][move[1]] === -1){ grid[move[0]][move[1]] = index % 2; hist.push([move[0], move[1]]); } });
    cur = Number(state.cur) === 1 ? 1 : 0; over = !!state.over; last = Array.isArray(state.last) ? state.last.slice(0, 2) : (hist.length ? hist[hist.length - 1].slice() : null);
    winLine = over && last ? winningCells(last[0], last[1]) : [];
    if (value && value.presentation){ boardTheme = value.presentation.boardTheme === 'grass' ? 'grass' : 'classic'; cosmetic = normalizeCosmetic(value.presentation.cosmetic); }
    applyPresentation(); draw(); renderPlayers(cur, null); return true;
  }
  resetLocal();
  return {
    reset, onMove: opts.onMove, onRestart: resetLocal, snapshot, onRestore,
    serialize: () => ({ state: snapshot(), presentation: { boardTheme, cosmetic:{default:cosmetic.default,players:{...cosmetic.players}} }, stats: getMatchStats() }),
    setBoardTheme, setCosmetic, renderCosmetic: setCosmetic, setSpectators, startMatch, reportGameResult, getMatchStats,
    destroy: () => { aiEpoch++; aiPending = false; area.style.touchAction = previousTouchAction; area.style.overscrollBehavior = previousOverscroll; },
  };
}
