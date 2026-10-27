/**
 * Delivery pipeline v3 — three-step content → gate → evidence_soft.
 *
 * Production final-delivery (`productionDeliveryUsesV3`) is v3 unless
 * `DELIVERY_PIPELINE` is explicitly `legacy`. Lab session create still uses
 * `resolveDeliveryPipeline`, which stays legacy when the env is unset.
 */

export type DeliveryPipelineId = "legacy" | "v3_three_step";

const LEGACY_PIPELINE_VALUES = new Set(["legacy", "v1", "assign", "old"]);

export function resolveDeliveryPipeline(
  env: NodeJS.ProcessEnv = process.env,
): DeliveryPipelineId {
  const raw = (env.DELIVERY_PIPELINE ?? "").trim().toLowerCase();
  if (
    raw === "v3" ||
    raw === "v3_three_step" ||
    raw === "three_step" ||
    raw === "3"
  ) {
    return "v3_three_step";
  }
  return "legacy";
}

export function isDeliveryPipelineV3(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveDeliveryPipeline(env) === "v3_three_step";
}

/**
 * Live `POST /api/poju/final-delivery` path. Unset env is v3.
 * Explicit `DELIVERY_PIPELINE=legacy` is the only rollback to assign/write/fill.
 */
export function productionDeliveryUsesV3(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env.DELIVERY_PIPELINE ?? "").trim().toLowerCase();
  if (LEGACY_PIPELINE_VALUES.has(raw)) return false;
  return true;
}

/** Quality close from the production v3 worker. Do not heal or resume onto the DAG. */
export function isProductionV3ClosedFailure(reason: string | null | undefined): boolean {
  return reason === "v3_step_failed";
}
