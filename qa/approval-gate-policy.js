'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, '');
const policy = read('requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md');
const routing = JSON.parse(read('requirements/MAINLINE_CONTROL_ROUTING.json'));
const approval = routing.approvalPolicy;

assert.ok(approval && approval.source === 'requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md',
  'the control plane must point to the canonical approval policy');
assert.strictEqual(approval.defaultDecision, 'CONTINUE_WITH_MACHINE_EVIDENCE',
  'machine-verifiable work must continue by default');

const machineExpected = [
  'TECHNICAL_REVIEWER', 'HASH_AND_PROVENANCE', 'ALPHA_CONTAMINATION_DIMENSIONS',
  'CONTRAST_SMALL_SIZE_READABILITY', 'A11Y_I18N', 'PERFORMANCE_FALLBACK',
  'MANIFEST_CACHE_SECURITY', 'AUTOMATED_REGRESSION', 'LOCAL_BROWSER_EVIDENCE',
  'PROTOCOL_COMPATIBILITY_AND_ROLLBACK', 'RENDERER_RESOURCE_LIFECYCLE',
  'WORKER_CANCELLATION_AND_PRIVACY', 'BUILD_AND_TEST_ISOLATION'
];
assert.ok(machineExpected.every(item => approval.machineContinuable.includes(item)),
  'all deterministic technical evidence classes must be machine-continuable');

assert.deepStrictEqual(approval.optionalAdvisoryEvidence, [
  'ART_HUMAN_CLEANUP',
  'INDEPENDENT_HUMAN_REVIEWER_B',
  'IP_LEGAL_FINAL_DECISION',
  'USER_GOLDEN_SET_DECISION'
], 'art/legal/aesthetic consultation must remain optional advisory evidence');

assert.deepStrictEqual(approval.externalEnvironmentRequired, [
  'SECOND_REAL_BROWSER',
  'PHYSICAL_ANDROID_IPHONE_TABLET',
  'REAL_NETWORK_SHAPING',
  'REAL_PRODUCTION_SUPABASE_AND_MULTI_INSTANCE'
], 'real-environment evidence must remain distinct from human judgment');

assert.strictEqual(approval.releaseAuthorization, 'EXPLICIT_CURRENT_USER_COMMAND_ONLY',
  'machine approval must never grant release authority');
assert.strictEqual(approval.autoAdvanceAuthorizedAt, '2026-08-16',
  'the latest user authorization must be recorded without changing release authority');
assert.ok(/OPEN_BY_OWNER_AUTHORIZATION/.test(approval.compositeGateRule) && /RELEASE_EVIDENCE_PENDING/.test(approval.compositeGateRule),
  'automatic subchecks must separate external pending gates from owner-authorized art clearance');
for (const gate of ['GATE-DEVICE-BROWSER-NETWORK', 'GATE-SUPABASE-PRODUCTION']) {
  const meta = routing.sharedGates[gate];
  assert.strictEqual(meta.status, 'NON_BLOCKING_FOR_DEVELOPMENT', `${gate} must permit development`);
  assert.strictEqual(meta.developmentStatus, 'OPEN', `${gate} must expose an open development lane`);
  assert.strictEqual(meta.releaseStatus, 'RELEASE_EVIDENCE_PENDING', `${gate} must retain external release evidence pending`);
}
const artGate = routing.sharedGates['GATE-ART-GOLDEN-SET'];
assert.strictEqual(artGate.status, 'OPEN_BY_OWNER_AUTHORIZATION', 'art must use owner authorization rather than a fabricated human approval');
assert.strictEqual(artGate.developmentStatus, 'OPEN', 'art owner clearance must expose an open development lane');
assert.strictEqual(artGate.releaseStatus, 'EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED', 'art release must still require a current owner command');

for (const marker of [
  'MACHINE_CONTINUABLE', 'EXTERNAL_ENVIRONMENT_REQUIRED', 'OPTIONAL_ADVISORY_EVIDENCE', 'OWNER_AUTHORIZED_ART_CLEARANCE',
  '技术 Reviewer', '独立自然人 Reviewer B', 'IP / 法律最终判断', '用户 Golden Set',
  '2026-08-16 用户再次明确授权'
]) assert.ok(policy.includes(marker), `policy must explain ${marker}`);

