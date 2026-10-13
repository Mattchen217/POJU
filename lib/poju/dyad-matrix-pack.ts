/**
 * Locked ResonanceMatrix closed-set for Stage2+ / delivery (dyad path).
 */

import type { ResonanceMatrix } from "@/lib/match/calculate-compatibility";
import { calculateCompatibilityMatrix } from "@/lib/match/calculate-compatibility";

export type DyadMatrixPack = {
  schema_version: 1;
  computed_at: string;
  /** Full local Match matrix (no Match LLM prose). */
  matrix: ResonanceMatrix;
  /** Compact prompt dump (JSON, size-capped). */
  prompt_dump: string;
};

const MAX_DUMP_CHARS = 12_000;

export function buildDyadMatrixPack(input: {
  profileA: unknown;
  profileB: unknown;
  computed_at?: string;
}): DyadMatrixPack {
  const matrix = calculateCompatibilityMatrix({
    profileA: input.profileA,
    profileB: input.profileB,
  });
  const computed_at = input.computed_at ?? new Date().toISOString();
  let prompt_dump = JSON.stringify(matrix, null, 2);
  if (prompt_dump.length > MAX_DUMP_CHARS) {
    prompt_dump = prompt_dump.slice(0, MAX_DUMP_CHARS) + "\n…(truncated)";
  }
  return {
    schema_version: 1,
    computed_at,
    matrix,
    prompt_dump,
  };
}

export type DyadMatrixPromptMode = "full" | "compact";

/**
 * Prompt block for Stage2 / Synthesis / delivery when path=dyad.
 * - full: header + capped matrix_json (Call A 真算)
 * - compact: header only（Call B / Synthesis / 交付 — 避免每枪再灌 ≤12k JSON）
 */
export function formatDyadMatrixPackForPrompt(
  pack: DyadMatrixPack | null | undefined,
  opts?: { mode?: DyadMatrixPromptMode },
): string {
  if (!pack?.matrix) return "";
  const m = pack.matrix;
  const mode: DyadMatrixPromptMode = opts?.mode === "compact" ? "compact" : "full";
  const header = [
    "## dyad_matrix_pack（本地合盘闭集真算 · 非 Match 长报告）",
    `synergy_type=${m.synergy_type}`,
    `resonance_index=${m.resonance_index}`,
    `A=${m._meta?.a_summary ?? ""}`,
    `B=${m._meta?.b_summary ?? ""}`,
    `strengths=${(m.key_insights?.strengths ?? []).join(",")}`,
    `challenges=${(m.key_insights?.challenges ?? []).join(",")}`,
  ];
  if (mode === "compact") {
    return [
      ...header,
      "",
      "（compact：无 matrix_json 全文；Call A 已吃过完整闭集。此处只作结构锚复核。）",
      "用法：校准【用户侧】边界/节奏；禁止翻版合盘专章墙。",
    ].join("\n");
  }
  return [
    ...header,
    "",
    "### matrix_json",
    pack.prompt_dump,
    "",
    "用法：先据此做合婚/合作向二元测算式分析，再收敛到【用户侧】可达方案；禁止翻版合盘专章墙。",
  ].join("\n");
}
