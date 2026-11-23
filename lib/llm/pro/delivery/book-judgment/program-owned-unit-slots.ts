/**
 * Program-Owned Unit Slot Plan (Page02 R6).
 *
 * Slot Plan is built BEFORE the LLM from Page02 Unit Requirement SSOT
 * (DDR catalog page-02 entries → one requirement each → one slot each).
 *
 * Model fills claim/anchors only; cannot invent slot_id / unit_id / dir_ids.
 *
 * Many-to-many: slot.dir_ids may be >1; the same dir_id may appear on
 * multiple slots when each requirement independently lists it.
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { DecisionBlueprint } from "@/lib/poju/decision-intake/types";
import {
  loadPage02UnitRequirementsFromDdrCatalog,
  PAGE02_UNIT_REQUIREMENT_SSOT_VERSION,
  type Page02UnitRequirement,
} from "./page02-unit-requirement-ssot";
import {
  canonicalProgramUnitSlotBindingRef,
  type ProgramUnitDirAuthorityEdge,
} from "./related-dir-enrichment";

export const PROGRAM_OWNED_UNIT_SLOT_PLAN_VERSION = 1 as const;

export type ProgramOwnedUnitSlot = {
  slot_id: string;
  unit_id: string;
  requirement_id: string;
  dir_ids: string[];
  unit_kind: Page02UnitRequirement["unit_kind"];
  serves_face: "02";
  source_type: Page02UnitRequirement["source_type"];
  source_id: string;
  source_version: string;
  source_hash: string;
  dc_content_hash: string | null;
  association_basis: "program_owned_unit_slot";
};

export type ProgramOwnedUnitSlotPlan = {
  version: typeof PROGRAM_OWNED_UNIT_SLOT_PLAN_VERSION;
  face: "02";
  requirement_ssot_version: typeof PAGE02_UNIT_REQUIREMENT_SSOT_VERSION;
  dc_content_hash: string | null;
  slots: ProgramOwnedUnitSlot[];
  missing_reason: null;
};

export type ProgramOwnedUnitSlotPlanUnavailable = {
  ok: false;
  reason:
    | "missing_page02_unit_requirements"
    | "missing_exclusive_slot_dir_ssot";
  detail: string;
  page02_dir_obligation_set: string[];
  dc_content_hash: string | null;
  blueprint_present: boolean;
};

export type ProgramOwnedUnitSlotPlanOk = {
  ok: true;
  plan: ProgramOwnedUnitSlotPlan;
};

/** @deprecated page-level union — audit only; never assign to every unit. */
export function collectPage02DdrDirObligationSet(): string[] {
  const ids = new Set<string>();
  for (const r of loadPage02UnitRequirementsFromDdrCatalog()) {
    for (const d of r.dir_ids) ids.add(d);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export function programUnitIdForRequirement(requirementId: string): string {
  return `u_slot_${requirementId.replace(/^req_/, "")}`;
}

export function programSlotIdForRequirement(requirementId: string): string {
  return `slot_${requirementId}`;
}

export { canonicalProgramUnitSlotBindingRef };

/**
 * Build Slot Plan from Page02 requirement SSOT (pre-LLM).
 * Does not invent DIR lists — only mirrors each DDR requirement's dirs.
 */
export function tryBuildProgramOwnedUnitSlotPlan(input: {
  dc?: DecisionContext | null;
  blueprint?: DecisionBlueprint | null;
}): ProgramOwnedUnitSlotPlanOk | ProgramOwnedUnitSlotPlanUnavailable {
  const requirements = loadPage02UnitRequirementsFromDdrCatalog();
  const page02_dir_obligation_set = collectPage02DdrDirObligationSet();
  const dc_content_hash = input.dc?.content_hash ?? null;
  const blueprint_present = Boolean(input.blueprint);

  if (!requirements.length) {
    return {
      ok: false,
      reason: "missing_page02_unit_requirements",
      detail: "No Page02 DDR requirements with non-empty required_dir_ids",
      page02_dir_obligation_set,
      dc_content_hash,
      blueprint_present,
    };
  }

  const slots: ProgramOwnedUnitSlot[] = requirements.map((req) => ({
    slot_id: programSlotIdForRequirement(req.requirement_id),
    unit_id: programUnitIdForRequirement(req.requirement_id),
    requirement_id: req.requirement_id,
    dir_ids: [...req.dir_ids],
    unit_kind: req.unit_kind,
    serves_face: "02",
    source_type: req.source_type,
    source_id: req.source_id,
    source_version: req.source_version,
    source_hash: req.source_hash,
    dc_content_hash,
    association_basis: "program_owned_unit_slot",
  }));

  return {
    ok: true,
    plan: {
      version: PROGRAM_OWNED_UNIT_SLOT_PLAN_VERSION,
      face: "02",
      requirement_ssot_version: PAGE02_UNIT_REQUIREMENT_SSOT_VERSION,
      dc_content_hash,
      slots,
      missing_reason: null,
    },
  };
}

export function programOwnedUnitSlotPlanCanAuthorize(
  result: ProgramOwnedUnitSlotPlanOk | ProgramOwnedUnitSlotPlanUnavailable,
): result is ProgramOwnedUnitSlotPlanOk {
  return result.ok === true && result.plan.slots.length > 0;
}

/**
 * Expand Slot Plan into per-(unit,dir) authority edges for enricher.
 * Internal only — production callers must not inject arbitrary edges.
 */
export function authorityEdgesFromSlotPlan(
  plan: ProgramOwnedUnitSlotPlan,
): ProgramUnitDirAuthorityEdge[] {
  const edges: ProgramUnitDirAuthorityEdge[] = [];
  for (const slot of plan.slots) {
    const bindingRef = canonicalProgramUnitSlotBindingRef({
      slot_id: slot.slot_id,
      requirement_id: slot.requirement_id,
      unit_id: slot.unit_id,
      dir_ids: slot.dir_ids,
    });
    for (const dir_id of slot.dir_ids) {
      edges.push({
        unit_id: slot.unit_id,
        dir_id,
        source_ref: bindingRef,
        association_basis: "program_owned_unit_slot",
        slot_id: slot.slot_id,
        requirement_id: slot.requirement_id,
        source_type: slot.source_type,
        source_id: slot.source_id,
        source_version: slot.source_version,
        source_hash: slot.source_hash,
        dc_content_hash: slot.dc_content_hash,
      });
    }
  }
  return edges;
}

export function formatSlotPlanForBookJudgmentFeed(
  plan: ProgramOwnedUnitSlotPlan,
): string {
  const lines = [
    `## Program-Owned Unit Slot Plan (Page02 · face=02 · v${plan.version})`,
    "程序预分配槽位。你必须按 slot_id 填写内容；禁止新增/删除/改 slot_id、unit_id、requirement_id、dir_ids。",
    "每个 slot 输出一个 unit 对象，字段：slot_id, claim, anchors, caveat?；track/serves_face/id 由程序写入。",
    "其他脸的 unit 仍按配额自由产出（无 slot_id）。",
  ];
  for (const s of plan.slots) {
    lines.push(
      [
        `- slot_id=${s.slot_id}`,
        `unit_id=${s.unit_id}`,
        `requirement_id=${s.requirement_id}`,
        `unit_kind=${s.unit_kind}`,
        `dir_ids=[${s.dir_ids.join(",")}]`,
        `source=${s.source_type}:${s.source_id}@${s.source_version}`,
      ].join(" · "),
    );
  }
  return lines.join("\n");
}
