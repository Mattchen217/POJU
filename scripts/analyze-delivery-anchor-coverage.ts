/**
 * Compare Stage-2 inventory breadth vs delivery evidence anchors in a dump MD.
 * Usage: pnpm exec tsx scripts/analyze-delivery-anchor-coverage.ts [path-to-md]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mdPath = resolve(
  process.argv[2] ??
    "d:/POJU/2阶段交付和3阶段首问和模型的推理和输出+交付报告过程中所有模型的输出.MD",
);

const text = readFileSync(mdPath, "utf8");

/** Traditional / brand anchors that Stage-2 reckoning actually used (from dump). */
const STAGE2_SEED: string[] = [
  "身弱",
  "七杀",
  "正官",
  "官杀",
  "用神",
  "忌神",
  "偏印",
  "元女",
  "将星",
  "德秀贵人",
  "月德合",
  "寡宿",
  "月德贵人",
  "月德",
  "绝",
  "养",
  "冠带",
  "甲子",
  "大运",
  "子未相害",
  "子辰半合",
  "午未六合",
  "流年",
  "水",
  "火",
  "土",
  "乙木",
  "正财",
  "正印",
];

function extractWSlots(src: string): string[] {
  const out: string[] = [];
  const re = /⟦w:([^⟧]+)⟧/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const raw = (m[1] ?? "").trim();
    if (raw) out.push(raw);
  }
  return out;
}

function extractTIds(src: string): string[] {
  const out: string[] = [];
  const re = /⟦t:([a-z0-9_]+)(?:\|[^⟧]*)?⟧/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const id = (m[1] ?? "").trim().toLowerCase();
    if (id) out.push(id);
  }
  return out;
}

/** Rough split: delivery evidence JSON blobs after mid-file (line ~1000+). */
const deliverySlice = text.slice(Math.floor(text.length * 0.55));
const stage2Slice = text.slice(0, Math.floor(text.length * 0.45));

const wAll = extractWSlots(deliverySlice);
const tAll = extractTIds(text);
const wUnique = [...new Set(wAll)];
const tUnique = [...new Set(tAll)];

// Count frequency of w-slots
const wFreq = new Map<string, number>();
for (const w of wAll) wFreq.set(w, (wFreq.get(w) ?? 0) + 1);
const topW = [...wFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);

// Which stage2 seeds appear in delivery w-slots or nearby evidence text?
function normalize(s: string): string {
  return s.replace(/\s+/g, "");
}

const deliveryEvidenceText = deliverySlice;
const usedFromStage2: string[] = [];
const missingFromStage2: string[] = [];
for (const seed of STAGE2_SEED) {
  const hit =
    wUnique.some((w) => normalize(w).includes(normalize(seed)) || normalize(seed).includes(normalize(w))) ||
    deliveryEvidenceText.includes(seed);
  if (hit) usedFromStage2.push(seed);
  else missingFromStage2.push(seed);
}

// Soft appendix-like brand terms (from user screenshot) — check if they dominate
const APPENDIX_SOFT = [
  "需养",
  "淬炼",
  "归零",
  "耗元",
  "锚元",
  "妙启",
  "框架",
  "束装",
  "统御",
  "固资",
  "纪元",
  "岁环",
  "疏离",
  "核渊",
  "润德",
  "烈焰",
  "暖沙",
  "萌发",
  "双契",
  "潜流",
  "挺秀",
  "型格",
  "供源",
];

const softHitsInW = APPENDIX_SOFT.filter((s) => wUnique.some((w) => w.includes(s)));
const traditionalW = wUnique.filter(
  (w) =>
    /身弱|七杀|正官|偏印|正印|用神|忌神|寡宿|月德|将星|冠带|绝|养|大运|甲子|午未|流年|正财|官杀|火土|子水|长生/.test(
      w,
    ),
);

