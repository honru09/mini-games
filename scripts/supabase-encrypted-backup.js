'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { pipeline } = require('stream/promises');

const FORMAT = 'ghost-game-supabase-backup-v1';
const CIPHER = 'aes-256-gcm';
const META_SUFFIX = '.meta.json';

function fail(message) {
  const error = new Error(message);
  error.safe = true;
  throw error;
}

function requireWindows() {
  if (process.platform !== 'win32') fail('dpapi_backup_requires_windows');
}

function runDpapi(script, input) {
  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  if (result.status !== 0) fail('windows_dpapi_failed');
  const output = String(result.stdout || '').trim();
  if (!output) fail('windows_dpapi_empty_output');
  return output;
}

function protectKey(key) {
  requireWindows();
  return runDpapi(
    "Add-Type -AssemblyName System.Security;$plain=[Console]::In.ReadToEnd().Trim();$bytes=[Convert]::FromBase64String($plain);try{$protected=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($protected))}finally{[Array]::Clear($bytes,0,$bytes.Length)}",
    key.toString('base64')
  );
}

function unprotectKey(protectedKey) {
  requireWindows();
  const plain = runDpapi(
    "Add-Type -AssemblyName System.Security;$protected=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim());try{$bytes=[Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);try{[Console]::Out.Write([Convert]::ToBase64String($bytes))}finally{[Array]::Clear($bytes,0,$bytes.Length)}}finally{[Array]::Clear($protected,0,$protected.Length)}",
    protectedKey
  );
  const key = Buffer.from(plain, 'base64');
  if (key.length !== 32) fail('windows_dpapi_key_invalid');
  return key;
}

function connectionEnv(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('database_url_invalid');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    fail('database_url_invalid');
  }
  return {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'postgres'),
    PGSSLMODE: process.env.PGSSLMODE || 'require',
    PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || '15'
  };
}

function waitForChild(child, label) {
  let stderrBytes = 0;
  let stderrSample = '';
  child.stderr.on('data', chunk => {
    stderrBytes += chunk.length;
    if (stderrSample.length < 4096) stderrSample += String(chunk);
  });
  child.stdout?.on('error', () => {});
  child.stdin?.on('error', () => {});
  return new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error(`${label}_start_failed`)));
    child.once('close', code => {
      if (code === 0) resolve();
      else {
        const lower = stderrSample.toLowerCase();
        let reason = 'unknown';
        if (lower.includes('permission denied') || lower.includes('must be owner') || lower.includes('not owner')) reason = 'permission';
        else if (lower.includes('already exists') || lower.includes('duplicate')) reason = 'object_conflict';
        else if (lower.includes('does not exist') || lower.includes('not found')) reason = 'missing_object';
        else if (lower.includes('extension')) reason = 'extension';
        else if (lower.includes('cannot drop') || lower.includes('depends on') || lower.includes('required')) reason = 'dependency';
        else if (lower.includes('unrecognized option')) reason = 'option';
        else if (lower.includes('too many command-line')) reason = 'arguments';
        else if (lower.includes('could not open') || lower.includes('cannot open')) reason = 'input';
        else if (lower.includes('could not execute query')) reason = 'query_error';
        else if (lower.includes('connection')) reason = 'connection';
        else if (lower.includes('timeout') || lower.includes('timed out')) reason = 'timeout';
        const error = new Error(`${label}_failed_${code}_${reason}_${stderrBytes}`);
        error.safe = true;
        reject(error);
      }
    });
  });
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
}

function readMetadata(backupPath) {
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(backupPath + META_SUFFIX, 'utf8'));
  } catch {
    fail('encrypted_backup_metadata_invalid');
  }
  if (
    !meta || meta.format !== FORMAT || meta.cipher !== CIPHER ||
    typeof meta.iv !== 'string' || typeof meta.authTag !== 'string' ||
    typeof meta.protectedKey !== 'string' || typeof meta.ciphertextSha256 !== 'string'
  ) {
    fail('encrypted_backup_metadata_invalid');
  }
  return meta;
}

