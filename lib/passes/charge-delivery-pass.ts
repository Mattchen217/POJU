import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { isPassEnforceEnabled } from "@/lib/passes/consume-pass";
import { consumePassSmart } from "@/lib/passes/consume-pass-smart";
import { passUsageTopicFromQuestion } from "@/lib/passes/pass-usage-label";

/**
 * Pivot pass charge for one report generation (legacy book and DI2 report share it).
 * Regenerate callers skip this — the session was already charged on first create.
 */
export async function chargeDeliveryPass(input: {
  sessionId: string;
  question: string;
  jointPassRef: string | null;
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
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
