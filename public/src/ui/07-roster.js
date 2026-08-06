/* ================= 用户档案与积分 ================= */
const AVATAR_COUNT = 56; // 0-29 免费，30-55 商城（4 分类）
const CURRENCY = '$';
const AVATAR_CATEGORIES = [
  { id: 'fantasy', name: '👑 幻想', icon: '👑' },
  { id: 'animals', name: '🐾 动物', icon: '🐾' },
  { id: 'profession', name: '💼 职业', icon: '💼' },
  { id: 'creative', name: '🎨 创意', icon: '🎨' },
];

const SHOP = {
  avatars: [
    { id: 30, name: '天使', price: 8, category: 'fantasy' },
    { id: 31, name: '吸血鬼', price: 10, category: 'fantasy' },
    { id: 32, name: '精灵', price: 10, category: 'fantasy' },
    { id: 33, name: '人鱼', price: 12, category: 'fantasy' },
    { id: 34, name: '凤凰战士', price: 15, category: 'fantasy' },
    { id: 35, name: '暗影刺客', price: 15, category: 'fantasy' },
    { id: 36, name: '猫咪', price: 6, category: 'animals' },
    { id: 37, name: '柴犬', price: 6, category: 'animals' },
    { id: 38, name: '兔子', price: 8, category: 'animals' },
    { id: 39, name: '小熊', price: 8, category: 'animals' },
    { id: 40, name: '狐狸', price: 10, category: 'animals' },
    { id: 41, name: '熊猫', price: 12, category: 'animals' },
    { id: 42, name: '医生', price: 8, category: 'profession' },
    { id: 43, name: '厨师', price: 8, category: 'profession' },
    { id: 44, name: '画家', price: 10, category: 'profession' },
    { id: 45, name: '音乐家', price: 10, category: 'profession' },
    { id: 46, name: '运动员', price: 12, category: 'profession' },
    { id: 47, name: '科学家', price: 12, category: 'profession' },
    { id: 48, name: '彩虹', price: 8, category: 'creative' },
    { id: 49, name: '霓虹', price: 10, category: 'creative' },
    { id: 50, name: '像素英雄', price: 10, category: 'creative' },
    { id: 51, name: '故障艺术', price: 12, category: 'creative' },
    { id: 52, name: '宇宙', price: 15, category: 'creative' },
    { id: 53, name: '暗影', price: 15, category: 'creative' },
    { id: 54, name: '金冠骑士', price: 8, category: 'fantasy' },
    { id: 55, name: '龙骑士', price: 20, category: 'fantasy' },
  ],
  frames: [
    { id: 1, name: '金色边框', price: 5, cls: 'frame-1' },
    { id: 2, name: '霓虹边框', price: 8, cls: 'frame-2' },
    { id: 3, name: '紫焰边框', price: 12, cls: 'frame-3' },
    { id: 4, name: '极光光环', price: 16, cls: 'frame-4' },
    { id: 5, name: '流金脉冲', price: 18, cls: 'frame-5' },
    { id: 6, name: '烈焰环绕', price: 22, cls: 'frame-6' },
    { id: 7, name: '彩虹流光', price: 26, cls: 'frame-7' },
    { id: 8, name: '赛博脉冲', price: 30, cls: 'frame-8' },
  ],
  effects: [
    { id: 1, name: '呼吸光效', price: 6, cls: 'effect-1' },
    { id: 2, name: '闪耀星光', price: 9, cls: 'effect-2' },
    { id: 3, name: '漂浮',     price: 9, cls: 'effect-3' },
    { id: 4, name: '环绕旋转', price: 15, cls: 'effect-4' },
  ],
  backgrounds: [
    { id: 1, name: '薰衣草紫', price: 3, cls: 'bg-1' },
    { id: 2, name: '天空蓝',   price: 3, cls: 'bg-2' },
    { id: 3, name: '日落橙',   price: 3, cls: 'bg-3' },
    { id: 4, name: '森林绿',   price: 3, cls: 'bg-4' },
    { id: 5, name: '樱花粉',   price: 3, cls: 'bg-5' },
    { id: 6, name: '暗夜',     price: 5, cls: 'bg-6' },
    { id: 7, name: '星空闪烁', price: 10, cls: 'bg-7' },
    { id: 8, name: '樱花飘落', price: 10, cls: 'bg-8' },
    { id: 9, name: '赛博矩阵', price: 14, cls: 'bg-9' },
    { id: 10, name: '海洋波浪', price: 12, cls: 'bg-10' },
  ],
};
function avatarMeta(idx){
  const p = SHOP.avatars.find(a => a.id === idx);
  return p ? p : null;
}
function nameFxNode(profile, name){
  const fx = profile && profile.nameFx ? Number(profile.nameFx) : 0;
  const span = el('span', fx >= 1 && fx <= 4 ? 'name-fx-' + fx : null, name || '');
  return span;
}
function nameFxLabel(fx){
  return ['无效果','渐变流光','辉光','彩虹','赛博渐变'][fx] || '无效果';
}
function avatarCategory(idx) {
  if (idx < 20) return 'basic';           // 0-19 基础生成头像（免费）
  if (idx < 30) return 'theme';           // 20-29 主题头像（免费）
  const meta = SHOP.avatars.find(a => a.id === idx);
  return meta ? meta.category : 'creative'; // 30-55 商城头像
}
function avatarLocked(idx){
  return idx >= 30 && !ownItem(account, 'avatars', idx);
}
function avatarPrice(idx){
  const meta = SHOP.avatars.find(a => a.id === idx);
  return meta ? meta.price : 0;
}
function ownItem(acc, kind, id){
  if (!acc) return false;
  const list = (acc.owned && acc.owned[kind]) || [];
  return list.includes(id);
}
function addOwned(acc, kind, id){
  if (!acc) return;
  if (!acc.owned) acc.owned = { avatars: [], frames: [], effects: [], backgrounds: [] };
  if (!acc.owned[kind]) acc.owned[kind] = [];
  if (!acc.owned[kind].includes(id)) acc.owned[kind].push(id);
}
function makeAvatar(idx){
  const BG = ['#fde68a','#fbcfe8','#bfdbfe','#bbf7d0','#e9d5ff','#fed7aa','#a5f3fc','#fecaca'];
  const SKIN = ['#ffdbac','#f1c27d','#e0ac69','#c68642','#8d5524','#ffe0bd'];
  const HAIR = ['#1f2937','#6b4226','#eab308','#dc2626','#2563eb','#ec4899'];
  const SHIRT = ['#ef4444','#3b82f6','#22c55e','#eab308','#a855f7','#14b8a6'];
  if (idx >= 20){
    const PRE = [
      { bg:'#fef08a', skin:'#ffdbac', hair:'#d97706', shirt:'#f59e0b', hat:'#fbbf24', glasses:true, crown:true },
      { bg:'#c7d2fe', skin:'#f1c27d', hair:'#e5e7eb', shirt:'#6366f1', visor:true },
      { bg:'#fecaca', skin:'#e0ac69', hair:'#b91c1c', shirt:'#dc2626', horns:true },
      { bg:'#a5f3fc', skin:'#cbd5e1', hair:'#64748b', shirt:'#0ea5e9', antenna:true, robot:true },
      { bg:'#bbf7d0', skin:'#c68642', hair:'#111827', shirt:'#16a34a', mask:true },
      { bg:'#dbeafe', skin:'#f1c27d', hair:'#78350f', shirt:'#f97316', eyePatch:true },
      { bg:'#ddd6fe', skin:'#ffe0bd', hair:'#7c3aed', shirt:'#8b5cf6', hat:true, stars:true },
      { bg:'#fde68a', skin:'#ffdbac', hair:'#1e40af', shirt:'#3b82f6', crown:true, scales:true },
      { bg:'#fef7cd', skin:'#e0ac69', hair:'#ca8a04', shirt:'#84cc16', blush:true, antenna:true },
      { bg:'#fce4ec', skin:'#ffdbac', hair:'#ad1457', shirt:'#f06292', hat:true, blush:true, stars:true },
    ];
    // New: indices 30-55, 26 premium avatars across 4 categories
    const PRE2 = [
      { bg:'#f0f9ff', skin:'#ffe0bd', hair:'#fde047', shirt:'#f8fafc', hat:true, stars:true },                      // 30 天使
      { bg:'#1e1b2e', skin:'#ffdbac', hair:'#111827', shirt:'#7f1d1d', glasses:true, crown:true },                  // 31 吸血鬼
      { bg:'#d4fae8', skin:'#ffe0bd', hair:'#22d3ee', shirt:'#10b981', hat:true, blush:true },                       // 32 精灵
      { bg:'#c7d2fe', skin:'#ffdbac', hair:'#ec4899', shirt:'#06b6d4', stars:true, scales:true },                    // 33 人鱼
      { bg:'#fef2f2', skin:'#f1c27d', hair:'#ef4444', shirt:'#f97316', crown:true, stars:true },                     // 34 凤凰
      { bg:'#0f0f23', skin:'#e0ac69', hair:'#6b21a8', shirt:'#1e1b4b', mask:true, horns:true },                      // 35 暗影
      { bg:'#fce7f3', skin:'#ffdbac', hair:'#be185d', shirt:'#f472b6', blush:true, hat:true },                       // 36 猫咪
      { bg:'#fef3c7', skin:'#f1c27d', hair:'#d97706', shirt:'#fbbf24', blush:true, glasses:false },                  // 37 柴犬
      { bg:'#fdf2f8', skin:'#ffe0bd', hair:'#f9a8d4', shirt:'#ec4899', blush:true, hat:false },                      // 38 兔子
      { bg:'#fef7ed', skin:'#c68642', hair:'#92400e', shirt:'#d97706', hat:false, blush:true },                      // 39 小熊
      { bg:'#fff7ed', skin:'#ffdbac', hair:'#ea580c', shirt:'#f97316', blush:true, glasses:false },                  // 40 狐狸
      { bg:'#ecfdf5', skin:'#ffe0bd', hair:'#111827', shirt:'#10b981', eyePatch:true, blush:true },                  // 41 熊猫
      { bg:'#eff6ff', skin:'#ffdbac', hair:'#1e40af', shirt:'#60a5fa', hat:true, glasses:false },                    // 42 医生
      { bg:'#fefce8', skin:'#f1c27d', hair:'#713f12', shirt:'#f8fafc', hat:true, blush:true },                       // 43 厨师
      { bg:'#f5f3ff', skin:'#e0ac69', hair:'#7c3aed', shirt:'#a78bfa', hat:true, stars:true },                       // 44 画家
      { bg:'#1e293b', skin:'#ffdbac', hair:'#fde047', shirt:'#334155', glasses:true, hat:false },                    // 45 音乐家
      { bg:'#f0fdf4', skin:'#f1c27d', hair:'#166534', shirt:'#22c55e', hat:true, blush:false },                      // 46 运动员
      { bg:'#f8fafc', skin:'#ffe0bd', hair:'#475569', shirt:'#94a3b8', glasses:true, antenna:true },                 // 47 科学家
      { bg:'#fefce8', skin:'#ffdbac', hair:'#eab308', shirt:'#fde047', stars:true, crown:false },                    // 48 彩虹
      { bg:'#0f172a', skin:'#f1c27d', hair:'#22d3ee', shirt:'#e11d48', glasses:true, visor:true },                   // 49 霓虹
      { bg:'#f0fdf4', skin:'#e0ac69', hair:'#22c55e', shirt:'#7c3aed', visor:false, robot:true },                    // 50 像素英雄
      { bg:'#18181b', skin:'#cbd5e1', hair:'#a1a1aa', shirt:'#dc2626', mask:true, antenna:true },                    // 51 故障
      { bg:'#020617', skin:'#ffe0bd', hair:'#38bdf8', shirt:'#6366f1', stars:true, visor:true },                     // 52 宇宙
      { bg:'#0f0f23', skin:'#ffdbac', hair:'#6b21a8', shirt:'#312e81', mask:true, horns:true },                      // 53 暗影
      { bg:'#fef08a', skin:'#ffdbac', hair:'#d97706', shirt:'#f59e0b', hat:'#fbbf24', glasses:true, crown:true },    // 54 金冠骑士
      { bg:'#fde68a', skin:'#ffdbac', hair:'#1e40af', shirt:'#3b82f6', crown:true, scales:true },                    // 55 龙骑士
    ];
    let P;
    if (idx >= 20 && idx <= 29) P = PRE[idx - 20];
    else if (idx >= 30) P = PRE2[idx - 30];
    else return {
      bg: BG[idx % 8], skin: SKIN[Math.floor(idx / 3) % 6], hair: HAIR[(idx * 2 + 1) % 6],
      shirt: SHIRT[(idx * 3) % 6], style: idx % 4, glasses: idx % 4 === 1,
      blush: idx % 3 === 0, hat: idx % 5 === 0,
    };
    return {
      bg: P.bg, skin: P.skin, hair: P.hair, shirt: P.shirt,
      style: (idx * 3) % 4, glasses: !!P.glasses, blush: idx % 2 === 0, hat: !!P.hat,
      crown: !!P.crown, visor: !!P.visor, horns: !!P.horns, antenna: !!P.antenna, robot: !!P.robot,
      mask: !!P.mask, eyePatch: !!P.eyePatch, stars: !!P.stars, scales: !!P.scales,
    };
  }
  return {
    bg: BG[idx % 8],
    skin: SKIN[Math.floor(idx / 3) % 6],
    hair: HAIR[(idx * 2 + 1) % 6],
    shirt: SHIRT[(idx * 3) % 6],
    style: idx % 4,
    glasses: idx % 4 === 1,
    blush: idx % 3 === 0,
    hat: idx % 5 === 0,
  };
}
function avatarCanvas(idx, size){
  size = size || 40;
  const st = makeAvatar(idx);
  const off = document.createElement('canvas');
  off.width = 16; off.height = 16;
  const octx = off.getContext('2d');
  const img = octx.createImageData(16, 16);
  const px = (x, y, col) => {
    if (x < 0 || x > 15 || y < 0 || y > 15) return;
    const i = (y * 16 + x) * 4;
    img.data[i] = parseInt(col.slice(1,3), 16);
    img.data[i+1] = parseInt(col.slice(3,5), 16);
    img.data[i+2] = parseInt(col.slice(5,7), 16);
    img.data[i+3] = 255;
  };
  const rect = (x0, y0, x1, y1, col) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) px(x, y, col); };
  rect(0, 0, 15, 15, st.bg);
  if (st.style === 2) rect(3, 2, 12, 12, st.hair); // 长发打底
  rect(6, 12, 9, 15, st.shirt);                    // 衣服
  rect(4, 3, 11, 12, st.skin);                     // 脸
  px(3, 7, st.skin); px(12, 7, st.skin);           // 耳朵
  if (st.style === 0){                              // 短发
    rect(3, 0, 12, 5, st.hair); rect(3, 3, 4, 6, st.hair); rect(11, 3, 12, 6, st.hair);
  } else if (st.style === 1){                       // 尖刺头
    rect(3, 1, 12, 4, st.hair); px(4, 0, st.hair); px(6, 0, st.hair); px(8, 0, st.hair); px(11, 0, st.hair);
    rect(3, 4, 4, 5, st.hair); rect(11, 4, 12, 5, st.hair);
  } else if (st.style === 2){                       // 长发
    rect(3, 3, 3, 10, st.hair); rect(12, 3, 12, 10, st.hair); rect(4, 1, 11, 4, st.hair);
  } else {                                          // 光头 + 刘海
    rect(4, 1, 11, 3, st.hair); px(4, 4, st.hair); px(7, 4, st.hair); px(11, 4, st.hair);
  }
  if (st.hat){ rect(2, 0, 13, 3, '#ef4444'); rect(1, 4, 14, 4, '#dc2626'); }
  if (st.crown){
    px(3, 0, '#fbbf24'); px(5, 0, '#fbbf24'); px(7, 0, '#fbbf24'); px(9, 0, '#fbbf24'); px(11, 0, '#fbbf24');
    rect(2, 1, 12, 3, '#f59e0b'); px(6, 2, '#fde047');
  }
  if (st.visor){ rect(2, 5, 13, 8, '#0f172a'); rect(4, 6, 11, 7, '#38bdf8'); }
  if (st.horns){ px(4, 1, '#f59e0b'); px(11, 1, '#f59e0b'); px(4, 2, '#fbbf24'); px(11, 2, '#fbbf24'); }
  if (st.antenna){ px(7, 0, '#94a3b8'); px(7, 1, '#ef4444'); }
  if (st.mask){ rect(5, 7, 10, 8, '#111827'); px(6, 7, '#ef4444'); px(9, 7, '#ef4444'); }
  if (st.eyePatch){ rect(8, 6, 10, 8, '#111827'); rect(9, 8, 9, 9, '#78350f'); }
  if (st.stars){ px(2, 2, '#fde047'); px(13, 3, '#fde047'); px(3, 12, '#fde047'); px(12, 13, '#fde047'); }
  if (st.scales){ px(3, 12, '#22d3ee'); px(5, 12, '#22d3ee'); px(10, 12, '#22d3ee'); px(12, 12, '#22d3ee'); }
  if (st.glasses){
    rect(5, 7, 6, 8, '#111827'); rect(8, 7, 9, 8, '#111827'); px(7, 7, '#111827');
  } else {
    px(6, 7, '#1f2937'); px(9, 7, '#1f2937');
  }
  if (st.blush){ px(5, 9, '#fda4af'); px(10, 9, '#fda4af'); }
  rect(7, 10, 8, 10, '#b45309'); // 嘴
  octx.putImageData(img, 0, 0);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, size, size);
  return c;
}
function avatarStageNode(profile, size, extraCls){
  const st = el('span', 'mini-avatar-stage' + (extraCls ? ' ' + extraCls : ''));
  st.setAttribute('data-uid', profile && profile.uid || '');
  const fr = profile && profile.frame || 0;
  const fx = profile && profile.effect || 0;
  if (fr) st.appendChild(el('span', 'frame-ring ' + (SHOP.frames.find(f => f.id === fr) ? SHOP.frames.find(f => f.id === fr).cls : ''), ''));
  const cv = avatarCanvas(profile ? profile.avatar : 0, size || 22);
  st.appendChild(cv);
  if (fx) st.classList.add(SHOP.effects.find(e => e.id === fx) ? SHOP.effects.find(e => e.id === fx).cls : '');
  return st;
}
const GAME_KEYS = Object.keys(GAMES);
const LS_ROSTER = 'mg_roster';
const LS_ACCOUNT = 'mg_account';
let roster = [];
let account = null;
let deviceUid = null;
let slots = [];
let lastServerLB = null;
let lbFilter = 'all';
let authModalEl = null;

