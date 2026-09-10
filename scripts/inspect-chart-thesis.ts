/**
 * Independent human review for chart thesis (before assign / Phase C).
 *
 * Prints:
 * - classical_basis / conclusion / depth per dimension
 * - FULL dual-agenda render (A vs B) for eye-diff of brief vs full text
 * - Dual as_of cycle_rhythm proof (cache key must include as_of_day)
 * - Explicit STUB flag for climate_balance
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
  type ThesisDimension,
} from "@/lib/llm/pro/delivery/thesis";
import { THESIS_ABSENT_SUMMARY_ZH } from "@/lib/llm/pro/delivery/thesis/types";
import { deliveryChartThesisRuntimeCacheKey } from "@/lib/llm/pro/delivery/dispatch/task-store";

const AS_OF_A = new Date("2026-06-15T12:00:00.000Z");
/** +1 year — past 2027 春节, into next liunian (丁未). */
const AS_OF_B = new Date("2027-06-15T12:00:00.000Z");

const AGENDA_A = "要不要辞职创业赚钱";
const AGENDA_B = "换城市生活节奏与家人相处";

/** Keys that are stubs (always absent) — not true calc negatives. */
const STUB_CHECKLIST_KEYS = new Set(["climate_balance"]);

function asOfDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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

function cycleRhythmSnapshot(thesis: ChartThesis): string {
  const dim = thesis.dimensions.find((d) => d.dimension_id === "cycle_rhythm");
  assert.ok(dim, "cycle_rhythm missing");
  return JSON.stringify({
    basis: dim.classical_basis,
    conclusion_zh: dim.conclusion_zh,
  });
}

function printDimBody(dim: ThesisDimension, indent = "  "): void {
  const basis = Array.isArray(dim.classical_basis) ? dim.classical_basis : [];
  const absent = basis.filter((i) => !i.present);
  const present = basis.filter((i) => i.present);
  console.log(
    `${indent}${dim.dimension_name_zh} (${dim.dimension_id}) · depth=${dim.depth} · present=${present.length} absent=${absent.length}`,
  );
  if (dim.strength_verdict) console.log(`${indent}  strength_verdict: ${dim.strength_verdict}`);
  for (const it of basis) {
    const mark = it.present ? "✓" : "○";
    const stub = STUB_CHECKLIST_KEYS.has(it.key) ? " · STUB(always-absent)" : "";
    console.log(`${indent}  ${mark} [${it.key}] ${it.summary_zh}${stub}`);
  }
  console.log(`${indent}  conclusion: ${dim.conclusion_zh}`);
  if (absent.some((i) => i.summary_zh !== THESIS_ABSENT_SUMMARY_ZH)) {
    throw new Error(`${dim.dimension_id}: absent item must use 未见相关特征`);
  }
}

function buildFrozen(
  structured: ProfileStructured,
  as_of: Date,
  question_category: "career" | "relationship" = "career",
): ChartThesis {
  const supplement = buildTopicCalcSupplement({
    structured,
    question_category,
    as_of,
    timezone: "Asia/Shanghai",
  });
  const feed = buildThesisCalcFeed(structured, {
    as_of,
    timezone: "Asia/Shanghai",
    question_category,
    supplement,
  });
  return buildJudgmentCoreFromFeed(feed, {
    as_of_day: asOfDayUtc(as_of),
    question_category,
  });
}

