files = [
    "lib/poju/decision-intake/answer-interpretation.ts",
    "lib/poju/decision-intake/types.ts",
    "lib/poju/decision-intake/adaptive-turn.ts",
    "lib/poju/collecting-dc-turn.ts",
    "lib/poju/agent.ts",
    "scripts/test-m1-production-adaptive-question-loop.ts",
]
for f in files:
    with open(f, encoding="utf-8") as fh:
        print(sum(1 for _ in fh), f)
