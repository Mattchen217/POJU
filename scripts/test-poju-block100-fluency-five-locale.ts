/**
 * Block 100 — fluency rewrite prompt + 5-locale soft/gloss lookup
 *
 *   pnpm exec tsx scripts/test-poju-block100-fluency-five-locale.ts
 */
import fs from "node:fs";
import path from "node:path";
import { BARE_GANZHI_MARKER, HIGH_RISK_SOFT_LABEL } from "@/lib/glossary/term-closed-set";
import { CLOSED_SET_GLOSSARY_ENTRIES } from "@/lib/glossary/term-glossary-closed";
import { plainByTermId, uiTermById } from "@/lib/llm/sanitize/term-marking";

const ROOT = process.cwd();
const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 100 · Fluency + 5-locale ==========\n");

  const prompt = fs.readFileSync(path.join(ROOT, "lib/llm/deepseek/breakthrough-core.ts"), "utf8");
  assert("Part A rewrite rule", prompt.includes("白话重组") && prompt.includes("抠词替换"));
  assert("Part A anti examples", prompt.includes("表达力被火烧") && prompt.includes("火燥金克"));
  assert("Part B fluency decides plain", prompt.includes("按\"通顺与否\"决定") || prompt.includes("按“通顺与否”决定") || prompt.includes("通顺与否"));
  assert("Part B golden + dots", prompt.includes("[···]") && prompt.includes("金字"));

  assert("high-risk es soft", HIGH_RISK_SOFT_LABEL["占卜"].soft.es.includes("situacional"));
  assert("high-risk de gloss", HIGH_RISK_SOFT_LABEL["命运"].gloss.de.length > 8);
  assert("high-risk fr soft", HIGH_RISK_SOFT_LABEL["吉凶"].soft.fr.includes("tendance"));
  assert("bare ganzhi es", BARE_GANZHI_MARKER.soft.es.includes("temporal"));
  assert("bare ganzhi fr gloss", BARE_GANZHI_MARKER.gloss.fr.includes("climat"));

  assert("uiTermById es not english fallback", uiTermById("shi_shen", "es")?.soft === "expresión fluida");
  assert("uiTermById de soft", uiTermById("zheng_yin", "de")?.soft?.includes("Stütze") === true);
  assert("uiTermById fr soft", uiTermById("day_master", "fr")?.soft === "nature profonde");
  assert("plainByTermId es", (plainByTermId("zheng_guan", "es") ?? "").length > 4);
  assert("plainByTermId de HR", (plainByTermId("hr_divination", "de") ?? "").includes("Wahrsagen"));

  const jia = CLOSED_SET_GLOSSARY_ENTRIES.find((c) => c.id === "甲");
  assert("stem jia has es soft", Boolean(jia?.soft.es && jia.soft.es !== jia.soft.en));
  assert("stem jia has de gloss", Boolean(jia?.gloss.de && jia.gloss.de !== jia.gloss.en));

  const changSheng = CLOSED_SET_GLOSSARY_ENTRIES.find((c) => c.id === "长生");
  assert(
    "life stage fr soft native",
    changSheng?.soft.fr === "nouveau départ" && changSheng.soft.fr !== changSheng.soft.en,
  );

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
