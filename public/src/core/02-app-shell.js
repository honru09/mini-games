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
const GAME_SHELL_SCROLL_KEYS = new Set([' ','Spacebar','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End']);
let immersiveGameShellState={active:false,gameId:null,scrollX:0,scrollY:0,returnFocus:null,listeners:false};
function gameShellStage(){return typeof $==='function'?$('screen-game'):typeof document!=='undefined'?document.getElementById('screen-game'):null;}
function gameShellClosest(target,selector){try{return target&&typeof target.closest==='function'?target.closest(selector):null;}catch{return null;}}
function gameShellHasExternalModal(target,stage){const modal=gameShellClosest(target,'.modal-backdrop');return !!(modal&&stage&&typeof stage.contains==='function'&&!stage.contains(modal));}
function gameShellUsesNativeKeys(target){
  if(!target)return false;
  const tag=String(target.tagName||'').toUpperCase();
  if(['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(tag))return true;
  return !!(target.isContentEditable||gameShellClosest(target,'[contenteditable="true"]'));
}
function gameShellInsideScrollRegion(target){return !!gameShellClosest(target,'[data-game-scroll-region]');}
function gameShellOwnsEvent(target,stage){
  if(!stage||gameShellHasExternalModal(target,stage))return false;
  if(target===document.body||target===document.documentElement)return true;
  return typeof stage.contains==='function'&&stage.contains(target);
}
function gameShellFocusable(stage){
  if(!stage||typeof stage.querySelectorAll!=='function')return [];
  const selector='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(stage.querySelectorAll(selector)).filter(node=>node&&!node.disabled&&!node.hidden&&node.tabIndex!==-1);
}
function gameShellKeydown(event){
  if(!immersiveGameShellState.active)return;
  const stage=gameShellStage();if(!gameShellOwnsEvent(event&&event.target,stage))return;
  if(event.key==='Tab'){
    const items=gameShellFocusable(stage);if(!items.length)return;
    const active=document.activeElement,index=items.indexOf(active);
    if(event.shiftKey&&(index<=0)){event.preventDefault();items[items.length-1].focus();}
    else if(!event.shiftKey&&(index===items.length-1||index<0)){event.preventDefault();items[0].focus();}
    return;
  }
  if(GAME_SHELL_SCROLL_KEYS.has(event.key)&&!gameShellUsesNativeKeys(event.target))event.preventDefault();
}
function gameShellWheel(event){
  if(!immersiveGameShellState.active)return;
  const stage=gameShellStage();if(!gameShellOwnsEvent(event&&event.target,stage)||gameShellInsideScrollRegion(event.target))return;
  event.preventDefault();
}
function gameShellTouchMove(event){
  if(!immersiveGameShellState.active)return;
  const stage=gameShellStage();if(!gameShellOwnsEvent(event&&event.target,stage)||gameShellInsideScrollRegion(event.target))return;
  event.preventDefault();
}
function installImmersiveGameShellListeners(){
  if(immersiveGameShellState.listeners||typeof document==='undefined'||typeof document.addEventListener!=='function')return;
  document.addEventListener('keydown',gameShellKeydown,{capture:true});
  document.addEventListener('wheel',gameShellWheel,{capture:true,passive:false});
  document.addEventListener('touchmove',gameShellTouchMove,{capture:true,passive:false});
  immersiveGameShellState.listeners=true;
}
function removeImmersiveGameShellListeners(){
  if(!immersiveGameShellState.listeners||typeof document==='undefined'||typeof document.removeEventListener!=='function')return;
  document.removeEventListener('keydown',gameShellKeydown,{capture:true});
  document.removeEventListener('wheel',gameShellWheel,{capture:true});
  document.removeEventListener('touchmove',gameShellTouchMove,{capture:true});
  immersiveGameShellState.listeners=false;
}
function dispatchImmersiveGameShellChange(active,gameId){
  try{if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('ghostgame:shellchange',{detail:{active:!!active,gameId:gameId?String(gameId):null}}));}catch{}
}
function gameShellReturnTarget(returnFocus,gameId){
  const genericRoot=typeof document!=='undefined'&&(returnFocus===document.body||returnFocus===document.documentElement);
  if(returnFocus&&!genericRoot&&returnFocus.isConnected!==false&&typeof returnFocus.focus==='function')return returnFocus;
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function'||!gameId)return null;
  try{return Array.from(document.querySelectorAll('[data-game-id]')).find(node=>node&&node.dataset&&node.dataset.gameId===String(gameId)&&typeof node.focus==='function')||null;}catch{return null;}
}
function enterImmersiveGameShell(gameId){
  const stage=gameShellStage();if(!stage)return false;
  if(immersiveGameShellState.active){immersiveGameShellState.gameId=gameId?String(gameId):immersiveGameShellState.gameId;stage.dataset.shellGame=immersiveGameShellState.gameId||'';return true;}
  immersiveGameShellState.active=true;immersiveGameShellState.gameId=gameId?String(gameId):null;
  immersiveGameShellState.scrollX=Number(typeof window!=='undefined'&&window.scrollX)||0;immersiveGameShellState.scrollY=Number(typeof window!=='undefined'&&window.scrollY)||0;
  immersiveGameShellState.returnFocus=typeof document!=='undefined'?document.activeElement:null;
  if(document.documentElement)document.documentElement.classList.add('game-active');if(document.body)document.body.classList.add('game-active');
  stage.dataset.shellActive='true';stage.dataset.shellGame=immersiveGameShellState.gameId||'';stage.setAttribute('aria-hidden','false');
  installImmersiveGameShellListeners();
  try{if(typeof stage.focus==='function')stage.focus({preventScroll:true});}catch{try{stage.focus();}catch{}}
  dispatchImmersiveGameShellChange(true,immersiveGameShellState.gameId);return true;
}
function exitImmersiveGameShell(){
  if(!immersiveGameShellState.active){
    if(typeof clearMatchExpressions==='function')clearMatchExpressions();
    removeImmersiveGameShellListeners();
    if(typeof document!=='undefined'&&document.documentElement)document.documentElement.classList.remove('game-active');
    if(typeof document!=='undefined'&&document.body)document.body.classList.remove('game-active');
    const inactiveStage=gameShellStage();if(inactiveStage){delete inactiveStage.dataset.shellActive;delete inactiveStage.dataset.shellGame;inactiveStage.setAttribute('aria-hidden','true');}
    return false;
  }
  const stage=gameShellStage(),scrollX=immersiveGameShellState.scrollX,scrollY=immersiveGameShellState.scrollY,returnFocus=immersiveGameShellState.returnFocus,returnGameId=immersiveGameShellState.gameId;
  immersiveGameShellState.active=false;immersiveGameShellState.gameId=null;immersiveGameShellState.returnFocus=null;
  if(typeof clearMatchExpressions==='function')clearMatchExpressions();
  removeImmersiveGameShellListeners();
  if(document.documentElement)document.documentElement.classList.remove('game-active');if(document.body)document.body.classList.remove('game-active');
  if(stage){delete stage.dataset.shellActive;delete stage.dataset.shellGame;stage.setAttribute('aria-hidden','true');}
  const restore=()=>{try{if(typeof window!=='undefined'&&typeof window.scrollTo==='function')window.scrollTo(scrollX,scrollY);}catch{}try{const target=gameShellReturnTarget(returnFocus,returnGameId);if(target)target.focus({preventScroll:true});}catch{}};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(restore);else restore();
  dispatchImmersiveGameShellChange(false,null);return true;
}

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
  const profile={uid:seat.userId||'',name:seat.nickname||'',avatar:Number(seat.avatar)||0,frame:Number(seat.frame)||0,effect:Number(seat.effect)||0,nameFx:Number(seat.nameFx)||0};
  if(typeof avatarStageNode==='function'){
    const avatar=avatarStageNode(profile,34,'game-stage-avatar');
    if(seat.type==='human'&&seat.userId){
      const button=el('button','game-stage-avatar-button');button.type='button';button.setAttribute('aria-label',gameStageLocalized('stage_open_profile'));button.appendChild(avatar);
      if(typeof button.addEventListener==='function')button.addEventListener('click',event=>{if(event&&event.stopPropagation)event.stopPropagation();if(online&&typeof online.requestProfile==='function'&&online.requestProfile(seat.userId))return;if(typeof openProfileModal==='function')openProfileModal(seat.userId);});
      return button;
    }
    avatar.setAttribute('aria-hidden','true');return avatar;
  }
  return el('span','game-stage-avatar-fallback',seat.type==='ai'?'✦':'●');
}

