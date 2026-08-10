'use strict';

/* Home Identity P1: public Home pulse identity seam and formal-account privacy boundary. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const template=read('public/index-template.html'),shell=read('public/src/core/02-app-shell.js'),packageJson=JSON.parse(read('package.json'));
const locales=['zh-CN','en-US','uk-UA'].map(lang=>JSON.parse(read('public/locales/'+lang+'.json')));
let fail=0;
function check(name,ok,detail){console.log((ok?'PASS  ':'FAIL  ')+name);if(!ok){fail++;if(detail)console.error(detail);}}
function placeholderCount(value){return (String(value).match(/%s/g)||[]).length;}
function classList(){const set=new Set();return{add(...items){items.forEach(item=>set.add(item));},remove(...items){items.forEach(item=>set.delete(item));},toggle(item,force){const next=force===undefined?!set.has(item):!!force;next?set.add(item):set.delete(item);return next;},contains:item=>set.has(item)};}
function node(){return{children:[],textContent:'',onclick:null,className:'',classList:classList(),attributes:{},appendChild(child){this.children.push(child);return child;},setAttribute(key,value){this.attributes[key]=String(value);},removeAttribute(key){delete this.attributes[key];},set innerHTML(_value){this.children=[];this.textContent='';}};}
function nodeText(value){return String(value&&value.textContent||'')+(value&&Array.isArray(value.children)?value.children.map(nodeText).join(''):'');}

const pulseStart=template.indexOf('id="home-engagement-pulse"');
const pulseMarkup=pulseStart>=0?template.slice(pulseStart,template.indexOf('</article>',pulseStart)+10):'';
const keys=['home_pulse_identity_label','profile_level_short'];
check('identity strip is a semantic section inside the existing Home pulse with decorative avatar and raw nickname boundaries',
  pulseStart>=0&&
  /<section class="home-pulse-identity" id="home-pulse-identity" aria-labelledby="home-pulse-identity-label">/.test(pulseMarkup)&&
  /id="home-pulse-identity-label" data-i18n="home_pulse_identity_label"/.test(pulseMarkup)&&
  /id="home-pulse-identity-avatar"[^>]*aria-hidden="true"/.test(pulseMarkup)&&
  /id="home-pulse-identity-name"[^>]*data-i18n-raw/.test(pulseMarkup)&&
  /id="home-pulse-identity-level"/.test(pulseMarkup));
check('identity styling remains static, preserves the existing 44px controls, and uses a mobile single-column layout',
  /\.home-pulse-identity\{display:grid;grid-template-columns:56px minmax\(0,1fr\)/.test(template)&&
  /@media\(max-width:640px\)[\s\S]{0,12000}\.home-pulse-identity\{grid-template-columns:1fr\}/.test(template)&&
  !/\.home-pulse-identity[^\{]*\{[^}]*\b(?:animation|transition)\s*:/.test(template)&&
  /\.home-pulse-actions \.btn\{min-width:44px;min-height:44px/.test(template));
check('identity copy is non-empty and placeholder-isomorphic in all three locales',
  keys.every(key=>locales.every(locale=>typeof locale[key]==='string'&&locale[key].trim()))&&
  locales.slice(1).every(locale=>placeholderCount(locale.profile_level_short)===placeholderCount(locales[0].profile_level_short)));
check('identity contract is registered in pretest and the full test chain',
  String(packageJson.scripts&&packageJson.scripts.pretest||'').includes('qa/home-identity-p1-contract.js')&&
  String(packageJson.scripts&&packageJson.scripts.test||'').includes('qa/home-identity-p1-contract.js'));

const sourceStart=shell.indexOf('function homePulseDayKey('),sourceEnd=shell.indexOf('function chatRawNode',sourceStart);
const pulseSource=sourceStart>=0&&sourceEnd>sourceStart?shell.slice(sourceStart,sourceEnd):'';
check('identity renderer stays in the formal-account branch, reuses avatar/name seams and has no network, purchase, or profile-save mutation',
  /account&&!account\.ephemeral/.test(pulseSource)&&
  /avatarStageNode\(account,\s*56\)/.test(pulseSource)&&
  /nameFxNode\(account,/.test(pulseSource)&&
  /profile_level_short/.test(pulseSource)&&
  !/\b(?:online\.send|requestPurchase|saveAccount)\b/.test(pulseSource));

function dynamicIdentityMatrix(){
  if(!pulseSource)return{missing:true};
  const ids=['home-welcome-title','home-welcome-copy','home-live-status','btn-home-recommendation','btn-home-goal','home-goal-value','home-goal-copy','home-goal-meta','home-engagement-pulse','home-pulse-friends','home-pulse-collection','home-pulse-goal','btn-home-pulse-profile','btn-home-pulse-chat','btn-home-pulse-shop','btn-home-pulse-dismiss','home-pulse-identity','home-pulse-identity-avatar','home-pulse-identity-name','home-pulse-identity-level'];
  const nodes=Object.fromEntries(ids.map(id=>[id,node()]));
  let avatarCalls=0,nameCalls=0,ownedReads=0,route='',shopCalls=0;
  const formal={uid:'formal-a',name:'Raw <Player>',ephemeral:false,avatar:31,frame:7,effect:4,nameFx:2,played:{gomoku:1},level:7,streak:0,coins:999,xp:444,playerCharacter:{characterId:'forbidden'},gameCosmetics:{tank:'forbidden'}};
  Object.defineProperty(formal,'owned',{get(){ownedReads++;return{avatars:[31],frames:[7],effects:[4]};}});
  const catalog={deriveOwnedCollection(owned){return owned?{ownedCount:3,catalogCount:150}:null;}};
  const sandbox={
    account:formal,online:{connected:true,socialState:{friends:[]},send(){throw new Error('network mutation');}},lastServerLB:{online:1},aiMode:false,
    GAME_KEYS:['gomoku'],GAMES:{gomoku:{nameKey:'game_gomoku'}},CollectionRarityCatalog:catalog,$:id=>nodes[id]||null,
    t:(key,...args)=>key+(args.length?':'+args.join(','):''),el:(_tag,className,text)=>{const value=node();value.className=className||'';value.textContent=text===undefined?'':String(text);return value;},
    avatarStageNode(profile,size){avatarCalls++;const value=node();value.profile=profile;value.size=size;value.className='mini-avatar-stage effect-4';return value;},
    nameFxNode(profile,name){nameCalls++;const value=node();value.profile=profile;value.textContent=String(name);return value;},
    setAppRoute:value=>{route=value;},openShop:()=>{shopCalls++;},requestPurchase(){throw new Error('purchase mutation');},saveAccount(){throw new Error('profile mutation');},
    requestAnimationFrame:callback=>callback(),document:{querySelector:()=>null},localStorage:{getItem(){return null;},setItem(){}},Object,Array,Number,String,Date,encodeURIComponent,
  };
  vm.createContext(sandbox);vm.runInContext(pulseSource,sandbox,{filename:'02-app-shell.js:home-identity'});sandbox.renderGhostHome();
  const formalVisible=!nodes['home-engagement-pulse'].classList.contains('hidden')&&!nodes['home-pulse-identity'].classList.contains('hidden');
  const formalIdentity=avatarCalls===1&&nameCalls===1&&ownedReads===1&&nodes['home-pulse-identity-avatar'].children.length===1&&nodes['home-pulse-identity-avatar'].children[0].profile===formal&&nodes['home-pulse-identity-avatar'].children[0].size===56&&nodes['home-pulse-identity-avatar'].children[0].attributes['aria-hidden']==='true'&&nodes['home-pulse-identity-name'].attributes['data-i18n-raw']===''&&nodeText(nodes['home-pulse-identity-name'])==='Raw <Player>'&&nodes['home-pulse-identity-level'].textContent==='profile_level_short:7';
  const visibleIdentity=[nodeText(nodes['home-pulse-identity-avatar']),nodeText(nodes['home-pulse-identity-name']),nodeText(nodes['home-pulse-identity-level'])].join('|');
  const noPrivateOutput=!/999|444|forbidden|avatars|frames|effects|formal-a|coins|xp|price|owned/i.test(visibleIdentity);
  nodes['btn-home-pulse-profile'].onclick();const profileRoute=route==='profile';nodes['btn-home-pulse-chat'].onclick();const chatRoute=route==='chat';nodes['btn-home-pulse-shop'].onclick();const shopRoute=shopCalls===1;
  const guest={uid:'guest',name:'Guest',ephemeral:true,played:{},level:1,streak:0};Object.defineProperty(guest,'owned',{get(){throw new Error('guest owned must stay unread');}});
  const callsBeforeGuest={avatarCalls,nameCalls,ownedReads};sandbox.account=guest;sandbox.renderGhostHome();
  const guestSafe=nodes['home-engagement-pulse'].classList.contains('hidden')&&nodes['home-pulse-identity'].classList.contains('hidden')&&nodes['home-pulse-identity-avatar'].children.length===0&&nodes['home-pulse-identity-name'].textContent===''&&avatarCalls===callsBeforeGuest.avatarCalls&&nameCalls===callsBeforeGuest.nameCalls&&ownedReads===callsBeforeGuest.ownedReads;
  sandbox.account=null;sandbox.renderGhostHome();const signedOutSafe=nodes['home-engagement-pulse'].classList.contains('hidden')&&avatarCalls===callsBeforeGuest.avatarCalls&&nameCalls===callsBeforeGuest.nameCalls;
  sandbox.account={uid:'broken-catalog',name:'Fallback',ephemeral:false,avatar:0,frame:0,effect:0,level:2,streak:0,played:{},owned:{}};sandbox.CollectionRarityCatalog={deriveOwnedCollection(){throw new Error('catalog unavailable');}};let fallbackSafe=true;try{sandbox.renderGhostHome();}catch(error){fallbackSafe=false;}
  fallbackSafe=fallbackSafe&&!nodes['home-engagement-pulse'].classList.contains('hidden')&&nodeText(nodes['home-pulse-identity-name'])==='Fallback'&&nodes['home-pulse-identity-level'].textContent==='profile_level_short:2';
  return{formalVisible,formalIdentity,noPrivateOutput,profileRoute,chatRoute,shopRoute,guestSafe,signedOutSafe,fallbackSafe};
}
try{
  const matrix=dynamicIdentityMatrix();
  check('formal account renders only the equipped avatar seam, raw nickname, localized level, and existing pulse routes',matrix.formalVisible&&matrix.formalIdentity&&matrix.noPrivateOutput&&matrix.profileRoute&&matrix.chatRoute&&matrix.shopRoute);
  check('guest and signed-out rendering neither reads owned nor calls identity helpers and clears stale private DOM',matrix.guestSafe&&matrix.signedOutSafe);
  check('catalog failure safely preserves the read-only identity strip and existing Home pulse',matrix.fallbackSafe);
}catch(error){check('dynamic identity matrix executes',false,error&&error.stack||error);}

if(fail){console.error('HOME_IDENTITY_P1_CONTRACT_FAILURES='+fail);process.exitCode=1;}else console.log('HOME_IDENTITY_P1_CONTRACT_ALL_PASS');
