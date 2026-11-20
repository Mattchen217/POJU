from pathlib import Path
t = Path(r"lib/poju/decision-intake/adaptive-turn.ts").read_text(encoding="utf-8")
idx = 0
while True:
    i = t.find("outcomeFromPlanResult", idx)
    if i < 0: break
    print("--- at", i, "---")
    print(t[i-80:i+280])
    print()
    idx = i+1
