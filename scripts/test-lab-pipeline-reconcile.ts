/**
 * Pure contract: Stage4 job↔UI delivery unlock reconcile (no LLM / no KV).
 * Run: pnpm exec tsx scripts/test-lab-pipeline-reconcile.ts
 */

import assert from "node:assert/strict";
import {
  chatReadyForDeliveryUnlock,
  coreHasSynthesisPaths,
  decideDeliveryReconcile,
  deliveryUnlockHintFromJobStatus,
  shouldAutoRefreshLockedDelivery,
} from "../lib/llm/pro/delivery/lab/pipeline-reconcile";

const paths = {
  primary_path: { title: "main" },
  backup_path: { title: "backup" },
};

assert.equal(coreHasSynthesisPaths(null), false);
assert.equal(coreHasSynthesisPaths({}), false);
assert.equal(coreHasSynthesisPaths(paths), true);

assert.equal(
  chatReadyForDeliveryUnlock({ synthesis_status: "done", breakthrough_core: null }),
  true,
);
assert.equal(
  chatReadyForDeliveryUnlock({ synthesis_status: "pending", breakthrough_core: paths }),
  true,
);
assert.equal(
  chatReadyForDeliveryUnlock({ synthesis_status: "pending", breakthrough_core: null }),
  false,
);

assert.equal(deliveryUnlockHintFromJobStatus("running"), "wait");
assert.equal(deliveryUnlockHintFromJobStatus("completed"), "unlock_eligible");
assert.equal(deliveryUnlockHintFromJobStatus("failed"), "failed");
assert.equal(deliveryUnlockHintFromJobStatus(null), "unknown");

assert.equal(
  decideDeliveryReconcile({
    mode: "full_pipeline",
    pipeline_delivery_unlocked: true,
    has_chat_session: true,
    has_pending_job: true,
  }),
  "noop",
);

assert.equal(
  decideDeliveryReconcile({
    mode: "full_pipeline",
    pipeline_delivery_unlocked: false,
    has_chat_session: true,
    has_pending_job: true,
  }),
  "apply_pending",
);

// Case B: server synthesis done, pending pointer lost, chat has paths → seed unlock
assert.equal(
  decideDeliveryReconcile({
    mode: "full_pipeline",
    pipeline_delivery_unlocked: false,
    has_chat_session: true,
    has_pending_job: false,
    synthesis_status: "done",
    breakthrough_core: paths,
  }),
  "seed_from_chat",
);

// Case B variant: no chat writeback yet but latest job completed → probe/apply
assert.equal(
  decideDeliveryReconcile({
    mode: "full_pipeline",
    pipeline_delivery_unlocked: false,
    has_chat_session: true,
    has_pending_job: false,
    synthesis_status: "pending",
    breakthrough_core: null,
    latest_synthesis_job_status: "completed",
  }),
  "probe_latest_synthesis",
);

assert.equal(
  shouldAutoRefreshLockedDelivery({
    delivery_steps_locked: true,
    has_pending_job: false,
  }),
  true,
);
assert.equal(
  shouldAutoRefreshLockedDelivery({
    delivery_steps_locked: true,
    has_pending_job: true,
  }),
  false,
);
assert.equal(
  shouldAutoRefreshLockedDelivery({
    delivery_steps_locked: false,
    has_pending_job: false,
  }),
  false,
);

console.log("ok: lab pipeline reconcile contract");
