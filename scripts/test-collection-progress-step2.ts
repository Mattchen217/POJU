/**
 * Investigation agenda + delivery rhythm v2 smoke tests.
 * Run: npx tsx scripts/test-collection-progress-step2.ts
 */
import {
  createInitialAgentState,
  decidePhaseTransition,
  MIN_COLLECTING_USER_TURNS,
  PUSH_MIN_TURNS,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import {
  applyCollectingTurnCounters,
  evaluateStopLoss,
  isPrematureCollectingPhase,
  MAX_COLLECTING_TURNS,
  nextStallCount,
  parseCollectionProgress,
  projectCollectingStopLoss,
  REFUND_SUGGEST_THRESHOLD,
  resolvePreCallEscalation,
  shouldSuggestRefund,
  STALL_STOP_LOSS_THRESHOLD,
} from "@/lib/poju/collection-progress";
import {
  applyAgendaStatusUpdates,
  computeCollectingPullback,
  detectDeliveryRequest,
  getNextAgendaFocus,
  parseInvestigationAgenda,
  userHardPushed,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function sampleAgenda(partial: Partial<Record<string, AgendaItem["status"]>> = {}): AgendaItem[] {
  const base: AgendaItem[] = [
    { id: "timeline", label: "时间线与触发", critical: true, status: "unexplored" },
    { id: "what_tried", label: "已试手段", critical: true, status: "unexplored" },
    { id: "constraints", label: "外部约束", critical: true, status: "unexplored" },
    { id: "stakes", label: "真实诉求", critical: true, status: "unexplored" },
    { id: "resources", label: "可用资源", critical: false, status: "unexplored" },
    { id: "exit_cost", label: "退出成本", critical: false, status: "unexplored" },
    { id: "energy", label: "精力临界", critical: false, status: "unexplored" },
  ];
  return base.map((item) => ({
    ...item,
    status: partial[item.id] ?? item.status,
  }));
}

function coveredAgenda(): AgendaItem[] {
  return sampleAgenda({
    timeline: "covered",
    what_tried: "covered",
    constraints: "covered",
    stakes: "covered",
    resources: "covered",
    exit_cost: "covered",
    energy: "covered",
  });
}

function agent(partial: Partial<POJUAgentState> = {}): POJUAgentState {
  return {
    ...createInitialAgentState({ original_question: "Should I quit my cafe?" }),
    question_category: "decision",
    current_phase: "collecting_context",
    agenda_generated: true,
    investigation_agenda: sampleAgenda(),
    ...partial,
  };
}

// Agenda parsing
const parsed = parseInvestigationAgenda(
  sampleAgenda().map(({ id, label, critical, status }) => ({ id, label, critical, status })),
);
assert(parsed !== null && parsed.length === 7, "parse investigation agenda");

const withSupports = parseInvestigationAgenda([
  { id: "a", label: "现金流 runway", critical: true, status: "unexplored", supports: "止损收缩" },
  { id: "b", label: "调价历史", critical: true, status: "unexplored", supports: "提价筛客" },
  { id: "c", label: "竞争冲击时间线", critical: true, status: "unexplored", supports: "止损收缩" },
  { id: "d", label: "精力临界", critical: false, status: "unexplored" },
  { id: "e", label: "可动用资源", critical: false, status: "unexplored" },
  { id: "f", label: "真实诉求权重", critical: false, status: "unexplored" },
]);
assert(withSupports !== null && withSupports[0]!.supports === "止损收缩", "supports parsed and passed through");
assert(
  withSupports!.every((i) => typeof i.supports === "string"),
  "supports defaults to string on all items",
);

const focusAgenda: AgendaItem[] = [
  { id: "a", label: "A", critical: true, status: "covered", supports: "hyp-A" },
  { id: "b", label: "B", critical: true, status: "unexplored", supports: "hyp-A" },
  { id: "c", label: "C", critical: true, status: "unexplored", supports: "hyp-B" },
  { id: "d", label: "D", critical: false, status: "unexplored" },
  { id: "e", label: "E", critical: false, status: "unexplored" },
  { id: "f", label: "F", critical: false, status: "unexplored" },
  { id: "g", label: "G", critical: false, status: "unexplored" },
];
const focus = getNextAgendaFocus(focusAgenda);
assert(focus.length === 2, "focus returns up to 2 items");
assert(
  focus.every((f) => f.critical && f.supports?.trim()),
  "focus prioritizes critical items tied to active hypotheses",
);
assert(focus.some((f) => f.id === "b"), "focus includes hyp-A critical item");

assert(resolvePreCallEscalation({ collecting_pullback: true }) === "delivery_pullback", "pullback tier");
assert(resolvePreCallEscalation({ agent: agent({ stall_count: 0 }) }) === "L1", "first stall tier L1");
assert(resolvePreCallEscalation({ agent: agent({ stall_count: 1 }) }) === "L2", "stall_count≥1 → L2");
assert(
  resolvePreCallEscalation({ agent: agent({ stall_count: 3 }) }) === "refund",
  "stall_count≥3 → refund tier",
);

const lowBarrier = agent({ resume_collecting_low_barrier: true, stall_count: 0 });
assert(
  shouldSuggestRefund({
    agent: lowBarrier,
    collection_progress: "resistant",
  }),
  "post stall-offer resistant → suggest refund",
);
assert(
  !shouldSuggestRefund({
    agent: agent({ stall_count: 1 }),
    collection_progress: "advancing",
    stall_offer: true,
  }),
  "stall offer turn skips suggest_refund",
);
assert(REFUND_SUGGEST_THRESHOLD >= STALL_STOP_LOSS_THRESHOLD, "refund after stall-offer path");

// Delivery request vs hard push
assert(detectDeliveryRequest("给我分析一下该怎么办"), "casual delivery request");
assert(!userHardPushed("可以分析了，给点建议"), "casual analysis is not hard push");
assert(userHardPushed("直接给结论，不用再问了"), "hard push detected");

// Pullback when agenda unsatisfied
assert(
  computeCollectingPullback({
    userMessage: "show me the report",
    agent: agent(),
    userTurns: 3,
  }),
  "pullback when delivery requested and agenda open",
);

// Stall counters unchanged
assert(nextStallCount(2, "advancing") === 0, "advancing resets stall");

// Premature: turns < 7 or agenda incomplete
assert(isPrematureCollectingPhase(agent(), 3), "premature at 3 user turns");
assert(
  isPrematureCollectingPhase(agent({ investigation_agenda: coveredAgenda() }), 3),
  "premature at 3 turns even with covered agenda",
);
assert(
  !isPrematureCollectingPhase(agent({ investigation_agenda: coveredAgenda(), turn_count: 7 }), 7),
  "not premature at 7 turns with covered agenda",
);

// Blocked: 6 turns + full agenda
const almost = agent({ investigation_agenda: coveredAgenda(), turn_count: 6 });
const blocked = decidePhaseTransition({
  current_state: almost,
  llm_suggested_phase: "awaiting_confirmation",
  user_message: "继续",
  user_turn_count: 6,
  collecting_turn_count: 6,
  stop_loss: { triggered: false, reason: null },
});
assert(!blocked.should_transition, "6 turns blocked");
assert(blocked.new_phase === "collecting_context", "stays collecting");

// Allowed: 7 turns + agenda satisfied
const ready = agent({ investigation_agenda: coveredAgenda(), turn_count: MIN_COLLECTING_USER_TURNS });
const ok = decidePhaseTransition({
  current_state: ready,
  llm_suggested_phase: "awaiting_confirmation",
  user_message: "好",
  user_turn_count: MIN_COLLECTING_USER_TURNS,
  collecting_turn_count: MIN_COLLECTING_USER_TURNS,
  stop_loss: { triggered: false, reason: null },
});
assert(ok.new_phase === "awaiting_confirmation", "7 turns + agenda → confirmation");

// Hard push early path
const pushAgenda = applyAgendaStatusUpdates(sampleAgenda(), {
  timeline: "covered",
  what_tried: "covered",
  constraints: "covered",
  stakes: "covered",
  resources: "covered",
  exit_cost: "partial",
});
const pushState = agent({ investigation_agenda: pushAgenda, turn_count: PUSH_MIN_TURNS });
const push = decidePhaseTransition({
  current_state: pushState,
  llm_suggested_phase: "awaiting_confirmation",
  user_message: "skip ahead, just give me the result",
  user_turn_count: PUSH_MIN_TURNS,
  collecting_turn_count: PUSH_MIN_TURNS,
  stop_loss: { triggered: false, reason: null },
});
assert(push.new_phase === "awaiting_confirmation", "hard push at 4 turns + 60% coverage");

// Casual analyze must NOT transition at 4 turns
const casual = decidePhaseTransition({
  current_state: agent({ turn_count: 4 }),
  llm_suggested_phase: "awaiting_confirmation",
  user_message: "可以分析了，给点建议",
  user_turn_count: 4,
  collecting_turn_count: 4,
  stop_loss: { triggered: false, reason: null },
});
assert(!casual.should_transition, "casual analyze blocked");

// Pullback signal on blocked delivery request
const pullbackTransition = decidePhaseTransition({
  current_state: agent({ turn_count: 3 }),
  llm_suggested_phase: "collecting_context",
  user_message: "告诉我该怎么办",
  user_turn_count: 3,
  collecting_turn_count: 3,
  stop_loss: { triggered: false, reason: null },
});
assert(pullbackTransition.pullback === true, "pullback flag set");

// Stop-loss still works
assert(
  evaluateStopLoss({ stall_count: STALL_STOP_LOSS_THRESHOLD, collection_progress: "stalled", collecting_turn_count: 3 })
    .triggered,
  "stall_count triggers",
);
assert(
  evaluateStopLoss({ stall_count: 0, collection_progress: "advancing", collecting_turn_count: MAX_COLLECTING_TURNS })
    .triggered,
  "turn cap triggers",
);

let a = agent({ stall_count: 1, collecting_turn_count: 2 });
const afterStall = applyCollectingTurnCounters(a, { isCollectingTurn: true, collection_progress: "stalled" });
assert(afterStall.stall_count === 2 && afterStall.collecting_turn_count === 3, "counter bump on stall");

console.log("test-collection-progress-step2: all passed");
