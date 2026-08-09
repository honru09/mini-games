/* ================= 应用外壳 ================= */
let playerCount = 2;
let aiMode = false;
let currentGame = null; // { reset }
let currentGameId = null;


/* ================= Settings 设置系统 ================= */
function openSettingsPage() {
  const localizedLabel = (tag, className, icon, key) => {
    const node = el(tag, className || null);
    if (icon) node.appendChild(el('span', null, icon + ' '));
    const label = el('span', null, t(key));
    label.setAttribute('data-i18n', key);
    node.appendChild(label);
    return node;
  };
  const bd = el("div","modal-backdrop");
  const card = el("div","modal-card");
  card.style.width = "520px";
  card.appendChild(localizedLabel('h3', null, '⚙️', 'settings'));

  // Theme section
  const themeLabel = localizedLabel('div', null, '🎨', 'theme');
  themeLabel.style.cssText = "font-weight:600; margin:10px 0 6px; font-size:14px";
  card.appendChild(themeLabel);
  const themeRow = el("div");
  themeRow.style.cssText = "display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap";
  THEME_LIST.forEach(tv => {
    const btn = el("button","btn" + (getTheme() === tv.id ? " btn-primary" : ""));
    btn.appendChild(el('span', null, tv.icon + ' '));
    const themeText = el('span', null, themeName(tv));
    themeText.setAttribute('data-i18n', tv.nameKey);
    btn.appendChild(themeText);
    btn.title = themeName(tv);
    btn.setAttribute('data-i18n-title', tv.nameKey);
    btn.addEventListener("click", () => {
      applyTheme(tv.id);
      try { localStorage.setItem("mg_theme", tv.id); } catch {}
      themeRow.querySelectorAll("button").forEach(b => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
    });
    themeRow.appendChild(btn);
  });
  card.appendChild(themeRow);

  // Language section
  const langLabel = localizedLabel('div', null, '🌐', 'language');
  langLabel.style.cssText = "font-weight:600; margin:10px 0 6px; font-size:14px";
  card.appendChild(langLabel);
  const langRow = el("div");
  langRow.style.cssText = "display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap";
  [
    { code: "zh-CN", label: "🇨🇳 中文" },
    { code: "en-US", label: "🇺🇸 English" },
    { code: "uk-UA", label: "🇺🇦 Українська" },
  ].forEach(l => {
    const btn = el("button","btn" + (currentLang === l.code ? " btn-primary" : ""));
    btn.textContent = l.label;
    btn.dataset.langCode = l.code;
    btn.setAttribute('data-i18n-raw', '');
    btn.addEventListener("click", async () => {
      const committed = await setLanguage(l.code);
      if (!committed) return;
      langRow.querySelectorAll("button").forEach(b => b.classList.toggle("btn-primary", b.dataset.langCode === currentLang));
    });
    langRow.appendChild(btn);
  });
  card.appendChild(langRow);

  const langNote = el("p","lb-note");
  langNote.textContent = t('language_note');
  langNote.setAttribute('data-i18n', 'language_note');
  card.appendChild(langNote);

  // Server section (merged from openSettings)
  const srvLabel = localizedLabel('div', null, '🔗', 'server_config');
  srvLabel.style.cssText = "font-weight:600; margin:10px 0 6px; font-size:14px";
  card.appendChild(srvLabel);
  const srvInput = el("input","nick-input");
  srvInput.type = "text";
  srvInput.placeholder = t('server_placeholder');
  srvInput.setAttribute('data-i18n-placeholder', 'server_placeholder');
  try { srvInput.value = localStorage.getItem("mg_server") || online.defaultServer; } catch {}
  card.appendChild(srvInput);
  const serverNote = el('p','lb-note',t('server_note'));
  serverNote.setAttribute('data-i18n', 'server_note');
  card.appendChild(serverNote);

  const close = el("button","btn btn-primary", t("close"));
  close.setAttribute('data-i18n', 'close');
  close.addEventListener("click", () => {
    try { localStorage.setItem("mg_server", srvInput.value.trim()); } catch {}
    bd.remove();
    toast(t('settings_saved'));
  });
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener("click", e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}

function getTheme() {
  try {
    const v = document.documentElement && document.documentElement.getAttribute("data-theme");
    if (v) return normalizeTheme(v);
  } catch {}
  return "light";
}

/* ================= Ghost Game 四区应用外壳 ================= */
const GHOST_APP_ROUTES = ['home','games','chat','profile'];
let ghostAppRoute = 'home';
let ghostChatView = 'players';
let chatLastConversationFocus = null;
let ghostProfileBackgroundNode = null;
let ghostHeroIndex = 0;
let ghostHeroTimer = null;
let ghostGameStageState = { gameId:null, activeIdx:null, infos:null, bankrupts:null, colors:null };
let honruGameReactionTimer = null;
let honruGameReactionSequence = 0;
let honruGameReactionLifecycle = 0;
let honruGameReactionPriority = -1;
let honruGameReactionState = '';
let honruGameReactionActiveUntil = 0;
const honruGameReactionLastAt = Object.create(null);
let honruPlatformReactionTimer = null;
let honruPlatformReactionSequence = 0;
const HONRU_FEEDBACK_STATE = Object.freeze({
  tap:'idle', move:'idle', place:'surprised', shoot:'playful', capture:'playful',
  score:'playful', win:'win', lose:'lose', draw:'recover', think:'thinking', waiting:'waiting-invite',
  invite:'waiting-invite', checkin:'check-in', recover:'recover',
});
const HONRU_STATE_PRIORITY = Object.freeze({
  idle:0, thinking:1, 'waiting-invite':1, 'check-in':1, recover:1,
  surprised:2, playful:2, win:4, lose:4,
});
const HONRU_STATE_COOLDOWN = Object.freeze({
  idle:900, thinking:4500, 'waiting-invite':1800, 'check-in':1800, recover:1800,
  surprised:850, playful:700, win:4000, lose:4000,
});

function honruFeedbackState(kind){
  const value=String(kind||'idle');
  return HONRU_FEEDBACK_STATE[value] || (typeof HONRU_STATE_ID_SET!=='undefined'&&HONRU_STATE_ID_SET.has(value)?value:'idle');
}
function honruFallbackUrl(){
  return typeof assetUrl==='function' ? assetUrl('brand/honru-mascot-v1.svg') : 'assets/brand/honru-mascot-v1.svg';
}
function applyHonruStateImage(img,state,valid){
  if(!img || typeof resolveHonruStateUrl!=='function')return Promise.resolve(false);
  const fallback=img.dataset.honruFallbackSrc||img.getAttribute('src')||honruFallbackUrl();
  img.dataset.honruFallbackSrc=fallback;
  const restore=()=>{
    if(valid&&!valid())return false;
    img.onerror=null;img.src=fallback;img.dataset.honruState='fallback';return false;
  };
  return resolveHonruStateUrl(state).then(url=>{
    if(!url || !honruStatesEnabled() || (valid&&!valid()))return restore();
    const activate=()=>{
      if(valid&&!valid())return false;
      if(!honruStatesEnabled())return restore();
      img.onerror=()=>{img.onerror=null;img.src=fallback;img.dataset.honruState='fallback';};
      img.src=url;img.dataset.honruState=state;return true;
    };
    const probe=document.createElement('img');probe.decoding='async';
    if(typeof probe.decode==='function'){
      probe.src=url;
      try{return Promise.resolve(probe.decode()).then(activate,restore);}catch{return restore();}
    }
    return new Promise(resolve=>{probe.onload=()=>resolve(activate());probe.onerror=()=>resolve(restore());probe.src=url;});
  }).catch(restore);
}
function removeHonruGameReactionNode(resetPriority){
  honruGameReactionSequence++;
  if(honruGameReactionTimer){clearTimeout(honruGameReactionTimer);honruGameReactionTimer=null;}
  const node=$('honru-game-reaction');if(node)node.remove();
  if(resetPriority!==false){honruGameReactionPriority=-1;honruGameReactionState='';honruGameReactionActiveUntil=0;}
}
function clearHonruGameReaction(){
  honruGameReactionLifecycle++;
  removeHonruGameReactionNode(true);
}
function honruGameReactionAllowed(context){
  if(typeof honruStatesEnabled!=='function'||!honruStatesEnabled()||typeof document==='undefined'||!document.body)return false;
  if(document.hidden||!document.body.classList.contains('game-active'))return false;
  if(context&&context.replay)return false;
  if(typeof online!=='undefined'&&online&&online._replaying)return false;
  return true;
}
function mountHonruGameReaction(kind,context,lifecycle){
  if(lifecycle!==honruGameReactionLifecycle||!honruGameReactionAllowed(context))return false;
  const area=$('board-area');if(!area)return false;
  const state=honruFeedbackState(kind),terminal=!!(context&&context.terminal),priority=terminal?4:(HONRU_STATE_PRIORITY[state]||0),now=Date.now();
  const cooldown=HONRU_STATE_COOLDOWN[state]||0,last=honruGameReactionLastAt[state]||0;
  if(now<honruGameReactionActiveUntil&&priority<honruGameReactionPriority)return false;
  if(now-last<cooldown&&priority<=honruGameReactionPriority)return false;
  removeHonruGameReactionNode(false);
  honruGameReactionPriority=priority;honruGameReactionState=state;
  const duration=(terminal||state==='win'||state==='lose')?(prefersReducedMotion()?1800:2600):(prefersReducedMotion()?1100:1700);
  honruGameReactionActiveUntil=now+duration;honruGameReactionLastAt[state]=now;
  const seq=++honruGameReactionSequence;
  const node=el('div','honru-game-reaction honru-state-'+state);node.id='honru-game-reaction';node.dataset.honruState=state;node.setAttribute('aria-hidden','true');
  const img=document.createElement('img');img.alt='';img.src=honruFallbackUrl();img.decoding='async';node.appendChild(img);area.appendChild(node);
  applyHonruStateImage(img,state,()=>lifecycle===honruGameReactionLifecycle&&seq===honruGameReactionSequence&&node.isConnected&&honruGameReactionAllowed(context));
  honruGameReactionTimer=setTimeout(()=>{
    if(lifecycle===honruGameReactionLifecycle&&seq===honruGameReactionSequence)removeHonruGameReactionNode(true);
  },duration);
  return true;
}
function triggerHonruGameReaction(kind,context){
  if(!honruGameReactionAllowed(context))return false;
  const lifecycle=honruGameReactionLifecycle;
  const run=()=>{try{mountHonruGameReaction(kind,context,lifecycle);}catch{}};
  if(typeof queueMicrotask==='function')queueMicrotask(run);else Promise.resolve().then(run).catch(()=>{});
  return true;
}
function setHonruResultReaction(outcome,context){
  if(context&&context.spectator)return false;
  if(!['win','loss','draw'].includes(outcome))return false;
  const kind=outcome==='win'?'win':outcome==='draw'?'draw':'lose';
  const resultContext={source:context&&context.source||'result',spectator:false,terminal:true,outcome};
  if(typeof document!=='undefined'&&document.body&&document.body.classList.contains('game-active'))return triggerHonruGameReaction(kind,resultContext);
  return setHonruPlatformReaction(kind);
}
function setHonruPlatformReaction(kind){
  if(typeof honruStatesEnabled!=='function'||!honruStatesEnabled()||typeof document==='undefined'||document.hidden)return false;
  const state=honruFeedbackState(kind),seq=++honruPlatformReactionSequence;
  if(honruPlatformReactionTimer){clearTimeout(honruPlatformReactionTimer);honruPlatformReactionTimer=null;}
  // Honru 的可选局内反应没有聊天页或浮层依赖；这里仅保留未来品牌展示位的安全兼容。
  const images=[...document.querySelectorAll('[data-honru-brand-state] img')];
  images.forEach(img=>applyHonruStateImage(img,state,()=>seq===honruPlatformReactionSequence&&img.isConnected));
  honruPlatformReactionTimer=setTimeout(()=>{
    if(seq!==honruPlatformReactionSequence)return;
    const next=++honruPlatformReactionSequence;
    images.filter(img=>img.isConnected).forEach(img=>applyHonruStateImage(img,'idle',()=>next===honruPlatformReactionSequence&&img.isConnected));
    honruPlatformReactionTimer=null;
  },prefersReducedMotion()?1400:2300);
  return images.length>0;
}

/* ================= Game Stage（纯呈现，不写入房间/规则状态） ================= */
const GAME_STAGE_FALLBACK_COLORS = ['#e75a4d','#4c89e8','#e6b43d','#55a86f','#8e6ad8'];
function gameStageLocalized(key,...args){
  const value=typeof t==='function'?t(key,...args):key;
  return value===key&&args.length?key+' '+args.join(' '):value;
}
function gameStageName(gameId){
  const meta=typeof GAMES!=='undefined'&&GAMES&&GAMES[gameId];
  if(!meta)return String(gameId||'');
  return meta.nameKey?gameStageLocalized(meta.nameKey):String(meta.name||gameId);
}
function gameStageIsOnline(){
  return !!(typeof online!=='undefined'&&online&&(online.game||online.spectatorRoom||online.isSpectator));
}
function gameStageSeatModels(){
  const onlineState=typeof online!=='undefined'&&online?online:null;
  const roomSeats=onlineState&&onlineState.roomInfo&&Array.isArray(onlineState.roomInfo.seats)?onlineState.roomInfo.seats:[];
  if(gameStageIsOnline()&&roomSeats.length)return roomSeats.map(seat=>seat&&typeof seat==='object'?seat:null).filter(Boolean);
  const count=Math.max(2,Number(typeof playerCount!=='undefined'&&playerCount)||2);
  const ownName=typeof account!=='undefined'&&account&&(account.name||account.username);
  return Array.from({length:count},(_,seatId)=>({
    seatId,type:seatId>0&&typeof aiMode!=='undefined'&&aiMode?'ai':'human',
    userId:seatId===0&&typeof account!=='undefined'&&account?account.uid||null:null,
    nickname:seatId===0&&ownName?ownName:gameStageLocalized('player_number',seatId+1),
    avatar:seatId===0&&typeof account!=='undefined'&&account?account.avatar||0:(seatId>0&&typeof aiMode!=='undefined'&&aiMode?141:0),
    ready:true,host:false,online:true,aiDifficulty:'normal',aiPersona:null,controllerUid:null,
  }));
}
function gameStageMakeBadge(key,modifier){
  const badge=el('span','game-stage-badge'+(modifier?' '+modifier:''),gameStageLocalized(key));
  badge.setAttribute('data-stage-label',key);badge.setAttribute('data-i18n',key);
  return badge;
}
function gameStageAvatar(seat){
  const profile={uid:seat.userId||'',name:seat.nickname||'',avatar:Number(seat.avatar)||0,frame:0,effect:0};
  if(typeof avatarStageNode==='function'){
    const avatar=avatarStageNode(profile,34,'game-stage-avatar');avatar.setAttribute('aria-hidden','true');return avatar;
  }
  return el('span','game-stage-avatar-fallback',seat.type==='ai'?'✦':'●');
}
function gameStageSeatNode(seat,index,state){
  const seatId=Number.isInteger(Number(seat.seatId))?Number(seat.seatId):index;
  // `null` means the game has not supplied an authoritative turn yet.  Do not
  // coerce it to 0: doing so would briefly label seat 0 as the current player.
  const rawActive=state&&state.activeIdx;
  const active=rawActive!==null&&rawActive!==undefined&&String(rawActive).trim()!==''&&Number.isInteger(Number(rawActive))&&Number(rawActive)===seatId;
  const onlineState=typeof online!=='undefined'&&online?online:null;
  // A room may briefly retain a stale `online.player` during reassignment or
  // restoration. When both authoritative identities are available, never let
  // that legacy index override the UID match. Only a fully identity-less
  // legacy payload may use the index fallback.
  const accountUid=typeof account!=='undefined'&&account&&account.uid!==undefined&&account.uid!==null?String(account.uid):'';
  const seatUid=seat&&seat.userId!==undefined&&seat.userId!==null?String(seat.userId):'';
  const hasIdentityPair=!!(accountUid&&seatUid);
  const identityMissingBoth=!accountUid&&!seatUid;
  const mine=!!(onlineState&&!onlineState.isSpectator&&(hasIdentityPair?seatUid===accountUid:identityMissingBoth&&Number(onlineState.player)===seatId))||(!gameStageIsOnline()&&seatId===0);
  const isAI=seat.type==='ai',isEmpty=seat.type==='empty',isReady=!isEmpty&&!!seat.ready;
  const isOffline=!isEmpty&&!isAI&&seat.online===false;
  const isBankrupt=Array.isArray(state.bankrupts)&&!!state.bankrupts[seatId];
  const card=el('article','pchip game-stage-seat');
  card.dataset.seatKey=String(seatId);card.dataset.seatType=isAI?'ai':isEmpty?'empty':'human';
  card.dataset.seatCurrent=String(active);card.dataset.seatMine=String(mine);card.dataset.seatHost=String(!!seat.host);
  card.dataset.seatReady=String(isReady);card.dataset.seatOnline=String(!isOffline&&!isEmpty);card.dataset.seatBankrupt=String(isBankrupt);
  card.classList.toggle('is-current',active);card.classList.toggle('is-mine',mine);card.classList.toggle('is-host',!!seat.host);
  card.classList.toggle('is-ai',isAI);card.classList.toggle('is-ready',isReady);card.classList.toggle('is-offline',isOffline);card.classList.toggle('is-empty',isEmpty);card.classList.toggle('is-bankrupt',isBankrupt);
  const color=Array.isArray(state.colors)&&state.colors[seatId]||GAME_STAGE_FALLBACK_COLORS[seatId%GAME_STAGE_FALLBACK_COLORS.length];
  if(/^#[0-9a-f]{3,8}$/i.test(String(color))){
    if(card.style&&typeof card.style.setProperty==='function')card.style.setProperty('--stage-seat-color',color);
    else if(card.style)card.style['--stage-seat-color']=color;
  }
  if(isEmpty){
    card.appendChild(el('span','game-stage-seat-empty-mark','＋'));
    const emptyLabel=el('strong','game-stage-seat-name',gameStageLocalized('empty_seat'));emptyLabel.setAttribute('data-i18n','empty_seat');card.appendChild(emptyLabel);
    return card;
  }
  card.appendChild(gameStageAvatar(seat));
  const copy=el('div','game-stage-seat-copy');
  const label=el('strong','game-stage-seat-name',seat.nickname||gameStageLocalized(isAI?'stage_ai_player':'player_number',seatId+1));
  if(seat.nickname)label.setAttribute('data-i18n-raw','');
  copy.appendChild(label);
  const badges=el('span','game-stage-badges');
  if(mine)badges.appendChild(gameStageMakeBadge('stage_you','mine'));
  if(seat.host)badges.appendChild(gameStageMakeBadge('stage_host','host'));
  if(isAI)badges.appendChild(gameStageMakeBadge('stage_ai','ai'));
  if(isReady)badges.appendChild(gameStageMakeBadge('ready','ready'));
  if(isOffline)badges.appendChild(gameStageMakeBadge('offline','offline'));
  if(isBankrupt)badges.appendChild(gameStageMakeBadge('stage_bankrupt','bankrupt'));
  if(active)badges.appendChild(gameStageMakeBadge('stage_current_turn','turn'));
  copy.appendChild(badges);
  // `infos` is an optional, per-seat array supplied by the current game. Do
  // not use `Array.isArray(...) && value` here: a missing/non-array value
  // evaluates to boolean `false`, which would otherwise become visible text.
  const infos=state&&Array.isArray(state.infos)?state.infos:null;
  const info=infos===null?undefined:infos[seatId];
  if(info!==undefined&&info!==null&&String(info)){
    const detail=el('small','game-stage-seat-detail',String(info));
    if(typeof setLocalizedText==='function')setLocalizedText(detail,String(info));
    copy.appendChild(detail);
  }else if(isAI&&seat.aiPersona){
    const detail=el('small','game-stage-seat-detail',String(seat.aiPersona));detail.setAttribute('data-i18n-raw','');copy.appendChild(detail);
  }
  card.appendChild(copy);
  const stateLabels=[];
  if(mine)stateLabels.push(gameStageLocalized('stage_you'));
  if(seat.host)stateLabels.push(gameStageLocalized('stage_host'));
  if(isAI)stateLabels.push(gameStageLocalized('stage_ai'));
  if(active)stateLabels.push(gameStageLocalized('stage_current_turn'));
  card.setAttribute('aria-label',[seat.nickname||gameStageLocalized('player_number',seatId+1),...stateLabels].filter(Boolean).join(' · '));
  return card;
}
function renderGameStage(nextState){
  const stage=$('screen-game');if(!stage)return false;
  const next=nextState&&typeof nextState==='object'?nextState:{};
  if(next.reset)ghostGameStageState={gameId:null,activeIdx:null,infos:null,bankrupts:null,colors:null};
  ['gameId','activeIdx','infos','bankrupts','colors'].forEach(key=>{if(Object.prototype.hasOwnProperty.call(next,key))ghostGameStageState[key]=next[key];});
  const onlineState=typeof online!=='undefined'&&online?online:null;
  const gameId=ghostGameStageState.gameId||typeof currentGameId!=='undefined'&&currentGameId||onlineState&&onlineState.game||'';
  if(gameId)ghostGameStageState.gameId=gameId;
  stage.dataset.stageGame=String(gameId||'');
  stage.classList.toggle('arena-first',gameId==='tank'||gameId==='tetris');
  const watching=!!(onlineState&&(onlineState.isSpectator||onlineState.spectatorRoom));
  stage.classList.toggle('stage-spectator',watching);
  const title=$('game-title');if(title&&gameId)title.textContent=gameStageName(gameId);
  const mode=$('game-stage-mode');
  const modeKey=watching?'stage_spectating':gameStageIsOnline()?'stage_online_match':typeof aiMode!=='undefined'&&aiMode?'stage_ai_match':'stage_local_match';
  if(mode){mode.setAttribute('data-i18n',modeKey);mode.textContent=gameStageLocalized(modeKey);}
  const spectators=$('game-stage-spectators'),count=Math.max(0,Number(onlineState&&onlineState.roomInfo&&onlineState.roomInfo.spectatorCount)||0);
  if(spectators){spectators.classList.toggle('hidden',!count);spectators.textContent=gameStageLocalized('stage_spectator_count',count);}
  const rail=$('player-bar');if(!rail)return true;
  rail.innerHTML='';rail.setAttribute('data-stage-seat-count','0');
  const seats=gameStageSeatModels();
  seats.forEach((seat,index)=>rail.appendChild(gameStageSeatNode(seat,index,ghostGameStageState)));
  if(watching){
    const observer=el('article','pchip game-stage-seat game-stage-observer');observer.dataset.seatType='spectator';
    observer.appendChild(el('span','game-stage-observer-mark','◌'));observer.appendChild(el('strong','game-stage-seat-name',gameStageLocalized('stage_spectating')));
    observer.appendChild(gameStageMakeBadge('spectator_readonly','spectator'));rail.appendChild(observer);
  }
  rail.setAttribute('data-stage-seat-count',String(seats.length));
  return true;
}

function routeFromHash(){
  const match = /^#\/(home|games|chat|profile)(?:$|[?&])/.exec(String(typeof location!=='undefined'&&location.hash || ''));
  return match ? match[1] : 'home';
}
function chatViewFromHash(){
  return 'players';
}
function setChatView(view,options){
  // 旧 #/chat?view=honru 和未知 view 一律收敛到真实玩家私聊，避免遗留深链访问已移除的助手界面。
  ghostChatView='players';
  const title=$('chat-route-title'),intro=$('chat-route-intro');
  if(title)title.textContent=t('chat_title');
  if(intro)intro.textContent=t('chat_intro');
  renderPlayerChat();if(online&&online.connected&&online._authenticated)online.requestChatList();
  if(typeof history!=='undefined'){
    const next='#/chat';
    if(location.hash!==next){const method=options&&options.silentHash||options&&options.replace?'replaceState':'pushState';if(typeof history[method]==='function')history[method](null,'',next);}
  }
}
function setAppRoute(route, options){
  route = GHOST_APP_ROUTES.includes(route) ? route : 'home';
  if (!account && typeof openAuthModal === 'function') { openAuthModal(route === 'profile' ? 'login' : 'login'); return; }
  ghostAppRoute = route;
  if (typeof showHub === 'function') showHub();
  document.querySelectorAll('[data-app-route]').forEach(node => node.classList.toggle('hidden', node.getAttribute('data-app-route') !== route));
  document.querySelectorAll('[data-app-route-target]').forEach(node => {
    const active = node.getAttribute('data-app-route-target') === route;
    if (active) node.setAttribute('aria-current','page'); else node.removeAttribute('aria-current');
  });
  if (!(options && options.silentHash)){
    const next = '#/' + route;
    if (typeof location!=='undefined'&&location.hash !== next&&typeof history!=='undefined'){
      const method=options&&options.replace?'replaceState':'pushState';if(typeof history[method]==='function')history[method](null,'',next);
    }
  }
  if (route === 'home') renderGhostHome();
  if (route === 'profile') renderGhostProfile();
  if (route === 'chat') setChatView('players',{silentHash:true});
  resetGhostHeroTimer();
}
function renderGhostHome(){
  const title = $('home-welcome-title'), copy = $('home-welcome-copy'), live = $('home-live-status');
  if (title) title.textContent = account ? t('home_welcome_user', account.name || t('default_player_name')) : t('home_welcome_guest');
  if (copy) copy.textContent = account && account.ephemeral ? t('home_guest_session_notice') : t('home_welcome_copy');
  if (live){
    live.innerHTML = '';
    const rows = [
      [t('home_server'), online && online.connected ? t('online_status_connected') : t('online_status_disconnected')],
      [t('home_online_players'), String((lastServerLB && lastServerLB.online) || 0)],
      [t('home_current_mode'), aiMode ? t('mode_ai') : t('mode_online')],
    ];
    rows.forEach(parts => { const row=el('div','home-status-line'); row.appendChild(el('span',null,parts[0])); row.appendChild(el('strong',null,parts[1])); live.appendChild(row); });
  }
}
function chatRawNode(tag,className,text){
  const node=typeof elRaw==='function'?elRaw(tag,className||null,String(text===undefined||text===null?'':text)):el(tag,className||null,String(text===undefined||text===null?'':text));
  node.setAttribute('data-i18n-raw','');return node;
}
function chatTimeLabel(value){
  const date=new Date(Number(value)||Date.now());
  try{return new Intl.DateTimeFormat(currentLang,{hour:'2-digit',minute:'2-digit'}).format(date);}catch{return date.toLocaleTimeString().slice(0,5);}
}
function chatConversationByPeer(peerUid){
  const state=typeof online!=='undefined'&&online.chatState||{};
  return (state.conversations||[]).find(item=>item&&item.peer&&item.peer.uid===peerUid)||null;
}
function updateChatUnreadBadge(){
  const count=Math.max(0,Number(typeof online!=='undefined'&&online.chatState&&online.chatState.unreadTotal)||0);
  document.querySelectorAll('[data-chat-unread]').forEach(node=>{node.textContent=count>99?'99+':String(count);node.classList.toggle('hidden',!count);});
}
function chatEmptyNode(titleKey,bodyKey,action){
  const wrap=el('div','chat-empty'),copy=el('div');copy.appendChild(el('strong',null,t(titleKey)));copy.appendChild(el('span',null,t(bodyKey)));
  if(action){const button=el('button','btn btn-primary',t(action.label));button.addEventListener('click',action.run);copy.appendChild(button);}
  wrap.appendChild(copy);return wrap;
}
function openPlayerConversation(peerUid){
  peerUid=String(peerUid||'');if(!peerUid)return false;
  if(typeof online==='undefined')return false;
  online.chatActivePeerUid=peerUid;
  setAppRoute('chat',{chatView:'players'});
  const shell=$('player-chat-shell');if(shell)shell.classList.add('thread-open');
  online.requestChatHistory(peerUid);
  renderPlayerChat();
  requestAnimationFrame(()=>{const title=$('chat-thread-title');if(title)title.focus();});
  return true;
}
function renderPlayerChat(){
  const list=$('chat-conversation-list'),messages=$('chat-thread-messages'),input=$('chat-input'),send=$('btn-chat-send'),note=$('chat-composer-note');
  if(!list||!messages||typeof online==='undefined')return;
  const connection=$('chat-connection'),listStatus=$('chat-list-status');
  if(connection)connection.classList.toggle('connected',!!(online.connected&&online._authenticated));
  if(listStatus)listStatus.textContent=t(online.connected&&online._authenticated?'chat_connected':'chat_disconnected');
  list.innerHTML='';
  const isGuest=!!(account&&account.ephemeral);
  const conversations=online.chatState&&Array.isArray(online.chatState.conversations)?online.chatState.conversations:[];
  if(!account||isGuest){
    list.appendChild(chatEmptyNode(isGuest?'chat_guest_title':'chat_login_title',isGuest?'chat_guest_body':'chat_login_body',isGuest?null:{label:'login',run:()=>openAuthModal('login')}));
  }else if(!conversations.length){
    const hasFriends=!!(online.socialState&&online.socialState.counts&&online.socialState.counts.friends);
    list.appendChild(chatEmptyNode(hasFriends?'chat_no_conversations_title':'chat_no_friends_title',hasFriends?'chat_no_conversations_body':'chat_no_friends_body',{label:'nav_games',run:()=>setAppRoute('games')}));
  }else{
    conversations.forEach(item=>{
      const peer=item.peer||{},row=el('button','chat-conversation-row');row.type='button';row.dataset.peerUid=peer.uid||'';row.setAttribute('data-i18n-raw','');
      if(peer.uid===online.chatActivePeerUid)row.setAttribute('aria-current','true');
      const avatar=avatarStageNode(peer,40);avatar.setAttribute('aria-hidden','true');row.appendChild(avatar);
      const copy=el('span','chat-conversation-copy');copy.appendChild(chatRawNode('span','chat-conversation-name',peer.name||t('social_player')));
      copy.appendChild(chatRawNode('span','chat-conversation-preview',item.lastMessage&&item.lastMessage.text||t('chat_start_conversation')));row.appendChild(copy);
      const meta=el('span','chat-conversation-meta');if(item.lastMessage)meta.appendChild(el('span',null,chatTimeLabel(item.lastMessage.createdAt)));
      if(Number(item.unreadCount)>0)meta.appendChild(el('span','chat-unread',String(Math.min(99,Number(item.unreadCount)))));row.appendChild(meta);
      row.addEventListener('click',()=>{chatLastConversationFocus=peer.uid;openPlayerConversation(peer.uid);});list.appendChild(row);
    });
  }
  updateChatUnreadBadge();
  const peerUid=online.chatActivePeerUid,summary=peerUid&&chatConversationByPeer(peerUid),peer=summary&&summary.peer;
  const title=$('chat-thread-title'),presence=$('chat-thread-presence'),avatarHolder=$('chat-thread-avatar'),profileButton=$('btn-chat-profile');
  if(!peer){
    if(title)title.textContent=t(isGuest?'chat_guest_title':'chat_select_title');if(presence)presence.textContent=t(isGuest?'chat_guest_body':'chat_select_hint');
    if(avatarHolder)avatarHolder.innerHTML='';if(profileButton)profileButton.classList.add('hidden');messages.innerHTML='';messages.appendChild(chatEmptyNode(isGuest?'chat_guest_title':'chat_select_title',isGuest?'chat_guest_body':'chat_select_hint'));
    if(input)input.disabled=true;if(send)send.disabled=true;if(note)note.textContent=t(isGuest?'chat_guest_body':'chat_select_first');return;
  }
  if(title){title.textContent=peer.name||t('social_player');title.setAttribute('data-i18n-raw','');}
  if(presence)presence.textContent=(typeof presenceLabel==='function'?presenceLabel(peer.presence||'offline'):String(peer.presence||''))+' · '+t(peer.relationship==='friends'?'social_friend':'chat_history_read_only');
  if(avatarHolder){avatarHolder.innerHTML='';avatarHolder.appendChild(avatarStageNode(peer,38));}
  if(profileButton){profileButton.classList.remove('hidden');profileButton.onclick=()=>openProfileModal(peer.uid);}
  const rows=Array.isArray(online.chatHistory[peerUid])?online.chatHistory[peerUid]:[],pending=[...online.chatPending.entries()].filter(([,item])=>item.peerUid===peerUid);
  messages.setAttribute('aria-live','off');messages.innerHTML='';
  const meta=online.chatHistoryMeta&&online.chatHistoryMeta[peerUid];
  if(meta&&meta.hasMore){const older=el('button','btn',t('chat_load_older'));older.addEventListener('click',()=>online.requestChatHistory(peerUid,meta.nextBeforeSeq));messages.appendChild(older);}
  if(!rows.length&&!pending.length)messages.appendChild(chatEmptyNode('chat_no_messages_title','chat_no_messages_body'));
  rows.forEach(message=>{
    const mine=account&&message.senderUid===account.uid,bubble=chatRawNode('div','chat-message'+(mine?' mine':''),message.text);bubble.dataset.messageId=message.id||'';
    const read=mine&&summary&&String(summary.peerReadThroughSeq||'0').localeCompare(String(message.seq||'0'),undefined,{numeric:true})>=0;
    bubble.appendChild(el('span','chat-message-meta',chatTimeLabel(message.createdAt)+(mine?' · '+t(read?'chat_read':'chat_sent'):'')));messages.appendChild(bubble);
  });
  pending.forEach(([id,item])=>{if(rows.some(row=>row.id===item.messageId))return;const bubble=chatRawNode('div','chat-message mine pending',item.text);const retry=el('button','chat-message-meta',t(item.status==='failed'?'chat_retry':'chat_sending'));retry.disabled=item.status!=='failed';if(item.status==='failed')retry.addEventListener('click',()=>{online.sendChatMessage(item.peerUid,item.text,id);renderPlayerChat();});bubble.appendChild(retry);messages.appendChild(bubble);});
  const canSend=!!(online.connected&&online._authenticated&&!isGuest&&peer.relationship==='friends');
  if(input){input.disabled=!canSend;const draft=online.chatDrafts.get(peerUid)||'';if(document.activeElement!==input)input.value=draft;input.placeholder=t(canSend?'chat_placeholder':online.connected?'chat_read_only_placeholder':'chat_offline_placeholder');}
  if(send)send.disabled=!canSend;if(note)note.textContent=t(canSend?'chat_enter_hint':online.connected?'chat_history_read_only':'chat_disconnected_read_only');
  messages.scrollTop=messages.scrollHeight;requestAnimationFrame(()=>messages.setAttribute('aria-live','polite'));
}
function handlePlayerChatHistory(payload){
  const peerUid=payload&&payload.peer&&payload.peer.uid;if(!peerUid)return;
  online.chatHistoryMeta=online.chatHistoryMeta||{};online.chatHistoryMeta[peerUid]={hasMore:!!payload.hasMore,nextBeforeSeq:payload.nextBeforeSeq||null};renderPlayerChat();
}
function handlePlayerChatMessage(payload){
  const message=payload&&payload.message||{},peerUid=message.senderUid===account.uid?message.recipientUid:message.senderUid;
  if(peerUid===online.chatActivePeerUid&&ghostAppRoute==='chat'&&ghostChatView==='players'&&message.recipientUid===account.uid)online.markChatRead(peerUid,message.seq);
  renderPlayerChat();
}
function handlePlayerChatSendAck(payload){
  const message=payload&&payload.message,clientId=payload&&payload.clientMessageId;if(message){const peerUid=message.recipientUid===account.uid?message.senderUid:message.recipientUid,rows=online.chatHistory[peerUid]||[];if(!rows.some(item=>item.id===message.id))rows.push(message);online.chatHistory[peerUid]=rows;online.chatDrafts.delete(peerUid);const input=$('chat-input');if(input&&peerUid===online.chatActivePeerUid)input.value='';}
  if(clientId)online.chatPending.delete(clientId);renderPlayerChat();
}
function handlePlayerChatRead(){renderPlayerChat();}
function handlePlayerChatError(payload){
  const reason=String(payload&&payload.reason||'server_unavailable'),key='chat_error_'+reason;
  toast(t(key)===key?t('chat_error_generic'):t(key));renderPlayerChat();
}
function initPlayerChat(){
  const refresh=$('btn-chat-refresh');if(refresh)refresh.addEventListener('click',()=>online.requestChatList());
  const back=$('btn-chat-back');if(back)back.addEventListener('click',()=>{const shell=$('player-chat-shell');if(shell)shell.classList.remove('thread-open');online.chatActivePeerUid=null;renderPlayerChat();requestAnimationFrame(()=>{const row=document.querySelector('.chat-conversation-row[data-peer-uid="'+String(chatLastConversationFocus||'').replace(/"/g,'')+'"]');if(row)row.focus();});});
  const input=$('chat-input');if(input){input.addEventListener('input',()=>{if(online.chatActivePeerUid)online.chatDrafts.set(online.chatActivePeerUid,input.value);input.style.height='auto';input.style.height=Math.min(132,input.scrollHeight)+'px';});input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();const form=$('chat-composer');if(form)form.requestSubmit();}});}
  const form=$('chat-composer');if(form)form.addEventListener('submit',event=>{event.preventDefault();const peerUid=online.chatActivePeerUid,text=String(($('chat-input')||{}).value||'');if(!peerUid||!text.trim())return;online.sendChatMessage(peerUid,text);renderPlayerChat();});
  renderPlayerChat();updateChatUnreadBadge();
}
function renderGhostProfile(){
  const root = $('ghost-profile-overview');
  if (!root || !account) return;
  if(ghostProfileBackgroundNode&&typeof releasePremiumBackground==='function')releasePremiumBackground(ghostProfileBackgroundNode);
  root.innerHTML = '';
  const level=Math.max(1,Number(account.level)||1),xpProgress=account.xpProgress&&typeof account.xpProgress==='object'?account.xpProgress:null;
  const xpCurrent=Math.max(0,Number(xpProgress&&xpProgress.current)||0),xpRequired=Math.max(1,Number(xpProgress&&xpProgress.required)||1),xpPercent=Math.max(0,Math.min(100,Math.round(xpCurrent/xpRequired*100)));
  const total=Math.max(0,Number(account.total)||0),totalWins=Math.max(0,Number(account.totalWins)||0),winRate=total?Math.round(totalWins/total*100):null;
  const games=(typeof GAME_KEYS!=='undefined'?GAME_KEYS:Object.keys(GAMES)).filter(id=>GAMES[id]);
  const unlocked=new Set(Array.isArray(account.achievements)?account.achievements:[]),titleInfo=typeof titleFor==='function'?titleFor(level):{icon:'✦',nameKey:'social_title_1'};

  const hero=el('section','profile-route-hero profile-hero bg-'+Number(account.background||0));ghostProfileBackgroundNode=hero;
  if(typeof applyPremiumBackground==='function')applyPremiumBackground(hero,account.background||0,'profile');
  const heroScrim=el('div','profile-route-hero-scrim'),identity=el('div','profile-route-identity');identity.appendChild(avatarStageNode(account,108));
  const identityCopy=el('div','profile-route-identity-copy'),name=el('div','profile-route-name');name.appendChild(nameFxNode(account,account.name||t('default_player_name')));name.appendChild(el('span','profile-lang-flag',langFlag(account.lang||currentLang)));identityCopy.appendChild(name);
  identityCopy.appendChild(el('div','profile-route-title',titleInfo.icon+' '+(titleInfo.nameKey?t(titleInfo.nameKey):'')+' · '+t(account.ephemeral?'guest_account_badge':'profile_level_short',level)));
  const presenceText=typeof profilePresenceLabel==='function'?profilePresenceLabel(account.presence||'offline'):String(account.presence||'');
  identityCopy.appendChild(el('div','profile-route-presence',presenceText+(account.countryRegion&&typeof profileRegionLabel==='function'?' · '+profileRegionLabel(account.countryRegion):'')));
  if(account.signature)identityCopy.appendChild(chatRawNode('p','profile-route-signature','“'+String(account.signature).slice(0,80)+'”'));
  const showcase=typeof profileShowcaseText==='function'?profileShowcaseText(account):'';if(showcase)identityCopy.appendChild(el('div','profile-route-showcase',showcase));
  identity.appendChild(identityCopy);heroScrim.appendChild(identity);
  const heroActions=el('div','profile-route-hero-actions');[['edit_profile',()=>openProfileEditor(account.uid),'btn-primary'],['shop',()=>account.ephemeral?toast(t('guest_persistence_disabled')):openShop(),'']].forEach(([key,fn,cls])=>{const button=el('button','btn '+cls,t(key));button.addEventListener('click',fn);heroActions.appendChild(button);});heroScrim.appendChild(heroActions);hero.appendChild(heroScrim);root.appendChild(hero);

  const growth=el('section','home-glass-card profile-growth-card');
  const growthHead=el('div','profile-section-head');growthHead.appendChild(el('div',null,t('profile_growth_title')));growthHead.appendChild(el('span',null,t('profile_xp_progress',xpCurrent,xpRequired)));growth.appendChild(growthHead);
  const progress=el('div','profile-xp-progress');progress.setAttribute('role','progressbar');progress.setAttribute('aria-label',t('profile_xp_aria'));progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax',String(xpRequired));progress.setAttribute('aria-valuenow',String(xpCurrent));const fill=el('span');fill.style.width=xpPercent+'%';progress.appendChild(fill);growth.appendChild(progress);
  const stats=el('div','profile-route-stats');[
    ['profile_stat_level',String(level)],['profile_stat_games',String(total)],['profile_stat_wins',String(totalWins)],['profile_stat_win_rate',winRate===null?'—':winRate+'%'],['profile_stat_streak',String(account.streak||0)],['profile_stat_best_streak',String(account.bestStreak||0)],['profile_stat_achievements',unlocked.size+'/'+(typeof ACHIEVEMENTS!=='undefined'?ACHIEVEMENTS.length:8)],['profile_stat_balance',String(account.coins||0)+'💵'],
  ].forEach(([key,value])=>{const item=el('div','profile-route-stat');item.appendChild(el('strong',null,value));item.appendChild(el('span',null,t(key)));stats.appendChild(item);});growth.appendChild(stats);root.appendChild(growth);

  const content=el('div','profile-route-content'),main=el('div','profile-route-main'),side=el('aside','profile-route-side');
  const gameSection=el('section','home-glass-card profile-route-section');const gameHead=el('div','profile-section-head');gameHead.appendChild(el('h2',null,t('profile_games_title')));gameHead.appendChild(el('span',null,t('profile_games_subtitle')));gameSection.appendChild(gameHead);
  const gameGrid=el('div','profile-game-grid');games.forEach(id=>{const played=Math.max(0,Number(account.played&&account.played[id])||0),wins=Math.max(0,Number(account.wins&&account.wins[id])||0),rate=played?Math.round(wins/played*100):null,card=el('button','profile-game-card');card.type='button';card.addEventListener('click',()=>setAppRoute('games'));card.appendChild(el('span','profile-game-icon',GAMES[id].icon||'🎮'));const copy=el('span');copy.appendChild(el('strong',null,GAMES[id].name||t(GAMES[id].nameKey)));copy.appendChild(el('small',null,t('profile_game_record',played,wins,rate===null?'—':rate+'%')));card.appendChild(copy);gameGrid.appendChild(card);});gameSection.appendChild(gameGrid);main.appendChild(gameSection);

  const achievementSection=el('section','home-glass-card profile-route-section');const achievementHead=el('div','profile-section-head');achievementHead.appendChild(el('h2',null,t('profile_achievements_title')));const viewAll=el('button','btn',t('profile_view_all'));viewAll.addEventListener('click',()=>openAchievementsModal());achievementHead.appendChild(viewAll);achievementSection.appendChild(achievementHead);
  const achievementGrid=el('div','profile-achievement-grid');(typeof ACHIEVEMENTS!=='undefined'?ACHIEVEMENTS:[]).forEach(item=>{const earned=unlocked.has(item.id),card=el('div','profile-achievement'+(earned?' unlocked':' locked'));card.appendChild(el('span','profile-achievement-icon',item.icon));const copy=el('span');copy.appendChild(el('strong',null,t(item.nameKey)));copy.appendChild(el('small',null,t(earned?'profile_achievement_unlocked':'profile_achievement_locked')));card.appendChild(copy);achievementGrid.appendChild(card);});achievementSection.appendChild(achievementGrid);main.appendChild(achievementSection);

  const taskSection=el('section','home-glass-card profile-route-section');const taskHead=el('div','profile-section-head');taskHead.appendChild(el('h2',null,t('daily_tasks_title')));taskHead.appendChild(el('span',null,t('profile_tasks_today')));taskSection.appendChild(taskHead);
  const serverTasks=online&&online.dailyTasks&&Array.isArray(online.dailyTasks.tasks)?online.dailyTasks.tasks:[],taskMeta=new Map((typeof DAILY_TASKS!=='undefined'?DAILY_TASKS:[]).map(item=>[item.id,item]));
  const taskList=el('div','profile-task-list');if(!serverTasks.length)taskList.appendChild(el('div','profile-compact-empty',t(online&&online.connected?'profile_tasks_loading':'profile_tasks_offline')));serverTasks.forEach(task=>{const meta=taskMeta.get(task.id)||{},row=el('div','profile-task-row'+(task.claimed?' completed':''));row.appendChild(el('span','profile-task-icon',meta.icon||'✦'));const copy=el('div');copy.appendChild(el('strong',null,t(meta.nameKey||'daily_tasks_title')));copy.appendChild(el('small',null,String(task.progress||0)+' / '+String(task.target||0)));row.appendChild(copy);if(task.claimed)row.appendChild(el('span','profile-task-state',t('profile_task_claimed')));else if(Number(task.progress)>=Number(task.target)){const claim=el('button','btn btn-primary',t('daily_task_claim',task.reward||0));claim.disabled=!!account.ephemeral;claim.addEventListener('click',()=>online.claimDailyTask(task.id));row.appendChild(claim);}taskList.appendChild(row);});taskSection.appendChild(taskList);side.appendChild(taskSection);

  const socialSection=el('section','home-glass-card profile-route-section');const socialHead=el('div','profile-section-head');socialHead.appendChild(el('h2',null,t('profile_social_title')));socialHead.appendChild(el('span',null,t('profile_friend_summary',online&&online.socialState&&online.socialState.counts&&online.socialState.counts.friends||0,(online&&online.socialState&&online.socialState.friends||[]).filter(item=>item.presence&&item.presence!=='offline').length)));socialSection.appendChild(socialHead);
  const people=el('div','profile-people-list'),friends=(online&&online.socialState&&online.socialState.friends||[]).slice(0,4);friends.forEach(friend=>{const row=el('button','profile-person-row');row.type='button';row.appendChild(avatarStageNode(friend,34));const copy=el('span');copy.appendChild(chatRawNode('strong',null,friend.name||t('social_player')));copy.appendChild(el('small',null,typeof presenceLabel==='function'?presenceLabel(friend.presence||'offline'):''));row.appendChild(copy);row.addEventListener('click',()=>openPlayerConversation(friend.uid));people.appendChild(row);});
  const friendIds=new Set(friends.map(item=>item.uid)),mates=typeof recentPlaymates==='function'?recentPlaymates(account,4):[];mates.filter(item=>!friendIds.has(item.uid)).slice(0,2).forEach(mate=>{const row=el('button','profile-person-row');row.type='button';row.appendChild(el('span','profile-person-fallback','◎'));const copy=el('span');copy.appendChild(chatRawNode('strong',null,mate.name||t('social_player')));copy.appendChild(el('small',null,t('profile_played_together',mate.count||0)));row.appendChild(copy);row.addEventListener('click',()=>openProfileModal(mate.uid));people.appendChild(row);});if(!people.childNodes.length)people.appendChild(el('div','profile-compact-empty',t('profile_social_empty')));socialSection.appendChild(people);side.appendChild(socialSection);

  const collectionSection=el('section','home-glass-card profile-route-section');const collectionHead=el('div','profile-section-head');collectionHead.appendChild(el('h2',null,t('profile_collection_title')));const shopButton=el('button','btn',t('shop'));shopButton.addEventListener('click',()=>account.ephemeral?toast(t('guest_persistence_disabled')):openShop());collectionHead.appendChild(shopButton);collectionSection.appendChild(collectionHead);
  const owned=account.owned||{},collectionGrid=el('div','profile-collection-grid');[['profile_collection_avatars',(owned.avatars||[]).length],['profile_collection_frames',(owned.frames||[]).length],['profile_collection_effects',(owned.effects||[]).length],['profile_collection_backgrounds',(owned.backgrounds||[]).length],['profile_collection_game_cosmetics',(owned.game_cosmetics||[]).length]].forEach(([key,count])=>{const item=el('div','profile-collection-item');item.appendChild(el('strong',null,String(count)));item.appendChild(el('span',null,t(key)));collectionGrid.appendChild(item);});collectionSection.appendChild(collectionGrid);side.appendChild(collectionSection);

  const replaySection=el('section','home-glass-card profile-route-section');const replayHead=el('div','profile-section-head');replayHead.appendChild(el('h2',null,t('profile_replays_title')));replayHead.appendChild(el('span',null,t('profile_replays_retention')));replaySection.appendChild(replayHead);const ownReplays=(online&&Array.isArray(online.replays)?online.replays:[]).filter(item=>item&&item.canShare===true).slice(0,3),replayList=el('div','profile-replay-list');ownReplays.forEach(item=>{const row=el('button','profile-replay-row');row.type='button';row.appendChild(el('span',null,GAMES[item.game]&&GAMES[item.game].icon||'🎮'));row.appendChild(el('strong',null,GAMES[item.game]&&(GAMES[item.game].name||t(GAMES[item.game].nameKey))||item.game));row.appendChild(el('small',null,t('replay_events',item.eventCount||0)));row.addEventListener('click',()=>online.requestReplay(item.replayId));replayList.appendChild(row);});if(!ownReplays.length)replayList.appendChild(el('div','profile-compact-empty',t('profile_replays_empty')));replaySection.appendChild(replayList);side.appendChild(replaySection);
  content.appendChild(main);content.appendChild(side);root.appendChild(content);

  const footer=el('section','profile-route-footer');const edit=el('button','btn',t('edit_profile'));edit.addEventListener('click',()=>openProfileEditor(account.uid));footer.appendChild(edit);const logout=el('button','btn',t(account.ephemeral?'profile_guest_logout':'logout'));logout.addEventListener('click',logoutAccount);footer.appendChild(logout);root.appendChild(footer);
}
function setGhostHero(index){
  const slides=[...document.querySelectorAll('[data-hero-slide]')];
  if (!slides.length) return;
  ghostHeroIndex=((Number(index)||0)+slides.length)%slides.length;
  slides.forEach((node,i)=>node.classList.toggle('active',i===ghostHeroIndex));
  document.querySelectorAll('[data-hero-dot]').forEach((node,i)=>node.setAttribute('aria-selected',String(i===ghostHeroIndex)));
}
function resetGhostHeroTimer(){
  if (ghostHeroTimer){clearInterval(ghostHeroTimer);ghostHeroTimer=null;}
  if (ghostAppRoute !== 'home' || prefersReducedMotion()) return;
  ghostHeroTimer=setInterval(()=>{if(!document.hidden)setGhostHero(ghostHeroIndex+1);},6500);
}
function petHonru(){
  if (online && online.connected && online._authenticated) online.send({type:'companion_checkin',payload:{actionId:'pet-'+Date.now().toString(36)}});
  else toast(t('honru_pet_local'));
  setHonruPlatformReaction('check-in');
}
function handleCompanionCheckin(payload){
  toast(t(payload&&payload.already?'honru_checkin_again':'honru_checkin_success'));
  setHonruPlatformReaction(payload&&payload.already?'idle':'check-in');
}
function enterGhostApp(options){
  document.body.classList.remove('ghost-shell-booting','auth-required');document.body.classList.add('authenticated');
  const app=$('app');if(app){app.hidden=false;app.inert=false;app.removeAttribute('aria-hidden');}
  if (authModalEl){releaseModalScrollLock(authModalEl);authModalEl.remove();authModalEl=null;}
  setAppRoute(routeFromHash(),{replace:true,silentHash:!!(options&&options.silentHash)});
  renderGhostHome();renderGhostProfile();
}
function requireGhostAuth(mode){
  clearHonruGameReaction();
  document.body.classList.remove('ghost-shell-booting','authenticated');document.body.classList.add('auth-required');
  const app=$('app');if(app){app.inert=true;app.hidden=true;app.setAttribute('aria-hidden','true');}
  if (typeof openAuthModal==='function') openAuthModal(mode||'login');
}
function initGhostShell(){
  document.querySelectorAll('[data-app-route-target]').forEach(node=>node.addEventListener('click',()=>setAppRoute(node.getAttribute('data-app-route-target'))));
  document.querySelectorAll('[data-hero-dot]').forEach(node=>node.addEventListener('click',()=>{setGhostHero(node.getAttribute('data-hero-dot'));resetGhostHeroTimer();}));
  const checkin=$('btn-home-checkin');if(checkin)checkin.addEventListener('click',petHonru);
  initPlayerChat();
  if(window&&typeof window.addEventListener==='function')window.addEventListener('hashchange',()=>{const route=routeFromHash();if(GHOST_APP_ROUTES.includes(route)&&(route!==ghostAppRoute||route==='chat'))setAppRoute(route,{silentHash:true});});
  setGhostHero(0);resetGhostHeroTimer();
}
