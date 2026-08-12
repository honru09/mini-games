/* ================= Playline + Direct Message presenters =================
 *
 * This file is deliberately a presenter-only seam.  The Playline presenter
 * owns the rendered post page and request lifecycle; the Direct Message
 * presenter owns only dialog selection/lifecycle and reads the existing
 * direct-chat state from `online`.  Neither presenter is a second authority
 * for social, account, or message data.
 */
(function installPlaylinePresenters(global) {
  'use strict';

  var documentRef = global && global.document;
  var STYLE_ID = 'playline-presenter-style';
  var PLAYLINE_CAPABILITY = 'playline-v1';
  var PLAYLINE_LIMIT = 20;
  var PLAYLINE_MAX_LIMIT = 30;
  var PLAYLINE_TABS = Object.freeze(['all', 'friends']);

  var PLAYLINE_MOUNT_DEFAULTS = Object.freeze({
    root: 'playline-root',
    feed: 'playline-feed',
    composer: 'playline-composer',
    input: 'playline-composer-input',
    publish: 'playline-composer-publish',
    allTab: 'playline-tab-all',
    friendsTab: 'playline-tab-friends',
    status: 'playline-status',
    error: 'playline-error',
    empty: 'playline-empty',
    loadOlder: 'playline-load-older',
    prefill: 'playline-prefill',
    refresh: 'btn-playline-refresh',
    audience: 'playline-audience',
    refresh: 'btn-playline-refresh',
    audience: 'playline-audience',
  });

  var DIRECT_MOUNT_DEFAULTS = Object.freeze({
    root: 'direct-message-overlay-root',
    dialog: 'direct-message-dialog',
    list: 'direct-message-list',
    thread: 'direct-message-thread',
    messages: 'direct-message-messages',
    input: 'direct-message-input',
    send: 'direct-message-send',
    close: 'direct-message-close',
    back: 'direct-message-back',
    title: 'direct-message-title',
    presence: 'direct-message-presence',
    avatar: 'direct-message-avatar',
    status: 'direct-message-status',
    listStatus: 'direct-message-list-status',
    note: 'direct-message-composer-note',
    loadOlder: 'direct-message-load-older',
  });

  /* CSS is injected by init/open because the eventual template mount is
   * intentionally owned by the integrating caller.  The hooks also make the
   * presenter safe on a template that has not yet shipped the final markup. */
  var PRESENTER_CSS = [
    '.playline-presenter,.direct-message-overlay{box-sizing:border-box;}',
    '.playline-presenter *, .direct-message-overlay *{box-sizing:border-box;}',
    '.playline-presenter{width:100%;min-height:240px;}',
    '.playline-general-posting[data-playline-text-first]{--playline-accent:var(--focus-ring,#5b8cff);}',
    '.playline-general-composer-hint{margin:0;color:var(--text-secondary,#62708a);font-size:12px;line-height:1.5;}',
    '.playline-general-posting [data-playline-primary-input]{min-height:112px;border-color:color-mix(in srgb,var(--playline-accent) 28%,var(--ghost-line,transparent));background:color-mix(in srgb,var(--playline-accent) 4%,transparent);}',
    '.playline-general-posting [data-playline-primary-publish]{font-weight:850;}',
    '.playline-general-posting [data-playline-attachment-control]{border-style:dashed;color:var(--text-secondary,#62708a);}',
    '.playline-general-posting [data-playline-compose-mode="attachment"] [data-playline-primary-input]{background:transparent;border-color:var(--ghost-line,rgba(127,127,127,.25));}',
    '.playline-general-posting [data-playline-compose-mode="attachment"] .playline-general-composer-hint{color:var(--text-secondary,#62708a);}',
    '.playline-general-posting .playline-prefill{padding:8px 10px;border:1px dashed color-mix(in srgb,var(--playline-accent) 38%,transparent);border-radius:12px;background:color-mix(in srgb,var(--playline-accent) 6%,transparent);font-size:12px;}',
    '.playline-general-posting .playline-tabs[data-playline-general-filter]{padding:4px;border:1px solid var(--ghost-line,rgba(127,127,127,.2));border-radius:14px;background:rgba(127,127,127,.04);}',
    '.playline-general-posting .playline-tab[aria-selected="true"]{box-shadow:0 2px 8px color-mix(in srgb,currentColor 14%,transparent);}',
    '.playline-feed{display:grid;gap:12px;align-content:start;}',
    '.playline-card{display:grid;gap:10px;min-width:0;}',
    '.playline-card--text{border-color:color-mix(in srgb,var(--playline-accent,#5b8cff) 26%,var(--ghost-line,rgba(127,127,127,.2)));background:linear-gradient(145deg,color-mix(in srgb,var(--playline-accent,#5b8cff) 6%,transparent),rgba(127,127,127,.055));}',
    '.playline-card--text .playline-card-body{font-size:15px;font-weight:620;line-height:1.62;}',
    '.playline-card--attachment{gap:8px;background:rgba(127,127,127,.035);}',
    '.playline-card--attachment .playline-card-body{padding:10px 12px;border-inline-start:3px solid color-mix(in srgb,var(--playline-accent,#5b8cff) 42%,transparent);border-radius:0 10px 10px 0;background:rgba(127,127,127,.05);font-size:13px;}',
    '.playline-card-header{display:flex;align-items:center;gap:10px;min-width:0;}',
    '.playline-card-header>.mini-avatar-stage{flex:0 0 auto;}',
    '.playline-card-author{min-width:0;overflow-wrap:anywhere;}',
    '.playline-card-body{white-space:pre-wrap;overflow-wrap:anywhere;}',
    '.playline-card-actions{display:flex;flex-wrap:wrap;gap:8px;}',
    '.playline-card-actions button,.playline-tab,.playline-composer button,.playline-load-older{min-height:44px;}',
    '.playline-composer{display:grid;gap:8px;padding-bottom:max(12px,env(safe-area-inset-bottom,0px));}',
    '.playline-composer textarea{min-height:44px;resize:vertical;}',
    '.playline-prefill{display:flex;align-items:center;gap:8px;min-height:44px;}',
    '.playline-tabs{display:flex;gap:8px;overflow:auto;}',
    '.playline-empty:not(.hidden){display:grid;gap:8px;align-items:start;padding:18px;border:1px dashed var(--ghost-line,rgba(127,127,127,.24));border-radius:16px;background:rgba(127,127,127,.035);}.playline-empty h3,.playline-empty p{margin:0;}.playline-empty p{color:var(--text-secondary,#62708a);line-height:1.5;}.playline-empty button{justify-self:start;min-height:44px;}',
    '.playline-side-card[data-playline-optional-context]{border-style:dashed;background:linear-gradient(145deg,rgba(127,127,127,.025),rgba(127,127,127,.06));}',
    '.direct-message-overlay{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));background:rgba(8,12,24,.56);overscroll-behavior:contain;}',
    '.direct-message-overlay.hidden{display:none;}',
    '.direct-message-overlay.direct-message-closing{pointer-events:none;}',
    '.direct-message-dialog{display:flex;flex-direction:column;width:min(920px,calc(100vw - 32px));max-height:min(760px,calc(100dvh - 32px));min-height:420px;overflow:hidden;background:var(--surface-1,#fff);color:var(--text-1,#172033);border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:24px;box-shadow:0 28px 88px rgba(0,0,0,.34);}',
    '.direct-message-layout{display:grid;grid-template-columns:minmax(210px,32%) minmax(0,1fr);min-height:0;flex:1;}',
    '.direct-message-list,.direct-message-thread{min-height:0;overflow:auto;}',
    '.direct-message-list{border-inline-end:1px solid color-mix(in srgb,currentColor 14%,transparent);background:color-mix(in srgb,currentColor 3%,transparent);overscroll-behavior:contain;}',
    '.direct-message-thread{display:flex;flex-direction:column;}',
    '.direct-message-list-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:52px;padding:10px 12px;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent);background:var(--ghost-glass-strong,var(--surface-1,#fff));}.direct-message-list-heading{margin:0;font-size:15px;line-height:1.2;}.direct-message-unread-total,.direct-message-unread{display:inline-grid;place-items:center;min-width:24px;min-height:24px;padding:0 7px;border-radius:999px;background:var(--text-primary,currentColor);color:var(--bg-card-solid,#fff);font-size:11px;font-weight:900;}',
    '.direct-message-conversation-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;width:100%;min-height:56px;align-items:center;gap:10px;padding:8px 12px;text-align:start;border:0;background:transparent;cursor:pointer;}',
    '.direct-message-conversation-row:focus-visible,.direct-message-dialog button:focus-visible,.direct-message-dialog textarea:focus-visible{outline:3px solid var(--focus-ring,#5b8cff);outline-offset:2px;}',
    '.direct-message-messages{flex:1;min-height:120px;overflow:auto;padding:12px;overscroll-behavior:contain;scrollbar-gutter:stable;}',
    '.direct-message-composer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px 12px;padding-bottom:max(12px,env(safe-area-inset-bottom,0px));border-top:1px solid color-mix(in srgb,currentColor 16%,transparent);}',
    '.direct-message-composer textarea,.direct-message-composer button,.direct-message-header button{min-height:44px;}',
    '.direct-message-header{display:flex;align-items:center;gap:10px;min-height:72px;padding:12px 14px;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent);background:linear-gradient(135deg,color-mix(in srgb,currentColor 5%,transparent),transparent);}',
    '.direct-message-close,.direct-message-back{display:inline-grid;place-items:center;flex:0 0 44px;width:44px;height:44px;padding:0;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:14px;background:color-mix(in srgb,currentColor 5%,transparent);color:inherit;font-size:24px;line-height:1;cursor:pointer;}',
    '.direct-message-close{order:3;}.direct-message-back{order:0;}.direct-message-header-avatar{order:1;display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px}.direct-message-header-copy{order:2;}',
    '.direct-message-header-copy{min-width:0;flex:1;}',
    '.direct-message-title,.direct-message-peer-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.direct-message-conversation-copy{display:grid;min-width:0;gap:3px;}.direct-message-conversation-copy .direct-message-preview{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:color-mix(in srgb,currentColor 62%,transparent);font-size:12px}.direct-message-conversation-meta{display:grid;justify-items:end;align-content:center;gap:5px;min-width:34px}.direct-message-conversation-time{color:color-mix(in srgb,currentColor 58%,transparent);font-size:10px;white-space:nowrap}',
    '.direct-message-bubble-body{white-space:pre-wrap;overflow-wrap:anywhere}.direct-message-bubble-meta{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin-top:5px;font-size:10px;line-height:1.2;opacity:.72}.direct-message-bubble:not(.mine) .direct-message-bubble-meta{justify-content:flex-start}.direct-message-retry{min-height:28px;padding:2px 8px;border-radius:9px;font:inherit}',
    '.direct-message-empty,.direct-message-loading,.direct-message-error{display:grid;place-items:center;min-height:112px;padding:20px;color:color-mix(in srgb,currentColor 68%,transparent);text-align:center;line-height:1.55;}',
    '.direct-message-list-status,.direct-message-status{min-height:22px;padding:10px 14px;color:color-mix(in srgb,currentColor 64%,transparent);font-size:12px;}',
    '@media (max-width: 640px){.direct-message-overlay{padding:0;place-items:stretch;}.direct-message-dialog{width:100%;max-width:none;max-height:none;height:100dvh;min-height:100dvh;border-radius:0;padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);padding-left:env(safe-area-inset-left,0px);}.direct-message-layout{display:block;}.direct-message-list,.direct-message-thread{height:calc(100dvh - 72px - env(safe-area-inset-top,0px));}.direct-message-thread{display:none;}.direct-message-dialog.thread-open .direct-message-list{display:none;}.direct-message-dialog.thread-open .direct-message-thread{display:flex;}.direct-message-composer{grid-template-columns:minmax(0,1fr) auto;}.direct-message-back{display:inline-flex!important;}.direct-message-back.hidden{display:none!important;}.playline-presenter{padding-inline:12px;}.playline-general-posting [data-playline-primary-input]{min-height:104px;}.playline-empty button{width:100%;}}',
    '@media (min-width: 641px){.direct-message-back{display:none!important;}}',
    '@media (prefers-reduced-motion: reduce){.playline-presenter *, .direct-message-overlay *{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;}}',
  ].join('');

  var playlineState = {
    mounts: Object.assign({}, PLAYLINE_MOUNT_DEFAULTS),
    configured: false,
    initialized: false,
    active: false,
    tab: 'all',
    page: { all: null, friends: null },
    nodes: { all: new Map(), friends: new Map() },
    request: null,
    requestSerial: 0,
    loading: false,
    loadingOlder: false,
    preserveScroll: null,
    errorKey: null,
    hint: false,
    prefill: null,
    draftText: '',
    pending: new Map(),
    accountKey: null,
    accountEpoch: 0,
    listenersInstalled: false,
    bound: false,
  };

  var directState = {
    mounts: Object.assign({}, DIRECT_MOUNT_DEFAULTS),
    configured: false,
    initialized: false,
    open: false,
    peerUid: null,
    opener: null,
    lockOwner: null,
    lockHeld: false,
    keydown: null,
    backdropClick: null,
    accountKey: null,
    accountEpoch: 0,
    errorKey: null,
    preserveScroll: null,
    bound: false,
    listenersInstalled: false,
    stageBusy: false,
  };

  function doc() {
    return documentRef || (typeof document !== 'undefined' ? document : null);
  }

  function getOnline() {
    try { if (typeof online !== 'undefined' && online) return online; } catch (_) {}
    return global && global.online ? global.online : null;
  }

  function getAccount() {
    try { if (typeof account !== 'undefined') return account; } catch (_) {}
    return global && global.account ? global.account : null;
  }

  function translate(key) {
    var args = Array.prototype.slice.call(arguments, 1);
    try {
      if (typeof t === 'function') return t.apply(null, [key].concat(args));
    } catch (_) {}
    try {
      if (global && typeof global.t === 'function') return global.t.apply(global, [key].concat(args));
    } catch (_) {}
    return key;
  }

  function setSystemText(node, key) {
    if (!node) return node;
    node.removeAttribute && node.removeAttribute('data-i18n-raw');
    node.setAttribute && node.setAttribute('data-i18n', key);
    node.textContent = translate(key);
    return node;
  }

  function setSystemAttribute(node, attribute, key) {
    if (!node || !attribute) return node;
    node.setAttribute && node.setAttribute('data-i18n-' + attribute, key);
    node.setAttribute && node.setAttribute(attribute, translate(key));
    return node;
  }

  function setIconButton(node, glyph, key) {
    if (!node) return node;
    node.removeAttribute && node.removeAttribute('data-i18n');
    node.textContent = glyph;
    node.setAttribute && node.setAttribute('aria-label', translate(key));
    node.setAttribute && node.setAttribute('title', translate(key));
    node.setAttribute && node.setAttribute('data-i18n-aria-label', key);
    node.setAttribute && node.setAttribute('data-i18n-title', key);
    return node;
  }

  function directErrorKey(reason) {
    var normalized = String(reason || 'server_unavailable');
    var specific = 'chat_error_' + normalized;
    var generic = 'chat_error_generic';
    // direct-chat-v1 owns the existing chat_* locale namespace.  Keep the
    // overlay-specific state separate while never exposing an untranslated
    // reason key to the player.
    if (translate(specific) !== specific) return specific;
    return generic;
  }

  function setRawText(node, value) {
    if (!node) return node;
    node.textContent = String(value === undefined || value === null ? '' : value);
    node.setAttribute && node.setAttribute('data-i18n-raw', '');
    node.removeAttribute && node.removeAttribute('data-i18n');
    return node;
  }

  function makeElement(tag, className, text) {
    var d = doc();
    if (!d || typeof d.createElement !== 'function') return null;
    var node = d.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function removeChildren(node) {
    if (!node) return;
    while (node.firstChild) {
      if (typeof node.firstChild.remove === 'function') node.firstChild.remove();
      else if (typeof node.removeChild === 'function') node.removeChild(node.firstChild);
      else break;
    }
  }

  function append(parent, child) {
    if (parent && child && typeof parent.appendChild === 'function') parent.appendChild(child);
    return child;
  }

  function prepend(parent, child) {
    if (!parent || !child) return child;
    if (typeof parent.insertBefore === 'function') parent.insertBefore(child, parent.firstChild || null);
    else append(parent, child);
    return child;
  }

  function classAdd(node, value) {
    if (node && node.classList && node.classList.add) node.classList.add(value);
    else if (node) node.className = (String(node.className || '') + ' ' + value).trim();
  }

  function classRemove(node, value) {
    if (node && node.classList && node.classList.remove) node.classList.remove(value);
    else if (node) node.className = String(node.className || '').split(/\s+/).filter(function (item) { return item && item !== value; }).join(' ');
  }

  function classToggle(node, value, force) {
    if (!node) return false;
    if (node.classList && node.classList.toggle) return node.classList.toggle(value, force);
    var has = String(node.className || '').split(/\s+/).indexOf(value) >= 0;
    var next = force === undefined ? !has : !!force;
    if (next && !has) classAdd(node, value);
    if (!next && has) classRemove(node, value);
    return next;
  }

  function getById(id) {
    var d = doc();
    if (!d || typeof d.getElementById !== 'function' || !id) return null;
    try { return d.getElementById(String(id)); } catch (_) { return null; }
  }

  function resolveRef(ref, root) {
    if (!ref) return null;
    if (typeof ref === 'object' && (ref.nodeType || typeof ref.appendChild === 'function')) return ref;
    var found = getById(ref);
    if (found) return found;
    if (root && typeof root.querySelector === 'function') {
      try { return root.querySelector('#' + String(ref).replace(/[^A-Za-z0-9_-]/g, '')); } catch (_) {}
    }
    return null;
  }

  function mergeMounts(defaults, options) {
    var source = options && (options.mountIds || options.mount || options.mounts) || options || {};
    var result = Object.assign({}, defaults);
    var aliases = {
      root: ['root', 'rootId', 'overlay', 'overlayId', 'mountId'],
      feed: ['feed', 'feedId', 'list', 'listId', 'posts', 'postsId'],
      composer: ['composer', 'composerId'],
      input: ['input', 'inputId', 'textarea', 'textareaId'],
      publish: ['publish', 'publishId', 'send', 'sendId', 'submit', 'submitId'],
      allTab: ['allTab', 'allTabId', 'tabAll', 'tabAllId'],
      friendsTab: ['friendsTab', 'friendsTabId', 'tabFriends', 'tabFriendsId'],
      status: ['status', 'statusId'],
      error: ['error', 'errorId'],
      empty: ['empty', 'emptyId'],
      loadOlder: ['loadOlder', 'loadOlderId', 'older', 'olderId'],
      prefill: ['prefill', 'prefillId'],
      refresh: ['refresh', 'refreshId'],
      audience: ['audience', 'audienceId'],
      dialog: ['dialog', 'dialogId', 'card', 'cardId'],
      list: ['list', 'listId', 'conversationList', 'conversationListId'],
      thread: ['thread', 'threadId'],
      messages: ['messages', 'messagesId', 'messageList', 'messageListId'],
      send: ['send', 'sendId', 'publish', 'publishId'],
      close: ['close', 'closeId'],
      back: ['back', 'backId'],
      title: ['title', 'titleId'],
      presence: ['presence', 'presenceId'],
      avatar: ['avatar', 'avatarId'],
      listStatus: ['listStatus', 'listStatusId'],
      note: ['note', 'noteId'],
    };
    Object.keys(result).forEach(function (key) {
      var names = aliases[key] || [key, key + 'Id'];
      for (var i = 0; i < names.length; i += 1) {
        if (source && source[names[i]] !== undefined) { result[key] = source[names[i]]; break; }
      }
    });
    return result;
  }

  function installStyle() {
    var d = doc();
    if (!d || typeof d.createElement !== 'function') return false;
    if (typeof d.getElementById === 'function' && d.getElementById(STYLE_ID)) return true;
    var style = makeElement('style');
    if (!style) return false;
    style.id = STYLE_ID;
    style.setAttribute && style.setAttribute('data-playline-style', '');
    style.textContent = PRESENTER_CSS;
    var parent = d.head || d.body;
    if (!parent || typeof parent.appendChild !== 'function') return false;
    parent.appendChild(style);
    return true;
  }

  function accountIdentity() {
    var a = getAccount() || {};
    var uid = a && a.uid ? String(a.uid) : '';
    var token = a && a.authToken ? String(a.authToken) : '';
    return uid + '|' + token;
  }

  function accountUid() {
    var a = getAccount();
    return a && a.uid ? String(a.uid) : '';
  }

  function clearPlaylinePages() {
    playlineState.page = { all: null, friends: null };
    playlineState.nodes = { all: new Map(), friends: new Map() };
    playlineState.request = null;
    playlineState.loading = false;
    playlineState.loadingOlder = false;
    playlineState.preserveScroll = null;
    playlineState.errorKey = null;
    playlineState.hint = false;
    playlineState.pending = new Map();
  }

  function onAccountChanged(previousKey, nextKey) {
    if (previousKey === null || previousKey === nextKey) return;
    playlineState.accountEpoch += 1;
    clearPlaylinePages();
    playlineState.draftText = '';
    playlineState.prefill = null;
    directState.accountEpoch += 1;
    directState.peerUid = null;
    directState.errorKey = null;
    if (directState.open) closeDirectInternal('account', false);
    var onlineRef = getOnline();
    var uid = accountUid();
    var previousUid = String(previousKey || '').split('|')[0];
    try {
      if (onlineRef && typeof onlineRef.resetAccountCaches === 'function' && previousUid && previousUid !== uid) {
        onlineRef.resetAccountCaches();
      }
    } catch (_) {}
  }

  function syncAccount() {
    var next = accountIdentity();
    var previous = playlineState.accountKey;
    if (previous === null) {
      playlineState.accountKey = next;
      directState.accountKey = next;
    } else if (previous !== next) {
      playlineState.accountKey = next;
      directState.accountKey = next;
      onAccountChanged(previous, next);
    } else if (directState.accountKey !== next) {
      directState.accountKey = next;
      directState.accountEpoch += 1;
      directState.peerUid = null;
      if (directState.open) closeDirectInternal('account', false);
    }
    return playlineState.accountEpoch;
  }

  function currentStage() {
    var d = doc();
    if (!d) return null;
    var stage = getById('screen-game');
    var active = false;
    try {
      active = !!(stage && stage.dataset && (stage.dataset.shellActive === 'true' || stage.dataset.shellActive === '1'));
      active = active || !!(stage && stage.getAttribute && stage.getAttribute('aria-hidden') === 'false');
      active = active || (d.documentElement && d.documentElement.classList && d.documentElement.classList.contains('game-active'));
      active = active || (d.body && d.body.classList && d.body.classList.contains('game-active'));
    } catch (_) {}
    return active ? (stage || d.body || d.documentElement || true) : null;
  }

  function gameStageBusy() {
    return !!currentStage();
  }

  function normalizeTab(value) {
    var tab = String(value || '').toLowerCase();
    return PLAYLINE_TABS.indexOf(tab) >= 0 ? tab : null;
  }

  function clampLimit(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) n = PLAYLINE_LIMIT;
    return Math.max(1, Math.min(PLAYLINE_MAX_LIMIT, Math.floor(n)));
  }

  function safeId(value, fallbackPrefix) {
    var id = String(value || '').trim();
    if (id && /^[A-Za-z0-9][A-Za-z0-9_.:-]{5,159}$/.test(id)) return id;
    if (id) return null;
    if (!fallbackPrefix) return null;
    return fallbackPrefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function normalizeContent(input) {
    var value = input && input.content && typeof input.content === 'object' ? input.content : input || {};
    var kind = String(value.kind || '').toLowerCase();
    if (kind === 'game') kind = 'game_share';
    if (kind === 'result') kind = 'result_share';
    if (kind === 'record' || kind === 'replay') kind = 'record_share';
    if (kind === 'text') return { kind: 'text', text: String(value.text === undefined || value.text === null ? '' : value.text) };
    if (kind === 'game_share') return { kind: 'game_share', gameId: String(value.gameId || '') };
    if (kind === 'result_share') return { kind: 'result_share', resultId: String(value.resultId || value.receiptId || '') };
    if (kind === 'record_share') {
      if (value.recordId !== undefined || value.record !== undefined) return { kind: 'record_share', recordId: String(value.recordId !== undefined ? value.recordId : value.record) };
      return { kind: 'record_share', replayId: String(value.replayId || '') };
    }
    return null;
  }

  function normalizePublishIntent(input) {
    if (!input || typeof input !== 'object') return null;
    var content = normalizeContent(input);
    if (!content) return null;
    var requestedAudience = input.audience !== undefined ? input.audience : (input.filter !== undefined ? input.filter : playlineState.tab);
    var audience = normalizeTab(requestedAudience);
    if (!audience) return null;
    var clientPostId = safeId(input.clientPostId, 'post');
    if (!clientPostId) return null;
    return { clientPostId: clientPostId, audience: audience, content: content };
  }

  function resolvePlaylineMounts(options) {
    playlineState.mounts = mergeMounts(PLAYLINE_MOUNT_DEFAULTS, options || playlineState.mounts);
    return playlineState.mounts;
  }

  function playlineRoot() {
    return resolveRef(playlineState.mounts.root);
  }

  function findWithin(root, ref, selector) {
    var direct = resolveRef(ref, root);
    if (direct) return direct;
    if (root && selector && typeof root.querySelector === 'function') {
      try { return root.querySelector(selector); } catch (_) {}
    }
    return null;
  }

  function ensurePlaylineStructure() {
    var root = playlineRoot();
    if (!root) return null;
    classAdd(root, 'playline-presenter');
    var feed = findWithin(root, playlineState.mounts.feed, '[data-playline-feed]');
    if (!feed) {
      feed = makeElement('section', 'playline-feed');
      if (!feed) return null;
      feed.setAttribute('data-playline-feed', '');
      append(root, feed);
    }
    var composer = findWithin(root, playlineState.mounts.composer, '[data-playline-composer]');
    if (!composer) {
      composer = makeElement('form', 'playline-composer');
      if (!composer) return null;
      composer.setAttribute('data-playline-composer', '');
      append(root, composer);
    }
    var input = findWithin(composer, playlineState.mounts.input, 'textarea,[data-playline-input]');
    if (!input) {
      input = makeElement('textarea', 'playline-composer-input');
      if (!input) return null;
      input.setAttribute('data-playline-input', '');
      append(composer, input);
    }
    input.setAttribute && input.setAttribute('enterkeyhint', 'send');
    input.setAttribute && input.setAttribute('maxlength', '280');
    var publish = findWithin(composer, playlineState.mounts.publish, 'button,[data-playline-publish]');
    if (!publish) {
      publish = makeElement('button', 'playline-composer-publish');
      if (!publish) return null;
      publish.type = 'submit';
      publish.setAttribute('data-playline-publish', '');
      setSystemText(publish, 'playline_publish');
      append(composer, publish);
    }
    var tabs = findWithin(root, null, '[data-playline-tabs]');
    if (!tabs) {
      tabs = makeElement('div', 'playline-tabs');
      tabs.setAttribute('data-playline-tabs', '');
      var all = findWithin(root, playlineState.mounts.allTab, '[data-playline-tab="all"]');
      var friends = findWithin(root, playlineState.mounts.friendsTab, '[data-playline-tab="friends"]');
      if (!all) { all = makeElement('button', 'playline-tab'); all.type = 'button'; all.setAttribute('data-playline-tab', 'all'); }
      if (!friends) { friends = makeElement('button', 'playline-tab'); friends.type = 'button'; friends.setAttribute('data-playline-tab', 'friends'); }
      setSystemText(all, 'playline_all'); setSystemText(friends, 'playline_friends');
      append(tabs, all); append(tabs, friends); append(root, tabs);
    }
    var status = findWithin(root, playlineState.mounts.status, '[data-playline-status]');
    if (!status) { status = makeElement('div', 'playline-status'); status.setAttribute('data-playline-status', ''); append(root, status); }
    var error = findWithin(root, playlineState.mounts.error, '[data-playline-error]');
    if (!error) { error = makeElement('div', 'playline-error'); error.setAttribute('data-playline-error', ''); append(root, error); }
    var empty = findWithin(root, playlineState.mounts.empty, '[data-playline-empty]');
    if (!empty) { empty = makeElement('div', 'playline-empty'); empty.setAttribute('data-playline-empty', ''); append(root, empty); }
    var older = findWithin(root, playlineState.mounts.loadOlder, '[data-playline-load-older]');
    if (!older) { older = makeElement('button', 'playline-load-older'); older.type = 'button'; older.setAttribute('data-playline-load-older', ''); append(root, older); }
    var prefill = findWithin(composer, playlineState.mounts.prefill, '[data-playline-prefill]');
    if (!prefill) { prefill = makeElement('div', 'playline-prefill'); prefill.setAttribute('data-playline-prefill', ''); append(composer, prefill); }
    var refresh = findWithin(root, playlineState.mounts.refresh, '[data-playline-refresh]');
    var audience = findWithin(root, playlineState.mounts.audience, '[data-playline-audience]');
    return { root: root, feed: feed, composer: composer, input: input, publish: publish, tabs: tabs, status: status, error: error, empty: empty, older: older, prefill: prefill, refresh: refresh, audience: audience };
  }

  function playlineComposeMode() {
    return playlineState.prefill && playlineState.prefill.kind !== 'text' ? 'attachment' : 'text';
  }

  function clearOptionalPrefillForText(value) {
    if (playlineState.prefill && playlineState.prefill.kind !== 'text' && String(value || '').trim()) {
      playlineState.prefill = null;
      return true;
    }
    return false;
  }

  function markOptionalAttachmentControl(node) {
    if (!node) return node;
    node.setAttribute && node.setAttribute('data-playline-attachment-control', '');
    classAdd(node, 'playline-attachment-control');
    setSystemAttribute(node, 'title', 'playline_general_optional_label');
    return node;
  }

  function decoratePlaylineOptionalSidebar() {
    var d = doc();
    if (!d || typeof d.querySelectorAll !== 'function') return;
    var cards = d.querySelectorAll('.playline-side-card');
    var card = cards && cards[0];
    if (!card) return;
    card.setAttribute && card.setAttribute('data-playline-optional-context', '');
    var label = findWithin(card, null, '.home-card-label');
    var title = findWithin(card, null, 'h2');
    var body = findWithin(card, null, 'p');
    setSystemText(label, 'playline_general_optional_label');
    setSystemText(title, 'playline_general_sidebar_title');
    setSystemText(body, 'playline_general_sidebar_body');
  }

  function decoratePlaylineGeneralPosting(mounts) {
    if (!mounts) return;
    var root = mounts.root;
    if (root) {
      classAdd(root, 'playline-general-posting');
      root.setAttribute && root.setAttribute('data-playline-text-first', '');
    }
    var routeTitle = getById('playline-route-title');
    var routeIntro = getById('playline-route-intro');
    setSystemText(routeTitle, 'playline_title');
    setSystemText(routeIntro, 'playline_general_intro');

    var composerTitle = getById('playline-composer-title');
    setSystemText(composerTitle, 'playline_composer_label');
    var composer = mounts.composer;
    var input = mounts.input;
    if (composer) {
      composer.setAttribute && composer.setAttribute('data-playline-compose-mode', playlineComposeMode());
      var hint = getById('playline-general-composer-hint') || findWithin(composer, null, '[data-playline-general-composer-hint]');
      if (!hint) {
        hint = makeElement('p', 'playline-general-composer-hint');
        if (hint) {
          hint.id = 'playline-general-composer-hint';
          hint.setAttribute && hint.setAttribute('data-playline-general-composer-hint', '');
          prepend(composer, hint);
        }
      }
      setSystemText(hint, 'playline_general_composer_hint');
      if (input) {
        input.setAttribute && input.setAttribute('data-playline-primary-input', '');
        input.setAttribute && input.setAttribute('aria-describedby', 'playline-general-composer-hint');
        setSystemAttribute(input, 'placeholder', 'playline_general_composer_placeholder');
      }
    }
    if (mounts.publish) {
      mounts.publish.setAttribute && mounts.publish.setAttribute('data-playline-primary-publish', '');
      var actions = mounts.publish.parentNode;
      if (actions) {
        classAdd(actions, 'playline-composer-actions--text-first');
        prepend(actions, mounts.publish);
      }
    }

    ['btn-playline-share-game', 'btn-playline-share-result', 'btn-playline-share-record'].forEach(function (id) {
      markOptionalAttachmentControl(getById(id));
    });
    if (mounts.tabs) {
      mounts.tabs.setAttribute && mounts.tabs.setAttribute('data-playline-general-filter', '');
      mounts.tabs.setAttribute && mounts.tabs.setAttribute('role', 'tablist');
      setSystemAttribute(mounts.tabs, 'aria-label', 'playline_general_filter_label');
    }
    var feedTitle = getById('playline-feed-title');
    setSystemText(feedTitle, playlineState.tab === 'friends' ? 'playline_general_feed_friends' : 'playline_general_feed_all');
    decoratePlaylineOptionalSidebar();
  }

  function renderPlaylineEmptyState(mounts, tab) {
    var node = mounts && mounts.empty;
    if (!node) return;
    removeChildren(node);
    node.setAttribute && node.setAttribute('data-playline-empty-mode', 'text');
    node.setAttribute && node.setAttribute('role', 'status');
    node.setAttribute && node.setAttribute('aria-live', 'polite');
    var title = makeElement('h3', 'playline-empty-title');
    title && title.setAttribute && title.setAttribute('data-playline-empty-title', '');
    setSystemText(title, tab === 'friends' ? 'playline_empty_friends' : 'playline_empty_title');
    append(node, title);
    var copy = makeElement('p', 'playline-empty-copy');
    copy && copy.setAttribute && copy.setAttribute('data-playline-empty-copy', '');
    setSystemText(copy, 'playline_general_empty_body');
    append(node, copy);
    var compose = makeElement('button', 'btn btn-primary playline-empty-compose');
    if (compose) {
      compose.type = 'button';
      compose.setAttribute && compose.setAttribute('data-playline-empty-compose', '');
      setSystemText(compose, 'playline_composer_label');
      compose.addEventListener && compose.addEventListener('click', function () {
        var input = mounts.input;
        if (input && typeof input.focus === 'function') input.focus();
      });
      append(node, compose);
    }
  }

  function pageFor(tab) {
    return playlineState.page[tab] || { posts: [], byId: new Map(), hasMore: false, nextBeforeSeq: null, newestSeq: null };
  }

  function postId(post) {
    var id = post && (post.postId || post.id);
    return id === undefined || id === null ? '' : String(id);
  }

  function postKind(post) {
    var content = post && post.content && typeof post.content === 'object' ? post.content : post || {};
    var kind = String(content.kind || post && post.kind || 'text').toLowerCase();
    if (kind === 'game') kind = 'game_share';
    if (kind === 'result') kind = 'result_share';
    if (kind === 'record' || kind === 'replay') kind = 'record_share';
    return kind;
  }

  function postContentValue(post, key) {
    var content = post && post.content && typeof post.content === 'object' ? post.content : post || {};
    if (content[key] !== undefined) return content[key];
    if (post && post[key] !== undefined) return post[key];
    var snapshot = post && (post.safeSnapshot || post.snapshot || post.result || post.record);
    return snapshot && typeof snapshot === 'object' ? snapshot[key] : undefined;
  }

  function postAuthor(post) {
    var author = post && (post.author || post.authorProfile || post.publicAuthor);
    if (author && typeof author === 'object') return author;
    return { uid: post && post.authorUid, name: post && (post.authorName || post.name) };
  }

  function formatTime(value) {
    var date = new Date(Number(value) || Date.now());
    try {
      var lang = typeof currentLang !== 'undefined' ? currentLang : (global && global.currentLang) || undefined;
      return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(date);
    } catch (_) { return date.toLocaleTimeString().slice(0, 5); }
  }

  function formatNumber(value) {
    var n = Number(value);
    return isFinite(n) ? String(Math.max(0, Math.floor(n))) : '';
  }

  function cardLabelKey(kind) {
    return ({ text: 'playline_kind_text', game_share: 'playline_kind_game', result_share: 'playline_kind_result', record_share: 'playline_kind_record' })[kind] || 'playline_kind_text';
  }

  function renderResultBody(body, post, kind) {
    var gameId = postContentValue(post, 'gameId') || postContentValue(post, 'game');
    if (kind === 'game_share') {
      var gameLine = makeElement('div', 'playline-share-line');
      setSystemText(gameLine, 'playline_game_share_label');
      append(body, gameLine);
      var gameName = makeElement('strong', 'playline-share-value');
      setSystemText(gameName, gameId ? ('game_' + String(gameId)) : 'playline_unknown_game');
      append(body, gameName);
      return;
    }
    var outcome = String(postContentValue(post, 'outcome') || postContentValue(post, 'result') || '');
    var placement = postContentValue(post, 'placement');
    var participantCount = postContentValue(post, 'participantCount');
    var line = makeElement('div', 'playline-share-line');
    if (gameId) {
      var game = makeElement('strong', 'playline-share-game');
      setSystemText(game, gameId ? ('game_' + String(gameId)) : 'playline_unknown_game');
      append(line, game);
    }
    if (outcome) {
      var outcomeNode = makeElement('span', 'playline-share-outcome');
      var key = outcome === 'win' ? 'playline_outcome_win' : outcome === 'loss' ? 'playline_outcome_loss' : outcome === 'draw' ? 'playline_outcome_draw' : 'playline_outcome_finished';
      setSystemText(outcomeNode, key);
      append(line, outcomeNode);
    }
    if (placement !== undefined && placement !== null && placement !== '') {
      var place = makeElement('span', 'playline-share-placement');
      place.textContent=translate('playline_placement',formatNumber(placement));
      append(line, place);
    }
    if (participantCount !== undefined && participantCount !== null && participantCount !== '') {
      var participants = makeElement('span', 'playline-share-participants');
      participants.textContent=translate('playline_participant_count',formatNumber(participantCount));
      append(line, participants);
    }
    if (kind === 'record_share') {
      var recordValue = postContentValue(post, 'value');
      if (recordValue !== undefined && recordValue !== null && recordValue !== '') {
        var record = makeElement('strong', 'playline-share-record-value');
        setRawText(record, formatNumber(recordValue));
        append(line, record);
      }
    }
    if (!line.firstChild) setSystemText(line, kind === 'record_share' ? 'playline_record_share_label' : 'playline_result_share_label');
    append(body, line);
  }

  function renderPlaylineCard(card, post) {
    var id = postId(post);
    var kind = postKind(post);
    card.setAttribute && card.setAttribute('data-playline-card', '');
    card.dataset && (card.dataset.postId = id);
    card.setAttribute && card.setAttribute('data-playline-kind', kind);
    classAdd(card, 'playline-card');
    classToggle(card, 'playline-card--text', kind === 'text');
    classToggle(card, 'playline-card--attachment', kind !== 'text');
    removeChildren(card);
    var header = makeElement('header', 'playline-card-header');
    var author = postAuthor(post);
    if (author && typeof playerIdentityAvatarNode === 'function') { try { var authorAvatar = playerIdentityAvatarNode(author, { size:38 }); authorAvatar.setAttribute && authorAvatar.setAttribute('aria-hidden', 'true'); append(header, authorAvatar); } catch (_) {} }
    var authorName = author && typeof playerIdentityNameNode === 'function'
      ? playerIdentityNameNode(Object.assign({}, author, { name:author.name || author.username || '' }), { className:'playline-card-author' })
      : makeElement('span', 'playline-card-author');
    if (!(author && typeof playerIdentityNameNode === 'function')) {
      if (author && (author.name || author.username)) setRawText(authorName, author.name || author.username);
      else setSystemText(authorName, 'social_player');
    }
    append(header, authorName);
    var kindNode = makeElement('span', 'playline-card-kind');
    setSystemText(kindNode, cardLabelKey(kind));
    append(header, kindNode);
    var created = post && post.createdAt;
    if (created) {
      var time = makeElement('time', 'playline-card-time');
      time.dateTime = new Date(Number(created) || Date.now()).toISOString();
      setRawText(time, formatTime(created));
      append(header, time);
    }
    append(card, header);
    var body = makeElement('div', 'playline-card-body');
    if (kind === 'text') {
      setRawText(body, postContentValue(post, 'text') || '');
    } else {
      renderResultBody(body, post, kind);
    }
    append(card, body);
    var actions = post && post.actions;
    if (actions && typeof actions === 'object') {
      var actionBar = makeElement('div', 'playline-card-actions');
      if(actions.canOpenProfile&&author&&author.uid){var profileButton=makeElement('button','playline-card-profile');profileButton.type='button';setSystemText(profileButton,'playline_open_profile');profileButton.addEventListener&&profileButton.addEventListener('click',function(){try{if(typeof openProfileModal==='function')openProfileModal(String(author.uid));}catch(_){}});append(actionBar,profileButton);}
      if (actions.canMessage && author && author.uid) {
        var message = makeElement('button', 'playline-card-message');
        message.type = 'button';
        setSystemText(message, 'playline_message');
        message.addEventListener && message.addEventListener('click', function () {
          DirectMessage.open({ peerUid: String(author.uid), opener: message });
        });
        append(actionBar, message);
      }
      if (actions.canReport && getOnline() && typeof getOnline().reportUser === 'function') {
        var report = makeElement('button', 'playline-card-report');
        report.type = 'button';
        setSystemText(report, 'playline_report');
        report.addEventListener && report.addEventListener('click', function () {try{if(typeof openReportUserModal==='function')openReportUserModal({uid:String(author&&author.uid||''),name:String(author&&author.name||''),avatar:Number(author&&author.avatar)||0},{type:'playline',id:id,recentEventIds:[]});}catch(_) {}});
        append(actionBar, report);
      }
      if(actions.canDelete&&getOnline()&&typeof getOnline().removePlayline==='function'){var remove=makeElement('button','playline-card-delete');remove.type='button';setSystemText(remove,'playline_delete');remove.addEventListener&&remove.addEventListener('click',function(){getOnline().removePlayline(id);});append(actionBar,remove);}
      if (actionBar.firstChild) append(card, actionBar);
    }
  }

  function postMapFor(tab) {
    return playlineState.nodes[tab] || (playlineState.nodes[tab] = new Map());
  }

  function ensurePage(tab) {
    if (!playlineState.page[tab]) playlineState.page[tab] = { posts: [], byId: new Map(), hasMore: false, nextBeforeSeq: null, newestSeq: null };
    if (!(playlineState.page[tab].byId instanceof Map)) {
      var map = new Map();
      (playlineState.page[tab].posts || []).forEach(function (post) { var id = postId(post); if (id) map.set(id, post); });
      playlineState.page[tab].byId = map;
    }
    return playlineState.page[tab];
  }

  function statePacketPayload(packet) {
    if (!packet) return null;
    if (packet.payload && typeof packet.payload === 'object') return packet.payload;
    return packet;
  }

  function packetType(packet) {
    return String(packet && (packet.type || packet.event || packet.action) || '');
  }

  function packetEpoch(packet, payload) {
    var value = packet && (packet.accountEpoch !== undefined ? packet.accountEpoch : packet.epoch);
    if (value === undefined && payload) value = payload.accountEpoch !== undefined ? payload.accountEpoch : payload.epoch;
    return value;
  }

  function accountPacketIsCurrent(packet, payload, epoch) {
    var value = packetEpoch(packet, payload);
    if (value !== undefined && value !== null && String(value) !== String(epoch)) return false;
    return true;
  }

  function playlineMountSnapshot() {
    return ensurePlaylineStructure();
  }

  function renderPlaylineState() {
    var mounts = playlineMountSnapshot();
    if (!mounts) return false;
    decoratePlaylineGeneralPosting(mounts);
    var tab = playlineState.tab;
    var page = ensurePage(tab);
    var feed = mounts.feed;
    var map = postMapFor(tab);
    var wanted = new Set();
    (page.posts || []).forEach(function (post) {
      var id = postId(post);
      if (!id) return;
      wanted.add(id);
      var card = map.get(id);
      if (!card) { card = makeElement('article', 'playline-card'); map.set(id, card); }
      renderPlaylineCard(card, post);
      append(feed, card);
    });
    if (feed && feed.children) {
      Array.prototype.slice.call(feed.children).forEach(function (child) {
        var id = child.dataset && child.dataset.postId;
        if (child.getAttribute && child.getAttribute('data-playline-card') !== null && id && !wanted.has(String(id))) {
          if (typeof child.remove === 'function') child.remove();
        } else if (child.dataset && child.dataset.playlineState === '1') {
          if (typeof child.remove === 'function') child.remove();
        }
      });
    }
    classToggle(mounts.root, 'is-loading', !!playlineState.loading);
    classToggle(mounts.root, 'has-error', !!playlineState.errorKey);
    classToggle(mounts.root, 'has-content', !!(page.posts && page.posts.length));
    if (mounts.feed && mounts.feed.setAttribute) mounts.feed.setAttribute('aria-busy', playlineState.loading ? 'true' : 'false');
    if (mounts.status) {
      if (playlineState.loading) setSystemText(mounts.status, playlineState.loadingOlder ? 'playline_loading_older' : 'playline_loading');
      else if (playlineState.hint) setSystemText(mounts.status, 'playline_newer_available');
      else if (playlineState.errorKey) setSystemText(mounts.status, playlineState.errorKey);
      else setSystemText(mounts.status, 'playline_ready');
      mounts.status.setAttribute && mounts.status.setAttribute('role', 'status');
      mounts.status.setAttribute && mounts.status.setAttribute('aria-live', 'polite');
    }
    if (mounts.error) {
      if (playlineState.errorKey) { setSystemText(mounts.error, playlineState.errorKey); classRemove(mounts.error, 'hidden'); }
      else { mounts.error.textContent = ''; classAdd(mounts.error, 'hidden'); }
      mounts.error.setAttribute && mounts.error.setAttribute('role', 'alert');
    }
    if (mounts.empty) {
      if (!playlineState.loading && !(page.posts && page.posts.length)) {
        renderPlaylineEmptyState(mounts, tab);
        classRemove(mounts.empty, 'hidden');
      } else {
        mounts.empty.textContent = '';
        mounts.empty.removeAttribute && mounts.empty.removeAttribute('data-playline-empty-mode');
        classAdd(mounts.empty, 'hidden');
      }
    }
    if (mounts.older) {
      var showOlder = !!(page.hasMore && page.nextBeforeSeq);
      classToggle(mounts.older, 'hidden', !showOlder);
      mounts.older.disabled = !showOlder || playlineState.loading;
      if (showOlder) setSystemText(mounts.older, playlineState.loadingOlder ? 'playline_loading_older' : 'playline_load_older');
    }
    updatePlaylineTabs(mounts);
    if (mounts.audience) {
      mounts.audience.removeAttribute && mounts.audience.removeAttribute('data-i18n-raw');
      mounts.audience.removeAttribute && mounts.audience.removeAttribute('data-i18n');
      var audienceName = translate(tab === 'all' ? 'playline_tab_all' : 'playline_tab_friends');
      var audienceText = translate('playline_audience', audienceName);
      try { if (typeof setLocalizedText === 'function') setLocalizedText(mounts.audience, audienceText); else mounts.audience.textContent = audienceText; } catch (_) { mounts.audience.textContent = audienceText; }
    }
    renderPrefill(mounts.prefill);
    var input = mounts.input;
    if (input && documentRef && documentRef.activeElement !== input && input.value !== playlineState.draftText) input.value = playlineState.draftText;
    if (mounts.publish) mounts.publish.disabled = !!playlineState.loading || !canPublish();
    return true;
  }

  function updatePlaylineTabs(mounts) {
    if (!mounts || !mounts.tabs) return;
    var buttons = typeof mounts.tabs.querySelectorAll === 'function' ? mounts.tabs.querySelectorAll('[data-playline-tab]') : [];
    Array.prototype.slice.call(buttons || []).forEach(function (button) {
      var active = String(button.getAttribute('data-playline-tab') || '') === playlineState.tab;
      classToggle(button, 'is-active', active);
      classToggle(button, 'active', active);
      button.setAttribute && button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.setAttribute && button.setAttribute('role', 'tab');
      button.tabIndex = active ? 0 : -1;
    });
  }

  function renderPrefill(node) {
    if (!node) return;
    removeChildren(node);
    var value = playlineState.prefill;
    if (!value) { classAdd(node, 'hidden'); return; }
    classRemove(node, 'hidden');
    var label = makeElement('span', 'playline-prefill-label');
    var key = value.kind === 'game_share' ? 'playline_prefill_game' : value.kind === 'result_share' ? 'playline_prefill_result' : value.kind === 'record_share' ? 'playline_prefill_record' : 'playline_prefill_text';
    setSystemText(label, key); append(node, label);
    var clear = makeElement('button', 'playline-prefill-clear'); clear.type = 'button'; setSystemText(clear, 'playline_prefill_clear');
    clear.addEventListener && clear.addEventListener('click', function () { playlineState.prefill = null; playlineState.draftText = value.kind === 'text' ? '' : playlineState.draftText; renderPlaylineState(); });
    append(node, clear);
    node.setAttribute && node.setAttribute('data-prefill-kind', value.kind);
  }

  function composerPublishInput(input) {
    var content = playlineState.prefill && playlineState.prefill.kind !== 'text'
      ? playlineState.prefill
      : { kind: 'text', text: input && input.value !== undefined ? input.value : playlineState.draftText };
    return { audience: playlineState.tab, content: content };
  }

  function canPublish() {
    var a = getAccount();
    var o = getOnline();
    var testAdmin = !!(a && (a.isTestAdmin === true || (a.testAdmin && a.testAdmin.sandbox === true)));
    return !!(a && a.uid && !a.ephemeral && !testAdmin && o && o.connected && o._authenticated);
  }

  function supportsPlayline(o) {
    if (!o) return false;
    try {
      if (typeof o.supportsCapability === 'function') return o.supportsCapability(PLAYLINE_CAPABILITY) !== false;
      if (o.capabilities && typeof o.capabilities.has === 'function') return o.capabilities.has(PLAYLINE_CAPABILITY);
    } catch (_) { return false; }
    /* A thin facade can intentionally omit capabilities while the integration
     * is being staged; in that case the facade itself is the opt-in. */
    return true;
  }

  function setPlaylineError(key, notify) {
    playlineState.errorKey = key || null;
    if (notify) {
      try { if (global && typeof global.toast === 'function') global.toast(translate(key || 'playline_error_generic')); else if (typeof toast === 'function') toast(translate(key || 'playline_error_generic')); } catch (_) {}
    }
    renderPlaylineState();
  }

  function requestPlayline(tab, beforeSeq, limit, older) {
    var o = getOnline();
    if (!o) { setPlaylineError('playline_offline'); return false; }
    if (!supportsPlayline(o)) { setPlaylineError('playline_error_unsupported_capability'); return false; }
    var epoch = syncAccount();
    var id = ++playlineState.requestSerial;
    playlineState.request = { id: id, epoch: epoch, tab: tab, beforeSeq: beforeSeq ? String(beforeSeq) : null };
    playlineState.loading = true;
    playlineState.loadingOlder = !!older;
    if (older) {
      var mounts = playlineMountSnapshot();
      if (mounts && mounts.feed) playlineState.preserveScroll = { height: Number(mounts.feed.scrollHeight || 0), top: Number(mounts.feed.scrollTop || 0) };
    }
    playlineState.errorKey = null;
    renderPlaylineState();
    var payload = { filter: tab, limit: clampLimit(limit) };
    if (beforeSeq) payload.beforeSeq = String(beforeSeq);
    var accepted = false;
    try {
      if (typeof o.requestPlayline === 'function') accepted = (o.requestPlayline.length >= 2 ? o.requestPlayline(tab, beforeSeq, clampLimit(limit)) : o.requestPlayline(payload)) !== false;
      else if (typeof o.requestPlaylinePage === 'function') accepted = o.requestPlaylinePage(tab, beforeSeq, clampLimit(limit)) !== false;
      else if (typeof o.loadPlayline === 'function') accepted = o.loadPlayline(payload) !== false;
      else if (typeof o.send === 'function') accepted = o.send({ type: 'playline_list', payload: { filter: tab, ...(beforeSeq ? { beforeSeq: String(beforeSeq) } : {}), limit: clampLimit(limit) } }) !== false;
    } catch (_) { accepted = false; }
    if (!accepted) {
      playlineState.loading = false;
      playlineState.loadingOlder = false;
      setPlaylineError('playline_offline');
      return false;
    }
    return true;
  }

  function playlineInit(options) {
    if (options && typeof options === 'object') {
      resolvePlaylineMounts(options);
      playlineState.configured = true;
    }
    installStyle();
    var mounts = playlineMountSnapshot();
    if (!mounts) return false;
    if (!playlineState.bound) {
      playlineState.bound = true;
      var all = mounts.tabs && typeof mounts.tabs.querySelector === 'function' ? mounts.tabs.querySelector('[data-playline-tab="all"]') : null;
      var friends = mounts.tabs && typeof mounts.tabs.querySelector === 'function' ? mounts.tabs.querySelector('[data-playline-tab="friends"]') : null;
      var input = mounts.input;
      var publish = mounts.publish;
      var older = mounts.older;
      var refresh = mounts.refresh;
      var composer = mounts.composer;
      if (all && all.addEventListener) all.addEventListener('click', function () { Playline.open({ filter: 'all' }); });
      if (friends && friends.addEventListener) friends.addEventListener('click', function () { Playline.open({ filter: 'friends' }); });
      if (older && older.addEventListener) older.addEventListener('click', function () {
        var page = ensurePage(playlineState.tab);
        if (page.nextBeforeSeq) requestPlayline(playlineState.tab, page.nextBeforeSeq, PLAYLINE_LIMIT, true);
      });
      if (refresh && refresh.addEventListener) refresh.addEventListener('click', function () { Playline.open({ filter: playlineState.tab, refresh: true }); });
      if (input && input.addEventListener) input.addEventListener('input', function () {
        playlineState.draftText = String(input.value || '');
        if (clearOptionalPrefillForText(playlineState.draftText)) renderPlaylineState();
      });
      if (composer && composer.addEventListener) composer.addEventListener('submit', function (event) { if (event && event.preventDefault) event.preventDefault(); Playline.publish(composerPublishInput(input)); });
      if (publish && publish.addEventListener) publish.addEventListener('click', function (event) { if (composer && composer.tagName && String(composer.tagName).toLowerCase() === 'form') return; if (event && event.preventDefault) event.preventDefault(); Playline.publish(composerPublishInput(input)); });
      installPresenterListeners();
    }
    playlineState.initialized = true;
    syncAccount();
    renderPlaylineState();
    return true;
  }

  function installPresenterListeners() {
    if (playlineState.listenersInstalled) return;
    var target = global && typeof global.addEventListener === 'function' ? global : null;
    if (!target) return;
    playlineState.listenersInstalled = true;
    target.addEventListener('ghostgame:accountchange', function () { syncAccount(); renderPlaylineState(); renderDirectMessage(); });
    target.addEventListener('ghostgame:logout', function () { syncAccount(); renderPlaylineState(); renderDirectMessage(); });
    target.addEventListener('ghostgame:shellchange', function (event) {
      directState.stageBusy = !!(event && event.detail && event.detail.active);
      if (directState.stageBusy && directState.open) closeDirectInternal('game_stage_busy', false);
    });
    target.addEventListener('languagechange', function () { renderPlaylineState(); });
  }

  function playlineOpen(input) {
    input = input && typeof input === 'object' ? input : {};
    if (input.mountIds || input.mount || input.mounts) playlineInit(input);
    else if (!playlineState.initialized) playlineInit();
    var mounts = playlineMountSnapshot();
    if (!mounts) return false;
    syncAccount();
    var tab = normalizeTab(input.filter || input.tab || playlineState.tab) || 'all';
    var changed = tab !== playlineState.tab;
    playlineState.tab = tab;
    playlineState.active = true;
    classRemove(mounts.root, 'hidden');
    mounts.root.setAttribute && mounts.root.setAttribute('aria-hidden', 'false');
    if (changed || input.refresh || input.beforeSeq === undefined) {
      if (changed || input.refresh || !playlineState.page[tab]) {
        playlineState.page[tab] = null;
        playlineState.nodes[tab] = new Map();
      }
    }
    var before = input.beforeSeq;
    if (before === undefined && input.loadOlder) {
      var page = ensurePage(tab); before = page.nextBeforeSeq;
    }
    var older = before !== undefined && before !== null && before !== '';
    if (input.load === false) { renderPlaylineState(); return true; }
    requestPlayline(tab, before, input.limit, older);
    return true;
  }

  function playlinePrefill(input, reference) {
    if (typeof input === 'string') {
      var prefillKind = input;
      input = prefillKind === 'text' ? { kind: 'text', text: reference || '' } :
        (prefillKind === 'game' || prefillKind === 'game_share') ? { kind: 'game_share', gameId: reference || '' } :
        (prefillKind === 'result' || prefillKind === 'result_share') ? { kind: 'result_share', resultId: reference || '' } :
        (prefillKind === 'record' || prefillKind === 'record_share') ? { kind: 'record_share', recordId: reference || '' } :
        prefillKind === 'replay' ? { kind: 'record_share', replayId: reference || '' } : null;
    }
    var content = normalizeContent(input);
    if (!content) { setPlaylineError('playline_invalid_prefill'); return false; }
    playlineState.prefill = content;
    if (content.kind === 'text') playlineState.draftText = content.text;
    else playlineState.draftText = '';
    var mounts = playlineMountSnapshot();
    if (mounts) renderPlaylineState();
    return true;
  }

  function playlinePublish(input) {
    syncAccount();
    var intent = normalizePublishIntent(input || { content: playlineState.prefill || { kind: 'text', text: playlineState.draftText }, audience: playlineState.tab });
    if (!intent) { setPlaylineError('playline_invalid_post_shape', true); return null; }
    if (!canPublish()) { setPlaylineError('playline_not_authenticated', true); return null; }
    var o = getOnline();
    if (!supportsPlayline(o)) { setPlaylineError('playline_error_unsupported_capability', true); return null; }
    playlineState.pending.set(intent.clientPostId, { intent: intent, epoch: playlineState.accountEpoch });
    playlineState.errorKey = null;
    renderPlaylineState();
    var sent = false;
    try {
      if (typeof o.publishPlayline === 'function') sent = o.publishPlayline(intent) !== false;
      else if (typeof o.sendPlayline === 'function') sent = o.sendPlayline(intent) !== false;
      else if (typeof o.send === 'function') sent = o.send({ type: 'playline_publish', payload: intent }) !== false;
    } catch (_) { sent = false; }
    if (!sent) {
      playlineState.pending.delete(intent.clientPostId);
      setPlaylineError('playline_offline', true);
      return null;
    }
    return intent.clientPostId;
  }

  function mergePlaylinePosts(tab, posts, appendPage) {
    var page = ensurePage(tab);
    var incoming = Array.isArray(posts) ? posts : [];
    if (!appendPage) {
      page.posts = [];
      page.byId = new Map();
      /* Keep the keyed DOM map across refreshes.  renderPlaylineState removes
       * only cards no longer present, so an unchanged post retains identity. */
    }
    incoming.forEach(function (post) {
      var id = postId(post); if (!id) return;
      page.byId.set(id, post);
    });
    page.posts = Array.from(page.byId.values());
  }

  function acceptPlayline(packet) {
    syncAccount();
    var payload = statePacketPayload(packet);
    var type = packetType(packet);
    if (!payload || !type) return false;
    if (!accountPacketIsCurrent(packet, payload, playlineState.accountEpoch)) return false;
    if (type === 'playline_hint') {
      playlineState.hint = true;
      renderPlaylineState();
      return true;
    }
    if (type === 'playline_state' || type === 'playline_page') {
      var tab = normalizeTab(payload.filter || payload.tab) || (playlineState.request && playlineState.request.tab);
      if (!tab || tab !== playlineState.tab) return false;
      var request = playlineState.request;
      if (request && request.epoch !== playlineState.accountEpoch) return false;
      var posts = payload.posts || payload.page || [];
      var isOlder = !!(request && request.beforeSeq) || !!playlineState.loadingOlder;
      mergePlaylinePosts(tab, posts, isOlder);
      var page = ensurePage(tab);
      page.hasMore = !!(payload.hasMore);
      page.nextBeforeSeq = payload.nextBeforeSeq || payload.nextCursor || null;
      page.newestSeq = payload.newestSeq || payload.snapshotAt || page.newestSeq || null;
      playlineState.loading = false;
      playlineState.loadingOlder = false;
      playlineState.errorKey = null;
      playlineState.hint = false;
      playlineState.request = null;
      renderPlaylineState();
      restorePlaylineScroll();
      return true;
    }
    if (type === 'playline_publish_ok') {
      var clientPostId = String(payload.clientPostId || '');
      var pending = clientPostId && playlineState.pending.get(clientPostId);
      if (clientPostId && !pending) return false;
      if (pending && pending.epoch !== playlineState.accountEpoch) return false;
      if (clientPostId) playlineState.pending.delete(clientPostId);
      var post = payload.post;
      if (post) {
        var id = postId(post);
        var targetTabs = new Set([playlineState.tab, normalizeTab(post.audience) || playlineState.tab]);
        if (id) targetTabs.forEach(function (tabForPost) {
          var pageForPost = ensurePage(tabForPost);
          var ordered = new Map([[id, post]]);
          pageForPost.byId.forEach(function (value, key) { if (key !== id) ordered.set(key, value); });
          pageForPost.byId = ordered;
          pageForPost.posts = Array.from(ordered.values());
        });
      }
      playlineState.draftText = '';
      playlineState.prefill = null;
      playlineState.errorKey = null;
      renderPlaylineState();
      return true;
    }
    if(type==='playline_remove_ok'){
      var removedId=String(payload.postId||'');
      if(removedId)PLAYLINE_TABS.forEach(function(tab){var page=ensurePage(tab);page.byId.delete(removedId);page.posts=Array.from(page.byId.values());var node=playlineState.nodes[tab]&&playlineState.nodes[tab].get(removedId);if(node&&typeof node.remove==='function')node.remove();if(playlineState.nodes[tab])playlineState.nodes[tab].delete(removedId);});
      renderPlaylineState();return true;
    }
    if(type==='playline_invalidated'){
      clearPlaylinePages();renderPlaylineState();if(playlineState.active)requestPlayline(playlineState.tab,null,PLAYLINE_LIMIT,false);return true;
    }
    if (type === 'playline_error') {
      var reason = String(payload.reason || 'server_unavailable');
      var key = 'server_reason_playline_' + reason;
      if(translate(key)===key)key='playline_error_generic';
      playlineState.loading = false;
      playlineState.loadingOlder = false;
      playlineState.request = null;
      playlineState.errorKey = key;
      if (payload.action === 'playline_list' || payload.action === 'playline_page' || type === 'playline_error') {
        if (reason === 'invalid_cursor' || reason === 'invalid_scope' || reason === 'invalid_filter') {
          playlineState.page[playlineState.tab] = null;
          playlineState.nodes[playlineState.tab] = new Map();
        }
      }
      renderPlaylineState();
      return true;
    }
    return false;
  }

  function restorePlaylineScroll() {
    var preserve = playlineState.preserveScroll;
    playlineState.preserveScroll = null;
    if (!preserve) return;
    var mounts = playlineMountSnapshot();
    if (!mounts || !mounts.feed) return;
    var apply = function () {
      try { mounts.feed.scrollTop = Math.max(0, Number(mounts.feed.scrollHeight || 0) - preserve.height + preserve.top); } catch (_) {}
    };
    if (typeof global.requestAnimationFrame === 'function') global.requestAnimationFrame(apply); else apply();
  }

  function playlineReset() {
    playlineState.accountEpoch += 1;
    clearPlaylinePages();
    playlineState.prefill = null;
    playlineState.draftText = '';
    playlineState.active = false;
    var root = playlineRoot();
    if (root) { classAdd(root, 'hidden'); root.setAttribute && root.setAttribute('aria-hidden', 'true'); renderPlaylineState(); }
    return true;
  }

  function directRoot() {
    return resolveRef(directState.mounts.root);
  }

  function directFind(root, key, selector) {
    return findWithin(root, directState.mounts[key], selector);
  }

  function directMessageTimeText(value) {
    var timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
    var date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return '';
    try {
      var now = new Date();
      var sameDay = now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth() && now.getDate() === date.getDate();
      var locale = typeof currentLang === 'string' ? currentLang : (global && typeof global.currentLang === 'string' ? global.currentLang : undefined);
      return new Intl.DateTimeFormat(locale, sameDay ? { hour:'2-digit', minute:'2-digit' } : { month:'short', day:'numeric' }).format(date);
    } catch (_) {
      try { return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); } catch (_error) { return ''; }
    }
  }

  function runDirectSurfaceMotion(phase, mounts, from, to, onComplete) {
    var motion = global && global.GhostSurfaceMotion;
    if (!motion || typeof motion.run !== 'function' || !mounts || !mounts.root || !mounts.card) {
      if (typeof onComplete === 'function') onComplete('static');
      return false;
    }
    try {
      motion.run({ surface:'direct-message', phase:phase, root:mounts.root, panel:mounts.card, from:from || null, to:to || null, onComplete:onComplete });
      return true;
    } catch (_) {
      if (typeof onComplete === 'function') onComplete('failed');
      return false;
    }
  }

  function ensureDirectStructure() {
    var root = directRoot();
    if (!root) return null;
    classAdd(root, 'direct-message-overlay');
    if (!directState.open) {
      classAdd(root, 'hidden');
      root.setAttribute && root.setAttribute('aria-hidden', 'true');
    }
    var card = directFind(root, 'dialog', '[data-direct-message-dialog]');
    if (!card) {
      card = makeElement('section', 'direct-message-dialog');
      card.setAttribute('data-direct-message-dialog', '');
      append(root, card);
    }
    var header = card.querySelector && card.querySelector('[data-direct-message-header]');
    if (!header) { header = makeElement('header', 'direct-message-header'); header.setAttribute('data-direct-message-header', ''); append(card, header); }
    var close = directFind(card, 'close', '[data-direct-message-close]');
    if (!close) { close = makeElement('button', 'direct-message-close'); close.type = 'button'; close.setAttribute('data-direct-message-close', ''); append(header, close); }
    setIconButton(close, '×', 'direct_message_close');
    var back = directFind(card, 'back', '[data-direct-message-back]');
    if (!back) { back = makeElement('button', 'direct-message-back'); back.type = 'button'; back.setAttribute('data-direct-message-back', ''); append(header, back); }
    setIconButton(back, '←', 'direct_message_back');
    var avatar = directFind(header, 'avatar', '[data-direct-message-avatar]');
    if (!avatar) { avatar = makeElement('div', 'direct-message-header-avatar'); avatar.setAttribute('data-direct-message-avatar', ''); append(header, avatar); }
    var copy = header.querySelector && header.querySelector('[data-direct-message-header-copy]');
    if (!copy) { copy = makeElement('div', 'direct-message-header-copy'); copy.setAttribute('data-direct-message-header-copy', ''); append(header, copy); }
    var title = directFind(copy, 'title', '[data-direct-message-title]');
    if (!title) { title = makeElement('h2', 'direct-message-title'); title.id = directState.mounts.title && typeof directState.mounts.title === 'string' ? directState.mounts.title : 'direct-message-title'; title.setAttribute('data-direct-message-title', ''); append(copy, title); }
    var presence = directFind(copy, 'presence', '[data-direct-message-presence]');
    if (!presence) { presence = makeElement('div', 'direct-message-presence'); presence.setAttribute('data-direct-message-presence', ''); append(copy, presence); }
    var layout = card.querySelector && card.querySelector('[data-direct-message-layout]');
    if (!layout) { layout = makeElement('div', 'direct-message-layout'); layout.setAttribute('data-direct-message-layout', ''); append(card, layout); }
    var list = directFind(layout, 'list', '[data-direct-message-list]');
    if (!list) { list = makeElement('aside', 'direct-message-list'); list.setAttribute('data-direct-message-list', ''); append(layout, list); }
    var listHead = list.querySelector && list.querySelector('[data-direct-message-list-head]');
    if (!listHead) { listHead = makeElement('div', 'direct-message-list-head'); listHead.setAttribute('data-direct-message-list-head', ''); prepend(list, listHead); }
    var listHeading = listHead.querySelector && listHead.querySelector('[data-direct-message-list-heading]');
    if (!listHeading) { listHeading = makeElement('h3', 'direct-message-list-heading'); listHeading.setAttribute('data-direct-message-list-heading', ''); append(listHead, listHeading); }
    setSystemText(listHeading, 'dm_inbox');
    var unreadTotal = listHead.querySelector && listHead.querySelector('[data-direct-message-unread-total]');
    if (!unreadTotal) { unreadTotal = makeElement('span', 'direct-message-unread-total hidden'); unreadTotal.setAttribute('data-direct-message-unread-total', ''); append(listHead, unreadTotal); }
    var listStatus = directFind(list, 'listStatus', '[data-direct-message-list-status]');
    if (!listStatus) { listStatus = makeElement('div', 'direct-message-list-status'); listStatus.setAttribute('data-direct-message-list-status', ''); append(list, listStatus); }
    var thread = directFind(layout, 'thread', '[data-direct-message-thread]');
    if (!thread) { thread = makeElement('section', 'direct-message-thread'); thread.setAttribute('data-direct-message-thread', ''); append(layout, thread); }
    var messages = directFind(thread, 'messages', '[data-direct-message-messages]');
    if (!messages) { messages = makeElement('div', 'direct-message-messages'); messages.setAttribute('data-direct-message-messages', ''); append(thread, messages); }
    var composer = thread.querySelector && thread.querySelector('[data-direct-message-composer]');
    if (!composer) { composer = makeElement('form', 'direct-message-composer'); composer.setAttribute('data-direct-message-composer', ''); append(thread, composer); }
    var input = directFind(composer, 'input', 'textarea,[data-direct-message-input]');
    if (!input) { input = makeElement('textarea', 'direct-message-input'); input.setAttribute('data-direct-message-input', ''); append(composer, input); }
    input.setAttribute && input.setAttribute('enterkeyhint', 'send');
    input.setAttribute && input.setAttribute('maxlength', '500');
    var send = directFind(composer, 'send', '[data-direct-message-send]');
    if (!send) { send = makeElement('button', 'direct-message-send'); send.type = 'submit'; send.setAttribute('data-direct-message-send', ''); append(composer, send); }
    setSystemText(send, 'direct_message_send');
    var note = directFind(composer, 'note', '[data-direct-message-composer-note]');
    if (!note) { note = makeElement('small', 'direct-message-composer-note'); note.setAttribute('data-direct-message-composer-note', ''); append(composer, note); }
    var status = directFind(card, 'status', '[data-direct-message-status]');
    if (!status) { status = makeElement('div', 'direct-message-status'); status.setAttribute('data-direct-message-status', ''); append(card, status); }
    var older = directFind(messages, 'loadOlder', '[data-direct-message-load-older]');
    if (!older) { older = makeElement('button', 'direct-message-load-older'); older.type = 'button'; older.setAttribute('data-direct-message-load-older', ''); append(messages, older); }
    return { root: root, card: card, close: close, back: back, title: title, presence: presence, layout: layout, list: list, listHead: listHead, listHeading: listHeading, unreadTotal: unreadTotal, listStatus: listStatus, thread: thread, avatar: avatar, messages: messages, composer: composer, input: input, send: send, note: note, status: status, older: older };
  }

  function directInit(options) {
    if (options && typeof options === 'object') {
      directState.mounts = mergeMounts(DIRECT_MOUNT_DEFAULTS, options.mountIds || options.mount || options);
      directState.configured = true;
    }
    installStyle();
    var mounts = ensureDirectStructure();
    if (!mounts) return false;
    if (!directState.bound) {
      directState.bound = true;
      if (mounts.close && mounts.close.addEventListener) mounts.close.addEventListener('click', function () { DirectMessage.close('user'); });
      if (mounts.back && mounts.back.addEventListener) mounts.back.addEventListener('click', function () { var from=mounts.thread,to=mounts.list;directState.peerUid = null; var o = getOnline(); if (o) o.chatActivePeerUid = null; renderDirectMessage(); runDirectSurfaceMotion('back',mounts,from,to); });
      if (mounts.composer && mounts.composer.addEventListener) mounts.composer.addEventListener('submit', function (event) { if (event && event.preventDefault) event.preventDefault(); sendDirectMessage(mounts.input && mounts.input.value); });
      if (mounts.input && mounts.input.addEventListener) mounts.input.addEventListener('input', function () { var o = getOnline(); if (o && o.chatDrafts && directState.peerUid) o.chatDrafts.set(String(directState.peerUid), String(mounts.input.value || '')); });
      if (mounts.input && mounts.input.addEventListener) mounts.input.addEventListener('keydown', function (event) {
        if (event && event.key === 'Enter' && !event.shiftKey) { if (event.preventDefault) event.preventDefault(); sendDirectMessage(mounts.input.value); }
      });
      if (mounts.older && mounts.older.addEventListener) mounts.older.addEventListener('click', function () { loadOlderDirectMessages(); });
      installDirectListeners();
    }
    directState.initialized = true;
    syncAccount();
    renderDirectMessage();
    return true;
  }

  function installDirectListeners() {
    var target = global && typeof global.addEventListener === 'function' ? global : null;
    if (!target || directState.listenersInstalled) return;
    directState.listenersInstalled = true;
    target.addEventListener('ghostgame:accountchange', function () { syncAccount(); renderDirectMessage(); });
    target.addEventListener('ghostgame:logout', function () { syncAccount(); renderDirectMessage(); });
    target.addEventListener('ghostgame:shellchange', function (event) {
      directState.stageBusy = !!(event && event.detail && event.detail.active);
      if (directState.stageBusy && directState.open) closeDirectInternal('game_stage_busy', false);
    });
    target.addEventListener('languagechange', function () { renderDirectMessage(); });
  }

  function focusableWithin(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    var selector = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    try { return Array.prototype.slice.call(root.querySelectorAll(selector)).filter(function (node) { return node && !node.disabled && !node.hidden && node.tabIndex !== -1; }); } catch (_) { return []; }
  }

  function installDirectA11y(mounts) {
    if (!mounts || !mounts.root || !mounts.card) return;
    var root = mounts.root;
    var card = mounts.card;
    card.setAttribute && card.setAttribute('role', 'dialog');
    card.setAttribute && card.setAttribute('aria-modal', 'true');
    card.setAttribute && card.setAttribute('aria-labelledby', mounts.title && mounts.title.id ? mounts.title.id : 'direct-message-title');
    card.setAttribute && card.setAttribute('aria-label', translate('direct_message_title'));
    if (directState.keydown && doc() && doc().removeEventListener) doc().removeEventListener('keydown', directState.keydown, true);
    if (directState.backdropClick && root.removeEventListener) root.removeEventListener('click', directState.backdropClick);
    var keydown = function (event) {
      if (!directState.open) return;
      if (event && event.key === 'Escape') {
        if (event.preventDefault) event.preventDefault();
        DirectMessage.close('user');
        return;
      }
      if (!event || event.key !== 'Tab') return;
      var items = focusableWithin(card);
      if (!items.length) return;
      var active = doc() && doc().activeElement;
      var index = items.indexOf(active);
      if (event.shiftKey && (index <= 0)) { if (event.preventDefault) event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (index < 0 || index === items.length - 1)) { if (event.preventDefault) event.preventDefault(); items[0].focus(); }
    };
    var backdrop = function (event) { if (event && event.target === root) DirectMessage.close('user'); };
    directState.keydown = keydown;
    directState.backdropClick = backdrop;
    if (doc() && doc().addEventListener) doc().addEventListener('keydown', keydown, true);
    if (root.addEventListener) root.addEventListener('click', backdrop);
  }

  function acquireDirectLock(owner) {
    if (directState.lockHeld || !owner) return;
    directState.lockOwner = owner;
    directState.lockHeld = true;
    try {
      if (typeof acquireModalScrollLock === 'function') acquireModalScrollLock(owner);
      else if (global && typeof global.acquireModalScrollLock === 'function') global.acquireModalScrollLock(owner);
      else {
        owner.dataset && (owner.dataset.modalScrollLock = '1');
        var d = doc(); if (d && d.body) classAdd(d.body, 'modal-scroll-locked');
      }
    } catch (_) {}
  }

  function releaseDirectLock() {
    if (!directState.lockHeld) return;
    var owner = directState.lockOwner;
    directState.lockHeld = false;
    directState.lockOwner = null;
    try {
      if (typeof releaseModalScrollLock === 'function') releaseModalScrollLock(owner);
      else if (global && typeof global.releaseModalScrollLock === 'function') global.releaseModalScrollLock(owner);
      else {
        if (owner && owner.dataset) delete owner.dataset.modalScrollLock;
        var d = doc(); if (d && d.body) classRemove(d.body, 'modal-scroll-locked');
      }
    } catch (_) {}
  }

  function conversationFor(peerUid) {
    var o = getOnline();
    var state = o && o.chatState;
    var rows = state && Array.isArray(state.conversations) ? state.conversations : [];
    return rows.find(function (item) { return item && item.peer && String(item.peer.uid) === String(peerUid); }) || null;
  }

  function isGuestAccount() {
    var a = getAccount(); return !!(a && a.ephemeral);
  }

  function renderDirectList(mounts) {
    var list = mounts.list;
    if (!list) return;
    var o = getOnline();
    var conversations = o && o.chatState && Array.isArray(o.chatState.conversations) ? o.chatState.conversations : [];
    var status = mounts.listStatus;
    var unreadTotal = Math.max(0, Number(o && o.chatState && o.chatState.unreadTotal) || 0);
    if (mounts.unreadTotal) {
      setRawText(mounts.unreadTotal, unreadTotal > 99 ? '99+' : String(unreadTotal));
      mounts.unreadTotal.setAttribute && mounts.unreadTotal.setAttribute('aria-label', translate('direct_message_unread_count'));
      classToggle(mounts.unreadTotal, 'hidden', !unreadTotal);
    }
    if (status) {
      setSystemText(status, o && o.chatListPending ? 'direct_message_loading' : (o && o.connected && o._authenticated ? 'direct_message_connected' : 'direct_message_disconnected'));
      status.setAttribute && status.setAttribute('role', 'status');
      status.setAttribute && status.setAttribute('aria-live', 'polite');
      status.setAttribute && status.setAttribute('aria-busy', o && o.chatListPending ? 'true' : 'false');
    }
    Array.prototype.slice.call(list.children || []).forEach(function (child) {
      if (child === status || child === mounts.listHead) return;
      if (typeof child.remove === 'function') child.remove();
    });
    if (!getAccount() || isGuestAccount()) {
      var guest = makeElement('div', 'direct-message-empty'); guest.dataset && (guest.dataset.directMessageState = '1'); setSystemText(guest, isGuestAccount() ? 'direct_message_guest_readonly' : 'direct_message_login'); append(list, guest); return;
    }
    if (o && o.chatListPending && !conversations.length) {
      var loading = makeElement('div', 'direct-message-loading'); loading.dataset && (loading.dataset.directMessageState = '1'); setSystemText(loading, 'direct_message_loading'); append(list, loading); return;
    }
    if (!conversations.length) {
      var empty = makeElement('div', 'direct-message-empty'); empty.dataset && (empty.dataset.directMessageState = '1'); setSystemText(empty, 'direct_message_empty'); append(list, empty); return;
    }
    conversations.forEach(function (item) {
      var peer = item && item.peer || {};
      var row = makeElement('button', 'direct-message-conversation-row');
      row.type = 'button';
      row.dataset && (row.dataset.peerUid = String(peer.uid || ''));
      row.setAttribute && row.setAttribute('data-direct-message-peer', String(peer.uid || ''));
      if (directState.peerUid && String(directState.peerUid) === String(peer.uid)) row.setAttribute && row.setAttribute('aria-current', 'true');
      if (typeof playerIdentityAvatarNode === 'function') { try { var listAvatar = playerIdentityAvatarNode(peer, { size:40 }); listAvatar.setAttribute && listAvatar.setAttribute('aria-hidden', 'true'); append(row, listAvatar); } catch (_) {} }
      var copy = makeElement('span', 'direct-message-conversation-copy');
      var name = typeof playerIdentityNameNode === 'function' ? playerIdentityNameNode(peer, { className:'direct-message-peer-name' }) : makeElement('span', 'direct-message-peer-name');
      if (!(typeof playerIdentityNameNode === 'function')) setRawText(name, peer.name || translate('social_player'));
      append(copy, name);
      if (item.lastMessage && item.lastMessage.text !== undefined) { var preview = makeElement('span', 'direct-message-preview'); setRawText(preview, item.lastMessage.text); append(copy, preview); }
      append(row, copy);
      var unread = Math.max(0, Number(item.unreadCount) || 0);
      var meta = makeElement('span', 'direct-message-conversation-meta');
      var timeText = directMessageTimeText(item.lastMessage && item.lastMessage.createdAt);
      if (timeText) { var time = makeElement('time', 'direct-message-conversation-time'); setRawText(time, timeText); time.dateTime = new Date(Number(item.lastMessage.createdAt)).toISOString(); append(meta, time); }
      if (unread) { var badge = makeElement('span', 'direct-message-unread'); setRawText(badge, unread > 99 ? '99+' : String(unread)); badge.setAttribute && badge.setAttribute('aria-label', translate('direct_message_unread_count')); append(meta, badge); }
      append(row, meta);
      row.addEventListener && row.addEventListener('click', function () { selectDirectPeer(String(peer.uid || '')); });
      append(list, row);
    });
  }

  function renderDirectThread(mounts) {
    var o = getOnline();
    var peerUid = directState.peerUid;
    if (!peerUid && o && o.chatActivePeerUid) peerUid = String(o.chatActivePeerUid);
    var summary = peerUid ? conversationFor(peerUid) : null;
    if (mounts.back) classToggle(mounts.back, 'hidden', !peerUid);
    if (mounts.composer) classToggle(mounts.composer, 'hidden', !peerUid);
    if (mounts.title) {
      if (summary && summary.peer && summary.peer.name && typeof playerIdentityNameNode === 'function') { mounts.title.removeAttribute && mounts.title.removeAttribute('data-i18n'); mounts.title.setAttribute && mounts.title.setAttribute('data-i18n-raw', ''); removeChildren(mounts.title); append(mounts.title, playerIdentityNameNode(summary.peer, { className:'direct-message-peer-name' })); }
      else if (summary && summary.peer && summary.peer.name) setRawText(mounts.title, summary.peer.name);
      else setSystemText(mounts.title, peerUid ? 'direct_message_thread_title' : 'direct_message_title');
    }
    if (mounts.presence) {
      if (summary && summary.peer) setSystemText(mounts.presence, summary.peer.presence === 'online' ? 'direct_message_online' : 'direct_message_offline');
      else setSystemText(mounts.presence, 'direct_message_select_hint');
    }
    if (mounts.avatar) {
      removeChildren(mounts.avatar);
      if (summary && summary.peer && typeof playerIdentityAvatarNode === 'function') {
        try { append(mounts.avatar, playerIdentityAvatarNode(summary.peer, { size:42 })); } catch (_) {}
      }
    }
    if (mounts.card) classToggle(mounts.card, 'thread-open', !!peerUid);
    var messages = mounts.messages;
    if (!messages) return;
    var oldButton = mounts.older;
    Array.prototype.slice.call(messages.children || []).forEach(function (child) { if (child !== oldButton && typeof child.remove === 'function') child.remove(); });
    if (!peerUid) {
      if (oldButton) classAdd(oldButton, 'hidden');
      var select = makeElement('div', 'direct-message-empty'); select.dataset && (select.dataset.directMessageState = '1'); setSystemText(select, isGuestAccount() ? 'direct_message_guest_readonly' : 'direct_message_select_hint'); append(messages, select);
      if (mounts.input) mounts.input.disabled = true;
      if (mounts.send) mounts.send.disabled = true;
      if (mounts.note) setSystemText(mounts.note, 'direct_message_select_hint');
      return;
    }
    var rows = o && o.chatHistory && Array.isArray(o.chatHistory[peerUid]) ? o.chatHistory[peerUid] : [];
    var pending = [];
    if (o && o.chatPending && typeof o.chatPending.forEach === 'function') o.chatPending.forEach(function (item, id) { if (item && String(item.peerUid) === String(peerUid)) pending.push([id, item]); });
    var meta = o && o.chatHistoryMeta && o.chatHistoryMeta[peerUid];
    if (oldButton) {
      var showOlder = !!(meta && meta.hasMore);
      classToggle(oldButton, 'hidden', !showOlder);
      oldButton.disabled = !showOlder || !!(o && o.chatHistoryPending && o.chatHistoryPending[peerUid]);
      if (showOlder) setSystemText(oldButton, o.chatHistoryPending && o.chatHistoryPending[peerUid] ? 'direct_message_loading_older' : 'direct_message_load_older');
    }
    var historyPending = !!(o && o.chatHistoryPending && o.chatHistoryPending[peerUid]);
    if (historyPending && !rows.length && !pending.length) {
      var loading = makeElement('div', 'direct-message-loading'); loading.dataset && (loading.dataset.directMessageState = '1'); setSystemText(loading, 'direct_message_loading_history'); append(messages, loading);
    } else if (!historyPending && !rows.length && !pending.length) {
      var empty = makeElement('div', 'direct-message-empty'); empty.dataset && (empty.dataset.directMessageState = '1'); setSystemText(empty, 'direct_message_no_messages'); append(messages, empty);
    }
    var readThrough = summary && summary.peerReadThroughSeq !== undefined ? String(summary.peerReadThroughSeq) : '0';
    var newestInbound = null;
    rows.forEach(function (message) {
      var bubble = makeElement('div', 'direct-message-bubble' + (getAccount() && message.senderUid === getAccount().uid ? ' mine' : ''));
      bubble.dataset && (bubble.dataset.messageId = String(message.id || ''));
      var body = makeElement('div', 'direct-message-bubble-body'); setRawText(body, message.text || ''); append(bubble, body);
      var metaLine = makeElement('div', 'direct-message-bubble-meta');
      var timestamp = directMessageTimeText(message.createdAt);
      if (timestamp) { var time = makeElement('time'); setRawText(time, timestamp); time.dateTime = new Date(Number(message.createdAt)).toISOString(); append(metaLine, time); }
      if (getAccount() && message.senderUid === getAccount().uid) { var state = makeElement('span'); setSystemText(state, 'direct_message_sent'); append(metaLine, state); }
      if (metaLine.childNodes && metaLine.childNodes.length) append(bubble, metaLine);
      append(messages, bubble);
      if (getAccount() && String(message.recipientUid || '') === String(getAccount().uid || '') && message.seq !== undefined && String(message.seq).localeCompare(readThrough, undefined, { numeric: true }) > 0) newestInbound = message;
    });
    if (newestInbound && o && typeof o.markChatRead === 'function') {
      try { o.markChatRead(peerUid, newestInbound.seq); } catch (_) {}
    }
    pending.forEach(function (entry) {
      var id = entry[0], item = entry[1];
      if (rows.some(function (row) { return row && row.id === item.messageId; })) return;
      var bubble = makeElement('div', 'direct-message-bubble mine pending');
      var body = makeElement('div', 'direct-message-bubble-body'); setRawText(body, item.text || ''); append(bubble, body);
      var metaLine = makeElement('div', 'direct-message-bubble-meta');
      var pendingTime = directMessageTimeText(item.createdAt); if (pendingTime) { var time = makeElement('time'); setRawText(time, pendingTime); time.dateTime = new Date(Number(item.createdAt)).toISOString(); append(metaLine, time); }
      var state = makeElement('span'); setSystemText(state, item.status === 'failed' ? 'direct_message_retry' : 'direct_message_sending'); append(metaLine, state);
      var retry = makeElement('button', 'direct-message-retry'); retry.type = 'button'; retry.disabled = item.status !== 'failed'; setSystemText(retry, item.status === 'failed' ? 'direct_message_retry' : 'direct_message_sending');
      if (item.status === 'failed' && retry.addEventListener) retry.addEventListener('click', function () { if (o && typeof o.sendChatMessage === 'function') o.sendChatMessage(peerUid, item.text, id); });
      if (item.status === 'failed') append(metaLine, retry); append(bubble, metaLine); append(messages, bubble);
    });
    var canSend = !!(o && o.connected && o._authenticated && getAccount() && !isGuestAccount() && summary && summary.peer && summary.peer.relationship === 'friends');
    if (mounts.input) {
      mounts.input.disabled = !canSend;
      var draft = o && o.chatDrafts && typeof o.chatDrafts.get === 'function' ? o.chatDrafts.get(String(peerUid)) || '' : '';
      if (doc() && doc().activeElement !== mounts.input && mounts.input.value !== draft) mounts.input.value = draft;
      mounts.input.placeholder = translate(canSend ? 'direct_message_placeholder' : 'direct_message_read_only');
    }
    if (mounts.send) mounts.send.disabled = !canSend;
    if (mounts.note) setSystemText(mounts.note, canSend ? 'direct_message_enter_hint' : 'direct_message_read_only');
    if (mounts.status) {
      if (directState.errorKey) setSystemText(mounts.status, directState.errorKey);
      else setSystemText(mounts.status, canSend ? 'direct_message_ready' : 'direct_message_read_only');
      mounts.status.setAttribute && mounts.status.setAttribute('role', 'status');
      mounts.status.setAttribute && mounts.status.setAttribute('aria-live', 'polite');
    }
  }

  function renderDirectMessage() {
    if (!directState.open) return false;
    var mounts = ensureDirectStructure();
    if (!mounts) return false;
    renderDirectList(mounts);
    renderDirectThread(mounts);
    return true;
  }

  function selectDirectPeer(peerUid) {
    syncAccount();
    var id = String(peerUid || ''); if (!id) return false;
    var mountsBefore = ensureDirectStructure();
    directState.peerUid = id;
    var o = getOnline();
    if (o) o.chatActivePeerUid = id;
    if (o && typeof o.requestChatHistory === 'function') o.requestChatHistory(id);
    renderDirectMessage();
    var mounts = ensureDirectStructure();
    runDirectSurfaceMotion('thread', mounts, mountsBefore && mountsBefore.list, mounts && mounts.thread);
    if (mounts && mounts.input && typeof mounts.input.focus === 'function') {
      try { mounts.input.focus({ preventScroll: true }); } catch (_) { mounts.input.focus(); }
    }
    return true;
  }

  function loadOlderDirectMessages() {
    var o = getOnline();
    var peerUid = directState.peerUid;
    if (!o || !peerUid || typeof o.requestChatHistory !== 'function') return false;
    var meta = o.chatHistoryMeta && o.chatHistoryMeta[peerUid];
    if (!meta || !meta.hasMore || !meta.nextBeforeSeq) return false;
    var mounts = ensureDirectStructure();
    if (mounts && mounts.messages) directState.preserveScroll = { height: Number(mounts.messages.scrollHeight || 0), top: Number(mounts.messages.scrollTop || 0) };
    return !!o.requestChatHistory(peerUid, meta.nextBeforeSeq);
  }

  function sendDirectMessage(text, clientMessageId) {
    syncAccount();
    var o = getOnline();
    var peerUid = directState.peerUid;
    var value = String(text === undefined || text === null ? '' : text);
    if (!o || !peerUid || !value.trim() || typeof o.sendChatMessage !== 'function') return false;
    var id = o.sendChatMessage(peerUid, value, clientMessageId);
    renderDirectMessage();
    return !!id;
  }

  function openDirect(input) {
    input = typeof input === 'string' ? { peerUid: input } : (input && typeof input === 'object' ? input : {});
    if (input.mountIds || input.mount || input.mounts) directInit(input);
    else if (!directState.initialized) directInit();
    syncAccount();
    directState.stageBusy = gameStageBusy();
    if (directState.stageBusy) {
      directState.errorKey = 'direct_message_game_stage_busy';
      try { if (typeof toast === 'function') toast(translate(directState.errorKey)); } catch (_) {}
      return false;
    }
    var mounts = ensureDirectStructure();
    if (!mounts) return false;
    if (directState.open) {
      if (input.peerUid) selectDirectPeer(input.peerUid);
      return true;
    }
    directState.open = true;
    directState.errorKey = null;
    directState.opener = input.opener || input.source || (doc() && doc().activeElement);
    if (input.peerUid) directState.peerUid = String(input.peerUid);
    var o = getOnline();
    if (o && directState.peerUid) o.chatActivePeerUid = directState.peerUid;
    classRemove(mounts.root, 'hidden');
    classRemove(mounts.root, 'direct-message-closing');
    mounts.root.setAttribute && mounts.root.setAttribute('aria-hidden', 'false');
    classToggle(mounts.card, 'thread-open', !!directState.peerUid);
    acquireDirectLock(mounts.root);
    installDirectA11y(mounts);
    if (o && typeof o.requestChatList === 'function') o.requestChatList();
    if (o && directState.peerUid && typeof o.requestChatHistory === 'function') o.requestChatHistory(directState.peerUid);
    renderDirectMessage();
    runDirectSurfaceMotion('open', mounts, null, mounts.card);
    var initial = directState.peerUid && mounts.input && !mounts.input.disabled ? mounts.input : mounts.close || mounts.back || focusableWithin(mounts.card)[0];
    if (initial && typeof initial.focus === 'function') { try { initial.focus({ preventScroll: true }); } catch (_) { initial.focus(); } }
    return true;
  }

  function closeDirectInternal(reason, restoreFocus) {
    if (!directState.open) return false;
    var mounts = ensureDirectStructure();
    directState.open = false;
    if (directState.keydown && doc() && doc().removeEventListener) doc().removeEventListener('keydown', directState.keydown, true);
    var root = directRoot();
    if (root && directState.backdropClick && root.removeEventListener) root.removeEventListener('click', directState.backdropClick);
    directState.keydown = null;
    directState.backdropClick = null;
    releaseDirectLock();
    if (global && global.GhostSurfaceMotion && typeof global.GhostSurfaceMotion.settle === 'function') {
      try { global.GhostSurfaceMotion.settle('direct-message', reason || 'close'); } catch (_) {}
    }
    if (root) { classRemove(root, 'hidden'); classAdd(root, 'direct-message-closing'); root.setAttribute && root.setAttribute('aria-hidden', 'true'); }
    var finishClose = function () { if (root) { classRemove(root, 'direct-message-closing'); classAdd(root, 'hidden'); } };
    if (!runDirectSurfaceMotion('close', mounts, mounts && mounts.card, null, finishClose)) finishClose();
    var o = getOnline();
    if (o) o.chatActivePeerUid = null;
    var previous = directState.opener;
    directState.opener = null;
    if (restoreFocus !== false && previous && previous.isConnected !== false && typeof previous.focus === 'function') {
      try { previous.focus({ preventScroll: true }); } catch (_) { try { previous.focus(); } catch (_) {} }
    }
    if (reason === 'account' || reason === 'blocked') directState.peerUid = null;
    return true;
  }

  function closeDirect(reason) { return closeDirectInternal(reason || 'user', true); }

  function acceptDirect(packet) {
    syncAccount();
    var payload = statePacketPayload(packet);
    var type = packetType(packet);
    if (!type || !payload) return false;
    if (!accountPacketIsCurrent(packet, payload, directState.accountEpoch)) return false;
    if (type === 'account_changed' || type === 'logout') { directState.accountEpoch += 1; closeDirectInternal('account', false); return true; }
    if (['chat_state', 'chat_history', 'chat_message', 'chat_send_ok', 'chat_read_ok', 'chat_error'].indexOf(type) < 0) return false;
    if (!directState.open) return true;
    if (type === 'chat_error') {
      var reason = String(payload.reason || 'server_unavailable');
      directState.errorKey = directErrorKey(reason);
    } else if (type !== 'chat_error') {
      directState.errorKey = null;
    }
    renderDirectMessage();
    restoreDirectScroll();
    return true;
  }

  function restoreDirectScroll() {
    var preserve = directState.preserveScroll;
    directState.preserveScroll = null;
    if (!preserve) return;
    var mounts = ensureDirectStructure(); if (!mounts || !mounts.messages) return;
    var apply = function () { try { mounts.messages.scrollTop = Math.max(0, Number(mounts.messages.scrollHeight || 0) - preserve.height + preserve.top); } catch (_) {} };
    if (typeof global.requestAnimationFrame === 'function') global.requestAnimationFrame(apply); else apply();
  }

  function directReset() {
    directState.accountEpoch += 1;
    closeDirectInternal('reset', false);
    directState.peerUid = null;
    directState.errorKey = null;
    directState.opener = null;
    return true;
  }

  var Playline = {
    init: playlineInit,
    open: playlineOpen,
    publish: playlinePublish,
    prefill: playlinePrefill,
    accept: acceptPlayline,
    reset: playlineReset,
  };

  var DirectMessage = {
    init: directInit,
    open: openDirect,
    close: closeDirect,
    accept: acceptDirect,
    reset: directReset,
  };

  if (global) {
    global.Playline = Playline;
    global.DirectMessage = DirectMessage;
    global.Playline.open = playlineOpen;
    global.Playline.publish = playlinePublish;
    global.Playline.prefill = playlinePrefill;
    global.Playline.accept = acceptPlayline;
    global.Playline.reset = playlineReset;
    global.DirectMessage.open = openDirect;
    global.DirectMessage.close = closeDirect;
    global.DirectMessage.accept = acceptDirect;
    global.DirectMessage.reset = directReset;
  }
  /* Browser globals declared with `const` are not always properties on
   * window, so expose the presenter names explicitly for later modules. */
  try { if (typeof window !== 'undefined') { window.Playline = Playline; window.DirectMessage = DirectMessage; } } catch (_) {}
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
