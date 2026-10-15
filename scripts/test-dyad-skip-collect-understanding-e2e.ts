/**
 * E2E contract (no live LLM): Skip/Collect + empty dyad_continue must land
 * awaiting_understanding_confirm when held_for_dyad + understanding complete.
 * Regression: empty hasInput must not bounce back to / stay stuck in opening.
 *
 * Labs context: Case C skip lab_mv873uyn_7407b956; Case B collect lab_mv876ff9_e3508224.
 * Run: pnpm exec tsx scripts/test-dyad-skip-collect-understanding-e2e.ts
 *
 * Keep this file ASCII-only so CI/Windows shells cannot corrupt string literals.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DYAD_CONTINUE_SYSTEM,
  dyadSkipPatch,
  shouldResumeUnderstandingConfirmAfterDyad,
  type DyadOfferStatus,
} from "../lib/poju/dyad-compat";

/** Pure post-dyad_continue phase resolution mirroring agent.ts (no LLM). */
function resolvePhaseAfterDyadContinue(input: {
  held?: boolean | null;
  dyadOfferStatus?: DyadOfferStatus | null;
  phase?: string | null;
  understandingComplete: boolean;
}): { phase: string; held: boolean } {
  const phaseIn = input.phase ?? "opening";
  const heldIn = input.held === true;
  const resume = shouldResumeUnderstandingConfirmAfterDyad({
    held: heldIn,
    dyadOfferStatus: input.dyadOfferStatus,
    phase: phaseIn,
    understandingComplete: input.understandingComplete,
  });
  if (resume) {
    return { phase: "awaiting_understanding_confirm", held: false };
  }
  // Empty / blank dyad_continue (missing hasInput) must NOT clear held when not resuming.
  return { phase: phaseIn, held: heldIn };
}

// --- Skip path (Case C): held + complete + skip patch + empty continue -> confirm ---
{
  const beforeHeld = true;
  // held first, then skip patch: if patch wrongly set held, assert below fails.
  // Do not re-set held after spread (duplicate keys = TS1117 / Vercel build break).
  const afterSkip = {
    understanding_confirm_held_for_dyad: beforeHeld,
    ...dyadSkipPatch(),
  };
  assert.equal(afterSkip.dyad_offer_status, "skipped");
  assert.equal(
    afterSkip.understanding_confirm_held_for_dyad,
    true,
    "dyadSkipPatch must preserve held flag",
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(dyadSkipPatch(), "understanding_confirm_held_for_dyad"),
    "skip patch must not set held key",
  );

  const afterContinue = resolvePhaseAfterDyadContinue({
    held: afterSkip.understanding_confirm_held_for_dyad,
    dyadOfferStatus: afterSkip.dyad_offer_status,
    phase: "opening",
    understandingComplete: true,
  });
  assert.equal(
    afterContinue.phase,
    "awaiting_understanding_confirm",
    "Case C skip + held + complete + empty dyad_continue -> awaiting_understanding_confirm",
  );
  assert.equal(afterContinue.held, false, "held cleared only after successful resume");
}

// --- Collect path (Case B): same contract ---
{
  // Phase contract uses offer status only; no live matrix/LLM needed.
  const afterContinue = resolvePhaseAfterDyadContinue({
    held: true,
    dyadOfferStatus: "collected",
    phase: "opening",
    understandingComplete: true,
  });
  assert.equal(
    afterContinue.phase,
    "awaiting_understanding_confirm",
    "Case B collect + held + complete + empty dyad_continue -> awaiting_understanding_confirm",
  );
  assert.equal(afterContinue.held, false);
  // Static: dyadCollectedPatch / dyadSkipPatch bodies must not touch held flag.
  const dyadCompatSrc = readFileSync(
    fileURLToPath(new URL("../lib/poju/dyad-compat.ts", import.meta.url)),
    "utf8",
  );
  const collectedFn = dyadCompatSrc.slice(
    dyadCompatSrc.indexOf("export function dyadCollectedPatch"),
    dyadCompatSrc.indexOf("export function shouldOfferDyadGate"),
  );
  assert.ok(
    !collectedFn.includes("understanding_confirm_held_for_dyad"),
    "dyadCollectedPatch must not touch held flag",
  );
  const skipFn = dyadCompatSrc.slice(
    dyadCompatSrc.indexOf("export function dyadSkipPatch"),
    dyadCompatSrc.indexOf("export function dyadCollectedPatch"),
  );
  assert.ok(
    !skipFn.includes("understanding_confirm_held_for_dyad"),
    "dyadSkipPatch must not touch held flag",
  );
}

