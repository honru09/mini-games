/* ================= AI 三档强度 ================= */
// 玩家只选择强度。旧 `aiPersona` 名称保留为跨模块兼容层，绝不再表示可见人格。
const AI_DIFFICULTIES = Object.freeze([
  { id:'easy', nameKey:'ai_difficulty_easy', descKey:'ai_difficulty_easy_desc', icon:'🌱' },
  { id:'normal', nameKey:'ai_difficulty_normal', descKey:'ai_difficulty_normal_desc', icon:'⚖️' },
  { id:'hard', nameKey:'ai_difficulty_hard', descKey:'ai_difficulty_hard_desc', icon:'🔥' },
]);
const AI_DIFFICULTY_DEFAULT = 'normal';
const AI_DIFFICULTY_FALLBACK_NAMES = Object.freeze({ easy:'Easy', normal:'Normal', hard:'Hard' });
// 07-roster 仍公开这个旧符号；值已是三档难度，不能再恢复五人格目录。
const AI_PERSONAS = AI_DIFFICULTIES;

function aiDifficultyById(value){
  const raw = value && typeof value === 'object'
    ? (value.difficulty || value.id)
    : value;
  const id = String(raw || '').toLowerCase();
  return AI_DIFFICULTIES.find(item => item.id === id) || AI_DIFFICULTIES.find(item => item.id === AI_DIFFICULTY_DEFAULT);
}

function aiDifficultyFromOptions(opts){
  const explicit = opts && opts.aiDifficulty;
  if (explicit) return aiDifficultyById(explicit);
  const legacy = opts && opts.aiPersona;
  if (legacy && typeof legacy === 'object' && legacy.difficulty) return aiDifficultyById(legacy.difficulty);
  if (legacy && typeof legacy === 'object' && AI_DIFFICULTIES.some(item => item.id === legacy.id)) return aiDifficultyById(legacy.id);
  // 独立旧工厂调用中 teacher 曾代表最高本地策略；产品入口会由框架显式补成 normal。
  if (legacy && typeof legacy === 'object' && legacy.id === 'teacher') return aiDifficultyById('hard');
  return aiDifficultyById(AI_DIFFICULTY_DEFAULT);
}

function aiDifficultyAllowsRemote(value){ return aiDifficultyById(value).id === 'hard'; }

function aiDifficultyRequestProfile(value){
  const difficulty = aiDifficultyById(value);
  // 三档都通过服务端取得可确认的个人学习票据；只有 hard 允许服务端访问上游模型。
  // 真正模型型号始终只由服务端环境变量决定，前端不能指定模型或密钥。
  return { id:'teacher', difficulty:difficulty.id };
}

function aiDifficultyCompatibilityProfile(value){
  const difficulty = aiDifficultyById(value);
  return { id:'teacher', difficulty:difficulty.id };
}

function aiDifficultyLocalChoiceIndex(value, listLength){
  const length = Math.max(0, Number(listLength) || 0);
  if (length <= 1) return 0;
  // 简单档只在已由游戏规则生成的合法候选中确定性选择较弱位置，绝不随机跳到未知动作。
  return aiDifficultyById(value).id === 'easy' ? Math.min(length - 1, Math.max(1, Math.floor(length / 2))) : 0;
}

function aiDifficultyName(value){
  const difficulty = aiDifficultyById(value);
  const translated = t(difficulty.nameKey);
  // 词典更新前保留可读 fallback；三语键由本批次外的 locale owner 统一补齐。
  return translated === difficulty.nameKey ? AI_DIFFICULTY_FALLBACK_NAMES[difficulty.id] : translated;
}

let currentAIDifficulty = aiDifficultyById(AI_DIFFICULTY_DEFAULT);
let currentPersona = aiDifficultyCompatibilityProfile(currentAIDifficulty);

function getAiDifficulty(){ return currentAIDifficulty; }

function setAiDifficulty(id){
  currentAIDifficulty = aiDifficultyById(id);
  currentPersona = aiDifficultyCompatibilityProfile(currentAIDifficulty);
  try { localStorage.setItem('mg_ai_difficulty', currentAIDifficulty.id); } catch {}
  return currentAIDifficulty;
}

function initAiDifficulty(){
  let saved = null;
  try {
    saved = localStorage.getItem('mg_ai_difficulty');
    // 迁移时不保留旧人格选择，避免旧偏好重新出现在玩家界面。
    localStorage.removeItem('mg_persona');
  } catch {}
  setAiDifficulty(saved || AI_DIFFICULTY_DEFAULT);
  return currentAIDifficulty;
}

// 以下三项是旧调用方兼容名：传入旧人格不会恢复人格，统一落到当前/普通难度。
function personaById(id){
  const difficulty = AI_DIFFICULTIES.some(item => item.id === String(id || '').toLowerCase())
    ? aiDifficultyById(id) : currentAIDifficulty;
  return aiDifficultyCompatibilityProfile(difficulty);
}
function setAiPersona(id){ return setAiDifficulty(id); }
function personaName(){ return t('ai_default_name'); }
function personaDesc(){ return ''; }

function aiPersonaMove(listLength, bestIdx, value){
  const offset = aiDifficultyLocalChoiceIndex(value || currentAIDifficulty, listLength);
  return Math.min(Math.max(0, Number(listLength) - 1), Math.max(0, Number(bestIdx) || 0) + offset);
}

// 保留局内反应钩子，但不再展示任何人格台词或口吻。
function aiSpeak(_value, kind){
  if (kind === 'think') {
    try { if (typeof triggerHonruGameReaction === 'function') triggerHonruGameReaction('think', { source:'ai-turn' }); } catch {}
  }
}

function aiMateInfo(value){
  const difficulty = aiDifficultyById(value || currentAIDifficulty);
  return { uid:'ai_' + difficulty.id, name:'ai_' + difficulty.id };
}

function aiMateDisplayName(uid, fallbackName){
  const value = String(uid || '');
  return value.startsWith('ai_') ? t('ai_default_name') : (fallbackName || t('default_player_name'));
}

// 保留原挂载点，渲染内容已从五人格换成三档难度。
function renderPersonaRow(){
  const row = $('persona-row');
  if (!row) return;
  if (!aiMode){ row.classList.add('hidden'); return; }
  row.classList.remove('hidden');
  row.innerHTML = '';
  row.appendChild(el('span', 'hub-label', t('ai_persona_select')));
  const cards = el('div', 'persona-cards ai-difficulty-cards');
  AI_DIFFICULTIES.forEach(difficulty => {
    const card = el('button', 'persona-card ai-difficulty-card' + (currentAIDifficulty.id === difficulty.id ? ' selected' : ''));
    card.type = 'button';
    card.setAttribute('aria-pressed', String(currentAIDifficulty.id === difficulty.id));
    card.setAttribute('aria-label', aiDifficultyName(difficulty) + ' · ' + t(difficulty.descKey));
    card.appendChild(el('span', 'persona-icon', difficulty.icon));
    card.appendChild(el('span', 'persona-name', aiDifficultyName(difficulty)));
    card.appendChild(el('span', 'persona-desc', t(difficulty.descKey)));
    card.addEventListener('click', () => {
      setAiDifficulty(difficulty.id);
      renderPersonaRow();
      toast(t('ai_persona_selected', difficulty.icon, aiDifficultyName(difficulty)));
    });
    cards.appendChild(card);
  });
  row.appendChild(cards);
}

if (typeof document !== 'undefined') initAiDifficulty();
