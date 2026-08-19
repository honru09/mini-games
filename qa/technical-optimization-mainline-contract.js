'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, '');
const ledger = JSON.parse(read('requirements/PRODUCT_REQUIREMENTS_LEDGER.json'));
const routing = JSON.parse(read('requirements/MAINLINE_CONTROL_ROUTING.json'));
const projectStatus = JSON.parse(read('PROJECT_STATUS.json'));
const plan = JSON.parse(read('requirements/active/technical-optimization-mainline-p0-20260816/plan.json'));
const requirement = read('requirements/active/technical-optimization-mainline-p0-20260816/requirement.md');
const contract = read('requirements/active/technical-optimization-mainline-p0-20260816/contract.md');
const acceptance = read('requirements/active/technical-optimization-mainline-p0-20260816/acceptance.md');
const t7Requirement = read('requirements/active/t7-room-presence-boundary-p2-20260817/requirement.md');
const t7Plan = JSON.parse(read('requirements/active/t7-room-presence-boundary-p2-20260817/plan.json'));
const t7Contract = read('requirements/active/t7-room-presence-boundary-p2-20260817/contract.md');
const t7Acceptance = read('requirements/active/t7-room-presence-boundary-p2-20260817/acceptance.md');
const t7Execution = JSON.parse(read('requirements/active/t7-room-presence-boundary-p2-20260817/execution.json'));
const t7Ownership = JSON.parse(read('requirements/active/t7-room-presence-boundary-p2-20260817/ownership.json'));
const matchAcceptance = read('requirements/active/t7-match-protocol-boundary-p3-20260817/acceptance.md');
const matchExecution = JSON.parse(read('requirements/active/t7-match-protocol-boundary-p3-20260817/execution.json'));
const chatAcceptance = read('requirements/active/t7-chat-playline-boundary-p4-20260817/acceptance.md');
const chatPlan = JSON.parse(read('requirements/active/t7-chat-playline-boundary-p4-20260817/plan.json'));
const rewardAcceptance = read('requirements/active/t7-reward-economy-boundary-p5-20260817/acceptance.md');
const rewardPlan = JSON.parse(read('requirements/active/t7-reward-economy-boundary-p5-20260817/plan.json'));
const rewardExecution = JSON.parse(read('requirements/active/t7-reward-economy-boundary-p5-20260817/execution.json'));
const p6Plan = JSON.parse(read('requirements/active/t7-server-clock-timer-p6-20260817/plan.json'));
const p6Execution = JSON.parse(read('requirements/active/t7-server-clock-timer-p6-20260817/execution.json'));
const p6Requirement = read('requirements/active/t7-server-clock-timer-p6-20260817/requirement.md');
const p6Acceptance = read('requirements/active/t7-server-clock-timer-p6-20260817/acceptance.md');
const p7Plan = JSON.parse(read('requirements/active/t7-reward-progression-projection-p7-20260818/plan.json'));
const p7Requirement = read('requirements/active/t7-reward-progression-projection-p7-20260818/requirement.md');
const p7Contract = read('requirements/active/t7-reward-progression-projection-p7-20260818/contract.md');
const p7Acceptance = read('requirements/active/t7-reward-progression-projection-p7-20260818/acceptance.md');
const p12Plan = JSON.parse(read('requirements/active/t7-heartbeat-sweep-timer-p12-20260819/plan.json'));
const p12Contract = read('requirements/active/t7-heartbeat-sweep-timer-p12-20260819/contract.md');
const p12Acceptance = read('requirements/active/t7-heartbeat-sweep-timer-p12-20260819/acceptance.md');
const policy = read('requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md');
const template = read('public/index-template.html');
const currentBuildSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'public/index.html'))).digest('hex').toUpperCase();

const known = new Set(ledger.requirements.map(item => item.id));
const covered = ledger.requestCoverage['technical-optimization-authorized'];
assert(covered && covered.ids.length >= 20, 'the technical authorization must remain visible in request coverage');
assert(covered.ids.every(id => known.has(id)), 'technical authorization coverage must only reuse known atomic requirements');

