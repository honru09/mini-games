'use strict';

// Profile Modal A11y P1: exercise the public modal entry points with a small
// browser-like DOM. The seam is user-visible dialog behavior, not the
// implementation of the shared helper itself.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const rosterSource = read('public/src/ui/07-roster.js');
const socialSource = read('public/src/core/04-social.js');
const utilsSource = read('public/src/core/01-utils.js');
const templateSource = read('public/index-template.html');
const packageJson = JSON.parse(read('package.json'));

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from < 0 ? 0 : from) : -1;
  return from < 0 ? '' : source.slice(from, to < 0 ? source.length : to);
}

const editorSource = section(rosterSource, 'function openProfileEditor', 'function localLeaderboard');
const achievementsSource = section(socialSource, 'function openAchievementsModal', '/* ---- 我的卡片渲染');
const dialogHelperSource = section(utilsSource, 'function setupAccessibleOverlayDialog', 'function closeVictoryOverlay');
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

function makeRuntime(options) {
  const documentListeners = new Map();
  let document;

  class Node {
    constructor(tag = 'div') {
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
        add: (...values) => values.forEach(value => {
          if (!this.classList.contains(value)) this.className = (this.className + ' ' + value).trim();
        }),
        remove: (...values) => {
          const removed = new Set(values);
          this.className = String(this.className).split(/\s+/).filter(value => value && !removed.has(value)).join(' ');
        },
        contains: value => String(this.className).split(/\s+/).includes(value),
        toggle: (value, force) => {
          const next = force === undefined ? !this.classList.contains(value) : !!force;
          if (next) this.classList.add(value); else this.classList.remove(value);
          return next;
        },
      };
    }

    get textContent() { return this._text + this.children.map(child => child.textContent || '').join(''); }
    set textContent(value) { this._text = String(value === undefined || value === null ? '' : value); this.children.forEach(child => child.setConnected(false)); this.children = []; }
    get innerHTML() { return this.textContent; }
    set innerHTML(value) { this.textContent = value ? String(value) : ''; }
    get firstChild() { return this.children[0] || null; }
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
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) {
      const listeners = this.listeners.get(type);
      if (listeners) listeners.delete(listener);
    }
    dispatch(type, event = {}) {
      const payload = Object.assign({ target: this, preventDefault() { this.defaultPrevented = true; } }, event);
      for (const listener of [...(this.listeners.get(type) || [])]) listener(payload);
      return payload;
    }
    focus() { document.activeElement = this; this.focusCount = (this.focusCount || 0) + 1; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) { return findAll(this, selector); }
  }

  function matches(node, selector) {
    return String(selector).split(',').some(raw => {
      const value = raw.trim().replace(/:not\(\[disabled\]\)|:not\(\[tabindex="-1"\]\)/g, '');
      if (!value) return false;
      if (value.startsWith('.')) return node.classList.contains(value.slice(1));
      if (value === '[href]') return node.getAttribute('href') !== null;
      if (value === '[tabindex]') return node.getAttribute('tabindex') !== null;
      return ['button', 'input', 'select', 'textarea'].includes(value) && node.tagName === value.toUpperCase() && !node.disabled;
    });
  }

  function findAll(root, selector) {
    const found = [];
    const visit = parent => parent.children.forEach(child => {
      if (matches(child, selector)) found.push(child);
      visit(child);
    });
    visit(root);
    return found;
  }

  const body = new Node('body');
  body.setConnected(true);
  document = {
    body,
    activeElement: null,
    createElement: tag => new Node(tag),
    querySelector: selector => body.querySelector(selector),
    querySelectorAll: selector => body.querySelectorAll(selector),
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      const listeners = documentListeners.get(type);
      if (listeners) listeners.delete(listener);
    },
    dispatchKey(key, shiftKey) {
      const event = { key, shiftKey:!!shiftKey, target:document.activeElement, prevented:0, preventDefault() { this.prevented++; } };
      for (const listener of [...(documentListeners.get('keydown') || [])]) listener(event);
      return event;
    },
    listenerCount(type) { return (documentListeners.get(type) || new Set()).size; },
  };

  const scroll = { acquired:0, released:0 };
  const el = (tag, className, text) => {
    const node = new Node(tag);
    node.className = className || '';
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const profile = { uid:'profile-editor-player', name:'Player', avatar:0, coins:0, total:0, played:{} };
  const sandbox = {
    console, document, setTimeout: fn => { fn(); return 1; }, clearTimeout() {},
    el, t:(key, ...args) => key + (args.length ? ':' + args.join('|') : ''),
    account: options && options.account || null,
    profileByUid: uid => uid === profile.uid ? profile : null,
    AVATAR_CATEGORIES: [], AVATAR_COUNT: 1, CURRENCY:'💵', GAME_KEYS: [], SHOP:{ backgrounds:[] },
    avatarCategory: () => 'all', avatarLocked: () => false,
    avatarPickerIds: selected => [Number(selected) || 0],
    avatarCanvas: () => el('span','avatar-canvas','●'),
    currencyAmountText:value=>String(value)+' G Coins',
    currencyAmountNode:(value,options) => el('span','currency-amount',options&&options.formattedText?String(options.formattedText):String(value)),
    formatGamesCount:value=>String(value)+' games',
    saveRoster() {}, syncProfiles() {}, renderMe() {}, renderLeaderboard() {}, toast() {},
    achievementsEarned: () => [], ACHIEVEMENTS:[{ id:'first', icon:'🏆', nameKey:'achievement_first', descKey:'achievement_first_desc' }],
    acquireModalScrollLock(owner) { if (owner.dataset.modalScrollLock !== '1') { owner.dataset.modalScrollLock = '1'; scroll.acquired++; } },
    releaseModalScrollLock(owner) { if (owner.dataset.modalScrollLock === '1') { delete owner.dataset.modalScrollLock; scroll.released++; } },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(dialogHelperSource, context, { filename:'profile-modal-dialog-helper.js' });
  return { context, document, body, Node, scroll };
}

function assertDialogLifecycle(name, runtime, invoke, initialSelector, labelKey, options) {
  const opener = new runtime.Node('button');
  runtime.body.appendChild(opener);
  opener.focus();
  invoke();
  const backdrop = runtime.document.querySelector('.modal-backdrop');
  const card = backdrop && backdrop.children[0];
  const initial = card && card.querySelector(initialSelector);
  const focusables = card && card.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');

  check(name + ' is a named modal dialog', !!card && card.getAttribute('role') === 'dialog' && card.getAttribute('aria-modal') === 'true' && card.getAttribute('aria-label') === labelKey);
  if (options && options.responsiveWidth) check(name + ' leaves width to responsive CSS instead of pinning an inline desktop width', !card.style.width);
  check(name + ' acquires one owner scroll lock and focuses its primary control', runtime.scroll.acquired === 1 && runtime.document.activeElement === initial && runtime.document.listenerCount('keydown') === 1);

  if (focusables && focusables.length) {
    focusables[focusables.length - 1].focus();
    const tab = runtime.document.dispatchKey('Tab');
    check(name + ' Tab wraps from final control to initial control', tab.prevented === 1 && runtime.document.activeElement === focusables[0]);
    const shiftTab = runtime.document.dispatchKey('Tab', true);
    check(name + ' Shift+Tab wraps from initial control to final control', shiftTab.prevented === 1 && runtime.document.activeElement === focusables[focusables.length - 1]);
  } else {
    check(name + ' exposes keyboard-focusable controls', false);
  }

  const esc = runtime.document.dispatchKey('Escape');
  check(name + ' Escape closes, releases once, restores focus, and removes listener', esc.prevented === 1 && !backdrop.isConnected && runtime.scroll.released === 1 && runtime.document.activeElement === opener && runtime.document.listenerCount('keydown') === 0);
  const releasesAfterEscape = runtime.scroll.released;
  backdrop.dispatch('click', { target:backdrop });
  check(name + ' close is idempotent after a stale background event', runtime.scroll.released === releasesAfterEscape && runtime.document.activeElement === opener && runtime.document.listenerCount('keydown') === 0);

  opener.focus();
  invoke();
  const backgroundClosable = runtime.document.querySelector('.modal-backdrop');
  backgroundClosable.dispatch('click', { target:backgroundClosable });
  check(name + ' background click closes and restores focus', !backgroundClosable.isConnected && runtime.document.activeElement === opener && runtime.document.listenerCount('keydown') === 0);

  return opener;
}

function assertExplicitClose(name, runtime, invoke, opener, buttonLabels) {
  for (const label of buttonLabels) {
    opener.focus();
    invoke();
    const backdrop = runtime.document.querySelector('.modal-backdrop');
    const card = backdrop && backdrop.children[0];
    const button = (card && card.querySelectorAll('button')).find(node => node.textContent === label);
    const releasesBefore = runtime.scroll.released;
    if (button) button.dispatch('click');
    check(name + ' explicit ' + label + ' action uses the same close lifecycle',
      !!button && !backdrop.isConnected && runtime.scroll.released === releasesBefore + 1 && runtime.document.activeElement === opener && runtime.document.listenerCount('keydown') === 0);
  }
}

check('Profile editor canonical source uses the shared dialog and scroll-lock lifecycle',
  editorSource.includes('setupAccessibleOverlayDialog') && editorSource.includes('acquireModalScrollLock') && editorSource.includes('releaseModalScrollLock'));
check('Achievements canonical source uses the shared dialog and scroll-lock lifecycle',
  achievementsSource.includes('setupAccessibleOverlayDialog') && achievementsSource.includes('acquireModalScrollLock') && achievementsSource.includes('releaseModalScrollLock'));
check('Profile modal CSS supplies dedicated 44px and narrow-screen dialog treatment',
  /\.profile-editor-card[\s\S]*?\.achievements-modal-card/.test(templateSource) &&
  /\.profile-editor-card[\s\S]*?min-height:44px/.test(templateSource) &&
  /@media\(max-width:640px\)\{[\s\S]*?\.profile-editor-card/.test(templateSource));
check('pretest executes the Profile Modal A11y contract before profile/social regressions',
  (() => {
    const pretest = String(packageJson.scripts && packageJson.scripts.pretest || '');
    const own = pretest.indexOf('qa/profile-modal-a11y-contract.js');
    const profile = pretest.indexOf('qa/ui-profile-social-contract.js');
    return own >= 0 && profile > own;
  })());

try {
  const runtime = makeRuntime({ account:{ uid:'someone-else' } });
  vm.runInContext(editorSource, runtime.context, { filename:'profile-editor.js' });
  const invoke = () => vm.runInContext("openProfileEditor('profile-editor-player')", runtime.context);
  const opener = assertDialogLifecycle('Profile editor', runtime, invoke, 'input', 'profile_edit_title');
  assertExplicitClose('Profile editor', runtime, invoke, opener, ['save','cancel']);
} catch (error) {
  check('Profile editor dynamic dialog contract can execute', false, error && error.stack || String(error));
}

try {
  const runtime = makeRuntime({ account:{ uid:'profile-editor-player' } });
  vm.runInContext(achievementsSource, runtime.context, { filename:'achievements-modal.js' });
  const invoke = () => vm.runInContext('openAchievementsModal()', runtime.context);
  const opener = assertDialogLifecycle('Achievements modal', runtime, invoke, 'button', 'achievements_title', { responsiveWidth:true });
  assertExplicitClose('Achievements modal', runtime, invoke, opener, ['close']);
} catch (error) {
  check('Achievements modal dynamic dialog contract can execute', false, error && error.stack || String(error));
}

if (failures) {
  console.error('PROFILE_MODAL_A11Y_CONTRACT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('PROFILE_MODAL_A11Y_CONTRACT_ALL_PASS');
}
