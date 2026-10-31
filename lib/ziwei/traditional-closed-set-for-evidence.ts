/**
 * Evidence / judgment layer · this-chart Ziwei traditional closed-set inventory.
 *
 * Dual-layer lock (TERMS-PIPELINE-SPEC-v1):
 * - Evidence & BookJudgmentPack destiny: free traditional multi-char terms from this chart.
 * - Body / page soft slices: soft projection only (see soft-zfp-labels.ts) — never dump this block there.
 *
 * Soft encode (⟦t:…⟧ → soft label) is code-side after the model writes traditional.
 */

import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import { patternHitRefsForPrompt } from "@/lib/ziwei/soft-zfp-labels";

const MULTI_CHAR_MIN = 2;

function pushMulti(out: string[], raw: string | null | undefined): void {
  const t = (raw ?? "").trim();
  if (t.length < MULTI_CHAR_MIN) return;
  if (!out.includes(t)) out.push(t);
}

function pushList(out: string[], items: readonly string[] | null | undefined): void {
  for (const x of items ?? []) pushMulti(out, x);
}

/** Collect this-chart traditional multi-char surfaces for evidence inventory. */
export function collectZiweiTraditionalInventory(
  pack: ZiweiFactPack | null | undefined,
): string[] {
  if (!pack) return [];
  const out: string[] = [];
  const tp = pack.topicPalace;
  if (tp) {
    pushMulti(out, tp.palace);
    pushMulti(out, tp.oppositePalace);
    pushList(out, tp.majorStars);
    pushList(out, tp.oppositeMajorStars);
  }
  const ms = pack.mingShen;
  if (ms) {
    pushMulti(out, ms.soul);
    pushMulti(out, ms.body);
    pushMulti(out, ms.shenPalace);
    pushMulti(out, ms.fiveElementsClass);
  }
  for (const h of pack.sihua ?? []) {
    pushMulti(out, h.star);
    pushMulti(out, h.palace);
    pushMulti(out, h.mutagen);
  }
  const dx = pack.daxian;
  if (dx) {
    pushMulti(out, dx.palace);
    pushList(out, dx.majorStars);
    for (const h of dx.sihua ?? []) {
      pushMulti(out, h.star);
      pushMulti(out, h.palace);
      pushMulti(out, h.mutagen);
    }
    pushMulti(out, dx.liunian?.palace);
    for (const h of dx.liunian?.sihua ?? []) {
      pushMulti(out, h.star);
      pushMulti(out, h.palace);
      pushMulti(out, h.mutagen);
    }
  }
  for (const p of pack.patternHits ?? []) {
    pushMulti(out, p.name);
    pushList(out, p.palaces);
  }
  return out;
}

/**
 * Prompt block for evidence / destiny judgment when zfpOmitted=false.
 * Body prompts must NOT include this block.
 */
export function formatZiweiTraditionalClosedSetForEvidence(
  pack: ZiweiFactPack | null | undefined,
  opts?: { locale?: string },
): string {
  if (!pack) return "";
  const inventory = collectZiweiTraditionalInventory(pack);
  if (!inventory.length) return "";
  const locale = opts?.locale ?? "zh";
  const hitRefs = patternHitRefsForPrompt(pack.patternHits ?? []);
  const rows = inventory.map((t) => `| ${t} |`).join("\n");
  if (locale === "en") {
    return [
      "## Ziwei traditional closed-set (evidence layer · free traditional · no markers)",
      "Write multi-char traditional terms from the table naturally into destiny evidence/claims.",
      "Soft-translate is code-side. Do not invent out-of-set stars/patterns.",
      "On-topic only: use a term only when it supports this unit's segment duty; never dump the whole chart.",
      "| allowed traditional |",
      "|---|",
      rows,
      hitRefs.length
        ? `Stable pattern refs (also record used ones in pattern_hits_used):\n${hitRefs.join(" · ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "## 紫微传统闭集（依据层 · 自由传统词 · 禁止打标）",
    "destiny / 命理依据：只用上表本盘多字传统真词自然写入句子；软译由代码层（autoMark + SSOT）。",
    "禁止发明集外宫星格局；禁止 ⟦t:⟧ / ?t: 标记壳。",
    "相关才用：段职责列到且与本单元主张相关才写入；禁整盘灌段。",
    "| 可用传统词 |",
    "|---|",
    rows,
    hitRefs.length
      ? `格局稳定引用（用则入 pattern_hits_used；古典格名可与 hit 并存于 claim）：\n${hitRefs.join(" · ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
