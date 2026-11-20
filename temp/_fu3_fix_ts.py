from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")
old = '''  if (
    parsed.choice.type === "constraint_confirm" &&
    !parsed.choice.confirmed
  ) {
    const nextReason = parsed.choice.still_uncertain
      ? "unclear_certainty"
      : "estimated_constraint_not_persistable";
    const updated: typeof pending = {
      ...pending,
      unresolved_items: pending.unresolved_items.map((item) =>
        item.item_id === resolving.item_id
          ? {
              ...item,
              reason: nextReason,
              certainty: parsed.choice.still_uncertain ? "unclear" : "estimated",
            }
          : item,
      ),
    };
'''
new = '''  if (
    parsed.choice.type === "constraint_confirm" &&
    !parsed.choice.confirmed
  ) {
    const stillUncertain = parsed.choice.still_uncertain;
    const nextReason = stillUncertain
      ? "unclear_certainty"
      : "estimated_constraint_not_persistable";
    const nextCertainty = stillUncertain ? "unclear" : "estimated";
    const updated: typeof pending = {
      ...pending,
      unresolved_items: pending.unresolved_items.map((item) =>
        item.item_id === resolving.item_id
          ? {
              ...item,
              reason: nextReason,
              certainty: nextCertainty,
            }
          : item,
      ),
    };
'''
assert old in text
p.write_text(text.replace(old, new), encoding="utf-8", newline="\n")
print("narrowing fix applied")
