/* Read-only Profile goal projection; never writes progression or economy state. */
(function installProfileJourney(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ProfileJourney=api;
})(typeof globalThis!=='undefined'?globalThis:this,function profileJourneyFactory(){
  'use strict';
  const OWNED_CATEGORIES=Object.freeze(['avatars','frames','effects','backgrounds','game_cosmetics']);
  function safeInt(value,maximum){try{const number=Number(value);return Number.isFinite(number)&&number>0?Math.min(maximum||1000000000,Math.floor(number)):0;}catch(_error){return 0;}}
  function own(source,key){try{return source&&Object.prototype.hasOwnProperty.call(source,key)?source[key]:undefined;}catch(_error){return undefined;}}
  function uniqueStrings(value){return Array.isArray(value)?new Set(value.filter(item=>typeof item==='string'&&item.length<=96)).size:0;}
  function ownedCounts(value){
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{},byCategory={};let total=0;
    OWNED_CATEGORIES.forEach(category=>{const list=own(source,category),count=Array.isArray(list)?new Set(list.filter(item=>(typeof item==='string'||typeof item==='number')&&String(item).length<=96).map(item=>String(item))).size:0;byCategory[category]=count;total+=count;});
    return Object.freeze({total,byCategory:Object.freeze(byCategory)});
  }
  function deriveProfileJourney(profile,options){
    const source=profile&&typeof profile==='object'&&!Array.isArray(profile)?profile:{},config=options&&typeof options==='object'?options:{},masteryApi=config.masteryApi;
    const gameIds=masteryApi&&Array.isArray(masteryApi.GAME_IDS)?masteryApi.GAME_IDS:[],catalog=masteryApi&&Array.isArray(masteryApi.CATALOG)?masteryApi.CATALOG:[];
    const supplied=own(source,'mastery'),projection=supplied&&supplied.byGame&&typeof supplied.byGame==='object'?supplied:masteryApi&&typeof masteryApi.deriveVictoryMastery==='function'?masteryApi.deriveVictoryMastery(own(source,'wins')):{byGame:{},unlockedCount:0,totalAvailable:catalog.length};
    const goals=gameIds.map((gameId,index)=>{const state=projection.byGame&&projection.byGame[gameId],wins=safeInt(state&&state.wins),nextThreshold=safeInt(state&&state.nextThreshold),remaining=safeInt(state&&state.remaining);if(!nextThreshold)return null;const nextTitle=catalog.find(item=>item&&item.game===gameId&&item.threshold===nextThreshold)||null;return nextTitle?{gameId,index,active:wins>0,nextThreshold,remaining:Math.max(1,remaining),nextTitle}:null;}).filter(Boolean).sort((a,b)=>Number(b.active)-Number(a.active)||a.remaining-b.remaining||a.nextThreshold-b.nextThreshold||a.index-b.index);
    const unlocked=safeInt(projection.unlockedCount,catalog.length),totalAvailable=safeInt(projection.totalAvailable,catalog.length)||catalog.length;
    const achievementTotal=safeInt(config.achievementTotal,10000),achievementUnlocked=Math.min(achievementTotal||10000,uniqueStrings(own(source,'achievements'))),collection=ownedCounts(own(source,'owned'));
    const nearest=goals[0]||null;
    return Object.freeze({schemaVersion:1,mastery:Object.freeze({complete:!nearest,unlocked,total:totalAvailable,gameId:nearest?nearest.gameId:null,nextThreshold:nearest?nearest.nextThreshold:null,remaining:nearest?nearest.remaining:0,nextTitle:nearest?nearest.nextTitle:null}),achievements:Object.freeze({unlocked:achievementUnlocked,total:achievementTotal,complete:achievementTotal>0&&achievementUnlocked>=achievementTotal}),collection});
  }
  return Object.freeze({schemaVersion:1,OWNED_CATEGORIES,deriveProfileJourney});
});
