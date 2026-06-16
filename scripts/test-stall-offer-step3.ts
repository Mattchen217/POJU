/**
 * Step 3 — stall offer routing smoke tests.
 * Run: npx tsx scripts/test-stall-offer-step3.ts
 */
import {
  applyPhaseTransition,
  createInitialAgentState,
  decidePhaseTransition,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import {
  classifyStallOfferReply,
  stallOfferChoiceToSuggestedPhase,
} from "@/lib/poju/stall-offer-routing";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function agent(partial: Partial<POJUAgentState> = {}): POJUAgentState {
  return {
    ...createInitialAgentState({ original_question: "Should I quit?" }),
    current_phase: "collecting_context",
    question_category: "career",
    stall_count: 2,
    collecting_turn_count: 3,
    ...partial,
  };
}

// classify replies
assert(classifyStallOfferReply("先给方向吧") === "degraded_delivery", "先给 → degraded");
assert(classifyStallOfferReply("愿意再聊两句") === "continue_collecting", "愿意 → continue");
assert(classifyStallOfferReply("我好烦啊不想说了") === "unclear", "vent → unclear/fallback");

// stall offer presentation → awaiting_confirmation + pending
const offerTransition = decidePhaseTransition({
  current_state: agent(),
  llm_suggested_phase: "awaiting_confirmation",
  user_message: "就那样吧",
  stall_offer: true,
  stop_loss: { triggered: true, reason: "Consecutive stall" },
  collecting_turn_count: 3,
  stall_count: 2,
});
assert(offerTransition.new_phase === "awaiting_confirmation", "stall offer → awaiting");
assert(offerTransition.stall_offer_pending === true, "stall_offer_pending set");

let afterOffer = applyPhaseTransition(agent(), offerTransition);
assert(afterOffer.stall_offer_pending === true, "state pending after offer");
assert(afterOffer.current_phase === "awaiting_confirmation", "phase awaiting");

// user picks continue
const continueTransition = decidePhaseTransition({
  current_state: { ...afterOffer, stall_offer_pending: true },
  llm_suggested_phase: stallOfferChoiceToSuggestedPhase("continue_collecting"),
  user_message: "愿意再聊，我补充一下",
});
assert(continueTransition.new_phase === "collecting_context", "continue → collecting");
assert(continueTransition.reset_stall_count === true, "stall reset");

let afterContinue = applyPhaseTransition(
  { ...afterOffer, stall_offer_pending: true, stall_count: 2 },
  continueTransition,
);
assert(afterContinue.stall_count === 0, "stall_count cleared");
assert(afterContinue.resume_collecting_low_barrier === true, "low barrier flag");

// user picks degraded
const degradedTransition = decidePhaseTransition({
  current_state: { ...afterOffer, stall_offer_pending: true },
  llm_suggested_phase: "delivered",
  user_message: "基于现有的先给我一个方向",
});
assert(degradedTransition.new_phase === "delivered", "degraded choice → delivered");
assert(degradedTransition.delivery_mode === "degraded", "degraded mode");

// fallback vent
const fallbackTransition = decidePhaseTransition({
  current_state: { ...afterOffer, stall_offer_pending: true },
  llm_suggested_phase: "awaiting_confirmation",
  user_message: "烦死了",
});
assert(fallbackTransition.delivery_mode === "degraded", "vent fallback degraded");
assert(fallbackTransition.new_phase === "delivered", "vent fallback delivered");

console.log("test-stall-offer-step3: all passed");
