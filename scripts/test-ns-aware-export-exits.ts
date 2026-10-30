/**
 * P1 — namespace-aware export exits: qimen 空亡/白虎 must soft-map, not hard-delete.
 *
 * Surfaces: plain / markdown / html / email / copy / pdf + delivery sanitize path.
 * Run: pnpm test:ns-aware-export-exits
 */

import assert from "node:assert/strict";
import { resolvePojuTerm } from "../lib/glossary/term-resolve";
import {
  crossNsSoftPreserveHans,
  softMapCrossNsForbiddenHans,
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

function main() {
  console.log("\n========== test-ns-aware-export-exits (P1) ==========\n");

  // Resolver still ns-correct
  assert.equal(resolvePojuTerm("空亡", { namespace: "bazi" }).status, "forbidden");
  assert.equal(resolvePojuTerm("空亡", { namespace: "qimen" }).status, "resolved");
  assert.equal(resolvePojuTerm("白虎", { namespace: "bazi" }).status, "forbidden");
  assert.equal(resolvePojuTerm("白虎", { namespace: "qimen" }).status, "resolved");
  ok("resolver ns split intact");

  const preserve = crossNsSoftPreserveHans();
  assert.ok(preserve.some((h) => h.includes("空亡") || h === "空亡"));
  assert.ok(preserve.some((h) => h.includes("白虎") || h === "白虎"));
  ok("cross-ns preserve includes 空亡/白虎");

  const softZh = softMapCrossNsForbiddenHans(
    "奇门提示：本宫空亡，值使遇白虎。",
    "zh",
  );
  assert.ok(!softZh.text.includes("空亡"), "no traditional 空亡");
  assert.ok(!softZh.text.includes("白虎"), "no traditional 白虎");
  assert.ok(softZh.text.includes(termOf("qm_coverage_gap", "zh")!), "空亡→覆盖缺口");
  assert.ok(softZh.text.includes(termOf("qm_bai_hu", "zh")!), "白虎→冲击");
  ok("soft-map zh preserves qimen meaning");

  // Hard strip must not erase soft-mapped meaning
  const stripped = stripRedlineShenshaFromText(
    "奇门：空亡与白虎；八字恐吓：童子煞。",
    "zh",
  );
  assert.ok(stripped.includes("覆盖缺口") && stripped.includes("冲击"), "qimen soft kept");
  assert.ok(!stripped.includes("童子煞"), "pure bazi redline removed");
  assert.ok(!stripped.includes("空亡") && !stripped.includes("白虎"), "no traditional leak");
  ok("stripRedline ns-aware");

  const forbiddenPath = stripForbiddenShenSha(
    "报告见空亡、白虎，另有十恶大败。",
    "zh",
  );
  assert.ok(forbiddenPath.includes("覆盖缺口") && forbiddenPath.includes("冲击"));
  assert.ok(!forbiddenPath.includes("十恶大败"));
  ok("stripForbiddenShenSha ns-aware");

  const delivery = sanitizePaymentAuditLeaks(
    "局势：空亡宫位有白虎压力；禁写童子煞恐吓。",
    "zh",
  );
  assert.ok(delivery.includes("覆盖缺口") || delivery.includes("冲击"), "delivery keeps soft");
  assert.ok(!delivery.includes("空亡") && !delivery.includes("白虎"));
  assert.ok(!delivery.includes("童子煞"));
  ok("sanitizePaymentAuditLeaks path");

  const surfaces: ExportSurfaceKind[] = [
    "plain",
    "markdown",
    "html",
    "email",
    "copy",
    "pdf",
  ];
  const fixture = "Qimen cell notes 空亡 and 白虎; ban 童子煞 scare.";
  for (const surface of surfaces) {
    const content =
      surface === "html" || surface === "email"
        ? `<p title="空亡">${fixture}</p><img alt="白虎"/>`
        : fixture;
    const r = sanitizeExportSurface({ content, locale: "zh", surface });
    assert.ok(!r.content.includes("空亡"), `${surface}: no 空亡`);
    assert.ok(!r.content.includes("白虎"), `${surface}: no 白虎`);
    assert.ok(
      r.content.includes("覆盖缺口") || r.content.includes("冲击"),
      `${surface}: soft preserved`,
    );
    assert.ok(!r.content.includes("童子煞"), `${surface}: pure redline gone`);
  }
  ok("all export surfaces ns-aware");

  // Multi-locale soft preserve (en soft labels)
  for (const loc of ["en", "es", "de", "fr"] as const) {
    const r = sanitizePlainExport("结构见空亡与白虎", loc, "copy");
    assert.ok(!r.content.includes("空亡") && !r.content.includes("白虎"), `${loc} no han`);
    const gap = termOf("qm_coverage_gap", loc)!;
    const tiger = termOf("qm_bai_hu", loc)!;
    assert.ok(
      r.content.includes(gap) || r.content.includes(tiger),
      `${loc} soft present`,
    );
  }
  ok("multi-locale soft preserve");

  // HTML attributes
  const html = sanitizeHtmlExport(
    `<section title="空亡"><a href="/x">白虎</a><p>童子煞</p></section>`,
    "zh",
    "html",
  );
  assert.ok(!html.content.includes("空亡"));
  assert.ok(!html.content.includes('title="空亡"'));
  assert.ok(html.content.includes("覆盖缺口") || html.content.includes("冲击"));
  assert.ok(!html.content.includes("童子煞"));
  ok("html attr/text nodes");

  // Companion day HTML exit
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
  const dayHtml = buildCompanionDayHtml({ job, dayIndex: 0, cards });
  assert.ok(!dayHtml.includes("空亡"), "day-html no 空亡");
  assert.ok(!dayHtml.includes("白虎"), "day-html no 白虎");
  assert.ok(!dayHtml.includes("童子煞"), "day-html no 童子煞");
  assert.ok(
    dayHtml.includes("覆盖缺口") || dayHtml.includes("冲击"),
    "day-html soft kept",
  );
  ok("companion day-html exit");

  console.log("\nAll P1 ns-aware export exit tests passed.\n");
}

main();
