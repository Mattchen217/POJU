# -*- coding: utf-8 -*-
from pathlib import Path
ROOT = Path(r"D:\POJU\pojulife")

# --- understanding-state: Blueprint deferred DIRs count as open needs ---
us = (ROOT / "lib/poju/decision-intake/understanding-state.ts").read_text(encoding="utf-8")

# Ensure imports include seedDirFromDefinition / activate helpers if needed.
# We'll add a loop after the existing DC dirs loop to surface Blueprint-scoped
# DIRs that are not yet on DC (deferred P1/P2) as open needs — never as known/n_a.

anchor = """  for (const dir of dc.dirs) {
    if (dir.id_lifecycle !== \"active\") continue;
    const relatedFacts = dc.reality_facts.filter((f) =>
      (f.related_dir_ids ?? []).includes(dir.dir_id),
    );
    if (dir.current_state === \"known\" || dir.current_state === \"n_a\") {
      understood.push({
        dir_id: dir.dir_id,
        label: dir.need,
        fact_ids: relatedFacts.map((f) => f.fact_id),
        status: dir.current_state,
        user_confirmed_any: relatedFacts.some((f) => f.user_confirmed === true),
      });
      continue;
    }
    // Blueprint scope only — never invent needs outside Catalog seed.
    if (!input.blueprint.dir_ids.includes(dir.dir_id)) continue;"""

# The dash character might differ. Let's find a unique smaller anchor.
if "Blueprint scope only" not in us and "never invent needs outside" not in us:
    # search
    idx = us.find("if (!input.blueprint.dir_ids.includes(dir.dir_id)) continue;")
    print("found includes check at", idx)
else:
    print("comment present")

# Insert after the for loop that builds needs — before confirmed = 
marker = "  const confirmed = dc.reality_facts.filter((f) => f.status === \"confirmed\");"
if marker not in us:
    raise SystemExit("confirmed marker not found")

insert = '''
  // M2.3-R1: Blueprint-scoped DIRs not yet on DC (deferred P1/P2) remain open
  // investigation obligations — never treat as known/n_a / complete.
  const onDc = new Set(dc.dirs.map((d) => d.dir_id));
  for (const dirId of input.blueprint.dir_ids) {
    if (onDc.has(dirId)) continue;
    if (needs.some((n) => n.kind === "dir_based" && n.dir_id === dirId)) continue;
    const direction_id = directionIdForDir(input.blueprint, dirId);
    const direction = input.blueprint.directions.find(
      (d) => d.direction_id === direction_id,
    );
    const gate = ddrLoad.ok
      ? gateClassForDirFromCatalog(
          dirId,
          ddrLoad.snapshot.by_id,
          ddrLoad.snapshot.dir_to_ddr,
        )
      : null;
    const ddr_ids = resolveDdrIdsForDir(dirId, input.blueprint);
    if (ddr_ids.length === 0) continue;
    const priority =
      gate?.gate_class ?? direction?.priority ?? "P2";
    needs.push({
      kind: "dir_based",
      dir_id: dirId,
      ddr_ids,
      direction_id,
      priority,
      why: direction?.needed_info || "Blueprint-scoped DIR not yet activated on DC",
      missing_content: direction?.needed_info || dirId,
      may_affect_p5_ranking:
        gate?.may_affect_p5_ranking ?? direction?.priority === "P0",
      gap_type: "unknown",
      must_continue: (gate?.may_affect_p5_ranking ?? false) || priority === "P0",
    });
  }

'''

us = us.replace(marker, insert + marker, 1)
(ROOT / "lib/poju/decision-intake/understanding-state.ts").write_text(us, encoding="utf-8")
print("understanding-state.ts OK")

