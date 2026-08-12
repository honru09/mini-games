param(
  [switch]$Check
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root 'public/vendor/gsap/3.15.0/esm'
$files = [ordered]@{
  'index.js' = 'https://raw.githubusercontent.com/greensock/GSAP/3.15.0/esm/index.js'
  'CSSPlugin.js' = 'https://raw.githubusercontent.com/greensock/GSAP/3.15.0/esm/CSSPlugin.js'
}

foreach ($entry in $files.GetEnumerator()) {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $entry.Value
  if ($response.StatusCode -ne 200) { throw "GSAP vendor fetch failed: $($entry.Key)" }
  $path = Join-Path $target $entry.Key
  if ($Check) {
    if (-not (Test-Path -LiteralPath $path)) { throw "GSAP vendor missing: $($entry.Key)" }
    $actual = [IO.File]::ReadAllText($path)
    if ($actual -ne $response.Content) { throw "GSAP vendor drift: $($entry.Key)" }
  } else {
    [IO.Directory]::CreateDirectory($target) | Out-Null
    [IO.File]::WriteAllText($path, $response.Content, [Text.UTF8Encoding]::new($false))
  }
}

$action = if ($Check) { 'verified' } else { 'fetched' }
Write-Host "GSAP DOM vendor $action from official 3.15.0 tag."
