'use strict';

const Rules=require('../../shared/rules/gomoku');

class GomokuRuleAuthority {
  constructor(options={}){
    this.protocol=Rules.PROTOCOL;
    this.matchId=String(options.matchId||'');
    this.state=Rules.createInitialState();
    this.lastSeq=[0,0];
    this.revision=0;
    this.finished=false;
    this.inputLog=[];
    this.undoHistory=[];
  }
  acceptMove(player,payload,now=Date.now()){
    if(this.finished)return{ok:false,reason:'ERR_MATCH_FINISHED'};
    if(String(payload&&payload.matchId||'')!==this.matchId)return{ok:false,reason:'ERR_INVALID_STATE'};
    if(!Number.isInteger(player)||player<0||player>1)return{ok:false,reason:'ERR_INVALID_STATE'};
    const seq=Number(payload&&payload.seq);
    if(!Number.isSafeInteger(seq)||seq<1||seq<=this.lastSeq[player])return{ok:false,reason:seq===this.lastSeq[player]&&seq>0?'ERR_DUPLICATE_ACTION':'ERR_STALE_SEQ'};
    const action={type:'place',row:payload&&payload.row,col:payload&&payload.col};
    const result=Rules.applyAction(this.state,action,player);
    if(!result.ok)return{ok:false,reason:result.reason};
    this.undoHistory.push({state:Rules.serialize(this.state),inputLogLength:this.inputLog.length});
    if(this.undoHistory.length>4)this.undoHistory.shift();
    this.lastSeq[player]=seq;
    this.state=result.state;
    this.revision++;
    this.inputLog.push({player,seq,row:action.row,col:action.col,at:Number(now)||0});
    if(this.inputLog.length>225)this.inputLog.splice(0,this.inputLog.length-225);
    if(this.state.terminal)this.finished=true;
    return{ok:true,event:{type:'gomoku_rule_state',payload:this.snapshot(now)},result:this.finished?this.result(now):null};
  }
  undo(player,now=Date.now()){
    if(this.finished)return{ok:false,reason:'ERR_MATCH_FINISHED'};
    if(player!==(this.state.current^1))return{ok:false,reason:'ERR_NOT_LAST_MOVER'};
    const previous=this.undoHistory.pop();
    if(!previous)return{ok:false,reason:'ERR_UNDO_UNAVAILABLE'};
    try{
      this.state=Rules.deserialize(previous.state);
      this.inputLog.length=Math.max(0,Number(previous.inputLogLength)||0);
      this.revision++;
      return{ok:true,event:{type:'gomoku_rule_state',payload:this.snapshot(now)}};
    }catch(_error){return{ok:false,reason:'ERR_UNDO_UNAVAILABLE'};}
  }
  snapshot(now=Date.now()){
    return{
      protocol:this.protocol,matchId:this.matchId,revision:this.revision,serverNow:Number(now)||0,
      board:this.state.board.map(row=>row.slice()),current:this.state.current,moveNumber:this.state.moveNumber,
      last:this.state.last?this.state.last.slice():null,terminal:this.finished||this.state.terminal,
      winner:this.state.winner,reason:this.state.reason||null,winLine:(this.state.winLine||[]).map(cell=>cell.slice()),
      history:this.inputLog.map(item=>({player:item.player,row:item.row,col:item.col,seq:item.seq})),
      lastSeq:this.lastSeq.slice(),hash:Rules.hashState(this.state),
    };
  }
  result(now=Date.now()){
    const outcome=Rules.getResult(this.state);
    if(!outcome)return null;
    const draw=outcome.draw===true;
    const order=draw?[0,1]:outcome.order.slice();
    return{
      type:'gomoku_result',protocol:this.protocol,matchId:this.matchId,revision:this.revision,serverNow:Number(now)||0,
      draw,order,results:draw?[{slot:0,rank:1,coins:0},{slot:1,rank:1,coins:0}]:[{slot:order[0],rank:1,coins:1},{slot:order[1],rank:2,coins:0}],
      stats:{moves:this.state.moveNumber,hash:Rules.hashState(this.state),reason:this.state.reason||null,winner:this.state.winner},
    };
  }
}

module.exports={GomokuRuleAuthority};
