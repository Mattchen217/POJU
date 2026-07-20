import { TIME_ANCHOR_RE } from "@/lib/base-analysis-v2/compute/leak-patterns";

/**
 * 输出端时间锚清洗：把具体年份/岁数/干支大运等就地换成中性说法。
 * 仅用于第3次依据（给用户看）；第1次中间数据不在此拦。
 */
export function stripTimeAnchor(text: string, locale = "zh"): string {
  if (!text) return text;
  const zh = locale.startsWith("zh");
  const replacement = zh ? "当前阶段" : "this phase";
  let out = text.replace(TIME_ANCHOR_RE, replacement);
  const dup = zh
    ? /当前阶段(\s*[，、；]\s*当前阶段)+/g
    : /this phase(\s*[,;]\s*this phase)+/gi;
  out = out.replace(dup, replacement);
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([，。；、,.!?])/g, "$1").trim();
  return out;
}
