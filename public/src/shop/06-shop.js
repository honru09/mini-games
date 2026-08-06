/* ================= 商城（头像 / 边框 / 特效 / 背景） ================= */
function openShop(){
  if (!account){ openAuthModal(); return; }
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.style.width = '520px';
  card.appendChild(el('h3', null, '🛍️ 个性商城'));
  const bal = el('div','stat-chip');
  bal.appendChild(el('span','coin','$'));
  bal.appendChild(el('span', null, ' ' + (account.coins || 0) + ' 可用'));
  card.appendChild(bal);
  let tab = 'avatars';
  const tabs = el('div','shop-tabs');
  const defs = [
    ['avatars','头像'], ['frames','头像框'], ['effects','动态效果'], ['backgrounds','背景'],
  ];
  defs.forEach(([k, label]) => {
    const t = el('button','btn shop-tab' + (k === tab ? ' btn-primary' : ''), label);
    t.addEventListener('click', () => { tab = k; render(); });
    tabs.appendChild(t);
  });
  const listEl = el('div','shop-grid');
  function render(){
    listEl.innerHTML = '';
    tabs.children.forEach((t, i) => t.classList.toggle('btn-primary', defs[i][0] === tab));
    if (tab === 'avatars'){
      const FREE = 30; // 0-29 free, 30-55 shop-only
      for (let i = 0; i < FREE; i++){
        const it = el('div','shop-item' + (account.avatar === i ? ' selected' : ''));
        it.appendChild(avatarCanvas(i, 34));
        it.appendChild(el('div','si-name','基础头像 ' + (i+1)));
        it.appendChild(el('div','si-price','免费'));
        const use = el('button','btn','使用');
        use.addEventListener('click', () => { account.avatar = i; saveAccount(); syncProfiles(); bd.remove(); toast('头像已更换'); });
        it.appendChild(use);
        listEl.appendChild(it);
      }
      SHOP.avatars.forEach(a => {
        const owned = ownItem(account, 'avatars', a.id);
        const it = el('div','shop-item' + (account.avatar === a.id ? ' selected' : '') + (owned ? ' owned' : ''));
        it.appendChild(avatarCanvas(a.id, 34));
        it.appendChild(el('div','si-name', a.name));
        if (!owned){
          const price = el('div','si-price');
          price.appendChild(el('span','coin sm','$'));
          price.appendChild(el('span', null, ' ' + a.price));
          it.appendChild(price);
          const buy = el('button','btn btn-primary','购买');
          buy.addEventListener('click', () => {
            if ((account.coins || 0) < a.price){ toast('余额不足，先去赢几局吧'); return; }
            account.coins -= a.price;
            addOwned(account, 'avatars', a.id);
            saveAccount(); syncProfiles(); render(); renderMe();
            toast('✅ 已购买「' + a.name + '」');
          });
          it.appendChild(buy);
        } else {
          it.appendChild(el('div','si-price','已拥有'));
          const use = el('button','btn','使用');
          use.addEventListener('click', () => { account.avatar = a.id; saveAccount(); syncProfiles(); bd.remove(); toast('头像已更换'); });
          it.appendChild(use);
        }
        listEl.appendChild(it);
      });
    } else {
      const cat = tab;
      SHOP[cat].forEach(item => {
        const owned = ownItem(account, cat, item.id);
        const active = (tab === 'frames' && account.frame === item.id) ||
          (tab === 'effects' && account.effect === item.id) ||
          (tab === 'backgrounds' && account.background === item.id);
        const it = el('div','shop-item' + (active ? ' selected' : '') + (owned ? ' owned' : ''));
        if (tab === 'backgrounds'){
          const sw = el('div','bg-swatch ' + item.cls);
          sw.style.width = '38px'; sw.style.height = '38px';
          it.appendChild(sw);
        } else {
          const st = el('div','mini-avatar-stage' + (tab === 'effects' ? ' ' + item.cls : ''));
          const ring = el('span','frame-ring ' + (tab === 'frames' ? item.cls : ''), '');
          if (tab === 'frames') st.appendChild(ring);
          st.appendChild(avatarCanvas(account.avatar, 30));
          it.appendChild(st);
        }
        it.appendChild(el('div','si-name', item.name));
        if (!owned){
          const price = el('div','si-price');
          price.appendChild(el('span','coin sm','$'));
          price.appendChild(el('span', null, ' ' + item.price));
          it.appendChild(price);
          const buy = el('button','btn btn-primary','购买');
          buy.addEventListener('click', () => {
            if ((account.coins || 0) < item.price){ toast('余额不足，先去赢几局吧'); return; }
            account.coins -= item.price;
            addOwned(account, cat, item.id);
            saveAccount(); syncProfiles(); render(); renderMe();
            toast('✅ 已购买「' + item.name + '」');
          });
          it.appendChild(buy);
        } else {
          it.appendChild(el('div','si-price','已拥有'));
          const use = el('button','btn','使用');
          use.addEventListener('click', () => {
            if (tab === 'frames') account.frame = item.id;
            else if (tab === 'effects') account.effect = item.id;
            else account.background = item.id;
            saveAccount(); syncProfiles(); render(); renderMe(); renderSlots();
            toast('✅ 已应用「' + item.name + '」');
          });
          it.appendChild(use);
        }
        listEl.appendChild(it);
      });
    }
  }
  render();
  const close = el('button','btn','关闭');
  close.addEventListener('click', () => bd.remove());
  card.appendChild(tabs);
  card.appendChild(listEl);
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}

