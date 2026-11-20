lines = open("scripts/test-m1-production-adaptive-question-loop.ts", encoding="utf-8").read().splitlines()
for i in range(0, 280):
    print(f"{i+1:4d}: {lines[i]}")
