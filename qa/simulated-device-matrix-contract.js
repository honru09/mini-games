'use strict';

/*
 * Contract for the 2026-08-19 local simulated-device evidence batch.
 *
 * This is deliberately a fail-closed provenance contract, not a substitute
 * for a second browser, a physical phone/tablet, an OS network shaper, a
 * physical low-end GPU, or temperature instrumentation.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_ROOT = path.join(
  ROOT,
  'requirements',
  'active',
  'latest-browser-visible-matrix-prove-p4-20260815',
  'evidence'
);
const EVIDENCE_PATH = path.join(EVIDENCE_ROOT, 'simulated-device-network-performance-20260819.json');
const SCREENSHOT_ROOT = path.join(EVIDENCE_ROOT, 'simulated-device-network-performance-20260819');
const BUILD_PATH = path.join(ROOT, 'public', 'index.html');
const ROUTING_PATH = path.join(ROOT, 'requirements', 'MAINLINE_CONTROL_ROUTING.json');
const LEDGER_PATH = path.join(ROOT, 'requirements', 'PRODUCT_REQUIREMENTS_LEDGER.json');
const NETWORK_HELPER_PATH = path.join(ROOT, 'qa', 'helpers', 'deterministic-transport.js');
const NETWORK_MATRIX_PATH = path.join(ROOT, 'qa', 'network-simulation-matrix.js');

const CLAIM = 'local_single_chromium_simulated_device_network_performance_matrix';
const SCOPE = 'LOCAL_SINGLE_CHROMIUM_SIMULATION_ONLY';
const DEVICE_CLASS = 'LOCAL_SINGLE_CHROMIUM_DEVICE_EMULATION_ONLY';
const SECOND_CONTEXT_CLASS = 'SIMULATED_SECOND_BROWSER_ISOLATED_CONTEXT';
const PERFORMANCE_CLASS = 'LOCAL_LOW_END_CAPABILITY_AND_CPU_THROTTLE_PROXY_ONLY';
const NETWORK_CLASS = 'LOCAL_DETERMINISTIC_NETWORK_SIMULATION_ONLY';
const SCREENSHOT_FILES = Object.freeze([
  'android-360x800-fullpage-tank-3d.png',
  'desktop-1440x900-gomoku-3d.png',
  'iphone-390x844-fullpage-xiangqi-3d.png',
  'tablet-768x1024-fullpage-monopoly-3d.png',
]);
const SCREENSHOT_PROFILES = Object.freeze({
  'android-360x800-fullpage-tank-3d.png': Object.freeze({ width: 360, minHeight: 800, profileDpr: 3 }),
  'desktop-1440x900-gomoku-3d.png': Object.freeze({ width: 1440, minHeight: 900, profileDpr: 1 }),
  'iphone-390x844-fullpage-xiangqi-3d.png': Object.freeze({ width: 390, minHeight: 844, profileDpr: 3 }),
  'tablet-768x1024-fullpage-monopoly-3d.png': Object.freeze({ width: 768, minHeight: 1024, profileDpr: 2 }),
});
const EXTERNAL_NOT_GRANTED = Object.freeze([
  'second_real_browser',
  'physical_android',
  'physical_iphone',
  'physical_tablet',
  'real_network_shaping',
  'physical_low_end_gpu',
  'physical_temperature',
  'cross_device_visual_verified',
  'production_verification',
  'release',
]);

function readJson(file) {
  assert(fs.existsSync(file), `${path.relative(ROOT, file)} must exist`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function sorted(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}

function assertExactSet(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array`);
  assert.deepStrictEqual(sorted(actual), sorted(expected), `${label} must contain the exact required set`);
  assert.strictEqual(new Set(actual).size, actual.length, `${label} must not contain duplicates`);
}

function pngDimensions(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert(buffer.length >= 24, 'screenshot must contain a complete PNG header');
  assert(buffer.subarray(0, 8).equals(signature), 'screenshot extension and encoded PNG format must agree');
  assert.strictEqual(buffer.toString('ascii', 12, 16), 'IHDR', 'PNG must begin with an IHDR chunk');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const evidence = readJson(EVIDENCE_PATH);
const routing = readJson(ROUTING_PATH);
const ledger = readJson(LEDGER_PATH);
const requirementById = new Map(ledger.requirements.map(item => [item.id, item]));

assert.strictEqual(evidence.schemaVersion, 1, 'simulated evidence schema must remain explicit');
assert.strictEqual(evidence.claim, CLAIM, 'claim must identify the local single-Chromium simulated matrix');
assert.strictEqual(evidence.scope, SCOPE, 'scope must remain simulation-only');
assert(['current', 'historical_as_of'].includes(evidence.currency), 'currency must be current or historical_as_of');
assert(!Number.isNaN(Date.parse(evidence.capturedAt)), 'capturedAt must be an ISO-compatible timestamp');
assert.strictEqual(evidence.releaseClaim, 'NOT_GRANTED', 'local simulation must never grant release');

assert.strictEqual(evidence.build.path, 'public/index.html', 'evidence must identify the exercised build artifact');
assert(/^[A-F0-9]{64}$/.test(evidence.build.sha256), 'build SHA-256 must be uppercase and complete');
assert(Number.isSafeInteger(evidence.build.characters) && evidence.build.characters > 0, 'build character count must be positive');
assert(Number.isSafeInteger(evidence.build.bytes) && evidence.build.bytes > 0, 'build byte count must be positive');
if (evidence.currency === 'current') {
  const build = fs.readFileSync(BUILD_PATH);
  assert.strictEqual(evidence.build.sha256, sha256(build), 'current evidence must match the current built HTML SHA-256');
  assert.strictEqual(evidence.build.characters, build.toString('utf8').length, 'current evidence must match the build character count');
  assert.strictEqual(evidence.build.bytes, build.length, 'current evidence must match the build byte count');
}

assert.strictEqual(evidence.environment.browserSurface, 'Codex in-app Chromium', 'browser surface must stay explicit');
assert.strictEqual(evidence.environment.browserCount, 1, 'one Chromium must not be inflated into a second browser');
assert.strictEqual(evidence.environment.browserEngineCount, 1, 'one Chromium engine must remain one browser engine');
assert.strictEqual(evidence.environment.browserEngine, 'Chromium', 'the tested engine must remain explicit');
assert.strictEqual(evidence.environment.physicalDeviceCount, 0, 'viewport emulation must not claim a connected physical device');

const secondContext = evidence.secondDesktopContext;
assert.strictEqual(secondContext.evidenceClass, SECOND_CONTEXT_CLASS, 'second desktop context must be labeled as a simulation');
assert.strictEqual(secondContext.status, 'PASS_LOCAL_STORAGE_ISOLATION_ONLY', 'second context may only pass its local isolation check');
assert.strictEqual(secondContext.realSecondBrowser, 'NOT_EXECUTED', 'a second origin/tab is not a real second browser');
assert.strictEqual(secondContext.browserSurface, 'Codex in-app Chromium', 'second context must remain in the same Chromium surface');
assert.strictEqual(secondContext.browserEngineCount, 1, 'isolated origins must not inflate the browser-engine count');
assertExactSet(secondContext.origins, ['http://127.0.0.1:8080', 'http://localhost:8080'], 'isolated-context origins');

const expectedProfiles = new Map([
  ['desktop-1440x900', { width: 1440, height: 900, dpr: 1, touch: 0, nav: 'desktop' }],
  ['second-desktop-1366x768', { width: 1366, height: 768, dpr: 1, touch: 0, nav: 'desktop' }],
  ['android-360x800', { width: 360, height: 800, dpr: 3, touch: 5, nav: 'mobile' }],
  ['iphone-390x844', { width: 390, height: 844, dpr: 3, touch: 5, nav: 'mobile' }],
  ['iphone-landscape-844x390', { width: 844, height: 390, dpr: 3, touch: 5, nav: 'desktop' }],
  ['tablet-768x1024', { width: 768, height: 1024, dpr: 2, touch: 5, nav: 'desktop' }],
  ['tablet-landscape-1024x768', { width: 1024, height: 768, dpr: 2, touch: 5, nav: 'desktop' }],
]);
const deviceMatrix = evidence.deviceMatrix;
assert.strictEqual(deviceMatrix.evidenceClass, DEVICE_CLASS, 'device matrix must remain Chromium emulation only');
assert.strictEqual(deviceMatrix.totalRouteCases, 28, 'seven profiles by four routes must produce 28 route cases');
assert.strictEqual(deviceMatrix.passedRouteCases, 28, 'all recorded local route cases must pass');
assert.strictEqual(deviceMatrix.profiles.length, expectedProfiles.size, 'device matrix must contain seven unique profiles');
assert.strictEqual(new Set(deviceMatrix.profiles.map(item => item.id)).size, expectedProfiles.size, 'device profiles must be unique');
for (const profile of deviceMatrix.profiles) {
  const expected = expectedProfiles.get(profile.id);
  assert(expected, `unexpected simulated profile: ${profile.id}`);
  assert.strictEqual(profile.width, expected.width, `${profile.id} width must match the declared viewport`);
  assert.strictEqual(profile.height, expected.height, `${profile.id} height must match the declared viewport`);
  assert.strictEqual(profile.emulatedDevicePixelRatio, expected.dpr, `${profile.id} DPR must remain explicitly emulated`);
  assert.strictEqual(profile.emulatedTouchPoints, expected.touch, `${profile.id} touch capability must remain explicitly emulated`);
  assert.strictEqual(profile.navigation, expected.nav, `${profile.id} navigation breakpoint must match the recorded viewport`);
  assert.strictEqual(profile.physicalDevice, false, `${profile.id} must not claim physical-device coverage`);
  assertExactSet(profile.routes, ['home', 'games', 'playline', 'profile'], `${profile.id} routes`);
  assert.strictEqual(profile.horizontalOverflowMax, 0, `${profile.id} must have zero horizontal overflow`);
  assert.strictEqual(profile.rawKeyCountMax, 0, `${profile.id} must expose no raw i18n keys`);
  assert.strictEqual(profile.scrollYMax, 0, `${profile.id} route transitions must settle at scrollY=0`);
}

const gameStages = evidence.gameStageMatrix;
assert.strictEqual(gameStages.evidenceClass, DEVICE_CLASS, 'Game Stage matrix must use the same simulation-only device class');
assert.strictEqual(gameStages.totalCases, 12, 'six games by desktop and iPhone must produce 12 stage cases');
assert.strictEqual(gameStages.passedCases, 12, 'all recorded local Game Stage cases must pass');
assert.strictEqual(gameStages.cases.length, 12, 'Game Stage evidence must provide each case');
const stagePairs = new Set();
for (const item of gameStages.cases) {
  assert(['desktop-1440x900', 'iphone-390x844'].includes(item.profile), `unexpected Game Stage profile: ${item.profile}`);
  assert(['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'].includes(item.game), `unexpected Game Stage game: ${item.game}`);
  const pair = `${item.profile}:${item.game}`;
  assert(!stagePairs.has(pair), `duplicate Game Stage case: ${pair}`);
  stagePairs.add(pair);
  for (const seam of ['stage', 'arena', 'command', 'back', 'ghost3dReady']) {
    assert.strictEqual(item[seam], true, `${pair} must keep ${seam} visible/ready`);
  }
  assert.strictEqual(item.horizontalOverflow, 0, `${pair} must have zero horizontal overflow`);
  assert.strictEqual(item.rawKeyCount, 0, `${pair} must expose no raw i18n keys`);
  if (item.profile === 'iphone-390x844') {
    assert(item.actualRendererDpr >= 1 && item.actualRendererDpr <= 1.25,
      `${pair} mobile renderer DPR must stay within the bounded low-power policy`);
  }
}
assert.strictEqual(stagePairs.size, 12, 'Game Stage matrix must contain 12 unique profile/game pairs');

const performance = evidence.lowEndPerformanceProxy;
assert.strictEqual(performance.evidenceClass, PERFORMANCE_CLASS, 'performance evidence must remain a local proxy');
assert.strictEqual(performance.status, 'PASS_LOCAL_PROXY_ONLY', 'only the local proxy may pass');
assert.strictEqual(performance.profile, 'android-360x800', 'low-end proxy must identify its simulated viewport');
assert.strictEqual(performance.cpuThrottleRate, 4, 'low-end proxy must record 4x CPU throttling');
assert.strictEqual(performance.hardwareConcurrency, 4, 'low-end proxy must record the emulated core count');
assert.strictEqual(performance.deviceMemoryGb, 4, 'low-end proxy must record the emulated memory capability');
assert.strictEqual(performance.rendererQuality, 'LOW', 'low-end proxy must run the LOW renderer policy');
assert.strictEqual(performance.actualRendererDpr, 1, 'LOW renderer policy must use DPR 1');
assert.strictEqual(performance.antialias, false, 'LOW renderer policy must disable antialiasing');
assert.strictEqual(performance.shadows, false, 'LOW renderer policy must disable shadows');
assert.strictEqual(performance.powerPreference, 'low-power', 'LOW renderer policy must request low-power GPU behavior');
assert.strictEqual(performance.physicalLowEndGpu.status, 'NOT_EXECUTED', 'a capability proxy is not a physical low-end GPU test');
assert.strictEqual(performance.actualGpu.classification, 'HOST_GPU_NOT_LOW_END_EVIDENCE', 'host GPU identity must not be presented as low-end evidence');
assert(typeof performance.actualGpu.renderer === 'string' && performance.actualGpu.renderer.length > 0, 'host GPU renderer must be recorded');
assert(Number.isFinite(performance.durationMs) && performance.durationMs >= 8000, 'sustained-load proxy must run for at least eight seconds');
assert.strictEqual(performance.games.length, 6, 'performance proxy must include all six games');
assert.strictEqual(new Set(performance.games.map(item => item.game)).size, 6, 'performance games must be unique');
for (const item of performance.games) {
  assert(['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'].includes(item.game), `unexpected performance game: ${item.game}`);
  assert(Number.isFinite(item.p95FrameTimeMs) && item.p95FrameTimeMs > 0, `${item.game} P95 frame time must be measured`);
  assert(item.p95FrameTimeMs <= performance.proxyFrameBudgetMs, `${item.game} P95 must remain inside the declared proxy budget`);
}
assert(Number.isSafeInteger(performance.heap.before) && performance.heap.before > 0, 'heap before value must be positive');
assert(Number.isSafeInteger(performance.heap.peak) && performance.heap.peak >= performance.heap.before, 'heap peak must be at or above the starting heap');
assert(Number.isSafeInteger(performance.heap.afterGc) && performance.heap.afterGc <= performance.heap.peak, 'post-GC heap must not exceed peak heap');
assert.strictEqual(performance.heap.reclaimedBytes, performance.heap.peak - performance.heap.afterGc, 'heap reclaimed value must be derived exactly');
assert(performance.heap.reclaimedBytes > 0, 'sustained-load proxy must demonstrate reclaimed heap');
assert.strictEqual(performance.thermal.status, 'NOT_EXECUTED', 'temperature instrumentation was not executed');
assert.strictEqual(performance.thermal.temperatureC, null, 'temperature must remain null without a physical sensor reading');
assert.strictEqual(performance.thermal.claim, 'SUSTAINED_LOAD_AND_THROTTLING_RISK_PROXY_ONLY', 'thermal wording must remain proxy-only');

const network = evidence.networkSimulation;
assert.strictEqual(network.evidenceClass, NETWORK_CLASS, 'network evidence must remain deterministic local simulation only');
assert.strictEqual(network.status, 'PASS_LOCAL_SIMULATION_ONLY', 'only the deterministic local network simulation may pass');
assertExactSet(network.oneWayLatencyProfilesMs, [50, 100, 200], 'network latency profiles');
assertExactSet(network.scenarios, ['ordered', 'jitter', 'reorder', 'duplicate-late', 'reconnect'], 'network scenarios');
assertExactSet(network.games, ['tetris', 'tank'], 'network games');
assert.strictEqual(network.totalCases, 30, 'three profiles by five scenarios by two games must produce 30 cases');
assert.strictEqual(network.passedCases, 30, 'all deterministic local cases must pass');
assert.strictEqual(network.nativeTimerUsed, false, 'network simulation must use a virtual clock');
assert.strictEqual(network.osNetworkShaperUsed, false, 'network simulation must not imply OS-level shaping');
assert.strictEqual(network.realNetworkShaping.status, 'NOT_EXECUTED', 'real network shaping must remain not executed');
assert.strictEqual(network.source, 'qa/network-simulation-matrix.js', 'network evidence must identify its executable source');
assert.strictEqual(network.helper, 'qa/helpers/deterministic-transport.js', 'network evidence must identify its deterministic transport');
const helperSource = fs.readFileSync(NETWORK_HELPER_PATH, 'utf8');
const matrixSource = fs.readFileSync(NETWORK_MATRIX_PATH, 'utf8');
assert(helperSource.includes(`const EVIDENCE_CLASS = '${NETWORK_CLASS}'`), 'transport helper must carry the simulation-only evidence class');
assert(matrixSource.includes("const LATENCIES = Object.freeze([50, 100, 200])"), 'network matrix source must retain all three latency profiles');
assert(matrixSource.includes('no OS shaper, physical device, second browser, or production claim'), 'network matrix output must preserve its non-claim boundary');

assert.strictEqual(evidence.screenshots.evidenceClass, DEVICE_CLASS, 'screenshots must remain local emulation evidence');
assert.strictEqual(evidence.screenshots.encodedFormat, 'image/png', 'screenshot evidence must declare the true PNG encoding');
assert.strictEqual(evidence.screenshots.captureDevicePixelRatio, 1, 'formal screenshots must avoid the known DPR3 compositor artifact');
assert.strictEqual(evidence.screenshots.items.length, SCREENSHOT_FILES.length, 'formal evidence must reference exactly four screenshots');
const screenshotNames = evidence.screenshots.items.map(item => path.basename(item.path));
assertExactSet(screenshotNames, SCREENSHOT_FILES, 'formal screenshot whitelist');
for (const item of evidence.screenshots.items) {
  const filename = path.basename(item.path);
  const expected = SCREENSHOT_PROFILES[filename];
  assert(expected, `${item.path} must be in the formal screenshot whitelist`);
  assert.strictEqual(item.encodedFormat, 'image/png', `${item.path} must declare PNG encoding`);
  assert.strictEqual(item.captureDevicePixelRatio, 1, `${item.path} must use the compositor-safe capture DPR`);
  assert.strictEqual(item.profileDevicePixelRatio, expected.profileDpr, `${item.path} must retain the tested profile DPR as separate evidence`);
  assert(/^[A-F0-9]{64}$/.test(item.sha256), `${item.path} must provide a complete uppercase SHA-256`);
  const absolute = path.join(ROOT, ...item.path.split('/'));
  assert(path.resolve(absolute).startsWith(path.resolve(SCREENSHOT_ROOT) + path.sep), `${item.path} must stay inside the evidence directory`);
  const bytes = fs.readFileSync(absolute);
  const dimensions = pngDimensions(bytes);
  assert.strictEqual(item.sha256, sha256(bytes), `${item.path} SHA-256 must match the screenshot`);
  assert.strictEqual(item.width, dimensions.width, `${item.path} width must match the PNG header`);
  assert.strictEqual(item.height, dimensions.height, `${item.path} height must match the PNG header`);
  assert.strictEqual(dimensions.width, expected.width, `${item.path} must preserve its CSS viewport width at capture DPR 1`);
  assert(dimensions.height >= expected.minHeight, `${item.path} full-page height must cover at least the tested viewport`);
}
for (const forbidden of ['iphone-390x844-dpr3-xiangqi-3d.png', 'iphone-390x844-css-viewport-xiangqi-3d.png', 'iphone-390x844-xiangqi-3d.png']) {
  assert(!screenshotNames.includes(forbidden), `${forbidden} must not enter the formal screenshot whitelist`);
}

assert(Array.isArray(evidence.notGranted), 'simulation non-claims must be an array');
assert.strictEqual(new Set(evidence.notGranted).size, evidence.notGranted.length, 'simulation non-claims must not contain duplicates');
for (const boundary of EXTERNAL_NOT_GRANTED) {
  assert(evidence.notGranted.includes(boundary), `simulation evidence must not grant: ${boundary}`);
}
const gate = routing.sharedGates['GATE-DEVICE-BROWSER-NETWORK'];
assert.strictEqual(evidence.gate.id, 'GATE-DEVICE-BROWSER-NETWORK', 'evidence must identify the shared external Gate');
assert.strictEqual(evidence.gate.developmentStatus, 'OPEN', 'local evidence may keep development open');
assert.strictEqual(evidence.gate.releaseStatus, 'RELEASE_EVIDENCE_PENDING', 'local evidence must not release the device Gate');
assert.strictEqual(gate.status, 'NON_BLOCKING_FOR_DEVELOPMENT', 'shared Gate must remain non-blocking for development');
assert.strictEqual(gate.developmentStatus, 'OPEN', 'shared Gate development status must remain open');
assert.strictEqual(gate.releaseStatus, 'RELEASE_EVIDENCE_PENDING', 'shared Gate release evidence must remain pending');
for (const id of ['UI-031', 'GAME-040', 'SOC-029', 'TECH-028', 'TECH-029', 'TECH-030']) {
  const requirement = requirementById.get(id);
  assert(requirement, `${id} must remain in the atomic requirement ledger`);
  assert(!['verified', 'completed', 'released'].includes(requirement.status), `${id} must not be closed by local simulation evidence`);
}

console.log('SIMULATED_DEVICE_MATRIX_CONTRACT_ALL_PASS');
console.log(`INFO  ${SCOPE} :: local route=28/28 stage=12/12 network=30/30; external release evidence remains pending`);
