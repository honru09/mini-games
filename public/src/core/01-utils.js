/* ================= 通用工具 ================= */
const $ = id => document.getElementById(id);
const PROTOCOL_VERSION = 2;

/* ---------------- 轻量音效（WebAudio，零资源加载） ---------------- */
let _actx = null;
function sfx(kind){
  try {
    const AC = (typeof AudioContext !== 'undefined' && AudioContext) || (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);
    if (!AC) return;
    if (!_actx) _actx = new AC();
    if (_actx.state === 'suspended') _actx.resume();
    const cfg = {
      click: { f: 520, dur: .05, vol: .06, type: 'sine' },
      move:  { f: 680, dur: .06, vol: .05, type: 'triangle' },
      pop:   { f: 440, dur: .04, vol: .04, type: 'sine' },
      place: { f: 540, dur: .09, vol: .07, type: 'triangle' },
      capture:{ f: 220, dur: .12, vol: .08, type: 'sawtooth' },
      score: { f: 760, dur: .10, vol: .07, type: 'triangle' },
      win:   { f: 880, dur: .20, vol: .09, type: 'triangle' },
      lose:  { f: 320, dur: .16, vol: .06, type: 'sine' },
    }[kind] || { f: 440, dur: .05, vol: .05, type: 'sine' };
    const t = _actx.currentTime;
    const osc = _actx.createOscillator();
    const gain = _actx.createGain();
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.f, t);
    if (kind === 'win') osc.frequency.exponentialRampToValueAtTime(cfg.f * 1.5, t + .12);
    gain.gain.setValueAtTime(cfg.vol, t);
    gain.gain.exponentialRampToValueAtTime(.0001, t + cfg.dur);
    osc.connect(gain).connect(_actx.destination);
    osc.start(t);
    osc.stop(t + cfg.dur + .03);
  } catch {}
}
/* 震动反馈（移动端；桌面端静默忽略） */
function haptic(kind){
  try {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    const map = { light: 8, medium: [12, 30, 12], strong: [20, 40, 20, 40, 20], win: [30, 60, 30, 60, 40], lose: [60, 40, 60] };
    navigator.vibrate(map[kind] || map.light);
  } catch {}
}
/* 分级反馈：关键操作重反馈，普通操作轻反馈 */
function playFeedback(kind){
  const fx = {
    tap:     { sfx: 'click',  haptic: 'light' },
    move:    { sfx: 'move',   haptic: 'light' },
    place:   { sfx: 'place',  haptic: 'medium' },
    capture: { sfx: 'capture',haptic: 'strong' },
    score:   { sfx: 'score',  haptic: 'medium' },
    win:     { sfx: 'win',    haptic: 'win' },
    lose:    { sfx: 'lose',   haptic: 'lose' },
  }[kind] || { sfx: 'click', haptic: 'light' };
  sfx(fx.sfx); haptic(fx.haptic);
}
if (typeof document !== 'undefined' && document.addEventListener){
  document.addEventListener('click', function(e){
    if (e.target && e.target.closest && e.target.closest('.btn')) sfx('click');
  });
}
const THEME_LIST = [
  { id: 'light',   icon: '☀️', name: 'Light',   nameZh: '日光' },
  { id: 'midnight',icon: '🌙', name: 'Midnight',nameZh: '午夜' },
  { id: 'ocean',   icon: '🌊', name: 'Ocean',   nameZh: '海洋' },
  { id: 'forest',  icon: '🌲', name: 'Forest',  nameZh: '森林' },
  { id: 'cyber',   icon: '🤖', name: 'Cyber',   nameZh: '赛博' },
  { id: 'sakura',  icon: '🌸', name: 'Sakura',  nameZh: '樱花' },
];
function themeMeta(id){
  if (id === 'dark') id = 'midnight';
  return THEME_LIST.find(t => t.id === id) || THEME_LIST[0];
}
function applyTheme(theme){
  if (theme === 'dark') theme = 'midnight'; // 旧值兼容
  if (document.documentElement && document.documentElement.setAttribute){
    document.documentElement.setAttribute('data-theme', theme);
  }
  const btn = $('btn-theme');
  if (btn){
    const meta = themeMeta(theme);
    if (typeof setButtonIcon === 'function') setButtonIcon(btn,theme === 'light' ? 'moon' : 'sun','',{ariaLabel:'切换主题（当前：'+meta.nameZh+'）',title:'切换主题（当前：'+meta.nameZh+'）',size:19});
    else btn.textContent = meta.icon;
  }
}
function initTheme(){
  let t = 'light';
  try { t = localStorage.getItem('mg_theme') || 'light'; } catch {}
  if (t === 'dark') t = 'midnight';
  applyTheme(t);
}
const PLAYER_COLORS = ['#e5484d','#3b82f6','#22a06b','#f59e0b','#8b5cf6'];
const PLAYER_BG = ['#fdecec','#eaf1fe','#e6f6ef','#fef4e0','#f3eefe'];
const GAMES = {
  gomoku:     { name:'五子棋',     icon:'⚫', desc:'15×15 棋盘，先连成五子获胜', min:2, max:2 },
  ludo:       { name:'飞行棋',     icon:'✈️', desc:'掷骰起飞，四架飞机全部归位获胜', min:2, max:4 },
  monopoly:   { name:'迷你大富翁', icon:'🏙️', desc:'买地收租，坚持到最后的玩家获胜', min:2, max:5 },
  tank:       { name:'坦克大战',   icon:'🛡️', desc:'实时竞技场：走位射击，3 分钟决出胜者', min:2, max:2 },
  tetris:     { name:'俄罗斯方块', icon:'🧱', desc:'同步生存战：消行攻防，坚持到最后获胜', min:2, max:4 },
  xiangqi:    { name:'象棋',       icon:'♞', desc:'经典中国象棋：将死或困毙对方即获胜', min:2, max:2 },
};
const RULES = {
  gomoku: ['15×15 棋盘，两名玩家轮流落子。','先连成横向、竖向或斜向五子者获胜。','支持悔棋，可撤回上一步。'],
  ludo: ['支持 2-4 人，每人 4 架飞机，从基地起飞。','掷出 6 才能起飞，并额外再掷一次。','飞机沿轨道绕行一圈后进入自己的终点航线。','落在对方飞机所在格，可将其击回基地。','点数必须正好够到终点；四架全部归位即获胜。'],
  monopoly: ['支持 2-5 人，轮流掷两颗骰子前进。','走到未购买的地块可购买；他人地块需付租金。','机会卡包含随机事件；经过起点获得 2000。','资金不足即破产出局，地块回归银行。','第 30 轮结束时资产最多者获胜，也可随时提前结算。'],
  tank: ['两名玩家各操控一辆坦克与一座基地。','每回合可移动 1 格（方向键）或开炮（射击键）。','炮弹直线飞行，命中敌方坦克或基地即得分/获胜。','砖墙可被炮弹摧毁，钢墙不可摧毁。','先击毁敌方基地，或先击毁敌方坦克 3 次者获胜。'],
  tetris: ['支持 2-4 人，每人一个 10×18 的方块井。','轮到自己时操控方块：← → 移动、↑ 旋转、↓ 加速下落。','填满一整行即消行得分；方块堆到顶即出局。','每人限时或限固定方块数，结束后得分最高者获胜。','AI 难度适中，适合新手练习。'],
  xiangqi: ['9×10 棋盘，双方各 16 子：将/帅、士、象/相、马、车、炮、兵/卒。','将帅在九宫内走；士斜走九宫；象走田不可过河。','马走日受蹩马腿限制；车直行；炮隔山打；兵过河后可横走。','将帅不能照面；被将军必须应将。','将死对方或对方无子可动即获胜。'],
};

