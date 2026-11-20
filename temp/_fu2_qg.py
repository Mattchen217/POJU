# AdaptiveQuestionPlan construction in question-generation.ts
lines = open("lib/poju/decision-intake/question-generation.ts", encoding="utf-8").read().splitlines()
print("total", len(lines))
for i,l in enumerate(lines,1):
    if "plan_id" in l or "export function buildAdaptiveQuestionPlan" in l or "question_text:" in l or "budget_cost" in l or "return {" in l and i>1:
        if i < 250 or "plan_id" in l or "function build" in l:
            print(f"{i:4d}: {l}")
# find the object literal for the plan
print("\n----- exports in index -----")
idx = open("lib/poju/decision-intake/index.ts", encoding="utf-8").read().splitlines()
print("index lines", len(idx))
for i,l in enumerate(idx,1):
    if "answer-interpretation" in l or "adaptive-turn" in l or "activeTargets" in l or "AnswerEvent" in l:
        print(f"{i:4d}: {l}")
