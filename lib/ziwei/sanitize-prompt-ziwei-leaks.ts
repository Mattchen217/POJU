/**
 * Phase 10 — scrub traditional Ziwei surfaces from judgment / thesis prompt text.
 * Soft-map when SSOT label exists; otherwise remove (fail-closed). Never traditional fallback.
 */

import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import {
  softZiweiLabel,
  ziweiPatternHitId,
} from "@/lib/ziwei/soft-zfp-labels";
import {
  ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS,
  ZIWEI_RUNTIME_PALACES,
  ZIWEI_RUNTIME_STARS,
} from "@/lib/ziwei/token-disposition";
import { collectZiweiTraditionalSuspects } from "@/lib/ziwei/display-fact-pack";

function collectPromptLeakTokens(ziwei: ZiweiFactPack | null | undefined): string[] {
  const set = new Set<string>([
    ...ZIWEI_RUNTIME_PALACES,
    ...ZIWEI_RUNTIME_STARS,
    ...ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS,
    "化禄",
    "化权",
    "化科",
    "化忌",
    "四化",
    "大限",
    "流年",
    "命主",
    "身主",
    "身宫",
    "对宫",
    "十二宫",
    "五行局",
  ]);
  if (ziwei) {
    for (const t of collectZiweiTraditionalSuspects(ziwei)) {
      if (t.trim().length >= 2) set.add(t.trim());
    }
    for (const h of ziwei.patternHits ?? []) {
      if (h.name?.trim()) set.add(h.name.trim());
    }
  }
  return [...set].sort((a, b) => b.length - a.length);
}

/**
 * Project thesis / free-text prompt segments so traditional Ziwei names do not reach the model.
 * Pattern classical names → `hit:<id>` when pack is provided; other tokens soft-map or strip.
 */
export function sanitizeZiweiLeaksInPromptText(
  text: string,
  opts?: { ziwei?: ZiweiFactPack | null; locale?: string },
): string {
  if (!text?.trim()) return text ?? "";
  const locale = opts?.locale ?? "zh";
  const ziwei = opts?.ziwei ?? null;
  let out = text;

  // Pattern names first (longest / specific)
  if (ziwei?.patternHits?.length) {
    const byLen = [...ziwei.patternHits].sort(
      (a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0),
    );
    for (const h of byLen) {
      const name = h.name?.trim();
      if (!name || name.length < 2) continue;
      if (!out.includes(name)) continue;
      out = out.split(name).join(`hit:${ziweiPatternHitId(name)}`);
    }
  }

  for (const token of collectPromptLeakTokens(ziwei)) {
    if (!out.includes(token)) continue;
    // Single-char mutagens only strip as standalone risk after longer forms handled
    if (token.length === 1) continue;
    const soft = softZiweiLabel(token, locale);
    out = out.split(token).join(soft);
  }

  return out;
}
