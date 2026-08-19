/*
 * Read-only audio migration audit.
 *
 * Usage:
 *   node qa/audio-cue-inventory.js
 *   node qa/audio-cue-inventory.js --strict
 *
 * The default mode prints the current inventory and known migration findings
 * but exits zero.  --strict is intended for the post-migration gate and exits
 * non-zero while legacy direct paths or pre-commit cues remain.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public', 'src');
const gameDir = path.join(src, 'games');
const gameFiles = ['gomoku.js', 'ludo.js', 'monopoly.js', 'tank.js', 'tetris.js', 'xiangqi.js'];
const strict = process.argv.includes('--strict');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function lineNumber(text, needle, start = 0) {
  const index = text.indexOf(needle, start);
  return index < 0 ? null : text.slice(0, index).split(/\r?\n/).length;
}

function allMatches(text, pattern) {
  const matches = [];
  let match;
  while ((match = pattern.exec(text))) {
    matches.push({ index:match.index, line: text.slice(0, match.index).split(/\r?\n/).length, text: match[0] });
    if (!pattern.global) break;
  }
  return matches;
}

const utils = read('public/src/core/01-utils.js');
const bus = read('public/src/core/15-feedback-bus.js');
const findings = [];
const inventory = [];

function finding(code, severity, message, file, line) {
  findings.push({ code, severity, message, file, line: line || null });
}

// The DOM-level listener is intentionally called out because it is independent
// of action legality and duplicates game-level feedback.
const globalClick = /document\.addEventListener\(['"]click['"][\s\S]{0,300}?closest\(['"]\.btn['"]\)/.test(utils);
if (globalClick) finding('GLOBAL_BUTTON_CLICK', 'error', 'Global .btn click listener still calls legacy sfx; it can duplicate or sound rejected actions.', 'public/src/core/01-utils.js', lineNumber(utils, "document.addEventListener('click'"));

const busBlock = (bus.match(/var EVENT_TYPES = Object\.freeze\(\[([\s\S]*?)\]\);/) || [])[1] || '';
const busTypes = (busBlock.match(/['"]([a-z][a-z_]*)['"]/g) || [])
  .map(value => value.slice(1, -1));
const uniqueBusTypes = [...new Set(busTypes)];

const unifiedPath = path.join(src, 'core', '21-unified-feedback-adapter.js');
let unifiedTypes = [];
if (fs.existsSync(unifiedPath)) {
  const unified = fs.readFileSync(unifiedPath, 'utf8');
  const unifiedBlock = (unified.match(/var CUE_TYPES = \[([\s\S]*?)\];/) || [])[1] || '';
  unifiedTypes = [...new Set((unifiedBlock.match(/['"]([a-z][a-z_]*)['"]/g) || []).map(value => value.slice(1, -1)))];
  const missingAdapterTypes = uniqueBusTypes.filter(type => !unifiedTypes.includes(type));
  if (missingAdapterTypes.length) {
    finding('ADAPTER_VOCABULARY_DRIFT', 'error', `UnifiedFeedbackAdapter does not define bus types: ${missingAdapterTypes.join(', ')}`, 'public/src/core/21-unified-feedback-adapter.js', lineNumber(unified, 'var CUE_TYPES'));
  }
}

const expectedGameCues = Object.freeze({
  'gomoku.js': ['gomoku_place', 'gomoku_line'],
  'ludo.js': ['ludo_roll', 'ludo_move', 'ludo_capture', 'ludo_home'],
  'monopoly.js': ['monopoly_roll', 'monopoly_land', 'monopoly_purchase', 'monopoly_pay', 'monopoly_auction', 'monopoly_bankrupt'],
  'tank.js': ['tank_move', 'tank_fire', 'tank_hit', 'tank_ko', 'tank_respawn'],
  'tetris.js': ['tetris_move', 'tetris_rotate', 'tetris_soft_drop', 'tetris_hard_drop', 'tetris_lock', 'tetris_line_clear', 'tetris_ko'],
  'xiangqi.js': ['xiangqi_move', 'xiangqi_capture', 'xiangqi_check', 'xiangqi_checkmate']
});

function sourceBlock(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  if (start < 0) return '';
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

for (const file of gameFiles) {
  const relative = `public/src/games/${file}`;
  const text = read(relative);
  const helperStart = text.indexOf('const audioCue =');
  const helperEnd = helperStart < 0 ? -1 : text.indexOf('\n  };', helperStart);
  const helper = helperStart < 0 || helperEnd < 0 ? '' : text.slice(helperStart, helperEnd + 5);
  const safeHelper = /typeof emitAcceptedAudioCue === ['"]function['"]/.test(text) &&
    /const audioCue =/.test(text) && /typeof playFeedback === ['"]function['"]/.test(helper) &&
    /accepted:false, reason:['"]unavailable['"]/.test(helper);
  if (!safeHelper) finding('AUDIO_HELPER_MISSING', 'error', 'Game module lacks the safe local audioCue helper with emitAcceptedAudioCue priority and playFeedback VM fallback.', relative, lineNumber(text, 'function game'));

  const legacy = allMatches(text, /\b(?:sfx|haptic|playFeedback)\s*\(/g)
    .map(match => ({ ...match, call:match.text.trim() }));
  // Every module has exactly one playFeedback call inside its helper. Locate
  // by character range as line layouts differ between the six games.
  const bypassLegacy = legacy.filter(call => {
    return call.call !== 'playFeedback(' || call.index < helperStart || call.index > helperEnd;
  });
  const directPresentation = allMatches(text, /\b(?:emitPresentationAudio|emitAudioCue)\s*\(/g);
  const directAccepted = allMatches(text, /\bemitAcceptedAudioCue\s*\(/g);
  const semanticCalls = allMatches(text, /\baudioCue\s*\(/g).map(match => ({ line:match.line, call:match.text.trim() }));
  inventory.push({ file, safeAudioHelper:safeHelper, semanticCueCalls:semanticCalls, directLegacyCalls:bypassLegacy, directPresentationCalls:directPresentation });
  for (const call of bypassLegacy) finding('LEGACY_DIRECT_CALL', 'error', `${call.call} remains outside the audioCue compatibility helper.`, relative, call.line);
  for (const call of directPresentation) finding('PRESENTATION_BYPASS', 'error', `${call.text.trim()} bypasses the local accepted-action helper.`, relative, call.line);
  for (const call of directAccepted) finding('ACCEPTED_HELPER_BYPASS', 'error', 'Direct emitAcceptedAudioCue call remains; game cue callsites must use audioCue.', relative, call.line);
  for (const cue of expectedGameCues[file]) {
    if (!text.includes(`'${cue}'`) && !text.includes(`"${cue}"`)) finding('GAME_CUE_MISSING', 'error', `${cue} has no game callsite.`, relative, lineNumber(text, 'function game'));
  }
}

// Known ordering checks are deliberately source-local and verify the real
// accepted mutation/receipt seam, not just the absence of a legacy function.
const gomoku = read('public/src/games/gomoku.js');
const gomokuCueIndex = gomoku.indexOf("audioCue('gomoku_place'");
const gomokuCommitIndex = gomoku.indexOf('grid[r][c] = cur;');
if (gomokuCueIndex < 0 || gomokuCommitIndex < 0 || gomokuCueIndex < gomokuCommitIndex) finding('PRE_COMMIT_CUE', 'error', 'Gomoku placement cue must follow grid/history commit.', 'public/src/games/gomoku.js', lineNumber(gomoku, "audioCue('gomoku_place'"));

const ludo = read('public/src/games/ludo.js');
const ludoApplyDice = ludo.indexOf('function applyDice(d)');
const ludoRollCue = ludo.indexOf("audioCue('ludo_roll'");
const ludoRollCommit = ludo.indexOf("phase = 'rolling';", ludoApplyDice);
if (ludoRollCue < ludoApplyDice || ludoRollCue < ludoRollCommit) finding('PRE_COMMIT_CUE', 'error', 'Ludo roll cue must be inside accepted applyDice after phase commit.', 'public/src/games/ludo.js', lineNumber(ludo, "audioCue('ludo_roll'"));
const ludoMoveCue = ludo.indexOf('audioCue(capturedTokens.length');
const ludoMoveCommit = ludo.indexOf('tokens[p2i][j] = -1;');
if (ludoMoveCue < 0 || ludoMoveCue < ludoMoveCommit) finding('PRE_COMMIT_CUE', 'error', 'Ludo move/capture cue must follow token and capture commits.', 'public/src/games/ludo.js', lineNumber(ludo, 'audioCue(capturedTokens.length'));

const monopoly = read('public/src/games/monopoly.js');
const monopolyRollBlock = sourceBlock(monopoly, 'function roll(){', 'function applyRoll');
if (/\baudioCue\s*\(/.test(monopolyRollBlock)) finding('PRE_AUTHORITY_CUE', 'error', 'Monopoly roll() emits before full-rule server acceptance.', 'public/src/games/monopoly.js', lineNumber(monopoly, 'function roll(){'));
const monopolyApplyRoll = monopoly.indexOf('function applyRoll');
const monopolyRollCue = monopoly.indexOf("audioCue('monopoly_roll'", monopolyApplyRoll);
const monopolyRollCommit = monopoly.indexOf("phase = 'moving';", monopolyApplyRoll);
if (monopolyRollCue < monopolyRollCommit) finding('PRE_COMMIT_CUE', 'error', 'Monopoly local roll cue must follow accepted phase commit.', 'public/src/games/monopoly.js', lineNumber(monopoly, "audioCue('monopoly_roll'", lineNumber(monopoly, 'function applyRoll')));
const monopolyPurchase = monopoly.indexOf("audioCue('monopoly_purchase'", monopoly.indexOf('function applyDecision'));
const monopolyPurchaseCommit = monopoly.indexOf('p.money -= cell.price', monopoly.indexOf('function applyDecision'));
if (monopolyPurchase < monopolyPurchaseCommit) finding('PRE_COMMIT_CUE', 'error', 'Monopoly purchase cue precedes money/ownership commit.', 'public/src/games/monopoly.js', lineNumber(monopoly, "audioCue('monopoly_purchase'"));
const monopolyPay = monopoly.indexOf("audioCue('monopoly_pay'", monopoly.indexOf('function pay'));
const monopolyPayCommit = monopoly.indexOf('p.money -= amt', monopoly.indexOf('function pay'));
if (monopolyPay < monopolyPayCommit) finding('PRE_COMMIT_CUE', 'error', 'Monopoly pay cue precedes cash commit.', 'public/src/games/monopoly.js', lineNumber(monopoly, "audioCue('monopoly_pay'"));
const monopolyAuthority = monopoly.indexOf('function onMonopolyRuleState');
const monopolyRestore = monopoly.indexOf('const applied=onRestore', monopolyAuthority);
const monopolyAuthorityCues = monopoly.indexOf('emitMonopolyAuthorityCues(', monopolyRestore);
if (monopolyRestore < 0 || monopolyAuthorityCues < monopolyRestore) finding('PRE_AUTHORITY_CUE', 'error', 'Monopoly authority cues must follow an accepted onRestore result.', 'public/src/games/monopoly.js', lineNumber(monopoly, 'function onMonopolyRuleState'));

const tank = read('public/src/games/tank.js');
const tankFire = tank.indexOf("audioCue('tank_fire'", tank.indexOf('function fireTank'));
const tankFireCommit = tank.indexOf('bullets.push', tank.indexOf('function fireTank'));
if (tankFire < tankFireCommit) finding('PRE_COMMIT_CUE', 'error', 'Tank fire cue precedes projectile/cooldown commit.', 'public/src/games/tank.js', lineNumber(tank, "audioCue('tank_fire'"));
const tankMove = tank.indexOf("audioCue('tank_move'", tank.indexOf('function moveTank'));
const tankMoveCommit = tank.indexOf('tank.x = nx', tank.indexOf('function moveTank'));
if (tankMove < tankMoveCommit) finding('PRE_COMMIT_CUE', 'error', 'Tank move cue precedes accepted position commit.', 'public/src/games/tank.js', lineNumber(tank, "audioCue('tank_move'"));
for (const [name,end] of [['function applyJoystickPoint','function releaseJoystick'],['function setFireState','function releaseFirePointer']]) {
  if (/\baudioCue\s*\(/.test(sourceBlock(tank,name,end))) finding('INPUT_ONLY_CUE', 'error', `${name.replace('function ','')} emits from raw input before simulation/authority acceptance.`, 'public/src/games/tank.js', lineNumber(tank,name));
}

const tetris = read('public/src/games/tetris.js');
const tetrisLock = tetris.indexOf("audioCue('tetris_lock'", tetris.indexOf('function applyPlacement'));
const tetrisCommit = tetris.indexOf('state.lastEvent=scoringEventToken', tetris.indexOf('function applyPlacement'));
if (tetrisLock < tetrisCommit) finding('PRE_COMMIT_CUE', 'error', 'Tetris lock cue precedes board/scoring commit.', 'public/src/games/tetris.js', lineNumber(tetris, "audioCue('tetris_lock'"));
if (!/if\(!fullRuleAuthority\)[\s\S]{0,260}audioCue\('tetris_lock'/.test(tetris)) finding('PRE_AUTHORITY_CUE', 'error', 'Tetris optimistic full-rule placement is not suppressed before server receipt.', 'public/src/games/tetris.js', lineNumber(tetris, "audioCue('tetris_lock'"));
const tetrisAuthority = tetris.indexOf('function onTetrisRuleState');
const tetrisAuthorityApply = tetris.indexOf('parsed.forEach', tetrisAuthority);
const tetrisAuthorityCue = tetris.indexOf('emitTetrisRuleAudio(', tetrisAuthority);
if (tetrisAuthorityCue < tetrisAuthorityApply) finding('PRE_AUTHORITY_CUE', 'error', 'Tetris rule cues precede accepted player snapshot application.', 'public/src/games/tetris.js', lineNumber(tetris, 'function onTetrisRuleState'));

const xiangqi = read('public/src/games/xiangqi.js');
const xiangqiCue = xiangqi.indexOf('audioCue(captured ?', xiangqi.indexOf('function doMove'));
const xiangqiCommit = xiangqi.indexOf('board[to[0]][to[1]] = piece;', xiangqi.indexOf('function doMove'));
if (xiangqiCue < xiangqiCommit) finding('PRE_COMMIT_CUE', 'error', 'Xiangqi local move cue precedes board commit.', 'public/src/games/xiangqi.js', lineNumber(xiangqi, 'audioCue(captured ?'));
const xiangqiAuthority = xiangqi.indexOf('function onXiangqiRuleState');
const xiangqiRestore = xiangqi.indexOf('const restored = onRestore', xiangqiAuthority);
const xiangqiAuthorityCue = xiangqi.indexOf("audioCue(captured?'xiangqi_capture'", xiangqiRestore);
if (xiangqiRestore < 0 || xiangqiAuthorityCue < xiangqiRestore || !/source===['"]live['"]/.test(xiangqi.slice(xiangqiRestore, xiangqiAuthorityCue + 200))) finding('PRE_AUTHORITY_CUE', 'error', 'Xiangqi rule cue must follow accepted live snapshot restore.', 'public/src/games/xiangqi.js', lineNumber(xiangqi, 'function onXiangqiRuleState'));

const overlay = /showVictoryOverlay\s*\(/g;
for (const file of gameFiles) {
  const relative = `public/src/games/${file}`;
  const text = read(relative);
  const matches = allMatches(text, overlay);
  if (matches.length) inventory.find(item => item.file === file).outcomeOverlayCallsites = matches.map(item => item.line);
}
if (/showVictoryOverlay\s*\(/.test(utils) && /sfx\(opts\.coins/.test(utils)) {
  finding('RENDER_OUTCOME_AUDIO', 'error', 'Victory overlay construction directly plays sfx; repeated render/rebuild can repeat terminal audio.', 'public/src/core/01-utils.js', lineNumber(utils, 'sfx(opts.coins'));
}

const expectedTypes = ['match_terminal', ...new Set(Object.values(expectedGameCues).flat())];
const missingBusTypes = expectedTypes.filter(type => !uniqueBusTypes.includes(type));
if (missingBusTypes.length) finding('BUS_VOCABULARY', 'error', `Expected baseline cue types missing from FeedbackBus: ${missingBusTypes.join(', ')}`, 'public/src/core/15-feedback-bus.js', lineNumber(bus, 'var EVENT_TYPES'));

const report = {
  generatedAt: new Date().toISOString(),
  strict,
  busTypes: uniqueBusTypes,
  unifiedAdapterTypes: unifiedTypes,
  inventory,
  findings,
  summary: {
    gameModules: gameFiles.length,
    legacyDirectCalls: inventory.reduce((sum, item) => sum + item.directLegacyCalls.length, 0),
    outcomeOverlayCallsites: inventory.reduce((sum, item) => sum + (item.outcomeOverlayCallsites || []).length, 0),
    findingCount: findings.length
  }
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (strict && findings.some(item => item.severity === 'error')) process.exitCode = 1;
