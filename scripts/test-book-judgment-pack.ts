/**
 * BookJudgmentPack · quota reverse + dual-track + density + segment gate.
 * Run: pnpm exec tsx scripts/test-book-judgment-pack.ts
 */
import assert from "node:assert/strict";
import type { BirthInfo } from "../lib/profile/types";
import { isBookJudgmentPackEnabled } from "../lib/llm/pro/delivery/book-judgment/flag";
import {
  BOOK_FACE_IDS,
  BOOK_JUDGMENT_PACK_VERSION,
  indexBookJudgmentByFace,
  isWeakScienceAnchor,
  softRepairFaceDualTrack,
  validateBookJudgmentPack,
  type BookJudgmentPack,
  type BookJudgmentSegmentId,
  type BookJudgmentUnit,
} from "../lib/llm/pro/delivery/book-judgment/schema";
import {
  buildBookJudgmentQuotaFromBlueprint,
  formatQuotaTableForPrompt,
} from "../lib/llm/pro/delivery/book-judgment/quota-from-blueprint";
import {
  deepEvidencePlanFromBookPack,
  sliceBookJudgmentForFace,
  bookJudgmentTraceSummary,
} from "../lib/llm/pro/delivery/book-judgment/slice";
import { hashChartFactPackText, hashZiweiFactPack } from "../lib/llm/pro/delivery/book-judgment/hash";
import { buildZiweiFactPack } from "../lib/ziwei/fact-pack";
import {
  buildLabStepDefsV3,
  labStepDefsV3,
} from "../lib/llm/pro/delivery/lab/types-v3";

const GOLDEN_BIRTH: BirthInfo = {
  year: 2000,
  month: 8,
  day: 16,
  hour: 4,
  minute: 30,
  hour_period: "yin",
  gender: "F",
  timezone: "Asia/Shanghai",
};

const ziwei = buildZiweiFactPack(GOLDEN_BIRTH, { asOf: "2026-10-27" });
assert.ok(ziwei.patternHits.length > 0, "golden patternHits");

const chartText = [
  "日主：庚金",
  "用神：木",
  "喜神：水",
  "忌神：金土",
  "当前大运：甲申",
].join("\n");

const quota = buildBookJudgmentQuotaFromBlueprint();

/** Quota table from blueprint covers all faces + segment slots */
{
  assert.ok(quota.total_min_units >= 24, `total_min=${quota.total_min_units}`);
  assert.equal(quota.faces.length, BOOK_FACE_IDS.length);
  for (const face of BOOK_FACE_IDS) {
    const row = quota.faces.find((f) => f.faceId === face);
    assert.ok(row, `quota face ${face}`);
    assert.ok(row!.min_units >= 3, `${face} min_units`);
    assert.ok(row!.segment_slots.length >= 1, `${face} segments`);
    assert.ok(
      row!.segment_slots.some((s) => s.needs_unit),
      `${face} needs_unit slot`,
    );
  }
  const prompt = formatQuotaTableForPrompt(quota);
  assert.match(prompt, /批断配额表/);
  assert.match(prompt, /Face 04/);
  assert.match(prompt, /Face 02/);
}

function unit(
  partial: Omit<BookJudgmentUnit, "serves_face"> & {
    serves_face?: BookJudgmentUnit["serves_face"];
  },
): BookJudgmentUnit {
  return {
    serves_face: partial.serves_face ?? ["01"],
    ...partial,
  };
}

