/* Read-only explicit collection display roster. */
(function installCollectionRarityCatalog(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.CollectionRarityCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this,function collectionRarityCatalogFactory(){
  'use strict';
  const CATEGORIES=Object.freeze(['avatars','frames','effects','backgrounds','game_cosmetics']);
  const RARITY_ORDER=Object.freeze(['starter','uncommon','rare','epic']);
  const CURATED_IDS=Object.freeze({
    starter:Object.freeze({
      avatars:Object.freeze([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,100,101,108,109,116,117,124,125,132,133,140,141]),
      frames:Object.freeze([0]),
      effects:Object.freeze([0]),
      backgrounds:Object.freeze([0,1,2,3,4,5,6]),
      game_cosmetics:Object.freeze([]),
    }),
    uncommon:Object.freeze({
      avatars:Object.freeze([30,31,32,36,37,38,39,42,43,44,45,48,49,50,54,102,103,110,111,118,119,126,127,134,135,142,143]),
      frames:Object.freeze([1,2]),
      effects:Object.freeze([1,2]),
      backgrounds:Object.freeze([7,8]),
      game_cosmetics:Object.freeze([]),
    }),
    rare:Object.freeze({
      avatars:Object.freeze([33,34,35,40,41,46,47,51,52,104,105,112,113,120,121,128,129,136,137,144,145]),
      frames:Object.freeze([3,4,5]),
      effects:Object.freeze([3]),
      backgrounds:Object.freeze([9,10,20,22,24,26,28,30]),
      game_cosmetics:Object.freeze([2001,2011,2012,2021,2041,2051]),
    }),
    epic:Object.freeze({
      avatars:Object.freeze([53,55,106,107,114,115,122,123,130,131,138,139,146,147]),
      frames:Object.freeze([6,7,8]),
      effects:Object.freeze([4]),
      backgrounds:Object.freeze([21,23,25,27,29,31]),
      game_cosmetics:Object.freeze([2013,2031,2042]),
    }),
  });
  function safeId(value){
    try{
      if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?value:null;
      if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,8})$/.test(value))return null;
      const number=Number(value);
      return Number.isSafeInteger(number)&&number>=0?number:null;
    }catch(_error){return null;}
  }
  function own(source,key){
    try{return source&&Object.prototype.hasOwnProperty.call(source,key)?source[key]:undefined;}
    catch(_error){return undefined;}
  }
  const entryList=[];
  const entryByKey=new Map();
  RARITY_ORDER.forEach(tier=>{
    const groups=CURATED_IDS[tier];
    CATEGORIES.forEach(category=>{
      const ids=groups[category]||[];
      ids.forEach(value=>{
        const id=safeId(value),key=category+':'+id;
        if(id===null||entryByKey.has(key))throw new Error('Invalid collection roster entry');
        const entry=Object.freeze({category,id,tier});
        entryByKey.set(key,entry);
        entryList.push(entry);
      });
    });
  });
  const ENTRY_LIST=Object.freeze(entryList);
  const CATALOG_COUNT_BY_RARITY=Object.freeze(Object.fromEntries(RARITY_ORDER.map(tier=>[tier,ENTRY_LIST.filter(entry=>entry.tier===tier).length])));
  function entryFor(category,value){
    try{
      if(!CATEGORIES.includes(category))return null;
      const id=safeId(value);
      return id===null?null:entryByKey.get(category+':'+id)||null;
    }catch(_error){return null;}
  }
  function deriveOwnedCollection(value){
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const byRarity=Object.fromEntries(RARITY_ORDER.map(tier=>[tier,0]));
    const byCategory=Object.fromEntries(CATEGORIES.map(category=>[category,0]));
    let ownedCount=0,unknownOwnedCount=0;
    CATEGORIES.forEach(category=>{
      const list=own(source,category);
      if(!Array.isArray(list))return;
      const seen=new Set();
      list.forEach(value=>{
        const id=safeId(value);
        if(id===null)return;
        const key=category+':'+id;
        if(seen.has(key))return;
        seen.add(key);
        const entry=entryFor(category,id);
        if(!entry){unknownOwnedCount++;return;}
        ownedCount++;
        byCategory[category]++;
        byRarity[entry.tier]++;
      });
    });
    return Object.freeze({
      schemaVersion:1,
      ownedCount,
      catalogCount:ENTRY_LIST.length,
      unknownOwnedCount,
      byRarity:Object.freeze(byRarity),
      byCategory:Object.freeze(byCategory),
    });
  }
  return Object.freeze({
    schemaVersion:1,
    CATEGORIES,
    RARITY_ORDER,
    CURATED_IDS,
    ENTRY_LIST,
    CATALOG_COUNT_BY_RARITY,
    entryFor,
    deriveOwnedCollection,
  });
});
