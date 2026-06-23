/**
 * POJU v5 Step K — static + optional live checks for the 12 regression issues.
 *
 *   pnpm exec tsx scripts/test-poju-v5-stepk.ts
 *   pnpm exec tsx scripts/test-poju-v5-stepk.ts --live
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getThinkingConfig, callLLM } from "@/lib/llm/router";
import { parsePhaseResult } from "@/lib/llm/phases/phase-transport";
import { buildRegionalPlatformGuidance } from "@/lib/llm/pro/final-delivery";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import {
  buildCurrentDateContext,
  calculateCurrentYearGanZhi,
} from "@/lib/llm/prompts/oriental-counselor-base";

const ROOT = resolve(__dirname, "..");

function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function assert(name: string, ok: boolean, detail = ""): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

const failures: string[] = [];

function staticChecks(): void {
  console.log("\n=== Step K: 12-issue static verification ===\n");

  // 1 — POJU flash tiers: deep thinking defaults (phases override to xhigh via phase-transport)
  const chat = getThinkingConfig("chat_flash");
  const track = getThinkingConfig("tracking_flash");
  const collect = getThinkingConfig("collection_flash");
  assert("1a chat_flash thinking high", chat.enabled && chat.effort === "high");
  assert("1b tracking_flash thinking high", track.enabled && track.effort === "high");
  assert("1c collection_flash thinking xhigh", collect.enabled && collect.effort === "xhigh");

  // 2 — ThinkingStream UI
  const chatUi = read("components/poju/POJUChatUI.tsx");
  assert("2 ThinkingStream in chat UI", chatUi.includes("ThinkingStream") && chatUi.includes("thinkingMode"));

  // 3 — opening prompt: positive framing hint
  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("3 opening phase exists", opening.includes("callOpeningPhase"));
  assert("3b opening avoids negative template", !opening.includes("不是 POJU，你的 AI 思考伙伴"));

  // 4 — prepare before chat
  const sessionPage = read("app/[locale]/(marketing)/poju/session/[sessionId]/page.tsx");
  assert("4 session redirects to prepare without profile", sessionPage.includes("/prepare"));

  // 5 — no hardcoded welcome in session flow
  const agentTs = read("lib/poju/agent.ts");
  const sessionUsesWelcome =
    sessionPage.includes("getWelcomeMessage") || agentTs.includes("getWelcomeMessage(");
  assert("5 no getWelcomeMessage in live session/agent path", !sessionUsesWelcome);

  // 6 — chart loader / preparing
  assert("6 ChartReadingLoader component", existsSync(resolve(ROOT, "components/poju/ChartReadingLoader.tsx")));
  assert("6b preparing route", existsSync(resolve(ROOT, "app/[locale]/(marketing)/poju/session/[sessionId]/preparing/page.tsx")));

  // 7 — no thinking_process in POJUChatUI
  assert("7 POJUChatUI hides raw thinking_process", !chatUi.includes("thinking_process"));

  // 8 — no hardcoded fallback: parsePhaseResult preserves model text
  const passthrough = parsePhaseResult('{"response":"你的日主为庚金，走偏印大运。"}').response;
  assert("8 parsePhaseResult preserves 命理 text", passthrough.includes("庚金"));
  const truncated = '{"response": "我能感受到你现在的窒息感。四年来';
  assert(
    "8b truncated JSON salvages partial response",
    parsePhaseResult(truncated).response.includes("窒息感"),
  );
  assert(
    "8c agenda-first truncated does not leak raw JSON",
    parsePhaseResult('{"thought":{"breakthrough_hypotheses":["a"]}, "investigation_agenda": [').response === "",
  );

  // 9 — ContextSummaryEditor
  assert("9 ContextSummaryEditor wired", chatUi.includes("ContextSummaryEditor"));

  // 10 — maxDuration 180
  const routes = [
    "app/api/poju/chat/route.ts",
    "app/api/poju/breakthrough-core/route.ts",
    "app/api/poju/final-delivery/route.ts",
    "app/api/profile/base-analysis/stream/route.ts",
  ];
  for (const r of routes) {
    const src = read(r);
    const ok =
      r.includes("base-analysis/stream")
        ? /maxDuration\s*=\s*300/.test(src)
        : /maxDuration\s*=\s*180/.test(src);
    assert(`10 maxDuration (${r})`, ok);
  }

  // 11 — delivery section markers
  const finalDel = read("lib/llm/pro/final-delivery.ts");
  assert("11 final delivery ANALYSIS marker", finalDel.includes("═══ ANALYSIS ═══"));
  assert("11b parseDeliverySections", finalDel.includes("parseDeliverySections"));

  // 12 — NA platform guidance
  const enGuide = buildRegionalPlatformGuidance("en");
  const zhGuide = buildRegionalPlatformGuidance("zh");
  assert("12 en delivery bans China-only platforms", /知乎/.test(enGuide) && enGuide.includes("LinkedIn"));
  assert("12 zh delivery no extra regional block", zhGuide === "");

  // Router / phases
  assert("J router getThinkingConfig", read("lib/llm/router.ts").includes("getThinkingConfig"));
  assert("J phase-transport uses callLLM", read("lib/llm/phases/phase-transport.ts").includes("callLLM"));
  assert("I oriental base", read("lib/llm/prompts/oriental-counselor-base.ts").includes("ORIENTAL_COUNSELOR_BASE"));
  const may2026 = calculateCurrentYearGanZhi(new Date(2026, 4, 18));
  assert("I date context 2026-05 = 丙午", may2026.gan_zhi === "丙午");
  assert("I buildCurrentDateContext injected", buildCurrentDateContext(new Date(2026, 4, 18), "zh").includes("丙午"));
  assert(
    "I oriental-prompt injects date",
    read("lib/llm/phases/oriental-prompt-context.ts").includes("buildCurrentDateContext"),
  );
}

async function liveOpenRouterPing(): Promise<void> {
  console.log("\n=== Step K: live OpenRouter ping (chat_flash) ===\n");
  loadEnvLocal();
  if (!isOpenRouterConfigured()) {
    console.log("  [SKIP] OPENROUTER_API_KEY not set — add to .env.local and re-run with --live");
    return;
  }
  const t0 = Date.now();
  try {
    const result = await callLLM({
      call_type: "chat_flash",
      system: "Reply with JSON only: {\"ok\":true,\"note\":\"stepk\"}",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 80,
      response_format: "json",
      temperature: 0.2,
    });
    const ms = Date.now() - t0;
    assert("live OpenRouter responds", result.content.length > 0);
    assert("live thinking off", result.meta.thinking_enabled === false);
    console.log(`  model: ${result.actual_model}`);
    console.log(`  tokens: ${result.meta.tokens_used}, latency: ${result.meta.latency_ms ?? ms}ms, cost: $${result.meta.cost_usd}`);
    console.log(`  preview: ${result.content.slice(0, 120).replace(/\n/g, " ")}`);
  } catch (e) {
    assert("live OpenRouter call", false, e instanceof Error ? e.message : String(e));
  }
}

async function main(): Promise<void> {
  staticChecks();
  if (process.argv.includes("--live")) {
    await liveOpenRouterPing();
  } else {
    console.log("\n(Tip: run with --live to ping OpenRouter using .env.local)\n");
  }

  console.log("\n=== Summary ===");
  if (failures.length === 0) {
    console.log("All static Step K checks passed.");
    console.log("\nManual E2E still required (doc Part2 §Step K):");
    console.log("  • Incognito → /poju → pay → prepare → preparing → chat → confirm → delivery → tracking");
    console.log("  • Record model/cost per stage; total session ~$1.50–3.50");
  } else {
    console.log(`Failed (${failures.length}): ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

void main();
