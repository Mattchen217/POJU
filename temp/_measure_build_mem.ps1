param([string]$tag)
Set-Location D:\POJU\pojulife
$out = "temp/out_buildmem_$tag.txt"
$before = @(Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$p = Start-Process -FilePath "pnpm.cmd" -ArgumentList "build" -RedirectStandardOutput $out -RedirectStandardError "temp/out_buildmem_${tag}_err.txt" -PassThru -NoNewWindow
$peakTotal = 0; $peakSingle = 0
while (-not $p.HasExited) {
  $procs = @(Get-Process node -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id })
  $total = ($procs | Measure-Object WorkingSet64 -Sum).Sum
  $single = ($procs | Measure-Object WorkingSet64 -Maximum).Maximum
  if ($total -gt $peakTotal) { $peakTotal = $total }
  if ($single -gt $peakSingle) { $peakSingle = $single }
  Start-Sleep -Milliseconds 500
}
$p.WaitForExit()
"tag=$tag exit=$($p.ExitCode) peak_total_MB=$([math]::Round($peakTotal/1MB)) peak_single_process_MB=$([math]::Round($peakSingle/1MB)) manifest=$(Test-Path .next/routes-manifest.json)"
