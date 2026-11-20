from pathlib import Path
# AdaptiveQuestionPlan type for fact_role_codes
t = Path("lib/poju/decision-intake/types.ts").read_text(encoding="utf-8")
idx = t.find("AdaptiveQuestionPlan")
print(t[idx:idx+1200])
print("--- UnderstandingState ---")
idx2 = t.find("UnderstandingState")
print(t[idx2:idx2+1500])
