lines = open("lib/poju/decision-intake/question-generation.ts", encoding="utf-8").read().splitlines()
for i in range(300, 430):
    print(f"{i+1:4d}: {lines[i]}")
