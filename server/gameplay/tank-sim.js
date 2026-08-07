'use strict';

const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
const SEASONS = ['spring','summer','autumn','winter'];

function hashString(value){
  let hash = 2166136261;
  for (const ch of String(value || '')){ hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash >>> 0;
}
function emptyInput(){ return { up:false,right:false,down:false,left:false,fire:false }; }
function normalizeInput(value){
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const input = emptyInput();
  Object.keys(input).forEach(key => { input[key] = source[key] === true; });
  if (input.up && input.down){ input.up = false; input.down = false; }
  if (input.left && input.right){ input.left = false; input.right = false; }
  return input;
}

class TankAuthority {
  constructor(options = {}){
    this.matchId = String(options.matchId || '');
    this.playerCount = Math.max(2, Math.min(5, Number(options.playerCount) || 2));
    this.width = this.playerCount > 4 ? 17 : 15;
    this.height = 13;
    this.tickMs = 50;
    this.durationMs = Math.max(10000, Number(options.durationMs) || 180000);
    this.startedAt = Number(options.startedAt) || Date.now();
    this.endAt = this.startedAt + this.durationMs;
    this.serverTick = 0;
    this.lastStepAt = this.startedAt;
    this.accumulator = 0;
    this.projectileSeq = 0;
    this.season = SEASONS[hashString(this.matchId) % SEASONS.length];
    this.grid = this.buildMap();
    this.spawns = [[1.5,1.5],[this.width-2.5,this.height-2.5],[this.width-2.5,1.5],[1.5,this.height-2.5],[Math.floor(this.width/2)+.5,Math.floor(this.height/2)+.5]];
    this.players = Array.from({length:this.playerCount}, (_, id) => this.createTank(id));
    this.projectiles = [];
    this.lastSeq = Array(this.playerCount).fill(0);
    this.inputTimes = Array.from({length:this.playerCount}, () => []);
    this.finished = false;
    this.finishedAt = null;
    this.finishReason = null;
    this.stopped = false;
    this.stoppedAt = null;
    this.stopReason = null;
    this.order = null;
  }

  buildMap(){
    const grid = Array.from({length:this.height}, () => Array(this.width).fill(0));
    for (let c=0;c<this.width;c++){ grid[0][c]=3; grid[this.height-1][c]=3; }
    for (let r=0;r<this.height;r++){ grid[r][0]=3; grid[r][this.width-1]=3; }
    const mid=Math.floor(this.width/2);
    const bricks=[[3,3],[3,4],[4,3],[this.height-4,this.width-4],[this.height-4,this.width-5],[this.height-5,this.width-4],
      [2,mid],[this.height-3,mid],[Math.floor(this.height/2),2],[Math.floor(this.height/2),this.width-3],
      [5,mid-1],[5,mid],[5,mid+1],[7,mid-1],[7,mid],[7,mid+1]];
    bricks.forEach(([r,c]) => { if (r>0&&r<this.height-1&&c>0&&c<this.width-1) grid[r][c]=2; });
    return grid;
  }

  createTank(id){
    const spawn=this.spawns[id%this.spawns.length];
    return { id,x:spawn[0],y:spawn[1],d:id%2?3:1,hp:3,alive:true,respawnAt:0,invulnerableUntil:this.startedAt+1200,
      fireReadyAt:0,input:emptyInput(),kills:0,deaths:0,damage:0,shots:0,hits:0,placement:0 };
  }

  acceptInput(player, payload, now = Date.now()){
    if (this.stopped) return {ok:false,reason:'stopped'};
    if (this.finished) return {ok:false,reason:'finished'};
    if (!Number.isInteger(player) || player<0 || player>=this.playerCount) return {ok:false,reason:'invalid_player'};
    if (!payload || String(payload.matchId || '') !== this.matchId) return {ok:false,reason:'invalid_match'};
    const seq=Number(payload.seq),clientTick=Number(payload.clientTick);
    if (!Number.isSafeInteger(seq)||seq<1||seq<=this.lastSeq[player]) return {ok:false,reason:'stale_seq'};
    if (Number.isFinite(clientTick) && (clientTick < Math.max(0,this.serverTick-400) || clientTick > this.serverTick+40)) return {ok:false,reason:'invalid_tick'};
    const times=this.inputTimes[player].filter(value=>now-value<1000);
    if (times.length>=40) return {ok:false,reason:'rate_limited'};
    times.push(now);this.inputTimes[player]=times;this.lastSeq[player]=seq;
    this.players[player].input=normalizeInput(payload.input);
    return {ok:true,ack:seq};
  }

  clearPlayerInput(player){
    if (!Number.isInteger(player) || player<0 || player>=this.playerCount) return false;
    this.players[player].input=emptyInput();
    return true;
  }

  // 断线/席位切换时的兼容别名；两者都只清输入，不改权威比分。
  clearInput(player){return this.clearPlayerInput(player);}
  clearDisconnectedInput(player){return this.clearPlayerInput(player);}

  clearAllInputs(){
    this.players.forEach(tank=>{tank.input=emptyInput();});
  }

  isBlocked(x,y,ignoreId){
    const radius=.31;
    for (const [px,py] of [[x-radius,y-radius],[x+radius,y-radius],[x-radius,y+radius],[x+radius,y+radius]]){
      const r=Math.floor(py),c=Math.floor(px);
      if (!this.grid[r]||this.grid[r][c]===2||this.grid[r][c]===3) return true;
    }
    return this.players.some(t=>t.id!==ignoreId&&t.alive&&Math.hypot(t.x-x,t.y-y)<.65);
  }

  moveTank(tank,dx,dy,dt){
    if (!tank.alive||(!dx&&!dy)) return;
    if (Math.abs(dx)>=Math.abs(dy)) tank.d=dx>0?1:3; else tank.d=dy>0?2:0;
    const length=Math.hypot(dx,dy)||1,speed=2.65,nx=tank.x+dx/length*speed*dt,ny=tank.y+dy/length*speed*dt;
    if (!this.isBlocked(nx,tank.y,tank.id)) tank.x=nx;
    if (!this.isBlocked(tank.x,ny,tank.id)) tank.y=ny;
  }

  fire(tank,now){
    if (!tank.alive||now<tank.fireReadyAt) return false;
    tank.fireReadyAt=now+420;tank.shots++;
    const d=DIRS[tank.d];
    this.projectiles.push({id:++this.projectileSeq,owner:tank.id,x:tank.x+d[0]*.55,y:tank.y+d[1]*.55,d:tank.d,ttl:2600});
    if(this.projectiles.length>160)this.projectiles.splice(0,this.projectiles.length-160);
    return true;
  }

  safestSpawn(tank){
    return this.spawns.slice(0,this.playerCount).sort((a,b)=>{
      const distance=point=>Math.min(...this.players.filter(t=>t.alive&&t.id!==tank.id).map(t=>Math.hypot(t.x-point[0],t.y-point[1])).concat([99]));
      return distance(b)-distance(a);
    })[0]||this.spawns[tank.id%this.spawns.length];
  }

  damage(target,owner,now){
    if (!target.alive||now<target.invulnerableUntil) return false;
    target.hp--;
    const shooter=this.players[owner];if(shooter){shooter.damage++;shooter.hits++;}
    if (target.hp<=0){target.alive=false;target.deaths++;target.respawnAt=now+2000;target.input=emptyInput();if(shooter&&shooter.id!==target.id)shooter.kills++;}
    return true;
  }

  respawn(tank,now){
    const spawn=this.safestSpawn(tank);tank.x=spawn[0];tank.y=spawn[1];tank.d=tank.id%2?3:1;tank.hp=3;tank.alive=true;
    tank.respawnAt=0;tank.invulnerableUntil=now+1500;tank.input=emptyInput();
  }

  fixedStep(now){
    if (this.finished||this.stopped) return;
    const dt=this.tickMs/1000;
    this.players.forEach(tank=>{
      if(!tank.alive){if(tank.respawnAt&&now>=tank.respawnAt&&now<this.endAt)this.respawn(tank,now);return;}
      const input=tank.input||emptyInput();this.moveTank(tank,(input.right?1:0)-(input.left?1:0),(input.down?1:0)-(input.up?1:0),dt);
      if(input.fire)this.fire(tank,now);
    });
    const next=[];
    this.projectiles.forEach(projectile=>{
      const d=DIRS[projectile.d];projectile.x+=d[0]*8.2*dt;projectile.y+=d[1]*8.2*dt;projectile.ttl-=this.tickMs;
      const r=Math.floor(projectile.y),c=Math.floor(projectile.x),cell=this.grid[r]&&this.grid[r][c];
      if(projectile.ttl<=0||cell===3)return;
      if(cell===2){this.grid[r][c]=0;return;}
      const hit=this.players.find(t=>t.id!==projectile.owner&&t.alive&&Math.hypot(t.x-projectile.x,t.y-projectile.y)<.46);
      if(hit){this.damage(hit,projectile.owner,now);return;}next.push(projectile);
    });
    this.projectiles=next;this.serverTick++;
    if(now>=this.endAt)this.finish(now,'time_limit');
  }

  advance(now = Date.now()){
    if(this.finished||this.stopped)return this.snapshot(now);
    const elapsed=Math.min(500,Math.max(0,now-this.lastStepAt));this.lastStepAt=now;this.accumulator+=elapsed;
    while(this.accumulator>=this.tickMs&&!this.finished&&!this.stopped){const stepAt=now-this.accumulator+this.tickMs;this.accumulator-=this.tickMs;this.fixedStep(stepAt);}
    if(now>=this.endAt&&!this.finished)this.finish(now,'time_limit');
    return this.snapshot(now);
  }

  ranking(){return this.players.map(t=>t.id).sort((a,b)=>this.players[b].kills-this.players[a].kills||this.players[a].deaths-this.players[b].deaths||this.players[b].damage-this.players[a].damage||a-b);}
  finish(now=Date.now(),reason='completed'){
    if(this.finished)return this.order;
    if(this.stopped)return null;
    this.finished=true;this.finishedAt=Number.isFinite(now)?now:Date.now();this.finishReason=String(reason||'completed').slice(0,40);this.accumulator=0;this.projectiles=[];
    this.order=this.ranking();this.order.forEach((id,index)=>{this.players[id].placement=index+1;});this.clearAllInputs();return this.order;
  }

  stop(now=Date.now(),reason='stopped'){
    if(this.stopped)return false;
    this.stopped=true;this.stoppedAt=Number.isFinite(now)?now:Date.now();this.stopReason=String(reason||'stopped').slice(0,40);this.accumulator=0;
    this.clearAllInputs();this.projectiles=[];return true;
  }

  shouldStop(){return this.finished||this.stopped;}

  snapshot(now = Date.now()){
    const status=this.stopped?'stopped':this.finished?'finished':'running';
    return {protocol:'tank-authority-v1',matchId:this.matchId,serverTick:this.serverTick,serverNow:now,startedAt:this.startedAt,endAt:this.endAt,
      remainingMs:status==='running'?Math.max(0,this.endAt-now):0,status,running:status==='running',season:this.season,players:this.players.map(t=>({...t,input:{...t.input}})),
      projectiles:this.projectiles.map(p=>({...p})),destructibles:this.grid.map(row=>row.slice()),ack:this.lastSeq.slice(),finished:this.finished,finishedAt:this.finishedAt,
      finishReason:this.finishReason,stopped:this.stopped,stoppedAt:this.stoppedAt,stopReason:this.stopReason,order:this.order?this.order.slice():null};
  }
}

module.exports={TankAuthority,normalizeInput,hashString};
