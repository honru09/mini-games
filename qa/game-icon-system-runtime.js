'use strict';

// Executable P0-12 manifest/image lifecycle contract. This tiny DOM/VM proves
// fail-closed behavior; it deliberately does not claim browser-visible QA.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = fs.readFileSync(path.join(ROOT, 'public/src/core/06-assets.js'), 'utf8');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/manifests/asset_manifest.json'), 'utf8'));
const ASSET_ID = 'P-GAME-ICON-SYSTEM-V2';
const FLAG = 'mg_art_game_icon_system_v2';
const GAMES = ['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'];
const ROLES = ['icon', 'cover-crop', 'theme-icon', 'selected-object'];
const MARKERS = ['ai', 'solo', 'online', 'multiplayer', 'card', 'ready', 'waiting', 'live', 'ranking', 'room', 'locked', 'error'];
const GAME_META = Object.fromEntries(GAMES.map((id, index) => [id, {id, icon:['⚫','✈️','🏠','🛡️','🧱','♟️'][index], name:id}]));

function clone(value){ return JSON.parse(JSON.stringify(value)); }

function mutateFamily(mutator){
  const manifest = clone(MANIFEST);
  const family = manifest.assets.find(item => item && item.asset_id === ASSET_ID);
  mutator(family, manifest);
  return manifest;
}

