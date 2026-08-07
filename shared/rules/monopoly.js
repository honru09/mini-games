'use strict';

(function expose(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.MonopolyRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function createMonopolyRules(){
  const PROTOCOL='monopoly-rule-v2',START_MONEY=2000,MAX_ROUND=30;
  const CELLS=[
    {name:'起点',type:'go'},{name:'机会',type:'chance'},{name:'蓝湾',type:'prop',price:300},{name:'纳税',type:'tax',amount:500},{name:'绿谷',type:'prop',price:350},{name:'车站',type:'prop',price:400},
    {name:'机会',type:'chance'},{name:'金街',type:'prop',price:450},{name:'红山',type:'prop',price:500},{name:'休息',type:'rest'},{name:'紫苑',type:'prop',price:550},{name:'橙园',type:'prop',price:600},
    {name:'机会',type:'chance'},{name:'黄都',type:'prop',price:650},{name:'青湖',type:'prop',price:700},{name:'纳税',type:'tax',amount:700},{name:'粉港',type:'prop',price:750},{name:'白塔',type:'prop',price:800},
    {name:'机会',type:'chance'},{name:'灰堡',type:'prop',price:850},{name:'棕野',type:'prop',price:900},{name:'车站',type:'prop',price:950},{name:'黑金',type:'prop',price:1000},{name:'机会',type:'chance'},
  ];
  const CHANCE=[{text:'意外之财，获得 800',cash:800},{text:'房屋维修，支出 600',cash:-600},{text:'前进 3 格',move:3},{text:'后退 2 格',move:-2},{text:'直达起点，获得 2000',go:true},{text:'大家赞助你，每人给你 200',each:200},{text:'请大家吃饭，给每人 200',each:-200},{text:'投资回报，获得 500',cash:500}];

  function hashSeed(value){let hash=2166136261>>>0;for(let i=0;i<String(value).length;i++){hash^=String(value).charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}return hash||0x9e3779b9;}
  function randomAt(seed,counter){let value=hashSeed(String(seed)+'|'+counter);value^=value<<13;value^=value>>>17;value^=value<<5;return(value>>>0)/4294967296;}
  function shuffledDeck(seed){const deck=CHANCE.map((_,index)=>index);for(let i=deck.length-1;i>0;i--){const j=Math.floor(randomAt(seed,'chance-'+i)*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;}
  function createInitialState(options={}){
    const playerCount=Math.max(2,Math.min(5,Number(options.playerCount)||2)),seed=String(options.seed||'local');
    return{protocol:PROTOCOL,seed,rngCounter:0,players:Array.from({length:playerCount},(_,id)=>({id,money:START_MONEY,pos:0,alive:true,props:[]})),owners:{},current:0,round:1,phase:'roll',pendingProperty:-1,chanceDeck:shuffledDeck(seed),chanceIndex:0,auction:null,terminal:false,winner:-1,placements:[],lastEvent:null};
  }
  function cloneState(state){return{...state,players:state.players.map(player=>({...player,props:player.props.slice()})),owners:{...state.owners},chanceDeck:state.chanceDeck.slice(),auction:state.auction?{...state.auction,eligiblePlayers:state.auction.eligiblePlayers.slice(),seenBidIds:state.auction.seenBidIds.slice()}:null,placements:state.placements.slice(),lastEvent:state.lastEvent?JSON.parse(JSON.stringify(state.lastEvent)):null};}
  function rentOf(cell){return Math.round(cell.price/3/10)*10;}
  function netWorth(state,playerId){const player=state.players[playerId];return player?player.money+player.props.reduce((sum,index)=>sum+Number(CELLS[index]&&CELLS[index].price||0),0):0;}
  function placement(state){return state.players.map(player=>player.id).sort((a,b)=>(Number(state.players[b].alive)-Number(state.players[a].alive))||netWorth(state,b)-netWorth(state,a)||a-b);}
  function releaseProperties(state,player){for(const propertyId of player.props)delete state.owners[propertyId];player.props=[];}
  function updateTerminal(state,reason){const alive=state.players.filter(player=>player.alive);if(alive.length<=1){state.terminal=true;state.winner=alive[0]?alive[0].id:placement(state)[0];state.placements=placement(state);state.phase='finished';state.reason=reason||'LAST_SOLVENT';return true;}return false;}
  function bankruptIfNeeded(state,playerId){const player=state.players[playerId];if(!player||!player.alive||player.money>=0)return false;player.alive=false;releaseProperties(state,player);updateTerminal(state,'BANKRUPTCY');return true;}
  function transferCash(state,from,to,amount){const value=Math.max(0,Math.floor(Number(amount)||0)),payer=state.players[from];if(!payer||!payer.alive)return;payer.money-=value;if(Number.isInteger(to)&&state.players[to]&&state.players[to].alive)state.players[to].money+=value;bankruptIfNeeded(state,from);}
  function rollDie(state){const value=1+Math.floor(randomAt(state.seed,state.rngCounter++)*6);return value;}
  function movePlayer(state,playerId,steps){const player=state.players[playerId],old=player.pos,signed=Number(steps)||0;if(signed>0&&old+signed>=CELLS.length)player.money+=2000;player.pos=((old+signed)%CELLS.length+CELLS.length)%CELLS.length;return{from:old,to:player.pos,passedStart:signed>0&&old+signed>=CELLS.length};}
  function finishByRound(state){state.terminal=true;state.placements=placement(state);state.winner=state.placements[0];state.phase='finished';state.reason='ROUND_LIMIT';}
  function advanceTurn(state){
    if(state.terminal)return;const previous=state.current;if(previous===state.players.length-1)state.round++;
    if(state.round>MAX_ROUND){finishByRound(state);return;}
    do{state.current=(state.current+1)%state.players.length;}while(!state.players[state.current].alive);state.phase='roll';state.pendingProperty=-1;state.auction=null;
  }
  function drawChance(state){const index=state.chanceDeck[state.chanceIndex%state.chanceDeck.length];state.chanceIndex++;return{index,card:CHANCE[index]};}
  function resolveChance(state,playerId,depth,events){
    if(depth>=3){advanceTurn(state);return;}const draw=drawChance(state),card=draw.card,player=state.players[playerId];events.push({type:'chance',player:playerId,index:draw.index,card:{...card}});
    if(Number.isFinite(card.cash)){player.money+=card.cash;bankruptIfNeeded(state,playerId);if(!state.terminal)advanceTurn(state);return;}
    if(Number.isFinite(card.each)){
      if(card.each>0){for(const other of state.players)if(other.id!==playerId&&other.alive){const amount=Math.min(card.each,Math.max(0,other.money+card.each));transferCash(state,other.id,playerId,amount);if(state.terminal)return;}}
      else for(const other of state.players)if(other.id!==playerId&&other.alive){transferCash(state,playerId,other.id,-card.each);if(state.terminal)return;}
      advanceTurn(state);return;
    }
    if(Number.isFinite(card.move)){events.push({type:'move',player:playerId,...movePlayer(state,playerId,card.move),steps:card.move});resolveLanding(state,playerId,depth+1,events);return;}
    if(card.go){player.pos=0;player.money+=2000;advanceTurn(state);return;}
    advanceTurn(state);
  }
  function resolveLanding(state,playerId,depth,events){
    if(state.terminal)return;const player=state.players[playerId],cell=CELLS[player.pos];events.push({type:'land',player:playerId,position:player.pos,cellType:cell.type});
    if(cell.type==='go'||cell.type==='rest'){advanceTurn(state);return;}
    if(cell.type==='tax'){transferCash(state,playerId,null,cell.amount);if(!state.terminal)advanceTurn(state);return;}
    if(cell.type==='chance'){state.phase='chance';resolveChance(state,playerId,depth||0,events);return;}
    if(cell.type==='prop'){
      const owner=Object.prototype.hasOwnProperty.call(state.owners,player.pos)?Number(state.owners[player.pos]):-1;
      if(owner<0){state.phase='buy';state.pendingProperty=player.pos;return;}
      if(owner===playerId){advanceTurn(state);return;}
      const rent=rentOf(cell);transferCash(state,playerId,owner,rent);events.push({type:'rent',player:playerId,owner,amount:rent,propertyId:player.pos});if(!state.terminal)advanceTurn(state);
    }
  }
  function openAuction(state,propertyId){state.phase='auction';state.auction={auctionId:'auction-'+state.round+'-'+state.current+'-'+propertyId,propertyId,currentBid:0,currentBidder:-1,eligiblePlayers:state.players.filter(player=>player.alive&&player.money>0).map(player=>player.id),revision:1,seenBidIds:[]};}
  function validateAction(state,action,player=state&&state.current){
    if(!state||state.protocol!==PROTOCOL)return{ok:false,reason:'ERR_INVALID_STATE'};if(state.terminal)return{ok:false,reason:'ERR_MATCH_FINISHED'};if(!Number.isInteger(player)||player<0||player>=state.players.length)return{ok:false,reason:'ERR_INVALID_STATE'};if(!action||typeof action!=='object')return{ok:false,reason:'ERR_INVALID_MOVE'};
    if(action.type==='settle')return player===0?{ok:true}:{ok:false,reason:'ERR_NOT_ACTIVE_PLAYER'};
    if(action.type==='bid'){const auction=state.auction;if(state.phase!=='auction'||!auction)return{ok:false,reason:'ERR_INVALID_STATE'};if(!auction.eligiblePlayers.includes(player))return{ok:false,reason:'ERR_NOT_ACTIVE_PLAYER'};const amount=Number(action.amount);if(!Number.isSafeInteger(amount)||amount<=auction.currentBid||amount>state.players[player].money)return{ok:false,reason:'ERR_INVALID_MOVE'};if(action.revision!==undefined&&Number(action.revision)!==auction.revision)return{ok:false,reason:'ERR_STALE_SEQ'};if(action.bidId&&auction.seenBidIds.includes(String(action.bidId)))return{ok:false,reason:'ERR_DUPLICATE_ACTION'};return{ok:true};}
    if(action.type==='close_auction')return state.phase==='auction'&&state.auction?{ok:true}:{ok:false,reason:'ERR_INVALID_STATE'};
    if(player!==state.current)return{ok:false,reason:'ERR_NOT_ACTIVE_PLAYER'};
    if(action.type==='roll')return state.phase==='roll'?{ok:true}:{ok:false,reason:'ERR_INVALID_STATE'};
    if(action.type==='buy'||action.type==='pass')return state.phase==='buy'&&state.pendingProperty===state.players[player].pos?{ok:true}:{ok:false,reason:'ERR_INVALID_STATE'};
    return{ok:false,reason:'ERR_INVALID_MOVE'};
  }
  function applyAction(state,action,player=state&&state.current){
    const validation=validateAction(state,action,player);if(!validation.ok)return validation;const next=cloneState(state),events=[];
    if(action.type==='settle'){finishByRound(next);next.reason='ADMIN_SETTLE';events.push({type:'settle'});}
    else if(action.type==='roll'){const d1=rollDie(next),d2=rollDie(next),movement=movePlayer(next,player,d1+d2);events.push({type:'roll',player,dice:[d1,d2]},{type:'move',player,...movement,steps:d1+d2});next.phase='resolving';resolveLanding(next,player,0,events);}
    else if(action.type==='buy'){
      const propertyId=next.pendingProperty,cell=CELLS[propertyId],buyer=next.players[player];if(buyer.money>=cell.price){buyer.money-=cell.price;buyer.props.push(propertyId);next.owners[propertyId]=player;events.push({type:'purchase',player,propertyId,amount:cell.price});}else events.push({type:'purchase_rejected',player,propertyId,reason:'INSUFFICIENT_CASH'});advanceTurn(next);
    }else if(action.type==='pass'){const propertyId=next.pendingProperty;openAuction(next,propertyId);events.push({type:'auction_open',propertyId,auctionId:next.auction.auctionId});}
    else if(action.type==='bid'){const auction=next.auction,bidId=String(action.bidId||('bid-'+player+'-'+auction.revision));auction.currentBid=Number(action.amount);auction.currentBidder=player;auction.revision++;auction.seenBidIds.push(bidId);auction.seenBidIds=auction.seenBidIds.slice(-100);events.push({type:'auction_bid',player,amount:auction.currentBid,revision:auction.revision,bidId});}
    else if(action.type==='close_auction'){const auction=next.auction;if(auction.currentBidder>=0){const winner=next.players[auction.currentBidder];winner.money-=auction.currentBid;winner.props.push(auction.propertyId);next.owners[auction.propertyId]=winner.id;events.push({type:'auction_closed',winner:winner.id,amount:auction.currentBid,propertyId:auction.propertyId});}else events.push({type:'auction_closed',winner:-1,amount:0,propertyId:auction.propertyId});advanceTurn(next);}
    next.lastEvent={player,action:{...action},events};return{ok:true,state:next,event:{type:'monopoly_transition',player,action:action.type,events,terminal:next.terminal,winner:next.winner}};
  }
  function getLegalActions(state,player=state&&state.current){
    if(!state||state.terminal)return[];const actions=[];
    if(state.phase==='roll'&&player===state.current)actions.push({type:'roll'});
    if(state.phase==='buy'&&player===state.current)actions.push({type:'buy'},{type:'pass'});
    if(state.phase==='auction'&&state.auction&&state.auction.eligiblePlayers.includes(player))actions.push({type:'bid',amount:state.auction.currentBid+100,revision:state.auction.revision});
    return actions.filter(action=>validateAction(state,action,player).ok);
  }
  function isTerminal(state){return!!(state&&state.terminal);}
  function getResult(state){return!isTerminal(state)?null:{winner:state.winner,order:state.placements.length?state.placements.slice():placement(state),reason:state.reason};}
  function serialize(state){return JSON.stringify(state);}
  function deserialize(value){const parsed=typeof value==='string'?JSON.parse(value):value;if(!parsed||parsed.protocol!==PROTOCOL||!Array.isArray(parsed.players)||parsed.players.length<2||parsed.players.length>5)throw new Error('invalid_monopoly_state');return cloneState(parsed);}
  function hashState(state){const text=serialize(state);let hash=2166136261>>>0;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}return hash.toString(16).padStart(8,'0');}

  return{PROTOCOL,CELLS,CHANCE,START_MONEY,MAX_ROUND,createInitialState,validateAction,applyAction,getLegalActions,isTerminal,getResult,serialize,deserialize,hashState,netWorth,placement,rentOf};
});
