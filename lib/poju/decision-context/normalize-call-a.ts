/**
 * Phase 3 S4 — Call A Validate → Normalize → unique Normalized Object (Contract §13.3).
 * Covers exactly the fields hypothesesFromBreakthroughCore / Mapper reads.
 * Unmapped fields (response, rhythm_frame, status, reality_anchors, …) are excluded;
 * adding a Mapper-read field later requires bumping CALL_A_FINGERPRINT_VERSION.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import {
  NormalizeError,
  NORMALIZE_ILLEGAL_TYPE,
  NORMALIZE_VALIDATION_FAILED,
  mapArrayPreservingSlots,
  normalizeMapperString,
  normalizeStringArrayPreservingSlots,
} from "./normalize";

export interface NormalizedActionFrame {
  direction: string | null;
  why_fits: string | null;
  needs_validation: string | null;
  structural_basis: string | null;
  chart_anchors: Array<string | null>;
}

export interface NormalizedKeyCrossroads {
  real_fork: string | null;
  path_costs: string | null;
  decision_traits: string | null;
  needs_validation: string | null;
  structural_basis: string | null;
}

export interface NormalizedEnergyRetune {
  direction_fit: string | null;
  timing_ripeness: string | null;
  daily_retune: string | null;
  needs_validation: string | null;
  structural_basis: string | null;
}

/** Unique Normalized Object for Call A Fingerprint + Mapper. */
export interface NormalizedCallAInput {
  situation_conclusion: string | null;
  energy_structure: string | null;
  key_crossroads: NormalizedKeyCrossroads | null;
  modern_action_frames: Array<NormalizedActionFrame | null>;
  primary_path: NormalizedActionFrame | null;
  backup_path: NormalizedActionFrame | null;
  energy_retune_frame: NormalizedEnergyRetune | null;
}

function assertObjectOrNull(
  value: unknown,
  field: string,
): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new NormalizeError(
      NORMALIZE_ILLEGAL_TYPE,
      `Call A field "${field}" must be object|null|undefined`,
      field,
    );
  }
  return value as Record<string, unknown>;
}

function normalizeActionFrame(
  raw: unknown,
  field: string,
): NormalizedActionFrame | null {
  const row = assertObjectOrNull(raw, field);
  if (!row) return null;
  return {
    direction: normalizeMapperString(row.direction, `${field}.direction`),
    why_fits: normalizeMapperString(row.why_fits, `${field}.why_fits`),
    needs_validation: normalizeMapperString(
      row.needs_validation,
      `${field}.needs_validation`,
    ),
    structural_basis: normalizeMapperString(
      row.structural_basis,
      `${field}.structural_basis`,
    ),
    chart_anchors: normalizeStringArrayPreservingSlots(
      row.chart_anchors ?? [],
      `${field}.chart_anchors`,
    ),
  };
}

function normalizeKeyCrossroads(
  raw: unknown,
): NormalizedKeyCrossroads | null {
  const row = assertObjectOrNull(raw, "key_crossroads");
  if (!row) return null;
  return {
    real_fork: normalizeMapperString(row.real_fork, "key_crossroads.real_fork"),
    path_costs: normalizeMapperString(
      row.path_costs,
      "key_crossroads.path_costs",
    ),
    decision_traits: normalizeMapperString(
      row.decision_traits,
      "key_crossroads.decision_traits",
    ),
    needs_validation: normalizeMapperString(
      row.needs_validation,
      "key_crossroads.needs_validation",
    ),
    structural_basis: normalizeMapperString(
      row.structural_basis,
      "key_crossroads.structural_basis",
    ),
  };
}

function normalizeEnergyRetune(raw: unknown): NormalizedEnergyRetune | null {
  const row = assertObjectOrNull(raw, "energy_retune_frame");
  if (!row) return null;
  return {
    direction_fit: normalizeMapperString(
      row.direction_fit,
      "energy_retune_frame.direction_fit",
    ),
    timing_ripeness: normalizeMapperString(
      row.timing_ripeness,
      "energy_retune_frame.timing_ripeness",
    ),
    daily_retune: normalizeMapperString(
      row.daily_retune,
      "energy_retune_frame.daily_retune",
    ),
    needs_validation: normalizeMapperString(
      row.needs_validation,
      "energy_retune_frame.needs_validation",
    ),
    structural_basis: normalizeMapperString(
      row.structural_basis,
      "energy_retune_frame.structural_basis",
    ),
  };
}

/**
 * Runtime validate + normalize Call A input into the unique Normalized Object.
 * Accepts BreakthroughCore or a plain object with the same Mapper-read shape.
 */
export function normalizeCallAInput(raw: unknown): NormalizedCallAInput {
  if (raw === null || raw === undefined) {
    throw new NormalizeError(
      NORMALIZE_VALIDATION_FAILED,
      "Call A BreakthroughCore is required",
    );
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new NormalizeError(
      NORMALIZE_ILLEGAL_TYPE,
      "Call A input must be an object",
    );
  }
  const core = raw as Record<string, unknown>;

  const modern_action_frames = mapArrayPreservingSlots(
    core.modern_action_frames ?? [],
    "modern_action_frames",
    (elem, i) => normalizeActionFrame(elem, `modern_action_frames[${i}]`),
  );

  return {
    situation_conclusion: normalizeMapperString(
      core.situation_conclusion,
      "situation_conclusion",
    ),
    energy_structure: normalizeMapperString(
      core.energy_structure,
      "energy_structure",
    ),
    key_crossroads: normalizeKeyCrossroads(core.key_crossroads),
    modern_action_frames,
    primary_path: normalizeActionFrame(core.primary_path, "primary_path"),
    backup_path: normalizeActionFrame(core.backup_path, "backup_path"),
    energy_retune_frame: normalizeEnergyRetune(core.energy_retune_frame),
  };
}

/** Type guard helper for callers that already hold BreakthroughCore. */
export function normalizeBreakthroughCoreForCallA(
  core: BreakthroughCore,
): NormalizedCallAInput {
  return normalizeCallAInput(core);
}