function el(tag, cls, text){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function toast(msg){
  const wrap = $('toast-wrap');
  const t = el('div', 'toast', msg);
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 1900);
}
function showModal(title, lines, btnText){
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.appendChild(el('h3', null, title));
  const ul = el('ul','lines');
  lines.forEach(l => ul.appendChild(el('li', null, l)));
  card.appendChild(ul);
  const ok = el('button','btn btn-primary', btnText || '知道了');
  ok.addEventListener('click', () => bd.remove());
  card.appendChild(ok);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}
function pipsHTML(v){
  const map = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  let h = '';
  for (let i=0;i<9;i++) h += '<span class="pip' + (map[v].includes(i) ? ' on' : '') + '"></span>';
  return h;
}
function prefersReducedMotion(){
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
function animateDice(faces, final, cb){
  if (prefersReducedMotion()){
    faces.forEach(f => { f.innerHTML = pipsHTML(final); f.classList.remove('rolling'); });
    if (cb) cb();
    return;
  }
  faces.forEach(f => f.classList.add('rolling'));
  let tick = 0;
  const iv = setInterval(() => {
    faces.forEach(f => f.innerHTML = pipsHTML(1 + Math.floor(Math.random()*6)));
    if (++tick >= 8){
      clearInterval(iv);
      faces.forEach(f => { f.innerHTML = pipsHTML(final); f.classList.remove('rolling'); });
      if (cb) cb();
    }
  }, 55);
}

/* ---------------- 3D 骰子 ---------------- */
function makeDice3D(size, sm){
  const wrap = el('div', 'dice3d-wrap' + (sm ? ' sm' : ''));
  const die = el('div', 'dice3d');
  wrap.style.width = wrap.style.height = (size + 10) + 'px';
  die.style.width = die.style.height = size + 'px';
  const half = size / 2;
  const faces = [
    [1, 'translateZ(' + half + 'px)'],
    [6, 'rotateY(180deg) translateZ(' + half + 'px)'],
    [3, 'rotateY(90deg) translateZ(' + half + 'px)'],
    [4, 'rotateY(-90deg) translateZ(' + half + 'px)'],
    [2, 'rotateX(90deg) translateZ(' + half + 'px)'],
    [5, 'rotateX(-90deg) translateZ(' + half + 'px)'],
  ];
  for (const [v, tf] of faces){
    const f = el('div', 'face');
    f.style.transform = tf;
    f.innerHTML = pipsHTML(v);
    die.appendChild(f);
  }
  const ROT = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(-90deg) rotateY(0deg)',
    3: 'rotateX(0deg) rotateY(-90deg)',
    4: 'rotateX(0deg) rotateY(90deg)',
    5: 'rotateX(90deg) rotateY(0deg)',
    6: 'rotateX(0deg) rotateY(180deg)',
  };
  let rolling = false;
  let rollInterval = null;
  let settleTimer = null;
  let generation = 0;
  function roll(final, cb){
    if (rolling) return false;
    const gen = ++generation;
    rolling = true;
    if (prefersReducedMotion()){
      die.style.transition = 'none';
      die.style.transform = ROT[final] || ROT[1];
      rolling = false;
      if (cb) cb();
      return true;
    }
    die.style.transition = 'transform .09s linear';
    let i = 0;
    rollInterval = setInterval(() => {
      if (gen !== generation) return;
      i++;
      die.style.transform = 'rotateX(' + Math.floor(Math.random() * 720) + 'deg) rotateY(' + Math.floor(Math.random() * 720) + 'deg)';
      if (i >= 12){
        clearInterval(rollInterval);
        rollInterval = null;
        die.style.transition = 'transform .55s cubic-bezier(.2,.75,.3,1)';
        die.style.transform = ROT[final] || ROT[1];
        settleTimer = setTimeout(() => {
          settleTimer = null;
          if (gen !== generation) return;
          rolling = false;
          if (cb) cb();
        }, 560);
      }
    }, 65);
    return true;
  }
  function reset(){
    generation++;
    if (rollInterval) clearInterval(rollInterval);
    if (settleTimer) clearTimeout(settleTimer);
    rollInterval = null;
    settleTimer = null;
    rolling = false;
    die.style.transition = 'none';
    die.style.transform = ROT[1];
  }
  wrap.appendChild(die);
  return { wrap, die, roll, reset };
}

