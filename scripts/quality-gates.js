/* Fast deterministic Quality Gate runner; use npm test for the full release suite. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
let failed = false;
function run(name, command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  const ok = result.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} gate:${name}`);
  if (!ok) failed = true;
  return ok;
}
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'); }
const generated = 'public/index.html';
const before = hash(generated);
run('syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'server/index.js']);
run('static', process.platform === 'win32' ? 'node.exe' : 'node', ['scripts/validate-project-state.js']);
run('i18n', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/i18n-coverage.js']);
run('dom', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/dom-smoke.js']);
run('build-drift', process.platform === 'win32' ? 'node.exe' : 'node', ['scripts/build.js']);
const after = hash(generated);
if (before !== after) { console.error('FAIL gate:build-drift (build changed public/index.html; regenerate and stage it)'); failed = true; }
else console.log('PASS gate:build-drift (generated frontend stable)');
if (failed) process.exit(1);
console.log('QUALITY_GATES_FAST_ALL_PASS');
