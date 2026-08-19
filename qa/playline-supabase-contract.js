// Playline Supabase 合同静态回归。
// 不连接真实 Supabase；这里只确认迁移是可重复、service_role-only 且不扩大
// 浏览器权限。真实 SQL/RLS/并发/备份验收仍是生产门禁。
'use strict';

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');
const lower = sql.toLowerCase();
const failures = [];

function check(name, condition, detail) {
  const ok = !!condition;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : ' :: ' + detail));
  if (!ok) failures.push(name);
}

function tableBody(name) {
  const match = lower.match(new RegExp(
    'create\\s+table\\s+if\\s+not\\s+exists\\s+' + name + '\\s*\\(([^;]*?)\\n\\);', 'i'
  ));
  return match ? match[1] : '';
}

function functionBody(name) {
  const start = lower.indexOf('create or replace function ' + name);
  if (start < 0) return '';
  const endCandidates = [
    lower.indexOf('create or replace function ', start + 1),
    lower.indexOf('\n-- 多实例协调', start + 1),
    lower.indexOf('\nalter table profiles enable row level security', start + 1),
  ].filter(index => index >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : lower.length;
  return lower.slice(start, end);
}

const posts = tableBody('playline_posts');
const rates = tableBody('playline_rate_events');
const createRpc = functionBody('create_playline_post_v1');
const listRpc = functionBody('list_playline_posts_v1');
const deleteRpc = functionBody('delete_playline_post_v1');
const reportRpc = functionBody('resolve_playline_report_target_v1');
const purgeRpc = functionBody('purge_playline_posts_v1');

check('playline_posts is created idempotently', /create\s+table\s+if\s+not\s+exists\s+playline_posts\s*\(/i.test(sql));
check('playline posts keep opaque id, internal sequence, and author FK',
  /\bid\s+text\s+primary\s+key/i.test(posts) &&
  /\bseq\s+bigserial\s+not\s+null\s+unique/i.test(posts) &&
  /author_uid\s+text\s+not\s+null\s+references\s+profiles\s*\(uid\)/i.test(posts));
check('author-scoped clientPostId is unique and indexed',
  /client_post_id\s+text\s+not\s+null/i.test(posts) &&
  /create\s+unique\s+index\s+if\s+not\s+exists\s+idx_playline_posts_author_client_post\s+on\s+playline_posts\s*\(author_uid,\s*client_post_id\)/i.test(sql));
check('audience, content kind, and version are constrained',
  /audience\s+text\s+not\s+null\s+check\s*\(audience\s+in\s*\('all',\s*'friends'\)\)/i.test(posts) &&
  /content_kind\s+text\s+not\s+null\s+check\s*\(content_kind\s+in\s*\('text',\s*'game_share',\s*'result_share',\s*'record_share'\)\)/i.test(posts) &&
  /content_version\s+integer\s+not\s+null/i.test(posts));
check('canonical JSONB and private source have bounded object storage',
  /canonical_content\s+jsonb\s+not\s+null/i.test(posts) &&
  /private_source\s+jsonb\s+not\s+null/i.test(posts) &&
  /jsonb_typeof\(canonical_content\)\s*=\s*'object'/i.test(posts));
check('state, created/deleted/expiry lifecycle fields exist',
  /state\s+text\s+not\s+null\s+default\s+'active'/i.test(posts) &&
  /created_at\s+timestamptz\s+not\s+null/i.test(posts) &&
  /deleted_at\s+timestamptz/i.test(posts) &&
  /expires_at\s+timestamptz\s+not\s+null/i.test(posts));
check('keyset and author/audience indexes exist',
  /idx_playline_posts_created_id[\s\S]*on\s+playline_posts\s*\(created_at\s+desc,\s*id\s+desc\)/i.test(sql) &&
  /idx_playline_posts_audience_created_id[\s\S]*on\s+playline_posts\s*\(audience,\s*created_at\s+desc,\s*id\s+desc\)/i.test(sql) &&
  /idx_playline_posts_author_created[\s\S]*on\s+playline_posts\s*\(author_uid,\s*created_at\s+desc,\s*id\s+desc\)/i.test(sql));
check('rate events are bounded to service-side action metadata',
  /create\s+table\s+if\s+not\s+exists\s+playline_rate_events/i.test(sql) &&
  /author_uid\s+text\s+not\s+null\s+references\s+profiles\s*\(uid\)/i.test(rates) &&
  /event_kind\s+text\s+not\s+null\s+check/i.test(rates) &&
  /idx_playline_rate_events_author_kind_created/i.test(sql));

for (const table of ['playline_posts', 'playline_rate_events']) {
  check(table + ' has RLS and no browser grants',
    new RegExp('alter\\s+table\\s+' + table + '\\s+enable\\s+row\\s+level\\s+security', 'i').test(sql) &&
    new RegExp('revoke\\s+all\\s+on\\s+table\\s+' + table + '\\s+from\\s+public,\\s*anon,\\s*authenticated', 'i').test(sql) &&
    new RegExp('grant\\s+all\\s+on\\s+table\\s+' + table + '\\s+to\\s+service_role', 'i').test(sql));
}

const rpcSpecs = [
  ['create_playline_post_v1', createRpc, /create_playline_post_v1\s*\([^)]*p_author_uid[^)]*p_client_post_id[^)]*p_canonical_content/i],
  ['list_playline_posts_v1', listRpc, /list_playline_posts_v1\s*\([^)]*p_actor_uid[^)]*p_scope[^)]*p_before_seq[^)]*p_snapshot[^)]*p_limit/i],
  ['delete_playline_post_v1', deleteRpc, /delete_playline_post_v1\s*\([^)]*p_author_uid[^)]*p_post_id/i],
  ['resolve_playline_report_target_v1', reportRpc, /resolve_playline_report_target_v1\s*\([^)]*p_reporter_uid[^)]*p_post_id/i],
  ['purge_playline_posts_v1', purgeRpc, /purge_playline_posts_v1\s*\([^)]*p_now/i],
];
for (const [name, body, signature] of rpcSpecs) {
  check(name + ' exists with the actor/input contract', signature.test(sql));
  check(name + ' is SECURITY DEFINER with a fixed public search_path',
    /security\s+definer/i.test(body) && /set\s+search_path\s*=\s*public/i.test(body));
  check(name + ' is executable only by service_role',
    new RegExp('revoke\\s+all\\s+on\\s+function\\s+' + name + '[\\s\\S]*?from\\s+public,\\s*anon,\\s*authenticated', 'i').test(sql) &&
    new RegExp('grant\\s+execute\\s+on\\s+function\\s+' + name + '[\\s\\S]*?to\\s+service_role', 'i').test(sql));
}

