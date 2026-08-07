/* ================= 社交与留存：称号 / 成就 / 每日任务 / 最近一起玩 ================= */
const TITLES = [
  { id: 1, name: '新手玩家', icon: '🌱', minLevel: 1 },
  { id: 2, name: '常胜将军', icon: '⚔️', minLevel: 3 },
  { id: 3, name: '老赌神', icon: '🎲', minLevel: 5 },
  { id: 4, name: '棋圣', icon: '♟️', minLevel: 8 },
  { id: 5, name: '传说玩家', icon: '👑', minLevel: 12 },
];
function titleFor(level){
  let best = TITLES[0];
  for (const t of TITLES){ if (level >= t.minLevel) best = t; }
  return best;
}

const ACHIEVEMENTS = [
  { id: 'first_win', name: '首胜', icon: '🥇', desc: '赢下第一局', check: p => (p.totalWins || 0) >= 1 },
  { id: 'win_10', name: '十胜', icon: '💎', desc: '累计赢 10 局', check: p => (p.totalWins || 0) >= 10 },
  { id: 'win_50', name: '五十胜', icon: '🏆', desc: '累计赢 50 局', check: p => (p.totalWins || 0) >= 50 },
  { id: 'streak_3', name: '三连胜', icon: '🔥', desc: '连胜 3 局', check: p => (p.bestStreak || 0) >= 3 },
  { id: 'streak_5', name: '五连胜', icon: '⚡', desc: '连胜 5 局', check: p => (p.bestStreak || 0) >= 5 },
  { id: 'level_5', name: '资深玩家', icon: '🎖️', desc: '达到 5 级', check: p => (p.level || levelFromXp(p.xp || 0)) >= 5 },
  { id: 'all_games', name: '全能玩家', icon: '🎯', desc: '玩过 5 种游戏', check: p => Object.keys(p.played || {}).filter(k => p.played[k] > 0).length >= 5 },
  { id: 'social', name: '社交达人', icon: '🤝', desc: '和 3 位不同玩家对局', check: p => Object.keys(p.playmates || {}).length >= 3 },
];
function checkAchievements(profile){
  const earned = [];
  const p = profile || {};
  for (const a of ACHIEVEMENTS){
    if (!(p.achievements || []).includes(a.id) && a.check(p)) earned.push(a.id);
  }
  return earned;
}
function achievementsEarned(p){
  return (p.achievements || []).slice();
}

const DAILY_TASKS = [
  { id: 'play_1', name: '玩 1 局', icon: '🎮', target: 1, reward: 5, kind: 'play' },
  { id: 'play_3', name: '玩 3 局', icon: '🕹️', target: 3, reward: 10, kind: 'play' },
  { id: 'win_1', name: '赢 1 局', icon: '🏅', target: 1, reward: 8, kind: 'win' },
  { id: 'streak_2', name: '连胜 2 局', icon: '🔥', target: 2, reward: 12, kind: 'streak' },
];
function dailyTasksState(profile){
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const p = profile || {};
  if (p.dailyKey !== dayKey){
    p.dailyKey = dayKey;
    p.daily = { play: 0, win: 0, streak: 0 };
  }
  return p.daily || { play: 0, win: 0, streak: 0 };
}
function updateDaily(profile, kind, amount){
  const p = profile || {};
  const state = dailyTasksState(p);
  state[kind] = (state[kind] || 0) + (amount || 1);
  p.daily = state;
  return state;
}
function dailyProgress(profile){
  const state = dailyTasksState(profile);
  return DAILY_TASKS.map(t => {
    const cur = Math.min(state[t.kind] || 0, t.target);
    return { ...t, cur, done: cur >= t.target };
  });
}

/* ---- 最近一起玩（本地记录 + 服务端同步 playmates） ---- */
function recordPlaymate(profile, otherUid, otherName, gameId){
  if (!profile || !otherUid || otherUid === profile.uid) return;
  if (!profile.playmates) profile.playmates = {};
  const now = Date.now();
  const pm = profile.playmates[otherUid] || { name: otherName || '玩家', count: 0, lastAt: 0, games: {} };
  pm.name = otherName || pm.name;
  pm.count++;
  pm.lastAt = now;
  if (gameId) pm.games[gameId] = (pm.games[gameId] || 0) + 1;
  profile.playmates[otherUid] = pm;
}
function recentPlaymates(profile, limit){
  const p = profile || {};
  return Object.keys(p.playmates || {})
    .map(uid => ({ uid, ...p.playmates[uid] }))
    .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
    .slice(0, limit || 5);
}

/* ---- 成就墙弹窗 ---- */
function openAchievementsModal(){
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.style.width = '460px';
  card.appendChild(el('h3', null, 'Achievements'));
  const grid = el('div','ach-grid');
  const earned = achievementsEarned(account || {});
  ACHIEVEMENTS.forEach(a => {
    const item = el('div','ach-item' + (earned.includes(a.id) ? ' earned' : ' locked'));
    item.appendChild(el('span','ach-icon', a.icon));
    const info = el('div','ach-info');
    info.appendChild(el('div','ach-name', a.name + (earned.includes(a.id) ? ' Unlocked' : '')));
    info.appendChild(el('div','ach-desc', a.desc));
    item.appendChild(info);
    grid.appendChild(item);
  });
  card.appendChild(grid);
  const earnedCount = earned.length;
  card.appendChild(el('div','lb-note', 'Achievements unlocked: ' + earnedCount + '/' + ACHIEVEMENTS.length));
  const close = el('button','btn','Close');
  close.addEventListener('click', () => bd.remove());
  card.appendChild(close);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}