// --- Empty / blank continue must NOT clear held / bounce when not ready ---
{
  const stillOffered = resolvePhaseAfterDyadContinue({
    held: true,
    dyadOfferStatus: "offered",
    phase: "opening",
    understandingComplete: true,
  });
  assert.equal(stillOffered.phase, "opening", "still offered -> stay opening");
  assert.equal(stillOffered.held, true, "empty continue must NOT clear held while still offered");

  const incomplete = resolvePhaseAfterDyadContinue({
    held: true,
    dyadOfferStatus: "skipped",
    phase: "opening",
    understandingComplete: false,
  });
  assert.equal(incomplete.phase, "opening", "incomplete understanding -> stay opening");
  assert.equal(incomplete.held, true, "empty continue must NOT clear held when incomplete");

  const noHold = resolvePhaseAfterDyadContinue({
    held: false,
    dyadOfferStatus: "skipped",
    phase: "opening",
    understandingComplete: true,
  });
  assert.equal(noHold.phase, "opening", "no hold flag -> stay opening");
  assert.equal(noHold.held, false);
}

// --- hasInput gap: DYAD_CONTINUE_SYSTEM is a system turn (empty phase user input) ---
assert.equal(DYAD_CONTINUE_SYSTEM, "[SYSTEM: dyad_continue]");
assert.ok(DYAD_CONTINUE_SYSTEM.startsWith("[SYSTEM:"), "dyad_continue must be system-prefixed");
assert.equal(
  DYAD_CONTINUE_SYSTEM.startsWith("[SYSTEM:") ? "" : DYAD_CONTINUE_SYSTEM,
  "",
  "system dyad_continue yields empty phaseUserMessage / missing hasInput",
);

// --- Static source contracts: agent + ChatUI + lab gate ---
const agentSrc = readFileSync(
  fileURLToPath(new URL("../lib/poju/agent.ts", import.meta.url)),
  "utf8",
);
assert.ok(
  /shouldResumeUnderstandingConfirmAfterDyad[\s\S]*?understanding_confirm_held_for_dyad\s*===\s*true/.test(
    agentSrc,
  ),
  "agent must gate resume on understanding_confirm_held_for_dyad",
);
assert.ok(
  /shouldResumeUnderstandingConfirmAfterDyad\([\s\S]{0,400}?\)\s*\)\s*\{[\s\S]{0,350}?current_phase:\s*"awaiting_understanding_confirm"[\s\S]{0,200}?understanding_confirm_held_for_dyad:\s*false/.test(
    agentSrc,
  ),
  "agent must set awaiting_understanding_confirm and clear held only inside resume-true branch",
);
assert.ok(
  agentSrc.includes("System dyad_continue has empty hasInput") ||
    agentSrc.includes("empty hasInput"),
  "agent must document empty hasInput gap for dyad_continue",
);
assert.equal(
  (agentSrc.match(/understanding_confirm_held_for_dyad:\s*false/g) ?? []).length,
  1,
  "held flag cleared in exactly one place (resume-true branch only)",
);

const chatUiSrc = readFileSync(
  fileURLToPath(new URL("../components/poju/POJUChatUI.tsx", import.meta.url)),
  "utf8",
);
assert.ok(
  /userMessage:\s*DYAD_CONTINUE_SYSTEM/.test(chatUiSrc),
  "ChatUI must send DYAD_CONTINUE_SYSTEM after dyad gate",
);
assert.ok(
  /handleDyadSkip[\s\S]{0,500}?clearDyadGateUi[\s\S]{0,200}?dyadSkipPatch\(\)[\s\S]{0,400}?continueAfterDyadGate/.test(chatUiSrc),
  "ChatUI skip must clearDyadGateUi + dyadSkipPatch then continueAfterDyadGate",
);
assert.ok(
  chatUiSrc.includes("dyadGateChipsLocked"),
  "ChatUI must lock dyad chips after skip/collect (#12)",
);
assert.ok(
  /clearDyadGateUi[\s\S]{0,200}?dyadCollectedPatch\([\s\S]{0,500}?continueAfterDyadGate/.test(chatUiSrc),
  "ChatUI collect must apply dyadCollectedPatch then continueAfterDyadGate",
);

const gateRouteSrc = readFileSync(
  fileURLToPath(new URL("../app/api/ops/delivery-lab/[lab_id]/gate/route.ts", import.meta.url)),
  "utf8",
);
assert.ok(
  /dyad_skip[\s\S]{0,300}?labDyadSkip[\s\S]{0,300}?labContinueAfterDyadGate/.test(gateRouteSrc),
  "lab gate dyad_skip must continue after patch (parity with ChatUI)",
);
assert.ok(
  /dyad_collect[\s\S]{0,400}?labDyadCollect[\s\S]{0,300}?labContinueAfterDyadGate/.test(gateRouteSrc),
  "lab gate dyad_collect must continue after patch",
);

console.log("ok dyad-skip-collect-understanding-e2e", {
  skip_lab: "lab_mv873uyn_7407b956",
  collect_lab: "lab_mv876ff9_e3508224",
  continue_system: DYAD_CONTINUE_SYSTEM,
});