'use strict';

// Game Stage is a presentation-only consumer.  This contract exercises the
// DOM shape and a small in-memory seat matrix without starting a server.
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.join(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const template=read('public/index-template.html');
const shell=read('public/src/core/02-app-shell.js');
const roster=read('public/src/ui/07-roster.js');
const onlineSource=read('public/src/online/03-websocket.js');
const server=read('server/index.js');
const {createRoomPresenceBoundary,createMemoryRoomPresenceAdapter}=require(path.join(ROOT,'server/boundaries/room-presence.js'));
// The stage renderer is followed by the independent P1 room-chat renderer.
// Keep this presentation-only contract scoped to the stage module so chat's
// requestAnimationFrame/history code cannot look like a Stage violation.
const stageSource=shell.slice(shell.indexOf('const GAME_STAGE_FALLBACK_COLORS'),shell.indexOf('const matchChatUi='));
let fails=0;
function check(name,value,detail){console.log((value?'PASS  ':'FAIL  ')+name+(value||!detail?'':' :: '+detail));if(!value)fails++;}

const requiredIds=['screen-game','game-stage-header','game-stage-seats','player-bar','game-stage-main','board-area','game-stage-command','status-bar','online-banner','game-extra'];
check('Game Stage 包含固定 Header、Seat Rail、Arena 与 Command Tray',requiredIds.every(id=>new RegExp('id="'+id+'"').test(template)));
check('Stage 不重复声明关键 DOM ID',requiredIds.every(id=>(template.match(new RegExp('id="'+id+'"','g'))||[]).length===1));
check('Arena-first、手机单列、安全区与 reduced-motion 样式存在',/\.game-stage\.arena-first/.test(template)&&/@media\(max-width:720px\)[\s\S]*game-stage-main/.test(template)&&/safe-area-inset-bottom/.test(template)&&/@media\(prefers-reduced-motion:reduce\)[\s\S]*game-stage-seat/.test(template));
const mobileStageCss=(template.match(/@media\(max-width:720px\)\{([\s\S]*?)\}\s*@media\(max-width:480px\)/)||[])[1]||'';
check('Tetris 手机舞台覆盖内联双列并保持主井居中、Next 可换行与对手自适应网格',/\.tetris-battle-layout\{[^}]*grid-template-columns:minmax\(0,1fr\)!important/.test(mobileStageCss)&&/\.tetris-player-main\{[^}]*width:100%[^}]*justify-items:center/.test(mobileStageCss)&&/\.tetris-next\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/.test(mobileStageCss)&&/\.tetris-opponents\{[^}]*repeat\(auto-fit,minmax\(96px,1fr\)\)/.test(mobileStageCss));
check('Tetris 手机迷你卡、紧凑状态与七项操作保留可触达布局',/\.tetris-mini-card\{[^}]*box-sizing:border-box[^}]*min-width:0/.test(mobileStageCss)&&/\.mini-board\{[^}]*margin-inline:auto/.test(mobileStageCss)&&/\.tetris-compact-status\{[^}]*grid-column:1\s*\/\s*-1/.test(mobileStageCss)&&/\.tetris-actions\{[^}]*width:100%/.test(mobileStageCss)&&/\.tetris-actions \.btn\{[^}]*min-width:44px[^}]*min-height:44px/.test(mobileStageCss)&&!/\.tetris-battle-layout\{[^}]*overflow:hidden/.test(mobileStageCss));
check('Stage 身份只读 roomInfo.seats，表达经专用 API 且不直写协议或常驻循环',/roomInfo&&Array\.isArray\(onlineState\.roomInfo\.seats\)/.test(stageSource)&&/online\.sendMatchExpression\(/.test(stageSource)&&!/online\.send\(|setInterval\(|requestAnimationFrame\(/.test(stageSource));
const publicSeatSource=server.slice(server.indexOf('function publicSeat('),server.indexOf('function roomHostPayload('));
const stageSeatBoundary=createRoomPresenceBoundary({adapter:createMemoryRoomPresenceAdapter(),now:()=>1700000000000});
const stageSeatResult=stageSeatBoundary.room({action:'seat',kind:'public',value:{seatId:0,type:'human',userId:'u1',nickname:'One',avatar:1,frame:2,effect:3,nameFx:4,lang:'en-US',ready:true,host:true,online:true,aiDifficulty:null,aiPersona:null,controllerUid:null}});
const stagePublicSeat=stageSeatResult.ok?stageSeatResult.seat:null;
check('Stage 读取的 Seat 字段与服务端 publicSeat 合同一致',/roomPresenceBoundary\.room\(\{\s*action:'seat',\s*kind:'public'/.test(publicSeatSource)&&stagePublicSeat&&['seatId','type','userId','nickname','avatar','frame','effect','nameFx','lang','ready','host','online','aiDifficulty','aiPersona','controllerUid'].every(key=>Object.prototype.hasOwnProperty.call(stagePublicSeat,key)));
check('Seat 使用稳定 key 与状态 data/class，昵称标记为原文',/dataset\.seatKey/.test(shell)&&/dataset\.seatCurrent/.test(shell)&&/dataset\.seatReady/.test(shell)&&/dataset\.seatOnline/.test(shell)&&/dataset\.seatBankrupt/.test(shell)&&/data-i18n-raw/.test(shell));
check('返回、房主结束与观战只读既有语义仍在',/function showHub\([\s\S]*?preserveOnlineGame/.test(roster)&&/!online\.isHost/.test(roster)&&/spectator:\s*online\.isSpectator/.test(roster));
check('showGame 与各游戏 player rail 刷新接入 Stage',/function showGame\([\s\S]*?renderGameStage/.test(roster)&&/function renderPlayers\([\s\S]*?renderGameStage/.test(roster));
const roomUpdateBranch=onlineSource.slice(onlineSource.indexOf("case 'room_update':"),onlineSource.indexOf("case 'spectating':"));
const peerStatusBranch=onlineSource.slice(onlineSource.indexOf("case 'peer_status':"),onlineSource.indexOf("case 'reconnect_expired':"));
const hostChangedBranch=onlineSource.slice(onlineSource.indexOf("case 'host_changed':"),onlineSource.indexOf("case 'player_reassigned':"));
const reassignedBranch=onlineSource.slice(onlineSource.indexOf("case 'player_reassigned':"),onlineSource.indexOf("case 'invite':"));
check('room_update 以权威 seats 刷新 Stage',/this\.roomInfo\s*=\s*msg\.payload[\s\S]*renderGameStage\(\)/.test(roomUpdateBranch));
check('peer_status 先合并在线状态再刷新 Stage',/seat\.online\s*=\s*!!p\.online[\s\S]*renderGameStage\(\)/.test(peerStatusBranch));
check('host_changed 先合并房主状态再刷新 Stage',/seat\.host\s*=\s*Number\(seat\.seatId\)[\s\S]*renderGameStage\(\)/.test(hostChangedBranch));
check('player_reassigned 等待随后权威 room_update',/this\.player\s*=\s*p\.player/.test(reassignedBranch)&&!/renderGameStage\(/.test(reassignedBranch));

const stageKeys=['stage_aria','stage_local_match','stage_ai_match','stage_online_match','stage_spectating','stage_seats_aria','stage_command_aria','stage_command','stage_you','stage_host','stage_ai','stage_ai_player','stage_current_turn','stage_bankrupt','stage_spectator_count'];
const locales=['zh-CN','en-US','uk-UA'].map(lang=>JSON.parse(read('public/locales/'+lang+'.json')));
check('Stage 文案完整进入三语同构词典',stageKeys.every(key=>locales.every(locale=>typeof locale[key]==='string'&&locale[key])));

function makeNode(tag,styleFallback){
  const classes=new Set();
  const style=styleFallback?{}:{setProperty(key,value){this[key]=value;}};
  const node={tagName:String(tag||'div').toUpperCase(),children:[],dataset:{},style,attributes:{},textContent:'',appendChild(child){if(child){child.parent=this;this.children.push(child);}return child;},setAttribute(key,value){this.attributes[key]=String(value);},getAttribute(key){return this.attributes[key]||null;}};
  Object.defineProperty(node,'className',{get(){return [...classes].join(' ');},set(value){classes.clear();String(value||'').split(/\s+/).filter(Boolean).forEach(item=>classes.add(item));}});
  Object.defineProperty(node,'innerHTML',{get(){return '';},set(_value){this.children.forEach(child=>{child.parent=null;});this.children=[];}});
  node.classList={add:(...items)=>items.forEach(item=>classes.add(item)),remove:(...items)=>items.forEach(item=>classes.delete(item)),contains:item=>classes.has(item),toggle:(item,force)=>{const on=force===undefined?!classes.has(item):!!force;if(on)classes.add(item);else classes.delete(item);return on;}};
  return node;
}
function runSeatMatrix(){
  let useStyleFallback=false;
  const ids={};
  ['screen-game','game-title','game-stage-mode','game-stage-spectators','player-bar'].forEach(id=>{ids[id]=makeNode('div');ids[id].id=id;});
  const sandbox={
    console,Number,String,Array,Object,Math,JSON,Set,Map,
    GAMES:{gomoku:{name:'Gomoku',nameKey:'game_gomoku'}},currentGameId:null,playerCount:2,aiMode:false,account:{uid:'u2',name:'Two',avatar:2},ghostGameStageState:{gameId:null,activeIdx:null,infos:null,bankrupts:null,colors:null},
    // player intentionally disagrees with the UID seat. The stage must use
    // the authoritative UID pair while it is available.
    online:{game:'gomoku',spectatorRoom:null,isSpectator:false,player:0,roomInfo:{spectatorCount:0,seats:[
      {seatId:0,type:'human',userId:'u1',nickname:'One',avatar:1,ready:true,host:true,online:true},
      {seatId:1,type:'human',userId:'u2',nickname:'Two',avatar:2,ready:true,host:false,online:true}
    ]}},
    t:(key,...args)=>key+(args.length?':'+args.join(','):''),
    $:id=>ids[id]||null,
    el:(tag,className,text)=>{const node=makeNode(tag,useStyleFallback);node.className=className||'';if(text!==undefined)node.textContent=String(text);return node;},
    avatarStageNode:(profile)=>{const node=makeNode('span');node.className='avatar';node.dataset.uid=profile.uid||'';return node;},
  };
  const source=shell.slice(shell.indexOf('const GAME_STAGE_FALLBACK_COLORS'),shell.indexOf('function routeFromHash()'));
  const context=vm.createContext(sandbox);vm.runInContext(source,context,{filename:'02-app-shell-stage.js'});
  context.renderGameStage({reset:true,gameId:'gomoku',activeIdx:null});
  const unknownTurn=ids['player-bar'].children.length===2&&!ids['player-bar'].children.some(node=>node.classList.contains('is-current'));
  context.renderGameStage({gameId:'gomoku',activeIdx:1});
  const onlineFirst=ids['player-bar'].children.slice();
  const onlineState=onlineFirst.length===2&&onlineFirst[0].dataset.seatKey==='0'&&onlineFirst[0].classList.contains('is-host')&&!onlineFirst[0].classList.contains('is-mine')&&onlineFirst[1].classList.contains('is-mine')&&onlineFirst[1].classList.contains('is-current')&&onlineFirst.every(node=>node.dataset.seatReady==='true');
  context.renderGameStage({activeIdx:0});
  const idempotent=ids['player-bar'].children.length===2&&ids['player-bar'].children[0].classList.contains('is-current')&&ids['player-bar'].children[1].dataset.seatKey==='1';
  const seatDetails=()=>{
    const found=[];
    const visit=node=>{if(!node)return;if(node.classList&&node.classList.contains('game-stage-seat-detail'))found.push(node);(node.children||[]).forEach(visit);};
    ids['player-bar'].children.forEach(visit);return found;
  };
  const stageText=()=>{
    const values=[];
    const visit=node=>{if(!node)return;if(node.textContent)values.push(String(node.textContent));(node.children||[]).forEach(visit);};
    ids['player-bar'].children.forEach(visit);return values.join(' ');
  };
  const invalidInfos=[null,false,{},'not-an-array',0];
  const invalidInfoSuppressed=invalidInfos.every(infos=>{
    context.renderGameStage({activeIdx:null,infos});
    return seatDetails().length===0&&!/(^|\s)false(\s|$)/.test(stageText());
  });
  context.renderGameStage({activeIdx:null,infos:['Waiting',0]});
  const validInfosPreserved=seatDetails().length===2&&seatDetails()[0].textContent==='Waiting'&&seatDetails()[1].textContent==='0';
  useStyleFallback=true;
  context.renderGameStage({activeIdx:null,colors:['#112233','#445566']});
  const styleFallback=ids['player-bar'].children.length===2&&ids['player-bar'].children[0].style['--stage-seat-color']==='#112233'&&!ids['player-bar'].children.some(node=>node.classList.contains('is-current'));
  sandbox.account.uid=null;sandbox.online.roomInfo.seats.forEach(seat=>{seat.userId=null;});sandbox.online.player=1;
  context.renderGameStage({activeIdx:null});
  const legacyIdentityFallback=ids['player-bar'].children.length===2&&!ids['player-bar'].children[0].classList.contains('is-mine')&&ids['player-bar'].children[1].classList.contains('is-mine');
  sandbox.account.uid='u2';sandbox.online.roomInfo.seats[1].userId=null;
  context.renderGameStage({activeIdx:null});
  const partialIdentityStaysNeutral=!ids['player-bar'].children.some(node=>node.classList.contains('is-mine'));
  sandbox.online.isSpectator=true;sandbox.online.spectatorRoom='r1';sandbox.online.roomInfo.spectatorCount=3;
  context.renderGameStage({activeIdx:null});
  const spectator=ids['player-bar'].children.length===3&&ids['player-bar'].children[2].dataset.seatType==='spectator'&&!ids['player-bar'].children.some(node=>node.classList.contains('is-mine'));
  sandbox.online.game=null;sandbox.online.isSpectator=false;sandbox.online.spectatorRoom=null;sandbox.online.roomInfo=null;sandbox.online.player=0;sandbox.playerCount=3;sandbox.aiMode=true;
  context.renderGameStage({reset:true,gameId:'gomoku',activeIdx:0});
  const local=ids['player-bar'].children.length===3&&ids['player-bar'].children[0].dataset.seatType==='human'&&ids['player-bar'].children[1].dataset.seatType==='ai';
  return {unknownTurn,onlineState,idempotent,invalidInfoSuppressed,validInfosPreserved,styleFallback,legacyIdentityFallback,partialIdentityStaysNeutral,spectator,local};
}
try{const matrix=runSeatMatrix();check('未知首回合不会猜测 0 号席位为当前回合',matrix.unknownTurn);check('真人 UID 优先于暂存的 player 索引',matrix.onlineState);check('重复 Stage 刷新不累积 Seat DOM',matrix.idempotent);check('infos 为 null/非数组时不渲染 detail 或字面量 false',matrix.invalidInfoSuppressed);check('有效 infos 字符串与数值 0 保持可见',matrix.validInfosPreserved);check('Style.setProperty 不可用时仍写入席位颜色且不误标当前回合',matrix.styleFallback);check('双方 UID 均缺失时才兼容 player 索引',matrix.legacyIdentityFallback);check('仅一侧 UID 缺失时不伪造本人席位',matrix.partialIdentityStaysNeutral);check('观战仅增加只读观众标识，不伪造玩家归属',matrix.spectator);check('本地/AI 对局按现有玩家数生成席位',matrix.local);}catch(error){check('Stage Seat Matrix 可执行',false,error&&error.stack||String(error));}

if(fails){console.error('GAME_STAGE_CONTRACT_FAILURES='+fails);process.exitCode=1;}else console.log('GAME_STAGE_CONTRACT_ALL_PASS');
