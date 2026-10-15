/**
 * Skip-path UX (#12): after Case C Skip, chips/copy/understanding confirm
 * must not stick or mislead (no still-waiting-for-partner-chart copy).
 * Run: pnpm exec tsx scripts/test-dyad-skip-path-ux.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildDyadContinueModelUserCue,
  dyadGateChipsLocked,
  dyadSkipPatch,
  dyadSkipPathUnderstandingNote,
  shouldAnnotateUnderstandingWithSkipPath,
} from "../lib/poju/dyad-compat";
import { buildUnderstandingGateSummaryFromFields } from "../lib/poju/understanding-gate-reply";
import { clearDyadGateUi } from "../lib/poju/reply-options";
import type { POJUAgentState } from "../lib/poju/agent-state";
import type { POJUSessionState } from "../lib/poju/types";

const agent = {
  core_dilemma: {
    concrete_event: "co-founder equity split stuck",
    stakes: "runway pressure",
    sticking_point: "cannot agree on voting rights",
  },
  desired_direction: {
    wants: "a clear split and cadence",
    priority: "protect my runway",
  },
} as unknown as POJUAgentState;

assert.equal(shouldAnnotateUnderstandingWithSkipPath({ dyadOfferStatus: "skipped" }), true);
assert.equal(
  shouldAnnotateUnderstandingWithSkipPath({ partner_bazi: "absent", pivot_chart_path: "solo" }),
  true,
);
assert.equal(shouldAnnotateUnderstandingWithSkipPath({ dyadOfferStatus: "offered" }), false);
assert.equal(shouldAnnotateUnderstandingWithSkipPath({ dyadOfferStatus: "collected" }), false);
assert.equal(dyadGateChipsLocked("skipped"), true);
assert.equal(dyadGateChipsLocked("collected"), true);
assert.equal(dyadGateChipsLocked("offered"), false);

const enNote = dyadSkipPathUnderstandingNote("en");
assert.match(enNote, /solo path/i);
assert.match(enNote, /without their chart/i);
assert.doesNotMatch(enNote, /still waiting for/i);
assert.doesNotMatch(enNote, /Enter their birth details/);
const zhNote = dyadSkipPathUnderstandingNote("zh");
assert.ok(zhNote.includes("solo"));
assert.ok(zhNote.length > 20);

const skipSummary = buildUnderstandingGateSummaryFromFields(agent, "en", {
  dyad_offer_status: "skipped",
  partner_bazi: "absent",
  pivot_chart_path: "solo",
});
assert.ok(skipSummary.includes(enNote), "understanding summary must include skip-path note");
assert.doesNotMatch(skipSummary, /still waiting for (their|partner)/i);
assert.doesNotMatch(skipSummary, /Enter their birth details/);
const plainSummary = buildUnderstandingGateSummaryFromFields(agent, "en");
assert.ok(!plainSummary.includes(enNote), "non-skip path must not force solo note");

const cue = buildDyadContinueModelUserCue({
  partner_bazi: "absent",
  pivot_chart_path: "solo",
  locale: "en",
});
assert.match(cue, /partner_bazi=absent/);
assert.match(cue, /path=solo/);
assert.match(cue, /do not re-ask birth details/i);
assert.match(cue, /do not re-offer collect chips/i);
assert.match(cue, /imply we are still waiting/i);

const session = {
  session_id: "t",
  messages: [
    {
      role: "assistant",
      content: "dyad gate",
      timestamp: new Date().toISOString(),
      options: ["Enter their birth details", "Skip for now"],
      meta: { dyad_gate_pending: true },
    },
  ],
  dyad_offer_status: "offered",
} as unknown as POJUSessionState;
const cleared = clearDyadGateUi({ ...session, ...dyadSkipPatch() });
assert.equal(cleared.dyad_offer_status, "skipped");
assert.equal(cleared.partner_bazi, "absent");
assert.equal(cleared.pivot_chart_path, "solo");
assert.equal(cleared.messages[0]!.meta?.options_consumed, true);
assert.equal(cleared.messages[0]!.meta?.dyad_gate_pending, false);

const chatUiSrc = readFileSync(
  fileURLToPath(new URL("../components/poju/POJUChatUI.tsx", import.meta.url)),
  "utf8",
);
assert.ok(chatUiSrc.includes("clearDyadGateUi"));
assert.ok(chatUiSrc.includes("dyadGateChipsLocked"));
assert.ok(/handleDyadSkip[\s\S]{0,600}?clearDyadGateUi/.test(chatUiSrc));

const agentSrc = readFileSync(
  fileURLToPath(new URL("../lib/poju/agent.ts", import.meta.url)),
  "utf8",
);
assert.ok(/openingReplyInput[\s\S]{0,400}?dyadPath:/.test(agentSrc));

const policySrc = readFileSync(
  fileURLToPath(new URL("../lib/llm/prompts/pivot-dual-party-policy.ts", import.meta.url)),
  "utf8",
);
assert.ok(policySrc.includes("partner_bazi=absent") && /skip/i.test(policySrc));

const pipelineSrc = readFileSync(
  fileURLToPath(new URL("../lib/llm/pro/delivery/lab/pipeline-jobs.ts", import.meta.url)),
  "utf8",
);
assert.ok(pipelineSrc.includes("clearDyadGateUi"));
assert.ok(!pipelineSrc.includes("function clearDyadGateUi("));

console.log("ok dyad-skip-path-ux", {
  note_en_len: enNote.length,
  summary_has_note: skipSummary.includes(enNote),
});