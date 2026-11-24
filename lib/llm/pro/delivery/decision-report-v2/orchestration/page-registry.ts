/**
 * Eight-page production registry — aligned to accepted page contracts.
 * Batch 1: SSOT only. Does not invent dependencies beyond production builders.
 */

import { FACE01_PROMPT_VERSION, FACE01_SCHEMA_VERSION } from "../page01/production";
import {
  FACE02_PROMPT_VERSION,
  FACE02_SCHEMA_VERSION,
} from "../page02/production";
import { PAGE02_ARCHITECTURE_PROMPT_VERSION } from "../page02/architecture/prompt-templates";
import { PAGE04_ARCHITECTURE_PROMPT_VERSION } from "../page04/architecture/prompt-templates";
import { PAGE05_ARCHITECTURE_PROMPT_VERSION } from "../page05/architecture/prompt-templates";
import { PAGE06_ARCHITECTURE_PROMPT_VERSION } from "../page06/architecture/prompt-templates";
import { PAGE07_ARCHITECTURE_PROMPT_VERSION } from "../page07/architecture/prompt-templates";
import { PAGE08_ARCHITECTURE_PROMPT_VERSION } from "../page08/architecture/prompt-templates";
import {
  REPORT_PAGE_IDS,
  type ReportDerivedNodeDefinition,
  type ReportPageDefinition,
  type ReportPageId,
  type ReportSharedInputKey,
} from "./types";

/**
 * Shared keys every Face production context consumes after face-specific
 * filtering (see buildFaceXXProductionContext + seedEvidenceRegistryForFaceXX).
 *
 * Page01/02 personal_computation_slice includes ziwei when available;
 * Page04–08 builders pass ziwei_fact_pack: null — their personal slice excludes ziwei.
 * Callers must hash the *filtered* slice for each page, not the whole-job bag.
 */
const STANDARD_SHARED_INPUT_KEYS = [
  "locale",
  "dc_slice_fingerprint",
  "personal_computation_slice_fingerprint",
  "approved_readings_slice_fingerprint",
  "evidence_registry_slice_fingerprint",
] as const satisfies readonly ReportSharedInputKey[];

/** @deprecated Prefer per-page production_version on each registry entry. */
export const REPORT_PAGE_PRODUCTION_VERSION =
  "report-page-prod-2026-11-24" as const;

/** Per-page production contract versions — bump only the affected page. */
export const PAGE_PRODUCTION_VERSIONS = {
  "01": "page01-prod-2026-11-24",
  "02": "page02-prod-2026-11-24",
  "04": "page04-prod-2026-11-24",
  "05": "page05-prod-2026-11-24",
  "06": "page06-prod-2026-11-24",
  "07": "page07-prod-2026-11-24",
  "08": "page08-prod-2026-11-24",
} as const satisfies Record<ReportPageId, string>;

/**
 * Per-page validator stamps (orchestration-side). Independent of prompt/schema.
 * Bump when that page's validator / fact-integrity rules change.
 */
export const PAGE_VALIDATOR_VERSIONS = {
  "01": "page01-validator-2026-11-24",
  "02": "page02-validator-2026-11-24",
  "04": "page04-validator-2026-11-24",
  "05": "page05-validator-2026-11-24",
  "06": "page06-validator-2026-11-24",
  "07": "page07-validator-2026-11-24",
  "08": "page08-validator-2026-11-24",
} as const satisfies Record<ReportPageId, string>;

/**
 * Required upstream page edges from accepted Batch 1 contracts + instruction DAG.
 * Shared DC / personal / registry inputs are NOT page edges — they live in fingerprints.
 */
