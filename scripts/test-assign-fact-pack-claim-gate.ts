/**
 * P3–P6 fact-pack assign claim gates — another chart than the lab partnership case.
 *   pnpm exec tsx scripts/test-assign-fact-pack-claim-gate.ts
 */
import assert from "node:assert/strict";
import {
  assessFactPackAssignClaims,
  citeNotInFactPack,
  factPackAssignClaimRetryHint,
  isAssignStructureClaimWeak,
  pickPackLineForClaim,
  softRepairFactPackAssignCites,
  softStripMeansLayerFromClaim,
} from "../lib/llm/pro/delivery/page-schema/assign-fact-pack-claim-gate";

const pack = [
  "日主：甲（身强）",
  "用神：金",
  "喜神：土",
  "忌神：木、火",
  "年柱 壬子 天干壬 地支子 十神偏财",
  "月柱 甲寅 天干甲 地支寅 十神比肩",
  "日柱 甲辰 天干甲 地支辰 十神日主自身",
  "时柱 庚午 天干庚 地支午 十神七杀",
  "本盘合冲刑害：寅午半合火局",
].join("\n");

assert.equal(
  isAssignStructureClaimWeak(
    "大运壬寅水透干但寅木生火，流年丙午火旺加剧忌神，当前宜以兼职试水，等待水旺时机再加重筹码。",
  ),
  true,
);
assert.equal(
  isAssignStructureClaimWeak(
    "大运壬寅壬水用神透干，寅木生火助忌，流年丙午火旺，用神水受制。",
  ),
  false,
);

assert.equal(
  isAssignStructureClaimWeak(
    "己土日主，时柱辛未食神透干，日支丑与月支午相害、与时支未相冲，配偶宫多重冲害，合伙关系结构性摩擦，话语权天然受限。",
  ),
  true,
);
assert.equal(
  softStripMeansLayerFromClaim(
    "己土日主，时柱辛未食神透干，日支丑与月支午相害、与时支未相冲，配偶宫多重冲害，合伙关系结构性摩擦，话语权天然受限。",
  ),
  "己土日主，时柱辛未食神透干，日支丑与月支午相害、与时支未相冲，配偶宫多重冲害",
);
assert.equal(
  softStripMeansLayerFromClaim(
    "己土身强，用神水弱，忌神火土过旺，当前运岁火土忌神加重，全职投入加剧耗损，兼职试水符合用神水之灵活，守住能量底线。",
  ).includes("兼职试水"),
  false,
);
assert.equal(
  softStripMeansLayerFromClaim(
    "己土日主，日支丑土配偶宫与午相害、与未相冲刑，用神水弱，合伙中话语权天然受限。",
  ),
  "己土日主，日支丑土配偶宫与午相害、与未相冲刑，用神水弱",
);
assert.equal(
  isAssignStructureClaimWeak("己土日主，时柱辛未食神透干为"),
  true,
);

assert.equal(
  isAssignStructureClaimWeak(
    "日主己土身强，用神水弱，丑中癸水藏而不透，食神辛金可生水但需金旺，求财需借技术转化，不可急进。",
  ),
  true,
);
assert.equal(
  isAssignStructureClaimWeak(
    "日主己土身强，用神水弱，丑中癸水藏而不透，食神辛金可生水但需金旺为条件。",
  ),
  false,
);
assert.equal(
  isAssignStructureClaimWeak(
    '本维须证明：以“阶段性试水”为框架提出兼职合作，明确试用期、转全职条件及股权兑现节点。',
  ),
  true,
);
assert.equal(
  isAssignStructureClaimWeak(
    "本维须证明：借助第三方（如律师）或书面协议明确股权与决策权，避免口头画饼。",
  ),
  true,
);
assert.equal(
  citeNotInFactPack("符合大运守势，用神水主智，以柔性谈判代替对抗", pack),
  true,
);
assert.equal(citeNotInFactPack("月柱 甲寅 天干甲 地支寅 十神比肩", pack), false);
assert.equal(citeNotInFactPack("用神：金", pack), false);
assert.equal(
  citeNotInFactPack("年柱壬子偏财，用神金，时柱庚午七杀", pack),
  true,
);
assert.equal(
  isAssignStructureClaimWeak(
    "日主己土，需借太极贵人之洞察与将星之魄力，化杀为权。",
  ),
  true,
);

const bad = assessFactPackAssignClaims(
  [
    {
      path: "primary_toolkit.angles[0]",
      unit_claim:
        "本维须证明：在技术交付中逐步建立不可替代性，以此作为话语权筹码。",
      calc_cite: "食神为补给，技术是核心价值",
    },
  ],
  { chart_fact_pack: pack },
);
assert.ok(bad?.startsWith("assign:claim_not_structure:"));

const good = assessFactPackAssignClaims(
  [
    {
      path: "primary_toolkit.angles[0]",
      unit_claim: "时柱庚午七杀透干，克身而合用神金",
      calc_cite: "时柱 庚午 天干庚 地支午 十神七杀",
    },
    {
      path: "primary_toolkit.angles[1]",
      unit_claim: "寅午半合火局，火为忌神助身强之势",
      calc_cite: "本盘合冲刑害：寅午半合火局",
    },
  ],
  { chart_fact_pack: pack },
);
assert.equal(good, null);

const paste = assessFactPackAssignClaims(
  [
    {
      path: "backup_toolkit.angles[0]",
      unit_claim: "日主甲木身强，月令甲寅助身",
      calc_cite: "月柱 甲寅",
    },
  ],
  {
    chart_fact_pack: pack,
    situation_material: "日主甲木身强，月令甲寅助身，先兼职试水再谈股权",
  },
);
assert.ok(paste?.startsWith("assign:claim_situation_paste:"));
assert.ok(
  factPackAssignClaimRetryHint(paste!).includes("处境材料"),
  "situation_paste retry must name situation ban",
);
assert.ok(
  factPackAssignClaimRetryHint("assign:cite_equals_claim:x").includes("必须不同"),
);

const pasteClaim =
  "日主甲木身强，时柱庚午七杀透干，寅午半合火局，用神金通关护杀。";
const soft = softRepairFactPackAssignCites(
  [
    {
      path: "primary_toolkit.angles[0]",
      unit_claim: pasteClaim,
      calc_cite: pasteClaim,
    },
  ],
  { chart_fact_pack: pack },
);
assert.equal(soft.repaired, true);
assert.notEqual(soft.units[0]!.calc_cite, pasteClaim);
assert.equal(citeNotInFactPack(soft.units[0]!.calc_cite, pack), false);
assert.equal(
  assessFactPackAssignClaims(soft.units, { chart_fact_pack: pack }),
  null,
);
assert.ok(pickPackLineForClaim(pasteClaim, pack));

assert.equal(
  isAssignStructureClaimWeak(
    "日主己土身强，时柱辛未食神透干为喜神金，食神主",
  ),
  true,
  "十神主 abort",
);
assert.equal(
  isAssignStructureClaimWeak(
    "日主己土身强，用神水弱，大运壬寅水透干，此时不宜全职加码，须待水旺之运岁窗口。",
  ),
  true,
  "全职加码 / 须待窗口 means tail",
);
assert.ok(
  !softStripMeansLayerFromClaim(
    "日主己土身强，用神水弱，大运壬寅水透干，此时不宜全职加码，须待水旺之运岁窗口。",
  ).includes("全职加码"),
);

console.log("test-assign-fact-pack-claim-gate: ok");
