/**
 * S0 — DIR N/A Catalog SSOT & loader.
 * S1 — declare write-side catalog integration (DC-1/2/3/9).
 * S2 — Freeze compose loads ACTIVE catalog; ignore authority.dirCatalog.
 *   pnpm test:intake-r6-dir-catalog
 */
import assert from "node:assert/strict";
import * as catalogApi from "../lib/poju/decision-context/catalog";
import {
  ACTIVE_DIR_NA_CATALOG_VERSION,
  DIR_NA_CATALOG_VERSION,
  assertNaConditionInDirCatalog,
  loadDirNaCatalog,
  resolveDirNaCatalog,
} from "../lib/poju/decision-context/catalog";
import { reaggregateDirsIntake } from "../lib/poju/decision-context/dir-aggregator-intake";
import { freezeDraftForDelivery } from "../lib/poju/decision-context/freeze-to-delivery";
import {
  applyDeclareDirNaToSession,
  membershipFromCatalogLoad,
  NaDeclarationError,
} from "../lib/poju/decision-context/na-declaration";
import { buildProductionNaValidationContextFromSession } from "../lib/poju/decision-context/na-validation-from-session";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import type { POJUSessionState } from "../lib/poju/types";
import {
  additiveV1V2Registries,
  registryNonArrayEntries,
  registryThrowingOnGet,
  registryThrowingOnHas,
  registryVersionMismatch,
  registryWithoutVersion,
} from "./fixtures/dir-na-catalog-test-registry";

const SSOT_DIR = "DIR-DEF-UNACCEPTABLE";
const SSOT_CODE = "explicit_no_hard_red_lines";
/** Non-SSOT pair for DC-8 (forged catalog only). */
const FORGE_DIR = "DIR-A";
const FORGE_CODE = "explicit_not_applicable";
const WRITE_NOW = "2026-11-05T12:00:00.000Z";
const WRITE_SESSION = "sess-s1-dir-catalog";
const WRITE_CTX = "dc-s1-dir-catalog";

function e1ForFact(factId: string) {
  return {
    event_id: `e1_${factId}`,
    target_type: "fact" as const,
    fact_id: factId,
    source_turn_id: "t1",
    confirmation_turn_id: "t1b",
    confirmation_action_id: `ca_${factId}`,
    event_type: "confirm_fact" as const,
    actor: "user" as const,
    confirmed_at: WRITE_NOW,
    event_version: 1,
  };
}

function makeWriteSession(
  overrides: {
    dirId?: string;
    factId?: string;
  } = {},
): POJUSessionState {
  const dirId = overrides.dirId ?? SSOT_DIR;
  const factId = overrides.factId ?? "fact_s1";
  const fact = {
    fact_id: factId,
    statement: "s1",
    status: "confirmed" as const,
    verification_level: "user_asserted" as const,
    source_stage: "user_supplement" as const,
    source_turn_id: "t1",
    user_confirmed: true,
    fact_roles: ["situation"],
    related_dir_ids: [dirId],
  };
  const dir = {
    dir_id: dirId,
    need: "need",
    why: "why",
    required_fact_roles: ["situation"],
    current_state: "unknown" as const,
    partial_satisfaction: false,
    agenda_item_ids: [] as string[],
    id_lifecycle: "active" as const,
    may_affect_p5_ranking: false as const,
  };
  const draftShell: DecisionContext = {
    context_id: WRITE_CTX,
    version: 1,
    status: "draft",
    definition: {
      concrete_event: "Stay or leave",
      stakes: "Income",
      desired_outcome: null,
      decision_question: "Q",
      goal_priorities: [],
      unacceptable_outcomes: [],
    },
    reality_facts: [fact],
    constraints: [],
    hypotheses: [],
    dirs: [dir],
    conflicts: [],
    content_hash: null,
    created_at: WRITE_NOW,
    updated_at: WRITE_NOW,
  };
  const sessionShell = {
    session_id: WRITE_SESSION,
    decision_context: draftShell,
    messages: [],
    created_at: WRITE_NOW,
    last_interaction_at: WRITE_NOW,
    expires_at: "2026-12-01T00:00:00.000Z",
    confirmation_events: [e1ForFact(factId)],
  } as POJUSessionState;
  const na = buildProductionNaValidationContextFromSession(sessionShell, {
    nowIso: WRITE_NOW,
  });
  const dirs = reaggregateDirsIntake([dir], [fact], [], [], [], na);
  const dc: DecisionContext = { ...draftShell, dirs };
  return { ...sessionShell, decision_context: dc };
}

