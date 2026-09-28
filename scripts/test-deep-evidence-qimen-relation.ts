/**
 * P4 write depth: 半合 from cite + 奇门主客方向.
 * Run: pnpm exec tsx scripts/test-deep-evidence-qimen-relation.ts
 */
import assert from "node:assert/strict";
import {
  assessDeepEvidenceUnitDepth,
  claimRelationMissing,
  ensureClaimCarriesCiteRelationPhrases,
  evidenceRelationScopeFail,
  isCareerMeansClause,
  qimenHostGuestDirectionFail,
  qimenStarDoorPalaceRetentionFail,
  softRepairMissingCiteRelations,
  softRepairMissingDayunNearWindow,
  softRepairMissingQimenStarDoorPalace,
  stripSoftPaddingEvidence,
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

assert.equal(
  qimenStarDoorPalaceRetentionFail(
    "时干己土为客。值符遁干壬水为主。己土克壬水。客克主成立。主方受制。",
    claimHg,
    citeHg,
  ),
  "qimen_star_door_palace_missing",
  "bare 客/主 without 星门宫 fails retention",
);
assert.equal(
  qimenStarDoorPalaceRetentionFail(
    "陰遁一局。值使開門落坎一宮。时干己土克值符遁干壬水。客克主，主方受制。",
    claimHg,
    citeHg,
  ),
  null,
);
assert.equal(
  qimenStarDoorPalaceRetentionFail(
    "大运壬寅。流年丙午。用神水受制。",
    "当前大运壬寅水透干，流年丙午助忌",
    "当前大运壬寅",
  ),
  null,
  "non-qimen claim skips retention gate",
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

// Lab#46 false-pass: bare「半合助忌」+「午…相刑」must NOT cover 寅午半合.
const lab46Ev =
  "大运壬寅。天干壬水为正财。透出本为吉兆。半合助忌。流年天干丙火为正印。丙火克时干辛金食神。流年地支午火为偏印。午火与月支午火相刑。故用神未透足。";
assert.equal(
  claimRelationMissing(lab46Ev, claimBanHe, citeBanHe),
  true,
  "bare 半合 + 午相刑 must not cover 寅午半合",
);
assert.equal(evidenceRelationScopeFail(lab46Ev, claimBanHe, citeBanHe), "bare_relation");

const stripped46 = stripSoftPaddingEvidence(lab46Ev, "", claimBanHe, citeBanHe);
assert.equal(stripped46.includes("半合助忌"), false, "strip bare 半合");
assert.equal(stripped46.includes("相刑"), false, "strip same-zhi 相刑 as bare");

const repaired = softRepairMissingCiteRelations(lab46Ev, claimBanHe, citeBanHe);
assert.equal(repaired.repaired, true);
assert.ok(repaired.evidence.includes("寅午半合"), repaired.evidence);
assert.equal(repaired.evidence.includes("半合助忌"), false);
assert.equal(repaired.evidence.includes("相刑"), false);
assert.equal(claimRelationMissing(repaired.evidence, claimBanHe, citeBanHe), false);
assert.equal(evidenceRelationScopeFail(repaired.evidence, claimBanHe, citeBanHe), null);
const repairedNear = softRepairMissingDayunNearWindow(
  repaired.evidence,
  claimBanHe,
  citeBanHe,
);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "dimensions[2]",
    evidence: repairedNear.evidence,
    chart_anchors: [],
    calc_cite: citeBanHe,
    unit_claim: claimBanHe,
  }),
  null,
  "soft-repaired Lab#46 body must pass depth",
);

assert.ok(
  assessDeepEvidenceUnitDepth({
    path: "dimensions[2]",
    evidence: lab46Ev,
    chart_anchors: [],
    calc_cite: citeBanHe,
    unit_claim: claimBanHe,
  })?.includes("claim_relation_gap") ||
    assessDeepEvidenceUnitDepth({
      path: "dimensions[2]",
      evidence: lab46Ev,
      chart_anchors: [],
      calc_cite: citeBanHe,
      unit_claim: claimBanHe,
    })?.includes("bare_relation"),
  "raw Lab#46 must fail depth",
);

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

assert.equal(
  isCareerMeansClause("技艺表达与从容输出成为命局核心驱动力"),
  true,
  "ability brochure synonym family",
);
assert.equal(
  isCareerMeansClause("偏印的封闭性直接抑制食神的产出与表达能力"),
  true,
  "表达能力 brochure",
);
assert.equal(
  isCareerMeansClause("客方资源主导的格局下"),
  true,
  "客方资源 situation tail",
);
assert.equal(
  isCareerMeansClause(
    "以兼职试水之智（水）缓冲火土忌神对食神的克制",
  ),
  true,
  "兼职试水 fill-life tail must fail write",
);

{
  const life = assessDeepEvidenceUnitDepth({
    path: "dimensions[2]",
    evidence:
      "日主己土身强。时柱辛未食神辛金透干。食神为喜神。地支未土为忌神。内藏丁火偏印。与透干辛金形成偏印克食神之局。以兼职试水之智（水）缓冲火土忌神对食神的克制。",
    chart_anchors: [],
    calc_cite: "格局：食伤偏显",
    unit_claim: "日主己土，时柱辛未食神辛金透干，格局食伤偏显，角色力量落在食神一侧",
  });
  assert.ok(
    life?.includes("career_means"),
    `expected career_means on 兼职试水, got ${life}`,
  );
}

