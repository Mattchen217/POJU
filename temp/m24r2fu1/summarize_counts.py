from pathlib import Path
import re
names = [
    "out_m24r2fu1_pnpm_test_m1-r-fresh-session-main-loop.txt",
    "out_m24r2fu1_pnpm_test_m2-3-decision-blueprint.txt",
    "out_m24r2fu1_pnpm_test_m2-1-readiness-confirm-freeze.txt",
    "out_m24r2fu1_pnpm_test_m2-2-freeze-report-binding.txt",
    "out_m24r2fu1_pnpm_test_decision-context-phase2.txt",
]
for name in names:
    t = Path("temp")/name
    text = t.read_text(encoding="utf-8", errors="replace")
    print("====", name, "====")
    for ln in text.splitlines():
        s="".join(ch if ord(ch)<128 else "?" for ch in ln)
        if re.search(r"PASS=|FAIL=|passed|failed|done\.|ok |tests", s, re.I) and "pojuTerm" not in s and "Traditional" not in s:
            if any(k in s for k in ("PASS=", "FAIL=", "passed", "failed", "done.", "Test", "ok ", "assertions")):
                print(s[:250])
