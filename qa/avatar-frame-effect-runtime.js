'use strict';

// Executable P0-11 runtime contract. This is a DOM/VM test, not real-browser
// evidence; it covers the manifest, flag/mode, image lifecycle and CSS rollback seam.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ASSETS = fs.readFileSync(path.join(ROOT, 'public/src/core/06-assets.js'), 'utf8');
const IDENTITY = fs.readFileSync(path.join(ROOT, 'public/src/core/10-identity-presentation.js'), 'utf8');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/manifests/asset_manifest.json'), 'utf8'));
const SHOP = {
  frames: Array.from({length:8}, (_, index) => ({id:index + 1, cls:'frame-' + (index + 1)})),
  effects: Array.from({length:8}, (_, index) => ({id:index + 1, cls:'effect-' + (index + 1)})),
};

function clone(value){ return JSON.parse(JSON.stringify(value)); }

function makeHarness(options = {}){
  let flag = options.flag === undefined ? null : String(options.flag);
  let fetchCount = 0;
  let fetchSteps = Array.isArray(options.fetchSteps)
    ? options.fetchSteps.slice()
    : (Array.isArray(options.responses) ? options.responses.map(body => ({type:'body', body})) : null);
  let releaseJson = null;
  const images = [];

  function makeElement(tag){
    const classes = new Set();
    const element = {
      tagName:String(tag).toUpperCase(), children:[], parent:null, isConnected:true, style:{}, dataset:{}, attributes:{}, _listeners:{}, textContent:'',
      appendChild(child){ child.parent = this; child.isConnected = true; this.children.push(child); return child; },
      setAttribute(name, value){ this.attributes[name] = String(value); if (String(name).startsWith('data-')) this.dataset[String(name).slice(5)] = String(value); },
      addEventListener(type, listener, listenerOptions){ (this._listeners[type] ||= []).push({listener, once:!!(listenerOptions && listenerOptions.once)}); },
      dispatch(type, event){
        const listeners = (this._listeners[type] || []).slice();
        for (const record of listeners){
          record.listener(event || {});
          if (record.once) this._listeners[type] = (this._listeners[type] || []).filter(candidate => candidate !== record);
        }
      },
      remove(){ this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
    };
    element.classList = {
      add(...names){ names.forEach(name => classes.add(name)); },
      remove(...names){ names.forEach(name => classes.delete(name)); },
      contains(name){ return classes.has(name); },
      toggle(name, force){ const active = force === undefined ? !classes.has(name) : !!force; if (active) classes.add(name); else classes.delete(name); return active; },
    };
    Object.defineProperty(element, 'className', {
      get(){ return [...classes].join(' '); },
      set(value){ classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); },
    });
    if (String(tag).toLowerCase() === 'img'){
      let src = '';
      Object.defineProperty(element, 'src', {
        get(){ return src; },
        set(value){
          src = String(value);
          const configured = options.imageOutcomes && options.imageOutcomes[element.dataset.avatarAtom];
          const shouldFail = configured === 'error' || options.imageErrorKind === element.dataset.avatarAtom;
          Promise.resolve().then(() => element.dispatch(shouldFail ? 'error' : 'load'));
        },
      });
      images.push(element);
    }
    return element;
  }

  const document = {createElement:makeElement, querySelectorAll(){ return []; }};
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const localStorage = {
    getItem(){ if (options.storageThrows) throw new Error('storage denied'); return flag; },
    setItem(key, value){ flag = String(value); },
    removeItem(){ flag = null; },
  };
  const window = {
    innerWidth:1024,
    matchMedia(query){
      return {matches:String(query).includes('forced-colors') ? !!options.forcedColors : String(query).includes('prefers-reduced-motion') ? !!options.reducedMotion : false};
    },
  };
  const fetch = async () => {
    fetchCount++;
    const step = fetchSteps ? fetchSteps[Math.min(fetchCount - 1, fetchSteps.length - 1)] : {type:'body', body:MANIFEST};
    if (step && step.type === 'reject') throw new Error(step.message || 'fetch rejected');
    if (step && step.type === 'http-error') return {ok:false, json:async () => clone(MANIFEST)};
    return {
      ok:true,
      json:async () => {
        if (options.delayJson && fetchCount === 1) await new Promise(resolve => { releaseJson = resolve; });
        if (step && step.type === 'json-reject') throw new Error(step.message || 'json rejected');
        return clone(step && Object.prototype.hasOwnProperty.call(step, 'body') ? step.body : MANIFEST);
      },
    };
  };
  const avatarCanvas = (id, size) => { const node = makeElement('canvas'); node.dataset.avatarId = String(id); node.width = size; node.height = size; return node; };
  const context = {console, document, window, localStorage, fetch, el, avatarCanvas, SHOP, Promise, Object, Set, Map, String, Number, Boolean, Array, RegExp, JSON, Math, Error, URL, setTimeout, clearTimeout};
  vm.runInNewContext(`${ASSETS}\n${IDENTITY}\nthis.__runtime={resolveAvatarFrameEffectUrl,avatarFrameEffectRuntimeMode,avatarFrameEffectSize,playerIdentityAtomVisualSize,playerIdentityAvatarNode};`, context);
  return {
    api:context.__runtime,
    images,
    setFlag(value){ flag = value === null ? null : String(value); },
    setFetchSteps(value){ fetchSteps = Array.isArray(value) ? value.slice() : null; },
    setResponses(value){ fetchSteps = Array.isArray(value) ? value.map(body => ({type:'body', body})) : null; },
    release(){ if (releaseJson){ const fn = releaseJson; releaseJson = null; fn(); } },
    get fetchCount(){ return fetchCount; },
  };
}

