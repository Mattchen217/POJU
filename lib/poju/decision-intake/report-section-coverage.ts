/**
 * Report section coverage from DDR catalog + DC authority.
 * Statuses are computed — model may not declare completion.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import {
  DDR_CATALOG_V1_ENTRIES,
  type DdrDefinitionEntry,
} from "@/lib/poju/decision-context/catalog/ddr-catalog.v1";
import { dirIntakeAnswerCoverage } from "./intake-answer-coverage";
import type { DecisionBlueprint } from "./types";

export type ReportCoverageStatus =
  | "satisfied_by_user_information"
  | "satisfied_by_local_profile"
  | "satisfied_by_existing_context"
  | "satisfied_with_boundary"
  | "not_applicable"
  | "missing_required_information"
  | "optional_missing";

export type ReportSectionCoverageItem = {
  page_id: string;
  section_id: string;
  deliverable_id: string;
  ddr_id: string;
  required_dir_ids: string[];
  status: ReportCoverageStatus;
  missing_dir_ids: string[];
  priority: "P0" | "P1" | "P2";
  completion_criteria: string;
  asks_user: boolean;
};

export type ReportCoverageSnapshot = {
  built_at: string;
  items: ReportSectionCoverageItem[];
  missing_required_count: number;
  optional_missing_count: number;
  delivery_ready: boolean;
  reasons: string[];
};

function dirStatus(
  dc: DecisionContext,
  dirId: string,
): "resolved" | "boundary" | "missing" | "absent" {
  const dir = dc.dirs.find((d) => d.dir_id === dirId);
  if (!dir) return "absent";
  if (dir.id_lifecycle !== "active") return "absent";
  if (dir.current_state === "known") return "resolved";
  if (dir.current_state === "n_a") return "boundary";
  const coverage = dirIntakeAnswerCoverage(dc, dir);
  if (coverage.answered) {
    return coverage.information_boundary ? "boundary" : "resolved";
  }
  return "missing";
}

function evaluateDdrCoverage(
  dc: DecisionContext,
  blueprint: DecisionBlueprint | null | undefined,
  ddr: DdrDefinitionEntry,
): ReportSectionCoverageItem {
  // Page 03 glossary appendix: derived from final evidence-layer term markers +
  // SSOT after model pages complete — never a user investigation task.
  if (ddr.ddr_id === "DDR-03-CHART-APPENDIX") {
    return {
      page_id: ddr.report_page_id,
      section_id: ddr.report_section_id,
      deliverable_id: ddr.ddr_id,
      ddr_id: ddr.ddr_id,
      required_dir_ids: [],
      status: "satisfied_by_local_profile",
      missing_dir_ids: [],
      priority: ddr.priority,
      completion_criteria: ddr.completion_criteria,
      asks_user: false,
    };
  }

  // Page 07 topic depth: only when Blueprint activated topic DIRs / DDR-07.
  if (ddr.topic_gated || ddr.ddr_id === "DDR-07-TOPIC-DEPTH") {
    const topicActive =
      blueprint?.ddr_ids?.includes("DDR-07-TOPIC-DEPTH") ||
      dc.dirs.some(
        (d) =>
          d.id_lifecycle === "active" &&
          (d.dir_id.startsWith("DIR-REL-") ||
            d.dir_id.startsWith("DIR-JOB-") ||
            d.dir_id.startsWith("DIR-BIZ-") ||
            d.dir_id.startsWith("DIR-LOCALE-") ||
            d.dir_id.startsWith("DIR-EDU-")),
      );
    if (!topicActive) {
      return {
        page_id: ddr.report_page_id,
        section_id: ddr.report_section_id,
        deliverable_id: ddr.ddr_id,
        ddr_id: ddr.ddr_id,
        required_dir_ids: [...ddr.required_dir_ids],
        status: "not_applicable",
        missing_dir_ids: [],
        priority: ddr.priority,
        completion_criteria: ddr.completion_criteria,
        asks_user: false,
      };
    }
  }

  const required = [...ddr.required_dir_ids];
  // Blueprint may seed extra topic DIRs into DDR-07; include active topic DIRs linked.
  if (ddr.ddr_id === "DDR-07-TOPIC-DEPTH" && blueprint) {
    for (const dirId of blueprint.dir_ids) {
      if (
        (dirId.startsWith("DIR-REL-") ||
          dirId.startsWith("DIR-JOB-") ||
          dirId.startsWith("DIR-BIZ-") ||
          dirId.startsWith("DIR-LOCALE-") ||
          dirId.startsWith("DIR-EDU-")) &&
        !required.includes(dirId)
      ) {
        required.push(dirId);
      }
    }
  }

  if (required.length === 0) {
    return {
      page_id: ddr.report_page_id,
      section_id: ddr.report_section_id,
      deliverable_id: ddr.ddr_id,
      ddr_id: ddr.ddr_id,
      required_dir_ids: [],
      status: "satisfied_by_existing_context",
      missing_dir_ids: [],
      priority: ddr.priority,
      completion_criteria: ddr.completion_criteria,
      asks_user: false,
    };
  }

  const missing: string[] = [];
  let anyBoundary = false;
  let anyResolved = false;
  for (const dirId of required) {
    const st = dirStatus(dc, dirId);
    if (st === "missing") missing.push(dirId);
    else if (st === "boundary") {
      anyBoundary = true;
      anyResolved = true;
    } else if (st === "resolved") {
      anyResolved = true;
    } else if (st === "absent") {
      // Not yet on DC — treat as missing if DDR is in blueprint scope.
      if (
        !blueprint ||
        (blueprint.ddr_ids ?? []).includes(ddr.ddr_id) ||
        ddr.always_on
      ) {
        missing.push(dirId);
      }
    }
  }

  let status: ReportCoverageStatus;
  if (missing.length === 0) {
    status = anyBoundary
      ? "satisfied_with_boundary"
      : anyResolved
        ? "satisfied_by_user_information"
        : "satisfied_by_existing_context";
  } else if (ddr.priority === "P2" && !ddr.decision_critical) {
    status = "optional_missing";
  } else {
    status = "missing_required_information";
  }

  return {
    page_id: ddr.report_page_id,
    section_id: ddr.report_section_id,
    deliverable_id: ddr.ddr_id,
    ddr_id: ddr.ddr_id,
    required_dir_ids: required,
    status,
    missing_dir_ids: missing,
    priority: ddr.priority,
    completion_criteria: ddr.completion_criteria,
    asks_user: status === "missing_required_information" || status === "optional_missing",
  };
}

export function computeReportSectionCoverage(input: {
  dc: DecisionContext;
  blueprint?: DecisionBlueprint | null;
  now?: string;
}): ReportCoverageSnapshot {
  const now = input.now ?? new Date().toISOString();
  const items = DDR_CATALOG_V1_ENTRIES.map((ddr) =>
    evaluateDdrCoverage(input.dc, input.blueprint, ddr),
  );
  const missing_required_count = items.filter(
    (i) => i.status === "missing_required_information",
  ).length;
  const optional_missing_count = items.filter(
    (i) => i.status === "optional_missing",
  ).length;
  const reasons: string[] = [];
  for (const item of items) {
    if (item.status === "missing_required_information") {
      reasons.push(
        `missing:${item.ddr_id}:${item.missing_dir_ids.join(",")}`,
      );
    }
  }
  // Delivery-ready for intake stop: no required section gaps on always-on / blueprint DDRs.
  const delivery_ready = missing_required_count === 0;
  if (delivery_ready) reasons.push("report_required_sections_covered");
  return {
    built_at: now,
    items,
    missing_required_count,
    optional_missing_count,
    delivery_ready,
    reasons,
  };
}

/** Section contracts for prompt / candidate enrichment (machine-readable). */
export function reportSectionContractsForDirs(dirIds: string[]): Array<{
  page_id: string;
  section_id: string;
  ddr_id: string;
  required_dir_ids: string[];
  completion_criteria: string;
  priority: string;
}> {
  const out: Array<{
    page_id: string;
    section_id: string;
    ddr_id: string;
    required_dir_ids: string[];
    completion_criteria: string;
    priority: string;
  }> = [];
  const seen = new Set<string>();
  for (const ddr of DDR_CATALOG_V1_ENTRIES) {
    if (!dirIds.some((id) => ddr.required_dir_ids.includes(id))) continue;
    if (seen.has(ddr.ddr_id)) continue;
    seen.add(ddr.ddr_id);
    out.push({
      page_id: ddr.report_page_id,
      section_id: ddr.report_section_id,
      ddr_id: ddr.ddr_id,
      required_dir_ids: [...ddr.required_dir_ids],
      completion_criteria: ddr.completion_criteria,
      priority: ddr.priority,
    });
  }
  return out;
}
