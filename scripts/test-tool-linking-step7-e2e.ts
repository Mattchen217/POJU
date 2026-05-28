/**
 * Tool_Linking Step 7 — end-to-end logic scenarios (no browser / no live LLM).
 * Maps to pojulife_Tool_Linking_Final.md § Step 7 scenarios 1–9.
 *
 * Run: pnpm exec tsx scripts/test-tool-linking-step7-e2e.ts
 * Run all steps: pnpm exec tsx scripts/run-tool-linking-all.ts
 */

import { buildToolSuggestionRules } from "../lib/llm/prompts/tool-suggestion-rules";
import { buildToolResultInjectionMessage } from "../lib/llm/prompts/tool-result-injection";
import {
  checkToolQuota,
  createNewCycle,
  injectToolResult,
  markToolResultInjected,
  recordToolSuggestion,
  recordUserResponse,
  startNewCycle,
} from "../lib/poju/cycle-manager";
import { findPendingToolInjection } from "../lib/poju/find-pending-tool-injection";
import {
  finalizeToolInjectionTurn,
  prepareToolInjectionTurn,
} from "../lib/poju/prepare-tool-injection-turn";
import { buildToolHandoffPath } from "../lib/poju/tool-linking-routes";
import {
  applyToolLinkingFromLlm,
  parseToolSuggestionFromParsed,
} from "../lib/poju/tool-suggestion";
import { buildSuggestedQuestionFromTool } from "../lib/cross-product/suggested-question-from-tool";
import type { POJUSessionState } from "../lib/poju/types";

const results: { id: string; ok: boolean; detail?: string }[] = [];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function scenario(id: string, fn: () => void | Promise<void>) {
  try {
    const r = fn();
    if (r instanceof Promise) {
      return r.then(() => {
        results.push({ id, ok: true });
      });
    }
    results.push({ id, ok: true });
    return Promise.resolve();
  } catch (e) {
    results.push({ id, ok: false, detail: e instanceof Error ? e.message : String(e) });
    return Promise.resolve();
  }
}

function baseSession(overrides: Partial<POJUSessionState> = {}): POJUSessionState {
  const cycle = createNewCycle({ original_question: "和老婆经常吵架", cycle_index: 1 });
  return {
    session_id: "e2e-s1",
    device_id: "e2e-d1",
    original_question: "和老婆经常吵架",
    cycles: [cycle],
    active_cycle_id: cycle.cycle_id,
    messages: [{ role: "user", content: "和老婆经常吵架", timestamp: new Date().toISOString() }],
    context_collected: {},
    has_profile: true,
    profile_skipped: false,
    actions: [],
    main_delivery_done: false,
    main_delivery: null,
    tokens_used: 0,
    abuse_metrics: { long_input_count: 0, jailbreak_attempts: 0, duplicate_attempts: 0 },
    created_at: new Date().toISOString(),
    last_interaction_at: new Date().toISOString(),
    expires_at: new Date().toISOString(),
    ...overrides,
  };
}

