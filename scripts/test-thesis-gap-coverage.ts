/**
 * thesis_gap coverage smoke
 * Run: pnpm exec tsx scripts/test-thesis-gap-coverage.ts
 */
import assert from "node:assert/strict";
import { buildChartThesisFromStructured } from "@/lib/llm/pro/delivery/thesis";
import {
  filterPreferMapToThesis,
  validateAssignmentThesisCoverage,
} from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const structured: ProfileStructured = {
  day_master: "乙",
  pattern: "日主 乙",
  yong_shen: "water",
  xi_shen: ["wood"],
  ji_shen: ["fire", "earth"],
  strength: "weak",
  four_pillars: { year: "丁巳", month: "壬寅", day: "乙巳", hour: "庚辰" },
  pillars_detail: {
    year: {
      ganzhi: "丁巳",
      stem: "丁",
      branch: "巳",
      ten_god: "食神",
      hidden_stems: ["丙", "庚", "戊"],
      shen_sha: ["金舆"],
    },
    month: {
      ganzhi: "壬寅",
      stem: "壬",
      branch: "寅",
      ten_god: "正印",
      hidden_stems: ["甲", "丙", "戊"],
      shen_sha: [],
    },
    day: {
      ganzhi: "乙巳",
      stem: "乙",
      branch: "巳",
      ten_god: "",
      hidden_stems: ["丙", "庚", "戊"],
      shen_sha: [],
    },
    hour: {
      ganzhi: "庚辰",
      stem: "庚",
      branch: "辰",
      ten_god: "正官",
      hidden_stems: ["戊", "乙", "癸"],
      shen_sha: [],
    },
  } as ProfileStructured["pillars_detail"],
  da_yun: [
    { ganzhi: "辛丑", start_age: 5, start_year: 1981 },
    { ganzhi: "丁酉", start_age: 45, start_year: 2021 },
  ],
  data_availability: {
    pillars_detail: true,
    da_yun: true,
    bazi_enrichment: false,
  },
};

const thesis = buildChartThesisFromStructured(structured, "要不要全职创业", {
  as_of: new Date("2026-09-10T12:00:00.000Z"),
  question_category: "career",
});

// Missing dimension_id → required when thesis present
assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              slug: "金舆",
              role: "x",
              why_needed: "去掉此信号无法解释话语权",
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
              inference_zh: "身弱放大不安",
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
              dimension_id: "interpersonal_pattern",
              inference_zh: "被动跟随",
            },
          ],
        },
      ],
    },
    thesis,
  ),
  "thesis_gap:slug_not_in_thesis:金舆",
);

// 巳寅相刑 lives on day_master_strength, not cycle_rhythm
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

// Prefer filter drops 金舆, keeps 食神
const filtered = filterPreferMapToThesis(
  { "why_cards[0]": "食神", "why_cards[1]": "金舆" },
  thesis,
);
assert.equal(filtered?.["why_cards[0]"], "食神");
assert.equal(filtered?.["why_cards[1]"], undefined);

console.log("test-thesis-gap-coverage: ok");
