from pathlib import Path
import subprocess, time, json

repo = Path(r"D:\POJU\pojulife")
ev = repo / "docs" / "evidence" / "m8-r1-fu1-r2-assistant-history-provenance-2026-11-17"
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
results = []
commands = [
    ("07-test-m3-decision-report", [pnpm, "test:m3-decision-report"]),
    ("08-test-m4-decision-authority", [pnpm, "test:m4-decision-authority"]),
    ("09-test-m4-1-freeze-recovery", [pnpm, "test:m4-1-freeze-recovery"]),
    ("10-test-m5-di2-main-path", [pnpm, "test:m5-di2-main-path"]),
    ("11-test-m8-di2-non-model-closure", [pnpm, "test:m8-di2-non-model-closure"]),
    ("12-tsc-noemit", [pnpm, "exec", "tsc", "--noEmit", "--pretty", "false"]),
    ("13-production-build", [pnpm, "build"]),
]
for name, cmd in commands:
    log = ev / f"{name}.log"
    print(f"START {name}", flush=True)
    t0 = time.time()
    proc = subprocess.run(cmd, cwd=repo, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    elapsed = time.time() - t0
    log.write_bytes(proc.stdout)
    rec = {"name": name, "exit_code": proc.returncode, "elapsed_sec": round(elapsed, 3), "log": str(log)}
    results.append(rec)
    print(f"DONE {name} exit={proc.returncode} elapsed={elapsed:.1f}s log={log}", flush=True)
    if proc.returncode != 0 and name != "13-production-build":
        # continue remaining only if we want; for tsc failure we should still try build? Instruction says fix or mark blocker. Stop after first failure except we still want logs. I'll continue to gather all results.
        pass

(ev / "batch2-summary.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print("BATCH2 COMPLETE")
