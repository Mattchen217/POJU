/**
 * Page02 per-section input field contracts (architecture SSOT).
 * Each field is traceable for later DI2 collection — presence alone is not enough.
 */

import type { Page02SectionId } from "./sections";
import type { Page02GapStatus } from "./gaps";

export const PAGE02_INPUT_SOURCE_KINDS = [
  "personal_analysis",
  "reality_context",
  "analytical_result",
  "system_metadata",
  "derived_data",
] as const;

export type Page02InputSourceKind =
  (typeof PAGE02_INPUT_SOURCE_KINDS)[number];

export type Page02InputFieldContract = {
  field_id: string;
  section_id: Page02SectionId;
  meaning: string;
  data_type: "string" | "string[]" | "object" | "object[]" | "boolean" | "enum";
  source_kind: Page02InputSourceKind;
  source_path: string;
  required: boolean;
  allow_empty: boolean;
  missing_handling:
    | "omit_dependent_units"
    | "block_page_generation"
    | "gap_note_only"
    | "use_empty_section_display";
  affects_content: string;
  follow_up_collect_hint: string;
  /** Cross-section / cross-page dependency note. */
  depends_on?: readonly string[];
};

export type Page02InputManifestEntry = {
  field_id: string;
  section_id: Page02SectionId;
  source_kind: Page02InputSourceKind;
  present: boolean;
  collection_status: Page02GapStatus | "ready";
  value_summary: string | null;
};

