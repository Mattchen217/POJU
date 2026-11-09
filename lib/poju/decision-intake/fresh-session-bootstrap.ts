/**
 * M1-R / M2.3 — Fresh-session bootstrap for the adaptive main loop.
 *
 * Production chain:
 *   createPOJUSession → handleUserMessage → runM1ProductionPreLlmTurn
 *   → bootstrapFreshSessionMainLoop → Catalog Blueprint init → AQE → authorized Q
 *
 * M2.3: investigation scope comes from Phase 2 DDR/DIR Catalog + Topic Applicability.
 * M1R_STARTER_DIRS is only an explicit controlled fallback when Catalog scope cannot
 * be built — never the default full scope for every decision question.
 */

import type { DIR } from "@/lib/poju/decision-context/types";
import { buildRealityFact } from "@/lib/poju/decision-context/fact-combination";
import { reaggregateDirs } from "@/lib/poju/decision-context/dir-aggregator";
import type { POJUSessionState } from "@/lib/poju/types";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  createDefaultControlPlane,
  mergeControlPlanePatch,
} from "@/lib/poju/decision-context/control-plane";
import {
  persistDcLifecycleChange,
  seedOpeningDraftDcOnSession,
} from "@/lib/poju/decision-context/production-dc-lifecycle";
import { ensureDecisionBlueprint } from "./blueprint";
import { runAdaptiveQuestionTurn } from "./adaptive-turn";
import type { AdaptiveTurnResult } from "./types";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Controlled fallback DIR seed only — Catalog-validated ids.
 * NOT the default investigation scope for every decision question (M2.3-B).
 */
export const M1R_STARTER_DIRS: DIR[] = [
  {
    dir_id: "DIR-OPT-ON-TABLE",
    need: "有哪些真实可选方案",
    why: "没有选项清单无法比较去留",
    required_fact_roles: ["option"],
    current_state: "unknown",
    partial_satisfaction: false,
    agenda_item_ids: [],
    id_lifecycle: "active",
    may_affect_p5_ranking: true,
  },
  {
    dir_id: "DIR-STATUS-QUO",
    need: "当前工作与生活基线",
    why: "需要对照维持现状的代价与收益",
    required_fact_roles: ["status_quo"],
    current_state: "unknown",
    partial_satisfaction: false,
    agenda_item_ids: [],
    id_lifecycle: "active",
    may_affect_p5_ranking: false,
  },
  {
    dir_id: "DIR-OPT-CONSTRAINTS",
    need: "硬性约束（钱/时间/责任）",
    why: "硬约束直接砍掉不可行选项",
    required_fact_roles: ["hard_constraint"],
    current_state: "unknown",
    partial_satisfaction: false,
    agenda_item_ids: [],
    id_lifecycle: "active",
    may_affect_p5_ranking: true,
  },
  {
    dir_id: "DIR-RISK-TOLERANCE",
    need: "可承受的最差结果",
    why: "风险边界决定能否推进高不确定选项",
    required_fact_roles: ["risk_tolerance"],
    current_state: "unknown",
    partial_satisfaction: false,
    agenda_item_ids: [],
    id_lifecycle: "active",
    may_affect_p5_ranking: true,
  },
];

export type FreshSessionBootstrapResult = AdaptiveTurnResult & {
  bootstrapped: boolean;
  bootstrap_error?: string;
  blueprint_scope_source?: "catalog" | "starter_fallback";
};

type PersistFn = typeof persistDcLifecycleChange;

/** Test-only seam for fail-closed proof. Never use in production callers. */
let persistOverrideForTests: PersistFn | null = null;

export function __setM1rPersistForTests(fn: PersistFn | null): void {
  persistOverrideForTests = fn;
}

async function persistDc(
  previous: POJUSessionState,
  next: POJUSessionState,
  key: string,
) {
  const impl = persistOverrideForTests ?? persistDcLifecycleChange;
  return impl(previous, next, key);
}

function ensureCollectingAgent(
  session: POJUSessionState,
  statement: string,
): POJUSessionState {
  const q =
    session.original_question?.trim() ||
    session.agent_v2?.original_question?.trim() ||
    statement.trim();
  const base =
    session.agent_v2 ??
    createInitialAgentState({
      original_question: q || statement.trim() || "decision",
    });
  const agent = {
    ...base,
    current_phase: "collecting_context" as const,
    original_question: q || base.original_question,
    delivery_mode: base.delivery_mode ?? ("full" as const),
    stall_offer_pending: false,
    core_dilemma: base.core_dilemma ?? {
      concrete_event: (statement || q).slice(0, 200) || null,
      stakes: null,
      sticking_point: null,
    },
    desired_direction: base.desired_direction ?? {
      wants: null,
      priority: null,
    },
  };
  const control =
    session.control_plane ??
    createDefaultControlPlane("collecting_context");
  return {
    ...session,
    original_question: q || session.original_question,
    agent_v2: agent,
    control_plane: mergeControlPlanePatch(control, {
      current_phase: "collecting_context",
    }),
  };
}


