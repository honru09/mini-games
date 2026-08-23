'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'public/src/core/02-app-shell.js'), 'utf8');
const { readPresentationSource } = require('./presentation-source');
const css = readPresentationSource();
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'art-source/production/ghost-game-art-program-v1/production-ledger-v1.json'), 'utf8'));
const locales = ['zh-CN', 'en-US', 'uk-UA'].map(lang => JSON.parse(fs.readFileSync(path.join(ROOT, 'public/locales', `${lang}.json`), 'utf8')));
const familyRoot = path.join(ROOT, 'art-source/platform/profile-adaptive-hero-v1');
const family = JSON.parse(fs.readFileSync(path.join(familyRoot, 'asset-family-manifest-v1.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/manifests/asset_manifest.json'), 'utf8'));

assert(shell.includes('function profileAdaptiveHeroModel'), 'adaptive model exists');
assert(shell.includes('score:p*2+w*3'), 'model uses deterministic played/wins weighting');
assert(shell.includes('dataset.adaptiveGame'), 'hero exposes stable adaptive game state');
assert(shell.includes('profile_adaptive_hero_record'), 'hero exposes localized record summary');
assert(shell.includes('resolveProfileAdaptiveHeroUrl'), 'hero loads allowlisted visual family');
assert(css.includes('.profile-adaptive-hero-game') && css.includes('.profile-adaptive-hero[data-adaptive-game="tetris"]'), 'hero has game-specific presentation tokens');
assert(css.includes('@media(prefers-reduced-motion:reduce)') && css.includes('@media(forced-colors:active)'), 'hero keeps motion/accessibility fallbacks');
for (const dict of locales) for (const key of ['profile_adaptive_hero_kicker','profile_adaptive_hero_game','profile_adaptive_hero_record','profile_adaptive_hero_empty']) assert(dict[key], `missing ${key}`);
const unit = Array.isArray(ledger.units) ? ledger.units.find(item => item.id === 'P2-12') : null;
assert(unit && unit.status === 'implemented_owner_cleared_release_evidence_pending', 'P2-12 ledger status is closed locally');
assert.strictEqual(family.familyId, 'P-PROFILE-ADAPTIVE-HERO-V1');
assert.strictEqual(family.runtimeFiles.length, 4);
assert(family.runtimeBytes > 0 && family.runtimeBytes <= family.runtimeByteBudget);
assert.strictEqual(family.externalReferenceInputs, 0);
assert.strictEqual(family.thirdPartyTransmissions, 0);
for (const item of family.runtimeFiles) assert(fs.existsSync(path.join(ROOT, item.path)), `missing runtime ${item.path}`);
const entry = manifest.assets.find(item => item.asset_id === 'P-PROFILE-ADAPTIVE-HERO-V1');
assert(entry && entry.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' && entry.feature_flags.default_enabled === true);
assert.deepStrictEqual(Object.keys(entry.variants).sort(), ['desktop','mobile','poster','static']);
assert(!shell.includes('adaptiveHeroPurchase') && !shell.includes('adaptiveHeroOwned'), 'presentation must not add economy facts');
console.log('PROFILE_ADAPTIVE_HERO_V1_ALL_PASS');
