/**
 * thesis_gap coverage smoke
 */
import assert from "node:assert/strict";
import type { ChartThesis } from "../lib/llm/pro/delivery/thesis/types";
import { THESIS_DIMENSION_NAME_ZH } from "../lib/llm/pro/delivery/thesis/types";
import {
  filterPreferMapToThesis,
  softStripUngroundedThesisSignals,
  softRepairThirdPartyAttributionProse,
  softRepairAssignmentThirdPartySignals,
  validateAssignmentThesisCoverage,
  detectThirdPartyNatalAttribution,
} from "../lib/llm/pro/delivery/thesis/validate-assignment-coverage";

const thesis: ChartThesis = {
  version: 1,
  structured_fingerprint: "test-fixture",
  generated_at: "2026-09-10T00:00:00.000Z",
  judgment_core_frozen: true,
  as_of_day: "2026-09-10",
  question_category: "career",
  dimensions: [
    {
      dimension_id: "day_master_strength",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.day_master_strength,
      depth: "full",
      strength_verdict: "身弱",
      classical_basis: [
        {
          key: "day_master",
          present: true,
          summary_zh: "日主乙木身弱；巳寅相刑加重内耗",
        },
      ],
      usable_claims_hint: ["身弱放大对安全垫的敏感"],
      wuxing_relations: [],
      conclusion_zh: "身弱",
    },
    {
      dimension_id: "interpersonal_pattern",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.interpersonal_pattern,
      depth: "full",
      classical_basis: [
        {
          key: "ten_gods",
          present: true,
          summary_zh: "时柱正官；食神泄秀",
        },
      ],
      usable_claims_hint: ["正官执行惯性"],
      wuxing_relations: [],
      conclusion_zh: "正官",
    },
    {
      dimension_id: "cycle_rhythm",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.cycle_rhythm,
      depth: "full",
      classical_basis: [
        {
          key: "current_da_yun",
          present: true,
          summary_zh: "当前大运丁酉；流年丙午",
        },
      ],
      usable_claims_hint: ["丁酉大运"],
      wuxing_relations: [],
      conclusion_zh: "丁酉",
    },
    {
      dimension_id: "favor_avoid_tuning",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.favor_avoid_tuning,
      depth: "brief",
      classical_basis: [
        {
          key: "yong_shen",
          present: true,
          summary_zh: "用神：水",
        },
      ],
      usable_claims_hint: ["用神水"],
      wuxing_relations: [],
      conclusion_zh: "用神水",
    },
    {
      dimension_id: "resource_pattern",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.resource_pattern,
      depth: "brief",
      classical_basis: [
        {
          key: "wealth_gods",
          present: true,
          summary_zh: "财星藏而不显：日支辰中戊（正财）",
        },
      ],
      usable_claims_hint: ["ten_god_hidden:正财"],
      wuxing_relations: [],
      conclusion_zh: "正财",
    },
    {
      dimension_id: "expression_creativity",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.expression_creativity,
      depth: "full",
      classical_basis: [
        {
          key: "output_gods",
          present: true,
          summary_zh: "食神：时柱食神；日支藏丁（食神）",
        },
      ],
      usable_claims_hint: ["ten_god:食神", "ten_god_hidden:食神:丁"],
      wuxing_relations: [],
      conclusion_zh: "食神",
    },
  ],
};

// Missing dimension_id
assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "金舆",
              inference_zh: "财富象征",
            },
          ],
        },
      ],
    },
    thesis,
  ),
  "thesis_gap:dimension_id_required:金舆",
);

assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "身弱",
              dimension_id: "not_a_real_dim",
              inference_zh: "x",
            },
          ],
        },
      ],
    },
    thesis,
  ),
  "thesis_gap:dimension_id_invalid:not_a_real_dim",
);

// 金舆 not in thesis six dims
assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "金舆",
              dimension_id: "day_master_strength",
              inference_zh: "马车象征",
            },
          ],
        },
      ],
    },
    thesis,
  ),
  "thesis_gap:slug_not_in_thesis:金舆",
);

assert.match(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "巳寅相刑",
              dimension_id: "cycle_rhythm",
              inference_zh: "内耗",
            },
          ],
        },
      ],
    },
    thesis,
  ) ?? "",
  /slug_wrong_dim:巳寅相刑/,
);

// Grounded OK
assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "身弱",
              dimension_id: "day_master_strength",
              inference_zh: "身弱放大对安全垫的敏感",
            },
            {
              slug: "正官",
              dimension_id: "interpersonal_pattern",
              inference_zh: "时柱正官塑造执行惯性",
            },
          ],
        },
      ],
    },
    thesis,
  ),
  null,
);

// Hard gate: third-party attribution from natal
assert.match(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "正官",
              dimension_id: "interpersonal_pattern",
              inference_zh: "正官让对方明确不愿在体制外冒险",
            },
          ],
        },
      ],
    },
    thesis,
  ) ?? "",
  /third_party_attr:正官:对方/,
);