const MATCH_EXPRESSION_EMOJI_FALLBACK=Object.freeze([
  ['emoji_wave','👋'],['emoji_thumbsup','👍'],['emoji_cheer','🎉'],['emoji_wow','😮'],['emoji_oops','😅'],
  ['emoji_cry','😭'],['emoji_angry','😠'],['emoji_sly','😏'],['emoji_heart','❤️'],['emoji_game','🎮'],
]);
const MATCH_EXPRESSION_QUICK_IDS=Object.freeze(['quick_hello','quick_good_luck','quick_nice','quick_wow','quick_thanks','quick_again']);
const matchExpressionUi={open:false,tab:'emoji',muted:false,targetSeat:'',matchId:null,events:[],timers:new Map(),flightTimers:new Map(),cooldownUntil:0,cooldownTimer:null};
function matchExpressionKey(id){return String(id||'').replace(/[^a-z0-9_-]/gi,'').slice(0,80);}
function matchExpressionEventKey(event){return String(event&&event.senderUid||'').slice(0,128)+'|'+matchExpressionKey(event&&event.eventId);}
function matchExpressionReceiveEnabled(){return !!(gameStageIsOnline()&&online&&online.game&&online.matchId&&typeof online.supportsCapability==='function'&&online.supportsCapability('match-expression-v1'));}
function matchExpressionEnabled(){return matchExpressionReceiveEnabled()&&!online.isSpectator&&!!(typeof account!=='undefined'&&account&&!account.ephemeral);}
function matchExpressionLabel(id){const key='expression_'+String(id||'');const value=typeof t==='function'?t(key):key;return value===key?String(id||''):value;}
function loadMatchExpressionMute(){if(matchExpressionUi.muted)return true;try{matchExpressionUi.muted=localStorage.getItem('mg_match_expression_muted')==='1';}catch{}return matchExpressionUi.muted;}
function clearMatchExpressionFlights(){for(const timer of matchExpressionUi.flightTimers.values())clearTimeout(timer);matchExpressionUi.flightTimers.clear();const overlay=$('game-stage-overlay');if(overlay)overlay.querySelectorAll&&overlay.querySelectorAll('.match-expression-flight').forEach(node=>node.remove());}
function clearMatchExpressionPresentation(){for(const timer of matchExpressionUi.timers.values())clearTimeout(timer);matchExpressionUi.timers.clear();clearMatchExpressionFlights();matchExpressionUi.events=[];const rail=$('player-bar');if(rail&&rail.querySelectorAll)rail.querySelectorAll('.match-expression-bubbles').forEach(node=>node.remove());}
function clearMatchExpressions(){clearMatchExpressionPresentation();if(matchExpressionUi.cooldownTimer)clearTimeout(matchExpressionUi.cooldownTimer);matchExpressionUi.cooldownTimer=null;matchExpressionUi.cooldownUntil=0;matchExpressionUi.matchId=null;matchExpressionUi.targetSeat='';matchExpressionUi.open=false;const panel=$('match-expression-panel');if(panel)panel.innerHTML='';if(typeof clearMatchChat==='function')clearMatchChat();}
function expressionSeatNode(seatId){const rail=$('player-bar');if(!rail||!rail.querySelector)return null;return rail.querySelector('[data-seat-key="'+String(seatId).replace(/"/g,'')+'"]');}
function renderMatchExpressionBubbles(){
  const now=Date.now();matchExpressionUi.events=matchExpressionUi.events.filter(item=>item&&Number(item.expiresAt)>now);
  const bySeat=new Map();matchExpressionUi.events.forEach(item=>{const displaySeat=Number.isInteger(Number(item.displaySeat))?Number(item.displaySeat):Number(item.player),list=bySeat.get(displaySeat)||[];list.push(item);bySeat.set(displaySeat,list.slice(-3));});
  const rail=$('player-bar');if(rail)rail.querySelectorAll&&rail.querySelectorAll('.match-expression-bubbles').forEach(node=>node.remove());
  for(const [seatId,events] of bySeat){const seat=expressionSeatNode(seatId);if(!seat)continue;const wrap=el('div','match-expression-bubbles');events.forEach(item=>{const sender=gameStageSeatModels().find(model=>model&&Number(model.seatId)===Number(item.player)),reportable=!!(sender&&sender.type==='human'&&sender.userId&&typeof account!=='undefined'&&account&&!account.ephemeral&&String(sender.userId)!==String(account.uid||'')&&typeof openReportUserModal==='function');const bubble=el(reportable?'button':'div','match-expression-bubble '+(item.kind==='emoji'?'is-emoji':'is-quick')+(reportable?' is-reportable':''),item.kind==='emoji'?item.fallback:matchExpressionLabel(item.expressionId));if(reportable){bubble.type='button';bubble.setAttribute('aria-label',t('match_expression_report'));bubble.addEventListener('click',()=>openReportUserModal({uid:sender.userId,name:sender.nickname||'',avatar:Number(sender.avatar)||0},{type:'match',id:item.eventId,recentEventIds:[item.eventId]}));}else{bubble.setAttribute('role','status');bubble.setAttribute('aria-label',matchExpressionLabel(item.expressionId));}wrap.appendChild(bubble);});seat.appendChild(wrap);}
}
function renderMatchExpressionFlight(item){
  if(!item||item.kind!=='emoji'||prefersReducedMotion()||item.targetSeat===null||item.targetSeat===undefined||item.targetSeat===item.player)return;
  const from=expressionSeatNode(item.player),to=expressionSeatNode(item.targetSeat),overlay=$('game-stage-overlay');if(!from||!to||!overlay||!from.getBoundingClientRect||!to.getBoundingClientRect)return;
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),o=overlay.getBoundingClientRect?overlay.getBoundingClientRect():{left:0,top:0};
  const flight=el('span','match-expression-flight',item.fallback);flight.setAttribute('aria-hidden','true');flight.style.left=(a.left+a.width/2-o.left)+'px';flight.style.top=(a.top+a.height/2-o.top)+'px';flight.style.setProperty('--match-flight-x',(b.left+b.width/2-a.left-a.width/2)+'px');flight.style.setProperty('--match-flight-y',(b.top+b.height/2-a.top-a.height/2)+'px');overlay.appendChild(flight);
  const key=String(item.eventKey);const timer=setTimeout(()=>{flight.remove();matchExpressionUi.flightTimers.delete(key);},720);matchExpressionUi.flightTimers.set(key,timer);
}
function receiveMatchExpression(event){
  if(!event||!matchExpressionReceiveEnabled()||String(event.matchId||'')!==String(online.matchId||'')||loadMatchExpressionMute())return;
  const allowedEmoji=new Map(MATCH_EXPRESSION_EMOJI_FALLBACK);const id=String(event.expressionId||'');if(event.kind==='emoji'&&!allowedEmoji.has(id))return;if(event.kind==='quick'&&!MATCH_EXPRESSION_QUICK_IDS.includes(id))return;
  const player=Number(event.player),senderUid=String(event.senderUid||'');if(!Number.isInteger(player)||!expressionSeatNode(player)||!senderUid)return;
  const targetSeat=event.targetSeat===null||event.targetSeat===undefined?null:Number(event.targetSeat),eventKey=matchExpressionEventKey(event);if(!eventKey||!matchExpressionKey(event.eventId))return;const item={...event,eventId:matchExpressionKey(event.eventId),eventKey,player,targetSeat,displaySeat:event.kind==='emoji'&&Number.isInteger(targetSeat)?targetSeat:player,fallback:allowedEmoji.get(id)||'',expiresAt:Date.now()+2600};matchExpressionUi.events=matchExpressionUi.events.filter(row=>row.eventKey!==item.eventKey);matchExpressionUi.events.push(item);matchExpressionUi.events=matchExpressionUi.events.slice(-30);const old=matchExpressionUi.timers.get(item.eventKey);if(old)clearTimeout(old);matchExpressionUi.timers.set(item.eventKey,setTimeout(()=>{matchExpressionUi.events=matchExpressionUi.events.filter(row=>row.eventKey!==item.eventKey);matchExpressionUi.timers.delete(item.eventKey);renderMatchExpressionBubbles();},2700));renderMatchExpressionBubbles();renderMatchExpressionFlight(item);
}
function handleMatchExpressionAck(){/* 表现由服务端广播驱动，回执只用于幂等确认。 */}
function handleMatchExpressionError(payload){const reason=payload&&payload.reason;toast(typeof translateServerMessage==='function'?translateServerMessage('',reason,'match_expression_failed'):t('match_expression_failed'));}
function sendMatchExpressionChoice(kind,id){const now=Date.now();if(now<matchExpressionUi.cooldownUntil)return null;const eventId=online.sendMatchExpression(kind,id,matchExpressionUi.targetSeat);if(!eventId)return null;matchExpressionUi.cooldownUntil=now+900;if(matchExpressionUi.cooldownTimer)clearTimeout(matchExpressionUi.cooldownTimer);matchExpressionUi.cooldownTimer=setTimeout(()=>{matchExpressionUi.cooldownTimer=null;matchExpressionUi.cooldownUntil=0;renderMatchExpressionPanel();},920);renderMatchExpressionPanel();return eventId;}
function renderMatchExpressionPanel(){
  const panel=$('match-expression-panel');if(!panel)return;
  if(!matchExpressionEnabled()){panel.classList.add('hidden');panel.innerHTML='';return;}
  panel.classList.remove('hidden');panel.innerHTML='';loadMatchExpressionMute();
  const head=el('div','match-expression-head');head.appendChild(el('strong',null,t('match_expression_title')));const toggle=el('button','btn match-expression-toggle',matchExpressionUi.open?t('match_expression_close'):t('match_expression_open'));toggle.type='button';toggle.addEventListener('click',()=>{matchExpressionUi.open=!matchExpressionUi.open;renderMatchExpressionPanel();});head.appendChild(toggle);panel.appendChild(head);if(!matchExpressionUi.open)return;
  const controls=el('div','match-expression-controls');const target=el('select','match-expression-target');target.setAttribute('aria-label',t('match_expression_target'));const all=document.createElement('option');all.value='';all.textContent=t('match_expression_all');target.appendChild(all);gameStageSeatModels().filter(seat=>seat&&seat.type!=='empty'&&Number(seat.seatId)!==Number(online.player)).forEach(seat=>{const option=document.createElement('option');option.value=String(seat.seatId);if(seat.nickname){option.textContent=seat.nickname;option.setAttribute('data-i18n-raw','');}else option.textContent=gameStageLocalized('player_number',Number(seat.seatId)+1);target.appendChild(option);});target.value=matchExpressionUi.targetSeat;target.addEventListener('change',()=>{matchExpressionUi.targetSeat=target.value;});controls.appendChild(target);const mute=el('button','btn match-expression-mute',matchExpressionUi.muted?t('match_expression_unmute'):t('match_expression_mute'));mute.type='button';mute.addEventListener('click',()=>{matchExpressionUi.muted=!matchExpressionUi.muted;try{localStorage.setItem('mg_match_expression_muted',matchExpressionUi.muted?'1':'0');}catch{}if(matchExpressionUi.muted)clearMatchExpressionPresentation();renderMatchExpressionPanel();if(!matchExpressionUi.muted)renderMatchExpressionBubbles();});controls.appendChild(mute);panel.appendChild(controls);
  const tabs=el('div','match-expression-tabs');[['emoji',t('match_expression_emoji_tab')],['quick',t('match_expression_quick_tab')]].forEach(([tab,label])=>{const button=el('button','btn '+(matchExpressionUi.tab===tab?'is-active':''),label);button.type='button';button.setAttribute('aria-pressed',String(matchExpressionUi.tab===tab));button.addEventListener('click',()=>{matchExpressionUi.tab=tab;renderMatchExpressionPanel();});tabs.appendChild(button);});panel.appendChild(tabs);
  const cooling=Date.now()<matchExpressionUi.cooldownUntil,grid=el('div','match-expression-grid');if(matchExpressionUi.tab==='emoji')MATCH_EXPRESSION_EMOJI_FALLBACK.forEach(([id,icon])=>{const button=el('button','btn match-expression-choice',icon);button.type='button';button.disabled=cooling;button.setAttribute('aria-label',matchExpressionLabel(id));button.addEventListener('click',()=>sendMatchExpressionChoice('emoji',id));grid.appendChild(button);});else MATCH_EXPRESSION_QUICK_IDS.forEach(id=>{const button=el('button','btn match-expression-choice quick',matchExpressionLabel(id));button.type='button';button.disabled=cooling;button.addEventListener('click',()=>sendMatchExpressionChoice('quick',id));grid.appendChild(button);});panel.appendChild(grid);
}

const matchChatUi={open:false,muted:false,matchId:null,messages:[],unread:0,draft:'',bubbles:[],bubbleTimers:new Map(),syncRequested:false};
function matchChatMessageKey(value){return /^[A-Za-z][A-Za-z0-9_-]{7,80}$/.test(String(value||''))?String(value):'';}
function matchChatReceiveEnabled(){return !!(gameStageIsOnline()&&online&&online.game&&online.matchId&&typeof online.supportsCapability==='function'&&online.supportsCapability('match-chat-v1'));}
function matchChatSendEnabled(){return matchChatReceiveEnabled()&&!online.isSpectator&&!!(typeof account!=='undefined'&&account&&!account.ephemeral);}
function loadMatchChatMute(){if(matchChatUi.muted)return true;try{matchChatUi.muted=localStorage.getItem('mg_match_chat_muted')==='1';}catch{}return matchChatUi.muted;}
function matchChatSeat(event){return gameStageSeatModels().find(model=>model&&Number(model.seatId)===Number(event&&event.player))||null;}
function validMatchChatEvent(event){const text=String(event&&event.text||''),messageId=matchChatMessageKey(event&&event.messageId),player=Number(event&&event.player);return !!(event&&messageId&&String(event.matchId||'')===String(online.matchId||'')&&String(event.senderUid||'')&&Number.isInteger(player)&&[...text].length>0&&[...text].length<=160);}
function clearMatchChatBubbles(){for(const timer of matchChatUi.bubbleTimers.values())clearTimeout(timer);matchChatUi.bubbleTimers.clear();matchChatUi.bubbles=[];const rail=$('player-bar');if(rail&&rail.querySelectorAll)rail.querySelectorAll('.match-chat-bubbles').forEach(node=>node.remove());}
function clearMatchChat(){clearMatchChatBubbles();matchChatUi.open=false;matchChatUi.matchId=null;matchChatUi.messages=[];matchChatUi.unread=0;matchChatUi.draft='';matchChatUi.syncRequested=false;const panel=$('match-chat-panel');if(panel){panel.innerHTML='';panel.classList.add('hidden');}}
function reportMatchChatEvent(item){const sender=matchChatSeat(item);if(!sender||!sender.userId||typeof openReportUserModal!=='function')return;openReportUserModal({uid:sender.userId,name:sender.nickname||'',avatar:Number(sender.avatar)||0},{type:'match',id:item.messageId,recentEventIds:[item.messageId]});}
function renderMatchChatBubbles(){
  const rail=$('player-bar');if(rail&&rail.querySelectorAll)rail.querySelectorAll('.match-chat-bubbles').forEach(node=>node.remove());
  if(loadMatchChatMute())return;
  const now=Date.now(),latest=new Map();matchChatUi.bubbles=matchChatUi.bubbles.filter(item=>item&&Number(item.expiresAt)>now);matchChatUi.bubbles.forEach(item=>latest.set(Number(item.player),item));
  for(const [seatId,item] of latest){const seat=expressionSeatNode(seatId);if(!seat)continue;const sender=matchChatSeat(item),reportable=!!(sender&&sender.userId&&account&&!account.ephemeral&&String(sender.userId)!==String(account.uid||''));const wrap=el('div','match-chat-bubbles'),bubble=chatRawNode(reportable?'button':'div','match-chat-bubble',item.text);if(reportable){bubble.type='button';bubble.setAttribute('aria-label',t('match_chat_report'));bubble.addEventListener('click',()=>reportMatchChatEvent(item));}else bubble.setAttribute('role','status');wrap.appendChild(bubble);seat.appendChild(wrap);}
}
function storeMatchChatMessage(event,withBubble){
  if(!validMatchChatEvent(event))return false;const messageId=matchChatMessageKey(event.messageId);if(matchChatUi.messages.some(item=>item.messageId===messageId))return false;
  const item={protocol:'match-chat-v1',matchId:String(event.matchId),messageId,senderUid:String(event.senderUid),player:Number(event.player),text:String(event.text),createdAt:Number(event.createdAt)||Date.now()};
  matchChatUi.messages.push(item);matchChatUi.messages=matchChatUi.messages.slice(-50);
  if(withBubble&&!loadMatchChatMute()){const bubble={...item,expiresAt:Date.now()+4200};matchChatUi.bubbles=matchChatUi.bubbles.filter(row=>row.messageId!==messageId);matchChatUi.bubbles.push(bubble);const old=matchChatUi.bubbleTimers.get(messageId);if(old)clearTimeout(old);matchChatUi.bubbleTimers.set(messageId,setTimeout(()=>{matchChatUi.bubbles=matchChatUi.bubbles.filter(row=>row.messageId!==messageId);matchChatUi.bubbleTimers.delete(messageId);renderMatchChatBubbles();},4300));}
  return true;
}
function receiveMatchChatState(payload){
  if(!payload||!matchChatReceiveEnabled()||String(payload.matchId||'')!==String(online.matchId||''))return;matchChatUi.matchId=String(payload.matchId);clearMatchChatBubbles();matchChatUi.messages=[];(Array.isArray(payload.messages)?payload.messages:[]).slice(-50).forEach(item=>storeMatchChatMessage(item,false));matchChatUi.unread=0;matchChatUi.syncRequested=true;renderMatchChatPanel();
}
function receiveMatchChatMessage(event){
  if(!matchChatReceiveEnabled()||!validMatchChatEvent(event))return;matchChatUi.matchId=String(event.matchId);if(!storeMatchChatMessage(event,true))return;if(!matchChatUi.open&&String(event.senderUid)!==String(account&&account.uid||''))matchChatUi.unread=Math.min(99,matchChatUi.unread+1);renderMatchChatBubbles();renderMatchChatPanel();
}
function handleMatchChatAck(){/* 服务端广播是唯一可见消息来源。 */}
function handleMatchChatError(payload){const reason=String(payload&&payload.reason||'server_unavailable'),key='match_chat_error_'+reason;toast(t(key)===key?t('match_chat_failed'):t(key));}
function matchChatMessageNode(item){
  const sender=matchChatSeat(item)||{},mine=String(item.senderUid)===String(account&&account.uid||''),row=el('article','match-chat-row'+(mine?' is-mine':''));
  const head=el('div','match-chat-row-head');head.appendChild(avatarStageNode(sender,28));head.appendChild(chatPeerNameNode('strong','match-chat-sender',sender.nickname));head.appendChild(el('time','match-chat-time',chatTimeLabel(item.createdAt)));row.appendChild(head);row.appendChild(chatRawNode('div','match-chat-text',item.text));
  if(!mine&&sender.userId&&account&&!account.ephemeral){const report=el('button','btn btn-ghost match-chat-report',t('match_chat_report'));report.type='button';report.addEventListener('click',()=>reportMatchChatEvent(item));row.appendChild(report);}return row;
}
function renderMatchChatPanel(){
  const panel=$('match-chat-panel');if(!panel)return;if(!matchChatReceiveEnabled()){panel.classList.add('hidden');panel.innerHTML='';return;}panel.classList.remove('hidden');panel.innerHTML='';loadMatchChatMute();
  const head=el('div','match-chat-head');head.appendChild(el('strong',null,t('match_chat_title')));const actions=el('div','match-chat-head-actions'),toggleLabel=matchChatUi.open?t('match_chat_close'):matchChatUi.unread?t('match_chat_open_unread',matchChatUi.unread):t('match_chat_open'),toggle=el('button','btn match-chat-toggle',toggleLabel);toggle.type='button';toggle.setAttribute('aria-expanded',String(matchChatUi.open));toggle.addEventListener('click',()=>{matchChatUi.open=!matchChatUi.open;if(matchChatUi.open)matchChatUi.unread=0;renderMatchChatPanel();});actions.appendChild(toggle);const mute=el('button','btn match-chat-mute',t(matchChatUi.muted?'match_chat_unmute':'match_chat_mute'));mute.type='button';mute.addEventListener('click',()=>{matchChatUi.muted=!matchChatUi.muted;try{localStorage.setItem('mg_match_chat_muted',matchChatUi.muted?'1':'0');}catch{}if(matchChatUi.muted)clearMatchChatBubbles();renderMatchChatPanel();});actions.appendChild(mute);head.appendChild(actions);panel.appendChild(head);if(!matchChatUi.open)return;
  const history=el('div','match-chat-history');history.setAttribute('role','log');history.setAttribute('aria-live','polite');if(!matchChatUi.messages.length)history.appendChild(el('div','match-chat-empty',t('match_chat_empty')));else matchChatUi.messages.forEach(item=>history.appendChild(matchChatMessageNode(item)));panel.appendChild(history);requestAnimationFrame(()=>{history.scrollTop=history.scrollHeight;});
  if(matchChatSendEnabled()){
    const form=el('form','match-chat-composer'),input=document.createElement('textarea');input.className='nick-input match-chat-input';input.rows=2;input.maxLength=160;input.enterKeyHint='send';input.placeholder=t('match_chat_placeholder');input.setAttribute('aria-label',t('match_chat_input_aria'));input.value=matchChatUi.draft;input.addEventListener('input',()=>{matchChatUi.draft=input.value;});const send=el('button','btn btn-primary',t('send'));send.type='submit';form.appendChild(input);form.appendChild(send);form.addEventListener('submit',event=>{event.preventDefault();const text=input.value;if(!text.trim())return;const id=online.sendMatchChat(text);if(id){matchChatUi.draft='';input.value='';input.focus();}});input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(form.requestSubmit)form.requestSubmit();}});panel.appendChild(form);
  }else panel.appendChild(el('p','match-chat-readonly',t(online.isSpectator?'match_chat_spectator_readonly':account&&account.ephemeral?'match_chat_guest_readonly':'match_chat_readonly')));
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
  const label=el(seat.type==='human'&&seat.userId?'button':'strong','game-stage-seat-name'+(seat.type==='human'&&seat.userId?' game-stage-name-button':''));
  if(label.tagName==='BUTTON'){label.type='button';if(typeof label.addEventListener==='function')label.addEventListener('click',()=>{if(online&&typeof online.requestProfile==='function'&&online.requestProfile(seat.userId))return;if(typeof openProfileModal==='function')openProfileModal(seat.userId);});}
  if(typeof nameFxNode==='function')label.appendChild(nameFxNode({nameFx:Number(seat.nameFx)||0},seat.nickname||gameStageLocalized(isAI?'stage_ai_player':'player_number',seatId+1)));else label.textContent=seat.nickname||gameStageLocalized(isAI?'stage_ai_player':'player_number',seatId+1);
  if(seat.type==='human'&&seat.lang&&typeof langFlag==='function'){const flag=el('span','game-stage-lang-flag',langFlag(seat.lang));flag.setAttribute('aria-hidden','true');label.appendChild(flag);}
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
  const activeMatch=onlineState&&onlineState.matchId?String(onlineState.matchId):null;if(activeMatch&&matchExpressionUi.matchId&&matchExpressionUi.matchId!==activeMatch)clearMatchExpressions();if(activeMatch)matchExpressionUi.matchId=activeMatch;if(activeMatch&&matchChatUi.matchId!==activeMatch){clearMatchChat();matchChatUi.matchId=activeMatch;matchChatUi.syncRequested=!!(onlineState&&typeof onlineState.requestMatchChatState==='function'&&onlineState.requestMatchChatState());}
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
  renderMatchExpressionBubbles();renderMatchExpressionPanel();renderMatchChatBubbles();renderMatchChatPanel();
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
function homePulseDayKey(date){
  const value=date instanceof Date&&!Number.isNaN(date.getTime())?date:new Date();
  const year=value.getFullYear(),month=String(value.getMonth()+1).padStart(2,'0'),day=String(value.getDate()).padStart(2,'0');
  return year+'-'+month+'-'+day;
}
function homePulseAccountKey(source){
  try{
    const value=source&&((typeof source.uid==='string'&&source.uid)||(typeof source.uid==='number'&&String(source.uid)))||'';
    return value?encodeURIComponent(String(value)).slice(0,160):'';
  }catch(_error){return '';}
}
function homePulseStorageKey(source){
  const accountKey=homePulseAccountKey(source);
  return accountKey?'mg_home_pulse_dismissed_v1:'+accountKey:'';
}
function homePulseDismissedFor(source,date){
  const storageKey=homePulseStorageKey(source);
  if(!storageKey||!source||source.ephemeral)return false;
  try{return typeof localStorage!=='undefined'&&!!localStorage&&localStorage.getItem(storageKey)===homePulseDayKey(date);}
  catch(_error){return false;}
}
function dismissHomePulseFor(source,date){
  const storageKey=homePulseStorageKey(source);
  if(!storageKey||!source||source.ephemeral)return false;
  try{localStorage.setItem(storageKey,homePulseDayKey(date));return true;}
  catch(_error){return false;}
}
function homeActiveMatchState(){
  try{
    const state=typeof online!=='undefined'&&online?online:null;
    if(!state||!state.connected||!state._authenticated||state.isSpectator||state.spectatorRoom||state._replaying)return null;
    const game=typeof state.game==='string'?state.game:'';
    const matchId=String(state.matchId||'');
    if(!state.room||!game||!matchId||!currentGame||currentGameId!==game)return null;
    const result=state.lastMatchResult;
    if(result&&String(result.matchId||'')===matchId)return null;
    const seats=state.roomInfo&&Array.isArray(state.roomInfo.seats)?state.roomInfo.seats:null;
    if(seats){
      const seat=seats.find(item=>item&&Number(item.seatId)===Number(state.player));
      if(!seat||seat.type!=='human')return null;
      if(typeof account!=='undefined'&&account&&seat.userId&&account.uid&&String(seat.userId)!==String(account.uid))return null;
    }
    return {game,matchId};
  }catch(_error){return null;}
}
function renderHomeActiveMatchReturn(){
  const card=$('home-active-match-return'),button=$('btn-home-active-match-return');
  if(!card)return null;
  const state=homeActiveMatchState(),visible=!!state;
  card.classList.toggle('hidden',!visible);
  if(!visible){if(button)button.onclick=null;return null;}
  if(button){
    const capturedMatchId=state.matchId;
    button.onclick=()=>{
      const latest=homeActiveMatchState();
      if(!latest||latest.matchId!==capturedMatchId){renderHomeActiveMatchReturn();return;}
      if(typeof showGame==='function')showGame(latest.game);
    };
  }
  return state;
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
  const recommendationButton=$('btn-home-recommendation'),goalButton=$('btn-home-goal'),goalValue=$('home-goal-value'),goalCopy=$('home-goal-copy'),goalMeta=$('home-goal-meta');
  const gameIds=typeof GAME_KEYS!=='undefined'&&Array.isArray(GAME_KEYS)?GAME_KEYS.slice():Object.keys(typeof GAMES!=='undefined'&&GAMES?GAMES:{});
  const played=account&&account.played&&typeof account.played==='object'?account.played:{};
  const recommended=gameIds.slice().sort((a,b)=>(Number(played[b])||0)-(Number(played[a])||0)||gameIds.indexOf(a)-gameIds.indexOf(b))[0]||'gomoku';
  const game=typeof GAMES!=='undefined'&&GAMES?GAMES[recommended]:null;
  const gameName=game?t(game.nameKey||'game_'+recommended):t('game_gomoku');
  if(recommendationButton){recommendationButton.textContent=account&&!account.ephemeral?t('home_recommendation_view',gameName):t('home_recommendation_open');recommendationButton.onclick=()=>{setAppRoute('games');requestAnimationFrame(()=>{const card=document.querySelector('.game-card[data-game-id="'+recommended+'"]');if(card&&typeof card.focus==='function')card.focus();});};}
  if(goalButton){goalButton.textContent=t(account&&!account.ephemeral?'home_goal_open_profile':'home_goal_start');goalButton.onclick=()=>setAppRoute(account&&!account.ephemeral?'profile':'games');}
  if(goalValue&&goalCopy&&goalMeta){goalMeta.innerHTML='';if(account&&!account.ephemeral){goalValue.textContent=t('home_goal_level',typeof testAdminLevelValue==='function'?testAdminLevelValue(account,Number(account.level)||1):Number(account.level)||1);const levelValue=typeof testAdminLevelValue==='function'?testAdminLevelValue(account,Number(account.level)||1):Number(account.level)||1;goalCopy.textContent=(Number(account.streak)||0)>0?t('home_goal_streak',Number(account.streak)||0):t('home_goal_recommendation',gameName);const level=el('span',null,t('home_goal_level_chip',levelValue));const target=el('span',null,t('home_goal_game_chip',gameName));goalMeta.appendChild(level);goalMeta.appendChild(target);}else{goalValue.textContent=t('home_goal_guest');goalCopy.textContent=t('home_goal_guest_copy');}}
  const pulse=$('home-engagement-pulse'),pulseFriends=$('home-pulse-friends'),pulseCollection=$('home-pulse-collection'),pulseGoal=$('home-pulse-goal'),pulseIdentity=$('home-pulse-identity'),pulseIdentityAvatar=$('home-pulse-identity-avatar'),pulseIdentityName=$('home-pulse-identity-name'),pulseIdentityLevel=$('home-pulse-identity-level'),pulseProfile=$('btn-home-pulse-profile'),pulseChat=$('btn-home-pulse-chat'),pulseShop=$('btn-home-pulse-shop'),pulseDismiss=$('btn-home-pulse-dismiss');
  if(pulse){
    const visible=!!(account&&!account.ephemeral)&&!homePulseDismissedFor(account);
    pulse.classList.toggle('hidden',!visible);
    if(!visible){
      if(pulseFriends)pulseFriends.textContent='';if(pulseCollection)pulseCollection.textContent='';if(pulseGoal)pulseGoal.textContent='';
      if(pulseIdentity)pulseIdentity.classList.add('hidden');if(pulseIdentityAvatar)pulseIdentityAvatar.innerHTML='';if(pulseIdentityName)pulseIdentityName.innerHTML='';if(pulseIdentityLevel)pulseIdentityLevel.textContent='';
      if(pulseProfile)pulseProfile.onclick=null;if(pulseChat)pulseChat.onclick=null;if(pulseShop)pulseShop.onclick=null;if(pulseDismiss)pulseDismiss.onclick=null;
    }else{
      let collectionRarity=null;try{if(typeof CollectionRarityCatalog!=='undefined'&&CollectionRarityCatalog&&typeof CollectionRarityCatalog.deriveOwnedCollection==='function')collectionRarity=CollectionRarityCatalog.deriveOwnedCollection(account.owned);}catch(_error){}
      const friends=typeof online!=='undefined'&&online&&online.socialState&&Array.isArray(online.socialState.friends)?online.socialState.friends:[];
      const onlineFriends=friends.filter(item=>item&&item.presence&&item.presence!=='offline').length;
      const ownedCount=Math.max(0,Number(collectionRarity&&collectionRarity.ownedCount)||0),catalogCount=Math.max(0,Number(collectionRarity&&collectionRarity.catalogCount)||0);
      const existingGoal=(Number(account.streak)||0)>0?t('home_goal_streak',Number(account.streak)||0):t('home_goal_recommendation',gameName);
      if(pulseFriends)pulseFriends.textContent=t('home_pulse_online_friends_value',onlineFriends);
      if(pulseCollection)pulseCollection.textContent=t('home_pulse_collection_value',ownedCount,catalogCount);
      if(pulseGoal)pulseGoal.textContent=existingGoal;
      if(pulseIdentity){
        pulseIdentity.classList.remove('hidden');
        if(pulseIdentityAvatar){
          pulseIdentityAvatar.innerHTML='';
          try{if(typeof avatarStageNode==='function'){const avatar=avatarStageNode(account,56);if(avatar){avatar.setAttribute('aria-hidden','true');pulseIdentityAvatar.appendChild(avatar);}}}catch(_error){}
        }
        if(pulseIdentityName){
          const rawName=typeof account.name==='string'?account.name:'';pulseIdentityName.innerHTML='';pulseIdentityName.setAttribute('data-i18n-raw','');
          try{if(typeof nameFxNode==='function'){const nameNode=nameFxNode(account,rawName);if(nameNode)pulseIdentityName.appendChild(nameNode);else pulseIdentityName.textContent=rawName;}else pulseIdentityName.textContent=rawName;}catch(_error){pulseIdentityName.textContent=rawName;}
        }
        if(pulseIdentityLevel){const level=Math.max(1,Math.floor(Number(account.level)||1));pulseIdentityLevel.textContent=typeof testAdminLevelShortText==='function'?testAdminLevelShortText(account,level):t('profile_level_short',level);}
      }
      if(pulseProfile)pulseProfile.onclick=()=>setAppRoute('profile');
      if(pulseChat)pulseChat.onclick=()=>setAppRoute('chat');
      if(pulseShop)pulseShop.onclick=()=>{if(typeof openShop==='function')openShop();};
      if(pulseDismiss)pulseDismiss.onclick=()=>{dismissHomePulseFor(account);renderGhostHome();requestAnimationFrame(()=>{if(recommendationButton&&typeof recommendationButton.focus==='function')recommendationButton.focus();});};
    }
  }
  if(typeof renderHomeActiveMatchReturn==='function')renderHomeActiveMatchReturn();
}
function chatRawNode(tag,className,text){
  const node=typeof elRaw==='function'?elRaw(tag,className||null,String(text===undefined||text===null?'':text)):el(tag,className||null,String(text===undefined||text===null?'':text));
  node.setAttribute('data-i18n-raw','');return node;
}
function chatPeerNameNode(tag,className,name){
  return typeof name==='string'&&name.length
    ? chatRawNode(tag,className,name)
    : el(tag,className||null,t('social_player'));
}
function chatTimeLabel(value){
  const date=new Date(Number(value)||Date.now());
  try{return new Intl.DateTimeFormat(currentLang,{hour:'2-digit',minute:'2-digit'}).format(date);}catch{return date.toLocaleTimeString().slice(0,5);}
}
function chatDayKey(value){
  const date=new Date(Number(value)||Date.now());
  return [date.getFullYear(),date.getMonth(),date.getDate()].join('-');
}
function chatDayLabel(value){
  const date=new Date(Number(value)||Date.now()),today=new Date();
  const start=day=>new Date(day.getFullYear(),day.getMonth(),day.getDate()).getTime();
  const delta=Math.round((start(today)-start(date))/86400000);
  if(delta===0)return t('chat_day_today');
  if(delta===1)return t('chat_day_yesterday');
  try{return new Intl.DateTimeFormat(currentLang,{year:'numeric',month:'short',day:'numeric'}).format(date);}catch{return date.toLocaleDateString();}
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
  const preservePeer=messages.dataset.chatPreservePeer||'',preserve=preservePeer&&preservePeer===String(online.chatActivePeerUid||'');
  const previousHeight=preserve?Number(messages.dataset.chatPreviousHeight||0):0,previousTop=preserve?Number(messages.dataset.chatPreviousTop||0):0;
  if(preservePeer&&!preserve){delete messages.dataset.chatPreservePeer;delete messages.dataset.chatPreviousHeight;delete messages.dataset.chatPreviousTop;}
  const connection=$('chat-connection'),listStatus=$('chat-list-status');
  if(connection)connection.classList.toggle('connected',!!(online.connected&&online._authenticated));
  if(listStatus){listStatus.textContent=online.chatListPending?t('chat_refreshing'):t(online.connected&&online._authenticated?'chat_connected':'chat_disconnected');listStatus.setAttribute('role','status');listStatus.setAttribute('aria-live','polite');}
  list.setAttribute('aria-live','polite');list.setAttribute('aria-busy',online.chatListPending?'true':'false');
  list.innerHTML='';
  const isGuest=!!(account&&account.ephemeral);
  const conversations=online.chatState&&Array.isArray(online.chatState.conversations)?online.chatState.conversations:[];
  if(!account||isGuest){
    list.appendChild(chatEmptyNode(isGuest?'chat_guest_title':'chat_login_title',isGuest?'chat_guest_body':'chat_login_body',isGuest?null:{label:'login',run:()=>openAuthModal('login')}));
  }else if(online.chatListPending&&!conversations.length){
    list.appendChild(el('div','chat-loading-state',t('chat_refreshing')));
  }else if(!conversations.length){
    const hasFriends=!!(online.socialState&&online.socialState.counts&&online.socialState.counts.friends);
    list.appendChild(chatEmptyNode(hasFriends?'chat_no_conversations_title':'chat_no_friends_title',hasFriends?'chat_no_conversations_body':'chat_no_friends_body',{label:'nav_games',run:()=>setAppRoute('games')}));
  }else{
    conversations.forEach(item=>{
      const peer=item.peer||{},row=el('button','chat-conversation-row');row.type='button';row.dataset.peerUid=peer.uid||'';
      if(peer.uid===online.chatActivePeerUid)row.setAttribute('aria-current','true');
      const avatar=avatarStageNode(peer,40);avatar.setAttribute('aria-hidden','true');row.appendChild(avatar);
      const copy=el('span','chat-conversation-copy');copy.appendChild(chatPeerNameNode('span','chat-conversation-name',peer.name));
      if(item.lastMessage&&typeof item.lastMessage.text==='string')copy.appendChild(chatRawNode('span','chat-conversation-preview',item.lastMessage.text));
      else copy.appendChild(el('span','chat-conversation-preview',t('chat_start_conversation')));
      row.appendChild(copy);
      const meta=el('span','chat-conversation-meta');if(item.lastMessage)meta.appendChild(el('span',null,chatTimeLabel(item.lastMessage.createdAt)));
      const unread=Math.max(0,Number(item.unreadCount)||0);if(unread>0){const badge=el('span','chat-unread',String(Math.min(99,unread)));badge.setAttribute('aria-label',t('chat_unread_count',unread));meta.appendChild(badge);}row.appendChild(meta);
      row.setAttribute('aria-label',t('chat_open_conversation',peer.name||t('social_player')));
      row.addEventListener('click',()=>{chatLastConversationFocus=peer.uid;openPlayerConversation(peer.uid);});list.appendChild(row);
    });
  }
  updateChatUnreadBadge();
  const peerUid=online.chatActivePeerUid,summary=peerUid&&chatConversationByPeer(peerUid),peer=summary&&summary.peer;
  const title=$('chat-thread-title'),presence=$('chat-thread-presence'),avatarHolder=$('chat-thread-avatar'),profileButton=$('btn-chat-profile');
  if(!peer){
    if(title){title.removeAttribute('data-i18n-raw');if(typeof setLocalizedText==='function')setLocalizedText(title,t(isGuest?'chat_guest_title':'chat_select_title'));else title.textContent=t(isGuest?'chat_guest_title':'chat_select_title');}if(presence)presence.textContent=t(isGuest?'chat_guest_body':'chat_select_hint');
    if(avatarHolder)avatarHolder.innerHTML='';if(profileButton)profileButton.classList.add('hidden');messages.innerHTML='';messages.appendChild(chatEmptyNode(isGuest?'chat_guest_title':'chat_select_title',isGuest?'chat_guest_body':'chat_select_hint'));
    if(input)input.disabled=true;if(send)send.disabled=true;if(note)note.textContent=t(isGuest?'chat_guest_body':'chat_select_first');return;
  }
  if(title){if(typeof peer.name==='string'&&peer.name.length){title.textContent=peer.name;title.setAttribute('data-i18n-raw','');}else{title.removeAttribute('data-i18n-raw');if(typeof setLocalizedText==='function')setLocalizedText(title,t('social_player'));else title.textContent=t('social_player');}}
  if(presence)presence.textContent=(typeof presenceLabel==='function'?presenceLabel(peer.presence||'offline'):String(peer.presence||''))+' · '+t(peer.relationship==='friends'?'social_friend':'chat_history_read_only');
  if(avatarHolder){avatarHolder.innerHTML='';avatarHolder.appendChild(avatarStageNode(peer,38));}
  if(profileButton){profileButton.classList.remove('hidden');profileButton.onclick=()=>openProfileModal(peer.uid);}
  const rows=Array.isArray(online.chatHistory[peerUid])?online.chatHistory[peerUid]:[],pending=[...online.chatPending.entries()].filter(([,item])=>item.peerUid===peerUid);
  messages.setAttribute('aria-live','off');messages.innerHTML='';
  const meta=online.chatHistoryMeta&&online.chatHistoryMeta[peerUid];
  if(meta&&meta.hasMore){const older=el('button','btn chat-load-older',t('chat_load_older'));older.addEventListener('click',()=>{messages.dataset.chatPreservePeer=String(peerUid);messages.dataset.chatPreviousHeight=String(messages.scrollHeight);messages.dataset.chatPreviousTop=String(messages.scrollTop);if(online.requestChatHistory(peerUid,meta.nextBeforeSeq)){older.disabled=true;older.textContent=t('chat_history_loading');older.setAttribute('aria-busy','true');}});messages.appendChild(older);}
  const historyPending=!!(online.chatHistoryPending&&online.chatHistoryPending[peerUid]);
  if(historyPending&&!rows.length&&!pending.length)messages.appendChild(el('div','chat-loading-state',t('chat_history_loading')));
  if(!historyPending&&!rows.length&&!pending.length)messages.appendChild(chatEmptyNode('chat_no_messages_title','chat_no_messages_body'));
  let previousDay='';
  rows.forEach(message=>{
    const day=chatDayKey(message.createdAt);if(day!==previousDay){previousDay=day;messages.appendChild(el('div','chat-day-label',chatDayLabel(message.createdAt)));}
    const mine=account&&message.senderUid===account.uid,bubble=chatRawNode('div','chat-message'+(mine?' mine':''),message.text);bubble.dataset.messageId=message.id||'';
    const read=mine&&summary&&String(summary.peerReadThroughSeq||'0').localeCompare(String(message.seq||'0'),undefined,{numeric:true})>=0;
    bubble.appendChild(el('span','chat-message-meta',chatTimeLabel(message.createdAt)+(mine?' · '+t(read?'chat_read':'chat_sent'):'')));messages.appendChild(bubble);
  });
  pending.forEach(([id,item])=>{if(rows.some(row=>row.id===item.messageId))return;const bubble=chatRawNode('div','chat-message mine pending',item.text);const retry=el('button','chat-message-meta',t(item.status==='failed'?'chat_retry':'chat_sending'));retry.disabled=item.status!=='failed';if(item.status==='failed')retry.addEventListener('click',()=>{online.sendChatMessage(item.peerUid,item.text,id);renderPlayerChat();});bubble.appendChild(retry);messages.appendChild(bubble);});
  const canSend=!!(online.connected&&online._authenticated&&!isGuest&&peer.relationship==='friends');
  if(input){input.disabled=!canSend;const draft=online.chatDrafts.get(peerUid)||'';if(document.activeElement!==input)input.value=draft;input.placeholder=t(canSend?'chat_placeholder':online.connected?'chat_read_only_placeholder':'chat_offline_placeholder');}
  if(send)send.disabled=!canSend;if(note)note.textContent=t(canSend?'chat_enter_hint':online.connected?'chat_history_read_only':'chat_disconnected_read_only');
  requestAnimationFrame(()=>{
    if(preserve){messages.scrollTop=Math.max(0,messages.scrollHeight-previousHeight+previousTop);delete messages.dataset.chatPreservePeer;delete messages.dataset.chatPreviousHeight;delete messages.dataset.chatPreviousTop;}
    else messages.scrollTop=messages.scrollHeight;
    messages.setAttribute('aria-live','polite');
  });
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
  const refresh=$('btn-chat-refresh');if(refresh)refresh.addEventListener('click',()=>{online.requestChatList();renderPlayerChat();});
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
  const testAdmin=typeof isTestAdminPrivateAccount === 'function' && isTestAdminPrivateAccount(account);
  const level=Math.max(1,Number(account.level)||1),xpProgress=account.xpProgress&&typeof account.xpProgress==='object'?account.xpProgress:null;
  const xpCurrent=Math.max(0,Number(xpProgress&&xpProgress.current)||0),xpRequired=Math.max(1,Number(xpProgress&&xpProgress.required)||1),xpPercent=testAdmin?100:Math.max(0,Math.min(100,Math.round(xpCurrent/xpRequired*100)));
  const total=Math.max(0,Number(account.total)||0),totalWins=Math.max(0,Number(account.totalWins)||0),winRate=total?Math.round(totalWins/total*100):null;
  const games=(typeof GAME_KEYS!=='undefined'?GAME_KEYS:Object.keys(GAMES)).filter(id=>GAMES[id]);
  const unlocked=new Set(Array.isArray(account.achievements)?account.achievements:[]),titleInfo=typeof titleFor==='function'?titleFor(level):{icon:'✦',nameKey:'social_title_1'};

  const hero=el('section','profile-route-hero profile-hero bg-'+Number(account.background||0));ghostProfileBackgroundNode=hero;
  if(typeof applyPremiumBackground==='function')applyPremiumBackground(hero,account.background||0,'profile');
  const heroScrim=el('div','profile-route-hero-scrim'),identity=el('div','profile-route-identity');identity.appendChild(avatarStageNode(account,108));
  const identityCopy=el('div','profile-route-identity-copy'),name=el('div','profile-route-name');name.appendChild(nameFxNode(account,account.name||t('default_player_name')));if(typeof appendTestAdminBadge==='function')appendTestAdminBadge(name,account,'profile');name.appendChild(el('span','profile-lang-flag',langFlag(account.lang||currentLang)));identityCopy.appendChild(name);
  const levelText=testAdmin&&typeof testAdminLevelShortText==='function'?testAdminLevelShortText(account,level):t(account.ephemeral?'guest_account_badge':'profile_level_short',level);
  identityCopy.appendChild(el('div','profile-route-title',titleInfo.icon+' '+(titleInfo.nameKey?t(titleInfo.nameKey):'')+' · '+levelText));
  const presenceText=typeof profilePresenceLabel==='function'?profilePresenceLabel(account.presence||'offline'):String(account.presence||'');
  identityCopy.appendChild(el('div','profile-route-presence',presenceText+(account.countryRegion&&typeof profileRegionLabel==='function'?' · '+profileRegionLabel(account.countryRegion):'')));
  if(account.signature)identityCopy.appendChild(chatRawNode('p','profile-route-signature','“'+String(account.signature).slice(0,80)+'”'));
  const showcase=typeof profileShowcaseText==='function'?profileShowcaseText(account):'';if(showcase)identityCopy.appendChild(el('div','profile-route-showcase',showcase));
  identity.appendChild(identityCopy);heroScrim.appendChild(identity);
  const heroActions=el('div','profile-route-hero-actions');[['edit_profile',()=>openProfileEditor(account.uid),'btn-primary'],['shop',()=>openShop(),'']].forEach(([key,fn,cls])=>{const button=el('button','btn '+cls,t(key));button.addEventListener('click',fn);heroActions.appendChild(button);});heroScrim.appendChild(heroActions);hero.appendChild(heroScrim);root.appendChild(hero);

  const growth=el('section','home-glass-card profile-growth-card');
  const growthHead=el('div','profile-section-head');growthHead.appendChild(el('div',null,t('profile_growth_title')));growthHead.appendChild(el('span',null,typeof testAdminGrowthText==='function'?testAdminGrowthText(account,xpCurrent,xpRequired):t('profile_xp_progress',xpCurrent,xpRequired)));growth.appendChild(growthHead);
  const progress=el('div','profile-xp-progress');progress.setAttribute('role','progressbar');progress.setAttribute('aria-label',testAdmin?t('test_admin_growth_aria'):t('profile_xp_aria'));progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax',String(testAdmin?1:xpRequired));progress.setAttribute('aria-valuenow',String(testAdmin?1:xpCurrent));const fill=el('span');fill.style.width=xpPercent+'%';progress.appendChild(fill);growth.appendChild(progress);
  const stats=el('div','profile-route-stats');[
    ['profile_stat_level',typeof testAdminLevelValue==='function'?testAdminLevelValue(account,level):String(level)],['profile_stat_games',String(total)],['profile_stat_wins',String(totalWins)],['profile_stat_win_rate',winRate===null?'—':winRate+'%'],['profile_stat_streak',String(account.streak||0)],['profile_stat_best_streak',String(account.bestStreak||0)],['profile_stat_achievements',unlocked.size+'/'+(typeof ACHIEVEMENTS!=='undefined'?ACHIEVEMENTS.length:8)],['profile_stat_balance',typeof testAdminCurrencyText==='function'?testAdminCurrencyText(account):(typeof currencyAmountText==='function'?currencyAmountText(account.coins||0):String(account.coins||0)+'💵')],
  ].forEach(([key,value])=>{const item=el('div','profile-route-stat');item.appendChild(el('strong',null,value));item.appendChild(el('span',null,t(key)));stats.appendChild(item);});growth.appendChild(stats);root.appendChild(growth);

  const journeyModel=typeof ProfileJourney!=='undefined'&&ProfileJourney?ProfileJourney.deriveProfileJourney(account,{masteryApi:typeof VictoryMastery!=='undefined'?VictoryMastery:null,achievementTotal:typeof ACHIEVEMENTS!=='undefined'?ACHIEVEMENTS.length:0}):null;
  if(journeyModel){
    const journeySection=el('section','home-glass-card profile-journey-section'),journeyHead=el('div','profile-section-head');journeyHead.appendChild(el('h2',null,t('profile_journey_title')));journeyHead.appendChild(el('span',null,t('profile_journey_subtitle')));journeySection.appendChild(journeyHead);
    const journeyGrid=el('div','profile-journey-grid');
    const addGoal=(icon,label,detail,action,onClick)=>{const card=el('button','profile-journey-card');card.type='button';card.appendChild(el('span','profile-journey-icon',icon));const copy=el('span','profile-journey-copy');copy.appendChild(el('small',null,label));copy.appendChild(el('strong',null,detail));copy.appendChild(el('span','profile-journey-action',action+' →'));card.appendChild(copy);card.setAttribute('aria-label',label+' · '+detail+' · '+action);card.addEventListener('click',onClick);journeyGrid.appendChild(card);};
    const masteryGoal=journeyModel.mastery,masteryGame=masteryGoal.gameId&&GAMES[masteryGoal.gameId],masteryName=masteryGame&&(masteryGame.name||t(masteryGame.nameKey));
    addGoal('✦',t('profile_journey_mastery'),masteryGoal.complete?t('profile_journey_mastery_complete'):t('profile_journey_mastery_goal',masteryName||t('nav_games'),masteryGoal.remaining,t(masteryGoal.nextTitle.nameKey)),t('profile_journey_action_game'),()=>{setAppRoute('games');if(masteryGoal.gameId)requestAnimationFrame(()=>{const card=document.querySelector('.game-card[data-game-id="'+masteryGoal.gameId+'"]');if(card&&typeof card.focus==='function')card.focus();});});
    const achievementGoal=journeyModel.achievements;addGoal('◇',t('profile_journey_achievements'),achievementGoal.complete?t('profile_journey_achievement_complete'):t('profile_journey_achievement_goal',achievementGoal.unlocked,achievementGoal.total),t('profile_journey_action_achievements'),()=>openAchievementsModal());
    addGoal('◎',t('profile_journey_collection'),t('profile_journey_collection_goal',journeyModel.collection.total),t('profile_journey_action_collection'),()=>openShop());
    journeySection.appendChild(journeyGrid);root.appendChild(journeySection);
  }

  const content=el('div','profile-route-content'),main=el('div','profile-route-main'),side=el('aside','profile-route-side');
  const gameSection=el('section','home-glass-card profile-route-section');const gameHead=el('div','profile-section-head');gameHead.appendChild(el('h2',null,t('profile_games_title')));gameHead.appendChild(el('span',null,t('profile_games_subtitle')));gameSection.appendChild(gameHead);
  const masteryFallback=typeof VictoryMastery!=='undefined'&&VictoryMastery?VictoryMastery.deriveVictoryMastery(account.wins||{}):null;
  const gameGrid=el('div','profile-game-grid');games.forEach(id=>{
    const played=Math.max(0,Number(account.played&&account.played[id])||0),wins=Math.max(0,Number(account.wins&&account.wins[id])||0),rate=played?Math.round(wins/played*100):null;
    const mastery=account.mastery&&account.mastery.byGame&&account.mastery.byGame[id]||masteryFallback&&masteryFallback.byGame[id]||null,card=el('button','profile-game-card');
    card.type='button';card.addEventListener('click',()=>setAppRoute('games'));card.appendChild(el('span','profile-game-icon',GAMES[id].icon||'🎮'));
    const copy=el('span');copy.appendChild(el('strong',null,GAMES[id].name||t(GAMES[id].nameKey)));copy.appendChild(el('small',null,t('profile_game_record',played,wins,rate===null?'—':rate+'%')));
    const title=mastery&&mastery.current,masteryLine=el('small','profile-game-mastery',title?title.badge+' '+t(title.nameKey):t('mastery_first_win'));
    if(mastery&&mastery.nextThreshold)masteryLine.title=t('mastery_next_hint',mastery.remaining,mastery.nextThreshold);
    copy.appendChild(masteryLine);card.appendChild(copy);gameGrid.appendChild(card);
  });gameSection.appendChild(gameGrid);main.appendChild(gameSection);

  const achievementSection=el('section','home-glass-card profile-route-section');const achievementHead=el('div','profile-section-head');achievementHead.appendChild(el('h2',null,t('profile_achievements_title')));const viewAll=el('button','btn',t('profile_view_all'));viewAll.addEventListener('click',()=>openAchievementsModal());achievementHead.appendChild(viewAll);achievementSection.appendChild(achievementHead);
  const achievementGrid=el('div','profile-achievement-grid');(typeof ACHIEVEMENTS!=='undefined'?ACHIEVEMENTS:[]).forEach(item=>{const earned=unlocked.has(item.id),card=el('div','profile-achievement'+(earned?' unlocked':' locked'));card.appendChild(el('span','profile-achievement-icon',item.icon));const copy=el('span');copy.appendChild(el('strong',null,t(item.nameKey)));copy.appendChild(el('small',null,t(earned?'profile_achievement_unlocked':'profile_achievement_locked')));card.appendChild(copy);achievementGrid.appendChild(card);});achievementSection.appendChild(achievementGrid);main.appendChild(achievementSection);

  const taskSection=el('section','home-glass-card profile-route-section');const taskHead=el('div','profile-section-head');taskHead.appendChild(el('h2',null,t('daily_tasks_title')));taskHead.appendChild(el('span',null,t('profile_tasks_today')));taskSection.appendChild(taskHead);
  const serverTasks=online&&online.dailyTasks&&Array.isArray(online.dailyTasks.tasks)?online.dailyTasks.tasks:[],taskMeta=new Map((typeof DAILY_TASKS!=='undefined'?DAILY_TASKS:[]).map(item=>[item.id,item]));
  const taskList=el('div','profile-task-list');if(!serverTasks.length)taskList.appendChild(el('div','profile-compact-empty',t(online&&online.connected?'profile_tasks_loading':'profile_tasks_offline')));serverTasks.forEach(task=>{const meta=taskMeta.get(task.id)||{},row=el('div','profile-task-row'+(task.claimed?' completed':''));row.appendChild(el('span','profile-task-icon',meta.icon||'✦'));const copy=el('div');copy.appendChild(el('strong',null,t(meta.nameKey||'daily_tasks_title')));copy.appendChild(el('small',null,String(task.progress||0)+' / '+String(task.target||0)));row.appendChild(copy);if(task.claimed)row.appendChild(el('span','profile-task-state',t('profile_task_claimed')));else if(Number(task.progress)>=Number(task.target)){const claim=el('button','btn btn-primary',t('daily_task_claim',task.reward||0));claim.disabled=!!account.ephemeral;claim.addEventListener('click',()=>online.claimDailyTask(task.id));row.appendChild(claim);}taskList.appendChild(row);});taskSection.appendChild(taskList);side.appendChild(taskSection);

  const socialSection=el('section','home-glass-card profile-route-section');const socialHead=el('div','profile-section-head');socialHead.appendChild(el('h2',null,t('profile_social_title')));socialHead.appendChild(el('span',null,t('profile_friend_summary',online&&online.socialState&&online.socialState.counts&&online.socialState.counts.friends||0,(online&&online.socialState&&online.socialState.friends||[]).filter(item=>item.presence&&item.presence!=='offline').length)));socialSection.appendChild(socialHead);
  const people=el('div','profile-people-list'),friends=(online&&online.socialState&&online.socialState.friends||[]).slice(0,4);friends.forEach(friend=>{const row=el('button','profile-person-row');row.type='button';row.appendChild(avatarStageNode(friend,34));const copy=el('span');copy.appendChild(chatPeerNameNode('strong',null,friend.name));copy.appendChild(el('small',null,typeof presenceLabel==='function'?presenceLabel(friend.presence||'offline'):''));row.appendChild(copy);row.addEventListener('click',()=>openPlayerConversation(friend.uid));people.appendChild(row);});
  const friendIds=new Set(friends.map(item=>item.uid)),mates=typeof recentPlaymates==='function'?recentPlaymates(account,4):[];mates.filter(item=>!friendIds.has(item.uid)).slice(0,2).forEach(mate=>{const row=el('button','profile-person-row');row.type='button';row.appendChild(el('span','profile-person-fallback','◎'));const copy=el('span');copy.appendChild(chatPeerNameNode('strong',null,mate.name));copy.appendChild(el('small',null,t('profile_played_together',mate.count||0)));row.appendChild(copy);row.addEventListener('click',()=>openProfileModal(mate.uid));people.appendChild(row);});if(!people.childNodes.length)people.appendChild(el('div','profile-compact-empty',t('profile_social_empty')));socialSection.appendChild(people);side.appendChild(socialSection);

  const collectionSection=el('section','home-glass-card profile-route-section');const collectionHead=el('div','profile-section-head');collectionHead.appendChild(el('h2',null,t('profile_collection_title')));const shopButton=el('button','btn',t('shop'));shopButton.addEventListener('click',openShop);collectionHead.appendChild(shopButton);collectionSection.appendChild(collectionHead);
  const owned=account.owned||{},collectionGrid=el('div','profile-collection-grid');[['profile_collection_avatars',(owned.avatars||[]).length],['profile_collection_frames',(owned.frames||[]).length],['profile_collection_effects',(owned.effects||[]).length],['profile_collection_backgrounds',(owned.backgrounds||[]).length],['profile_collection_game_cosmetics',(owned.game_cosmetics||[]).length]].forEach(([key,count])=>{const item=el('div','profile-collection-item');item.appendChild(el('strong',null,String(count)));item.appendChild(el('span',null,t(key)));collectionGrid.appendChild(item);});collectionSection.appendChild(collectionGrid);
  const collectionRarity=typeof CollectionRarityCatalog!=='undefined'&&CollectionRarityCatalog?CollectionRarityCatalog.deriveOwnedCollection(owned):null;
  if(collectionRarity){
    const raritySection=el('div','profile-collection-rarity'),rarityHead=el('div','profile-collection-rarity-head');rarityHead.appendChild(el('strong',null,t('collection_rarity_title')));rarityHead.appendChild(el('span','profile-collection-rarity-progress',t('collection_rarity_progress',collectionRarity.ownedCount,collectionRarity.catalogCount)));raritySection.appendChild(rarityHead);
    const rarityList=el('div','collection-rarity-list');CollectionRarityCatalog.RARITY_ORDER.forEach(tier=>{const chip=el('span','collection-rarity-chip rarity-'+tier);chip.appendChild(el('small',null,t('collection_rarity_'+tier)));chip.appendChild(el('strong',null,String(collectionRarity.byRarity[tier]||0)));rarityList.appendChild(chip);});raritySection.appendChild(rarityList);
    if(collectionRarity.unknownOwnedCount)raritySection.appendChild(el('small','profile-collection-rarity-unclassified',t('collection_rarity_unclassified',collectionRarity.unknownOwnedCount)));
    collectionSection.appendChild(raritySection);
  }
  side.appendChild(collectionSection);

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
  if(typeof exitImmersiveGameShell==='function')exitImmersiveGameShell();
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
