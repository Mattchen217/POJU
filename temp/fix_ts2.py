from pathlib import Path

# Extend message meta types
p = Path(r"lib/poju/types.ts")
t = p.read_text(encoding="utf-8")
old = '''m1_fail_closed?: boolean;
    m1_outcome?: "persist_failed" | "persist_threw";
    m1_persist_error?: string | null;'''
new = '''m1_fail_closed?: boolean;
    m1_planner_blocked?: boolean;
    m1_outcome?: "persist_failed" | "persist_threw" | "planner_blocked";
    m1_persist_error?: string | null;
    m1_ask_error?: string | null;'''
if old not in t:
    raise SystemExit("meta fields not found in types.ts")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("patched types.ts meta")

# Fix agent.ts phaseKeep typing - use literal AgentPhase
p = Path(r"lib/poju/agent.ts")
t = p.read_text(encoding="utf-8")
old_block = '''          const phaseKeep =
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
          };'''
new_block = '''          const blockedSession: POJUSessionState = {
            ...m1CollectingTurn.session,
            messages: messagesWithUser,
            agent_v2: {
              ...(m1CollectingTurn.session.agent_v2 ??
                ensureAgentV2(sessionForLlm)),
              current_phase: "collecting_context",
              stall_offer_pending: false,
            },
          };'''
if old_block not in t:
    raise SystemExit("phaseKeep block not found")
t = t.replace(old_block, new_block, 1)
p.write_text(t, encoding="utf-8")
print("patched agent.ts phase typing")
