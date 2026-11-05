/**
 * S4 integration helper — Freeze → Delivery binding package.
 * Does not trigger purchase/CTA Freeze. Call only on Stage3 sufficiency end.
 * Production chat wiring should call prepareFrozenDcForDelivery then persist + POST delivery.
 */

import { freezeDecisionContext, type FreezeOptions } from "./freeze";
import {
  buildNaValidationContextFromSession,
  type NaValidationAuthorityOverrides,
} from "./na-validation-from-session";
import {
  assertSnapshotMatchesBinding,
  bindingFromDecisionContext,
  type DecisionContextSessionSlice,
  resolveDecisionContextForReport,
} from "./read-bound";
import type { DecisionContext, DecisionContextBinding } from "./types";
import type { POJUSessionState } from "@/lib/poju/types";

export type FrozenDeliveryPackage = {
  frozen: DecisionContext;
  version_snapshot: DecisionContext;
  binding: DecisionContextBinding;
};

export type FreezeDraftForDeliveryOpts = Omit<
  FreezeOptions,
  "stage3_sufficiency_end" | "naValidation" | "expectedSessionId"
> & {
  now?: string;
  /** Authoritative Session — required for Intake N/A validation context. */
  session: POJUSessionState;
  authority?: NaValidationAuthorityOverrides;
};

/**
 * Freeze a draft DC for delivery. Refuses purchase/CTA/stall triggers.
 * Builds NaValidationContext from Session — never emptyNaValidation().
 */
export function freezeDraftForDelivery(
  draft: DecisionContext,
  opts: FreezeDraftForDeliveryOpts,
): FrozenDeliveryPackage {
  const sessionDc = opts.session.decision_context;
  if (!sessionDc) {
    throw new Error("freezeDraftForDelivery: session missing Decision Context");
  }
  if (sessionDc.context_id !== draft.context_id) {
    throw new Error(
      `freezeDraftForDelivery: session DC context_id=${sessionDc.context_id} draft=${draft.context_id}`,
    );
  }
  if (draft.status !== "draft") {
    throw new Error(`freezeDraftForDelivery: draft status=${draft.status}`);
  }

  const naValidation = buildNaValidationContextFromSession(opts.session, {
    ...opts.authority,
    nowIso: opts.now ?? opts.authority?.nowIso,
    // Freeze must aggregate the exact draft snapshot being frozen.
    realityFacts: draft.reality_facts,
    constraints: draft.constraints,
    explicitNaClassifications: draft.explicit_na_classifications,
  });

  const { frozen, version_snapshot } = freezeDecisionContext(draft, {
    stage3_sufficiency_end: true,
    from_purchase_or_report_cta: false,
    from_stall_or_max_turns: false,
    now: opts.now,
    naValidation,
    expectedSessionId: opts.session.session_id,
  });
  const binding = bindingFromDecisionContext(frozen);
  assertSnapshotMatchesBinding(frozen, binding);
  return { frozen, version_snapshot, binding };
}

/**
 * Resolve already-frozen session DC for delivery job input.
 * Prefer explicit version when provided.
 */
export function prepareFrozenDcForDelivery(
  slice: DecisionContextSessionSlice,
  opts?: { context_id?: string; version?: number; expected_hash?: string },
): {
  decision_context_snapshot: DecisionContext;
  decision_context_binding: DecisionContextBinding;
} {
  const { snapshot, binding } = resolveDecisionContextForReport(slice, opts);
  return {
    decision_context_snapshot: snapshot,
    decision_context_binding: binding,
  };
}

/** Merge freeze result into a session-like object (immutable return). */
export function applyFreezeToSessionSlice(
  slice: DecisionContextSessionSlice,
  pack: FrozenDeliveryPackage,
): DecisionContextSessionSlice {
  const versions = [...(slice.decision_context_versions ?? [])];
  const already = versions.some(
    (v) =>
      v.context_id === pack.version_snapshot.context_id &&
      v.version === pack.version_snapshot.version,
  );
  if (!already) versions.push(pack.version_snapshot);
  return {
    decision_context: pack.frozen,
    decision_context_versions: versions,
  };
}