{
  const extra = evidenceRelationScopeFail(
    "日主己土生于午月。月柱丙午。午火直害丑中癸水。时柱辛金食神透干。",
    "日主己土生于午月，火土忌神当令，用神水弱未得令",
    "锚: 身强,用神为水,忌神为火土；原局水弱,火土过旺",
  );
  assert.equal(extra, "extra_relation", "午丑直害 outside claim∪cite");
}

// Lab #124: qimen too-thin + missing 星门宫 must fail; full qimen expand passes.
{
  const thin = assessDeepEvidenceUnitDepth({
    path: "dimensions[1]",
    evidence: "时干己土克值符遁干壬水。己土为忌神。壬水为用神。忌神克用神。主方受制。",
    chart_anchors: [],
    calc_cite: "值符遁干壬(水) · 时干己(土) → 客克主",
    unit_claim:
      "奇门锁盘陰遁一局，值符天心落离宫，值使开门落坎宫，值符遁干壬水为客，时干己土为主，客克主，主方受制",
  });
  assert.ok(
    thin &&
      (thin.includes("too_short") ||
        thin.includes("qimen_star_door_palace") ||
        thin.includes("shallow")),
    `expected thin/star-door fail, got ${thin}`,
  );

  const full = assessDeepEvidenceUnitDepth({
    path: "dimensions[1]",
    evidence:
      "陰遁一局。值使開門落坎一宮。时干己土克值符遁干壬水。客克主。主方壬水受制。客方己土加重对主方的克制。",
    chart_anchors: [],
    calc_cite: "值符遁干壬(水) · 时干己(土) → 客克主",
    unit_claim:
      "奇门锁盘陰遁一局，值符天心落离宫，值使开门落坎宫，值符遁干壬水为客，时干己土为主，客克主，主方受制",
  });
  assert.equal(full, null, `full qimen expand should pass, got ${full}`);

  // Lab #133: 只留陰遁 + 灌大运流年 = 类别不合格（即使闸曾放过）。
  const lab133 = assessDeepEvidenceUnitDepth({
    path: "dimensions[1]",
    evidence:
      "陰遁一局。时干己土为客。值符遁干壬水为主。己土克壬水。己土为日主比肩。壬水为用神。忌神克用神。主方受制。日主己土身强。原局火土忌神旺。用神水弱。客克主加剧用神受制。当前大运壬寅。天干壬水用神透出。但地支寅木生火。流年丙午。火土忌神极旺。忌神成势。克制用神水。客克主之局应时。主方受制。",
    chart_anchors: [],
    calc_cite: "值符遁干壬(水) · 时干己(土) → 客克主",
    unit_claim:
      "奇门锁盘陰遁一局，值符天心落离宫，值使开门落坎宫，时干己土为客，值符遁干壬水为主，客克主，主方受制",
  });
  assert.ok(
    lab133 &&
      (lab133.includes("qimen_foreign_dayun_dump") ||
        lab133.includes("qimen_star_door_palace")),
    `Lab#133 must fail dayun-dump or missing door/palace, got ${lab133}`,
  );
}

// Lab #138: 有开门无落宫 → retention fail；soft-repair 焊上 claim 落宫后应过。
{
  const lab138Ev =
    "陰遁一局。时干己土为客。值符遁干壬水为主。己土克壬水。主方受制。主方壬水为用神。受客方己土所克。用神受制。开门虽主开创。";
  const claim138 =
    "奇门锁盘陰遁一局，值符天心落离宫，值使开门落坎宫，时干己土为客，值符遁干壬水为主，客克主，主方受制";
  const cite138 = "值符遁干壬(水) · 时干己(土) → 客克主";
  const rawFail = assessDeepEvidenceUnitDepth({
    path: "dimensions[1]",
    evidence: lab138Ev,
    chart_anchors: [],
    calc_cite: cite138,
    unit_claim: claim138,
  });
  assert.ok(
    rawFail?.includes("qimen_star_door_palace"),
    `Lab#138 raw missing palace must fail, got ${rawFail}`,
  );
  const welded = softRepairMissingQimenStarDoorPalace(
    lab138Ev,
    claim138,
    cite138,
  );
  assert.ok(welded.repaired, "Lab#138 soft-repair should weld palace/door");
  assert.ok(
    /落坎|开门|開門/.test(welded.evidence),
    `welded must keep door+palace, got ${welded.evidence}`,
  );
  const after = assessDeepEvidenceUnitDepth({
    path: "dimensions[1]",
    evidence: welded.evidence,
    chart_anchors: [],
    calc_cite: cite138,
    unit_claim: claim138,
  });
  assert.equal(after, null, `Lab#138 after soft-repair should pass, got ${after}`);
}

