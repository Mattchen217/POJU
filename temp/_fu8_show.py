from pathlib import Path
lines=Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
for a,b in [(2770,2820),(2845,2895),(2940,3010),(3288,3320),(3788,3820),(4450,4485),(4830,4855)]:
    print("="*20, a, b, "="*20)
    for i in range(a,b+1):
        print(f"{i}:{lines[i-1]}")
    print()