function makeHarness(options = {}){
  let storageValue = options.flag === undefined ? null : String(options.flag);
  let fetchSteps = Array.isArray(options.fetchSteps) ? options.fetchSteps.slice() : null;
  let fetchCount = 0;
  let releaseJson = null;
  let assignmentCount = 0;
  const images = [];
  const assignments = [];

  function setConnected(node, value){
    node.isConnected = !!value;
    for (const child of node.children || []) setConnected(child, value);
  }

  function descendants(node){
    const values = [];
    for (const child of node.children || []){
      values.push(child, ...descendants(child));
    }
    return values;
  }

  function makeElement(tag){
    const classes = new Set();
    const element = {
      nodeType:1,
      tagName:String(tag).toUpperCase(),
      children:[],
      parentNode:null,
      isConnected:true,
      style:{},
      dataset:{},
      attributes:{},
      _listeners:{},
      textContent:'',
      appendChild(child){
        if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(item => item !== child);
        child.parentNode = this;
        this.children.push(child);
        setConnected(child, this.isConnected);
        return child;
      },
      insertBefore(child, reference){
        if (!reference || !this.children.includes(reference)) return this.appendChild(child);
        if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(item => item !== child);
        const index = this.children.indexOf(reference);
        child.parentNode = this;
        this.children.splice(index, 0, child);
        setConnected(child, this.isConnected);
        return child;
      },
      setAttribute(name, value){
        this.attributes[String(name)] = String(value);
        if (String(name).startsWith('data-')) this.dataset[String(name).slice(5)] = String(value);
      },
      getAttribute(name){
        return Object.prototype.hasOwnProperty.call(this.attributes, String(name)) ? this.attributes[String(name)] : null;
      },
      addEventListener(type, listener, listenerOptions){
        (this._listeners[type] ||= []).push({listener, once:!!(listenerOptions && listenerOptions.once)});
      },
      dispatch(type, event){
        const records = (this._listeners[type] || []).slice();
        for (const record of records){
          record.listener(event || {});
          if (record.once) this._listeners[type] = (this._listeners[type] || []).filter(candidate => candidate !== record);
        }
      },
      querySelector(selector){
        if (!/^\.[a-z0-9_-]+$/i.test(String(selector))) return null;
        const className = String(selector).slice(1);
        return descendants(this).find(child => child.classList && child.classList.contains(className)) || null;
      },
      querySelectorAll(selector){
        if (!/^\.[a-z0-9_-]+$/i.test(String(selector))) return [];
        const className = String(selector).slice(1);
        return descendants(this).filter(child => child.classList && child.classList.contains(className));
      },
      remove(){
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
        setConnected(this, false);
      },
    };
    Object.defineProperty(element, 'firstChild', {get(){ return this.children[0] || null; }});
    Object.defineProperty(element, 'innerHTML', {
      get(){ return ''; },
      set(){ for (const child of this.children) setConnected(child, false); this.children = []; },
    });
    element.classList = {
      add(...names){ names.filter(Boolean).forEach(name => classes.add(String(name))); },
      remove(...names){ names.forEach(name => classes.delete(String(name))); },
      contains(name){ return classes.has(String(name)); },
      toggle(name, force){
        const active = force === undefined ? !classes.has(String(name)) : !!force;
        if (active) classes.add(String(name)); else classes.delete(String(name));
        return active;
      },
    };
    Object.defineProperty(element, 'className', {
      get(){ return [...classes].join(' '); },
      set(value){ classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); },
    });
    if (String(tag).toLowerCase() === 'img'){
      let source = '';
      Object.defineProperty(element, 'src', {
        get(){ return source; },
        set(value){
          const attributeSource = String(value);
          element.attributes.src = attributeSource;
          source = /^(?:[a-z]+:|\/)/i.test(attributeSource) ? attributeSource : 'http://localhost/' + attributeSource;
          assignmentCount++;
          assignments.push({element, source:attributeSource, assignment:assignmentCount});
          let outcome = 'load';
          if (typeof options.imageOutcome === 'function') outcome = options.imageOutcome(element, attributeSource, assignmentCount) || 'load';
          else if (options.imageOutcome) outcome = String(options.imageOutcome);
          if (outcome !== 'manual') Promise.resolve().then(() => element.dispatch(outcome === 'error' ? 'error' : 'load'));
        },
      });
      images.push(element);
    }
    return element;
  }

  const document = {
    createElement:makeElement,
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const localStorage = {
    getItem(key){
      if (options.storageThrows) throw new Error('storage denied');
      if (String(key) === FLAG) return storageValue;
      if (options.otherFlags && Object.prototype.hasOwnProperty.call(options.otherFlags, key)) return options.otherFlags[key];
      return null;
    },
    setItem(key, value){ if (String(key) === FLAG) storageValue = String(value); },
    removeItem(key){ if (String(key) === FLAG) storageValue = null; },
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
  const window = {
    innerWidth:1024,
    matchMedia(query){
      const value = String(query);
      return {matches:value.includes('forced-colors') ? !!options.forcedColors : value.includes('prefers-reduced-motion') ? !!options.reducedMotion : false};
    },
  };
  const context = {
    console, document, window, localStorage, fetch, el, GAMES:GAME_META,
    Promise, Object, Set, Map, String, Number, Boolean, Array, RegExp, JSON, Math, Error, URL,
    setTimeout, clearTimeout,
  };
  vm.runInNewContext(`${ASSETS}\nthis.__gameIconRuntime={gameIconSystemEnabled,gameIconSystemSize,gameIconSystemVariantSpec,gameIconSystemManifestItem,gameIconSystemVariantKey,gameSystemMarkerVariantKey,resolveGameIconVariantUrl,resolveGameSystemMarkerUrl,gameIconNode,gameSystemMarkerNode,ensureGameSelectedObjectNode,gameCoverNode};`, context);
  return {
    api:context.__gameIconRuntime,
    document,
    images,
    assignments,
    setFlag(value){ storageValue = value === null ? null : String(value); },
    setFetchSteps(steps){ fetchSteps = Array.isArray(steps) ? steps.slice() : null; },
    release(){ if (releaseJson){ const resolve = releaseJson; releaseJson = null; resolve(); } },
    dispatchImage(image, type){ image.dispatch(type); },
    get fetchCount(){ return fetchCount; },
  };
}

async function settle(rounds = 3){
  for (let index = 0; index < rounds; index++) await new Promise(resolve => setTimeout(resolve, 0));
}

function byClass(node, className){
  return node.children.find(child => child.classList && child.classList.contains(className));
}

function check(name, condition, detail = ''){
  const ok = !!condition;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || !detail ? '' : ' :: ' + detail));
  return ok;
}

function expectedGamePath(gameId, role, size){
  if (role === 'icon') return `assets/ui/game-icons/v2/games/${gameId}/icon-${size}-v2.webp`;
  if (role === 'cover-crop') return `assets/ui/game-icons/v2/games/${gameId}/cover-crop-320x180-v2.webp`;
  if (role === 'theme-icon') return `assets/ui/game-icons/v2/games/${gameId}/theme-icon-64-v2.webp`;
  return `assets/ui/game-icons/v2/games/${gameId}/selected-object-96-v2.webp`;
}

