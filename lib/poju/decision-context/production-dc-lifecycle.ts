/**
 * S7 — Production Draft DC lifecycle (Opening → Call A → Call B → Collecting).
 * Single SoT: session.decision_context via C1. agent_v2 remains non-authoritative buffer.
 */

import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  createDefaultControlPlane,
  mergeControlPlanePatch,
  type Phase3ControlPlane,
} from "./control-plane";
import { applyDcToWorking } from "./persist";
import {
  seedDecisionContextFromOpening,
  type OpeningUserStatement,
} from "./opening-seed";
import {
  applyHypothesesFromNormalizedCallAToDc,
  hypothesesFromBreakthroughCore,
} from "./hypothesis-from-core";
import { dirsFromAgenda } from "./dir-from-agenda";
import { normalizeCallAInput } from "./normalize-call-a";
import { normalizeCallBInput } from "./normalize-call-b";
import { fingerprintCallA, fingerprintCallB } from "./fingerprint";
import { reaggregateDirsOnSession } from "./na-validation-from-session";
import { buildRealityFact } from "./fact-combination";
import type { DecisionContext, RealityFact } from "./types";

function agentBuffers(agent: POJUAgentState | null | undefined) {
  return {
    dilemma: agent?.core_dilemma ?? null,
    direction: agent?.desired_direction ?? null,
    question: agent?.original_question?.trim() || null,
  };
}

function looksLikeGateConfirmLabel(text: string): boolean {
  const t = text.trim();
  if (t.length > 40) return false;
  return /理解正确|继续深入|that's right|looks right|confirm|确认理解|没问题，继续/i.test(
    t,
  );
}

/** Opening user statements only — never gate-confirm chip as a Fact. */
function openingStatementsFromSession(
  session: POJUSessionState,
): OpeningUserStatement[] {
  const out: OpeningUserStatement[] = [];
  for (const m of session.messages) {
    if (m.role !== "user" || m.is_rejected) continue;
    const text = m.content?.trim();
    if (!text || text.length < 4) continue;
    if (looksLikeGateConfirmLabel(text)) continue;
    if (text === "__OPENING__" || text.startsWith("__")) continue;
    const turnId = m.client_id?.trim();
    if (!turnId) continue;
    out.push({
      statement: text.slice(0, 500),
      verification_level: "user_asserted",
      has_user_confirm_event: false,
      status: "unverified",
      source_turn_id: turnId,
      fact_roles: ["opening_user_statement"],
    });
  }
  return out.slice(0, 12);
}

function withControlPlane(
  session: POJUSessionState,
  patch: Partial<Phase3ControlPlane> & { current_phase?: Phase3ControlPlane["current_phase"] },
): Phase3ControlPlane {
  const base = session.control_plane ?? createDefaultControlPlane(patch.current_phase ?? "opening");
  return mergeControlPlanePatch(base, patch);
}

/** Pure: create draft DC from Opening buffers if missing. */
export function seedOpeningDraftDcOnSession(
  session: POJUSessionState,
  opts?: { now?: string; context_id?: string },
): { session: POJUSessionState; created: boolean; skipped_reason?: string } {
  const existing = session.decision_context;
  if (existing && (existing.status === "draft" || existing.status === "final")) {
    return { session, created: false, skipped_reason: "already_present" };
  }
  const agent = session.agent_v2;
  if (!agent) {
    return { session, created: false, skipped_reason: "no_agent" };
  }
  const buffers = agentBuffers(agent);
  const statements = openingStatementsFromSession(session);
  if (
    !buffers.dilemma?.concrete_event?.trim() &&
    !buffers.direction?.wants?.trim() &&
    statements.length === 0
  ) {
    return { session, created: false, skipped_reason: "insufficient_opening" };
  }
  try {
    const draft = seedDecisionContextFromOpening({
      context_id: opts?.context_id ?? `dc_${session.session_id}`,
      session_id: session.session_id,
      now: opts?.now,
      core_dilemma: buffers.dilemma,
      desired_direction: buffers.direction,
      decision_question: buffers.question,
      user_statements: statements,
    });
    return {
      session: {
        ...session,
        decision_context: draft,
        decision_context_versions: session.decision_context_versions ?? [],
        control_plane: withControlPlane(session, {
          current_phase: "awaiting_understanding_confirm",
          opening_gate_state: "confirmed",
        }),
      },
      created: true,
    };
  } catch (e) {
    console.warn(
      "[dc-lifecycle] opening seed failed",
      e instanceof Error ? e.message : e,
    );
    return { session, created: false, skipped_reason: "seed_error" };
  }
}

