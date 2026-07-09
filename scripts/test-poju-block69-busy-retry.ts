/**
 * Block 69 — 服务繁忙提示 + 失败不叠加提问兜底 + OpenRouter 重试/候选降级
 *
 *   pnpm exec tsx scripts/test-poju-block69-busy-retry.ts
 */
import {
  appendForwardMove,
  hasQuestionCue,
} from "@/lib/poju/collecting-focus-reply";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  getPojuServiceBusyMessage,
  isPojuInfrastructureFailureMessage,
  POJU_SERVICE_BUSY_MESSAGES,
} from "@/lib/llm/poju-service-busy-message";
import { getPhaseResponseFallback, isPhaseResponseFallback } from "@/lib/llm/phases/phase-transport";
import {
  callWithRetryAndFallback,
  OPENROUTER_MODEL_CANDIDATES_BUILTIN,
  resetOpenRouterModelResolverForTests,
} from "@/lib/llm/openrouter-model-resolver";
import { OPENROUTER_MAX_ATTEMPTS } from "@/lib/llm/openrouter-retry";

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main(): Promise<void> {
  console.log("\n=== Block 69 — busy message + retry/fallback ===\n");

  const busyZh = getPojuServiceBusyMessage("zh");
  assert("busy zh mentions 服务繁忙", busyZh.includes("服务繁忙"));
  assert("busy zh mentions session saved", busyZh.includes("会话已保存"));
  assert("phase fallback uses busy message", getPhaseResponseFallback("zh") === busyZh);
  assert("isPhaseResponseFallback detects busy", isPhaseResponseFallback(busyZh));
  assert("legacy 未能生成 still detected", isPojuInfrastructureFailureMessage("[POJU] 未能生成"));

  const stacked = appendForwardMove(
    busyZh,
    createInitialAgentState({ original_question: "q" }),
    "zh",
  );
  assert("failure message not stacked with 能再多说", stacked === busyZh);
  assert("no 能再多说一点 in failure path", !stacked.includes("能再多说一点"));

  const half = appendForwardMove(
    "你把风险边界画出来了。",
    {
      ...createInitialAgentState({ original_question: "q" }),
      investigation_agenda: [
        { id: "a1", label: "团队怎么分", critical: true, status: "unexplored" },
      ],
    },
    "zh",
  );
  assert("success path still appends question", hasQuestionCue(half));

  resetOpenRouterModelResolverForTests();
  let attempts = 0;
  await callWithRetryAndFallback(async () => {
    attempts++;
    if (attempts === 1) throw new Error("openrouter_http_503: busy");
    return { ok: true };
  });
  assert("503 retries once then succeeds", attempts === 2);

  resetOpenRouterModelResolverForTests();
  let calls = 0;
  const out = await callWithRetryAndFallback(async (model) => {
    calls++;
    if (model === OPENROUTER_MODEL_CANDIDATES_BUILTIN[0]) {
      throw new Error("openrouter_http_404: No endpoint found");
    }
    return model;
  });
  assert("404 switches candidate", out === OPENROUTER_MODEL_CANDIDATES_BUILTIN[1]);
  assert("404 tried both slugs", calls === 2);

  assert("max attempts is 5 (4 retries)", OPENROUTER_MAX_ATTEMPTS === 5);
  assert("busy en matches constant", getPojuServiceBusyMessage("en") === POJU_SERVICE_BUSY_MESSAGES.en);

  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
