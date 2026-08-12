#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const presenter = read('public/src/core/07-playline.js');
const bridge = read('public/src/core/11-surface-motion.js');
const adapter = read('public/surface-motion-entry.js');
const build = read('scripts/build.js');
const template = read('public/index-template.html');
const pkg = JSON.parse(read('package.json'));

let failures = 0;
let assertions = 0;
function check(value, label) {
  assertions += 1;
  if (value) console.log('PASS', label);
  else { failures += 1; console.error('FAIL', label); }
}

check(/data-direct-message-list-heading/.test(presenter) && /direct-message-unread-total/.test(presenter),
  'conversation rail exposes a stable heading and aggregate unread badge');
check(/direct-message-header-avatar/.test(presenter) && /append\(header, avatar\)/.test(presenter),
  'peer identity avatar belongs to the dialog header');
check(/function directMessageTimeText\(/.test(presenter) && /Number\.isFinite/.test(presenter),
  'message time formatter rejects invalid timestamps');
check(/direct-message-conversation-time/.test(presenter) && /directMessageTimeText\(item\.lastMessage/.test(presenter),
  'conversation rows expose safe last-message time metadata');
check(/direct-message-bubble-body/.test(presenter) && /direct-message-bubble-meta/.test(presenter),
  'message bubbles separate raw body from system metadata');
check(/setRawText\(body, message\.text/.test(presenter) && /setSystemText\(state,/.test(presenter),
  'player message text stays raw while delivery state stays localizable');
check(/safe-area-inset-top/.test(presenter) && /safe-area-inset-left/.test(presenter) &&
  /overscroll-behavior:contain/.test(presenter) && /100dvh/.test(presenter),
  'mobile dialog owns viewport safe areas and scroll containment');
check(/GhostSurfaceMotion/.test(presenter) && /runDirectSurfaceMotion\('open'/.test(presenter) &&
  /runDirectSurfaceMotion\('thread'/.test(presenter) && /runDirectSurfaceMotion\('back'/.test(presenter) && /runDirectSurfaceMotion\('close'/.test(presenter),
  'DirectMessage emits only the four frozen semantic surface phases');
check(/const interfaceValue = Object\.freeze\(\{ run, settle, dispose, snapshot \}\)/.test(bridge),
  'surface motion exposes one narrow deep Interface');
check(/document_hidden/.test(bridge) && /game_shell_active/.test(bridge) && /reduced_motion/.test(bridge),
  'surface motion settles for hidden document, Game Shell and reduced motion');
check(/environmentBlocksMotion/.test(bridge) && /canPreheat = !adapter && !loaderFailed && !environmentBlocksMotion\(\)/.test(bridge),
  'blocked environments never download the optional GSAP adapter');
check(/generation/.test(bridge) && /loaderFailed/.test(bridge) && /clearInline/.test(bridge),
  'surface motion is last-wins, sticky-failure safe and clears inline state');
check(/gsap\.timeline/.test(adapter) && /addLabel\('committed'/.test(adapter) &&
  /addLabel\('settled'/.test(adapter) && !/(?:width|height|top|left)\s*:/.test(adapter),
  'GSAP adapter uses a labelled finite transform/opacity timeline');
check(!/ScrollTrigger/.test(adapter) && /\.kill\(\)/.test(adapter) && /context\.revert/.test(adapter),
  'surface adapter has no ScrollTrigger and owns kill/revert cleanup');
check(build.includes("'core/11-surface-motion.js'") && build.indexOf("'core/11-surface-motion.js'") < build.indexOf("'core/07-playline.js'"),
  'surface bridge is built before the DirectMessage consumer');
check(!template.includes('surface-motion-entry.js') && /test:dm-design-system/.test(JSON.stringify(pkg.scripts)),
  'GSAP surface adapter stays lazy and its contract is registered');
check(!/type\s*:\s*['"](?:dm_|direct_message_)/.test(presenter) && !/\.innerHTML\s*=/.test(presenter),
  'DM presentation adds no wire type and never renders player text with innerHTML');
check(/classRemove\(mounts\.root, 'direct-message-closing'\)/.test(presenter),
  'a reopen superseding close restores pointer interaction synchronously');

if (failures) {
  console.error(`DIRECT_MESSAGE_DESIGN_SYSTEM_CONTRACT_FAILED failures=${failures} assertions=${assertions}`);
  process.exit(1);
}
console.log(`DIRECT_MESSAGE_DESIGN_SYSTEM_CONTRACT_ALL_PASS assertions=${assertions}`);