function deviceFingerprint(){
  let s = '';
  try { s += (navigator.userAgent || '') + '|'; } catch {}
  try { s += (navigator.language || '') + '|'; } catch {}
  try { s += String(screen.width) + 'x' + String(screen.height) + '|'; } catch {}
  try { s += String(navigator.hardwareConcurrency || 0) + '|'; } catch {}
  try { s += (Intl.DateTimeFormat().resolvedOptions().timeZone || '') + '|'; } catch {}
  try { s += (navigator.platform || '') + '|'; } catch {}
  let h1 = 0, h2 = 0;
  for (let i = 0; i < s.length; i++){
    h1 = (h1 * 31 + s.charCodeAt(i)) | 0;
    h2 = (h2 * 33 + s.charCodeAt(i)) | 0;
  }
  return 'd' + Math.abs(h1).toString(36) + Math.abs(h2).toString(36);
}
function defaultOwned(){
  return {
    avatars: Array.from({ length: 30 }, (_, i) => i), // 0-19 free
    frames: [0], effects: [0], backgrounds: [0],
  };
}
function loadRoster(){
  try {
    const raw = localStorage.getItem(LS_ROSTER);
    roster = raw ? JSON.parse(raw) : [];
  } catch { roster = []; }
  if (!Array.isArray(roster)) roster = [];
  roster.forEach(p => {
    if (p.coins === undefined) p.coins = p.points ? 1 : 0;
    delete p.points;
    if (!p.played) p.played = {};
    if (!p.total) p.total = 0;
  });
  try {
    const raw = localStorage.getItem(LS_ACCOUNT);
    account = raw ? JSON.parse(raw) : null;
  if (account && !account.lang) account.lang = 'zh-CN';
  } catch { account = null; }
  if (account && account.uid && account.device === deviceFingerprint()){
    deviceUid = account.uid;
    const me = roster.find(p => p.uid === account.uid);
    if (!me) roster.unshift({ uid: account.uid, name: account.name, avatar: account.avatar, coins: account.coins || 0, played: account.played || {}, total: account.total || 0 });
  } else {
    deviceUid = null;
  }
  try { localStorage.setItem('mg_uid', deviceUid || ''); } catch {}
}
function saveRoster(){ try { localStorage.setItem(LS_ROSTER, JSON.stringify(roster)); } catch {} }
function saveAccount(){ try { localStorage.setItem(LS_ACCOUNT, JSON.stringify(account)); } catch {} }
function genUid(){
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'u_' + crypto.randomUUID().slice(0, 8);
  return 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function profileByUid(uid){ return roster.find(p => p.uid === uid); }
function createProfile(name, avatar){
  const p = { uid: genUid(), name: name || '玩家', avatar: (avatar === undefined ? Math.floor(Math.random() * AVATAR_COUNT) : avatar), coins: 0, played: {}, total: 0 };
  roster.push(p);
  saveRoster();
  return p.uid;
}
function syncProfiles(){
  if (!online.connected) return;
  if (account && account.uid){
    online.send({ type: 'profile', payload: {
      lang: account.lang || currentLang,
      uid: account.uid, name: account.name, avatar: account.avatar, xp: account.xp || 0, level: account.level || 1, streak: account.streak || 0, bestStreak: account.bestStreak || 0,
      background: account.background || 0, frame: account.frame || 0, effect: account.effect || 0,
      owned: account.owned || defaultOwned(), nameFx: account.nameFx || 0,
    } });
  }
}
function registerAccount(name, pin, avatar, background, frame, effect){
  name = String(name || '').trim().slice(0, 12) || '玩家';
  pin = String(pin || '').trim();
  if (!/^[A-Za-z0-9]{4,20}$/.test(pin)){
    toast('PIN 只能包含字母和数字，长度 4-20 位');
    return null;
  }
  const uid = genUid();
  account = {
    uid, pin, name, lang: currentLang,
    avatar: Number.isInteger(avatar) ? Math.max(0, Math.min(AVATAR_COUNT - 1, avatar)) : 0,
    background: Number.isInteger(background) ? Math.max(0, background) : 0,
    frame: Number.isInteger(frame) ? Math.max(0, frame) : 0,
    effect: Number.isInteger(effect) ? Math.max(0, effect) : 0,
    owned: defaultOwned(), coins: 0, played: {}, total: 0, device: deviceFingerprint(), nameFx: 0,
  };
  const me = roster.find(p => p.uid === uid);
  if (me){ me.name = name; me.avatar = account.avatar; }
  else roster.unshift({ uid, name, avatar: account.avatar, coins: 0, played: {}, total: 0 });
  deviceUid = uid;
  saveRoster(); saveAccount();
  if (online.connected){
    online.send({ type: 'register', payload: {
      uid, pin, name, avatar: account.avatar, background: account.background,
      lang: currentLang,
      frame: account.frame, effect: account.effect, owned: account.owned,
    } });
  }
  renderMe(); renderSlots(); renderLeaderboard();
  if (authModalEl) authModalEl.remove();
  authModalEl = null;
  return account;
}
function loginAccount(pin){
  pin = String(pin || '').trim();
  if (!/^[A-Za-z0-9]{4,20}$/.test(pin)){ toast('PIN 只能包含字母和数字，长度 4-20 位'); return; }
  if (!online.connected){ toast('请先连接服务器后再登录'); return; }
  online.send({ type: 'login', payload: { pin } });
}
function logoutAccount(){
  account = null;
  deviceUid = null;
  try { localStorage.removeItem(LS_ACCOUNT); localStorage.setItem('mg_uid', ''); } catch {}
  renderMe(); renderSlots(); renderLeaderboard();
  openAuthModal("login");
}
function updateAccountProfile(p){
  if (!account) return;
  account.uid = p.uid; account.name = p.name; account.avatar = p.avatar;
  account.background = p.background || 0; account.frame = p.frame || 0; account.effect = p.effect || 0;
  account.owned = p.owned || defaultOwned(); account.coins = p.coins || 0;
  account.xp = p.xp || 0; account.level = p.level || 1; account.streak = p.streak || 0; account.bestStreak = p.bestStreak || 0;
  account.played = p.played || {}; account.total = p.total || 0; account.lang = p.lang || account.lang || 'zh-CN';
  const me = roster.find(x => x.uid === p.uid);
  if (me){ me.name = p.name; me.avatar = p.avatar; me.coins = p.coins || 0; me.xp = p.xp || 0; me.level = p.level || 1; me.streak = p.streak || 0; me.bestStreak = p.bestStreak || 0; me.played = p.played || {}; me.total = p.total || 0; }
  else roster.unshift({ uid: p.uid, name: p.name, avatar: p.avatar, coins: p.coins || 0, played: p.played || {}, total: p.total || 0 });
  deviceUid = p.uid;
  account.nameFx = p.nameFx || 0;
  account.achievements = p.achievements || [];
  account.playmates = p.playmates || {};
  account.daily = p.daily || { play: 0, win: 0, streak: 0 };
  saveRoster(); saveAccount();
}
function renderMe(){
  const btn = $('btn-me');
  if (!account){
    btn.classList.add('logged-out');
    btn.innerHTML = '';
    btn.appendChild(el('span','me-av','🔑'));
    btn.appendChild(el('span', null, t('login_register')));
    btn.title = '创建账号或使用 PIN 登录';
    return;
  }
  btn.classList.remove('logged-out');
  const me = profileByUid(deviceUid);
  if (!me) return;
  btn.innerHTML = '';
  const av = el('span','me-av');
  av.appendChild(avatarStageNode(account, 26));
  btn.appendChild(av);
  btn.appendChild(nameFxNode(account, account.name + ' ' + langFlag(account.lang || currentLang)));
  const lv = account.level || levelFromXp(account.xp || 0);
  const title = titleFor(lv);
  btn.appendChild(el('span','me-title', title.icon + ' ' + title.name));
  const lvBadge = el('span','level-badge', 'Lv.' + lv);
  btn.appendChild(lvBadge);
  const coinLine = el('span','coin-line');
  coinLine.appendChild(el('span','coin','$'));
  coinLine.appendChild(el('span','me-pts', (account.coins || 0) + ' · ' + (account.total || 0) + '局'));
  btn.appendChild(coinLine);
  renderMyCard();
  if (online.connected){
    btn.appendChild(el('span','me-online','●'));
  }
  btn.title = '查看我的档案';
}
function renderSlots(){
  const row = $('slots-row');
  row.innerHTML = '';
  for (let i = 0; i < playerCount; i++){
    if (aiMode && i > 0){
      const chip = el('button','slot-chip ai');
      chip.type = 'button';
      chip.appendChild(el('span','av','🤖'));
      chip.appendChild(el('span','nm','AI 玩家' + i));
      chip.appendChild(el('span','pts','电脑对手'));
      row.appendChild(chip);
      continue;
    }
    const uid = slots[i];
    const p = uid ? profileByUid(uid) : null;
    const chip = el('button','slot-chip' + (p ? ' set' : ''));
    chip.type = 'button';
    if (p){
      const av = el('span','av');
      const prof = p.uid === (account && account.uid) ? account : p;
      av.appendChild(avatarStageNode(prof, 30));
      chip.appendChild(av);
      chip.appendChild(el('span','nm', p.name));
      const coinLine = el('span','coin-line');
      coinLine.appendChild(el('span','coin sm','$'));
      coinLine.appendChild(el('span','pts', (p.coins || 0) + ' · ' + (p.total || 0) + '局'));
      chip.appendChild(coinLine);
    } else {
      chip.appendChild(el('span','av','➕'));
      chip.appendChild(el('span','nm','玩家' + (i+1)));
      chip.appendChild(el('span','pts','点击设置档案'));
    }
    chip.addEventListener('click', () => openSlotPicker(i));
    row.appendChild(chip);
  }
}
function ensureSlots(){
  slots = slots.slice(0, playerCount);
  while (slots.length < playerCount) slots.push(null);
  if (deviceUid) slots[0] = deviceUid;
  if (aiMode){
    for (let i = 1; i < slots.length; i++) slots[i] = null;
    return;
  }
  for (let i = 0; i < playerCount; i++){
    if (!slots[i]) slots[i] = createProfile('玩家' + (i+1));
  }
}
function openSlotPicker(i){
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.appendChild(el('h3', null, '为 玩家' + (i+1) + ' 选择档案'));
  const list = el('div','roster-list');
  roster.forEach(p => {
    const item = el('button','roster-item');
    item.type = 'button';
    const av = el('span','av');
    av.appendChild(avatarCanvas(p.avatar, 24));
    item.appendChild(av);
    item.appendChild(el('span','nm', p.name));
      item.appendChild(el('span','lb-game', '$' + (p.coins || 0) + ' · ' + (p.total || 0) + '局'));
    item.addEventListener('click', () => {
      slots[i] = p.uid;
      bd.remove();
      renderSlots();
    });
    list.appendChild(item);
  });
  const create = el('button','btn btn-primary','＋ 新建档案');
  create.addEventListener('click', () => {
    bd.remove();
    openProfileEditor(null, i);
  });
  const cancel = el('button','btn','取消');
  cancel.addEventListener('click', () => bd.remove());
  card.appendChild(list);
  card.appendChild(create);
  card.appendChild(cancel);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
}
function openProfileEditor(uid, slotIndex){
  const editing = uid ? profileByUid(uid) : null;
  const editingMe = !!(account && uid === account.uid);
  let name = editing ? editing.name : '';
  let avatar = editing ? editing.avatar : Math.floor(Math.random() * AVATAR_COUNT);
  let background = editingMe ? (account.background || 0) : 0;
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.appendChild(el('h3', null, editing ? '编辑档案' : '新建档案'));
  const input = el('input','nick-input');
  input.type = 'text';
  input.maxLength = 12;
  input.placeholder = '输入昵称（12 字以内）';
  input.value = name;
  card.appendChild(input);
  const catLabel = el('div','lb-note','选择头像（0-29 免费，30+ 商城）');
  card.appendChild(catLabel);
  const editorCats = el('div','shop-tabs');
  const editorCatsDef = [
    { id:'all', name:'全部' }, { id:'basic', name:'🎲 基础' }, { id:'theme', name:'✨ 主题' },
    { id:'fantasy', name:'👑 幻想' }, { id:'animals', name:'🐾 动物' },
    { id:'profession', name:'💼 职业' }, { id:'creative', name:'🎨 创意' },
  ];
  let editorCat = 'all';
  const grid = el('div','avatar-grid');
  function renderEditorGrid(){
    grid.innerHTML = '';
    for (let i = 0; i < AVATAR_COUNT; i++){
      if (editorCat !== 'all' && avatarCategory(i) !== editorCat) continue;
      const locked = avatarLocked(i);
      const opt = el('button','avatar-opt' + (i === avatar ? ' selected' : '') + (locked ? ' locked' : ''));
      opt.type = 'button';
      opt.appendChild(avatarCanvas(i, 26));
      opt.setAttribute('aria-label', '头像 ' + (i+1));
      if (locked){
        opt.appendChild(el('span','avatar-lock','🔒' + (avatarPrice(i) ? '$' + avatarPrice(i) : '')));
        opt.addEventListener('click', () => {
          const meta = avatarMeta(i);
          toast('「' + (meta ? meta.name : '头像') + '」需在商城购买（$' + (meta ? meta.price : 0) + '）');
        });
      } else {
        opt.addEventListener('click', () => {
          avatar = i;
          grid.querySelectorAll('.avatar-opt').forEach(o => o.classList.toggle('selected', o === opt));
        });
      }
      grid.appendChild(opt);
    }
  }
  editorCatsDef.forEach(c => {
    const tb = el('button','btn shop-tab' + (editorCat === c.id ? ' btn-primary' : ''));
    tb.textContent = c.name;
    tb.addEventListener('click', () => {
      editorCat = c.id;
      editorCats.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('btn-primary'));
      tb.classList.add('btn-primary');
      renderEditorGrid();
    });
    editorCats.appendChild(tb);
  });
  card.appendChild(editorCats);
  card.appendChild(grid);
  renderEditorGrid();
  if (editingMe){
    card.appendChild(el('div','lb-note','背景'));
    const bgGrid = el('div','bg-grid');
    SHOP.backgrounds.forEach(b => {
      const sw = el('div','bg-swatch' + (b.id === background ? ' selected' : '') + ' ' + b.cls);
      sw.title = b.name;
      sw.addEventListener('click', () => {
        if (!ownItem(account, 'backgrounds', b.id)){ toast('背景「' + b.name + '」需在商城购买'); return; }
        background = b.id;
        bgGrid.querySelectorAll('.bg-swatch').forEach(x => x.classList.toggle('selected', x === sw));
      });
      bgGrid.appendChild(sw);
    });
    card.appendChild(bgGrid);
    card.appendChild(el('div','lb-note','昵称效果'));
    const fxRow = el('div','bg-grid');
    for (let fx = 0; fx <= 4; fx++){
      const fxBtn = el('button','btn shop-tab' + (fx === (account.nameFx || 0) ? ' btn-primary' : ''));
      fxBtn.type = 'button';
      fxBtn.textContent = nameFxLabel(fx);
      fxBtn.addEventListener('click', () => {
        account.nameFx = fx;
        fxRow.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('btn-primary'));
        fxBtn.classList.add('btn-primary');
        saveAccount(); syncProfiles(); renderMe();
      });
      fxRow.appendChild(fxBtn);
    }
    card.appendChild(fxRow);
  }
  const stats = el('div','profile-stats');
  if (editing){
    const c1 = el('div','stat-chip');
    c1.appendChild(el('span','coin sm','$'));
    c1.appendChild(el('span', null, (editing.coins || 0) + ' 余额'));
    const c2 = el('div','stat-chip');
    c2.textContent = '共 ' + (editing.total || 0) + ' 局';
    stats.appendChild(c1);
    stats.appendChild(c2);
    GAME_KEYS.forEach(k => {
      const s = el('div','stat-chip small');
      s.textContent = GAMES[k].name + ' ' + ((editing.played && editing.played[k]) || 0) + ' 局';
      stats.appendChild(s);
    });
  } else {
    stats.appendChild(el('div','stat-chip','新档案：完成首局后开始累积 ' + CURRENCY + ' 与统计'));
  }
  card.appendChild(stats);
  const save = el('button','btn btn-primary','保存');
  save.addEventListener('click', () => {
    const finalName = (input.value.trim() || (editing ? editing.name : '玩家')).slice(0, 12);
    let targetUid = uid;
    if (editing){
      editing.name = finalName;
      editing.avatar = avatar;
      if (editingMe){
        account.name = finalName;
        account.avatar = avatar;
        account.background = background;
        saveAccount();
      }
    } else {
      targetUid = createProfile(finalName, avatar);
      if (slotIndex !== undefined && slotIndex !== null) slots[slotIndex] = targetUid;
    }
    saveRoster();
    syncProfiles();
    bd.remove();
    renderMe(); renderSlots(); renderLeaderboard();
    toast('档案已保存：' + finalName);
  });
  const cancel = el('button','btn','取消');
  cancel.addEventListener('click', () => bd.remove());
  card.appendChild(save);
  card.appendChild(cancel);
  bd.appendChild(card);
  bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  document.body.appendChild(bd);
  setTimeout(() => input.focus(), 0);
}
function localLeaderboard(){
  const list = roster.map(p => ({ uid:p.uid, name:p.name, avatar:p.avatar, coins:p.coins || 0, xp:p.xp || 0, level:p.level || 1, streak:p.streak || 0, bestStreak:p.bestStreak || 0, played:p.played || {}, total:p.total || 0, online:p.uid === deviceUid && online.connected }))
    .sort((a,b) => (b.coins - a.coins) || (b.total - a.total) || String(a.name).localeCompare(String(b.name)))
    .slice(0, 50);
  return { list, total: roster.length };
}
function renderLeaderboard(){
  const data = online.connected && lastServerLB ? lastServerLB : localLeaderboard();
  renderAccounts();
  const listEl = $('lb-list');
  listEl.innerHTML = '';
  $('lb-note').textContent = online.connected
    ? ('🌐 全球总榜 · 共 ' + data.total + ' 位玩家 · 积分实时更新')
    : ('📱 本地排行榜 · 共 ' + data.total + ' 位玩家（联机服务在线时可查看全球总榜）');
  const list = lbFilter === 'online' ? (data.list || []).filter(u => u.online) : (data.list || []);
  if (!list.length){
    listEl.appendChild(el('div','lb-empty', lbFilter === 'online' ? t('leaderboard_no_online') : t('leaderboard_empty')));
    return;
  }
  list.slice(0, 10).forEach((u, i) => {
    const row = el('div','lb-row' + (u.uid === deviceUid ? ' me' : ''));
    row.appendChild(el('span','lb-rank', String(i + 1)));
    const av = el('span','lb-av');
    av.appendChild(avatarStageNode(u, 22));
    av.style.cursor = 'pointer';
  av.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); openProfileModal(u.uid); });
    row.appendChild(av);
    const nameWrap = el('span','lb-name');
    const lv = u.level || (u.xp ? levelFromXp(u.xp) : 1);
    nameWrap.appendChild(nameFxNode(u, u.name));
    nameWrap.appendChild(el('span', null, (lv > 1 ? ' [Lv.' + lv + ']' : '') + ' ' + (u.lang ? langFlag(u.lang) : '')));
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => openProfileModal(u.uid));
    row.appendChild(nameWrap);
    if (u.online) row.appendChild(el('span','online-dot',''));
    const g = u.played || {};
    const gameStr = GAME_KEYS.filter(k => g[k]).map(k => GAMES[k].name + ' ' + g[k] + '局').join(' · ');
    row.appendChild(el('span','lb-game', gameStr));
    const coinLine = el('span','coin-line');
    coinLine.appendChild(el('span','coin','$'));
    coinLine.appendChild(el('span','lb-pts', (u.coins || 0) + ' · ' + (u.total || 0) + '局'));
    row.appendChild(coinLine);
    listEl.appendChild(row);
  });
}
// 等级 = 对局经验（XP），不是金币
// 1 级 0 XP，2 级 30，3 级 80，4 级 160，5 级 280，之后每级 +150
function levelFromXp(xp){
  xp = Math.max(0, xp || 0);
  if (xp < 30) return 1;
  if (xp < 80) return 2;
  if (xp < 160) return 3;
  if (xp < 280) return 4;
  return 5 + Math.floor((xp - 280) / 150);
}
function xpForLevel(level){
  if (level <= 1) return 0;
  const thresholds = [0, 30, 80, 160, 280];
  if (level <= 5) return thresholds[level - 1];
  return 280 + (level - 5) * 150;
}

