/**
 * Qimen field-label vs value display policy (Phase 3).
 * Labels resolve via ziwei-style resolvePojuTerm(ns=qimen).
 * Values reuse ganzhi / branch / jieqi / digit policies — never invent 60 glossary rows.
 * Boolean cell flags (是否空亡 / 是否驛馬) use the mapped structure label + non-text UI state.
 */

import { isValidSexagenaryGanzhi } from "@/lib/glossary/term-closed-set";
import { toTermLocale, type TermLocale } from "@/lib/glossary/pojulife-terms";
import { resolvePojuTerm } from "@/lib/glossary/term-resolve";

export type QimenValuePolicy =
  | "sexagenary_closed"
  | "branch_list"
  | "branch_single"
  | "jieqi_calendar_name"
  | "ju_number_1_9"
  | "wuxing_sequence"
  | "boolean_ui_flag"
  | "mapped_term"
  | "passthrough_safe_digit";

export type QimenFieldPolicy = {
  /** Internal traditional field key on QimenPan / cell. */
  field: string;
  /** Glossary traditional for label resolve (qimen ns). */
  labelTraditional: string;
  valuePolicy: QimenValuePolicy;
  note: string;
};

export const QIMEN_FIELD_POLICIES: readonly QimenFieldPolicy[] = [
  {
    field: "旬首",
    labelTraditional: "旬首",
    valuePolicy: "sexagenary_closed",
    note: "六值均为六十甲子锚点；校验 isValidSexagenaryGanzhi，不建 60 glossary",
  },
  {
    field: "空亡",
    labelTraditional: "空亡",
    valuePolicy: "branch_list",
    note: "地支数组；标签用覆盖缺口，取值走地支安全组件",
  },
  {
    field: "驛馬",
    labelTraditional: "驿马",
    valuePolicy: "branch_single",
    note: "与 bazi 驿马分 ns；取值地支",
  },
  {
    field: "節氣",
    labelTraditional: "节气",
    valuePolicy: "jieqi_calendar_name",
    note: "历法节点名；勿与营销日历 UI 文案混用同一 glossary 行",
  },
  {
    field: "局數",
    labelTraditional: "局数",
    valuePolicy: "ju_number_1_9",
    note: "1–9 配置编号，不是吉凶评分",
  },
  {
    field: "旺相休囚死",
    labelTraditional: "旺相休囚死",
    valuePolicy: "wuxing_sequence",
    note: "五元素序列；标签元素阶段谱，取值复用五行闭集",
  },
  {
    field: "是否空亡",
    labelTraditional: "空亡",
    valuePolicy: "boolean_ui_flag",
    note: "布尔不建 true/false 词条；UI 用覆盖缺口标签 + 状态点",
  },
  {
    field: "是否驛馬",
    labelTraditional: "驿马",
    valuePolicy: "boolean_ui_flag",
    note: "布尔不建 true/false 词条；UI 用移动标记标签 + 状态点",
  },
] as const;

export type QimenLabelAtom =
  | { status: "resolved"; slug: string; label: string }
  | { status: "blocked"; reason: string };

export function resolveQimenFieldLabel(
  labelTraditional: string,
  localeInput: string = "zh",
): QimenLabelAtom {
  const locale = toTermLocale(localeInput);
  const r = resolvePojuTerm(labelTraditional, { namespace: "qimen" });
  if (r.status === "resolved") {
    const label = (r.term.term[locale] || r.term.term.zh || "").trim();
    return { status: "resolved", slug: r.term.slug, label };
  }
  return {
    status: "blocked",
    reason: r.status === "forbidden" ? r.reason : r.status,
  };
}

export function formatQimenJuNumber(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 9) return null;
  return String(n);
}

export function assertQimenXunShouValue(v: string): boolean {
  return isValidSexagenaryGanzhi(v);
}

/** Soft-label header for wang_xiang style lines (no traditional 旺相休囚死 key in user text). */
export function qimenElementalPhaseHeader(localeInput: string = "zh"): string {
  const atom = resolveQimenFieldLabel("旺相休囚死", localeInput);
  return atom.status === "resolved" ? atom.label : "—";
}

export function qimenCoverageGapLabel(localeInput: string = "zh"): string {
  const atom = resolveQimenFieldLabel("空亡", localeInput);
  return atom.status === "resolved" ? atom.label : "—";
}

export function qimenMobilityMarkerLabel(localeInput: string = "zh"): string {
  const atom = resolveQimenFieldLabel("驿马", localeInput);
  return atom.status === "resolved" ? atom.label : "—";
}

/** Locale-typed soft bag helper for tests. */
export function qimenLabelLocales(traditional: string): Record<TermLocale, string> | null {
  const r = resolvePojuTerm(traditional, { namespace: "qimen" });
  if (r.status !== "resolved") return null;
  return { ...r.term.term };
}
