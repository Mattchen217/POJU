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
  STALL_STOP_LOSS_THRESHOLD,
} from "@/lib/poju/collection-progress";
import {
  applyAgendaStatusUpdates,
  computeCollectingPullback,
  detectDeliveryRequest,
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
