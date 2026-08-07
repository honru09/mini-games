/* Validate the machine-readable Project Execution OS contracts without network access. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
let failed = false;
function check(ok, message) { console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`); if (!ok) failed = true; }
function fileExists(file) { return fs.existsSync(path.join(root, file)); }

let status, motion, gates, ownership, skills;
try { status = readJson('PROJECT_STATUS.json'); check(true, 'PROJECT_STATUS.json parses'); } catch (e) { check(false, `PROJECT_STATUS.json parses (${e.message})`); }
try { motion = readJson('MOTION_TOKENS.json'); check(true, 'MOTION_TOKENS.json parses'); } catch (e) { check(false, `MOTION_TOKENS.json parses (${e.message})`); }
try { gates = readJson('requirements/QUALITY_GATES.json'); check(true, 'QUALITY_GATES.json parses'); } catch (e) { check(false, `QUALITY_GATES.json parses (${e.message})`); }
try { ownership = readJson('requirements/OWNERSHIP_MATRIX.json'); check(true, 'OWNERSHIP_MATRIX.json parses'); } catch (e) { check(false, `OWNERSHIP_MATRIX.json parses (${e.message})`); }
try { skills = readJson('requirements/skills-registry.json'); check(true, 'skills-registry.json parses'); } catch (e) { check(false, `skills-registry.json parses (${e.message})`); }

const allowedStates = new Set(['planned', 'partial', 'implemented', 'verified', 'production-ready', 'not_executed', 'blocked']);
if (status) {
  check(status.schemaVersion === 1, 'PROJECT_STATUS schema version is 1');
  check(allowedStates.has(status.releaseCandidate && status.releaseCandidate.status), 'release candidate uses a valid state');
  for (const [id, capability] of Object.entries(status.capabilities || {})) check(allowedStates.has(capability.status), `${id} uses a valid capability state`);
  const gateNames = Object.keys(status.qualityGates || {});
  check(gateNames.length >= 10, 'status records the full quality gate family');
}
if (motion) {
  check(motion.schemaVersion === 1, 'MOTION_TOKENS schema version is 1');
  check(motion.durationsMs && motion.durationsMs.fast === 120 && motion.durationsMs.hero === 600, 'motion duration tokens match the project standard');
  check(motion.budgets && motion.budgets.minimumTouchTargetPx >= 44, 'motion touch-target budget is accessible');
  check(motion.policy && motion.policy.respectReducedMotion && motion.policy.neverBlockInput, 'motion policy protects reduced motion and input');
}
if (gates) {
  check(gates.schemaVersion === 1, 'QUALITY_GATES schema version is 1');
  check(Array.isArray(gates.order) && gates.order.length >= 10, 'quality gate order has all release stages');
  gates.order.forEach(name => check(gates.gates && gates.gates[name], `quality gate ${name} is configured`));
}
if (ownership) {
  check(ownership.schemaVersion === 1, 'OWNERSHIP_MATRIX schema version is 1');
  check(ownership.roles && ownership.roles.master, 'Master role owns shared integration files');
  check(Object.keys(ownership.roles || {}).length >= 4, 'ownership matrix has independent role boundaries');
}
if (skills) {
  check(skills.entries && skills.entries.length >= 5, 'third-party skill registry has audited reference entries');
  check((skills.entries || []).every(entry => ['REFERENCE', 'PILOT', 'APPROVED', 'BLOCKED'].includes(entry.status)), 'third-party skills use approved registry states');
}
[
  '.agents/README.md', '.agents/skills/playroom-recon/SKILL.md', '.agents/skills/playroom-plan/SKILL.md',
  '.agents/skills/playroom-release/SKILL.md', 'requirements/active/README.md', 'HIGH_RISK_FILES.md',
].forEach(file => check(fileExists(file), `${file} exists`));

if (failed) process.exit(1);
console.log('PROJECT_STATE_ALL_PASS');
