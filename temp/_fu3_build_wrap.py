
import subprocess, os
from pathlib import Path
os.chdir(r"D:\POJU\pojulife")
pnpm = r"C:\Users\13306\AppData\Roaming\npm\pnpm.cmd"
log = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.txt")
exitf = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.exit")
with log.open("a", encoding="utf-8", errors="replace") as f:
    p = subprocess.run([pnpm, "build"], stdout=f, stderr=subprocess.STDOUT)
exitf.write_text(str(p.returncode), encoding="utf-8")
