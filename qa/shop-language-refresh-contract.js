'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const shop = fs.readFileSync(path.join(root, 'public/src/shop/06-shop.js'), 'utf8');
let failures = 0;
function check(ok, message){
  console.log((ok ? 'PASS  ' : 'FAIL  ') + message);
  if (!ok) failures++;
}

check(/function installShopLanguageRefresh\(\)/.test(shop) &&
  /window\.addEventListener\(['"]languagechange['"]\s*,\s*shopLanguageListener\)/.test(shop),
  '商城打开后订阅一次 languagechange，并转发已有刷新 seam');
check(/function releaseShopLanguageRefresh\(\)/.test(shop) &&
  /window\.removeEventListener\(['"]languagechange['"]\s*,\s*shopLanguageListener\)/.test(shop) &&
  /releaseShopLanguageRefresh\(\)/.test(shop.slice(shop.indexOf('function releaseShopResources'))),
  '商城关闭释放 languagechange listener，避免重复监听泄漏');
check(/localize\(headerTitle,t\(['"]shop_title['"]\)/.test(shop) &&
  /localize\(headerSubtitle,t\(['"]shop_preview_hint['"]\)/.test(shop) &&
  /localize\(closeTop,t\(['"]close['"]\)/.test(shop) &&
  /tabs\.setAttribute\(['"]aria-label['"]\s*,\s*t\(['"]shop_title['"]\)/.test(shop),
  '语言切换重算商城标题、副标题、关闭按钮和分类导航文案');
check(/const restoreSelection = previewSelection/.test(shop) &&
  /activeShopPurchase\.modal === bd/.test(shop) &&
  /pendingButton\.disabled = true/.test(shop) &&
  /activeShopPurchase\.statusNode = purchaseStatus/.test(shop),
  '语言切换保留当前 tab/selection，并重新绑定购买 pending 控件与状态');

if (failures){
  console.error('SHOP_LANGUAGE_REFRESH_CONTRACT_FAILURES=' + failures);
  process.exitCode = 1;
} else console.log('SHOP_LANGUAGE_REFRESH_CONTRACT_ALL_PASS');
