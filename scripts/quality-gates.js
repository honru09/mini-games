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
run('mainline-control', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/mainline-control-plane.js']);
run('progress-ledger', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/progress-ledger.js']);
run('ghost3d-foundation', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ghost3d-foundation.js']);
run('gomoku-ghost3d-syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'public/three/gomoku-entry.js']);
run('gomoku-ghost3d-esm-graph', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gomoku-ghost3d-esm-graph.js']);
run('gomoku-ghost3d-renderer', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gomoku-ghost3d-renderer.js']);
run('gomoku-ghost3d-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gomoku-ghost3d-contract.js']);
run('gomoku-ghost3d-layout', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gomoku-ghost3d-layout.js']);
run('gomoku-ghost3d-cache', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gomoku-ghost3d-cache.js']);
run('route-motion-bridge-syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'public/src/core/09-route-motion.js']);
run('route-motion-entry-syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'public/route-motion-entry.js']);
run('route-motion-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ui-route-motion-contract.js']);
run('route-motion-runtime', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ui-route-motion-runtime.js']);
run('route-motion-adapter', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ui-route-motion-adapter.js']);
run('route-motion-esm-graph', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gsap-dom-esm-graph.js']);
run('route-motion-cache', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/route-motion-cache.js']);
run('surface-motion-bridge-syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'public/src/core/11-surface-motion.js']);
run('surface-motion-entry-syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'public/surface-motion-entry.js']);
run('direct-message-design-system', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/direct-message-design-system-contract.js']);
run('surface-motion-runtime', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/surface-motion-runtime.js']);
run('surface-motion-adapter', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/surface-motion-adapter.js']);
run('profile-design-system', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/profile-design-system-contract.js']);
run('profile-request-lifecycle', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/profile-request-lifecycle.js']);
run('theme-contrast', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/theme-contrast-design-system.js']);
run('i18n', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/i18n-coverage.js']);
run('ghost-shell', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ghost-shell-contract.js']);
run('ghost-auth', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ghost-auth-credentials.js']);
run('ghost-companion', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ghost-companion.js']);
run('dom', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/dom-smoke.js']);
run('build-drift', process.platform === 'win32' ? 'node.exe' : 'node', ['scripts/build.js']);
const after = hash(generated);
if (before !== after) { console.error('FAIL gate:build-drift (build changed public/index.html; regenerate and stage it)'); failed = true; }
else console.log('PASS gate:build-drift (generated frontend stable)');
if (failed) process.exit(1);
console.log('QUALITY_GATES_FAST_ALL_PASS');
