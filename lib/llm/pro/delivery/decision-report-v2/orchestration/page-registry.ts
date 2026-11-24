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
} from "./types";

/** Explicit production stamp for fingerprinting; bump when orchestration contracts change. */
export const REPORT_PAGE_PRODUCTION_VERSION =
  "report-page-prod-2026-11-24" as const;

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
    conditional: false,
    model_generation: true,
    production_version: REPORT_PAGE_PRODUCTION_VERSION,
    notes:
      "Independent start from shared immutable inputs. Must not wait on Page02.",
  },
  {
    page_id: "02",
    required_upstream: [],
    optional_upstream: [],
    output_schema_version: FACE02_SCHEMA_VERSION,
    // Production prompt version is authoritative; architecture bundle is supporting.
    prompt_version: FACE02_PROMPT_VERSION,
    conditional: false,
    model_generation: true,
    production_version: REPORT_PAGE_PRODUCTION_VERSION,
    notes: `Independent start parallel with Page01. Architecture bundle=${PAGE02_ARCHITECTURE_PROMPT_VERSION}.`,
  },
  {
    page_id: "04",
    required_upstream: ["01", "02"],
    optional_upstream: [],
    output_schema_version: "face04-v2",
    prompt_version: PAGE04_ARCHITECTURE_PROMPT_VERSION,
    conditional: false,
    model_generation: true,
    production_version: REPORT_PAGE_PRODUCTION_VERSION,
    notes: "Waits for Page01 and Page02 canonical outputs.",
  },
  {
    page_id: "05",
    required_upstream: ["01", "02", "04"],
    optional_upstream: [],
    output_schema_version: "face05-v2",
    prompt_version: PAGE05_ARCHITECTURE_PROMPT_VERSION,
    conditional: false,
    model_generation: true,
    production_version: REPORT_PAGE_PRODUCTION_VERSION,
    notes: "Waits for Page04 (and Page01/02 via contract).",
  },
  {
    page_id: "06",
    required_upstream: ["01", "02", "04", "05"],
    optional_upstream: [],
    output_schema_version: "face06-v2",
    prompt_version: PAGE06_ARCHITECTURE_PROMPT_VERSION,
    conditional: false,
    model_generation: true,
    production_version: REPORT_PAGE_PRODUCTION_VERSION,
    notes: "Waits for Page05 preferred paths + monitoring handoff surface.",
  },
  {
    page_id: "07",
    required_upstream: ["01", "02", "04", "05", "06"],
    optional_upstream: [],
    output_schema_version: "face07-v2",
    prompt_version: PAGE07_ARCHITECTURE_PROMPT_VERSION,
    conditional: true,
    model_generation: true,
    production_version: REPORT_PAGE_PRODUCTION_VERSION,
    notes:
      "Conditional. Applicability gate may yield not_applicable / insufficient_information without LLM.",
  },
  {
    page_id: "08",
    required_upstream: ["01", "02", "04", "05", "06", "07"],
    optional_upstream: [],
    output_schema_version: "face08-v2",
    prompt_version: PAGE08_ARCHITECTURE_PROMPT_VERSION,
    conditional: false,
    model_generation: true,
    production_version: REPORT_PAGE_PRODUCTION_VERSION,
    notes:
      "Requires Page07 terminal status (completed | not_applicable | insufficient_information).",
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
