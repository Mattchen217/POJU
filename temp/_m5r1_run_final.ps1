Set-Location D:\POJU\pojulife
$head = (git rev-parse HEAD).Trim()
$suites = @(
  "test-m5-r1-authorization",
  "test-m5-di2-main-path",
  "test-m4-1-freeze-recovery",
  "test-m4-decision-authority",
  "test-m3-decision-report",
  "test-m2-1-readiness-confirm-freeze",
  "test-m2-2-freeze-report-binding",
  "test-m2-3-decision-blueprint",
  "test-m2-4-r2-production-closure",
  "test-m1-r-fresh-session-main-loop",
  "test-intake-r6-freeze-versioning",
  "test-intake-r6-freeze-authority-regression",
  "test-intake-r6-freeze-wire-reason",
  "test-intake-r6-freeze-persist-disclose",
  "test-s7-dc-lifecycle"
)
$jobs = foreach ($n in $suites) {
  Start-Job -ScriptBlock {
    param($n)
    Set-Location D:\POJU\pojulife
    npx tsx "scripts/$n.ts" *> "temp/out_m5r1_final_$n.txt"
    "$n|$LASTEXITCODE"
  } -ArgumentList $n
}
$results = $jobs | Wait-Job | Receive-Job
$lines = @("HEAD=$head")
foreach ($r in $results) {
  $parts = $r.Split("|")
  $n = $parts[0]; $code = $parts[1]
  $tail = Get-Content "temp/out_m5r1_final_$n.txt" | Where-Object { $_ -match "passed|PASS=|FAIL=|checks passed|done\." } | Select-Object -Last 1
  $lines += "[$n] exit=$code :: $tail"
}
npx tsc --noEmit -p . *> temp/out_m5r1_final_tsc.txt
$lines += "[tsc] exit=$LASTEXITCODE"
npx tsc --noEmit -p temp/tsconfig.m5r1-scripts.json *> temp/out_m5r1_final_tsc_scripts.txt
$lines += "[tsc m5 + m5-r1 test files] exit=$LASTEXITCODE"
$lines | Set-Content -Encoding utf8 temp/out_m5r1_final_summary.txt
$lines
