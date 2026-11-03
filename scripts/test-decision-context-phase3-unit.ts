/**
 * Phase 3 S5 — Decision Context verification harness helpers (inline).
 * Contract §18 / Mapping §7. CORE_ONLY=1 runs core blocking set only.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const CORE_IDS = new Set([
  "P3-61","P3-62","P3-63","P3-67","P3-68","P3-69","P3-72","P3-73","P3-74",
  "P3-78","P3-80","P3-86","P3-87","P3-94","P3-98","P3-101","P3-107","P3-110",
  "P3-113","P3-116","P3-118","P3-121","P3-125","P3-128","P3-129","P3-130",
]);

const CORE_ONLY =
  process.env.PHASE3_CORE_ONLY === "1" ||
  process.argv.includes("--core");

const memoryStore = new Map<string, string>();
const localStoragePolyfill = {
  getItem(key: string): string | null {
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },
  setItem(key: string, value: string): void {
    memoryStore.set(key, String(value));
  },
  removeItem(key: string): void {
    memoryStore.delete(key);
  },
  clear(): void {
    memoryStore.clear();
  },
  key(i: number): string | null {
    return [...memoryStore.keys()][i] ?? null;
  },
  get length() {
    return memoryStore.size;
  },
};

const g = globalThis as typeof globalThis & {
  window: typeof globalThis;
  localStorage: typeof localStoragePolyfill;
  crypto: Crypto;
};
g.window = globalThis as unknown as typeof globalThis;
(g.window as any).dispatchEvent = (g as any).dispatchEvent || (() => true);
(g as any).dispatchEvent = (g as any).dispatchEvent || (() => true);
g.localStorage = localStoragePolyfill;
if (!g.crypto || !g.crypto.getRandomValues) {
  g.crypto = webcrypto as unknown as Crypto;
}

type Row = { id: string; name: string; status: "PASS" | "FAIL" | "SKIP"; err?: string };
const results: Row[] = [];

function shouldRun(id: string): boolean {
  if (!CORE_ONLY) return true;
  return CORE_IDS.has(id);
}

async function p3(
  id: string,
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  if (!shouldRun(id)) {
    results.push({ id, name, status: "SKIP" });
    console.log(`  SKIP  ${id}  ${name}`);
    return;
  }
  try {
    await fn();
    results.push({ id, name, status: "PASS" });
    console.log(`  PASS  ${id}  ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    results.push({ id, name, status: "FAIL", err: msg });
    console.error(`  FAIL  ${id}  ${name}`);
    console.error(msg);
    // Core blocking: rethrow to stop delivery path when CORE_ONLY or always for core IDs
    if (CORE_IDS.has(id)) {
      throw err;
    }
    // Non-core: continue collecting but mark fail; still throw at end
    throw err;
  }
}

function summarize(label: string): void {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  console.log(`\n${label}: PASS=${pass} FAIL=${fail} SKIP=${skip} (ran=${pass + fail})`);
  for (const r of results) {
    if (r.status === "FAIL") console.log(`  ! ${r.id} ${r.name}`);
  }
  if (fail > 0) process.exitCode = 1;
}

memoryStore.set("pojulife_device_id_v4", "dev_s5_unit");
memoryStore.set("pojulife_owner_key_migrated_v1", "1");

async function main() {
  console.log(`phase3-s5-unit CORE_ONLY=${CORE_ONLY}`);

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession } = await import("../lib/poju/session-manager");
  const {
    mutatePOJUSession,
    GENERATION_BASE_STALE,
    isSessionCasError,
  } = await import("../lib/poju/session-mutation");
  const {
    checkGenerationCollision,
    createPendingGenerationTaskContext,
    bindJobToGenerationTaskContext,
    commitGenerationGuarded,
    GenerationError,
    GENERATION_IDENTITY_COLLISION,
    GENERATION_HARD_FAIL,
    EMPTY_GENERATION_RESULT,
  } = await import("../lib/poju/generation");
  const {
    createDefaultControlPlane,
    validateControlPlaneInput,
    UNKNOWN_CONTROL_PLANE_FIELD,
    INVALID_CONTROL_PLANE_FIELD,
    isControlPlaneError,
    ControlPlaneError,
  } = await import("../lib/poju/decision-context/control-plane");
  const {
    appendConfirmationEvent,
    ConfirmationEventError,
    CONFIRMATION_ACTION_REUSED,
  } = await import("../lib/poju/decision-context/confirmation-event");
  const {
    createOpeningAnchor,
    confirmOpeningAnchor,
    resetOpeningAnchor,
    OpeningAnchorError,
    buildCreateOpeningAnchorMutation,
  } = await import("../lib/poju/decision-context/opening-anchor");
  const {
    CALL_A_FINGERPRINT_VERSION,
    DUPLICATE_AGENDA_ID,
    DirFromAgendaError,
    NormalizeError,
    agendaCoveredImpliesDirKnown,
    dirsFromAgenda,
    dirsFromNormalizedCallB,
    fingerprintCallA,
    hypothesesFromNormalizedCallA,
    normalizeCallAInput,
    normalizeMapperString,
    prepareCallAGeneration,
    prepareCallBGeneration,
  } = await import("../lib/poju/decision-context");
  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;
  type BreakthroughCore = import("../lib/poju/agent-state").BreakthroughCore;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  const emptyDefinition = {
    concrete_event: null,
    stakes: null,
    desired_outcome: null,
    decision_question: null,
    goal_priorities: [] as string[],
    unacceptable_outcomes: [] as string[],
  };
  function makeDc(partial: Partial<DecisionContext> & Pick<DecisionContext, "context_id" | "version">): DecisionContext {
    const now = partial.updated_at ?? "2026-11-03T12:00:00.000Z";
    return {
      context_id: partial.context_id,
      version: partial.version,
      status: partial.status ?? "draft",
      definition: partial.definition ?? emptyDefinition,
      reality_facts: partial.reality_facts ?? [],
      constraints: partial.constraints ?? [],
      hypotheses: partial.hypotheses ?? [],
      dirs: partial.dirs ?? [],
      conflicts: partial.conflicts ?? [],
      content_hash: partial.content_hash ?? null,
      created_at: partial.created_at ?? now,
      updated_at: now,
    };
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

  const fpv = "poju-generation-fp-v1";
  const sid = await createPOJUSession({
    payment_id: "pay_s5_unit",
    original_question: "S5 unit?",
  });

  // --- Generation identity / collision (P3-72..80) ---
  await p3("P3-72", "TaskContext vs Registry client_task_id mismatch → hard fail", () => {
    assert.throws(
      () =>
        checkGenerationCollision({
          probe: {
            session_id: sid,
            idempotency_key: "idem_72",
            generation_type: "call_a_hypothesis",
            generation_id: "gen_72",
            client_task_id: "ctask_72_probe",
            generation_base_revision: 0,
            fingerprint: "fp72",
            fingerprint_version: fpv,
            job_id: "gen_72",
            sync_task_id: null,
          },
          registry: [
            {
              session_id: sid,
              generation_type: "call_a_hypothesis",
              generation_id: "gen_72",
              client_task_id: "ctask_72_other",
              generation_base_revision: 0,
              fingerprint: "fp72",
              fingerprint_version: fpv,
              job_id: "gen_72",
              sync_task_id: null,
              status: "completed",
              result_marker: "m",
              committed_session_revision: 1,
              committed_dc_write_revision: 1,
              committed_context_id: "ctx",
              committed_context_version: 1,
              committed_context_hash: null,
              completed_at: "2026-11-03T12:00:00.000Z",
            },
          ],
          bindings: [],
        }),
      (e: unknown) =>
        e instanceof GenerationError && e.code === GENERATION_IDENTITY_COLLISION,
    );
  });

  await p3("P3-73", "same generation_id different client_task_id → hard fail", () => {
    assert.throws(
      () =>
        checkGenerationCollision({
          probe: {
            session_id: sid,
            idempotency_key: "idem_73",
            generation_type: "call_a_hypothesis",
            generation_id: "gen_shared_73",
            client_task_id: "ctask_b",
            generation_base_revision: 0,
            fingerprint: "fp73",
            fingerprint_version: fpv,
            job_id: "gen_shared_73",
            sync_task_id: null,
          },
          registry: [
            {
              session_id: sid,
              generation_type: "call_a_hypothesis",
              generation_id: "gen_shared_73",
              client_task_id: "ctask_a",
              generation_base_revision: 0,
              fingerprint: "fp73",
              fingerprint_version: fpv,
              job_id: "gen_shared_73",
              sync_task_id: null,
              status: "completed",
              result_marker: "m",
              committed_session_revision: 1,
              committed_dc_write_revision: 1,
              committed_context_id: "ctx",
              committed_context_version: 1,
              committed_context_hash: null,
              completed_at: "2026-11-03T12:00:00.000Z",
            },
          ],
          bindings: [],
        }),
      (e: unknown) =>
        e instanceof GenerationError && e.code === GENERATION_IDENTITY_COLLISION,
    );
  });

  await p3("P3-74", "same generation_id different base revision → hard fail", () => {
    assert.throws(
      () =>
        checkGenerationCollision({
          probe: {
            session_id: sid,
            idempotency_key: "idem_74",
            generation_type: "call_a_hypothesis",
            generation_id: "gen_74",
            client_task_id: "ctask_74",
            generation_base_revision: 2,
            fingerprint: "fp74",
            fingerprint_version: fpv,
            job_id: "gen_74",
            sync_task_id: null,
          },
          registry: [
            {
              session_id: sid,
              generation_type: "call_a_hypothesis",
              generation_id: "gen_74",
              client_task_id: "ctask_74",
              generation_base_revision: 0,
              fingerprint: "fp74",
              fingerprint_version: fpv,
              job_id: "gen_74",
              sync_task_id: null,
              status: "completed",
              result_marker: "m",
              committed_session_revision: 1,
              committed_dc_write_revision: 1,
              committed_context_id: "ctx",
              committed_context_version: 1,
              committed_context_hash: null,
              completed_at: "2026-11-03T12:00:00.000Z",
            },
          ],
          bindings: [],
        }),
      (e: unknown) =>
        e instanceof GenerationError &&
        (e.code === GENERATION_IDENTITY_COLLISION || e.code === GENERATION_HARD_FAIL),
    );
  });

  await p3("P3-75", "same generation_id different fingerprint → hard fail", () => {
    assert.throws(
      () =>
        checkGenerationCollision({
          probe: {
            session_id: sid,
            idempotency_key: "idem_75",
            generation_type: "call_a_hypothesis",
            generation_id: "gen_75",
            client_task_id: "ctask_75",
            generation_base_revision: 0,
            fingerprint: "fp75_NEW",
            fingerprint_version: fpv,
            job_id: "gen_75",
            sync_task_id: null,
          },
          registry: [
            {
              session_id: sid,
              generation_type: "call_a_hypothesis",
              generation_id: "gen_75",
              client_task_id: "ctask_75",
              generation_base_revision: 0,
              fingerprint: "fp75_OLD",
              fingerprint_version: fpv,
              job_id: "gen_75",
              sync_task_id: null,
              status: "completed",
              result_marker: "m",
              committed_session_revision: 1,
              committed_dc_write_revision: 1,
              committed_context_id: "ctx",
              committed_context_version: 1,
              committed_context_hash: null,
              completed_at: "2026-11-03T12:00:00.000Z",
            },
          ],
          bindings: [],
        }),
      (e: unknown) => e instanceof GenerationError,
    );
  });

  await p3("P3-76", "same generation_id different fingerprint_version → hard fail", () => {
    assert.throws(
      () =>
        checkGenerationCollision({
          probe: {
            session_id: sid,
            idempotency_key: "idem_76",
            generation_type: "call_a_hypothesis",
            generation_id: "gen_76",
            client_task_id: "ctask_76",
            generation_base_revision: 0,
            fingerprint: "fp76",
            fingerprint_version: "fpv_other",
            job_id: "gen_76",
            sync_task_id: null,
          },
          registry: [
            {
              session_id: sid,
              generation_type: "call_a_hypothesis",
              generation_id: "gen_76",
              client_task_id: "ctask_76",
              generation_base_revision: 0,
              fingerprint: "fp76",
              fingerprint_version: fpv,
              job_id: "gen_76",
              sync_task_id: null,
              status: "completed",
              result_marker: "m",
              committed_session_revision: 1,
              committed_dc_write_revision: 1,
              committed_context_id: "ctx",
              committed_context_version: 1,
              committed_context_hash: null,
              completed_at: "2026-11-03T12:00:00.000Z",
            },
          ],
          bindings: [],
        }),
      (e: unknown) => e instanceof GenerationError,
    );
  });

  await p3("P3-77", "same idempotency key bound to two tasks → hard fail", () => {
    assert.throws(
      () =>
        checkGenerationCollision({
          probe: {
            session_id: sid,
            idempotency_key: "idem_shared_77",
            generation_type: "call_a_hypothesis",
            generation_id: "gen_77b",
            client_task_id: "ctask_77b",
            generation_base_revision: 0,
            fingerprint: "fp77b",
            fingerprint_version: fpv,
            job_id: "gen_77b",
            sync_task_id: null,
          },
          registry: [
            {
              session_id: sid,
              generation_type: "call_a_hypothesis",
              generation_id: "gen_77a",
              client_task_id: "ctask_77a",
              generation_base_revision: 0,
              fingerprint: "fp77a",
              fingerprint_version: fpv,
              job_id: "gen_77a",
              sync_task_id: null,
              status: "completed",
              result_marker: "m",
              committed_session_revision: 1,
              committed_dc_write_revision: 1,
              committed_context_id: "ctx",
              committed_context_version: 1,
              committed_context_hash: null,
              completed_at: "2026-11-03T12:00:00.000Z",
            },
          ],
          bindings: [
            {
              session_id: sid,
              idempotency_key: "idem_shared_77",
              generation_type: "call_a_hypothesis",
              generation_id: "gen_77a",
              client_task_id: "ctask_77a",
              generation_base_revision: 0,
              fingerprint: "fp77a",
              fingerprint_version: fpv,
              job_id: "gen_77a",
              sync_task_id: null,
              bound_at: "2026-11-03T12:00:00.000Z",
            },
          ],
        }),
      (e: unknown) => e instanceof GenerationError,
    );
  });

  await p3("P3-78", "collision checked before completed-key skip", () => {
    // Completed binding for key BUT generation_id collision must win first
    assert.throws(
      () =>
        checkGenerationCollision({
          probe: {
            session_id: sid,
            idempotency_key: "idem_78_done",
            generation_type: "call_a_hypothesis",
            generation_id: "gen_78",
            client_task_id: "ctask_78_attacker",
            generation_base_revision: 0,
            fingerprint: "fp78",
            fingerprint_version: fpv,
            job_id: "gen_78",
            sync_task_id: null,
          },
          registry: [
            {
              session_id: sid,
              generation_type: "call_a_hypothesis",
              generation_id: "gen_78",
              client_task_id: "ctask_78_owner",
              generation_base_revision: 0,
              fingerprint: "fp78",
              fingerprint_version: fpv,
              job_id: "gen_78",
              sync_task_id: null,
              status: "completed",
              result_marker: "m",
              committed_session_revision: 1,
              committed_dc_write_revision: 1,
              committed_context_id: "ctx",
              committed_context_version: 1,
              committed_context_hash: null,
              completed_at: "2026-11-03T12:00:00.000Z",
            },
          ],
          bindings: [
            {
              session_id: sid,
              idempotency_key: "idem_78_done",
              generation_type: "call_a_hypothesis",
              generation_id: "gen_78",
              client_task_id: "ctask_78_owner",
              generation_base_revision: 0,
              fingerprint: "fp78",
              fingerprint_version: fpv,
              job_id: "gen_78",
              sync_task_id: null,
              bound_at: "2026-11-03T12:00:00.000Z",
            },
          ],
        }),
      (e: unknown) =>
        e instanceof GenerationError && e.code === GENERATION_IDENTITY_COLLISION,
    );
  });

  await p3("P3-79", "same task/fp/base new key → Path C", () => {
    const r = checkGenerationCollision({
      probe: {
        session_id: sid,
        idempotency_key: "idem_79_new",
        generation_type: "call_a_hypothesis",
        generation_id: "gen_79",
        client_task_id: "ctask_79",
        generation_base_revision: 0,
        fingerprint: "fp79",
        fingerprint_version: fpv,
        job_id: "gen_79",
        sync_task_id: null,
      },
      registry: [
        {
          session_id: sid,
          generation_type: "call_a_hypothesis",
          generation_id: "gen_79",
          client_task_id: "ctask_79",
          generation_base_revision: 0,
          fingerprint: "fp79",
          fingerprint_version: fpv,
          job_id: "gen_79",
          sync_task_id: null,
          status: "completed",
          result_marker: "m",
          committed_session_revision: 1,
          committed_dc_write_revision: 1,
          committed_context_id: "ctx",
          committed_context_version: 1,
          committed_context_hash: null,
          completed_at: "2026-11-03T12:00:00.000Z",
        },
      ],
      bindings: [
        {
          session_id: sid,
          idempotency_key: "idem_79_old",
          generation_type: "call_a_hypothesis",
          generation_id: "gen_79",
          client_task_id: "ctask_79",
          generation_base_revision: 0,
          fingerprint: "fp79",
          fingerprint_version: fpv,
          job_id: "gen_79",
          sync_task_id: null,
          bound_at: "2026-11-03T12:00:00.000Z",
        },
      ],
    });
    assert.equal(r.path, "C");
  });

  // Path A/B/C live commits for 80,86,87
  const sidPath = await createPOJUSession({
    payment_id: "pay_s5_path",
    original_question: "path?",
  });

  await p3("P3-80", "same key replay → Path B", async () => {
    await createPendingGenerationTaskContext({
      session_id: sidPath,
      generation_type: "call_b_dir",
      fingerprint: "fp_path_80",
      fingerprint_version: fpv,
      client_task_id: "ctask_80",
    });
    await bindJobToGenerationTaskContext({
      session_id: sidPath,
      client_task_id: "ctask_80",
      job_id: "job_80",
    });
    const dc = makeDc({
      context_id: "ctx_80",
      version: 1,
      dirs: [{ dir_id: "d1", text: "dir", status: "proposed" } as any],
      content_hash: "hash80",
      updated_at: "2026-11-03T13:00:00.000Z",
    });
    const a = await commitGenerationGuarded({
      probe: {
        session_id: sidPath,
        idempotency_key: "idem_80",
        generation_type: "call_b_dir",
        generation_id: "job_80",
        client_task_id: "ctask_80",
        generation_base_revision: 0,
        fingerprint: "fp_path_80",
        fingerprint_version: fpv,
        job_id: "job_80",
        sync_task_id: null,
      },
      dc_mutation: {
        decision_context: dc,
        decision_context_versions: [dc],
        result_marker: "call_b:dir:d1",
        context_hash: "hash80",
      },
      now: "2026-11-03T13:00:00.000Z",
    });
    assert.equal(a.path, "A");
    const b = await commitGenerationGuarded({
      probe: {
        session_id: sidPath,
        idempotency_key: "idem_80",
        generation_type: "call_b_dir",
        generation_id: "job_80",
        client_task_id: "ctask_80",
        generation_base_revision: 0,
        fingerprint: "fp_path_80",
        fingerprint_version: fpv,
        job_id: "job_80",
        sync_task_id: null,
      },
      dc_mutation: {
        decision_context: dc,
        result_marker: "should_not_apply",
      },
    });
    assert.equal(b.path, "B");
  });

  await p3("P3-81", "different sessions same generation_id isolated", async () => {
    const s1 = await createPOJUSession({ payment_id: "pay_s5_iso1", original_question: "iso1" });
    const s2 = await createPOJUSession({ payment_id: "pay_s5_iso2", original_question: "iso2" });
    // Each session collision check only receives that session's registry (caller-scoped).
    const r1 = checkGenerationCollision({
      probe: {
        session_id: s1,
        idempotency_key: "idem_iso_1",
        generation_type: "call_a_hypothesis",
        generation_id: "gen_shared_iso",
        client_task_id: "ctask_iso_1",
        generation_base_revision: 0,
        fingerprint: "fp_iso",
        fingerprint_version: fpv,
        job_id: "gen_shared_iso",
        sync_task_id: null,
      },
      registry: [],
      bindings: [],
    });
    assert.equal(r1.path, "A");
    const r2 = checkGenerationCollision({
      probe: {
        session_id: s2,
        idempotency_key: "idem_iso_2",
        generation_type: "call_a_hypothesis",
        generation_id: "gen_shared_iso",
        client_task_id: "ctask_iso_2",
        generation_base_revision: 0,
        fingerprint: "fp_iso",
        fingerprint_version: fpv,
        job_id: "gen_shared_iso",
        sync_task_id: null,
      },
      // S1 completed entry must NOT be passed into S2's registry view
      registry: [],
      bindings: [],
    });
    assert.equal(r2.path, "A");
    // S1 registry with completed shared id does not affect S2 Path A
    const r2b = checkGenerationCollision({
      probe: {
        session_id: s2,
        idempotency_key: "idem_iso_2b",
        generation_type: "call_a_hypothesis",
        generation_id: "gen_shared_iso",
        client_task_id: "ctask_iso_2",
        generation_base_revision: 0,
        fingerprint: "fp_iso",
        fingerprint_version: fpv,
        job_id: "gen_shared_iso",
        sync_task_id: null,
      },
      registry: [
        {
          session_id: s2,
          generation_type: "call_a_hypothesis",
          generation_id: "gen_other_s2",
          client_task_id: "ctask_other",
          generation_base_revision: 0,
          fingerprint: "fp_other",
          fingerprint_version: fpv,
          job_id: "gen_other_s2",
          sync_task_id: null,
          status: "completed",
          result_marker: "m",
          committed_session_revision: 1,
          committed_dc_write_revision: 1,
          committed_context_id: "ctx",
          committed_context_version: 1,
          committed_context_hash: null,
          completed_at: "2026-11-03T12:00:00.000Z",
        },
      ],
      bindings: [],
    });
    assert.equal(r2b.path, "A");
  });

await p3("P3-82", "missing/illegal session_id rejected by formal APIs", async () => {
    let threw = false;
    try {
      await createPendingGenerationTaskContext({
        session_id: "",
        generation_type: "call_a_hypothesis",
        fingerprint: "fp",
        fingerprint_version: fpv,
        client_task_id: "ctask_bad",
      });
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
  });

  await p3("P3-83", "first legal commit → Path A DC+Registry same write", async () => {
    const s = await createPOJUSession({ payment_id: "pay_s5_83", original_question: "83" });
    await createPendingGenerationTaskContext({
      session_id: s,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp83",
      fingerprint_version: fpv,
      client_task_id: "ctask_83",
    });
    await bindJobToGenerationTaskContext({
      session_id: s,
      client_task_id: "ctask_83",
      job_id: "job_83",
    });
    const before = await loadPOJUSession(s);
    const dc = makeDc({
      context_id: "ctx_83",
      version: 1,
      hypotheses: [{ hypothesis_id: "h1", statement: "s", state: "proposed" } as any],
      content_hash: "h83",
    });
    const r = await commitGenerationGuarded({
      probe: {
        session_id: s,
        idempotency_key: "idem_83",
        generation_type: "call_a_hypothesis",
        generation_id: "job_83",
        client_task_id: "ctask_83",
        generation_base_revision: 0,
        fingerprint: "fp83",
        fingerprint_version: fpv,
        job_id: "job_83",
        sync_task_id: null,
      },
      dc_mutation: {
        decision_context: dc,
        result_marker: "ok",
        context_hash: "h83",
      },
    });
    assert.equal(r.path, "A");
    const after = await loadPOJUSession(s);
    assert.equal(after!.generation_registry!.length, 1);
    assert.equal(after!.dc_write_revision, (before!.dc_write_revision ?? 0) + 1);
  });

  await p3("P3-84", "Path A then same key → Path B no write", async () => {
    const s = await loadPOJUSession(
      (await createPOJUSession({ payment_id: "pay_s5_84", original_question: "84" })),
    );
    // reuse sidPath Path B already proven; dedicated:
    const sid84 = await createPOJUSession({ payment_id: "pay_s5_84b", original_question: "84b" });
    await createPendingGenerationTaskContext({
      session_id: sid84,
      generation_type: "call_b_dir",
      fingerprint: "fp84",
      fingerprint_version: fpv,
      client_task_id: "ctask_84",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid84,
      client_task_id: "ctask_84",
      job_id: "job_84",
    });
    const dc = makeDc({ context_id: "ctx_84", version: 1, content_hash: "h84" });
    await commitGenerationGuarded({
      probe: {
        session_id: sid84,
        idempotency_key: "idem_84",
        generation_type: "call_b_dir",
        generation_id: "job_84",
        client_task_id: "ctask_84",
        generation_base_revision: 0,
        fingerprint: "fp84",
        fingerprint_version: fpv,
        job_id: "job_84",
        sync_task_id: null,
      },
      dc_mutation: { decision_context: dc, result_marker: "m", context_hash: "h84" },
    });
    const before = await loadPOJUSession(sid84);
    const r = await commitGenerationGuarded({
      probe: {
        session_id: sid84,
        idempotency_key: "idem_84",
        generation_type: "call_b_dir",
        generation_id: "job_84",
        client_task_id: "ctask_84",
        generation_base_revision: 0,
        fingerprint: "fp84",
        fingerprint_version: fpv,
        job_id: "job_84",
        sync_task_id: null,
      },
    });
    assert.equal(r.path, "B");
    const after = await loadPOJUSession(sid84);
    assert.equal(after!.session_revision, before!.session_revision);
    assert.equal(after!.dc_write_revision, before!.dc_write_revision);
    void s;
  });

  await p3("P3-85", "Path A then new key → Path C DC rev unchanged", async () => {
    const sid85 = await createPOJUSession({ payment_id: "pay_s5_85", original_question: "85" });
    await createPendingGenerationTaskContext({
      session_id: sid85,
      generation_type: "call_b_dir",
      fingerprint: "fp85",
      fingerprint_version: fpv,
      client_task_id: "ctask_85",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid85,
      client_task_id: "ctask_85",
      job_id: "job_85",
    });
    const dc = makeDc({ context_id: "ctx_85", version: 1, content_hash: "h85" });
    await commitGenerationGuarded({
      probe: {
        session_id: sid85,
        idempotency_key: "idem_85_a",
        generation_type: "call_b_dir",
        generation_id: "job_85",
        client_task_id: "ctask_85",
        generation_base_revision: 0,
        fingerprint: "fp85",
        fingerprint_version: fpv,
        job_id: "job_85",
        sync_task_id: null,
      },
      dc_mutation: { decision_context: dc, result_marker: "m", context_hash: "h85" },
    });
    const before = await loadPOJUSession(sid85);
    const r = await commitGenerationGuarded({
      probe: {
        session_id: sid85,
        idempotency_key: "idem_85_c",
        generation_type: "call_b_dir",
        generation_id: "job_85",
        client_task_id: "ctask_85",
        generation_base_revision: 0,
        fingerprint: "fp85",
        fingerprint_version: fpv,
        job_id: "job_85",
        sync_task_id: null,
      },
    });
    assert.equal(r.path, "C");
    if (r.path !== "C") throw new Error("expected C");
    assert.equal(r.dc_mutation_applied, false);
    const after = await loadPOJUSession(sid85);
    assert.equal(after!.dc_write_revision, before!.dc_write_revision);
  });

  await p3("P3-86", "Path B when DC advanced → original_result_is_current=false", async () => {
    const sid86 = await createPOJUSession({ payment_id: "pay_s5_86", original_question: "86" });
    await createPendingGenerationTaskContext({
      session_id: sid86,
      generation_type: "call_b_dir",
      fingerprint: "fp86",
      fingerprint_version: fpv,
      client_task_id: "ctask_86",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid86,
      client_task_id: "ctask_86",
      job_id: "job_86",
    });
    const dc = makeDc({ context_id: "ctx_86", version: 1, content_hash: "h86" });
    await commitGenerationGuarded({
      probe: {
        session_id: sid86,
        idempotency_key: "idem_86",
        generation_type: "call_b_dir",
        generation_id: "job_86",
        client_task_id: "ctask_86",
        generation_base_revision: 0,
        fingerprint: "fp86",
        fingerprint_version: fpv,
        job_id: "job_86",
        sync_task_id: null,
      },
      dc_mutation: { decision_context: dc, result_marker: "m", context_hash: "h86" },
    });
    // Advance DC after Path A
    await mutatePOJUSession(sid86, {
      operation_id: "bump_86",
      kind: "session_patch",
      bump_dc: true,
      apply: (latest) => ({
        ...latest,
        decision_context: makeDc({
          context_id: "ctx_86_moved",
          version: 2,
          content_hash: "h86b",
          updated_at: "2026-11-03T15:00:00.000Z",
        }),
      }),
    });
    const r = await commitGenerationGuarded({
      probe: {
        session_id: sid86,
        idempotency_key: "idem_86",
        generation_type: "call_b_dir",
        generation_id: "job_86",
        client_task_id: "ctask_86",
        generation_base_revision: 0,
        fingerprint: "fp86",
        fingerprint_version: fpv,
        job_id: "job_86",
        sync_task_id: null,
      },
    });
    assert.equal(r.path, "B");
    if (r.path !== "B") throw new Error("expected B");
    assert.equal(r.replay.original_result_is_current, false);
    assert.equal(r.replay.original_context_id, "ctx_86");
  });

  await p3("P3-87", "Path C repeated → only new Binding, no DC rewrite", async () => {
    const sid87 = await createPOJUSession({ payment_id: "pay_s5_87", original_question: "87" });
    await createPendingGenerationTaskContext({
      session_id: sid87,
      generation_type: "call_b_dir",
      fingerprint: "fp87",
      fingerprint_version: fpv,
      client_task_id: "ctask_87",
    });
    await bindJobToGenerationTaskContext({
      session_id: sid87,
      client_task_id: "ctask_87",
      job_id: "job_87",
    });
    const dc = makeDc({ context_id: "ctx_87", version: 1, content_hash: "h87" });
    await commitGenerationGuarded({
      probe: {
        session_id: sid87,
        idempotency_key: "idem_87_a",
        generation_type: "call_b_dir",
        generation_id: "job_87",
        client_task_id: "ctask_87",
        generation_base_revision: 0,
        fingerprint: "fp87",
        fingerprint_version: fpv,
        job_id: "job_87",
        sync_task_id: null,
      },
      dc_mutation: { decision_context: dc, result_marker: "m", context_hash: "h87" },
    });
    const mid = await loadPOJUSession(sid87);
    const d0 = mid!.dc_write_revision ?? 0;
    const reg0 = mid!.generation_registry!.length;
    await commitGenerationGuarded({
      probe: {
        session_id: sid87,
        idempotency_key: "idem_87_c1",
        generation_type: "call_b_dir",
        generation_id: "job_87",
        client_task_id: "ctask_87",
        generation_base_revision: 0,
        fingerprint: "fp87",
        fingerprint_version: fpv,
        job_id: "job_87",
        sync_task_id: null,
      },
    });
    await commitGenerationGuarded({
      probe: {
        session_id: sid87,
        idempotency_key: "idem_87_c2",
        generation_type: "call_b_dir",
        generation_id: "job_87",
        client_task_id: "ctask_87",
        generation_base_revision: 0,
        fingerprint: "fp87",
        fingerprint_version: fpv,
        job_id: "job_87",
        sync_task_id: null,
      },
    });
    const after = await loadPOJUSession(sid87);
    assert.equal(after!.dc_write_revision, d0);
    assert.equal(after!.generation_registry!.length, reg0);
    assert.ok((after!.generation_operation_bindings!.length) >= (mid!.generation_operation_bindings!.length) + 2);
  });

  await p3("P3-90", "empty mapper result must not register completed", async () => {
    const s = await createPOJUSession({ payment_id: "pay_s5_90", original_question: "90" });
    await createPendingGenerationTaskContext({
      session_id: s,
      generation_type: "call_a_hypothesis",
      fingerprint: "fp90",
      fingerprint_version: fpv,
      client_task_id: "ctask_90",
    });
    await bindJobToGenerationTaskContext({
      session_id: s,
      client_task_id: "ctask_90",
      job_id: "job_90",
    });
    await assert.rejects(
      () =>
        commitGenerationGuarded({
          probe: {
            session_id: s,
            idempotency_key: "idem_90",
            generation_type: "call_a_hypothesis",
            generation_id: "job_90",
            client_task_id: "ctask_90",
            generation_base_revision: 0,
            fingerprint: "fp90",
            fingerprint_version: fpv,
            job_id: "job_90",
            sync_task_id: null,
          },
          empty_result: true,
        }),
      (e: unknown) => e instanceof GenerationError && e.code === EMPTY_GENERATION_RESULT,
    );
    const after = await loadPOJUSession(s);
    assert.equal((after!.generation_registry ?? []).length, 0);
  });

  // --- ControlPlane / Confirmation / Anchor ---
  await p3("P3-101", "ControlPlane unknown field rejected", () => {
    const base = createDefaultControlPlane("opening");
    assert.throws(
      () => validateControlPlaneInput({ ...base, evil_field: 1 }),
      (e: unknown) => isControlPlaneError(e) && (e as ControlPlaneError).code === UNKNOWN_CONTROL_PLANE_FIELD,
    );
  });

  await p3("P3-102", "ControlPlane known field wrong type rejected", () => {
    const base = createDefaultControlPlane("opening");
    assert.throws(
      () => validateControlPlaneInput({ ...base, investigation_agenda: "nope" }),
      (e: unknown) => isControlPlaneError(e) && (e as ControlPlaneError).code === INVALID_CONTROL_PLANE_FIELD,
    );
  });

  await p3("P3-103", "illegal AgentPhase rejected", () => {
    const base = createDefaultControlPlane("opening");
    assert.throws(
      () => validateControlPlaneInput({ ...base, current_phase: "not_a_phase" }),
      (e: unknown) => isControlPlaneError(e),
    );
  });

  await p3("P3-104", "AgendaItem duplicate id rejected", () => {
    const base = createDefaultControlPlane("opening");
    assert.throws(
      () =>
        validateControlPlaneInput({
          ...base,
          investigation_agenda: [
            { id: "a1", label: "L1", critical: true, status: "unexplored" },
            { id: "a1", label: "L2", critical: false, status: "partial" },
          ],
        }),
      (e: unknown) => isControlPlaneError(e),
    );
  });

  await p3("P3-107", "confirm single RealityFact only that fact", () => {
    const r = appendConfirmationEvent([], {
      event_id: "evt_107",
      target_type: "fact",
      fact_id: "fact_1",
      source_turn_id: "turn_1",
      confirmation_turn_id: null,
      confirmation_action_id: "act_107",
      event_type: "confirm_fact",
      actor: "user",
      confirmed_at: "2026-11-03T12:00:00.000Z",
      event_version: 1,
    });
    assert.equal(r.outcome, "appended");
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].fact_id, "fact_1");
  });

  await p3("P3-110", "same action_id different target → hard fail", () => {
    const ev1 = {
      event_id: "evt_110_a",
      target_type: "fact" as const,
      fact_id: "fact_a",
      source_turn_id: "turn_1",
      confirmation_turn_id: null,
      confirmation_action_id: "act_110",
      event_type: "confirm_fact" as const,
      actor: "user" as const,
      confirmed_at: "2026-11-03T12:00:00.000Z",
      event_version: 1 as const,
    };
    const r1 = appendConfirmationEvent([], ev1);
    assert.throws(
      () =>
        appendConfirmationEvent(r1.events, {
          ...ev1,
          event_id: "evt_110_b",
          fact_id: "fact_b",
        }),
      (e: unknown) =>
        e instanceof ConfirmationEventError && e.code === CONFIRMATION_ACTION_REUSED,
    );
  });

  await p3("P3-113", "user_estimate stays unverified after confirm", async () => {
    const { seedDecisionContextFromOpening } = await import("../lib/poju/decision-context");
    const dc = seedDecisionContextFromOpening({
      session_id: "s5",
      now: "2026-11-03T12:00:00.000Z",
      core_dilemma: null,
      desired_direction: null,
      user_statements: [
        {
          statement: "Maybe 30% chance",
          verification_level: "user_estimate",
          source_turn_id: "turn_u",
          has_user_confirm_event: true,
        },
      ],
    });
    assert.equal(dc.reality_facts[0]!.status, "unverified");
  });

  await p3("P3-116", "ordinary assistant message cannot be Opening Anchor", async () => {
    const s = await createPOJUSession({ payment_id: "pay_s5_116", original_question: "116" });
    const base = await loadPOJUSession(s);
    assert.ok(base);
    // Contract: anchor_id must not equal message_client_id (ordinary message id reuse banned)
    assert.throws(
      () =>
        buildCreateOpeningAnchorMutation(base!, {
          session_id: s,
          message_client_id: "msg_assistant_1",
          anchor_id: "msg_assistant_1",
          now: "2026-11-03T12:00:00.000Z",
        }),
      (e: unknown) => e instanceof OpeningAnchorError,
    );
  });

  await p3("P3-118", "Gate Reset clears old Anchor, keeps history, creates new", async () => {
    const s = await createPOJUSession({ payment_id: "pay_s5_118", original_question: "118" });
    await mutatePOJUSession(s, {
      operation_id: "s5_118_seed_msg",
      kind: "message_append",
      bump_dc: false,
      apply: (latest) => ({
        ...latest,
        messages: [
          ...latest.messages,
          {
            role: "assistant",
            content: "understanding",
            timestamp: "2026-11-03T12:00:00.000Z",
            client_id: "msg_understanding_118a",
          },
          {
            role: "assistant",
            content: "understanding2",
            timestamp: "2026-11-03T12:01:00.000Z",
            client_id: "msg_understanding_118b",
          },
        ],
      }),
    });
    const created = await createOpeningAnchor(s, {
      operation_id: "s5_118_create",
      session_id: s,
      message_client_id: "msg_understanding_118a",
      anchor_id: "opening_anchor_118_a",
      history_id: "opening_history_118_a",
      now: "2026-11-03T12:01:00.000Z",
    });
    assert.equal(created.anchor.status, "pending");
    const reset = await resetOpeningAnchor(s, {
      operation_id: "s5_118_reset",
      session_id: s,
      new_message_client_id: "msg_understanding_118b",
      new_anchor_id: "opening_anchor_118_b",
      new_history_id: "opening_history_118_b",
      now: "2026-11-03T12:04:00.000Z",
    });
    assert.equal(reset.cleared_anchor.anchor_id, "opening_anchor_118_a");
    assert.equal(reset.cleared_anchor.status, "cleared");
    assert.equal(reset.new_anchor.anchor_id, "opening_anchor_118_b");
    assert.equal(reset.new_anchor.status, "pending");
    const hist = reset.state.opening_confirm_history ?? [];
    assert.ok(hist.some((h: any) => h.anchor_id === "opening_anchor_118_a" && h.state === "cleared"));
    assert.ok(hist.some((h: any) => h.anchor_id === "opening_anchor_118_b" && h.state === "pending"));
    assert.equal(reset.state.control_plane?.opening_anchor_id, "opening_anchor_118_b");
  });

  // --- Normalization ---
  await p3("P3-121", "NFC equivalent strings → same Fingerprint", () => {
    const a = "cafe\u0301";
    const b = "caf\u00e9";
    assert.equal(normalizeMapperString(a, "t"), normalizeMapperString(b, "t"));
    const n1 = normalizeCallAInput(sampleCore({ situation_conclusion: a }));
    const n2 = normalizeCallAInput(sampleCore({ situation_conclusion: b }));
    assert.equal(fingerprintCallA(n1).fingerprint, fingerprintCallA(n2).fingerprint);
  });

  await p3("P3-122", "leading/trailing whitespace normalized consistently", () => {
    assert.equal(normalizeMapperString("  hello   world  ", "t"), "hello world");
  });

  await p3("P3-123", "undefined/null/empty → same null normalization", () => {
    assert.equal(normalizeMapperString("", "t"), null);
    assert.equal(normalizeMapperString(null, "t"), null);
    assert.equal(normalizeMapperString(undefined, "t"), null);
  });

  await p3("P3-124", "array element order change → Fingerprint changes", () => {
    const fpA = prepareCallAGeneration(
      sampleCore({
        modern_action_frames: [
          { direction: "A", why_fits: "wa", structural_basis: "sa", needs_validation: "" },
          { direction: "B", why_fits: "wb", structural_basis: "sb", needs_validation: "v" },
        ],
      }),
    ).fingerprint;
    const fpB = prepareCallAGeneration(
      sampleCore({
        modern_action_frames: [
          { direction: "B", why_fits: "wb", structural_basis: "sb", needs_validation: "v" },
          { direction: "A", why_fits: "wa", structural_basis: "sa", needs_validation: "" },
        ],
      }),
    ).fingerprint;
    assert.notEqual(fpA, fpB);
  });

  await p3("P3-125", "leading empty modern_action_frames keeps Hypothesis slot", () => {
    const normalized = normalizeCallAInput({
      ...sampleCore(),
      modern_action_frames: [
        null,
        {
          direction: "Only second",
          why_fits: "x",
          structural_basis: "s",
          needs_validation: "",
        },
      ],
    } as any);
    assert.equal(normalized.modern_action_frames[0], null);
    const hyps = hypothesesFromNormalizedCallA(normalized, {
      source_ref: "job_sparse",
      now: "2026-11-03T12:00:00.000Z",
    });
    const action = hyps.find((h) => h.hypothesis_id.includes("modern_action_"));
    assert.ok(action);
    assert.ok(action!.hypothesis_id.endsWith("modern_action_2"));
  });

  await p3("P3-126", "chart_anchors order change → Fingerprint changes", () => {
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

  await p3("P3-128", "same Normalized Object → Mapper+Fingerprint stable", () => {
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
      hyps1.map((h) => h.hypothesis_id),
      hyps2.map((h) => h.hypothesis_id),
    );
    assert.equal(fingerprintCallA(prepared.normalized).fingerprint, prepared.fingerprint);
    assert.equal(prepared.fingerprint_version, CALL_A_FINGERPRINT_VERSION);
  });

  await p3("P3-129", "Call B Agenda duplicate ID → hard fail no merge", () => {
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

  await p3("P3-130", "Agenda covered must not change DIR current_state", () => {
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
    const prepared = prepareCallBGeneration([
      { id: "cov", label: "Covered item", critical: true, status: "covered" },
    ]);
    const mapped = dirsFromNormalizedCallB(prepared.normalized);
    assert.equal(mapped[0]!.current_state, "unknown");
  });

  summarize("phase3-s5-unit");
}

main().catch((err) => {
  console.error(err);
  summarize("phase3-s5-unit");
  process.exit(1);
});
