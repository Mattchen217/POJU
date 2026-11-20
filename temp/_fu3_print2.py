import sys
sys.stdout.reconfigure(encoding="utf-8")
t=open(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts",encoding="utf-8").read().splitlines()
# authorizedFrom and FU2 helper start
for i,l in enumerate(t,1):
    if "function authorizedFrom" in l or "async function " in l and "fu2" in l.lower() or "function startNullRolePending" in l or "async function seedNullRole" in l or "pendingFromNullRole" in l:
        print(f"{i}:{l}")
# print 2620-2680 and 3820-3912 and last 20 lines
for a,b in [(2620,2678),(3820,3912),(4410,4431)]:
    print(f"\n========== {a}-{b} ==========")
    for j in range(a,min(b,len(t))+1):
        print(f"{j}:{t[j-1]}")
