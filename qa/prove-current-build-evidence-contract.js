'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD_PATH = path.join(ROOT, 'public', 'index.html');
const EVIDENCE_PATH = path.join(
  ROOT,
  'requirements',
  'active',
  'latest-browser-visible-matrix-prove-p4-20260815',
  'evidence',
  'current-local-browser-matrix-20260817.json'
);
const LEDGER_PATH = path.join(ROOT, 'requirements', 'PRODUCT_REQUIREMENTS_LEDGER.json');
const ROUTING_PATH = path.join(ROOT, 'requirements', 'MAINLINE_CONTROL_ROUTING.json');
const REPORT_GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate-progress-reports.js');
const T1_EVIDENCE_PATH = path.join(
  ROOT,
  'requirements',
  'active',
  'latest-browser-visible-matrix-prove-p4-20260815',
  'evidence',
  'current-build-single-browser-verification-t1-202608161410.json'
);
const T3_EVIDENCE_PATH = path.join(
  ROOT,
  'requirements',
  'active',
  'latest-browser-visible-matrix-prove-p4-20260815',
  'evidence',
  'current-build-single-browser-verification-t3-202608161627.json'
);
const HONRU_CURRENT_EVIDENCE_PATH = path.join(
  ROOT,
  'requirements',
  'active',
  'honru-emoji-runtime-p0-20260811',
  'current-build-single-browser-honru-art-202608162216.json'
);

assert.ok(fs.existsSync(EVIDENCE_PATH), 'browser evidence must exist before its provenance can be described');

const build = fs.readFileSync(BUILD_PATH);
const buildSha = crypto.createHash('sha256').update(build).digest('hex').toUpperCase();
const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
const routing = JSON.parse(fs.readFileSync(ROUTING_PATH, 'utf8'));
const reportGenerator = fs.readFileSync(REPORT_GENERATOR_PATH, 'utf8');
const requirementById = new Map(ledger.requirements.map((item) => [item.id, item]));
const requiredNotGranted = [
  'second_browser',
  'physical_android',
  'physical_iphone',
  'physical_tablet',
  'real_network_shaping',
  'two_formal_friend_dm_browsers',
  'physical_performance_audio_recovery',
  'production_verification'
];
const evidenceModes = {
  current: {
    evidenceClaim: 'current_build_single_browser_partial_p4',
    currency: 'current',
    coverageKind: 'full_current_single_browser_matrix_p4',
    fullRouteMatrixCurrentBuild: true,
    sourceEvidenceScope: 'current_build_full_single_browser_matrix_p4',
    fullMatrixClaim: 'current_build_single_browser_visible_matrix_p4',
    fullMatrixScope: 'single Codex in-app Chromium current build only'
  },
  historical_as_of: {
    evidenceClaim: 'historical_as_of_build_single_browser_partial',
    currency: 'historical_as_of',
    coverageKind: 'full_historical_as_of_single_browser_matrix',
    fullRouteMatrixCurrentBuild: false,
    sourceEvidenceScope: 'historical_as_of_full_single_browser_matrix',
    fullMatrixClaim: 'historical_as_of_build_single_browser_visible_matrix',
    fullMatrixScope: 'single Codex in-app Chromium historical as-of build only'
  }
};
const modeEntry = Object.entries(evidenceModes).find(([, config]) => config.evidenceClaim === evidence.claim);
assert(modeEntry, 'browser evidence claim must be either an exact current build or an explicit historical as-of build');
const [mode, modeConfig] = modeEntry;

assert.strictEqual(evidence.schemaVersion, 1, 'evidence schema must remain explicit');
assert.strictEqual(evidence.currency, modeConfig.currency, 'browser evidence currency must agree with its claim');
assert.strictEqual(evidence.build.path, 'public/index.html', 'evidence must identify the browser build');
assert.strictEqual(evidence.coverage.kind, modeConfig.coverageKind, 'browser evidence coverage kind must agree with its claim');
assert.strictEqual(evidence.coverage.fullRouteMatrixCurrentBuild, modeConfig.fullRouteMatrixCurrentBuild,
  'browser evidence current-build coverage flag must agree with its claim');
