/**
 * Production adapter: Session/DC → NaValidationContext for Intake aggregation.
 *
 * Two separated paths:
 * - Production authority path: `buildProductionNaValidationContextFromSession`
 *   (Freeze / Versioning / Lifecycle reaggregation / Ask). Reads only Session,
 *   current DC, ACTIVE DIR N/A Catalog, ACTIVE Topic Applicability Rules, and
 *   live CFP reader. No caller authority entry.
 * - Fixture path (TEST ONLY): `naValidationBoundToDc` + `NaValidationFixtureOverrides`.
 *   Production modules must not import or wrap these.
 *
 * catalogConditionEvals: no deterministic machine rules for ACTIVE explicit_*
 * conditions — left unset (fail-closed). Do not paper over with `[]` / fake PASS.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import {
  ACTIVE_DIR_NA_CATALOG_VERSION,
  ACTIVE_TOPIC_APPLICABILITY_VERSION,
  loadDirNaCatalog,
  loadTopicApplicability,
  type DirNaCatalogLoadResult,
  type TopicApplicabilityLoadResult,
  type TopicApplicabilityRuleDefinition,
} from "./catalog";
import { reaggregateDirsIntake } from "./dir-aggregator-intake";
import type {
  CatalogNaConditionEval,
  DirNaCatalogEntry,
  NaValidationContext,
  TopicApplicabilityRule,
} from "./explicit-na-validate";
import { readLiveCfpSourceState } from "./live-cfp-source";
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
 * Topic Applicability Rules production source (S9 ACTIVE loader). Not a gap.
 */
export const PRODUCTION_NA_VALIDATION_TOPIC_RULES_SOURCE =
  "loadTopicApplicability(ACTIVE_TOPIC_APPLICABILITY_VERSION)+SessionEvals" as const;

/**
 * Live CFP production source (S9 reader). Not a gap when reader ok;
 * reader failure leaves cfpSourceState unset (fail-closed).
 */
export const PRODUCTION_NA_VALIDATION_CFP_SOURCE =
  "readLiveCfpSourceState(session)" as const;

/**
 * Authority fields still without a production deterministic source.
 * Production builder leaves them undefined; do not paper over with `[]` / fake PASS rows.
 *
 * ACTIVE DIR na_conditions are predominantly explicit_* user-declaration tokens.
 * No code SSOT machine evaluator exists for them in S9 — keep fail-closed.
 */
export const PRODUCTION_NA_VALIDATION_SOURCE_GAPS = [
  "catalogConditionEvals — ACTIVE DIR conditions are explicit_* user declarations; no deterministic machine evaluator SSOT (fail-closed)",
] as const;

type ProductionAuthorityFailureReason =
  | Extract<DirNaCatalogLoadResult, { ok: false }>["reason_code"]
  | Extract<TopicApplicabilityLoadResult, { ok: false }>["reason_code"];

/** ACTIVE catalog/rules could not be loaded — production path fails closed. */
export class ProductionNaAuthorityError extends Error {
  readonly reason_code: ProductionAuthorityFailureReason;

