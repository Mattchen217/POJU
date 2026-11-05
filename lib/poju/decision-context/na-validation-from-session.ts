/**
 * Production adapter: Session/DC → NaValidationContext for Intake aggregation.
 *
 * Populates every field that already has a Session/DC SoT.
 * Does NOT invent empty catalogs or default-PASS authority.
 * Missing production loaders are left undefined → N/A validate fail-closed.
 */

import type { POJUSessionState } from "@/lib/poju/types";
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
  DIR,
  ExplicitNaClassification,
  ExplicitNaEvidence,
  RealityFact,
} from "./types";

/**
 * Authority fields with no production Session/DC reader yet.
 * Do not paper over these with `[]` / fake PASS rows.
 */
export const PRODUCTION_NA_VALIDATION_SOURCE_GAPS = [
  "dirCatalog — no Session/DC DIR N/A catalog store or loader",
  "catalogConditionEvals — no production catalog-condition eval store",
  "topicRules — no production TopicApplicabilityRule store (Session only has topic_applicability_evals + topic_catalog_version)",
  "cfpSourceState — no production CFP live source-state reader wired into aggregation",
] as const;

export type NaValidationAuthorityOverrides = {
  nowIso?: string;
  realityFacts?: RealityFact[];
  constraints?: Constraint[];
  explicitNaClassifications?: ExplicitNaClassification[];
  confirmationEvents?: NaValidationContext["confirmationEvents"];
  naDeclarationActions?: NaValidationContext["naDeclarationActions"];
  /** Optional until a production catalog loader exists — never invent empty PASS. */
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
 * Build NaValidationContext from live Session + Decision Context.
 * Callers may pass authority overrides only when they have real production sources
 * (e.g. test harness seeding catalog rows, or a future catalog loader).
 */
export function buildNaValidationContextFromSession(
  session: POJUSessionState,
  overrides: NaValidationAuthorityOverrides = {},
): NaValidationContext {
  const dc = session.decision_context;
  if (!dc || (dc.status !== "draft" && dc.status !== "final")) {
    throw new Error("buildNaValidationContextFromSession: Decision Context missing");
  }

  const topicVersion =
    overrides.currentTopicCatalogVersion ??
    (session.topic_catalog_version != null && session.topic_catalog_version !== ""
      ? session.topic_catalog_version
      : undefined);

  return {
    contextId: dc.context_id,
    sessionId: session.session_id,
    realityFacts: overrides.realityFacts ?? dc.reality_facts,
    constraints: overrides.constraints ?? dc.constraints,
    confirmationEvents:
      overrides.confirmationEvents ?? session.confirmation_events ?? [],
    explicitNaClassifications:
      overrides.explicitNaClassifications ??
      dc.explicit_na_classifications ??
      [],
    naDeclarationActions:
      overrides.naDeclarationActions ?? session.na_declaration_actions ?? [],
    nowIso: overrides.nowIso,
    topicEvalAuthority:
      overrides.topicEvalAuthority ?? session.topic_applicability_evals,
    currentTopicCatalogVersion: topicVersion,
    // Gaps — only set when caller supplies real authority (no empty defaults).
    dirCatalog: overrides.dirCatalog,
    catalogConditionEvals: overrides.catalogConditionEvals,
    topicRules: overrides.topicRules,
    cfpSourceState: overrides.cfpSourceState,
  };
}

export type ReaggregateDirsOnSessionOpts = {
  realityFacts?: RealityFact[];
  constraints?: Constraint[];
  conflicts?: Conflict[];
  explicitNaEvidence?: ExplicitNaEvidence[];
  nowIso?: string;
  authority?: NaValidationAuthorityOverrides;
};

/**
 * Reaggregate DIR list for a Session using Intake resolver + Session-built NaValidationContext.
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
  const na = buildNaValidationContextFromSession(session, {
    ...opts.authority,
    realityFacts: facts,
    constraints,
    nowIso: opts.nowIso ?? opts.authority?.nowIso,
  });
  return reaggregateDirsIntake(
    dirs,
    facts,
    conflicts,
    constraints,
    evidence,
    na,
  );
}
