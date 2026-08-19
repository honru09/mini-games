#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const reportDir = path.join(ROOT, '简易报告');
const reportIndex = path.join(reportDir, 'README.md');
const template = path.join(reportDir, '模板-任务收口简报.md');
const contract = path.join(ROOT, 'requirements', 'BRIEF_REPORT_CONTRACT.md');
let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}
function read(file) { return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); }
check('简报合同存在', fs.existsSync(contract));
check('简报模板存在', fs.existsSync(template));
check('简报索引存在', fs.existsSync(reportIndex));
const templateText = fs.existsSync(template) ? read(template) : '';
for (const heading of ['## 一句话结论', '## 做了什么', '## 用户现在能看到什么', '## 还没做什么', '## 验证', '## 风险与下一步', '## 发布状态', '## 追溯入口']) {
  check(`模板包含 ${heading}`, templateText.includes(heading));
}
check('模板保留本地发布冻结状态', templateText.includes('LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND'));
check('模板声明未发布边界', /未提交、未推送、未触发 GitHub Pages 或 Render/.test(templateText));
const reportCandidates = fs.readdirSync(reportDir)
  .filter(name => name.endsWith('.md'))
  .filter(name => name !== 'README.md' && name !== '模板-任务收口简报.md')
  .filter(name => !/进度报告-\d{8}\.md$/.test(name));
const invalidSuffixReports = reportCandidates.filter(name => !/-\d{12}\.md$/.test(name));
check('已有简报均使用十二位时间后缀', invalidSuffixReports.length === 0, invalidSuffixReports.join(', '));
const reportFiles = reportCandidates.filter(name => /-\d{12}\.md$/.test(name));
const indexedReports = fs.existsSync(reportIndex)
  ? [...read(reportIndex).matchAll(/`([^`/\\\r\n]+\.md)`/g)]
    .map(match => match[1])
    .filter(name => /-\d{12}\.md$/.test(name) || /进度报告-\d{8}\.md$/.test(name) || /^模板-.*\.md$/.test(name))
  : [];
const missingIndexedReports = [...new Set(indexedReports)].filter(name => !fs.existsSync(path.join(reportDir, name)));
check('简报索引不包含悬空文件入口', missingIndexedReports.length === 0, missingIndexedReports.join(', '));
const forbidden = /(?:sk-[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{12,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{16,})/i;
for (const name of reportFiles) check(`简报不含敏感凭证：${name}`, !forbidden.test(read(path.join(reportDir, name))));
check('当前简报合同要求 NOT_EXECUTED 诚实记录', /NOT_EXECUTED/.test(read(contract)));
if (failures) process.exit(1);
console.log(`BRIEF_REPORT_CONTRACT_ALL_PASS reports=${reportFiles.length}`);