/** Dense dual-track covering pack (meets per-face + total quota). */
function coveringUnits(): BookJudgmentUnit[] {
  const pattern = ziwei.patternHits[0]!.name;
  const units: BookJudgmentUnit[] = [];
  for (const face of BOOK_FACE_IDS) {
    const faceQuota = quota.faces.find((f) => f.faceId === face)!;
    const needed = faceQuota.segment_slots.filter((s) => s.needs_unit);
    const slots =
      needed.length >= faceQuota.min_units
        ? needed
        : [
            ...needed,
            ...Array.from({ length: faceQuota.min_units - needed.length }, (_, i) => ({
              segmentId: (["A", "B", "C", "D", "E"] as BookJudgmentSegmentId[])[
                Math.min(i, 4)
              ]!,
              preferred_track: "any" as const,
            })),
          ];
    for (let i = 0; i < faceQuota.min_units; i++) {
      const slot = slots[i] ?? slots[0]!;
      const pref = "preferred_track" in slot ? slot.preferred_track : "any";
      const track =
        pref === "science"
          ? "science"
          : pref === "convergence"
            ? "convergence"
            : pref === "destiny"
              ? "destiny"
              : i % 3 === 1
                ? "science"
                : i % 3 === 2
                  ? "convergence"
                  : "destiny";
      units.push(
        unit({
          id: `${track[0]}_${face}_${i}`,
          track,
          serves_face: [face],
          serves_segment: slot.segmentId,
          claim: `${face}${slot.segmentId} ${track}：配额反推批断`,
          anchors:
            track === "science"
              ? ["cognitive_load", "decision_hygiene"]
              : [pattern, "用神木"],
        }),
      );
    }
  }
  return units;
}

function basePack(over: Partial<BookJudgmentPack> = {}): BookJudgmentPack {
  const units = coveringUnits();
  return {
    version: BOOK_JUDGMENT_PACK_VERSION,
    locale: "zh",
    thesis_ref: "thesis_v1",
    cfp_hash: hashChartFactPackText(chartText),
    zfp_hash: hashZiweiFactPack(ziwei),
    zfpOmitted: false,
    shot_mode: "one",
    created_at: new Date().toISOString(),
    units,
    by_face: indexBookJudgmentByFace(units),
    pattern_hits_used: [ziwei.patternHits[0]!.name],
    science_tags_used: ["cognitive_load"],
    ...over,
  };
}

/** PASS dense dual-track */
{
  const pack = basePack();
  assert.ok(pack.units.length >= quota.total_min_units, `n=${pack.units.length}`);
  const v = validateBookJudgmentPack(pack, quota);
  assert.equal(v.ok, true, v.ok ? "" : `${v.reason}:${v.detail}`);
  if (v.ok) {
    const sum = bookJudgmentTraceSummary(v.pack, {
      quota,
      pattern_hits_available: ziwei.patternHits.map((h) => h.name),
    });
    assert.equal(sum.shot_mode, "one");
    assert.ok(sum.unit_counts.destiny >= 8);
    assert.ok(sum.unit_counts.science >= 8);
    assert.equal(sum.under_density, false);
    assert.ok(sum.face_matrix.every((r) => !r.missing_science));
    assert.ok(sum.face_matrix.every((r) => !r.under_density));
    /** face_matrix exclusive tracks must match JSON unit.track（d+s+c === face total） */
    for (const row of sum.face_matrix) {
      assert.equal(
        row.destiny + row.science + row.convergence,
        row.total,
        `face ${row.faceId} track sum`,
      );
    }
    assert.equal(sum.unit_counts.total, pack.units.length);
  }
}

/** FAIL missing science track (book-level) */
{
  const units = BOOK_FACE_IDS.flatMap((face) => [
    unit({
      id: `only_d_${face}`,
      track: "destiny",
      serves_face: [face],
      serves_segment: "A",
      claim: "只有命理",
      anchors: ["用神木"],
    }),
    unit({
      id: `only_d2_${face}`,
      track: "destiny",
      serves_face: [face],
      serves_segment: "B",
      claim: "仍只有命理",
      anchors: ["大运甲申"],
    }),
    unit({
      id: `only_d3_${face}`,
      track: "destiny",
      serves_face: [face],
      serves_segment: "C",
      claim: "第三命理",
      anchors: [ziwei.patternHits[0]!.name],
    }),
  ]);
  const v = validateBookJudgmentPack(
    basePack({
      units,
      by_face: indexBookJudgmentByFace(units),
      pattern_hits_used: [ziwei.patternHits[0]!.name],
    }),
    quota,
  );
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, "missing_science_track");
}

