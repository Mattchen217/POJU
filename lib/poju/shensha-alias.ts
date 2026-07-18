/**
 * 引擎神煞名 → SSOT traditional 的别名映射。
 * 引擎带「贵人/合」后缀（文昌贵人/天德合/月德合/国印贵人），SSOT 存本名（文昌/天德/月德/国印）。
 * 精确匹配失败时用它兜一次，避免「有软译却被误判无软译丢弃」。
 */
export const SHENSHA_ALIAS: Readonly<Record<string, string>> = {
  文昌贵人: "文昌",
  天德贵人: "天德",
  天德合: "天德",
  月德贵人: "月德",
  月德合: "月德",
  国印贵人: "国印",
};

/** 去后缀兜底：贵人/合 等后缀去掉再试。 */
export function normalizeShenshaName(han: string): string {
  return SHENSHA_ALIAS[han] ?? han.replace(/(贵人|合)$/, "");
}
