import json, os, subprocess, time
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")
OUT = ROOT / "temp" / "fu2" / "final"
OUT.mkdir(parents=True, exist_ok=True)
PNPM = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
env = os.environ.copy()
env["PYTHONUTF8"] = "1"
env["PYTHONIOENCODING"] = "utf-8"
env["NODE_OPTIONS"] = (env.get("NODE_OPTIONS", "") + " --no-deprecation").strip()
cmds = [
    ("pnpm_test_m1_production_adaptive_question_loop", [PNPM, "test:m1-production-adaptive-question-loop"]),
    ("pnpm_test_m1_r_fresh_session_main_loop", [PNPM, "test:m1-r-fresh-session-main-loop"]),
    ("pnpm_test_m2_3_decision_blueprint", [PNPM, "test:m2-3-decision-blueprint"]),
    ("pnpm_test_m2_1_readiness_confirm_freeze", [PNPM, "test:m2-1-readiness-confirm-freeze"]),
    ("pnpm_test_m2_2_freeze_report_binding", [PNPM, "test:m2-2-freeze-report-binding"]),
    ("pnpm_test_decision_context_phase2", [PNPM, "test:decision-context-phase2"]),
    ("pnpm_exec_next_typegen", [PNPM, "exec", "next", "typegen"]),
    ("pnpm_exec_tsc_noEmit", [PNPM, "exec", "tsc", "--noEmit"]),
    ("pnpm_build", [PNPM, "build"]),
]
summary = []
for name, cmd in cmds:
    print(f"=== START {name} ===", flush=True)
    log = OUT / f"{name}.txt"
    t0 = time.time()
    with log.open("w", encoding="utf-8", errors="replace") as f:
        proc = subprocess.run(cmd, cwd=ROOT, stdout=f, stderr=subprocess.STDOUT, shell=False, env=env)
    elapsed = time.time() - t0
    item = {"name": name, "cmd": " ".join(["pnpm"] + cmd[1:]), "exit": proc.returncode, "elapsed_s": round(elapsed, 1), "log": str(log)}
    summary.append(item)
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"=== DONE {name} exit={proc.returncode} {elapsed:.1f}s ===", flush=True)
print("ALL_DONE")