function seedDecisionQuestionFact(
  session: POJUSessionState,
  statement: string,
  source_turn_id: string,
  now: string,
): POJUSessionState {
  const dc = session.decision_context;
  if (!dc || dc.status !== "draft") return session;
  const q =
    dc.definition.decision_question?.trim() ||
    session.original_question?.trim() ||
    statement.trim();
  if (!q) return session;
  const hasRole = (dc.reality_facts ?? []).some((f) =>
    (f.fact_roles ?? []).includes("decision_question"),
  );
  if (hasRole) return session;
  if (!dc.dirs.some((d) => d.dir_id === "DIR-DEF-QUESTION")) return session;
  const fact = buildRealityFact({
    fact_id: `fact_dq_${dc.context_id}`,
    statement: q.slice(0, 500),
    status: "unverified",
    verification_level: "user_asserted",
    source_stage: "opening",
    source_turn_id,
    fact_roles: ["decision_question"],
    related_dir_ids: ["DIR-DEF-QUESTION"],
    updated_at: now,
  });
  const reality_facts = [...(dc.reality_facts ?? []), fact];
  const dirs = reaggregateDirs(
    dc.dirs,
    reality_facts,
    dc.conflicts ?? [],
  );
  return {
    ...session,
    decision_context: {
      ...dc,
      reality_facts,
      dirs,
      updated_at: now,
    },
  };
}

/** Last-resort only: attach starter DIRs when DC has zero active dirs after Catalog init. */
function attachStarterDirsFallback(
  session: POJUSessionState,
  now: string,
): POJUSessionState {
  const dc = session.decision_context;
  if (!dc || dc.status !== "draft") return session;
  if (dc.dirs.some((d) => d.id_lifecycle === "active")) return session;
  return {
    ...session,
    decision_context: {
      ...dc,
      dirs: M1R_STARTER_DIRS.map((d) => ({ ...d })),
      updated_at: now,
    },
  };
}

function withDecisionQuestion(
  session: POJUSessionState,
  statement: string,
  now: string,
): POJUSessionState {
  const dc = session.decision_context;
  if (!dc || dc.status !== "draft") return session;
  const q =
    dc.definition.decision_question?.trim() ||
    session.original_question?.trim() ||
    session.agent_v2?.original_question?.trim() ||
    statement.trim() ||
    null;
  if (!q) return session;
  if (dc.definition.decision_question === q) return session;
  return {
    ...session,
    decision_context: {
      ...dc,
      definition: {
        ...dc.definition,
        decision_question: q,
      },
      updated_at: now,
    },
    original_question: session.original_question || q,
  };
}

function applyBlueprintInit(
  session: POJUSessionState,
  statement: string,
  now: string,
  recompute: boolean,
  source_turn_id?: string,
): { session: POJUSessionState; scope_source: "catalog" | "starter_fallback" } {
  let current = withDecisionQuestion(session, statement, now);
  try {
    const bp = ensureDecisionBlueprint(current, {
      now,
      recompute_scope: recompute,
    });
    current = bp.session;
    current = seedDecisionQuestionFact(
      current,
      statement,
      source_turn_id ?? `opening:${current.session_id}`,
      now,
    );
    // If Catalog path somehow left zero active dirs, controlled starter fallback.
    if (
      !(current.decision_context?.dirs ?? []).some(
        (d) => d.id_lifecycle === "active",
      )
    ) {
      current = attachStarterDirsFallback(current, now);
      const bp2 = ensureDecisionBlueprint(current, {
        now,
        recompute_scope: true,
      });
      current = bp2.session;
      return {
        session: current,
        scope_source: current.decision_blueprint?.scope_source ?? "starter_fallback",
      };
    }
    return {
      session: current,
      scope_source: bp.meta.scope_source,
    };
  } catch {
    current = attachStarterDirsFallback(current, now);
    const bp = ensureDecisionBlueprint(current, {
      now,
      recompute_scope: true,
    });
    let fallbackSession = bp.session;
    fallbackSession = seedDecisionQuestionFact(
      fallbackSession,
      statement,
      source_turn_id ?? `opening:${fallbackSession.session_id}`,
      now,
    );
    return {
      session: fallbackSession,
      scope_source: "starter_fallback",
    };
  }
}

