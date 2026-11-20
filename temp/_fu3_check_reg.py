import sys, subprocess, time
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
try:
    outp = subprocess.check_output('wmic process where "name=\'python.exe\'" get ProcessId,CommandLine /FORMAT:LIST', shell=True, text=True, errors="replace")
    print("PYTHON:")
    print(outp)
except Exception as e:
    print("wmic py failed", e)
s = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_summary.txt")
b = Path(r"D:\POJU\pojulife\temp\out_m24r2fu3_final_build.txt")
print("summary", s.exists(), "build", b.stat().st_size if b.exists() else 0)
print(b.read_text(encoding="utf-8", errors="replace")[:500] if b.exists() else "")
