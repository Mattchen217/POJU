/**
 * Layer 3 smoke — P1 dashboard + P7 gantt code structures in merge.
 * Run: pnpm exec tsx scripts/test-delivery-struct-layer3.ts
 */
import { buildMetaphysicsPack, type ProfileStructured } from "../lib/calculations";
import { mergeDeliveryToMarkdown } from "../lib/llm/pro/delivery/merge-delivery-markdown";
import {
  buildEnergyDashboardStruct,
  buildThirtyDayGanttFromModel,
  parsePojuStructPayloads,
  stripPojuStructFences,
} from "../lib/llm/pro/delivery/poju-struct-blocks";
import { sanitizeDeliveryBookMarkdown } from "../lib/llm/pro/delivery/sanitize-delivery-book";
import { attachMetaphysicsPackToBreakthroughCore } from "../lib/poju/attach-metaphysics-pack";
import { makeTestBreakthroughCore } from "../lib/poju/test-breakthrough-core-fixture";
import { DELIVERY_SEGMENT_KEYS } from "../lib/llm/pro/delivery/delivery-schema";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const structured: ProfileStructured = {
  day_master: "甲木",
  pattern: "test",
  yong_shen: "water",
  xi_shen: ["metal"],
  ji_shen: ["fire"],
  strength: "balanced",
  four_pillars: { year: "甲子", month: "丙寅", day: "戊未", hour: "癸亥" },
  pillars_detail: {
    year: { ganzhi: "甲子", stem: "甲", branch: "子", ten_god: "比肩", hidden_stems: [], shen_sha: [] },
    month: { ganzhi: "丙寅", stem: "丙", branch: "寅", ten_god: "食神", hidden_stems: [], shen_sha: [] },
    day: {
      ganzhi: "戊未",
      stem: "戊",
      branch: "未",
      ten_god: "日主",
      hidden_stems: [],
      shen_sha: ["天乙贵人"],
    },
    hour: { ganzhi: "癸亥", stem: "癸", branch: "亥", ten_god: "正财", hidden_stems: [], shen_sha: [] },
  },
  da_yun: [],
  data_availability: { pillars_detail: true, da_yun: false, bazi_enrichment: false },
};

const pack = buildMetaphysicsPack({
  structured,
  element_scores_raw: {
    木: { 分值: 20 },
    火: { 分值: 30 },
    土: { 分值: 10 },
    金: { 分值: 15 },
    水: { 分值: 25 },
    日主五行: "木",
  },
});

let core = makeTestBreakthroughCore();
core = attachMetaphysicsPackToBreakthroughCore(core, { metaphysics_pack: pack });

const dash = buildEnergyDashboardStruct(pack, "zh");
assert(dash.kind === "energy_dashboard", "dashboard kind");
assert(dash.output_capacity === 20 && dash.sustain_capacity === 25 && dash.resistance_load === 30, "true scores");

const gantt = buildThirtyDayGanttFromModel(
  {
    weeks: [
      {
        week: 1,
        phase_label: "第一周：观察校准",
        science: ["先记录触发点"],
        alignment: ["推荐方位：正北 / 西北"],
      },
      {
        week: 2,
        phase_label: "第二周：小步调整",
        science: ["每周一次低压力社交"],
        alignment: ["高频时段：夜间 21:00–01:00"],
      },
      {
        week: 3,
        phase_label: "第三周：巩固推进",
        science: ["练习渐进式信任"],
        alignment: ["开运色彩/视觉锚点：深蓝、黑色"],
      },
      {
        week: 4,
        phase_label: "第四周：收束复盘",
        science: ["复盘安全情境"],
        alignment: ["协同人群：具备平静与适应力的伙伴"],
      },
    ],
  },
  "zh",
);
assert(!!gantt && gantt.kind === "thirty_day_gantt", "gantt kind");
assert(gantt!.weeks.length === 4, "4 weeks");
assert(gantt!.labels.metaphysics_col === "环境与时区调频", "new col label");

const narrative = Object.fromEntries(
  DELIVERY_SEGMENT_KEYS.map((k) => [
    k,
    [{ body: `### 论点\n\n这是${k}段白话扩写，不含仪表盘数字表。` }],
  ]),
);
const evidence = Object.fromEntries(
  DELIVERY_SEGMENT_KEYS.map((k) => [k, [{ evidence: `依据支撑${k}` }]]),
);

const md = mergeDeliveryToMarkdown(narrative, evidence, "zh", {
  original_question: "我该不该换工作？",
  locale: "zh",
  breakthrough_core: core,
  page_structs: {
    thirty_day: { gantt },
  },
});

assert(md.includes("```poju-struct"), "merge embeds poju-struct");
assert(md.includes('"kind":"energy_dashboard"') || md.includes('"kind": "energy_dashboard"'), "P1 struct");
assert(md.includes('"kind":"thirty_day_gantt"') || md.includes('"kind": "thirty_day_gantt"'), "P7 struct");
assert(md.includes("输出力") || md.includes("output_capacity"), "dashboard fallback or json");
assert(md.includes("环境与时区调频"), "new gantt chrome");

const cleaned = sanitizeDeliveryBookMarkdown(
  md + "\n\n随时回来追踪进展。\n",
  "zh",
);
assert(cleaned.includes("```poju-struct"), "sanitize keeps fences");
const payloads = parsePojuStructPayloads(cleaned);
assert(payloads.some((p) => p.kind === "energy_dashboard"), "parse dashboard after sanitize");
assert(payloads.some((p) => p.kind === "thirty_day_gantt"), "parse gantt after sanitize");

const stripped = stripPojuStructFences(cleaned);
assert(!stripped.includes("```poju-struct"), "strip removes fences");

const hooked = sanitizeDeliveryBookMarkdown(
  `## 正向信号与收尾\n\n你已拿到完整打法。随时回来追踪。\n`,
  "zh",
);
assert(!hooked.includes("随时回来"), "P9 strips return hook");

console.log("delivery struct Layer3 smoke OK");
console.log(
  JSON.stringify(
    {
      dashboard: dash,
      weeks: gantt!.weeks.map((w) => ({
        week: w.week,
        science: w.science[0],
        metaphysics: w.metaphysics[0],
      })),
      struct_count: payloads.length,
    },
    null,
    2,
  ),
);
