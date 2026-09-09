/**
 * thesis_gap coverage smoke
 * Run: pnpm exec tsx scripts/test-thesis-gap-coverage.ts
 */
import assert from "node:assert/strict";
import { buildChartThesisFromStructured } from "@/lib/llm/pro/delivery/thesis";
import { validateAssignmentThesisCoverage } from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const structured: ProfileStructured = {
  day_master: "丁",
  pattern: "建禄",
  yong_shen: "水",
  xi_shen: ["金"],
  ji_shen: ["火"],
  strength: "strong",
  four_pillars: { year: "甲子", month: "丙午", day: "丁未", hour: "庚戌" },
  pillars_detail: {
    year: { ten_god: "偏印" },
    month: { ten_god: "劫财" },
    day: { ten_god: "日主" },
    hour: { ten_god: "偏财" },
  } as ProfileStructured["pillars_detail"],
  da_yun: [{ ganzhi: "戊申", start_age: 1, start_year: 1990 }],
  data_availability: {
    pillars_detail: true,
    da_yun: true,
    bazi_enrichment: false,
  },
};

const thesis = buildChartThesisFromStructured(structured, null);

assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              dimension_id: "resource_pattern",
            },
          ],
        },
      ],
    },
    thesis,
  ),
  null,
);

assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [
            {
              dimension_id: "not_a_real_dim",
            },
          ],
        },
      ],
    },
    thesis,
  ),
  "thesis_gap:dimension_id_invalid:not_a_real_dim",
);

// Strip one dimension to simulate gap
const thin = {
  ...thesis,
  dimensions: thesis.dimensions.filter((d) => d.dimension_id !== "cycle_rhythm"),
};
assert.equal(
  validateAssignmentThesisCoverage(
    {
      units: [
        {
          necessary_signals: [{ dimension_id: "cycle_rhythm" }],
        },
      ],
    },
    thin,
  ),
  "thesis_gap:cycle_rhythm",
);

console.log("test-thesis-gap-coverage: ok");