/** Pure: Call A — hypotheses only into draft DC (never Facts / Constraints). */
export function applyCallAToSessionDc(
  session: POJUSessionState,
  breakthrough_core: BreakthroughCore,
  opts?: { source_ref?: string; now?: string },
): { session: POJUSessionState; applied: boolean; skipped_reason?: string } {
  let base = session;
  if (!base.decision_context || base.decision_context.status !== "draft") {
    const seeded = seedOpeningDraftDcOnSession(base, { now: opts?.now });
    base = seeded.session;
  }
  const dc = base.decision_context;
  if (!dc || dc.status !== "draft") {
    return { session: base, applied: false, skipped_reason: "no_draft_dc" };
  }
  const source_ref =
    opts?.source_ref ??
    `call_a:${base.session_id}:${(breakthrough_core.situation_conclusion ?? "core").slice(0, 24)}`;
  const normalized = normalizeCallAInput(breakthrough_core);
  const fp = fingerprintCallA(normalized);
  let nextDc = applyHypothesesFromNormalizedCallAToDc(dc, normalized, {
    source_ref,
    now: opts?.now,
    existing: dc.hypotheses,
  });
  if (nextDc.hypotheses.length === 0) {
    nextDc = {
      ...nextDc,
      hypotheses: hypothesesFromBreakthroughCore(breakthrough_core, {
        source_ref,
        now: opts?.now,
        existing: dc.hypotheses,
      }),
    };
  }
  const now = opts?.now ?? new Date().toISOString();
  return {
    session: {
      ...base,
      decision_context: {
        ...nextDc,
        updated_at: now,
      },
      control_plane: withControlPlane(base, {
        current_phase: "collecting_context",
        last_call_a_fingerprint: fp.fingerprint,
        last_call_a_fingerprint_version: fp.fingerprint_version,
      }),
    },
    applied: true,
  };
}

/** Pure: Call B — DIR seeds from Agenda (never promote covered→known). */
export function applyCallBToSessionDc(
  session: POJUSessionState,
  investigation_agenda: AgendaItem[],
  opts?: { now?: string },
): { session: POJUSessionState; applied: boolean; skipped_reason?: string } {
  let base = session;
  if (!base.decision_context || base.decision_context.status !== "draft") {
    const seeded = seedOpeningDraftDcOnSession(base, { now: opts?.now });
    base = seeded.session;
  }
  const dc = base.decision_context;
  if (!dc || dc.status !== "draft") {
    return { session: base, applied: false, skipped_reason: "no_draft_dc" };
  }
  if (!investigation_agenda?.length) {
    return { session: base, applied: false, skipped_reason: "empty_agenda" };
  }
  try {
    const normalized = normalizeCallBInput(investigation_agenda);
    const fp = fingerprintCallB(normalized);
    const dirs = dirsFromAgenda(investigation_agenda, { existing: dc.dirs });
    const now = opts?.now ?? new Date().toISOString();
    // Intake 2.0: shared resolveDirRoleEvidence — no legacy OR-fallback aggregator.
    const aggregated = reaggregateDirsOnSession(base, dirs, { nowIso: now });
    const nextDc: DecisionContext = {
      ...dc,
      dirs: aggregated,
      updated_at: now,
    };
    return {
      session: {
        ...base,
        decision_context: nextDc,
        control_plane: withControlPlane(base, {
          current_phase: "collecting_context",
          investigation_agenda,
          last_call_b_fingerprint: fp.fingerprint,
          last_call_b_fingerprint_version: fp.fingerprint_version,
        }),
      },
      applied: true,
    };
  } catch (e) {
    console.warn(
      "[dc-lifecycle] Call B DIR map failed",
      e instanceof Error ? e.message : e,
    );
    return { session: base, applied: false, skipped_reason: "dir_map_error" };
  }
}

/**
 * Collecting: append an unverified RealityFact from a user turn (never auto-confirm).
 * Confirmation Events remain the only path to user_confirmed.
 */
export function applyCollectingUserTurnToSessionDc(
  session: POJUSessionState,
  input: {
    statement: string;
    source_turn_id: string;
    now?: string;
  },
): { session: POJUSessionState; applied: boolean; skipped_reason?: string } {
  const dc = session.decision_context;
  if (!dc || dc.status !== "draft") {
    return { session, applied: false, skipped_reason: "no_draft_dc" };
  }
  const statement = input.statement.trim();
  if (statement.length < 2) {
    return { session, applied: false, skipped_reason: "empty_statement" };
  }
  const turnId = input.source_turn_id.trim();
  if (!turnId) {
    return { session, applied: false, skipped_reason: "missing_source_turn" };
  }
  if (dc.reality_facts.some((f) => f.source_turn_id === turnId)) {
    return { session, applied: false, skipped_reason: "turn_already_mapped" };
  }
  const fact: RealityFact = buildRealityFact({
    fact_id: `fact_collect_${turnId}`.slice(0, 80),
    statement: statement.slice(0, 500),
    status: "unverified",
    verification_level: "user_asserted",
    source_stage: "collecting",
    source_turn_id: turnId,
    has_user_confirm_event: false,
    fact_roles: ["collecting_user_statement"],
  });
  const reality_facts = [...dc.reality_facts, fact];
  const now = input.now ?? new Date().toISOString();
  // Intake 2.0: reaggregate with Session-built NaValidationContext + constraints/N/A.
  const dirs = reaggregateDirsOnSession(session, dc.dirs, {
    realityFacts: reality_facts,
    nowIso: now,
  });
  return {
    session: {
      ...session,
      decision_context: {
        ...dc,
        reality_facts,
        dirs,
        updated_at: now,
      },
      control_plane: withControlPlane(session, {
        current_phase: "collecting_context",
      }),
    },
    applied: true,
  };
}

