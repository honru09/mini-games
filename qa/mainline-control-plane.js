#!/usr/bin/env node
'use strict';

/*
 * Phase 0 Control Plane Reset is deliberately a governance test, not a
 * product-feature test. It prevents the requirement ledger from silently
 * reverting to an unprioritised list after a long-running batch.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ledgerPath = path.join(ROOT, 'requirements', 'PRODUCT_REQUIREMENTS_LEDGER.json');
const routingPath = path.join(ROOT, 'requirements', 'MAINLINE_CONTROL_ROUTING.json');
const commandPath = path.join(ROOT, 'requirements', 'GHOST_GAME_MAINLINE_COMMAND.md');
const packagePath = path.join(ROOT, 'package.json');

const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const routing = JSON.parse(fs.readFileSync(routingPath, 'utf8'));
const command = fs.readFileSync(commandPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const DISPOSITIONS = new Set([
  'NOW_CLOSURE',
  'EXTERNAL_GATE',
  'NON_BLOCKING_FOR_DEVELOPMENT',
  'DEFERRED_MAINLINE',
  'FUTURE_EXPANSION'
]);
const GATES = new Set([
  'GATE-DEVICE-BROWSER-NETWORK',
  'GATE-SUPABASE-PRODUCTION',
  'GATE-ART-GOLDEN-SET'
]);
const EXPECTED_ROUTING_COUNTS = {
  NOW_CLOSURE: 146,
  EXTERNAL_GATE: 0,
  NON_BLOCKING_FOR_DEVELOPMENT: 32,
  DEFERRED_MAINLINE: 48,
  FUTURE_EXPANSION: 16
};
const EXPECTED_GATE_COUNTS = {
  'GATE-DEVICE-BROWSER-NETWORK': 7,
  'GATE-SUPABASE-PRODUCTION': 10,
  'GATE-ART-GOLDEN-SET': 15
};

assert.strictEqual(routing.schemaVersion, 1, 'mainline routing schema must be 1');
assert.strictEqual(routing.authority.command, 'requirements/GHOST_GAME_MAINLINE_COMMAND.md', 'routing must point to the command plane');
assert.strictEqual(routing.authority.atomicRequirementSource, 'requirements/PRODUCT_REQUIREMENTS_LEDGER.json', 'routing must not replace the atomic ledger');
assert.strictEqual(routing.authority.releasePolicy, 'explicit-user-command-only', 'routing must preserve explicit release policy');
assert.strictEqual(routing.authority.currentStage, 'CLOSE', 'the command plane has explicitly advanced from Control into the local closure stage');
assert.strictEqual(routing.authority.nextStage, 'PROVE', 'Close must lead directly into the shared browser/device proof stage');
assert.deepStrictEqual(
  routing.stageOrder,
  ['CONTROL', 'CLOSE', 'PROVE', 'DATA', 'ART', 'PARITY', 'LOOP', 'COMMUNITY', 'PLATFORM'],
  'mainline stage order drift'
);
assert.deepStrictEqual(new Set(Object.keys(routing.dispositions)), DISPOSITIONS, 'routing must define exactly five execution dispositions');
assert.deepStrictEqual(new Set(Object.keys(routing.sharedGates)), GATES, 'routing must define exactly three shared gates');
assert(routing.semanticStatusContract && routing.semanticStatusContract.visibleEvidence, 'routing needs an explicit visible-evidence semantic rule');
assert(command.includes('CONTROL') && command.includes('GATE-ART-GOLDEN-SET'), 'command plane is missing the required current stages/gates');

const requirementById = new Map(ledger.requirements.map((item) => [item.id, item]));
const routeByRequirement = new Map();
const routingCounts = Object.fromEntries([...DISPOSITIONS].map((key) => [key, 0]));
const gateCounts = Object.fromEntries([...GATES].map((key) => [key, 0]));
const groupIds = new Set();

for (const group of routing.routingGroups) {
  assert(group && typeof group === 'object', 'routing group must be an object');
  assert(typeof group.id === 'string' && group.id, 'routing group needs an id');
  assert(!groupIds.has(group.id), `duplicate routing group: ${group.id}`);
  groupIds.add(group.id);
  assert(DISPOSITIONS.has(group.disposition), `invalid routing disposition: ${group.id}`);
  assert(routing.stageOrder.includes(group.stage), `invalid mainline stage: ${group.id}`);
  assert(typeof group.workMode === 'string' && group.workMode, `routing group needs work mode: ${group.id}`);
  assert(typeof group.summary === 'string' && group.summary, `routing group needs summary: ${group.id}`);
  assert(Array.isArray(group.ids) && group.ids.length > 0, `routing group needs ids: ${group.id}`);
  assert.strictEqual(new Set(group.ids).size, group.ids.length, `duplicate id within routing group: ${group.id}`);

  if (group.disposition === 'EXTERNAL_GATE' || group.disposition === 'NON_BLOCKING_FOR_DEVELOPMENT') {
    assert(GATES.has(group.gate), `gate group must reference one shared gate: ${group.id}`);
    if (group.disposition === 'NON_BLOCKING_FOR_DEVELOPMENT') {
      const expectedReleaseDisposition = group.gate === 'GATE-ART-GOLDEN-SET'
        ? 'EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED'
        : 'EXTERNAL_GATE';
      assert.strictEqual(group.releaseDisposition, expectedReleaseDisposition,
        `development-open group must retain its correct release disposition: ${group.id}`);
    } else {
      assert.strictEqual(group.releaseDisposition, undefined,
        `external group must not duplicate its release disposition: ${group.id}`);
    }
  } else {
    assert.strictEqual(group.gate, undefined, `only gate groups may own a gate: ${group.id}`);
    assert.strictEqual(group.releaseDisposition, undefined, `non-gate group must not declare release disposition: ${group.id}`);
  }

  for (const id of group.ids) {
    assert(requirementById.has(id), `routing references unknown requirement: ${group.id} -> ${id}`);
    assert(!routeByRequirement.has(id), `requirement may only have one primary route: ${id}`);
    routeByRequirement.set(id, group);
    routingCounts[group.disposition] += 1;
    if (group.gate) gateCounts[group.gate] += 1;
  }
}

assert.strictEqual(routeByRequirement.size, ledger.requirements.length, 'every atomic requirement must have exactly one primary route');
for (const item of ledger.requirements) assert(routeByRequirement.has(item.id), `unrouted requirement: ${item.id}`);
assert.deepStrictEqual(routingCounts, EXPECTED_ROUTING_COUNTS, 'routing disposition counts drift; reclassify explicitly instead of silently adding work');
assert.deepStrictEqual(gateCounts, EXPECTED_GATE_COUNTS, 'shared gate fan-out drift; use a Gate rather than inventing a fourth external queue');

for (const [gate, meta] of Object.entries(routing.sharedGates)) {
  const isArt = gate === 'GATE-ART-GOLDEN-SET';
  assert.strictEqual(meta.status, isArt ? 'OPEN_BY_OWNER_AUTHORIZATION' : 'NON_BLOCKING_FOR_DEVELOPMENT', `${gate} must expose its authorized development state`);
  assert.strictEqual(meta.developmentStatus, 'OPEN', `${gate} must declare the development lane`);
  assert.strictEqual(meta.releaseStatus, isArt ? 'EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED' : 'RELEASE_EVIDENCE_PENDING', `${gate} must retain its release boundary`);
  assert(routing.stageOrder.includes(meta.stage), `${gate} must declare a valid mainline stage`);
  assert(typeof meta.owner === 'string' && meta.owner, `${gate} needs an accountable owner`);
  assert(Array.isArray(meta.requiredEvidence) && meta.requiredEvidence.length >= 3, `${gate} must state its release evidence`);
  assert(typeof meta.releaseEffect === 'string' && meta.releaseEffect, `${gate} must state its release effect`);
}
assert(Array.isArray(routing.sharedGates['GATE-ART-GOLDEN-SET'].advisoryEvidence) && routing.sharedGates['GATE-ART-GOLDEN-SET'].advisoryEvidence.length === 4,
  'art Gate must keep advisory evidence visible without turning it into a release prerequisite');

for (const item of ledger.requirements) {
  const group = routeByRequirement.get(item.id);
  if (group.disposition === 'FUTURE_EXPANSION') {
    assert(['P2', 'P3'].includes(item.priority), `future expansion must not hide a current P0/P1 item: ${item.id}`);
  }
}

const browserRequirement = requirementById.get('TECH-027');
const historicalP4MatrixPath = 'requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-local-browser-matrix.json';
const historicalP4VerificationPath = 'requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-build-single-browser-verification-202608160305.json';
const currentP5MatrixPath = 'requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-local-browser-matrix-20260817.json';
const currentP5VerificationPath = 'requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-build-single-browser-verification-202608171945.json';
const currentT3VerificationPath = 'requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-build-single-browser-verification-t3-202608161627.json';
const historicalHonruVerificationPath = 'requirements/active/honru-emoji-runtime-p0-20260811/current-build-single-browser-honru-art-202608162216.json';
assert.strictEqual(browserRequirement.status, 'partial', 'single-browser evidence must remain partial rather than inheriting cross-browser or physical-device verification');
assert.strictEqual(browserRequirement.phase, 'GATE-DEVICE-BROWSER-NETWORK', 'current browser defect must route through the device/browser/network gate');
assert.strictEqual(routeByRequirement.get('TECH-027').gate, 'GATE-DEVICE-BROWSER-NETWORK', 'current browser defect must not be placed in a local-only queue');
assert(browserRequirement.evidence.includes(currentP5MatrixPath) && browserRequirement.evidence.includes(currentP5VerificationPath),
  'TECH-027 must cite the current build metadata and full visible matrix');
assert(browserRequirement.evidence.includes(currentT3VerificationPath), 'TECH-027 must retain the historical T3 narrow evidence');
assert(browserRequirement.evidence.includes(historicalHonruVerificationPath), 'TECH-027 must retain the historical Honru art narrow evidence');
assert(browserRequirement.evidence.includes(historicalP4MatrixPath), 'TECH-027 must retain the historical P4 matrix');
assert(browserRequirement.evidence.includes(historicalP4VerificationPath), 'TECH-027 must retain the historical P4 verification wrapper');
assert(routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'].partialEvidence.includes(currentT3VerificationPath), 'device/browser/network Gate must retain the historical T3 narrow evidence');
assert(routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'].partialEvidence.includes(historicalHonruVerificationPath), 'device/browser/network Gate must retain the historical Honru art narrow evidence');
assert(routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'].partialEvidence.includes(historicalP4MatrixPath), 'device/browser/network Gate must retain the historical P4 matrix');
assert(routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'].partialEvidence.includes(historicalP4VerificationPath), 'device/browser/network Gate must retain the historical P4 verification wrapper');
assert(routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'].partialEvidence.includes(currentP5MatrixPath) &&
  routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'].partialEvidence.includes(currentP5VerificationPath),
  'device/browser/network Gate must index the current single-browser matrix without releasing the Gate');

assert(ledger.sourceCatalog['mainline-command-20260812'].refs.includes('requirements/MAINLINE_CONTROL_ROUTING.json'), 'ledger source catalog must trace mainline routing');
const controlRequirement = requirementById.get('TECH-052');
assert.strictEqual(controlRequirement.status, 'implemented', 'control plane requirement must stay implemented');
assert(controlRequirement.evidence.includes('qa/mainline-control-plane.js'), 'control plane requirement must cite its semantic QA');
assert(packageJson.scripts && /(?:^|&&\s*)node qa\/mainline-control-plane\.js(?:\s*&&|$)/.test(packageJson.scripts.test || ''), 'full npm test must execute mainline control QA');
assert(/(?:^|&&\s*)node qa\/progress-ledger\.js(?:\s*&&|$)/.test(packageJson.scripts.test || ''), 'full npm test must execute progress ledger QA after control routing');
assert.strictEqual(packageJson.scripts['test:prove-current-evidence'], 'node qa/prove-current-build-evidence-contract.js',
  'current-build browser evidence must have an explicit fail-closed verification command');

console.log(`MAINLINE_CONTROL_PLANE_ALL_PASS requirements=${ledger.requirements.length} now=${routingCounts.NOW_CLOSURE} developmentOpen=${routingCounts.NON_BLOCKING_FOR_DEVELOPMENT} releaseExternal=${routingCounts.EXTERNAL_GATE} deferred=${routingCounts.DEFERRED_MAINLINE} future=${routingCounts.FUTURE_EXPANSION}`);
