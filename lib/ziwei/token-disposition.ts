/**
 * Ziwei runtime token disposition (Phase 2).
 *
 * Structure field labels live in POJU_TERMS (ns=ziwei).
 * Palace names (except 命宫), star names, 五行局 values, and pattern hits
 * wait for product soft-labels — registered as internal_only (no traditional fallback).
 *
 * Inventory source: scripts/test-ziwei-token-inventory.ts (≥10 births).
 */

export type ZiweiDispositionStatus = "public_glossary" | "internal_only" | "unknown_blocked";

export type ZiweiTokenDisposition =
  | { status: "public_glossary"; note?: string }
  | { status: "internal_only"; reasonCode: string }
  | { status: "unknown_blocked"; reasonCode: string };

/** Runtime palace names observed from iztro (includes 仆役, not 交友). */
export const ZIWEI_RUNTIME_PALACES = [
  "命宫",
  "兄弟",
  "夫妻",
  "子女",
  "财帛",
  "疾厄",
  "迁移",
  "仆役",
  "官禄",
  "田宅",
  "福德",
  "父母",
] as const;

/** Major/aux stars observed in FactPack majorStars / soul / body / sihua. */
export const ZIWEI_RUNTIME_STARS = [
  "紫微",
  "天机",
  "太阳",
  "武曲",
  "天同",
  "廉贞",
  "天府",
  "太阴",
  "贪狼",
  "巨门",
  "天相",
  "天梁",
  "七杀",
  "破军",
  "文昌",
  "文曲",
  "左辅",
  "右弼",
  "禄存",
] as const;

export const ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS = [
  "水二局",
  "木三局",
  "金四局",
  "土五局",
  "火六局",
] as const;

const INTERNAL = (reasonCode: string): ZiweiTokenDisposition => ({
  status: "internal_only",
  reasonCode,
});

/**
 * Explicit disposition table. Tokens absent here fall through to SSOT resolve,
 * then unknown_blocked.
 */
const DISPOSITION: ReadonlyMap<string, ZiweiTokenDisposition> = new Map([
  // 命宫 has public glossary (zw_identity_field); other palaces pending naming.
  ...ZIWEI_RUNTIME_PALACES.filter((p) => p !== "命宫").map(
    (p) => [p, INTERNAL("palace_soft_label_pending")] as const,
  ),
  ...ZIWEI_RUNTIME_STARS.map((s) => [s, INTERNAL("star_soft_label_pending")] as const),
  ...ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS.map(
    (v) => [v, INTERNAL("five_elements_class_soft_label_pending")] as const,
  ),
]);

export function ziweiTokenDisposition(token: string): ZiweiTokenDisposition {
  const t = token.trim();
  if (!t) return { status: "unknown_blocked", reasonCode: "empty_token" };
  const hit = DISPOSITION.get(t);
  if (hit) return hit;
  return { status: "unknown_blocked", reasonCode: "unregistered_ziwei_token" };
}

export function isZiweiTraditionalLeakCandidate(text: string): boolean {
  const s = text.trim();
  if (!s) return false;
  if (DISPOSITION.has(s)) return true;
  if ((ZIWEI_RUNTIME_PALACES as readonly string[]).includes(s)) return true;
  if ((ZIWEI_RUNTIME_STARS as readonly string[]).includes(s)) return true;
  if ((ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS as readonly string[]).includes(s)) return true;
  return false;
}