/**
 * Persist a DC lifecycle mutation through C1 (idempotent).
 * `nextDcSession` must already carry the desired messages/agent_v2 + DC —
 * it is the snapshot written on commit (not a DC-only patch onto an older base).
 */
export async function persistDcLifecycleChange(
  _previous: POJUSessionState,
  nextDcSession: POJUSessionState,
  idempotency_key: string,
): Promise<{ session: POJUSessionState; committed: boolean; error?: string }> {
  if (!nextDcSession.decision_context) {
    return { session: nextDcSession, committed: false, error: "missing_dc" };
  }
  const { commitDecisionContextChange } = await import(
    "@/lib/poju/session-manager"
  );
  const commit = await commitDecisionContextChange({
    session: nextDcSession,
    idempotency_key,
    apply: (tx) => {
      applyDcToWorking(
        tx,
        nextDcSession.decision_context!,
        nextDcSession.decision_context_versions ?? [],
      );
      if (nextDcSession.control_plane) {
        tx.working.control_plane = nextDcSession.control_plane;
      }
    },
    control_plane_patch: nextDcSession.control_plane ?? undefined,
  });
  if (commit.idempotent_skip) {
    // Prior successful commit — keep caller's next (messages) + restored DC authority.
    return {
      session: {
        ...nextDcSession,
        decision_context:
          commit.session.decision_context ?? nextDcSession.decision_context,
        decision_context_versions:
          commit.session.decision_context_versions ??
          nextDcSession.decision_context_versions,
        decision_context_idempotency_keys:
          commit.session.decision_context_idempotency_keys ??
          nextDcSession.decision_context_idempotency_keys,
        control_plane:
          commit.session.control_plane ?? nextDcSession.control_plane,
      },
      committed: false,
      error: "idempotent_skip",
    };
  }
  if (!commit.committed) {
    return {
      session: nextDcSession,
      committed: false,
      error: commit.error ?? "persist_failed",
    };
  }
  return { session: commit.session, committed: true };
}

export async function ensureOpeningDraftDcPersisted(
  session: POJUSessionState,
  opts?: { now?: string },
): Promise<{ session: POJUSessionState; created: boolean; error?: string }> {
  const seeded = seedOpeningDraftDcOnSession(session, opts);
  if (!seeded.created) {
    return { session: seeded.session, created: false, error: seeded.skipped_reason };
  }
  const key = `dc_seed:opening:${session.session_id}:v${seeded.session.decision_context?.version ?? 1}`;
  const persisted = await persistDcLifecycleChange(session, seeded.session, key);
  return {
    session: persisted.committed ? persisted.session : seeded.session,
    created: true,
    error: persisted.error,
  };
}

export async function persistCallADcOnSession(
  session: POJUSessionState,
  breakthrough_core: BreakthroughCore,
  opts?: { source_ref?: string; now?: string },
): Promise<{ session: POJUSessionState; applied: boolean; error?: string }> {
  const applied = applyCallAToSessionDc(session, breakthrough_core, opts);
  if (!applied.applied) {
    return { session: applied.session, applied: false, error: applied.skipped_reason };
  }
  const key = `dc_call_a:${session.session_id}:${opts?.source_ref ?? "core"}`;
  const persisted = await persistDcLifecycleChange(session, applied.session, key);
  return {
    session: persisted.committed ? persisted.session : applied.session,
    applied: true,
    error: persisted.error,
  };
}

export async function persistCallBDcOnSession(
  session: POJUSessionState,
  investigation_agenda: AgendaItem[],
  opts?: { now?: string },
): Promise<{ session: POJUSessionState; applied: boolean; error?: string }> {
  const applied = applyCallBToSessionDc(session, investigation_agenda, opts);
  if (!applied.applied) {
    return { session: applied.session, applied: false, error: applied.skipped_reason };
  }
  const key = `dc_call_b:${session.session_id}:agenda_${investigation_agenda.length}`;
  const persisted = await persistDcLifecycleChange(session, applied.session, key);
  return {
    session: persisted.committed ? persisted.session : applied.session,
    applied: true,
    error: persisted.error,
  };
}

export async function persistCollectingUserTurnDc(
  session: POJUSessionState,
  input: { statement: string; source_turn_id: string; now?: string },
): Promise<{ session: POJUSessionState; applied: boolean; error?: string }> {
  const applied = applyCollectingUserTurnToSessionDc(session, input);
  if (!applied.applied) {
    return { session: applied.session, applied: false, error: applied.skipped_reason };
  }
  const key = `dc_collect:${session.session_id}:${input.source_turn_id}`;
  const persisted = await persistDcLifecycleChange(session, applied.session, key);
  return {
    session: persisted.committed ? persisted.session : applied.session,
    applied: true,
    error: persisted.error,
  };
}
