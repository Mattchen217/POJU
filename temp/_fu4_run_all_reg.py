import subprocess, time
from pathlib import Path
from datetime import datetime, timezone

cwd = r"D:\POJU\pojulife"
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
out_dir = Path(r"D:\POJU\pojulife\temp")
sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=cwd, capture_output=True, encoding="utf-8", errors="replace").stdout.strip()
print("SHA", sha)
commands = [
    ("pnpm_test_m1_production_adaptive_question_loop", [pnpm, "test:m1-production-adaptive-question-loop"]),
    ("pnpm_test_m1_r_fresh_session_main_loop", [pnpm, "test:m1-r-fresh-session-main-loop"]),
    ("pnpm_test_m2_3_decision_blueprint", [pnpm, "test:m2-3-decision-blueprint"]),
    ("pnpm_test_m2_1_readiness_confirm_freeze", [pnpm, "test:m2-1-readiness-confirm-freeze"]),
    ("pnpm_test_m2_2_freeze_report_binding", [pnpm, "test:m2-2-freeze-report-binding"]),
    ("pnpm_test_decision_context_phase2", [pnpm, "test:decision-context-phase2"]),
    ("pnpm_exec_next_typegen", [pnpm, "exec", "next", "typegen"]),
    ("pnpm_exec_tsc_noEmit", [pnpm, "exec", "tsc", "--noEmit"]),
    ("pnpm_build", [pnpm, "build"]),
]
results = []
for name, cmd in commands:
    log = out_dir / f"out_m24r2fu4_final_{name}.txt"
    print("START", name, flush=True)
    t0 = time.time()
    with log.open("w", encoding="utf-8", errors="replace") as f:
        f.write(f"SHA={sha}\nCMD={' '.join(cmd)}\nSTARTED={datetime.now().isoformat()}\n\n")
        f.flush()
        p = subprocess.run(cmd, cwd=cwd, stdout=f, stderr=subprocess.STDOUT)
    elapsed = time.time() - t0
    results.append((name, p.returncode, elapsed, str(log)))
    print("DONE", name, "exit", p.returncode, "sec", round(elapsed, 1), flush=True)

summary = out_dir / "out_m24r2fu4_final_summary.txt"
lines = [f"SHA={sha}", f"WHEN={datetime.now().isoformat()}"]
for name, code, elapsed, log in results:
    lines.append(f"{name}\texit={code}\tsec={elapsed:.1f}\tlog={log}")
summary.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("SUMMARY")
print("\n".join(lines))
if any(code != 0 for _, code, _, _ in results):
    raise SystemExit(1)
