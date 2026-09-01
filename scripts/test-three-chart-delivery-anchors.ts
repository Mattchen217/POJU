/**
 * P1-5 · 三盘对照评测骨架（本地确定性）
 *
 * 断言：换盘后题型真算锚 / 大运松紧 / P3–P5 可引池应变化。
 * 不跑 LLM。用法：pnpm exec tsx scripts/test-three-chart-delivery-anchors.ts
 */

import assert from "node:assert/strict";
import type { ProfileStructured } from "../lib/calculations/build-profile-structured";
import { buildDayunPolarity } from "../lib/calculations/dayun-polarity";
import { buildTopicTypedFields } from "../lib/calculations/topic-typed-fields";
import { extractMatchRelationMechanismAnchors } from "../lib/llm/prompts/match-relation-mechanism-anchors";
import { isDeliverySegmentTransportRetryable } from "../lib/llm/pro/delivery/delivery-retry-policy";
import { SEGMENT_COMPUTED_INPUTS } from "../lib/llm/pro/delivery/delivery-schema";

function pillar(
  ganzhi: string,
  ten_god: string,
): ProfileStructured["pillars_detail"] extends infer T
  ? T extends { year: infer P }
    ? P
    : never
  : never {
  const stem = ganzhi.charAt(0);
  const branch = ganzhi.charAt(1);
  return {
    ganzhi,
    stem,
    branch,
    ten_god,
    shen_sha: [],
    hidden_stems: [],
    life_stage_han: "长生",
  };
}

function makeChart(
  id: string,
  opts: {
    strength: ProfileStructured["strength"];
    yong: string;
    ji: string[];
    gods: [string, string, string, string];
    dayun: string;
  },
): ProfileStructured {
  const [yg, mg, dg, hg] = opts.gods;
  return {
    day_master: yg.charAt(0),
    pattern: `fixture_${id}`,
    yong_shen: opts.yong,
    xi_shen: [opts.yong],
    ji_shen: opts.ji,
    strength: opts.strength,
    four_pillars: {
      year: "甲子",
      month: "乙丑",
      day: "丙寅",
      hour: "丁卯",
    },
    pillars_detail: {
      year: pillar("甲子", yg),
      month: pillar("乙丑", mg),
      day: pillar("丙寅", dg),
      hour: pillar("丁卯", hg),
    },
    da_yun: [{ start_age: 10, start_year: 2015, ganzhi: opts.dayun }],
    data_availability: {
      pillars_detail: true,
      da_yun: true,
      bazi_enrichment: false,
    },
  };
}

/** Three contrasting charts for career/relationship delivery pools. */
const CHARTS = {
  wealth_officer_weak: makeChart("A", {
    strength: "weak",
    yong: "水",
    ji: ["火"],
    gods: ["比肩", "食神", "正财", "正官"],
    dayun: "丙申",
  }),
  peer_strong: makeChart("B", {
    strength: "strong",
    yong: "金",
    ji: ["木"],
    gods: ["劫财", "伤官", "偏印", "七杀"],
    dayun: "庚子",
  }),
  relationship_day: makeChart("C", {
    strength: "balanced",
    yong: "木",
    ji: ["金"],
    gods: ["正印", "偏财", "正财", "食神"],
    dayun: "甲寅",
  }),
} as const;

function poolSignature(
  structured: ProfileStructured,
  category: string,
): string {
  const topics = buildTopicTypedFields(structured, category)
    .map((f) => f.chart_token)
    .sort()
    .join("|");
  const dayun = buildDayunPolarity(structured, category, 2024).chart_token;
  return `${topics}::${dayun}`;
}

{
  const a = poolSignature(CHARTS.wealth_officer_weak, "career");
  const b = poolSignature(CHARTS.peer_strong, "career");
  const c = poolSignature(CHARTS.relationship_day, "relationship");
  assert.notEqual(a, b, "career pools A vs B must differ");
  assert.notEqual(a, c, "career A vs relationship C must differ");
  assert.notEqual(b, c, "B vs C must differ");
  console.log("ok three-chart topic/dayun pools differ");
  console.log("  A:", a.slice(0, 120));
  console.log("  B:", b.slice(0, 120));
  console.log("  C:", c.slice(0, 120));
}

{
  // P3/P4/P5 可引池：忌神 + 题型锚 + 大运（换盘应变）
  function deliveryPool(s: ProfileStructured): string {
    const ji = (s.ji_shen ?? []).join(",");
    const topics = buildTopicTypedFields(s, "career")
      .filter((f) => f.polarity === "drain" || f.polarity === "tension")
      .map((f) => f.id)
      .sort()
      .join(",");
    const stance = buildDayunPolarity(s, "career", 2024).stance;
    return `ji=${ji}|riskish=${topics}|dayun=${stance}`;
  }
  const pa = deliveryPool(CHARTS.wealth_officer_weak);
  const pb = deliveryPool(CHARTS.peer_strong);
  assert.notEqual(pa, pb, "P3/P4/P5 riskish pools must change across charts");
  console.log("ok P3/P4/P5-facing pool differs", { pa, pb });
}

{
  const anchors = extractMatchRelationMechanismAnchors({
    synergy_type: "互补协作",
    resonance_index: 72,
    key_strengths: ["沟通缓冲强"],
    key_challenges: ["决策节奏冲突"],
    summary: "宜先边界后扩张",
  });
  assert.ok(anchors.length >= 2);
  assert.ok(anchors.every((a) => a.token.includes("合盘") || a.token.includes("共振")));
  console.log(
    "ok Match relation_mechanism_anchors",
    anchors.map((a) => a.token).join("；"),
  );
}

{
  assert.equal(
    isDeliverySegmentTransportRetryable(
      "delivery_segment_failed:evidence_coverage:risk_guard:missing=2,4",
    ),
    true,
  );
  assert.ok(
    SEGMENT_COMPUTED_INPUTS.signals_close.includes("action_plan"),
  );
  assert.ok(
    SEGMENT_COMPUTED_INPUTS.signals_close.includes("rhythm_frame"),
  );
  assert.ok(
    SEGMENT_COMPUTED_INPUTS.signals_close.includes("action_brief_p3_p4"),
  );
  console.log("ok P6 inputs + evidence_coverage soft-retry");
}

console.log("\nAll three-chart delivery anchor checks passed.");
