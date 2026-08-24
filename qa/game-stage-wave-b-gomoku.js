'use strict';

// Wave B is presentation-only. This contract intentionally runs Gomoku in a
// tiny DOM so the new visual seam cannot accidentally alter its rule model,
// socket contract, or lifecycle cleanup.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'gomoku.js'), 'utf8');
const GomokuRules=require('../shared/rules/gomoku');
let failures = 0;
function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

function createNode(tag) {
  const classes = new Set();
  const listeners = new Map();
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [], parentNode: null, dataset: {}, attributes: {}, textContent: '',
    style: {
      setProperty(key, value) { this[key] = String(value); },
      removeProperty(key) { delete this[key]; },
    },
    appendChild(child) {
      if (!child) return child;
      if (child.parentNode && typeof child.parentNode.removeChild === 'function') child.parentNode.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      if (child) child.parentNode = null;
      return child;
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    dispatch(type, event) { (listeners.get(type) || []).forEach(handler => handler(event || {})); },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 520, height: 520 }; },
  };
  Object.defineProperty(node, 'className', {
    get() { return [...classes].join(' '); },
    set(value) { classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(item => classes.add(item)); },
  });
  node.classList = {
    add(...items) { items.forEach(item => classes.add(item)); },
    remove(...items) { items.forEach(item => classes.delete(item)); },
    contains(item) { return classes.has(item); },
    toggle(item, force) { const next = force === undefined ? !classes.has(item) : !!force; if (next) classes.add(item); else classes.delete(item); return next; },
  };
  if (node.tagName === 'CANVAS') {
    const context = {
      setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, save() {}, restore() {}, clip() {}, fillRect() {}, setLineDash() {},
      createRadialGradient() { return { addColorStop() {} }; },
    };
    node.getContext = () => context;
  }
  return node;
}

