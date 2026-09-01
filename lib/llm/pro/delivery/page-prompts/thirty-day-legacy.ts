/**
 * thirty_day · 已退役（兼容旧会话）
 * 新交付勿调度本页。
 */

export const PAGE_KEY = "thirty_day" as const;
export const PAGE_LABEL = "（已退役）四周表";

export const FINALIZE_DUTY = `# 本段职责 · thirty_day（已退役）
新交付勿再要求四周表;若被迫兼容旧会话,只给极薄节奏结论,勿展开甘特。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】已退役(legacy)
- page="thirty_day" + page_title + page_subtitle; weeks×4 + day7_checklist≥3。新交付不调度。`;
}