function dumpThesis(name: string, structured: ProfileStructured): void {
  const frozen = buildFrozen(structured, AS_OF_A, "career");
  const thesisA = applyAgendaDepth(frozen, AGENDA_A);
  const thesisB = applyAgendaDepth(frozen, AGENDA_B);

  assert.equal(
    basisFingerprint(thesisA),
    basisFingerprint(thesisB),
    `${name}: classical facts must not change across agendas`,
  );

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
  console.log(
    `fingerprint=${frozen.structured_fingerprint} · as_of_day=${frozen.as_of_day} · category=${frozen.question_category}`,
  );
  console.log(
    `cache_key=${deliveryChartThesisRuntimeCacheKey({
      structured_fingerprint: frozen.structured_fingerprint,
      as_of_day: frozen.as_of_day ?? "-",
      question_category: frozen.question_category,
    })}`,
  );
  console.log(
    `NOTE: climate_balance is a STUB (no 燥湿 engine) — always ○ 未见相关特征, not a true calc negative.`,
  );
  console.log(
    `agenda A depth map: ${thesisA.dimensions.map((d) => `${d.dimension_id}:${d.depth}`).join(" · ")}`,
  );
  console.log(
    `agenda B depth map: ${thesisB.dimensions.map((d) => `${d.dimension_id}:${d.depth}`).join(" · ")}`,
  );

  console.log("\n--- FROZEN CORE (judgment before agenda depth) ---");
  for (const dim of frozen.dimensions) {
    console.log("------------------------------------------------------------");
    printDimBody(dim, "");
  }

  console.log("\n--- AGENDA A RENDER (eye-diff vs B) ---");
  console.log(`agenda text: ${AGENDA_A}`);
  for (const dim of thesisA.dimensions) {
    console.log("------------------------------------------------------------");
    printDimBody(dim, "");
  }

  console.log("\n--- AGENDA B RENDER (eye-diff vs A) ---");
  console.log(`agenda text: ${AGENDA_B}`);
  for (const dim of thesisB.dimensions) {
    console.log("------------------------------------------------------------");
    printDimBody(dim, "");
  }
}

function dumpAsOfSweep(structured: ProfileStructured): void {
  const tA = buildFrozen(structured, AS_OF_A, "career");
  const tB = buildFrozen(structured, AS_OF_B, "career");

  assert.equal(tA.structured_fingerprint, tB.structured_fingerprint);
  assert.notEqual(tA.as_of_day, tB.as_of_day, "as_of_day must differ across dates");

  const keyA = deliveryChartThesisRuntimeCacheKey({
    structured_fingerprint: tA.structured_fingerprint,
    as_of_day: tA.as_of_day!,
    question_category: tA.question_category,
  });
  const keyB = deliveryChartThesisRuntimeCacheKey({
    structured_fingerprint: tB.structured_fingerprint,
    as_of_day: tB.as_of_day!,
    question_category: tB.question_category,
  });
  assert.notEqual(keyA, keyB, "runtime cache keys must differ when as_of_day differs");

  const snapA = cycleRhythmSnapshot(tA);
  const snapB = cycleRhythmSnapshot(tB);
  assert.notEqual(
    snapA,
    snapB,
    "cycle_rhythm must change when as_of crosses liunian/dayun boundary",
  );

  const dimA = tA.dimensions.find((d) => d.dimension_id === "cycle_rhythm")!;
  const dimB = tB.dimensions.find((d) => d.dimension_id === "cycle_rhythm")!;

  console.log("\n============================================================");
  console.log("AS_OF SWEEP · same chart, two dates (cache / cycle_rhythm proof)");
  console.log(`structured_fingerprint=${tA.structured_fingerprint}`);
  console.log(`as_of_A=${AS_OF_A.toISOString()} → day=${tA.as_of_day}`);
  console.log(`as_of_B=${AS_OF_B.toISOString()} → day=${tB.as_of_day}`);
  console.log(`cache_key_A=${keyA}`);
  console.log(`cache_key_B=${keyB}`);
  console.log("------------------------------------------------------------");
  console.log(`cycle_rhythm @ ${tA.as_of_day}:`);
  printDimBody(dimA, "  ");
  console.log("------------------------------------------------------------");
  console.log(`cycle_rhythm @ ${tB.as_of_day}:`);
  printDimBody(dimB, "  ");
  console.log("------------------------------------------------------------");
  console.log(
    "as_of sweep OK: cycle_rhythm changed + cache keys differ (structured-only key would have been unsafe).",
  );
}

dumpThesis("STRONG · 乙木偏强", STRUCTURED_STRONG);
dumpThesis("WEAK · 丁火偏弱", STRUCTURED_WEAK);
dumpThesis("BALANCED · 庚金均衡", STRUCTURED_BALANCED);

dumpAsOfSweep(STRUCTURED_STRONG);

{
  const t = buildChartThesisFromStructured(STRUCTURED_STRONG, "创业赚钱", {
    as_of: AS_OF_A,
    question_category: "career",
  });
  assert.ok(t.dimensions.length >= 6);
  assert.equal(t.as_of_day, asOfDayUtc(AS_OF_A));
  console.log("\ncompose path ok · dims=", t.dimensions.length, "· as_of_day=", t.as_of_day);
}

console.log("\ninspect-chart-thesis: structural checks passed (review lines above by eye).");
