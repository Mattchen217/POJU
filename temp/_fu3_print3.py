import sys
sys.stdout.reconfigure(encoding="utf-8")
t=open(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts",encoding="utf-8").read().splitlines()
for j in range(4017,4060):
    print(f"{j}:{t[j-1]}")
# index exports
idx=open(r"D:\POJU\pojulife\lib\poju\decision-intake\index.ts",encoding="utf-8").read()
print("\n===== index.ts =====")
print(idx)
