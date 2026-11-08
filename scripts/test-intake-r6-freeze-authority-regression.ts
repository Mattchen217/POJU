/**
 * S5 闁?R6 Freeze Authority Regression (F1闁炽儲寮?), isolated.
 *   pnpm test:intake-r6-freeze-authority-regression
 *
 * Fixtures use production ACTIVE Catalog pair only:
 *   DIR-DEF-UNACCEPTABLE + explicit_no_hard_red_lines
 * S7: production Freeze accepts no caller authority. topicRules come from ACTIVE SSOT (S9); forged caller rules still
 * source (Authority Gap), so topic N/A is checked in two layers:
 *   *-Pure        fixture path (naValidationBoundToDc + reaggregateDirsIntake)
 *   *-Production  freezeDraftForDelivery / production builder (source + isolation)
 */
import assert from "node:assert/strict";
import {
  ACTIVE_DIR_NA_CATALOG_VERSION,
  buildFreezeNaValidationFromSession,
  buildProductionNaValidationContextFromSession,
  freezeDraftForDelivery,
  loadDirNaCatalog,
  reaggregateDirsIntake,
  validateExplicitNaEvidence,
} from "../lib/poju/decision-context";
import { naValidationBoundToDc } from "../lib/poju/decision-context/na-validation-from-session";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import type { ConfirmationEvent } from "../lib/poju/decision-context/confirmation-event";
import type { POJUSessionState } from "../lib/poju/types";
import type { AuthoritativeTopicEvalRecord } from "../lib/poju/decision-context/topic-eval-authority";

const NOW = "2026-11-05T16:00:00.000Z";
const TOPIC_EXPIRY = "2027-06-01T00:00:00.000Z";
/** Production ACTIVE Catalog legal pair (S0 v1). */
const TARGET_DIR = "DIR-DEF-UNACCEPTABLE";
const SSOT_CODE = "explicit_no_hard_red_lines";

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function fail(label: string, e: unknown) {
  failed += 1;
  console.error(`  FAIL  ${label}`);
  console.error(e);
}

function check(label: string, fn: () => void) {
  try {
    fn();
    pass(label);
  } catch (e) {
    fail(label, e);
  }
}

function reasonOf(
  ev: Parameters<typeof validateExplicitNaEvidence>[0],
  ctx: Parameters<typeof validateExplicitNaEvidence>[1],
): string {
  const r = validateExplicitNaEvidence(ev, ctx);
  return r.ok ? "ok" : r.reason_code;
}

function activeCatalogEntries() {
  const load = loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION);
  if (!load.ok) throw new Error(`ACTIVE catalog unavailable: ${load.reason_code}`);
  return load.entries;
}

function dirState(pack: { frozen: DecisionContext }, dirId: string): string | undefined {
  return pack.frozen.dirs.find((d) => d.dir_id === dirId)?.current_state;
}

/**
 * Fresh sufficient draft per case 闁?no shared mutable Action/Classification/Evidence.
 */
function makeSufficientDraft(tag: string) {
  const sessId = `sess_s5_${tag}`;
  const ctxId = `dc_s5_${tag}`;
  const factId = `fact_s5_${tag}`;
  const fact = {
    fact_id: factId,
    statement: "no hard red lines for this decision",
    status: "confirmed" as const,
    verification_level: "user_asserted" as const,
    source_stage: "user_supplement" as const,
    source_turn_id: `t_${tag}`,
    user_confirmed: true,
    fact_roles: ["situation"],
    related_dir_ids: [TARGET_DIR],
  };
  const dir = {
    dir_id: TARGET_DIR,
    need: "need",
    why: "why",
    required_fact_roles: ["situation"],
    current_state: "unknown" as const,
    partial_satisfaction: false,
    agenda_item_ids: [] as string[],
    id_lifecycle: "active" as const,
    may_affect_p5_ranking: false as const,
  };
  const shell: DecisionContext = {
    context_id: ctxId,
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
    created_at: NOW,
    updated_at: NOW,
  };
  const na = naValidationBoundToDc(shell, sessId, { nowIso: NOW });
  const dirs = reaggregateDirsIntake([dir], [fact], [], [], [], na);
  assert.equal(dirs[0]!.current_state, "known");
  const draft: DecisionContext = { ...shell, dirs };
  const e1: ConfirmationEvent = {
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
  return { sessId, ctxId, factId, draft, e1 };
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
    ...extra,
  } as POJUSessionState;
}