/* ---------------- AI 助手（DeepSeek 代理） ---------------- */
async function aiChoose(game, state, options, persona){
  const token = (typeof account !== 'undefined' && account && typeof account.authToken === 'string')
    ? account.authToken.trim() : '';
  if (!token || !Array.isArray(options) || !options.length ||
      options.some(option => typeof option !== 'string') ||
      typeof fetch !== 'function' || typeof AbortController === 'undefined') return null;
  const legalOptions = options.slice(0, 200);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const server = resolveServer();
    const url = server ? server.replace(/\/+$/, '') + '/api/ai' : '/api/ai';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ game, state, options: legalOptions, persona: persona || null }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && legalOptions.includes(data.choice) ? data.choice : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
function aiPick(options){
  return options[Math.floor(Math.random() * options.length)];
}

/* ---------------- Loading 工具 ---------------- */
function loadingNode(text){
  const wrap = el('div','loading-inline');
  wrap.appendChild(el('div','loading-spinner'));
  if (text) wrap.appendChild(el('span', null, text));
  return wrap;
}
function setLoading(target, text){
  if (!target) return;
  target.innerHTML = '';
  target.appendChild(loadingNode(text));
}
function clearLoading(target){
  if (!target) return;
  target.innerHTML = '';
}

/* ---------------- 开局倒计时 ---------------- */
function runCountdown(){
  const area = $('board-area');
  if (!area) return;
  const ov = el('div', 'overlay cd-overlay');
  const num = el('div', 'cd-num', '3');
  ov.appendChild(num);
  area.appendChild(ov);
  let n = 3;
  const iv = setInterval(() => {
    n--;
    if (n > 0){
      num.textContent = n;
      num.style.animation = 'none';
      void num.offsetWidth;
      num.style.animation = '';
    } else {
      clearInterval(iv);
      ov.classList.add('fade');
      setTimeout(() => ov.remove(), 260);
    }
  }, 700);
}