check('create RPC validates author, four kinds, canonical fields and expiry',
  /not\s+exists\s*\(select\s+1\s+from\s+profiles\s+where\s+uid\s*=\s*p_author_uid/i.test(createRpc) &&
  /'text'[\s\S]*'game_share'[\s\S]*'result_share'[\s\S]*'record_share'/i.test(createRpc) &&
  /p_canonical_content\s+is\s+null[\s\S]*jsonb_typeof\(p_canonical_content\)/i.test(createRpc) &&
  /p_content_kind\s*=\s*'text'[\s\S]*char_length\(p_canonical_content->>'text'\)[\s\S]*280/i.test(createRpc) &&
  /v_expires_at\s*<=\s*clock_timestamp/i.test(createRpc));
check('create RPC serializes idempotency and returns conflict/replay states',
  /pg_advisory_xact_lock[\s\S]*playline:/i.test(createRpc) &&
  /where\s+author_uid\s*=\s*p_author_uid\s+and\s+client_post_id\s*=\s*p_client_post_id[\s\S]*for\s+update/i.test(createRpc) &&
  /idempotency_conflict/i.test(createRpc) && /unique_violation/i.test(createRpc));
check('create RPC records rate events without copying body to audit tables',
  /playline_rate_events[\s\S]*event_kind\s*=\s*'publish'/i.test(createRpc) &&
  !/insert\s+into\s+(reports|analytics_events)[\s\S]*canonical_content/i.test(createRpc));

check('list RPC performs keyset pagination and dynamic friendship/Block filtering',
  /p_before_seq[\s\S]*v_before_seq/i.test(listRpc) &&
  /p\.seq\s*<\s*v_before_seq/i.test(listRpc) &&
  /not\s+exists\s*\([\s\S]*from\s+blocks[\s\S]*blocker_uid\s*=\s*p_actor_uid[\s\S]*blocked_uid\s*=\s*p\.author_uid[\s\S]*blocker_uid\s*=\s*p\.author_uid[\s\S]*blocked_uid\s*=\s*p_actor_uid/i.test(listRpc) &&
  /from\s+friendships[\s\S]*least\(p_actor_uid,\s*p\.author_uid\)[\s\S]*greatest\(p_actor_uid,\s*p\.author_uid\)/i.test(listRpc));
check('list RPC returns the narrow service-store record required by the Node projection',
  /jsonb_build_object\([\s\S]*'id'[\s\S]*'seq'[\s\S]*'authoruid'[\s\S]*'safesnapshot'/i.test(listRpc) &&
  /canonical_content\s*-\s*array\[[\s\S]*'private_source'[\s\S]*'seq'/i.test(listRpc) &&
  !/\b(?:row_value|p)\.private_source\b/i.test(listRpc) &&
  !/'author'[\s\S]*'name'/i.test(listRpc));
check('list RPC enforces 60/minute query rate and 30-item hard cap',
  /event_kind\s*=\s*'list'[\s\S]*interval\s*'1 minute'/i.test(listRpc) &&
  /least\(coalesce\(p_limit,\s*20\),\s*30\)/i.test(listRpc));

check('delete RPC is an idempotent tombstone and never physically deletes rows',
  /for\s+update[\s\S]*state\s*<>\s*'active'[\s\S]*duplicate/i.test(deleteRpc) &&
  /update\s+playline_posts[\s\S]*set\s+state\s*=\s*'deleted'[\s\S]*deleted_at/i.test(deleteRpc) &&
  !/\bdelete\s+from\s+playline_posts/i.test(deleteRpc));
check('report target RPC binds post id to the actual author and playline context',
  /select\s+author_uid,\s*audience\s+into[\s\S]*from\s+playline_posts[\s\S]*state\s*=\s*'active'/i.test(reportRpc) &&
  /'targetuid'[\s\S]*v_author_uid[\s\S]*'contexttype'[\s\S]*'playline'[\s\S]*'contextid'[\s\S]*p_post_id/i.test(reportRpc) &&
  !/'canonical_content'|'body'|'text'/i.test(reportRpc));
check('purge RPC expires posts without destructive post deletion',
  /update\s+playline_posts[\s\S]*state\s*=\s*'expired'/i.test(purgeRpc) && !/delete\s+from\s+playline_posts/i.test(purgeRpc));
check('Playline RPCs do not write post body into reports or analytics',
  !/insert\s+into\s+(reports|analytics_events)[\s\S]*playline/i.test(sql) &&
  !/insert\s+into\s+(reports|analytics_events)[\s\S]*canonical_content/i.test(sql));
check('migration is non-destructive and feature remains default-off',
  !/drop\s+table\s+(if\s+exists\s+)?playline_/i.test(sql) &&
  !/truncate\s+playline_/i.test(sql) &&
  !/enable_playline_v1\s*=\s*1/i.test(sql));

if (failures.length) {
  console.error('PLAYLINE_SUPABASE_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('PLAYLINE_SUPABASE_ALL_PASS');
}
