lines = open("scripts/test-m1-production-adaptive-question-loop.ts", encoding="utf-8").read().splitlines()
# find seedAnswerReadySession and hook helpers
for i,l in enumerate(lines,1):
    if "seedAnswerReadySession" in l or "function seed" in l or "interpretAnswerModel" in l or "role_code_hint" in l and "function" in l:
        print(f"{i:4d}: {l}")
# print around likely helper near R2 cases (~2700-2900 and 3200-3525)
print("\n----- search function definitions after 2600 -----")
for i,l in enumerate(lines[2599:], 2600):
    if l.startswith("    async function") or l.startswith("    function") or "seedAnswerReady" in l or l.startswith("    const seed"):
        print(f"{i:4d}: {l}")
