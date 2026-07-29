import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { scheduleSubscriptionPlanChange } from "@/lib/passes/schedule-plan-change";
import { setSubscriptionAutoRenew } from "@/lib/passes/subscription-toggle";

export const runtime = "nodejs";

const BodySchema = z.union([
  z.object({
    active: z.boolean(),
  }),
  z.object({
    pending_plan: z.enum(["personal", "team"]).nullable(),
  }),
]);

/**
 * Subscription controls:
 * - { active } → toggle auto-renew
 * - { pending_plan } → schedule plan switch for next cycle (null = cancel pending)
 */
export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }

    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    if ("active" in parsed.data) {
      const result = await setSubscriptionAutoRenew({
        userId: user.id,
        active: parsed.data.active,
      });

      if (!result.ok) {
        const status =
          result.reason === "no_subscription"
            ? 400
            : result.reason === "admin_unconfigured"
              ? 503
              : 500;
        return NextResponse.json({ ok: false, error: result.reason ?? "toggle_failed" }, { status });
      }

      return NextResponse.json({
        ok: true,
        mock: result.mock === true,
        subscription: {
          status: result.status,
          plan: result.plan,
          current_period_end: result.current_period_end,
        },
      });
    }

    const result = await scheduleSubscriptionPlanChange({
      userId: user.id,
      pendingPlan: parsed.data.pending_plan,
    });

    if (!result.ok) {
      const status =
        result.reason === "no_subscription"
          ? 400
          : result.reason === "admin_unconfigured"
            ? 503
            : 500;
      return NextResponse.json({ ok: false, error: result.reason ?? "schedule_failed" }, { status });
    }

    return NextResponse.json({
      ok: true,
      mock: result.mock === true,
      subscription: {
        plan: result.plan,
        pending_plan: result.pending_plan,
        current_period_end: result.current_period_end,
      },
    });
  } catch (error) {
    console.error("[account/subscription]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "subscription_failed" }, { status: 500 });
  }
}
