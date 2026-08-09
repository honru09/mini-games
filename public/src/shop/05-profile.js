/* ================= 个人档案弹层（自己的 / 他人的） ================= */
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
    if (u) renderProfilePopup(u, false);
    else if (local) renderProfilePopup(local, false);
  } else if (local){
    renderProfilePopup(local, false);
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
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.style.width = '420px';
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
  pname.appendChild(nameFxNode(p, p.name));
  pname.appendChild(el('span', null, t('level_bracket',pLv) + ' ' + (p.lang ? langFlag(p.lang) : '') + (isMe ? t('profile_mine') : '')));
  hero.appendChild(pname);
  const identity = el('div','profile-identity-scrim');
  identity.appendChild(el('div','pmeta', pTitle.icon + ' ' + socialTitleName(pTitle) + ' · ' + profileRegionLabel(p.countryRegion) + (profileGenderLabel(p.genderTag) ? ' · ' + profileGenderLabel(p.genderTag) : '')));
  identity.appendChild(el('div','pmeta', profilePresenceLabel(p.presence || (p.online ? 'online' : 'offline'))));
  if (p.signature) identity.appendChild(el('div','profile-signature', '“' + String(p.signature).slice(0, 80) + '”'));
  hero.appendChild(identity);
  const coinLine = el('div','pmeta');
  coinLine.appendChild(currencyIcon());
  coinLine.appendChild(el('span', null, t('profile_summary', p.coins || 0, p.total || 0, t(p.online ? 'online_label' : 'offline_label'))));
  hero.appendChild(coinLine);
  // 等级进度条
  const xpNow = p.xp || 0;
  const needCur = xpForLevel(pLv);
  const needNext = xpForLevel(pLv + 1);
  const prog = needNext > needCur ? Math.max(0, Math.min(1, (xpNow - needCur) / (needNext - needCur))) : 1;
  const lvWrap = el('div','level-bar-wrap');
  lvWrap.appendChild(el('div','level-bar-label',t('level_progress',pLv,pLv+1,xpNow-needCur,needNext-needCur)));
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
    s.textContent = GAMES[k].icon + ' ' + t('games_count', (p.played && p.played[k]) || 0);
    stats.appendChild(s);
  });
  card.appendChild(stats);
  const showcase = profileShowcaseText(p);
  if (showcase) card.appendChild(el('div','profile-showcase',showcase));
  const links = el('div','profile-links');
  const closeProfile = () => { releasePremiumBackground(hero); bd.remove(); };
  if (isMe && account){
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
    if (relation === 'friends' && typeof openPlayerConversation === 'function'){
      const message = el('button','btn btn-primary');
      setButtonIcon(message, 'user', t('chat_message_action'));
      message.addEventListener('click', () => { closeProfile(); openPlayerConversation(p.uid); });
      links.appendChild(message);
    }
    const label = relation === 'friends' ? t('social_friend') : relation === 'outgoing' ? t('social_pending') : relation === 'incoming' ? t('social_requests') : t('social_add_friend');
    const social = el('button','btn' + ((relation === 'none' || relation === 'incoming') ? ' btn-primary' : ''));
    setButtonIcon(social, relation === 'friends' ? 'users' : 'user-plus', label);
    social.addEventListener('click', () => { closeProfile(); if (typeof openSocialActions === 'function') openSocialActions(p, { type:'profile', id:p.uid }); });
    links.appendChild(social);
    const more = el('button','btn'); setButtonIcon(more, 'shield', t('social_security_more'));
    more.addEventListener('click', () => { closeProfile(); if (typeof openSocialActions === 'function') openSocialActions(p, { type:'profile', id:p.uid }); });
    links.appendChild(more);
  }
  if (!links.children.length) card.appendChild(el('div','lb-note',t('profile_public')));
  card.appendChild(links);
  const close = el('button','btn',t('close'));
  close.addEventListener('click', closeProfile);
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) closeProfile(); });
  document.body.appendChild(bd);
}
