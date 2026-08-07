/* ================= 社交与留存：称号 / 成就 / 每日任务 / 最近一起玩 ================= */
const TITLES = [
  { id: 1, nameKey: 'social_title_1', icon: '🌱', minLevel: 1 },
  { id: 2, nameKey: 'social_title_2', icon: '⚔️', minLevel: 3 },
  { id: 3, nameKey: 'social_title_3', icon: '🎲', minLevel: 5 },
  { id: 4, nameKey: 'social_title_4', icon: '♟️', minLevel: 8 },
  { id: 5, nameKey: 'social_title_5', icon: '👑', minLevel: 12 },
];
function socialTitleName(item){ return t(item.nameKey); }
function titleFor(level){
  let best = TITLES[0];
  for (const t of TITLES){ if (level >= t.minLevel) best = t; }
  return best;
}

const ACHIEVEMENTS = [
  { id: 'first_win', nameKey: 'achievement_first_win', descKey: 'achievement_first_win_desc', icon: '🥇', check: p => (p.totalWins || 0) >= 1 },
  { id: 'win_10', nameKey: 'achievement_win_10', descKey: 'achievement_win_10_desc', icon: '💎', check: p => (p.totalWins || 0) >= 10 },
  { id: 'win_50', nameKey: 'achievement_win_50', descKey: 'achievement_win_50_desc', icon: '🏆', check: p => (p.totalWins || 0) >= 50 },
  { id: 'streak_3', nameKey: 'achievement_streak_3', descKey: 'achievement_streak_3_desc', icon: '🔥', check: p => (p.bestStreak || 0) >= 3 },
  { id: 'streak_5', nameKey: 'achievement_streak_5', descKey: 'achievement_streak_5_desc', icon: '⚡', check: p => (p.bestStreak || 0) >= 5 },
  { id: 'level_5', nameKey: 'achievement_level_5', descKey: 'achievement_level_5_desc', icon: '🎖️', check: p => (p.level || levelFromXp(p.xp || 0)) >= 5 },
  { id: 'all_games', nameKey: 'achievement_all_games', descKey: 'achievement_all_games_desc', icon: '🎯', check: p => ['gomoku','ludo','monopoly','tank','tetris','xiangqi'].every(id => Number((p.played || {})[id]) > 0) },
  { id: 'social', nameKey: 'achievement_social', descKey: 'achievement_social_desc', icon: '🤝', check: p => Object.keys(p.playmates || {}).length >= 3 },
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
  { id: 'play_1', nameKey: 'daily_play_1', icon: '🎮', target: 1, reward: 5, kind: 'play' },
  { id: 'play_3', nameKey: 'daily_play_3', icon: '🕹️', target: 3, reward: 10, kind: 'play' },
  { id: 'win_1', nameKey: 'daily_win_1', icon: '🏅', target: 1, reward: 8, kind: 'win' },
  { id: 'streak_2', nameKey: 'daily_streak_2', icon: '🔥', target: 2, reward: 12, kind: 'streak' },
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
  const pm = profile.playmates[otherUid] || { name: otherName || t('default_player_name'), count: 0, lastAt: 0, games: {} };
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
  card.appendChild(el('h3', null, t('achievements_title')));
  const grid = el('div','ach-grid');
  const earned = achievementsEarned(account || {});
  ACHIEVEMENTS.forEach(a => {
    const item = el('div','ach-item' + (earned.includes(a.id) ? ' earned' : ' locked'));
    item.appendChild(el('span','ach-icon', a.icon));
    const info = el('div','ach-info');
    info.appendChild(el('div','ach-name', t(a.nameKey) + (earned.includes(a.id) ? ' · ' + t('achievement_unlocked') : '')));
    info.appendChild(el('div','ach-desc', t(a.descKey)));
    item.appendChild(info);
    grid.appendChild(item);
  });
  card.appendChild(grid);
  const earnedCount = earned.length;
  card.appendChild(el('div','lb-note', t('achievements_progress', earnedCount, ACHIEVEMENTS.length)));
  const close = el('button','btn',t('close'));
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
    empty.appendChild(el('div', 'my-card-empty-title', t('my_card_login_title')));
    empty.appendChild(el('div', 'my-card-empty-desc', t('my_card_login_desc')));
    const goBtn = el('button', 'btn btn-primary my-card-empty-btn', '🔑 ' + t('login_register'));
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
  info.appendChild(el('div', 'my-card-title', title.icon + ' ' + socialTitleName(title) + ' · ' + t('level_short',lv)));
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
  stat('💵', t('stat_currency'), p.coins || 0);
  stat('⭐', 'XP', p.xp || 0);
  const earnedCount = achievementsEarned(p).length;
  stat('🏆', t('stat_achievements'), earnedCount);
  stat('🔥', t('stat_streak'), p.streak || 0);
  stat('🏆', t('stat_wins'), p.totalWins || 0);
  card.appendChild(stats);
  // 每日任务进度
  const tasks = dailyProgress(p);
  const doneTasks = tasks.filter(t => t.done).length;
  const taskRow = el('div', 'my-card-tasks');
  taskRow.appendChild(el('div', 'my-card-tasks-title', '📋 ' + t('daily_tasks_progress', doneTasks, tasks.length)));
  const taskBar = el('div', 'my-card-taskbar');
  tasks.slice(0, 3).forEach(task => {
    const item = el('div', 'my-card-task' + (task.done ? ' done' : ''));
    item.appendChild(el('span', null, task.icon));
    item.appendChild(el('span', null, t(task.nameKey) + ' ' + task.cur + '/' + task.target));
    taskBar.appendChild(item);
  });
  taskRow.appendChild(taskBar);
  card.appendChild(taskRow);
  // 最近一起玩
  const mates = recentPlaymates(p, 3);
  if (mates.length){
    const mateRow = el('div', 'my-card-mates');
    mateRow.appendChild(el('div', 'my-card-tasks-title', '👥 ' + t('recent_playmates')));
    const list = el('div', 'my-card-mate-list');
    mates.forEach(m => {
      const item = el('button', 'my-card-mate');
      if (String(m.uid || '').startsWith('ai_') && typeof aiMateDisplayName === 'function') {
        item.appendChild(el('span', null, aiMateDisplayName(m.uid, m.name)));
      } else {
        item.appendChild(elRaw('span', null, m.name));
      }
      item.appendChild(el('span', 'my-card-mate-info', t('games_count', m.count)));
      item.addEventListener('click', () => openProfileModal(m.uid));
      list.appendChild(item);
    });
    mateRow.appendChild(list);
    card.appendChild(mateRow);
  }
  // 按钮
  const btns = el('div', 'my-card-btns');
  const shopBtn = el('button', 'btn btn-primary', t('shop'));
  shopBtn.addEventListener('click', openShop);
  btns.appendChild(shopBtn);
  const achBtn = el('button', 'btn', t('achievements_button'));
  achBtn.addEventListener('click', () => openAchievementsModal());
  btns.appendChild(achBtn);
  const profileBtn = el('button', 'btn', '👤 ' + t('my_profile'));
  profileBtn.addEventListener('click', () => openProfileModal(deviceUid));
  btns.appendChild(profileBtn);
  card.appendChild(btns);
  holder.appendChild(card);
}
