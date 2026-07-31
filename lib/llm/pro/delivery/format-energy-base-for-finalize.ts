import { buildCoreJudgmentsRefsFromStructured } from "@/lib/base-analysis/core-judgments";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

/**
 * Compact 底座真算 dump for Part I (energy). Facts only — model must not recompute.
 * Terms stay in bazi_basis / evidence; narrative uses SaaS plain language.
 */
export function formatEnergyBaseForFinalize(base_analysis: unknown | null): string {
  const structured = normalizeBaseAnalysisInput(base_analysis).structured ?? null;
  if (!structured) {
    return "(无底座 structured — energy 段仅能写极薄的中性说明,bazi_basis 可空。)";
  }
  return formatStructuredEnergyFacts(structured);
}

export function formatStructuredEnergyFacts(structured: ProfileStructured): string {
  const refs = buildCoreJudgmentsRefsFromStructured(structured);
  const idx = refs.da_yun_step;
  const step = idx != null && Array.isArray(structured.da_yun) ? structured.da_yun[idx] : null;
  const decadeLine = step
    ? `当前大运步(#${idx}): ${step.ganzhi ?? ""} · 起自 ${step.start_year ?? "?"}（虚岁 ${step.start_age ?? "?"}）`
    : "当前大运步: (未解析)";

  return `【底座真算 · 仅供定稿引用 · 禁止改判】
day_master: ${refs.day_master}
strength: ${refs.strength}
yong_shen: ${refs.yong_shen}
xi_shen: ${(refs.xi_shen ?? []).join("、") || "(无)"}
ji_shen: ${(refs.ji_shen ?? []).join("、") || "(无)"}
pattern: ${refs.pattern}
${decadeLine}
神煞实例(闭集): ${(refs.shensha_instances ?? []).join("、") || "(无)"}
natal_relations: ${(refs.natal_relations ?? []).slice(0, 8).join("；") || "(无)"}

【energy 段定稿要求】
- core_conclusion: 纯白话描述能量本质/补给消耗/格局感/当前环境 — 【禁止】写日主/用神/喜神/忌神/大运/流年/格局专名/干支。
- bazi_basis: 必须列出支撑上述白话的真词(日主、用神等全称),供依据层解释。`;
}
