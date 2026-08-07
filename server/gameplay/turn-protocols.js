'use strict';

function integer(value, fallback = 0){
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

class XiangqiClockAuthority {
  constructor(options = {}){
    this.protocol = 'xiangqi-clock-v1';
    this.matchId = String(options.matchId || '');
    this.initialMs = Math.max(1000, integer(options.initialMs, 10 * 60 * 1000));
    this.remainingMsByPlayer = [this.initialMs, this.initialMs];
    this.activePlayer = 0;
    this.turnStartedAt = integer(options.startedAt, Date.now());
    this.lastSeq = [0, 0];
    this.revision = 0;
    this.finished = false;
    this.loser = -1;
    this.winner = -1;
  }

  effectiveRemaining(player, now = Date.now()){
    const base = this.remainingMsByPlayer[player] || 0;
    return Math.max(0, base - (player === this.activePlayer && !this.finished ? Math.max(0, now - this.turnStartedAt) : 0));
  }

  timeout(now = Date.now()){
    if (this.finished || this.effectiveRemaining(this.activePlayer, now) > 0) return null;
    this.remainingMsByPlayer[this.activePlayer] = 0;
    this.loser = this.activePlayer;
    this.winner = 1 - this.activePlayer;
    this.finished = true;
    this.revision++;
    return { type:'clock_timeout', payload:{ ...this.snapshot(now), loser:this.loser, winner:this.winner } };
  }

  acceptMove(player, payload, now = Date.now()){
    const timedOut = this.timeout(now);
    if (timedOut) return { ok:false, reason:'timeout', timeout:timedOut };
    if (this.finished) return { ok:false, reason:'finished' };
    if (String(payload && payload.matchId || '') !== this.matchId) return { ok:false, reason:'invalid_match' };
    if (player !== this.activePlayer) return { ok:false, reason:'not_your_turn' };
    const seq = integer(payload && payload.seq, -1);
    if (seq < 1 || seq <= this.lastSeq[player]) return { ok:false, reason:'stale_seq' };
    this.remainingMsByPlayer[player] = this.effectiveRemaining(player, now);
    if (this.remainingMsByPlayer[player] <= 0){
      const timeout = this.timeout(now);
      return { ok:false, reason:'timeout', timeout };
    }
    this.lastSeq[player] = seq;
    this.activePlayer = 1 - player;
    this.turnStartedAt = now;
    this.revision++;
    return { ok:true, state:this.snapshot(now) };
  }

  snapshot(now = Date.now()){
    const remaining = this.remainingMsByPlayer.map((_, player) => this.effectiveRemaining(player, now));
    return {
      protocol:this.protocol, matchId:this.matchId, revision:this.revision, clockMode:'countdown',
      initialMs:this.initialMs, remainingMsByPlayer:remaining, activePlayer:this.activePlayer,
      turnStartedAt:this.turnStartedAt, serverNow:now, finished:this.finished, loser:this.loser, winner:this.winner,
    };
  }
}

// This is the board shipped by public/src/games/monopoly.js. Keeping the
// contract here prevents a client from auctioning an arbitrary numeric cell.
const MONOPOLY_BOARD = Object.freeze([
  { name:'起点', type:'go' },
  { name:'机会', type:'chance' },
  { name:'蓝湾', type:'prop', price:300 },
  { name:'纳税', type:'tax', amount:500 },
  { name:'绿谷', type:'prop', price:350 },
  { name:'车站', type:'prop', price:400 },
  { name:'机会', type:'chance' },
  { name:'金街', type:'prop', price:450 },
  { name:'红山', type:'prop', price:500 },
  { name:'休息', type:'rest' },
  { name:'紫苑', type:'prop', price:550 },
  { name:'橙园', type:'prop', price:600 },
  { name:'机会', type:'chance' },
  { name:'黄都', type:'prop', price:650 },
  { name:'青湖', type:'prop', price:700 },
  { name:'纳税', type:'tax', amount:700 },
  { name:'粉港', type:'prop', price:750 },
  { name:'白塔', type:'prop', price:800 },
  { name:'机会', type:'chance' },
  { name:'灰堡', type:'prop', price:850 },
  { name:'棕野', type:'prop', price:900 },
  { name:'车站', type:'prop', price:950 },
  { name:'黑金', type:'prop', price:1000 },
  { name:'机会', type:'chance' },
].map(cell => Object.freeze({...cell})));

const MONOPOLY_CHANCE = Object.freeze([
  Object.freeze({ cash:800 }),
  Object.freeze({ cash:-600 }),
  Object.freeze({ move:3 }),
  Object.freeze({ move:-2 }),
  Object.freeze({ go:true }),
  Object.freeze({ each:200 }),
  Object.freeze({ each:-200 }),
  Object.freeze({ cash:500 }),
]);

function own(object, key){
  return Object.prototype.hasOwnProperty.call(object, key);
}

function cloneOwnership(ownership){
  const copy = {};
  for (const [key, value] of Object.entries(ownership || {})) copy[key] = value;
  return copy;
}

class MonopolyAuctionAuthority {
  constructor(options = {}){
    this.protocol = 'monopoly-auction-v1';
    this.matchId = String(options.matchId || '');
    this.playerCount = Math.max(2, Math.min(5, integer(options.playerCount, 2)));
    this.durationMs = Math.max(1000, integer(options.durationMs, 5000));
    this.cash = Array.from({ length:this.playerCount }, (_, player) => {
      const source = Array.isArray(options.cash) ? options.cash[player] : undefined;
      return Math.max(0, integer(source, 2000));
    });
    this.positions = Array.from({ length:this.playerCount }, (_, player) => {
      const source = Array.isArray(options.positions) ? options.positions[player] : undefined;
      const position = integer(source, 0);
      return position >= 0 && position < MONOPOLY_BOARD.length ? position : 0;
    });
    this.alive = Array.from({ length:this.playerCount }, (_, player) =>
      !Array.isArray(options.alive) || options.alive[player] !== false);
    this.ownership = {};
    for (const [rawPropertyId, rawOwner] of Object.entries(options.ownership || {})){
      const propertyId = integer(rawPropertyId, -1);
      const owner = integer(rawOwner, -1);
      if (this.isProperty(propertyId) && owner >= 0 && owner < this.playerCount && this.alive[owner]){
        this.ownership[propertyId] = owner;
      }
    }
    this.currentPlayer = this.firstAlive(integer(options.currentPlayer, 0));
    this.phase = 'roll';
    this.pendingPurchase = null;
    this.auction = null;
    this.sequence = 0;
    this.revision = 0;
    this.lastCompletedPlayer = -1;
    const requestedDeck = Array.isArray(options.chanceDeck) ? options.chanceDeck.map(value => integer(value, -1)) : [];
    this.chanceDeck = requestedDeck.length === MONOPOLY_CHANCE.length &&
      requestedDeck.every((value, index, values) => value >= 0 && value < MONOPOLY_CHANCE.length && values.indexOf(value) === index)
      ? requestedDeck.slice() : MONOPOLY_CHANCE.map((_, index) => index);
    this.chanceCursor = 0;
  }

  validPlayer(player){
    return Number.isInteger(player) && player >= 0 && player < this.playerCount && this.alive[player];
  }

  isProperty(propertyId){
    return Number.isInteger(propertyId) && propertyId >= 0 && propertyId < MONOPOLY_BOARD.length &&
      MONOPOLY_BOARD[propertyId].type === 'prop';
  }

  firstAlive(preferred){
    if (Number.isInteger(preferred) && preferred >= 0 && preferred < this.playerCount && this.alive[preferred]) return preferred;
    return this.alive.findIndex(Boolean);
  }

  nextAlive(player){
    for (let offset = 1; offset <= this.playerCount; offset++){
      const candidate = (player + offset) % this.playerCount;
      if (this.alive[candidate]) return candidate;
    }
    return -1;
  }

  propertyOwner(propertyId){
    return own(this.ownership, propertyId) ? this.ownership[propertyId] : -1;
  }

  ownedBy(player){
    return Object.keys(this.ownership).map(Number).filter(propertyId => this.ownership[propertyId] === player).sort((a,b) => a-b);
  }

  bankrupt(player){
    if (this.cash[player] >= 0 || !this.alive[player]) return false;
    this.alive[player] = false;
    this.cash[player] = 0;
    for (const propertyId of this.ownedBy(player)) delete this.ownership[propertyId];
    if (this.alive.filter(Boolean).length <= 1) this.phase = 'finished';
    return true;
  }

  validateMatch(payload){
    return String(payload && payload.matchId || '') === this.matchId;
  }

  finishTurn(player){
    this.pendingPurchase = null;
    this.lastCompletedPlayer = player;
    if (this.phase !== 'finished') this.phase = 'turn_complete';
    this.revision++;
  }

  movePlayer(player, steps, depth = 0){
    if (depth > 3){
      this.finishTurn(player);
      return;
    }
    const previous = this.positions[player];
    const next = ((previous + steps) % MONOPOLY_BOARD.length + MONOPOLY_BOARD.length) % MONOPOLY_BOARD.length;
    if (steps > 0 && previous + steps >= MONOPOLY_BOARD.length) this.cash[player] += 2000;
    this.positions[player] = next;
    this.resolveLanding(player, depth);
  }

  resolveLanding(player, depth = 0){
    const propertyId = this.positions[player];
    const cell = MONOPOLY_BOARD[propertyId];
    if (!cell){
      this.finishTurn(player);
      return;
    }
    if (cell.type === 'prop'){
      const owner = this.propertyOwner(propertyId);
      if (owner < 0){
        this.phase = 'purchase';
        this.pendingPurchase = { player, propertyId, price:cell.price };
        this.revision++;
        return;
      }
      if (owner !== player){
        const rent = Math.round(cell.price / 30) * 10;
        this.cash[player] -= rent;
        if (this.validPlayer(owner)) this.cash[owner] += rent;
        this.bankrupt(player);
      }
      this.finishTurn(player);
      return;
    }
    if (cell.type === 'tax'){
      this.cash[player] -= cell.amount;
      this.bankrupt(player);
      this.finishTurn(player);
      return;
    }
    if (cell.type !== 'chance'){
      this.finishTurn(player);
      return;
    }
    const chanceId = this.chanceDeck[this.chanceCursor % this.chanceDeck.length];
    this.chanceCursor = (this.chanceCursor + 1) % this.chanceDeck.length;
    const chance = MONOPOLY_CHANCE[chanceId];
    if (own(chance, 'cash')){
      this.cash[player] += chance.cash;
      this.bankrupt(player);
      this.finishTurn(player);
    } else if (own(chance, 'move')){
      this.movePlayer(player, chance.move, depth + 1);
    } else if (chance.go){
      this.cash[player] += 2000;
      this.positions[player] = 0;
      this.finishTurn(player);
    } else if (own(chance, 'each')){
      if (chance.each > 0){
        let received = 0;
        for (let other = 0; other < this.playerCount; other++){
          if (other === player || !this.alive[other]) continue;
          this.cash[other] -= chance.each;
          received += chance.each;
          this.bankrupt(other);
        }
        this.cash[player] += received;
      } else {
        let recipients = 0;
        for (let other = 0; other < this.playerCount; other++){
          if (other === player || !this.alive[other]) continue;
          this.cash[other] -= chance.each;
          recipients++;
        }
        this.cash[player] += chance.each * recipients;
        this.bankrupt(player);
      }
      this.finishTurn(player);
    }
  }

  acceptAction(player, payload, now = Date.now()){
    if (!this.validateMatch(payload)) return { ok:false, reason:'invalid_match' };
    if (this.phase === 'finished') return { ok:false, reason:'finished' };
    if (!this.validPlayer(player) || player !== this.currentPlayer) return { ok:false, reason:'not_current_player' };
    if (Array.isArray(payload && payload.roll)){
      if (this.phase !== 'roll') return { ok:false, reason:'invalid_phase' };
      const dice = payload.roll.map(value => integer(value, -1));
      if (dice.length !== 2 || dice.some(value => value < 1 || value > 6)) return { ok:false, reason:'invalid_roll' };
      this.movePlayer(player, dice[0] + dice[1]);
      return { ok:true, state:this.snapshot() };
    }
    const decision = String(payload && payload.decision || '');
    if (decision === 'pass'){
      const propertyId = this.pendingPurchase && this.pendingPurchase.propertyId;
      return this.open(player,{...(payload || {}),propertyId},now);
    }
    if (decision !== 'buy') return { ok:false, reason:'invalid_action' };
    if (this.phase !== 'purchase' || !this.pendingPurchase || this.pendingPurchase.player !== player) return { ok:false, reason:'purchase_not_pending' };
    const { propertyId, price } = this.pendingPurchase;
    if (this.positions[player] !== propertyId || !this.isProperty(propertyId) || this.propertyOwner(propertyId) >= 0){
      return { ok:false, reason:'invalid_property_state' };
    }
    if (this.cash[player] < price) return { ok:false, reason:'insufficient_cash' };
    this.cash[player] -= price;
    this.ownership[propertyId] = player;
    this.finishTurn(player);
    return { ok:true, state:this.snapshot() };
  }

  open(player, payload, now = Date.now()){
    if (this.auction && this.auction.status === 'open') return { ok:false, reason:'auction_active' };
    if (!this.validateMatch(payload)) return { ok:false, reason:'invalid_match' };
    if (!this.validPlayer(player) || player !== this.currentPlayer) return { ok:false, reason:'not_current_player' };
    if (this.phase !== 'purchase' || !this.pendingPurchase || this.pendingPurchase.player !== player){
      return { ok:false, reason:'purchase_not_pending' };
    }
    const propertyId = integer(payload && payload.propertyId, -1);
    if (propertyId !== this.pendingPurchase.propertyId || this.positions[player] !== propertyId ||
        !this.isProperty(propertyId) || this.propertyOwner(propertyId) >= 0){
      return { ok:false, reason:'invalid_property' };
    }
    const eligiblePlayers = Array.from({ length:this.playerCount }, (_, id) => id).filter(id => this.alive[id] && this.cash[id] > 0);
    this.phase = 'auction';
    this.auction = {
      auctionId:'auction_' + (++this.sequence) + '_' + String(now), matchId:this.matchId, propertyId, status:'open',
      startAt:now, endAt:now + this.durationMs, currentBid:0, currentBidder:-1,
      eligiblePlayers, revision:1, openedBy:player, seenBidIds:[],
    };
    this.revision++;
    return { ok:true, event:{ type:'auction_open', payload:this.snapshot(now) } };
  }

  bid(player, payload, now = Date.now()){
    const auction = this.auction;
    if (!auction || auction.status !== 'open' || this.phase !== 'auction') return { ok:false, reason:'not_open' };
    if (payload && payload.matchId !== undefined && String(payload.matchId) !== this.matchId) return { ok:false, reason:'invalid_match' };
    if (now >= auction.endAt) return { ok:false, reason:'deadline', closed:this.close(now) };
    if (String(payload && payload.auctionId || '') !== auction.auctionId) return { ok:false, reason:'invalid_auction' };
    if (!auction.eligiblePlayers.includes(player) || !this.validPlayer(player)) return { ok:false, reason:'ineligible' };
    const revision = integer(payload && payload.revision, -1);
    if (revision !== auction.revision) return { ok:false, reason:'stale_revision' };
    const bidId = String(payload && payload.bidId || '');
    if (!/^[A-Za-z0-9:_-]{3,100}$/.test(bidId)) return { ok:false, reason:'invalid_bid_id' };
    if (auction.seenBidIds.includes(bidId)) return { ok:false, reason:'duplicate' };
    const amount = integer(payload && payload.amount, -1);
    if (amount <= auction.currentBid) return { ok:false, reason:'bid_too_low' };
    if (amount > this.cash[player]) return { ok:false, reason:'insufficient_cash' };
    auction.currentBid = amount;
    auction.currentBidder = player;
    auction.revision++;
    auction.seenBidIds.push(bidId);
    auction.seenBidIds = auction.seenBidIds.slice(-100);
    this.revision++;
    return { ok:true, event:{ type:'auction_bid', payload:this.snapshot(now) } };
  }

  close(now = Date.now()){
    const auction = this.auction;
    if (!auction || auction.status !== 'open') return null;
    if (now < auction.endAt) return null;
    auction.status = 'closed';
    auction.revision++;
    if (auction.currentBidder >= 0 && this.validPlayer(auction.currentBidder) &&
        this.cash[auction.currentBidder] >= auction.currentBid && this.propertyOwner(auction.propertyId) < 0){
      this.cash[auction.currentBidder] -= auction.currentBid;
      this.ownership[auction.propertyId] = auction.currentBidder;
    } else {
      auction.currentBid = 0;
      auction.currentBidder = -1;
    }
    this.finishTurn(auction.openedBy);
    return { type:'auction_closed', payload:this.snapshot(now) };
  }

  confirmTurn(player, payload){
    if (!this.validateMatch(payload)) return { ok:false, reason:'invalid_match' };
    if (this.phase !== 'turn_complete' || player !== this.lastCompletedPlayer || player !== this.currentPlayer){
      return { ok:false, reason:'turn_not_complete' };
    }
    const expected = this.nextAlive(player);
    const requested = integer(payload && payload.nextPlayer, -1);
    if (expected < 0 || requested !== expected) return { ok:false, reason:'invalid_next_player', expectedNextPlayer:expected };
    this.currentPlayer = expected;
    this.lastCompletedPlayer = -1;
    this.phase = 'roll';
    this.revision++;
    return { ok:true, state:this.snapshot() };
  }

  // Naming aliases make the guard easy to pair with either the legacy
  // monopoly_turn_end message or the v2 action adapter.
  turnEnd(player,payload){ return this.confirmTurn(player,payload); }

  matchesStableState(value){
    const state = value && value.state ? value.state : value;
    if (!state || !Array.isArray(state.players) || state.players.length !== this.playerCount || !Array.isArray(state.owners)) return false;
    const clientPhase = String(state.phase || '');
    const phaseMatches = clientPhase === this.phase ||
      (this.phase === 'purchase' && clientPhase === 'buy') ||
      (this.phase === 'turn_complete' && ['done','roll'].includes(clientPhase));
    if (integer(state.cur, -1) !== this.currentPlayer || !phaseMatches) return false;
    for (let player = 0; player < this.playerCount; player++){
      const candidate = state.players[player] || {};
      if (integer(candidate.money, -1) !== this.cash[player] || integer(candidate.pos, -1) !== this.positions[player] ||
          (candidate.alive !== false) !== this.alive[player]) return false;
    }
    for (let propertyId = 0; propertyId < MONOPOLY_BOARD.length; propertyId++){
      if (!this.isProperty(propertyId)) continue;
      const candidateOwner = Number.isInteger(state.owners[propertyId]) ? state.owners[propertyId] : -1;
      if (candidateOwner !== this.propertyOwner(propertyId)) return false;
    }
    for (let player = 0; player < this.playerCount; player++){
      const candidateProps = Array.isArray(state.players[player].props) ? state.players[player].props.map(value => integer(value,-1)).sort((a,b)=>a-b) : [];
      if (candidateProps.some(propertyId => !this.isProperty(propertyId) || this.propertyOwner(propertyId) !== player)) return false;
      if (candidateProps.length !== this.ownedBy(player).length || candidateProps.some((propertyId,index) => propertyId !== this.ownedBy(player)[index])) return false;
    }
    return true;
  }

  // Legacy Host Relay may attest the animation's buy boundary, but it cannot
  // overwrite cash/ownership/turn arbitrarily. Only one legal 2..12 roll from
  // the authority's current position into an unowned property is accepted.
  // Full Game Authority v2 does not use this adapter.
  syncClientState(value){
    const state=value&&value.state?value.state:value;
    if(!state||!Array.isArray(state.players)||state.players.length!==this.playerCount||!Array.isArray(state.owners))return{ok:false,reason:'invalid_state'};
    if(this.matchesStableState(state))return{ok:true,state:this.snapshot(),replayed:true};
    if(this.auction&&this.auction.status==='open'||this.phase!=='roll'||String(state.phase||'')!=='buy')return{ok:false,reason:'invalid_phase'};
    const nextCurrent=integer(state.cur,-1);
    if(nextCurrent!==this.currentPlayer||!this.validPlayer(nextCurrent))return{ok:false,reason:'invalid_turn'};
    const nextCash=state.players.map(player=>integer(player&&player.money,-1));
    const nextPositions=state.players.map(player=>integer(player&&player.pos,-1));
    if(nextCash.some(amount=>amount<0||amount>100000000)||nextPositions.some(position=>position<0||position>=MONOPOLY_BOARD.length))return{ok:false,reason:'invalid_state'};
    for(let player=0;player<this.playerCount;player++){
      if((state.players[player]&&state.players[player].alive!==false)!==this.alive[player])return{ok:false,reason:'invalid_alive'};
      if(player!==nextCurrent&&(nextCash[player]!==this.cash[player]||nextPositions[player]!==this.positions[player]))return{ok:false,reason:'invalid_player_state'};
      const expectedProps=this.ownedBy(player);
      const props=Array.isArray(state.players[player]&&state.players[player].props)?state.players[player].props.map(item=>integer(item,-1)).sort((a,b)=>a-b):[];
      if(props.length!==expectedProps.length||props.some((propertyId,index)=>propertyId!==expectedProps[index]))return{ok:false,reason:'invalid_ownership'};
    }
    for(let propertyId=0;propertyId<MONOPOLY_BOARD.length;propertyId++){
      if(!this.isProperty(propertyId))continue;
      const owner=Number.isInteger(state.owners[propertyId])?state.owners[propertyId]:-1;
      if(owner!==this.propertyOwner(propertyId))return{ok:false,reason:'invalid_ownership'};
    }
    const previousPosition=this.positions[nextCurrent],propertyId=nextPositions[nextCurrent];
    const distance=(propertyId-previousPosition+MONOPOLY_BOARD.length)%MONOPOLY_BOARD.length;
    if(distance<2||distance>12||!this.isProperty(propertyId)||this.propertyOwner(propertyId)>=0)return{ok:false,reason:'invalid_landing'};
    const expectedCash=this.cash[nextCurrent]+(previousPosition+distance>=MONOPOLY_BOARD.length?2000:0);
    if(nextCash[nextCurrent]!==expectedCash)return{ok:false,reason:'invalid_cash'};
    this.cash[nextCurrent]=nextCash[nextCurrent];
    this.positions[nextCurrent]=propertyId;
    this.phase='purchase';
    this.pendingPurchase={player:nextCurrent,propertyId,price:MONOPOLY_BOARD[propertyId].price};
    this.revision++;
    return{ok:true,state:this.snapshot()};
  }

  snapshot(now = Date.now()){
    const auction = this.auction ? {...this.auction, eligiblePlayers:this.auction.eligiblePlayers.slice()} : null;
    if (auction) delete auction.seenBidIds;
    return {
      protocol:this.protocol, matchId:this.matchId, revision:this.revision,
      boardVersion:'mini-monopoly-24-v1', currentPlayer:this.currentPlayer, phase:this.phase,
      positions:this.positions.slice(), alive:this.alive.slice(), pendingPurchase:this.pendingPurchase && {...this.pendingPurchase},
      auction, cash:this.cash.slice(), ownership:cloneOwnership(this.ownership), serverNow:now,
      remainingMs:auction && auction.status === 'open' ? Math.max(0, auction.endAt-now) : 0,
    };
  }
}

module.exports = {
  XiangqiClockAuthority,
  MonopolyAuctionAuthority,
  MONOPOLY_BOARD,
  MONOPOLY_CHANCE,
};
