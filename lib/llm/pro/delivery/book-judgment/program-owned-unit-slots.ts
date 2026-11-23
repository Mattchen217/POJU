/**
 * Program-Owned Unit Slot Plan (Page02 R5).
 *
 * Intended architecture: program pre-creates slots (slot_id, unit_id, dir_id,
 * requirement provenance) BEFORE the LLM; model fills claim/anchors only.
 *
 * R5 investigation (`.cursor/docs/Page02-Unit-DIR-slot-plan-缺口-R5.md`):
 * Current Blueprint / DDR / DIR / quota only expose page-level DIR *sets* and
 * track/segment quotas — NOT exclusive 1 slot → 1 DIR rows.
 *
 * This module therefore REFUSES to invent a Slot Plan. Production must keep
 * Unit→DIR bindings empty until an exclusive SSOT table exists.
 *
 * Forbidden inventorship (never implement here):
 * - ordinal / round-robin pairing of page-02 DIR union ↔ science units
 * - DDR multi-DIR → invent split order
 * - DDR section letter ↔ BJ segment letter
 * - serves_face / track / co-membership
 * - Fact→DIR bulk grant
 */

import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { DecisionBlueprint } from "@/lib/poju/decision-intake/types";
import { DDR_CATALOG_V1_ENTRIES } from "@/lib/poju/decision-context/catalog/ddr-catalog.v1";

export const PROGRAM_OWNED_UNIT_SLOT_PLAN_VERSION = 1 as const;

/** Future SSOT row shape — not emitted until exclusive catalog exists. */
export type ProgramOwnedUnitSlot = {
  slot_id: string;
  unit_id: string;
  dir_id: string;
  requirement_id: string;
  serves_face: "02";
  source_type: "ddr_exclusive_slot_ssot" | "blueprint_exclusive_slot_ssot";
  source_id: string;
  source_version: string;
  source_hash: string;
  dc_content_hash: string | null;
  association_basis: "program_owned_unit_slot";
};

export type ProgramOwnedUnitSlotPlan = {
  version: typeof PROGRAM_OWNED_UNIT_SLOT_PLAN_VERSION;
  face: "02";
  dc_content_hash: string | null;
  slots: ProgramOwnedUnitSlot[];
  /** Audit: page-level DIR obligations seen (NOT per-unit assignment). */
  page02_dir_obligation_set: string[];
  missing_reason: null;
};

export type ProgramOwnedUnitSlotPlanUnavailable = {
  ok: false;
  reason: "missing_exclusive_slot_dir_ssot";
  detail: string;
  /** Page-level DIR union from DDR-02-* — must NOT be used as unit assignment. */
  page02_dir_obligation_set: string[];
  dc_content_hash: string | null;
  blueprint_present: boolean;
};

export type ProgramOwnedUnitSlotPlanOk = {
  ok: true;
  plan: ProgramOwnedUnitSlotPlan;
};

/**
 * Page-02 DDR required_dir_ids union (obligation set only).
 * Explicitly NOT a Slot Plan.
 */
export function collectPage02DdrDirObligationSet(): string[] {
  const ids = new Set<string>();
  for (const e of DDR_CATALOG_V1_ENTRIES) {
    if (e.report_page_id !== "02") continue;
    for (const d of e.required_dir_ids ?? []) {
      const t = String(d).trim();
      if (t) ids.add(t);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/**
 * Attempt to build a Program-Owned Unit Slot Plan from real authority SSOT.
 *
 * Today always returns unavailable: no exclusive slot→DIR catalog exists.
 * When such SSOT is added, implement the reader HERE — never invent from sets.
 */
export function tryBuildProgramOwnedUnitSlotPlan(input: {
  dc?: DecisionContext | null;
  blueprint?: DecisionBlueprint | null;
}): ProgramOwnedUnitSlotPlanOk | ProgramOwnedUnitSlotPlanUnavailable {
  const page02_dir_obligation_set = collectPage02DdrDirObligationSet();
  const dc_content_hash = input.dc?.content_hash ?? null;
  const blueprint_present = Boolean(input.blueprint);

  // Inventory only — proves page-level obligations exist, not unit ownership.
  const ddr02 = DDR_CATALOG_V1_ENTRIES.filter((e) => e.report_page_id === "02");
  const multiDirDdrs = ddr02.filter(
    (e) => (e.required_dir_ids ?? []).length > 1,
  );

  return {
    ok: false,
    reason: "missing_exclusive_slot_dir_ssot",
    detail: [
      "R5 stop: no exclusive 1-slot→1-DIR SSOT.",
      `page02_ddr_count=${ddr02.length}`,
      `page02_dir_obligation_n=${page02_dir_obligation_set.length}`,
      `multi_dir_ddr_ids=${multiDirDdrs.map((d) => d.ddr_id).join(",") || "none"}`,
      "quota.segment_slots have preferred_track only (no dir_id).",
      "Refusing ordinal/DDR-split/section-letter inventorship.",
      "See .cursor/docs/Page02-Unit-DIR-slot-plan-缺口-R5.md",
    ].join(" "),
    page02_dir_obligation_set,
    dc_content_hash,
    blueprint_present,
  };
}

/**
 * Production gate: only an ok plan with ≥1 slot may seed authority edges.
 * Always false until exclusive SSOT lands.
 */
export function programOwnedUnitSlotPlanCanAuthorize(
  result: ProgramOwnedUnitSlotPlanOk | ProgramOwnedUnitSlotPlanUnavailable,
): result is ProgramOwnedUnitSlotPlanOk {
  return result.ok === true && result.plan.slots.length > 0;
}