async function main(){
  const results = [];

  const matrix = makeHarness();
  const matrixMismatches = [];
  for (const gameId of GAMES){
    for (const size of [44, 64, 96]){
      const actual = await matrix.api.resolveGameIconVariantUrl(gameId, 'icon', size);
      const expected = expectedGamePath(gameId, 'icon', size);
      if (actual !== expected) matrixMismatches.push({key:`${gameId}/icon/${size}`, actual, expected});
    }
    for (const role of ['cover-crop', 'theme-icon', 'selected-object']){
      const actual = await matrix.api.resolveGameIconVariantUrl(gameId, role, 44);
      const expected = expectedGamePath(gameId, role, 44);
      if (actual !== expected) matrixMismatches.push({key:`${gameId}/${role}`, actual, expected});
    }
  }
  for (const markerId of MARKERS){
    for (const size of [24, 32, 44]){
      const actual = await matrix.api.resolveGameSystemMarkerUrl(markerId, size);
      const expected = `assets/ui/game-icons/v2/markers/${markerId}-${size}-v2.webp`;
      if (actual !== expected) matrixMismatches.push({key:`marker/${markerId}/${size}`, actual, expected});
    }
  }
  results.push(check('all 72 game/marker resolver variants map to their exact local URL', matrixMismatches.length === 0, JSON.stringify(matrixMismatches.slice(0, 3))));
  results.push(check('all valid variants share one lazy no-store Manifest request', matrix.fetchCount === 1, String(matrix.fetchCount)));
  results.push(check('icon and marker size selection rounds upward within allowlisted bounds', matrix.api.gameIconSystemSize('icon', 1) === '44' && matrix.api.gameIconSystemSize('icon', 45) === '64' && matrix.api.gameIconSystemSize('icon', 65) === '96' && matrix.api.gameIconSystemSize('icon', 999) === '96' && matrix.api.gameSystemMarkerVariantKey('ready', 1) === 'marker-ready-24' && matrix.api.gameSystemMarkerVariantKey('ready', 25) === 'marker-ready-32' && matrix.api.gameSystemMarkerVariantKey('ready', 33) === 'marker-ready-44'));

  const invalidRequest = makeHarness();
  const invalidValues = await Promise.all([
    invalidRequest.api.resolveGameIconVariantUrl('unknown', 'icon', 44),
    invalidRequest.api.resolveGameIconVariantUrl('gomoku', 'Icon', 44),
    invalidRequest.api.resolveGameIconVariantUrl('gomoku', 'poster', 44),
    invalidRequest.api.resolveGameSystemMarkerUrl('success', 24),
    invalidRequest.api.resolveGameSystemMarkerUrl('../ready', 24),
  ]);
  results.push(check('non-allowlisted game/role/marker requests fail before fetch', invalidValues.every(value => value === '') && invalidRequest.fetchCount === 0));

  const disabled = makeHarness({flag:'0'});
  const disabledIcon = disabled.api.gameIconNode('gomoku', {fallback:'G'});
  const disabledMarker = disabled.api.gameSystemMarkerNode('ready', {fallback:'R'});
  const disabledDefaultMarker = disabled.api.gameSystemMarkerNode('waiting');
  const disabledCard = disabled.document.createElement('button');
  disabledCard.dataset.gameId = 'gomoku';
  const disabledSelected = disabled.api.ensureGameSelectedObjectNode(disabledCard, 'gomoku');
  await settle();
  results.push(check('exact zero flag performs no fetch and preserves icon/marker fallbacks', disabled.fetchCount === 0 && disabledIcon.dataset.gameIconState === 'fallback' && disabledMarker.dataset.markerState === 'fallback' && byClass(disabledIcon, 'game-icon-fallback').textContent === 'G' && byClass(disabledMarker, 'game-system-marker-fallback').textContent === 'R'));
  results.push(check('default decorative markers and selected objects add no glyph when flag zero', byClass(disabledDefaultMarker, 'game-system-marker-fallback').textContent === '' && byClass(disabledSelected, 'game-icon-fallback').textContent === '' && disabledCard.querySelectorAll('.game-icon-selected-object').length === 1));
  results.push(check('empty marker fallback is explicitly collapsible while a meaningful fallback is retained', disabledDefaultMarker.classList.contains('game-system-marker-empty-fallback') && !disabledMarker.classList.contains('game-system-marker-empty-fallback') && byClass(disabledMarker, 'game-system-marker-fallback').textContent === 'R'));
  for (const badFlag of ['', 'true', 'yes', '2']){
    const invalidFlag = makeHarness({flag:badFlag});
    results.push(check(`non-contract flag ${JSON.stringify(badFlag)} fails closed without fetch`, await invalidFlag.api.resolveGameIconVariantUrl('gomoku', 'icon', 44) === '' && invalidFlag.fetchCount === 0));
  }
  const storageDenied = makeHarness({storageThrows:true});
  results.push(check('storage denial fails closed without fetch', await storageDenied.api.resolveGameSystemMarkerUrl('ready', 24) === '' && storageDenied.fetchCount === 0));

  const malformed = [
    ['missing family', mutateFamily((family, manifest) => { manifest.assets = manifest.assets.filter(item => item.asset_id !== ASSET_ID); })],
    ['wrong source ID', mutateFamily(family => { family.source_asset_id = 'ART-027-STALE'; })],
    ['wrong clearance', mutateFamily(family => { family.clearance = 'SOURCE_ONLY'; })],
    ['wrong runtime path', mutateFamily(family => { family.runtime_path = 'public/assets/ui/game-icons/v2/games/ludo/icon-64-v2.webp'; })],
    ['missing variant', mutateFamily(family => { delete family.variants['marker-error-44']; })],
    ['extra variant', mutateFamily(family => { family.variants['marker-extra-24'] = 'public/assets/ui/game-icons/v2/markers/error-24-v2.webp'; })],
    ['path traversal', mutateFamily(family => { family.variants['game-gomoku-icon-44'] = '../../outside.webp'; })],
    ['external URL', mutateFamily(family => { family.variants['marker-ready-24'] = 'https://evil.invalid/ready.webp'; })],
    ['valid-looking game path swap', mutateFamily(family => {
      const first = family.variants['game-gomoku-icon-44'];
      family.variants['game-gomoku-icon-44'] = family.variants['game-ludo-icon-44'];
      family.variants['game-ludo-icon-44'] = first;
    })],
    ['valid-looking marker path swap', mutateFamily(family => {
      const first = family.variants['marker-ready-24'];
      family.variants['marker-ready-24'] = family.variants['marker-waiting-24'];
      family.variants['marker-waiting-24'] = first;
    })],
  ];
  for (const [name, badManifest] of malformed){
    const harness = makeHarness({fetchSteps:[{type:'body', body:badManifest}]});
    const gameUrl = await harness.api.resolveGameIconVariantUrl('gomoku', 'icon', 44);
    const markerUrl = await harness.api.resolveGameSystemMarkerUrl('ready', 24);
    results.push(check(`${name} rejects the complete family`, gameUrl === '' && markerUrl === ''));
  }

  const badThenGood = mutateFamily(family => { family.variants['game-gomoku-icon-64'] = family.variants['game-ludo-icon-64']; });
  const retry = makeHarness({fetchSteps:[{type:'body', body:badThenGood}]});
  const retryFirst = await retry.api.resolveGameIconVariantUrl('gomoku', 'icon', 64);
  retry.setFetchSteps([{type:'body', body:MANIFEST}]);
  const retrySecond = await retry.api.resolveGameIconVariantUrl('gomoku', 'icon', 64);
  results.push(check('invalid Manifest clears the family cache and a later valid request recovers', retryFirst === '' && /gomoku\/icon-64-v2\.webp$/.test(retrySecond) && retry.fetchCount === 2, JSON.stringify({retryFirst,retrySecond,fetchCount:retry.fetchCount})));
  for (const type of ['http-error', 'reject', 'json-reject']){
    const loadFailure = makeHarness({fetchSteps:[{type}, {type:'body', body:MANIFEST}]});
    const first = await loadFailure.api.resolveGameSystemMarkerUrl('live', 32);
    const second = await loadFailure.api.resolveGameSystemMarkerUrl('live', 32);
    results.push(check(`${type} Manifest failure stays retryable`, first === '' && /markers\/live-32-v2\.webp$/.test(second) && loadFailure.fetchCount === 2, JSON.stringify({first,second,fetchCount:loadFailure.fetchCount})));
  }

  const pending = makeHarness({delayJson:true, imageOutcome:'manual'});
  const pendingIcon = pending.api.gameIconNode('ludo', {size:44, fallback:'L', loading:'eager'});
  await Promise.resolve();
  results.push(check('fallback remains visible throughout Manifest/image loading', pendingIcon.dataset.gameIconState === 'loading' && byClass(pendingIcon, 'game-icon-fallback').style.display !== 'none' && byClass(pendingIcon, 'game-icon-asset-image').loading === 'eager'));
  pending.release();
  await settle();
  const pendingImage = byClass(pendingIcon, 'game-icon-asset-image');
  results.push(check('resolved image does not hide fallback before its load event', /ludo\/icon-44-v2\.webp$/.test(pendingImage.src) && byClass(pendingIcon, 'game-icon-fallback').style.display !== 'none' && pendingIcon.dataset.gameIconState === 'loading', JSON.stringify({src:pendingImage.src,state:pendingIcon.dataset.gameIconState,fallback:byClass(pendingIcon, 'game-icon-fallback').style.display})));
  pending.dispatchImage(pendingImage, 'load');
  results.push(check('successful image load promotes v2 and only then hides fallback', pendingIcon.dataset.gameIconState === 'v2' && pendingIcon.classList.contains('asset-ready') && byClass(pendingIcon, 'game-icon-fallback').style.display === 'none' && pendingImage.style.display === '', JSON.stringify({src:pendingImage.src,state:pendingIcon.dataset.gameIconState,classes:pendingIcon.className,fallback:byClass(pendingIcon, 'game-icon-fallback').style.display,image:pendingImage.style.display})));

  const iconFailure = makeHarness({imageOutcome:'error'});
  const failedIcon = iconFailure.api.gameIconNode('tank', {size:64, fallback:'T'});
  const failedMarker = iconFailure.api.gameSystemMarkerNode('error', {size:32, fallback:'!'});
  await settle(5);
  results.push(check('single v2 image failures restore independent icon and marker fallbacks', failedIcon.dataset.gameIconState === 'fallback' && failedMarker.dataset.markerState === 'fallback' && failedIcon.classList.contains('asset-failed') && failedMarker.classList.contains('asset-failed') && byClass(failedIcon, 'game-icon-fallback').style.display === '' && byClass(failedMarker, 'game-system-marker-fallback').style.display === ''));

  const legacySuccess = makeHarness({imageOutcome:(image, url) => url.includes('/game_covers/') ? 'load' : 'error'});
  const legacyIcon = legacySuccess.api.gameIconNode('gomoku', {size:64, fallback:'G', legacyPath:'ui/game_covers/game_gomoku_320.webp'});
  await settle(5);
  results.push(check('v2 icon decode failure can recover through an explicit legacy image', legacyIcon.dataset.gameIconState === 'legacy' && legacyIcon.classList.contains('asset-ready') && /game_gomoku_320\.webp$/.test(byClass(legacyIcon, 'game-icon-asset-image').src) && byClass(legacyIcon, 'game-icon-fallback').style.display === 'none'));

  const midManifest = makeHarness({delayJson:true});
  const midManifestIcon = midManifest.api.gameIconNode('tetris', {fallback:'B'});
  await Promise.resolve();
  midManifest.setFlag('0');
  midManifest.release();
  await settle(4);
  results.push(check('flag revocation during Manifest load prevents late image activation', midManifestIcon.dataset.gameIconState === 'fallback' && byClass(midManifestIcon, 'game-icon-asset-image').src === ''));

  const midImage = makeHarness({imageOutcome:'manual'});
  const midImageIcon = midImage.api.gameIconNode('xiangqi', {fallback:'X'});
  const midImageMarker = midImage.api.gameSystemMarkerNode('waiting', {fallback:'W'});
  await settle(3);
  const iconImage = byClass(midImageIcon, 'game-icon-asset-image');
  const markerImage = byClass(midImageMarker, 'game-system-marker-image');
  midImage.setFlag('0');
  midImage.dispatchImage(iconImage, 'load');
  midImage.dispatchImage(markerImage, 'load');
  results.push(check('flag revocation during image decode prevents late icon/marker activation', midImageIcon.dataset.gameIconState === 'fallback' && midImageMarker.dataset.markerState === 'fallback' && !midImageIcon.classList.contains('asset-ready') && !midImageMarker.classList.contains('asset-ready')));

  const disconnected = makeHarness({delayJson:true});
  const detachedIcon = disconnected.api.gameIconNode('monopoly', {fallback:'M'});
  await Promise.resolve();
  detachedIcon.remove();
  disconnected.release();
  await settle(4);
  results.push(check('detached nodes receive no late image assignment or state promotion', disconnected.assignments.length === 0 && byClass(detachedIcon, 'game-icon-asset-image').isConnected === false && !detachedIcon.classList.contains('asset-ready')));

  const selected = makeHarness({imageOutcome:'manual'});
  const card = selected.document.createElement('button');
  card.dataset.gameId = 'gomoku';
  const selectedFirst = selected.api.ensureGameSelectedObjectNode(card, 'gomoku');
  const selectedSecond = selected.api.ensureGameSelectedObjectNode(card, 'gomoku');
  results.push(check('selected-object helper is decorative, glyph-free, eager and idempotent per card', selectedFirst === selectedSecond && card.querySelectorAll('.game-icon-selected-object').length === 1 && selectedFirst.getAttribute('aria-hidden') === 'true' && byClass(selectedFirst, 'game-icon-fallback').textContent === '' && byClass(selectedFirst, 'game-icon-asset-image').alt === '' && byClass(selectedFirst, 'game-icon-asset-image').loading === 'eager'));

  const coverSuccess = makeHarness();
  const cover = coverSuccess.api.gameCoverNode('gomoku', GAME_META.gomoku);
  await settle(4);
  results.push(check('cover crop succeeds without removing its semantic-free Emoji fallback node', cover && cover.classList.contains('asset-ready') && byClass(cover, 'game-cover-v2').style.display === '' && byClass(cover, 'game-cover-fallback').style.display === 'none' && cover.getAttribute('aria-hidden') === 'true', cover ? JSON.stringify({classes:cover.className,v2:byClass(cover, 'game-cover-v2').style.display,fallback:byClass(cover, 'game-cover-fallback').style.display}) : 'null'));
  const coverLegacy = makeHarness({imageOutcome:(image, url) => image.classList.contains('game-cover-v2') ? 'error' : 'load'});
  const legacyCover = coverLegacy.api.gameCoverNode('ludo', GAME_META.ludo);
  await settle(5);
  results.push(check('single cover-crop failure rolls back to the existing 320/640 cover', legacyCover.classList.contains('asset-ready') && byClass(legacyCover, 'game-cover-v2').style.display === 'none' && byClass(legacyCover, 'game-cover-legacy').style.display === '' && /game_ludo\.webp$/.test(byClass(legacyCover, 'game-cover-legacy').src)));
  const coverFallback = makeHarness({imageOutcome:'error'});
  const failedCover = coverFallback.api.gameCoverNode('monopoly', GAME_META.monopoly);
  await settle(6);
  results.push(check('v2 and legacy cover failures finish at the existing Emoji fallback', failedCover.classList.contains('asset-failed') && byClass(failedCover, 'game-cover-fallback').style.display === '' && byClass(failedCover, 'game-cover-v2').style.display === 'none' && byClass(failedCover, 'game-cover-legacy').style.display === 'none'));

  const forcedReduced = makeHarness({forcedColors:true, reducedMotion:true, imageOutcome:'manual'});
  const decorativeIcon = forcedReduced.api.gameIconNode('gomoku', {fallback:'G'});
  const decorativeMarker = forcedReduced.api.gameSystemMarkerNode('ranking', {fallback:'R'});
  results.push(check('VM accessibility seam keeps all image atoms decorative while CSS owns forced-colors/reduced-motion', decorativeIcon.getAttribute('aria-hidden') === 'true' && decorativeMarker.getAttribute('aria-hidden') === 'true' && byClass(decorativeIcon, 'game-icon-asset-image').alt === '' && byClass(decorativeMarker, 'game-system-marker-image').alt === '' && byClass(decorativeIcon, 'game-icon-fallback').textContent === 'G' && byClass(decorativeMarker, 'game-system-marker-fallback').textContent === 'R'));

  const failures = results.filter(value => !value).length;
  if (failures){
    console.error('GAME_ICON_SYSTEM_RUNTIME_FAILURES=' + failures);
    process.exit(1);
  }
  console.log('GAME_ICON_SYSTEM_RUNTIME_ALL_PASS', JSON.stringify({checks:results.length}));
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
