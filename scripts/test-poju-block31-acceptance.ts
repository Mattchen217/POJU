/**
 * Block 31 — wrapBareKeepCnSoftTerms must not re-wrap inside existing markers
 * Run: pnpm exec tsx scripts/test-poju-block31-acceptance.ts
 */
import { wrapBareKeepCnSoftTerms } from "@/lib/llm/sanitize/term-marking";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 31 Acceptance ==========\n");

  const goodMarker = "⟦t:decade|人生阶段（丁酉）|这段路像走窄桥⟧";
  assert(
    "well-formed marker unchanged",
    wrapBareKeepCnSoftTerms(goodMarker, "zh") === goodMarker,
  );

  const nestedBug =
    "⟦t:decade|⟦t:decade|人生阶段（丁酉）|正在经历的较长章节。⟧|语境白话⟧";
  assert(
    "does not double-wrap marker interior",
    !wrapBareKeepCnSoftTerms(goodMarker, "zh").includes("⟦t:decade|⟦t:"),
  );
  assert(
    "already-broken nested marker left as-is (odd segment protected)",
    wrapBareKeepCnSoftTerms(nestedBug, "zh") === nestedBug,
  );

  const bare = wrapBareKeepCnSoftTerms("当前人生阶段（丁酉）偏守。", "zh");
  assert("bare soft term still wrapped", bare.includes("⟦t:decade|人生阶段（丁酉）|"));
  assert("bare wrap uses glossary plain", bare.includes("⟧") && bare !== "当前人生阶段（丁酉）偏守。");

  const mixed = `前文 ${goodMarker} 后文人生阶段（丙午）继续。`;
  const mixedOut = wrapBareKeepCnSoftTerms(mixed, "zh");
  assert("marker in mixed text preserved", mixedOut.includes(goodMarker));
  assert("bare term outside marker wrapped", mixedOut.includes("⟦t:decade|人生阶段（丙午）|"));

  const yiMu = wrapBareKeepCnSoftTerms("核心特质（乙木）需要支点。", "zh");
  assert("stem-only 乙木 not forced into decade-style wrap", yiMu === "核心特质（乙木）需要支点。");

  const jiaZi = wrapBareKeepCnSoftTerms("核心特质（甲子）需要支点。", "zh");
  assert("day_master stem-branch bare wrap", jiaZi.includes("⟦t:day_master|核心特质（甲子）|"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 31 acceptance checks passed.\n");
}

main();
