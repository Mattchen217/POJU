/**
 * Block 5 总验收 — 必锚命盘收口 + breakthrough-core 空盘护栏（无 LLM live）。
 *
 *   pnpm exec tsx scripts/test-poju-block5-acceptance.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildBreakthroughCorePrompt,
  resolveBaseAnalysisForBreakthrough,
} from "@/lib/llm/deepseek/breakthrough-core";
import { resolveActiveAgentPhase } from "@/lib/llm/poju-phase-router";
import type { POJUSessionState } from "@/lib/poju/types";
import { createInitialAgentState } from "@/lib/poju/agent-state";

const ROOT = resolve(__dirname, "..");
const failures: string[] = [];

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function grepCount(pattern: string, rel: string): number {
  const src = read(rel);
  const re = new RegExp(pattern, "g");
  return src.match(re)?.length ?? 0;
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walkTsFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

function countProfileSkippedTrueInCode(): number {
  const roots = ["lib", "components", "app"].map((d) => resolve(ROOT, d));
  let count = 0;
  for (const root of roots) {
    for (const file of walkTsFiles(root)) {
      const hits = readFileSync(file, "utf8").match(/profile_skipped:\s*true/g);
      count += hits?.length ?? 0;
    }
  }
  return count;
}

function assert(name: string, ok: boolean, detail = ""): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function mockSession(overrides: Partial<POJUSessionState> = {}): POJUSessionState {
  return {
    session_id: "sess-block5",
    original_question: "该不该换工作？",
    messages: [{ role: "user", content: "我卡了三年", timestamp: "2026-01-01T00:00:00.000Z" }],
    selected_stored_profile_id: null,
    has_profile: false,
    profile_skipped: false,
    birth_submitted_in_session: false,
    main_delivery_done: false,
    tokens_used: 0,
    context_collected: createInitialAgentState({ original_question: "该不该换工作？" }).context_collected,
    agent_v2: createInitialAgentState({ original_question: "该不该换工作？" }),
    ...overrides,
  } as POJUSessionState;
}

const MIN_STRUCTURED = {
  structured: {
    day_master: { stem: "庚", element: "金" },
    strength: "weak",
    yong_shen: "水",
    pattern: "七杀",
  },
};

function phase1ProfileAnchorTests(): void {
  console.log("\n=== 1. 锁死跳过入口（必锚命盘） ===\n");

  const ui = read("components/poju/POJUChatUI.tsx");
  assert("no profile_skipped: true in app/lib/components", countProfileSkippedTrueInCode() === 0);
  assert("POJUChatUI no onSkip", !ui.includes("onSkip"));
  assert("POJUChatUI no handleProfileSkipped", !ui.includes("handleProfileSkipped"));
  assert(
    "birth flow effect uses has_profile only",
    ui.includes("if (resolveSessionHasProfile(session))") &&
      !ui.match(/resolveSessionHasProfile\(session\) \|\| session\.profile_skipped/),
  );

  const router = read("lib/llm/poju-phase-router.ts");
  assert("phase router no profile_skipped branch", !router.includes("session.profile_skipped"));

  const noProfile = mockSession();
  assert(
    "no-profile session stays opening after user turn",
    resolveActiveAgentPhase(noProfile) === "opening",
  );

  const withProfile = mockSession({ has_profile: true, agent_v2: undefined });
  assert(
    "profile session advances to collecting (router fallback)",
    resolveActiveAgentPhase(withProfile) === "collecting_context",
  );

  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("showProfilePicker no profile_skipped guard", !orch.includes("!s.profile_skipped"));
}

function phase2BreakthroughGuardTests(): void {
  console.log("\n=== 2. breakthrough-core 空命盘护栏 ===\n");

  const bt = read("lib/llm/deepseek/breakthrough-core.ts");
  assert("resolve uses uuidLike on both ids", bt.includes("uuidLike(session.selected_stored_profile_id)"));
  assert("request throws on missing base_analysis", bt.includes("命主基础分析缺失，无法锚定深测算"));
  assert("prompt no silent empty fallback", !bt.includes("未提供命主基础分析"));
  assert("prompt throws on null structured", bt.includes("structured 命盘为空，拒绝生成脊柱"));

  const route = read("app/api/poju/breakthrough-core/route.ts");
  assert("route 422 on null base_analysis", route.includes("status: 422") && route.includes("命主基础分析缺失"));

  let threwNull = false;
  try {
    buildBreakthroughCorePrompt({
      base_analysis: null,
      agent_v2: null,
      original_question: "career",
      locale: "zh",
    });
  } catch (e) {
    threwNull = e instanceof Error && e.message.includes("structured 命盘为空");
  }
  assert("buildBreakthroughCorePrompt rejects null base_analysis", threwNull);

  let threwNoStructured = false;
  try {
    buildBreakthroughCorePrompt({
      base_analysis: { content: "text only, no structured" },
      agent_v2: null,
      original_question: "career",
      locale: "zh",
    });
  } catch (e) {
    threwNoStructured = e instanceof Error && e.message.includes("structured 命盘为空");
  }
  assert("buildBreakthroughCorePrompt rejects missing structured", threwNoStructured);

  const ok = buildBreakthroughCorePrompt({
    base_analysis: MIN_STRUCTURED,
    agent_v2: null,
    original_question: "career",
    locale: "en",
  });
  assert("valid structured still builds prompt", ok.system.includes("破局总设计师"));
}

async function resolveIdStrictTests(): Promise<void> {
  console.log("\n=== 3. resolveBaseAnalysisForBreakthrough 严格 id ===\n");

  const session = mockSession({
    selected_stored_profile_id: "active_user_profile",
    agent_v2: {
      ...createInitialAgentState({ original_question: "x" }),
      selected_profile_id: "active_user_profile",
    },
  });
  const resolved = await resolveBaseAnalysisForBreakthrough(session);
  assert("active_user_profile resolves to null", resolved === null);
}

function degradedPipelineIntactTests(): void {
  console.log("\n=== 4. 止损路径完好（runDegradedDeliveryPipeline） ===\n");

  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("runDegradedDeliveryPipeline exported", orch.includes("export async function runDegradedDeliveryPipeline"));
  assert("degraded branch in orchestrator", orch.includes('delivery_mode === "degraded"'));
  assert("runDegradedDeliveryPipeline call present", grepCount("runDegradedDeliveryPipeline", "lib/poju/agent-orchestrator.ts") >= 2);
}

async function main(): Promise<void> {
  console.log("\n========== POJU Block 5 Acceptance ==========\n");

  phase1ProfileAnchorTests();
  phase2BreakthroughGuardTests();
  await resolveIdStrictTests();
  degradedPipelineIntactTests();

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`${failures.length} check(s) FAILED:\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("All Block 5 acceptance checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