const plannedIds = [...new Set(plan.waves.flatMap(wave => wave.requirements))];
assert(plannedIds.every(id => known.has(id)), 'every technical optimization wave must route to an existing requirement');
assert.strictEqual(plan.waves[0].status, 'implemented', 'T0 authorization/contract freeze is complete');
assert.strictEqual(plan.waves[1].status, 'implemented', 'T1 local diagnostics/renderer baseline must be recorded as implemented');
assert.strictEqual(plan.waves[2].status, 'implemented', 'T2 Loader/build/SW local baseline must be recorded as implemented');
assert.strictEqual(plan.waves[3].status, 'implemented', 'T3 feedback/input/spatial-audio local vertical slice must be recorded as implemented');
assert.strictEqual(plan.waves[4].status, 'implemented', 'T4 board AI worker vertical slice must be recorded as implemented');
assert.strictEqual(plan.waves[5].status, 'implemented', 'T5 Tank transport/prediction vertical slice must be recorded as implemented');
assert.strictEqual(plan.waves[6].status, 'implemented', 'T6 Tank shadow vertical slice must be recorded as implemented');
assert.strictEqual(plan.waves[7].status, 'partial', 'T7 must record the truthful Operational Metrics first slice without claiming all server ownership moved');
assert(plan.waves.slice(8).every(wave => wave.status === 'planned'), 'future technical waves after T7 must not be claimed as implemented');
assert.strictEqual(plan.release, 'LOCAL_ONLY_NOT_RELEASED', 'technical authorization must not grant release');

for (const marker of [
  'TankSnapshotWireCodec', 'TankPredictionAdapter', 'RendererRuntimeGovernor',
  'GameplayInputGate', 'BoardAIWorkerBroker', 'EngagementIntegrityAnalyzer',
  'ClientDiagnosticsRing', 'GameModuleLoader', 'ServerBoundaryAdapters'
]) assert(contract.includes(marker), `deep module contract must include ${marker}`);

for (const [relative, marker] of [
  ['public/src/core/13-client-diagnostics-ring.js', 'ClientDiagnosticsRing'],
  ['public/src/core/13-renderer-runtime-governor.js', 'RendererRuntimeGovernor'],
  ['public/src/core/13-renderer-quality-adapter.js', 'RendererQualityAdapter'],
  ['qa/client-diagnostics-buffer.js', 'CLIENT_DIAGNOSTICS_BUFFER_ALL_PASS'],
  ['qa/renderer-runtime-governor.js', 'RENDERER_RUNTIME_GOVERNOR_ALL_PASS']
]) assert(read(relative).includes(marker), `T1 artifact must include ${marker}`);

const buildScript = read('scripts/build.js');
  assert(buildScript.includes("core/13-client-diagnostics-ring.js") && buildScript.includes("core/13-renderer-runtime-governor.js") && buildScript.includes("core/13-renderer-quality-adapter.js"), 'T1 modules must be present in the deterministic build graph');
assert(buildScript.includes("core/14-game-module-loader.js"), 'T2 Loader must be present in the deterministic build graph');
assert(read('public/src/core/14-game-module-loader.js').includes('GameModuleLoader'), 'T2 Loader artifact must be present');
assert(read('qa/game-module-loader.js').includes('GAME_MODULE_LOADER_ALL_PASS'), 'T2 Loader QA must be registered');
assert(read('qa/build-check-write.js').includes('BUILD_CHECK_WRITE_ALL_PASS'), 'T2 deterministic build QA must be registered');
assert(read('qa/sw-game-module-preheat.js').includes('SW_GAME_MODULE_PREHEAT_ALL_PASS'), 'T2 SW preheat QA must be registered');

for (const [relative, marker] of [
  ['public/src/core/15-feedback-bus.js', 'FeedbackBus'],
  ['public/src/core/16-gameplay-input-gate.js', 'GameplayInputGate'],
  ['public/src/core/17-local-feedback-adapter.js', 'LocalFeedbackAdapter'],
  ['qa/feedback-bus.js', 'FEEDBACK_BUS_ALL_PASS'],
  ['qa/gameplay-input-gate.js', 'GAMEPLAY_INPUT_GATE_ALL_PASS'],
  ['qa/local-feedback-adapter.js', 'LOCAL_FEEDBACK_ADAPTER_ALL_PASS']
]) assert(read(relative).includes(marker), `T3 artifact must include ${marker}`);
const t3BuildOrder = [
  buildScript.indexOf("core/15-feedback-bus.js"),
  buildScript.indexOf("core/16-gameplay-input-gate.js"),
  buildScript.indexOf("core/17-local-feedback-adapter.js")
];
assert(t3BuildOrder.every(index => index >= 0) && t3BuildOrder[0] < t3BuildOrder[1] && t3BuildOrder[1] < t3BuildOrder[2],
  'T3 modules must be ordered in the deterministic build graph');
