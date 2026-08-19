'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const root = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
let failed = false;
let assertions = 0;
function check(ok,message){
  assertions++;
  console.log((ok ? 'PASS ' : 'FAIL ') + message);
  if(!ok) failed=true;
}

class FakeClassList{
  constructor(node){this.node=node;}
  add(...names){const set=new Set(String(this.node.className||'').split(/\s+/).filter(Boolean));names.forEach(name=>set.add(name));this.node.className=[...set].join(' ');}
  contains(name){return String(this.node.className||'').split(/\s+/).includes(name);}
}
class FakeNode{
  constructor(tag,className,text){this.tagName=String(tag).toUpperCase();this.className=className||'';this.textContent=text==null?'':String(text);this.children=[];this.attributes={};this.listeners={};this.style={};this.parentNode=null;this.classList=new FakeClassList(this);}
  appendChild(child){child.parentNode=this;this.children.push(child);return child;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return Object.prototype.hasOwnProperty.call(this.attributes,name)?this.attributes[name]:null;}
  removeAttribute(name){delete this.attributes[name];}
  addEventListener(name,handler){this.listeners[name]=handler;}
}

const core=read('public/src/core/06-assets.js');
const start=core.indexOf('const GCOINS_RUNTIME_ASSET_ID');
const end=core.indexOf('/*\n * Test-admin presentation',start);
check(start>=0&&end>start,'currency presentation source slice exists');
const context={
  CURRENCY:'💵',CURRENCY_NAME:'G Coins',CURRENCY_ASSET_ID:'P-003',
  ASSET_ROOT:'assets/',
  el:(tag,cls,text)=>new FakeNode(tag,cls,text),
  t:key=>({currency_name:'G Coins',currency_aria:'G Coins test aria'}[key]||key),
  assetUrl:key=>'assets/'+key,
  runtimeAssetManifestPromise:null,
  ownerClearedDefaultOnFlagEnabled:()=>false
};
vm.createContext(context);
vm.runInContext(core.slice(start,end),context,{filename:'currency-presentation-slice.js'});

const regular=context.currencyAmountNode(12,{sizeClass:'sm'});
check(regular.getAttribute('role')==='img'&&regular.getAttribute('aria-label')==='12 G Coins','regular amount is one atomic accessible object');
check(regular.children.length===2&&regular.children[1].textContent==='12','regular amount shows one icon and numeric value');
check(regular.children[0].getAttribute('aria-hidden')==='true'&&regular.children[0].getAttribute('role')===null,'nested icon is decorative inside amount');
check(regular.children[1].getAttribute('aria-hidden')==='true','visible amount text does not duplicate the atomic accessible name');
check(regular.children[0].className.includes('sm'),'size class reaches the stable currency icon');

const signed=context.currencyAmountNode(3,{signed:true});
check(signed.getAttribute('aria-label')==='+3 G Coins'&&signed.children[1].textContent==='+3','signed positive amount stays consistent');
const invalid=context.currencyAmountNode('not-a-number');
check(invalid.getAttribute('aria-label')==='0 G Coins'&&invalid.children[1].textContent==='0','invalid amount fails closed to zero');
const admin=context.currencyAmountNode(0,{formattedText:'∞ G Coins'});
check(admin.getAttribute('aria-label')==='∞ G Coins'&&admin.children[1].textContent==='∞','test-admin private formatted amount removes duplicate visible brand suffix');
const rejectedBare=context.currencyAmountNode(7,{formattedText:'42'});
check(rejectedBare.getAttribute('aria-label')==='7 G Coins'&&rejectedBare.children[1].textContent==='7','bare formattedText is rejected and rebuilt from the authoritative value');
const savedRemoveAttribute=FakeNode.prototype.removeAttribute;
delete FakeNode.prototype.removeAttribute;
const minimalDomAmount=context.currencyAmountNode(2);
check(minimalDomAmount.getAttribute('aria-label')==='2 G Coins'&&minimalDomAmount.children[0].getAttribute('aria-hidden')==='true',
  'minimal DOM hosts without removeAttribute still render a safe atomic amount');
FakeNode.prototype.removeAttribute=savedRemoveAttribute;

const icon=regular.children[0],image=icon.children[0],fallback=icon.children[1];
check(typeof image.listeners.error==='function','asset failure listener remains installed');
image.listeners.error();
check(image.style.display==='none'&&icon.classList.contains('asset-failed')&&fallback.textContent==='💵','P-003 failure preserves legacy visual fallback without losing amount');

const consumers=[
  'public/src/core/02-app-shell.js',
  'public/src/core/04-social.js',
  'public/src/shop/05-profile.js',
  'public/src/shop/06-shop.js',
  'public/src/ui/07-roster.js',
  'public/src/online/03-websocket.js'
].map(read);
check(consumers.every(source=>!source.includes('currencyIcon(')),'all user-visible icon consumers use the composite amount seam');
check(consumers.every(source=>source.includes('currencyAmountNode')),'all target surfaces contain the composite amount seam');
check(!consumers.join('\n').includes("'G Coins ' +"),'target surfaces do not retain prefix-order fallback assembly');
const publicProfile=read('public/src/shop/05-profile.js');
check(publicProfile.includes(":currencyAmountText(p.coins || 0);"),'regular public Profile supplies a complete amount label instead of a bare number');

const template=read('public/index-template.html');
check(template.includes('.currency-amount{')&&template.includes('font-variant-numeric:tabular-nums'),'shared amount CSS freezes alignment and tabular numerals');
const locales=['zh-CN','en-US','uk-UA'].map(lang=>JSON.parse(read(`public/locales/${lang}.json`)));
check(locales.every(locale=>locale.currency_name==='G Coins'),'brand name remains identical in all locales');
check(locales.every(locale=>locale.shop_available_label&&locale.profile_balance_label&&locale.profile_summary_meta),'three locales cover the new system labels');
const currentEvidence=JSON.parse(read('requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-build-single-browser-verification-202608160305.json'));
const currentBuild=fs.readFileSync(path.join(root,'public','index.html'));
const currentBuildText=currentBuild.toString('utf8');
const currentBuildSha=crypto.createHash('sha256').update(currentBuild).digest('hex').toUpperCase();
check(currentEvidence.claim==='historical_as_of_build_single_browser_visible_matrix'&&currentEvidence.currency==='historical_as_of',
  'browser evidence uses the historical P4 full matrix as the G Coins source of truth after the zoom repair');
check(currentEvidence.build.sha256!==currentBuildSha&&currentEvidence.build.bytes!==currentBuild.length&&currentEvidence.build.characters!==currentBuildText.length,
  'historical P4 browser evidence is fail-closed and cannot masquerade as the post-repair build');
check(currentEvidence.gCoins.profileComposite.aria==='1 G Coins'&&currentEvidence.gCoins.leaderboardAtomicAmountsVisible&&currentEvidence.gCoins.roomLobbyPlayerAtomicAmountsVisible,
  'current P4 matrix covers atomic G Coins on Profile, leaderboard and room lobby players');
const historicalEvidence=JSON.parse(read('requirements/active/gcoins-presentation-unification-p1-20260815/evidence/current-build-single-browser-gcoins-202608151907.json'));
check(historicalEvidence.currency==='historical_as_of'&&historicalEvidence.claim==='historical_as_of_build_single_browser_gcoins_presentation_partial',
  'older narrow G Coins evidence is explicitly historical as-of its recorded build');

if(failed)process.exitCode=1;
else console.log(`G_COINS_PRESENTATION_ALL_PASS assertions=${assertions}`);
