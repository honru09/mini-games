'use strict';

const fs=require('fs'),path=require('path');
const files=['public/src/games/tank.js','public/src/games/tetris.js','public/src/games/xiangqi.js','server/index.js','server/boundaries/server-clock-timer.js'];
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}
for(const file of files){const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8'),intervals=(source.match(/setInterval\s*\(/g)||[]).length,clears=(source.match(/clearInterval\s*\(/g)||[]).length,timeouts=(source.match(/setTimeout\s*\(/g)||[]).length;check('Timer Audit：'+file+' 的 interval 有对应清理路径',intervals===0||clears>0,'intervals='+intervals+' clears='+clears);check('Timer Audit：'+file+' 未出现超量定时器创建',timeouts<80,'setTimeout='+timeouts);}
check('Timer Audit：Tank/Tetris destroy 明确清理主循环',/destroy\(\)[\s\S]{0,900}clearInterval\(simulationTimer\)/.test(fs.readFileSync(path.join(__dirname,'..','public/src/games/tank.js'),'utf8'))&&/destroy\(\)[\s\S]{0,900}clearInterval\(gameTimer\)/.test(fs.readFileSync(path.join(__dirname,'..','public/src/games/tetris.js'),'utf8')));
const serverIndex=fs.readFileSync(path.join(__dirname,'..','server/index.js'),'utf8');
const clockTimer=fs.readFileSync(path.join(__dirname,'..','server/boundaries/server-clock-timer.js'),'utf8');
const heartbeatBlockStart=serverIndex.indexOf("const HEARTBEAT_SWEEP_TIMER_OWNER='heartbeat-sweep'");
const heartbeatBlockEnd=serverIndex.indexOf('const metricsHistorySweep=',heartbeatBlockStart);
const heartbeatBlock=heartbeatBlockStart>=0&&heartbeatBlockEnd>heartbeatBlockStart?serverIndex.slice(heartbeatBlockStart,heartbeatBlockEnd):'';
check('Timer Audit：ServerClockTimer 保留真实 Node 与 Manual 双 Adapter',clockTimer.includes('createNodeClockTimerAdapter')&&clockTimer.includes('createManualClockTimerAdapter'));
check('Timer Audit：ServerClockTimer 不 monkey-patch 全局时间',!/(Date\.now\s*=|global\.(?:setTimeout|setInterval)\s*=|globalThis\.(?:setTimeout|setInterval)\s*=)/.test(clockTimer));
check('Timer Audit：Metrics 周期使用 ServerClockTimer seam',serverIndex.includes("owner:'operational-metrics-history'")&&serverIndex.includes('serverClockTimer.schedule'));
check('Timer Audit：Room Graph Recovery 周期使用 ServerClockTimer seam',serverIndex.includes("ROOM_GRAPH_RECOVERY_TIMER_OWNER='room-graph-recovery'")&&serverIndex.includes('owner:ROOM_GRAPH_RECOVERY_TIMER_OWNER')&&serverIndex.includes('run:()=>runRoomGraphRecoverySweep()'));
check('Timer Audit：Room Graph Recovery 只通过 lease cancel 清理',serverIndex.includes('function cancelRoomGraphRecoveryTimer()')&&!serverIndex.includes('clearInterval(roomGraphRecoveryTimer)'));
check('Timer Audit：访客临时清理使用独立 ServerClockTimer owner',serverIndex.includes("EPHEMERAL_CLEANUP_TIMER_OWNER_PREFIX='ephemeral-cleanup:'")&&serverIndex.includes('owner:EPHEMERAL_CLEANUP_TIMER_OWNER_PREFIX+uid')&&serverIndex.includes('function cancelEphemeralCleanup(uid)'));
check('Timer Audit：访客临时清理不直接持有原生 timeout',serverIndex.includes('if(typeof timer.cancel===\'function\')return timer.cancel();')&&!/const timer=setTimeout\(\(\)=>\{ephemeralCleanupTimers/.test(serverIndex));
check('Timer Audit：Reconnect lifecycle 使用按 Session 隔离的 ServerClockTimer lease',serverIndex.includes("RECONNECT_TIMER_OWNER_PREFIX='reconnect-expiry:'")&&serverIndex.includes('function scheduleReconnectTimer(session,room,delayMs)')&&serverIndex.includes('owner:RECONNECT_TIMER_OWNER_PREFIX+session.sessionId')&&!/session\.reconnectTimer\s*=\s*setTimeout\s*\(/.test(serverIndex));
check('Timer Audit：Reconnect lease 回调先清空字段再进入过期/重试',/run:\(\)=>\{\s*\/\/ Clear the owner field[\s\S]{0,180}?session\.reconnectTimer=null;[\s\S]{0,100}?return expireDetachedSession\(room,session\)/.test(serverIndex));
check('Timer Audit：Room removal retry 使用按 Session 隔离的 ServerClockTimer lease',serverIndex.includes("ROOM_REMOVAL_RETRY_TIMER_OWNER_PREFIX='room-removal-retry:'")&&serverIndex.includes('function scheduleRoomRemovalRetryTimer(session,room,delayMs)')&&serverIndex.includes('owner:ROOM_REMOVAL_RETRY_TIMER_OWNER_PREFIX+session.sessionId')&&!/roomRemovalRetryTimer\s*=\s*setTimeout\s*\(/.test(serverIndex));
check('Timer Audit：Room Presence Boundary 使用统一 lease/native cancel 适配器',serverIndex.includes('cancelTimer:cancelServerTimer')&&serverIndex.includes('function cancelServerTimer(timer)'));
check('Timer Audit：Heartbeat sweep 使用单一 ServerClockTimer owner',heartbeatBlock.includes("HEARTBEAT_SWEEP_TIMER_OWNER='heartbeat-sweep'")&&heartbeatBlock.includes('owner:HEARTBEAT_SWEEP_TIMER_OWNER')&&heartbeatBlock.includes('delayMs:HEARTBEAT_SWEEP_INTERVAL_MS')&&heartbeatBlock.includes('repeat:true'));
check('Timer Audit：Heartbeat sweep 复用 lease 采样时间并同步清理 resume TTL',heartbeatBlock.includes('run:({now})=>{')&&heartbeatBlock.includes('clearExpiredResumes(now)')&&!/const heartbeatSweep\s*=\s*setInterval\s*\(/.test(serverIndex));
check('Timer Audit：Heartbeat sweep 隔离单个会话/房间/赛事异常以保活 repeat owner',heartbeatBlock.includes('createHeartbeatSweepIsolation({')&&[
  'heartbeat_session_sweep','heartbeat_guest_expiry_notify','heartbeat_guest_expiry_close','heartbeat_guest_expiry_cleanup',
  'heartbeat_session_timeout_close','heartbeat_room_idle_sweep','heartbeat_tournament_cleanup',
  'heartbeat_tournament_sweep','heartbeat_resume_expiry_sweep',
].every(context=>heartbeatBlock.includes("heartbeatSweepIsolation.run('"+context+"'")));
check('Timer Audit：Heartbeat 保留访客强制关闭与普通超时重连语义',/heartbeat_guest_expiry_close'\s*,\s*\(\)=>session\.close\(true\)/.test(heartbeatBlock)&&/heartbeat_session_timeout_close'\s*,\s*\(\)=>session\.close\(\)/.test(heartbeatBlock));
check('Timer Audit：Heartbeat schedule 失败记录稳定 operational context',heartbeatBlock.includes("recordOperationalError('heartbeat_sweep_schedule'"));
check('Timer Audit：Server close 会释放统一 ServerClockTimer',serverIndex.includes("server.once('close',()=>serverClockTimer.dispose())"));
check('Timer Audit：六个既有 Server Boundary 共用单一 serverNow 注入',[
  /createRoomPresenceBoundary\(\{[\s\S]{0,220}?now:serverNow/,
  /createMatchProtocolBoundary\(\{adapter:matchProtocolAdapter,now:serverNow\}/,
  /createAuthProfileBoundary\(\{[\s\S]{0,220}?now: serverNow/,
  /createChatPlaylineBoundary\(\{[\s\S]{0,220}?now:serverNow/,
  /createRewardEconomyBoundary\(\{[\s\S]{0,220}?now:serverNow/,
  /createRewardProgression\(\{[\s\S]{0,220}?now:serverNow/,
].every(pattern=>pattern.test(serverIndex)));
check('Timer Audit：Boundary 构造接线不再直接注入 Date.now',!/(?:createRoomPresenceBoundary|createMatchProtocolBoundary|createAuthProfileBoundary|createChatPlaylineBoundary|createRewardEconomyBoundary|createRewardProgression)\(\{[\s\S]{0,300}?now\s*:\s*(?:\(\)\s*=>\s*)?Date\.now/.test(serverIndex));
if(failures.length){console.error('TIMER_AUDIT_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('TIMER_AUDIT_ALL_PASS');
