/**
 * S4 integration helper — Freeze → Delivery binding package.
 * Does not trigger purchase/CTA Freeze. Call only on Stage3 sufficiency end.
 * Production chat wiring should call prepareFrozenDcForDelivery then persist + POST delivery.
 */

import {
  computeContentHash,
  extractBusinessPayload,
} from "./content-hash";
import { freezeDecisionContext, type FreezeOptions } from "./freeze";
import type { NaValidationContext } from "./explicit-na-validate";
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

const BUSINESS_SLICES = [
  "reality_facts",
  "constraints",
  "explicit_na_evidence",
  "explicit_na_classifications",
  "conflicts",
  "dirs",
  "hypotheses",
  "definition",
  "information_boundaries",
] as const;

/**
 * Fail-closed: Session DC and caller draft must be the same business snapshot.
 * Uses C5 content-hash payload (excludes lifecycle timestamps / status container).
 */
export function assertSessionDraftBusinessSnapshotBound(
  session: POJUSessionState,
  draft: DecisionContext,
): DecisionContext {
  const sessionId = session.session_id?.trim();
  if (!sessionId) {
    throw new Error("freezeDraftForDelivery: session.session_id required");
  }
  const sessionDc = session.decision_context;
  if (!sessionDc) {
    throw new Error("freezeDraftForDelivery: session missing Decision Context");
  }
  if (sessionDc.context_id !== draft.context_id) {
    throw new Error(
      `freezeDraftForDelivery: context_id mismatch session=${sessionDc.context_id} draft=${draft.context_id}`,
    );
  }
  if (sessionDc.version !== draft.version) {
    throw new Error(
      `freezeDraftForDelivery: version mismatch session=${sessionDc.version} draft=${draft.version}`,
    );
  }
  if (sessionDc.status !== "draft") {
    throw new Error(
      `freezeDraftForDelivery: session DC status must be draft, got ${sessionDc.status}`,
    );
  }
  if (draft.status !== "draft") {
    throw new Error(
      `freezeDraftForDelivery: draft status must be draft, got ${draft.status}`,
    );
  }

  const sessionPayload = extractBusinessPayload(sessionDc);
  const draftPayload = extractBusinessPayload(draft);
  const mismatched: string[] = [];
  for (const key of BUSINESS_SLICES) {
    const a = JSON.stringify(sessionPayload[key] ?? null);
    const b = JSON.stringify(draftPayload[key] ?? null);
    if (a !== b) mismatched.push(key);
  }
  if (mismatched.length > 0) {
    throw new Error(
      `freezeDraftForDelivery: business snapshot mismatch on [${mismatched.join(", ")}]`,
    );
  }

  const sessionHash = computeContentHash(sessionDc);
  const draftHash = computeContentHash(draft);
  if (sessionHash !== draftHash) {
    throw new Error(
      `freezeDraftForDelivery: business content_hash mismatch session=${sessionHash} draft=${draftHash}`,
    );
  }

  // Authoritative freeze target = Session current DC (same business as draft).
  return sessionDc;
}

/**
 * Freeze-path NaValidationContext: Session SoT for confirmation / N/A actions /
 * topic eval rows. Caller authority may only supply catalog/CFP gap fields —
 * never replace Session event stores.
 */
export function buildFreezeNaValidationFromSession(
  session: POJUSessionState,
  authoritative: DecisionContext,
  opts?: { now?: string; authority?: NaValidationAuthorityOverrides },
): NaValidationContext {
  const raw = opts?.authority ?? {};
  // Strip Session-owned authority keys — even if present on opts.authority.
  const {
    confirmationEvents: _confirmationEvents,
    naDeclarationActions: _naDeclarationActions,
    topicEvalAuthority: _topicEvalAuthority,
    currentTopicCatalogVersion: _currentTopicCatalogVersion,
    realityFacts: _realityFacts,
    constraints: _constraints,
    explicitNaClassifications: _explicitNaClassifications,
    ...catalogOrCfpAuthority
  } = raw;

  const topicVersion =
    session.topic_catalog_version != null && session.topic_catalog_version !== ""
      ? session.topic_catalog_version
      : undefined;

  return buildNaValidationContextFromSession(session, {
    ...catalogOrCfpAuthority,
    nowIso: opts?.now ?? raw.nowIso,
    realityFacts: authoritative.reality_facts,
    constraints: authoritative.constraints,
    explicitNaClassifications: authoritative.explicit_na_classifications,
    // Hard Session SoT — cannot be overridden by opts.authority.
    confirmationEvents: session.confirmation_events ?? [],
    naDeclarationActions: session.na_declaration_actions ?? [],
    topicEvalAuthority: session.topic_applicability_evals,
    currentTopicCatalogVersion: topicVersion,
  });
}

/**
 * Freeze a draft DC for delivery. Refuses purchase/CTA/stall triggers.
 * Builds NaValidationContext from Session — never emptyNaValidation().
 * Draft must match Session DC business snapshot (facts/constraints/N/A/dirs/conflicts).
 */
export function freezeDraftForDelivery(
  draft: DecisionContext,
  opts: FreezeDraftForDeliveryOpts,
): FrozenDeliveryPackage {
  const authoritative = assertSessionDraftBusinessSnapshotBound(
    opts.session,
    draft,
  );

  const naValidation = buildFreezeNaValidationFromSession(
    opts.session,
    authoritative,
    { now: opts.now, authority: opts.authority },
  );

  const { frozen, version_snapshot } = freezeDecisionContext(authoritative, {
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
