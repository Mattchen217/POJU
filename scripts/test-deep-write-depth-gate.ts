/**
 * Write depth gate SSOT (same as merge shallow) + prompt contract smoke.
 * Run: pnpm exec tsx scripts/test-deep-write-depth-gate.ts
 */
import assert from "node:assert/strict";
import {
  assessDeepEvidenceUnitDepth,
  countDeepEvidenceClauses,
  assessDeepEvidenceQuality,
  citeEchoedInEvidence,
  stripSoftPaddingEvidence,
} from "@/lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import { buildDeepEvidenceWriteChunkPrompt } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-write";
import type { DeepEvidenceAssignmentUnit } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";

const shallow =
  "就本案表象在你侧的压力而言：⟦w:比肩⟧藏于月时支而不透，同辈助力微弱，导致我面对每月2-3万硬支出时，只能独自硬扛，无法分摊风险，因此对创业初期低薪极度敏感。";
assert.equal(countDeepEvidenceClauses(shallow), 1);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[1]",
    evidence: shallow,
    chart_anchors: ["比肩"],
  }),
  "deep_evidence_shallow:why_cards[1]",
);

const withSemicolon =
  "⟦w:比肩⟧藏于月时支而不透，同辈助力微弱；面对每月硬支出只能独自硬扛，因此对创业初期低薪极度敏感。";
assert.ok(countDeepEvidenceClauses(withSemicolon) >= 2);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[1]",
    evidence: withSemicolon,
    chart_anchors: ["比肩"],
  }),
  null,
);

const twoPeriods =
  "⟦w:正财⟧深藏地支，稳定收入需求内化。正因为牵制，你仍能腾出时间深度思考。";
assert.ok(countDeepEvidenceClauses(twoPeriods) >= 2);

const hollowLiuhe =
  "就本案表象在你侧的压力而言：⟦w:六合⟧你在结构上更易感到绑定与投入压力。";
assert.equal(countDeepEvidenceClauses(hollowLiuhe), 1);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[3]",
    evidence: hollowLiuhe,
    chart_anchors: ["六合"],
  }),
  "deep_evidence_shallow:why_cards[3]",
);

const planFail = assessDeepEvidenceQuality("foundation", {
  page: "foundation",
  units: [
    {
      path: "why_cards[1]",
      chart_anchors: ["比肩"],
      evidence: shallow,
      mechanism_tag: "surface_why",
    },
  ],
});
assert.equal(planFail.ok, false);
if (!planFail.ok) {
  assert.equal(planFail.reason, "deep_evidence_shallow:why_cards[1]");
}

const chunk: DeepEvidenceAssignmentUnit[] = [
  {
    path: "why_cards[0]",
    chart_anchors: ["比肩"],
    calc_cite: "财务底线",
    means_candidate_ref: "表象候选2",
    unit_claim: "比劫藏而不显导致独扛硬支出",
    necessary_signals: [
      {
        slug: "比肩",
        dimension_id: "interpersonal_pattern",
        inference_zh: "软腔一句",
        role: "独扛",
        why_needed: "解释硬支出焦虑",
      },
    ],
  },
];
const { system } = buildDeepEvidenceWriteChunkPrompt(
  "foundation",
  {
    locale: "zh",
    core_conclusion: "测",
  },
  chunk,
);
assert.match(system, /deep_evidence_shallow|句读深度/);
assert.match(system, /禁止逗号串成一句/);
assert.match(system, /unit_claim/);
assert.match(system, /配合位|绑定与投入压力|就你侧/);

const plain =
  "日主己土身强，生于月令丙午。用神水为财，喜金。时柱辛未食神透干，坐未冲丑。";
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[0]",
    evidence: plain,
    chart_anchors: [],
  }),
  null,
);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[0]",
    evidence:
      "⟦w:日主己土⟧身强，生于月令丙午。用神水为财，喜金。时柱食神透干，却被旺火所制。",
    chart_anchors: [],
  }),
  "deep_evidence_marked:why_cards[0]",
);

// Soft frame — partnership wording (still a category hit).
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[2]",
    evidence:
      "全职门槛已立时，结构上你更易落入配合与让步位。日主己土身强，月柱丙午正印忌神高透。印星过旺而时柱辛金食神受制。",
    chart_anchors: [],
  }),
  "deep_evidence_shell:why_cards[2]",
);

// Soft padding — career topic, different person, same category (no shell words).
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[0]",
    evidence:
      "日主甲木身弱，月令酉金七杀当权。用神火为食伤泄秀。你对跳槽窗口特别犹豫，迟迟不敢开口。",
    chart_anchors: [],
  }),
  "deep_evidence_soft_padding:why_cards[0]",
);

