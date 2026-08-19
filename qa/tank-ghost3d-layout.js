'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'public', 'index-template.html');
const TANK = path.join(ROOT, 'public', 'src', 'games', 'tank.js');
const PRESENTER = path.join(ROOT, 'public', 'src', 'games', 'tank-ghost3d-presenter.js');
let assertions = 0;
let failures = 0;
function check(value, message) { assertions += 1; try { assert.ok(value, message); console.log('PASS  ' + message); } catch (_error) { failures += 1; console.error('FAIL  ' + message); } }
function read(file, label) { const exists = fs.existsSync(file); check(exists, label + ' exists'); return exists ? fs.readFileSync(file, 'utf8') : ''; }

const template = read(TEMPLATE, 'Game-stage stylesheet');
const tank = read(TANK, 'Tank DOM game');
const presenter = read(PRESENTER, 'Tank Ghost3D Presenter');

if (template) {
  check(/\.tank-board\{[^}]*position:relative/.test(template), 'Tank board remains the positioned DOM input host');
  check(/\.tank-ghost3d-slot\{[^}]*position:absolute[^}]*inset:0[^}]*pointer-events:none/.test(template),
    'optional Tank slot is an absolute pointer-transparent paint layer');
  check(/\.tank-ghost3d-slot\[data-ghost3d-ready="true"\]\{[^}]*visibility:visible[^}]*pointer-events:none/.test(template),
    'Tank slot is hidden until first semantic render and stays pointer-transparent when ready');
  check(/\.tank-ghost3d-slot canvas\{[^}]*width:100%[^}]*height:100%[^}]*pointer-events:none/.test(template),
    'Tank canvas fills only its slot and cannot intercept input');
  check(/@media\(max-width:720px\)\{[\s\S]{0,1800}\.tank-dpad-button\{[^}]*min-width:44px!important[^}]*min-height:44px!important/.test(template),
    'narrow-screen D-pad preserves the GAME-044 44px touch target');
  check(/@media\(prefers-reduced-motion:reduce\)\{[\s\S]{0,1800}\.tank-ghost3d-slot[^}]*animation:none!important/.test(template),
    'reduced motion disables optional Tank visual transitions');
  check(/\.tank-board\[data-ghost3d-ready="true"\] \.tank-ghost3d-dom-paint\{visibility:hidden/.test(template) &&
    /\.tank-board\[data-ghost3d-ready="true"\] \.tank-hp-status\{z-index:9[^}]*color:#fff/.test(template),
    'Ghost3D hides only replaceable paint; critical HP feedback remains visibly above its canvas');
}

if (tank) {
  check(/board\.addEventListener\('pointerdown'/.test(tank), 'board click/fire DOM path remains present');
  check(/document\.addEventListener\('keydown',keyDown\)/.test(tank) && /document\.addEventListener\('keyup',keyUp\)/.test(tank),
    'Tank keyboard control remains DOM-owned');
  check(/tank-joystick/.test(tank) && /tank-dpad/.test(tank) && /tank-fire/.test(tank),
    'joystick, D-pad, and independent fire control remain present');
  check(/tank-wave-c-process/.test(tank) && /tank-arena-hud/.test(tank),
    'Wave C process rail and HUD remain outside optional renderer ownership');
  check(/_hp=el\('span','hp tank-hp-status'\)/.test(tank) && /tank-respawn tank-ghost3d-status/.test(tank) && /tank-respawn[\s\S]{0,500}z-index:8/.test(tank),
    'Tank HP and respawn feedback opt out of replaceable paint hiding when 3D is ready');
  check(!/tank-ghost3d-slot[^\n]{0,300}addEventListener/.test(tank),
    'Tank DOM game does not attach gameplay input to the 3D slot');
}

if (presenter) {
  check(/tank-ghost3d-slot/.test(presenter) && /aria-hidden/.test(presenter) && /role.*presentation|presentation.*role/.test(presenter),
    'Presenter creates an inert accessible slot rather than an interactive game surface');
  check(!/onInput|emitInput|Raycaster|pointerdown|pointermove|keydown|touchstart/.test(presenter),
    'Presenter cannot capture desktop or touch input');
}

if (failures) { console.error('TANK_GHOST3D_LAYOUT_FAILURES=' + failures + ' assertions=' + assertions); process.exitCode = 1; }
else console.log('TANK_GHOST3D_LAYOUT_ALL_PASS assertions=' + assertions);
