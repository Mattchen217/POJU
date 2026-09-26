/**
 * P4 write · stale cache vs assignment + polarity moat lock.
 * Run: pnpm exec tsx scripts/test-p4-write-moat-lock.ts
 */

import assert from "node:assert/strict";
import { writeUnitsStaleVsAssignment } from "../lib/llm/pro/delivery/lab/run-step";
import {
  assessDeepEvidenceQuality,
  unitMentionsMoatClass,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import type { DeepEvidencePlan } from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import type { DeepEvidenceAssignmentUnit } from "../lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import type { DeepEvidenceUnit } from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";

const assignment: DeepEvidenceAssignmentUnit[] = [
  {
    path: "dimensions[0]",
    chart_anchors: [],
    moat_class: "polarity",
    calc_cite: "用神为水,忌神为火土",
    means_candidate_ref: "极性候选1",
    unit_claim: "日主己土身强，用神水弱而忌神火土成势，用忌力量对比失衡",
    necessary_signals: [],
    removal_test: { passed: true, notes: "" },
    signal_count_rationale: "",
  },
  {
    path: "dimensions[1]",
    chart_anchors: [],
    moat_class: "timing",
    calc_cite: "客克主",
    means_candidate_ref: "时机候选1",
    unit_claim: "客克主，主方受制",
    necessary_signals: [],
    removal_test: { passed: true, notes: "" },
    signal_count_rationale: "",
  },
];

const stalePrior: DeepEvidenceUnit[] = [
  {
    path: "dimensions[0]",
    chart_anchors: [],
    evidence:
      "时干己土克值符遁干壬水。己土为忌神土。壬水为用神水。忌神克用神。主方行动受制。",
    moat_class: "timing",
    unit_claim: "客克主，主方受制",
    calc_cite: "客克主",
  },
  {
    path: "dimensions[1]",
    chart_anchors: [],
    evidence:
      "当前大运壬寅。天干壬水用神透出。流年丙午加重火土忌神。用神未透足。运岁窗口未熟。",
    moat_class: "timing",
    unit_claim: "运岁窗口未熟",
    calc_cite: "大运壬寅",
  },
];

assert.ok(
  writeUnitsStaleVsAssignment(stalePrior, assignment)?.startsWith("moat:"),
  "moat drift must mark stale",
);

const goodPrior: DeepEvidenceUnit[] = [
  {
    path: "dimensions[0]",
    chart_anchors: [],
    evidence:
      "日主己土身强。用神水弱。忌神火土成势。用忌力量对比失衡。火土克制用神水。身强更需水泄。",
    moat_class: "polarity",
    unit_claim: assignment[0]!.unit_claim,
    calc_cite: assignment[0]!.calc_cite,
  },
  {
    path: "dimensions[1]",
    chart_anchors: [],
    evidence:
      "时干己土克值符遁干壬水。己土为忌神土。壬水为用神水。客克主。主方受制。奇门局势上主方行动受制。",
    moat_class: "timing",
    unit_claim: assignment[1]!.unit_claim,
    calc_cite: assignment[1]!.calc_cite,
  },
];
assert.equal(writeUnitsStaleVsAssignment(goodPrior, assignment), null);

// timing unitMentionsMoatClass needs 大运/流年 or era — enrich for quality pass
goodPrior[1]!.evidence =
  "时干己土克值符遁干壬水。己土为忌神土。壬水为用神水。客克主。主方受制。对照当前流年局势主方受制。";

const missingPolarityPlan: DeepEvidencePlan = {
  page: "metaphysics_action",
  units: [
    {
      path: "dimensions[0]",
      chart_anchors: [],
      evidence:
        "当前大运壬寅。天干壬水用神透出。流年丙午加重火土忌神。大运地支寅与月支午半合火局。用神未透足。运岁窗口未熟。",
      moat_class: "timing",
      unit_claim: "运岁窗口未熟，寅午半合助忌",
      calc_cite: "当前大运：壬寅 当前流年：丙午 寅午半合",
    },
    {
      path: "dimensions[1]",
      chart_anchors: [],
      evidence:
        "时柱辛未食神透干。日主己土。食神独透时干。格局食伤偏显。角色力量偏在食神。",
      moat_class: "archetype",
      unit_claim: "食神透干，角色力量偏在食神",
      calc_cite: "时柱辛未食神",
    },
  ],
};

const qMissing = assessDeepEvidenceQuality("metaphysics_action", missingPolarityPlan, {
  eastern_calc_slice: "【奇门锁盘】值使:開\n【十神语义】食神",
  metaphysics_moat_feed: "用神: 水\n忌神: 火\npack_polarity: yong:水",
});
assert.equal(qMissing.ok, false, String(qMissing));
assert.ok(
  (qMissing.reason ?? "").includes("polarity"),
  qMissing.reason,
);

const okPlan: DeepEvidencePlan = {
  page: "metaphysics_action",
  units: goodPrior,
};
assert.ok(unitMentionsMoatClass(okPlan.units[0]!, "polarity"));
assert.ok(unitMentionsMoatClass(okPlan.units[1]!, "timing"));

const qOk = assessDeepEvidenceQuality("metaphysics_action", okPlan, {
  eastern_calc_slice: "timing_ripeness: 未熟\n【十神语义】食神",
  metaphysics_moat_feed: "用神: 水\n忌神: 火\npack_polarity: yong:水\n【奇门锁盘】值使:開",
});
assert.equal(qOk.ok, true, JSON.stringify(qOk));

const personalityEv =
  "年柱天干丁火为偏印。日主己土受丁火相生。地支卯藏乙木。乙木生丁火。日主身强。丁火偏印为忌神。偏印透干主导命局思维模式。";
const qPers = assessDeepEvidenceQuality(
  "metaphysics_action",
  {
    page: "metaphysics_action",
    units: [
      {
        path: "dimensions[0]",
        chart_anchors: [],
        evidence: personalityEv,
        moat_class: "archetype",
        unit_claim: "年柱丁卯偏印透干",
        calc_cite: "年柱丁卯偏印",
      },
      ...okPlan.units,
    ],
  },
  {
    metaphysics_moat_feed: "用神: 水\n忌神: 火\n【十神语义】偏印食神",
  },
);
assert.equal(qPers.ok, false, "思维模式 must fail");
assert.ok(
  (qPers.reason ?? "").includes("shell") || (qPers.reason ?? "").includes("soft"),
  qPers.reason,
);

console.log("test-p4-write-moat-lock: ok");
