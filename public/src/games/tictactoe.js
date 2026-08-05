/* ================= 井字棋 ================= */
function gameTicTacToe(area, extra, n, opts){
  opts = opts || {};
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  let board = Array(9).fill(null), cur = 0, over = false, winLine = null;
  let aiPending = false;
  function tttScore(bd, turn){
    for (const L of LINES){
      if (bd[L[0]] !== null && bd[L[0]] === bd[L[1]] && bd[L[1]] === bd[L[2]]){
        return bd[L[0]] === 0 ? 10 : -10;
      }
    }
    if (bd.every(v => v !== null)) return 0;
    if (turn === 0){
      let best = -Infinity;
      for (let i = 0; i < 9; i++){
        if (bd[i] === null){ bd[i] = 0; best = Math.max(best, tttScore(bd, 1)); bd[i] = null; }
      }
      return best;
    }
    let best = Infinity;
    for (let i = 0; i < 9; i++){
      if (bd[i] === null){ bd[i] = 1; best = Math.min(best, tttScore(bd, 0)); bd[i] = null; }
    }
    return best;
  }
  function scheduleAI(){
    if (aiPending || over) return;
    if (!opts.ai || !opts.ai.has(cur)) return;
    aiPending = true;
    setTimeout(() => {
      aiPending = false;
      if (over) return;
      const legal = [];
      for (let i = 0; i < 9; i++) if (board[i] === null) legal.push(String(i));
      if (!legal.length) return;
      // 完美走法：minimax（AI 永不输）
      let bestI = -1, bestV = -Infinity;
      for (const s of legal){
        const i = Number(s);
        board[i] = cur;
        const v = tttScore(board, cur ^ 1);
        board[i] = null;
        if (v > bestV){ bestV = v; bestI = i; }
      }
      applyMove(bestI);
    }, 500);
  }
  function render(){
    area.innerHTML = '';
    const grid = el('div','ttt-grid');
    for (let i=0;i<9;i++){
      const b = el('button','ttt-cell');
      b.setAttribute('aria-label','格子 ' + (i+1));
      b.style.color = board[i] === 0 ? PLAYER_COLORS[0] : PLAYER_COLORS[1];
      if (board[i] === 0) b.textContent = '✕';
      if (board[i] === 1) b.textContent = '◯';
      if (winLine && winLine.includes(i)) b.classList.add('win');
      if (!over && board[i] === null){
        b.addEventListener('click', () => move(i));
      } else {
        b.disabled = true;
      }
      grid.appendChild(b);
    }
    area.appendChild(grid);
    renderPlayers(cur, null);
    if (over){
      setStatus(winLine ? ('🏆 玩家' + (cur+1) + ' 获胜！') : t('result_draw'), !!winLine);
      if (winLine) {
        showVictoryOverlay(area, {
          winner: cur, winnerName: '玩家' + (cur+1), emoji: '🎉',
          subtitle: '三子连线', coins: 1, onRestart: resetLocal, onShare: () => shareGameLink('tictactoe'), onInvite: online.room && online.isHost ? () => openInvitePicker() : null
        });
      } else {
        showVictoryOverlay(area, {
          winner: 0, emoji: '🤝', subtitle: '平局，无人获胜', coins: 0, onRestart: resetLocal, onShare: () => shareGameLink('tictactoe')
        });
      }
    } else {
      setStatus(opts.online ? (cur === opts.myIdx ? t('your_turn') + '，点击空格落子' : t('opponent_turn') + '…') : ('玩家' + (cur+1) + ' 的回合'));
    }
  }
  function applyMove(i){
    board[i] = cur;
    for (const L of LINES){
      if (L.includes(i) && board[L[0]] !== null && board[L[0]] === board[L[1]] && board[L[1]] === board[L[2]]){
        winLine = L; over = true;
        if (opts.onEnd) opts.onEnd([
          { slot: cur, coins: 1, rank: 1 },
          { slot: cur ^ 1, coins: 0, rank: 2 },
        ]);
        render(); return;
      }
    }
    if (board.every(v => v !== null)){
      over = true;
      if (opts.onEnd) opts.onEnd([
        { slot: 0, coins: 0, rank: 1 },
        { slot: 1, coins: 0, rank: 1 },
      ]);
    } else {
      cur ^= 1;
    }
    render();
    scheduleAI();
  }
  opts.onMove = applyMove;
  function move(i){
    if (opts.online && cur !== opts.myIdx) return;
    if (opts.ai && opts.ai.has(cur)) return;
    if (opts.online) opts.sendMove(i);
    applyMove(i);
  }
  function resetLocal(){ board = Array(9).fill(null); cur = 0; over = false; winLine = null; aiPending = false; render(); }
  function reset(){
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online) opts.sendRestart();
    resetLocal();
  }
  render();
  return { reset, onMove: opts.onMove, onRestart: resetLocal, snapshot: () => ({ board: board.slice(), cur, over, winLine: winLine ? winLine.slice() : null }) };
}
