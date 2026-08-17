/**
 * Layer 2 smoke — 6-page DeliverySegmentKey + metaphysics_pack on BreakthroughCore.
 * Run: pnpm exec tsx scripts/test-delivery-schema-layer2.ts
 */
import {
  DELIVERY_BOOTSTRAP_SEGMENT,
  DELIVERY_CLOSING_SEGMENT,
  DELIVERY_SEGMENT_KEYS,
  DELIVERY_TRANSITION_KEYS,
  fillMissingDeliverySegments,
  LEGACY_SEGMENT_TO_CURRENT,
  resolveDeliverySegmentKey,
  validateDeliveryComputed,
} from "../lib/llm/pro/delivery/delivery-schema";
import { formatSpineSliceForSegment, formatBreakthroughCoreForFinalize, buildDashboardScoreHintsForFill } from "../lib/llm/pro/delivery/format-spine-for-finalize";
import { attachMetaphysicsPackToBreakthroughCore } from "../lib/poju/attach-metaphysics-pack";
import { makeTestBreakthroughCore } from "../lib/poju/test-breakthrough-core-fixture";
import { buildMetaphysicsPack, type ProfileStructured } from "../lib/calculations";
import { guessDeliverySegmentKey } from "../lib/poju/parse-delivery";
import { DELIVERY_SHELF_SLOT_IDS } from "../lib/poju/delivery-shelf-slots";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(DELIVERY_SEGMENT_KEYS.length === 6, "exactly 6 active segment keys");
assert(
  DELIVERY_SEGMENT_KEYS.join("|") ===
    "direct_answer|foundation|science_action|metaphysics_action|risk_guard|signals_close",
  "6-key order (thirty_day retired)",
);
assert(DELIVERY_BOOTSTRAP_SEGMENT === "direct_answer", "bootstrap = direct_answer");
assert(DELIVERY_CLOSING_SEGMENT === "signals_close", "closing = signals_close");
assert(DELIVERY_TRANSITION_KEYS.has("direct_answer"), "P1 skips evidence/mark");
assert(DELIVERY_TRANSITION_KEYS.size === 1, "only P1 is transition");

assert(resolveDeliverySegmentKey("preface") === "direct_answer", "legacy preface → direct_answer");
assert(resolveDeliverySegmentKey("energy_base") === "foundation", "legacy energy_base → foundation");
assert(resolveDeliverySegmentKey("talent_map") === "foundation", "legacy talent_map → foundation");
assert(resolveDeliverySegmentKey("spirit_gifts") === "foundation", "legacy spirit_gifts → foundation");
assert(resolveDeliverySegmentKey("macro_cycle") === "foundation", "legacy macro_cycle → foundation");
assert(resolveDeliverySegmentKey("action") === "science_action", "legacy action");
assert(resolveDeliverySegmentKey("epilogue") === "signals_close", "legacy epilogue");
assert(LEGACY_SEGMENT_TO_CURRENT.A === "foundation", "letter A → foundation");
assert(LEGACY_SEGMENT_TO_CURRENT.D === "metaphysics_action", "letter D");

assert(guessDeliverySegmentKey("核心直答") === "direct_answer", "guess P1 tag");
assert(guessDeliverySegmentKey("对你问题的回答") === "direct_answer", "guess P1 legacy");
assert(guessDeliverySegmentKey("归因剖析") === "foundation", "guess P2 tag");
assert(guessDeliverySegmentKey("归因诊断") === "foundation", "guess P2 legacy tag");
assert(guessDeliverySegmentKey("你的底座与为什么卡在这") === "foundation", "guess P2 legacy");
assert(guessDeliverySegmentKey("破局策略") === "science_action", "guess science tag");
assert(guessDeliverySegmentKey("显性操盘") === "science_action", "guess science legacy tag");
assert(guessDeliverySegmentKey("自我调频") === "metaphysics_action", "guess eastern tag");
assert(guessDeliverySegmentKey("隐性借势") === "metaphysics_action", "guess eastern legacy tag");
assert(guessDeliverySegmentKey("风险预警") === "risk_guard", "guess P5 tag");
assert(guessDeliverySegmentKey("行动建议") === "signals_close", "guess P6 tag");
assert(guessDeliverySegmentKey("行动指引") === "signals_close", "guess P6 legacy tag");
assert(
  guessDeliverySegmentKey("环境调频：空间·色彩·高频时段·协同人群") === "metaphysics_action",
  "guess metaphysics",
);
assert(
  guessDeliverySegmentKey("科学药方：策略与手段") === "science_action",
  "guess science Rx",
);
assert(
  guessDeliverySegmentKey("东方药方：策略与手段") === "metaphysics_action",
  "guess eastern Rx",
);
assert(guessDeliverySegmentKey("能量底座与核心洞察") === "foundation", "legacy P1 heading → foundation");
assert(guessDeliverySegmentKey("能量底座与黄金直答") === "direct_answer", "legacy direct-answer heading");
assert(guessDeliverySegmentKey("关于这份报告") === "direct_answer", "legacy preface heading");

assert(
  DELIVERY_SHELF_SLOT_IDS.includes("direct_answer") &&
    DELIVERY_SHELF_SLOT_IDS.includes("foundation") &&
    DELIVERY_SHELF_SLOT_IDS.includes("signals_close") &&
    !(DELIVERY_SHELF_SLOT_IDS as readonly string[]).includes("thirty_day") &&
    !(DELIVERY_SHELF_SLOT_IDS as readonly string[]).includes("energy_base") &&
    !(DELIVERY_SHELF_SLOT_IDS as readonly string[]).includes("preface"),
  "shelf slots use 6 active keys",
);

