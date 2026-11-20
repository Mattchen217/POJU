Set-Location D:\POJU\pojulife
$head = (git rev-parse HEAD).Trim()
$prefix = if ($args.Count -gt 0) { $args[0] } else { "out_m5r1fu3_final" }
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
    param($n, $prefix)
    Set-Location D:\POJU\pojulife
    npx tsx "scripts/$n.ts" *> "temp/${prefix}_$n.txt"
    "$n|$LASTEXITCODE"
  } -ArgumentList $n, $prefix
}
$subsets = foreach ($s in @("fu1", "fu2", "fu3")) {
  Start-Job -ScriptBlock {
    param($s, $prefix)
    Set-Location D:\POJU\pojulife
    pnpm "test:m5-r1-$s" *> "temp/${prefix}_test-m5-r1-$s.txt"
    "test-m5-r1-$s|$LASTEXITCODE"
  } -ArgumentList $s, $prefix
}
$results = @($jobs + $subsets) | Wait-Job | Receive-Job
$lines = @("HEAD=$head")
foreach ($r in $results) {
  $parts = $r.Split("|")
  $n = $parts[0]; $code = $parts[1]
  $tail = Get-Content "temp/${prefix}_$n.txt" | Where-Object { $_ -match "passed|PASS=|FAIL=|checks passed|done\." } | Select-Object -Last 1
  $lines += "[$n] exit=$code :: $tail"
}
npx tsc --noEmit -p . *> "temp/${prefix}_tsc.txt"
$lines += "[tsc] exit=$LASTEXITCODE"
npx tsc --noEmit -p temp/tsconfig.m5r1-scripts.json *> "temp/${prefix}_tsc_scripts.txt"
$lines += "[tsc m5 + m5-r1 test files] exit=$LASTEXITCODE"
$lines | Set-Content -Encoding utf8 "temp/${prefix}_summary.txt"
$lines
