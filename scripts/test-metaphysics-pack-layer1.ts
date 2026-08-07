/**
 * Layer 1 smoke — metaphysics_pack builders.
 * Run: pnpm exec tsx scripts/test-metaphysics-pack-layer1.ts
 */
import {
  buildMetaphysicsPack,
  buildYongShenOutputForM6,
  favorableHours,
  nobleDirection,
  normalizeElementScores,
  type ProfileStructured,
} from "../lib/calculations";

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
  four_pillars: {
    year: "甲子",
    month: "丙寅",
    day: "戊午",
    hour: "癸亥",
  },
  pillars_detail: {
    year: {
      ganzhi: "甲子",
      stem: "甲",
      branch: "子",
      ten_god: "比肩",
      hidden_stems: ["癸"],
      shen_sha: [],
    },
    month: {
      ganzhi: "丙寅",
      stem: "丙",
      branch: "寅",
      ten_god: "食神",
      hidden_stems: ["甲", "丙", "戊"],
      shen_sha: [],
    },
    day: {
      ganzhi: "戊午",
      stem: "戊",
      branch: "午",
      ten_god: "日主",
      hidden_stems: ["丁", "己"],
      // 戊日主 天乙贵人 = 丑/未 — put 未 on day for instance scan
      shen_sha: ["天乙贵人"],
    },
    hour: {
      ganzhi: "癸亥",
      stem: "癸",
      branch: "亥",
      ten_god: "正财",
      hidden_stems: ["壬", "甲"],
      shen_sha: [],
    },
  },
  da_yun: [],
  data_availability: {
    pillars_detail: true,
    da_yun: false,
    bazi_enrichment: false,
  },
};

// Fix: 天乙贵人 for 戊 is 丑/未 — day branch is 午, so we need a pillar with 未
structured.pillars_detail!.day.branch = "未";
structured.pillars_detail!.day.ganzhi = "戊未";

const yong = buildYongShenOutputForM6(structured);
assert(yong.primary_yong_shen === "water", "primary yong = water");
assert(yong.ji_shen[0] === "fire", "ji = fire");

const hours = favorableHours({ primary_yong_shen: "water", xi_shen: ["metal"] });
assert(hours.some((h) => h.branch === "子" && h.match === "primary"), "子 = water primary");
assert(hours.some((h) => h.branch === "申" && h.match === "xi"), "申 = metal xi");
assert(!hours.some((h) => h.branch === "午"), "午 fire not favorable");

const scores = normalizeElementScores({
  木: { 分值: 20 },
  火: { 分值: 30 },
  土: { 分值: 10 },
  金: { 分值: 15 },
  水: { 分值: 25 },
  日主五行: "木",
});
assert(scores.source === "chart", "scores from chart");
assert(scores.scores.wood + scores.scores.fire + scores.scores.earth + scores.scores.metal + scores.scores.water === 100, "pct sum 100");

const empty = normalizeElementScores(null);
assert(empty.source === "empty", "null → empty");
assert(empty.scores.wood === 0, "empty zero");

const noble = nobleDirection(structured);
assert(noble.shen_sha === "天乙贵人", "shen sha label");
assert(noble.theoretical_branches.includes("丑") && noble.theoretical_branches.includes("未"), "戊 → 丑未");
assert(noble.instances.some((i) => i.branch === "未" && i.direction === "SW"), "instance 未 → SW");
assert(!JSON.stringify(noble).includes("属"), "no zodiac layer");
assert(!JSON.stringify(noble).includes("鼠"), "no animal");

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
  current_time: "2026-08-07T10:00:00.000Z",
});

assert(pack.version === "metaphysics_pack_v1", "version");
assert(pack.color.usage === "visual_energy_anchor", "color framing");
assert(pack.career.framing === "domain_affinity_not_job_title", "career framing");
assert(pack.dashboard.output_capacity === pack.element_scores.wood, "output = day master pct");
assert(pack.dashboard.sustain_capacity === pack.element_scores.water, "sustain = yong pct");
assert(pack.dashboard.resistance_load === pack.element_scores.fire, "resistance = ji pct");
assert(pack.directions.cells.length === 8, "8 directions");
assert(pack.directions.preferred.length <= 3, "preferred ≤ 3");
assert(
  pack.directions.cells.every((c) =>
    ["high_fit", "supportive", "neutral", "friction", "drain"].includes(c.fit),
  ),
  "fit labels remapped",
);

console.log("metaphysics_pack Layer1 smoke OK");
console.log(
  JSON.stringify(
    {
      yong: pack.yong_shen,
      dashboard: pack.dashboard,
      preferred: pack.directions.preferred,
      hours: pack.favorable_hours.map((h) => `${h.branch} ${h.period} (${h.match})`),
      color: pack.color.labels_en,
      career: pack.career.themes_en,
      noble: pack.noble.instances.map((i) => `${i.branch}→${i.direction}`),
    },
    null,
    2,
  ),
);
