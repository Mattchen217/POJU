/**
 * Block 72 — opening non-stream + segment split (conversion removed from opening)
 *
 *   pnpm exec tsx scripts/test-poju-block72-envelope-nonstream.ts
 */
import fs from "node:fs";
import path from "node:path";
import { buildCollectingTransitionReplyFromCore } from "@/lib/poju/collecting-focus-reply";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import { parseOpeningConversionPayload } from "@/lib/poju/opening-conversion-payload";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 72 · Envelope + non-stream ==========\n");

  const opening = read("lib/llm/phases/opening-phase-v6.ts");
  assert("opening no conversion side door", !opening.includes("parseOpeningConversionPayload"));
  assert("opening segment2 deferred", opening.includes("segment2_deferred"));

  const agent = read("lib/poju/agent.ts");
  assert("agent buildCollectingTransitionReplyFromCore after segment2", agent.includes("buildCollectingTransitionReplyFromCore"));
  assert("agent segment2 independent trigger", agent.includes("segment-2 breakthrough-core"));
  assert("client no longer passes onStream", !agent.includes("onStream?:"));

  const transport = read("lib/llm/phases/phase-transport.ts");
  assert("B no openRouterChatCompletionStream in transport", !transport.includes("openRouterChatCompletionStream"));
  assert("B uses openRouterChatCompletion non-stream", transport.includes("await openRouterChatCompletion({"));
  assert("B salvageContentFromReasoning export", transport.includes("export function salvageContentFromReasoning"));
  assert("B empty retry try/catch not provider_queue", transport.includes("empty-content retry threw"));

  const payloadSrc = read("lib/poju/opening-conversion-payload.ts");
  assert("A3 agendaFromActionFrames salvage", payloadSrc.includes("agendaFromActionFrames"));

  const salvaged = parseOpeningConversionPayload(
    {
      understanding_sufficient: true,
      relationship_conclusion: "结构卡点",
      breakthrough_directions: [
        {
          direction: "d1",
          structural_basis: "b1",
          timing: "t1",
          what_would_confirm: "过去亲密模式",
        },
        {
          direction: "d2",
          structural_basis: "b2",
          timing: "t2",
          what_would_confirm: "现实接触渠道",
        },
      ],
    },
    "先聊一句",
    "zh",
  );
  assert("A3 salvage from directions without agenda array", Boolean(salvaged?.investigation_agenda?.length));

  const reply = buildCollectingTransitionReplyFromCore(
    {
      ...createInitialAgentState({ original_question: "q" }),
      breakthrough_core: makeTestBreakthroughCore({
        situation_conclusion: "你在关系里容易先退后守。",
        modern_action_frames: [
          {
            direction: "d1",
            why_fits: "先守后动",
            structural_basis: "b",
            needs_validation: "c",
            status: "hypothesis",
          },
          {
            direction: "d2",
            why_fits: "备用",
            structural_basis: "b2",
            needs_validation: "c2",
            status: "hypothesis",
          },
        ],
      }),
      investigation_agenda: [
        { id: "a1", label: "过去亲密模式", critical: true, status: "unexplored" },
        { id: "a2", label: "现实接触渠道", critical: true, status: "unexplored" },
      ],
    },
    "zh",
  );
  assert("core fallback reply asks agenda focus", /过去亲密模式/.test(reply) && /[？?]/.test(reply));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 72 checks passed.\n");
}

main();
