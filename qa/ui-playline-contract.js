'use strict';

/* Playline/Direct Message presenter contract.  This test intentionally uses
 * a tiny DOM and a fake `online` facade: transport and persistence remain
 * owned by the existing websocket/server modules. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '07-playline.js'), 'utf8');
const i18nSource = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '00-i18n.js'), 'utf8');
const template = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : ' :: ' + detail));
  if (!ok) failures.push(name);
}

check('small presenter interface is explicit',
  /global\.Playline\.open\s*=/.test(source) && /global\.Playline\.publish\s*=/.test(source) &&
  /global\.Playline\.prefill\s*=/.test(source) && /global\.Playline\.accept\s*=/.test(source) &&
  /global\.Playline\.reset\s*=/.test(source) && /global\.DirectMessage\.open\s*=/.test(source) &&
  /global\.DirectMessage\.close\s*=/.test(source) && /global\.DirectMessage\.accept\s*=/.test(source) &&
  /global\.DirectMessage\.reset\s*=/.test(source));
check('DM keeps the existing wire facade and does not create dm_* wire',
  ['requestChatList', 'requestChatHistory', 'sendChatMessage', 'markChatRead', 'chatState', 'chatHistory', 'chatPending', 'chatDrafts'].every(key => source.includes(key)) &&
  !/type\s*:\s*['"]dm_[^'"]+['"]/.test(source));
check('DM has one presenter-owned dialog and no stale page template',
  /id="direct-message-overlay-root"/.test(template) &&
  !/id="direct-message-dialog-template"|id="player-chat-shell"|id="chat-composer"/.test(template));
check('raw player/content text uses textContent and i18n raw marker',
  /function setRawText[\s\S]*?textContent/.test(source) && /data-i18n-raw/.test(source) && !/\.innerHTML\s*=/.test(source));
check('responsive/a11y CSS hooks are presenter-owned',
  /@media\s*\(max-width:\s*640px\)/.test(source) && /min-height:44px/.test(source) &&
  /safe-area-inset-bottom/.test(source) && /prefers-reduced-motion/.test(source) &&
  /direct-message-back\.hidden\s*\{\s*display:none!important/.test(source));
check('DM server errors reuse localized direct-chat keys with a generic fallback',
  /function directErrorKey\(reason\)/.test(source) && /chat_error_generic/.test(source) &&
  /directState\.errorKey\s*=\s*directErrorKey\(reason\)/.test(source));
check('account epoch guards late packets',
  /accountEpoch/.test(source) && /accountPacketIsCurrent/.test(source) && /pending\.get\(clientPostId\)/.test(source));
check('Playline uses keyed post nodes', /new Map\(\)/.test(source) && /postMapFor\(tab\)/.test(source) && /data-playline-card/.test(source));
check('committed language changes rerender formatted Playline values from stable IDs',
  /dispatchEvent\(new Event\(['"]languagechange['"]\)\)/.test(i18nSource) &&
  /target\.addEventListener\(['"]languagechange['"][\s\S]*renderPlaylineState/.test(source));

function makeRuntime() {
  const documentListeners = new Map();
  const windowListeners = new Map();
  let document;

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
      this.tabIndex = ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName) ? 0 : -1;
      this.isConnected = false;
      this._text = '';
      this.value = '';
      this.scrollHeight = 0;
      this.scrollTop = 0;
      this.classList = classList(this);
    }

    get firstChild() { return this.children[0] || null; }
    get textContent() { return this._text + this.children.map(child => child.textContent || '').join(''); }
    set textContent(value) {
      this._text = String(value === undefined || value === null ? '' : value);
      this.children.slice().forEach(child => child.remove());
    }
    get innerHTML() { return this.textContent; }
    set innerHTML(value) { this.textContent = value; }
    appendChild(child) {
      if (!child) return child;
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
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    setAttribute(name, value) {
      this.attributes[String(name)] = String(value);
      if (name === 'id') this.id = String(value);
      if (name === 'tabindex') this.tabIndex = Number(value);
      if (String(name).startsWith('data-')) this.dataset[String(name).slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
    removeAttribute(name) { delete this.attributes[String(name)]; if (name === 'id') this.id = ''; }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { const set = this.listeners.get(type); if (set) set.delete(listener); }
    dispatch(type, event = {}) {
      const payload = Object.assign({ target: this, preventDefault() { this.defaultPrevented = true; } }, event);
      [...(this.listeners.get(type) || [])].forEach(listener => listener(payload));
      return payload;
    }
    focus() { document.activeElement = this; this.focusCount = (this.focusCount || 0) + 1; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      const found = [];
      const visit = parent => parent.children.forEach(child => { if (matches(child, selector)) found.push(child); visit(child); });
      visit(this);
      return found;
    }
  }

  function classList(node) {
    return {
      add: (...values) => values.forEach(value => { if (!classList(node).contains(value)) node.className = (node.className + ' ' + value).trim(); }),
      remove: (...values) => { const drop = new Set(values); node.className = node.className.split(/\s+/).filter(value => value && !drop.has(value)).join(' '); },
      contains: value => node.className.split(/\s+/).includes(value),
      toggle: (value, force) => { const next = force === undefined ? !classList(node).contains(value) : !!force; if (next) classList(node).add(value); else classList(node).remove(value); return next; },
    };
  }

  function matches(node, selector) {
    return String(selector).split(',').some(raw => {
      let value = raw.trim();
      value = value.replace(/:not\(\[disabled\]\)|:not\(\[tabindex="-1"\]\)/g, '');
      const id = value.match(/^#([A-Za-z0-9_-]+)$/);
      if (id) return node.id === id[1];
      const attr = value.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      if (attr) return node.getAttribute(attr[1]) !== null && (attr[2] === undefined || node.getAttribute(attr[1]) === attr[2]);
      const cls = value.match(/^\.([A-Za-z0-9_-]+)$/);
      if (cls) return node.className.split(/\s+/).includes(cls[1]);
      const tag = value.match(/^([A-Za-z0-9-]+)/);
      return !!tag && node.tagName === tag[1].toUpperCase() && (!value.includes('[disabled]') || !node.disabled);
    });
  }

  const body = new Node('body'); body.setConnected(true);
  const head = new Node('head'); head.setConnected(true);
  document = {
    body, head, activeElement: null,
    createElement: tag => new Node(tag),
    getElementById: id => {
      const find = root => { if (root.id === id) return root; for (const child of root.children) { const hit = find(child); if (hit) return hit; } return null; };
      return find(body) || find(head);
    },
    querySelector: selector => body.querySelector(selector),
    querySelectorAll: selector => body.querySelectorAll(selector),
    addEventListener(type, listener) { if (!documentListeners.has(type)) documentListeners.set(type, new Set()); documentListeners.get(type).add(listener); },
    removeEventListener(type, listener) { const set = documentListeners.get(type); if (set) set.delete(listener); },
    dispatchKey(key, shiftKey = false) { const event = { key, shiftKey, target: this.activeElement, prevented: 0, preventDefault() { this.prevented++; } }; [...(documentListeners.get('keydown') || [])].forEach(listener => listener(event)); return event; },
    listenerCount(type) { return (documentListeners.get(type) || new Set()).size; },
  };
  body.classList = classList(body); head.classList = classList(head);

  const win = {
    document,
    addEventListener(type, listener) { if (!windowListeners.has(type)) windowListeners.set(type, new Set()); windowListeners.get(type).add(listener); },
    removeEventListener(type, listener) { const set = windowListeners.get(type); if (set) set.delete(listener); },
    requestAnimationFrame: fn => { fn(); return 1; },
  };
  const sent = [];
  const online = {
    connected: true, _authenticated: true, cacheOwnerUid: 'u1',
    chatState: { conversations: [{ peer: { uid: 'u2', name: 'Friend', relationship: 'friends', presence: 'online' }, unreadCount: 0 }], unreadTotal: 0 },
    chatHistory: {}, chatHistoryMeta: {}, chatHistoryPending: {}, chatPending: new Map(), chatDrafts: new Map(), chatActivePeerUid: null,
    requestChatList() { sent.push({ facade: 'chat_list' }); return true; },
    requestChatHistory(peerUid, before) { sent.push({ facade: 'chat_history', peerUid, before }); this.chatHistoryPending[peerUid] = true; return true; },
    sendChatMessage(peerUid, text, id) { const messageId = id || 'chat_client_1'; this.chatPending.set(messageId, { peerUid, text, status: 'sending' }); sent.push({ facade: 'chat_send', peerUid, text, id: messageId }); return messageId; },
    markChatRead(peerUid, seq) { sent.push({ facade: 'chat_read', peerUid, seq }); return true; },
    send(message) { sent.push(message); return true; },
    resetAccountCaches() { this.chatState = { conversations: [], unreadTotal: 0 }; this.chatHistory = {}; this.chatPending = new Map(); this.chatDrafts = new Map(); },
  };
  const sandbox = { console, document, window: win, account: { uid: 'u1', authToken: 'token-1', registered: true }, online, t: key => key, setTimeout, clearTimeout, Intl, Map, Set, Date, Math, isFinite, avatarStageNode: () => new Node('span') };
  Object.assign(win, sandbox);
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: '07-playline.js' });
  return { context, sandbox, window: win, document, body, sent, online, Node };
}

try {
  const runtime = makeRuntime();
  const playlineRoot = new runtime.Node('main'); playlineRoot.id = 'playline-root'; runtime.body.appendChild(playlineRoot);
  const dmRoot = new runtime.Node('div'); dmRoot.id = 'direct-message-overlay-root'; runtime.body.appendChild(dmRoot);
  const opener = new runtime.Node('button'); runtime.body.appendChild(opener); opener.focus();
  const Playline = runtime.window.Playline;
  const DirectMessage = runtime.window.DirectMessage;
  check('runtime exposes the requested objects', !!Playline && !!DirectMessage && ['open', 'publish', 'prefill', 'accept', 'reset'].every(key => typeof Playline[key] === 'function') && ['open', 'close', 'accept', 'reset'].every(key => typeof DirectMessage[key] === 'function'));
  check('missing mount fails closed', Playline.open({ mountIds: { root: 'missing-root' } }) === false);

  Playline.init({ mountIds: { root: 'playline-root' } });
  Playline.open({ filter: 'all' });
  check('Playline list uses the existing online transport seam', runtime.sent.some(item => item.type === 'playline_list' && item.payload.filter === 'all'));
  Playline.accept({ type: 'playline_state', payload: { filter: 'all', posts: [{ postId: 'post_0001', author: { uid: 'u2', name: '<Friend>' }, content: { kind: 'text', text: '<b>safe</b>' }, createdAt: Date.now() }], hasMore: true, nextBeforeSeq: '1' } });
  const feed = runtime.document.querySelector('[data-playline-feed]');
  const firstCard = feed && feed.querySelector('[data-playline-card]');
  const raw = firstCard && firstCard.querySelector('.playline-card-body');
  check('post body is rendered as raw text', !!raw && raw.textContent === '<b>safe</b>' && raw.getAttribute('data-i18n-raw') !== null);
  Playline.accept({ type: 'playline_state', payload: { filter: 'all', posts: [{ postId: 'post_0001', author: { uid: 'u2', name: '<Friend>' }, content: { kind: 'text', text: 'updated' }, createdAt: Date.now() }], hasMore: false } });
  check('same post keeps keyed card identity', !!firstCard && feed.querySelector('[data-playline-card]') === firstCard);
  Playline.prefill({ kind: 'game_share', gameId: 'gomoku' });
  check('game prefill stores an intent without inventing a card', !!runtime.document.querySelector('[data-prefill-kind="game_share"]'));
  const oldEpoch = 0;
  runtime.sandbox.account = { uid: 'u9', authToken: 'token-9', registered: true };
  const acceptedLate = Playline.accept({ type: 'playline_state', accountEpoch: oldEpoch, payload: { filter: 'all', posts: [{ postId: 'late_0001', content: { kind: 'text', text: 'late' } }] } });
  check('late Playline packet cannot cross an account epoch', acceptedLate === false && !feed.querySelector('[data-post-id="late_0001"]'));

  runtime.sandbox.account = { uid: 'u1', authToken: 'token-1', registered: true };
  runtime.online.chatState = { conversations: [{ peer: { uid: 'u2', name: 'Friend', relationship: 'friends', presence: 'online' }, unreadCount: 0 }], unreadTotal: 0 };
  runtime.online.cacheOwnerUid = 'u1';
  DirectMessage.init({ mountIds: { root: 'direct-message-overlay-root' } });
  runtime.online.chatState = { conversations: [{ peer: { uid: 'u2', name: 'Friend', relationship: 'friends', presence: 'online' }, unreadCount: 0 }], unreadTotal: 0 };
  opener.focus();
  DirectMessage.open({ opener });
  const emptyDmDialog = runtime.document.querySelector('[data-direct-message-dialog]');
  const emptyDmClose = runtime.document.querySelector('[data-direct-message-close]');
  const emptyDmComposer = runtime.document.querySelector('[data-direct-message-composer]');
  const emptyDmOlder = runtime.document.querySelector('[data-direct-message-load-older]');
  check('DM empty state has icon controls and no ghost composer/pager',
    !!emptyDmDialog && !!emptyDmClose && emptyDmClose.textContent === '×' &&
    emptyDmClose.getAttribute('aria-label') === 'direct_message_close' &&
    !!emptyDmComposer && emptyDmComposer.classList.contains('hidden') &&
    !!emptyDmOlder && emptyDmOlder.classList.contains('hidden'));
  DirectMessage.accept({ type: 'chat_state', payload: runtime.online.chatState });
  const emptyDmMessages = runtime.document.querySelector('[data-direct-message-messages]');
  const emptyDmList = runtime.document.querySelector('[data-direct-message-list]');
  check('DM repeated state packets do not accumulate duplicate empty nodes',
    !!emptyDmMessages && emptyDmMessages.querySelectorAll('.direct-message-empty').length === 1 &&
    !!emptyDmList && emptyDmList.querySelectorAll('.direct-message-empty').length === 0);
  DirectMessage.close('test');
  check('DM opens as a named dialog and uses chat facades', DirectMessage.open({ peerUid: 'u2', opener }) && runtime.document.querySelector('[data-direct-message-dialog]').getAttribute('role') === 'dialog' && runtime.sent.some(item => item.facade === 'chat_list') && runtime.sent.some(item => item.facade === 'chat_history'));
  const dmDialog = runtime.document.querySelector('[data-direct-message-dialog]');
  const dmInput = runtime.document.querySelector('[data-direct-message-input]');
  check('DM initial focus is the composer', runtime.document.activeElement === dmInput);
  runtime.online.chatHistory.u2 = [{ id: 'msg_0001', seq: '1', senderUid: 'u2', recipientUid: 'u1', text: '<img onerror=x>' }];
  runtime.online.chatHistoryPending.u2 = false;
  DirectMessage.accept({ type: 'chat_history', payload: { peer: { uid: 'u2' }, messages: runtime.online.chatHistory.u2 } });
  const bubble = runtime.document.querySelector('.direct-message-bubble');
  const bubbleBody = runtime.document.querySelector('.direct-message-bubble-body');
  check('DM message body is raw text from canonical chat history', !!bubble && !!bubbleBody && bubbleBody.textContent === '<img onerror=x>' && bubbleBody.getAttribute('data-i18n-raw') !== null && !bubbleBody.querySelector('img'));
  const focusables = dmDialog.querySelectorAll('button,textarea');
  if (focusables.length) focusables[focusables.length - 1].focus();
  const tab = runtime.document.dispatchKey('Tab');
  check('DM Tab trap wraps focus', tab.prevented === 1 && runtime.document.activeElement === focusables[0]);
  const esc = runtime.document.dispatchKey('Escape');
  check('DM Escape closes, unlocks, and restores opener focus', esc.prevented === 1 && runtime.document.activeElement === opener && dmRoot.classList.contains('hidden'));
  runtime.body.classList.add('game-active');
  check('DM fails closed while Game Stage owns the viewport', DirectMessage.open({ peerUid: 'u2', opener }) === false);
} catch (error) {
  check('presenter VM lifecycle executes', false, error && error.stack || String(error));
}

if (failures.length) {
  console.error('UI_PLAYLINE_CONTRACT_FAILED: ' + failures.join('、'));
  process.exit(1);
}
console.log('UI_PLAYLINE_CONTRACT_ALL_PASS');
