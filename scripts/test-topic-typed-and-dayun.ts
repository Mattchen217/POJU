/**
 * Smoke: topic-typed fields + dayun polarity + inventory lines.
 */
import assert from "node:assert/strict";
import { buildDayunPolarity } from "../lib/calculations/dayun-polarity";
import { buildTopicTypedFields } from "../lib/calculations/topic-typed-fields";
import { buildStructuredInstanceInventory } from "../lib/base-analysis/build-structured-instance-inventory";
import type { ProfileStructured } from "../lib/calculations/build-profile-structured";
import {
  assessUnitAnchorQuality,
  collectPageAnchorUnits,
} from "../lib/llm/pro/delivery/page-schema/anchor-quality";

function makeStructured(): ProfileStructured {
  return {
    day_master: "甲",
    pattern: "正格",
    yong_shen: "水",
    xi_shen: ["金"],
    ji_shen: ["火"],
    strength: "weak",
    four_pillars: { year: "甲子", month: "丙寅", day: "戊午", hour: "癸亥" },
    pillars_detail: {
      year: {
        ganzhi: "甲子",
        stem: "甲",
        branch: "子",
        ten_god: "比肩",
        shen_sha: [],
        life_stage_han: "沐浴",
        hidden_stems: ["癸"],
      },
      month: {
        ganzhi: "丙寅",
        stem: "丙",
        branch: "寅",
        ten_god: "食神",
        shen_sha: [],
        life_stage_han: "长生",
        hidden_stems: ["甲", "丙", "戊"],
      },
      day: {
        ganzhi: "戊午",
        stem: "戊",
        branch: "午",
        ten_god: "正财",
        shen_sha: [],
        life_stage_han: "帝旺",
        hidden_stems: ["丁", "己"],
      },
      hour: {
        ganzhi: "癸亥",
        stem: "癸",
        branch: "亥",
        ten_god: "正官",
        shen_sha: [],
        life_stage_han: "养",
        hidden_stems: ["壬", "甲"],
      },
    },
    da_yun: [
      { start_age: 8, start_year: 2010, ganzhi: "丁酉" },
      { start_age: 18, start_year: 2020, ganzhi: "丙申" },
    ],
    data_availability: { pillars_detail: true, da_yun: true, bazi_enrichment: false },
  };
}

{
  const fields = buildTopicTypedFields(makeStructured(), "career");
  assert.ok(fields.length >= 2, `expected typed fields, got ${fields.length}`);
  assert.ok(fields.some((f) => f.chart_token.includes("财") || f.chart_token.includes("官")));
  console.log("ok topic-typed fields", fields.map((f) => f.id).join(","));
}

{
  const p = buildDayunPolarity(makeStructured(), "career", 2024);
  assert.ok(p.chart_token.length > 0);
  assert.ok(["favor", "caution", "mixed", "unknown"].includes(p.stance));
  console.log("ok dayun polarity", p.stance, p.chart_token);
}

{
  const inv = buildStructuredInstanceInventory(makeStructured(), {
    questionCategory: "relationship",
  });
  assert.ok(inv.includes("题型真算锚"));
  assert.ok(inv.includes("大运攻守松紧"));
  console.log("ok inventory lines");
}

{
  const empty = assessUnitAnchorQuality({
    pageKey: "science_action",
    units: [
      { path: "a", anchors: [] },
      { path: "b", anchors: [] },
    ],
  });
  assert.equal(empty.structuralFail, true);

  const partial = assessUnitAnchorQuality({
    pageKey: "science_action",
    units: [
      { path: "a", anchors: ["用神·水"] },
      { path: "b", anchors: [] },
    ],
  });
  assert.equal(partial.structuralFail, false);
  assert.ok(partial.notes.some((n) => n.includes("unit_missing_chart_anchors")));

  const units = collectPageAnchorUnits("science_action", {
    primary_toolkit: {
      angles: [{ chart_anchors: ["用神·水"] }, { chart_anchors: [] }],
    },
    backup_toolkit: { angles: [{ chart_anchors: ["忌神·火"] }] },
  });
  assert.equal(units.length, 3);
  console.log("ok anchor quality gate");
}

console.log("\nAll topic/dayun/anchor smoke passed.");
