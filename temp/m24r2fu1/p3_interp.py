# interp patch
from pathlib import Path
import os
root = Path(os.environ.get("POJU_ROOT", os.getcwd()))
path = root / "lib/poju/decision-intake/answer-interpretation.ts"
text = path.read_text(encoding="utf-8")

def repl(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f"missing: {label}")
    if text.count(old) != 1:
        raise SystemExit(f"ambiguous ({text.count(old)}): {label}")
    text = text.replace(old, new, 1)
    print("ok", label)

repl(
"""export function activeTargets(session: POJUSessionState): {
  dir_ids: string[];
  ddr_ids: string[];
  direction_id?: string;
  fact_roles: string[];
  auth_error?: "missing_authorized_fact_roles" | "missing_authorized_answer_target";
} {
  const understanding = session.decision_understanding;
  const lastSent = understanding?.last_sent_question;
  const plan =
    understanding?.next_question_plan ?? session.adaptive_ask_plan ?? null;

  if (lastSent && (lastSent.dir_ids.length > 0 || lastSent.ddr_ids.length > 0)) {
    let roles = roleCodesToRoles(lastSent.fact_role_codes);
    if (roles.length === 0) {
      // Historical session: restore ONLY when next_question_plan.plan_id matches exactly.
      const nqp = understanding?.next_question_plan ?? null;
      if (
        nqp &&
        nqp.plan_id === lastSent.plan_id &&
        Array.isArray(nqp.fact_role_codes) &&
        nqp.fact_role_codes.length > 0
      ) {
        roles = roleCodesToRoles(nqp.fact_role_codes);
      }
    }
    if (roles.length === 0) {
      return {
        dir_ids: [],
        ddr_ids: [],
        fact_roles: [],
        auth_error: "missing_authorized_fact_roles",
      };
    }
    return {
      dir_ids: [...lastSent.dir_ids],
      ddr_ids: [...lastSent.ddr_ids],
      direction_id: lastSent.direction_id,
      fact_roles: roles,
    };
  }

  if (plan && (plan.dir_ids.length > 0 || plan.ddr_ids.length > 0)) {
    const fromCodes = roleCodesToRoles(plan.fact_role_codes);
    if (fromCodes.length === 0) {
      return {
        dir_ids: [],
        ddr_ids: [],
        fact_roles: [],
        auth_error: "missing_authorized_fact_roles",
      };
    }
    return {
      dir_ids: [...plan.dir_ids],
      ddr_ids: [...plan.ddr_ids],
      direction_id: plan.direction_id,
      fact_roles: fromCodes,
    };
  }

  return {
    dir_ids: [],
    ddr_ids: [],
    fact_roles: [],
    auth_error: "missing_authorized_answer_target",
  };
}
""",
"""export function activeTargets(session: POJUSessionState): {
  dir_ids: string[];
  ddr_ids: string[];
  direction_id?: string;
  fact_roles: string[];
  /** Full actually-sent Plan role codes; never expanded from Blueprint.required_fact_roles. */
  fact_role_codes: string[];
  auth_error?: "missing_authorized_fact_roles" | "missing_authorized_answer_target";
} {
  const understanding = session.decision_understanding;
  const lastSent = understanding?.last_sent_question;
  const plan =
    understanding?.next_question_plan ?? session.adaptive_ask_plan ?? null;
  const missingRoles = {
    dir_ids: [] as string[],
    ddr_ids: [] as string[],
    fact_roles: [] as string[],
    fact_role_codes: [] as string[],
    auth_error: "missing_authorized_fact_roles" as const,
  };
  const missingTarget = {
    dir_ids: [] as string[],
    ddr_ids: [] as string[],
    fact_roles: [] as string[],
    fact_role_codes: [] as string[],
    auth_error: "missing_authorized_answer_target" as const,
  };

  if (lastSent && (lastSent.dir_ids.length > 0 || lastSent.ddr_ids.length > 0)) {
    let codes = lastSent.fact_role_codes ? [...lastSent.fact_role_codes] : [];
    if (codes.length === 0) {
      // Historical session: restore ONLY when next_question_plan.plan_id matches exactly.
      const nqp = understanding?.next_question_plan ?? null;
      if (
        nqp &&
        nqp.plan_id === lastSent.plan_id &&
        Array.isArray(nqp.fact_role_codes) &&
        nqp.fact_role_codes.length > 0
      ) {
        codes = [...nqp.fact_role_codes];
      }
    }
    const roles = roleCodesToRoles(codes);
    if (roles.length === 0) return missingRoles;
    return {
      dir_ids: [...lastSent.dir_ids],
      ddr_ids: [...lastSent.ddr_ids],
      direction_id: lastSent.direction_id,
      fact_roles: roles,
      fact_role_codes: codes,
    };
  }

  if (plan && (plan.dir_ids.length > 0 || plan.ddr_ids.length > 0)) {
    const codes = plan.fact_role_codes ? [...plan.fact_role_codes] : [];
    const fromCodes = roleCodesToRoles(codes);
    if (fromCodes.length === 0) return missingRoles;
    return {
      dir_ids: [...plan.dir_ids],
      ddr_ids: [...plan.ddr_ids],
      direction_id: plan.direction_id,
      fact_roles: fromCodes,
      fact_role_codes: codes,
    };
  }

  return missingTarget;
}
""",
"activeTargets fact_role_codes",
)

path.write_text(text, encoding="utf-8", newline="\n")
print("patched activeTargets")
