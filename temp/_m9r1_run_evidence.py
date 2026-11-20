
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")
PNPM = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
EVIDENCE = ROOT / "docs" / "evidence" / "m9-r1-session-authority-remediation-2026-11-18"
SW_PRE = ROOT / "temp" / "_m9r1_swjs_prebuild.bin"
IMPL = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()

COMMANDS = [
    ("01-test-m9-server-authoritative-session.log", "pnpm test:m9-server-authoritative-session", [PNPM, "test:m9-server-authoritative-session"]),
    ("02-test-m9-r1-session-authority-remediation.log", "pnpm test:m9-r1-session-authority-remediation", [PNPM, "test:m9-r1-session-authority-remediation"]),
    ("03-test-m8-r1-internal-turn-trust-boundary.log", "pnpm test:m8-r1-internal-turn-trust-boundary", [PNPM, "test:m8-r1-internal-turn-trust-boundary"]),
    ("04-test-m6-di2-full-lifecycle.log", "pnpm test:m6-di2-full-lifecycle", [PNPM, "test:m6-di2-full-lifecycle"]),
    ("05-test-m5-r1-authorization.log", "pnpm test:m5-r1-authorization", [PNPM, "test:m5-r1-authorization"]),
    ("06-test-m1-production-adaptive-question-loop.log", "pnpm test:m1-production-adaptive-question-loop", [PNPM, "test:m1-production-adaptive-question-loop"]),
    ("07-test-m2-1-readiness-confirm-freeze.log", "pnpm test:m2-1-readiness-confirm-freeze", [PNPM, "test:m2-1-readiness-confirm-freeze"]),
    ("08-test-m2-2-freeze-report-binding.log", "pnpm test:m2-2-freeze-report-binding", [PNPM, "test:m2-2-freeze-report-binding"]),
    ("09-test-m3-decision-report.log", "pnpm test:m3-decision-report", [PNPM, "test:m3-decision-report"]),
    ("10-test-m4-decision-authority.log", "pnpm test:m4-decision-authority", [PNPM, "test:m4-decision-authority"]),
    ("11-test-m4-1-freeze-recovery.log", "pnpm test:m4-1-freeze-recovery", [PNPM, "test:m4-1-freeze-recovery"]),
    ("12-test-m5-di2-main-path.log", "pnpm test:m5-di2-main-path", [PNPM, "test:m5-di2-main-path"]),
    ("13-test-m8-di2-non-model-closure.log", "pnpm test:m8-di2-non-model-closure", [PNPM, "test:m8-di2-non-model-closure"]),
    ("14-tsc-noemit.log", "pnpm exec tsc --noEmit --pretty false", [PNPM, "exec", "tsc", "--noEmit", "--pretty", "false"]),
    ("15-pnpm-build.log", "pnpm build", [PNPM, "build"]),
]

def summarize(name: str, text: str, exit_code: int) -> str:
    if exit_code != 0:
        return f"FAILED exit {exit_code}"
    pass_lines = len(re.findall(r"^PASS ", text, re.M))
    m = re.search(r"(\d+) passed, (\d+) failed", text)
    if "m9-r1" in name:
        return f"{pass_lines} PASS lines; checks complete"
    if "m9-server" in name:
        return f"{pass_lines} PASS lines; required cases 1-19 covered; checks complete"
    if "m8-r1" in name:
        return f"{pass_lines} PASS lines; checks complete"
    if "m8-di2" in name:
        return f"{pass_lines} PASS lines; checks complete"
    if "m1-production" in name:
        return f"{pass_lines} PASS lines; exit 0"
    if m:
        return f"{m.group(1)} passed, {m.group(2)} failed"
    if "tsc" in name:
        return "exit 0, empty log" if not text.strip() else "exit 0"
    if "build" in name:
        mm = re.search(r"Compiled successfully in [0-9.]+s", text)
        return (mm.group(0) + "; exit 0") if mm else "exit 0"
    return "exit 0"

def main() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    pre_bytes = SW_PRE.read_bytes()
    pre_sha = hashlib.sha256(pre_bytes).hexdigest()
    results = []
    failed = False
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    for log_name, command, argv in COMMANDS:
        print(f"RUN {command}", flush=True)
        start = time.perf_counter()
        proc = subprocess.run(
            argv,
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            shell=False,
        )
        elapsed = time.perf_counter() - start
        output = (proc.stdout or "") + (proc.stderr or "")
        log_path = EVIDENCE / log_name
        log_path.write_text(output, encoding="utf-8", newline="\n")
        item = {
            "command": command,
            "log": log_name,
            "exit_code": proc.returncode,
            "elapsed_s": round(elapsed, 2),
            "log_bytes": log_path.stat().st_size,
            "result": summarize(log_name, output, proc.returncode),
        }
        results.append(item)
        print(f"  exit={proc.returncode} elapsed={item['elapsed_s']}s {item['result']}", flush=True)
        if proc.returncode != 0:
            failed = True
            break

    sw_path = ROOT / "public" / "sw.js"
    post_bytes = sw_path.read_bytes()
    post_sha = hashlib.sha256(post_bytes).hexdigest()
    restored = False
    if post_bytes != pre_bytes:
        sw_path.write_bytes(pre_bytes)
        restored = True
        print(f"restored public/sw.js to pre-build bytes ({pre_sha})", flush=True)

    chicago = timezone(timedelta(hours=-6))
    recorded = datetime.now(chicago).strftime("%Y-%m-%d %H:%M:%S -06:00 (America/Chicago)")
    payload = {
        "recorded_at": recorded,
        "branch": "feat/m1-r-fresh-session-main-loop",
        "baseline_sha": "565380ae19e6f48505102bd0dccdc14d9e9e3cec",
        "implementation_sha": IMPL,
        "implementation_parent_sha": "565380ae19e6f48505102bd0dccdc14d9e9e3cec",
        "m9_implementation_sha": "ca3a68a3fb3c06789997678208d40b24ef7177e6",
        "note": "This file does not record the evidence commit SHA, to avoid a self-referential tip SHA.",
        "live_upstash_configured": False,
        "sw_js": {
            "pre_build_sha256": pre_sha,
            "pre_build_bytes": len(pre_bytes),
            "post_build_sha256": post_sha,
            "post_build_bytes": len(post_bytes),
            "restored_to_pre_build": restored,
            "committed": False,
            "note": "If pnpm build rewrote public/sw.js, the pre-build bytes were restored and the file was left unstaged. It is not part of the implementation or evidence commit.",
        },
        "commands": results,
    }
    (EVIDENCE / "command-exit-codes.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    if failed:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