export const REPORT_PAGE_REGISTRY: readonly ReportPageDefinition[] = [
  {
    page_id: "01",
    required_upstream: [],
    optional_upstream: [],
    output_schema_version: FACE01_SCHEMA_VERSION,
    prompt_version: FACE01_PROMPT_VERSION,
    validator_version: PAGE_VALIDATOR_VERSIONS["01"],
    production_version: PAGE_PRODUCTION_VERSIONS["01"],
    conditional: false,
    model_generation: true,
    shared_input_keys: STANDARD_SHARED_INPUT_KEYS,
    notes:
      "Independent start from shared immutable inputs. Must not wait on Page02. " +
      "Consumes face01-filtered DC facts, pack/chart/ziwei domains, seeded readings, face01 registry.",
  },
  {
    page_id: "02",
    required_upstream: [],
    optional_upstream: [],
    output_schema_version: FACE02_SCHEMA_VERSION,
    prompt_version: FACE02_PROMPT_VERSION,
    validator_version: PAGE_VALIDATOR_VERSIONS["02"],
    production_version: PAGE_PRODUCTION_VERSIONS["02"],
    conditional: false,
    model_generation: true,
    shared_input_keys: STANDARD_SHARED_INPUT_KEYS,
    notes: `Independent start parallel with Page01. Architecture bundle=${PAGE02_ARCHITECTURE_PROMPT_VERSION}. ` +
      "Consumes face02-filtered DC/pack/readings/registry (ziwei when available). Optional page01 alignment is not fingerprinted.",
  },
  {
    page_id: "04",
    required_upstream: ["01", "02"],
    optional_upstream: [],
    output_schema_version: "face04-v2",
    prompt_version: PAGE04_ARCHITECTURE_PROMPT_VERSION,
    validator_version: PAGE_VALIDATOR_VERSIONS["04"],
    production_version: PAGE_PRODUCTION_VERSIONS["04"],
    conditional: false,
    model_generation: true,
    shared_input_keys: STANDARD_SHARED_INPUT_KEYS,
    notes:
      "Waits for Page01 and Page02. Consumes face04-restricted registry claims/evidence; no ziwei pack.",
  },
  {
    page_id: "05",
    required_upstream: ["01", "02", "04"],
    optional_upstream: [],
    output_schema_version: "face05-v2",
    prompt_version: PAGE05_ARCHITECTURE_PROMPT_VERSION,
    validator_version: PAGE_VALIDATOR_VERSIONS["05"],
    production_version: PAGE_PRODUCTION_VERSIONS["05"],
    conditional: false,
    model_generation: true,
    shared_input_keys: STANDARD_SHARED_INPUT_KEYS,
    notes: "Waits for Page04. Consumes face05-restricted registry slice.",
  },
  {
    page_id: "06",
    required_upstream: ["01", "02", "04", "05"],
    optional_upstream: [],
    output_schema_version: "face06-v2",
    prompt_version: PAGE06_ARCHITECTURE_PROMPT_VERSION,
    validator_version: PAGE_VALIDATOR_VERSIONS["06"],
    production_version: PAGE_PRODUCTION_VERSIONS["06"],
    conditional: false,
    model_generation: true,
    shared_input_keys: STANDARD_SHARED_INPUT_KEYS,
    notes: "Waits for Page05. Consumes face06-restricted registry slice.",
  },
  {
    page_id: "07",
    required_upstream: ["01", "02", "04", "05", "06"],
    optional_upstream: [],
    output_schema_version: "face07-v2",
    prompt_version: PAGE07_ARCHITECTURE_PROMPT_VERSION,
    validator_version: PAGE_VALIDATOR_VERSIONS["07"],
    production_version: PAGE_PRODUCTION_VERSIONS["07"],
    conditional: true,
    model_generation: true,
    shared_input_keys: STANDARD_SHARED_INPUT_KEYS,
    notes:
      "Conditional. Upstream-ready → applicability gate only. Model generation only when applicable. " +
      "Consumes face07-restricted registry + DC applicability inputs.",
  },
  {
    page_id: "08",
    required_upstream: ["01", "02", "04", "05", "06", "07"],
    optional_upstream: [],
    output_schema_version: "face08-v2",
    prompt_version: PAGE08_ARCHITECTURE_PROMPT_VERSION,
    validator_version: PAGE_VALIDATOR_VERSIONS["08"],
    production_version: PAGE_PRODUCTION_VERSIONS["08"],
    conditional: false,
    model_generation: true,
    shared_input_keys: STANDARD_SHARED_INPUT_KEYS,
    notes:
      "Requires Page07 terminal status (completed | not_applicable | insufficient_information). " +
      "Consumes face08-restricted registry slice.",
  },
] as const;

/**
 * Glossary appendix is a derived node — not a Face page in REPORT_PAGE_IDS.
 * Must wait for every page's satisfying terminal, then build from actual used terms.
 */
export const REPORT_DERIVED_NODE_REGISTRY: readonly ReportDerivedNodeDefinition[] =
  [
    {
      node_id: "glossary_appendix",
      required_upstream: [...REPORT_PAGE_IDS],
      notes:
        "Generate only from terms actually used in final page bodies. Never from planned terms.",
    },
  ] as const;

export function reportPageDefinition(
  pageId: ReportPageId,
): ReportPageDefinition {
  const found = REPORT_PAGE_REGISTRY.find((p) => p.page_id === pageId);
  if (!found) {
    throw new Error(`unknown_report_page_id:${pageId}`);
  }
  return found;
}

export function isReportPageId(value: string): value is ReportPageId {
  return (REPORT_PAGE_IDS as readonly string[]).includes(value);
}

/** Upstream pages whose output fingerprints are hashed into this page's input FP. */
export function pageFingerprintUpstreamIds(
  pageId: ReportPageId,
): readonly ReportPageId[] {
  return reportPageDefinition(pageId).required_upstream;
}

/** Shared-input keys this page hashes. */
export function pageSharedInputKeys(
  pageId: ReportPageId,
): readonly ReportSharedInputKey[] {
  return reportPageDefinition(pageId).shared_input_keys;
}
