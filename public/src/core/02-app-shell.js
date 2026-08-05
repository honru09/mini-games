/* ================= 应用外壳 ================= */
let playerCount = 2;
let aiMode = false;
let currentGame = null; // { reset }
let currentGameId = null;


/* ================= Settings 设置系统 ================= */
function openSettingsPage() {
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.style.width = '460px';
  card.appendChild(el('h3', null, '⚙️ ' + t('settings')));

  // Theme section
  const themeLabel = el('div', null, '');
  themeLabel.style.cssText = 'font-weight:600; margin:10px 0 6px; font-size:14px';
  themeLabel.textContent = '🎨 ' + t('theme');
  card.appendChild(themeLabel);
  const themeRow = el('div');
  themeRow.style.cssText = 'display:flex; gap:8px; margin-bottom:14px';
  ['light','dark'].forEach(tv => {
    const btn = el('button','btn' + (getTheme() === tv ? ' btn-primary' : ''));
    btn.textContent = tv === 'light' ? ('☀️ ' + t('theme_light')) : ('🌙 ' + t('theme_dark'));
    btn.addEventListener('click', () => {
      applyTheme(tv);
      try { localStorage.setItem('mg_theme', tv); } catch {}
      themeRow.querySelectorAll('button').forEach(b => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
    });
    themeRow.appendChild(btn);
  });
  card.appendChild(themeRow);

  // Language section
  const langLabel = el('div', null, '');
  langLabel.style.cssText = 'font-weight:600; margin:10px 0 6px; font-size:14px';
  langLabel.textContent = '🌐 ' + t('language');
  card.appendChild(langLabel);
  const langRow = el('div');
  langRow.style.cssText = 'display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap';
  [
    { code: 'zh-CN', label: '🇨🇳 中文' },
    { code: 'en-US', label: '🇺🇸 English' },
    { code: 'uk-UA', label: '🇺🇦 Українська' },
  ].forEach(l => {
    const btn = el('button','btn' + (currentLang === l.code ? ' btn-primary' : ''));
    btn.textContent = l.label;
    btn.addEventListener('click', () => {
      setLanguage(l.code);
      langRow.querySelectorAll('button').forEach(b => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      // Update account language
      if (account) {
        account.lang = l.code;
        saveAccount();
        if (online.connected) {
          online.send({ type:'profile', payload: { uid: account.uid, name: account.name, avatar: account.avatar, lang: l.code } });
        }
      }
    });
    langRow.appendChild(btn);
  });
  card.appendChild(langRow);

  const note = el('p','lb-note');
  note.textContent = t('language') + ' 选择后即时生效，并同步到个人档案。其他玩家可以看到你的语言旗帜。';
  card.appendChild(note);

  const close = el('button','btn btn-primary', t('close'));
  close.addEventListener('click', () => bd.remove());
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}

function getTheme() {
  try {
    if (document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark') return 'dark';
  } catch {}
  return 'light';
}
