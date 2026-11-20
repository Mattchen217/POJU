from pathlib import Path
import json, hashlib

ev = Path(r"docs/evidence/m8-r1-fu1-r2-assistant-history-provenance-2026-11-17")
rows = json.loads((ev / "batch1-summary.json").read_text(encoding="utf-8")) + json.loads((ev / "batch2-summary.json").read_text(encoding="utf-8"))
labels = {
    "01-test-m8-r1-internal-turn-trust-boundary": "pnpm test:m8-r1-internal-turn-trust-boundary",
    "02-test-m6-di2-full-lifecycle": "pnpm test:m6-di2-full-lifecycle",
    "03-test-m5-r1-authorization": "pnpm test:m5-r1-authorization",
    "04-test-m1-production-adaptive-question-loop": "pnpm test:m1-production-adaptive-question-loop",
    "05-test-m2-1-readiness-confirm-freeze": "pnpm test:m2-1-readiness-confirm-freeze",
    "06-test-m2-2-freeze-report-binding": "pnpm test:m2-2-freeze-report-binding",
    "07-test-m3-decision-report": "pnpm test:m3-decision-report",
    "08-test-m4-decision-authority": "pnpm test:m4-decision-authority",
    "09-test-m4-1-freeze-recovery": "pnpm test:m4-1-freeze-recovery",
    "10-test-m5-di2-main-path": "pnpm test:m5-di2-main-path",
    "11-test-m8-di2-non-model-closure": "pnpm test:m8-di2-non-model-closure",
    "12-tsc-noemit": "pnpm exec tsc --noEmit --pretty false",
    "13-production-build": "pnpm build",
}
out = []
for r in rows:
    out.append({
        "command": labels[r["name"]],
        "exit_code": r["exit_code"],
        "elapsed_sec": r["elapsed_sec"],
        "log": "docs/evidence/m8-r1-fu1-r2-assistant-history-provenance-2026-11-17/" + Path(r["log"]).name,
    })
(ev / "command-exit-codes.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8", newline="\n")
sw = Path(r"public/sw.js").read_bytes()
(ev / "sw-js-restored-after-build.sha256").write_text(hashlib.sha256(sw).hexdigest() + "\n", encoding="utf-8", newline="\n")
print(json.dumps(out, indent=2))
