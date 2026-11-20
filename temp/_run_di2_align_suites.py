
import subprocess, sys, time
from datetime import datetime
from pathlib import Path
PNPM = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
ROOT = Path(r"D:\POJU\pojulife")
LOG_DIR = ROOT / "temp"
suites = [
    ("new-alignment", [PNPM, "exec", "tsx", "scripts/test-di2-understanding-adaptive-engine-alignment.ts"]),
    ("m1-r-fresh-session-main-loop", [PNPM, "test:m1-r-fresh-session-main-loop"]),
    ("m1-production-adaptive-question-loop", [PNPM, "test:m1-production-adaptive-question-loop"]),
    ("di2-feature-landing-main-path", [PNPM, "test:di2-feature-landing-main-path"]),
    ("di2-understanding-composer-flow", [PNPM, "test:di2-understanding-composer-flow"]),
    ("m5-di2-main-path", [PNPM, "test:m5-di2-main-path"]),
    ("m6-di2-full-lifecycle", [PNPM, "test:m6-di2-full-lifecycle"]),
    ("m2-1-readiness-confirm-freeze", [PNPM, "test:m2-1-readiness-confirm-freeze"]),
    ("intake-r6-agent-collecting-failure", [PNPM, "exec", "tsx", "scripts/test-intake-r6-agent-collecting-failure.ts"]),
]
summary = []
print("runner start", datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z"), flush=True)
for name, cmd in suites:
    started = datetime.now().astimezone()
    print(f"\n===== START {name} {started.strftime('%Y-%m-%d %H:%M:%S %z')} =====", flush=True)
    raw = LOG_DIR / f"run-{name}.log"
    with raw.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"START {name} {started.strftime('%Y-%m-%d %H:%M:%S %z')}\n")
        fh.write("CMD " + " ".join(cmd) + "\n")
        fh.flush()
        proc = subprocess.Popen(
            cmd,
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        assert proc.stdout is not None
        for line in proc.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            fh.write(line)
        code = proc.wait()
        ended = datetime.now().astimezone()
        elapsed = (ended - started).total_seconds()
        fh.write(f"\nEND {name} {ended.strftime('%Y-%m-%d %H:%M:%S %z')} exit={code} elapsed_s={elapsed:.1f}\n")
    summary.append((name, started, ended, code, elapsed))
    print(f"===== END {name} exit={code} elapsed_s={elapsed:.1f} =====", flush=True)
    if code != 0:
        print("Stopping after first failure.", flush=True)
        break

print("\nSUMMARY", flush=True)
for name, started, ended, code, elapsed in summary:
    print(
        f"{name}: exit={code} start={started.strftime('%Y-%m-%d %H:%M:%S %z')} end={ended.strftime('%Y-%m-%d %H:%M:%S %z')} elapsed_s={elapsed:.1f}",
        flush=True,
    )
ok = len(summary) == len(suites) and all(item[3] == 0 for item in summary)
sys.exit(0 if ok else 1)