const tetrisSource = read('public/src/games/tetris.js');
const tankSource = read('public/src/games/tank.js');
assert(tetrisSource.includes("gameplayInputGateV1") && tetrisSource.includes("dispatchTetrisInputIntent"),
  'Tetris rule-v3 caller must expose the default-off semantic InputGate seam');
assert(tankSource.includes("control_state") && tankSource.includes("dispatchTankInputIntent"),
  'Tank Authority caller must preserve complete semantic control state through InputGate');
assert(tankSource.includes("tankSpatialAudioV1") && tankSource.includes("emitTankFeedback('tank_fire'") && tankSource.includes("onAuthoritySnapshot"),
  'Tank spatial feedback must remain a default-off accepted-authority vertical slice');
const packageJson = JSON.parse(read('package.json'));
assert(packageJson.scripts['test:technical-optimization-t3'].includes('qa/local-feedback-adapter.js'),
  'T3 focused suite must be registered in package scripts');
assert(read('scripts/quality-gates.js').includes("run('local-feedback-adapter'"),
  'T3 local feedback adapter must be part of shared quality gates');

const t4BuildOrder = [
  buildScript.indexOf("core/18-board-ai-kernel.js"),
  buildScript.indexOf("core/19-board-ai-worker-broker.js")
];
assert(t4BuildOrder.every(index => index >= 0) && t4BuildOrder[0] < t4BuildOrder[1],
  'T4 kernel must precede the broker in the deterministic build graph');
for (const [relative, marker] of [
  ['public/src/core/18-board-ai-kernel.js', 'BoardAIKernel'],
  ['public/src/core/19-board-ai-worker-broker.js', 'BoardAIWorkerBroker'],
  ['public/workers/board-ai-worker-v1.js', 'BOARD_AI_SEARCH_V1'],
  ['qa/board-ai-kernel.js', 'BOARD_AI_KERNEL_ALL_PASS'],
  ['qa/board-ai-worker-vm.js', 'BOARD_AI_WORKER_VM_ALL_PASS'],
  ['qa/board-ai-worker-broker.js', 'BOARD_AI_WORKER_BROKER_ALL_PASS'],
  ['qa/board-ai-worker-integration.js', 'BOARD_AI_WORKER_INTEGRATION_ALL_PASS'],
  ['qa/board-ai-game-xiangqi.js', 'BOARD_AI_GAME_XIANGQI_ALL_PASS'],
  ['qa/board-ai-game-gomoku.js', 'BOARD_AI_GAME_GOMOKU_ALL_PASS']
]) assert(read(relative).includes(marker), `T4 artifact must include ${marker}`);
assert(packageJson.scripts['test:technical-optimization-t4'].includes('qa/board-ai-game-gomoku.js') && packageJson.scripts['test:technical-optimization-t4'].includes('qa/ai-games.js'),
  'T4 focused suite must be registered in package scripts');
assert(read('scripts/quality-gates.js').includes("run('board-ai-game-gomoku-t4'"),
  'T4 Gomoku caller QA must be part of shared quality gates');

const t5BuildOrder = [
  buildScript.indexOf("../../shared/protocol/tank-snapshot-wire-codec.js"),
  buildScript.indexOf("online/03-websocket.js"),
  buildScript.indexOf("core/20-tank-prediction-adapter.js"),
  buildScript.indexOf("games/tank.js")
];
assert(t5BuildOrder.every(index => index >= 0) && t5BuildOrder[0] < t5BuildOrder[1] && t5BuildOrder[2] < t5BuildOrder[3],
  'T5 codec/prediction modules must precede their browser callers');
