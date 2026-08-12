'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CORE_PATH = path.join(ROOT, 'public/src/core/08-ghost3d-foundation.js');
const SOURCE = fs.readFileSync(CORE_PATH, 'utf8');
const Ghost3D = require(CORE_PATH);
let failures = 0;

function check(name, value, detail) {
  const ok = !!value;
  console.log(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}

function sameKeys(value, expected) {
  return JSON.stringify(Object.keys(value)) === JSON.stringify(expected) &&
    JSON.stringify(Object.getOwnPropertyNames(value)) === JSON.stringify(expected);
}

function makeAdapter(id) {
  const calls = [];
  const renders = [];
  let disposeCount = 0;
  return {
    id,
    calls,
    renders,
    get disposeCount() { return disposeCount; },
    mount(context) { calls.push(['mount', context.quality, context.reducedMotion]); },
    render(frame, context, done) {
      calls.push(['render', frame.revision, context.quality]);
      renders.push({ frame, context, done });
    },
    motion(event, context) {
      calls.push(['motion', event.type, event.reducedMotion, event.instant, context.revision]);
    },
    setQuality(level) { calls.push(['quality', level]); },
    environment(environment) { calls.push(['environment', environment.reducedMotion]); },
    suspend() { calls.push(['suspend']); },
    resume() { calls.push(['resume']); },
    contextLost() { calls.push(['context-lost']); },
    dispose() { disposeCount += 1; calls.push(['dispose']); }
  };
}

check('module exposes only create and QUALITY', sameKeys(Ghost3D, ['create', 'QUALITY']));
let browserGlobalModulePass = false;
try {
  const browserContext = vm.createContext({});
  const noCommonJs = vm.runInContext('typeof module === "undefined" && typeof exports === "undefined" && typeof require === "undefined"', browserContext);
  vm.runInContext(SOURCE, browserContext, { filename: CORE_PATH });
  const browserGlobal = vm.runInContext('globalThis.Ghost3DFoundation', browserContext);
  const crossRealmFrame = { revision: 1, gameId: 'gomoku', nested: { safe: true } };
  const browserHost = browserGlobal.create();
  const crossRealmResult = browserHost.apply({ type: 'frame', frame: crossRealmFrame });
  browserGlobalModulePass = noCommonJs && sameKeys(browserGlobal, ['create', 'QUALITY']) && crossRealmResult.accepted &&
    crossRealmResult.snapshot.revision === 1 && crossRealmResult.snapshot.frame.gameId === 'gomoku' &&
    crossRealmResult.snapshot.frame.nested.safe === true && Object.isFrozen(crossRealmResult.snapshot.frame);
} catch (error) {}
check('browser-global VM module exposes the exact seam and accepts cross-realm frames', browserGlobalModulePass, 'UMD global export or cross-realm frame projection failed');
check('quality ladder is explicit', Object.keys(Ghost3D.QUALITY).join(',') === 'HIGH,BALANCED,LOW,FALLBACK');
const forbiddenCoreTokens = ['document', 'window', 'matchMedia', 'addEventListener', 'removeEventListener', 'visibilityTarget'];
check('core contains no environment listener tokens', forbiddenCoreTokens.every(token => !SOURCE.includes(token)));
check('core contains no legacy public factory aliases', !SOURCE.includes('createGhost3D') && !SOURCE.includes('createFallbackAdapter'));
check('core has no engine, animation, or platform dependency token', !/\b(?:three|gsap|dom|rule|protocol)\b/i.test(SOURCE));

const fallback = Ghost3D.create();
check('instance owns exactly the narrow Interface', sameKeys(fallback, ['apply', 'dispose', 'snapshot']));
check('default instance uses its private fallback', fallback.snapshot().usingFallback && fallback.snapshot().quality === 'FALLBACK' && fallback.snapshot().adapter === 'programmatic-fallback');

const sourceFrame = { revision: 1, gameId: 'gomoku', board: [{ cell: 3, owner: 'black' }], nested: { keep: true } };
const firstFrame = fallback.apply({ type: 'frame', frame: sourceFrame });
sourceFrame.board[0].cell = 99;
sourceFrame.nested.keep = false;
check('frame projection is immutable and detached from caller data', firstFrame.accepted && Object.isFrozen(firstFrame.snapshot.frame) && Object.isFrozen(firstFrame.snapshot.frame.board) && firstFrame.snapshot.frame.board[0].cell === 3 && firstFrame.snapshot.frame.nested.keep === true);
const hostileFrame = {
  revision: 1,
  gameId: 'gomoku',
  safe: { nested: { value: 'kept' }, list: [1, { value: 'also-kept' }] },
  nan: NaN,
  callback: function callback() {},
  constructor: { dangerous: true },
  prototype: { polluted: true }
};
hostileFrame.cycle = hostileFrame;
Object.defineProperty(hostileFrame, '__proto__', { enumerable: true, value: { polluted: true } });
Object.defineProperty(hostileFrame, 'unreadable', {
  enumerable: true,
  get() { throw new Error('unreadable'); }
});
const hostileHost = Ghost3D.create();
const hostileResult = hostileHost.apply({ type: 'frame', frame: hostileFrame });
const projectedHostileFrame = hostileResult.snapshot.frame;
function deeplyFrozen(value) {
  if (!value || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.keys(value).every(key => deeplyFrozen(value[key]));
}
const hostileKeysAreAbsent = ['cycle', 'nan', 'callback', 'constructor', 'prototype', '__proto__', 'unreadable']
  .every(key => !Object.prototype.hasOwnProperty.call(projectedHostileFrame, key));
check('projection drops hostile own values without prototype pollution and deep-freezes safe nested data', hostileResult.accepted &&
  projectedHostileFrame.safe.nested.value === 'kept' && projectedHostileFrame.safe.list[1].value === 'also-kept' &&
  hostileKeysAreAbsent && deeplyFrozen(projectedHostileFrame) && Object.getPrototypeOf(projectedHostileFrame) === Object.prototype &&
  !Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted') && ({}).polluted === undefined,
  'cycle, unsupported values, dangerous keys, or unreadable getters were not safely projected');
check('fallback renders accepted semantic state', firstFrame.snapshot.lastRenderedRevision === 1);
const stale = fallback.apply({ type: 'frame', frame: { revision: 1, gameId: 'gomoku' } });
check('frame revisions are strictly monotonic', !stale.accepted && stale.reason === 'stale_revision');

const terminal = Ghost3D.create();
terminal.apply({ type: 'frame', frame: { revision: 1, phase: 'playing' } });
const terminalFrame = terminal.apply({ type: 'frame', frame: { revision: 2, phase: 'complete' } });
const afterTerminal = terminal.apply({ type: 'frame', frame: { revision: 3, phase: 'playing' } });
const terminalInput = terminal.apply({ type: 'input', command: { type: 'tap', revision: 2 } });
check('terminal state latches once', terminalFrame.accepted && terminalFrame.terminal && terminal.snapshot().terminal);
check('terminal state rejects later frame and input messages', !afterTerminal.accepted && afterTerminal.reason === 'terminal' && !terminalInput.accepted && terminalInput.reason === 'terminal');

const adapter = makeAdapter('test-adapter');
const inputs = [];
const host = Ghost3D.create({
  adapter,
  quality: 'HIGH',
  onInput(command, snapshot) {
    inputs.push({ command, snapshot });
    return true;
  }
});
check('injected adapter mounts through create', host.snapshot().adapter === 'test-adapter' && adapter.calls[0][0] === 'mount' && host.snapshot().quality === 'HIGH');
const adapterFirst = host.apply({ type: 'frame', frame: { revision: 1, phase: 'playing', board: { x: 1 } } });
const adapterSecond = host.apply({ type: 'frame', frame: { revision: 2, phase: 'playing', board: { x: 2 } } });
check('adapter receives immutable frames through apply', adapterFirst.accepted && adapterSecond.accepted && adapter.renders.length === 2 && Object.isFrozen(adapter.renders[1].frame));
adapter.renders[0].done(null, { late: true });
check('late render completion cannot advance state', host.snapshot().lastRenderedRevision === null);
adapter.renders[1].done(null, { current: true });
check('current render completion advances state', host.snapshot().lastRenderedRevision === 2);

const input = host.apply({ type: 'input', command: { type: 'select_cell', revision: 2, payload: { row: 4, col: 5 } } });
check('input crosses only the onInput seam as frozen data', input.accepted && inputs.length === 1 && Object.isFrozen(inputs[0].command) && inputs[0].command.payload.row === 4);
check('invalid and stale input are rejected before callback', !host.apply({ type: 'input', command: { type: 'bad space', revision: 2 } }).accepted && !host.apply({ type: 'input', command: { type: 'tap', revision: 1 } }).accepted && inputs.length === 1);

const quality = host.apply({ type: 'quality', quality: 'BALANCED' });
check('quality changes use the shared ladder', quality.accepted && host.snapshot().quality === 'BALANCED' && adapter.calls.some(call => call[0] === 'quality' && call[1] === 'BALANCED'));
const environment = host.apply({ type: 'environment', reducedMotion: true });
const motion = host.apply({ type: 'motion', event: { type: 'piece_land', revision: 2, payload: { cell: 4 } } });
check('environment is injected through apply', environment.accepted && host.snapshot().reducedMotion && adapter.calls.some(call => call[0] === 'environment' && call[1] === true));
check('semantic motion is forwarded with reduced-motion metadata', motion.accepted && motion.forwarded === true && Object.isFrozen(motion.event) && adapter.calls.some(call => call[0] === 'motion' && call[1] === 'piece_land' && call[2] === true && call[3] === true));

const rendersBeforeSuspend = adapter.renders.length;
const suspended = host.apply({ type: 'lifecycle', action: 'suspend' });
const frameWhileSuspended = host.apply({ type: 'frame', frame: { revision: 3, phase: 'playing' } });
check('suspend pauses rendering but retains the latest frame', suspended.accepted && suspended.suspended && frameWhileSuspended.accepted && host.snapshot().suspended && adapter.renders.length === rendersBeforeSuspend && adapter.calls.some(call => call[0] === 'suspend'));
const resumed = host.apply({ type: 'lifecycle', action: 'resume' });
check('resume replays the retained latest frame', resumed.accepted && !host.snapshot().suspended && adapter.calls.some(call => call[0] === 'resume') && adapter.renders.some(render => render.frame.revision === 3));
const hidden = host.apply({ type: 'lifecycle', action: 'hidden' });
const visible = host.apply({ type: 'lifecycle', action: 'visible' });
check('hidden and visible are injected lifecycle messages', hidden.accepted && hidden.snapshot.hidden && visible.accepted && !visible.snapshot.hidden && !visible.snapshot.suspended);

const lostRender = adapter.renders[adapter.renders.length - 1];
const lost = host.apply({ type: 'context-lost', reason: 'test' });
lostRender.done(new Error('stale renderer failure'));
check('context loss enters fallback and rejects stale adapter work', lost.accepted && lost.snapshot.usingFallback && lost.snapshot.contextLost && adapter.calls.some(call => call[0] === 'context-lost') && adapter.disposeCount === 1 && !/stale renderer failure/.test((host.snapshot().lastFailure || {}).message || ''));
const recoveredAdapter = makeAdapter('recovered-adapter');
const recovered = host.apply({ type: 'recover', adapter: recoveredAdapter });
check('recover installs a supplied fresh adapter', recovered.accepted && !host.snapshot().usingFallback && !host.snapshot().contextLost && host.snapshot().adapter === 'recovered-adapter' && recoveredAdapter.calls[0][0] === 'mount');

const failingAdapter = makeAdapter('failing-adapter');
failingAdapter.render = function render() { throw new Error('boom'); };
const failed = Ghost3D.create({ adapter: failingAdapter });
const failedFrame = failed.apply({ type: 'frame', frame: { revision: 1, phase: 'playing' } });
check('adapter render failure selects private fallback', failedFrame.accepted && failed.snapshot().usingFallback && failed.snapshot().quality === 'FALLBACK' && /boom/.test((failed.snapshot().lastFailure || {}).message || ''));

const mountFailingAdapter = makeAdapter('mount-failing-adapter');
mountFailingAdapter.mount = function mount() { throw new Error('mount boom'); };
const mountFailed = Ghost3D.create({ adapter: mountFailingAdapter });
check('adapter mount failure selects private fallback', mountFailed.snapshot().usingFallback && mountFailed.snapshot().quality === 'FALLBACK' && /mount boom/.test((mountFailed.snapshot().lastFailure || {}).message || ''));

let delayedMount;
const delayedAdapter = makeAdapter('delayed-adapter');
delayedAdapter.mount = function mount(context, done) { delayedMount = done; };
const delayed = Ghost3D.create({ adapter: delayedAdapter });
delayed.apply({ type: 'frame', frame: { revision: 1, phase: 'playing' } });
const delayedMotion = delayed.apply({ type: 'motion', event: { type: 'piece_land', revision: 1 } });
check('motion during delayed mount is accepted but not forwarded', delayedMotion.accepted && delayedMotion.forwarded === false && Object.isFrozen(delayedMotion.event) && !delayedAdapter.calls.some(call => call[0] === 'motion'));
delayed.apply({ type: 'context-lost', reason: 'before-mount' });
delayedMount(new Error('late mount failure'));
check('stale mount completion is ignored after adapter generation changes', delayed.snapshot().usingFallback && !/late mount failure/.test((delayed.snapshot().lastFailure || {}).message || ''));

let stagedMount;
const stagedQualityCompletions = [];
const stagedEnvironmentCompletions = [];
const stagedAdapter = makeAdapter('staged-mount-adapter');
stagedAdapter.mount = function mount(context, done) {
  stagedAdapter.calls.push(['mount', context.quality, context.reducedMotion]);
  stagedMount = done;
};
stagedAdapter.setQuality = function setQuality(level, context, done) {
  stagedAdapter.calls.push(['quality', level, context.reducedMotion]);
  stagedQualityCompletions.push(done);
};
stagedAdapter.environment = function environment(value, context, done) {
  stagedAdapter.calls.push(['environment', value.reducedMotion, context.quality]);
  stagedEnvironmentCompletions.push(done);
};
const stagedHost = Ghost3D.create({ adapter: stagedAdapter, quality: 'HIGH', reducedMotion: false });
const stagedFrame = stagedHost.apply({ type: 'frame', frame: { revision: 1, phase: 'playing' } });
const stagedQuality = stagedHost.apply({ type: 'quality', quality: 'LOW' });
const stagedEnvironment = stagedHost.apply({ type: 'environment', reducedMotion: true });
if (stagedMount) stagedMount(null, true);
const stagedSnapshotBeforeConfiguration = stagedHost.snapshot();
const stagedQualityCall = stagedAdapter.calls.find(call => call[0] === 'quality');
const stagedEnvironmentCall = stagedAdapter.calls.find(call => call[0] === 'environment');
const stagedNoRenderBeforeConfiguration = stagedAdapter.renders.length === 0;
const stagedMotionBeforeConfiguration = stagedHost.apply({ type: 'motion', event: { type: 'piece_land', revision: 1 } });
const stagedNoMotionBeforeConfiguration = !stagedAdapter.calls.some(call => call[0] === 'motion');
if (stagedQualityCompletions[0]) stagedQualityCompletions[0](null, true);
if (stagedEnvironmentCompletions[0]) stagedEnvironmentCompletions[0](null, true);
const stagedRender = stagedAdapter.renders[0];
const stagedMotionAfterConfiguration = stagedHost.apply({ type: 'motion', event: { type: 'piece_land', revision: 1 } });
const stagedMotionCall = stagedAdapter.calls.find(call => call[0] === 'motion');
const stagedQualityIndex = stagedAdapter.calls.indexOf(stagedQualityCall);
const stagedEnvironmentIndex = stagedAdapter.calls.indexOf(stagedEnvironmentCall);
const stagedRenderIndex = stagedAdapter.calls.findIndex(call => call[0] === 'render');
check('mount-pending quality and environment configure the latest context before first render', stagedFrame.accepted && stagedQuality.accepted && stagedEnvironment.accepted && stagedSnapshotBeforeConfiguration.quality === 'LOW' && stagedSnapshotBeforeConfiguration.requestedQuality === 'LOW' && stagedSnapshotBeforeConfiguration.reducedMotion && stagedQualityCall && stagedQualityCall[1] === 'LOW' && stagedQualityCall[2] === true && stagedEnvironmentCall && stagedEnvironmentCall[1] === true && stagedEnvironmentCall[2] === 'LOW' && stagedNoRenderBeforeConfiguration && stagedRender && stagedRender.context.quality === 'LOW' && stagedRender.context.reducedMotion === true && stagedQualityIndex < stagedRenderIndex && stagedEnvironmentIndex < stagedRenderIndex);
check('motion during pending async quality or environment configuration is not forwarded', stagedMotionBeforeConfiguration.accepted && stagedMotionBeforeConfiguration.forwarded === false && Object.isFrozen(stagedMotionBeforeConfiguration.event) && stagedNoMotionBeforeConfiguration);
check('new motion forwards after the current configuration completes', stagedMotionAfterConfiguration.accepted && stagedMotionAfterConfiguration.forwarded === true && stagedMotionCall && stagedMotionCall[1] === 'piece_land' && stagedMotionCall[2] === true && stagedMotionCall[3] === true);
stagedHost.dispose();

const unsupportedMotionAdapter = makeAdapter('unsupported-motion-adapter');
delete unsupportedMotionAdapter.motion;
const unsupportedMotionHost = Ghost3D.create({ adapter: unsupportedMotionAdapter });
unsupportedMotionHost.apply({ type: 'frame', frame: { revision: 1, phase: 'playing' } });
const unsupportedMotion = unsupportedMotionHost.apply({ type: 'motion', event: { type: 'piece_land', revision: 1 } });
check('unsupported adapter motion is accepted with forwarded false', unsupportedMotion.accepted && unsupportedMotion.forwarded === false && Object.isFrozen(unsupportedMotion.event) && !unsupportedMotionAdapter.calls.some(call => call[0] === 'motion') && !unsupportedMotionHost.snapshot().usingFallback);
unsupportedMotionHost.dispose();

const rapidQualityCompletions = [];
const rapidQualityAdapter = makeAdapter('rapid-quality-adapter');
rapidQualityAdapter.setQuality = function setQuality(level, context, done) {
  rapidQualityAdapter.calls.push(['quality', level, context.reducedMotion]);
  rapidQualityCompletions.push({ level, done });
};
const rapidQualityHost = Ghost3D.create({ adapter: rapidQualityAdapter, quality: 'HIGH' });
const initialQualityCompletion = rapidQualityCompletions.shift();
if (initialQualityCompletion) initialQualityCompletion.done(null, true);
const firstRapidQuality = rapidQualityHost.apply({ type: 'quality', quality: 'BALANCED' });
const staleQualityCompletion = rapidQualityCompletions.shift();
const secondRapidQuality = rapidQualityHost.apply({ type: 'quality', quality: 'LOW' });
const currentQualityCompletion = rapidQualityCompletions.shift();
if (currentQualityCompletion) currentQualityCompletion.done(null, true);
if (staleQualityCompletion) staleQualityCompletion.done(new Error('stale quality failure'));
check('stale async quality failure cannot replace a newer successful quality', firstRapidQuality.accepted && secondRapidQuality.accepted && !rapidQualityHost.snapshot().usingFallback && rapidQualityHost.snapshot().adapter === 'rapid-quality-adapter' && rapidQualityHost.snapshot().quality === 'LOW' && rapidQualityHost.snapshot().requestedQuality === 'LOW' && !/stale quality failure/.test((rapidQualityHost.snapshot().lastFailure || {}).message || ''));
rapidQualityHost.dispose();

const rapidEnvironmentCompletions = [];
const rapidEnvironmentAdapter = makeAdapter('rapid-environment-adapter');
rapidEnvironmentAdapter.environment = function environment(value, context, done) {
  rapidEnvironmentAdapter.calls.push(['environment', value.reducedMotion, context.quality]);
  rapidEnvironmentCompletions.push({ value, done });
};
const rapidEnvironmentHost = Ghost3D.create({ adapter: rapidEnvironmentAdapter, quality: 'HIGH' });
const initialEnvironmentCompletion = rapidEnvironmentCompletions.shift();
if (initialEnvironmentCompletion) initialEnvironmentCompletion.done(null, true);
const firstRapidEnvironment = rapidEnvironmentHost.apply({ type: 'environment', reducedMotion: true });
const staleEnvironmentCompletion = rapidEnvironmentCompletions.shift();
const secondRapidEnvironment = rapidEnvironmentHost.apply({ type: 'environment', reducedMotion: false });
const currentEnvironmentCompletion = rapidEnvironmentCompletions.shift();
if (currentEnvironmentCompletion) currentEnvironmentCompletion.done(null, true);
if (staleEnvironmentCompletion) staleEnvironmentCompletion.done(new Error('stale environment failure'));
check('stale async environment failure cannot replace a newer successful environment', firstRapidEnvironment.accepted && secondRapidEnvironment.accepted && !rapidEnvironmentHost.snapshot().usingFallback && rapidEnvironmentHost.snapshot().adapter === 'rapid-environment-adapter' && rapidEnvironmentHost.snapshot().reducedMotion === false && !/stale environment failure/.test((rapidEnvironmentHost.snapshot().lastFailure || {}).message || ''));
rapidEnvironmentHost.dispose();

const spentRecoverAdapter = makeAdapter('spent-recover-adapter');
const spentRecoverHost = Ghost3D.create({ adapter: spentRecoverAdapter });
const spentFallback = spentRecoverHost.apply({ type: 'context-lost', reason: 'freshness-check' });
const spentRecover = spentRecoverHost.apply({ type: 'recover', adapter: spentRecoverAdapter });
check('recover rejects an adapter already disposed by this host', spentFallback.accepted && spentRecoverAdapter.disposeCount === 1 && !spentRecover.accepted && spentRecover.reason === 'adapter_not_fresh' && spentRecover.snapshot.usingFallback);
spentRecoverHost.dispose();

const disposed = host.dispose();
const disposedAgain = host.dispose();
const afterDispose = host.apply({ type: 'frame', frame: { revision: 4 } });
check('dispose is idempotent and releases the active adapter once', disposed.status === 'disposed' && disposedAgain.status === 'disposed' && disposedAgain.frame === null && recoveredAdapter.disposeCount === 1);
check('disposed instance rejects every later message', !afterDispose.accepted && afterDispose.reason === 'disposed');

if (failures) {
  console.error(`GHOST3D_FOUNDATION_FAILURES=${failures}`);
  process.exitCode = 1;
} else {
  console.log('GHOST3D_FOUNDATION_ALL_PASS');
}
