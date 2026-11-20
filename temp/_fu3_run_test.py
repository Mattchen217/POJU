import subprocess, sys, os
os.chdir(r"D:\POJU\pojulife")
# Quick unused / syntax: tsc noEmit can wait. First run the target test.
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
log = r"D:\POJU\pojulife\temp\out_m24r2fu3_m1adaptive.txt"
env = os.environ.copy()
env["PYTHONIOENCODING"] = "utf-8"
with open(log, "w", encoding="utf-8", errors="replace") as f:
    p = subprocess.run(
        [pnpm, "test:m1-production-adaptive-question-loop"],
        stdout=f,
        stderr=subprocess.STDOUT,
        env=env,
        cwd=r"D:\POJU\pojulife",
    )
print("exit", p.returncode)
print("log", log)
