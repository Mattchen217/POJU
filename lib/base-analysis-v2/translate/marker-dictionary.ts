import { POJU_TERMS } from "@/lib/glossary/pojulife-terms";

/**
 * 从 SSOT 生成「代号→命理真词」对照表，注入翻译 prompt。
 * 仅含 bazi 命名空间。
 *
 * ★ 只给 traditional 真词（用神/身弱…）——模型是命理专家，秒懂。
 * ★ 不给自造软译（锚元）——模型训练数据里没有，反添乱。
 * ★ 不写 ⟦t:slug|⟧ 完整标记、不用 "=" —— 避免诱导往空槽填。
 */
export function buildMarkerDictionary(_locale: string): string {
  return POJU_TERMS.filter((t) => t.ns === "bazi")
    .map((t) => `代号 ${t.slug}：就是命理里的「${t.traditional}」`)
    .join("\n");
}
