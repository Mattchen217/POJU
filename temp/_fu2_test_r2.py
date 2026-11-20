lines = open("scripts/test-m1-production-adaptive-question-loop.ts", encoding="utf-8").read().splitlines()
print("===== 2689-2787 helpers =====")
for i in range(2688, 2787):
    print(f"{i+1:4d}: {lines[i]}")
print("\n===== 3458-end =====")
for i in range(3457, len(lines)):
    print(f"{i+1:4d}: {lines[i]}")
