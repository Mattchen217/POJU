/**
 * Step 2 — collection progress hard control smoke tests.
 * Run: npx tsx scripts/test-collection-progress-step2.ts
 */
import {
  createInitialAgentState,
  decidePhaseTransition,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import {
  applyCollectingTurnCounters,
  evaluateStopLoss,
  isPrematureCollectingPhase,
  nextStallCount,
  STALL_STOP_LOSS_THRESHOLD,
} from "@/lib/poju/collection-progress";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function agent(partial: Partial<POJUAgentState> = {}): POJUAgentState {
  return {
    ...createInitialAgentState({ original_question: "Should I quit?" }),
    question_category: "career",
    current_phase: "collecting_context",
    ...partial,
  };
}

function fullCareerContext(): POJUAgentState["context_collected"] {
  return {
    duration: "2 years",
    trigger_event: "passed over for promotion",
    emotional_state: "frustrated",
    what_tried: ["talked to manager"],
    desired_outcome: "clarity on next move",
    category_specific: {
      current_role: "engineer",
      years_experience: "5",
      industry: "tech",
      specific_issue: "stuck",
      duration_of_issue: "2y",
      workplace_relationships: "ok",
      financial_situation: "stable",
      family_support: "yes",
      desired_outcome: "promotion or exit",
    },
  };
}

// stall_count resets on advancing, increments on stalled/resistant
assert(nextStallCount(2, "advancing") === 0, "advancing resets stall");
assert(nextStallCount(1, "stalled") === 2, "stalled increments");
assert(nextStallCount(0, "resistant") === 1, "resistant increments");

// Rule ① — premature when turns < 3 and fields incomplete
assert(isPrematureCollectingPhase(agent(), 2), "premature at 2 turns incomplete");
assert(!isPrematureCollectingPhase(agent({ context_collected: fullCareerContext() }), 2), "not premature when complete");

// Rule ② — stop-loss triggers
assert(
  evaluateStopLoss({ stall_count: STALL_STOP_LOSS_THRESHOLD, collection_progress: "stalled", collecting_turn_count: 3 })
    .triggered,
  "stall_count >= 2 triggers",
);
assert(
  evaluateStopLoss({ stall_count: 0, collection_progress: "resistant", collecting_turn_count: 1 }).triggered,
  "resistant triggers immediately",
);
assert(
  evaluateStopLoss({ stall_count: 0, collection_progress: "advancing", collecting_turn_count: 8 }).triggered,
  "turn cap triggers",
);

// Counters accumulate in code
let a = agent({ stall_count: 1, collecting_turn_count: 2 });
const afterStall = applyCollectingTurnCounters(a, { isCollectingTurn: true, collection_progress: "stalled" });
assert(afterStall.stall_count === 2 && afterStall.collecting_turn_count === 3, "counter bump on stall");
const afterAdvance = applyCollectingTurnCounters(
  { ...a, stall_count: afterStall.stall_count, collecting_turn_count: afterStall.collecting_turn_count },
  { isCollectingTurn: true, collection_progress: "advancing" },
);
assert(afterAdvance.stall_count === 0 && afterAdvance.collecting_turn_count === 4, "advance resets stall");

// Full path — complete fields + enough turns → awaiting_confirmation + full mode
const complete = agent({ context_collected: fullCareerContext(), collecting_turn_count: 3, stall_count: 0 });
const fullTransition = decidePhaseTransition({
  current_state: complete,
  llm_suggested_phase: "awaiting_confirmation",
  user_message: "可以分析了",
  user_turn_count: 3,
  stall_count: 0,
  collecting_turn_count: 3,
  stop_loss: { triggered: false, reason: null },
});
assert(fullTransition.new_phase === "awaiting_confirmation", "full path to confirmation");
assert(fullTransition.delivery_mode === "full", "full delivery_mode");

// Stop-loss with stall offer → awaiting_confirmation (Step 3)
const stopLossTransition = decidePhaseTransition({
  current_state: agent({ collecting_turn_count: 2, stall_count: 2 }),
  llm_suggested_phase: "awaiting_confirmation",
  user_message: "就那样吧",
  user_turn_count: 2,
  stall_count: 2,
  collecting_turn_count: 2,
  stop_loss: evaluateStopLoss({
    stall_count: 2,
    collection_progress: "stalled",
    collecting_turn_count: 2,
  }),
  stall_offer: true,
});
assert(stopLossTransition.stop_loss_triggered === true, "stop-loss flagged");
assert(stopLossTransition.stall_offer_pending === true, "stall offer pending");
assert(stopLossTransition.new_phase === "awaiting_confirmation", "stall offer → awaiting");

console.log("test-collection-progress-step2: all passed");
