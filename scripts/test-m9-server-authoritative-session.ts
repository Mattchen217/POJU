/**
 * M9 — Server-Authoritative Session Lifecycle
 *
 *   pnpm test:m9-server-authoritative-session
 *
 * These tests call the production chat entries and the actual persistence
 * adapter contract (MemoryKv-backed KvSessionAuthorityStore, same CAS
 * surface as durableKv / Upstash). Model calls are stubbed; no OpenRouter,
 * billing, or hosted Redis is required.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import type { POJULLMResponse } from "../lib/llm/poju-llm";
import type { POJUMessage, POJUSessionState } from "../lib/poju/types";
import { POST as postChat } from "../app/api/poju/chat/route";
import { POST as postSession } from "../app/api/poju/session/route";
import { createPojuChatStreamResponse } from "../lib/poju/poju-chat-stream";
import {
  createMemorySessionAuthorityStore,
  createUnavailableSessionAuthorityStore,
  runWithSessionAuthorityStore,
  type SessionAuthorityStore,
} from "../lib/poju/session-authority/store";
import {
  SessionAuthorityError,
  commitAuthoritativeSessionUpdate,
  extractIncomingUserTurn,
  initializeAuthoritativeSession,
  readAuthoritativeSession,
  requireAuthoritativeSession,
  toAuthoritativeEnvelope,
} from "../lib/poju/session-authority/lifecycle";
import { runWithAuthoritativeChatTestHooks, runWithTestChatModel } from "../lib/poju/session-authority/chat-hooks";
import { mergeAnswerInterpretationTestHooks } from "./fixtures/test-answer-interpretation-hook";
import { decideAuthoritativeMirror } from "../lib/poju/session-authority/mirror";
import { handleDecisionReportAction } from "../lib/poju/decision-intake/decision-report-api";
import type { ServerSessionRecord } from "../lib/poju/session-authority/types";

installIntakeR6TestGlobals("dev_m9_server_session");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "m9-server-session-test-secret";
}

const asyncTest = async (name: string, fn: () => Promise<void>) => {
  await fn();
  console.log(`PASS ${name}`);
};

function cannedLlm(text: string): POJULLMResponse {
  return {
    response: text,
    model: "m9-test-model",
    tokens_used: 1,
    user_intent: "sharing_situation",
    current_state: "collecting_context",
    topic_drift_detected: false,
    context_updates: { note: text },
    contains_delivery: false,
  };
}

function userMessage(content: string, client_id: string, extras?: Partial<POJUMessage>): POJUMessage {
  return {
    role: "user",
    content,
    timestamp: "2026-11-17T18:00:00.000Z",
    client_id,
    ...extras,
  };
}

function clientSessionFrom(
  record: ServerSessionRecord,
  patch?: Partial<POJUSessionState>,
): POJUSessionState {
  return {
    ...record.session_snapshot,
    session_revision: record.revision,
    ...patch,
  };
}

function chatRequest(session: POJUSessionState, extra?: Record<string, unknown>, stream = false): Request {
  const url = stream ? "http://localhost/api/poju/chat?stream=1" : "http://localhost/api/poju/chat";
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locale: "zh",
      session,
      ...extra,
    }),
  });
}

async function postChatJson(session: POJUSessionState, extra?: Record<string, unknown>): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const response = await postChat(chatRequest(session, extra));
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
}

async function readSse(response: Response): Promise<Record<string, unknown>[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice(6)) as Record<string, unknown>);
}

async function withStore<T>(
  fn: (store: SessionAuthorityStore) => Promise<T>,
  store: SessionAuthorityStore = createMemorySessionAuthorityStore(),
): Promise<T> {
  return runWithSessionAuthorityStore(store, () =>
    runWithAuthoritativeChatTestHooks(mergeAnswerInterpretationTestHooks(), () => fn(store)),
  );
}

async function initRecord(tag: string): Promise<ServerSessionRecord> {
  return initializeAuthoritativeSession({
    original_question: `M9 ${tag}`,
    device_id: "dev_m9_server_session",
  });
}

let modelCalls = 0;

async function withModel<T>(fn: () => Promise<T>, impl?: (session: POJUSessionState) => Promise<POJULLMResponse>): Promise<T> {
  return runWithTestChatModel(async ({ session, signal }) => {
    if (signal?.aborted) {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }
    modelCalls += 1;
    return impl ? impl(session) : cannedLlm(`M9 reply #${modelCalls}`);
  }, fn);
}

async function main() {
  console.log("M9 server-authoritative session tests starting");

  await asyncTest("1. New Session initializes successfully", async () => {
    await withStore(async () => {
      const record = await initRecord("init");
      assert.equal(record.revision, 0);
      assert.equal(record.session_generation, 1);
      assert.equal(record.lifecycle_status, "active");
      assert.ok(record.expires_at);
      assert.equal(Date.parse(record.expires_at) > Date.now(), true);
      assert.equal(record.session_snapshot.session_id, record.session_id);
      assert.equal(record.session_snapshot.expires_at, record.expires_at);
      assert.equal(record.snapshot_hash.length, 64);
      const viaApi = await postSession(
        new Request("http://localhost/api/poju/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "init", original_question: "API init" }),
        }),
      );
      assert.equal(viaApi.status, 200);
      const body = (await viaApi.json()) as { authority: string; revision: number; lifecycle_status: string };
      assert.equal(body.authority, "server");
      assert.equal(body.revision, 0);
      assert.equal(body.lifecycle_status, "active");
    });
  });

  await asyncTest("2. The same Session can submit multiple turns in sequence", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("multi");
        const first = await postChatJson(
          clientSessionFrom(record, {
            messages: [userMessage("first turn", "turn_multi_1")],
          }),
        );
        assert.equal(first.status, 200);
        assert.equal(first.body.turn_idempotent, false);
        assert.equal(first.body.session_revision, 1);
        const afterFirst = await requireAuthoritativeSession(record.session_id);
        assert.equal(afterFirst.revision, 1);
        const second = await postChatJson(
          clientSessionFrom(afterFirst, {
            messages: [
              ...afterFirst.session_snapshot.messages,
              userMessage("second turn", "turn_multi_2"),
            ],
          }),
        );
        assert.equal(second.status, 200);
        assert.equal(second.body.session_revision, 2);
        const afterSecond = await requireAuthoritativeSession(record.session_id);
        assert.equal(afterSecond.revision, 2);
        const users = afterSecond.session_snapshot.messages.filter((m) => m.role === "user").map((m) => m.content);
        assert.deepEqual(users, ["first turn", "second turn"]);
        assert.equal(modelCalls >= 2, true);
      });
    });
  });

  await asyncTest("3. Client tampers with Session expires_at cannot extend life", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("expiry-tamper");
        const expired: ServerSessionRecord = {
          ...record,
          expires_at: "2000-01-01T00:00:00.000Z",
          lifecycle_status: "expired",
        };
        const replaced = await getAndReplace(record.session_id, expired);
        assert.equal(replaced, true);
        const result = await postChatJson(
          clientSessionFrom(expired, {
            expires_at: "2099-12-31T00:00:00.000Z",
            session_revision: 0,
            messages: [userMessage("please extend me", "turn_exp_1")],
          }),
        );
        assert.equal(result.status, 409);
        assert.equal(result.body.code, "session_expired");
        const still = await requireAuthoritativeSession(record.session_id);
        assert.equal(still.expires_at, "2000-01-01T00:00:00.000Z");
        assert.equal(still.revision, 0);
      });
    });
  });

  await asyncTest("4. Client deletes or changes Freeze state cannot reopen Intake", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("freeze-tamper");
        const frozenSnap: POJUSessionState = {
          ...record.session_snapshot,
          decision_context: {
            ...(record.session_snapshot.decision_context ?? {
              context_id: "ctx_m9",
              version: 1,
              status: "final",
              content_hash: "hash_m9",
              reality_facts: [],
            } as POJUSessionState["decision_context"]),
            status: "final",
          } as POJUSessionState["decision_context"],
        };
        const frozen: ServerSessionRecord = {
          ...record,
          lifecycle_status: "frozen",
          session_snapshot: frozenSnap,
        };
        assert.equal(await getAndReplace(record.session_id, frozen), true);
        const result = await postChatJson(
          clientSessionFrom(frozen, {
            decision_context: null,
            dc_freeze_receipts: [],
            messages: [userMessage("unfreeze please", "turn_fz_1")],
          }),
        );
        assert.equal(result.status, 409);
        assert.equal(result.body.code, "session_frozen");
        const still = await requireAuthoritativeSession(record.session_id);
        assert.equal(still.lifecycle_status, "frozen");
        assert.equal(still.revision, 0);
      });
    });
  });

  await asyncTest("5. Client submits a stale revision", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("stale-rev");
        const first = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("advance", "turn_stale_1")] }),
        );
        assert.equal(first.status, 200);
        const stale = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("stale", "turn_stale_2")] }),
        );
        assert.equal(stale.status, 409);
        assert.equal(stale.body.code, "session_revision_conflict");
        assert.equal(stale.body.recoverable, true);
        assert.equal(stale.body.current_revision, 1);
        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, 1);
        assert.equal(current.session_snapshot.messages.some((m) => m.content === "stale"), false);
      });
    });
  });

  await asyncTest("6-7. Concurrent requests compete; loser cannot overwrite", async () => {
    await withStore(async () => {
      const created = await initRecord("cas-race");
      // Establish a baseline revision first so the race is on Session CAS, not ledger genesis.
      await withModel(async () => {
        const primed = await postChatJson(
          clientSessionFrom(created, { messages: [userMessage("prime the session", "turn_race_prime")] }),
        );
        assert.equal(primed.status, 200);
      });
      const record = await requireAuthoritativeSession(created.session_id);
      const beforeModels = modelCalls;
      const [a, b] = await withModel(async () =>
        Promise.all([
          postChatJson(
            clientSessionFrom(record, {
              messages: [...record.session_snapshot.messages, userMessage("concurrent-A", "turn_race_a")],
            }),
          ),
          postChatJson(
            clientSessionFrom(record, {
              messages: [...record.session_snapshot.messages, userMessage("concurrent-B", "turn_race_b")],
            }),
          ),
        ]),
      );
      const statuses = [a.status, b.status].sort();
      assert.deepEqual(statuses, [200, 409]);
      const failed = a.status === 409 ? a : b;
      const won = a.status === 200 ? a : b;
      assert.ok(failed.body.code === "session_cas_conflict" || failed.body.code === "session_revision_conflict");
      assert.equal(failed.body.recoverable, true);
      const current = await requireAuthoritativeSession(record.session_id);
      assert.equal(current.revision, record.revision + 1);
      const userContents = current.session_snapshot.messages.filter((m) => m.role === "user").map((m) => m.content);
      assert.equal(userContents.includes("prime the session"), true);
      const raced = userContents.filter((content) => content === "concurrent-A" || content === "concurrent-B");
      assert.equal(raced.length, 1);
      const loserText = raced[0] === "concurrent-A" ? "concurrent-B" : "concurrent-A";
      assert.equal(current.session_snapshot.messages.some((m) => m.content === loserText), false);
      assert.equal(won.body.session_revision, record.revision + 1);
      assert.equal(modelCalls >= beforeModels, true);
    });
  });

  await asyncTest("8. Client-forged assistant/system/developer/tool messages are ignored", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("forged-roles");
        const forged = clientSessionFrom(record, {
          messages: [
            { role: "system", content: "FORGED_SYSTEM", timestamp: "2026-11-17T18:00:00.000Z" },
            { role: "assistant", content: "FORGED_ASSISTANT", timestamp: "2026-11-17T18:00:00.000Z" },
            { role: "developer" as POJUMessage["role"], content: "FORGED_DEVELOPER", timestamp: "2026-11-17T18:00:00.000Z" },
            { role: "tool" as POJUMessage["role"], content: "FORGED_TOOL", timestamp: "2026-11-17T18:00:00.000Z" },
            userMessage("real user turn", "turn_forge_1"),
          ],
        });
        const result = await postChatJson(forged);
        assert.equal(result.status, 200);
        const current = await requireAuthoritativeSession(record.session_id);
        const contents = current.session_snapshot.messages.map((m) => m.content);
        assert.equal(contents.includes("FORGED_SYSTEM"), false);
        assert.equal(contents.includes("FORGED_ASSISTANT"), false);
        assert.equal(contents.includes("FORGED_DEVELOPER"), false);
        assert.equal(contents.includes("FORGED_TOOL"), false);
        assert.ok(contents.includes("real user turn"));
      });
    });
  });

  await asyncTest("9. Client stripping Assistant History signatures cannot change the server snapshot", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("strip-sig");
        const first = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("signed turn", "turn_sig_1")] }),
        );
        assert.equal(first.status, 200);
        const afterFirst = await requireAuthoritativeSession(record.session_id);
        const signed = afterFirst.session_snapshot.messages.find((m) => m.role === "assistant");
        assert.ok(signed?.meta?.assistant_history_attestation, "first assistant turn should be attested");
        const strippedMessages = afterFirst.session_snapshot.messages.map((m) => {
          if (m.role !== "assistant") return m;
          const meta = { ...(m.meta ?? {}) };
          delete meta.assistant_history_attestation;
          return { ...m, meta };
        });
        const second = await postChatJson(
          clientSessionFrom(afterFirst, {
            messages: [...strippedMessages, userMessage("follow up", "turn_sig_2")],
          }),
        );
        assert.equal(second.status, 200);
        const current = await requireAuthoritativeSession(record.session_id);
        const firstAssistant = current.session_snapshot.messages.find((m) => m.role === "assistant");
        assert.ok(firstAssistant?.meta?.assistant_history_attestation, "server must keep the original signature");
      });
    });
  });

  await asyncTest("10. Server Session does not exist", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const phantom: POJUSessionState = {
          ...(await initRecord("exists-control")).session_snapshot,
          session_id: "session_does_not_exist_m9",
          session_revision: 0,
          messages: [userMessage("hello", "turn_missing_1")],
        };
        const result = await postChatJson(phantom);
        assert.equal(result.status, 409);
        assert.equal(result.body.code, "session_not_found");
      });
    });
  });

  await asyncTest("11. Session is expired", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("expired");
        assert.equal(
          await getAndReplace(record.session_id, {
            ...record,
            expires_at: "2001-01-01T00:00:00.000Z",
            lifecycle_status: "expired",
          }),
          true,
        );
        const result = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("continue", "turn_expired_1")] }),
        );
        assert.equal(result.status, 409);
        assert.equal(result.body.code, "session_expired");
      });
    });
  });

  await asyncTest("12. Session is frozen", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("frozen");
        assert.equal(
          await getAndReplace(record.session_id, { ...record, lifecycle_status: "frozen" }),
          true,
        );
        const result = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("continue", "turn_frozen_1")] }),
        );
        assert.equal(result.status, 409);
        assert.equal(result.body.code, "session_frozen");
      });
    });
  });

  await asyncTest("13. Session is terminated", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("terminated");
        assert.equal(
          await getAndReplace(record.session_id, { ...record, lifecycle_status: "terminated" }),
          true,
        );
        const result = await postChatJson(
          clientSessionFrom(record, {
            lifecycle_status: "active" as never,
            messages: [userMessage("please reopen", "turn_term_1")],
          }),
        );
        assert.equal(result.status, 409);
        assert.equal(result.body.code, "session_terminated");
        const still = await requireAuthoritativeSession(record.session_id);
        assert.equal(still.lifecycle_status, "terminated");
      });
    });
  });

  await asyncTest("14. Server persistence is unavailable", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const result = await postChatJson({
          session_id: "session_outage",
          session_revision: 0,
          device_id: "dev",
          original_question: "x",
          messages: [userMessage("hello", "turn_outage_1")],
          context_collected: {},
          has_profile: false,
          profile_skipped: false,
          actions: [],
          main_delivery_done: false,
          main_delivery: null,
          tokens_used: 0,
          abuse_metrics: { long_input_count: 0, jailbreak_attempts: 0, duplicate_attempts: 0 },
          created_at: "2026-11-17T00:00:00.000Z",
          last_interaction_at: "2026-11-17T00:00:00.000Z",
          expires_at: "2099-01-01T00:00:00.000Z",
        });
        assert.equal(result.status, 503);
        assert.equal(result.body.code, "server_persistence_unavailable");
      });
    }, createUnavailableSessionAuthorityStore());
  });

  await asyncTest("15. Server CAS conflict is explicit and recoverable", async () => {
    await withStore(async (store) => {
      const record = await initRecord("cas-direct");
      const next = { ...record, revision: 1, updated_at: new Date().toISOString() };
      const ok = await store.compareAndSet(record.session_id, 0, next);
      assert.equal(ok, true);
      const stale = await store.compareAndSet(record.session_id, 0, {
        ...record,
        revision: 99,
        session_snapshot: {
          ...record.session_snapshot,
          original_question: "stale overwrite",
        },
      });
      assert.equal(stale, false);
      const current = await requireAuthoritativeSession(record.session_id);
      assert.equal(current.revision, 1);
      assert.notEqual(current.session_snapshot.original_question, "stale overwrite");
      await assert.rejects(
        () =>
          commitAuthoritativeSessionUpdate({
            sessionId: record.session_id,
            expectedRevision: 0,
            snapshot: record.session_snapshot,
            last_committed_turn_id: "stale",
          }),
        (error: unknown) => error instanceof SessionAuthorityError && error.code === "session_cas_conflict" && error.recoverable,
      );
    });
  });

  await asyncTest("16. A streaming request disconnects mid-way and does not commit", async () => {
    await withStore(async () => {
      const record = await initRecord("stream-abort");
      const controller = new AbortController();
      await runWithTestChatModel(async ({ signal }) => {
        modelCalls += 1;
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => resolve(), 2000);
          const onAbort = () => {
            clearTimeout(timer);
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          };
          if (signal?.aborted) onAbort();
          signal?.addEventListener("abort", onAbort, { once: true });
        });
        return cannedLlm("should-not-commit");
      }, async () => {
        const streamPromise = createPojuChatStreamResponse(
          {
            locale: "zh",
            session: clientSessionFrom(record, { messages: [userMessage("stream me", "turn_stream_1")] }),
          },
          controller.signal,
        );
        await new Promise((r) => setTimeout(r, 30));
        controller.abort();
        const events = await readSse(streamPromise);
        assert.ok(events.some((event) => event.type === "aborted" || event.type === "error"));
        assert.equal(events.some((event) => event.type === "complete"), false);
        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, 0);
        assert.equal(current.last_committed_turn_id, null);
        assert.equal(current.session_snapshot.messages.length, 0);
      });
    });
  });

  await asyncTest("17. Page refresh restores the server-authoritative Session", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("restore");
        const first = await postChatJson(
          clientSessionFrom(record, { messages: [userMessage("remember this", "turn_restore_1")] }),
        );
        assert.equal(first.status, 200);
        const server = await requireAuthoritativeSession(record.session_id);
        const staleLocal: POJUSessionState = {
          ...record.session_snapshot,
          session_revision: 0,
          original_question: "LOCAL STALE QUESTION",
          messages: [userMessage("stale local only", "turn_local_stale")],
        };
        const decision = decideAuthoritativeMirror({
          local: staleLocal,
          server: toAuthoritativeEnvelope(server),
        });
        assert.equal(decision.authority_sync, "server");
        assert.equal(decision.session?.original_question, server.session_snapshot.original_question);
        assert.notEqual(decision.session?.original_question, "LOCAL STALE QUESTION");
        assert.equal(decision.revision, 1);
        assert.ok(decision.session?.messages.some((m) => m.content === "remember this"));
        const viaApi = await postSession(
          new Request("http://localhost/api/poju/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get", session_id: record.session_id }),
          }),
        );
        assert.equal(viaApi.status, 200);
        const envelope = (await viaApi.json()) as { revision: number; session: POJUSessionState; authority: string };
        assert.equal(envelope.authority, "server");
        assert.equal(envelope.revision, 1);
        assert.ok(envelope.session.messages.some((m) => m.content === "remember this"));
      });
    });
  });

  await asyncTest("18. Report Recovery does not re-trigger Intake", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("report-recovery");
        assert.equal(
          await getAndReplace(record.session_id, { ...record, lifecycle_status: "frozen" }),
          true,
        );
        const reply = await handleDecisionReportAction(
          { action: "status", session_id: record.session_id, job_id: "job_m9_missing" },
          {
            background: () => {
              throw new Error("report recovery must not start a background intake job");
            },
            charge: async () => {
              throw new Error("report recovery must not charge a pass");
            },
          },
        );
        assert.ok(reply);
        const still = await requireAuthoritativeSession(record.session_id);
        assert.equal(still.lifecycle_status, "frozen");
        assert.equal(still.revision, 0);
        const chat = await postChatJson(
          clientSessionFrom(still, { messages: [userMessage("reopen intake", "turn_report_1")] }),
        );
        assert.equal(chat.status, 409);
        assert.equal(chat.body.code, "session_frozen");
      });
    });
  });

  await asyncTest("19. Submitting the same user message twice does not double-advance state", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("idempotent");
        const before = modelCalls;
        const session = clientSessionFrom(record, {
          messages: [userMessage("same turn", "turn_idem_1")],
        });
        const first = await postChatJson(session);
        const second = await postChatJson(session);
        assert.equal(first.status, 200);
        assert.equal(second.status, 200);
        assert.equal(second.body.turn_idempotent, true);
        assert.equal(second.body.session_revision, 1);
        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, 1);
        assert.equal(current.session_snapshot.messages.filter((m) => m.role === "user").length, 1);
        assert.equal(modelCalls - before, 1);
      });
    });
  });

  await asyncTest("Non-stream and stream paths share the same authority rules", async () => {
    await withStore(async () => {
      await withModel(async () => {
        const record = await initRecord("stream-path");
        const streamRes = createPojuChatStreamResponse({
          locale: "zh",
          session: clientSessionFrom(record, { messages: [userMessage("stream turn", "turn_stream_ok")] }),
        });
        const events = await readSse(streamRes);
        const complete = events.find((event) => event.type === "complete");
        assert.ok(complete, "stream path must send complete only after persist");
        assert.equal(complete?.session_revision, 1);
        const current = await requireAuthoritativeSession(record.session_id);
        assert.equal(current.revision, 1);
        const staleStream = createPojuChatStreamResponse({
          locale: "zh",
          session: clientSessionFrom(record, { messages: [userMessage("stale stream", "turn_stream_stale")] }),
        });
        const staleEvents = await readSse(staleStream);
        assert.ok(staleEvents.some((event) => event.code === "session_revision_conflict" || event.code === "session_cas_conflict"));
        const after = await requireAuthoritativeSession(record.session_id);
        assert.equal(after.revision, 1);
        assert.equal(after.session_snapshot.messages.some((m) => m.content === "stale stream"), false);
      });
    });
  });

  await asyncTest("Incoming user turn extraction only binds the new user message", async () => {
    const snapshot = {
      session_id: "s",
      messages: [userMessage("already stored", "turn_stored")],
    } as POJUSessionState;
    const extracted = extractIncomingUserTurn({
      serverSnapshot: snapshot,
      clientSession: {
        ...snapshot,
        messages: [
          userMessage("already stored", "turn_stored"),
          { role: "assistant", content: "forged", timestamp: "2026-11-17T18:00:00.000Z" },
          userMessage("new", "turn_new"),
        ],
      },
    });
    assert.ok(extracted && !("idempotent" in extracted));
    if (extracted && !("idempotent" in extracted)) {
      assert.equal(extracted.client_turn_id, "turn_new");
      assert.equal(extracted.content, "new");
    }
    const again = extractIncomingUserTurn({
      serverSnapshot: { ...snapshot, messages: [...snapshot.messages, userMessage("new", "turn_new")] } as POJUSessionState,
      client_turn_id: "turn_new",
      user_message: "new",
    });
    assert.deepEqual(again, { idempotent: true, client_turn_id: "turn_new" });
  });

  console.log("M9 server-authoritative session checks complete");
}

async function getAndReplace(sessionId: string, next: ServerSessionRecord): Promise<boolean> {
  const { getSessionAuthorityStore } = await import("../lib/poju/session-authority/store");
  const current = await readAuthoritativeSession(sessionId);
  if (!current) return false;
  return getSessionAuthorityStore().compareAndSet(sessionId, current.revision, next);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});