'use strict';

/* UI Repair P0.6: guest sessions may browse, but persistent mutations never send. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SHOP_PATH = path.join(ROOT, 'public', 'src', 'shop', '06-shop.js');
const ONLINE_PATH = path.join(ROOT, 'public', 'src', 'online', '03-websocket.js');
const SHELL_PATH = path.join(ROOT, 'public', 'src', 'core', '02-app-shell.js');
const TEMPLATE_PATH = path.join(ROOT, 'public', 'index-template.html');
const SERVER_PATH = path.join(ROOT, 'server', 'index.js');

const shop = fs.readFileSync(SHOP_PATH, 'utf8');
const online = fs.readFileSync(ONLINE_PATH, 'utf8');
const shell = fs.readFileSync(SHELL_PATH, 'utf8');
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const server = fs.readFileSync(SERVER_PATH, 'utf8');
const failures = [];

function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

function extractFrom(source, startPattern, endPattern){
  const start = startPattern.exec(source);
  if (!start) return '';
  const tail = source.slice(start.index + start[0].length);
  const end = endPattern.exec(tail);
  return end ? source.slice(start.index, start.index + start[0].length + end.index) : source.slice(start.index);
}

check('商城保留访客只读入口并显示持久化限制说明',
  /if \(account\.ephemeral\) headerCopy\.appendChild\(el\('p','shop-guest-notice',t\('guest_persistence_disabled'\)\)\)/.test(shop) &&
  /\['shop',\(\)=>openShop\(\)/.test(shell) &&
  /shopButton\.addEventListener\('click',openShop\)/.test(shell),
  '访客仍被挡在商城外或没有说明');

check('购买入口和直接购买函数都经过访客阻断',
  /function requestPurchase\([^)]*\)\{\s*if \(guestMutationBlocked\(\)\) return;/.test(shop) &&
  (shop.match(/markGuestMutationControl\(el\('button','btn btn-primary',t\('shop_buy'\)\)\)/g) || []).length >= 3,
  '购买按钮或直接调用仍可能发出 purchase');

const persistentMethods = ['friendRequest','friendRequestAction','removeFriend','blockUser','unblockUser','reportUser'];
for (const method of persistentMethods){
  check('访客社交方法在 send 前阻断：' + method,
    new RegExp(method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\([^)]*\\)\\{\\s*if\\(socialGuestMutationBlocked\\(\\)\\)return false;').test(online));
}

check('邀请 picker、直接邀请和房主/排行榜按钮使用同一访客边界',
  /function openInvitePicker\(\)\{\s*if\(socialGuestMutationBlocked\(\)\)return;/.test(online) &&
  /function inviteUser\(uid\)\{\s*if\(socialGuestMutationBlocked\(\)\)return false;/.test(online) &&
  (online.match(/markGuestSocialControl\(el\('button','btn(?: invite-btn)?'/g) || []).length >= 3,
  '邀请入口存在未保护分支');

check('社交动作、请求处理、Block/Report 入口标记为访客不可持久化',
  /if\(persistent\)markGuestSocialControl\(button\)/.test(online) &&
  /markGuestSocialControl\(report\)/.test(online) &&
  /markGuestSocialControl\(el\('button','btn',t\('social_unblock'\)\)\)/.test(online),
  '社交弹层或列表仍有未标记的持久化动作');

check('访客局内表达报告入口退化为只读状态而非失败按钮',
  /account&&!account\.ephemeral&&String\(sender\.userId\)/.test(shell),
  '访客仍会看到只能被服务器拒绝的报告按钮');

check('服务端仍是最终持久化权限边界',
  /requirePersistentUser\(\)/.test(server) && /if\(u&&u\.ephemeral\)/.test(server) &&
  /if \(type === 'purchase'\)[\s\S]{0,120}requirePersistentUser\(\)/.test(server) &&
  /if \(type === 'friend_request'\)[\s\S]{0,120}requirePersistentUser\(\)/.test(server),
  '前端 affordance 不得替代服务端权限');

try {
  const snippet = extractFrom(shop, /function\s+guestMutationBlocked\s*\(/, /function\s+shopCatalogItems\s*\(/);
  let sends = 0;
  let notices = 0;
  const context = vm.createContext({
    account:{ ephemeral:true },
    online:{ connected:true, send(){ sends++; } },
    toast(){ notices++; },
    t:key => key,
    crypto:{ randomUUID:() => 'fixed' },
    setTimeout(){},
  });
  vm.runInContext(snippet + '\nthis.__requestPurchase=requestPurchase;', context, { filename:SHOP_PATH });
  context.__requestPurchase('avatars', 1, null);
  check('VM：访客直接调用购买函数不会发送 WebSocket mutation', sends === 0 && notices === 1, JSON.stringify({ sends, notices }));
} catch (error){
  check('VM：访客购买阻断可执行', false, error.stack || error.message);
}

try {
  const snippet = extractFrom(online, /function\s+inviteUser\s*\(/, /function\s+showInviteModal\s*\(/);
  let sends = 0;
  let creates = 0;
  const context = vm.createContext({
    socialGuestMutationBlocked:() => true,
    online:{ room:null, isHost:false, send(){ sends++; }, create(){ creates++; }, inviteTarget:null },
    toast(){}, t:key => key,
  });
  vm.runInContext(snippet + '\nthis.__inviteUser=inviteUser;', context, { filename:ONLINE_PATH });
  const result = context.__inviteUser('peer');
  check('VM：访客直接邀请不会建房或发送 invite', result === false && sends === 0 && creates === 0, JSON.stringify({ sends, creates }));
} catch (error){
  check('VM：访客邀请阻断可执行', false, error.stack || error.message);
}

check('访客阻断控件有可见 disabled 语义与提示样式',
  /\.btn\[aria-disabled="true"\]/.test(template) && /shop-guest-notice/.test(template) &&
  /setAttribute\('aria-disabled','true'\)/.test(shop) && /setAttribute\('aria-disabled','true'\)/.test(online),
  '缺少 aria-disabled 或访客说明样式');

if (failures.length){
  console.error('UI_GUEST_AFFORDANCE_CONTRACT_FAILED: ' + failures.join('、'));
  process.exit(1);
}
console.log('UI_GUEST_AFFORDANCE_CONTRACT_ALL_PASS');
