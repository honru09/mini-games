'use strict';

const counters=Object.create(null);
function increment(name,amount=1){const key=String(name||'unknown');counters[key]=(Number(counters[key])||0)+Math.max(0,Number(amount)||0);}
function snapshot(dynamic={}){return{...Object.fromEntries(Object.keys(counters).sort().map(key=>[key,counters[key]])),activeMatches:Number(dynamic.activeMatches)||0,activeSpectators:Number(dynamic.activeSpectators)||0,activeTournaments:Number(dynamic.activeTournaments)||0,generatedAt:new Date().toISOString()};}
module.exports={increment,snapshot};
