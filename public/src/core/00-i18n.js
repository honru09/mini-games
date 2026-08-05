

/* ================= i18n 国际化框架 ================= */
const LOCALES = {};
let currentLocale = {};
let currentLang = 'zh-CN';

async function loadLocale(lang) {
  if (LOCALES[lang]) { currentLocale = LOCALES[lang]; currentLang = lang; return; }
  try {
    const resp = await fetch('locales/' + lang + '.json');
    if (!resp.ok) throw new Error('locale not found');
    const data = await resp.json();
    LOCALES[lang] = data;
    currentLocale = data;
    currentLang = lang;
  } catch (e) {
    if (lang !== 'zh-CN') { loadLocale('zh-CN'); return; }
    currentLocale = {};
    currentLang = 'zh-CN';
  }
}

function t(key, ...args) {
  let text = currentLocale[key];
  if (text === undefined || text === null) {
    if (currentLang !== 'en-US' && LOCALES['en-US'] && LOCALES['en-US'][key] !== undefined) {
      text = LOCALES['en-US'][key];
    } else {
      return key;
    }
  }
  if (args.length > 0) {
    let i = 0;
    text = text.replace(/%[sd]/g, () => {
      const arg = args[i++];
      return arg !== undefined ? String(arg) : '';
    });
  }
  return text;
}

function applyI18n(root) {
  root = root || document;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.title = t(key);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = t(key);
  });
  const titleEl = document.querySelector('title[data-i18n]');
  if (titleEl) titleEl.textContent = t(titleEl.getAttribute('data-i18n'));
}

const LANG_FLAGS = { 'zh-CN': '🇨🇳', 'en-US': '🇺🇸', 'uk-UA': '🇺🇦' };
const LANG_NAMES = { 'zh-CN': '中文', 'en-US': 'English', 'uk-UA': 'Українська' };

function langFlag(lang) { return LANG_FLAGS[lang] || ''; }

function setLanguage(lang) {
  currentLang = lang;
  try { localStorage.setItem('mg_lang', lang); } catch {}
  if (document.documentElement) {
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }
  loadLocale(lang).then(() => {
    applyI18n();
    renderHub();
    renderLeaderboard();
    renderAccounts();
    renderMe();
    renderSlots();
    renderLobby();
    if (online.room) renderRoomPanel();
    if (online.connected && account && account.uid) {
      online.send({ type:'profile', payload: { uid: account.uid, name: account.name, avatar: account.avatar, lang: lang } });
    }
  });
}

function initI18n() {
  let lang = 'zh-CN';
  try { lang = localStorage.getItem('mg_lang') || 'zh-CN'; } catch {}
  if (!['zh-CN','en-US','uk-UA'].includes(lang)) lang = 'zh-CN';
  setLanguage(lang);
}

'use strict';