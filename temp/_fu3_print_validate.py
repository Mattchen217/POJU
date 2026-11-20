import sys
sys.stdout.reconfigure(encoding="utf-8")
t=open(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation-model.ts",encoding="utf-8").read().splitlines()
for j in range(360, 430):
    print(f"{j+1}:{t[j]}")
