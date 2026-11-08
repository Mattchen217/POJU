/**
 * IndexedDB seed for Intake R6 Freeze / Versioning / Delivery tests 閳?scripts/** only.
 * Must never be imported from lib/ or app/ production modules.
 *
 * Builds a sufficient draft DC strictly through production paths:
 *   createPOJUSession 閳?mutatePOJUSession (facts + Session E1)
 *   閳?declareDirNotApplicable (ACTIVE pair, Session Action + DC Classification/Evidence)
 *   閳?reaggregateDirsOnSession (production NaValidation builder) persisted via CAS.
 * No fixture NaValidation, no caller catalog. Lib modules are imported lazily so
 * test files can install browser globals + fake-indexeddb first.
 */

import type { ConfirmationEvent } from "@/lib/poju/decision-context/confirmation-event";
import type { DecisionContext, DIR, RealityFact } from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";

/** ACTIVE DIR N/A catalog v1 legal pair. */
export const ACTIVE_NA_DIR = "DIR-DEF-UNACCEPTABLE";
export const ACTIVE_NA_CODE = "explicit_no_hard_red_lines";
/** Ordinary DIR with no N/A path (known from a confirmed fact). */
export const NORMAL_DIR = "DIR-S8-NORMAL";

export type NaSeed = {
  sid: string;
  naFactId: string;
  normalFactId: string;
  declarationActionId: string;
};

export function seedFact(factId: string, dirId: string, turnId: string): RealityFact {
  return {
    fact_id: factId,
    statement: dirId === ACTIVE_NA_DIR ? "no hard red lines for this decision" : "six months of savings",
    status: "confirmed",
    verification_level: "user_asserted",
    source_stage: "user_supplement",
    source_turn_id: turnId,
    user_confirmed: true,
    fact_roles: ["situation"],
    related_dir_ids: [dirId],
  };
}

export function seedDir(dirId: string): DIR {
  return {
    dir_id: dirId,
    need: "need",
    why: "why",
    required_fact_roles: ["situation"],
    current_state: "unknown",
    partial_satisfaction: false,
    agenda_item_ids: [],
    id_lifecycle: "active",
    may_affect_p5_ranking: true,
  };
}

function e1(factId: string, turnId: string, at: string): ConfirmationEvent {
  return {
    event_id: `e1_${factId}`,
    target_type: "fact",
    fact_id: factId,
    source_turn_id: turnId,
    confirmation_turn_id: `${turnId}_b`,
    confirmation_action_id: `ca_${factId}`,
    event_type: "confirm_fact",
    actor: "user",
    confirmed_at: at,
    event_version: 1,
  };
}

/**
 * Seed a sufficient draft: NORMAL_DIR known; ACTIVE_NA_DIR n_a when `withNa`
 * (default) else known from its confirmed fact.
 */
export async function seedNaDraftSession(
  tag: string,
  now: string,
  opts: { withNa?: boolean } = {},
): Promise<NaSeed> {
  const { createPOJUSession } = await import("@/lib/poju/session-manager");
  const { mutatePOJUSession } = await import("@/lib/poju/session-mutation");
  const { declareDirNotApplicable } = await import("@/lib/poju/decision-context/na-declaration");
  const { reaggregateDirsOnSession } = await import(
    "@/lib/poju/decision-context/na-validation-from-session"
  );
  const { createDefaultControlPlane } = await import("@/lib/poju/decision-context/control-plane");

  const sid = await createPOJUSession({
    payment_id: `pay_s8_${tag}`,
    original_question: `s8 ${tag}`,
  });
  const naFactId = `fact_na_${tag}`;
  const normalFactId = `fact_ok_${tag}`;
  const declarationActionId = `na-act-${tag}`;

  const reaggregateNow = async (s: POJUSessionState): Promise<POJUSessionState> => {
    const dc = s.decision_context;
    if (!dc) throw new Error("seedNaDraftSession: DC missing");
    const dirs = await reaggregateDirsOnSession(s, dc.dirs, { nowIso: now });
    return { ...s, decision_context: { ...dc, dirs } };
  };

  await mutatePOJUSession(sid, {
    operation_id: `op_s8_seed_${tag}`,
    kind: "session_patch",
    bump_dc: true,
    apply: (latest): POJUSessionState => {
      const dc: DecisionContext = {
        context_id: `dc_${sid}`,
        version: 1,
        status: "draft",
        definition: {
          concrete_event: "Stay or leave",
          stakes: "Income",
          desired_outcome: null,
          decision_question: "Q",
          goal_priorities: [],
          unacceptable_outcomes: [],
        },
        reality_facts: [
          seedFact(naFactId, ACTIVE_NA_DIR, `t_na_${tag}`),
          seedFact(normalFactId, NORMAL_DIR, `t_ok_${tag}`),
        ],
        constraints: [],
        hypotheses: [],
        dirs: [seedDir(ACTIVE_NA_DIR), seedDir(NORMAL_DIR)],
        conflicts: [],
        content_hash: null,
        created_at: now,
        updated_at: now,
      };
      return ({
        ...latest,
        agent_v2: latest.agent_v2
          ? { ...latest.agent_v2, stall_offer_pending: false, delivery_mode: "full" }
          : latest.agent_v2,
        control_plane: createDefaultControlPlane("collecting_context"),
        confirmation_events: [
          e1(naFactId, `t_na_${tag}`, now),
          e1(normalFactId, `t_ok_${tag}`, now),
        ],
        decision_context: dc,
      });
    },
  });

  if (opts.withNa !== false) {
    await declareDirNotApplicable(sid, {
      operation_id: `op_s8_declare_${tag}`,
      declaration_action_id: declarationActionId,
      control_id: "na_declare",
      fact_id: naFactId,
      dir_id: ACTIVE_NA_DIR,
      na_condition_code: ACTIVE_NA_CODE,
      declaration_turn_id: `turn_na_${tag}`,
      dir_na_conditions: [],
      occurred_at: now,
    });
  }
  // Always reaggregate so confirmed facts yield known / n_a (withNa:false must not leave unknown).
  {
    const { loadPOJUSession } = await import("@/lib/poju/session-manager");
    const beforeReagg = await loadPOJUSession(sid);
    if (!beforeReagg) throw new Error("seedNaDraftSession: session missing before reagg");
    const afterReagg = await reaggregateNow(beforeReagg);
    await mutatePOJUSession(sid, {
      operation_id: `op_s8_reagg_${tag}`,
      kind: "session_patch",
      bump_dc: true,
      apply: () => afterReagg,
    });
  }
  return { sid, naFactId, normalFactId, declarationActionId };
}
