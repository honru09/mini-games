'use strict';

// UI Repair P0.4: keep player-authored text raw without freezing nearby
// localized copy, and keep public/profile social overlays on the shared dialog
// lifecycle. This is intentionally browser-free and exercises the source with
// a minimal DOM so the contract stays fast in pretest.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const profileSource = read('public/src/shop/05-profile.js');
const onlineSource = read('public/src/online/03-websocket.js');
const utilsSource = read('public/src/core/01-utils.js');
const packageJson = JSON.parse(read('package.json'));
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from < 0 ? 0 : from) : -1;
  return from < 0 ? '' : source.slice(from, to < 0 ? source.length : to);
}

const overlayHelper = section(utilsSource, 'function setupAccessibleOverlayDialog', 'function closeVictoryOverlay');
const profilePopup = section(profileSource, 'function profilePresenceLabel', '');
const onlineDialogHelpers = section(onlineSource, 'function playerNameValue', 'function renderSocialRail');
const playerListRenderer = section(onlineSource, 'function renderAccounts', 'function inviteUser');
const inviteDialog = section(onlineSource, 'function showInviteModal', 'function openSettings');
const reportDialog = section(onlineSource, 'function openReportUserModal', 'function openSocialActions');
const socialDialog = section(onlineSource, 'function openSocialActions', 'function socialRow');
const socialRowRenderer = section(onlineSource, 'function socialRow', 'function openBlockedUsers');
const blockedDialog = section(onlineSource, 'function openBlockedUsers', 'function renderSocialRail');