assert.ok(/不得.*自动化.*冒充.*自然人 Reviewer B/.test(policy),
  'the policy must explicitly forbid impersonating a human reviewer');
assert.ok(/不需要等待用户逐项确认/.test(policy),
  'the policy must explicitly remove unnecessary per-item confirmations');
assert.ok(/(?:受控|controlled).*reference lane/i.test(policy) && /(?:sourcePath|路径)/i.test(policy) && /(?:sourceSha256|SHA-256|hash|哈希)/i.test(policy) && /(?:provider|model|taskId|transmissionScope)/i.test(policy) && /直接复制、描摹、换色.*不得进入 runtime 或发布/.test(policy),
  'external blocked-license assets must be fully discoverable through the controlled Skill reference lane while remaining out of runtime/release');
assert.ok(/不得把这些动作改写成 `IP PASS`/.test(policy),
  'owner clearance must never forge an IP/legal or human pass');

const ownerClearanceSpecs = [
  'requirements/ART_APPROVAL_MATRIX.md',
  'requirements/ASSET_LIBRARY_GOVERNANCE.md',
  'requirements/PERFORMANCE_BUDGET_CONTRACT.md',
  'requirements/VERTICAL_SLICE_DEFINITION.md',
  'requirements/GSAP_OFFICIAL_3D_MOTION_STRATEGY_20260812.md',
  'requirements/THREEJS_OFFICIAL_INTEGRATION_STRATEGY_20260812.md',
  'requirements/active/art-approval-matrix-p1-20260814/contract.md',
  'requirements/active/art-approval-matrix-p1-20260814/requirement.md',
  'requirements/active/honru-emoji-runtime-p0-20260811/contract.md',
  'requirements/active/honru-emoji-runtime-p0-20260811/requirement.md',
  'requirements/active/identity-avatar-background-closure-p1-20260812/contract.md',
  'requirements/active/art-036-player-character-monopoly-p1-20260810/requirement.md',
  'requirements/active/art-036-player-character-monopoly-p1-20260810/plan.json',
  'requirements/active/art-036-player-character-monopoly-p1-20260810/execution.json',
  'requirements/active/g-coins-naming-unified-p0-20260810/requirement.md',
  'requirements/active/g-coins-naming-unified-p0-20260810/contract.md',
  'requirements/active/gcoins-source-redesign-p1-20260814/requirement.md',
  'requirements/active/honru-character-master-v2-20260809/contract.md',
  'requirements/active/honru-character-master-v2-20260809/plan.json',
  'requirements/active/honru-character-master-v2-20260809/execution.json',
  'requirements/active/honru-expression-kit-v1-20260809/plan.json',
  'requirements/active/honru-expression-kit-v1-20260809/execution.json',
  'requirements/active/game-045-monopoly-character-consumer-p1-20260810/contract.md',
  'requirements/active/game-045-monopoly-character-consumer-p1-20260810/requirement.md',
  'requirements/active/ui-037-player-character-runtime-p1-20260810/contract.md',
  'requirements/active/ui-037-player-character-runtime-p1-20260810/requirement.md',
  'requirements/active/ui-037-player-character-runtime-p1-20260810/plan.json',
  'requirements/active/ui-037-player-character-runtime-p1-20260810/acceptance.md',
  'requirements/active/tank-art-p1-20260810/contract.md',
  'requirements/active/tank-art-p1-20260810/requirement.md',
  'requirements/active/social-match-p0-20260809/requirement.md',
  'requirements/active/sticker-cartoon-golden-set-m0-20260808/contract.md',
  'requirements/active/sticker-cartoon-golden-set-m0-20260808/requirement.md',
  'requirements/active/ludo-ghost3d-vertical-slice-p1-20260814/scope.md',
  'requirements/active/monopoly-ghost3d-vertical-slice-p2-20260814/scope.md',
  'requirements/active/monopoly-ghost3d-vertical-slice-p2-20260814/contract.md',
  'requirements/active/tank-ghost3d-vertical-slice-p5-20260815/contract.md',
  'requirements/active/tank-ghost3d-vertical-slice-p5-20260815/requirement.md',
  'requirements/active/tetris-ghost3d-vertical-slice-p4-20260815/scope.md',
  'requirements/active/tetris-ghost3d-vertical-slice-p4-20260815/contract.md',
  'requirements/active/xiangqi-ghost3d-vertical-slice-p3-20260814/scope.md',
  'requirements/active/xiangqi-ghost3d-vertical-slice-p3-20260814/contract.md',
  'requirements/active/production-readiness-sprint-p0-20260809/contract.md',
  'requirements/active/production-readiness-sprint-p0-20260809/requirement.md',
  'requirements/active/product-requirements-roadmap-p0-20260809/requirement.md',
  'requirements/active/product-requirements-roadmap-p0-20260809/contract.md',
  'scripts/update_whitepaper_visual_p0_docx.py',
  'scripts/art-gate-reviewer-b-template.md',
  'scripts/art-gate-golden-set-template.md',
  '简易报告/README.md',
  'requirements/active/shop-design-system-close-p1-20260813/acceptance.md',
  'requirements/active/requirements-governance-p0-20260810/source-analysis.md'
];
const obsoleteDevelopmentBlocker = /(?:GATE-ART-GOLDEN-SET.{0,60}(?:stays|保持).{0,12}`?BLOCKED|未通过人工清稿|必须先走完人工清稿|顺序闸门：人工清稿|未完成人工清稿\/Reviewer B\/IP\/Golden Set|人工 Golden Set 决议前全部|未签字时决议固定为 `BLOCKED_EXTERNAL`)/s;
for (const relative of ownerClearanceSpecs) {
  const spec = read(relative);
  assert.ok(spec.includes('OWNER_AUTHORIZED_ART_CLEARANCE'),
    `${relative} must route original Ghost-native art through owner clearance`);
  assert.ok(!obsoleteDevelopmentBlocker.test(spec),
    `${relative} must not restore human/IP/Golden Set as a development or runtime prerequisite`);
}

const art36Plan = JSON.parse(read('requirements/active/art-036-player-character-monopoly-p1-20260810/plan.json'));
const art36Execution = JSON.parse(read('requirements/active/art-036-player-character-monopoly-p1-20260810/execution.json'));
assert.strictEqual(art36Plan.steps.find(step => step.id === 'ART36-4').status, 'planned',
  'ART-036 runtime work must remain planned for owner clearance, not blocked by optional advice');
assert.strictEqual(art36Execution.steps.find(step => step.id === 'ART36-4').status, 'planned',
  'ART-036 execution must not retain a live human-gate blocker');
assert.deepStrictEqual(art36Execution.blocked, [], 'ART-036 current blocked list must be empty');
assert.strictEqual(art36Execution.optionalAdvisoryEvidence.blocking, false,
  'ART-036 optional advisory evidence must be non-blocking');

const ui037Plan = JSON.parse(read('requirements/active/ui-037-player-character-runtime-p1-20260810/plan.json'));
assert.strictEqual(ui037Plan.steps.find(step => step.id === 'UI037-4a').status, 'planned',
  'UI-037 ART-036 renderer work must be planned behind owner clearance, not externally blocked by human review');
assert.strictEqual(ui037Plan.steps.find(step => step.id === 'UI037-5').status, 'release_evidence_pending',
  'UI-037 physical/device work must be release evidence pending rather than a local development blocker');
assert.strictEqual(ui037Plan.optionalAdvisoryEvidence.blocking, false,
  'UI-037 optional advisory evidence must be non-blocking');

const honruExpressionExecution = JSON.parse(read('requirements/active/honru-expression-kit-v1-20260809/execution.json'));
assert.strictEqual(honruExpressionExecution.state, 'LOCAL_OWNER_CLEARED_DEFAULT_ON_NOT_RELEASED',
  'owner-cleared Honru states must bind the task to current local runtime');
assert.strictEqual(honruExpressionExecution.progress.ownerAuthorizedRuntime.status, 'verified_local_default_on',
  'owner-cleared Honru runtime evidence must be explicit');
assert.strictEqual(honruExpressionExecution.progress.review.blocking, false,
  'Honru optional advice must not block the owner-cleared runtime');

const index = read('简易报告/README.md');
const projectStatus = JSON.parse(read('PROJECT_STATUS.json'));
const currentBuildSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'public', 'index.html'))).digest('hex').toUpperCase();
const drift = projectStatus.parallelBuildDrift20260819;
const generatedProgress = read('简易报告/项目总需求进度报告-20260819.md');
const stableCurrentBuild = drift && drift.status === 'resolved' && drift.artifact && drift.expectedFromSources &&
  drift.artifact.sha256 === currentBuildSha && drift.expectedFromSources.sha256 === currentBuildSha &&
  index.includes(`当前 SHA-256 \`${currentBuildSha}\``) && index.includes('尚无与其匹配的浏览器完整矩阵');
