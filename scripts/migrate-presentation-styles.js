'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'public', 'index-template.html');
const STYLE_RE = /<style(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/style>/g;
const TARGETS = Object.freeze([
  'styles/00-platform-foundation.css',
  'styles/05-game-tabletops.css',
  'styles/08-responsive-accessibility.css',
  'styles/10-outcome-profile.css',
  'styles/12-motion-design.css',
  'styles/14-brand-shell.css',
  'styles/20-game-stage-base.css',
  'styles/22-game-stage-wave.css',
  'styles/24-depth-spatial.css',
  'styles/26-immersive-stage.css',
  'styles/28-game-icon-system.css',
  'styles/community-ai-surfaces.css',
  'styles/identity-broadcast.css',
  'styles/profile-adaptive-hero.css',
  'styles/tank-controls.css',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
}

function linkFor(relative) {
  return `<link rel="stylesheet" href="${relative}" data-presentation-style>`;
}

function readMigratedBodies(template) {
  const links = [...template.matchAll(/<link\b(?=[^>]*\bdata-presentation-style\b)[^>]*\bhref="([^"]+)"[^>]*>/g)];
  if (links.length !== TARGETS.length) {
    throw new Error(`Expected ${TARGETS.length} presentation links, found ${links.length}`);
  }
  links.forEach((match, index) => {
    if (match[1] !== TARGETS[index]) {
      throw new Error(`Presentation link ${index + 1} must be ${TARGETS[index]}, found ${match[1]}`);
    }
  });
  return TARGETS.map(relative => fs.readFileSync(path.join(ROOT, 'public', relative)));
}

function verify(template, expected = null) {
  const inline = [...template.matchAll(STYLE_RE)];
  if (inline.length) throw new Error(`Template still contains ${inline.length} inline style blocks`);
  const bodies = readMigratedBodies(template);
  const joined = Buffer.concat(bodies);
  if (expected && Buffer.compare(joined, expected) !== 0) {
    throw new Error('Migrated stylesheet bytes differ from the original inline style bodies');
  }
  const layoutIndex = template.indexOf('<link rel="stylesheet" href="ghost-layout.css">');
  const finalPresentationIndex = template.lastIndexOf('data-presentation-style');
  if (layoutIndex < 0 || finalPresentationIndex < 0 || finalPresentationIndex > layoutIndex) {
    throw new Error('Presentation modules must remain before ghost-layout.css in cascade order');
  }
  return {
    files: TARGETS.length,
    bytes: joined.length,
    sha256: sha256(joined),
    templateBytes: Buffer.byteLength(template),
  };
}

function apply() {
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const matches = [...template.matchAll(STYLE_RE)];
  if (matches.length === 0) return { changed: false, ...verify(template) };
  if (matches.length !== TARGETS.length) {
    throw new Error(`Expected ${TARGETS.length} inline style blocks, found ${matches.length}`);
  }

  const bodies = matches.map(match => Buffer.from(match.groups.body, 'utf8'));
  const original = Buffer.concat(bodies);
  const before = {
    files: matches.length,
    bytes: original.length,
    sha256: sha256(original),
    templateBytes: Buffer.byteLength(template),
  };

  TARGETS.forEach((relative, index) => {
    const target = path.join(ROOT, 'public', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bodies[index]);
  });

  let index = 0;
  const migrated = template.replace(STYLE_RE, () => linkFor(TARGETS[index++]));
  fs.writeFileSync(TEMPLATE, migrated, 'utf8');
  return { changed: true, before, after: verify(migrated, original) };
}

function run(argv) {
  const mode = argv[0] || '--check';
  if (!['--apply', '--check'].includes(mode) || argv.length > 1) {
    throw new Error('Usage: node scripts/migrate-presentation-styles.js [--apply|--check]');
  }
  const result = mode === '--apply'
    ? apply()
    : { changed: false, ...verify(fs.readFileSync(TEMPLATE, 'utf8')) };
  console.log(JSON.stringify({ mode, ...result }));
}

try {
  run(process.argv.slice(2));
} catch (error) {
  console.error(`PRESENTATION_STYLE_MIGRATION_FAILED ${error.message}`);
  process.exitCode = 1;
}
