import sys
sys.stdout.reconfigure(encoding="utf-8")
t=open(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts",encoding="utf-8").read().splitlines()
for i,l in enumerate(t,1):
    low=l
    if any(s in low for s in ["hookFor", "startPending", "function setupFu", "async function seedMulti", "FU2 helper", "const legalCode", "function roleCode"]):
        print(f"{i}:{l[:220]}")
