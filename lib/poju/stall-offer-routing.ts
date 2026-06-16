/** Code routing for user replies after a stop-loss stall offer (Step 3). */

export type StallOfferUserChoice = "continue_collecting" | "degraded_delivery" | "unclear";

const DEGRADED_PATTERNS =
  /(?:先给|直接说|基于现在|基于目前|基于现有|不用问了|就这样吧?|你给方向|给我方向|先分析|你来看|你来说|tell me now|just tell|based on what|go ahead|give me (?:a )?direction|work with what you have)/i;

const CONTINUE_PATTERNS =
  /(?:愿意|再聊|继续|补上|说说看|可以继续|我再|补充|add more|want to (?:continue|share|add|talk)|yes.*(?:chat|talk|share)|ok.*(?:add|share)|let'?s continue)/i;

export function classifyStallOfferReply(message: string): StallOfferUserChoice {
  const m = message.trim();
  if (!m || m.startsWith("[SYSTEM:")) return "unclear";
  if (DEGRADED_PATTERNS.test(m)) return "degraded_delivery";
  if (CONTINUE_PATTERNS.test(m)) return "continue_collecting";
  return "unclear";
}

export function stallOfferChoiceToSuggestedPhase(choice: StallOfferUserChoice): "collecting_context" | "delivered" {
  return choice === "continue_collecting" ? "collecting_context" : "delivered";
}
