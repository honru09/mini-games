'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let failed = false;
function check(ok, message){
  console.log((ok ? 'PASS  ' : 'FAIL  ') + message);
  if (!ok) failed = true;
}

const assetSource = 'art-source/brand/ghost-game/currency/gcoins-p0-20260810/gcoins-source-chroma-v1.png';
const provenance = 'art-source/brand/ghost-game/currency/gcoins-p0-20260810/PROMPT_AND_PROVENANCE.md';
const sourceBytes = fs.readFileSync(path.join(root, assetSource));
const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const catalog = JSON.parse(read('asset-library/catalog.json'));
const core = read('public/src/core/06-assets.js');
const roster = read('public/src/ui/07-roster.js');
const shop = read('public/src/shop/06-shop.js');
const appShell = read('public/src/core/02-app-shell.js');
const social = read('public/src/core/04-social.js');
const server = read('server/index.js');
const locales = ['zh-CN','en-US','uk-UA'].map(lang => JSON.parse(read(`public/locales/${lang}.json`)));

check(core.includes("const CURRENCY_NAME = 'G Coins';"), '品牌名与旧 fallback 在资产层分离冻结');
check(core.includes('function currencyName()') && core.includes('function currencyAmountText('), '统一货币文本 seam 存在');
check(core.includes("const CURRENCY_ASSET_ID = 'P-003';"), '现有生产资产 ID P-003 保持稳定');
check(roster.includes('currencyName') && shop.includes('currencyAmountText') && appShell.includes('currencyAmountText'), '奖励、商城与 Profile 余额消费统一文本 seam');
check(social.includes("icon === '__currency__'") && social.includes('currencyIcon'), '玩家档案货币统计消费统一图标 seam');
check(server.includes('G Coins 余额不足，请完成有效对局获取 G Coins'), '服务端余额错误使用新品牌名并保留 reason');
check(locales.every(locale => locale.currency_name === 'G Coins' && typeof locale.currency_aria === 'string' && typeof locale.currency_legal === 'string'), '三语言包含同构品牌、ARIA 与法律说明');
check(!manifest.assets.some(item => String(item.sourcePath || '').includes('gcoins-p0-20260810')), '未经审批的 G Coins 源稿未进入生产 Manifest');
const catalogAsset = catalog.assets.find(item => item.id === 'ART-026-GCOINS-SOURCE-CHROMA-V1');
check(!!catalogAsset && catalogAsset.status === 'reference-only' && catalogAsset.sourcePath === assetSource, '素材库登记 source-only/reference-only G Coins 源稿');
check(!!catalogAsset && String(catalogAsset.sourceSha256 || '').toLowerCase() === crypto.createHash('sha256').update(sourceBytes).digest('hex'), 'G Coins 源稿 SHA-256 与素材库一致');
check(fs.existsSync(path.join(root, provenance)) && read(provenance).includes('9D6D8870329B04B5A136F66449498656B7601BEE15AFBDABC2A73EAA030919AD'), 'G Coins Prompt/provenance 含哈希与审批门禁');
check(!/\b(?:gCoins|g_coins)\b/.test(core + roster + shop + appShell + social), 'UI 命名批次未引入不兼容的 gCoins 字段');

if (failed) process.exitCode = 1;
else console.log('G_COINS_CONTRACT_ALL_PASS');
