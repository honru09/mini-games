/* ================= 游戏注册表 ================= */
const games = {
  gomoku: gameGomoku,
  ludo: gameLudo,
  monopoly: gameMonopoly,
  tank: gameTank,
  tetris: gameTetris,
  xiangqi: gameXiangqi,
};

autoRegisterGames();

if (typeof module !== 'undefined' && module.exports){
  module.exports = { checkGomokuWin };
}

if (typeof document !== 'undefined'){
  initAssetFallbacks();
  loadRoster();
  renderMe();
  renderSlots();
  renderLeaderboard();
  renderLobby();
  renderAccounts();
  renderHub();
  if (typeof parseHash === 'function') parseHash();
  online.connect();
  setTimeout(() => { if (!account) openAuthModal(); }, 300);
}
