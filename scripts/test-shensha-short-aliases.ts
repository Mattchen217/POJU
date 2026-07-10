/**
 * Shensha short-form alias coverage (engine 简写 → i18n map).
 *
 *   pnpm exec tsx scripts/test-shensha-short-aliases.ts
 */
import { toShenshaId, resolveShensha } from "@/lib/poju/shensha";

const SHORT_FORMS: Array<{ token: string; expectedId: string }> = [
  { token: "天德", expectedId: "systemic_support_core" },
  { token: "月德", expectedId: "grounded_support" },
  { token: "国印", expectedId: "institutional_authority_node" },
  { token: "福星", expectedId: "fortune_buffer" },
  { token: "太极", expectedId: "insight_catalyst" },
  { token: "文昌", expectedId: "cognitive_advantage_local" },
  { token: "学堂", expectedId: "learning_foundation" },
];

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n=== shensha short aliases ===\n");

  for (const { token, expectedId } of SHORT_FORMS) {
    const id = toShenshaId(token);
    assert(`${token} → ${expectedId}`, id === expectedId);
    const view = resolveShensha(token, "zh");
    assert(`${token} resolves label (not raw fallback)`, view.id !== "unknown" && view.label !== token);
  }

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All shensha short alias checks passed.\n");
}

main();
