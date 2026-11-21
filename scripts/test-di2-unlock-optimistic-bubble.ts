/**
 * DI2: Pass unlock must survive server adopt; optimistic user bubble stays stable.
 * Run: pnpm exec tsx scripts/test-di2-unlock-optimistic-bubble.ts
 */
import { prepareUnlockReleaseSession } from "@/lib/poju/finalize-unlock-bazi-session";
import {
  isPreviewSession,
  preserveClientUnlockStatus,
  withOptimisticUserTurn,
} from "@/lib/poju/preview-unlock";
import { bindAuthoritativeChatSession } from "@/lib/poju/session-authority/lifecycle";
import { isRecoverableSessionAuthorityCode } from "@/lib/poju/session-authority/chat-client";
import { SERVER_SESSION_RECORD_VERSION } from "@/lib/poju/session-authority/types";
import type { POJUSessionState } from "@/lib/poju/types";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

const unlocked = {
  session_id: "s1",
  session_revision: 0,
  unlock_status: "unlocked",
  unlock_via: "payment",
  messages: [
    {
      role: "user",
      content: "我该怎么办？",
      timestamp: "2026-01-01T00:00:00.000Z",
      client_id: "turn-1",
    },
  ],
} as unknown as POJUSessionState;

const previewServer = {
  ...unlocked,
  unlock_status: "preview",
  unlock_via: undefined,
  messages: [],
} as unknown as POJUSessionState;

{
  const kept = preserveClientUnlockStatus(unlocked, previewServer);
  assert("preserveClientUnlockStatus keeps unlocked", kept.unlock_status === "unlocked");
  assert("preserveClientUnlockStatus keeps unlock_via", kept.unlock_via === "payment");
  assert("preserved session is not preview", !isPreviewSession(kept));
}

{
  const withUser = withOptimisticUserTurn(previewServer, "第二轮回答", "turn-2");
  assert("withOptimisticUserTurn appends user", withUser.messages.length === 1);
  assert(
    "withOptimisticUserTurn keeps client_id",
    withUser.messages[0]?.client_id === "turn-2",
  );
  const again = withOptimisticUserTurn(withUser, "第二轮回答", "turn-2");
  assert("withOptimisticUserTurn is idempotent", again.messages.length === 1);
}

{
  const released = prepareUnlockReleaseSession(unlocked, "我该怎么办？");
  const last = released.messages[released.messages.length - 1];
  assert(
    "prepareUnlockReleaseSession preserves client_id",
    last?.client_id === "turn-1",
  );
}

{
  const record = {
    v: SERVER_SESSION_RECORD_VERSION,
    session_id: "s1",
    session_generation: 1,
    revision: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
    lifecycle_status: "active" as const,
    snapshot_hash: "hash",
    session_snapshot: previewServer,
    last_committed_turn_id: null,
    dc_ledger_head_hash: null,
    dc_ledger_commit_version: null,
    latest_freeze_receipt_id: null,
    latest_freeze_id: null,
  };
  const bound = bindAuthoritativeChatSession(
    record,
    {
      client_turn_id: "turn-2",
      content: "第二轮回答",
      message: {
        role: "user",
        content: "第二轮回答",
        timestamp: "2026-01-01T00:01:00.000Z",
        client_id: "turn-2",
      },
    },
    unlocked,
  );
  assert(
    "bindAuthoritativeChatSession carries client unlock",
    bound.unlock_status === "unlocked",
  );
  assert("bound session is not preview", !isPreviewSession(bound));
}

{
  assert(
    "revision conflict is recoverable",
    isRecoverableSessionAuthorityCode("session_revision_conflict"),
  );
  assert(
    "persistence timeout is recoverable when flagged",
    isRecoverableSessionAuthorityCode("server_persistence_unavailable", {
      recoverable: true,
    }),
  );
  assert(
    "persistence outage is not recoverable by default",
    !isRecoverableSessionAuthorityCode("server_persistence_unavailable"),
  );
}

if (failures.length) {
  console.error(`\nFAILED ${failures.length}:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nAll checks passed.");
