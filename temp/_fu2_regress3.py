import subprocess, re
from pathlib import Path
PNPM = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
CWD = r"D:\POJU\pojulife"

def run(name, args):
    out_path = Path("temp") / f"out_m24r2fu2_{name}_final.txt"
    with out_path.open("w", encoding="utf-8") as out:
        r = subprocess.run([PNPM, *args], cwd=CWD, stdout=out, stderr=subprocess.STDOUT)
    print(f"{name} exit={r.returncode}", flush=True)
    return r.returncode

codes = {}
codes["typegen"] = run("typegen", ["exec", "next", "typegen"])
codes["m1r"] = run("m1r", ["test:m1-r-fresh-session-main-loop"])
codes["m21"] = run("m21", ["test:m2-1-readiness-confirm-freeze"])
codes["m22"] = run("m22", ["test:m2-2-freeze-report-binding"])
codes["phase2"] = run("phase2", ["test:decision-context-phase2"])
print("SUMMARY", codes, flush=True)

# extract counts from latest outputs
def tail_counts(path):
    t = Path(path).read_text(encoding="utf-8", errors="replace")
    safe = t.encode("ascii","backslashreplace").decode()
    lines = [l for l in safe.splitlines() if any(k in l for k in ["PASS=", "FAIL=", "passed", "failed", "M1 done", "results", "Tests:", "Test Files"])]
    return lines[-8:]

print("----- counts -----")
for label, path in [
    ("m1adaptive_r2", "temp/out_m24r2fu2_m1adaptive_r2.txt"),
    ("m23_r2", "temp/out_m24r2fu2_m23_r2.txt"),
    ("m1r_final", "temp/out_m24r2fu2_m1r_final.txt"),
    ("m21_final", "temp/out_m24r2fu2_m21_final.txt"),
    ("m22_final", "temp/out_m24r2fu2_m22_final.txt"),
    ("phase2_final", "temp/out_m24r2fu2_phase2_final.txt"),
    ("build_r2", "temp/out_m24r2fu2_build_r2.txt"),
]:
    print(label, tail_counts(path))
