/* ================= Ghost Game 账号入口 ================= */
let authUsernameCheckSeq = 0;
let authUsernameCheckTimer = null;
let authPageStatusNode = null;

function authField(labelKey,input,statusNode){
  const group=el('label','auth-field');
  const label=el('span','auth-field-label',t(labelKey));label.setAttribute('data-i18n',labelKey);group.appendChild(label);group.appendChild(input);
  if(statusNode)group.appendChild(statusNode);
  return group;
}
function authInput(type,placeholderKey,autocomplete,maxLength){
  const input=el('input','nick-input');input.type=type;input.autocomplete=autocomplete||'off';input.maxLength=maxLength||64;input.placeholder=t(placeholderKey);input.setAttribute('data-i18n-placeholder',placeholderKey);return input;
}
function setAuthPageError(message,key){
  if(!authPageStatusNode)return;
  authPageStatusNode.className='auth-inline-status error';
  authPageStatusNode.textContent=key?t(key):String(message||t('account_verify_failed'));
}
function setAuthUsernameStatus(payload){
  const node=document.querySelector('[data-auth-username-status]');
  if(!node||!payload||String(node.dataset.requestId||'')!==String(payload.requestId||''))return;
  node.className='auth-inline-status '+(payload.available?'available':'error');
  node.textContent=t(payload.available?'username_available':(payload.reason==='username_invalid'?'username_invalid':'username_taken'));
  node.dataset.available=payload.available?'true':'false';
}
function authToolbar(){
  const toolbar=el('div','ghost-auth-toolbar');
  [{code:'zh-CN',label:'中'},{code:'en-US',label:'EN'},{code:'uk-UA',label:'УК'}].forEach(item=>{const b=elRaw('button','btn',item.label);b.type='button';b.dataset.langCode=item.code;b.classList.toggle('btn-primary',currentLang===item.code);b.addEventListener('click',async()=>{if(await setLanguage(item.code)){if(authModalEl)openAuthModal(authModalEl.dataset.mode||'login');}});toolbar.appendChild(b);});
  const theme=el('button','btn');theme.type='button';
  const syncTheme=()=>{theme.textContent=getTheme()==='dark'?'☀':'☾';const label=t('theme');theme.setAttribute('aria-label',label);theme.title=label;};
  theme.addEventListener('click',()=>{const next=getTheme()==='dark'?'light':'dark';applyTheme(next);try{localStorage.setItem('mg_theme',next);}catch{}syncTheme();});syncTheme();toolbar.appendChild(theme);return toolbar;
}
function authTabs(mode,render){
  const tabs=el('div','ghost-auth-tabs');
  [['login','login_btn'],['register','register_btn']].forEach(([id,key])=>{const b=el('button',null,t(key));b.type='button';b.setAttribute('aria-selected',String(mode===id));b.addEventListener('click',()=>render(id));tabs.appendChild(b);});return tabs;
}
function authConnectionState(){
  const state=el('div','auth-connect-state'+(online&&online.connected?' connected':''),t(online&&online.connected?'online_status_connected':'auth_connecting'));
  state.setAttribute('data-auth-connect-state','');return state;
}
function openAuthModal(mode){
  mode=['login','register','legacy'].includes(mode)?mode:'login';
  if(authModalEl){releaseModalScrollLock(authModalEl);authModalEl.remove();}
  const page=el('div','modal-backdrop auth-backdrop ghost-auth-page');page.dataset.mode=mode;authModalEl=page;acquireModalScrollLock(page);
  const shell=el('div','ghost-auth-shell');
  const brand=el('section','ghost-auth-brand');
  const logo=el('div','ghost-auth-brand-logo');const img=document.createElement('img');img.src='assets/brand/ghost-game-mark.svg';img.alt='';logo.appendChild(img);logo.appendChild(elRaw('span',null,'Ghost Game'));brand.appendChild(logo);
  brand.appendChild(el('h1',null,t('auth_brand_headline')));brand.appendChild(el('p',null,t('auth_brand_intro')));brand.appendChild(authToolbar());
  const card=el('section','modal-card auth-card ghost-auth-card');
  const render=current=>{page.dataset.mode=current;card.innerHTML='';if(current!=='legacy')card.appendChild(authTabs(current,render));renderAuthPanel(card,current,render);};
  render(mode);shell.appendChild(brand);shell.appendChild(card);page.appendChild(shell);document.body.appendChild(page);
}
function renderAuthPanel(card,mode,render){
  const hero=el('div','auth-hero');const copy=el('div','auth-hero-copy');copy.appendChild(el('h2',null,t(mode==='register'?'register_title':mode==='legacy'?'legacy_migrate_title':'login_title')));copy.appendChild(el('p',null,t(mode==='register'?'register_intro_v2':mode==='legacy'?'legacy_migrate_intro':'login_intro_v2')));hero.appendChild(copy);card.appendChild(hero);
  const form=el('form',mode==='login'?'auth-login-body':'auth-details-panel');
  if(mode==='legacy'){
    const pin=authInput('password','auth_pin_login_placeholder','current-password',20);form.appendChild(authField('auth_pin_label',pin));
    const username=authInput('text','auth_username_placeholder','username',20);form.appendChild(authField('auth_username_label',username));
    const password=authInput('password','auth_password_create_placeholder','new-password',64);form.appendChild(authField('auth_password_label',password));
    const confirm=authInput('password','auth_password_confirm_placeholder','new-password',64);form.appendChild(authField('auth_password_confirm_label',confirm));
    const actions=el('div','auth-actions');const submit=el('button','btn btn-primary',t('legacy_migrate_submit'));submit.type='submit';actions.appendChild(submit);const back=el('button','btn btn-ghost',t('back'));back.type='button';back.addEventListener('click',()=>render('login'));actions.appendChild(back);form.appendChild(actions);
    form.addEventListener('submit',event=>{event.preventDefault();if(password.value!==confirm.value){setAuthPageError('', 'password_mismatch');return;}legacyBindAccount(pin.value,username.value,password.value);});
  }else if(mode==='register'){
    const username=authInput('text','auth_username_placeholder','username',20);username.autocapitalize='none';username.spellcheck=false;const usernameStatus=el('div','auth-inline-status',t('username_rule'));usernameStatus.setAttribute('data-auth-username-status','');form.appendChild(authField('auth_username_label',username,usernameStatus));
    username.addEventListener('input',()=>{clearTimeout(authUsernameCheckTimer);usernameStatus.className='auth-inline-status';usernameStatus.textContent=t('username_checking');usernameStatus.dataset.available='false';const requestId=String(++authUsernameCheckSeq);usernameStatus.dataset.requestId=requestId;authUsernameCheckTimer=setTimeout(()=>{if(!/^(?=.{4,20}$)(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]+$/.test(username.value)){usernameStatus.className='auth-inline-status error';usernameStatus.textContent=t('username_invalid');return;}online.send({type:'username_check',payload:{username:username.value,requestId}});},280);});
    const password=authInput('password','auth_password_create_placeholder','new-password',64);form.appendChild(authField('auth_password_label',password));const confirm=authInput('password','auth_password_confirm_placeholder','new-password',64);form.appendChild(authField('auth_password_confirm_label',confirm));form.appendChild(el('p','pin-hint',t('auth_password_hint')));
    const actions=el('div','auth-actions');const submit=el('button','btn btn-primary',t('register_btn'));submit.type='submit';actions.appendChild(submit);form.appendChild(actions);
    form.addEventListener('submit',event=>{event.preventDefault();if(password.value!==confirm.value){setAuthPageError('', 'password_mismatch');return;}if(usernameStatus.dataset.available!=='true'){setAuthPageError('', 'username_check_required');return;}registerCredentialAccount(username.value,password.value);});
  }else{
    const username=authInput('text','auth_username_placeholder','username',20);username.autocapitalize='none';username.spellcheck=false;form.appendChild(authField('auth_username_label',username));const password=authInput('password','auth_password_login_placeholder','current-password',64);form.appendChild(authField('auth_password_label',password));
    const actions=el('div','auth-actions');const submit=el('button','btn btn-primary',t('login_btn'));submit.type='submit';actions.appendChild(submit);const guest=el('button','btn',t('guest_login'));guest.type='button';guest.addEventListener('click',guestLoginAccount);actions.appendChild(guest);const legacy=el('button','btn btn-ghost',t('legacy_pin_entry'));legacy.type='button';legacy.addEventListener('click',()=>render('legacy'));actions.appendChild(legacy);form.appendChild(actions);form.appendChild(el('p','auth-guest-note',t('guest_login_warning')));
    form.addEventListener('submit',event=>{event.preventDefault();loginCredentialAccount(username.value,password.value);});
  }
  authPageStatusNode=el('div','auth-inline-status');authPageStatusNode.setAttribute('role','status');form.appendChild(authPageStatusNode);form.appendChild(authConnectionState());card.appendChild(form);
}
