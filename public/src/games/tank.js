/* ================= 坦克大战 · Real-Time Arena ================= */
function gameTank(area, extra, n, opts){
  opts = opts || {};
  const playerCount = Math.max(2, Math.min(5, Number(n) || 2));
  const W = playerCount > 4 ? 17 : 15, H = 13;
  const FIXED_MS = 50, MATCH_MS = Math.max(10000, Number(opts.matchDurationMs) || 180000);
  const RELAY_PROTOCOL = 'tank-host-relay-v1', HOST_PLAYER = 0;
  const RELAY_SNAPSHOT_MS = Math.max(200, Math.min(1000, Number(opts.relaySnapshotMs) || 400));
  const DIRS = [[0,-1],[1,0],[0,1],[-1,0]]; // 上右下左
  const SPAWNS = [[1.5,1.5],[W-2.5,H-2.5],[W-2.5,1.5],[1.5,H-2.5],[Math.floor(W/2)+.5,Math.floor(H/2)+.5]];
  const SEASONS = ['spring','summer','autumn','winter'];
  const SEASON_LABEL = { spring:'春日细雨', summer:'盛夏晴空', autumn:'金秋落叶', winter:'冬日雪原' };
  const previousTouchAction = area.style.touchAction || '';
  const previousOverscroll = area.style.overscrollBehavior || '';
  area.style.touchAction = 'none'; area.style.overscrollBehavior = 'contain';

  let grid = [], tanks = [], bullets = [], traces = [], effects = [];
  let over = false, winner = -1, cur = 0, destroyed = false;
  let startedAt = Date.now(), finishedAt = 0, remainingMs = MATCH_MS, lastLoopAt = Date.now(), accumulator = 0;
  let bulletSequence = 0, inputSequence = 0, authoritySequence = 0, lastAuthoritySequence = -1, aiEpoch = 0;
  let lastInputSequence = Array(playerCount).fill(-1), relayMatchId = '', resultCommitted = false, lastRelayAt = 0;
  let spectator = !!opts.spectator;
  let season = chooseSeason(matchSeed());
  let cosmetic = { default:'classic', players:{}, ...(opts.cosmetic || {}) };
  let lastRenderAt = 0;

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
    aiEpoch++; aiPending.clear(); buildMap();
    startedAt = Date.now(); finishedAt = 0; remainingMs = MATCH_MS; lastLoopAt = startedAt; accumulator = 0;
    tanks = Array.from({length:playerCount}, (_, i) => createTank(i));
    bullets = []; traces = []; effects = []; over = false; winner = -1; cur = 0; bulletSequence = 0; destroyed = false;
    resetRelayState();
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
    // 联机客端只做预测显示，最终计时与排名必须等待房主快照；本地/AI 行为保持不变。
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
    render(); setStatus('🏆 玩家' + (winner+1) + ' 获胜 · ' + tanks[winner].kills + ' 击杀', true);
    return true;
  }
  function finishMatch(){
    if (opts.online && opts.serverAuthority) return false;
    if (opts.online && !opts.isHost) return false;
    return commitFinal(ranking(), !!opts.online);
  }
  function loop(){
    if (destroyed) return;
    const now = Date.now(), elapsed = Math.min(250, Math.max(0, now - lastLoopAt));
    lastLoopAt = now; accumulator += elapsed;
    while (accumulator >= FIXED_MS){ if (!(opts.online && opts.serverAuthority)) fixedUpdate(FIXED_MS/1000); accumulator -= FIXED_MS; }
    if (opts.online && opts.isHost && !opts.serverAuthority && !over && now - lastRelayAt >= RELAY_SNAPSHOT_MS) broadcastAuthoritativeState();
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
    setTimeout(() => { if (tanks[pi]) tanks[pi].input = emptyInput(); }, 180);
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
  const fireBtn = el('button','btn btn-primary tank-fire','🔥 FIRE');
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

  const aiPending = new Set();
  async function scheduleAIPlayer(pi){
    if (destroyed || over || aiPending.has(pi) || !opts.ai || !opts.ai.has(pi) || !tanks[pi] || !tanks[pi].alive) return;
    aiPending.add(pi); const epoch = aiEpoch; const choices = ['move:0','move:1','move:2','move:3','shoot'];
    const me = tanks[pi];
    const remote = await aiChoose('tank', {
      season, remainingMs, player:pi, tanks:tanks.map(t => ({id:t.id,x:+t.x.toFixed(2),y:+t.y.toFixed(2),hp:t.hp,alive:t.alive,kills:t.kills})),
      grid:grid.map(row => row.join('')),
    }, choices, opts.aiPersona);
    if (destroyed || over || epoch !== aiEpoch){ aiPending.delete(pi); return; }
    const choice = choices.includes(remote) ? remote : choices[Math.floor(Math.random()*choices.length)];
    aiPending.delete(pi);
    if (choice === 'shoot'){
      if (opts.onProgress) opts.onProgress({act:'shoot'});
      fireTank(me);
    } else {
      const direction = Number(choice.slice(-1));
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
    setStatus((spectator ? '观战 · ' : '') + '实时坦克竞技 · ' + SEASON_LABEL[season] + ' · ' + Math.ceil(remainingMs/1000) + ' 秒');
  }
  function render(){
    if (destroyed) return;
    const width = Math.min(area.clientWidth || 560, 620), cell = width/W, height = cell*H;
    area.innerHTML = '';
    const board = el('div','tank-board realtime-arena season-' + season);
    board.style.width = width+'px'; board.style.height = height+'px'; board.style.background = seasonBackground();
    board.style.touchAction = 'none'; board.style.overscrollBehavior = 'contain'; board.style.overflow = 'hidden';
    for (let r=0;r<H;r++) for (let c=0;c<W;c++){
      if (!grid[r][c]) continue;
      const cellEl = el('div','tank-cell ' + (grid[r][c]===3?'steel':'brick'));
      cellEl.style.left=c*cell+'px'; cellEl.style.top=r*cell+'px'; cellEl.style.width=cell+'px'; cellEl.style.height=cell+'px'; board.appendChild(cellEl);
    }
    traces.forEach(item => {
      const mark = el('div','tank-trace '+item.type,item.type==='scorch'?'✹':'');
      mark.style.cssText='position:absolute;left:'+((item.x-.18)*cell)+'px;top:'+((item.y-.18)*cell)+'px;width:'+(cell*.36)+'px;height:'+(cell*.36)+'px;opacity:.34;pointer-events:none;color:#312e2a;font-size:'+(cell*.28)+'px;'; board.appendChild(mark);
    });
    bullets.forEach(item => {
      const bullet=el('div','tank-projectile','●'); bullet.style.cssText='position:absolute;z-index:3;left:'+((item.x-.12)*cell)+'px;top:'+((item.y-.12)*cell)+'px;width:'+(cell*.24)+'px;height:'+(cell*.24)+'px;color:#fde047;text-shadow:0 0 8px #fff;pointer-events:none;'; board.appendChild(bullet);
    });
    tanks.forEach(tank => {
      if (!tank.alive){
        const countdown=el('div','tank-respawn','↻ '+Math.max(1,Math.ceil((tank.respawnAt-Date.now())/1000)));
        countdown.style.cssText='position:absolute;left:'+((tank.x-.45)*cell)+'px;top:'+((tank.y-.45)*cell)+'px;color:#fff;font-weight:900;'; board.appendChild(countdown); return;
      }
      const skin = cosmetic.players && cosmetic.players[tank.id] || cosmetic.default || 'classic';
      const node=el('div','tank-cell arena-tank tank'+tank.id+' skin-'+skin,skin==='cyber'?'🤖':'🛡️');
      node.style.left=((tank.x-.5)*cell)+'px'; node.style.top=((tank.y-.5)*cell)+'px'; node.style.width=cell+'px'; node.style.height=cell+'px';
      node.style.transform='rotate('+(tank.d*90)+'deg)'; node.style.filter=Date.now()<tank.invulnerableUntil?'drop-shadow(0 0 9px #fff) brightness(1.3)':'';
      node.appendChild(el('span','hp','♥'.repeat(Math.max(0,tank.hp)))); board.appendChild(node);
    });
    effects.forEach(item => {
      const fx=el('div','tank-effect '+item.type,item.type==='explosion'?'💥':item.type==='respawn'?'✨':item.type==='muzzle'?'✦':'✹');
      fx.style.cssText='position:absolute;z-index:5;left:'+((item.x-.45)*cell)+'px;top:'+((item.y-.45)*cell)+'px;width:'+cell+'px;height:'+cell+'px;font-size:'+(cell*.7)+'px;pointer-events:none;'; board.appendChild(fx);
    });
    board.addEventListener('pointerdown',e => { if (e.button === 0) localShoot(); });
    area.appendChild(board);
    hud.innerHTML='';
    const time=el('strong','tank-time','⏱ '+Math.floor(remainingMs/60000)+':'+String(Math.ceil(remainingMs/1000)%60).padStart(2,'0')+' · '+SEASON_LABEL[season]); hud.appendChild(time);
    ranking().forEach(id => { const t=tanks[id]; hud.appendChild(el('span','tank-score-chip','P'+(id+1)+' '+t.kills+'K/'+t.deaths+'D · '+t.damage+' DMG')); });
    hud.style.cssText='display:flex;gap:7px;justify-content:center;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:12px;';
    controls.style.display=spectator?'none':'flex';
    renderPlayers(controlledPlayer(),tanks.map(t=>t.kills+'K/'+t.deaths+'D · '+t.damage+' DMG'));
    if (over){ showVictoryOverlay(area,{winner,winnerName:'玩家'+(winner+1),emoji:'🏆',subtitle:'实时坦克竞技获胜',coins:1,onRestart:reset}); }
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
    if (!opts.online || opts.serverAuthority || !opts.isHost || typeof opts.sendMove !== 'function' || (opts.isReplaying && opts.isReplaying())) return false;
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
    if (opts.online && !opts.isHost){ toast('由房主开始新一局'); return; }
    if (opts.online){ opts.sendRestart(); return; }
    resetLocal();
  }
  function snapshot(){
    const compat = id => { const t=tanks[id]||createTank(id); return {r:Math.round(t.y),c:Math.round(t.x),d:t.d,lives:t.hp}; };
    return {
      version:3, mode:'realtime-deathmatch', authority:opts.online?'casual-host-relay':'local-simulation',
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
  function applyServerSnapshot(state){
    if (!state || state.protocol !== 'tank-authority-v1' || String(state.matchId || '') !== currentMatchId()) return false;
    const restored = onRestore({
      tanks:state.players, bullets:state.projectiles, grid:state.destructibles, season:state.season,
      remainingMs:state.remainingMs, over:!!state.finished, winner:Array.isArray(state.order) ? state.order[0] : -1, cur:controlledPlayer(),
    });
    if (Array.isArray(state.ack)) state.ack.forEach((seq,id)=>{ if(Number.isInteger(id)&&id<lastInputSequence.length) lastInputSequence[id]=Math.max(lastInputSequence[id],Number(seq)||0); });
    if (Array.isArray(state.ack)) inputSequence=Math.max(inputSequence,Number(state.ack[controlledPlayer()])||0);
    lastAuthoritySequence = Math.max(lastAuthoritySequence, Number(state.serverTick)||0);
    if (state.finished && Array.isArray(state.order)) commitFinal(state.order, false);
    return restored;
  }
  function applyServerResult(payload){
    return payload && String(payload.matchId || '') === currentMatchId() && commitFinal((payload.order || []).map(Number), false);
  }
  function getMatchStats(){
    const order=ranking();
    return tanks.map(t=>({kills:t.kills,deaths:t.deaths,damage:t.damage,shots:t.shots,hits:t.hits,placement:t.placement||order.indexOf(t.id)+1}));
  }
  function setSeason(value){ season=SEASONS.includes(value)?value:'spring'; render(); return season; }
  function setCosmetic(value){ cosmetic={default:'classic',players:{},...(value||{})}; cosmetic.default=cosmetic.default==='cyber'?'cyber':'classic'; render(); return cosmetic; }
  function setSpectators(value){ spectator=Array.isArray(value)?value.includes(opts.viewerId):!!value; Object.assign(keyboardInput,emptyInput()); render(); return spectator; }
  function destroy(){
    destroyed=true; aiEpoch++; aiPending.clear(); clearInterval(simulationTimer); clearInterval(aiTimer);
    if (document.removeEventListener){ document.removeEventListener('keydown',keyDown); document.removeEventListener('keyup',keyUp); }
    area.style.touchAction=previousTouchAction; area.style.overscrollBehavior=previousOverscroll;
  }
  resetLocal();
  return { reset,onMove:opts.onMove,onRestart:resetLocal,destroy,snapshot,onRestore,
    serialize:()=>({state:snapshot(),presentation:{season,cosmetic},stats:getMatchStats()}),
    fixedUpdate,getMatchStats,setSeason,setCosmetic,renderCosmetic:setCosmetic,setSpectators,finishMatch,
    // moveLog 中的权威快照已包含完整状态，重连回放无需为每条实时事件等待动画。
    whenIdle:()=>Promise.resolve(),
    broadcastAuthoritativeState,applyServerSnapshot,applyServerResult,
    getRelayState:()=>({
      protocol:RELAY_PROTOCOL, role:opts.online?(opts.isHost?'host':'client'):'local', matchId:currentMatchId(),
      localInputSeq:inputSequence, authoritySeq:authoritySequence, lastAuthoritySeq:lastAuthoritySequence,
      lastInputSeq:lastInputSequence.slice(), resultCommitted,
    }),
    getMultiplayerRequirement:()=>opts.online?'REALTIME_TANK_PROTOCOL_V1':null,
  };
}
