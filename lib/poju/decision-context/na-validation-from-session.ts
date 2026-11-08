/**
 * Production adapter: Session/DC → NaValidationContext for Intake aggregation.
 *
 * Two separated paths:
 * - Production authority path: `buildProductionNaValidationContextFromSession`
 *   (Freeze / Versioning / Lifecycle reaggregation / Ask). Reads only Session,
 *   current DC and `loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)`. No caller
 *   authority entry.
 * - Fixture path (TEST ONLY): `naValidationBoundToDc` + `NaValidationFixtureOverrides`.
 *   Production modules must not import or wrap these.
 *
 * Fields with no production source stay undefined → N/A validate fail-closed.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import {
  ACTIVE_DIR_NA_CATALOG_VERSION,
  loadDirNaCatalog,
  type DirNaCatalogLoadResult,
} from "./catalog";
import { reaggregateDirsIntake } from "./dir-aggregator-intake";
import type {
  CatalogNaConditionEval,
  DirNaCatalogEntry,
  NaValidationContext,
  TopicApplicabilityRule,
} from "./explicit-na-validate";
import type { AuthoritativeTopicEvalRecord } from "./topic-eval-authority";
import type {
  Conflict,
  Constraint,
  DecisionContext,
  DIR,
  ExplicitNaClassification,
  ExplicitNaEvidence,
  RealityFact,
} from "./types";

/**
 * DIR N/A Catalog production source (S1 ACTIVE loader). Not a gap.
 */
export const PRODUCTION_NA_VALIDATION_DIR_CATALOG_SOURCE =
  "loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)" as const;

/**
 * Authority fields with no production Session/DC reader yet.
 * Production builder leaves them undefined; do not paper over with `[]` / fake PASS rows.
 */
export const PRODUCTION_NA_VALIDATION_SOURCE_GAPS = [
  "catalogConditionEvals — no production catalog-condition eval store",
  "topicRules — no production TopicApplicabilityRule store (Session only has topic_applicability_evals + topic_catalog_version)",
  "cfpSourceState — no production CFP live source-state reader wired into aggregation",
] as const;

type DirNaCatalogLoadFailureReason = Extract<
  DirNaCatalogLoadResult,
  { ok: false }
>["reason_code"];

/** ACTIVE DIR N/A Catalog could not be loaded — production path fails closed. */
export class ProductionNaAuthorityError extends Error {
  readonly reason_code: DirNaCatalogLoadFailureReason;

  constructor(reason_code: DirNaCatalogLoadFailureReason) {
    super(reason_code);
    this.name = "ProductionNaAuthorityError";
    this.reason_code = reason_code;
  }
}

/** Non-authority options only. */
export type ProductionNaValidationBuildOpts = {
  readonly nowIso?: string;
};

/**
 * Sole production NaValidationContext builder.
 * - Session SoT: confirmation_events, na_declaration_actions,
 *   topic_applicability_evals, topic_catalog_version.
 * - DC SoT: reality_facts, constraints, explicit_na_classifications.
 * - DIR Catalog: ACTIVE loader only; load failure throws (no empty substitute).
 * - topicRules / catalogConditionEvals / cfpSourceState: no production source → unset.
 */
export function buildProductionNaValidationContextFromSession(
  session: POJUSessionState,
  opts: ProductionNaValidationBuildOpts = {},
): NaValidationContext {
  const dc = session.decision_context;
  if (!dc || (dc.status !== "draft" && dc.status !== "final")) {
    throw new Error(
      "buildProductionNaValidationContextFromSession: Decision Context missing",
    );
  }
  if (!session.session_id?.trim()) {
    throw new Error(
      "buildProductionNaValidationContextFromSession: session_id required",
    );
  }

  const load = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION);
  if (!load.ok) {
    throw new ProductionNaAuthorityError(load.reason_code);
  }

  const topicVersion =
    session.topic_catalog_version != null && session.topic_catalog_version !== ""
      ? session.topic_catalog_version
      : undefined;

  return {
    contextId: dc.context_id,
    sessionId: session.session_id,
    realityFacts: dc.reality_facts,
    constraints: dc.constraints,
    confirmationEvents: session.confirmation_events ?? [],
    explicitNaClassifications: dc.explicit_na_classifications ?? [],
    naDeclarationActions: session.na_declaration_actions ?? [],
    nowIso: opts.nowIso,
    topicEvalAuthority: session.topic_applicability_evals,
    currentTopicCatalogVersion: topicVersion,
    dirCatalog: load.entries,
  };
}

/**
 * Fail-closed Session/DC binding for Freeze / Versioning / aggregation.
 * Does not invent catalogs — only checks identity alignment.
 */
export function assertNaValidationBoundToDc(
  na: NaValidationContext,
  dc: DecisionContext,
  expectedSessionId?: string,
): void {
  if (!na.contextId || na.contextId !== dc.context_id) {
    throw new Error(
      `NaValidationContext.contextId mismatch: na=${na.contextId} dc=${dc.context_id}`,
    );
  }
  if (expectedSessionId != null && na.sessionId !== expectedSessionId) {
    throw new Error(
      `NaValidationContext.sessionId mismatch: na=${na.sessionId} expected=${expectedSessionId}`,
    );
  }
  if (!na.sessionId) {
    throw new Error("NaValidationContext.sessionId required");
  }
}

