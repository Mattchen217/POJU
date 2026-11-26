/**
 * Step 2 P1-B — Clarification Claim release / recovery lifecycle.
 *
 *   pnpm test:di2-step2-p1b-clarification-claim-lifecycle
 *
 * Uses real MemorySessionAuthorityStore + reserve/release CAS helpers and
 * executeAuthoritativeChatTurn. No OpenRouter.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { mergeAnswerInterpretationTestHooks } from "./fixtures/test-answer-interpretation-hook";
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
import { executeAuthoritativeChatTurn } from "../lib/poju/session-authority/chat";
import {
  createPOJUSession,
  loadPOJUSession,
} from "../lib/poju/session-manager";
import { __resetPojuDbForTests, ensurePojuDbReady } from "../lib/db/poju-db";
import {
  reserveClarificationClaimCas,
  releaseClarificationClaimCas,
  runWithClarificationClaimRequestScope,
  confirmClarification,
  releaseClarification,
  claimClarification,
  reconcileClarificationClaims,
  finalizeClarificationClaimsForDurableCommit,
  CLARIFICATION_ALLOWANCE,
} from "../lib/poju/decision-intake";
import type { AdaptiveQuestionPlan } from "../lib/poju/decision-intake/types";
import type { POJUSessionState } from "../lib/poju/types";
import type { POJULLMResponse } from "../lib/llm/poju-llm";

installIntakeR6TestGlobals("dev_di2_step2_p1b_claim");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "di2-step2-p1b-claim-test-secret";
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

function withAuthStore<T>(fn: () => Promise<T>): Promise<T> {
  return runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), () =>
    runWithAuthoritativeChatTestHooks(mergeAnswerInterpretationTestHooks(), () =>
      runWithTestChatModel(async () => cannedLlm("p1b-test-reply"), fn),
    ),
  );
}

function activeClaimCount(session: POJUSessionState): number {
  return (session.decision_understanding?.budget.clarification_claims ?? []).filter(
    (c) => c.status === "claimed" || c.status === "confirmed",
  ).length;
}

function claimOf(session: POJUSessionState, planId: string) {
  return session.decision_understanding?.budget.clarification_claims?.find(
    (c) => c.plan_id === planId,
  );
}

function clarificationPlan(planId: string, now: string): AdaptiveQuestionPlan {
  return {
    plan_id: planId,
    candidate_id: "c_clar_p1b",
    direction_id: "DIRN-DEFINITION",
    ddr_ids: ["DDR-P05-01"],
    dir_ids: ["DIR-DEF-QUESTION"],
    fact_role_codes: ["v1/dir/DIR-DEF-QUESTION/role/situation"],
    missing_info: "unclear_role",
    decision_value: "decision_critical",
    ask_now_reason: "p1b_test",
    expected_info: "clarify role",
    depth: 1,
    budget_cost: 1,
    remaining_hard_budget: 14,
    gate_class: "P0",
    scope_boundary: "test",
    rationale: "p1b clarification",
    question_text: "请澄清刚才提到的约束具体是什么？",
    built_at: now,
    scoring_path: "pending_answer_resolution→deterministic_unclear_role",
    collection_mode: "clarification",
  };
}

async function seedPendingClarification(input: {
  sid: string;
  planId: string;
  allowance?: number;
}): Promise<{
  rev: number;
  plan: AdaptiveQuestionPlan;
  snapshot: POJUSessionState;
}> {
  const s0 = (await loadPOJUSession(input.sid))!;
  const t1 = `turn_seed_${input.planId}`;
  const msg1 = "我在考虑要不要换城市，但家里要求还不清楚。";
  const now = new Date().toISOString();
  const r1 = await executeAuthoritativeChatTurn({
    session: {
      ...s0,
      messages: [
        ...s0.messages,
        { role: "user", content: msg1, timestamp: now, client_id: t1 },
      ],
    },
    user_message: msg1,
    client_turn_id: t1,
    expected_revision: s0.session_revision ?? 0,
    locale: "zh",
  });
  assert.ok(r1.ok && !r1.aborted);

  const plan = clarificationPlan(input.planId, now);
  const before = await requireAuthoritativeSession(input.sid);
  const injected = await commitAuthoritativeSessionUpdate({
    sessionId: input.sid,
    expectedRevision: before.revision,
    expectedGeneration: before.session_generation,
    snapshot: {
      ...r1.session,
      session_revision: before.revision,
      pending_answer_resolution: {
        status: "pending",
        source_turn_id: t1,
        original_statement: msg1,
        original_classification: "partial",
        unresolved_items: [
          {
            item_id: `item_${input.planId}`,
            source_turn_id: t1,
            text: "城市与家庭约束关系不清晰",
            semantic_kind: "constraint",
            certainty: "unclear",
            reason: "unclear_certainty",
            sent_question_id:
              r1.session.decision_understanding?.last_sent_question?.plan_id ?? "prior",
            authorized_role_codes: plan.fact_role_codes,
          },
        ],
        rejected_items: [],
        authorized_role_codes: plan.fact_role_codes,
        authorized_dir_ids: plan.dir_ids,
        sent_question_id:
          r1.session.decision_understanding?.last_sent_question?.plan_id ?? "prior",
        clarification_plan: plan,
        clarification_plan_id: plan.plan_id,
        resolving_item_id: `item_${input.planId}`,
      },
      decision_understanding: {
        ...r1.session.decision_understanding!,
        last_sent_question: null,
        budget: {
          ...r1.session.decision_understanding!.budget,
          clarification_allowance: input.allowance ?? CLARIFICATION_ALLOWANCE,
          clarification_claims: [],
          clarification_rounds: 0,
        },
      },
    },
    last_committed_turn_id: t1,
  });
  return {
    rev: injected.revision,
    plan,
    snapshot: injected.session_snapshot,
  };
}

async function main() {
  console.log("Step 2 P1-B clarification claim release / recovery");
  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  await check("Test A: reserve then definite abort releases claim and restores allowance", async () => {
    await withAuthStore(async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_p1b_a",
        original_question: "要不要换城市？",
      });
      const seeded = await seedPendingClarification({ sid, planId: "qp_p1b_a" });
      const t2 = "turn_p1b_a2";
      const msg2 = "我还是说不清楚家里对城市的要求。";
      const ac = new AbortController();
      const result = await runWithAuthoritativeCommitTestHook(
        async () => {
          ac.abort();
        },
        () =>
          executeAuthoritativeChatTurn(
            {
              session: {
                ...seeded.snapshot,
                messages: [
                  ...(seeded.snapshot.messages ?? []),
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
              expected_revision: seeded.rev,
              locale: "zh",
            },
            { signal: ac.signal },
          ),
      );
      assert.equal(result.ok, false);
      assert.equal(result.aborted, true);

      const server = await requireAuthoritativeSession(sid);
      const claim = claimOf(server.session_snapshot, seeded.plan.plan_id);
      assert.ok(claim, "claim row must exist after release");
      assert.equal(claim!.status, "released");
      assert.equal(activeClaimCount(server.session_snapshot), 0);

      // Allowance restored: same plan_id can be reserved again after release.
      const re = await runWithClarificationClaimRequestScope(() =>
        reserveClarificationClaimCas({
          session: server.session_snapshot,
          plan_id: seeded.plan.plan_id,
          now: new Date().toISOString(),
        }),
      );
      assert.equal(re.ok, true);
      const afterRe = await requireAuthoritativeSession(sid);
      assert.equal(claimOf(afterRe.session_snapshot, seeded.plan.plan_id)?.status, "claimed");

      // Old aborted request must not send / confirm.
      const finalized = finalizeClarificationClaimsForDurableCommit(
        {
          ...afterRe.session_snapshot,
          decision_understanding: {
            ...afterRe.session_snapshot.decision_understanding!,
            last_sent_question: null,
          },
          messages: afterRe.session_snapshot.messages ?? [],
        },
        new Date().toISOString(),
      );
      assert.equal(
        claimOf(finalized, seeded.plan.plan_id)?.status,
        "claimed",
        "abort path must not confirm without durable outbound",
      );
    });
  });

  await check("Test B: reserve then definite final CAS conflict releases claim", async () => {
    await withAuthStore(async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_p1b_b",
        original_question: "要不要换岗？",
      });
      const seeded = await seedPendingClarification({ sid, planId: "qp_p1b_b" });
      const t2 = "turn_p1b_b2";
      const msg2 = "家里对岗位地点还是说不清。";

      let threw: unknown = null;
      try {
        await runWithAuthoritativeCommitTestHook(
          async (ctx) => {
            // Race a concurrent winner so final commit sees a definite CAS conflict.
            const live = await requireAuthoritativeSession(sid);
            await commitAuthoritativeSessionUpdate({
              sessionId: sid,
              expectedRevision: live.revision,
              expectedGeneration: live.session_generation,
              snapshot: {
                ...live.session_snapshot,
                original_question: `${live.session_snapshot.original_question} [raced]`,
              },
              last_committed_turn_id: "race_p1b_b",
            });
            assert.equal(ctx.expectedRevision, live.revision);
          },
          () =>
            executeAuthoritativeChatTurn({
              session: {
                ...seeded.snapshot,
                messages: [
                  ...(seeded.snapshot.messages ?? []),
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
              expected_revision: seeded.rev,
              locale: "zh",
            }),
        );
      } catch (e) {
        threw = e;
      }
      assert.ok(threw instanceof SessionAuthorityError);
      assert.equal((threw as SessionAuthorityError).code, "session_cas_conflict");

      const server = await requireAuthoritativeSession(sid);
      assert.equal(claimOf(server.session_snapshot, seeded.plan.plan_id)?.status, "released");
      assert.equal(activeClaimCount(server.session_snapshot), 0);
      assert.match(server.session_snapshot.original_question ?? "", /\[raced\]/);
    });
  });

  await check("Test C: uncertain commit keeps claim; no auto release or resend", async () => {
    await withAuthStore(async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_p1b_c",
        original_question: "要不要读研？",
      });
      const seeded = await seedPendingClarification({ sid, planId: "qp_p1b_c" });
      const t2 = "turn_p1b_c2";
      const msg2 = "导师和家庭期望还是对不上。";

      let threw: unknown = null;
      try {
        await runWithAuthoritativeCommitTestHook(
          async () => {
            throw new SessionAuthorityError(
              "server_persistence_unavailable",
              "session CAS timed out BUSY",
              { session_id: sid, recoverable: true },
            );
          },
          () =>
            executeAuthoritativeChatTurn({
              session: {
                ...seeded.snapshot,
                messages: [
                  ...(seeded.snapshot.messages ?? []),
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
              expected_revision: seeded.rev,
              locale: "zh",
            }),
        );
      } catch (e) {
        threw = e;
      }
      assert.ok(threw instanceof SessionAuthorityError);
      assert.equal(
        (threw as SessionAuthorityError).code,
        "server_persistence_unavailable",
      );

      const server = await requireAuthoritativeSession(sid);
      const claim = claimOf(server.session_snapshot, seeded.plan.plan_id);
      assert.equal(claim?.status, "claimed", "uncertain outcome must keep claim");
      assert.ok(activeClaimCount(server.session_snapshot) >= 1);

      // Reconcile marks awaiting_send_confirmation — does not auto-release or resend.
      const budget = server.session_snapshot.decision_understanding!.budget;
      const reconciled = reconcileClarificationClaims(
        budget,
        { sent_plan_ids: [] },
        new Date().toISOString(),
      );
      const recClaim = reconciled.clarification_claims?.find(
        (c) => c.plan_id === seeded.plan.plan_id,
      );
      assert.equal(recClaim?.status, "claimed");
      assert.equal(recClaim?.boundary_reason, "awaiting_send_confirmation");
    });
  });

  await check("Test D: durable commit confirms claim; replay does not double-send", async () => {
    await withAuthStore(async () => {
      const sid = await createPOJUSession({
        payment_id: "pay_p1b_d",
        original_question: "要不要创业？",
      });
      const seeded = await seedPendingClarification({ sid, planId: "qp_p1b_d" });
      const t2 = "turn_p1b_d2";
      const msg2 = "资金和时间窗口我还没讲清楚。";
      const result = await executeAuthoritativeChatTurn({
        session: {
          ...seeded.snapshot,
          messages: [
            ...(seeded.snapshot.messages ?? []),
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
        expected_revision: seeded.rev,
        locale: "zh",
      });
      assert.ok(result.ok && !result.aborted);
      const claim = claimOf(result.session, seeded.plan.plan_id);
      assert.ok(claim);
      assert.equal(claim!.status, "confirmed");
      assert.ok(claim!.send_event_id);
      assert.equal(activeClaimCount(result.session), 1);

      const server = await requireAuthoritativeSession(sid);
      assert.equal(claimOf(server.session_snapshot, seeded.plan.plan_id)?.status, "confirmed");

      // Replay same plan_id reserve must fail as already_confirmed.
      const again = await reserveClarificationClaimCas({
        session: server.session_snapshot,
        plan_id: seeded.plan.plan_id,
        now: new Date().toISOString(),
      });
      assert.equal(again.ok, false);
      assert.equal(again.block_reason, "already_confirmed");

      // Release must not undo confirmed (even with matching claimed_at).
      const releaseDenied = await releaseClarificationClaimCas({
        session: server.session_snapshot,
        plan_id: seeded.plan.plan_id,
        claimed_at: claim!.claimed_at,
        now: new Date().toISOString(),
      });
      assert.equal(releaseDenied.ok, false);
      assert.equal(releaseDenied.block_reason, "already_confirmed");
      const still = await requireAuthoritativeSession(sid);
      assert.equal(claimOf(still.session_snapshot, seeded.plan.plan_id)?.status, "confirmed");
    });
  });

  await check("Test E: concurrent last-slot race — loser cannot release winner", async () => {
    await withAuthStore(async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "p1b concurrent claim",
        device_id: "dev_p1b_e",
      });
      const now = new Date().toISOString();
      const baseSnap: POJUSessionState = {
        ...record.session_snapshot,
        decision_understanding: {
          ...(record.session_snapshot.decision_understanding as NonNullable<
            POJUSessionState["decision_understanding"]
          >),
          budget: {
            soft_budget_limit: 12,
            hard_budget_limit: 15,
            session_asked_count: 0,
            review_cycle: 1,
            cycle_base_asked: 0,
            remaining_hard_budget: 15,
            depth_by_dir: {},
            clarification_allowance: 1,
            clarification_rounds: 0,
            clarification_claims: [],
          },
          last_sent_question: null,
        },
      };
      await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: baseSnap,
        last_committed_turn_id: "seed_e",
      });
      const live = await requireAuthoritativeSession(record.session_id);

      const [a, b] = await Promise.all([
        reserveClarificationClaimCas({
          session: live.session_snapshot,
          plan_id: "plan_winner",
          now,
        }),
        reserveClarificationClaimCas({
          session: live.session_snapshot,
          plan_id: "plan_loser",
          now,
        }),
      ]);
      const wins = [a, b].filter((r) => r.ok);
      const losses = [a, b].filter((r) => !r.ok);
      assert.equal(wins.length, 1);
      assert.equal(losses.length, 1);
      assert.equal(losses[0]!.block_reason, "clarification_allowance_exhausted");

      const winnerPlan = a.ok ? "plan_winner" : "plan_loser";
      assert.ok(wins[0]!.reservation);
      assert.equal(losses[0]!.reservation, undefined);
      assert.equal(claimOf(wins[0]!.session, winnerPlan)?.status, "claimed");

      const after = await requireAuthoritativeSession(record.session_id);
      assert.equal(
        claimOf(after.session_snapshot, winnerPlan)?.status,
        "claimed",
        "loser must not release winner claim",
      );
      assert.equal(activeClaimCount(after.session_snapshot), 1);

      // Confirm winner; concurrent release must fail.
      const confirmedBudget = confirmClarification(
        after.session_snapshot.decision_understanding!.budget,
        winnerPlan,
        now,
        "send_winner",
      );
      const confirmedSnap: POJUSessionState = {
        ...after.session_snapshot,
        decision_understanding: {
          ...after.session_snapshot.decision_understanding!,
          budget: confirmedBudget,
        },
      };
      await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: after.revision,
        expectedGeneration: after.session_generation,
        snapshot: confirmedSnap,
        last_committed_turn_id: "confirm_e",
      });
      const deny = await releaseClarificationClaimCas({
        session: confirmedSnap,
        plan_id: winnerPlan,
        claimed_at: claimOf(confirmedSnap, winnerPlan)!.claimed_at,
        now,
      });
      assert.equal(deny.ok, false);
      assert.equal(deny.block_reason, "already_confirmed");
    });
  });

  await check("Test F: repeat release/retry/confirm guards", async () => {
    await withAuthStore(async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "p1b repeat guards",
        device_id: "dev_p1b_f",
      });
      const now = new Date().toISOString();
      const snap: POJUSessionState = {
        ...record.session_snapshot,
        decision_understanding: {
          ...(record.session_snapshot.decision_understanding as NonNullable<
            POJUSessionState["decision_understanding"]
          >),
          budget: {
            soft_budget_limit: 12,
            hard_budget_limit: 15,
            session_asked_count: 0,
            review_cycle: 1,
            cycle_base_asked: 0,
            remaining_hard_budget: 15,
            depth_by_dir: {},
            clarification_allowance: 3,
            clarification_rounds: 0,
            clarification_claims: [],
          },
          last_sent_question: null,
        },
      };
      await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: snap,
        last_committed_turn_id: "seed_f",
      });
      let live = await requireAuthoritativeSession(record.session_id);

      const reserved = await runWithClarificationClaimRequestScope(() =>
        reserveClarificationClaimCas({
          session: live.session_snapshot,
          plan_id: "plan_f",
          now,
        }),
      );
      assert.equal(reserved.ok, true);
      assert.ok(reserved.reservation);
      const ownedAt = reserved.reservation!.claimed_at;
      live = await requireAuthoritativeSession(record.session_id);
      assert.equal(activeClaimCount(live.session_snapshot), 1);

      const r1 = await releaseClarificationClaimCas({
        session: live.session_snapshot,
        plan_id: "plan_f",
        claimed_at: ownedAt,
        now,
      });
      assert.equal(r1.ok, true);
      live = await requireAuthoritativeSession(record.session_id);
      assert.equal(claimOf(live.session_snapshot, "plan_f")?.status, "released");
      assert.equal(activeClaimCount(live.session_snapshot), 0);

      const r2 = await releaseClarificationClaimCas({
        session: live.session_snapshot,
        plan_id: "plan_f",
        claimed_at: ownedAt,
        now,
      });
      assert.equal(r2.ok, true, "repeat release is idempotent");
      live = await requireAuthoritativeSession(record.session_id);
      assert.equal(activeClaimCount(live.session_snapshot), 0);

      // Released claim cannot be confirmed by a stale request.
      const budget = live.session_snapshot.decision_understanding!.budget;
      const noConfirm = confirmClarification(budget, "plan_f", now, "stale_send");
      assert.equal(
        noConfirm.clarification_claims?.find((c) => c.plan_id === "plan_f")?.status,
        "released",
      );

      // Pure helper: confirmed cannot be released.
      let b = claimClarification(
        {
          soft_budget_limit: 12,
          hard_budget_limit: 15,
          session_asked_count: 0,
          review_cycle: 1,
          cycle_base_asked: 0,
          remaining_hard_budget: 15,
          depth_by_dir: {},
          clarification_allowance: 3,
          clarification_claims: [],
        },
        "plan_f2",
        now,
      ).budget;
      b = confirmClarification(b, "plan_f2", now, "send_f2");
      const stillConfirmed = releaseClarification(b, "plan_f2", now);
      assert.equal(
        stillConfirmed.clarification_claims?.find((c) => c.plan_id === "plan_f2")?.status,
        "confirmed",
      );
    });
  });

  await check("Test G: same plan_id concurrent reserve — B cannot release A", async () => {
    await withAuthStore(async () => {
      const record = await initializeAuthoritativeSession({
        original_question: "p1b same plan ownership",
        device_id: "dev_p1b_g",
      });
      const now = new Date().toISOString();
      const baseSnap: POJUSessionState = {
        ...record.session_snapshot,
        decision_understanding: {
          ...(record.session_snapshot.decision_understanding as NonNullable<
            POJUSessionState["decision_understanding"]
          >),
          budget: {
            soft_budget_limit: 12,
            hard_budget_limit: 15,
            session_asked_count: 0,
            review_cycle: 1,
            cycle_base_asked: 0,
            remaining_hard_budget: 15,
            depth_by_dir: {},
            clarification_allowance: 3,
            clarification_rounds: 0,
            clarification_claims: [],
          },
          last_sent_question: null,
        },
      };
      await commitAuthoritativeSessionUpdate({
        sessionId: record.session_id,
        expectedRevision: record.revision,
        expectedGeneration: record.session_generation,
        snapshot: baseSnap,
        last_committed_turn_id: "seed_g",
      });
      const live = await requireAuthoritativeSession(record.session_id);
      const planId = "plan_shared_g";

      const a = await runWithClarificationClaimRequestScope(async () => {
        const reserved = await reserveClarificationClaimCas({
          session: live.session_snapshot,
          plan_id: planId,
          now,
        });
        assert.equal(reserved.ok, true);
        assert.ok(reserved.reservation);
        return reserved;
      });

      const b = await runWithClarificationClaimRequestScope(async () => {
        const held = await reserveClarificationClaimCas({
          session: live.session_snapshot,
          plan_id: planId,
          now,
        });
        assert.equal(held.ok, false);
        assert.equal(held.block_reason, "clarification_claim_held");
        assert.equal(held.reservation, undefined);

        // B observes A's claimed_at on authoritative snapshot but must not release.
        const server = await requireAuthoritativeSession(record.session_id);
        const observedAt = claimOf(server.session_snapshot, planId)!.claimed_at;
        const stolen = await releaseClarificationClaimCas({
          session: server.session_snapshot,
          plan_id: planId,
          claimed_at: observedAt,
          now,
        });
        assert.equal(stolen.ok, false);
        assert.equal(stolen.block_reason, "reservation_ownership_mismatch");
        return held;
      });
      assert.equal(b.ok, false);

      // A still holds the claim.
      let server = await requireAuthoritativeSession(record.session_id);
      assert.equal(claimOf(server.session_snapshot, planId)?.status, "claimed");

      // Empty request scope without a noted reservation cannot release A's claim.
      await runWithClarificationClaimRequestScope(async () => {
        const blocked = await releaseClarificationClaimCas({
          session: server.session_snapshot,
          plan_id: planId,
          claimed_at: a.reservation!.claimed_at,
          now,
        });
        assert.equal(blocked.ok, false);
        assert.equal(blocked.block_reason, "reservation_ownership_mismatch");
      });
      server = await requireAuthoritativeSession(record.session_id);
      assert.equal(claimOf(server.session_snapshot, planId)?.status, "claimed");

      // A releases using the reservation proof returned from its successful reserve
      // (no foreign request-scope frame).
      const releasedByA = await releaseClarificationClaimCas({
        session: server.session_snapshot,
        plan_id: planId,
        claimed_at: a.reservation!.claimed_at,
        now,
      });
      assert.equal(releasedByA.ok, true);

      server = await requireAuthoritativeSession(record.session_id);
      assert.equal(claimOf(server.session_snapshot, planId)?.status, "released");

      // After A released, B still cannot confirm the old claim.
      const noConfirm = confirmClarification(
        server.session_snapshot.decision_understanding!.budget,
        planId,
        now,
        "stale_b_send",
      );
      assert.equal(
        noConfirm.clarification_claims?.find((c) => c.plan_id === planId)?.status,
        "released",
      );

      // B also cannot release again with the old claimed_at inside its scope.
      await runWithClarificationClaimRequestScope(async () => {
        const again = await releaseClarificationClaimCas({
          session: server.session_snapshot,
          plan_id: planId,
          claimed_at: a.reservation!.claimed_at,
          now,
        });
        assert.equal(again.ok, false);
        assert.equal(again.block_reason, "reservation_ownership_mismatch");
      });
    });
  });

  console.log(`\nDone: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