// 「伙伴期望」also third-party
assert.match(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "正官",
              dimension_id: "interpersonal_pattern",
              inference_zh: "正官在时柱，伙伴期望盘主以全职身份承担正式责任",
            },
          ],
        },
      ],
    },
    thesis,
  ) ?? "",
  /third_party_attr:正官:伙伴期望/,
);

// Soft-repair: 伙伴自然期望 → querent-side; gate clears
{
  const dirty =
    "正官在时柱长期承压，伙伴自然期望全职投入，兼职难以开口。";
  assert.ok(detectThirdPartyNatalAttribution(dirty)?.includes("伙伴"));
  const cleaned = softRepairThirdPartyAttributionProse(dirty);
  assert.equal(detectThirdPartyNatalAttribution(cleaned), null);
  assert.ok(cleaned.includes("你"));

  const repaired = softRepairAssignmentThirdPartySignals({
    units: [
      {
        path: "why_cards[3]",
        necessary_signals: [
          {
            slug: "正官",
            dimension_id: "interpersonal_pattern",
            inference_zh: dirty,
            role: "解释正官如何催生伙伴对全职绑定的期望",
            why_needed: "去掉此信号，则无法说明为何伙伴不接受兼职",
          },
        ],
      },
    ],
  });
  assert.equal(repaired.repaired, true);
  assert.equal(
    validateAssignmentThesisCoverage(repaired.assignment, thesis),
    null,
  );
}

// 十二长生 parked
assert.match(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "衰",
              dimension_id: "day_master_strength",
              inference_zh: "日主处衰，承接位偏弱",
            },
          ],
        },
      ],
    },
    thesis,
  ) ?? "",
  /slug_changsheng_parked:衰/,
);

// 藏干 hollow / not load-bearing (fixture may lack 藏干 → not_in_thesis; real thesis often has it → too_generic)
assert.match(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "藏干",
              dimension_id: "resource_pattern",
              inference_zh: "资源多以藏干形式存在",
            },
          ],
        },
      ],
    },
    {
      ...thesis,
      dimensions: thesis.dimensions.map((d) =>
        d.dimension_id === "resource_pattern"
          ? {
              ...d,
              classical_basis: [
                ...(Array.isArray(d.classical_basis) ? d.classical_basis : []),
                {
                  key: "canggan",
                  present: true,
                  summary_zh: "财星藏干：正财藏而不显",
                },
              ],
            }
          : d,
      ),
    },
  ) ?? "",
  /slug_too_generic:藏干/,
);

// Bare stem 丁 → must become 食神 when prose names it
{
  const stripped = softStripUngroundedThesisSignals(
    {
      units: [
        {
          path: "why_cards[1]",
          chart_anchors: ["丁"],
          necessary_signals: [
            {
              slug: "丁",
              dimension_id: "expression_creativity",
              inference_zh: "食神丁火藏于日支，倾诉缓解焦虑",
              role: "表达",
              why_needed: "去掉则无法解释倾诉",
            },
          ],
        },
      ],
    },
    thesis,
  );
  assert.equal(stripped.assignment.units[0]!.necessary_signals![0]!.slug, "食神");
}

// Alternate chart tokens still refine (not 丁酉-only patch)
assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "大运",
              dimension_id: "cycle_rhythm",
              inference_zh: "当前大运甲子水旺，宜稳",
            },
          ],
        },
      ],
    },
    {
      ...thesis,
      dimensions: thesis.dimensions.map((d) =>
        d.dimension_id === "cycle_rhythm"
          ? {
              ...d,
              classical_basis: [
                {
                  key: "current_da_yun",
                  present: true,
                  summary_zh: "当前大运：甲子；流年乙巳",
                },
              ],
              usable_claims_hint: ["甲子大运"],
              conclusion_zh: "甲子",
            }
          : d,
      ),
    },
  ),
  null,
);

// Scene mention of 旧部 (user's situation) is NOT third-party attribution
assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "正财",
              dimension_id: "resource_pattern",
              inference_zh: "正财藏而不显，资源主动权偏弱",
              role: "解释为何在创业邀约中只能加入旧部的盘子",
              why_needed: "去掉则无法解释被动加入的资源结构",
            },
          ],
        },
      ],
    },
    thesis,
  ),
  null,
);

// Hollow「大运」without concrete ganzhi in prose → fail
assert.match(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "大运",
              dimension_id: "cycle_rhythm",
              inference_zh: "大运耗精力导致时间紧",
            },
          ],
        },
      ],
    },
    thesis,
  ) ?? "",
  /slug_too_generic:大运/,
);

// Hollow「大运」+ inference names 丁酉 → ok
assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "大运",
              dimension_id: "cycle_rhythm",
              inference_zh: "当前大运丁酉食神泄身，精力被主业占满",
            },
          ],
        },
      ],
    },
    thesis,
  ),
  null,
);

