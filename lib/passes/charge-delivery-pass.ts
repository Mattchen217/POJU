import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { isPassEnforceEnabled } from "@/lib/passes/consume-pass";
import { consumePassSmart } from "@/lib/passes/consume-pass-smart";
import { passUsageTopicFromQuestion } from "@/lib/passes/pass-usage-label";

/**
 * Pivot pass charge for one report generation (legacy book and DI2 report share it).
 * Regenerate callers skip this — the session was already charged on first create.
 *
 * Idempotent on (user, product, refId = jointPassRef || sessionId): the consume RPCs
 * return `already_consumed` for a ref already in `pass_usage`, and its unique index
 * rejects a concurrent duplicate. `uncertain` marks a failure that does not prove the
 * debit did not happen (RPC / transport error, incl. that duplicate) — the caller must
 * re-run the same ref to learn the outcome, never treat it as unpaid with a new ref.
 */
export async function chargeDeliveryPass(input: {
  sessionId: string;
  question: string;
  jointPassRef: string | null;
}): Promise<{ ok: true } | { ok: false; response: NextResponse; uncertain?: boolean }> {
  if (!isPassEnforceEnabled("pivot") || !isSupabaseConfigured()) return { ok: true };
  const user = await getServerUser();
  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "pass_login_required", reason: "unauthorized" },
        { status: 401 },
      ),
    };
  }
  const consumed = await consumePassSmart({
    userId: user.id,
    product: "pivot",
    refId: input.jointPassRef || input.sessionId,
    description: passUsageTopicFromQuestion(input.question),
  });
  if (!consumed.ok) {
    return {
      ok: false,
      uncertain: consumed.reason === "rpc_error",
      response: NextResponse.json(
        {
          ok: false,
          error: "pass_required",
          reason: consumed.reason ?? "insufficient_balance",
          balance_after: consumed.balanceAfter ?? 0,
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true };
}
