import { callPOJULLM } from "@/lib/llm/poju-llm";
import type { POJUSessionState, POJUMessage } from "@/lib/poju/types";

function mkSession(originalQuestion: string, messages: POJUMessage[] = []): POJUSessionState {
  const now = new Date().toISOString();
  return {
    session_id: "step6-test",
    device_id: "dev-test",
    original_question: originalQuestion,
    messages,
    context_collected: {},
    has_profile: false,
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

async function run(name: string, locale: string, originalQuestion: string, userMessages: string[]) {
  const messages: POJUMessage[] = userMessages.map((m) => ({
    role: "user",
    content: m,
    timestamp: new Date().toISOString(),
  }));
  const session = mkSession(originalQuestion, messages);
  const out = await callPOJULLM({ session, profile: null, locale });
  console.log(`\n=== ${name} ===`);
  console.log("INPUT:");
  console.log(JSON.stringify({ locale, originalQuestion, userMessages }, null, 2));
  console.log("OUTPUT:");
  console.log(JSON.stringify(out, null, 2));
}

void (async () => {
  await run("场景1 中文问候", "zh", "我最近事业不顺，该怎么办？", ["你好"]);
  await run("场景2 英文问候", "en", "Should I quit my current job?", ["Hello"]);
  await run("场景3 立即分享困境", "en", "I feel stuck in career decisions", [
    "I keep losing motivation in my work, no matter what I do",
  ]);
  await run("场景4 偏离话题", "en", "Should I stay in this relationship?", ["What's the weather today?"]);
  await run("场景5 多轮后应请求表单", "zh", "我事业不顺该怎么办", [
    "我最近跟上司冲突很严重",
    "这个问题大概持续了半年",
    "我试过沟通但没用",
    "我现在纠结是否离职",
  ]);
})();
