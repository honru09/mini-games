/* ================= 游戏注册表 ================= */
const games = {
  tictactoe: gameTicTacToe,
  gomoku: gameGomoku,
  ludo: gameLudo,
  monopoly: gameMonopoly,
  checker: gameChecker,
  tank: gameTank,
  snake: gameSnake,
  tetris: gameTetris,
  draughts: gameDraughts,
  jungle: gameJungle,
  xiangqi: gameXiangqi,
};

autoRegisterGames();

if (typeof module !== 'undefined' && module.exports){
  module.exports = { makeCheckerBoard, checkerReachable, checkGomokuWin };
}

if (typeof document !== 'undefined'){
  loadRoster();
  renderMe();
  renderSlots();
  renderLeaderboard();
  renderLobby();
  renderAccounts();
  renderHub();
  if (typeof parseHash === 'function') parseHash();
  });
  online.connect();
  setTimeout(() => { if (!account) openAuthModal(); }, 300);
}
