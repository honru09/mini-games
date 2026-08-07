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
        button.textContent = '购买';
      }
    }, 8000);
  }
}

function openShop(){
  if (!account){ openAuthModal(); return; }
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.style.width = '520px';
  const shopTitle=el('h3');shopTitle.appendChild(icon('store',20));shopTitle.appendChild(el('span',null,t('shop_title')));card.appendChild(shopTitle);
  const bal = el('div','stat-chip');
  bal.appendChild(currencyIcon());
  const balValue = el('span', null, ' ' + (account.coins || 0) + ' 可用');
  bal.appendChild(balValue);
  card.appendChild(bal);
  let tab = 'avatars', themeFilter='all';
  const cosmeticName=item=>premiumBackgroundMeta(item&&item.id)?t('premium_bg_'+item.id):item.name;
  const tabs = el('div','shop-tabs');
  const defs = [
    ['avatars','头像'], ['dynamicAvatars','动态头像'], ['frames','头像框'], ['effects','名称与动态效果'], ['backgrounds','背景'],
  ];
  defs.forEach(([k, label]) => {
    const t = el('button','btn shop-tab' + (k === tab ? ' btn-primary' : ''), label);
    t.addEventListener('click', () => { tab = k; render(); });
    tabs.appendChild(t);
  });
  const listEl = el('div','shop-grid');
  const filters=el('div','shop-tabs');
  [{id:'all',name:'全部'},...AVATAR_CATEGORIES].forEach(item=>{const b=el('button','btn shop-tab'+(item.id==='all'?' btn-primary':''),item.name);b.addEventListener('click',()=>{themeFilter=item.id;filters.querySelectorAll('.shop-tab').forEach(x=>x.classList.toggle('btn-primary',x===b));render();});filters.appendChild(b);});
  function previewAvatar(item){
    const pbd=el('div','modal-backdrop'),pc=el('div','modal-card');pc.appendChild(el('h3',null,'试用 · '+item.name));const hero=el('div','profile-hero bg-'+(account.background||0));applyPremiumBackground(hero,account.background||0,'profile');const st=el('div','avatar-stage effect-'+(account.effect||0));if(account.frame)st.appendChild(el('span','frame-ring '+((SHOP.frames.find(f=>f.id===account.frame)||{}).cls||''),''));st.appendChild(avatarCanvas(item.id,96,{animate:true}));hero.appendChild(st);const nm=el('div','pname');nm.appendChild(nameFxNode(account,account.name));hero.appendChild(nm);hero.appendChild(el('div','profile-identity-scrim','这是购买前的实时 Profile Preview'));pc.appendChild(hero);const closePreview=()=>{releasePremiumBackground(hero);pbd.remove();};const close=el('button','btn','返回商城');close.addEventListener('click',closePreview);pc.appendChild(close);pbd.appendChild(pc);pbd.addEventListener('click',e=>{if(e.target===pbd)closePreview();});document.body.appendChild(pbd);
  }
  function collectionParts(item){
    const index=AVATAR_CATEGORIES.findIndex(theme=>theme.id===item.theme);
    if(index<0)return null;
    const frames=[5,4,1,6,7,8],effects=[3,1,2,1,4,2];
    const themed=PLAYROOM_AVATARS.filter(avatar=>avatar.theme===item.theme);
    const avatar=themed.find(candidate=>candidate.animated===!!item.animated&&!candidate.free)||themed.find(candidate=>!candidate.free)||themed[0];
    return {avatarId:avatar&&avatar.id,frameId:frames[index],effectId:effects[index],name:t('premium_theme_'+item.theme)};
  }
  function collectionProgress(item){
    const parts=collectionParts(item);if(!parts)return null;
    const avatarOwned=PLAYROOM_AVATARS.some(avatar=>avatar.theme===item.theme&&(avatar.free||ownItem(account,'avatars',avatar.id)));
    const owned=[avatarOwned,ownItem(account,'frames',parts.frameId),ownItem(account,'backgrounds',item.id),ownItem(account,'effects',parts.effectId)].filter(Boolean).length;
    return {...parts,owned,total:4};
  }
  function previewBackground(item){
    const pbd=el('div','modal-backdrop'),pc=el('div','modal-card');pc.appendChild(el('h3',null,t('premium_preview_title',cosmeticName(item))));const hero=el('div','profile-hero bg-'+item.id);applyPremiumBackground(hero,item.id,'profile');const st=el('div','avatar-stage effect-'+(account.effect||0));if(account.frame)st.appendChild(el('span','frame-ring '+((SHOP.frames.find(f=>f.id===account.frame)||{}).cls||''),''));st.appendChild(avatarCanvas(account.avatar,96,{animate:true}));hero.appendChild(st);const nm=el('div','pname');nm.appendChild(nameFxNode(account,account.name));hero.appendChild(nm);hero.appendChild(el('div','profile-identity-scrim',t(item.animated?'premium_preview_dynamic_note':'premium_preview_static_note')));pc.appendChild(hero);const progress=collectionProgress(item);if(progress)pc.appendChild(el('div','profile-showcase',t('premium_collection_progress',progress.name,progress.owned,progress.total)));const closePreview=()=>{releasePremiumBackground(hero);pbd.remove();};const close=el('button','btn',t('premium_back_to_shop'));close.addEventListener('click',closePreview);pc.appendChild(close);pbd.appendChild(pc);pbd.addEventListener('click',e=>{if(e.target===pbd)closePreview();});document.body.appendChild(pbd);
  }
  function previewCollection(item){
    const parts=collectionParts(item);if(!parts)return;
    const pbd=el('div','modal-backdrop'),pc=el('div','modal-card');pc.appendChild(el('h3',null,t('premium_collection_preview_title',parts.name)));
    const hero=el('div','profile-hero bg-'+item.id);applyPremiumBackground(hero,item.id,'profile');
    const st=el('div','avatar-stage effect-'+parts.effectId),frame=SHOP.frames.find(candidate=>candidate.id===parts.frameId);if(frame)st.appendChild(el('span','frame-ring '+(frame.cls||''),''));st.appendChild(avatarCanvas(parts.avatarId,96,{animate:true}));hero.appendChild(st);
    const previewAccount={...account,effect:parts.effectId,nameFx:parts.effectId};const nm=el('div','pname');nm.appendChild(nameFxNode(previewAccount,account.name));hero.appendChild(nm);hero.appendChild(el('div','profile-identity-scrim',t('premium_collection_preview_note')));pc.appendChild(hero);
    const progress=collectionProgress(item);pc.appendChild(el('div','profile-showcase',t('premium_collection_progress',progress.name,progress.owned,progress.total)));
    const closePreview=()=>{releasePremiumBackground(hero);pbd.remove();};const close=el('button','btn',t('premium_back_to_shop'));close.addEventListener('click',closePreview);pc.appendChild(close);pbd.appendChild(pc);pbd.addEventListener('click',event=>{if(event.target===pbd)closePreview();});document.body.appendChild(pbd);
  }
  function render(){
    listEl.innerHTML = '';
    Array.from(tabs.children).forEach((tabButton, i) => tabButton.classList.toggle('btn-primary', defs[i][0] === tab));
    filters.classList.toggle('hidden',!['avatars','dynamicAvatars'].includes(tab));
    if (tab === 'avatars' || tab === 'dynamicAvatars'){
      PLAYROOM_AVATARS.filter(a=>(tab==='dynamicAvatars'?a.animated:!a.animated)&&(themeFilter==='all'||a.theme===themeFilter)).forEach(a => {
        const owned = ownItem(account, 'avatars', a.id);
        const it = el('div','shop-item' + (account.avatar === a.id ? ' selected' : '') + (owned ? ' owned' : ''));
        it.appendChild(avatarCanvas(a.id, 34));
        it.appendChild(el('div','si-name', a.name));
        it.appendChild(el('div','seat-meta',a.themeName+(a.animated?' · 动态':'')));
        const trial=el('button','btn','试用');trial.addEventListener('click',()=>previewAvatar(a));it.appendChild(trial);
        if (!owned){
          const price = el('div','si-price');
          price.appendChild(currencyIcon('sm'));
          price.appendChild(el('span', null, ' ' + a.price));
          it.appendChild(price);
          const buy = el('button','btn btn-primary','购买');
          buy.addEventListener('click', () => {
            requestPurchase('avatars', a.id, buy);
          });
          it.appendChild(buy);
        } else {
          it.appendChild(el('div','si-price','已拥有'));
          const use = el('button','btn',account.avatar===a.id?'已装备':'装备');
          use.addEventListener('click', () => { account.avatar = a.id; saveAccount(); syncProfiles(); closeShop(); toast('头像已更换'); });
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
          const premium=premiumBackgroundMeta(item.id);
          if(premium){
            it.classList.add('background-shop-item');
            it.appendChild(backgroundPosterNode(premium,{hoverPreview:true}));
            const badge=el('span','background-tier',t(premium.animated?'premium_animated':'premium_static'));
            it.appendChild(badge);
          }else{
            const sw = el('div','bg-swatch ' + item.cls);
            sw.style.width = '38px'; sw.style.height = '38px';
            it.appendChild(sw);
          }
        } else {
          const st = el('div','mini-avatar-stage' + (tab === 'effects' ? ' ' + item.cls : ''));
          const ring = el('span','frame-ring ' + (tab === 'frames' ? item.cls : ''), '');
          if (tab === 'frames') st.appendChild(ring);
          st.appendChild(avatarCanvas(account.avatar, 30));
          it.appendChild(st);
        }
        it.appendChild(el('div','si-name', cosmeticName(item)));
        if(tab==='backgrounds'&&item.collectionId){const progress=collectionProgress(item);if(progress)it.appendChild(el('div','seat-meta',t('premium_collection_progress',progress.name,progress.owned,progress.total)));const preview=el('button','btn',t('premium_preview'));preview.addEventListener('click',()=>previewBackground(item));it.appendChild(preview);const collectionPreview=el('button','btn',t('premium_collection_preview'));collectionPreview.addEventListener('click',()=>previewCollection(item));it.appendChild(collectionPreview);}
        if (!owned){
          const price = el('div','si-price');
          price.appendChild(currencyIcon('sm'));
          price.appendChild(el('span', null, ' ' + item.price));
          it.appendChild(price);
          const buy = el('button','btn btn-primary','购买');
          buy.addEventListener('click', () => {
            requestPurchase(cat, item.id, buy);
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
            toast(t('shop_applied')+'「' + cosmeticName(item) + '」');
          });
          it.appendChild(use);
        }
        listEl.appendChild(it);
      });
    }
  }
  function refresh(){
    balValue.textContent = ' ' + (account.coins || 0) + ' 可用';
    render();
  }
  function closeShop(){
    if (activeShopRefresh === refresh) activeShopRefresh = null;
    bd.remove();
  }
  activeShopRefresh = refresh;
  render();
  const close = el('button','btn','关闭');
  close.addEventListener('click', closeShop);
  card.appendChild(tabs);
  card.appendChild(filters);
  card.appendChild(listEl);
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) closeShop(); });
  document.body.appendChild(bd);
}