assert.strictEqual(evidence.environment.browserSurface, 'Codex in-app Chromium', 'browser identity must stay explicit');
assert.strictEqual(evidence.environment.browserCount, 1, 'a second tab must not be counted as a second browser');

const fullMatrixRefs = evidence.sourceEvidence.filter((item) => item.supportsFullRouteMatrix === true);
assert.strictEqual(fullMatrixRefs.length, 1, 'browser evidence must identify exactly one authoritative full visible-matrix source artifact');
const [fullMatrixRef] = fullMatrixRefs;
assert.strictEqual(fullMatrixRef.scope, modeConfig.sourceEvidenceScope,
  'full visible-matrix source scope must agree with evidence currency');
assert.strictEqual(fullMatrixRef.currency, modeConfig.currency,
  'full visible-matrix source currency must agree with evidence currency');
assert.strictEqual(typeof fullMatrixRef.path, 'string', 'full visible-matrix source must provide a path');
const fullMatrixPath = path.join(ROOT, ...fullMatrixRef.path.split('/'));
assert.ok(fs.existsSync(fullMatrixPath), 'full visible-matrix source artifact must exist');
const fullMatrix = JSON.parse(fs.readFileSync(fullMatrixPath, 'utf8'));

assert.strictEqual(fullMatrix.claim, modeConfig.fullMatrixClaim,
  'full visible-matrix artifact claim must agree with matrix currency');
assert.strictEqual(fullMatrix.schemaVersion, 1, 'full visible-matrix artifact schema must remain explicit');
assert.strictEqual(fullMatrix.currency, modeConfig.currency,
  'full visible-matrix artifact currency must agree with matrix currency');
assert.strictEqual(fullMatrix.scope, modeConfig.fullMatrixScope,
  'full visible-matrix artifact scope must remain explicit');
assert.strictEqual(fullMatrix.fullRouteMatrixCurrentBuild, modeConfig.fullRouteMatrixCurrentBuild,
  'full visible-matrix artifact current-build coverage flag must agree with matrix currency');
for (const field of ['path', 'sha256', 'characters', 'bytes']) {
  assert.strictEqual(fullMatrix.build[field], evidence.build[field],
    `matrix and full visible-matrix source must agree on build.${field}`);
}
if (mode === 'current') {
  assert.strictEqual(evidence.build.sha256, buildSha,
    'evidence marked current must match the current built HTML SHA-256');
  assert.strictEqual(evidence.build.bytes, build.length,
    'evidence marked current must match the current built HTML byte length');
} else {
  assert.notStrictEqual(evidence.build.sha256, buildSha,
    'historical as-of evidence must not be represented as the current built HTML');
}
for (const surface of ['home', 'games', 'playline', 'profile', 'shop', 'direct_messages', 'achievements', 'room_lobby', 'six_game_stages', 'forced_colors']) {
  assert(evidence.coverage.surfaces.includes(surface), `full visible matrix is missing surface: ${surface}`);
}
assert.strictEqual(fullMatrix.environment.browserSurface, 'Codex in-app Chromium',
  'full visible-matrix source must keep the browser identity explicit');
assert.strictEqual(fullMatrix.environment.browserCount, 1,
  'full visible-matrix source must not inflate one Chromium into a second browser');
