from pathlib import Path
import hashlib, json, subprocess, time, os, sys

root = Path(r"D:\POJU\pojulife")
os.chdir(root)
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
logdir = root / "temp" / "m9fu2-runlogs"
logdir.mkdir(parents=True, exist_ok=True)
status_path = logdir / "status.json"

commands = [
    ("01-test-m9-server-authoritative-session", [pnpm, "test:m9-server-authoritative-session"]),
    ("02-test-m9-r1-session-authority-remediation", [pnpm, "test:m9-r1-session-authority-remediation"]),
    ("03-test-m9-r1-fu1-redis-lua-integrity-parity", [pnpm, "test:m9-r1-fu1-redis-lua-integrity-parity"]),
    ("04-test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding", [pnpm, "test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding"]),
    ("05-test-m8-r1-internal-turn-trust-boundary", [pnpm, "test:m8-r1-internal-turn-trust-boundary"]),
    ("06-test-m6-di2-full-lifecycle", [pnpm, "test:m6-di2-full-lifecycle"]),
    ("07-test-m5-r1-authorization", [pnpm, "test:m5-r1-authorization"]),
    ("08-test-m1-production-adaptive-question-loop", [pnpm, "test:m1-production-adaptive-question-loop"]),
    ("09-test-m2-1-readiness-confirm-freeze", [pnpm, "test:m2-1-readiness-confirm-freeze"]),
    ("10-test-m2-2-freeze-report-binding", [pnpm, "test:m2-2-freeze-report-binding"]),
    ("11-test-m3-decision-report", [pnpm, "test:m3-decision-report"]),
    ("12-test-m4-decision-authority", [pnpm, "test:m4-decision-authority"]),
    ("13-test-m4-1-freeze-recovery", [pnpm, "test:m4-1-freeze-recovery"]),
    ("14-test-m5-di2-main-path", [pnpm, "test:m5-di2-main-path"]),
    ("15-test-m8-di2-non-model-closure", [pnpm, "test:m8-di2-non-model-closure"]),
    ("16-tsc-noEmit", [pnpm, "exec", "tsc", "--noEmit", "--pretty", "false"]),
    ("17-pnpm-build", [pnpm, "build"]),
]

results = []

def write_status(extra=None):
    payload = {"done": extra == "complete", "results": results, "extra": extra}
    status_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

for name, cmd in commands:
    print(f"START {name}", flush=True)
    started = time.time()
    env = os.environ.copy()
    env["FORCE_COLOR"] = "0"
    proc = subprocess.run(cmd, cwd=root, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
    duration_ms = int((time.time() - started) * 1000)
    log_path = logdir / f"{name}.log"
    # raw combined log, stdout first then stderr if any
    parts = []
    if proc.stdout:
        parts.append(proc.stdout)
    if proc.stderr:
        if parts and not parts[-1].endswith("\n"):
            parts.append("\n")
        parts.append(proc.stderr)
    log_path.write_text("".join(parts), encoding="utf-8", newline="\n")
    item = {
        "name": name,
        "command": " ".join(cmd),
        "display_command": " ".join(["pnpm" if c == pnpm else c for c in cmd]),
        "exit_code": proc.returncode,
        "duration_ms": duration_ms,
        "log": str(log_path),
        "log_bytes": log_path.stat().st_size,
    }
    results.append(item)
    write_status(f"finished {name}")
    print(f"DONE {name} exit={proc.returncode} duration_ms={duration_ms} bytes={item['log_bytes']}", flush=True)
    if proc.returncode != 0:
        write_status("failed")
        sys.exit(proc.returncode)

# record post-build sw hash
sw = root / "public" / "sw.js"
post = hashlib.sha256(sw.read_bytes()).hexdigest()
pre = (logdir / "sw-js-pre-build.sha256").read_text(encoding="utf-8").strip()
(logdir / "sw-js-post-build.sha256").write_text(post + "\n", encoding="utf-8")
(logdir / "command-exit-codes.json").write_text(json.dumps({"pre_sw": pre, "post_sw": post, "results": results}, indent=2), encoding="utf-8")
write_status("complete")
print("ALL_OK", flush=True)
