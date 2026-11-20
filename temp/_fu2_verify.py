from pathlib import Path
for f in [
    "lib/poju/decision-intake/types.ts",
    "lib/poju/decision-intake/pending-answer-resolution.ts",
    "lib/poju/decision-intake/answer-interpretation.ts",
]:
    t = Path(f).read_text(encoding="utf-8")
    print(f, "lines", t.count("\n"), "pending_answer" in t or "UnresolvedAnswer" in t)
# show types around AnswerEvent and Pending
lines = Path("lib/poju/decision-intake/types.ts").read_text(encoding="utf-8").splitlines()
for i,l in enumerate(lines,1):
    if "UnresolvedAnswer" in l or "PendingAnswer" in l or l.startswith("export type AnswerEvent") or l.startswith("export type AdaptiveQuestionPlan"):
        print(f"{i}: {l}")
