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
  hashSessionSnapshot,
  initializeAuthoritativeSession,
  readAuthoritativeSession,
  requireAuthoritativeSession,
  toAuthoritativeEnvelope,
} from "../lib/poju/session-authority/lifecycle";
import {
  decisionBlueprintHasPrivateContent,
  decisionContextHasPrivateContent,
  hasMeaningfulValue,
  isServerSessionContentShell,
  mainDeliveryHasPrivateContent,
  needsLegacySessionPrivacyMigration,
  redactSessionSnapshotForServerDurable,
  sessionHasLocalPrivateContent,
} from "../lib/poju/session-authority/privacy-boundary";
import type { ConfirmationEvent } from "../lib/poju/decision-context/confirmation-event";
import type { DecisionBlueprint } from "../lib/poju/decision-intake/types";
import { getSessionAuthorityStore } from "../lib/poju/session-authority/store";
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

const SEAL_NOW = "2026-11-27T12:00:00.000Z";

function sealableDraftDc(contextId: string): DecisionContext {
  const dc: DecisionContext = {
    context_id: contextId,
    version: 1,
    status: "draft",
    definition: {
      concrete_event: "收到一份新的工作邀请，需要在两周内答复",
      stakes: "收入与家庭节奏",
      desired_outcome: "在不拖垮家庭节奏的前提下提升收入",
      decision_question: "要不要接受新公司的工作邀请",
      goal_priorities: ["收入", "家庭节奏"],
      unacceptable_outcomes: ["半年内被迫再次换工作"],
    },
    reality_facts: [
      {
        fact_id: "f_conf",
        statement: "现岗位月收入已确认",
        status: "confirmed",
        verification_level: "user_asserted",
        source_stage: "collecting",
        source_turn_id: "t1",
        user_confirmed: true,
      },
    ],
    constraints: [],
    hypotheses: [],
    dirs: [
      {
        dir_id: "dir_options",
        need: "新岗位的真实职责范围",
        why: "决定路径排序",
        required_fact_roles: ["option"],
        current_state: "unknown",
        partial_satisfaction: false,
        agenda_item_ids: [],
        may_affect_p5_ranking: false,
        id_lifecycle: "active",
      },
    ],
    conflicts: [],
    content_hash: null,
    created_at: SEAL_NOW,
    updated_at: SEAL_NOW,
    information_boundaries: [],
  };
  dc.content_hash = computeContentHash(dc);
  return dc;
}

function confirmationEvt(factId: string, turn: string): ConfirmationEvent {
  return {
    event_id: `e_${factId}`,
    target_type: "fact",
    fact_id: factId,
    source_turn_id: turn,
    confirmation_turn_id: null,
    confirmation_action_id: `a_${factId}`,
    event_type: "confirm_fact",
    actor: "user",
    confirmed_at: SEAL_NOW,
    event_version: 1,
  };
}

function sealBlueprint(sessionId: string, contextId: string): DecisionBlueprint {
  return {
    blueprint_id: `bp_${sessionId}`,
    blueprint_version: 1,
    ddr_version: "t",
    dir_catalog_version: "t",
    session_id: sessionId,
    context_id: contextId,
    decision_question: "要不要接受新公司的工作邀请",
    definition_snapshot: sealableDraftDc(contextId).definition,
    directions: [],
    dir_ids: ["dir_options"],
  } as unknown as DecisionBlueprint;
}

const SEAL_EVENTS = [confirmationEvt("f_conf", "t1")];

