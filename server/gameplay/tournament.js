'use strict';

function stableId(value){ return String(value && value.id !== undefined ? value.id : value); }

class TournamentOrchestrator {
  constructor(options = {}){
    this.protocol = 'tournament-orchestrator-v1';
    this.tournamentId = String(options.tournamentId || 'tournament_local');
    this.gameId = String(options.gameId || 'gomoku');
    this.maxRounds = Math.max(1, Number(options.rounds) || 3);
    this.byePoints = Number.isFinite(Number(options.byePoints)) ? Number(options.byePoints) : 3;
    this.participants = (options.participants || []).map((item, seed) => ({
      id:stableId(item), seed, points:0, wins:0, draws:0, losses:0, byes:0, opponents:[], active:true,
    }));
    if (this.participants.length < 3) throw new Error('tournament_requires_3_players');
    if (new Set(this.participants.map(item => item.id)).size !== this.participants.length) throw new Error('duplicate_participant');
    this.format = this.participants.length <= 4 ? 'round_robin' : 'swiss';
    this.status = 'waiting';
    this.round = 0;
    this.pairings = [];
    this.results = [];
    this.revision = 0;
    this.auditLog = [];
    this.roundRobinSchedule = this.format === 'round_robin' ? this.buildRoundRobin() : [];
  }

  buildRoundRobin(){
    const ids = this.participants.map(item => item.id);
    if (ids.length % 2) ids.push(null);
    const rounds = [];
    for (let round=0; round<ids.length-1; round++){
      const tables=[];
      for (let i=0; i<ids.length/2; i++){
        const a=ids[i], b=ids[ids.length-1-i];
        if (a !== null && b !== null) tables.push([a,b]);
      }
      rounds.push(tables);
      ids.splice(1,0,ids.pop());
    }
    return rounds;
  }

  standings(){
    const opponentPoints = player => player.opponents.reduce((sum,id) => {
      const opponent=this.participants.find(item=>item.id===id); return sum+(opponent?opponent.points:0);
    },0);
    return this.participants.map(item=>({...item,opponentPoints:opponentPoints(item)})).sort((a,b)=>
      b.points-a.points || b.wins-a.wins || b.opponentPoints-a.opponentPoints || a.seed-b.seed
    ).map((item,index)=>({...item,rank:index+1}));
  }

  swissPairs(){
    const standings=this.standings().slice();
    const bestMatching=pool=>{
      if(!pool.length)return{score:0,tables:[]};
      if(pool.length>12){
        const work=pool.slice(),tables=[];let score=0;
        while(work.length){const a=work.shift();let index=work.findIndex(b=>!a.opponents.includes(b.id));if(index<0)index=0;const b=work.splice(index,1)[0];score+=(a.opponents.includes(b.id)?10000:0)+Math.abs(a.points-b.points)*100+Math.abs(a.seed-b.seed);tables.push([a.id,b.id]);}
        return{score,tables};
      }
      const a=pool[0];let best=null;
      for(let index=1;index<pool.length;index++){
        const b=pool[index],rest=pool.slice(1,index).concat(pool.slice(index+1)),tail=bestMatching(rest);
        const score=tail.score+(a.opponents.includes(b.id)?10000:0)+Math.abs(a.points-b.points)*100+Math.abs(a.seed-b.seed);
        const tables=[[a.id,b.id],...tail.tables],key=JSON.stringify(tables);
        if(!best||score<best.score||score===best.score&&key<best.key)best={score,tables,key};
      }
      return best;
    };
    if(standings.length%2===0){const best=bestMatching(standings);return{tables:best.tables,bye:null};}
    let selected=null;
    for(const candidate of standings){
      const rest=standings.filter(item=>item.id!==candidate.id),matching=bestMatching(rest);
      const score=candidate.byes*1000000+candidate.points*1000+matching.score;
      if(!selected||score<selected.score||score===selected.score&&candidate.seed>selected.candidate.seed)selected={score,candidate,matching};
    }
    return{tables:selected.matching.tables,bye:selected.candidate.id};
  }

  start(){
    if(this.status!=='waiting')return false;
    this.status='round_ready'; this.revision++; return this.nextRound();
  }

  nextRound(){
    const limit=this.format==='round_robin'?this.roundRobinSchedule.length:this.maxRounds;
    if(this.round>=limit){this.status='finished';this.revision++;return null;}
    this.round++;
    const generated=this.format==='round_robin'?{tables:this.roundRobinSchedule[this.round-1],bye:null}:this.swissPairs();
    this.pairings=generated.tables.map((players,index)=>({
      matchId:this.tournamentId+'_r'+this.round+'_t'+(index+1),tournamentId:this.tournamentId,roundId:this.round,pairingId:this.tournamentId+'_r'+this.round+'_p'+(index+1),matchRoomId:this.tournamentId+'_r'+this.round+'_room'+(index+1),source:'tournament',table:index+1,players:players.slice(),status:'playing',result:null,resultSource:null,
    }));
    if(generated.bye){
      const player=this.participants.find(item=>item.id===generated.bye);player.points+=this.byePoints;player.wins++;player.byes++;
      this.results.push({round:this.round,matchId:null,players:[player.id],winner:player.id,bye:true});
    }
    this.status='round_playing';this.revision++;return this.snapshot();
  }

