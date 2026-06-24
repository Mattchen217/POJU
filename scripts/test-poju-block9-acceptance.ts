/**
 * Block 9 acceptance — greeting gate / message language / matrix dedupe / soft timeout 200s
 * Run: pnpm exec tsx scripts/test-poju-block9-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { isSubstantiveBreakthroughQuestion } from "@/lib/poju/breakthrough-question-gate";
import { dedupePreviewMatrixMessages } from "@/lib/poju/preview-unlock";
import { resolvePojuSessionOutputLocale } from "@/lib/prompts/language-directive";

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
  console.log("\n========== POJU Block 9 Acceptance ==========\n");

  console.log("=== Fix 1 · greeting gate ===\n");
  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening hard rules for greetings", opening.includes("硬规则：什么算\"还没说出问题\""));
  assert("opening sufficient=false for 你好", opening.includes("纯问候 / 寒暄"));
  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("orchestrator imports question gate", orch.includes("isSubstantiveBreakthroughQuestion"));
  assert("ensureBreakthroughCore early exit", orch.includes("!isSubstantiveBreakthroughQuestion(session.original_question)"));
  assert("你好 not substantive", !isSubstantiveBreakthroughQuestion("你好"));
  assert("real question substantive", isSubstantiveBreakthroughQuestion("卡了三年想转行但不敢"));

  console.log("\n=== Fix 2 · message language priority ===\n");
  const lang = read("lib/prompts/language-directive.ts");
  assert("inferLocaleFromUserMessages CJK", lang.includes("CJK_PATTERN"));
  assert("resolve order: messages before locked", /fromMessages[\s\S]*if \(input\.locked\)/.test(lang));
  const agent = read("lib/poju/agent.ts");
  assert("agent no auto-lock from first message", !agent.includes("locked: undefined"));
  assert("agent persist explicit switch only", agent.includes("explicitLanguageSwitch ?? sessionBase.locked_output_locale"));
  assert(
    "zh message wins over en UI lock",
    resolvePojuSessionOutputLocale({
      locked: "en",
      uiLocale: "en",
      userInput: "我和合伙人闹翻了怎么办",
      conversationHistory: [],
    }) === "zh",
  );
  assert(
    "en message on en UI",
    resolvePojuSessionOutputLocale({
      locked: undefined,
      uiLocale: "en",
      userInput: "I feel stuck in my career for three years",
      conversationHistory: [],
    }) === "en",
  );

  console.log("\n=== Fix 3 · energy_matrix kind dedupe ===\n");
  const dup = {
    messages: [
      { role: "assistant" as const, content: "", timestamp: "1", meta: { kind: "energy_matrix" as const, matrix_payload: { id: "a" } } },
      { role: "assistant" as const, content: "", timestamp: "2", meta: { kind: "energy_matrix" as const, matrix_payload: { id: "b" } } },
    ],
  };
  const once = dedupePreviewMatrixMessages(dup as never);
  assert("dedupe keeps one by kind", once.messages.filter((m) => m.meta?.kind === "energy_matrix").length === 1);
  assert("dedupe keeps first matrix", once.messages[0]?.meta?.kind === "energy_matrix");
  const chatUi = read("components/poju/POJUChatUI.tsx");
  assert("render guard single matrix", chatUi.includes("energyMatrixRendered"));

  console.log("\n=== Fix 4 · soft timeout 200s ===\n");
  const btClient = read("lib/llm/deepseek/breakthrough-core.ts");
  assert("breakthrough soft timeout 200s", btClient.includes("200_000") && btClient.includes("AbortController"));
  assert("breakthrough no 90s client timeout", !/softTimeoutMs = 90_000/.test(btClient));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 9 acceptance checks passed.\n");
}

main();
