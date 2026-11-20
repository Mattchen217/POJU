# -*- coding: utf-8 -*-
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(r"D:\POJU\pojulife")
PNPM = Path(r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd")
OUT = ROOT / "temp" / "_fu3_evidence_logs"
OUT.mkdir(parents=True, exist_ok=True)

COMMANDS = [
    ("01-test-m9-server-authoritative-session.log", [str(PNPM), "test:m9-server-authoritative-session"]),
    ("02-test-m9-r1-session-authority-remediation.log", [str(PNPM), "test:m9-r1-session-authority-remediation"]),
    ("03-test-m9-r1-fu1-redis-lua-integrity-parity.log", [str(PNPM), "test:m9-r1-fu1-redis-lua-integrity-parity"]),
    ("04-test-m9-r1-fu1-fu2-ledger-integrity-atomic-binding.log", [str(PNPM), "test:m9-r1-fu1-fu2-ledger-integrity-atomic-binding"]),
    ("05-test-m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding.log", [str(PNPM), "test:m9-r1-fu1-fu2-fu3-session-record-integrity-atomic-binding"]),
    ("06-test-m8-r1-internal-turn-trust-boundary.log", [str(PNPM), "test:m8-r1-internal-turn-trust-boundary"]),
    ("07-test-m6-di2-full-lifecycle.log", [str(PNPM), "test:m6-di2-full-lifecycle"]),
    ("08-test-m5-r1-authorization.log", [str(PNPM), "test:m5-r1-authorization"]),
    ("09-test-m1-production-adaptive-question-loop.log", [str(PNPM), "test:m1-production-adaptive-question-loop"]),
    ("10-test-m2-1-readiness-confirm-freeze.log", [str(PNPM), "test:m2-1-readiness-confirm-freeze"]),
    ("11-test-m2-2-freeze-report-binding.log", [str(PNPM), "test:m2-2-freeze-report-binding"]),
    ("12-test-m3-decision-report.log", [str(PNPM), "test:m3-decision-report"]),
    ("13-test-m4-decision-authority.log", [str(PNPM), "test:m4-decision-authority"]),
    ("14-test-m4-1-freeze-recovery.log", [str(PNPM), "test:m4-1-freeze-recovery"]),
    ("15-test-m5-di2-main-path.log", [str(PNPM), "test:m5-di2-main-path"]),
    ("16-test-m8-di2-non-model-closure.log", [str(PNPM), "test:m8-di2-non-model-closure"]),
    ("17-tsc-noemit.log", [str(PNPM), "exec", "tsc", "--noEmit", "--pretty", "false"]),
    ("18-pnpm-build.log", [str(PNPM), "build"]),
]

SW = ROOT / "public" / "sw.js"
EXPECTED_PRE_SHA = "38ce6db5fb144844e7089222cb0ed6ea71d54bdff8bd9035def4b25d2e170980"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def display_command(argv: list[str]) -> str:
    shown = []
    for part in argv:
        if part.lower().endswith("pnpm.cmd") or part.lower().endswith("pnpm"):
            shown.append("pnpm")
        else:
            shown.append(part)
    return " ".join(shown)


def count_pass_lines(text: str) -> int:
    return sum(1 for line in text.splitlines() if line.startswith("PASS "))


def main() -> int:
    pre_sha = sha256(SW)
    pre_bytes = SW.stat().st_size
    (OUT / "sw-pre-build.sha256.txt").write_text(
        f"{pre_sha}\n{pre_bytes}\n", encoding="utf-8", newline="\n"
    )
    backup = OUT / "sw-js-pre-build.bin"
    backup.write_bytes(SW.read_bytes())
    print(f"pre-build public/sw.js sha256={pre_sha} bytes={pre_bytes}")
    if pre_sha != EXPECTED_PRE_SHA:
        print(f"WARNING: pre-build sw.js sha256 differs from historical {EXPECTED_PRE_SHA}")

    results = []
    overall = 0
    for log_name, argv in COMMANDS:
        log_path = OUT / log_name
        print(f"RUN {display_command(argv)} -> {log_name}", flush=True)
        started = time.perf_counter()
        proc = subprocess.run(
            argv,
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            shell=False,
        )
        elapsed = time.perf_counter() - started
        output = proc.stdout
        # Keep exact bytes; decode for counting only.
        log_path.write_bytes(output)
        text = output.decode("utf-8", errors="replace")
        passes = count_pass_lines(text)
        item = {
            "command": display_command(argv),
            "log": log_name,
            "exit_code": proc.returncode,
            "elapsed_s": round(elapsed, 2),
            "log_bytes": len(output),
            "pass_lines": passes,
        }
        results.append(item)
        print(
            f"EXIT {proc.returncode} elapsed={item['elapsed_s']}s pass_lines={passes} bytes={len(output)}",
            flush=True,
        )
        if proc.returncode != 0:
            overall = proc.returncode

    post_sha = sha256(SW)
    post_bytes = SW.stat().st_size
    restored = False
    if post_sha != pre_sha:
        SW.write_bytes(backup.read_bytes())
        restored_sha = sha256(SW)
        restored = restored_sha == pre_sha
        print(f"restored public/sw.js post={post_sha} ({post_bytes} bytes) restored={restored} sha={restored_sha}")
    else:
        print("public/sw.js unchanged by build")

    tz = ZoneInfo("America/Chicago")
    recorded = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S %z (America/Chicago)")
    summary = {
        "recorded_at_draft": recorded,
        "pre_build_sw_sha256": pre_sha,
        "pre_build_sw_bytes": pre_bytes,
        "post_build_sw_sha256": post_sha,
        "post_build_sw_bytes": post_bytes,
        "restored_to_pre_build": restored or post_sha == pre_sha,
        "commands": results,
        "overall_exit_code": overall,
    }
    (OUT / "validation-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(json.dumps({"overall_exit_code": overall, "commands": len(results)}, indent=2))
    return overall


if __name__ == "__main__":
    sys.exit(main())