assert.strictEqual(fullMatrix.routeMatrix.length, 5, 'full visible-matrix source must contain the five CSS viewports');
assert.strictEqual(fullMatrix.gameStages.length, 6, 'full visible-matrix source must contain all six Game Stages');
assert.deepStrictEqual(
  [...new Set(fullMatrix.routeMatrix.map((item) => `${item.width}x${item.height}`))].sort(),
  ['1024x768', '1440x900', '390x844', '768x1024', '844x390'],
  'full visible-matrix source must contain each required viewport exactly once'
);
for (const viewport of fullMatrix.routeMatrix) {
  assert.deepStrictEqual([...viewport.routes].sort(), ['games', 'home', 'playline', 'profile'],
    `viewport ${viewport.name} must contain all four routes exactly once`);
  assert.strictEqual(viewport.horizontalOverflowMax, 0, `viewport ${viewport.name} must not overflow horizontally`);
  assert.strictEqual(viewport.rawKeyCountMax, 0, `viewport ${viewport.name} must not expose raw i18n keys`);
  assert.strictEqual(viewport.scrollYMax, 0, `viewport ${viewport.name} route transitions must settle at scrollY=0`);
}
assert.deepStrictEqual(
  [...new Set(fullMatrix.gameStages.map((item) => item.game))].sort(),
  ['五子棋', '俄罗斯方块', '坦克大战', '象棋', '迷你大富翁', '飞行棋'].sort(),
  'full visible-matrix source must contain each supported game exactly once'
);
for (const game of fullMatrix.gameStages) {
  assert(game.stage && game.arena && game.command && game.back, `${game.game} must expose Stage, Arena, Command and Back`);
  assert.strictEqual(game.horizontalOverflow, 0, `${game.game} must not overflow horizontally`);
  assert.strictEqual(game.scrollY, 0, `${game.game} must lock document scroll at zero`);
  assert.strictEqual(game.rawKeyCount, 0, `${game.game} must not expose raw i18n keys`);
}
assert.strictEqual(fullMatrix.deepScroll.crossRouteScrollY, 0, 'deep-scroll cross-route reset must settle at the top');
assert.strictEqual(fullMatrix.deepScroll.sameRouteScrollY, 0, 'same-route reselection must settle at the top');
assert.strictEqual(fullMatrix.monopolyResponsive.length, 2, 'Monopoly evidence must cover portrait and landscape phone layouts');
for (const monopoly of fullMatrix.monopolyResponsive) {
  assert.strictEqual(monopoly.cells, 24, `${monopoly.viewport} Monopoly must retain all 24 cells`);
  assert.strictEqual(monopoly.visualLabels, 'hidden', `${monopoly.viewport} Monopoly labels must be visually condensed`);
  assert.strictEqual(monopoly.centerHud, 'hidden', `${monopoly.viewport} Monopoly center HUD must be hidden at small density`);
  assert.strictEqual(monopoly.diceCount, 1, `${monopoly.viewport} Monopoly must expose one dice control`);
  assert(monopoly.propertyAria && monopoly.propertyTitle, `${monopoly.viewport} Monopoly must preserve accessible property facts`);
}
assert.deepStrictEqual(fullMatrix.languageTheme.pluralRegressionCounts, [1, 2, 5, 11, 21, 22, 25], 'plural evidence must include all boundary counts');
assert(fullMatrix.languageTheme.languages.some(item => item.lang === 'en-US' &&
  (item.visibleRecords.includes('1 game · 1 win · 100%') || item.visibleRecords.includes('0 games · 0 wins · —'))),
  'English plural evidence must be visible for the current QA account or a deterministic fixture');
assert(fullMatrix.languageTheme.languages.some(item => item.lang === 'uk-UA' &&
  (item.visibleRecords.includes('2 гри · 0 перемог · 0%') || item.visibleRecords.includes('0 ігор · 0 перемог · —'))),
  'Ukrainian plural evidence must be visible for the current QA account or a deterministic fixture');
assert.strictEqual(fullMatrix.reducedMotion.homeAmbientAnimation, 'none', 'reduced-motion must stop ambient animation');
assert.strictEqual(fullMatrix.forcedColors.brandVisibility, 'visible', 'forced-colors must keep brand visible');
assert.strictEqual(fullMatrix.console.warnErrorAfterCapture, 0, 'visible matrix must have zero console warnings/errors');
assert.strictEqual(fullMatrix.cleanup.dialogCount, 0, 'browser cleanup must remove dialogs');
assert.strictEqual(fullMatrix.cleanup.gameActive, false, 'browser cleanup must leave no active Game Stage');
assert.strictEqual(fullMatrix.cleanup.theme, 'light', 'browser cleanup must restore light theme');
assert.strictEqual(fullMatrix.cleanup.lang, 'zh-CN', 'browser cleanup must restore Chinese locale');
for (const boundary of requiredNotGranted) {
  assert(fullMatrix.notGranted.includes(boundary), `full visible-matrix source is missing boundary: ${boundary}`);
}
assert(!evidence.sourceEvidence.some((item) => item.scope === 'pwa_offline_i18n' && item.supportsFullRouteMatrix),
  'PWA offline locale evidence must never stand in for Games or Game Stage visible coverage');

