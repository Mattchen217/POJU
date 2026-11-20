lines = open("lib/poju/decision-intake/apply-answer-to-dc.ts", encoding="utf-8").read().splitlines()
for i in range(224, len(lines)):
    print(f"{i+1:4d}: {lines[i]}")
