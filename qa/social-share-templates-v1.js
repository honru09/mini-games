'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = value => fs.readFileSync(path.join(ROOT, value), 'utf8');
const json = value => JSON.parse(read(value));
const moduleSource = read('public/src/core/31-social-share-template.js');
const playlineSource = read('public/src/core/07-playline.js');
const { readPresentationSource } = require('./presentation-source');
const templateSource = readPresentationSource();
const assetSource = read('public/src/core/06-assets.js');
const buildSource = read('scripts/build.js');
const packageJson = json('package.json');
const reviewSource = read('art-source/platform/social-share-templates-v1/review/social-share-template-review.html');
const createModule = require(path.join(ROOT, 'public/src/core/31-social-share-template.js'));
const familyManifest = json('art-source/platform/social-share-templates-v1/asset-family-manifest-v1.json');
const sha256 = value => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, value))).digest('hex').toUpperCase();

function pass(label) { console.log('PASS ' + label); }

assert(moduleSource.includes('PRESENTATION') || moduleSource.includes('Presentation-only'));
assert(playlineSource.includes('shareTemplateModel'));
assert(playlineSource.includes('GhostSocialShareTemplate.mount'));
for (const id of ['SOC-033', 'GAME-030']) {
  assert(read('art-source/production/ghost-game-art-program-v1/production-ledger-v1.json').includes(id));
}
pass('P2-09 stays presentation-only and binds existing requirements');

assert.strictEqual(familyManifest.familyId, 'P-SOCIAL-SHARE-TEMPLATES-V1');
assert.strictEqual(familyManifest.clearance, 'OWNER_AUTHORIZED_ART_CLEARANCE');
assert.strictEqual(familyManifest.featureFlag.id, 'mg_art_social_share_templates_v1');
for (const file of familyManifest.runtimeFiles.concat(familyManifest.reviewFiles)) {
  assert.strictEqual(fs.statSync(path.join(ROOT, file.path)).size, file.bytes, file.path);
  assert.strictEqual(sha256(file.path), file.sha256, file.path);
}
const skillRouting = read('art-source/platform/social-share-templates-v1/SKILL_ROUTING.md');
for (const skill of ['imagegen','ai-image-generation','gpt-image','image','happy-image-gen','html-to-image','website-screenshot','code-to-image','og-image']) assert(skillRouting.includes('`' + skill + '`:'), skill);
assert(skillRouting.includes('html-to-image`: `APPLIED`') && skillRouting.includes('og-image`: `APPLIED`'));
pass('family manifest, review hashes and nine-skill routing are pinned');

assert.deepStrictEqual(Object.keys(createModule), ['create']);
const forbidden = /\b(innerHTML|fetch|WebSocket|localStorage|sessionStorage)\b/;
assert(!forbidden.test(moduleSource), 'share module must not own network, HTML parsing or persistence');
for (const forbiddenFact of ['uid', 'token', 'payload', 'reward', 'visibility', 'permission']) {
  assert(!new RegExp('input\\.' + forbiddenFact + '\\b').test(moduleSource), 'must not consume ' + forbiddenFact);
}
pass('narrow seam and authority/privacy boundary');

function createDocument() {
  const doc = {};
  doc.createElement = tagName => {
    const node = {
      tagName: String(tagName).toUpperCase(),
      ownerDocument: doc,
      className: '',
      textContent: '',
      dataset: {},
      attributes: {},
      children: [],
      parentNode: null,
      hidden: false,
      isConnected: true,
      appendChild(child) { child.parentNode = this; child.isConnected = this.isConnected; this.children.push(child); return child; },
      removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; child.isConnected = false; return child; },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      removeAttribute(name) { delete this.attributes[name]; if (name === 'src') delete this.src; },
      remove() { if (this.parentNode) this.parentNode.removeChild(this); else this.isConnected = false; }
    };
    return node;
  };
  return doc;
}

function flattenText(node) {
  return [node.textContent].concat((node.children || []).map(flattenText)).join(' ');
}

function findByClass(node, className) {
  if (String(node.className || '').split(/\s+/).includes(className)) return node;
  for (const child of node.children || []) { const found = findByClass(child, className); if (found) return found; }
  return null;
}