/** FAIL face 04 missing science (density ok, dual-track broken on 04) */
{
  const pattern = ziwei.patternHits[0]!.name;
  const units = coveringUnits().filter((u) => !u.serves_face.includes("04"));
  const face04Quota = quota.faces.find((f) => f.faceId === "04")!;
  for (let i = 0; i < face04Quota.min_units; i++) {
    units.push(
      unit({
        id: `d_only_04_${i}`,
        track: "destiny",
        serves_face: ["04"],
        serves_segment: (["A", "B", "C", "D"] as BookJudgmentSegmentId[])[i] ?? "A",
        claim: `04 纯命理 ${i}`,
        anchors: [pattern, "用神木"],
      }),
    );
  }
  assert.ok(
    !units.some(
      (u) =>
        u.serves_face.includes("04") &&
        (u.track === "science" || u.track === "convergence"),
    ),
  );
  const v = validateBookJudgmentPack(
    basePack({
      units,
      by_face: indexBookJudgmentByFace(units),
      pattern_hits_used: [pattern],
    }),
    quota,
  );
  assert.equal(v.ok, false, v.ok ? "expected fail" : "");
  if (!v.ok) {
    assert.equal(v.reason, "face_missing_science");
    assert.match(v.detail ?? "", /04/);
  }
}

/** FAIL under_density */
{
  const thin = coveringUnits().slice(0, 10);
  const v = validateBookJudgmentPack(
    basePack({
      units: thin,
      by_face: indexBookJudgmentByFace(thin),
    }),
    quota,
  );
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, "under_density");
}

/** FAIL means_prescription · 语义类 + unit id/类名进 detail */
{
  const cases = [
    "宜以客位进取开创",
    "不宜在主业外摊开试点",
    "宜用低承诺交换，把样品拿给人用",
    "固定4小时块做验证，宜退回观察",
    "两周内递给三个人用并回收反馈",
    "红灯信号：四小时完整块连续被侵蚀、熟人只给反馈不付费",
    "红灯信号：出现以不完美搁置进度",
    "近步原则是停在可逆、可收费验证的最小样，能直接使用的小成品",
    "做一个低承诺小样验证再开口",
    "四小时完整块被打断就停下并退回",
    "不把试点摊成四周任务",
    "下一步动作类型是只做不离开主业的轻量推进",
  ];
  const sci = coveringUnits().find((u) => u.track === "science");
  assert.ok(sci, "need science unit");
  for (const rx of cases) {
    const units = coveringUnits().map((u) =>
      u.id === sci!.id ? { ...u, claim: rx } : u,
    );
    const v = validateBookJudgmentPack(
      basePack({
        units,
        by_face: indexBookJudgmentByFace(units),
      }),
      quota,
    );
    assert.equal(
      v.ok,
      false,
      `expected FAIL for「${rx.slice(0, 36)}」 got ${v.ok ? "PASS" : v.reason}`,
    );
    if (!v.ok) {
      assert.equal(v.reason, "means_prescription");
      assert.match(v.detail ?? "", new RegExp(sci!.id));
      assert.match(v.detail ?? "", /@science\//);
    }
  }
  /** destiny / convergence 同开；多条命中时 detail 列 unit id */
  const destiny = coveringUnits().find((u) => u.track === "destiny");
  const conv = coveringUnits().find((u) => u.track === "convergence");
  assert.ok(destiny && conv);
  const multi = coveringUnits().map((u) => {
    if (u.id === destiny!.id) {
      return { ...u, claim: "做一个低承诺小样验证再看格局" };
    }
    if (u.id === conv!.id) {
      return { ...u, claim: "下一步动作：轻量推进可核对" };
    }
    if (u.id === sci!.id) {
      return { ...u, claim: "不宜把样板扩成四周任务" };
    }
    return u;
  });
  const mv = validateBookJudgmentPack(
    basePack({ units: multi, by_face: indexBookJudgmentByFace(multi) }),
    quota,
  );
  assert.equal(mv.ok, false);
  if (!mv.ok) {
    assert.equal(mv.reason, "means_prescription");
    assert.match(mv.detail ?? "", /means_prescription ×/);
    assert.match(mv.detail ?? "", new RegExp(destiny!.id));
    assert.match(mv.detail ?? "", new RegExp(sci!.id));
  }
}

/** FAIL weak science anchor */
{
  assert.equal(isWeakScienceAnchor("科学维3"), true);
  assert.equal(isWeakScienceAnchor("科学维2/格局·十神主矛盾"), true);
  assert.equal(isWeakScienceAnchor("cognitive_load"), false);
  const units = coveringUnits();
  const sci = units.find((u) => u.track === "science");
  assert.ok(sci, "need a science unit");
  const poisoned = units.map((u) =>
    u.id === sci!.id ? { ...u, anchors: ["科学维2"] } : u,
  );
  const v = validateBookJudgmentPack(
    basePack({
      units: poisoned,
      by_face: indexBookJudgmentByFace(poisoned),
    }),
    quota,
  );
  assert.equal(v.ok, false, v.ok ? "expected weak_science_anchor fail" : "");
  if (!v.ok) assert.equal(v.reason, "weak_science_anchor");
}

/** FAIL zfpOmitted=false without pattern_hits_used */
{
  const v = validateBookJudgmentPack(
    basePack({ pattern_hits_used: [], zfpOmitted: false }),
    quota,
  );
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, "missing_pattern_hits");
}