/**
 * Rebind DC-owned facts/constraints/classifications to an in-flight DC snapshot
 * (post-conflict Freeze draft, V2 draft, lifecycle mutation). Session-owned
 * authority and dirCatalog are carried over unchanged from `na`.
 */
export function naValidationForDcSnapshot(
  na: NaValidationContext,
  dc: DecisionContext,
): NaValidationContext {
  assertNaValidationBoundToDc(na, dc, na.sessionId);
  return {
    ...na,
    contextId: dc.context_id,
    realityFacts: dc.reality_facts,
    constraints: dc.constraints,
    explicitNaClassifications: dc.explicit_na_classifications ?? [],
  };
}

/**
 * TEST / FIXTURE ONLY — explicit injection for pure-function validation tests.
 * Production modules must not import, re-export or wrap this type.
 */
export type NaValidationFixtureOverrides = {
  nowIso?: string;
  realityFacts?: RealityFact[];
  constraints?: Constraint[];
  explicitNaClassifications?: ExplicitNaClassification[];
  confirmationEvents?: NaValidationContext["confirmationEvents"];
  naDeclarationActions?: NaValidationContext["naDeclarationActions"];
  dirCatalog?: ReadonlyMap<string, DirNaCatalogEntry> | readonly DirNaCatalogEntry[];
  catalogConditionEvals?:
    | ReadonlyMap<string, CatalogNaConditionEval>
    | readonly CatalogNaConditionEval[];
  topicRules?:
    | ReadonlyMap<string, TopicApplicabilityRule>
    | readonly TopicApplicabilityRule[];
  topicEvalAuthority?:
    | ReadonlyMap<string, AuthoritativeTopicEvalRecord>
    | readonly AuthoritativeTopicEvalRecord[];
  currentTopicCatalogVersion?: string;
  cfpSourceState?: NaValidationContext["cfpSourceState"];
};

/**
 * TEST / FIXTURE ONLY — bind ids + DC facts; every authority field comes from
 * explicit `overrides`. Never called by production Freeze / Versioning /
 * Lifecycle / Ask (those use buildProductionNaValidationContextFromSession).
 */
export function naValidationBoundToDc(
  dc: DecisionContext,
  sessionId: string,
  overrides: NaValidationFixtureOverrides = {},
): NaValidationContext {
  if (!sessionId.trim()) {
    throw new Error("naValidationBoundToDc: sessionId required");
  }
  return {
    contextId: dc.context_id,
    sessionId,
    realityFacts: overrides.realityFacts ?? dc.reality_facts,
    constraints: overrides.constraints ?? dc.constraints,
    confirmationEvents: overrides.confirmationEvents ?? [],
    explicitNaClassifications:
      overrides.explicitNaClassifications ??
      dc.explicit_na_classifications ??
      [],
    naDeclarationActions: overrides.naDeclarationActions ?? [],
    nowIso: overrides.nowIso,
    topicEvalAuthority: overrides.topicEvalAuthority,
    currentTopicCatalogVersion: overrides.currentTopicCatalogVersion,
    dirCatalog: overrides.dirCatalog,
    catalogConditionEvals: overrides.catalogConditionEvals,
    topicRules: overrides.topicRules,
    cfpSourceState: overrides.cfpSourceState,
  };
}

/** DC mutation-flow inputs only — no authority fields. */
export type ReaggregateDirsOnSessionOpts = {
  realityFacts?: RealityFact[];
  constraints?: Constraint[];
  conflicts?: Conflict[];
  explicitNaEvidence?: ExplicitNaEvidence[];
  nowIso?: string;
};

/**
 * Reaggregate DIR list for a Session using Intake resolver + production
 * NaValidationContext. In-flight facts/constraints rebind via
 * naValidationForDcSnapshot; Session authority + ACTIVE catalog are unchanged.
 */
export function reaggregateDirsOnSession(
  session: POJUSessionState,
  dirs: DIR[],
  opts: ReaggregateDirsOnSessionOpts = {},
): DIR[] {
  const dc = session.decision_context;
  if (!dc) {
    throw new Error("reaggregateDirsOnSession: Decision Context missing");
  }
  const facts = opts.realityFacts ?? dc.reality_facts;
  const constraints = opts.constraints ?? dc.constraints;
  const conflicts = opts.conflicts ?? dc.conflicts;
  const evidence = opts.explicitNaEvidence ?? dc.explicit_na_evidence ?? [];
  const na = naValidationForDcSnapshot(
    buildProductionNaValidationContextFromSession(session, {
      nowIso: opts.nowIso,
    }),
    { ...dc, reality_facts: facts, constraints },
  );
  return reaggregateDirsIntake(
    dirs,
    facts,
    conflicts,
    constraints,
    evidence,
    na,
  );
}
