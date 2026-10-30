/**
 * P1 fix — namespace-aware export exits (confirmed ns only; bare fail-closed).
 *
 * Surfaces: plain / markdown / html / email / copy / pdf / push + delivery + companion.
 * Run: pnpm test:ns-aware-export-exits
 */

import assert from "node:assert/strict";
import { resolvePojuTerm } from "../lib/glossary/term-resolve";
import {
  crossNsSoftPreserveHans,
  maySoftMapCrossNsToQimen,
  sanitizeCrossNsMarkers,
  softMapConfirmedCrossNsHans,
  type ConfirmedTermRef,
} from "../lib/glossary/ns-aware-surface-sanitize";
import {
  sanitizeExportSurface,
  sanitizeHtmlExport,
  sanitizePlainExport,
  type ExportSurfaceKind,
} from "../lib/glossary/sanitize-export-surface";
import { stripRedlineShenshaFromText } from "../lib/poju/shensha";
import { stripForbiddenShenSha } from "../lib/llm/sanitize/term-marking";
import { sanitizePaymentAuditLeaks } from "../lib/llm/sanitize/compliance-terms";
import { buildCompanionDayHtml } from "../lib/companion/day-html";
import {
  buildReminderDayOfflineHtml,
  buildReminderPackOfflineHtml,
} from "../lib/companion/reminder-day-offline-html";
import type { CompanionDayCards, CompanionJob } from "../lib/companion/types";
import { termOf } from "../lib/glossary/pojulife-terms";

function ok(msg: string) {
  console.log(`ok: ${msg}`);
}

const QIMEN_CONFIRMED: ConfirmedTermRef[] = [
  { traditional: "空亡", namespace: "qimen", slug: "qm_coverage_gap" },
  { traditional: "白虎", namespace: "qimen", slug: "qm_bai_hu" },
];

const BAZI_CONFIRMED: ConfirmedTermRef[] = [
  { traditional: "空亡", namespace: "bazi" },
  { traditional: "白虎", namespace: "bazi" },
];

const MIXED_CONFIRMED: ConfirmedTermRef[] = [...BAZI_CONFIRMED, ...QIMEN_CONFIRMED];

const LOCALES = ["zh", "en", "es", "de", "fr"] as const;
const SURFACES: ExportSurfaceKind[] = [
  "plain",
  "markdown",
  "html",
  "email",
  "copy",
  "pdf",
  "push",
];

