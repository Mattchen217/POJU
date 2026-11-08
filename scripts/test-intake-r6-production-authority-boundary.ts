/**
 * S7 闂?Production NaValidation authority boundary.
 *   pnpm test:intake-r6-production-authority-boundary
 *
 * Production entries (Freeze / Versioning / Lifecycle / Ask) must build
 * NaValidationContext only via buildProductionNaValidationContextFromSession:
 *   Session SoT  confirmation_events, na_declaration_actions,
 *                topic_applicability_evals, topic_catalog_version
 *   DC SoT       reality_facts, constraints, explicit_na_classifications
 *   Catalog      loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)
 *   Gaps         topicRules, catalogConditionEvals, cfpSourceState 闂?unset
 *
 * Every negative ("not n_a") assertion states its positive precondition
 * (same inputs + the missing authority 闂?n_a / "ok") and asserts the direct
 * reason_code, so the rule under test is the only cause.
 *
 * ACTIVE loader failure is exercised with a test-local fault: Map.prototype.has
 * throws only for the module-private production registry (identified by its
 * frozen v1 entries). No production seam, env var or exported registry is used.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";

installIntakeR6TestGlobals("dev_intake_r6_s7_boundary");

const NOW = "2026-11-08T12:00:00.000Z";
const TOPIC_EXPIRY = "2027-06-01T00:00:00.000Z";
/** ACTIVE v1: DIR-DEF-UNACCEPTABLE.na_conditions = ["explicit_no_hard_red_lines"]. */
const TARGET_DIR = "DIR-DEF-UNACCEPTABLE";
const SSOT_CODE = "explicit_no_hard_red_lines";
/** Not in ACTIVE catalog for TARGET_DIR (forged-catalog probe). */
const NON_ACTIVE_CODE = "explicit_not_applicable";

const REPO = process.cwd();

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(e);
  }
}

