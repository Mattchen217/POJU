from pathlib import Path
text = Path("lib/poju/decision-intake/answer-interpretation.ts").read_text(encoding="utf-8")
# find interpretUserAnswer
idx = text.find("export function interpretUserAnswer")
print("idx", idx)
print(text[idx:])
print("--- markers ---")
print("pushUnresolvedItem", "pushUnresolvedItem" in text)
print("unresolved_items: unresolvedItems", "unresolved_items: unresolvedItems" in text)
print("unlocated_role_code note structured", "reason: \"unlocated_role_code\"" in text)
print("unclear structured", "reason: \"unclear_certainty\"" in text)
print("est structured", "reason: \"estimated_constraint_not_persistable\"" in text)
