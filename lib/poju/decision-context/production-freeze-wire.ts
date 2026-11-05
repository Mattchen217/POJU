/**
 * S5 — Chat Freeze → Delivery production wire (sufficiency-end only).
 *
 * Allowed: Stage3 decision sufficiency (evaluateDecisionSufficiency.canStop).
 * Forbidden triggers: purchase, report CTA, stall, MAX_COLLECTING_TURNS stop-loss.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import { FreezeError } from "./freeze";
import { evaluateDecisionSufficiency } from "./stop-criteria";
import {
  applyFreezeToSessionSlice,
  freezeDraftForDelivery,
  prepareFrozenDcForDelivery,
  type FrozenDeliveryPackage,
} from "./freeze-to-delivery";
import type { DecisionContext, DecisionContextBinding } from "./types";
import {
  sessionHasDecisionContextSlice,
  sessionHasFrozenDecisionContext,
  shouldRequireFrozenDecisionContext,
} from "./require-dc-flag";

export type FreezeWireSkipReason =
  | "no_dc"
  | "already_frozen"
  | "not_sufficient"
  | "stall_or_degraded_path"
  | "purchase_or_cta_path"
  | "idempotent_skip";

/** Allowlisted FreezeError.code values that map 1:1 onto Wire reason_code. */
export const FREEZE_WIRE_ALLOWLISTED_INTERNAL_CODES = [
  "dir_catalog_ssot_unavailable",
  "dir_catalog_load_failed",
  "dir_catalog_version_unknown",
  "dir_catalog_version_missing",
  "dir_catalog_version_invalid",
] as const;

export type FreezeWireAllowlistedInternalCode =
  (typeof FREEZE_WIRE_ALLOWLISTED_INTERNAL_CODES)[number];

const ALLOWLISTED_CODE_SET = new Set<string>(FREEZE_WIRE_ALLOWLISTED_INTERNAL_CODES);

export const FREEZE_WIRE_GENERIC_FAIL_CODE = "freeze_failed";
export const FREEZE_WIRE_PERSIST_FAIL_CODE = "dc_freeze_persist_failed";

export type FreezeWireResult =
  | {
      ok: true;
      skipped?: false;
      pack: FrozenDeliveryPackage;
      session: POJUSessionState;
      idempotency_key: string;
    }
  | {
      ok: true;
      skipped: true;
      reason: FreezeWireSkipReason;
      session: POJUSessionState;
      binding?: DecisionContextBinding | null;
    }
  | {
      ok: false;
      reason: string;
      reason_code: string;
      session: POJUSessionState;
    };

/**
 * Map a caught throw to Wire `reason` + allowlisted `reason_code`.
 * Never uses Error.message as reason_code.
 */
export function mapCaughtFreezeFailure(e: unknown): {
  reason: string;
  reason_code: string;
} {
  if (e instanceof FreezeError) {
    const message = e.message;
    if (e.code && ALLOWLISTED_CODE_SET.has(e.code)) {
      return { reason: message || e.code, reason_code: e.code };
    }
    return { reason: message, reason_code: FREEZE_WIRE_GENERIC_FAIL_CODE };
  }
  if (e instanceof Error) {
    return { reason: e.message, reason_code: FREEZE_WIRE_GENERIC_FAIL_CODE };
  }
  return { reason: String(e), reason_code: FREEZE_WIRE_GENERIC_FAIL_CODE };
}

/** Assemble ok:false Wire result from a caught throw (production catch uses this). */
export function freezeFailWireResult(
  session: POJUSessionState,
  e: unknown,
): Extract<FreezeWireResult, { ok: false }> {
  const mapped = mapCaughtFreezeFailure(e);
  return {
    ok: false,
    reason: mapped.reason,
    reason_code: mapped.reason_code,
    session,
  };
}

/** Assemble ok:false Wire result for Session C1 persist failure. */
export function persistFailWireResult(
  session: POJUSessionState,
  commitError?: string | null,
): Extract<FreezeWireResult, { ok: false }> {
  const reason =
    commitError != null && commitError !== ""
      ? commitError
      : FREEZE_WIRE_PERSIST_FAIL_CODE;
  return {
    ok: false,
    reason,
    reason_code: FREEZE_WIRE_PERSIST_FAIL_CODE,
    session,
  };
}

export type FreezeWireTrigger =
  | "sufficiency_end_confirm"
  | "pre_synthesis_safety"
  | "pre_delivery_safety";

function isStallOrDegradedPath(session: POJUSessionState): boolean {
  const agent = session.agent_v2;
  if (!agent) return false;
  if (agent.stall_offer_pending) return true;
  if (agent.delivery_mode === "degraded") return true;
  return false;
}

/**
 * Pure eligibility: may we freeze this session's draft DC on this trigger?
 */
export function canFreezeSessionOnSufficiency(input: {
  session: POJUSessionState;
  trigger: FreezeWireTrigger;
  /** Must be false for stall / purchase / CTA callers. */
  from_stall_or_max_turns?: boolean;
  from_purchase_or_report_cta?: boolean;
}): { allowed: boolean; reason?: FreezeWireSkipReason; draft?: DecisionContext } {
  if (input.from_stall_or_max_turns || input.from_purchase_or_report_cta) {
    return {
      allowed: false,
      reason: input.from_purchase_or_report_cta
        ? "purchase_or_cta_path"
        : "stall_or_degraded_path",
    };
  }
  if (isStallOrDegradedPath(input.session)) {
    return { allowed: false, reason: "stall_or_degraded_path" };
  }
  const dc = input.session.decision_context ?? null;
  if (!dc) {
    return { allowed: false, reason: "no_dc" };
  }
  if (dc.status === "final" || dc.status === "superseded") {
    return { allowed: false, reason: "already_frozen", draft: dc };
  }
  if (dc.status !== "draft") {
    return { allowed: false, reason: "not_sufficient", draft: dc };
  }
  const suf = evaluateDecisionSufficiency(dc);
  if (!suf.canStop) {
    return { allowed: false, reason: "not_sufficient", draft: dc };
  }
  return { allowed: true, draft: dc };
}

