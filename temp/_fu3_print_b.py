import sys
sys.stdout.reconfigure(encoding="utf-8")
t=open(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts",encoding="utf-8").read().splitlines()
# find FU3-B
for i,l in enumerate(t,1):
    if "FU3-B" in l or "same text" in l:
        print(f"{i}:{l}")
print("--- block ---")
start=next(i for i,l in enumerate(t) if "M2.4-R2-FU3-B" in l)
for j in range(start-5, start+80):
    print(f"{j+1}:{t[j]}")
