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
let ghostHeroIndex = 0;
let ghostHeroTimer = null;
let ghostCompanionHistory = [];

function routeFromHash(){
  const match = /^#\/(home|games|chat|profile)(?:$|[?&])/.exec(String(typeof location!=='undefined'&&location.hash || ''));
  return match ? match[1] : 'home';
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
  if (route === 'chat') ensureHonruWelcome();
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
function renderGhostProfile(){
  const root = $('ghost-profile-overview');
  if (!root || !account) return;
  root.innerHTML = '';
  const card = el('section','home-glass-card ghost-profile-card');
  const stage = el('div','profile-hero bg-' + Number(account.background || 0));
  stage.appendChild(avatarStageNode(account,112));
  stage.appendChild(nameFxNode(account,account.name + ' ' + langFlag(account.lang || currentLang)));
  stage.appendChild(el('div','pmeta',t(account.ephemeral ? 'guest_account_badge' : 'profile_level_line',account.level || 1,account.xp || 0)));
  card.appendChild(stage);
  const stats=el('div','profile-stats');
  [t('profile_balance',account.coins||0),t('profile_total_games',account.total||0),t('profile_total_wins',account.totalWins||0)].forEach(value=>stats.appendChild(el('span','stat-chip',value)));
  card.appendChild(stats);
  root.appendChild(card);
  const actions = el('section','ghost-profile-actions');
  const defs = [
    ['profile_edit_title','profile_route_edit_hint',()=>openProfileEditor(account.uid)],
    ['shop_title','profile_route_shop_hint',()=>account.ephemeral?toast(t('guest_persistence_disabled')):openShop()],
    ['daily_tasks_title','profile_route_tasks_hint',()=>openProfileModal(account.uid)],
    ['logout','profile_route_logout_hint',()=>logoutAccount()],
  ];
  defs.forEach(([label,hint,fn])=>{const b=el('button','btn home-glass-card ghost-profile-action');b.appendChild(el('strong',null,t(label)));b.appendChild(el('span',null,t(hint)));b.addEventListener('click',fn);actions.appendChild(b);});
  root.appendChild(actions);
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
function addCompanionMessage(role,text){
  const list=$('companion-messages');
  if (!list) return;
  const node=elRaw('div','companion-message '+(role==='user'?'user':'honru'),String(text||''));
  list.appendChild(node);list.scrollTop=list.scrollHeight;
}
function ensureHonruWelcome(){
  const list=$('companion-messages');
  if (list && !list.childNodes.length) addCompanionMessage('honru',t('honru_welcome_line'));
}
function companionPromptText(kind){
  return t(kind==='mood'?'companion_prompt_mood':kind==='news'?'companion_prompt_news':'companion_prompt_game');
}
async function sendCompanionMessage(message){
  message=String(message||'');
  if (!message.trim()) return;
  if (!account || !account.authToken){toast(t('need_server_login'));return;}
  addCompanionMessage('user',message);
  ghostCompanionHistory.push({role:'user',content:message});
  ghostCompanionHistory=ghostCompanionHistory.slice(-6);
  const input=$('companion-input'),form=$('companion-form');if(input)input.value='';if(form)form.classList.add('loading');
  try{
    const server=resolveServer(),url=(server?server.replace(/\/+$/,''):'')+'/api/companion';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+account.authToken},body:JSON.stringify({message,locale:currentLang,history:ghostCompanionHistory.slice(0,-1)}),signal:controller.signal});
    clearTimeout(timer);
    const data=await response.json().catch(()=>({}));
    const reply=String(data.reply||t('companion_offline_reply'));
    addCompanionMessage('honru',reply);ghostCompanionHistory.push({role:'assistant',content:reply});ghostCompanionHistory=ghostCompanionHistory.slice(-6);
    const mood=$('companion-mood');if(mood)mood.textContent=t('honru_mood_'+String(data.mood||'neutral'));
    const speech=$('honru-speech');if(speech)speech.textContent=reply.slice(0,42);
  }catch{addCompanionMessage('honru',t('companion_offline_reply'));}
  finally{if(form)form.classList.remove('loading');}
}
function petHonru(){
  const dock=$('honru-dock');if(dock){dock.classList.remove('pet');void dock.offsetWidth;dock.classList.add('pet');setTimeout(()=>dock.classList.remove('pet'),650);}
  if (online && online.connected && online._authenticated) online.send({type:'companion_checkin',payload:{actionId:'pet-'+Date.now().toString(36)}});
  else toast(t('honru_pet_local'));
}
function handleCompanionCheckin(payload){
  const speech=$('honru-speech');if(speech)speech.textContent=t(payload&&payload.already?'honru_checkin_again':'honru_checkin_success');
  toast(t(payload&&payload.already?'honru_checkin_again':'honru_checkin_success'));
}
function enterGhostApp(options){
  document.body.classList.remove('ghost-shell-booting','auth-required');document.body.classList.add('authenticated');
  const app=$('app');if(app){app.hidden=false;app.inert=false;app.removeAttribute('aria-hidden');}
  if (authModalEl){releaseModalScrollLock(authModalEl);authModalEl.remove();authModalEl=null;}
  setAppRoute(routeFromHash(),{replace:true,silentHash:!!(options&&options.silentHash)});
  renderGhostHome();renderGhostProfile();
}
function requireGhostAuth(mode){
  document.body.classList.remove('ghost-shell-booting','authenticated');document.body.classList.add('auth-required');
  const app=$('app');if(app){app.inert=true;app.hidden=true;app.setAttribute('aria-hidden','true');}
  if (typeof openAuthModal==='function') openAuthModal(mode||'login');
}
function initGhostShell(){
  document.querySelectorAll('[data-app-route-target]').forEach(node=>node.addEventListener('click',()=>setAppRoute(node.getAttribute('data-app-route-target'))));
  document.querySelectorAll('[data-hero-dot]').forEach(node=>node.addEventListener('click',()=>{setGhostHero(node.getAttribute('data-hero-dot'));resetGhostHeroTimer();}));
  const homeHonru=$('btn-home-honru');if(homeHonru)homeHonru.addEventListener('click',()=>setAppRoute('chat'));
  const dockButton=$('btn-honru-dock');if(dockButton)dockButton.addEventListener('click',()=>{petHonru();setAppRoute('chat');});
  const pet=$('btn-companion-pet');if(pet)pet.addEventListener('click',petHonru);
  const form=$('companion-form');if(form)form.addEventListener('submit',event=>{event.preventDefault();sendCompanionMessage(($('companion-input')||{}).value||'');});
  document.querySelectorAll('[data-companion-prompt]').forEach(node=>node.addEventListener('click',()=>sendCompanionMessage(companionPromptText(node.getAttribute('data-companion-prompt')))));
  if(window&&typeof window.addEventListener==='function')window.addEventListener('hashchange',()=>{const route=routeFromHash();if(GHOST_APP_ROUTES.includes(route)&&route!==ghostAppRoute)setAppRoute(route,{silentHash:true});});
  setGhostHero(0);resetGhostHeroTimer();
}
