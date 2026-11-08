/**
 * M1 Answer Interpretation — structured classify before DC write / next ask.
 * Deterministic v1: model draft optional later; never auto-confirm; never chart-as-fact.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import type { AnswerClass, AnswerEvent, ProposedWrite } from "./types";

const UNKNOWN_RE =
  /^(i\s*don'?t\s*know|不知道|不清楚|不了解|没印象|unsure|no\s*idea)(\b|$|[!。！？.\s])/i;
const DECLINED_RE =
  /^(不想说|不愿回答|跳过|skip(\b|$)|decline(\b|$)|prefer\s*not|no\s*comment)/i;
const ESTIMATE_RE =
  /(大概|估计|大约|maybe|perhaps|about\s+\d|roughly|i\s*think|我觉得|可能)/i;
const CONSTRAINT_RE =
  /(预算|deadline|截止|必须|不能超过|hard\s*limit|budget|只能|必须在)/i;
const CORRECTION_RE =
  /(更正|纠正|说错了|correction|actually\s+i\s+meant|不是.*而是)/i;
const OFF_TOPIC_RE =
  /^(今天天气|讲个笑话|tell\s+me\s+a\s+joke|无关)/i;

function activeTargets(session: POJUSessionState): {
  dir_ids: string[];
  ddr_ids: string[];
  direction_id?: string;
  fact_roles: string[];
} {
  const plan = session.decision_understanding?.next_question_plan
    ?? session.adaptive_ask_plan
    ?? null;
  if (plan) {
    return {
      dir_ids: [...plan.dir_ids],
      ddr_ids: [...plan.ddr_ids],
      direction_id: plan.direction_id,
      fact_roles: plan.fact_role_codes
        .map((c) => {
          const m = /\/role\/([^/]+)$/.exec(c);
          return m?.[1] ?? "answer";
        })
        .filter(Boolean),
    };
  }
  const selected = session.intake_ask_plan?.selected_candidate_id;
  const dc = session.decision_context;
  if (selected && dc) {
    const m = /^cq_dir_(.+)$/.exec(selected);
    if (m?.[1]) {
      const dir = dc.dirs.find((d) => d.dir_id === m[1]);
      const roles = dir?.required_fact_roles?.length
        ? dir.required_fact_roles
        : ["situation"];
      return {
        dir_ids: [m[1]],
        ddr_ids: [`DDR_FOR_${m[1]}`],
        fact_roles: roles,
      };
    }
  }
  // Fallback: first unknown/conflict active DIR (never invent).
  const open = dc?.dirs.find(
    (d) =>
      d.id_lifecycle === "active" &&
      (d.current_state === "unknown" || d.current_state === "conflict"),
  );
  if (open) {
    return {
      dir_ids: [open.dir_id],
      ddr_ids: [`DDR_FOR_${open.dir_id}`],
      fact_roles: open.required_fact_roles?.length
        ? open.required_fact_roles
        : ["situation"],
    };
  }
  return { dir_ids: [], ddr_ids: [], fact_roles: ["collecting_user_statement"] };
}

function classify(text: string): { cls: AnswerClass; notes: string[] } {
  const t = text.trim();
  const notes: string[] = [];
  if (t.length < 2) return { cls: "invalid_input", notes: ["empty"] };
  if (OFF_TOPIC_RE.test(t)) return { cls: "off_topic", notes: ["off_topic"] };
  // Exact Chinese tokens first (word-boundary \b is unreliable for CJK).
  if (t === "不知道" || t === "不清楚" || t === "不了解" || t === "没印象") {
    return { cls: "unknown", notes: ["user_unknown"] };
  }
  if (t === "不想说" || t === "不愿回答" || t === "跳过") {
    return { cls: "declined", notes: ["user_declined"] };
  }
  if (UNKNOWN_RE.test(t)) return { cls: "unknown", notes: ["user_unknown"] };
  if (DECLINED_RE.test(t)) return { cls: "declined", notes: ["user_declined"] };
  if (CORRECTION_RE.test(t)) return { cls: "correction", notes: ["correction"] };
  if (CONSTRAINT_RE.test(t)) {
    notes.push("constraint_signal");
    return { cls: "clear_answer", notes };
  }
  if (ESTIMATE_RE.test(t)) return { cls: "estimate", notes: ["estimate"] };
  if (t.length < 12) return { cls: "vague_answer", notes: ["short"] };
  return { cls: "clear_answer", notes: ["clear"] };
}

function writesFor(
  cls: AnswerClass,
  statement: string,
  targets: ReturnType<typeof activeTargets>,
): ProposedWrite[] {
  const roles =
    targets.fact_roles.length > 0 ? targets.fact_roles : ["situation"];
  const dirs = targets.dir_ids;

  if (cls === "off_topic" || cls === "invalid_input") return [];
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
  if (cls === "estimate" || cls === "vague_answer") {
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
  if (CONSTRAINT_RE.test(statement)) {
    return [
      {
        kind: "constraint",
        statement: statement.slice(0, 500),
        status: "unverified",
        verification_level: "user_asserted",
        fact_roles: roles.includes("hard_constraint")
          ? roles
          : [...roles, "hard_constraint"],
        related_dir_ids: dirs,
        constraint_category: /预算|budget|钱|salary|cost/i.test(statement)
          ? "financial"
          : /deadline|截止|时间|timing/i.test(statement)
            ? "time"
            : "responsibility",
        rigidity: "hard",
      },
    ];
  }
  // clear_answer / correction / supplement — never confirmed without E1.
  return [
    {
      kind: "reality_fact",
      statement: statement.slice(0, 500),
      status: "unverified",
      verification_level: "user_asserted",
      fact_roles: roles,
      related_dir_ids: dirs,
    },
  ];
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
  const { cls, notes } = classify(statement);
  const targets = activeTargets(input.session);
  const proposed_writes = writesFor(cls, statement, targets);
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
    interpreter: "deterministic_m1_v1",
  };
}
