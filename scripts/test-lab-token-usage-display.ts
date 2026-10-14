/**
 * Unit: Lab call-trace token display — missing vs measured zero.
 * Keep ASCII-only string literals for Windows shells.
 * Run: pnpm exec tsx scripts/test-lab-token-usage-display.ts
 */
import assert from "node:assert/strict";
import { formatLabTokenUsageLabel } from "../lib/llm/pro/delivery/lab/call-trace";

const MISSING = "用量未回写";

assert.equal(formatLabTokenUsageLabel(null), null);
assert.equal(formatLabTokenUsageLabel(undefined), null);

// Explicit not written
assert.equal(
  formatLabTokenUsageLabel({ tokens_used: 0, usage_written: false }),
  MISSING,
);
assert.equal(
  formatLabTokenUsageLabel({ usage_written: false }),
  MISSING,
);

// Written zero is rare but honest
assert.equal(
  formatLabTokenUsageLabel({ tokens_used: 0, usage_written: true }),
  "tokens=0",
);

// Written positive
assert.equal(
  formatLabTokenUsageLabel({ tokens_used: 1234, usage_written: true }),
  "tokens=1234",
);

// Legacy coerced zero with no breakdown => treat as not written
assert.equal(
  formatLabTokenUsageLabel({ tokens_used: 0 }),
  MISSING,
);
assert.equal(
  formatLabTokenUsageLabel({ tokens_used: 0, prompt_tokens: 0, completion_tokens: 0 }),
  MISSING,
);

// Legacy with real breakdown still shows tokens
assert.equal(
  formatLabTokenUsageLabel({ tokens_used: 900, prompt_tokens: 400, completion_tokens: 500 }),
  "tokens=900",
);

// Missing tokens_used entirely
assert.equal(formatLabTokenUsageLabel({ actual_model: "x" }), MISSING);

// Written but only breakdown available
assert.equal(
  formatLabTokenUsageLabel({
    usage_written: true,
    prompt_tokens: 100,
    completion_tokens: 50,
  }),
  "tokens=150",
);

console.log("ok: lab token usage display rules");
