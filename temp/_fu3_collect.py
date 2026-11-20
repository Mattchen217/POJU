import sys, re
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
os_cwd = r"D:\POJU\pojulife"
# confirm sha
import subprocess, os
os.chdir(os_cwd)
sha = subprocess.check_output(["git","rev-parse","HEAD"], text=True).strip()
print("HEAD", sha)
print("status", subprocess.check_output(["git","status","--porcelain=v1","--","lib","scripts","docs"], text=True))

# extract results from logs
logs = {
    "test:m1-production-adaptive-question-loop": "temp/out_m24r2fu3_final_m1adaptive.txt",
    "test:m1-r-fresh-session-main-loop": "temp/out_m24r2fu3_final_m1r.txt",
    "test:m2-3-decision-blueprint": "temp/out_m24r2fu3_final_m23.txt",
    "test:m2-1-readiness-confirm-freeze": "temp/out_m24r2fu3_final_m21.txt",
    "test:m2-2-freeze-report-binding": "temp/out_m24r2fu3_final_m22.txt",
    "test:decision-context-phase2": "temp/out_m24r2fu3_final_phase2.txt",
    "exec next typegen": "temp/out_m24r2fu3_final_typegen.txt",
    "exec tsc --noEmit": "temp/out_m24r2fu3_final_tsc.txt",
    "build": "temp/out_m24r2fu3_final_build.txt",
}
# sha in log headers + pass lines
for name, path in logs.items():
    t = Path(path).read_text(encoding="utf-8", errors="replace")
    header = t.splitlines()[0] if t else ""
    done = [ln for ln in t.splitlines() if "done." in ln.lower() or "M1 done" in ln or "FAIL=" in ln or "error TS" in ln or "Failed to compile" in ln or "Compiled successfully" in ln or "✓ Compiled" in ln or "Creating an optimized production build" in ln]
    # tail useful
    print(f"\n==== {name} ====")
    print(header)
    # find last few meaningful
    for ln in t.splitlines():
        if any(s in ln for s in ["PASS=", "FAIL=", "error TS", "Failed to compile", "Compiled successfully", "✓ Compiled", "ELIFECYCLE", "TypeError", "Collecting page data"]):
            print(ln)
    if name == "build":
        print("exit file", Path("temp/out_m24r2fu3_final_build.exit").read_text(encoding="utf-8") if Path("temp/out_m24r2fu3_final_build.exit").exists() else "n/a")
        if "Failed to compile" in t or "error TS" in t:
            print("BUILD HAS ERRORS")
        elif "ƒ Proxy (Middleware)" in t or "Creating an optimized production build" in t:
            print("BUILD LOOKS SUCCESSFUL")
    if name.startswith("test:m1-production"):
        fu3 = [ln for ln in t.splitlines() if "FU3-" in ln and ("PASS" in ln or "FAIL" in ln)]
        print("\n".join(fu3))