function baseDeclareInput(
  overrides: Partial<{
    declaration_action_id: string;
    dir_id: string;
    na_condition_code: string;
    dir_na_conditions: readonly string[];
  }> = {},
) {
  return {
    operation_id: "op_s1",
    declaration_action_id: overrides.declaration_action_id ?? "na-act-s1",
    control_id: "na_declare" as const,
    fact_id: "fact_s1",
    dir_id: overrides.dir_id ?? SSOT_DIR,
    na_condition_code: overrides.na_condition_code ?? SSOT_CODE,
    declaration_turn_id: "turn_s1",
    dir_na_conditions: overrides.dir_na_conditions ?? [SSOT_CODE],
  };
}

const EXPECTED_DIR_IDS = [
  "DIR-DEF-QUESTION",
  "DIR-DEF-OUTCOME",
  "DIR-DEF-STAKES",
  "DIR-DEF-PRIORITIES",
  "DIR-DEF-UNACCEPTABLE",
  "DIR-OPT-ON-TABLE",
  "DIR-STATUS-QUO",
  "DIR-OPT-CONSTRAINTS",
  "DIR-OPT-IRREV",
  "DIR-PAST-ATTEMPTS",
  "DIR-TIMING-WINDOW",
  "DIR-RISK-TOLERANCE",
  "DIR-EXIT-CRITERIA",
  "DIR-VALIDATION-CAPACITY",
  "DIR-STAKEHOLDERS",
  "DIR-REL-DYNAMICS",
  "DIR-JOB-OFFER",
  "DIR-BIZ-MODEL",
  "DIR-LOCALE-MOVE",
  "DIR-EDU-PATH",
] as const;

const EXPECTED_TOKENS: Record<string, readonly string[]> = {
  "DIR-DEF-QUESTION": [],
  "DIR-DEF-OUTCOME": [],
  "DIR-DEF-STAKES": ["explicit_stakes_unknowable_boundary"],
  "DIR-DEF-PRIORITIES": [],
  "DIR-DEF-UNACCEPTABLE": ["explicit_no_hard_red_lines"],
  "DIR-OPT-ON-TABLE": [],
  "DIR-STATUS-QUO": ["explicit_no_current_state"],
  "DIR-OPT-CONSTRAINTS": ["explicit_no_material_constraints"],
  "DIR-OPT-IRREV": ["explicit_fully_reversible"],
  "DIR-PAST-ATTEMPTS": ["explicit_first_time_decision"],
  "DIR-TIMING-WINDOW": ["explicit_open_ended_timing"],
  "DIR-RISK-TOLERANCE": [],
  "DIR-EXIT-CRITERIA": ["explicit_no_exit_all_in"],
  "DIR-VALIDATION-CAPACITY": ["explicit_nothing_testable"],
  "DIR-STAKEHOLDERS": ["explicit_solo_decision"],
  "DIR-REL-DYNAMICS": [],
  "DIR-JOB-OFFER": [],
  "DIR-BIZ-MODEL": [],
  "DIR-LOCALE-MOVE": [],
  "DIR-EDU-PATH": [],
};

