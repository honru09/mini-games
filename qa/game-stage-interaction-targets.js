'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ROOT,
  presentationStylePaths,
  readPresentationCss,
  readTemplate,
} = require('./presentation-source');

const template = readTemplate();
const css = readPresentationCss(template);
const immersive = fs.readFileSync(path.join(ROOT, 'public/styles/26-immersive-stage.css'), 'utf8');
const tank = fs.readFileSync(path.join(ROOT, 'public/styles/tank-controls.css'), 'utf8');
const tankPath = path.normalize(path.join(ROOT, 'public/styles/tank-controls.css'));

function ruleBodies(source, selectorToken) {
  const bodies = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1].includes(selectorToken)) bodies.push(match[2]);
  }
  return bodies;
}

assert.match(immersive, /\.game-stage-header \.btn\{[^}]*min-width:44px;min-height:44px/, 'Game Stage header actions keep a 44px target');
assert.match(immersive, /\.game-stage-avatar-button\{width:44px;height:44px/, 'Seat avatar profile entry keeps a 44px target');
assert.match(immersive, /\.game-stage-name-button\{min-width:44px;min-height:44px/, 'Seat name profile entry keeps a 44px target');
assert.match(immersive, /\.match-expression-panel \.btn[^}]*min-height:44px;min-width:44px/, 'Match expression controls keep a 44px target');
assert.match(immersive, /\.match-chat-panel \.btn\{min-height:44px;min-width:44px/, 'Match chat controls keep a 44px target');

assert.match(immersive, /--stage-header-size:clamp\(54px,[^;]+64px\)/, 'Desktop header budget contains 44px controls and padding');
assert.match(immersive, /--stage-seat-size:clamp\(58px,[^;]+68px\)/, 'Desktop seat rail budget contains 44px identity targets');
assert.match(immersive, /@media\(max-width:720px\)\{[\s\S]*--stage-header-size:54px;--stage-seat-size:58px[\s\S]*\.game-stage-seat\{[^}]*height:54px;padding:3px 5px!important/, 'Mobile header and seat geometry contains 44px targets');
assert.match(immersive, /@media\(max-height:600px\) and \(orientation:landscape\)\{[\s\S]*--stage-header-size:54px[\s\S]*\.game-stage-seat\{[^}]*height:48px;padding:1px 3px!important[\s\S]*\.game-stage-badges\{display:none\}/, 'Compact landscape keeps one 44px identity row without badge overflow');
assert.match(immersive, /\.game-stage-seats \.player-bar\{[^}]*justify-content:flex-start[^}]*overflow-x:auto;overflow-y:hidden[^}]*touch-action:pan-x[^}]*scroll-snap-type:x proximity/, 'Compact landscape seat rail scrolls horizontally instead of clipping 3–5 players');
assert.match(immersive, /\.game-stage-seat\{[^}]*flex:0 0 clamp\(116px,19vw,160px\);min-width:116px;max-width:160px[^}]*scroll-snap-align:start/, 'Compact landscape seats retain usable identity width and snap positions');
assert.ok(!/\.game-stage-seats \.player-bar\{[^}]*overflow:hidden/.test(immersive), 'Compact landscape player rail never hides overflow');
assert.ok(!/\.game-stage-seat\{[^}]*flex:1 1 0;min-width:0/.test(immersive), 'Compact landscape seats are never evenly crushed below their identity targets');
assert.match(immersive, /\.game-stage-badges\{position:absolute;[^}]*pointer-events:none\}/, 'Compact badges do not consume or intercept identity targets');

assert.match(css, /\.match-expression-grid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(44px,1fr\)\)/, 'Expression choices reflow instead of shrinking below 44px');
assert.match(css, /\.match-expression-head\{flex-wrap:wrap;min-width:0\}/, 'Expression heading can wrap in the compact tool rail');
assert.match(css, /\.match-chat-head\{justify-content:space-between;flex-wrap:wrap;min-width:0\}/, 'Match chat heading can wrap in the compact tool rail');
assert.match(css, /\.match-expression-bubble\.is-reportable\{min-width:44px;min-height:44px\}/, 'Reportable expression bubbles keep a 44px target');
assert.match(css, /\.match-chat-bubble:is\(button\)\{min-width:44px;min-height:44px[^}]*\}/, 'Reportable match chat bubbles keep a 44px target');

const forbiddenTargetSize = /(?:game-stage-header \.btn|game-stage-avatar-button|game-stage-name-button|match-expression-panel \.btn|match-chat-panel \.btn)\{[^}]*(?:min-width|min-height|width|height):(?:22|34|36|40|42)px/g;
assert.ok(!forbiddenTargetSize.test(css), 'No loaded presentation module may shrink interactive Game Stage targets below 44px');
assert.ok(!/stick dpad fire|stick fire|dpad dpad/.test(css), 'Retired simultaneous joystick and D-pad deck layouts stay removed');

for (const filePath of presentationStylePaths(template)) {
  if (path.normalize(filePath) === tankPath) continue;
  const source = fs.readFileSync(filePath, 'utf8');
  for (const body of ruleBodies(source, '.tank-control-deck')) {
    assert.ok(!/display\s*:\s*grid|grid-template-(?:columns|areas)|\bgap\s*:/.test(body), `${path.basename(filePath)} must not own the outer Tank control grid`);
  }
}

assert.match(tank, /^\.tank-control-deck\{display:grid!important;align-items:center;grid-template-columns:/m, 'Tank controls module owns the base outer deck');
assert.match(tank, /\.tank-joystick-wrap,.tank-dpad\{grid-area:move\}/, 'Only the selected movement surface occupies the move area');
assert.match(tank, /\.tank-joystick-wrap\[hidden\],\.tank-dpad\[hidden\]\{display:none!important\}/, 'Inactive movement surface is removed from layout and accessibility flow');
assert.match(tank, /@media\(max-width:720px\)[\s\S]*grid-template-areas:"move fire" "mode mode"/, 'Mobile Tank deck keeps one movement surface and one mode row');
assert.match(tank, /@media\(max-height:600px\) and \(orientation:landscape\)[\s\S]*grid-template-areas:"move fire" "mode mode"/, 'Compact landscape Tank deck keeps one movement surface');
assert.match(tank, /@media\(min-width:600px\) and \(min-height:601px\) and \(orientation:landscape\)[\s\S]*grid-template-areas:"move fire" "mode mode"/, 'Large landscape Tank deck keeps one movement surface');
assert.match(tank, /\.tank-control-mode-toggle\{[^}]*min-width:44px;min-height:44px/, 'Tank mode toggle keeps a 44px target');

console.log('GAME_STAGE_INTERACTION_TARGETS_ALL_PASS');
