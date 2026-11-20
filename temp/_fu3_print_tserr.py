import sys, os, time
sys.stdout.reconfigure(encoding="utf-8")
os.chdir(r"D:\POJU\pojulife")
# print around line 1287
t=open("lib/poju/decision-intake/adaptive-turn.ts",encoding="utf-8").read().splitlines()
for j in range(1260, 1310):
    print(f"{j+1}:{t[j]}")
print("---- build size ----")
import pathlib
p=pathlib.Path("temp/out_m24r2fu3_final_build.txt")
print(p.stat().st_size if p.exists() else "missing")
