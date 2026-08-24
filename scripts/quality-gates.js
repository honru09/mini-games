/* Fast deterministic Quality Gate runner; use npm test for the full release suite. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
let failed = false;
const failures = [];
function run(name, command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  const ok = result.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} gate:${name}`);
  if (!ok) {
    failed = true;
    failures.push({
      name,
      status: Number.isInteger(result.status) ? result.status : null,
      signal: result.signal || null,
      errorCode: result.error && result.error.code ? String(result.error.code) : null,
    });
  }
  return ok;
}
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'); }
const generated = 'public/index.html';
const before = hash(generated);
run('syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'server/index.js']);
run('static', process.platform === 'win32' ? 'node.exe' : 'node', ['scripts/validate-project-state.js']);
run('code-health', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/code-health-sweep.js']);
run('mainline-control', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/mainline-control-plane.js']);
run('approval-gate-policy', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/approval-gate-policy.js']);
run('supabase-gate-checklist-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/supabase-gate-checklist-contract.js']);
run('supabase-wizard-secret-redaction', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/supabase-wizard-secret-redaction.js']);
run('technical-optimization-mainline', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/technical-optimization-mainline-contract.js']);
run('client-diagnostics-buffer', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/client-diagnostics-buffer.js']);
run('audio-cue-inventory', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/audio-cue-inventory.js', '--strict']);
run('audio-authority-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/audio-authority-contract.js']);
run('audio-feedback-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/audio-feedback-contract.js']);
run('audio-generation-governance', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/audio-generation-governance.js']);
run('audio-runtime', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/audio-runtime.js']);
run('audio-tone-profiles', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/audio-tone-profiles.js']);
run('platform-audio-cues', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/platform-audio-cues.js']);
run('unified-feedback-adapter', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/unified-feedback-adapter.js']);
run('build-check-write', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/build-check-write.js']);
run('presentation-source', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/presentation-source-contract.js']);
run('presentation-evidence-identity', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/presentation-evidence-identity.js']);
run('feedback-bus', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/feedback-bus.js']);
run('gameplay-input-gate', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gameplay-input-gate.js']);
run('local-feedback-adapter', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/local-feedback-adapter.js']);
run('gameplay-input-gate-integration', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gameplay-upgrade.js']);
run('tank-controls-t3', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/tank-controls.js']);
run('board-ai-kernel-t4', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/board-ai-kernel.js']);
run('board-ai-worker-vm-t4', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/board-ai-worker-vm.js']);
run('board-ai-worker-broker-t4', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/board-ai-worker-broker.js']);
run('board-ai-worker-integration-t4', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/board-ai-worker-integration.js']);
run('board-ai-game-xiangqi-t4', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/board-ai-game-xiangqi.js']);
run('board-ai-game-gomoku-t4', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/board-ai-game-gomoku.js']);
run('board-ai-game-runtime-t4', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ai-games.js']);
run('tank-snapshot-wire-codec-t5', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/tank-snapshot-wire-codec.js']);
run('tank-snapshot-stream-t5', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/tank-snapshot-stream.js']);
run('tank-snapshot-client-t5', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/tank-snapshot-client.js']);
run('tank-prediction-adapter-t5', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/tank-prediction-adapter.js']);
run('tank-snapshot-default-off-t5', process.platform === 'win32' ? 'node.exe' : 'node', ['--experimental-websocket', 'qa/tank-snapshot-default-off-online.js']);
run('engagement-integrity-shadow-t6', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/engagement-integrity.js']);
run('engagement-integrity-online-t6', process.platform === 'win32' ? 'node.exe' : 'node', ['--experimental-websocket', 'qa/engagement-integrity-online.js']);
run('server-boundary-adapters-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/server-boundary-adapters.js']);
run('auth-profile-boundary-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/auth-profile-boundary.js']);
run('room-presence-boundary-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/room-presence-boundary.js']);
run('server-test-isolation-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/server-test-isolation.js']);
run('node-process-isolation-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'server/testing/isolated-node-process.js']);
run('match-protocol-boundary-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/match-protocol-boundary.js']);
run('gomoku-rule-core-parity', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gomoku-rule-core.js']);
run('gomoku-rule-authority-parity', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gomoku-rule-authority.js']);
run('gomoku-rule-authority-online-parity', process.platform === 'win32' ? 'node.exe' : 'node', ['--experimental-websocket', 'qa/gomoku-rule-authority-online.js']);
run('gomoku-protocol-fallback-parity', process.platform === 'win32' ? 'node.exe' : 'node', ['--experimental-websocket', 'qa/gomoku-protocol-fallback-online.js']);
run('chat-playline-boundary-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/chat-playline-boundary.js']);
run('reward-economy-boundary-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/reward-economy-boundary.js']);
run('reward-progression-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/reward-progression.js']);
run('server-clock-timer-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/server-clock-timer.js']);
run('transport-deadline-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/transport-deadline.js']);
run('metrics-clock-seam-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/metrics-clock-seam.js']);
run('heartbeat-sweep-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/heartbeat-sweep.js']);
run('timer-audit-t7', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/timer-audit.js']);
run('progress-ledger', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/progress-ledger.js']);
run('progress-report-write-retry', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/progress-report-write-retry.js']);
run('brief-report', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/brief-report-contract.js']);
run('vertical-slice-definition', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/vertical-slice-definition.js']);
run('adr-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/adr-contract.js']);
run('bug-intake-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/bug-intake-contract.js']);
run('performance-budget-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/performance-budget-contract.js']);
run('asset-library-governance', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/asset-library-governance.js']);
run('player-character-layered-art', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/player-character-layered-art-v1.js']);
run('art-approval-matrix', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/art-approval-matrix-contract.js']);
run('external-asset-register', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/external-asset-register-contract.js']);
run('honru-edge-cursor-v1', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/honru-edge-cursor-v1.js']);
run('identity-badge-system-v1', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/identity-badge-system-v1.js']);
run('seasonal-backgrounds-v1', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/seasonal-backgrounds-v1.js']);
run('gomoku-final-art', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gomoku-final-art-contract.js']);
run('ludo-final-art', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ludo-final-art-contract.js']);
run('monopoly-final-art', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/monopoly-final-art-contract.js']);
run('tank-final-art', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/tank-final-art-contract.js']);
run('tetris-final-art', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/tetris-final-art-contract.js']);
run('g-coins-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/g-coins-contract.js']);
run('g-coins-presentation', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/g-coins-presentation.js']);
run('visual-25d', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/visual-25d-contract.js']);
run('visual-25d-only-runtime', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/visual-25d-only-runtime.js']);
run('game-stage-wave-b-monopoly', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/game-stage-wave-b-monopoly.js']);
run('route-motion-bridge-syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'public/src/core/09-route-motion.js']);
run('route-motion-entry-syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'public/route-motion-entry.js']);
run('route-motion-contract', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ui-route-motion-contract.js']);
run('route-motion-runtime', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ui-route-motion-runtime.js']);
run('route-motion-adapter', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ui-route-motion-adapter.js']);
run('route-motion-esm-graph', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/gsap-dom-esm-graph.js']);
run('route-motion-cache', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/route-motion-cache.js']);
run('route-scroll-plural', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/route-scroll-plural.js']);
run('surface-motion-bridge-syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'public/src/core/11-surface-motion.js']);
run('surface-motion-entry-syntax', process.platform === 'win32' ? 'node.exe' : 'node', ['--check', 'public/surface-motion-entry.js']);
run('direct-message-design-system', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/direct-message-design-system-contract.js']);
run('shop-design-system-closure', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/shop-design-system-closure.js']);
run('outcome-surface-design-system', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/outcome-surface-design-system.js']);
run('surface-motion-runtime', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/surface-motion-runtime.js']);
run('surface-motion-adapter', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/surface-motion-adapter.js']);
run('game-stage-input-continuity', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/game-stage-input-continuity.js']);
run('game-stage-hud-density', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/game-stage-hud-density.js']);
run('game-stage-interaction-targets', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/game-stage-interaction-targets.js']);
run('controlled-transport-preflight', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/controlled-transport-preflight.js']);
run('profile-design-system', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/profile-design-system-contract.js']);
run('profile-request-lifecycle', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/profile-request-lifecycle.js']);
run('theme-contrast', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/theme-contrast-design-system.js']);
run('forced-colors-auth', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/forced-colors-auth-contract.js']);
run('prove-current-evidence', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/prove-current-build-evidence-contract.js']);
run('i18n', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/i18n-coverage.js']);
run('pwa-offline-i18n', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/pwa-offline-i18n.js']);
run('bootstrap-shell-lifecycle', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/bootstrap-shell-lifecycle.js']);
run('ghost-shell', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ghost-shell-contract.js']);
run('ghost-auth', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ghost-auth-credentials.js']);
run('ghost-companion', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/ghost-companion.js']);
run('dom', process.platform === 'win32' ? 'node.exe' : 'node', ['qa/dom-smoke.js']);
run('build-check', process.platform === 'win32' ? 'node.exe' : 'node', ['scripts/build.js', '--check']);
const after = hash(generated);
if (before !== after) { console.error('FAIL gate:build-check (check mutated public/index.html)'); failed = true; }
else console.log('PASS gate:build-check (generated frontend stable and check was read-only)');
if (failed) {
  console.error(`QUALITY_GATES_FAILED count=${failures.length + (before !== after ? 1 : 0)}`);
  failures.forEach(item => {
    const details = [
      Number.isInteger(item.status) ? `status=${item.status}` : '',
      item.signal ? `signal=${item.signal}` : '',
      item.errorCode ? `error=${item.errorCode}` : '',
    ].filter(Boolean).join(' ');
    console.error(`- ${item.name}${details ? ` ${details}` : ''}`);
  });
  if (before !== after) console.error('- build-check-mutated-output');
  process.exit(1);
}
console.log('QUALITY_GATES_FAST_ALL_PASS');
