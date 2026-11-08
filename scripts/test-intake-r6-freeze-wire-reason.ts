/**
 * S3 — Freeze Wire reason_code mapping.
 *   pnpm test:intake-r6-freeze-wire-reason
 *
 * Evidence labels: [Tier A] helper unit · [Tier B] production-function execution ·
 * [Code-review] static · not Registry / not S2 !load.ok runtime.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { withIdbWriteFault } from "./fixtures/idb-storage-fault";
import {
  applySufficiencyFreezeToSession,
  canFreezeSessionOnSufficiency,
  ensureSessionFrozenForDelivery,
  evaluateDecisionSufficiency,
  freezeDraftForDelivery,
  FreezeError,
  FREEZE_WIRE_ALLOWLISTED_INTERNAL_CODES,
  FREEZE_WIRE_GENERIC_FAIL_CODE,
  FREEZE_WIRE_PERSIST_FAIL_CODE,
  freezeFailWireResult,
  mapCaughtFreezeFailure,
  persistFailWireResult,
  reaggregateDirsIntake,
  seedDecisionContextFromOpening,
  type DecisionContext,
  type FreezeWireSkipReason,
} from "../lib/poju/decision-context";
import { naValidationBoundToDc } from "../lib/poju/decision-context/na-validation-from-session";
import type { POJUSessionState } from "../lib/poju/types";

installIntakeR6TestGlobals("dev_intake_r6_s3_wire_reason");

const NOW = "2026-11-05T18:00:00.000Z";
const SESS = "sess_s3_wire_reason";

let passed = 0;
let failed = 0;
let untested = 0;

function pass(label: string) {
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function fail(label: string, e: unknown) {
  failed += 1;
  console.error(`  FAIL  ${label}`);
  console.error(e);
}

function markUntested(label: string, detail: string) {
  untested += 1;
  console.log(`  UNTESTED  ${label}`);
  console.log(`           ${detail}`);
}

function check(label: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => pass(label))
    .catch((e) => fail(label, e));
}

function makeSufficientDraft(): DecisionContext {
  const seeded = seedDecisionContextFromOpening({
    context_id: "dc_s3_wire",
    now: NOW,
    core_dilemma: {
      concrete_event: "Stay or leave",
      stakes: "Income",
      sticking_point: null,
    },
    desired_direction: { wants: "Reversible", priority: "stability" },
    user_statements: [
      {
        statement: "Six months runway",
        verification_level: "user_asserted",
        has_user_confirm_event: true,
        status: "confirmed",
        source_turn_id: "t1",
        fact_roles: ["runway", "event", "support"],
      },
    ],
    user_constraints: [
      {
        statement: "No irreversible move before verify",
        category: "reversibility",
        rigidity: "hard",
        source_turn_id: "tc1",
        has_user_confirm_event: true,
      },
    ],
  });
  seeded.reality_facts = seeded.reality_facts.map((f) => ({
    ...f,
    related_dir_ids: ["d1"],
  }));
  seeded.constraints = seeded.constraints.map((c) => ({
    ...c,
    related_dir_ids: ["d1"],
  }));
  const dirsSeed = [
    {
      dir_id: "d1",
      need: "runway",
      why: "afford",
      required_fact_roles: ["runway"],
      current_state: "unknown" as const,
      partial_satisfaction: false,
      agenda_item_ids: [] as string[],
      id_lifecycle: "active" as const,
      may_affect_p5_ranking: false,
    },
  ];
  seeded.dirs = reaggregateDirsIntake(
    dirsSeed,
    seeded.reality_facts,
    [],
    seeded.constraints,
    [],
    naValidationBoundToDc(seeded, SESS),
  );
  assert.equal(evaluateDecisionSufficiency(seeded).canStop, true);
  return seeded;
}

function makeInsufficientDraft(): DecisionContext {
  const draft = makeSufficientDraft();
  draft.reality_facts = [];
  draft.constraints = [];
  draft.dirs = reaggregateDirsIntake(
    draft.dirs.map((d) => ({
      ...d,
      current_state: "unknown" as const,
      partial_satisfaction: false,
    })),
    [],
    [],
    [],
    [],
    naValidationBoundToDc(
      { ...draft, reality_facts: [], constraints: [] },
      SESS,
    ),
  );
  assert.equal(evaluateDecisionSufficiency(draft).canStop, false);
  return draft;
}

function sessionWith(
  dc: DecisionContext | null,
  extra?: Partial<POJUSessionState>,
): POJUSessionState {
  return {
    session_id: SESS,
    user_id: "u_s3",
    created_at: NOW,
    last_interaction_at: NOW,
    messages: [],
    agent_v2: {
      current_phase: "awaiting_confirmation",
      original_question: "Q",
      context_collected: {},
      turn_count: 1,
      tokens_used: 0,
      stall_offer_pending: false,
      delivery_mode: "full",
    } as POJUSessionState["agent_v2"],
    decision_context: dc,
    decision_context_versions: [],
    confirmation_events: [],
    na_declaration_actions: [],
    ...extra,
  } as POJUSessionState;
}

function assertNoReasonCodeOnOk(result: {
  ok: true;
  skipped?: boolean;
  reason?: FreezeWireSkipReason;
}) {
  assert.equal(result.ok, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, "reason_code"),
    false,
  );
}

async function main() {
  console.log("S3 Freeze Wire reason_code\n");

  // ---------- Tier A ----------
  console.log("== Tier A — helper unit ==");
  const phantomSession = sessionWith(null);

  for (const code of FREEZE_WIRE_ALLOWLISTED_INTERNAL_CODES) {
    await check(`[Tier A] mapCaughtFreezeFailure ${code}`, () => {
      const mapped = mapCaughtFreezeFailure(
        new FreezeError(code, { code }),
      );
      assert.equal(mapped.reason_code, code);
      assert.equal(mapped.reason, code);
    });
    await check(`[Tier A] freezeFailWireResult constructed ${code}`, () => {
      const r = freezeFailWireResult(
        phantomSession,
        new FreezeError(code, { code }),
      );
      assert.equal(r.ok, false);
      assert.equal(r.reason_code, code);
      assert.equal(r.reason, code);
      assert.equal(r.session, phantomSession);
    });
  }

  await check("[Tier A] mapCaughtFreezeFailure unknown code → freeze_failed", () => {
    const mapped = mapCaughtFreezeFailure(
      new FreezeError("x", { code: "not_in_allowlist" }),
    );
    assert.equal(mapped.reason_code, FREEZE_WIRE_GENERIC_FAIL_CODE);
    assert.equal(mapped.reason, "x");
  });

  await check("[Tier A] mapCaughtFreezeFailure missing code → freeze_failed", () => {
    const mapped = mapCaughtFreezeFailure(
      new FreezeError("Decision not sufficient to freeze"),
    );
    assert.equal(mapped.reason_code, FREEZE_WIRE_GENERIC_FAIL_CODE);
    assert.equal(mapped.reason, "Decision not sufficient to freeze");
  });

  await check("[Tier A] mapCaughtFreezeFailure plain Error → freeze_failed", () => {
    const mapped = mapCaughtFreezeFailure(
      new Error("freezeDraftForDelivery: session.session_id required"),
    );
    assert.equal(mapped.reason_code, FREEZE_WIRE_GENERIC_FAIL_CODE);
    assert.equal(
      mapped.reason,
      "freezeDraftForDelivery: session.session_id required",
    );
  });

  await check("[Tier A] mapCaughtFreezeFailure non-Error → freeze_failed", () => {
    const mapped = mapCaughtFreezeFailure("boom");
    assert.equal(mapped.reason_code, FREEZE_WIRE_GENERIC_FAIL_CODE);
    assert.equal(mapped.reason, "boom");
  });

  await check("[Tier A] persistFailWireResult with commit error", () => {
    const r = persistFailWireResult(phantomSession, "cas boom");
    assert.equal(r.ok, false);
    assert.equal(r.reason_code, FREEZE_WIRE_PERSIST_FAIL_CODE);
    assert.equal(r.reason, "cas boom");
    assert.equal(r.session, phantomSession);
    for (const code of FREEZE_WIRE_ALLOWLISTED_INTERNAL_CODES) {
      assert.notEqual(r.reason_code, code);
    }
    assert.notEqual(r.reason_code, FREEZE_WIRE_GENERIC_FAIL_CODE);
  });

  await check("[Tier A] persistFailWireResult null/empty → token reason", () => {
    const rNull = persistFailWireResult(phantomSession, null);
    assert.equal(rNull.reason_code, FREEZE_WIRE_PERSIST_FAIL_CODE);
    assert.equal(rNull.reason, FREEZE_WIRE_PERSIST_FAIL_CODE);
    const rEmpty = persistFailWireResult(phantomSession, "");
    assert.equal(rEmpty.reason_code, FREEZE_WIRE_PERSIST_FAIL_CODE);
    assert.equal(rEmpty.reason, FREEZE_WIRE_PERSIST_FAIL_CODE);
  });

  await check("[Tier A] canFreezeSessionOnSufficiency stall (gate-only)", () => {
    const draft = makeSufficientDraft();
    const base = sessionWith(draft);
    const s = sessionWith(draft, {
      agent_v2: { ...base.agent_v2!, stall_offer_pending: true },
    });
    const gate = canFreezeSessionOnSufficiency({
      session: s,
      trigger: "pre_delivery_safety",
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, "stall_or_degraded_path");
  });

  // ---------- Code-review ----------
  console.log("\n== Code-review ==");
  await check("[Code-review] catch / persist / pass-through thin helpers", () => {
    const src = readFileSync(
      resolve("lib/poju/decision-context/production-freeze-wire.ts"),
      "utf8",
    );
    assert.match(
      src,
      /catch\s*\(\s*e\s*\)\s*\{\s*\n\s*return freezeFailWireResult\(\s*session\s*,\s*e\s*\)\s*;/,
    );
    assert.match(
      src,
      /if\s*\(\s*!commit\.committed\s*\)\s*\{\s*\n\s*return persistFailWireResult\(\s*session\s*,\s*commit\.error\s*\)\s*;/,
    );
    assert.match(
      src,
      /if\s*\(\s*!applied\.ok\s*\|\|\s*applied\.skipped\s*\)\s*return applied\s*;/,
    );
  });

  // ---------- Tier B ----------
  console.log("\n== Tier B — production-function execution ==");
  const draft = makeSufficientDraft();

  await check(
    "[Tier B] applySufficiencyFreezeToSession catch → freeze_failed",
    () => {
      const s = sessionWith(draft, { session_id: "" });
      const gate = canFreezeSessionOnSufficiency({
        session: s,
        trigger: "sufficiency_end_confirm",
      });
      assert.equal(gate.allowed, true);
      const result = applySufficiencyFreezeToSession(s, { now: NOW });
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("expected fail");
      assert.equal(result.reason_code, FREEZE_WIRE_GENERIC_FAIL_CODE);
      assert.match(result.reason, /session\.session_id required/);
      assert.equal(result.session, s);
      assert.notEqual(result.reason_code, FREEZE_WIRE_PERSIST_FAIL_CODE);
    },
  );

  await check(
    "[Tier B] ensureSessionFrozenForDelivery apply-fail propagation",
    async () => {
      const s = sessionWith(draft, { session_id: "" });
      const result = await ensureSessionFrozenForDelivery(s, {
        trigger: "pre_delivery_safety",
        now: NOW,
      });
      assert.equal(result.ok, false);
      if (result.ok) throw new Error("expected fail");
      assert.equal(result.reason_code, FREEZE_WIRE_GENERIC_FAIL_CODE);
      assert.notEqual(result.reason_code, FREEZE_WIRE_PERSIST_FAIL_CODE);
      assert.match(result.reason, /session\.session_id required/);
    },
  );

  await check(
    "[Tier B] applySufficiencyFreezeToSession success",
    () => {
      const s = sessionWith(draft);
      const result = applySufficiencyFreezeToSession(s, { now: NOW });
      assert.equal(result.ok, true);
      if (!result.ok || ("skipped" in result && result.skipped)) {
        throw new Error("expected success freeze");
      }
      assertNoReasonCodeOnOk(result);
      assert.equal(result.session.decision_context?.status, "final");
      assert.ok(result.pack.binding.context_hash);
    },
  );

  await check(
    "[Tier B] applySufficiencyFreezeToSession skip already_frozen",
    () => {
      const pack = freezeDraftForDelivery(draft, {
        session: sessionWith(draft),
        now: NOW,
      });
      const s = sessionWith(pack.frozen, {
        decision_context_versions: [pack.version_snapshot],
      });
      const result = applySufficiencyFreezeToSession(s);
      assert.equal(result.ok, true);
      assert.equal("skipped" in result && result.skipped, true);
      if (!result.ok || !("skipped" in result) || !result.skipped) {
        throw new Error("expected skip");
      }
      assert.equal(result.reason, "already_frozen");
      assertNoReasonCodeOnOk(result);
    },
  );

  await check(
    "[Tier B] applySufficiencyFreezeToSession skip not_sufficient",
    () => {
      const insufficient = makeInsufficientDraft();
      const s = sessionWith(insufficient);
      const result = applySufficiencyFreezeToSession(s);
      assert.equal(result.ok, true);
      assert.equal("skipped" in result && result.skipped, true);
      if (!result.ok || !("skipped" in result) || !result.skipped) {
        throw new Error("expected skip");
      }
      assert.equal(result.reason, "not_sufficient");
      assertNoReasonCodeOnOk(result);
    },
  );

  await check(
    "[Tier B] applySufficiencyFreezeToSession skip stall_or_degraded_path",
    () => {
      const base = sessionWith(draft);
      const s = sessionWith(draft, {
        agent_v2: { ...base.agent_v2!, stall_offer_pending: true },
      });
      const result = applySufficiencyFreezeToSession(s);
      assert.equal(result.ok, true);
      assert.equal("skipped" in result && result.skipped, true);
      if (!result.ok || !("skipped" in result) || !result.skipped) {
        throw new Error("expected skip");
      }
      assert.equal(result.reason, "stall_or_degraded_path");
      assertNoReasonCodeOnOk(result);
    },
  );

  // Persist-fail: real IndexedDB write failure (storage-level tx abort, test fixture).
  console.log("\n== Tier B — ensure persist-fail (real IndexedDB tx abort) ==");
  await check(
    "[Tier B] ensureSessionFrozenForDelivery persist-fail (IDB tx abort) → dc_freeze_persist_failed; Session unchanged; IDB draft",
    async () => {
      const { __resetPojuDbForTests, ensurePojuDbReady } = await import(
        "../lib/db/poju-db"
      );
      const { createPOJUSession, loadPOJUSession, mutatePOJUSession } =
        await import("../lib/poju/session-manager");

      await __resetPojuDbForTests();
      await ensurePojuDbReady();
      const sid = await createPOJUSession({
        payment_id: "pay_s3_wire_persist",
        original_question: "s3 persist fail",
      });
      const liveDraft = makeSufficientDraft();
      liveDraft.context_id = `dc_${sid}`;
      liveDraft.dirs = reaggregateDirsIntake(
        liveDraft.dirs,
        liveDraft.reality_facts,
        liveDraft.conflicts,
        liveDraft.constraints,
        liveDraft.explicit_na_evidence ?? [],
        naValidationBoundToDc(liveDraft, sid),
      );

      await mutatePOJUSession(sid, {
        operation_id: "op_s3_seed_draft",
        kind: "session_patch",
        bump_dc: true,
        apply: (latest): POJUSessionState => ({
          ...latest,
          agent_v2: latest.agent_v2
            ? {
                ...latest.agent_v2,
                stall_offer_pending: false,
                delivery_mode: "full",
              }
            : latest.agent_v2,
          decision_context: liveDraft,
          confirmation_events: latest.confirmation_events ?? [],
        }),
      });

      const sess = await loadPOJUSession(sid);
      assert.ok(sess?.decision_context);
      assert.equal(sess.decision_context.status, "draft");
      assert.equal(evaluateDecisionSufficiency(sess.decision_context).canStop, true);

      const { value: persistResult, hits } = await withIdbWriteFault(
        "pojuSessionRecords",
        () =>
          ensureSessionFrozenForDelivery(sess, {
            trigger: "pre_delivery_safety",
            now: NOW,
          }),
      );
      assert.equal(hits, 1);
      assert.equal(persistResult.ok, false);
      if (persistResult.ok) throw new Error("expected ok:false");
      assert.equal(persistResult.reason_code, FREEZE_WIRE_PERSIST_FAIL_CODE);
      assert.notEqual(persistResult.reason_code, FREEZE_WIRE_GENERIC_FAIL_CODE);
      for (const code of FREEZE_WIRE_ALLOWLISTED_INTERNAL_CODES) {
        assert.notEqual(persistResult.reason_code, code);
      }
      assert.strictEqual(persistResult.session, sess);
      const after = await loadPOJUSession(sid);
      assert.equal(after?.decision_context?.status, "draft");
      assert.deepEqual(after?.decision_context, sess.decision_context);
    },
  );

  console.log(
    `\nS3 wire-reason done. passed=${passed} failed=${failed} untested=${untested}`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
