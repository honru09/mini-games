/* Read-only Project Execution OS reconnaissance. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const rel = file => path.join(root, file);
const exists = file => fs.existsSync(rel(file));
function git(...argv) {
  try { return execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}
function section(name, value) {
  if (args.has('--json')) return;
  console.log(`\n${name}`);
  if (Array.isArray(value)) value.forEach(item => console.log(`- ${item}`));
  else console.log(value || '(none)');
}

const status = git('status', '--short');
const recent = git('log', '-8', '--oneline');
const changed = git('log', '--since=30 days ago', '--name-only', '--format=').split(/\r?\n/).filter(Boolean);
const frequency = new Map();
changed.forEach(file => frequency.set(file, (frequency.get(file) || 0) + 1));
const hotFiles = [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([file, count]) => `${file} (${count} recent changes)`);
const required = ['AGENTS.md', 'README.md', 'PROJECT_STATUS.json', 'HIGH_RISK_FILES.md', 'MOTION_TOKENS.json', 'requirements/QUALITY_GATES.json', 'public/index-template.html', 'public/index.html', 'scripts/build.js'];
const missing = required.filter(file => !exists(file));
const generated = ['public/index.html'];
const shared = ['server/index.js', 'public/src/online/03-websocket.js', 'scripts/build.js', 'public/src/08-registry.js', 'server/reward-engine.js', 'supabase/schema.sql'];
const tests = (() => {
  try { return Object.keys(JSON.parse(fs.readFileSync(rel('package.json'), 'utf8')).scripts || {}).filter(key => key.startsWith('test')); }
  catch { return []; }
})();

if (args.has('--json')) {
  console.log(JSON.stringify({
    currentState: { branch: git('branch', '--show-current'), status: status ? 'dirty' : 'clean', recentCommits: recent.split(/\r?\n/).filter(Boolean) },
    hotFiles, sharedFiles: shared, generatedFiles: generated, missing, tests, riskLevel: missing.length ? 'BLOCKED' : 'HIGH',
  }, null, 2));
} else {
  section('Current State', `branch=${git('branch', '--show-current') || 'unknown'}; worktree=${status ? 'dirty (expected during task)' : 'clean'}\n${recent || '(no git history)'}`);
  section('Hot Files', hotFiles);
  section('Shared Files', shared);
  section('Generated Files', generated);
  section('Likely Conflicts', status ? status.split(/\r?\n/).slice(0, 20) : ['none']);
  section('Existing Tests', tests);
  section('Relevant Requirements', ['requirements/QUALITY_GATES.json', 'requirements/OWNERSHIP_MATRIX.json', 'requirements/active/README.md']);
  section('Risk Level', missing.length ? `BLOCKED: missing ${missing.join(', ')}` : 'HIGH: shared protocol and generated frontend require Master integration');
}
if (args.has('--check') && missing.length) process.exitCode = 1;
