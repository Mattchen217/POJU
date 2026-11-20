import json, subprocess, sys, time
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")
PNPM = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
OUT = ROOT / "temp" / "m9-evidence-logs"
OUT.mkdir(parents=True, exist_ok=True)

COMMANDS = [
    ("01-test-m9-server-authoritative-session.log", [PNPM, "test:m9-server-authoritative-session"]),
    ("02-test-m8-r1-internal-turn-trust-boundary.log", [PNPM, "test:m8-r1-internal-turn-trust-boundary"]),
    ("03-test-m6-di2-full-lifecycle.log", [PNPM, "test:m6-di2-full-lifecycle"]),
    ("04-test-m5-r1-authorization.log", [PNPM, "test:m5-r1-authorization"]),
    ("05-test-m1-production-adaptive-question-loop.log", [PNPM, "test:m1-production-adaptive-question-loop"]),
    ("06-test-m2-1-readiness-confirm-freeze.log", [PNPM, "test:m2-1-readiness-confirm-freeze"]),
    ("07-test-m2-2-freeze-report-binding.log", [PNPM, "test:m2-2-freeze-report-binding"]),
    ("08-test-m3-decision-report.log", [PNPM, "test:m3-decision-report"]),
    ("09-test-m4-decision-authority.log", [PNPM, "test:m4-decision-authority"]),
    ("10-test-m4-1-freeze-recovery.log", [PNPM, "test:m4-1-freeze-recovery"]),
    ("11-test-m5-di2-main-path.log", [PNPM, "test:m5-di2-main-path"]),
    ("12-test-m8-di2-non-model-closure.log", [PNPM, "test:m8-di2-non-model-closure"]),
    ("13-tsc-noemit.log", [PNPM, "exec", "tsc", "--noEmit", "--pretty", "false"]),
    ("14-pnpm-build.log", [PNPM, "build"]),
]

results = []
failed = 0
for name, cmd in COMMANDS:
    log_path = OUT / name
    print(f"START {name}", flush=True)
    t0 = time.perf_counter()
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        shell=False,
    )
    elapsed = time.perf_counter() - t0
    # Keep raw combined stdout+stderr as the command produced them.
    raw = ""
    if proc.stdout:
        raw += proc.stdout
    if proc.stderr:
        if raw and not raw.endswith("\n"):
            raw += "\n"
        raw += proc.stderr
    log_path.write_text(raw, encoding="utf-8")
    item = {
        "log": name,
        "command": " ".join(cmd),
        "exit_code": proc.returncode,
        "elapsed_s": round(elapsed, 2),
        "log_bytes": log_path.stat().st_size,
    }
    results.append(item)
    print(f"DONE {name} exit={proc.returncode} elapsed={item['elapsed_s']}s", flush=True)
    if proc.returncode != 0:
        failed += 1
    (OUT / "command-exit-codes.partial.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

(OUT / "command-exit-codes.json").write_text(
    json.dumps({"failed": failed, "results": results}, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
print(f"ALL_DONE failed={failed}", flush=True)
sys.exit(1 if failed else 0)
