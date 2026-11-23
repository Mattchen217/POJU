/**
 * Page02 Unit Requirement → DIR SSOT (R6).
 *
 * Authority: each Page02 DDR catalog entry is one content requirement.
 * dir_ids = that entry's required_dir_ids only (NOT the page-02 DIR union).
 *
 * Many-to-many OK:
 * - One requirement / unit may list multiple DIRs (DDR multi-DIR obligation).
 * - The same DIR may appear on multiple requirements (e.g. DIR-DEF-QUESTION).
 *
 * Forbidden:
 * - Copying the page-02 DIR union onto every requirement
 * - Ordinal split of DDR DIRs into invented per-DIR units
 * - section-letter / track / anchors inventorship
 *
 * unit_kind is authored here from DDR identity (ATTRIBUTION→destiny /
 * SCIENCE-BRIDGE→science), matching intake docs (CFP-backed attribution vs
 * science bridge). DIR lists themselves are never hand-authored — always
 * read from ddr-catalog.v1 at load time.
 */

import { createHash } from "node:crypto";
import {
  DDR_CATALOG_VERSION,
  DDR_CATALOG_V1_ENTRIES,
  type DdrDefinitionEntry,
} from "@/lib/poju/decision-context/catalog/ddr-catalog.v1";

export const PAGE02_UNIT_REQUIREMENT_SSOT_VERSION = "1" as const;

export type Page02UnitKind = "destiny" | "science";

export type Page02UnitRequirement = {
  requirement_id: string;
  page_id: "02";
  ddr_ids: string[];
  unit_kind: Page02UnitKind;
  dir_ids: string[];
  source_type: "ddr_catalog";
  source_id: string;
  source_version: string;
  source_hash: string;
  association_basis: "ddr_required_dir_ids_for_page02_requirement";
};

function unitKindForDdr(entry: DdrDefinitionEntry): Page02UnitKind {
  // Authored policy: attribution DDR is CFP-backed personal structure;
  // science-bridge DDR is reality-mechanism / testable claims.
  if (entry.ddr_id === "DDR-02-ATTRIBUTION") return "destiny";
  return "science";
}

function hashDdrRequirementSource(entry: DdrDefinitionEntry): string {
  const payload = JSON.stringify({
    ddr_id: entry.ddr_id,
    required_dir_ids: entry.required_dir_ids,
    report_page_id: entry.report_page_id,
    report_section_id: entry.report_section_id,
    catalog_version: DDR_CATALOG_VERSION,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

/**
 * Load Page02 requirements from DDR catalog. Stable order by ddr_id.
 */
export function loadPage02UnitRequirementsFromDdrCatalog(): Page02UnitRequirement[] {
  return DDR_CATALOG_V1_ENTRIES.filter((e) => e.report_page_id === "02")
    .slice()
    .sort((a, b) => a.ddr_id.localeCompare(b.ddr_id))
    .map((entry) => {
      const dir_ids = [...(entry.required_dir_ids ?? [])]
        .map((d) => d.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      return {
        requirement_id: `req_${entry.ddr_id}`,
        page_id: "02" as const,
        ddr_ids: [entry.ddr_id],
        unit_kind: unitKindForDdr(entry),
        dir_ids,
        source_type: "ddr_catalog" as const,
        source_id: entry.ddr_id,
        source_version: DDR_CATALOG_VERSION,
        source_hash: hashDdrRequirementSource(entry),
        association_basis:
          "ddr_required_dir_ids_for_page02_requirement" as const,
      };
    })
    .filter((r) => r.dir_ids.length > 0);
}

export function page02UnitRequirementById(
  requirementId: string,
): Page02UnitRequirement | null {
  return (
    loadPage02UnitRequirementsFromDdrCatalog().find(
      (r) => r.requirement_id === requirementId,
    ) ?? null
  );
}
