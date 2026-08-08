'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'public', 'index-template.html');
const UTILS_PATH = path.join(ROOT, 'public', 'src', 'core', '01-utils.js');
const AUTH_PATH = path.join(ROOT, 'public', 'src', 'shop', '04-auth.js');
const SHOP_PATH = path.join(ROOT, 'public', 'src', 'shop', '06-shop.js');
const SHELL_PATH = path.join(ROOT, 'public', 'src', 'core', '02-app-shell.js');

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const utils = fs.readFileSync(UTILS_PATH, 'utf8');
const auth = fs.readFileSync(AUTH_PATH, 'utf8');
const shop = fs.readFileSync(SHOP_PATH, 'utf8');
const shell = fs.readFileSync(SHELL_PATH, 'utf8');

let failures = 0;
function check(name, condition, detail){
  const passed = Boolean(condition);
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
  if (!passed){
    failures++;
    if (detail) console.log(`      ${detail}`);
  }
}

function compact(value){
  return String(value).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

function extractBalancedBlock(source, headerPattern){
  const match = headerPattern.exec(source);
  if (!match) return '';
  const open = source.indexOf('{', match.index);
  if (open < 0) return '';
  let depth = 0;
  for (let index = open; index < source.length; index++){
    if (source[index] === '{') depth++;
    else if (source[index] === '}'){
      depth--;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return '';
}

function ruleBody(block, selectorPattern){
  const match = selectorPattern.exec(block);
  if (!match) return '';
  const open = block.indexOf('{', match.index);
  if (open < 0) return '';
  const close = block.indexOf('}', open + 1);
  return close < 0 ? '' : block.slice(open + 1, close);
}

function hasDeclaration(body, property, valuePattern){
  const normalized = compact(body);
  return new RegExp(`(?:^|[; ])${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${valuePattern}(?:\\s*;|$)`, 'i').test(normalized);
}

/* <=480px：游戏顶栏固定为两行，防止三语言按钮和长标题互相覆盖。 */
const mobile = extractBalancedBlock(
  template,
  /@media\s*\(\s*max-width\s*:\s*480px\s*\)\s*\{/i,
);
check('存在 max-width:480px 手机专项响应式区间', mobile.length > 0);

const gameTopMobile = ruleBody(mobile, /\.game-top\s*\{/);
const gameTitleMobile = ruleBody(mobile, /\.game-top\s+h2\s*\{/);
const gameActionsMobile = ruleBody(mobile, /\.game-top\s+\.top-actions\s*\{/);
const gameActionButtonMobile = ruleBody(mobile, /\.game-top\s+\.top-actions\s+\.btn\s*\{/);
check('<=480px 游戏顶栏使用返回/标题与操作区两行网格',
  hasDeclaration(gameTopMobile, 'display', 'grid') &&
  hasDeclaration(gameTopMobile, 'grid-template-columns', 'auto\\s+minmax\\(0\\s*,\\s*1fr\\)') &&
  /grid-template-areas\s*:\s*["']back title["']\s*["']actions actions["']/i.test(compact(gameTopMobile)));
check('<=480px 游戏标题可收缩、截断且不覆盖返回按钮',
  hasDeclaration(gameTitleMobile, 'min-width', '0') &&
  hasDeclaration(gameTitleMobile, 'overflow', 'hidden') &&
  hasDeclaration(gameTitleMobile, 'text-overflow', 'ellipsis') &&
  hasDeclaration(gameTitleMobile, 'white-space', 'nowrap'));
check('<=480px 游戏操作区占满第二行且按钮等分可收缩',
  hasDeclaration(gameActionsMobile, 'grid-area', 'actions') &&
  hasDeclaration(gameActionsMobile, 'width', '100%') &&
  hasDeclaration(gameActionButtonMobile, 'flex', '1\\s+1\\s+0') &&
  hasDeclaration(gameActionButtonMobile, 'min-width', '0'));

/* 481-768px：认证和商城必须显式降级成单列，并保留纵向/横向滚动。 */
const tablet = extractBalancedBlock(
  template,
  /@media\s*\(\s*min-width\s*:\s*481px\s*\)\s*and\s*\(\s*max-width\s*:\s*768px\s*\)\s*\{/i,
);
check('存在 481-768px 专项响应式区间', tablet.length > 0);

const authLayout = ruleBody(tablet, /\.auth-register-layout\s*\{/);
const authCardBase = ruleBody(template, /\.auth-card\s*\{/);
const authCardTablet = ruleBody(tablet, /\.auth-card\s*,\s*\.auth-card\.auth-login-mode\s*\{/);
check('481-768px 注册布局明确降级为单列', hasDeclaration(authLayout, 'grid-template-columns', 'minmax\\(0\\s*,\\s*1fr\\)|1fr'));
check('认证弹层有视口高度上限并可纵向滚动',
  /100dvh/i.test(authCardTablet) && hasDeclaration(authCardBase, 'overflow', 'auto'));

const shopModalTablet = ruleBody(tablet, /\.shop-modal-card\s*\{/);
const shopLayoutTablet = ruleBody(tablet, /\.shop-layout\s*\{/);
const shopTabsTablet = ruleBody(tablet, /\.shop-tabs\s*\{/);
const shopButtonTablet = ruleBody(tablet, /\.shop-item\s+button\.btn\s*\{/);
check('481-768px 商城布局明确降级为单列', hasDeclaration(shopLayoutTablet, 'grid-template-columns', '1fr'));
check('481-768px 商城卡片受视口约束且可纵向滚动',
  /100dvh/i.test(shopModalTablet) && hasDeclaration(shopModalTablet, 'overflow', 'auto'));
check('481-768px 商城分类栏可横向滚动且不换行',
  hasDeclaration(shopTabsTablet, 'overflow-x', 'auto') && hasDeclaration(shopTabsTablet, 'flex-wrap', 'nowrap'));
check('481-768px 商城商品按钮至少 44x44px',
  hasDeclaration(shopButtonTablet, 'min-height', '44px') && hasDeclaration(shopButtonTablet, 'min-width', '44px'));

/* 最终触控合同必须放在组件样式后，并覆盖常用按钮、输入、头像和背景。 */
const touchHeader = /@media\s*\(\s*max-width\s*:\s*768px\s*\)\s*\{/ig;
let touchMatch = null;
for (const candidate of template.matchAll(touchHeader)) touchMatch = candidate;
const touch = touchMatch
  ? extractBalancedBlock(template.slice(touchMatch.index), /@media\s*\(\s*max-width\s*:\s*768px\s*\)\s*\{/i)
  : '';
check('存在 max-width:768px 最终触控合同', touch.length > 0);

const touchControls = ruleBody(touch, /[^{}]*\.btn[^{}]*\.avatar-opt[^{}]*\.bg-swatch[^{}]*\{/);
const touchInputs = ruleBody(touch, /input\[type="text"\][^{}]*input\[type="password"\][^{}]*\{/);
check('最终触控合同覆盖 btn/avatar/bg 且至少 44x44px',
  /\.btn\b/.test(touch) && /\.avatar-opt\b/.test(touch) && /\.bg-swatch\b/.test(touch) &&
  hasDeclaration(touchControls, 'min-height', '44px') && hasDeclaration(touchControls, 'min-width', '44px'));
check('最终触控合同覆盖文字/PIN输入且高度至少 44px',
  /input\[type="text"\]/.test(touch) && /input\[type="password"\]/.test(touch) &&
  hasDeclaration(touchInputs, 'min-height', '44px'));
check('最终触控合同位于商城商品按钮基础样式之后',
  touchMatch && touchMatch.index > template.indexOf('.shop-item button{'));

/* 滚动锁：既检查源码契约，也在 VM 中执行幂等与 DOM 异常移除回收。 */
check('滚动锁以 data-modal-scroll-lock 标识 owner',
  /owner\.dataset\.modalScrollLock\s*=\s*['"]1['"]/.test(utils) &&
  /delete\s+owner\.dataset\.modalScrollLock/.test(utils));
check('滚动锁用 MutationObserver 按 owner 数量自动回收',
  /new\s+MutationObserver/.test(utils) &&
  /querySelectorAll\(\s*['"]\[data-modal-scroll-lock="1"\]['"]\s*\)\.length/.test(utils));

function runScrollLockVm(){
  const start = utils.indexOf('let modalScrollLockCount');
  const end = utils.indexOf('/* ----------------', start);
  if (start < 0 || end < 0) throw new Error('无法提取滚动锁实现');

  const connectedOwners = [];
  const classes = new Set();
  let observerCallback = null;
  let observerCount = 0;
  class MutationObserverStub {
    constructor(callback){ observerCallback = callback; observerCount++; }
    observe(){}
  }
  const context = {
    MutationObserver: MutationObserverStub,
    document: {
      body: {
        classList: {
          add: name => classes.add(name),
          remove: name => classes.delete(name),
          toggle: (name, force) => {
            if (force) classes.add(name); else classes.delete(name);
            return Boolean(force);
          },
          contains: name => classes.has(name),
        },
      },
      querySelectorAll: selector => selector === '[data-modal-scroll-lock="1"]'
        ? connectedOwners.filter(owner => owner.dataset.modalScrollLock === '1')
        : [],
    },
  };
  vm.createContext(context);
  vm.runInContext(
    `${utils.slice(start, end)}\nthis.__lockApi = {` +
    ' acquire: acquireModalScrollLock, release: releaseModalScrollLock,' +
    ' count: () => modalScrollLockCount };',
    context,
    { filename: UTILS_PATH },
  );

  const first = { dataset: {} };
  const second = { dataset: {} };
  connectedOwners.push(first, second);
  context.__lockApi.acquire(first);
  context.__lockApi.acquire(first);
  const acquireIdempotent = context.__lockApi.count() === 1 && classes.has('modal-scroll-locked') && observerCount === 1;
  context.__lockApi.release(first);
  context.__lockApi.release(first);
  const releaseIdempotent = context.__lockApi.count() === 0 && !classes.has('modal-scroll-locked');

  context.__lockApi.acquire(first);
  context.__lockApi.acquire(second);
  connectedOwners.splice(0, connectedOwners.length, second);
  observerCallback();
  const oneOwnerRemains = context.__lockApi.count() === 1 && classes.has('modal-scroll-locked');
  connectedOwners.length = 0;
  observerCallback();
  const allOwnersRemoved = context.__lockApi.count() === 0 && !classes.has('modal-scroll-locked');
  return { acquireIdempotent, releaseIdempotent, oneOwnerRemains, allOwnersRemoved };
}

try {
  const result = runScrollLockVm();
  check('VM：重复 acquire/release 均幂等', result.acquireIdempotent && result.releaseIdempotent);
  check('VM：MutationObserver 对异常移除逐级回收滚动锁', result.oneOwnerRemains && result.allOwnersRemoved);
} catch (error){
  check('VM：滚动锁实现可执行', false, error.stack || error.message);
}

/* 认证弹层必须由 owner 维度的 acquire/release 管理。 */
const openAuthBody = extractBalancedBlock(auth, /function\s+openAuthModal\s*\([^)]*\)\s*\{/);
check('认证弹层打开时登记 owner 滚动锁',
  /authModalEl\s*=\s*page/.test(openAuthBody) && /acquireModalScrollLock\(\s*page\s*\)/.test(openAuthBody));
check('认证弹层替换旧实例前释放旧 owner',
  /if\s*\(\s*authModalEl\s*\)[\s\S]*?releaseModalScrollLock\(\s*authModalEl\s*\)[\s\S]*?authModalEl\.remove\(\)/.test(openAuthBody));
check('认证前独立 Page 不允许点击背景绕过且成功后释放 owner',
  !/page\.addEventListener\(\s*['"]click['"]/.test(openAuthBody) &&
  /function\s+enterGhostApp[\s\S]*?releaseModalScrollLock\(authModalEl\)[\s\S]*?authModalEl\.remove\(\)[\s\S]*?authModalEl=null/.test(shell));

/* 商城必须是单例；关闭函数自身也必须幂等并清理全部活动引用。 */
const openShopBody = extractBalancedBlock(shop, /function\s+openShop\s*\(\s*\)\s*\{/);
check('商城声明活动弹层单例引用', /let\s+activeShopModal\s*=\s*null/.test(shop));
check('商城重复打开时复用活动单例',
  /activeShopModal\s*&&\s*activeShopModal\.isConnected\s*\)\s*return/.test(openShopBody));
check('商城打开时登记 owner 滚动锁',
  /activeShopModal\s*=\s*bd/.test(openShopBody) && /acquireModalScrollLock\(\s*bd\s*\)/.test(openShopBody));
check('商城关闭幂等并清理 refresh/modal/滚动锁/DOM',
  /let\s+closed\s*=\s*false/.test(openShopBody) &&
  /if\s*\(\s*closed\s*\)\s*return/.test(openShopBody) &&
  /activeShopRefresh\s*=\s*null/.test(openShopBody) &&
  /activeShopModal\s*=\s*null/.test(openShopBody) &&
  /releaseModalScrollLock\(\s*bd\s*\)/.test(openShopBody) &&
  /bd\.remove\(\)/.test(openShopBody));

console.log(failures ? `FAILURES=${failures}` : 'ALL_PASS');
process.exitCode = failures ? 1 : 0;
