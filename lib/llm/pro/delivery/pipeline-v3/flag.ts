/**
 * Delivery pipeline v3 — three-step content → gate → evidence_soft.
 * Default off until Lab/prod explicitly enable (env or lab session flag).
 */

export type DeliveryPipelineId = "legacy" | "v3_three_step";

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
