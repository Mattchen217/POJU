import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";
import { calculateCurrentYearGanZhi } from "@/lib/llm/prompts/oriental-counselor-base";
import { KEEP_CN_SLUGS, KEEP_CN_VISIBLE_SOFT } from "@/lib/glossary/term-closed-set";
import {
  encodeTermMarker,
  parseTermMarkers,
  type OutOfSetAuditHit,
} from "@/lib/llm/sanitize/term-marking";

const TERM_MARKER_PATTERN =
  /⟦t:([a-zA-Z0-9_]+)\|((?:\\.|[^|\\])*?)(?:\|((?:\\.|[^|\\])*?))?⟧/g;

const EMPTY_PAREN_RE = /[(（]\s*[)）]/;

function resolveCurrentDaYunGanzhi(daYun: DaYunEntry[], now = new Date()): string | null {
  if (!daYun.length) return null;
  const year = now.getFullYear();
  const idx = daYun.findIndex((entry, i) => {
    const next = daYun[i + 1];
    return year >= entry.start_year && (!next || year < next.start_year);
  });
  const entry = idx >= 0 ? daYun[idx] : daYun[daYun.length - 1];
  return entry?.ganzhi?.trim() || null;
}

/** Structured fallback for keep_cn slug when model leaves () empty. */
export function ganzhiForKeepCnSlug(
  slug: string,
  structured: ProfileStructured | null | undefined,
  now = new Date(),
): string | null {
  if (!structured) return null;
  switch (slug) {
    case "day_master":
      return structured.day_master?.trim() || structured.pillars_detail?.day?.ganzhi?.trim() || null;
    case "decade":
      return resolveCurrentDaYunGanzhi(structured.da_yun ?? [], now);
    case "year":
      return calculateCurrentYearGanZhi(now).gan_zhi?.trim() || null;
    case "yong_shen":
      return structured.yong_shen?.trim() || null;
    default:
      return null;
  }
}

function fillEmptyParenInVisible(visible: string, fill: string, locale: string): string {
  const isZh = locale.startsWith("zh");
  if (isZh) {
    return visible.replace(/（\s*）/g, `（${fill}）`).replace(/\(\s*\)/g, `（${fill}）`);
  }
  return visible.replace(/[(（]\s*[)）]/g, `(${fill})`);
}

export function auditEmptyKeepCnBrackets(text: string): OutOfSetAuditHit[] {
  if (!text?.trim()) return [];
  const hits: OutOfSetAuditHit[] = [];

  for (const marker of parseTermMarkers(text)) {
    if (!KEEP_CN_SLUGS.has(marker.id) && marker.id !== "yong_shen") continue;
    if (EMPTY_PAREN_RE.test(marker.visible)) {
      hits.push({
        label: "empty_keep_cn_bracket",
        snippet: marker.raw.slice(0, 80),
      });
    }
  }

  const barePatterns: RegExp[] = [
    /\blife phase\s*\(\s*\)/gi,
    /\bcurrent phase climate\s*\(\s*\)/gi,
    /\byear'?s energy\s*\(\s*\)/gi,
    /\bcurrent temporal efficacy\s*\(\s*\)/gi,
    /\bcore nature\s*\(\s*\)/gi,
    /\bkey balancing element\s*\(\s*\)/gi,
    /人生阶段[（(]\s*[）)]/g,
    /当前阶段气候[（(]\s*[）)]/g,
    /流年能量[（(]\s*[）)]/g,
    /当前时空效能[（(]\s*[）)]/g,
    /核心特质[（(]\s*[）)]/g,
    /用神[（(]\s*[）)]/g,
  ];
  for (const re of barePatterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({
        label: "empty_keep_cn_bracket",
        snippet: m[0],
      });
    }
  }

  return hits;
}

export function repairEmptyKeepCnBrackets(
  text: string,
  structured: ProfileStructured | null | undefined,
  locale: string,
  now = new Date(),
): { text: string; repaired: boolean; unfixable: boolean } {
  if (!text?.trim()) return { text, repaired: false, unfixable: false };

  let repaired = false;
  let unfixable = false;

  const repairSlug = (slug: string, visible: string): string => {
    if (!EMPTY_PAREN_RE.test(visible)) return visible;
    const fill = ganzhiForKeepCnSlug(slug, structured, now);
    if (!fill) {
      unfixable = true;
      return visible;
    }
    repaired = true;
    return fillEmptyParenInVisible(visible, fill, locale);
  };

  let result = text.replace(TERM_MARKER_PATTERN, (raw, id, vis, plain) => {
    const slug = String(id);
    if (!KEEP_CN_SLUGS.has(slug) && slug !== "yong_shen") return raw;
    const newVis = repairSlug(slug, String(vis));
    if (newVis === vis) return raw;
    return encodeTermMarker(slug, newVis, plain ? String(plain) : undefined);
  });

  const bareReplacers: Array<{ re: RegExp; slug: string }> = [
    { re: /\blife phase\s*\(\s*\)/gi, slug: "decade" },
    { re: /\bcurrent phase climate\s*\(\s*\)/gi, slug: "decade" },
    { re: /\byear'?s energy\s*\(\s*\)/gi, slug: "year" },
    { re: /\bcurrent temporal efficacy\s*\(\s*\)/gi, slug: "year" },
    { re: /\bcore nature\s*\(\s*\)/gi, slug: "day_master" },
    { re: /\bkey balancing element\s*\(\s*\)/gi, slug: "yong_shen" },
    { re: /人生阶段[（(]\s*[）)]/g, slug: "decade" },
    { re: /当前阶段气候[（(]\s*[）)]/g, slug: "decade" },
    { re: /流年能量[（(]\s*[）)]/g, slug: "year" },
    { re: /当前时空效能[（(]\s*[）)]/g, slug: "year" },
    { re: /核心特质[（(]\s*[）)]/g, slug: "day_master" },
    { re: /用神[（(]\s*[）)]/g, slug: "yong_shen" },
  ];

  for (const { re, slug } of bareReplacers) {
    result = result.replace(re, (match) => {
      if (slug === "decade" || slug === "year") {
        repaired = true;
        const soft = KEEP_CN_VISIBLE_SOFT[slug];
        return locale.startsWith("zh") ? soft!.zh : soft!.en;
      }
      const fill = ganzhiForKeepCnSlug(slug, structured, now);
      if (!fill) {
        unfixable = true;
        return match;
      }
      repaired = true;
      if (locale.startsWith("zh")) {
        const zhLabel =
          slug === "day_master"
            ? "核心特质"
            : "用神";
        return `${zhLabel}（${fill}）`;
      }
      const enLabel =
        slug === "day_master"
          ? "core nature"
          : "key balancing element";
      return `${enLabel} (${fill})`;
    });
  }

  return { text: result, repaired, unfixable };
}