function userNaTriad(args: {
  sessId: string;
  ctxId: string;
  factId: string;
  actionId: string;
  turnId: string;
}) {
  const source_ref = {
    kind: "reality_fact" as const,
    fact_id: args.factId,
  };
  const action = {
    declaration_action_id: args.actionId,
    session_id: args.sessId,
    context_id: args.ctxId,
    actor: "user" as const,
    control_id: "na_declare",
    source_ref,
    dir_id: TARGET_DIR,
    na_condition_code: SSOT_CODE,
    declaration_turn_id: args.turnId,
    occurred_at: NOW,
    revoked: false,
    expires_at: null as string | null,
  };
  const classification = {
    classification_id: `na_cls_${args.actionId}`,
    context_id: args.ctxId,
    source_ref,
    dir_id: TARGET_DIR,
    na_condition_code: SSOT_CODE,
    authority: "user_declared" as const,
    written_by: "code" as const,
    declaration_action_id: args.actionId,
    declaration_turn_id: args.turnId,
    revoked: false,
    expires_at: null as string | null,
    created_at: NOW,
  };
  const evidence = {
    evidence_id: `na_ev_${args.actionId}`,
    target: "dir" as const,
    dir_id: TARGET_DIR,
    na_condition_code: SSOT_CODE,
    evidence_type: "user_explicit_na" as const,
    source_ref,
    written_by: "code" as const,
    revoked: false,
  };
  return { action, classification, evidence };
}

