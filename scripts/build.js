// Build script: concatenate public/src/* modules into public/index.html
// Usage: node scripts/build.js
// Zero dependencies, zero configuration.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'public', 'index-template.html');
const OUT = path.join(ROOT, 'public', 'index.html');

// JS modules in concatenation order
const MODULES = [
  'core/00-i18n.js',
  'core/01-utils.js',
  'core/02-app-shell.js',
  'online/03-websocket.js',
  'shop/04-auth.js',
  'shop/05-profile.js',
  'shop/06-shop.js',
  'ui/07-roster.js',
  'games/tictactoe.js',
  'games/gomoku.js',
  'games/ludo.js',
  'games/monopoly.js',
  'games/checker.js',
  'games/tank.js',
  'games/snake.js',
  'games/tetris.js',
  'games/draughts.js',
  'games/jungle.js',
  'games/xiangqi.js',
  '08-registry.js',
];

function build() {
  // Read template
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const marker = '<!-- BUILD:JS -->';

  if (!template.includes(marker)) {
    console.error('ERROR: Template missing <!-- BUILD:JS --> marker');
    process.exit(1);
  }

  // Concatenate all JS modules
  const srcDir = path.join(ROOT, 'public', 'src');
  let js = '';
  for (const mod of MODULES) {
    const filePath = path.join(srcDir, mod);
    if (!fs.existsSync(filePath)) {
      console.error('ERROR: Module not found: ' + mod);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    js += content.replace(/\r?\n$/, '') + '\n';
  }
  js = js.trimEnd();

  // Use callback to avoid $ replacement pattern issues in String.replace
  const output = template.replace(marker, () => js);

  // Write output
  fs.writeFileSync(OUT, output, 'utf8');

  // Verify
  const scriptTags = (output.match(/<script>/g) || []).length;
  const closeTags = (output.match(/<\/script>/g) || []).length;
  console.log('Build complete: ' + OUT + ' (' + output.length + ' bytes)');
  console.log('Script tags: ' + scriptTags + ' open / ' + closeTags + ' close');

  const checks = ['function initI18n', 'function openSettingsPage', 'function gameTicTacToe',
    'function gameXiangqi', 'online.connect', 'function openAuthModal', 'function openShop',
    'function applyGameResult', 'if (typeof module'];
  for (const c of checks) {
    if (!output.includes(c)) console.warn('WARN: missing ' + c);
  }
  if (scriptTags !== 1 || closeTags !== 1) console.warn('WARN: script tag mismatch');
}

build();