// Lab #144: 运岁卡 claim 锁了近窗未熟，evidence 漏写 → fail；soft-repair 后过。
{
  const lab144Ev =
    "大运壬寅。天干壬水为用神透出。但地支寅木生火。火为忌神。寅木助忌。流年丙午。天干丙火为忌神。地支午火为忌神。忌神火成势。克制用神水。日主己土身强。此时火土忌神猖獗。用神壬水受制。";
  const claim144 =
    "当前大运壬寅，壬水用神透干但地支寅木生火助忌，流年丙午加重火土忌神，运岁近窗未熟，用神力量未透足";
  const cite144 = "当前大运：壬寅（32岁起） 当前流年：丙午";
  const raw = assessDeepEvidenceUnitDepth({
    path: "dimensions[4]",
    evidence: lab144Ev,
    chart_anchors: [],
    calc_cite: cite144,
    unit_claim: claim144,
  });
  assert.ok(
    raw?.includes("dayun_near_window"),
    `Lab#144 missing near-window must fail, got ${raw}`,
  );
  const welded = softRepairMissingDayunNearWindow(lab144Ev, claim144, cite144);
  assert.ok(welded.repaired && /近窗|未熟|气口/.test(welded.evidence));
  assert.equal(
    assessDeepEvidenceUnitDepth({
      path: "dimensions[4]",
      evidence: welded.evidence,
      chart_anchors: [],
      calc_cite: cite144,
      unit_claim: claim144,
    }),
    null,
  );
}

// Lab #136: archetype 四句短标签合计过短 → too_short；写满柱位+生克+坐支应过。
{
  const thinArch = assessDeepEvidenceUnitDepth({
    path: "dimensions[2]",
    evidence: "日主己土身强。时柱辛未食神辛金透干。辛金为喜神。转生用神水财。",
    chart_anchors: [],
    calc_cite: "格局：食伤偏显",
    unit_claim:
      "日主己土，时柱辛未食神辛金透干，格局食伤偏显，角色力量落在食神一侧",
  });
  assert.ok(
    thinArch &&
      (thinArch.includes("too_short") || thinArch.includes("shallow")),
    `Lab#136 thin archetype must fail, got ${thinArch}`,
  );

  const fullArch = assessDeepEvidenceUnitDepth({
    path: "dimensions[2]",
    evidence:
      "日主己土身强。时柱辛未。食神辛金透干。己土生辛金。辛金坐未土。未中藏干丁火己土。格局食伤偏显。食神为喜神。金可转生用神水。",
    chart_anchors: [],
    calc_cite: "格局：食伤偏显",
    unit_claim:
      "日主己土，时柱辛未食神辛金透干，格局食伤偏显，角色力量落在食神一侧",
  });
  assert.equal(fullArch, null, `full archetype should pass, got ${fullArch}`);
}

const strippedCareer = stripSoftPaddingEvidence(
  "时柱辛未。辛金食神透干。食神为日主己土所生。泄秀有力。日主身强。食神为喜神。食神透干得用。技艺表达与从容输出成为命局核心驱动力。年柱偏印丁火、月柱正印丙火混杂。印星为忌神。",
  "日主：己\n用神：水\n忌神：火土",
  "十神食神透干/当令，格局以食神为显",
  "锚: 十神偏印、正印混杂,食神透干；身强",
);
assert.equal(
  /技艺表达|核心驱动力/.test(strippedCareer),
  false,
  `soft-strip drops ability brochure, got: ${strippedCareer}`,
);
assert.ok(
  /食神透干/.test(strippedCareer),
  "soft-strip keeps structure clauses",
);

// Lab #127: polarity「忌成势+通关」句不得被软垫剥成 too_short。
{
  const tongguanEv =
    "忌神火土成势压局。通关未立于忌旺一侧。火土泄生制关口阻滞。用神水未得力。";
  const kept = stripSoftPaddingEvidence(
    tongguanEv,
    "日主：己\n用神：水\n忌神：火土",
    "忌火土成势压局，通关未立、生克关口阻滞在忌旺一侧",
    "忌神火成势；通关未立",
  );
  assert.ok(/通关/.test(kept), `通关 clause must survive strip, got: ${kept}`);
  assert.ok(/火土|忌神/.test(kept), `忌成势 must survive, got: ${kept}`);
  const depth = assessDeepEvidenceUnitDepth({
    path: "dimensions[2]",
    evidence: kept,
    chart_anchors: [],
    calc_cite: "忌神火成势；通关未立",
    unit_claim: "忌火土成势压局，通关未立、生克关口阻滞在忌旺一侧",
  });
  assert.equal(depth, null, `polarity 通关 expand should pass, got ${depth}`);

  const thinPolarity = assessDeepEvidenceUnitDepth({
    path: "dimensions[2]",
    evidence: "忌神火土成势。通关未立。",
    chart_anchors: [],
    calc_cite: "忌神火成势；通关未立",
    unit_claim: "忌火土成势压局，通关未立、生克关口阻滞在忌旺一侧",
  });
  assert.ok(
    thinPolarity &&
      (thinPolarity.includes("too_short") || thinPolarity.includes("shallow")),
    `thin polarity2 must fail, got ${thinPolarity}`,
  );
}

console.log("test-deep-evidence-qimen-relation: ok");
