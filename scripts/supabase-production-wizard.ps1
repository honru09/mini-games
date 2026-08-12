[CmdletBinding()]
param(
  [string]$EnvFile = '',
  [switch]$Probe
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($EnvFile)) { $EnvFile = Join-Path $Root '.env.supabase.local' }
$Ops = Join-Path $PSScriptRoot 'supabase-production-ops.ps1'

function Show-Stage([int]$Index, [string]$Title) {
  Clear-Host
  Write-Host ''
  Write-Host "  Ghost Game · Supabase 生产配置（$Index/5）" -ForegroundColor Cyan
  Write-Host "  $Title" -ForegroundColor Cyan
  Write-Host ''
}

function Open-Page([string]$Url) {
  Start-Process $Url
}

function Get-Existing([string]$Key) {
  if (-not (Test-Path -LiteralPath $EnvFile)) { return '' }
  $line = Get-Content -LiteralPath $EnvFile | Where-Object { $_ -like "$Key=*" } | Select-Object -Last 1
  if (-not $line) { return '' }
  return $line.Substring($Key.Length + 1)
}

function Read-Visible([string]$Key, [string]$Prompt, [string]$Default = '') {
  $existing = Get-Existing $Key
  $fallback = if ($existing) { $existing } else { $Default }
  $hint = if ($fallback) { "（直接 Enter 使用：$fallback）" } else { '' }
  $value = Read-Host "$Prompt$hint"
  if ([string]::IsNullOrWhiteSpace($value)) { return $fallback }
  return $value.Trim()
}

function Convert-SecureToPlain([Security.SecureString]$Value) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Read-Secret([string]$Key, [string]$Prompt) {
  $existing = Get-Existing $Key
  $hint = if ($existing) { '（直接 Enter 保留本地已存值）' } else { '' }
  $secure = Read-Host "$Prompt$hint" -AsSecureString
  if ($secure.Length -eq 0) {
    if ($existing) { return $existing }
    throw "$Key 不能为空。"
  }
  return Convert-SecureToPlain $secure
}

function Confirm([string]$Question) {
  return (Read-Host "$Question [y/N]") -match '^[Yy]$'
}

function Write-EnvValue([string]$Key, [string]$Value) {
  $directory = Split-Path -Parent $EnvFile
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $lines = if (Test-Path -LiteralPath $EnvFile) {
    @(Get-Content -LiteralPath $EnvFile | Where-Object { $_ -notlike "$Key=*" })
  } else { @() }
  $temporary = "$EnvFile.$PID.tmp"
  try {
    [IO.File]::WriteAllLines($temporary, @($lines + "$Key=$Value"), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporary -Destination $EnvFile -Force
  } finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
  }
}

function Protect-EnvFile {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $acl = Get-Acl -LiteralPath $EnvFile
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($rule in @($acl.Access)) { $acl.RemoveAccessRuleSpecific($rule) }
  $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')))
  Set-Acl -LiteralPath $EnvFile -AclObject $acl
  $verify = Get-Acl -LiteralPath $EnvFile
  $other = @($verify.Access | Where-Object { $_.IdentityReference.Value -ne $identity })
  if (-not $verify.AreAccessRulesProtected -or $other.Count -ne 0) { throw '无法确认 .env.supabase.local 的当前用户 ACL。' }
}

function Get-ProjectRef([string]$ProjectUrl) {
  if ($ProjectUrl -notmatch '^https://([a-z0-9]+)\.supabase\.co/?$') { throw 'Project URL 格式应为 https://<project-ref>.supabase.co。' }
  return $Matches[1].ToLowerInvariant()
}

function Get-DatabaseInfo([string]$ConnectionString, [string]$Name) {
  try { $uri = [Uri]$ConnectionString } catch { throw "$Name 不是有效 PostgreSQL URI。" }
  if ($uri.Scheme -notin @('postgres', 'postgresql')) { throw "$Name 必须以 postgres:// 或 postgresql:// 开头。" }
  if ($uri.Port -eq 6543) { throw "$Name 不能使用 Transaction pooler 端口 6543；请选择 Session pooler（5432）或 Direct connection。" }
  $projectRef = ''
  if ($uri.DnsSafeHost -match '^db\.([a-z0-9]+)\.supabase\.co$') {
    $projectRef = $Matches[1]
  } else {
    $user = [Uri]::UnescapeDataString(($uri.UserInfo -split ':', 2)[0])
    if ($user -match '^postgres\.([a-z0-9]+)$') { $projectRef = $Matches[1] }
  }
  if (-not $projectRef) { throw "$Name 无法识别 Supabase project ref；请从 Dashboard → Connect 复制 Direct 或 Session pooler URI。" }
  return [pscustomobject]@{ ProjectRef = $projectRef.ToLowerInvariant(); Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 } }
}

if ($Probe) {
  $probeRef = Get-ProjectRef 'https://abcdefghijklmnopqrst.supabase.co'
  $probeDb = Get-DatabaseInfo 'postgresql://postgres.abcdefghijklmnopqrst:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres' 'probe'
  if ($probeRef -ne $probeDb.ProjectRef -or $probeDb.Port -ne 5432) { throw 'PowerShell wizard probe failed.' }
  Write-Output 'POWERSHELL_WIZARD_READY'
  exit 0
}

Show-Stage 1 '选择正式项目'
Open-Page 'https://supabase.com/dashboard/projects'
Write-Host '浏览器已打开 Supabase Projects。正式项目就是你已有的 honru09 Project；只需确认状态为 Healthy。'
Write-Host '这里不需要点击或按 Enter，向导马上进入下一步，让你粘贴 Project URL。'

