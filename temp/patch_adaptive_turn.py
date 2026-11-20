from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\adaptive-turn.ts")
text = p.read_text(encoding="utf-8")

# 1) Fix planFromState - remove post-understanding activation
old_marker = (
    "  // After P0 finishes, pull unfinished P1 (then P2) from Blueprint onto DC.\n"
    "  session = activateNextBlueprintPriorityBand(session, now);\n"
    "  const dc = session.decision_context!;"
)
new_marker = (
    "  // M2.3-R2: priority-band activation already ran before Understanding/Readiness.\n"
    "  // Activating here would mutate DC after Readiness and reuse a stale can_ask.\n"
    "  const dc = session.decision_context!;"
)
assert old_marker in text, "activation in planFromState not found"
text = text.replace(old_marker, new_marker, 1)

# 2) Replace main post-persist sequence
start = text.find("  // Ensure blueprint present after persist merge")
assert start != -1
needle = "const planned = await planFromState(current, understanding0, input.now);"
end = text.find(needle, start)
assert end != -1
end = end + len(needle)

new_section = """  // Ensure blueprint present after persist merge
  const bp2 = ensureDecisionBlueprint(current, { now: input.now });
  current = bp2.session;

  // M2.3-R2 authoritative sequence:
  //   activate priority band on latest DC → build Understanding → Readiness → plan
  // Do not build Readiness against a DC that band activation later mutates.
  current = activateNextBlueprintPriorityBand(current, input.now);

  try {
    const understanding0 = buildUnderstandingState({
      session: current,
      blueprint: current.decision_blueprint!,
      now: input.now,
      last_answer_event_id: answer_event?.event_id ?? null,
    });
    const planned = await planFromState(current, understanding0, input.now);"""

text = text[:start] + new_section + text[end:]

# 3) Fix idempotent_replay path
old_idemp = """      if (applied.skipped_reason === \"turn_already_mapped\") {
        // Idempotent replay: rebuild understanding/plan from existing DC, no dup writes.
        const understanding = buildUnderstandingState({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);"""

new_idemp = """      if (applied.skipped_reason === \"turn_already_mapped\") {
        // Idempotent replay: rebuild understanding/plan from existing DC, no dup writes.
        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstandingState({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);"""

assert old_idemp in text, "idempotent path not found"
text = text.replace(old_idemp, new_idemp, 1)

# 4) Fix off-topic / not applied path
old_skip = """      if (!applied.applied) {
        // Off-topic / invalid: still recompute understanding; may keep prior needs.
        const understanding = buildUnderstandingState({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);"""

new_skip = """      if (!applied.applied) {
        // Off-topic / invalid: still recompute understanding; may keep prior needs.
        current = activateNextBlueprintPriorityBand(current, input.now);
        const understanding = buildUnderstandingState({
          session: current,
          blueprint: current.decision_blueprint!,
          now: input.now,
          last_answer_event_id: answer_event.event_id,
        });
        const planned = await planFromState(current, understanding, input.now);"""

assert old_skip in text, "skip path not found"
text = text.replace(old_skip, new_skip, 1)

# 5) Update header normative order comment
if "Order (normative):" in text:
    hdr_start = text.find(" * Order (normative):")
    hdr_end = text.find(" * Sole production entry", hdr_start)
    assert hdr_end != -1
    new_hdr = (
        " * Order (normative, M2.3-R2):\n"
        " *   User Answer → Answer Interpretation → DC Update (persist)\n"
        " *   → Ensure Blueprint → activateNextBlueprintPriorityBand (latest DC)\n"
        " *   → Understanding + Readiness (on activated DC) → Question Planning\n"
        " *   → Scope/Depth/Budget Validation → Generate Next Question → Persist\n"
        " *   → (Agent returns assistant from plan)\n"
    )
    text = text[:hdr_start] + new_hdr + text[hdr_end:]

p.write_text(text, encoding="utf-8")
out = p.read_text(encoding="utf-8")
assert "activateNextBlueprintPriorityBand(session, now)" not in out
assert out.count("activateNextBlueprintPriorityBand(current, input.now)") == 3
print("adaptive-turn.ts patched OK; activation(current) sites:", out.count("activateNextBlueprintPriorityBand(current, input.now)"))
