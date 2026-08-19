'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');

function declaredMinHeight(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = template.match(new RegExp(escaped + '\\{[^}]*min-height:(\\d+)px[^}]*\\}'));
  return match ? Number(match[1]) : 0;
}

function declaredMinWidth(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = template.match(new RegExp(escaped + '\\{[^}]*min-width:(\\d+)px[^}]*\\}'));
  return match ? Number(match[1]) : 0;
}

assert.ok(declaredMinHeight('.ghost-auth-toolbar .btn') >= 44,
  'language and theme controls must keep the 44px touch-target floor');
assert.ok(declaredMinWidth('.ghost-auth-toolbar .btn') >= 44,
  'language and theme controls must keep the 44px touch-target width floor');
assert.ok(declaredMinHeight('.ghost-auth-tabs button') >= 44,
  'login and registration tabs must keep the 44px touch-target floor');
assert.ok(declaredMinHeight('.ghost-auth-card .nick-input') >= 44,
  'authentication inputs must keep the 44px touch-target floor');
assert.ok(!/\.ghost-auth[^{}]*\{[^}]*forced-color-adjust\s*:\s*none/i.test(template),
  'authentication surfaces must not disable the user forced-colors palette');
assert.ok(/\.ghost-auth-tabs button:focus-visible[^{}]*\{[^}]*outline:3px solid var\(--focus-color\)[^}]*outline-offset:2px/i
  .test(template.replace(/\s+/g, ' ')),
  'authentication tabs must retain a visible 3px focus indicator');

console.log('FORCED_COLORS_AUTH_CONTRACT_ALL_PASS');