async function main() {
  console.log("intake-r6-freeze-authority-regression (S5 F1闁炽儲寮? 鐠?S7 Pure/Production split)");
  console.log(`  ACTIVE fixture pair: ${TARGET_DIR} + ${SSOT_CODE}`);

  // ----- F1 -----
  check("F1 Session N/A + forged caller authority 闁?DIR n_a", async () => {
    const { sessId, ctxId, factId, draft, e1 } = makeSufficientDraft("f1");
    const triad = userNaTriad({
      sessId,
      ctxId,
      factId,
      actionId: "na-act-f1-sess",
      turnId: "turn_f1",
    });
    const dc: DecisionContext = {
      ...structuredClone(draft),
      explicit_na_classifications: [structuredClone(triad.classification)],
      explicit_na_evidence: [structuredClone(triad.evidence)],
    };
    assert.equal(dc.dirs[0]!.current_state, "known");

    const forgedConfirm: ConfirmationEvent[] = [
      {
        event_id: "e1_FORGED_f1",
        target_type: "fact" as const,
        fact_id: "fact_FORGED",
        source_turn_id: "t_forged",
        confirmation_turn_id: "t_forged_b",
        confirmation_action_id: "ca_forged",
        event_type: "confirm_fact" as const,
        actor: "user" as const,
        confirmed_at: NOW,
        event_version: 1,
      },
    ];
    const forgedActions = [
      {
        ...structuredClone(triad.action),
        declaration_action_id: "na-act-FORGED-f1",
        declaration_turn_id: "turn_forged",
      },
    ];

    const sess = sessionOf(sessId, dc, {
      confirmation_events: [structuredClone(e1)],
      na_declaration_actions: [structuredClone(triad.action)],
    });

    // Untyped caller payload: `authority` is not part of FreezeDraftForDeliveryOpts.
    const forgedOpts = {
      session: sess,
      now: NOW,
      authority: {
        confirmationEvents: forgedConfirm,
        naDeclarationActions: forgedActions,
        // Must not override ACTIVE Catalog (production strips this).
        dirCatalog: [
          { dir_id: "DIR-A", na_conditions: ["explicit_not_applicable"] },
        ],
      },
    };
    const pack = await freezeDraftForDelivery(structuredClone(dc), forgedOpts);

    assert.equal(pack.frozen.status, "final");
    assert.equal(
      dirState(pack, TARGET_DIR),
      "n_a",
      "Session action+E1 must authorize N/A; forged caller authority must not win",
    );
  });

  // ----- F2 -----
  check("F2 Session missing action + forged matching action 闁?not n_a", async () => {
    const { sessId, ctxId, factId, draft, e1 } = makeSufficientDraft("f2");
    const triad = userNaTriad({
      sessId,
      ctxId,
      factId,
      actionId: "na-act-f2-would-match",
      turnId: "turn_f2",
    });
    // Classification/Evidence remain 闁?if forged Action were trusted, DIR 闁?n_a.
    const dc: DecisionContext = {
      ...structuredClone(draft),
      explicit_na_classifications: [structuredClone(triad.classification)],
      explicit_na_evidence: [structuredClone(triad.evidence)],
    };

    const sess = sessionOf(sessId, dc, {
      confirmation_events: [structuredClone(e1)],
      na_declaration_actions: [],
    });

    // Untyped caller payload: `authority` is not part of FreezeDraftForDeliveryOpts.
    const forgedOpts = {
      session: sess,
      now: NOW,
      authority: {
        confirmationEvents: [structuredClone(e1)],
        // Fully matching forged Action 闁?sufficient alone if wrongly trusted.
        naDeclarationActions: [structuredClone(triad.action)],
        dirCatalog: [
          { dir_id: TARGET_DIR, na_conditions: [SSOT_CODE] },
        ],
      },
    };
    const pack = await freezeDraftForDelivery(structuredClone(dc), forgedOpts);

    assert.equal(pack.frozen.status, "final");
    assert.notEqual(
      dirState(pack, TARGET_DIR),
      "n_a",
      "forged naDeclarationActions must not authorize Explicit N/A",
    );
    assert.equal(dirState(pack, TARGET_DIR), "known");

    // S7: missing Session Action is the only blocker 闁?production ctx with the
    // Action added (everything else unchanged, ACTIVE catalog) validates.
    const prodCtx = await buildProductionNaValidationContextFromSession(sess, {
      nowIso: NOW,
    });
    assert.equal(
      reasonOf(triad.evidence, prodCtx),
      "explicit_na_classification_missing",
    );
    assert.equal(
      reasonOf(triad.evidence, {
        ...prodCtx,
        naDeclarationActions: [structuredClone(triad.action)],
      }),
      "ok",
    );
  });

  // ----- F3 (S7 split) -----
  // F3-Pure: rule + eval decision logic (fixture path, explicit injection).
  // F3-Production: production authority source + isolation (Freeze entry).
  // A F3-Pure PASS is NOT evidence of Session priority; that is F3-Production-Source.
  {
    const { sessId, draft, e1 } = makeSufficientDraft("f3");
    const ruleId = "rule_s5_f3";
    const topicCode = "topic.s5.f3";
    const evalId = "topic_eval_f3_sess";
    const catalogVersion = "cat_v_f3_sess";

    const topicEvidence = {
      evidence_id: "na_ev_topic_f3",
      target: "dir" as const,
      dir_id: TARGET_DIR,
      // Must be ACTIVE Catalog legal condition for TARGET_DIR.
      na_condition_code: SSOT_CODE,
      evidence_type: "system_na_marker" as const,
      system_basis: {
        kind: "topic_not_applicable" as const,
        topic_code: topicCode,
        rule_id: ruleId,
      },
      written_by: "code" as const,
      revoked: false,
    };
    // Authority Gap: topicRules come from ACTIVE SSOT (S9); forged caller rules still source; only fixtures supply them.
    const topicRule = {
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
    const sessionTopicEval: AuthoritativeTopicEvalRecord = {
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
    const forgedTopicEval: AuthoritativeTopicEvalRecord = {
      eval_id: "topic_eval_f3_FORGED",
      rule_id: ruleId,
      topic_code: topicCode,
      target_dir_id: TARGET_DIR,
      catalog_version: "cat_v_f3_forged",
      not_applicable: true,
      evaluated_at: NOW,
      expires_at: TOPIC_EXPIRY,
      record_status: "current",
    };

    const dc: DecisionContext = {
      ...structuredClone(draft),
      explicit_na_evidence: [structuredClone(topicEvidence)],
      explicit_na_classifications: [],
    };
    const sess = sessionOf(sessId, dc, {
      confirmation_events: [structuredClone(e1)],
      topic_applicability_evals: [structuredClone(sessionTopicEval)],
      topic_catalog_version: catalogVersion,
    });

    const pureNa = (
      authority: AuthoritativeTopicEvalRecord[],
      currentVersion: string,
    ) =>
      naValidationBoundToDc(dc, sessId, {
        nowIso: NOW,
        confirmationEvents: [structuredClone(e1)],
        dirCatalog: activeCatalogEntries(),
        topicRules: [topicRule],
        topicEvalAuthority: authority,
        currentTopicCatalogVersion: currentVersion,
      });
    const pureState = (na: ReturnType<typeof naValidationBoundToDc>) =>
      reaggregateDirsIntake(
        dc.dirs,
        dc.reality_facts,
        dc.conflicts,
        dc.constraints,
        dc.explicit_na_evidence ?? [],
        na,
      ).find((d) => d.dir_id === TARGET_DIR)?.current_state;

    check("F3-Pure rule + matching eval (catalog version current) 闁?DIR n_a", async () => {
      const na = pureNa([structuredClone(sessionTopicEval)], catalogVersion);
      assert.equal(reasonOf(topicEvidence, na), "ok");
      assert.equal(pureState(na), "n_a");
    });

    check(
      "F3-Pure catalog-version-mismatched eval 闁?not n_a (direct cause: topic_catalog_version_stale)", async () => {
        // Precondition: F3-Pure positive 闁?identical rule/evidence/eval 闁?n_a.
        // Only the live topic catalog version differs.
        const na = pureNa([structuredClone(sessionTopicEval)], "cat_v_f3_other");
        assert.equal(reasonOf(topicEvidence, na), "topic_catalog_version_stale");
        assert.notEqual(pureState(na), "n_a");
      },
    );

    check(
      "F3-Production forged topicRules + forged eval/version via Freeze 闁?not n_a (direct cause: topic_rule_missing)", async () => {
        // Non-literal opts: forged fields reach the production call at runtime.
        const forgedFreezeOpts = {
          session: sess,
          now: NOW,
          authority: {
            topicEvalAuthority: [forgedTopicEval],
            currentTopicCatalogVersion: "cat_v_f3_forged",
            dirCatalog: [
              { dir_id: "DIR-A", na_conditions: ["explicit_not_applicable"] },
            ],
            topicRules: [topicRule],
          },
          topicRules: [topicRule],
        };
        const pack = await freezeDraftForDelivery(structuredClone(dc), forgedFreezeOpts);
        assert.equal(pack.frozen.status, "final");
        assert.notEqual(dirState(pack, TARGET_DIR), "n_a");
        assert.equal(dirState(pack, TARGET_DIR), "known");

        const prodCtx = await buildProductionNaValidationContextFromSession(sess, {
          nowIso: NOW,
        });
        assert.ok(Array.isArray(prodCtx.topicRules) && (prodCtx.topicRules as unknown[]).length >= 1);
        assert.equal(reasonOf(topicEvidence, prodCtx), "topic_rule_missing");
        // Only blocker = missing rule source: same production ctx (Session eval,
        // Session version, ACTIVE catalog) + the rule validates.
        assert.equal(
          reasonOf(topicEvidence, { ...prodCtx, topicRules: [topicRule] }),
          "ok",
        );
      },
    );

    check(
      "F3-Production-Source builder + Freeze ctx read topic eval/version only from Session", async () => {
        const forgedBuildOpts = {
          nowIso: NOW,
          topicEvalAuthority: [forgedTopicEval],
          currentTopicCatalogVersion: "cat_v_f3_forged",
          authority: {
            topicEvalAuthority: [forgedTopicEval],
            currentTopicCatalogVersion: "cat_v_f3_forged",
          },
        };
        const ctx = await buildProductionNaValidationContextFromSession(
          sess,
          forgedBuildOpts,
        );
        assert.strictEqual(ctx.topicEvalAuthority, sess.topic_applicability_evals);
        assert.equal(ctx.currentTopicCatalogVersion, catalogVersion);

        const forgedFreezeCtxOpts = {
          now: NOW,
          authority: forgedBuildOpts.authority,
        };
        const freezeCtx = await buildFreezeNaValidationFromSession(
          sess,
          sess.decision_context!,
          forgedFreezeCtxOpts,
        );
        assert.strictEqual(
          freezeCtx.topicEvalAuthority,
          sess.topic_applicability_evals,
        );
        assert.equal(freezeCtx.currentTopicCatalogVersion, catalogVersion);
      },
    );
  }

  // ----- F4 (S7 split) -----
  {
      const { sessId, draft, e1 } = makeSufficientDraft("f4");
      const ruleId = "rule_s5_f4";
      const topicCode = "topic.s5.f4";
      const evalId = "topic_eval_f4_needed";
      const catalogVersion = "cat_v_f4_sess";

      const topicEvidence = {
        evidence_id: "na_ev_topic_f4",
        target: "dir" as const,
        dir_id: TARGET_DIR,
        na_condition_code: SSOT_CODE,
        evidence_type: "system_na_marker" as const,
        system_basis: {
          kind: "topic_not_applicable" as const,
          topic_code: topicCode,
          rule_id: ruleId,
        },
        written_by: "code" as const,
        revoked: false,
      };
      const topicRule = {
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
      // Fully matching forged eval 闁?would authorize if Session authority trusted caller.
      const forgedMatchingEval: AuthoritativeTopicEvalRecord = {
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

      const dc: DecisionContext = {
        ...structuredClone(draft),
        explicit_na_evidence: [structuredClone(topicEvidence)],
        explicit_na_classifications: [],
      };
      const sess = sessionOf(sessId, dc, {
        confirmation_events: [structuredClone(e1)],
        topic_applicability_evals: [],
        topic_catalog_version: catalogVersion,
      });

      const pureNa = (authority: AuthoritativeTopicEvalRecord[]) =>
        naValidationBoundToDc(dc, sessId, {
          nowIso: NOW,
          confirmationEvents: [structuredClone(e1)],
          dirCatalog: activeCatalogEntries(),
          topicRules: [topicRule],
          topicEvalAuthority: authority,
          currentTopicCatalogVersion: catalogVersion,
        });
      const pureState = (na: ReturnType<typeof naValidationBoundToDc>) =>
        reaggregateDirsIntake(
          dc.dirs,
          dc.reality_facts,
          dc.conflicts,
          dc.constraints,
          dc.explicit_na_evidence ?? [],
          na,
        ).find((d) => d.dir_id === TARGET_DIR)?.current_state;

      check(
        "F4-Pure rule's embedded eval claim without authority row 闁?not n_a (direct cause: topic_eval_id_unknown)", async () => {
          // Precondition: identical rule + an authority row for the claimed eval 闁?n_a.
          const withRow = pureNa([structuredClone(forgedMatchingEval)]);
          assert.equal(reasonOf(topicEvidence, withRow), "ok");
          assert.equal(pureState(withRow), "n_a");
          // Only the authority row removed: embedded rule.evaluation (status
          // current, not_applicable) is not trusted on its own.
          const noRow = pureNa([]);
          assert.equal(reasonOf(topicEvidence, noRow), "topic_eval_id_unknown");
          assert.notEqual(pureState(noRow), "n_a");
        },
      );

      check(
        "F4-Production Session missing eval + forged matching eval via Freeze 闁?not n_a; ctx authority = Session", async () => {
          const forgedFreezeOpts = {
            session: sess,
            now: NOW,
            authority: {
              topicEvalAuthority: [forgedMatchingEval],
              currentTopicCatalogVersion: catalogVersion,
              dirCatalog: [{ dir_id: TARGET_DIR, na_conditions: [SSOT_CODE] }],
              topicRules: [topicRule],
            },
            topicEvalAuthority: [forgedMatchingEval],
          };
          const pack = await freezeDraftForDelivery(structuredClone(dc), forgedFreezeOpts);
          assert.equal(pack.frozen.status, "final");
          assert.notEqual(
            dirState(pack, TARGET_DIR),
            "n_a",
            "forged topicEvalAuthority must not authorize topic N/A",
          );
          assert.equal(dirState(pack, TARGET_DIR), "known");

          const prodCtx = await buildProductionNaValidationContextFromSession(sess, {
            nowIso: NOW,
          });
          assert.deepEqual(prodCtx.topicEvalAuthority, []);
          assert.strictEqual(
            prodCtx.topicEvalAuthority,
            sess.topic_applicability_evals,
          );
          assert.equal(reasonOf(topicEvidence, prodCtx), "topic_rule_missing");
          // Even with a rule supplied, Session's missing eval rejects 闁?the
          // forged matching eval never entered production authority.
          assert.equal(
            reasonOf(topicEvidence, { ...prodCtx, topicRules: [topicRule] }),
            "topic_eval_id_unknown",
          );
        },
      );
  }

  console.log(
    `\nS5 freeze-authority-regression done. PASS=${passed} FAIL=${failed}`,
  );
  if (failed > 0) process.exit(1);
}

main();
