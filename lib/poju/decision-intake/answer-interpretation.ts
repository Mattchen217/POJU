/**
 * M1 Answer Interpretation — structured classify before DC write / next ask.
 * M2.4-R1: context-aware classification; last_sent_question is the only answer target.
 * M2.4-R1-FU1: fact_role_codes from actually-sent Plan; never expand to DIR.required_fact_roles.
 * Never auto-confirm; never chart-as-fact.
 */

/** Phase 4: context-aware deterministic classifier (not full model interpretation). */
export const ANSWER_INTERPRETATION_VERSION = "deterministic_m2_4_r1" as const;

import type { POJUSessionState } from "@/lib/poju/types";
import type { AnswerClass, AnswerEvent, ProposedWrite } from "./types";

const UNKNOWN_RE =
  /^(i\s*don'?t\s*know|不知道|不清楚|不了解|没印象|不确定|unsure|no\s*idea)(\b|$|[!。！?\s])/i;
const DECLINED_RE =
  /^(不想说|不愿回答|不想回答|跳过|skip(\b|$)|decline(\b|$)|prefer\s*not|no\s*comment)/i;
const ESTIMATE_RE =
  /(大概|估计|大约|maybe|perhaps|about\s+\d|roughly|i\s*think|我觉得可能|可能是|左右)/i;
const CONSTRAINT_RE =
  /(预算|deadline|截止|必须|不能超过|hard\s*limit|budget|只能|不可逆|退出成本|责任上限|最晚|不得低于|不能低于)/i;
const CORRECTION_RE =
  /(更正|纠正|之前说错了|说错了|correction|actually\s+i\s+meant)/i;
const CONTRADICTION_RE =
  /(与之前不一致|与之前说法矛盾|之前记录错了|之前说的不是事实|实际情况与之前相反|跟之前(说的|记录)?不一致|与之前不符|互相矛盾|矛盾了|冲突了|之前说的不准确|说的不准确|actually\s+that'?s\s+wrong|that\s+conflicts)/i;
const OFF_TOPIC_RE =
  /^(今天天气|讲个笑话|tell\s+me\s+a\s+joke|无关)/i;

function roleCodesToRoles(codes: string[] | undefined | null): string[] {
  if (!codes || codes.length === 0) return [];
  return codes
    .map((c) => {
      const m = /\/role\/([^/]+)$/.exec(c);
      return m?.[1] ?? "";
    })
    .filter(Boolean);
}

/**
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

function classifyAnswer(input: {
  session: POJUSessionState;
  statement: string;
  target: ReturnType<typeof activeTargets>;
}): {
  cls: AnswerClass;
  notes: string[];
} {
  const t = input.statement.trim();
  const notes: string[] = [];

  // empty / invalid — keep CJK single-ack as invalid so they do not write DC
  if (!t || t.length < 2) return { cls: "invalid_input", notes: ["empty"] };

  // missing authorized target / roles — never guess DIR or expand roles
  if (input.target.auth_error === "missing_authorized_fact_roles") {
    return { cls: "invalid_input", notes: ["missing_authorized_fact_roles"] };
  }
  if (
    input.target.auth_error === "missing_authorized_answer_target" ||
    (input.target.dir_ids.length === 0 && input.target.ddr_ids.length === 0)
  ) {
    return { cls: "invalid_input", notes: ["missing_authorized_answer_target"] };
  }
  if (input.target.fact_roles.length === 0) {
    return { cls: "invalid_input", notes: ["missing_authorized_fact_roles"] };
  }

  // off_topic
  if (OFF_TOPIC_RE.test(t)) return { cls: "off_topic", notes: ["off_topic"] };

  // unknown (exact CJK tokens first; \b unreliable for CJK)
  if (
    t === "不知道" ||
    t === "不清楚" ||
    t === "不了解" ||
    t === "没印象" ||
    t === "不确定"
  ) {
    return { cls: "unknown", notes: ["user_unknown"] };
  }
  if (UNKNOWN_RE.test(t)) return { cls: "unknown", notes: ["user_unknown"] };

  // declined
  if (t === "不想说" || t === "不愿回答" || t === "不想回答" || t === "跳过") {
    return { cls: "declined", notes: ["user_declined"] };
  }
  if (DECLINED_RE.test(t)) return { cls: "declined", notes: ["user_declined"] };

  // explicit correction (before contradiction markers that may co-occur)
  if (CORRECTION_RE.test(t) && !CONTRADICTION_RE.test(t)) {
    return { cls: "correction", notes: ["correction"] };
  }

  // explicit contradiction
  if (CONTRADICTION_RE.test(t) || (CORRECTION_RE.test(t) && CONTRADICTION_RE.test(t))) {
    return { cls: "contradiction", notes: ["contradiction"] };
  }
  // "不是…而是" often contradiction with prior
  if (/不是.+而是/.test(t)) {
    return { cls: "contradiction", notes: ["contradiction_reframing"] };
  }

  // estimate / uncertain
  if (ESTIMATE_RE.test(t)) return { cls: "estimate", notes: ["estimate"] };

  // constraint language — clear_answer class; ProposedWrite becomes constraint
  if (CONSTRAINT_RE.test(t)) {
    notes.push("constraint_signal");
    return { cls: "clear_answer", notes };
  }

  // clear vs partial — content-based, not length-alone
  const hasConcrete =
    /\d/.test(t) ||
    /(方案|选项|公司|城市|家庭|责任|风险|期限|成本|收入|离职|留下)/.test(t);
  if (hasConcrete && t.length >= 6) {
    return { cls: "clear_answer", notes: ["clear"] };
  }
  if (t.length >= 4) {
    return { cls: "partial_answer", notes: ["partial"] };
  }
  // Too thin to be a fact write
  return { cls: "invalid_input", notes: ["too_thin"] };
}

/** Split one user turn into independent factual clauses (same source_turn_id). */
function splitIndependentFacts(statement: string): string[] {
  const cleaned = statement.trim();
  if (!cleaned) return [];
  // Soft split on clause separators / "另外/还有/以及"
  const parts = cleaned
    .split(/(?:[。；;！!？?\n]+|(?:另外|还有|以及|并且|同时)[,，\s]*)/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  if (parts.length >= 2) return parts;
  return [cleaned];
}

function stripMetaPrefix(text: string): string {
  return text
    .replace(
      /^(更正一下|更正|纠正|之前说错了|说错了|之前说的不准确|actually\s+i\s+meant)[:：,\s]*/i,
      "",
    )
    .trim();
}

function writesFor(
  cls: AnswerClass,
  statement: string,
  targets: ReturnType<typeof activeTargets>,
  notes: string[],
): ProposedWrite[] {
  const roles =
    targets.fact_roles.length > 0 ? targets.fact_roles : [];
  const dirs = targets.dir_ids;

  if (cls === "off_topic" || cls === "invalid_input") return [];
  if (roles.length === 0) return [];

  if (cls === "unknown") {
    return [
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "unknown",
        verification_level: "none",
        fact_roles: roles,
        related_dir_ids: dirs,
      },
    ];
  }
  if (cls === "declined") {
    return [
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "declined",
        verification_level: "none",
        fact_roles: roles,
        related_dir_ids: dirs,
      },
    ];
  }

  const wantsConstraint =
    notes.includes("constraint_signal") || CONSTRAINT_RE.test(statement);

  if (wantsConstraint && cls !== "estimate") {
    const constraintRoles = roles.includes("hard_constraint")
      ? roles
      : [...roles, "hard_constraint"];
    return [
      {
        kind: "constraint",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_asserted",
        fact_roles: constraintRoles,
        related_dir_ids: dirs,
        constraint_category: /预算|budget|钱|salary|cost|财务/i.test(statement)
          ? "financial"
          : /deadline|截止|时间|timing|最晚/i.test(statement)
            ? "time"
            : /不可逆|退出成本|exit/i.test(statement)
              ? "exit_cost"
              : "responsibility",
        rigidity: "hard",
      },
      // Companion fact so Intake role evidence can progress before E1 confirm.
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_asserted",
        fact_roles: constraintRoles,
        related_dir_ids: dirs,
      },
    ];
  }

  if (cls === "estimate") {
    return [
      {
        kind: "reality_fact",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_estimate",
        fact_roles: roles,
        related_dir_ids: dirs,
      },
    ];
  }

  // correction / contradiction / clear / partial — never confirmed without E1.
  // Multi-fact: one ProposedWrite per independent clause; same DIR/DDR/roles only.
  const clauses =
    cls === "correction" || cls === "contradiction"
      ? [stripMetaPrefix(statement) || statement]
      : splitIndependentFacts(statement);

  const uniqueClauses = Array.from(new Set(clauses.map((c) => c.slice(0, 500))));
  return uniqueClauses.map((clause) => ({
    kind: "reality_fact" as const,
    statement: clause,
    status: "unverified" as const,
    verification_level: "user_asserted" as const,
    fact_roles: roles,
    related_dir_ids: dirs,
  }));
}

/**
 * Interpret one user turn into an AnswerEvent (proposes writes; does not mutate DC).
 */
export function interpretUserAnswer(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now?: string;
}): AnswerEvent {
  const statement = input.statement.trim();
  const targets = activeTargets(input.session);
  const { cls, notes } = classifyAnswer({
    session: input.session,
    statement,
    target: targets,
  });
  const proposed_writes = writesFor(cls, statement, targets, notes);
  return {
    event_id: `ae_${input.source_turn_id}`.slice(0, 80),
    session_id: input.session.session_id,
    client_turn_id: input.source_turn_id,
    raw_text: statement.slice(0, 2000),
    classification: cls,
    targets: {
      dir_ids: targets.dir_ids,
      ddr_ids: targets.ddr_ids,
      direction_id: targets.direction_id,
    },
    proposed_writes,
    notes,
    interpreter: ANSWER_INTERPRETATION_VERSION,
  };
}
