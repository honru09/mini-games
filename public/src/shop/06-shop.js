/* ================= 商城（头像 / 边框 / 特效 / 背景） ================= */
let activeShopRefresh = null;
let activeShopModal = null;
let activeCollectionPreviewClose = null;
let purchaseRequestSeq = 0;
let activeShopPurchase = null;
let shopLanguageListenerInstalled = false;
let shopLanguageListener = null;
const SHOP_PURCHASE_TIMEOUT_MS = 8000;

function installShopLanguageRefresh(){
  if (shopLanguageListenerInstalled || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  shopLanguageListenerInstalled = true;
  shopLanguageListener = () => refreshOpenShop();
  window.addEventListener('languagechange', shopLanguageListener);
}
function releaseShopLanguageRefresh(){
  if (!shopLanguageListenerInstalled) return;
  if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function' && shopLanguageListener) window.removeEventListener('languagechange', shopLanguageListener);
  shopLanguageListener = null;
  shopLanguageListenerInstalled = false;
}

function runShopSurfaceMotion(phase,root,panel,onComplete){
  const motion=typeof globalThis!=='undefined'&&globalThis.GhostSurfaceMotion;
  if(!motion||typeof motion.run!=='function'||!root||!panel){if(typeof onComplete==='function')onComplete('static');return false;}
  try{motion.run({surface:'shop-dialog',phase,root,panel,onComplete});return true;}
  catch(_error){if(typeof onComplete==='function')onComplete('failed');return false;}
}
function settleShopSurfaceMotion(reason){
  const motion=typeof globalThis!=='undefined'&&globalThis.GhostSurfaceMotion;
  try{if(motion&&typeof motion.settle==='function')motion.settle('shop-dialog',reason||'settle');}catch(_error){}
}

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
  if (typeof emitUiAudioCue === 'function') emitUiAudioCue(ok ? 'shop_purchase' : 'shop_error', ok ? .82 : .7);
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
    if (typeof emitUiAudioCue === 'function') emitUiAudioCue('shop_error', .7);
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
  installShopLanguageRefresh();
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
  const headerTitle = el('h3', null, t('shop_title'));
  const headerSubtitle = el('p','shop-subtitle',t('shop_preview_hint'));
  headerCopy.appendChild(headerTitle);
  headerCopy.appendChild(headerSubtitle);
  let guestNotice = null;
  if (account.ephemeral) { guestNotice = el('p','shop-guest-notice',t('guest_persistence_disabled')); headerCopy.appendChild(guestNotice); }
  const testAdmin=typeof isTestAdminPrivateAccount === 'function' && isTestAdminPrivateAccount(account);
  if (testAdmin && typeof appendTestAdminBadge === 'function') appendTestAdminBadge(headerCopy,account,'shop');
  let adminNote = null;
  if (testAdmin) { adminNote = el('p','shop-test-admin-note',t('test_admin_shop_note')); headerCopy.appendChild(adminNote); }
  header.appendChild(headerCopy);
  const bal = el('div','stat-chip shop-balance-chip');
  const balLabel = el('span','shop-balance-label',t('shop_available_label'));
  bal.appendChild(balLabel);
  let balAmount = null;
  function syncShopBalance(){
    const shopBalance=typeof testAdminCurrencyText === 'function' ? testAdminCurrencyText(account) : currencyAmountText(account.coins || 0);
    const nextAmount=currencyAmountNode(account.coins || 0,{sizeClass:'sm',formattedText:String(shopBalance)});
    if(balAmount&&balAmount.parentNode===bal)bal.replaceChild(nextAmount,balAmount);
    else bal.appendChild(nextAmount);
    balAmount=nextAmount;
  }
  syncShopBalance();
  header.appendChild(bal);
  const closeTop = el('button','btn shop-close',t('close'));
  closeTop.type = 'button';
  closeTop.addEventListener('click',()=>closeShop());
  header.appendChild(closeTop);
  const purchaseStatus = el('p','shop-purchase-status hidden','');
  purchaseStatus.setAttribute('role','status');
  purchaseStatus.setAttribute('aria-live','polite');
  purchaseStatus.setAttribute('aria-atomic','true');
  header.appendChild(purchaseStatus);
  card.appendChild(header);
  let tab = 'avatars';
  const tabs = el('div','shop-tabs');
  const tabPanelId = 'shop-catalog-panel';
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label',t('shop_title'));
  const defs = [
    ['avatars','shop_tab_avatars'], ['frames','shop_tab_frames'], ['effects','shop_tab_effects'], ['backgrounds','shop_tab_backgrounds'], ['game_cosmetics','shop_tab_game_cosmetics'],
  ];
  function activateTab(next,options){
    if(!defs.some(def=>def[0]===next))return false;
    tab=next;
    render();
    if(options&&options.focus){const target=Array.from(tabs.children).find(node=>node.getAttribute&&node.getAttribute('data-shop-tab')===tab);if(target&&typeof target.focus==='function')target.focus();}
    return true;
  }
  defs.forEach(([k, labelKey],index) => {
    const tabButton = el('button','btn shop-tab' + (k === tab ? ' btn-primary' : ''), t(labelKey));
    tabButton.type='button';
    tabButton.id='shop-tab-'+k;
    tabButton.setAttribute('data-shop-tab',k);
    tabButton.setAttribute('role','tab');
    tabButton.setAttribute('aria-controls',tabPanelId);
    tabButton.addEventListener('click', () => activateTab(k));
    tabButton.addEventListener('keydown',event=>{
      const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key))return;
      event.preventDefault();
      const current=defs.findIndex(def=>def[0]===tab),next=event.key==='Home'?0:event.key==='End'?defs.length-1:(current+(event.key==='ArrowLeft'?-1:1)+defs.length)%defs.length;
      activateTab(defs[next][0],{focus:true});
    });
    tabs.appendChild(tabButton);
  });
  const content = el('div','shop-layout');
  const previewEl = el('aside','shop-preview-panel');
  const catalog = el('section','shop-catalog');
  catalog.id=tabPanelId;
  catalog.setAttribute('role','tabpanel');
  catalog.setAttribute('tabindex','0');
  const listEl = el('div','shop-grid');
  let previewSelection = null;
  let preferredSelection = null;
  let renderingCatalog = false;
  let previewBackground = null;
  let previewPlaybackCleanup = null;
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
    if(activeCollectionPreviewClose)activeCollectionPreviewClose();
    const parts=collectionParts(item);if(!parts)return;
    const pbd=el('div','modal-backdrop'),pc=el('div','modal-card');pc.appendChild(el('h3',null,t('premium_collection_preview_title',parts.name)));
    const hero=el('div','profile-hero bg-'+item.id);applyPremiumBackground(hero,item.id,'shop-preview',{autoplay:!prefersReducedMotion()});
    const st=el('div','avatar-stage effect-'+parts.effectId),frame=SHOP.frames.find(candidate=>candidate.id===parts.frameId);if(frame)st.appendChild(el('span','frame-ring '+(frame.cls||''),''));st.appendChild(avatarCanvas(parts.avatarId,96,{animate:!prefersReducedMotion()}));hero.appendChild(st);
    const previewAccount={...account,effect:parts.effectId,nameFx:parts.effectId};const nm=el('div','pname');nm.appendChild(nameFxNode(previewAccount,account.name));hero.appendChild(nm);hero.appendChild(el('div','profile-identity-scrim',t('premium_collection_preview_note')));pc.appendChild(hero);
    const progress=collectionProgress(item);if(progress)pc.appendChild(el('div','profile-showcase',t('premium_collection_progress',progress.name,progress.owned,progress.total)));
    let dialogClose=null,closedPreview=false;const releasePreview=()=>{if(closedPreview)return false;closedPreview=true;releasePremiumBackground(hero);releaseModalScrollLock(pbd);if(activeCollectionPreviewClose===closePreview)activeCollectionPreviewClose=null;return true;};
    const closePreview=()=>{if(closedPreview)return false;return typeof dialogClose==='function'?dialogClose():(releasePreview(),pbd.remove(),true);};const close=el('button','btn',t('premium_back_to_shop'));close.addEventListener('click',closePreview);pc.appendChild(close);pbd.appendChild(pc);acquireModalScrollLock(pbd);document.body.appendChild(pbd);
    if(typeof setupAccessibleOverlayDialog==='function')dialogClose=setupAccessibleOverlayDialog(pbd,pc,close,t('premium_collection_preview_title',parts.name),releasePreview);
    else pbd.addEventListener('click',event=>{if(event.target===pbd)closePreview();});
    activeCollectionPreviewClose=closePreview;
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
    return typeof currencyAmountText === 'function' ? currencyAmountText(item.price) : String(item.price) + ' G Coins';
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
    let playbackCleanup = null;
    if (premium && premium.animated){
      playback = el('div','shop-preview-playback');
      const status = el('span','shop-preview-playback-status');
      const button = el('button','btn shop-preview-playback-toggle',t('shop_preview_play'));
      button.type = 'button';
      function syncPlayback(){
        const reduced = prefersReducedMotion();
        const playing = hero.dataset.animationActive === 'true';
        button.disabled = reduced;
        button.textContent = playing ? t('shop_preview_pause') : t('shop_preview_play');
        button.setAttribute('aria-pressed',playing ? 'true' : 'false');
        button.setAttribute('aria-label',button.textContent);
        status.textContent = reduced
          ? t('shop_preview_motion_reduced')
          : t('shop_preview_playback_status',playing ? t('shop_preview_pause') : t('shop_preview_play'));
      }
      const playbackHandle = hero._premiumBackgroundPlayback;
      playbackCleanup = playbackHandle && typeof playbackHandle.subscribe === 'function' ? playbackHandle.subscribe(syncPlayback) : null;
      button.addEventListener('click',() => {
        if (prefersReducedMotion()) return;
        setPremiumBackgroundPlayback(hero,hero.dataset.animationActive !== 'true');
        syncPlayback();
      });
      if (!playbackCleanup) syncPlayback();
      playback.appendChild(button);
      playback.appendChild(status);
    }
    return { hero, playback, cleanup:typeof playbackCleanup==='function'?playbackCleanup:null };
  }
  function renderPreview(category,item){
    if (previewPlaybackCleanup) previewPlaybackCleanup();
    previewPlaybackCleanup = null;
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
    if (identity && identity.cleanup) previewPlaybackCleanup = identity.cleanup;
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
    preferredSelection = {category:String(category),id:Number(item.id)};
    renderPreview(category,item);
  }
  function wirePreview(node,category,item){
    node.classList.add('shop-previewable');
    node.tabIndex = 0;
    node.setAttribute('role','group');
    node.setAttribute('data-shop-category',String(category));
    node.setAttribute('data-shop-item-id',String(item.id));
    node.setAttribute('aria-label',t('shop_preview_item_aria',shopItemName(category,item)));
    node.setAttribute('aria-current','false');
    node.__shopPreviewSelection = { category, item };
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
    if (!previewSelection && !renderingCatalog){
      selectPreview(node,category,item);
    }
  }
  function render(){
    listEl.innerHTML = '';
    const restoreSelection = previewSelection
      ? {category:String(previewSelection.category),id:Number(previewSelection.item && previewSelection.item.id)}
      : preferredSelection;
    preferredSelection = null;
    previewSelection = null;
    renderingCatalog = true;
    Array.from(tabs.children).forEach((node, i) => {const active=defs[i][0]===tab;node.classList.toggle('btn-primary',active);node.setAttribute('aria-selected',String(active));node.tabIndex=active?0:-1;});
    catalog.setAttribute('aria-labelledby','shop-tab-'+tab);
    if (tab === 'avatars'){
      // A legacy isolated host can load this module before the asset helper;
      // its fallback is display-only and never grants an entitlement.
      const avatarItems = typeof curatedAvatarCatalogItems === 'function'
        ? curatedAvatarCatalogItems(PLAYROOM_AVATARS, account.avatar)
        : PLAYROOM_AVATARS.filter(a => !a.free || a.id === account.avatar);
      avatarItems.forEach(a => {
        const defaultFree = typeof isCuratedDefaultFreeAvatarId === 'function' ? isCuratedDefaultFreeAvatarId(a.id) : !!a.free;
        const owned = defaultFree || ownItem(account, 'avatars', a.id);
        const it = el('div','shop-item' + (account.avatar === a.id ? ' selected' : '') + (owned ? ' owned' : ''));
        it.appendChild(avatarCanvas(a.id, 48));
        it.appendChild(el('div','si-name', shopItemName('avatars',a)));
        const rarity=collectionRarityBadge('avatars',a);if(rarity)it.appendChild(rarity);
        if (!owned){
          const price = el('div','si-price');
          price.appendChild(currencyAmountNode(a.price,{sizeClass:'sm'}));
          it.appendChild(price);
          const buy = markGuestMutationControl(el('button','btn btn-primary',t('shop_buy')));
          buy.addEventListener('click', () => {
            requestPurchase('avatars', a.id, buy);
          });
          it.appendChild(buy);
        } else {
          it.appendChild(el('div','si-price',defaultFree ? t('shop_free') : t('shop_owned')));
          const use = el('button','btn',t('shop_use'));
          use.addEventListener('click', () => { account.avatar = a.id; saveAccount(); syncProfiles(); closeShop(); toast(t('shop_avatar_changed')); if (typeof emitUiAudioCue === 'function') emitUiAudioCue('equip_change', .58); });
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
          const price = el('div','si-price'); price.appendChild(currencyAmountNode(item.price,{sizeClass:'sm'})); it.appendChild(price);
          const buy=markGuestMutationControl(el('button','btn btn-primary',t('shop_buy'))); buy.addEventListener('click',()=>requestPurchase('game_cosmetics',item.id,buy)); it.appendChild(buy);
        } else {
          it.appendChild(el('div','si-price',equipped?t('shop_equipped'):t('shop_owned')));
          const use=el('button','btn '+(equipped?'btn-primary':''),equipped?t('shop_equipped'):t('shop_equip'));
          use.addEventListener('click',()=>{account.gameCosmetics=account.gameCosmetics||{};account.gameCosmetics[item.game]={...(account.gameCosmetics[item.game]||{}),[item.slot]:item.value};saveAccount();syncProfiles();render();renderMe();toast(t('shop_applied')+'「'+shopItemName('game_cosmetics',item)+'」');if(typeof emitUiAudioCue==='function')emitUiAudioCue('equip_change',.58);});
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
          price.appendChild(currencyAmountNode(item.price,{sizeClass:'sm'}));
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
            if (typeof emitUiAudioCue === 'function') emitUiAudioCue('equip_change', .58);
          });
          it.appendChild(use);
        }
        wirePreview(it,cat,item);
        listEl.appendChild(it);
      });
    }
    renderingCatalog = false;
    const selected = restoreSelection
      ? Array.from(listEl.querySelectorAll('.shop-item')).find(node =>
          node.getAttribute('data-shop-category') === restoreSelection.category &&
          Number(node.getAttribute('data-shop-item-id')) === restoreSelection.id)
      : (listEl.querySelectorAll ? listEl.querySelectorAll('.shop-item')[0] : null);
    if (selected && selected.__shopPreviewSelection){
      selectPreview(selected,selected.__shopPreviewSelection.category,selected.__shopPreviewSelection.item);
    }
    if (activeShopPurchase && activeShopPurchase.modal === bd){
      const pendingCard = Array.from(listEl.querySelectorAll('.shop-item')).find(node =>
        node.getAttribute('data-shop-category') === activeShopPurchase.category &&
        Number(node.getAttribute('data-shop-item-id')) === activeShopPurchase.id);
      const pendingButton = pendingCard && pendingCard.querySelector ? pendingCard.querySelector('button.btn-primary') : null;
      if (pendingButton){
        activeShopPurchase.button = pendingButton;
        pendingButton.disabled = true;
        pendingButton.setAttribute('aria-busy','true');
        pendingButton.textContent = t('shop_processing');
      }
      activeShopPurchase.label = shopPurchaseItemLabel(activeShopPurchase.category,activeShopPurchase.id);
      activeShopPurchase.statusNode = purchaseStatus;
      setShopPurchaseStatus(purchaseStatus,'shop_purchase_pending',[activeShopPurchase.label],null);
    }
  }
  function refresh(){
    const localize = typeof setLocalizedText === 'function' ? setLocalizedText : ((node,value) => { if (node) node.textContent = value; });
    localize(headerTitle,t('shop_title'));
    localize(headerSubtitle,t('shop_preview_hint'));
    localize(balLabel,t('shop_available_label'));
    syncShopBalance();
    localize(closeTop,t('close'));
    if (guestNotice) localize(guestNotice,t('guest_persistence_disabled'));
    if (adminNote) localize(adminNote,t('test_admin_shop_note'));
    tabs.setAttribute('aria-label',t('shop_title'));
    render();
  }
  let closed = false;
  let dialogClose = null;
  function releaseShopResources(){
    if (activeCollectionPreviewClose) activeCollectionPreviewClose();
    if (activeShopPurchase && activeShopPurchase.modal === bd) clearShopPurchaseFeedback({silent:true});
    if (previewPlaybackCleanup) previewPlaybackCleanup();
    previewPlaybackCleanup = null;
    if (previewBackground) releasePremiumBackground(previewBackground);
    previewBackground = null;
    if (activeShopRefresh === refresh) activeShopRefresh = null;
    if (activeShopModal === bd) activeShopModal = null;
    releaseShopLanguageRefresh();
    releaseModalScrollLock(bd);
  }
  function closeShop(){
    if (closed) return false;
    closed = true;
    settleShopSurfaceMotion('close');
    if (typeof emitUiAudioCue === 'function') emitUiAudioCue('ui_cancel', .34);
    return dialogClose ? dialogClose() : (releaseShopResources(),bd.remove(),true);
  }
  activeShopRefresh = refresh;
  render();
  card.appendChild(tabs);
  catalog.appendChild(listEl);
  content.appendChild(previewEl);
  content.appendChild(catalog);
  card.appendChild(content);
  bd.appendChild(card);
  document.body.appendChild(bd);
  if(typeof setupAccessibleOverlayDialog==='function')dialogClose=setupAccessibleOverlayDialog(bd,card,closeTop,t('shop_title'),()=>{settleShopSurfaceMotion('dialog_closed');releaseShopResources();});
  else bd.addEventListener('click', e => { if (e.target === bd) closeShop(); });
  runShopSurfaceMotion('open',bd,card);
  if (typeof emitUiAudioCue === 'function') emitUiAudioCue('ui_confirm', .34);
}