export function freezeIdempotencyKey(
  session: POJUSessionState,
  draft: DecisionContext,
): string {
  return `dc_freeze:${session.session_id}:${draft.context_id}:v${draft.version}:sufficiency`;
}

/**
 * Apply freeze into an in-memory session slice (caller persists via C1).
 */
export function applySufficiencyFreezeToSession(
  session: POJUSessionState,
  opts?: { now?: string },
): FreezeWireResult {
  const gate = canFreezeSessionOnSufficiency({
    session,
    trigger: "sufficiency_end_confirm",
    from_stall_or_max_turns: false,
    from_purchase_or_report_cta: false,
  });
  if (!gate.allowed) {
    let binding: DecisionContextBinding | null = null;
    if (gate.reason === "already_frozen" && gate.draft?.content_hash) {
      try {
        const prepared = prepareFrozenDcForDelivery({
          decision_context: session.decision_context,
          decision_context_versions: session.decision_context_versions,
        });
        binding = prepared.decision_context_binding;
      } catch {
        binding = null;
      }
    }
    return {
      ok: true,
      skipped: true,
      reason: gate.reason ?? "not_sufficient",
      session,
      binding,
    };
  }
  try {
    const pack = freezeDraftForDelivery(gate.draft!, {
      session,
      now: opts?.now,
    });
    const slice = applyFreezeToSessionSlice(
      {
        decision_context: session.decision_context,
        decision_context_versions: session.decision_context_versions,
      },
      pack,
    );
    const next: POJUSessionState = {
      ...session,
      decision_context: slice.decision_context ?? null,
      decision_context_versions: slice.decision_context_versions ?? [],
    };
    return {
      ok: true,
      pack,
      session: next,
      idempotency_key: freezeIdempotencyKey(session, gate.draft!),
    };
  } catch (e) {
    return freezeFailWireResult(session, e);
  }
}

/**
 * Persist sufficiency Freeze through Session C1 when eligible.
 * Idempotent on freeze key. Never called from purchase/CTA/stall paths.
 */
export async function ensureSessionFrozenForDelivery(
  session: POJUSessionState,
  opts?: {
    trigger?: FreezeWireTrigger;
    now?: string;
    from_stall_or_max_turns?: boolean;
    from_purchase_or_report_cta?: boolean;
  },
): Promise<FreezeWireResult> {
  const trigger = opts?.trigger ?? "pre_delivery_safety";
  const gate = canFreezeSessionOnSufficiency({
    session,
    trigger,
    from_stall_or_max_turns: opts?.from_stall_or_max_turns,
    from_purchase_or_report_cta: opts?.from_purchase_or_report_cta,
  });
  if (!gate.allowed) {
    return applySufficiencyFreezeToSession(session, { now: opts?.now });
  }

  const applied = applySufficiencyFreezeToSession(session, { now: opts?.now });
  if (!applied.ok || applied.skipped) return applied;

  const { commitDecisionContextChange } = await import(
    "@/lib/poju/session-manager"
  );
  const { applyDcToWorking } = await import("./persist");
  const commit = await commitDecisionContextChange({
    session,
    idempotency_key: applied.idempotency_key,
    now: opts?.now,
    // Freeze is DC-authority; control plane may be absent on early sessions.
    require_control_plane: false,
    apply: (tx) => {
      const merged = applyFreezeToSessionSlice(
        {
          decision_context: tx.working.decision_context,
          decision_context_versions: tx.working.decision_context_versions,
        },
        applied.pack,
      );
      applyDcToWorking(
        tx,
        applied.pack.frozen,
        merged.decision_context_versions ?? [],
      );
    },
  });

  if (commit.idempotent_skip) {
    return {
      ok: true,
      skipped: true,
      reason: "idempotent_skip",
      session: commit.session,
      binding: applied.pack.binding,
    };
  }
  if (!commit.committed) {
    return persistFailWireResult(session, commit.error);
  }
  return {
    ok: true,
    pack: applied.pack,
    session: commit.session,
    idempotency_key: applied.idempotency_key,
  };
}

/** Resolve delivery DC payload + require flag for final-delivery POST. */
export function resolveDeliveryDcPayload(session: POJUSessionState): {
  decision_context: DecisionContext | null;
  decision_context_versions: DecisionContext[];
  require_decision_context: boolean;
  binding: DecisionContextBinding | null;
  snapshot: DecisionContext | null;
} {
  const hasDc = sessionHasDecisionContextSlice(session);
  const hasFrozen = sessionHasFrozenDecisionContext(session);
  const require = shouldRequireFrozenDecisionContext({
    sessionHasDecisionContext: hasDc,
    sessionHasFrozenDc: hasFrozen,
  });
  let binding: DecisionContextBinding | null = null;
  let snapshot: DecisionContext | null = null;
  if (hasFrozen) {
    try {
      const prepared = prepareFrozenDcForDelivery({
        decision_context: session.decision_context,
        decision_context_versions: session.decision_context_versions,
      });
      binding = prepared.decision_context_binding;
      snapshot = prepared.decision_context_snapshot;
    } catch {
      binding = null;
      snapshot = null;
    }
  }
  return {
    decision_context: session.decision_context ?? null,
    decision_context_versions: session.decision_context_versions ?? [],
    require_decision_context: require,
    binding,
    snapshot,
  };
}
