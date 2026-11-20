from pathlib import Path
lines=Path("lib/poju/decision-intake/adaptive-turn.ts").read_text(encoding="utf-8").splitlines()
for i,line in enumerate(lines,1):
    if "pendingUnresolved" in line or "finishPendingFromEvent" in line or "skipped_reason" in line or "no_writes" in line or "If no grounded" in line:
        print(f"{i}:{line}")
