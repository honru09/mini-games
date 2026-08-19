'use strict';

(function expose(root, factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.MonopolyUiState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function createMonopolyUiState(){
  const PHASES=new Set(['roll','resolving','moving','buy','chance','auction','finished','done']);
  const SOURCES=new Set(['started','live','room-restored','reconnect','spectator-bootstrap','result','snapshot']);
  function record(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  function int(value,fallback=-1){const n=Number(value);return Number.isInteger(n)?n:fallback;}
  function eventList(transition){return record(transition)&&Array.isArray(transition.events)?transition.events.filter(record):[];}
  function derive(input={}){
    const authority=record(input.authority)?input.authority:{};
    const state=record(input.state)?input.state:(record(authority.state)?authority.state:null);
    const source=SOURCES.has(input.source)?input.source:'live';
    const players=state&&Array.isArray(state.players)?state.players:[];
    const current=int(state&&state.current, int(authority.current,-1));
    const phase=String(input.phase||authority.phase||(state&&state.phase)||'');
    const terminal=!!(input.terminal||authority.terminal||(state&&state.terminal)||phase==='finished');
    const winner=int(input.winner, int(authority.winner, int(state&&state.winner,-1)));
    const seats=Array.isArray(input.seats)?input.seats:[];
    const transition=input.transition||authority.transition||null;
    const events=eventList(transition);
    const currentSeat=seats.find(seat=>record(seat)&&int(seat.seatId,int(seat.index,-1))===current)||seats[current];
    const fallback=input.fallbackReason||input.fallback||'';
    const result=(id,key,args=[],action='observe',extra={})=>({id,i18nKey:key,args,actionMode:action,canMutate:action!=='observe',ariaLive:['payment','bankrupt','disconnected','terminal'].includes(id)?'assertive':'polite',phase,source,currentPlayer:current,terminal,winner,fallback,...extra});
    if(fallback)return result('protocol_or_asset_fallback','monopoly_state_fallback',[],'observe',{fallbackReason:String(fallback)});
    if(!state||players.length<2)return result('entering','monopoly_state_entering',[],'observe');
    if(terminal)return result('terminal','monopoly_state_terminal',[],'observe');
    if(source==='reconnect'||source==='room-restored')return result('rejoined','monopoly_state_rejoined',[],'observe');
    if(source==='spectator-bootstrap'||input.spectator||input.role==='spectator')return result('spectator','monopoly_state_spectator',[],'observe');
    if(currentSeat&&currentSeat.online===false)return result('disconnected','monopoly_state_disconnected',[current+1],'observe');
    if(Number.isInteger(Number(input.focusBankrupt))&&players[Number(input.focusBankrupt)]&&players[Number(input.focusBankrupt)].alive===false)return result('bankrupt','monopoly_state_bankrupt',[Number(input.focusBankrupt)+1],'observe');
    if(events.some(event=>event.type==='bankrupt'||event.type==='bankruptcy'))return result('bankrupt','monopoly_state_bankrupt',[int(events.find(event=>event.type==='bankrupt'||event.type==='bankruptcy').player,current)+1],'observe');
    if(events.some(event=>['rent','tax','payment','purchase','pay'].includes(event.type)))return result('payment','monopoly_state_payment',[],'observe');
    if(events.some(event=>event.type==='chance'))return result('chance','monopoly_state_chance',[],'observe');
    if(events.some(event=>event.type==='land')){const landed=events.find(event=>event.type==='land'),player=int(landed.player,current),position=int(landed.position,-1),cellNames=Array.isArray(input.cellNames)?input.cellNames:[];return result('landing','monopoly_state_landing',[player+1,String(cellNames[position]||input.cellName||'')],'observe');}
    if(phase==='chance')return result('chance','monopoly_state_chance',[],'observe');
    if(phase==='auction'){
      const auction=record(state.auction)?state.auction:(record(input.auction)?input.auction:null);
      const bid=Number(auction&&auction.currentBid)||0;
      const remaining=Number(input.countdown!=null?input.countdown:(authority.auctionEndAt&&authority.serverNow?Math.max(0,Number(authority.auctionEndAt)-Number(authority.serverNow)):0));
      return result('auction','monopoly_state_auction',[bid,Math.ceil(Math.max(0,remaining)/1000)],input.allowMutation===false||input.spectator?'observe':'bid',{countdownMs:Math.max(0,remaining)});
    }
    if(phase==='buy'){
      const property=record(input.property)?input.property:null;
      return result('buy_decision','monopoly_state_buy_decision',[current+1,property&&property.name||String(input.cellName||''),Number(property&&property.price||input.price||0)],input.allowMutation===false||input.spectator?'observe':'buy');
    }
    if(phase==='resolving'||phase==='moving'||events.some(event=>event.type==='move'||event.type==='roll'))return result('roll_resolving','monopoly_state_roll_resolving',[current+1],'observe');
    if(input.tradeAvailable===false||input.action==='trade')return result('trade_unavailable','monopoly_state_trade_unavailable',[],'observe');
    if(phase==='roll')return result('roll_ready','monopoly_state_roll_ready',[Number(authority.round||state.round||1),Number(input.maxRound||30),current+1],input.allowMutation===false||input.spectator?'observe':'roll');
    return result('active','monopoly_state_roll_ready',[Number(authority.round||state.round||1),Number(input.maxRound||30),current+1],'observe');
  }
  return Object.freeze({derive,PHASES});
});
