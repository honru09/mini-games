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
  if (typeof initUnifiedAudioRuntime === 'function') initUnifiedAudioRuntime();
  initAssetFallbacks();
  initStaticPlatformIcons();
  if (typeof initAuthArtRuntime === 'function') initAuthArtRuntime();
  loadRoster();
  renderMe();
  renderLeaderboard();
  renderLobby();
  renderAccounts();
  if (typeof initSocialRail === 'function') initSocialRail();
  if (typeof renderSocialRail === 'function') renderSocialRail();
  renderHub();
  if (typeof parseHash === 'function') parseHash();
  online.connect();
}