function findByClass(root, className) {
  if (!root) return null;
  if (root.classList && root.classList.contains(className)) return root;
  for (const child of root.children || []) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

function contextState(moves,matchId,revision,lastSeq){
  let state=GomokuRules.createInitialState();
  moves.forEach((move,index)=>{const applied=GomokuRules.applyAction(state,{type:'place',row:move[0],col:move[1]},index%2);if(!applied.ok)throw new Error('invalid authority fixture');state=applied.state;});
  return{protocol:'gomoku-rule-v1',matchId,revision,serverNow:1,board:state.board,current:state.current,moveNumber:state.moveNumber,last:state.last,terminal:state.terminal,winner:state.winner,reason:state.reason,winLine:state.winLine,history:moves.map((move,index)=>({player:index%2,row:move[0],col:move[1],seq:Math.floor(index/2)+1})),lastSeq:lastSeq.slice(),hash:GomokuRules.hashState(state)};
}

function run(flag, options) {
  options = options || {};
  const area = createNode('div');
  const extra = createNode('div');
  const outcomes = [];
  let timers = 0;
  const localStorage = {
    getItem() {
      if (options.storageThrows) throw new Error('storage blocked');
      return flag;
    },
  };
  const window = { devicePixelRatio: 1, localStorage };
  const sandbox = {
    console, window, document: { createElement: createNode }, Date, Math, Number, String, Array, Object, Set, Map, JSON, Promise,
    setTimeout() { timers++; return timers; }, clearTimeout() {},
    el(tag, className, text) { const node = createNode(tag); node.className = className || ''; if (text !== undefined) node.textContent = String(text); return node; },
    t(key, ...args) { return key + (args.length ? ':' + args.join(',') : ''); },
    gameArtEnabled() { return false; }, stickerArtEnabled() { return false; }, tabletopArtEnabled() { return false; },
    prefersReducedMotion() { return !!options.reducedMotion; }, playFeedback() {}, setStatus() {}, renderPlayers() {}, aiChoose: async () => null, aiSpeak() {},
    GomokuRules,
    online: { room: null, isHost: false }, toast() {}, showVictoryOverlay(_area, value) { outcomes.push(value || null); }, shareGameLink() {}, openInvitePicker() {},
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(SOURCE, context, { filename: 'gomoku.js' });
  const instance = context.gameGomoku(area, extra, 2, options.gameOptions || {});
  return { area, extra, instance, outcomes, canvas:findByClass(area,'gomoku-board'), timers: () => timers };
}

// Red-light source contract. The exact state values are intentionally stable
// so shared CSS can be developed separately without becoming a rule consumer.
check('Wave B resolves its own safe local flag', /function gomokuWaveBEnabled\(\)/.test(SOURCE) && /mg_art_game_stage_wave_b_v1/.test(SOURCE));
check('Wave B has a stable arena, frame, status and last-move seam', ['gomoku-wave-b-stage', 'gomoku-wave-b-arena', 'gomoku-wave-b-board-frame', 'gomoku-wave-b-meta', 'gomoku-wave-b-state', 'gomoku-wave-b-last-move', 'gomoku-wave-b-board'].every(token => SOURCE.includes(token)));
check('Wave B keeps its state out of the rule snapshot', !/function snapshot\(\)\{[^}]*gomokuWaveB/.test(SOURCE));
check('Wave B cleanup is part of the normal destroy lifecycle', /destroy:\s*\(\)\s*=>\s*\{[\s\S]*releaseGomokuWaveBPresentation\(\)/.test(SOURCE));
check('Gomoku win and draw outcomes expose the shared Games exit seam',
  (SOURCE.match(/onBackToGames\s*:/g) || []).length >= 2 &&
  /setAppRoute\('games',\s*\{\s*reason:'outcome_games'\s*\}\)/.test(SOURCE));

try {
  const active = run(null);
  const stage = findByClass(active.area, 'gomoku-wave-b-stage');
  const frame = findByClass(active.area, 'gomoku-wave-b-board-frame');
  const meta = findByClass(active.area, 'gomoku-wave-b-meta');
  const state = findByClass(active.area, 'gomoku-wave-b-state');
  const lastMove = findByClass(active.area, 'gomoku-wave-b-last-move');
  const board = findByClass(active.area, 'gomoku-wave-b-board');
  check('default flag mounts a compact Wave B board stage', !!stage && !!frame && !!meta && !!state && !!lastMove && !!board && board.parentNode === frame && board.dataset.gridSize === '15' && active.area.classList.contains('gomoku-wave-b-arena'));
  check('empty board exposes a neutral last-move value and a localized turn state', lastMove && lastMove.textContent === '—' && state && state.textContent === 'player_turn:1' && stage.dataset.gomokuPhase === 'turn-1');
  active.instance.onMove([7, 7], 0);
  const snapshot = active.instance.snapshot();
  check('a move updates only presentation metadata and preserves the snapshot contract', lastMove.textContent === 'H8' && stage.dataset.gomokuPhase === 'turn-2' && board.dataset.lastMove === 'H8' && JSON.stringify(snapshot) === JSON.stringify({ hist: [[7, 7]], cur: 1, over: false, last: [7, 7] }));
  const terminal = run(null, { reducedMotion: true });
  [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2],[0,3],[1,3],[0,4]].forEach(move => terminal.instance.onMove(move, 0));
  check('Gomoku win publishes a disposable outcome with a Games exit callback', terminal.outcomes.length === 1 && terminal.outcomes[0] && typeof terminal.outcomes[0].onBackToGames === 'function');
  terminal.instance.destroy();
  active.instance.destroy();
  check('destroy removes the Wave B wrapper and stale flag class', !findByClass(active.area, 'gomoku-wave-b-stage') && !active.area.classList.contains('gomoku-wave-b-arena') && active.area.children.length === 1 && active.area.children[0].classList.contains('gomoku-board'));

  const rollback = run('0');
  check("exact '0' strictly retains the old direct-canvas Wave A DOM", !findByClass(rollback.area, 'gomoku-wave-b-stage') && rollback.area.children.length === 1 && rollback.area.children[0].classList.contains('gomoku-board') && !rollback.area.classList.contains('gomoku-wave-b-arena'));
  rollback.instance.destroy();
  const unknown = run('unexpected');
  check("only exact '0' rolls back; other stored values keep the default Wave B", !!findByClass(unknown.area, 'gomoku-wave-b-stage') && unknown.area.classList.contains('gomoku-wave-b-arena'));
  unknown.instance.destroy();
  const blocked = run(null, { storageThrows: true });
  check('storage access failure fails closed to Wave A', !findByClass(blocked.area, 'gomoku-wave-b-stage') && !blocked.area.classList.contains('gomoku-wave-b-arena'));
  blocked.instance.destroy();
  const reduced = run(null, { reducedMotion: true });
  reduced.instance.onMove([7, 7], 0);
  check('reduced-motion move keeps Wave B status static and starts no presentation timer', reduced.timers() === 0 && findByClass(reduced.area, 'gomoku-wave-b-last-move').textContent === 'H8');
  reduced.instance.destroy();

  const authorityActions=[],authorityEnds=[];
  const authority=run(null,{gameOptions:{online:true,myIdx:0,gameplayMeta:{protocol:'gomoku-rule-v1',revision:0},matchId:'authority-match',getMatchId:()=> 'authority-match',sendGomokuAction:action=>authorityActions.push(action),sendRestart(){},onEnd:result=>authorityEnds.push(result)}});
  authority.canvas.dispatch('click',{clientX:260,clientY:260});authority.canvas.dispatch('click',{clientX:260,clientY:260});
  check('Gomoku Authority Client：点击只发送一次 pending 动作且不乐观改盘',authorityActions.length===1&&authorityActions[0].seq===1&&authority.instance.snapshot().hist.length===0);
  authority.instance.onGomokuRuleError('ERR_INVALID_STATE');authority.canvas.dispatch('click',{clientX:260,clientY:260});
  check('Gomoku Authority Client：权威错误释放输入 pending 并推进客户端序号',authorityActions.length===2&&authorityActions[1].seq===2&&authority.instance.snapshot().hist.length===0);
  const authorityState=contextState([[7,7]],'authority-match',1,[2,0]);
  check('Gomoku Authority Client：匹配权威快照到达后才更新棋盘',authority.instance.onGomokuRuleState(authorityState,'live')===true&&JSON.stringify(authority.instance.snapshot().hist)===JSON.stringify([[7,7]]));
  const stale={...authorityState,board:authorityState.board.map(row=>row.slice())};stale.board[0][0]=1;
  check('Gomoku Authority Client：重复 Revision 与错误 matchId 快照均 fail-closed',authority.instance.onGomokuRuleState(stale,'live')===false&&authority.instance.onGomokuRuleState({...authorityState,revision:2,matchId:'other-match'},'live')===false&&authority.instance.snapshot().hist.length===1);
  const malformedSeq={...authorityState,revision:2,lastSeq:['2',0]};
  const malformedHistory={...authorityState,revision:2,lastSeq:[2,0],history:authorityState.history.map((item,index)=>({...item,seq:index===0?0:item.seq}))};
  check('Gomoku Authority Client：非数值 Last Seq 与畸形历史序号均 fail-closed',authority.instance.onGomokuRuleState(malformedSeq,'live')===false&&authority.instance.onGomokuRuleState(malformedHistory,'live')===false&&authority.instance.snapshot().hist.length===1);
  const terminalState=contextState([[7,7],[0,0],[7,8],[0,1],[7,9],[0,2],[7,10],[0,3],[7,11]],'authority-match',9,[5,4]);
  check('Gomoku Authority Client：服务端终局快照不会重新提交客户端 result claim',authority.instance.onGomokuRuleState(terminalState,'live')===true&&authority.instance.snapshot().over===true&&authorityEnds.length===0);
  authority.instance.destroy();
} catch (error) {
  check('Wave B Gomoku runtime matrix executes', false, error && error.stack || String(error));
}

if (failures) {
  console.error('GAME_STAGE_WAVE_B_GOMOKU_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('GAME_STAGE_WAVE_B_GOMOKU_ALL_PASS');
}
