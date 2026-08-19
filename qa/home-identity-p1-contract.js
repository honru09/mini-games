'use strict';

/* Latest-product ruling: Home may show aggregate social/collection signals and
 * a Profile navigation action, but must not duplicate the equipped avatar,
 * raw nickname, level, achievements, or full player card owned by Profile. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const template = read('public/index-template.html');
const shell = read('public/src/core/02-app-shell.js');
const pkg = JSON.parse(read('package.json'));
const locales = ['zh-CN','en-US','uk-UA'].map(lang => JSON.parse(read('public/locales/' + lang + '.json')));
const homeStart = template.indexOf('data-app-route="home"');
const homeEnd = template.indexOf('data-app-route="games"', homeStart);
const home = homeStart >= 0 && homeEnd > homeStart ? template.slice(homeStart, homeEnd) : '';
const renderStart = shell.indexOf('function renderGhostHome');
const renderEnd = shell.indexOf('function chatRawNode', renderStart);
const renderHome = renderStart >= 0 && renderEnd > renderStart ? shell.slice(renderStart, renderEnd) : '';

const failures = [];
function check(name, condition){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name);
  if (!condition) failures.push(name);
}

check('Home contains no duplicate identity strip or full player card',
  !/home-pulse-identity|id="my-card"|id="btn-me"/.test(home));
check('Home renderer no longer reconstructs equipped avatar, nickname, or level',
  !/home-pulse-identity|pulseIdentity|avatarStageNode|nameFxNode/.test(renderHome));
check('Home pulse keeps only aggregate signals and explicit navigation actions',
  /home-pulse-friends/.test(home) && /home-pulse-collection/.test(home) && /home-pulse-goal/.test(home) &&
  /btn-home-pulse-profile/.test(home) && /btn-home-pulse-chat/.test(home) && /btn-home-pulse-shop/.test(home));
check('Home route does not own achievement or detailed profile sections',
  !/achievement|profile-route-|profile-growth|profile-game-grid/i.test(home));
check('Removed identity-strip copy is absent from all three locale catalogs',
  locales.every(locale => !Object.prototype.hasOwnProperty.call(locale, 'home_pulse_identity_label')));
check('The latest identity-owner ruling remains in pretest and full test chains',
  String(pkg.scripts.pretest || '').includes('qa/home-identity-p1-contract.js') &&
  String(pkg.scripts.test || '').includes('qa/home-identity-p1-contract.js'));

if (failures.length){
  console.error('HOME_IDENTITY_OWNER_CONTRACT_FAILURES=' + failures.length);
  process.exit(1);
}
console.log('HOME_IDENTITY_OWNER_CONTRACT_ALL_PASS');
