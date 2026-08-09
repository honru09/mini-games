// 六款 Gameplay Upgrade 专项回归：观战、主题/皮肤、恢复、Match Stats 与实时玩法核心。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const UTILS = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '01-utils.js'), 'utf8');
const ASSETS = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '06-assets.js'), 'utf8');
const FRAMEWORK = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '03-game-framework.js'), 'utf8');
const TETRIS_RULES = fs.readFileSync(path.join(ROOT, 'shared', 'rules', 'tetris.js'), 'utf8');
const ONLINE_SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'online', '03-websocket.js'), 'utf8');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const failures = [];

function assert(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}
function context2d(){
  const gradient = { addColorStop(){} };
  return new Proxy({}, { get(target,key){
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (!(key in target)) target[key] = () => undefined;
    return target[key];
  }, set(target,key,value){ target[key]=value; return true; } });
}
function makeElement(tag){
  const classes = new Set();
  const node = {
    tagName:String(tag||'div').toUpperCase(),children:[],parent:null,style:{},dataset:{},attributes:{},textContent:'',disabled:false,
    clientWidth:560,clientHeight:560,width:0,height:0,_listeners:{},_html:'',
    appendChild(child){ if(child){child.parent=this;this.children.push(child);} return child; },
    remove(){ if(!this.parent)return;const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1); },
    setAttribute(key,value){this.attributes[key]=String(value);},removeAttribute(key){delete this.attributes[key];},
    addEventListener(type,fn){(this._listeners[type]=this._listeners[type]||[]).push(fn);},removeEventListener(){},
    dispatch(type,event){for(const fn of this._listeners[type]||[])fn(event||{});},
    getContext(){return context2d();},getBoundingClientRect(){return{left:0,top:0,width:520,height:520};},
    querySelector(selector){return query(this,selector,false);},querySelectorAll(selector){return query(this,selector,true);},
  };
  Object.defineProperty(node,'innerHTML',{get(){return this._html;},set(value){this._html=String(value);this.children=[];}});
  Object.defineProperty(node,'className',{get(){return[...classes].join(' ');},set(value){classes.clear();String(value||'').split(/\s+/).filter(Boolean).forEach(v=>classes.add(v));}});
  node.classList={add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x)),contains:v=>classes.has(v),toggle:(v,force)=>{const on=force===undefined?!classes.has(v):!!force;if(on)classes.add(v);else classes.delete(v);return on;}};
  return node;
}
function matches(node,selector){
  if(selector[0]==='.')return node.classList&&node.classList.contains(selector.slice(1));
  return String(node.tagName||'').toLowerCase()===selector.toLowerCase();
}
function query(root,selector,all){
  const found=[],queue=(root.children||[]).slice();
  while(queue.length){const node=queue.shift();if(matches(node,selector)){if(!all)return node;found.push(node);}queue.push(...(node.children||[]));}
  return all?found:null;
}
function findText(root,text){
  const queue=[root];while(queue.length){const node=queue.shift();if(String(node.textContent||'').includes(text))return node;queue.push(...(node.children||[]));}return null;
}
function harness(file,factory,count,settings){
  settings=settings||{};
  const area=makeElement('div'),extra=makeElement('div'),body=makeElement('body'),docListeners={};
  const document={body,documentElement:makeElement('html'),createElement:makeElement,getElementById:id=>id==='toast-wrap'?body:null,querySelectorAll:()=>[],
    addEventListener(type,fn){(docListeners[type]=docListeners[type]||[]).push(fn);},removeEventListener(){},
    dispatch(type,event){for(const fn of docListeners[type]||[])fn(event||{});}};
  const sandbox={console,JSON,Date,Map,Set,Array,Number,String,Boolean,Object,Math,document,navigator:{maxTouchPoints:0},
    location:{protocol:'http:',host:'localhost:8080'},setTimeout,clearTimeout,setInterval,clearInterval,AbortController,AbortSignal,
    fetch:async(_url,init)=>{const request=JSON.parse(String(init&&init.body||'{}'));return{ok:true,status:200,json:async()=>({choice:request.options&&request.options[0]})};},
    __area:area,__extra:extra};
  sandbox.window={devicePixelRatio:1,location:sandbox.location,matchMedia:query=>({matches:!!settings.reducedMotion&&query==='(prefers-reduced-motion: reduce)'})};
  const context=vm.createContext(sandbox);
  vm.runInContext(UTILS,context,{filename:'01-utils.js'});vm.runInContext(ASSETS,context,{filename:'06-assets.js'});
  vm.runInContext(`
    function t(key,...args){return String(key)+(args.length?'('+args.join(',')+')':'');} function renderPlayers(){} function setStatus(){}
    const account={authToken:'qa'}; const online={room:null,isHost:false};
    function resolveServer(){return '';} function aiPersonaMove(length,best){return Math.max(0,Math.min(length-1,best));}
    function aiSpeak(){} function shareGameLink(){} function openInvitePicker(){}
  `,context);
  if(file==='tetris.js')vm.runInContext(TETRIS_RULES,context,{filename:'shared/rules/tetris.js'});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'public','src','games',file),'utf8'),context,{filename:file});
  const results=[],sent=[];
  const opts={ai:new Set(),onEnd(value){results.push(value);},sendMove(value){sent.push(value);},sendRestart(){},isReplaying(){return false;},online:false,myIdx:0,isHost:true,destroyed:false,...(settings.opts||{})};
  context.__opts=opts;
  const game=vm.runInContext(`${factory}(__area,__extra,${count},__opts)`,context);
  return{area,extra,document,context,game,opts,results,sent};
}
function binaryWells(snapshot){return snapshot.wells.every(well=>well.every(row=>row.every(value=>value===0||value===1)));}

