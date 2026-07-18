/**
 * 引擎名 / 结构同义词 → SSOT traditional 的别名映射。
 * - 神煞：引擎带「贵人/合」后缀（文昌贵人/天德合…），SSOT 存本名（文昌/天德…）。
 * - 结构词：身旺=身强、命局=命盘，避免无独立术语的同义裸词漏网。
 * 精确匹配失败时用它兜一次，避免「有软译却被误判无软译丢弃」。
 */
export const SHENSHA_ALIAS: Readonly<Record<string, string>> = {
  文昌贵人: "文昌",
  天德贵人: "天德",
  天德合: "天德",
  月德贵人: "月德",
  月德合: "月德",
  国印贵人: "国印",
  // 结构词同义别名：身旺=身强、命局=命盘，避免这两个无独立术语的词漏成裸词。
  身旺: "身强",
  命局: "命盘",
};

/** 别名归一；神煞再去「贵人/合」后缀兜底。 */
export function normalizeShenshaName(han: string): string {
  return SHENSHA_ALIAS[han] ?? han.replace(/(贵人|合)$/, "");
}
