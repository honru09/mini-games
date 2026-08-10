'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const rosterSource = fs.readFileSync(path.join(ROOT, 'public', 'src', 'ui', '07-roster.js'), 'utf8');
const shopSource = fs.readFileSync(path.join(ROOT, 'public', 'src', 'shop', '06-shop.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
const failures = [];

function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

function sourceSlice(source, start, end, label){
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error('无法提取 ' + label);
  return source.slice(from, to);
}

function readClientCatalog(){
  const source = sourceSlice(rosterSource, 'const AVATAR_CATEGORIES', 'function shopItemName', '客户端商城目录');
  const context = vm.createContext({ PREMIUM_BACKGROUNDS: [] });
  vm.runInContext(source + '\nglobalThis.__SHOP = SHOP;', context, { filename:'07-roster.js:SHOP' });
  return context.__SHOP;
}

function readServerPrices(){
  const source = sourceSlice(serverSource, 'const SHOP_PRICES', 'const GAME_COSMETIC_CATALOG', '服务端权威价格');
  const context = vm.createContext({});
  vm.runInContext(source + '\nglobalThis.__SHOP_PRICES = SHOP_PRICES;', context, { filename:'server/index.js:SHOP_PRICES' });
  return context.__SHOP_PRICES;
}

function pricesFor(items, ids){
  const wanted = new Set(ids);
  return Object.fromEntries(items.filter(item => wanted.has(Number(item.id))).map(item => [Number(item.id), Number(item.price)]));
}

function serverPricesFor(prices, category, ids){
  return Object.fromEntries(ids.map(id => [id, Number(prices[category][id])]));
}

function samePrices(client, server){
  return JSON.stringify(client) === JSON.stringify(server) && Object.values(client).every(Number.isFinite);
}

class FakeNode {
  constructor(tag, className){
    this.tagName = String(tag || '').toUpperCase();
    this.className = className || '';
    this.children = [];
    this.parentNode = null;
    this.isConnected = false;
    this.listeners = Object.create(null);
    this.attributes = Object.create(null);
    this.classList = { toggle: () => {}, add: () => {} };
  }
  appendChild(child){
    child.parentNode = this;
    child.setConnected(this.isConnected);
    this.children.push(child);
    return child;
  }
  setConnected(value){
    this.isConnected = value;
    this.children.forEach(child => child.setConnected(value));
  }
  addEventListener(type, listener){ this.listeners[type] = listener; }
  setAttribute(name,value){ this.attributes[name] = String(value); }
  removeAttribute(name){ delete this.attributes[name]; }
  dispatch(type){ if (this.listeners[type]) this.listeners[type]({ target:this }); }
  remove(){
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.parentNode = null;
    this.setConnected(false);
  }
  querySelectorAll(){ return []; }
  querySelector(selector){ return selector && selector.startsWith('.') ? this.findByClass(selector.slice(1)) : null; }
  findByClass(name){
    if (this.className.split(/\s+/).includes(name)) return this;
    for (const child of this.children){
      const found = child.findByClass(name);
      if (found) return found;
    }
    return null;
  }
}

function shopRuntimeContract(){
  const body = new FakeNode('body');
  body.setConnected(true);
  const counters = { acquired:0, released:0 };
  const catalog = { avatars:[], frames:[], effects:[], backgrounds:[
    {id:1,price:3},{id:2,price:3},{id:3,price:3},{id:4,price:3},{id:5,price:3},{id:6,price:5},
    {id:7,price:18},{id:8,price:18},{id:9,price:22},{id:10,price:20},
  ], game_cosmetics:[] };
  const context = vm.createContext({
    SHOP:catalog, PLAYROOM_AVATARS:[], AVATAR_CATEGORIES:[], CURRENCY:'$', GAMES:{},
    account:{ coins:0, avatar:0, owned:{ backgrounds:[] } },
    online:{ connected:true, send(){} }, document:{ body },
    el:(tag, cls) => new FakeNode(tag, cls), currencyIcon:() => new FakeNode('span'),
    t:key => key, ownItem:(account, category, id) => !!(account.owned && account.owned[category] && account.owned[category].includes(id)),
    acquireModalScrollLock:() => { counters.acquired++; },
    releaseModalScrollLock:() => { counters.released++; },
    openAuthModal(){}, avatarCanvas:() => new FakeNode('canvas'),
    premiumBackgroundMeta:() => null, backgroundPosterNode:() => new FakeNode('div'),
    saveAccount(){}, syncProfiles(){}, renderMe(){}, toast(){}, setTimeout(){}, crypto:undefined,
  });
  vm.runInContext(shopSource + '\nglobalThis.__shopCatalogItems = shopCatalogItems; globalThis.__shopState = () => ({ activeShopModal, activeShopRefresh });', context, { filename:'06-shop.js' });
  return { context, body, counters };
}

const clientCatalog = readClientCatalog();
const serverPrices = readServerPrices();
const ranges = {
  avatars:Array.from({length:26}, (_, index) => index + 30),
  frames:Array.from({length:8}, (_, index) => index + 1),
  effects:Array.from({length:4}, (_, index) => index + 1),
  backgrounds:Array.from({length:4}, (_, index) => index + 7),
};

for (const [category, ids] of Object.entries(ranges)){
  const client = pricesFor(clientCatalog[category], ids);
  const server = serverPricesFor(serverPrices, category, ids);
  check(category + ' 客户端价格与服务端权威价格一致', samePrices(client, server), JSON.stringify({client,server}));
  check(category + ' 指定商品 ID 完整无重复', Object.keys(client).length === ids.length, JSON.stringify(client));
}

const runtime = shopRuntimeContract();
const visibleDefault = vm.runInContext("__shopCatalogItems('backgrounds', account).map(item => item.id)", runtime.context);
check('未拥有的 Starter Background 1–6 不进入商城渲染目录', !visibleDefault.some(id => id >= 1 && id <= 6), JSON.stringify(visibleDefault));
vm.runInContext('account.owned.backgrounds = [2, 5];', runtime.context);
const visibleOwned = vm.runInContext("__shopCatalogItems('backgrounds', account).map(item => item.id)", runtime.context);
check('已拥有的 Starter Background 仍可在商城选择', visibleOwned.includes(2) && visibleOwned.includes(5), JSON.stringify(visibleOwned));
check('商城渲染循环使用背景过滤契约', /shopCatalogItems\(cat, account\)\.forEach\(item\s*=>/.test(shopSource));

vm.runInContext('openShop(); openShop();', runtime.context);
check('连续打开商城只创建一个弹层并只获取一次滚动锁', runtime.body.children.length === 1 && runtime.counters.acquired === 1, JSON.stringify(runtime.counters));
const closeButton = runtime.body.findByClass('shop-close');
check('单例商城存在可用关闭按钮', !!closeButton);
if (closeButton){
  closeButton.dispatch('click');
  closeButton.dispatch('click');
}
const closedState = vm.runInContext('__shopState()', runtime.context);
check('关闭商城清空刷新函数和单例引用', closedState.activeShopModal === null && closedState.activeShopRefresh === null);
check('重复关闭商城只释放一次滚动锁', runtime.counters.released === 1, JSON.stringify(runtime.counters));
check('关闭商城后弹层已移除', runtime.body.children.length === 0);

if (failures.length){
  console.error('SHOP_CONTRACT_FAILED: ' + failures.join('、'));
  process.exit(1);
}
console.log('SHOP_CONTRACT_ALL_PASS');
