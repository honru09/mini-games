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
function playerIdentityVisualSize(size){
  const px=Math.max(44,Math.min(192,Math.round(Number(size)||96)));
  return px<=44?'44':px<=64?'64':px<=96?'96':'192';
}
function playerIdentityAtomVisualSize(size){
  return playerIdentityVisualSize((Number(size)||96)*1.1);
}
function playerIdentityLoadAtom(stage,kind,id,size,mode,fallback){
  if(!stage||typeof resolveAvatarFrameEffectUrl!=='function'||!id)return;
  const img=el('img',kind==='frame'?'avatar-frame-art':'avatar-effect-art','');
  img.alt='';img.setAttribute('aria-hidden','true');img.decoding='async';img.loading='eager';img.style.display='none';
  img.dataset.avatarAtom=kind;img.dataset.avatarAtomId=String(id);img.dataset.avatarAtomMode=String(mode||'dynamic');
  stage.appendChild(img);
  const setFallbackVisible=visible=>{
    if(!fallback)return;
    if(fallback.node&&fallback.node.style)fallback.node.style.display=visible?'':'none';
    if(fallback.className&&stage.classList)stage.classList.toggle(fallback.className,visible);
  };
  const show=()=>{if(!img.isConnected)return;img.style.display='';setFallbackVisible(false);stage.classList.add('avatar-'+kind+'-art-ready');stage.dataset['avatar'+(kind==='frame'?'Frame':'Effect')+'Renderer']='art-v1';};
  const fail=()=>{if(!img.isConnected)return;img.style.display='none';setFallbackVisible(true);stage.classList.remove('avatar-'+kind+'-art-ready');stage.dataset['avatar'+(kind==='frame'?'Frame':'Effect')+'Renderer']='css-fallback';};
  img.addEventListener('load',show,{once:true});img.addEventListener('error',fail,{once:true});
  Promise.resolve(resolveAvatarFrameEffectUrl(kind,id,playerIdentityAtomVisualSize(size),mode)).then(url=>{if(!url||!img.isConnected){fail();return;}img.src=url;}).catch(fail);
}
function playerIdentityAvatarNode(profile,options){
  const source=profile&&typeof profile==='object'?profile:{},opts=options||{};
  const size=Math.max(16,Math.min(256,Math.round(Number(opts.size)||40)));
  const stage=el(opts.tagName||'span',(opts.stageClass||'mini-avatar-stage')+(opts.className?' '+opts.className:''));
  stage.setAttribute('data-uid',source.uid==null?'':String(source.uid));
  const frame=playerIdentityCatalogItem('frames',source.frame);
  const effect=playerIdentityCatalogItem('effects',source.effect);
  const frameFallback=frame&&frame.cls?el('span','frame-ring '+frame.cls,''):null;
  const effectFallback=effect&&effect.cls?{className:effect.cls}:null;
  const environmentMode=typeof avatarFrameEffectRuntimeMode==='function'?avatarFrameEffectRuntimeMode():'dynamic';
  const motionMode=environmentMode==='high-contrast'?'high-contrast':opts.animate===true?environmentMode:'static';
  if(effect&&effect.cls)stage.classList.add(effect.cls);
  if(effect&&effect.id)playerIdentityLoadAtom(stage,'effect',effect.id,size,motionMode,effectFallback);
  if(frameFallback)stage.appendChild(frameFallback);
  if(frame&&frame.id)playerIdentityLoadAtom(stage,'frame',frame.id,size,motionMode,{node:frameFallback});
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