function run(){
  const frameworkContext=vm.createContext({console});
  vm.runInContext(FRAMEWORK,frameworkContext,{filename:'03-game-framework.js'});
  const frameworkGame=vm.runInContext(`
    registerGame('contract',()=>({
      snapshot(){return{source:'snapshot'};},serialize(){return{source:'serialize'};},
      deserialize(){return'deserialize';},onRestore(){return'onRestore';},
      setSpectators(value){this.spectator=!!value;return this.spectator;},setCosmetic(value){return value;},renderCosmetic(){return true;},
      startMatch(){return true;},reportGameResult(){return true;},getMatchStats(){return{spectator:this.spectator};},
      getMultiplayerRequirement(){return null;},setBoardTheme(value){return value;},setClockMode(value){return value;},getClockState(){return{mode:'casual'};},
      onLanguageChange(){this.languageRefreshes=(this.languageRefreshes||0)+1;return true;}
    }));
    createGameInstance('contract',{}, {},2,{});
  `,frameworkContext);
  const passthrough=['setSpectators','setCosmetic','renderCosmetic','startMatch','reportGameResult','getMatchStats','getMultiplayerRequirement','setBoardTheme','setClockMode','getClockState','onLanguageChange'];
  assert('插件框架：优先完整 serialize 且 deserialize 不重复恢复',frameworkGame.serialize().source==='serialize'&&frameworkGame.deserialize({})==='deserialize');
  assert('插件框架：透传 Gameplay 可选接口并保持原对象上下文',passthrough.every(key=>typeof frameworkGame[key]==='function')&&frameworkGame.setSpectators(true)===true&&frameworkGame.getMatchStats().spectator===true);
  assert('观众结算：玩家与名次均经本地化模板格式化',/t\('spectator_result_entry',t\('player_number',item\.slot\+1\),item\.rank\)/.test(ONLINE_SOURCE)&&!/'P'\+\(item\.slot\+1\)/.test(ONLINE_SOURCE));

  let h=harness('gomoku.js','gameGomoku',2);
  assert('五子棋：统一主题/皮肤/赛事/统计接口',typeof h.game.setBoardTheme==='function'&&typeof h.game.setCosmetic==='function'&&typeof h.game.startMatch==='function'&&typeof h.game.getMatchStats==='function');
  h.game.setCosmetic({default:'classic',players:{0:'glow'}});assert('五子棋：支持按玩家显示棋子皮肤',h.game.serialize().presentation.cosmetic.players[0]==='glow');
  h.game.setSpectators(true);const canvas=h.area.querySelector('canvas');canvas.dispatch('click',{clientX:260,clientY:260});
  assert('五子棋：Spectator 点击不落子',h.game.snapshot().hist.length===0);
  h.game.setSpectators(false);[[7,7],[0,0],[7,8],[0,1],[7,9],[0,2],[7,10],[0,3],[7,11]].forEach(move=>h.game.onMove(move));
  assert('五子棋：经典五连规则与 Match Stats 正确',h.game.snapshot().over&&h.game.getMatchStats().winner===0&&h.game.getMatchStats().moves===9);
  assert('五子棋：序列化可恢复',h.game.onRestore(h.game.serialize())===true);h.game.destroy();

  h=harness('ludo.js','gameLudo',4);
  assert('飞行棋：主题/基地棋子骰子 Cosmetic 与多人依赖接口',typeof h.game.setBoardTheme==='function'&&typeof h.game.setCosmetic==='function'&&h.game.getMultiplayerRequirement()===null);
  h.game.setCosmetic({players:{0:{base:'cyber',piece:'jet',dice:'cyber'}}});
  const cyberBase=h.area.querySelector('.ludo-base'),cyberDice=h.extra.querySelector('.dice3d-wrap');
  assert('飞行棋：基地/飞机/骰子支持按玩家映射',h.game.serialize().presentation.cosmetic.players[0].piece==='jet');
  assert('飞行棋：Cyber 基地与骰子产生可辨识 DOM 皮肤',cyberBase&&cyberBase.dataset.baseSkin==='cyber'&&cyberBase.querySelector('.ludo-base-emblem')&&cyberDice&&cyberDice.dataset.diceSkin==='cyber');
  assert('飞行棋：Classic/Cyber 两套 CSS 原型存在',TEMPLATE.includes('.ludo-base[data-base-skin="classic"]')&&TEMPLATE.includes('.ludo-base[data-base-skin="cyber"]')&&TEMPLATE.includes('.dice-btn[data-dice-skin="classic"]')&&TEMPLATE.includes('.dice-btn[data-dice-skin="cyber"]'));
  h.game.setSpectators(true);const diceButton=findText(h.extra,'掷骰');const beforeLudo=JSON.stringify(h.game.snapshot());if(diceButton)diceButton.dispatch('click');
  assert('飞行棋：Spectator 不能掷骰',JSON.stringify(h.game.snapshot())===beforeLudo);
  const ludoState=h.game.snapshot();ludoState.tokens[0]=[57,57,57,57];h.game.onRestore(ludoState);
  assert('飞行棋：Match Stats 包含完成数/撞击/起飞/名次',h.game.getMatchStats().piecesFinished[0]===4&&Array.isArray(h.game.getMatchStats().placement));h.game.destroy();

  h=harness('ludo.js','gameLudo',2,{reducedMotion:true});
  const reducedDice=h.extra.querySelector('.dice-btn');if(reducedDice)reducedDice.dispatch('click');
  assert('飞行棋：减少动态效果时骰子直接落定',h.game.snapshot().phase!=='rolling');h.game.destroy();

  h=harness('monopoly.js','gameMonopoly',3);
  assert('大富翁：主题/Token/观战/统计接口',typeof h.game.setBoardTheme==='function'&&typeof h.game.setCosmetic==='function'&&typeof h.game.getMatchStats==='function');
  h.game.setCosmetic({players:{0:'car'}});assert('大富翁：Character/Car 支持按玩家映射',h.game.serialize().presentation.cosmetic.players[0]==='car');
  h.game.setSpectators(true);const roll=findText(h.extra,'monopoly_roll'),settleSpectator=findText(h.extra,'monopoly_settle_early');const beforeMonopoly=JSON.stringify(h.game.snapshot());if(roll)roll.dispatch('click');if(settleSpectator)settleSpectator.dispatch('click');
  assert('大富翁：Spectator 不能掷骰',JSON.stringify(h.game.snapshot())===beforeMonopoly);
  const monopoly=h.game.snapshot();monopoly.players[0]={money:1200,pos:2,alive:true,props:[2],buildings:0};monopoly.players[1]={...monopoly.players[1],money:1400,props:[]};monopoly.players[2]={...monopoly.players[2],money:1300,props:[]};monopoly.owners[2]=0;h.game.onRestore(monopoly);
  const propertyOwnerBadge=h.area.querySelector('.property-owner-avatar');
  assert('大富翁：地产归属徽标使用本地化玩家编号',propertyOwnerBadge&&propertyOwnerBadge.textContent==='player_number(1)');
  const monopolyStats=h.game.getMatchStats();assert('大富翁：Net Worth/资产/名次按规则输出',monopolyStats[0].netWorth===1500&&monopolyStats[0].properties===1&&monopolyStats[0].placement===1);
  h.game.setSpectators(false);const settle=findText(h.extra,'monopoly_settle_early');if(settle)settle.dispatch('click');
  assert('大富翁：正式结算与奖励名次使用净资产',h.results.length===1&&h.results[0][0].slot===0&&h.results[0][0].rank===1,JSON.stringify(h.results));h.game.destroy();

  h=harness('monopoly.js','gameMonopoly',3,{reducedMotion:true});h.game.onMove({roll:[1,1]},0);
  assert('大富翁：减少动态效果时逐格移动走静态落点',h.game.snapshot().players[0].pos===2&&h.game.snapshot().phase==='buy',JSON.stringify(h.game.snapshot()));h.game.destroy();

  h=harness('xiangqi.js','gameXiangqi',2);
  assert('象棋：主题/棋子/棋钟/赛事接口',typeof h.game.setBoardTheme==='function'&&typeof h.game.setClockMode==='function'&&typeof h.game.startMatch==='function'&&typeof h.game.onLanguageChange==='function');
  const canvasBeforeLanguageChange=h.area.querySelector('.xiangqi-board');h.game.onLanguageChange();
  assert('象棋：语言刷新 hook 立即重绘 Canvas',h.area.querySelector('.xiangqi-board')!==canvasBeforeLanguageChange);
  h.game.setCosmetic({players:{0:'jade'}});assert('象棋：木质/Jade 支持按阵营映射',h.game.serialize().presentation.cosmetic.players[0]==='jade');
  h.game.setSpectators(true);const xqBoard=h.area.querySelector('.xiangqi-board');const beforeXq=JSON.stringify(h.game.snapshot());xqBoard.dispatch('click',{clientX:30,clientY:375});
  assert('象棋：Spectator 不能走棋',JSON.stringify(h.game.snapshot())===beforeXq);
  h.game.setSpectators(false);h.game.onMove({from:[6,0],to:[5,0]});h.game.setClockMode('rapid');
  assert('象棋：走子统计与本地棋钟状态正确',h.game.getMatchStats().moves===1&&h.game.getClockState().mode==='rapid'&&h.game.getClockState().authoritative===true);
  assert('象棋：序列化可恢复',h.game.onRestore(h.game.serialize())===true);h.game.destroy();

  h=harness('xiangqi.js','gameXiangqi',2,{reducedMotion:true});h.game.onMove({from:[6,0],to:[5,0]});
  assert('象棋：减少动态效果时不创建移动动画棋子',!h.area.querySelector('.xiangqi-motion-piece'));h.game.destroy();

  h=harness('tank.js','gameTank',3);
  assert('坦克：实时固定步长/多人/四季/统计接口',typeof h.game.fixedUpdate==='function'&&h.game.snapshot().tanks.length===3&&typeof h.game.setSeason==='function');
  assert('坦克：性能计数与对象硬上限接口',typeof h.game.getPerformanceStats==='function'&&h.game.getPerformanceStats().caps.projectiles===128&&h.game.getPerformanceStats().caps.particles===40);
  const stableTankBoard=h.area.querySelector('.tank-board'),stableTankControls=h.extra.querySelector('.tank-realtime-controls');h.game.onRestore(h.game.snapshot());
  assert('坦克闪屏回归：状态刷新保持棋盘与控制器节点 identity',h.area.querySelector('.tank-board')===stableTankBoard&&h.extra.querySelector('.tank-realtime-controls')===stableTankControls);
  let tankState=h.game.snapshot();tankState.grid=tankState.grid.map((row,r)=>row.map((_,c)=>r===0||r===12||c===0||c===14?3:0));
  tankState.tanks[0].x=2.5;tankState.tanks[0].y=2.5;tankState.tanks[0].d=1;tankState.tanks[0].invulnerableUntil=0;
  tankState.tanks[1].x=4.5;tankState.tanks[1].y=2.5;tankState.tanks[1].hp=1;tankState.tanks[1].invulnerableUntil=0;
  h.game.onRestore(tankState);h.game.onMove({act:'shoot'},0);for(let i=0;i<6;i++)h.game.fixedUpdate(.05);
  const tankStats=h.game.getMatchStats();assert('坦克：射击→命中→击毁统计链路',tankStats[0].shots===1&&tankStats[0].hits===1&&tankStats[0].kills===1&&tankStats[1].deaths===1,JSON.stringify(tankStats));
  h.game.setSpectators(true);const beforeTank=h.game.snapshot().tanks[0].x;h.document.dispatch('keydown',{key:'d',preventDefault(){}});h.game.fixedUpdate(.5);
  assert('坦克：Spectator 键盘不能控制',h.game.snapshot().tanks[0].x===beforeTank);h.game.finishMatch();assert('坦克：3 分钟赛制输出唯一名次',new Set(h.game.getMatchStats().map(item=>item.placement)).size===3);h.game.destroy();

  const tankMatch='qa-tank-relay';
  const tankGuest=harness('tank.js','gameTank',2,{opts:{online:true,myIdx:1,isHost:false,getMatchId:()=>tankMatch}});
  const tankHost=harness('tank.js','gameTank',2,{opts:{online:true,myIdx:0,isHost:true,getMatchId:()=>tankMatch}});
  const copy=value=>JSON.parse(JSON.stringify(value));
  tankGuest.opts.sendMove=payload=>tankHost.game.onMove(copy(payload),1);
  tankHost.opts.sendMove=payload=>tankGuest.game.onMove(copy(payload),0);
  const relayJoystick=tankGuest.extra.querySelector('.tank-joystick');
  relayJoystick.dispatch('pointerdown',{clientX:500,clientY:260,buttons:1});
  assert('坦克联机：真实摇杆输入带 seq 并映射可信玩家',tankHost.game.getRelayState().lastInputSeq[1]===1&&tankHost.game.snapshot().tanks[1].input.right===true);
  relayJoystick.dispatch('pointerup');
  tankHost.game.onMove({act:'input',protocol:'tank-host-relay-v1',matchId:tankMatch,seq:7,input:{right:true}},1);
  tankHost.game.onMove({act:'input',protocol:'tank-host-relay-v1',matchId:tankMatch,seq:7,input:{left:true}},1);
  assert('坦克联机：同一玩家重复 input seq 被忽略',tankHost.game.snapshot().tanks[1].input.right===true&&tankHost.game.snapshot().tanks[1].input.left===false);
  const drift=copy(tankGuest.game.snapshot());drift.tanks[1].x=7.5;tankGuest.game.onRestore(drift);
  tankHost.game.broadcastAuthoritativeState();
  assert('坦克联机：仅房主快照可校正非房主漂移',Math.abs(tankGuest.game.snapshot().tanks[1].x-tankHost.game.snapshot().tanks[1].x)<.001&&tankGuest.game.getRelayState().lastAuthoritySeq===1);
  tankHost.opts.isReplaying=()=>true;
  tankHost.game.onMove({act:'input',protocol:'tank-host-relay-v1',matchId:tankMatch,seq:11,input:{}},0);
  tankHost.game.onMove({act:'authoritative_state',protocol:'tank-host-relay-v1',matchId:tankMatch,authoritySeq:9,state:copy(tankHost.game.snapshot())},0);
  tankHost.opts.isReplaying=()=>false;
  assert('坦克联机：房主重连回放后输入与快照序列继续单调',tankHost.game.getRelayState().localInputSeq===11&&tankHost.game.getRelayState().authoritySeq===9);
  assert('坦克联机：非房主不能独立生成最终排名',tankGuest.game.finishMatch()===false&&tankGuest.results.length===0);
  tankHost.game.finishMatch();
  assert('坦克联机：房主最终排名驱动双方一致 claim',tankHost.results.length===1&&tankGuest.results.length===1&&JSON.stringify(tankHost.results[0])===JSON.stringify(tankGuest.results[0])&&tankGuest.game.getRelayState().resultCommitted===true);
  tankHost.game.destroy();tankGuest.game.destroy();

  h=harness('tetris.js','gameTetris',3);
  assert('俄罗斯方块：同步生存/观察/控制/统计接口',h.game.snapshot().mode==='simultaneous-survival'&&typeof h.game.setObservedPlayer==='function'&&typeof h.game.getTarget==='function');
  assert('俄罗斯方块：长局性能计数接口',typeof h.game.getPerformanceStats==='function'&&h.game.getPerformanceStats().boardCount===3);
  const stableTetrisLayout=h.area.querySelector('.tetris-battle-layout'),stableTetrisWell=h.area.querySelector('.main-board'),stableTetrisActions=h.extra.querySelector('.tetris-actions');h.game.onRestore(h.game.snapshot());h.game.setObservedPlayer(1);
  assert('俄罗斯方块闪屏回归：状态/观察目标刷新保持布局、主井与控制器节点 identity',h.area.querySelector('.tetris-battle-layout')===stableTetrisLayout&&h.area.querySelector('.main-board')===stableTetrisWell&&h.extra.querySelector('.tetris-actions')===stableTetrisActions);
  let tetris=h.game.snapshot();tetris.wells=tetris.wells.map(()=>Array.from({length:18},()=>Array(10).fill(0)));
  for(let r=14;r<18;r++)for(let c=1;c<10;c++)tetris.wells[0][r][c]=1;
  tetris.states=tetris.states.map((state,id)=>({...state,id,alive:true,incoming:[],score:0,lines:0,tetrisCount:0,garbageSent:0,garbageReceived:0,placement:0}));
  h.game.onRestore(tetris);h.game.queueGarbage(0,3,1,'cancel-test');h.game.onMove({piece:0,x:0,y:14,rot:1},0);
  const battle=h.game.snapshot();
  assert('俄罗斯方块：Perfect Clear Tetris 12 行先抵消 3 行 Incoming 再发送 9 行',battle.states[0].tetrisCount===1&&battle.states[0].perfectClears===1&&battle.states[0].incoming.length===0&&battle.states[0].garbageSent===9&&battle.states[1].incoming.reduce((sum,item)=>sum+item.lines,0)===9,JSON.stringify(battle.states.map(s=>({sent:s.garbageSent,incoming:s.incoming}))));
  assert('俄罗斯方块：Alive Ring 目标确定且 wells 保持 0/1',h.game.getTarget(0)===1&&h.game.getTarget(2)===0&&binaryWells(battle));
  h.game.setSpectators(true);const beforeTetris=JSON.stringify(h.game.snapshot().states[0].active);const left=findText(h.extra,'⬅');if(left)left.dispatch('click');
  assert('俄罗斯方块：Spectator 不能操作主井',JSON.stringify(h.game.snapshot().states[0].active)===beforeTetris);
  assert('俄罗斯方块：序列化可恢复',h.game.onRestore(h.game.serialize())===true);h.game.destroy();

  const tetrisMatch='qa-tetris-relay';
  const tetrisGuest=harness('tetris.js','gameTetris',2,{opts:{online:true,myIdx:1,isHost:false,getMatchId:()=>tetrisMatch}});
  const tetrisHost=harness('tetris.js','gameTetris',2,{opts:{online:true,myIdx:0,isHost:true,getMatchId:()=>tetrisMatch}});
  const guestMessages=[];
  tetrisGuest.opts.sendMove=payload=>{guestMessages.push(copy(payload));tetrisHost.game.onMove(copy(payload),1);};
  tetrisHost.opts.sendMove=payload=>tetrisGuest.game.onMove(copy(payload),0);
  const hostInitial=tetrisHost.game.snapshot(),guestInitial=tetrisGuest.game.snapshot();
  assert('俄罗斯方块联机：同 matchId/玩家生成相同确定性 7-Bag',hostInitial.bagSeed===tetrisMatch&&JSON.stringify(hostInitial.states.map(state=>state.queue))===JSON.stringify(guestInitial.states.map(state=>state.queue)));
  const remote=hostInitial.states[1],dropY=remote.active.kind===0?17:16;
  const remoteLock={act:'lock',matchId:tetrisMatch,seq:1,piece:remote.active.kind,x:remote.active.x,y:dropY,rot:0,placementSeq:1,garbage:0,target:-1,attackId:'a1-1'};
  tetrisHost.game.onMove(copy(remoteLock),1);tetrisHost.game.onMove(copy(remoteLock),1);
  assert('俄罗斯方块联机：重复 placement seq 不会重复落块',tetrisHost.game.snapshot().pieceCount===1&&tetrisHost.game.snapshot().states[1].placementSeq===1);
  const guestDrift=copy(tetrisGuest.game.snapshot());guestDrift.wells[1][10][0]=1;tetrisGuest.game.onRestore(guestDrift);
  const forgedSync=copy(tetrisHost.game.snapshot());forgedSync.wells[1][10][0]=0;tetrisGuest.game.onMove({act:'sync',state:forgedSync},1);
  assert('俄罗斯方块联机：非房主伪造全局同步被忽略',tetrisGuest.game.snapshot().wells[1][10][0]===1);
  tetrisHost.game.emitHostSync();
  assert('俄罗斯方块联机：房主全局同步校正漂移并确认序号',JSON.stringify(tetrisGuest.game.snapshot().wells)===JSON.stringify(tetrisHost.game.snapshot().wells)&&tetrisGuest.game.snapshot().relay.seenSeq[1]===1);
  assert('俄罗斯方块联机：非房主不能自行权威结束',tetrisGuest.game.finishMatch()===false&&tetrisGuest.results.length===0);
  const topOut=copy(tetrisGuest.game.snapshot());topOut.wells[1]=Array.from({length:18},()=>Array(10).fill(0));topOut.wells[1][0]=Array(10).fill(1);
  topOut.states[1]={...topOut.states[1],alive:true,koConfirmed:false,active:{kind:0,rotation:0,x:3,y:-1},incoming:[]};topOut.over=false;topOut.winner=-1;topOut.countdownRemainingMs=0;
  tetrisGuest.game.onRestore(topOut);const soft=findText(tetrisGuest.extra,'⬇');if(soft)soft.dispatch('click');
  const hostRanks=tetrisHost.results[0]||[],guestRanks=tetrisGuest.results[0]||[];
  assert('俄罗斯方块联机：本地 Top Out 广播一次 KO 且 seq 单调',guestMessages.filter(payload=>payload.act==='ko').length===1&&guestMessages.find(payload=>payload.act==='ko').seq===2);
  assert('俄罗斯方块联机：房主最终唯一名次驱动双方同一 claim',tetrisHost.results.length===1&&tetrisGuest.results.length===1&&JSON.stringify(hostRanks)===JSON.stringify(guestRanks)&&new Set(hostRanks.map(item=>item.rank)).size===2);
  tetrisHost.game.destroy();tetrisGuest.game.destroy();

  const authorityTankInputs=[],authorityTankMatch='qa-tank-authority-client';
  const authorityTank=harness('tank.js','gameTank',2,{opts:{online:true,myIdx:1,isHost:false,getMatchId:()=>authorityTankMatch,
    gameplayMeta:{protocol:'tank-authority-v1',serverTick:0,startedAt:Date.now(),endAt:Date.now()+180000,season:'spring'},sendTankInput:payload=>authorityTankInputs.push(copy(payload))}});
  authorityTank.document.dispatch('keydown',{key:'d',preventDefault(){}});
  assert('坦克 Authority Client：只发送 Input/Seq，不发送坐标',authorityTankInputs.length===1&&authorityTankInputs[0].input.right===true&&authorityTankInputs[0].seq===1&&!Object.prototype.hasOwnProperty.call(authorityTankInputs[0],'x'));
  const authorityTankBase=authorityTank.game.snapshot();
  const serverTankState={protocol:'tank-authority-v1',matchId:authorityTankMatch,serverTick:4,serverNow:Date.now(),startedAt:Date.now()-1000,endAt:Date.now()+179000,remainingMs:179000,season:'winter',
    players:authorityTankBase.tanks.map((tank,id)=>({...tank,x:id===1?8.5:tank.x,kills:id===1?2:0})),projectiles:[],destructibles:authorityTankBase.grid,ack:[0,1],finished:false,order:null};
  assert('坦克 Authority Client：Snapshot Reconciliation 生效',authorityTank.game.onAuthoritySnapshot(serverTankState)===true&&Math.abs(authorityTank.game.snapshot().tanks[1].x-authorityTankBase.tanks[1].x)>.1);
  authorityTank.game.onAuthorityResult({matchId:authorityTankMatch,order:[1,0],stats:serverTankState.players});
  assert('坦克 Authority Client：Server Final 不再提交客户端 claim',authorityTank.game.snapshot().winner===1&&authorityTank.results.length===0);authorityTank.game.destroy();

  const tetrisClaims=[],tetrisStates=[],authorityTetrisMatch='qa-tetris-authority-client',startAt=Date.now()-10;
  const authorityTetris=harness('tetris.js','gameTetris',2,{opts:{online:true,myIdx:0,isHost:true,getMatchId:()=>authorityTetrisMatch,
    gameplayMeta:{protocol:'tetris-battle-authority-v1',startAt,matchEndAt:startAt+300000,matchSeed:authorityTetrisMatch,rulesetVersion:'tetris-battle-v1'},
    sendTetrisLockClaim:payload=>tetrisClaims.push(copy(payload)),sendTetrisKOClaim(){},sendTetrisState:payload=>tetrisStates.push(copy(payload))}});
  const hardDrop=findText(authorityTetris.extra,'⤓');if(hardDrop)hardDrop.dispatch('click');
  assert('Tetris Authority Client：Lock Claim 含幂等攻击与规则字段',tetrisClaims.length===1&&tetrisClaims[0].seq===1&&tetrisClaims[0].placementSeq===1&&typeof tetrisClaims[0].attackId==='string'&&Number.isInteger(tetrisClaims[0].linesCleared));
  const remotePresentation=authorityTetris.game.snapshot().states[1];
  const presentationPayload={well:remotePresentation.well||Array.from({length:18},()=>Array(10).fill(0)),active:remotePresentation.active,queue:remotePresentation.queue.slice(0,4),bagIndex:remotePresentation.bagIndex,hold:remotePresentation.hold,canHold:remotePresentation.canHold,score:remotePresentation.score,lines:remotePresentation.lines,tetrisCount:remotePresentation.tetrisCount,placementSeq:remotePresentation.placementSeq};
  assert('Tetris Authority Client：合法展示状态按 matchId/seq 接收',authorityTetris.game.onTetrisState({matchId:authorityTetrisMatch,player:1,seq:1,updatedAt:Date.now(),state:presentationPayload})===true);
  const beforeMaliciousPresentation=JSON.stringify(authorityTetris.game.snapshot().states[1]);let maliciousPresentationSafe=true;
  try{
    maliciousPresentationSafe=authorityTetris.game.onTetrisState({matchId:authorityTetrisMatch,player:1,seq:2,state:{...presentationPayload,active:{kind:99,rotation:0,x:3,y:0}}})===false&&
      authorityTetris.game.onTetrisState({matchId:authorityTetrisMatch,player:1,seq:2,state:{...presentationPayload,queue:[99,1,2,3]}})===false&&
      authorityTetris.game.onTetrisState({matchId:'wrong-match',player:1,seq:2,state:presentationPayload})===false;
  }catch{maliciousPresentationSafe=false;}
  assert('Tetris Authority Client：恶意 active/queue/match 不崩溃且不污染展示状态',maliciousPresentationSafe&&JSON.stringify(authorityTetris.game.snapshot().states[1])===beforeMaliciousPresentation);
  const attackEvent={matchId:authorityTetrisMatch,revision:1,attackId:'remote_attack',source:1,target:0,amount:1,cancelled:0,sourceIncoming:[],targetIncoming:[{attackId:'remote_attack',source:1,target:0,amount:1,applyAt:Date.now()+650,delivered:false}]};
  authorityTetris.game.onBattleEvent(attackEvent);assert('Tetris Authority Client：展示 Server Alive Ring / Incoming',authorityTetris.game.snapshot().states[0].incoming[0].lines===1&&authorityTetris.extra.textContent!==null);
  authorityTetris.game.onGarbageDue({matchId:authorityTetrisMatch,revision:2,attackId:'remote_attack',source:1,target:0,amount:1,applyAt:Date.now()});
  assert('Tetris Authority Client：只在 Server Due 后落垃圾',authorityTetris.game.snapshot().wells[0][17].filter(Boolean).length===9&&tetrisStates.length>0);
  authorityTetris.game.onAuthorityResult({matchId:authorityTetrisMatch,order:[0,1]});
  assert('Tetris Authority Client：Server Placement 不再提交客户端 claim',authorityTetris.game.snapshot().winner===0&&authorityTetris.results.length===0);authorityTetris.game.destroy();

  const tetrisRuleMatch='qa-tetris-rule-v3-i18n',tetrisRuleStart=Date.now()-100;
  const tetrisRule=harness('tetris.js','gameTetris',2,{opts:{online:true,myIdx:0,isHost:true,getMatchId:()=>tetrisRuleMatch,
    gameplayMeta:{protocol:'tetris-rule-v3',startAt:tetrisRuleStart,matchEndAt:tetrisRuleStart+300000,matchSeed:tetrisRuleMatch,rulesetVersion:'tetris-rule-v3'},sendTetrisAction(){}}});
  const ruleApi=tetrisRule.context.TetrisRules,ruleStates=[0,1].map(player=>ruleApi.createInitialState({seed:tetrisRuleMatch,player}));
  ruleStates[1]=ruleApi.applyAction(ruleStates[1],{type:'garbage',lines:3,attackId:'qa-garbage'}).state;
  const ruleSnapshot={protocol:'tetris-rule-v3',matchId:tetrisRuleMatch,startAt:tetrisRuleStart,matchEndAt:tetrisRuleStart+300000,matchSeed:tetrisRuleMatch,rulesetVersion:'tetris-rule-v3',revision:1,serverNow:Date.now(),
    players:ruleStates.map((state,player)=>({player,seq:0,hash:'qa-'+player,state:JSON.parse(ruleApi.serialize(state)),incoming:[],alive:true,koTime:null,placement:0})),finished:false,order:null,inputCount:0};
  const ruleApplied=tetrisRule.game.onTetrisRuleState(ruleSnapshot),garbageEvent=findText(tetrisRule.area,'tetris_event_garbage(3)');
  assert('Tetris Rule v3：Garbage 事件保留 lines 并使用现有本地化 key',ruleApplied===true&&tetrisRule.game.snapshot().states[1].lastEvent==='+3 GARBAGE'&&!!garbageEvent);
  tetrisRule.game.destroy();

  const authorityClockMatch='qa-clock-client';
  const authorityXiangqi=harness('xiangqi.js','gameXiangqi',2,{opts:{online:true,myIdx:0,isHost:true,getMatchId:()=>authorityClockMatch,
    gameplayMeta:{protocol:'xiangqi-clock-v1',clock:{protocol:'xiangqi-clock-v1',matchId:authorityClockMatch,remainingMsByPlayer:[600000,600000],activePlayer:0,serverNow:Date.now(),turnStartedAt:Date.now()}}}});
  assert('象棋 Authority Client：消费 Server Clock Snapshot',authorityXiangqi.game.onClockState({protocol:'xiangqi-clock-v1',matchId:authorityClockMatch,remainingMsByPlayer:[590000,580000],activePlayer:1,serverNow:Date.now(),turnStartedAt:Date.now()})===true&&authorityXiangqi.game.getClockState().remaining[1]<=580000);
  authorityXiangqi.game.onClockState({protocol:'xiangqi-clock-v1',matchId:authorityClockMatch,remainingMsByPlayer:[590000,0],activePlayer:1,serverNow:Date.now(),turnStartedAt:Date.now(),finished:true,loser:1,winner:0});
  assert('象棋 Authority Client：Server Timeout 不提交客户端 claim',authorityXiangqi.game.snapshot().winner===0&&authorityXiangqi.results.length===0);authorityXiangqi.game.destroy();

  const authorityMonopolyMatch='qa-auction-client';
  const authorityMonopoly=harness('monopoly.js','gameMonopoly',3,{opts:{online:true,myIdx:0,isHost:true,getMatchId:()=>authorityMonopolyMatch,
    gameplayMeta:{protocol:'monopoly-auction-v1'},sendMonopolyAuctionOpen(){},sendMonopolyBid(){},sendMonopolyTurnEnd(){}}});
  const auctionBase={protocol:'monopoly-auction-v1',matchId:authorityMonopolyMatch,auction:{auctionId:'a1',propertyId:7,status:'open',startAt:Date.now(),endAt:Date.now()+5000,currentBid:200,currentBidder:1,eligiblePlayers:[0,1,2],revision:2},cash:[2000,1800,2000],ownership:{},serverNow:Date.now(),remainingMs:5000};
  assert('大富翁 Auction Client：展示服务端实时竞价',authorityMonopoly.game.onAuctionEvent('auction_open',auctionBase)===true&&findText(authorityMonopoly.extra,'monopoly_bid_button'));
  authorityMonopoly.game.onAuctionEvent('auction_closed',{...auctionBase,auction:{...auctionBase.auction,status:'closed'},ownership:{7:1},remainingMs:0});
  assert('大富翁 Auction Client：服务端关闭后同步产权',authorityMonopoly.game.snapshot().owners[7]===1&&authorityMonopoly.game.snapshot().players[1].props.includes(7));authorityMonopoly.game.destroy();

  if(failures.length){console.error('GAMEPLAY_UPGRADE_FAILED:',failures.join('、'));process.exitCode=1;}
  else console.log('GAMEPLAY_UPGRADE_ALL_PASS');
}

try{run();}catch(error){console.error('GAMEPLAY_UPGRADE_CRASH:',error&&error.stack||error);process.exitCode=1;}
