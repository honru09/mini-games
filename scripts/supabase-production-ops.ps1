[CmdletBinding()]
param(
  [ValidateSet('plan','storage-preflight','backup','migrate','acceptance','rollback','restore-drill')]
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

function Get-SupabaseDatabaseIdentity([string]$DatabaseUrl, [string]$Name) {
  try { $uri = [Uri]$DatabaseUrl } catch { throw "$Name 不是有效 PostgreSQL URI。" }
  if ($uri.Scheme -notin @('postgres','postgresql')) { throw "$Name 必须是 PostgreSQL URI。" }
  if ($uri.Port -eq 6543) { throw "$Name 不能使用 Transaction pooler 端口 6543；备份和迁移需 Direct/Session 连接。" }
  $projectRef = ''
  if ($uri.DnsSafeHost -match '^db\.([a-z0-9]+)\.supabase\.co$') {
    $projectRef = $Matches[1]
  } else {
    $rawUser = ($uri.UserInfo -split ':', 2)[0]
    $username = [Uri]::UnescapeDataString($rawUser)
    if ($username -match '^postgres\.([a-z0-9]+)$') { $projectRef = $Matches[1] }
  }
  if ([string]::IsNullOrWhiteSpace($projectRef)) {
    throw "$Name 无法识别 Supabase project ref；请直接复制 Dashboard Connect 的 Direct 或 Session pooler URI。"
  }
  $database = $uri.AbsolutePath.Trim('/')
  if ([string]::IsNullOrWhiteSpace($database)) { throw "$Name 缺少数据库名。" }
  return [pscustomobject]@{ ProjectRef = $projectRef.ToLowerInvariant(); Database = $database.ToLowerInvariant() }
}

function Assert-ApiProjectMatchesDatabase([pscustomobject]$Identity) {
  $apiUrl = [Environment]::GetEnvironmentVariable('SUPABASE_URL')
  if ([string]::IsNullOrWhiteSpace($apiUrl)) { return }
  if ($apiUrl -notmatch '^https://([a-z0-9]+)\.supabase\.co/?$') { throw 'SUPABASE_URL 格式异常。' }
  if ($Matches[1].ToLowerInvariant() -ne $Identity.ProjectRef) {
    throw 'SUPABASE_URL 与 SUPABASE_DB_URL 不属于同一 Supabase 项目。'
  }
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

function Test-BitLockerProtectedVolume([string]$Path) {
  $command = Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue
  if (-not $command) { return $false }
  try {
    $root = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($Path)).TrimEnd('\')
    $volume = Get-BitLockerVolume -MountPoint $root -ErrorAction Stop
    return $volume.VolumeStatus.ToString() -eq 'FullyEncrypted' -and $volume.ProtectionStatus.ToString() -eq 'On'
  } catch { return $false }
}

function Ensure-BackupStorage {
  New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
  $resolvedBackupDirectory = [IO.Path]::GetFullPath($BackupDirectory)
  $mode = 'encrypted-volume-confirmed'
  if ($IsWindows -or $env:OS -eq 'Windows_NT') {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $resolvedBackupDirectory '/inheritance:r' '/grant:r' "${identity}:(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '无法限制备份目录 ACL。' }
    try { $null = (& cipher /E "/S:$resolvedBackupDirectory" 2>&1 | Out-String) } catch {}
    $directoryAttributes = (Get-Item -LiteralPath $resolvedBackupDirectory).Attributes
    if (($directoryAttributes -band [IO.FileAttributes]::Encrypted) -ne 0) {
      $mode = 'efs'
    } elseif (Test-BitLockerProtectedVolume $resolvedBackupDirectory) {
      $mode = 'bitlocker'
    } else {
      throw 'BLOCKED_EXTERNAL: 备份目录既无真实 EFS 属性，也不在已启用保护的 BitLocker 卷；cipher 退出码不能证明加密。'
    }
  } else {
    if ([Environment]::GetEnvironmentVariable('SUPABASE_BACKUP_ENCRYPTED_VOLUME_CONFIRM') -ne 'YES') {
      throw 'BLOCKED_EXTERNAL: 非 Windows 环境需在加密卷上备份并设置 SUPABASE_BACKUP_ENCRYPTED_VOLUME_CONFIRM=YES。'
    }
    & chmod 700 $resolvedBackupDirectory
    if ($LASTEXITCODE -ne 0) { throw '无法限制备份目录权限。' }
  }
  return [pscustomobject]@{ Directory = $resolvedBackupDirectory; Mode = $mode }
}

function New-VerifiedBackup([string]$DatabaseUrl) {
  $identity = Get-SupabaseDatabaseIdentity $DatabaseUrl 'SUPABASE_DB_URL'
  Assert-ApiProjectMatchesDatabase $identity
  $pgDump = Require-Tool 'pg_dump'
  $pgRestore = Require-Tool 'pg_restore'
  $storage = Ensure-BackupStorage
  $resolvedBackupDirectory = $storage.Directory
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $target = if ($BackupFile) { [IO.Path]::GetFullPath($BackupFile) } else { Join-Path $BackupDirectory "supabase-$stamp.dump" }
  $target = [IO.Path]::GetFullPath($target)
  $backupPrefix = $resolvedBackupDirectory.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $target.StartsWith($backupPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'BackupFile 必须位于受保护的 BackupDirectory 内。' }
  if ([IO.Path]::GetExtension($target) -ne '.dump') { throw 'BackupFile 必须使用 .dump 扩展名。' }
  try { Invoke-WithDatabase $DatabaseUrl { & $pgDump --dbname $DatabaseUrl --format=custom --no-owner --no-acl --file $target } }
  catch { if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }; throw }
  if (-not (Test-Path -LiteralPath $target) -or (Get-Item -LiteralPath $target).Length -lt 1024) {
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
    throw '备份文件不存在或过小；残片已删除。'
  }
  if ($storage.Mode -eq 'efs' -and ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::Encrypted) -eq 0) {
    Remove-Item -LiteralPath $target -Force
    throw 'BLOCKED_EXTERNAL: 备份文件未继承 EFS 加密属性，已删除未加密残片。'
  }
  if (-not ($IsWindows -or $env:OS -eq 'Windows_NT')) { & chmod 600 $target; if ($LASTEXITCODE -ne 0) { throw '无法限制备份文件权限。' } }
  & $pgRestore --list $target | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $target -Force
    throw 'pg_restore 无法读取刚生成的备份；无效文件已删除。'
  }
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
    $url = Require-DbUrl
    $identity = Get-SupabaseDatabaseIdentity $url 'SUPABASE_DB_URL'
    Assert-ApiProjectMatchesDatabase $identity
    Require-Tool 'pg_dump' | Out-Null
    Require-Tool 'pg_restore' | Out-Null
    $storage = Ensure-BackupStorage
    Write-Host "PREFLIGHT_PASS: PostgreSQL 工具、项目身份和加密备份目录已就绪；storage=$($storage.Mode)；未连接数据库。"
  }
  'storage-preflight' {
    $storage = Ensure-BackupStorage
    Write-Host "BACKUP_STORAGE_READY: mode=$($storage.Mode) path=$($storage.Directory)"
  }
  'backup' {
    $url = Require-DbUrl
    New-VerifiedBackup $url | Out-Null
  }
  'migrate' {
    $url = Require-DbUrl
    $backup = New-VerifiedBackup $url
    Invoke-WithDatabase $url { & $psql --dbname $url -X --set ON_ERROR_STOP=1 --single-transaction --file $Schema }
    Invoke-WithDatabase $url { & $psql --dbname $url -X --set ON_ERROR_STOP=1 --file $Acceptance }
    Write-Host "MIGRATION_ACCEPTED: backup=$backup"
  }
  'acceptance' {
    $url = Require-DbUrl
    $identity = Get-SupabaseDatabaseIdentity $url 'SUPABASE_DB_URL'
    Assert-ApiProjectMatchesDatabase $identity
    Invoke-WithDatabase $url { & $psql --dbname $url -X --set ON_ERROR_STOP=1 --file $Acceptance }
  }
  'rollback' {
    $url = Require-DbUrl
    $confirmation = [Environment]::GetEnvironmentVariable('NON_DESTRUCTIVE_ROLLBACK_CONFIRM')
    if ($confirmation -ne 'REVOKE_CLUSTER_RPC_ONLY') { throw '需设置 NON_DESTRUCTIVE_ROLLBACK_CONFIRM=REVOKE_CLUSTER_RPC_ONLY；此操作不会删除数据。' }
    New-VerifiedBackup $url | Out-Null
    Invoke-WithDatabase $url { & $psql --dbname $url -X --set ON_ERROR_STOP=1 --file $Rollback }
  }
  'restore-drill' {
    $source = Require-DbUrl
    $target = Require-DbUrl 'SUPABASE_RESTORE_DB_URL'
    $sourceIdentity = Get-SupabaseDatabaseIdentity $source 'SUPABASE_DB_URL'
    $targetIdentity = Get-SupabaseDatabaseIdentity $target 'SUPABASE_RESTORE_DB_URL'
    Assert-ApiProjectMatchesDatabase $sourceIdentity
    if ($sourceIdentity.ProjectRef -eq $targetIdentity.ProjectRef) {
      throw '恢复演练目标与生产数据库属于同一 Supabase 项目；同一项目不得作为恢复演练目标。'
    }
    if ([Environment]::GetEnvironmentVariable('RESTORE_DRILL_CONFIRM') -ne 'I_UNDERSTAND_EPHEMERAL_TARGET_WILL_BE_REPLACED') {
      throw '需设置 RESTORE_DRILL_CONFIRM=I_UNDERSTAND_EPHEMERAL_TARGET_WILL_BE_REPLACED。'
    }
    $pgRestore = Require-Tool 'pg_restore'
    $dump = New-VerifiedBackup $source
    Invoke-WithDatabase $target { & $pgRestore --dbname $target --clean --if-exists --no-owner --no-acl --exit-on-error $dump }
    Invoke-WithDatabase $target { & $psql --dbname $target -X --set ON_ERROR_STOP=1 --file $Acceptance }
    Write-Host 'RESTORE_DRILL_PASS: 仅临时目标已恢复并通过验收。'
  }
}
