/**
 * Decision Context Phase 1 unit tests.
 * Run: pnpm test:decision-context
 *   or: pnpm exec tsx scripts/test-decision-context-phase1.ts
 */

import assert from "node:assert/strict";
import {
  agendaCoveredImpliesDirKnown,
  aggregateDirState,
  applyControlPlaneToWorking,
  applyDcToWorking,
  assertLegalFactCombination,
  beginPersistTransaction,
  buildRealityFact,
  clarifyConflict,
  commitPersistTransaction,
  computeContentHash,
  deriveUserConfirmed,
  dirsFromAgenda,
  evaluateDecisionSufficiency,
  freezeDecisionContext,
  FreezeError,
  hypothesesFromBreakthroughCore,
  IllegalFactCombinationError,
  isLegalFactCombination,
  markOpenConflictsUnresolvedInFinal,
  openConflict,
  reaggregateDirs,
  restoreDecisionContextAuthority,
  seedDecisionContextFromOpening,
  startV2FromFinal,
  __resetPersistIdempotencyForTests,
  type DecisionContext,
  type DIR,
  type RealityFact,
} from "../lib/poju/decision-context";
import type { BreakthroughCore } from "../lib/poju/agent-state";
import type { AgendaItem } from "../lib/poju/investigation-agenda";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  PASS  ${name}`);
    })
    .catch((err) => {
      console.error(`  FAIL  ${name}`);
      throw err;
    });
}

async function main() {
  console.log("decision-context phase1");

  await check("legal confirmed+user_asserted", () => {
    assert.equal(isLegalFactCombination("confirmed", "user_asserted"), true);
  });

  await check("illegal confirmed+none rejected", () => {
    assert.equal(isLegalFactCombination("confirmed", "none"), false);
    assert.throws(
      () => assertLegalFactCombination("confirmed", "none"),
      IllegalFactCombinationError,
    );
  });

  await check("independently_verified does NOT imply user_confirmed", () => {
    assert.equal(
      deriveUserConfirmed({
        status: "confirmed",
        verification_level: "independently_verified",
        has_user_confirm_event: false,
      }),
      false,
    );
    assert.equal(
      deriveUserConfirmed({
        status: "confirmed",
        verification_level: "independently_verified",
        has_user_confirm_event: true,
      }),
      false,
    );
    const fact = buildRealityFact({
      fact_id: "f1",
      statement: "verified externally",
      status: "confirmed",
      verification_level: "independently_verified",
      source_stage: "collecting",
      source_turn_id: "t1",
      has_user_confirm_event: true,
    });
    assert.equal(fact.user_confirmed, false);
  });

  await check("user_confirmed only from user-confirm event + asserted", () => {
    const withEvent = buildRealityFact({
      fact_id: "f2",
      statement: "I confirm the deadline is Friday",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t2",
      has_user_confirm_event: true,
    });
    assert.equal(withEvent.user_confirmed, true);
    const without = buildRealityFact({
      fact_id: "f3",
      statement: "maybe Friday",
      status: "unverified",
      verification_level: "user_estimate",
      source_stage: "collecting",
      source_turn_id: "t3",
      has_user_confirm_event: false,
    });
    assert.equal(without.user_confirmed, false);
  });

  await check("unknown cannot be user_confirmed", () => {
    assert.equal(
      deriveUserConfirmed({
        status: "unknown",
        verification_level: "none",
        has_user_confirm_event: true,
      }),
      false,
    );
  });

  await check("opening-seed writes Definition+Facts+Constraints, no DIR/hyp", () => {
    const dc = seedDecisionContextFromOpening({
      session_id: "s1",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: {
        concrete_event: "Offer expires Friday",
        stakes: "Career path lock-in",
        sticking_point: "Relocation vs remote",
      },
      desired_direction: { wants: "Keep optionality", priority: "Family first" },
      user_statements: [
        {
          statement: "Offer expires Friday",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          status: "confirmed",
          fact_roles: ["deadline"],
        },
      ],
      user_constraints: [
        {
          statement: "Cannot relocate this year",
          category: "responsibility",
          user_confirmed_event: true,
        },
      ],
      decision_question: "Accept the offer?",
    });
    assert.equal(dc.status, "draft");
    assert.equal(dc.version, 1);
    assert.equal(dc.definition.concrete_event, "Offer expires Friday");
    assert.equal(dc.dirs.length, 0);
    assert.equal(dc.hypotheses.length, 0);
    assert.equal(dc.reality_facts.length, 1);
    assert.equal(dc.reality_facts[0]!.user_confirmed, true);
    assert.equal(dc.constraints.length, 1);
    // Opening Seed → Constraint: user_confirmed is DERIVED (event + asserted), not a free field.
    assert.equal(dc.constraints[0]!.verification_level, "user_asserted");
    assert.equal(dc.constraints[0]!.status, "confirmed");
    assert.equal(
      dc.constraints[0]!.user_confirmed,
      true,
      "constraint with user_confirmed_event + user_asserted must derive user_confirmed=true",
    );
    // Counter: same seed path without confirm event must derive false
    const dcNoConfirm = seedDecisionContextFromOpening({
      session_id: "s1b",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: {
        concrete_event: "Offer expires Friday",
        stakes: "Career path lock-in",
        sticking_point: "Relocation vs remote",
      },
      desired_direction: { wants: "Keep optionality", priority: "Family first" },
      user_constraints: [
        {
          statement: "Cannot relocate this year",
          category: "responsibility",
          user_confirmed_event: false,
        },
      ],
    });
    assert.equal(dcNoConfirm.constraints[0]!.user_confirmed, false);
    assert.equal(dcNoConfirm.constraints[0]!.status, "unverified");
    assert.equal(dc.content_hash, null);
  });

  await check("hypothesis-from-core maps frames; never RealityFact", () => {
    const core: BreakthroughCore = {
      situation_conclusion: "Fork between relocate and remote track",
      key_crossroads: {
        real_fork: "Relocate vs remote",
        path_costs: "Family cost vs career speed",
        decision_traits: "Risk tolerance",
        structural_basis: "Day master weak",
        needs_validation: "Confirm spouse constraint",
      },
      modern_action_frames: [
        {
          direction: "Negotiate remote trial",
          why_fits: "Preserves family",
          structural_basis: "Resource star",
          needs_validation: "Manager flexibility",
        },
      ],
      energy_retune_frame: {
        direction_fit: "Water support",
        timing_ripeness: "Next quarter",
        daily_retune: "Morning walk",
        complementary: "Mentor",
        structural_basis: "Season",
        needs_validation: "",
      },
      rhythm_frame: {
        phase1_observe: "a",
        phase2_adjust: "b",
        phase3_consolidate: "c",
      },
      self_check_signals: [],
    };
    const hyps = hypothesesFromBreakthroughCore(core, {
      source_ref: "job_abc",
      now: "2026-11-02T12:00:00.000Z",
    });
    assert.ok(hyps.length >= 3);
    assert.ok(hyps.every((h) => h.hypothesis_id.startsWith("hyp_")));
    assert.ok(hyps.some((h) => h.state === "pending_validation"));
    const again = hypothesesFromBreakthroughCore(core, {
      source_ref: "job_abc",
      existing: hyps,
    });
    assert.equal(
      again.filter((h) => h.source_ref === "job_abc").length,
      hyps.length,
    );
  });

  await check("agenda covered does not imply DIR.known", () => {
    assert.equal(agendaCoveredImpliesDirKnown(), false);
    const agenda: AgendaItem[] = [
      {
        id: "a1",
        label: "Spouse relocation stance",
        critical: true,
        status: "covered",
        collection_goal: "Know hard constraint",
        serves_page: "01",
        role: "fill",
      },
    ];
    const dirs = dirsFromAgenda(agenda);
    assert.equal(dirs.length, 1);
    assert.equal(dirs[0]!.current_state, "unknown");
    assert.equal(dirs[0]!.may_affect_p5_ranking, true);
  });

  await check("multi-Fact aggregation; single confirmed != known", () => {
    const dir: DIR = {
      dir_id: "dir_a1",
      need: "Spouse stance",
      why: "Affects relocate path",
      required_fact_roles: ["spouse_stance", "timeline"],
      current_state: "unknown",
      partial_satisfaction: false,
      agenda_item_ids: ["a1"],
      may_affect_p5_ranking: true,
      id_lifecycle: "active",
    };
    const oneConfirmed: RealityFact = buildRealityFact({
      fact_id: "f_spouse",
      statement: "Spouse refuses relocate",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t9",
      has_user_confirm_event: true,
      fact_roles: ["spouse_stance"],
      related_dir_ids: ["dir_a1"],
    });
    const partial = aggregateDirState(dir, [oneConfirmed]);
    assert.equal(partial.current_state, "unknown");
    assert.equal(partial.partial_satisfaction, true);

    const timeline = buildRealityFact({
      fact_id: "f_time",
      statement: "Must decide by Friday",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t10",
      has_user_confirm_event: true,
      fact_roles: ["timeline"],
      related_dir_ids: ["dir_a1"],
    });
    const full = aggregateDirState(dir, [oneConfirmed, timeline]);
    assert.equal(full.current_state, "known");
  });

  await check("open conflict 鈫?unresolved_in_final; no auto clarify", () => {
    const fA = buildRealityFact({
      fact_id: "fa",
      statement: "Budget is 10k",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t1",
      has_user_confirm_event: true,
      fact_roles: ["budget"],
    });
    const fB = buildRealityFact({
      fact_id: "fb",
      statement: "Budget is 3k",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "collecting",
      source_turn_id: "t2",
      has_user_confirm_event: true,
      fact_roles: ["budget"],
    });
    const conflict = openConflict({
      fact_ids: ["fa", "fb"],
      conflict_field: "budget",
      facts: [fA, fB],
      now: "2026-11-02T12:00:00.000Z",
    });
    assert.equal(conflict.state, "open");
    assert.throws(() =>
      clarifyConflict(conflict, "use 10k", { user_confirmation: false }),
    );
    const frozenConflicts = markOpenConflictsUnresolvedInFinal([conflict]);
    assert.equal(frozenConflicts[0]!.state, "unresolved_in_final");
    assert.deepEqual(frozenConflicts[0]!.statements_snapshot, [
      "Budget is 10k",
      "Budget is 3k",
    ]);
  });

  await check("freeze rejects CTA/stall; sets hash + final", () => {
    const dc = seedDecisionContextFromOpening({
      context_id: "dc_freeze",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: "P" },
      desired_direction: { wants: "W", priority: "P" },
      user_statements: [
        {
          statement: "E",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          status: "confirmed",
          fact_roles: ["event"],
        },
      ],
    });
    dc.dirs = reaggregateDirs(
      [
        {
          dir_id: "dir_x",
          need: "n",
          why: "w",
          required_fact_roles: ["event"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: true,
          id_lifecycle: "active",
        },
      ],
      dc.reality_facts,
      [],
    );
    assert.throws(
      () =>
        freezeDecisionContext(dc, {
          stage3_sufficiency_end: true,
          from_purchase_or_report_cta: true,
        }),
      FreezeError,
    );
    assert.throws(
      () =>
        freezeDecisionContext(dc, {
          stage3_sufficiency_end: true,
          from_stall_or_max_turns: true,
        }),
      FreezeError,
    );
    const { frozen } = freezeDecisionContext(dc, {
      stage3_sufficiency_end: true,
      now: "2026-11-02T13:00:00.000Z",
    });
    assert.equal(frozen.status, "final");
    assert.ok(frozen.content_hash && frozen.content_hash.length === 64);
    assert.equal(computeContentHash(frozen), frozen.content_hash);
  });

  await check("stop-criteria: hard push does not clear P5-critical unknown", () => {
    const dc: DecisionContext = {
      ...seedDecisionContextFromOpening({
        context_id: "dc_stop",
        now: "2026-11-02T12:00:00.000Z",
        core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
        desired_direction: { wants: "W", priority: null },
        user_statements: [
          {
            statement: "E",
            verification_level: "user_asserted",
            user_confirmed_event: true,
            fact_roles: ["event"],
          },
        ],
      }),
      dirs: [
        {
          dir_id: "dir_crit",
          need: "critical unknown",
          why: "changes ranking",
          required_fact_roles: ["missing_role"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: true,
          id_lifecycle: "active",
        },
      ],
    };
    const r = evaluateDecisionSufficiency(dc, { userHardPush: true });
    assert.equal(r.canStop, false);
    assert.equal(r.hard_push_ignored_for_sufficiency, true);
  });

  await check("V1鈫扸2: superseded keeps hash; draft new version", () => {
    let dc = seedDecisionContextFromOpening({
      context_id: "dc_ver",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
      desired_direction: { wants: "W", priority: null },
      user_statements: [
        {
          statement: "E",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["event"],
        },
      ],
    });
    dc.dirs = reaggregateDirs(
      [
        {
          dir_id: "dir_x",
          need: "n",
          why: "w",
          required_fact_roles: ["event"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: false,
          id_lifecycle: "active",
        },
      ],
      dc.reality_facts,
      [],
    );
    const { frozen } = freezeDecisionContext(dc, {
      stage3_sufficiency_end: true,
      now: "2026-11-02T13:00:00.000Z",
    });
    const v1Hash = frozen.content_hash!;
    const extra = buildRealityFact({
      fact_id: "f_extra",
      statement: "New constraint emerged",
      status: "confirmed",
      verification_level: "user_asserted",
      source_stage: "user_supplement",
      source_turn_id: "t99",
      has_user_confirm_event: true,
      fact_roles: ["event"],
    });
    const { superseded, draft } = startV2FromFinal(frozen, {
      add_facts: [extra],
      affected_dir_ids: ["dir_x"],
      now: "2026-11-02T14:00:00.000Z",
    });
    assert.equal(superseded.status, "superseded");
    assert.equal(superseded.content_hash, v1Hash);
    assert.equal(draft.status, "draft");
    assert.equal(draft.version, 2);
    assert.equal(draft.content_hash, null);
    assert.equal(draft.parent_version, 1);
    assert.ok(draft.reality_facts.some((f) => f.fact_id === "f_extra"));
  });

  await check("persist C1 commit / rollback / idempotency / restore DC authority", async () => {
    __resetPersistIdempotencyForTests();
    const baseDc = seedDecisionContextFromOpening({
      context_id: "dc_persist",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: null, sticking_point: null },
      desired_direction: { wants: null, priority: null },
    });
    const memory = {
      decision_context: baseDc,
      decision_context_versions: [] as DecisionContext[],
      control_plane: { phase: "opening" as unknown },
    };

    const tx = beginPersistTransaction(memory, { idempotency_key: "op_seed_1" });
    assert.ok(tx);
    const next = {
      ...baseDc,
      definition: { ...baseDc.definition, stakes: "updated" },
    };
    applyDcToWorking(tx!, next);
    applyControlPlaneToWorking(tx!, { phase: "collecting" });
    const ok = await commitPersistTransaction(tx!, async () => {});
    assert.equal(ok.committed, true);
    assert.equal(ok.session.decision_context?.definition.stakes, "updated");

    const tx2 = beginPersistTransaction(memory, { idempotency_key: "op_fail" });
    applyDcToWorking(tx2!, {
      ...baseDc,
      definition: { ...baseDc.definition, stakes: "should_not_stick" },
    });
    applyControlPlaneToWorking(tx2!, { phase: "x" });
    const fail = await commitPersistTransaction(tx2!, async () => {
      throw new Error("IDB write failed");
    });
    assert.equal(fail.committed, false);
    assert.equal(fail.rolled_back, true);
    assert.equal(fail.session.decision_context?.definition.stakes, null);

    const tx3 = beginPersistTransaction(memory, { idempotency_key: "op_once" });
    applyDcToWorking(tx3!, next);
    applyControlPlaneToWorking(tx3!, { phase: "collecting" });
    const first = await commitPersistTransaction(tx3!, async () => {});
    assert.equal(first.committed, true);
    const tx4 = beginPersistTransaction(memory, { idempotency_key: "op_once" });
    assert.equal(tx4, null);

    const restored = restoreDecisionContextAuthority({
      persisted_dc: next,
      agent_v2_buffers: {
        core_dilemma: { concrete_event: "STALE BUFFER" },
        breakthrough_core: { situation_conclusion: "ignore me" },
      },
    });
    assert.equal(restored.decision_context?.definition.concrete_event, "E");
    assert.equal(restored.ignored_buffers, true);
  });


  await check("NEG: critical P5-affecting unknown must NOT Freeze (no bypass)", () => {
    const dc: DecisionContext = {
      ...seedDecisionContextFromOpening({
        context_id: "dc_neg_unknown",
        now: "2026-11-02T12:00:00.000Z",
        core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
        desired_direction: { wants: "W", priority: null },
        user_statements: [
          {
            statement: "E",
            verification_level: "user_asserted",
            user_confirmed_event: true,
            fact_roles: ["event"],
          },
        ],
      }),
      dirs: [
        {
          dir_id: "dir_p5_unknown",
          need: "critical unknown",
          why: "changes P5 ranking",
          required_fact_roles: ["missing_role"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: true,
          id_lifecycle: "active",
        },
      ],
    };
    const suf = evaluateDecisionSufficiency(dc);
    assert.equal(suf.canStop, false);
    assert.equal(suf.verdict, "continue_collecting");
    assert.ok(suf.blocking_dir_ids.includes("dir_p5_unknown"));
    assert.throws(
      () =>
        freezeDecisionContext(dc, {
          stage3_sufficiency_end: true,
          now: "2026-11-02T13:00:00.000Z",
        }),
      FreezeError,
    );
  });

  await check("NEG: preferred-path open conflict must NOT Freeze (hard FAIL)", () => {
    const base = seedDecisionContextFromOpening({
      context_id: "dc_neg_conflict",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
      desired_direction: { wants: "W", priority: null },
      user_statements: [
        {
          statement: "Budget is 10k",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["budget"],
          status: "confirmed",
        },
        {
          statement: "Budget is 3k",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["budget"],
          status: "confirmed",
        },
      ],
    });
    const conflict = openConflict({
      conflict_id: "conflict_preferred",
      fact_ids: [base.reality_facts[0]!.fact_id, base.reality_facts[1]!.fact_id],
      conflict_field: "budget",
      facts: base.reality_facts,
      affects_preferred_path: true,
      now: "2026-11-02T12:00:00.000Z",
    });
    const dc: DecisionContext = {
      ...base,
      dirs: [
        {
          dir_id: "dir_budget",
          need: "budget clarity",
          why: "preferred path cost",
          required_fact_roles: ["budget"],
          current_state: "known",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: true,
          id_lifecycle: "active",
        },
      ],
      conflicts: [conflict],
    };
    const suf = evaluateDecisionSufficiency(dc);
    assert.equal(suf.canStop, false);
    assert.ok(suf.blocking_conflict_ids.includes("conflict_preferred"));
    assert.throws(
      () =>
        freezeDecisionContext(dc, {
          stage3_sufficiency_end: true,
          now: "2026-11-02T13:00:00.000Z",
        }),
      (err: unknown) => {
        assert.ok(err instanceof FreezeError);
        assert.match(String((err as Error).message), /preferred_path_open_conflicts|not sufficient/i);
        return true;
      },
    );
  });

  await check("non-P5 unknown may Freeze with boundary / degraded", () => {
    let dc = seedDecisionContextFromOpening({
      context_id: "dc_boundary_unknown",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
      desired_direction: { wants: "W", priority: null },
      user_statements: [
        {
          statement: "E",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["event"],
        },
      ],
    });
    dc.dirs = [
      {
        dir_id: "dir_boundary",
        need: "nice-to-have color",
        why: "does not change ranking",
        required_fact_roles: ["missing_color"],
        current_state: "unknown",
        partial_satisfaction: false,
        agenda_item_ids: [],
        may_affect_p5_ranking: false,
        id_lifecycle: "active",
      },
    ];
    dc.information_boundaries = ["color preference unknown; does not affect P5"];
    const suf = evaluateDecisionSufficiency(dc);
    assert.equal(suf.canStop, true);
    assert.equal(suf.verdict, "sufficient_with_boundaries");
    const { frozen } = freezeDecisionContext(dc, {
      stage3_sufficiency_end: true,
      now: "2026-11-02T13:00:00.000Z",
    });
    assert.equal(frozen.status, "final");
    assert.equal(frozen.delivery_mode, "degraded");
  });

  await check("non-preferred-path open conflict does not over-block; Freeze OK", () => {
    const base = seedDecisionContextFromOpening({
      context_id: "dc_nonpref_conflict",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
      desired_direction: { wants: "W", priority: null },
      user_statements: [
        {
          statement: "Prefers blue UI",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["color"],
          status: "confirmed",
        },
        {
          statement: "Prefers green UI",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["color"],
          status: "confirmed",
        },
        {
          statement: "Event E",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["event"],
          status: "confirmed",
        },
      ],
    });
    const conflict = openConflict({
      conflict_id: "conflict_color",
      fact_ids: [base.reality_facts[0]!.fact_id, base.reality_facts[1]!.fact_id],
      conflict_field: "ui_color",
      facts: base.reality_facts,
      affects_preferred_path: false,
      now: "2026-11-02T12:00:00.000Z",
    });
    const dc: DecisionContext = {
      ...base,
      dirs: [
        {
          dir_id: "dir_event",
          need: "event known",
          why: "core",
          required_fact_roles: ["event"],
          current_state: "known",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: true,
          id_lifecycle: "active",
        },
      ],
      conflicts: [conflict],
    };
    const suf = evaluateDecisionSufficiency(dc);
    assert.equal(suf.canStop, true, "non-preferred conflict must not over-block stop");
    assert.equal(suf.verdict, "sufficient_with_boundaries");
    assert.deepEqual(suf.blocking_conflict_ids, []);
    assert.ok(suf.nonblocking_conflict_ids.includes("conflict_color"));
    const { frozen } = freezeDecisionContext(dc, {
      stage3_sufficiency_end: true,
      now: "2026-11-02T13:00:00.000Z",
    });
    assert.equal(frozen.status, "final");
    assert.equal(frozen.conflicts[0]!.state, "unresolved_in_final");
    assert.equal(frozen.delivery_mode, "degraded");
  });


  await check("NEG: mixed true+undefined DIR; undefined P5 unknown must block Freeze", () => {
    const base = seedDecisionContextFromOpening({
      context_id: "dc_mixed_p5_undefined",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
      desired_direction: { wants: "W", priority: null },
      user_statements: [
        {
          statement: "Event E",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["event"],
          status: "confirmed",
        },
      ],
    });
    const dc: DecisionContext = {
      ...base,
      dirs: [
        {
          dir_id: "dir_flagged_true",
          need: "explicit P5",
          why: "flagged true and known",
          required_fact_roles: ["event"],
          current_state: "known",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: true,
          id_lifecycle: "active",
        },
        {
          dir_id: "dir_undefined_p5",
          need: "omitted P5 field",
          why: "undefined must be treated as may-affect-P5",
          required_fact_roles: ["missing_role"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          // may_affect_p5_ranking intentionally omitted (undefined)
          id_lifecycle: "active",
        },
      ],
    };
    const suf = evaluateDecisionSufficiency(dc);
    assert.equal(suf.canStop, false, "undefined P5 unknown must not be dropped when a true DIR exists");
    assert.equal(suf.verdict, "continue_collecting");
    assert.ok(
      suf.blocking_dir_ids.includes("dir_undefined_p5"),
      `expected dir_undefined_p5 in blocking_dir_ids, got ${JSON.stringify(suf.blocking_dir_ids)}`,
    );
    assert.throws(
      () =>
        freezeDecisionContext(dc, {
          stage3_sufficiency_end: true,
          now: "2026-11-02T13:00:00.000Z",
        }),
      FreezeError,
    );
  });

  await check("non-preferred Conflict linked to P5 DIR must NOT upgrade via aggregation", () => {
    const base = seedDecisionContextFromOpening({
      context_id: "dc_nonpref_agg",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
      desired_direction: { wants: "W", priority: null },
      user_statements: [
        {
          statement: "Budget is 10k",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["budget"],
          status: "confirmed",
        },
        {
          statement: "Budget is 3k",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["budget"],
          status: "confirmed",
        },
      ],
    });
    const conflict = openConflict({
      conflict_id: "conflict_nonpref_budget",
      fact_ids: [base.reality_facts[0]!.fact_id, base.reality_facts[1]!.fact_id],
      conflict_field: "budget_display",
      facts: base.reality_facts,
      affects_preferred_path: false,
      now: "2026-11-02T12:00:00.000Z",
    });
    const dir: DIR = {
      dir_id: "dir_budget_p5",
      need: "budget clarity",
      why: "P5-critical but conflict is non-preferred",
      required_fact_roles: ["budget"],
      current_state: "known",
      partial_satisfaction: false,
      agenda_item_ids: [],
      may_affect_p5_ranking: true,
      id_lifecycle: "active",
    };
    const agg = aggregateDirState(dir, base.reality_facts, [conflict]);
    assert.notEqual(
      agg.current_state,
      "conflict",
      "non-preferred conflict must not reaggregate DIR into conflict",
    );
    assert.equal(agg.current_state, "known");

    const dc: DecisionContext = {
      ...base,
      dirs: [dir],
      conflicts: [conflict],
    };
    const suf = evaluateDecisionSufficiency(dc);
    assert.equal(suf.canStop, true);
    assert.deepEqual(suf.blocking_conflict_ids, []);
    const { frozen } = freezeDecisionContext(dc, {
      stage3_sufficiency_end: true,
      now: "2026-11-02T13:00:00.000Z",
    });
    assert.equal(frozen.status, "final");
    assert.equal(frozen.conflicts[0]!.state, "unresolved_in_final");
    assert.equal(frozen.dirs[0]!.current_state, "known");
    assert.notEqual(frozen.dirs[0]!.current_state, "conflict");
    assert.equal(frozen.delivery_mode, "degraded");
  });

  await check("preferred-path Conflict still hard-blocks even after aggregation path", () => {
    const base = seedDecisionContextFromOpening({
      context_id: "dc_pref_agg_block",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
      desired_direction: { wants: "W", priority: null },
      user_statements: [
        {
          statement: "Budget is 10k",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["budget"],
          status: "confirmed",
        },
        {
          statement: "Budget is 3k",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["budget"],
          status: "confirmed",
        },
      ],
    });
    const conflict = openConflict({
      conflict_id: "conflict_pref_budget",
      fact_ids: [base.reality_facts[0]!.fact_id, base.reality_facts[1]!.fact_id],
      conflict_field: "budget",
      facts: base.reality_facts,
      affects_preferred_path: true,
      now: "2026-11-02T12:00:00.000Z",
    });
    const dir: DIR = {
      dir_id: "dir_budget_pref",
      need: "budget clarity",
      why: "preferred path cost",
      required_fact_roles: ["budget"],
      current_state: "known",
      partial_satisfaction: false,
      agenda_item_ids: [],
      may_affect_p5_ranking: true,
      id_lifecycle: "active",
    };
    const agg = aggregateDirState(dir, base.reality_facts, [conflict]);
    assert.equal(
      agg.current_state,
      "conflict",
      "preferred-path conflict must still upgrade DIR via aggregation",
    );

    const dc: DecisionContext = {
      ...base,
      dirs: [dir],
      conflicts: [conflict],
    };
    const suf = evaluateDecisionSufficiency(dc);
    assert.equal(suf.canStop, false);
    assert.ok(suf.blocking_conflict_ids.includes("conflict_pref_budget"));
    assert.throws(
      () =>
        freezeDecisionContext(dc, {
          stage3_sufficiency_end: true,
          now: "2026-11-02T13:00:00.000Z",
        }),
      FreezeError,
    );

    // Even if open Conflicts were converted first, reaggregated P5 DIR conflict must block.
    const unresolved = markOpenConflictsUnresolvedInFinal([conflict], "2026-11-02T13:00:00.000Z");
    const dirsAfter = reaggregateDirs([dir], base.reality_facts, unresolved);
    assert.equal(dirsAfter[0]!.current_state, "conflict");
    const post = evaluateDecisionSufficiency({
      ...dc,
      dirs: dirsAfter,
      conflicts: unresolved,
    });
    assert.equal(post.canStop, false, "post-aggregation P5 DIR conflict must hard-block");
    assert.ok(post.blocking_dir_ids.includes("dir_budget_pref"));
  });

  await check("Freeze final aggregate must not leave Gate-skipped blocking state", () => {
    // Pre-gate looks stoppable (known P5 DIR + non-preferred conflict), but if aggregation
    // wrongly upgraded the DIR to conflict, post-agg Gate must reject. With the fix,
    // aggregation does not upgrade; Freeze succeeds and final state remains Gate-clean.
    const base = seedDecisionContextFromOpening({
      context_id: "dc_freeze_post_agg_gate",
      now: "2026-11-02T12:00:00.000Z",
      core_dilemma: { concrete_event: "E", stakes: "S", sticking_point: null },
      desired_direction: { wants: "W", priority: null },
      user_statements: [
        {
          statement: "Color A",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["color"],
          status: "confirmed",
        },
        {
          statement: "Color B",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["color"],
          status: "confirmed",
        },
        {
          statement: "Event E",
          verification_level: "user_asserted",
          user_confirmed_event: true,
          fact_roles: ["event"],
          status: "confirmed",
        },
      ],
    });
    const nonPref = openConflict({
      conflict_id: "conflict_color_gate",
      fact_ids: [base.reality_facts[0]!.fact_id, base.reality_facts[1]!.fact_id],
      conflict_field: "color",
      facts: base.reality_facts,
      affects_preferred_path: false,
      now: "2026-11-02T12:00:00.000Z",
    });
    const dc: DecisionContext = {
      ...base,
      dirs: [
        {
          dir_id: "dir_event_gate",
          need: "event",
          why: "core P5",
          required_fact_roles: ["event"],
          current_state: "known",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: true,
          id_lifecycle: "active",
        },
        {
          dir_id: "dir_color_p5",
          need: "color",
          why: "linked facts but non-preferred conflict",
          required_fact_roles: ["color"],
          current_state: "known",
          partial_satisfaction: false,
          agenda_item_ids: [],
          may_affect_p5_ranking: true,
          id_lifecycle: "active",
        },
      ],
      conflicts: [nonPref],
    };

    const pre = evaluateDecisionSufficiency(dc);
    assert.equal(pre.canStop, true);

    const { frozen } = freezeDecisionContext(dc, {
      stage3_sufficiency_end: true,
      now: "2026-11-02T13:00:00.000Z",
    });
    assert.equal(frozen.status, "final");

    // Final aggregate must not contain a P5-affecting DIR conflict that skipped the Gate.
    const blockingFinalDirs = frozen.dirs.filter(
      (d) =>
        d.id_lifecycle === "active" &&
        d.current_state === "conflict" &&
        d.may_affect_p5_ranking !== false,
    );
    assert.equal(
      blockingFinalDirs.length,
      0,
      `frozen DC has Gate-skipped blocking DIR conflict(s): ${blockingFinalDirs.map((d) => d.dir_id).join(",")}`,
    );

    // Crafted post-agg blocking state must be rejected by Freeze Gate re-validation path.
    const craftedBlocking: DecisionContext = {
      ...dc,
      dirs: dc.dirs.map((d) =>
        d.dir_id === "dir_color_p5" ? { ...d, current_state: "conflict" as const } : d,
      ),
      conflicts: markOpenConflictsUnresolvedInFinal(dc.conflicts, "2026-11-02T13:00:00.000Z"),
    };
    const craftedSuf = evaluateDecisionSufficiency(craftedBlocking);
    assert.equal(craftedSuf.canStop, false);
    assert.ok(craftedSuf.blocking_dir_ids.includes("dir_color_p5"));
  });

  console.log(`\nAll decision-context phase1 checks passed (${passed}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