console.log("=== Delivery anchor coverage analysis ===");
console.log("file:", mdPath);
console.log("bytes:", text.length);
console.log("");
console.log("--- Evidence ⟦w:⟧ slots (delivery half of dump) ---");
console.log("total mentions:", wAll.length);
console.log("unique w-terms:", wUnique.length);
console.log("top frequency:");
for (const [k, n] of topW) console.log(`  ${n}×  ${k}`);
console.log("");
console.log("unique w-terms that look traditional (命理真词):", traditionalW.length);
console.log(traditionalW.join(" | "));
console.log("");
console.log("soft appendix-brand hits inside ⟦w:⟧ (should be rare):", softHitsInW.length);
console.log(softHitsInW.join(" | ") || "(none)");
console.log("");
console.log("--- ⟦t:slug⟧ ids anywhere in dump ---");
console.log("unique t-ids:", tUnique.length);
console.log(tUnique.slice(0, 40).join(", "), tUnique.length > 40 ? "…" : "");
console.log("");
console.log("--- Stage-2 closed-set seeds vs delivery evidence ---");
console.log("stage2 seeds checked:", STAGE2_SEED.length);
console.log("appeared in delivery evidence:", usedFromStage2.length);
console.log("  ", usedFromStage2.join("、"));
console.log("not clearly cited in delivery half:", missingFromStage2.length);
console.log("  ", missingFromStage2.join("、") || "(none)");
console.log("");
console.log("--- Verdict heuristic ---");
const tradShare = traditionalW.length / Math.max(wUnique.length, 1);
const coverage = usedFromStage2.length / Math.max(STAGE2_SEED.length, 1);
console.log(
  `traditional_share_of_unique_w=${(tradShare * 100).toFixed(0)}%  stage2_seed_coverage=${(coverage * 100).toFixed(0)}%`,
);

// Category breadth (Layer A metric) — heuristic buckets on unique w-slots
const CAT_RULES: Array<{ id: string; re: RegExp }> = [
  { id: "ten_god", re: /比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印|官杀/ },
  { id: "shen_sha", re: /寡宿|将星|月德|贵人|文昌|桃花|德秀/ },
  { id: "relation", re: /合|冲|刑|害|半合|三合|流年/ },
  { id: "life_stage_hidden", re: /长生|沐浴|冠带|临官|帝旺|衰|病|死|墓|绝|胎|养|藏干/ },
  { id: "dayun", re: /大运|甲子|乙丑|气候交织/ },
  { id: "core_structure", re: /用神|忌神|喜神|身弱|身强/ },
];
const catHits = new Map<string, number>();
for (const w of wUnique) {
  for (const { id, re } of CAT_RULES) {
    if (re.test(w)) catHits.set(id, (catHits.get(id) ?? 0) + 1);
  }
}
console.log("");
console.log("--- Category breadth among unique ⟦w:⟧ (heuristic) ---");
for (const { id } of CAT_RULES) {
  console.log(`  ${id}: ${catHits.get(id) ?? 0} unique tokens`);
}
const diversityCats = ["ten_god", "shen_sha", "relation", "life_stage_hidden", "dayun"] as const;
const nonEmptyCats = diversityCats.filter((c) => (catHits.get(c) ?? 0) > 0).length;
console.log(`diversity_categories_hit=${nonEmptyCats}/${diversityCats.length}`);

if (tradShare >= 0.5 && coverage >= 0.55) {
  console.log(
    "RESULT: NOT \"only 24 soft appendix brands\". Evidence layer uses traditional 命理真词 densely; Stage-2 inventory is partially carried into evidence.",
  );
  console.log(
    "GAP vs product intent: appendix soft-label table under-represents breadth; user sees 24 soft names while evidence ⟦w:⟧ carries more raw terms — soft-encode may collapse many 真词 onto fewer brand softs.",
  );
} else if (tradShare < 0.35) {
  console.log("RESULT: Evidence looks soft-brand heavy / thin traditional — closer to user's concern (1).");
} else {
  console.log("RESULT: Mixed — some traditional anchors, incomplete Stage-2 transfer.");
}

// Stage2 slice richness (mention counts)
const stage2Hits = STAGE2_SEED.map((s) => ({
  s,
  n: (stage2Slice.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length,
})).filter((x) => x.n > 0);
console.log("");
console.log("--- Stage-2 half: seed mention counts (reasoning richness) ---");
for (const { s, n } of stage2Hits.sort((a, b) => b.n - a.n).slice(0, 20)) {
  console.log(`  ${n}×  ${s}`);
}
