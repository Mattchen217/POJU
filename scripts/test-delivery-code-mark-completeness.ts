/**
 * P1 gate: word-slot encoder + polish must leave zero bare 命理 in content.
 *
 * Run: pnpm exec tsx scripts/test-delivery-code-mark-completeness.ts
 * Exit 0 = green (required before P2/P3).
 */

import { CLOSED_SET_SLUG } from "@/lib/glossary/term-closed-set";
import { POJU_TERMS, type TermLocale } from "@/lib/glossary/pojulife-terms";
import {
  bracketUnresolvedTerm,
  encodeAndPolishDeliveryEvidence,
  encodeTraditionalWordSlots,
  listUnresolvedWordSlots,
  resolveTraditionalToSlug,
} from "@/lib/llm/sanitize/term-marking";
import { maskMarkersForAudit } from "@/lib/llm/sanitize/term-marking";
import { bareMingliWordInPlain } from "@/lib/llm/sanitize/term-marking";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const LOCALES: TermLocale[] = ["zh", "en", "es", "de", "fr"];

/** Half-jargon / engine words that must not appear in user-facing definitions. */
const DEF_JARGON_RE =
  /食神|伤官|七杀|正官|偏印|正印|日主|十神|用神|忌神|大运|流年|才华星|压力星|支持星|官杀|Day Master|Ten God|Useful God/i;

console.log("== definition audit (bazi SSOT) ==");
let defFail = 0;
for (const t of POJU_TERMS) {
  if (t.ns !== "bazi") continue;
  for (const loc of LOCALES) {
    const d = (t.definition[loc] ?? "").trim();
    if (!d) {
      console.error(`  empty definition ${t.slug}.${loc}`);
      defFail += 1;
      continue;
    }
    if (DEF_JARGON_RE.test(d)) {
      console.error(`  jargon in definition ${t.slug}.${loc}: ${d.slice(0, 60)}`);
      defFail += 1;
    }
  }
}
assert(defFail === 0, `definition audit failed (${defFail} issues)`);
console.log("  OK — bazi definitions vernacular + complete for 5 locales");

console.log("== resolveTraditionalToSlug smoke ==");
assert(resolveTraditionalToSlug("天乙贵人") === "tian_yi_gui_ren", "天乙贵人 → slug");
assert(resolveTraditionalToSlug("食神") === "shi_shen", "食神 → slug");
assert(resolveTraditionalToSlug("日主") === "day_master", "日主 → slug");
assert(resolveTraditionalToSlug("乙木") === "stem_yi", "乙木 compound → stem_yi");
assert(resolveTraditionalToSlug("辛金") === "stem_xin", "辛金 compound → stem_xin");
assert(resolveTraditionalToSlug("寅木") === "branch_yin", "寅木 compound → branch_yin");
assert(resolveTraditionalToSlug("巳火") === "branch_si", "巳火 compound → branch_si");
assert(resolveTraditionalToSlug("乙") === "stem_yi", "single stem → stem_yi");
assert(resolveTraditionalToSlug("丁酉") === "bare_ganzhi", "六十甲子 → bare_ganzhi");
assert(resolveTraditionalToSlug("正官星") === "zheng_guan", "正官星 → zheng_guan");
assert(resolveTraditionalToSlug("身旺") === "strong_self", "身旺 → strong_self");
assert(resolveTraditionalToSlug("官星") === null, "官星 must not guess");
assert(resolveTraditionalToSlug("印") === null, "single-char banned");
console.log("  OK");

console.log("== word-slot encode ==");
const slotted = encodeTraditionalWordSlots(
  "因⟦w:天乙贵人⟧护局,⟦w:食神⟧泄秀,⟦词:正印⟧生身,⟦w:乙木⟧生发。",
);
assert(slotted.unresolved.length === 0, `unexpected unresolved: ${slotted.unresolved}`);
assert(slotted.text.includes("⟦t:tian_yi_gui_ren|⟧"), "tian_yi encoded");
assert(slotted.text.includes("⟦t:shi_shen|⟧"), "shi_shen encoded");
assert(slotted.text.includes("⟦t:zheng_yin|⟧") || slotted.text.includes("正印"), "zheng_yin path");
assert(slotted.text.includes("⟦t:stem_yi|⟧"), "乙木 → stem_yi");
assert(!slotted.text.includes("⟦w:"), "no leftover w-slots");
console.log("  OK");

console.log("== unknown slot soft 【】 (no hard-fail) ==");
let threw = false;
let softOut = "";
try {
  softOut = encodeAndPolishDeliveryEvidence(
    "见⟦w:阴阳差错⟧为凶，又见⟦w:官星⟧压力。",
    "zh",
  );
} catch (e) {
  threw = true;
  console.error("unexpected throw:", e);
}
assert(!threw, "unknown 真词 must NOT hard-fail / STOP");
assert(!softOut.includes("⟦w:"), "no leftover w-slots after soft path");
assert(
  softOut.includes("【") && softOut.includes("】"),
  "unresolved slots become 【】",
);
assert(!softOut.includes("阴阳差错"), "集外神煞 must not re-emit inside 【】");
assert(
  bracketUnresolvedTerm("官星").includes("【"),
  "官星 → vernacular 【】",
);
console.log("  OK — soft 【】 + warn; delivery continues");

console.log("== activated-chart completeness (slot encode + polish) ==");
/** Surfaces drawn from closed-set + common bazi traditionals — wrap every one. */
const surfaces = new Set<string>();
for (const [han, slug] of Object.entries(CLOSED_SET_SLUG)) {
  if (han.length >= 2 && slug && !/^[a-z]/.test(han)) surfaces.add(han);
}
for (const t of POJU_TERMS) {
  if (t.ns !== "bazi") continue;
  if (t.traditional.length >= 2) surfaces.add(t.traditional);
  for (const a of t.aliases ?? []) {
    if (a.length >= 2) surfaces.add(a);
  }
}
// Cap to keep the synthetic paragraph readable but still stress coverage.
const sample = [...surfaces]
  .filter((w) => !/^(官星|财星|杀星|印星|比劫|食伤|官杀|才星)$/.test(w))
  .sort((a, b) => b.length - a.length)
  .slice(0, 120);

const rawEvidence =
  "承重链：" +
  sample.map((w) => `⟦w:${w}⟧`).join("与") +
  "相续成立。";

const polished = encodeAndPolishDeliveryEvidence(rawEvidence, "zh");
assert(listUnresolvedWordSlots(polished).length === 0, "no unresolved after polish");
assert(!polished.includes("⟦w:"), "no w-slots in polished");

const masked = maskMarkersForAudit(polished);
const bare = bareMingliWordInPlain(masked);
assert(bare === null, `bare 命理 residual: ${bare}`);

// Grep-style: traditional surfaces must not appear outside markers.
let grepHits = 0;
for (const w of sample) {
  if (masked.includes(w)) {
    console.error(`  grep hit bare traditional: ${w}`);
    grepHits += 1;
  }
}
assert(grepHits === 0, `completeness grep hits=${grepHits}`);
console.log(`  OK — ${sample.length} surfaces → zero bare grep`);

console.log("\nP1 completeness gate GREEN");
