#!/usr/bin/env node
'use strict';

/*
 * Accepted-state audio gate.
 *
 * This probe is intentionally source-level: it verifies that presentation
 * cues remain downstream of a committed local action or an accepted authority
 * receipt.  It does not execute a browser or alter the gameplay protocol.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sourceBlock = (source, startNeedle, endNeedle) => {
  const start = source.indexOf(startNeedle);
  if (start < 0) return '';
  const end = endNeedle ? source.indexOf(endNeedle, start + startNeedle.length) : -1;
  return end < 0 ? source.slice(start) : source.slice(start, end);
};

let failures = 0;
let assertions = 0;
function check(label, fn) {
  assertions += 1;
  try {
    fn();
    console.log(`PASS ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label} :: ${error && error.message || error}`);
  }
}

const games = Object.fromEntries([
  'gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'
].map(id => [id, read(`public/src/games/${id}.js`)]));
const utils = read('public/src/core/01-utils.js');

check('all six callers use the accepted-action compatibility seam', () => {
  Object.entries(games).forEach(([id, source]) => {
    assert(source.includes('const audioCue ='), `${id} helper missing`);
    assert(source.includes("typeof emitAcceptedAudioCue === 'function'"), `${id} accepted priority missing`);
    assert(source.includes("accepted:false, reason:'unavailable'"), `${id} fail-silent fallback missing`);
  });
});

check('Gomoku placement cue follows commit and has a monotonic local sequence', () => {
  const source = games.gomoku;
  const commit = source.indexOf('grid[r][c] = cur;');
  const cue = source.indexOf("audioCue('gomoku_place'", commit);
  assert(commit >= 0 && cue > commit);
  assert(source.includes('let moveImpact = null, impactTimer = null, gomokuAudioSession = 0, gomokuAudioSequence = 0'));
  assert(source.includes('const moveAudioSequence = ++gomokuAudioSequence'));
});

check('Ludo rejects raw roll attempts and sequences accepted rolls/moves', () => {
  const source = games.ludo;
  const rollBlock = sourceBlock(source, 'function roll(){', 'function applyDice');
  assert(!/audioCue\s*\(/.test(rollBlock));
  const phaseCommit = source.indexOf("phase = 'rolling';");
  const rollCue = source.indexOf("audioCue('ludo_roll'", phaseCommit);
  assert(phaseCommit >= 0 && rollCue > phaseCommit);
  assert(source.includes('audioRollSequence = 0, audioMoveSequence = 0'));
  assert(source.includes('const moveAudioSequence = ++audioMoveSequence'));
});

check('Monopoly full-rule roll/decision paths wait for authority', () => {
  const source = games.monopoly;
  assert(!/audioCue\s*\(/.test(sourceBlock(source, 'function roll(){', 'function applyRoll')));
  assert(source.includes('if(fullRuleAuthority){phase=\'moving\';'));
  assert(source.includes('function emitMonopolyAuthorityCues'));
  const authority = source.indexOf('function onMonopolyRuleState');
  const applied = source.indexOf('const applied=onRestore', authority);
  const cue = source.indexOf('emitMonopolyAuthorityCues(', applied);
  assert(authority >= 0 && applied > authority && cue > applied);
});

check('Tank suppresses prediction/bootstrap cues and emits accepted movement only', () => {
  const source = games.tank;
  const move = sourceBlock(source, 'function moveTank', 'function fireTank');
  assert(/!authorityMode/.test(move));
  assert(/audioCue\('tank_move'/.test(move));
  const authority = source.indexOf('function onAuthoritySnapshot');
  const duplicateGuard = source.indexOf("if(receiptStatus==='duplicate_tick')return true", authority);
  const silentGate = source.indexOf('if(silent!==true&&audioReceiptAccepted&&previousAudio)', authority);
  assert(authority >= 0 && duplicateGuard > authority && silentGate > duplicateGuard);
  assert(source.includes("const audioReceiptAccepted = receiptStatus === 'accepted'"));
  assert(source.includes('audioReceiptAccepted&&previousAudio'));
  assert(source.includes('if (audioReceiptAccepted) tankAudioAuthorityBaseline=nextAudioBaseline'));
  assert(source.includes("if(silent===true){resetTankInputGate();resetTankPrediction('authority-bootstrap');}"));
  const authorityMove = sourceBlock(source, "audioCue('tank_move',{actionId:'tank-move-authority-'", '\n');
  assert(authorityMove && !authorityMove.includes('tankFeedbackPan'), 'tank_move must stay centered because the Bus only permits spatial fire/hit/KO cues');
});

check('Tetris battle v1 waits for accepted receipts while v3 uses accepted rule state', () => {
  const source = games.tetris;
  const placement = sourceBlock(source, 'function applyPlacement', 'function lockActive');
  assert(/if\(!authorityMode\)/.test(placement));
  assert(source.includes("audioCue('tetris_lock',{actionId:tetrisBattleAudioId(event.revision,event.attackId,'lock')"));
  assert(source.includes("if(target===controlled)audioCue('tetris_garbage'"));
  assert(source.includes("audioCue('tetris_ko',{actionId:'tetris-authority-'"));
  const ruleState = source.indexOf('function onTetrisRuleState');
  assert(source.indexOf('emitTetrisRuleAudio(value,parsed,reconnect,beforeAudio)', ruleState) > ruleState);
  assert(source.includes('if(reconnect||!Array.isArray(parsed)||!Array.isArray(before))return false'));
});

check('Xiangqi authority cues require a live accepted snapshot', () => {
  const source = games.xiangqi;
  const authority = source.indexOf('function onXiangqiRuleState');
  const restore = source.indexOf('const restored = onRestore', authority);
  const cue = source.indexOf("audioCue(captured?'xiangqi_capture':'xiangqi_move'", restore);
  assert(authority >= 0 && restore > authority && cue > restore);
  assert(source.slice(restore, cue + 180).includes("source==='live'"));
  assert(source.includes('xiangqiAuthorityAudioMoveNumber=0'));
});

check('terminal audio is explicit, viewer-aware, and not inferred only from coins', () => {
  assert(utils.includes('viewerSlot'));
  assert(utils.includes("match_draw"));
  assert(utils.includes("match_loss"));
  assert(utils.includes('audioId'));
  assert(!/emitPresentationAudio\(opts\.coins/.test(utils));
  Object.entries(games).forEach(([id, source]) => {
    assert(source.includes('viewerSlot:'), `${id} outcome viewer missing`);
    assert(source.includes('audioId:'), `${id} outcome id missing`);
  });
});

if (failures) {
  console.error(`AUDIO_AUTHORITY_CONTRACT_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`AUDIO_AUTHORITY_CONTRACT_ALL_PASS assertions=${assertions}`);
}
