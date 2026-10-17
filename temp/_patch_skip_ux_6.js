const fs = require("fs");
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); console.log("wrote", p); }

// ---------- Update e2e: ChatUI must clearDyadGateUi ----------
{
  const p = "scripts/test-dyad-skip-collect-understanding-e2e.ts";
  let s = read(p);
  s = s.replace(
    /assert\.ok\(\r?\n\s*\/handleDyadSkip\[\s\\S\]\{0,500\}\?dyadSkipPatch\(\)\[\s\\S\]\{0,400\}\?continueAfterDyadGate\/\.test\(chatUiSrc\),\r?\n\s*"ChatUI skip must apply dyadSkipPatch then continueAfterDyadGate",\r?\n\);/,
    `assert.ok(
  /handleDyadSkip[\\s\\S]{0,500}?clearDyadGateUi\\([\\s\\S]{0,200}?dyadSkipPatch\\(\\)[\\s\\S]{0,400}?continueAfterDyadGate/.test(
    chatUiSrc,
  ),
  "ChatUI skip must clearDyadGateUi + dyadSkipPatch then continueAfterDyadGate",
);
assert.ok(
  chatUiSrc.includes("dyadGateChipsLocked"),
  "ChatUI must lock dyad chips after skip/collect (#12)",
);`
  );
  // simpler if regex failed
  if (!s.includes("clearDyadGateUi")) {
    s = s.replace(
      '"ChatUI skip must apply dyadSkipPatch then continueAfterDyadGate"',
      '"ChatUI skip must clearDyadGateUi + dyadSkipPatch then continueAfterDyadGate"'
    );
    s = s.replace(
      /\/handleDyadSkip\[\\s\\S\]\{0,500\}\?dyadSkipPatch\(\)\[\\s\\S\]\{0,400\}\?continueAfterDyadGate\//,
      "/handleDyadSkip[\\s\\S]{0,500}?clearDyadGateUi[\\s\\S]{0,200}?dyadSkipPatch\\(\\)[\\s\\S]{0,400}?continueAfterDyadGate/"
    );
    if (!s.includes("dyadGateChipsLocked")) {
      s = s.replace(
        '"ChatUI skip must clearDyadGateUi + dyadSkipPatch then continueAfterDyadGate",\n);',
        `"ChatUI skip must clearDyadGateUi + dyadSkipPatch then continueAfterDyadGate",
);
assert.ok(
  chatUiSrc.includes("dyadGateChipsLocked"),
  "ChatUI must lock dyad chips after skip/collect (#12)",
);`
      );
    }
  }
  write(p, s);
}

// ---------- Update block88 assert for optional dyadPath ----------
{
  const p = "scripts/test-poju-block88-gate-summary-deterministic.ts";
  let s = read(p);
  s = s.replace(
    'assert("resolve always uses fields", gate.includes("return buildUnderstandingGateSummaryFromFields(agent, locale)"));',
    'assert("resolve always uses fields", /return buildUnderstandingGateSummaryFromFields\\(agent, locale/.test(gate));'
  );
  write(p, s);
}

// ---------- New skip-path UX regression script ----------
{
  const p = "scripts/test-dyad-skip-path-ux.ts";
  const content = `/**
 * Skip-path UX (#12): after Case C Skip, chips/copy/understanding confirm
 * must not stick or mislead (no "still waiting for partner chart").
 *
 * Keep ASCII-only string contracts where possible; ZH notes asserted via helpers.
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

// --- helpers: annotate only after skip / solo+absent ---
assert.equal(
  shouldAnnotateUnderstandingWithSkipPath({ dyadOfferStatus: "skipped" }),
  true,
);
assert.equal(
  shouldAnnotateUnderstandingWithSkipPath({
    partner_bazi: "absent",
    pivot_chart_path: "solo",
  }),
  true,
);
assert.equal(
  shouldAnnotateUnderstandingWithSkipPath({ dyadOfferStatus: "offered" }),
  false,
);
assert.equal(
  shouldAnnotateUnderstandingWithSkipPath({ dyadOfferStatus: "collected" }),
  false,
);
assert.equal(dyadGateChipsLocked("skipped"), true);
assert.equal(dyadGateChipsLocked("collected"), true);
assert.equal(dyadGateChipsLocked("offered"), false);

// --- understanding confirm copy for skip path (EN + ZH) ---
const enNote = dyadSkipPathUnderstandingNote("en");
assert.match(enNote, /solo path/i);
assert.match(enNote, /without their chart/i);
assert.doesNotMatch(enNote, /still waiting/i);
assert.doesNotMatch(enNote, /enter their birth/i);

const zhNote = dyadSkipPathUnderstandingNote("zh");
assert.ok(zhNote.includes("solo"));
assert.ok(zhNote.includes("\\u6682\\u4e0d\\u63d0\\u4f9b") || zhNote.includes("\\u4e0d\\u4f1a\\u518d\\u7d22\\u8981") || zhNote.length > 20);

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

// --- continue cue forbids re-ask after skip ---
const cue = buildDyadContinueModelUserCue({
  partner_bazi: "absent",
  pivot_chart_path: "solo",
  locale: "en",
});
assert.match(cue, /partner_bazi=absent/);
assert.match(cue, /path=solo/);
assert.match(cue, /do not re-ask birth details/i);
assert.match(cue, /still waiting/i); // cue mentions ban on implying still waiting
assert.match(cue, /do not re-offer collect chips/i);

// --- clearDyadGateUi clears pending + consumes options ---
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

// --- static source contracts ---
const chatUiSrc = readFileSync(
  fileURLToPath(new URL("../components/poju/POJUChatUI.tsx", import.meta.url)),
  "utf8",
);
assert.ok(chatUiSrc.includes("clearDyadGateUi"), "ChatUI imports clearDyadGateUi");
assert.ok(chatUiSrc.includes("dyadGateChipsLocked"), "ChatUI locks dyad chips");
assert.ok(
  /handleDyadSkip[\\s\\S]{0,600}?clearDyadGateUi/.test(chatUiSrc),
  "skip path uses clearDyadGateUi",
);

const agentSrc = readFileSync(
  fileURLToPath(new URL("../lib/poju/agent.ts", import.meta.url)),
  "utf8",
);
assert.ok(
  /openingReplyInput[\\s\\S]{0,400}?dyadPath:/.test(agentSrc),
  "agent passes dyadPath into opening reply assembly",
);

const policySrc = readFileSync(
  fileURLToPath(new URL("../lib/llm/prompts/pivot-dual-party-policy.ts", import.meta.url)),
  "utf8",
);
assert.ok(
  policySrc.includes("partner_bazi=absent") && policySrc.includes("skip"),
  "dual-party policy must forbid re-ask after intentional skip",
);

const pipelineSrc = readFileSync(
  fileURLToPath(new URL("../lib/llm/pro/delivery/lab/pipeline-jobs.ts", import.meta.url)),
  "utf8",
);
assert.ok(
  pipelineSrc.includes('from "@/lib/poju/reply-options"') &&
    pipelineSrc.includes("clearDyadGateUi"),
  "lab pipeline uses shared clearDyadGateUi",
);
assert.ok(
  !/function clearDyadGateUi\\(/.test(pipelineSrc),
  "lab must not keep a private clearDyadGateUi duplicate",
);

console.log("ok dyad-skip-path-ux", {
  note_en_len: enNote.length,
  summary_has_note: skipSummary.includes(enNote),
});
`;
  write(p, content);
}

console.log("part6 tests scaffolded");
