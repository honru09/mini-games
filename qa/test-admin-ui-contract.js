'use strict';

/*
 * Client-only guard for the private test-admin presentation seam. This never
 * starts a server or relies on real credentials: it verifies that the UI is
 * display-only, exact-descriptor gated, and absent from public-profile paths.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname,'..');
const read = relative => fs.readFileSync(path.join(ROOT,relative),'utf8');
const assets = read('public/src/core/06-assets.js');
const roster = read('public/src/ui/07-roster.js');
const social = read('public/src/core/04-social.js');
const profile = read('public/src/shop/05-profile.js');
const shop = read('public/src/shop/06-shop.js');
const shell = read('public/src/core/02-app-shell.js');
const template = read('public/index-template.html');
const locales = Object.fromEntries(['zh-CN','en-US','uk-UA'].map(lang => [lang,JSON.parse(read('public/locales/'+lang+'.json'))]));
let failures = 0;

function check(name,fn){
  try { fn(); console.log('PASS  '+name); }
  catch (error){ failures++; console.log('FAIL  '+name+'\n'+(error && error.stack || error)); }
}
function section(source,start,end){
  const from=source.indexOf(start),to=source.indexOf(end,Math.max(0,from));
  assert(from >= 0,'missing start: '+start);
  assert(to > from,'missing end: '+end);
  return source.slice(from,to);
}

const helperSource = section(assets,'function testAdminPresentation','function initAssetFallbacks');
function helperApi(){
  class Node {
    constructor(){this.attributes={};this.children=[];}
    setAttribute(key,value){this.attributes[key]=String(value);}
    appendChild(child){this.children.push(child);return child;}
  }
  const texts={
    test_admin_currency_unlimited:'∞ G Coins',test_admin_level_short:'Lv.MAX',test_admin_level_bracket:' [Lv.MAX]',test_admin_level_value:'MAX',
    test_admin_growth_max:'Test progression is at MAX',test_admin_badge:'Test Admin',test_admin_badge_aria:'Current test admin',
  };
  const context={
    t:(key,...args)=>Object.prototype.hasOwnProperty.call(texts,key)?texts[key]:(key==='level_short'?'Lv.'+args[0]:key==='level_bracket'?' [Lv.'+args[0]+']':key==='profile_xp_progress'?args.join('/'):'['+key+']'),
    currencyAmountText:(value)=>String(value)+' G Coins',
    el:()=>new Node(),
  };
  vm.createContext(context);
  vm.runInContext(helperSource+'\nglobalThis.__testAdminUi={testAdminPresentation,isTestAdminPrivateAccount,hasTestAdminPrivateProjection,testAdminCurrencyText,testAdminLevelShortText,testAdminLevelBracketText,testAdminLevelValue,testAdminGrowthText,appendTestAdminBadge,applyTestAdminPrivateProjection,stripTestAdminPrivateProjection};',context,{filename:'test-admin-ui-helper.js'});
  return context.__testAdminUi;
}

const fullDescriptor=Object.freeze({isTestAdmin:true,testRole:'test_admin',currencyMode:'unlimited',progressionMode:'max',capabilities:['test_admin_profile']});
const legacyNestedDescriptor=Object.freeze({testAdmin:{sandbox:true,virtualAssets:true,capabilities:['test_admin_profile','test_admin_unlimited_currency','test_admin_all_catalog_items','test_admin_sandbox_match']}});

check('private descriptor requires all four server-issued fields',()=>{
  const api=helperApi();
  assert.strictEqual(api.isTestAdminPrivateAccount(fullDescriptor),true);
  assert.strictEqual(api.isTestAdminPrivateAccount({...fullDescriptor,testRole:'admin'}),false);
  assert.strictEqual(api.isTestAdminPrivateAccount({...fullDescriptor,currencyMode:'finite'}),false);
  assert.strictEqual(api.isTestAdminPrivateAccount({isTestAdmin:true}),false);
  assert.strictEqual(api.isTestAdminPrivateAccount(null),false);
  assert.strictEqual(api.isTestAdminPrivateAccount(legacyNestedDescriptor),true);
  assert.strictEqual(api.isTestAdminPrivateAccount({testAdmin:{sandbox:true,virtualAssets:true,capabilities:['test_admin_profile']}}),false);
  assert.strictEqual(api.hasTestAdminPrivateProjection({uid:'normal'}),false);
  assert.strictEqual(api.hasTestAdminPrivateProjection({isTestAdmin:false}),true);
});

check('private presentation maps only test-admin values to infinity and MAX',()=>{
  const api=helperApi();
  assert.strictEqual(api.testAdminCurrencyText(fullDescriptor),'∞ G Coins');
  assert.strictEqual(api.testAdminLevelShortText(fullDescriptor,9999),'Lv.MAX');
  assert.strictEqual(api.testAdminLevelBracketText(fullDescriptor,9999),' [Lv.MAX]');
  assert.strictEqual(api.testAdminLevelValue(fullDescriptor,9999),'MAX');
  assert.strictEqual(api.testAdminGrowthText(fullDescriptor,1,2),'Test progression is at MAX');
  assert.strictEqual(api.testAdminCurrencyText({coins:7}),'7 G Coins');
  assert.strictEqual(api.testAdminLevelShortText({coins:7},8),'Lv.8');
});

check('badge is visual-only and exact-descriptor gated',()=>{
  const api=helperApi();
  const parent={children:[],appendChild(node){this.children.push(node);return node;}};
  assert.strictEqual(api.appendTestAdminBadge(parent,{coins:1},'header'),null);
  const badge=api.appendTestAdminBadge(parent,fullDescriptor,'header');
  assert(badge && parent.children.length===1);
  assert.strictEqual(badge.attributes['aria-label'],'Current test admin');
  assert(!/online\.send|requestPurchase|saveAccount|localStorage|fetch\s*\(|WebSocket/.test(helperSource),'presentation helper must not mutate, persist, or call a network API');
});

check('server projection is copied in memory then stripped before browser persistence',()=>{
  const api=helperApi();
  const target={capabilities:['forged']};
  api.applyTestAdminPrivateProjection(target,fullDescriptor);
  assert.deepStrictEqual({isTestAdmin:target.isTestAdmin,testRole:target.testRole,currencyMode:target.currencyMode,progressionMode:target.progressionMode},{isTestAdmin:true,testRole:'test_admin',currencyMode:'unlimited',progressionMode:'max'});
  assert(!Object.prototype.hasOwnProperty.call(target,'capabilities'));
  const saved=api.stripTestAdminPrivateProjection({...target,testAdmin:{sandbox:true},capabilities:['test_admin_profile'],coins:9});
  ['isTestAdmin','testRole','currencyMode','progressionMode','testAdmin','capabilities'].forEach(key=>assert(!Object.prototype.hasOwnProperty.call(saved,key)));
  assert.strictEqual(saved.coins,9);
  assert(/stripTestAdminPrivateProjection\(account\)/.test(roster),'load path must strip cached metadata');
  assert((roster.match(/stripTestAdminPrivateProjection\(account\)/g)||[]).length>=2,'guest/session cache must also strip metadata');
  assert(/stripTestAdminPrivateProjection\(safe\)/.test(roster),'save path must strip cached metadata');
  assert(/applyTestAdminPrivateProjection\(account,p\)/.test(roster),'authenticated private profile must refresh the descriptor');
  assert(/hasTestAdminPrivateProjection\(p\)/.test(roster),'partial profile replies must not erase a valid private descriptor');
  assert(/privateOnly!==true/.test(roster),'test-admin roster aid must be excluded from persisted/public lists');
  assert(/const visibleRoster=roster\.filter\(p => p && p\.privateOnly !== true\)/.test(roster),'local leaderboard must hide the private test-admin row');
});

check('only current-account surfaces consume the private presentation',()=>{
  assert(/appendTestAdminBadge\(btn,account,'header'\)/.test(roster),'header badge missing');
  assert(/appendTestAdminBadge\(nm,account,'card'\)/.test(social),'my-card badge missing');
  assert(/appendTestAdminBadge\(name,account,'profile'\)/.test(shell),'profile route badge missing');
  assert(/testAdminLevelValue\(account,Number\(account\.level\)/.test(shell),'home goal must use the MAX level display');
  assert(/testAdminLevelShortText\(account,level\)/.test(shell),'home identity pulse must use the MAX level display');
  assert(/const testAdmin=!!isMe&&!!account&&typeof isTestAdminPrivateAccount/.test(profile),'legacy modal must gate through isMe and current account');
  const popup=profile.slice(profile.indexOf('function renderProfilePopup'));
  assert(!/isTestAdminPrivateAccount\(p\)/.test(popup),'public profile data must never earn an admin marker');
  assert(/testAdminCurrencyText\(account\)/.test(shop),'shop balance must use the private display helper');
  assert(/shop-test-admin-note/.test(shop),'shop should explain virtual current-catalog ownership to the test account');
});

check('all locales carry complete test-admin copy',()=>{
  const keys=['test_admin_badge','test_admin_badge_aria','test_admin_currency_unlimited','test_admin_level_short','test_admin_level_bracket','test_admin_level_value','test_admin_growth_max','test_admin_growth_aria','test_admin_shop_note'];
  for (const [lang,locale] of Object.entries(locales)) keys.forEach(key=>assert.strictEqual(typeof locale[key],'string',lang+' missing '+key));
  assert.strictEqual(locales['zh-CN'].test_admin_badge,'测试管理员');
  assert.strictEqual(locales['en-US'].test_admin_currency_unlimited,'∞ G Coins');
});

check('responsive dual-theme badge styling is present without adding a control',()=>{
  assert(/\.test-admin-badge\{/.test(template),'badge style missing');
  assert(/\.test-admin-badge--profile/.test(template),'profile badge variant missing');
  assert(/\.shop-test-admin-note/.test(template),'shop note style missing');
  assert(!/test-admin-badge[^\n]*cursor:pointer/.test(template),'badge must not look like a privileged control');
});

if (failures){
  console.error('TEST_ADMIN_UI_CONTRACT_FAIL '+failures);
  process.exit(1);
}
console.log('TEST_ADMIN_UI_CONTRACT_PASS');
