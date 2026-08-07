/* ================= 联机对战（WebSocket 中继） ================= */
const online = {
  ws: null, room: null, spectatorRoom:null, player: 0, isHost: false, game: null, connected: false, pending: null, roomInfo: null, capacity: 2, _hb: null,
  lobby: [], inviteTarget: null, pendingGame:null, matchId: null, reportedMatchIds: [], soloReportedIds: [], legacyResultSubmitted: false,
  resume: null, _reconnectTimer: null, _reconnectAttempts: 0, _manualClose: false, _replaying: false, _liveMoveQueue: [],
  pendingResultClaim: null, _resultRetryTimer: null, _authenticated: false,
  soloMatch: null, pendingSoloClaims: [], _soloClaimsLoaded: false, displayedRewardIds: [], rewardVersion: null,
  socialState: { version:'1.0', friends:[], incoming:[], outgoing:[], blocked:[], counts:{ friends:0, incoming:0, outgoing:0, blocked:0 } },
  socialTab: 'friends',
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
        proto: typeof PROTOCOL_VERSION !== 'undefined' ? PROTOCOL_VERSION : 2,
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
        if (p.type === 'create') this.create(p.settings);
        else if (p.type === 'join') this.join(p.room);
        else if (p.type === 'quick_join') this.quickJoin(p.game);
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
  create(settings){
    if (!account){ toast('请先创建账号或登录后再联机'); openAuthModal(); return; }
    settings = settings || {};
    if (this.connected){
      this.send({type:'create', payload:{ capacity:Math.max(2,Math.min(5,Number(settings.capacity)||2)), visibility:settings.visibility || 'public', allowSpectators:settings.allowSpectators !== false }});
      this.status('正在创建房间…');
    } else {
      this.pending = { type:'create', settings };
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
  quickJoin(game){
    if (!account){ openAuthModal(); return; }
    if (this.connected) this.send({ type:'quick_join', payload:{ game:game || null } });
    else { this.pending={type:'quick_join',game:game||null}; this.connect(); this.status('正在连接服务器…'); }
  },
  spectate(room){ this.send({ type:'spectate', payload:{ room } }); },
  setReady(ready){ this.send({ type:'ready', payload:{ ready:ready !== false } }); },
  requestSocial(){ if (this.connected && this._authenticated) this.send({ type:'social_get' }); },
  friendRequest(uid){ this.send({ type:'friend_request', payload:{ toUid:String(uid || '') } }); },
  friendRequestAction(action, requestId){ this.send({ type:'friend_request_action', payload:{ action, requestId:String(requestId || '') } }); },
  removeFriend(uid){ this.send({ type:'friend_remove', payload:{ uid:String(uid || '') } }); },
  blockUser(uid){ this.send({ type:'block', payload:{ uid:String(uid || '') } }); },
  unblockUser(uid){ this.send({ type:'unblock', payload:{ uid:String(uid || '') } }); },
  reportUser(payload){ this.send({ type:'report', payload:payload || {} }); },
  addAI(difficulty, persona){ this.send({ type:'add_ai', payload:{ difficulty:difficulty || 'normal', persona:persona || 'teacher' } }); },
  removeAI(seatId){ this.send({ type:'remove_ai', payload:{ seatId } }); },
  sendBotMove(seatId, payload){ this.send({ type:'bot_move', payload:{ seatId, payload } }); },
  sendMove(payload){
    if (this.game === 'tank' && payload && payload.act === 'input'){
      this.send({ type:'tank_input', payload:{ matchId:this.matchId, seq:payload.seq, clientTick:Number(this.serverTick)||0, input:payload.input } }); return;
    }
    if (this.game === 'tank' && payload && payload.act === 'shoot'){
      this.send({ type:'tank_input', payload:{ matchId:this.matchId, seq:payload.seq, clientTick:Number(this.serverTick)||0, input:{ fire:true } } }); return;
    }
    if (this.game === 'tank' && payload && payload.act === 'move'){
      const input={up:false,right:false,down:false,left:false}; input[['up','right','down','left'][Number(payload.d)]] = true;
      this.send({ type:'tank_input', payload:{ matchId:this.matchId, seq:payload.seq, clientTick:Number(this.serverTick)||0, input } }); return;
    }
    if (this.game === 'tetris' && payload){
      if (payload.act === 'lock'){
        this.send({ type:'tetris_lock_claim', payload:{ ...payload, matchId:this.matchId, linesCleared:Number(payload.linesCleared)||0, attack:Number(payload.attack)||0 } }); return;
      }
      if (payload.act === 'ko'){
        this.send({ type:'tetris_ko_claim', payload:{ ...payload, matchId:this.matchId } }); return;
      }
      if (payload.act === 'active') this.send({ type:'tetris_sync', payload:{ matchId:this.matchId, payload } });
      return;
    }
    this.send({type:'move', payload});
  },
  sendRestart(){ this.send({type:'restart'}); },
  onMessage(msg){
    switch (msg.type){
      case 'created':
        msg.room = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        this.room = msg.room; this.player = msg.player; this.isHost = true;
        this.capacity = msg.capacity || 2;
        this.roomInfo = msg.payload || { room: msg.room, game: null, capacity: this.capacity, players: [{ uid: null, player: 0 }], seats:[], size: 1, started: false };
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
        this.roomInfo = msg.payload || { room: msg.room, game: null, capacity: 2, players: [{ uid: null, player: 0 }], seats:[], size: 1, started: false };
        this.status('已加入房间 <span class="room-code">' + msg.room + '</span>，等待房主开始…', true);
        renderRoomPanel();
        break;
      case 'room_update':
        this.roomInfo = msg.payload;
        this.capacity = msg.payload.capacity || this.capacity;
        if (this.room) this.isHost = !!(msg.payload.host && Number(msg.payload.host.seatId) === Number(this.player));
        if (this.game && !msg.payload.game && !msg.payload.started){
          finishRoomGame();
          return;
        }
        renderRoomPanel();
        if (this.pendingGame){ const game=this.pendingGame; this.pendingGame=null; this.selectGame(game); }
        break;
      case 'spectating':
        this.spectatorRoom = msg.payload && msg.payload.room;
        this.roomInfo = msg.payload || null; this.player = null; this.isHost = false;
        this.game = msg.payload && msg.payload.started ? msg.payload.game : null;
        this.matchId = msg.payload && msg.payload.matchId || null;
        this.status('正在观战房间 ' + this.spectatorRoom);
        renderRoomPanel();
        if (this.game){
          startOnlineGame(this.game, msg.payload.size);
          if (msg.payload.tankSnapshot && currentGame && typeof currentGame.applyServerSnapshot === 'function'){
            this.serverTick=Number(msg.payload.tankSnapshot.serverTick)||0;currentGame.applyServerSnapshot(msg.payload.tankSnapshot);
          }
          this.replayMoveLog(msg.payload.moveLog || []);
        }
        break;
      case 'spectator_left':
        this.spectatorRoom = null; this.roomInfo = null; this.game = null; this.matchId = null;
        if (currentGameId) showHub(); renderRoomPanel(); this.status('已离开观战');
        break;
      case 'quick_join_empty':
        toast('当前没有可快速加入的公开房间');
        break;
      case 'lobby':
        this.lobby = msg.payload || [];
        renderLobby();
        break;
      case 'hello_ack':
        this._authenticated = !!msg.authenticated;
        this.rewardVersion = msg.rewardVersion || null;
        if (msg.authenticated){
          if (!this.resume) this._reconnectAttempts = 0;
          this.loadPendingResultClaim();
          this.flushPendingResultClaim();
          this.flushSoloMatch();
          this.requestSocial();
        } else if (account && account.authToken){
          toast('登录会话已失效，请使用 PIN 重新登录');
          if (typeof completeLocalLogout === 'function') completeLocalLogout(true);
        }
        break;
      case 'social_state':
        this.socialState = msg.payload || { version:'1.0', friends:[], incoming:[], outgoing:[], blocked:[], counts:{ friends:0, incoming:0, outgoing:0, blocked:0 } };
        if (typeof renderSocialRail === 'function') renderSocialRail();
        break;
      case 'social_ok':
        this.requestSocial();
        toast(msg.action === 'reported' ? t('social_report_sent') : t('social_action_ok'));
        break;
      case 'social_error':
        toast(t('social_action_error'));
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
            if (p.tankSnapshot && currentGame && typeof currentGame.applyServerSnapshot === 'function'){
              this.serverTick=Number(p.tankSnapshot.serverTick)||0; currentGame.applyServerSnapshot(p.tankSnapshot);
            }
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
          if (started.seats && this.roomInfo) this.roomInfo.seats = started.seats;
          if (this.pendingResultClaim && String(this.pendingResultClaim.matchId) !== String(this.matchId || '')) this.clearPendingResultClaim();
          startOnlineGame(this.game, msg.size || started.size);
        }
        break;
      case 'move':
        if (this._replaying) this._liveMoveQueue.push({ payload: msg.payload, player: msg.player });
        else if (this.game && currentGame && currentGame.onMove) currentGame.onMove(msg.payload, msg.player);
        break;
      case 'tank_snapshot':
        this.serverTick = Number(msg.payload && msg.payload.serverTick) || 0;
        if (this.game === 'tank' && currentGame && typeof currentGame.applyServerSnapshot === 'function') currentGame.applyServerSnapshot(msg.payload);
        break;
      case 'tank_result':
        if (this.game === 'tank' && currentGame && typeof currentGame.applyServerResult === 'function') currentGame.applyServerResult(msg.payload);
        break;
      case 'tetris_garbage_due':
        if (this.game === 'tetris' && currentGame && typeof currentGame.queueGarbage === 'function'){
          const p = msg.payload || {}; currentGame.queueGarbage(Number(p.target), Number(p.amount), Number(p.source), p.attackId);
        }
        break;
      case 'tetris_ko':
        if (this.game === 'tetris' && currentGame && currentGame.onMove) currentGame.onMove({ act:'ko', reason:'TOP OUT', seq:Number(msg.revision)||0 }, Number(msg.player));
        break;
      case 'tetris_result':
        if (this.game === 'tetris' && currentGame && currentGame.onMove) currentGame.onMove({ act:'final', order:msg.order, state:null }, 0);
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
            this.flushSoloMatch();
            this.requestSocial();
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
            this.flushSoloMatch();
            this.requestSocial();
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
        this.socialState = { version:'1.0', friends:[], incoming:[], outgoing:[], blocked:[], counts:{ friends:0, incoming:0, outgoing:0, blocked:0 } };
        if (typeof renderSocialRail === 'function') renderSocialRail();
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
      case 'solo_started':
        {
          const payload = msg.payload || {};
          const match = this.soloMatch;
          if (match && String(payload.clientRunId || '') === String(match.clientRunId) && String(payload.game || '') === String(match.game)){
            match.matchId = payload.matchId;
            match.resultId = payload.resultId;
            match.started = !!(match.matchId && match.resultId);
            this.flushSoloMatch();
          }
        }
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
          const rewardId = String(payload.resultId || (resultMatchId ? resultMatchId + ':' + this.player : ''));
          if (payload.reward && (!rewardId || !this.displayedRewardIds.includes(rewardId))){
            if (rewardId){
              this.displayedRewardIds.push(rewardId);
              if (this.displayedRewardIds.length > 100) this.displayedRewardIds.splice(0, this.displayedRewardIds.length - 100);
              this.saveSoloClaims();
            }
            if (typeof showRewardBreakdown === 'function') showRewardBreakdown(payload.reward);
          } else if (!payload.reward && (pendingClaim || this.pendingSoloClaims.some(claim => String(claim.resultId || '') === rewardId))){
            toast(t('reward_settled_refresh'));
          }
          if (payload.resultId) this.removeSoloClaim(payload.resultId, resultMatchId);
          if (this.soloMatch && payload.resultId && String(payload.resultId) === String(this.soloMatch.resultId || '')){
            this.soloMatch.completed = true;
            this.soloMatch = null;
          }
          if (pendingClaim && resultMatchId && String(pendingClaim.matchId) === String(resultMatchId)){
            if (payload.reward) toast(formatRewardSummary(payload.reward));
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
          const errorResultId = msg.resultId || (msg.payload && msg.payload.resultId);
          if (errorMatchId) this.clearPendingResultClaim(errorMatchId);
          else if (this.pendingResultClaim && this.room && String(this.matchId || '') === String(this.pendingResultClaim.matchId)) this.clearPendingResultClaim();
          if (errorResultId || errorMatchId) this.removeSoloClaim(errorResultId, errorMatchId);
          if (this.soloMatch && errorMatchId && String(this.soloMatch.matchId || '') === String(errorMatchId)) this.soloMatch = null;
        }
        toast(msg.msg || (msg.payload && msg.payload.msg) || t('result_failed'));
        break;
    }
  },
  newSoloRunId(){
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'run_' + crypto.randomUUID();
    return 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 14);
  },
  newSoloActionId(match){
    match.actionSeq = (Number(match.actionSeq) || 0) + 1;
    return 'act_' + Date.now().toString(36) + '_' + match.actionSeq.toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  },
  loadSoloClaims(){
    if (this._soloClaimsLoaded) return;
    this._soloClaimsLoaded = true;
    try {
      const saved = JSON.parse(localStorage.getItem('mg_pending_solo_claims') || 'null');
      if (saved && account && saved.uid === account.uid && Array.isArray(saved.claims)){
        this.pendingSoloClaims = saved.claims.filter(claim => claim && claim.matchId && claim.resultId && claim.game && claim.result).slice(-20);
      }
      const shown = JSON.parse(localStorage.getItem('mg_displayed_reward_ids') || '[]');
      if (Array.isArray(shown)) this.displayedRewardIds = shown.map(String).slice(-100);
    } catch {
      this.pendingSoloClaims = [];
    }
  },
  saveSoloClaims(){
    try {
      if (account && account.uid) localStorage.setItem('mg_pending_solo_claims', JSON.stringify({ uid: account.uid, claims: this.pendingSoloClaims.slice(-20) }));
      else localStorage.removeItem('mg_pending_solo_claims');
      localStorage.setItem('mg_displayed_reward_ids', JSON.stringify(this.displayedRewardIds.slice(-100)));
    } catch {}
  },
  queueSoloClaim(match){
    if (!match || !match.matchId || !match.resultId || !match.pendingResult) return false;
    this.loadSoloClaims();
    if (!this.pendingSoloClaims.some(claim => String(claim.resultId) === String(match.resultId))){
      this.pendingSoloClaims.push({
        game: match.game, matchId: match.matchId, resultId: match.resultId, result: match.pendingResult,
        pendingActions: Array.isArray(match.actionHistory) ? match.actionHistory.slice(0, 500) : [],
        resultSentAt: 0, createdAt: Date.now(),
      });
      if (this.pendingSoloClaims.length > 20) this.pendingSoloClaims.splice(0, this.pendingSoloClaims.length - 20);
    }
    this.saveSoloClaims();
    this.flushSoloClaims();
    return true;
  },
  removeSoloClaim(resultId, matchId){
    const before = this.pendingSoloClaims.length;
    this.pendingSoloClaims = this.pendingSoloClaims.filter(claim =>
      !(resultId && String(claim.resultId) === String(resultId)) && !(matchId && String(claim.matchId) === String(matchId)));
    if (this.pendingSoloClaims.length !== before) this.saveSoloClaims();
    this.flushSoloClaims();
  },
  flushSoloClaims(){
    this.loadSoloClaims();
    const claim = this.pendingSoloClaims[0];
    if (!claim || !account || !account.uid || !this.connected || !this._authenticated || !this.rewardVersion) return;
    while (claim.pendingActions && claim.pendingActions.length){
      const action = claim.pendingActions.shift();
      this.send({ type: 'solo_progress', payload: { matchId: claim.matchId, game: claim.game, action } });
    }
    if (!claim.resultSentAt || Date.now() - claim.resultSentAt > 3000){
      claim.resultSentAt = Date.now();
      this.saveSoloClaims();
      this.send({ type: 'result', payload: {
        mode: 'ai', game: claim.game, matchId: claim.matchId, resultId: claim.resultId, result: claim.result,
      } });
      setTimeout(() => this.flushSoloClaims(), 3100);
    }
  },
  beginSoloMatch(game){
    if (!game) return null;
    this.soloMatch = {
      game: String(game),
      clientRunId: this.newSoloRunId(),
      matchId: null,
      resultId: null,
      started: false,
      startSentAt: 0,
      pendingActions: [],
      actionHistory: [],
      actionSeq: 0,
      pendingResult: null,
      completed: false,
      submitted: false,
      resultSentAt: 0,
    };
    this.flushSoloMatch();
    return this.soloMatch;
  },
  reportSoloProgress(game, action){
    if (!this.soloMatch || this.soloMatch.completed || this.soloMatch.pendingResult || this.soloMatch.game !== String(game)) this.beginSoloMatch(game);
    const match = this.soloMatch;
    if (!match) return;
    const event = { actionId: this.newSoloActionId(match), payload: action };
    if (match.actionHistory.length < 500) match.actionHistory.push(event);
    if (!match.started || !this.connected || !this._authenticated){
      if (match.pendingActions.length < 500) match.pendingActions.push(event);
    } else {
      this.send({ type: 'solo_progress', payload: { matchId: match.matchId, game: match.game, action: event } });
    }
    this.flushSoloMatch();
  },
  submitSoloResult(game, result){
    if (!this.soloMatch || this.soloMatch.completed || this.soloMatch.game !== String(game)) this.beginSoloMatch(game);
    if (!this.soloMatch) return false;
    this.soloMatch.pendingResult = String(result || 'loss');
    this.flushSoloMatch();
    return true;
  },
  flushSoloMatch(){
    const match = this.soloMatch;
    this.flushSoloClaims();
    if (!match || match.completed || !account || !account.uid || !this.connected || !this._authenticated || !this.rewardVersion) return;
    if (!match.started){
      const now = Date.now();
      if (!match.startSentAt || now - match.startSentAt > 1500){
        match.startSentAt = now;
        this.send({ type: 'solo_start', payload: { game: match.game, clientRunId: match.clientRunId } });
        setTimeout(() => { if (this.soloMatch === match && !match.started) this.flushSoloMatch(); }, 1600);
      }
      return;
    }
    while (match.pendingActions.length){
      const action = match.pendingActions.shift();
      this.send({ type: 'solo_progress', payload: { matchId: match.matchId, game: match.game, action } });
    }
    if (match.pendingResult){
      this.queueSoloClaim(match);
      if (this.soloMatch === match) this.soloMatch = null;
    }
  },
  resetState(preserveResume){
    const wasRoomGame = !!(this.room || this.game);
    if (!preserveResume) this.clearResume();
    if (!preserveResume) this.clearPendingResultClaim();
    this.room = null; this.spectatorRoom = null; this.game = null; this.isHost = false; this.pending = null; this.roomInfo = null; this.capacity = 2; this.inviteTarget = null;
    this.matchId = null; this.legacyResultSubmitted = false;
    $('online-banner').classList.add('hidden');
    $('room-panel').classList.add('hidden');
    const endBtn = $('btn-end-game');
    if (endBtn) endBtn.classList.add('hidden');
    if (currentGameId && wasRoomGame) showHub();
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
  banner.textContent = '房间 ' + (online.room || online.spectatorRoom) + ' · ' + size + ' 席 · ' + (online.spectatorRoom ? '观战（只读）' : ('你是席位 ' + (online.player+1) + (online.isHost ? '（房主）' : '')));
  runCountdown();
}
function renderRoomPanel(){
  const panel = $('room-panel');
  const roomId = online.room || online.spectatorRoom;
  if (!roomId){
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  $('room-code-big').textContent = roomId;
  const info = online.roomInfo || { size:1, capacity:2, players:[], seats:[], game:null, started:false };
  const cap = info.capacity || 2;
  $('room-info').textContent = (info.visibility === 'private' ? '🔒 私密' : '🌐 公开') + ' · ' + (info.size || 0) + '/' + cap + ' 席 · ' + (info.humanCount || 0) + ' 真人 · ' + (info.aiCount || 0) + ' AI · ' + (info.allowSpectators ? ('可观战 ' + (info.spectatorCount || 0)) : '禁止观战') + ' · ' + (info.game && GAMES[info.game] ? GAMES[info.game].name : '未选游戏');
  const seatGrid=$('seat-grid'); seatGrid.innerHTML='';
  (info.seats || []).forEach(seat => {
    const card=el('div','seat-card '+(seat.type==='empty'?'is-empty ':'')+(seat.host?'is-host ':'')+(seat.online===false&&seat.type==='human'?'is-offline':''));
    if(seat.type==='human'){
      const profile={...(profileByUid(seat.userId)||{}),uid:seat.userId,name:seat.nickname,avatar:seat.avatar};
      const av=avatarStageNode(profile,38); av.style.cursor='pointer'; av.addEventListener('click',()=>seat.userId&&openProfileModal(seat.userId)); card.appendChild(av);
      card.appendChild(el('div','seat-name',seat.nickname+(seat.userId===deviceUid?'（你）':'')));
      const badges=el('div','seat-badges'); if(seat.host)badges.appendChild(el('span','seat-badge','HOST')); badges.appendChild(el('span','seat-badge '+(seat.ready?'ready':''),seat.ready?'READY':'未准备')); if(!seat.online)badges.appendChild(el('span','seat-badge','离线')); card.appendChild(badges);
    }else if(seat.type==='ai'){
      card.appendChild(avatarCanvas(seat.avatar||141,38)); card.appendChild(el('div','seat-name',(seat.nickname||'AI')+' 🤖'));
      const badges=el('div','seat-badges'); badges.appendChild(el('span','seat-badge bot','BOT / AI')); badges.appendChild(el('span','seat-badge ready','READY')); card.appendChild(badges);
      card.appendChild(el('div','seat-meta',(seat.aiDifficulty||'normal').toUpperCase()+' · '+(seat.aiPersona||'teacher')));
      if(online.isHost&&!info.started){const remove=el('button','btn btn-ghost','移除 AI');remove.addEventListener('click',()=>online.removeAI(seat.seatId));card.appendChild(remove);}
    }else{
      card.appendChild(el('div',null,'＋')); card.appendChild(el('div','seat-name','空席位'));
      if(online.isHost&&!info.started){const add=el('button','btn','添加 AI');add.addEventListener('click',()=>online.addAI('normal',currentPersona&&currentPersona.id||'teacher'));card.appendChild(add);}
    }
    seatGrid.appendChild(card);
  });
  $('room-status').textContent = online.spectatorRoom ? '观战模式 · 只读，不可走子或提交结算' : (info.started ? '对局进行中…' : (info.canStart ? '所有真人玩家已 READY，房主可以开始' : (info.game ? '等待真人玩家 READY' : '房主请选择游戏')));
  const actions = $('room-actions');
  actions.innerHTML = '';
  if(online.spectatorRoom){
    const leaveWatch=el('button','btn','离开观战');leaveWatch.addEventListener('click',()=>online.send({type:'leave_spectator'}));actions.appendChild(leaveWatch);return;
  }
  if (online.game){
    if (currentGameId && $('screen-hub') && !$('screen-hub').classList.contains('hidden')){
      const backBtn = el('button','btn','🎮 返回对局');
      backBtn.addEventListener('click', () => showGame(online.game));
      actions.appendChild(backBtn);
    }
  } else {
    const mine=(info.seats||[]).find(seat=>seat.type==='human'&&Number(seat.seatId)===Number(online.player));
    if(!online.isHost&&mine&&!info.started){const ready=el('button','btn '+(mine.ready?'btn-primary':''),mine.ready?'✓ READY':'准备');ready.addEventListener('click',()=>online.setReady(!mine.ready));actions.appendChild(ready);}
    if (online.isHost && info.game && info.canStart && !info.started){
      const startBtn = el('button','btn btn-primary','▶ 开始游戏');
      startBtn.addEventListener('click', () => online.send({ type: 'start' }));
      actions.appendChild(startBtn);
    }
    if(online.isHost){
      const invite=el('button','btn','邀请真人');invite.addEventListener('click',openInvitePicker);actions.appendChild(invite);
      const visibility=el('button','btn',info.visibility==='private'?'改为公开房':'改为私密房');visibility.addEventListener('click',()=>online.send({type:'room_settings',payload:{visibility:info.visibility==='private'?'public':'private'}}));actions.appendChild(visibility);
      const watch=el('button','btn',info.allowSpectators?'关闭观战':'开放观战');watch.addEventListener('click',()=>online.send({type:'room_settings',payload:{allowSpectators:!info.allowSpectators}}));actions.appendChild(watch);
    }
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
      item.appendChild(el('span','lb-game', CURRENCY + (u.coins || 0)));
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
    row.dataset.room = r.room;
    const av = el('span','av');
    const hostProf = { uid: r.hostUid, avatar: r.hostAvatar, name: r.hostName, frame: 0, effect: 0 };
    av.appendChild(avatarStageNode(hostProf, 30));
    av.style.cursor = 'pointer';
  av.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); if (r.hostUid) openProfileModal(r.hostUid); });
    row.appendChild(av);
    const info = el('div','info');
    info.appendChild(el('div','nm', (r.game && GAMES[r.game] ? GAMES[r.game].name : '待选游戏') + ' · ' + (r.status==='playing'?'游戏中':'等待中')));
    info.appendChild(el('div','meta', r.hostName + ' HOST · ' + r.humanCount + ' 真人 / ' + r.aiCount + ' AI · ' + r.size + '/' + r.capacity + ' · ' + (r.allowSpectators?'可观战':'不可观战')));
    const strip=el('div','lobby-seat-strip');(r.seats||[]).forEach(seat=>strip.appendChild(el('span','lobby-seat-dot',seat.type==='ai'?'🤖 AI':seat.type==='human'?(seat.ready?'✓ '+seat.nickname:seat.nickname):'＋ 空席')));info.appendChild(strip);
    row.appendChild(info);
    const joinBtn = el('button','btn btn-primary invite-btn','加入'); joinBtn.disabled=!r.canJoin;
    joinBtn.addEventListener('click', () => {
      if (online.game){ toast('对局进行中，请先返回大厅离开房间'); return; }
      online.send({ type: 'join', payload: { room: r.room } });
    });
    row.appendChild(joinBtn);
    if(r.canSpectate){const watch=el('button','btn invite-btn','观战');watch.addEventListener('click',()=>online.spectate(r.room));row.appendChild(watch);}
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
    coinLine.appendChild(currencyIcon('sm'));
    coinLine.appendChild(el('span','pts', (u.coins || 0)));
    row.appendChild(coinLine);
    if (u.uid !== deviceUid){
      const inv = el('button','btn invite-btn');setButtonIcon(inv,'user-plus','邀请');
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
function socialRelationshipFor(uid){
  const state = online.socialState || {};
  if ((state.blocked || []).some(item => item.uid === uid)) return 'blocked';
  if ((state.friends || []).some(item => item.uid === uid)) return 'friends';
  if ((state.incoming || []).some(item => item.user && item.user.uid === uid)) return 'incoming';
  if ((state.outgoing || []).some(item => item.user && item.user.uid === uid)) return 'outgoing';
  return 'none';
}
function openReportUserModal(profile, context){
  if (!profile || !profile.uid || profile.uid === deviceUid) return;
  const bd=el('div','modal-backdrop'), card=el('div','modal-card');
  card.appendChild(el('h3',null,t('social_report')+' · '+(profile.name||t('social_player'))));
  const select=el('select','nick-input');
  [['harassment','social_reason_harassment'],['inappropriate_name','social_reason_inappropriate_name'],['cheating','social_reason_cheating'],['spam','social_reason_spam'],['other','social_reason_other']].forEach(([value,key])=>{const option=document.createElement('option');option.value=value;option.textContent=t(key);select.appendChild(option);});
  card.appendChild(select);
  card.appendChild(el('p','lb-note',t('social_report_note')));
  const send=el('button','btn btn-primary');setButtonIcon(send,'flag',t('social_report'));send.addEventListener('click',()=>{
    online.reportUser({ targetUid:profile.uid, reason:select.value, contextType:context&&context.type||'profile', contextId:context&&context.id||profile.uid, matchId:online.matchId||null });bd.remove();
  });card.appendChild(send);
  const cancel=el('button','btn',t('cancel'));cancel.addEventListener('click',()=>bd.remove());card.appendChild(cancel);
  bd.appendChild(card);bd.addEventListener('click',event=>{if(event.target===bd)bd.remove();});document.body.appendChild(bd);
}
function openSocialActions(profile, context){
  if (!profile || !profile.uid || profile.uid === deviceUid) return;
  const relation=socialRelationshipFor(profile.uid), bd=el('div','modal-backdrop'), card=el('div','modal-card');
  card.appendChild(el('h3',null,(profile.name||t('social_player'))+' · '+presenceLabel(profile.presence||(profile.online?'online':'offline'))));
  const add=(label,cls,iconName,handler)=>{const button=el('button','btn'+(cls?' '+cls:''));setButtonIcon(button,iconName,label);button.addEventListener('click',()=>{handler();bd.remove();});card.appendChild(button);};
  if(relation==='none') add(t('social_add_friend'),'btn-primary','user-plus',()=>online.friendRequest(profile.uid));
  if(relation==='outgoing'){
    const req=(online.socialState.outgoing||[]).find(item=>item.user&&item.user.uid===profile.uid);if(req)add(t('social_cancel'),'','user-minus',()=>online.friendRequestAction('cancel',req.id));
  }
  if(relation==='incoming'){
    const req=(online.socialState.incoming||[]).find(item=>item.user&&item.user.uid===profile.uid);if(req){add(t('social_accept'),'btn-primary','user-plus',()=>online.friendRequestAction('accept',req.id));add(t('social_decline'),'','user-minus',()=>online.friendRequestAction('decline',req.id));}
  }
  if(relation==='friends'){
    if(profile.online) add(t('social_invite_room'),'btn-primary','door-open',()=>inviteUser(profile.uid));
    add(t('social_remove'),'','user-minus',()=>online.removeFriend(profile.uid));
  }
  if(relation!=='blocked') add(t('social_block'),'social-danger','shield-alert',()=>online.blockUser(profile.uid));
  else add(t('social_unblock'),'','shield',()=>online.unblockUser(profile.uid));
  add(t('social_report'),'social-danger','flag',()=>openReportUserModal(profile,context));
  const close=el('button','btn',t('close'));close.addEventListener('click',()=>bd.remove());card.appendChild(close);
  bd.appendChild(card);bd.addEventListener('click',event=>{if(event.target===bd)bd.remove();});document.body.appendChild(bd);
}
function socialRow(profile, relationship, request){
  const row=el('div','social-row');
  const avatar=el('span','lb-av');avatar.appendChild(avatarStageNode(profile,24));avatar.addEventListener('click',()=>openProfileModal(profile.uid));row.appendChild(avatar);
  const copy=el('div','social-copy');copy.appendChild(el('div','social-name',profile.name||t('social_player')));copy.appendChild(el('div','social-meta',presenceLabel(profile.presence||(profile.online?'online':'offline'))+(relationship==='friends'?' · '+t('social_friend'):'')));row.appendChild(copy);
  const actions=el('div','social-actions');
  if(request&&relationship==='incoming'){
    const accept=el('button','btn btn-primary');setButtonIcon(accept,'user-plus',t('social_accept'));accept.addEventListener('click',()=>online.friendRequestAction('accept',request.id));actions.appendChild(accept);
    const decline=el('button','btn');setButtonIcon(decline,'user-minus',t('social_decline'));decline.addEventListener('click',()=>online.friendRequestAction('decline',request.id));actions.appendChild(decline);
  }else if(relationship==='none'){
    const add=el('button','btn');setButtonIcon(add,'user-plus',t('social_add_friend'));add.addEventListener('click',()=>online.friendRequest(profile.uid));actions.appendChild(add);
  }else if(relationship==='outgoing'){
    actions.appendChild(el('span','social-meta',t('social_pending')));
  }else if(relationship==='friends'&&profile.online){
    const invite=el('button','btn');setButtonIcon(invite,'door-open',t('social_invite_room'));invite.addEventListener('click',()=>inviteUser(profile.uid));actions.appendChild(invite);
  }
  const more=el('button','btn');setButtonIcon(more,'ellipsis','',{ariaLabel:t('social_more_actions',profile.name||t('social_player'))});more.addEventListener('click',()=>openSocialActions(profile,{type:'social',id:profile.uid}));actions.appendChild(more);row.appendChild(actions);return row;
}
function openBlockedUsers(){
  const bd=el('div','modal-backdrop'),card=el('div','modal-card');card.appendChild(el('h3',null,t('social_block_manage')));
  const blocked=(online.socialState&&online.socialState.blocked)||[];
  if(!blocked.length)card.appendChild(el('div','social-empty',t('social_empty')));
  blocked.forEach(item=>{const row=el('div','social-row');row.appendChild(el('div','social-copy',item.name||t('social_player')));const button=el('button','btn',t('social_unblock'));button.addEventListener('click',()=>{online.unblockUser(item.uid);bd.remove();});row.appendChild(button);card.appendChild(row);});
  const close=el('button','btn',t('close'));close.addEventListener('click',()=>bd.remove());card.appendChild(close);bd.appendChild(card);document.body.appendChild(bd);
}
function renderSocialRail(){
  const listEl=$('social-list');if(!listEl)return;listEl.innerHTML='';
  const state=online.socialState||{friends:[],incoming:[],outgoing:[],blocked:[],counts:{}};
  const badge=$('social-requests-badge');const incomingCount=(state.incoming||[]).length;if(badge){badge.textContent=String(incomingCount);badge.classList.toggle('hidden',!incomingCount);}
  ['friends','online','recent'].forEach(name=>{const button=$('social-tab-'+name);if(button)button.setAttribute('aria-pressed',String(online.socialTab===name));});
  if(!account){listEl.appendChild(el('div','social-empty',t('social_login_required')));return;}
  if(online.socialTab==='friends'){
    (state.incoming||[]).forEach(request=>listEl.appendChild(socialRow(request.user,'incoming',request)));
    (state.friends||[]).forEach(profile=>listEl.appendChild(socialRow(profile,'friends')));
    if(!(state.incoming||[]).length&&!(state.friends||[]).length)listEl.appendChild(el('div','social-empty',t('social_empty')));
    if((state.blocked||[]).length){const manage=el('button','btn social-tab',t('social_block_manage_count',state.blocked.length));manage.addEventListener('click',openBlockedUsers);listEl.appendChild(manage);}
  }else if(online.socialTab==='online'){
    const blocked=new Set((state.blocked||[]).map(item=>item.uid));const users=((lastServerLB&&lastServerLB.list)||[]).filter(profile=>profile.uid!==deviceUid&&profile.online&&!blocked.has(profile.uid));
    users.forEach(profile=>listEl.appendChild(socialRow(profile,socialRelationshipFor(profile.uid))));if(!users.length)listEl.appendChild(el('div','social-empty',t('leaderboard_no_online')));
  }else{
    const blocked=new Set((state.blocked||[]).map(item=>item.uid));const recent=recentPlaymates(account,8).filter(item=>!blocked.has(item.uid));
    recent.forEach(item=>{const remote=(lastServerLB&&lastServerLB.list||[]).find(profile=>profile.uid===item.uid)||{uid:item.uid,name:item.name,avatar:100,presence:'offline'};listEl.appendChild(socialRow(remote,socialRelationshipFor(remote.uid)));});if(!recent.length)listEl.appendChild(el('div','social-empty',t('social_empty')));
  }
  applyI18n(listEl);
}
function initSocialRail(){
  ['friends','online','recent'].forEach(name=>{const button=$('social-tab-'+name);if(button)button.addEventListener('click',()=>{online.socialTab=name;renderSocialRail();});});
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
