/**
 * P4 奇门结构词闭集 — chart_anchors stamp / timing moat-serve / assign bind。
 * Align with glossary `qm_*` traditional forms (+ simplified aliases).
 * Do not invent a second soft-translate table here.
 */

/** Prefer longer labels first so 坎一宮 beats 坎 when both match. */
export const QIMEN_STRUCTURE_ANCHOR_LABELS = [
  "客克主",
  "主克客",
  "主生客",
  "客生主",
  "值符遁干",
  "值符",
  "值使",
  "陰遁",
  "阴遁",
  "陽遁",
  "阳遁",
  "開門",
  "开门",
  "休門",
  "休门",
  "生門",
  "生门",
  "傷門",
  "伤门",
  "杜門",
  "杜门",
  "景門",
  "景门",
  "死門",
  "死门",
  "驚門",
  "惊門",
  "惊门",
  "坎一宮",
  "坎一宫",
  "坤二宮",
  "坤二宫",
  "震三宮",
  "震三宫",
  "巽四宮",
  "巽四宫",
  "中五宮",
  "中五宫",
  "乾六宮",
  "乾六宫",
  "兑七宮",
  "兑七宫",
  "艮八宮",
  "艮八宫",
  "離九宮",
  "离九宫",
  "離九宫",
  "离九宮",
] as const;

/** Timing anchors / claims that count as 奇门局势 (not only 大运流年). */
export const QIMEN_TIMING_SERVE_RE =
  /客克主|主克客|主生客|客生主|值符|值使|陰遁|阴遁|陽遁|阳遁|開門|开门|休門|休门|生門|生门|傷門|伤门|杜門|杜门|景門|景门|死門|死门|驚門|惊門|惊门|坎一宮|坎一宫|坤二宮|坤二宫|震三宮|震三宫|巽四宮|巽四宫|中五宮|中五宫|乾六宮|乾六宫|兑七宮|兑七宫|艮八宮|艮八宫|離九宮|离九宫|離九宫|离九宮/;

/** Concrete 星门宫 / 局名 — for write retention (not bare 客/主 alone). */
export const QIMEN_STAR_DOOR_PALACE_RE =
  /陰遁|阴遁|陽遁|阳遁|[陰陽阴阳]遁[一二三四五六七八九十\d]+局|值使|開門|开门|休門|休门|生門|生门|傷門|伤门|杜門|杜门|景門|景门|死門|死门|驚門|惊門|惊门|坎一宮|坎一宫|坤二宮|坤二宫|震三宮|震三宫|巽四宮|巽四宫|中五宮|中五宫|乾六宮|乾六宫|兑七宮|兑七宫|艮八宮|艮八宫|離九宮|离九宫|離九宫|离九宮/;

/** Host/guest stance bind for assign ≥1 timing when lock present. */
export const QIMEN_HOST_GUEST_BIND_RE =
  /客克主|主克客|主生客|客生主|值符|值使/;

export function packHasQimenLock(packOrSlice: string | null | undefined): boolean {
  const t = (packOrSlice ?? "").trim();
  if (!t) return false;
  return /【奇门锁盘|值使:|值符:|局势取向:/.test(t);
}

export function anchorsIncludeQimenStructure(
  anchors: readonly string[],
): boolean {
  return anchors.some((a) => QIMEN_TIMING_SERVE_RE.test(a.trim()));
}

/**
 * Pull qimen structure tokens from prose (longest-first).
 * Also accepts 「陰遁一局」as a single anchor when present.
 */
export function extractQimenStructureAnchorsFromProse(
  text: string,
  max = 3,
): string[] {
  const t = text.trim();
  if (!t || max < 1) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const s = raw.trim();
    if (!s || seen.has(s) || out.length >= max) return;
    seen.add(s);
    out.push(s);
  };
  for (const m of t.matchAll(/[陰陽阴阳]遁[一二三四五六七八九十\d]+局/g)) {
    push(m[0]!);
  }
  for (const lab of QIMEN_STRUCTURE_ANCHOR_LABELS) {
    if (t.includes(lab)) push(lab);
  }
  return out;
}