function main() {
  console.log("\n========== test-ns-aware-export-exits (P1 fix) ==========\n");

  assert.equal(resolvePojuTerm("空亡", { namespace: "bazi" }).status, "forbidden");
  assert.equal(resolvePojuTerm("空亡", { namespace: "qimen" }).status, "resolved");
  assert.equal(resolvePojuTerm("白虎", { namespace: "bazi" }).status, "forbidden");
  assert.equal(resolvePojuTerm("白虎", { namespace: "qimen" }).status, "resolved");
  ok("resolver ns split intact");

  const preserve = crossNsSoftPreserveHans();
  assert.ok(preserve.some((h) => h === "空亡" || h.includes("空亡")));
  assert.ok(preserve.some((h) => h === "白虎" || h.includes("白虎")));
  ok("cross-ns registry includes 空亡/白虎");

  assert.equal(maySoftMapCrossNsToQimen("空亡"), false, "bare → no soft-map");
  assert.equal(maySoftMapCrossNsToQimen("空亡", { confirmed: BAZI_CONFIRMED }), false);
  assert.equal(maySoftMapCrossNsToQimen("空亡", { confirmed: QIMEN_CONFIRMED }), true);
  assert.equal(maySoftMapCrossNsToQimen("空亡", { confirmed: MIXED_CONFIRMED }), false);
  ok("maySoftMap gates on confirmed ns");

  // --- bazi confirmed: hard strip, never qimen soft ---
  {
    const r = softMapConfirmedCrossNsHans("八字见空亡与白虎", "zh", {
      confirmed: BAZI_CONFIRMED,
    });
    assert.equal(r.replacements.length, 0, "bazi confirmed → no soft-map");
    const stripped = stripRedlineShenshaFromText(r.text, "zh", { confirmed: BAZI_CONFIRMED });
    assert.ok(!stripped.includes("空亡") && !stripped.includes("白虎"));
    assert.ok(!stripped.includes(termOf("qm_coverage_gap", "zh")!));
    assert.ok(!stripped.includes(termOf("qm_bai_hu", "zh")!));
    ok("bazi 空亡/白虎 hard-strip (no qimen soft)");
  }

  // --- qimen confirmed: soft-map ---
  {
    const softZh = softMapConfirmedCrossNsHans(
      "奇门提示：本宫空亡，值使遇白虎。",
      "zh",
      { confirmed: QIMEN_CONFIRMED },
    );
    assert.ok(!softZh.text.includes("空亡"));
    assert.ok(!softZh.text.includes("白虎"));
    assert.ok(softZh.text.includes(termOf("qm_coverage_gap", "zh")!));
    assert.ok(softZh.text.includes(termOf("qm_bai_hu", "zh")!));
    ok("qimen 空亡→覆盖缺口 / 白虎→冲击");
  }

  // --- bare: fail-closed strip ---
  {
    const bare = stripRedlineShenshaFromText("裸词空亡与白虎无来源", "zh");
    assert.ok(!bare.includes("空亡") && !bare.includes("白虎"));
    assert.ok(!bare.includes("覆盖缺口") && !bare.includes("冲击"));
    const mapped = softMapConfirmedCrossNsHans("裸词空亡", "zh");
    assert.equal(mapped.replacements.length, 0);
    ok("bare 空亡/白虎 fail-closed (strip, no soft)");
  }

  // --- mixed confirmed: bare fail-closed (must use markers for qimen) ---
  {
    const mixed = stripRedlineShenshaFromText(
      "混合报告：bazi空亡；qimen也写空亡与白虎",
      "zh",
      { confirmed: MIXED_CONFIRMED },
    );
    assert.ok(!mixed.includes("空亡") && !mixed.includes("白虎"));
    assert.ok(!mixed.includes("覆盖缺口"), "ambiguous bare must not invent qimen soft");
    ok("mixed ns confirmed → bare fail-closed");
  }

  // --- pure redline 童子煞 ---
  {
    const t = stripRedlineShenshaFromText(
      "奇门：空亡与白虎；八字恐吓：童子煞。",
      "zh",
      { confirmed: QIMEN_CONFIRMED },
    );
    assert.ok(t.includes("覆盖缺口") && t.includes("冲击"));
    assert.ok(!t.includes("童子煞"));
    assert.ok(!t.includes("空亡") && !t.includes("白虎"));
    ok("童子煞 hard-strip; confirmed qimen soft kept");
  }

  {
    const forbiddenPath = stripForbiddenShenSha(
      "报告见空亡、白虎，另有十恶大败。",
      "zh",
      { confirmed: QIMEN_CONFIRMED },
    );
    assert.ok(forbiddenPath.includes("覆盖缺口") && forbiddenPath.includes("冲击"));
    assert.ok(!forbiddenPath.includes("十恶大败"));
    ok("stripForbiddenShenSha with qimen confirmed");
  }

  // Delivery path without confirmed → fail-closed (no false qimen soft)
  {
    const delivery = sanitizePaymentAuditLeaks(
      "局势：空亡宫位有白虎压力；禁写童子煞恐吓。",
      "zh",
    );
    assert.ok(!delivery.includes("空亡") && !delivery.includes("白虎"));
    assert.ok(!delivery.includes("童子煞"));
    assert.ok(
      !delivery.includes("覆盖缺口") && !delivery.includes("冲击"),
      "delivery must not invent qimen soft without confirmed",
    );
    ok("sanitizePaymentAuditLeaks fail-closed without confirmed");
  }

  // --- all surfaces × confirmed qimen ---
  const fixture = "Qimen cell notes 空亡 and 白虎; ban 童子煞 scare.";
  for (const surface of SURFACES) {
    const content =
      surface === "html" || surface === "email"
        ? `<p title="空亡">${fixture}</p><img alt="白虎"/>`
        : fixture;
    const r = sanitizeExportSurface({
      content,
      locale: "zh",
      surface,
      confirmed: QIMEN_CONFIRMED,
    });
    assert.ok(!r.content.includes("空亡"), `${surface}: no 空亡`);
    assert.ok(!r.content.includes("白虎"), `${surface}: no 白虎`);
    assert.ok(
      r.content.includes("覆盖缺口") || r.content.includes("冲击"),
      `${surface}: soft preserved`,
    );
    assert.ok(!r.content.includes("童子煞"), `${surface}: pure redline gone`);
  }
  ok("all export surfaces with qimen confirmed");

  // --- surfaces × bare fail-closed ---
  for (const surface of SURFACES) {
    const r = sanitizeExportSurface({
      content: "bare 空亡 白虎 童子煞",
      locale: "zh",
      surface,
    });
    assert.ok(!r.content.includes("空亡") && !r.content.includes("白虎"));
    assert.ok(!r.content.includes("覆盖缺口") && !r.content.includes("冲击"));
    assert.ok(!r.content.includes("童子煞"));
  }
  ok("all surfaces bare fail-closed");

  // --- five locales ---
  for (const loc of LOCALES) {
    const gap = termOf("qm_coverage_gap", loc)!;
    const tiger = termOf("qm_bai_hu", loc)!;
    const withQ = sanitizePlainExport("结构见空亡与白虎", loc, "copy", {
      confirmed: QIMEN_CONFIRMED,
    });
    assert.ok(!withQ.content.includes("空亡") && !withQ.content.includes("白虎"), `${loc} qimen no han`);
    assert.ok(
      withQ.content.includes(gap) || withQ.content.includes(tiger),
      `${loc} qimen soft present`,
    );

    const withB = sanitizePlainExport("结构见空亡与白虎", loc, "pdf", {
      confirmed: BAZI_CONFIRMED,
    });
    assert.ok(!withB.content.includes("空亡") && !withB.content.includes("白虎"), `${loc} bazi stripped`);
    assert.ok(!withB.content.includes(gap) && !withB.content.includes(tiger), `${loc} bazi no qimen soft`);

    const bare = sanitizePlainExport("结构见空亡与白虎", loc, "push");
    assert.ok(!bare.content.includes("空亡") && !bare.content.includes(gap), `${loc} bare fail-closed`);
  }
  ok("zh/en/es/de/fr all paths");

  // HTML attrs
  {
    const html = sanitizeHtmlExport(
      `<section title="空亡"><a href="/x">白虎</a><p>童子煞</p></section>`,
      "zh",
      "html",
      { confirmed: QIMEN_CONFIRMED },
    );
    assert.ok(!html.content.includes("空亡"));
    assert.ok(html.content.includes("覆盖缺口") || html.content.includes("冲击"));
    assert.ok(!html.content.includes("童子煞"));
    ok("html attr/text nodes");
  }

  // Companion day HTML + email reminder path
  {
    const cards: CompanionDayCards = {
      today_is: "今日奇门结构含空亡信号",
      suitable: "观察白虎位的冲击节奏",
      unsuitable: "勿用童子煞恐吓叙事",
      suggestion: "按覆盖缺口调整信息边界",
      evidence: "锚：空亡 / 白虎",
    };
    const job = {
      brief: {
        locale: "zh",
        primary: { name: "主路" },
        backup: { name: "辅路" },
      },
      days: [{ date_key: "2026-10-30", day_index: 0 }],
    } as unknown as CompanionJob;

    const withQ = buildCompanionDayHtml({
      job,
      dayIndex: 0,
      cards,
      confirmedTerms: QIMEN_CONFIRMED,
    });
    assert.ok(!withQ.includes("空亡") && !withQ.includes("白虎"));
    assert.ok(!withQ.includes("童子煞"));
    assert.ok(withQ.includes("覆盖缺口") || withQ.includes("冲击"));
    ok("companion day-html qimen confirmed");

    const bareCompanion = buildCompanionDayHtml({ job, dayIndex: 0, cards });
    assert.ok(!bareCompanion.includes("空亡") && !bareCompanion.includes("白虎"));
    // Without confirmed, traditional stripped; may or may not keep pre-written 覆盖缺口 in suggestion
    assert.ok(!bareCompanion.includes("童子煞"));
    ok("companion day-html bare fail-closed on dual-ns");
  }

  // Mixed report: bazi section stripped, qimen section soft — via separate sanitize calls (real exit pattern)
  {
    const baziSection = sanitizePlainExport("八字提示空亡", "zh", "plain", {
      confirmed: BAZI_CONFIRMED,
    }).content;
    const qimenSection = sanitizePlainExport("奇门提示空亡与白虎", "zh", "plain", {
      confirmed: QIMEN_CONFIRMED,
    }).content;
    const report = `${baziSection}\n---\n${qimenSection}`;
    assert.ok(!report.includes("空亡") && !report.includes("白虎"));
    assert.ok(qimenSection.includes("覆盖缺口") || qimenSection.includes("冲击"));
    assert.ok(!baziSection.includes("覆盖缺口"));
    ok("mixed report: per-section ns handling");
  }

  // --- sourceId scoped confirmation (whole-doc qimen grant forbidden) ---
  {
    const scoped: ConfirmedTermRef[] = [
      { traditional: "空亡", namespace: "qimen", slug: "qm_coverage_gap", sourceId: "seg-qimen" },
      { traditional: "白虎", namespace: "qimen", slug: "qm_bai_hu", sourceId: "seg-qimen" },
      { traditional: "空亡", namespace: "bazi", sourceId: "seg-bazi" },
      { traditional: "白虎", namespace: "bazi", sourceId: "seg-bazi" },
    ];
    // Wrong: document-level confirmed without matching sourceId must NOT soft-map
    assert.equal(
      maySoftMapCrossNsToQimen("空亡", { confirmed: scoped }),
      false,
      "scoped rows require sourceId",
    );
    const wrongSeg = stripRedlineShenshaFromText("段落空亡白虎", "zh", {
      confirmed: scoped,
      sourceId: "seg-bazi",
    });
    assert.ok(!wrongSeg.includes("空亡") && !wrongSeg.includes("白虎"));
    assert.ok(!wrongSeg.includes("覆盖缺口"), "bazi segment must not get qimen soft");

    const rightSeg = stripRedlineShenshaFromText("段落空亡白虎", "zh", {
      confirmed: scoped,
      sourceId: "seg-qimen",
    });
    assert.ok(rightSeg.includes("覆盖缺口") && rightSeg.includes("冲击"));
    assert.ok(!rightSeg.includes("空亡") && !rightSeg.includes("白虎"));

    // Same document: two sections sanitized with their own sourceId
    const baziPart = sanitizePlainExport("八字段空亡", "zh", "plain", {
      confirmed: scoped,
      sourceId: "seg-bazi",
    }).content;
    const qimenPart = sanitizePlainExport("奇门段空亡白虎", "zh", "plain", {
      confirmed: scoped,
      sourceId: "seg-qimen",
    }).content;
    assert.ok(!baziPart.includes("覆盖缺口"));
    assert.ok(qimenPart.includes("覆盖缺口") || qimenPart.includes("冲击"));
    ok("sourceId-scoped confirmedTerms (no whole-doc grant)");
  }

  // --- ⟦t:⟧ marker / slug redline (bazi must not bypass) ---
  {
    const gapSoft = termOf("qm_coverage_gap", "zh")!;
    const tigerSoft = termOf("qm_bai_hu", "zh")!;

    // Valid qimen slug + matching traditional → soft
    const qmValid = sanitizeCrossNsMarkers(
      "奇门⟦t:qm_coverage_gap|空亡⟧遇⟦t:qm_bai_hu|白虎⟧",
      "zh",
    );
    assert.equal(qmValid.softMappedMarkers, 2);
    assert.equal(qmValid.strippedMarkers, 0);
    assert.ok(qmValid.text.includes(gapSoft) && qmValid.text.includes(tigerSoft));
    assert.ok(!qmValid.text.includes("空亡") && !qmValid.text.includes("白虎"));
    ok("valid qm slug + matching traditional → soft");

    // Unknown qm_* slug + dual-ns → hard strip (no traditional fallback)
    const qmUnknown = sanitizeCrossNsMarkers(
      "假⟦t:qm_not_registered_xxx|空亡⟧与⟦t:qm_also_fake|白虎⟧",
      "zh",
    );
    assert.ok(qmUnknown.strippedMarkers >= 2);
    assert.equal(qmUnknown.softMappedMarkers, 0);
    assert.ok(!qmUnknown.text.includes("空亡") && !qmUnknown.text.includes("白虎"));
    assert.ok(!qmUnknown.text.includes(gapSoft), "unknown slug must not soft via traditional");
    assert.ok(!qmUnknown.text.includes(tigerSoft));
    assert.ok(!qmUnknown.text.includes("⟦t:"));
    ok("unknown qm slug + dual-ns → hard strip (no trad fallback)");

    // Known qimen slug + mismatched dual-ns traditional → fail-closed
    const qmMismatch = sanitizeCrossNsMarkers(
      "错配⟦t:qm_coverage_gap|白虎⟧与⟦t:qm_bai_hu|空亡⟧",
      "zh",
    );
    assert.ok(qmMismatch.strippedMarkers >= 2);
    assert.equal(qmMismatch.softMappedMarkers, 0);
    assert.ok(!qmMismatch.text.includes("空亡") && !qmMismatch.text.includes("白虎"));
    assert.ok(!qmMismatch.text.includes(gapSoft) && !qmMismatch.text.includes(tigerSoft));
    ok("known qm slug + mismatched traditional → hard strip");

    // Non-qimen slug + dual-ns → hard strip
    const baziMarker = stripRedlineShenshaFromText(
      "依据⟦t:ss_fake|空亡⟧与⟦t:day_master|白虎⟧恐吓。",
      "zh",
    );
    assert.ok(!baziMarker.includes("空亡") && !baziMarker.includes("白虎"));
    assert.ok(!baziMarker.includes("⟦t:"), "bazi dual-ns markers stripped");
    assert.ok(!baziMarker.includes(gapSoft), "non-qm slug must not soft-map");
    ok("non-qm slug + dual-ns → hard strip");

    const mixedMarkers = stripRedlineShenshaFromText(
      "混⟦t:ss_x|空亡⟧与⟦t:qm_coverage_gap|空亡⟧",
      "zh",
    );
    assert.ok(!mixedMarkers.includes("⟦t:ss_x"));
    assert.ok(mixedMarkers.includes(gapSoft));
    assert.ok(!mixedMarkers.includes("空亡"));
    ok("marker mix: non-qm strip + valid qm soft");
  }

  // --- 30-day reminder offline pack: confirmedTerms path ---
  {
    const SRC = "reminder-qimen";
    const scopedQimen: ConfirmedTermRef[] = [
      { traditional: "空亡", namespace: "qimen", slug: "qm_coverage_gap", sourceId: SRC },
      { traditional: "白虎", namespace: "qimen", slug: "qm_bai_hu", sourceId: SRC },
    ];
    const cards: CompanionDayCards = {
      today_is: "今日结构含空亡",
      suitable: "白虎位宜缓",
      unsuitable: "勿写童子煞",
      suggestion: "跟覆盖缺口对齐边界",
      evidence: "空亡·白虎",
    };
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 30 + i));
      const date_key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return {
        day_index: i,
        date_key,
        status: i === 0 ? ("delivered" as const) : ("pending" as const),
        cards: i === 0 ? cards : null,
        error: null,
        generated_at: null,
        delivered_at: null,
        sent_at: null,
      };
    });
    const job = {
      brief: {
        locale: "zh",
        primary: { name: "主路" },
        backup: { name: "辅路" },
      },
      delivery_day_key: days[0]!.date_key,
      ends_day_key: days[29]!.date_key,
      days,
    } as unknown as CompanionJob;

    const dayHtml = buildReminderDayOfflineHtml({
      job,
      dayIndex: 0,
      cards,
      opts: { confirmedTerms: scopedQimen, termSourceId: SRC },
    });
    assert.ok(!dayHtml.includes("空亡") && !dayHtml.includes("白虎"));
    assert.ok(!dayHtml.includes("童子煞"));
    assert.ok(dayHtml.includes("覆盖缺口") || dayHtml.includes("冲击"));
    ok("reminder day offline HTML confirmedTerms path");

    const packHtml = buildReminderPackOfflineHtml(job, {
      confirmedTerms: scopedQimen,
      termSourceId: SRC,
    });
    assert.ok(packHtml.includes("30日提醒") || packHtml.includes("SLOT") || packHtml.length > 500);
    assert.ok(!packHtml.includes("童子煞"));
    // daysJson embeds sanitized card HTML
    assert.ok(
      packHtml.includes("覆盖缺口") || packHtml.includes("冲击"),
      "pack daysJson must carry soft labels from confirmed path",
    );
    assert.ok(!packHtml.includes("空亡"), "pack must not leak traditional 空亡");
    ok("reminder 30-day pack offline HTML confirmedTerms path");

    const packBare = buildReminderPackOfflineHtml(job, {});
    assert.ok(!packBare.includes("空亡"), "bare pack strips 空亡");
    assert.ok(!packBare.includes("白虎"), "bare pack strips 白虎");
    ok("reminder pack without confirmed fail-closed on dual-ns");
  }

  console.log("\nAll P1 ns-aware export exit tests passed.\n");
}

main();