// Soft-strip: 大运→丁酉；用神→水；reuse cap peels 3rd 身弱
{
  const stripped = softStripUngroundedThesisSignals(
    {
      units: [
        {
          path: "why_cards[0]",
          chart_anchors: ["食神", "身弱"],
          necessary_signals: [
            {
              slug: "食神",
              dimension_id: "expression_creativity",
              inference_zh: "食神泄身",
              role: "a",
              why_needed: "去掉则无法解释产出消耗",
            },
            {
              slug: "身弱",
              dimension_id: "day_master_strength",
              inference_zh: "身弱承压低",
              role: "b",
              why_needed: "去掉则无法解释敏感",
            },
          ],
        },
        {
          path: "why_cards[1]",
          chart_anchors: ["正官", "身弱"],
          necessary_signals: [
            {
              slug: "正官",
              dimension_id: "interpersonal_pattern",
              inference_zh: "时柱正官易配合",
              role: "c",
              why_needed: "去掉则无法解释跟随",
            },
            {
              slug: "身弱",
              dimension_id: "day_master_strength",
              inference_zh: "身弱难强势",
              role: "d",
              why_needed: "去掉则无法解释底气",
            },
          ],
        },
        {
          path: "why_cards[2]",
          chart_anchors: ["大运", "身弱"],
          necessary_signals: [
            {
              slug: "大运",
              dimension_id: "cycle_rhythm",
              inference_zh: "当前大运丁酉泄身",
              role: "e",
              why_needed: "去掉则无法解释时间紧",
            },
            {
              slug: "身弱",
              dimension_id: "day_master_strength",
              inference_zh: "身弱精力薄",
              role: "f",
              why_needed: "去掉则无法解释耗尽",
            },
          ],
        },
        {
          path: "why_cards[4]",
          chart_anchors: ["用神"],
          necessary_signals: [
            {
              slug: "用神",
              dimension_id: "favor_avoid_tuning",
              inference_zh: "用神为水须守底线",
              role: "g",
              why_needed: "去掉则无法解释安全底",
            },
          ],
        },
      ],
    },
    thesis,
  );
  assert.ok(stripped.stripped_slugs.some((s) => s.includes("reuse")));
  assert.equal(
    stripped.assignment.units[2]!.necessary_signals!.map((s) => s.slug).join(","),
    "丁酉",
  );
  assert.equal(stripped.assignment.units[3]!.necessary_signals![0]!.slug, "水");
  assert.equal(
    validateAssignmentThesisCoverage(stripped.assignment, thesis),
    null,
  );
}

// Soft-strip canonicalizes compound slug to thesis token
{
  const stripped = softStripUngroundedThesisSignals(
    {
      units: [
        {
          path: "why_cards[2]",
          chart_anchors: ["大运丁酉"],
          necessary_signals: [
            {
              slug: "大运丁酉",
              dimension_id: "cycle_rhythm",
              inference_zh: "当前运耗精力",
              role: "承重",
              why_needed: "去掉则无法解释阶段紧张",
            },
          ],
        },
      ],
    },
    thesis,
  );
  assert.deepEqual(stripped.stripped_slugs, []);
  assert.equal(stripped.assignment.units[0]!.necessary_signals![0]!.slug, "丁酉");
}

// Hard gate: historical dayun not in cycle_rhythm thesis
assert.match(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "丁酉",
              dimension_id: "cycle_rhythm",
              inference_zh: "童年辛丑大运已埋下路径依赖",
            },
          ],
        },
      ],
    },
    thesis,
  ) ?? "",
  /cycle_ganzhi_not_in_thesis:丁酉:辛丑/,
);

// Soft-strip drops 金舆, keeps 身弱 → coverage clears
{
  const draft = {
    units: [
      {
        path: "why_cards[0]",
        chart_anchors: ["身弱", "金舆"],
        necessary_signals: [
          {
            slug: "身弱",
            dimension_id: "day_master_strength",
            inference_zh: "身弱放大对安全垫的敏感",
            role: "承重",
            why_needed: "去掉则无法解释安全焦虑",
          },
          {
            slug: "金舆",
            dimension_id: "day_master_strength",
            inference_zh: "财富象征",
            role: "辅",
            why_needed: "去掉则少一层",
          },
        ],
      },
    ],
  };
  const stripped = softStripUngroundedThesisSignals(draft, thesis);
  assert.deepEqual(stripped.stripped_slugs, ["金舆"]);
  assert.deepEqual(stripped.emptied_paths, []);
  assert.equal(
    validateAssignmentThesisCoverage(stripped.assignment, thesis),
    null,
  );
  assert.deepEqual(stripped.assignment.units[0]!.chart_anchors, ["身弱"]);
}

// Prefer filter: 食神 in interpersonal classical, 金舆 not in thesis
const filtered = filterPreferMapToThesis(
  { "why_cards[0]": "食神", "why_cards[1]": "金舆" },
  thesis,
);
assert.equal(filtered?.["why_cards[0]"], "食神");
assert.equal(filtered?.["why_cards[1]"], undefined);

console.log("test-thesis-gap-coverage: ok");
