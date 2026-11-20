from pathlib import Path
import hashlib, json, subprocess, time, os

root = Path(r"D:\POJU\pojulife")
os.chdir(root)
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
logdir = root / "temp" / "m9fu2-runlogs"
logdir.mkdir(parents=True, exist_ok=True)

sw = root / "public" / "sw.js"
sw_hash = hashlib.sha256(sw.read_bytes()).hexdigest()
(logdir / "sw-js-pre-build.sha256").write_text(sw_hash + "\n", encoding="utf-8")
print("pre-build sw.js sha256", sw_hash)

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

# Write only the runner; execution is separate so we can resume.
(logdir / "commands.json").write_text(json.dumps(commands, indent=2), encoding="utf-8")
print("ready", len(commands))