/** FAIL empty face 02 (pad density on other faces) */
{
  const pattern = ziwei.patternHits[0]!.name;
  const units = coveringUnits().filter((u) => !u.serves_face.includes("02"));
  while (units.length < quota.total_min_units) {
    units.push(
      unit({
        id: `pad_${units.length}`,
        track: "destiny",
        serves_face: ["01"],
        serves_segment: "A",
        claim: "密度垫片",
        anchors: [pattern],
      }),
    );
  }
  const v = validateBookJudgmentPack(
    basePack({
      units,
      by_face: indexBookJudgmentByFace(units),
      pattern_hits_used: [pattern],
    }),
    quota,
  );
  assert.equal(v.ok, false);
  if (!v.ok) {
    assert.equal(v.reason, "empty_face");
    assert.match(v.detail ?? "", /02/);
  }
}

/** softRepair is noop (no forward-fill) */
{
  const thin = coveringUnits().filter((u) => u.id !== "s_04");
  const repaired = softRepairFaceDualTrack(thin);
  assert.equal(repaired.length, thin.length, "softRepair must not clone-fill");
}

/** slice + deepEvidencePlan */
{
  const v = validateBookJudgmentPack(basePack(), quota);
  assert.ok(v.ok);
  if (!v.ok) throw new Error("pack");
  const slice = sliceBookJudgmentForFace({
    pack: v.pack,
    faceId: "02",
    chartText,
    ziwei,
    question: "要不要换工作",
  });
  assert.ok(slice);
  assert.ok(slice!.units.length >= 2);
  assert.match(slice!.pack_block, /禁再发明批断/);
  assert.ok(slice!.fact_block);
  assert.match(slice!.fact_block!, /patternHits/);

  const plan = deepEvidencePlanFromBookPack(v.pack, "02");
  assert.ok(plan?.units.length);
}

/** Flag + step table */
{
  assert.equal(isBookJudgmentPackEnabled({} as unknown as NodeJS.ProcessEnv), true);
  assert.equal(
    isBookJudgmentPackEnabled({ BOOK_JUDGMENT_PACK: "0" } as unknown as NodeJS.ProcessEnv),
    false,
  );
  const packSteps = buildLabStepDefsV3({ bookJudgmentPack: true });
  const legacySteps = buildLabStepDefsV3({ bookJudgmentPack: false });
  assert.ok(packSteps.some((d) => d.step_key === "book.judgment"));
  assert.ok(!packSteps.some((d) => d.kind === "content_judgment"));
  assert.ok(legacySteps.some((d) => d.kind === "content_judgment"));
  const viaEnvOff = labStepDefsV3({
    BOOK_JUDGMENT_PACK: "0",
  } as unknown as NodeJS.ProcessEnv);
  assert.ok(viaEnvOff.some((d) => d.kind === "content_judgment"));
}

console.log("book-judgment-pack ok", {
  faces: BOOK_FACE_IDS.length,
  total_min: quota.total_min_units,
  pattern: ziwei.patternHits[0]?.name,
  dense_units: coveringUnits().length,
});
