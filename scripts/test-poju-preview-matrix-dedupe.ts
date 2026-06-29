/**
 * Old-record preview matrix — no duplicate energy_matrix, no LLM.
 * Run: pnpm exec tsx scripts/test-poju-preview-matrix-dedupe.ts
 */
import fs from "node:fs";
import path from "node:path";

import { dedupePreviewMatrixMessages, upsertEnergyMatrixMessage } from "@/lib/poju/preview-unlock";
import {
  dedupeWelcomeMessages,
  isMatrixWelcomeMessage,
  upsertMatrixWelcomeMessage,
} from "@/lib/poju/chat-bootstrap";
import type { POJUSessionState } from "@/lib/poju/types";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function main(): void {
  console.log("\n=== Preview matrix dedupe (static) ===\n");

  const chatUi = read("components/poju/POJUChatUI.tsx");
  assert("POJUChatUI removed previewMatrixInitRef", !chatUi.includes("previewMatrixInitRef"));
  assert("POJUChatUI removed chat-side matrix append", !chatUi.includes("createEnergyMatrixMessage"));
  assert("POJUChatUI uses isEnergyMatrixMessage", chatUi.includes("isEnergyMatrixMessage"));
  assert("POJUChatUI displaySession dedupe", chatUi.includes("dedupePreviewMatrixMessages(session)"));
  assert("finalize loads from DB", read("lib/poju/finalize-preview-matrix-session.ts").includes("loadPOJUSession"));
  assert("finalize uses upsertEnergyMatrixMessage", read("lib/poju/finalize-preview-matrix-session.ts").includes("upsertEnergyMatrixMessage"));
  assert("finalize uses seedMatrixWelcomeMessage", read("lib/poju/finalize-preview-matrix-session.ts").includes("seedMatrixWelcomeMessage"));
  assert("finalize no seedFixedWelcomeMessages", !read("lib/poju/finalize-preview-matrix-session.ts").includes("seedFixedWelcomeMessages"));
  assert("POJUChatUI matrix welcome slot", chatUi.includes("isMatrixWelcomeMessage"));
  assert("POJUChatUI matrix bubble no synopsis", !chatUi.includes("poju-matrix-bubble__synopsis"));

  const dup = {
    messages: [
      { role: "assistant" as const, content: "", timestamp: "1", meta: { kind: "energy_matrix" as const } },
      { role: "assistant" as const, content: "", timestamp: "2", meta: { kind: "energy_matrix" as const } },
    ],
  } as unknown as POJUSessionState;
  const once = dedupePreviewMatrixMessages(dup);
  assert(
    "dedupe keeps one energy_matrix",
    once.messages.filter((m) => m.meta?.kind === "energy_matrix").length === 1,
  );

  const upserted = upsertEnergyMatrixMessage(
    [{ role: "assistant", content: "", timestamp: "a", meta: { kind: "energy_matrix" } }],
    { matrix_id: "x" } as never,
    "zh",
  );
  assert("upsert keeps one row", upserted.filter((m) => m.meta?.kind === "energy_matrix").length === 1);

  const payload = {
    display: {
      synopsis: { archetype: "柔韧之藤", friction: "Fire盈余", prompt: "写下你的问题" },
      narrative_source: "stored",
    },
  } as never;

  const dupWelcome = {
    messages: [
      {
        role: "assistant" as const,
        content: "柔韧之藤",
        timestamp: "1",
        meta: { kind: "welcome" as const, matrix_welcome: true, matrix_payload: payload },
      },
      {
        role: "assistant" as const,
        content: "欢迎来到 POJU。\n\n这里只围绕你今天带来的那一个核心问题",
        timestamp: "2",
        meta: { kind: "welcome" as const },
      },
    ],
  } as unknown as POJUSessionState;
  const welcomeOnce = dedupeWelcomeMessages(dupWelcome);
  assert(
    "dedupe keeps matrix welcome over generic",
    welcomeOnce.messages.length === 1 && isMatrixWelcomeMessage(welcomeOnce.messages[0]!),
  );

  const seeded = upsertMatrixWelcomeMessage(
    { messages: [] } as unknown as POJUSessionState,
    payload,
    "zh",
  );
  assert("upsert matrix welcome", seeded.messages.some(isMatrixWelcomeMessage));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All preview matrix dedupe checks passed.\n");
}

main();