for (const boundary of requiredNotGranted) {
  assert(evidence.notGranted.includes(boundary), `missing fail-closed boundary: ${boundary}`);
}

assert.strictEqual(requirementById.get('TECH-027').status, 'partial', 'TECH-027 must remain partial');
for (const id of ['TECH-028', 'TECH-029', 'TECH-030', 'UI-031', 'GAME-040', 'SOC-029']) {
  assert.strictEqual(requirementById.get(id).status, 'blocked', `${id} evidence status must remain honest until the real external environment is exercised`);
}
assert.strictEqual(routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'].status, 'NON_BLOCKING_FOR_DEVELOPMENT',
  'single-browser evidence must allow development without releasing the shared Gate');
assert.strictEqual(routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'].developmentStatus, 'OPEN',
  'missing second-browser/device/network evidence must not block continued development');
assert.strictEqual(routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'].releaseStatus, 'RELEASE_EVIDENCE_PENDING',
  'single-browser evidence must not release the shared Gate');
assert(reportGenerator.includes('currentBrowserEvidenceSummary'),
  'progress reports must derive current/historical browser wording from the build hash');
assert(fs.existsSync(T1_EVIDENCE_PATH), 'the legacy T1-named artifact must remain present with an explicit provenance correction');
const t1Evidence = JSON.parse(fs.readFileSync(T1_EVIDENCE_PATH, 'utf8'));
assert.strictEqual(t1Evidence.claim, 'historical_as_of_mislabeled_t1_artifact',
  'the overwritten T1-named artifact must never be represented as current evidence');
assert.strictEqual(t1Evidence.currency, 'historical_as_of',
  'the overwritten T1-named artifact must be classified as historical');
assert.strictEqual(typeof t1Evidence.provenanceCorrection, 'string',
  'the overwritten T1-named artifact must explain its corrected provenance');
assert.notStrictEqual(t1Evidence.build.sha256, buildSha,
  'the overwritten T1-named artifact must not track the current build hash');
assert.strictEqual(t1Evidence.environment.browserCount, 1, 'T1 evidence must not inflate one Chromium into a second browser');
assert(t1Evidence.notGranted.includes('second real browser') && t1Evidence.notGranted.includes('physical Android/iPhone/Tablet'),
  'T1 evidence must preserve external-device boundaries');
assert(fs.existsSync(T3_EVIDENCE_PATH), 'T3 narrow evidence must remain a separate immutable-build artifact');
const t3Evidence = JSON.parse(fs.readFileSync(T3_EVIDENCE_PATH, 'utf8'));
assert.strictEqual(t3Evidence.claim, 'historical_as_of_build_single_browser_narrow_t3',
  'T3 evidence must remain explicitly narrow and historical after T4');
assert.strictEqual(t3Evidence.currency, 'historical_as_of', 'T3 narrow evidence must identify its historical currency');
assert.strictEqual(t3Evidence.build.sha256, '014E2886711070F7B14CCCDF78E981C14871536BAE32A1A6369E823A56507067',
  'T3 narrow evidence must preserve its recorded build SHA-256');
assert.strictEqual(t3Evidence.build.bytes, 1720249, 'T3 narrow evidence must preserve its recorded build bytes');
assert.notStrictEqual(t3Evidence.build.sha256, buildSha, 'T3 evidence must not track the current T4 build');
assert.strictEqual(t3Evidence.environment.browserCount, 1, 'T3 narrow evidence must not inflate one Chromium into a second browser');
assert.deepStrictEqual(t3Evidence.coverage.routes.map(item => item.route).sort(), ['games', 'home', 'playline', 'profile'],
  'T3 narrow evidence must cover all four routes at its recorded viewport');
