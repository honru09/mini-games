'use strict';

// Wave B is presentation-only.  This contract drives the public game factory
// and inspects the DOM it owns; it never reaches into the Tetris rule state.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const UTILS = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '01-utils.js'), 'utf8');
const TETRIS = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tetris.js'), 'utf8');
let failures = 0;

function check(name, value, detail){
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

function makeElement(tag){
  const classes = new Set();
  const node = {
    tagName:String(tag || 'div').toUpperCase(), children:[], parent:null, style:{}, dataset:{}, attributes:{}, textContent:'',
    clientWidth:560, clientHeight:560, width:0, height:0, _listeners:{},
    appendChild(child){ if (child){ child.parent = this; this.children.push(child); } return child; },
    remove(){ if (!this.parent) return; const index = this.parent.children.indexOf(this); if (index >= 0) this.parent.children.splice(index, 1); this.parent = null; },
    setAttribute(key, value){ this.attributes[key] = String(value); if (String(key).startsWith('data-')) this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); },
    getAttribute(key){ return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    removeAttribute(key){ delete this.attributes[key]; if (String(key).startsWith('data-')) delete this.dataset[String(key).slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; },
    addEventListener(type, listener){ (this._listeners[type] = this._listeners[type] || []).push(listener); },
    removeEventListener(){},
    getBoundingClientRect(){ return { left:0, top:0, width:520, height:520 }; },
    querySelector(selector){ return query(this, selector, false); },
    querySelectorAll(selector){ return query(this, selector, true); },
  };
  Object.defineProperty(node, 'innerHTML', { get(){ return ''; }, set(_value){ this.children.forEach(child => { child.parent = null; }); this.children = []; } });
  Object.defineProperty(node, 'className', { get(){ return [...classes].join(' '); }, set(value){ classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(item => classes.add(item)); } });
  node.classList = {
    add(...items){ items.forEach(item => classes.add(item)); },
    remove(...items){ items.forEach(item => classes.delete(item)); },
    contains(item){ return classes.has(item); },
    toggle(item, force){ const on = force === undefined ? !classes.has(item) : !!force; if (on) classes.add(item); else classes.delete(item); return on; },
  };
  return node;
}

function matches(node, selector){
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  const data = /^\[data-([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (data){
    const key = data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return Object.prototype.hasOwnProperty.call(node.dataset, key) && (data[2] === undefined || node.dataset[key] === data[2]);
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function query(root, selector, all){
  const found = [], queue = (root.children || []).slice();
  while (queue.length){
    const node = queue.shift();
    if (matches(node, selector)){ if (!all) return node; found.push(node); }
    queue.push(...(node.children || []));
  }
  return all ? found : null;
}

function createHarness(storage){
  const area = makeElement('div');
  const extra = makeElement('div');
  const documentListeners = {};
  const document = {
    body:makeElement('body'), documentElement:makeElement('html'), createElement:makeElement,
    getElementById(){ return null; }, querySelectorAll(){ return []; },
    addEventListener(type, listener){ (documentListeners[type] = documentListeners[type] || []).push(listener); },
    removeEventListener(){},
  };
  const sandbox = {
    console, JSON, Date, Map, Set, Array, Number, String, Boolean, Object, Math, document, localStorage:storage,
    navigator:{maxTouchPoints:0}, location:{protocol:'http:',host:'localhost:8080'}, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch:async(_url, init) => ({ ok:true, status:200, json:async() => ({ choice:JSON.parse(String(init && init.body || '{}')).options?.[0] }) }),
  };
  sandbox.globalThis = sandbox;
  sandbox.window = { devicePixelRatio:1, location:sandbox.location, matchMedia:() => ({ matches:false }) };
  const context = vm.createContext(sandbox);
  vm.runInContext(UTILS, context, { filename:'01-utils.js' });
  vm.runInContext(`
    function t(key,...args){ return String(key)+(args.length?'('+args.join(',')+')':''); }
    function renderPlayers(){} function setStatus(){} function resolveServer(){ return ''; }
    function aiPersonaMove(length,best){ return Math.max(0,Math.min(length-1,best)); }
    function shareGameLink(){} function showVictoryOverlay(){} const account={authToken:'qa'}; const online={room:null,isHost:false};
  `, context);
  vm.runInContext(TETRIS, context, { filename:'tetris.js' });
  context.__area = area; context.__extra = extra;
  const game = vm.runInContext("gameTetris(__area,__extra,2,{ai:new Set(),online:false,myIdx:0,isHost:true,onEnd(){},sendMove(){},sendRestart(){},isReplaying(){return false;}})", context);
  return { area, extra, game };
}

function storage(value, throws){
  return { getItem(){ if (throws) throw new Error('blocked'); return value; } };
}

function run(){
  let h = createHarness(storage(null));
  const initialLayout = h.area.querySelector('.tetris-battle-layout');
  const initialWell = h.area.querySelector('.main-board');
  check('Wave B 默认开启并在 Arena 声明稳定 presentation stage', !!initialLayout && h.area.classList.contains('tetris-wave-b') && initialLayout.classList.contains('tetris-wave-b-layout') && initialLayout.dataset.tetrisStage === 'wave-b');
  check('Wave B 把主井、预览与对手区分为独立可样式化区域', !!h.area.querySelector('[data-tetris-region="main-well"]') && !!h.area.querySelector('[data-tetris-region="preview"]') && !!h.area.querySelector('[data-tetris-region="opponents"]'));
  const previewRoles = h.area.querySelectorAll('[data-tetris-preview]').map(node => node.dataset.tetrisPreview).sort();
  check('Wave B 把 Hold、Next 与垃圾预警拆成独立预览状态', JSON.stringify(previewRoles) === JSON.stringify(['hold','incoming','next']));
  const controls = h.extra.querySelectorAll('[data-tetris-control]').map(node => node.dataset.tetrisControl);
  check('Wave B 保留七项操作并给每项稳定控制语义', JSON.stringify(controls) === JSON.stringify(['left','right','rotate-ccw','rotate-cw','soft-drop','hold','hard-drop']));
  const snapshot = h.game.snapshot();
  check('Wave B 不改变本地 18×10 快照结构或写入表现标记', snapshot.wells.length === 2 && snapshot.wells.every(well => well.length === 18 && well.every(row => row.length === 10)) && !/tetris-wave-b|tetrisStage|game_stage_wave_b/i.test(JSON.stringify(snapshot)));
  snapshot.states[0].score = 321; snapshot.states[0].lines = 9; snapshot.states[0].hold = 3;
  const restored = h.game.onRestore(snapshot);
  const scoreSeam = h.area.querySelector('[data-tetris-region="score"]');
  const previewSeam = h.area.querySelector('[data-tetris-region="preview"]');
  check('Wave B 以 DOM data seam 更新主井 HUD 与 Hold/Next 状态，不改变快照结构', restored === true && scoreSeam.dataset.tetrisScore === '321' && scoreSeam.dataset.tetrisLines === '9' && previewSeam.dataset.tetrisHold === 'L' && typeof previewSeam.dataset.tetrisNext === 'string');
  check('同一 Wave B 状态刷新保持布局、主井与控制节点 identity', h.area.querySelector('.tetris-battle-layout') === initialLayout && h.area.querySelector('.main-board') === initialWell && h.extra.querySelectorAll('[data-tetris-control]').length === 7);
  h.game.destroy();
  check('destroy 清理 Wave B 临时根标记并保留现有输入清理', !h.area.classList.contains('tetris-wave-b'));

  h = createHarness(storage('0'));
  check('精确字符串 0 严格回退 Wave A DOM，而不影响规则快照', !h.area.classList.contains('tetris-wave-b') && !h.area.querySelector('.tetris-wave-b-layout') && h.extra.querySelectorAll('[data-tetris-control]').length === 0 && h.game.snapshot().wells.every(well => well.length === 18));
  h.game.destroy();

  h = createHarness(storage('unexpected'));
  check("只有精确字符串 0 回退；其他存储值保持默认 Wave B", h.area.classList.contains('tetris-wave-b') && !!h.area.querySelector('.tetris-wave-b-layout'));
  h.game.destroy();

  const toggleStorage = { value:null, getItem(){ return this.value; } };
  h = createHarness(toggleStorage); toggleStorage.value = '0'; h.game.renderCosmetic({});
  const rolledBack = !h.area.classList.contains('tetris-wave-b') && !h.area.querySelector('.tetris-wave-b-layout') && h.extra.querySelectorAll('[data-tetris-control]').length === 0;
  toggleStorage.value = '1'; h.game.renderCosmetic({});
  check('运行中精确 0 回退且恢复后只重建表现 DOM', rolledBack && h.area.classList.contains('tetris-wave-b') && !!h.area.querySelector('.tetris-wave-b-layout') && h.extra.querySelectorAll('[data-tetris-control]').length === 7 && h.game.snapshot().wells.every(well => well.length === 18));
  h.game.destroy();

  h = createHarness(storage(null, true));
  check('storage 读取异常安全回退 Wave A', !h.area.classList.contains('tetris-wave-b') && !h.area.querySelector('.tetris-wave-b-layout'));
  h.game.destroy();
}

try { run(); } catch (error) { check('Wave B Tetris contract 可执行', false, error && error.stack || String(error)); }
if (failures){ console.error('GAME_STAGE_WAVE_B_TETRIS_FAILURES=' + failures); process.exitCode = 1; } else console.log('GAME_STAGE_WAVE_B_TETRIS_ALL_PASS');
