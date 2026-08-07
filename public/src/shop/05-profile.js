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
function presenceLabel(value){
  return ({joinable:t('presence_joinable'),online:t('presence_online'),busy:t('presence_busy'),playing:t('presence_playing'),offline:t('presence_offline')})[value] || t('presence_offline');
}
function regionLabel(value){
  return ({CN:'🇨🇳 中国',JP:'🇯🇵 日本',UA:'🇺🇦 乌克兰',US:'🇺🇸 美国',GB:'🇬🇧 英国',DE:'🇩🇪 德国',FR:'🇫🇷 法国',CA:'🇨🇦 加拿大',AU:'🇦🇺 澳大利亚'})[value] || (value || '未设置地区');
}
function genderLabel(value){
  if(!value||value==='hidden')return ''; if(value==='male')return '男'; if(value==='female')return '女'; if(value==='nonbinary')return '非二元'; return String(value).replace(/^custom:/,'');
}
function profileShowcaseText(p){
  const showcase=p&&p.showcase;if(!showcase||!showcase.type||!showcase.value)return '';
  if(showcase.type==='game'&&GAMES[showcase.value])return '🎮 精选游戏 · '+GAMES[showcase.value].name+' · '+((p.played&&p.played[showcase.value])||0)+' 局';
  if(showcase.type==='achievement'){const achievement=ACHIEVEMENTS.find(item=>item.id===showcase.value);return achievement?'🏆 精选成就 · '+achievement.name:'';}
  if(showcase.type==='collection'){const theme=AVATAR_CATEGORIES.find(item=>showcase.value===item.id+'_origins');return theme?'🎨 收藏主题 · '+theme.name+' Origins':'';}
  if(showcase.type==='record'){
    const map={totalWins:['🏅 总胜场',p.totalWins||0],bestStreak:['🔥 最佳连胜',p.bestStreak||0],total:['🎲 总局数',p.total||0],level:['⭐ 等级',p.level||1]};const value=map[showcase.value];return value?value[0]+' · '+value[1]:'';
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
  pname.appendChild(el('span', null, ' [Lv.' + pLv + ']' + ' ' + (p.lang ? langFlag(p.lang) : '') + (isMe ? t('profile_mine') : '')));
  hero.appendChild(pname);
  const identity=el('div','profile-identity-scrim');
  identity.appendChild(el('div','pmeta', pTitle.icon + ' ' + pTitle.name + ' · ' + regionLabel(p.countryRegion) + (genderLabel(p.genderTag)?' · '+genderLabel(p.genderTag):'')));
  identity.appendChild(el('div','pmeta',presenceLabel(p.presence || (p.online?'online':'offline'))));
  if(p.signature)identity.appendChild(el('div','profile-signature','“'+String(p.signature).slice(0,80)+'”'));
  hero.appendChild(identity);
  const coinLine = el('div','pmeta');
  coinLine.appendChild(currencyIcon());
  coinLine.appendChild(el('span', null, ' ' + (p.coins || 0) + ' · 共 ' + (p.total || 0) + ' 局'));
  hero.appendChild(coinLine);
  // 等级进度条
  const xpNow = p.xp || 0;
  const needCur = xpForLevel(pLv);
  const needNext = xpForLevel(pLv + 1);
  const prog = needNext > needCur ? Math.max(0, Math.min(1, (xpNow - needCur) / (needNext - needCur))) : 1;
  const lvWrap = el('div','level-bar-wrap');
  lvWrap.appendChild(el('div','level-bar-label','Lv.' + pLv + ' → ' + (pLv + 1) + ' · ' + (xpNow - needCur) + '/' + (needNext - needCur) + ' XP'));
  const lvBar = el('div','level-bar');
  const lvFill = el('div','level-bar-fill');
  lvFill.style.width = Math.round(prog * 100) + '%';
  lvBar.appendChild(lvFill);
  lvWrap.appendChild(lvBar);
  hero.appendChild(lvWrap);
  card.appendChild(hero);
  const stats = el('div','profile-stats');
  const achChip = el('div','stat-chip');
  achChip.textContent = '🏆 成就 ' + ((p.achievements && p.achievements.length) || 0);
  stats.appendChild(achChip);
  GAME_KEYS.filter(k => ((p.played && p.played[k]) || 0) > 0).forEach(k => {
    const s = el('div','stat-chip small');
    s.textContent = GAMES[k].icon + ' ' + ((p.played && p.played[k]) || 0) + ' 局';
    stats.appendChild(s);
  });
  card.appendChild(stats);
  const showcaseText=profileShowcaseText(p);if(showcaseText)card.appendChild(el('div','profile-showcase',showcaseText));
  const links = el('div','profile-links');
  const closeProfile = () => { releasePremiumBackground(hero); bd.remove(); };
  if (isMe && account){
    const edit = el('button','btn btn-primary');setButtonIcon(edit,'user','编辑档案');
    edit.addEventListener('click', () => { closeProfile(); openProfileEditor(account.uid); });
    links.appendChild(edit);
    const achBtn = el('button','btn');setButtonIcon(achBtn,'trophy','成就');
    achBtn.addEventListener('click', () => { closeProfile(); openAchievementsModal(); });
    links.appendChild(achBtn);
    const shop = el('button','btn');setButtonIcon(shop,'store','商城');
    shop.addEventListener('click', () => { closeProfile(); openShop(); });
    links.appendChild(shop);
    const logout = el('button','btn');setButtonIcon(logout,'log-out','退出登录');
    logout.addEventListener('click', () => { closeProfile(); logoutAccount(); });
    links.appendChild(logout);
  } else {
    const relation = typeof socialRelationshipFor === 'function' ? socialRelationshipFor(p.uid) : 'none';
    const label = relation === 'friends' ? t('social_friend') : (relation === 'outgoing' ? t('social_pending') : (relation === 'incoming' ? t('social_requests') : t('social_add_friend')));
    const social = el('button','btn' + (relation === 'none' || relation === 'incoming' ? ' btn-primary' : ''));setButtonIcon(social,relation==='friends'?'users':'user-plus',label);
    social.addEventListener('click',()=>{closeProfile();if(typeof openSocialActions==='function')openSocialActions(p,{type:'profile',id:p.uid});});
    links.appendChild(social);
    const more = el('button','btn');setButtonIcon(more,'shield',t('social_security_more'));
    more.addEventListener('click',()=>{closeProfile();if(typeof openSocialActions==='function')openSocialActions(p,{type:'profile',id:p.uid});});
    links.appendChild(more);
  }
  if (!links.children.length) card.appendChild(el('div','lb-note','这是其他玩家的公开档案'));
  card.appendChild(links);
  const close = el('button','btn','关闭');
  close.addEventListener('click', closeProfile);
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) closeProfile(); });
  document.body.appendChild(bd);
}