Show-Stage 2 '填写 Project URL'
Open-Page 'https://supabase.com/dashboard/projects'
do {
  $SupabaseUrl = Read-Visible 'SUPABASE_URL' '粘贴正式项目 Project URL'
  try { $ProjectRef = Get-ProjectRef $SupabaseUrl; $valid = $true } catch { Write-Host $_.Exception.Message -ForegroundColor Yellow; $valid = $false }
} while (-not $valid)
Write-EnvValue 'SUPABASE_URL' $SupabaseUrl

Show-Stage 3 '填写后端 Secret key'
Open-Page 'https://supabase.com/dashboard/projects'
Write-Host '进入正式项目 → Settings → API Keys，只复制 Secret keys 下的 sb_secret_...，不要复制 Publishable key。'
do {
  $SecretKey = Read-Secret 'SUPABASE_SERVICE_ROLE_KEY' '粘贴 Secret key（输入不可见）'
  if ($SecretKey -like 'sb_secret_*') { $valid = $true } else { Write-Host '必须是 sb_secret_...，请重新复制 Secret keys 的值。' -ForegroundColor Yellow; $valid = $false }
} while (-not $valid)
Write-EnvValue 'SUPABASE_SERVICE_ROLE_KEY' $SecretKey
Protect-EnvFile

Show-Stage 4 '填写正式库、恢复库和备份目录'
Open-Page 'https://supabase.com/dashboard/projects'
Write-Host '正式项目：Connect → Session pooler → 复制 URI。恢复项目必须是另一个空白项目，也复制它的 Session pooler URI。'
do {
  $ProductionDbUrl = Read-Secret 'SUPABASE_DB_URL' '粘贴正式项目 PostgreSQL URI（输入不可见）'
  try {
    $productionInfo = Get-DatabaseInfo $ProductionDbUrl 'SUPABASE_DB_URL'
    if ($productionInfo.ProjectRef -ne $ProjectRef) { throw '正式 PostgreSQL URI 与 Project URL 不属于同一项目。' }
    $valid = $true
  } catch { Write-Host $_.Exception.Message -ForegroundColor Yellow; $valid = $false }
} while (-not $valid)
do {
  $RestoreDbUrl = Read-Secret 'SUPABASE_RESTORE_DB_URL' '粘贴恢复项目 PostgreSQL URI（输入不可见）'
  try {
    $restoreInfo = Get-DatabaseInfo $RestoreDbUrl 'SUPABASE_RESTORE_DB_URL'
    if ($restoreInfo.ProjectRef -eq $ProjectRef) { throw '恢复项目不能与正式项目相同。' }
    $valid = $true
  } catch { Write-Host $_.Exception.Message -ForegroundColor Yellow; $valid = $false }
} while (-not $valid)
$BackupDirectory = Read-Visible 'SUPABASE_BACKUP_DIRECTORY' '填写已加密备份目录' 'D:\mini-games\.ops-backups'
Write-EnvValue 'SUPABASE_DB_URL' $ProductionDbUrl
Write-EnvValue 'SUPABASE_RESTORE_DB_URL' $RestoreDbUrl
Write-EnvValue 'SUPABASE_BACKUP_DIRECTORY' $BackupDirectory
Protect-EnvFile

Show-Stage 5 '本地检查与生产迁移确认'
$env:SUPABASE_URL = $SupabaseUrl
$env:SUPABASE_SERVICE_ROLE_KEY = $SecretKey
$env:SUPABASE_DB_URL = $ProductionDbUrl
$env:SUPABASE_RESTORE_DB_URL = $RestoreDbUrl
node (Join-Path $Root 'qa\supabase-schema.js')
if ($LASTEXITCODE -ne 0) { throw 'Supabase Schema 合同失败。' }
node (Join-Path $Root 'qa\production-readiness-contract.js')
if ($LASTEXITCODE -ne 0) { throw 'Production Readiness 合同失败。' }
node --experimental-websocket (Join-Path $Root 'qa\supabase-adapter.js')
if ($LASTEXITCODE -ne 0) { throw 'Supabase Adapter 回归失败。' }
& powershell -NoProfile -ExecutionPolicy Bypass -File $Ops -Action plan -Execute -BackupDirectory $BackupDirectory
if ($LASTEXITCODE -ne 0) { throw '生产预检未通过；没有连接或修改生产数据库。' }

if (-not (Confirm '现在执行生产备份、事务迁移和真实 RLS 验收？')) {
  Write-Host '已安全停在预检。没有修改生产数据库。' -ForegroundColor Yellow
  exit 0
}
& powershell -NoProfile -ExecutionPolicy Bypass -File $Ops -Action migrate -Execute -BackupDirectory $BackupDirectory
if ($LASTEXITCODE -ne 0) { throw '生产迁移失败，请查看上方错误。' }
node (Join-Path $Root 'scripts\supabase-status.js')
if ($LASTEXITCODE -ne 0) { throw '迁移后 Supabase 状态检查失败。' }

if (Confirm '恢复项目确认是空白隔离项目，可以执行覆盖式恢复演练？') {
  $env:RESTORE_DRILL_CONFIRM = 'I_UNDERSTAND_EPHEMERAL_TARGET_WILL_BE_REPLACED'
  & powershell -NoProfile -ExecutionPolicy Bypass -File $Ops -Action restore-drill -Execute -BackupDirectory $BackupDirectory
  if ($LASTEXITCODE -ne 0) { throw '隔离恢复演练失败。' }
}

Write-Host ''
Write-Host 'Supabase 向导完成。未写 Render、未部署、未开启集群协调。' -ForegroundColor Green
