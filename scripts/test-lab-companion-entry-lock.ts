/**
 * Pure contract: Companion step34 entry unlocks only after Assemble.
 * Run: pnpm exec tsx scripts/test-lab-companion-entry-lock.ts
 */

import assert from "node:assert/strict";
import {
  BOOK_ASSEMBLE_STEP_KEY,
  isAssemblePassed,
  isCompanionEntryUnlocked,
  isCompanionStepListLocked,
} from "../lib/llm/pro/delivery/lab/companion-entry-lock";

assert.equal(BOOK_ASSEMBLE_STEP_KEY, "book.assemble");

// Before Assemble: locked even if delivery unlocked
assert.equal(
  isCompanionEntryUnlocked({
    delivery_steps_locked: false,
    assemble_status: "idle",
  }),
  false,
);
assert.equal(
  isCompanionEntryUnlocked({
    delivery_steps_locked: false,
    assemble_status: "done",
  }),
  false,
);

// Delivery still Stage1–3 locked: Companion stays locked even if Assemble marked
assert.equal(
  isCompanionEntryUnlocked({
    delivery_steps_locked: true,
    assemble_status: "approved",
  }),
  false,
);

// Assemble approved → unlock (交付已通 → Companion 开)
assert.equal(
  isCompanionEntryUnlocked({
    delivery_steps_locked: false,
    assemble_status: "approved",
  }),
  true,
);

// approved_order path
assert.equal(
  isAssemblePassed({ assemble_in_approved_order: true }),
  true,
);
assert.equal(
  isCompanionEntryUnlocked({
    delivery_steps_locked: false,
    assemble_in_approved_order: true,
  }),
  true,
);

// cursor past assemble index (approve Assemble advances to companion.seal)
assert.equal(
  isAssemblePassed({
    cursor_index: 33,
    assemble_step_index: 32,
  }),
  true,
);
assert.equal(
  isAssemblePassed({
    cursor_index: 32,
    assemble_step_index: 32,
  }),
  false,
);

// Step list: seal needs Assemble only; daily needs seal brief too
assert.equal(
  isCompanionStepListLocked({
    delivery_steps_locked: false,
    assemble_status: "approved",
    kind: "companion_seal",
    companion_seal_ready: false,
  }),
  false,
);
assert.equal(
  isCompanionStepListLocked({
    delivery_steps_locked: false,
    assemble_status: "approved",
    kind: "companion_daily",
    companion_seal_ready: false,
  }),
  true,
);
assert.equal(
  isCompanionStepListLocked({
    delivery_steps_locked: false,
    assemble_status: "approved",
    kind: "companion_daily",
    companion_seal_ready: true,
  }),
  false,
);
assert.equal(
  isCompanionStepListLocked({
    delivery_steps_locked: false,
    assemble_status: "idle",
    kind: "companion_seal",
    companion_seal_ready: true,
  }),
  true,
);

console.log("ok: lab companion entry lock contract");
