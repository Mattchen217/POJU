# Apply Legal EN v1.0 bodies + modal (local only; no git)
$ErrorActionPreference = 'Stop'
$repo = 'D:\POJU\pojulife'
$src = 'C:\Users\13306\AppData\Local\Temp\legal-out'
Set-Location $repo

# Backup existing pages once
$bak = Join-Path $repo 'temp\legal-backup-before-v1'
New-Item -ItemType Directory -Force -Path $bak | Out-Null
$map = @{
  'disclaimer-page.tsx' = 'app\[locale]\disclaimer\page.tsx'
  'privacy-page.tsx'    = 'app\[locale]\privacy\page.tsx'
  'terms-page.tsx'      = 'app\[locale]\terms\page.tsx'
  'refund-page.tsx'     = 'app\[locale]\refund\page.tsx'
  'cookies-page.tsx'    = 'app\[locale]\cookies\page.tsx'
  'disclaimer-modal.tsx'= 'components\disclaimer\disclaimer-modal.tsx'
}
foreach ($kv in $map.GetEnumerator()) {
  $dest = Join-Path $repo $kv.Value
  if (Test-Path -LiteralPath $dest) {
    Copy-Item -LiteralPath $dest -Destination (Join-Path $bak $kv.Key) -Force
  }
  Copy-Item -LiteralPath (Join-Path $src $kv.Key) -Destination $dest -Force
  Write-Host "Wrote $($kv.Value) size=$((Get-Item -LiteralPath $dest).Length)"
}

# Bump disclaimerVersion + storage key in providers
$site = Join-Path $repo 'lib\config\site.ts'
$siteText = Get-Content -LiteralPath $site -Raw -Encoding UTF8
if ($siteText -notmatch 'disclaimerVersion: "v1\.0"') {
  $siteText = $siteText -replace 'disclaimerVersion: "v1\.2"', 'disclaimerVersion: "v1.0"'
  Set-Content -LiteralPath $site -Value $siteText -Encoding UTF8 -NoNewline
  Write-Host 'Updated siteConfig.disclaimerVersion -> v1.0'
} else { Write-Host 'siteConfig already v1.0' }

$prov = Join-Path $repo 'app\providers.tsx'
$provText = Get-Content -LiteralPath $prov -Raw -Encoding UTF8
if ($provText -match 'pojulife_disclaimer_') {
  $provText = $provText -replace 'pojulife_disclaimer_', 'easternos_disclaimer_'
  Set-Content -LiteralPath $prov -Value $provText -Encoding UTF8 -NoNewline
  Write-Host 'Updated providers.tsx storage key prefix -> easternos_disclaimer_'
} else { Write-Host 'providers key already easternos or missing' }

# Append counsel banner CSS if missing
$css = Join-Path $repo 'styles\legal-pages.css'
$cssText = Get-Content -LiteralPath $css -Raw -Encoding UTF8
if ($cssText -notmatch 'legal-page__counsel-banner') {
  $snippet = Get-Content -LiteralPath (Join-Path $src 'legal-counsel-banner.css.snippet') -Raw -Encoding UTF8
  $cssText = $cssText.TrimEnd() + "

" + $snippet.TrimEnd() + "
"
  Set-Content -LiteralPath $css -Value $cssText -Encoding UTF8 -NoNewline
  Write-Host 'Appended legal-page__counsel-banner CSS'
} else { Write-Host 'banner CSS already present' }

Write-Host 'DONE'
