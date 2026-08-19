'use strict';

// Gomoku caller contract. Kernel/Broker suites prove the isolated modules;
// this suite proves that the game scheduler projects a canonical position,
// keeps the Worker path local-only and opt-in, does not silently truncate the
// legal move set, fences stale requests, and leaves the synchronous search /
// remote candidate path available as the fallback.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAME_PATH = path.join(ROOT, 'public', 'src', 'games', 'gomoku.js');
const KERNEL_PATH = path.join(ROOT, 'public', 'src', 'core', '18-board-ai-kernel.js');
const BROKER_PATH = path.join(ROOT, 'public', 'src', 'core', '19-board-ai-worker-broker.js');
const source = fs.readFileSync(GAME_PATH, 'utf8');
const Kernel = require(KERNEL_PATH);
const Broker = require(BROKER_PATH);

function check(label, predicate) {
  assert.strictEqual(Boolean(predicate), true, label);
  console.log('PASS  ' + label);
}

function compactPosition() {
  const board = Array.from({ length:15 }, () => Array(15).fill('.'));
  // Leave only 15 cells empty so the complete legal set fits the bounded
  // worker wire. The kernel intentionally validates occupancy/count parity,
  // not whether a historical sequence was tactically plausible.
  for (let index = 0; index < 210; index += 1) {
    const row = Math.floor(index / 15);
    const col = index % 15;
    board[row][col] = String(index % 2);
  }
  return {
    board: board.map(row => row.join('')).join('/'),
    last:'13,14',
    moves:210,
  };
}

function requestFromPosition(position, candidates) {
  return {
    requestId:'gomoku-qa-1',
    gameId:'gomoku',
    rulesVersion:'gomoku-local-v1',
    solverVersion:Kernel.SOLVER_VERSION,
    identity:'gomoku-local-scope',
    matchGeneration:8,
    turn:0,
    positionHash:Kernel.hashPosition('gomoku', 'gomoku-local-v1', position, 0),
    legalCandidates:candidates,
    difficulty:'easy',
    budgetMs:500,
    position,
  };
}

function runSourceContract() {
  check('Gomoku source has exact boardAIWorkerV1 gate', /opts\s*&&\s*opts\.technicalFeatures\s*&&\s*opts\.technicalFeatures\[name\]\s*===\s*true/.test(source) && /boardAIWorkerV1/.test(source));
  check('Worker gate excludes online and spectator', /gomokuBoardAIWorkerEnabled\(\)[\s\S]{0,600}!opts\.online\s*&&\s*!spectator/.test(source));
  check('canonical Gomoku position contains board/last/moves', /return\s*\{[\s\S]{0,220}board:\s*grid\.map[\s\S]{0,240}last:\s*last[\s\S]{0,100}moves:\s*hist\.length/.test(source));
  check('complete legal candidates are not silently sliced', /gomokuBoardAILegalCandidates[\s\S]{0,1300}candidates\.length\s*>\s*200\s*\?\s*null/.test(source) && !/allLegalChoices\s*=\s*gomokuBoardAILegalCandidates\(\)\.slice/.test(source));
  [
    'requestId', 'gameId', 'rulesVersion', 'solverVersion', 'identity',
    'matchGeneration', 'turn', 'positionHash', 'legalCandidates',
    'difficulty', 'budgetMs', 'position',
  ].forEach(field => check('Worker request includes ' + field, new RegExp('\\b' + field + '(?:\\s*:|\\s*,)').test(source)));
  check('request binds Gomoku rules version', /rulesVersion:GOMOKU_BOARD_AI_RULES/.test(source) && /GOMOKU_BOARD_AI_RULES\s*=\s*['"]gomoku-local-v1/.test(source));
  check('request binds numeric generation and turn', /matchGeneration:epoch/.test(source) && /turn:cur/.test(source));
  check('request uses kernel position hash', /kernel\.hashPosition\(\s*['"]gomoku['"]\s*,\s*GOMOKU_BOARD_AI_RULES/.test(source));
  check('no credential or player data crosses request', !/request\s*\(\s*\{[\s\S]{0,2400}(?:token|uid|username|password|chat|reward|coin|xp)\s*:/.test(source));
  check('worker result is candidate-ID mapped on main thread', /function gomokuBoardAIRanked\(result,\s*p\)[\s\S]{0,520}item\.id\.split\([\s\S]{0,220}gomokuCandidateDetails/.test(source));
  check('main thread validates coordinates before applyMove', /grid\[gpArr\[0\]\]\[gpArr\[1\]\]\s*!==\s*-1/.test(source) && /applyMove\(gpArr\[0\],\s*gpArr\[1\]\)/.test(source));
  check('cancel path fences active broker request', /function cancelAIWork\(\)[\s\S]{0,180}cancelGomokuBoardAI\(['"]cancel['"]\)/.test(source));
  check('reset cancels active broker request', /function resetLocal\(\)[\s\S]{0,100}cancelAIWork\(\)/.test(source));
  check('restore cancels active broker request', /function onRestore\([\s\S]{0,520}cancelGomokuBoardAI\(['"]restore['"]\)/.test(source));
  check('spectator transition cancels timer, broker and epoch through one seam', /function setSpectators\(value\)[\s\S]{0,260}!spectator\s*&&\s*nextSpectator[\s\S]{0,100}cancelAIWork\(\)/.test(source) && /function cancelAIWork\(\)[\s\S]{0,220}cancelGomokuBoardAI\(['"]cancel['"]\)[\s\S]{0,180}aiEpoch\+\+/.test(source));
  check('destroy disposes broker and worker', /destroy:\s*\(\)\s*=>\s*\{[\s\S]{0,320}disposeGomokuBoardAI\(\)/.test(source));
  check('legacy local/remote candidate path remains failure-only fallback', /let roots\s*=\s*gomokuBoardAIRanked\([\s\S]{0,180}if\s*\(!roots\.length\)[\s\S]{0,160}roots\s*=\s*gomokuRankCandidates\(cur,\s*profile\.roots\)/.test(source) && /const remoteChoice\s*=\s*await aiChoose\('gomoku'/.test(source));
  check('Worker opt-in does not run legacy deep search before the Broker result', source.indexOf('boardAIResult = await boardAI.request') < source.indexOf('roots = gomokuRankCandidates(cur, profile.roots)'));
}

async function runBrokerParity() {
  const position = compactPosition();
  const rows = position.board.split('/');
  const candidates = [];
  for (let row = 0; row < rows.length; row += 1) for (let col = 0; col < rows[row].length; col += 1) {
    if (rows[row][col] === '.') candidates.push(row + ',' + col);
  }
  const request = requestFromPosition(position, candidates);
  const solver = Kernel.create();
  const broker = Broker.create({
    enabled:true,
    workerOptIn:false,
    syncAdapter(input) {
      const solved = solver.solve(input);
      return solved.accepted ? { choiceId:solved.ranked[0].id, ranked:solved.ranked } : null;
    },
  });
  const result = await broker.request(request);
  check('canonical Gomoku request reaches synchronous Broker fallback', result.ok === true && result.source === 'sync' && candidates.includes(result.choiceId));
  check('Broker result remains candidate-only', result.ranked.every(item => Object.keys(item).sort().join(',') === 'id,score'));
  broker.dispose();
  solver.clear();
}

async function run() {
  runSourceContract();
  await runBrokerParity();
  console.log('BOARD_AI_GAME_GOMOKU_ALL_PASS');
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
