/* ================= 商城（头像 / 边框 / 特效 / 背景） ================= */
let activeShopRefresh = null;
let activeShopModal = null;
let purchaseRequestSeq = 0;
let activeShopPurchase = null;
const SHOP_PURCHASE_TIMEOUT_MS = 8000;

function shopPurchaseAccountUid(){
  return typeof account !== 'undefined' && account ? String(account.uid || '') : '';
}

function shopPurchaseItemLabel(category,id){
  const item = SHOP && Array.isArray(SHOP[category]) ? SHOP[category].find(candidate => Number(candidate.id) === Number(id)) : null;
  try { return item && typeof shopItemName === 'function' ? shopItemName(category,item) : String(id); }
  catch { return String(id); }
}

function setShopPurchaseStatus(statusNode,key,args,kind){
  if (!statusNode || !statusNode.isConnected) return;
  statusNode.className = 'shop-purchase-status' + (kind ? ' is-' + kind : '');
  statusNode.setAttribute('role',kind === 'error' ? 'alert' : 'status');
  statusNode.setAttribute('aria-live',kind === 'error' ? 'assertive' : 'polite');
  statusNode.textContent = key ? t(key,...(Array.isArray(args) ? args : [])) : '';
  statusNode.classList.toggle('hidden',!key);
}

function clearShopPurchaseFeedback(options){
  const pending = activeShopPurchase;
  if (!pending) return false;
  activeShopPurchase = null;
  if (pending.timer) clearTimeout(pending.timer);
  if (pending.button && pending.button.isConnected){
    pending.button.disabled = false;
    pending.button.removeAttribute('aria-busy');
    pending.button.textContent = t('shop_buy');
  }
  if (!(options && options.silent)) setShopPurchaseStatus(pending.statusNode,'shop_purchase_cancelled',[],null);
  return true;
}

function finishShopPurchaseFeedback(ok,payload,reason){
  const pending = activeShopPurchase;
  if (!pending) return false;
  const data = payload && typeof payload === 'object' ? payload : {};
  const responseRequestId = String(data.requestId || '');
  if (!responseRequestId || responseRequestId !== pending.requestId) return false;
  if (shopPurchaseAccountUid() !== pending.uid) return false;
  if (data.category && String(data.category) !== pending.category) return false;
  if (data.id !== undefined && Number(data.id) !== pending.id) return false;
  activeShopPurchase = null;
  if (pending.timer) clearTimeout(pending.timer);
  if (pending.button && pending.button.isConnected){
    pending.button.disabled = false;
    pending.button.removeAttribute('aria-busy');
    pending.button.textContent = t(ok ? 'shop_owned' : 'shop_buy');
  }
  if (ok) setShopPurchaseStatus(pending.statusNode,'shop_purchase_success',[pending.label],'success');
  else {
    const reasonText = translateServerMessage(data.msg || '',reason || data.reason,'purchase_failed');
    setShopPurchaseStatus(pending.statusNode,'shop_purchase_failed',[pending.label,reasonText],'error');
  }
  return true;
}

function refreshOpenShop(){
  if (activeShopRefresh) activeShopRefresh();
}

function guestMutationBlocked(){
  if (!(typeof account !== 'undefined' && account && account.ephemeral)) return false;
  toast(t('guest_persistence_disabled'));
  return true;
}

function markGuestMutationControl(button){
  if (!button || !(typeof account !== 'undefined' && account && account.ephemeral)) return button;
  button.setAttribute('aria-disabled','true');
  button.setAttribute('title',t('guest_persistence_disabled'));
  button.setAttribute('data-i18n-title','guest_persistence_disabled');
  button.dataset.guestMutationBlocked = 'true';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    toast(t('guest_persistence_disabled'));
  }, true);
  return button;
}

