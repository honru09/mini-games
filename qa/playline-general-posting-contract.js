'use strict';

/* Playline general-posting P0 contract.
 *
 * This stays presenter-only: it proves that ordinary text is the default
 * publishing path while the existing canonical game/result/record intents
 * remain optional, mutually exclusive attachments.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '07-playline.js'), 'utf8');
const failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || !detail ? '' : ' :: ' + detail));
  if (!ok) failures.push(name);
}

function makeRuntime() {
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
      this._text = '';
      this.value = '';
      this.disabled = false;
      this.tabIndex = ['BUTTON', 'INPUT', 'TEXTAREA'].includes(this.tagName) ? 0 : -1;
      this.classList = classList(this);
    }
    get firstChild() { return this.children[0] || null; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value === undefined || value === null ? '' : value); this.children.slice().forEach(child => child.remove()); }
    appendChild(child) { if (child.parentNode) child.remove(); child.parentNode = this; child.parentElement = this; this.children.push(child); return child; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; this.parentElement = null; }
    setAttribute(name, value) {
      const key = String(name); this.attributes[key] = String(value);
      if (key === 'id') this.id = String(value);
      if (key === 'tabindex') this.tabIndex = Number(value);
      if (key.indexOf('data-') === 0) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    getAttribute(name) { const key = String(name); return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; }
    removeAttribute(name) { delete this.attributes[String(name)]; }
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
    dispatch(type, event = {}) { const payload = Object.assign({ target: this, preventDefault() { this.defaultPrevented = true; } }, event); [...(this.listeners.get(type) || [])].forEach(listener => listener(payload)); return payload; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) { const found = []; const visit = parent => parent.children.forEach(child => { if (matches(child, selector)) found.push(child); visit(child); }); visit(this); return found; }
  }
  function classList(node) {
    return {
      add: (...values) => values.forEach(value => { if (!classList(node).contains(value)) node.className = (node.className + ' ' + value).trim(); }),
      remove: (...values) => { const absent = new Set(values); node.className = node.className.split(/\s+/).filter(value => value && !absent.has(value)).join(' '); },
      contains: value => node.className.split(/\s+/).includes(value),
      toggle: (value, force) => { const next = force === undefined ? !classList(node).contains(value) : !!force; if (next) classList(node).add(value); else classList(node).remove(value); return next; },
    };
  }
  function matches(node, selector) {
    return String(selector).split(',').some(part => {
      const value = part.trim();
      const id = value.match(/^#([A-Za-z0-9_-]+)$/); if (id) return node.id === id[1];
      const attr = value.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/); if (attr) return node.getAttribute(attr[1]) !== null && (attr[2] === undefined || node.getAttribute(attr[1]) === attr[2]);
      const cls = value.match(/^\.([A-Za-z0-9_-]+)$/); if (cls) return node.classList.contains(cls[1]);
      const tag = value.match(/^([A-Za-z0-9-]+)/); return !!tag && node.tagName === tag[1].toUpperCase();
    });
  }
  const body = new Node('body');
  const head = new Node('head');
  document = {
    body, head, activeElement: null,
    createElement: tag => new Node(tag),
    getElementById(id) { const find = parent => { if (parent.id === id) return parent; for (const child of parent.children) { const hit = find(child); if (hit) return hit; } return null; }; return find(body) || find(head); },
    querySelector: selector => body.querySelector(selector),
    querySelectorAll: selector => body.querySelectorAll(selector),
  };
  const sent = [];
  const online = {
    connected: true, _authenticated: true,
    publishPlayline(intent) { sent.push(intent); return true; },
    requestPlayline() { return true; },
    supportsCapability() { return true; },
  };
  const sandbox = {
    console, document, account: { uid: 'u_general', authToken: 'token-general', registered: true }, online,
    t: key => key, Map, Set, Date, Math, Intl, isFinite,
    window: null,
  };
  sandbox.window = sandbox;
  vm.runInContext(source, vm.createContext(sandbox), { filename: '07-playline.js' });
  return { Node, body, document, online, sent, sandbox, Playline: sandbox.Playline };
}

function add(runtime, tag, id, className, parent) {
  const node = new runtime.Node(tag); if (id) node.setAttribute('id', id); if (className) node.className = className; (parent || runtime.body).appendChild(node); return node;
}

check('general-posting presenter stays within the existing four content kinds',
  /text\s*:\s*'playline_kind_text'/.test(source) && /game_share/.test(source) && /result_share/.test(source) && /record_share/.test(source) &&
  !/image_share|video_share|media_share/.test(source));
check('general-posting hooks are explicit and localized',
  /data-playline-text-first/.test(source) && /data-playline-attachment-control/.test(source) &&
  /playline_general_intro/.test(source) && /playline_general_composer_hint/.test(source) && /playline_general_empty_body/.test(source));
check('attachment prefill is cleared when a player starts a text update',
  /clearOptionalPrefillForText/.test(source) && /playlineState\.prefill\.kind !== 'text'/.test(source));
check('cards expose a text-versus-attachment hierarchy without HTML rendering',
  /data-playline-kind/.test(source) && /playline-card--text/.test(source) && /playline-card--attachment/.test(source) && !/\.innerHTML\s*=/.test(source));
check('All/Friends, keyed nodes, deletion/report wiring, and block authority remain presenter-compatible',
  /PLAYLINE_TABS/.test(source) && /postMapFor\(tab\)/.test(source) && /playline_remove_ok/.test(source) && /openReportUserModal/.test(source) &&
  !/blockPlayline|unblockPlayline|playline_block/.test(source));

try {
  const runtime = makeRuntime();
  const heading = add(runtime, 'h1', 'playline-route-title');
  const intro = add(runtime, 'p', 'playline-route-intro');
  const root = add(runtime, 'main', 'playline-root', 'playline-layout');
  const composer = add(runtime, 'form', 'playline-composer', 'playline-composer-form', root);
  const input = add(runtime, 'textarea', 'playline-composer-input', 'nick-input', composer);
  const publish = add(runtime, 'button', 'playline-composer-publish', 'btn btn-primary', composer); publish.type = 'submit';
  const game = add(runtime, 'button', 'btn-playline-share-game', 'btn', composer);
  const result = add(runtime, 'button', 'btn-playline-share-result', 'btn', composer);
  const feedTitle = add(runtime, 'h2', 'playline-feed-title', '', root);
  const tabs = add(runtime, 'div', null, 'playline-tabs', root); tabs.setAttribute('data-playline-tabs', '');
  const all = add(runtime, 'button', 'playline-tab-all', 'playline-tab', tabs); all.setAttribute('data-playline-tab', 'all');
  const friends = add(runtime, 'button', 'playline-tab-friends', 'playline-tab', tabs); friends.setAttribute('data-playline-tab', 'friends');
  const feed = add(runtime, 'section', 'playline-feed', 'playline-feed', root); feed.setAttribute('data-playline-feed', '');
  const status = add(runtime, 'p', 'playline-status', '', root); status.setAttribute('data-playline-status', '');
  const empty = add(runtime, 'div', 'playline-empty', '', root); empty.setAttribute('data-playline-empty', '');
  const error = add(runtime, 'div', 'playline-error', '', root); error.setAttribute('data-playline-error', '');
  const older = add(runtime, 'button', 'playline-load-older', '', root); older.setAttribute('data-playline-load-older', '');
  const side = add(runtime, 'section', null, 'playline-side-card');
  const sideLabel = add(runtime, 'span', null, 'home-card-label', side);
  const sideTitle = add(runtime, 'h2', null, '', side);
  const sideBody = add(runtime, 'p', null, '', side);
  const record = add(runtime, 'button', 'btn-playline-share-record', 'btn', side);

  runtime.Playline.init({ mountIds: { root: 'playline-root' } });
  runtime.Playline.open({ filter: 'all', load: false });
  check('the route, composer, filters, and sidebar put a text update before optional context',
    root.getAttribute('data-playline-text-first') !== null &&
    intro.getAttribute('data-i18n') === 'playline_general_intro' &&
    input.getAttribute('data-i18n-placeholder') === 'playline_general_composer_placeholder' &&
    composer.getAttribute('data-playline-compose-mode') === 'text' &&
    [game, result, record].every(button => button.getAttribute('data-playline-attachment-control') !== null) &&
    tabs.getAttribute('aria-label') === 'playline_general_filter_label' &&
    feedTitle.getAttribute('data-i18n') === 'playline_general_feed_all' &&
    sideLabel.getAttribute('data-i18n') === 'playline_general_optional_label' &&
    sideTitle.getAttribute('data-i18n') === 'playline_general_sidebar_title' &&
    sideBody.getAttribute('data-i18n') === 'playline_general_sidebar_body');
  check('empty state offers a text-first action, not a game-first dead end',
    empty.getAttribute('data-playline-empty-mode') === 'text' &&
    empty.querySelector('[data-playline-empty-copy]').getAttribute('data-i18n') === 'playline_general_empty_body' &&
    !!empty.querySelector('[data-playline-empty-compose]'));

  runtime.Playline.prefill({ kind: 'game_share', gameId: 'gomoku' });
  input.value = 'Looking for a friendly match tonight';
  input.dispatch('input');
  composer.dispatch('submit');
  check('typing intentionally returns to a pure text post instead of silently discarding the draft',
    composer.getAttribute('data-playline-compose-mode') === 'text' && runtime.sent.length === 1 &&
    runtime.sent[0].content.kind === 'text' && runtime.sent[0].content.text === 'Looking for a friendly match tonight');

  runtime.Playline.accept({ type: 'playline_state', payload: { filter: 'all', posts: [
    { postId: 'general_text_0001', author: { uid: 'u_friend', name: '<Friend>' }, content: { kind: 'text', text: '<b>plain text</b>' }, createdAt: Date.now(), actions: { canReport: true } },
    { postId: 'general_game_0001', author: { uid: 'u_friend', name: 'Friend' }, content: { kind: 'game_share', gameId: 'gomoku' }, createdAt: Date.now() },
  ], hasMore: false } });
  const cards = feed.querySelectorAll('[data-playline-card]');
  const textCard = cards.find(card => card.dataset.postId === 'general_text_0001');
  const attachmentCard = cards.find(card => card.dataset.postId === 'general_game_0001');
  const textBody = textCard && textCard.querySelector('.playline-card-body');
  check('text posts are visually primary while their player content remains raw text',
    !!textCard && textCard.classList.contains('playline-card--text') && textCard.getAttribute('data-playline-kind') === 'text' &&
    !!textBody && textBody.textContent === '<b>plain text</b>' && textBody.getAttribute('data-i18n-raw') !== null &&
    !!attachmentCard && attachmentCard.classList.contains('playline-card--attachment') && attachmentCard.getAttribute('data-playline-kind') === 'game_share');

  runtime.sandbox.account = { uid: 'u_test', authToken: 'token-test', registered: true, isTestAdmin: true, testRole: 'test_admin' };
  runtime.Playline.open({ filter: 'all', load: false });
  check('test-admin accounts are blocked by the presenter before publication', publish.disabled === true && runtime.Playline.publish({ audience: 'all', content: { kind: 'text', text: 'forbidden' } }) === null && runtime.sent.length === 1);
} catch (error) {
  check('general-posting presenter runtime executes', false, error && error.stack || String(error));
}

if (failures.length) {
  console.error('PLAYLINE_GENERAL_POSTING_CONTRACT_FAILED: ' + failures.join('、'));
  process.exit(1);
}
console.log('PLAYLINE_GENERAL_POSTING_CONTRACT_ALL_PASS');
