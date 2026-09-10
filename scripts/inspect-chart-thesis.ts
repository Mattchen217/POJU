/**
 * Independent human review for chart thesis (before assign).
 *
 * - Prints classical_basis / conclusion / depth per dimension
 * - Asserts agenda non-pollution: same structured → identical classical_basis
 *   across two agendas (depth/truncate only may differ)
 *
 * Usage:
 *   pnpm exec tsx scripts/inspect-chart-thesis.ts
 */

import assert from "node:assert/strict";

import {
  STRUCTURED_BALANCED,
  STRUCTURED_STRONG,
  STRUCTURED_WEAK,
} from "./_v2-fixtures";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildTopicCalcSupplement } from "@/lib/calculations/topic-calc-supplement";
import {
  applyAgendaDepth,
  buildChartThesisFromStructured,
  buildJudgmentCoreFromFeed,
  buildThesisCalcFeed,
  type ChartThesis,
} from "@/lib/llm/pro/delivery/thesis";
import { THESIS_ABSENT_SUMMARY_ZH } from "@/lib/llm/pro/delivery/thesis/types";

const AS_OF = new Date("2026-06-15T12:00:00.000Z");

function basisFingerprint(thesis: ChartThesis): string {
  return JSON.stringify(
    thesis.dimensions.map((d) => ({
      id: d.dimension_id,
      strength_verdict: d.strength_verdict ?? null,
      basis: d.classical_basis,
      wuxing: d.wuxing_relations,
    })),
  );
}

function dumpThesis(name: string, structured: ProfileStructured): void {
  const supplement = buildTopicCalcSupplement({
    structured,
    question_category: "career",
    as_of: AS_OF,
    timezone: "Asia/Shanghai",
  });
  const feed = buildThesisCalcFeed(structured, {
    as_of: AS_OF,
    timezone: "Asia/Shanghai",
    question_category: "career",
    supplement,
  });
  const frozen = buildJudgmentCoreFromFeed(feed);

  const agendaA = "要不要辞职创业赚钱";
  const agendaB = "换城市生活节奏与家人相处";
  const thesisA = applyAgendaDepth(frozen, agendaA);
  const thesisB = applyAgendaDepth(frozen, agendaB);

  assert.equal(
    basisFingerprint(thesisA),
    basisFingerprint(thesisB),
    `${name}: classical facts must not change across agendas`,
  );

  // Full conclusions on frozen core equal; brief may truncate.
  for (let i = 0; i < frozen.dimensions.length; i++) {
    const fa = frozen.dimensions[i]!;
    const a = thesisA.dimensions[i]!;
    const b = thesisB.dimensions[i]!;
    assert.deepEqual(a.classical_basis, fa.classical_basis);
    assert.deepEqual(b.classical_basis, fa.classical_basis);
    if (a.depth === "full") assert.equal(a.conclusion_zh, fa.conclusion_zh);
    if (b.depth === "full") assert.equal(b.conclusion_zh, fa.conclusion_zh);
  }

  console.log("\n============================================================");
  console.log(`THESIS · ${name}`);
  console.log(
    `日主 ${structured.day_master} · strength=${structured.strength} · 用神=${structured.yong_shen}`,
  );
  console.log(`fingerprint=${frozen.structured_fingerprint}`);
  console.log(`agenda A depth map: ${thesisA.dimensions.map((d) => `${d.dimension_id}:${d.depth}`).join(" · ")}`);
  console.log(`agenda B depth map: ${thesisB.dimensions.map((d) => `${d.dimension_id}:${d.depth}`).join(" · ")}`);

  for (const dim of frozen.dimensions) {
    const basis = Array.isArray(dim.classical_basis) ? dim.classical_basis : [];
    const absent = basis.filter((i) => !i.present);
    const present = basis.filter((i) => i.present);
    console.log("------------------------------------------------------------");
    console.log(
      `${dim.dimension_name_zh} (${dim.dimension_id}) · present=${present.length} absent=${absent.length}`,
    );
    if (dim.strength_verdict) console.log(`  strength_verdict: ${dim.strength_verdict}`);
    for (const it of basis) {
      const mark = it.present ? "✓" : "○";
      console.log(`  ${mark} [${it.key}] ${it.summary_zh}`);
    }
    console.log(`  conclusion: ${dim.conclusion_zh}`);
    if (absent.some((i) => i.summary_zh !== THESIS_ABSENT_SUMMARY_ZH)) {
      throw new Error(`${dim.dimension_id}: absent item must use 未见相关特征`);
    }
  }
}

dumpThesis("STRONG · 乙木偏强", STRUCTURED_STRONG);
dumpThesis("WEAK · 丁火偏弱", STRUCTURED_WEAK);
dumpThesis("BALANCED · 庚金均衡", STRUCTURED_BALANCED);

// Smoke compose path used by Lab
{
  const t = buildChartThesisFromStructured(STRUCTURED_STRONG, "创业赚钱", {
    as_of: AS_OF,
    question_category: "career",
  });
  assert.ok(t.dimensions.length >= 6);
  console.log("\ncompose path ok · dims=", t.dimensions.length);
}

console.log("\ninspect-chart-thesis: structural checks passed (review lines above by eye).");
