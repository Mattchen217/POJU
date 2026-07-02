/**
 * POJU v6 — Prefix Cache 稳定性：system 字符串 SHA256 字节恒定校验。
 *
 *   pnpm exec tsx scripts/test-poju-v6-prefix-cache-stability.ts
 */
import { createHash } from "node:crypto";

import { calculateProfile } from "@/lib/calculations";
import { buildProfileStructured } from "@/lib/calculations/build-profile-structured";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildPhaseTransportInputV6 } from "@/lib/llm/phases/oriental-prompt-context-v6";
import { buildOpeningTaskBlockV6 } from "@/lib/llm/phases/opening-phase-v6";
import { buildCollectingTaskBlockV6 } from "@/lib/llm/phases/collecting-phase-v6";
import { buildConfirmationTaskBlockV6 } from "@/lib/llm/phases/confirmation-phase-v6";
import { buildDeliveryTaskBlockV6 } from "@/lib/llm/phases/delivery-phase-v6";
import { buildTrackingTaskBlockV6 } from "@/lib/llm/phases/tracking-phase-v6";
import { POJU_OUTPUT_DATA_DISCIPLINE } from "@/lib/llm/prompts/poju-base";
import { POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";
import type { BirthInfo } from "@/lib/profile/types";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function assert(label: string, ok: boolean): void {
  if (!ok) {
    console.error("FAIL:", label);
    process.exit(1);
  }
  console.log("OK:", label);
}

async function buildProfile(birth: BirthInfo, id: string) {
  const profile = await calculateProfile(birth);
  profile.id = id;
  return profile;
}

type TestPhase =
  | "opening"
  | "collecting_context"
  | "awaiting_confirmation"
  | "delivered"
  | "tracking";

function makePhaseInput(opts: {
  profile: Awaited<ReturnType<typeof buildProfile>>;
  base_analysis: unknown;
  original_question: string;
  phase: TestPhase;
  locale: string;
}): PhaseLLMInput {
  const agent = createInitialAgentState({
    original_question: opts.original_question,
    selected_profile_id: opts.profile.id,
  });
  agent.current_phase = opts.phase;
  if (opts.phase === "collecting_context") {
    agent.question_category = "career";
    agent.breakthrough_core = {
      relationship_conclusion: "结构性张力已确立（测试桩）",
      breakthrough_directions: [
        {
          direction: "先松动一层再推进",
          structural_basis: "strength + yong_shen",
          timing: "当前大运宜守",
          what_would_confirm: "用户亲口验证",
          status: "selected",
        },
      ],
      generated_at: new Date().toISOString(),
    };
    agent.investigation_agenda = [
      {
        id: "agenda_1",
        label: "卡点触发场景",
        critical: true,
        status: "unexplored",
        supports: "",
      },
    ];
    agent.agenda_generated = true;
  }
  if (opts.phase === "tracking" || opts.phase === "delivered") {
    agent.question_category = "career";
    agent.actions = [
      {
        action_id: "a1",
        given_at: new Date().toISOString(),
        category: "modern_decisive",
        text: "本周完成一次小步验证",
        status: "pending",
        timing: "this_week",
        rationale: "测试桩行动",
      },
    ];
  }

  return {
    session: {
      session_id: `test-${opts.profile.id}-${opts.phase}`,
      original_question: opts.original_question,
      messages: [{ role: "user", content: "测试用户消息", timestamp: new Date().toISOString() }],
      selected_stored_profile_id: opts.profile.id,
      profile_skipped: false,
      main_delivery_done: opts.phase === "tracking" || opts.phase === "delivered",
      agent_v2: agent,
    },
    profile: opts.profile,
    base_analysis: opts.base_analysis,
    locale: opts.locale,
    user_message: "测试用户消息",
    agent_state: agent,
    archive_data: null,
    tool_injection_context: null,
  } as PhaseLLMInput;
}

function taskBlockForPhase(input: PhaseLLMInput, phase: string): string {
  switch (phase) {
    case "opening":
      return buildOpeningTaskBlockV6(input);
    case "collecting_context":
      return buildCollectingTaskBlockV6(input);
    case "awaiting_confirmation":
      return buildConfirmationTaskBlockV6(input, "wrap_up");
    case "delivered":
      return buildDeliveryTaskBlockV6(input);
    case "tracking":
      return buildTrackingTaskBlockV6(input);
    default:
      return "";
  }
}

async function main(): Promise<void> {
  const profileA = await buildProfile(
    {
      year: 1985,
      month: 8,
      day: 20,
      hour_period: "wu",
      gender: "F",
      timezone: "America/New_York",
    },
    "v6-cache-test-profile-a",
  );

  const profileB = await buildProfile(
    {
      year: 1992,
      month: 3,
      day: 15,
      hour_period: "zi_early",
      gender: "M",
      timezone: "Asia/Shanghai",
    },
    "v6-cache-test-profile-b",
  );

  const structuredA = buildProfileStructured({ profile: profileA });
  const structuredB = buildProfileStructured({ profile: profileB });

  const baseA = {
    display_text: "Profile A base analysis — 庚金结构",
    content: "mock-a",
    structured: structuredA,
  };
  const baseB = {
    display_text: "Profile B base analysis — 甲木结构",
    content: "mock-b",
    structured: structuredB,
  };

  const scenarios: Array<{
    label: string;
    profile: typeof profileA;
    base_analysis: unknown;
    phase: TestPhase;
    locale: string;
    question: string;
  }> = [
    {
      label: "ProfileA · opening · zh",
      profile: profileA,
      base_analysis: baseA,
      phase: "opening",
      locale: "zh",
      question: "职业转型是否该在此时推进？",
    },
    {
      label: "ProfileB · opening · en",
      profile: profileB,
      base_analysis: baseB,
      phase: "opening",
      locale: "en",
      question: "Should I commit to this major life change now?",
    },
    {
      label: "ProfileA · collecting · zh",
      profile: profileA,
      base_analysis: baseA,
      phase: "collecting_context",
      locale: "zh",
      question: "职业转型是否该在此时推进？",
    },
    {
      label: "ProfileB · collecting · en",
      profile: profileB,
      base_analysis: baseB,
      phase: "collecting_context",
      locale: "en",
      question: "Should I commit to this major life change now?",
    },
    {
      label: "ProfileA · tracking · zh",
      profile: profileA,
      base_analysis: baseA,
      phase: "tracking",
      locale: "zh",
      question: "职业转型是否该在此时推进？",
    },
    {
      label: "ProfileB · awaiting_confirmation · en",
      profile: profileB,
      base_analysis: baseB,
      phase: "awaiting_confirmation",
      locale: "en",
      question: "Should I commit to this major life change now?",
    },
    {
      label: "ProfileA · delivered · zh",
      profile: profileA,
      base_analysis: baseA,
      phase: "delivered",
      locale: "zh",
      question: "职业转型是否该在此时推进？",
    },
  ];

  const staticHash = sha256(POJU_V6_STATIC_SYSTEM);
  console.log("\n=== POJU v6 Prefix Cache Stability ===\n");
  console.log("POJU_V6_STATIC_SYSTEM SHA256:", staticHash);
  console.log("POJU_V6_STATIC_SYSTEM length:", POJU_V6_STATIC_SYSTEM.length, "chars\n");

  const systemHashes: string[] = [];
  const turnContextLengths: number[] = [];

  for (const s of scenarios) {
    const input = makePhaseInput({
      profile: s.profile,
      base_analysis: s.base_analysis,
      original_question: s.question,
      phase: s.phase,
      locale: s.locale,
    });
    const taskBlock = taskBlockForPhase(input, s.phase);
    const { system, messages } = await buildPhaseTransportInputV6(input, taskBlock);

    const hash = sha256(system);
    systemHashes.push(hash);

    const lastUser = messages.filter((m) => m.role === "user").pop();
    const turnLen = lastUser?.content.length ?? 0;
    turnContextLengths.push(turnLen);

    const userContent = lastUser?.content ?? "";
    const hasDirectedInventory = userContent.includes("本盘动态关系实例（流年/定向");
    const hasDirectedGuard = userContent.includes("流年/定向动态关系");

    console.log(`[${s.label}]`);
    console.log("  system SHA256:", hash);
    console.log("  system === static constant:", system === POJU_V6_STATIC_SYSTEM);
    console.log("  user prepend length:", turnLen);
    console.log("  directed inventory block:", hasDirectedInventory);
    console.log("  directed guard block:", hasDirectedGuard);

    if (s.phase === "opening") {
      assert(`${s.label} · opening has no directed inventory`, !hasDirectedInventory);
      assert(`${s.label} · opening has no directed guard`, !hasDirectedGuard);
    }
    if (s.phase === "collecting_context" || s.phase === "delivered") {
      assert(`${s.label} · downstream has directed inventory`, hasDirectedInventory);
      assert(`${s.label} · downstream has directed guard`, hasDirectedGuard);
      assert(
        `${s.label} · user turn includes data discipline`,
        userContent.includes("数据变多后的克制铁律"),
      );
    }
  }

  assert(
    "POJU_OUTPUT_DATA_DISCIPLINE exported",
    POJU_OUTPUT_DATA_DISCIPLINE.includes("算全 · 不写全"),
  );

  const uniqueSystemHashes = new Set(systemHashes);
  assert(
    "all scenarios share identical system SHA256",
    uniqueSystemHashes.size === 1,
  );
  assert(
    "system SHA256 matches POJU_V6_STATIC_SYSTEM",
    systemHashes.every((h) => h === staticHash),
  );
  assert(
    "turn context varies across profile/phase (at least 2 distinct lengths)",
    new Set(turnContextLengths).size >= 2,
  );

  console.log("\nAll prefix cache stability checks passed.");
  console.log("Unified system hash:", staticHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