(async () => {
  const doc = createDocument();
  const host = doc.createElement('section');
  let resolveLate;
  const api = createModule.create({
    root: { document: doc, matchMedia: () => ({ matches: true }) },
    resolveArt: (role, useStatic) => {
      assert.strictEqual(role, 'card-result');
      assert.strictEqual(useStatic, true);
      return new Promise(resolve => { resolveLate = resolve; });
    }
  });
  assert.deepStrictEqual(Object.keys(api), ['mount']);
  assert.strictEqual(api.mount(host, { kind: 'text', role: 'card-result' }), null);
  assert.strictEqual(api.mount(host, { kind: 'result_share', role: 'card-record' }), null);
  const handle = api.mount(host, {
    kind: 'result_share', role: 'card-result', tone: 'win',
    kicker: '  战\u0000报  ', title: 'Cafe\u0301\n俄罗斯方块', metric: '胜利',
    detail: '这一局，值得被记住', brand: 'GHOST GAME'
  });
  assert(handle && handle.root && handle.root.attributes['aria-hidden'] === 'true');
  assert.strictEqual(handle.snapshot().artReady, false);
  const rendered = flattenText(handle.root);
  assert(rendered.includes('Café 俄罗斯方块'));
  assert(!rendered.includes('\u0000'));
  await Promise.resolve();
  assert.strictEqual(typeof resolveLate, 'function');
  assert.strictEqual(handle.destroy(), true);
  assert.strictEqual(handle.destroy(), false);
  resolveLate('/should-not-attach.webp');
  await Promise.resolve(); await Promise.resolve();
  assert.strictEqual(handle.snapshot().destroyed, true);
  assert.strictEqual(handle.snapshot().artReady, false);
  pass('allowlists, NFC/control cleanup, hidden decorative semantics and late async disposal');

  const failureHost = doc.createElement('section');
  const failureApi = createModule.create({ root: { document: doc }, resolveArt: () => Promise.resolve('/broken.webp') });
  const failureHandle = failureApi.mount(failureHost, { kind: 'record_share', role: 'card-record', title: 'Total wins', metric: '12' });
  const failureArt = findByClass(failureHandle.root, 'social-share-template-art');
  failureArt.decode = () => Promise.reject(new Error('decode failed'));
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(typeof failureArt.onload, 'function');
  failureArt.onload();
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(failureHandle.snapshot().artReady, false);
  assert.strictEqual(failureHandle.root.dataset.artState, 'fallback');
  assert.strictEqual(failureArt.src, undefined);
  failureHandle.destroy();
  pass('decode failure remains on the code-native fallback');

  for (const locale of ['zh-CN', 'en-US', 'uk-UA']) {
    const dict = json('public/locales/' + locale + '.json');
    assert(typeof dict.playline_share_template_tagline === 'string' && dict.playline_share_template_tagline.trim());
    for (const key of ['playline_record_total_wins', 'playline_record_level', 'playline_record_game_wins', 'playline_record_mastery']) {
      assert(typeof dict[key] === 'string' && dict[key].trim(), locale + ' missing ' + key);
    }
  }
  assert(playlineSource.includes("recordKey === 'level'"));
  assert(playlineSource.includes("recordKey === 'total_wins'"));
  assert(playlineSource.includes("/^(game_wins|mastery):"));
  pass('three-language template copy and four canonical record families');

  assert(templateSource.includes('aspect-ratio:1200/630'));
  assert(templateSource.includes('@media(max-width:520px)'));
  assert(templateSource.includes('@media(prefers-reduced-motion:reduce)'));
  assert(templateSource.includes('@media(forced-colors:active)'));
  assert(!/social-share-template[^}]*\b(?:top|left|width|height)\s*:[^;}]*transition/i.test(templateSource));
  assert(reviewSource.includes('width:1200px') && reviewSource.includes('height:630px'));
  for (const sample of ['这一局，值得被记住', 'A match worth remembering', 'Матч, який варто запам’ятати']) assert(reviewSource.includes(sample));
  pass('1200x630 review, narrow layout, reduced motion and forced colors');

  assert(playlineSource.includes('__ghostSocialShareTemplateHandle = mounted'));
  assert(assetSource.includes("const SOCIAL_SHARE_TEMPLATES_FLAG = 'mg_art_social_share_templates_v1'"));
  assert(assetSource.includes('return ownerClearedDefaultOnFlagEnabled(SOCIAL_SHARE_TEMPLATES_FLAG)'));
  assert(playlineSource.includes("typeof socialShareTemplatesEnabled !== 'function' || socialShareTemplatesEnabled()"));
  assert(playlineSource.includes("makeElement('img', 'community-card-art')"));
  assert(playlineSource.includes('art.isConnected === false'));
  assert(playlineSource.includes('art.onload = function ()'));
  assert(playlineSource.includes('art.onerror = function ()'));
  assert(playlineSource.includes('destroyCommunityCardArt(card)'));
  assert(moduleSource.includes('art.onload = function'));
  assert(moduleSource.includes("typeof art.decode !== 'function'"));
  assert(moduleSource.includes('art.onerror = failArt'));
  assert(moduleSource.includes('art.onload = null; art.onerror = null'));
  assert(playlineSource.includes('.playline-card>.community-card-art'));
  assert(buildSource.includes("'core/31-social-share-template.js'"));
  assert(packageJson.scripts['test:social-share-templates'].includes('qa/social-share-templates-v1.js'));
  assert(packageJson.scripts.pretest.includes('npm run test:social-share-templates'));
  pass('Playline fallback, detached-node guard, build and full-suite entry');

  console.log('SOCIAL_SHARE_TEMPLATES_V1_ALL_PASS');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
