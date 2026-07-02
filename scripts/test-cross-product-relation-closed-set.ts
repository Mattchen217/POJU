/**
 * 指令 7 · Glyph / Syncro / Match 共享 relation-engine + 闭集接线验收
 *
 *   pnpm exec tsx scripts/test-cross-product-relation-closed-set.ts
 */
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  computeCrossProfileBranchRelations,
} from "@/lib/calculations/relation-engine";
import { RELATION_KIND_SOFT } from "@/lib/glossary/term-closed-set";
import { buildGlyphReadingPrompt } from "@/lib/llm/prompts/glyph-deepseek-prompt";
import { buildMatchPrompt } from "@/lib/llm/prompts/match-deepseek-prompt";
import {
  buildMatchRelationClosedSet,
  buildSingleProfileRelationClosedSet,
} from "@/lib/llm/prompts/relation-closed-set-context";
import { buildSyncroPrompt } from "@/lib/llm/prompts/syncro-deepseek-prompt";
import {
  auditDeepStringFields,
} from "@/lib/llm/services/delivery-audit-regen";
import { encodeTermMarker, plainByTermId } from "@/lib/llm/sanitize/compliance-terms";
import type { ResonanceMatrix } from "@/lib/match/calculate-compatibility";
import type { MatrixCell } from "@/lib/syncro/calculate-matrix";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function makeProfile(four: {
  year: string;
  month: string;
  day: string;
  hour: string;
}): ProfileStructured {
  const pillar = (gz: string) => ({
    ganzhi: gz,
    stem: gz.charAt(0),
    branch: gz.charAt(1),
    ten_god: "",
    hidden_stems: [] as string[],
    shen_sha: [] as string[],
  });
  return {
    day_master: four.day.charAt(0),
    pattern: "",
    yong_shen: "",
    xi_shen: [],
    ji_shen: [],
    strength: "balanced",
    four_pillars: four,
    pillars_detail: {
      year: pillar(four.year),
      month: pillar(four.month),
      day: pillar(four.day),
      hour: pillar(four.hour),
    },
    da_yun: [],
    data_availability: {
      pillars_detail: true,
      da_yun: false,
      bazi_enrichment: false,
    },
  };
}

const stubMatrixCell = (): MatrixCell =>
  ({
    hour_period: "zi",
    direction_id: "N",
    current_level: "stillwater",
    _internal: { total_score: 50, key_factors: [], qimen_data: {} },
  }) as MatrixCell;

const stubResonanceMatrix = (): ResonanceMatrix =>
  ({
    synergy_type: "complementary_flow",
    resonance_index: 72,
    dimensions: {},
    key_insights: [],
  }) as ResonanceMatrix;

console.log("\n=== cross-product relation closed-set (指令 7) ===\n");

const chartA = makeProfile({ year: "甲子", month: "丙午", day: "戊辰", hour: "甲寅" });
const chartB = makeProfile({ year: "庚午", month: "壬子", day: "丁酉", hour: "癸卯" });

// --- shared module ---
const singleClosed = buildSingleProfileRelationClosedSet(chartA, { questionText: "跳槽时机" });
assert("single allowlist non-empty", singleClosed.auditAllowlist.length > 0);
assert("single inventory has 本盘动态关系", singleClosed.inventoryBlock.includes("本盘动态关系"));
assert("discipline block present", singleClosed.disciplineBlock.includes("算全 · 不写全"));

const matchClosed = buildMatchRelationClosedSet(chartA, chartB, "我们感情还能走下去吗");
assert("match block has 双人今年动态", matchClosed.matchRelationBlock.includes("双人今年动态"));
assert("match allowlist includes cross ids", matchClosed.auditAllowlist.some((r) => r.id.startsWith("cross_")));

const cross = computeCrossProfileBranchRelations(chartA, chartB);
assert("cross-profile relations computed", cross.length > 0, `count=${cross.length}`);

// --- Glyph prompt ---
const glyphPrompt = buildGlyphReadingPrompt({
  profile: null,
  base_analysis: { structured: chartA },
  question: "感情里该坚持还是放手？",
  glyph: {
    id: 42,
    name: "测试签",
    wind_category: "Fair Sky",
    classical_text: "签文原文",
    modern_translation: "internal only",
    key_themes: ["耐心"],
  },
  locale: "zh",
});
assert("glyph system injects closed-set guard", glyphPrompt.system.includes("只有上面这几个"));
assert("glyph system injects discipline", glyphPrompt.system.includes("算全 · 不写全"));

// --- Syncro prompt ---
const syncroPrompt = buildSyncroPrompt({
  profile: null,
  base_analysis: { structured: chartA },
  task_description: "明天下午去谈合同",
  user_location: { latitude: 40.7, longitude: -74.0, timezone: "America/New_York" },
  locale: "zh",
  matrix: { zi__N: stubMatrixCell() },
});
assert("syncro system injects closed-set", syncroPrompt.system.includes("本盘动态关系"));
assert("syncro system injects discipline", syncroPrompt.system.includes("算全 · 不写全"));

// --- Match prompt ---
const matchPrompt = buildMatchPrompt({
  a_profile: null,
  b_profile: null,
  a_base_analysis: { structured: chartA },
  b_base_analysis: { structured: chartB },
  relationship_description: "我们还能复合吗",
  locale: "zh",
  compatibilityMatrix: stubResonanceMatrix(),
});
assert("match system injects Match 动态关系闭集", matchPrompt.system.includes("Match 动态关系闭集"));
assert("match system injects 双人今年动态", matchPrompt.system.includes("双人今年动态"));

// --- audit: allowed vs invented (all three products) ---
const chongRel =
  singleClosed.auditAllowlist.find((r) => r.id === "chong_午_子") ?? singleClosed.auditAllowlist[0]!;
const allowedMarker = encodeTermMarker(
  chongRel.id,
  RELATION_KIND_SOFT[chongRel.kind]?.zh ?? RELATION_KIND_SOFT.chong.zh,
  plainByTermId(chongRel.id, "zh") ?? chongRel.han,
);
const allowedCopy = `叙事里${allowedMarker}可作为背景张力。`;

for (const product of ["glyph", "syncro", "match"] as const) {
  const relations = product === "match" ? matchClosed.auditAllowlist : singleClosed.auditAllowlist;
  const okViolations = auditDeepStringFields(allowedCopy, "zh", undefined, {
    structured: chartA,
    relations,
  });
  assert(
    `${product} allowed relation passes audit`,
    !okViolations.some((v) => v.label.startsWith("relation_")),
  );

  const invented = "命盘里寅巳相刑需要经营。";
  const badViolations = auditDeepStringFields(invented, "zh", product, {
    structured: chartA,
    relations,
  });
  assert(
    `${product} invented relation blocked`,
    badViolations.some((v) => v.label.startsWith("relation_")),
  );
}

console.log(
  process.exitCode === 1
    ? "\nSome cross-product relation checks failed.\n"
    : "\nAll cross-product relation closed-set checks passed.\n",
);
