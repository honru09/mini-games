/* ================= 商城（头像 / 边框 / 特效 / 背景） ================= */
let activeShopRefresh = null;
let purchaseRequestSeq = 0;

function refreshOpenShop(){
  if (activeShopRefresh) activeShopRefresh();
}

function requestPurchase(category, id, button){
  if (!online.connected){
    toast(t('shop_connect_required'));
    return;
  }
  const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? 'buy_' + crypto.randomUUID()
    : 'buy_' + Date.now().toString(36) + '_' + (++purchaseRequestSeq).toString(36);
  online.send({ type: 'purchase', payload: { category, id, requestId } });
  if (button){
    button.disabled = true;
    button.textContent = t('shop_processing');
    setTimeout(() => {
      if (button.isConnected){
        button.disabled = false;
        button.textContent = t('shop_buy');
      }
    }, 8000);
  }
}

function openShop(){
  if (!account){ openAuthModal(); return; }
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.style.width = '520px';
  card.appendChild(el('h3', null, t('shop_title')));
  const bal = el('div','stat-chip');
  bal.appendChild(currencyIcon());
  const balValue = el('span', null, ' ' + t('shop_available',account.coins || 0));
  bal.appendChild(balValue);
  card.appendChild(bal);
  let tab = 'avatars';
  const tabs = el('div','shop-tabs');
  const defs = [
    ['avatars','shop_tab_avatars'], ['frames','shop_tab_frames'], ['effects','shop_tab_effects'], ['backgrounds','shop_tab_backgrounds'],
  ];
  defs.forEach(([k, labelKey]) => {
    const tabButton = el('button','btn shop-tab' + (k === tab ? ' btn-primary' : ''), t(labelKey));
    tabButton.addEventListener('click', () => { tab = k; render(); });
    tabs.appendChild(tabButton);
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
        it.appendChild(el('div','si-name',t('shop_basic_avatar',i+1)));
        it.appendChild(el('div','si-price',t('shop_free')));
        const use = el('button','btn',t('shop_use'));
        use.addEventListener('click', () => { account.avatar = i; saveAccount(); syncProfiles(); closeShop(); toast(t('shop_avatar_changed')); });
        it.appendChild(use);
        listEl.appendChild(it);
      }
      SHOP.avatars.forEach(a => {
        const owned = ownItem(account, 'avatars', a.id);
        const it = el('div','shop-item' + (account.avatar === a.id ? ' selected' : '') + (owned ? ' owned' : ''));
        it.appendChild(avatarCanvas(a.id, 34));
        it.appendChild(el('div','si-name', shopItemName('avatars',a)));
        if (!owned){
          const price = el('div','si-price');
          price.appendChild(currencyIcon('sm'));
          price.appendChild(el('span', null, ' ' + a.price));
          it.appendChild(price);
          const buy = el('button','btn btn-primary',t('shop_buy'));
          buy.addEventListener('click', () => {
            requestPurchase('avatars', a.id, buy);
          });
          it.appendChild(buy);
        } else {
          it.appendChild(el('div','si-price',t('shop_owned')));
          const use = el('button','btn',t('shop_use'));
          use.addEventListener('click', () => { account.avatar = a.id; saveAccount(); syncProfiles(); closeShop(); toast(t('shop_avatar_changed')); });
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
        it.appendChild(el('div','si-name', shopItemName(cat,item)));
        if (!owned){
          const price = el('div','si-price');
          price.appendChild(currencyIcon('sm'));
          price.appendChild(el('span', null, ' ' + item.price));
          it.appendChild(price);
          const buy = el('button','btn btn-primary',t('shop_buy'));
          buy.addEventListener('click', () => {
            requestPurchase(cat, item.id, buy);
          });
          it.appendChild(buy);
        } else {
          it.appendChild(el('div','si-price',t('shop_owned')));
          const use = el('button','btn',t('shop_use'));
          use.addEventListener('click', () => {
            if (tab === 'frames') account.frame = item.id;
            else if (tab === 'effects') account.effect = item.id;
            else account.background = item.id;
            saveAccount(); syncProfiles(); render(); renderMe(); renderSlots();
            toast(t('shop_applied')+'「' + shopItemName(cat,item) + '」');
          });
          it.appendChild(use);
        }
        listEl.appendChild(it);
      });
    }
  }
  function refresh(){
    balValue.textContent = ' ' + t('shop_available',account.coins || 0);
    render();
  }
  function closeShop(){
    if (activeShopRefresh === refresh) activeShopRefresh = null;
    bd.remove();
  }
  activeShopRefresh = refresh;
  render();
  const close = el('button','btn',t('close'));
  close.addEventListener('click', closeShop);
  card.appendChild(tabs);
  card.appendChild(listEl);
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) closeShop(); });
  document.body.appendChild(bd);
}
