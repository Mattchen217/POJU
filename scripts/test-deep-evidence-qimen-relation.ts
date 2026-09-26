/**
 * P4 write depth: 半合 from cite + 奇门主客方向.
 * Run: pnpm exec tsx scripts/test-deep-evidence-qimen-relation.ts
 */
import assert from "node:assert/strict";
import {
  assessDeepEvidenceUnitDepth,
  claimRelationMissing,
  ensureClaimCarriesCiteRelationPhrases,
  qimenHostGuestDirectionFail,
  softRepairMissingCiteRelations,
} from "@/lib/llm/pro/delivery/page-schema/deep-evidence-quality";

const citeHg =
  "值使: 開門落坎一宮 主客：值符遁干壬(水) · 时干己(土) → 客克主";
const claimHg =
  "陰遁一局值使開門落坎一宮，值符遁干壬水，时干己土，形成客克主之势，主方行动受制";

assert.equal(
  qimenHostGuestDirectionFail(
    "时干己土。壬水克己土。主方行动受客方克制。",
    claimHg,
    citeHg,
  ),
  "qimen_host_guest_reversed",
);
assert.equal(
  qimenHostGuestDirectionFail(
    "时干己土。日主己土身强。大运壬寅。流年丙午火势更旺。",
    claimHg,
    citeHg,
  ),
  "qimen_host_guest_missing",
);
assert.equal(
  qimenHostGuestDirectionFail(
    "时干己土为客。值符遁干壬水为主。己土克壬水。客克主成立。主方受制。",
    claimHg,
    citeHg,
  ),
  null,
);

const citeBanHe =
  "当前大运：壬寅 当前流年：丙午 当前运岁引动：寅午半合火局(大运引动·月支)";
const claimBanHe =
  "当前大运壬寅，天干壬水用神透出，但地支寅木生火助忌神，流年丙午加重火土忌神，用神未透足，运岁窗口未熟";

assert.equal(
  claimRelationMissing(
    "大运壬寅。天干壬水为用神透出。流年丙午。地支午火忌神当令。",
    claimBanHe,
    citeBanHe,
  ),
  true,
  "cite 寅午半合 must be required",
);
assert.equal(
  claimRelationMissing(
    "大运壬寅。流年丙午。寅午半合火局引动月支午火。用神未透足。运岁窗口未熟。",
    claimBanHe,
    citeBanHe,
  ),
  false,
);

// Soft-repair: paraphrase (生火) without 半合 → inject locked cite phrase.
const lab42Ev =
  "大运壬寅天干壬水为用神透出。地支寅木生火助忌神。流年丙午天干丙火为忌神。地支午火亦为忌神。日主己土身强。当前大运流年火土忌神当旺。用神未透足。";
assert.equal(claimRelationMissing(lab42Ev, claimBanHe, citeBanHe), true);
const repaired = softRepairMissingCiteRelations(lab42Ev, claimBanHe, citeBanHe);
assert.equal(repaired.repaired, true);
assert.equal(claimRelationMissing(repaired.evidence, claimBanHe, citeBanHe), false);
assert.ok(repaired.evidence.includes("寅午半合"));
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "dimensions[2]",
    evidence: repaired.evidence,
    chart_anchors: [],
    calc_cite: citeBanHe,
    unit_claim: claimBanHe,
  }),
  null,
  "soft-repaired Lab#42 body must pass depth",
);

// Assign: claim must carry cite-locked 半合 so write expands relation.
const claimWithRel = ensureClaimCarriesCiteRelationPhrases(claimBanHe, citeBanHe);
assert.ok(claimWithRel.includes("寅午半合"), `claim carry: ${claimWithRel}`);

const failRev = assessDeepEvidenceUnitDepth({
  path: "dimensions[0]",
  evidence:
    "时干己土。壬水克己土。己土为日主。主方行动受客方克制。流年丙午。天干丙火生己土。地支午火为忌神。更添受制。",
  chart_anchors: [],
  calc_cite: citeHg,
  unit_claim: claimHg,
});
assert.ok(
  failRev?.includes("qimen_host_guest_reversed"),
  `expected reversed, got ${failRev}`,
);

const failGap = assessDeepEvidenceUnitDepth({
  path: "dimensions[2]",
  evidence:
    "大运壬寅。天干壬水为用神透出。但坐寅木忌神。流年丙午。天干丙火忌神透出。地支午火忌神当令。日主己土身强。",
  chart_anchors: [],
  calc_cite: citeBanHe,
  unit_claim: claimBanHe,
});
assert.ok(
  failGap?.includes("claim_relation_gap"),
  `expected relation gap, got ${failGap}`,
);

const career = assessDeepEvidenceUnitDepth({
  path: "dimensions[1]",
  evidence:
    "日主己土身强。时柱辛未天干辛金为食神。食神泄秀为喜神。地支未中藏干己土比肩。食神坐比肩。话语权受制。食神制杀但力量分散。",
  chart_anchors: [],
  calc_cite: "时柱 辛未 天干辛 地支未 十神食神",
  unit_claim: "日主己土，时柱辛未食神透干，格局食伤偏显，角色力量偏在食神",
});
assert.ok(
  career?.includes("career_means"),
  `expected career means on 话语权, got ${career}`,
);

console.log("test-deep-evidence-qimen-relation: ok");
