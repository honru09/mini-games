'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const template = read('public/index-template.html');
const css = read('public/ghost-layout.css');
const modules = [
  read('public/styles/00-layout-tokens.css'),
  read('public/styles/10-layout-shell.css'),
  read('public/styles/20-layout-surfaces.css'),
  read('public/styles/30-layout-commerce.css'),
  read('public/styles/40-layout-content.css'),
].join('\n');
const sw = read('public/sw.js');

assert.ok(fs.existsSync(path.join(ROOT, 'public', 'ghost-layout.css')), 'external layout stylesheet exists');
assert.ok(/<link rel="stylesheet" href="ghost-layout\.css">/.test(template), 'template links the external layout stylesheet');
assert.ok(template.indexOf('ghost-layout.css') < template.indexOf('<\/head>'), 'layout stylesheet is loaded in head');
assert.ok(/data-layout-system="v1"/.test(template), 'template opts into layout system v1');
assert.ok(css.includes('./styles/00-layout-tokens.css'), 'layout manifest imports token module');
assert.ok(css.includes('./styles/10-layout-shell.css'), 'layout manifest imports shell module');
assert.ok(css.includes('./styles/20-layout-surfaces.css'), 'layout manifest imports surface module');
assert.ok(css.includes('./styles/30-layout-commerce.css'), 'layout manifest imports commerce module');
assert.ok(css.includes('./styles/40-layout-content.css'), 'layout manifest imports content module');
assert.ok(modules.includes('--ghost-layout-max: 1240px'), 'layout system owns a bounded desktop canvas');
assert.ok(modules.includes('grid-template-areas:'), 'home layout uses named regions instead of implicit placement');
assert.ok(modules.includes('.games-workspace-grid'), 'games route has an explicit workspace geometry');
assert.ok(modules.includes('.playline-layout'), 'Playline route has an explicit workspace geometry');
assert.ok(modules.includes('.profile-route-content'), 'Profile route keeps an explicit content geometry');
assert.ok(modules.includes('.game-stage-header'), 'Game Stage header has a bounded layout seam');
assert.ok(modules.includes('@media (max-width: 640px)'), 'mobile layout contract exists');
assert.ok(modules.includes('@media (prefers-reduced-motion: reduce)'), 'reduced-motion fallback exists');
assert.ok(modules.includes('@media (forced-colors: active)'), 'forced-colors fallback exists');
assert.ok(fs.existsSync(path.join(ROOT, 'public', 'styles', '00-layout-tokens.css')), 'token module exists');
assert.ok(fs.existsSync(path.join(ROOT, 'public', 'styles', '10-layout-shell.css')), 'shell module exists');
assert.ok(fs.existsSync(path.join(ROOT, 'public', 'styles', '20-layout-surfaces.css')), 'surface module exists');
assert.ok(fs.existsSync(path.join(ROOT, 'public', 'styles', '30-layout-commerce.css')), 'commerce module exists');
assert.ok(fs.existsSync(path.join(ROOT, 'public', 'styles', '40-layout-content.css')), 'content module exists');
assert.ok(sw.includes("'./ghost-layout.css'"), 'offline shell pre-caches the external layout stylesheet');
assert.ok(/CACHE_VERSION='ghost-game-shell-v20-20260823'/.test(sw), 'service worker cache version advances with the presentation source split');
for (const asset of ['./styles/00-layout-tokens.css', './styles/10-layout-shell.css', './styles/20-layout-surfaces.css']) {
  assert.ok(sw.includes(`'${asset}'`), `offline shell pre-caches ${asset}`);
}
assert.ok(sw.includes("'./styles/30-layout-commerce.css'"), 'offline shell pre-caches commerce module');
assert.ok(sw.includes("'./styles/40-layout-content.css'"), 'offline shell pre-caches content module');
assert.ok(modules.includes('game-stage-command'), 'content module keeps a bounded command rail seam');
assert.ok(!/ghost-layout\.css[\s\S]{0,120}https?:\/\//.test(css), 'layout stylesheet has no remote dependency');

console.log('LAYOUT_SYSTEM_V1_ALL_PASS');