  attachMatchRoom(pairingId,matchRoomId,metadata={}){
    const pairing=this.pairings.find(item=>item.pairingId===String(pairingId||''));if(!pairing||pairing.status==='complete')return{ok:false,reason:'match_not_found'};
    pairing.matchRoomId=String(matchRoomId||pairing.matchRoomId);pairing.roomMetadata={tournamentId:this.tournamentId,roundId:this.round,pairingId:pairing.pairingId,matchRoomId:pairing.matchRoomId,source:'tournament',...(metadata||{})};this.auditLog.push({at:Date.now(),action:'room_created',pairingId:pairing.pairingId,matchRoomId:pairing.matchRoomId});this.revision++;return{ok:true,pairing:{...pairing,players:pairing.players.slice()}};
  }
  reportServerResult(matchId,result,metadata={}){
    const pairing=this.pairings.find(item=>item.matchId===String(matchId||'')||item.matchRoomId===String(matchId||''));if(!pairing)return{ok:false,reason:'match_not_found'};
    if(metadata.source!=='server'&&metadata.source!=='admin_recovery')return{ok:false,reason:'server_result_required'};
    if(metadata.matchRoomId&&String(metadata.matchRoomId)!==String(pairing.matchRoomId))return{ok:false,reason:'match_room_mismatch'};
    const normalized=result&&result.draw?{draw:true,forfeit:!!result.forfeit}:result&&Number.isInteger(result.winnerSlot)?{winner:pairing.players[result.winnerSlot],forfeit:!!result.forfeit}:result&&result.winnerUid?{winner:result.winnerUid,forfeit:!!result.forfeit}:result;
    return this.reportResult(pairing.matchId,{...(normalized||{}),source:metadata.source,serverMatchId:metadata.matchRoomId||pairing.matchRoomId});
  }
  reportResult(matchId, result){
    if(this.status!=='round_playing')return{ok:false,reason:'round_not_playing'};
    const pairing=this.pairings.find(item=>item.matchId===String(matchId||''));
    if(!pairing||pairing.status==='complete')return{ok:false,reason:pairing?'duplicate_result':'match_not_found'};
    const [aId,bId]=pairing.players,a=this.participants.find(item=>item.id===aId),b=this.participants.find(item=>item.id===bId);
    if(pairing.matchRoomId&&result&&result.source&&result.source!=='server'&&result.source!=='admin_recovery')return{ok:false,reason:'server_result_required'};
    const draw=result&&result.draw===true,winner=draw?null:String(result&&result.winner||'');
    if(!draw&&winner!==aId&&winner!==bId)return{ok:false,reason:'invalid_winner'};
    a.opponents.push(bId);b.opponents.push(aId);
    if(draw){a.points++;b.points++;a.draws++;b.draws++;}else if(winner===aId){a.points+=3;a.wins++;b.losses++;}else{b.points+=3;b.wins++;a.losses++;}
    pairing.status='complete';pairing.result={draw,winner:winner||null,forfeit:!!(result&&result.forfeit)};pairing.resultSource=result&&result.source||'manual';
    this.results.push({round:this.round,matchId:pairing.matchId,matchRoomId:pairing.matchRoomId,pairingId:pairing.pairingId,source:'tournament',players:pairing.players.slice(),...pairing.result});this.auditLog.push({at:Date.now(),action:'result_recorded',matchId:pairing.matchId,source:pairing.resultSource});this.revision++;
    if(this.pairings.every(item=>item.status==='complete')){
      this.status='round_complete';this.revision++;
      const limit=this.format==='round_robin'?this.roundRobinSchedule.length:this.maxRounds;
      if(this.round>=limit){this.status='finished';this.revision++;}
    }
    return{ok:true,state:this.snapshot()};
  }

  advance(){ if(this.status!=='round_complete')return null;return this.nextRound(); }
  snapshot(){return{protocol:this.protocol,tournamentId:this.tournamentId,gameId:this.gameId,format:this.format,status:this.status,round:this.round,maxRounds:this.format==='round_robin'?this.roundRobinSchedule.length:this.maxRounds,
    pairings:this.pairings.map(item=>({...item,players:item.players.slice(),result:item.result&&{...item.result},roomMetadata:item.roomMetadata&&{...item.roomMetadata}})),standings:this.standings(),results:this.results.map(item=>({...item,players:item.players.slice()})),auditLog:this.auditLog.slice(-100),revision:this.revision,byePoints:this.byePoints};}
}

module.exports={TournamentOrchestrator};
