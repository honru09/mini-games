'use strict';

const PROTOCOL_VERSIONS=Object.freeze({
  tank:'tank-authority-v1',
  tankSnapshotDelta:'tank-snapshot-delta-v2',
  tetrisCoordination:'tetris-battle-authority-v1',
  tetrisRules:'tetris-rule-v3',
  spectator:'spectator-room-v1',
  tournament:'tournament-orchestrator-v1',
  xiangqiClock:'xiangqi-clock-v1',
  xiangqiRules:'xiangqi-rule-v2',
  monopolyAuction:'monopoly-auction-v1',
  monopolyRules:'monopoly-rule-v2',
  cosmetic:'game-cosmetic-presentation-v1',
});
const GAMEPLAY_ERROR_CODES=Object.freeze({
  ERR_PROTOCOL_VERSION:'协议版本不兼容',ERR_NOT_ACTIVE_PLAYER:'不是当前行动者',ERR_INVALID_MOVE:'走法或动作非法',ERR_STALE_SEQ:'动作序号过期',ERR_DUPLICATE_ACTION:'重复动作',ERR_MATCH_FINISHED:'对局已结束',ERR_SPECTATOR_READONLY:'观战只读',ERR_INVALID_STATE:'状态无效',ERR_RECONNECT_EXPIRED:'重连窗口已过期',ERR_DEADLINE:'拍卖尚未到截止时间',
});
function protocolError(protocol,code,extra){return{protocol:String(protocol||''),code:String(code||'ERR_INVALID_STATE'),message:GAMEPLAY_ERROR_CODES[code]||'游戏协议错误',...(extra||{})};}
function capabilities(){return Object.freeze(Object.values(PROTOCOL_VERSIONS).map(value=>value.replace(/-/g,'_')));}
module.exports={PROTOCOL_VERSIONS,GAMEPLAY_ERROR_CODES,protocolError,capabilities};
