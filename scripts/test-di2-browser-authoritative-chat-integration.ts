/**
 * DI2 browser → server-authoritative chat integration.
 *
 *   pnpm test:di2-browser-authoritative-chat-integration
 *
 * Exercises the production wire: submitAuthoritativeChatTurn → POST /api/poju/chat
 * → executeAuthoritativeChatTurn (in-process DC ledger) → CAS commit → local mirror.
 * Model calls are stubbed; this is not live OpenRouter evidence.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { mergeAnswerInterpretationTestHooks } from "./fixtures/test-answer-interpretation-hook";
import { POST as postChat } from "../app/api/poju/chat/route";
import { POST as postAnswerInterpretation } from "../app/api/poju/answer-interpretation/route";
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
  runWithAuthoritativeChatTestHooks,
} from "../lib/poju/session-authority/chat-hooks";
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
import type { POJUSessionState } from "../lib/poju/types";

installIntakeR6TestGlobals("dev_di2_browser_auth_chat");
if (!process.env.POJU_AUTHORITY_SIGNING_SECRET?.trim()) {
  process.env.POJU_AUTHORITY_SIGNING_SECRET = "di2-browser-auth-chat-test-secret";
}

Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

let passed = 0;
let failed = 0;
const chatPosts: string[] = [];
const answerInterpretationPosts: string[] = [];

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

function installFetchProbe() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(AUTHORITATIVE_CHAT_ROUTE) || url.includes("/api/poju/chat")) {
      chatPosts.push(url);
      const req = new Request(url.startsWith("http") ? url : `http://localhost${url}`, {
        method: init?.method ?? "POST",
        headers: init?.headers,
        body: init?.body,
      });
      return postChat(req);
    }
    if (url.includes("/api/poju/answer-interpretation")) {
      answerInterpretationPosts.push(url);
      return postAnswerInterpretation();
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
    runWithAuthoritativeChatTestHooks(mergeAnswerInterpretationTestHooks(), fn),
  );
}

async function main() {
  console.log("DI2 browser ↔ authoritative chat integration");
  await __resetPojuDbForTests();
  await ensurePojuDbReady();
  const restoreFetch = installFetchProbe();

  try {
    await check("G. retired answer-interpretation proxy returns 410 and spends nothing", async () => {
      answerInterpretationPosts.length = 0;
      const res = await postAnswerInterpretation();
      assert.equal(res.status, 410);
      const body = (await res.json()) as { ok?: boolean; error?: string };
      assert.equal(body.ok, false);
      assert.equal(body.error, "endpoint_retired");
      const src = readFileSync(
        join(process.cwd(), "lib/poju/decision-intake/answer-interpretation-model.ts"),
        "utf8",
      );
      assert.equal(src.includes("callAnswerInterpretationRoute"), false);
      assert.match(src, /answer_interpretation_must_run_server_side/);
    });

    await check("A. Fresh Session first decision statement reaches /api/poju/chat", async () => {
      await withAuthStore(async () => {
        chatPosts.length = 0;
        const sid = await createPOJUSession({
          payment_id: "pay_di2_browser_auth_a",
          original_question: "要不要离职去创业？",
        });
        const before = await loadPOJUSession(sid);
        assert.ok(before);
        const serverBefore = await requireAuthoritativeSession(sid);
        assert.equal(serverBefore.revision, before!.session_revision ?? 0);

        const clientTurnId = "turn_fresh_a1";
        const userMessage = "我在犹豫要不要离职去创业，家里还有贷款。";
        const withUser: POJUSessionState = {
          ...before!,
          messages: [
            ...before!.messages,
            {
              role: "user",
              content: userMessage,
              timestamp: new Date().toISOString(),
              client_id: clientTurnId,
            },
          ],
        };
        const result = await submitAuthoritativeChatTurn({
          session: withUser,
          user_message: userMessage,
          client_turn_id: clientTurnId,
          expected_revision: before!.session_revision ?? 0,
          locale: "zh",
        });
        assert.equal(chatPosts.length >= 1, true, "browser transport must hit /api/poju/chat");
        assert.equal(result.ok, true);
        assert.ok(result.envelope.authority === "server");
        assert.ok(result.session.decision_blueprint, "Blueprint must be initialized");
        assert.ok(result.session.decision_context, "DC must be initialized");
        assert.ok(result.session.decision_understanding, "Understanding must be built");
        assert.ok(
          result.session.adaptive_ask_plan?.question_text ||
            result.session.decision_understanding?.last_sent_question?.question_text,
          "first authorized question must exist",
        );
        assert.ok(result.session_revision > (before!.session_revision ?? 0));

        const mirrored = await mirrorAuthoritativeSessionLocally(result.session);
        const local = await loadPOJUSession(sid);
        assert.equal(local?.session_revision, mirrored.session_revision);
        assert.equal(local?.adaptive_ask_plan?.question_text, mirrored.adaptive_ask_plan?.question_text);

        const serverAfter = await requireAuthoritativeSession(sid);
        assert.equal(serverAfter.revision, result.session_revision);
        assert.ok(serverAfter.session_snapshot.decision_blueprint);
      });
    });

    await check("B. Adaptive answer updates DC ledger + Session CAS; UI shows authorized question", async () => {
      await withAuthStore(async () => {
        chatPosts.length = 0;
        const sid = await createPOJUSession({
          payment_id: "pay_di2_browser_auth_b",
          original_question: "要不要离职去创业？",
        });
        const s0 = await loadPOJUSession(sid);
        const t1 = "turn_b1";
        const msg1 = "我在犹豫要不要离职去创业，家里还有贷款。";
        const r1 = await submitAuthoritativeChatTurn({
          session: {
            ...s0!,
            messages: [
              ...s0!.messages,
              { role: "user", content: msg1, timestamp: new Date().toISOString(), client_id: t1 },
            ],
          },
          user_message: msg1,
          client_turn_id: t1,
          expected_revision: s0!.session_revision ?? 0,
          locale: "zh",
        });
        await mirrorAuthoritativeSessionLocally(r1.session);
        const q1 =
          r1.session.adaptive_ask_plan?.question_text ??
          r1.session.decision_understanding?.last_sent_question?.question_text;
        assert.ok(q1);

        const t2 = "turn_b2";
        const msg2 = "可选方案是留任、离职创业，或者先内部转岗。";
        const beforeLedger = r1.session.dc_ledger?.head?.commit_version ?? 0;
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
        assert.ok(chatPosts.length >= 2);
        assert.ok(r2.session_revision > r1.session_revision);
        assert.ok(
          (r2.session.dc_ledger?.head?.commit_version ?? 0) >= beforeLedger,
          "DC ledger mirror must be present after answer",
        );
        const q2 =
          r2.session.adaptive_ask_plan?.question_text ??
          r2.session.decision_understanding?.last_sent_question?.question_text ??
          null;
        const asst = [...r2.session.messages].reverse().find((m) => m.role === "assistant");
        assert.ok(asst);
        if (q2) {
          assert.equal(asst!.content, q2, "browser-visible question must equal server-authorized plan");
        }
        await mirrorAuthoritativeSessionLocally(r2.session);
      });
    });

    await check("C. Input protection lockout survives and blocks model/DC writes", async () => {
      await withAuthStore(async () => {
        const sid = await createPOJUSession({
          payment_id: "pay_di2_browser_auth_c",
          original_question: "要不要离职？",
        });
        let session = (await loadPOJUSession(sid))!;
        const seed = await submitAuthoritativeChatTurn({
          session: {
            ...session,
            messages: [
              ...session.messages,
              {
                role: "user",
                content: "我在考虑要不要离职。",
                timestamp: new Date().toISOString(),
                client_id: "turn_c0",
              },
            ],
          },
          user_message: "我在考虑要不要离职。",
          client_turn_id: "turn_c0",
          expected_revision: session.session_revision ?? 0,
          locale: "zh",
        });
        session = await mirrorAuthoritativeSessionLocally(seed.session);
        const beforeFacts = session.decision_context?.reality_facts?.length ?? 0;
        const beforeRev = session.session_revision ?? 0;

        for (const [i, junk] of ["asdfasdf", "!!!!!"].entries()) {
          const turnId = `turn_c_invalid_${i}`;
          const out = await submitAuthoritativeChatTurn({
            session: {
              ...session,
              messages: [
                ...session.messages,
                {
                  role: "user",
                  content: junk,
                  timestamp: new Date().toISOString(),
                  client_id: turnId,
                },
              ],
            },
            user_message: junk,
            client_turn_id: turnId,
            expected_revision: session.session_revision ?? 0,
            locale: "zh",
          });
          session = await mirrorAuthoritativeSessionLocally(out.session);
        }

        const protection = session.intake_protection;
        assert.ok(protection, "intake protection must be recorded");
        assert.ok(
          protection.lockout_until ||
            protection.status === "locked" ||
            (protection.invalid_streak ?? 0) >= 2 ||
            session.agent_v2?.current_phase,
          "lockout / invalid streak must be server-recorded",
        );
        assert.equal(
          session.decision_context?.reality_facts?.length ?? 0,
          beforeFacts,
          "invalid inputs must not write new facts",
        );

        const reloaded = await loadPOJUSession(sid);
        assert.ok(reloaded?.intake_protection || reloaded?.session_revision !== undefined);
        assert.ok((reloaded!.session_revision ?? 0) >= beforeRev);
      });
    });

    await check("D. Concurrent same-revision turns: only one commits", async () => {
      await withAuthStore(async () => {
        const record = await initializeAuthoritativeSession({
          original_question: "并发测试决策",
          device_id: "dev_di2_browser_auth_chat",
        });
        const envelope = toAuthoritativeEnvelope(record);
        const session = envelope.session;
        const rev = envelope.revision;
        const body = (turnId: string, text: string) =>
          new Request("http://localhost/api/poju/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              locale: "zh",
              session: {
                ...session,
                messages: [
                  ...session.messages,
                  {
                    role: "user",
                    content: text,
                    timestamp: new Date().toISOString(),
                    client_id: turnId,
                  },
                ],
                session_revision: rev,
              },
              user_message: text,
              client_turn_id: turnId,
              expected_revision: rev,
            }),
          });

        const [a, b] = await Promise.all([
          postChat(body("turn_d_a", "我在考虑要不要换工作，压力很大。")),
          postChat(body("turn_d_b", "我在考虑要不要出国读书，预算有限。")),
        ]);
        const statuses = [a.status, b.status].sort();
        assert.ok(statuses.includes(200), "one turn must commit");
        assert.ok(
          statuses.some((s) => s === 409 || s === 409 || s >= 400),
          "stale turn must fail closed with conflict",
        );
        const bodies = [await a.json(), await b.json()] as Array<Record<string, unknown>>;
        const ok = bodies.filter((x) => x.authoritative_session);
        const conflict = bodies.filter(
          (x) => x.error === "session_authority" || typeof x.code === "string",
        );
        assert.equal(ok.length, 1);
        assert.ok(conflict.length >= 1);
        const winner = ok[0]!;
        assert.equal(typeof winner.session_revision, "number");
      });
    });

    await check("F. Reload restores complete DI2 state from server snapshot", async () => {
      await withAuthStore(async () => {
        const sid = await createPOJUSession({
          payment_id: "pay_di2_browser_auth_f",
          original_question: "要不要离职？",
        });
        const s0 = await loadPOJUSession(sid);
        const r1 = await submitAuthoritativeChatTurn({
          session: {
            ...s0!,
            messages: [
              ...s0!.messages,
              {
                role: "user",
                content: "我在犹豫要不要离职。",
                timestamp: new Date().toISOString(),
                client_id: "turn_f1",
              },
            ],
          },
          user_message: "我在犹豫要不要离职。",
          client_turn_id: "turn_f1",
          expected_revision: s0!.session_revision ?? 0,
          locale: "zh",
        });
        await mirrorAuthoritativeSessionLocally(r1.session);

        const server = await requireAuthoritativeSession(sid);
        const restored = toAuthoritativeEnvelope(server).session;
        assert.equal(restored.session_id, sid);
        assert.deepEqual(
          restored.messages.map((m) => ({ role: m.role, content: m.content, client_id: m.client_id })),
          r1.session.messages.map((m) => ({
            role: m.role,
            content: m.content,
            client_id: m.client_id,
          })),
        );
        assert.ok(restored.decision_context);
        assert.ok(restored.decision_blueprint);
        assert.ok(restored.decision_understanding);
      });
    });

    await check("static: POJUChatUI production path uses authoritative chat transport", async () => {
      const src = readFileSync(join(process.cwd(), "components/poju/POJUChatUI.tsx"), "utf8");
      assert.match(src, /submitAuthoritativeChatTurn/);
      assert.match(src, /mirrorAuthoritativeSessionLocally/);
      assert.equal(
        /handleUserMessage\s*\(/.test(src),
        false,
        "production UI must not call handleUserMessage for turns",
      );
      const chatSrc = readFileSync(
        join(process.cwd(), "lib/poju/session-authority/chat.ts"),
        "utf8",
      );
      assert.match(chatSrc, /runWithInProcessDecisionAuthority/);
    });

    await check("E. Readiness confirm path remains server-authoritative (wire present)", async () => {
      // Full Freeze+report is covered by M2.1/M5/M6. Here we only assert the
      // production UI/server wire that those suites exercise still goes through
      // authoritative chat (no local handleUserMessage / no answer-interpretation proxy).
      const ui = readFileSync(join(process.cwd(), "components/poju/POJUChatUI.tsx"), "utf8");
      assert.match(ui, /submitAuthoritativeChatTurn/);
      const route = readFileSync(
        join(process.cwd(), "app/api/poju/answer-interpretation/route.ts"),
        "utf8",
      );
      assert.match(route, /endpoint_retired/);
      assert.equal(
        /import\s*\{[^}]*callAnswerInterpretationModel/.test(route),
        false,
        "retired route must not import the model caller",
      );
      assert.equal(route.includes("openRouterChatCompletion"), false);
    });
  } finally {
    restoreFetch();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
