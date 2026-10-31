/**
 * TERMS-PIPELINE-SPEC-v1 — code-wave acceptance.
 * Simulated free Chinese → deterministic soft-translate for zh/en/es/fr.
 *
 *   pnpm exec tsx scripts/test-terms-pipeline-sot-v1.ts
 */
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";
import { POJU_TERMS } from "@/lib/glossary/pojulife-terms";

const failures: string[] = [];

function assert(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

const LOCALES = ["zh", "en", "es", "fr"] as const;

/** Mixed closed-set traditional + irrelevant prose (simulates free model Chinese). */
const SAMPLE =
  "今天讨论驿马和天德贵人，还有月德，以及团队推进节奏；外加无关闲话保持沟通。";

function softOf(traditional: string, locale: (typeof LOCALES)[number]): string {
  const hit = POJU_TERMS.find(
    (t) =>
      t.ns === "bazi" &&
      (t.traditional === traditional || (t.aliases ?? []).includes(traditional)),
  );
  if (!hit) throw new Error(`missing SSOT for ${traditional}`);
  return hit.term[locale];
}

function main(): void {
  console.log("\n========== terms-pipeline SoT v1 (code wave) ==========\n");

  const expect = {
    驿马: softOf("驿马", "zh"),
    天德贵人: softOf("天德贵人", "zh"),
    月德: softOf("月德", "zh"),
  };
  // zh softs for reference logging
  console.log("SSOT soft zh:", expect);

  for (const loc of LOCALES) {
    const out = toCompliantPlainText(SAMPLE, loc);
    console.log(`\n--- ${loc} ---\n${out}\n`);
    assert(`${loc}: no bare 驿马`, !out.includes("驿马"), out);
    assert(`${loc}: no bare 天德贵人`, !out.includes("天德贵人"), out);
    assert(`${loc}: no bare 天德`, !out.includes("天德"), out);
    assert(`${loc}: no bare 月德`, !out.includes("月德"), out);
    assert(`${loc}: has soft 驿马`, out.includes(softOf("驿马", loc)), out);
    assert(`${loc}: has soft 天德`, out.includes(softOf("天德", loc)), out);
    assert(`${loc}: has soft 月德`, out.includes(softOf("月德", loc)), out);
    assert(`${loc}: keeps innocent 团队`, out.includes("团队"), out);
    assert(`${loc}: keeps innocent 沟通`, out.includes("沟通"), out);
    assert(`${loc}: no marker crumbs`, !out.includes("⟦") && !out.includes("⟧"), out);
    assert(`${loc}: no definition leak`, !out.includes('式的资源') && !out.includes('关系场'), out);
  }

  console.log("\n--- single-char 长生 not globally replaced in prose ---\n");
  const life = toCompliantPlainText("他养了一只猫，病了就休息。", "zh");
  assert("养 stays (not life_stage soft)", life.includes("养"), life);
  assert("病 stays (not life_stage soft)", life.includes("病"), life);

  console.log("\n--- dual-ns 白虎 without ns: fail-closed (no crash, may peel) ---\n");
  const baihu = toCompliantPlainText("盘里见白虎要小心。", "zh");
  assert("白虎 path no throw", typeof baihu === "string" && baihu.length > 0, baihu);
  // Must not crash; preferably no raw traditional if scrubbed, or left if fail-closed peel.
  assert("no marker crash tokens", !baihu.includes("?t:"), baihu);

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(" | "));
    process.exit(1);
  }
  console.log("All SoT v1 code-wave checks passed.\n");
}

main();
