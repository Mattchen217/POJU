from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
t = p.read_text(encoding="utf-8")
old = """function withUnderstanding(
  session: POJUSessionState,
  understanding: UnderstandingState,
  plan: AdaptiveQuestionPlan | null,
  askSnap: IntakeAskPlanSnapshot | null,
): POJUSessionState {"""
new = """function withUnderstanding(
  session: POJUSessionState,
  understanding: UnderstandingState,
  plan: AdaptiveQuestionPlan | null,
  askSnap: IntakeAskPlanSnapshot | null | undefined,
): POJUSessionState {"""
if old not in t:
    raise SystemExit("withUnderstanding signature not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8", newline="\n")
print("widened withUnderstanding askSnap")
