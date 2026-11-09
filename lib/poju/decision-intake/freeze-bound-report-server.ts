/**
 * Server-only Freeze-bound report entry with Upstash/KV cross-process claim.
 */
import "server-only";

import { defaultFreezeReportClaimOps } from "@/lib/poju/decision-intake/freeze-report-claim";
import {
  requestFreezeBoundEightPageReport,
  prepareFreezeBoundFinalDelivery,
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
    deps: withKvClaim(input.deps),
  });
}
