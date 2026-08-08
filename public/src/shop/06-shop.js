/* ================= 商城（头像 / 边框 / 特效 / 背景） ================= */
let activeShopRefresh = null;
let activeShopModal = null;
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

function shopCatalogItems(category, currentAccount){
  const items = Array.isArray(SHOP[category]) ? SHOP[category] : [];
  if (category !== 'backgrounds') return items;
  return items.filter(item => item.id >= 7 || ownItem(currentAccount, 'backgrounds', item.id));
}

function openShop(){
  if (!account){ openAuthModal(); return; }
  if (activeShopModal && activeShopModal.isConnected) return;
  if (activeShopModal){
    activeShopModal = null;
    activeShopRefresh = null;
  }
  const bd = el('div','modal-backdrop');
  activeShopModal = bd;
  acquireModalScrollLock(bd);
  const card = el('div','modal-card shop-modal-card');
  const header = el('div','shop-header');
  const headerCopy = el('div','shop-header-copy');
  headerCopy.appendChild(el('h3', null, t('shop_title')));
  headerCopy.appendChild(el('p','shop-subtitle',t('shop_preview_hint')));
  header.appendChild(headerCopy);
  const bal = el('div','stat-chip');
  bal.appendChild(currencyIcon());
  const balValue = el('span', null, ' ' + t('shop_available',account.coins || 0));
  bal.appendChild(balValue);
  header.appendChild(bal);
  const closeTop = el('button','btn shop-close',t('close'));
  closeTop.type = 'button';
  closeTop.addEventListener('click',closeShop);
  header.appendChild(closeTop);
  card.appendChild(header);
  let tab = 'avatars';
  const tabs = el('div','shop-tabs');
  const defs = [
    ['avatars','shop_tab_avatars'], ['frames','shop_tab_frames'], ['effects','shop_tab_effects'], ['backgrounds','shop_tab_backgrounds'], ['game_cosmetics','shop_tab_game_cosmetics'],
  ];
  defs.forEach(([k, labelKey]) => {
    const tabButton = el('button','btn shop-tab' + (k === tab ? ' btn-primary' : ''), t(labelKey));
    tabButton.addEventListener('click', () => { tab = k; render(); });
    tabs.appendChild(tabButton);
  });
  const content = el('div','shop-layout');
  const previewEl = el('aside','shop-preview-panel');
  const catalog = el('section','shop-catalog');
  const listEl = el('div','shop-grid');
  let previewSelection = null;
  function collectionParts(item){
    const index=AVATAR_CATEGORIES.findIndex(theme=>theme.id===item.theme);if(index<0)return null;
    const frames=[5,4,1,6,7,8],effects=[3,1,2,1,4,2],themed=PLAYROOM_AVATARS.filter(avatar=>avatar.theme===item.theme);
    const avatar=themed.find(candidate=>candidate.animated===!!item.animated&&!candidate.free)||themed.find(candidate=>!candidate.free)||themed[0];
    return {avatarId:avatar&&avatar.id,frameId:frames[index],effectId:effects[index],name:t('premium_theme_'+item.theme)};
  }
  function collectionProgress(item){
    const parts=collectionParts(item);if(!parts)return null;
    const avatarOwned=PLAYROOM_AVATARS.some(avatar=>avatar.theme===item.theme&&(avatar.free||ownItem(account,'avatars',avatar.id)));
    const owned=[avatarOwned,ownItem(account,'frames',parts.frameId),ownItem(account,'backgrounds',item.id),ownItem(account,'effects',parts.effectId)].filter(Boolean).length;
    return {...parts,owned,total:4};
  }
  function previewCollection(item){
    const parts=collectionParts(item);if(!parts)return;
    const pbd=el('div','modal-backdrop'),pc=el('div','modal-card');pc.appendChild(el('h3',null,t('premium_collection_preview_title',parts.name)));
    const hero=el('div','profile-hero bg-'+item.id);applyPremiumBackground(hero,item.id,'profile');
    const st=el('div','avatar-stage effect-'+parts.effectId),frame=SHOP.frames.find(candidate=>candidate.id===parts.frameId);if(frame)st.appendChild(el('span','frame-ring '+(frame.cls||''),''));st.appendChild(avatarCanvas(parts.avatarId,96,{animate:true}));hero.appendChild(st);
    const previewAccount={...account,effect:parts.effectId,nameFx:parts.effectId};const nm=el('div','pname');nm.appendChild(nameFxNode(previewAccount,account.name));hero.appendChild(nm);hero.appendChild(el('div','profile-identity-scrim',t('premium_collection_preview_note')));pc.appendChild(hero);
    const progress=collectionProgress(item);if(progress)pc.appendChild(el('div','profile-showcase',t('premium_collection_progress',progress.name,progress.owned,progress.total)));
    const closePreview=()=>{releasePremiumBackground(hero);pbd.remove();};const close=el('button','btn',t('premium_back_to_shop'));close.addEventListener('click',closePreview);pc.appendChild(close);pbd.appendChild(pc);pbd.addEventListener('click',event=>{if(event.target===pbd)closePreview();});document.body.appendChild(pbd);
  }
  function itemState(category,item){
    const owned = ownItem(account,category,item.id);
    const equipped = (category === 'avatars' && account.avatar === item.id) ||
      (category === 'frames' && account.frame === item.id) ||
      (category === 'effects' && account.effect === item.id) ||
      (category === 'backgrounds' && account.background === item.id) ||
      (category === 'game_cosmetics' && !!(account.gameCosmetics && account.gameCosmetics[item.game] && account.gameCosmetics[item.game][item.slot] === item.value));
    if (equipped) return t('shop_equipped');
    if (category === 'avatars' && item.free) return t('shop_free');
    if (owned) return t('shop_owned');
    return CURRENCY + item.price;
  }
  function cosmeticSlotLabel(item){
    return t('game_cosmetic_slot_' + item.slot);
  }
  function renderPreview(category,item){
    previewEl.innerHTML = '';
    previewEl.appendChild(el('div','shop-preview-eyebrow',t('shop_preview_title')));
    const visual = el('div','shop-preview-visual');
    if (category === 'avatars'){
      visual.appendChild(avatarCanvas(item.id,112,{animate:true}));
    } else if (category === 'frames' || category === 'effects'){
      const stage = el('div','avatar-stage' + (category === 'effects' ? ' ' + item.cls : ''));
      if (category === 'frames') stage.appendChild(el('span','frame-ring ' + item.cls,''));
      stage.appendChild(avatarCanvas(account.avatar,72,{animate:true}));
      visual.appendChild(stage);
    } else if (category === 'backgrounds'){
      const premium = premiumBackgroundMeta(item.id);
      if (premium) visual.appendChild(backgroundPosterNode(premium,{hoverPreview:true}));
      else visual.appendChild(el('div','shop-preview-background ' + item.cls,''));
    } else {
      visual.appendChild(el('div','shop-preview-game-icon',GAMES[item.game] ? GAMES[item.game].icon : '🎮'));
    }
    previewEl.appendChild(visual);
    previewEl.appendChild(el('div','shop-preview-name',shopItemName(category,item)));
    previewEl.appendChild(el('div','shop-preview-state',itemState(category,item)));
    if (category === 'game_cosmetics') previewEl.appendChild(el('p','shop-preview-note',t('game_cosmetic_slot',t('game_' + item.game),cosmeticSlotLabel(item))));
    else previewEl.appendChild(el('p','shop-preview-note',t('shop_preview_hint')));
  }
  function wirePreview(node,category,item){
    node.classList.add('shop-previewable');
    node.addEventListener('click',event => {
      if (event.target && event.target.closest && event.target.closest('button')) return;
      listEl.querySelectorAll('.shop-item').forEach(card => card.classList.toggle('preview-selected',card === node));
      previewSelection = {category,item};
      renderPreview(category,item);
    });
    if (!previewSelection){
      previewSelection = {category,item};
      node.classList.add('preview-selected');
      renderPreview(category,item);
    }
  }
  function render(){
    listEl.innerHTML = '';
    previewSelection = null;
    Array.from(tabs.children).forEach((node, i) => node.classList.toggle('btn-primary', defs[i][0] === tab));
    if (tab === 'avatars'){
      PLAYROOM_AVATARS.forEach(a => {
        const owned = a.free || ownItem(account, 'avatars', a.id);
        const it = el('div','shop-item' + (account.avatar === a.id ? ' selected' : '') + (owned ? ' owned' : ''));
        it.appendChild(avatarCanvas(a.id, 48));
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
          it.appendChild(el('div','si-price',a.free ? t('shop_free') : t('shop_owned')));
          const use = el('button','btn',t('shop_use'));
          use.addEventListener('click', () => { account.avatar = a.id; saveAccount(); syncProfiles(); closeShop(); toast(t('shop_avatar_changed')); });
          it.appendChild(use);
        }
        wirePreview(it,'avatars',a);
        listEl.appendChild(it);
      });
    } else if (tab === 'game_cosmetics') {
      SHOP.game_cosmetics.forEach(item => {
        const owned = ownItem(account, 'game_cosmetics', item.id);
        const equipped = !!(account.gameCosmetics && account.gameCosmetics[item.game] && account.gameCosmetics[item.game][item.slot] === item.value);
        const it = el('div','shop-item game-cosmetic-item' + (equipped ? ' selected' : '') + (owned ? ' owned' : ''));
        it.appendChild(el('div','game-cosmetic-preview',GAMES[item.game] ? GAMES[item.game].icon : '🎮'));
        it.appendChild(el('div','si-name',shopItemName('game_cosmetics',item)));
        it.appendChild(el('div','seat-meta',t('game_cosmetic_slot',t('game_'+item.game),cosmeticSlotLabel(item))));
        if (!owned){
          const price = el('div','si-price'); price.appendChild(currencyIcon('sm')); price.appendChild(el('span',null,' '+item.price)); it.appendChild(price);
          const buy=el('button','btn btn-primary',t('shop_buy')); buy.addEventListener('click',()=>requestPurchase('game_cosmetics',item.id,buy)); it.appendChild(buy);
        } else {
          it.appendChild(el('div','si-price',equipped?t('shop_equipped'):t('shop_owned')));
          const use=el('button','btn '+(equipped?'btn-primary':''),equipped?t('shop_equipped'):t('shop_equip'));
          use.addEventListener('click',()=>{account.gameCosmetics=account.gameCosmetics||{};account.gameCosmetics[item.game]={...(account.gameCosmetics[item.game]||{}),[item.slot]:item.value};saveAccount();syncProfiles();render();renderMe();toast(t('shop_applied')+'「'+shopItemName('game_cosmetics',item)+'」');});
          it.appendChild(use);
        }
        wirePreview(it,'game_cosmetics',item);
        listEl.appendChild(it);
      });
    } else {
      const cat = tab;
      shopCatalogItems(cat, account).forEach(item => {
        const owned = ownItem(account, cat, item.id);
        const active = (tab === 'frames' && account.frame === item.id) ||
          (tab === 'effects' && account.effect === item.id) ||
          (tab === 'backgrounds' && account.background === item.id);
        const it = el('div','shop-item' + (active ? ' selected' : '') + (owned ? ' owned' : ''));
        if (tab === 'backgrounds'){
          const premium=premiumBackgroundMeta(item.id);
          if(premium)it.appendChild(backgroundPosterNode(premium,{hoverPreview:true}));
          else { const sw = el('div','bg-swatch ' + item.cls); sw.style.width='38px';sw.style.height='38px';it.appendChild(sw); }
        } else {
          const st = el('div','mini-avatar-stage' + (tab === 'effects' ? ' ' + item.cls : ''));
          const ring = el('span','frame-ring ' + (tab === 'frames' ? item.cls : ''), '');
          if (tab === 'frames') st.appendChild(ring);
          st.appendChild(avatarCanvas(account.avatar, 30));
          it.appendChild(st);
        }
        it.appendChild(el('div','si-name', shopItemName(cat,item)));
        if(tab==='backgrounds'&&item.collectionId){
          const progress=collectionProgress(item);if(progress)it.appendChild(el('div','seat-meta',t('premium_collection_progress',progress.name,progress.owned,progress.total)));
          const preview=el('button','btn',t('premium_collection_preview'));preview.addEventListener('click',()=>previewCollection(item));it.appendChild(preview);
        }
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
            saveAccount(); syncProfiles(); render(); renderMe();
            toast(t('shop_applied')+'「' + shopItemName(cat,item) + '」');
          });
          it.appendChild(use);
        }
        wirePreview(it,cat,item);
        listEl.appendChild(it);
      });
    }
  }
  function refresh(){
    balValue.textContent = ' ' + t('shop_available',account.coins || 0);
    render();
  }
  let closed = false;
  function closeShop(){
    if (closed) return;
    closed = true;
    if (activeShopRefresh === refresh) activeShopRefresh = null;
    if (activeShopModal === bd) activeShopModal = null;
    releaseModalScrollLock(bd);
    bd.remove();
  }
  activeShopRefresh = refresh;
  render();
  card.appendChild(tabs);
  catalog.appendChild(listEl);
  content.appendChild(previewEl);
  content.appendChild(catalog);
  card.appendChild(content);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) closeShop(); });
  document.body.appendChild(bd);
}
