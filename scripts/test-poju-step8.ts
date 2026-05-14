import { repairLLMOutput, validateLLMOutput } from "@/lib/llm/output-validator";

const validJson = {
  response: "Thanks for sharing. I can see both pressure and possibility in your situation.",
  user_intent: "sharing_situation",
  current_state: "collecting_context",
  action_requested: "continue_chat",
  topic_drift_detected: false,
  context_updates: { concern_area: "career" },
  contains_delivery: false,
};

const missingFields = {
  response: "I hear you. Let's go one layer deeper before concluding.",
  current_state: "collecting_context",
  topic_drift_detected: false,
  context_updates: {},
  contains_delivery: false,
};

const plainText = "This is plain text, not JSON.";

const badDelivery = {
  response: "Here is your full delivery.",
  user_intent: "sharing_situation",
  current_state: "delivered",
  action_requested: "deliver_main",
  topic_drift_detected: false,
  context_updates: {},
  contains_delivery: true,
  main_delivery: null,
  new_actions: [],
};

function log(name: string, input: any, locale = "en") {
  console.log(`\n=== ${name} ===`);
  console.log("INPUT:");
  console.log(JSON.stringify(input, null, 2));
  const validation = validateLLMOutput(input);
  console.log("VALIDATION:");
  console.log(JSON.stringify(validation, null, 2));
  if (!validation.valid) {
    const repaired = repairLLMOutput(input, locale);
    console.log("REPAIRED:");
    console.log(JSON.stringify(repaired, null, 2));
  }
}

console.log("=== Step 8 Output Validator Tests ===");
log("场景1 正常 JSON", validJson, "en");
log("场景2 缺少字段", missingFields, "zh");
log("场景3 完全 parse 失败（模拟传入纯文本对象）", { response: plainText }, "en");
log("场景4 contains_delivery=true 但 main_delivery=null", badDelivery, "zh");
