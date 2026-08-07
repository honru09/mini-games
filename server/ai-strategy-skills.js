'use strict';

// 六款游戏的 AI 策略知识包。它们会直接进入 DeepSeek 的 system prompt，
// 同一原则也由各游戏的本地启发式/搜索实现，断网时不退化成随机操作。
// 研究依据（仅供维护，不在运行时联网）：
// - Gomoku threat-space search: https://citeseerx.ist.psu.edu/document?doi=cd8472a994141aaaf1d4f18c4720ff8087689fe0
// - Xiangqi alpha-beta / iterative deepening: https://doi.org/10.2991/iccsee.2013.67
// - Ludo TD/Q-learning expert features: https://citeseerx.ist.psu.edu/document?doi=71982b2fe0ffc557fd68f4c07b039c1f99cdbac1
// - Monopoly hybrid policy and net-worth reward: https://arxiv.org/abs/2103.00683
// - Real-time influence-map kiting: https://doi.org/10.1609/aiide.v8i3.12544
// - Tetris Dellacherie-style features: https://doi.org/10.1155/2015/157983

const AI_STRATEGY_VERSION = 'game-skill-v1';

const AI_STRATEGY_SKILLS = Object.freeze({
  gomoku: Object.freeze({
    name: '威胁空间搜索',
    doctrine: [
      '第一优先级是本回合成五，其次是阻断对手下一回合成五，任何风格不得覆盖这两条。',
      '按活四、冲四、双活三、活三、开放二的强制程度比较候选；优先制造对手无法同时防住的双威胁。',
      '至少检查对手对每个候选的最强反击；不能只看自己连子长度，也要计算两端是否开放。',
      '同等威胁下优先已有棋群附近、中心控制和能同时进攻/防守的交叉点。',
    ],
  }),
  xiangqi: Object.freeze({
    name: '限宽 Alpha-Beta 象棋搜索',
    doctrine: [
      '先处理将军应对、将死和直接吃将；严禁走后己方仍被将军或形成将帅照面。',
      '比较子力、受保护程度、交换后得失、将帅安全、机动性和兵卒过河价值，不能见子就吃。',
      '优先检查将军、吃子、解围等战术着；对候选至少读取一轮对手最佳回应，再评估己方后续。',
      '同分时优先安全发展车马炮、控制中路与限制对方将帅活动，不用随机走子制造低级失误。',
    ],
  }),
  ludo: Object.freeze({
    name: '随机博弈期望决策',
    doctrine: [
      '按到达终点、吃子、起飞、进入安全位置、推进的顺序评估即时收益。',
      '估算对手下一次掷骰可吃到本子的概率，避免把领先棋子停在高风险格；安全格和终点走廊提高价值。',
      '兼顾棋子发展，避免只推进一枚导致其被反复击回；落后时可提高捕获和追赶权重。',
      '比较候选后的下一轮骰子期望，而不是仅按本次移动距离贪心。',
    ],
  }),
  monopoly: Object.freeze({
    name: '净资产与生存储备混合策略',
    doctrine: [
      '以现金加地产价值构成净资产，并与仍存活对手的净资产比较；现金和平台虚拟货币完全无关。',
      '买地前保留能承受近期税费、租金和机会卡坏结果的生存储备，避免为了便宜地耗尽现金。',
      '结合价格、租金回报、剩余轮数、自己/对手持有地产和领先差距判断；落后时可承担适度风险。',
      '买或不买属于低频明确决策，优先使用可解释固定策略；模型只在近似等价候选间裁决。',
    ],
  }),
  tank: Object.freeze({
    name: '影响图、避弹与火线控制',
    doctrine: [
      '先构造炮弹、敌方朝向、障碍和边界的危险图；生存优先于无意义追击。',
      '敌人在同一行列且射线无遮挡时立即开火；否则向可形成火线或侧翼的位置移动。',
      '预测炮弹下一段轨迹并垂直闪避，避免朝墙、地图边缘或敌方正面火力移动。',
      '优先压制低生命或高击杀目标，同时利用可破坏墙体和掩体，不做随机方向游走。',
    ],
  }),
  tetris: Object.freeze({
    name: 'Dellacherie 井面评估与双块前瞻',
    doctrine: [
      '洞、被封死的空格和接近顶出的高度是最高惩罚；不能为一次小消行制造永久洞。',
      '同时比较落点高度、累计高度、行/列转换、井深、表面凹凸和已消行数。',
      '考虑 Next 的第二块前瞻；为 I 块保留可控深井，但不能让深井成为顶出风险。',
      '对战时把垃圾抵消、Tetris 攻击、Incoming 到达时间和目标存活状态纳入评分。',
    ],
  }),
});

function aiStrategySkill(game){
  return AI_STRATEGY_SKILLS[game] || null;
}

function aiStrategyPrompt(game){
  const skill = aiStrategySkill(game);
  if (!skill) return '';
  return '策略知识包 ' + AI_STRATEGY_VERSION + ' / ' + skill.name + '：\n- ' + skill.doctrine.join('\n- ');
}

module.exports = { AI_STRATEGY_VERSION, AI_STRATEGY_SKILLS, aiStrategySkill, aiStrategyPrompt };
