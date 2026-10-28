/**
 * Production v3 mount. Unset env is v3. Legacy is explicit only.
 * A book without page schemas fails closed (no legacy fill).
 */
import assert from "node:assert/strict";

import {
  activeDeliveryJobMaxWallMs,
  DELIVERY_JOB_MAX_WALL_MS,
  PRODUCTION_V3_JOB_MAX_WALL_MS,
} from "../lib/llm/pro/delivery/delivery-retry-policy";
import {
  isProductionV3ClosedFailure,
  productionDeliveryUsesV3,
  resolveDeliveryPipeline,
} from "../lib/llm/pro/delivery/pipeline-v3/flag";
import {
  isProductionV3Task,
  isV3DispatchContinue,
  planProductionV3Book,
  productionPolishLocale,
  productionV3ContentKeys,
  PRODUCTION_V3_TASK_ID,
} from "../lib/llm/pro/delivery/pipeline-v3/production-run";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";
import { V1_DELIVERY_SEGMENT_KEYS } from "../lib/llm/pro/delivery/segment-key-alias";

const emptyEnv = {} as NodeJS.ProcessEnv;

assert.equal(productionDeliveryUsesV3(emptyEnv), true, "unset production path is v3");
assert.equal(
  productionDeliveryUsesV3({ DELIVERY_PIPELINE: "" } as unknown as NodeJS.ProcessEnv),
  true,
);
assert.equal(
  productionDeliveryUsesV3({ DELIVERY_PIPELINE: "v3_three_step" } as unknown as NodeJS.ProcessEnv),
  true,
);
assert.equal(
  productionDeliveryUsesV3({ DELIVERY_PIPELINE: "legacy" } as unknown as NodeJS.ProcessEnv),
  false,
  "explicit legacy is the only rollback",
);
assert.equal(resolveDeliveryPipeline(emptyEnv), "legacy", "Lab create flag stays legacy when unset");
assert.equal(isProductionV3ClosedFailure("v3_step_failed"), true);
assert.equal(isProductionV3ClosedFailure("interrupted"), false);
assert.equal(activeDeliveryJobMaxWallMs(emptyEnv), PRODUCTION_V3_JOB_MAX_WALL_MS);
assert.equal(
  activeDeliveryJobMaxWallMs({ DELIVERY_PIPELINE: "legacy" } as unknown as NodeJS.ProcessEnv),
  DELIVERY_JOB_MAX_WALL_MS,
);
assert.ok(PRODUCTION_V3_JOB_MAX_WALL_MS > DELIVERY_JOB_MAX_WALL_MS);

assert.equal(isProductionV3Task(PRODUCTION_V3_TASK_ID), true);
assert.equal(isProductionV3Task("p.01.assign"), false);
assert.equal(isV3DispatchContinue("soft_dispatch_continue"), true);
assert.equal(isV3DispatchContinue("polish_acceptance_continue"), true);
assert.equal(isV3DispatchContinue("body_acceptance_continue"), true);
assert.equal(isV3DispatchContinue("gate_polish_thin_synonym"), false);
assert.equal(isV3DispatchContinue("gate_p1_body_invented_number"), false);
assert.equal(isV3DispatchContinue("gate_body"), false);
assert.equal(productionPolishLocale("zh-CN"), "zh");
assert.equal(productionPolishLocale("en"), "en");
assert.equal(productionPolishLocale("fr"), "fr");
assert.equal(productionPolishLocale("es"), "es");

assert.deepEqual(
  [...productionV3ContentKeys()],
  [...V1_DELIVERY_SEGMENT_KEYS],
  "v3 content papers cover the shelf fold keys",
);

const lab = {
  steps: { "book.assemble": { status: "approved", attempts: [] } },
  artifacts: { by_page: {} },
} as unknown as DeliveryLabSession;

const missing = planProductionV3Book(lab);
assert.equal(missing.ok, false);
if (!missing.ok) {
  assert.match(missing.reason, /^v3_missing_page_schema:/);
}

const notAssembled = planProductionV3Book({
  steps: {},
  artifacts: { by_page: {} },
} as unknown as DeliveryLabSession);
assert.equal(notAssembled.ok, false);
if (!notAssembled.ok) assert.equal(notAssembled.reason, "v3_assemble_not_approved");

console.log("production v3 mount ok");
