/* ================= 用户档案与积分 ================= */
const AVATAR_COUNT = 56; // 0-29 免费，30-55 商城（4 分类）
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
function shopItemName(category,item){
  if(!item)return'';
  const key='shop_item_'+category+'_'+item.id,localized=t(key);
  return localized===key?item.name:localized;
}
function avatarCategoryName(category){
  const key='avatar_category_'+category.id,localized=t(key);
  return localized===key?category.name:localized;
}
function avatarMeta(idx){
  const p = SHOP.avatars.find(a => a.id === idx);
  return p ? p : null;
}
function nameFxNode(profile, name){
  const fx = profile && profile.nameFx ? Number(profile.nameFx) : 0;
  const span = elRaw('span', fx >= 1 && fx <= 4 ? 'name-fx-' + fx : null, name || '');
  return span;
}
function nameFxLabel(fx){
  const key='name_fx_'+(Number.isInteger(Number(fx))?Number(fx):0),localized=t(key);
  return localized===key?t('name_fx_0'):localized;
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
    if (!P) return makeAvatar(0);
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
let pendingAuthPin = null;
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
    if (account && Object.prototype.hasOwnProperty.call(account, 'pin')) delete account.pin;
    if (account && account.registered === false && !account.authToken){
      account = null;
      try { localStorage.removeItem(LS_ACCOUNT); } catch {}
    }
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
function saveAccount(){
  try {
    const safe = account && typeof account === 'object' ? { ...account } : account;
    if (safe && Object.prototype.hasOwnProperty.call(safe, 'pin')) delete safe.pin;
    localStorage.setItem(LS_ACCOUNT, JSON.stringify(safe));
  } catch {}
}
function genUid(){
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'u_' + crypto.randomUUID().slice(0, 8);
  return 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function profileByUid(uid){ return roster.find(p => p.uid === uid); }
function createProfile(name, avatar){
  const p = { uid: genUid(), name: name || t('default_player_name'), avatar: (avatar === undefined ? Math.floor(Math.random() * AVATAR_COUNT) : avatar), coins: 0, played: {}, total: 0 };
  roster.push(p);
  saveRoster();
  return p.uid;
}
function syncProfiles(){
  if (!online.connected) return;
  if (account && account.uid){
    online.send({ type: 'profile', payload: {
      uid: account.uid, name: account.name, avatar: account.avatar,
      background: account.background || 0, frame: account.frame || 0, effect: account.effect || 0,
      nameFx: account.nameFx || 0, lang: account.lang || currentLang, gameCosmetics: account.gameCosmetics || {},
    } });
  }
}
function registerAccount(name, pin, avatar, background, frame, effect){
  name = String(name || '').trim().slice(0, 12) || t('default_player_name');
  pin = String(pin || '').trim();
  if (!/^[A-Za-z0-9]{4,20}$/.test(pin)){
    toast(t('pin_invalid'));
    return null;
  }
  const uid = genUid();
  pendingAuthPin = pin;
  account = {
    uid, name, lang: currentLang,
    avatar: Number.isInteger(avatar) ? Math.max(0, Math.min(AVATAR_COUNT - 1, avatar)) : 0,
    background: Number.isInteger(background) ? Math.max(0, background) : 0,
    frame: Number.isInteger(frame) ? Math.max(0, frame) : 0,
    effect: Number.isInteger(effect) ? Math.max(0, effect) : 0,
    owned: defaultOwned(), coins: 0, played: {}, total: 0, device: deviceFingerprint(), nameFx: 0, gameCosmetics: {}, cosmeticSchemaVersion: 1,
    registered: false,
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
      frame: account.frame, effect: account.effect, owned: account.owned, gameCosmetics: account.gameCosmetics,
    } });
  }
  renderMe(); renderSlots(); renderLeaderboard();
  if (authModalEl) authModalEl.remove();
  authModalEl = null;
  return account;
}
function loginAccount(pin){
  pin = String(pin || '').trim();
  if (!/^[A-Za-z0-9]{4,20}$/.test(pin)){ toast(t('pin_invalid')); return; }
  if (!online.connected){ toast(t('need_server_login')); return; }
  online.send({ type: 'login', payload: { pin } });
}
function logoutAccount(){
  if (online && typeof online.clearResume === 'function') online.clearResume();
  if (online.connected) online.send({ type: 'logout' });
  completeLocalLogout(true);
}
function completeLocalLogout(showLogin){
  pendingAuthPin = null;
  if (online){
    if (typeof online.clearPendingResultClaim === 'function') online.clearPendingResultClaim();
    if (typeof online.saveSoloClaims === 'function') online.saveSoloClaims();
    online.soloMatch = null;
    online.pendingSoloClaims = [];
    online._soloClaimsLoaded = false;
    online.displayedRewardIds = [];
    online.rewardVersion = null;
    if (typeof online.resetState === 'function') online.resetState();
    online._authenticated = false;
  }
  account = null;
  deviceUid = null;
  try {
    localStorage.removeItem(LS_ACCOUNT);
    localStorage.removeItem('mg_pending_solo_claims');
    localStorage.removeItem('mg_displayed_reward_ids');
    localStorage.setItem('mg_uid', '');
  } catch {}
  renderMe(); renderSlots(); renderLeaderboard();
  if (showLogin && !authModalEl) openAuthModal("login");
}
function updateAccountProfile(p){
  if (!account) return;
  account.uid = p.uid; account.name = p.name; account.avatar = p.avatar;
  account.background = p.background || 0; account.frame = p.frame || 0; account.effect = p.effect || 0;
  account.owned = p.owned || defaultOwned(); account.coins = p.coins || 0;
  account.xp = p.xp || 0; account.level = p.level || 1; account.streak = p.streak || 0; account.bestStreak = p.bestStreak || 0;
  account.dailyFirstWinDate = p.dailyFirstWinDate || '';
  account.dailyAICurrencyKey = p.dailyAICurrencyKey || '';
  account.dailyAICurrencyEarned = p.dailyAICurrencyEarned || 0;
  account.xpProgress = p.xpProgress || null;
  account.played = p.played || {}; account.total = p.total || 0; account.wins = p.wins || {}; account.totalWins = p.totalWins || 0; account.lang = p.lang || account.lang || 'zh-CN';
  const me = roster.find(x => x.uid === p.uid);
  if (me){ me.name = p.name; me.avatar = p.avatar; me.coins = p.coins || 0; me.xp = p.xp || 0; me.level = p.level || 1; me.streak = p.streak || 0; me.bestStreak = p.bestStreak || 0; me.played = p.played || {}; me.total = p.total || 0; me.wins = p.wins || {}; me.totalWins = p.totalWins || 0; }
  else roster.unshift({ uid: p.uid, name: p.name, avatar: p.avatar, coins: p.coins || 0, played: p.played || {}, total: p.total || 0, wins: p.wins || {}, totalWins: p.totalWins || 0 });
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
    btn.title = t('account_button_title');
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
  btn.appendChild(el('span','me-title', title.icon + ' ' + socialTitleName(title)));
  const lvBadge = el('span','level-badge', t('level_short',lv));
  btn.appendChild(lvBadge);
  const coinLine = el('span','coin-line');
  coinLine.appendChild(currencyIcon());
  coinLine.appendChild(el('span','me-pts', t('compact_account_stats', account.coins || 0, account.total || 0)));
  btn.appendChild(coinLine);
  renderMyCard();
  if (online.connected){
    btn.appendChild(el('span','me-online','●'));
  }
  btn.title = t('my_profile_button_title');
}
function renderSlots(){
  const row = $('slots-row');
  row.innerHTML = '';
  for (let i = 0; i < playerCount; i++){
    if (aiMode && i > 0){
      const chip = el('button','slot-chip ai');
      chip.type = 'button';
      chip.appendChild(el('span','av','🤖'));
      chip.appendChild(el('span','nm',t('ai_player_number',i)));
      chip.appendChild(el('span','pts',t('computer_opponent')));
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
      chip.appendChild(elRaw('span','nm', p.name));
      const coinLine = el('span','coin-line');
      coinLine.appendChild(currencyIcon('sm'));
      coinLine.appendChild(el('span','pts', t('compact_account_stats',p.coins || 0,p.total || 0)));
      chip.appendChild(coinLine);
    } else {
      chip.appendChild(el('span','av','➕'));
      chip.appendChild(el('span','nm',t('player_number',i+1)));
      chip.appendChild(el('span','pts',t('select_profile_hint')));
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
    if (!slots[i]) slots[i] = createProfile(t('player_number',i+1));
  }
}
function openSlotPicker(i){
  const bd = el('div','modal-backdrop');
  const card = el('div','modal-card');
  card.appendChild(el('h3', null, t('select_profile_title',i+1)));
  const list = el('div','roster-list');
  roster.forEach(p => {
    const item = el('button','roster-item');
    item.type = 'button';
    const av = el('span','av');
    av.appendChild(avatarCanvas(p.avatar, 24));
    item.appendChild(av);
    item.appendChild(elRaw('span','nm', p.name));
      item.appendChild(el('span','lb-game', t('profile_picker_stats',CURRENCY,p.coins || 0,p.total || 0)));
    item.addEventListener('click', () => {
      slots[i] = p.uid;
      bd.remove();
      renderSlots();
    });
    list.appendChild(item);
  });
  const create = el('button','btn btn-primary',t('profile_create'));
  create.addEventListener('click', () => {
    bd.remove();
    openProfileEditor(null, i);
  });
  const cancel = el('button','btn',t('cancel'));
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
  card.appendChild(el('h3', null, editing ? t('profile_edit_title') : t('profile_new_title')));
  const input = el('input','nick-input');
  input.type = 'text';
  input.maxLength = 12;
  input.placeholder = t('profile_name_placeholder');
  input.value = name;
  card.appendChild(input);
  const catLabel = el('div','lb-note',t('profile_avatar_note'));
  card.appendChild(catLabel);
  const editorCats = el('div','shop-tabs');
  const editorCatsDef = [
    { id:'all' }, { id:'basic' }, { id:'theme' }, { id:'fantasy' }, { id:'animals' },
    { id:'profession' }, { id:'creative' },
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
      opt.setAttribute('aria-label', t('profile_avatar_aria',i+1));
      if (locked){
        opt.appendChild(el('span','avatar-lock','🔒' + (avatarPrice(i) ? CURRENCY + avatarPrice(i) : '')));
        opt.addEventListener('click', () => {
          const meta = avatarMeta(i);
          toast(t('auth_avatar_locked',meta ? shopItemName('avatars',meta) : t('shop_tab_avatars'),CURRENCY,meta ? meta.price : 0));
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
    tb.textContent = t('avatar_category_'+c.id);
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
    card.appendChild(el('div','lb-note',t('profile_background')));
    const bgGrid = el('div','bg-grid');
    SHOP.backgrounds.forEach(b => {
      const sw = el('div','bg-swatch' + (b.id === background ? ' selected' : '') + ' ' + b.cls);
      sw.title = shopItemName('backgrounds',b);
      sw.addEventListener('click', () => {
        if (!ownItem(account, 'backgrounds', b.id)){ toast(t('shop_item_requires_purchase',shopItemName('backgrounds',b))); return; }
        background = b.id;
        bgGrid.querySelectorAll('.bg-swatch').forEach(x => x.classList.toggle('selected', x === sw));
      });
      bgGrid.appendChild(sw);
    });
    card.appendChild(bgGrid);
    card.appendChild(el('div','lb-note',t('profile_name_effect')));
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
    c1.appendChild(currencyIcon('sm'));
    c1.appendChild(el('span', null, t('profile_balance',editing.coins || 0)));
    const c2 = el('div','stat-chip');
    c2.textContent = t('games_count',editing.total || 0);
    stats.appendChild(c1);
    stats.appendChild(c2);
    GAME_KEYS.forEach(k => {
      const s = el('div','stat-chip small');
      s.textContent = t('game_count_line',GAMES[k].name,(editing.played && editing.played[k]) || 0);
      stats.appendChild(s);
    });
  } else {
    stats.appendChild(el('div','stat-chip',t('profile_new_stats',CURRENCY)));
  }
  card.appendChild(stats);
  const save = el('button','btn btn-primary',t('save'));
  save.addEventListener('click', () => {
    const finalName = (input.value.trim() || (editing ? editing.name : t('default_player_name'))).slice(0, 12);
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
    toast(t('profile_saved',finalName));
  });
  const cancel = el('button','btn',t('cancel'));
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
  $('lb-note').textContent = t(online.connected ? 'leaderboard_global' : 'leaderboard_local',data.total);
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
    nameWrap.appendChild(el('span', null, (lv > 1 ? t('level_bracket',lv) : '') + ' ' + (u.lang ? langFlag(u.lang) : '')));
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => openProfileModal(u.uid));
    row.appendChild(nameWrap);
    if (u.online) row.appendChild(el('span','online-dot',''));
    const g = u.played || {};
    const gameStr = GAME_KEYS.filter(k => g[k]).map(k => t('game_count_line',GAMES[k].name,g[k])).join(' · ');
    row.appendChild(el('span','lb-game', gameStr));
    const coinLine = el('span','coin-line');
    coinLine.appendChild(currencyIcon());
    coinLine.appendChild(el('span','lb-pts', t('compact_account_stats',u.coins || 0,u.total || 0)));
    row.appendChild(coinLine);
    listEl.appendChild(row);
  });
}
// 等级只由累计 XP 决定；升级需求：min(200, 30 + 5 × 当前等级)。
function xpRequiredForNextLevel(level){
  return Math.min(200, 30 + 5 * Math.max(1, Math.floor(Number(level) || 1)));
}
function xpForLevel(level){
  const target = Math.max(1, Math.floor(Number(level) || 1));
  const steps = target - 1;
  const uncapped = Math.min(steps, 33);
  return uncapped * 30 + 5 * uncapped * (uncapped + 1) / 2 + Math.max(0, steps - uncapped) * 200;
}
function levelFromXp(xp){
  const total = Math.max(0, Math.floor(Number(xp) || 0));
  let low = 1, high = Math.max(2, Math.floor(total / 35) + 2);
  while (low < high){
    const mid = Math.ceil((low + high) / 2);
    if (xpForLevel(mid) <= total) low = mid;
    else high = mid - 1;
  }
  return low;
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
function resultForSlot(results, slot){
  const mine = (results || []).find(item => Number(item.slot) === Number(slot));
  if (!mine) return 'loss';
  const winners = (results || []).filter(item => item && item.coins === 1);
  if ((results || []).length === 2 && winners.length === 0 && Number(results[0].rank) === Number(results[1].rank)) return 'draw';
  return mine.coins === 1 || (Number(mine.rank) === 1 && winners.length === 0) ? 'win' : 'loss';
}
function rewardReasonLabel(item){
  const code = item && item.code || 'base_reward';
  if (code === 'win_streak') return t('reward_item_streak', item.streak || 0);
  if (code === 'reward_blocked'){
    const key = 'reward_reason_' + String(item.reason || 'ineligible_match');
    const label = t(key);
    return label === key ? t('reward_reason_ineligible_match') : label;
  }
  const key = {
    base_reward: 'reward_item_base',
    repeat_opponent_decay: 'reward_item_repeat_decay',
    daily_first_win: 'reward_item_first_win',
    level_milestone: 'reward_item_level_milestone',
    ai_daily_cap: 'reward_item_ai_cap',
  }[code] || 'reward_item_base';
  return t(key);
}
function signedReward(value, suffix){
  const amount = Number(value) || 0;
  if (!amount) return '';
  return (amount > 0 ? '+' : '') + amount + suffix;
}
function formatRewardSummary(reward){
  if (!reward || reward.eligible === false) return t('reward_blocked_summary');
  return t('reward_total_summary', signedReward(reward.currency, CURRENCY), signedReward(reward.xp, ' XP'));
}
function showRewardBreakdown(reward){
  if (!reward || typeof document === 'undefined' || !document.body) return;
  const old = document.querySelector && document.querySelector('.reward-breakdown-overlay');
  if (old && old.remove) old.remove();
  const overlay = el('div', 'overlay reward-breakdown-overlay');
  const card = el('section', 'overlay-card reward-breakdown-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  const multiplayerPlace = reward.eligible !== false && Number(reward.participantCount) > 2 && Number(reward.placement) > 1;
  const titleKey = reward.eligible === false ? 'reward_title_no_contest' :
    (multiplayerPlace ? 'reward_title_place' : (reward.result === 'win' ? 'reward_title_win' : (reward.result === 'draw' ? 'reward_title_draw' : 'reward_title_loss')));
  card.appendChild(el('h3', 'reward-breakdown-title', multiplayerPlace ? t(titleKey, reward.placement) : t(titleKey)));
  const list = el('div', 'reward-breakdown-list');
  (Array.isArray(reward.breakdown) ? reward.breakdown : []).forEach(item => {
    const row = el('div', 'reward-breakdown-row');
    row.appendChild(el('span', 'reward-breakdown-label', rewardReasonLabel(item)));
    const values = el('span', 'reward-breakdown-values');
    const currency = signedReward(item.currency, CURRENCY);
    const xp = signedReward(item.xp, ' XP');
    values.textContent = [currency, xp].filter(Boolean).join(' · ') || '0';
    row.appendChild(values);
    list.appendChild(row);
  });
  card.appendChild(list);
  const total = el('div', 'reward-breakdown-total');
  total.appendChild(el('strong', null, t('reward_total')));
  total.appendChild(el('span', null, [signedReward(reward.currency, CURRENCY) || '0' + CURRENCY, signedReward(reward.xp, ' XP') || '0 XP'].join(' · ')));
  card.appendChild(total);
  if (Number(reward.levelAfter) > Number(reward.levelBefore)){
    card.appendChild(el('p', 'reward-level-up', t('reward_level_up', reward.levelBefore, reward.levelAfter)));
  }
  const close = el('button', 'btn btn-primary reward-breakdown-close', t('reward_close'));
  close.addEventListener('click', () => overlay.remove());
  card.appendChild(close);
  overlay.appendChild(card);
  overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  if (close.focus) close.focus();
}
function applyGameResult(results, resultContext){
  if (!results || !results.length) return;
  const gameId = (resultContext && resultContext.game) || currentGameId;
  const isOnlineMatch = !!((resultContext && resultContext.online) || online.game);
  const matchId = isOnlineMatch ? online.matchId : null;
  if (isOnlineMatch){
    // 已失去对局上下文时绝不能回退为本地结算；重连成功后由仍在房间的实例重新提交。
    if (!matchId) return;
    const normalized = results.map(r => ({
      slot: Number(r.slot),
      coins: r.coins === 1 ? 1 : 0,
      rank: Number.isInteger(r.rank) ? r.rank : (r.coins === 1 ? 1 : 2),
    }));
    online.submitResultClaim({
      matchId: String(matchId),
      game: gameId || online.game,
      results: normalized,
      won: normalized.some(r => r.slot === online.player && r.coins === 1),
    });
    return;
  }
  if (aiMode){
    const outcome = resultForSlot(results, 0);
    if (outcome === 'loss') aiSpeak(currentPersona, 'win');
    else if (outcome === 'win') aiSpeak(currentPersona, 'lose');
    if (account){
      const mate = aiMateInfo(currentPersona);
      recordPlaymate(account, mate.uid, mate.name, gameId);
      saveAccount();
    }
    if (account && online.connected && online._authenticated && online.rewardVersion){
      online.submitSoloResult(gameId, outcome);
      toast(t('reward_verifying'));
    } else if (account && online.connected && online._authenticated) {
      toast(t('reward_server_unsupported'));
    } else {
      toast(t('reward_ai_requires_login'));
    }
  } else {
    // 本地热座只保留聚会体验，不写入正式金币、XP、等级或连胜。
    toast(t('reward_local_no_progress'));
  }
  renderMe(); renderSlots(); renderLeaderboard();
}

function showHub(){
  const preserveOnlineGame = !!(online && online.game && currentGame && currentGameId === online.game);
  if (!preserveOnlineGame && currentGame && typeof currentGame.destroy === 'function') currentGame.destroy();
  $('screen-hub').classList.remove('hidden');
  $('screen-game').classList.add('hidden');
  if (!preserveOnlineGame){
    currentGame = null;
    currentGameId = null;
  }
  const endBtn = $('btn-end-game');
  if (endBtn) endBtn.classList.add('hidden');
  if (online.room) renderRoomPanel();
}
function showGame(id){
  if (online && online.game === id && currentGame && currentGameId === id){
    $('screen-hub').classList.add('hidden');
    $('screen-game').classList.remove('hidden');
    const endBtn = $('btn-end-game');
    if (endBtn) endBtn.classList.remove('hidden');
    return;
  }
  if (currentGame && typeof currentGame.destroy === 'function') currentGame.destroy();
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
      spectator: online.isSpectator,
      gameplayMeta: online.gameplayMeta,
      cosmetic: online.presentationMeta && online.presentationMeta.cosmetic,
      matchId: online.matchId,
      getMatchId: () => online.matchId,
      sendMove: p => online.sendMove(p),
      sendTankInput: p => online.sendTankInput(p),
      sendTetrisLockClaim: p => online.sendTetrisLockClaim(p),
      sendTetrisKOClaim: p => online.sendTetrisKOClaim(p),
      sendTetrisAction: p => online.sendTetrisAction(p),
      sendTetrisState: p => online.sendTetrisState(p),
      sendMonopolyAuctionOpen: p => online.sendMonopolyAuctionOpen(p),
      sendMonopolyBid: p => online.sendMonopolyBid(p),
      sendMonopolyTurnEnd: next => online.sendMonopolyTurnEnd(next),
      sendMonopolyState: p => online.sendMonopolyState(p),
      sendMonopolyAction: p => online.sendMonopolyAction(p),
      sendXiangqiAction: p => online.sendXiangqiAction(p),
      sendRestart: () => online.sendRestart(),
      isReplaying: () => !!online._replaying,
      onMove: null,
      onRestart: null,
      onEnd: results => applyGameResult(results, { online: true, game: id }),
    };
  } else {
    opts = { onEnd: results => applyGameResult(results) };
    if (aiMode && playerCount >= 2){
      opts.ai = new Set(Array.from({ length: playerCount - 1 }, (_, i) => i + 1));
      opts.aiPersona = currentPersona;
      opts.onProgress = action => online.reportSoloProgress(id, action);
      if (account) online.beginSoloMatch(id);
    }
  }
  currentGame = createGameInstance(id, area, extra, playerCount, opts);
  const endBtn = $('btn-end-game');
  if (endBtn) endBtn.classList.toggle('hidden', !inOnline);
}
function startGame(id){
  const meta = GAMES[id];
  if (online.connected && online.room){
    if (!account){ toast(t('need_account_online')); openAuthModal(); return; }
    if (online.game){ toast(t('game_switch_blocked')); return; }
    const size = (online.roomInfo && online.roomInfo.size) || online.capacity || 2;
    if (size > meta.max){ toast(t('game_online_max',meta.name,meta.max,size)); return; }
    if (!online.isHost){ toast(t('wait_host_select')); return; }
    playerCount = size;
    online.selectGame(id);
    return;
  }
  if (playerCount < meta.min || playerCount > meta.max){
    toast(t('game_players_supported',meta.name,meta.min,meta.max,playerCount));
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
    chip.appendChild(el('span', null, t('player_number',i+1)));
    if (infos && infos[i]) chip.appendChild(el('span','extra', infos[i]));
    bar.appendChild(chip);
  }
}
function setStatus(text, win){
  const s = $('status-bar');
  if (typeof setLocalizedText === 'function') setLocalizedText(s, text);
  else s.textContent = localizeRuntimeText(text);
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
    card.dataset.gameId = id;
    const cover = gameCoverNode(id, g);
    if (cover){
      card.classList.add('has-cover');
      card.appendChild(cover);
    } else {
      card.appendChild(el('div','icon', g.icon));
    }
    card.appendChild(el('div','name', g.name));
    card.appendChild(el('div','desc', g.desc));
    const badgeRow = el('div','badge-row');
    badgeRow.appendChild(el('span','range', g.min === g.max ? t('players_exact',g.min) : t('players_range',g.min,g.max)));
    if (aiMode) badgeRow.appendChild(el('span','ai-badge',t('ai_badge')));
    card.appendChild(badgeRow);
    card.addEventListener('click', () => startGame(id));
    grid.appendChild(card);
  }
}

