/* ================= 账号注册 / PIN 登录 ================= */
function openAuthModal(mode){
  if (authModalEl){
    releaseModalScrollLock(authModalEl);
    authModalEl.remove();
  }
  const bd = el('div','modal-backdrop auth-backdrop');
  authModalEl = bd;
  acquireModalScrollLock(bd);
  const card = el('div','modal-card auth-card');
  let m = mode || 'register';
  let avatar = 100;
  let bg = 0;
  let catTab = 'pixel';

  const closeAuth = () => {
    if (authModalEl === bd) authModalEl = null;
    releaseModalScrollLock(bd);
    bd.remove();
  };
  const field = (labelKey,input) => {
    const group = el('label','auth-field');
    group.appendChild(el('span','auth-field-label',t(labelKey)));
    group.appendChild(input);
    return group;
  };

  function render(){
    card.innerHTML = '';
    card.classList.toggle('auth-register-mode',m === 'register');
    card.classList.toggle('auth-login-mode',m === 'login');

    const hero = el('div','auth-hero');
    hero.appendChild(el('div','big',m === 'register' ? '✨' : '🔑'));
    const heroCopy = el('div','auth-hero-copy');
    heroCopy.appendChild(el('h2',null,t(m === 'register' ? 'register_title' : 'login_title')));
    heroCopy.appendChild(el('p',null,t(m === 'register' ? 'register_intro' : 'login_intro')));
    hero.appendChild(heroCopy);
    card.appendChild(hero);

    if (m === 'register'){
      const layout = el('div','auth-register-layout');
      const identity = el('section','auth-choice-panel');
      const details = el('section','auth-details-panel');

      identity.appendChild(el('div','auth-section-title',t('auth_avatar_note')));
      const preview = el('div','auth-avatar-wrap');
      const stage = el('div','avatar-stage');
      const updatePreview = () => {
        stage.innerHTML = '';
        stage.appendChild(avatarCanvas(avatar,72,{animate:true}));
      };
      updatePreview();
      preview.appendChild(stage);
      identity.appendChild(preview);

      const catTabs = el('div','shop-tabs auth-category-tabs');
      const categories = [{id:'all',name:t('avatar_category_all'),icon:''},...AVATAR_CATEGORIES];
      const grid = el('div','avatar-grid auth-avatar-grid');
      function renderAvatarGrid(){
        grid.innerHTML = '';
        PLAYROOM_AVATARS.forEach(meta => {
          if (catTab !== 'all' && meta.theme !== catTab) return;
          const locked = avatarLocked(meta.id);
          const opt = el('button','avatar-opt' + (meta.id === avatar ? ' selected' : '') + (locked ? ' locked' : ''));
          opt.type = 'button';
          opt.appendChild(avatarCanvas(meta.id,40));
          opt.setAttribute('aria-label',t('profile_avatar_aria',meta.id + 1));
          if (locked){
            opt.appendChild(el('span','avatar-lock','🔒' + CURRENCY + meta.price));
            opt.addEventListener('click',() => toast(t('auth_avatar_locked',shopItemName('avatars',meta),CURRENCY,meta.price)));
          } else {
            opt.addEventListener('click',() => {
              avatar = meta.id;
              grid.querySelectorAll('.avatar-opt').forEach(node => node.classList.toggle('selected',node === opt));
              updatePreview();
            });
          }
          grid.appendChild(opt);
        });
      }
      categories.forEach(category => {
        const button = el('button','btn shop-tab' + (catTab === category.id ? ' btn-primary' : ''));
        button.type = 'button';
        const label = category.id === 'all' ? t('avatar_category_all') : avatarCategoryName(category);
        button.textContent = (category.icon ? category.icon + ' ' : '') + label;
        button.addEventListener('click',() => {
          catTab = category.id;
          catTabs.querySelectorAll('.shop-tab').forEach(node => node.classList.toggle('btn-primary',node === button));
          renderAvatarGrid();
        });
        catTabs.appendChild(button);
      });
      identity.appendChild(catTabs);
      identity.appendChild(grid);
      renderAvatarGrid();

      details.appendChild(el('div','auth-section-title',t('auth_account_details')));
      const nameInput = el('input','nick-input');
      nameInput.type = 'text';
      nameInput.maxLength = 12;
      nameInput.placeholder = t('profile_name_placeholder');
      details.appendChild(field('auth_name_label',nameInput));

      details.appendChild(el('div','auth-field-label',t('profile_background')));
      const bgGrid = el('div','bg-grid auth-bg-grid');
      const backgrounds = [{id:0,cls:'bg-0',name:t('default_label')},...SHOP.backgrounds.filter(item => item.id >= 1 && item.id <= 6).map(item => ({...item,name:shopItemName('backgrounds',item)}))];
      backgrounds.forEach(item => {
        const swatch = el('button','bg-swatch ' + item.cls + (item.id === bg ? ' selected' : ''));
        swatch.type = 'button';
        swatch.title = item.name;
        swatch.setAttribute('aria-label',item.name);
        swatch.addEventListener('click',() => {
          bg = item.id;
          bgGrid.querySelectorAll('.bg-swatch').forEach(node => node.classList.toggle('selected',node === swatch));
        });
        bgGrid.appendChild(swatch);
      });
      details.appendChild(bgGrid);

      const pinInput = el('input','nick-input');
      pinInput.type = 'password';
      pinInput.autocomplete = 'new-password';
      pinInput.maxLength = 20;
      pinInput.placeholder = t('auth_pin_create_placeholder');
      details.appendChild(field('auth_pin_label',pinInput));
      const pin2 = el('input','nick-input');
      pin2.type = 'password';
      pin2.autocomplete = 'new-password';
      pin2.maxLength = 20;
      pin2.placeholder = t('auth_pin_confirm_placeholder');
      details.appendChild(field('auth_pin_confirm_label',pin2));
      details.appendChild(el('p','pin-hint',t('auth_pin_hint')));

      const actions = el('div','auth-actions');
      const submit = el('button','btn btn-primary',t('register_btn'));
      submit.type = 'button';
      submit.addEventListener('click',() => {
        const name = nameInput.value.trim();
        if (!name){ toast(t('name_required')); return; }
        if (pinInput.value !== pin2.value){ toast(t('pin_mismatch')); return; }
        if (!/^[A-Za-z0-9]{4,20}$/.test(pinInput.value)){ toast(t('pin_invalid')); return; }
        registerAccount(name,pinInput.value,avatar,bg,0,0);
      });
      const toLogin = el('button','btn btn-ghost',t('register_switch_login'));
      toLogin.type = 'button';
      toLogin.addEventListener('click',() => { m = 'login'; render(); });
      const cancel = el('button','btn',t('cancel'));
      cancel.type = 'button';
      cancel.addEventListener('click',closeAuth);
      actions.appendChild(submit);
      actions.appendChild(toLogin);
      actions.appendChild(cancel);
      details.appendChild(actions);

      layout.appendChild(identity);
      layout.appendChild(details);
      card.appendChild(layout);
    } else {
      const loginBody = el('div','auth-login-body');
      const pinInput = el('input','nick-input');
      pinInput.type = 'password';
      pinInput.autocomplete = 'current-password';
      pinInput.maxLength = 20;
      pinInput.placeholder = t('auth_pin_login_placeholder');
      loginBody.appendChild(field('auth_pin_label',pinInput));
      const actions = el('div','auth-actions');
      const submit = el('button','btn btn-primary',t('login_btn'));
      submit.type = 'button';
      submit.addEventListener('click',() => loginAccount(pinInput.value));
      const toRegister = el('button','btn btn-ghost',t('login_switch_register'));
      toRegister.type = 'button';
      toRegister.addEventListener('click',() => { m = 'register'; render(); });
      const cancel = el('button','btn',t('cancel'));
      cancel.type = 'button';
      cancel.addEventListener('click',closeAuth);
      actions.appendChild(submit);
      actions.appendChild(toRegister);
      actions.appendChild(cancel);
      loginBody.appendChild(actions);
      card.appendChild(loginBody);
    }
  }

  render();
  bd.appendChild(card);
  bd.addEventListener('click',event => { if (event.target === bd) closeAuth(); });
  document.body.appendChild(bd);
}
