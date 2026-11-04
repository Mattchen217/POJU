/**
 * LAB undo last step.
 *   pnpm exec tsx scripts/test-lab-pipeline-undo.ts
 */
import assert from "node:assert/strict";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { labUndoLastStep, labUndoTarget } from "@/lib/llm/pro/delivery/lab/pipeline-undo";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import type { POJUSessionState } from "@/lib/poju/types";

function baseLab(
  session: POJUSessionState,
  turns: NonNullable<DeliveryLabSession["pipeline_turns"]>,
  extra?: Partial<DeliveryLabSession>,
): DeliveryLabSession {
  return {
    version: 1,
    lab_id: "lab_undo_test",
    created_at: Date.now(),
    updated_at: Date.now(),
    ops_user: "ops",
    cursor_index: 0,
    approved_order: [],
    steps: {},
    artifacts: {},
    source: {
      locale: "zh",
      original_question: "要不要创业",
      desired_outcome: "",
      session_id: session.session_id,
      covered_agenda: [],
      base_analysis: null,
      breakthrough_core: session.agent_v2?.breakthrough_core ?? undefined,
    },
    mode: "full_pipeline",
    chat_session: session,
    pipeline_turns: turns,
    pipeline_cursor: "opening",
    pipeline_delivery_unlocked: false,
    pipeline_pending_job: null,
    ...extra,
  };
}

function main() {
  console.log("\n========== LAB · undo last step ==========\n");

  const agent = createInitialAgentState({ original_question: "要不要创业" });
  const sessionId = "sess_undo_1";

  const chatSession: POJUSessionState = {
    session_id: sessionId,
    original_question: "要不要创业",
    messages: [
      { role: "user", content: "我想弄清动机", timestamp: "t1" },
      { role: "assistant", content: "好，这个方向很清晰。", timestamp: "t2" },
    ],
    actions: [],
    tokens_used: 0,
    created_at: "t0",
    expires_at: "t9",
    last_interaction_at: "t2",
    agent_v2: { ...agent, current_phase: "opening" },
  };
  const withChat = baseLab(chatSession, [
    {
      turn_id: "pt1",
      phase: "opening",
      kind: "chat",
      user_input: "我想弄清动机",
      attempts: [],
    },
  ]);
  assert.equal(labUndoTarget(withChat)?.kind, "chat");
  const undoneChat = labUndoLastStep(withChat);
  assert.equal(undoneChat.pipeline_turns?.length ?? 0, 0);
  assert.equal(undoneChat.chat_session?.messages.length ?? 0, 0);
  console.log("  [PASS] undo chat drops bubble + turn");

  const fakeCore = {
    situation_conclusion: "结",
    key_crossroads: { fork_a: "", fork_b: "", tension: "" },
    modern_action_frames: [],
    energy_retune_frame: { element_focus: "", habit_shift: "", environment_cue: "" },
    rhythm_frame: { pace: "", window: "" },
    self_check_signals: [],
    generated_at: new Date().toISOString(),
  };

  const callASession: POJUSessionState = {
    ...chatSession,
    messages: [
      {
        role: "assistant",
        content: "核对摘要…",
        timestamp: "t1",
        meta: { understanding_gate_pending: true },
      },
      { role: "user", content: "确认并继续", timestamp: "t2" },
      {
        role: "assistant",
        content: "深度分析正文",
        timestamp: "t3",
        meta: { segment2_analysis: true },
      },
    ],
    agent_v2: {
      ...agent,
      current_phase: "collecting_context",
      breakthrough_core: fakeCore as never,
      has_situation_analysis: true,
    },
  };
  const withA = baseLab(callASession, [
    {
      turn_id: "g1",
      phase: "collecting_context",
      kind: "gate",
      gate: { action: "understanding_confirm" },
      attempts: [],
    },
    {
      turn_id: "a1",
      phase: "segment2_a",
      kind: "segment2_a",
      attempts: [],
    },
  ]);
  assert.equal(labUndoTarget(withA)?.kind, "segment2_a");
  const undoneA = labUndoLastStep(withA);
  assert.equal(undoneA.chat_session?.agent_v2?.current_phase, "awaiting_understanding_confirm");
  assert.equal(undoneA.chat_session?.agent_v2?.breakthrough_core, null);
  assert.ok(!(undoneA.chat_session?.messages ?? []).some((m) => m.meta?.segment2_analysis));
  assert.ok(
    (undoneA.chat_session?.messages ?? []).some((m) => m.meta?.understanding_gate_pending),
  );
  assert.equal(undoneA.pipeline_turns?.length ?? 0, 0);
  assert.equal(undoneA.pipeline_cursor, "awaiting_understanding");
  console.log("  [PASS] undo Call A → understanding gate");

  const pendingA = baseLab(
    {
      ...callASession,
      messages: [
        {
          role: "assistant",
          content: "核对摘要…",
          timestamp: "t1",
          meta: { understanding_gate_pending: true },
        },
        { role: "user", content: "确认并继续", timestamp: "t2" },
      ],
      agent_v2: {
        ...agent,
        current_phase: "collecting_context",
        breakthrough_core: null,
      },
    },
    [
      {
        turn_id: "g1",
        phase: "collecting_context",
        kind: "gate",
        gate: { action: "understanding_confirm" },
        attempts: [],
      },
    ],
    { pipeline_pending_job: { job_id: "job1", stage: "segment2_a" } },
  );
  const undonePending = labUndoLastStep(pendingA);
  assert.equal(undonePending.pipeline_pending_job, null);
  assert.equal(
    undonePending.chat_session?.agent_v2?.current_phase,
    "awaiting_understanding_confirm",
  );
  assert.equal(undonePending.pipeline_cursor, "awaiting_understanding");
  console.log("  [PASS] undo pending Call A");

  console.log("\nAll lab-pipeline-undo checks passed.\n");
}

main();
