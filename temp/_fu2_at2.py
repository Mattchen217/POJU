lines = open("lib/poju/decision-intake/adaptive-turn.ts", encoding="utf-8").read().splitlines()
for i in range(220, 600):
    print(f"{i+1:4d}: {lines[i]}")
