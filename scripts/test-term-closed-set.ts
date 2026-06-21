/**
 * Closed-set glossary coverage audit.
 * Run: pnpm tsx scripts/test-term-closed-set.ts
 */
import { CLOSED_SET_REPLACE_IDS, CLOSED_SET_SLUG } from "@/lib/glossary/term-closed-set";
import { CLOSED_SET_GLOSSARY_ENTRIES, SUPERSEDED_GLOSSARY_IDS } from "@/lib/glossary/term-glossary-closed";
import { TERM_GLOSSARY } from "@/lib/glossary/term-glossary";
import { auditOutOfSetTerms } from "@/lib/llm/sanitize/compliance-terms";
import { TERM_ENTRIES } from "@/lib/llm/sanitize/term-marking";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

const GENERIC_SOFT = new Set([
  "external support",
  "external support / social energy",
  "relational dynamics",
  "resource orientation",
  "key supporter / external support",
]);

function main() {
  console.log("=== closed-set glossary coverage ===");
  const closedIds = new Set(CLOSED_SET_GLOSSARY_ENTRIES.map((c) => c.id));

  for (const hanId of CLOSED_SET_REPLACE_IDS) {
    const entry = TERM_GLOSSARY.find((c) => c.id === hanId);
    assert(!!entry, `TERM_GLOSSARY has row for ${hanId}`);
    if (!entry) continue;
    assert(entry.surface === "replace", `${hanId} surface=replace`);
    assert(entry.soft.en.trim().length > 0, `${hanId} has soft.en`);
    assert(entry.gloss.en.trim().length > 0, `${hanId} has gloss.en`);
    assert(!SUPERSEDED_GLOSSARY_IDS.has(hanId), `${hanId} not superseded`);
    assert(
      !GENERIC_SOFT.has(entry.soft.en.trim().toLowerCase()),
      `${hanId} soft is not generic category label`,
    );
  }

  assert(closedIds.has("飞刃"), "飞刃 in closed entries");
  assert(closedIds.has("羊刃"), "羊刃 in closed entries");

  const feiRen = TERM_GLOSSARY.find((c) => c.id === "飞刃");
  assert(
    !!(feiRen?.soft.en.includes("double-edged") || feiRen?.soft.en.includes("cutting")),
    "飞刃 soft ≠ external support (double-edged drive)",
  );

  console.log("\n=== slug → term entry ===");
  for (const hanId of ["飞刃", "羊刃", "七杀", "天乙贵人"]) {
    const slug = CLOSED_SET_SLUG[hanId];
    const term = TERM_ENTRIES.find((t) => t.id === slug);
    assert(!!term, `TERM_ENTRIES has ${slug} for ${hanId}`);
  }

  console.log("\n=== out-of-set audit ===");
  const bad = "命盘带空亡与将星，需防红鸾冲克。";
  const hits = auditOutOfSetTerms(bad);
  assert(hits.some((h) => h.label.includes("空亡")), "detects 空亡");
  assert(hits.some((h) => h.label.includes("将星")), "detects 将星");
  assert(auditOutOfSetTerms("命带元辰与六秀日").some((h) => h.snippet === "元辰"), "detects 元辰");
  assert(auditOutOfSetTerms("阴差阳错配置").some((h) => h.snippet === "阴差阳错"), "detects 阴差阳错");

  const ok = "你的 ⟦t:fei_ren|double-edged drive|Channel the edge into one clear cut⟧ 在此事上宜守边界。";
  assert(auditOutOfSetTerms(ok).length === 0, "marked closed-set text passes");

  if (process.exitCode) process.exit(1);
  console.log(`\nAll closed-set checks passed (${CLOSED_SET_REPLACE_IDS.length} replace ids).`);
}

main();