# --- production-intake-ask: activate before candidate build ---
ask = (ROOT / "lib/poju/decision-context/production-intake-ask.ts").read_text(encoding="utf-8")
old_imp = """import {
  gateClassForDirFromCatalog,
  resolveDdrIdsForDir,
} from \"@/lib/poju/decision-intake/blueprint\";"""
new_imp = """import {
  activateNextBlueprintPriorityBand,
  gateClassForDirFromCatalog,
  resolveDdrIdsForDir,
} from \"@/lib/poju/decision-intake/blueprint\";"""
if old_imp not in ask:
    raise SystemExit("ask import not found")
ask = ask.replace(old_imp, new_imp, 1)

old_sel = """  const candidates = [
    ...buildIntakeCandidatesFromDc(dc, input.session.decision_blueprint),
    ...(input.extraCandidates ?? []),
  ];"""
new_sel = """  // Activate next Blueprint priority band (P1 after P0, P2 after P1) onto DC.
  const scheduled = activateNextBlueprintPriorityBand(
    input.session,
    input.nowIso,
  );
  const dcLive = scheduled.decision_context ?? dc;
  const candidates = [
    ...buildIntakeCandidatesFromDc(dcLive, scheduled.decision_blueprint),
    ...(input.extraCandidates ?? []),
  ];"""
if old_sel not in ask:
    raise SystemExit("candidates build anchor not found")
ask = ask.replace(old_sel, new_sel, 1)

# Also fix snapshotFromDc and return session to use scheduled
old_plan_call = """  const plan = planNextAskFromCandidates({
    candidates,
    snap: snapshotFromDc(dc),
    naValidation,
    softGate: input.softGate,
    p0DdrIncomplete: input.p0DdrIncomplete,
    p0SourceNotOk: input.p0SourceNotOk,
    remaining_hard_budget: input.remaining_hard_budget ?? 15,
  });

  const now = input.nowIso ?? new Date().toISOString();
  const snapshot: IntakeAskPlanSnapshot = {
    scored_at: now,
    scoring_path: INTAKE_ASK_SCORING_PATH,
    selected_candidate_id: plan.selected?.candidate.candidate_id ?? null,
    ranked_candidate_ids: plan.ranked.map((r) => r.candidate.candidate_id),
    unresolved_counts: Object.fromEntries(
      plan.ranked.map((r) => [
        r.candidate.candidate_id,
        r.score.unresolved_count,
      ]),
    ),
    gap_types: Object.fromEntries(
      plan.ranked.map((r) => [r.candidate.candidate_id, r.score.gap_type]),
    ),
  };

  return {
    session: {
      ...input.session,
      intake_ask_plan: snapshot,
    },"""

new_plan_call = """  const plan = planNextAskFromCandidates({
    candidates,
    snap: snapshotFromDc(dcLive),
    naValidation,
    softGate: input.softGate,
    p0DdrIncomplete: input.p0DdrIncomplete,
    p0SourceNotOk: input.p0SourceNotOk,
    remaining_hard_budget: input.remaining_hard_budget ?? 15,
  });

  const now = input.nowIso ?? new Date().toISOString();
  const snapshot: IntakeAskPlanSnapshot = {
    scored_at: now,
    scoring_path: INTAKE_ASK_SCORING_PATH,
    selected_candidate_id: plan.selected?.candidate.candidate_id ?? null,
    ranked_candidate_ids: plan.ranked.map((r) => r.candidate.candidate_id),
    unresolved_counts: Object.fromEntries(
      plan.ranked.map((r) => [
        r.candidate.candidate_id,
        r.score.unresolved_count,
      ]),
    ),
    gap_types: Object.fromEntries(
      plan.ranked.map((r) => [r.candidate.candidate_id, r.score.gap_type]),
    ),
  };

  return {
    session: {
      ...scheduled,
      intake_ask_plan: snapshot,
    },"""

if old_plan_call not in ask:
    raise SystemExit("plan call anchor not found")
ask = ask.replace(old_plan_call, new_plan_call, 1)
(ROOT / "lib/poju/decision-context/production-intake-ask.ts").write_text(ask, encoding="utf-8")
print("production-intake-ask.ts OK")
print("DONE")
