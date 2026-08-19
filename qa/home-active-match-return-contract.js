'use strict';

/* Home Active Match Return P0: same-instance Game Stage return only. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const template=read('public/index-template.html'),shell=read('public/src/core/02-app-shell.js'),roster=read('public/src/ui/07-roster.js'),pkg=JSON.parse(read('package.json'));
let failures=0;const check=(name,ok,detail)=>{console.log((ok?'PASS  ':'FAIL  ')+name);if(!ok){failures++;if(detail)console.error(detail);}};
const card=template.slice(template.indexOf('id="home-active-match-return"'),template.indexOf('</article>',template.indexOf('id="home-active-match-return"'))+10);
check('return card is localized, accessible and mobile-safe',/aria-labelledby="home-active-match-return-title"/.test(card)&&/id="btn-home-active-match-return"/.test(card)&&/data-i18n="home_active_match_return"/.test(card)&&/\.home-active-match-return\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/.test(template)&&/@media\(max-width:640px\)[\s\S]{0,12000}\.home-active-match-return\{grid-column:auto;grid-template-columns:1fr/.test(template));
check('copy never promises cross-device or durable recovery',!/cross-device|跨设备|永久|跨重启|persistent|durable/i.test(card));
const start=shell.indexOf('function homeActiveMatchState('),end=shell.indexOf('function renderGhostHome(',start),source=start>=0&&end>start?shell.slice(start,end):'';
check('state gate requires authenticated active non-spectator same-instance match',/state\.[\s\S]*connected[\s\S]*_authenticated/.test(source)&&/state\.isSpectator\|\|state\.spectatorRoom\|\|state\._replaying/.test(source)&&/state\.room/.test(source)&&/state\.matchId/.test(source)&&/currentGameId!==game/.test(source)&&/lastMatchResult/.test(source)&&/seat\.type!==['"]human['"]/.test(source));
check('return action is a showGame fast path with no mutation',/showGame\(latest\.game\)/.test(source)&&!/online\.send|startOnlineGame|requestPurchase|localStorage|\.join\(/.test(source));
check('lifecycle refreshes the card when Hub is shown on Home',/ghostAppRoute === ['"]home['"][\s\S]{0,180}renderGhostHome\(\)/.test(roster));
check('three locales and both test chains include the new stable keys',
  ['zh-CN','en-US','uk-UA'].every(lang=>{const l=JSON.parse(read('public/locales/'+lang+'.json'));return ['home_active_match_label','home_active_match_title','home_active_match_copy','home_active_match_return'].every(k=>typeof l[k]==='string'&&l[k].trim());})&&
  String(pkg.scripts&&pkg.scripts.pretest||'').includes('qa/home-active-match-return-contract.js')&&String(pkg.scripts&&pkg.scripts['test:home-active-match-return']||'').includes('qa/home-active-match-return-contract.js'));
function node(){const classes=new Set(['hidden']);return{classList:{toggle(k,v){if(v)classes.add(k);else classes.delete(k);},contains:k=>classes.has(k)},onclick:null};}
function dynamic(){
  const cardNode=node(),button=node(),calls=[];let validSeat={seatId:0,type:'human',userId:'u_abc123'};
  const sandbox={online:{connected:true,_authenticated:true,isSpectator:false,spectatorRoom:null,_replaying:false,room:'ROOM',game:'gomoku',matchId:'m1',player:0,lastMatchResult:null,roomInfo:{seats:[validSeat]}},account:{uid:'u_abc123'},currentGame:{},currentGameId:'gomoku',$:id=>id==='home-active-match-return'?cardNode:id==='btn-home-active-match-return'?button:null,showGame:id=>calls.push(id)};
  vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'02-app-shell.js:home-active-match-return'});
  sandbox.renderHomeActiveMatchReturn();const visible= !cardNode.classList.contains('hidden');button.onclick();const returned=calls.length===1&&calls[0]==='gomoku';
  sandbox.online._replaying=true;sandbox.renderHomeActiveMatchReturn();const replayHidden=cardNode.classList.contains('hidden');
  sandbox.online._replaying=false;sandbox.online.lastMatchResult={matchId:'m1'};sandbox.renderHomeActiveMatchReturn();const resultHidden=cardNode.classList.contains('hidden');
  sandbox.online.lastMatchResult=null;sandbox.online.roomInfo.seats=[{seatId:0,type:'ai',userId:'u_abc123'}];sandbox.renderHomeActiveMatchReturn();const aiHidden=cardNode.classList.contains('hidden');
  sandbox.online.roomInfo.seats=[validSeat];sandbox.renderHomeActiveMatchReturn();const stale=button.onclick;sandbox.online.matchId='m2';stale();const staleNoop=calls.length===1;
  return visible&&returned&&replayHidden&&resultHidden&&aiHidden&&staleNoop;
}
check('dynamic lifecycle matrix hides invalid states and makes stale clicks no-op',dynamic());
if(failures){console.error('HOME_ACTIVE_MATCH_RETURN_CONTRACT_FAILURES='+failures);process.exitCode=1;}else console.log('HOME_ACTIVE_MATCH_RETURN_CONTRACT_ALL_PASS');
