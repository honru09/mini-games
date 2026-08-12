/* ================= 个人档案弹层（自己的 / 他人的） ================= */
let activeProfileLoading = null;
let activeProfileCompare = null;
function runProfileSurfaceMotion(phase,root,panel,onComplete){
  const motion=typeof globalThis!=='undefined'&&globalThis.GhostSurfaceMotion;
  if(!motion||typeof motion.run!=='function'||!root||!panel){if(typeof onComplete==='function')onComplete('static');return false;}
  try{motion.run({surface:'profile-dialog',phase,root,panel,onComplete});return true;}
  catch(_error){if(typeof onComplete==='function')onComplete('failed');return false;}
}
function settleProfileSurfaceMotion(reason){const motion=typeof globalThis!=='undefined'&&globalThis.GhostSurfaceMotion;try{if(motion&&typeof motion.settle==='function')motion.settle('profile-dialog',reason||'settle');}catch(_error){}}
function closeProfileCompareLoading(){const current=activeProfileCompare;if(!current)return false;activeProfileCompare=null;if(typeof online!=='undefined'&&online.pendingProfileCompare&&online.pendingProfileCompare.requestId===current.requestId)online.pendingProfileCompare=null;if(typeof current.close==='function')current.close();else if(current.bd&&current.bd.remove)current.bd.remove();return true;}
function beginProfileCompareRequest(uid,requestId){const id=String(uid||''),rid=String(requestId||'');if(!id||!rid)return false;closeProfileCompareLoading();const bd=el('div','modal-backdrop'),card=el('div','modal-card profile-loading-card');card.appendChild(el('h3',null,t('profile_compare_title')));card.appendChild(el('div','profile-loading-state',t('profile_compare_loading')));const cancel=el('button','btn',t('cancel'));cancel.addEventListener('click',closeProfileCompareLoading);card.appendChild(cancel);bd.appendChild(card);acquireModalScrollLock(bd);document.body.appendChild(bd);let close=()=>{if(bd.remove)bd.remove();};if(typeof setupAccessibleOverlayDialog==='function')close=setupAccessibleOverlayDialog(bd,card,cancel,t('profile_compare_title'),()=>{if(activeProfileCompare&&activeProfileCompare.requestId===rid)activeProfileCompare=null;if(typeof online!=='undefined'&&online.pendingProfileCompare&&online.pendingProfileCompare.requestId===rid)online.pendingProfileCompare=null;releaseModalScrollLock(bd);});activeProfileCompare={uid:id,requestId:rid,bd,close};return true;}
function finishProfileCompareRequest(payload,reason){const current=activeProfileCompare;if(!current)return false;closeProfileCompareLoading();if(!payload){toast(t(reason==='profile_compare_forbidden'?'profile_compare_forbidden':'profile_compare_unavailable'));return true;}renderProfileComparePopup(payload);return true;}
function renderProfileComparePopup(payload){const self=payload&&payload.self,friend=payload&&payload.friend;if(!self||!friend)return false;const bd=el('div','modal-backdrop'),card=el('div','modal-card profile-compare-card');card.appendChild(el('h3',null,t('profile_compare_title')));card.appendChild(el('p','profile-compare-subtitle',t('profile_compare_subtitle')));const grid=el('div','profile-compare-grid');[[self,'profile_compare_you'],[friend,'profile_compare_friend']].forEach(([profile,label])=>{const side=el('section','profile-compare-side');side.appendChild(el('h4',null,t(label)));side.appendChild(avatarStageNode(profile,54));const name=el('div','profile-compare-name');name.appendChild(profileNameNode(profile));side.appendChild(name);[['profile_compare_level',profile.level||1],['profile_compare_games',profile.total||0],['profile_compare_wins',profile.totalWins||0],['profile_compare_achievements',profile.achievementsCount||0]].forEach(([key,value])=>{const row=el('div','profile-compare-stat');row.appendChild(el('span',null,t(key)));row.appendChild(el('strong',null,String(value)));side.appendChild(row);});const gameList=el('div','profile-compare-games');(typeof GAME_KEYS!=='undefined'?GAME_KEYS:[]).filter(id=>GAMES[id]).forEach(id=>{const line=el('div','profile-compare-game');const mastery=profile.mastery&&profile.mastery.byGame&&profile.mastery.byGame[id],title=mastery&&mastery.current;line.appendChild(el('span',null,(GAMES[id].icon||'🎮')+' '+(GAMES[id].name||t(GAMES[id].nameKey))));line.appendChild(el('strong',null,String(profile.wins&&profile.wins[id]||0)+(title?' · '+title.badge+' '+t(title.nameKey):'')));gameList.appendChild(line);});side.appendChild(gameList);grid.appendChild(side);});card.appendChild(grid);const close=el('button','btn',t('close'));close.addEventListener('click',()=>{releaseModalScrollLock(bd);bd.remove();});card.appendChild(close);bd.appendChild(card);acquireModalScrollLock(bd);document.body.appendChild(bd);if(typeof setupAccessibleOverlayDialog==='function')setupAccessibleOverlayDialog(bd,card,close,t('profile_compare_title'),()=>releaseModalScrollLock(bd));else bd.addEventListener('click',event=>{if(event.target===bd){releaseModalScrollLock(bd);bd.remove();}});return true;}
function closeProfileLoading(){
  const current = activeProfileLoading;
  if (!current) return false;
  activeProfileLoading = null;
  if (typeof online !== 'undefined' && online && online.pendingPublicProfile && online.pendingPublicProfile.requestId === current.requestId && typeof online.cancelPublicProfileRequest === 'function') online.cancelPublicProfileRequest(current.requestId);
  if (typeof current.close === 'function') current.close();
  else if (current.bd && current.bd.remove) current.bd.remove();
  return true;
}
function cancelPublicProfileRequest(){return closeProfileLoading();}
function beginPublicProfileRequest(uid,requestId){
  const id = String(uid || '');
  const rid=String(requestId||'');
  if (!id||!rid) return false;
  closeProfileLoading();
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card profile-loading-card');
  card.appendChild(el('h3',null,t('profile_title')));
  card.appendChild(el('div','profile-loading-state',t('profile_loading')));
  const cancel = el('button','btn',t('cancel'));
  let close = () => { if (bd.remove) bd.remove(); };
  cancel.addEventListener('click',closeProfileLoading);
  card.appendChild(cancel);
  bd.appendChild(card);
  acquireModalScrollLock(bd);
  document.body.appendChild(bd);
  if (typeof setupAccessibleOverlayDialog === 'function') close = setupAccessibleOverlayDialog(bd,card,cancel,t('profile_title'),() => {
    if (activeProfileLoading && activeProfileLoading.requestId === rid) activeProfileLoading = null;
    if (typeof online !== 'undefined' && online && online.pendingPublicProfile && online.pendingPublicProfile.requestId === rid && typeof online.cancelPublicProfileRequest === 'function') online.cancelPublicProfileRequest(rid);
    releaseModalScrollLock(bd);
  });
  activeProfileLoading = { uid:id, requestId:rid, bd, close };
  return true;
}
function finishPublicProfileRequest(profile,request){
  const current = activeProfileLoading;
  if (!current||!request||current.requestId!==request.requestId||current.uid!==request.targetUid) return false;
  if (!profile || String(profile.uid || '') !== current.uid){
    closeProfileLoading();
    toast(t('profile_not_found'));
    return true;
  }
  closeProfileLoading();
  renderProfilePopup(profile, !!(account && profile.uid === account.uid));
  return true;
}
function openProfileModal(uid){
  if (!uid){
    if (!account){ openAuthModal(); return; }
    renderProfilePopup(account, true);
    return;
  }
  const isMe = account && account.uid === uid;
  if (isMe){ renderProfilePopup(account, true); return; }
  const local = profileByUid(uid);
  if (online.connected && lastServerLB){
    const u = lastServerLB.list.find(x => x.uid === uid);
    if (u && u.mastery) renderProfilePopup(u, false);
    else if (online.requestProfile(uid)) return;
    else if (u) renderProfilePopup(u, false);
    else if (local) renderProfilePopup(local, false);
  } else if (local){
    renderProfilePopup(local, false);
  } else if (online.connected && online.requestProfile(uid)){
    return;
  } else {
    toast(t('profile_not_found'));
  }
}
function profilePresenceLabel(value){
  const key = ({ joinable:'presence_joinable', online:'presence_online', busy:'presence_busy', playing:'presence_playing', offline:'presence_offline', invisible:'presence_invisible' })[value] || 'presence_offline';
  return t(key);
}
function profileRegionLabel(value){
  const key = ({ CN:'region_cn', JP:'region_jp', UA:'region_ua', US:'region_us', GB:'region_gb', DE:'region_de', FR:'region_fr', CA:'region_ca', AU:'region_au' })[String(value || '').toUpperCase()] || 'region_unset';
  return t(key);
}
function profileGenderLabel(value){
  const key = ({ hidden:'gender_hidden', male:'gender_male', female:'gender_female', nonbinary:'gender_nonbinary' })[value];
  return key ? t(key) : (value ? String(value).replace(/^custom:/, '') : '');
}
function profileNameNode(profile){
  const name = profile && typeof profile.name === 'string' && profile.name.trim() ? profile.name : '';
  return name ? nameFxNode(profile, name) : el('span', null, t('social_player'));
}
function profileShowcaseText(p){
  const showcase = p && p.showcase;
  if (!showcase || !showcase.type || !showcase.value) return '';
  if (showcase.type === 'game' && GAMES[showcase.value]) return t('showcase_game', GAMES[showcase.value].name) + ' · ' + ((p.played && p.played[showcase.value]) || 0);
  if (showcase.type === 'achievement'){
    const achievement = ACHIEVEMENTS.find(item => item.id === showcase.value);
    return achievement ? t('showcase_achievement', t(achievement.nameKey)) : '';
  }
  if (showcase.type === 'collection'){
    const theme = AVATAR_CATEGORIES.find(item => showcase.value === item.id + '_origins');
    return theme ? t('showcase_collection', avatarCategoryName(theme)) : '';
  }
  if (showcase.type === 'record'){
    const labels = { totalWins:'showcase_record_total_wins', bestStreak:'showcase_record_best_streak', total:'showcase_record_total', level:'showcase_record_level' };
    const value = labels[showcase.value];
    if (!value) return '';
    const amount = showcase.value === 'totalWins' ? p.totalWins || 0 : showcase.value === 'bestStreak' ? p.bestStreak || 0 : showcase.value === 'total' ? p.total || 0 : p.level || 1;
    return t(value) + ' · ' + amount;
  }
  return '';
}
function renderProfilePopup(p, isMe){
  if (!p) return;
  const testAdmin=!!isMe&&!!account&&typeof isTestAdminPrivateAccount==='function'&&isTestAdminPrivateAccount(account);
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card profile-public-card');
  const hero = el('div','profile-hero bg-' + (p.background || 0));
  applyPremiumBackground(hero, p.background || 0, 'profile');
  const avWrap = el('div','hero-avatar');
  const stage = el('div','avatar-stage effect-' + (p.effect || 0));
  const fr = p.frame || 0;
  if (fr) stage.appendChild(el('span','frame-ring ' + (SHOP.frames.find(f => f.id === fr) ? SHOP.frames.find(f => f.id === fr).cls : ''), ''));
  stage.appendChild(avatarCanvas(p.avatar, 74, { animate:true }));
  avWrap.appendChild(stage);
  hero.appendChild(avWrap);
  const pLv = p.level || levelFromXp(p.xp || 0);
  const pTitle = titleFor(pLv);
  const pname = el('div','pname');
  pname.appendChild(profileNameNode(p));
  if (testAdmin && typeof appendTestAdminBadge === 'function') appendTestAdminBadge(pname,account,'modal');
  const levelMeta = el('span');
  const levelText=testAdmin&&typeof testAdminLevelBracketText==='function'?testAdminLevelBracketText(account,pLv):t('level_bracket',pLv);
  levelMeta.appendChild(el('span', null, levelText));
  if (p.lang) levelMeta.appendChild(el('span', null, ' ' + langFlag(p.lang)));
  if (isMe) levelMeta.appendChild(el('span', null, t('profile_mine')));
  pname.appendChild(levelMeta);
  hero.appendChild(pname);
  const identity = el('div','profile-identity-scrim');
  const identityMeta = el('div','pmeta');
  identityMeta.appendChild(el('span', null, pTitle.icon + ' ' + socialTitleName(pTitle)));
  identityMeta.appendChild(el('span', null, ' · '));
  identityMeta.appendChild(el('span', null, profileRegionLabel(p.countryRegion)));
  const gender = profileGenderLabel(p.genderTag);
  if (gender){
    identityMeta.appendChild(el('span', null, ' · '));
    identityMeta.appendChild(typeof p.genderTag === 'string' && p.genderTag.startsWith('custom:') ? elRaw('span', null, gender) : el('span', null, gender));
  }
  identity.appendChild(identityMeta);
  identity.appendChild(el('div','pmeta', profilePresenceLabel(p.presence || (p.online ? 'online' : 'offline'))));
  if (p.signature) identity.appendChild(elRaw('div','profile-signature', '“' + String(p.signature).slice(0, 80) + '”'));
  hero.appendChild(identity);
  const coinLine = el('div','pmeta');
  coinLine.appendChild(currencyIcon());
  const balance=testAdmin&&typeof testAdminCurrencyText==='function'?testAdminCurrencyText(account):(p.coins || 0);
  coinLine.appendChild(el('span', null, t('profile_summary', balance, p.total || 0, t(p.online ? 'online_label' : 'offline_label'))));
  hero.appendChild(coinLine);
  // 等级进度条
  const xpNow = p.xp || 0;
  const needCur = xpForLevel(pLv);
  const needNext = xpForLevel(pLv + 1);
  const prog = testAdmin ? 1 : (needNext > needCur ? Math.max(0, Math.min(1, (xpNow - needCur) / (needNext - needCur))) : 1);
  const lvWrap = el('div','level-bar-wrap');
  lvWrap.appendChild(el('div','level-bar-label',testAdmin?t('test_admin_growth_max'):t('level_progress',pLv,pLv+1,xpNow-needCur,needNext-needCur)));
  const lvBar = el('div','level-bar');
  const lvFill = el('div','level-bar-fill');
  lvFill.style.width = Math.round(prog * 100) + '%';
  lvBar.appendChild(lvFill);
  lvWrap.appendChild(lvBar);
  hero.appendChild(lvWrap);
  card.appendChild(hero);
  const stats = el('div','profile-stats');
  const achChip = el('div','stat-chip');
  achChip.textContent = t('profile_achievement_count', (p.achievements && p.achievements.length) || 0);
  stats.appendChild(achChip);
  GAME_KEYS.filter(k => ((p.played && p.played[k]) || 0) > 0).forEach(k => {
    const s = el('div','stat-chip small');
    const mastery=p.mastery&&p.mastery.byGame&&p.mastery.byGame[k],title=mastery&&mastery.current;
    s.textContent = GAMES[k].icon + ' ' + t('games_count', (p.played && p.played[k]) || 0) + (title ? ' · ' + title.badge + ' ' + t(title.nameKey) : '');
    stats.appendChild(s);
  });
  card.appendChild(stats);
  const showcase = profileShowcaseText(p);
  if (showcase) card.appendChild(el('div','profile-showcase',showcase));
  const links = el('div','profile-links');
  let resourcesReleased = false;
  const releaseProfileResources = () => {
    if (resourcesReleased) return false;
    resourcesReleased = true;
    releasePremiumBackground(hero);
    releaseModalScrollLock(bd);
    return true;
  };
  let closeProfile = () => {
    if (!releaseProfileResources()) return false;
    if (bd.remove) bd.remove();
    return true;
  };
  if (isMe && account){
    links.classList.add('profile-self-actions');
    const edit = el('button','btn btn-primary',t('edit_profile'));
    edit.addEventListener('click', () => { closeProfile(); openProfileEditor(account.uid); });
    links.appendChild(edit);
    const achBtn = el('button','btn',t('achievements_button'));
    achBtn.addEventListener('click', () => { closeProfile(); openAchievementsModal(); });
    links.appendChild(achBtn);
    const shop = el('button','btn',t('shop'));
    shop.addEventListener('click', () => { closeProfile(); openShop(); });
    links.appendChild(shop);
    const logout = el('button','btn',t('logout'));
    logout.addEventListener('click', () => { closeProfile(); logoutAccount(); });
    links.appendChild(logout);
  } else {
    const relation = typeof socialRelationshipFor === 'function' ? socialRelationshipFor(p.uid) : 'none';
    links.classList.add('profile-public-actions');links.setAttribute('data-profile-relation',relation);
    if (relation === 'friends' && typeof openPlayerConversation === 'function'){
      const message = el('button','btn btn-primary');
      setButtonIcon(message, 'user', t('chat_message_action'));
      message.addEventListener('click', () => { closeProfile(); openPlayerConversation(p.uid); });
      links.appendChild(message);
      if(typeof online!=='undefined'&&online&&typeof online.requestProfileCompare==='function'){const compare=el('button','btn',t('profile_compare_action'));compare.addEventListener('click',()=>{closeProfile();online.requestProfileCompare(p.uid);});links.appendChild(compare);}
    }
    const more = el('button','btn' + (relation==='friends'?'':' btn-primary')); setButtonIcon(more, relation==='friends'?'shield':'user-plus', relation==='friends'?t('social_security_more'):(relation==='outgoing'?t('social_pending'):relation==='incoming'?t('social_requests'):relation==='blocked'?t('social_unblock'):t('social_add_friend')));
    more.addEventListener('click', () => { closeProfile(); if (typeof openSocialActions === 'function') openSocialActions(p, { type:'profile', id:p.uid }); });
    links.appendChild(more);
  }
  if (!links.children.length) card.appendChild(el('div','lb-note',t('profile_public')));
  card.appendChild(links);
  const close = el('button','btn',t('close'));
  close.addEventListener('click', () => closeProfile());
  card.appendChild(close);
  bd.appendChild(card);
  acquireModalScrollLock(bd);
  document.body.appendChild(bd);
  let dialogClose=null,closing=false,closed=false;
  const finishProfileClose=()=>{if(closed)return false;closed=true;if(typeof dialogClose==='function')return dialogClose();releaseProfileResources();if(bd.remove)bd.remove();return true;};
  closeProfile=()=>{if(closing||closed)return false;closing=true;bd.classList.add('profile-dialog-closing');bd.setAttribute('aria-hidden','true');settleProfileSurfaceMotion('close');return finishProfileClose();};
  if(typeof setupAccessibleOverlayDialog==='function')dialogClose=setupAccessibleOverlayDialog(bd,card,close,t('profile_title'),()=>{settleProfileSurfaceMotion('dialog_closed');releaseProfileResources();});
  else if(typeof bd.addEventListener==='function')bd.addEventListener('click',event=>{if(event.target===bd)closeProfile();});
  runProfileSurfaceMotion('open',bd,card);
}
