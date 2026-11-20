import sys
sys.stdout.reconfigure(encoding="utf-8")
t=open(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts",encoding="utf-8").read().splitlines()
ranges=[(2360,2450),(2670,2820),(3440,3520),(3880,4431)]
out=[]
for a,b in ranges:
    out.append(f"\n========== {a}-{b} ==========")
    for j in range(a, min(b,len(t))+1):
        out.append(f"{j}:{t[j-1]}")
path=r"D:\POJU\pojulife\temp\_fu3_test_extract.txt"
open(path,"w",encoding="utf-8").write("\n".join(out))
print("wrote", path, "chars", sum(len(x) for x in out))
