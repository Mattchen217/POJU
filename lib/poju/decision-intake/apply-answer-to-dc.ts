/**
 * Apply validated AnswerEvent writes onto formal Decision Context.
 * Never auto-confirm. Same-turn replay is idempotent. Conflicts stay open.
 * M2.4-R1: related_dir_ids + fact_roles matching; correction/contradiction append
 * independent facts; open Conflict only with clear conflicting evidence.
 * M2.4-R1-FU1: conservative conflict evidence — different text alone is not a conflict;
 * correction vs contradiction separated; never auto-close open Conflicts.
 */

import { buildRealityFact } from "@/lib/poju/decision-context/fact-combination";
import { reaggregateDirsOnSession } from "@/lib/poju/decision-context/na-validation-from-session";
import type {
  Constraint,
  DecisionContext,
  RealityFact,
} from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
import type { AnswerClass, AnswerEvent } from "./types";

export type ApplyAnswerResult = {
  session: POJUSessionState;
  applied: boolean;
  skipped_reason?: string;
  fact_ids_written: string[];
  constraint_ids_written: string[];
};

function alreadyMapped(dc: DecisionContext, turnId: string): boolean {
  if (dc.reality_facts.some((f) => f.source_turn_id === turnId)) return true;
  if (dc.constraints.some((c) => c.source_turn_id === turnId)) return true;
  return false;
}

function writeAlreadyPresent(
  dc: DecisionContext,
  turnId: string,
  kind: "reality_fact" | "constraint",
  statement: string,
): boolean {
  const norm = normalizeComparable(statement);
  if (kind === "reality_fact") {
    return dc.reality_facts.some(
      (f) =>
        f.source_turn_id === turnId &&
        normalizeComparable(f.statement) === norm,
    );
  }
  return dc.constraints.some(
    (c) =>
      c.source_turn_id === turnId &&
      normalizeComparable(c.statement) === norm,
  );
}

function uniqueRecordId(
  prefix: string,
  turnId: string,
  index: number,
  existing: Set<string>,
): string {
  const base = `${prefix}${turnId}_${index}`.slice(0, 80);
  if (!existing.has(base)) return base;
  let n = 1;
  while (true) {
    const candidate = `${prefix}${turnId}_${index}_p${n}`.slice(0, 80);
    if (!existing.has(candidate)) return candidate;
    n += 1;
  }
}

function normalizeComparable(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /^(更正一下|更正|纠正|之前说错了|说错了|之前说的不准确|actually\s+i\s+meant)[:：,\s]*/i,
      "",
    )
    .replace(/[\s，,。．.!！？?；;、]/g, "")
    .trim();
}

function findRelatedOldFacts(
  realityFacts: RealityFact[],
  relatedDirIds: string[],
  factRoles: string[],
): RealityFact[] {
  return realityFacts.filter((fact) => {
    // Unknown / declined / not_applicable are not propositions
    // and cannot be used as the opposing side of a Conflict.
    if (
      fact.status === "unknown" ||
      fact.status === "declined" ||
      fact.status === "not_applicable"
    ) {
      return false;
    }

    const dirs = fact.related_dir_ids ?? [];
    if (!relatedDirIds.some((dirId) => dirs.includes(dirId))) {
      return false;
    }

    // Require an actual shared role for conflict evidence.
    // Missing historical role metadata is insufficient evidence.
    const oldRoles = fact.fact_roles ?? [];
    if (oldRoles.length === 0 || factRoles.length === 0) {
      return false;
    }

    return oldRoles.some((role) => factRoles.includes(role));
  });
}

