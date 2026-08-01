/**
 * Delivery prose pollution scanner (core_conclusion / narrative body).
 *
 * Phase-4 policy (诊断期): **detect + warn only — never reject / STOP**.
 * Prompts carry the bans; sanitize may scrub at assemble. Re-enable selective
 * hard gates only after a full delivery pass and a narrower ban set.
 *
 * Canonical base-analysis `auditDeliveredText` (集外神煞 / 断标记 / 裸干支) is
 * a separate pipeline and is not wired into Phase-4 stage jobs.
 */

import { BANNED_TERMS_ZH } from "@/lib/llm/compliance/banned-terms";

/** Soft glosses that should not appear as bare prose in body. */
const SOFT_GLOSS_BARE_ZH = [
  "锚元",
  "助元",
  "显元",
  "潜元",
  "本元",
  "供源",
  "需养",
  "岁环",
  "流展",
  "世络",
  "时脉",
  "元核",
  "隐域",
  "纪元",
  "均势",
  "充沛",
  "柔蔓",
  "刚锋",
] as const;

/** Extra jargon common in basis dumps but not always in BANNED_TERMS_ZH. */
const BASIS_JARGON_ZH = [
  "正官",
  "七杀",
  "偏官",
  "伤官",
  "食神",
  "正印",
  "偏印",
  "枭神",
  "比肩",
  "劫财",
  "正财",
  "偏财",
  "官星",
  "财星",
  "印星",
  "比劫",
  "食伤",
  "杀星",
  "失令",
  "得令",
  "得根",
  "通根",
  "制杀",
  "见官",
  "泄身",
  "生扶",
  "喜水",
  "喜木",
  "喜火",
  "喜土",
  "喜金",
  "忌水",
  "忌木",
  "忌火",
  "忌土",
  "忌金",
  "浮见",
  "贴身",
  "淬炼",
] as const;

const STEM = "甲乙丙丁戊己庚辛壬癸";
const BRANCH = "子丑寅卯辰巳午未申酉戌亥";
const GANZHI_PAIR_RE = new RegExp(`[${STEM}][${BRANCH}]`);
const MONTH_BRANCH_RE = new RegExp(`[${BRANCH}]月`);
const WUXING_USE_RE = /[水木火土金]{2,}为用|[水木火土金]来砍伐/;

export type DeliveryProsePollutionHit = {
  label: string;
  snippet: string;
};

function hit(label: string, snippet: string): DeliveryProsePollutionHit {
  return { label, snippet: snippet.slice(0, 48) };
}

/**
 * Scan user-facing delivery prose for 命理 / soft-gloss / marker / fate pollution.
 * Returns first hit, or null if clean. Callers must only warn — never STOP.
 */
export function findDeliveryProsePollution(text: string): DeliveryProsePollutionHit | null {
  const t = text?.trim() ?? "";
  if (!t) return null;

  if (/⟦t:/.test(t)) {
    return hit("term_marker", "⟦t:");
  }

  for (const w of BANNED_TERMS_ZH) {
    if (w.length >= 2 && t.includes(w)) {
      return hit("banned_term", w);
    }
  }

  for (const w of SOFT_GLOSS_BARE_ZH) {
    if (t.includes(w)) {
      return hit("soft_gloss", w);
    }
  }

  for (const w of BASIS_JARGON_ZH) {
    if (t.includes(w)) {
      return hit("basis_jargon", w);
    }
  }

  const gz = t.match(GANZHI_PAIR_RE);
  if (gz) return hit("ganzhi_pair", gz[0]!);

  const month = t.match(MONTH_BRANCH_RE);
  if (month) return hit("branch_month", month[0]!);

  if (WUXING_USE_RE.test(t)) {
    return hit("wuxing_use_phrase", "五行用忌短语");
  }

  return null;
}

export function isDeliveryProseClean(text: string): boolean {
  return findDeliveryProsePollution(text) == null;
}

/** Warn-only helper — never throws / never rejects. */
export function warnDeliveryProsePollution(
  where: string,
  text: string,
  extra?: Record<string, unknown>,
): DeliveryProsePollutionHit | null {
  const found = findDeliveryProsePollution(text);
  if (found) {
    console.warn(`[delivery/purity] ${where}`, { ...found, ...extra });
  }
  return found;
}

/** All argument bodies in a narrative-shaped tree — first hit or null. */
export function findPollutedBodiesInTree(
  tree: Record<string, Array<{ body?: string }> | undefined>,
): DeliveryProsePollutionHit | null {
  for (const args of Object.values(tree)) {
    if (!args?.length) continue;
    for (const a of args) {
      const hitFound = findDeliveryProsePollution(a.body ?? "");
      if (hitFound) return hitFound;
    }
  }
  return null;
}

/** Warn-only tree scan. */
export function warnPollutedBodiesInTree(
  where: string,
  tree: Record<string, Array<{ body?: string }> | undefined>,
  extra?: Record<string, unknown>,
): DeliveryProsePollutionHit | null {
  const found = findPollutedBodiesInTree(tree);
  if (found) {
    console.warn(`[delivery/purity] ${where}`, { ...found, ...extra });
  }
  return found;
}
