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

/**
 * Pull Layer-1 metaphysics_pack from base_analysis blob, or rebuild from structured.
 */
export function resolveMetaphysicsPackFromBaseAnalysis(
  base_analysis: unknown,
): MetaphysicsPack | null {
  if (base_analysis == null) return null;
  if (isMetaphysicsPack(base_analysis)) return base_analysis;

  if (typeof base_analysis === "object" && !Array.isArray(base_analysis)) {
    const root = base_analysis as Record<string, unknown>;
    if (isMetaphysicsPack(root.metaphysics_pack)) return root.metaphysics_pack;

    const nested =
      root.base_analysis && typeof root.base_analysis === "object"
        ? (root.base_analysis as Record<string, unknown>)
        : null;
    if (nested && isMetaphysicsPack(nested.metaphysics_pack)) {
      return nested.metaphysics_pack;
    }

    const structured = (isStructured(root.structured)
      ? root.structured
      : nested && isStructured(nested.structured)
        ? nested.structured
        : null) as ProfileStructured | null;

    if (structured) {
      try {
        const raw =
          (root.element_scores_raw as WuXingScoreRaw | undefined) ??
          (nested?.element_scores_raw as WuXingScoreRaw | undefined) ??
          null;
        return buildMetaphysicsPack({
          structured,
          element_scores_raw: raw,
        });
      } catch (err) {
        console.error(
          "[attach-metaphysics-pack] rebuild from structured failed",
          err instanceof Error ? err.name : "unknown",
        );
      }
    }
  }

  return null;
}

export function attachMetaphysicsPackToBreakthroughCore(
  core: BreakthroughCore,
  base_analysis: unknown,
  options?: { profile?: UserProfile | null },
): BreakthroughCore {
  if (core.metaphysics_pack?.version === "metaphysics_pack_v1") {
    return {
      ...core,
      element_scores: core.element_scores ?? core.metaphysics_pack.element_scores,
    };
  }

  let pack = resolveMetaphysicsPackFromBaseAnalysis(base_analysis);
  if (!pack && options?.profile) {
    try {
      pack = buildMetaphysicsPackFromProfile(options.profile);
    } catch (err) {
      console.error(
        "[attach-metaphysics-pack] from profile failed",
        err instanceof Error ? err.name : "unknown",
      );
    }
  }

  if (!pack) return core;

  return {
    ...core,
    metaphysics_pack: pack,
    element_scores: pack.element_scores as ElementScoreMap,
  };
}
