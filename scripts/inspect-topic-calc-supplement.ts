/**
 * Independent human review dump for TopicCalcSupplement (before thesis feed wiring).
 *
 * Uses v2 real-engine fixtures (强/弱/均衡). Prints cycles / relations / rhythm_signals
 * for manual spot-check. Also asserts category-invariance + neutral wording +
 * cycle_relations ↔ rhythm_signals 1:1 (no silent drop) + no 流日.
 *
 * Usage:
 *   pnpm exec tsx scripts/inspect-topic-calc-supplement.ts
 *   pnpm exec tsx scripts/inspect-topic-calc-supplement.ts --as-of=2026-06-15T12:00:00.000Z
 *
 * 读标签时注意：
 *   「日支」= 本命日柱地支（natal day branch），不是「流日」
 *   「流日」= 当日干支运限（liuri）—— TopicCalcSupplement v1 **故意不算**
 */

import assert from "node:assert/strict";

import {
  STRUCTURED_BALANCED,
  STRUCTURED_STRONG,
  STRUCTURED_WEAK,
} from "./_v2-fixtures";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  assertRhythmSummaryNeutral,
  buildTopicCalcSupplement,
  type TopicCalcSupplement,
} from "@/lib/calculations/topic-calc-supplement";
import type { QuestionCategory } from "@/lib/poju/agent-state";

function parseAsOf(argv: string[]): Date {
  const raw = argv.find((a) => a.startsWith("--as-of="))?.slice("--as-of=".length);
  if (raw) return new Date(raw);
  return new Date("2026-06-15T12:00:00.000Z");
}

