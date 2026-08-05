/* ================= 联机对战（WebSocket 中继） ================= */
const online = {
  ws: null, room: null, player: 0, isHost: false, game: null, connected: false, pending: null, roomInfo: null, capacity: 2, _hb: null,
  lobby: [], inviteTarget: null,
  defaultServer: 'https://mini-games-online.onrender.com',
  connect(){
    if (this.connected) return;
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
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => {
      this.connected = true;
      this.status('已连接服务器，可创建或加入房间');
      this.send({ type: 'hello', payload: { uid: typeof deviceUid !== 'undefined' ? deviceUid : null } });
      this.send({ type: 'lobby' });
      if (typeof syncProfiles === 'function') syncProfiles();
      if (account && account.uid && !account.registered){
        this.send({ type: 'register', payload: {
          uid: account.uid, pin: account.pin, name: account.name, avatar: account.avatar,
          background: account.background, frame: account.frame, effect: account.effect, owned: account.owned,
        } });
      }
      if (this._hb) clearInterval(this._hb);
      this._hb = setInterval(() => { if (this.connected) this.send({ type: 'ping' }); }, 10000);
      if (this.pending){
        const p = this.pending;
        this.pending = null;
        if (p.type === 'create') this.create();
        else if (p.type === 'join') this.join(p.room);
      }
    };
    this.ws.onmessage = e => this.onMessage(JSON.parse(e.data));
    this.ws.onclose = () => {
      this.connected = false;
      if (this._hb){ clearInterval(this._hb); this._hb = null; }
      this.status('连接已断开');
      this.resetState();
    };
    this.ws.onerror = () => this.status('连接失败，请确认服务已启动');
  },
  status(text){ $('online-status').innerHTML = text; },
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
        this.room = msg.room; this.player = msg.player; this.isHost = true;
        this.capacity = msg.capacity || 2;
        this.roomInfo = { room: msg.room, game: null, capacity: this.capacity, players: [{ uid: null, player: 0 }], size: 1, started: false };
        this.status('房间已创建：<span class="room-code">' + msg.room + '</span>，等待对方加入…');
        renderRoomPanel();
        if (this.inviteTarget){
          const toUid = this.inviteTarget;
          this.inviteTarget = null;
          this.send({ type: 'invite', payload: { toUid } });
          toast('邀请已发送');
        }
        break;
      case 'joined':
        this.room = msg.room; this.player = msg.player; this.isHost = false;
        this.roomInfo = { room: msg.room, game: null, capacity: 2, players: [{ uid: null, player: 0 }], size: 1, started: false };
        this.status('已加入房间 <span class="room-code">' + msg.room + '</span>，等待房主开始…');
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
      case 'invite':
        showInviteModal(msg.payload);
        break;
      case 'invite_result':
        toast(msg.payload && msg.payload.accepted ? '对方已接受邀请 🎉' : '对方拒绝了邀请');
        break;
      case 'started':
        this.game = msg.game;
        startOnlineGame(msg.game, msg.size);
        break;
      case 'move':
        if (this.game && currentGame && currentGame.onMove) currentGame.onMove(msg.payload);
        break;
      case 'restart':
        runCountdown();
        if (currentGame && currentGame.onRestart) currentGame.onRestart();
        else if (this.game) startOnlineGame(this.game);
        break;
      case 'end_game':
        finishRoomGame();
        break;
      case 'peer_left':
        if (this.isHost){
          this.game = null;
          toast('对方已离开');
          if (currentGameId) showHub();
          this.status('对方已离开，房间仍保留，等待新对手加入…');
          renderRoomPanel();
        } else {
          toast('房主已关闭房间');
          this.resetState();
          this.status('房间已关闭，可重新创建或加入房间');
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
        if (msg.payload && account && msg.payload.uid === account.uid){
          // profile_ok 只是档案同步回执：只更新展示字段，不覆盖本地金币/局数（以免回写 0）
          account.name = msg.payload.name;
          account.avatar = msg.payload.avatar;
          account.background = msg.payload.background || account.background || 0;
          account.frame = msg.payload.frame || account.frame || 0;
          account.effect = msg.payload.effect || account.effect || 0;
          account.lang = msg.payload.lang || account.lang || 'zh-CN';
          const me = roster.find(x => x.uid === account.uid);
          if (me){ me.name = account.name; me.avatar = account.avatar; }
          saveRoster(); saveAccount();
          renderMe(); renderSlots();
        }
        break;
      case 'registered':
        if (msg.payload && msg.payload.uid){
          account.pin = account.pin || '';
          account.registered = true;
          updateAccountProfile(msg.payload.profile);
          toast('🎉 账号创建成功，欢迎 ' + account.name);
          if (authModalEl){ authModalEl.remove(); authModalEl = null; }
        }
        break;
      case 'logged_in':
        if (msg.payload && msg.payload.uid){
          account = Object.assign({}, msg.payload.profile, { device: deviceFingerprint() });
          updateAccountProfile(msg.payload.profile);
          toast('✅ 登录成功：' + account.name);
          if (authModalEl){ authModalEl.remove(); authModalEl = null; }
        }
        break;
      case 'auth_error':
        toast(msg.msg || '账号验证失败');
        break;
      case 'profile_data':
        if (msg.payload){
          renderProfilePopup(msg.payload, false);
        }
        break;
    }
  },
  resetState(){
    this.room = null; this.game = null; this.isHost = false; this.pending = null; this.roomInfo = null; this.capacity = 2; this.inviteTarget = null;
    $('online-banner').classList.add('hidden');
    $('room-panel').classList.add('hidden');
    const endBtn = $('btn-end-game');
    if (endBtn) endBtn.classList.add('hidden');
    if (currentGameId && $('screen-game') && !$('screen-game').classList.contains('hidden')){
      showHub();
    }
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
  online.game = null;
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
      backBtn.addEventListener('click', () => startOnlineGame(online.game));
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
      item.appendChild(el('span','nm', u.name));
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
    row.appendChild(el('span','nm', u.name + (u.uid === deviceUid ? t('profile_mine') : '') + ' ' + (u.lang ? langFlag(u.lang) : '')));
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
