/**
 * Prefer duo household shared pool for pivot spends when user is a seat member;
 * otherwise legacy per-user consume.
 */

import { assertAndConsumePass, type ConsumePassResult } from "@/lib/passes/consume-pass";
import {
  consumeHouseholdPass,
  findHouseholdForUser,
} from "@/lib/passes/household";
import type { PassProduct } from "@/lib/passes/types";

export async function consumePassSmart(params: {
  userId: string;
  product: PassProduct;
  refId: string;
  description?: string;
}): Promise<ConsumePassResult & { via?: "household" | "user" }> {
  // Joint refs always go through household (even if already charged).
  const isJointRef = params.refId.startsWith("joint:");

  if (params.product === "pivot" || isJointRef) {
    const hh = await findHouseholdForUser(params.userId);
    if (hh && (hh.status === "active" || hh.status === "pending_partner")) {
      // Solo pivot for household members also uses shared pool when active+full
      // or pending (seat A alone can still solo from shared).
      const hhResult = await consumeHouseholdPass({
        householdId: hh.id,
        userId: params.userId,
        product: params.product,
        refId: params.refId,
        description: params.description,
      });
      if (hhResult.ok) {
        return {
          ok: true,
          reason: hhResult.reason,
          balanceAfter: hhResult.balanceAfter,
          passSource: hhResult.passSource === "flex" ? "flex" : "sub",
          via: "household",
        };
      }
      // If household insufficient and not a joint ref, fall through to user buckets.
      if (isJointRef || hhResult.reason === "rpc_error") {
        return {
          ok: false,
          reason: hhResult.reason ?? "insufficient_balance",
          via: "household",
        };
      }
    }
  }

  const userResult = await assertAndConsumePass(params);
  return { ...userResult, via: "user" };
}
