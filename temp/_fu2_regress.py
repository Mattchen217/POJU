import subprocess
from pathlib import Path

PNPM = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
CWD = r"D:\POJU\pojulife"

def run(name, args):
    out_path = Path("temp") / f"out_m24r2fu2_{name}.txt"
    with out_path.open("w", encoding="utf-8") as out:
        r = subprocess.run([PNPM, *args], cwd=CWD, stdout=out, stderr=subprocess.STDOUT)
    print(f"{name} exit={r.returncode} file={out_path}", flush=True)
    return r.returncode

# already have m1adaptive 91/91; rerun not needed unless we change files
codes = {}
codes["typegen"] = run("typegen", ["exec", "next", "typegen"])
codes["tsc"] = run("tsc", ["exec", "tsc", "--noEmit"])
codes["m1r"] = run("m1r", ["test:m1-r-fresh-session-main-loop"])
codes["m23"] = run("m23", ["test:m2-3-decision-blueprint"])
codes["m21"] = run("m21", ["test:m2-1-readiness-confirm-freeze"])
codes["m22"] = run("m22", ["test:m2-2-freeze-report-binding"])
codes["phase2"] = run("phase2", ["test:decision-context-phase2"])
codes["build"] = run("build", ["build"])
print("SUMMARY", codes, flush=True)
Path("temp/out_m24r2fu2_regression_summary.txt").write_text(
    "\n".join(f"{k}={v}" for k,v in codes.items()) + "\n",
    encoding="utf-8",
)
