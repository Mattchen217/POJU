from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\understanding-state.ts")
text = p.read_text(encoding="utf-8")

# Update must_continue for on-DC needs to include P1
old1 = "      must_continue: ranking || priority === \"P0\","
new1 = "      must_continue: ranking || priority === \"P0\" || priority === \"P1\","
assert old1 in text, "on-DC must_continue not found"
text = text.replace(old1, new1, 1)

# Update must_continue for off-DC Blueprint needs
old2 = "      must_continue: (gate?.may_affect_p5_ranking ?? false) || priority === \"P0\","
new2 = "      must_continue: (gate?.may_affect_p5_ranking ?? false) || priority === \"P0\" || priority === \"P1\","
assert old2 in text, "off-DC must_continue not found"
text = text.replace(old2, new2, 1)

# Replace readiness early-stop block
old_ready = """  const sufficiency = evaluateDecisionSufficiency(dc);
  const remaining = budget.remaining_hard_budget;
  let readiness_verdict: UnderstandingState[\"readiness\"][\"verdict\"] = \"continue\";
  let can_ask = true;
  const reasons = [...sufficiency.reasons];
  if (sufficiency.canStop) {
    readiness_verdict = \"ready_for_final_confirm\";
    can_ask = false;
    reasons.push(\"sufficiency_can_stop\");
  } else if (remaining <= 0) {
    readiness_verdict = \"hard_budget_exhausted\";
    can_ask = false;
    reasons.push(\"hard_budget_exhausted\");
  } else if (needs.length === 0) {
    readiness_verdict = \"ready_for_final_confirm\";
    can_ask = false;
    reasons.push(\"no_open_needs\");
  } else if (criticalCovered && hasCollectingEvidence) {
    readiness_verdict = \"ready_for_final_confirm\";
    can_ask = false;
    reasons.push(\"critical_dirs_partial_coverage_ready_for_confirm\");
  }"""

new_ready = """  // M2.3-R2: open selected-Blueprint P0/P1 obligations must remain askable while
  // budget remains. sufficiency.canStop and criticalCovered partial-coverage must
  // not silently bypass unfinished P0/P1. Hard-budget exhaustion may still end
  // asking, but remaining DIRs stay visible in need_to_understand. P2 may stay
  // deferred under soft-budget (never auto-marked known/n_a).
  const openPriorityBandNeeds = needs.filter(
    (n) =>
      n.kind === \"dir_based\" &&
      (n.priority === \"P0\" || n.priority === \"P1\"),
  );
  const hasOpenP0OrP1 = openPriorityBandNeeds.length > 0;

  const sufficiency = evaluateDecisionSufficiency(dc);
  const remaining = budget.remaining_hard_budget;
  let readiness_verdict: UnderstandingState[\"readiness\"][\"verdict\"] = \"continue\";
  let can_ask = true;
  const reasons = [...sufficiency.reasons];
  if (remaining <= 0) {
    readiness_verdict = \"hard_budget_exhausted\";
    can_ask = false;
    reasons.push(\"hard_budget_exhausted\");
  } else if (hasOpenP0OrP1) {
    readiness_verdict = \"continue\";
    can_ask = true;
    reasons.push(\"open_blueprint_p0_p1_obligations\");
  } else if (sufficiency.canStop) {
    readiness_verdict = \"ready_for_final_confirm\";
    can_ask = false;
    reasons.push(\"sufficiency_can_stop\");
  } else if (needs.length === 0) {
    readiness_verdict = \"ready_for_final_confirm\";
    can_ask = false;
    reasons.push(\"no_open_needs\");
  } else if (criticalCovered && hasCollectingEvidence) {
    // Only non-P0/P1 open needs remain (typically deferred P2) — soft stop OK.
    readiness_verdict = \"ready_for_final_confirm\";
    can_ask = false;
    reasons.push(\"critical_dirs_partial_coverage_ready_for_confirm\");
  }"""

assert old_ready in text, "readiness block not found"
text = text.replace(old_ready, new_ready, 1)

p.write_text(text, encoding="utf-8")
out = p.read_text(encoding="utf-8")
assert "open_blueprint_p0_p1_obligations" in out
assert "hasOpenP0OrP1" in out
print("understanding-state.ts patched OK")
