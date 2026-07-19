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

  const goodMarker = "⟦t:decade|纪元|这段路像走窄桥⟧";
  assert(
    "well-formed marker unchanged",
    wrapBareKeepCnSoftTerms(goodMarker, "zh") === goodMarker,
  );

  const nestedBug =
    "⟦t:decade|⟦t:decade|纪元|正在经历的较长章节。⟧|语境白话⟧";
  assert(
    "does not double-wrap marker interior",
    !wrapBareKeepCnSoftTerms(goodMarker, "zh").includes("⟦t:decade|⟦t:"),
  );
  assert(
    "already-broken nested marker left as-is (odd segment protected)",
    wrapBareKeepCnSoftTerms(nestedBug, "zh") === nestedBug,
  );

  const bare = wrapBareKeepCnSoftTerms("纪元里偏守。", "zh");
  assert("bare SSOT soft still wrapped", bare.includes("⟦t:decade|"));
  assert("bare wrap closes marker", bare.includes("⟧") && bare !== "纪元里偏守。");

  const mixed = `前文 ${goodMarker} 后文纪元里继续。`;
  const mixedOut = wrapBareKeepCnSoftTerms(mixed, "zh");
  assert("marker in mixed text preserved", mixedOut.includes(goodMarker));
  assert("bare term outside marker wrapped", /⟦t:decade\|/.test(mixedOut));

  // Soft + paren is not auto-wrapped (lookbehind / lookahead) — stem-only stays plain.
  const yiMu = wrapBareKeepCnSoftTerms("本元（乙木）需要支点。", "zh");
  assert("stem-only 乙木 not forced into decade-style wrap", yiMu === "本元（乙木）需要支点。");

  const jiaZi = wrapBareKeepCnSoftTerms("本元里需要支点。", "zh");
  assert("day_master SSOT soft wraps", jiaZi.includes("⟦t:day_master|"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 31 acceptance checks passed.\n");
}

main();
