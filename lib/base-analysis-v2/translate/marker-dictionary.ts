/**
 * 历史：曾注入翻译 system 的「代号→真词」表。
 * ④ 现改为喂页面渲染态 `[软译:释义]`，不再注入本表（避免模型查表/硬翻真词）。
 * 保留导出供回归测试与必要时对照。
 */
import { POJU_TERMS } from "@/lib/glossary/pojulife-terms";

export function buildMarkerDictionary(_locale: string): string {
  return POJU_TERMS.filter((t) => t.ns === "bazi")
    .map((t) => `代号 ${t.slug}：就是命理里的「${t.traditional}」`)
    .join("\n");
}
