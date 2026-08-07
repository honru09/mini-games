'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^\uFEFF/, '');
const locales = Object.fromEntries(['zh-CN','en-US','uk-UA'].map(lang => [lang, JSON.parse(read(`public/locales/${lang}.json`))]));

class TextNode {
  constructor(value){ this.nodeType = 3; this.nodeValue = String(value); this.parentElement = null; }
}
class Element {
  constructor(tag){ this.nodeType = 1; this.tagName = String(tag || 'div').toUpperCase(); this.children = []; this.parentElement = null; this.attributes = {}; this.title = ''; this.placeholder = ''; this.alt = ''; }
  appendChild(child){ child.parentElement = this; this.children.push(child); return child; }
  get firstChild(){ return this.children[0] || null; }
  get textContent(){ return this.children.map(child => child.nodeType === 3 ? child.nodeValue : child.textContent).join(''); }
  set textContent(value){ this.children = []; if (String(value)) this.appendChild(new TextNode(value)); }
  setAttribute(name, value){ this.attributes[name] = String(value); if (name === 'title' || name === 'placeholder' || name === 'alt') this[name] = String(value); }
  getAttribute(name){ return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  matches(selector){
    if (selector === '*') return true;
    if (selector === 'script' || selector === 'style') return this.tagName.toLowerCase() === selector;
    const attr = /^\[([^\]]+)\]$/.exec(selector);
    return !!(attr && Object.prototype.hasOwnProperty.call(this.attributes, attr[1]));
  }
  closest(selectors){
    const parts = String(selectors).split(',');
    let node = this;
    while (node){ if (parts.some(selector => node.matches(selector))) return node; node = node.parentElement; }
    return null;
  }
  querySelectorAll(selector){
    const out = [], queue = this.children.filter(child => child.nodeType === 1);
    while (queue.length){ const node = queue.shift(); if (node.matches(selector)) out.push(node); queue.push(...node.children.filter(child => child.nodeType === 1)); }
    return out;
  }
}
function textNodes(root){
  const out = [], queue = [root];
  while (queue.length){ const node = queue.shift(); if (node.nodeType === 3) out.push(node); else queue.push(...node.children); }
  return out;
}

const document = {
  body: new Element('body'), documentElement: new Element('html'),
  createElement: tag => new Element(tag),
  createTreeWalker(root){ const nodes = textNodes(root === document ? document.body : root); let index = 0; return { currentNode:null, nextNode(){ if (index >= nodes.length) return false; this.currentNode = nodes[index++]; return true; } }; },
  querySelector(){ return null; }, querySelectorAll(){ return []; },
};
const context = {
  document, NodeFilter:{ SHOW_TEXT:4 }, console, setTimeout, clearTimeout,
  fetch: async () => ({ ok:false }), localStorage:{ getItem(){ return null; }, setItem(){} },
  renderHub(){}, renderLeaderboard(){}, renderAccounts(){}, renderMe(){}, renderSlots(){}, renderLobby(){}, renderRoomPanel(){},
  online:{ room:null, connected:false, send(){} }, account:null, currentGame:null, saveAccount(){},
};
const source = read('public/src/core/00-i18n.js') + `\n;globalThis.__i18nTest={
  load(lang,data){LOCALES[lang]=data;},
  clear(lang){delete LOCALES[lang];},
  set(lang){currentLang=lang;currentLocale=LOCALES[lang];},
  lang(){return currentLang;},
  t,applyI18n,setLocalizedText,translateServerMessage,setLanguage
};`;
vm.runInNewContext(source, context, { filename:'00-i18n.js' });
const api = context.__i18nTest;
Object.entries(locales).forEach(([lang, data]) => api.load(lang, data));

let failed = false;
function check(ok, message){ console.log((ok ? 'PASS  ' : 'FAIL  ') + message); if (!ok) failed = true; }
function format(value, ...args){ let index = 0; return value.replace(/%[sd]/g, () => String(args[index++])); }

const root = new Element('section');
api.set('zh-CN');
const keyed = new Element('div');
api.setLocalizedText(keyed, api.t('monopoly_round_turn', 2, 30, 3));
root.appendChild(keyed);
const direct = new Element('div');
direct.textContent = api.t('ai_persona_teacher_desc');
root.appendChild(direct);
const legacy = new Element('div');
legacy.textContent = '你的回合';
root.appendChild(legacy);
const user = new Element('span');
user.setAttribute('data-i18n-raw', '');
user.textContent = '玩家Winner';
root.appendChild(user);
const declarative = new Element('button');
declarative.setAttribute('data-i18n', 'close');
declarative.setAttribute('data-i18n-title', 'account_button_title');
declarative.setAttribute('data-i18n-placeholder', 'server_placeholder');
declarative.setAttribute('data-i18n-aria-label', 'mode_group_aria');
declarative.setAttribute('data-i18n-alt', 'brand');
root.appendChild(declarative);
const runtimeTitle = new Element('button');
runtimeTitle.setAttribute('title', api.t('ai_persona_teacher_desc'));
root.appendChild(runtimeTitle);
const dynamicRoot = new Element('button');
dynamicRoot.setAttribute('data-i18n', 'close');
dynamicRoot.setAttribute('data-i18n-title', 'account_button_title');

