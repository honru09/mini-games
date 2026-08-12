// AI 三档强度合同：不允许把简单 / 普通 / 困难退化为人格文案或同一策略换皮。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PERSONAS_PATH = path.join(ROOT, 'public', 'src', 'core', '05-ai-personas.js');
const FRAMEWORK_PATH = path.join(ROOT, 'public', 'src', 'core', '03-game-framework.js');
const SERVER_PATH = path.join(ROOT, 'server', 'index.js');
const GAME_PATH = path.join(ROOT, 'public', 'src', 'games');
const GAMES = ['gomoku.js', 'ludo.js', 'monopoly.js', 'tank.js', 'tetris.js', 'xiangqi.js'];
const failures = [];

function assert(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

function createStorage(initial){
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem(key){ return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value){ values.set(String(key), String(value)); },
    removeItem(key){ values.delete(String(key)); },
  };
}

function loadDifficultyModule(storage){
  const sandbox = {
    console, Math, Object, Array, String, Number, Boolean, JSON, Date,
    localStorage: storage,
    t(key){ return String(key); }, toast(){}, sfx(){},
    document: undefined,
  };
  const source = fs.readFileSync(PERSONAS_PATH, 'utf8');
  const context = vm.createContext(sandbox);
  try {
    vm.runInContext(source + `
      globalThis.__difficultyContract = {
        AI_DIFFICULTIES, AI_DIFFICULTY_DEFAULT,
        aiDifficultyById, aiDifficultyFromOptions, aiDifficultyAllowsRemote,
        aiDifficultyRequestProfile, aiDifficultyLocalChoiceIndex,
        setAiDifficulty, getAiDifficulty, initAiDifficulty,
        get currentPersona(){ return currentPersona; }
      };
    `, context, { filename:'05-ai-personas.js' });
    return { api:context.__difficultyContract, context, source };
  } catch (error) {
    assert('AI 难度模块公开统一三档接口', false, error && error.message);
    return { api:null, context, source };
  }
}

