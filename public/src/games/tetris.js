/* ================= 俄罗斯方块 · Simultaneous Survival Battle ================= */
function gameTetris(area, extra, n, opts){
  opts = opts || {};
  const COLS = 10, ROWS = 18, playerCount = Math.max(2, Math.min(5, Number(n) || 2));
  const MATCH_MS = Math.max(15000, Number(opts.matchDurationMs) || 300000);
  const AUTH_PROTOCOL='tetris-battle-authority-v1',RULE_PROTOCOL='tetris-rule-v2';
  const fullRuleAuthority=!!(opts.online&&opts.gameplayMeta&&opts.gameplayMeta.protocol===RULE_PROTOCOL&&typeof opts.sendTetrisAction==='function'&&typeof TetrisRules!=='undefined');
  const authorityMode=!!(opts.online&&opts.gameplayMeta&&((opts.gameplayMeta.protocol===AUTH_PROTOCOL&&typeof opts.sendTetrisLockClaim==='function')||fullRuleAuthority));
  const SHAPES = [
    [[1,1,1,1]], [[1,1],[1,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]],
    [[0,1,1],[1,1,0]], [[1,1,0],[0,1,1]], [[0,1,0],[1,1,1]],
  ];
  const COLORS = ['#22d3ee','#facc15','#a78bfa','#fb923c','#34d399','#f87171','#e879f9'];
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none'; area.style.overscrollBehavior = 'contain';

  let states = [], wells = [], scores = [], over = false, winner = -1, cur = 0, pieceCount = 0;
  let startedAt = Date.now(), finishedAt = 0, remainingMs = MATCH_MS, destroyed = false, aiEpoch = 0;
  let observedPlayer = 0, controlled = opts.online ? Math.max(0, Number(opts.myIdx) || 0) : 0;
  const hostSlot = Number.isInteger(opts.hostIdx) ? opts.hostIdx : (opts.isHost ? controlled : 0);
  const RELAY_SYNC_MS = Math.max(500, Number(opts.relaySyncMs) || 1200);
  let spectator = !!opts.spectator, seq = 0, lastSeq = Array(playerCount).fill(0), presentationSeq = Array(playerCount).fill(0), ruleSeq = Array(playerCount).fill(0), countdownEndsAt = Date.now();
  let bagSeed = resolveMatchSeed(), garbageNonce = 0, relayRevision = 0, endReported = false, battleSeq=0, stateSeq=0, authorityRevision=0, matchEndAt=0;
  let seenAttacks = new Set();
  let cosmetic = { block:'classic', background:'classic', players:{}, ...(opts.cosmetic || {}) };
  let lastTickAt = Date.now(), lastRenderAt = 0;
  const performanceStats={samples:0,lastFrameMs:0,maxFrameMs:0,longFrames:0};
  let renderTree=null,lastPlayersSignature='',lastStatusText='',victoryShown=false;
  const miniViews=new Map();

  const PRESENTATION_KEYS = new Set(['well','active','queue','bagIndex','hold','canHold','score','lines','tetrisCount','placementSeq']);
  const TETRIS_STATE_KEYS = new Set(['matchId','player','seq','state','updatedAt']);
  const ACTIVE_KEYS = new Set(['kind','rotation','x','y']);
  const RELAY_ACTIVE_KEYS = new Set(['act','matchId','seq','piece','x','y','rot','hold','canHold','queue','bagIndex']);
  const ATTACK_ID_RE = /^[A-Za-z0-9:_-]{3,100}$/;
  function plainRecord(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  function onlyKeys(value,allowed){return plainRecord(value)&&Object.keys(value).every(key=>allowed.has(key));}
  function safeInt(value,min,max){return Number.isSafeInteger(value)&&value>=min&&value<=max;}
  function validKind(value){return safeInt(value,0,6);}
  function validCoord(value,min,max){return safeInt(value,min,max);}
  function validActive(value){
    if(value===null)return true;
    return onlyKeys(value,ACTIVE_KEYS)&&validKind(value.kind)&&safeInt(value.rotation,0,3)&&validCoord(value.x,-3,9)&&validCoord(value.y,-4,17);
  }
  function validQueue(value){return Array.isArray(value)&&value.length>=4&&value.length<=14&&value.every(validKind);}
  function validHold(value){return value===null||validKind(value);}
  function validWell(value){return Array.isArray(value)&&value.length===ROWS&&value.every(row=>Array.isArray(row)&&row.length===COLS&&row.every(cell=>cell===0||cell===1));}
  function resolveMatchId(){
    if(typeof opts.getMatchId==='function'){const current=opts.getMatchId();if(typeof current==='string'&&current)return current;}
    if(typeof opts.matchId==='string'&&opts.matchId)return opts.matchId;
    if(typeof online!=='undefined'&&online&&typeof online.matchId==='string'&&online.matchId)return online.matchId;
    return '';
  }
  function expectedMatchId(){return resolveMatchId()||resolveMatchSeed();}
  function validMatchId(value){return typeof value==='string'&&value.length>0&&value===expectedMatchId();}

  function removeRenderNode(node){if(node&&typeof node.remove==='function')node.remove();}
  function removeVictoryOverlay(){const overlay=area.querySelector&&area.querySelector('.victory-overlay');if(overlay)removeRenderNode(overlay);victoryShown=false;}

  function emptyWell(){ return Array.from({length:ROWS}, () => Array(COLS).fill(0)); }
  function rotateCW(matrix){
    const rows=matrix.length, cols=matrix[0].length, out=Array.from({length:cols},()=>Array(rows).fill(0));
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) out[c][rows-1-r]=matrix[r][c];
    return out;
  }
  function rotateCCW(matrix){ return rotateCW(rotateCW(rotateCW(matrix))); }
  function shapeAt(kind, rotation){ let shape=SHAPES[kind]; for (let i=0;i<((rotation%4)+4)%4;i++) shape=rotateCW(shape); return shape; }
  function cloneWell(well){ return well.map(row=>row.slice()); }
  function collide(well, shape, x, y){
    for (let r=0;r<shape.length;r++) for (let c=0;c<shape[r].length;c++){
      if (!shape[r][c]) continue;
      const rr=y+r, cc=x+c;
      if (cc<0 || cc>=COLS || rr>=ROWS || (rr>=0 && well[rr][cc])) return true;
    }
    return false;
  }
  function lockInto(well, shape, x, y){
    const next=cloneWell(well);
    for (let r=0;r<shape.length;r++) for (let c=0;c<shape[r].length;c++) if (shape[r][c]){
      const rr=y+r, cc=x+c;
      if (rr<0 || cc<0 || cc>=COLS || rr>=ROWS) return {well:next,cleared:-1};
      next[rr][cc]=1;
    }
    let cleared=0;
    for (let r=ROWS-1;r>=0;r--) if (next[r].every(Boolean)){
      next.splice(r,1); next.unshift(Array(COLS).fill(0)); cleared++; r++;
    }
    return {well:next,cleared};
  }
  function boardHeight(well){
    for (let r=0;r<ROWS;r++) if (well[r].some(Boolean)) return ROWS-r;
    return 0;
  }
  function resolveMatchSeed(){
    if(opts.gameplayMeta&&opts.gameplayMeta.matchSeed)return String(opts.gameplayMeta.matchSeed);
    if (typeof opts.getMatchId === 'function'){
      const current=opts.getMatchId();if(current)return String(current);
    }
    if(opts.matchId)return String(opts.matchId);
    if(typeof online!=='undefined'&&online&&online.matchId)return String(online.matchId);
    return '';
  }
  function hashSeed(value){
    let hash=2166136261>>>0;
    for(let i=0;i<String(value).length;i++){hash^=String(value).charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}
    return hash||0x9e3779b9;
  }
  function seededRandom(value){
    let state=hashSeed(value);
    return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
  }
  function makeBag(player,bagIndex){
    const bag=[0,1,2,3,4,5,6];
    const random=opts.online&&bagSeed?seededRandom(bagSeed+'|p'+player+'|bag'+bagIndex):Math.random;
    for (let i=bag.length-1;i>0;i--){ const j=Math.floor(random()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
    return bag;
  }
  function appendBag(state){state.queue.push(...makeBag(state.id,state.bagIndex++));}
  function ensureQueue(state){while(state.queue.length<5)appendBag(state);}
  function nextKind(state){ ensureQueue(state); const kind=state.queue.shift(); ensureQueue(state); return kind; }
  function createState(id){
    const state={
      id,well:emptyWell(),active:null,queue:[],bagIndex:0,hold:null,canHold:true,score:0,lines:0,tetrisCount:0,placementSeq:0,
      garbageSent:0,garbageReceived:0,incoming:[],alive:true,koTime:null,koConfirmed:false,placement:0,fallMs:0,
      lastEvent:'READY',eventAt:Date.now(),
    };
    ensureQueue(state); return state;
  }
  function spawn(state, forcedKind){
    if (!state || !state.alive) return false;
    const kind=Number.isInteger(forcedKind)?forcedKind:nextKind(state), shape=shapeAt(kind,0);
    const active={kind,rotation:0,x:Math.floor((COLS-shape[0].length)/2),y:-Math.max(1,shape.length-1)};
    if (collide(state.well,shape,active.x,active.y)){ ko(state.id,'TOP OUT'); return false; }
    state.active=active; state.canHold=true; return true;
  }
  function resetLocal(){
    bagSeed=resolveMatchSeed();
    aiEpoch++; aiPending.clear(); aiTimers.forEach(timer=>clearTimeout(timer)); aiTimers.clear();removeVictoryOverlay();lastPlayersSignature='';lastStatusText='';
    states=Array.from({length:playerCount},(_,i)=>createState(i)); wells=states.map(state=>state.well); scores=states.map(state=>state.score);
    over=false; winner=-1; cur=controlled; pieceCount=0; startedAt=authorityMode?Number(opts.gameplayMeta.startAt)||Date.now():Date.now(); finishedAt=0; remainingMs=MATCH_MS;
    countdownEndsAt=authorityMode?startedAt:startedAt+(opts.online?3000:0);matchEndAt=authorityMode?Number(opts.gameplayMeta.matchEndAt)||startedAt+MATCH_MS:startedAt+MATCH_MS;lastTickAt=Date.now(); seq=0;battleSeq=0;stateSeq=0;authorityRevision=0; lastSeq=Array(playerCount).fill(0); presentationSeq=Array(playerCount).fill(0); ruleSeq=Array(playerCount).fill(0); destroyed=false;
    garbageNonce=0;relayRevision=0;endReported=false;seenAttacks=new Set();
    states.forEach(spawn); observedPlayer=spectator?0:controlled; render(); updateStatus();
    if(opts.ai)opts.ai.forEach(pi=>queueAI(pi,2500));
  }
  function sendRelay(payload){
    if(authorityMode){sendPresentation();return ++seq;}
    if(!opts.online||typeof opts.sendMove!=='function')return 0;
    const next=++seq;lastSeq[controlled]=Math.max(lastSeq[controlled]||0,next);
    opts.sendMove({...payload,matchId:resolveMatchId(),seq:next});return next;
  }
  function presentationState(){
    const state=states[controlled];return state?{well:state.well.map(row=>row.slice()),active:state.active?{...state.active}:null,queue:state.queue.slice(0,14),bagIndex:state.bagIndex,hold:state.hold,canHold:state.canHold,score:state.score,lines:state.lines,tetrisCount:state.tetrisCount,placementSeq:state.placementSeq}:null;
  }
  function sendPresentation(){if(!authorityMode||fullRuleAuthority||typeof opts.sendTetrisState!=='function')return false;const state=presentationState();if(!state)return false;opts.sendTetrisState({matchId:resolveMatchId(),seq:++stateSeq,state});return true;}
  function sendRuleAction(type){if(!fullRuleAuthority||typeof opts.sendTetrisAction!=='function')return false;opts.sendTetrisAction({matchId:resolveMatchId(),seq:++battleSeq,action:{type}});return true;}
  function syncArrays(){ wells=states.map(state=>state.well); scores=states.map(state=>state.score); }
  function canControl(){ return !destroyed && !spectator && !over && Date.now()>=countdownEndsAt && states[controlled] && states[controlled].alive && !(opts.isReplaying&&opts.isReplaying()); }
  function targetFor(from){
    for (let step=1;step<playerCount;step++){ const candidate=(from+step)%playerCount; if (states[candidate]&&states[candidate].alive) return candidate; }
    return -1;
  }
  function incomingTotal(state){ return state.incoming.reduce((sum,item)=>sum+item.lines,0); }
  function cancelIncoming(state, attack){
    let remaining=attack;
    for (let i=0;i<state.incoming.length && remaining>0;i++){
      const used=Math.min(remaining,state.incoming[i].lines); state.incoming[i].lines-=used; remaining-=used;
    }
    state.incoming=state.incoming.filter(item=>item.lines>0); return remaining;
  }
  function queueGarbage(target, lines, from, id){
    const state=states[target]; if (!state || !state.alive || lines<=0) return;
    const attackId=String(id||('g'+controlled+'-'+(++garbageNonce)));
    if(seenAttacks.has(attackId))return;seenAttacks.add(attackId);
    state.incoming.push({id:attackId,from,lines,applyAt:Date.now()+650});
    state.lastEvent='⚠ +'+incomingTotal(state); state.eventAt=Date.now(); render();
  }
  function applyGarbage(state,item){
    for (let line=0;line<item.lines;line++){
      if (state.well[0].some(Boolean)){ ko(state.id,'GARBAGE KO'); return; }
      const hole=Math.abs(String(item.id).split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0)+line)%COLS;
      state.well.shift(); state.well.push(Array.from({length:COLS},(_,c)=>c===hole?0:1)); state.garbageReceived++;
    }
    state.lastEvent='+'+item.lines+' GARBAGE'; state.eventAt=Date.now();
  }
  function resolveDueGarbage(state,now){
    const due=state.incoming.filter(item=>item.applyAt<=now), pending=state.incoming.filter(item=>item.applyAt>now);
    state.incoming=pending; due.forEach(item=>{ if (state.alive) applyGarbage(state,item); });
  }
  function attackFor(lines){ return [0,0,1,2,4][Math.max(0,Math.min(4,lines))]; }
  function applyPlacement(pi,data,deriveAttack,emit){
    const state=states[pi]; if (!state || !state.alive) return false;
    const kind=Number(data.piece),rotation=Number(data.rot||0),x=Number(data.x),y=Number(data.y);
    if (![kind,rotation,x,y].every(Number.isInteger)||kind<0||kind>=SHAPES.length||rotation<0||rotation>3) return false;
    const incomingPlacementSeq=Number(data.placementSeq);
    if(opts.online&&data.act==='lock'){
      if(state.active&&state.active.kind!==kind)return false;
      if(Number.isInteger(incomingPlacementSeq)&&(incomingPlacementSeq<=state.placementSeq||incomingPlacementSeq!==state.placementSeq+1))return false;
    }
    const shape=shapeAt(kind,rotation);
    if (collide(state.well,shape,x,y)||!collide(state.well,shape,x,y+1)) return false;
    const result=lockInto(state.well,shape,x,y);
    if (result.cleared<0){ ko(pi,'TOP OUT'); return false; }
    state.well=result.well; state.active=null; state.lines+=result.cleared;
    state.placementSeq=Number.isInteger(incomingPlacementSeq)?incomingPlacementSeq:state.placementSeq+1;
    const points=[0,100,300,500,800][result.cleared]||0; state.score+=points; if (result.cleared===4) state.tetrisCount++;
    state.lastEvent=result.cleared===4?'TETRIS!':result.cleared?('CLEAR ×'+result.cleared):'LOCK'; state.eventAt=Date.now();
    pieceCount++;
    let sent=0,target=-1,cancelled=0,attackId='a'+pi+'-'+state.placementSeq+'-'+String(resolveMatchSeed()).slice(-12);
    if (deriveAttack){
      const raw=attackFor(result.cleared), before=raw;
      if(authorityMode){sent=raw;}
      else{sent=cancelIncoming(state,raw);cancelled=before-sent;if(sent>0){target=targetFor(pi);if(target>=0){state.garbageSent+=sent;queueGarbage(target,sent,pi,attackId);}}}
    } else if (Number.isInteger(Number(data.garbage))&&Number(data.garbage)>0&&Number(data.garbage)<=4&&Number.isInteger(data.target)&&data.target>=0&&data.target<states.length){
      sent=Number(data.garbage);target=Number(data.target);attackId=String(data.attackId||attackId);state.garbageSent+=sent;queueGarbage(target,sent,pi,attackId);
    }
    if (emit && opts.online){
      if(authorityMode&&!fullRuleAuthority){opts.sendTetrisLockClaim({seq:++battleSeq,placementSeq:state.placementSeq,attackId,linesCleared:result.cleared,attack:attackFor(result.cleared),score:state.score,lines:state.lines,boardHeight:boardHeight(state.well),piece:kind,x,y,rot:rotation});sendPresentation();}
      else sendRelay({act:'lock',piece:kind,x,y,rot:rotation,placementSeq:state.placementSeq,garbage:sent,target,attackId});
    }
    if (emit&&opts.onProgress) opts.onProgress({act:'lock',piece:kind,x,y,rot:rotation,lines:result.cleared,garbageSent:sent,garbageCancelled:cancelled});
    syncArrays(); spawn(state); render(); return true;
  }
  function lockActive(pi,emit){
    const state=states[pi]; if (!state||!state.active) return false;
    const active={...state.active}; return applyPlacement(pi,{piece:active.kind,x:active.x,y:active.y,rot:active.rotation},true,emit);
  }
  function moveActive(dx){
    if (!canControl()) return false; const state=states[controlled],active=state.active|| (spawn(state)&&state.active);
    if (!active) return false; const shape=shapeAt(active.kind,active.rotation);
    if (!collide(state.well,shape,active.x+dx,active.y)){ active.x+=dx; if(fullRuleAuthority)sendRuleAction(dx<0?'left':'right');else emitActive(); render(); return true; } return false;
  }
  function rotateActive(direction){
    if (!canControl()) return false; const state=states[controlled],active=state.active|| (spawn(state)&&state.active);
    if (!active) return false; const next=(active.rotation+(direction>0?1:3))%4,shape=shapeAt(active.kind,next);
    for (const kick of [0,-1,1,-2,2]) if (!collide(state.well,shape,active.x+kick,active.y)){ active.rotation=next; active.x+=kick; if(fullRuleAuthority)sendRuleAction(direction>0?'rotate_cw':'rotate_ccw');else emitActive(); render(); return true; }
    return false;
  }
  function softDrop(){
    if (!canControl()) return false; const state=states[controlled],active=state.active; if (!active) return false;
    const shape=shapeAt(active.kind,active.rotation);
    if (!collide(state.well,shape,active.x,active.y+1)){ active.y++; if(fullRuleAuthority)sendRuleAction('soft_drop');else emitActive(); render(); return true; }
    const locked=lockActive(controlled,true);if(locked&&fullRuleAuthority)sendRuleAction('soft_drop');return locked;
  }
  function hardDrop(){
    if (!canControl()) return false; const state=states[controlled],active=state.active; if (!active) return false;
    const shape=shapeAt(active.kind,active.rotation); let distance=0;
    while (!collide(state.well,shape,active.x,active.y+1)){ active.y++; distance++; }
    const locked=lockActive(controlled,true);if(locked&&fullRuleAuthority)sendRuleAction('hard_drop');return locked;
  }
  function hold(){
    if (!canControl()) return false; const state=states[controlled],active=state.active;
    if (!active||!state.canHold) return false; const previous=state.hold; state.hold=active.kind; state.active=null;
    if (!spawn(state,previous===null?undefined:previous)) return false; state.canHold=false; if(fullRuleAuthority)sendRuleAction('hold');else emitActive(); render(); return true;
  }
  function emitActive(){
    if (!opts.online||!states[controlled]||!states[controlled].active) return;
    const state=states[controlled],a=state.active;
    sendRelay({act:'active',piece:a.kind,x:a.x,y:a.y,rot:a.rotation,hold:state.hold,canHold:state.canHold,queue:state.queue.slice(0,14),bagIndex:state.bagIndex});
  }
  function ko(pi,reason,relayMeta){
    const state=states[pi];if(!state)return;
    const meta=relayMeta||{};
    if(!state.alive){
      if(meta.confirmed)state.koConfirmed=true;
      if(opts.online&&opts.isHost&&states.filter(item=>item.alive).length<=1&&states.filter(item=>!item.alive).every(item=>item.koConfirmed))finishMatch();
      return;
    }
    state.alive=false;state.koTime=Number(meta.koTime)||Date.now();state.active=null;state.incoming=[];state.lastEvent='KO';state.eventAt=Date.now();
    state.koConfirmed=!opts.online||pi===controlled||!!meta.confirmed;
    const alive=states.filter(item=>item.alive); state.placement=alive.length+1;
    playFeedback('capture'); toast(t('tetris_ko_toast',pi+1,localizeTetrisReason(reason)));
    if (pi===controlled) spectator=true;
    if(opts.online&&pi===controlled&&meta.emit!==false){if(authorityMode&&typeof opts.sendTetrisKOClaim==='function')opts.sendTetrisKOClaim({seq:++battleSeq,reason:String(reason||'TOP OUT').slice(0,40),boardHeight:boardHeight(state.well)});else sendRelay({act:'ko',reason:String(reason||'TOP OUT').slice(0,40),koTime:state.koTime});}
    if(alive.length<=1){
      if(alive[0])alive[0].placement=1;
      if(!opts.online||opts.isHost&&states.filter(item=>!item.alive).every(item=>item.koConfirmed))finishMatch();
    }
  }
  function finalOrder(){
    return states.map(state=>state.id).sort((a,b)=>{
      const A=states[a],B=states[b];
      if (A.alive!==B.alive) return A.alive?-1:1;
      if (A.alive) return boardHeight(A.well)-boardHeight(B.well)||B.lines-A.lines||B.score-A.score||a-b;
      return (B.koTime||0)-(A.koTime||0)||a-b;
    });
  }
  function validFinalOrder(order){return Array.isArray(order)&&order.length===playerCount&&new Set(order).size===playerCount&&order.every(id=>Number.isInteger(id)&&id>=0&&id<playerCount);}
  function commitFinal(order,fromRelay,suppressReport){
    if(!validFinalOrder(order))return false;
    over=true;finishedAt=Date.now();remainingMs=Math.max(0,MATCH_MS-(finishedAt-startedAt));winner=order[0];
    order.forEach((id,index)=>states[id].placement=index+1);
    if(opts.online&&opts.isHost&&!fromRelay)sendRelay({act:'final',order:order.slice(),state:relaySnapshot(seq+1),protocol:'casual-host-relay-v1'});
    if(!suppressReport&&!endReported&&opts.onEnd){endReported=true;opts.onEnd(order.map((id,index)=>({slot:id,rank:index+1,coins:index===0?1:0})));}
    render();setStatus(t('tetris_last_survivor',winner+1),true);return true;
  }
  function finishMatch(){
    if(over||authorityMode||opts.online&&!opts.isHost)return false;
    return commitFinal(finalOrder(),false);
  }

  // Dellacherie 风格井面评估：高度之外同时惩罚洞、行列转换、深井和凹凸。
  // 这些特征既用于断网本地 AI，也作为归一化经验送入玩家专属学习模型。
  function boardMetrics(well){
    const heights=Array(COLS).fill(0);let holes=0,aggregateHeight=0,maxHeight=0,bumpiness=0,rowTransitions=0,columnTransitions=0,wells=0;
    for(let c=0;c<COLS;c++){
      let found=false;
      for(let r=0;r<ROWS;r++){
        if(well[r][c]){if(!found){found=true;heights[c]=ROWS-r;}}else if(found)holes++;
      }
      aggregateHeight+=heights[c];maxHeight=Math.max(maxHeight,heights[c]);
    }
    for(let c=0;c<COLS-1;c++)bumpiness+=Math.abs(heights[c]-heights[c+1]);
    for(let r=0;r<ROWS;r++){
      let previous=1;
      for(let c=0;c<COLS;c++){const occupied=well[r][c]?1:0;if(occupied!==previous)rowTransitions++;previous=occupied;}
      if(previous!==1)rowTransitions++;
    }
    for(let c=0;c<COLS;c++){
      let previous=0;
      for(let r=0;r<ROWS;r++){const occupied=well[r][c]?1:0;if(occupied!==previous)columnTransitions++;previous=occupied;}
      if(previous!==1)columnTransitions++;
    }
    for(let c=0;c<COLS;c++){
      let depth=0;
      for(let r=0;r<ROWS;r++){
        const left=c===0||well[r][c-1],right=c===COLS-1||well[r][c+1];
        if(!well[r][c]&&left&&right){depth++;wells+=depth;}else depth=0;
      }
    }
    return{heights,holes,aggregateHeight,maxHeight,bumpiness,rowTransitions,columnTransitions,wells};
  }
  function evaluatePlacement(well,kind,rotation,x,incoming){
    const shape=shapeAt(kind,rotation);let y=-shape.length;
    while(!collide(well,shape,x,y+1))y++;
    if(collide(well,shape,x,y))return null;
    const beforeClear=cloneWell(well),placed=[];
    for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++)if(shape[r][c]){
      const rr=y+r,cc=x+c;if(rr<0||cc<0||cc>=COLS||rr>=ROWS)return null;
      beforeClear[rr][cc]=1;placed.push([rr,cc]);
    }
    const fullRows=[];for(let r=0;r<ROWS;r++)if(beforeClear[r].every(Boolean))fullRows.push(r);
    const result=lockInto(well,shape,x,y);if(result.cleared<0)return null;
    const metrics=boardMetrics(result.well),cleared=result.cleared;
    const erodedPieceCells=cleared*placed.filter(cell=>fullRows.includes(cell[0])).length;
    const landingHeight=ROWS-(y+shape.length/2),attack=attackFor(cleared),cancelled=Math.min(Math.max(0,Number(incoming)||0),attack);
    const score=
      -4.5002*landingHeight+3.4181*erodedPieceCells-3.2179*metrics.rowTransitions-
      9.3487*metrics.columnTransitions-7.8993*metrics.holes-3.3856*metrics.wells-
      1.8*metrics.bumpiness-2.4*Math.max(0,metrics.maxHeight-12)**2+
      cancelled*32+Math.max(0,attack-cancelled)*18;
    return{kind,rotation,x,y,well:result.well,cleared,attack,cancelled,landingHeight,erodedPieceCells,...metrics,score};
  }
  function enumeratePlacements(well,kind,incoming){
    const options=[];
    for(let rotation=0;rotation<4;rotation++)for(let x=-2;x<COLS+2;x++){
      const candidate=evaluatePlacement(well,kind,rotation,x,incoming);if(candidate)options.push(candidate);
    }
    return options;
  }
  function aiOptions(state){
    ensureQueue(state);
    const kind=state.active?state.active.kind:state.queue[0],next=state.queue[state.active?0:1];
    // 先按单层评分剪枝，再对最强 32 个落点做第二块前瞻，保证浏览器主线程稳定。
    const incoming=incomingTotal(state),options=enumeratePlacements(state.well,kind,incoming)
      .sort((a,b)=>b.score-a.score||a.rotation-b.rotation||a.x-b.x).slice(0,32);
    options.forEach(candidate=>{
      if(!Number.isInteger(next)){candidate.lookaheadScore=candidate.score;return;}
      const replies=enumeratePlacements(candidate.well,next,Math.max(0,incoming-candidate.attack));
      const bestReply=replies.reduce((best,item)=>!best||item.score>best.score?item:best,null);
      candidate.nextBest=bestReply?bestReply.score:0;
      candidate.lookaheadScore=candidate.score+(bestReply?bestReply.score*.35:-500);
    });
    return options.sort((a,b)=>b.lookaheadScore-a.lookaheadScore||b.score-a.score||a.rotation-b.rotation||a.x-b.x);
  }
  function tetrisLearningFeatures(item,best,band,incoming){
    const quality=1-Math.max(0,best.lookaheadScore-item.lookaheadScore)/Math.max(1,band);
    return{
      quality:Math.max(-1,Math.min(1,quality)),lines_cleared:item.cleared/4,tetris:item.cleared===4?1:0,
      attack:item.attack/4,incoming_cancel:Math.min(1,item.cancelled/4),low_landing:1-Math.min(1,item.landingHeight/ROWS),
      low_stack:1-Math.min(1,item.maxHeight/ROWS),few_holes:1-Math.min(1,item.holes/18),
      smooth_surface:1-Math.min(1,item.bumpiness/36),row_stability:1-Math.min(1,item.rowTransitions/80),
      column_stability:1-Math.min(1,item.columnTransitions/50),well_control:1-Math.min(1,item.wells/60),
      pressure:Math.min(1,Math.max(0,incoming)/12),
    };
  }
  const aiPending=new Set();
  const aiTimers=new Map();
  function queueAI(pi,delay){
    const existing=aiTimers.get(pi);if(existing)clearTimeout(existing);
    const timer=setTimeout(()=>{if(aiTimers.get(pi)===timer)aiTimers.delete(pi);scheduleAI(pi);},Math.max(0,Number(delay)||0));
    if(timer&&typeof timer.unref==='function')timer.unref();aiTimers.set(pi,timer);
  }
  async function scheduleAI(pi){
    const queued=aiTimers.get(pi);if(queued){clearTimeout(queued);aiTimers.delete(pi);}
    const state=states[pi]; if (destroyed||over||!state||!state.alive||aiPending.has(pi)||!opts.ai||!opts.ai.has(pi)) return;
    aiPending.add(pi);const epoch=aiEpoch,options=aiOptions(state);
    if (!options.length){ aiPending.delete(pi); ko(pi,'TOP OUT'); return; }
    const best=options[0],band=Math.max(8,Math.min(48,Math.abs(best.lookaheadScore)*.035+8));
    const near=options.filter(item=>item.lookaheadScore>=best.lookaheadScore-band).slice(0,8);
    const choices=near.map(item=>item.kind+':'+item.rotation+':'+item.x+':'+item.y);
    const incoming=incomingTotal(state),learningCandidates=near.map(item=>({choice:item.kind+':'+item.rotation+':'+item.x+':'+item.y,features:tetrisLearningFeatures(item,best,band,incoming)}));
    const remote=await aiChoose('tetris',{player:pi,well:state.well.map(row=>row.join('')),incoming,target:targetFor(pi),next:state.queue[0],localRanking:near.map(item=>({choice:item.kind+':'+item.rotation+':'+item.x+':'+item.y,score:+item.lookaheadScore.toFixed(2),holes:item.holes,height:item.maxHeight,lines:item.cleared}))},choices,opts.aiPersona,learningCandidates);
    if (destroyed||over||epoch!==aiEpoch){ aiPending.delete(pi); return; }
    const index=choices.indexOf(remote),pick=near[index>=0?index:0];aiPending.delete(pi);
    state.active={kind:pick.kind,rotation:pick.rotation,x:pick.x,y:pick.y}; applyPlacement(pi,{piece:pick.kind,x:pick.x,y:pick.y,rot:pick.rotation},true,!!opts.online);
    if(state.alive&&!over)queueAI(pi,2500);
  }

  function tick(){
    if (destroyed||over) return;
    const now=Date.now(),dt=Math.min(250,Math.max(0,now-lastTickAt)); lastTickAt=now;
    performanceStats.samples++;performanceStats.lastFrameMs=dt;performanceStats.maxFrameMs=Math.max(performanceStats.maxFrameMs,dt);if(dt>50)performanceStats.longFrames++;
    remainingMs=authorityMode?Math.max(0,matchEndAt-now):Math.max(0,MATCH_MS-(now-startedAt));
    // tetris-rule-v2 的重力/锁定完全由服务端推进；客户端只做输入乐观展示，避免本地计时器与权威快照竞态。
    if(fullRuleAuthority){if(now-lastRenderAt>=100){render();lastRenderAt=now;}return;}
    states.forEach(state=>{
      if(!state.alive)return;
      if(opts.online&&!opts.isHost&&state.id!==controlled)return;
      if(!authorityMode)resolveDueGarbage(state,now);
      if(now<countdownEndsAt) return;
      if(opts.online&&state.id!==controlled) return;
      if(opts.ai&&opts.ai.has(state.id)) return;
      state.fallMs+=dt; const interval=Math.max(160,700-Math.floor(state.lines/10)*45);
      if(state.fallMs>=interval){ state.fallMs-=interval; const active=state.active|| (spawn(state)&&state.active); if(!active)return;
        const shape=shapeAt(active.kind,active.rotation); if(!collide(state.well,shape,active.x,active.y+1)) active.y++; else lockActive(state.id,state.id===controlled);
      }
    });
    if(remainingMs<=0&&!authorityMode&&(!opts.online||opts.isHost))finishMatch();syncArrays();
    if(now-lastRenderAt>=100){render();lastRenderAt=now;}
  }
  const gameTimer=setInterval(tick,50); if(gameTimer&&typeof gameTimer.unref==='function')gameTimer.unref();
  function emitHostSync(){
    if(!opts.online||!opts.isHost||destroyed||over||opts.isReplaying&&opts.isReplaying())return false;
    relayRevision++;const next=seq+1;
    sendRelay({act:'sync',revision:relayRevision,state:relaySnapshot(next),protocol:'casual-host-relay-v1'});return true;
  }
  const relayTimer=opts.online&&!authorityMode&&opts.isHost?setInterval(emitHostSync,RELAY_SYNC_MS):null;
  if(relayTimer&&typeof relayTimer.unref==='function')relayTimer.unref();

  function handleKey(event){
    if(!canControl())return;
    const key=event.key;
    if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','z','Z','x','X','c','C','Shift',' ','Spacebar'].includes(key)&&event.preventDefault)event.preventDefault();
    if(key==='ArrowLeft')moveActive(-1); else if(key==='ArrowRight')moveActive(1); else if(key==='ArrowDown')softDrop();
    else if(key==='ArrowUp'||key==='x'||key==='X')rotateActive(1); else if(key==='z'||key==='Z')rotateActive(-1);
    else if(key==='c'||key==='C'||key==='Shift')hold(); else if(key===' '||key==='Spacebar')hardDrop();
  }
  if(document.addEventListener)document.addEventListener('keydown',handleKey);

  function localizeTetrisReason(reason){const key={ 'TOP OUT':'tetris_reason_top_out','GARBAGE KO':'tetris_reason_garbage_ko','REMOTE KO':'tetris_reason_remote_ko','SERVER KO':'tetris_reason_server_ko' }[String(reason||'').toUpperCase()];return key?t(key):String(reason||t('tetris_status_ko'));}
  function localizeTetrisEvent(value){const text=String(value||''),incoming=/^⚠ \+(\d+)$/.exec(text),garbage=/^\+(\d+) GARBAGE$/.exec(text),cleared=/^CLEAR ×(\d+)$/.exec(text);if(incoming)return t('tetris_event_incoming',incoming[1]);if(garbage)return t('tetris_event_garbage',garbage[1]);if(cleared)return t('tetris_event_clear',cleared[1]);const key={KO:'tetris_status_ko',LOCK:'tetris_event_lock',HOLD:'tetris_hold',SPAWN:'tetris_event_spawn',SYNC:'tetris_event_sync',READY:'tetris_event_ready','TETRIS!':'tetris_event_tetris'}[text.toUpperCase()];return key?t(key):text;}
  extra.innerHTML=''; const battleHud=el('div','tetris-battle-hud'),actions=el('div','tetris-actions'); extra.appendChild(battleHud); extra.appendChild(actions);
  function addControl(label,fn,primary,ariaKey){const button=el('button','btn'+(primary?' btn-primary':''),label);if(ariaKey)button.setAttribute('aria-label',t(ariaKey));button.addEventListener('click',fn);actions.appendChild(button);return button;}
  addControl('⬅',()=>moveActive(-1),false,'tetris_move_left'); addControl('➡',()=>moveActive(1),false,'tetris_move_right'); addControl('↺',()=>rotateActive(-1),false,'tetris_rotate_left'); addControl('↻',()=>rotateActive(1),false,'tetris_rotate_right');
  addControl('⬇',softDrop,false,'tetris_soft_drop'); addControl(t('tetris_hold'),hold,false,'tetris_hold'); addControl('⤓',hardDrop,true,'tetris_hard_drop');

  function createWellView(mini){
    const root=el('div','tetris-well'+(mini?' mini-board':' main-board'));root.style.touchAction='none';
    return{root,mini,locked:new Map(),ghost:[],active:[],ko:null,assetUrl:''};
  }
  function setCellPosition(node,item,cell){node.style.display='block';node.style.left=item.x*cell+'px';node.style.top=item.y*cell+'px';node.style.width=cell+'px';node.style.height=cell+'px';}
  function updateCellPool(view,key,items,className,kind,cell){
    const pool=view[key];
    while(pool.length<items.length){const node=el('div','tetris-cell');pool.push(node);view.root.appendChild(node);}
    pool.forEach((node,index)=>{if(index>=items.length){node.style.display='none';return;}node.className=className+' kind-'+kind;setCellPosition(node,items[index],cell);node.style.backgroundColor=className.includes('ghost')?'':COLORS[kind];node.style.color=COLORS[kind];});
  }
  function updateWellView(view,state,width){
    const mini=view.mini,cell=width/COLS,height=cell*ROWS,well=view.root;
    well.style.width=width+'px';well.style.height=height+'px';
    if(well.style&&typeof well.style.setProperty==='function')well.style.setProperty('--tetris-cell-size',cell+'px');else well.style['--tetris-cell-size']=cell+'px';
    const playerCosmetic=cosmetic.players&&cosmetic.players[state.id]||{},background=playerCosmetic.background||cosmetic.background,block=playerCosmetic.block||cosmetic.block;
    const artEnabled=typeof gameArtEnabled==='function'&&gameArtEnabled('tetris');well.classList.toggle('game-art-v1',artEnabled);
    if(artEnabled){const url=gameArtUrl('tetris','board');if(url!==view.assetUrl){setAssetCssUrl(well,'--game-board-art',url);view.assetUrl=url;}well.style.backgroundImage='';}
    else{view.assetUrl='';well.style.backgroundImage=background==='grid'?'linear-gradient(rgba(34,211,238,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.12) 1px,transparent 1px)':'';}
    const occupied=new Set();
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(state.well[r][c]){
      const key=r+':'+c,kind=(r*COLS+c)%7;occupied.add(key);let node=view.locked.get(key);
      if(!node){node=el('div','tetris-cell');view.locked.set(key,node);well.appendChild(node);}
      node.className='tetris-cell is-locked kind-'+kind;setCellPosition(node,{x:c,y:r},cell);node.style.backgroundColor=COLORS[kind];node.style.boxShadow=block==='neon'?'inset 0 0 '+(cell*.35)+'px #fff,0 0 '+(cell*.35)+'px '+COLORS[kind]:'';
    }
    for(const [key,node] of view.locked)if(!occupied.has(key)){removeRenderNode(node);view.locked.delete(key);}
    const activeCells=[],ghostCells=[];
    if(state.active&&state.alive){
      const shape=shapeAt(state.active.kind,state.active.rotation);let ghostY=state.active.y;while(!collide(state.well,shape,state.active.x,ghostY+1))ghostY++;
      for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++)if(shape[r][c]){
        if(!mini&&ghostY+r>=0)ghostCells.push({x:state.active.x+c,y:ghostY+r});
        if(state.active.y+r>=0)activeCells.push({x:state.active.x+c,y:state.active.y+r});
      }
      updateCellPool(view,'ghost',ghostCells,'tetris-cell ghost',state.active.kind,cell);
      updateCellPool(view,'active',activeCells,'tetris-cell is-active',state.active.kind,cell);
    }else{updateCellPool(view,'ghost',[],'tetris-cell ghost',0,cell);updateCellPool(view,'active',[],'tetris-cell is-active',0,cell);}
    if(!view.ko){view.ko=el('div','tetris-ko',t('tetris_status_ko'));well.appendChild(view.ko);}
    view.ko.style.cssText='position:absolute;inset:0;display:'+(state.alive?'none':'grid')+';place-items:center;background:rgba(2,6,23,.7);color:#fff;font-size:'+(mini?'18':'42')+'px;font-weight:950;z-index:8;';
  }
  function ensureRenderTree(){
    if(renderTree&&area.querySelector&&area.querySelector('.tetris-battle-layout')===renderTree.layout)return renderTree;
    area.innerHTML='';miniViews.clear();
    const layout=el('div','tetris-battle-layout'),mainBox=el('section','tetris-player-main'),mainScore=el('div','tetris-score'),mainWell=createWellView(false),mainNext=el('div','tetris-next'),side=el('aside','tetris-opponents'),compact=el('div','tetris-compact-status');
    layout.style.cssText='display:grid;grid-template-columns:minmax(220px,1fr) minmax(112px,.38fr);gap:12px;align-items:start;touch-action:none;';
    mainBox.appendChild(mainScore);mainBox.appendChild(mainWell.root);mainBox.appendChild(mainNext);layout.appendChild(mainBox);layout.appendChild(side);area.appendChild(layout);
    states.forEach(state=>{const card=el('button','tetris-mini-card');card.dataset.player=String(state.id);card.style.cssText='display:block;width:100%;margin-bottom:8px;padding:5px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--text);';
      const title=el('div','tetris-mini-title'),well=createWellView(true),event=el('strong','tetris-event');card.appendChild(title);card.appendChild(well.root);card.appendChild(event);card.addEventListener('click',()=>{observedPlayer=state.id;render();});side.appendChild(card);miniViews.set(state.id,{card,title,well,event});});
    side.appendChild(compact);renderTree={layout,mainBox,mainScore,mainWell,mainNext,side,compact};return renderTree;
  }
  function render(){
    if(destroyed)return;const tree=ensureRenderTree(),width=Math.min(area.clientWidth||560,680),main=states[observedPlayer]||states[0],mainWidth=Math.min(360,Math.max(220,width*.62));
    const scoreText=t('tetris_score_line',main.id+1,main.score,main.lines,t(main.alive?'tetris_status_alive':'tetris_status_ko'));if(tree.mainScore.textContent!==scoreText)tree.mainScore.textContent=scoreText;
    updateWellView(tree.mainWell,main,mainWidth);
    const queue=main.queue.slice(0,3).map(kind=>['I','O','J','L','S','Z','T'][kind]).join(' '),nextText=t('tetris_hold_next',main.hold===null?'—':['I','O','J','L','S','Z','T'][main.hold],queue,incomingTotal(main));if(tree.mainNext.textContent!==nextText)tree.mainNext.textContent=nextText;
    const opponents=states.filter(state=>state.id!==main.id),visible=new Set(opponents.slice(0,3).map(state=>state.id));
    states.forEach(state=>{const view=miniViews.get(state.id);if(!view)return;view.card.style.display=visible.has(state.id)?'block':'none';if(!visible.has(state.id))return;
      const title=t('tetris_mini_title',state.id+1,t(state.alive?'tetris_status_alive':'tetris_status_ko'),state.score);if(view.title.textContent!==title)view.title.textContent=title;updateWellView(view.well,state,Math.min(112,width*.25));const showEvent=Date.now()-state.eventAt<1500,eventText=localizeTetrisEvent(state.lastEvent);view.event.style.display=showEvent?'block':'none';if(showEvent&&view.event.textContent!==eventText)view.event.textContent=eventText;});
    const compact=opponents.slice(3),compactText=compact.map(state=>t('tetris_compact_player',state.id+1,t(state.alive?'tetris_status_alive':'tetris_status_ko'),boardHeight(state.well))).join(' · ');tree.compact.style.display=compact.length?'block':'none';if(tree.compact.textContent!==compactText)tree.compact.textContent=compactText;
    const seconds=Math.ceil(Math.max(0,remainingMs)/1000),countdown=Math.ceil(Math.max(0,countdownEndsAt-Date.now())/1000),target=targetFor(controlled),hudText=countdown>0?t('tetris_countdown',countdown):('⏱ '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' · '+t('tetris_alive_ratio',states.filter(state=>state.alive).length,playerCount)+(authorityMode&&target>=0?' · '+t('tetris_target',target+1):''));
    if(battleHud.textContent!==hudText)battleHud.textContent=hudText;actions.style.display=spectator?'none':'flex';
    const playerRows=states.map(state=>state.alive?t('tetris_player_lines',state.lines,incomingTotal(state)):t('tetris_status_ko')),playersSignature=controlled+'|'+playerRows.join('|');if(playersSignature!==lastPlayersSignature){lastPlayersSignature=playersSignature;renderPlayers(controlled,playerRows);}
    if(over&&!victoryShown){victoryShown=true;showVictoryOverlay(area,{winner,winnerName:t('player_number',winner+1),emoji:'🏆',subtitle:t('tetris_victory_subtitle',states[winner].score),coins:1,onRestart:reset});}updateStatus();
  }
  function updateStatus(){if(over)return;const countdown=Math.ceil(Math.max(0,countdownEndsAt-Date.now())/1000),text=countdown>0?t('tetris_countdown',countdown):(t(spectator?'spectating_prefix':'empty_text')+t('tetris_survival_status',states.filter(state=>state.alive).length));if(text!==lastStatusText){lastStatusText=text;setStatus(text);}}

  opts.onMove=(payload,player)=>{
    if(authorityMode)return;
    if(!plainRecord(payload))return;const pi=opts.online?player:(Number.isInteger(player)?player:0);if(!Number.isInteger(pi)||pi<0||pi>=states.length)return;
    if(opts.online&&(!validMatchId(payload.matchId)||!Number.isSafeInteger(payload.seq)))return;
    const incomingSeq=opts.online?payload.seq:(Number.isSafeInteger(payload.seq)?payload.seq:0);
    if(opts.online&&incomingSeq<=lastSeq[pi])return;
    if(incomingSeq){lastSeq[pi]=incomingSeq;if(pi===controlled)seq=Math.max(seq,incomingSeq);}
    if(payload.act==='sync'){
      if(opts.online&&pi===hostSlot)applyRelaySnapshot(payload.state);return;
    }
    if(payload.act==='final'){
      if(!opts.online||pi!==hostSlot)return;
      if(payload.state)applyRelaySnapshot(payload.state);
      commitFinal(Array.isArray(payload.order)?payload.order.map(Number):[],true);return;
    }
    if(over)return;
    if(payload.act==='active'){
      if(!onlyKeys(payload,RELAY_ACTIVE_KEYS))return;
      const state=states[pi],kind=payload.piece,x=payload.x,y=payload.y,rotation=payload.rot;
      if(!state.alive||!validKind(kind)||!validCoord(x,-3,9)||!validCoord(y,-4,17)||!safeInt(rotation,0,3)||!validQueue(payload.queue)||!validHold(payload.hold)||!safeInt(payload.bagIndex,0,1000000)||typeof payload.canHold!=='boolean')return;
      state.queue=payload.queue.slice();state.bagIndex=payload.bagIndex;state.hold=payload.hold;state.canHold=payload.canHold;state.active={kind,x,y,rotation};render();return;
    }
    if(payload.act==='ko'){ko(pi,String(payload.reason||'REMOTE KO').slice(0,40),{emit:false,confirmed:true,koTime:payload.koTime});return;}
    const applied=applyPlacement(pi,payload,payload.act!=='lock',false);
    if(applied&&!opts.online&&opts.ai)opts.ai.forEach(aiPlayer=>scheduleAI(aiPlayer));
  };
  function authorityIncoming(items){
    if(!Array.isArray(items))return[];
    const seen=new Set(),out=[];
    for(const item of items){
      if(!plainRecord(item)||item.delivered===true||typeof item.attackId!=='string'||!ATTACK_ID_RE.test(item.attackId)||seen.has(item.attackId)||
         !safeInt(item.source,0,playerCount-1)||!safeInt(item.target,0,playerCount-1)||!safeInt(item.amount,1,4)||!Number.isFinite(item.applyAt))continue;
      seen.add(item.attackId);out.push({id:item.attackId,from:item.source,lines:item.amount,applyAt:item.applyAt});
      if(out.length>=100)break;
    }
    return out;
  }
  function onBattleEvent(event){
    if(!authorityMode||!plainRecord(event)||!validMatchId(event.matchId)||!safeInt(event.revision,1,Number.MAX_SAFE_INTEGER)||event.revision<=authorityRevision||
       !ATTACK_ID_RE.test(String(event.attackId||''))||!safeInt(event.source,0,playerCount-1)||(!safeInt(event.target,-1,playerCount-1))||!safeInt(event.amount,0,4)||!safeInt(event.cancelled,0,4))return false;
    const source=event.source,target=event.target,sourceIncoming=authorityIncoming(event.sourceIncoming),targetIncoming=authorityIncoming(event.targetIncoming);
    authorityRevision=event.revision;
    if(states[source]){states[source].incoming=sourceIncoming;states[source].garbageSent+=event.amount;}
    if(states[target]){states[target].incoming=targetIncoming;states[target].lastEvent='⚠ +'+incomingTotal(states[target]);states[target].eventAt=Date.now();}
    render();return true;
  }
  function onGarbageDue(event){
    if(!authorityMode||!plainRecord(event)||!validMatchId(event.matchId)||!safeInt(event.revision,1,Number.MAX_SAFE_INTEGER)||event.revision<=authorityRevision||
       !ATTACK_ID_RE.test(String(event.attackId||''))||!safeInt(event.source,0,playerCount-1)||!safeInt(event.target,0,playerCount-1)||!safeInt(event.amount,1,4)||
       (event.applyAt!==undefined&&!Number.isFinite(event.applyAt)))return false;
    const target=event.target,state=states[target];if(!state)return false;
    const index=state.incoming.findIndex(item=>item.id===event.attackId);if(index<0||state.incoming[index].lines!==event.amount)return false;
    const pending=state.incoming.splice(index,1)[0];authorityRevision=event.revision;
    if(state.alive)applyGarbage(state,{id:pending.id,from:pending.from,lines:pending.lines,applyAt:Date.now()});
    syncArrays();render();if(target===controlled)sendPresentation();return true;
  }
  function onAuthorityKO(event){
    if(!authorityMode||!plainRecord(event)||!validMatchId(event.matchId)||!safeInt(event.revision,1,Number.MAX_SAFE_INTEGER)||event.revision<=authorityRevision||
       !safeInt(event.player,0,playerCount-1)||!safeInt(event.placement,1,playerCount)||!Number.isFinite(event.koTime))return false;
    const player=event.player;if(!states[player])return false;authorityRevision=event.revision;
    ko(player,'SERVER KO',{emit:false,confirmed:true,koTime:event.koTime});states[player].placement=event.placement;render();return true;
  }
  function onAuthorityResult(payload){
    return !!(authorityMode&&plainRecord(payload)&&validMatchId(payload.matchId)&&validFinalOrder(Array.isArray(payload.order)?payload.order:[]))&&commitFinal(payload.order.slice(),true,true);
  }
  function validRuleEvent(value){return value===null||(plainRecord(value)&&typeof value.type==='string'&&value.type.length>0&&value.type.length<=32&&
    (value.type!=='garbage'||safeInt(value.lines,0,12)));}
  function ruleEventText(value){
    if(!value)return'SYNC';
    if(value.type==='garbage')return'+'+value.lines+' GARBAGE';
    return value.type.toUpperCase();
  }
  function parseRulePlayer(meta,id){
    if(!plainRecord(meta)||meta.player!==id||!safeInt(meta.seq,0,Number.MAX_SAFE_INTEGER)||meta.seq<ruleSeq[id]||typeof meta.hash!=='string'||meta.hash.length>128||
       !plainRecord(meta.state)||!Array.isArray(meta.incoming)||meta.incoming.length>100||typeof meta.alive!=='boolean'||
       (meta.koTime!==null&&!Number.isFinite(meta.koTime))||!safeInt(meta.placement,0,playerCount))return null;
    const data=meta.state;
    if(!onlyKeys(data,new Set(['protocol','seed','player','board','active','queue','bagIndex','hold','canHold','score','lines','pieces','terminal','reason','lastEvent']))||
       data.protocol!==RULE_PROTOCOL||typeof data.seed!=='string'||data.seed.length>128||data.player!==id||!validWell(data.board)||!validActive(data.active)||!validQueue(data.queue)||
       !safeInt(data.bagIndex,0,1000000)||!validHold(data.hold)||typeof data.canHold!=='boolean'||!safeInt(data.score,0,1000000000)||!safeInt(data.lines,0,100000)||
       !safeInt(data.pieces,0,100000)||typeof data.terminal!=='boolean'||(data.reason!==null&&(typeof data.reason!=='string'||data.reason.length>64))||!validRuleEvent(data.lastEvent))return null;
    const incoming=authorityIncoming(meta.incoming);if(incoming.length!==meta.incoming.length)return null;
    return{seq:meta.seq,hash:meta.hash,state:data,incoming,alive:meta.alive,koTime:meta.koTime,placement:meta.placement};
  }
  function onTetrisRuleState(value){
    const allowed=new Set(['protocol','matchId','startAt','matchEndAt','matchSeed','rulesetVersion','revision','serverNow','players','finished','order','inputCount']);
    if(!fullRuleAuthority||!onlyKeys(value,allowed)||value.protocol!==RULE_PROTOCOL||!validMatchId(value.matchId)||!safeInt(value.revision,0,Number.MAX_SAFE_INTEGER)||value.revision<authorityRevision||
       !Number.isFinite(value.startAt)||!Number.isFinite(value.matchEndAt)||value.matchEndAt<value.startAt||typeof value.matchSeed!=='string'||value.matchSeed.length>128||
       value.rulesetVersion!==RULE_PROTOCOL||!Number.isFinite(value.serverNow)||!Array.isArray(value.players)||value.players.length!==playerCount||
       !safeInt(value.inputCount,0,1000000)||(value.finished!==true&&value.finished!==false)||(value.order!==null&&!validFinalOrder(value.order)))return false;
    const parsed=value.players.map((meta,id)=>parseRulePlayer(meta,id));if(parsed.some(item=>!item))return false;
    authorityRevision=Math.max(authorityRevision,value.revision);startedAt=value.startAt;countdownEndsAt=startedAt;matchEndAt=value.matchEndAt;bagSeed=value.matchSeed;remainingMs=Math.max(0,matchEndAt-Date.now());
    parsed.forEach((meta,id)=>{const state=states[id],data=meta.state;ruleSeq[id]=meta.seq;state.well=data.board.map(row=>row.slice());state.active=data.active===null?null:{kind:data.active.kind,rotation:data.active.rotation,x:data.active.x,y:data.active.y};state.queue=data.queue.slice();state.bagIndex=data.bagIndex;state.hold=data.hold;state.canHold=data.canHold;state.score=data.score;state.lines=data.lines;state.tetrisCount=0;state.placementSeq=data.pieces;state.alive=meta.alive&&!data.terminal;state.koTime=meta.koTime;state.placement=meta.placement;state.incoming=meta.incoming;state.lastEvent=ruleEventText(data.lastEvent);state.eventAt=Date.now();});
    pieceCount=Math.max(pieceCount,parsed.reduce((sum,item)=>sum+item.state.pieces,0));
    syncArrays();if(value.finished&&validFinalOrder(value.order||[]))commitFinal(value.order.slice(),true,true);else render();return true;
  }
  function onTetrisRuleResult(value){return !!(fullRuleAuthority&&onlyKeys(value,new Set(['type','matchId','protocol','revision','serverNow','order','stats']))&&value.protocol===RULE_PROTOCOL&&validMatchId(value.matchId)&&safeInt(value.revision,1,Number.MAX_SAFE_INTEGER)&&validFinalOrder(Array.isArray(value.order)?value.order:[]))&&commitFinal(value.order.slice(),true,true);}
  function applyPresentation(player,value,incomingSeq){
    const state=states[player],data=value&&value.state?value.state:value;
    if(!state||!plainRecord(data)||!onlyKeys(data,PRESENTATION_KEYS)||!validWell(data.well)||!validActive(data.active)||!validQueue(data.queue)||!validHold(data.hold)||
       typeof data.canHold!=='boolean'||!safeInt(data.bagIndex,0,1000000)||!safeInt(data.score,0,1000000000)||!safeInt(data.lines,0,100000)||
       !safeInt(data.tetrisCount,0,25000)||!safeInt(data.placementSeq,0,100000)||data.placementSeq<state.placementSeq)return false;
    if(incomingSeq!==undefined&&(!Number.isSafeInteger(incomingSeq)||incomingSeq<=presentationSeq[player]))return false;
    state.well=data.well.map(row=>row.slice());state.active=data.active===null?null:{kind:data.active.kind,rotation:data.active.rotation,x:data.active.x,y:data.active.y};
    state.queue=data.queue.slice();state.bagIndex=data.bagIndex;state.hold=data.hold;state.canHold=data.canHold;
    state.score=data.score;state.lines=data.lines;state.tetrisCount=data.tetrisCount;state.placementSeq=data.placementSeq;
    if(incomingSeq!==undefined)presentationSeq[player]=incomingSeq;
    syncArrays();return true;
  }
  function onTetrisState(item){
    if(!authorityMode||!onlyKeys(item,TETRIS_STATE_KEYS))return false;
    const player=item.player;if(!safeInt(player,0,playerCount-1)||!validMatchId(item.matchId)||(item.updatedAt!==undefined&&!Number.isFinite(item.updatedAt)))return false;
    const incomingSeq=Number.isSafeInteger(item.seq)?item.seq:(item.state&&Number.isSafeInteger(item.state.seq)?item.state.seq:0);
    if(!safeInt(incomingSeq,1,Number.MAX_SAFE_INTEGER))return false;
    const applied=applyPresentation(player,item.state,incomingSeq);if(applied)render();return applied;
  }
  function onBattleSnapshot(value){
    if(!authorityMode||!plainRecord(value)||value.protocol!==AUTH_PROTOCOL||!validMatchId(value.matchId)||!safeInt(value.revision,0,Number.MAX_SAFE_INTEGER)||value.revision<authorityRevision||
       !Number.isFinite(value.startAt)||!Number.isFinite(value.matchEndAt)||value.matchEndAt<value.startAt||!Array.isArray(value.players)||value.players.length!==playerCount)return false;
    authorityRevision=Math.max(authorityRevision,value.revision);startedAt=value.startAt;countdownEndsAt=startedAt;matchEndAt=value.matchEndAt;bagSeed=typeof value.matchSeed==='string'?value.matchSeed:bagSeed;
    value.players.forEach((meta,id)=>{if(!states[id]||!plainRecord(meta))return;states[id].alive=meta.alive!==false;states[id].koTime=meta.koTime===null?null:(Number.isFinite(meta.koTime)?meta.koTime:null);states[id].placement=safeInt(meta.placement,0,playerCount)?meta.placement:0;states[id].placementSeq=Math.max(states[id].placementSeq,safeInt(meta.placementSeq,0,100000)?meta.placementSeq:0);states[id].incoming=authorityIncoming(meta.incoming);states[id].garbageSent=Math.max(states[id].garbageSent,safeInt(meta.garbageSent,0,1000000)?meta.garbageSent:0);states[id].garbageReceived=Math.max(states[id].garbageReceived,safeInt(meta.garbageReceived,0,1000000)?meta.garbageReceived:0);});
    if(value.players[controlled]&&safeInt(value.players[controlled].lastSeq,0,Number.MAX_SAFE_INTEGER))battleSeq=Math.max(battleSeq,value.players[controlled].lastSeq);
    remainingMs=Math.max(0,matchEndAt-Date.now());if(value.finished&&validFinalOrder(Array.isArray(value.order)?value.order:[]))commitFinal(value.order.slice(),true,true);render();return true;
  }
  function reset(){if(opts.online&&!opts.isHost){toast(t('host_only_restart'));return;}if(opts.online){opts.sendRestart();return;}resetLocal();}
  function snapshot(){return{
    version:2,mode:'simultaneous-survival',wells:states.map(state=>state.well.map(row=>row.slice())),scores:states.map(state=>state.score),
    states:states.map(state=>({id:state.id,active:state.active?{...state.active}:null,queue:state.queue.slice(),bagIndex:state.bagIndex,hold:state.hold,canHold:state.canHold,score:state.score,lines:state.lines,tetrisCount:state.tetrisCount,placementSeq:state.placementSeq,garbageSent:state.garbageSent,garbageReceived:state.garbageReceived,incoming:state.incoming.map(item=>({...item})),alive:state.alive,koTime:state.koTime,koConfirmed:state.koConfirmed,placement:state.placement,fallMs:state.fallMs,lastEvent:state.lastEvent,eventAt:state.eventAt})),
    remainingMs,over,winner,pieceCount,cur,bagSeed,countdownRemainingMs:Math.max(0,countdownEndsAt-Date.now()),
    relay:{revision:relayRevision,seenSeq:lastSeq.slice(),seenAttacks:[...seenAttacks].slice(-500)},
  };}
  function validRelaySnapshot(state){
    if(!state||state.mode!=='simultaneous-survival'||!Array.isArray(state.wells)||state.wells.length!==playerCount||!Array.isArray(state.states)||state.states.length!==playerCount)return false;
    if(state.bagSeed&&bagSeed&&String(state.bagSeed)!==String(bagSeed))return false;
    // Local QA/replay snapshots from older clients did not carry the relay
    // bookkeeping block.  They are still safe to restore when the game is
    // running offline because no remote authority can be bypassed; online
    // snapshots must include the block so sequence/attack replay remains
    // fail-closed.
    const relay=state.relay || (!opts.online ? {
      revision:0,
      seenSeq:Array(playerCount).fill(0),
      seenAttacks:[],
    } : null);
    if (!relay) return false;
    if(!validWell(state.wells[0])||!state.wells.every(validWell)||!Number.isFinite(state.remainingMs)||state.remainingMs<0||state.remainingMs> MATCH_MS||
       !safeInt(state.pieceCount,0,1000000)||!plainRecord(relay)||!safeInt(relay.revision,0,Number.MAX_SAFE_INTEGER)||!Array.isArray(relay.seenSeq)||relay.seenSeq.length!==playerCount||
       !relay.seenSeq.every(value=>safeInt(value,0,Number.MAX_SAFE_INTEGER))||!Array.isArray(relay.seenAttacks)||relay.seenAttacks.length>500||
       !relay.seenAttacks.every(value=>typeof value==='string'&&ATTACK_ID_RE.test(value)))return false;
    return state.states.every(meta=>{
      if(!plainRecord(meta)||!validQueue(meta.queue)||!validActive(meta.active)||!safeInt(meta.bagIndex,0,1000000)||!validHold(meta.hold)||typeof meta.canHold!=='boolean'||
         !safeInt(meta.score,0,1000000000)||!safeInt(meta.lines,0,100000)||!safeInt(meta.tetrisCount,0,25000)||!safeInt(meta.placementSeq,0,100000)||
         typeof meta.alive!=='boolean'||(meta.koTime!==null&&!Number.isFinite(meta.koTime))||!Array.isArray(meta.incoming)||meta.incoming.length>100)return false;
      return meta.incoming.every(item=>plainRecord(item)&&typeof item.id==='string'&&ATTACK_ID_RE.test(item.id)&&safeInt(item.from,0,playerCount-1)&&safeInt(item.lines,1,4)&&Number.isFinite(item.applyAt));
    });
  }
  function relaySnapshot(nextLocalSeq){
    const state=snapshot();state.relay.revision=relayRevision;
    if(Number.isInteger(nextLocalSeq))state.relay.seenSeq[controlled]=Math.max(state.relay.seenSeq[controlled]||0,nextLocalSeq);
    return state;
  }
  function applyRelaySnapshot(state){
    if(!validRelaySnapshot(state))return false;
    const relay=state.relay||{},seen=Array.isArray(relay.seenSeq)?relay.seenSeq:[];
    const localState=states[controlled],incomingLocal=state.states&&state.states[controlled];
    const preserveLocal=!!localState&&((Number(seen[controlled])||0)<seq||localState.alive&&incomingLocal&&incomingLocal.alive===false&&!incomingLocal.koConfirmed);
    if(!onRestore(state))return false;
    if(preserveLocal){states[controlled]=localState;spectator=!!opts.spectator||!localState.alive;syncArrays();}
    for(let i=0;i<playerCount;i++)lastSeq[i]=Math.max(lastSeq[i]||0,Number(seen[i])||0);
    seq=Math.max(seq,Number(seen[controlled])||0);relayRevision=Math.max(relayRevision,Number(relay.revision)||0);
    if(Array.isArray(relay.seenAttacks))relay.seenAttacks.forEach(id=>{if(typeof id==='string'&&id.length<=100)seenAttacks.add(id);});
    render();return true;
  }
  function onRestore(value){
    const state=value&&value.state?value.state:value;if(!validRelaySnapshot(state))return false;
    if(state.bagSeed)bagSeed=String(state.bagSeed);aiEpoch++;
    states=state.wells.map((well,id)=>{const base=createState(id),meta=state.states[id];base.well=well.map(row=>row.slice());
      base.active=meta.active===null?null:{kind:meta.active.kind,rotation:meta.active.rotation,x:meta.active.x,y:meta.active.y};base.queue=meta.queue.slice();base.bagIndex=meta.bagIndex;base.hold=meta.hold;base.canHold=meta.canHold;
      base.score=meta.score;base.lines=meta.lines;base.tetrisCount=meta.tetrisCount;base.placementSeq=meta.placementSeq;base.garbageSent=safeInt(meta.garbageSent,0,1000000)?meta.garbageSent:0;base.garbageReceived=safeInt(meta.garbageReceived,0,1000000)?meta.garbageReceived:0;
      base.incoming=meta.incoming.map(item=>({...item}));base.alive=meta.alive;base.koTime=meta.koTime;base.koConfirmed=meta.koConfirmed===true;base.placement=safeInt(meta.placement,0,playerCount)?meta.placement:0;base.fallMs=safeInt(meta.fallMs,0,1000000)?meta.fallMs:0;base.lastEvent=typeof meta.lastEvent==='string'?meta.lastEvent.slice(0,80):'READY';base.eventAt=Number.isFinite(meta.eventAt)?meta.eventAt:Date.now();return base;});
    remainingMs=Math.max(0,state.remainingMs);startedAt=Date.now()-(MATCH_MS-remainingMs);over=state.over===true;winner=safeInt(state.winner,-1,playerCount-1)?state.winner:-1;pieceCount=state.pieceCount;
    countdownEndsAt=Date.now()+Math.max(0,Number(state.countdownRemainingMs)||0);spectator=!!opts.spectator||(!states[controlled]||!states[controlled].alive);observedPlayer=Math.min(observedPlayer,states.length-1);lastTickAt=Date.now();
    if(value&&value.presentation)setCosmetic(value.presentation.cosmetic);syncArrays();render();return true;
  }
  function setCosmetic(value){cosmetic={block:'classic',background:'classic',players:{},...(value||{})};cosmetic.block=cosmetic.block==='neon'?'neon':'classic';cosmetic.background=cosmetic.background==='grid'?'grid':'classic';render();return cosmetic;}
  function setSpectators(value){spectator=Array.isArray(value)?value.includes(opts.viewerId):!!value;if(spectator)observedPlayer=Math.min(observedPlayer,states.length-1);render();return spectator;}
  function setObservedPlayer(pi){if(Number.isInteger(pi)&&states[pi]){observedPlayer=pi;render();return true;}return false;}
  function setControlledPlayer(pi){if(opts.online||!Number.isInteger(pi)||!states[pi])return false;controlled=pi;cur=pi;observedPlayer=pi;spectator=!states[pi].alive;render();return true;}
  function getMatchStats(){const order=finalOrder();return states.map(state=>({score:state.score,lines:state.lines,tetrisCount:state.tetrisCount,garbageSent:state.garbageSent,garbageReceived:state.garbageReceived,koTime:state.koTime,placement:state.placement||order.indexOf(state.id)+1}));}
  function getPerformanceStats(){return{...performanceStats,boardCount:states.length,activeCells:states.reduce((sum,state)=>sum+state.well.reduce((n,row)=>n+row.filter(Boolean).length,0),0),incomingCount:states.reduce((sum,state)=>sum+state.incoming.length,0)};}
  function destroy(){destroyed=true;aiEpoch++;aiPending.clear();aiTimers.forEach(timer=>clearTimeout(timer));aiTimers.clear();clearInterval(gameTimer);if(relayTimer)clearInterval(relayTimer);if(document.removeEventListener)document.removeEventListener('keydown',handleKey);area.style.touchAction=previousTouchAction;area.style.overscrollBehavior=previousOverscroll;}
  resetLocal();
  return{reset,onMove:opts.onMove,onRestart:resetLocal,destroy,snapshot,onRestore,onBattleEvent,onGarbageDue,onAuthorityKO,onAuthorityResult,onBattleSnapshot,onTetrisState,onTetrisRuleState,onTetrisRuleResult,
    serialize:()=>({state:snapshot(),presentation:{cosmetic},stats:getMatchStats()}),getMatchStats,getPerformanceStats,setCosmetic,renderCosmetic:setCosmetic,setSpectators,setObservedPlayer,setControlledPlayer,
    getTarget:targetFor,queueGarbage,finishMatch,emitHostSync,whenIdle:()=>Promise.resolve(),getMultiplayerRequirement:()=>opts.online?(fullRuleAuthority?'TETRIS_RULE_PROTOCOL_V2':'TETRIS_BATTLE_PROTOCOL_V1'):null,
  };
}
