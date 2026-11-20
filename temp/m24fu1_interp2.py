from pathlib import Path
p = Path("lib/poju/decision-intake/types.ts")
t = p.read_text(encoding="utf-8")
old = '  interpreter: "deterministic_m1_v1";'
new = '  /** Current writers use deterministic_m2_4_r1; m1_v1 retained for historical session reads. */\n  interpreter: "deterministic_m1_v1" | "deterministic_m2_4_r1";'
if old not in t:
    raise SystemExit('not found')
p.write_text(t.replace(old, new, 1), encoding='utf-8')
print('ok')