function recordPlaymatesFromResult(results, currentResult, gameId){
  if (!account) return;
  results.forEach(other => {
    if (other.slot === currentResult.slot) return;
    const otherUid = online.connected && online.game ? null : slots[other.slot];
    if (!otherUid) return;
    const otherP = profileByUid(otherUid);
    if (otherP) recordPlaymate(account, otherUid, otherP.name, gameId);
  });
  // Also record online opponents via player list
  if (online.connected && online.game && online.roomInfo) {
    const players = online.roomInfo.players || [];
    players.forEach(pl => {
      if (pl.uid && pl.uid !== account.uid) {
        recordPlaymate(account, pl.uid, pl.name || 'Player', gameId);
      }
    });
  }
}
function applyGameResult(results){
  if (!results || !results.length) return;
  const gameId = currentGameId;
  const entries = [];
  const parts = [];
  results.forEach(r => {
    let uid = null;
    if (online.connected && online.game){
      if (r.slot !== online.player) return;
      uid = deviceUid;
    } else {
      uid = slots[r.slot];
    }
    const p = uid ? profileByUid(uid) : null;
    if (!p) return;
    if (r.coins === 1) p.coins = (p.coins || 0) + 1;
    // ---- 成长系统：XP / 等级 / 连胜 ----
    const xpGain = r.coins === 1 ? 10 : 4; // 胜利 +10 XP，参与 +4 XP
    p.xp = (p.xp || 0) + xpGain;
    p.level = levelFromXp(p.xp);
    if (r.coins === 1) {
      p.streak = (p.streak || 0) + 1;
      if (p.streak > (p.bestStreak || 0)) p.bestStreak = p.streak;
    } else {
      p.streak = 0;
    }
    p.played[gameId] = (p.played[gameId] || 0) + 1;
    p.total = (p.total || 0) + 1;
    if (account && p.uid === account.uid){
      account.coins = p.coins;
      updateDaily(account, 'play', 1);
      if (r.coins === 1) updateDaily(account, 'win', 1);
      if (account.streak >= 2) updateDaily(account, 'streak', 1);
      const newAch = checkAchievements(account);
      if (newAch.length) {
        account.achievements = [...(account.achievements || []), ...newAch];
        newAch.forEach(aid => {
          const a = ACHIEVEMENTS.find(x => x.id === aid);
          if (a) toast('Achievement unlocked: ' + a.icon + ' ' + a.name + ' - ' + a.desc);
        });
      }
      // Record playmates
      recordPlaymatesFromResult(results, r, gameId);
      account.xp = p.xp;
      account.level = p.level;
      account.streak = p.streak;
      account.bestStreak = p.bestStreak;
      account.played = p.played;
      account.total = p.total;
      saveAccount();
    }
    entries.push({ uid:p.uid, name:p.name, avatar:p.avatar, game:gameId, coins: r.coins === 1 ? 1 : 0, played: 1, xp: xpGain });
    parts.push(p.name + (r.coins === 1 ? ' 获得 $1' : ' 本局无奖励'));
  });
  // AI 角色：胜负发言 + 计入「最近一起玩」
  if (aiMode && account){
    let aiWon = false, humanWon = false;
    results.forEach(r => {
      if (r.slot > 0 && r.coins === 1) aiWon = true;
      if (r.slot === 0 && r.coins === 1) humanWon = true;
    });
    if (aiWon) aiSpeak(currentPersona, 'win');
    else if (humanWon) aiSpeak(currentPersona, 'lose');
    const mate = aiMateInfo(currentPersona);
    recordPlaymate(account, mate.uid, mate.name, gameId);
    saveAccount();
  }
  saveRoster();
  if (entries.length){
    if (online.connected){
      entries.forEach(e => online.send({ type:'profile', payload:{ uid:e.uid, name:e.name, avatar:e.avatar } }));
      online.send({ type:'result', payload: entries.map(e => ({ uid:e.uid, game:e.game, coins:e.coins, played:1, xp:e.xp })) });
    }
    toast(t('toast_win_reward') + parts.join('，'));
  }
  renderMe(); renderSlots(); renderLeaderboard();
}

