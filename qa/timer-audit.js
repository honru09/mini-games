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
check('Timer Audit：Tournament abort retry 使用按赛事隔离的 ServerClockTimer lease',serverIndex.includes("TOURNAMENT_ABORT_TIMER_OWNER_PREFIX='tournament-abort:'")&&serverIndex.includes('function scheduleTournamentAbortRetry(entry,plans,sessionsReady,transaction,reason)')&&serverIndex.includes('owner:TOURNAMENT_ABORT_TIMER_OWNER_PREFIX+String(entry.tournament.tournamentId)')&&!/entry\.abortTimer\s*=\s*setTimeout\s*\(/.test(serverIndex));
check('Timer Audit：Tournament next-round 使用按赛事隔离的 ServerClockTimer lease',serverIndex.includes("TOURNAMENT_ADVANCE_TIMER_OWNER_PREFIX='tournament-advance:'")&&serverIndex.includes('function scheduleTournamentNextRound(entry)')&&serverIndex.includes('owner:TOURNAMENT_ADVANCE_TIMER_OWNER_PREFIX+String(entry.tournament.tournamentId)')&&!/entry\.advanceTimer\s*=\s*setTimeout\s*\(/.test(serverIndex));
check('Timer Audit：Tournament lifecycle 终态与过期清理会取消两类 lease',serverIndex.includes("function cancelTournamentLifecycleTimers(entry)")&&serverIndex.includes('cancelTournamentLifecycleTimers(entry);')&&serverIndex.includes('tournaments.delete(tournamentId);'));
check('Timer Audit：局内表达与房聊观众延迟使用统一可取消 lease',serverIndex.includes("MATCH_SOCIAL_DELAY_TIMER_OWNER_PREFIX='match-social-delay:'")&&serverIndex.includes('MATCH_SOCIAL_DELAY_MAX_PENDING=256')&&serverIndex.includes('function scheduleMatchSocialDelay(room,session,delayMs,text,timers,canSend,reason)')&&serverIndex.includes('scheduleMatchSocialDelay(room,session,delay,text,room.matchExpressionDelayTimers')&&serverIndex.includes('scheduleMatchSocialDelay(room,session,delay,text,room.matchChatDelayTimers')&&!/match(?:Expression|Chat)DelayTimers\.add\(timer\)/.test(serverIndex));
check('Timer Audit：局内社交延迟在房间清理时撤销全部 lease',serverIndex.includes('function cancelServerTimerSet(timers)')&&serverIndex.includes('cancelServerTimerSet(r.matchExpressionDelayTimers)')&&serverIndex.includes('cancelServerTimerSet(r.matchChatDelayTimers)'));
check('Timer Audit：普通广播观众延迟复用可取消 spectator lease',serverIndex.includes('room.spectatorDelayTimers')&&serverIndex.includes("'spectator_broadcast_delay_schedule'")&&!/const timer = setTimeout\(\(\) => \{ if \(c\.alive && room\.spectators/.test(serverIndex));
check('Timer Audit：普通广播观众延迟与局内社交延迟共同清理',serverIndex.includes('cancelServerTimerSet(r.spectatorDelayTimers)'));
check('Timer Audit：Rule Authority gameplay tick 使用按房间隔离的 ServerClockTimer lease',serverIndex.includes("GAMEPLAY_TIMER_OWNER_PREFIX='gameplay:'")&&serverIndex.includes('function scheduleRoomGameplayTimer(r,delayMs,run,reason)')&&serverIndex.includes('repeat:true')&&!/r\.gameplayTimer\s*=\s*setInterval\s*\(/.test(serverIndex));
check('Timer Audit：Rule Authority gameplay tick 使用统一 now 样本并可取消',serverIndex.includes('run:({now})=>')&&serverIndex.includes('cancelServerTimer(r.gameplayTimer)')&&serverIndex.includes("'tank_gameplay_timer_schedule'")&&serverIndex.includes("'monopoly_auction_gameplay_timer_schedule'"));
check('Timer Audit：Tank snapshot spectator delay 使用独立可取消 lease',serverIndex.includes("TANK_SNAPSHOT_DELAY_TIMER_OWNER_PREFIX='tank-snapshot-delay:'")&&serverIndex.includes('function scheduleDelayedTankSnapshot(r,state,delayMs)')&&serverIndex.includes('serverClockTimer.schedule')&&!/const timer=setTimeout\(\(\)=>/.test(serverIndex));
check('Timer Audit：Tank snapshot delay 清理使用统一 cancel seam',serverIndex.includes('cancelServerTimer(oldest)')&&serverIndex.includes('cancelServerTimer(timer)')&&serverIndex.includes('clearTankSnapshotDelayTimers'));
check('Timer Audit：DeepSeek/Supabase transport deadline 使用统一 ServerClockTimer seam',serverIndex.includes("createTransportDeadline")&&serverIndex.includes("label:'deepseek'")&&serverIndex.includes("label:'supabase'")&&!/AbortSignal\.timeout\s*\(/.test(serverIndex));
check('Timer Audit：多实例遥测接收 transport deadline 注入而不改变独立测试回退',fs.readFileSync(path.join(__dirname,'..','server/cluster-coordinator.js'),'utf8').includes('deadlineFactory')&&fs.readFileSync(path.join(__dirname,'..','server/cluster-coordinator.js'),'utf8').includes('transport_deadline_unavailable'));
const gameplayMetrics=fs.readFileSync(path.join(__dirname,'..','server/gameplay/metrics.js'),'utf8');
const operationalMetrics=fs.readFileSync(path.join(__dirname,'..','server/boundaries/operational-metrics.js'),'utf8');
const clusterCoordinator=fs.readFileSync(path.join(__dirname,'..','server/cluster-coordinator.js'),'utf8');
check('Timer Audit：Metrics generatedAt 使用统一 serverNow 样本',serverIndex.includes('currentGameplayMetrics(at=serverNow())')&&serverIndex.includes('now:serverNow')&&operationalMetrics.includes('currentMetrics(now), now')&&clusterCoordinator.includes('safeMetrics(snapshot,safeEpoch(this.now))'));
check('Timer Audit：Metrics 生成不再调用无参数 new Date',! /new Date\(\)\.toISOString\(\)/.test(gameplayMetrics+operationalMetrics+clusterCoordinator));
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
const authSweepStart=serverIndex.indexOf("const AUTH_TOKEN_SWEEP_INTERVAL_MS=");
const authSweepEnd=serverIndex.indexOf('server.once(\'close\'',authSweepStart);
const authSweepBlock=authSweepStart>=0&&authSweepEnd>authSweepStart?serverIndex.slice(authSweepStart,authSweepEnd):'';
check('Timer Audit：正式 Token TTL sweep 使用独立 ServerClockTimer owner',authSweepBlock.includes("AUTH_TOKEN_SWEEP_TIMER_OWNER='auth-token-expiry-sweep'")&&authSweepBlock.includes('owner:AUTH_TOKEN_SWEEP_TIMER_OWNER')&&authSweepBlock.includes('repeat:true'));
check('Timer Audit：正式 Token TTL sweep 由 Cluster leader 单写者执行',authSweepBlock.includes("clusterCoordinator.enabled&&!clusterCoordinator.isLeader()")&&authSweepBlock.includes("reason:'not_cluster_leader'"));
check('Timer Audit：正式 Token TTL sweep 只通过 auth-profile session seam 清扫',authSweepBlock.includes("session({action:'sweep_expired',at:now})")&&authSweepBlock.includes('changedUids'));
check('Timer Audit：正式 Token TTL sweep 失败记录并由统一 close dispose 清理',authSweepBlock.includes("recordOperationalError('auth_token_expiry_sweep'")&&serverIndex.includes("server.once('close',()=>serverClockTimer.dispose())"));
check('Timer Audit：Auth sweep 未新增原生 setInterval',!/const authTokenExpirySweep\s*=\s*setInterval\s*\(/.test(serverIndex));
const outboxBlockStart=serverIndex.indexOf("const SUPABASE_OUTBOX_SYNC_TIMER_OWNER='");
const outboxBlock=outboxBlockStart>=0?serverIndex.slice(outboxBlockStart):'';
check('Timer Audit：Supabase Reward/AI outbox 共用单一 ServerClockTimer owner',outboxBlock.includes("SUPABASE_OUTBOX_SYNC_TIMER_OWNER='supabase-outbox-sync'")&&outboxBlock.includes('owner:SUPABASE_OUTBOX_SYNC_TIMER_OWNER')&&outboxBlock.includes('repeat:true')&&outboxBlock.includes('Promise.allSettled'));
check('Timer Audit：Supabase outbox retry 保持 leader gate 与异常隔离',outboxBlock.includes("!useSupabase||!clusterCoordinator.isLeader()")&&outboxBlock.includes("supabase_reward_outbox_retry")&&outboxBlock.includes("supabase_ai_outbox_retry"));
check('Timer Audit：Supabase outbox 两类 drain 串行化避免并发 saveDB rename',outboxBlock.includes('const reward=Promise.resolve()')&&outboxBlock.includes('const ai=reward.catch(()=>undefined).then('));
check('Timer Audit：Supabase outbox 不再创建两个原生 interval',!/const rewardSyncSweep\s*=\s*setInterval\s*\(/.test(serverIndex)&&!/const aiLearningSyncSweep\s*=\s*setInterval\s*\(/.test(serverIndex));
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