for (const [relative, marker] of [
  ['shared/protocol/tank-snapshot-wire-codec.js', 'TankSnapshotWireCodec'],
  ['server/gameplay/tank-snapshot-stream.js', 'createTankSnapshotStream'],
  ['public/src/core/20-tank-prediction-adapter.js', 'TankPredictionAdapter'],
  ['qa/tank-snapshot-wire-codec.js', 'TANK_SNAPSHOT_WIRE_CODEC_ALL_PASS'],
  ['qa/tank-snapshot-stream.js', 'TANK_SNAPSHOT_STREAM_ALL_PASS'],
  ['qa/tank-snapshot-client.js', 'TANK_SNAPSHOT_CLIENT_ALL_PASS'],
  ['qa/tank-prediction-adapter.js', 'TANK_PREDICTION_ADAPTER_ALL_PASS'],
  ['qa/tank-snapshot-delta-online.js', 'TANK_SNAPSHOT_DELTA_ONLINE_ALL_PASS'],
  ['qa/tank-snapshot-default-off-online.js', 'TANK_SNAPSHOT_DEFAULT_OFF_ONLINE_ALL_PASS']
]) assert(read(relative).includes(marker), `T5 artifact must include ${marker}`);
assert(tankSource.includes("tankPredictionV1") && tankSource.includes('submitTankPrediction') && tankSource.includes('acceptTankPrediction'),
  'Tank Authority caller must expose the default-off prediction seam');
assert(packageJson.scripts['test:technical-optimization-t5'].includes('qa/tank-snapshot-delta-online.js') &&
  packageJson.scripts['test:technical-optimization-t5'].includes('qa/tank-snapshot-default-off-online.js') &&
  packageJson.scripts.pretest.includes('test:technical-optimization-t5') && packageJson.scripts.posttest.includes('test:technical-optimization-t5'),
  'T5 focused suite must be registered in pretest/posttest');
assert(read('scripts/quality-gates.js').includes("run('tank-prediction-adapter-t5'"),
  'T5 prediction QA must be part of shared quality gates');
const activeParallelBuildDrift = projectStatus.parallelBuildDrift20260819 &&
  projectStatus.parallelBuildDrift20260819.status === 'active';
const buildIdentityIsBound = acceptance.includes(currentBuildSha) ||
  (activeParallelBuildDrift && acceptance.includes('并行构建状态') &&
   acceptance.includes('自动生成 TECH-027 报告') && acceptance.includes('build --check') &&
   read('简易报告/项目总需求进度报告-20260819.md').includes(currentBuildSha));
assert(acceptance.includes('## T5 已完成') && buildIdentityIsBound,
  'T5/T7 acceptance must bind a stable build or explicitly record current parallel build drift');

for (const [relative, marker] of [
  ['server/gameplay/engagement-integrity.js', 'EngagementIntegrityAnalyzer'],
  ['qa/engagement-integrity.js', 'ENGAGEMENT_INTEGRITY_ALL_PASS'],
  ['qa/engagement-integrity-online.js', 'ENGAGEMENT_INTEGRITY_ONLINE_ALL_PASS']
]) assert(read(relative).includes(marker), `T6 artifact must include ${marker}`);
assert(read('server/index.js').includes('ENABLE_ENGAGEMENT_INTEGRITY_SHADOW') &&
  read('server/index.js').includes('observeAcceptedTankInput') &&
  read('server/index.js').includes('finalizeRoomEngagementIntegrity'),
  'T6 server seam must remain independently default-off and lifecycle-bound');
assert(packageJson.scripts['test:technical-optimization-t6'].includes('qa/engagement-integrity-online.js') &&
  packageJson.scripts['pretest:technical-optimization-t5'].includes('test:technical-optimization-t6') &&
  read('scripts/quality-gates.js').includes("run('engagement-integrity-online-t6'"),
  'T6 shadow QA must be registered in focused and shared gates');
assert(contract.includes('EngagementIntegrityAnalyzer') && requirement.includes('APM') && requirement.includes('Action Entropy'),
  'T6 shadow contract and non-punitive scope must remain explicit');