function requestPurchase(category, id, button){
  if (guestMutationBlocked()) return;
  if (!online.connected){
    toast(t('shop_connect_required'));
    return;
  }
  const uid = shopPurchaseAccountUid();
  if (!uid) return;
  if (activeShopPurchase){
    setShopPurchaseStatus(activeShopPurchase.statusNode,'shop_purchase_busy',[],null);
    return;
  }
  const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? 'buy_' + crypto.randomUUID()
    : 'buy_' + Date.now().toString(36) + '_' + (++purchaseRequestSeq).toString(36);
  const statusNode = activeShopModal && activeShopModal.querySelector ? activeShopModal.querySelector('.shop-purchase-status') : null;
  const label = shopPurchaseItemLabel(category,id);
  const pending = {
    requestId,
    uid,
    category:String(category),
    id:Number(id),
    label,
    button:button || null,
    statusNode,
    modal:activeShopModal,
    timer:null,
  };
  activeShopPurchase = pending;
  setShopPurchaseStatus(statusNode,'shop_purchase_pending',[label],null);
  online.send({ type: 'purchase', payload: { category, id, requestId } });
  if (button){
    button.disabled = true;
    button.setAttribute('aria-busy','true');
    button.textContent = t('shop_processing');
  }
  pending.timer = setTimeout(() => {
    if (activeShopPurchase !== pending) return;
    activeShopPurchase = null;
    if (button && button.isConnected){
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = t('shop_buy');
    }
    setShopPurchaseStatus(statusNode,'shop_purchase_timeout',[label],'error');
  },SHOP_PURCHASE_TIMEOUT_MS);
}

