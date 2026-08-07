/* ================= 账号注册 / PIN 登录 ================= */
function openAuthModal(mode){
  const bd = el("div","modal-backdrop auth-backdrop");
  authModalEl = bd;
  const card = el("div","modal-card");
  card.style.width = "460px";
  let m = mode || "register";
  function render(){
    card.innerHTML = "";
    const hero = el("div","auth-hero");
    hero.appendChild(el("div","big", m === "register" ? "✨" : "🔑"));
    hero.appendChild(el("h2", null, t(m === "register" ? 'register_title' : 'login_title')));
    hero.appendChild(el("p", null, t(m === "register" ? 'register_intro' : 'login_intro')));
    card.appendChild(hero);
    if (m === "register"){
      let avatar = 100, bg = 0, catTab = "all";
      const nameInput = el("input","nick-input");
      nameInput.type = "text"; nameInput.maxLength = 12;
      nameInput.placeholder = t('profile_name_placeholder');
      card.appendChild(nameInput);
      const avLabel = el("div","lb-note",t('auth_avatar_note'));
      card.appendChild(avLabel);
      const catTabs = el("div","shop-tabs");
      const cats = [
        {id:"all"},{id:"basic"},{id:"theme"},...AVATAR_CATEGORIES.map(item=>({id:item.id})),
      ];
      const grid = el("div","avatar-grid auth-avatar-grid");
      function renderAvatarGrid(){
        grid.innerHTML = "";
        for (let i = 0; i < AVATAR_COUNT; i++){
          if (catTab !== "all" && avatarCategory(i) !== catTab) continue;
          const locked = avatarLocked(i);
          const opt = el("button","avatar-opt" + (i === avatar ? " selected" : "") + (locked ? " locked" : ""));
          opt.type = "button";
          opt.appendChild(avatarCanvas(i, 26));
          opt.setAttribute("aria-label", t('profile_avatar_aria',i+1));
          if (locked){
            const meta = avatarMeta(i);
            opt.appendChild(el("span","avatar-lock","🔒" + CURRENCY + (meta ? meta.price : 0)));
            opt.addEventListener("click", () => {
              toast(t('auth_avatar_locked', meta ? shopItemName('avatars', meta) : t('shop_tab_avatars'), CURRENCY, meta ? meta.price : 0));
            });
          } else {
            opt.addEventListener("click", () => {
              avatar = i;
              grid.querySelectorAll(".avatar-opt").forEach(o => o.classList.toggle("selected", o === opt));
              stage.innerHTML = "";
              stage.appendChild(avatarCanvas(i, 56));
            });
          }
          grid.appendChild(opt);
        }
      }
      cats.forEach(c => {
        const tb = el("button","btn shop-tab" + (catTab === c.id ? " btn-primary" : ""));
        tb.textContent = t('avatar_category_' + c.id);
        tb.addEventListener("click", () => {
          catTab = c.id;
          catTabs.querySelectorAll(".shop-tab").forEach(t => t.classList.remove("btn-primary"));
          tb.classList.add("btn-primary");
          renderAvatarGrid();
        });
        catTabs.appendChild(tb);
      });
      card.appendChild(catTabs);
      const preview = el("div","auth-avatar-wrap");
      const stage = el("div","avatar-stage");
      stage.appendChild(avatarCanvas(avatar, 56));
      preview.appendChild(stage);
      card.appendChild(preview);
      card.appendChild(grid);
      renderAvatarGrid();
      card.appendChild(el("div","lb-note",t('profile_background')));
      const bgGrid = el("div","bg-grid");
      const defSw = el("div","bg-swatch" + (bg === 0 ? " selected" : "") + " bg-0");
      defSw.title = t('default_label');
      defSw.addEventListener("click", () => {
        bg = 0;
        bgGrid.querySelectorAll(".bg-swatch").forEach(x => x.classList.toggle("selected", x === defSw));
      });
      bgGrid.appendChild(defSw);
      SHOP.backgrounds.forEach(b => {
        const sw = el("div","bg-swatch" + (b.id === bg ? " selected" : "") + " " + b.cls);
        sw.title = shopItemName('backgrounds', b);
        sw.addEventListener("click", () => {
          bg = b.id;
          bgGrid.querySelectorAll(".bg-swatch").forEach(x => x.classList.toggle("selected", x === sw));
        });
        bgGrid.appendChild(sw);
      });
      card.appendChild(bgGrid);
      const pinInput = el("input","nick-input");
      pinInput.type = "password"; pinInput.autocomplete = "new-password"; pinInput.setAttribute("autocomplete", "new-password"); pinInput.maxLength = 20;
      pinInput.placeholder = t('auth_pin_create_placeholder');
      card.appendChild(pinInput);
      const pin2 = el("input","nick-input");
      pin2.type = "password"; pin2.autocomplete = "new-password"; pin2.setAttribute("autocomplete", "new-password"); pin2.maxLength = 20;
      pin2.placeholder = t('auth_pin_confirm_placeholder');
      card.appendChild(pin2);
      card.appendChild(el("p","pin-hint",t('auth_pin_hint')));
      const submit = el("button","btn btn-primary",t('register_btn'));
      submit.addEventListener("click", () => {
        const nm = nameInput.value.trim();
        if (!nm){ toast(t('name_required')); return; }
        if (pinInput.value !== pin2.value){ toast(t('pin_mismatch')); return; }
        if (!/^[A-Za-z0-9]{4,20}$/.test(pinInput.value)){ toast(t('pin_invalid')); return; }
        registerAccount(nm, pinInput.value, avatar, bg, 0, 0);
      });
      card.appendChild(submit);
      const toLogin = el("button","btn btn-ghost",t('register_switch_login'));
      toLogin.addEventListener("click", () => { m = "login"; render(); });
      card.appendChild(toLogin);
    } else {
      const pinInput = el("input","nick-input");
      pinInput.type = "password"; pinInput.autocomplete = "current-password"; pinInput.setAttribute("autocomplete", "current-password"); pinInput.maxLength = 20;
      pinInput.placeholder = t('auth_pin_login_placeholder');
      card.appendChild(pinInput);
      const submit = el("button","btn btn-primary",t('login_btn'));
      submit.addEventListener("click", () => loginAccount(pinInput.value));
      card.appendChild(submit);
      const toReg = el("button","btn btn-ghost",t('login_switch_register'));
      toReg.addEventListener("click", () => { m = "register"; render(); });
      card.appendChild(toReg);
    }
    const cancel = el("button","btn",t('cancel'));
    cancel.addEventListener("click", () => bd.remove());
    card.appendChild(cancel);
  }
  render();
  bd.appendChild(card);
  bd.addEventListener("click", e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}
