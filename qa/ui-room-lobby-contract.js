'use strict';

/*
 * UI Room & Lobby Contract v1
 *
 * Public seams under test:
 * - the compiled-from-source room-launch flow a player reaches from Games;
 * - the visible Lobby actions supplied by the server; and
 * - the app-layer ordering that keeps dialogs actionable above navigation.
 *
 * This deliberately avoids asserting room-server internals or changing the
 * create protocol.  Those remain covered by the room/online contracts.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const template = read('public/index-template.html');
const roster = read('public/src/ui/07-roster.js');
const websocket = read('public/src/online/03-websocket.js');
const locales = Object.fromEntries(['zh-CN', 'en-US', 'uk-UA'].map(lang => [
  lang,
  JSON.parse(read('public/locales/' + lang + '.json')),
]));

const failures = [];
function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

function compact(value){
  return String(value).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

function extractBalancedBlock(source, headerPattern){
  const match = headerPattern.exec(source);
  if (!match) return '';
  const open = source.indexOf('{', match.index);
  if (open < 0) return '';
  let depth = 0;
  for (let index = open; index < source.length; index++){
    if (source[index] === '{') depth++;
    else if (source[index] === '}'){
      depth--;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return '';
}

function count(source, pattern){
  return [...source.matchAll(pattern)].length;
}

function placeholderSignature(value){
  return (String(value).match(/%[sd]/g) || []).join('|');
}

/* Layer contract: a dialog must win over sticky desktop/mobile navigation;
 * transient feedback must remain visible while a dialog is open. */
check('P0.2 定义统一 Header、Mobile Nav、Modal 与 Toast 层级令牌',
  /--layer-app-header\s*:/.test(template) &&
  /--layer-mobile-nav\s*:/.test(template) &&
  /--layer-modal\s*:/.test(template) &&
  /--layer-toast\s*:/.test(template));
const layerValue = name => {
  const match = new RegExp('--' + name + '\\s*:\\s*(\\d+)').exec(template);
  return match ? Number(match[1]) : NaN;
};
check('层级数值保证 Header < Mobile Nav < Modal < Toast',
  layerValue('layer-app-header') < layerValue('layer-mobile-nav') &&
  layerValue('layer-mobile-nav') < layerValue('layer-modal') &&
  layerValue('layer-modal') < layerValue('layer-toast'));
check('Modal 在 Header 和 Mobile Nav 之上且 Toast 在 Modal 之上',
  /\.app-header\s*\{[^}]*z-index\s*:\s*var\(--layer-app-header\)/s.test(template) &&
  /\.mobile-app-nav\s*\{[^}]*z-index\s*:\s*var\(--layer-mobile-nav\)/s.test(template) &&
  /\.modal-backdrop\s*\{[^}]*z-index\s*:\s*var\(--layer-modal\)/s.test(template) &&
  /#toast-wrap\s*\{[^}]*z-index\s*:\s*var\(--layer-toast\)/s.test(template));
check('认证页保持在既有独立浮层之上，且 Toast 仍可见',
  layerValue('layer-auth') > 10000 && layerValue('layer-toast') > layerValue('layer-auth'));
check('641–1024px 品牌副标题可截断，不挤坏主导航',
  /\.brand\s+\.brand-tag\s*\{[^}]*text-overflow\s*:\s*ellipsis[^}]*white-space\s*:\s*nowrap/s.test(template) &&
  /@media\(min-width:641px\)\s+and\s+\(max-width:1024px\)\s*\{[^}]*\.brand\s+\.brand-tag\s*\{[^}]*max-width/s.test(template));

/* Room Launchpad: generic launch must choose a game first, while calls from a
 * game card may retain that game.  Create remains the existing payload shape. */
