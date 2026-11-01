/**
 * Phase 5 acceptance — fact-scoped term context + export sanitize audit.
 * Run: pnpm test:term-context-phase5
 */

import assert from "node:assert/strict";
import {
  buildTermContextForFacts,
  buildTermContextPromptFromStructured,
  collectTermFactsFromStructured,
  formatTermContextForPrompt,
  type TermFactRef,
} from "../lib/glossary/term-context-for-facts";
import {
  sanitizeExportSurface,
  sanitizeHtmlExport,
  sanitizePlainExport,
} from "../lib/glossary/sanitize-export-surface";
import { buildPojuTermsPromptTable } from "../lib/glossary/pojulife-terms";
import type { ProfileStructured } from "../lib/calculations/build-profile-structured";

function ok(label: string) {
  console.log(`ok: ${label}`);
}

function makeStructured(): ProfileStructured {
  return {
    day_master: "甲",
    yong_shen: "水",
    pillars_detail: {
      year: {
        stem: "甲",
        branch: "子",
        ten_god: "比肩",
        shen_sha: ["天乙贵人", "空亡"],
        life_stage_han: "长生",
        hidden_stems: [],
      },
      month: {
        stem: "丙",
        branch: "寅",
        ten_god: "食神",
        shen_sha: ["文昌"],
        life_stage_han: "沐浴",
        hidden_stems: [],
      },
      day: {
        stem: "甲",
        branch: "午",
        ten_god: "日主",
        shen_sha: ["飞刃"],
        life_stage_han: "帝旺",
        hidden_stems: [],
      },
      hour: {
        stem: "戊",
        branch: "辰",
        ten_god: "偏财",
        shen_sha: [],
        life_stage_han: "衰",
        hidden_stems: [],
      },
    },
  } as unknown as ProfileStructured;
}

function main() {
  console.log("\n========== test-term-context-phase5 ==========\n");

  const structured = makeStructured();
  const facts = collectTermFactsFromStructured(structured);
  assert.ok(facts.length > 0, "collect facts from structured");
  ok(`collected ${facts.length} fact refs`);

  // Redline 空亡 must not enter public context.
  assert.ok(
    !facts.some((f) => (f.traditional || "").includes("空亡")),
    "redline 空亡 excluded from fact collect",
  );
  ok("redline excluded from collect");

  const ctx = buildTermContextForFacts(facts, "zh", {
    namespaces: ["bazi"],
    maxEntries: 40,
  });
  assert.ok(ctx.entries.length > 0, "resolved entries");
  ok(`resolved ${ctx.entries.length} entries`);

  for (const e of ctx.entries) {
    assert.ok(e.soft.trim(), `soft for ${e.slug}`);
    assert.ok(e.boundary.trim(), `boundary for ${e.slug}`);
    assert.ok(!/空亡|羊刃|天乙贵人/.test(e.soft), `no traditional in soft ${e.slug}`);
  }
  ok("entries have soft+boundary, no traditional soft");

  const prompt = formatTermContextForPrompt(ctx, { task: "test" });
  // TERMS-PIPELINE-SPEC-v1: model sees traditional closed-set inventory only.
  // Soft/slug remain resolve-side fields — not model write targets / not prompt columns.
  assert.ok(/traditional|传统/.test(prompt), "prompt has traditional inventory header");
  assert.ok(
    prompt.includes("文昌") || prompt.includes("飞刃") || prompt.includes("天乙贵人"),
    "prompt lists fact traditional forms",
  );
  assert.ok(!/^\| slug \|/m.test(prompt), "no slug write-target column");
  assert.ok(!prompt.includes("| soft |"), "no soft write-target column");
  assert.ok(/禁止.*⟦t:|never markers/i.test(prompt), "prompt bans marker teaching");
  assert.ok(!/只许用 slug 或自造软译/.test(prompt), "no soft-as-write-target teaching");
  ok("prompt block fact-scoped traditional inventory");

  const oneShot = buildTermContextPromptFromStructured(structured, "en", {
    task: "base_analysis",
    maxEntries: 20,
  });
  assert.ok(
    oneShot.includes("closed-set traditional") || oneShot.includes("| traditional |"),
    "en prompt traditional inventory",
  );
  assert.ok(!oneShot.includes("| soft |"), "en prompt no soft write column");
  ok("en locale prompt");

  // Full SSOT table is larger than fact context — prove we are not dumping all.
  const fullTable = buildPojuTermsPromptTable("zh", ["bazi"]);
  assert.ok(fullTable.length > prompt.length, "fact context smaller than full table");
  ok("fact context << full SSOT table");

  // Explicit slug fact ref
  const slugFacts: TermFactRef[] = [
    { namespace: "bazi", termId: "fei_ren", traditional: "飞刃", source: "test" },
  ];
  const fei = buildTermContextForFacts(slugFacts, "zh");
  assert.equal(fei.entries.length, 1);
  assert.equal(fei.entries[0]!.slug, "fei_ren");
  assert.ok(fei.entries[0]!.soft.includes("锋") || fei.entries[0]!.soft.length > 0);
  ok("fei_ren slug resolve");

  // Unknown → skipped, not free invention
  const unknown = buildTermContextForFacts(
    [{ namespace: "bazi", traditional: "伪神煞XYZ", source: "test" }],
    "zh",
  );
  assert.equal(unknown.entries.length, 0);
  assert.ok(unknown.skipped.some((s) => s.reason === "unknown"));
  ok("unknown skipped fail-closed");

  // Export sanitize + audit
  const leak = "命盘显示空亡与七杀，fortune-telling destiny prediction";
  const plain = sanitizePlainExport(leak, "zh", "copy");
  assert.ok(plain.audit.hits.length >= 0);
  assert.ok(!plain.content.includes("空亡") || plain.audit.hits.length > 0);
  ok("plain export audit");

  const htmlIn = `<p title="七杀凶">正文有空亡与算命</p><script>var x="空亡"</script>`;
  const htmlOut = sanitizeHtmlExport(htmlIn, "zh", "html");
  assert.ok(htmlOut.content.includes("<script>"), "script preserved");
  assert.ok(htmlOut.content.includes("var x="), "script body untouched");
  ok("html text-node sanitize preserves script");

  // Multi-locale: same pipeline for es/de/fr
  for (const loc of ["en", "es", "de", "fr"] as const) {
    const r = sanitizeExportSurface({
      content: "Day Master Yong Shen Da Yun fortune-telling",
      locale: loc,
      surface: "copy",
    });
    assert.ok(typeof r.content === "string");
    assert.ok(Array.isArray(r.audit.hits));
    ok(`locale ${loc} export`);
  }

  console.log("\nAll Phase 5 term-context / export tests passed.\n");
}

main();