export const PAGE02_INPUT_FIELD_CONTRACTS: readonly Page02InputFieldContract[] =
  [
    // --- page_summary ---
    {
      field_id: "page01_core_judgment",
      section_id: "page_summary",
      meaning: "Page01 core judgment text for alignment (not to copy).",
      data_type: "string",
      source_kind: "analytical_result",
      source_path: "page01.core_judgment.text",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "page_summary + why_judgment_fits framing",
      follow_up_collect_hint: "Ensure Page01 is generated and approved first.",
      depends_on: ["report_locale"],
    },
    {
      field_id: "page01_why_paths",
      section_id: "page_summary",
      meaning: "Page01 why_this_path summaries for alignment context only.",
      data_type: "object[]",
      source_kind: "analytical_result",
      source_path: "page01.why_this_path[]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "page_summary framing depth",
      follow_up_collect_hint: "Generated with Page01; not user-collected.",
      depends_on: ["page01_core_judgment"],
    },
    {
      field_id: "decision_question",
      section_id: "page_summary",
      meaning: "User decision question from Decision Context.",
      data_type: "string",
      source_kind: "reality_context",
      source_path: "dc.definition.decision_question",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all Page02 framing",
      follow_up_collect_hint: "Collect a clear decision question in intake.",
    },
    {
      field_id: "report_locale",
      section_id: "page_summary",
      meaning: "Output locale for vernacular body.",
      data_type: "string",
      source_kind: "system_metadata",
      source_path: "report.locale",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all user-facing text",
      follow_up_collect_hint: "Set report locale before generation.",
    },

    // --- relevant_personal_factors ---
    {
      field_id: "available_personal_domains",
      section_id: "relevant_personal_factors",
      meaning: "Which personal domains (bazi/ziwei/…) are available.",
      data_type: "string[]",
      source_kind: "system_metadata",
      source_path: "production.available_domains",
      required: false,
      allow_empty: true,
      missing_handling: "use_empty_section_display",
      affects_content: "personal_interpretation.source_domain allowlist",
      follow_up_collect_hint: "Optional chart availability; never invent domains.",
    },
    {
      field_id: "personal_profile_version",
      section_id: "relevant_personal_factors",
      meaning: "Version/hash of personal analysis profile used (CFP/ZFP provenance).",
      data_type: "string",
      source_kind: "personal_analysis",
      source_path: "production.profile_version | pack.cfp_hash/zfp_hash",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "provenance notes on personal_interpretation units",
      follow_up_collect_hint:
        "Ensure chart fact packs are computed so profile_version is stamped.",
      depends_on: ["available_personal_domains"],
    },
    {
      field_id: "personal_readings_payload",
      section_id: "relevant_personal_factors",
      meaning:
        "Approved personal reading objects (id, domain, excerpt) — not a boolean flag.",
      data_type: "object[]",
      source_kind: "personal_analysis",
      source_path: "slice.personal_analysis.approved_readings[]",
      required: false,
      allow_empty: true,
      missing_handling: "use_empty_section_display",
      affects_content: "relevant_personal_factors personal_interpretation units",
      follow_up_collect_hint:
        "Need reading_id + domain + short certified excerpt; do not invent readings.",
      depends_on: ["available_personal_domains", "personal_profile_version"],
    },
    {
      field_id: "book_judgment_destiny_units",
      section_id: "relevant_personal_factors",
      meaning: "BookJudgment destiny/convergence units serving face 02.",
      data_type: "object[]",
      source_kind: "analytical_result",
      source_path: "pack.units[track=destiny|convergence & serves_face=02]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "personal claim seeds for section B",
      follow_up_collect_hint: "Produced by BookJudgment pack step before Page02 body.",
      depends_on: ["personal_readings_payload"],
    },

    // --- personal_reality_interplay ---
    {
      field_id: "confirmed_reality_facts_payload",
      section_id: "personal_reality_interplay",
      meaning:
        "Confirmed DC facts with statement, status, verification_level, source, related_dir_ids.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=confirmed]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "reality_fact units and confirmed boundary lists",
      follow_up_collect_hint:
        "Collect fact statement + roles; user confirm before status=confirmed.",
    },
    {
      field_id: "reality_mechanism_inputs",
      section_id: "personal_reality_interplay",
      meaning:
        "Inputs for reality_mechanism units: constraints, fact roles, linked science claims.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.constraints[] + registry.evidence[source_type=reality_mechanism]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "reality_mechanism units in interplay / why-fit",
      follow_up_collect_hint:
        "Collect hard/soft constraints and mechanism-relevant roles; never invent.",
      depends_on: ["confirmed_reality_facts_payload"],
    },
    {
      field_id: "book_judgment_science_units",
      section_id: "personal_reality_interplay",
      meaning: "BookJudgment science units serving face 02 (mechanism seeds).",
      data_type: "object[]",
      source_kind: "analytical_result",
      source_path: "pack.units[track=science & serves_face=02]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "science claim seeds for interplay",
      follow_up_collect_hint: "Produced by BookJudgment pack step before Page02 body.",
    },

    // --- why_judgment_fits ---
    {
      field_id: "evidence_registry_claims",
      section_id: "why_judgment_fits",
      meaning: "Page02-slice evidence registry claims the model may cite.",
      data_type: "object[]",
      source_kind: "derived_data",
      source_path: "registry.claims[page02_slice]",
      required: true,
      allow_empty: false,
      missing_handling: "block_page_generation",
      affects_content: "all claim_ids on content_units",
      follow_up_collect_hint:
        "Ensure BookJudgment / registry seeding produced Page02 claims.",
      depends_on: ["page01_core_judgment", "decision_question"],
    },
    {
      field_id: "page01_recommendation_conditions",
      section_id: "why_judgment_fits",
      meaning:
        "Page01 recommendation_conditions (status + source_ids) that Page02 may explain conditionally.",
      data_type: "object[]",
      source_kind: "analytical_result",
      source_path: "page01.recommendation_conditions[]",
      required: false,
      allow_empty: true,
      missing_handling: "omit_dependent_units",
      affects_content: "conditional_explanation units tied to Page01 conditions",
      follow_up_collect_hint:
        "Generated with Page01; clarify unconfirmed condition source_ids in intake.",
      depends_on: ["page01_core_judgment"],
    },
    {
      field_id: "conditional_explanation_deps",
      section_id: "why_judgment_fits",
      meaning:
        "Condition dependencies: which confirmed/unverified facts or Page01 conditions bound fit language.",
      data_type: "object[]",
      source_kind: "derived_data",
      source_path: "derived from confirmed/unverified facts + page01 conditions",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "conditional_explanation related_reality_fact_unit_ids",
      follow_up_collect_hint:
        "Clarify which conditions must hold for the judgment fit to remain valid.",
      depends_on: [
        "confirmed_reality_facts_payload",
        "page01_recommendation_conditions",
      ],
    },

    // --- explanation_boundary ---
    {
      field_id: "unverified_reality_facts_payload",
      section_id: "explanation_boundary",
      meaning:
        "Unverified DC facts with statement/status/verification_level — must not upgrade.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status=unverified]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "hypothesis_unit_ids / uncertainty_notes",
      follow_up_collect_hint: "Verify or clarify unverified facts in intake.",
    },
    {
      field_id: "declined_or_unknown_facts",
      section_id: "explanation_boundary",
      meaning: "DC facts with declined/unknown/not_applicable status.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.reality_facts[status in declined|unknown|not_applicable]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "boundary gap notes; omit as confirmed",
      follow_up_collect_hint:
        "Respect declined; clarify unknown; mark N/A explicitly when applicable.",
    },
    {
      field_id: "open_conflicts",
      section_id: "explanation_boundary",
      meaning: "Unresolved DC conflicts that bound explanations.",
      data_type: "object[]",
      source_kind: "reality_context",
      source_path: "dc.conflicts[state!=clarified]",
      required: false,
      allow_empty: true,
      missing_handling: "gap_note_only",
      affects_content: "uncertainty_notes and conditional language",
      follow_up_collect_hint: "Clarify conflicting statements in intake.",
    },
  ] as const;

export function page02InputContractsForSection(
  sectionId: Page02SectionId,
): Page02InputFieldContract[] {
  return PAGE02_INPUT_FIELD_CONTRACTS.filter((c) => c.section_id === sectionId);
}

export function page02InputContractById(
  fieldId: string,
): Page02InputFieldContract | null {
  return (
    PAGE02_INPUT_FIELD_CONTRACTS.find((c) => c.field_id === fieldId) ?? null
  );
}
