/**
 * S5 — R6 Freeze Authority Regression (F1–F4), isolated.
 *   pnpm test:intake-r6-freeze-authority-regression
 *
 * Fixtures use production ACTIVE Catalog pair only:
 *   DIR-DEF-UNACCEPTABLE + explicit_no_hard_red_lines
 * No production code changes. topicRules remain an Authority Gap (not Session SoT).
 */
import assert from "node:assert/strict";
import {
  freezeDraftForDelivery,
  reaggregateDirsIntake,
  naValidationBoundToDc,
} from "../lib/poju/decision-context";
import type { DecisionContext } from "../lib/poju/decision-context/types";
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

function dirState(pack: { frozen: DecisionContext }, dirId: string): string | undefined {
  return pack.frozen.dirs.find((d) => d.dir_id === dirId)?.current_state;
}

/**
 * Fresh sufficient draft per case — no shared mutable Action/Classification/Evidence.
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
  const e1 = {
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

function main() {
  console.log("intake-r6-freeze-authority-regression (S5 F1–F4)");
  console.log(`  ACTIVE fixture pair: ${TARGET_DIR} + ${SSOT_CODE}`);

  // ----- F1 -----
  check("F1 Session N/A + forged caller authority → DIR n_a", () => {
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

    const forgedConfirm = [
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

    const pack = freezeDraftForDelivery(structuredClone(dc), {
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
    });

    assert.equal(pack.frozen.status, "final");
    assert.equal(
      dirState(pack, TARGET_DIR),
      "n_a",
      "Session action+E1 must authorize N/A; forged caller authority must not win",
    );
  });

  // ----- F2 -----
  check("F2 Session missing action + forged matching action → not n_a", () => {
    const { sessId, ctxId, factId, draft, e1 } = makeSufficientDraft("f2");
    const triad = userNaTriad({
      sessId,
      ctxId,
      factId,
      actionId: "na-act-f2-would-match",
      turnId: "turn_f2",
    });
    // Classification/Evidence remain — if forged Action were trusted, DIR → n_a.
    const dc: DecisionContext = {
      ...structuredClone(draft),
      explicit_na_classifications: [structuredClone(triad.classification)],
      explicit_na_evidence: [structuredClone(triad.evidence)],
    };

    const sess = sessionOf(sessId, dc, {
      confirmation_events: [structuredClone(e1)],
      na_declaration_actions: [],
    });

    const pack = freezeDraftForDelivery(structuredClone(dc), {
      session: sess,
      now: NOW,
      authority: {
        confirmationEvents: [structuredClone(e1)],
        // Fully matching forged Action — sufficient alone if wrongly trusted.
        naDeclarationActions: [structuredClone(triad.action)],
        dirCatalog: [
          { dir_id: TARGET_DIR, na_conditions: [SSOT_CODE] },
        ],
      },
    });

    assert.equal(pack.frozen.status, "final");
    assert.notEqual(
      dirState(pack, TARGET_DIR),
      "n_a",
      "forged naDeclarationActions must not authorize Explicit N/A",
    );
    assert.equal(dirState(pack, TARGET_DIR), "known");
  });

  // ----- F3 -----
  check("F3 Session topic eval + forged topic authority → DIR n_a", () => {
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
    // Authority Gap: topicRules are not Session-owned; tests may supply them.
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

    const pack = freezeDraftForDelivery(structuredClone(dc), {
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
    });

    assert.equal(pack.frozen.status, "final");
    assert.equal(
      dirState(pack, TARGET_DIR),
      "n_a",
      "Session topic eval must authorize; forged topicEvalAuthority must not win",
    );
  });

  // ----- F4 -----
  check(
    "F4 Session missing eval + forged matching eval → not n_a",
    () => {
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
      // Fully matching forged eval — would authorize if Session authority trusted caller.
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

      const pack = freezeDraftForDelivery(structuredClone(dc), {
        session: sess,
        now: NOW,
        authority: {
          topicEvalAuthority: [forgedMatchingEval],
          currentTopicCatalogVersion: catalogVersion,
          dirCatalog: [
            { dir_id: TARGET_DIR, na_conditions: [SSOT_CODE] },
          ],
          topicRules: [topicRule],
        },
      });

      assert.equal(pack.frozen.status, "final");
      assert.notEqual(
        dirState(pack, TARGET_DIR),
        "n_a",
        "forged topicEvalAuthority must not authorize topic N/A",
      );
      assert.equal(dirState(pack, TARGET_DIR), "known");
    },
  );

  console.log(
    `\nS5 freeze-authority-regression done. PASS=${passed} FAIL=${failed}`,
  );
  if (failed > 0) process.exit(1);
}

main();