async function run() {
  await scenario("1 POJU → Match → POJU闭环", () => {
    let session = baseSession();
    const path = buildToolHandoffPath("match", {
      sessionId: session.session_id,
      cycleId: session.active_cycle_id!,
      prefill: { partner_relationship: "老婆" },
    });
    assert(path.includes("from_poju_session=e2e-s1"), "handoff session in URL");
    assert(path.startsWith("/match?"), "match entry path");

    session = recordToolSuggestion(session, "match", "msg-1", "二元关系矛盾");
    session = recordUserResponse(session, "match", "accepted");
    session = injectToolResult(session, "match", "match-99", {
      compatibility_level: "compatible_with_effort",
      summary: "需要沟通",
      relationship_description: "夫妻",
    });

    const pending = findPendingToolInjection(session);
    assert(pending?.tool === "match", "pending injection");

    const prep = prepareToolInjectionTurn(session);
    assert(Boolean(prep.tool_injection_context), "injection context built");
    assert(prep.tool_injection_context!.includes("Match"), "match injection label");

    const injected = finalizeToolInjectionTurn(prep.session, prep.pending);
    const after = markToolResultInjected(injected, "match", "match-99");
    assert(checkToolQuota(after, "match").already_used, "match marked used");
    assert(!checkToolQuota(after, "match").available, "no second free match in cycle");
  });

  await scenario("2 Syncro 24h 窗口（prompt 约束）", () => {
    const rules = buildToolSuggestionRules({
      active_cycle: createNewCycle({ original_question: "签合同", cycle_index: 1 }),
      user_location: { timezone: "Asia/Shanghai" },
    });
    assert(rules.includes("24 小时"), "mentions 24h window");
    assert(rules.includes("后天") || rules.includes("下周"), "blocks far-future events");
    assert(rules.includes("明天"), "allows tomorrow framing");
  });

  await scenario("3 Glyph 模糊表达（prompt 约束）", () => {
    const rules = buildToolSuggestionRules({
      active_cycle: createNewCycle({ original_question: "说不清", cycle_index: 1 }),
    });
    assert(rules.includes("说不清"), "glyph fuzzy trigger documented");
    assert(rules.includes("意象"), "glyph positioning");
  });

  await scenario("4 拒绝后不再推", () => {
    let session = baseSession();
    session = recordToolSuggestion(session, "match", "msg-2", "关系张力");
    session = recordUserResponse(session, "match", "declined");
    const q = checkToolQuota(session, "match");
    assert(q.already_declined, "declined flag");
    assert(!q.available, "match unavailable after decline");

    const rules = buildToolSuggestionRules({ active_cycle: session.cycles![0] });
    assert(rules.includes("declined") || rules.includes("拒绝"), "prompt lists declined tools");
  });

  await scenario("5 新 cycle 重置配额", () => {
    let session = baseSession({ main_delivery_done: true });
    session = recordToolSuggestion(session, "match", "m", "used");
    session = recordUserResponse(session, "match", "accepted");
    session = injectToolResult(session, "match", "mid", { summary: "x" });
    session = markToolResultInjected(session, "match", "mid");

    const applied = applyToolLinkingFromLlm(
      session,
      { start_new_cycle: true, new_cycle_question: "跟老板的关系也有点紧张" },
      "msg-nc",
    );
    assert(applied.start_new_cycle, "new cycle started");
    assert(applied.session.cycles!.length === 2, "two cycles");
    assert(checkToolQuota(applied.session, "match").available, "match quota reset in cycle 2");
    assert(checkToolQuota(applied.session, "syncro").available, "syncro available in cycle 2");
    assert(checkToolQuota(applied.session, "glyph").available, "glyph available in cycle 2");
  });

  await scenario("6 Match → POJU（无现有 session / 新建）", () => {
    const result_data = { relationship_description: "合伙人", summary: "张力" };
    const suggested_question = buildSuggestedQuestionFromTool("match", result_data);
    assert(suggested_question.length >= 20, "prefill question length");
    assert(suggested_question.includes("合伙人"), "question references match context");

    const cycle = createNewCycle({ original_question: suggested_question, cycle_index: 1 });
    let session: POJUSessionState = {
      ...baseSession(),
      cycles: [cycle],
      active_cycle_id: cycle.cycle_id,
      original_question: suggested_question,
    };
    session = injectToolResult(session, "match", "match-standalone", result_data);
    assert(findPendingToolInjection(session)?.tool === "match", "new session has match pending inject");
  });

  await scenario("7 Match → POJU（并入已有 session）", () => {
    let session = baseSession({ original_question: "和老婆的关系" });
    session = injectToolResult(session, "match", "match-join", {
      summary: "互补",
      relationship_description: "夫妻",
    });
    const prep = prepareToolInjectionTurn(session);
    const msg = buildToolResultInjectionMessage({
      tool: "match",
      result_data: prep.pending!.tool_result_data as Record<string, unknown>,
      original_question: "和老婆的关系",
    });
    assert(
      msg.includes("和老婆的关系") || msg.includes("用户的核心问题"),
      "injection ties to original topic",
    );
  });

  await scenario("8 配额计算（cycle 1 → cycle 2）", () => {
    let session = baseSession();
    session = recordToolSuggestion(session, "match", "a", "m");
    session = recordUserResponse(session, "match", "accepted");
    session = injectToolResult(session, "match", "r1", {});
    session = markToolResultInjected(session, "match", "r1");

    session = recordToolSuggestion(session, "syncro", "b", "s");
    session = recordUserResponse(session, "syncro", "declined");

    assert(checkToolQuota(session, "glyph").available, "glyph still available in cycle 1");

    session = startNewCycle(session, "孩子升学");
    assert(session.cycles!.length === 2, "cycle 2 exists");
    assert(checkToolQuota(session, "match").available, "match reset");
    assert(checkToolQuota(session, "syncro").available, "syncro reset after new cycle");
    assert(checkToolQuota(session, "glyph").available, "glyph reset");
  });

  await scenario("9 付费场景（配额已用 → quota_free=false）", () => {
    let session = baseSession();
    session = recordToolSuggestion(session, "match", "x", "first free");
    session = recordUserResponse(session, "match", "accepted");
    session = injectToolResult(session, "match", "paid-m", { summary: "done" });
    session = markToolResultInjected(session, "match", "paid-m");

    const freeSlot = checkToolQuota(session, "match").available;
    assert(!freeSlot, "no free POJU-sponsored slot");
    // UI: usePojuToolHandoff sets quota_free from checkPojuQuota → false → paid banner
    const quota_free = checkToolQuota(session, "match").available;
    assert(quota_free === false, "second match from POJU would be paid");
  });

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    console.log(`  [${mark}] ${r.id}${r.detail ? ` — ${r.detail}` : ""}`);
  }

  if (failed.length > 0) {
    throw new Error(`Step 7 E2E: ${failed.length}/${results.length} scenarios failed`);
  }

  console.log(`\ntest-tool-linking-step7-e2e: OK (${results.length} scenarios)`);
  console.log(
    "\nManual/browser checklist (requires staging + API keys):",
    "  • Scenario 1/3/4: live POJU LLM suggests/skips tools correctly",
    "  • Scenario 6/7: PojuDeepDiveCTA UI + payment-success inject",
    "  • Scenario 9: Match page shows $4.99 when quota_free=false",
  );
}

void run();
