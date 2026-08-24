'use strict';

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const {
  ROOT,
  readPresentationCss,
  readPresentationSource,
  presentationStylePaths,
  readTemplate,
} = require('./presentation-source');

const template = readTemplate();
const css = readPresentationCss(template);
const paths = presentationStylePaths(template);
const sw = fs.readFileSync(`${ROOT}/public/sw.js`, 'utf8');
const hash = crypto.createHash('sha256').update(css).digest('hex').toUpperCase();
const archive = fs.readFileSync(`${ROOT}/public/styles/platform-runtime.css`);
const splitRuntime = Buffer.concat(paths.slice(0, 11).map(filePath => fs.readFileSync(filePath)));

assert.strictEqual((template.match(/<style\b/gi) || []).length, 0, 'template has no inline style blocks');
assert.strictEqual(paths.length, 15, 'presentation CSS is split into fifteen bounded source modules');
assert.ok(template.indexOf('data-presentation-style') < template.indexOf('ghost-layout.css'), 'presentation modules preserve pre-layout cascade order');
assert.ok(!template.includes('href="styles/platform-runtime.css"'), 'V4 platform stylesheet archive is not loaded by production template');
assert.ok(!sw.includes("'./styles/platform-runtime.css'"), 'V4 platform stylesheet archive is not pre-cached');
assert.ok(!/https?:\/\//i.test(css), 'presentation CSS has no remote dependency');
for (const filePath of paths) {
  assert.ok(fs.existsSync(filePath), `presentation module exists: ${filePath}`);
  const relative = filePath.slice(`${ROOT}/public/`.length).replaceAll('\\', '/');
  assert.ok(sw.includes(`'./${relative}'`), `service worker pre-caches ${relative}`);
}
assert.ok(css.length > 300000, 'legacy platform CSS remains fully represented in the external source seam');
assert.ok(splitRuntime.equals(archive), 'V5 platform modules preserve byte-exact V4 source archive');
assert.strictEqual(crypto.createHash('sha256').update(splitRuntime).digest('hex').toUpperCase(), '0DB9AA1B96EA2EF1BBC6C057CC329853F3F50BC63E47099E317FBA7782C6D770', 'V5 platform archive hash is stable');
assert.ok(readPresentationSource().includes('data-qa-presentation-source'), 'QA source seam combines template and external CSS');
assert.match(hash, /^[A-F0-9]{64}$/);

assert.ok(css.includes('/* ================= Ghost Game 2.5D-first spatial system ================='), '2.5D spatial seam remains in the presentation source');
assert.ok(css.includes('/* ================= P0-12 · Game Icon System v2 ================='), 'game icon seam remains in the presentation source');
console.log(`PRESENTATION_SOURCE_V5_ALL_PASS sha256=${hash} chars=${css.length}`);
