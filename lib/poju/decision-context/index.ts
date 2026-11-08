/**
 * Decision Context public barrel.
 * Phase 2: persist wired to session-manager C1 (blob + cycle); Gate/Opening/CallA/B/Collecting not production-wired.
 * Phase 3 S3: ControlPlane + Confirmation Event + Opening Anchor formal modules.
 * Phase 3 S4: Normalization + Fingerprint + Mapper (Opening Seed / Call A / Call B).
 * Product Stage 4: frozen DC read-bound + page feed + P5/P6/P8 report helpers.
 */

export * from "./types";
export * from "./fact-combination";
export * from "./normalize";
export * from "./normalize-call-a";
export * from "./normalize-call-b";
export * from "./fingerprint";
export * from "./opening-seed";
export * from "./hypothesis-from-core";
export * from "./dir-from-agenda";
export * from "./dir-aggregator";
export * from "./dir-aggregator-intake";
export * from "./role-resolver";
export * from "./explicit-na-validate";
export * from "./catalog";
// Explicit list: the fixture builder/type in this module are test-only and stay off the barrel.
export {
  PRODUCTION_NA_VALIDATION_DIR_CATALOG_SOURCE,
  PRODUCTION_NA_VALIDATION_SOURCE_GAPS,
  ProductionNaAuthorityError,
  buildProductionNaValidationContextFromSession,
  assertNaValidationBoundToDc,
  naValidationForDcSnapshot,
  reaggregateDirsOnSession,
} from "./na-validation-from-session";
export type {
  ProductionNaValidationBuildOpts,
  ReaggregateDirsOnSessionOpts,
} from "./na-validation-from-session";
export * from "./question-planning";
export * from "./question-plan-cycle";
export * from "./production-intake-ask";
export * from "./na-declaration";
export * from "./topic-eval-authority";
export * from "./conflict-lifecycle";
export * from "./stop-criteria";
export * from "./content-hash";
export * from "./freeze";
export * from "./versioning";
export * from "./persist";
export * from "./control-plane";
export * from "./confirmation-event";
export * from "./opening-anchor";
export * from "./read-bound";
export * from "./dc-page-feed";
export * from "./stage4-report";
export * from "./freeze-to-delivery";
export * from "./require-dc-flag";
export * from "./production-freeze-wire";
export * from "./production-versioning";
export * from "./production-dc-lifecycle";
