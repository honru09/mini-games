#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const dir = path.join(ROOT, 'requirements', 'ADR');
let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}
check('ADR 目录存在', fs.existsSync(dir));
const read = name => fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, '');
check('ADR README 存在', fs.existsSync(path.join(dir, 'README.md')));
check('ADR 模板存在', fs.existsSync(path.join(dir, '000-template.md')));
const readme = fs.existsSync(path.join(dir, 'README.md')) ? read('README.md') : '';
for (const token of ['proposed', 'accepted', 'superseded', 'rejected', 'Requirement ID', 'NOT_EXECUTED', 'BLOCKED']) {
  check(`ADR 规则包含 ${token}`, readme.includes(token));
}
const template = fs.existsSync(path.join(dir, '000-template.md')) ? read('000-template.md') : '';
for (const token of ['状态：', '背景', '决策', '替代方案', '证据与验收', '风险、兼容与回滚', '后续动作']) {
  check(`ADR 模板包含 ${token}`, template.includes(token));
}
const sensitive = /(?:sk-|rnd_|sb_(?:secret|publishable)_|Bearer\s+)/i;
for (const file of fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith('.md')) : []) {
  check(`ADR 不包含敏感凭证：${file}`, !sensitive.test(read(file)));
}
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'requirements', 'PRODUCT_REQUIREMENTS_LEDGER.json'), 'utf8').replace(/^\uFEFF/, ''));
const item = ledger.requirements.find(entry => entry.id === 'TECH-039');
check('TECH-039 已进入 implemented', item && item.status === 'implemented');
check('TECH-039 引用 ADR 入口', item && Array.isArray(item.evidence) && item.evidence.includes('requirements/ADR/README.md'));
if (failures) process.exit(1);
console.log('ADR_CONTRACT_ALL_PASS');
