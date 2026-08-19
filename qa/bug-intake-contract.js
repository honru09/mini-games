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
const contractPath = path.join(ROOT, 'requirements', 'BUG_INTAKE_CONTRACT.md');
const templatePath = path.join(ROOT, 'requirements', 'BUG_INTAKE_TEMPLATE.json');
check('Bug Intake 合同存在', fs.existsSync(contractPath));
check('Bug Intake 模板存在', fs.existsSync(templatePath));
const contract = fs.existsSync(contractPath) ? fs.readFileSync(contractPath, 'utf8').replace(/^\uFEFF/, '') : '';
for (const token of ['reported → triaged → reproduced → fixed → regression_verified → closed', 'needs_evidence', 'blocked', 'bugId', 'severity', 'environment', 'steps', 'expected', 'actual', 'evidence', 'owner', 'rollback', 'P0', 'P1', 'P2', 'P3', 'closed']) {
  check(`合同包含 ${token}`, contract.includes(token));
}
let template = null;
try { template = JSON.parse(fs.readFileSync(templatePath, 'utf8').replace(/^\uFEFF/, '')); } catch {}
for (const key of ['bugId', 'summary', 'severity', 'area', 'firstSeen', 'environment', 'steps', 'expected', 'actual', 'evidence', 'owner', 'linkedRequirements', 'status', 'fix', 'regression', 'rollback']) check(`模板字段 ${key}`, template && Object.prototype.hasOwnProperty.call(template, key));
const sensitive = /(?:sk-[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{12,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,})/i;
check('合同与模板无敏感信息示例', !sensitive.test(contract) && !sensitive.test(fs.readFileSync(templatePath, 'utf8')));
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'requirements', 'PRODUCT_REQUIREMENTS_LEDGER.json'), 'utf8').replace(/^\uFEFF/, ''));
const item = ledger.requirements.find(entry => entry.id === 'TECH-041');
check('TECH-041 已进入 implemented', item && item.status === 'implemented');
check('TECH-041 引用 Bug Intake 合同', item && Array.isArray(item.evidence) && item.evidence.includes('qa/bug-intake-contract.js'));
if (failures) process.exit(1);
console.log('BUG_INTAKE_CONTRACT_ALL_PASS');
