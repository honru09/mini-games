'use strict';

// Xiangqi caller contract.  Kernel/Broker suites prove the isolated modules;
// this suite proves that the game scheduler actually supplies the canonical
// wire, keeps the feature opt-in local-only, cancels stale work, and performs
// a second main-thread legality check before doMove().
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GAME_PATH = path.join(ROOT, 'public', 'src', 'games', 'xiangqi.js');
const KERNEL_PATH = path.join(ROOT, 'public', 'src', 'core', '18-board-ai-kernel.js');
const BROKER_PATH = path.join(ROOT, 'public', 'src', 'core', '19-board-ai-worker-broker.js');
const source = fs.readFileSync(GAME_PATH, 'utf8');
const Kernel = require(KERNEL_PATH);
const Broker = require(BROKER_PATH);

function check(label, predicate) {
  assert.strictEqual(Boolean(predicate), true, label);
  console.log('PASS  ' + label);
}

function initialPosition() {
  const board = Array.from({ length:10 }, () => Array(9).fill(null));
  const setup = [
    ['r','h','e','a','k','a','e','h','r'],
    [null,null,null,null,null,null,null,null,null],
    [null,'c',null,null,null,null,null,'c',null],
    ['p',null,'p',null,'p',null,'p',null,'p'],
    [null,null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null,null],
    ['p',null,'p',null,'p',null,'p',null,'p'],
    [null,'c',null,null,null,null,null,'c',null],
    [null,null,null,null,null,null,null,null,null],
    ['r','h','e','a','k','a','e','h','r'],
  ];
  for (let row = 0; row < 10; row += 1) for (let col = 0; col < 9; col += 1) {
    if (setup[row][col]) board[row][col] = { p: row < 5 ? 1 : 0, t: setup[row][col] };
  }
  return { board, lastMove:null, moveCount:0 };
}

function requestFromPosition(position, candidates) {
  return {
    requestId:'xq-qa-1',
    gameId:'xiangqi',
    rulesVersion:'xiangqi-rule-v2',
    solverVersion:Kernel.SOLVER_VERSION,
    identity:'xiangqi-local-scope',
    matchGeneration:4,
    turn:0,
    positionHash:Kernel.hashPosition('xiangqi', 'xiangqi-rule-v2', position, 0),
    legalCandidates:candidates,
    difficulty:'normal',
    budgetMs:190,
    position,
  };
}

