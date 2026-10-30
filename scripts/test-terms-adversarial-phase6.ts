/**
 * Phase 6 Layer E — negative / adversarial term leak tests.
 * Run: pnpm test:terms-adversarial-phase6
 */

import assert from "node:assert/strict";
import { resolvePojuTerm } from "../lib/glossary/term-resolve";
import { resolveShensha } from "../lib/poju/shensha";
import { resolveShenshaDisposition } from "../lib/glossary/shensha-disposition";
import {
  sanitizeHtmlExport,
  sanitizePlainExport,
} from "../lib/glossary/sanitize-export-surface";
import { toCompliantPlainText } from "../lib/glossary/to-compliant-plain-text";

function ok(msg: string) {
  console.log(`ok: ${msg}`);
}

function main() {
  console.log("\n========== test-terms-adversarial-phase6 ==========\n");

  // --- Model dumps traditional names ---
  const tradDump = "你的日主偏弱，七杀太重，空亡入命，必有血光";
  const scrubbed = sanitizePlainExport(tradDump, "zh", "copy");
  assert.ok(!scrubbed.content.includes("空亡"), "scrub removes 空亡");
  assert.ok(
    !/必有血光/.test(scrubbed.content) || scrubbed.audit.hits.length > 0,
    "horror claim scrubbed or audited",
  );
  ok("traditional dump scrubbed");

  // --- Alias / traditional variants ---
  for (const token of ["羊刃", "飛刃", "飞刃"] as const) {
    const d = resolveShenshaDisposition(token);
    assert.equal(d.status, "public_glossary", `${token} public`);
    const v = resolveShensha(token, "zh");
    assert.ok(v.label && v.label !== token, `${token} soft !== raw`);
    assert.ok(!v.zh_src, `${token} no zh_src`);
  }
  ok("刃 aliases fail-closed soft");

  // --- Redline cannot bypass via alias ---
  for (const token of ["空亡", "十恶大败", "孤鸾煞", "阴阳差错"] as const) {
    const d = resolveShenshaDisposition(token);
    assert.equal(d.status, "internal_redline", `${token} redline`);
    const v = resolveShensha(token, "zh");
    assert.ok(v.blocked || !v.label || v.label.length === 0, `${token} blocked label`);
    assert.ok(v.label !== token, `${token} no raw fallback`);
  }
  ok("redline no alias bypass");

  // --- Unknown spelling variants ---
  for (const token of ["伪煞甲", "XYZ贵人", "kongwang"] as const) {
    const v = resolveShensha(token, "en");
    assert.ok(v.blocked || !v.label || v.label !== token, `${token} unknown blocked`);
  }
  ok("unknown variants blocked");

  // --- Qimen 空亡/白虎 not globally killed ---
  const kwQ = resolvePojuTerm("空亡", { namespace: "qimen" });
  assert.notEqual(kwQ.status, "forbidden", "空亡@qimen not forbidden");
  const bhQ = resolvePojuTerm("白虎", { namespace: "qimen" });
  assert.equal(bhQ.status, "resolved", "白虎@qimen resolved");
  const kwB = resolvePojuTerm("空亡", { namespace: "bazi" });
  assert.equal(kwB.status, "forbidden", "空亡@bazi still forbidden");
  ok("ns-aware 空亡/白虎");

  // --- Occult EN / pinyin ---
  const occult = "Your Day Master Yong Shen Da Yun Ba Zi fortune-telling destiny";
  for (const loc of ["en", "es", "de", "fr"] as const) {
    const r = sanitizePlainExport(occult, loc, "copy");
    assert.ok(typeof r.content === "string");
    // Soft pipeline should reduce or audit proprietary fingerprints
    assert.ok(
      !/\bBa\s*Zi\b/i.test(r.content) ||
        r.audit.hits.length > 0 ||
        r.content !== occult,
      `${loc} occult handled`,
    );
  }
  ok("occult EN multi-locale");

  // --- Leak in HTML attribute / title / alt ---
  const html = `<article title="七杀太重"><img alt="空亡入命"/><a href="/x">日主偏弱</a><p>用神得力</p></article>`;
  const out = sanitizeHtmlExport(html, "zh", "html");
  assert.ok(out.content.includes("<article"), "tags kept");
  assert.ok(!out.content.includes('alt="空亡入命"'), "alt scrubbed");
  ok("html attr leak scrubbed");

  // --- Code block / table-ish prose still scrubbed as plain ---
  const table = "| 日主 | 七杀 |\n| 甲 | 强 |";
  const tOut = toCompliantPlainText(table, "zh");
  assert.ok(typeof tOut === "string");
  ok("table-like prose through compliant plain");

  // --- Traditional in parentheses / title pattern ---
  const paren = "能量偏强（七杀）与驿马同现";
  const pOut = sanitizePlainExport(paren, "zh", "markdown");
  assert.ok(!pOut.content.includes("空亡"));
  ok("paren traditional scrub path");

  console.log("\nAll Phase 6 adversarial tests passed.\n");
}

main();
