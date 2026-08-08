'use strict';

const counters=Object.create(null);
function increment(name,amount=1){const key=String(name||'unknown');counters[key]=(Number(counters[key])||0)+Math.max(0,Number(amount)||0);}
function snapshot(dynamic={}){return{...Object.fromEntries(Object.keys(counters).sort().map(key=>[key,counters[key]])),activeMatches:Number(dynamic.activeMatches)||0,activeSpectators:Number(dynamic.activeSpectators)||0,activeTournaments:Number(dynamic.activeTournaments)||0,generatedAt:new Date().toISOString()};}
function safeSnapshot(input){
  const out={generatedAt:String(input&&input.generatedAt||new Date().toISOString())};
  for(const [key,value] of Object.entries(input||{})){
    if(key==='generatedAt'||!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key))continue;
    const numeric=Number(value);if(Number.isFinite(numeric))out[key]=numeric;
  }
  return out;
}
function alerts(current,previous={},thresholds={}){
  const now=safeSnapshot(current),before=safeSnapshot(previous),items=[];
  const delta=(key)=>Math.max(0,(Number(now[key])||0)-(Number(before[key])||0));
  const protocolThreshold=Math.max(1,Number(thresholds.protocolErrors)||20);
  const rejectedThreshold=Math.max(1,Number(thresholds.clientResultRejected)||20);
  const serverErrorThreshold=Math.max(1,Number(thresholds.serverErrors)||1);
  const matchThreshold=Math.max(1,Number(thresholds.activeMatches)||200);
  if(delta('protocolErrors')>=protocolThreshold)items.push({code:'protocol_error_spike',severity:'warning',value:delta('protocolErrors'),threshold:protocolThreshold});
  if(delta('clientResultRejected')>=rejectedThreshold)items.push({code:'client_result_rejection_spike',severity:'warning',value:delta('clientResultRejected'),threshold:rejectedThreshold});
  if(delta('serverErrors')>=serverErrorThreshold)items.push({code:'server_error_detected',severity:'critical',value:delta('serverErrors'),threshold:serverErrorThreshold});
  if((Number(now.activeMatches)||0)>=matchThreshold)items.push({code:'active_match_capacity',severity:'warning',value:Number(now.activeMatches)||0,threshold:matchThreshold});
  return items;
}
function historyCsv(history){
  const rows=(Array.isArray(history)?history:[]).map(safeSnapshot);
  const keys=[...new Set(rows.flatMap(row=>Object.keys(row).filter(key=>key!=='generatedAt')))].sort();
  const escape=value=>'"'+String(value===undefined?'':value).replace(/"/g,'""')+'"';
  return [['generatedAt',...keys].map(escape).join(','),...rows.map(row=>[row.generatedAt,...keys.map(key=>row[key]??'')].map(escape).join(','))].join('\r\n')+'\r\n';
}
module.exports={increment,snapshot,safeSnapshot,alerts,historyCsv};
