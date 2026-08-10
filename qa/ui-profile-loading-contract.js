'use strict';

/* UI Repair P0.7: a cache miss must enter an authoritative public-profile loading state. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const profile = fs.readFileSync(path.join(ROOT, 'public', 'src', 'shop', '05-profile.js'), 'utf8');
const online = fs.readFileSync(path.join(ROOT, 'public', 'src', 'online', '03-websocket.js'), 'utf8');
const locales = Object.fromEntries(['zh-CN','en-US','uk-UA'].map(lang => [lang, JSON.parse(fs.readFileSync(path.join(ROOT,'public','locales',lang+'.json'),'utf8'))]));
const failures=[];
function check(name, condition, detail){ console.log((condition?'PASS':'FAIL')+'  '+name+(condition||!detail?'':' :: '+detail)); if(!condition)failures.push(name); }

check('缓存缺失时请求权威 Profile 而不是直接报不存在',
  /else if \(online\.requestProfile\(uid\)\) return;/.test(profile) &&
  /else if \(online\.connected && online\.requestProfile\(uid\)\)\{/.test(profile),
  'openProfileModal 没有覆盖 leaderboard cache miss');
check('权威请求显示可取消的 accessible loading dialog',
  /function beginPublicProfileRequest\(uid\)/.test(profile) &&
  /t\('profile_loading'\)/.test(profile) &&
  /setupAccessibleOverlayDialog\(bd,card,cancel/.test(profile) &&
  /closeProfileLoading/.test(profile),
  '缺少加载态、取消或清理');
check('Profile 请求以 UID 绑定并能处理 null/not-found',
  /pendingPublicProfileUid/.test(online) &&
  /finishPublicProfileRequest\(profile\)/.test(online) &&
  /if \(!profile\) toast\(t\('profile_not_found'\)\)/.test(online),
  '响应没有绑定当前请求或 null 没有结束加载态');
check('加载态不会把取消后的迟到响应重新打开',
  /if \(profile && !pending\) renderProfilePopup/.test(online) === false &&
  /pending && \(!profile \|\| String\(profile\.uid \|\| ''\) === String\(pending\)\)/.test(online),
  '迟到响应仍可能绕过 pending 状态');
check('profile_loading 三语同构', Object.values(locales).every(locale => typeof locale.profile_loading === 'string' && locale.profile_loading.trim()));
check('profile_loading 三语无占位符漂移', new Set(Object.values(locales).map(locale => (locale.profile_loading.match(/%[sd]/g)||[]).join('|'))).size === 1);

if(failures.length){ console.error('UI_PROFILE_LOADING_CONTRACT_FAILED: '+failures.join('、')); process.exit(1); }
console.log('UI_PROFILE_LOADING_CONTRACT_ALL_PASS');
