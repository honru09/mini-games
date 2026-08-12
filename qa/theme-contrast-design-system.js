'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const template = read('public/index-template.html');
const utils = read('public/src/core/01-utils.js');
const packageJson = JSON.parse(read('package.json'));
const gates = read('scripts/quality-gates.js');
let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}

function themeBlock(theme) {
  const matcher = new RegExp(`html\\[data-theme=["']${theme}["']\\]\\s*\\{([^{}]*)\\}`, 'g');
  let match;
  let last = '';
  while ((match = matcher.exec(template))) last = match[1];
  return last;
}

function declarations(block) {
  const values = Object.create(null);
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+)\s*;?/g)) values[match[1]] = match[2].trim();
  return values;
}

function rgb(hex) {
  const normalized = String(hex).trim().replace(/^#/, '');
  const expanded = normalized.length === 3 ? normalized.split('').map(value => value + value).join('') : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) throw new Error(`opaque hex required, received ${hex}`);
  return [0, 2, 4].map(offset => parseInt(expanded.slice(offset, offset + 2), 16));
}

function luminance(hex) {
  const channels = rgb(hex).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function contrastCheck(theme, tokens, foreground, background, threshold) {
  let ratio = 0;
  try { ratio = contrast(tokens[foreground], tokens[background]); } catch {}
  check(`${theme} ${foreground}/${background} 对比不低于 ${threshold}:1`, ratio >= threshold, ratio.toFixed(2));
}

check('Theme Contrast P1 冻结合同与计划存在',
  fs.existsSync(path.join(ROOT, 'requirements/active/theme-contrast-design-system-p1-20260812/contract.md')) &&
  fs.existsSync(path.join(ROOT, 'requirements/active/theme-contrast-design-system-p1-20260812/plan.json')));

const themeListSource = (utils.match(/const THEME_LIST\s*=\s*\[([\s\S]*?)\];/) || [])[1] || '';
const themeIds = [...themeListSource.matchAll(/\bid\s*:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
check('运行时主题唯一且顺序固定为 light/dark', JSON.stringify(themeIds) === JSON.stringify(['light', 'dark']), JSON.stringify(themeIds));
check('旧存储主题仍归一到双主题',
  /ocean[\s\S]*forest[\s\S]*sakura[\s\S]*return\s+['"]light['"]/.test(utils) &&
  /dark[\s\S]*midnight[\s\S]*cyber[\s\S]*return\s+['"]dark['"]/.test(utils) &&
  /return\s+['"]light['"]\s*;?\s*\}/.test(utils));
check('模板不再注册旧运行时主题选择器',
  !/data-theme\s*=\s*["'](?:midnight|ocean|forest|cyber|sakura)["']/.test(template));
check('游戏 cosmetic 的 cyber skin 未被旧主题清理误删',
  /\.ludo-base\[data-base-skin=["']cyber["']\]/.test(template) &&
  /\.dice-btn\[data-dice-skin=["']cyber["']\]/.test(template));

const requiredTokens = [
  '--surface-canvas', '--surface-solid', '--surface-elevated', '--surface-overlay', '--surface-disabled',
  '--text-primary', '--text-secondary', '--accent', '--text-on-accent', '--border-color', '--focus-color',
  '--disabled-text', '--disabled-border', '--status-success', '--status-warning', '--status-danger',
  '--icon-color', '--overlay-scrim', '--glass-surface', '--glass-surface-strong', '--toast-bg', '--toast-text',
];

for (const theme of ['light', 'dark']) {
  const tokens = declarations(themeBlock(theme));
  check(`${theme} 声明完整 Theme Contrast 语义令牌`, requiredTokens.every(token => tokens[token]),
    requiredTokens.filter(token => !tokens[token]).join(','));
  contrastCheck(theme, tokens, '--text-primary', '--surface-solid', 4.5);
  contrastCheck(theme, tokens, '--text-secondary', '--surface-solid', 4.5);
  contrastCheck(theme, tokens, '--text-on-accent', '--accent', 4.5);
  contrastCheck(theme, tokens, '--focus-color', '--surface-solid', 3);
  contrastCheck(theme, tokens, '--border-color', '--surface-solid', 3);
  contrastCheck(theme, tokens, '--border-subtle', '--surface-solid', 3);
  contrastCheck(theme, tokens, '--disabled-text', '--surface-disabled', 3);
  contrastCheck(theme, tokens, '--disabled-border', '--surface-disabled', 3);
  contrastCheck(theme, tokens, '--status-success', '--surface-solid', 4.5);
  contrastCheck(theme, tokens, '--status-warning', '--surface-solid', 4.5);
  contrastCheck(theme, tokens, '--status-danger', '--surface-solid', 4.5);
}

check('按钮、输入和 Dialog 消费主题语义令牌',
  /\.btn\{[^}]*background:var\(--bg-card\)[^}]*color:var\(--text-primary\)/.test(template) &&
  /\.btn-primary\{[^}]*background:var\(--accent\)[^}]*color:var\(--text-on-accent\)/.test(template) &&
  /input\[type=["']text["'][^}]*background:var\(--bg-card-solid\)[^}]*border:1px solid var\(--border-color\)/.test(template) &&
  /\.modal-card\{[^}]*background:var\(--bg-card-solid\)[^}]*border:1px solid var\(--border-color\)/.test(template));
check('Header/Nav、Auth、Shop、DM、Profile 与 Room 使用共享主题 token',
  /\.app-header\{[^}]*border:1px solid var\(--ghost-line\)[^}]*background:var\(--ghost-glass\)/.test(template) &&
  /\.app-nav-button\[aria-current=["']page["']\]\{[^}]*background:var\(--text-primary\)[^}]*color:var\(--bg-card-solid\)/.test(template) &&
  /\.ghost-auth-tabs button\[aria-selected=["']true["']\]\{[^}]*background:var\(--text-primary\)[^}]*color:var\(--bg-card-solid\)/.test(template) &&
  /\.shop-preview-panel\{[^}]*border:1px solid var\(--border\)/.test(template) &&
  /\.direct-message-dialog\{[^}]*background:var\(--ghost-glass-strong\)!important[^}]*color:var\(--text-primary\)!important/.test(template) &&
  /\.profile-route-stat\{[^}]*border:1px solid var\(--ghost-line\)/.test(template) &&
  /\.room-launchpad-game-choice\{[^}]*background:var\(--bg-card-solid\)[^}]*color:var\(--text-primary\)/.test(template));
check('Toast、焦点和 disabled 不再依赖固定色或单纯 opacity',
  /\.toast\{[^}]*background:var\(--toast-bg\)[^}]*color:var\(--toast-text\)/.test(template) &&
  /:focus-visible[^}]*var\(--focus-color\)/.test(template) &&
  /\.btn:disabled[^}]*opacity:1[^}]*color:var\(--disabled-text\)[^}]*background:var\(--surface-disabled\)[^}]*border-color:var\(--disabled-border\)/.test(template) &&
  /\.btn:disabled:hover[^}]*transform:none/.test(template));

check('登录 Logo 明确覆盖 light 原色与 dark 反白',
  /html\[data-theme=["']light["']\][^\{\n]*\.ghost-auth-brand-logo img\{filter:none\}/.test(template) &&
  /html\[data-theme=["']dark["']\] \.ghost-auth-brand-logo img\{filter:brightness\(0\) invert\(1\)\}/.test(template));
check('PWA 浏览器栏颜色与当前双主题场景同步',
  /theme===['"]dark['"]\?['"]#05070b['"]:['"]#eaf3fa['"]/.test(utils));

check('Premium Background 有 light/dark textTone 合同且不受主题选择器重绘',
  /\.profile-hero\.premium-background\.premium-bg-light\{[^}]*--premium-profile-scrim/.test(template) &&
  /\.profile-hero\.premium-background\.premium-bg-dark\{[^}]*--premium-profile-scrim/.test(template) &&
  !/html\[data-theme=[^\]]+\][^{,]*\.premium-background/.test(template));
check('Game Stage 保持 Ink/Cream 自有语义且无平台主题定向覆盖',
  /#screen-game\.game-stage\{[^}]*(?=.*--stage-ink:)(?=.*--stage-cream:)(?=.*--stage-line:)/.test(template) &&
  !/html\[data-theme=[^\]]+\][^{,]*#screen-game\.game-stage/.test(template));

check('Theme Contrast 专项进入独立命令、pretest、full test 与 fast gate',
  String(packageJson.scripts['test:theme-contrast'] || '').includes('qa/theme-contrast-design-system.js') &&
  String(packageJson.scripts.pretest || '').includes('qa/theme-contrast-design-system.js') &&
  String(packageJson.scripts.test || '').includes('qa/theme-contrast-design-system.js') &&
  gates.includes("run('theme-contrast'") && gates.includes('qa/theme-contrast-design-system.js'));

if (failures) {
  console.error(`THEME_CONTRAST_DESIGN_SYSTEM_FAILURES=${failures}`);
  process.exit(1);
}
console.log('THEME_CONTRAST_DESIGN_SYSTEM_ALL_PASS');
