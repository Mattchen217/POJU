import subprocess
from pathlib import Path
PNPM = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
CWD = r"D:\POJU\pojulife"

def run(name, args):
    out_path = Path("temp") / f"out_m24r2fu2_{name}_r2.txt"
    with out_path.open("w", encoding="utf-8") as out:
        r = subprocess.run([PNPM, *args], cwd=CWD, stdout=out, stderr=subprocess.STDOUT)
    print(f"{name} exit={r.returncode}", flush=True)
    return r.returncode

codes = {}
codes["tsc"] = run("tsc", ["exec", "tsc", "--noEmit"])
codes["m23"] = run("m23", ["test:m2-3-decision-blueprint"])
codes["m1adaptive"] = run("m1adaptive", ["test:m1-production-adaptive-question-loop"])
codes["build"] = run("build", ["build"])
print("SUMMARY", codes, flush=True)
Path("temp/out_m24r2fu2_regression_summary2.txt").write_text(
    "\n".join(f"{k}={v}" for k,v in codes.items())+"\n", encoding="utf-8"
)