const activeParallelBuildDrift = drift && drift.status === 'active' && drift.artifact && drift.expectedFromSources &&
  index.includes('当前构建 SHA/bytes') && index.includes('自动生成报告') &&
  generatedProgress.includes(currentBuildSha) && generatedProgress.includes('尚无与其匹配的浏览器可见证据');
assert((stableCurrentBuild || activeParallelBuildDrift) &&
  index.includes('`915A97F3…B8C8EFC` 的完整单浏览器矩阵') && index.includes('historical-as-of'),
  'report index must distinguish the current build from the historical browser matrix');
assert(/该报告形成时.*historical-as-of/.test(index) && /Golden Set Gate 阻塞是 historical-as-of/.test(index),
  'old report index entries must be explicitly historical-as-of');

const externalEvidenceSpecs = [
  'requirements/active/controlled-local-transport-preflight-p0-20260815/contract.md',
  'requirements/active/ludo-ghost3d-vertical-slice-p1-20260814/scope.md',
  'requirements/active/monopoly-ghost3d-vertical-slice-p2-20260814/scope.md',
  'requirements/active/tank-ghost3d-vertical-slice-p5-20260815/contract.md',
  'requirements/active/tetris-ghost3d-vertical-slice-p4-20260815/scope.md',
  'requirements/active/tetris-ghost3d-vertical-slice-p4-20260815/contract.md',
  'requirements/active/xiangqi-ghost3d-vertical-slice-p3-20260814/scope.md',
  'requirements/active/xiangqi-ghost3d-vertical-slice-p3-20260814/contract.md'
];
for (const relative of externalEvidenceSpecs) {
  const spec = read(relative);
  assert.ok(spec.includes('NON_BLOCKING_FOR_DEVELOPMENT') && spec.includes('RELEASE_EVIDENCE_PENDING'),
    `${relative} must separate an open development lane from pending release evidence`);
  assert.ok(!/(?:GATE-DEVICE-BROWSER-NETWORK|GATE-SUPABASE-PRODUCTION).{0,80}(?:remain|remains|保持).{0,20}(?:blocked|BLOCKED)/s.test(spec),
    `${relative} must not restore real-environment evidence as a local development blocker`);
}