function collectionRarityBadge(category,item){
  if(!item||typeof CollectionRarityCatalog==='undefined'||!CollectionRarityCatalog||typeof CollectionRarityCatalog.entryFor!=='function')return null;
  const entry=CollectionRarityCatalog.entryFor(category,item.id);
  if(!entry)return null;
  const badge=el('span','collection-rarity-badge rarity-'+entry.tier,t('shop_rarity_label',t('collection_rarity_'+entry.tier)));
  badge.setAttribute('data-rarity',entry.tier);
  return badge;
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
  if (account.ephemeral) headerCopy.appendChild(el('p','shop-guest-notice',t('guest_persistence_disabled')));
  const testAdmin=typeof isTestAdminPrivateAccount === 'function' && isTestAdminPrivateAccount(account);
  if (testAdmin && typeof appendTestAdminBadge === 'function') appendTestAdminBadge(headerCopy,account,'shop');
  if (testAdmin) headerCopy.appendChild(el('p','shop-test-admin-note',t('test_admin_shop_note')));
  header.appendChild(headerCopy);
  const bal = el('div','stat-chip');
  bal.appendChild(currencyIcon());
  const shopBalance=typeof testAdminCurrencyText === 'function' ? testAdminCurrencyText(account) : (account.coins || 0);
  const balValue = el('span', null, ' ' + t('shop_available',shopBalance));
  bal.appendChild(balValue);
  header.appendChild(bal);
  const closeTop = el('button','btn shop-close',t('close'));
  closeTop.type = 'button';
  closeTop.addEventListener('click',closeShop);
  header.appendChild(closeTop);
  const purchaseStatus = el('p','shop-purchase-status hidden','');
  purchaseStatus.setAttribute('role','status');
  purchaseStatus.setAttribute('aria-live','polite');
  purchaseStatus.setAttribute('aria-atomic','true');
  header.appendChild(purchaseStatus);
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
  let previewBackground = null;
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
    return typeof currencyAmountText === 'function' ? currencyAmountText(item.price) : CURRENCY + item.price;
  }
  function cosmeticSlotLabel(item){
    return t('game_cosmetic_slot_' + item.slot);
  }
  function identityPreviewParts(category,item){
    const backgroundId = category === 'backgrounds' ? item.id : (account.background == null ? 0 : account.background);
    const avatarId = category === 'avatars' ? item.id : account.avatar;
    const frameId = category === 'frames' ? item.id : account.frame;
    const effectId = category === 'effects' ? item.id : account.effect;
    return { backgroundId, avatarId, frameId, effectId };
  }
  function renderIdentityPreview(category,item){
    if (previewBackground) releasePremiumBackground(previewBackground);
    previewBackground = null;
    const { backgroundId, avatarId, frameId, effectId } = identityPreviewParts(category,item);
    const hero = el('div','shop-identity-preview profile-hero bg-' + backgroundId);
    const premium = premiumBackgroundMeta(backgroundId);
    if (premium){
      applyPremiumBackground(hero,backgroundId,'shop-preview',{autoplay:false});
      previewBackground = hero;
    }
    const effect = (SHOP.effects || []).find(candidate => candidate.id === effectId);
    const frame = (SHOP.frames || []).find(candidate => candidate.id === frameId);
    const stage = el('div','avatar-stage' + (effect && effect.cls ? ' ' + effect.cls : (effectId ? ' effect-' + effectId : '')));
    if (frame) stage.appendChild(el('span','frame-ring ' + (frame.cls || ''),''));
    stage.appendChild(avatarCanvas(avatarId,76,{animate:!prefersReducedMotion()}));
    hero.appendChild(stage);
    const previewIdentity = {...account, avatar:avatarId, frame:frameId, effect:effectId};
    const name = el('div','pname');
    name.appendChild(nameFxNode(previewIdentity,account.name || t('profile_title')));
    hero.appendChild(name);
    hero.appendChild(el('div','profile-identity-scrim',t('shop_preview_identity_note')));
    let playback = null;
    if (premium && premium.animated){
      playback = el('div','shop-preview-playback');
      const status = el('span','shop-preview-playback-status');
      const button = el('button','btn shop-preview-playback-toggle',t('shop_preview_play'));
      button.type = 'button';
      const reduced = prefersReducedMotion();
      button.disabled = reduced;
      function syncPlayback(){
        const playing = hero.dataset.animationActive === 'true';
        button.textContent = playing ? t('shop_preview_pause') : t('shop_preview_play');
        button.setAttribute('aria-pressed',playing ? 'true' : 'false');
        button.setAttribute('aria-label',button.textContent);
        status.textContent = reduced
          ? t('shop_preview_motion_reduced')
          : t('shop_preview_playback_status',playing ? t('shop_preview_pause') : t('shop_preview_play'));
      }
      const playbackHandle = hero._premiumBackgroundPlayback;
      const unsubscribePlayback = playbackHandle && typeof playbackHandle.subscribe === 'function' ? playbackHandle.subscribe(syncPlayback) : null;
      button.addEventListener('click',() => {
        if (reduced) return;
        setPremiumBackgroundPlayback(hero,hero.dataset.animationActive !== 'true');
        syncPlayback();
      });
      if (!unsubscribePlayback) syncPlayback();
      playback.appendChild(button);
      playback.appendChild(status);
    }
    return { hero, playback };
  }
  function renderPreview(category,item){
    if (previewBackground) releasePremiumBackground(previewBackground);
    previewBackground = null;
    previewEl.innerHTML = '';
    previewEl.appendChild(el('div','shop-preview-eyebrow',t('shop_preview_title')));
    const visual = el('div','shop-preview-visual');
    let identity = null;
    if (category === 'game_cosmetics'){
      visual.appendChild(el('div','shop-preview-game-icon',GAMES[item.game] ? GAMES[item.game].icon : '🎮'));
    } else {
      identity = renderIdentityPreview(category,item);
      visual.appendChild(identity.hero);
    }
    previewEl.appendChild(visual);
    if (identity && identity.playback) previewEl.appendChild(identity.playback);
    previewEl.appendChild(el('div','shop-preview-name',shopItemName(category,item)));
    previewEl.appendChild(el('div','shop-preview-state',itemState(category,item)));
    if (category === 'game_cosmetics') previewEl.appendChild(el('p','shop-preview-note',t('game_cosmetic_slot',t('game_' + item.game),cosmeticSlotLabel(item))));
    else previewEl.appendChild(el('p','shop-preview-note',t('shop_preview_hint')));
  }
  function selectPreview(node,category,item){
    listEl.querySelectorAll('.shop-item').forEach(card => {
      const selected = card === node;
      card.classList.toggle('preview-selected',selected);
      card.setAttribute('aria-current',selected ? 'true' : 'false');
    });
    node.classList.add('preview-selected');
    node.setAttribute('aria-current','true');
    previewSelection = {category,item};
    renderPreview(category,item);
  }
  function wirePreview(node,category,item){
    node.classList.add('shop-previewable');
    node.tabIndex = 0;
    node.setAttribute('role','group');
    node.setAttribute('aria-label',t('shop_preview_item_aria',shopItemName(category,item)));
    node.setAttribute('aria-current','false');
    node.addEventListener('click',event => {
      if (event.target && event.target.closest && event.target.closest('button')) return;
      selectPreview(node,category,item);
    });
    node.addEventListener('keydown',event => {
      if (event.target !== node) return;
      if (event.key === 'Enter' || event.key === ' '){
        event.preventDefault();
        selectPreview(node,category,item);
      }
    });
    if (!previewSelection){
      selectPreview(node,category,item);
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
        const rarity=collectionRarityBadge('avatars',a);if(rarity)it.appendChild(rarity);
        if (!owned){
          const price = el('div','si-price');
          price.appendChild(currencyIcon('sm'));
          price.appendChild(el('span', null, ' ' + a.price));
          it.appendChild(price);
          const buy = markGuestMutationControl(el('button','btn btn-primary',t('shop_buy')));
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
        const rarity=collectionRarityBadge('game_cosmetics',item);if(rarity)it.appendChild(rarity);
        it.appendChild(el('div','seat-meta',t('game_cosmetic_slot',t('game_'+item.game),cosmeticSlotLabel(item))));
        if (!owned){
          const price = el('div','si-price'); price.appendChild(currencyIcon('sm')); price.appendChild(el('span',null,' '+item.price)); it.appendChild(price);
          const buy=markGuestMutationControl(el('button','btn btn-primary',t('shop_buy'))); buy.addEventListener('click',()=>requestPurchase('game_cosmetics',item.id,buy)); it.appendChild(buy);
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
        const it = el('div','shop-item shop-item-' + cat + (tab === 'backgrounds' ? ' background-shop-item' : '') + (active ? ' selected' : '') + (owned ? ' owned' : ''));
        if (tab === 'backgrounds'){
          const premium=premiumBackgroundMeta(item.id);
          if(premium){it.appendChild(backgroundPosterNode(premium,{hoverPreview:true}));it.appendChild(el('span','background-tier',t(premium.animated?'shop_tier_animated':'shop_tier_static')));}
          else { const sw = el('div','bg-swatch ' + item.cls); sw.style.width='38px';sw.style.height='38px';it.appendChild(sw); }
        } else {
          const st = el('div','mini-avatar-stage' + (tab === 'effects' ? ' ' + item.cls : ''));
          const ring = el('span','frame-ring ' + (tab === 'frames' ? item.cls : ''), '');
          if (tab === 'frames') st.appendChild(ring);
          st.appendChild(avatarCanvas(account.avatar, 30));
          it.appendChild(st);
        }
        it.appendChild(el('div','si-name', shopItemName(cat,item)));
        const rarity=collectionRarityBadge(cat,item);if(rarity)it.appendChild(rarity);
        if(tab==='backgrounds'&&item.collectionId){
          const progress=collectionProgress(item);if(progress)it.appendChild(el('div','seat-meta',t('premium_collection_progress',progress.name,progress.owned,progress.total)));
          const preview=el('button','btn',t('premium_collection_preview'));preview.addEventListener('click',()=>previewCollection(item));it.appendChild(preview);
        }
        if (!owned){
          const price = el('div','si-price');
          price.appendChild(currencyIcon('sm'));
          price.appendChild(el('span', null, ' ' + item.price));
          it.appendChild(price);
          const buy = markGuestMutationControl(el('button','btn btn-primary',t('shop_buy')));
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
    const refreshedBalance=typeof testAdminCurrencyText === 'function' ? testAdminCurrencyText(account) : (account.coins || 0);
    balValue.textContent = ' ' + t('shop_available',refreshedBalance);
    render();
  }
  let closed = false;
  function closeShop(){
    if (closed) return;
    closed = true;
    if (activeShopPurchase && activeShopPurchase.modal === bd) clearShopPurchaseFeedback({silent:true});
    if (previewBackground) releasePremiumBackground(previewBackground);
    previewBackground = null;
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
