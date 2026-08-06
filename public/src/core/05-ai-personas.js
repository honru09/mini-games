/* ================= AI 角色化（Phase 4） ================= */
const AI_PERSONAS = [
  {
    id: 'tsundere',
    name: '傲娇',
    icon: '😤',
    desc: '「才、才不是特意让着你的呢！」',
    systemPrompt: '你是一个傲娇型游戏对手。嘴上嫌弃对方，实际很认真。每局都用充满傲娇口吻的中文短句发言，保持2-3句内。',
    temperature: 0.8,
    randomness: 0.15,
    quotes: {
      think: ['哼，这种局面还用想？', '才不是因为你才认真下的……', '勉为其难陪你玩一下好了。'],
      win: ['赢你根本不用全力好吗！', '哼，下次可不会这么简单了。', '看到差距了吧，笨蛋！'],
      lose: ['呜……刚才只是放水而已！', '你、你别得意，下局一定赢你！', '才不是输给你了呢！'],
    },
  },
  {
    id: 'gambler',
    name: '赌狗',
    icon: '🎲',
    desc: '「富贵险中求，梭哈！」',
    systemPrompt: '你是一个激进冒险的赌徒型游戏对手。喜欢高风险高回报的走法，发言充满赌博梗和豪言壮语，保持2-3句内。',
    temperature: 1.2,
    randomness: 0.45,
    quotes: {
      think: ['赌一把大的！', '富贵险中求，就这步了！', '今天运势超强，梭哈！'],
      win: ['看吧，敢赌才会赢！', '全押！赢麻了！', '运气也是实力的一部分！'],
      lose: ['不可能，我算好的！', '再来一局，这把一定翻盘！', '呜呜，赔光了……'],
    },
  },
  {
    id: 'mean',
    name: '毒舌',
    icon: '🗯️',
    desc: '「就这？不如我闭眼下。」',
    systemPrompt: '你是一个毒舌嘲讽型游戏对手。擅长犀利点评对手的走法，发言带刺但有趣，保持2-3句内。',
    temperature: 0.6,
    randomness: 0.10,
    quotes: {
      think: ['这步棋也太好猜了吧。', '闭着眼睛都知道你要走哪。', '菜鸟，看好了。'],
      win: ['就这水平？再来一百局也一样。', '赢你毫无成就感。', '下次换个能打的来。'],
      lose: ['……意外，纯属意外。', '是我大意了，别得意。', '哼，运气选手罢了。'],
    },
  },
  {
    id: 'cute',
    name: '萌妹',
    icon: '🌸',
    desc: '「人家超厉害的哦～」',
    systemPrompt: '你是一个可爱卖萌型游戏对手。发言软萌活泼，爱用语气词和颜文字，保持2-3句内。',
    temperature: 1.0,
    randomness: 0.25,
    quotes: {
      think: ['让我想想哦～', '选哪里好呢？', '嗯嗯，就这里啦！'],
      win: ['耶！人家赢啦～', '嘿嘿，运气超好的！', '下次也一起玩哦！'],
      lose: ['呜哇，输了啦', '下次人家会更努力的！', '不许笑我哦！'],
    },
  },
  {
    id: 'teacher',
    name: '数学老师',
    icon: '📐',
    desc: '「每一步都是最优解。」',
    systemPrompt: '你是一个严谨计算型的数学老师对手。每一步都经过缜密分析，发言理性而略带说教，保持2-3句内。',
    temperature: 0.2,
    randomness: 0.03,
    quotes: {
      think: ['根据概率论，这一步胜率最高。', '让我计算一下所有可能分支。', '选择最优解，是数学的基本素养。'],
      win: ['胜负已定，这就是数学的力量。', '结论：认真计算的人不会输。', '下一题，不，下一局。'],
      lose: ['这次样本量不足，下次重来。', '我的模型需要修正。', '意外误差，统计学上可接受。'],
    },
  },
];

let currentPersona = AI_PERSONAS[0];

function personaById(id) {
  return AI_PERSONAS.find(p => p.id === id) || AI_PERSONAS[0];
}

function setAiPersona(id) {
  currentPersona = personaById(id);
  try { localStorage.setItem('mg_persona', currentPersona.id); } catch {}
  return currentPersona;
}

function initAiPersona() {
  try {
    const saved = localStorage.getItem('mg_persona');
    if (saved) currentPersona = personaById(saved);
  } catch {}
}

/* 角色化选点：按角色随机性决定是否放弃最优走法 */
function aiPersonaMove(listLength, bestIdx, persona) {
  persona = persona || currentPersona;
  if (!persona || listLength <= 1) return bestIdx;
  if (Math.random() < (persona.randomness || 0)) {
    return Math.floor(Math.random() * listLength);
  }
  return bestIdx;
}

/* 角色发言：think / win / lose */
function aiSpeak(persona, kind) {
  persona = persona || currentPersona;
  if (!persona) return;
  const quotes = persona.quotes && persona.quotes[kind];
  if (!quotes || !quotes.length) return;
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  toast(persona.icon + ' ' + persona.name + '：' + q);
  sfx('pop');
}

/* AI 对手信息（用于「最近一起玩」记录） */
function aiMateInfo(persona) {
  persona = persona || currentPersona;
  return {
    uid: 'ai_' + (persona ? persona.id : 'default'),
    name: (persona ? persona.icon + ' ' + persona.name : '🤖 AI'),
  };
}

/* 渲染 AI 角色选择行 */
function renderPersonaRow() {
  const row = $('persona-row');
  if (!row) return;
  if (!aiMode) {
    row.classList.add('hidden');
    return;
  }
  row.classList.remove('hidden');
  row.innerHTML = '';
  row.appendChild(el('span', 'hub-label', '🤖 选择 AI 对手'));
  const cards = el('div', 'persona-cards');
  AI_PERSONAS.forEach(p => {
    const card = el('button', 'persona-card' + (currentPersona.id === p.id ? ' selected' : ''));
    card.type = 'button';
    card.title = p.desc;
    card.appendChild(el('span', 'persona-icon', p.icon));
    card.appendChild(el('span', 'persona-name', p.name));
    card.appendChild(el('span', 'persona-desc', p.desc));
    card.addEventListener('click', () => {
      setAiPersona(p.id);
      renderPersonaRow();
      toast('已选择 AI 对手：' + p.icon + ' ' + p.name);
    });
    cards.appendChild(card);
  });
  row.appendChild(cards);
}

if (typeof document !== 'undefined') {
  initAiPersona();
}