const filled = fillMissingDeliverySegments({});
for (const k of DELIVERY_SEGMENT_KEYS) {
  assert(typeof filled[k].core_conclusion === "string", `filled ${k}`);
}

const validated = validateDeliveryComputed({
  energy_base: { core_conclusion: "该继续但换打法。", bazi_basis: ["用神水"] },
  preface: { core_conclusion: "直答：先稳住再推进。", bazi_basis: ["印星"] },
});
assert(validated.ok === false, "soft missing others");
if (validated.ok !== false) throw new Error("expected soft fail");
assert(validated.partial != null, "has partial");
assert(
  Boolean(validated.partial?.foundation?.core_conclusion.includes("继续")),
  "legacy energy_base maps to foundation",
);
assert(
  Boolean(validated.partial?.direct_answer?.core_conclusion.includes("直答")),
  "legacy preface maps to direct_answer",
);

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
core = attachMetaphysicsPackToBreakthroughCore(core, {
  structured,
  metaphysics_pack: pack,
});
assert(core.metaphysics_pack?.version === "metaphysics_pack_v1", "pack on core");
assert(core.element_scores?.water === 25, "element_scores mirrored");
const dashHints = buildDashboardScoreHintsForFill(core);
assert(dashHints.includes("output_capacity="), "dashboard hints from pack");
assert(dashHints.includes("score=null"), "dashboard hints ban invent");

const sliceP1 = formatSpineSliceForSegment(core, "direct_answer");
assert(sliceP1.includes("situation_conclusion"), "P1 slice has situation");
assert(sliceP1.includes("直答"), "P1 slice has direct-answer rule");
assert(!sliceP1.includes("dashboard"), "P1 slice has no dashboard (论证归 foundation)");

const sliceP2 = formatSpineSliceForSegment(core, "foundation");
assert(sliceP2.includes("dashboard"), "P2 slice has dashboard");
assert(sliceP2.includes("逐月"), "P2 no monthly forecast rule");
assert(sliceP2.includes("论证"), "P2 argument rule");
assert(sliceP2.includes("multi_dimension_reckoning"), "P2 slice has multi_dimension_reckoning");
assert(sliceP2.includes("十神格局"), "P2 slice dumps dimension labels");

const sliceP3 = formatSpineSliceForSegment(core, "science_action");
assert(sliceP3.includes("multi_dimension_reckoning"), "P3 slice has multi_dimension_reckoning");
assert(sliceP3.includes("action_plan"), "P3 slice has action_plan");
assert(sliceP3.includes("用专业输出换边界"), "P3 action_plan primary present");
assert(sliceP3.includes("modern_action_frames"), "P3 still has frames兜底");
assert(
  sliceP3.includes("metaphysics_pack") || sliceP3.includes("yong:"),
  "P3 spine includes pack for polarity",
);
assert(sliceP3.includes("禁") && sliceP3.includes("P4"), "P3 bans P4 field list");

const sliceP5 = formatSpineSliceForSegment(core, "thirty_day");
assert(sliceP5.includes("action_plan"), "P5 slice has action_plan");
assert(sliceP5.includes("current_da_yun_cycle"), "P5 slice has current_da_yun_cycle");
assert(sliceP5.includes("平均切"), "P5 bans average 4-week split");

const sliceP4 = formatSpineSliceForSegment(core, "metaphysics_action");
assert(
  sliceP4.includes("视觉心理") ||
    sliceP4.includes("生物节律") ||
    sliceP4.includes("场域/节律") ||
    sliceP4.includes("合规"),
  "P4 gateway-safe cue",
);
assert(sliceP4.includes("favorable_hours") || sliceP4.includes("preferred_dirs") || sliceP4.includes("metaphysics_pack"), "P4 has pack");
assert(sliceP4.includes("禁"), "P4 compliance cue");

const sliceP6 = formatSpineSliceForSegment(core, "risk_guard");
assert(sliceP6.includes("blind_spots"), "P6 has blind_spots");
assert(sliceP6.includes("特有"), "P6 structure-specific pitfall cue");

const fullDump = formatBreakthroughCoreForFinalize(core);
assert(fullDump.includes("multi_dimension_reckoning"), "full dump has multi dims");
assert(fullDump.includes("action_plan"), "full dump has action_plan");
assert(
  fullDump.indexOf("multi_dimension_reckoning") < fullDump.indexOf("modern_action_frames"),
  "dims before candidate frames",
);
assert(
  fullDump.indexOf("action_plan") < fullDump.indexOf("modern_action_frames"),
  "action_plan before candidate frames",
);

const sliceClose = formatSpineSliceForSegment(core, "signals_close");
assert(sliceClose.includes("禁止") && sliceClose.includes("钩子"), "close no return hook");

console.log("delivery schema Layer2 smoke OK");
console.log(
  JSON.stringify(
    {
      keys: DELIVERY_SEGMENT_KEYS,
      bootstrap: DELIVERY_BOOTSTRAP_SEGMENT,
      closing: DELIVERY_CLOSING_SEGMENT,
      pack_yong: core.metaphysics_pack?.yong_shen,
      preferred: core.metaphysics_pack?.directions.preferred,
    },
    null,
    2,
  ),
);
