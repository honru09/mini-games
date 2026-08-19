/**
 * GATE-SUPABASE-PRODUCTION fail-closed preflight.
 *
 * This script deliberately does not claim real RLS, transaction, concurrency,
 * idempotency, backup, restore, rollback or multi-instance evidence. It only
 * discovers the PostgREST OpenAPI surface when server-only credentials exist.
 * Full release evidence must come from the production ops/acceptance workflow.
 */
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const RELEASE_PENDING = 'RELEASE_EVIDENCE_PENDING';
const RESULT_NOT_EXECUTED = 'NOT_EXECUTED';
const RESULT_PRECHECK_FAILED = 'PRECHECK_FAILED';
const RESULT_PRECHECK_PASS = 'PRECHECK_PASS_RELEASE_EVIDENCE_PENDING';
const EXIT_PRECHECK_FAILED = 1;
const EXIT_NOT_EXECUTED = 2;
const MAX_OPENAPI_RESPONSE_BYTES = 4 * 1024 * 1024;
const EXPECTED_TABLES = Object.freeze([
  'profiles', 'history', 'reward_history', 'economy_ledger', 'analytics_events',
  'friend_requests', 'friendships', 'blocks', 'reports', 'playline_posts',
  'playline_rate_events', 'direct_messages', 'direct_message_reads',
  'ai_learning_models', 'ai_learning_experiences', 'cluster_instances',
  'cluster_leases', 'platform_events', 'cluster_event_cursors', 'metrics_snapshots'
]);
const EXPECTED_RPCS = Object.freeze([
  'apply_reward_v1', 'apply_purchase_v1', 'apply_ai_learning_v1',
  'send_direct_message_v1', 'apply_direct_message_read_v1',
  'list_direct_messages_v1', 'list_direct_message_reads_v1',
  'create_playline_post_v1', 'list_playline_posts_v1',
  'delete_playline_post_v1', 'resolve_playline_report_target_v1',
  'purge_playline_posts_v1', 'claim_cluster_lease_v1',
  'renew_cluster_lease_v1', 'append_platform_event_v1',
  'list_platform_events_v1', 'commit_cluster_cursor_v1',
  'append_metrics_snapshot_v1', 'get_direct_message_by_id_v1',
  'cleanup_cluster_data_v1'
]);

function initialResults(now = new Date()) {
  const generatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  return {
    schemaVersion: 2,
    generatedAt,
    classification: 'LOCAL_PREFLIGHT_ONLY',
    result: RESULT_NOT_EXECUTED,
    releaseStatus: RELEASE_PENDING,
    environment: { status: 'NOT_EXECUTED' },
    connectivity: { status: 'NOT_EXECUTED' },
    schemaDiscovery: {
      status: 'NOT_EXECUTED',
      tables: Object.fromEntries(EXPECTED_TABLES.map(name => [name, false])),
      rpcs: Object.fromEntries(EXPECTED_RPCS.map(name => [name, false]))
    },
    rlsRoleMatrix: { status: 'NOT_EXECUTED', requiredEvidence: 'supabase/production-acceptance.sql output using database roles' },
    transactionIdempotency: { status: 'NOT_EXECUTED', requiredEvidence: 'real valid transaction identities and duplicate terminal result' },
    transactionConcurrency: { status: 'NOT_EXECUTED', requiredEvidence: 'real concurrent valid transactions with one authoritative commit' },
    encryptedBackup: { status: 'NOT_EXECUTED' },
    isolatedRestore: { status: 'NOT_EXECUTED' },
    nonDestructiveRollback: { status: 'NOT_EXECUTED' },
    multiInstance: { status: 'NOT_EXECUTED' },
    overallPass: false,
    boundary: 'OpenAPI discovery is not production Gate evidence and can never set overallPass=true.'
  };
}

function readEnvironment(env = process.env) {
  const asTrimmedString = value => value == null ? '' : String(value).trim();
  const rawUrl = asTrimmedString(env.SUPABASE_URL).replace(/\/+$/, '');
  const key = [env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_KEY, env.SUPABASE_KEY]
    .map(asTrimmedString)
    .find(Boolean) || '';
  return { rawUrl, key };
}

function validateServerOnlyKey(key) {
  if (!key) return { ok: false, reason: 'missing_server_only_service_role' };
  if (key.length > 4096 || /[\u0000-\u001f\u007f]/.test(key)) {
    return { ok: false, reason: 'invalid_server_only_service_role' };
  }
  return { ok: true };
}

