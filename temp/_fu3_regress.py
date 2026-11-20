import subprocess, os, json, time
from pathlib import Path
from datetime import datetime, timezone, timedelta

os.chdir(r"D:\POJU\pojulife")
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
commands = [
    ("test:m1-production-adaptive-question-loop", [pnpm, "test:m1-production-adaptive-question-loop"], "temp/out_m24r2fu3_final_m1adaptive.txt"),
    ("test:m1-r-fresh-session-main-loop", [pnpm, "test:m1-r-fresh-session-main-loop"], "temp/out_m24r2fu3_final_m1r.txt"),
    ("test:m2-3-decision-blueprint", [pnpm, "test:m2-3-decision-blueprint"], "temp/out_m24r2fu3_final_m23.txt"),
    ("test:m2-1-readiness-confirm-freeze", [pnpm, "test:m2-1-readiness-confirm-freeze"], "temp/out_m24r2fu3_final_m21.txt"),
    ("test:m2-2-freeze-report-binding", [pnpm, "test:m2-2-freeze-report-binding"], "temp/out_m24r2fu3_final_m22.txt"),
    ("test:decision-context-phase2", [pnpm, "test:decision-context-phase2"], "temp/out_m24r2fu3_final_phase2.txt"),
    ("exec next typegen", [pnpm, "exec", "next", "typegen"], "temp/out_m24r2fu3_final_typegen.txt"),
    ("exec tsc --noEmit", [pnpm, "exec", "tsc", "--noEmit"], "temp/out_m24r2fu3_final_tsc.txt"),
    ("build", [pnpm, "build"], "temp/out_m24r2fu3_final_build.txt"),
]
# Chicago UTC-6 on 2026-11-11
results = []
print("SHA", sha)
for name, cmd, log in commands:
    t0 = time.time()
    print(f"START {name}", flush=True)
    with open(log, "w", encoding="utf-8", errors="replace") as f:
        f.write(f"# SHA {sha}\n# CMD {' '.join(cmd)}\n")
        f.flush()
        p = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT, cwd=r"D:\POJU\pojulife")
    elapsed = time.time() - t0
    rec = {"name": name, "cmd": " ".join(cmd), "log": log, "exit": p.returncode, "elapsed_sec": round(elapsed, 1), "sha": sha}
    results.append(rec)
    print(f"DONE {name} exit={p.returncode} elapsed={elapsed:.1f}s", flush=True)

out = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_summary.txt")
lines = [f"SHA={sha}", ""]
for r in results:
    lines.append(f"{r['name']}: exit={r['exit']} elapsed_sec={r['elapsed_sec']} sha={r['sha']}")
out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("SUMMARY")
print("\n".join(lines))
