'use strict';

// V5 presentation source migration. The historical platform stylesheet is
// split at already documented section seams; no selector or byte is rewritten.
// Running this script is deterministic and intentionally keeps the original
// cascade order by replacing one link with an ordered link list.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS_PATH = path.join(ROOT, 'public', 'styles', 'platform-runtime.css');
const TEMPLATE_PATH = path.join(ROOT, 'public', 'index-template.html');

const PARTS = Object.freeze([
  ['00-platform-foundation.css', 1, 385],
  ['05-game-tabletops.css', 385, 919],
  ['08-responsive-accessibility.css', 919, 1071],
  ['10-outcome-profile.css', 1071, 1484],
  ['12-motion-design.css', 1484, 1601],
  ['14-brand-shell.css', 1601, 1729],
  ['20-game-stage-base.css', 1729, 1801],
  ['22-game-stage-wave.css', 1801, 2081],
  ['24-depth-spatial.css', 2081, 2132],
  ['26-immersive-stage.css', 2132, 2487],
  ['28-game-icon-system.css', 2487, 2651],
]);

function splitLinesPreservingEndings(text) {
  return text.match(/[^\n]*\n|[^\n]+$/g) || [];
}

function linkList(eol) {
  return PARTS.map(([name]) => `<link rel="stylesheet" href="styles/${name}" data-presentation-style>${eol}`).join('');
}

function run() {
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const lines = splitLinesPreservingEndings(css);
  const total = lines.length;
  if (total !== PARTS[PARTS.length - 1][2] - 1) {
    throw new Error(`platform-runtime.css line count drifted: expected ${PARTS[PARTS.length - 1][2] - 1}, found ${total}`);
  }
  for (const [name, start, end] of PARTS) {
    const body = lines.slice(start - 1, end - 1).join('');
    if (!body) throw new Error(`empty presentation part: ${name}`);
    fs.writeFileSync(path.join(ROOT, 'public', 'styles', name), body, 'utf8');
  }

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const match = template.match(/<link rel="stylesheet" href="styles\/platform-runtime\.css" data-presentation-style>\r?\n?/);
  if (!match) throw new Error('platform-runtime.css link not found in template');
  const eol = match[0].includes('\r\n') ? '\r\n' : '\n';
  const migrated = template.replace(match[0], linkList(eol));
  fs.writeFileSync(TEMPLATE_PATH, migrated, 'utf8');

  console.log(JSON.stringify({
    status: 'V5_SPLIT_APPLIED',
    source: 'public/styles/platform-runtime.css',
    lineCount: total,
    modules: PARTS.map(([name, start, end]) => ({ name, start, endExclusive: end, lines: end - start })),
  }));
}

run();