/** Explicit contradiction / denial-of-prior language (conservative list). */
const EXPLICIT_CONTRADICTION_LANG_RE =
  /(与之前不一致|与之前说法矛盾|之前记录错了|之前说的不是事实|实际情况与之前相反|之前说的不准确|说的不准确|跟之前(说的|记录)?不一致|与之前不符|互相矛盾|矛盾了|冲突了|actually\s+that'?s\s+wrong|that\s+conflicts)/i;

/**
 * Same fact-dimension mutual exclusion (deterministic; not NLI).
 * Different time points / scopes / mere wording differences are NOT conflicts.
 */
function hasMutualExclusionOnSameDimension(
  oldStatement: string,
  newStatement: string,
): boolean {
  const a = oldStatement;
  const b = newStatement;

  // Different explicit calendar years → treat as time-scoped, not same-time conflict.
  const yearsA = new Set(a.match(/20\d{2}/g) ?? []);
  const yearsB = new Set(b.match(/20\d{2}/g) ?? []);
  if (yearsA.size > 0 && yearsB.size > 0) {
    const overlap = [...yearsA].some((y) => yearsB.has(y));
    if (!overlap) return false;
  }

  type Pair = { pos: RegExp; neg: RegExp };
  const pairs: Pair[] = [
    // 有 / 没有 (existence)
    {
      pos: /(还有|有一份|有\s*|存在|具备)(?!没有)/,
      neg: /(没有|无|不存在|不具备)/,
    },
    // 接受 / 拒绝
    { pos: /(接受|同意)/, neg: /(拒绝|不接受|不同意)/ },
    // 在职 / 已离职 — only when no distinct year scopes (handled above)
    { pos: /(仍在职|目前在职|在职|还在工作)/, neg: /(已经离职|已离职|离职了|不在职)/ },
    // 单一选项 / 多个选项 (same scope)
    {
      pos: /(只有一个选项|只有一个方案|可选方案只有|只有[^，。]{0,12})/,
      neg: /(还有|多个选项|两个选项|不是只有|还可以)/,
    },
  ];

  for (const { pos, neg } of pairs) {
    const aPos = pos.test(a);
    const aNeg = neg.test(a);
    const bPos = pos.test(b);
    const bNeg = neg.test(b);
    if ((aPos && bNeg) || (aNeg && bPos)) return true;
  }
  return false;
}

/**
 * Conservative conflict evidence.
 * - correction: only when mutual exclusion on the same fact dimension is clear.
 * - contradiction: explicit contradiction language OR mutual exclusion; same DIR/role.
 * Different text alone is never enough. Time changes / supplements are not conflicts.
 */
function selectConflictingOldFacts(input: {
  classification: AnswerClass;
  rawText: string;
  newStatement: string;
  oldFacts: RealityFact[];
}): RealityFact[] {
  const { classification, rawText, newStatement, oldFacts } = input;
  if (oldFacts.length === 0) return [];

  const explicitLang = EXPLICIT_CONTRADICTION_LANG_RE.test(rawText);
  const out: RealityFact[] = [];

  for (const f of oldFacts) {
    const mutex = hasMutualExclusionOnSameDimension(f.statement, newStatement);
    if (classification === "correction") {
      // Default append-only; Conflict only with clear mutual exclusion.
      if (mutex) out.push(f);
      continue;
    }
    if (classification === "contradiction") {
      // Explicit contradiction language may enter evaluation; still require same-topic
      // related old fact (already filtered) and either explicit lang or mutex.
      if (explicitLang || mutex) out.push(f);
      continue;
    }
  }
  return out;
}

export async function applyAnswerEventToSessionDc(
  session: POJUSessionState,
  event: AnswerEvent,
  opts?: { now?: string; allow_incremental_same_turn?: boolean },
): Promise<ApplyAnswerResult> {
  const dc = session.decision_context;
  if (!dc || dc.status !== "draft") {
    return {
      session,
      applied: false,
      skipped_reason: "no_draft_dc",
      fact_ids_written: [],
      constraint_ids_written: [],
    };
  }
  const turnId = event.client_turn_id.trim();
  if (!turnId) {
    return {
      session,
      applied: false,
      skipped_reason: "missing_source_turn",
      fact_ids_written: [],
      constraint_ids_written: [],
    };
  }
  const persistableWrites = event.proposed_writes.filter(
    (w): w is typeof w & { kind: "reality_fact" | "constraint" } =>
      w.kind === "reality_fact" || w.kind === "constraint",
  );
  const incrementalWrites = persistableWrites.filter(
    (w) => !writeAlreadyPresent(dc, turnId, w.kind, w.statement),
  );
  // Default: same source_turn_id is fully mapped (ordinary replay).
  // Incremental same-turn writes are only allowed for pending role-resolution
  // follow-ups (statements not yet written). Do not change Constraint
  // verification_level hardcoding.
  if (alreadyMapped(dc, turnId)) {
    if (!opts?.allow_incremental_same_turn || incrementalWrites.length === 0) {
      return {
        session,
        applied: false,
        skipped_reason: "turn_already_mapped",
        fact_ids_written: [],
        constraint_ids_written: [],
      };
    }
  }
  if (
    event.classification === "off_topic" ||
    event.classification === "invalid_input" ||
    event.proposed_writes.length === 0
  ) {
    return {
      session,
      applied: false,
      skipped_reason:
        event.classification === "off_topic"
          ? "off_topic"
          : event.classification === "invalid_input"
            ? "invalid_input"
            : "no_writes",
      fact_ids_written: [],
      constraint_ids_written: [],
    };
  }

  const now = opts?.now ?? new Date().toISOString();
  const reality_facts = [...dc.reality_facts];
  const constraints = [...dc.constraints];
  // Never auto-clear open Conflicts by appending a new fact.
  const conflicts = [...dc.conflicts];
  const fact_ids_written: string[] = [];
  const constraint_ids_written: string[] = [];

  const existingFactIds = new Set(reality_facts.map((f) => f.fact_id));
  const existingConstraintIds = new Set(constraints.map((c) => c.constraint_id));

  for (let i = 0; i < event.proposed_writes.length; i++) {
    const w = event.proposed_writes[i]!;
    if (w.kind === "reality_fact" || w.kind === "constraint") {
      if (writeAlreadyPresent(dc, turnId, w.kind, w.statement)) {
        continue;
      }
    }
    if (w.kind === "reality_fact") {
      // Preserve unknown/declined; never promote to confirmed here (E1 only).
      const status =
        w.status === "confirmed"
          ? "unverified"
          : w.status === "unknown" || w.status === "declined"
            ? w.status
            : w.status;
      const verification_level =
        status === "unknown" || status === "declined"
          ? "none"
          : w.verification_level === "none"
            ? "user_asserted"
            : w.verification_level;
      const factId = uniqueRecordId("fact_m1_", turnId, i, existingFactIds);
      existingFactIds.add(factId);
      const fact: RealityFact = buildRealityFact({
        fact_id: factId,
        statement: w.statement.slice(0, 500),
        status,
        verification_level,
        source_stage: "collecting",
        source_turn_id: turnId,
        has_user_confirm_event: false,
        fact_roles: w.fact_roles,
        related_dir_ids: w.related_dir_ids,
        updated_at: now,
      });

      if (
        event.classification === "correction" ||
        event.classification === "contradiction"
      ) {
        const related = findRelatedOldFacts(
          reality_facts,
          w.related_dir_ids,
          w.fact_roles,
        );
        const conflicting = selectConflictingOldFacts({
          classification: event.classification,
          rawText: event.raw_text,
          newStatement: w.statement,
          oldFacts: related,
        });
        if (conflicting.length > 0) {
          conflicts.push({
            conflict_id: `cf_m1_${turnId}_${i}`.slice(0, 80),
            fact_ids: [...conflicting.map((f) => f.fact_id), fact.fact_id],
            conflict_field: "statement",
            statements_snapshot: [
              ...conflicting.map((f) => f.statement),
              fact.statement,
            ],
            source_refs: [
              ...conflicting.map((f) => ({
                fact_id: f.fact_id,
                source_stage: f.source_stage,
                source_turn_id: f.source_turn_id,
              })),
              {
                fact_id: fact.fact_id,
                source_stage: fact.source_stage,
                source_turn_id: fact.source_turn_id,
              },
            ],
            state: "open",
            resolution: null,
            user_confirmation: false,
            affects_preferred_path: true,
            updated_at: now,
          });
        }
      }

      reality_facts.push(fact);
      fact_ids_written.push(fact.fact_id);
    } else if (w.kind === "constraint") {
      const constraintId = uniqueRecordId("cst_m1_", turnId, i, existingConstraintIds);
      existingConstraintIds.add(constraintId);
      const c: Constraint = {
        constraint_id: constraintId,
        statement: w.statement.slice(0, 500),
        category: w.constraint_category ?? "responsibility",
        status: "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: turnId,
        rigidity: w.rigidity ?? "hard",
        user_confirmed: false,
        updated_at: now,
        related_dir_ids: w.related_dir_ids,
      };
      constraints.push(c);
      constraint_ids_written.push(c.constraint_id);
    }
  }

  if (fact_ids_written.length === 0 && constraint_ids_written.length === 0) {
    return {
      session,
      applied: false,
      skipped_reason: "no_legal_writes",
      fact_ids_written: [],
      constraint_ids_written: [],
    };
  }

  const dirs = await reaggregateDirsOnSession(session, dc.dirs, {
    realityFacts: reality_facts,
    constraints,
    conflicts,
    nowIso: now,
  });

  return {
    session: {
      ...session,
      decision_context: {
        ...dc,
        reality_facts,
        constraints,
        conflicts,
        dirs,
        updated_at: now,
        version: (dc.version ?? 1) + 1,
      },
    },
    applied: true,
    fact_ids_written,
    constraint_ids_written,
  };
}
