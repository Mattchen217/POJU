from pathlib import Path

# --- 1. types.ts: add fact_role_codes to last_sent_question ---
p = Path("lib/poju/decision-intake/types.ts")
t = p.read_text(encoding="utf-8")
old = """  last_sent_question: {
    question_text: string;
    plan_id: string;
    direction_id: string;
    dir_ids: string[];
    ddr_ids: string[];
    turn_id: string;
  } | null;
};"""
new = """  last_sent_question: {
    question_text: string;
    plan_id: string;
    direction_id: string;
    dir_ids: string[];
    ddr_ids: string[];
    /** Roles authorized by the actually-sent Plan; optional on historical sessions. */
    fact_role_codes?: string[];
    turn_id: string;
  } | null;
};"""
if old not in t:
    raise SystemExit("types.ts last_sent_question block not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("types.ts OK")

# --- 2. adaptive-turn.ts: write fact_role_codes in attachAuthorizedAssistantQuestion ---
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
t = p.read_text(encoding="utf-8")
old = """      last_sent_question: {
        question_text: plan.question_text,
        plan_id: plan.plan_id,
        direction_id: plan.direction_id,
        dir_ids: plan.dir_ids,
        ddr_ids: plan.ddr_ids,
        turn_id: turnId,
      },"""
new = """      last_sent_question: {
        question_text: plan.question_text,
        plan_id: plan.plan_id,
        direction_id: plan.direction_id,
        dir_ids: plan.dir_ids,
        ddr_ids: plan.ddr_ids,
        // Must come from the actually-sent Plan — never inferred from DIR.required_fact_roles.
        fact_role_codes: [...plan.fact_role_codes],
        turn_id: turnId,
      },"""
if old not in t:
    raise SystemExit("attachAuthorized last_sent block not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("adaptive-turn.ts OK")
