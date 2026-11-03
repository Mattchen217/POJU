/**
 * Phase 3 S4 — Normalization / Fingerprint / Mapper / Opening Seed.
 * Run: pnpm test:normalize-s4
 * Does NOT start S5. Does NOT touch product Stage4 / Lab / 04 / SoT16 / BookJudgment.
 */

import assert from "node:assert/strict";
import type { BreakthroughCore } from "../lib/poju/agent-state";
import type { AgendaItem } from "../lib/poju/investigation-agenda";
import {
  CALL_A_FINGERPRINT_VERSION,
  CALL_B_FINGERPRINT_VERSION,
  NormalizeError,
  NORMALIZE_ILLEGAL_TYPE,
  DUPLICATE_AGENDA_ID,
  DirFromAgendaError,
  OpeningSeedError,
  OPENING_SEED_FORBIDDEN_ENTITY,
  OPENING_SEED_MISSING_SOURCE_TURN,
  agendaCoveredImpliesDirKnown,
  canonicalJson,
  dirsFromAgenda,
  dirsFromNormalizedCallB,
  fingerprintCallA,
  fingerprintCallB,
  fingerprintNormalizedObject,
  hypothesesFromBreakthroughCore,
  hypothesesFromNormalizedCallA,
  normalizeCallAInput,
  normalizeCallBInput,
  normalizeMapperString,
  prepareCallAGeneration,
  prepareCallBGeneration,
  seedDecisionContextFromOpening,
} from "../lib/poju/decision-context";

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

function sampleCore(over: Partial<BreakthroughCore> = {}): BreakthroughCore {
  return {
    situation_conclusion: "Fork between relocate and remote track",
    energy_structure: "Day master weak",
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
        chart_anchors: ["正官", "财星"],
      },
    ],
    primary_path: {
      direction: "Primary remote path",
      why_fits: "Fits family",
      structural_basis: "Basis P",
      needs_validation: "",
    },
    backup_path: {
      direction: "Backup relocate later",
      why_fits: "Keeps option",
      structural_basis: "Basis B",
      needs_validation: "Visa timing",
    },
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
    response: "user-facing dialogue must not enter fingerprint",
    ...over,
  };
}

