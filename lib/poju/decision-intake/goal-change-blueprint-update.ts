/**
 * M2.4-R2 — formal Blueprint update for an explicitly confirmed goal change.
 *
 * The only path that changes the decision target. Preconditions: a pending
 * goal_change control item with a candidate target located in the user's raw
 * answer, and an explicit user confirmation of that exact item. The model
 * never edits the Blueprint and nothing here auto-confirms.
 *
 * Effects (one C1 commit): definition.decision_question → new target;
 * Blueprint scope recomputed from the new target with blueprint_version + 1;
 * the previous Blueprint appended to history; DIRs out of the new scope
 * deprecated (never deleted); facts that answered the old target marked
 * not_applicable (prior state kept in the change record); target-dependent
 * DIRs reopened; old Understanding / plan invalidated; change log appended.
 */

import { buildRealityFact, withDerivedUserConfirmed } from "@/lib/poju/decision-context/fact-combination";
import { reaggregateDirsOnSession } from "@/lib/poju/decision-context/na-validation-from-session";
import type { DIR, RealityFact } from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
import { FACT_STATEMENT_MAX_CHARS } from "./answer-interpretation";
import { ensureDecisionBlueprint } from "./blueprint";
import { updateControlItemStatus } from "./pending-intake-control";
import type {
  BlueprintChangeRecord,
  IntakeControlItem,
  PendingIntakeControl,
} from "./types";

/**
 * DIRs whose answers are defined relative to the decision target: evidence
 * collected under an earlier target cannot answer them for a new target.
 */
export const TARGET_DEPENDENT_DIR_IDS: ReadonlySet<string> = new Set([
  "DIR-DEF-QUESTION",
  "DIR-DEF-OUTCOME",
  "DIR-DEF-STAKES",
  "DIR-OPT-ON-TABLE",
  "DIR-EXIT-CRITERIA",
]);

const DECISION_QUESTION_DIR_ID = "DIR-DEF-QUESTION";
const DECISION_QUESTION_ROLE = "decision_question";

type PersistFn = (
  previous: POJUSessionState,
  nextDcSession: POJUSessionState,
  idempotency_key: string,
) => Promise<{ session: POJUSessionState; committed: boolean; error?: string }>;

export type GoalChangeApplyResult =
  | { ok: true; session: POJUSessionState; change: BlueprintChangeRecord; replayed: boolean }
  | { ok: false; reason: string };

export function goalChangePersistKey(sessionId: string, itemId: string): string {
  return `dc_goal_change:${sessionId}:${itemId}`;
}

function validateConfirmation(
  control: PendingIntakeControl,
  item: IntakeControlItem,
): string | null {
  if (item.kind !== "goal_change") return "item_not_goal_change";
  if (item.status !== "pending" && item.status !== "uncertain") return "item_not_pending";
  if (!control.items.some((row) => row.item_id === item.item_id)) return "item_not_in_control";
  if (control.resolving_item_id && control.resolving_item_id !== item.item_id) {
    return "item_not_current_pending";
  }
  if (!item.proposed_decision_target?.trim()) return "target_missing";
  return null;
}

