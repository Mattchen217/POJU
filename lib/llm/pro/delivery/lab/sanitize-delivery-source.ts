/**
 * Keep only fields the live delivery pipeline consumes.
 * Strips cancelled base-analysis narrative (display_text / content) and
 * chat-only spine fields that never feed P1–P6 prompts.
 */

const BASE_KEEP = new Set([
  "structured",
  /** Sibling Layer1 pack — may attach onto breakthrough_core; keep if present. */
  "metaphysics_pack",
]);

/** Chat / Segment2 UI only — not injected into delivery page prompts. */
const CORE_DROP = new Set(["response", "first_question"]);

export type SanitizeDeliverySourceResult = {
  base_analysis: Record<string, unknown>;
  breakthrough_core: Record<string, unknown> | null;
  stripped: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Layer1 for delivery: structured (+ metaphysics_pack if stored). */
export function stripBaseAnalysisForDelivery(raw: unknown): {
  base: Record<string, unknown>;
  stripped: string[];
} {
  const stripped: string[] = [];
  if (!isRecord(raw)) {
    return { base: {}, stripped: ["base_analysis_not_object"] };
  }

  const base: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (BASE_KEEP.has(k) && v != null) {
      base[k] = v;
    } else if (k === "display_text" || k === "content") {
      stripped.push(`base_analysis.${k} (旧个人能量长文 · 交付不喂)`);
    } else if (
      k === "core_judgments" ||
      k === "model" ||
      k === "tokens_used" ||
      k === "stream_meta" ||
      k === "computation_version" ||
      k === "generated_at" ||
      k === "locale" ||
      k === "used_true_solar_time" ||
      k === "tst_meta"
    ) {
      stripped.push(`base_analysis.${k}`);
    } else if (!BASE_KEEP.has(k)) {
      stripped.push(`base_analysis.${k}`);
    }
  }

  if (!isRecord(base.structured)) {
    stripped.push("missing_structured");
  }

  return { base, stripped };
}

/** Spine for delivery: drop Segment2 chat-only fields. */
export function stripBreakthroughCoreForDelivery(raw: unknown): {
  core: Record<string, unknown> | null;
  stripped: string[];
} {
  const stripped: string[] = [];
  if (raw == null) return { core: null, stripped: [] };
  if (!isRecord(raw)) {
    return { core: null, stripped: ["breakthrough_core_not_object"] };
  }

  const core: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (CORE_DROP.has(k)) {
      stripped.push(`breakthrough_core.${k} (对话用 · 交付页不喂)`);
      continue;
    }
    core[k] = v;
  }
  return { core, stripped };
}

export function sanitizeLabDeliverySource(input: {
  base_analysis: unknown;
  breakthrough_core?: unknown | null;
}): SanitizeDeliverySourceResult {
  const ba = stripBaseAnalysisForDelivery(input.base_analysis);
  const bc = stripBreakthroughCoreForDelivery(input.breakthrough_core ?? null);
  return {
    base_analysis: ba.base,
    breakthrough_core: bc.core,
    stripped: [...ba.stripped, ...bc.stripped],
  };
}