for (const [relative, marker] of [
  ['server/boundaries/operational-metrics.js', 'createOperationalMetricsBoundary'],
  ['server/boundaries/auth-profile.js', 'createAuthProfileBoundary'],
  ['server/testing/isolated-node-process.js', 'isolated_node_process_disposed'],
  ['server/testing/isolated-test-group.js', 'test_group_isolation_collision'],
  ['qa/server-boundary-adapters.js', 'SERVER_BOUNDARY_ADAPTERS_ALL_PASS'],
  ['qa/auth-profile-boundary.js', 'AUTH_PROFILE_BOUNDARY_ALL_PASS'],
  ['qa/server-test-isolation.js', 'SERVER_TEST_ISOLATION_ALL_PASS'],
  ['server/boundaries/chat-playline.js', 'createChatPlaylineBoundary'],
  ['qa/chat-playline-boundary.js', 'CHAT_PLAYLINE_BOUNDARY_ALL_PASS'],
  ['server/boundaries/reward-economy.js', 'createRewardEconomyBoundary'],
  ['qa/reward-economy-boundary.js', 'REWARD_ECONOMY_BOUNDARY_ALL_PASS'],
  ['server/boundaries/server-clock-timer.js', 'createServerClockTimer'],
  ['qa/server-clock-timer.js', 'SERVER_CLOCK_TIMER_ALL_PASS'],
  ['server/boundaries/heartbeat-sweep-isolation.js', 'createHeartbeatSweepIsolation'],
  ['qa/heartbeat-sweep.js', 'HEARTBEAT_SWEEP_ALL_PASS'],
  ['server/boundaries/reward-progression.js', 'createRewardProgression'],
  ['qa/reward-progression.js', 'REWARD_PROGRESSION_ALL_PASS'],
  ['requirements/ADR/003-server-boundary-adapters-metrics.md', 'Operational Metrics 首个 Server Seam']
]) assert(read(relative).includes(marker), `T7 partial artifact must include ${marker}`);
assert(read('server/index.js').includes('operationalMetricsBoundary.handle') &&
  read('server/index.js').includes('createJsonMetricsAdapter'),
  'T7 must route the existing Metrics wire through the JSON runtime Adapter');
