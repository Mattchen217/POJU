import {
  POJU_TERMS,
  type TermLocale,
} from "@/lib/glossary/pojulife-terms";

const TERM_LOCALES = new Set<string>(["zh", "en", "es", "de", "fr"]);

function toTermLocale(locale: string): TermLocale {
  const lang = locale.toLowerCase().slice(0, 2);
  return (TERM_LOCALES.has(lang) ? lang : "en") as TermLocale;
}

/**
 * 从 SSOT 生成「标记→目标语言语义」词典，注入翻译 prompt。
 * 仅含 bazi 命名空间（底座报告相关），避免 prompt 过胖。
 * 用途：让模型理解 ⟦t:slug|⟧ 语义；【不要翻译这张表本身】。
 */
export function buildMarkerDictionary(locale: string): string {
  const lang = toTermLocale(locale);
  return POJU_TERMS.filter((t) => t.ns === "bazi")
    .map((t) => {
      const soft = t.term[lang] ?? t.term.en;
      const gloss = t.definition[lang] ?? t.definition.en;
      return `⟦t:${t.slug}|⟧ = ${soft}（${t.traditional}／${gloss}）`;
    })
    .join("\n");
}