function main() {
  console.log("intake-r6-dir-catalog (S0)");

  assert.equal(DIR_NA_CATALOG_VERSION, 1);
  assert.equal(ACTIVE_DIR_NA_CATALOG_VERSION, 1);

  // Valid ACTIVE
  const ok = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION);
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error("unreachable");
  assert.equal(ok.dir_catalog_version, 1);
  assert.equal(ok.entries.length, 20);
  console.log("  PASS  loadDirNaCatalog(ACTIVE) → ok, version 1, 20 entries");

  // Phase 2 id + token inventory
  const ids = new Set(ok.entries.map((e) => e.dir_id));
  assert.equal(ids.size, EXPECTED_DIR_IDS.length);
  for (const id of EXPECTED_DIR_IDS) {
    assert.ok(ids.has(id), `missing dir_id ${id}`);
    const entry = ok.entries.find((e) => e.dir_id === id)!;
    assert.deepEqual(
      [...entry.na_conditions],
      [...EXPECTED_TOKENS[id]!],
      `token mismatch for ${id}`,
    );
  }
  console.log("  PASS  Phase 2 20 DIR ids + condition tokens match");

  // Deep freeze
  assert.ok(Object.isFrozen(ok.entries));
  for (const entry of ok.entries) {
    assert.ok(Object.isFrozen(entry), `entry not frozen: ${entry.dir_id}`);
    assert.ok(
      Object.isFrozen(entry.na_conditions),
      `na_conditions not frozen: ${entry.dir_id}`,
    );
  }
  console.log("  PASS  deep freeze (entries / entry / na_conditions)");

  // Explicit undefined / null → missing (not ACTIVE)
  const missU = loadDirNaCatalog(undefined);
  assert.equal(missU.ok, false);
  if (!missU.ok) assert.equal(missU.reason_code, "dir_catalog_version_missing");
  const missN = loadDirNaCatalog(null);
  assert.equal(missN.ok, false);
  if (!missN.ok) assert.equal(missN.reason_code, "dir_catalog_version_missing");
  console.log("  PASS  undefined/null → dir_catalog_version_missing");

  // Invalid
  for (const bad of [1.1, 0, -1, Number.NaN] as const) {
    const r = resolveDirNaCatalog(bad, new Map(), ACTIVE_DIR_NA_CATALOG_VERSION);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, "dir_catalog_version_invalid");
  }
  console.log("  PASS  invalid versions → dir_catalog_version_invalid");

  // Unknown (non-ACTIVE absent)
  const unk = resolveDirNaCatalog(
    999,
    new Map([
      [
        1,
        {
          dir_catalog_version: 1,
          entries: ok.entries,
        },
      ],
    ]),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(unk.ok, false);
  if (!unk.ok) assert.equal(unk.reason_code, "dir_catalog_version_unknown");
  console.log("  PASS  999 → dir_catalog_version_unknown");

  // DC-4(1) ACTIVE absent from test-local registry
  const ssot = resolveDirNaCatalog(
    1,
    registryWithoutVersion(1),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(ssot.ok, false);
  if (!ssot.ok) assert.equal(ssot.reason_code, "dir_catalog_ssot_unavailable");
  console.log("  PASS  ACTIVE∉registry → dir_catalog_ssot_unavailable");

  // load_failed matrix — must not throw out
  const failHasThrow = resolveDirNaCatalog(
    1,
    registryThrowingOnHas(1),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(failHasThrow.ok, false);
  if (!failHasThrow.ok) {
    assert.equal(failHasThrow.reason_code, "dir_catalog_load_failed");
  }

  const failThrow = resolveDirNaCatalog(
    1,
    registryThrowingOnGet(1),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(failThrow.ok, false);
  if (!failThrow.ok) {
    assert.equal(failThrow.reason_code, "dir_catalog_load_failed");
  }

  const failMismatch = resolveDirNaCatalog(
    1,
    registryVersionMismatch(1, 2),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(failMismatch.ok, false);
  if (!failMismatch.ok) {
    assert.equal(failMismatch.reason_code, "dir_catalog_load_failed");
  }

  const failNonArray = resolveDirNaCatalog(
    1,
    registryNonArrayEntries(1),
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
  assert.equal(failNonArray.ok, false);
  if (!failNonArray.ok) {
    assert.equal(failNonArray.reason_code, "dir_catalog_load_failed");
  }
  console.log(
    "  PASS  load_failed: has-throw / get-throw / version mismatch / non-array (no rethrow)",
  );

  // Membership
  const allow = assertNaConditionInDirCatalog(
    ok,
    "DIR-DEF-UNACCEPTABLE",
    "explicit_no_hard_red_lines",
  );
  assert.equal(allow.ok, true);
  const denyDir = assertNaConditionInDirCatalog(ok, "DIR-NOT-REAL", "x");
  assert.equal(denyDir.ok, false);
  if (!denyDir.ok) assert.equal(denyDir.reason_code, "dir_not_in_catalog");
  const denyCode = assertNaConditionInDirCatalog(
    ok,
    "DIR-DEF-UNACCEPTABLE",
    "explicit_no_material_constraints",
  );
  assert.equal(denyCode.ok, false);
  if (!denyCode.ok) {
    assert.equal(denyCode.reason_code, "na_condition_not_in_catalog");
  }
  console.log("  PASS  membership allow / deny DIR / deny condition");

  // Additive-only: every non-empty v1 (dir_id, code) still ok under v2
  const expectedNonEmptyPairs: Array<{ dir_id: string; code: string }> = [];
  for (const [dirId, codes] of Object.entries(EXPECTED_TOKENS)) {
    for (const code of codes) {
      expectedNonEmptyPairs.push({ dir_id: dirId, code });
    }
  }
  const { v2, v1Pairs } = additiveV1V2Registries();
  assert.equal(v1Pairs.length, expectedNonEmptyPairs.length);
  assert.deepEqual(
    [...v1Pairs].sort((a, b) =>
      `${a.dir_id}:${a.code}`.localeCompare(`${b.dir_id}:${b.code}`),
    ),
    [...expectedNonEmptyPairs].sort((a, b) =>
      `${a.dir_id}:${a.code}`.localeCompare(`${b.dir_id}:${b.code}`),
    ),
  );
  const v2Load = resolveDirNaCatalog(2, v2, 2);
  assert.equal(v2Load.ok, true);
  if (!v2Load.ok) throw new Error("unreachable");
  for (const pair of v1Pairs) {
    const m = assertNaConditionInDirCatalog(v2Load, pair.dir_id, pair.code);
    assert.equal(m.ok, true, `additive fail ${pair.dir_id}/${pair.code}`);
  }
  console.log(
    `  PASS  additive-only all ${v1Pairs.length} v1 pairs still ok under v2`,
  );

  // Production Registry must not be a public export of the catalog barrel
  assert.equal("productionDirNaRegistry" in catalogApi, false);
  assert.equal("PRODUCTION_DIR_NA_REGISTRY" in catalogApi, false);
  console.log("  PASS  production Registry not exported from catalog barrel");

  // --- S1 write-side (DC-1 / DC-2 / DC-3 / DC-9a / DC-9b) ---
  console.log("\nS1 write-side catalog integration");

  {
    const session = makeWriteSession();
    const applied = applyDeclareDirNaToSession(
      session,
      WRITE_SESSION,
      baseDeclareInput(),
      WRITE_NOW,
    );
    assert.equal(applied.outcome, "appended");
    assert.equal((applied.session.na_declaration_actions ?? []).length, 1);
    assert.equal(
      (applied.session.decision_context?.explicit_na_classifications ?? [])
        .length,
      1,
    );
    assert.ok(
      (applied.session.decision_context?.explicit_na_evidence ?? []).some(
        (e) => e.evidence_id === "na_ev_na-act-s1",
      ),
    );
    console.log("  PASS  DC-1 registered DIR+condition → append");

    const replay = applyDeclareDirNaToSession(
      applied.session,
      WRITE_SESSION,
      baseDeclareInput(),
      WRITE_NOW,
    );
    assert.equal(replay.outcome, "idempotent_skip");
    assert.equal((replay.session.na_declaration_actions ?? []).length, 1);
    console.log("  PASS  DC-1 replay after catalog → idempotent_skip");
  }

  {
    const session = makeWriteSession();
    const before = (session.na_declaration_actions ?? []).length;
    let threw: unknown;
    try {
      applyDeclareDirNaToSession(
        session,
        WRITE_SESSION,
        baseDeclareInput({
          dir_id: "DIR-NOT-IN-SSOT",
          dir_na_conditions: [SSOT_CODE],
        }),
        WRITE_NOW,
      );
    } catch (e) {
      threw = e;
    }
    assert.ok(threw instanceof NaDeclarationError);
    assert.equal(
      (threw as NaDeclarationError).code,
      "dir_not_in_catalog",
    );
    assert.equal((session.na_declaration_actions ?? []).length, before);
    assert.equal(
      (session.decision_context?.explicit_na_classifications ?? []).length,
      0,
    );
    assert.equal(
      (session.decision_context?.explicit_na_evidence ?? []).length,
      0,
    );
    console.log("  PASS  DC-2 unregistered DIR → dir_not_in_catalog, no append");
  }

  {
    const session = makeWriteSession();
    let threw: unknown;
    try {
      applyDeclareDirNaToSession(
        session,
        WRITE_SESSION,
        baseDeclareInput({
          na_condition_code: "explicit_not_in_ssot_for_this_dir",
        }),
        WRITE_NOW,
      );
    } catch (e) {
      threw = e;
    }
    assert.ok(threw instanceof NaDeclarationError);
    assert.equal(
      (threw as NaDeclarationError).code,
      "na_condition_not_in_catalog",
    );
    assert.equal((session.na_declaration_actions ?? []).length, 0);
    assert.equal(
      (session.decision_context?.explicit_na_classifications ?? []).length,
      0,
    );
    assert.equal(
      (session.decision_context?.explicit_na_evidence ?? []).length,
      0,
    );
    console.log(
      "  PASS  DC-3 unregistered condition → na_condition_not_in_catalog, no append",
    );
  }

  {
    // DC-9a: unregistered DIR + forged list containing real SSOT condition
    const session = makeWriteSession();
    let threw: unknown;
    try {
      applyDeclareDirNaToSession(
        session,
        WRITE_SESSION,
        baseDeclareInput({
          declaration_action_id: "na-act-dc9a",
          dir_id: "DIR-FORGED",
          dir_na_conditions: [SSOT_CODE, "forged_allow_all"],
        }),
        WRITE_NOW,
      );
    } catch (e) {
      threw = e;
    }
    assert.ok(threw instanceof NaDeclarationError);
    assert.equal((threw as NaDeclarationError).code, "dir_not_in_catalog");
    assert.equal((session.na_declaration_actions ?? []).length, 0);
    assert.equal(
      (session.decision_context?.explicit_na_classifications ?? []).length,
      0,
    );
    assert.equal(
      (session.decision_context?.explicit_na_evidence ?? []).length,
      0,
    );
    console.log("  PASS  DC-9a forged list cannot authorize unregistered DIR");
  }

  {
    // DC-9b: registered DIR + illegal condition; caller list includes legal SSOT code
    const session = makeWriteSession();
    let threw: unknown;
    try {
      applyDeclareDirNaToSession(
        session,
        WRITE_SESSION,
        baseDeclareInput({
          declaration_action_id: "na-act-dc9b",
          na_condition_code: "explicit_forged_condition",
          dir_na_conditions: [SSOT_CODE, "forged_extra"],
        }),
        WRITE_NOW,
      );
    } catch (e) {
      threw = e;
    }
    assert.ok(threw instanceof NaDeclarationError);
    assert.equal(
      (threw as NaDeclarationError).code,
      "na_condition_not_in_catalog",
    );
    assert.equal((session.na_declaration_actions ?? []).length, 0);
    assert.equal(
      (session.decision_context?.explicit_na_classifications ?? []).length,
      0,
    );
    assert.equal(
      (session.decision_context?.explicit_na_evidence ?? []).length,
      0,
    );
    console.log(
      "  PASS  DC-9b forged legal-list cannot authorize illegal condition",
    );
  }

  {
    // Pure mapping coverage only — not production Registry fault integration.
    // Assert all five loader failure reason_codes pass through unchanged.
    for (const reason of [
      "dir_catalog_version_missing",
      "dir_catalog_version_invalid",
      "dir_catalog_version_unknown",
      "dir_catalog_ssot_unavailable",
      "dir_catalog_load_failed",
    ] as const) {
      const mapped = membershipFromCatalogLoad(
        { ok: false, reason_code: reason },
        SSOT_DIR,
        SSOT_CODE,
      );
      assert.equal(mapped.ok, false);
      if (!mapped.ok) assert.equal(mapped.reason_code, reason);
    }
    console.log(
      "  PASS  load-fail pure mapping coverage — all 5 loader reason_codes (not production Registry integration)",
    );
  }

  // --- S2 Freeze compose (DC-1 Freeze / DC-8) ---
  // Fail-closed !load.ok → FreezeError.code is code-reviewed, not runtime-tested.
  console.log("\nS2 Freeze compose catalog integration");

  {
    const session = makeWriteSession();
    const applied = applyDeclareDirNaToSession(
      session,
      WRITE_SESSION,
      baseDeclareInput({ declaration_action_id: "na-act-s2-dc1" }),
      WRITE_NOW,
    );
    assert.equal(applied.outcome, "appended");
    const draft = applied.session.decision_context!;
    const pack = freezeDraftForDelivery(structuredClone(draft), {
      session: applied.session,
      now: WRITE_NOW,
    });
    assert.equal(pack.frozen.status, "final");
    const frozenDir = pack.frozen.dirs.find((d) => d.dir_id === SSOT_DIR);
    assert.ok(frozenDir);
    assert.equal(
      frozenDir!.current_state,
      "n_a",
      "DC-1 Freeze: SSOT-authorized Session N/A must yield DIR n_a",
    );
    console.log("  PASS  DC-1 Freeze SSOT pair → DIR n_a via production compose");
  }

  {
    // Strengthened DC-8: Session owns full N/A stack for a non-SSOT pair;
    // forged authority.dirCatalog lists that pair; production compose must ignore it.
    const session = makeWriteSession({ dirId: FORGE_DIR, factId: "fact_forge" });
    const source_ref = {
      kind: "reality_fact" as const,
      fact_id: "fact_forge",
    };
    const action = {
      declaration_action_id: "na-act-s2-dc8",
      session_id: WRITE_SESSION,
      context_id: WRITE_CTX,
      actor: "user" as const,
      control_id: "na_declare",
      source_ref,
      dir_id: FORGE_DIR,
      na_condition_code: FORGE_CODE,
      declaration_turn_id: "turn_dc8",
      occurred_at: WRITE_NOW,
      revoked: false,
      expires_at: null as string | null,
    };
    const classification = {
      classification_id: "na_cls_na-act-s2-dc8",
      context_id: WRITE_CTX,
      source_ref,
      dir_id: FORGE_DIR,
      na_condition_code: FORGE_CODE,
      authority: "user_declared" as const,
      written_by: "code" as const,
      declaration_action_id: "na-act-s2-dc8",
      declaration_turn_id: "turn_dc8",
      revoked: false,
      expires_at: null as string | null,
      created_at: WRITE_NOW,
    };
    const evidence = {
      evidence_id: "na_ev_na-act-s2-dc8",
      target: "dir" as const,
      dir_id: FORGE_DIR,
      na_condition_code: FORGE_CODE,
      evidence_type: "user_explicit_na" as const,
      source_ref,
      written_by: "code" as const,
      revoked: false,
    };
    const dc = {
      ...session.decision_context!,
      explicit_na_classifications: [classification],
      explicit_na_evidence: [evidence],
    };
    assert.equal(dc.dirs[0]!.current_state, "known");
    const sess: POJUSessionState = {
      ...session,
      decision_context: dc,
      na_declaration_actions: [action],
    };
    const pack = freezeDraftForDelivery(structuredClone(dc), {
      session: sess,
      now: WRITE_NOW,
      authority: {
        dirCatalog: [{ dir_id: FORGE_DIR, na_conditions: [FORGE_CODE] }],
      },
    });
    assert.equal(pack.frozen.status, "final");
    assert.notEqual(
      pack.frozen.dirs[0]!.current_state,
      "n_a",
      "DC-8: forged authority.dirCatalog must not authorize non-SSOT pair",
    );
    assert.equal(pack.frozen.dirs[0]!.current_state, "known");
    console.log(
      "  PASS  DC-8 forged dirCatalog ignored — Session N/A for non-SSOT pair → not n_a",
    );
  }

  console.log("\nAll intake-r6-dir-catalog (S0+S1+S2) checks passed.");
}

main();
