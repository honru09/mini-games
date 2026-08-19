#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, '');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}

const contractPath = 'requirements/VERTICAL_SLICE_DEFINITION.md';
const contract = exists(contractPath) ? read(contractPath) : '';
check('纵切完成定义合同存在', exists(contractPath));
const requiredSections = [
  '可见结果', '真实输入', '状态与错误', '三语与原文边界', '可访问性',
  'Reduced Motion', '性能与响应式', '清理与生命周期', '回滚与兼容', '权威与安全边界'
];
for (const section of requiredSections) check(`合同包含门槛：${section}`, contract.includes(section));
for (const level of ['CONTRACT', 'IMPLEMENTED_LOCAL', 'VISUAL_VERIFIED', 'PRODUCTION_READY']) {
  check(`合同包含证据等级：${level}`, contract.includes(`\`${level}\``));
}
check('合同禁止 CSS/文字/图标伪完成', /不允许用一段 CSS、一个文字标签、一个图标/.test(contract));
check('合同把外部证据待决与开发开放分离',
  contract.includes('NOT_EXECUTED / RELEASE_EVIDENCE_PENDING') &&
  contract.includes('不得级联为无关开发停工'));
check('合同开放原创美术所有者清除且不伪造人工结论',
  contract.includes('OWNER_AUTHORIZED_ART_CLEARANCE') &&
  contract.includes('OPTIONAL_ADVISORY_EVIDENCE') &&
  contract.includes('blocked-license / EXTERNAL_REFERENCE_ONLY'));
check('TECH-051 active task 存在', exists('requirements/active/vertical-slice-definition-p1-20260813/plan.json'));
if (exists('requirements/active/vertical-slice-definition-p1-20260813/plan.json')) {
  const plan = read('requirements/active/vertical-slice-definition-p1-20260813/plan.json');
  check('active task 只声明本地治理范围', plan.includes('不修改产品运行时') && plan.includes('LOCAL_ONLY_NO_COMMIT_NO_PUSH_NO_DEPLOY'));
  check('active task 归属 TECH-051', plan.includes('"TECH-051"'));
}
const ledger = JSON.parse(read('requirements/PRODUCT_REQUIREMENTS_LEDGER.json'));
const item = ledger.requirements.find(entry => entry.id === 'TECH-051');
check('TECH-051 已进入 implemented', item && item.status === 'implemented');
check('TECH-051 有当前证据入口', item && Array.isArray(item.evidence) && item.evidence.includes('qa/vertical-slice-definition.js'));
check('合同不包含明显凭证格式', !/(?:sk-|rnd_|sb_(?:secret|publishable)_|Bearer\s+)/i.test(contract));
if (failures) process.exit(1);
console.log('VERTICAL_SLICE_DEFINITION_ALL_PASS');
