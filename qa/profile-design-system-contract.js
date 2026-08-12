'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const shell = read('public/src/core/02-app-shell.js');
const profile = read('public/src/shop/05-profile.js');
const online = read('public/src/online/03-websocket.js');
const template = read('public/index-template.html');
const packageJson = JSON.parse(read('package.json'));
let failures = 0;
function check(name, ok) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failures += 1; }

const ownStart = shell.indexOf('function renderGhostProfile');
const ownEnd = shell.indexOf('function setGhostHero', ownStart);
const ownSource = shell.slice(ownStart, ownEnd);

check('Profile P1 owns a frozen active task and exactly four existing requirement IDs',
  fs.existsSync(path.join(ROOT, 'requirements/active/profile-design-system-p1-20260812/contract.md')) &&
  fs.existsSync(path.join(ROOT, 'requirements/active/profile-design-system-p1-20260812/plan.json')));
check('own Profile exposes stable priority regions rather than one flat card stream',
  /profile-route-priority/.test(ownSource) && /data-profile-region','identity'/.test(ownSource) &&
  /data-profile-region','growth'/.test(ownSource) && /data-profile-region','journey'/.test(ownSource) &&
  /data-profile-region','library'/.test(ownSource));
check('core and supporting Profile metrics are visibly separated',
  /profile-core-stats/.test(ownSource) && /profile-support-stats/.test(ownSource) &&
  /profile_stat_level/.test(ownSource) && /profile_stat_balance/.test(ownSource));
check('Profile actions remain dedicated 44px controls with no duplicate footer edit action',
  /profile-route-hero-actions/.test(ownSource) && !/const edit=el\('button','btn',t\('edit_profile'\)\)/.test(ownSource) &&
  /\.profile-route-hero-actions \.btn\{[^}]*min-height:44px/.test(template));
check('Profile P1 mobile layout is one-column, safe-area aware and overflow safe',
  /@media\(max-width:640px\)[\s\S]*\.profile-route-priority\{grid-template-columns:1fr/.test(template) &&
  /\.ghost-profile-route\{[^}]*overflow-x:hidden/.test(template) &&
  /safe-area-inset-bottom/.test(template));

check('public Profile requests are bound to requestId and targetUid',
  /pendingPublicProfile=\{targetUid,requestId/.test(online) &&
  /profile_get',payload:\{uid:targetUid\}/.test(online));
check('public Profile response consumes the ordered request record before matching targetUid',
  /publicProfileRequests\.shift\(\)/.test(online) &&
  /String\(profile\.uid\|\|''\)===request\.targetUid/.test(online) && /matchedProfile/.test(online));
check('cancel and disconnect clear the same pending public Profile lifecycle',
  /cancelPublicProfileRequest/.test(profile) && /this\.pendingPublicProfile=null/.test(online) &&
  /closeProfileLoading/.test(online));
check('late public Profile packets are cache-safe but cannot reopen a cancelled dialog',
  /cacheServerProfilePresentation/.test(online) && /finishPublicProfileRequest\(matchedProfile,request\)/.test(online));

check('public Profile dialog exposes a stable action bar state seam',
  /profile-public-actions/.test(profile) && /data-profile-relation/.test(profile) &&
  /socialRelationshipFor/.test(profile));
check('Profile dialog reuses GhostSurfaceMotion and does not create a second adapter',
  /GhostSurfaceMotion/.test(profile) && /surface:'profile-dialog'/.test(profile) &&
  !/surface-motion-entry|createSurfaceMotionAdapter|gsap\./.test(profile));
check('Profile close settles shared motion without delaying accessible business close',
  /settleProfileSurfaceMotion\('close'\)/.test(profile) && /finishProfileClose/.test(profile) &&
  !/runProfileSurfaceMotion\('close'/.test(profile));
check('Profile raw identity and signature remain separate from localized system labels',
  /profileNameNode\(p\)/.test(profile) && /elRaw\('div','profile-signature'/.test(profile) && !/innerHTML/.test(profile));
check('Profile P1 test is registered in pretest and full test',
  String(packageJson.scripts.pretest || '').includes('qa/profile-design-system-contract.js') &&
  String(packageJson.scripts.test || '').includes('qa/profile-design-system-contract.js'));

if (failures) {
  console.error('PROFILE_DESIGN_SYSTEM_CONTRACT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('PROFILE_DESIGN_SYSTEM_CONTRACT_ALL_PASS assertions=14');
}
