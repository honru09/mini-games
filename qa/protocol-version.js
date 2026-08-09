'use strict';

const fs=require('fs');
const path=require('path');
const {PROTOCOL_VERSIONS,GAMEPLAY_ERROR_CODES,protocolError,capabilities}=require('../server/gameplay/protocol');
const ROOT=path.join(__dirname,'..');
const failures=[];
function check(name,value){console.log((value?'PASS':'FAIL')+'  '+name);if(!value)failures.push(name);}

const expected={
  tank:'tank-authority-v1',tetrisCoordination:'tetris-battle-authority-v1',tetrisRules:'tetris-rule-v3',
  spectator:'spectator-room-v1',tournament:'tournament-orchestrator-v1',xiangqiClock:'xiangqi-clock-v1',
  xiangqiRules:'xiangqi-rule-v2',monopolyAuction:'monopoly-auction-v1',monopolyRules:'monopoly-rule-v2',
  cosmetic:'game-cosmetic-presentation-v1',
};
check('Protocol Registry：版本名完整且稳定',JSON.stringify(PROTOCOL_VERSIONS)===JSON.stringify(expected));
check('Protocol Registry：版本 ID 唯一',new Set(Object.values(PROTOCOL_VERSIONS)).size===Object.values(PROTOCOL_VERSIONS).length);
check('Protocol Registry：capability 别名覆盖全部协议',Object.values(PROTOCOL_VERSIONS).every(value=>capabilities().includes(value.replace(/-/g,'_'))));
const requiredErrors=['ERR_PROTOCOL_VERSION','ERR_NOT_ACTIVE_PLAYER','ERR_INVALID_MOVE','ERR_STALE_SEQ','ERR_DUPLICATE_ACTION','ERR_MATCH_FINISHED','ERR_SPECTATOR_READONLY','ERR_INVALID_STATE','ERR_RECONNECT_EXPIRED'];
check('Protocol Registry：统一 Gameplay Error Code 完整',requiredErrors.every(code=>typeof GAMEPLAY_ERROR_CODES[code]==='string'&&GAMEPLAY_ERROR_CODES[code]));
const sample=protocolError(PROTOCOL_VERSIONS.xiangqiRules,'ERR_INVALID_MOVE',{reason:'horse_leg'});
check('Protocol Registry：错误载荷包含 protocol/code/message/reason',sample.protocol===PROTOCOL_VERSIONS.xiangqiRules&&sample.code==='ERR_INVALID_MOVE'&&sample.message&&sample.reason==='horse_leg');
const client=fs.readFileSync(path.join(ROOT,'public','src','online','03-websocket.js'),'utf8');
const server=fs.readFileSync(path.join(ROOT,'server','index.js'),'utf8');
check('Protocol Registry：客户端 hello 声明 Tetris v3 与两套 v2 规则协议',[expected.tetrisRules,expected.xiangqiRules,expected.monopolyRules].every(value=>client.includes("'"+value+"'")));
check('Protocol Registry：服务端以 capability 协商 v2，不静默强制升级',server.includes('roomSupports(r,PROTOCOL_VERSIONS.tetrisRules)')&&server.includes('roomSupports(r,PROTOCOL_VERSIONS.xiangqiRules)')&&server.includes('roomSupports(r,PROTOCOL_VERSIONS.monopolyRules)'));
check('Protocol Registry：Tetris v3 有独立紧急回退开关且旧客户端退回 v1 Coordination',server.includes('TETRIS_ADVANCED_SCORING_ENABLED&&roomSupports(r,PROTOCOL_VERSIONS.tetrisRules)')&&server.includes('new TetrisBattleAuthority'));

if(failures.length){console.error('PROTOCOL_VERSION_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('PROTOCOL_VERSION_ALL_PASS');
