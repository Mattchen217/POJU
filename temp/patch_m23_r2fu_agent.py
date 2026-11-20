# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\agent.ts")
t = p.read_text(encoding="utf-8")

# Find the persist_failed early-return block and extend it / add planner_blocked after it.
# We'll insert planner_blocked handling right after the persist_failed return block,
# before "// Adopt DC + understanding + plan".

anchor = '''          return withSessionProfileFlags({
            ...sessionForLlm,
            messages: [...messagesWithUser, failAssistant],
            last_interaction_at: nowPre,
          });
        }
        // Adopt DC + understanding + plan into the Session the LLM sees.'''

if anchor not in t:
    raise SystemExit("persist_failed adopt anchor not found")

insert = '''          return withSessionProfileFlags({
            ...sessionForLlm,
            messages: [...messagesWithUser, failAssistant],
            last_interaction_at: nowPre,
          });
        }
        if (m1CollectingTurn.outcome === "planner_blocked") {
          // M2.3-R2-FU: open P0/P1 remain; do not confirm, do not free-form ask.
          const blockReason =
            m1CollectingTurn.ask_error?.trim() ||
            "planner_blocked_open_p0_p1";
          const blockText =
            "【系统】当前仍有未完成的必要调查项，但本轮未能生成合规的授权提问。会话仍在收集中，请重试或换一种表述。" +
            `（${blockReason}）`;
          const phaseKeep =
            normalizeAgentPhase(ensureAgentV2(sessionForLlm).current_phase) ===
              "collecting_context" ||
            ensureAgentV2(sessionForLlm).current_phase === "collecting_context"
              ? "collecting_context"
              : "collecting_context";
          const blockedSession = {
            ...m1CollectingTurn.session,
            messages: messagesWithUser,
            agent_v2: m1CollectingTurn.session.agent_v2
              ? {
                  ...m1CollectingTurn.session.agent_v2,
                  current_phase: phaseKeep,
                  stall_offer_pending: false,
                }
              : {
                  ...ensureAgentV2(sessionForLlm),
                  current_phase: "collecting_context",
                  stall_offer_pending: false,
                },
          };
          const blockAssistant: POJUMessage = {
            role: "assistant",
            content: blockText,
            timestamp: nowPre,
            client_id: safeRandomUUID(),
            meta: {
              m1_planner_blocked: true,
              m1_outcome: "planner_blocked",
              m1_ask_error: blockReason,
            },
          };
          console.warn(
            "[agent] M1 planner_blocked (nonterminal; no confirm / no free-ask)",
            blockReason,
          );
          return withSessionProfileFlags({
            ...blockedSession,
            messages: [...messagesWithUser, blockAssistant],
            last_interaction_at: nowPre,
            decision_context:
              m1CollectingTurn.session.decision_context ??
              blockedSession.decision_context,
            decision_blueprint:
              m1CollectingTurn.session.decision_blueprint ??
              blockedSession.decision_blueprint,
            decision_understanding:
              m1CollectingTurn.session.decision_understanding ??
              blockedSession.decision_understanding,
            adaptive_ask_plan: null,
            intake_ask_plan:
              m1CollectingTurn.session.intake_ask_plan ??
              blockedSession.intake_ask_plan,
          });
        }
        // Adopt DC + understanding + plan into the Session the LLM sees.'''

t = t.replace(anchor, insert, 1)

# Also harden the post-LLM confirmation path: only enter awaiting_confirmation /
# final-confirm prompt when NOT planner_blocked and can_ask is false.
old_phase = '''  if (
    m1CollectingTurn &&
    m1CollectingTurn.understanding &&
    m1CollectingTurn.understanding.readiness.can_ask === false &&
    agent_v2.current_phase !== "delivered"
  ) {
    agent_v2 = {
      ...agent_v2,
      current_phase: "awaiting_confirmation",
      stall_offer_pending: false,
    };
    // m21_readiness_stop
  } else if (
    m1CollectingTurn &&
    (m1CollectingTurn.bootstrapped ||
      m1CollectingTurn.plan ||
      m1CollectingTurn.ask_planned) &&
    agent_v2.current_phase !== "awaiting_confirmation" &&
    agent_v2.current_phase !== "delivered"
  ) {
    agent_v2 = { ...agent_v2, current_phase: "collecting_context" };
  }'''

new_phase = '''  if (
    m1CollectingTurn &&
    m1CollectingTurn.outcome === "planner_blocked" &&
    agent_v2.current_phase !== "delivered"
  ) {
    // Belt-and-suspenders: planner_blocked is nonterminal collecting.
    agent_v2 = {
      ...agent_v2,
      current_phase: "collecting_context",
      stall_offer_pending: false,
    };
  } else if (
    m1CollectingTurn &&
    m1CollectingTurn.outcome !== "planner_blocked" &&
    m1CollectingTurn.understanding &&
    m1CollectingTurn.understanding.readiness.can_ask === false &&
    agent_v2.current_phase !== "delivered"
  ) {
    agent_v2 = {
      ...agent_v2,
      current_phase: "awaiting_confirmation",
      stall_offer_pending: false,
    };
    // m21_readiness_stop
  } else if (
    m1CollectingTurn &&
    (m1CollectingTurn.bootstrapped ||
      m1CollectingTurn.plan ||
      m1CollectingTurn.ask_planned) &&
    agent_v2.current_phase !== "awaiting_confirmation" &&
    agent_v2.current_phase !== "delivered"
  ) {
    agent_v2 = { ...agent_v2, current_phase: "collecting_context" };
  }'''

if old_phase not in t:
    raise SystemExit("phase transition block not found")
t = t.replace(old_phase, new_phase, 1)

old_confirm = '''  } else if (
    m1CollectingTurn &&
    !m1CollectingTurn.authorized_question &&
    m1CollectingTurn.understanding &&
    m1CollectingTurn.understanding.readiness.can_ask === false
  ) {
    // Readiness stop — replace free-form ask with final understanding confirm.'''

# Encoding may have mangled the comment dash - search more loosely
idx = t.find("!m1CollectingTurn.authorized_question &&")
if idx < 0:
    raise SystemExit("authorized_question confirm branch not found")
# Find the else if start before this
else_if_start = t.rfind("} else if (", 0, idx)
# Find the condition end and ensure we add planner_blocked guard
snippet = t[else_if_start:else_if_start+500]
print("CONFIRM SNIPPET:")
print(snippet[:400])

old_cond = '''  } else if (
    m1CollectingTurn &&
    !m1CollectingTurn.authorized_question &&
    m1CollectingTurn.understanding &&
    m1CollectingTurn.understanding.readiness.can_ask === false
  )'''

new_cond = '''  } else if (
    m1CollectingTurn &&
    m1CollectingTurn.outcome !== "planner_blocked" &&
    !m1CollectingTurn.authorized_question &&
    m1CollectingTurn.understanding &&
    m1CollectingTurn.understanding.readiness.can_ask === false
  )'''

if old_cond not in t:
    raise SystemExit("confirm else-if condition not found exactly")
t = t.replace(old_cond, new_cond, 1)

p.write_text(t, encoding="utf-8")
print("patched agent.ts")
assert "planner_blocked" in p.read_text(encoding="utf-8")
assert "m1_planner_blocked" in p.read_text(encoding="utf-8")
print("agent sanity ok")
