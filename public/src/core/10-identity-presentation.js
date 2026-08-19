/* ================= Unified player identity presentation =================
 *
 * A deep, presentation-only module.  Callers provide the public profile
 * projection and choose layout options; Avatar/Frame/Effect/NameFx safety,
 * raw-name handling and motion defaults stay local to this implementation.
 */
function playerIdentityNumber(value){
  const number=Number(value);
  return Number.isInteger(number)&&number>=0?number:0;
}
function playerIdentityCatalogItem(kind,value){
  const id=playerIdentityNumber(value),items=typeof SHOP!=='undefined'&&SHOP&&Array.isArray(SHOP[kind])?SHOP[kind]:[];
  return items.find(item=>item&&Number(item.id)===id)||null;
}
function playerIdentityAvatarNode(profile,options){
  const source=profile&&typeof profile==='object'?profile:{},opts=options||{};
  const size=Math.max(16,Math.min(256,Math.round(Number(opts.size)||40)));
  const stage=el(opts.tagName||'span',(opts.stageClass||'mini-avatar-stage')+(opts.className?' '+opts.className:''));
  stage.setAttribute('data-uid',source.uid==null?'':String(source.uid));
  const frame=playerIdentityCatalogItem('frames',source.frame);
  const effect=playerIdentityCatalogItem('effects',source.effect);
  if(frame&&frame.cls)stage.appendChild(el('span','frame-ring '+frame.cls,''));
  if(effect&&effect.cls)stage.classList.add(effect.cls);
  const animate=opts.animate===true&&!(typeof prefersReducedMotion==='function'&&prefersReducedMotion());
  stage.appendChild(avatarCanvas(playerIdentityNumber(source.avatar),size,{animate}));
  return stage;
}
function playerIdentityNameNode(profile,options){
  const source=profile&&typeof profile==='object'?profile:{},opts=options||{};
  const hasExplicitName=Object.prototype.hasOwnProperty.call(opts,'name')&&typeof opts.name==='string';
  const raw=hasExplicitName?opts.name:(typeof source.name==='string'?source.name:'');
  const fx=playerIdentityNumber(source.nameFx),className=(opts.className?opts.className+' ':'')+(fx>=1&&fx<=4?'name-fx-'+fx:'');
  const node=raw||hasExplicitName?elRaw(opts.tagName||'span',className.trim()||null,raw):el(opts.tagName||'span',className.trim()||null,t(opts.fallbackKey||'social_player'));
  if(opts.includeLanguage&&source.lang&&typeof langFlag==='function'){
    const flag=el('span','player-identity-lang',langFlag(source.lang));
    flag.setAttribute('aria-hidden','true');
    node.appendChild(flag);
  }
  return node;
}
function playerIdentityClusterNode(profile,options){
  const source=profile&&typeof profile==='object'?profile:{},opts=options||{};
  const interactive=typeof opts.onOpenProfile==='function'&&!!source.uid;
  const root=el(interactive?'button':(opts.tagName||'span'),'player-identity-cluster'+(opts.className?' '+opts.className:''));
  if(interactive){
    root.type='button';
    root.setAttribute('aria-label',opts.ariaLabel||t('room_host_profile_aria',source.name||t('social_player')));
    root.addEventListener('click',event=>opts.onOpenProfile(source,event));
  }
  root.appendChild(playerIdentityAvatarNode(source,{size:opts.size,animate:opts.animate,stageClass:opts.avatarStageClass||'mini-avatar-stage'}));
  root.appendChild(playerIdentityNameNode(source,{className:opts.nameClass,includeLanguage:opts.includeLanguage,fallbackKey:opts.fallbackKey}));
  return root;
}