function validateProductionUrl(rawUrl) {
  if (!rawUrl) return { ok: false, reason: 'missing_supabase_url' };
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid_supabase_url' };
  }
  const projectHost = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.supabase\.co$/i;
  if (
    parsed.protocol !== 'https:' ||
    !projectHost.test(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname && parsed.pathname !== '/') ||
    (parsed.port && parsed.port !== '443')
  ) {
    return { ok: false, reason: 'supabase_url_must_be_plain_https_origin' };
  }
  return { ok: true, origin: parsed.origin };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOperation(pathItem, method) {
  return isRecord(pathItem) && Object.prototype.hasOwnProperty.call(pathItem, method) && isRecord(pathItem[method]);
}

function ownValue(record, key) {
  return isRecord(record) && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function isOpenApiContentType(contentType) {
  const mediaType = String(contentType || '').split(';', 1)[0].trim().toLowerCase();
  return mediaType === 'application/openapi+json' || mediaType === 'application/json';
}

function isOpenApiVersion(document) {
  return isRecord(document) && (
    document.swagger === '2.0' ||
    (typeof document.openapi === 'string' && /^3\.\d+(?:\.\d+)?$/.test(document.openapi))
  );
}

function responseStatus(response) {
  return response && Number.isInteger(response.status) ? response.status : 0;
}

function defaultRequestOpenApi(origin, key) {
  return new Promise((resolve, reject) => {
    const request = https.request(`${origin}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/openapi+json, application/json'
      }
    }, response => {
      let body = '';
      let bodyBytes = 0;
      response.setEncoding('utf8');
      response.on('data', chunk => {
        bodyBytes += Buffer.byteLength(chunk, 'utf8');
        if (bodyBytes > MAX_OPENAPI_RESPONSE_BYTES) {
          request.destroy(new Error('openapi_response_too_large'));
          return;
        }
        body += chunk;
      });
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        contentType: String(response.headers['content-type'] || ''),
        body
      }));
    });
    request.on('error', reject);
    request.setTimeout(10000, () => request.destroy(new Error('openapi_request_timeout')));
    request.end();
  });
}

function evaluateOpenApi(response) {
  const status = responseStatus(response);
  if (status !== 200) {
    return { ok: false, transportOk: false, reason: `openapi_http_${status}` };
  }
  if (!isOpenApiContentType(response.contentType)) {
    return { ok: false, transportOk: false, reason: 'openapi_content_type_invalid' };
  }
  let document;
  const rawBody = String(response.body || '');
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_OPENAPI_RESPONSE_BYTES) {
    return { ok: false, transportOk: false, reason: 'openapi_response_too_large' };
  }
  try {
    document = JSON.parse(rawBody);
  } catch {
    return { ok: false, transportOk: false, reason: 'openapi_json_invalid' };
  }
  if (!isOpenApiVersion(document) || !isRecord(document.paths)) {
    return { ok: false, transportOk: false, reason: 'openapi_document_invalid' };
  }
  const definitions = isRecord(document.definitions) ? document.definitions : {};
  const componentSchemas = isRecord(document.components) && isRecord(document.components.schemas)
    ? document.components.schemas
    : {};
  const schemas = { ...definitions, ...componentSchemas };
  const tables = Object.fromEntries(EXPECTED_TABLES.map(name => [
    name,
    // A generated OpenAPI schema is the only table surface this preflight may
    // inspect; it never probes a table endpoint.  RPCs additionally require
    // their documented POST operation because a path-only probe is ambiguous.
    Object.prototype.hasOwnProperty.call(schemas, name)
  ]));
  const rpcs = Object.fromEntries(EXPECTED_RPCS.map(name => [
    name,
    hasOperation(ownValue(document.paths, `/rpc/${name}`), 'post')
  ]));
  const allTables = Object.values(tables).every(Boolean);
  const allRpcs = Object.values(rpcs).every(Boolean);
  return {
    ok: allTables && allRpcs,
    transportOk: true,
    reason: allTables && allRpcs ? null : 'openapi_schema_incomplete',
    tables,
    rpcs
  };
}

function safeRequestFailureReason(error) {
  const safeCodes = new Set([
    'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT',
    'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_INVALID_ARG_VALUE', 'ERR_INVALID_URL'
  ]);
  const code = error && typeof error.code === 'string' && safeCodes.has(error.code)
    ? error.code.toLowerCase()
    : '';
  return code ? `openapi_request_${code}` : 'openapi_request_failed';
}

function saveEvidence(results, evidenceDir = path.join(__dirname, '..', 'requirements', 'active', 'supabase-gate-evidence')) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const stamp = results.generatedAt.replace(/[^0-9]/g, '').slice(0, 17);
  const filePath = path.join(evidenceDir, `supabase-preflight-${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf8');
  return filePath;
}

function printSummary(results, logger = console) {
  logger.log('=== GATE-SUPABASE-PRODUCTION FAIL-CLOSED PREFLIGHT ===');
  logger.log(`Result: ${results.result}`);
  logger.log(`Release status: ${results.releaseStatus}`);
  logger.log(`Environment: ${results.environment.status}`);
  logger.log(`Connectivity: ${results.connectivity.status}`);
  logger.log(`Schema discovery: ${results.schemaDiscovery.status}`);
  logger.log('RLS / valid transaction idempotency / concurrency / backup / restore / rollback / multi-instance: NOT_EXECUTED');
  logger.log('This preflight does not open the production Gate and never emits a production PASS.');
}

async function runChecklist(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const persist = options.persist === true;
  const results = initialResults(options.now ?? new Date());
  const { rawUrl, key } = readEnvironment(env);
  const validatedUrl = validateProductionUrl(rawUrl);
  const validatedKey = validateServerOnlyKey(key);

  if (!rawUrl || !validatedKey.ok) {
    results.environment = { status: 'NOT_EXECUTED', reason: !rawUrl ? 'missing_supabase_url' : validatedKey.reason };
    results.result = RESULT_NOT_EXECUTED;
    if (persist) results.evidencePath = saveEvidence(results, options.evidenceDir);
    printSummary(results, logger);
    return results;
  }

  if (!validatedUrl.ok) {
    results.environment = { status: 'PRECHECK_FAILED', reason: validatedUrl.reason };
    results.result = RESULT_PRECHECK_FAILED;
    if (persist) results.evidencePath = saveEvidence(results, options.evidenceDir);
    printSummary(results, logger);
    return results;
  }

  results.environment = { status: 'PRESENT_SERVER_ONLY', origin: validatedUrl.origin };
  try {
    const requestOpenApi = options.requestOpenApi || defaultRequestOpenApi;
    const response = await requestOpenApi(validatedUrl.origin, key);
    const discovery = evaluateOpenApi(response);
    results.connectivity = discovery.transportOk
      ? { status: 'PRECHECK_PASS', httpStatus: responseStatus(response) }
      : { status: 'PRECHECK_FAILED', reason: discovery.reason || 'openapi_transport_failed' };
    results.schemaDiscovery = {
      status: discovery.ok ? 'PRECHECK_PASS' : 'PRECHECK_FAILED',
      reason: discovery.reason,
      tables: discovery.tables || results.schemaDiscovery.tables,
      rpcs: discovery.rpcs || results.schemaDiscovery.rpcs
    };
    results.result = discovery.ok ? RESULT_PRECHECK_PASS : RESULT_PRECHECK_FAILED;
  } catch (error) {
    results.connectivity = { status: 'PRECHECK_FAILED', reason: safeRequestFailureReason(error) };
    results.result = RESULT_PRECHECK_FAILED;
  }

  // Fail closed by design: discovery cannot prove RLS or transaction semantics.
  results.overallPass = false;
  results.releaseStatus = RELEASE_PENDING;
  if (persist) results.evidencePath = saveEvidence(results, options.evidenceDir);
  printSummary(results, logger);
  return results;
}

function exitCodeForResults(results) {
  if (!results || results.result === RESULT_NOT_EXECUTED) return EXIT_NOT_EXECUTED;
  if (results.result === RESULT_PRECHECK_FAILED) return EXIT_PRECHECK_FAILED;
  return 0;
}

module.exports = {
  EXPECTED_TABLES,
  EXPECTED_RPCS,
  RELEASE_PENDING,
  RESULT_NOT_EXECUTED,
  RESULT_PRECHECK_FAILED,
  RESULT_PRECHECK_PASS,
  EXIT_PRECHECK_FAILED,
  EXIT_NOT_EXECUTED,
  MAX_OPENAPI_RESPONSE_BYTES,
  initialResults,
  readEnvironment,
  validateServerOnlyKey,
  validateProductionUrl,
  evaluateOpenApi,
  responseStatus,
  exitCodeForResults,
  safeRequestFailureReason,
  runChecklist
};

if (require.main === module) {
  runChecklist({ persist: true }).then(results => {
    process.exitCode = exitCodeForResults(results);
  }).catch(error => {
    console.error(`PRECHECK_FAILED: ${safeRequestFailureReason(error)}`);
    process.exitCode = EXIT_PRECHECK_FAILED;
  });
}
