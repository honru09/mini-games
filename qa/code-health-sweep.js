#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const normalize = value => String(value || '').replace(/\\/g, '/');
let failures = 0;

function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}

function filesUnder(relative, predicate = () => true) {
  const root = path.join(ROOT, relative);
  const output = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && predicate(absolute)) output.push(normalize(path.relative(ROOT, absolute)));
    }
  };
  visit(root);
  return output.sort();
}

function manifestFlags(asset) {
  const values = [];
  if (typeof asset.feature_flag === 'string') values.push(asset.feature_flag);
  if (asset.feature_flags && Array.isArray(asset.feature_flags.ids)) values.push(...asset.feature_flags.ids);
  return values;
}

const packageJson = JSON.parse(read('package.json'));
const scriptSource = Object.values(packageJson.scripts || {}).join('\n');
const qaReferences = new Set([...scriptSource.matchAll(/(?:^|[\s&])((?:\.\/)?qa\/[A-Za-z0-9_.-]+\.js)\b/g)]
  .map(match => normalize(match[1]).replace(/^\.\//, '')));
const scriptReferences = new Set([...scriptSource.matchAll(/(?:^|[\s&])((?:\.\/)?scripts\/[A-Za-z0-9_.-]+\.js)\b/g)]
  .map(match => normalize(match[1]).replace(/^\.\//, '')));
const qaFiles = filesUnder('qa', file => file.endsWith('.js'))
  .filter(file => !file.startsWith('qa/helpers/'));
const scriptFiles = filesUnder('scripts', file => file.endsWith('.js'));

check('package 中登记的 QA 文件全部存在', [...qaReferences].every(exists));
check('package 中登记的脚本文件全部存在', [...scriptReferences].every(exists));
const unregisteredQa = qaFiles.filter(file => !qaReferences.has(file));
check('全部 QA 都有 package 可执行入口', unregisteredQa.length === 0, unregisteredQa.join(', '));
check('持久化/AI 强化 QA 有独立健康入口', /qa\/persistence-ai-hardening\.js/.test(packageJson.scripts['test:health'] || ''));
check('社交 Guard QA 有独立健康入口', /qa\/social-guards\.js/.test(packageJson.scripts['test:health'] || ''));

const OPERATIONS_ALLOWLIST = Object.freeze([
  'scripts/art-gate-status.js',
  'scripts/device-qa-runner.js',
  'scripts/generate-auth-art-v1.js',
  'scripts/generate-game-stage-art-v1.js',
  'scripts/generate-gomoku-final-art-v1.js',
  'scripts/generate-honru-context-reactions-v1.js',
  'scripts/generate-loading-art-v1.js',
  'scripts/generate-ludo-final-art-v1.js',
  'scripts/generate-modal-art-v1.js',
  'scripts/generate-platform-scenes-v1.js',
  'scripts/render-deploy.js',
  'scripts/render-env.js',
  'scripts/render-status.js',
  'scripts/supabase-backup-verify.js',
  'scripts/supabase-gate-checklist.js',
  'scripts/ws-live-test.js',
]);
const unregisteredScripts = scriptFiles.filter(file => !scriptReferences.has(file));
check('未注册脚本仅为显式保留的运维与外部门禁工具',
  JSON.stringify(unregisteredScripts) === JSON.stringify([...OPERATIONS_ALLOWLIST].sort()),
  unregisteredScripts.join(', '));
check('线上运维白名单文件全部存在', OPERATIONS_ALLOWLIST.every(exists));

const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const integrated = (manifest.assets || []).filter(asset => /^integrated(?:-|$)/.test(String(asset.status || '')));
const integratedPaths = integrated.flatMap(asset => [asset.runtime_path, ...Object.values(asset.variants || {})]
  .filter(value => typeof value === 'string'));
check('Manifest integrated 运行时文件全部存在且不越界', integratedPaths.every(relative => {
  const normalized = normalize(relative);
  return normalized.startsWith('public/assets/') && !normalized.includes('../') && exists(normalized);
}));
const runtimeSources = [read('public/index-template.html'), ...filesUnder('public/src', file => file.endsWith('.js')).map(read)].join('\n');
const flags = [...new Set((manifest.assets || []).flatMap(manifestFlags))].sort();
const staleFlags = flags.filter(flag => !runtimeSources.includes(flag));
check('Manifest Feature Flag 均有运行时消费者', staleFlags.length === 0, staleFlags.join(', '));

check('权威 Theme Contrast P1 合同保留并登记',
  exists('qa/theme-contrast-design-system.js') && /qa\/theme-contrast-design-system\.js/.test(packageJson.scripts['test:theme-contrast'] || ''));
check('被替代的重复 Theme Contrast 合同已清理',
  !exists('qa/theme-contrast-design-system-contract.js') && !scriptSource.includes('theme-contrast-design-system-contract.js'));
const temporaryHelpers = ['scripts/create-fix-publish.js', 'scripts/publish-isolated.js'];
check('一次性发布 helper 未残留', temporaryHelpers.every(file => !exists(file)), temporaryHelpers.filter(exists).join(', '));

const ledger = JSON.parse(read('requirements/PRODUCT_REQUIREMENTS_LEDGER.json'));
const status = JSON.parse(read('PROJECT_STATUS.json'));
check('需求台账发布策略为显式用户命令且项目状态未伪造待发布候选',
  ledger.deploymentPolicy && ledger.deploymentPolicy.mode === 'explicit-user-command-only' &&
  status.releaseCandidate && status.releaseCandidate.status === 'not_executed' &&
  /明确发布命令/.test(String(status.releaseCandidate.reason || '')) &&
  !/production-ready|ready_to_release/i.test(String(status.releaseCandidate.status || '')));
check('TECH-040 仍由当前台账管理',
  Array.isArray(ledger.requirements) && ledger.requirements.some(item => item.id === 'TECH-040'));
check('Code Health 活跃任务存在且保持本地发布边界',
  exists('requirements/active/code-health-sweep-p1-20260813/plan.json') &&
  /LOCAL_ONLY_NO_COMMIT_NO_PUSH_NO_DEPLOY/.test(read('requirements/active/code-health-sweep-p1-20260813/plan.json')));
check('Game Stage HUD 活跃任务存在且保持本地发布边界',
  exists('requirements/active/game-stage-hud-density-close-p1-20260813/plan.json') &&
  /LOCAL_ONLY_NO_COMMIT_NO_PUSH_NO_DEPLOY/.test(read('requirements/active/game-stage-hud-density-close-p1-20260813/plan.json')));

if (failures) {
  console.error(`CODE_HEALTH_SWEEP_FAILED: ${failures}`);
  process.exit(1);
}
console.log('CODE_HEALTH_SWEEP_ALL_PASS');
