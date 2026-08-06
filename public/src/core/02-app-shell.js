/* ================= 应用外壳 ================= */
let playerCount = 2;
let aiMode = false;
let currentGame = null; // { reset }
let currentGameId = null;


/* ================= Settings 设置系统 ================= */
function openSettingsPage() {
  const bd = el("div","modal-backdrop");
  const card = el("div","modal-card");
  card.style.width = "520px";
  card.appendChild(el("h3", null, "⚙️ " + t("settings")));

  // Theme section
  const themeLabel = el("div", null, "");
  themeLabel.style.cssText = "font-weight:600; margin:10px 0 6px; font-size:14px";
  themeLabel.textContent = "🎨 " + t("theme");
  card.appendChild(themeLabel);
  const themeRow = el("div");
  themeRow.style.cssText = "display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap";
  THEME_LIST.forEach(tv => {
    const btn = el("button","btn" + (getTheme() === tv.id ? " btn-primary" : ""));
    btn.textContent = tv.icon + ' ' + tv.nameZh;
    btn.title = tv.name;
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
  const langLabel = el("div", null, "");
  langLabel.style.cssText = "font-weight:600; margin:10px 0 6px; font-size:14px";
  langLabel.textContent = "🌐 " + t("language");
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
    btn.addEventListener("click", () => {
      setLanguage(l.code);
      langRow.querySelectorAll("button").forEach(b => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
      if (account) {
        account.lang = l.code;
        saveAccount();
        if (online.connected) {
          online.send({ type:"profile", payload: { uid: account.uid, name: account.name, avatar: account.avatar, lang: l.code } });
        }
      }
    });
    langRow.appendChild(btn);
  });
  card.appendChild(langRow);

  const langNote = el("p","lb-note");
  langNote.textContent = "选择语言后即时生效，并同步到个人档案。其他玩家可以看到你的语言旗帜。";
  card.appendChild(langNote);

  // Server section (merged from openSettings)
  const srvLabel = el("div", null, "");
  srvLabel.style.cssText = "font-weight:600; margin:10px 0 6px; font-size:14px";
  srvLabel.textContent = "🔗 " + t("server_config");
  card.appendChild(srvLabel);
  const srvInput = el("input","nick-input");
  srvInput.type = "text";
  srvInput.placeholder = "服务端地址（留空 = 自动）";
  try { srvInput.value = localStorage.getItem("mg_server") || online.defaultServer; } catch {}
  card.appendChild(srvInput);
  card.appendChild(el("p","lb-note","前端与联机服务不在同一域名时，填写服务端地址，保存后重新连接生效。"));

  const close = el("button","btn btn-primary", t("close"));
  close.addEventListener("click", () => {
    try { localStorage.setItem("mg_server", srvInput.value.trim()); } catch {}
    bd.remove();
    toast("设置已保存");
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