function showHub(){
  if (currentGame && typeof currentGame.destroy === 'function') currentGame.destroy();
  $('screen-hub').classList.remove('hidden');
  $('screen-game').classList.add('hidden');
  currentGame = null;
  currentGameId = null;
  const endBtn = $('btn-end-game');
  if (endBtn) endBtn.classList.add('hidden');
  if (online.room) renderRoomPanel();
}
function showGame(id){
  if (currentGame && typeof currentGame.destroy === 'function') currentGame.destroy();
  if (currentGame && currentGame._raw && typeof currentGame._raw.destroy === 'function') currentGame._raw.destroy();
  $('screen-hub').classList.add('hidden');
  $('screen-game').classList.remove('hidden');
  const meta = GAMES[id];
  $('game-title').textContent = meta.icon + ' ' + meta.name;
  currentGameId = id;
  const area = $('board-area'), extra = $('game-extra');
  area.innerHTML = ''; extra.innerHTML = '';
  const inOnline = !!(online.connected && online.game);
  let opts;
  if (inOnline){
    opts = {
      online: true,
      myIdx: online.player,
      isHost: online.isHost,
      sendMove: p => online.sendMove(p),
      sendRestart: () => online.sendRestart(),
      onMove: null,
      onRestart: null,
      onEnd: results => applyGameResult(results),
    };
  } else {
    opts = { onEnd: results => applyGameResult(results) };
    if (aiMode && playerCount >= 2){
      opts.ai = new Set(Array.from({ length: playerCount - 1 }, (_, i) => i + 1));
      opts.aiPersona = currentPersona;
    }
  }
  currentGame = createGameInstance(id, area, extra, playerCount, opts);
  const endBtn = $('btn-end-game');
  if (endBtn) endBtn.classList.toggle('hidden', !inOnline);
}
function startGame(id){
  const meta = GAMES[id];
  if (online.connected && online.room){
    if (!account){ toast('请先创建账号或登录后再联机'); openAuthModal(); return; }
    if (online.game){ toast('本局已开始，点「结束本局」后可在房间内切换游戏'); return; }
    const size = (online.roomInfo && online.roomInfo.size) || online.capacity || 2;
    if (size > meta.max){ toast(meta.name + ' 联机最多 ' + meta.max + ' 人，当前房间 ' + size + ' 人'); return; }
    if (!online.isHost){ toast('请等待房主选择游戏'); return; }
    playerCount = size;
    online.selectGame(id);
    return;
  }
  if (playerCount < meta.min || playerCount > meta.max){
    toast(meta.name + ' 支持 ' + meta.min + '-' + meta.max + ' 人，当前选择 ' + playerCount + ' 人');
    return;
  }
  ensureSlots();
  showGame(id);
}

