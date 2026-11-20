from pathlib import Path
p = Path(r"lib/poju/decision-intake/types.ts")
t = p.read_text(encoding="utf-8")
if "M2.4-R1" not in t:
    t = t.replace(
        " * Decision Intake 2.0 — Mainline M1 types.\n",
        " * Decision Intake 2.0 — Mainline M1 types.\n * M2.4-R1: Phase 4 answer interpretation + gap-driven ask (contracts preserved).\n",
    )
    p.write_text(t, encoding="utf-8")
    print("types header updated")
else:
    print("types already tagged")
