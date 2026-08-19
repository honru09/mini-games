'use strict';

/* UI Repair P0.8: Shop hierarchy/density contract; no commerce authority changes. */
const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');
const template=fs.readFileSync(path.join(ROOT,'public','index-template.html'),'utf8');
const shop=fs.readFileSync(path.join(ROOT,'public','src','shop','06-shop.js'),'utf8');
const server=fs.readFileSync(path.join(ROOT,'server','index.js'),'utf8');
const locales=Object.fromEntries(['zh-CN','en-US','uk-UA'].map(lang=>[lang,JSON.parse(fs.readFileSync(path.join(ROOT,'public','locales',lang+'.json'),'utf8'))]));
const failures=[];function check(name,ok,detail){console.log((ok?'PASS':'FAIL')+'  '+name+(ok||!detail?'':' :: '+detail));if(!ok)failures.push(name);}
function compact(value){return String(value).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,' ');}
function block(pattern){const match=pattern.exec(template);if(!match)return'';const open=template.indexOf('{',match.index);let depth=0;for(let i=open;i<template.length;i++){if(template[i]==='{')depth++;else if(template[i]==='}'&&--depth===0)return template.slice(open+1,i);}return'';}

const layout=compact(block(/\.shop-layout\s*\{/));
const preview=compact(block(/\.shop-preview-panel\s*\{/));
const grid=compact(block(/\.shop-grid\s*\{/));
const item=compact(block(/\.shop-item\s*\{/));
const background=compact(block(/\.background-shop-item\s*\{/));
check('桌面商城冻结左侧试穿预览与右侧可滚动目录层级',/minmax\(268px,320px\)/.test(layout)&&/position:sticky/.test(preview)&&/min-height:326px/.test(preview),layout+' | '+preview);
check('商品网格使用可读卡片宽度与稳定间距',/minmax\(144px,1fr\)/.test(grid)&&/gap:11px/.test(grid),grid);
check('商品卡统一视觉层级、底部价格和全宽操作',/min-height:178px/.test(item)&&/border-radius:15px/.test(item)&&/\.shop-item \.si-price\{margin-top:auto/.test(template)&&/\.shop-item button\{width:100%/.test(template),item);
check('背景商品使用更高卡片与 16:9 poster',/min-height:244px/.test(background)&&/\.background-poster\{[^}]*aspect-ratio:16\/9/.test(template),background);
check('Premium Background 卡接入类别 class 与动态/静态层级标签',/background-shop-item/.test(shop)&&/shop_tier_animated/.test(shop)&&/shop_tier_static/.test(shop)&&/background-tier/.test(shop));
check('手机保持双列商品、单列试穿区与 44px 操作',/\.shop-layout\{grid-template-columns:1fr/.test(template)&&/\.shop-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(template)&&/\.shop-item button\.btn\{min-height:44px/.test(template));
for(const key of ['shop_tier_animated','shop_tier_static'])check('三语存在 '+key,Object.values(locales).every(locale=>typeof locale[key]==='string'&&locale[key].trim()));
check('商城价格仍由既有服务端权威表控制',/const SHOP_PRICES/.test(server)&&!/SHOP_PRICES/.test(shop),'P0.8 不得改价格');
if(failures.length){console.error('UI_SHOP_LAYOUT_CONTRACT_FAILED: '+failures.join('、'));process.exit(1);}console.log('UI_SHOP_LAYOUT_CONTRACT_ALL_PASS');
