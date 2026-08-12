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
  'games/00-tabletop-perspective.js',
  'core/00-i18n.js',
  'core/01-utils.js',
  'core/06-assets.js',
  // Player identity presentation is defined before consumers and resolves the
  // roster-owned catalogs lazily when its small Interface is invoked.
  'core/10-identity-presentation.js',
  '../../shared/progression/victory-mastery.js',
  '../../shared/progression/profile-journey.js',
  '../../shared/progression/collection-rarity-catalog.js',
  // Deep route-motion bridge stays synchronous and lazy-loads its DOM GSAP island only on demand.
  'core/09-route-motion.js',
  // Shared overlay motion stays presentation-only and lazy-loads the same pinned GSAP island.
  'core/11-surface-motion.js',
  'core/02-app-shell.js',
  'core/03-game-framework.js',
  'core/04-social.js',
  'core/05-ai-personas.js',
  'online/03-websocket.js',
  'core/07-playline.js',
  // Foundation is inert until an exact per-game opt-in bridge creates an instance.
  'core/08-ghost3d-foundation.js',
  'shop/04-auth.js',
  'shop/05-profile.js',
  'shop/06-shop.js',
  'ui/07-roster.js',
  '../../shared/rules/tetris.js',
  '../../shared/rules/xiangqi.js',
  '../../shared/rules/monopoly.js',
  'games/00-tabletop-art-runtime.js',
  'games/monopoly-character-presentation.js',
  'games/monopoly-presentation-adapter.js',
  'games/monopoly-ui-state.js',
  'games/gomoku.js',
  'games/ludo.js',
  'games/monopoly.js',
  'games/tank.js',
  'games/tetris.js',
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
  // Normalize generated output so Windows CRLF source files do not create
  // cross-platform build drift against the LF artifact committed by CI.
  const output = template.replace(marker, () => js).replace(/\r\n?/g, '\n');

  // Write output
  fs.writeFileSync(OUT, output, 'utf8');

  // Verify
  const scriptTags = (output.match(/<script>/g) || []).length;
  const closeTags = (output.match(/<\/script>/g) || []).length;
  console.log('Build complete: ' + OUT + ' (' + output.length + ' bytes)');
  console.log('Script tags: ' + scriptTags + ' open / ' + closeTags + ' close');

  const checks = ['function initI18n', 'function currencyIcon', 'function openSettingsPage', 'function gameGomoku',
    'function gameXiangqi', 'online.connect', 'function openAuthModal', 'function openShop',
    'function applyGameResult', 'if (typeof module'];
  for (const c of checks) {
    if (!output.includes(c)) console.warn('WARN: missing ' + c);
  }
  if (scriptTags !== 1 || closeTags !== 1) console.warn('WARN: script tag mismatch');
}

build();
