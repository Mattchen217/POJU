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

  console.log("\nAll P1 ns-aware export exit tests passed.\n");
}

main();