/* ====== 统一胜利叠加层 ====== */
function showVictoryOverlay(area, opts) {
  // opts: { winner, winnerName, subtitle, emoji, coins, slot, playerCount, onRestart, onShare, onInvite }
  const ov = el('div', 'overlay victory-overlay');
  const card = el('div', 'overlay-card victory-card');
  
  // 大动画图标
  const big = el('div', 'victory-emoji', opts.emoji || '🏆');
  card.appendChild(big);
  sfx(opts.coins ? 'win' : 'pop');
  
  // 标题
  const title = el('h3', 'victory-title', opts.winnerName 
    ? (opts.winnerName + ' ' + t('result_winner', opts.winner + 1).replace(/🏆 玩家\d+/, '🏆'))
    : t('result_winner', (opts.winner || 0) + 1));
  card.appendChild(title);
  
  // 副标题
  if (opts.subtitle) {
    card.appendChild(el('p', 'victory-subtitle', opts.subtitle));
  }
  
  // 胜利彩带；正式奖励异步由服务端 Reward Breakdown 展示。
  if (opts.coins) {
    // 彩带粒子（CSS 动画，零依赖）
    const CONF_COLORS = ['#f59e0b','#ef4444','#22d3ee','#a78bfa','#f472b6','#34d399','#fbbf24'];
    for (let i = 0; i < 14; i++){
      const cf = el('div','confetti');
      cf.style.left = (8 + Math.random() * 84) + '%';
      cf.style.background = CONF_COLORS[i % CONF_COLORS.length];
      const setCssVar = (k, v) => { if (cf.style && cf.style.setProperty) cf.style.setProperty(k, v); else if (cf.style) cf.style[k] = v; };
      setCssVar('--conf-dur', (1.8 + Math.random() * 1.2) + 's');
      setCssVar('--conf-fall', (300 + Math.random() * 180) + 'px');
      setCssVar('--conf-rot', (300 + Math.random() * 500) + 'deg');
      cf.style.animationDelay = (Math.random() * 0.35) + 's';
      ov.appendChild(cf);
    }
  }
  
  // 按钮行
  const btnRow = el('div', 'victory-btns');
  
  const again = el('button', 'btn btn-primary victory-btn', t('come_back'));
  again.addEventListener('click', () => {
    ov.remove();
    if (opts.onRestart) opts.onRestart();
  });
  btnRow.appendChild(again);
  
  if (opts.onInvite) {
    const invite = el('button', 'btn victory-btn', t('invite_player'));
    invite.addEventListener('click', opts.onInvite);
    btnRow.appendChild(invite);
  }
  
  if (opts.onShare) {
    const share = el('button', 'btn victory-btn', '📤 分享');
    share.addEventListener('click', opts.onShare);
    btnRow.appendChild(share);
  }
  
  card.appendChild(btnRow);
  ov.appendChild(card);
  
  // 点击背景关闭
  ov.addEventListener('click', e => { 
    if (e.target === ov) { ov.remove(); }
  });
  
  area.appendChild(ov);
}


/* ====== 分享 & 邀请 ====== */
function shareGameLink(gameId, roomCode) {
  const base = location.origin + location.pathname;
  let url = base;
  if (roomCode) {
    url += '#join=' + roomCode;
  } else if (gameId) {
    url += '#game=' + gameId + '&p=2';
  }
  const text = '来 Playroom 一起玩' + (gameId && GAMES[gameId] ? GAMES[gameId].name : '小游戏') + '！';
  if (navigator.share) {
    navigator.share({ title: 'Playroom', text: text, url: url }).catch(() => {});
  } else {
    try { navigator.clipboard.writeText(url); toast('📋 链接已复制，发送给朋友即可加入'); } catch(e) {}
  }
  toast('📤 分享链接：' + url);
}

/* ====== 触屏归一化 ====== */
// 为 canvas 元素提供统一的触摸/鼠标坐标提取
function getEventPos(e, element) {
  const rect = element.getBoundingClientRect();
  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
    px: clientX - rect.left,
    py: clientY - rect.top,
  };
}

// 阻止双击缩放（在游戏区内）
if (typeof document !== 'undefined' && document.addEventListener){
  document.addEventListener('dblclick', function(e) {
    if (e.target.closest && (e.target.closest('#board-area') || e.target.closest('canvas'))) {
      e.preventDefault();
    }
  }, { passive: false });
}
