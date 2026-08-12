'use strict';

const fs=require('fs');
const path=require('path');
const {ClusterCoordinator,TelemetryExporter,safeMetrics,privateAddress}=require('../server/cluster-coordinator');
const ROOT=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}

async function main(){
  const schema=read('supabase/schema.sql'),ops=read('scripts/supabase-production-ops.ps1'),acceptance=read('supabase/production-acceptance.sql');
  const rollback=read('supabase/non-destructive-rollback.sql'),gitignore=read('.gitignore');
  const synthetic=read('scripts/long-session-smoke.js');
  const requiredTables=['cluster_instances','cluster_leases','platform_events','cluster_event_cursors','metrics_snapshots'];
  const requiredRpcs=['claim_cluster_lease_v1','renew_cluster_lease_v1','append_platform_event_v1','list_platform_events_v1','commit_cluster_cursor_v1','append_metrics_snapshot_v1','get_direct_message_by_id_v1','cleanup_cluster_data_v1'];
  check('Production DB：五张多实例/遥测表齐全并启用 RLS',requiredTables.every(table=>new RegExp('create table if not exists '+table,'i').test(schema)&&new RegExp('alter table '+table+' enable row level security','i').test(schema)));
  check('Production DB：租约/PubSub/指标 RPC 只授权 service_role',requiredRpcs.every(name=>new RegExp('revoke all on function '+name+'[\\s\\S]*?from public, anon, authenticated;[\\s\\S]*?grant execute on function '+name+'[\\s\\S]*?to service_role;','i').test(schema)));
  check('Production DB：租约使用数据库时间、事务锁与 fencing token',/claim_cluster_lease_v1[\s\S]*clock_timestamp\(\)[\s\S]*pg_advisory_xact_lock[\s\S]*fencing_token\+1/i.test(schema)&&/stale_cluster_fencing_token/i.test(schema));
  check('Production DB：有效租约不可被其他实例抢占且过期数据由 leader 清理',/v_takeover\s*:=\s*v_row\.holder_instance_id is null or v_row\.lease_until <= v_now/i.test(schema)&&!/v_takeover\s*:=\s*[^;]*holder_instance_id <> p_instance_id/i.test(schema)&&/cleanup_cluster_data_v1[\s\S]*platform_events[\s\S]*metrics_snapshots[\s\S]*cluster_event_cursors[\s\S]*cluster_instances/i.test(schema));
  check('Production DB：事件 payload 白名单拒绝正文与凭证',/platform_event_payload_allowed_v1[\s\S]*body\|text\|message\|password\|pin\|token\|secret\|prompt\|authorization/i.test(schema)&&/when 'direct_message'[\s\S]*messageId/i.test(schema));
  check('Production Ops：默认 dry-run、迁移先备份且回滚不破坏数据',/\[string\]\$Action = 'plan'/.test(ops)&&/if \(-not \$Execute\)/.test(ops)&&/New-VerifiedBackup \$url[\s\S]*--single-transaction/.test(ops)&&!/\b(?:delete\s+from|truncate|drop\s+(?:table|column|schema|database))\b/i.test(rollback));
  check('Production Ops：恢复演练按 Supabase project ref 隔离并有破坏确认',/Get-SupabaseDatabaseIdentity/.test(ops)&&/sourceIdentity\.ProjectRef -eq \$targetIdentity\.ProjectRef/.test(ops)&&/I_UNDERSTAND_EPHEMERAL_TARGET_WILL_BE_REPLACED/.test(ops));
  check('Production Ops：备份目录 ACL/实际加密属性/保留期与失败残片清理受控',/icacls/.test(ops)&&/cipher \/E/.test(ops)&&/\[IO\.FileAttributes\]::Encrypted/.test(ops)&&/Test-BitLockerProtectedVolume/.test(ops)&&/SUPABASE_BACKUP_RETENTION_DAYS/.test(ops)&&/Remove-Item -LiteralPath \$target -Force/.test(ops));
  check('Production Ops：plan 覆盖 dump/restore、项目身份和加密存储',/'plan'[\s\S]*Get-SupabaseDatabaseIdentity[\s\S]*Require-Tool 'pg_dump'[\s\S]*Require-Tool 'pg_restore'[\s\S]*Ensure-BackupStorage/.test(ops)&&/--dbname \$DatabaseUrl/.test(ops)&&/--dbname \$url/.test(ops)&&/--dbname \$target/.test(ops));
  check('Production Ops：本地凭证和自定义 dump 均被 Git 忽略',/^\.env$/m.test(gitignore)&&/^\.env\.\*$/m.test(gitignore)&&/^\*\.dump$/m.test(gitignore));
  check('Synthetic Session：默认只连本机且生产永久账号要求显式确认',/ws:\/\/127\.0\.0\.1:8080\/ws/.test(synthetic)&&/SYNTHETIC_PRODUCTION_CONFIRM/.test(synthetic)&&/CREATE_PERSISTENT_QA_ACCOUNTS/.test(synthetic));
  check('Production Acceptance：真实 RLS/权限/租约/游标均有探针',/relrowsecurity/.test(acceptance)&&/has_table_privilege\('anon'/.test(acceptance)&&/claim_cluster_lease_v1/.test(acceptance)&&/commit_cluster_cursor_v1/.test(acceptance)&&/rollback;/i.test(acceptance));

  const calls=[],events=[];let listed=false;
  const coordinator=new ClusterCoordinator({enabled:true,instanceId:'test-instance-a',deploymentId:'test-deploy',
    rpc:async(name,payload)=>{calls.push({name,payload});if(name==='claim_cluster_lease_v1')return{claimed:true,fencingToken:'7'};
      if(name==='renew_cluster_lease_v1')return{renewed:true,fencingToken:'7'};
      if(name==='list_platform_events_v1'){if(!listed&&payload.p_topic==='direct_message'){listed=true;return[{id:'11',topic:'direct_message',originInstanceId:'test-instance-b',payload:{messageId:'msg_123456',senderUid:'u_sender',recipientUid:'u_recipient'}}];}return[];}
      if(name==='append_metrics_snapshot_v1')return{id:'31',generatedAt:payload.p_generated_at};
      return{};},onEvent:async(topic,payload)=>events.push({topic,payload}),onError:(context,error)=>{throw new Error(context+':'+error.message);}});
  await coordinator.start();
  await coordinator.publishDirectMessage('msg_abcdef','u_sender','u_recipient');
  await coordinator.recordMetrics({generatedAt:'2026-08-09T00:00:00.000Z',activeMatches:2,token:'must-strip'});
  coordinator.stop();
  check('Cluster Runtime：实例租约、跨实例事件消费、游标与 leader 清理闭环',events.length===1&&calls.some(call=>call.name==='claim_cluster_lease_v1')&&calls.some(call=>call.name==='commit_cluster_cursor_v1')&&calls.some(call=>call.name==='cleanup_cluster_data_v1'));
  const published=calls.find(call=>call.name==='append_platform_event_v1'&&call.payload.p_topic==='direct_message');
  check('Cluster Runtime：Direct Chat 事件只发布消息 ID 与参与 UID',published&&JSON.stringify(Object.keys(published.payload.p_payload).sort())===JSON.stringify(['messageId','recipientUid','senderUid'])&&!JSON.stringify(published).includes('must-strip'));
  check('Telemetry Runtime：只保留数值指标并拒绝私网地址',safeMetrics({generatedAt:'x',activeMatches:3,token:'secret',nested:{}}).activeMatches===3&&!('token' in safeMetrics({token:1}))&&privateAddress('127.0.0.1')&&privateAddress('10.0.0.1')&&privateAddress('::ffff:127.0.0.1'));
  let privateRejected=false;try{await new TelemetryExporter({url:'https://127.0.0.1/hook',allowlist:'127.0.0.1'}).validate();}catch(error){privateRejected=error.message==='telemetry_private_destination';}
  check('Telemetry Runtime：HTTPS 仍需显式域名 allowlist 且 DNS/私网受阻',privateRejected);

  const manifest=JSON.parse(read('public/manifest.webmanifest')),template=read('public/index-template.html'),sw=read('public/sw.js');
  const pwa192=manifest.icons.find(icon=>icon.src==='assets/brand/pwa/ghost-game-192.png');
  const pwa512=manifest.icons.find(icon=>icon.src==='assets/brand/pwa/ghost-game-512.png');
  check('PWA：Manifest/PNG 品牌图标/standalone/scope 完整',manifest.name==='Ghost Game'&&manifest.display==='standalone'&&manifest.scope==='./'&&pwa192&&pwa192.sizes==='192x192'&&pwa512&&pwa512.sizes==='512x512'&&fs.existsSync(path.join(ROOT,'public',pwa192.src))&&fs.existsSync(path.join(ROOT,'public',pwa512.src)));
  check('PWA：模板注册 Service Worker、Apple 图标并同步主题色',/rel="manifest"/.test(template)&&/serviceWorker\.register\('\.\/sw\.js'/.test(template)&&/pwa-theme-color/.test(template)&&/rel="apple-touch-icon"[^>]*ghost-game-192\.png/.test(template));
  check('PWA：HTML network-first、静态版本缓存且 API/WS/Authorization 不缓存',/networkFirstNavigation/.test(sw)&&/CACHE_VERSION/.test(sw)&&/ghost-game-192\.png/.test(sw)&&/ghost-game-512\.png/.test(sw)&&/authorization/.test(sw)&&/api/.test(sw)&&/ws/.test(sw)&&/request\.mode==='navigate'/.test(sw));

  const artAudit=JSON.parse(read('requirements/active/production-readiness-sprint-p0-20260809/evidence/honru-cleanup-candidate-v1-audit.json'));
  const reviewerB=read('art-source/brand/ghost-game/honru/cleanup-candidate-v1/IP_REVIEW_Reviewer_B_PENDING.md');
  const goldenDecision=read('art-source/brand/ghost-game/honru/cleanup-candidate-v1/GOLDEN_SET_DECISION_PENDING.md');
  check('Honru Cleanup：Alpha/绿色污染/四档小尺寸均为技术 PASS',artAudit.status==='TECHNICAL_PASS'&&artAudit.source.cornerAlpha.every(value=>value===0)&&artAudit.source.greenContaminationPixels===0&&artAudit.derived.length===4&&artAudit.derived.every(item=>item.technicalPass));
  check('Honru Approval：Reviewer B 与 Golden Set 未签字时固定不默认开启',/BLOCKED_EXTERNAL/.test(reviewerB)&&/姓名：________________/.test(reviewerB)&&/DO_NOT_ENABLE/.test(goldenDecision)&&/用户 Golden Set 批准 \| 未签字/.test(goldenDecision));

  if(failures.length){console.error('PRODUCTION_READINESS_CONTRACT_FAILED: '+failures.join('、'));process.exitCode=1;}
  else console.log('PRODUCTION_READINESS_CONTRACT_ALL_PASS');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
