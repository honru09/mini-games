'use strict';

// Runtime contract for P0-10. This intentionally uses a tiny DOM/image stub so
// the async manifest, decode/load, rollback and same-family composite fallback
// are exercised without claiming a real-browser/device result.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ASSETS = fs.readFileSync(path.join(ROOT, 'public/src/core/06-assets.js'), 'utf8');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/manifests/asset_manifest.json'), 'utf8'));
const CHARACTER = {
  schemaVersion: 'player-character-v1',
  characterId: 'character-base-01',
  slots: { body:'body-paper-01', face:'face-dot-01', hair:'hair-none', top:'top-hoodie-01', bottom:'bottom-shorts-01', footwear:'footwear-sneakers-01', accessory:'accessory-none' },
};

function clone(value){ return JSON.parse(JSON.stringify(value)); }

function makeHarness(options = {}) {
  const mode = options.mode || 'valid';
  let responses = Array.isArray(options.responses) ? options.responses.slice() : null;
  let storageValue = options.flag === undefined ? null : String(options.flag),releaseJson=null;
  let fetchCount = 0;
  const images = [];

  function makeElement(tag){
    const classes = new Set();
    const element = {
      tagName: String(tag).toUpperCase(), children: [], parent: null, isConnected: true,
      style: {}, dataset: {}, attributes: {}, _listeners: {}, textContent: '',
      appendChild(child){ child.parent = this; child.isConnected = true; this.children.push(child); return child; },
      setAttribute(name, value){ this.attributes[name] = String(value); if (String(name).startsWith('data-')) this.dataset[String(name).slice(5)] = String(value); },
      addEventListener(type, listener){ (this._listeners[type] ||= []).push(listener); },
      dispatch(type, event){ for (const listener of this._listeners[type] || []) listener(event || {}); },
      remove(){ this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
    };
    element.classList = {
      add(...names){ names.forEach(name => classes.add(name)); },
      remove(...names){ names.forEach(name => classes.delete(name)); },
      contains(name){ return classes.has(name); },
    };
    Object.defineProperty(element, 'className', {
      get(){ return [...classes].join(' '); },
      set(value){ classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); },
    });
    if (String(tag).toLowerCase() === 'img') {
      let src = '';
      Object.defineProperty(element, 'src', {
        get(){ return src; },
        set(value){
          src = String(value);
          const isComposite = element.dataset.playerCharacterFallback === 'composite';
          const shouldError = mode === 'layer-error' && !isComposite && element.dataset.playerCharacterSlot === 'top'
            || mode === 'composite-error' && (isComposite || element.dataset.playerCharacterSlot === 'top');
          Promise.resolve().then(() => element.dispatch(shouldError ? 'error' : 'load'));
        },
      });
      images.push(element);
    }
    return element;
  }

  const document = {
    createElement: makeElement,
    querySelectorAll(){ return []; },
  };
  const el = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  };
  const localStorage = {
    getItem(){ return storageValue; },
    setItem(){},
    removeItem(){},
  };
  const fetch = async () => {
    fetchCount += 1;
    let body;
    if (responses) body = responses[Math.min(fetchCount - 1, responses.length - 1)];
    else if (mode === 'missing') body = { ...clone(MANIFEST), assets: MANIFEST.assets.filter(asset => asset.asset_id !== 'P-PLAYER-CHARACTER-LAYERED-V1') };
    else body = MANIFEST;
    return { ok: true, json: async () => {if(options.delayJson&&fetchCount===1)await new Promise(resolve=>{releaseJson=resolve;});return clone(body);} };
  };
  const context = { console, document, el, localStorage, fetch, Promise, Object, Set, Map, String, Number, Boolean, Array, RegExp, JSON, Math, Error, URL, setTimeout, clearTimeout };
  vm.runInNewContext(`${ASSETS}\nthis.__playerCharacterRuntime = { playerCharacterLayeredNode, resolvePlayerCharacterLayerUrl, resolvePlayerCharacterCompositeUrl, resolvePlayerCharacterArtUrl, playerCharacterVariantSpec };`, context);
  return { api: context.__playerCharacterRuntime, images, setFlag(value){storageValue=value===null?null:String(value);},setResponses(next){ responses = Array.isArray(next) ? next.slice() : null; },release(){if(releaseJson){const fn=releaseJson;releaseJson=null;fn();}},get fetchCount(){ return fetchCount; } };
}

async function settle(){ await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)); }
function images(node){ return node.children.filter(child => child.tagName === 'IMG'); }
function check(name, condition){ console.log((condition ? 'PASS  ' : 'FAIL  ') + name); return condition; }

