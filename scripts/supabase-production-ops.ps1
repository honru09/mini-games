[CmdletBinding()]
param(
  [ValidateSet('plan','backup','migrate','acceptance','rollback','restore-drill')]
  [string]$Action = 'plan',
  [switch]$Execute,
  [string]$BackupDirectory = '',
  [string]$BackupFile = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Schema = Join-Path $Root 'supabase\schema.sql'
$Acceptance = Join-Path $Root 'supabase\production-acceptance.sql'
$Rollback = Join-Path $Root 'supabase\non-destructive-rollback.sql'
if (-not $BackupDirectory) { $BackupDirectory = Join-Path $Root '.ops-backups' }

function Require-Tool([string]$Name) {
  $tool = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $tool) { throw "BLOCKED_EXTERNAL: 缺少 $Name；请安装 PostgreSQL/Supabase CLI 工具后重试。" }
  return $tool.Source
}

function Require-DbUrl([string]$Name = 'SUPABASE_DB_URL') {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) { throw "BLOCKED_EXTERNAL: 未设置 $Name。" }
  if ($value -notmatch '^postgres(?:ql)?://') { throw "$Name 必须是 PostgreSQL 连接串。" }
  return $value
}

function Invoke-WithDatabase([string]$DatabaseUrl, [scriptblock]$Body) {
  $previous = [Environment]::GetEnvironmentVariable('PGDATABASE')
  try {
    [Environment]::SetEnvironmentVariable('PGDATABASE', $DatabaseUrl)
    & $Body
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL 命令失败，退出码 $LASTEXITCODE（连接串和响应正文未输出）。" }
  } finally {
    [Environment]::SetEnvironmentVariable('PGDATABASE', $previous)
  }
}

function New-VerifiedBackup([string]$DatabaseUrl) {
  $pgDump = Require-Tool 'pg_dump'
  $pgRestore = Require-Tool 'pg_restore'
  New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
  $resolvedBackupDirectory = [IO.Path]::GetFullPath($BackupDirectory)
  if ($IsWindows -or $env:OS -eq 'Windows_NT') {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $resolvedBackupDirectory '/inheritance:r' '/grant:r' "${identity}:(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '无法限制备份目录 ACL。' }
    & cipher /E "/S:$resolvedBackupDirectory" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'BLOCKED_EXTERNAL: 备份目录无法启用 Windows EFS，请改用加密卷。' }
  } else {
    if ([Environment]::GetEnvironmentVariable('SUPABASE_BACKUP_ENCRYPTED_VOLUME_CONFIRM') -ne 'YES') {
      throw 'BLOCKED_EXTERNAL: 非 Windows 环境需在加密卷上备份并设置 SUPABASE_BACKUP_ENCRYPTED_VOLUME_CONFIRM=YES。'
    }
    & chmod 700 $resolvedBackupDirectory
    if ($LASTEXITCODE -ne 0) { throw '无法限制备份目录权限。' }
  }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $target = if ($BackupFile) { [IO.Path]::GetFullPath($BackupFile) } else { Join-Path $BackupDirectory "supabase-$stamp.dump" }
  $target = [IO.Path]::GetFullPath($target)
  $backupPrefix = $resolvedBackupDirectory.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $target.StartsWith($backupPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'BackupFile 必须位于受保护的 BackupDirectory 内。' }
  try { Invoke-WithDatabase $DatabaseUrl { & $pgDump --format=custom --no-owner --no-acl --file $target } }
  catch { if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }; throw }
  if (-not (Test-Path -LiteralPath $target) -or (Get-Item -LiteralPath $target).Length -lt 1024) { throw '备份文件不存在或过小。' }
  if (-not ($IsWindows -or $env:OS -eq 'Windows_NT')) { & chmod 600 $target; if ($LASTEXITCODE -ne 0) { throw '无法限制备份文件权限。' } }
  & $pgRestore --list $target | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore 无法读取刚生成的备份。' }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash.ToLowerInvariant()
  Write-Host "BACKUP_VERIFIED: $target"
  Write-Host "BACKUP_SHA256: $hash"
  $retentionRaw = [Environment]::GetEnvironmentVariable('SUPABASE_BACKUP_RETENTION_DAYS')
  if ([string]::IsNullOrWhiteSpace($retentionRaw)) { $retentionRaw = '7' }
  $retention = [Math]::Max(1, [Math]::Min(30, [int]$retentionRaw))
  Get-ChildItem -LiteralPath $resolvedBackupDirectory -File -Filter 'supabase-*.dump' | Where-Object {
    $_.FullName -ne $target -and $_.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-$retention)
  } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
  return $target
}