/* ---- 我的卡片渲染（首屏玩家中心） ---- */
function renderMyCard(){
  const holder = $('my-card');
  if (!holder) return;
  holder.innerHTML = '';
  if (!account){
    const empty = el('div', 'my-card-empty');
    empty.appendChild(el('div', 'my-card-empty-icon', '🎮'));
    empty.appendChild(el('div', 'my-card-empty-title', '登录后开启玩家档案'));
    empty.appendChild(el('div', 'my-card-empty-desc', '记录称号 · 成就 · 每日任务 · 最近一起玩'));
    const goBtn = el('button', 'btn btn-primary my-card-empty-btn');
    setButtonIcon(goBtn,'user','登录 / 注册');
    goBtn.type = 'button';
    goBtn.addEventListener('click', e => { e.stopPropagation(); openAuthModal(); });
    empty.appendChild(goBtn);
    empty.addEventListener('click', () => openAuthModal());
    holder.appendChild(empty);
    return;
  }
  const me = profileByUid(deviceUid);
  const p = me || account;
  const lv = p.level || levelFromXp(p.xp || 0);
  const title = titleFor(lv);
  const card = el('div', 'my-card');
  // 头像 + 昵称 + 等级 + 称号
  const head = el('div', 'my-card-head');
  const av = el('span', 'my-card-av');
  av.appendChild(avatarStageNode(account, 40));
  head.appendChild(av);
  const info = el('div', 'my-card-info');
  const nm = el('div', 'my-card-name');
  nm.appendChild(nameFxNode(account, account.name + ' ' + langFlag(account.lang || currentLang)));
  info.appendChild(nm);
  info.appendChild(el('div', 'my-card-title', title.icon + ' ' + title.name + ' · Lv.' + lv));
  head.appendChild(info);
  card.appendChild(head);
  // 数据行
  const stats = el('div', 'my-card-stats');
  const stat = (icon, label, val) => {
    const s = el('div', 'my-card-stat');
    s.appendChild(el('span', null, icon));
    const v = el('span', 'my-card-stat-val', String(val));
    s.appendChild(v);
    s.appendChild(el('span', 'my-card-stat-label', label));
    stats.appendChild(s);
  };
  stat('💵', '虚拟现金', p.coins || 0);
  stat('⭐', 'XP', p.xp || 0);
  const earnedCount = achievementsEarned(p).length;
  stat('🏆', '成就', earnedCount);
  stat('🔥', '连胜', p.streak || 0);
  stat('🏆', '胜场', p.totalWins || 0);
  card.appendChild(stats);
  // 每日任务进度
  const tasks = dailyProgress(p);
  const doneTasks = tasks.filter(t => t.done).length;
  const taskRow = el('div', 'my-card-tasks');
  taskRow.appendChild(el('div', 'my-card-tasks-title', '📋 每日任务 ' + doneTasks + '/' + tasks.length));
  const taskBar = el('div', 'my-card-taskbar');
  tasks.slice(0, 3).forEach(t => {
    const item = el('div', 'my-card-task' + (t.done ? ' done' : ''));
    item.appendChild(el('span', null, t.icon));
    item.appendChild(el('span', null, t.name + ' ' + t.cur + '/' + t.target));
    taskBar.appendChild(item);
  });
  taskRow.appendChild(taskBar);
  card.appendChild(taskRow);
  // 最近一起玩
  const mates = recentPlaymates(p, 3);
  if (mates.length){
    const mateRow = el('div', 'my-card-mates');
    mateRow.appendChild(el('div', 'my-card-tasks-title', '👥 最近一起玩'));
    const list = el('div', 'my-card-mate-list');
    mates.forEach(m => {
      const item = el('button', 'my-card-mate');
      item.appendChild(el('span', null, m.name));
      item.appendChild(el('span', 'my-card-mate-info', '共 ' + m.count + ' 局'));
      item.addEventListener('click', () => openProfileModal(m.uid));
      list.appendChild(item);
    });
    mateRow.appendChild(list);
    card.appendChild(mateRow);
  }
  // 按钮
  const btns = el('div', 'my-card-btns');
  const shopBtn = el('button', 'btn btn-primary');
  setButtonIcon(shopBtn,'store','商城');
  shopBtn.addEventListener('click', openShop);
  btns.appendChild(shopBtn);
  const achBtn = el('button', 'btn');
  setButtonIcon(achBtn,'trophy','成就');
  achBtn.addEventListener('click', () => openAchievementsModal());
  btns.appendChild(achBtn);
  const profileBtn = el('button', 'btn');
  setButtonIcon(profileBtn,'user','我的档案');
  profileBtn.addEventListener('click', () => openProfileModal(deviceUid));
  btns.appendChild(profileBtn);
  card.appendChild(btns);
  holder.appendChild(card);
}