async function decryptInto(backupPath, child) {
  const meta = readMetadata(backupPath);
  const actualHash = await sha256File(backupPath);
  if (!crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(meta.ciphertextSha256))) {
    fail('encrypted_backup_hash_mismatch');
  }
  const key = unprotectKey(meta.protectedKey);
  try {
    const iv = Buffer.from(meta.iv, 'base64');
    const authTag = Buffer.from(meta.authTag, 'base64');
    if (iv.length !== 12 || authTag.length !== 16) fail('encrypted_backup_metadata_invalid');
    const decipher = crypto.createDecipheriv(CIPHER, key, iv);
    decipher.setAuthTag(authTag);
    const streamResult = pipeline(fs.createReadStream(backupPath), decipher, child.stdin);
    const childResult = waitForChild(child, 'pg_restore');
    const settled = await Promise.allSettled([streamResult, childResult]);
    const childFailure = settled.find(result => result.status === 'rejected' && String(result.reason?.message || '').startsWith('pg_restore_failed_'));
    if (childFailure) throw childFailure.reason;
    if (settled.some(result => result.status === 'rejected')) fail('encrypted_backup_restore_stream_failed');
  } finally {
    key.fill(0);
  }
}

async function verifyBackup(backupPath) {
  const pgRestore = process.env.PG_RESTORE_PATH || 'pg_restore';
  const child = spawn(pgRestore, ['--list'], {
    stdio: ['pipe', 'ignore', 'pipe'],
    windowsHide: true
  });
  await decryptInto(backupPath, child);
}

async function restoreViaSql(backupPath, databaseUrl) {
  const meta = readMetadata(backupPath);
  const actualHash = await sha256File(backupPath);
  if (!crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(meta.ciphertextSha256))) {
    fail('encrypted_backup_hash_mismatch');
  }
  const key = unprotectKey(meta.protectedKey);
  const pgRestore = process.env.PG_RESTORE_PATH || 'pg_restore';
  const psql = process.env.PG_PSQL_PATH || 'psql';
  const restoreChild = spawn(pgRestore, ['--no-owner', '--no-acl', '--schema=public', '--file=-'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });
  const sqlChild = spawn(psql, ['-X'], {
    env: connectionEnv(databaseUrl),
    stdio: ['pipe', 'ignore', 'pipe'],
    windowsHide: true
  });
  restoreChild.stdout.pipe(sqlChild.stdin);
  try {
    const iv = Buffer.from(meta.iv, 'base64');
    const authTag = Buffer.from(meta.authTag, 'base64');
    if (iv.length !== 12 || authTag.length !== 16) fail('encrypted_backup_metadata_invalid');
    const decipher = crypto.createDecipheriv(CIPHER, key, iv);
    decipher.setAuthTag(authTag);
    const streamResult = pipeline(fs.createReadStream(backupPath), decipher, restoreChild.stdin);
    const restoreResult = waitForChild(restoreChild, 'pg_restore');
    const sqlResult = waitForChild(sqlChild, 'psql_restore');
    const settled = await Promise.allSettled([streamResult, restoreResult, sqlResult]);
    const failure = settled.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  } finally {
    key.fill(0);
  }
}

async function cleanupTargetAppObjects(databaseUrl) {
  const psql = process.env.PG_PSQL_PATH || 'psql';
  const child = spawn(psql, ['-X', '--set', 'ON_ERROR_STOP=1'], {
    env: connectionEnv(databaseUrl),
    stdio: ['pipe', 'ignore', 'pipe'],
    windowsHide: true
  });
  const sql = `
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    where p.pronamespace='public'::regnamespace
      and p.proname = any(array[
        'apply_reward_v1','apply_purchase_v1','apply_ai_learning_v1',
        'send_direct_message_v1','apply_direct_message_read_v1',
        'list_direct_messages_v1','list_direct_message_reads_v1',
        'create_playline_post_v1','list_playline_posts_v1','delete_playline_post_v1',
        'resolve_playline_report_target_v1','purge_playline_posts_v1',
        'claim_cluster_lease_v1','renew_cluster_lease_v1','append_platform_event_v1',
        'list_platform_events_v1','commit_cluster_cursor_v1','append_metrics_snapshot_v1',
        'get_direct_message_by_id_v1','cleanup_cluster_data_v1'
      ])
  loop
    execute 'drop function if exists ' || r.signature;
  end loop;
  for r in
    select table_name
    from information_schema.tables
    where table_schema='public'
      and table_name = any(array[
        'profiles','history','reward_history','economy_ledger','analytics_events',
        'friend_requests','friendships','blocks','reports','playline_posts',
        'playline_rate_events','direct_messages','direct_message_reads',
        'ai_learning_models','ai_learning_experiences','cluster_instances',
        'cluster_leases','platform_events','cluster_event_cursors','metrics_snapshots'
      ])
  loop
    execute format('drop table if exists public.%I cascade', r.table_name);
  end loop;
end $$;
`;
  child.stdin.end(sql);
  await waitForChild(child, 'psql_target_cleanup');
}

