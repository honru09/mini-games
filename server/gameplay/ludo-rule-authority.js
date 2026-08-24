'use strict';
const Rules=require('../../shared/rules/ludo');
class LudoRuleAuthority{
  constructor(options={}){this.protocol=Rules.PROTOCOL;this.matchId=String(options.matchId||'');this.state=Rules.createInitialState(options.playerCount);this.state.matchId=this.matchId;this.lastSeq=Array(this.state.playerCount).fill(0);this.revision=0;this.finished=false;this.inputLog=[];this.seed=String(options.matchSeed||this.matchId);}
  die(){let h=2166136261>>>0;const text=this.seed+':'+this.revision;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h%6+1;}
  acceptAction(player,payload,now=Date.now()){
    if(this.finished)return{ok:false,reason:'ERR_MATCH_FINISHED'};
    if(String(payload&&payload.matchId||'')!==this.matchId)return{ok:false,reason:'ERR_INVALID_STATE'};
    if(!Number.isInteger(player)||player<0||player>=this.state.playerCount)return{ok:false,reason:'ERR_INVALID_STATE'};
    const seq=Number(payload&&payload.seq);if(!Number.isSafeInteger(seq)||seq<1||seq<=this.lastSeq[player])return{ok:false,reason:seq===this.lastSeq[player]&&seq>0?'ERR_DUPLICATE_ACTION':'ERR_STALE_SEQ'};
    const type=payload&&payload.action&&payload.action.type;const action=type==='roll'?{type:'roll',dice:this.die()}:(type==='move'?{type:'move',token:Number(payload.action.token)}:null);
    const accepted=Rules.applyAction(this.state,action,player);if(!accepted.ok)return accepted;
    this.lastSeq[player]=seq;this.state=accepted.state;this.state.matchId=this.matchId;this.revision=this.state.revision;this.inputLog.push({player,seq,action:{...action,type:action.type, ...(type==='roll'?{}:{token:action.token})},at:Number(now)||0});if(this.inputLog.length>256)this.inputLog.shift();if(this.state.terminal)this.finished=true;
    const event={...accepted.event,payload:{...accepted.event.payload,matchId:this.matchId,revision:this.revision,lastSeq:this.lastSeq.slice(),hash:Rules.hashState(this.state)}};
    const result=accepted.result?{...accepted.result,payload:{...accepted.result.payload,matchId:this.matchId}}:null;return{ok:true,event,result};
  }
  snapshot(now=Date.now()){return{...Rules.serialize(this.state),matchId:this.matchId,revision:this.revision,serverNow:Number(now)||0,lastSeq:this.lastSeq.slice(),history:this.inputLog.map(x=>({player:x.player,seq:x.seq,action:{...x.action}})),hash:Rules.hashState(this.state)};}
  result(now=Date.now()){const result=Rules.resultFor(this.state);if(!result)return null;return{...result,payload:{...result.payload,matchId:this.matchId,revision:this.revision,serverNow:Number(now)||0}};}
}
module.exports={LudoRuleAuthority};
