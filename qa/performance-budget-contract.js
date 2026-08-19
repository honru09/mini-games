#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, '');
const contractPath = 'requirements/PERFORMANCE_BUDGET_CONTRACT.md';
check('性能预算合同存在', fs.existsSync(path.join(ROOT, contractPath)));
const contract = fs.existsSync(path.join(ROOT, contractPath)) ? read(contractPath) : '';
for (const token of ['Shell', 'Game Stage', 'Motion', 'Assets', 'Lists', 'transform', 'opacity', 'lazy-load', 'NOT_EXECUTED', 'Golden Set', 'ScrollTrigger']) check(`合同包含 ${token}`, contract.includes(token));
for (const forbidden of ['动画 width/height/top/left', '不把所有节点都设置']) check(`合同包含禁止项：${forbidden}`, contract.includes(forbidden));
const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
const manifestIds = assets.map(asset => asset.asset_id || asset.id || asset.runtime_id).filter(Boolean);
const integratedIds = assets.filter(asset => /^integrated(?:-|$)/.test(String(asset.status || ''))).map(asset => asset.asset_id || asset.id || asset.runtime_id).filter(Boolean);
check('Manifest integrated 资产 ID 唯一', new Set(integratedIds).size === integratedIds.length);
check('Manifest 资产条目有稳定 ID 字段', manifestIds.length === assets.length);
check('Manifest 路径不越界', assets.flatMap(asset => [asset.runtime_path, ...Object.values(asset.variants || {})]).filter(Boolean).every(value => String(value).startsWith('public/assets/') && !String(value).includes('../')));
const runtime = [read('public/index-template.html'), ...fs.readdirSync(path.join(ROOT, 'public', 'src'), {recursive: true}).filter(file => file.endsWith('.js')).map(file => read(path.join('public/src', file)))].join('\n');
check('动效源码不使用布局属性 tween', !/gsap\.(?:to|from|fromTo)\([^\n]*(?:width|height|top|left|margin|padding)\s*:/.test(runtime));
check('动效源码包含 reduced-motion/清理边界', runtime.includes('prefers-reduced-motion') && /dispose|kill|revert/.test(runtime));
const ledger = JSON.parse(read('requirements/PRODUCT_REQUIREMENTS_LEDGER.json'));
const item = ledger.requirements.find(entry => entry.id === 'TECH-033');
check('TECH-033 已进入 implemented', item && item.status === 'implemented');
check('TECH-033 引用性能合同', item && Array.isArray(item.evidence) && item.evidence.includes('qa/performance-budget-contract.js'));
check('合同无敏感凭证格式', !/(?:sk-[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{12,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,})/i.test(contract));
if (failures) process.exit(1);
console.log(`PERFORMANCE_BUDGET_CONTRACT_ALL_PASS assets=${assets.length}`);
