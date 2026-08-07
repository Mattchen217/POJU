import {
  buildMetaphysicsPack,
  buildMetaphysicsPackFromProfile,
  type MetaphysicsPack,
  type ElementScoreMap,
  type WuXingScoreRaw,
} from "@/lib/calculations/metaphysics-pack";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { UserProfile } from "@/lib/profile/types";

function isMetaphysicsPack(x: unknown): x is MetaphysicsPack {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return o.version === "metaphysics_pack_v1" && typeof o.yong_shen === "object";
}

function isStructured(x: unknown): x is ProfileStructured {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return typeof o.day_master === "string" && typeof o.yong_shen === "string";
}

function isWuXingScoreRaw(x: unknown): x is WuXingScoreRaw {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  for (const k of ["金", "木", "水", "火", "土"] as const) {
    const cell = o[k];
    if (
      cell &&
      typeof cell === "object" &&
      !Array.isArray(cell) &&
      typeof (cell as { 分值?: unknown }).分值 === "number"
    ) {
      return true;
    }
  }
  return false;
}

/** Pull 五行分值 from base_analysis blob (several historical shapes). */
export function extractElementScoresRawFromBaseAnalysis(
  base_analysis: unknown,
): WuXingScoreRaw | null {
  if (base_analysis == null || typeof base_analysis !== "object" || Array.isArray(base_analysis)) {
    return null;
  }
  const root = base_analysis as Record<string, unknown>;
  const nested =
    root.base_analysis && typeof root.base_analysis === "object"
      ? (root.base_analysis as Record<string, unknown>)
      : null;

  const candidates: unknown[] = [
    root.element_scores_raw,
    nested?.element_scores_raw,
    (root.chart as { 八字?: { 五行分值?: unknown } } | undefined)?.八字?.五行分值,
    (nested?.chart as { 八字?: { 五行分值?: unknown } } | undefined)?.八字?.五行分值,
    (root.八字 as { 五行分值?: unknown } | undefined)?.五行分值,
    (nested?.八字 as { 五行分值?: unknown } | undefined)?.五行分值,
  ];

  for (const c of candidates) {
    if (isWuXingScoreRaw(c)) return c;
  }
  return null;
}

function pickBetterPack(
  a: MetaphysicsPack | null,
  b: MetaphysicsPack | null,
): MetaphysicsPack | null {
  if (!a) return b;
  if (!b) return a;
  if (a.element_scores_source === "chart" && b.element_scores_source !== "chart") return a;
  if (b.element_scores_source === "chart" && a.element_scores_source !== "chart") return b;
  return a;
}

/**
 * Pull Layer-1 metaphysics_pack from base_analysis blob, or rebuild from structured.
 * Prefer packs with chart-sourced element scores when upgrading empty packs.
 */
export function resolveMetaphysicsPackFromBaseAnalysis(
  base_analysis: unknown,
): MetaphysicsPack | null {
  if (base_analysis == null) return null;
  if (isMetaphysicsPack(base_analysis)) return base_analysis;

  if (typeof base_analysis === "object" && !Array.isArray(base_analysis)) {
    const root = base_analysis as Record<string, unknown>;
    let fromField: MetaphysicsPack | null = isMetaphysicsPack(root.metaphysics_pack)
      ? root.metaphysics_pack
      : null;

    const nested =
      root.base_analysis && typeof root.base_analysis === "object"
        ? (root.base_analysis as Record<string, unknown>)
        : null;
    if (!fromField && nested && isMetaphysicsPack(nested.metaphysics_pack)) {
      fromField = nested.metaphysics_pack;
    }

    // Chart-sourced scores already on pack — keep.
    if (fromField?.element_scores_source === "chart") return fromField;

    const structured = (isStructured(root.structured)
      ? root.structured
      : nested && isStructured(nested.structured)
        ? nested.structured
        : null) as ProfileStructured | null;

    if (structured) {
      try {
        const raw = extractElementScoresRawFromBaseAnalysis(base_analysis);
        const rebuilt = buildMetaphysicsPack({
          structured,
          element_scores_raw: raw,
        });
        return pickBetterPack(rebuilt, fromField);
      } catch (err) {
        console.error(
          "[attach-metaphysics-pack] rebuild from structured failed",
          err instanceof Error ? err.name : "unknown",
        );
      }
    }

    return fromField;
  }

  return null;
}

function packNeedsScoreUpgrade(pack: MetaphysicsPack | null | undefined): boolean {
  return !pack || pack.element_scores_source !== "chart";
}

/**
 * Attach / upgrade metaphysics_pack on breakthrough_core.
 * If an existing pack has empty scores, rebuild from base_analysis or profile chart.
 */
export function attachMetaphysicsPackToBreakthroughCore(
  core: BreakthroughCore,
  base_analysis: unknown,
  options?: { profile?: UserProfile | null },
): BreakthroughCore {
  const existing = core.metaphysics_pack?.version === "metaphysics_pack_v1"
    ? core.metaphysics_pack
    : null;

  let pack: MetaphysicsPack | null = existing;

  if (packNeedsScoreUpgrade(pack)) {
    const fromBa = resolveMetaphysicsPackFromBaseAnalysis(base_analysis);
    pack = pickBetterPack(fromBa, pack);

    if (packNeedsScoreUpgrade(pack) && options?.profile) {
      try {
        const fromProfile = buildMetaphysicsPackFromProfile(options.profile);
        pack = pickBetterPack(fromProfile, pack);
      } catch (err) {
        console.error(
          "[attach-metaphysics-pack] from profile failed",
          err instanceof Error ? err.name : "unknown",
        );
      }
    }
  }

  if (!pack) return core;

  if (
    existing &&
    existing.element_scores_source === "chart" &&
    pack === existing
  ) {
    return {
      ...core,
      element_scores: core.element_scores ?? existing.element_scores,
    };
  }

  return {
    ...core,
    metaphysics_pack: pack,
    element_scores: pack.element_scores as ElementScoreMap,
  };
}
