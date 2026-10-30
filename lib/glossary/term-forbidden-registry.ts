/**
 * Namespace-aware forbidden token registry.
 *
 * Same Han string may be redline in one system and a legal mapped term in another
 * (e.g. 空亡 / 白虎: forbidden under bazi, allowed under qimen).
 *
 * Legacy OUT_OF_SET_FORBIDDEN_HAN is derived from the bazi slice of this registry.
 */

import type { TermNs } from "@/lib/glossary/term-ns";

export type ForbiddenSeverity = "redline" | "never_compute" | "internal_only";

export type ForbiddenEntry = {
  namespace: TermNs;
  token: string;
  reason: string;
  severity: ForbiddenSeverity;
  source: string;
};

/**
 * Phase 1 seed: migrate former global OUT_OF_SET_FORBIDDEN_HAN into bazi-scoped rows.
 * Qimen must NOT inherit 空亡 / 白虎 from this list.
 */
export const TERM_FORBIDDEN_REGISTRY: readonly ForbiddenEntry[] = [
  {
    namespace: "bazi",
    token: "空亡",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "魁罡",
    reason: "never_compute_or_redline",
    severity: "never_compute",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "十恶大败",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "孤鸾",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "孤鸾煞",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "阴阳差错",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "阴差阳错",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "元辰",
    reason: "never_compute_or_redline",
    severity: "never_compute",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "六秀日",
    reason: "never_compute_or_redline",
    severity: "never_compute",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "大耗",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "小耗",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "五鬼",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "丧门",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "吊客",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "白虎",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "天狗",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "血刃",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "流霞",
    reason: "never_compute_or_redline",
    severity: "never_compute",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "隔角",
    reason: "never_compute_or_redline",
    severity: "never_compute",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "勾绞煞",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "童子煞",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "地网",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "天罗",
    reason: "redline_shensha_fear_frame",
    severity: "redline",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "八专日",
    reason: "never_compute_or_redline",
    severity: "never_compute",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "十灵日",
    reason: "never_compute_or_redline",
    severity: "never_compute",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
  {
    namespace: "bazi",
    token: "九丑日",
    reason: "never_compute_or_redline",
    severity: "never_compute",
    source: "legacy:OUT_OF_SET_FORBIDDEN_HAN",
  },
] as const;

const BY_NS_TOKEN = new Map<string, ForbiddenEntry>();
for (const e of TERM_FORBIDDEN_REGISTRY) {
  BY_NS_TOKEN.set(`${e.namespace}:${e.token}`, e);
}

export function forbiddenEntryFor(
  namespace: TermNs,
  token: string,
): ForbiddenEntry | undefined {
  return BY_NS_TOKEN.get(`${namespace}:${token}`);
}

/** Tokens forbidden in one namespace (exact token strings as registered). */
export function forbiddenTokensForNamespace(namespace: TermNs): readonly string[] {
  return TERM_FORBIDDEN_REGISTRY.filter((e) => e.namespace === namespace).map((e) => e.token);
}

/**
 * Lookup forbidden hit for a surface within one namespace.
 * Matches registered token exactly against confirmed Han variants of `surface`.
 */
export function matchForbidden(
  namespace: TermNs,
  surface: string,
  variants: readonly string[],
): ForbiddenEntry | undefined {
  for (const v of variants) {
    const hit = BY_NS_TOKEN.get(`${namespace}:${v}`);
    if (hit) return hit;
  }
  // Also try raw trimmed surface in case variants is empty.
  const trimmed = surface.trim();
  if (trimmed) {
    const hit = BY_NS_TOKEN.get(`${namespace}:${trimmed}`);
    if (hit) return hit;
  }
  return undefined;
}