async function main() {
  console.log("phase3-s4-normalize-fingerprint-mapper");

  await check("P3-121 NFC equivalence → same fingerprint", () => {
    // café: e + combining acute vs precomposed
    const a = "cafe\u0301";
    const b = "caf\u00e9";
    assert.equal(normalizeMapperString(a, "t"), normalizeMapperString(b, "t"));
    const n1 = normalizeCallAInput(
      sampleCore({ situation_conclusion: a }),
    );
    const n2 = normalizeCallAInput(
      sampleCore({ situation_conclusion: b }),
    );
    assert.equal(
      fingerprintCallA(n1).fingerprint,
      fingerprintCallA(n2).fingerprint,
    );
  });

  await check("whitespace / null rules", () => {
    assert.equal(normalizeMapperString("  hello   world  ", "t"), "hello world");
    assert.equal(normalizeMapperString(" \n\t ", "t"), null);
    assert.equal(normalizeMapperString("", "t"), null);
    assert.equal(normalizeMapperString(null, "t"), null);
    assert.equal(normalizeMapperString(undefined, "t"), null);
    assert.equal(normalizeMapperString("a\r\nb\rc", "t"), "a b c");
    assert.throws(
      () => normalizeMapperString(42 as unknown as string, "t"),
      (e: unknown) =>
        e instanceof NormalizeError && e.code === NORMALIZE_ILLEGAL_TYPE,
    );
  });

  await check("array order / slot stability changes FP; no filter-renumber", () => {
    const coreA = sampleCore({
      modern_action_frames: [
        {
          direction: "A",
          why_fits: "wa",
          structural_basis: "sa",
          needs_validation: "",
        },
        {
          direction: "B",
          why_fits: "wb",
          structural_basis: "sb",
          needs_validation: "v",
        },
      ],
    });
    const coreB = sampleCore({
      modern_action_frames: [
        {
          direction: "B",
          why_fits: "wb",
          structural_basis: "sb",
          needs_validation: "v",
        },
        {
          direction: "A",
          why_fits: "wa",
          structural_basis: "sa",
          needs_validation: "",
        },
      ],
    });
    const fpA = prepareCallAGeneration(coreA).fingerprint;
    const fpB = prepareCallAGeneration(coreB).fingerprint;
    assert.notEqual(fpA, fpB);

    // Sparse: empty middle slot preserved → later hypothesis keeps index-based id
    const sparse = sampleCore({
      modern_action_frames: [
        null as unknown as BreakthroughCore["modern_action_frames"][0],
        {
          direction: "Only second",
          why_fits: "x",
          structural_basis: "s",
          needs_validation: "",
        },
      ],
    });
    // normalize treats null element as null slot
    const normalized = normalizeCallAInput({
      ...sparse,
      modern_action_frames: [
        null,
        {
          direction: "Only second",
          why_fits: "x",
          structural_basis: "s",
          needs_validation: "",
        },
      ],
    });
    assert.equal(normalized.modern_action_frames.length, 2);
    assert.equal(normalized.modern_action_frames[0], null);
    assert.ok(normalized.modern_action_frames[1]?.direction);
    const hyps = hypothesesFromNormalizedCallA(normalized, {
      source_ref: "job_sparse",
      now: "2026-11-03T12:00:00.000Z",
    });
    const action = hyps.find((h) => h.hypothesis_id.includes("modern_action_"));
    assert.ok(action);
    assert.ok(
      action!.hypothesis_id.endsWith("modern_action_2"),
      "slot must stay at original index 1 → modern_action_2",
    );
  });

  await check("Call A same Normalized Object → stable hypotheses + shared FP", () => {
    const prepared = prepareCallAGeneration(sampleCore());
    const hyps1 = hypothesesFromNormalizedCallA(prepared.normalized, {
      source_ref: "job_abc",
      now: "2026-11-03T12:00:00.000Z",
    });
    const hyps2 = hypothesesFromNormalizedCallA(prepared.normalized, {
      source_ref: "job_abc",
      now: "2026-11-03T99:00:00.000Z",
    });
    assert.deepEqual(
      hyps1.map((h) => ({
        id: h.hypothesis_id,
        statement: h.statement,
        state: h.state,
        validation_need: h.validation_need,
        evidence: h.supporting_evidence,
      })),
      hyps2.map((h) => ({
        id: h.hypothesis_id,
        statement: h.statement,
        state: h.state,
        validation_need: h.validation_need,
        evidence: h.supporting_evidence,
      })),
    );
    // Fingerprint from same normalized object is stable
    assert.equal(
      fingerprintCallA(prepared.normalized).fingerprint,
      prepared.fingerprint,
    );
    assert.equal(prepared.fingerprint_version, CALL_A_FINGERPRINT_VERSION);
  });

  await check("Call A creates Hypotheses only — never Fact/Constraint", () => {
    const hyps = hypothesesFromBreakthroughCore(sampleCore(), {
      source_ref: "job_nofact",
      now: "2026-11-03T12:00:00.000Z",
    });
    assert.ok(hyps.length >= 3);
    assert.ok(hyps.every((h) => h.hypothesis_id.startsWith("hyp_")));
    // Mapper return type is Hypothesis[] — no fact_id / constraint_id fields
    for (const h of hyps) {
      assert.equal((h as { fact_id?: unknown }).fact_id, undefined);
      assert.equal((h as { constraint_id?: unknown }).constraint_id, undefined);
    }
    // same source_ref replace — no duplicate stack
    const again = hypothesesFromBreakthroughCore(sampleCore(), {
      source_ref: "job_nofact",
      existing: hyps,
      now: "2026-11-03T12:00:00.000Z",
    });
    assert.equal(
      again.filter((h) => h.source_ref === "job_nofact").length,
      hyps.length,
    );
  });

  await check("Call B 1:1 + duplicate ID hard-fail; order preserved", () => {
    const agenda: AgendaItem[] = [
      {
        id: "a1",
        label: "Spouse stance",
        critical: true,
        status: "covered",
        collection_goal: "Know hard constraint",
        serves_page: "01",
        role: "fill",
      },
      {
        id: "a2",
        label: "Timeline",
        critical: false,
        status: "unexplored",
        collection_goal: "Deadline",
        role: "calibrate",
      },
    ];
    const prepared = prepareCallBGeneration(agenda);
    const dirs = dirsFromNormalizedCallB(prepared.normalized);
    assert.equal(dirs.length, 2);
    assert.equal(dirs[0]!.dir_id, "dir_a1");
    assert.equal(dirs[1]!.dir_id, "dir_a2");
    assert.equal(dirs[0]!.current_state, "unknown");
    assert.equal(dirs[1]!.current_state, "unknown");

    assert.throws(
      () =>
        dirsFromAgenda([
          { id: "dup", label: "x", critical: true, status: "covered" },
          { id: "dup", label: "y", critical: false, status: "partial" },
        ]),
      (e: unknown) =>
        (e instanceof DirFromAgendaError || e instanceof NormalizeError) &&
        (e as { code: string }).code === DUPLICATE_AGENDA_ID,
    );
  });

  await check("Agenda covered ≠ DIR known; status does not set DIR state", () => {
    assert.equal(agendaCoveredImpliesDirKnown(), false);
    const dirs = dirsFromAgenda([
      {
        id: "cov",
        label: "Covered item",
        critical: true,
        status: "covered",
        collection_goal: "g",
      },
    ]);
    assert.equal(dirs[0]!.current_state, "unknown");
    assert.equal(dirs[0]!.partial_satisfaction, false);
  });

  await check("Opening Seed user-only facts; bans hyp/DIR/agenda/core", () => {
    const dc = seedDecisionContextFromOpening({
      session_id: "s4",
      now: "2026-11-03T12:00:00.000Z",
      core_dilemma: {
        concrete_event: "Offer expires Friday",
        stakes: "Career path",
        sticking_point: "Relocate",
      },
      desired_direction: { wants: "Optional remote", priority: "Family" },
      user_statements: [
        {
          statement: "Offer expires Friday",
          verification_level: "user_asserted",
          source_turn_id: "turn_user_1",
          has_user_confirm_event: true,
        },
        {
          statement: "Maybe 30% chance relocation ok",
          verification_level: "user_estimate",
          source_turn_id: "turn_user_2",
          has_user_confirm_event: true,
        },
      ],
      user_constraints: [
        {
          statement: "Cannot relocate this year",
          category: "responsibility",
          source_turn_id: "turn_user_1",
          has_user_confirm_event: true,
        },
      ],
    });
    assert.equal(dc.hypotheses.length, 0);
    assert.equal(dc.dirs.length, 0);
    assert.equal(dc.reality_facts.length, 2);
    assert.equal(dc.reality_facts[0]!.source_turn_id, "turn_user_1");
    assert.equal(dc.reality_facts[1]!.status, "unverified"); // user_estimate stays unverified
    assert.equal(dc.constraints.length, 1);

    assert.throws(
      () =>
        seedDecisionContextFromOpening({
          core_dilemma: null,
          desired_direction: null,
          breakthrough_core: { situation_conclusion: "nope" },
        }),
      (e: unknown) =>
        e instanceof OpeningSeedError &&
        e.code === OPENING_SEED_FORBIDDEN_ENTITY,
    );
    assert.throws(
      () =>
        seedDecisionContextFromOpening({
          core_dilemma: null,
          desired_direction: null,
          user_statements: [
            {
              statement: "x",
              verification_level: "user_asserted",
              source_turn_id: "   ",
            },
          ],
        }),
      (e: unknown) =>
        e instanceof OpeningSeedError &&
        e.code === OPENING_SEED_MISSING_SOURCE_TURN,
    );
  });

  await check("fingerprint_version change ≠ same FP identity (P3-127)", () => {
    const normalized = normalizeCallAInput(sampleCore());
    const v1 = fingerprintNormalizedObject(CALL_A_FINGERPRINT_VERSION, normalized);
    const v2 = fingerprintNormalizedObject(
      CALL_A_FINGERPRINT_VERSION + "_bump",
      normalized,
    );
    assert.notEqual(v1, v2);
    const bNorm = normalizeCallBInput([
      { id: "a1", label: "L", critical: true, status: "unexplored" },
    ]);
    const b1 = fingerprintNormalizedObject(CALL_B_FINGERPRINT_VERSION, bNorm);
    const b2 = fingerprintNormalizedObject("call_b_fp_v999", bNorm);
    assert.notEqual(b1, b2);
    // chart_anchors order change → FP change (P3-126)
    const c1 = prepareCallAGeneration(
      sampleCore({
        modern_action_frames: [
          {
            direction: "D",
            why_fits: "w",
            structural_basis: "s",
            needs_validation: "",
            chart_anchors: ["A", "B"],
          },
        ],
      }),
    );
    const c2 = prepareCallAGeneration(
      sampleCore({
        modern_action_frames: [
          {
            direction: "D",
            why_fits: "w",
            structural_basis: "s",
            needs_validation: "",
            chart_anchors: ["B", "A"],
          },
        ],
      }),
    );
    assert.notEqual(c1.fingerprint, c2.fingerprint);
  });

  await check("canonical key sort is deterministic", () => {
    const s1 = canonicalJson({ b: 1, a: { d: 2, c: 3 } });
    const s2 = canonicalJson({ a: { c: 3, d: 2 }, b: 1 });
    assert.equal(s1, s2);
  });

  await check("Call B fingerprint excludes status (Mapper-unread)", () => {
    const a = prepareCallBGeneration([
      { id: "x", label: "L", critical: true, status: "covered" },
    ]);
    const b = prepareCallBGeneration([
      { id: "x", label: "L", critical: true, status: "unexplored" },
    ]);
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(fingerprintCallB(a.normalized).fingerprint_version, CALL_B_FINGERPRINT_VERSION);
  });

  console.log(`\nnormalize-s4: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
