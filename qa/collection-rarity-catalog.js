'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.join(__dirname,'..');
const catalogPath=path.join(ROOT,'shared','progression','collection-rarity-catalog.js');
const failures=[];
function check(name,condition,detail){console.log((condition?'PASS  ':'FAIL  ')+name+(condition||!detail?'':' :: '+detail));if(!condition)failures.push(name);}
function sourceSlice(source,start,end,label){const from=source.indexOf(start),to=source.indexOf(end,from+start.length);if(from<0||to<0)throw new Error('无法提取 '+label);return source.slice(from,to);}
function readCurrentCatalog(){
  const source=fs.readFileSync(path.join(ROOT,'public','src','ui','07-roster.js'),'utf8');
  const slice=sourceSlice(source,'const AVATAR_CATEGORIES','function shopItemName','商城目录');
  const assets=fs.readFileSync(path.join(ROOT,'public','src','core','06-assets.js'),'utf8');
  const premiumSlice=sourceSlice(assets,'const PREMIUM_BACKGROUNDS','const PREMIUM_BACKGROUND_BY_ID','高级背景目录');
  const premium=[...premiumSlice.matchAll(/\bid:(\d+)/g)].map(match=>({id:Number(match[1])}));
  const context=vm.createContext({PREMIUM_BACKGROUNDS:premium});
  vm.runInContext(slice+'\nglobalThis.__SHOP=SHOP;globalThis.__PLAYROOM_AVATARS=PLAYROOM_AVATARS;',context,{filename:'07-roster.js:collection-rarity'});
  return {shop:context.__SHOP,playroomAvatars:context.__PLAYROOM_AVATARS};
}
function ids(items){return [...new Set((Array.isArray(items)?items:[]).map(item=>Number(item&&item.id)).filter(Number.isSafeInteger))].sort((a,b)=>a-b);}
function expectedIds(){
  const current=readCurrentCatalog();
  return Object.freeze({
    avatars:ids([...Array.from({length:30},(_,id)=>({id})),...(current.shop.avatars||[]),...(current.playroomAvatars||[])]),
    frames:ids([{id:0},...(current.shop.frames||[])]),
    effects:ids([{id:0},...(current.shop.effects||[])]),
    backgrounds:ids([{id:0},...(current.shop.backgrounds||[])]),
    game_cosmetics:ids(current.shop.game_cosmetics),
  });
}
const expected=expectedIds();
let catalog=null;
try{catalog=require(catalogPath);}catch(error){check('collection rarity module can be loaded',false,error&&error.message);}
if(catalog){
  check('catalog exports a frozen v1 API',catalog.schemaVersion===1&&Object.isFrozen(catalog)&&Object.isFrozen(catalog.RARITY_ORDER)&&Object.isFrozen(catalog.ENTRY_LIST));
  check('catalog exposes only four curated display tiers',JSON.stringify(catalog.RARITY_ORDER)===JSON.stringify(['starter','uncommon','rare','epic']));
  const actual={};
  Object.keys(expected).forEach(category=>actual[category]=ids((catalog.ENTRY_LIST||[]).filter(entry=>entry.category===category)));
  Object.keys(expected).forEach(category=>check(category+' current stable IDs are fully and uniquely catalogued',JSON.stringify(actual[category])===JSON.stringify(expected[category]),JSON.stringify({expected:expected[category],actual:actual[category]})));
  check('every catalog entry is frozen and has a known explicit tier',(catalog.ENTRY_LIST||[]).every(entry=>Object.isFrozen(entry)&&expected[entry.category].includes(entry.id)&&catalog.RARITY_ORDER.includes(entry.tier)));
  check('known stable and default-free IDs return their explicit entries',catalog.entryFor('avatars',0)&&catalog.entryFor('frames',0)&&catalog.entryFor('effects',0)&&catalog.entryFor('backgrounds',0)&&catalog.entryFor('avatars',30)&&catalog.entryFor('avatars','100')&&catalog.entryFor('game_cosmetics',2051));
  check('unknown, inherited, malformed and hostile IDs do not receive a guessed tier',catalog.entryFor('avatars',999)===null&&catalog.entryFor('avatars',Symbol('bad'))===null&&catalog.entryFor('unknown',30)===null);
  const inherited=Object.create({avatars:[30]});
  const summary=catalog.deriveOwnedCollection({avatars:[0,30,'30',100,999,{},Symbol('bad')],frames:[0,1,1],effects:[0,4],backgrounds:[0,20],game_cosmetics:[2001]},inherited);
  check('owned summary is frozen and counts catalogued items by category once',Object.isFrozen(summary)&&Object.isFrozen(summary.byRarity)&&summary.ownedCount===10&&summary.unknownOwnedCount===1&&summary.byRarity.starter===5&&summary.byRarity.uncommon===2&&summary.byRarity.rare===2&&summary.byRarity.epic===1,JSON.stringify(summary));
  const starter=catalog.deriveOwnedCollection({avatars:Array.from({length:30},(_,id)=>id),frames:[0],effects:[0],backgrounds:[0]});
  check('a normal starter account has no false unclassified collection warning',starter.ownedCount===33&&starter.unknownOwnedCount===0&&starter.byRarity.starter===33,JSON.stringify(starter));
  check('inherited owned collections cannot enter the summary',catalog.deriveOwnedCollection(inherited).ownedCount===0);
  check('summary contains no commercial, reward, or account-history fields',!/(price|coins|purchase|reward|ledger|xp|time)/i.test(JSON.stringify(summary)));
  const source=fs.readFileSync(catalogPath,'utf8');
  check('catalog source never derives rarity from a commercial field',!/price|coins|purchase|reward|ledger/i.test(source));
}
const build=fs.readFileSync(path.join(ROOT,'scripts','build.js'),'utf8');
const shell=fs.readFileSync(path.join(ROOT,'public','src','core','02-app-shell.js'),'utf8');
const shop=fs.readFileSync(path.join(ROOT,'public','src','shop','06-shop.js'),'utf8');
const profile=fs.readFileSync(path.join(ROOT,'public','src','shop','05-profile.js'),'utf8');
const online=fs.readFileSync(path.join(ROOT,'public','src','online','03-websocket.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'public','index-template.html'),'utf8');
const locales=['zh-CN.json','en-US.json','uk-UA.json'].map(file=>JSON.parse(fs.readFileSync(path.join(ROOT,'public','locales',file),'utf8')));
check('browser build loads collection catalog after journey and before profile consumer',build.indexOf('../../shared/progression/collection-rarity-catalog.js')>build.indexOf('../../shared/progression/profile-journey.js')&&build.indexOf('../../shared/progression/collection-rarity-catalog.js')<build.indexOf('core/02-app-shell.js'));
check('own Profile renders a local catalogue progress and distribution',/CollectionRarityCatalog\.deriveOwnedCollection\(owned\)/.test(shell)&&/profile-collection-rarity/.test(shell));
check('shop cards render a safe rarity badge without changing purchase state',/collectionRarityBadge/.test(shop)&&/entryFor\(category,item\.id\)/.test(shop));
if(catalog){
  const badgeSource=sourceSlice(shop,'function collectionRarityBadge','function shopCatalogItems','商城稀有度标签');
  const badgeContext=vm.createContext({CollectionRarityCatalog:catalog,t:key=>key,el:(tag,className,text)=>({tagName:tag,className,textContent:text,attributes:{},setAttribute(key,value){this.attributes[key]=value;}})});
  vm.runInContext(badgeSource+'\nglobalThis.__collectionRarityBadge=collectionRarityBadge;',badgeContext,{filename:'06-shop.js:collection-rarity'});
  const known=badgeContext.__collectionRarityBadge('backgrounds',{id:20}),unknown=badgeContext.__collectionRarityBadge('backgrounds',{id:999});
  check('shop rarity helper reads only the explicit entry and leaves unknown cards unlabelled',known&&known.attributes['data-rarity']==='rare'&&known.textContent==='shop_rarity_label'&&unknown===null);
}
check('public Profile and friend comparison do not consume owned rarity data',!/CollectionRarityCatalog/.test(profile)&&!/CollectionRarityCatalog/.test(online));
check('catalogue styles include compact mobile-safe rarity chips',/\.collection-rarity-badge\{/.test(html)&&/\.profile-collection-rarity\{/.test(html)&&/@media\(max-width:640px\)[\s\S]{0,3200}\.profile-collection-rarity/.test(html));
const keys=['collection_rarity_title','collection_rarity_progress','collection_rarity_unclassified','shop_rarity_label','collection_rarity_starter','collection_rarity_uncommon','collection_rarity_rare','collection_rarity_epic'];
check('three locales define the same rarity presentation keys',locales.every(locale=>keys.every(key=>typeof locale[key]==='string'&&locale[key].length>0)));
if(failures.length){console.error('COLLECTION_RARITY_CATALOG_FAILURES='+failures.length+' :: '+failures.join('、'));process.exitCode=1;}else console.log('COLLECTION_RARITY_CATALOG_ALL_PASS');