async function main(){
  const results = [];

  const valid = makeHarness();
  const ready = valid.api.playerCharacterLayeredNode(CHARACTER, { size:'128' });
  await settle();
  const readyImages = images(ready);
  results.push(check('seven selected eager layers become visible only after every load', ready.classList.contains('asset-ready') && ready.dataset.playerCharacterRenderer === 'layered-v1' && readyImages.filter(image => image.dataset.playerCharacterSlot).length === 7 && readyImages.filter(image => image.dataset.playerCharacterSlot && image.style.display === '' && image.loading === 'eager').length === 7 && valid.fetchCount === 1));

  const layerFailure = makeHarness({ mode:'layer-error' });
  const compositeReady = layerFailure.api.playerCharacterLayeredNode(CHARACTER, { size:'128' });
  await settle();
  const compositeImage = images(compositeReady).find(image => image.dataset.playerCharacterFallback === 'composite');
  results.push(check('one layer error promotes the same-family default composite', compositeReady.classList.contains('asset-composite-ready') && compositeReady.dataset.playerCharacterRenderer === 'composite' && compositeImage && compositeImage.style.display === '' && /default-neutral-128-v1\.webp$/.test(compositeImage.src) && compositeReady.children[0].style.display === 'none'));

  const compositeFailure = makeHarness({ mode:'composite-error' });
  const glyphReady = compositeFailure.api.playerCharacterLayeredNode(CHARACTER, { size:'128' });
  await settle();
  results.push(check('composite decode error completes the fallback chain to glyph', glyphReady.classList.contains('asset-failed') && glyphReady.dataset.playerCharacterRenderer === 'glyph' && glyphReady.children[0].style.display === ''));

  const invalid = makeHarness({ mode:'missing' });
  const failed = invalid.api.playerCharacterLayeredNode(CHARACTER, { size:'128' });
  await settle();
  results.push(check('missing manifest item fails closed to the glyph token', failed.classList.contains('asset-failed') && failed.dataset.playerCharacterRenderer === 'glyph' && !failed.classList.contains('asset-composite-ready') && invalid.fetchCount >= 1));

  const invalidManifest = { ...clone(MANIFEST), assets: MANIFEST.assets.map(asset => asset.asset_id === 'P-PLAYER-CHARACTER-LAYERED-V1' ? { ...asset, variants: { ...asset.variants, 'layer-top-top-hoodie-01-128': 'https://evil.invalid/character.webp' } } : asset) };
  const retry = makeHarness({ responses:[invalidManifest] });
  const first = retry.api.playerCharacterLayeredNode(CHARACTER, { size:'128' });
  await settle();
  retry.setResponses([MANIFEST]);
  const second = retry.api.playerCharacterLayeredNode(CHARACTER, { size:'128' });
  await settle();
  results.push(check('invalid manifest cache is cleared so a later retry can recover', first.classList.contains('asset-failed') && second.classList.contains('asset-ready') && retry.fetchCount >= 2));

  const disabled = makeHarness({ flag:'0' });
  const off = disabled.api.playerCharacterLayeredNode(CHARACTER, { size:'128' });
  await settle();
  results.push(check('exact zero flag disables fetch and keeps fallback', off.classList.contains('asset-failed') && disabled.fetchCount === 0));

  const midFlight = makeHarness({ delayJson:true });
  const lateNode = midFlight.api.playerCharacterLayeredNode(CHARACTER, { size:'128' });
  await Promise.resolve();midFlight.setFlag('0');midFlight.release();await settle();
  results.push(check('flag revocation during manifest load prevents late layered activation', lateNode.dataset.playerCharacterRenderer === 'glyph' && !lateNode.classList.contains('asset-ready')));

  const aliases = makeHarness();
  const poseUrl = await aliases.api.resolvePlayerCharacterArtUrl('pose-idle-front-128');
  const compositeUrl = await aliases.api.resolvePlayerCharacterArtUrl('composite-default-128');
  results.push(check('legacy pose/composite resolver aliases map to manifest filenames', /poses\/idle-front-128-v1\.webp$/.test(poseUrl) && /composites\/default-neutral-128-v1\.webp$/.test(compositeUrl)));

  if (results.some(value => !value)) { console.error('PLAYER_CHARACTER_LAYERED_RUNTIME_FAILURES=' + results.filter(value => !value).length); process.exit(1); }
  console.log('PLAYER_CHARACTER_LAYERED_RUNTIME_ALL_PASS');
}

main().catch(error => { console.error(error && error.stack || error); process.exit(1); });
