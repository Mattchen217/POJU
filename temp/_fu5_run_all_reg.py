# -*- coding: utf-8 -*-
import datetime, subprocess, sys
from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")
PNPM = Path(r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd")
SHA = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
OUTDIR = ROOT / "temp"
SUMMARY = OUTDIR / "out_m24r2fu5_final_summary.txt"

COMMANDS = [
    ("m1adaptive", [str(PNPM), "test:m1-production-adaptive-question-loop"]),
    ("m1r", [str(PNPM), "test:m1-r-fresh-session-main-loop"]),
    ("m23", [str(PNPM), "test:m2-3-decision-blueprint"]),
    ("m21", [str(PNPM), "test:m2-1-readiness-confirm-freeze"]),
    ("m22", [str(PNPM), "test:m2-2-freeze-report-binding"]),
    ("phase2", [str(PNPM), "test:decision-context-phase2"]),
    ("typegen", [str(PNPM), "exec", "next", "typegen"]),
    ("tsc", [str(PNPM), "exec", "tsc", "--noEmit"]),
    ("build", [str(PNPM), "build"]),
]

rows = []
print("IMPL_SHA", SHA, flush=True)
for name, cmd in COMMANDS:
    log = OUTDIR / ("out_m24r2fu5_final_%s.txt" % name)
    started = datetime.datetime.now().isoformat()
    header = "SHA=%s\nCMD=%s\nSTARTED=%s\n\n" % (SHA, " ".join(cmd), started)
    print("RUN %s start=%s" % (name, started), flush=True)
    with open(log, "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
        f.flush()
        proc = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT, cwd=ROOT)
        ended = datetime.datetime.now().isoformat()
        f.write("\nEXIT=%s\nENDED=%s\n" % (proc.returncode, ended))
    rows.append((name, " ".join(cmd), proc.returncode, str(log)))
    print("DONE %s exit=%s ended=%s" % (name, proc.returncode, ended), flush=True)

lines = ["IMPL_SHA=%s" % SHA, "ENDED=%s" % datetime.datetime.now().isoformat(), ""]
all_ok = True
for name, cmd, code, log in rows:
    lines.append("%s\tEXIT=%s\t%s\t%s" % (name, code, cmd, log))
    if code != 0:
        all_ok = False
lines.append("")
lines.append("ALL_OK=" + str(all_ok).lower())
SUMMARY.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines), flush=True)
sys.exit(0 if all_ok else 1)
