/**
 * S8-E — Freeze persist failure (E1) + S4 "freeze-versioning F1" executed evidence (E2).
 *
 * E1: sufficient draft, production NaValidation passes, freezeDraftForDelivery
 *     succeeds in memory, then the C1 blob write's IndexedDB transaction is
 *     aborted (scripts/fixtures/idb-storage-fault). Wire must fail closed and no
 *     frozen-but-unpersisted DC / Frozen Binding may reach Delivery.
 * E2: S4 C25-era line `[disclose] freeze-versioning F1` referred to R6 F1
 *     ("Session N/A + forged caller authority → DIR n_a", S5 authority-regression
 *     suite). Here it runs on the IndexedDB production path: Session triad written
 *     by declareDirNotApplicable → production Freeze.
 *
 *   pnpm test:intake-r6-freeze-persist-disclose
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { withIdbWriteFault } from "./fixtures/idb-storage-fault";
import { ACTIVE_NA_DIR, NORMAL_DIR, seedNaDraftSession } from "./fixtures/intake-r6-na-seed";
import { seedBreakthroughCoreForDelivery } from "./fixtures/intake-r6-delivery-core";
import type { ConfirmationEvent } from "../lib/poju/decision-context/confirmation-event";
import type { POJUSessionState } from "../lib/poju/types";

installIntakeR6TestGlobals("dev_intake_r6_s8_freeze_persist");

const NOW = "2026-11-08T13:00:00.000Z";
const SESSION_STORE = "pojuSessionRecords";

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
  console.log("intake-r6-freeze-persist-disclose (S8-E)");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { loadPOJUSession } = await import("../lib/poju/session-manager");
  const { mutatePOJUSession } = await import("../lib/poju/session-mutation");
  const {
    applySufficiencyFreezeToSession,
    ensureSessionFrozenForDelivery,
    freezeIdempotencyKey,
    FREEZE_WIRE_PERSIST_FAIL_CODE,
    resolveDeliveryDcPayload,
  } = await import("../lib/poju/decision-context/production-freeze-wire");
  const {
    buildFreezeNaValidationFromSession,
    freezeDraftForDelivery,
    prepareFrozenDcForDelivery,
  } = await import("../lib/poju/decision-context/freeze-to-delivery");
  const { evaluateDecisionSufficiency } = await import("../lib/poju/decision-context/stop-criteria");

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  async function durable(sid: string): Promise<POJUSessionState> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `session ${sid} not loadable`);
    return s;
  }

  const stateOf = (s: POJUSessionState, dirId: string) =>
    s.decision_context?.dirs.find((d) => d.dir_id === dirId)?.current_state;

  function freezeState(s: POJUSessionState) {
    return {
      decision_context: s.decision_context,
      decision_context_versions: s.decision_context_versions ?? [],
      decision_context_idempotency_keys: s.decision_context_idempotency_keys ?? [],
      session_revision: s.session_revision,
      dc_write_revision: s.dc_write_revision,
    };
  }

  // ============================================== E1
  console.log("\n== E1 Freeze persist failure (real IndexedDB tx abort) ==");

  await check("E1 sufficient + NaValidation ok + in-memory freeze ok, C1 write aborted → ok:false dc_freeze_persist_failed; DC stays draft; no frozen binding for Delivery; retry freezes", async () => {
    const { sid } = await seedNaDraftSession("e1", NOW);
    const before = await durable(sid);
    const beforeClone = structuredClone(before);
    const idbBefore = freezeState(before);
    const draft = before.decision_context;
    assert.ok(draft);

    // Preconditions on the exact Session the wire receives.
    assert.equal(draft.status, "draft");
    assert.equal(evaluateDecisionSufficiency(draft).canStop, true);
    assert.equal(stateOf(before, ACTIVE_NA_DIR), "n_a", "production NaValidation accepts the Session triad");
    const inMemory = applySufficiencyFreezeToSession(before, { now: NOW });
    assert.ok(inMemory.ok && !("skipped" in inMemory && inMemory.skipped), JSON.stringify(inMemory));
    assert.equal(inMemory.pack.frozen.status, "final", "freezeDraftForDelivery succeeds before persist");
    const freezeKey = freezeIdempotencyKey(before, draft);

    const { value: res, hits } = await withIdbWriteFault(SESSION_STORE, () =>
      ensureSessionFrozenForDelivery(before, { trigger: "pre_delivery_safety", now: NOW }),
    );
    assert.equal(hits, 1, "storage fault must hit the C1 write exactly once");
    assert.equal(res.ok, false, JSON.stringify(res));
    if (res.ok) throw new Error("expected ok:false");
    assert.equal(res.reason_code, FREEZE_WIRE_PERSIST_FAIL_CODE);
    assert.equal(res.reason_code, "dc_freeze_persist_failed");
    assert.equal("pack" in res, false, "no frozen pack handed to callers");
    assert.strictEqual(res.session, before, "caller Session returned as-is");
    assert.deepEqual(before, beforeClone, "caller Session object not mutated");
    assert.equal(res.session.decision_context?.status, "draft");

    // No frozen-but-unpersisted state anywhere Delivery reads.
    const memPayload = resolveDeliveryDcPayload(res.session);
    assert.equal(memPayload.binding, null);
    assert.equal(memPayload.snapshot, null);
    assert.throws(() =>
      prepareFrozenDcForDelivery({
        decision_context: res.session.decision_context,
        decision_context_versions: res.session.decision_context_versions,
      }),
    );

    const reloaded = await durable(sid);
    assert.deepEqual(freezeState(reloaded), idbBefore, "IndexedDB unchanged");
    assert.equal(reloaded.decision_context?.status, "draft");
    assert.equal(reloaded.decision_context?.content_hash, null);
    assert.equal((reloaded.decision_context_idempotency_keys ?? []).includes(freezeKey), false);
    assert.equal((reloaded.decision_context_versions ?? []).some((v) => v.status === "final"), false);
    const idbPayload = resolveDeliveryDcPayload(reloaded);
    assert.equal(idbPayload.binding, null);
    assert.equal(idbPayload.snapshot, null);

    const retry = await ensureSessionFrozenForDelivery(reloaded, { trigger: "pre_delivery_safety", now: NOW });
    assert.ok(retry.ok && !("skipped" in retry && retry.skipped), `retry must freeze: ${JSON.stringify(retry)}`);
    const frozen = await durable(sid);
    assert.equal(frozen.decision_context?.status, "final");
    assert.ok((frozen.decision_context_idempotency_keys ?? []).includes(freezeKey));
    const okPayload = resolveDeliveryDcPayload(frozen);
    assert.ok(okPayload.binding);
    assert.equal(okPayload.binding.context_hash, frozen.decision_context?.content_hash);
  });

  await check("E1b Delivery entry (runFinalDeliveryForSession) under the same fault → DC_FREEZE_FAILED before any job fetch / pending save; IDB stays draft", async () => {
    const { runFinalDeliveryForSession } = await import("../lib/llm/pro/final-delivery");
    const { sid } = await seedNaDraftSession("e1b", NOW);
    await seedBreakthroughCoreForDelivery(sid, NOW, "e1b");
    const before = await durable(sid);
    const idbBefore = freezeState(before);

    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      fetchCalls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      throw new Error("no network in test");
    };
    try {
      const { hits } = await withIdbWriteFault(SESSION_STORE, () =>
        assert.rejects(
          () => runFinalDeliveryForSession(before, "en"),
          (e: unknown) => e instanceof Error && e.message.startsWith("DC_FREEZE_FAILED:"),
        ),
      );
      assert.equal(hits, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.deepEqual(fetchCalls, [], "no delivery job created");
    const after = await durable(sid);
    assert.deepEqual(freezeState(after), idbBefore);
    assert.equal(after.decision_context?.status, "draft");
    assert.equal(after.pending_delivery_job_id ?? null, before.pending_delivery_job_id ?? null);
    assert.equal(after.last_delivery_context_binding ?? null, null);
  });

  // ============================================== E2
  console.log("\n== E2 S4 freeze-versioning F1 on the IndexedDB production path ==");

  await check("E2-F1 Session triad (declareDirNotApplicable) + forged caller authority → frozen DIR n_a; durable via wire; facts not upgraded", async () => {
    const seed = await seedNaDraftSession("e2f1", NOW);
    const s = await durable(seed.sid);
    const dc = s.decision_context;
    assert.ok(dc);
    assert.equal(stateOf(s, ACTIVE_NA_DIR), "n_a");
    const factsBefore = structuredClone(dc.reality_facts);

    const forgedConfirm: ConfirmationEvent[] = [
      {
        event_id: "e1_FORGED",
        target_type: "fact",
        fact_id: "fact_FORGED",
        source_turn_id: "t_forged",
        confirmation_turn_id: "t_forged_b",
        confirmation_action_id: "ca_forged",
        event_type: "confirm_fact",
        actor: "user",
        confirmed_at: NOW,
        event_version: 1,
      },
    ];
    // Untyped caller payload: `authority` is not part of FreezeDraftForDeliveryOpts.
    const forgedOpts = {
      session: s,
      now: NOW,
      authority: {
        confirmationEvents: forgedConfirm,
        naDeclarationActions: [],
        dirCatalog: [{ dir_id: "DIR-A", na_conditions: ["explicit_not_applicable"] }],
      },
    };
    const pack = freezeDraftForDelivery(structuredClone(dc), forgedOpts);
    assert.equal(pack.frozen.status, "final");
    assert.equal(
      pack.frozen.dirs.find((d) => d.dir_id === ACTIVE_NA_DIR)?.current_state,
      "n_a",
      "Session Action + E1 authorize N/A; forged caller authority neither adds nor removes it",
    );
    assert.equal(pack.frozen.dirs.find((d) => d.dir_id === NORMAL_DIR)?.current_state, "known");

    const wire = await ensureSessionFrozenForDelivery(s, { trigger: "pre_delivery_safety", now: NOW });
    assert.ok(wire.ok && !("skipped" in wire && wire.skipped), JSON.stringify(wire));
    const after = await durable(seed.sid);
    assert.equal(after.decision_context?.status, "final");
    assert.equal(stateOf(after, ACTIVE_NA_DIR), "n_a");
    assert.deepEqual(after.decision_context?.reality_facts, factsBefore, "N/A does not upgrade facts");
  });

  await check("E2-F1 authority source: Freeze NaValidation reads Session actions / E1 / ACTIVE catalog only", async () => {
    const seed = await seedNaDraftSession("e2src", NOW);
    const s = await durable(seed.sid);
    const dc = s.decision_context;
    assert.ok(dc);
    const ctx = buildFreezeNaValidationFromSession(s, dc, { now: NOW });
    assert.deepEqual(ctx.naDeclarationActions, s.na_declaration_actions);
    assert.deepEqual(ctx.confirmationEvents, s.confirmation_events);
    const { DIR_NA_CATALOG_V1_ENTRIES } = await import(
      "../lib/poju/decision-context/catalog/dir-na-catalog.v1"
    );
    assert.strictEqual(ctx.dirCatalog, DIR_NA_CATALOG_V1_ENTRIES, "ACTIVE catalog object, not a caller list");
  });

  await check("E2-F1 E1 required: same triad without the Session E1 for the N/A fact → frozen DIR not n_a", async () => {
    const seed = await seedNaDraftSession("e2noe1", NOW);
    await mutatePOJUSession(seed.sid, {
      operation_id: "op_s8_e2_drop_e1",
      kind: "session_patch",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        confirmation_events: (latest.confirmation_events ?? []).filter(
          (e) => !("fact_id" in e) || e.fact_id !== seed.naFactId,
        ),
      }),
    });
    const s = await durable(seed.sid);
    const dc = s.decision_context;
    assert.ok(dc);
    assert.ok((s.na_declaration_actions ?? []).length === 1, "Session Action still present");
    const pack = freezeDraftForDelivery(structuredClone(dc), { session: s, now: NOW });
    assert.notEqual(pack.frozen.dirs.find((d) => d.dir_id === ACTIVE_NA_DIR)?.current_state, "n_a");
  });

  console.log(`\nS8 freeze-persist-disclose done. PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
