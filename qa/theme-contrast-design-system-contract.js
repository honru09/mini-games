#!/usr/bin/env node
'use strict';

/*
 * Theme Contrast Design System P1
 *
 * This is intentionally a source contract, not a visual-browser substitute.
 * It keeps the platform shell's two runtime themes measurable while leaving
 * product skins and the Game Stage's own ink/cream palette out of scope.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const template = read('public/index-template.html');
const utils = read('public/src/core/01-utils.js');
const css = template.replace(/\/\*[\s\S]*?\*\//g, '');

let failures = 0;
let assertions = 0;
function check(value, label, detail = '') {
  assertions += 1;
  if (value) {
    console.log('PASS', label);
    return;
  }
  failures += 1;
  console.error('FAIL', label + (detail ? ` — ${detail}` : ''));
}

function cssRules(source) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({
    selector: match[1].replace(/\s+/g, ' ').trim(),
    body: match[2].replace(/\s+/g, ' ').trim(),
  }));
}
const rules = cssRules(css);

function declarations(body) {
  const values = Object.create(null);
  for (const declaration of body.split(';')) {
    const index = declaration.indexOf(':');
    if (index < 1) continue;
    const name = declaration.slice(0, index).trim();
    const value = declaration.slice(index + 1).trim();
    if (name) values[name] = value;
  }
  return values;
}

function selectorHasTheme(selector, theme) {
  const escaped = theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`html\\s*\\[\\s*data-theme\\s*=\\s*["']?${escaped}["']?\\s*\\]`, 'i').test(selector);
}

const TOKEN_GROUPS = Object.freeze({
  surface: ['--surface-canvas', '--surface-solid', '--surface-raised', '--surface-muted', '--surface-inverse'],
  text: ['--text-primary', '--text-secondary', '--text-on-accent', '--text-on-inverse'],
  accent: ['--accent', '--accent-strong'],
  border: ['--border-subtle', '--border-strong'],
  focus: ['--focus-ring-color'],
  disabled: ['--disabled-fg', '--disabled-bg', '--disabled-border'],
  status: ['--status-success', '--status-warning', '--status-danger'],
  icon: ['--icon-primary', '--icon-muted'],
  overlay: ['--overlay-backdrop'],
  glass: ['--glass-surface', '--glass-border'],
});
const REQUIRED_TOKENS = Object.freeze(Object.values(TOKEN_GROUPS).flat());
const OPAQUE_CONTRAST_TOKENS = Object.freeze([
  '--surface-canvas', '--surface-solid', '--surface-raised', '--surface-muted', '--surface-inverse',
  '--text-primary', '--text-secondary', '--text-on-accent', '--text-on-inverse',
  '--accent', '--accent-strong', '--border-subtle', '--border-strong', '--focus-ring-color',
  '--disabled-fg', '--disabled-bg', '--disabled-border', '--status-success', '--status-warning',
  '--status-danger', '--icon-primary', '--icon-muted',
]);

function themeTokens(theme) {
  const candidates = rules
    .filter(rule => selectorHasTheme(rule.selector, theme))
    .map(rule => ({ rule, values: declarations(rule.body) }))
    .map(candidate => ({
      ...candidate,
      score: REQUIRED_TOKENS.reduce((count, token) => count + Number(Boolean(candidate.values[token])), 0),
    }))
    .sort((left, right) => right.score - left.score);
  return candidates[0] || { rule: null, values: Object.create(null), score: 0 };
}

function parseCssColor(value) {
  const source = String(value || '').trim().toLowerCase();
  const hex = source.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map(char => char + char).join('');
    const alpha = digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1;
    return { r: parseInt(digits.slice(0, 2), 16), g: parseInt(digits.slice(2, 4), 16), b: parseInt(digits.slice(4, 6), 16), a: alpha };
  }
  const rgb = source.match(/^rgba?\(\s*([+-]?(?:\d*\.\d+|\d+)%?)\s*,\s*([+-]?(?:\d*\.\d+|\d+)%?)\s*,\s*([+-]?(?:\d*\.\d+|\d+)%?)(?:\s*,\s*([+-]?(?:\d*\.\d+|\d+)%?))?\s*\)$/i);
  if (!rgb) return null;
  const channel = raw => raw.endsWith('%') ? Math.round(Number(raw.slice(0, -1)) * 2.55) : Number(raw);
  const alpha = raw => raw === undefined ? 1 : raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
  const result = { r: channel(rgb[1]), g: channel(rgb[2]), b: channel(rgb[3]), a: alpha(rgb[4]) };
  if (![result.r, result.g, result.b, result.a].every(Number.isFinite)) return null;
  if (result.r < 0 || result.r > 255 || result.g < 0 || result.g > 255 || result.b < 0 || result.b > 255 || result.a < 0 || result.a > 1) return null;
  return result;
}

function linearChannel(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}
function luminance(color) {
  return 0.2126 * linearChannel(color.r) + 0.7152 * linearChannel(color.g) + 0.0722 * linearChannel(color.b);
}
function contrast(left, right) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function roundedRatio(left, right) {
  return contrast(left, right).toFixed(2) + ':1';
}

function hasSemanticRule(selectorPattern, tokens) {
  return rules.some(rule => selectorPattern.test(rule.selector) && tokens.every(token => rule.body.includes(`var(${token})`)));
}
function hasRule(selectorPattern, assertion) {
  return rules.some(rule => selectorPattern.test(rule.selector) && assertion(rule.body, rule.selector));
}

// 1) Two full, local theme blocks. A late compatibility alias is not enough:
// each runtime theme must carry the entire semantic palette itself.
const themePalette = Object.create(null);
for (const theme of ['light', 'dark']) {
  const candidate = themeTokens(theme);
  const missing = REQUIRED_TOKENS.filter(token => !candidate.values[token]);
  check(candidate.score === REQUIRED_TOKENS.length,
    `${theme} theme defines the complete semantic platform palette`,
    missing.length ? `missing ${missing.join(', ')}` : 'palette was split across non-authoritative blocks');
  themePalette[theme] = candidate.values;

  for (const token of OPAQUE_CONTRAST_TOKENS) {
    const color = parseCssColor(candidate.values[token]);
    check(Boolean(color) && color.a === 1,
      `${theme} ${token} is an opaque, directly measurable color token`,
      `got ${String(candidate.values[token] || '(missing)')}`);
  }
  for (const token of [...TOKEN_GROUPS.overlay, ...TOKEN_GROUPS.glass]) {
    const color = parseCssColor(candidate.values[token]);
    check(Boolean(color) && color.a > 0,
      `${theme} ${token} is an explicit non-transparent semantic layer`,
      `got ${String(candidate.values[token] || '(missing)')}`);
  }
}

// 2) Independent WCAG calculations.  These use literal token values rather
// than CSS/implementation heuristics, so a color regression cannot be hidden
// behind a reusable alias or opacity rule.
for (const theme of ['light', 'dark']) {
  const values = themePalette[theme];
  const color = token => parseCssColor(values[token]);
  const pairs = [
    ['primary text / solid surface', '--text-primary', '--surface-solid', 4.5],
    ['secondary text / solid surface', '--text-secondary', '--surface-solid', 4.5],
    ['on-accent text / accent', '--text-on-accent', '--accent', 4.5],
    ['on-inverse text / inverse surface', '--text-on-inverse', '--surface-inverse', 4.5],
    ['focus ring / solid surface', '--focus-ring-color', '--surface-solid', 3],
    ['subtle border / solid surface', '--border-subtle', '--surface-solid', 3],
    ['strong border / solid surface', '--border-strong', '--surface-solid', 3],
    ['disabled foreground / disabled background', '--disabled-fg', '--disabled-bg', 3],
    ['disabled border / disabled background', '--disabled-border', '--disabled-bg', 3],
    ['primary icon / solid surface', '--icon-primary', '--surface-solid', 3],
    ['muted icon / solid surface', '--icon-muted', '--surface-solid', 3],
  ];
  for (const [label, leftName, rightName, minimum] of pairs) {
    const left = color(leftName);
    const right = color(rightName);
    const ratio = left && right ? contrast(left, right) : 0;
    check(Boolean(left) && Boolean(right) && ratio >= minimum,
      `${theme} ${label} meets ${minimum}:1`,
      `${roundedRatio(left || { r: 0, g: 0, b: 0 }, right || { r: 0, g: 0, b: 0 })} from ${leftName}/${rightName}`);
  }
}

// 3) Runtime API remains exactly two themes; old persisted values still have a
// defined compatibility destination. This is a behavioural VM seam, not a
// source-string approximation.
const themeWrites = [];
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  localStorage: { getItem: () => null, setItem: () => {} },
  t: key => key,
  setButtonIcon: () => {},
  document: {
    addEventListener: () => {},
    getElementById: () => null,
    documentElement: { setAttribute: (name, value) => themeWrites.push([name, value]) },
    body: { classList: { add: () => {}, remove: () => {}, toggle: () => {} }, querySelectorAll: () => [] },
    querySelectorAll: () => [],
  },
};
vm.createContext(sandbox);
try {
  vm.runInContext(utils, sandbox, { filename: '01-utils.js' });
  const result = vm.runInContext(`JSON.stringify({
    list: THEME_LIST.map(item => item.id),
    light: normalizeTheme('light'), dark: normalizeTheme('dark'),
    midnight: normalizeTheme('midnight'), ocean: normalizeTheme('ocean'),
    forest: normalizeTheme('forest'), cyber: normalizeTheme('cyber'), sakura: normalizeTheme('sakura')
  })`, sandbox);
  const runtime = JSON.parse(result);
  check(JSON.stringify(runtime.list) === JSON.stringify(['light', 'dark']), 'runtime exposes only light and dark themes');
  check(runtime.light === 'light' && runtime.dark === 'dark' &&
      runtime.midnight === 'dark' && runtime.ocean === 'light' && runtime.forest === 'light' &&
      runtime.cyber === 'dark' && runtime.sakura === 'light',
    'legacy stored theme values normalize into the two runtime themes');
  vm.runInContext(`applyTheme('ocean'); applyTheme('cyber');`, sandbox);
  check(JSON.stringify(themeWrites.slice(-2)) === JSON.stringify([['data-theme', 'light'], ['data-theme', 'dark']]),
    'theme application never writes a legacy runtime theme attribute');
} catch (error) {
  check(false, 'theme runtime can execute its light/dark compatibility seam', error && error.message);
}

// 4) Do not resurrect the former six-theme CSS. This deliberately inspects
// only html[data-theme="..."] selectors, so gameplay data skins, asset catalog
// product themes, and any word such as "cyber" outside the runtime selector are
// not false positives.
const staleThemeSelectors = [];
for (const match of css.matchAll(/html\s*\[\s*data-theme\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\]\s]+))\s*\]/gi)) {
  const value = String(match[1] || match[2] || match[3] || '').trim().toLowerCase();
  if (['midnight', 'ocean', 'forest', 'cyber', 'sakura'].includes(value)) staleThemeSelectors.push(value);
}
check(staleThemeSelectors.length === 0,
  'CSS has no legacy runtime html[data-theme] selector',
  staleThemeSelectors.length ? `found ${[...new Set(staleThemeSelectors)].join(', ')}` : '');

// 5) Representative platform surfaces must consume the shared semantic tokens,
// rather than solve contrast page-by-page with historical raw rgba values.
const componentContracts = [
  ['login card', /\.ghost-auth-card\b/, ['--glass-surface', '--glass-border']],
  ['header', /\.app-header\b/, ['--glass-surface', '--glass-border']],
  ['Home card', /\.home-glass-card\b/, ['--glass-surface', '--glass-border']],
  ['Games workspace tabs', /\.games-workspace-tabs\b/, ['--glass-surface', '--glass-border']],
  ['Lobby row', /\.lobby-row\b/, ['--surface-raised', '--border-subtle']],
  ['Playline card', /\.playline-card\b/, ['--surface-raised', '--border-subtle']],
  ['Direct Message dialog', /\.direct-message-dialog\b/, ['--glass-surface', '--glass-border']],
  ['Profile statistic', /\.profile-route-stat\b/, ['--surface-muted', '--border-subtle']],
  ['Shop preview', /\.shop-preview-panel\b/, ['--surface-raised', '--border-subtle']],
  ['Dialog', /\.modal-card\b/, ['--surface-solid', '--border-subtle']],
  ['Overlay dialog', /\.overlay-card\b/, ['--surface-solid', '--border-subtle']],
  ['Toast', /\.toast\b/, ['--surface-inverse', '--text-on-inverse']],
  ['standard button', /\.btn\b/, ['--surface-solid', '--border-subtle']],
  ['primary button', /\.btn-primary\b/, ['--accent', '--text-on-accent']],
  ['text input', /(?:^|[\s,(:])input(?:\[|:|\s|,|$)/, ['--surface-solid', '--border-strong']],
];
for (const [name, selector, tokens] of componentContracts) {
  check(hasSemanticRule(selector, tokens),
    `${name} consumes ${tokens.join(' and ')}`);
}

// 6) Keyboard and disabled state are visible semantic states, not an opacity
// side effect. Inputs are included because the frozen scope explicitly covers
// them alongside buttons.
check(hasRule(/:focus-visible\b/, body => /(?:outline|box-shadow)\s*:[^;]*var\(--focus-ring-color\)/.test(body)),
  'focus-visible uses the measurable focus token');
check(hasRule(/\.btn:disabled\b/, body =>
  body.includes('var(--disabled-fg)') && body.includes('var(--disabled-bg)') &&
  body.includes('var(--disabled-border)') && !/opacity\s*:\s*(?:0(?:\.0+)?|\.\d+)/.test(body)),
  'disabled buttons use explicit foreground, background and border tokens without dim-only contrast');
check(hasRule(/input:disabled\b/, body =>
  body.includes('var(--disabled-fg)') && body.includes('var(--disabled-bg)') && body.includes('var(--disabled-border)')),
  'disabled inputs use the same explicit semantic disabled palette');

// 7) The authentication logo must keep the two-mode identity behaviour that
// prevented the original dark-mode invisible mark regression.
const darkLogoRules = rules.filter(rule => selectorHasTheme(rule.selector, 'dark') && /\.ghost-auth-brand-logo\s+img\b/.test(rule.selector));
check(darkLogoRules.some(rule => /filter\s*:\s*[^;]*brightness\(0\)\s+invert\(1\)/i.test(rule.body)),
  'dark login logo is explicitly inverted for the dark background');
const lightLogoRules = rules.filter(rule => selectorHasTheme(rule.selector, 'light') && /\.ghost-auth-brand-logo\s+img\b/.test(rule.selector));
check(lightLogoRules.every(rule => !/filter\s*:\s*(?!none\b)[^;]+/i.test(rule.body)),
  'light login logo never receives a non-default filter');

// 8) Product-owned profile backgrounds and the tabletop Game Stage retain their
// own palette contracts; the platform shell must not recolor them through new
// surface/text/accent tokens.
for (let id = 0; id <= 6; id += 1) {
  const selector = new RegExp(`\\.profile-hero\\.bg-${id}\\b`);
  const independentRule = rules.some(rule => selector.test(rule.selector) &&
    selectorHasTheme(rule.selector, 'light') && selectorHasTheme(rule.selector, 'dark') &&
    !/var\(--(?:surface|text|accent|border|glass|overlay|focus|disabled|icon)-/.test(rule.body));
  check(independentRule,
    `profile background bg-${id} remains one product-owned light/dark-independent rule`);
}
const stageBase = rules.find(rule => /#screen-game\.game-stage\b/.test(rule.selector) && !selectorHasTheme(rule.selector, 'dark') && !selectorHasTheme(rule.selector, 'light'));
const stageDark = rules.find(rule => selectorHasTheme(rule.selector, 'dark') && /#screen-game\.game-stage\b/.test(rule.selector));
check(Boolean(stageBase) && ['--stage-paper', '--stage-cream', '--stage-ink', '--stage-line'].every(token => stageBase.body.includes(token)) &&
    !/var\(--(?:surface|text|accent|border|glass|overlay|focus|disabled|icon)-/.test(stageBase.body),
  'Game Stage base owns separate Ink/Cream palette tokens');
check(Boolean(stageDark) && /--stage-(?:paper|cream|shadow)/.test(stageDark.body) &&
    !/var\(--(?:surface|text|accent|border|glass|overlay|focus|disabled|icon)-/.test(stageDark.body),
  'dark Game Stage adjusts only its own stage palette, not platform shell tokens');

if (failures) {
  console.error(`THEME_CONTRAST_DESIGN_SYSTEM_CONTRACT_FAILURES=${failures} assertions=${assertions}`);
  process.exit(1);
}
console.log(`THEME_CONTRAST_DESIGN_SYSTEM_CONTRACT_ALL_PASS assertions=${assertions}`);
