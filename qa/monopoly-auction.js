'use strict';

const { MonopolyAuctionAuthority, MONOPOLY_BOARD } = require('../server/gameplay/turn-protocols');

function assert(name, value){
  console.log((value ? 'PASS' : 'FAIL') + '  ' + name);
  if (!value) process.exitCode = 1;
}

const auction = new MonopolyAuctionAuthority({
  matchId:'mono_match', playerCount:3, cash:[1000,700,300], durationMs:5000,
});

assert('Auction：实际棋盘固定为 24 格且仅合法地产可拍卖',
  MONOPOLY_BOARD.length === 24 && MONOPOLY_BOARD[2].type === 'prop' && MONOPOLY_BOARD[7].price === 450);
assert('Turn：非当前玩家不能伪造掷骰',
  auction.acceptAction(1,{matchId:'mono_match',roll:[1,1]}).reason === 'not_current_player');
assert('Turn：骰子范围由服务器校验',
  auction.acceptAction(0,{matchId:'mono_match',roll:[0,13]}).reason === 'invalid_roll');

const landed = auction.acceptAction(0,{matchId:'mono_match',roll:[1,1]});
assert('Turn：服务器从真实位置计算落点并进入购买阶段',
  landed.ok && landed.state.positions[0] === 2 && landed.state.phase === 'purchase' && landed.state.pendingPurchase.propertyId === 2);
assert('Auction：不能拍卖任意棋盘格或非当前落点',
  auction.open(0,{matchId:'mono_match',propertyId:7},1000).reason === 'invalid_property' &&
  auction.open(0,{matchId:'mono_match',propertyId:1},1000).reason === 'invalid_property');

const opened = auction.open(0,{matchId:'mono_match',propertyId:2},1000);
assert('Auction：只有真实落点放弃购买后才能开启',
  opened.ok && opened.event.payload.auction.status === 'open' && opened.event.payload.auction.propertyId === 2);
const id = opened.event.payload.auction.auctionId;
const bid1 = auction.bid(1,{auctionId:id,amount:200,revision:1,bidId:'bid_1_a'},2000);
assert('Auction：Eligible Player 可实时出价', bid1.ok && bid1.event.payload.auction.currentBidder === 1);
assert('Auction：Duplicate / stale revision 被拒绝',
  auction.bid(1,{auctionId:id,amount:250,revision:1,bidId:'bid_1_a'},2100).reason === 'stale_revision');
assert('Auction：出价绑定权威局内现金',
  auction.bid(2,{auctionId:id,amount:500,revision:2,bidId:'bid_2_a'},2200).reason === 'insufficient_cash');
const bid2 = auction.bid(0,{auctionId:id,amount:450,revision:2,bidId:'bid_0_a'},2300);
assert('Auction：Outbid 更新 revision', bid2.ok && bid2.event.payload.auction.revision === 3);
assert('Auction：截止前不能提前关闭', auction.close(5999) === null);
const closed = auction.close(6000);
assert('Auction：Deadline 由服务器关闭', closed && closed.payload.auction.status === 'closed');
assert('Auction：Winner 获得真实地产且扣权威现金',
  closed.payload.ownership[2] === 0 && closed.payload.cash[0] === 550 && closed.payload.phase === 'turn_complete');

assert('Turn：不能把回合任意跳到玩家 2',
  auction.confirmTurn(0,{matchId:'mono_match',nextPlayer:2}).reason === 'invalid_next_player');
const advanced = auction.confirmTurn(0,{matchId:'mono_match',nextPlayer:1});
assert('Turn：只能前进到唯一合法下一位', advanced.ok && advanced.state.currentPlayer === 1 && advanced.state.phase === 'roll');

auction.acceptAction(1,{matchId:'mono_match',roll:[1,1]});
assert('Ownership：后续落到已售地产使用同一权威产权与现金',
  auction.snapshot().cash[1] === 600 && auction.snapshot().ownership[2] === 0);
auction.confirmTurn(1,{matchId:'mono_match',nextPlayer:2});
auction.acceptAction(2,{matchId:'mono_match',roll:[1,2]});
assert('Turn：破产玩家产权/存活状态由同一状态机维护',
  auction.snapshot().alive[2] === false && auction.snapshot().cash[2] === 0);
assert('Turn：合法下一位会跳过破产玩家',
  auction.confirmTurn(2,{matchId:'mono_match',nextPlayer:0}).ok && auction.snapshot().currentPlayer === 0);

const buy = new MonopolyAuctionAuthority({matchId:'mono_buy',playerCount:2});
buy.acceptAction(0,{matchId:'mono_buy',roll:[1,1]});
const bought = buy.acceptAction(0,{matchId:'mono_buy',decision:'buy'});
assert('Purchase：直接购买使用棋盘标价并原子更新现金/产权',
  bought.ok && bought.state.cash[0] === 1700 && bought.state.ownership[2] === 0);
assert('Auction：已购买地产不能再开启拍卖',
  buy.open(0,{matchId:'mono_buy',propertyId:2},0).reason === 'purchase_not_pending');

buy.confirmTurn(0,{matchId:'mono_buy',nextPlayer:1});
const stable = {
  cur:1, phase:'roll',
  players:[{money:1700,pos:2,alive:true,props:[2]},{money:2000,pos:0,alive:true,props:[]}],
  owners:Array.from({length:24},(_,index)=>index===2?0:-1),
};
assert('Snapshot：稳定点可与权威现金/产权进行一致性审计', buy.matchesStableState(stable));
stable.players[0].money = 999999;
assert('Snapshot：伪造现金的 host snapshot 无法通过审计', !buy.matchesStableState(stable));

const noBid = new MonopolyAuctionAuthority({matchId:'mono_no_bid',playerCount:2,durationMs:1000});
noBid.acceptAction(0,{matchId:'mono_no_bid',roll:[1,1]});
noBid.open(0,{matchId:'mono_no_bid',propertyId:2},0);
const noBidClosed = noBid.close(1000);
assert('Auction：No Bid 流拍不转移地产',
  noBidClosed && Object.keys(noBidClosed.payload.ownership).length === 0 && noBidClosed.payload.phase === 'turn_complete');

const legacy = new MonopolyAuctionAuthority({matchId:'mono_legacy',playerCount:2});
const legacyBase = {
  players:[{money:2000,pos:2,alive:true,props:[]},{money:2000,pos:0,alive:true,props:[]}],
  cur:0,phase:'buy',owners:Array(24).fill(-1),
};
assert('Legacy Snapshot：不能伪造现金后开启拍卖',
  legacy.syncClientState({...legacyBase,players:[{...legacyBase.players[0],money:999999},legacyBase.players[1]]}).reason === 'invalid_cash');
const forgedOwners = legacyBase.owners.slice();forgedOwners[7]=1;
assert('Legacy Snapshot：不能伪造其他地产产权',
  legacy.syncClientState({...legacyBase,owners:forgedOwners}).reason === 'invalid_ownership');
assert('Legacy Snapshot：不能通过 cur 字段跳跃行动者',
  legacy.syncClientState({...legacyBase,cur:1}).reason === 'invalid_turn');
assert('Legacy Snapshot：只接受当前玩家 2–12 点骰子的真实未售地产落点', legacy.syncClientState(legacyBase).ok);

if (!process.exitCode) console.log('MONOPOLY_AUCTION_ALL_PASS');
