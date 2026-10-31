/**
 * Ziwei runtime token disposition (Phase 2 + Phase 11).
 *
 * Structure field labels + Phase 11 palace/star/config values live in POJU_TERMS (ns=ziwei).
 * Registered public tokens → public_glossary (must resolve via SSOT).
 * Unregistered traditional tokens → unknown_blocked (fail-closed; no traditional fallback).
 * Classical pattern names are NOT registered here — stay off user delivery (hit_id only).
 *
 * Inventory: scripts/phase9-ziwei-term-inventory.ts + test-ziwei-term-completeness-phase9.ts.
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

/**
 * Stars observed in FactPack majorStars / soul / body / sihua across inventory births.
 * Phase 9/11: includes 火星 (soul/body), not only fourteen majors + common aux.
 */
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
  "火星",
] as const;

export const ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS = [
  "水二局",
  "木三局",
  "金四局",
  "土五局",
  "火六局",
] as const;

const PUBLIC = (note?: string): ZiweiTokenDisposition => ({
  status: "public_glossary",
  ...(note ? { note } : {}),
});

/**
 * Explicit disposition table. Tokens absent here fall through to unknown_blocked
 * (unless SSOT resolve succeeds first at the call site).
 */
const DISPOSITION: ReadonlyMap<string, ZiweiTokenDisposition> = new Map([
  ...ZIWEI_RUNTIME_PALACES.map(
    (p) => [p, PUBLIC("phase11_palace_ssot")] as const,
  ),
  ...ZIWEI_RUNTIME_STARS.map(
    (s) => [s, PUBLIC("phase11_star_ssot")] as const,
  ),
  ...ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS.map(
    (v) => [v, PUBLIC("phase11_five_elements_config_ssot")] as const,
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
