/**
 * Block 71 — empty completion retry must not ignore pinned single provider + empty fallback copy
 *
 *   pnpm exec tsx scripts/test-poju-block71-empty-retry.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  getPhaseEmptyGenerationFallback,
  getPhaseResponseFallback,
  isPhaseResponseFallback,
  resolvePhaseResponse,
} from "@/lib/llm/phases/phase-transport";
import {
  getPojuEmptyGenerationMessage,
  getPojuServiceBusyMessage,
  isPojuEmptyGenerationMessage,
  isPojuFailurePlaceholderMessage,
} from "@/lib/llm/poju-service-busy-message";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 71 · Empty retry + fallback ==========\n");

  const transport = read("lib/llm/phases/phase-transport.ts");
  assert("pinned provider skips extra_ignore on empty retry", transport.includes("extra_ignore: pinned ? undefined"));
  assert("retry_same_provider log field", transport.includes("retry_same_provider"));
  assert("empty after retry log", transport.includes("empty completion after retry"));

  const emptyZh = getPojuEmptyGenerationMessage("zh");
  const busyZh = getPojuServiceBusyMessage("zh");
  assert("empty zh distinct from busy", emptyZh !== busyZh);
  assert("empty zh mentions 没有完整生成", emptyZh.includes("没有完整生成"));
  assert("busy zh mentions 服务繁忙", busyZh.includes("服务繁忙"));
  assert("isPojuEmptyGenerationMessage detects empty copy", isPojuEmptyGenerationMessage(emptyZh));
  assert("isPhaseResponseFallback includes empty", isPhaseResponseFallback(emptyZh));
  assert("isPhaseResponseFallback includes busy", isPhaseResponseFallback(busyZh));
  assert("failure placeholder union", isPojuFailurePlaceholderMessage(emptyZh));

  const resolved = resolvePhaseResponse("", { locale: "zh", phase_name: "opening" });
  assert("empty raw uses empty-generation fallback", resolved.response === getPhaseEmptyGenerationFallback("zh"));
  assert("empty raw not busy fallback", resolved.response !== getPhaseResponseFallback("zh"));

  const opening = read("lib/llm/phases/opening-phase-v6.ts");
  assert("opening conversion max_tokens 20000", opening.includes("openingConversionRound ? 20_000 : 16_000"));

  const coreRoute = read("app/api/poju/breakthrough-core/route.ts");
  assert("core retry max_tokens 24000", coreRoute.includes("CORE_MAX_TOKENS_RETRY = 24_000"));
  assert("core retries on empty body", coreRoute.includes("emptyBody"));

  const finalRoute = read("app/api/poju/final-delivery/route.ts");
  assert("final-delivery xhigh 16000", finalRoute.includes("thinking_effort: \"xhigh\"") && finalRoute.includes("16_000"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 71 checks passed.\n");
}

main();
