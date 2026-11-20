from pathlib import Path

p = Path("lib/poju/decision-intake/types.ts")
text = p.read_text(encoding="utf-8")
old = '''  entered_controlled_blueprint_update?: boolean;
  /** Original decision target retained while a goal change is pending or declined. */
  original_decision_target?: string | null;
};
'''
new = '''  entered_controlled_blueprint_update?: boolean;
  /** Original decision target retained while a goal change is pending or declined. */
  original_decision_target?: string | null;
  /** Follow-up turn that last resolved or confirmed a control item; used for replay. */
  last_resolved_turn_id?: string | null;
};
'''
assert old in text
p.write_text(text.replace(old, new, 1).replace("\r\n","\n"), encoding="utf-8", newline="\n")

p = Path("lib/poju/decision-intake/pending-intake-control.ts")
text = p.read_text(encoding="utf-8")
old = '''    entered_controlled_blueprint_update: false,
    original_decision_target,
'''
new = '''    entered_controlled_blueprint_update: false,
    original_decision_target,
    last_resolved_turn_id: null,
'''
assert old in text
text = text.replace(old, new, 1)

old = '''  const stillPending = Boolean(resolving);
  return {
    ...next,
    status: stillPending || next.entered_controlled_blueprint_update ? "pending" : "resolved",
    resolving_item_id: resolving?.item_id ?? null,
    clarification_plan: stillPending ? next.clarification_plan : next.clarification_plan,
    clarification_plan_id: stillPending ? next.clarification_plan_id : next.clarification_plan_id,
  };
'''
new = '''  const stillPending = Boolean(resolving);
  return {
    ...next,
    status: stillPending ? "pending" : "resolved",
    resolving_item_id: resolving?.item_id ?? null,
    clarification_plan: stillPending ? next.clarification_plan : null,
    clarification_plan_id: stillPending ? next.clarification_plan_id : null,
  };
'''
assert old in text
text = text.replace(old, new, 1)
p.write_text(text.replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("control type extras patched")
