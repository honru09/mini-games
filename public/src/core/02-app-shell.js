/* ================= 应用外壳 ================= */
let playerCount = 2;
let aiMode = false;
let currentGame = null; // { reset }
let currentGameId = null;


/* ================= Settings 设置系统 ================= */
function openSettingsPage() {
  const localizedLabel = (tag, className, icon, key) => {
    const node = el(tag, className || null);
    if (icon) node.appendChild(el('span', null, icon + ' '));
    const label = el('span', null, t(key));
    label.setAttribute('data-i18n', key);
    node.appendChild(label);
    return node;
  };
  const bd = el("div","modal-backdrop");
  const card = el("div","modal-card");
  card.style.width = "520px";
  card.appendChild(localizedLabel('h3', null, '⚙️', 'settings'));

  // Theme section
  const themeLabel = localizedLabel('div', null, '🎨', 'theme');
  themeLabel.style.cssText = "font-weight:600; margin:10px 0 6px; font-size:14px";
  card.appendChild(themeLabel);
  const themeRow = el("div");
  themeRow.style.cssText = "display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap";
  THEME_LIST.forEach(tv => {
    const btn = el("button","btn" + (getTheme() === tv.id ? " btn-primary" : ""));
    btn.appendChild(el('span', null, tv.icon + ' '));
    const themeText = el('span', null, themeName(tv));
    themeText.setAttribute('data-i18n', tv.nameKey);
    btn.appendChild(themeText);
    btn.title = themeName(tv);
    btn.setAttribute('data-i18n-title', tv.nameKey);
    btn.addEventListener("click", () => {
      applyTheme(tv.id);
      try { localStorage.setItem("mg_theme", tv.id); } catch {}
      themeRow.querySelectorAll("button").forEach(b => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
    });
    themeRow.appendChild(btn);
  });
  card.appendChild(themeRow);

  // Language section
  const langLabel = localizedLabel('div', null, '🌐', 'language');
  langLabel.style.cssText = "font-weight:600; margin:10px 0 6px; font-size:14px";
  card.appendChild(langLabel);
  const langRow = el("div");
  langRow.style.cssText = "display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap";
  [
    { code: "zh-CN", label: "🇨🇳 中文" },
    { code: "en-US", label: "🇺🇸 English" },
    { code: "uk-UA", label: "🇺🇦 Українська" },
  ].forEach(l => {
    const btn = el("button","btn" + (currentLang === l.code ? " btn-primary" : ""));
    btn.textContent = l.label;
    btn.dataset.langCode = l.code;
    btn.setAttribute('data-i18n-raw', '');
    btn.addEventListener("click", async () => {
      const committed = await setLanguage(l.code);
      if (!committed) return;
      langRow.querySelectorAll("button").forEach(b => b.classList.toggle("btn-primary", b.dataset.langCode === currentLang));
    });
    langRow.appendChild(btn);
  });
  card.appendChild(langRow);

  const langNote = el("p","lb-note");
  langNote.textContent = t('language_note');
  langNote.setAttribute('data-i18n', 'language_note');
  card.appendChild(langNote);

  // Server section (merged from openSettings)
  const srvLabel = localizedLabel('div', null, '🔗', 'server_config');
  srvLabel.style.cssText = "font-weight:600; margin:10px 0 6px; font-size:14px";
  card.appendChild(srvLabel);
  const srvInput = el("input","nick-input");
  srvInput.type = "text";
  srvInput.placeholder = t('server_placeholder');
  srvInput.setAttribute('data-i18n-placeholder', 'server_placeholder');
  try { srvInput.value = localStorage.getItem("mg_server") || online.defaultServer; } catch {}
  card.appendChild(srvInput);
  const serverNote = el('p','lb-note',t('server_note'));
  serverNote.setAttribute('data-i18n', 'server_note');
  card.appendChild(serverNote);

  const close = el("button","btn btn-primary", t("close"));
  close.setAttribute('data-i18n', 'close');
  close.addEventListener("click", () => {
    try { localStorage.setItem("mg_server", srvInput.value.trim()); } catch {}
    bd.remove();
    toast(t('settings_saved'));
  });
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener("click", e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}

function getTheme() {
  try {
    const v = document.documentElement && document.documentElement.getAttribute("data-theme");
    if (v) return v === "dark" ? "midnight" : v;
  } catch {}
  return "light";
}
