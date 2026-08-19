'use strict';

/*
 * Runtime-only G Coins contract.  It exercises the owner-cleared manifest
 * resolver without a browser or network: Candidate B is allowed only after
 * an exact manifest/flag check, and every failure remains on P-003/💵.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const core = read('public/src/core/06-assets.js');
const sourceStart = core.indexOf('const ASSET_ROOT');
const sourceEnd = core.indexOf('/*\n * Test-admin presentation', sourceStart);
if (sourceStart < 0 || sourceEnd < 0) throw new Error('G Coins source slice missing');
const source = core.slice(sourceStart, sourceEnd);

let failures = 0;
let assertions = 0;
function check(ok, message) {
  assertions++;
  console.log((ok ? 'PASS ' : 'FAIL ') + message);
  if (!ok) failures++;
}

class FakeClassList {
  constructor(node) { this.node = node; }
  _set() { return new Set(String(this.node.className || '').split(/\s+/).filter(Boolean)); }
  add(...names) { const set = this._set(); names.forEach(name => set.add(name)); this.node.className = [...set].join(' '); }
  remove(...names) { const set = this._set(); names.forEach(name => set.delete(name)); this.node.className = [...set].join(' '); }
  contains(name) { return this._set().has(name); }
}

class FakeNode {
  constructor(tag, className, text) {
    this.tagName = String(tag).toUpperCase();
    this.className = className || '';
    this.textContent = text == null ? '' : String(text);
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.parentNode = null;
    this.src = '';
    this.srcset = '';
    this.sizes = '';
    this.classList = new FakeClassList(this);
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
}

function makeContext(options = {}) {
  const values = new Map();
  if (Object.prototype.hasOwnProperty.call(options, 'flag')) values.set('mg_art_gcoins_p1_v1', options.flag);
  let fetchCalls = 0;
  const storage = {
    getItem(key) {
      if (options.storageThrows) throw new Error('storage unavailable');
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const fetch = async () => {
    fetchCalls++;
    if (options.fetchThrows) throw new Error('manifest unavailable');
    return {
      ok: options.fetchOk !== false,
      json: async () => options.manifest || manifest,
    };
  };
  const context = {
    console,
    Promise,
    Map,
    Set,
    Object,
    String,
    Number,
    Math,
    RegExp,
    JSON,
    Error,
    localStorage: storage,
    fetch,
    el: (tag, className, text) => new FakeNode(tag, className, text),
    t: key => ({ currency_name: 'G Coins', currency_aria: 'G Coins test aria' }[key] || key),
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'g-coins-runtime-slice.js' });
  return { context, getFetchCalls: () => fetchCalls };
}

function runtimeEntry(overrides = {}) {
  const entry = manifest.assets.find(item => item.asset_id === 'P-GCOINS-ICON-V1');
  return Object.assign({}, entry, overrides);
}

async function settle() {
  await new Promise(resolve => setTimeout(resolve, 0));
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

(async () => {
  {
    const test = makeContext();
    const icon = test.context.currencyIcon();
    await settle();
    check(test.getFetchCalls() === 1, 'default-on flag resolves the manifest once');
    check(icon.getAttribute('data-currency-asset') === 'P-GCOINS-ICON-V1', 'valid manifest promotes the icon to Candidate B runtime');
    check(icon.children[0].src === 'assets/ui/currency/gcoins-v1/gcoins-icon-64-v1.png', 'normal amount uses the 64px runtime candidate');
    check(icon.children[0].srcset.includes('gcoins-icon-44-v1.png 44w') && icon.children[0].srcset.includes('gcoins-icon-192-v1.png 192w'), 'runtime icon exposes all DPR variants');
    check(icon.children[0].sizes === '18px', 'normal icon declares its CSS size for DPR selection');
  }
  {
    const test = makeContext();
    const icon = test.context.currencyIcon('sm');
    await settle();
    check(icon.children[0].src.endsWith('gcoins-icon-44-v1.png') && icon.children[0].sizes === '14px', 'small amount selects the 44px runtime candidate');
  }
  {
    const test = makeContext({ flag: '0' });
    const icon = test.context.currencyIcon();
    await settle();
    check(test.getFetchCalls() === 0 && icon.getAttribute('data-currency-asset') === 'P-003' && icon.children[0].src === 'assets/ui/currency_cash.svg', 'explicit flag 0 keeps the P-003 fallback without a manifest fetch');
  }
  {
    const broken = runtimeEntry({ clearance: 'NOT_CLEAR' });
    const test = makeContext({ manifest: { assets: [broken] } });
    const icon = test.context.currencyIcon();
    await settle();
    check(test.getFetchCalls() === 1 && icon.getAttribute('data-currency-asset') === 'P-003', 'invalid clearance fails closed to P-003');
  }
  {
    const test = makeContext({ fetchThrows: true });
    const icon = test.context.currencyIcon();
    await settle();
    check(icon.getAttribute('data-currency-asset') === 'P-003', 'manifest/network failure keeps P-003');
  }
  {
    const test = makeContext();
    const icon = test.context.currencyIcon();
    await settle();
    const image = icon.children[0];
    image.listeners.error();
    check(icon.getAttribute('data-currency-asset') === 'P-003' && image.src === 'assets/ui/currency_cash.svg', 'runtime decode failure rolls back to P-003');
    image.listeners.error();
    check(icon.classList.contains('asset-failed') && icon.children[1].textContent === '💵', 'P-003 decode failure preserves the legacy 💵 fallback');
  }
  {
    const test = makeContext({ storageThrows: true });
    const icon = test.context.currencyIcon();
    await settle();
    check(test.getFetchCalls() === 0 && icon.getAttribute('data-currency-asset') === 'P-003', 'storage exceptions fail closed without enabling the runtime candidate');
  }
  if (failures) process.exitCode = 1;
  else console.log(`G_COINS_RUNTIME_ALL_PASS assertions=${assertions}`);
})();

