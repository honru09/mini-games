'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'public', 'src', 'core', '10-identity-presentation.js');
const ROSTER_PATH = path.join(ROOT, 'public', 'src', 'ui', '07-roster.js');
const ONLINE_PATH = path.join(ROOT, 'public', 'src', 'online', '03-websocket.js');
const SERVER_PATH = path.join(ROOT, 'server', 'index.js');
const PLAYLINE_PATH = path.join(ROOT, 'public', 'src', 'core', '07-playline.js');
const ROOM_PRESENCE_PATH = path.join(ROOT, 'server', 'boundaries', 'room-presence.js');
const moduleSource = fs.existsSync(MODULE_PATH) ? fs.readFileSync(MODULE_PATH, 'utf8') : '';
const rosterSource = fs.readFileSync(ROSTER_PATH, 'utf8');
const onlineSource = fs.readFileSync(ONLINE_PATH, 'utf8');
const serverSource = fs.readFileSync(SERVER_PATH, 'utf8');
const playlineSource = fs.readFileSync(PLAYLINE_PATH, 'utf8');
const { createRoomPresenceBoundary, createMemoryRoomPresenceAdapter } = require(ROOM_PRESENCE_PATH);
const failures = [];

function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

class Node {
  constructor(tag, className, text){
    this.tagName = String(tag || 'span').toUpperCase();
    this.className = className || '';
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.textContent = text == null ? '' : String(text);
    this.classList = {
      add: (...values) => {
        const names = new Set(String(this.className || '').split(/\s+/).filter(Boolean));
        values.filter(Boolean).forEach(value => names.add(value));
        this.className = [...names].join(' ');
      },
    };
  }
  appendChild(child){ this.children.push(child); return child; }
  setAttribute(name, value){
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  getAttribute(name){ return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  findClass(name){
    if (String(this.className || '').split(/\s+/).includes(name)) return this;
    for (const child of this.children){ const found = child.findClass && child.findClass(name); if (found) return found; }
    return null;
  }
}

check('统一身份深模块文件存在', moduleSource.length > 0, MODULE_PATH);
check('统一身份深模块公开三个小接口',
  /function\s+playerIdentityAvatarNode\s*\(/.test(moduleSource) &&
  /function\s+playerIdentityNameNode\s*\(/.test(moduleSource) &&
  /function\s+playerIdentityClusterNode\s*\(/.test(moduleSource));
check('旧 avatar/name helpers 只是统一身份兼容 Adapter',
  /function\s+avatarStageNode\s*\([^)]*\)\s*\{\s*return\s+playerIdentityAvatarNode\s*\(/s.test(rosterSource) &&
  /function\s+nameFxNode\s*\([^)]*\)\s*\{\s*return\s+playerIdentityNameNode\s*\(/s.test(rosterSource));

if (moduleSource){
  try {
    const SHOP = {
      frames:[{ id:7, cls:'frame-7' }],
      effects:[{ id:4, cls:'effect-4' }],
    };
    const el = (tag, className, text) => new Node(tag, className, text);
    const elRaw = (tag, className, text) => { const node = el(tag, className, text); node.setAttribute('data-i18n-raw', ''); return node; };
    const context = vm.createContext({
      SHOP,
      el,
      elRaw,
      avatarCanvas:(id, size, options) => {
        const node = new Node('img', 'avatar-art-v2');
        node.dataset.avatarId = String(id);
        node.dataset.size = String(size);
        node.dataset.animated = options && options.animate ? 'true' : 'false';
        return node;
      },
      t:key => ({ social_player:'Player' })[key] || key,
      langFlag:lang => ({ 'en-US':'🇺🇸' })[lang] || '🌐',
      prefersReducedMotion:() => false,
    });
    vm.runInContext(moduleSource + '\nthis.__identity={playerIdentityAvatarNode,playerIdentityNameNode,playerIdentityClusterNode};', context, { filename:MODULE_PATH });
    const avatar = context.__identity.playerIdentityAvatarNode({ uid:'u1', avatar:100, frame:7, effect:4 }, { size:40 });
    check('Avatar Interface 组合合法 Avatar、Frame 与 Effect',
      avatar.dataset.uid === 'u1' && avatar.findClass('frame-7') && avatar.findClass('effect-4') && avatar.findClass('avatar-art-v2'));
    const name = context.__identity.playerIdentityNameNode({ name:'Nina 原文', nameFx:3, lang:'en-US' }, { includeLanguage:true });
    check('Name Interface 保留 raw 原文、白名单闪名与语言旗帜',
      name.findClass('name-fx-3') && name.getAttribute('data-i18n-raw') !== null && name.textContent === 'Nina 原文' && name.children.some(child => child.textContent === '🇺🇸'));
    const unsafe = context.__identity.playerIdentityAvatarNode({ uid:'u2', avatar:100, frame:999, effect:-8 }, { size:32 });
    check('非法 Frame/Effect 安全回退且不拼接任意 class',
      !/frame-999|effect--8/.test(unsafe.className + ' ' + unsafe.children.map(child => child.className).join(' ')));
  } catch (error){
    check('统一身份深模块可在轻量 DOM seam 执行', false, error.stack || error.message);
  }
}

const roomPanelStart = onlineSource.indexOf('function renderRoomPanel');
const roomPanelEnd = onlineSource.indexOf('function finishRoomGame', roomPanelStart);
const roomPanel = onlineSource.slice(roomPanelStart, roomPanelEnd > roomPanelStart ? roomPanelEnd : undefined);
check('房间 Seat 在档案缓存缺失时保留服务端完整公开身份字段',
  /frame\s*:\s*seat\.frame/.test(roomPanel) &&
  /effect\s*:\s*seat\.effect/.test(roomPanel) &&
  /nameFx\s*:\s*seat\.nameFx/.test(roomPanel) &&
  /lang\s*:\s*seat\.lang/.test(roomPanel),
  'Seat profile 仍只覆盖 avatar/name');

const lobbyServerStart = serverSource.indexOf('function lobbyPayload');
const lobbyServerEnd = serverSource.indexOf('function broadcastLobby', lobbyServerStart);
const lobbyServer = serverSource.slice(lobbyServerStart, lobbyServerEnd > lobbyServerStart ? lobbyServerEnd : undefined);
const lobbyClientStart = onlineSource.indexOf('function renderLobby');
const lobbyClientEnd = onlineSource.indexOf('function renderAccounts', lobbyClientStart);
const lobbyClient = onlineSource.slice(lobbyClientStart, lobbyClientEnd > lobbyClientStart ? lobbyClientEnd : undefined);
const lobbyNow = 1700000000000;
const lobbyHostSession = { sessionId:'lobby-host-session', uid:'lobby-host', tokenHash:'lobby-host-token', alive:true, detached:false, lastSeen:lobbyNow };
const lobbyHostUser = { uid:'lobby-host', name:'Lobby Host', avatar:123, frame:7, effect:4, nameFx:3, lang:'en-US', presencePreference:'joinable', presenceVisibility:'everyone' };
const lobbyRoom = { id:'LOBBY1', host:lobbyHostSession, clients:new Map([[lobbyHostSession, 0]]), capacity:2, game:null, visibility:'public', allowSpectators:true, started:false, spectators:new Map(), maxSpectators:12 };
const lobbyBoundary = createRoomPresenceBoundary({
  adapter:createMemoryRoomPresenceAdapter({ rooms:new Map([[lobbyRoom.id, lobbyRoom]]), sessions:new Set([lobbyHostSession]), users:{ [lobbyHostUser.uid]:lobbyHostUser } }),
  now:()=>lobbyNow,
});
const lobbyProjectionResult = lobbyBoundary.room({ action:'lobby' });
const lobbyProjection = lobbyProjectionResult.ok && lobbyProjectionResult.rooms[0];
check('房间浏览摘要端到端保留房主 Avatar/Frame/Effect/NameFx',
  /roomPresenceBoundary\.room\(\{\s*action:'lobby'/.test(lobbyServer) &&
  lobbyProjection && lobbyProjection.hostAvatar === 123 && lobbyProjection.hostFrame === 7 &&
  lobbyProjection.hostEffect === 4 && lobbyProjection.hostNameFx === 3 && lobbyProjection.hostLang === 'en-US' &&
  /frame\s*:\s*r\.hostFrame/.test(lobbyClient) &&
  /effect\s*:\s*r\.hostEffect/.test(lobbyClient) &&
  /nameFx\s*:\s*r\.hostNameFx/.test(lobbyClient),
  'Lobby 边界或客户端丢失房主公开身份字段');
check('房间 Seat 与 Lobby 标题使用统一 NameFx 表现',
  /playerIdentityNameNode\s*\(\s*profile\s*\)/.test(roomPanel) &&
  /playerIdentityNameNode\s*\(\s*hostProf\s*,/.test(lobbyClient),
  'Seat/Lobby 标题仍绕过统一 Name Interface');

const inviteStart = onlineSource.indexOf('function openInvitePicker');
const inviteEnd = onlineSource.indexOf('function openReportUserModal', inviteStart);
const inviteSource = onlineSource.slice(inviteStart, inviteEnd > inviteStart ? inviteEnd : undefined);
check('邀请列表使用统一 Avatar 与 NameFx 身份表现',
  /playerIdentityAvatarNode\s*\(\s*u\s*,/.test(inviteSource) &&
  /playerIdentityNameNode\s*\(\s*u\s*,/.test(inviteSource),
  '邀请列表仍拆开手工渲染头像和无闪名玩家名');

const directListStart = playlineSource.indexOf('function renderDirectList');
const directListEnd = playlineSource.indexOf('function renderDirectThread', directListStart);
const directListSource = playlineSource.slice(directListStart, directListEnd > directListStart ? directListEnd : undefined);
const directThreadStart = directListEnd;
const directThreadEnd = playlineSource.indexOf('function renderDirectState', directThreadStart);
const directThreadSource = playlineSource.slice(directThreadStart, directThreadEnd > directThreadStart ? directThreadEnd : undefined);
check('全局私信列表使用统一 Avatar 与 NameFx 身份表现',
  /playerIdentityAvatarNode\(peer\s*,/.test(directListSource) &&
  /playerIdentityNameNode\(peer\s*,/.test(directListSource),
  'DM 列表仍只有纯文本昵称');
check('全局私信线程头使用统一 Avatar 与 NameFx 身份表现',
  /playerIdentityAvatarNode\(summary\.peer\s*,/.test(directThreadSource) &&
  /playerIdentityNameNode\(summary\.peer\s*,/.test(directThreadSource) &&
  /mounts\.title\.removeAttribute\s*&&\s*mounts\.title\.removeAttribute\(['"]data-i18n['"]\)/.test(directThreadSource) &&
  /mounts\.title\.setAttribute\s*&&\s*mounts\.title\.setAttribute\(['"]data-i18n-raw['"]/.test(directThreadSource),
  'DM 线程头未统一昵称闪名');
check('DM 身份增强不创建新 wire 或读取私有经济字段',
  !/type\s*:\s*['"](?:dm_|direct_message_)/.test(directListSource + directThreadSource) &&
  !/\.(?:owned|coins|token|password|pin)\b/.test(directListSource + directThreadSource));

const playlineCardStart = playlineSource.indexOf('function renderPlaylineCard');
const playlineCardEnd = playlineSource.indexOf('function postMapFor', playlineCardStart);
const playlineCardSource = playlineSource.slice(playlineCardStart, playlineCardEnd > playlineCardStart ? playlineCardEnd : undefined);
check('Playline 作者卡使用统一 Avatar 与 NameFx 身份表现',
  /playerIdentityAvatarNode\s*\(\s*author\s*,/.test(playlineCardSource) &&
  /playerIdentityNameNode\s*\(/.test(playlineCardSource) && /author/.test(playlineCardSource),
  'Playline 作者仍是无头像纯文本');

const socialStart = onlineSource.indexOf('function socialRow');
const socialEnd = onlineSource.indexOf('function openBlockedUsers', socialStart);
const socialSource = onlineSource.slice(socialStart, socialEnd > socialStart ? socialEnd : undefined);
const accountsStart = onlineSource.indexOf('function renderAccounts');
const accountsEnd = onlineSource.indexOf('function initOnlineUI', accountsStart);
const accountsSource = onlineSource.slice(accountsStart, accountsEnd > accountsStart ? accountsEnd : undefined);
check('Social 与玩家列表名字使用统一 NameFx 表现',
  /playerIdentityNameNode\s*\(\s*profile\s*\)/.test(socialSource) &&
  /playerIdentityNameNode\s*\(\s*u\s*\)/.test(accountsSource),
  'Social/玩家列表仍绕过 NameFx');

if (failures.length){
  console.error('IDENTITY_PRESENTATION_CONTRACT_FAILED=' + failures.join('、'));
  process.exit(1);
}
console.log('IDENTITY_PRESENTATION_CONTRACT_ALL_PASS');
