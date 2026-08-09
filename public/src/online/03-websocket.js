/* ================= 联机对战（WebSocket 中继） ================= */
const online = {
  ws: null, room: null, spectatorRoom:null, player: 0, isHost: false, isSpectator: false, game: null, gameplayMeta: null, presentationMeta:null, connected: false, pending: null, roomInfo: null, capacity: 2, _hb: null,
  lobby: [], inviteTarget: null, pendingGame:null, matchId: null, reportedMatchIds: [], soloReportedIds: [], legacyResultSubmitted: false,
  resume: null, _reconnectTimer: null, _reconnectAttempts: 0, _manualClose: false, _replaying: false, _liveMoveQueue: [],
  pendingResultClaim: null, _resultRetryTimer: null, _authenticated: false,
  soloMatch: null, pendingSoloClaims: [], _soloClaimsLoaded: false, displayedRewardIds: [], rewardVersion: null,
  socialState: { version:'1.0', friends:[], incoming:[], outgoing:[], blocked:[], counts:{ friends:0, incoming:0, outgoing:0, blocked:0 } },
  dailyTasks: null, isAdmin:false,
  replays: [], _sharedReplayRequested:false,
  chatState: { version:'1.0', conversations:[], unreadTotal:0 },
  chatHistory: {}, chatHistoryMeta:{}, chatPending: new Map(), chatDrafts:new Map(), chatActivePeerUid:null, cacheOwnerUid:null,
  socialTab:'friends',
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
        proto: typeof PROTOCOL_VERSION !== 'undefined' ? PROTOCOL_VERSION : 2,
        capabilities: ['tank-authority-v1','tetris-battle-authority-v1','tetris-rule-v2','spectator-room-v1','tournament-orchestrator-v1','xiangqi-clock-v1','xiangqi-rule-v2','monopoly-auction-v1','monopoly-rule-v2','game-cosmetic-presentation-v1','username-password-auth-v2','ephemeral-guest-v1','honru-companion-v1','direct-chat-v1'],
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
  create(settings){
    if (!account){ toast(t('need_account_online')); openAuthModal(); return; }
    settings = settings || {};
    if (this.connected){
      this.send({ type:'create', payload:{ capacity:Math.max(2,Math.min(5,Number(settings.capacity)||playerCount||2)), visibility:settings.visibility || 'public', allowSpectators:settings.allowSpectators !== false } });
      this.status(t('room_creating'));
    } else {
      this.pending = { type:'create', settings };
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
  quickJoin(game){
    if (!account){ toast(t('need_account_online')); openAuthModal(); return; }
    if (this.connected) this.send({ type:'quick_join', payload:{ game:game || null } });
    else { this.pending={type:'quick_join',game:game||null}; this.connect(); this.status(t('online_connecting')); }
  },
  spectateRoom(room){ this.send({ type:'spectate', payload:{ room } }); },
  setReady(ready){ this.send({ type:'ready', payload:{ ready:ready !== false } }); },
  requestSocial(){ if (this.connected && this._authenticated) this.send({ type:'social_get' }); },
  prepareAccountScopedState(uid){
    uid=String(uid||'');
    if(this.cacheOwnerUid&&this.cacheOwnerUid!==uid)this.resetAccountCaches();
    this.cacheOwnerUid=uid||null;
  },
  resetAccountCaches(){
    this.socialState={version:'1.0',friends:[],incoming:[],outgoing:[],blocked:[],counts:{friends:0,incoming:0,outgoing:0,blocked:0}};
    this.dailyTasks=null;this.replays=[];this._sharedReplayRequested=false;
    this.chatState={version:'1.0',conversations:[],unreadTotal:0};this.chatHistory={};this.chatHistoryMeta={};this.chatPending=new Map();this.chatDrafts=new Map();this.chatActivePeerUid=null;this.cacheOwnerUid=null;
    if(typeof renderSocialRail==='function')renderSocialRail();
    if(typeof renderPlayerChat==='function')renderPlayerChat();
    if(typeof updateChatUnreadBadge==='function')updateChatUnreadBadge();
  },
  requestChatList(limit){if(this.connected&&this._authenticated)this.send({type:'chat_list',payload:{limit:Number(limit)||50}});},
  requestChatHistory(peerUid,beforeSeq){
    if(!this.connected||!this._authenticated||!peerUid)return false;
    this.send({type:'chat_history',payload:{peerUid:String(peerUid),...(beforeSeq?{beforeSeq:String(beforeSeq)}:{}),limit:30}});return true;
  },
  sendChatMessage(peerUid,text,clientMessageId){
    if(!this.connected||!this._authenticated||!peerUid)return null;
    const id=String(clientMessageId||('chat_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14)));
    this.chatPending.set(id,{peerUid:String(peerUid),text:String(text||''),createdAt:Date.now(),status:'sending'});
    this.send({type:'chat_send',payload:{peerUid:String(peerUid),clientMessageId:id,text:String(text||'')}});
    return id;
  },
  markChatRead(peerUid,throughSeq){
    if(!this.connected||!this._authenticated||!peerUid||!throughSeq)return false;
    this.send({type:'chat_read',payload:{peerUid:String(peerUid),throughSeq:String(throughSeq)}});return true;
  },
  friendRequest(uid){ this.send({ type:'friend_request', payload:{ toUid:String(uid || '') } }); },
  friendRequestAction(action, requestId){ this.send({ type:'friend_request_action', payload:{ action, requestId:String(requestId || '') } }); },
  removeFriend(uid){ this.send({ type:'friend_remove', payload:{ uid:String(uid || '') } }); },
  blockUser(uid){ this.send({ type:'block', payload:{ uid:String(uid || '') } }); },
  unblockUser(uid){ this.send({ type:'unblock', payload:{ uid:String(uid || '') } }); },
  reportUser(payload){ this.send({ type:'report', payload:payload || {} }); },
  addAI(difficulty, persona){ this.send({ type:'add_ai', payload:{ difficulty:difficulty || 'normal', persona:persona || 'teacher' } }); },
  removeAI(seatId){ this.send({ type:'remove_ai', payload:{ seatId } }); },
  sendBotMove(seatId, payload){ this.send({ type:'bot_move', payload:{ seatId, payload } }); },
  sendBotTankInput(seatId, payload){ this.send({ type:'bot_tank_input', payload:{ ...(payload || {}), seatId, matchId:this.matchId } }); },
  sendBotTetrisAction(seatId, action){ this.send({ type:'bot_tetris_action', payload:{ seatId, action, matchId:this.matchId } }); },
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
        this.roomInfo = msg.payload || { room:msg.room, game:null, capacity:this.capacity, players:[{uid:null,player:0}], seats:[], size:1, started:false };
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
        this.roomInfo = msg.payload || { room:msg.room, game:null, capacity:2, players:[{uid:null,player:0}], seats:[], size:1, started:false };
        this.status(t('room_joined_status',msg.room));
        renderRoomPanel();
        break;
      case 'room_update':
        this.roomInfo = msg.payload;
        this.capacity = msg.payload.capacity || this.capacity;
        if (this.room) this.isHost = !!(msg.payload.host && Number(msg.payload.host.seatId) === Number(this.player));
        if (!this.isHost && !this.room && !this.isSpectator) this.room = msg.payload.room;
        if (this.game && !msg.payload.game && !msg.payload.started){
          finishRoomGame();
          return;
        }
        renderRoomPanel();
        if (this.pendingGame){ const game=this.pendingGame; this.pendingGame=null; this.selectGame(game); }
        break;
      case 'spectating':
        {
          const p=msg.payload || {};
          this.spectatorRoom=p.room || null;this.room=null;this.player=null;this.isHost=false;this.isSpectator=true;this.roomInfo=p;
          this.game=p.started?p.game:null;this.matchId=p.matchId||null;this.gameplayMeta=p.gameplay||null;this.presentationMeta=p.presentation||null;
          this.status(t('spectating_room',p.room || ''));renderRoomPanel();
          if (this.game){ startOnlineGame(this.game,p.size); this.replayMoveLog(p.moveLog || []); }
        }
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
        this.isAdmin = !!msg.admin;
        this.rewardVersion = msg.rewardVersion || null;
        if (msg.authenticated){
          if (!this.resume) this._reconnectAttempts = 0;
          this.loadPendingResultClaim();
          this.flushPendingResultClaim();
          this.flushSoloMatch();
          this.requestSocial();
          this.prepareAccountScopedState(account&&account.uid);
          this.requestChatList();
          this.requestDailyTasks();
          this.requestReplays();
          this.requestSharedReplayFromUrl();
        } else if (account && account.authToken){
          toast(t('session_expired'));
          if (typeof completeLocalLogout === 'function') completeLocalLogout(true);
        }
        break;
      case 'quick_join_empty':
        toast(t('quick_join_empty'));
        break;
      case 'social_state':
        this.socialState = msg.payload || this.socialState;
        if (typeof renderSocialRail === 'function') renderSocialRail();
        if(typeof renderGhostProfile==='function')renderGhostProfile();
        break;
      case 'social_ok':
        if (msg.msg) toast(translateServerMessage(msg.msg,msg.reason||(msg.payload&&msg.payload.reason),'operation_success'));
        this.requestSocial();
        break;
      case 'social_error':
        toast(translateServerMessage(msg.msg,msg.reason||(msg.payload&&msg.payload.reason),'operation_failed'));
        break;
      case 'chat_state':
        this.chatState=msg.payload||{version:'1.0',conversations:[],unreadTotal:0};
        if(typeof renderPlayerChat==='function')renderPlayerChat();
        if(typeof updateChatUnreadBadge==='function')updateChatUnreadBadge();
        break;
      case 'chat_history':
        {
          const payload=msg.payload||{},peerUid=payload.peer&&payload.peer.uid;
          if(peerUid){
            const current=Array.isArray(this.chatHistory[peerUid])?this.chatHistory[peerUid]:[];
            const merged=[...(payload.messages||[]),...current],byId=new Map();merged.forEach(item=>{if(item&&item.id)byId.set(item.id,item);});
            this.chatHistory[peerUid]=[...byId.values()].sort((a,b)=>String(a.seq).localeCompare(String(b.seq),undefined,{numeric:true}));
            if(payload.messages&&payload.messages.length){const received=[...payload.messages].reverse().find(item=>item.recipientUid===account.uid);if(received)this.markChatRead(peerUid,received.seq);}
          }
          if(typeof handlePlayerChatHistory==='function')handlePlayerChatHistory(payload);
          if(typeof renderPlayerChat==='function')renderPlayerChat();
        }
        break;
      case 'chat_message':
        {
          const payload=msg.payload||{},message=payload.message||{},peerUid=message.senderUid===account.uid?message.recipientUid:message.senderUid;
          if(peerUid&&message.id){const rows=Array.isArray(this.chatHistory[peerUid])?this.chatHistory[peerUid]:[];if(!rows.some(item=>item.id===message.id))rows.push(message);this.chatHistory[peerUid]=rows.sort((a,b)=>String(a.seq).localeCompare(String(b.seq),undefined,{numeric:true}));}
          if(typeof handlePlayerChatMessage==='function')handlePlayerChatMessage(payload);
          this.requestChatList();
        }
        break;
      case 'chat_send_ok':
        if(msg.payload&&msg.payload.clientMessageId)this.chatPending.delete(msg.payload.clientMessageId);
        if(typeof handlePlayerChatSendAck==='function')handlePlayerChatSendAck(msg.payload||{});
        this.requestChatList();
        break;
      case 'chat_read_ok':
        if(typeof handlePlayerChatRead==='function')handlePlayerChatRead(msg.payload||{});
        this.requestChatList();
        break;
      case 'chat_error':
        if(msg.payload&&msg.payload.clientMessageId&&this.chatPending.has(msg.payload.clientMessageId))this.chatPending.get(msg.payload.clientMessageId).status='failed';
        if(typeof handlePlayerChatError==='function')handlePlayerChatError(msg.payload||{});
        else toast(t('chat_error_generic'));
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
            seats: p.seats || [], humanCount:p.humanCount || 0, aiCount:p.aiCount || 0,
            visibility:p.visibility || 'public', allowSpectators:p.allowSpectators !== false,
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
      case 'tournament_recovered':
        toast(t('tournament_recovered_toast')); this.send({type:'tournament_get',payload:{tournamentId:msg.payload&&msg.payload.tournamentId}});
        break;
      case 'tournament_forfeited':
        toast(t('tournament_forfeited_toast')); this.send({type:'tournament_get',payload:{tournamentId:msg.payload&&msg.payload.tournamentId}});
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
            renderMe();
            if (typeof renderSocialRail === 'function') renderSocialRail();
            if(typeof renderGhostProfile==='function')renderGhostProfile();
          }
        }
        break;
      case 'daily_tasks':
      case 'daily_task_claimed':
        this.dailyTasks = msg.payload || null;
        if (msg.payload && msg.payload.profile && account && msg.payload.profile.uid === account.uid) updateAccountProfile(msg.payload.profile);
        if (typeof renderMyCard === 'function') renderMyCard();
        if(typeof renderGhostProfile==='function')renderGhostProfile();
        if (msg.type === 'daily_task_claimed') toast(t('daily_task_claimed_toast',msg.payload.reward || 0));
        break;
      case 'replay_list':
        this.replays = msg.payload && Array.isArray(msg.payload.items) ? msg.payload.items : [];
        renderReplayList(this.replays);
        if(typeof renderGhostProfile==='function')renderGhostProfile();
        break;
      case 'replay_data':
        renderReplayPlayer(msg.payload || null);
        break;
      case 'replay_shared':
        copyReplayShareUrl(msg.payload&&msg.payload.shareToken);this.requestReplays();
        break;
      case 'replay_unshared':
        toast(t('replay_unshared_toast'));this.requestReplays();
        break;
      case 'replay_error':
        toast(translateServerMessage(msg.msg,msg.reason,'operation_failed'));
        break;
      case 'registered':
        {
          const payload = msg.payload || {};
          const profile = payload.profile || msg.profile || (payload.uid && (payload.name !== undefined || payload.avatar !== undefined) ? payload : null);
          const uid = payload.uid || (profile && profile.uid);
          if (profile && uid){
            this.prepareAccountScopedState(uid);
            const token = msg.token || payload.token;
            if (!account || account.uid !== uid) account = Object.assign({},profile,{device:deviceFingerprint(),registered:true});
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
            this.requestChatList();
            this.requestDailyTasks();
            this.requestReplays();
            if (typeof syncProfiles === 'function') syncProfiles();
            renderMyCard();
            toast(t('account_created_success',account.name));
            if (authModalEl){ authModalEl.remove(); authModalEl = null; }
            if (typeof enterGhostApp === 'function') enterGhostApp();
          }
        }
        break;
      case 'logged_in':
        {
          const payload = msg.payload || {};
          const profile = payload.profile || msg.profile || (payload.uid && (payload.name !== undefined || payload.avatar !== undefined) ? payload : null);
          const uid = payload.uid || (profile && profile.uid);
          if (profile && uid){
            this.prepareAccountScopedState(uid);
            const token = msg.token || payload.token;
            account = Object.assign({}, profile, { device: deviceFingerprint(), registered: true });
            if (token){ account.authToken = token; delete account.pin; }
            this._authenticated = true;
            updateAccountProfile(profile);
            this.loadPendingResultClaim();
            this.flushPendingResultClaim();
            this.flushSoloMatch();
            this.requestSocial();
            this.requestChatList();
            this.requestDailyTasks();
            this.requestReplays();
            if (typeof syncProfiles === 'function') syncProfiles();
            renderMyCard();
            toast(t('login_success',account.name));
            if (authModalEl){ authModalEl.remove(); authModalEl = null; }
            if (typeof enterGhostApp === 'function') enterGhostApp();
          }
        }
        break;
      case 'guest_logged_in':
        {
          const payload=msg.payload||{},profile=payload.profile||null,uid=payload.uid||(profile&&profile.uid),token=msg.token||payload.token;
          if(profile&&uid&&token){this.prepareAccountScopedState(uid);account=Object.assign({},profile,{uid,authToken:token,device:deviceFingerprint(),registered:true,ephemeral:true,accountKind:'guest'});deviceUid=uid;this._authenticated=true;updateAccountProfile(profile);saveAccount();renderMe();renderLeaderboard();if(authModalEl){authModalEl.remove();authModalEl=null;}toast(t('guest_login_success'));if(typeof enterGhostApp==='function')enterGhostApp();}
        }
        break;
      case 'username_status':
        if(typeof setAuthUsernameStatus==='function')setAuthUsernameStatus(msg.payload||msg);
        break;
      case 'companion_checkin_ok':
        if(typeof handleCompanionCheckin==='function')handleCompanionCheckin(msg.payload||{});
        break;
      case 'auth_error':
        toast(translateServerMessage(msg.msg,msg.reason||(msg.payload&&msg.payload.reason),'account_verify_failed'));
        if(typeof setAuthPageError==='function')setAuthPageError(translateServerMessage(msg.msg,msg.reason||(msg.payload&&msg.payload.reason),'account_verify_failed'));
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
          if (typeof renderMyCard === 'function') renderMyCard();
          if(typeof renderGhostProfile==='function')renderGhostProfile();
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
            if (typeof renderLeaderboard === 'function') renderLeaderboard();
            if(typeof renderGhostProfile==='function')renderGhostProfile();
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
  requestDailyTasks(){ if (this.connected && this._authenticated) this.send({type:'daily_tasks_get'}); },
  claimDailyTask(taskId){
    if (!this.connected || !this._authenticated) return false;
    const claimId='task_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
    this.send({type:'daily_task_claim',payload:{taskId,claimId}}); return true;
  },
  requestReplays(){ if(this.connected&&this._authenticated)this.send({type:'replay_list'}); },
  requestReplay(replayId){ if(this.connected&&this._authenticated&&replayId)this.send({type:'replay_get',payload:{replayId}}); },
  shareReplay(replayId){ if(this.connected&&this._authenticated&&replayId)this.send({type:'replay_share',payload:{replayId}}); },
  unshareReplay(replayId){ if(this.connected&&this._authenticated&&replayId)this.send({type:'replay_unshare',payload:{replayId}}); },
  requestSharedReplayFromUrl(){
    if(this._sharedReplayRequested||typeof location==='undefined')return;
    this._sharedReplayRequested=true;
    try{const ref=new URLSearchParams(location.search||'').get('replay');if(/^[A-Za-z0-9_-]{20,160}$/.test(String(ref||'')))this.requestReplay(ref);}catch{}
  },
  resetState(preserveResume){
    const wasRoomGame = !!(this.room || this.game);
    if (!preserveResume) this.clearResume();
    if (!preserveResume) this.clearPendingResultClaim();
    this.room = null; this.spectatorRoom=null; this.game = null; this.isHost = false; this.isSpectator = false; this.gameplayMeta = null; this.presentationMeta=null; this.pending = null; this.roomInfo = null; this.capacity = 2; this.inviteTarget = null; this.pendingGame=null;
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
function renderReplayList(items){
  const holder=$('my-card');if(!holder||!account)return;
  const old=document.querySelector&&document.querySelector('.replay-entry');if(old)old.remove();
  const button=el('button','btn replay-entry',t('replay_open'));button.addEventListener('click',()=>{
    const bd=el('div','modal-backdrop replay-list-modal'),card=el('div','modal-card');card.appendChild(el('h3',null,t('replay_title')));
    if(!items.length)card.appendChild(el('p','muted',t('replay_empty')));
    items.forEach(item=>{const row=el('div','replay-row');row.appendChild(el('span',null,(GAMES[item.game]&&GAMES[item.game].icon||'🎮')+' '+(GAMES[item.game]&&t(GAMES[item.game].nameKey)||item.game)));row.appendChild(el('span','muted',t('replay_events',item.eventCount)));const open=el('button','btn',t('replay_watch'));open.addEventListener('click',()=>online.requestReplay(item.replayId));row.appendChild(open);if(item.canShare){const share=el('button','btn',t('replay_share'));share.addEventListener('click',()=>online.shareReplay(item.replayId));row.appendChild(share);if(item.shared){const revoke=el('button','btn btn-danger',t('replay_unshare'));revoke.addEventListener('click',()=>online.unshareReplay(item.replayId));row.appendChild(revoke);}}card.appendChild(row);});
    const close=el('button','btn btn-primary',t('close'));close.addEventListener('click',()=>bd.remove());card.appendChild(close);bd.appendChild(card);document.body.appendChild(bd);
  });
  holder.appendChild(button);
}
function renderReplayPlayer(replay){
  if(!replay||!Array.isArray(replay.moveLog))return;
  const bd=el('div','modal-backdrop replay-player-modal'),card=el('div','modal-card');card.appendChild(el('h3',null,t('replay_player_title')));card.appendChild(el('p','muted',t('replay_privacy_note')));
  const progress=el('input','replay-progress');progress.type='range';progress.min=0;progress.max=replay.moveLog.length;progress.value=0;progress.style.width='100%';card.appendChild(progress);
  const speed=el('select','nick-input');[0.5,1,2,4].forEach(value=>{const option=el('option');option.value=String(value);option.textContent=value+'×';speed.appendChild(option);});card.appendChild(speed);
  const play=el('button','btn btn-primary',t('replay_play'));const pause=el('button','btn',t('replay_pause'));const status=el('p','muted',t('replay_step',0,replay.moveLog.length));card.appendChild(play);card.appendChild(pause);card.appendChild(status);
  let timer=null,index=0;const stop=()=>{if(timer)clearInterval(timer);timer=null;};const applyIndex=()=>{if(!currentGame||typeof currentGame.onMove!=='function')showGame(replay.game);const event=replay.moveLog[index];if(event&&currentGame&&currentGame.onMove)currentGame.onMove(event.payload,event.player);progress.value=index;status.textContent=t('replay_step',index,replay.moveLog.length);};
  progress.addEventListener('input',()=>{stop();index=Number(progress.value)||0;showGame(replay.game);for(let i=0;i<index;i++){const event=replay.moveLog[i];if(currentGame&&currentGame.onMove)currentGame.onMove(event.payload,event.player);}status.textContent=t('replay_step',index,replay.moveLog.length);});
  play.addEventListener('click',()=>{stop();timer=setInterval(()=>{if(index>=replay.moveLog.length){stop();return;}applyIndex();index++;},Math.max(80,500/Number(speed.value||1)));});pause.addEventListener('click',stop);
  if(replay.canShare){const share=el('button','btn',t('replay_share'));share.addEventListener('click',()=>online.shareReplay(replay.replayId));card.appendChild(share);}
  const close=el('button','btn',t('close'));close.addEventListener('click',()=>{stop();bd.remove();});card.appendChild(close);bd.appendChild(card);document.body.appendChild(bd);
}
function copyReplayShareUrl(token){
  if(!token)return;
  let url=String(token);try{const target=new URL(location.href);target.hash='';target.searchParams.set('replay',token);url=target.toString();}catch{}
  const done=()=>toast(t('replay_link_copied'));
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(done).catch(()=>toast(t('replay_copy_failed')));return;}
  try{const input=document.createElement('input');input.value=url;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();const ok=document.execCommand&&document.execCommand('copy');input.remove();if(ok)done();else toast(t('replay_copy_failed'));}catch{toast(t('replay_copy_failed'));}
}
function renderRoomPanel(){
  const panel = $('room-panel');
  const roomId = online.room || online.spectatorRoom;
  const watching = !!(online.isSpectator || online.spectatorRoom);
  if (!roomId){
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  $('room-code-big').textContent = roomId;
  const info = online.roomInfo || { size:1, capacity:2, players:[], seats:[], game:null, started:false };
  const cap = info.capacity || 2;
  $('room-info').textContent = t('room_summary',
    info.visibility === 'private' ? t('room_private') : t('room_public'), info.size || 0, cap,
    info.humanCount || 0, info.aiCount || 0,
    info.allowSpectators ? t('room_spectators_on',info.spectatorCount || 0) : t('room_spectators_off'),
    info.game && GAMES[info.game] ? t(GAMES[info.game].nameKey) : t('not_selected'));
  const seatGrid=$('seat-grid');
  if (seatGrid){
    seatGrid.innerHTML='';
    (info.seats || []).forEach(seat => {
      const card=el('div','seat-card '+(seat.type==='empty'?'is-empty ':'')+(seat.host?'is-host ':'')+(seat.online===false&&seat.type==='human'?'is-offline':''));
      if(seat.type==='human'){
        const profile={...(profileByUid(seat.userId)||{}),uid:seat.userId,name:seat.nickname,avatar:seat.avatar};
        const av=avatarStageNode(profile,38);av.style.cursor='pointer';av.addEventListener('click',()=>seat.userId&&openProfileModal(seat.userId));card.appendChild(av);
        card.appendChild(elRaw('div','seat-name',seat.nickname+(seat.userId===deviceUid?t('profile_mine'):'')));
        const badges=el('div','seat-badges');if(seat.host)badges.appendChild(el('span','seat-badge','HOST'));badges.appendChild(el('span','seat-badge '+(seat.ready?'ready':''),seat.ready?'READY':t('not_ready')));if(!seat.online)badges.appendChild(el('span','seat-badge',t('offline')));card.appendChild(badges);
      }else if(seat.type==='ai'){
        card.appendChild(avatarStageNode({avatar:seat.avatar||141,frame:0,effect:0},38));card.appendChild(elRaw('div','seat-name',(seat.nickname||'AI')+' AI'));
        const badges=el('div','seat-badges');badges.appendChild(el('span','seat-badge bot','BOT / AI'));badges.appendChild(el('span','seat-badge ready','READY'));card.appendChild(badges);
        card.appendChild(el('div','seat-meta',(seat.aiDifficulty||'normal').toUpperCase()+' · '+(seat.aiPersona||'teacher')));
        if(online.isHost&&!info.started){const remove=el('button','btn btn-ghost',t('remove_ai'));remove.addEventListener('click',()=>online.removeAI(seat.seatId));card.appendChild(remove);}
      }else{
        card.appendChild(el('div',null,'＋'));card.appendChild(el('div','seat-name',t('empty_seat')));
        if(online.isHost&&!info.started){const add=el('button','btn',t('add_ai'));add.addEventListener('click',()=>online.addAI('normal',currentPersona&&currentPersona.id||'teacher'));card.appendChild(add);}
      }
      seatGrid.appendChild(card);
    });
  }
  const selectedGameName = info.game && GAMES[info.game] ? t(GAMES[info.game].nameKey) : '';
  $('room-status').textContent = watching ? t('spectator_readonly') : (info.started ? t('match_in_progress') : (info.canStart ? t('all_ready_start') : (info.game ? t('room_selected_ready', selectedGameName) : t('room_wait_host_select'))));
  const actions = $('room-actions');
  actions.innerHTML = '';
  if(watching){
    const leaveWatch=el('button','btn',t('leave_spectating'));leaveWatch.addEventListener('click',()=>online.send({type:'spectate_leave'}));actions.appendChild(leaveWatch);return;
  }
  if (online.game){
    if (currentGameId && $('screen-hub') && !$('screen-hub').classList.contains('hidden')){
      const backBtn = el('button','btn',t('room_return_game'));
      backBtn.addEventListener('click', () => showGame(online.game));
      actions.appendChild(backBtn);
    }
  } else {
    const mine=(info.seats||[]).find(seat=>seat.type==='human'&&Number(seat.seatId)===Number(online.player));
    if(!online.isHost&&mine&&!info.started){const ready=el('button','btn '+(mine.ready?'btn-primary':''),mine.ready?'READY':t('ready'));ready.addEventListener('click',()=>online.setReady(!mine.ready));actions.appendChild(ready);}
    if (online.isHost && info.game && info.canStart && !info.started){
      const startBtn = el('button','btn btn-primary',t('room_start'));
      startBtn.addEventListener('click', () => online.send({ type: 'start' }));
      actions.appendChild(startBtn);
    }
    if(online.isHost&&!(info.aiCount||0)&&!info.started){
      const tournament=el('button','btn',t('tournament_create'));tournament.addEventListener('click',()=>openTournamentCreate(info));actions.appendChild(tournament);
    }
    if(online.isHost){
      const invite=el('button','btn',t('invite_player'));invite.addEventListener('click',openInvitePicker);actions.appendChild(invite);
      const visibility=el('button','btn',info.visibility==='private'?t('make_public'):t('make_private'));visibility.addEventListener('click',()=>online.send({type:'room_settings',payload:{visibility:info.visibility==='private'?'public':'private'}}));actions.appendChild(visibility);
      const watch=el('button','btn',info.allowSpectators?t('disable_spectators'):t('enable_spectators'));watch.addEventListener('click',()=>online.send({type:'room_settings',payload:{allowSpectators:!info.allowSpectators}}));actions.appendChild(watch);
    }
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
  const me=typeof deviceUid!=='undefined'?deviceUid:null;
  const rosterCandidates=[];
  (info.players||[]).forEach(item=>{if(item&&item.uid)rosterCandidates.push({uid:item.uid,name:item.name||item.uid,online:true});});
  if(typeof lastServerLB!=='undefined'&&lastServerLB&&Array.isArray(lastServerLB.list)) lastServerLB.list.filter(item=>item&&item.uid&&item.online).forEach(item=>rosterCandidates.push(item));
  const candidates=[...new Map(rosterCandidates.map(item=>[item.uid,item])).values()];
  if(me&&!candidates.some(item=>item.uid===me)) candidates.unshift({uid:me,name:t('profile_mine'),online:true});
  const selected=new Set(candidates.filter(item=>(info.players||[]).some(p=>p.uid===item.uid)).map(item=>item.uid));
  const bd=el('div','modal-backdrop'),card=el('div','modal-card');card.appendChild(el('h3',null,t('tournament_create_title')));
  card.appendChild(el('p','muted',t('tournament_hint')));
  const selectNote=el('p','muted',t('tournament_select_players',selected.size));card.appendChild(selectNote);
  const playerGrid=el('div','tournament-player-picker');candidates.slice(0,16).forEach(item=>{const button=el('button','btn '+(selected.has(item.uid)?'btn-primary':''),item.name||item.uid);button.dataset.uid=item.uid;button.addEventListener('click',()=>{if(selected.has(item.uid)){if(item.uid===me)return;selected.delete(item.uid);}else if(selected.size<6)selected.add(item.uid);playerGrid.querySelectorAll('button').forEach(node=>node.classList.toggle('btn-primary',selected.has(node.dataset.uid)));selectNote.textContent=t('tournament_select_players',selected.size);});playerGrid.appendChild(button);});card.appendChild(playerGrid);
  Object.keys(GAMES).forEach(gameId=>{const button=el('button','btn btn-primary',t('game_'+gameId));button.addEventListener('click',()=>{if(selected.size<3){toast(t('tournament_requires_players'));return;}online.send({type:'tournament_create',payload:{gameId,participants:[...selected]}});bd.remove();});card.appendChild(button);});
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
      if(pair.status!=='complete'&&pair.players.includes(deviceUid)){const forfeit=el('button','btn btn-danger',t('tournament_forfeit_self'));forfeit.addEventListener('click',()=>{if(typeof confirm==='function'&&!confirm(t('tournament_forfeit_confirm')))return;online.send({type:'tournament_forfeit',payload:{tournamentId:state.tournamentId,pairingId:pair.pairingId,targetUid:deviceUid}});});card.appendChild(forfeit);}
      if(online.isAdmin&&pair.status!=='complete'){const recovery=el('div','tournament-admin-recovery');recovery.appendChild(el('p','muted',t('tournament_admin_recover')));pair.players.forEach(uid=>{const recover=el('button','btn btn-danger',t('tournament_admin_forfeit_player',uid));recover.addEventListener('click',()=>{if(typeof confirm==='function'&&!confirm(t('tournament_admin_forfeit_confirm',uid)))return;online.send({type:'tournament_recover',payload:{tournamentId:state.tournamentId,pairingId:pair.pairingId,targetUid:uid}});});recovery.appendChild(recover);});card.appendChild(recovery);}
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
function presenceLabel(value){
  const key='presence_'+String(value||'offline');const localized=t(key);return localized===key?String(value||'offline'):localized;
}
function socialRelationshipFor(uid){
  const state=online.socialState||{};
  if((state.blocked||[]).some(item=>item.uid===uid))return'blocked';
  if((state.friends||[]).some(item=>item.uid===uid))return'friends';
  if((state.incoming||[]).some(item=>item.user&&item.user.uid===uid))return'incoming';
  if((state.outgoing||[]).some(item=>item.user&&item.user.uid===uid))return'outgoing';
  return'none';
}
function openReportUserModal(profile,context){
  if(!profile||!profile.uid||profile.uid===deviceUid)return;
  const bd=el('div','modal-backdrop'),card=el('div','modal-card');card.appendChild(el('h3',null,t('social_report')+' · '+(profile.name||t('social_player'))));
  const select=el('select','nick-input');[['harassment','social_reason_harassment'],['inappropriate_name','social_reason_inappropriate_name'],['cheating','social_reason_cheating'],['spam','social_reason_spam'],['other','social_reason_other']].forEach(([value,key])=>{const option=document.createElement('option');option.value=value;option.textContent=t(key);select.appendChild(option);});card.appendChild(select);card.appendChild(el('p','lb-note',t('social_report_note')));
  const send=el('button','btn btn-primary');setButtonIcon(send,'flag',t('social_report'));send.addEventListener('click',()=>{online.reportUser({targetUid:profile.uid,reason:select.value,contextType:context&&context.type||'profile',contextId:context&&context.id||profile.uid,matchId:online.matchId||null});bd.remove();});card.appendChild(send);const cancel=el('button','btn',t('cancel'));cancel.addEventListener('click',()=>bd.remove());card.appendChild(cancel);bd.appendChild(card);bd.addEventListener('click',event=>{if(event.target===bd)bd.remove();});document.body.appendChild(bd);
}
function openSocialActions(profile,context){
  if(!profile||!profile.uid||profile.uid===deviceUid)return;const relation=socialRelationshipFor(profile.uid),bd=el('div','modal-backdrop'),card=el('div','modal-card');card.appendChild(el('h3',null,(profile.name||t('social_player'))+' · '+presenceLabel(profile.presence||(profile.online?'online':'offline'))));
  const add=(label,cls,iconName,handler)=>{const button=el('button','btn'+(cls?' '+cls:''));setButtonIcon(button,iconName,label);button.addEventListener('click',()=>{handler();bd.remove();});card.appendChild(button);};
  if(relation==='none')add(t('social_add_friend'),'btn-primary','user-plus',()=>online.friendRequest(profile.uid));
  if(relation==='outgoing'){const req=(online.socialState.outgoing||[]).find(item=>item.user&&item.user.uid===profile.uid);if(req)add(t('social_cancel'),'','user-minus',()=>online.friendRequestAction('cancel',req.id));}
  if(relation==='incoming'){const req=(online.socialState.incoming||[]).find(item=>item.user&&item.user.uid===profile.uid);if(req){add(t('social_accept'),'btn-primary','user-plus',()=>online.friendRequestAction('accept',req.id));add(t('social_decline'),'','user-minus',()=>online.friendRequestAction('decline',req.id));}}
  if(relation==='friends'){add(t('chat_message_action'),'btn-primary','user',()=>openPlayerConversation(profile.uid));if(profile.online)add(t('social_invite_room'),'','door-open',()=>inviteUser(profile.uid));add(t('social_remove'),'','user-minus',()=>online.removeFriend(profile.uid));}
  if(relation!=='blocked')add(t('social_block'),'social-danger','shield-alert',()=>online.blockUser(profile.uid));else add(t('social_unblock'),'','shield',()=>online.unblockUser(profile.uid));
  add(t('social_report'),'social-danger','flag',()=>openReportUserModal(profile,context));const close=el('button','btn',t('close'));close.addEventListener('click',()=>bd.remove());card.appendChild(close);bd.appendChild(card);bd.addEventListener('click',event=>{if(event.target===bd)bd.remove();});document.body.appendChild(bd);
}
function socialRow(profile,relationship,request){
  const row=el('div','social-row'),avatar=el('span','lb-av');avatar.appendChild(avatarStageNode(profile,24));avatar.addEventListener('click',()=>openProfileModal(profile.uid));row.appendChild(avatar);const copy=el('div','social-copy');copy.appendChild(el('div','social-name',profile.name||t('social_player')));copy.appendChild(el('div','social-meta',presenceLabel(profile.presence||(profile.online?'online':'offline'))+(relationship==='friends'?' · '+t('social_friend'):'')));row.appendChild(copy);const actions=el('div','social-actions');
  if(request&&relationship==='incoming'){const accept=el('button','btn btn-primary');setButtonIcon(accept,'user-plus',t('social_accept'));accept.addEventListener('click',()=>online.friendRequestAction('accept',request.id));actions.appendChild(accept);const decline=el('button','btn');setButtonIcon(decline,'user-minus',t('social_decline'));decline.addEventListener('click',()=>online.friendRequestAction('decline',request.id));actions.appendChild(decline);}
  else if(relationship==='none'){const add=el('button','btn');setButtonIcon(add,'user-plus',t('social_add_friend'));add.addEventListener('click',()=>online.friendRequest(profile.uid));actions.appendChild(add);}else if(relationship==='outgoing')actions.appendChild(el('span','social-meta',t('social_pending')));else if(relationship==='friends'){const message=el('button','btn');setButtonIcon(message,'user',t('chat_message_action'));message.addEventListener('click',()=>openPlayerConversation(profile.uid));actions.appendChild(message);if(profile.online){const invite=el('button','btn');setButtonIcon(invite,'door-open',t('social_invite_room'));invite.addEventListener('click',()=>inviteUser(profile.uid));actions.appendChild(invite);}}
  const more=el('button','btn');setButtonIcon(more,'ellipsis','',{ariaLabel:t('social_more_actions',profile.name||t('social_player'))});more.addEventListener('click',()=>openSocialActions(profile,{type:'social',id:profile.uid}));actions.appendChild(more);row.appendChild(actions);return row;
}
function openBlockedUsers(){
  const bd=el('div','modal-backdrop'),card=el('div','modal-card');card.appendChild(el('h3',null,t('social_block_manage')));const blocked=(online.socialState&&online.socialState.blocked)||[];if(!blocked.length)card.appendChild(el('div','social-empty',t('social_empty')));blocked.forEach(item=>{const row=el('div','social-row');row.appendChild(el('div','social-copy',item.name||t('social_player')));const button=el('button','btn',t('social_unblock'));button.addEventListener('click',()=>{online.unblockUser(item.uid);bd.remove();});row.appendChild(button);card.appendChild(row);});const close=el('button','btn',t('close'));close.addEventListener('click',()=>bd.remove());card.appendChild(close);bd.appendChild(card);document.body.appendChild(bd);
}
function renderSocialRail(){
  const listEl=$('social-list');if(!listEl)return;listEl.innerHTML='';const state=online.socialState||{friends:[],incoming:[],outgoing:[],blocked:[],counts:{}};const badge=$('social-requests-badge');const incomingCount=(state.incoming||[]).length;if(badge){badge.textContent=String(incomingCount);badge.classList.toggle('hidden',!incomingCount);}['friends','online','recent'].forEach(name=>{const button=$('social-tab-'+name);if(button)button.setAttribute('aria-pressed',String(online.socialTab===name));});if(!account){listEl.appendChild(el('div','social-empty',t('social_login_required')));return;}
  if(online.socialTab==='friends'){(state.incoming||[]).forEach(request=>listEl.appendChild(socialRow(request.user,'incoming',request)));(state.friends||[]).forEach(profile=>listEl.appendChild(socialRow(profile,'friends')));if(!(state.incoming||[]).length&&!(state.friends||[]).length)listEl.appendChild(el('div','social-empty',t('social_empty')));if((state.blocked||[]).length){const manage=el('button','btn social-tab',t('social_block_manage_count',state.blocked.length));manage.addEventListener('click',openBlockedUsers);listEl.appendChild(manage);}}
  else if(online.socialTab==='online'){const blocked=new Set((state.blocked||[]).map(item=>item.uid));const users=((lastServerLB&&lastServerLB.list)||[]).filter(profile=>profile.uid!==deviceUid&&profile.online&&!blocked.has(profile.uid));users.forEach(profile=>listEl.appendChild(socialRow(profile,socialRelationshipFor(profile.uid))));if(!users.length)listEl.appendChild(el('div','social-empty',t('leaderboard_no_online')));}
  else{const blocked=new Set((state.blocked||[]).map(item=>item.uid));const recent=recentPlaymates(account,8).filter(item=>!blocked.has(item.uid));recent.forEach(item=>{const remote=(lastServerLB&&lastServerLB.list||[]).find(profile=>profile.uid===item.uid)||{uid:item.uid,name:item.name,avatar:100,presence:'offline'};listEl.appendChild(socialRow(remote,socialRelationshipFor(remote.uid)));});if(!recent.length)listEl.appendChild(el('div','social-empty',t('social_empty')));}
  applyI18n(listEl);
}
function initSocialRail(){['friends','online','recent'].forEach(name=>{const button=$('social-tab-'+name);if(button)button.addEventListener('click',()=>{online.socialTab=name;renderSocialRail();});});}
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
    info.appendChild(el('div','meta',t('lobby_room_meta',r.size,r.capacity,r.game && GAMES[r.game] ? t(GAMES[r.game].nameKey) : t('not_selected'))));
    row.appendChild(info);
    const canJoin = r.canJoin !== undefined ? r.canJoin : r.joinable;
    const canSpectate = r.canSpectate !== undefined ? r.canSpectate : r.spectatable;
    const joinBtn = el('button','btn btn-primary invite-btn',t(canSpectate&&!canJoin?'spectate':'join'));
    joinBtn.addEventListener('click', () => {
      if (online.game&&!online.isSpectator){ toast(t('game_in_progress_leave_first')); return; }
      if(canSpectate&&!canJoin){
        if(online.spectatorRoom===r.room)return;
        if(online.isSpectator)online.send({type:'spectate_leave'});
        if(r.started&&r.matchId) online.spectate(r.room,r.matchId); else online.spectateRoom(r.room);
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
