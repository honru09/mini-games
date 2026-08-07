/* ================= 联机对战（WebSocket 中继） ================= */
const online = {
  ws: null, room: null, player: 0, isHost: false, isSpectator: false, game: null, gameplayMeta: null, presentationMeta:null, connected: false, pending: null, roomInfo: null, capacity: 2, _hb: null,
  lobby: [], inviteTarget: null, matchId: null, reportedMatchIds: [], soloReportedIds: [], legacyResultSubmitted: false,
  resume: null, _reconnectTimer: null, _reconnectAttempts: 0, _manualClose: false, _replaying: false, _liveMoveQueue: [],
  pendingResultClaim: null, _resultRetryTimer: null, _authenticated: false,
  soloMatch: null, pendingSoloClaims: [], _soloClaimsLoaded: false, displayedRewardIds: [], rewardVersion: null,
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
      this.status(t('online_status_connected'));
      const authAccount = typeof account !== 'undefined' ? account : null;
      const authPin = typeof pendingAuthPin !== 'undefined' ? pendingAuthPin : null;
      this.send({ type: 'hello', payload: {
        uid: authAccount && authAccount.uid ? authAccount.uid : (typeof deviceUid !== 'undefined' ? deviceUid : null),
        token: authAccount && authAccount.authToken ? authAccount.authToken : null,
        proto: typeof PROTOCOL_VERSION !== 'undefined' ? PROTOCOL_VERSION : 1,
        capabilities: ['tank-authority-v1','tetris-battle-authority-v1','tetris-rule-v2','spectator-room-v1','tournament-orchestrator-v1','xiangqi-clock-v1','xiangqi-rule-v2','monopoly-auction-v1','monopoly-rule-v2','game-cosmetic-presentation-v1'],
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
      this.status(shouldResume ? t('online_reconnecting') : t('online_disconnected'));
      this.resetState(shouldResume);
      if (shouldResume) this.scheduleReconnect();
      this._manualClose = false;
    };
    ws.onerror = () => { if (this.ws === ws) this.status(this.resume ? t('online_reconnecting') : t('online_status_failed')); };
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
    const localized=localizeRuntimeText(text);
    if (trustedHtml) node.innerHTML = localized;
    else {
      node.innerHTML = '';
      if (typeof setLocalizedText === 'function') setLocalizedText(node, text);
      else node.textContent = localized;
    }
  },
  send(msg){
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  },
  create(){
    if (!account){ toast(t('need_account_online')); openAuthModal(); return; }
    if (this.connected){
      this.send({type:'create', payload:{ capacity: playerCount }});
      this.status(t('room_creating'));
    } else {
      this.pending = { type:'create' };
      this.connect();
      this.status(t('online_connecting'));
    }
  },
  join(code){
    if (!account){ toast(t('need_account_online')); openAuthModal(); return; }
    code = String(code || '').trim().toUpperCase();
    if (code.length < 4){ toast(t('room_code_required')); return; }
    if (this.connected){
      this.send({type:'join', payload:{room:code}});
      this.status(t('room_joining',code));
    } else {
      this.pending = { type:'join', room:code };
      this.connect();
      this.status(t('online_connecting'));
    }
  },
  selectGame(id){ this.send({ type:'select_game', payload:{ game:id } }); },
  sendMove(payload){ this.send({type:'move', payload}); setTimeout(() => this.publishGameState(), 0); },
  sendTankInput(payload){ this.send({type:'tank_input', payload:{...(payload||{}),matchId:this.matchId}}); },
  sendTetrisLockClaim(payload){ this.send({type:'tetris_lock_claim', payload:{...(payload||{}),matchId:this.matchId}}); },
  sendTetrisKOClaim(payload){ this.send({type:'tetris_ko_claim', payload:{...(payload||{}),matchId:this.matchId}}); },
  sendTetrisAction(payload){ this.send({type:'tetris_action', payload:{...(payload||{}),matchId:this.matchId}}); },
  sendTetrisState(payload){ this.send({type:'tetris_state',payload:{...(payload||{}),matchId:this.matchId}}); },
  sendMonopolyAuctionOpen(payload){ this.send({type:'monopoly_auction_open',payload:{...(payload||{}),matchId:this.matchId}}); },
  sendMonopolyBid(payload){ this.send({type:'monopoly_bid',payload}); },
  sendMonopolyTurnEnd(nextPlayer){ this.send({type:'monopoly_turn_end',payload:{matchId:this.matchId,nextPlayer}}); setTimeout(()=>this.publishGameState(),0); },
  sendMonopolyState(snapshot){ if(!this.isHost||!this.matchId||!snapshot)return false;this.send({type:'game_state',payload:{matchId:this.matchId,snapshot}});return true; },
  sendMonopolyAction(payload){ this.send({type:'monopoly_action',payload:{...(payload||{}),matchId:this.matchId}}); },
  sendXiangqiAction(payload){ this.send({type:'xiangqi_action',payload:{...(payload||{}),matchId:this.matchId}}); },
  spectate(roomId,matchId){ this.send({type:'spectate_join',payload:{roomId,matchId}}); },
  publishGameState(){
    if(!this.isHost||this.isSpectator||!this.matchId||!currentGame||typeof currentGame.serialize!=='function'||['tank','tetris'].includes(this.game))return;
    const ready=typeof currentGame.whenIdle==='function'?currentGame.whenIdle():Promise.resolve();
    Promise.resolve(ready).then(()=>{if(!this.isHost||!currentGame||!this.matchId)return;const snapshot=currentGame.serialize();const state=snapshot&&snapshot.state?snapshot.state:snapshot;if(this.game==='monopoly'&&state&&!state.over&&state.phase!=='roll')return;this.send({type:'game_state',payload:{matchId:this.matchId,snapshot}});}).catch(()=>{});
  },
  sendRestart(){ this.send({type:'restart'}); },
  onMessage(msg){
    switch (msg.type){
      case 'created':
        msg.room = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        this.room = msg.room; this.player = msg.player; this.isHost = true;
        this.capacity = msg.capacity || 2;
        this.roomInfo = { room: msg.room, game: null, capacity: this.capacity, players: [{ uid: null, player: 0 }], size: 1, started: false };
        this.status(t('room_created_status',msg.room));
        renderRoomPanel();
        if (this.inviteTarget){
          const toUid = this.inviteTarget;
          this.inviteTarget = null;
          this.send({ type: 'invite', payload: { toUid } });
          toast(t('invite_sent'));
        }
        break;
      case 'joined':
        msg.room = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        this.room = msg.room; this.player = msg.player; this.isHost = false;
        this.roomInfo = { room: msg.room, game: null, capacity: 2, players: [{ uid: null, player: 0 }], size: 1, started: false };
        this.status(t('room_joined_status',msg.room));
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
      case 'spectate_joined':
        {
          const p=msg.payload||{};
          this.room=p.room;this.player=-1;this.isHost=false;this.isSpectator=true;this.game=p.game||null;this.matchId=p.matchId||null;this.gameplayMeta=p.gameplay||null;this.presentationMeta=p.presentation||null;
          this.capacity=p.capacity||2;this.roomInfo=p;renderRoomPanel();
          if(this.game){
            startOnlineGame(this.game,p.size);
            if(p.gameSnapshot&&currentGame&&currentGame.onRestore)currentGame.onRestore(p.gameSnapshot.snapshot);
            else this.replayMoveLog(p.moveLog||[]);
            if(p.tankSnapshot&&currentGame&&currentGame.onAuthoritySnapshot)currentGame.onAuthoritySnapshot(p.tankSnapshot,true);
            if(p.tetrisSnapshot&&currentGame&&currentGame.onBattleSnapshot)currentGame.onBattleSnapshot(p.tetrisSnapshot);
             if(p.tetrisRuleSnapshot&&currentGame&&currentGame.onTetrisRuleState)currentGame.onTetrisRuleState(p.tetrisRuleSnapshot);
             if(Array.isArray(p.tetrisPresentation)&&currentGame&&currentGame.onTetrisState)p.tetrisPresentation.forEach(item=>currentGame.onTetrisState(item));
             if(p.xiangqiRuleSnapshot&&currentGame&&currentGame.onXiangqiRuleState)currentGame.onXiangqiRuleState(p.xiangqiRuleSnapshot);
             if(p.monopolyRuleSnapshot&&currentGame&&currentGame.onMonopolyRuleState)currentGame.onMonopolyRuleState(p.monopolyRuleSnapshot);
             if(p.clockSnapshot&&currentGame&&currentGame.onClockState)currentGame.onClockState(p.clockSnapshot);
            if(p.auctionSnapshot&&currentGame&&currentGame.onAuctionEvent)currentGame.onAuctionEvent('auction_state',p.auctionSnapshot);
            if(p.finalResult){this.lastMatchResult=p.finalResult;toast(t('match_already_finished'));}
          }
        }
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
        } else if (account && account.authToken){
          toast(t('session_expired'));
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
          this.gameplayMeta = p.gameplay || null;
          this.presentationMeta = p.presentation || null;
          this.isSpectator = false;
          this.roomInfo = {
            room: p.room, game: p.game || null, capacity: this.capacity,
            players: p.players || [], size: p.size || 1, onlineSize: p.onlineSize || 1,
            started: !!p.started, settled:!!p.settled, matchId: p.matchId || null,
          };
          this.game = p.started ? (p.game || null) : null;
          this.clearResume();
          renderRoomPanel();
          if (this.game){
            startOnlineGame(this.game, p.size);
            if(p.gameSnapshot&&currentGame&&currentGame.onRestore)currentGame.onRestore(p.gameSnapshot.snapshot);
            else this.replayMoveLog(p.moveLog || []);
            if(p.tankSnapshot&&currentGame&&currentGame.onAuthoritySnapshot)currentGame.onAuthoritySnapshot(p.tankSnapshot,true);
            if(p.tetrisSnapshot&&currentGame&&currentGame.onBattleSnapshot)currentGame.onBattleSnapshot(p.tetrisSnapshot);
            if(p.tetrisRuleSnapshot&&currentGame&&currentGame.onTetrisRuleState)currentGame.onTetrisRuleState(p.tetrisRuleSnapshot);
            if(Array.isArray(p.tetrisPresentation)&&currentGame&&currentGame.onTetrisState)p.tetrisPresentation.forEach(item=>currentGame.onTetrisState(item));
            if(p.xiangqiRuleSnapshot&&currentGame&&currentGame.onXiangqiRuleState)currentGame.onXiangqiRuleState(p.xiangqiRuleSnapshot);
            if(p.monopolyRuleSnapshot&&currentGame&&currentGame.onMonopolyRuleState)currentGame.onMonopolyRuleState(p.monopolyRuleSnapshot);
            if(p.finalResult){this.lastMatchResult=p.finalResult;toast(t('match_already_finished'));}
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
        toast(t(msg.payload && msg.payload.accepted ? 'invite_accepted' : 'invite_declined'));
        break;
      case 'started':
        {
          const started = msg.payload || msg;
          this.game = msg.game || started.game;
          this.matchId = msg.matchId || started.matchId || null;
          this.gameplayMeta = msg.gameplay || started.gameplay || null;
          this.presentationMeta = msg.presentation || started.presentation || null;
          this.legacyResultSubmitted = false;
          if (this.pendingResultClaim && String(this.pendingResultClaim.matchId) !== String(this.matchId || '')) this.clearPendingResultClaim();
          startOnlineGame(this.game, msg.size || started.size);
        }
        break;
      case 'move':
        if (this._replaying) this._liveMoveQueue.push({ payload: msg.payload, player: msg.player });
        else if (this.game && currentGame && currentGame.onMove){ currentGame.onMove(msg.payload, msg.player); if(this.isHost)setTimeout(()=>this.publishGameState(),0); }
        break;
      case 'tank_snapshot':
        if(this.game==='tank'&&currentGame&&currentGame.onAuthoritySnapshot)currentGame.onAuthoritySnapshot(msg.payload);
        break;
      case 'tank_result':
        if(this.game==='tank'&&currentGame&&currentGame.onAuthorityResult)currentGame.onAuthorityResult(msg.payload);
        break;
      case 'tetris_battle':
        if(this.game==='tetris'&&currentGame&&currentGame.onBattleEvent)currentGame.onBattleEvent(msg.payload||msg);
        break;
      case 'tetris_rule_state':
        if(this.game==='tetris'&&currentGame&&currentGame.onTetrisRuleState)currentGame.onTetrisRuleState(msg.payload||msg);
        break;
      case 'tetris_state':
        if(this.game==='tetris'&&currentGame&&currentGame.onTetrisState)currentGame.onTetrisState(msg.payload||msg);
        break;
      case 'tetris_garbage_due':
        if(this.game==='tetris'&&currentGame&&currentGame.onGarbageDue)currentGame.onGarbageDue(msg.payload||msg);
        break;
      case 'tetris_ko':
        if(this.game==='tetris'&&currentGame&&currentGame.onAuthorityKO)currentGame.onAuthorityKO(msg.payload||msg);
        break;
      case 'tetris_result':
        if(this.game==='tetris'&&currentGame&&currentGame.onAuthorityResult)currentGame.onAuthorityResult(msg.payload||msg);
        break;
      case 'xiangqi_rule_state':
        if(this.game==='xiangqi'&&currentGame&&currentGame.onXiangqiRuleState)currentGame.onXiangqiRuleState(msg.payload||msg);
        break;
      case 'xiangqi_result':
        if(this.game==='xiangqi'&&currentGame&&currentGame.onXiangqiRuleResult)currentGame.onXiangqiRuleResult(msg.payload||msg);
        break;
      case 'monopoly_rule_state':
        if(this.game==='monopoly'&&currentGame&&currentGame.onMonopolyRuleState)currentGame.onMonopolyRuleState(msg.payload||msg);
        break;
      case 'monopoly_result':
        if(this.game==='monopoly'&&currentGame&&currentGame.onMonopolyRuleResult)currentGame.onMonopolyRuleResult(msg.payload||msg);
        break;
      case 'clock_state':
      case 'clock_timeout':
        if(this.game==='xiangqi'&&currentGame&&currentGame.onClockState)currentGame.onClockState(msg.payload||msg);
        break;
      case 'auction_open':
      case 'auction_bid':
      case 'auction_closed':
        if(this.game==='monopoly'&&currentGame&&currentGame.onAuctionEvent)currentGame.onAuctionEvent(msg.type,msg.payload||msg);
        break;
      case 'game_state':
        if(!this.isHost&&currentGame&&currentGame.onRestore&&msg.payload&&msg.payload.snapshot&&String(msg.payload.matchId||'')===String(this.matchId||''))currentGame.onRestore(msg.payload.snapshot);
        break;
      case 'spectator_error':
      case 'tournament_error':
        toast(translateServerMessage(msg.msg,msg.reason||(msg.payload&&msg.payload.reason),'operation_failed'));
        break;
      case 'tournament_state':
        this.tournamentState=msg.payload||null;
        if(typeof renderTournamentState==='function')renderTournamentState(this.tournamentState);
        break;
      case 'tournament_match_assigned':
        this.tournamentMatch=msg.payload||null;
        this.status(t('tournament_match_assigned',this.tournamentMatch.roundId,this.tournamentMatch.matchRoomId));
        break;
      case 'tournament_bye':
        this.status(t('tournament_bye_round',msg.payload&&msg.payload.roundId));
        toast(t('tournament_bye_round',msg.payload&&msg.payload.roundId));
        break;
      case 'match_result':
        this.lastMatchResult=msg.payload||null;
        if(this.isSpectator&&msg.payload)toast(t('spectator_result',(msg.payload.results||[]).map(item=>t('spectator_result_entry',t('player_number',item.slot+1),item.rank)).join(' · ')));
        break;
      case 'gameplay_error':
        if(msg.payload&&msg.payload.reason&&!['stale_seq','legacy_move_rejected'].includes(msg.payload.reason))console.warn('Gameplay protocol:',msg.payload.reason);
        break;
      case 'restart':
        {
          const restarted = msg.payload || msg;
          this.matchId = msg.matchId || restarted.matchId || null;
          this.gameplayMeta = msg.gameplay || restarted.gameplay || null;
          this.presentationMeta = msg.presentation || restarted.presentation || null;
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
        this.status(translateServerMessage(msg.msg,msg.reason||(msg.payload&&msg.payload.reason),'generic_error'));
        toast(translateServerMessage(msg.msg,msg.reason||(msg.payload&&msg.payload.reason),'generic_error'));
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
            if (typeof syncProfiles === 'function') syncProfiles();
            renderMyCard();
            toast(t('account_created_success',account.name));
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
            if (typeof syncProfiles === 'function') syncProfiles();
            renderMyCard();
            toast(t('login_success',account.name));
            if (authModalEl){ authModalEl.remove(); authModalEl = null; }
          }
        }
        break;
      case 'auth_error':
        toast(translateServerMessage(msg.msg,msg.reason||(msg.payload&&msg.payload.reason),'account_verify_failed'));
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
          toast(translateServerMessage(payload.msg||msg.msg,payload.reason||msg.reason,'purchase_success'));
        }
        break;
      case 'purchase_error':
        toast(translateServerMessage((msg.payload&&msg.payload.msg)||msg.msg,(msg.payload&&msg.payload.reason)||msg.reason,'purchase_failed'));
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
        toast(translateServerMessage(msg.msg||(msg.payload&&msg.payload.msg),msg.reason||(msg.payload&&msg.payload.reason),'result_failed'));
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
    this.room = null; this.game = null; this.isHost = false; this.isSpectator = false; this.gameplayMeta = null; this.presentationMeta=null; this.pending = null; this.roomInfo = null; this.capacity = 2; this.inviteTarget = null;
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
  toast(t('room_game_ended_switch'));
  showHub();
  renderRoomPanel();
}
function startOnlineGame(id, sizeOverride){
  const size = Math.max(2, sizeOverride || (online.roomInfo && online.roomInfo.size) || online.capacity || 2);
  playerCount = size;
  showGame(id);
  const banner = $('online-banner');
  banner.classList.remove('hidden');
  banner.textContent = t('room_banner',online.room,size,online.isSpectator ? t('spectating') : t('room_you_are_player',online.player+1,online.isHost ? t('room_banner_host') : ''));
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
    return (prof ? prof.name : t('player_number',p.player+1)) + (p.uid && p.uid === deviceUid ? t('profile_mine') : '');
  });
  $('room-info').textContent = t('room_info_line',info.size || 1,cap,names.length ? ' · ' + names.join(t('versus_separator')) : '',info.game ? GAMES[info.game].name : t('not_selected'));
  let status;
  if (online.game){
    status = t('match_in_progress');
  } else if (online.isHost){
    if (info.game){
      if (info.started) status = t('match_in_progress');
      else if (info.size >= cap) status = t('room_full_starting');
      else if (info.size >= 2) status = t('room_selected_ready',GAMES[info.game].name);
      else status = t('room_selected_waiting',GAMES[info.game].name);
    } else {
      status = t(info.size >= 2 ? 'room_players_ready' : 'room_waiting_players');
    }
  } else {
    status = info.game
      ? (info.started ? t('match_in_progress') : t(info.size >= cap ? 'room_host_selected_starting' : 'room_host_selected_waiting',GAMES[info.game].name))
      : t('room_wait_host_select');
  }
  $('room-status').textContent = status;
  const actions = $('room-actions');
  actions.innerHTML = '';
  if (online.game){
    if (currentGameId && $('screen-hub') && !$('screen-hub').classList.contains('hidden')){
      const backBtn = el('button','btn',t('room_return_game'));
      backBtn.addEventListener('click', () => showGame(online.game));
      actions.appendChild(backBtn);
    }
  } else {
    if (online.isHost && info.game && info.size >= 2 && !info.started){
      const startBtn = el('button','btn btn-primary',t('room_start'));
      startBtn.addEventListener('click', () => online.send({ type: 'start' }));
      actions.appendChild(startBtn);
    }
    if(online.isHost&&info.size>=3&&!info.started){
      const tournament=el('button','btn',t('tournament_create'));tournament.addEventListener('click',()=>openTournamentCreate(info));actions.appendChild(tournament);
    }
    const invite = el('button','btn btn-primary',t('invite_player'));
    invite.addEventListener('click', openInvitePicker);
    actions.appendChild(invite);
  }
  if(online.tournamentState&&Array.isArray(online.tournamentState.standings)&&online.tournamentState.standings.some(item=>item.id===deviceUid)){
    const tournament=el('button','btn',t('tournament_open'));
    tournament.addEventListener('click',()=>renderTournamentState(online.tournamentState));
    actions.appendChild(tournament);
  }
  const leave = el('button','btn',t('room_leave'));
  leave.addEventListener('click', () => {
    online.clearResume();
    online.send({ type: 'leave' });
    online.resetState();
    online.status(t('room_left'));
  });
  actions.appendChild(leave);
}
function openTournamentCreate(info){
  const ids=(info.players||[]).map(item=>item.uid).filter(Boolean);if(ids.length<3){toast(t('tournament_requires_players'));return;}
  const bd=el('div','modal-backdrop'),card=el('div','modal-card');card.appendChild(el('h3',null,t('tournament_create_title')));
  card.appendChild(el('p','muted',t('tournament_hint')));
  ['gomoku','xiangqi'].forEach(gameId=>{const button=el('button','btn btn-primary',t('game_'+gameId));button.addEventListener('click',()=>{online.send({type:'tournament_create',payload:{gameId,participants:ids}});bd.remove();});card.appendChild(button);});
  const cancel=el('button','btn',t('cancel'));cancel.addEventListener('click',()=>bd.remove());card.appendChild(cancel);bd.appendChild(card);document.body.appendChild(bd);
}
function renderTournamentState(state){
  if(!state)return;let bd=document.querySelector&&document.querySelector('.tournament-state-modal');if(bd)bd.remove();bd=el('div','modal-backdrop tournament-state-modal');const card=el('div','modal-card');
  const format=t('tournament_format_'+state.format),effectiveStatus=['expired','declined'].includes(state.guardStatus)?state.guardStatus:state.status,status=t('tournament_status_'+effectiveStatus);
  card.appendChild(el('h3',null,'🏆 '+t('tournament_title',t('game_'+state.gameId),format)));card.appendChild(el('p','muted',t('tournament_state_line',status,state.round,state.maxRounds)));
  const standings=el('div','tournament-standings');(state.standings||[]).forEach(item=>standings.appendChild(el('div','roster-item',t('tournament_standing_line',item.rank,item.id,item.points,item.wins,item.draws,item.losses))));card.appendChild(standings);
  const owner=state.ownerUid===deviceUid;
  const consents=state.consents||{},allConsented=(state.standings||[]).every(item=>consents[item.id]===true);
  if(state.status==='waiting'&&consents[deviceUid]!==true&&effectiveStatus==='waiting'){
    card.appendChild(el('p','muted',t('tournament_consent_prompt')));
    const row=el('div','row'),accept=el('button','btn btn-primary',t('invite_accept')),decline=el('button','btn',t('invite_decline'));
    accept.addEventListener('click',()=>online.send({type:'tournament_consent',payload:{tournamentId:state.tournamentId,accepted:true}}));decline.addEventListener('click',()=>online.send({type:'tournament_consent',payload:{tournamentId:state.tournamentId,accepted:false}}));row.appendChild(accept);row.appendChild(decline);card.appendChild(row);
  }
  (state.pairings||[]).forEach(pair=>{
    const pairStatusKey='tournament_pair_status_'+pair.status,pairStatus=t(pairStatusKey),bound=!!(pair.roomMetadata&&pair.roomMetadata.serverMatchId),row=el('div','tournament-table',t('tournament_table_line',pair.table,pair.players.join(t('versus_separator')),pairStatus===pairStatusKey?pair.status:pairStatus));card.appendChild(row);
    if(bound){
      card.appendChild(el('p','muted',t('tournament_bound',pair.matchRoomId)));
      const canWatch=pair.status!=='complete'&&!pair.players.includes(deviceUid)&&(!online.game||online.isSpectator);
      if(canWatch){
        const sameRoom=online.isSpectator&&online.room===pair.matchRoomId;
        const watch=el('button','btn',t(sameRoom?'tournament_watching_table':online.isSpectator?'tournament_switch_table':'tournament_watch_table',pair.table));
        watch.disabled=sameRoom;
        watch.addEventListener('click',()=>{
          if(online.isSpectator)online.send({type:'spectate_leave'});
          online.spectate(pair.matchRoomId,pair.roomMetadata.serverMatchId);
          bd.remove();
        });
        card.appendChild(watch);
      }
    }
    else if(pair.status!=='complete'&&pair.players.includes(deviceUid)){
      const canBind=online.room&&online.matchId&&online.game===state.gameId;
      if(canBind){const bind=el('button','btn btn-primary',t('tournament_bind'));bind.addEventListener('click',()=>online.send({type:'tournament_bind',payload:{tournamentId:state.tournamentId,pairingId:pair.pairingId,roomId:online.room}}));card.appendChild(bind);}
      else card.appendChild(el('p','muted',t('tournament_wait_result')));
    }
  });
  if(owner&&state.status==='waiting'&&effectiveStatus==='waiting'){const start=el('button','btn btn-primary',t('tournament_start'));start.disabled=!allConsented;start.addEventListener('click',()=>online.send({type:'tournament_start',payload:{tournamentId:state.tournamentId}}));card.appendChild(start);}
  if(owner&&state.status==='round_complete'){const next=el('button','btn btn-primary',t('tournament_next'));next.addEventListener('click',()=>online.send({type:'tournament_next',payload:{tournamentId:state.tournamentId}}));card.appendChild(next);}
  const close=el('button','btn',t('close'));close.addEventListener('click',()=>bd.remove());card.appendChild(close);bd.appendChild(card);document.body.appendChild(bd);
}
function openInvitePicker(){
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.appendChild(el('h3', null, t('invite_picker_title')));
  const list = el('div','roster-list');
  const data = online.connected && lastServerLB ? lastServerLB : localLeaderboard();
  const onlineUsers = (data.list || []).filter(u => u.online && u.uid !== deviceUid);
  if (!onlineUsers.length){
    card.appendChild(el('p','lobby-empty',t('invite_no_online')));
  } else {
    onlineUsers.forEach(u => {
      const item = el('button','roster-item');
      item.type = 'button';
      const av = el('span','av');
      av.appendChild(avatarStageNode(u, 24));
      item.appendChild(av);
      const inviteName=el('span','nm');inviteName.appendChild(elRaw('span',null,u.name));inviteName.appendChild(el('span',null,t('level_bracket',u.level || levelFromXp(u.xp || 0))));item.appendChild(inviteName);
      item.appendChild(el('span','lb-game', CURRENCY + (u.coins || 0)));
      item.addEventListener('click', () => {
        bd.remove();
        inviteUser(u.uid);
      });
      list.appendChild(item);
    });
    card.appendChild(list);
  }
  const cancel = el('button','btn',t('cancel'));
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
    const roomName=el('div','nm');roomName.appendChild(elRaw('span',null,r.hostName+' '+(r.hostLang?langFlag(r.hostLang):'')));roomName.appendChild(document.createTextNode(t('host_room_suffix')));info.appendChild(roomName);
    info.appendChild(el('div','meta',t('lobby_room_meta',r.size,r.capacity,r.game ? GAMES[r.game].name : t('not_selected'))));
    row.appendChild(info);
    const joinBtn = el('button','btn btn-primary invite-btn',t(r.spectatable&&!r.joinable?'spectate':'join'));
    joinBtn.addEventListener('click', () => {
      if (online.game&&!online.isSpectator){ toast(t('game_in_progress_leave_first')); return; }
      if(r.spectatable&&!r.joinable){
        if(online.isSpectator&&online.room===r.room)return;
        if(online.isSpectator)online.send({type:'spectate_leave'});
        online.spectate(r.room,r.matchId);
      }else online.send({ type: 'join', payload: { room: r.room } });
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
        const playerName=el('span','nm');playerName.appendChild(elRaw('span',null,u.name));playerName.appendChild(el('span',null,t('level_bracket',u.level || levelFromXp(u.xp || 0))+(u.uid === deviceUid ? t('profile_mine') : '')+' '+(u.lang ? langFlag(u.lang) : '')));row.appendChild(playerName);
    if (u.online) row.appendChild(el('span','online-dot',''));
    const coinLine = el('span','coin-line');
    coinLine.appendChild(currencyIcon('sm'));
    coinLine.appendChild(el('span','pts', (u.coins || 0)));
    row.appendChild(coinLine);
    if (u.uid !== deviceUid){
      const inv = el('button','btn invite-btn',t('invite_short'));
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
    if (!online.isHost){ toast(t('host_only_invite')); return; }
    online.send({ type: 'invite', payload: { toUid: uid } });
    toast(t('invite_sent'));
    return;
  }
  online.inviteTarget = uid;
  online.create();
}
function showInviteModal(inv){
  if (!inv || !inv.room) return;
  if (online.room){
    toast(t('invite_already_in_room'));
    return;
  }
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.appendChild(el('h3', null, t('invite_title')));
  const msg = el('p', null, t('invite_message',inv.fromName,inv.room,inv.game ? GAMES[inv.game].name : t('not_selected')));
  msg.style.margin = '0 0 14px';
  msg.style.fontSize = '14px';
  card.appendChild(msg);
  const accept = el('button','btn btn-primary',t('invite_accept'));
  accept.addEventListener('click', () => {
    bd.remove();
    online.send({ type: 'invite_accept', payload: { room: inv.room } });
  });
  const decline = el('button','btn',t('invite_decline'));
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
  card.appendChild(el('h3', null, t('server_config')));
  const input = el('input','nick-input');
  input.type = 'text';
  input.placeholder = t('server_placeholder');
  try { input.value = localStorage.getItem('mg_server') || online.defaultServer; } catch {}
  card.appendChild(input);
  card.appendChild(el('p','lb-note',t('server_note')));
  const save = el('button','btn btn-primary',t('save'));
  save.addEventListener('click', () => {
    try { localStorage.setItem('mg_server', input.value.trim()); } catch {}
    bd.remove();
    toast(t('settings_saved'));
  });
  const cancel = el('button','btn',t('cancel'));
  cancel.addEventListener('click', () => bd.remove());
  card.appendChild(save);
  card.appendChild(cancel);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}