const topLevelPolicyDocs = ['README.md', 'WHITEPAPER.md'];
for (const relative of topLevelPolicyDocs) {
  const doc = read(relative);
  for (const marker of [
    'OWNER_AUTHORIZED_ART_CLEARANCE',
    'OPTIONAL_ADVISORY_EVIDENCE',
    'NON_BLOCKING_FOR_DEVELOPMENT',
    'RELEASE_EVIDENCE_PENDING',
    'blocked-license',
    'EXTERNAL_REFERENCE_ONLY'
  ]) assert.ok(doc.includes(marker), `${relative} must publish the current ${marker} boundary`);
  assert.ok(/(?:元数据|metadata|库存|reference lane)/i.test(doc) && /(?:URL|hash|哈希|SHA)/i.test(doc),
    `${relative} must publish the external reference inventory boundary`);
  assert.ok(/(?:受控|controlled)[^\n]{0,80}(?:Skill|reference lane)/i.test(doc),
    `${relative} must publish the controlled Skill reference lane`);
  assert.ok(/发布.{0,40}当前用户明确命令/.test(doc),
    `${relative} must retain explicit current-user release authority`);
  assert.ok(/不得伪造.{0,20}PASS|不得冒充.{0,20}PASS/.test(doc),
    `${relative} must not fabricate optional human or legal PASS evidence`);
}

