/**
 * Apply validated AnswerEvent writes onto formal Decision Context.
 * Never auto-confirm. Same-turn replay is idempotent. Conflicts stay open.
 * M2.4-R1: related_dir_ids + fact_roles matching; correction/contradiction append
 * independent facts; open Conflict only with clear conflicting evidence.
 */

import { buildRealityFact } from "@/lib/poju/decision-context/fact-combination";
import { reaggregateDirsOnSession } from "@/lib/poju/decision-context/na-validation-from-session";
import type {
  Constraint,
  DecisionContext,
  RealityFact,
} from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
import type { AnswerEvent } from "./types";

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

function normalizeComparable(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /^(更正一下|更正|纠正|之前说错了|说错了|actually\s+i\s+meant)[:：,\s]*/i,
      "",
    )
    .replace(/[\s，,。．.!！？?；;：:、]/g, "")
    .trim();
}

function rolesOverlap(a: string[] | undefined, b: string[]): boolean {
  if (!a || a.length === 0 || b.length === 0) {
    // If either side lacks roles, allow DIR-only related match.
    return true;
  }
  return a.some((r) => b.includes(r));
}

function findRelatedOldFacts(
  reality_facts: RealityFact[],
  relatedDirIds: string[],
  factRoles: string[],
): RealityFact[] {
  return reality_facts.filter((f) => {
    const dirs = f.related_dir_ids ?? [];
    const dirHit = relatedDirIds.some((d) => dirs.includes(d));
    if (!dirHit) return false;
    return rolesOverlap(f.fact_roles, factRoles);
  });
}

/** Clear conflict = related old fact with different substantive content. */
function hasClearConflictEvidence(
  oldFacts: RealityFact[],
  newStatement: string,
): RealityFact[] {
  const neu = normalizeComparable(newStatement);
  if (!neu) return [];
  return oldFacts.filter((f) => {
    const old = normalizeComparable(f.statement);
    if (!old) return false;
    if (old === neu) return false;
    // Ignore pure meta-correction with no new substance vs empty-ish
    if (neu.length < 2) return false;
    return true;
  });
}

export async function applyAnswerEventToSessionDc(
  session: POJUSessionState,
  event: AnswerEvent,
  opts?: { now?: string },
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
  if (alreadyMapped(dc, turnId)) {
    return {
      session,
      applied: false,
      skipped_reason: "turn_already_mapped",
      fact_ids_written: [],
      constraint_ids_written: [],
    };
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

  for (let i = 0; i < event.proposed_writes.length; i++) {
    const w = event.proposed_writes[i]!;
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
      const fact: RealityFact = buildRealityFact({
        fact_id: `fact_m1_${turnId}_${i}`.slice(0, 80),
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

      // correction / contradiction: append independent fact; open Conflict only
      // when related old facts clearly conflict (do not invent from the word alone).
      if (
        event.classification === "correction" ||
        event.classification === "contradiction"
      ) {
        const related = findRelatedOldFacts(
          reality_facts,
          w.related_dir_ids,
          w.fact_roles,
        );
        const conflicting = hasClearConflictEvidence(related, w.statement);
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
      const c: Constraint = {
        constraint_id: `cst_m1_${turnId}_${i}`.slice(0, 80),
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
