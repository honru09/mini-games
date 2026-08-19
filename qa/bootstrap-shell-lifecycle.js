'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const roster = fs.readFileSync(path.join(ROOT, 'public', 'src', 'ui', '07-roster.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '02-app-shell.js'), 'utf8');

function functionSource(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('function ' + nextName + '(', start + 1);
  if (start < 0 || end <= start) throw new Error('missing function seam: ' + name);
  return source.slice(start, end);
}

function classList(initial) {
  const values = new Set(initial || []);
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name),
  };
}

let failures = 0;
function check(name, condition, detail) {
  if (condition) console.log('PASS', name);
  else {
    failures += 1;
    console.error('FAIL', name, detail || '');
  }
}

check('canonical four-route template omits the retired compact identity hosts',
  !/id=["'](?:btn-me|my-card)["']/.test(template));

const renderMeSource = functionSource(roster, 'renderMe', 'openProfileEditor');
const requireAuthSource = functionSource(shell, 'requireGhostAuth', 'initGhostShell');
const calls = { home: 0, profile: 0, auth: 0 };
const app = {
  hidden: false,
  inert: false,
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = String(value); },
};
const bodyClasses = classList(['ghost-shell-booting']);
const context = {
  account: null,
  deviceUid: null,
  online: { connected: false },
  document: { body: { classList: bodyClasses } },
  $: id => id === 'app' ? app : null,
  renderGhostHome() { calls.home += 1; },
  renderGhostProfile() { calls.profile += 1; },
  openAuthModal() { calls.auth += 1; },
  clearHonruGameReaction() {},
  exitImmersiveGameShell() {},
  authModalEl: null,
  releaseModalScrollLock() {},
};
vm.createContext(context);

let bootstrapError = null;
try {
  vm.runInContext(renderMeSource + '\n' + requireAuthSource + '\nrenderMe(); requireGhostAuth("login");', context);
} catch (error) {
  bootstrapError = error;
}
check('bootstrap can render without a retired #btn-me host', !bootstrapError,
  bootstrapError && bootstrapError.stack);
check('bootstrap exits ghost-shell-booting and presents the auth page',
  !bodyClasses.contains('ghost-shell-booting') && bodyClasses.contains('auth-required') &&
  app.hidden === true && app.inert === true && app.attributes['aria-hidden'] === 'true' && calls.auth === 1);

let repeatedRenderError = null;
try {
  vm.runInContext('renderMe(); renderMe(); renderMe();', context);
  context.account = { uid: 'member-1', name: 'Member' };
  vm.runInContext('renderMe();', context);
} catch (error) {
  repeatedRenderError = error;
}
check('language refresh, logout redraw, and member redraw tolerate the missing legacy host',
  !repeatedRenderError, repeatedRenderError && repeatedRenderError.stack);
check('retired renderMe delegates refreshes to canonical Home and Profile owners',
  calls.home === 5 && calls.profile === 5,
  JSON.stringify({ home: calls.home, profile: calls.profile }));
check('startup no longer installs an unguarded listener on the retired #btn-me host',
  !/\$\(['"]btn-me['"]\)\.addEventListener/.test(roster));

if (failures) {
  console.error('BOOTSTRAP_SHELL_LIFECYCLE_FAILURES=' + failures);
  process.exit(1);
}
console.log('BOOTSTRAP_SHELL_LIFECYCLE_ALL_PASS');