async function main() {
  console.log("intake-r6-production-authority-boundary (S7)");

  const dcMod = await import("../lib/poju/decision-context");
  const {
    ACTIVE_DIR_NA_CATALOG_VERSION,
    buildFreezeNaValidationFromSession,
    buildIntakeCandidatesFromDc,
    buildProductionNaValidationContextFromSession,
    FreezeError,
    freezeDraftForDelivery,
    ensureSessionFrozenForDelivery,
    applyV2FromFinalToSession,
    persistV2FromFinalOnSession,
    applyCallBToSessionDc,
    applyCollectingUserTurnToSessionDc,
    persistCallBDcOnSession,
    persistCollectingUserTurnDc,
    loadDirNaCatalog,
    naValidationForDcSnapshot,
    planNextAskFromCandidates,
    PRODUCTION_NA_VALIDATION_DIR_CATALOG_SOURCE,
    PRODUCTION_NA_VALIDATION_SOURCE_GAPS,
    ProductionNaAuthorityError,
    reaggregateDirsIntake,
    reaggregateDirsOnSession,
    selectNextIntakeAskForSession,
    snapshotFromDc,
    validateExplicitNaEvidence,
  } = dcMod;
  const { naValidationBoundToDc } = await import(
    "../lib/poju/decision-context/na-validation-from-session"
  );
  const { createDefaultControlPlane } = await import(
    "../lib/poju/decision-context/control-plane"
  );
  const { DIR_NA_CATALOG_V1_ENTRIES } = await import(
    "../lib/poju/decision-context/catalog/dir-na-catalog.v1"
  );
  const { __resetPojuDbForTests, ensurePojuDbReady } = await import(
    "../lib/db/poju-db"
  );
  const { createPOJUSession, loadPOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { mutatePOJUSession } = await import("../lib/poju/session-mutation");

  type DecisionContext =
    import("../lib/poju/decision-context/types").DecisionContext;
  type ExplicitNaEvidence =
    import("../lib/poju/decision-context/types").ExplicitNaEvidence;
  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type NaValidationContext =
    import("../lib/poju/decision-context/explicit-na-validate").NaValidationContext;
  type AuthoritativeTopicEvalRecord =
    import("../lib/poju/decision-context/topic-eval-authority").AuthoritativeTopicEvalRecord;
  type ConfirmationEvent =
    import("../lib/poju/decision-context/confirmation-event").ConfirmationEvent;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  // ---------------------------------------------------------------- helpers
  function reasonOf(ev: ExplicitNaEvidence, ctx: NaValidationContext): string {
    const r = validateExplicitNaEvidence(ev, ctx);
    return r.ok ? "ok" : r.reason_code;
  }

  function activeEntries() {
    const load = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION);
    if (!load.ok) throw new Error(`ACTIVE catalog unavailable: ${load.reason_code}`);
    return load.entries;
  }

  function stateOf(dirs: DecisionContext["dirs"], dirId = TARGET_DIR) {
    return dirs.find((d) => d.dir_id === dirId)?.current_state;
  }

  const definition = {
    concrete_event: "Stay or leave",
    stakes: "Income",
    desired_outcome: null,
    decision_question: "Q",
    goal_priorities: [] as string[],
    unacceptable_outcomes: [] as string[],
  };

  function e1For(factId: string, tag: string): ConfirmationEvent {
    return {
      event_id: `e1_${factId}`,
      target_type: "fact" as const,
      fact_id: factId,
      source_turn_id: `t_${tag}`,
      confirmation_turn_id: `t_${tag}_b`,
      confirmation_action_id: `ca_${factId}`,
      event_type: "confirm_fact" as const,
      actor: "user" as const,
      confirmed_at: NOW,
      event_version: 1,
    };
  }

  function factFor(
    factId: string,
    tag: string,
    roles = ["situation"],
    dirId = TARGET_DIR,
  ) {
    return {
      fact_id: factId,
      statement: "no hard red lines for this decision",
      status: "confirmed" as const,
      verification_level: "user_asserted" as const,
      source_stage: "user_supplement" as const,
      source_turn_id: `t_${tag}`,
      user_confirmed: true,
      fact_roles: roles,
      related_dir_ids: [dirId],
    };
  }

  function targetDir(
    state: "unknown" | "known" | "n_a" = "known",
    dirId = TARGET_DIR,
  ) {
    return {
      dir_id: dirId,
      need: "need",
      why: "why",
      required_fact_roles: ["situation"],
      current_state: state,
      partial_satisfaction: false,
      agenda_item_ids: [] as string[],
      id_lifecycle: "active" as const,
      may_affect_p5_ranking: false as const,
    };
  }

  function userTriad(args: {
    sessId: string;
    ctxId: string;
    factId: string;
    tag: string;
    code?: string;
    dirId?: string;
  }) {
    const code = args.code ?? SSOT_CODE;
    const dirId = args.dirId ?? TARGET_DIR;
    const actionId = `na-act-${args.tag}`;
    const turnId = `turn_${args.tag}`;
    const source_ref = { kind: "reality_fact" as const, fact_id: args.factId };
    const action = {
      declaration_action_id: actionId,
      session_id: args.sessId,
      context_id: args.ctxId,
      actor: "user" as const,
      control_id: "na_declare",
      source_ref,
      dir_id: dirId,
      na_condition_code: code,
      declaration_turn_id: turnId,
      occurred_at: NOW,
      revoked: false,
      expires_at: null as string | null,
    };
    const classification = {
      classification_id: `na_cls_${actionId}`,
      context_id: args.ctxId,
      source_ref,
      dir_id: dirId,
      na_condition_code: code,
      authority: "user_declared" as const,
      written_by: "code" as const,
      declaration_action_id: actionId,
      declaration_turn_id: turnId,
      revoked: false,
      expires_at: null as string | null,
      created_at: NOW,
    };
    const evidence: ExplicitNaEvidence = {
      evidence_id: `na_ev_${actionId}`,
      target: "dir",
      dir_id: dirId,
      na_condition_code: code,
      evidence_type: "user_explicit_na",
      source_ref,
      written_by: "code",
      revoked: false,
    };
    return { action, classification, evidence };
  }

  function makeDc(
    ctxId: string,
    partial: Partial<DecisionContext> = {},
  ): DecisionContext {
    return {
      context_id: ctxId,
      version: 1,
      status: "draft",
      definition,
      reality_facts: [],
      constraints: [],
      hypotheses: [],
      dirs: [targetDir()],
      conflicts: [],
      content_hash: null,
      created_at: NOW,
      updated_at: NOW,
      ...partial,
    };
  }

  function sessionOf(
    sessId: string,
    dc: DecisionContext,
    extra: Partial<POJUSessionState> = {},
  ): POJUSessionState {
    return {
      session_id: sessId,
      decision_context: dc,
      decision_context_versions: [],
      confirmation_events: [],
      na_declaration_actions: [],
      messages: [],
      control_plane: createDefaultControlPlane("collecting_context"),
      ...extra,
    } as POJUSessionState;
  }

  /** User-N/A case (default TARGET_DIR). `withSessionAction=false` drops the Action only. */
  function userCase(
    tag: string,
    opts: {
      code?: string;
      dirId?: string;
      withSessionAction?: boolean;
      withSessionE1?: boolean;
    } = {},
  ) {
    const sessId = `sess_s7_${tag}`;
    const ctxId = `dc_s7_${tag}`;
    const factId = `fact_s7_${tag}`;
    const dirId = opts.dirId ?? TARGET_DIR;
    const triad = userTriad({ sessId, ctxId, factId, tag, code: opts.code, dirId });
    const fact = factFor(factId, tag, ["situation"], dirId);
    const e1 = e1For(factId, tag);
    const dc = makeDc(ctxId, {
      dirs: [targetDir("known", dirId)],
      reality_facts: [fact],
      explicit_na_classifications: [triad.classification],
      explicit_na_evidence: [triad.evidence],
    });
    const session = sessionOf(sessId, dc, {
      confirmation_events: opts.withSessionE1 === false ? [] : [e1],
      na_declaration_actions:
        opts.withSessionAction === false ? [] : [triad.action],
    });
    const fixture = (extra: Parameters<typeof naValidationBoundToDc>[2] = {}) =>
      naValidationBoundToDc(dc, sessId, {
        nowIso: NOW,
        confirmationEvents: [e1],
        naDeclarationActions: [triad.action],
        dirCatalog: activeEntries(),
        ...extra,
      });
    const pureState = (na: NaValidationContext) =>
      stateOf(
        reaggregateDirsIntake(
          dc.dirs,
          dc.reality_facts,
          dc.conflicts,
          dc.constraints,
          dc.explicit_na_evidence ?? [],
          na,
        ),
        dirId,
      );
    return { sessId, ctxId, factId, dirId, fact, e1, triad, dc, session, fixture, pureState };
  }

  /** System-marker case (topic / catalog-condition) on TARGET_DIR. */
  function systemCase(
    tag: string,
    basis: Extract<ExplicitNaEvidence, { evidence_type: "system_na_marker" }>["system_basis"],
    sessionExtra: Partial<POJUSessionState> = {},
  ) {
    const sessId = `sess_s7_${tag}`;
    const ctxId = `dc_s7_${tag}`;
    const factId = `fact_s7_${tag}`;
    const fact = factFor(factId, tag);
    const evidence: ExplicitNaEvidence = {
      evidence_id: `na_ev_sys_${tag}`,
      target: "dir",
      dir_id: TARGET_DIR,
      na_condition_code: SSOT_CODE,
      evidence_type: "system_na_marker",
      system_basis: basis,
      written_by: "code",
      revoked: false,
    };
    const dc = makeDc(ctxId, {
      reality_facts: [fact],
      explicit_na_evidence: [evidence],
      explicit_na_classifications: [],
    });
    const session = sessionOf(sessId, dc, {
      confirmation_events: [e1For(factId, tag)],
      ...sessionExtra,
    });
    const pureState = (na: NaValidationContext) =>
      stateOf(
        reaggregateDirsIntake(
          dc.dirs,
          dc.reality_facts,
          dc.conflicts,
          dc.constraints,
          dc.explicit_na_evidence ?? [],
          na,
        ),
      );
    return { sessId, ctxId, dc, session, evidence, pureState };
  }

  function topicFixtures(tag: string) {
    const ruleId = `rule_s7_${tag}`;
    const topicCode = `topic.s7.${tag}`;
    const evalId = `topic_eval_${tag}`;
    const catalogVersion = `cat_v_${tag}`;
    const rule = {
      rule_id: ruleId,
      topic_code: topicCode,
      target_dir_id: TARGET_DIR,
      evaluation: {
        eval_id: evalId,
        evaluated_at: NOW,
        status: "current" as const,
        not_applicable: true,
        expires_at: TOPIC_EXPIRY,
        catalog_version: catalogVersion,
      },
    };
    const evalRow: AuthoritativeTopicEvalRecord = {
      eval_id: evalId,
      rule_id: ruleId,
      topic_code: topicCode,
      target_dir_id: TARGET_DIR,
      catalog_version: catalogVersion,
      not_applicable: true,
      evaluated_at: NOW,
      expires_at: TOPIC_EXPIRY,
      record_status: "current",
    };
    return { ruleId, topicCode, evalId, catalogVersion, rule, evalRow };
  }

  // Test-local ACTIVE loader fault (see file header).
  async function withActiveCatalogFault<T>(fn: () => T | Promise<T>): Promise<T> {
    const originalHas = Map.prototype.has;
    const originalGet = Map.prototype.get;
    const isProductionRegistry = (m: Map<unknown, unknown>): boolean => {
      const snap: unknown = originalGet.call(m, ACTIVE_DIR_NA_CATALOG_VERSION);
      return (
        typeof snap === "object" &&
        snap !== null &&
        Reflect.get(snap, "dir_catalog_version") === ACTIVE_DIR_NA_CATALOG_VERSION &&
        Array.isArray(Reflect.get(snap, "entries")) &&
        // Distinguish from topic registry snapshots (rules[]) vs DIR snapshots (entries[]).
        !Array.isArray(Reflect.get(snap, "rules"))
      );
    };
    Map.prototype.has = function patchedHas(
      this: Map<unknown, unknown>,
      key: unknown,
    ): boolean {
      if (key === ACTIVE_DIR_NA_CATALOG_VERSION && isProductionRegistry(this)) {
        throw new Error("S7 test-local fault: production DIR N/A registry read");
      }
      return originalHas.call(this, key);
    };
    try {
      return await fn();
    } finally {
      Map.prototype.has = originalHas;
    }
  }

  // ======================================================== A. builder sources
  console.log("\n== A. Production builder sources ==");
  {
    const t = topicFixtures("a");
    const c = userCase("a");
    const constraint = {
      constraint_id: "k_a",
      statement: "keep salary",
      category: "time" as const,
      status: "confirmed" as const,
      verification_level: "user_asserted" as const,
      source_stage: "user_supplement" as const,
      source_turn_id: "t_k_a",
      rigidity: "hard" as const,
      user_confirmed: true,
      related_dir_ids: [TARGET_DIR],
    };
    const dc = { ...c.dc, constraints: [constraint] };
    const session = sessionOf(c.sessId, dc, {
      confirmation_events: [c.e1],
      na_declaration_actions: [c.triad.action],
      topic_applicability_evals: [t.evalRow],
      topic_catalog_version: t.catalogVersion,
    });

    await check("A1 Session-owned authority read by reference from Session", async () => {
      const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
      assert.equal(ctx.sessionId, session.session_id);
      assert.strictEqual(ctx.confirmationEvents, session.confirmation_events);
      assert.strictEqual(ctx.naDeclarationActions, session.na_declaration_actions);
      assert.strictEqual(ctx.topicEvalAuthority, session.topic_applicability_evals);
      assert.equal(ctx.currentTopicCatalogVersion, t.catalogVersion);
      assert.equal(ctx.nowIso, NOW);
    });

    await check("A2 DC facts/constraints/classifications read from current DC", async () => {
      const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
      assert.equal(ctx.contextId, dc.context_id);
      assert.strictEqual(ctx.realityFacts, dc.reality_facts);
      assert.strictEqual(ctx.constraints, dc.constraints);
      assert.strictEqual(ctx.explicitNaClassifications, dc.explicit_na_classifications);
    });

    await check("A3 dirCatalog === loadDirNaCatalog(ACTIVE).entries", async () => {
      const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
      assert.strictEqual(ctx.dirCatalog, activeEntries());
      assert.deepEqual(ctx.dirCatalog, activeEntries());
      assert.equal(
        PRODUCTION_NA_VALIDATION_DIR_CATALOG_SOURCE,
        "loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION)",
      );
      assert.deepEqual(
        activeEntries().find((e) => e.dir_id === TARGET_DIR)?.na_conditions,
        [SSOT_CODE],
      );
    });

        await check("A4 S9: topicRules+CFP wired from SSOT/reader; catalogConditionEvals remain unset (no [] substitute)", async () => {
      const ctx = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
      assert.ok(Array.isArray(ctx.topicRules) && ctx.topicRules!.length >= 1, "topicRules from ACTIVE SSOT");
      assert.equal(ctx.catalogConditionEvals, undefined, "catalogConditionEvals");
      assert.equal(Object.prototype.hasOwnProperty.call(ctx, "catalogConditionEvals"), false);
      // default session has no profile skip 鈫?reader unavailable in Node 鈫?cfp unset (fail-closed)
      assert.equal(ctx.cfpSourceState, undefined, "cfpSourceState unset when reader unavailable");
      assert.deepEqual([...PRODUCTION_NA_VALIDATION_SOURCE_GAPS].map((s) => s.split(" ")[0]), [
        "catalogConditionEvals",
      ]);
      assert.equal(
        PRODUCTION_NA_VALIDATION_SOURCE_GAPS.some((s) => s.startsWith("dirCatalog")),
        false,
      );
      assert.equal(
        PRODUCTION_NA_VALIDATION_SOURCE_GAPS.some((s) => s.startsWith("topicRules")),
        false,
      );
      assert.equal(
        PRODUCTION_NA_VALIDATION_SOURCE_GAPS.some((s) => s.startsWith("cfpSourceState")),
        false,
      );
    });

    await check("A5 forged authority on builder opts ignored (non-literal opts)", async () => {
      const clean = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
      const forgedOpts = {
        nowIso: NOW,
        authority: { dirCatalog: [{ dir_id: TARGET_DIR, na_conditions: [NON_ACTIVE_CODE] }] },
        dirCatalog: [{ dir_id: TARGET_DIR, na_conditions: [NON_ACTIVE_CODE] }],
        topicRules: [t.rule],
        catalogConditionEvals: [
          { condition_eval_id: "x", target_dir_id: TARGET_DIR, na_condition_code: SSOT_CODE, condition_met: true },
        ],
        cfpSourceState: "source_absent_not_supplied",
        confirmationEvents: [],
        naDeclarationActions: [],
        topicEvalAuthority: [],
        currentTopicCatalogVersion: "forged",
        realityFacts: [],
        constraints: [],
        explicitNaClassifications: [],
      };
      const forged = await buildProductionNaValidationContextFromSession(session, forgedOpts);
      assert.deepEqual(forged, clean);
      assert.strictEqual(forged.dirCatalog, clean.dirCatalog);
      assert.strictEqual(forged.dirCatalog, activeEntries());
      assert.strictEqual(forged.confirmationEvents, session.confirmation_events);
    });

    await check("A6 missing / superseded DC or missing session_id 闂?throw (no context)", async () => {
      await assert.rejects(async () => {
        await buildProductionNaValidationContextFromSession({ ...session, decision_context: null });
      });
      await assert.rejects(async () => {
        await buildProductionNaValidationContextFromSession({
          ...session,
          decision_context: { ...dc, status: "superseded" },
        });
      });
      await assert.rejects(async () => {
        await buildProductionNaValidationContextFromSession({ ...session, session_id: "  " });
      });
    });
  }

  // ======================================================== B. Freeze anti-forge
  console.log("\n== B. Freeze anti-forge (freezeDraftForDelivery) ==");
  {
    await check("B0 precondition: Session triad + ACTIVE pair 闂?Freeze n_a", async () => {
      const c = userCase("b0");
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), { session: c.session, now: NOW });
      assert.equal(pack.frozen.status, "final");
      assert.equal(stateOf(pack.frozen.dirs), "n_a");
    });

    await check("B1 forged dirCatalog (+ forged naValidation) 闂?not n_a (direct cause: na_condition_not_in_catalog)", async () => {
      const c = userCase("b1", { code: NON_ACTIVE_CODE });
      const forgedCatalog = [{ dir_id: TARGET_DIR, na_conditions: [NON_ACTIVE_CODE] }];
      // Precondition: same triad + forged catalog on the fixture path 闂?n_a.
      const forgedCtx = c.fixture({ dirCatalog: forgedCatalog });
      assert.equal(reasonOf(c.triad.evidence, forgedCtx), "ok");
      assert.equal(c.pureState(forgedCtx), "n_a");
      const opts = {
        session: c.session,
        now: NOW,
        authority: { dirCatalog: forgedCatalog },
        dirCatalog: forgedCatalog,
        naValidation: forgedCtx,
      };
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), opts);
      assert.notEqual(stateOf(pack.frozen.dirs), "n_a");
      const prod = await buildProductionNaValidationContextFromSession(c.session, { nowIso: NOW });
      assert.equal(reasonOf(c.triad.evidence, prod), "na_condition_not_in_catalog");
    });

    await check("B2 forged topicRules 闂?not n_a (direct cause: topic_rule_missing)", async () => {
      const t = topicFixtures("b2");
      const c = systemCase(
        "b2",
        { kind: "topic_not_applicable", topic_code: t.topicCode, rule_id: t.ruleId },
        { topic_applicability_evals: [t.evalRow], topic_catalog_version: t.catalogVersion },
      );
      const prod = await buildProductionNaValidationContextFromSession(c.session, { nowIso: NOW });
      // Precondition: production ctx (Session eval/version, ACTIVE) + rule 闂?ok / n_a.
      const withRule = { ...prod, topicRules: [t.rule] };
      assert.equal(reasonOf(c.evidence, withRule), "ok");
      assert.equal(c.pureState(withRule), "n_a");
      const opts = {
        session: c.session,
        now: NOW,
        authority: { topicRules: [t.rule] },
        topicRules: [t.rule],
      };
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), opts);
      assert.notEqual(stateOf(pack.frozen.dirs), "n_a");
      assert.equal(reasonOf(c.evidence, prod), "topic_rule_missing");
    });

    await check("B3 forged catalogConditionEvals 闂?not n_a (direct cause: catalog_eval_missing)", async () => {
      const evalRow = {
        condition_eval_id: "ce_b3",
        target_dir_id: TARGET_DIR,
        na_condition_code: SSOT_CODE,
        condition_met: true,
      };
      const c = systemCase("b3", {
        kind: "catalog_na_condition_met",
        target_dir_id: TARGET_DIR,
        condition_eval_id: "ce_b3",
      });
      const prod = await buildProductionNaValidationContextFromSession(c.session, { nowIso: NOW });
      // Precondition: production ctx + the condition eval 闂?ok / n_a.
      const withEval = { ...prod, catalogConditionEvals: [evalRow] };
      assert.equal(reasonOf(c.evidence, withEval), "ok");
      assert.equal(c.pureState(withEval), "n_a");
      const opts = {
        session: c.session,
        now: NOW,
        authority: { catalogConditionEvals: [evalRow] },
        catalogConditionEvals: [evalRow],
      };
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), opts);
      assert.notEqual(stateOf(pack.frozen.dirs), "n_a");
      assert.equal(reasonOf(c.evidence, prod), "catalog_eval_missing");
    });

    await check("B4 forged cfpSourceState=source_absent_not_supplied 闂?Freeze ctx unset; DDR-03 reject (direct cause: ddr03_cfp_not_absent)", async () => {
      const c = userCase("b4");
      const ddrEv: ExplicitNaEvidence = {
        evidence_id: "na_ddr03_b4",
        target: "ddr",
        ddr_id: "DDR-03-CHART-APPENDIX",
        na_condition_code: "chart_not_supplied",
        evidence_type: "system_na_marker",
        system_basis: {
          kind: "empty_dir_source_absence",
          ddr_id: "DDR-03-CHART-APPENDIX",
          source_code: "cfp.birth",
          source_state: "source_absent_not_supplied",
          eval_id: "cfp_eval_b4",
        },
        written_by: "code",
        revoked: false,
      };
      const forgedCtxOpts = {
        now: NOW,
        authority: { cfpSourceState: "source_absent_not_supplied" as const },
        cfpSourceState: "source_absent_not_supplied" as const,
      };
      const freezeCtx = await buildFreezeNaValidationFromSession(
        c.session,
        c.session.decision_context!,
        forgedCtxOpts,
      );
      assert.equal(freezeCtx.cfpSourceState, undefined);
      // Precondition: same ctx with the forged CFP state 闂?accept.
      assert.equal(
        reasonOf(ddrEv, { ...freezeCtx, cfpSourceState: "source_absent_not_supplied" }),
        "ok",
      );
      assert.equal(reasonOf(ddrEv, freezeCtx), "ddr03_cfp_not_absent");
      const clean = await freezeDraftForDelivery(structuredClone(c.dc), { session: c.session, now: NOW });
      const forged = await freezeDraftForDelivery(structuredClone(c.dc), {
        session: c.session,
        ...forgedCtxOpts,
      });
      assert.deepEqual(forged.frozen, clean.frozen);
    });

    await check("B5 forged confirmationEvents 闂?not n_a (direct cause: e1_missing)", async () => {
      const c = userCase("b5", { withSessionE1: false });
      const prod = await buildProductionNaValidationContextFromSession(c.session, { nowIso: NOW });
      assert.equal(reasonOf(c.triad.evidence, { ...prod, confirmationEvents: [c.e1] }), "ok");
      const opts = {
        session: c.session,
        now: NOW,
        authority: { confirmationEvents: [c.e1] },
        confirmationEvents: [c.e1],
      };
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), opts);
      assert.notEqual(stateOf(pack.frozen.dirs), "n_a");
      assert.equal(reasonOf(c.triad.evidence, prod), "e1_missing");
    });

    await check("B6 forged naDeclarationActions 闂?not n_a (direct cause: explicit_na_classification_missing)", async () => {
      const c = userCase("b6", { withSessionAction: false });
      const prod = await buildProductionNaValidationContextFromSession(c.session, { nowIso: NOW });
      assert.equal(
        reasonOf(c.triad.evidence, { ...prod, naDeclarationActions: [c.triad.action] }),
        "ok",
      );
      const opts = {
        session: c.session,
        now: NOW,
        authority: { naDeclarationActions: [c.triad.action] },
        naDeclarationActions: [c.triad.action],
      };
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), opts);
      assert.notEqual(stateOf(pack.frozen.dirs), "n_a");
      assert.equal(reasonOf(c.triad.evidence, prod), "explicit_na_classification_missing");
    });

    await check("B7 forged topic evals/version 闂?Freeze ctx authority = Session; with rule still rejects (topic_eval_id_unknown)", async () => {
      const t = topicFixtures("b7");
      const c = systemCase(
        "b7",
        { kind: "topic_not_applicable", topic_code: t.topicCode, rule_id: t.ruleId },
        { topic_applicability_evals: [], topic_catalog_version: t.catalogVersion },
      );
      const forgedCtxOpts = {
        now: NOW,
        authority: { topicEvalAuthority: [t.evalRow], currentTopicCatalogVersion: t.catalogVersion },
        topicEvalAuthority: [t.evalRow],
      };
      const freezeCtx = await buildFreezeNaValidationFromSession(
        c.session,
        c.session.decision_context!,
        forgedCtxOpts,
      );
      assert.strictEqual(freezeCtx.topicEvalAuthority, c.session.topic_applicability_evals);
      assert.deepEqual(freezeCtx.topicEvalAuthority, []);
      // Precondition: rule + the forged row (if it were trusted) 闂?ok.
      assert.equal(
        reasonOf(c.evidence, { ...freezeCtx, topicRules: [t.rule], topicEvalAuthority: [t.evalRow] }),
        "ok",
      );
      assert.equal(
        reasonOf(c.evidence, { ...freezeCtx, topicRules: [t.rule] }),
        "topic_eval_id_unknown",
      );
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), { session: c.session, ...forgedCtxOpts });
      assert.notEqual(stateOf(pack.frozen.dirs), "n_a");
    });

    await check("B8 C23/DC-8 mirror: DIR-A + explicit_not_applicable full Session triad + forged catalog 闂?not n_a (direct cause: na_condition_not_in_catalog)", async () => {
      const forgeDir = "DIR-A";
      const c = userCase("b8", { dirId: forgeDir, code: NON_ACTIVE_CODE });
      assert.equal(activeEntries().some((e) => e.dir_id === forgeDir), false);
      const forgedCatalog = [{ dir_id: forgeDir, na_conditions: [NON_ACTIVE_CODE] }];
      // Precondition: identical Session triad + E1; trusted forged catalog 闂?n_a.
      const forgedCtx = c.fixture({ dirCatalog: forgedCatalog });
      assert.equal(reasonOf(c.triad.evidence, forgedCtx), "ok");
      assert.equal(c.pureState(forgedCtx), "n_a");
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), {
        session: c.session,
        now: NOW,
        ...{ authority: { dirCatalog: forgedCatalog } },
      });
      assert.equal(pack.frozen.status, "final");
      assert.equal(stateOf(pack.frozen.dirs, forgeDir), "known");
      const prod = await buildProductionNaValidationContextFromSession(c.session, { nowIso: NOW });
      assert.equal(reasonOf(c.triad.evidence, prod), "na_condition_not_in_catalog");
    });
  }

  // ======================================================== C. Versioning anti-forge
  console.log("\n== C. Versioning anti-forge (applyV2FromFinalToSession) ==");
  {
    async function finalSessionFor(c: ReturnType<typeof userCase>, sessionPatch: Partial<POJUSessionState> = {}) {
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), { session: c.session, now: NOW });
      return {
        pack,
        session: {
          ...c.session,
          decision_context: pack.frozen,
          decision_context_versions: [pack.version_snapshot],
          ...sessionPatch,
        } as POJUSessionState,
      };
    }

    await check("C0 precondition: V1 n_a 闂?V2 draft keeps n_a via ACTIVE catalog; V1 hash stable", async () => {
      const c = userCase("c0");
      const { pack, session } = await finalSessionFor(c);
      assert.equal(stateOf(pack.frozen.dirs), "n_a");
      const v2 = await applyV2FromFinalToSession(session, { now: NOW });
      assert.equal(v2.draft.status, "draft");
      assert.equal(stateOf(v2.draft.dirs), "n_a");
      assert.equal(v2.superseded.content_hash, pack.frozen.content_hash);
    });

    await check("C1 Session action removed + forged action/naValidation 闂?V2 not n_a (direct cause: explicit_na_classification_missing)", async () => {
      const c = userCase("c1");
      const { session } = await finalSessionFor(c, { na_declaration_actions: [] });
      const forgedCtx = naValidationBoundToDc(session.decision_context!, session.session_id, {
        nowIso: NOW,
        confirmationEvents: [c.e1],
        naDeclarationActions: [c.triad.action],
        dirCatalog: activeEntries(),
      });
      // Precondition: forged ctx (only the Action differs from Session) 闂?ok.
      assert.equal(reasonOf(c.triad.evidence, forgedCtx), "ok");
      const opts = {
        now: NOW,
        authority: { naDeclarationActions: [c.triad.action] },
        naValidation: forgedCtx,
      };
      const v2 = await applyV2FromFinalToSession(session, opts);
      assert.notEqual(stateOf(v2.draft.dirs), "n_a");
      const prod = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
      assert.equal(reasonOf(c.triad.evidence, prod), "explicit_na_classification_missing");
    });

    await check("C2 forged dirCatalog 闂?V2 not n_a (direct cause: na_condition_not_in_catalog)", async () => {
      const c = userCase("c2", { code: NON_ACTIVE_CODE });
      const { session } = await finalSessionFor(c);
      const forgedCatalog = [{ dir_id: TARGET_DIR, na_conditions: [NON_ACTIVE_CODE] }];
      const prod = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
      assert.equal(reasonOf(c.triad.evidence, { ...prod, dirCatalog: forgedCatalog }), "ok");
      const opts = { now: NOW, authority: { dirCatalog: forgedCatalog }, dirCatalog: forgedCatalog };
      const v2 = await applyV2FromFinalToSession(session, opts);
      assert.notEqual(stateOf(v2.draft.dirs), "n_a");
      assert.equal(reasonOf(c.triad.evidence, prod), "na_condition_not_in_catalog");
    });
  }

  // ======================================================== D. Lifecycle anti-forge
  console.log("\n== D. Lifecycle anti-forge (reaggregateDirsOnSession / collecting) ==");
  {
    await check("D0 S7 semantic: collecting reaggregation applies valid Session N/A (ACTIVE) 闂?n_a", async () => {
      const c = userCase("d0");
      assert.equal(stateOf(c.dc.dirs), "known");
      const r = await applyCollectingUserTurnToSessionDc(c.session, {
        statement: "Another note from the user.",
        source_turn_id: "u_d0",
        now: NOW,
      });
      assert.equal(r.applied, true);
      assert.equal(stateOf(r.session.decision_context!.dirs), "n_a");
    });

    await check("D1 forged authority on reaggregate opts 闂?not n_a (direct cause: explicit_na_classification_missing)", async () => {
      const c = userCase("d1", { withSessionAction: false });
      const forgedCtx = c.fixture();
      assert.equal(reasonOf(c.triad.evidence, forgedCtx), "ok");
      assert.equal(c.pureState(forgedCtx), "n_a");
      const opts = {
        nowIso: NOW,
        authority: {
          naDeclarationActions: [c.triad.action],
          confirmationEvents: [c.e1],
          dirCatalog: activeEntries(),
        },
        naDeclarationActions: [c.triad.action],
        naValidation: forgedCtx,
      };
      const dirs = await reaggregateDirsOnSession(c.session, c.dc.dirs, opts);
      assert.notEqual(stateOf(dirs), "n_a");
      const prod = await buildProductionNaValidationContextFromSession(c.session, { nowIso: NOW });
      assert.equal(reasonOf(c.triad.evidence, prod), "explicit_na_classification_missing");
    });

    await check("D2 in-flight (unpersisted) fact used by production reaggregation 闂?n_a", async () => {
      const c = userCase("d2");
      const dcWithoutFact = { ...c.dc, reality_facts: [] };
      const session = { ...c.session, decision_context: dcWithoutFact };
      // Contrast: Session DC alone lacks the source fact.
      const noInflight = await reaggregateDirsOnSession(session, c.dc.dirs, { nowIso: NOW });
      assert.notEqual(stateOf(noInflight), "n_a");
      assert.equal(
        reasonOf(
          c.triad.evidence,
          await buildProductionNaValidationContextFromSession(session, { nowIso: NOW }),
        ),
        "source_missing",
      );
      const inflight = await reaggregateDirsOnSession(session, c.dc.dirs, {
        realityFacts: [c.fact],
        nowIso: NOW,
      });
      assert.equal(stateOf(inflight), "n_a");
    });

    await check("D3 in-flight snapshot cannot override Session authority (direct cause: explicit_na_classification_missing)", async () => {
      const c = userCase("d3", { withSessionAction: false });
      const dcWithoutFact = { ...c.dc, reality_facts: [] };
      const session = { ...c.session, decision_context: dcWithoutFact };
      const forged = {
        realityFacts: [c.fact],
        nowIso: NOW,
        authority: { naDeclarationActions: [c.triad.action] },
        naDeclarationActions: [c.triad.action],
      };
      const dirs = await reaggregateDirsOnSession(session, c.dc.dirs, forged);
      assert.notEqual(stateOf(dirs), "n_a");

      const base = await buildProductionNaValidationContextFromSession(session, { nowIso: NOW });
      const inflightDc = { ...dcWithoutFact, reality_facts: [c.fact] };
      const rebound = naValidationForDcSnapshot(base, inflightDc);
      assert.strictEqual(rebound.realityFacts, inflightDc.reality_facts);
      assert.strictEqual(rebound.confirmationEvents, session.confirmation_events);
      assert.strictEqual(rebound.naDeclarationActions, session.na_declaration_actions);
      assert.strictEqual(rebound.topicEvalAuthority, session.topic_applicability_evals);
      assert.equal(rebound.currentTopicCatalogVersion, base.currentTopicCatalogVersion);
      assert.strictEqual(rebound.dirCatalog, activeEntries());
      assert.ok(Array.isArray(rebound.topicRules) && rebound.topicRules!.length >= 1);
      assert.strictEqual(rebound.topicRules, base.topicRules);
      assert.equal(rebound.catalogConditionEvals, undefined);
      assert.equal(rebound.cfpSourceState, undefined);
      // Precondition: same rebound ctx + Session Action 闂?ok; without it 闂?rejected.
      assert.equal(
        reasonOf(c.triad.evidence, { ...rebound, naDeclarationActions: [c.triad.action] }),
        "ok",
      );
      assert.equal(reasonOf(c.triad.evidence, rebound), "explicit_na_classification_missing");
    });
  }

  // ======================================================== E. Ask anti-forge
  console.log("\n== E. Ask anti-forge (selectNextIntakeAskForSession) ==");
  {
    // TARGET stored unknown with a non-role source fact: only a valid N/A can
    // resolve its role, so naValidation visibly changes the score.
    function askCase(tag: string, withSessionAction: boolean) {
      const sessId = `sess_s7_${tag}`;
      const ctxId = `dc_s7_${tag}`;
      const factId = `fact_s7_${tag}`;
      const triad = userTriad({ sessId, ctxId, factId, tag });
      const fact = factFor(factId, tag, ["na_source_note"]);
      const e1 = e1For(factId, tag);
      const otherDir = { ...targetDir("unknown"), dir_id: "DIR-STATUS-QUO", may_affect_p5_ranking: false as const };
      const dc = makeDc(ctxId, {
        reality_facts: [fact],
        dirs: [targetDir("unknown"), otherDir],
        explicit_na_classifications: [triad.classification],
        explicit_na_evidence: [triad.evidence],
      });
      const session = sessionOf(sessId, dc, {
        confirmation_events: [e1],
        na_declaration_actions: withSessionAction ? [triad.action] : [],
      });
      return { sessId, triad, e1, dc, session };
    }

    await check("E0 production ask == planNextAskFromCandidates(production ctx); ranking/budget unchanged", async () => {
      const a = askCase("e0", false);
      const planned = await selectNextIntakeAskForSession({
        session: a.session,
        nowIso: NOW,
        remaining_hard_budget: 7,
      });
      const direct = planNextAskFromCandidates({
        candidates: buildIntakeCandidatesFromDc(a.dc),
        snap: snapshotFromDc(a.dc),
        naValidation: await buildProductionNaValidationContextFromSession(a.session, { nowIso: NOW }),
        remaining_hard_budget: 7,
      });
      assert.deepEqual(planned.plan, direct);
      assert.ok(planned.plan.ranked.some((r) => r.candidate.candidate_id === `cq_dir_${TARGET_DIR}`));
    });

    await check("E1 forged input.naValidation ignored; low-level planner injection still effective", async () => {
      const a = askCase("e1", false);
      const forgedCtx = naValidationBoundToDc(a.dc, a.sessId, {
        nowIso: NOW,
        confirmationEvents: [a.e1],
        naDeclarationActions: [a.triad.action],
        dirCatalog: activeEntries(),
      });
      const prodCtx = await buildProductionNaValidationContextFromSession(a.session, { nowIso: NOW });
      const candidates = buildIntakeCandidatesFromDc(a.dc);
      const snap = snapshotFromDc(a.dc);
      const lowForged = planNextAskFromCandidates({ candidates, snap, naValidation: forgedCtx, remaining_hard_budget: 15 });
      const lowProd = planNextAskFromCandidates({ candidates, snap, naValidation: prodCtx, remaining_hard_budget: 15 });
      const unresolved = (p: typeof lowProd) =>
        p.ranked.find((r) => r.candidate.candidate_id === `cq_dir_${TARGET_DIR}`)?.score.unresolved_count;
      // Precondition: injected ctx changes the low-level score (injection works).
      assert.notEqual(unresolved(lowForged), unresolved(lowProd));

      const input = { session: a.session, nowIso: NOW, naValidation: forgedCtx };
      const planned = await selectNextIntakeAskForSession(input);
      const clean = await selectNextIntakeAskForSession({ session: a.session, nowIso: NOW });
      assert.deepEqual(planned.plan, clean.plan);
      assert.deepEqual(planned.plan, lowProd);
      assert.equal(unresolved(planned.plan), unresolved(lowProd));
    });

    await check("E2 S7 semantic: N/A applied in collecting 闂?DIR no longer an ask candidate", async () => {
      const a = askCase("e2", true);
      const before = await selectNextIntakeAskForSession({ session: a.session, nowIso: NOW });
      assert.ok(before.plan.ranked.some((r) => r.candidate.dir_ids.includes(TARGET_DIR)));
      const collected = await applyCollectingUserTurnToSessionDc(a.session, {
        statement: "Nothing else is off-limits.",
        source_turn_id: "u_e2",
        now: NOW,
      });
      assert.equal(collected.applied, true);
      assert.equal(stateOf(collected.session.decision_context!.dirs), "n_a");
      const after = await selectNextIntakeAskForSession({ session: collected.session, nowIso: NOW });
      assert.equal(after.plan.ranked.some((r) => r.candidate.dir_ids.includes(TARGET_DIR)), false);
    });
  }

  // ======================================================== F. fail-closed
  console.log("\n== F. Fail-closed (ACTIVE loader fault 闁?missing gap sources) ==");
  {
    async function seedIdbSession(tag: string, dc: DecisionContext, extra: Partial<POJUSessionState>) {
      const sid = await createPOJUSession({
        payment_id: `pay_s7_${tag}`,
        original_question: `s7 ${tag}`,
      });
      await mutatePOJUSession(sid, {
        operation_id: `op_seed_s7_${tag}`,
        kind: "session_patch",
        bump_dc: true,
        apply: (latest) => ({
          ...latest,
          agent_v2: latest.agent_v2
            ? { ...latest.agent_v2, stall_offer_pending: false, delivery_mode: "full" as const }
            : latest.agent_v2,
          control_plane: createDefaultControlPlane("collecting_context"),
          decision_context: { ...dc, context_id: `dc_${sid}` },
          ...extra,
        }),
      });
      return sid;
    }

    function idbCase(tag: string) {
      const c = userCase(tag);
      return c;
    }

    async function seededUserSession(tag: string) {
      const c = idbCase(tag);
      const sid = await seedIdbSession(tag, c.dc, {});
      // Rebind triad ids to the IDB session/context.
      await mutatePOJUSession(sid, {
        operation_id: `op_triad_s7_${tag}`,
        kind: "session_patch",
        bump_dc: true,
        apply: (latest) => {
          const ctxId = latest.decision_context!.context_id;
          const triad = userTriad({ sessId: sid, ctxId, factId: c.factId, tag });
          return {
            ...latest,
            confirmation_events: [c.e1],
            na_declaration_actions: [triad.action],
            decision_context: {
              ...latest.decision_context!,
              explicit_na_classifications: [triad.classification],
              explicit_na_evidence: [triad.evidence],
            },
          };
        },
      });
      return sid;
    }

    await check("F0 injector hits the real production registry (loadDirNaCatalog ? dir_catalog_load_failed); restored after", async () => {
      await withActiveCatalogFault(async () => {
        const r = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION);
        assert.equal(r.ok, false);
        if (!r.ok) assert.equal(r.reason_code, "dir_catalog_load_failed");
        await assert.rejects(
          () => buildProductionNaValidationContextFromSession(userCase("f0").session),
          (e: unknown) =>
            e instanceof ProductionNaAuthorityError &&
            e.reason_code === "dir_catalog_load_failed",
        );
      });
      assert.equal(loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION).ok, true);
    });

    await check("F1 Freeze: FreezeError(code=dir_catalog_load_failed); wire reason_code; IDB DC stays draft", async () => {
      const c = userCase("f1");
      await withActiveCatalogFault(async () => {
        await assert.rejects(
          () => freezeDraftForDelivery(structuredClone(c.dc), { session: c.session, now: NOW }),
          (e: unknown) =>
            e instanceof FreezeError &&
            e.code === "dir_catalog_load_failed" &&
            e.message === "dir_catalog_load_failed",
        );
      });
      // Precondition twin: no fault 闂?ensure freezes + persists.
      const sidOk = await seededUserSession("f1ok");
      const okRes = await ensureSessionFrozenForDelivery((await loadPOJUSession(sidOk))!, { now: NOW });
      assert.equal(okRes.ok, true);
      assert.equal((await loadPOJUSession(sidOk))!.decision_context?.status, "final");

      const sid = await seededUserSession("f1fault");
      const before = (await loadPOJUSession(sid))!;
      const res = await withActiveCatalogFault(() =>
        ensureSessionFrozenForDelivery(before, { now: NOW }),
      );
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.reason_code, "dir_catalog_load_failed");
      const after = (await loadPOJUSession(sid))!;
      assert.equal(after.decision_context?.status, "draft");
      assert.deepEqual(after.decision_context, before.decision_context);
    });

    await check("F2 Versioning: apply throws; persistV2 ok:false (dir_catalog_load_failed), no V2", async () => {
      const c = userCase("f2");
      const pack = await freezeDraftForDelivery(structuredClone(c.dc), { session: c.session, now: NOW });
      const session = { ...c.session, decision_context: pack.frozen, decision_context_versions: [pack.version_snapshot] };
      await withActiveCatalogFault(async () => {
        await assert.rejects(
          () => applyV2FromFinalToSession(session, { now: NOW }),
          (e: unknown) => e instanceof ProductionNaAuthorityError,
        );
        const r = await persistV2FromFinalOnSession(session, { now: NOW });
        assert.equal(r.ok, false);
        if (!r.ok) {
          assert.equal(r.reason, "dir_catalog_load_failed");
          assert.strictEqual(r.session, session);
        }
      });
    });

    await check("F3 Lifecycle: reaggregate throws; Call B 闂?dir_map_error, dirs not re-aggregated, IDB unchanged", async () => {
      const c = userCase("f3");
      await withActiveCatalogFault(async () => {
        await assert.rejects(
          () => reaggregateDirsOnSession(c.session, c.dc.dirs, { nowIso: NOW }),
          (e: unknown) => e instanceof ProductionNaAuthorityError,
        );
      });
      const agenda = [
        {
          id: "ag_f3",
          label: "Hard red lines",
          critical: true,
          status: "covered" as const,
          collection_goal: "Know red lines",
          role: "fill" as const,
          serves_page: "05",
          frame_kind: "modern_action" as const,
          frame_index: 1,
        },
      ];
      // Precondition: no fault 闂?Call B applies.
      assert.equal((await applyCallBToSessionDc(c.session, agenda, { now: NOW })).applied, true);
      const pure = await withActiveCatalogFault(async () =>
        applyCallBToSessionDc(c.session, agenda, { now: NOW }),
      );
      assert.equal(pure.applied, false);
      assert.equal(pure.skipped_reason, "dir_map_error");
      assert.deepEqual(pure.session.decision_context, c.session.decision_context);

      const sid = await seededUserSession("f3idb");
      const before = (await loadPOJUSession(sid))!;
      const persisted = await withActiveCatalogFault(() =>
        persistCallBDcOnSession(before, agenda, { now: NOW }),
      );
      assert.equal(persisted.applied, false);
      assert.equal(persisted.error, "dir_map_error");
      const after = (await loadPOJUSession(sid))!;
      assert.deepEqual(after.decision_context, before.decision_context);
      assert.deepEqual(after.control_plane, before.control_plane);
    });

    await check("F4 Collecting: persistCollectingUserTurnDc rejects; IDB DC update discarded (no partial persist)", async () => {
      // Precondition twin: no fault 闂?collecting fact committed.
      const sidOk = await seededUserSession("f4ok");
      const okRes = await persistCollectingUserTurnDc((await loadPOJUSession(sidOk))!, {
        statement: "Savings cover four months.",
        source_turn_id: "u_f4ok",
        now: NOW,
      });
      assert.equal(okRes.applied, true);
      const okAfter = (await loadPOJUSession(sidOk))!;
      assert.ok(okAfter.decision_context!.reality_facts.some((f) => f.source_turn_id === "u_f4ok"));

      const sid = await seededUserSession("f4fault");
      const before = (await loadPOJUSession(sid))!;
      await withActiveCatalogFault(async () => {
        await assert.rejects(
          () =>
            persistCollectingUserTurnDc(before, {
              statement: "Savings cover four months.",
              source_turn_id: "u_f4fault",
              now: NOW,
            }),
          (e: unknown) => e instanceof ProductionNaAuthorityError,
        );
      });
      const after = (await loadPOJUSession(sid))!;
      assert.deepEqual(after.decision_context, before.decision_context);
      assert.equal(
        after.decision_context!.reality_facts.some((f) => f.source_turn_id === "u_f4fault"),
        false,
      );
      assert.equal(after.messages.length, before.messages.length);
    });

    await check("F5 Ask: loader fault 闂?throws, no plan / no fallback", async () => {
      const c = userCase("f5");
      await withActiveCatalogFault(async () => {
        await assert.rejects(
          () => selectNextIntakeAskForSession({ session: c.session, nowIso: NOW }),
          (e: unknown) => e instanceof ProductionNaAuthorityError,
        );
      });
    });

    await check("F6 gap sources missing 闂?fail-closed (topic_rule_missing / catalog_eval_missing / ddr03_cfp_not_absent; see B2闂備胶鍋ㄩ崕鎻掝嚕?)", async () => {
      const t = topicFixtures("f6");
      const topic = systemCase(
        "f6t",
        { kind: "topic_not_applicable", topic_code: t.topicCode, rule_id: t.ruleId },
        { topic_applicability_evals: [t.evalRow], topic_catalog_version: t.catalogVersion },
      );
      const cat = systemCase("f6c", {
        kind: "catalog_na_condition_met",
        target_dir_id: TARGET_DIR,
        condition_eval_id: "ce_f6",
      });
      assert.equal(
        stateOf(await reaggregateDirsOnSession(topic.session, topic.dc.dirs, { nowIso: NOW })) === "n_a",
        false,
      );
      assert.equal(
        reasonOf(topic.evidence, await buildProductionNaValidationContextFromSession(topic.session)),
        "topic_rule_missing",
      );
      assert.equal(
        stateOf(await reaggregateDirsOnSession(cat.session, cat.dc.dirs, { nowIso: NOW })) === "n_a",
        false,
      );
      assert.equal(
        reasonOf(cat.evidence, await buildProductionNaValidationContextFromSession(cat.session)),
        "catalog_eval_missing",
      );
    });
  }

  // ======================================================== S. static boundary
  console.log("\n== S. Static boundary (production sources) ==");
  {
    const read = (p: string) => readFileSync(join(REPO, p), "utf8");
    const NA_FILE = "lib/poju/decision-context/na-validation-from-session.ts";
    const PROD_FILES = [
      "lib/poju/decision-context/freeze-to-delivery.ts",
      "lib/poju/decision-context/production-versioning.ts",
      "lib/poju/decision-context/production-intake-ask.ts",
      "lib/poju/decision-context/production-dc-lifecycle.ts",
      "lib/poju/decision-context/production-freeze-wire.ts",
      "lib/poju/decision-context/freeze.ts",
      "lib/poju/decision-context/versioning.ts",
    ];
    const FIXTURE_IDENT =
      /\bnaValidationBoundToDc\b|\bNaValidationFixtureOverrides\b|\bNaValidationAuthorityOverrides\b|\bbuildNaValidationContextFromSession\b/;

    function walk(dir: string, out: string[]) {
      for (const name of readdirSync(join(REPO, dir))) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const rel = join(dir, name);
        const st = statSync(join(REPO, rel));
        if (st.isDirectory()) walk(rel, out);
        else if (/\.(ts|tsx)$/.test(name)) out.push(rel.split(sep).join("/"));
      }
    }

    /** Slice from `marker` to the next top-level `export` / EOF. */
    function block(src: string, marker: string): string {
      const i = src.indexOf(marker);
      assert.ok(i >= 0, `marker not found: ${marker}`);
      const next = src.indexOf("\nexport ", i + marker.length);
      return src.slice(i, next < 0 ? undefined : next);
    }

    await check("S1 no lib/ or app/ module (except fixture definition file) references fixture builder/types (incl. alias / re-export)", async () => {
      const files: string[] = [];
      walk("lib", files);
      walk("app", files);
      const offenders = files
        .filter((f) => f !== NA_FILE)
        .filter((f) => FIXTURE_IDENT.test(read(f)));
      assert.deepEqual(offenders, []);
    });

    await check("S2 removed names gone: buildNaValidationContextFromSession / NaValidationAuthorityOverrides", async () => {
      const src = read(NA_FILE);
      assert.equal(/\bbuildNaValidationContextFromSession\b/.test(src), false);
      assert.equal(/\bNaValidationAuthorityOverrides\b/.test(src), false);
      const scripts: string[] = [];
      walk("scripts", scripts);
      const SELF = "scripts/test-intake-r6-production-authority-boundary.ts";
      const stale = scripts
        .filter((f) => f !== SELF)
        .filter((f) => /\bbuildNaValidationContextFromSession\b/.test(read(f)));
      assert.deepEqual(stale, []);
    });

    await check("S3 production builder / reaggregate / snapshot bodies do not touch fixture path or env", async () => {
      const src = read(NA_FILE);
      for (const marker of [
        "export async function buildProductionNaValidationContextFromSession",
        "export function naValidationForDcSnapshot",
        "export async function reaggregateDirsOnSession",
        "export type ProductionNaValidationBuildOpts",
        "export type ReaggregateDirsOnSessionOpts",
      ]) {
        const b = block(src, marker);
        assert.equal(FIXTURE_IDENT.test(b), false, marker);
        assert.equal(/overrides|authority\??:|process\.env/.test(b), false, marker);
      }
      assert.ok(
        block(src, "export async function reaggregateDirsOnSession").includes(
          "await buildProductionNaValidationContextFromSession(",
        ),
      );
      assert.equal(/process\.env/.test(src), false);

    });

    await check("S4 production entry types expose no authority / naValidation injection", async () => {
      const freeze = read("lib/poju/decision-context/freeze-to-delivery.ts");
      const freezeOpts = block(freeze, "export type FreezeDraftForDeliveryOpts");
      assert.equal(/authority\??:/.test(freezeOpts), false);
      assert.ok(/"naValidation"/.test(freezeOpts), "FreezeOptions.naValidation must stay omitted");
      assert.equal(/authority\??:/.test(block(freeze, "export async function buildFreezeNaValidationFromSession")), false);

      const ver = read("lib/poju/decision-context/production-versioning.ts");
      const verOpts = block(ver, "export type StartV2OnSessionOpts");
      assert.equal(/authority\??:/.test(verOpts), false);
      assert.ok(/"naValidation"/.test(verOpts));

      const ask = read("lib/poju/decision-context/production-intake-ask.ts");
      const askInput = block(ask, "export type SelectNextIntakeAskInput");
      assert.equal(/naValidation\??:/.test(askInput), false);
      assert.equal(/input\.naValidation/.test(ask), false);
    });

    await check("S5 every production path calls the production builder", async () => {
      const calls = "await buildProductionNaValidationContextFromSession(";
      assert.ok(read("lib/poju/decision-context/freeze-to-delivery.ts").includes(calls));
      assert.ok(read("lib/poju/decision-context/production-versioning.ts").includes(calls));
      assert.ok(read("lib/poju/decision-context/production-intake-ask.ts").includes(calls));
      const life = read("lib/poju/decision-context/production-dc-lifecycle.ts");
      assert.ok(life.includes("await reaggregateDirsOnSession("));
      assert.equal(/authority\s*:/.test(life), false);
      for (const f of PROD_FILES) {
        assert.equal(FIXTURE_IDENT.test(read(f)), false, f);
      }
    });
  }

  console.log(`\nS7 production-authority-boundary done. PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
