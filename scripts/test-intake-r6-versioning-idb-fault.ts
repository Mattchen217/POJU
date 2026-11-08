/**
 * S8-D — Versioning (V1 final → V2 draft) under a real IndexedDB write failure.
 *
 * V1 is frozen through production (seed fixture → ensureSessionFrozenForDelivery).
 * The fault is storage-level only: the C1 blob write's IndexedDB transaction is
 * aborted (scripts/fixtures/idb-storage-fault). persistV2FromFinalOnSession,
 * commitDecisionContextChange, applyDcToWorking and casWritePOJUSession all run
 * unmodified; no return value is mocked, no authority is overridden.
 *
 *   pnpm test:intake-r6-versioning-idb-fault
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { withIdbWriteFault } from "./fixtures/idb-storage-fault";
import { ACTIVE_NA_DIR, NORMAL_DIR, seedNaDraftSession } from "./fixtures/intake-r6-na-seed";
import type { DecisionContext, RealityFact } from "../lib/poju/decision-context/types";
import type { POJUSessionState } from "../lib/poju/types";

installIntakeR6TestGlobals("dev_intake_r6_s8_versioning");

const NOW = "2026-11-08T11:00:00.000Z";
const V2_NOW = "2026-11-08T12:00:00.000Z";
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
  console.log("intake-r6-versioning-idb-fault (S8-D)");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { loadPOJUSession, commitDecisionContextChange } = await import(
    "../lib/poju/session-manager"
  );
  const { ensureSessionFrozenForDelivery } = await import(
    "../lib/poju/decision-context/production-freeze-wire"
  );
  const { applyV2FromFinalToSession, persistV2FromFinalOnSession, v2IdempotencyKey } =
    await import("../lib/poju/decision-context/production-versioning");
  const { applyDcToWorking } = await import("../lib/poju/decision-context/persist");

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  async function durable(sid: string): Promise<POJUSessionState> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `session ${sid} not loadable`);
    return s;
  }

  /** Seed + production freeze → V1 final, reloaded from IndexedDB. */
  async function v1FinalSession(tag: string): Promise<POJUSessionState> {
    const { sid } = await seedNaDraftSession(tag, NOW);
    const draft = await durable(sid);
    const frozen = await ensureSessionFrozenForDelivery(draft, { trigger: "pre_delivery_safety", now: NOW });
    assert.equal(frozen.ok, true, JSON.stringify(frozen));
    assert.ok(!("skipped" in frozen && frozen.skipped), JSON.stringify(frozen));
    const v1 = await durable(sid);
    assert.equal(v1.decision_context?.status, "final");
    assert.ok(v1.decision_context?.content_hash);
    assert.equal(
      v1.decision_context?.dirs.find((d) => d.dir_id === ACTIVE_NA_DIR)?.current_state,
      "n_a",
    );
    return v1;
  }

  function versionState(s: POJUSessionState) {
    return {
      decision_context: s.decision_context,
      decision_context_versions: s.decision_context_versions ?? [],
      decision_context_idempotency_keys: s.decision_context_idempotency_keys ?? [],
      session_revision: s.session_revision,
      dc_write_revision: s.dc_write_revision,
    };
  }

  const supplement: RealityFact = {
    fact_id: "f_v2_supplement",
    statement: "supplement after delivery",
    status: "unverified",
    verification_level: "user_asserted",
    source_stage: "user_supplement",
    source_turn_id: "t_v2",
    user_confirmed: false,
    fact_roles: ["situation"],
    related_dir_ids: [NORMAL_DIR],
  };
  const v2Opts = {
    now: V2_NOW,
    add_facts: [supplement],
    affected_dir_ids: [NORMAL_DIR],
  };

  function finalDcOf(s: POJUSessionState): DecisionContext {
    assert.ok(s.decision_context, "Decision Context missing");
    return s.decision_context;
  }

  await check("D0 precondition: V1 final + V2 opens normally (draft v2, V1 snapshot superseded, hash intact)", async () => {
    const v1 = await v1FinalSession("d0");
    const v1Hash = finalDcOf(v1).content_hash;
    const v1Version = finalDcOf(v1).version;
    const r = await persistV2FromFinalOnSession(v1, v2Opts);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.ok(r.ok && !("skipped" in r && r.skipped));
    const after = await durable(v1.session_id);
    assert.equal(after.decision_context?.status, "draft");
    assert.equal(after.decision_context?.version, v1Version + 1);
    const snapV1 = (after.decision_context_versions ?? []).find((v) => v.version === v1Version);
    assert.equal(snapV1?.status, "superseded");
    assert.equal(snapV1?.content_hash, v1Hash);
  });

  await check("D1 C1 write aborted → ok:false (not idempotent_skip); caller Session unchanged; reload: V1 content+hash intact, no V2 draft, no superseded, no V2 key; retry commits", async () => {
    const v1 = await v1FinalSession("d1");
    const v1Clone = structuredClone(v1);
    const idbBefore = versionState(v1);
    const v1Dc = finalDcOf(v1);
    const v2Key = v2IdempotencyKey(v1, v1Dc, v1Dc.version + 1);

    const { value: r, hits } = await withIdbWriteFault(SESSION_STORE, () =>
      persistV2FromFinalOnSession(v1, v2Opts),
    );
    assert.equal(hits, 1, "storage fault must hit the C1 write exactly once");
    assert.equal(r.ok, false, JSON.stringify(r));
    if (r.ok) throw new Error("expected ok:false");
    assert.notEqual(r.reason, "idempotent_skip");
    assert.match(r.reason, /Abort/);
    assert.strictEqual(r.session, v1, "caller Session returned as-is");
    assert.deepEqual(v1, v1Clone, "caller Session object not mutated");

    const reloaded = await durable(v1.session_id);
    assert.deepEqual(versionState(reloaded), idbBefore, "IndexedDB V1 state unchanged");
    assert.equal(reloaded.decision_context?.status, "final");
    assert.equal(reloaded.decision_context?.version, v1Dc.version);
    assert.equal(reloaded.decision_context?.content_hash, v1Dc.content_hash);
    const all = [reloaded.decision_context, ...(reloaded.decision_context_versions ?? [])];
    assert.equal(all.some((d) => d?.version === v1Dc.version + 1), false, "no half-built V2 anywhere");
    assert.equal(
      (reloaded.decision_context_versions ?? []).some((d) => d.status === "superseded"),
      false,
      "V1 must not be marked superseded",
    );
    assert.equal((reloaded.decision_context_idempotency_keys ?? []).includes(v2Key), false);

    const retry = await persistV2FromFinalOnSession(reloaded, v2Opts);
    assert.equal(retry.ok, true, JSON.stringify(retry));
    assert.ok(retry.ok && !("skipped" in retry && retry.skipped), "retry must commit, not idempotent_skip");
    if (retry.ok && !("skipped" in retry && retry.skipped)) assert.equal(retry.idempotency_key, v2Key);
    const committed = await durable(v1.session_id);
    assert.equal(committed.decision_context?.version, v1Dc.version + 1);
    assert.equal(committed.decision_context?.status, "draft");
    assert.ok((committed.decision_context_idempotency_keys ?? []).includes(v2Key));
    const snapV1 = (committed.decision_context_versions ?? []).find((v) => v.version === v1Dc.version);
    assert.equal(snapV1?.status, "superseded");
    assert.equal(snapV1?.content_hash, v1Dc.content_hash);
  });

  await check("D2 commitDecisionContextChange + applyDcToWorking under the same fault → rolled_back, memory = snapshot, no process-local key (retry not skipped)", async () => {
    const v1 = await v1FinalSession("d2");
    const idbBefore = versionState(v1);
    const applied = applyV2FromFinalToSession(v1, { now: V2_NOW });
    const key = `s8_d2_direct:${v1.session_id}`;
    const commitArgs = {
      session: v1,
      idempotency_key: key,
      now: V2_NOW,
      require_control_plane: false,
      apply: (tx: Parameters<typeof applyDcToWorking>[0]) => {
        applyDcToWorking(tx, applied.draft, applied.session.decision_context_versions ?? []);
      },
    };
    const { value: c, hits } = await withIdbWriteFault(SESSION_STORE, () =>
      commitDecisionContextChange(commitArgs),
    );
    assert.equal(hits, 1);
    assert.equal(c.committed, false);
    assert.equal(c.rolled_back, true);
    assert.equal(c.idempotent_skip, false);
    assert.deepEqual(c.session.decision_context, v1.decision_context);
    assert.deepEqual(c.session.decision_context_versions, v1.decision_context_versions);
    assert.deepEqual(versionState(await durable(v1.session_id)), idbBefore);

    const retry = await commitDecisionContextChange({ ...commitArgs, session: await durable(v1.session_id) });
    assert.equal(retry.idempotent_skip, false, "failed commit must not leave a process-local key");
    assert.equal(retry.committed, true);
    assert.equal((await durable(v1.session_id)).decision_context?.version, finalDcOf(v1).version + 1);
  });

  console.log(`\nS8 versioning-idb-fault done. PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
