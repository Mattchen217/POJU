lines = open("scripts/test-m1-production-adaptive-question-loop.ts", encoding="utf-8").read().splitlines()
print("===== Case F replay 3360-3456 =====")
for i in range(3359, 3457):
    print(f"{i+1:4d}: {lines[i]}")
print("\n===== Case I 3581-3656 =====")
for i in range(3580, 3657):
    print(f"{i+1:4d}: {lines[i]}")
print("\n===== FU1 Case J 1607-1660 =====")
for i in range(1606, 1660):
    print(f"{i+1:4d}: {lines[i]}")
