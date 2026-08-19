'use strict';

/*
 * T4 BoardAIKernel contract tests.  The test crosses the Module's public
 * Seam only; the search implementation remains replaceable by the Worker
 * Adapter without changing these assertions.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Kernel = require('../public/src/core/18-board-ai-kernel.js');
const kernelSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'src', 'core', '18-board-ai-kernel.js'), 'utf8');

const failures = [];
function check(name, condition, detail) {
  try {
    assert.ok(condition, detail || name);
    console.log('PASS  ' + name);
  } catch (error) {
    failures.push(name);
    console.log('FAIL  ' + name + (detail ? ' :: ' + detail : ' :: ' + error.message));
  }
}

function emptyXiangqiBoard() {
  return Array.from({ length: 10 }, () => Array(9).fill(null));
}

function initialXiangqi() {
  const board = emptyXiangqiBoard();
  const top = ['r', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'r'];
  const bottom = ['r', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'r'];
  top.forEach((t, c) => { board[0][c] = { p: 1, t }; });
  bottom.forEach((t, c) => { board[9][c] = { p: 0, t }; });
  board[2][1] = { p: 1, t: 'c' }; board[2][7] = { p: 1, t: 'c' };
  board[7][1] = { p: 0, t: 'c' }; board[7][7] = { p: 0, t: 'c' };
  for (const c of [0, 2, 4, 6, 8]) { board[3][c] = { p: 1, t: 'p' }; board[6][c] = { p: 0, t: 'p' }; }
  return { board, lastMove: null, moveCount: 0 };
}

function gomokuPosition(moves) {
  const board = Array.from({ length: 15 }, () => Array(15).fill('.'));
  for (const [r, c, p] of moves || []) board[r][c] = String(p);
  return { board: board.map(row => row.join('')).join('/'), last: moves && moves.length ? moves[moves.length - 1].slice(0, 2).join(',') : null, moves: (moves || []).length };
}

function req(solver, input) {
  const positionHash = Kernel.hashPosition(input.gameId, input.rulesVersion, input.position, input.turn);
  return solver.solve({
    requestId: input.requestId || 'qa-request',
    gameId: input.gameId,
    rulesVersion: input.rulesVersion,
    solverVersion: Kernel.SOLVER_VERSION,
    identity: input.identity || 'qa-scope',
    matchGeneration: input.matchGeneration === undefined ? 1 : input.matchGeneration,
    turn: input.turn,
    positionHash,
    position: input.position,
    legalCandidates: input.legalCandidates,
    difficulty: input.difficulty || 'hard',
    budgetMs: input.budgetMs === undefined ? 500 : input.budgetMs,
  }, input.runtime);
}

const solver = Kernel.create();
check('Kernel exposes fixed solver, rule and opening-book versions', Kernel.SOLVER_VERSION === 'board-ai-kernel-v1' && Kernel.OPENING_BOOK_VERSION === 'board-opening-book-v1' && Kernel.RULE_VERSIONS.includes('xiangqi-rule-v2') && Kernel.RULE_VERSIONS.includes('gomoku-local-v1'));
check('bounded TT is hard capped at 4096', Kernel.LIMITS && Kernel.LIMITS.maxTTEntries <= 4096);
check('TT key binds identity, rules, solver, book and match generation', /request\.identity[\s\S]{0,220}request\.rulesVersion[\s\S]{0,220}SOLVER_VERSION[\s\S]{0,220}OPENING_BOOK_VERSION[\s\S]{0,220}request\.matchGeneration/.test(kernelSource));
check('opening book metadata binds book, solver, rules and source before lookup', /metadata:freeze\([\s\S]{0,420}bookVersion:OPENING_BOOK_VERSION[\s\S]{0,180}solverVersion:SOLVER_VERSION[\s\S]{0,220}xiangqi:'xiangqi-rule-v2'[\s\S]{0,120}gomoku:'gomoku-local-v1'[\s\S]{0,180}source:'internal-deterministic-seed-v1'/.test(kernelSource) && /function openingBookMove\(request\)[\s\S]{0,520}metadata\.rulesVersions\[request\.gameId\]\s*!==\s*request\.rulesVersion/.test(kernelSource));

const xqInitial = initialXiangqi();
const xqHashA = Kernel.hashPosition('xiangqi', 'xiangqi-rule-v2', xqInitial, 0);
const xqHashB = Kernel.hashPosition('xiangqi', 'xiangqi-rule-v2', xqInitial, 0);
check('Xiangqi fixed-table hash is deterministic', xqHashA === xqHashB && /^xq-v1-[0-9a-f]{8}$/.test(xqHashA));
check('Xiangqi hash binds turn', xqHashA !== Kernel.hashPosition('xiangqi', 'xiangqi-rule-v2', xqInitial, 1));

const xqCandidates = ['6,0>5,0', '6,2>5,2', '7,1>0,1'];
const xqResult = req(solver, { gameId: 'xiangqi', rulesVersion: 'xiangqi-rule-v2', position: xqInitial, turn: 0, legalCandidates: xqCandidates, requestId: 'xq-book' });
check('Xiangqi solve accepts legal candidates', xqResult.accepted === true && xqResult.gameId === 'xiangqi' && xqResult.rulesVersion === 'xiangqi-rule-v2');
check('Xiangqi ranked result contains only id and finite score', xqResult.ranked.length > 0 && xqResult.ranked.length <= 40 && xqResult.ranked.every(row => Object.keys(row).sort().join(',') === 'id,score' && xqCandidates.includes(row.id) && Number.isFinite(row.score)));
check('Xiangqi opening book is deterministic when its move is supplied', xqResult.source === 'opening-book' && xqResult.ranked[0].id === '6,0>5,0');
check('Xiangqi result echoes request binding', xqResult.requestId === 'xq-book' && xqResult.matchGeneration === 1 && xqResult.turn === 0 && xqResult.positionHash === xqHashA && xqResult.solverVersion === Kernel.SOLVER_VERSION);

const xqTacticalBoard = emptyXiangqiBoard();
xqTacticalBoard[0][4] = { p: 1, t: 'k' }; xqTacticalBoard[9][4] = { p: 0, t: 'k' };
xqTacticalBoard[5][4] = { p: 1, t: 'h' }; // keeps the two generals separated
xqTacticalBoard[5][0] = { p: 0, t: 'r' }; xqTacticalBoard[5][1] = { p: 1, t: 'r' };
const xqTactical = req(solver, { gameId: 'xiangqi', rulesVersion: 'xiangqi-rule-v2', position: { board: xqTacticalBoard, lastMove: null, moveCount: 4 }, turn: 0, legalCandidates: ['5,0>5,1', '9,4>8,4'], requestId: 'xq-search' });
check('Xiangqi deterministic search prefers a legal high-value capture', xqTactical.accepted === true && xqTactical.source === 'search' && xqTactical.ranked[0].id === '5,0>5,1');

const xqFacingBoard = emptyXiangqiBoard();
xqFacingBoard[0][4] = { p: 1, t: 'k' }; xqFacingBoard[9][4] = { p: 0, t: 'k' };
xqFacingBoard[5][4] = { p: 0, t: 'r' };
const xqFacing = req(solver, { gameId: 'xiangqi', rulesVersion: 'xiangqi-rule-v2', position: { board: xqFacingBoard, lastMove: null, moveCount: 6 }, turn: 0, legalCandidates: ['5,4>4,4', '5,4>5,3'], requestId: 'xq-facing' });
check('Xiangqi candidate exposing facing generals fails closed', xqFacing.accepted === false && xqFacing.reason === 'unknown_candidate');

const xqBad = req(solver, { gameId: 'xiangqi', rulesVersion: 'xiangqi-rule-v2', position: xqInitial, turn: 0, legalCandidates: ['6,0>5,0', '99,99>0,0'], requestId: 'xq-bad' });
check('Xiangqi unknown candidate fails closed', xqBad.accepted === false && xqBad.reason === 'unknown_candidate');
const xqOversized = req(solver, { gameId: 'xiangqi', rulesVersion: 'xiangqi-rule-v2', position: xqInitial, turn: 0, legalCandidates: Array.from({ length: 201 }, (_, i) => String(i) + ',0>0,0'), requestId: 'xq-large' });
check('oversized candidate list fails closed', xqOversized.accepted === false && xqOversized.reason === 'too_many_candidates');

const winPosition = gomokuPosition([[7, 3, 0], [0, 0, 1], [7, 4, 0], [0, 1, 1], [7, 5, 0], [1, 1, 1], [7, 6, 0], [2, 2, 1]]);
const winResult = req(solver, { gameId: 'gomoku', rulesVersion: 'gomoku-local-v1', position: winPosition, turn: 0, legalCandidates: ['7,7', '6,7', '8,7'], requestId: 'gomoku-win' });
check('Gomoku immediate win is selected', winResult.accepted === true && winResult.ranked[0].id === '7,7');
check('Gomoku output scores are finite', winResult.ranked.every(row => Number.isFinite(row.score)));

const blockPosition = gomokuPosition([[7, 0, 1], [0, 0, 0], [7, 1, 1], [1, 2, 0], [7, 2, 1], [2, 4, 0], [7, 3, 1], [3, 6, 0]]);
const blockResult = req(solver, { gameId: 'gomoku', rulesVersion: 'gomoku-local-v1', position: blockPosition, turn: 0, legalCandidates: ['7,4', '6,7', '8,7'], requestId: 'gomoku-block' });
check('Gomoku unique immediate loss block is selected', blockResult.accepted === true && blockResult.ranked[0].id === '7,4');

const cancelResult = req(solver, { gameId: 'gomoku', rulesVersion: 'gomoku-local-v1', position: gomokuPosition([[7, 7, 0]]), turn: 1, legalCandidates: ['7,8', '8,7'], budgetMs: 500, runtime: { isCancelled: () => true } });
check('cancel check fails closed', cancelResult.accepted === false && cancelResult.reason === 'cancelled');
let nestedCancelChecks = 0;
const nestedCancelResult = req(Kernel.create(), { gameId: 'xiangqi', rulesVersion: 'xiangqi-rule-v2', position: { board: xqTacticalBoard, lastMove: null, moveCount: 4 }, turn: 0, legalCandidates: ['5,0>5,1', '9,4>8,4'], budgetMs: 500, requestId: 'xq-nested-cancel', runtime: { isCancelled: () => ++nestedCancelChecks >= 6 } });
check('second-layer cancellation propagates without another sibling search', nestedCancelResult.accepted === false && nestedCancelResult.reason === 'cancelled' && nestedCancelChecks === 6);
let now = 0;
const timeoutResult = req(solver, { gameId: 'gomoku', rulesVersion: 'gomoku-local-v1', position: gomokuPosition([[7, 7, 0]]), turn: 1, legalCandidates: ['7,8', '8,7'], budgetMs: 1, runtime: { now: () => (now += 2) } });
check('deadline check fails closed before search', timeoutResult.accepted === false && timeoutResult.reason === 'timeout');
let nestedNowChecks = 0;
const nestedTimeoutResult = req(Kernel.create(), { gameId: 'xiangqi', rulesVersion: 'xiangqi-rule-v2', position: { board: xqTacticalBoard, lastMove: null, moveCount: 4 }, turn: 0, legalCandidates: ['5,0>5,1', '9,4>8,4'], budgetMs: 500, requestId: 'xq-nested-timeout', runtime: { now: () => (++nestedNowChecks >= 7 ? 1000 : 0) } });
check('second-layer timeout propagates without another sibling search', nestedTimeoutResult.accepted === false && nestedTimeoutResult.reason === 'timeout' && nestedNowChecks === 7);
const cleanAfterAbort = req(solver, { gameId: 'xiangqi', rulesVersion: 'xiangqi-rule-v2', position: { board: xqTacticalBoard, lastMove: null, moveCount: 4 }, turn: 0, legalCandidates: ['5,0>5,1', '9,4>8,4'], requestId: 'xq-clean-after-abort', matchGeneration: 2 });
check('clean request after nested abort is not polluted by TT', cleanAfterAbort.accepted === true && cleanAfterAbort.ranked[0].id === '5,0>5,1');

const malformed = solver.solve({ gameId: 'gomoku', rulesVersion: 'gomoku-local-v1', solverVersion: Kernel.SOLVER_VERSION, position: { board: 'bad', last: null, moves: 0 }, legalCandidates: ['7,7'], turn: 0, positionHash: 'gomoku-v1-00000000', requestId: 'malformed', identity: 'qa', matchGeneration: 1, difficulty: 'normal', budgetMs: 100 });
check('malformed canonical position fails closed', malformed.accepted === false && malformed.reason === 'invalid_position');

if (failures.length) {
  console.error('BOARD_AI_KERNEL_HAS_FAILURES=' + failures.length);
  process.exitCode = 1;
} else {
  console.log('BOARD_AI_KERNEL_ALL_PASS');
}