assert(t3Evidence.coverage.routes.every(item => item.visible && item.horizontalOverflow === 0 && item.rawKeyCount === 0),
  'T3 narrow route evidence must remain visible and free of overflow/raw keys');
assert.deepStrictEqual(t3Evidence.coverage.gameStages.map(item => item.game).sort(), ['tank', 'tetris'],
  'T3 narrow evidence must cover both changed game callers');
assert(t3Evidence.notGranted.includes('full_current_five_viewport_matrix') && t3Evidence.notGranted.includes('second_browser'),
  'T3 narrow evidence must preserve full-matrix and second-browser boundaries');
assert(fs.existsSync(HONRU_CURRENT_EVIDENCE_PATH), 'Honru art narrow evidence must remain traceable');
const honruEvidence = JSON.parse(fs.readFileSync(HONRU_CURRENT_EVIDENCE_PATH, 'utf8'));
assert(['current_build_single_browser_honru_art_runtime_partial', 'historical_as_of_build_single_browser_honru_art_runtime_partial'].includes(honruEvidence.claim),
  'Honru art evidence must be either an exact current build or explicitly historical as-of');
if (honruEvidence.currency === 'current') {
  assert.strictEqual(honruEvidence.build.sha256, buildSha, 'current Honru art evidence must match the current built HTML SHA-256');
  assert.strictEqual(honruEvidence.build.bytes, build.length, 'current Honru art evidence must match the current built HTML byte length');
} else {
  assert.strictEqual(honruEvidence.currency, 'historical_as_of', 'stale Honru evidence must identify historical currency');
  assert.notStrictEqual(honruEvidence.build.sha256, buildSha, 'historical Honru evidence must not track the current build');
  assert.strictEqual(typeof honruEvidence.provenanceCorrection, 'string', 'historical Honru evidence must explain its provenance correction');
}
assert.strictEqual(honruEvidence.environment.browserCount, 1, 'two storage-isolated sessions must not be counted as a second browser');
assert.strictEqual(honruEvidence.environment.sessionCount, 2, 'Honru throw evidence must retain both storage-isolated local sessions');
assert.strictEqual(honruEvidence.visibleChecks.emojiPicker.readyCount, 10, 'all ten Honru Emoji atlas cells must be visibly ready');
assert.strictEqual(honruEvidence.visibleChecks.directedThrow.senderBubbleCount, 1, 'directed throw must remain visible to the sender');
assert.strictEqual(honruEvidence.visibleChecks.directedThrow.receiverBubbleCount, 1, 'directed throw must remain visible to the receiver');
assert.strictEqual(honruEvidence.visibleChecks.reducedMotion.flightCount, 0, 'reduced motion must suppress the throw flight');
assert.strictEqual(honruEvidence.visibleChecks.responsive.horizontalOverflow, 0, '390x844 Honru art slice must not overflow horizontally');
for (const boundary of ['second_real_browser', 'physical_android', 'physical_iphone', 'physical_tablet', 'real_network_shaping', 'production_release']) {
  assert(honruEvidence.notGranted.includes(boundary), `Honru art evidence is missing fail-closed boundary: ${boundary}`);
}
assert(reportGenerator.includes('current-build-single-browser-honru-art-202608162216.json'),
  'progress reports must retain the Honru art evidence path without promoting historical evidence to current');
assert(!reportGenerator.includes('已补最新 localhost 多档 viewport'),
  'progress reports must not hard-code stale evidence as the latest localhost matrix');

console.log(`PROVE_CURRENT_BUILD_EVIDENCE_ALL_PASS mode=${mode} sha=${evidence.build.sha256} bytes=${evidence.build.bytes} currentSha=${buildSha} currentBytes=${build.length}`);
