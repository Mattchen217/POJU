/**
 * Report section coverage from report-information-needs SSOT + DC authority.
 * DDR report_section_id is compatibility metadata only.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { DDR_CATALOG_V1_ENTRIES } from "@/lib/poju/decision-context/catalog/ddr-catalog.v1";
import { dirIntakeAnswerCoverage } from "./intake-answer-coverage";
import type { DecisionBlueprint } from "./types";
import {
  allReportSegmentContracts,
  reportInformationNeedById,
  type ReportInformationNeed,
} from "./report-information-needs.v1";

export type ReportCoverageStatus =
  | "satisfied_by_user_information"
  | "satisfied_by_local_profile"
  | "satisfied_by_existing_context"
  | "satisfied_with_boundary"
  | "not_applicable"
  | "missing_required_information"
  | "optional_missing";

export type NeedResolution =
  | "satisfied"
  | "boundary_unknown_declined"
  | "not_applicable"
  | "missing_collectable"
  | "satisfied_derived";

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
  unit_id?: string;
  need_ids?: string[];
  resolution?: string;
};

export type ReportCoverageSnapshot = {
  built_at: string;
  items: ReportSectionCoverageItem[];
  missing_required_count: number;
  optional_missing_count: number;
  delivery_ready: boolean;
  reasons: string[];
};

function page07TopicActive(
  dc: DecisionContext,
  blueprint?: DecisionBlueprint | null,
): boolean {
  if (blueprint?.page_07_emit) return true;
  return dc.dirs.some(
    (d) =>
      d.id_lifecycle === "active" &&
      (d.dir_id.startsWith("DIR-REL-") ||
        d.dir_id.startsWith("DIR-JOB-") ||
        d.dir_id.startsWith("DIR-BIZ-") ||
        d.dir_id.startsWith("DIR-LOCALE-") ||
        d.dir_id.startsWith("DIR-EDU-") ||
        d.dir_id.startsWith("DIR-STAKEHOLDERS")),
  );
}

function dirCollectable(
  dc: DecisionContext,
  dirId: string,
  blueprint?: DecisionBlueprint | null,
): { resolution: NeedResolution; missing: boolean } {
  const dir = dc.dirs.find((d) => d.dir_id === dirId);
  if (!dir || dir.id_lifecycle !== "active") {
    if (blueprint?.dir_ids?.includes(dirId)) {
      return { resolution: "missing_collectable", missing: true };
    }
    return { resolution: "not_applicable", missing: false };
  }
  if (dir.current_state === "known") {
    return { resolution: "satisfied", missing: false };
  }
  if (dir.current_state === "n_a") {
    return { resolution: "boundary_unknown_declined", missing: false };
  }
  const coverage = dirIntakeAnswerCoverage(dc, dir);
  if (coverage.answered) {
    return {
      resolution: coverage.information_boundary
        ? "boundary_unknown_declined"
        : "satisfied",
      missing: false,
    };
  }
  return { resolution: "missing_collectable", missing: true };
}

export function resolveReportNeed(
  need: ReportInformationNeed,
  dc: DecisionContext,
  blueprint: DecisionBlueprint | null | undefined,
  page07Active: boolean,
): NeedResolution {
  if (need.ask_policy === "never" || need.necessity === "none") {
    return need.source_kind === "local_profile"
      ? "satisfied"
      : "satisfied_derived";
  }
  if (need.applicability === "page_07_topic_active" && !page07Active) {
    return "not_applicable";
  }
  if (need.source_kind !== "decision_context" || !need.dir_ids.length) {
    if (need.need_id === "need:dc:04a-open-conflicts") {
      const open = (dc.conflicts ?? []).some((c) => c.state === "open");
      return open ? "missing_collectable" : "satisfied";
    }
    if (need.decision_materiality !== "decision_critical") {
      return "satisfied_derived";
    }
    return "not_applicable";
  }
  let anyMissing = false;
  let anyBoundary = false;
  let anySatisfied = false;
  for (const dirId of need.dir_ids) {
    const st = dirCollectable(dc, dirId, blueprint);
    if (st.resolution === "missing_collectable") anyMissing = true;
    else if (st.resolution === "boundary_unknown_declined") anyBoundary = true;
    else if (st.resolution === "satisfied") anySatisfied = true;
  }
  if (anyMissing) return "missing_collectable";
  if (anyBoundary) return "boundary_unknown_declined";
  if (anySatisfied) return "satisfied";
  return "not_applicable";
}

export function needActivelyBlocking(
  need: ReportInformationNeed,
  resolution: NeedResolution,
  page07Active: boolean,
): boolean {
  if (need.source_kind !== "decision_context") return false;
  if (need.decision_materiality !== "decision_critical") return false;
  if (need.ask_policy !== "ask_if_material") return false;
  if (need.readiness_effect === "never_block") return false;
  if (
    need.readiness_effect === "block_when_page_active" &&
    !page07Active
  ) {
    return false;
  }
  if (resolution === "missing_collectable") return true;
  if (
    resolution === "boundary_unknown_declined" &&
    need.missing_behavior === "keep_blocking_after_boundary"
  ) {
    return true;
  }
  return false;
}

function ddrCompatForUnit(
  needIds: readonly string[],
): { ddr_id: string; required_dir_ids: string[]; priority: "P0" | "P1" | "P2"; completion_criteria: string } {
  for (const id of needIds) {
    const need = reportInformationNeedById(id);
    if (!need) continue;
    const ddrId = need.related_ddr_ids[0];
    if (ddrId) {
      const ddr = DDR_CATALOG_V1_ENTRIES.find((e) => e.ddr_id === ddrId);
      return {
        ddr_id: ddrId,
        required_dir_ids: [...need.dir_ids],
        priority: ddr?.priority ?? "P1",
        completion_criteria: ddr?.completion_criteria ?? need.sufficient_when_zh,
      };
    }
  }
  return {
    ddr_id: "NEED",
    required_dir_ids: [],
    priority: "P2",
    completion_criteria: "",
  };
}

function mapUnitStatus(
  needResolutions: Array<{ need: ReportInformationNeed; resolution: NeedResolution }>,
  pageId: string,
  page07Active: boolean,
): ReportCoverageStatus {
  const blocking = needResolutions.filter(({ need, resolution }) =>
    needActivelyBlocking(need, resolution, page07Active),
  );
  const anyBlockingMissing = blocking.some(
    ({ resolution }) => resolution === "missing_collectable",
  );
  if (anyBlockingMissing) return "missing_required_information";

  const optionalGap = needResolutions.some(
    ({ need, resolution }) =>
      need.necessity === "optional" && resolution === "missing_collectable",
  );
  if (optionalGap) return "optional_missing";

  const allNa = needResolutions.every(
    ({ resolution }) =>
      resolution === "not_applicable" || resolution === "satisfied_derived",
  );
  if (allNa && pageId === "03") return "satisfied_by_existing_context";

  const anyBoundary = needResolutions.some(
    ({ resolution }) => resolution === "boundary_unknown_declined",
  );
  if (anyBoundary) return "satisfied_with_boundary";

  const anyMissingSoft = needResolutions.some(
    ({ need, resolution }) =>
      resolution === "missing_collectable" &&
      need.necessity !== "required" &&
      need.decision_materiality !== "decision_critical",
  );
  if (anyMissingSoft) return "optional_missing";

  const anyMissingHard = needResolutions.some(
    ({ resolution }) => resolution === "missing_collectable",
  );
  if (anyMissingHard) return "missing_required_information";

  return "satisfied_by_user_information";
}

function evaluateUnitCoverage(
  dc: DecisionContext,
  blueprint: DecisionBlueprint | null | undefined,
  page07Active: boolean,
  contract: ReturnType<typeof allReportSegmentContracts>[number],
): ReportSectionCoverageItem {
  const [page_id, section_id] = contract.unit_id.split(":") as [string, string];
  const needResolutions = contract.need_ids.map((needId) => {
    const need = reportInformationNeedById(needId);
    if (!need) {
      return {
        need: {
          need_id: needId,
        } as ReportInformationNeed,
        resolution: "not_applicable" as NeedResolution,
      };
    }
  return {
      need,
      resolution: resolveReportNeed(need, dc, blueprint, page07Active),
    };
  });

  const compat = ddrCompatForUnit(contract.need_ids);
  const missing_dir_ids = [
    ...new Set(
      needResolutions.flatMap(({ need, resolution }) =>
        resolution === "missing_collectable" ? [...need.dir_ids] : [],
      ),
    ),
  ];

  const status = mapUnitStatus(
    needResolutions.filter(
      (r): r is { need: ReportInformationNeed; resolution: NeedResolution } =>
        Boolean(r.need.need_id),
    ),
    page_id,
    page07Active,
  );

  const asks_user =
    page_id !== "03" &&
    (status === "missing_required_information" || status === "optional_missing");

  const resolutions = needResolutions
    .map(({ need, resolution }) => `${need.need_id}:${resolution}`)
    .join(";");

  return {
    page_id,
    section_id,
    deliverable_id: contract.unit_id,
    ddr_id: compat.ddr_id,
    required_dir_ids: compat.required_dir_ids,
    status,
    missing_dir_ids,
    priority: compat.priority,
    completion_criteria: compat.completion_criteria,
    asks_user,
    unit_id: contract.unit_id,
    need_ids: [...contract.need_ids],
    resolution: resolutions,
  };
}

export function computeReportSectionCoverage(input: {
  dc: DecisionContext;
  blueprint?: DecisionBlueprint | null;
  now?: string;
}): ReportCoverageSnapshot {
  const now = input.now ?? new Date().toISOString();
  const page07Active = page07TopicActive(input.dc, input.blueprint);
  const items = allReportSegmentContracts().map((contract) =>
    evaluateUnitCoverage(input.dc, input.blueprint, page07Active, contract),
  );

  const blockingNeedIds = new Set<string>();
  for (const contract of allReportSegmentContracts()) {
    for (const needId of contract.need_ids) {
      const need = reportInformationNeedById(needId);
      if (!need) continue;
      const resolution = resolveReportNeed(
        need,
        input.dc,
        input.blueprint,
        page07Active,
      );
      if (needActivelyBlocking(need, resolution, page07Active)) {
        blockingNeedIds.add(need.need_id);
      }
    }
  }

  const missing_required_count = blockingNeedIds.size;
  const optional_missing_count = items.filter(
    (i) => i.status === "optional_missing",
  ).length;
  const reasons: string[] = [];
  for (const needId of blockingNeedIds) {
    reasons.push(`blocking_need:${needId}`);
  }
  for (const item of items) {
    if (item.status === "missing_required_information") {
      reasons.push(
        `missing:${item.unit_id ?? item.ddr_id}:${item.missing_dir_ids.join(",")}`,
      );
    }
  }
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

/** Whether a DC DIR still maps to an actively blocking SSOT need. */
export function isDirBlockingNeedActive(
  dirId: string,
  dc: DecisionContext,
  blueprint: DecisionBlueprint | null | undefined,
): boolean {
  const needId = `need:dc:${dirId}`;
  const need = reportInformationNeedById(needId);
  if (!need) return false;
  const page07Active = page07TopicActive(dc, blueprint);
  const resolution = resolveReportNeed(need, dc, blueprint, page07Active);
  return needActivelyBlocking(need, resolution, page07Active);
}