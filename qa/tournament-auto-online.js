'use strict';

const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const PORT=Number(process.env.TOURNAMENT_AUTO_PORT)||8141;
const DATA=fs.mkdtempSync(path.join(ROOT,'data','tournament-auto-online-'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

class Client{
  constructor(name){this.name=name;this.messages=[];this.waiters=[];this.uid='';this.token='';}
  async connect(){this.ws=new WebSocket('ws://127.0.0.1:'+PORT+'/ws');this.ws.onmessage=event=>{const msg=JSON.parse(event.data);this.messages.push(msg);this.waiters.splice(0).forEach(resolve=>resolve());};await new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});}
  send(type,payload){this.ws.send(JSON.stringify({type,payload}));}
  async waitWhere(type,predicate=()=>true,timeout=8000){const end=Date.now()+timeout;while(Date.now()<end){const index=this.messages.findIndex(item=>item.type===type&&predicate(item));if(index>=0)return this.messages.splice(index,1)[0];await new Promise(resolve=>{this.waiters.push(resolve);setTimeout(resolve,25);});}throw new Error(this.name+' wait '+type+'; queued='+JSON.stringify(this.messages.slice(-10)));}
  async register(index){this.send('register',{uid:'u_tourauto'+String(index).padStart(2,'0'),pin:'TourAutoPin'+index,name:this.name});const registered=await this.waitWhere('registered');this.uid=registered.payload.uid;this.token=registered.payload.token;this.send('hello',{uid:this.uid,token:this.token,proto:1,capabilities:['tournament-orchestrator-v1']});const hello=await this.waitWhere('hello_ack');if(!hello.authenticated)throw new Error(this.name+' auth failed');}
  close(){try{this.ws&&this.ws.close();}catch{}}
}

async function main(){
  const server=spawn(process.execPath,[path.join(ROOT,'server','index.js')],{env:{...process.env,PORT:String(PORT),DATA_DIR:DATA,NODE_ENV:'test',ENABLE_RULE_AUTHORITY_V2:'0',SUPABASE_URL:'',SUPABASE_KEY:'',DEEPSEEK_KEY:'',REWARD_TEST_MIN_DURATION_MS:'0',REWARD_TEST_MIN_ACTIONS:'0',REWARD_TEST_MIN_PLAYER_ACTIONS:'0'},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
  const clients=[new Client('TourHost'),new Client('TourP2'),new Client('TourP3')];
  try{
    for(let i=0;i<100&&!output.includes('已启动');i++)await sleep(50);if(!output.includes('已启动'))throw new Error('server start failed '+output);
    for(let i=0;i<clients.length;i++){await clients[i].connect();await clients[i].register(i+1);}
    const [host,p2,p3]=clients;host.send('create',{capacity:3});const created=await host.waitWhere('created');p2.send('join',{room:created.room});await p2.waitWhere('joined');p3.send('join',{room:created.room});await p3.waitWhere('joined');
    const participantIds=clients.map(client=>client.uid);host.send('tournament_create',{gameId:'gomoku',participants:participantIds});const waiting=await host.waitWhere('tournament_state',msg=>msg.payload&&msg.payload.status==='waiting');const tournamentId=waiting.payload.tournamentId;
    p2.send('tournament_consent',{tournamentId,accepted:true});p3.send('tournament_consent',{tournamentId,accepted:true});
    await host.waitWhere('tournament_state',msg=>msg.payload&&participantIds.every(uid=>msg.payload.consents&&msg.payload.consents[uid]===true));
    host.send('tournament_start',{tournamentId});

    const byUid=new Map(clients.map(client=>[client.uid,client])),roomIds=[];let finished=null;
    for(let round=1;round<=3;round++){
      const state=(await host.waitWhere('tournament_state',msg=>msg.payload&&msg.payload.round===round&&msg.payload.status==='round_playing'&&msg.payload.pairings&&msg.payload.pairings.length===1&&/^[A-Z0-9]{6}$/.test(msg.payload.pairings[0].matchRoomId),12000)).payload;
      const pairing=state.pairings[0],players=pairing.players.map(uid=>byUid.get(uid));roomIds.push(pairing.matchRoomId);
      const assignments=[];
      for(const player of players){const assigned=(await player.waitWhere('tournament_match_assigned',msg=>msg.payload&&msg.payload.tournamentId===tournamentId&&msg.payload.roundId===round,6000)).payload;assignments.push(assigned);await player.waitWhere('started',msg=>msg.matchId===assigned.matchId&&msg.game==='gomoku',6000);}
      check('Tournament Auto Online：第 '+round+' 轮自动建真实房并分配双方',assignments.length===2&&assignments[0].matchRoomId===pairing.matchRoomId&&assignments[1].matchRoomId===pairing.matchRoomId&&new Set(assignments.map(item=>item.player)).size===2);
      const results=[{slot:0,rank:1,coins:1},{slot:1,rank:2,coins:0}];
      for(let i=0;i<players.length;i++)players[i].send('result',{matchId:assignments[i].matchId,game:'gomoku',results});
      const completed=(await host.waitWhere('tournament_state',msg=>msg.payload&&msg.payload.round===round&&(round===3?msg.payload.status==='finished':msg.payload.status==='round_complete'),10000)).payload;
      if(round===3)finished=completed;
    }
    check('Tournament Auto Online：三人循环赛自动完成三轮',finished.round===3&&finished.results.length===3&&finished.pairings.every(pairing=>pairing.status==='complete'));
    check('Tournament Auto Online：每轮真实房间唯一',new Set(roomIds).size===3&&roomIds.every(id=>/^[A-Z0-9]{6}$/.test(id)));
    check('Tournament Auto Online：最终积分表覆盖全部参与者',finished.standings.length===3&&new Set(finished.standings.map(item=>item.id)).size===3);
    if(!failures.length)console.log('TOURNAMENT_AUTO_ONLINE_ALL_PASS');
  } finally {clients.forEach(client=>client.close());server.kill();try{fs.rmSync(DATA,{recursive:true,force:true});}catch{}}
  if(failures.length){console.error('TOURNAMENT_AUTO_ONLINE_FAILED:',failures.join('、'));process.exitCode=1;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
