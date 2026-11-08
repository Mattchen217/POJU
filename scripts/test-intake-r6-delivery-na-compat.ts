/**
 * S8-F — Delivery / Report compatibility with DIR n_a (F1–F8).
 *
 * Every Decision Context here is produced by production paths only:
 *   seedNaDraftSession (createPOJUSession → E1 → declareDirNotApplicable →
 *   reaggregateDirsOnSession) → ensureSessionFrozenForDelivery (C1 / IndexedDB).
 * Consumers exercised on the frozen result:
 *   resolveDeliveryDcPayload (client POST payload) → JSON wire copy →
 *   assertSnapshotMatchesBinding / resolveDecisionContextForReport (the two
 *   binding branches app/api/poju/final-delivery/route.ts calls) →
 *   buildDecisionContextPageFeed / formatDecisionContextSliceForPage (page prompts,
 *   BookJudgment, run-step-v3) → buildStage4SampleFromFrozenDc /
 *   assertP5P6P8Consistency (Stage 4 report structure).
 * F0 additionally captures the real POST body sent by runFinalDeliveryForSession.
 * The HTTP route handler itself is not executed (no server in this script).
 *
 *   pnpm test:intake-r6-delivery-na-compat
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import {
  ACTIVE_NA_CODE,
  ACTIVE_NA_DIR,
  NORMAL_DIR,
  seedNaDraftSession,
} from "./fixtures/intake-r6-na-seed";
import { seedBreakthroughCoreForDelivery } from "./fixtures/intake-r6-delivery-core";
import type { DecisionPageId } from "../lib/llm/pro/delivery/page-feed-matrix";
import type { DecisionContextPageFeed } from "../lib/poju/decision-context/dc-page-feed";
import type { Stage4ReportArtifact } from "../lib/poju/decision-context/stage4-report";
import type {
  DecisionContext,
  DecisionContextBinding,
  DirCurrentState,
  ExplicitNaClassification,
  ExplicitNaEvidence,
  NaSourceRef,
  RealityFact,
} from "../lib/poju/decision-context/types";
import type { POJUSessionState } from "../lib/poju/types";

installIntakeR6TestGlobals("dev_intake_r6_s8_delivery_na");

const NOW = "2026-11-08T14:00:00.000Z";
const V2_NOW = "2026-11-08T15:00:00.000Z";

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type Bound = {
  session: POJUSessionState;
  snapshot: DecisionContext;
  binding: DecisionContextBinding;
  feeds: Map<DecisionPageId, DecisionContextPageFeed>;
  slices: Map<DecisionPageId, string>;
  artifact: Stage4ReportArtifact;
};

async function main() {
  console.log("intake-r6-delivery-na-compat (S8-F)");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { loadPOJUSession } = await import("../lib/poju/session-manager");
  const { mutatePOJUSession } = await import("../lib/poju/session-mutation");
  const { ensureSessionFrozenForDelivery, resolveDeliveryDcPayload } = await import(
    "../lib/poju/decision-context/production-freeze-wire"
  );
  const { freezeDraftForDelivery } = await import("../lib/poju/decision-context/freeze-to-delivery");
  const {
    assertSnapshotMatchesBinding,
    bindingFromDecisionContext,
    resolveDecisionContextForReport,
  } = await import("../lib/poju/decision-context/read-bound");
  const {
    STAGE4_DC_FEED_PAGES,
    buildDecisionContextPageFeed,
    formatDecisionContextSliceForPage,
  } = await import("../lib/poju/decision-context/dc-page-feed");
  const { assertP5P6P8Consistency, buildStage4SampleFromFrozenDc } = await import(
    "../lib/poju/decision-context/stage4-report"
  );
  const { buildProductionNaValidationContextFromSession, reaggregateDirsOnSession } =
    await import("../lib/poju/decision-context/na-validation-from-session");
  const { findValidatedDirLevelNa } = await import("../lib/poju/decision-context/explicit-na-validate");
  const { openConflict } = await import("../lib/poju/decision-context/conflict-lifecycle");
  const { declareDirNotApplicable, revokeDirNaDeclaration } = await import(
    "../lib/poju/decision-context/na-declaration"
  );
  const { persistV2FromFinalOnSession } = await import(
    "../lib/poju/decision-context/production-versioning"
  );

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  async function durable(sid: string): Promise<POJUSessionState> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `session ${sid} not loadable`);
    return s;
  }

  function dcOf(s: POJUSessionState): DecisionContext {
    assert.ok(s.decision_context, "Decision Context missing");
    return s.decision_context;
  }

  const dirState = (dc: DecisionContext, dirId: string) =>
    dc.dirs.find((d) => d.dir_id === dirId)?.current_state;

  const feedDir = (feed: DecisionContextPageFeed, dirId: string) =>
    feed.dirs.find((d) => d.dir_id === dirId);

  const boundaryLines = (feed: DecisionContextPageFeed, dirId: string) =>
    feed.unknowns_and_boundaries.filter((l) => l.startsWith(`DIR ${dirId} `));

  /** Persist production reaggregation (Session-derived NaValidation) onto the draft. */
  async function reaggregate(sid: string, op: string): Promise<void> {
    await mutatePOJUSession(sid, {
      operation_id: op,
      kind: "session_patch",
      bump_dc: true,
      apply: (latest): POJUSessionState => {
        const dc = dcOf(latest);
        return {
          ...latest,
          decision_context: {
            ...dc,
            dirs: reaggregateDirsOnSession(latest, dc.dirs, { nowIso: NOW }),
            updated_at: NOW,
          },
        };
      },
    });
  }

  async function patchDc(
    sid: string,
    op: string,
    fn: (dc: DecisionContext) => DecisionContext,
  ): Promise<void> {
    await mutatePOJUSession(sid, {
      operation_id: op,
      kind: "session_patch",
      bump_dc: true,
      apply: (latest): POJUSessionState => ({ ...latest, decision_context: fn(dcOf(latest)) }),
    });
  }

  /** Delivery + report consumers on a durable frozen Session. */
  function bindFrozen(session: POJUSessionState): Bound {
    const payload = resolveDeliveryDcPayload(session);
    assert.ok(payload.binding, "client payload carries a frozen binding");
    assert.ok(payload.snapshot, "client payload carries a frozen snapshot");

    // Route branch A: snapshot + binding from the JSON body.
    const wireSnapshot: DecisionContext = JSON.parse(JSON.stringify(payload.snapshot));
    const wireBinding: DecisionContextBinding = JSON.parse(JSON.stringify(payload.binding));
    assertSnapshotMatchesBinding(wireSnapshot, wireBinding);

    // Route branch B: resolve from the slice with the binding triple.
    const resolved = resolveDecisionContextForReport(
      {
        decision_context: JSON.parse(JSON.stringify(payload.decision_context)),
        decision_context_versions: JSON.parse(JSON.stringify(payload.decision_context_versions)),
      },
      {
        context_id: wireBinding.context_id,
        version: wireBinding.context_version,
        expected_hash: wireBinding.context_hash,
      },
    );
    assert.deepEqual(resolved.binding, wireBinding);
    assert.deepEqual(resolved.snapshot, wireSnapshot);

    const snapshot = resolved.snapshot;
    const feeds = new Map<DecisionPageId, DecisionContextPageFeed>();
    const slices = new Map<DecisionPageId, string>();
    for (const page of STAGE4_DC_FEED_PAGES) {
      feeds.set(page, buildDecisionContextPageFeed(snapshot, page));
      const slice = formatDecisionContextSliceForPage(snapshot, page);
      assert.ok(
        slice.includes(
          `binding: ${wireBinding.context_id}@v${wireBinding.context_version} hash=${wireBinding.context_hash}`,
        ),
      );
      slices.set(page, slice);
    }
    const artifact = buildStage4SampleFromFrozenDc(snapshot, { now: NOW });
    assertP5P6P8Consistency(artifact);
    return { session, snapshot, binding: wireBinding, feeds, slices, artifact };
  }

  async function freezeAndBind(sid: string): Promise<Bound> {
    const draft = await durable(sid);
    const wire = await ensureSessionFrozenForDelivery(draft, {
      trigger: "pre_delivery_safety",
      now: NOW,
    });
    assert.ok(wire.ok, `freeze failed: ${wire.ok ? "" : wire.reason}`);
    assert.ok(!("skipped" in wire && wire.skipped), `freeze skipped: ${"reason" in wire ? wire.reason : ""}`);
    return bindFrozen(await durable(sid));
  }

  function eachFeed(b: Bound, fn: (page: DecisionPageId, feed: DecisionContextPageFeed) => void) {
    assert.equal(b.feeds.size, STAGE4_DC_FEED_PAGES.length);
    for (const [page, feed] of b.feeds) fn(page, feed);
  }

  const face05 = (a: Stage4ReportArtifact): Record<string, unknown> => {
    const f = a.faces["05"];
    assert.ok(f);
    return f;
  };

  const naBound = await (async () => {
    const seed = await seedNaDraftSession("fna", NOW);
    return { seed, bound: await freezeAndBind(seed.sid) };
  })();
  const knownBound = await (async () => {
    const seed = await seedNaDraftSession("fknown", NOW, { withNa: false });
    return { seed, bound: await freezeAndBind(seed.sid) };
  })();

  // ============================================== F0
  console.log("\n== F0 production hand-off: runFinalDeliveryForSession POST body ==");

  await check("F0 runFinalDeliveryForSession freezes via C1 and POSTs the frozen n_a snapshot + matching binding (route binding accepts the wire body)", async () => {
    const { runFinalDeliveryForSession } = await import("../lib/llm/pro/final-delivery");
    const seed = await seedNaDraftSession("f0", NOW);
    await seedBreakthroughCoreForDelivery(seed.sid, NOW, "f0");
    const before = await durable(seed.sid);
    assert.equal(dcOf(before).status, "draft");

    const posts: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "/api/poju/final-delivery" && init?.method === "POST" && typeof init.body === "string") {
        posts.push(init.body);
        return new Response(JSON.stringify({ ok: false, error: "s8_capture_only" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    };
    try {
      await assert.rejects(() => runFinalDeliveryForSession(before, "en"));
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(posts.length, 1, "exactly one create-job POST");
    const sent: {
      decision_context_snapshot: DecisionContext;
      decision_context_binding: DecisionContextBinding;
    } = JSON.parse(posts[0]!);
    assert.ok(isRecord(sent.decision_context_snapshot));
    assert.ok(isRecord(sent.decision_context_binding));

    const frozen = await durable(seed.sid);
    const frozenDc = dcOf(frozen);
    assert.equal(frozenDc.status, "final", "freeze persisted before the HTTP call");
    assert.equal(dirState(frozenDc, ACTIVE_NA_DIR), "n_a");
    const expectedBinding = bindingFromDecisionContext(frozenDc);
    assert.deepEqual(sent.decision_context_binding, expectedBinding);
    assert.deepEqual(
      sent.decision_context_snapshot,
      JSON.parse(JSON.stringify(resolveDeliveryDcPayload(frozen).snapshot)),
    );
    // Route branch A on the exact posted body.
    assertSnapshotMatchesBinding(sent.decision_context_snapshot, sent.decision_context_binding);
    assert.equal(dirState(sent.decision_context_snapshot, ACTIVE_NA_DIR), "n_a");
    const b = bindFrozen(frozen);
    assert.deepEqual(b.binding, expectedBinding);
    eachFeed(b, (_page, feed) => assert.equal(feedDir(feed, ACTIVE_NA_DIR)?.current_state, "n_a"));
  });

  // ============================================== F1
  console.log("\n== F1 n_a is not consumed as unknown ==");

  await check("F1 feed DIR state n_a on all six DC-fed pages; boundary lines (if any) label n_a, never unknown", async () => {
    const b = naBound.bound;
    assert.equal(dirState(b.snapshot, ACTIVE_NA_DIR), "n_a");
    eachFeed(b, (page, feed) => {
      assert.equal(feedDir(feed, ACTIVE_NA_DIR)?.current_state, "n_a", `page ${page}`);
      for (const line of boundaryLines(feed, ACTIVE_NA_DIR)) {
        assert.ok(line.includes("[n_a"), `page ${page}: ${line}`);
        assert.ok(!line.includes("[unknown"), `page ${page}: ${line}`);
      }
    });
  });

  await check("F1 Stage4 report: n_a DIR adds no P5 unknown condition and does not require recommendation_conditions; control: same DIR as unknown does require them", async () => {
    const b = naBound.bound;
    const f05 = face05(b.artifact);
    const conditions = typeof f05.recommendation_conditions === "string" ? f05.recommendation_conditions : "";
    assert.ok(!conditions.includes(`DIR ${ACTIVE_NA_DIR}`), conditions);
    assert.equal(b.artifact.faces["08"]?.review_decision, "continue");

    const noConditions: Stage4ReportArtifact = {
      ...b.artifact,
      faces: { ...b.artifact.faces, "05": { ...f05, recommendation_conditions: "" } },
    };
    assert.doesNotThrow(() => assertP5P6P8Consistency(noConditions));

    const unknownState: DirCurrentState = "unknown";
    const asUnknown: Stage4ReportArtifact = {
      ...noConditions,
      context_snapshot: {
        ...b.snapshot,
        dirs: b.snapshot.dirs.map((d) =>
          d.dir_id === ACTIVE_NA_DIR ? { ...d, current_state: unknownState } : d,
        ),
      },
    };
    assert.throws(
      () => assertP5P6P8Consistency(asUnknown),
      (e: unknown) => isRecord(e) && e.code === "STAGE4_P5_CONDITIONS_REQUIRED",
    );
  });

  // ============================================== F2
  console.log("\n== F2 n_a is not consumed as known ==");

  await check("F2 same DIR + same confirmed fact: N/A session → n_a, no-N/A session → known; consumers keep them distinct", async () => {
    const na = naBound.bound;
    const kn = knownBound.bound;
    assert.equal(dirState(na.snapshot, ACTIVE_NA_DIR), "n_a");
    assert.equal(dirState(kn.snapshot, ACTIVE_NA_DIR), "known");
    for (const page of STAGE4_DC_FEED_PAGES) {
      const nf = na.feeds.get(page);
      const kf = kn.feeds.get(page);
      assert.ok(nf && kf);
      assert.equal(feedDir(nf, ACTIVE_NA_DIR)?.current_state, "n_a");
      assert.equal(feedDir(kf, ACTIVE_NA_DIR)?.current_state, "known");
    }
    assert.notEqual(na.binding.context_hash, kn.binding.context_hash);
    // Authority rows present only on the N/A snapshot.
    assert.equal((na.snapshot.explicit_na_evidence ?? []).length, 1);
    assert.equal((kn.snapshot.explicit_na_evidence ?? []).length, 0);
  });

  await check("F2 N/A does not upgrade the underlying fact: statement / status / verification_level / user_confirmed unchanged in snapshot and feed", async () => {
    const b = naBound.bound;
    const fact = b.snapshot.reality_facts.find((f) => f.fact_id === naBound.seed.naFactId);
    assert.ok(fact);
    assert.equal(fact.status, "confirmed");
    assert.equal(fact.verification_level, "user_asserted");
    assert.equal(fact.user_confirmed, true);
    eachFeed(b, (_page, feed) => {
      const projected = feed.confirmed_facts.find((f) => f.fact_id === fact.fact_id);
      assert.deepEqual(projected, {
        fact_id: fact.fact_id,
        statement: fact.statement,
        verification_level: "user_asserted",
        user_confirmed: true,
      });
    });
  });

  // ============================================== F3
  console.log("\n== F3 invalid N/A evidence does not reach the report ==");

  await check("F3 forged DC-only evidence (user_explicit_na without Session action + classification, and system_na_marker) → DIR stays known in frozen snapshot, feeds and report", async () => {
    const seed = await seedNaDraftSession("f3", NOW, { withNa: false });
    const draft = dcOf(await durable(seed.sid));
    const forgedActionId = "na-act-f3-forged";
    const sourceRef: NaSourceRef = { kind: "reality_fact", fact_id: seed.naFactId };
    const forgedCls: ExplicitNaClassification = {
      classification_id: "cls_f3_forged",
      context_id: draft.context_id,
      source_ref: sourceRef,
      dir_id: ACTIVE_NA_DIR,
      na_condition_code: ACTIVE_NA_CODE,
      authority: "user_declared",
      written_by: "code",
      declaration_action_id: forgedActionId,
      declaration_turn_id: "t_f3_forged",
      revoked: false,
      expires_at: null,
      created_at: NOW,
    };
    const forgedUserEv: ExplicitNaEvidence = {
      evidence_id: `na_ev_${forgedActionId}`,
      target: "dir",
      dir_id: ACTIVE_NA_DIR,
      na_condition_code: ACTIVE_NA_CODE,
      evidence_type: "user_explicit_na",
      source_ref: sourceRef,
      written_by: "code",
      revoked: false,
    };
    const forgedSystemEv: ExplicitNaEvidence = {
      evidence_id: "na_sys_f3_forged",
      target: "dir",
      dir_id: ACTIVE_NA_DIR,
      na_condition_code: ACTIVE_NA_CODE,
      evidence_type: "system_na_marker",
      system_basis: {
        kind: "catalog_na_condition_met",
        target_dir_id: ACTIVE_NA_DIR,
        condition_eval_id: "eval_f3_forged",
      },
      written_by: "code",
      revoked: false,
    };
    await patchDc(seed.sid, "op_f3_inject", (dc) => ({
      ...dc,
      explicit_na_classifications: [...(dc.explicit_na_classifications ?? []), forgedCls],
      explicit_na_evidence: [...(dc.explicit_na_evidence ?? []), forgedUserEv, forgedSystemEv],
      updated_at: NOW,
    }));
    await reaggregate(seed.sid, "op_f3_reagg");
    const injected = await durable(seed.sid);
    assert.equal((injected.na_declaration_actions ?? []).length, 0, "no Session declaration action");
    assert.equal(dirState(dcOf(injected), ACTIVE_NA_DIR), "known");

    const b = await freezeAndBind(seed.sid);
    assert.equal(dirState(b.snapshot, ACTIVE_NA_DIR), "known");
    const na = buildProductionNaValidationContextFromSession(b.session, { nowIso: NOW });
    assert.equal(findValidatedDirLevelNa(ACTIVE_NA_DIR, b.snapshot.explicit_na_evidence, na), null);
    eachFeed(b, (page, feed) => {
      assert.equal(feedDir(feed, ACTIVE_NA_DIR)?.current_state, "known", `page ${page}`);
      const slice = b.slices.get(page) ?? "";
      for (const id of [forgedUserEv.evidence_id, forgedSystemEv.evidence_id, forgedCls.classification_id, forgedActionId]) {
        assert.ok(!slice.includes(id), `page ${page} slice leaks ${id}`);
      }
      assert.ok(!slice.includes('"current_state": "n_a"'), `page ${page} slice shows n_a`);
    });
    const reportText = JSON.stringify(b.artifact.faces);
    assert.ok(!reportText.includes(forgedUserEv.evidence_id));
    assert.ok(!reportText.includes(forgedSystemEv.evidence_id));
  });

  await check("F3 declaration with a code outside the ACTIVE catalog pair is rejected at write; IndexedDB unchanged (nothing to consume)", async () => {
    const seed = await seedNaDraftSession("f3code", NOW, { withNa: false });
    const before = await durable(seed.sid);
    await assert.rejects(() =>
      declareDirNotApplicable(seed.sid, {
        operation_id: "op_f3_bad_code",
        declaration_action_id: "na-act-f3-bad-code",
        control_id: "na_declare",
        fact_id: seed.naFactId,
        dir_id: ACTIVE_NA_DIR,
        na_condition_code: "s8_code_not_in_active_catalog",
        declaration_turn_id: "turn_f3_bad",
        dir_na_conditions: [],
        occurred_at: NOW,
      }),
    );
    const after = await durable(seed.sid);
    assert.deepEqual(after.na_declaration_actions ?? [], before.na_declaration_actions ?? []);
    assert.deepEqual(after.decision_context, before.decision_context);
  });

  // ============================================== F4
  console.log("\n== F4 revoked N/A evidence is not consumed ==");

  await check("F4 revokeDirNaDeclaration → production reaggregation → DIR known; frozen snapshot keeps the revoked rows inert; feeds/report never show n_a; replay rejected", async () => {
    const seed = await seedNaDraftSession("f4", NOW);
    assert.equal(dirState(dcOf(await durable(seed.sid)), ACTIVE_NA_DIR), "n_a");
    await revokeDirNaDeclaration(seed.sid, {
      operation_id: "op_f4_revoke",
      declaration_action_id: seed.declarationActionId,
      revoked_at: NOW,
    });
    await reaggregate(seed.sid, "op_f4_reagg");
    const revoked = await durable(seed.sid);
    assert.equal(dirState(dcOf(revoked), ACTIVE_NA_DIR), "known");

    await assert.rejects(
      () =>
        declareDirNotApplicable(seed.sid, {
          operation_id: "op_f4_replay",
          declaration_action_id: seed.declarationActionId,
          control_id: "na_declare",
          fact_id: seed.naFactId,
          dir_id: ACTIVE_NA_DIR,
          na_condition_code: ACTIVE_NA_CODE,
          declaration_turn_id: "turn_na_f4",
          dir_na_conditions: [],
          occurred_at: NOW,
        }),
      "revoked declaration cannot be replayed back to valid",
    );

    const b = await freezeAndBind(seed.sid);
    assert.equal(dirState(b.snapshot, ACTIVE_NA_DIR), "known");
    const ev = (b.snapshot.explicit_na_evidence ?? []).find(
      (e) => e.evidence_id === `na_ev_${seed.declarationActionId}`,
    );
    assert.equal(ev?.revoked, true);
    const cls = (b.snapshot.explicit_na_classifications ?? []).find(
      (c) => c.declaration_action_id === seed.declarationActionId,
    );
    assert.equal(cls?.revoked, true);
    assert.equal(
      (b.session.na_declaration_actions ?? []).find(
        (a) => a.declaration_action_id === seed.declarationActionId,
      )?.revoked,
      true,
    );
    const na = buildProductionNaValidationContextFromSession(b.session, { nowIso: NOW });
    assert.equal(findValidatedDirLevelNa(ACTIVE_NA_DIR, b.snapshot.explicit_na_evidence, na), null);
    eachFeed(b, (page, feed) =>
      assert.equal(feedDir(feed, ACTIVE_NA_DIR)?.current_state, "known", `page ${page}`),
    );
  });

  // ============================================== F5
  console.log("\n== F5 N/A traceable to DIR + source ==");

  await check("F5 frozen n_a traces to one valid evidence row → DIR + source fact (+E1) → Session declaration action → classification; trace rows are hash-bound to the report binding", async () => {
    const b = naBound.bound;
    const { seed } = naBound;
    const na = buildProductionNaValidationContextFromSession(b.session, { nowIso: NOW });
    const ev = findValidatedDirLevelNa(ACTIVE_NA_DIR, b.snapshot.explicit_na_evidence, na);
    assert.ok(ev, "validated evidence for the n_a DIR");
    assert.equal(ev.target, "dir");
    assert.ok(ev.target === "dir" && ev.evidence_type === "user_explicit_na");
    assert.equal(ev.dir_id, ACTIVE_NA_DIR);
    assert.equal(ev.na_condition_code, ACTIVE_NA_CODE);
    assert.equal(ev.evidence_id, `na_ev_${seed.declarationActionId}`);
    assert.deepEqual(ev.source_ref, { kind: "reality_fact", fact_id: seed.naFactId });

    const fact = b.snapshot.reality_facts.find((f) => f.fact_id === seed.naFactId);
    assert.ok(fact?.related_dir_ids?.includes(ACTIVE_NA_DIR));
    assert.ok(
      (b.session.confirmation_events ?? []).some(
        (e) => "fact_id" in e && e.fact_id === seed.naFactId && e.event_type === "confirm_fact",
      ),
      "source fact has a Session E1",
    );
    const action = (b.session.na_declaration_actions ?? []).find(
      (a) => a.declaration_action_id === seed.declarationActionId,
    );
    assert.ok(action);
    assert.equal(action.dir_id, ACTIVE_NA_DIR);
    assert.equal(action.na_condition_code, ACTIVE_NA_CODE);
    assert.equal(action.revoked, false);
    assert.equal(action.context_id, b.snapshot.context_id);
    const cls = (b.snapshot.explicit_na_classifications ?? []).find(
      (c) => c.declaration_action_id === seed.declarationActionId,
    );
    assert.ok(cls);
    assert.equal(cls.dir_id, ACTIVE_NA_DIR);
    assert.deepEqual(cls.source_ref, ev.source_ref);

    const tampered: DecisionContext = {
      ...b.snapshot,
      explicit_na_evidence: (b.snapshot.explicit_na_evidence ?? []).map((e) =>
        e.evidence_id === ev.evidence_id && e.evidence_type === "user_explicit_na"
          ? { ...e, source_ref: { kind: "reality_fact", fact_id: seed.normalFactId } }
          : e,
      ),
    };
    assert.throws(
      () => assertSnapshotMatchesBinding(tampered, b.binding),
      (e: unknown) => isRecord(e) && e.code === "DC_REPORT_HASH_MISMATCH",
    );
  });

  // ============================================== F6
  console.log("\n== F6 V1 → V2 keeps n_a and its evidence linkage ==");

  await check("F6 V1 final (n_a) → persistV2FromFinalOnSession → V2 draft n_a with identical evidence/classification; V2 freeze binds n_a; V1 still resolvable by version with n_a", async () => {
    const seed = await seedNaDraftSession("f6", NOW);
    const v1b = await freezeAndBind(seed.sid);
    const v1 = v1b.snapshot;
    assert.equal(dirState(v1, ACTIVE_NA_DIR), "n_a");

    const supplement: RealityFact = {
      fact_id: "f_f6_supplement",
      statement: "supplement after delivery",
      status: "unverified",
      verification_level: "user_asserted",
      source_stage: "user_supplement",
      source_turn_id: "t_f6",
      user_confirmed: false,
      fact_roles: ["situation"],
      related_dir_ids: [NORMAL_DIR],
    };
    const r = await persistV2FromFinalOnSession(v1b.session, {
      now: V2_NOW,
      add_facts: [supplement],
      affected_dir_ids: [NORMAL_DIR],
    });
    assert.ok(r.ok && !("skipped" in r && r.skipped), `V2 open failed: ${r.ok ? "skipped" : r.reason}`);
    const v2Draft = dcOf(await durable(seed.sid));
    assert.equal(v2Draft.status, "draft");
    assert.equal(v2Draft.version, v1.version + 1);
    assert.equal(dirState(v2Draft, ACTIVE_NA_DIR), "n_a", "V2 open keeps n_a");
    assert.deepEqual(v2Draft.explicit_na_evidence, v1.explicit_na_evidence);
    assert.deepEqual(v2Draft.explicit_na_classifications, v1.explicit_na_classifications);

    await reaggregate(seed.sid, "op_f6_v2_reagg");
    assert.equal(dirState(dcOf(await durable(seed.sid)), ACTIVE_NA_DIR), "n_a");
    const v2b = await freezeAndBind(seed.sid);
    assert.equal(v2b.binding.context_version, v2b.snapshot.version);
    assert.ok(v2b.snapshot.version > v1.version);
    assert.equal(v2b.snapshot.context_id, v1.context_id);
    assert.equal(dirState(v2b.snapshot, ACTIVE_NA_DIR), "n_a");
    assert.deepEqual(v2b.snapshot.explicit_na_evidence, v1.explicit_na_evidence);
    assert.deepEqual(v2b.snapshot.explicit_na_classifications, v1.explicit_na_classifications);
    const na = buildProductionNaValidationContextFromSession(v2b.session, { nowIso: V2_NOW });
    assert.ok(findValidatedDirLevelNa(ACTIVE_NA_DIR, v2b.snapshot.explicit_na_evidence, na));
    eachFeed(v2b, (page, feed) =>
      assert.equal(feedDir(feed, ACTIVE_NA_DIR)?.current_state, "n_a", `page ${page}`),
    );

    const v1Again = resolveDecisionContextForReport(
      {
        decision_context: v2b.session.decision_context,
        decision_context_versions: v2b.session.decision_context_versions ?? [],
      },
      { context_id: v1.context_id, version: v1.version, expected_hash: v1.content_hash ?? undefined },
    );
    assert.equal(v1Again.snapshot.status, "superseded");
    assert.equal(v1Again.snapshot.content_hash, v1.content_hash);
    assert.equal(dirState(v1Again.snapshot, ACTIVE_NA_DIR), "n_a");
    assert.deepEqual(v1Again.snapshot.explicit_na_evidence, v1.explicit_na_evidence);
  });

  // ============================================== F7
  console.log("\n== F7 conflict outranks n_a ==");

  async function addConflictOnNaDir(sid: string, naFactId: string, tag: string, affects: boolean) {
    const cxFact: RealityFact = {
      fact_id: `fact_cx_${tag}`,
      statement: "there is one outcome I will not accept",
      status: "unverified",
      verification_level: "user_asserted",
      source_stage: "user_supplement",
      source_turn_id: `t_cx_${tag}`,
      user_confirmed: false,
      fact_roles: ["situation"],
      related_dir_ids: [ACTIVE_NA_DIR],
    };
    await patchDc(sid, `op_f7_conflict_${tag}`, (dc) => {
      const facts = [...dc.reality_facts, cxFact];
      const conflict = openConflict({
        conflict_id: `conflict_f7_${tag}`,
        fact_ids: [naFactId, cxFact.fact_id],
        conflict_field: "hard_red_lines",
        facts,
        now: NOW,
        affects_preferred_path: affects,
      });
      return { ...dc, reality_facts: facts, conflicts: [...dc.conflicts, conflict], updated_at: NOW };
    });
    await reaggregate(sid, `op_f7_reagg_${tag}`);
  }

  await check("F7 preferred-path conflict on the N/A DIR → DIR conflict although the N/A triad is still valid; freeze refused; no binding reaches Delivery; normal DIR unaffected", async () => {
    const seed = await seedNaDraftSession("f7", NOW);
    await addConflictOnNaDir(seed.sid, seed.naFactId, "f7", true);
    const s = await durable(seed.sid);
    const dc = dcOf(s);
    assert.equal(dirState(dc, ACTIVE_NA_DIR), "conflict");
    assert.equal(dirState(dc, NORMAL_DIR), "known");
    const na = buildProductionNaValidationContextFromSession(s, { nowIso: NOW });
    assert.ok(
      findValidatedDirLevelNa(ACTIVE_NA_DIR, dc.explicit_na_evidence, na),
      "N/A evidence itself still validates — conflict wins by precedence",
    );

    assert.throws(() => freezeDraftForDelivery(structuredClone(dc), { session: s, now: NOW }));
    const wire = await ensureSessionFrozenForDelivery(s, { trigger: "pre_delivery_safety", now: NOW });
    assert.ok(wire.ok && "skipped" in wire && wire.skipped, "freeze not performed");
    assert.equal(wire.reason, "not_sufficient");
    const after = await durable(seed.sid);
    assert.equal(dcOf(after).status, "draft");
    const payload = resolveDeliveryDcPayload(after);
    assert.equal(payload.binding, null);
    assert.equal(payload.snapshot, null);
  });

  await check("F7 non-preferred-path conflict (existing §2.4: not blocking) → DIR stays n_a; frozen as unresolved_in_final; surfaced to report conditions + feed conflicts", async () => {
    const seed = await seedNaDraftSession("f7b", NOW);
    await addConflictOnNaDir(seed.sid, seed.naFactId, "f7b", false);
    assert.equal(dirState(dcOf(await durable(seed.sid)), ACTIVE_NA_DIR), "n_a");
    const b = await freezeAndBind(seed.sid);
    assert.equal(dirState(b.snapshot, ACTIVE_NA_DIR), "n_a");
    const c = b.snapshot.conflicts.find((x) => x.conflict_id === "conflict_f7_f7b");
    assert.equal(c?.state, "unresolved_in_final");
    assert.equal(c?.affects_preferred_path, false);
    eachFeed(b, (page, feed) => {
      const fc = feed.conflicts.find((x) => x.conflict_id === "conflict_f7_f7b");
      assert.equal(fc?.state, "unresolved_in_final", `page ${page}`);
    });
    const conditions = String(face05(b.artifact).recommendation_conditions ?? "");
    assert.ok(conditions.includes("conflict_f7_f7b"), conditions);
    assert.equal(b.artifact.faces["08"]?.review_decision, "adjust");
  });

  // ============================================== F8
  console.log("\n== F8 normal DIRs unaffected by N/A ==");

  await check("F8 normal DIR projection identical with and without N/A on another DIR (feeds, boundary lines, fact projection); no N/A row targets it", async () => {
    const na = naBound.bound;
    const kn = knownBound.bound;
    assert.equal(dirState(na.snapshot, NORMAL_DIR), "known");
    assert.equal(dirState(kn.snapshot, NORMAL_DIR), "known");
    for (const page of STAGE4_DC_FEED_PAGES) {
      const nf = na.feeds.get(page);
      const kf = kn.feeds.get(page);
      assert.ok(nf && kf);
      assert.deepEqual(feedDir(nf, NORMAL_DIR), feedDir(kf, NORMAL_DIR), `page ${page}`);
      assert.deepEqual(boundaryLines(nf, NORMAL_DIR), boundaryLines(kf, NORMAL_DIR), `page ${page}`);
      const nFact = nf.confirmed_facts.find((f) => f.fact_id === naBound.seed.normalFactId);
      const kFact = kf.confirmed_facts.find((f) => f.fact_id === knownBound.seed.normalFactId);
      assert.ok(nFact && kFact);
      assert.deepEqual({ ...nFact, fact_id: "" }, { ...kFact, fact_id: "" });
    }
    const rows = [
      ...(na.snapshot.explicit_na_evidence ?? []),
      ...(na.snapshot.explicit_na_classifications ?? []),
    ];
    assert.ok(rows.every((r) => !("dir_id" in r) || r.dir_id !== NORMAL_DIR));
  });

  console.log(`\nS8 delivery-na-compat done. PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