Write-Host "Supabase Production Ops v1 | action=$Action | execute=$($Execute.IsPresent)"
if (-not $Execute) {
  Write-Host 'DRY_RUN: 未连接数据库、未写入、未备份。使用 -Execute 才会执行。'
  Write-Host '顺序：backup -> migrate(transaction) -> acceptance；rollback 只撤销本轮 RPC 权限且不删除数据。'
  if ($Action -eq 'restore-drill') { Write-Host '恢复演练还要求 SUPABASE_RESTORE_DB_URL 与 RESTORE_DRILL_CONFIRM。' }
  exit 0
}

$psql = Require-Tool 'psql'
switch ($Action) {
  'plan' {
    Require-DbUrl | Out-Null
    Write-Host 'PREFLIGHT_PASS: 工具和 SUPABASE_DB_URL 已就绪；未写数据库。'
  }
  'backup' {
    $url = Require-DbUrl
    New-VerifiedBackup $url | Out-Null
  }
  'migrate' {
    $url = Require-DbUrl
    $backup = New-VerifiedBackup $url
    Invoke-WithDatabase $url { & $psql -X --set ON_ERROR_STOP=1 --single-transaction --file $Schema }
    Invoke-WithDatabase $url { & $psql -X --set ON_ERROR_STOP=1 --file $Acceptance }
    Write-Host "MIGRATION_ACCEPTED: backup=$backup"
  }
  'acceptance' {
    $url = Require-DbUrl
    Invoke-WithDatabase $url { & $psql -X --set ON_ERROR_STOP=1 --file $Acceptance }
  }
  'rollback' {
    $url = Require-DbUrl
    $confirmation = [Environment]::GetEnvironmentVariable('NON_DESTRUCTIVE_ROLLBACK_CONFIRM')
    if ($confirmation -ne 'REVOKE_CLUSTER_RPC_ONLY') { throw '需设置 NON_DESTRUCTIVE_ROLLBACK_CONFIRM=REVOKE_CLUSTER_RPC_ONLY；此操作不会删除数据。' }
    New-VerifiedBackup $url | Out-Null
    Invoke-WithDatabase $url { & $psql -X --set ON_ERROR_STOP=1 --file $Rollback }
  }
  'restore-drill' {
    $source = Require-DbUrl
    $target = Require-DbUrl 'SUPABASE_RESTORE_DB_URL'
    if ($source -eq $target) { throw '恢复演练目标不能与生产 SUPABASE_DB_URL 相同。' }
    if ([Environment]::GetEnvironmentVariable('RESTORE_DRILL_CONFIRM') -ne 'I_UNDERSTAND_EPHEMERAL_TARGET_WILL_BE_REPLACED') {
      throw '需设置 RESTORE_DRILL_CONFIRM=I_UNDERSTAND_EPHEMERAL_TARGET_WILL_BE_REPLACED。'
    }
    $pgRestore = Require-Tool 'pg_restore'
    $dump = New-VerifiedBackup $source
    Invoke-WithDatabase $target { & $pgRestore --clean --if-exists --no-owner --no-acl --exit-on-error $dump }
    Invoke-WithDatabase $target { & $psql -X --set ON_ERROR_STOP=1 --file $Acceptance }
    Write-Host 'RESTORE_DRILL_PASS: 仅临时目标已恢复并通过验收。'
  }
}
