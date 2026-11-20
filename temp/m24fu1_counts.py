from pathlib import Path
import re
files = {
  "m1adaptive": "temp/out_m24fu1_m1adaptive.txt",
  "m1r": "temp/out_m24fu1_pnpm_test_m1_r_fresh_session_main_loop.txt",
  "m23": "temp/out_m24fu1_pnpm_test_m2_3_decision_blueprint.txt",
  "m21": "temp/out_m24fu1_pnpm_test_m2_1_readiness_confirm_freeze.txt",
  "m22": "temp/out_m24fu1_pnpm_test_m2_2_freeze_report_binding.txt",
  "phase2": "temp/out_m24fu1_pnpm_test_decision_context_phase2.txt",
}
for k,f in files.items():
    p = Path(f)
    if not p.exists():
        print(k, "MISSING")
        continue
    t = p.read_text(encoding="utf-8", errors="replace")
    # find summary lines
    lines = [ln for ln in t.splitlines() if re.search(r"PASS=|passed|FAIL=|done\.|results:", ln, re.I)]
    print(f"=== {k} ===")
    for ln in lines[-8:]:
        print(ln)