function emptySessionDefaults(sessionId: string): POJUSessionState {
  return {
    session_id: sessionId,
    session_revision: 0,
    device_id: "browser-a",
    original_question: "",
    messages: [],
    context_collected: {},
    has_profile: false,
    birth_submitted_in_session: false,
    profile_skipped: false,
    actions: [],
    main_delivery_done: false,
    main_delivery: null,
    tokens_used: 0,
    abuse_metrics: { long_input_count: 0, jailbreak_attempts: 0, duplicate_attempts: 0 },
    created_at: SEAL_NOW,
    last_interaction_at: SEAL_NOW,
    expires_at: "2026-12-27T12:00:00.000Z",
    cycles: [],
    shared_context: {},
    dc_ledger: null,
  } as POJUSessionState;
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
      const contextId = `dc_${seeded.session_id.slice(0, 8)}`;
      const draft = sealableDraftDc(contextId);
      const session: POJUSessionState = {
        ...seeded.session_snapshot,
        decision_context: draft,
        decision_blueprint: sealBlueprint(seeded.session_id, contextId),
        confirmation_events: SEAL_EVENTS,
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

      const sealed = await sealFreezeWithAuthority(working, { profile: null, now: SEAL_NOW });
      assert.equal(sealed.receipt.freeze_id, `${contextId}@v${draft.version}`);
      assert.equal(sealed.profile_receipt, null);
      const frozenHead = await readLedgerHead(seeded.session_id);
      assert.equal(frozenHead?.change_type, "freeze");
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
    assert.equal(shell.selected_stored_profile_id, null);
    assert.equal(shell.has_profile, false);
    assert.equal(shell.birth_submitted_in_session, false);
    assert.equal(shell.dc_ledger, null);
  });

  await asyncTest("8. Legacy session privacy migration redacts durable full records", async () => {
    await withPrivacyStore(async () => {
      const sessionId = "legacy_privacy_migrate_a1b2c3d4";
      const secretQ = "LEGACY_SECRET_QUESTION";
      const secretMsg = "LEGACY_SECRET_MESSAGE";
      const nowIso = SEAL_NOW;
      const legacySnapshot: POJUSessionState = {
        ...emptySessionDefaults(sessionId),
        session_revision: 2,
        original_question: secretQ,
        messages: [userMessage(secretMsg, "legacy_turn_1")],
        decision_context: minimalDraftDc("dc_legacy_priv"),
        has_profile: true,
        selected_stored_profile_id: "stored_profile_leak",
        birth_submitted_in_session: true,
      };
      const legacyRecord = {
        v: 1 as const,
        session_id: sessionId,
        session_generation: 1,
        revision: 2,
        created_at: nowIso,
        updated_at: nowIso,
        expires_at: "2026-12-27T12:00:00.000Z",
        lifecycle_status: "active" as const,
        snapshot_hash: hashSessionSnapshot(legacySnapshot),
        session_snapshot: legacySnapshot,
        last_committed_turn_id: null,
        content_policy: "legacy_full" as const,
        dc_ledger_head_hash: null,
        dc_ledger_commit_version: null,
        latest_freeze_receipt_id: null,
        latest_freeze_id: null,
      };
      const created = await getSessionAuthorityStore().createNx(legacyRecord);
      assert.ok(created);
      assert.ok(needsLegacySessionPrivacyMigration(legacyRecord));

      const [a, b] = await Promise.all([
        readAuthoritativeSession(sessionId),
        readAuthoritativeSession(sessionId),
      ]);
      assert.ok(a && b);
      assert.equal(a.revision, 2);
      assert.equal(b.revision, 2);
      const durableJson = JSON.stringify(a.session_snapshot);
      assert.ok(!durableJson.includes(secretQ));
      assert.ok(!durableJson.includes(secretMsg));
      assert.ok(isServerSessionContentShell(a.session_snapshot));
      assert.equal(a.content_policy, "local_private");

      const again = await requireAuthoritativeSession(sessionId);
      assert.ok(isServerSessionContentShell(again.session_snapshot));
      assert.ok(!needsLegacySessionPrivacyMigration(again));
    });
  });

  await asyncTest("9. Durable shell strips profile flags and dc_ledger mirror", async () => {
    const shell = redactSessionSnapshotForServerDurable({
      ...emptySessionDefaults("shell_check"),
      selected_stored_profile_id: "prof_x",
      has_profile: true,
      birth_submitted_in_session: true,
      dc_ledger: {
        schema_version: 1,
        writer_token: "writer-secret",
        head: {
          session_id: "shell_check",
          commit_version: 1,
          entry_hash: "a".repeat(64),
          change_type: "genesis",
          dc_status: "draft",
          context_id: "ctx",
          dc_version: 1,
          content_hash: "b".repeat(64),
          snapshot_hash: "c".repeat(64),
          blueprint_hash: null,
        },
        synced_at: SEAL_NOW,
      },
    });
    assert.equal(shell.selected_stored_profile_id, null);
    assert.equal(shell.has_profile, false);
    assert.equal(shell.birth_submitted_in_session, false);
    assert.equal(shell.dc_ledger, null);
    assert.ok(isServerSessionContentShell(shell));
  });

  await asyncTest("10. Private-content detector and mirror keep local when only soft fields differ", async () => {
    const base = emptySessionDefaults("soft_field_only");
    const withAgent = {
      ...base,
      agent_v2: { current_state: "collecting_context", stage_history: ["opening"] },
    } as POJUSessionState;
    const withCollected = { ...base, context_collected: { salary_note: "private" } };
    const withPending = { ...base, pending_question: "will you switch jobs?" };
    assert.ok(sessionHasLocalPrivateContent(withAgent));
    assert.ok(sessionHasLocalPrivateContent(withCollected));
    assert.ok(sessionHasLocalPrivateContent(withPending));
    assert.ok(!sessionHasLocalPrivateContent(base));

    const local = withCollected;
    const shell = redactSessionSnapshotForServerDurable(local);
    const serverEnvelope = toAuthoritativeEnvelope({
      v: 1,
      session_id: local.session_id,
      session_generation: 1,
      revision: 0,
      created_at: local.created_at,
      updated_at: local.last_interaction_at,
      expires_at: local.expires_at,
      lifecycle_status: "active",
      snapshot_hash: hashSessionSnapshot(shell),
      session_snapshot: shell,
      last_committed_turn_id: null,
      content_policy: "local_private",
      dc_ledger_head_hash: null,
      dc_ledger_commit_version: null,
      latest_freeze_receipt_id: null,
      latest_freeze_id: null,
    });
    const mirror = decideAuthoritativeMirror({ local, server: serverEnvelope });
    assert.ok(mirror.session);
    assert.ok(sessionHasLocalPrivateContent(mirror.session));
    assert.equal((mirror.session!.context_collected as Record<string, string>).salary_note, "private");
  });

  await asyncTest("11. Omitted POJUSessionState private fields survive decideAuthoritativeMirror", async () => {
    const base = emptySessionDefaults("r2_field_audit");
    assert.ok(!sessionHasLocalPrivateContent(base), "empty defaults must not look private");

    type Case = {
      name: string;
      patch: Partial<POJUSessionState>;
      assertKept: (session: POJUSessionState) => void;
    };

    const cases: Case[] = [
      {
        name: "personal_analysis_profile",
        patch: {
          personal_analysis_profile: {
            schema_version: 1,
            profile_summary: "user chart summary",
          } as POJUSessionState["personal_analysis_profile"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.personal_analysis_profile as { profile_summary?: string } | undefined)?.profile_summary,
            "user chart summary",
          );
        },
      },
      {
        name: "decision_understanding",
        patch: {
          decision_understanding: {
            schema_version: 1,
            summary: "private understanding",
          } as POJUSessionState["decision_understanding"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.decision_understanding as { summary?: string } | null)?.summary,
            "private understanding",
          );
        },
      },
      {
        name: "adaptive_ask_plan",
        patch: {
          adaptive_ask_plan: {
            plan_id: "ask_1",
            question_text: "private adaptive ask",
          } as POJUSessionState["adaptive_ask_plan"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.adaptive_ask_plan as { question_text?: string } | null)?.question_text,
            "private adaptive ask",
          );
        },
      },
      {
        name: "pending_answer_resolution",
        patch: {
          pending_answer_resolution: {
            reason: "unbound_role",
            raw_answer: "private answer text",
          } as POJUSessionState["pending_answer_resolution"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.pending_answer_resolution as { raw_answer?: string } | null)?.raw_answer,
            "private answer text",
          );
        },
      },
      {
        name: "pending_intake_control",
        patch: {
          pending_intake_control: {
            kind: "goal_change",
            note: "private control",
          } as POJUSessionState["pending_intake_control"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.pending_intake_control as { note?: string } | null)?.note,
            "private control",
          );
        },
      },
      {
        name: "intake_ask_plan",
        patch: {
          intake_ask_plan: {
            ask_id: "intake_1",
            prompt: "private intake ask",
          } as POJUSessionState["intake_ask_plan"],
        },
        assertKept: (s) => {
          assert.equal((s.intake_ask_plan as { prompt?: string } | null)?.prompt, "private intake ask");
        },
      },
      {
        name: "intake_answer_sources",
        patch: {
          intake_answer_sources: [
            { source_turn_id: "t1", raw_text: "private source answer" },
          ] as POJUSessionState["intake_answer_sources"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.intake_answer_sources?.[0] as { raw_text?: string } | undefined)?.raw_text,
            "private source answer",
          );
        },
      },
      {
        name: "decision_blueprint_history",
        patch: {
          decision_blueprint_history: [
            { blueprint_id: "bp_hist", decision_question: "old private q" },
          ] as POJUSessionState["decision_blueprint_history"],
        },
        assertKept: (s) => {
          assert.equal(s.decision_blueprint_history?.[0]?.decision_question, "old private q");
        },
      },
      {
        name: "blueprint_change_log",
        patch: {
          blueprint_change_log: [
            { change_id: "c1", reason: "private blueprint edit" },
          ] as POJUSessionState["blueprint_change_log"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.blueprint_change_log?.[0] as { reason?: string } | undefined)?.reason,
            "private blueprint edit",
          );
        },
      },
      {
        name: "last_answer_event",
        patch: {
          last_answer_event: {
            event_id: "ae1",
            answer_text: "private last answer",
          } as POJUSessionState["last_answer_event"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.last_answer_event as { answer_text?: string } | null)?.answer_text,
            "private last answer",
          );
        },
      },
      {
        name: "control_plane",
        patch: {
          control_plane: {
            schema_version: 1,
            phase: "collecting",
            note: "private control plane",
          } as POJUSessionState["control_plane"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.control_plane as { note?: string } | undefined)?.note,
            "private control plane",
          );
        },
      },
      {
        name: "topic_applicability_evals",
        patch: {
          topic_applicability_evals: [
            { eval_id: "te1", topic: "career", result: "applicable" },
          ] as POJUSessionState["topic_applicability_evals"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.topic_applicability_evals?.[0] as { topic?: string } | undefined)?.topic,
            "career",
          );
        },
      },
      {
        name: "generation_task_contexts",
        patch: {
          generation_task_contexts: [
            { task_id: "gt1", prompt_digest: "private gen task" },
          ] as POJUSessionState["generation_task_contexts"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.generation_task_contexts?.[0] as { prompt_digest?: string } | undefined)?.prompt_digest,
            "private gen task",
          );
        },
      },
      {
        name: "generation_registry",
        patch: {
          generation_registry: [
            { generation_id: "gr1", label: "private registry" },
          ] as POJUSessionState["generation_registry"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.generation_registry?.[0] as { label?: string } | undefined)?.label,
            "private registry",
          );
        },
      },
      {
        name: "generation_operation_bindings",
        patch: {
          generation_operation_bindings: [
            { idempotency_key: "gob1", op: "private-op" },
          ] as POJUSessionState["generation_operation_bindings"],
        },
        assertKept: (s) => {
          assert.equal(
            (s.generation_operation_bindings?.[0] as { op?: string } | undefined)?.op,
            "private-op",
          );
        },
      },
      {
        name: "pending_delivery_job_id",
        patch: { pending_delivery_job_id: "job_delivery_private_1" },
        assertKept: (s) => assert.equal(s.pending_delivery_job_id, "job_delivery_private_1"),
      },
      {
        name: "pending_synthesis_job_id",
        patch: { pending_synthesis_job_id: "job_synth_private_1" },
        assertKept: (s) => assert.equal(s.pending_synthesis_job_id, "job_synth_private_1"),
      },
      {
        name: "pending_segment2_job_id",
        patch: { pending_segment2_job_id: "job_seg2_private_1" },
        assertKept: (s) => assert.equal(s.pending_segment2_job_id, "job_seg2_private_1"),
      },
      {
        name: "joint_decision_id",
        patch: { joint_decision_id: "joint_private_1" },
        assertKept: (s) => assert.equal(s.joint_decision_id, "joint_private_1"),
      },
      {
        name: "joint_pass_ref",
        patch: { joint_pass_ref: "joint:abc:a" },
        assertKept: (s) => assert.equal(s.joint_pass_ref, "joint:abc:a"),
      },
      {
        name: "action_plan_archive_id",
        patch: { action_plan_archive_id: "archive_private_1" },
        assertKept: (s) => assert.equal(s.action_plan_archive_id, "archive_private_1"),
      },
    ];

    for (const c of cases) {
      const local: POJUSessionState = { ...base, ...c.patch };
      assert.equal(
        sessionHasLocalPrivateContent(local),
        true,
        `${c.name} must count as local private content`,
      );
      // Empty/default counterpart must not flip a fresh session private.
      const emptyish: POJUSessionState = { ...base };
      assert.ok(!sessionHasLocalPrivateContent(emptyish));

      const shell = redactSessionSnapshotForServerDurable(local);
      const serverEnvelope = toAuthoritativeEnvelope({
        v: 1,
        session_id: local.session_id,
        session_generation: 1,
        revision: 4,
        created_at: local.created_at,
        updated_at: local.last_interaction_at,
        expires_at: local.expires_at,
        lifecycle_status: "active",
        snapshot_hash: hashSessionSnapshot(shell),
        session_snapshot: shell,
        last_committed_turn_id: null,
        content_policy: "local_private",
        dc_ledger_head_hash: null,
        dc_ledger_commit_version: null,
        latest_freeze_receipt_id: null,
        latest_freeze_id: null,
      });
      const mirror = decideAuthoritativeMirror({ local, server: serverEnvelope });
      assert.ok(mirror.session, `${c.name}: mirror session required`);
      assert.equal(mirror.revision, 4, `${c.name}: server revision applied`);
      c.assertKept(mirror.session!);
    }
  });

  await asyncTest("12. R2 defects: numbers are meaningful; DC/blueprint/delivery use schema emptiness", async () => {
    assert.equal(hasMeaningfulValue(0), true, "zero is meaningful");
    assert.equal(hasMeaningfulValue(42), true, "nonzero is meaningful");
    assert.equal(hasMeaningfulValue(Number.NaN), false);
    assert.equal(hasMeaningfulValue({ score: 0 }), true, "number-only private object is meaningful");
    assert.equal(hasMeaningfulValue({}), false);
    assert.equal(hasMeaningfulValue([]), false);

    const base = emptySessionDefaults("r2_number_fail_closed");
    // Structural number fields on the allowlist must not flip a fresh Session private.
    assert.ok(!sessionHasLocalPrivateContent({ ...base, tokens_used: 99, session_revision: 7 }));

    // Unknown top-level numeric field (including 0) must fail closed as private.
    const unknownZero = { ...base, mystery_private_score: 0 } as POJUSessionState;
    const unknownNonzero = { ...base, mystery_private_score: 17 } as POJUSessionState;
    assert.equal(sessionHasLocalPrivateContent(unknownZero), true);
    assert.equal(sessionHasLocalPrivateContent(unknownNonzero), true);

    // Number-bearing private nested content must be detected.
    const numberObjectLocal: POJUSessionState = {
      ...base,
      context_collected: { salary_band: 0 },
    };
    assert.equal(sessionHasLocalPrivateContent(numberObjectLocal), true);

    // Empty / default stubs for the three schema-aware fields.
    assert.equal(decisionContextHasPrivateContent(null), false);
    assert.equal(decisionContextHasPrivateContent({}), false);
    assert.equal(decisionContextHasPrivateContent({ version: 1, status: "draft" }), false);
    assert.equal(decisionBlueprintHasPrivateContent(null), false);
    assert.equal(decisionBlueprintHasPrivateContent({}), false);
    assert.equal(decisionBlueprintHasPrivateContent({ schema_version: 1, blueprint_version: 1 }), false);
    assert.equal(mainDeliveryHasPrivateContent(null), false);
    assert.equal(mainDeliveryHasPrivateContent({}), false);
    assert.equal(
      mainDeliveryHasPrivateContent({ delivered_at: "", language: "", full_text: "" }),
      false,
    );

    assert.ok(!sessionHasLocalPrivateContent({ ...base, decision_context: {} as never }));
    assert.ok(!sessionHasLocalPrivateContent({ ...base, decision_blueprint: {} as never }));
    assert.ok(
      !sessionHasLocalPrivateContent({
        ...base,
        main_delivery: { delivered_at: "", language: "", full_text: "" },
      }),
    );

    // Populated values must count as private and survive mirror against a shell.
    const filledDc = minimalDraftDc("dc_r2_filled");
    const filledBp = sealBlueprint("r2_bp_session", "dc_r2_filled");
    const filledDelivery = {
      delivered_at: SEAL_NOW,
      language: "zh",
      full_text: "private delivery body",
    };

    assert.equal(decisionContextHasPrivateContent(filledDc), true);
    assert.equal(decisionBlueprintHasPrivateContent(filledBp), true);
    assert.equal(mainDeliveryHasPrivateContent(filledDelivery), true);

    for (const [name, patch] of [
      ["decision_context", { decision_context: filledDc }],
      ["decision_blueprint", { decision_blueprint: filledBp }],
      ["main_delivery", { main_delivery: filledDelivery }],
    ] as const) {
      const local: POJUSessionState = { ...base, ...patch };
      assert.equal(sessionHasLocalPrivateContent(local), true, `${name} filled must be private`);
      const shell = redactSessionSnapshotForServerDurable(local);
      assert.ok(isServerSessionContentShell(shell), `${name}: redacted shell must be shell`);
      const mirror = decideAuthoritativeMirror({
        local,
        server: toAuthoritativeEnvelope({
          v: 1,
          session_id: local.session_id,
          session_generation: 1,
          revision: 9,
          created_at: local.created_at,
          updated_at: local.last_interaction_at,
          expires_at: local.expires_at,
          lifecycle_status: "active",
          snapshot_hash: hashSessionSnapshot(shell),
          session_snapshot: shell,
          last_committed_turn_id: null,
          content_policy: "local_private",
          dc_ledger_head_hash: null,
          dc_ledger_commit_version: null,
          latest_freeze_receipt_id: null,
          latest_freeze_id: null,
        }),
      });
      assert.ok(mirror.session);
      assert.equal(mirror.revision, 9);
      if (name === "decision_context") {
        assert.equal(mirror.session!.decision_context?.context_id, filledDc.context_id);
      } else if (name === "decision_blueprint") {
        assert.equal(mirror.session!.decision_blueprint?.blueprint_id, filledBp.blueprint_id);
      } else {
        assert.equal(mirror.session!.main_delivery?.full_text, "private delivery body");
      }
    }

    // Unknown numeric-only object on Session must fail closed via mirror keep.
    const mysteryLocal: POJUSessionState = {
      ...base,
      ...({ private_numeric_bag: { attempt: 0, score: 3 } } as object),
    } as POJUSessionState;
    assert.equal(sessionHasLocalPrivateContent(mysteryLocal), true);
    const mysteryShell = redactSessionSnapshotForServerDurable(mysteryLocal);
    const mysteryMirror = decideAuthoritativeMirror({
      local: mysteryLocal,
      server: toAuthoritativeEnvelope({
        v: 1,
        session_id: mysteryLocal.session_id,
        session_generation: 1,
        revision: 2,
        created_at: mysteryLocal.created_at,
        updated_at: mysteryLocal.last_interaction_at,
        expires_at: mysteryLocal.expires_at,
        lifecycle_status: "active",
        snapshot_hash: hashSessionSnapshot(mysteryShell),
        session_snapshot: mysteryShell,
        last_committed_turn_id: null,
        content_policy: "local_private",
        dc_ledger_head_hash: null,
        dc_ledger_commit_version: null,
        latest_freeze_receipt_id: null,
        latest_freeze_id: null,
      }),
    });
    assert.deepEqual(
      (mysteryMirror.session as { private_numeric_bag?: unknown } | null)?.private_numeric_bag,
      { attempt: 0, score: 3 },
    );
  });

  console.log("Unit A pre-report privacy boundary tests complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