// Soft padding — health topic, no partnership words.
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[1]",
    evidence:
      "日主庚金身强，月柱丙午正印过旺。印旺泄身不及，调候用神在水。你对恢复节奏极为敏感，稍一拉长就焦虑。",
    chart_anchors: [],
  }),
  "deep_evidence_soft_padding:why_cards[1]",
);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[0]",
    evidence: stripSoftPaddingEvidence(
      "日主甲木身弱，月令酉金七杀当权，身弱受克。用神火为食伤泄秀，时干丙火透出。年柱丙寅食神透干。因此把眼前的安排改掉。",
      "用神：火\n喜神：木\n忌神：金、土",
    ),
    chart_anchors: [],
  }),
  null,
);
assert.equal(
  stripSoftPaddingEvidence(
    "年干辛金食神为喜。月支乙木七杀为忌。",
    "用神：水\n喜神：金\n忌神：火、土",
  ).includes("为忌"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence(
    "丑中癸水偏财为用神。被未中丁火偏印冲克。时干辛金食神透出更宜另起一种做法。",
    "用神：水\n喜神：金\n忌神：火、土",
  ).includes("冲克"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence(
    "当前大运戊辰正官受制。月支与日支，午子相冲。",
    "用神：水",
  ).includes("正官"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence(
    "日主甲木身弱。月令酉金七杀当权。用神火受克。",
    "用神：火\n喜神：木\n忌神：金、土",
  ).includes("受克"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence(
    "酉金七杀克制日主甲木。月令酉金当权。",
    "用神：火",
  ).includes("克制"),
  true,
);
assert.equal(
  stripSoftPaddingEvidence("日主甲木身弱。伤官主口舌是非。时干乙木劫财透出。").includes(
    "口舌",
  ),
  false,
);
assert.equal(
  stripSoftPaddingEvidence("月令酉金七杀当权。日主甲木听命于人。").includes("于人"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence(
    "月干庚金七杀克制日主甲木亦主以巧脱身。日主甲木身弱。",
  ).includes("脱身"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence("月支午与日支子相冲。此乃相冲之象。日主甲木身弱。").includes(
    "此乃",
  ),
  false,
);
const offClaim = stripSoftPaddingEvidence(
  "月支午与日支子相冲。年支寅与时支亥六合。日主甲木身弱。",
  "",
  "月支与日支，午子相冲",
);
assert.equal(offClaim.includes("六合"), false);
assert.equal(offClaim.includes("相冲"), true);
assert.equal(
  stripSoftPaddingEvidence(
    "日主甲木身弱。年干壬水与月干庚金为用。",
    "用神：水\n喜神：木\n忌神：金、土",
  ).includes("为用"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence("日主甲木身弱。月干戊土生年干庚金。").includes("土生"),
  true,
);
assert.equal(
  stripSoftPaddingEvidence("日主甲木身弱。月干丁火生年干甲木。").includes("火生"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence("月干庚金七杀透出。七杀为木火所生。日主甲木身弱。").includes(
    "所生",
  ),
  false,
);
assert.equal(
  stripSoftPaddingEvidence("日支子水被月支午火烘烤。日主甲木身弱。").includes("烘烤"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence("时干庚金被月支午火克制。日主甲木身弱。").includes("克制"),
  true,
);
assert.equal(
  stripSoftPaddingEvidence("日主甲木身强本不畏克。月令酉金七杀当权。").includes("不畏"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence(
    "日支丑与时支未相冲。流年丙午。午未合火生土。日主己土身强。",
    "日主：己\n用神：水",
    "日支与时支，丑未相冲",
  ).includes("午未"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence(
    "月支午火与日支丑土相害。得月令午火正印生扶。丑中癸水为用神。",
    "日主：己\n用神：水",
    "月支与日支，午丑相害",
  ).includes("正印"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence(
    "月柱丙午正印当令。日主己土身强。",
    "日主：己\n用神：水",
  ).includes("正印"),
  true,
);
assert.equal(
  stripSoftPaddingEvidence(
    "月令酉金七杀当权。日主甲木身弱。",
    "日主：甲\n用神：火",
  ).includes("七杀"),
  false,
);
assert.equal(
  stripSoftPaddingEvidence(
    "月令酉金正官当权。日主甲木身弱。",
    "日主：甲\n用神：火",
  ).includes("正官"),
  true,
);
assert.equal(
  stripSoftPaddingEvidence(
    "大运天干壬水为用神。可润局调候。甲木正官克制日主己土。",
    "日主：己\n用神：水",
  ).includes("润局"),
  false,
);

// Cite paste — any interview answer echoed into evidence.
const cite =
  "法律或顾问资源: 有信得过的律师或前辈，能帮我看合同、出主意";
assert.ok(
  citeEchoedInEvidence(
    "月柱正印当令。故有信得过的律师或前辈能帮看合同、出主意。",
    cite,
  ),
);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[1]",
    evidence:
      "月柱丙午正印当令，印主文书契约。时柱食神透出。月柱正印，故有信得过的律师或前辈能帮看合同、出主意。",
    chart_anchors: [],
    calc_cite: cite,
  }),
  "deep_evidence_cite_paste:why_cards[1]",
);

const { system: factSystem } = buildDeepEvidenceWriteChunkPrompt(
  "foundation",
  {
    locale: "zh",
    core_conclusion: "测",
    chart_fact_pack: "日主：己（身强）\n用神：水",
  },
  [
    {
      path: "why_cards[0]",
      chart_anchors: [],
      calc_cite: "技术不是壁垒",
      means_candidate_ref: "表象候选1",
      unit_claim: "技术并非唯一壁垒",
    },
  ],
);
assert.match(factSystem, /禁止任何标记/);
assert.match(factSystem, /命理句读/);
assert.doesNotMatch(factSystem, /真词用/);

console.log("ok deep-write-depth-gate");