  constructor(reason_code: ProductionAuthorityFailureReason) {
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
 * Join ACTIVE Topic Rule definitions with Session eval authority.
 * Embedded evaluation is derived from Session rows only — never from client rules.
 * Definitions without a Session eval still appear so unregistered client rule_ids fail
 * as topic_rule_missing / topic_evaluation_* rather than silently accepting forgeries.
 */
export function composeTopicRulesFromActiveAndSession(
  definitions: readonly TopicApplicabilityRuleDefinition[],
  sessionEvals: readonly AuthoritativeTopicEvalRecord[] | undefined,
): TopicApplicabilityRule[] {
  const evals = sessionEvals ?? [];
  const out: TopicApplicabilityRule[] = [];
  for (const def of definitions) {
    const match =
      evals.find(
        (e) => e.rule_id === def.rule_id && e.record_status === "current",
      ) ?? evals.find((e) => e.rule_id === def.rule_id);
    if (match) {
      out.push({
        rule_id: def.rule_id,
        topic_code: def.topic_code,
        target_dir_id: def.target_dir_id,
        evaluation: {
          eval_id: match.eval_id,
          evaluated_at: match.evaluated_at,
          status:
            match.record_status === "current"
              ? "current"
              : match.record_status,
          not_applicable: match.not_applicable,
          expires_at: match.expires_at,
          catalog_version: match.catalog_version,
        },
      });
    } else {
      out.push({
        rule_id: def.rule_id,
        topic_code: def.topic_code,
        target_dir_id: def.target_dir_id,
        evaluation: {
          eval_id: "",
          evaluated_at: "",
          status: "stale",
          not_applicable: false,
          expires_at: null,
          catalog_version: def.catalog_version,
        },
      });
    }
  }
  return out;
}

/**
 * Sole production NaValidationContext builder (async — live CFP re-read).
 * - Session SoT: confirmation_events, na_declaration_actions,
 *   topic_applicability_evals, topic_catalog_version.
 * - DC SoT: reality_facts, constraints, explicit_na_classifications.
 * - DIR Catalog: ACTIVE loader only; load failure throws (no empty substitute).
 * - Topic Rules: ACTIVE loader + Session evals; caller topicRules ignored.
 * - CFP: live reader each call; failure → unset (fail-closed), never default absent.
 * - catalogConditionEvals: unset (no deterministic SSOT yet).
 * T2 fields overwrite any caller-held values by construction (no merge API).
 */
export async function buildProductionNaValidationContextFromSession(
  session: POJUSessionState,
  opts: ProductionNaValidationBuildOpts = {},
): Promise<NaValidationContext> {
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

  const dirLoad = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION);
  if (!dirLoad.ok) {
    throw new ProductionNaAuthorityError(dirLoad.reason_code);
  }

  const topicLoad = loadTopicApplicability(ACTIVE_TOPIC_APPLICABILITY_VERSION);
  if (!topicLoad.ok) {
    throw new ProductionNaAuthorityError(topicLoad.reason_code);
  }

  // Session may pin a version string; production authority version is ACTIVE.
  // Validator compares Session eval catalog_version to currentTopicCatalogVersion.
  const topicVersion = ACTIVE_TOPIC_APPLICABILITY_VERSION;
  // If Session claims a non-ACTIVE topic catalog version, keep that string so
  // resolveAuthoritativeTopicEval fails closed as topic_catalog_version_stale
  // when evals were minted against an old catalog.
  const sessionTopicVersion =
    session.topic_catalog_version != null &&
    session.topic_catalog_version !== ""
      ? session.topic_catalog_version
      : undefined;
  const currentTopicCatalogVersion = sessionTopicVersion ?? topicVersion;

  const topicRules = composeTopicRulesFromActiveAndSession(
    topicLoad.rules,
    session.topic_applicability_evals,
  );

  const cfpRead = await readLiveCfpSourceState(session, {
    nowIso: opts.nowIso,
  });
  // Reader ok:false → leave unset (fail-closed). Never invent source_absent.
  const cfpSourceState = cfpRead.ok ? cfpRead.state : undefined;

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
    currentTopicCatalogVersion,
    dirCatalog: dirLoad.entries,
    topicRules,
    cfpSourceState,
    // catalogConditionEvals intentionally omitted (SOURCE_GAP).
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
 * authority and dirCatalog / topicRules / cfp are carried over unchanged from `na`.
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
 * naValidationForDcSnapshot; Session authority + ACTIVE catalogs are unchanged.
 */
export async function reaggregateDirsOnSession(
  session: POJUSessionState,
  dirs: DIR[],
  opts: ReaggregateDirsOnSessionOpts = {},
): Promise<DIR[]> {
  const dc = session.decision_context;
  if (!dc) {
    throw new Error("reaggregateDirsOnSession: Decision Context missing");
  }
  const facts = opts.realityFacts ?? dc.reality_facts;
  const constraints = opts.constraints ?? dc.constraints;
  const conflicts = opts.conflicts ?? dc.conflicts;
  const evidence = opts.explicitNaEvidence ?? dc.explicit_na_evidence ?? [];
  const na = naValidationForDcSnapshot(
    await buildProductionNaValidationContextFromSession(session, {
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