const roomSetup = extractBalancedBlock(roster, /function\s+openRoomSetup\s*\(\s*selectedGame\s*\)\s*\{/);
check('Room Launchpad 是可关闭的单例可访问 dialog',
  /activeRoomLaunchpad/.test(roster) &&
  /setupAccessibleOverlayDialog\s*\(/.test(roomSetup) &&
  /acquireModalScrollLock\s*\(/.test(roomSetup) &&
  /releaseModalScrollLock\s*\(/.test(roster));
check('Room Launchpad 通用入口要求明确选择游戏，游戏卡入口可预选',
  /selectedGame\s*&&\s*GAMES\[selectedGame\]/.test(roomSetup) &&
  /room_setup_game_required/.test(roomSetup) &&
  /room_setup_selected_game/.test(roomSetup));
check('容量只从所选游戏的 min/max 派生并在变更时重新约束',
  /gameId\s*&&\s*GAMES\[gameId\]/.test(roomSetup) &&
  /meta\.min/.test(roomSetup) && /meta\.max/.test(roomSetup) &&
  /Math\.max\(\s*meta\.min/.test(roomSetup) &&
  /Math\.min\(\s*meta\.max/.test(roomSetup));
check('Room Launchpad 保留 pendingGame → create → room_update → select_game 兼容流程',
  /online\.pendingGame\s*=\s*gameId/.test(roomSetup) &&
  /online\.create\s*\(\s*\{\s*capacity\s*,\s*visibility\s*,\s*allowSpectators\s*\}\s*\)/.test(roomSetup) &&
  !/online\.create\s*\(\s*\{[^}]*\bgame\s*:/.test(roomSetup));
check('Room Launchpad 含可用 Enter 提交的私密房间码表单',
  /createElement\(\s*['"]form['"]\s*\)/.test(roomSetup) &&
  /joinForm\.noValidate\s*=\s*true/.test(roomSetup) &&
  /addEventListener\(\s*['"]submit['"]/.test(roomSetup) &&
  /online\.join\(\s*(?:code|value)\s*\)/.test(roomSetup) &&
  /room_join_code_label/.test(roomSetup) &&
  /room_join_code_hint/.test(roomSetup));
check('私密房间码与服务端一致为 6 位无歧义字符集',
  /code\.maxLength\s*=\s*6/.test(roomSetup) &&
  /value\.length\s*!==\s*6/.test(roomSetup) &&
  /A-HJKMNP-Z2-9/.test(roomSetup));
check('Room Launchpad 所有主触控目标至少 44px',
  /room-launchpad-capacity-choice[^}]*min-height\s*:\s*44px/s.test(template) &&
  /room-launchpad-join[^}]*min-height\s*:\s*44px/s.test(template) &&
  /room-launchpad-actions\s+\.btn[^}]*min-height\s*:\s*44px/s.test(template) &&
  /room-launchpad-code-form\s+\.nick-input[^}]*min-height\s*:\s*44px/s.test(template));
check('Lobby 保留单一列表节点，并由独立房间工作区在窄屏可达',
  count(template, /id="lobby-panel"/g) === 1 &&
  count(template, /id="lobby-list"/g) === 1 &&
  /data-games-workspace-target="rooms"/.test(template) &&
  /id="games-rooms-panel"/.test(template) &&
  template.indexOf('data-games-workspace-target="rooms"') < template.indexOf('id="game-grid"'));

class LaunchpadNode {
  constructor(tag, className){
    this.tagName = String(tag || 'div').toUpperCase();
    this.className = className || '';
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.disabled = false;
    this.value = '';
    this.checked = false;
    this.type = '';
    this.isConnected = false;
    this.classList = {
      add: (...names) => names.forEach(name => {
        if (!this.className.split(/\s+/).includes(name)) this.className = (this.className + ' ' + name).trim();
      }),
      toggle: (name, force) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        const next = force == null ? !names.has(name) : !!force;
        if (next) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
        return next;
      },
    };
  }
  appendChild(child){ child.parentNode = this; child.setConnected(this.isConnected); this.children.push(child); return child; }
  setConnected(value){ this.isConnected = !!value; this.children.forEach(child => child.setConnected(value)); }
  set textContent(value){ this._text = String(value || ''); this.children = []; }
  get textContent(){ return this._text || ''; }
  setAttribute(name, value){ this.attributes[name] = String(value); if (name === 'data-game-id') this.dataset.gameId = String(value); }
  getAttribute(name){ return this.attributes[name]; }
  removeAttribute(name){ delete this.attributes[name]; }
  toggleAttribute(name, force){ if (force) this.attributes[name] = ''; else delete this.attributes[name]; return !!force; }
  addEventListener(type, listener){ (this.listeners[type] || (this.listeners[type] = [])).push(listener); }
  dispatch(type, event){ const payload = event || {}; if (!payload.target) payload.target = this; (this.listeners[type] || []).forEach(listener => listener(payload)); }
  click(){ this.dispatch('click'); }
  focus(){ this.focused = true; }
  remove(){ if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; this.setConnected(false); }
  matches(selector){
    if (selector === 'button') return this.tagName === 'BUTTON';
    const game = /^\[data-game-id="([^"]+)"\]$/.exec(selector);
    return !!(game && this.dataset.gameId === game[1]);
  }
  querySelector(selector){
    for (const child of this.children){
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
  querySelectorAll(selector){
    const found = [];
    const visit = node => node.children.forEach(child => { if (child.matches(selector)) found.push(child); visit(child); });
    visit(this);
    return found;
  }
  find(predicate){
    if (predicate(this)) return this;
    for (const child of this.children){ const found = child.find(predicate); if (found) return found; }
    return null;
  }
}

try {
  const launchpadSource = roster.slice(
    roster.indexOf('let activeRoomLaunchpad'),
    roster.indexOf('\nfunction renderPlayers', roster.indexOf('let activeRoomLaunchpad')),
  );
  const body = new LaunchpadNode('body');
  body.setConnected(true);
  const created = [], joined = [];
  let scrollLocks = 0, scrollReleases = 0;
  const games = {
    gomoku:{ icon:'●', nameKey:'game_gomoku', min:2, max:2 },
    ludo:{ icon:'✈', nameKey:'game_ludo', min:2, max:4 },
    monopoly:{ icon:'◎', nameKey:'game_monopoly', min:2, max:5 },
  };
  const context = {
    account:{ uid:'player-1' },
    GAMES:games,
    document:{ body, createElement:tag => new LaunchpadNode(tag) },
    el:(tag, cls, text) => { const node = new LaunchpadNode(tag, cls); node.textContent = text || ''; return node; },
    t:(key, ...args) => key + (args.length ? ':' + args.join('|') : ''),
    $:() => null, toast(){},
    releaseModalScrollLock(){ scrollReleases++; }, acquireModalScrollLock(){ scrollLocks++; }, openAuthModal(){},
    setupAccessibleOverlayDialog(overlay, card, initial, label, onClosed){
      if (initial) initial.focus();
      return () => { overlay.remove(); if (onClosed) onClosed(); };
    },
    online:{ pendingGame:null, create:payload => created.push(payload), join:code => joined.push(code) },
  };
  const vm = require('vm');
  vm.createContext(context);
  vm.runInContext(launchpadSource + '\nthis.__openRoomSetup=openRoomSetup;', context, { filename:'public/src/ui/07-roster.js' });
  context.__openRoomSetup();
  const genericModal = body.children[0];
  const createButton = genericModal && genericModal.find(node => node.className.includes('room-launchpad-create'));
  const gomoku = genericModal && genericModal.find(node => node.dataset.gameId === 'gomoku');
  check('VM：通用 Launchpad 先禁用创建，选游戏后按该游戏人数范围创建',
    !!genericModal && !!createButton && createButton.disabled === true && !!gomoku);
  if (gomoku) gomoku.click();
  const firstCapacity = genericModal && genericModal.find(node => node.className.includes('room-launchpad-capacity-choice'));
  if (createButton) createButton.click();
  check('VM：创建只传递既有 payload，并把选中游戏留给 pendingGame 兼容链',
    created.length === 1 && created[0].capacity === 2 && !Object.prototype.hasOwnProperty.call(created[0], 'game') && context.online.pendingGame === 'gomoku' && !!firstCapacity);
  context.__openRoomSetup();
  const joinModal = body.children[0];
  const form = joinModal && joinModal.find(node => node.tagName === 'FORM');
  const input = form && form.find(node => node.tagName === 'INPUT');
  if (input) input.value = 'ab-23cd';
  if (form) form.dispatch('submit', { preventDefault(){} });
  check('VM：私密房间码由表单 Enter 规范化后调用既有 join', joined.length === 1 && joined[0] === 'AB23CD');
  context.__openRoomSetup();
  const invalidModal = body.children[0];
  const invalidForm = invalidModal && invalidModal.find(node => node.tagName === 'FORM');
  const invalidInput = invalidForm && invalidForm.find(node => node.tagName === 'INPUT');
  if (invalidInput) invalidInput.value = 'il-10ab';
  if (invalidForm) invalidForm.dispatch('submit', { preventDefault(){} });
  check('VM：长度不足或含歧义字符的房间码不会发送', joined.length === 1 && invalidInput && invalidInput.attributes['aria-invalid'] === 'true');
  context.__openRoomSetup('ludo');
  const preselectedModal = body.children[0];
  const preselectedGame = preselectedModal && preselectedModal.find(node => node.dataset.gameId === 'ludo');
  const preselectedCreate = preselectedModal && preselectedModal.find(node => node.className.includes('room-launchpad-create'));
  const capacityChoices = preselectedModal ? preselectedModal.querySelectorAll('button').filter(node => node.className.includes('room-launchpad-capacity-choice')) : [];
  check('VM：从游戏卡进入会预选该游戏并立即使用它的人数范围',
    !!preselectedGame && preselectedGame.getAttribute('aria-checked') === 'true' && !!preselectedCreate && !preselectedCreate.disabled && capacityChoices.length === 3);
  context.__openRoomSetup('monopoly');
  check('VM：重复打开保持单例，并在替换时成对释放滚动锁',
    body.children.length === 1 && scrollLocks === scrollReleases + 1);
  context.online.room = 'CURRENT';
  context.online.isSpectator = false;
  context.online.pendingGame = 'ludo';
  context.online.pendingGameRoom = 'CURRENT';
  context.__openRoomSetup('gomoku');
  const blockedCreate = body.children[0] && body.children[0].find(node => node.className.includes('room-launchpad-create'));
  if (blockedCreate) blockedCreate.click();
  check('VM：已在玩家房间时不会留下待选游戏或发送第二次创建',
    created.length === 1 && context.online.pendingGame === null && context.online.pendingGameRoom === null);
} catch (error) {
  check('VM：Room Launchpad 公开交互 seam 可执行', false, error.stack || error.message);
}

/* Shared high-risk consumer.  Master integrates this portion from the change
 * request; it must not become a cosmetic-only tournament hide. */
const renderLobby = extractBalancedBlock(websocket, /function\s+renderLobby\s*\(\s*\)\s*\{/);
const renderRoomPanel = extractBalancedBlock(websocket, /function\s+renderRoomPanel\s*\(\s*\)\s*\{/);
const tournamentCreate = extractBalancedBlock(websocket, /function\s+openTournamentCreate\s*\(\s*info\s*\)\s*\{/);
const tournamentState = extractBalancedBlock(websocket, /function\s+renderTournamentState\s*\(\s*state\s*\)\s*\{/);
const resetOnlineState = extractBalancedBlock(websocket, /resetState\s*\(\s*preserveResume\s*\)\s*\{/);
const onlineCreate = extractBalancedBlock(websocket, /create\s*\(\s*settings\s*\)\s*\{/);
check('Lobby 行为只依据服务端 canJoin/canSpectate，不以本地人数越权',
  /r\.canJoin\s*===\s*true/.test(renderLobby) &&
  /r\.canSpectate\s*===\s*true/.test(renderLobby) &&
  !/r\.joinable/.test(renderLobby) && !/r\.spectatable/.test(renderLobby));
check('Lobby 显示等待/进行中、真人/AI/观战，并用真实按钮打开房主资料',
  /room_status_waiting/.test(renderLobby) && /room_status_playing/.test(renderLobby) &&
  /lobby_human_ai_meta/.test(renderLobby) && /lobby_spectate_available/.test(renderLobby) &&
  /el\(\s*['"]button['"]\s*,\s*['"]lobby-host-profile/.test(renderLobby) &&
  /appendPlayerName\(\s*roomName\s*,\s*r\.hostName\s*\)/.test(renderLobby));
check('Lobby 不显示玩家或观战者当前所在的房间',
  /r\.room\s*!==\s*online\.room/.test(renderLobby) &&
  /r\.room\s*!==\s*online\.spectatorRoom/.test(renderLobby));
check('Tournament UI 仅受服务端 hello_ack 的 online.isAdmin 受控',
  /function\s+tournamentUiAvailable\s*\(\s*\)\s*\{[^}]*online\.isAdmin/s.test(websocket) &&
  /tournamentUiAvailable\s*\(\s*\)/.test(renderRoomPanel) &&
  /if\s*\(\s*!tournamentUiAvailable\s*\(\s*\)\s*\)\s*return/.test(tournamentCreate) &&
  /if\s*\(\s*!tournamentUiAvailable\s*\(\s*\)\s*\)\s*return/.test(tournamentState));
check('普通用户收到 tournament_state 只缓存状态，不自动打开赛事弹层',
  /case\s*['"]tournament_state['"][\s\S]{0,260}tournamentUiAvailable\s*\(\s*\)[\s\S]{0,200}renderTournamentState/.test(websocket));
check('非管理员 hello_ack 后关闭遗留赛事弹层',
  /case\s*['"]hello_ack['"][\s\S]{0,500}!this\.isAdmin[\s\S]{0,240}closeTournamentStateModal/.test(websocket));
check('身份/连接重置会清空管理员态、赛事缓存与旧赛事弹层',
  /this\.isAdmin\s*=\s*false/.test(resetOnlineState) &&
  /this\.tournamentState\s*=\s*null/.test(resetOnlineState) &&
  /closeTournamentStateModal\s*\(\s*\)/.test(resetOnlineState));
check('注册、登录和访客切换身份后重新通过 hello_ack 获取服务端管理员事实',
  count(websocket, /this\.sendHello\(\s*uid\s*,\s*token\s*\)/g) >= 3 &&
  /sendHello\s*\(\s*uid\s*,\s*token\s*\)\s*\{[\s\S]{0,260}this\.isAdmin\s*=\s*false[\s\S]{0,360}type\s*:\s*['"]hello['"]/.test(websocket));
check('用户名密码登录同步当前设备身份，避免房间和赛事仍引用旧账号',
  /case\s*['"]logged_in['"][\s\S]{0,900}deviceUid\s*=\s*uid[\s\S]{0,300}this\.sendHello\(\s*uid\s*,\s*token\s*\)/.test(websocket));
check('待选游戏只在本次成功创建的同一房间更新时才消费',
  /this\.pendingGameRoom\s*=\s*msg\.room/.test(websocket) &&
  /this\.pendingGameRoom\s*===\s*(?:msg\.payload\.room|updatedRoom)/.test(websocket) &&
  /this\.pendingGameRoom\s*=\s*null/.test(resetOnlineState) &&
  (
    /if\s*\(\s*this\.room\s*\)\s*\{[\s\S]{0,220}this\.pendingGame\s*=\s*null[\s\S]{0,140}this\.pendingGameRoom\s*=\s*null/.test(onlineCreate) ||
    /if\s*\(\s*online\.room\s*&&\s*!online\.isSpectator\s*\)\s*\{[\s\S]{0,220}online\.pendingGame\s*=\s*null[\s\S]{0,140}online\.pendingGameRoom\s*=\s*null/.test(roomSetup)
  ));

/* Copy must use the revised product promise without deleting factual game
 * descriptions elsewhere in the locales. */
const brandKeys = ['app_title', 'brand_tag', 'home_hero_desc', 'auth_brand_intro'];
for (const key of brandKeys){
  const values = Object.values(locales).map(locale => locale[key]);
  check('三语存在品牌文案 ' + key,
    values.every(value => typeof value === 'string' && value.trim()), JSON.stringify(values));
  check('三语品牌文案占位符一致 ' + key,
    new Set(values.map(placeholderSignature)).size === 1, JSON.stringify(values));
}
check('品牌主副标题不再把六款/联机对战当成唯一价值表达',
  !/六款精选游戏\s*·\s*联机对战/.test(template) &&
  !Object.values(locales).some(locale => /六款精选游戏.*联机对战|Six selected games.*online/i.test(String(locale.brand_tag || '') + String(locale.home_hero_desc || ''))));

const requiredKeys = [
  'room_setup_game_label', 'room_setup_game_required', 'room_setup_capacity_label',
  'room_setup_visibility_label', 'room_setup_spectators_label', 'room_setup_selected_game',
  'room_setup_create_action', 'room_join_code_label', 'room_join_code_hint',
  'room_browser_title', 'room_browser_empty_title', 'room_browser_empty_body',
  'room_status_waiting', 'room_status_playing', 'room_host_profile_aria',
  'lobby_human_ai_meta', 'lobby_spectate_available', 'lobby_spectate_unavailable',
];
for (const key of requiredKeys){
  const values = Object.values(locales).map(locale => locale[key]);
  check('三语存在 Room/Lobby 文案 ' + key,
    values.every(value => typeof value === 'string' && value.trim()), JSON.stringify(values));
  check('三语 Room/Lobby 文案占位符一致 ' + key,
    new Set(values.map(placeholderSignature)).size === 1, JSON.stringify(values));
}

if (failures.length){
  console.error('UI_ROOM_LOBBY_CONTRACT_FAILED: ' + failures.join('、'));
  process.exit(1);
}
console.log('UI_ROOM_LOBBY_CONTRACT_ALL_PASS');
