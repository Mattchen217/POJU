/**
 * thesis_gap coverage smoke
 */
import assert from "node:assert/strict";
import type { ChartThesis } from "../lib/llm/pro/delivery/thesis/types";
import { THESIS_DIMENSION_NAME_ZH } from "../lib/llm/pro/delivery/thesis/types";
import {
  filterPreferMapToThesis,
  softStripUngroundedThesisSignals,
  validateAssignmentThesisCoverage,
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
      classical_basis: [],
      usable_claims_hint: [],
      wuxing_relations: [],
      conclusion_zh: "",
    },
    {
      dimension_id: "resource_pattern",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.resource_pattern,
      depth: "brief",
      classical_basis: [],
      usable_claims_hint: [],
      wuxing_relations: [],
      conclusion_zh: "",
    },
    {
      dimension_id: "expression_creativity",
      dimension_name_zh: THESIS_DIMENSION_NAME_ZH.expression_creativity,
      depth: "brief",
      classical_basis: [],
      usable_claims_hint: [],
      wuxing_relations: [],
      conclusion_zh: "",
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
