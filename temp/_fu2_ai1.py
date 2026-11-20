from pathlib import Path
p = Path("lib/poju/decision-intake/answer-interpretation.ts")
text = p.read_text(encoding="utf-8")

text = text.replace(
    'import type { AnswerClass, AnswerEvent, ModelAnswerDraft, ProposedWrite } from "./types";',
    'import type { AnswerClass, AnswerEvent, ModelAnswerDraft, ProposedWrite, UnresolvedAnswerItem, UnresolvedAnswerReason } from "./types";',
    1,
)

old_active = '''/**
 * Current question is the ONLY answer-target authority.
 * Prefer last_sent_question (including its Plan fact_role_codes);
 * else current valid Plan. Never guess Blueprint-first DIR.
 * Never expand authorized roles to DIR.required_fact_roles.
 */
export function activeTargets(session: POJUSessionState): {
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
'''

new_active = '''const ROLE_CODE_RE = /^v1\\/dir\\/([^/]+)\\/role\\/([^/]+)$/;

/**
 * Validate a complete authorization set. Fail closed on malformed, empty,
 * duplicate, or last-sent DIR-mismatched codes. Do not filter bad items
 * and continue with the remainder.
 */
function validateAuthorizedRoleCodes(
  codes: string[],
  lastSentDirIds: string[],
): { ok: true; codes: string[]; roles: string[] } | { ok: false } {
  if (codes.length === 0) return { ok: false };
  const seen = new Set<string>();
  const out: string[] = [];
  const roles: string[] = [];
  for (const code of codes) {
    const match = ROLE_CODE_RE.exec(code);
    if (!match) return { ok: false };
    const dirId = match[1]!;
    const role = match[2]!;
    if (!role) return { ok: false };
    if (!lastSentDirIds.includes(dirId)) return { ok: false };
    if (seen.has(code)) return { ok: false };
    seen.add(code);
    out.push(code);
    roles.push(role);
  }
  if (out.length === 0 || roles.length === 0) return { ok: false };
  return { ok: true, codes: out, roles };
}

/**
 * Current question is the ONLY answer-target authority.
 * last_sent_question is the sole authorization source.
 * Never use next_question_plan or adaptive_ask_plan as a substitute
 * when last_sent_question is missing. Never derive from Blueprint.required_fact_roles.
 */
export function activeTargets(session: POJUSessionState): {
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
    const validated = validateAuthorizedRoleCodes(codes, lastSent.dir_ids);
    if (!validated.ok) return missingRoles;
    return {
      dir_ids: [...lastSent.dir_ids],
      ddr_ids: [...lastSent.ddr_ids],
      direction_id: lastSent.direction_id,
      fact_roles: validated.roles,
      fact_role_codes: validated.codes,
    };
  }

  return missingTarget;
}
'''

if old_active not in text:
    raise SystemExit("activeTargets block not found")
text = text.replace(old_active, new_active, 1)

# There will be a duplicate ROLE_CODE_RE later in the file. Remove the later const.
# After first replacement, the later `const ROLE_CODE_RE = ...` still exists.
later = '''const ROLE_CODE_RE = /^v1\\/dir\\/([^/]+)\\/role\\/([^/]+)$/;

/**
 * applyAnswerEventToSessionDc currently persists Constraint.verification_level
'''
later_fixed = '''/**
 * applyAnswerEventToSessionDc currently persists Constraint.verification_level
'''
if later not in text:
    raise SystemExit("later ROLE_CODE_RE not found")
text = text.replace(later, later_fixed, 1)

p.write_text(text, encoding="utf-8", newline="\n")
print("activeTargets rewritten; ROLE_CODE_RE deduped")
