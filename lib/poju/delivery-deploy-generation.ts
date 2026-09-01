/**
 * Deploy generation gate for Phase-4 delivery.
 *
 * Each Vercel deploy gets a new VERCEL_DEPLOYMENT_ID. Jobs stamp that id at create.
 * /continue and status refuse work when the stamp ≠ current deploy — so a redeploy
 * stops orphaned QStash hops / OpenRouter calls from the previous build.
 * Only an explicit regenerate (new job) starts LLM again.
 */

import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";

/** Current server deploy identity (stable for the life of one deployment). */
export function currentDeliveryDeployGeneration(): string {
  const fromEnv =
    process.env.POJU_DELIVERY_GENERATION?.trim() ||
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromEnv) return fromEnv;
  // Local/dev without Vercel env — one process lifetime id so restarts also cut orphans.
  const g = globalThis as typeof globalThis & { __pojuDeliveryDeployGen?: string };
  if (!g.__pojuDeliveryDeployGen) {
    g.__pojuDeliveryDeployGen = `local_${Date.now().toString(36)}`;
  }
  return g.__pojuDeliveryDeployGen;
}

/** True when this job was created on the currently running deploy. */
export function isDeliveryJobFromCurrentDeploy(
  job: Pick<PojuXhighJob, "deploy_generation"> | null | undefined,
): boolean {
  const stamped = job?.deploy_generation?.trim();
  if (!stamped) return false; // pre-gate / pre-redeploy jobs → stop
  return stamped === currentDeliveryDeployGeneration();
}
