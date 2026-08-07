'use strict';
const fs=require('fs');const path=require('path');const {spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),PORT=Number(process.env.SPECTATOR_PORT)||8127,DATA=fs.mkdtempSync(path.join(ROOT,'data','spectator-'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)process.exitCode=1;}
class Client{
  constructor(name){this.name=name;this.messages=[];this.waiters=[];this.token='';this.uid='';}
  async connect(){this.ws=new WebSocket('ws://127.0.0.1:'+PORT+'/ws');this.ws.onmessage=e=>{const msg=JSON.parse(e.data);this.messages.push(msg);this.waiters.splice(0).forEach(fn=>fn());};await new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});}
  send(type,payload){this.ws.send(JSON.stringify({type,payload}));}
  async wait(type,timeout=3000,predicate=null){const end=Date.now()+timeout;while(Date.now()<end){const index=this.messages.findIndex(item=>item.type===type&&(!predicate||predicate(item)));if(index>=0)return this.messages.splice(index,1)[0];await new Promise(resolve=>{this.waiters.push(resolve);setTimeout(resolve,30);});}throw new Error(this.name+' wait '+type+'; queued='+JSON.stringify(this.messages.slice(-8)));}
  async register(index){this.send('register',{uid:'u_spect'+String(index).padStart(2,'0'),pin:'SpecPin'+index,name:this.name});const msg=await this.wait('registered');this.token=msg.payload.token;this.uid=msg.payload.uid;}
  close(){if(this.ws)this.ws.close();}
}
async function selectAndStart(host,guest,game){
  host.send('select_game',{game});
  await host.wait('room_update',3000,msg=>msg.payload&&msg.payload.game===game);
  await guest.wait('room_update',3000,msg=>msg.payload&&msg.payload.game===game);
  guest.send('ready',{ready:true});
  await host.wait('room_update',3000,msg=>msg.payload&&msg.payload.game===game&&msg.payload.canStart===true);
  host.send('start');
  return { host: await host.wait('started'), guest: await guest.wait('started') };
}
async function main(){
  const server=spawn(process.execPath,[path.join(ROOT,'server','index.js')],{env:{...process.env,PORT:String(PORT),DATA_DIR:DATA,NODE_ENV:'test',ENABLE_RULE_AUTHORITY_V2:'0',MAX_SPECTATORS:'1',MONOPOLY_AUCTION_MS:'1000'},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  try{
    for(let i=0;i<80&&!output.includes('已启动');i++)await sleep(50);if(!output.includes('已启动'))throw new Error('server start failed '+output);
    const host=new Client('Host'),guest=new Client('Guest'),viewer=new Client('Viewer'),overflow=new Client('Overflow');
    for(const c of [host,guest,viewer,overflow])await c.connect();
    await host.register(1);await guest.register(2);await viewer.register(3);await overflow.register(4);
    host.send('create',{capacity:2});const created=await host.wait('created');const room=created.room;
    guest.send('join',{room});await guest.wait('joined');const startedPair=await selectAndStart(host,guest,'gomoku');const gomokuStarted=startedPair.host;host.send('move',{r:7,c:7});await sleep(80);
    viewer.send('spectate_join',{roomId:room,matchId:gomokuStarted.matchId});const joined=await viewer.wait('spectate_joined');
    assert('Spectator：中途加入且不占 Player Seat',joined.payload.role==='spectator'&&joined.payload.size===2&&joined.payload.spectatorCount===1);
    assert('Spectator：Initial Snapshot 含房间/比赛/玩家/外观与中途状态',joined.payload.matchId&&joined.payload.game==='gomoku'&&Array.isArray(joined.payload.players)&&Array.isArray(joined.payload.cosmetics)&&joined.payload.moveLog.length===1);
    viewer.send('move',{r:7,c:7});const denied=await viewer.wait('spectator_error');assert('Spectator：服务端拒绝 move',/只读/.test(denied.msg));
    viewer.send('tank_input',{matchId:joined.payload.matchId,seq:1,input:{up:true}});assert('Spectator：服务端拒绝 Tank Input',(await viewer.wait('spectator_error')).msg);
    overflow.send('spectate_join',{roomId:room,matchId:gomokuStarted.matchId});assert('Spectator：人数上限生效',/已满/.test((await overflow.wait('spectator_error')).msg));
    viewer.close();await sleep(80);const viewer2=new Client('ViewerReconnect');await viewer2.connect();viewer2.send('hello',{uid:viewer.uid,token:viewer.token,proto:1});const hello=await viewer2.wait('hello_ack');
    assert('Shared Protocol：hello_ack 公布完整能力协商',hello.capabilities.includes('tank_authority_v1')&&hello.capabilities.includes('spectator_room_v1')&&hello.capabilities.includes('monopoly_auction_v1'));
    viewer2.send('spectate_join',{roomId:room,matchId:gomokuStarted.matchId});
    assert('Spectator：断线后可重新加入观众席',(await viewer2.wait('spectate_joined')).payload.role==='spectator');
    host.send('end_game',{});const result=await viewer2.wait('match_result');assert('Spectator：游戏结束后收到最终结果',result.payload.matchId&&Array.isArray(result.payload.results));
    const xiangqiStarted=(await selectAndStart(host,guest,'xiangqi')).host;host.send('move',{from:[6,0],to:[5,0],seq:1});const clock=await guest.wait('clock_state');
    assert('Clock Online：合法顺序走子广播服务端棋钟',clock.payload.protocol==='xiangqi-clock-v1'&&clock.payload.activePlayer===1&&clock.payload.matchId===xiangqiStarted.matchId);
    host.send('end_game',{});await viewer2.wait('match_result');const monopolyStarted=(await selectAndStart(host,guest,'monopoly')).host;
    // 旧 Host Relay v1 先广播骰子，再由房主提交动画完成后的稳定快照，服务端据此建立待购地产。
    host.send('move',{matchId:monopolyStarted.matchId,roll:[1,1]});await guest.wait('move');
    host.send('game_state',{matchId:monopolyStarted.matchId,snapshot:{
      players:[{money:2000,pos:2,alive:true,props:[]},{money:2000,pos:0,alive:true,props:[]}],
      cur:0,phase:'buy',owners:Array(24).fill(-1),
    }});
    host.send('monopoly_auction_open',{matchId:monopolyStarted.matchId,propertyId:2});const opened=await guest.wait('auction_open');guest.send('monopoly_bid',{auctionId:opened.payload.auction.auctionId,amount:100,revision:opened.payload.auction.revision,bidId:'guest_bid_1'});await host.wait('auction_bid');const auctionClosed=await guest.wait('auction_closed',3000);
    assert('Auction Online：竞价、Server Deadline 与产权形成闭环',auctionClosed.payload.auction.currentBidder===1&&auctionClosed.payload.ownership[2]===1);
    host.send('leave',{});const closed=await viewer2.wait('peer_left');assert('Spectator：房主离开后房间保留并通知观战者',closed.payload.roomClosed===false,JSON.stringify(closed.payload));await guest.wait('host_changed');
    host.send('tournament_create',{gameId:'gomoku',participants:[host.uid,guest.uid,viewer.uid]});let tournament=(await host.wait('tournament_state')).payload;
    host.send('tournament_start',{tournamentId:tournament.tournamentId});assert('Tournament Online：未全员同意不能开始',/consent_required/.test((await host.wait('tournament_error')).msg));
    guest.send('tournament_consent',{tournamentId:tournament.tournamentId,accepted:true});await guest.wait('tournament_state');await host.wait('tournament_state');
    viewer2.send('tournament_consent',{tournamentId:tournament.tournamentId,accepted:true});await viewer2.wait('tournament_state');await host.wait('tournament_state');
    host.send('tournament_start',{tournamentId:tournament.tournamentId});tournament=(await host.wait('tournament_state')).payload;
    assert('Tournament Online：全员同意后自动创建真实比赛房',tournament.status==='round_playing'&&tournament.pairings.every(pair=>pair.pairingId&&pair.status==='playing'&&/^[A-Z0-9]{6}$/.test(pair.matchRoomId)));
    const pairing=tournament.pairings[0];host.send('tournament_result',{tournamentId:tournament.tournamentId,matchId:pairing.matchId,result:{winner:pairing.players[0]}});
    assert('Tournament Online：拒绝客户端手工伪造赛事结果',/真实房间/.test((await host.wait('tournament_error')).msg));
    [host,guest,viewer,viewer2,overflow].forEach(c=>c.close());
    if(!process.exitCode)console.log('SPECTATOR_ROOM_ALL_PASS');
  } finally {server.kill();try{fs.rmSync(DATA,{recursive:true,force:true});}catch{}}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