function renderPlayers(activeIdx, infos, bankrupts, colors){
  const bar = $('player-bar');
  bar.innerHTML = '';
  for (let i=0;i<playerCount;i++){
    const chip = el('div','pchip' + (i===activeIdx ? ' active' : '') + (bankrupts && bankrupts[i] ? ' bankrupt' : ''));
    const dot = el('span','dot');
    dot.style.background = colors ? colors[i] : PLAYER_COLORS[i];
    chip.appendChild(dot);
    chip.appendChild(el('span', null, '玩家' + (i+1)));
    if (infos && infos[i]) chip.appendChild(el('span','extra', infos[i]));
    bar.appendChild(chip);
  }
}
function setStatus(text, win){
  const s = $('status-bar');
  s.textContent = text;
  s.classList.toggle('win', !!win);
}

function renderHub(){
  renderPersonaRow();
  const grid = $('game-grid');
  grid.innerHTML = '';
  const label = $('count-label');
  if (label) label.textContent = aiMode ? t('player_count_ai') : t('player_count');
  for (const id in GAMES){
    const g = GAMES[id];
    const card = el('button','game-card');
    card.type = 'button';
    const ok = playerCount >= g.min && playerCount <= g.max;
    if (!ok) card.classList.add('disabled');
    card.setAttribute('aria-label', g.name + '：' + g.desc);
    card.appendChild(el('div','icon', g.icon));
    card.appendChild(el('div','name', g.name));
    card.appendChild(el('div','desc', g.desc));
    const badgeRow = el('div','badge-row');
    badgeRow.appendChild(el('span','range', g.min === g.max ? g.min + ' 人' : g.min + '-' + g.max + ' 人'));
    if (aiMode) badgeRow.appendChild(el('span','ai-badge','🤖 人机'));
    card.appendChild(badgeRow);
    card.addEventListener('click', () => startGame(id));
    grid.appendChild(card);
  }
}

