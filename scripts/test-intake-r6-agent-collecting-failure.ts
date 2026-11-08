/**
 * S8-C 閳?Collecting DC turn: persist / Ask failure handling.
 *
 * H: `runCollectingDcTurn` (the helper `handleUserMessage` calls) against real
 *    fake-indexeddb + production C1. Faults are bottom-level only:
 *      - storage: IndexedDB write 閳?transaction abort (scripts/fixtures/idb-storage-fault)
 *      - Ask: ACTIVE DIR N/A registry read throws, armed by the C1 write itself
 *        so it fires strictly after the DC commit (scripts/fixtures/dir-catalog-fault)
 * P: production call chain `handleUserMessage` 閳?helper, with only the
 *    `/api/poju/chat` fetch stubbed (no LLM, no network), plus the UI's
 *    follow-up `savePOJUSession` to prove no uncommitted DC is written outside C1.
 * S: static 閳?agent.ts reaches persist / Ask only through the helper.
 *
 *   pnpm test:intake-r6-agent-collecting-failure
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { armIdbWriteHook, withIdbWriteFault } from "./fixtures/idb-storage-fault";
import { armActiveCatalogFault, type CatalogFault } from "./fixtures/dir-catalog-fault";
import type { POJUSessionState } from "../lib/poju/types";

installIntakeR6TestGlobals("dev_intake_r6_s8_agent");
// handleUserMessage 閳?yieldToBrowserPaint uses rAF once `window` exists.
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

const NOW = "2026-11-08T10:00:00.000Z";
const TURN_NOW = "2026-11-08T10:05:00.000Z";
const TARGET_DIR = "DIR-DEF-UNACCEPTABLE";
const SESSION_STORE = "pojuSessionRecords";
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
  console.log("intake-r6-agent-collecting-failure (S8-C)");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { mutatePOJUSession } = await import("../lib/poju/session-mutation");
  const { runCollectingDcTurn } = await import("../lib/poju/collecting-dc-turn");
  const { handleUserMessage } = await import("../lib/poju/agent");
  const { createInitialAgentState } = await import("../lib/poju/agent-state");
  const { createDefaultControlPlane } = await import(
    "../lib/poju/decision-context/control-plane"
  );
  const { ACTIVE_DIR_NA_CATALOG_VERSION, loadDirNaCatalog } = await import(
    "../lib/poju/decision-context/catalog"
  );
  const { DIR_NA_CATALOG_V1_ENTRIES } = await import(
    "../lib/poju/decision-context/catalog/dir-na-catalog.v1"
  );
  const { selectNextIntakeAskForSession } = await import(
    "../lib/poju/decision-context/production-intake-ask"
  );
  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  const collectKey = (sid: string, turnId: string) => `dc_collect:${sid}:${turnId}`;

  function draftDc(ctxId: string): DecisionContext {
    return {
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
      reality_facts: [],
      constraints: [],
      hypotheses: [],
      dirs: [
        {
          dir_id: TARGET_DIR,
          need: "need",
          why: "why",
          required_fact_roles: ["situation"],
          current_state: "unknown",
          partial_satisfaction: false,
          agenda_item_ids: [],
          id_lifecycle: "active",
          may_affect_p5_ranking: true,
        },
      ],
      conflicts: [],
      content_hash: null,
      created_at: NOW,
      updated_at: NOW,
    };
  }

  /** IDB session in collecting_context with a draft DC and a prior real next-ask plan. */
  async function seedCollectingSession(tag: string): Promise<string> {
    const sid = await createPOJUSession({
      payment_id: `pay_s8c_${tag}`,
      original_question: "Should I leave my job for a startup offer?",
    });
    // Persist collecting shell first (sync CAS apply), then ask outside CAS.
    await mutatePOJUSession(sid, {
      operation_id: `op_seed_s8c_${tag}`,
      kind: "session_patch",
      bump_dc: true,
      apply: (latest): POJUSessionState => {
        const agent = createInitialAgentState({
          original_question: latest.original_question,
        });
        agent.current_phase = "collecting_context";
        agent.delivery_mode = "full";
        agent.stall_offer_pending = false;
        agent.core_dilemma = {
          concrete_event: "Startup offer vs current job",
          stakes: "Income stability",
          sticking_point: "Family depends on salary",
        };
        agent.desired_direction = { wants: "Keep optionality", priority: "reversibility" };
        return {
          ...latest,
          has_profile: true,
          agent_v2: agent,
          control_plane: createDefaultControlPlane("collecting_context"),
          decision_context: draftDc(`dc_${sid}`),
        };
      },
    });
    const seeded = await loadPOJUSession(sid);
    if (!seeded) throw new Error(`seed session missing: ${sid}`);
    const asked = await selectNextIntakeAskForSession({ session: seeded, nowIso: NOW });
    await mutatePOJUSession(sid, {
      operation_id: `op_seed_s8c_ask_${tag}`,
      kind: "session_patch",
      bump_dc: true,
      apply: () => asked.session,
    });
    return sid;
  }

  async function durable(sid: string): Promise<POJUSessionState> {
    const s = await loadPOJUSession(sid);
    assert.ok(s, `session ${sid} not loadable`);
    return s;
  }

  /** Persisted fields a failed turn must not touch. */
  function persistedDcState(s: POJUSessionState) {
    return {
      decision_context: s.decision_context,
      decision_context_versions: s.decision_context_versions ?? [],
      decision_context_idempotency_keys: s.decision_context_idempotency_keys ?? [],
      control_plane: s.control_plane,
      intake_ask_plan: s.intake_ask_plan ?? null,
      messages: s.messages,
      session_revision: s.session_revision,
      dc_write_revision: s.dc_write_revision,
    };
  }

  const hasTurnFact = (s: POJUSessionState, turnId: string) =>
    (s.decision_context?.reality_facts ?? []).some((f) => f.source_turn_id === turnId);

  async function withCatalogFaultAfterNextSessionWrite<T>(
    fn: () => Promise<T>,
  ): Promise<{ value: T; catalogHits: number; writeHits: number }> {
    const armed: { fault: CatalogFault | null } = { fault: null };
    const hook = armIdbWriteHook(SESSION_STORE, () => {
      armed.fault = armActiveCatalogFault(ACTIVE_DIR_NA_CATALOG_VERSION, DIR_NA_CATALOG_V1_ENTRIES);
    });
    try {
      const value = await fn();
      return { value, catalogHits: armed.fault?.hits() ?? 0, writeHits: hook.hits() };
    } finally {
      hook.restore();
      armed.fault?.restore();
    }
  }

  // ============================================== H. helper
  console.log("\n== H. runCollectingDcTurn (real IDB + C1) ==");

  await check("H1 persist OK + Ask OK 閳?committed DC + fresh plan adopted; IDB == memory DC; input Session not mutated", async () => {
    const sid = await seedCollectingSession("h1");
    const before = await durable(sid);
    const beforeClone = structuredClone(before);
    const res = await runCollectingDcTurn(before, {
      statement: "Savings cover four months of expenses.",
      source_turn_id: "u_h1",
      now: TURN_NOW,
    });
    assert.equal(res.outcome, "dc_committed");
    assert.equal(res.persist_error, undefined);
    assert.equal(res.ask_planned, true);
    assert.equal(res.ask_error, undefined);
    assert.ok(hasTurnFact(res.session, "u_h1"));
    assert.ok(res.session.intake_ask_plan);
    assert.equal(res.session.intake_ask_plan.scored_at, TURN_NOW);
    assert.equal(before.intake_ask_plan?.scored_at, NOW);
    assert.deepEqual(before, beforeClone, "caller Session object must not be mutated");
    const after = await durable(sid);
    assert.deepEqual(after.decision_context, res.session.decision_context);
    assert.ok((after.decision_context_idempotency_keys ?? []).includes(collectKey(sid, "u_h1")));
  });

  await check("H2 DC persist fails (IDB tx abort) 閳?uncommitted DC not adopted, no plan; Session + IDB unchanged; retry commits (not idempotent_skip)", async () => {
    const sid = await seedCollectingSession("h2");
    const before = await durable(sid);
    const beforeClone = structuredClone(before);
    const idbBefore = persistedDcState(before);
    const { value: res, hits } = await withIdbWriteFault(SESSION_STORE, () =>
      runCollectingDcTurn(before, {
        statement: "Savings cover four months of expenses.",
        source_turn_id: "u_h2",
        now: NOW,
      }),
    );
    assert.equal(hits, 1, "storage fault must hit the C1 write exactly once");
    assert.equal(res.outcome, "persist_failed");
    assert.ok(res.persist_error && res.persist_error !== "idempotent_skip");
    assert.equal(res.ask_planned, false);
    assert.strictEqual(res.session, before, "caller Session returned as-is");
    assert.deepEqual(before, beforeClone);
    assert.equal(hasTurnFact(res.session, "u_h2"), false);
    const after = await durable(sid);
    assert.deepEqual(persistedDcState(after), idbBefore);
    assert.equal((after.decision_context_idempotency_keys ?? []).includes(collectKey(sid, "u_h2")), false);

    const retry = await runCollectingDcTurn(after, {
      statement: "Savings cover four months of expenses.",
      source_turn_id: "u_h2",
      now: NOW,
    });
    assert.equal(retry.outcome, "dc_committed");
    assert.equal(retry.persist_error, undefined, "retry must commit, not idempotent_skip");
    assert.ok(hasTurnFact(await durable(sid), "u_h2"));
  });

  await check("H3 Ask fails after DC commit 閳?committed DC kept (== IDB), no new plan (prior plan untouched)", async () => {
    const sid = await seedCollectingSession("h3");
    const before = await durable(sid);
    const { value: res, catalogHits, writeHits } = await withCatalogFaultAfterNextSessionWrite(() =>
      runCollectingDcTurn(before, {
        statement: "Savings cover four months of expenses.",
        source_turn_id: "u_h3",
        now: NOW,
      }),
    );
    assert.equal(writeHits, 1);
    assert.ok(catalogHits >= 1, "Ask must have hit the catalog fault");
    assert.equal(res.outcome, "dc_committed");
    assert.equal(res.ask_planned, false);
    assert.match(res.ask_error ?? "", /dir_catalog_load_failed/);
    assert.deepEqual(res.session.intake_ask_plan, before.intake_ask_plan);
    const after = await durable(sid);
    assert.ok(hasTurnFact(after, "u_h3"));
    assert.deepEqual(res.session.decision_context, after.decision_context);
    assert.equal(loadDirNaCatalog(ACTIVE_DIR_NA_CATALOG_VERSION).ok, true, "fault restored");
  });

  await check("H4 exception inside persist (DC mapper throws) 閳?Session returned as-is, IDB unchanged, no key", async () => {
    const sid = await seedCollectingSession("h4");
    const before = await durable(sid);
    const beforeClone = structuredClone(before);
    const idbBefore = persistedDcState(before);
    const fault = armActiveCatalogFault(ACTIVE_DIR_NA_CATALOG_VERSION, DIR_NA_CATALOG_V1_ENTRIES);
    let res: Awaited<ReturnType<typeof runCollectingDcTurn>>;
    try {
      res = await runCollectingDcTurn(before, {
        statement: "Savings cover four months of expenses.",
        source_turn_id: "u_h4",
        now: NOW,
      });
    } finally {
      fault.restore();
    }
    assert.ok(fault.hits() >= 1);
    assert.equal(res.outcome, "persist_threw");
    assert.match(res.persist_error ?? "", /dir_catalog_load_failed/);
    assert.equal(res.ask_planned, false);
    assert.strictEqual(res.session, before);
    assert.deepEqual(before, beforeClone);
    assert.deepEqual(persistedDcState(await durable(sid)), idbBefore);
  });

  await check("H5 mapper skip (turn already mapped) 閳?not_applied; Ask still plans on unchanged DC (pre-S8 behavior)", async () => {
    const sid = await seedCollectingSession("h5");
    const first = await runCollectingDcTurn(await durable(sid), {
      statement: "Savings cover four months of expenses.",
      source_turn_id: "u_h5",
      now: NOW,
    });
    assert.equal(first.outcome, "dc_committed");
    const again = await runCollectingDcTurn(first.session, {
      statement: "Savings cover four months of expenses.",
      source_turn_id: "u_h5",
      now: NOW,
    });
    assert.equal(again.outcome, "not_applied");
    assert.equal(again.persist_error, "turn_already_mapped");
    assert.equal(again.ask_planned, true);
    assert.deepEqual(again.session.decision_context, first.session.decision_context);
  });

  // ============================================== P. production call chain
  console.log("\n== P. handleUserMessage 閳?runCollectingDcTurn (fetch stub, no network) ==");

  const fetchCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    fetchCalls.push(url);
    if (url !== "/api/poju/chat") throw new Error(`unexpected fetch in test: ${url}`);
    return new Response(
      JSON.stringify({
        response: "Got it. How many months could your savings cover if income stopped?",
        collection_progress: "advancing",
        question_status: "asked",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const userMessage = "My savings cover about four months of expenses.";
  const lastUserTurnId = (s: POJUSessionState) => {
    const u = [...s.messages].reverse().find((m) => m.role === "user");
    assert.ok(u?.client_id, "user message client_id");
    return u.client_id;
  };

  try {
    await check("P1 normal turn 閳?DC committed via C1 (key present), fresh plan; only /api/poju/chat fetched", async () => {
      const sid = await seedCollectingSession("p1");
      const before = await durable(sid);
      fetchCalls.length = 0;
      const out = await handleUserMessage({ session: before, userMessage, locale: "en" });
      assert.deepEqual(fetchCalls, ["/api/poju/chat"]);
      assert.equal(out.agent_v2?.current_phase, "collecting_context");
      const turnId = lastUserTurnId(out);
      assert.ok(hasTurnFact(out, turnId));
      assert.notDeepEqual(out.intake_ask_plan, before.intake_ask_plan);
      const after = await durable(sid);
      assert.deepEqual(after.decision_context, out.decision_context);
      assert.ok((after.decision_context_idempotency_keys ?? []).includes(collectKey(sid, turnId)));
      await savePOJUSession(out);
      assert.deepEqual((await durable(sid)).decision_context, out.decision_context);
    });

    await check("P2 C1 write aborted 閳?returned Session keeps pre-turn DC + plan; UI savePOJUSession writes no uncommitted DC", async () => {
      const sid = await seedCollectingSession("p2");
      const before = await durable(sid);
      const { value: out, hits } = await withIdbWriteFault(SESSION_STORE, () =>
        handleUserMessage({ session: before, userMessage, locale: "en" }),
      );
      assert.equal(hits, 1);
      assert.equal(out.agent_v2?.current_phase, "collecting_context");
      const turnId = lastUserTurnId(out);
      assert.equal(hasTurnFact(out, turnId), false, "uncommitted DC must not be adopted");
      assert.deepEqual(out.decision_context, before.decision_context);
      assert.deepEqual(out.intake_ask_plan, before.intake_ask_plan, "no plan from uncommitted DC");
      assert.deepEqual(out.decision_context_idempotency_keys ?? [], before.decision_context_idempotency_keys ?? []);
      const idbAfterTurn = await durable(sid);
      assert.deepEqual(idbAfterTurn.decision_context, before.decision_context);
      // Same follow-up the chat UI performs (POJUChatUI 閳?savePOJUSession(finalSession)).
      await savePOJUSession(out);
      const idbAfterSave = await durable(sid);
      assert.deepEqual(idbAfterSave.decision_context, before.decision_context);
      assert.equal(hasTurnFact(idbAfterSave, turnId), false);
      assert.equal(
        (idbAfterSave.decision_context_idempotency_keys ?? []).includes(collectKey(sid, turnId)),
        false,
      );
      assert.equal(idbAfterSave.messages.length, out.messages.length, "chat turn itself still saved");
    });

    await check("P3 Ask fails after commit 閳?returned Session has committed DC (== IDB), prior plan untouched", async () => {
      const sid = await seedCollectingSession("p3");
      const before = await durable(sid);
      const { value: out, catalogHits } = await withCatalogFaultAfterNextSessionWrite(() =>
        handleUserMessage({ session: before, userMessage, locale: "en" }),
      );
      assert.ok(catalogHits >= 1);
      const turnId = lastUserTurnId(out);
      const after = await durable(sid);
      assert.ok(hasTurnFact(after, turnId));
      assert.deepEqual(out.decision_context, after.decision_context);
      assert.deepEqual(out.intake_ask_plan, before.intake_ask_plan);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  // ============================================== S. static
  console.log("\n== S. Static wiring ==");
  await check("S1 agent.ts reaches collecting persist / Ask only through runCollectingDcTurn", async () => {
    const src = readFileSync(join(REPO, "lib/poju/agent.ts"), "utf8");
    assert.match(src, /import \{ runCollectingDcTurn \} from "@\/lib\/poju\/collecting-dc-turn";/);
    assert.match(src, /await runCollectingDcTurn\(sessionOut,/);
    assert.equal(/persistCollectingUserTurnDc/.test(src), false);
    assert.equal(/selectNextIntakeAskForSession/.test(src), false);
  });

  console.log(`\nS8 agent-collecting-failure done. PASS=${passed} FAIL=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