export async function applyConfirmedGoalChange(input: {
  /** Session before this turn (C1 previous). */
  original: POJUSessionState;
  /** Working session for this turn. */
  session: POJUSessionState;
  control: PendingIntakeControl;
  item: IntakeControlItem;
  confirm_turn_id: string;
  confirmation_statement: string;
  now: string;
  persist: PersistFn;
}): Promise<GoalChangeApplyResult> {
  const session = input.session;
  const priorChange = (session.blueprint_change_log ?? []).find(
    (row) => row.control_item_id === input.item.item_id,
  );
  if (priorChange) {
    return { ok: true, session, change: priorChange, replayed: true };
  }
  const invalid = validateConfirmation(input.control, input.item);
  if (invalid) return { ok: false, reason: invalid };
  const dc0 = session.decision_context;
  const oldBlueprint = session.decision_blueprint;
  if (!dc0 || dc0.status !== "draft") return { ok: false, reason: "no_draft_dc" };
  if (!oldBlueprint) return { ok: false, reason: "no_blueprint" };

  const target = input.item.proposed_decision_target!.trim();
  const oldTarget = dc0.definition.decision_question ?? oldBlueprint.decision_question ?? null;

  // 1) Recompute scope from the confirmed target only.
  const withTarget: POJUSessionState = {
    ...session,
    decision_context: {
      ...dc0,
      definition: { ...dc0.definition, decision_question: target },
    },
  };
  let rebuilt: ReturnType<typeof ensureDecisionBlueprint>;
  try {
    rebuilt = ensureDecisionBlueprint(withTarget, { now: input.now, goal_target: target });
  } catch (e) {
    return { ok: false, reason: `blueprint_rebuild_failed:${e instanceof Error ? e.message : String(e)}` };
  }
  const newBlueprint = {
    ...rebuilt.blueprint,
    blueprint_version: oldBlueprint.blueprint_version + 1,
  };
  const dcSeeded = rebuilt.session.decision_context!;
  const newScope = new Set(newBlueprint.dir_ids);

  // 2) DIR lifecycle against the new scope.
  const deprecated_dir_ids: string[] = [];
  const reactivated_dir_ids: string[] = [];
  const added_dir_ids = dcSeeded.dirs
    .filter((d) => !dc0.dirs.some((old) => old.dir_id === d.dir_id))
    .map((d) => d.dir_id);
  let dirs: DIR[] = dcSeeded.dirs.map((dir) => {
    if (!newScope.has(dir.dir_id)) {
      if (dir.id_lifecycle === "active") deprecated_dir_ids.push(dir.dir_id);
      return dir.id_lifecycle === "active" ? { ...dir, id_lifecycle: "deprecated" } : dir;
    }
    if (dir.id_lifecycle === "deprecated") {
      reactivated_dir_ids.push(dir.dir_id);
      return { ...dir, id_lifecycle: "active" };
    }
    return dir;
  });
  const reopened_dir_ids = dirs
    .filter((d) => TARGET_DEPENDENT_DIR_IDS.has(d.dir_id) && newScope.has(d.dir_id))
    .map((d) => d.dir_id);

  // 3) Facts that answered the old target stop counting (kept, never deleted).
  const superseded_fact_prior_states: BlueprintChangeRecord["superseded_fact_prior_states"] = [];
  const reality_facts: RealityFact[] = dcSeeded.reality_facts.map((fact) => {
    if (fact.status === "not_applicable") return fact;
    const related = fact.related_dir_ids ?? [];
    if (related.length === 0) return fact;
    const onlyOldTarget = related.every(
      (dirId) => TARGET_DEPENDENT_DIR_IDS.has(dirId) || !newScope.has(dirId),
    );
    if (!onlyOldTarget) return fact;
    superseded_fact_prior_states.push({
      fact_id: fact.fact_id,
      status: fact.status,
      verification_level: fact.verification_level,
    });
    return withDerivedUserConfirmed({
      ...fact,
      status: "not_applicable",
      verification_level: "none",
      has_user_confirm_event: false,
      updated_at: input.now,
    });
  });

  // 4) The confirmed target is recorded as the user's own decision-question
  //    answer, carrying the raw statement it was located in.
  const targetStatement = (
    input.item.target_source_statement ??
    input.item.source_statement ??
    input.control.original_statement
  ).trim();
  const targetTurnId = input.item.target_source_turn_id ?? input.item.source_turn_id;
  let new_decision_question_fact_id: string | null = null;
  if (
    newScope.has(DECISION_QUESTION_DIR_ID) &&
    targetStatement &&
    targetStatement.length <= FACT_STATEMENT_MAX_CHARS
  ) {
    const factId = `fact_goal_${input.item.item_id}`.replace(/[^A-Za-z0-9_#:-]/g, "_").slice(0, 80);
    if (!reality_facts.some((f) => f.fact_id === factId)) {
      reality_facts.push(
        buildRealityFact({
          fact_id: factId,
          statement: targetStatement,
          status: "unverified",
          verification_level: "user_asserted",
          source_stage: "collecting",
          source_turn_id: targetTurnId,
          has_user_confirm_event: false,
          fact_roles: [DECISION_QUESTION_ROLE],
          related_dir_ids: [DECISION_QUESTION_DIR_ID],
          updated_at: input.now,
        }),
      );
    }
    new_decision_question_fact_id = factId;
  }

  dirs = await reaggregateDirsOnSession(rebuilt.session, dirs, {
    realityFacts: reality_facts,
    constraints: dcSeeded.constraints,
    conflicts: dcSeeded.conflicts,
    nowIso: input.now,
  });

  const dcNext = {
    ...dcSeeded,
    definition: { ...dcSeeded.definition, decision_question: target },
    reality_facts,
    dirs,
    updated_at: input.now,
    version: (dc0.version ?? 1) + 1,
  };
  const blueprintFinal = {
    ...newBlueprint,
    decision_question: target,
    definition_snapshot: { ...dcNext.definition },
    updated_at: input.now,
  };

  // 5) Budget: reopened DIRs get fresh depth; a new review cycle starts.
  const prevUnderstanding = session.decision_understanding ?? null;
  const change: BlueprintChangeRecord = {
    change_id: `bpc_${input.item.item_id}`.slice(0, 120),
    kind: "goal_change",
    from_blueprint_version: oldBlueprint.blueprint_version,
    to_blueprint_version: blueprintFinal.blueprint_version,
    old_decision_target: oldTarget,
    new_decision_target: target,
    proposal_statement: (input.item.source_statement ?? input.item.text).slice(0, 2000),
    proposal_source_turn_id: input.item.source_turn_id,
    control_item_id: input.item.item_id,
    confirmed_by_turn_id: input.confirm_turn_id,
    confirmation_statement: input.confirmation_statement.slice(0, 2000),
    changed_at: input.now,
    dc_version_before: dc0.version ?? 1,
    dc_version_after: dcNext.version,
    added_dir_ids,
    deprecated_dir_ids,
    reactivated_dir_ids,
    reopened_dir_ids,
    superseded_fact_ids: superseded_fact_prior_states.map((row) => row.fact_id),
    superseded_fact_prior_states,
    new_decision_question_fact_id,
    invalidated_understanding_id: prevUnderstanding?.understanding_id ?? null,
    invalidated_plan_id:
      prevUnderstanding?.next_question_plan?.plan_id ?? session.adaptive_ask_plan?.plan_id ?? null,
  };

  let understanding = prevUnderstanding;
  if (understanding) {
    const depth_by_dir = { ...understanding.budget.depth_by_dir };
    for (const dirId of [...reopened_dir_ids, ...added_dir_ids, ...reactivated_dir_ids]) {
      delete depth_by_dir[dirId];
    }
    understanding = {
      ...understanding,
      next_question_plan: null,
      blueprint_version: blueprintFinal.blueprint_version,
      budget: {
        ...understanding.budget,
        depth_by_dir,
        review_cycle: understanding.budget.review_cycle + 1,
        cycle_base_asked: understanding.budget.session_asked_count,
      },
    };
  }

  const control = updateControlItemStatus(input.control, input.item.item_id, "confirmed", {
    entered_controlled_blueprint_update: true,
    last_resolved_turn_id: input.confirm_turn_id,
    blueprint_update: {
      change_id: change.change_id,
      from_blueprint_version: change.from_blueprint_version,
      to_blueprint_version: change.to_blueprint_version,
    },
  });

  const nextSession: POJUSessionState = {
    ...rebuilt.session,
    decision_context: dcNext,
    decision_blueprint: blueprintFinal,
    decision_blueprint_history: [...(session.decision_blueprint_history ?? []), oldBlueprint],
    blueprint_change_log: [...(session.blueprint_change_log ?? []), change],
    decision_understanding: understanding,
    adaptive_ask_plan: null,
    pending_intake_control: control,
  };

  const persisted = await input.persist(
    input.original,
    nextSession,
    goalChangePersistKey(session.session_id, input.item.item_id),
  );
  if (persisted.error === "idempotent_skip") {
    return { ok: true, session: persisted.session, change, replayed: true };
  }
  if (!persisted.committed) {
    return { ok: false, reason: `persist_failed:${persisted.error ?? "unknown"}` };
  }
  return {
    ok: true,
    session: {
      ...nextSession,
      ...persisted.session,
      decision_context: persisted.session.decision_context ?? nextSession.decision_context,
      decision_context_versions:
        persisted.session.decision_context_versions ?? nextSession.decision_context_versions,
      decision_context_idempotency_keys:
        persisted.session.decision_context_idempotency_keys ??
        nextSession.decision_context_idempotency_keys,
      control_plane: persisted.session.control_plane ?? nextSession.control_plane,
      decision_blueprint: nextSession.decision_blueprint,
      decision_blueprint_history: nextSession.decision_blueprint_history,
      blueprint_change_log: nextSession.blueprint_change_log,
      decision_understanding: nextSession.decision_understanding,
      adaptive_ask_plan: null,
      pending_intake_control: nextSession.pending_intake_control,
      messages: nextSession.messages,
      agent_v2: nextSession.agent_v2,
      session_revision: persisted.session.session_revision,
      dc_write_revision: persisted.session.dc_write_revision,
    },
    change,
    replayed: false,
  };
}
