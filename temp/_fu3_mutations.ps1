Set-Location D:\POJU\pojulife
$files = @(
  "lib/poju/decision-intake/decision-report-api.ts",
  "lib/poju/decision-intake/decision-report-lock.ts",
  "lib/poju/decision-intake/decision-report-service.ts"
)
$head = (git rev-parse HEAD).Trim()
$lines = @("HEAD=$head")
$ids = @("M1_precheck_before_lock", "M2_unchecked_owner_release", "M3_resume_without_right", "M4_job_release_ignores_binding", "M5_dispatch_on_lost_handoff", "M6_claim_without_owner_check")
foreach ($id in $ids) {
  node temp/_fu3_mutate.cjs $id
  if ($LASTEXITCODE -ne 0) { $lines += "[$id] APPLY FAILED"; git checkout -- $files; continue }
  npx tsx scripts/test-m5-r1-authorization.ts *> "temp/out_m5r1fu3_mut_$id.txt"
  $code = $LASTEXITCODE
  git checkout -- $files
  $fails = Get-Content "temp/out_m5r1fu3_mut_$id.txt" | Where-Object { $_ -match "^\s+FAIL\s" } | ForEach-Object { ($_.Trim() -split "\s+", 3)[1] }
  $tail = Get-Content "temp/out_m5r1fu3_mut_$id.txt" | Where-Object { $_ -match "passed, \d+ failed" } | Select-Object -Last 1
  $lines += "[$id] exit=$code :: $tail :: killed by $($fails -join ', ')"
}
$clean = (git status --short -- $files)
$lines += "restored clean: $([string]::IsNullOrEmpty($clean))"
$lines | Set-Content -Encoding utf8 temp/out_m5r1fu3_mut_summary.txt
$lines