function runSourceContract() {
  check('Xiangqi source has exact boardAIWorkerV1 gate', /opts\s*&&\s*opts\.technicalFeatures\s*&&\s*opts\.technicalFeatures\[name\]\s*===\s*true/.test(source) && /boardAIWorkerV1/.test(source));
  check('Worker gate excludes online and spectator', /BoardAIWorkerEnabled\(\)[\s\S]{0,600}!opts\.online\s*&&\s*!spectator/.test(source));
  check('canonical Xiangqi position contains board/lastMove/moveCount', /return\s*\{\s*board:\s*board\.map[\s\S]{0,300}lastMove:\s*lastMove[\s\S]{0,120}moveCount/.test(source));
  [
    'requestId', 'gameId', 'rulesVersion', 'solverVersion', 'identity',
    'matchGeneration', 'turn', 'positionHash', 'legalCandidates',
    'difficulty', 'budgetMs', 'position',
  ].forEach(field => check('Worker request includes ' + field, new RegExp('\\b' + field + '(?:\\s*:|\\s*,)').test(source)));
  check('request binds Xiangqi rules version', /rulesVersion:XIANGQI_BOARD_AI_RULES/.test(source) && /XIANGQI_BOARD_AI_RULES\s*=\s*['"]xiangqi-rule-v2/.test(source));
  check('request binds match generation and turn', /matchGeneration:gen/.test(source) && /turn:cur/.test(source));
  check('request uses kernel position hash', /kernel\.hashPosition\(\s*['"]xiangqi['"]\s*,\s*XIANGQI_BOARD_AI_RULES/.test(source));
  check('complete legal candidates are bounded without silent slicing', /allMoveByChoice\.size\s*<=\s*200/.test(source) && /legalCandidates\s*=\s*Array\.from\(allMoveByChoice\.keys\(\)\)/.test(source) && !/Array\.from\(allMoveByChoice\.keys\(\)\)\.slice/.test(source));
  check('no credential or player data crosses request', !/request\s*\(\s*\{[\s\S]{0,1800}(?:token|uid|username|password|chat|reward|coin|xp)\s*:/.test(source));
  check('worker result is candidate-ID mapped on main thread', /function xqBoardAIRanked\(result,\s*allMoveByChoice\)[\s\S]{0,360}allMoveByChoice\.get\(item\.id\)/.test(source));
  check('main thread performs legality check before doMove', /legalMovesOf\(cur,\s*xqMv\.from\[0\],\s*xqMv\.from\[1\]\)[\s\S]{0,700}doMove\(xqMv\.from,\s*xqMv\.to\)/.test(source));
  check('reset cancels active broker request', /function resetLocal\(\)[\s\S]{0,100}cancelXiangqiBoardAI\(['"]reset['"]\)/.test(source));
  check('restore cancels active broker request', /function onRestore\([\s\S]{0,260}cancelXiangqiBoardAI\(['"]restore['"]\)/.test(source));
  check('spectator transition cancels and epoch-fences all pending AI work', /function setSpectators\(value\)[\s\S]{0,320}!spectator\s*&&\s*nextSpectator[\s\S]{0,180}cancelXiangqiBoardAI\(['"]spectator['"]\)[\s\S]{0,120}aiEpoch\+\+[\s\S]{0,100}aiPending\s*=\s*false/.test(source));
  check('destroy disposes broker and worker', /destroy:\s*\(\)\s*=>\s*\{\s*disposeXiangqiBoardAI\(\)/.test(source));
  check('caller synchronous fallback reuses shared Kernel.create solver', /if\s*\(!xiangqiBoardAISyncSolver\)\s*xiangqiBoardAISyncSolver\s*=\s*Kernel\.create\(\)[\s\S]{0,220}xiangqiBoardAISyncSolver\.solve\(request\)/.test(source));
  check('caller dispose clears the synchronous TT solver', /syncAdapter\.clear\s*=\s*\(\)\s*=>[\s\S]{0,300}xiangqiBoardAISyncSolver\s*=\s*null/.test(source) && /disposeXiangqiBoardAI\(\)[\s\S]{0,500}xiangqiBoardAISyncSolver\s*=\s*null/.test(source));
  check('legacy synchronous search remains failure-only fallback', /let ranked\s*=\s*xqBoardAIRanked\([\s\S]{0,180}if\s*\(!ranked\.length\)\s*ranked\s*=\s*xqSearchRoot\(cur,\s*difficulty\)/.test(source) && /const remoteChoice\s*=\s*await aiChoose\('xiangqi'/.test(source));
  check('Worker opt-in does not run legacy deep search before the Broker result', source.indexOf('boardAIResult = await boardAI.request') < source.indexOf('ranked = xqSearchRoot(cur, difficulty)'));
}

async function runBrokerParity() {
  const position = initialPosition();
  // A legal opening move generated by the shared kernel is enough to prove
  // that the caller's canonical projection is accepted by the real Broker.
  const candidates = ['6,0>5,0', '6,2>5,2', '7,1>0,1'];
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
  check('canonical Xiangqi request reaches synchronous Broker fallback', result.ok === true && result.source === 'sync' && candidates.includes(result.choiceId));
  check('Broker result remains candidate-only', result.ranked.every(item => Object.keys(item).sort().join(',') === 'id,score'));
  broker.dispose();
  solver.clear();
}

async function run() {
  runSourceContract();
  await runBrokerParity();
  console.log('BOARD_AI_GAME_XIANGQI_ALL_PASS');
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
