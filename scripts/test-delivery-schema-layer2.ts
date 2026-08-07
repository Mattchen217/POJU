/**
 * Layer 2 smoke — new 9-page DeliverySegmentKey + metaphysics_pack on BreakthroughCore.
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
import { formatSpineSliceForSegment } from "../lib/llm/pro/delivery/format-spine-for-finalize";
import { attachMetaphysicsPackToBreakthroughCore } from "../lib/poju/attach-metaphysics-pack";
import { makeTestBreakthroughCore } from "../lib/poju/test-breakthrough-core-fixture";
import { buildMetaphysicsPack, type ProfileStructured } from "../lib/calculations";
import { guessDeliverySegmentKey } from "../lib/poju/parse-delivery";
import { DELIVERY_SHELF_SLOT_IDS } from "../lib/poju/delivery-shelf-slots";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(DELIVERY_SEGMENT_KEYS.length === 9, "exactly 9 segment keys");
assert(DELIVERY_BOOTSTRAP_SEGMENT === "energy_base", "bootstrap = energy_base");
assert(DELIVERY_CLOSING_SEGMENT === "signals_close", "closing = signals_close");
assert(DELIVERY_TRANSITION_KEYS.size === 0, "no transition-only pages");

assert(resolveDeliverySegmentKey("preface") === "energy_base", "legacy preface");
assert(resolveDeliverySegmentKey("action") === "science_action", "legacy action");
assert(resolveDeliverySegmentKey("epilogue") === "signals_close", "legacy epilogue");
assert(LEGACY_SEGMENT_TO_CURRENT.D === "metaphysics_action", "letter D");

assert(guessDeliverySegmentKey("能量底座与核心洞察") === "energy_base", "guess P1");
assert(
  guessDeliverySegmentKey("环境调频：空间·色彩·高频时段·协同人群") === "metaphysics_action",
  "guess P6",
);
assert(guessDeliverySegmentKey("能量底座与黄金直答") === "energy_base", "legacy P1 heading");
assert(guessDeliverySegmentKey("关于这份报告") === "energy_base", "legacy preface heading");

assert(
  DELIVERY_SHELF_SLOT_IDS.includes("energy_base") &&
    DELIVERY_SHELF_SLOT_IDS.includes("signals_close") &&
    !(DELIVERY_SHELF_SLOT_IDS as readonly string[]).includes("preface"),
  "shelf slots use new keys",
);

const filled = fillMissingDeliverySegments({});
for (const k of DELIVERY_SEGMENT_KEYS) {
  assert(typeof filled[k].core_conclusion === "string", `filled ${k}`);
}

const validated = validateDeliveryComputed({
  energy_base: { core_conclusion: "该继续但换打法。", bazi_basis: ["用神水"] },
  situation: { core_conclusion: "图谱说明。", bazi_basis: ["食神"] },
});
assert(validated.ok === false, "soft missing others");
if (validated.ok !== false) throw new Error("expected soft fail");
assert(validated.partial != null, "has partial");
assert(
  Boolean(validated.partial?.energy_base?.core_conclusion.includes("继续")),
  "partial energy",
);
assert(
  Boolean(validated.partial?.talent_map?.core_conclusion.includes("图谱")),
  "legacy situation maps to talent_map",
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

const sliceP1 = formatSpineSliceForSegment(core, "energy_base");
assert(sliceP1.includes("dashboard"), "P1 slice has dashboard");
assert(sliceP1.includes("直答"), "P1 slice has direct-answer rule");

const sliceP6 = formatSpineSliceForSegment(core, "metaphysics_action");
assert(sliceP6.includes("favorable_hours") || sliceP6.includes("preferred_dirs"), "P6 has pack");
assert(sliceP6.includes("禁"), "P6 compliance cue");

const sliceP9 = formatSpineSliceForSegment(core, "signals_close");
assert(sliceP9.includes("禁止") && sliceP9.includes("钩子"), "P9 no return hook");

const sliceP4 = formatSpineSliceForSegment(core, "macro_cycle");
assert(sliceP4.includes("逐月"), "P4 no monthly forecast rule");

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