async function settle(){
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
}

function check(name, condition, detail = ''){
  console.log((condition ? 'PASS  ' : 'FAIL  ') + name + (condition || !detail ? '' : ' :: ' + detail));
  return !!condition;
}

function atom(stage, kind){
  return stage.children.find(child => child.dataset && child.dataset.avatarAtom === kind);
}

function frameFallback(stage){
  return stage.children.find(child => child.classList && child.classList.contains('frame-ring'));
}

async function main(){
  const checks = [];

  const valid = makeHarness({flag:'1'});
  const stage = valid.api.playerIdentityAvatarNode({uid:'u1', avatar:100, frame:2, effect:2}, {size:64, animate:true, stageClass:'avatar-stage'});
  const pendingFrame = atom(stage, 'frame');
  const pendingEffect = atom(stage, 'effect');
  checks.push(check('DOM keeps CSS fallbacks visible while image atoms are pending', stage.classList.contains('effect-2') && frameFallback(stage).style.display !== 'none' && pendingFrame.style.display === 'none' && pendingEffect.style.display === 'none'));
  await settle();
  checks.push(check('visible identity loads both owner-cleared atoms once at the 110% display-safe derivative', valid.fetchCount === 1 && pendingFrame.loading === 'eager' && pendingEffect.loading === 'eager' && /frame-2-96-dynamic-v1\.webp$/.test(pendingFrame.src) && /effect-2-96-dynamic-v1\.webp$/.test(pendingEffect.src)));
  checks.push(check('successful image loads hide matching CSS fallbacks', !stage.classList.contains('effect-2') && frameFallback(stage).style.display === 'none' && pendingFrame.style.display === '' && pendingEffect.style.display === '' && stage.dataset.avatarFrameRenderer === 'art-v1' && stage.dataset.avatarEffectRenderer === 'art-v1'));
  pendingFrame.dispatch('error');
  pendingEffect.dispatch('error');
  checks.push(check('a later image failure restores both CSS fallbacks', stage.classList.contains('effect-2') && frameFallback(stage).style.display === '' && pendingFrame.style.display === 'none' && pendingEffect.style.display === 'none' && stage.dataset.avatarFrameRenderer === 'css-fallback' && stage.dataset.avatarEffectRenderer === 'css-fallback'));

  const failedAtoms = makeHarness({imageOutcomes:{frame:'error', effect:'error'}});
  const failedStage = failedAtoms.api.playerIdentityAvatarNode({avatar:100, frame:3, effect:3}, {size:96, animate:true, stageClass:'avatar-stage'});
  await settle();
  checks.push(check('initial decode errors preserve both CSS fallbacks', failedStage.dataset.avatarFrameRenderer === 'css-fallback' && failedStage.dataset.avatarEffectRenderer === 'css-fallback' && failedStage.classList.contains('effect-3') && frameFallback(failedStage).style.display === ''));

  const disabled = makeHarness({flag:'0'});
  const disabledStage = disabled.api.playerIdentityAvatarNode({avatar:100, frame:1, effect:1}, {size:44, animate:true, stageClass:'avatar-stage'});
  await settle();
  checks.push(check('exact zero flag performs no manifest fetch and preserves CSS', disabled.fetchCount === 0 && disabledStage.dataset.avatarFrameRenderer === 'css-fallback' && disabledStage.dataset.avatarEffectRenderer === 'css-fallback' && disabledStage.classList.contains('effect-1')));
  for (const badFlag of ['', 'true', 'yes', '2']){
    const invalidFlag = makeHarness({flag:badFlag});
    const url = await invalidFlag.api.resolveAvatarFrameEffectUrl('frame', 1, '44', 'static');
    checks.push(check(`non-contract flag ${JSON.stringify(badFlag)} fails closed without fetch`, url === '' && invalidFlag.fetchCount === 0));
  }
  const storageFailure = makeHarness({storageThrows:true});
  checks.push(check('storage read failure fails closed without a manifest fetch', await storageFailure.api.resolveAvatarFrameEffectUrl('frame', 1, '44', 'static') === '' && storageFailure.fetchCount === 0));

  const strict = makeHarness();
  for (const size of ['44', '64', '96', '192']){
    for (const mode of ['static', 'dynamic', 'high-contrast']){
      const url = await strict.api.resolveAvatarFrameEffectUrl('effect', 8, size, mode);
      checks.push(check(`resolver accepts exact ${size}/${mode}`, new RegExp(`effect-8-${size}-${mode}-v1\\.webp$`).test(url)));
    }
  }
  checks.push(check('valid size/mode matrix shares one manifest load', strict.fetchCount === 1));
  const displaySafeSizes = [[36,'44'],[40,'44'],[41,'64'],[44,'64'],[64,'96'],[96,'192'],[192,'192']];
  checks.push(check('110% atom sizing chooses the next safe derivative without exceeding 192', displaySafeSizes.every(([displaySize,assetSize]) => strict.api.playerIdentityAtomVisualSize(displaySize) === assetSize), JSON.stringify(displaySafeSizes)));
  const strictReject = makeHarness();
  const invalidRequests = [
    ['frames', 1, '64', 'dynamic'], ['frame', 0, '64', 'dynamic'], ['frame', 9, '64', 'dynamic'],
    ['frame', 1, '45', 'dynamic'], ['frame', 1, '064', 'dynamic'], ['frame', 1, '64', 'Dynamic'],
    ['frame', 1, '64', 'reduced'], ['frame', 1, '64', ''],
  ];
  const invalidResults = await Promise.all(invalidRequests.map(args => strictReject.api.resolveAvatarFrameEffectUrl(...args)));
  checks.push(check('resolver rejects non-allowlisted kind/id/size/mode before fetch', invalidResults.every(value => value === '') && strictReject.fetchCount === 0));

  const reduced = makeHarness({reducedMotion:true});
  const reducedUrl = await reduced.api.resolveAvatarFrameEffectUrl('frame', 1, '64', reduced.api.avatarFrameEffectRuntimeMode());
  checks.push(check('reduced-motion selects the static derivative', /frame-1-64-static-v1\.webp$/.test(reducedUrl)));
  const forced = makeHarness({forcedColors:true, reducedMotion:true});
  const forcedUrl = await forced.api.resolveAvatarFrameEffectUrl('effect', 8, '64', forced.api.avatarFrameEffectRuntimeMode());
  checks.push(check('forced-colors takes precedence over reduced-motion', /effect-8-64-high-contrast-v1\.webp$/.test(forcedUrl)));
  const forcedDom = makeHarness({forcedColors:true, reducedMotion:true});
  const forcedMissingAnimate = forcedDom.api.playerIdentityAvatarNode({avatar:100, frame:5, effect:5}, {size:64, stageClass:'avatar-stage'});
  const forcedFalseAnimate = forcedDom.api.playerIdentityAvatarNode({avatar:100, frame:8, effect:8}, {size:64, animate:false, stageClass:'avatar-stage'});
  await settle();
  const forcedAtoms = [...forcedMissingAnimate.children, ...forcedFalseAnimate.children].filter(child => child.dataset && child.dataset.avatarAtom);
  checks.push(check('forced-colors stays high-contrast when animate is missing or false', forcedAtoms.length === 4 && forcedAtoms.every(image => image.dataset.avatarAtomMode === 'high-contrast' && /-96-high-contrast-v1\.webp$/.test(image.src))));

  const pathEscapeManifest = clone(MANIFEST);
  pathEscapeManifest.assets.find(item => item.asset_id === 'P-AVATAR-FRAME-EFFECT-V1').variants['frame-1-64-dynamic'] = '../../outside.webp';
  const pathEscape = makeHarness({responses:[pathEscapeManifest]});
  checks.push(check('path traversal in any registered variant rejects the full family', await pathEscape.api.resolveAvatarFrameEffectUrl('frame', 1, '64', 'dynamic') === ''));

  const incompleteManifest = clone(MANIFEST);
  delete incompleteManifest.assets.find(item => item.asset_id === 'P-AVATAR-FRAME-EFFECT-V1').variants['effect-8-192-high-contrast'];
  const incomplete = makeHarness({responses:[incompleteManifest]});
  checks.push(check('missing variant rejects the full family', await incomplete.api.resolveAvatarFrameEffectUrl('frame', 1, '64', 'dynamic') === ''));

  const wrongSourceManifest = clone(MANIFEST);
  wrongSourceManifest.assets.find(item => item.asset_id === 'P-AVATAR-FRAME-EFFECT-V1').source_asset_id = 'ART-019-AVATAR-FRAME-EFFECT-V1';
  const wrongSource = makeHarness({responses:[wrongSourceManifest]});
  checks.push(check('stale source ID rejects the full family', await wrongSource.api.resolveAvatarFrameEffectUrl('frame', 1, '64', 'dynamic') === ''));

  const retryManifest = clone(MANIFEST);
  retryManifest.assets.find(item => item.asset_id === 'P-AVATAR-FRAME-EFFECT-V1').variants['frame-1-64-dynamic'] = 'https://evil.invalid/frame.webp';
  const retry = makeHarness({responses:[retryManifest]});
  const first = await retry.api.resolveAvatarFrameEffectUrl('frame', 1, '64', 'dynamic');
  retry.setResponses([MANIFEST]);
  const second = await retry.api.resolveAvatarFrameEffectUrl('frame', 1, '64', 'dynamic');
  checks.push(check('bad Manifest clears its cache and a later valid load recovers', first === '' && /frame-1-64-dynamic-v1\.webp$/.test(second) && retry.fetchCount === 2));

  for (const failureType of ['http-error', 'reject', 'json-reject']){
    const loadFailure = makeHarness({fetchSteps:[{type:failureType}, {type:'body', body:MANIFEST}]});
    const failed = await loadFailure.api.resolveAvatarFrameEffectUrl('effect', 5, '96', 'static');
    const recovered = await loadFailure.api.resolveAvatarFrameEffectUrl('effect', 5, '96', 'static');
    checks.push(check(`${failureType} load failure rejects safely and remains retryable`, failed === '' && /effect-5-96-static-v1\.webp$/.test(recovered) && loadFailure.fetchCount === 2));
  }

  const rejectedDom = makeHarness({fetchSteps:[{type:'reject'}]});
  const rejectedStage = rejectedDom.api.playerIdentityAvatarNode({avatar:100, frame:4, effect:4}, {size:64, animate:true, stageClass:'avatar-stage'});
  await settle();
  checks.push(check('resolver rejection reaches DOM fallback for both atoms', rejectedStage.dataset.avatarFrameRenderer === 'css-fallback' && rejectedStage.dataset.avatarEffectRenderer === 'css-fallback' && rejectedStage.classList.contains('effect-4') && frameFallback(rejectedStage).style.display === ''));

  const midFlight = makeHarness({delayJson:true});
  const pending = midFlight.api.resolveAvatarFrameEffectUrl('frame', 1, '64', 'dynamic');
  await Promise.resolve();
  midFlight.setFlag('0');
  midFlight.release();
  checks.push(check('flag revocation during manifest load prevents late activation', (await pending) === ''));

  if (checks.some(value => !value)){
    console.error('AVATAR_FRAME_EFFECT_RUNTIME_FAILURES=' + checks.filter(value => !value).length);
    process.exit(1);
  }
  console.log('AVATAR_FRAME_EFFECT_RUNTIME_ALL_PASS', JSON.stringify({checks:checks.length}));
}

main().catch(error => { console.error(error && error.stack || error); process.exit(1); });
