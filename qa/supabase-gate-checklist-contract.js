'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  EXPECTED_TABLES: IMPLEMENTATION_TABLES,
  EXPECTED_RPCS: IMPLEMENTATION_RPCS,
  RELEASE_PENDING,
  RESULT_NOT_EXECUTED,
  RESULT_PRECHECK_FAILED,
  RESULT_PRECHECK_PASS,
  EXIT_NOT_EXECUTED,
  EXIT_PRECHECK_FAILED,
  exitCodeForResults,
  evaluateOpenApi,
  readEnvironment,
  validateServerOnlyKey,
  runChecklist,
  validateProductionUrl
} = require('../scripts/supabase-gate-checklist');

const ROOT = path.resolve(__dirname, '..');
const silentLogger = { log() {}, error() {} };

// Keep this contract's required surface independent from the implementation
// arrays.  If the checklist silently drops a schema table/RPC, this fixture
// must still require the authoritative SQL surface and fail red first.
const REQUIRED_TABLES = Object.freeze([
  'profiles', 'history', 'reward_history', 'economy_ledger', 'analytics_events',
  'friend_requests', 'friendships', 'blocks', 'reports',
  'playline_posts', 'playline_rate_events', 'direct_messages',
  'direct_message_reads', 'ai_learning_models', 'ai_learning_experiences',
  'cluster_instances', 'cluster_leases', 'platform_events',
  'cluster_event_cursors', 'metrics_snapshots'
]);
const REQUIRED_RPCS = Object.freeze([
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

function openApiDocument({ missingTable, missingRpc } = {}) {
  const definitions = Object.fromEntries(REQUIRED_TABLES
    .filter(name => name !== missingTable)
    .map(name => [name, { type: 'object' }]));
  const tablePaths = Object.fromEntries(REQUIRED_TABLES
    .filter(name => name !== missingTable)
    .map(name => [`/${name}`, { get: {} }]));
  const rpcPaths = Object.fromEntries(REQUIRED_RPCS
    .filter(name => name !== missingRpc)
    .map(name => [`/rpc/${name}`, { post: {} }]));
  const paths = { ...tablePaths, ...rpcPaths };
  return { swagger: '2.0', definitions, paths };
}

async function main() {
  assert.deepStrictEqual([...IMPLEMENTATION_TABLES], [...REQUIRED_TABLES],
    'checklist table expectations must cover the independent SQL contract');
  assert.deepStrictEqual([...IMPLEMENTATION_RPCS], [...REQUIRED_RPCS],
    'checklist RPC expectations must cover the independent SQL contract');

  assert.deepStrictEqual(validateProductionUrl('http://example.supabase.co'), {
    ok: false,
    reason: 'supabase_url_must_be_plain_https_origin'
  });
  assert.strictEqual(validateProductionUrl('https://user:secret@example.supabase.co').ok, false);
  assert.strictEqual(validateProductionUrl('https://example.supabase.co?token=secret').ok, false);
  assert.deepStrictEqual(validateProductionUrl('https://example.supabase.co/'), {
    ok: true,
    origin: 'https://example.supabase.co'
  });
  for (const invalidUrl of [
    'https://example.supabase.co/private-path',
    'https://example.supabase.co:8443',
    'https://example.invalid',
    'https://127.0.0.1',
    'https://example.supabase.co/#fragment'
  ]) assert.strictEqual(validateProductionUrl(invalidUrl).ok, false, invalidUrl);
  assert.strictEqual(validateProductionUrl('https://example.supabase.co:443').ok, true);
  assert.deepStrictEqual(readEnvironment({
    SUPABASE_SERVICE_ROLE_KEY: '  ',
    SUPABASE_KEY: ' legacy-server-key '
  }), { rawUrl: '', key: 'legacy-server-key' });
  assert.strictEqual(validateServerOnlyKey(' \n ').ok, false);
  assert.strictEqual(validateServerOnlyKey('server-only-test-key').ok, true);

  let requestCount = 0;
  const missing = await runChecklist({
    env: {},
    persist: false,
    logger: silentLogger,
    now: new Date('2026-08-17T00:00:00.000Z'),
    requestOpenApi: async () => {
      requestCount += 1;
      throw new Error('must_not_request_without_credentials');
    }
  });
  assert.strictEqual(requestCount, 0);
  assert.strictEqual(missing.result, RESULT_NOT_EXECUTED);
  assert.strictEqual(exitCodeForResults(missing), EXIT_NOT_EXECUTED);
  assert.strictEqual(missing.releaseStatus, RELEASE_PENDING);
  assert.strictEqual(missing.overallPass, false);
  assert.strictEqual(missing.rlsRoleMatrix.status, 'NOT_EXECUTED');
  assert.strictEqual(missing.transactionIdempotency.status, 'NOT_EXECUTED');
  assert.strictEqual(missing.transactionConcurrency.status, 'NOT_EXECUTED');

  const validResponse = {
    status: 200,
    contentType: 'application/openapi+json; charset=utf-8',
    body: JSON.stringify(openApiDocument())
  };
  const validDiscovery = evaluateOpenApi(validResponse);
  assert.strictEqual(validDiscovery.ok, true);
  const legacyShapeDiscovery = evaluateOpenApi({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      swagger: '2.0',
      definitions: Object.fromEntries(REQUIRED_TABLES.map(name => [name, { type: 'object' }])),
      paths: Object.fromEntries(REQUIRED_RPCS.map(name => [`/rpc/${name}`, { post: {} }]))
    })
  });
  assert.strictEqual(legacyShapeDiscovery.ok, true, 'OpenAPI table definitions remain compatible when table paths are omitted');

  const precheck = await runChecklist({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'server-only-test-key' },
    persist: false,
    logger: silentLogger,
    requestOpenApi: async () => validResponse
  });
  assert.strictEqual(precheck.result, RESULT_PRECHECK_PASS);
  assert.strictEqual(precheck.schemaDiscovery.status, 'PRECHECK_PASS');
  assert.strictEqual(precheck.releaseStatus, RELEASE_PENDING);
  assert.strictEqual(precheck.overallPass, false);
  assert.strictEqual(precheck.connectivity.status, 'PRECHECK_PASS');
  for (const key of [
    'rlsRoleMatrix', 'transactionIdempotency', 'transactionConcurrency',
    'encryptedBackup', 'isolatedRestore', 'nonDestructiveRollback', 'multiInstance'
  ]) assert.strictEqual(precheck[key].status, 'NOT_EXECUTED', `${key} must remain fail-closed`);
  assert.strictEqual(exitCodeForResults(precheck), 0);

  const calls = [];
  const requestError = await runChecklist({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'server-only-test-key' },
    persist: false,
    logger: silentLogger,
    requestOpenApi: async (origin, key) => {
      calls.push({ origin, key });
      const error = new Error('secret-response-body-must-not-leak');
      error.code = 'ECONNRESET';
      throw error;
    }
  });
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0], { origin: 'https://example.supabase.co', key: 'server-only-test-key' });
  assert.strictEqual(requestError.result, RESULT_PRECHECK_FAILED);
  assert.strictEqual(requestError.connectivity.reason, 'openapi_request_econnreset');
  assert(!JSON.stringify(requestError).includes('secret-response-body-must-not-leak'));
  assert.strictEqual(exitCodeForResults(requestError), EXIT_PRECHECK_FAILED);

  let whitespaceRequestCount = 0;
  const whitespaceKey = await runChecklist({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: '   ' },
    persist: false,
    logger: silentLogger,
    requestOpenApi: async () => { whitespaceRequestCount += 1; }
  });
  assert.strictEqual(whitespaceRequestCount, 0);
  assert.strictEqual(whitespaceKey.result, RESULT_NOT_EXECUTED);

  for (const status of [400, 401, 403, 404, 500]) {
    const rejected = evaluateOpenApi({ status, contentType: 'application/json', body: '{}' });
    assert.strictEqual(rejected.ok, false, `HTTP ${status} must not prove schema or RPC existence`);
  }
  assert.strictEqual(evaluateOpenApi({
    status: 200,
    contentType: 'text/html',
    body: JSON.stringify(openApiDocument())
  }).transportOk, false);
  assert.strictEqual(evaluateOpenApi({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ swagger: '2.0', definitions: {}, paths: {} })
  }).transportOk, true);
  assert.strictEqual(evaluateOpenApi({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ swagger: '2.0', definitions: Object.fromEntries(REQUIRED_TABLES.map(name => [name, {}])), paths: Object.fromEntries(REQUIRED_TABLES.map(name => [`/${name}`, { get: {} }]).concat(REQUIRED_RPCS.map(name => [`/rpc/${name}`, { get: {} }]))) })
  }).ok, false, 'RPC GET-only paths are not RPC evidence');
  assert.strictEqual(evaluateOpenApi({ status: 200, contentType: 'text/html', body: JSON.stringify(openApiDocument()) }).ok, false);
  assert.strictEqual(evaluateOpenApi({ status: 200, contentType: 'application/json', body: 'not-json' }).ok, false);
  assert.strictEqual(evaluateOpenApi({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(openApiDocument({ missingTable: REQUIRED_TABLES[0] }))
  }).ok, false);
  assert.strictEqual(evaluateOpenApi({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(openApiDocument({ missingRpc: REQUIRED_RPCS[0] }))
  }).ok, false);

  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'supabase-gate-'));
  const evidenceRun = await runChecklist({
    env: {},
    persist: true,
    evidenceDir,
    logger: silentLogger,
    now: new Date('2026-08-17T00:00:00.000Z')
  });
  const evidence = JSON.parse(fs.readFileSync(evidenceRun.evidencePath, 'utf8'));
  assert.strictEqual(evidence.result, RESULT_NOT_EXECUTED);
  assert.strictEqual(evidence.releaseStatus, RELEASE_PENDING);
  assert.strictEqual(evidence.overallPass, false);
  assert(!JSON.stringify(evidence).includes('server-only-test-key'));
  fs.rmSync(evidenceDir, { recursive: true, force: true });

  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'supabase-gate-checklist.js'), 'utf8');
  const guide = fs.readFileSync(path.join(ROOT, 'scripts', 'supabase-gate-guide.md'), 'utf8');
  assert(!/res(?:ponse)?\.status\s*!==\s*404/.test(script), 'non-404 must not count as RPC proof');
  assert(!/invalid_reward_identity[\s\S]{0,400}(?:concurr|idempoten)/i.test(script), 'invalid 400 responses must not prove transaction semantics');
  assert(!/rlsChecked\s*=\s*true/.test(script), 'mere RLS probing must not become PASS');
  assert(/overallPass\s*=\s*false/.test(script), 'OpenAPI preflight must remain unable to open the production Gate');
  assert(/method:\s*'GET'/.test(script) && !/method:\s*'POST'/.test(script), 'preflight must be read-only and never probe RPC writes');
  assert(/supabase\\\.co/.test(script), 'URL validation must stay on Supabase project origins');
  assert(/safeRequestFailureReason/.test(script), 'request failures must be redacted before evidence persistence');
  assert(/NOT_EXECUTED/.test(script) && /RELEASE_EVIDENCE_PENDING/.test(script));
  assert(!/^- \[x\]/m.test(guide), 'unexecuted production steps must not be pre-checked');
  assert(/无效 400/.test(guide) && /不同 Supabase project ref/.test(guide));
  assert(/不阻塞商城继续开发|NON_BLOCKING_FOR_DEVELOPMENT/.test(guide), 'guide must preserve the open development lane');
  assert(/SUPABASE_SERVICE_ROLE_KEY/.test(guide) && /旧 SUPABASE_KEY/.test(guide), 'guide must prefer the server-only key name while documenting compatibility');
  assert(/ENABLE_CLUSTER_COORDINATION='0'/.test(guide) && /不能授权.*改为 `1`/.test(guide), 'guide must keep cluster coordination disabled until real evidence is complete');

  console.log('SUPABASE_GATE_CHECKLIST_CONTRACT_ALL_PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
