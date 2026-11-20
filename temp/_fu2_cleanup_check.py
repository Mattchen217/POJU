from pathlib import Path
text = Path("lib/poju/decision-intake/answer-interpretation.ts").read_text(encoding="utf-8")
print("roleCodesToRoles uses", text.count("roleCodesToRoles"))
# fix FU2-B regex if present
t = Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8")
print("bad regex", r"replace(/\\n/g" in t, "good regex", r"replace(/\n/g" in t)
# pending unused import
p = Path("lib/poju/decision-intake/pending-answer-resolution.ts").read_text(encoding="utf-8")
print("AnswerClass in pending", "AnswerClass" in p)
