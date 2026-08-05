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
    toast('未找到该玩家档案');
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
  hero.appendChild(el('div','pname', p.name + ' ' + (p.lang ? langFlag(p.lang) : '') + (isMe ? t('profile_mine') : '')));
  const coinLine = el('div','pmeta');
  coinLine.appendChild(el('span','coin','$'));
  coinLine.appendChild(el('span', null, ' ' + (p.coins || 0) + ' · 共 ' + (p.total || 0) + ' 局' + (p.online ? ' · 🟢在线' : ' · ⚪离线')));
  hero.appendChild(coinLine);
  card.appendChild(hero);
  const stats = el('div','profile-stats');
  GAME_KEYS.forEach(k => {
    const s = el('div','stat-chip small');
    s.textContent = GAMES[k].icon + ' ' + ((p.played && p.played[k]) || 0) + ' 局';
    stats.appendChild(s);
  });
  card.appendChild(stats);
  const links = el('div','profile-links');
  if (isMe && account){
    const edit = el('button','btn btn-primary','✏️ 编辑档案');
    edit.addEventListener('click', () => { bd.remove(); openProfileEditor(account.uid); });
    links.appendChild(edit);
    const shop = el('button','btn','🛍️ 商城');
    shop.addEventListener('click', () => { bd.remove(); openShop(); });
    links.appendChild(shop);
    const logout = el('button','btn','退出登录');
    logout.addEventListener('click', () => { bd.remove(); logoutAccount(); });
    links.appendChild(logout);
  } else if (online.room && online.isHost && !online.game){
    const inv = el('button','btn btn-primary','📨 邀请');
    inv.addEventListener('click', () => {
      bd.remove();
      if (online.room){ online.send({ type: 'invite', payload: { toUid: p.uid } }); toast('邀请已发送'); }
      else { online.inviteTarget = p.uid; online.create(); }
    });
    links.appendChild(inv);
  }
  if (!links.children.length) card.appendChild(el('div','lb-note','这是其他玩家的公开档案'));
  card.appendChild(links);
  const close = el('button','btn','关闭');
  close.addEventListener('click', () => bd.remove());
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}