if (typeof document !== 'undefined'){
  window.__gameInfo = {
    GAMES, startGame, registerAccount, loginAccount, logoutAccount, loadRoster,
    GAME_ART, gameArtEnabled, gameArtUrl, renderHub, setLanguage, checkAchievements, aiMateDisplayName,
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
    toast(t('theme_changed',themeMeta(next).icon,themeName(themeMeta(next))));
  });
  const endBtn = $('btn-end-game');
  if (endBtn) endBtn.addEventListener('click', () => {
    if (!online.connected || !online.game) return;
    if (!online.isHost){ toast(t('host_only_end_game')); return; }
    online.send({ type: 'end_game' });
    finishRoomGame();
  });
  $('btn-back').addEventListener('click', showHub);
  $('btn-restart').addEventListener('click', () => { if (currentGame) currentGame.reset(); });
  $('btn-rules').addEventListener('click', () => {
    if (currentGameId && RULES[currentGameId]) showModal(t('game_rules_title',GAMES[currentGameId].name), RULES[currentGameId]);
  });
  const heroQuick = $('btn-hero-quick');
  if (heroQuick) heroQuick.addEventListener('click', () => {
    const playable = Object.keys(GAMES).filter(id => playerCount >= GAMES[id].min && playerCount <= GAMES[id].max);
    if (!playable.length){ toast(t('no_game_for_player_count')); return; }
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
