import { glossOf, termOf } from "@/lib/glossary/pojulife-terms";
import {
  parseTermMarkers,
  TERM_MARKER_PATTERN,
} from "@/lib/llm/sanitize/term-marking";

/**
 * 翻译入参「渲染态」括号岛：页面读者看到的软译 + tooltip 释义。
 * 形态：`[软译:释义]`。模型只理解、不翻译括号内；译后按序回填 `⟦t:slug|⟧`。
 */
export const TRANSLATE_RENDER_BRACKET_RE = /\[[^\[\]]*\]/g;

/** 去掉 `]` / `[`，避免破坏括号岛解析。 */
function sanitizeBracketPart(s: string): string {
  return s.replace(/[\[\]]/g, "").trim();
}

/**
 * 把 `⟦t:slug|…⟧` 展开成页面渲染态 `[软译:释义]`（默认中文 SSOT——①②③ 始终中文）。
 * 返回展开文本 + 按出现顺序的 slug 列表，供译后回填。
 */
export function expandMarkersToRenderBrackets(
  text: string,
  locale = "zh",
): { text: string; slugs: string[] } {
  if (!text?.includes("⟦t:")) return { text: text ?? "", slugs: [] };
  const loc = locale.toLowerCase().startsWith("zh") ? "zh" : locale.toLowerCase().slice(0, 2);
  const slugs: string[] = [];
  TERM_MARKER_PATTERN.lastIndex = 0;
  const out = text.replace(TERM_MARKER_PATTERN, (raw) => {
    const parsed = parseTermMarkers(raw)[0];
    const id = parsed?.id ?? "unknown";
    slugs.push(id);
    const soft = sanitizeBracketPart(termOf(id, loc) ?? id);
    const def = sanitizeBracketPart(glossOf(id, loc) ?? soft);
    return `[${soft}:${def}]`;
  });
  return { text: out, slugs };
}

/**
 * 按出现顺序把 `[软译:释义]` 回填为 `⟦t:slug|⟧`。
 * 括号内文字不参与匹配（模型若改了释义也不影响）；只认岛的个数与顺序。
 * 不含 `:` 的方括号（如英文偶发 `[1]`）原样保留，不消耗 slug。
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

/** 去掉标记岛与渲染态括号岛后，统计剩余汉字（未译检测用）。 */
export function stripTranslateIslands(text: string): string {
  return (text ?? "")
    .replace(TERM_MARKER_PATTERN, "")
    .replace(TRANSLATE_RENDER_BRACKET_RE, "");
}
