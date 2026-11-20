from pathlib import Path
import subprocess, time, json, os

repo = Path(r"D:\POJU\pojulife")
ev = repo / "docs" / "evidence" / "m8-r1-fu1-r2-assistant-history-provenance-2026-11-17"
ev.mkdir(parents=True, exist_ok=True)
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
results = []

commands = [
    ("01-test-m8-r1-internal-turn-trust-boundary", [pnpm, "test:m8-r1-internal-turn-trust-boundary"]),
    ("02-test-m6-di2-full-lifecycle", [pnpm, "test:m6-di2-full-lifecycle"]),
    ("03-test-m5-r1-authorization", [pnpm, "test:m5-r1-authorization"]),
    ("04-test-m1-production-adaptive-question-loop", [pnpm, "test:m1-production-adaptive-question-loop"]),
    ("05-test-m2-1-readiness-confirm-freeze", [pnpm, "test:m2-1-readiness-confirm-freeze"]),
    ("06-test-m2-2-freeze-report-binding", [pnpm, "test:m2-2-freeze-report-binding"]),
]

# Allow resume: skip already completed with recorded exit
summary_path = ev / "batch1-summary.json"
for name, cmd in commands:
    log = ev / f"{name}.log"
    print(f"START {name}", flush=True)
    t0 = time.time()
    proc = subprocess.run(
        cmd,
        cwd=repo,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    elapsed = time.time() - t0
    log.write_bytes(proc.stdout)
    rec = {"name": name, "exit_code": proc.returncode, "elapsed_sec": round(elapsed, 3), "log": str(log)}
    results.append(rec)
    print(f"DONE {name} exit={proc.returncode} elapsed={elapsed:.1f}s log={log}", flush=True)

summary_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
print("BATCH1 COMPLETE")
