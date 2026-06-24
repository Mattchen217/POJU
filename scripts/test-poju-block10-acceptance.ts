/**
 * Block 10 hotfix — chat 500 / parsePhaseJson salvage / poju-llm graceful degrade
 * Run: pnpm exec tsx scripts/test-poju-block10-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  guardParseFailedFields,
  isPhaseParseFailed,
  parsePhaseJson,
  parsePhaseResult,
} from "@/lib/llm/phases/phase-transport";

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
  console.log("\n========== POJU Block 10 Acceptance ==========\n");

  console.log("=== Fix 1 · parsePhaseJson never throws ===\n");
  const transport = read("lib/llm/phases/phase-transport.ts");
  assert("parsePhaseJson has trailing-comma repair", transport.includes(',(\\s*[}\\]])'));
  assert("parsePhaseJson has _parse_failed salvage", transport.includes("_parse_failed"));
  assert("guardParseFailedFields exported", transport.includes("export function guardParseFailedFields"));

  const valid = parsePhaseJson('{"response":"ok","suggested_phase":"collecting_context"}');
  assert("valid JSON parses", valid.response === "ok");

  const trailingComma = parsePhaseJson('{"response":"fixed",}');
  assert("trailing comma repaired", trailingComma.response === "fixed");

  const broken =
    '{"response":"事业这几年一直不顺，⟦t:丙午⟧ 是关键", "understanding":{"sufficient":true}, "suggested_phase":"collecting_context"';
  let threw = false;
  try {
    const salvaged = parsePhaseJson(broken);
    assert("broken JSON does not throw", true);
    assert(
      "broken JSON salvages response text",
      typeof salvaged.response === "string" && salvaged.response.includes("事业"),
    );
    assert("broken JSON marks _parse_failed", salvaged._parse_failed === true);
    const guarded = guardParseFailedFields(salvaged);
    assert("guard nulls suggested_phase", guarded.suggested_phase === null);
    assert("guard fail-closed understanding", (guarded.understanding as { sufficient?: boolean })?.sufficient === false);
  } catch {
    threw = true;
    assert("broken JSON does not throw", false);
  }
  assert("no throw on broken JSON", !threw);

  const emptySalvage = parsePhaseJson("{not json at all");
  assert("unrecoverable JSON returns _parse_failed", emptySalvage._parse_failed === true);
  const emptyResult = parsePhaseResult("{not json at all", { locale: "zh" });
  assert(
    "empty salvage gets fallback response",
    emptyResult.response.includes("未能生成") || emptyResult.response.includes("could not"),
  );
  assert("parsePhaseResult guards parse failed", isPhaseParseFailed(emptyResult.parsed) || emptyResult.parsed.suggested_phase === null);

  console.log("\n=== Fix 2 · poju-llm + chat route ===\n");
  const pojuLlm = read("lib/llm/poju-llm.ts");
  assert("callPOJULLM catch returns emptyFailureResponse", pojuLlm.includes("emptyFailureResponse(session, input.locale"));
  assert("callPOJULLM catch no rethrow", !/catch \(error[\s\S]*?throw error/.test(pojuLlm));

  const chatRoute = read("app/api/poju/chat/route.ts");
  assert("chat route try/catch", chatRoute.includes("catch (error: unknown)"));
  assert("chat route graceful JSON on error", chatRoute.includes("未能生成") || chatRoute.includes("could not be generated"));

  console.log("\n=== Fix 3 · maxDuration 300 ===\n");
  assert("chat maxDuration 300", /export const maxDuration = 300/.test(chatRoute));
  assert("chat no maxDuration 180", !/export const maxDuration = 180/.test(chatRoute));

  console.log("\n=== Opening phase _parse_failed guard ===\n");
  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening uses isPhaseParseFailed", opening.includes("isPhaseParseFailed"));

  console.log("\n=== Collecting phase _parse_failed guard ===\n");
  const collecting = read("lib/llm/phases/collecting-phase.ts");
  assert("collecting uses isPhaseParseFailed", collecting.includes("isPhaseParseFailed"));
  assert("collecting nulls breakthrough on parse fail", /isPhaseParseFailed\(parsed\)[\s\S]*?\? null/.test(collecting));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 10 acceptance checks passed.\n");
}

main();
