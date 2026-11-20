from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\session-manager.ts")
text = p.read_text(encoding="utf-8")

old = '''  const sessionState: POJUSessionState = {
    session_id: sessionId,
    device_id: deviceId,
    original_question: input.original_question.trim(),
    cycles: [firstCycle],
    active_cycle_id: firstCycle.cycle_id,
    shared_context: {},
    messages: [],
    context_collected: {},
    has_profile: Boolean(storedId),
    birth_submitted_in_session: false,
    profile_skipped: false,
    selected_stored_profile_id: storedId,
    dyad_offer_status: "none",
    partner_profile_id: null,
    partner_bazi: undefined,
    dyad_compat_summary: null,
    pivot_chart_path: null,
    charts_locked_at: null,
    dyad_matrix_pack: null,
    actions: [],
    main_delivery_done: false,
    main_delivery: null,
    tokens_used: 0,
    abuse_metrics: {
      long_input_count: 0,
      jailbreak_attempts: 0,
      duplicate_attempts: 0,
    },
    created_at: now.toISOString(),
    last_interaction_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    unlock_status: "preview",
    generation_task_contexts: [],
    generation_registry: [],
    generation_operation_bindings: [],
    confirmation_events: [],
    opening_anchors: [],
    opening_confirm_history: [],
  };

  // Phase 3 S1 W1 — create-if-absent; dual revision init 0; never overwrite.
  sessionState.session_revision = 0;
  sessionState.dc_write_revision = 0;
'''
new = '''  let sessionState: POJUSessionState = {
    session_id: sessionId,
    device_id: deviceId,
    original_question: input.original_question.trim(),
    cycles: [firstCycle],
    active_cycle_id: firstCycle.cycle_id,
    shared_context: {},
    messages: [],
    context_collected: {},
    has_profile: Boolean(storedId),
    birth_submitted_in_session: false,
    profile_skipped: false,
    selected_stored_profile_id: storedId,
    dyad_offer_status: "none",
    partner_profile_id: null,
    partner_bazi: undefined,
    dyad_compat_summary: null,
    pivot_chart_path: null,
    charts_locked_at: null,
    dyad_matrix_pack: null,
    actions: [],
    main_delivery_done: false,
    main_delivery: null,
    tokens_used: 0,
    abuse_metrics: {
      long_input_count: 0,
      jailbreak_attempts: 0,
      duplicate_attempts: 0,
    },
    created_at: now.toISOString(),
    last_interaction_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    unlock_status: "preview",
    generation_task_contexts: [],
    generation_registry: [],
    generation_operation_bindings: [],
    confirmation_events: [],
    opening_anchors: [],
    opening_confirm_history: [],
  };

  // Phase 3 S1 W1 — create-if-absent; dual revision init 0; never overwrite.
  sessionState.session_revision = 0;
  sessionState.dc_write_revision = 0;

  // M9: in the browser, a new Session must first obtain the server record.
  // Node tests keep the local constructor so existing IDB suites stay intact.
  if (typeof window !== "undefined") {
    const { initializeServerSessionFromClient } = await import(
      "@/lib/poju/session-authority/client"
    );
    const envelope = await initializeServerSessionFromClient({
      session_id: sessionId,
      original_question: input.original_question.trim(),
      device_id: deviceId,
      selected_stored_profile_id: storedId,
    });
    sessionState = envelope.session;
    sessionId = envelope.session_id;
    sessionState.session_revision = envelope.revision;
    sessionState.expires_at = envelope.expires_at;
  }
'''
if old not in text:
    raise SystemExit("createPOJUSession state block not found")
text = text.replace(old, new, 1)

# sessionId is currently const — need to change to let
text = text.replace(
    "  const sessionId = override ?? safeRandomUUID();\n",
    "  let sessionId = override ?? safeRandomUUID();\n",
    1,
)

helper = '''
export async function restoreAuthoritativePOJUSession(
  sessionId: string,
): Promise<import("@/lib/poju/session-authority/mirror").AuthoritativeMirrorResult> {
  const { restoreAuthoritativeSessionFromClient } = await import(
    "@/lib/poju/session-authority/client"
  );
  return restoreAuthoritativeSessionFromClient({
    sessionId,
    loadLocal: loadPOJUSession,
    saveLocal: savePOJUSession,
  });
}

'''
# insert before the last re-export block
mark = "// Re-export apply helpers so Call sites can use one module for DC session commits.\n"
if mark not in text:
    raise SystemExit("re-export mark not found")
text = text.replace(mark, helper + mark, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("patched session-manager.ts")