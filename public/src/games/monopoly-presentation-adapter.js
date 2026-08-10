'use strict';

(function expose(root, factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.MonopolyPresentationAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function createMonopolyPresentationAdapter(root){
  const PROTOCOL='monopoly-rule-v2',BOARD_SIZE=24;
  const PHASES=new Set(['roll','resolving','buy','chance','auction','finished']);
  const CAUSES=new Set(['live','started','room-restored','reconnect','spectator-bootstrap','result']);
  function safeRecord(value){if(!value||typeof value!=='object'||Array.isArray(value))return false;try{return Object.prototype.toString.call(value)==='[object Object]';}catch{return false;}}
  function safeInt(value,min,max){return Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;}
  function clonePlayers(state){return state.players.map((player,index)=>({id:index,pos:Number(player.pos),visualPos:Number(player.pos),alive:player.alive!==false,motionDirection:1}));}
  function movementEvent(transition,previous,players){
    if(!safeRecord(transition)||transition.type!=='monopoly_transition'||!Array.isArray(transition.events))return null;
    const moves=transition.events.filter(event=>safeRecord(event)&&event.type==='move');
    if(moves.length!==1)return null;
    const event=moves[0],player=Number(event.player),from=Number(event.from),to=Number(event.to),steps=Number(event.steps);
    if(!safeInt(player,0,players.length-1)||!safeInt(from,0,BOARD_SIZE-1)||!safeInt(to,0,BOARD_SIZE-1)||!Number.isInteger(steps)||!(steps===-2||(steps>=2&&steps<=12)))return null;
    if(!previous||!previous[player]||previous[player].pos!==from||players[player].pos!==to)return null;
    const expected=((from+steps)%BOARD_SIZE+BOARD_SIZE)%BOARD_SIZE;
    if(expected!==to)return null;
    return {player,from,to,steps,direction:steps<0?-1:1};
  }
  function create(options={}){
    const projector=typeof options.projector==='function'?options.projector:(root&&root.MonopolyCharacterPresentation&&root.MonopolyCharacterPresentation.project);
    let destroyed=false,last=null;
    function reject(reason){return{accepted:false,frame:null,fallbackReason:reason};}
    function consume(input){
      if(destroyed)return reject('destroyed');
      if(!safeRecord(input))return reject('invalid_input');
      const authority=safeRecord(input.authority)?input.authority:input;
      const cause=CAUSES.has(input.cause)?input.cause:(CAUSES.has(input.source)?input.source:'live');
      const state=safeRecord(authority.state)?authority.state:null;
      if(authority.protocol!==PROTOCOL||typeof authority.matchId!=='string'||authority.matchId.length<1||authority.matchId.length>160)return reject('invalid_protocol');
      if(!safeInt(authority.revision,0,Number.MAX_SAFE_INTEGER)||typeof authority.stateHash!=='string'||authority.stateHash.length<1||authority.stateHash.length>160)return reject('invalid_revision');
      if(!state||!Array.isArray(state.players)||state.players.length<2||state.players.length>5||!safeInt(state.current,0,state.players.length-1))return reject('invalid_state');
      const players=state.players.map((player,index)=>safeRecord(player)&&safeInt(player.pos,0,BOARD_SIZE-1)&&(!Object.prototype.hasOwnProperty.call(player,'id')||Number(player.id)===index)?{id:index,pos:Number(player.pos),alive:player.alive!==false}:null);
      if(players.some(player=>!player))return reject('invalid_position');
      const phase=PHASES.has(authority.phase)?authority.phase:(PHASES.has(state.phase)?state.phase:null);if(!phase)return reject('invalid_phase');
      const isBootstrap=CAUSES.has(cause)&&cause!=='live';
      if(!isBootstrap&&last&&last.matchId===authority.matchId&&authority.revision<=last.revision)return reject('stale_revision');
      const previous=!isBootstrap&&last&&last.matchId===authority.matchId?last.players:null;
      const transition=input.transition||authority.transition||null;
      const move=cause==='live'&&previous&&authority.revision===last.revision+1&&!input.reducedMotion?movementEvent(transition,previous,players):null;
      const sourceForProject=move?'live':'snapshot';
      const projectedPlayers=players.map((player,index)=>({...player,visualPos:move&&move.player===index?move.from:player.pos,motionDirection:move&&move.player===index?move.direction:1}));
      let projected=[];try{projected=typeof projector==='function'?projector({players:projectedPlayers,seats:Array.isArray(input.seats)?input.seats:[],current:Number(state.current),phase,over:!!(state.terminal||authority.terminal),winner:Number.isInteger(Number(authority.winner))?Number(authority.winner):-1,source:sourceForProject,reducedMotion:!!input.reducedMotion}):[];}catch{projected=[];}
      const fallback=move?null:(previous?'continuity_lost':'initial_snap');
      const bankruptPlayers=previous?players.filter((player,index)=>previous[index]&&previous[index].alive&&player.alive===false).map(player=>player.id):[];
      const frame={protocol:PROTOCOL,matchId:authority.matchId,revision:Number(authority.revision),stateHash:authority.stateHash,phase,currentPlayerId:Number(state.current),round:Number(authority.round||state.round||1),terminal:!!(state.terminal||authority.terminal),winner:Number.isInteger(Number(authority.winner))?Number(authority.winner):-1,players:players.map((player,index)=>({playerId:index,seatId:index,authorityPosition:player.pos,displayPosition:move&&move.player===index?move.from:player.pos,visible:player.alive,presentation:projected[index]||null})),action:transition&&transition.action?String(transition.action):null,countdown:Number.isFinite(Number(authority.auctionEndAt))?Math.max(0,Number(authority.auctionEndAt)-Number(authority.serverNow||Date.now())):null,changes:{bankruptPlayers},animation:move?{mode:'step',player:move.player,from:move.from,to:move.to,steps:move.steps,direction:move.direction}:{mode:'snap'},accessibility:{reducedMotion:!!input.reducedMotion},fallback};
      last={matchId:authority.matchId,revision:Number(authority.revision),stateHash:authority.stateHash,players};
      return{accepted:true,frame,fallbackReason:fallback};
    }
    function reset(reason){last=null;return{accepted:true,frame:null,fallbackReason:reason||'reset'};}
    function destroy(){destroyed=true;last=null;}
    return Object.freeze({consume,reset,destroy});
  }
  return Object.freeze({PROTOCOL,BOARD_SIZE,create});
});
