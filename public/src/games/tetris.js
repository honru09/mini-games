/* ================= 俄罗斯方块 · Simultaneous Survival Battle ================= */
function gameTetris(area, extra, n, opts){
  opts = opts || {};
  const COLS = 10, ROWS = 18, playerCount = Math.max(2, Math.min(5, Number(n) || 2));
  const MATCH_MS = Math.max(15000, Number(opts.matchDurationMs) || 300000);
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
  let spectator = !!opts.spectator, seq = 0, lastSeq = Array(playerCount).fill(0), countdownEndsAt = Date.now();
  let bagSeed = resolveMatchSeed(), garbageNonce = 0, relayRevision = 0, endReported = false;
  let seenAttacks = new Set();
  let cosmetic = { block:'classic', background:'classic', players:{}, ...(opts.cosmetic || {}) };
  let lastTickAt = Date.now(), lastRenderAt = 0;

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
    aiEpoch++; aiPending.clear(); aiTimers.forEach(timer=>clearTimeout(timer)); aiTimers.clear();
    states=Array.from({length:playerCount},(_,i)=>createState(i)); wells=states.map(state=>state.well); scores=states.map(state=>state.score);
    over=false; winner=-1; cur=controlled; pieceCount=0; startedAt=Date.now(); finishedAt=0; remainingMs=MATCH_MS;
    countdownEndsAt=startedAt+(opts.online?3000:0); lastTickAt=startedAt; seq=0; lastSeq=Array(playerCount).fill(0); destroyed=false;
    garbageNonce=0;relayRevision=0;endReported=false;seenAttacks=new Set();
    states.forEach(spawn); observedPlayer=spectator?0:controlled; render(); updateStatus();
    if(opts.ai)opts.ai.forEach(pi=>queueAI(pi,2500));
  }
  function sendRelay(payload){
    if(!opts.online||typeof opts.sendMove!=='function')return 0;
    const next=++seq;lastSeq[controlled]=Math.max(lastSeq[controlled]||0,next);
    opts.sendMove({...payload,seq:next});return next;
  }
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
    let sent=0,target=-1,cancelled=0,attackId='a'+pi+'-'+state.placementSeq;
    if (deriveAttack){
      const raw=attackFor(result.cleared), before=raw; sent=cancelIncoming(state,raw); cancelled=before-sent;
      if (sent>0){ target=targetFor(pi); if (target>=0){ state.garbageSent+=sent; queueGarbage(target,sent,pi,attackId); } }
    } else if (Number.isInteger(Number(data.garbage))&&Number(data.garbage)>0&&Number(data.garbage)<=4&&Number.isInteger(data.target)&&data.target>=0&&data.target<states.length){
      sent=Number(data.garbage);target=Number(data.target);attackId=String(data.attackId||attackId);state.garbageSent+=sent;queueGarbage(target,sent,pi,attackId);
    }
    if (emit && opts.online){
      sendRelay({act:'lock',piece:kind,x,y,rot:rotation,placementSeq:state.placementSeq,linesCleared:result.cleared,attack:attackFor(result.cleared),score:state.score,lines:state.lines,boardHeight:boardHeight(state.well),garbage:sent,target,attackId});
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
    if (!collide(state.well,shape,active.x+dx,active.y)){ active.x+=dx; emitActive(); render(); return true; } return false;
  }
  function rotateActive(direction){
    if (!canControl()) return false; const state=states[controlled],active=state.active|| (spawn(state)&&state.active);
    if (!active) return false; const next=(active.rotation+(direction>0?1:3))%4,shape=shapeAt(active.kind,next);
    for (const kick of [0,-1,1,-2,2]) if (!collide(state.well,shape,active.x+kick,active.y)){ active.rotation=next; active.x+=kick; emitActive(); render(); return true; }
    return false;
  }
  function softDrop(){
    if (!canControl()) return false; const state=states[controlled],active=state.active; if (!active) return false;
    const shape=shapeAt(active.kind,active.rotation);
    if (!collide(state.well,shape,active.x,active.y+1)){ active.y++; emitActive(); render(); return true; }
    return lockActive(controlled,true);
  }
  function hardDrop(){
    if (!canControl()) return false; const state=states[controlled],active=state.active; if (!active) return false;
    const shape=shapeAt(active.kind,active.rotation); let distance=0;
    while (!collide(state.well,shape,active.x,active.y+1)){ active.y++; distance++; }
    return lockActive(controlled,true);
  }
  function hold(){
    if (!canControl()) return false; const state=states[controlled],active=state.active;
    if (!active||!state.canHold) return false; const previous=state.hold; state.hold=active.kind; state.active=null;
    if (!spawn(state,previous===null?undefined:previous)) return false; state.canHold=false; emitActive(); render(); return true;
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
    playFeedback('capture'); toast('💀 玩家'+(pi+1)+' '+reason);
    if (pi===controlled) spectator=true;
    if(opts.online&&pi===controlled&&meta.emit!==false)sendRelay({act:'ko',reason:String(reason||'TOP OUT').slice(0,40),koTime:state.koTime});
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
  function commitFinal(order,fromRelay){
    if(!validFinalOrder(order))return false;
    over=true;finishedAt=Date.now();remainingMs=Math.max(0,MATCH_MS-(finishedAt-startedAt));winner=order[0];
    order.forEach((id,index)=>states[id].placement=index+1);
    if(opts.online&&opts.isHost&&!fromRelay)sendRelay({act:'final',order:order.slice(),state:relaySnapshot(seq+1),protocol:'casual-host-relay-v1'});
    if(!endReported&&opts.onEnd){endReported=true;opts.onEnd(order.map((id,index)=>({slot:id,rank:index+1,coins:index===0?1:0})));}
    render();setStatus('🏆 玩家'+(winner+1)+' 生存到最后',true);return true;
  }
  function finishMatch(){
    if(opts.online&&opts.serverAuthority)return false;
    if(over||opts.online&&!opts.isHost)return false;
    return commitFinal(finalOrder(),false);
  }

  function evaluatePlacement(well,kind,rotation,x){
    const shape=shapeAt(kind,rotation); let y=-shape.length;
    while (!collide(well,shape,x,y+1)) y++;
    if (collide(well,shape,x,y)) return null;
    const result=lockInto(well,shape,x,y); if (result.cleared<0) return null;
    let holes=0,aggregate=0;
    for (let c=0;c<COLS;c++){ let found=false,height=0; for (let r=0;r<ROWS;r++){
      if (result.well[r][c]){ if(!found){found=true;height=ROWS-r;} } else if(found) holes++;
    } aggregate+=height; }
    return {kind,rotation,x,y,score:result.cleared*1000-holes*8-aggregate*2};
  }
  function aiOptions(state){
    const kind=state.active?state.active.kind:nextKind(state), options=[];
    for (let rotation=0;rotation<4;rotation++){
      const shape=shapeAt(kind,rotation);
      for (let x=-2;x<COLS+2;x++){ const candidate=evaluatePlacement(state.well,kind,rotation,x); if(candidate) options.push(candidate); }
    }
    return options.sort((a,b)=>b.score-a.score).slice(0,180);
  }
  const aiPending=new Set();
  const aiTimers=new Set();
  function queueAI(pi,delay){
    const timer=setTimeout(()=>{aiTimers.delete(timer);scheduleAI(pi);},Math.max(0,Number(delay)||0));
    if(timer&&typeof timer.unref==='function')timer.unref();aiTimers.add(timer);
  }
  async function scheduleAI(pi){
    const state=states[pi]; if (destroyed||over||!state||!state.alive||aiPending.has(pi)||!opts.ai||!opts.ai.has(pi)) return;
    aiPending.add(pi); const epoch=aiEpoch,options=aiOptions(state);
    if (!options.length){ aiPending.delete(pi); ko(pi,'TOP OUT'); return; }
    const choices=options.map(item=>item.kind+':'+item.rotation+':'+item.x+':'+item.y);
    const remote=await aiChoose('tetris',{player:pi,well:state.well.map(row=>row.join('')),incoming:incomingTotal(state),target:targetFor(pi)},choices,opts.aiPersona);
    if (destroyed||over||epoch!==aiEpoch){ aiPending.delete(pi); return; }
    const index=choices.indexOf(remote),pick=options[index>=0?index:0]; aiPending.delete(pi);
    state.active={kind:pick.kind,rotation:pick.rotation,x:pick.x,y:pick.y}; applyPlacement(pi,{piece:pick.kind,x:pick.x,y:pick.y,rot:pick.rotation},true,!!opts.online);
    if(state.alive&&!over)queueAI(pi,2500);
  }

  function tick(){
    if (destroyed||over) return;
    const now=Date.now(),dt=Math.min(250,Math.max(0,now-lastTickAt)); lastTickAt=now;
    remainingMs=Math.max(0,MATCH_MS-(now-startedAt));
    states.forEach(state=>{
      if(!state.alive)return;
      if(opts.online&&!opts.isHost&&state.id!==controlled)return;
      resolveDueGarbage(state,now);
      if(now<countdownEndsAt) return;
      if(opts.online&&state.id!==controlled) return;
      if(opts.ai&&opts.ai.has(state.id)) return;
      state.fallMs+=dt; const interval=Math.max(160,700-Math.floor(state.lines/10)*45);
      if(state.fallMs>=interval){ state.fallMs-=interval; const active=state.active|| (spawn(state)&&state.active); if(!active)return;
        const shape=shapeAt(active.kind,active.rotation); if(!collide(state.well,shape,active.x,active.y+1)) active.y++; else lockActive(state.id,state.id===controlled);
      }
    });
    if(remainingMs<=0&&(!opts.online||opts.isHost))finishMatch();syncArrays();
    if(now-lastRenderAt>=100){render();lastRenderAt=now;}
  }
  const gameTimer=setInterval(tick,50); if(gameTimer&&typeof gameTimer.unref==='function')gameTimer.unref();
  function emitHostSync(){
    if(!opts.online||!opts.isHost||destroyed||over||opts.isReplaying&&opts.isReplaying())return false;
    relayRevision++;const next=seq+1;
    sendRelay({act:'sync',revision:relayRevision,state:relaySnapshot(next),protocol:'casual-host-relay-v1'});return true;
  }
  const relayTimer=opts.online&&opts.isHost?setInterval(emitHostSync,RELAY_SYNC_MS):null;
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

  extra.innerHTML=''; const battleHud=el('div','tetris-battle-hud'),actions=el('div','tetris-actions'); extra.appendChild(battleHud); extra.appendChild(actions);
  function addControl(label,fn,primary){const button=el('button','btn'+(primary?' btn-primary':''),label);button.addEventListener('click',fn);actions.appendChild(button);return button;}
  addControl('⬅',()=>moveActive(-1)); addControl('➡',()=>moveActive(1)); addControl('↺',()=>rotateActive(-1)); addControl('↻',()=>rotateActive(1));
  addControl('⬇',softDrop); addControl('HOLD',hold); addControl('⤓',hardDrop,true);

  function renderWell(state,width,mini){
    const cell=width/COLS,height=cell*ROWS,well=el('div','tetris-well'+(mini?' mini-board':' main-board'));
    well.style.width=width+'px';well.style.height=height+'px';well.style.touchAction='none';
    if(well.style&&typeof well.style.setProperty==='function')well.style.setProperty('--tetris-cell-size',cell+'px');else well.style['--tetris-cell-size']=cell+'px';
    const playerCosmetic=cosmetic.players&&cosmetic.players[state.id]||{};
    const background=playerCosmetic.background||cosmetic.background;
    if(background==='grid')well.style.backgroundImage='linear-gradient(rgba(34,211,238,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.12) 1px,transparent 1px)';
    if(typeof gameArtEnabled==='function'&&gameArtEnabled('tetris')){well.classList.add('game-art-v1');setAssetCssUrl(well,'--game-board-art',gameArtUrl('tetris','board'));}
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(state.well[r][c]){
      const kind=(r*COLS+c)%7,node=el('div','tetris-cell is-locked kind-'+kind);node.style.left=c*cell+'px';node.style.top=r*cell+'px';node.style.width=cell+'px';node.style.height=cell+'px';
      node.style.backgroundColor=COLORS[kind]; if((playerCosmetic.block||cosmetic.block)==='neon')node.style.boxShadow='inset 0 0 '+(cell*.35)+'px #fff,0 0 '+(cell*.35)+'px '+COLORS[kind];well.appendChild(node);
    }
    if(state.active&&state.alive){const shape=shapeAt(state.active.kind,state.active.rotation);let ghostY=state.active.y;while(!collide(state.well,shape,state.active.x,ghostY+1))ghostY++;
      if(!mini)for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++)if(shape[r][c]&&ghostY+r>=0){const ghost=el('div','tetris-cell ghost kind-'+state.active.kind);ghost.style.left=(state.active.x+c)*cell+'px';ghost.style.top=(ghostY+r)*cell+'px';ghost.style.width=cell+'px';ghost.style.height=cell+'px';ghost.style.color=COLORS[state.active.kind];well.appendChild(ghost);}
      for(let r=0;r<shape.length;r++)for(let c=0;c<shape[r].length;c++)if(shape[r][c]&&state.active.y+r>=0){const node=el('div','tetris-cell is-active kind-'+state.active.kind);node.style.left=(state.active.x+c)*cell+'px';node.style.top=(state.active.y+r)*cell+'px';node.style.width=cell+'px';node.style.height=cell+'px';node.style.backgroundColor=COLORS[state.active.kind];well.appendChild(node);}
    }
    if(!state.alive){const koEl=el('div','tetris-ko','KO');koEl.style.cssText='position:absolute;inset:0;display:grid;place-items:center;background:rgba(2,6,23,.7);color:#fff;font-size:'+(mini?'18':'42')+'px;font-weight:950;z-index:8;';well.appendChild(koEl);}
    return well;
  }
  function render(){
    if(destroyed)return; area.innerHTML=''; const width=Math.min(area.clientWidth||560,680),layout=el('div','tetris-battle-layout');
    layout.style.cssText='display:grid;grid-template-columns:minmax(220px,1fr) minmax(112px,.38fr);gap:12px;align-items:start;touch-action:none;';
    const main=states[observedPlayer]||states[0],mainBox=el('section','tetris-player-main');
    const mainWidth=Math.min(360,Math.max(220,width*.62));
    mainBox.appendChild(el('div','tetris-score','玩家'+(main.id+1)+' · '+main.score+' 分 · '+main.lines+' 行 · '+(main.alive?'ALIVE':'KO')));
    mainBox.appendChild(renderWell(main,mainWidth,false));
    const queue=main.queue.slice(0,3).map(kind=>['I','O','J','L','S','Z','T'][kind]).join(' ');
    mainBox.appendChild(el('div','tetris-next','HOLD '+(main.hold===null?'—':['I','O','J','L','S','Z','T'][main.hold])+'　NEXT '+queue+'　⚠ '+incomingTotal(main)));
    const side=el('aside','tetris-opponents');
    states.filter(state=>state.id!==main.id).slice(0,3).forEach(state=>{const card=el('button','tetris-mini-card');card.dataset.player=String(state.id);card.style.cssText='display:block;width:100%;margin-bottom:8px;padding:5px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--text);';
      card.appendChild(el('div','tetris-mini-title','P'+(state.id+1)+' · '+(state.alive?'ALIVE':'KO')+' · '+state.score));card.appendChild(renderWell(state,Math.min(112,width*.25),true));
      if(Date.now()-state.eventAt<1500)card.appendChild(el('strong','tetris-event',state.lastEvent));card.addEventListener('click',()=>{observedPlayer=state.id;render();});side.appendChild(card);});
    const compact=states.filter(state=>state.id!==main.id).slice(3);if(compact.length)side.appendChild(el('div','tetris-compact-status',compact.map(state=>'P'+(state.id+1)+' '+(state.alive?'ALIVE':'KO')+' H'+boardHeight(state.well)).join(' · ')));
    layout.appendChild(mainBox);layout.appendChild(side);area.appendChild(layout);
    const seconds=Math.ceil(Math.max(0,remainingMs)/1000),countdown=Math.ceil(Math.max(0,countdownEndsAt-Date.now())/1000);
    battleHud.textContent=countdown>0?('同步开局 · '+countdown):('⏱ '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' · Alive '+states.filter(state=>state.alive).length+'/'+playerCount);
    actions.style.display=spectator?'none':'flex'; renderPlayers(controlled,states.map(state=>state.alive?(state.lines+' Lines · ⚠'+incomingTotal(state)):'KO'));
    if(over)showVictoryOverlay(area,{winner,winnerName:'玩家'+(winner+1),emoji:'🏆',subtitle:'生存战获胜 · '+states[winner].score+' 分',coins:1,onRestart:reset}); updateStatus();
  }
  function updateStatus(){if(over)return;const countdown=Math.ceil(Math.max(0,countdownEndsAt-Date.now())/1000);setStatus(countdown>0?('同步开局 '+countdown):((spectator?'观战 · ':'')+'同步生存战 · '+states.filter(state=>state.alive).length+' 人存活'));}

  opts.onMove=(payload,player)=>{
    if(!payload)return;const pi=opts.online?player:(Number.isInteger(player)?player:0);if(!Number.isInteger(pi)||pi<0||pi>=states.length)return;
    const incomingSeq=Number(payload.seq)||0;
    if(opts.online&&incomingSeq&&incomingSeq<=lastSeq[pi])return;
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
      const state=states[pi],kind=Number(payload.piece),x=Number(payload.x),y=Number(payload.y),rotation=Number(payload.rot);
      if(!state.alive||!Number.isInteger(kind)||kind<0||kind>=SHAPES.length||!Number.isInteger(x)||x<-4||x>14||!Number.isInteger(y)||y<-6||y>20||!Number.isInteger(rotation)||rotation<0||rotation>3)return;
      if(Array.isArray(payload.queue)&&payload.queue.length>=4&&payload.queue.length<=14&&payload.queue.every(item=>Number.isInteger(item)&&item>=0&&item<7))state.queue=payload.queue.slice();
      if(Number.isInteger(payload.bagIndex)&&payload.bagIndex>=0&&payload.bagIndex<10000)state.bagIndex=payload.bagIndex;
      if(payload.hold===null||Number.isInteger(payload.hold)&&payload.hold>=0&&payload.hold<7)state.hold=payload.hold;
      state.canHold=payload.canHold!==false;state.active={kind,x,y,rotation};render();return;
    }
    if(payload.act==='ko'){ko(pi,String(payload.reason||'REMOTE KO').slice(0,40),{emit:false,confirmed:true,koTime:payload.koTime});return;}
    const applied=applyPlacement(pi,payload,payload.act!=='lock',false);
    if(applied&&!opts.online&&opts.ai)opts.ai.forEach(aiPlayer=>scheduleAI(aiPlayer));
  };
  function reset(){if(opts.online&&!opts.isHost){toast('由房主开始新一局');return;}if(opts.online){opts.sendRestart();return;}resetLocal();}
  function snapshot(){return{
    version:2,mode:'simultaneous-survival',wells:states.map(state=>state.well.map(row=>row.slice())),scores:states.map(state=>state.score),
    states:states.map(state=>({id:state.id,active:state.active?{...state.active}:null,queue:state.queue.slice(),bagIndex:state.bagIndex,hold:state.hold,canHold:state.canHold,score:state.score,lines:state.lines,tetrisCount:state.tetrisCount,placementSeq:state.placementSeq,garbageSent:state.garbageSent,garbageReceived:state.garbageReceived,incoming:state.incoming.map(item=>({...item})),alive:state.alive,koTime:state.koTime,koConfirmed:state.koConfirmed,placement:state.placement,fallMs:state.fallMs,lastEvent:state.lastEvent,eventAt:state.eventAt})),
    remainingMs,over,winner,pieceCount,cur,bagSeed,countdownRemainingMs:Math.max(0,countdownEndsAt-Date.now()),
    relay:{revision:relayRevision,seenSeq:lastSeq.slice(),seenAttacks:[...seenAttacks].slice(-500)},
  };}
  function validRelaySnapshot(state){
    if(!state||state.mode!=='simultaneous-survival'||!Array.isArray(state.wells)||state.wells.length!==playerCount||!Array.isArray(state.states)||state.states.length!==playerCount)return false;
    if(state.bagSeed&&bagSeed&&String(state.bagSeed)!==String(bagSeed))return false;
    return state.wells.every(well=>Array.isArray(well)&&well.length===ROWS&&well.every(row=>Array.isArray(row)&&row.length===COLS&&row.every(cell=>cell===0||cell===1)))&&state.states.every(meta=>{
      if(!meta||!Array.isArray(meta.queue)||meta.queue.length>21||!meta.queue.every(item=>Number.isInteger(item)&&item>=0&&item<7))return false;
      if(meta.active){const a=meta.active;if(!Number.isInteger(a.kind)||a.kind<0||a.kind>=7||!Number.isInteger(a.rotation)||a.rotation<0||a.rotation>3||!Number.isInteger(a.x)||a.x<-4||a.x>14||!Number.isInteger(a.y)||a.y<-6||a.y>20)return false;}
      return !meta.incoming||Array.isArray(meta.incoming)&&meta.incoming.length<=100&&meta.incoming.every(item=>item&&Number.isInteger(item.lines)&&item.lines>0&&item.lines<=4);
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
    const state=value&&value.state?value.state:value;if(!state||!Array.isArray(state.wells)||state.wells.length<2)return false;
    if(state.bagSeed)bagSeed=String(state.bagSeed);aiEpoch++;
    states=state.wells.slice(0,playerCount).map((well,id)=>{const base=createState(id),meta=Array.isArray(state.states)&&state.states[id]||{};base.well=well.map(row=>row.map(v=>v?1:0));
      Object.assign(base,meta,{id,well:base.well,queue:Array.isArray(meta.queue)?meta.queue.slice():base.queue,incoming:Array.isArray(meta.incoming)?meta.incoming.map(item=>({...item})):[],active:meta.active?{...meta.active}:null});return base;});
    while(states.length<playerCount)states.push(createState(states.length));remainingMs=Math.max(0,Number(state.remainingMs)||0);startedAt=Date.now()-(MATCH_MS-remainingMs);over=!!state.over;winner=Number.isInteger(state.winner)?state.winner:-1;pieceCount=Number(state.pieceCount)||0;
    countdownEndsAt=Date.now()+Math.max(0,Number(state.countdownRemainingMs)||0);spectator=!!opts.spectator||(!states[controlled]||!states[controlled].alive);observedPlayer=Math.min(observedPlayer,states.length-1);lastTickAt=Date.now();
    if(value&&value.presentation)setCosmetic(value.presentation.cosmetic);syncArrays();render();return true;
  }
  function setCosmetic(value){cosmetic={block:'classic',background:'classic',players:{},...(value||{})};cosmetic.block=cosmetic.block==='neon'?'neon':'classic';cosmetic.background=cosmetic.background==='grid'?'grid':'classic';render();return cosmetic;}
  function setSpectators(value){spectator=Array.isArray(value)?value.includes(opts.viewerId):!!value;if(spectator)observedPlayer=Math.min(observedPlayer,states.length-1);render();return spectator;}
  function setObservedPlayer(pi){if(Number.isInteger(pi)&&states[pi]){observedPlayer=pi;render();return true;}return false;}
  function setControlledPlayer(pi){if(opts.online||!Number.isInteger(pi)||!states[pi])return false;controlled=pi;cur=pi;observedPlayer=pi;spectator=!states[pi].alive;render();return true;}
  function getMatchStats(){const order=finalOrder();return states.map(state=>({score:state.score,lines:state.lines,tetrisCount:state.tetrisCount,garbageSent:state.garbageSent,garbageReceived:state.garbageReceived,koTime:state.koTime,placement:state.placement||order.indexOf(state.id)+1}));}
  function destroy(){destroyed=true;aiEpoch++;aiPending.clear();aiTimers.forEach(timer=>clearTimeout(timer));aiTimers.clear();clearInterval(gameTimer);if(relayTimer)clearInterval(relayTimer);if(document.removeEventListener)document.removeEventListener('keydown',handleKey);area.style.touchAction=previousTouchAction;area.style.overscrollBehavior=previousOverscroll;}
  resetLocal();
  return{reset,onMove:opts.onMove,onRestart:resetLocal,destroy,snapshot,onRestore,
    serialize:()=>({state:snapshot(),presentation:{cosmetic},stats:getMatchStats()}),getMatchStats,setCosmetic,renderCosmetic:setCosmetic,setSpectators,setObservedPlayer,setControlledPlayer,
    getTarget:targetFor,queueGarbage,finishMatch,emitHostSync,whenIdle:()=>Promise.resolve(),getMultiplayerRequirement:()=>opts.online?'TETRIS_BATTLE_PROTOCOL_V1':null,
  };
}
