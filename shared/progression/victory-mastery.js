/* Server-authoritative wins -> read-only mastery presentation. */
(function installVictoryMastery(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.VictoryMastery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function victoryMasteryFactory(){
  'use strict';
  const GAME_IDS=Object.freeze(['gomoku','ludo','monopoly','tank','tetris','xiangqi']);
  const THRESHOLDS=Object.freeze([1,10,50,100,1000]);
  const BADGES=Object.freeze(['◇','◆','✦','✪','♛']);
  const CATALOG=Object.freeze(GAME_IDS.flatMap(game=>THRESHOLDS.map((threshold,index)=>Object.freeze({
    id:game+'-'+threshold,game,threshold,badge:BADGES[index],nameKey:'mastery_'+game+'_'+threshold,
  }))));
  function safeCount(value){
    try{const number=Number(value);return Number.isFinite(number)&&number>0?Math.min(1000000000,Math.floor(number)):0;}
    catch(_error){return 0;}
  }
  function ownCount(source,game){
    try{return Object.prototype.hasOwnProperty.call(source,game)?safeCount(source[game]):0;}
    catch(_error){return 0;}
  }
  function normalizeWins(value){
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    return Object.freeze(Object.fromEntries(GAME_IDS.map(game=>[game,ownCount(source,game)])));
  }
  function deriveVictoryMastery(value){
    const wins=normalizeWins(value),byGame={};let unlockedCount=0;
    GAME_IDS.forEach(game=>{
      const count=wins[game],tiers=CATALOG.filter(item=>item.game===game),current=tiers.filter(item=>item.threshold<=count).slice(-1)[0]||null,next=tiers.find(item=>item.threshold>count)||null;
      unlockedCount+=tiers.filter(item=>item.threshold<=count).length;
      byGame[game]=Object.freeze({wins:count,current,nextThreshold:next?next.threshold:null,remaining:next?Math.max(0,next.threshold-count):0});
    });
    return Object.freeze({schemaVersion:1,unlockedCount,totalAvailable:CATALOG.length,byGame:Object.freeze(byGame)});
  }
  return Object.freeze({schemaVersion:1,GAME_IDS,THRESHOLDS,CATALOG,normalizeWins,deriveVictoryMastery});
});