/**
 * Brand-new session entry: create/persist draft DC + Catalog Blueprint + first adaptive plan.
 * Does NOT interpret `statement` as an answer to a prior investigate question
 * (that is the decision question / opening statement).
 */
export async function bootstrapFreshSessionMainLoop(input: {
  session: POJUSessionState;
  statement: string;
  source_turn_id: string;
  now: string;
}): Promise<FreshSessionBootstrapResult> {
  const statement = input.statement.trim();
  if (!statement) {
    return {
      session: input.session,
      outcome: "not_applicable_phase",
      answer_event: null,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: "empty_statement",
      bootstrapped: false,
      bootstrap_error: "empty_statement",
    };
  }

  let current = ensureCollectingAgent({ ...input.session }, statement);
  let scope_source: "catalog" | "starter_fallback" = "catalog";

  const existing = current.decision_context;
  if (existing && (existing.status === "draft" || existing.status === "final")) {
    const applied = applyBlueprintInit(current, statement, input.now, false, input.source_turn_id);
    current = applied.session;
    scope_source = applied.scope_source;
    const turn = await runAdaptiveQuestionTurn({
      session: current,
      statement: "",
      source_turn_id: input.source_turn_id,
      now: input.now,
      init_only: true,
    });
    return { ...turn, bootstrapped: false, blueprint_scope_source: scope_source };
  }

  const seeded = seedOpeningDraftDcOnSession(current, { now: input.now });
  if (!seeded.created && !seeded.session.decision_context) {
    return {
      session: current,
      outcome: "dc_persist_failed",
      answer_event: null,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: seeded.skipped_reason ?? "seed_failed",
      bootstrapped: false,
      bootstrap_error: seeded.skipped_reason ?? "seed_failed",
    };
  }

  // Catalog Blueprint scope BEFORE the single C1 write so first persist is complete.
  current = ensureCollectingAgent(seeded.session, statement);
  {
    const applied = applyBlueprintInit(current, statement, input.now, true, input.source_turn_id);
    current = applied.session;
    scope_source = applied.scope_source;
  }

  const key = `dc_seed:m1r:${current.session_id}:${input.source_turn_id}`;
  try {
    const persisted = await persistDc(input.session, current, key);
    if (!persisted.committed && persisted.error !== "idempotent_skip") {
      return {
        session: input.session,
        outcome: "dc_persist_failed",
        answer_event: null,
        understanding: null,
        plan: null,
        authorized_question: null,
        persist_error: persisted.error ?? "persist_failed",
        bootstrapped: false,
        bootstrap_error: persisted.error ?? "persist_failed",
      };
    }
    current = {
      ...current,
      ...persisted.session,
      decision_context:
        persisted.session.decision_context ?? current.decision_context,
      decision_context_versions:
        persisted.session.decision_context_versions ??
        current.decision_context_versions,
      decision_context_idempotency_keys:
        persisted.session.decision_context_idempotency_keys ??
        current.decision_context_idempotency_keys,
      control_plane: persisted.session.control_plane ?? current.control_plane,
      // Keep bootstrap phase / blueprint / messages — C1 restores DC authority only.
      agent_v2: current.agent_v2,
      decision_blueprint: current.decision_blueprint,
      messages: current.messages,
      session_revision: persisted.session.session_revision,
      dc_write_revision: persisted.session.dc_write_revision,
    };
  } catch (e) {
    return {
      session: input.session,
      outcome: "dc_persist_threw",
      answer_event: null,
      understanding: null,
      plan: null,
      authorized_question: null,
      persist_error: errorText(e),
      bootstrapped: false,
      bootstrap_error: errorText(e),
    };
  }

  // Re-apply collecting + Catalog Blueprint after C1 restore (DC wins; dirs must remain).
  current = ensureCollectingAgent(current, statement);
  {
    const applied = applyBlueprintInit(
      current,
      statement,
      input.now,
      !(current.decision_context?.dirs ?? []).some(
        (d) => d.id_lifecycle === "active",
      ),
      input.source_turn_id,
    );
    current = applied.session;
    scope_source = applied.scope_source;
  }

  const turn = await runAdaptiveQuestionTurn({
    session: current,
    statement: "",
    source_turn_id: input.source_turn_id,
    now: input.now,
    init_only: true,
  });

  return {
    ...turn,
    bootstrapped: true,
    blueprint_scope_source: scope_source,
  };
}
