import subprocess
from pathlib import Path
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
out = Path(r"D:\POJU\pojulife\temp\out_m24r2fu4_m1adaptive.txt")
cmd = [pnpm, "test:m1-production-adaptive-question-loop"]
with out.open("w", encoding="utf-8", errors="replace") as f:
    p = subprocess.run(cmd, cwd=r"D:\POJU\pojulife", stdout=f, stderr=subprocess.STDOUT)
print("exit", p.returncode)
print("bytes", out.stat().st_size)
