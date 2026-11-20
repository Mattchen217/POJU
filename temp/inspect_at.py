from pathlib import Path
p = Path(r"lib/poju/decision-intake/adaptive-turn.ts")
t = p.read_text(encoding="utf-8")
for s in [
    "async function planFromState(",
    "if (!planResult.selected)",
    "scope_budget_reject:",
    'outcome: planned.plan ? "planned" : "ready_no_question"',
]:
    print(repr(s), "->", t.count(s))
idx = t.find("async function planFromState(")
end = t.find("/** Mark a plan as actually shown", idx)
print("planFromState span", idx, end, "len", end-idx if end>idx else None)
