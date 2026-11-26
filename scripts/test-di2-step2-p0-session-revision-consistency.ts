/**
 * Step 2 P0 — Session Authority revision vs working memory revision consistency.
 *
 *   pnpm test:di2-step2-p0-session-revision-consistency
 *
 * Production call chain: submitAuthoritativeChatTurn / executeAuthoritativeChatTurn
 * → memory persist + DC ledger → final Session Authority CAS.
 * Model calls are stubbed (no OpenRouter).
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { mergeAnswerInterpretationTestHooks } from "./fixtures/test-answer-interpretation-hook";
import { POST as postChat } from "../app/api/poju/chat/route";
import {
  createMemorySessionAuthorityStore,
  runWithSessionAuthorityStore,
} from "../lib/poju/session-authority/store";
import {
  commitAuthoritativeSessionUpdate,
  initializeAuthoritativeSession,
  requireAuthoritativeSession,
  SessionAuthorityError,
} from "../lib/poju/session-authority/lifecycle";
import {
  runWithAuthoritativeChatTestHooks,
  runWithAuthoritativeCommitTestHook,
  runWithTestChatModel,
} from "../lib/poju/session-authority/chat-hooks";
import {
  executeAuthoritativeChatTurn,
} from "../lib/poju/session-authority/chat";
import {
  submitAuthoritativeChatTurn,
  AUTHORITATIVE_CHAT_ROUTE,
} from "../lib/poju/session-authority/chat-client";
import {
  createPOJUSession,
  loadPOJUSession,
  mirrorAuthoritativeSessionLocally,
} from "../lib/poju/session-manager";
import { __resetPojuDbForTests, ensurePojuDbReady } from "../lib/db/poju-db";
import {
  loadLedgerEntry,
  readLedgerHead,
} from "../lib/poju/decision-authority/server/ledger-store";
import { dcSnapshotHash } from "../lib/poju/decision-authority/hash";
import {
  adoptLedgerHeadIntoSessionIfAhead,
  LedgerHeadIntegrityError,
} from "../lib/poju/session-authority/ledger-head-catchup";
import { DC_LEDGER_SCHEMA_VERSION } from "../lib/poju/decision-authority/types";
import type { POJUSessionState } from "../lib/poju/types";
import type { AdaptiveQuestionPlan } from "../lib/poju/decision-intake/types";
import type { POJULLMResponse } from "../lib/llm/poju-llm";

installIntakeR6TestGlobals("dev_di2_step2_p0_rev");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "di2-step2-p0-revision-test-secret";
}

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

function cannedLlm(text: string): POJULLMResponse {
  return {
    response: text,
    model: "test",
    tokens_used: 0,
    user_intent: "decision",
    current_state: "collecting_context",
    topic_drift_detected: false,
    context_updates: {},
  };
}

function installFetchProbe() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(AUTHORITATIVE_CHAT_ROUTE) || url.includes("/api/poju/chat")) {
      const req = new Request(url.startsWith("http") ? url : `http://localhost${url}`, {
        method: init?.method ?? "POST",
        headers: init?.headers,
        body: init?.body,
      });
      return postChat(req);
    }
    if (originalFetch) return originalFetch(input, init);
    return new Response(JSON.stringify({ ok: false, error: "unexpected_fetch" }), { status: 500 });
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function withAuthStore<T>(fn: () => Promise<T>): Promise<T> {
  return runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), () =>
    runWithAuthoritativeChatTestHooks(mergeAnswerInterpretationTestHooks(), () =>
      runWithTestChatModel(async () => cannedLlm("p0-test-reply"), fn),
    ),
  );
}

function clarificationPlan(planId: string, now: string): AdaptiveQuestionPlan {
  return {
    plan_id: planId,
    candidate_id: "c_clar_p0",
    direction_id: "DIRN-DEFINITION",
    ddr_ids: ["DDR-P05-01"],
    dir_ids: ["DIR-DEF-QUESTION"],
    fact_role_codes: ["v1/dir/DIR-DEF-QUESTION/role/situation"],
    missing_info: "unclear_role",
    decision_value: "decision_critical",
    ask_now_reason: "p0_test",
    expected_info: "clarify role",
    depth: 1,
    budget_cost: 1,
    remaining_hard_budget: 14,
    gate_class: "P0",
    scope_boundary: "test",
    rationale: "p0 clarification",
    question_text: "请澄清刚才提到的约束具体是什么？",
    built_at: now,
    scoring_path: "pending_answer_resolution→deterministic_unclear_role",
    collection_mode: "clarification",
  };
}

async function main() {
  console.log("Step 2 P0 session revision / DC ledger / Session CAS consistency");
  await __resetPojuDbForTests();
  await ensurePojuDbReady();
  const restoreFetch = installFetchProbe();

  try {
    await check("Test A: ordinary substantive answer — fact+constraint, CAS, next turn", async () => {
      await withAuthStore(async () => {
        const sid = await createPOJUSession({
          payment_id: "pay_p0_a",
          original_question: "要不要接受新工作？",
        });
        const s0 = (await loadPOJUSession(sid))!;
        const start = await requireAuthoritativeSession(sid);
        assert.equal(start.revision, s0.session_revision ?? 0);

        const t1 = "turn_p0_a1";
        const msg1 = "我在考虑要不要接受这份新工作，家人希望我稳定一点。";
        const r1 = await submitAuthoritativeChatTurn({
          session: {
            ...s0,
            messages: [
              ...s0.messages,
              { role: "user", content: msg1, timestamp: new Date().toISOString(), client_id: t1 },
            ],
          },
          user_message: msg1,
          client_turn_id: t1,
          expected_revision: s0.session_revision ?? 0,
          locale: "zh",
        });
        assert.ok(r1.session_revision > start.revision);
        const server1 = await requireAuthoritativeSession(sid);
        assert.equal(server1.revision, r1.session_revision);
        assert.ok(r1.session.decision_context);

        const t2 = "turn_p0_a2";
        const msg2 =
          "硬约束是每月固定开支不少于一万二；可选方案是留任、跳槽，或者先内部转岗。";
        const beforeFacts = r1.session.decision_context?.reality_facts?.length ?? 0;
        const beforeConstraints = r1.session.decision_context?.constraints?.length ?? 0;
        const beforeLedger = r1.session.dc_ledger?.head?.commit_version ?? 0;
        const beforeCore =
          r1.session.decision_understanding?.budget.core_effective_answer_rounds ?? 0;

        const r2 = await submitAuthoritativeChatTurn({
          session: {
            ...r1.session,
            messages: [
              ...r1.session.messages,
              { role: "user", content: msg2, timestamp: new Date().toISOString(), client_id: t2 },
            ],
          },
          user_message: msg2,
          client_turn_id: t2,
          expected_revision: r1.session_revision,
          locale: "zh",
        });

        assert.ok(r2.session_revision > r1.session_revision);
        const server2 = await requireAuthoritativeSession(sid);
        assert.equal(server2.revision, r2.session_revision);
        assert.equal(
          server2.session_snapshot.session_revision,
          r2.session_revision,
        );

        const facts = r2.session.decision_context?.reality_facts?.length ?? 0;
        const constraints = r2.session.decision_context?.constraints?.length ?? 0;
        assert.ok(
          facts > beforeFacts || constraints > beforeConstraints,
          "ordinary answer must write RealityFact and/or Constraint",
        );
        assert.ok(
          (r2.session.dc_ledger?.head?.commit_version ?? 0) >= beforeLedger,
          "DC ledger head must advance or remain consistent",
        );

        const ledgerHead = await readLedgerHead(sid);
        assert.ok(ledgerHead);
        assert.equal(
          ledgerHead!.snapshot_hash,
          dcSnapshotHash(r2.session.decision_context!),
        );
        assert.equal(
          ledgerHead!.commit_version,
          r2.session.dc_ledger?.head?.commit_version,
        );

        const afterCore =
          r2.session.decision_understanding?.budget.core_effective_answer_rounds ?? 0;
        assert.ok(afterCore >= beforeCore);

        const t3 = "turn_p0_a3";
        const msg3 = "我更在意长期发展，也担心短期现金流。";
        const r3 = await submitAuthoritativeChatTurn({
          session: {
            ...r2.session,
            messages: [
              ...r2.session.messages,
              { role: "user", content: msg3, timestamp: new Date().toISOString(), client_id: t3 },
            ],
          },
          user_message: msg3,
          client_turn_id: t3,
          expected_revision: r2.session_revision,
          locale: "zh",
        });
        assert.ok(r3.session_revision > r2.session_revision);
        const server3 = await requireAuthoritativeSession(sid);
        assert.equal(server3.revision, r3.session_revision);
        await mirrorAuthoritativeSessionLocally(r3.session);
      });
    });

    await check("Test B: clarification reservation advances Authority then final commit", async () => {
      await withAuthStore(async () => {
        const sid = await createPOJUSession({
          payment_id: "pay_p0_b",
          original_question: "要不要换城市工作？",
        });
        const s0 = (await loadPOJUSession(sid))!;
        const t1 = "turn_p0_b1";
        const msg1 = "我在考虑要不要换城市工作。";
        const r1 = await submitAuthoritativeChatTurn({
          session: {
            ...s0,
            messages: [
              ...s0.messages,
              { role: "user", content: msg1, timestamp: new Date().toISOString(), client_id: t1 },
            ],
          },
          user_message: msg1,
          client_turn_id: t1,
          expected_revision: s0.session_revision ?? 0,
          locale: "zh",
        });

        const now = new Date().toISOString();
        const clarPlan = clarificationPlan("qp_p0_clar_b", now);
        const beforeInject = await requireAuthoritativeSession(sid);
        const injected = await commitAuthoritativeSessionUpdate({
          sessionId: sid,
          expectedRevision: beforeInject.revision,
          expectedGeneration: beforeInject.session_generation,
          snapshot: {
            ...r1.session,
            session_revision: beforeInject.revision,
            pending_answer_resolution: {
              status: "pending",
              source_turn_id: t1,
              original_statement: msg1,
              original_classification: "partial",
              unresolved_items: [
                {
                  item_id: "item_p0_b",
                  source_turn_id: t1,
                  text: "城市与家庭约束关系不清晰",
                  semantic_kind: "constraint",
                  certainty: "unclear",
                  reason: "unclear_certainty",
                  sent_question_id:
                    r1.session.decision_understanding?.last_sent_question?.plan_id ?? "prior",
                  authorized_role_codes: clarPlan.fact_role_codes,
                },
              ],
              rejected_items: [],
              authorized_role_codes: clarPlan.fact_role_codes,
              authorized_dir_ids: clarPlan.dir_ids,
              sent_question_id: r1.session.decision_understanding?.last_sent_question?.plan_id ?? "prior",
              clarification_plan: clarPlan,
              clarification_plan_id: clarPlan.plan_id,
              resolving_item_id: "item_p0_b",
            },
            decision_understanding: {
              ...r1.session.decision_understanding!,
              last_sent_question: null,
              budget: {
                ...r1.session.decision_understanding!.budget,
                clarification_allowance: 3,
                clarification_claims: [],
                clarification_rounds: 0,
              },
            },
          },
          last_committed_turn_id: t1,
        });
        const revAfterInject = injected.revision;

        let capturedExpected: number | null = null;
        const t2 = "turn_p0_b2";
        const msg2 = "我还是说不清楚家里对城市的要求。";
        const result = await runWithAuthoritativeCommitTestHook(
          async (ctx) => {
            capturedExpected = ctx.expectedRevision;
            const live = await requireAuthoritativeSession(sid);
            // Reservation must have already advanced Authority past inject revision.
            assert.ok(
              live.revision >= revAfterInject,
              "reservation CAS should have run before final commit",
            );
            assert.equal(
              ctx.expectedRevision,
              live.revision,
              "final CAS must use post-reservation authoritative revision",
            );
            // Working memory revision may be ahead; must not be used as expected.
            const working = ctx.session.session_revision;
            if (typeof working === "number" && working !== live.revision) {
              assert.notEqual(
                ctx.expectedRevision,
                working,
                "must not use working_session_revision as CAS expected",
              );
            }
          },
          () =>
            executeAuthoritativeChatTurn({
              session: {
                ...injected.session_snapshot,
                messages: [
                  ...(injected.session_snapshot.messages ?? []),
                  {
                    role: "user",
                    content: msg2,
                    timestamp: now,
                    client_id: t2,
                  },
                ],
              },
              user_message: msg2,
              client_turn_id: t2,
              expected_revision: revAfterInject,
              locale: "zh",
            }),
        );

        assert.ok(result.ok && !result.aborted);
        assert.ok(capturedExpected != null);
        const server = await requireAuthoritativeSession(sid);
        assert.equal(server.revision, result.session.session_revision);
        const claims =
          result.session.decision_understanding?.budget.clarification_claims ?? [];
        const clarClaim = claims.find((c) => c.plan_id === clarPlan.plan_id);
        assert.ok(clarClaim, "clarification claim must persist");
        assert.ok(
          clarClaim!.status === "confirmed" || clarClaim!.status === "claimed",
          `claim status=${clarClaim!.status}`,
        );
      });
    });

    await check("catch-up: same commit_version different entry_hash fail-closed", async () => {
      await withAuthStore(async () => {
        const sid = await createPOJUSession({
          payment_id: "pay_p0_integrity",
          original_question: "要不要换岗？",
        });
        const s0 = (await loadPOJUSession(sid))!;
        const t1 = "turn_p0_integrity_1";
        const r1 = await submitAuthoritativeChatTurn({
          session: {
            ...s0,
            messages: [
              ...s0.messages,
              {
                role: "user",
                content: "我在考虑要不要换岗。",
                timestamp: new Date().toISOString(),
                client_id: t1,
              },
            ],
          },
          user_message: "我在考虑要不要换岗。",
          client_turn_id: t1,
          expected_revision: s0.session_revision ?? 0,
          locale: "zh",
        });
        const head = await readLedgerHead(sid);
        assert.ok(head);
        assert.ok(r1.session.dc_ledger?.head);

        const forged: POJUSessionState = {
          ...r1.session,
          dc_ledger: {
            schema_version: DC_LEDGER_SCHEMA_VERSION,
            writer_token: r1.session.dc_ledger!.writer_token,
            head: {
              ...r1.session.dc_ledger!.head,
              // Same version as durable head, different hash → integrity conflict.
              commit_version: head!.commit_version,
              entry_hash: "0".repeat(64),
            },
            synced_at: r1.session.dc_ledger!.synced_at,
          },
        };

        await assert.rejects(
          () => adoptLedgerHeadIntoSessionIfAhead(forged),
          (err: unknown) =>
            err instanceof LedgerHeadIntegrityError &&
            err.code === "DC_LEDGER_HEAD_INTEGRITY_CONFLICT" &&
            err.commit_version === head!.commit_version,
        );

        // Working Session must not have been silently rewritten by a failed catch-up.
        assert.equal(forged.dc_ledger?.head.entry_hash, "0".repeat(64));
        const durable = await readLedgerHead(sid);
        assert.equal(durable?.entry_hash, head!.entry_hash);
      });
    });

    await check("Test C: ledger append then abort — catch-up allows next turn", async () => {
      await withAuthStore(async () => {
        const sid = await createPOJUSession({
          payment_id: "pay_p0_c",
          original_question: "要不要读研？",
        });
        const s0 = (await loadPOJUSession(sid))!;
        const t1 = "turn_p0_c1";
        const msg1 = "我在考虑要不要读研，也担心机会成本。";
        const r1 = await submitAuthoritativeChatTurn({
          session: {
            ...s0,
            messages: [
              ...s0.messages,
              { role: "user", content: msg1, timestamp: new Date().toISOString(), client_id: t1 },
            ],
          },
          user_message: msg1,
          client_turn_id: t1,
          expected_revision: s0.session_revision ?? 0,
          locale: "zh",
        });
        const revBeforeAbort = r1.session_revision;
        const ledgerBefore = await readLedgerHead(sid);
        assert.ok(ledgerBefore);

        const t2 = "turn_p0_c2";
        const msg2 = "硬约束是两年内必须有稳定收入；可选方案是全职读研或在职读研。";
        const ac = new AbortController();
        const aborted = await runWithAuthoritativeCommitTestHook(
          async () => {
            ac.abort();
          },
          () =>
            executeAuthoritativeChatTurn(
              {
                session: {
                  ...r1.session,
                  messages: [
                    ...r1.session.messages,
                    {
                      role: "user",
                      content: msg2,
                      timestamp: new Date().toISOString(),
                      client_id: t2,
                    },
                  ],
                },
                user_message: msg2,
                client_turn_id: t2,
                expected_revision: revBeforeAbort,
                locale: "zh",
              },
              { signal: ac.signal },
            ),
        );
        assert.equal(aborted.ok, false);
        assert.equal(aborted.aborted, true);

        const serverAfterAbort = await requireAuthoritativeSession(sid);
        assert.equal(
          serverAfterAbort.revision,
          revBeforeAbort,
          "Session Authority must not mark aborted turn as committed",
        );
        assert.notEqual(serverAfterAbort.last_committed_turn_id, t2);

        const ledgerAfterAbort = await readLedgerHead(sid);
        assert.ok(ledgerAfterAbort);
        assert.ok(
          ledgerAfterAbort!.commit_version > ledgerBefore!.commit_version,
          "abort path must have appended a new Ledger entry",
        );
        assert.notEqual(
          ledgerAfterAbort!.snapshot_hash,
          ledgerBefore!.snapshot_hash,
          "aborted turn Ledger snapshot must differ from prior head",
        );
        assert.equal(
          ledgerAfterAbort!.previous_commit_version,
          ledgerBefore!.commit_version,
        );
        assert.equal(
          ledgerAfterAbort!.previous_entry_hash,
          ledgerBefore!.entry_hash,
        );

        // Replay same turn id after abort — must complete without orphan head.
        const replay = await executeAuthoritativeChatTurn({
          session: {
            ...serverAfterAbort.session_snapshot,
            messages: [
              ...(serverAfterAbort.session_snapshot.messages ?? []),
              {
                role: "user",
                content: msg2,
                timestamp: new Date().toISOString(),
                client_id: t2,
              },
            ],
          },
          user_message: msg2,
          client_turn_id: t2,
          expected_revision: serverAfterAbort.revision,
          locale: "zh",
        });
        assert.ok(replay.ok && !replay.aborted);
        assert.ok(replay.session.session_revision > revBeforeAbort);

        // Fresh next turn must continue from valid head (catch-up if needed).
        const t3 = "turn_p0_c3";
        const msg3 = "我更看重两年后的职业选择空间。";
        const next = await submitAuthoritativeChatTurn({
          session: {
            ...replay.session,
            messages: [
              ...replay.session.messages,
              {
                role: "user",
                content: msg3,
                timestamp: new Date().toISOString(),
                client_id: t3,
              },
            ],
          },
          user_message: msg3,
          client_turn_id: t3,
          expected_revision: replay.session.session_revision,
          locale: "zh",
        });
        assert.ok(next.session_revision > replay.session.session_revision);
        const head = await readLedgerHead(sid);
        assert.ok(head);
        assert.equal(
          head!.snapshot_hash,
          dcSnapshotHash(next.session.decision_context!),
        );
      });
    });

    await check("Test C2: abort then new turn ID recovers from leftover Ledger head", async () => {
      await withAuthStore(async () => {
        const sid = await createPOJUSession({
          payment_id: "pay_p0_c2",
          original_question: "要不要出国？",
        });
        const s0 = (await loadPOJUSession(sid))!;
        const t1 = "turn_p0_c2_1";
        const r1 = await submitAuthoritativeChatTurn({
          session: {
            ...s0,
            messages: [
              ...s0.messages,
              {
                role: "user",
                content: "我在考虑要不要出国工作。",
                timestamp: new Date().toISOString(),
                client_id: t1,
              },
            ],
          },
          user_message: "我在考虑要不要出国工作。",
          client_turn_id: t1,
          expected_revision: s0.session_revision ?? 0,
          locale: "zh",
        });
        const ledgerBefore = await readLedgerHead(sid);
        assert.ok(ledgerBefore);
        const revBeforeAbort = r1.session_revision;

        const tAbort = "turn_p0_c2_abort";
        const msgAbort =
          "硬约束是父母需要我留在国内；可选方案是远程工作或短期出差。";
        const ac = new AbortController();
        const aborted = await runWithAuthoritativeCommitTestHook(
          async () => {
            ac.abort();
          },
          () =>
            executeAuthoritativeChatTurn(
              {
                session: {
                  ...r1.session,
                  messages: [
                    ...r1.session.messages,
                    {
                      role: "user",
                      content: msgAbort,
                      timestamp: new Date().toISOString(),
                      client_id: tAbort,
                    },
                  ],
                },
                user_message: msgAbort,
                client_turn_id: tAbort,
                expected_revision: revBeforeAbort,
                locale: "zh",
              },
              { signal: ac.signal },
            ),
        );
        assert.equal(aborted.aborted, true);

        const orphanHead = await readLedgerHead(sid);
        assert.ok(orphanHead);
        assert.ok(orphanHead!.commit_version > ledgerBefore!.commit_version);
        assert.notEqual(orphanHead!.snapshot_hash, ledgerBefore!.snapshot_hash);

        const server = await requireAuthoritativeSession(sid);
        assert.equal(server.revision, revBeforeAbort);
        assert.notEqual(server.last_committed_turn_id, tAbort);

        // Do NOT replay tAbort — submit a different turn that must catch up.
        const tNew = "turn_p0_c2_new";
        const msgNew = "我更在意能否兼顾家庭照护。";
        const follow = await executeAuthoritativeChatTurn({
          session: {
            ...server.session_snapshot,
            messages: [
              ...(server.session_snapshot.messages ?? []),
              {
                role: "user",
                content: msgNew,
                timestamp: new Date().toISOString(),
                client_id: tNew,
              },
            ],
          },
          user_message: msgNew,
          client_turn_id: tNew,
          expected_revision: server.revision,
          locale: "zh",
        });
        assert.ok(follow.ok && !follow.aborted);

        const finalHead = await readLedgerHead(sid);
        assert.ok(finalHead);
        assert.ok(
          finalHead!.commit_version >= orphanHead!.commit_version,
          "new turn must continue from leftover Ledger head",
        );
        if (finalHead!.commit_version > orphanHead!.commit_version) {
          assert.equal(
            finalHead!.previous_commit_version,
            orphanHead!.commit_version,
          );
          assert.equal(finalHead!.previous_entry_hash, orphanHead!.entry_hash);
        }
        assert.equal(
          finalHead!.snapshot_hash,
          dcSnapshotHash(follow.session.decision_context!),
        );
        assert.equal(
          follow.session.dc_ledger?.head?.entry_hash,
          finalHead!.entry_hash,
        );
      });
    });

    await check("Test D: concurrent Authority CAS conflict — no silent overwrite", async () => {
      await withAuthStore(async () => {
        const sid = await createPOJUSession({
          payment_id: "pay_p0_d",
          original_question: "要不要创业？",
        });
        const s0 = (await loadPOJUSession(sid))!;
        const t1 = "turn_p0_d1";
        const msg1 = "我在犹豫要不要创业。";
        const r1 = await submitAuthoritativeChatTurn({
          session: {
            ...s0,
            messages: [
              ...s0.messages,
              { role: "user", content: msg1, timestamp: new Date().toISOString(), client_id: t1 },
            ],
          },
          user_message: msg1,
          client_turn_id: t1,
          expected_revision: s0.session_revision ?? 0,
          locale: "zh",
        });

        const t2 = "turn_p0_d2";
        const msg2 = "硬约束是启动资金不超过五十万；可选方案是继续打工或兼职试水。";
        let raced = false;
        await assert.rejects(
          () =>
            runWithAuthoritativeCommitTestHook(
              async ({ sessionId, expectedRevision }) => {
                if (raced) return;
                raced = true;
                const cur = await requireAuthoritativeSession(sessionId);
                assert.equal(cur.revision, expectedRevision);
                await commitAuthoritativeSessionUpdate({
                  sessionId,
                  expectedRevision: cur.revision,
                  expectedGeneration: cur.session_generation,
                  snapshot: {
                    ...cur.session_snapshot,
                    original_question: `${cur.session_snapshot.original_question ?? ""} [raced]`,
                  },
                  last_committed_turn_id: cur.last_committed_turn_id,
                });
              },
              () =>
                executeAuthoritativeChatTurn({
                  session: {
                    ...r1.session,
                    messages: [
                      ...r1.session.messages,
                      {
                        role: "user",
                        content: msg2,
                        timestamp: new Date().toISOString(),
                        client_id: t2,
                      },
                    ],
                  },
                  user_message: msg2,
                  client_turn_id: t2,
                  expected_revision: r1.session_revision,
                  locale: "zh",
                }),
            ),
          (err: unknown) =>
            err instanceof SessionAuthorityError && err.code === "session_cas_conflict",
        );

        const server = await requireAuthoritativeSession(sid);
        assert.match(
          server.session_snapshot.original_question ?? "",
          /\[raced\]/,
          "concurrent winner Session must remain",
        );
        assert.notEqual(server.last_committed_turn_id, t2);

        const ledgerAfterConflict = await readLedgerHead(sid);
        assert.ok(
          ledgerAfterConflict,
          "ledger data from the lost turn must not be silently discarded",
        );

        // Follow-up turn after conflict must proceed and chain from leftover head.
        const t3 = "turn_p0_d3";
        const msg3 = "我更在意风险可控。";
        const follow = await executeAuthoritativeChatTurn({
          session: {
            ...server.session_snapshot,
            messages: [
              ...(server.session_snapshot.messages ?? []),
              {
                role: "user",
                content: msg3,
                timestamp: new Date().toISOString(),
                client_id: t3,
              },
            ],
          },
          user_message: msg3,
          client_turn_id: t3,
          expected_revision: server.revision,
          locale: "zh",
        });
        assert.ok(follow.ok && !follow.aborted);
        assert.ok(follow.session.session_revision > server.revision);

        const finalHead = await readLedgerHead(sid);
        assert.ok(finalHead);
        assert.ok(
          finalHead!.commit_version >= ledgerAfterConflict!.commit_version,
        );
        if (finalHead!.commit_version > ledgerAfterConflict!.commit_version) {
          assert.equal(
            finalHead!.previous_commit_version,
            ledgerAfterConflict!.commit_version,
          );
          assert.equal(
            finalHead!.previous_entry_hash,
            ledgerAfterConflict!.entry_hash,
          );
          const prev = await loadLedgerEntry(
            sid,
            ledgerAfterConflict!.commit_version,
          );
          assert.ok(prev);
          assert.equal(prev!.entry_hash, ledgerAfterConflict!.entry_hash);
        }
        assert.equal(
          finalHead!.snapshot_hash,
          dcSnapshotHash(follow.session.decision_context!),
        );
        assert.equal(
          follow.session.dc_ledger?.head?.snapshot_hash,
          finalHead!.snapshot_hash,
        );
      });
    });
  } finally {
    restoreFetch();
  }

  console.log(`\nDone: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
