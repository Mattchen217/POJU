import { glossOf, termOf } from "@/lib/glossary/pojulife-terms";
import {
  parseTermMarkers,
  TERM_MARKER_PATTERN,
} from "@/lib/llm/sanitize/term-marking";

/**
 * 翻译入参「渲染态」括号岛：页面读者看到的软译 + tooltip 释义。
 * 形态：`[软译:释义]`（半角 [] + 中间必须有冒号）。
 * 模型只理解、不翻译括号内；译后按序回填 `⟦t:slug|⟧`。
 *
 * 注意：代码平替用的全角 `【内在本色】` 等 **不是**翻译岛——展开前会拆掉【】，
 * 把里面的中文当成普通正文交给模型意译，避免与 `[软译:释义]` 混淆。
 */
export const TRANSLATE_RENDER_BRACKET_RE = /\[[^\[\]]*\]/g;

/** 去掉 `]` / `[`，避免破坏括号岛解析。 */
function sanitizeBracketPart(s: string): string {
  return s.replace(/[\[\]]/g, "").trim();
}

/**
 * 拆掉清洗层全角平替括号 `【…】`，只留中文正文（必须被意译）。
 * 与翻译岛 `[软译:释义]` 刻意不同形，避免模型当成「勿译占位」。
 */
export function unwrapPlainFallbackBrackets(text: string): string {
  if (!text?.includes("【")) return text ?? "";
  return text.replace(/【([^】]*)】/g, "$1");
}

/**
 * 把 `⟦t:slug|…⟧` 展开成页面渲染态 `[软译:释义]`（默认中文 SSOT——①②③ 始终中文），
 * 并拆掉 `【平替】`。返回展开文本 + 按出现顺序的 slug 列表，供译后回填。
 */
export function expandMarkersToRenderBrackets(
  text: string,
  locale = "zh",
): { text: string; slugs: string[] } {
  const loc = locale.toLowerCase().startsWith("zh") ? "zh" : locale.toLowerCase().slice(0, 2);
  const slugs: string[] = [];
  let out = text ?? "";
  if (out.includes("⟦t:")) {
    TERM_MARKER_PATTERN.lastIndex = 0;
    out = out.replace(TERM_MARKER_PATTERN, (raw) => {
      const parsed = parseTermMarkers(raw)[0];
      const id = parsed?.id ?? "unknown";
      slugs.push(id);
      const soft = sanitizeBracketPart(termOf(id, loc) ?? id);
      const def = sanitizeBracketPart(glossOf(id, loc) ?? soft);
      return `[${soft}:${def}]`;
    });
  }
  out = unwrapPlainFallbackBrackets(out);
  return { text: out, slugs };
}

/**
 * 按出现顺序把 `[软译:释义]` 回填为 `⟦t:slug|⟧`。
 * 括号内文字不参与匹配；只认岛的个数与顺序。
 * 不含 `:` 的方括号不消耗 slug。
 */
export function collapseRenderBracketsToMarkers(text: string, slugs: readonly string[]): string {
  if (!text || slugs.length === 0) return text ?? "";
  let i = 0;
  return text.replace(TRANSLATE_RENDER_BRACKET_RE, (island) => {
    const inner = island.slice(1, -1);
    if (!inner.includes(":")) return island;
    const slug = slugs[i];
    i += 1;
    if (!slug) return "";
    return `⟦t:${slug}|⟧`;
  });
}

/**
 * 剥掉译后残留的「纯中文方括号/全角括号」伪岛。
 */
export function stripSpuriousZhBrackets(text: string): string {
  if (!text) return text ?? "";
  let out = text.replace(/【([^】]*)】/g, "$1");
  out = out.replace(/\[([\u4e00-\u9fff]{1,12})\]/g, "$1");
  return out;
}

/** 去掉标记岛与渲染态括号岛后，统计剩余汉字（未译检测用）。 */
export function stripTranslateIslands(text: string): string {
  return (text ?? "")
    .replace(TERM_MARKER_PATTERN, "")
    .replace(TRANSLATE_RENDER_BRACKET_RE, "");
}
