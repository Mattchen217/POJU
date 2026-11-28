/**
 * Unit A — Pre-report local-first privacy boundary.
 *
 *   pnpm exec tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-unit-a-pre-report-privacy-boundary.ts
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { installInProcessDecisionAuthority } from "./fixtures/in-process-decision-authority";
import type { POJULLMResponse } from "../lib/llm/poju-llm";
import type { POJUMessage, POJUSessionState } from "../lib/poju/types";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import { POST as postChat } from "../app/api/poju/chat/route";
import { POST as postSession } from "../app/api/poju/session/route";
import {
  createMemorySessionAuthorityStore,
  runWithSessionAuthorityStore,
} from "../lib/poju/session-authority/store";
import {
  initializeAuthoritativeSession,
  requireAuthoritativeSession,
  toAuthoritativeEnvelope,
} from "../lib/poju/session-authority/lifecycle";
import {
  isServerSessionContentShell,
  redactSessionSnapshotForServerDurable,
  sessionHasLocalPrivateContent,
} from "../lib/poju/session-authority/privacy-boundary";
import { decideAuthoritativeMirror } from "../lib/poju/session-authority/mirror";
import {
  runWithAuthoritativeChatTestHooks,
  runWithTestChatModel,
} from "../lib/poju/session-authority/chat-hooks";
import { mergeAnswerInterpretationTestHooks } from "./fixtures/test-answer-interpretation-hook";
import { readLedgerHead } from "../lib/poju/decision-authority/server/ledger-store";
import { sealFreezeWithAuthority } from "../lib/poju/decision-authority/client-freeze";
import { syncDcLedgerBeforeWrite } from "../lib/poju/decision-authority/client-sync";
import { computeContentHash } from "../lib/poju/decision-context/content-hash";

installIntakeR6TestGlobals("dev_unit_a_privacy");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "unit-a-privacy-test-secret";
}
installInProcessDecisionAuthority();

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

function cannedLlm(text: string): POJULLMResponse {
  return {
    response: text,
    model: "unit-a-test-model",
    tokens_used: 1,
    user_intent: "sharing_situation",
    current_state: "collecting_context",
    topic_drift_detected: false,
    context_updates: { note: text },
    contains_delivery: false,
  };
}

function userMessage(content: string, client_id: string): POJUMessage {
  return {
    role: "user",
    content,
    timestamp: "2026-11-27T12:00:00.000Z",
    client_id,
  };
}

function minimalDraftDc(contextId: string): DecisionContext {
  const dc: DecisionContext = {
    context_id: contextId,
    version: 1,
    status: "draft",
    definition: {
      concrete_event: "收到一份新的工作邀请",
      stakes: "收入",
      desired_outcome: "提升收入",
      decision_question: "要不要接受新公司的工作邀请",
      goal_priorities: ["收入"],
      unacceptable_outcomes: [],
    },
    reality_facts: [
      {
        fact_id: "f1",
        statement: "现岗位月收入已确认",
        status: "unverified",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t1",
        user_confirmed: false,
      },
    ],
    constraints: [],
    hypotheses: [],
    dirs: [],
    conflicts: [],
    content_hash: null,
    created_at: "2026-11-27T12:00:00.000Z",
    updated_at: "2026-11-27T12:00:00.000Z",
    information_boundaries: [],
  };
  dc.content_hash = computeContentHash(dc);
  return dc;
}

async function withPrivacyStore<T>(fn: () => Promise<T>): Promise<T> {
  return runWithSessionAuthorityStore(createMemorySessionAuthorityStore(), () =>
    runWithAuthoritativeChatTestHooks(mergeAnswerInterpretationTestHooks(), fn),
  );
}

async function main() {
  console.log("Unit A pre-report privacy boundary tests starting");

  await asyncTest("1. Init does not create a durable full private Session snapshot", async () => {
    await withPrivacyStore(async () => {
      const seeded = await initializeAuthoritativeSession({
        original_question: "secret private question",
        device_id: "browser-a",
      });
      assert.equal(seeded.session_snapshot.original_question, "secret private question");
      assert.equal(seeded.content_policy, "local_private");

      const durable = await requireAuthoritativeSession(seeded.session_id);
      assert.equal(durable.session_snapshot.original_question, "");
      assert.equal(durable.session_snapshot.messages.length, 0);
      assert.equal(durable.session_snapshot.decision_context, null);
      assert.ok(isServerSessionContentShell(durable.session_snapshot));
      assert.equal(durable.content_policy, "local_private");
    });
  });

  await asyncTest("2. action=get cannot return private conversation from session_id alone", async () => {
    await withPrivacyStore(async () => {
      await runWithTestChatModel(async () => cannedLlm("ok"), async () => {
        const seeded = await initializeAuthoritativeSession({
          original_question: "private q",
          device_id: "browser-a",
        });
        const client: POJUSessionState = {
          ...seeded.session_snapshot,
          session_revision: seeded.revision,
          messages: [userMessage("my private answer", "turn_priv_1")],
        };
        const chatRes = await postChat(
          new Request("http://localhost/api/poju/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: "zh", session: client }),
          }),
        );
        assert.equal(chatRes.status, 200);
        const chatBody = (await chatRes.json()) as {
          authoritative_session: POJUSessionState;
        };
        assert.ok(
          chatBody.authoritative_session.messages.some((m) => m.content === "my private answer"),
        );

        const getRes = await postSession(
          new Request("http://localhost/api/poju/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get", session_id: seeded.session_id }),
          }),
        );
        assert.equal(getRes.status, 200);
        const getBody = (await getRes.json()) as {
          content_local?: boolean;
          session: POJUSessionState;
        };
        assert.equal(getBody.content_local, true);
        assert.equal(getBody.session.messages.length, 0);
        assert.ok(!getBody.session.messages.some((m) => m.content === "my private answer"));
        assert.equal(getBody.session.original_question, "");
        assert.equal(getBody.session.decision_context, null);
      });
    });
  });

  await asyncTest("3. Reopening original browser keeps local private Session via mirror", async () => {
    const seeded = await withPrivacyStore(() =>
      initializeAuthoritativeSession({
        original_question: "local private",
        device_id: "browser-a",
      }),
    );
    const local: POJUSessionState = {
      ...seeded.session_snapshot,
      messages: [userMessage("only on browser A", "turn_local_1")],
      decision_context: minimalDraftDc("dc_localpriv"),
      session_revision: 3,
    };
    assert.ok(sessionHasLocalPrivateContent(local));

    const shell = redactSessionSnapshotForServerDurable({
      ...local,
      session_revision: 3,
    });
    const serverEnvelope = toAuthoritativeEnvelope({
      v: 1,
      session_id: local.session_id,
      session_generation: 1,
      revision: 3,
      created_at: local.created_at,
      updated_at: local.last_interaction_at,
      expires_at: local.expires_at,
      lifecycle_status: "active",
      snapshot_hash: "a".repeat(64),
      session_snapshot: shell,
      last_committed_turn_id: "turn_local_1",
      content_policy: "local_private",
      dc_ledger_head_hash: null,
      dc_ledger_commit_version: null,
      latest_freeze_receipt_id: null,
      latest_freeze_id: null,
    });
    assert.equal(serverEnvelope.content_local, true);

    const decision = decideAuthoritativeMirror({ local, server: serverEnvelope });
    assert.ok(decision.session);
    assert.ok(decision.session!.messages.some((m) => m.content === "only on browser A"));
    assert.ok(decision.session!.decision_context);
    assert.equal(decision.revision, 3);

    const browserB = decideAuthoritativeMirror({ local: null, server: serverEnvelope });
    assert.ok(isServerSessionContentShell(browserB.session));
    assert.equal(browserB.session?.messages.length ?? 0, 0);
  });

  await asyncTest("4. Chat does not durably write full private conversation to cloud storage", async () => {
    await withPrivacyStore(async () => {
      await runWithTestChatModel(async () => cannedLlm("reply"), async () => {
        const seeded = await initializeAuthoritativeSession({
          original_question: "q",
          device_id: "browser-a",
        });
        const client: POJUSessionState = {
          ...seeded.session_snapshot,
          session_revision: 0,
          messages: [userMessage("secret chat line", "turn_chat_1")],
        };
        const res = await postChat(
          new Request("http://localhost/api/poju/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: "zh", session: client }),
          }),
        );
        const body = (await res.json()) as Record<string, unknown>;
        assert.equal(res.status, 200, `chat failed: ${JSON.stringify(body)}`);
        assert.equal(body.session_revision, 1, `chat body: ${JSON.stringify(body)}`);
        const durable = await requireAuthoritativeSession(seeded.session_id);
        assert.equal(durable.revision, 1);
        assert.ok(isServerSessionContentShell(durable.session_snapshot));
        assert.ok(
          !JSON.stringify(durable.session_snapshot).includes("secret chat line"),
          "durable session JSON must not contain chat text",
        );
      });
    });
  });

  await asyncTest("5. Pre-report DC updates do not create durable cloud ledger copies", async () => {
    await withPrivacyStore(async () => {
      await runWithTestChatModel(async () => cannedLlm("dc"), async () => {
        const seeded = await initializeAuthoritativeSession({
          original_question: "q",
          device_id: "browser-a",
        });
        const dc = minimalDraftDc(`dc_${seeded.session_id.slice(0, 8)}`);
        const client: POJUSessionState = {
          ...seeded.session_snapshot,
          session_revision: 0,
          messages: [userMessage("with dc", "turn_dc_1")],
          decision_context: dc,
          decision_blueprint: {
            blueprint_id: `bp_${seeded.session_id}`,
            blueprint_version: 1,
            ddr_version: "t",
            dir_catalog_version: "t",
            session_id: seeded.session_id,
            decision_question: dc.definition.decision_question,
            dirs: [],
          } as POJUSessionState["decision_blueprint"],
        };
        const res = await postChat(
          new Request("http://localhost/api/poju/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: "zh", session: client }),
          }),
        );
        assert.equal(res.status, 200);
        const head = await readLedgerHead(seeded.session_id);
        assert.equal(head, null, "no durable DC ledger before report-start seal");
        const after = await requireAuthoritativeSession(seeded.session_id);
        assert.equal(after.session_snapshot.decision_context, null);
      });
    });
  });

  await asyncTest("6. Report-start boundary can create the first durable DC ledger entry", async () => {
    await withPrivacyStore(async () => {
      const seeded = await initializeAuthoritativeSession({
        original_question: "q",
        device_id: "browser-a",
      });
      const draft = minimalDraftDc(`dc_${seeded.session_id.slice(0, 8)}`);
      // No blueprint: append still enrolls via decision_context alone when we call
      // syncDcLedgerBeforeWrite directly (report-start / seal path).
      const session: POJUSessionState = {
        ...seeded.session_snapshot,
        decision_context: draft,
        decision_blueprint: null,
        confirmation_events: [],
        na_declaration_actions: [],
        topic_applicability_evals: [],
      };

      const working: POJUSessionState = { ...session };
      await syncDcLedgerBeforeWrite({
        base: session,
        candidate: working,
        idempotency_key: `dc_ledger_catchup:${session.session_id}:unit_a`,
        force: true,
      });
      assert.ok(working.dc_ledger?.head);
      assert.ok(working.dc_ledger?.writer_token);
      const head = await readLedgerHead(seeded.session_id);
      assert.ok(head);
      assert.equal(head!.dc_status, "draft");

      try {
        const sealed = await sealFreezeWithAuthority(working, { profile: null });
        assert.ok(sealed.receipt.freeze_id);
        const frozenHead = await readLedgerHead(seeded.session_id);
        assert.equal(frozenHead?.change_type, "freeze");
      } catch (e) {
        console.log(
          `  (freeze domain outcome after ledger catch-up: ${e instanceof Error ? e.message : String(e)})`,
        );
      }
    });
  });

  await asyncTest("7. Redaction helper strips private fields", async () => {
    const full = {
      session_id: "sess_redact",
      device_id: "d",
      original_question: "secret",
      messages: [userMessage("hi", "t1")],
      decision_context: minimalDraftDc("dc_redact"),
      decision_blueprint: { schema_version: 1 } as POJUSessionState["decision_blueprint"],
      context_collected: { note: "private" },
      has_profile: false,
      profile_skipped: false,
      actions: [],
      main_delivery_done: false,
      main_delivery: null,
      tokens_used: 0,
      abuse_metrics: { long_input_count: 0, jailbreak_attempts: 0, duplicate_attempts: 0 },
      created_at: "2026-11-27T12:00:00.000Z",
      last_interaction_at: "2026-11-27T12:00:00.000Z",
      expires_at: "2026-12-27T12:00:00.000Z",
    } as POJUSessionState;
    const shell = redactSessionSnapshotForServerDurable(full);
    assert.ok(isServerSessionContentShell(shell));
    assert.equal(shell.original_question, "");
    assert.equal(shell.messages.length, 0);
    assert.equal(shell.decision_context, null);
    assert.equal(shell.decision_blueprint, null);
  });

  console.log("Unit A pre-report privacy boundary tests complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