function runDifficultyModuleChecks(){
  const source = fs.readFileSync(PERSONAS_PATH, 'utf8');
  assert('AI 对手不再声明五人格目录', !/id\s*:\s*['"](?:tsundere|gambler|mean|cute)['"]|systemPrompt|randomness|quotes/.test(source));
  assert('AI 对手不再渲染人格选择内容', !/ai_persona_(?:tsundere|gambler|mean|cute)/.test(source));
  assert('难度选择渲染基于统一三档目录', /function\s+renderPersonaRow\s*\([^)]*\)\s*\{[\s\S]*AI_DIFFICULTIES/.test(source));

  const storage = createStorage({ mg_persona:'gambler' });
  const loaded = loadDifficultyModule(storage);
  const api = loaded.api;
  if (!api) return;

  const ids = Array.from(api.AI_DIFFICULTIES || [], entry => entry && entry.id);
  assert('难度目录恰好为简单、普通、困难', JSON.stringify(ids) === JSON.stringify(['easy', 'normal', 'hard']), JSON.stringify(ids));
  assert('默认难度为普通', api.AI_DIFFICULTY_DEFAULT === 'normal');
  api.initAiDifficulty();
  assert('旧人格本地存储不会恢复成可见人格', api.getAiDifficulty().id === 'normal', api.getAiDifficulty().id);
  assert('难度持久化使用独立键', storage.getItem('mg_ai_difficulty') === 'normal');
  assert('无效难度安全回落普通', api.aiDifficultyById('not-a-level').id === 'normal');
  assert('旧人格选项安全映射普通', api.aiDifficultyFromOptions({ aiPersona:{ id:'gambler' } }).id === 'normal');
  assert('兼容选项可携带实际难度', api.aiDifficultyFromOptions({ aiPersona:{ id:'teacher', difficulty:'easy' } }).id === 'easy');

  api.setAiDifficulty('easy');
  assert('简单档使用非首位的较弱合法候选', api.aiDifficultyLocalChoiceIndex(api.getAiDifficulty(), 4) > 0);
  assert('普通档执行本地近优首选', api.aiDifficultyLocalChoiceIndex('normal', 4) === 0);
  assert('困难档本地默认执行最强首选', api.aiDifficultyLocalChoiceIndex('hard', 4) === 0);
  assert('简单档不采用远端裁决', api.aiDifficultyAllowsRemote('easy') === false);
  assert('普通档保持本地近优策略且不采用远端裁决', api.aiDifficultyAllowsRemote('normal') === false);
  assert('困难档允许远端最强裁决', api.aiDifficultyAllowsRemote('hard') === true);
  const easyProfile = api.aiDifficultyRequestProfile('easy');
  const normalProfile = api.aiDifficultyRequestProfile('normal');
  const remoteProfile = api.aiDifficultyRequestProfile('hard');
  assert('简单/普通档仍取得服务端学习票据而不伪造模型',
    easyProfile && easyProfile.difficulty === 'easy' && normalProfile && normalProfile.difficulty === 'normal');
  assert('困难档远端请求只带安全兼容标识与难度', !!remoteProfile && remoteProfile.id === 'teacher' && remoteProfile.difficulty === 'hard', JSON.stringify(remoteProfile));
  assert('前端远端请求不携带模型或密钥', !/deepseek|model|key/i.test(JSON.stringify(remoteProfile || {})));
  assert('旧调用方仍收到安全服务端人格 ID', api.currentPersona && api.currentPersona.id === 'teacher' && api.currentPersona.difficulty === 'easy', JSON.stringify(api.currentPersona));
}

function runServerUpstreamGateCheck(){
  const source = fs.readFileSync(SERVER_PATH, 'utf8');
  assert('服务端只允许困难档访问 DeepSeek，上游门禁不由前端模型名控制',
    /const\s+requestedDifficulty[\s\S]*\['easy','normal','hard'\]/.test(source) &&
    /const\s+allowDeepSeek\s*=\s*requestedDifficulty\s*\?\s*requestedDifficulty\s*===\s*'hard'\s*:\s*true/.test(source) &&
    /if\s*\(DEEPSEEK_KEY\s*&&\s*allowDeepSeek\)/.test(source));
}

function runFrameworkCheck(){
  const source = fs.readFileSync(FRAMEWORK_PATH, 'utf8');
  assert('游戏框架在创建实例时标准化难度', /function\s+normalizeGameAIDifficulty\s*\(/.test(source) && /normalizeGameAIDifficulty\(opts\)/.test(source));

  const storage = createStorage();
  const sandbox = {
    console, Math, Object, Array, String, Number, Boolean, JSON, Date,
    localStorage: storage, t(key){ return String(key); }, toast(){}, sfx(){}, document:undefined,
  };
  const context = vm.createContext(sandbox);
  try {
    vm.runInContext(fs.readFileSync(PERSONAS_PATH, 'utf8'), context, { filename:'05-ai-personas.js' });
    vm.runInContext(source, context, { filename:'03-game-framework.js' });
    vm.runInContext(`
      let __received = null;
      registerGame('difficulty-contract-game', function(_area, _extra, _count, opts){
        __received = opts;
        return { snapshot(){ return null; } };
      });
      createGameInstance('difficulty-contract-game', null, null, 2, { ai:new Set([1]) });
      globalThis.__receivedDifficulty = __received && __received.aiDifficulty && __received.aiDifficulty.id;
    `, context, { filename:'ai-difficulty-framework-contract.js' });
    assert('未显式设置时六款共享默认普通档', context.__receivedDifficulty === 'normal', String(context.__receivedDifficulty));
  } catch (error) {
    assert('游戏框架会为旧调用方补齐普通难度', false, error && error.message);
  }
}

function runGameChecks(){
  const profileSignatures = {
    gomoku: [/gomokuDifficultyProfile/, /roots:hist\.length < 8 \? 9 : 8/, /roots:hist\.length < 8 \? 18 : 16/, /roots:hist\.length < 8 \? 24 : 22/],
    ludo: [/ludoDifficultyProfile/, /rolls:3/, /rolls:6/, /exposureWeight:12/],
    monopoly: [/monopolyDifficultyProfile/, /riskHorizon:1/, /riskHorizon:2/, /riskHorizon:3/],
    tank: [/tankDifficultyProfile/, /pathSearch:false/, /pathSearch:true/, /candidates:5/],
    tetris: [/tetrisDifficultyProfile/, /placementLimit:12/, /placementLimit:32/, /placementLimit:48/],
    xiangqi: [/xqDifficultyProfile/, /rootWidth:10/, /rootWidth:28/, /rootWidth:36/],
  };
  GAMES.forEach(file => {
    const source = fs.readFileSync(path.join(GAME_PATH, file), 'utf8');
    const label = file.replace(/\.js$/, '');
    assert(label + '：从统一选项读取难度', /aiDifficultyFromOptions\s*\(\s*opts\s*\)/.test(source));
    assert(label + '：只有困难档可调用远端裁决', /aiDifficultyAllowsRemote\s*\(/.test(source));
    assert(label + '：保留二次合法动作执行路径', /(applyMove|applyPick|applyDecision|applyPlacement|doMove|pulseMove|fireTank)/.test(source));
    assert(label + '：保留候选学习路径', /learningCandidates/.test(source) && /aiChoose\s*\(/.test(source));
    assert(label + '：三档都请求可确认学习票据', /remoteProfile\s*=\s*typeof\s+aiDifficultyRequestProfile/.test(source));
    assert(label + '：异步响应绑定局面快照', /stateKey|requestStateKey|livePlan/.test(source));
    assert(label + '：不再含人格排序分支', !/PersonaBonus|personaAdjustment|gambler|tsundere|\bcute\b/.test(source));
    assert(label + '：前端不声明模型或密钥', !/DEEPSEEK|api[_-]?key|secret/i.test(source));
    assert(label + '：三档使用不同搜索/特征预算', (profileSignatures[label] || []).every(pattern => pattern.test(source)));
  });
}

runDifficultyModuleChecks();
runFrameworkCheck();
runGameChecks();
runServerUpstreamGateCheck();

if (failures.length){
  console.log('AI_DIFFICULTY_CONTRACT_HAS_FAILURES (' + failures.length + ')');
  process.exitCode = 1;
} else {
  console.log('AI_DIFFICULTY_CONTRACT_ALL_PASS');
}