function factFingerprint(pack: TopicCalcSupplement): string {
  return JSON.stringify({
    cycles: pack.cycles,
    relations: pack.cycle_relations
      .map((r) => ({ id: r.id, kind: r.kind, summary_zh: r.summary_zh }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    rhythm: pack.rhythm_signals
      .map((s) => ({ id: s.id, kind: s.kind, summary_zh: s.summary_zh, layers: s.layers }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    yong: pack.yongshen_activation,
  });
}

function assertRelationRhythmParity(pack: TopicCalcSupplement, chartName: string): void {
  assert.equal(
    pack.cycle_relations.length,
    pack.rhythm_signals.length,
    `${chartName}: cycle_relations and rhythm_signals must be 1:1 (no silent drop)`,
  );
  const relIds = pack.cycle_relations.map((r) => r.id).sort();
  const rhythmIds = pack.rhythm_signals.map((s) => s.id.replace(/^rhythm:/, "")).sort();
  assert.deepEqual(relIds, rhythmIds, `${chartName}: relation ids must match rhythm ids`);

  for (const r of pack.cycle_relations) {
    assert.equal(
      r.summary_zh.includes("流日"),
      false,
      `${chartName}: cycle_relations must not include 流日: ${r.summary_zh}`,
    );
  }
  for (const s of pack.rhythm_signals) {
    assert.equal(
      s.summary_zh.includes("流日"),
      false,
      `${chartName}: rhythm_signals must not include 流日: ${s.summary_zh}`,
    );
    assertRhythmSummaryNeutral(s.summary_zh);
    // summary_zh and cycle_relations share the same han for matching id
    const twin = pack.cycle_relations.find((r) => `rhythm:${r.id}` === s.id);
    assert.ok(twin, `${chartName}: missing twin for ${s.id}`);
    assert.equal(
      twin!.summary_zh,
      s.summary_zh,
      `${chartName}: summary_zh must match across lists for ${s.id}`,
    );
  }
}

function dumpChart(name: string, structured: ProfileStructured, asOf: Date): void {
  const categories: QuestionCategory[] = ["career", "relationship", "wealth", "decision"];
  const packs = categories.map((question_category) =>
    buildTopicCalcSupplement({
      structured,
      question_category,
      as_of: asOf,
      timezone: "Asia/Shanghai",
    }),
  );

  const base = packs[0]!;
  for (let i = 1; i < packs.length; i++) {
    assert.equal(
      factFingerprint(base),
      factFingerprint(packs[i]!),
      `${name}: fact layers must match across ${categories[0]} vs ${categories[i]}`,
    );
  }
  assertRelationRhythmParity(base, name);

  const dm = structured.day_master;
  const pillars = structured.four_pillars;
  console.log("\n============================================================");
  console.log(`CHART · ${name}`);
  console.log(`日主 ${dm} · strength=${structured.strength} · 用神=${structured.yong_shen}`);
  console.log(
    `四柱 ${pillars.year} ${pillars.month} ${pillars.day} ${pillars.hour}`,
  );
  console.log(`as_of=${base.meta.as_of}`);
  console.log(
    "注：摘要里「·日支」=本命日柱地支；「流日」=当日运限（本包 v1 不算）。",
  );
  console.log("------------------------------------------------------------");
  console.log("cycles:");
  console.log(
    `  dayun[${base.cycles.dayun_index}] ${base.cycles.current_dayun?.ganzhi ?? "—"} · ten_god=${base.cycles.current_dayun?.ten_god ?? ""}`,
  );
  console.log(
    `  liunian ${base.cycles.current_liunian?.ganzhi ?? "—"} · ten_god=${base.cycles.current_liunian?.ten_god ?? ""}`,
  );
  console.log(
    `  liuyue ${base.cycles.current_liuyue?.ganzhi ?? "—"} · ten_god=${base.cycles.current_liuyue?.ten_god ?? ""}`,
  );

  if (base.yongshen_activation) {
    const y = base.yongshen_activation;
    console.log("yongshen_activation (elemental, not 攻守文案):");
    console.log(
      `  dayun=${y.dayun_element_stance} · liunian=${y.liunian_element_stance} · conflict=${y.element_stances_conflict}`,
    );
  }

  console.log(
    `cycle_relations (${base.cycle_relations.length}) · must equal rhythm_signals:`,
  );
  for (const r of base.cycle_relations) {
    console.log(`  - [${r.source}/${r.kind}] ${r.summary_zh}`);
  }

  console.log(`rhythm_signals (${base.rhythm_signals.length}) · 1:1 · neutral:`);
  for (const s of base.rhythm_signals) {
    console.log(`  - [${s.kind}|${s.layers.join("+")}] ${s.summary_zh}`);
  }

  console.log("topic_slice:");
  console.log(
    "  (defaults = 题类规则表，三盘相同是预期；natal_fields / relation_focus 才因人而异)",
  );
  for (const pack of packs) {
    const fields = pack.topic_slice.natal_fields
      .map((f) => f.id)
      .slice(0, 6)
      .join(",");
    console.log(
      `  ${pack.meta.question_category}: palaces=${pack.topic_slice.primary_palaces.join(",")} · natal_fields[${pack.topic_slice.natal_fields.length}]=${fields || "—"} · relation_focus=${pack.topic_slice.relation_focus_ids.length}`,
    );
  }

  console.log("thesis_feed_hooks:", base.thesis_feed_hooks);
  console.log("absent_notes:", base.absent_notes);
}

/** Sparse chart: synthetic boundary fixture (not a real birth chart) — forces absent_notes. */
function assertAbsentNotesTrigger(): void {
  const sparse: ProfileStructured = {
    day_master: "甲",
    pattern: "test",
    yong_shen: "",
    xi_shen: [],
    ji_shen: [],
    strength: "balanced",
    four_pillars: { year: "甲子", month: "乙丑", day: "丙寅", hour: "丁卯" },
    pillars_detail: undefined,
    da_yun: [],
    data_availability: {
      pillars_detail: false,
      da_yun: false,
      bazi_enrichment: false,
    },
  };
  const pack = buildTopicCalcSupplement({
    structured: sparse,
    question_category: "decision",
    as_of: new Date("2026-06-15T12:00:00.000Z"),
    timezone: "UTC",
  });
  assert.ok(
    pack.absent_notes.some((n) => n.key === "current_dayun"),
    "sparse chart should absent current_dayun",
  );
  assert.ok(
    pack.absent_notes.some((n) => n.key === "yongshen_activation"),
    "sparse chart should absent yongshen_activation",
  );
  console.log("\nabsent_notes boundary (sparse chart):", pack.absent_notes);
}

const asOf = parseAsOf(process.argv.slice(2));

dumpChart("STRONG · 乙木偏强 (1985-07-15)", STRUCTURED_STRONG, asOf);
dumpChart("WEAK · 丁火偏弱 (1978-09-12)", STRUCTURED_WEAK, asOf);
dumpChart("BALANCED · 庚金均衡 (2001-03-08)", STRUCTURED_BALANCED, asOf);
assertAbsentNotesTrigger();

console.log("\ninspect-topic-calc-supplement: structural checks passed (review lines above by eye).");
