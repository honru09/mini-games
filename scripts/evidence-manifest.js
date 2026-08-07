/* Produce a compact, evidence-first release receipt. No tests are claimed unless recorded in status. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const outputArg = args.find(arg => arg.startsWith('--output='));
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
function git(...argv) { try { return execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } }
const status = readJson('PROJECT_STATUS.json');
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  branch: git('branch', '--show-current'),
  releaseCandidate: status.releaseCandidate,
  qualityGates: status.qualityGates,
  visual: { automated: ['qa/dom-smoke.js'], manual: { android: 'NOT_EXECUTED', iphoneSafari: 'NOT_EXECUTED', tablet: 'NOT_EXECUTED', secondBrowser: 'NOT_EXECUTED' } },
  knownIssues: ['真实 Supabase/RLS/并发/备份回滚尚未执行', '真实设备与真实网络整形尚未执行'],
};
const text = JSON.stringify(manifest, null, 2) + '\n';
if (outputArg) fs.writeFileSync(path.resolve(root, outputArg.slice('--output='.length)), text, 'utf8');
console.log(text);
