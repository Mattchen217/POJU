lines = open("lib/poju/decision-intake/scope-budget.ts", encoding="utf-8").read().splitlines()
for i in range(100, 150):
    if i < len(lines):
        print(f"{i+1:4d}: {lines[i]}")
