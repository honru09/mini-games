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
function renderProfilePopup(p, isMe){
  if (!p) return;
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.style.width = '420px';
  const hero = el('div','profile-hero bg-' + (p.background || 0));
  const avWrap = el('div','hero-avatar');
  const stage = el('div','avatar-stage effect-' + (p.effect || 0));
  const fr = p.frame || 0;
  if (fr) stage.appendChild(el('span','frame-ring ' + (SHOP.frames.find(f => f.id === fr) ? SHOP.frames.find(f => f.id === fr).cls : ''), ''));
  stage.appendChild(avatarCanvas(p.avatar, 74));
  avWrap.appendChild(stage);
  hero.appendChild(avWrap);
  const pLv = p.level || levelFromXp(p.xp || 0);
  const pTitle = titleFor(pLv);
  const pname = el('div','pname');
  pname.appendChild(nameFxNode(p, p.name));
  pname.appendChild(el('span', null, t('level_bracket',pLv) + ' ' + (p.lang ? langFlag(p.lang) : '') + (isMe ? t('profile_mine') : '')));
  hero.appendChild(pname);
  hero.appendChild(el('div','pmeta', t('profile_title_achievements', pTitle.icon + ' ' + socialTitleName(pTitle), (p.achievements ? p.achievements.length : 0))));
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
  GAME_KEYS.forEach(k => {
    const s = el('div','stat-chip small');
    s.textContent = GAMES[k].icon + ' ' + t('games_count', (p.played && p.played[k]) || 0);
    stats.appendChild(s);
  });
  card.appendChild(stats);
  const links = el('div','profile-links');
  if (isMe && account){
    const edit = el('button','btn btn-primary',t('edit_profile'));
    edit.addEventListener('click', () => { bd.remove(); openProfileEditor(account.uid); });
    links.appendChild(edit);
    const achBtn = el('button','btn',t('achievements_button'));
    achBtn.addEventListener('click', () => { bd.remove(); openAchievementsModal(); });
    links.appendChild(achBtn);
    const shop = el('button','btn',t('shop'));
    shop.addEventListener('click', () => { bd.remove(); openShop(); });
    links.appendChild(shop);
    const logout = el('button','btn',t('logout'));
    logout.addEventListener('click', () => { bd.remove(); logoutAccount(); });
    links.appendChild(logout);
  } else if (online.room && online.isHost && !online.game){
    const inv = el('button','btn btn-primary',t('invite_short'));
    inv.addEventListener('click', () => {
      bd.remove();
      if (online.room){ online.send({ type: 'invite', payload: { toUid: p.uid } }); toast(t('invite_sent')); }
      else { online.inviteTarget = p.uid; online.create(); }
    });
    links.appendChild(inv);
  }
  if (!links.children.length) card.appendChild(el('div','lb-note',t('profile_public')));
  card.appendChild(links);
  const close = el('button','btn',t('close'));
  close.addEventListener('click', () => bd.remove());
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}
