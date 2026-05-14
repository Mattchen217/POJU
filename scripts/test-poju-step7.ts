import { callPOJULLM } from "@/lib/llm/poju-llm";
import type { POJUSessionState, POJUMessage } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

function mkSession(originalQuestion: string, messages: POJUMessage[], context: Record<string, unknown>): POJUSessionState {
  const now = new Date().toISOString();
  return {
    session_id: "step7-test",
    device_id: "dev-test",
    original_question: originalQuestion,
    messages,
    context_collected: context,
    has_profile: true,
    profile_skipped: false,
    actions: [],
    main_delivery_done: false,
    main_delivery: null,
    tokens_used: 0,
    abuse_metrics: {
      long_input_count: 0,
      jailbreak_attempts: 0,
      duplicate_attempts: 0,
    },
    created_at: now,
    last_interaction_at: now,
    expires_at: now,
  };
}

const profile: UserProfile = {
  id: "u-step7",
  birth: { year: 1977, month: 2, day: 17, hour: 3, minute: 0, gender: "male", city: "Shanghai" },
  bazi: {
    yearPillar: "丁巳",
    monthPillar: "壬寅",
    dayPillar: "甲子",
    hourPillar: "丙寅",
  },
  diagnosis: {
    dayMaster: "Wood",
    favorableElements: ["Water"],
    challengingElements: ["Metal"],
    patternSummary: "Reflective strategist with delayed but compounding momentum.",
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  source: "fallback",
};

async function run(name: string, locale: string, originalQuestion: string, userMessages: string[], context: Record<string, unknown>) {
  const messages: POJUMessage[] = userMessages.map((m) => ({
    role: "user",
    content: m,
    timestamp: new Date().toISOString(),
  }));
  const session = mkSession(originalQuestion, messages, context);
  const out = await callPOJULLM({ session, profile, locale });
  console.log(`\n=== ${name} ===`);
  console.log("INPUT:");
  console.log(JSON.stringify({ locale, originalQuestion, userMessages, context, profile: profile.diagnosis }, null, 2));
  console.log("OUTPUT:");
  console.log(JSON.stringify(out, null, 2));
}

void (async () => {
  await run(
    "场景1 Profile 完成后第一次响应",
    "zh",
    "我事业不顺,该怎么办",
    ["[SYSTEM: Birth info just collected. Please acknowledge and continue.]", "我现在很焦虑，不知道怎么走下一步"],
    { concern_area: "career", anxiety: true },
  );

  await run(
    "场景2 多轮深度对话",
    "zh",
    "我事业不顺,该怎么办",
    ["我最近跟上司冲突越来越多", "导火索是上周绩效会议", "我已经尝试过私下沟通", "我怕离职后收入下降"],
    { concern_area: "career", manager_conflict: true, attempted_dialogue: true, fear: "income_drop" },
  );

  await run(
    "场景3 应触发主交付",
    "zh",
    "我事业不顺,该怎么办",
    ["我已经把情况都说了，你给我一个完整建议吧", "我希望是能执行的方案，不要空话"],
    {
      concern_area: "career",
      specific_incident: "performance_review_conflict",
      involved_people: ["manager"],
      attempted_actions: ["private_talk"],
      desired_outcome: "stabilize_and_upgrade",
      context_sufficient: true,
    },
  );
})();
