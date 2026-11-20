from pathlib import Path
# conflict lifecycle
p = Path("lib/poju/decision-context/conflict-lifecycle.ts")
print("=== conflict-lifecycle.ts ===")
print(p.read_text(encoding="utf-8"))
