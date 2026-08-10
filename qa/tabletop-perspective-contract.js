'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');const ROOT=path.join(__dirname,'..');const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');let fail=0;
function check(name,ok){console.log((ok?'PASS  ':'FAIL  ')+name);if(!ok)fail++;}
const modulePath=path.join(ROOT,'public/src/games/00-tabletop-perspective.js');
check('pure tabletop perspective module exists',fs.existsSync(modulePath));
let api=null;if(fs.existsSync(modulePath)){const sandbox={globalThis:{},Object,Number,Math};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(modulePath,'utf8'),sandbox);api=sandbox.globalThis.TabletopPerspective;}
check('module exports frozen square and quarter-turn transforms',api&&Object.isFrozen(api)&&typeof api.squareCell==='function'&&typeof api.quarterPoint==='function'&&typeof api.nearQuarterTurns==='function');
if(api){
  const points=[[0,0],[0,14],[7,7],[14,0],[14,14]];check('15x15 half-turn is reversible and exact',points.every(([r,c])=>{const view=api.squareCell(15,r,c,2),logical=api.squareCell(15,view[0],view[1],2);return logical[0]===r&&logical[1]===c;}));
  const outside=api.squareCell(15,-1,7,2);check('out-of-board cells remain out of bounds instead of clamping to an edge',outside[0]===15&&outside[1]===7);
  check('every player pid maps its base to the same near quarter', [0,1,2,3].every(pid=>(pid+api.nearQuarterTurns(pid))%4===3));
  const p=[18,42],q=api.quarterPoint(100,p[0],p[1],1),back=api.quarterPoint(100,q[0],q[1],3);check('point quarter-turn is reversible',Math.abs(back[0]-p[0])<1e-8&&Math.abs(back[1]-p[1])<1e-8);
}
const gomoku=read('public/src/games/gomoku.js'),ludo=read('public/src/games/ludo.js'),utils=read('public/src/core/01-utils.js'),template=read('public/index-template.html'),build=read('scripts/build.js');
check('build loads perspective before game consumers',build.indexOf("'games/00-tabletop-perspective.js'")>=0&&build.indexOf("'games/00-tabletop-perspective.js'")<build.indexOf("'games/gomoku.js'"));
check('gomoku draw and pointer use inverse presentation mapping',/function gomokuViewCell/.test(gomoku)&&/function gomokuLogicalCell/.test(gomoku)&&/gomokuViewCell\(r,c\)/.test(gomoku)&&/gomokuLogicalCell\(view\[0\],view\[1\]\)/.test(gomoku));
check('gomoku rejects transformed non-integer and out-of-board input',/!Number\.isInteger\(r\) \|\| !Number\.isInteger\(c\) \|\| r < 0 \|\| r >= N \|\| c < 0 \|\| c >= N/.test(gomoku));
check('gomoku last-step presentation uses impact feedback instead of a red frame',/triggerMoveImpact/.test(gomoku)&&/drawMoveImpact/.test(gomoku)&&!/const mark = CELL\*\.2/.test(gomoku));
check('ludo keeps path-driven flight and capture impact presentation',/function animateTokenMove/.test(ludo)&&/ludo-flight-token/.test(ludo)&&/ludo-impact/.test(ludo)&&/movementPath\(from, dice\)/.test(ludo));
check('gomoku and ludo use a reduced-motion-safe camera entrance',/@keyframes tabletopCameraIn/.test(template)&&/#screen-game \.gomoku-board,#screen-game \.ludo-board/.test(template)&&/prefers-reduced-motion:reduce\)\{#screen-game \.gomoku-board/.test(template));
check('ludo 2/3/4-player standings feed the shared accessible podium',/podium: placement\.map/.test(ludo)&&/victory-podium/.test(utils)&&/victory_podium_label/.test(utils)&&/victory_podium_rank/.test(utils));
check('gomoku snapshots and wire moves remain logical',/opts\.sendMove\(\[r, c\]\)/.test(gomoku)&&/function snapshot\(\)/.test(gomoku)&&!/presentationHalfTurn/.test(gomoku.slice(gomoku.indexOf('function snapshot()'),gomoku.indexOf('function deserialize'))));
check('ludo geometry uses current viewer pid only for presentation',/const viewPid=.*pids\[Number\(opts\.myIdx\)\]/.test(ludo)&&/nearQuarterTurns\(viewPid\)/.test(ludo)&&/quarterPoint\(S/.test(ludo));
check('ludo logical token state and serialization exclude view rotation',!/viewQuarterTurns/.test(ludo.slice(ludo.indexOf('function snapshot()'),ludo.indexOf('function deserialize')))&&/tokens: tokens\.map/.test(ludo));
check('presentation code does not touch server, reward, replay or shared rules',!/(sendText|reward|Replay|moveLog|Supabase)/.test(fs.existsSync(modulePath)?fs.readFileSync(modulePath,'utf8'):''));
if(fail){console.error('TABLETOP_PERSPECTIVE_CONTRACT_FAILURES='+fail);process.exitCode=1;}else console.log('TABLETOP_PERSPECTIVE_CONTRACT_ALL_PASS');