const readme = read('README.md');
const whitepaper = read('WHITEPAPER.md');
const historyMarker = '## 历史批次记录（historical-as-of）';
const historyAt = whitepaper.indexOf(historyMarker);
assert.ok(historyAt > 0, 'WHITEPAPER.md must explicitly delimit historical-as-of batch records');
const whitepaperCurrent = whitepaper.slice(0, historyAt);
const historicalBoundary = whitepaper.slice(historyAt, whitepaper.indexOf('\n', historyAt + historyMarker.length) + 800);
assert.ok(historicalBoundary.includes('BLOCKED') && historicalBoundary.includes('HUMAN_ONLY') &&
  historicalBoundary.includes('OPTIONAL_ADVISORY_EVIDENCE'),
  'the historical boundary must demote obsolete blocker terminology without rewriting it as a current fact');

const obsoleteCurrentLine = /(?:Release Candidate.{0,40}BLOCKED|发布状态.{0,40}(?:保持|为).{0,12}BLOCKED|解除.{0,40}(?:RC )?`?BLOCKED|硬闸门|只能在审批后|完成前全部.{0,30}默认关闭|HUMAN_ONLY|需人工清稿.{0,100}后才能|人工\/IP\/Golden Set 审批前|人工\/IP\/[真实设备]{0,20}验收前不得默认开启|所有候选仍受.{0,120}阻塞)/i;
for (const [relative, current] of [['README.md', readme], ['WHITEPAPER.md', whitepaperCurrent]]) {
  for (const line of current.split(/\r?\n/)) {
    if (line.includes('historical-as-of')) continue;
    assert.ok(!obsoleteCurrentLine.test(line),
      `${relative} must not expose obsolete human/IP/device/data blocker semantics as current: ${line}`);
  }
}

assert.ok(/Honru 九状态.{0,100}OWNER_AUTHORIZED_ART_CLEARANCE.{0,120}default-on/s.test(readme),
  'README.md must expose the current owner-cleared default-on Honru states runtime');
assert.ok(/Honru Emoji P0.{0,100}OWNER_AUTHORIZED_ART_CLEARANCE.{0,180}match-expression-v1/s.test(readme),
  'README.md must expose the current owner-cleared match-expression Emoji runtime');
assert.ok(/Direct Chat 与 match-chat 仍为纯文字/.test(readme),
  'README.md must preserve the pure-text Chat boundary');

const gcoinsSourcePolicy = read('art-source/brand/ghost-game/currency/gcoins-p1-20260814/PROMPT_AND_PROVENANCE.md');
assert.ok(gcoinsSourcePolicy.includes('OWNER_CLEARANCE_PREPARATION / NON_BLOCKING_FOR_DEVELOPMENT') &&
  gcoinsSourcePolicy.includes('OWNER_AUTHORIZED_ART_CLEARANCE') &&
  gcoinsSourcePolicy.includes('OPTIONAL_ADVISORY_EVIDENCE'),
  'G Coins source provenance must keep the uncleared candidate source-only without restoring a human-review blocker');

const artMatrixAcceptance = read('requirements/active/art-approval-matrix-p1-20260814/acceptance.md');
assert.ok(/\| GATE-ART-GOLDEN-SET \| OPEN_BY_OWNER_AUTHORIZATION \|/.test(artMatrixAcceptance),
  'the active art matrix acceptance row must expose the current owner-authorized Gate');
assert.ok(!/\| GATE-ART-GOLDEN-SET \| BLOCKED \|/.test(artMatrixAcceptance),
  'the active art matrix acceptance row must not retain a live BLOCKED Gate');

const ghost3dAcceptance = read('requirements/active/ghost3d-foundation-p0-20260812/acceptance.md');
assert.ok(ghost3dAcceptance.includes('OPEN / NON_BLOCKING_FOR_DEVELOPMENT') &&
  ghost3dAcceptance.includes('OWNER_AUTHORIZED_ART_CLEARANCE'),
  'Ghost3D acceptance must separate pending release evidence from the open development and owner-clearance lanes');
assert.ok(!/受 `GATE-(?:DEVICE-BROWSER-NETWORK|ART-GOLDEN-SET)` 阻塞/.test(ghost3dAcceptance),
  'Ghost3D acceptance must not expose the old Gates as current development blockers');

for (const relative of [
  'requirements/active/game-stage-art-expansion-p0-20260809/requirement.md',
  'requirements/active/honru-runtime-integration-p2-20260809/SHARED_CHANGE_REQUEST.md',
  'requirements/active/sticker-cartoon-golden-set-m0-20260808/CHANGE_REQUEST-双主题-20260809.md'
]) {
  const historicalSpec = read(relative);
  assert.ok(historicalSpec.includes('historical-as-of') &&
    historicalSpec.includes('OWNER_AUTHORIZED_ART_CLEARANCE') &&
    historicalSpec.includes('OPTIONAL_ADVISORY_EVIDENCE'),
  `${relative} must explicitly demote its original human/default-off blocker language to history`);
}

const ledger = JSON.parse(read('requirements/PRODUCT_REQUIREMENTS_LEDGER.json'));
const honruStates = ledger.requirements.find(item => item.id === 'ART-005');
assert.ok(honruStates && /OWNER_AUTHORIZED_ART_CLEARANCE/.test(honruStates.phase) && /default-on/.test(honruStates.phase),
  'ART-005 current phase must match the owner-cleared default-on runtime instead of its historical default-off phase');

const artMatrixExecution = JSON.parse(read('requirements/active/art-approval-matrix-p1-20260814/execution.json'));
assert.strictEqual(artMatrixExecution.status, 'COMPLETED_LOCAL_POLICY_RECONCILED',
  'art matrix execution must identify the reconciled current policy');
assert.deepStrictEqual(artMatrixExecution.blocked, [],
  'optional art advice and external release evidence must not remain in the current blocked list');
assert.strictEqual(artMatrixExecution.optionalAdvisoryEvidence.blocking, false,
  'art matrix optional advisory evidence must be explicitly non-blocking');
assert.strictEqual(artMatrixExecution.historicalGateSnapshot.status, 'COMPLETED_LOCAL_GATE_BLOCKED',
  'art matrix execution must preserve the former blocked result only as a historical snapshot');

const tankExecution = JSON.parse(read('requirements/active/tank-ghost3d-vertical-slice-p5-20260815/execution.json'));
assert.strictEqual(tankExecution.gates['GATE-DEVICE-BROWSER-NETWORK'], 'NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING',
  'Tank P5 execution must keep device evidence pending without blocking development');
assert.strictEqual(tankExecution.gates['GATE-SUPABASE-PRODUCTION'], 'NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING',
  'Tank P5 execution must keep Supabase evidence pending without blocking development');
assert.strictEqual(tankExecution.gates['GATE-ART-GOLDEN-SET'], 'OPEN_BY_OWNER_AUTHORIZATION',
  'Tank P5 execution must use the owner-authorized art lane');
assert.deepStrictEqual(Object.values(tankExecution.historicalGateSnapshot.gates), ['BLOCKED', 'BLOCKED', 'BLOCKED'],
  'Tank P5 execution must preserve the former blocked Gate triplet only as history');

console.log('APPROVAL_GATE_POLICY_ALL_PASS');