api.set('en-US'); api.applyI18n(root);
api.applyI18n(dynamicRoot);
check(keyed.textContent === format(locales['en-US'].monopoly_round_turn,2,30,3), 'formatted t() node switches from Chinese to English in place');
check(direct.textContent === locales['en-US'].ai_persona_teacher_desc, 'direct textContent=t() node switches to English');
check(legacy.textContent === 'Your turn', 'legacy runtime text switches to English');
check(user.textContent === '玩家Winner', 'user-authored text remains untouched');
check(declarative.textContent === locales['en-US'].close && declarative.title === locales['en-US'].account_button_title, 'declarative text and title switch to English');
check(declarative.placeholder === locales['en-US'].server_placeholder && declarative.attributes['aria-label'] === locales['en-US'].mode_group_aria && declarative.alt === locales['en-US'].brand, 'placeholder, ARIA label and alt switch to English');
check(runtimeTitle.title === locales['en-US'].ai_persona_teacher_desc, 'runtime title=t() attribute switches to English');
check(dynamicRoot.textContent === locales['en-US'].close && dynamicRoot.title === locales['en-US'].account_button_title, 'a dynamically inserted root element localizes itself and its attributes');
check(api.translateServerMessage('房间不存在','','generic_error') === locales['en-US'].server_room_not_found, 'Chinese server message maps to English');
check(api.translateServerMessage('赛事创建受限：snapshot_not_ready','snapshot_not_ready','operation_failed') === locales['en-US'].server_reason_snapshot_not_ready, 'server reason code maps to English');
check(api.translateServerMessage('登录状态已失效，请重新登录','session_expired','account_verify_failed') === locales['en-US'].server_reason_session_expired, 'auth reason maps to a specific English message');
check(api.translateServerMessage('商品不存在','product_not_found','purchase_failed') === locales['en-US'].server_reason_product_not_found, 'shop reason maps to a specific English message');
check(api.translateServerMessage('结算数据无效','invalid_result','result_failed') === locales['en-US'].server_reason_invalid_result, 'settlement reason maps to a specific English message');
check(api.translateServerMessage('赛事不存在或无权访问','tournament_access_denied','operation_failed') === locales['en-US'].server_reason_tournament_access_denied, 'tournament reason maps to a specific English message');
check(api.translateServerMessage('观战模式为只读，不能发送游戏输入','spectator_readonly','operation_failed') === locales['en-US'].server_reason_spectator_readonly, 'spectator reason maps to a specific English message');
check(!/[\u3400-\u9fff]/.test(api.translateServerMessage('未知中文服务端错误','','operation_failed')), 'unknown server message falls back without leaking Chinese');

api.set('uk-UA'); api.applyI18n(root);
check(keyed.textContent === format(locales['uk-UA'].monopoly_round_turn,2,30,3), 'formatted t() node switches directly from English to Ukrainian');
check(direct.textContent === locales['uk-UA'].ai_persona_teacher_desc, 'direct t() node switches directly to Ukrainian');
check(runtimeTitle.title === locales['uk-UA'].ai_persona_teacher_desc, 'runtime title switches directly to Ukrainian');
check(api.translateServerMessage('该游戏最多支持 4 人，当前已加入 5 人','','operation_failed') === format(locales['uk-UA'].server_game_capacity,4,5), 'dynamic server capacity error maps to Ukrainian');
check(legacy.textContent === 'Ваш хід', 'legacy node switches directly to Ukrainian from its source value');
check(user.textContent === '玩家Winner', 'user-authored text is still untouched after multiple switches');

api.set('zh-CN'); api.applyI18n(root);
check(keyed.textContent === format(locales['zh-CN'].monopoly_round_turn,2,30,3), 'formatted t() node switches back to Chinese');
check(direct.textContent === locales['zh-CN'].ai_persona_teacher_desc && legacy.textContent === '你的回合', 'translated nodes restore their Chinese source');
check(api.translateServerMessage('ERR_INVALID_MOVE','ERR_INVALID_MOVE','operation_failed') === locales['zh-CN'].server_reason_err_invalid_move, 'uppercase gameplay protocol code is localized instead of exposed in Chinese');

async function testAsyncLanguageSwitch() {
  api.clear('en-US'); api.clear('uk-UA');
  const pendingLocaleLoads = {};
  const gameLanguageRefreshes = [];
  context.account = { uid:'locale-test', name:'Locale Test', avatar:0, lang:'zh-CN' };
  context.currentGame = { onLanguageChange(lang){ gameLanguageRefreshes.push(lang); } };
  context.fetch = url => new Promise(resolve => { pendingLocaleLoads[url] = resolve; });
  const olderLanguageRequest = api.setLanguage('en-US');
  const latestLanguageRequest = api.setLanguage('uk-UA');
  pendingLocaleLoads['locales/uk-UA.json']({ ok:true, json:async () => locales['uk-UA'] });
  await latestLanguageRequest;
  pendingLocaleLoads['locales/en-US.json']({ ok:true, json:async () => locales['en-US'] });
  await olderLanguageRequest;
  check(api.lang() === 'uk-UA' && document.documentElement.getAttribute('lang') === 'uk-UA', 'slower stale locale request cannot overwrite the latest language');
  check(gameLanguageRefreshes.join(',') === 'uk-UA', 'only the committed language refreshes the active game surface');
  check(context.account.lang === 'uk-UA', 'the account language follows the committed locale rather than the requested stale locale');
  api.clear('en-US');
  context.fetch = async () => ({ ok:false });
  await api.setLanguage('en-US');
  check(api.lang() === 'zh-CN' && document.documentElement.getAttribute('lang') === 'zh-CN', 'failed locale load awaits and commits the Chinese fallback consistently');
  check(gameLanguageRefreshes.join(',') === 'uk-UA,zh-CN', 'fallback language also refreshes the active game surface');
  check(context.account.lang === 'zh-CN', 'locale fallback keeps the account flag consistent with the actual UI language');
}

testAsyncLanguageSwitch().then(() => {
  if (failed) process.exit(1);
  console.log('I18N_RUNTIME_ALL_PASS');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
