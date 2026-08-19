'use strict';

const { normalizeStored, publicPresentation } = require('./player-character');

const REQUEST_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{7,120}$/;
const MAX_REQUESTS = 100;
const CATEGORY = 'player_character';
const SLOT_NAMES = Object.freeze(['body','face','hair','top','bottom','footwear','accessory']);
const DEFAULT_ECONOMY_STATE = Object.freeze({
  owned: Object.freeze([]),
  equipped: Object.freeze({}),
  requestIds: Object.freeze([]),
  playerCharacter: Object.freeze(publicPresentation()),
});

function safeRecord(value){
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try { const proto=Object.getPrototypeOf(value); return (proto===Object.prototype||proto===null) && !Object.keys(value).some(k=>['__proto__','constructor','prototype'].includes(k)); } catch { return false; }
}
function cloneDefault(){ return { owned:[], equipped:{}, requestIds:[], playerCharacter:publicPresentation() }; }
function catalogEntries(options){
  const catalog=options&&options.catalog;
  if (!Array.isArray(catalog)) return [];
  return catalog.filter(item=>safeRecord(item)&&item.active===true&&Number.isSafeInteger(item.commerceId)&&item.commerceId>=3000&&item.commerceId<=3999&&SLOT_NAMES.includes(item.slot)&&typeof item.runtimeId==='string'&&item.runtimeId.length>0&&item.runtimeId.length<=64);
}
function catalogById(options,id){ return catalogEntries(options).find(item=>item.commerceId===id)||null; }
function normalizeEconomyState(value, options){
  const out=cloneDefault();
  if (!safeRecord(value) || value.ephemeral===true) return out;
  const entries=catalogEntries(options);
  const validIds=new Set(entries.map(item=>item.commerceId));
  const owned=Array.isArray(value.owned)?value.owned.filter(id=>Number.isSafeInteger(id)&&validIds.has(id)).slice(0,400):[];
  out.owned=[...new Set(owned)].sort((a,b)=>a-b);
  const equipped=safeRecord(value.equipped)?value.equipped:{};
  for (const slot of SLOT_NAMES){ const id=equipped[slot]; if (Number.isSafeInteger(id)&&out.owned.includes(id)){const item=catalogById(options,id);if(item&&item.slot===slot)out.equipped[slot]=id;} }
  const requests=Array.isArray(value.requestIds)?value.requestIds.filter(id=>typeof id==='string'&&REQUEST_ID_RE.test(id)).slice(-MAX_REQUESTS):[];
  out.requestIds=[...new Set(requests)];
  const character=normalizeStored(value.playerCharacter);
  for (const item of entries){ if(out.equipped[item.slot]===item.commerceId) character.slots[item.slot]=item.runtimeId; }
  out.playerCharacter=publicPresentation(character);
  return out;
}
function publicProjection(value){ return publicPresentation(safeRecord(value)&&value.playerCharacter!==undefined?value.playerCharacter:value); }
function validatePurchaseIntent(input, options){
  if (!safeRecord(input)||input.category!==CATEGORY) return {ok:false,reason:'invalid_category'};
  if (!Number.isSafeInteger(input.commerceId)) return {ok:false,reason:'invalid_commerce_id'};
  if (typeof input.requestId!=='string'||!REQUEST_ID_RE.test(input.requestId)) return {ok:false,reason:'invalid_purchase_id'};
  const item=catalogById(options,input.commerceId); if(!item) return {ok:false,reason:'catalog_not_enabled'};
  const resolver=options&&typeof options.priceResolver==='function'?options.priceResolver:null;
  const expectedPrice=resolver?resolver(item.commerceId,item):null;
  if (!Number.isSafeInteger(expectedPrice)||expectedPrice<0) return {ok:false,reason:'price_unavailable'};
  return {ok:true,category:CATEGORY,commerceId:item.commerceId,requestId:input.requestId,slot:item.slot,runtimeId:item.runtimeId,expectedPrice};
}
function equipOwned(value, commerceId, options){
  const state=normalizeEconomyState(value,options), item=catalogById(options,commerceId);
  if(!item) return {ok:false,reason:'catalog_not_enabled',state};
  if(!state.owned.includes(item.commerceId)) return {ok:false,reason:'not_owned',state};
  const next=normalizeEconomyState({...state,equipped:{...state.equipped,[item.slot]:item.commerceId}},options);
  return {ok:true,reason:null,state:next};
}
function rememberRequest(value,requestId,options){
  const state=normalizeEconomyState(value,options); if(typeof requestId!=='string'||!REQUEST_ID_RE.test(requestId))return state;
  state.requestIds=[...new Set([...state.requestIds,requestId])].slice(-MAX_REQUESTS); return state;
}
function hasRequest(value,requestId,options){ return typeof requestId==='string'&&normalizeEconomyState(value,options).requestIds.includes(requestId); }

module.exports=Object.freeze({CATEGORY,REQUEST_ID_RE,MAX_REQUESTS,SLOT_NAMES,DEFAULT_ECONOMY_STATE,normalizeEconomyState,publicProjection,validatePurchaseIntent,equipOwned,rememberRequest,hasRequest});
