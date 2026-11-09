/**
 * Server-only Freeze-bound report entry with Upstash/KV cross-process claim.
 */
import "server-only";

import { defaultFreezeReportClaimOps } from "@/lib/poju/decision-intake/freeze-report-claim";
import {
  requestFreezeBoundEightPageReport,
  prepareFreezeBoundFinalDelivery,
  completeFreezeBoundReportFromDeliveryPages,
  releaseFreezeBoundReportClaim,
  failFreezeBoundReportJob,
  type FreezeBoundReportDeps,
  type FreezeBoundReportResult,
} from "@/lib/poju/decision-intake/freeze-bound-report";
import type { POJUSessionState } from "@/lib/poju/types";

function withKvClaim(deps?: FreezeBoundReportDeps): FreezeBoundReportDeps {
  return {
    ...deps,
    claimOps: deps?.claimOps ?? defaultFreezeReportClaimOps,
  };
}

export async function requestFreezeBoundEightPageReportServer(
  input: Parameters<typeof requestFreezeBoundEightPageReport>[0],
): Promise<FreezeBoundReportResult> {
  return requestFreezeBoundEightPageReport({
    ...input,
    deps: withKvClaim(input.deps),
  });
}

export async function prepareFreezeBoundFinalDeliveryServer(
  input: Parameters<typeof prepareFreezeBoundFinalDelivery>[0],
) {
  return prepareFreezeBoundFinalDelivery({
    ...input,
    // Production Final Delivery path: acquire shared KV claim before create/start.
    acquireGenerationClaim: input.acquireGenerationClaim ?? true,
    deps: withKvClaim(input.deps),
  });
}

export async function completeFreezeBoundReportFromDeliveryPagesServer(
  input: Parameters<typeof completeFreezeBoundReportFromDeliveryPages>[0],
) {
  return completeFreezeBoundReportFromDeliveryPages({
    ...input,
    deps: withKvClaim(input.deps),
  });
}

export async function releaseFreezeBoundReportClaimServer(
  input: Parameters<typeof releaseFreezeBoundReportClaim>[0],
) {
  return releaseFreezeBoundReportClaim({
    ...input,
    deps: withKvClaim(input.deps),
  });
}

export async function failFreezeBoundReportJobServer(
  input: Parameters<typeof failFreezeBoundReportJob>[0],
) {
  return failFreezeBoundReportJob({
    ...input,
    deps: withKvClaim(input.deps),
  });
}

export type { POJUSessionState };
