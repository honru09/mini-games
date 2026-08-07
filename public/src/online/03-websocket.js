/* ================= 联机对战（WebSocket 中继） ================= */
const online = {
  ws: null, room: null, player: 0, isHost: false, game: null, connected: false, pending: null, roomInfo: null, capacity: 2, _hb: null,
  lobby: [], inviteTarget: null, matchId: null, reportedMatchIds: [], soloReportedIds: [], legacyResultSubmitted: false,
  resume: null, _reconnectTimer: null, _reconnectAttempts: 0, _manualClose: false, _replaying: false, _liveMoveQueue: [],
  pendingResultClaim: null, _resultRetryTimer: null, _authenticated: false,
  defaultServer: 'https://mini-games-online.onrender.com',
  connect(){
    if (this.connected || (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1))) return;
    let wsUrl;
    try {
      const raw = resolveServer();
      if (raw){
        const u = raw.replace(/\/+$/, '');
        wsUrl = (u.startsWith('https') ? 'wss://' : 'ws://') + u.replace(/^https?:\/\//, '') + '/ws';
      } else {
        wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      }
    } catch {
      wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    }
    const ws = new WebSocket(wsUrl);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.connected = true;
      this._authenticated = false;
      this.status('已连接服务器，可创建或加入房间');
      const authAccount = typeof account !== 'undefined' ? account : null;
      const authPin = typeof pendingAuthPin !== 'undefined' ? pendingAuthPin : null;
      this.send({ type: 'hello', payload: {
        uid: authAccount && authAccount.uid ? authAccount.uid : (typeof deviceUid !== 'undefined' ? deviceUid : null),
        token: authAccount && authAccount.authToken ? authAccount.authToken : null,
        proto: typeof PROTOCOL_VERSION !== 'undefined' ? PROTOCOL_VERSION : 1,
      } });
      this.send({ type: 'lobby' });
      const needsRegister = authAccount && authAccount.uid && authPin && authAccount.registered === false;
      const needsLogin = authAccount && authAccount.uid && authPin && !authAccount.authToken && authAccount.registered !== false;
      if (needsRegister){
        this.send({ type: 'register', payload: {
          uid: authAccount.uid, pin: authPin, name: authAccount.name, avatar: authAccount.avatar,
          background: authAccount.background, frame: authAccount.frame, effect: authAccount.effect, owned: authAccount.owned, nameFx: authAccount.nameFx || 0,
        } });
      } else if (needsLogin){
        this.send({ type: 'login', payload: { pin: authPin } });
      } else if (typeof syncProfiles === 'function') {
        syncProfiles();
      }
      if (this._hb) clearInterval(this._hb);
      this._hb = setInterval(() => { if (this.connected) this.send({ type: 'ping' }); }, 10000);
      if (this.resume){
        const expectedRoom = this.resume.room;
        setTimeout(() => {
          if (this.connected && this.resume && this.resume.room === expectedRoom && !this.room){
            this.clearResume();
            this.status(t('room_resume_missing'));
          }
        }, 1500);
      }
      if (this.pending){
        const p = this.pending;
        this.pending = null;
        if (p.type === 'create') this.create();
        else if (p.type === 'join') this.join(p.room);
      }
    };
    ws.onmessage = e => { if (this.ws === ws) this.onMessage(JSON.parse(e.data)); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      const shouldResume = !this._manualClose && !!(account && account.authToken) && !!(this.room || this.resume);
      if (this.room){
        this.resume = {
          room: this.room, player: this.player, isHost: this.isHost, game: this.game,
          matchId: this.matchId, deadline: Date.now() + 60000,
        };
      }
      this.connected = false;
      this._authenticated = false;
      this.ws = null;
      if (this._hb){ clearInterval(this._hb); this._hb = null; }
      this.status(shouldResume ? t('online_reconnecting') : '连接已断开');
      this.resetState(shouldResume);
      if (shouldResume) this.scheduleReconnect();
      this._manualClose = false;
    };
    ws.onerror = () => { if (this.ws === ws) this.status(this.resume ? t('online_reconnecting') : '连接失败，请确认服务已启动'); };
  },
  scheduleReconnect(){
    if (!this.resume || !account || !account.authToken) return;
    if (this.resume.deadline && Date.now() >= this.resume.deadline){
      this.clearResume();
      this.status(t('reconnect_timeout'));
      return;
    }
    if (this._reconnectTimer || this.connected || (this.ws && this.ws.readyState === 0)) return;
    const delay = Math.min(5000, 500 * Math.pow(2, Math.min(4, this._reconnectAttempts++)));
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, delay);
  },
  clearResume(){
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this.resume = null;
  },
  loadPendingResultClaim(){
    if (this.pendingResultClaim || !account || !account.uid) return this.pendingResultClaim;
    try {
      const saved = JSON.parse(localStorage.getItem('mg_pending_result_claim') || 'null');
      if (saved && saved.uid === account.uid && saved.matchId && saved.game && Array.isArray(saved.results)){
        this.pendingResultClaim = saved;
      } else if (saved) {
        localStorage.removeItem('mg_pending_result_claim');
      }
    } catch {
      try { localStorage.removeItem('mg_pending_result_claim'); } catch {}
    }
    return this.pendingResultClaim;
  },
  savePendingResultClaim(){
    try {
      if (this.pendingResultClaim) localStorage.setItem('mg_pending_result_claim', JSON.stringify(this.pendingResultClaim));
      else localStorage.removeItem('mg_pending_result_claim');
    } catch {}
  },
  clearPendingResultClaim(matchId){
    if (matchId && this.pendingResultClaim && String(this.pendingResultClaim.matchId) !== String(matchId)) return;
    if (this._resultRetryTimer) clearTimeout(this._resultRetryTimer);
    this._resultRetryTimer = null;
    this.pendingResultClaim = null;
    this.savePendingResultClaim();
  },
  submitResultClaim(claim){
    if (!claim || !claim.matchId || !claim.game || !Array.isArray(claim.results)) return;
    if (this.pendingResultClaim && String(this.pendingResultClaim.matchId) === String(claim.matchId)){
      this.flushPendingResultClaim();
      return;
    }
    this.clearPendingResultClaim();
    this.pendingResultClaim = {
      uid: account && account.uid,
      matchId: String(claim.matchId),
      game: String(claim.game),
      results: claim.results,
      won: !!claim.won,
      createdAt: Date.now(),
    };
    this.savePendingResultClaim();
    this.flushPendingResultClaim();
  },
  scheduleResultRetry(){
    if (!this.pendingResultClaim || this._resultRetryTimer) return;
    this._resultRetryTimer = setTimeout(() => {
      this._resultRetryTimer = null;
      this.flushPendingResultClaim();
    }, 3000);
  },
  flushPendingResultClaim(){
    const claim = this.pendingResultClaim || this.loadPendingResultClaim();
    if (!claim) return;
    if (!account || claim.uid !== account.uid){ this.clearPendingResultClaim(); return; }
    if (Date.now() - Number(claim.createdAt || 0) > 10 * 60 * 1000){ this.clearPendingResultClaim(); return; }
    if (!this.connected || !this._authenticated || !this.room || String(this.matchId || '') !== String(claim.matchId)){
      this.scheduleResultRetry();
      return;
    }
    this.send({ type: 'result', payload: {
      matchId: claim.matchId,
      game: claim.game,
      results: claim.results,
    } });
    this.scheduleResultRetry();
  },
  async replayMoveLog(log){
    const replayGame = currentGame;
    const gameScreen = $('screen-game');
    const oldInert = gameScreen ? !!gameScreen.inert : false;
    this._replaying = true;
    this._liveMoveQueue = [];
    if (gameScreen){ gameScreen.inert = true; gameScreen.setAttribute('aria-busy', 'true'); }
    this.status(t('online_restoring'));
    try {
      const events = Array.isArray(log) ? log.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0)) : [];
      for (const event of events){
        if (!this.game || currentGame !== replayGame || !replayGame || !replayGame.onMove) break;
        replayGame.onMove(event && event.payload, event && event.player);
        const raw = replayGame._raw || replayGame;
        if (raw && typeof raw.whenIdle === 'function') await raw.whenIdle();
        else {
          const p = event && event.payload || {};
          const delay = p.roll ? 1250 : (p.decision ? 650 : 90);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } finally {
      try {
        while (currentGame === replayGame && replayGame && replayGame.onMove && this._liveMoveQueue.length){
          const event = this._liveMoveQueue.shift() || {};
          const payload = event.payload;
          replayGame.onMove(payload, event.player);
          const raw = replayGame._raw || replayGame;
          if (raw && typeof raw.whenIdle === 'function') await raw.whenIdle();
        }
      } finally {
        this._replaying = false;
        if (gameScreen){
          gameScreen.inert = oldInert;
          if (typeof gameScreen.removeAttribute === 'function') gameScreen.removeAttribute('aria-busy');
          else gameScreen.setAttribute('aria-busy', 'false');
        }
        if (this.room && currentGame === replayGame) this.status(t('online_restored', this.room));
      }
    }
  },
  status(text, trustedHtml){
    const node = $('online-status');
    if (trustedHtml) node.innerHTML = text;
    else { node.innerHTML = ''; node.textContent = String(text || ''); }
  },
  send(msg){ if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); },
  create(){
    if (!account){ toast('请先创建账号或登录后再联机'); openAuthModal(); return; }
    if (this.connected){
      this.send({type:'create', payload:{ capacity: playerCount }});
      this.status('正在创建房间…');
    } else {
      this.pending = { type:'create' };
      this.connect();
      this.status('正在连接服务器…');
    }
  },
  join(code){
    if (!account){ toast('请先创建账号或登录后再联机'); openAuthModal(); return; }
    code = String(code || '').trim().toUpperCase();
    if (code.length < 4){ toast('请输入房间码'); return; }
    if (this.connected){
      this.send({type:'join', payload:{room:code}});
      this.status('正在加入房间 ' + code + ' …');
    } else {
      this.pending = { type:'join', room:code };
      this.connect();
      this.status('正在连接服务器…');
    }
  },
  selectGame(id){ this.send({ type:'select_game', payload:{ game:id } }); },
  sendMove(payload){ this.send({type:'move', payload}); },
  sendRestart(){ this.send({type:'restart'}); },
  onMessage(msg){
    switch (msg.type){
      case 'created':
        msg.room = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        this.room = msg.room; this.player = msg.player; this.isHost = true;
        this.capacity = msg.capacity || 2;
        this.roomInfo = { room: msg.room, game: null, capacity: this.capacity, players: [{ uid: null, player: 0 }], size: 1, started: false };
        this.status('房间已创建：<span class="room-code">' + msg.room + '</span>，等待对方加入…', true);
        renderRoomPanel();
        if (this.inviteTarget){
          const toUid = this.inviteTarget;
          this.inviteTarget = null;
          this.send({ type: 'invite', payload: { toUid } });
          toast('邀请已发送');
        }
        break;
      case 'joined':
        msg.room = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        this.room = msg.room; this.player = msg.player; this.isHost = false;
        this.roomInfo = { room: msg.room, game: null, capacity: 2, players: [{ uid: null, player: 0 }], size: 1, started: false };
        this.status('已加入房间 <span class="room-code">' + msg.room + '</span>，等待房主开始…', true);
        renderRoomPanel();
        break;
      case 'room_update':
        this.roomInfo = msg.payload;
        this.capacity = msg.payload.capacity || this.capacity;
        if (!this.isHost && !this.room) this.room = msg.payload.room;
        if (this.game && !msg.payload.game && !msg.payload.started){
          finishRoomGame();
          return;
        }
        renderRoomPanel();
        break;
      case 'lobby':
        this.lobby = msg.payload || [];
        renderLobby();
        break;
      case 'hello_ack':
        this._authenticated = !!msg.authenticated;
        if (msg.authenticated){
          if (!this.resume) this._reconnectAttempts = 0;
          this.loadPendingResultClaim();
          this.flushPendingResultClaim();
        } else if (account && account.authToken){
          toast('登录会话已失效，请使用 PIN 重新登录');
          if (typeof completeLocalLogout === 'function') completeLocalLogout(true);
        }
        break;
      case 'rejoined':
        {
          const p = msg.payload || {};
          this.room = p.room;
          this.player = Number.isInteger(p.player) ? p.player : 0;
          this.isHost = !!p.isHost;
          this.capacity = p.capacity || 2;
          this.matchId = p.matchId || null;
          this.roomInfo = {
            room: p.room, game: p.game || null, capacity: this.capacity,
            players: p.players || [], size: p.size || 1, onlineSize: p.onlineSize || 1,
            started: !!p.started, matchId: p.matchId || null,
          };
          this.game = p.started ? (p.game || null) : null;
          this.clearResume();
          renderRoomPanel();
          if (this.game){
            startOnlineGame(this.game, p.size);
            this.replayMoveLog(p.moveLog || []);
          } else {
            this.status(t('room_restored', this.room));
          }
          this.flushPendingResultClaim();
        }
        break;
      case 'resume_expired':
        this.clearResume();
        this.resetState();
        this.status(t('reconnect_timeout'));
        toast(t('reconnect_seat_released'));
        break;
      case 'peer_status':
        {
          const p = msg.payload || {};
          if (p.online) this.status(t('reconnect_peer_back', (p.player || 0) + 1));
          else this.status(t('reconnect_peer_wait', (p.player || 0) + 1));
        }
        break;
      case 'reconnect_expired':
        this.clearPendingResultClaim(this.matchId);
        this.game = null;
        this.matchId = null;
        if (currentGameId) showHub();
        this.status(t('reconnect_match_ended'));
        toast(t('reconnect_expired'));
        renderRoomPanel();
        break;
      case 'host_changed':
        {
          const p = msg.payload || {};
          this.isHost = Number(p.player) === Number(this.player);
          if (this.isHost) toast(t('host_transferred'));
          renderRoomPanel();
        }
        break;
      case 'player_reassigned':
        {
          const p = msg.payload || {};
          if (Number.isInteger(p.player)) this.player = p.player;
          renderRoomPanel();
        }
        break;
      case 'invite':
        showInviteModal(msg.payload);
        break;
      case 'invite_result':
        toast(msg.payload && msg.payload.accepted ? '对方已接受邀请 🎉' : '对方拒绝了邀请');
        break;
      case 'started':
        {
          const started = msg.payload || msg;
          this.game = msg.game || started.game;
          this.matchId = msg.matchId || started.matchId || null;
          this.legacyResultSubmitted = false;
          if (this.pendingResultClaim && String(this.pendingResultClaim.matchId) !== String(this.matchId || '')) this.clearPendingResultClaim();
          startOnlineGame(this.game, msg.size || started.size);
        }
        break;
      case 'move':
        if (this._replaying) this._liveMoveQueue.push({ payload: msg.payload, player: msg.player });
        else if (this.game && currentGame && currentGame.onMove) currentGame.onMove(msg.payload, msg.player);
        break;
      case 'restart':
        {
          const restarted = msg.payload || msg;
          this.matchId = msg.matchId || restarted.matchId || null;
          this.legacyResultSubmitted = false;
          if (this.pendingResultClaim && String(this.pendingResultClaim.matchId) !== String(this.matchId || '')) this.clearPendingResultClaim();
        }
        runCountdown();
        if (currentGame && currentGame.onRestart) currentGame.onRestart();
        else if (this.game) startOnlineGame(this.game);
        break;
      case 'end_game':
        finishRoomGame();
        break;
      case 'peer_left':
        if (msg.payload && msg.payload.roomClosed === false){
          const departed = Number(msg.payload.player);
          this.clearPendingResultClaim(this.matchId);
          this.game = null;
          this.matchId = null;
          toast(t('peer_left_match'));
          if (currentGameId) showHub();
          this.status(t('peer_left_waiting', Number.isInteger(departed) ? departed + 1 : '?'));
          renderRoomPanel();
        } else if (msg.payload && msg.payload.roomClosed === true){
          toast(t('host_closed_room'));
          this.resetState();
          this.status(t('room_closed_rejoin'));
        } else if (this.isHost){
          // 兼容旧服务端：旧版只把非房主离开通知给房主。
          this.clearPendingResultClaim(this.matchId);
          this.game = null;
          this.matchId = null;
          toast(t('peer_left_match'));
          if (currentGameId) showHub();
          this.status(t('peer_left_waiting', '?'));
          renderRoomPanel();
        } else {
          toast(t('host_closed_room'));
          this.resetState();
          this.status(t('room_closed_rejoin'));
        }
        break;
      case 'error':
        this.status(msg.msg || '出错了');
        toast(msg.msg || '出错了');
        break;
      case 'leaderboard':
        lastServerLB = msg.payload;
        renderLeaderboard();
        break;
      case 'profile_ok':
        {
          const profile = msg.payload && (msg.payload.profile || msg.payload);
          if (profile && account && profile.uid === account.uid){
            updateAccountProfile(profile);
            renderMe(); renderSlots();
          }
        }
        break;
      case 'registered':
        {
          const payload = msg.payload || {};
          const profile = payload.profile || msg.profile || (payload.uid && (payload.name !== undefined || payload.avatar !== undefined) ? payload : null);
          const uid = payload.uid || (profile && profile.uid);
          if (account && uid){
            const token = msg.token || payload.token;
            if (token){ account.authToken = token; delete account.pin; }
            account.uid = uid;
            deviceUid = uid;
            account.registered = true;
            if (typeof pendingAuthPin !== 'undefined') pendingAuthPin = null;
            this._authenticated = true;
            if (profile) updateAccountProfile(profile);
            else saveAccount();
            this.loadPendingResultClaim();
            this.flushPendingResultClaim();
            if (typeof syncProfiles === 'function') syncProfiles();
            renderMyCard();
            toast('🎉 账号创建成功，欢迎 ' + account.name);
            if (authModalEl){ authModalEl.remove(); authModalEl = null; }
          }
        }
        break;
      case 'logged_in':
        {
          const payload = msg.payload || {};
          const profile = payload.profile || msg.profile || (payload.uid && (payload.name !== undefined || payload.avatar !== undefined) ? payload : null);
          const uid = payload.uid || (profile && profile.uid);
          if (profile && uid){
            const token = msg.token || payload.token;
            account = Object.assign({}, profile, { device: deviceFingerprint(), registered: true });
            if (token){ account.authToken = token; delete account.pin; }
            this._authenticated = true;
            updateAccountProfile(profile);
            this.loadPendingResultClaim();
            this.flushPendingResultClaim();
            if (typeof syncProfiles === 'function') syncProfiles();
            renderMyCard();
            toast('✅ 登录成功：' + account.name);
            if (authModalEl){ authModalEl.remove(); authModalEl = null; }
          }
        }
        break;
      case 'auth_error':
        toast(msg.msg || '账号验证失败');
        if (account && account.registered === false){
          if (typeof completeLocalLogout === 'function') completeLocalLogout(false);
          if (typeof openAuthModal === 'function' && !authModalEl) openAuthModal('register');
        }
        break;
      case 'logged_out':
        if (typeof completeLocalLogout === 'function') completeLocalLogout(true);
        else this.resetState();
        break;
      case 'profile_data':
        if (msg.payload){
          renderProfilePopup(msg.payload, false);
        }
        break;
      case 'purchase_ok':
        {
          const payload = msg.payload || {};
          const profile = payload.profile || msg.profile || (payload.uid && (payload.name !== undefined || payload.avatar !== undefined || payload.coins !== undefined) ? payload : null);
          if (profile && account && profile.uid === account.uid) updateAccountProfile(profile);
          if (typeof refreshOpenShop === 'function') refreshOpenShop();
          if (typeof renderMe === 'function') renderMe();
          if (typeof renderSlots === 'function') renderSlots();
          if (typeof renderMyCard === 'function') renderMyCard();
          toast(payload.msg || msg.msg || t('purchase_success'));
        }
        break;
      case 'purchase_error':
        toast((msg.payload && msg.payload.msg) || msg.msg || t('purchase_failed'));
        if (typeof refreshOpenShop === 'function') refreshOpenShop();
        break;
      case 'result_ok':
        {
          const payload = msg.payload || {};
          const resultMatchId = msg.matchId || payload.matchId || null;
          const pendingClaim = this.pendingResultClaim;
          const profile = payload.profile || msg.profile || (payload.uid && (payload.name !== undefined || payload.avatar !== undefined || payload.coins !== undefined) ? payload : null);
          if (profile && account && profile.uid === account.uid){
            updateAccountProfile(profile);
            if (typeof renderMe === 'function') renderMe();
            if (typeof renderSlots === 'function') renderSlots();
            if (typeof renderLeaderboard === 'function') renderLeaderboard();
          }
          if (pendingClaim && resultMatchId && String(pendingClaim.matchId) === String(resultMatchId)){
            const resultName = account && account.name ? account.name : '玩家';
            toast(t('toast_win_reward') + (pendingClaim.won ? resultName + ' 获得 $1' : resultName + ' 本局无奖励'));
            this.clearPendingResultClaim(resultMatchId);
          }
        }
        break;
      case 'result_pending':
        // 等待房间内其他客户端提交同一份完整结果。
        this.scheduleResultRetry();
        break;
      case 'result_error':
        {
          const errorMatchId = msg.matchId || (msg.payload && msg.payload.matchId);
          if (errorMatchId) this.clearPendingResultClaim(errorMatchId);
          else if (this.pendingResultClaim && this.room && String(this.matchId || '') === String(this.pendingResultClaim.matchId)) this.clearPendingResultClaim();
        }
        toast(msg.msg || (msg.payload && msg.payload.msg) || t('result_failed'));
        break;
    }
  },
  resetState(preserveResume){
    if (!preserveResume) this.clearResume();
    if (!preserveResume) this.clearPendingResultClaim();
    this.room = null; this.game = null; this.isHost = false; this.pending = null; this.roomInfo = null; this.capacity = 2; this.inviteTarget = null;
    this.matchId = null; this.legacyResultSubmitted = false;
    $('online-banner').classList.add('hidden');
    $('room-panel').classList.add('hidden');
    const endBtn = $('btn-end-game');
    if (endBtn) endBtn.classList.add('hidden');
    if (currentGameId) showHub();
  },
};
function resolveServer(){
  try {
    const raw = (localStorage.getItem('mg_server') || '').trim();
    if (raw) return raw;
  } catch {}
  const h = (typeof location !== 'undefined' && location.hostname) || '';
  if (!h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return '';
  return online.defaultServer;
}
function finishRoomGame(){
  online.clearPendingResultClaim(online.matchId);
  online.game = null;
  online.matchId = null;
  online.legacyResultSubmitted = false;
  toast('本局已结束，可以在当前房间切换游戏');
  showHub();
  renderRoomPanel();
}
function startOnlineGame(id, sizeOverride){
  const size = Math.max(2, sizeOverride || (online.roomInfo && online.roomInfo.size) || online.capacity || 2);
  playerCount = size;
  showGame(id);
  const banner = $('online-banner');
  banner.classList.remove('hidden');
  banner.textContent = '房间 ' + online.room + ' · ' + size + ' 人局 · 你是玩家' + (online.player+1) + (online.isHost ? '（房主）' : '');
  runCountdown();
}
function renderRoomPanel(){
  const panel = $('room-panel');
  if (!online.room){
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  $('room-code-big').textContent = online.room;
  const info = online.roomInfo || { size: 1, capacity: 2, players: [], game: null, started: false };
  const cap = info.capacity || 2;
  const names = (info.players || []).map(p => {
    const prof = p.uid ? profileByUid(p.uid) : null;
    return (prof ? prof.name : '玩家' + (p.player + 1)) + (p.uid && p.uid === deviceUid ? '（你）' : '');
  });
  $('room-info').textContent = '人数 ' + (info.size || 1) + '/' + cap + (names.length ? ' · ' + names.join(' vs ') : '') + ' · 游戏：' + (info.game ? GAMES[info.game].name : '未选择');
  let status;
  if (online.game){
    status = '对局进行中…';
  } else if (online.isHost){
    if (info.game){
      if (info.started) status = '对局进行中…';
      else if (info.size >= cap) status = '房间已满，对局即将开始…';
      else if (info.size >= 2) status = '已选择 ' + GAMES[info.game].name + '，可点击「开始游戏」或等人到齐';
      else status = '已选择 ' + GAMES[info.game].name + '，等待其他玩家加入…';
    } else {
      status = info.size >= 2 ? '玩家已就位！请选择游戏' : '等待玩家加入…（选择游戏后开始）';
    }
  } else {
    status = info.game
      ? (info.started ? '对局进行中…' : ('房主已选择 ' + GAMES[info.game].name + (info.size >= cap ? '，即将开始…' : '，等待更多玩家…')))
      : '等待房主选择游戏…';
  }
  $('room-status').textContent = status;
  const actions = $('room-actions');
  actions.innerHTML = '';
  if (online.game){
    if (currentGameId && $('screen-hub') && !$('screen-hub').classList.contains('hidden')){
      const backBtn = el('button','btn','🎮 返回对局');
      backBtn.addEventListener('click', () => showGame(online.game));
      actions.appendChild(backBtn);
    }
  } else {
    if (online.isHost && info.game && info.size >= 2 && !info.started){
      const startBtn = el('button','btn btn-primary','▶ 开始游戏');
      startBtn.addEventListener('click', () => online.send({ type: 'start' }));
      actions.appendChild(startBtn);
    }
    const invite = el('button','btn btn-primary','📨 邀请玩家');
    invite.addEventListener('click', openInvitePicker);
    actions.appendChild(invite);
  }
  const leave = el('button','btn','离开房间');
  leave.addEventListener('click', () => {
    online.clearResume();
    online.send({ type: 'leave' });
    online.resetState();
    online.status('已离开房间');
  });
  actions.appendChild(leave);
}
function openInvitePicker(){
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.appendChild(el('h3', null, '邀请玩家加入房间'));
  const list = el('div','roster-list');
  const data = online.connected && lastServerLB ? lastServerLB : localLeaderboard();
  const onlineUsers = (data.list || []).filter(u => u.online && u.uid !== deviceUid);
  if (!onlineUsers.length){
    card.appendChild(el('p','lobby-empty','当前没有其他在线玩家'));
  } else {
    onlineUsers.forEach(u => {
      const item = el('button','roster-item');
      item.type = 'button';
      const av = el('span','av');
      av.appendChild(avatarStageNode(u, 24));
      item.appendChild(av);
      item.appendChild(el('span','nm', u.name + ' [Lv.' + (u.level || levelFromXp(u.xp || 0)) + ']'));
      item.appendChild(el('span','lb-game', '$' + (u.coins || 0)));
      item.addEventListener('click', () => {
        bd.remove();
        inviteUser(u.uid);
      });
      list.appendChild(item);
    });
    card.appendChild(list);
  }
  const cancel = el('button','btn','取消');
  cancel.addEventListener('click', () => bd.remove());
  card.appendChild(cancel);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}
function renderLobby(){
  const listEl = $('lobby-list');
  listEl.innerHTML = '';
  if (!online.connected){
    listEl.appendChild(el('div','lobby-empty', t('lobby_waiting')));
    return;
  }
  if (!online.lobby.length){
    listEl.appendChild(el('div','lobby-empty', t('lobby_empty')));
    return;
  }
  online.lobby.forEach(r => {
    if (r.room === online.room) return;
    const row = el('div','lobby-row');
    const av = el('span','av');
    const hostProf = { uid: r.hostUid, avatar: r.hostAvatar, name: r.hostName, frame: 0, effect: 0 };
    av.appendChild(avatarStageNode(hostProf, 30));
    av.style.cursor = 'pointer';
  av.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); if (r.hostUid) openProfileModal(r.hostUid); });
    row.appendChild(av);
    const info = el('div','info');
    info.appendChild(el('div','nm', r.hostName + ' ' + (r.hostLang ? langFlag(r.hostLang) : '') + ' 的房间'));
    info.appendChild(el('div','meta', '人数 ' + r.size + '/' + r.capacity + ' · 游戏：' + (r.game ? GAMES[r.game].name : '未选择')));
    row.appendChild(info);
    const joinBtn = el('button','btn btn-primary invite-btn','加入');
    joinBtn.addEventListener('click', () => {
      if (online.game){ toast('对局进行中，请先返回大厅离开房间'); return; }
      online.send({ type: 'join', payload: { room: r.room } });
    });
    row.appendChild(joinBtn);
    listEl.appendChild(row);
  });
}
function renderAccounts(){
  const listEl = $('player-list');
  listEl.innerHTML = '';
  const data = online.connected && lastServerLB ? lastServerLB : localLeaderboard();
  const list = data.list || [];
  if (!list.length){
    listEl.appendChild(el('div','lobby-empty', t('player_list_empty')));
    return;
  }
  list.forEach(u => {
    const row = el('div','player-row' + (u.uid === deviceUid ? ' me' : ''));
    const av = el('span','lb-av');
    av.appendChild(avatarStageNode(u, 20));
    av.style.cursor = 'pointer';
  av.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); openProfileModal(u.uid); });
    row.appendChild(av);
        row.appendChild(el('span','nm', u.name + ' [Lv.' + (u.level || levelFromXp(u.xp || 0)) + ']' + (u.uid === deviceUid ? t('profile_mine') : '') + ' ' + (u.lang ? langFlag(u.lang) : '')));
    if (u.online) row.appendChild(el('span','online-dot',''));
    const coinLine = el('span','coin-line');
    coinLine.appendChild(el('span','coin sm','$'));
    coinLine.appendChild(el('span','pts', (u.coins || 0)));
    row.appendChild(coinLine);
    if (u.uid !== deviceUid){
      const inv = el('button','btn invite-btn','邀请');
      inv.disabled = !u.online || (online.room && !online.isHost);
  inv.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); inviteUser(u.uid); });
      row.appendChild(inv);
    }
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => openProfileModal(u.uid));
    listEl.appendChild(row);
  });
  applyI18n(listEl);
}
function inviteUser(uid){
  if (online.room){
    if (!online.isHost){ toast('只有房主可以邀请'); return; }
    online.send({ type: 'invite', payload: { toUid: uid } });
    toast('邀请已发送');
    return;
  }
  online.inviteTarget = uid;
  online.create();
}
function showInviteModal(inv){
  if (!inv || !inv.room) return;
  if (online.room){
    toast('你已在房间中，无法接受新邀请');
    return;
  }
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.appendChild(el('h3', null, '📨 收到邀请'));
  const msg = el('p', null, inv.fromName + ' 邀请你加入房间 ' + inv.room + (inv.game ? '（' + GAMES[inv.game].name + '）' : '（未选游戏）'));
  msg.style.margin = '0 0 14px';
  msg.style.fontSize = '14px';
  card.appendChild(msg);
  const accept = el('button','btn btn-primary','接受');
  accept.addEventListener('click', () => {
    bd.remove();
    online.send({ type: 'invite_accept', payload: { room: inv.room } });
  });
  const decline = el('button','btn','拒绝');
  decline.addEventListener('click', () => {
    bd.remove();
    online.send({ type: 'invite_decline', payload: { room: inv.room } });
  });
  card.appendChild(accept);
  card.appendChild(decline);
  bd.appendChild(card);
  document.body.appendChild(bd);
}
function openSettings(){
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.appendChild(el('h3', null, '联机服务设置'));
  const input = el('input','nick-input');
  input.type = 'text';
  input.placeholder = '服务端地址（留空 = 自动，线上默认 Render 服务）';
  try { input.value = localStorage.getItem('mg_server') || online.defaultServer; } catch {}
  card.appendChild(input);
  card.appendChild(el('p','lb-note','前端与联机服务不在同一域名时，填写服务端地址（如 https://xxx.onrender.com），保存后重新连接生效。'));
  const save = el('button','btn btn-primary','保存');
  save.addEventListener('click', () => {
    try { localStorage.setItem('mg_server', input.value.trim()); } catch {}
    bd.remove();
    toast('设置已保存，重新连接后生效');
  });
  const cancel = el('button','btn','取消');
  cancel.addEventListener('click', () => bd.remove());
  card.appendChild(save);
  card.appendChild(cancel);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}