if (typeof document !== 'undefined'){
  window.__gameInfo = {
    GAMES, startGame, registerAccount, loginAccount, logoutAccount, loadRoster,
    get playerCount(){ return playerCount; },
    set playerCount(v){ playerCount = v; },
    get aiMode(){ return aiMode; },
    set aiMode(v){ aiMode = !!v; },
    get game(){ return currentGame; },
    get online(){ return online; },
    get roster(){ return roster; },
    get deviceUid(){ return deviceUid; },
    get personas(){ return AI_PERSONAS; },
    setAiPersona,
    renderPersonaRow,
    get currentPersona(){ return currentPersona; },
    get leaderboard(){ return lastServerLB; },
  };
  initI18n().then(() => {
  initTheme();
  $('count-group').addEventListener('click', e => {
    const btn = e.target.closest('.count-btn');
    if (!btn) return;
    playerCount = Number(btn.dataset.n);
    document.querySelectorAll('#count-group .count-btn').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    renderHub();
    renderSlots();
  });
  const modeBtns = document.querySelectorAll('#mode-group .count-btn');
  modeBtns.forEach(b => b.addEventListener('click', () => {
    aiMode = b.dataset.mode === 'ai';
    modeBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderHub();
    renderSlots();
  }));
  const themeBtn = $('btn-theme');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const cur = getTheme();
    const idx = THEME_LIST.findIndex(t => t.id === cur);
    const next = THEME_LIST[(idx + 1) % THEME_LIST.length].id;
    applyTheme(next);
    try { localStorage.setItem('mg_theme', next); } catch {}
    toast('主题：' + themeMeta(next).icon + ' ' + themeMeta(next).nameZh);
  });
  const endBtn = $('btn-end-game');
  if (endBtn) endBtn.addEventListener('click', () => {
    if (!online.connected || !online.game) return;
    if (!online.isHost){ toast('由房主结束本局'); return; }
    online.send({ type: 'end_game' });
    finishRoomGame();
  });
  $('btn-back').addEventListener('click', showHub);
  $('btn-restart').addEventListener('click', () => { if (currentGame) currentGame.reset(); });
  $('btn-rules').addEventListener('click', () => {
    if (currentGameId && RULES[currentGameId]) showModal(GAMES[currentGameId].name + ' · 规则', RULES[currentGameId]);
  });
  const heroQuick = $('btn-hero-quick');
  if (heroQuick) heroQuick.addEventListener('click', () => {
    const playable = Object.keys(GAMES).filter(id => playerCount >= GAMES[id].min && playerCount <= GAMES[id].max);
    if (!playable.length){ toast('当前人数没有可玩的游戏'); return; }
    startGame(playable[Math.floor(Math.random() * playable.length)]);
  });
  $('btn-create-room').addEventListener('click', () => online.create());
  const settingsBtn = $('btn-settings-page');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsPage);
  $('btn-me').addEventListener('click', () => openProfileModal(deviceUid));
  const setLbTab = (which) => {
    lbFilter = which;
    $('lb-tab-all').setAttribute('aria-pressed', String(which === 'all'));
    $('lb-tab-online').setAttribute('aria-pressed', String(which === 'online'));
    renderLeaderboard();
  };
  $('lb-tab-all').addEventListener('click', () => setLbTab('all'));
  $('lb-tab-online').addEventListener('click', () => setLbTab('online'));

  // 深链：#game=gomoku&p=2 可直接进入指定游戏
  //        #join=XXXXXX 直接加入房间（邀请链接）
  });
}

function parseHash(){
  const h = location.hash.slice(1);
  const m = /^game=([a-z]+)(?:&p=([2-5]))?/.exec(h);
  if (!m || !GAMES[m[1]]) return;
  if (m[2]) playerCount = Number(m[2]);
  renderHub();
  startGame(m[1]);
}