async function createBackup(backupPath) {
  requireWindows();
  const databaseUrl = String(process.env.SUPABASE_DB_URL || '');
  if (!databaseUrl) fail('missing_supabase_db_url');
  if (!backupPath.endsWith('.dump.aes')) fail('encrypted_backup_extension_invalid');
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  const tempBackup = `${backupPath}.${process.pid}.tmp`;
  const tempMeta = `${backupPath}${META_SUFFIX}.${process.pid}.tmp`;
  const pgDump = process.env.PG_DUMP_PATH || 'pg_dump';
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  try {
    const cipher = crypto.createCipheriv(CIPHER, key, iv);
    const output = fs.createWriteStream(tempBackup, { flags: 'wx', mode: 0o600 });
    const child = spawn(pgDump, ['--format=custom', '--no-owner', '--no-acl'], {
      env: connectionEnv(databaseUrl),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    const streamResult = pipeline(child.stdout, cipher, output);
    const childResult = waitForChild(child, 'pg_dump');
    const settled = await Promise.allSettled([streamResult, childResult]);
    if (settled.some(result => result.status === 'rejected')) fail('encrypted_backup_dump_failed');
    const stat = fs.statSync(tempBackup);
    if (stat.size < 64) fail('encrypted_backup_too_small');
    const metadata = {
      format: FORMAT,
      cipher: CIPHER,
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      protectedKey: protectKey(key),
      ciphertextSha256: await sha256File(tempBackup),
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(tempMeta, JSON.stringify(metadata), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.renameSync(tempBackup, backupPath);
    fs.renameSync(tempMeta, backupPath + META_SUFFIX);
    await verifyBackup(backupPath);
  } catch (error) {
    for (const candidate of [tempBackup, tempMeta, backupPath, backupPath + META_SUFFIX]) {
      try { fs.rmSync(candidate, { force: true }); } catch {}
    }
    throw error;
  } finally {
    key.fill(0);
  }
}

async function restoreBackup(backupPath) {
  const databaseUrl = String(process.env.SUPABASE_TARGET_DB_URL || '');
  if (!databaseUrl) fail('missing_supabase_target_db_url');
  await cleanupTargetAppObjects(databaseUrl);
  await restoreViaSql(backupPath, databaseUrl);
}

function selfTest() {
  requireWindows();
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const plaintext = crypto.randomBytes(256 * 1024);
  try {
    const protectedKey = protectKey(key);
    const recoveredKey = unprotectKey(protectedKey);
    const cipher = crypto.createCipheriv(CIPHER, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const decipher = crypto.createDecipheriv(CIPHER, recoveredKey, iv);
    decipher.setAuthTag(cipher.getAuthTag());
    const recovered = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    recoveredKey.fill(0);
    if (!crypto.timingSafeEqual(plaintext, recovered)) fail('encrypted_backup_self_test_failed');
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}

async function main() {
  const mode = process.argv[2];
  const backupPath = process.argv[3] ? path.resolve(process.argv[3]) : '';
  if (mode === 'self-test') {
    selfTest();
    console.log('DPAPI_AES_GCM_SELF_TEST_PASS');
    return;
  }
  if (!backupPath) fail('encrypted_backup_path_required');
  if (mode === 'backup') {
    await createBackup(backupPath);
    console.log('ENCRYPTED_BACKUP_VERIFIED');
    return;
  }
  if (mode === 'verify') {
    await verifyBackup(backupPath);
    console.log('ENCRYPTED_BACKUP_VERIFIED');
    return;
  }
  if (mode === 'restore') {
    await restoreBackup(backupPath);
    console.log('ENCRYPTED_BACKUP_RESTORE_PASS');
    return;
  }
  fail('encrypted_backup_mode_invalid');
}

main().catch(error => {
  console.error(`ENCRYPTED_BACKUP_FAILED: ${error && error.safe ? error.message : 'operation_failed'}`);
  process.exitCode = 1;
});