check('shared accessible overlay helper is available to the P0.4 paths', overlayHelper.includes('aria-modal') && overlayHelper.includes("event.key === 'Escape'") && overlayHelper.includes('previousFocus'));
check('profile modal uses raw child nodes for identity/signature and a localized dialog label',
  /function profileNameNode[\s\S]*nameFxNode[\s\S]*t\('social_player'\)/.test(profilePopup) &&
  /elRaw\('div','profile-signature'/.test(profilePopup) &&
  /setupAccessibleOverlayDialog\(bd,card,close,t\('profile_title'\),releaseProfileResources\)/.test(profilePopup));
check('profile modal locks and releases scroll through an idempotent resource cleanup',
  /acquireModalScrollLock\(bd\)/.test(profilePopup) &&
  /releaseModalScrollLock\(bd\)/.test(profilePopup) &&
  /if \(resourcesReleased\) return false/.test(profilePopup));
check('online player identity helper uses raw names only and localized fallbacks separately',
  /function appendPlayerName[\s\S]*elRaw\('span', null, name\)[\s\S]*el\('span', null, t\(fallbackKey \|\| 'social_player'\)\)/.test(onlineDialogHelpers) &&
  !/parent\.setAttribute\('data-i18n-raw'/.test(onlineDialogHelpers));
check('online modal mount owns setup, scroll lock, and exactly-once cleanup',
  /function mountOnlineOverlayDialog[\s\S]*acquireModalScrollLock\(backdrop\)[\s\S]*setupAccessibleOverlayDialog\(backdrop, card, initialFocus, label, cleanup\)/.test(onlineDialogHelpers) &&
  /function mountOnlineOverlayDialog[\s\S]*releaseModalScrollLock\(backdrop\)/.test(onlineDialogHelpers) &&
  /if \(cleaned\) return false/.test(onlineDialogHelpers));
check('invite/report/social/blocked dialogs all mount via the shared lifecycle without direct backdrop removal',
  [section(onlineSource, 'function openInvitePicker', 'function presenceLabel'), reportDialog, socialDialog, blockedDialog, inviteDialog]
    .every(source => source.includes('mountOnlineOverlayDialog') && !/\bbd\.remove\(/.test(source)));
check('report/social/invite content keeps raw player names separate from localizable system copy',
  /appendPlayerName\(heading,profile\.name\)/.test(reportDialog) &&
  /appendPlayerName\(heading,profile\.name\)[\s\S]*presenceLabel/.test(socialDialog) &&
  /appendPlayerName\(msg,inv\.fromName\)[\s\S]*t\('invite_message','',inv\.room,gameName\)/.test(inviteDialog));
check('profile entry controls are dedicated buttons, not clickable ranking/social rows',
  /profileButton=el\('button','game-stage-name-button social-name'\)/.test(socialRowRenderer) &&
  /playerName=el\('button','game-stage-name-button nm'\)/.test(playerListRenderer) &&
  !/row\.addEventListener\('click'/.test(playerListRenderer) &&
  !/avatar\.addEventListener\('click'/.test(socialRowRenderer));
check('blocked-player identity remains a separate button next to unblock action',
  /profileButton=el\('button','game-stage-name-button social-name'\)/.test(blockedDialog) &&
  /button\.addEventListener\('click',\(\)=>\{online\.unblockUser\(item\.uid\);closeBlocked\(\);\}\)/.test(blockedDialog));
check('P0.4 identity/dialog sections do not use innerHTML for player text or add protocol messages',
  !/(?:playerName|profileButton|copy|heading|msg|pname)[^;\n]*innerHTML/.test([profilePopup, onlineDialogHelpers, reportDialog, socialDialog, socialRowRenderer, blockedDialog, playerListRenderer, inviteDialog].join('\n')) &&
  !/type:\s*'(?:profile_ui|social_ui|ui_profile)/.test(onlineSource));
check('pretest runs the P0.4 contract before existing monopoly/social lifecycle contracts',
  (() => {
    const pretest = String(packageJson.scripts && packageJson.scripts.pretest || '');
    const uiIndex = pretest.indexOf('qa/ui-profile-social-contract.js');
    const monopolyIndex = pretest.indexOf('qa/monopoly-character-presentation.js');
    const socialIndex = pretest.indexOf('qa/social-match-client-lifecycle.js');
    return uiIndex >= 0 && monopolyIndex > uiIndex && socialIndex > uiIndex;
  })());

function makeRuntime() {
  const documentListeners = new Map();
  let document;

  class TextNode {
    constructor(value) {
      this.nodeType = 3;
      this.nodeValue = String(value || '');
      this.parentNode = null;
      this.parentElement = null;
      this.isConnected = false;
    }
    get textContent() { return this.nodeValue; }
    set textContent(value) { this.nodeValue = String(value || ''); }
    setConnected(value) { this.isConnected = !!value; }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null;
      this.parentElement = null;
      this.setConnected(false);
    }
  }

  class Node {
    constructor(tag = 'div') {
      this.nodeType = 1;
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.parentElement = null;
      this.className = '';
      this.attributes = {};
      this.dataset = {};
      this.listeners = new Map();
      this.style = {};
      this.disabled = false;
      this.hidden = false;
      this.tabIndex = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(this.tagName) ? 0 : -1;
      this.isConnected = false;
      this._text = '';
      this.classList = {
        add: (...values) => {
          const current = new Set(String(this.className || '').split(/\s+/).filter(Boolean));
          values.forEach(value => current.add(value));
          this.className = [...current].join(' ');
        },
        remove: (...values) => {
          const current = new Set(String(this.className || '').split(/\s+/).filter(Boolean));
          values.forEach(value => current.delete(value));
          this.className = [...current].join(' ');
        },
        contains: value => String(this.className || '').split(/\s+/).includes(value),
        toggle: (value, force) => {
          const shouldAdd = force === undefined ? !this.classList.contains(value) : !!force;
          if (shouldAdd) this.classList.add(value); else this.classList.remove(value);
          return shouldAdd;
        },
      };
    }
    get firstChild() { return this.children[0] || null; }
    get textContent() { return this._text + this.children.map(child => child.textContent || '').join(''); }
    set textContent(value) { this._text = String(value === undefined || value === null ? '' : value); this.children = []; }
    appendChild(child) {
      if (child.parentNode) child.remove();
      child.parentNode = this;
      child.parentElement = this;
      this.children.push(child);
      child.setConnected(this.isConnected);
      return child;
    }
    setConnected(value) { this.isConnected = !!value; this.children.forEach(child => child.setConnected(this.isConnected)); }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null;
      this.parentElement = null;
      this.setConnected(false);
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'tabindex') this.tabIndex = Number(value);
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        this.dataset[key] = String(value);
      }
    }
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
    removeAttribute(name) {
      delete this.attributes[name];
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        delete this.dataset[key];
      }
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) {
      const listeners = this.listeners.get(type);
      if (listeners) listeners.delete(listener);
    }
    dispatch(type, event = {}) {
      if (!event.target) event.target = this;
      for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
    }
    focus() { document.activeElement = this; this.focusCount = (this.focusCount || 0) + 1; }
    contains(target) { for (let node = target; node; node = node.parentNode) if (node === this) return true; return false; }
    querySelector(selector) { return findAll(this, selector)[0] || null; }
    querySelectorAll(selector) { return findAll(this, selector); }
  }

  function hasClass(node, name) { return String(node.className || '').split(/\s+/).includes(name); }
  function matches(node, selector) {
    return String(selector || '').split(',').some(raw => {
      const value = raw.trim().replace(/:not\(\[disabled\]\)|:not\(\[tabindex="-1"\]\)/g, '');
      if (!value || node.nodeType !== 1) return false;
      if (value.startsWith('.')) return hasClass(node, value.slice(1));
      if (value === '[href]') return node.getAttribute('href') !== null;
      if (value === '[tabindex]') return node.getAttribute('tabindex') !== null;
      if (['button', 'input', 'select', 'textarea'].includes(value)) return node.tagName === value.toUpperCase() && !node.disabled;
      return false;
    });
  }
  function findAll(root, selector) {
    const found = [];
    const visit = node => {
      (node.children || []).forEach(child => {
        if (matches(child, selector)) found.push(child);
        visit(child);
      });
    };
    visit(root);
    return found;
  }
  function walk(root) {
    const nodes = [];
    const visit = node => { nodes.push(node); (node.children || []).forEach(visit); };
    visit(root);
    return nodes;
  }

  const body = new Node('body');
  body.setConnected(true);
  document = {
    body,
    activeElement: null,
    createElement: tag => new Node(tag),
    createTextNode: text => new TextNode(text),
    querySelector: selector => findAll(body, selector)[0] || null,
    querySelectorAll: selector => findAll(body, selector),
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      const listeners = documentListeners.get(type);
      if (listeners) listeners.delete(listener);
    },
    dispatchKey(key, shiftKey = false) {
      const event = { key, shiftKey, target: document.activeElement, preventDefault() { this.prevented = true; } };
      for (const listener of [...(documentListeners.get('keydown') || [])]) listener(event);
      return event;
    },
    listenerCount(type) { return (documentListeners.get(type) || new Set()).size; },
  };

  const modalLocks = { acquired:0, released:0 };
  const releases = { premium:0 };
  const containers = new Map();
  const calls = { profile:[], invite:[] };
  const labels = {
    social_player:'Player', social_report:'Report', social_report_note:'Choose a reason', social_more_actions:'More actions for %s',
    social_add_friend:'Add friend', social_cancel:'Cancel request', social_accept:'Accept', social_decline:'Decline', social_block:'Block', social_unblock:'Unblock',
    social_remove:'Remove', social_friend:'Friend', social_block_manage:'Manage blocks', social_empty:'No players', social_pending:'Pending',
    chat_message_action:'Message', social_invite_room:'Invite', close:'Close', cancel:'Cancel', invite_picker_title:'Invite player', invite_no_online:'No players online',
    invite_title:'Room invite', invite_message:'%s invited you to room %s (%s)', invite_accept:'Accept', invite_decline:'Decline', not_selected:'Not selected',
    room_host_profile_aria:'Open %s profile', level_bracket:'Lv.%s', profile_title:'Player profile', profile_mine:' (Me)',
    presence_online:'Online', presence_offline:'Offline', region_unset:'Region unset', gender_hidden:'Hidden', profile_summary:'Summary %s %s %s',
    online_label:'Online', offline_label:'Offline', profile_achievement_count:'Achievements %s', profile_public:'Public profile', edit_profile:'Edit profile',
    achievements_button:'Achievements', shop:'Shop', logout:'Log out', social_security_more:'More security',
  };
  const t = (key, ...args) => String(labels[key] || key).replace(/%[sd]/g, () => {
    const value = args.shift();
    return String(value === undefined ? '' : value);
  });
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className || '';
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const elRaw = (tag, className, text) => {
    const node = el(tag, className, text);
    node.setAttribute('data-i18n-raw', '');
    return node;
  };
  const sandbox = {
    console, document, el, elRaw, t,
    acquireModalScrollLock(node) { if (node.dataset.modalScrollLock !== '1') { node.dataset.modalScrollLock = '1'; modalLocks.acquired++; } },
    releaseModalScrollLock(node) { if (node.dataset.modalScrollLock === '1') { delete node.dataset.modalScrollLock; modalLocks.released++; } },
    setButtonIcon(button, icon, label, options) { button.textContent = label; if (options && options.ariaLabel) button.setAttribute('aria-label', options.ariaLabel); },
    avatarStageNode() { return el('span', 'avatar-stage', '◉'); },
    avatarCanvas() { return el('canvas', 'avatar-canvas'); },
    langFlag() { return '🇺🇸'; },
    nameFxNode(profile, name) { return elRaw('span', profile && profile.nameFx ? 'name-fx-' + profile.nameFx : '', name || ''); },
    levelFromXp() { return 1; }, xpForLevel(level) { return level * 20; },
    CURRENCY:'$', GAMES:{}, GAME_KEYS:[], ACHIEVEMENTS:[], AVATAR_CATEGORIES:[], SHOP:{frames:[]},
    titleFor() { return { icon:'★', id:'starter' }; }, socialTitleName() { return 'Starter'; },
    applyPremiumBackground() {}, releasePremiumBackground() { releases.premium++; }, currencyIcon() { return el('span', 'coin', '$'); },
    profileByUid() { return null; }, applyI18n() {},
    openProfileModal(uid) { calls.profile.push(uid); }, inviteUser(uid) { calls.invite.push(uid); }, openPlayerConversation() {},
    openProfileEditor() {}, openAchievementsModal() {}, openShop() {}, logoutAccount() {},
    socialGuestMutationBlocked() { return false; }, markGuestSocialControl(button) { return button; },
    socialRelationshipFor() { return 'none'; }, presenceLabel(value) { return value === 'online' ? t('presence_online') : t('presence_offline'); },
    account:{ uid:'me', coins:0, total:0 }, deviceUid:'me',
    online:{ connected:true, room:null, isHost:true, matchId:null, socialState:{ friends:[], incoming:[], outgoing:[], blocked:[] }, reportUser() {}, friendRequest() {}, friendRequestAction() {}, removeFriend() {}, blockUser() {}, unblockUser() {} },
    lastServerLB:null, localLeaderboard() { return { list:[] }; },
    $(id) { return containers.get(id) || null; },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(overlayHelper, context, { filename:'overlay-helper.js' });
  vm.runInContext(onlineDialogHelpers, context, { filename:'online-dialogs.js' });
  vm.runInContext(playerListRenderer, context, { filename:'online-player-list.js' });
  vm.runInContext(inviteDialog, context, { filename:'online-invite.js' });
  vm.runInContext(profilePopup, context, { filename:'profile-popup.js' });
  return { context, document, body, Node, TextNode, walk, modalLocks, releases, containers, calls, sandbox };
}

function rawNodes(runtime, root) {
  return runtime.walk(root).filter(node => node.nodeType === 1 && node.getAttribute && node.getAttribute('data-i18n-raw') !== null);
}

function latestOverlay(runtime) { return runtime.body.children[runtime.body.children.length - 1]; }

try {
  const runtime = makeRuntime();
  const launcher = new runtime.Node('button');
  runtime.body.appendChild(launcher);
  launcher.focus();
  vm.runInContext("openReportUserModal({uid:'p2',name:'Nina 原文'}, {type:'profile',id:'p2'})", runtime.context);
  const overlay = latestOverlay(runtime);
  const card = overlay.children[0];
  const raws = rawNodes(runtime, card);
  check('report dialog renders player name as a raw child beside localized report copy',
    card.getAttribute('role') === 'dialog' && card.getAttribute('aria-modal') === 'true' && raws.some(node => node.textContent === 'Nina 原文') && raws.every(node => node !== card));
  check('report dialog sets initial focus on the reason select', runtime.document.activeElement && runtime.document.activeElement.tagName === 'SELECT');
  runtime.document.dispatchKey('Escape');
  const releaseCount = runtime.modalLocks.released;
  runtime.document.dispatchKey('Escape');
  check('report Escape restores focus and releases scroll lock exactly once',
    !overlay.isConnected && runtime.document.activeElement === launcher && runtime.document.listenerCount('keydown') === 0 && runtime.modalLocks.acquired === 1 && releaseCount === 1 && runtime.modalLocks.released === releaseCount);
} catch (error) {
  check('report dialog dynamic contract executes', false, error && error.stack || String(error));
}

try {
  const runtime = makeRuntime();
  const launcher = new runtime.Node('button');
  runtime.body.appendChild(launcher);
  launcher.focus();
  vm.runInContext("showInviteModal({room:'AB12CD',fromName:'Nina 原文',game:null})", runtime.context);
  const overlay = latestOverlay(runtime);
  const card = overlay.children[0];
  const raws = rawNodes(runtime, card);
  const message = card.children.find(node => node.tagName === 'P');
  check('invite dialog keeps inviter raw while its sentence stays localizable',
    raws.some(node => node.textContent === 'Nina 原文') && message && message.getAttribute('data-i18n-raw') === null && message.children.some(node => node.getAttribute && node.getAttribute('data-i18n-raw') !== null));
  check('invite dialog focuses accept and allows backdrop dismissal', runtime.document.activeElement && runtime.document.activeElement.textContent === 'Accept');
  overlay.dispatch('click', { target:overlay });
  check('invite backdrop dismissal restores focus and unlocks scroll', !overlay.isConnected && runtime.document.activeElement === launcher && runtime.modalLocks.acquired === runtime.modalLocks.released);
} catch (error) {
  check('invite dialog dynamic contract executes', false, error && error.stack || String(error));
}

try {
  const runtime = makeRuntime();
  const row = vm.runInContext("socialRow({uid:'p3',name:'Row 原文',online:true,presence:'online'}, 'friends')", runtime.context);
  const buttons = row.querySelectorAll('button');
  const profileButton = buttons.find(button => String(button.className).includes('game-stage-name-button'));
  check('social row exposes identity through a dedicated keyboard button beside other actions',
    row.tagName === 'DIV' && !(row.listeners.get('click') || new Set()).size && profileButton && profileButton.type === 'button' && buttons.length >= 3 && rawNodes(runtime, profileButton).some(node => node.textContent === 'Row 原文'));
  profileButton.dispatch('click');
  check('social profile button still opens the intended public profile', runtime.calls.profile.length === 1 && runtime.calls.profile[0] === 'p3');
} catch (error) {
  check('social row dynamic contract executes', false, error && error.stack || String(error));
}

try {
  const runtime = makeRuntime();
  const list = new runtime.Node('div');
  runtime.body.appendChild(list);
  runtime.containers.set('player-list', list);
  runtime.sandbox.lastServerLB = { list:[{uid:'p4',name:'Rank 原文',online:true,level:3,coins:2,lang:'en-US'}] };
  vm.runInContext('renderAccounts()', runtime.context);
  const row = list.children[0];
  const profileButton = row.querySelectorAll('button').find(button => String(button.className).includes('game-stage-name-button'));
  check('player list uses a named button rather than making invite-containing row interactive',
    profileButton && profileButton.type === 'button' && !(row.listeners.get('click') || new Set()).size && rawNodes(runtime, profileButton).some(node => node.textContent === 'Rank 原文'));
  profileButton.dispatch('click');
  check('ranking profile button opens the selected player', runtime.calls.profile[0] === 'p4');
} catch (error) {
  check('player list dynamic contract executes', false, error && error.stack || String(error));
}

try {
  const runtime = makeRuntime();
  runtime.sandbox.online.socialState.blocked = [{uid:'p5',name:'Blocked 原文'}];
  const launcher = new runtime.Node('button');
  runtime.body.appendChild(launcher);
  launcher.focus();
  vm.runInContext('openBlockedUsers()', runtime.context);
  const overlay = latestOverlay(runtime);
  const card = overlay.children[0];
  const profileButton = card.querySelectorAll('button').find(button => String(button.className).includes('game-stage-name-button'));
  check('blocked dialog uses a raw name button without freezing its localized controls',
    profileButton && rawNodes(runtime, profileButton).some(node => node.textContent === 'Blocked 原文') && profileButton.getAttribute('data-i18n-raw') === null);
  runtime.document.dispatchKey('Escape');
  check('blocked dialog Escape restores original focus and listener state', !overlay.isConnected && runtime.document.activeElement === launcher && runtime.document.listenerCount('keydown') === 0);
} catch (error) {
  check('blocked dialog dynamic contract executes', false, error && error.stack || String(error));
}

try {
  const runtime = makeRuntime();
  const launcher = new runtime.Node('button');
  runtime.body.appendChild(launcher);
  launcher.focus();
  vm.runInContext("renderProfilePopup({uid:'p6',name:'Profile 原文',signature:'Signature 原文',avatar:1,level:2,xp:25,coins:0,total:0,presence:'online'}, false)", runtime.context);
  const overlay = latestOverlay(runtime);
  const card = overlay.children[0];
  const raws = rawNodes(runtime, card);
  check('public profile keeps name/signature raw while dialog metadata remains localized',
    card.getAttribute('role') === 'dialog' && raws.some(node => node.textContent === 'Profile 原文') && raws.some(node => node.textContent === '“Signature 原文”') && card.getAttribute('data-i18n-raw') === null);
  runtime.document.dispatchKey('Escape');
  const premiumReleaseCount = runtime.releases.premium;
  runtime.document.dispatchKey('Escape');
  check('profile cleanup releases premium background and scroll lock exactly once',
    !overlay.isConnected && runtime.document.activeElement === launcher && premiumReleaseCount === 1 && runtime.releases.premium === premiumReleaseCount && runtime.modalLocks.acquired === runtime.modalLocks.released);
} catch (error) {
  check('profile popup dynamic contract executes', false, error && error.stack || String(error));
}

if (failures) {
  console.error('UI_PROFILE_SOCIAL_CONTRACT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('UI_PROFILE_SOCIAL_CONTRACT_ALL_PASS');
}
