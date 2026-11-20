import sys, subprocess, os, time
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
# wmic or powershell process commandline
try:
    out = subprocess.check_output(
        'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine,WorkingSetSize,UserModeTime /FORMAT:LIST',
        shell=True, text=True, errors="replace")
    print(out[:4000])
except Exception as e:
    print("wmic failed", e)
    out = subprocess.check_output(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name=\'node.exe\'\\" | Select-Object ProcessId,CommandLine | Format-List"',
        shell=True, text=True, errors="replace")
    print(out[:4000])

# newest files in .next
nxt = Path(r"D:\POJU\pojulife\.next")
if nxt.exists():
    files = sorted(nxt.rglob("*"), key=lambda p: p.stat().st_mtime if p.exists() and p.is_file() else 0, reverse=True)
    print("newest .next files:")
    for p in files[:8]:
        if p.is_file():
            print(time.strftime("%H:%M:%S", time.localtime(p.stat().st_mtime)), p.stat().st_size, p)
else:
    print("no .next")

# python processes
try:
    outp = subprocess.check_output('wmic process where "name=\'python.exe\'" get ProcessId,CommandLine /FORMAT:LIST', shell=True, text=True, errors="replace")
    print("PYTHON:")
    print(outp[:3000])
except Exception as e:
    print("py list failed", e)
