lines = open("lib/poju/decision-intake/adaptive-turn.ts", encoding="utf-8").read().splitlines()
# print 1-220 (imports + start of runAdaptive)
for i in range(0, 220):
    print(f"{i+1:4d}: {lines[i]}")