assert(packageJson.scripts['test:technical-optimization-t7'].includes('qa/server-boundary-adapters.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/auth-profile-boundary.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/room-presence-boundary.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/server-test-isolation.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('isolated-node-process.js') &&
  packageJson.scripts['test:node-process-isolation'].includes('qa/server-test-isolation.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/match-protocol-boundary.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/chat-playline-boundary.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/reward-economy-boundary.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/reward-progression.js') &&
  packageJson.scripts['test:chat-playline-boundary'].includes('qa/chat-playline-boundary.js') &&
  packageJson.scripts['test:match-protocol-boundary'].includes('qa/match-protocol-boundary.js') &&
  packageJson.scripts['test:room-presence-boundary'].includes('qa/room-presence-boundary.js') &&
  read('scripts/quality-gates.js').includes("run('server-boundary-adapters-t7'") &&
  read('scripts/quality-gates.js').includes("run('auth-profile-boundary-t7'") &&
  read('scripts/quality-gates.js').includes("run('room-presence-boundary-t7'") &&
  read('scripts/quality-gates.js').includes("run('match-protocol-boundary-t7'") &&
  read('scripts/quality-gates.js').includes("run('reward-economy-boundary-t7'"),
  'T7 partial suite must be registered in focused and shared gates');
assert(read('scripts/quality-gates.js').includes("run('reward-progression-t7'") &&
  packageJson.scripts['test:reward-progression'].includes('qa/reward-progression.js'),
  'Reward/Progression P7 must be registered in focused and shared gates');
assert(packageJson.scripts['test:server-clock-timer'].includes('qa/server-clock-timer.js') &&
  packageJson.scripts['test:server-clock-timer'].includes('qa/heartbeat-sweep.js') &&
  read('scripts/quality-gates.js').includes("run('server-clock-timer-t7'") &&
  read('scripts/quality-gates.js').includes("run('heartbeat-sweep-t7'") &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/server-clock-timer.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/heartbeat-sweep.js') &&
  packageJson.scripts['test:technical-optimization-t7'].includes('qa/timer-audit.js') &&
  read('scripts/quality-gates.js').includes("run('timer-audit-t7'") &&
  read('server/index.js').includes("owner:'operational-metrics-history'") &&
  read('server/index.js').includes('serverClockTimer.schedule'),
  'T7 ServerClockTimer metrics slice must be registered, consumed and gated');
assert(p12Plan.state === 'IMPLEMENTED_LOCAL' && p12Plan.requirements.includes('TECH-039') &&
  p12Plan.requirements.includes('TECH-040') && p12Plan.requirements.includes('TECH-052') &&
  p12Contract.includes('heartbeat-sweep') && p12Contract.includes('session.close(true)') &&
  p12Contract.includes('session.close()') && p12Acceptance.includes('HEARTBEAT_SWEEP_ALL_PASS') &&
  p12Acceptance.includes('LOCAL_ONLY / NOT_RELEASED'),
  'P12 fact pack must preserve heartbeat owner, close semantics, liveness evidence and release fence');
assert(p6Plan.state === 'FOCUSED_VERIFIED_LOCAL' && p6Plan.scope === 'Operational Metrics cadence and injected now only' &&
  p6Plan.requirements.includes('TECH-039') && p6Plan.requirements.includes('TECH-040') && p6Plan.requirements.includes('TECH-052'),
  'P6 plan must keep its narrow TECH-039/040/052 scope');
assert(p6Execution.state === 'FOCUSED_VERIFIED_LOCAL' && p6Execution.scopeLimit.includes('Operational Metrics') &&
  p6Requirement.includes('now / schedule / dispose') && p6Requirement.includes('server-wide Timer virtualization') &&
  p6Acceptance.includes('Timer Audit'),
  'P6 fact pack must record focused local verification and the remaining server-wide clock boundary');
assert((p7Plan.state === 'IMPLEMENTED_LOCAL' || p7Plan.state === 'VERIFIED_LOCAL') && p7Plan.requirements.includes('ECO-001') &&
  p7Requirement.includes('reward-progression-v1') && p7Contract.includes('meta.at') &&
  p7Acceptance.includes('daily_task_claim') && p7Acceptance.includes('LOCAL_ONLY / NOT_RELEASED'),
  'P7 fact pack must keep projection-only scope and release fence');
assert(read('server/index.js').includes('chatPlaylineBoundary.chat') &&
  read('server/index.js').includes('chatPlaylineBoundary.playline') &&
  chatPlan.state === 'WIRED_LOCAL_VERIFIED' && chatAcceptance.includes('WIRED_LOCAL_VERIFIED'),
  'Chat/Playline boundary must be wired through the local caller and retain an honest local-only state');
assert(acceptance.includes('T7 PARTIAL') &&
  (acceptance.includes('OPERATIONAL_METRICS_AUTH_PROFILE_ROOM_PRESENCE_MATCH_PROTOCOL_PROCESS_ISOLATION_VERTICAL_SLICES_COMPLETE') ||
   acceptance.includes('OPERATIONAL_METRICS_AUTH_PROFILE_ROOM_PRESENCE_MATCH_PROTOCOL_VERTICAL_SLICES_COMPLETE') ||
   acceptance.includes('OPERATIONAL_METRICS_AUTH_PROFILE_ROOM_PRESENCE_VERTICAL_SLICES_COMPLETE') ||
   acceptance.includes('OPERATIONAL_METRICS_AUTH_PROFILE_ROOM_PRESENCE_MATCH_PROTOCOL_PROCESS_ISOLATION_CHAT_PLAYLINE_REWARD_OUTBOX_VERTICAL_SLICES_COMPLETE') ||
   acceptance.includes('OPERATIONAL_METRICS_AUTH_PROFILE_ROOM_PRESENCE_MATCH_PROTOCOL_PROCESS_ISOLATION_CHAT_PLAYLINE_REWARD_OUTBOX_CLOCK_TIMER_METRICS_SLICE_COMPLETE') ||
   acceptance.includes('P7 REWARD_PROGRESSION + P8 BOUNDARY_CLOCK_INJECTION VERIFIED_LOCAL') ||
   acceptance.includes('P12 HEARTBEAT_SWEEP_TIMER IMPLEMENTED_LOCAL')) &&
  acceptance.includes('Match Protocol') &&
  (acceptance.includes('Chat/Playline、Reward/Economy') || acceptance.includes('Reward 数值/profile projection') ||
   (acceptance.includes('HeartbeatSweepIsolation') && acceptance.includes('正式 token TTL'))),
  'T7 acceptance must preserve completed ownership domains and explicit remaining Reward/clock boundaries');
assert(fs.existsSync(path.join(ROOT, 'server/boundaries/reward-economy.js')) &&
  rewardAcceptance.includes('VERIFIED_LOCAL') &&
  rewardPlan.state === 'VERIFIED_LOCAL' &&
  rewardExecution.state === 'VERIFIED_LOCAL',
  'Reward/Economy P5 must retain an honest local verification state');
assert(fs.existsSync(path.join(ROOT, 'server/boundaries/match-protocol.js')) &&
  matchAcceptance.includes('assertions=21') && matchExecution.state === 'VERIFIED_LOCAL' &&
  matchExecution.release === 'LOCAL_ONLY / NOT_RELEASED',
  'Match Protocol active task must record the 21-assertion local boundary and release fence');

assert(t7Plan.status === 'VERIFIED_LOCAL' && t7Plan.requirements.includes('TECH-040') && t7Plan.requirements.includes('TECH-052'),
  'Room/Presence T7 plan must remain a local TECH-040/TECH-052 vertical slice');
assert(t7Requirement.includes('RoomPresenceBoundary') && t7Requirement.includes('Test Admin') && t7Requirement.includes('Presence 隐私'),
  'Room/Presence requirement must freeze privacy, Test Admin and membership scope');
for (const marker of ['room(command)', 'presence(command)', 'JSON runtime Adapter', 'isolated in-memory Adapter', 'reconnect replacement', 'fail-closed']) {
  assert(t7Contract.includes(marker), `Room/Presence contract must include ${marker}`);
}
assert(t7Acceptance.includes('VERIFIED_LOCAL') && t7Acceptance.includes('resume') && t7Acceptance.includes('heartbeat') &&
  t7Acceptance.includes('NOT_EXECUTED'), 'Room/Presence acceptance must record local evidence and external gaps');
assert(t7Execution.status === 'VERIFIED_LOCAL' && t7Execution.tests && t7Execution.tests.roomPresenceBoundary === 'PASS',
  'Room/Presence execution must carry a passing focused result');
assert(t7Ownership.module === 'server/boundaries/room-presence.js' &&
  t7Ownership.interface.includes('room(command)') && t7Ownership.interface.includes('presence(command)'),
  'Room/Presence ownership must name the seam and its two-method interface');
for (const [relative, marker] of [
  ['server/boundaries/room-presence.js', 'createRoomPresenceBoundary'],
  ['qa/room-presence-boundary.js', 'ROOM_PRESENCE_BOUNDARY_ALL_PASS']
]) assert(read(relative).includes(marker), `Room/Presence artifact must include ${marker}`);
assert(read('server/index.js').includes("createJsonRuntimeRoomPresenceAdapter") &&
  read('server/index.js').includes("roomPresenceBoundary.room({action:'join'") &&
  read('server/index.js').includes("roomPresenceBoundary.room({action:'remove'") &&
  read('server/index.js').includes("roomPresenceBoundary.room({action:'resume'") &&
  read('server/index.js').includes("roomPresenceBoundary.presence({ action:'online_uids' })"),
  'server/index must consume Room/Presence through the Adapter seam');

for (const marker of [
  '不泛化或替换全站 JSON 协议', '当前没有获批纹理', '不新建重复 Requirement',
  '本 Wave 绝不改 Reward', 'T0 AUTHORIZATION_AND_CONTRACT_COMPLETE'
]) assert(requirement.includes(marker) || acceptance.includes(marker), `scope must preserve ${marker}`);

const viewport = (template.match(/<meta name="viewport" content="([^"]+)">/) || [])[1] || '';
assert(viewport.includes('width=device-width') && viewport.includes('initial-scale=1'), 'viewport must retain responsive defaults');
assert(!/maximum-scale|user-scalable/i.test(viewport), 'viewport must not disable browser zoom');

assert.strictEqual(routing.approvalPolicy.autoAdvanceAuthorizedAt, '2026-08-16', 'auto-advance authorization must be dated');
assert(/machine-verifiable subchecks auto-advance/.test(routing.approvalPolicy.compositeGateRule), 'machine sub-gates must auto-advance');
for (const [gate, meta] of Object.entries(routing.sharedGates)) {
  const isArt = gate === 'GATE-ART-GOLDEN-SET';
  assert.strictEqual(meta.status, isArt ? 'OPEN_BY_OWNER_AUTHORIZATION' : 'NON_BLOCKING_FOR_DEVELOPMENT', `${gate} must permit its authorized local work`);
  assert.strictEqual(meta.developmentStatus, 'OPEN', `${gate} must expose a development status`);
  assert.strictEqual(meta.releaseStatus, isArt ? 'EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED' : 'RELEASE_EVIDENCE_PENDING', `${gate} must not imply autonomous release readiness`);
}
assert(policy.includes('2026-08-16 用户再次明确授权'));

console.log('TECHNICAL_OPTIMIZATION_MAINLINE_CONTRACT_ALL_PASS');
