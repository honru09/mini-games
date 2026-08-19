#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const template = read('public/index-template.html');
const utils = read('public/src/core/01-utils.js');
const roster = read('public/src/ui/07-roster.js');
const social = read('public/src/core/04-social.js');
const bridge = read('public/src/core/11-surface-motion.js');
const adapter = read('public/surface-motion-entry.js');
const pkg = JSON.parse(read('package.json'));
let failures = 0;
const check = (name, value, detail) => {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures += 1;
};

check('三类面板共享 Ghost Outcome Surface 语义类',
  /ghost-outcome-surface/.test(utils) && /ghost-outcome-surface/.test(roster) && /ghost-outcome-surface/.test(social));
check('共享结构覆盖状态标识、核心信息、明细和动作',
  /ghost-outcome-header/.test(template) && /ghost-outcome-mark/.test(template) &&
  /ghost-outcome-detail/.test(template) && /ghost-outcome-actions/.test(template));
check('Victory 移除随机彩带和高饱和彩色数组',
  !/Math\.random\(\)[\s\S]{0,300}confetti/.test(utils) && !/CONF_COLORS|--conf-dur|--conf-fall|--conf-rot/.test(utils));
check('三类面板复用单一 GhostSurfaceMotion seam',
  /runOutcomeSurfaceMotion/.test(utils) && /runOutcomeSurfaceMotion/.test(roster) && /runOutcomeSurfaceMotion/.test(social) &&
  !/surface-motion-entry|createSurfaceMotionAdapter|\bgsap\.|ScrollTrigger/.test(roster + social));
check('结果面板在 Game Shell 内有显式 allowlist，其他平台面板不越界',
  /IN_GAME_SURFACES[\s\S]*victory-dialog[\s\S]*reward-dialog/.test(bridge) && !/IN_GAME_SURFACES[\s\S]*achievement-dialog/.test(bridge));
check('Outcome Timeline 只用 transform/autoAlpha 且无持续循环',
  /request\.items/.test(adapter) && /stagger/.test(adapter) &&
  !/(width|height|top|left)\s*:/.test(adapter) && !/ScrollTrigger|requestAnimationFrame|setInterval/.test(adapter));
check('Outcome Surface 不与旧棋盘或通用 Modal keyframe 争夺 transform/opacity',
  /#board-area\s*>\s*\*:not\(\.ghost-outcome-backdrop\)/.test(template) &&
  /\.modal-backdrop:not\(\.ghost-outcome-backdrop\)/.test(template) &&
  /\.modal-card:not\(\.ghost-outcome-surface\)/.test(template));
check('关闭生命周期显式 settle Outcome 动效',
  /settleOutcomeSurfaceMotion/.test(utils) && /settleOutcomeSurfaceMotion/.test(roster) && /settleOutcomeSurfaceMotion/.test(social));
check('移动端操作、safe area 与内部滚动合同存在',
  /ghost-outcome-actions[\s\S]*min-height:\s*44px/.test(template) &&
  /env\(safe-area-inset-bottom/.test(template) && /overscroll-behavior:\s*contain/.test(template));
check('窄屏成就明细使用单列并让状态换行，避免长语言双列重叠',
  /@media\s*\(max-width:\s*480px\)[\s\S]*?\.ach-grid\s*\{\s*grid-template-columns:\s*1fr/.test(template) &&
  /\.ach-item\s*\{\s*grid-template-columns:36px minmax\(0,1fr\)/.test(template) &&
  /\.ach-state\s*\{\s*grid-column:2;white-space:normal/.test(template));
check('Outcome 专项已接入脚本且源码禁止外部 reference-only 路径',
  pkg.scripts['test:outcome-surface'] === 'node qa/outcome-surface-design-system.js' &&
  !/BaiduNetdiskDownload|external-source-register|230717/.test(template + utils + roster + social));

if (failures) {
  console.error('OUTCOME_SURFACE_DESIGN_SYSTEM_FAILURES=' + failures);
  process.exitCode = 1;
} else console.log('OUTCOME_SURFACE_DESIGN_SYSTEM_ALL_PASS');
