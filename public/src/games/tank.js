/* ================= 坦克大战 · Real-Time Arena ================= */
function gameTank(area, extra, n, opts){
  opts = opts || {};
  const playerCount = Math.max(2, Math.min(5, Number(n) || 2));
  const W = playerCount > 4 ? 17 : 15, H = 13;
  const FIXED_MS = 50, MATCH_MS = Math.max(10000, Number(opts.matchDurationMs) || 180000);
  const RELAY_PROTOCOL = 'tank-host-relay-v1', HOST_PLAYER = 0;
  const AUTH_PROTOCOL = 'tank-authority-v1';
  const authorityMode = !!(opts.online && opts.gameplayMeta && opts.gameplayMeta.protocol === AUTH_PROTOCOL && typeof opts.sendTankInput === 'function');
  const RELAY_SNAPSHOT_MS = Math.max(200, Math.min(1000, Number(opts.relaySnapshotMs) || 400));
  const DIRS = [[0,-1],[1,0],[0,1],[-1,0]]; // 上右下左
  const SPAWNS = [[1.5,1.5],[W-2.5,H-2.5],[W-2.5,1.5],[1.5,H-2.5],[Math.floor(W/2)+.5,Math.floor(H/2)+.5]];
  const SEASONS = ['spring','summer','autumn','winter'];
  const seasonLabel=value=>t('tank_season_'+value);
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none'; area.style.overscrollBehavior = 'contain';

  let grid = [], tanks = [], bullets = [], traces = [], effects = [];
  let over = false, winner = -1, cur = 0, destroyed = false;
  let startedAt = Date.now(), finishedAt = 0, remainingMs = MATCH_MS, lastLoopAt = Date.now(), accumulator = 0;
  let bulletSequence = 0, inputSequence = 0, authoritySequence = 0, lastAuthoritySequence = -1, aiEpoch = 0;
  let lastInputSequence = Array(playerCount).fill(-1), relayMatchId = '', resultCommitted = false, lastRelayAt = 0;
  let spectator = !!opts.spectator;
  let authorityServerTick = 0, authorityEndAt = 0;
  let season = chooseSeason(matchSeed());
  let cosmetic = { default:'classic', players:{}, ...(opts.cosmetic || {}) };
  let lastRenderAt = 0;
  const performanceStats={samples:0,lastFrameMs:0,maxFrameMs:0,longFrames:0};
  const transientTimers=new Set();
  const renderObjectIds=new WeakMap();
  let nextRenderObjectId=0,lastPlayersSignature='',lastStatusText='',victoryShown=false;
  const renderNodes={board:null,staticCells:new Map(),traces:new Map(),bullets:new Map(),tanks:new Map(),respawns:new Map(),effects:new Map(),time:null,scores:[]};

  function clearTransientTimers(){transientTimers.forEach(timer=>clearTimeout(timer));transientTimers.clear();}
  function scheduleTransient(callback,delay){
    const timer=setTimeout(()=>{transientTimers.delete(timer);if(!destroyed)callback();},delay);
    if(timer&&typeof timer.unref==='function')timer.unref();transientTimers.add(timer);return timer;
  }
  function renderObjectKey(value,prefix){
    if(!value||typeof value!=='object')return prefix+'-none';
    if(!renderObjectIds.has(value))renderObjectIds.set(value,prefix+'-'+(++nextRenderObjectId));
    return renderObjectIds.get(value);
  }
  function removeRenderNode(node){if(node&&typeof node.remove==='function')node.remove();}
  function syncRenderMap(map,items,keyFor,create,update){
    const active=new Set();
    items.forEach((item,index)=>{const key=keyFor(item,index);active.add(key);let node=map.get(key);if(!node){node=create(item,index);map.set(key,node);}update(node,item,index);});
    for(const [key,node] of map)if(!active.has(key)){removeRenderNode(node);map.delete(key);}
  }
  function removeVictoryOverlay(){const overlay=area.querySelector&&area.querySelector('.victory-overlay');if(overlay)removeRenderNode(overlay);victoryShown=false;}

  function currentMatchId(){
    const dynamic = typeof opts.getMatchId === 'function' ? opts.getMatchId() : null;
    if (dynamic) return String(dynamic);
    if (opts.matchId) return String(opts.matchId);
    if (typeof online !== 'undefined' && online && online.matchId) return String(online.matchId);
    return '';
  }
  function matchSeed(){ return currentMatchId(); }

  function chooseSeason(seed){
    if (!seed) return SEASONS[Math.floor(Math.random() * SEASONS.length) % SEASONS.length];
    let hash = 0; for (let i = 0; i < String(seed).length; i++) hash = ((hash * 31) + String(seed).charCodeAt(i)) >>> 0;
    return SEASONS[hash % SEASONS.length];
  }
  function emptyInput(){ return { up:false, right:false, down:false, left:false, fire:false }; }
  function normalizeInput(value){
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const input = emptyInput();
    Object.keys(input).forEach(key => { input[key] = source[key] === true; });
    if (input.up && input.down){ input.up = false; input.down = false; }
    if (input.left && input.right){ input.left = false; input.right = false; }
    return input;
  }
  function resetRelayState(){
    relayMatchId = currentMatchId();
    inputSequence = 0; authoritySequence = 0; lastAuthoritySequence = -1;
    lastInputSequence = Array(playerCount).fill(-1); resultCommitted = false; lastRelayAt = 0;
  }
  function buildMap(){
    grid = Array.from({length:H}, () => Array(W).fill(0));
    for (let c = 0; c < W; c++){ grid[0][c] = 3; grid[H-1][c] = 3; }
    for (let r = 0; r < H; r++){ grid[r][0] = 3; grid[r][W-1] = 3; }
    const bricks = [
      [3,3],[3,4],[4,3],[H-4,W-4],[H-4,W-5],[H-5,W-4],
      [2,Math.floor(W/2)],[H-3,Math.floor(W/2)],[Math.floor(H/2),2],[Math.floor(H/2),W-3],
      [5,Math.floor(W/2)-1],[5,Math.floor(W/2)],[5,Math.floor(W/2)+1],
      [7,Math.floor(W/2)-1],[7,Math.floor(W/2)],[7,Math.floor(W/2)+1],
    ];
    bricks.forEach(([r,c]) => { if (r > 0 && r < H-1 && c > 0 && c < W-1) grid[r][c] = 2; });
  }
  function createTank(id){
    const spawn = SPAWNS[id % SPAWNS.length];
    return {
      id, x:spawn[0], y:spawn[1], d:id % 2 ? 3 : 1, hp:3, alive:true,
      respawnAt:0, invulnerableUntil:startedAt + 1200, fireReadyAt:0, input:emptyInput(),
      kills:0, deaths:0, damage:0, shots:0, hits:0, placement:0,
    };
  }
  function resetLocal(){
    aiEpoch++; aiPending.clear(); clearTransientTimers(); removeVictoryOverlay(); lastPlayersSignature='';lastStatusText='';buildMap();
    startedAt = Date.now(); finishedAt = 0; remainingMs = MATCH_MS; lastLoopAt = startedAt; accumulator = 0;
    tanks = Array.from({length:playerCount}, (_, i) => createTank(i));
    bullets = []; traces = []; effects = []; over = false; winner = -1; cur = 0; bulletSequence = 0; destroyed = false;
    resetRelayState();
    authorityServerTick = 0;
    authorityEndAt = authorityMode && opts.gameplayMeta ? Number(opts.gameplayMeta.endAt) || 0 : 0;
    season = chooseSeason(matchSeed());
    render(); updateStatus();
  }
  function controlledPlayer(){ return opts.online ? Math.max(0, Number(opts.myIdx) || 0) : 0; }
  function canControl(){ return !destroyed && !spectator && !over && !(opts.isReplaying && opts.isReplaying()); }
  function isBlocked(x, y, ignoreId){
    const radius = .31;
    for (const [px,py] of [[x-radius,y-radius],[x+radius,y-radius],[x-radius,y+radius],[x+radius,y+radius]]){
      const r = Math.floor(py), c = Math.floor(px);
      if (!grid[r] || grid[r][c] === 2 || grid[r][c] === 3) return true;
    }
    return tanks.some(t => t.id !== ignoreId && t.alive && Math.hypot(t.x-x,t.y-y) < .65);
  }
  function moveTank(tank, dx, dy, dt){
    if (!tank || !tank.alive) return;
    if (dx || dy){
      if (Math.abs(dx) >= Math.abs(dy)) tank.d = dx > 0 ? 1 : 3;
      else tank.d = dy > 0 ? 2 : 0;
      const length = Math.hypot(dx,dy) || 1, speed = 2.65;
      const nx = tank.x + dx / length * speed * dt;
      const ny = tank.y + dy / length * speed * dt;
      if (!isBlocked(nx,tank.y,tank.id)) tank.x = nx;
      if (!isBlocked(tank.x,ny,tank.id)) tank.y = ny;
      if (!traces.length || Date.now() - traces[traces.length-1].at > 90){
        traces.push({ x:tank.x, y:tank.y, at:Date.now(), type:'track', owner:tank.id });
        if (traces.length > 60) traces.splice(0, traces.length - 60);
      }
    }
  }
  function fireTank(tank){
    const now = Date.now();
    if (!tank || !tank.alive || now < tank.fireReadyAt) return false;
    tank.fireReadyAt = now + 420; tank.shots++;
    const d = DIRS[tank.d];
    bullets.push({ id:++bulletSequence, owner:tank.id, x:tank.x+d[0]*.55, y:tank.y+d[1]*.55, d:tank.d, ttl:2600 });
    effects.push({ x:tank.x+d[0]*.5, y:tank.y+d[1]*.5, type:'muzzle', at:now, ttl:140 });
    if (effects.length > 40) effects.splice(0, effects.length - 40);
    playFeedback('shoot');
    return true;
  }
  function damageTank(target, owner, amount){
    const now = Date.now();
    if (!target.alive || now < target.invulnerableUntil) return false;
    target.hp -= amount;
    const shooter = tanks[owner];
    if (shooter){ shooter.damage += amount; shooter.hits++; }
    effects.push({ x:target.x, y:target.y, type:'impact', at:now, ttl:360 });
    if (target.hp <= 0){
      target.alive = false; target.deaths++; target.respawnAt = now + 2000; target.input = emptyInput();
      if (shooter && shooter.id !== target.id) shooter.kills++;
      effects.push({ x:target.x, y:target.y, type:'explosion', at:now, ttl:850 });
      traces.push({ x:target.x, y:target.y, at:now, type:'scorch', owner:target.id });
      playFeedback('capture');
    }
    return true;
  }
  function safestSpawn(tank){
    const candidates = SPAWNS.slice(0, playerCount);
    return candidates.slice().sort((a,b) => {
      const da = Math.min(...tanks.filter(t => t.alive && t.id !== tank.id).map(t => Math.hypot(t.x-a[0],t.y-a[1])).concat([99]));
      const db = Math.min(...tanks.filter(t => t.alive && t.id !== tank.id).map(t => Math.hypot(t.x-b[0],t.y-b[1])).concat([99]));
      return db-da;
    })[0] || SPAWNS[tank.id % SPAWNS.length];
  }
  function respawn(tank, now){
    const spawn = safestSpawn(tank);
    tank.x = spawn[0]; tank.y = spawn[1]; tank.d = tank.id % 2 ? 3 : 1; tank.hp = 3;
    tank.alive = true; tank.respawnAt = 0; tank.invulnerableUntil = now + 1500; tank.input = emptyInput();
    effects.push({ x:tank.x, y:tank.y, type:'respawn', at:now, ttl:600 });
  }
  function fixedUpdate(dt){
    if (over) return;
    const now = Date.now();
    if (authorityMode){
      remainingMs=Math.max(0,(authorityEndAt||now+remainingMs)-now);
      const local=tanks[controlledPlayer()];
      if(local&&local.alive){const input=local.input||emptyInput();moveTank(local,(input.right?1:0)-(input.left?1:0),(input.down?1:0)-(input.up?1:0),dt);}
      traces=traces.filter(item=>now-item.at<(item.type==='scorch'?7000:1600)).slice(-60);
      effects=effects.filter(item=>now-item.at<item.ttl).slice(-40);
      return;
    }
    remainingMs = Math.max(0, MATCH_MS - (now - startedAt));
    tanks.forEach(tank => {
      if (!tank.alive){ if (tank.respawnAt && now >= tank.respawnAt && remainingMs > 0) respawn(tank, now); return; }
      const input = tank.input || emptyInput();
      moveTank(tank, (input.right?1:0)-(input.left?1:0), (input.down?1:0)-(input.up?1:0), dt);
      if (input.fire) fireTank(tank);
    });
    const nextBullets = [];
    bullets.forEach(bullet => {
      const d = DIRS[bullet.d];
      bullet.x += d[0] * 8.2 * dt; bullet.y += d[1] * 8.2 * dt; bullet.ttl -= dt*1000;
      const r = Math.floor(bullet.y), c = Math.floor(bullet.x), cell = grid[r] && grid[r][c];
      if (bullet.ttl <= 0 || cell === 3) return;
      if (cell === 2){
        grid[r][c] = 0; effects.push({ x:bullet.x, y:bullet.y, type:'impact', at:now, ttl:320 });
        traces.push({ x:bullet.x, y:bullet.y, at:now, type:'scorch', owner:bullet.owner }); return;
      }
      const hit = tanks.find(t => t.id !== bullet.owner && t.alive && Math.hypot(t.x-bullet.x,t.y-bullet.y) < .46);
      if (hit){ damageTank(hit, bullet.owner, 1); return; }
      nextBullets.push(bullet);
    });
    bullets = nextBullets;
    traces = traces.filter(item => now - item.at < (item.type === 'scorch' ? 7000 : 1600)).slice(-60);
    effects = effects.filter(item => now - item.at < item.ttl).slice(-40);
    // 联机客端只做预测显示，最终计时与排名必须等待房主快照；人机模拟行为保持不变。
    if (remainingMs <= 0 && (!opts.online || opts.isHost)) finishMatch();
  }
  function ranking(){
    return tanks.map(t => t.id).sort((a,b) =>
      tanks[b].kills - tanks[a].kills || tanks[a].deaths - tanks[b].deaths || tanks[b].damage - tanks[a].damage || a-b);
  }
  function validOrder(value){
    return Array.isArray(value) && value.length === playerCount &&
      value.every(id => Number.isInteger(id) && id >= 0 && id < playerCount) && new Set(value).size === playerCount;
  }
  function resultsForOrder(order){
    return order.map((id,index) => ({ slot:id, rank:index+1, coins:index===0?1:0 }));
  }
  function commitFinal(order, broadcastFinal){
    if (resultCommitted || !validOrder(order)) return false;
    over = true; finishedAt = Date.now(); remainingMs = 0; winner = order[0];
    order.forEach((id, index) => tanks[id].placement = index + 1);
    resultCommitted = true;
    if (broadcastFinal) broadcastAuthoritativeState(order);
    if (opts.onEnd) opts.onEnd(resultsForOrder(order));
    render(); setStatus(t('tank_win_status',winner+1,tanks[winner].kills), true);
    return true;
  }
  function finishMatch(){
    if (authorityMode) return false;
    // 休闲联机采用房主客户端权威；服务端仍只是附带可信 player 的房间中继。
    if (opts.online && !opts.isHost) return false;
    return commitFinal(ranking(), !!opts.online);
  }
  function loop(){
    if (destroyed) return;
    const now = Date.now(), elapsed = Math.min(250, Math.max(0, now - lastLoopAt));
    performanceStats.samples++;performanceStats.lastFrameMs=elapsed;performanceStats.maxFrameMs=Math.max(performanceStats.maxFrameMs,elapsed);if(elapsed>50)performanceStats.longFrames++;
    lastLoopAt = now; accumulator += elapsed;
    while (accumulator >= FIXED_MS){ fixedUpdate(FIXED_MS/1000); accumulator -= FIXED_MS; }
    if (opts.online && !authorityMode && opts.isHost && !over && now - lastRelayAt >= RELAY_SNAPSHOT_MS) broadcastAuthoritativeState();
    if (now - lastRenderAt >= 80){ render(); lastRenderAt = now; }
  }
  const simulationTimer = setInterval(loop, FIXED_MS);
  if (simulationTimer && typeof simulationTimer.unref === 'function') simulationTimer.unref();

  function relayActionPayload(value){
    return {
      ...(value || {}), protocol:RELAY_PROTOCOL, matchId:currentMatchId(), seq:++inputSequence,
    };
  }
  function sendRelayAction(value){
    if(authorityMode){
      const input=value&&value.input?normalizeInput(value.input):normalizeInput(keyboardInput);
      opts.sendTankInput({seq:++inputSequence,clientTick:authorityServerTick,input});
      return true;
    }
    if (!opts.online || typeof opts.sendMove !== 'function') return false;
    opts.sendMove(relayActionPayload(value));
    return true;
  }
  function setPlayerInput(pi, value, shouldSend){
    const tank = tanks[pi]; if (!tank || !tank.alive) return false;
    tank.input = normalizeInput(value);
    if (shouldSend) sendRelayAction({ act:'input', input:{...tank.input} });
    return true;
  }
  function pulseMove(pi, d, shouldSend){
    if (!Number.isInteger(d) || d < 0 || d > 3) return false;
    const input = emptyInput(); input[['up','right','down','left'][d]] = true;
    setPlayerInput(pi,input,shouldSend);
    scheduleTransient(() => { if (tanks[pi]) tanks[pi].input = emptyInput(); }, 180);
    return true;
  }
  function localInputChanged(){
    const pi = controlledPlayer();
    if (!canControl() || !tanks[pi] || (opts.ai && opts.ai.has(pi))) return;
    setPlayerInput(pi, keyboardInput, true);
    if (opts.onProgress) opts.onProgress({ act:'input', input:{...keyboardInput} });
  }
  function localShoot(){
    if (!canControl()) return false;
    if(authorityMode){
      keyboardInput.fire=true;localInputChanged();
      scheduleTransient(()=>{keyboardInput.fire=false;localInputChanged();},90);
      return true;
    }
    const fired = fireTank(tanks[controlledPlayer()]);
    if (!fired) return false;
    if (opts.onProgress) opts.onProgress({act:'shoot'});
    sendRelayAction({act:'shoot'});
    return true;
  }
  const keyboardInput = emptyInput();
  function handleKey(e, pressed){
    const map = { w:'up',W:'up',ArrowUp:'up', d:'right',D:'right',ArrowRight:'right', s:'down',S:'down',ArrowDown:'down', a:'left',A:'left',ArrowLeft:'left' };
    if (map[e.key]){
      if (canControl() && e.preventDefault) e.preventDefault();
      if (keyboardInput[map[e.key]] === pressed) return;
      keyboardInput[map[e.key]] = pressed; localInputChanged(); return;
    }
    if (e.key === ' ' || e.key === 'Spacebar'){
      if (canControl() && e.preventDefault) e.preventDefault();
      keyboardInput.fire = pressed; localInputChanged();
    }
  }
  const keyDown = e => handleKey(e,true), keyUp = e => handleKey(e,false);
  if (document.addEventListener){ document.addEventListener('keydown',keyDown); document.addEventListener('keyup',keyUp); }

  extra.innerHTML = '';
  const hud = el('div','tank-arena-hud');
  const controls = el('div','tank-realtime-controls');
  const joystick = el('div','tank-joystick','●');
  joystick.style.cssText = 'width:104px;height:104px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,rgba(255,255,255,.22),rgba(15,23,42,.66));color:#fff;font-size:38px;touch-action:none;user-select:none;';
  const fireBtn = el('button','btn btn-primary tank-fire',t('tank_fire'));
  controls.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:28px;margin-top:8px;touch-action:none;';
  fireBtn.style.cssText = 'width:92px;height:92px;border-radius:50%;font-weight:900;';
  controls.appendChild(joystick); controls.appendChild(fireBtn); extra.appendChild(hud); extra.appendChild(controls);
  function joystickInput(event){
    if (!canControl()) return;
    const rect = joystick.getBoundingClientRect();
    const x = Number(event.clientX) - rect.left - rect.width/2, y = Number(event.clientY) - rect.top - rect.height/2;
    const input = emptyInput();
    if (Math.hypot(x,y) > 12){ if (Math.abs(x) > Math.abs(y)) input[x>0?'right':'left'] = true; else input[y>0?'down':'up'] = true; }
    Object.assign(keyboardInput,input); localInputChanged();
  }
  const clearJoystick = () => { Object.assign(keyboardInput,emptyInput()); localInputChanged(); };
  joystick.addEventListener('pointerdown',joystickInput); joystick.addEventListener('pointermove',e => { if (e.buttons) joystickInput(e); });
  joystick.addEventListener('pointerup',clearJoystick); joystick.addEventListener('pointercancel',clearJoystick);
  fireBtn.addEventListener('pointerdown',e => { if (e.preventDefault) e.preventDefault(); keyboardInput.fire = true; localInputChanged(); });
  fireBtn.addEventListener('pointerup',() => { keyboardInput.fire = false; localInputChanged(); });
  fireBtn.addEventListener('click',localShoot);

  /* Influence-map kiting：借鉴 AIIDE《Kiting in RTS Games Using Influence Maps》的
     “先避开高威胁区，再沿安全梯度取得射界”思路；这里只输出既合法又近优的动作。 */
  const AI_BULLET_SPEED = 8.2, AI_DANGER_HORIZON = 1.5, AI_MOVE_LOOKAHEAD = .58;
  function tankAIClamp(value,min,max){
    const number = Number(value);
    return Math.max(min,Math.min(max,Number.isFinite(number)?number:0));
  }
  function tankAIWallBetween(x1,y1,x2,y2){
    const distance = Math.hypot(x2-x1,y2-y1);
    if (distance < .72) return false;
    const dx=(x2-x1)/distance,dy=(y2-y1)/distance;
    for(let step=.42;step<distance-.34;step+=.2){
      const r=Math.floor(y1+dy*step),c=Math.floor(x1+dx*step);
      if(!grid[r]||grid[r][c]===2||grid[r][c]===3)return true;
    }
    return false;
  }
  function tankAIFireLine(from,target){
    if(!from||!target)return null;
    const vertical=Math.abs(from.x-target.x)<.44,horizontal=Math.abs(from.y-target.y)<.44;
    if(!vertical&&!horizontal)return null;
    const direction=vertical?(target.y<from.y?0:2):(target.x>from.x?1:3);
    const distance=vertical?Math.abs(target.y-from.y):Math.abs(target.x-from.x);
    if(distance<.7||tankAIWallBetween(from.x,from.y,target.x,target.y))return null;
    const blocked=tanks.some(t=>{
      if(!t.alive||t.id===from.id||t.id===target.id)return false;
      if(vertical&&Math.abs(t.x-from.x)<.48){
        return (t.y-from.y)*(target.y-from.y)>0&&Math.abs(t.y-from.y)<distance-.35;
      }
      if(horizontal&&Math.abs(t.y-from.y)<.48){
        return (t.x-from.x)*(target.x-from.x)>0&&Math.abs(t.x-from.x)<distance-.35;
      }
      return false;
    });
    return blocked?null:{direction,distance};
  }
  function tankAIProjectileApproach(bullet,x,y){
    if(!bullet||!DIRS[bullet.d])return null;
    const vector=DIRS[bullet.d],rx=x-bullet.x,ry=y-bullet.y;
    const along=rx*vector[0]+ry*vector[1],cross=Math.abs(rx*vector[1]-ry*vector[0]);
    const lifetime=Math.max(0,Math.min(AI_DANGER_HORIZON,(Number(bullet.ttl)||0)/1000));
    if(along<-.2||along>AI_BULLET_SPEED*lifetime+.45||cross>.78)return null;
    const rayX=bullet.x+vector[0]*Math.max(0,along),rayY=bullet.y+vector[1]*Math.max(0,along);
    if(tankAIWallBetween(bullet.x,bullet.y,rayX,rayY))return null;
    const eta=Math.max(0,along)/AI_BULLET_SPEED;
    const lane=tankAIClamp(1-cross/.78,0,1),imminence=tankAIClamp(1-eta/AI_DANGER_HORIZON,0,1);
    return {bullet,eta,cross,value:lane*imminence};
  }
  function tankAIBulletThreat(x,y,meId,ownerId){
    let value=0,urgent=null;
    bullets.forEach(bullet=>{
      if(bullet.owner===meId||(Number.isInteger(ownerId)&&bullet.owner!==ownerId))return;
      const approach=tankAIProjectileApproach(bullet,x,y);
      if(approach&&approach.value>value){value=approach.value;urgent=approach;}
    });
    return {value:tankAIClamp(value,0,1),urgent};
  }
  function tankAITargetInfo(me,target){
    const distance=Math.hypot(target.x-me.x,target.y-me.y),line=tankAIFireLine(target,me);
    const aimed=!!(line&&target.d===line.direction),projectile=tankAIBulletThreat(me.x,me.y,me.id,target.id).value;
    const proximity=tankAIClamp(1-distance/9,0,1);
    const threat=tankAIClamp((aimed ? .42 : line ? .18 : 0)+projectile*.38+proximity*.18+
      tankAIClamp(target.kills/5,0,1)*.16+tankAIClamp(target.damage/12,0,1)*.1,0,1);
    const lowHealth=tankAIClamp((4-Math.max(1,target.hp))/3,0,1);
    const protectedNow=Date.now()<target.invulnerableUntil;
    const opportunity=tankAIFireLine(me,target) ? .12 : 0;
    const priority=tankAIClamp(lowHealth*.5+threat*.38+proximity*.12+opportunity-(protectedNow ? .35 : 0),0,1);
    return {target,distance,threat,priority,lowHealth,protectedNow};
  }
  function tankAISelectTarget(me){
    return tanks.filter(t=>t.id!==me.id&&t.alive).map(t=>tankAITargetInfo(me,t)).sort((a,b)=>
      b.priority-a.priority||b.threat-a.threat||a.target.hp-b.target.hp||a.distance-b.distance||a.target.id-b.target.id)[0]||null;
  }
  function tankAICellPassable(r,c,meId){
    if(r<1||r>=H-1||c<1||c>=W-1||!grid[r]||grid[r][c]!==0)return false;
    return !tanks.some(t=>t.id!==meId&&t.alive&&Math.abs(t.x-(c+.5))<.62&&Math.abs(t.y-(r+.5))<.62);
  }
  function tankAICoverAt(x,y,me){
    const r=Math.floor(y),c=Math.floor(x);
    let adjacent=0,blockedLane=0,relevantLanes=0;
    DIRS.forEach(([dx,dy])=>{const row=r+dy,col=c+dx;if(!grid[row]||grid[row][col]===2||grid[row][col]===3)adjacent++;});
    tanks.forEach(enemy=>{
      if(enemy.id===me.id||!enemy.alive)return;
      if(Math.abs(enemy.x-x)<.44||Math.abs(enemy.y-y)<.44){
        relevantLanes++;
        if(tankAIWallBetween(enemy.x,enemy.y,x,y))blockedLane++;
      }
    });
    return tankAIClamp(adjacent*.18+(relevantLanes?blockedLane/relevantLanes*.48:0),0,1);
  }
  function tankAIBuildInfluence(me){
    // 敌人、未来弹道、障碍邻接和边界共同构成危险势场；墙本身为不可达极值。
    return Array.from({length:H},(_,r)=>Array.from({length:W},(_,c)=>{
      if(!tankAICellPassable(r,c,me.id)&&!(r===Math.floor(me.y)&&c===Math.floor(me.x))){
        return {danger:1,projectile:0,cover:0,boundary:1};
      }
      const x=c+.5,y=r+.5,projectile=tankAIBulletThreat(x,y,me.id).value;
      let enemyInfluence=0;
      tanks.forEach(enemy=>{
        if(enemy.id===me.id||!enemy.alive)return;
        const distance=Math.hypot(enemy.x-x,enemy.y-y),line=tankAIFireLine(enemy,{id:me.id,x,y});
        enemyInfluence+=tankAIClamp(1-distance/7,0,1)*.2;
        if(line)enemyInfluence+=enemy.d===line.direction ? .48 : .2;
      });
      const edge=Math.min(c-1,W-2-c,r-1,H-2-r);
      const boundary=tankAIClamp((1.35-edge)/1.35,0,1);
      const cover=tankAICoverAt(x,y,me);
      const danger=tankAIClamp(projectile+enemyInfluence+boundary*.22+cover*.04,0,1);
      return {danger,projectile,cover,boundary};
    }));
  }
  function tankAIFireDistance(me,target,influence){
    const distance=Array.from({length:H},()=>Array(W).fill(Infinity)),queue=[];
    if(!target)return distance;
    for(let r=1;r<H-1;r++)for(let c=1;c<W-1;c++){
      if(!tankAICellPassable(r,c,me.id)||influence[r][c].danger>.94)continue;
      const line=tankAIFireLine({id:me.id,x:c+.5,y:r+.5},target);
      if(!line||line.distance<1.35)continue;
      distance[r][c]=0;queue.push([r,c]);
    }
    for(let head=0;head<queue.length;head++){
      const [r,c]=queue[head],nextDistance=distance[r][c]+1;
      DIRS.forEach(([dx,dy])=>{
        const nr=r+dy,nc=c+dx;
        if(tankAICellPassable(nr,nc,me.id)&&nextDistance<distance[nr][nc]){
          distance[nr][nc]=nextDistance;queue.push([nr,nc]);
        }
      });
    }
    return distance;
  }
  function tankAIPersonaBonus(item){
    const id=opts.aiPersona&&opts.aiPersona.id,features=item.features;
    if(id==='gambler')return (item.choice==='shoot'?5:0)+features.line_of_sight*2-features.cover;
    if(id==='mean')return (item.choice==='shoot'?3:0)+features.target_priority*3;
    if(id==='cute')return features.dodge*3+features.cover*2;
    if(id==='tsundere')return features.line_of_sight*2+features.path_progress;
    return 0;
  }
  function tankAIPlan(pi){
    const me=tanks[pi];
    if(!me||!me.alive)return null;
    const targetInfo=tankAISelectTarget(me),target=targetInfo&&targetInfo.target;
    const influence=tankAIBuildInfluence(me),fireDistance=tankAIFireDistance(me,target,influence);
    const currentCell=[Math.floor(me.y),Math.floor(me.x)],currentMap=influence[currentCell[0]][currentCell[1]]||{danger:1,cover:0};
    const currentBullet=tankAIBulletThreat(me.x,me.y,me.id),urgent=currentBullet.urgent;
    const currentFireDistance=fireDistance[currentCell[0]][currentCell[1]],ranked=[];
    DIRS.forEach(([dx,dy],direction)=>{
      const x=me.x+dx*AI_MOVE_LOOKAHEAD,y=me.y+dy*AI_MOVE_LOOKAHEAD;
      if(isBlocked(x,y,me.id))return;
      const r=Math.floor(y),c=Math.floor(x),map=influence[r]&&influence[r][c]||{danger:1,cover:0,boundary:1};
      const projectile=tankAIBulletThreat(x,y,me.id).value,danger=Math.max(map.danger,projectile);
      const line=target&&tankAIFireLine({id:me.id,x,y},target),aimed=!!(line&&line.direction===direction);
      const nextFireDistance=fireDistance[r]&&fireDistance[r][c];
      let pathProgress=0;
      if(Number.isFinite(currentFireDistance)&&Number.isFinite(nextFireDistance))pathProgress=tankAIClamp((currentFireDistance-nextFireDistance)/2,-1,1);
      else if(!Number.isFinite(currentFireDistance)&&Number.isFinite(nextFireDistance))pathProgress=1;
      else if(Number.isFinite(currentFireDistance)&&!Number.isFinite(nextFireDistance))pathProgress=-1;
      let dodge=0;
      if(urgent){
        const perpendicular=(urgent.bullet.d%2)!==(direction%2),reduction=currentBullet.value-projectile;
        dodge=tankAIClamp((perpendicular ? .55 : -.45)+reduction*1.15,-1,1);
      }
      const targetDistance=target?Math.hypot(target.x-x,target.y-y):8;
      const kite=tankAIClamp(1-Math.abs(targetDistance-4.5)/4.5,-1,1);
      const features={
        threat:tankAIClamp(danger,0,1),line_of_sight:aimed ? 1 : line ? .45 : 0,dodge,
        path_progress:pathProgress,cover:tankAIClamp(map.cover,0,1),
        target_priority:targetInfo?tankAIClamp(targetInfo.priority,0,1):0,
        boundary_safety:tankAIClamp(1-(map.boundary||0),0,1),kite_distance:kite,quality:0,
      };
      let score=dodge*220-danger*175+pathProgress*86+features.cover*24+features.boundary_safety*18+kite*16;
      if(aimed)score+=118+(targetInfo?targetInfo.priority*38:0);
      if(targetDistance<1.7)score-=55;
      ranked.push({choice:'move:'+direction,score,features});
    });
    const shotTargets=tanks.filter(t=>t.id!==me.id&&t.alive).map(t=>{
      const line=tankAIFireLine(me,t),info=tankAITargetInfo(me,t);
      return line&&line.direction===me.d?{target:t,line,info}:null;
    }).filter(Boolean).sort((a,b)=>b.info.priority-a.info.priority||a.target.hp-b.target.hp||a.line.distance-b.line.distance||a.target.id-b.target.id);
    const shotTarget=shotTargets[0],fireReady=Date.now()>=me.fireReadyAt;
    const shotFeatures={
      threat:tankAIClamp(currentMap.danger,0,1),line_of_sight:shotTarget?1:0,
      dodge:urgent?tankAIClamp(-.55-currentBullet.value*.45,-1,0):0,path_progress:0,
      cover:tankAIClamp(currentMap.cover,0,1),target_priority:shotTarget?tankAIClamp(shotTarget.info.priority,0,1):(targetInfo?tankAIClamp(targetInfo.priority,0,1):0),
      boundary_safety:tankAIClamp(1-(currentMap.boundary||0),0,1),fire_ready:fireReady?1:-1,quality:0,
    };
    let shotScore=-currentMap.danger*170+shotFeatures.cover*14;
    if(shotTarget&&fireReady)shotScore+=285+shotTarget.info.priority*70+shotTarget.info.lowHealth*70;
    else if(!fireReady)shotScore-=150;
    else shotScore-=72;
    if(urgent)shotScore-=currentBullet.value*230;
    ranked.push({choice:'shoot',score:shotScore,features:shotFeatures});
    ranked.sort((a,b)=>b.score-a.score||a.choice.localeCompare(b.choice));
    const best=ranked[0],band=Math.max(16,Math.min(42,Math.abs(best.score)*.1+10));
    const near=ranked.filter(item=>item.score>=best.score-band).slice(0,4);
    near.forEach(item=>{item.features.quality=tankAIClamp(1-(best.score-item.score)/Math.max(1,band),-1,1);});
    near.sort((a,b)=>(b.score+tankAIPersonaBonus(b))-(a.score+tankAIPersonaBonus(a))||a.choice.localeCompare(b.choice));
    return {me,targetInfo,influence,currentDanger:currentMap.danger,urgent,best,near};
  }

  const aiPending = new Set(),aiThinkGate=new Map();
  async function scheduleAIPlayer(pi){
    if (destroyed || over || aiPending.has(pi) || !opts.ai || !opts.ai.has(pi) || !tanks[pi] || !tanks[pi].alive) return;
    const gate=aiThinkGate.get(pi),now=Date.now();
    if(gate&&gate.epoch===aiEpoch&&now<gate.readyAt)return;
    // 正常 650ms 调度不受影响；同时避免后台/测试的压缩计时器造成高频重复寻路。
    aiThinkGate.set(pi,{epoch:aiEpoch,readyAt:now+400});
    const plan=tankAIPlan(pi);
    if(!plan||!plan.near.length)return;
    aiPending.add(pi); const epoch = aiEpoch,plannedAt=Date.now();
    const choices=plan.near.map(item=>item.choice);
    const learningCandidates=plan.near.map(item=>({choice:item.choice,features:{...item.features}}));
    const remote = await aiChoose('tank', {
      season, remainingMs, player:pi,
      tanks:tanks.map(t => ({id:t.id,x:+t.x.toFixed(2),y:+t.y.toFixed(2),d:t.d,hp:t.hp,alive:t.alive,kills:t.kills,damage:t.damage})),
      bullets:bullets.map(b=>({owner:b.owner,x:+b.x.toFixed(2),y:+b.y.toFixed(2),d:b.d,ttl:Math.round(b.ttl)})),
      grid:grid.map(row => row.join('')),
      target:plan.targetInfo?{id:plan.targetInfo.target.id,priority:+plan.targetInfo.priority.toFixed(3),threat:+plan.targetInfo.threat.toFixed(3)}:null,
      localRanking:plan.near.map(item=>({choice:item.choice,score:+item.score.toFixed(2)})),
    }, choices, opts.aiPersona, learningCandidates);
    if (destroyed || over || epoch !== aiEpoch || !tanks[pi] || !tanks[pi].alive){ aiPending.delete(pi); return; }
    // 实时局面在模型等待期间仍会变化：旧选择必须在新影响图中仍属近优，否则立即重规划。
    const livePlan=Date.now()-plannedAt>120?tankAIPlan(pi):plan;
    const liveChoices=livePlan?livePlan.near.map(item=>item.choice):[];
    // Persona/模型只能在近优带内微调；无网、超时或非法返回始终执行固定的本地最优。
    const choice = choices.includes(remote)&&liveChoices.includes(remote) ? remote : (livePlan?livePlan.best.choice:plan.best.choice);
    aiPending.delete(pi);
    const actor=tanks[pi];
    if (choice === 'shoot'){
      if (authorityMode && typeof opts.sendBotTankInput === 'function') { opts.sendBotTankInput(pi, { input:{ fire:true, direction:actor.d }, clientTick:authorityServerTick }); aiPending.delete(pi); return; }
      if(fireTank(actor)&&opts.onProgress)opts.onProgress({act:'shoot'});
    } else {
      const direction = Number(choice.slice(-1));
      if (authorityMode && typeof opts.sendBotTankInput === 'function') { opts.sendBotTankInput(pi, { input:{ up:direction===0, right:direction===1, down:direction===2, left:direction===3 }, clientTick:authorityServerTick }); aiPending.delete(pi); return; }
      if (opts.onProgress) opts.onProgress({act:'move',d:direction});
      pulseMove(pi,direction,false);
    }
  }
  const aiTimer = setInterval(() => { if (opts.ai) opts.ai.forEach(pi => scheduleAIPlayer(pi)); }, 650);
  if (aiTimer && typeof aiTimer.unref === 'function') aiTimer.unref();

  function seasonBackground(){
    return {
      spring:'radial-gradient(circle at 20% 15%,rgba(255,255,255,.72),transparent 25%),linear-gradient(145deg,#8fcf75,#4f8f5d)',
      summer:'radial-gradient(circle at 80% 10%,rgba(255,244,163,.9),transparent 22%),linear-gradient(145deg,#53a653,#286b43)',
      autumn:'radial-gradient(circle at 25% 15%,rgba(255,225,153,.74),transparent 22%),linear-gradient(145deg,#c9893f,#824625)',
      winter:'radial-gradient(circle at 30% 20%,rgba(255,255,255,.95),transparent 30%),linear-gradient(145deg,#e5f4ff,#91abc2)',
    }[season];
  }
  function updateStatus(){
    if (over) return;
    const text=(spectator ? t('spectating_prefix') : '') + t('tank_realtime') + ' · ' + seasonLabel(season) + ' · ' + t('seconds_short',Math.ceil(remainingMs/1000));
    if(text!==lastStatusText){lastStatusText=text;setStatus(text);}
  }
  function ensureRenderTree(){
    if(renderNodes.board&&area.querySelector&&area.querySelector('.tank-board')===renderNodes.board)return renderNodes.board;
    area.innerHTML='';
    const board=el('div','tank-board realtime-arena season-'+season);
    board.style.touchAction='none';board.style.overscrollBehavior='contain';board.style.overflow='hidden';
    board.addEventListener('pointerdown',event=>{if(event.button===0)localShoot();});
    area.appendChild(board);renderNodes.board=board;
    renderNodes.staticCells.clear();renderNodes.traces.clear();renderNodes.bullets.clear();renderNodes.tanks.clear();renderNodes.respawns.clear();renderNodes.effects.clear();
    if(!renderNodes.time){
      renderNodes.time=el('strong','tank-time');hud.appendChild(renderNodes.time);
      for(let index=0;index<playerCount;index++){const score=el('span','tank-score-chip');renderNodes.scores.push(score);hud.appendChild(score);}
      hud.style.cssText='display:flex;gap:7px;justify-content:center;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:12px;';
    }
    return board;
  }
  function render(){
    if (destroyed) return;
    const width = Math.min(area.clientWidth || 560, 620), cell = width/W, height = cell*H;
    const board=ensureRenderTree();
    board.className='tank-board realtime-arena season-'+season;
    const tabletop = typeof tabletopArtEnabled === 'function' && tabletopArtEnabled();
    if (typeof markTabletopSurface === 'function') markTabletopSurface(board, 'tank-arena', { variant: season });
    board.style.width = width+'px'; board.style.height = height+'px';
    board.style.background = tabletop
      ? 'radial-gradient(circle at 22% 16%,rgba(255,255,255,.35),transparent 22%),linear-gradient(135deg,#74b985,#3b7b62)'
      : seasonBackground();
    const staticItems=[];for(let r=0;r<H;r++)for(let c=0;c<W;c++)if(grid[r][c])staticItems.push({r,c,type:grid[r][c]});
    syncRenderMap(renderNodes.staticCells,staticItems,item=>item.r+':'+item.c,
      item=>{const node=el('div','tank-cell');node.style.zIndex='1';board.appendChild(node);return node;},
      (node,item)=>{node.className='tank-cell '+(item.type===3?'steel':'brick');node.style.left=item.c*cell+'px';node.style.top=item.r*cell+'px';node.style.width=cell+'px';node.style.height=cell+'px';});
    syncRenderMap(renderNodes.traces,traces,item=>renderObjectKey(item,'trace'),
      item=>{const node=el('div','tank-trace');board.appendChild(node);return node;},
      (node,item)=>{node.className='tank-trace '+item.type;node.textContent=item.type==='scorch'?'✹':'';node.style.cssText='position:absolute;z-index:2;left:'+((item.x-.18)*cell)+'px;top:'+((item.y-.18)*cell)+'px;width:'+(cell*.36)+'px;height:'+(cell*.36)+'px;opacity:.34;pointer-events:none;color:#312e2a;font-size:'+(cell*.28)+'px;';});
    syncRenderMap(renderNodes.bullets,bullets,item=>String(item.id),
      item=>{const node=el('div','tank-projectile','●');board.appendChild(node);return node;},
      (node,item)=>{node.style.cssText='position:absolute;z-index:3;left:'+((item.x-.12)*cell)+'px;top:'+((item.y-.12)*cell)+'px;width:'+(cell*.24)+'px;height:'+(cell*.24)+'px;color:#fde047;text-shadow:0 0 8px #fff;pointer-events:none;';});
    syncRenderMap(renderNodes.tanks,tanks,item=>String(item.id),
      tank=>{const node=el('div','tank-cell arena-tank');node._icon=el('span','tank-icon');node._hp=el('span','hp');node.appendChild(node._icon);node.appendChild(node._hp);board.appendChild(node);return node;},
      (node,tank)=>{const skin=cosmetic.players&&cosmetic.players[tank.id]||cosmetic.default||'classic';node.className='tank-cell arena-tank tank'+tank.id+' skin-'+skin;node.style.display=tank.alive?'flex':'none';node.style.zIndex='4';node.style.left=((tank.x-.5)*cell)+'px';node.style.top=((tank.y-.5)*cell)+'px';node.style.width=cell+'px';node.style.height=cell+'px';node.style.transform='rotate('+(tank.d*90)+'deg)';node.style.filter=Date.now()<tank.invulnerableUntil?'drop-shadow(0 0 9px #fff) brightness(1.3)':'';node._icon.textContent=skin==='cyber'?'🤖':'🛡️';node._hp.textContent='♥'.repeat(Math.max(0,tank.hp));});
    syncRenderMap(renderNodes.respawns,tanks.filter(tank=>!tank.alive),item=>String(item.id),
      tank=>{const node=el('div','tank-respawn');board.appendChild(node);return node;},
      (node,tank)=>{node.textContent='↻ '+Math.max(1,Math.ceil((tank.respawnAt-Date.now())/1000));node.style.cssText='position:absolute;z-index:4;left:'+((tank.x-.45)*cell)+'px;top:'+((tank.y-.45)*cell)+'px;color:#fff;font-weight:900;';});
    syncRenderMap(renderNodes.effects,effects,item=>renderObjectKey(item,'effect'),
      item=>{const node=el('div','tank-effect');board.appendChild(node);return node;},
      (node,item)=>{node.className='tank-effect '+item.type;node.textContent=item.type==='explosion'?'💥':item.type==='respawn'?'✨':item.type==='muzzle'?'✦':'✹';node.style.cssText='position:absolute;z-index:5;left:'+((item.x-.45)*cell)+'px;top:'+((item.y-.45)*cell)+'px;width:'+cell+'px;height:'+cell+'px;font-size:'+(cell*.7)+'px;pointer-events:none;';});
    const timeText='⏱ '+Math.floor(remainingMs/60000)+':'+String(Math.ceil(remainingMs/1000)%60).padStart(2,'0')+' · '+seasonLabel(season);
    if(renderNodes.time.textContent!==timeText)renderNodes.time.textContent=timeText;
    ranking().forEach((id,index)=>{const tank=tanks[id],text=t('tank_score_line',id+1,tank.kills,tank.deaths,tank.damage);if(renderNodes.scores[index].textContent!==text)renderNodes.scores[index].textContent=text;});
    controls.style.display=spectator?'none':'flex';
    const playerRows=tanks.map(tank=>t('tank_player_stats',tank.kills,tank.deaths,tank.damage)),playersSignature=controlledPlayer()+'|'+playerRows.join('|');
    if(playersSignature!==lastPlayersSignature){lastPlayersSignature=playersSignature;renderPlayers(controlledPlayer(),playerRows);}
    if(over&&!victoryShown){victoryShown=true;showVictoryOverlay(area,{winner,winnerName:t('player_number',winner+1),emoji:'🏆',subtitle:t('tank_victory_subtitle'),coins:1,onRestart:reset});}
    updateStatus();
  }

  function syncRelayMatch(){
    const matchId = currentMatchId();
    if (matchId === relayMatchId) return matchId;
    relayMatchId = matchId; inputSequence = 0; authoritySequence = 0; lastAuthoritySequence = -1;
    lastInputSequence = Array(playerCount).fill(-1); resultCommitted = false; lastRelayAt = 0;
    return matchId;
  }
  function relayPayloadMatches(payload){
    const expected = syncRelayMatch();
    return !payload.matchId || !expected || String(payload.matchId) === expected;
  }
  function acceptInputSequence(pi,payload){
    if (!Object.prototype.hasOwnProperty.call(payload,'seq')) return true; // 兼容旧 act:move/shoot。
    const seq = Number(payload.seq);
    if (!Number.isSafeInteger(seq) || seq < 1 || seq <= lastInputSequence[pi]) return false;
    lastInputSequence[pi] = seq;
    if (opts.online && pi === controlledPlayer() && opts.isReplaying && opts.isReplaying()) inputSequence = Math.max(inputSequence,seq);
    return true;
  }
  function broadcastAuthoritativeState(finalOrder){
    if (authorityMode || !opts.online || !opts.isHost || typeof opts.sendMove !== 'function' || (opts.isReplaying && opts.isReplaying())) return false;
    const matchId = syncRelayMatch();
    if (!matchId) return false;
    const order = validOrder(finalOrder) ? finalOrder.slice() : null;
    const payload = {
      act:order ? 'authoritative_result' : 'authoritative_state', protocol:RELAY_PROTOCOL,
      matchId, authoritySeq:++authoritySequence, state:snapshot(),
    };
    if (order) payload.order = order;
    opts.sendMove(payload); lastRelayAt = Date.now();
    return true;
  }
  function applyAuthoritativeState(payload,player){
    const replaying = !!(opts.isReplaying && opts.isReplaying());
    const replayingHost = !!(opts.isHost && replaying);
    if (resultCommitted || !opts.online || (opts.isHost && !replayingHost) || player !== HOST_PLAYER || payload.protocol !== RELAY_PROTOCOL || !relayPayloadMatches(payload)) return false;
    const seq = Number(payload.authoritySeq);
    if (!Number.isSafeInteger(seq) || seq < 1 || seq <= lastAuthoritySequence) return false;
    const finalOrder = payload.act === 'authoritative_result' ? payload.order : null;
    if (payload.act === 'authoritative_result' && !validOrder(finalOrder)) return false;
    const localInput = !finalOrder && tanks[controlledPlayer()] ? normalizeInput(keyboardInput) : null;
    if (!onRestore(payload.state,replaying)) return false;
    lastAuthoritySequence = seq;
    if (replayingHost) authoritySequence = Math.max(authoritySequence,seq);
    if (localInput && tanks[controlledPlayer()]) tanks[controlledPlayer()].input = localInput;
    if (finalOrder) commitFinal(finalOrder,false);
    return true;
  }
  opts.onMove = (payload, player) => {
    if(authorityMode)return;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
    const pi = opts.online ? Number(player) : (Number.isInteger(player) ? player : 0);
    if (!Number.isInteger(pi) || pi < 0 || pi >= tanks.length) return;
    if (payload.act === 'authoritative_state' || payload.act === 'authoritative_result'){
      applyAuthoritativeState(payload,pi); return;
    }
    if (over || !relayPayloadMatches(payload)) return;
    if (payload.protocol && payload.protocol !== RELAY_PROTOCOL) return;
    if (!['input','move','shoot'].includes(payload.act) || !acceptInputSequence(pi,payload)) return;
    if (payload.act === 'input' && payload.input) setPlayerInput(pi,payload.input,false);
    else if (payload.act === 'move') pulseMove(pi,Number(payload.d),false);
    else if (payload.act === 'shoot') fireTank(tanks[pi]);
  };
  function reset(){
    if (opts.online && !opts.isHost){ toast(t('host_only_restart')); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  function snapshot(){
    const compat = id => { const t=tanks[id]||createTank(id); return {r:Math.round(t.y),c:Math.round(t.x),d:t.d,lives:t.hp}; };
    return {
      version:3, mode:'realtime-deathmatch', authority:authorityMode?'server-authority':opts.online?'casual-host-relay':'local-simulation',
      tanks:tanks.map(t=>({ ...t,input:{...t.input} })), bullets:bullets.map(b=>({...b})),
      grid:grid.map(row=>row.slice()), season, remainingMs, startedAt, over, winner, cur,
      t0:compat(0), t1:compat(1),
    };
  }
  function finiteNumber(value,fallback,min,max){
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min,Math.min(max,number)) : fallback;
  }
  function sanitizeTank(value,id){
    const base=createTank(id), tank=value&&typeof value==='object'?value:{};
    return {
      ...base, id,
      x:finiteNumber(tank.x,base.x,.5,W-.5), y:finiteNumber(tank.y,base.y,.5,H-.5),
      d:Number.isInteger(tank.d)&&tank.d>=0&&tank.d<4?tank.d:base.d,
      hp:Math.max(0,Math.min(3,Math.floor(finiteNumber(tank.hp,base.hp,0,3)))), alive:tank.alive!==false,
      respawnAt:finiteNumber(tank.respawnAt,0,0,Date.now()+60000),
      invulnerableUntil:finiteNumber(tank.invulnerableUntil,0,0,Date.now()+60000),
      fireReadyAt:finiteNumber(tank.fireReadyAt,0,0,Date.now()+60000), input:normalizeInput(tank.input),
      kills:Math.max(0,Math.floor(Number(tank.kills)||0)), deaths:Math.max(0,Math.floor(Number(tank.deaths)||0)),
      damage:Math.max(0,Math.floor(Number(tank.damage)||0)), shots:Math.max(0,Math.floor(Number(tank.shots)||0)),
      hits:Math.max(0,Math.floor(Number(tank.hits)||0)),
      placement:Number.isInteger(tank.placement)&&tank.placement>=1&&tank.placement<=playerCount?tank.placement:0,
    };
  }
  function onRestore(value,silent){
    const state=value&&value.state?value.state:value;
    if (!state || !Array.isArray(state.tanks) || state.tanks.length !== playerCount || !Array.isArray(state.grid) ||
        state.grid.length !== H || state.grid.some(row=>!Array.isArray(row)||row.length!==W)) return false;
    aiEpoch++;
    grid=state.grid.map(row=>row.map(v=>v===2||v===3?v:0));
    tanks=state.tanks.map((t,id)=>sanitizeTank(t,id));
    bullets=(Array.isArray(state.bullets)?state.bullets:[]).slice(0,128).map((b,index)=>({
      id:Number.isSafeInteger(Number(b&&b.id))?Number(b.id):index+1,
      owner:Number.isInteger(b&&b.owner)&&b.owner>=0&&b.owner<playerCount?b.owner:0,
      x:finiteNumber(b&&b.x,1,.01,W-.01), y:finiteNumber(b&&b.y,1,.01,H-.01),
      d:Number.isInteger(b&&b.d)&&b.d>=0&&b.d<4?b.d:0, ttl:finiteNumber(b&&b.ttl,0,0,3000),
    })).filter(b=>b.ttl>0);
    bulletSequence=bullets.reduce((max,b)=>Math.max(max,b.id),bulletSequence);
    season=SEASONS.includes(state.season)?state.season:'spring'; remainingMs=finiteNumber(state.remainingMs,0,0,MATCH_MS);
    startedAt=Date.now()-(MATCH_MS-remainingMs); over=!!state.over;
    winner=Number.isInteger(state.winner)&&state.winner>=0&&state.winner<playerCount?state.winner:-1;
    cur=Number.isInteger(state.cur)&&state.cur>=0&&state.cur<playerCount?state.cur:0;
    lastLoopAt=Date.now(); accumulator=0; traces=[]; effects=[];
    if (value&&value.presentation) setCosmetic(value.presentation.cosmetic);
    if (!silent) render(); return true;
  }
  function onAuthoritySnapshot(state,silent){
    if(!authorityMode||!state||state.protocol!==AUTH_PROTOCOL||String(state.matchId||'')!==currentMatchId()||!Array.isArray(state.players)||state.players.length!==playerCount)return false;
    if(Number(state.serverTick)<authorityServerTick)return false;
    const old=tanks.slice(),localId=controlledPlayer();authorityServerTick=Math.max(authorityServerTick,Number(state.serverTick)||0);
    const ack=Array.isArray(state.ack)?state.ack.slice(0,playerCount).map(value=>Math.max(0,Math.floor(Number(value)||0))):[];
    if(ack.length===playerCount){lastInputSequence=ack;inputSequence=Math.max(inputSequence,ack[localId]||0);}
    lastAuthoritySequence=authorityServerTick;
    authorityEndAt=Number(state.endAt)||authorityEndAt;remainingMs=Math.max(0,Number(state.remainingMs)||0);season=SEASONS.includes(state.season)?state.season:season;
    grid=(Array.isArray(state.destructibles)?state.destructibles:grid).map(row=>Array.isArray(row)?row.map(v=>v===2||v===3?v:0):[]);
    tanks=state.players.map((raw,id)=>{
      const server=sanitizeTank(raw,id),previous=old[id];
      if(previous){
        const distance=Math.hypot(previous.x-server.x,previous.y-server.y),factor=id===localId?(distance<.8?.35:1):.55;
        server.x=previous.x+(server.x-previous.x)*factor;server.y=previous.y+(server.y-previous.y)*factor;
        if(previous.alive&&!server.alive)effects.push({x:server.x,y:server.y,type:'explosion',at:Date.now(),ttl:850});
        else if(!previous.alive&&server.alive)effects.push({x:server.x,y:server.y,type:'respawn',at:Date.now(),ttl:600});
      }
      if(id===localId)server.input=normalizeInput(keyboardInput);
      return server;
    });
    bullets=(Array.isArray(state.projectiles)?state.projectiles:[]).slice(0,128).map((b,index)=>({id:Number(b.id)||index+1,owner:Number(b.owner)||0,x:Number(b.x)||0,y:Number(b.y)||0,d:Number(b.d)||0,ttl:Number(b.ttl)||0}));
    if(!silent)render();return true;
  }
  function onAuthorityResult(payload){
    const order=payload&&payload.order;if(!authorityMode||resultCommitted||!validOrder(order))return false;
    if(Array.isArray(payload.stats))payload.stats.forEach((item,id)=>{if(tanks[id])Object.assign(tanks[id],sanitizeTank(item,id));});
    over=true;finishedAt=Date.now();remainingMs=0;winner=order[0];resultCommitted=true;order.forEach((id,index)=>{if(tanks[id])tanks[id].placement=index+1;});
    render();setStatus(t('tank_server_final',winner+1),true);return true;
  }
  function getMatchStats(){
    const order=ranking();
    return tanks.map(t=>({kills:t.kills,deaths:t.deaths,damage:t.damage,shots:t.shots,hits:t.hits,placement:t.placement||order.indexOf(t.id)+1}));
  }
  function getPerformanceStats(){return{...performanceStats,activeParticles:effects.length,activeProjectiles:bullets.length,trailCount:traces.length,caps:{particles:40,projectiles:128,trails:60}};}
  function setSeason(value){ season=SEASONS.includes(value)?value:'spring'; render(); return season; }
  function setCosmetic(value){ cosmetic={default:'classic',players:{},...(value||{})}; cosmetic.default=cosmetic.default==='cyber'?'cyber':'classic'; render(); return cosmetic; }
  function setSpectators(value){ spectator=Array.isArray(value)?value.includes(opts.viewerId):!!value; Object.assign(keyboardInput,emptyInput()); render(); return spectator; }
  function destroy(){
    destroyed=true; aiEpoch++; aiPending.clear(); aiThinkGate.clear(); clearTransientTimers(); clearInterval(simulationTimer); clearInterval(aiTimer);
    if (document.removeEventListener){ document.removeEventListener('keydown',keyDown); document.removeEventListener('keyup',keyUp); }
    area.style.touchAction=previousTouchAction; area.style.overscrollBehavior=previousOverscroll;
  }
  resetLocal();
  return { reset,onMove:opts.onMove,onRestart:resetLocal,destroy,snapshot,onRestore,onAuthoritySnapshot,onAuthorityResult,
    serialize:()=>({state:snapshot(),presentation:{season,cosmetic},stats:getMatchStats()}),
    fixedUpdate,getMatchStats,getPerformanceStats,setSeason,setCosmetic,renderCosmetic:setCosmetic,setSpectators,finishMatch,
    // moveLog 中的权威快照已包含完整状态，重连回放无需为每条实时事件等待动画。
    whenIdle:()=>Promise.resolve(),
    broadcastAuthoritativeState,
    getRelayState:()=>({
      protocol:authorityMode?AUTH_PROTOCOL:RELAY_PROTOCOL, role:opts.online?(opts.isHost?'host':'client'):'local', matchId:currentMatchId(),
      localInputSeq:inputSequence, authoritySeq:authoritySequence, lastAuthoritySeq:lastAuthoritySequence,
      serverTick:authorityServerTick, lastInputSeq:lastInputSequence.slice(), resultCommitted,
    }),
    getMultiplayerRequirement:()=>opts.online?'REALTIME_TANK_PROTOCOL_V1':null,
  };
}
