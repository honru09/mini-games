/* ================= 账号注册 / PIN 登录 ================= */
function openAuthModal(mode){
  const bd = el('div','modal-backdrop auth-backdrop');
  authModalEl = bd;
  const card = el('div','modal-card');
  card.style.width = '460px';
  let m = mode || 'register';
  function render(){
    card.innerHTML = '';
    const hero = el('div','auth-hero');
    hero.appendChild(el('div','big', m === 'register' ? '✨' : '🔑'));
    hero.appendChild(el('h2', null, m === 'register' ? '创建你的账号' : 'PIN 登录'));
    hero.appendChild(el('p', null, m === 'register' ? '设置昵称、头像、背景，并创建一个专属 PIN 码。以后在任何设备输入 PIN 即可登录，账号永不丢失。' : '输入注册时设置的 PIN 码即可登录（仅限字母和数字）。'));
    card.appendChild(hero);
    if (m === 'register'){
      let avatar = 0, bg = 0;
      const nameInput = el('input','nick-input');
      nameInput.type = 'text'; nameInput.maxLength = 12;
      nameInput.placeholder = '昵称（12 字以内）';
      card.appendChild(nameInput);
      const avLabel = el('div','lb-note','选择头像');
      card.appendChild(avLabel);
      const grid = el('div','avatar-grid');
      for (let i = 0; i < 20; i++){
        const opt = el('button','avatar-opt' + (i === avatar ? ' selected' : ''));
        opt.type = 'button';
        opt.appendChild(avatarCanvas(i, 26));
        opt.addEventListener('click', () => {
          avatar = i;
          grid.querySelectorAll('.avatar-opt').forEach(o => o.classList.toggle('selected', o === opt));
        });
        grid.appendChild(opt);
      }
      card.appendChild(grid);
      card.appendChild(el('div','lb-note','选择背景'));
      const bgGrid = el('div','bg-grid');
      SHOP.backgrounds.forEach(b => {
        const sw = el('div','bg-swatch' + (b.id === bg ? ' selected' : '') + ' ' + b.cls);
        sw.title = b.name;
        sw.addEventListener('click', () => {
          bg = b.id;
          bgGrid.querySelectorAll('.bg-swatch').forEach(x => x.classList.toggle('selected', x === sw));
        });
        bgGrid.appendChild(sw);
      });
      card.appendChild(bgGrid);
      const pinInput = el('input','nick-input');
      pinInput.type = 'text'; pinInput.maxLength = 20;
      pinInput.placeholder = '设置 PIN 码（4-20 位，仅字母和数字）';
      card.appendChild(pinInput);
      const pin2 = el('input','nick-input');
      pin2.type = 'text'; pin2.maxLength = 20;
      pin2.placeholder = '再次输入 PIN 码确认';
      card.appendChild(pin2);
      card.appendChild(el('p','pin-hint','PIN 是唯一识别你账号的代码，登录时使用，请务必牢记。'));
      const submit = el('button','btn btn-primary','创建账号');
      submit.addEventListener('click', () => {
        const nm = nameInput.value.trim();
        if (!nm){ toast('请输入昵称'); return; }
        if (pinInput.value !== pin2.value){ toast('两次输入的 PIN 不一致'); return; }
        if (!/^[A-Za-z0-9]{4,20}$/.test(pinInput.value)){ toast('PIN 只能包含字母和数字，长度 4-20 位'); return; }
        registerAccount(nm, pinInput.value, avatar, bg);
      });
      card.appendChild(submit);
      const toLogin = el('button','btn btn-ghost','已有账号？输入 PIN 登录');
      toLogin.addEventListener('click', () => { m = 'login'; render(); });
      card.appendChild(toLogin);
    } else {
      const pinInput = el('input','nick-input');
      pinInput.type = 'text'; pinInput.maxLength = 20;
      pinInput.placeholder = '输入 PIN 码';
      card.appendChild(pinInput);
      const submit = el('button','btn btn-primary','登录');
      submit.addEventListener('click', () => loginAccount(pinInput.value));
      card.appendChild(submit);
      const toReg = el('button','btn btn-ghost','没有账号？去注册');
      toReg.addEventListener('click', () => { m = 'register'; render(); });
      card.appendChild(toReg);
    }
    const cancel = el('button','btn','取消');
    cancel.addEventListener('click', () => bd.remove());
    card.appendChild(cancel);
  }
  render();
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}
