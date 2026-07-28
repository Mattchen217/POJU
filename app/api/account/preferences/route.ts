import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/auth/supabase";
import { getServerUser } from "@/lib/auth/supabase-server";

export const runtime = "nodejs";

const BodySchema = z
  .object({
    notify_pass_low: z.boolean().optional(),
    notify_marketing: z.boolean().optional(),
    display_name: z.string().trim().max(80).nullable().optional(),
  })
  .refine(
    (v) =>
      v.notify_pass_low !== undefined ||
      v.notify_marketing !== undefined ||
      v.display_name !== undefined,
    { message: "empty" },
  );

/**
 * Patch account notification preferences (store only — no mailer yet).
 */
export async function PATCH(req: Request) {
  try {
    if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
      return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 });
    }

    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.notify_pass_low !== undefined) {
      patch.notify_pass_low = parsed.data.notify_pass_low;
    }
    if (parsed.data.notify_marketing !== undefined) {
      patch.notify_marketing = parsed.data.notify_marketing;
    }
    if (parsed.data.display_name !== undefined) {
      patch.display_name = parsed.data.display_name;
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          ...patch,
        },
        { onConflict: "id" },
      )
      .select("notify_pass_low, notify_marketing, display_name")
      .single();

    if (error) {
      console.error("[account/preferences]", error.code);
      return NextResponse.json({ ok: false, error: "prefs_failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      notify_pass_low: data?.notify_pass_low ?? true,
      notify_marketing: data?.notify_marketing ?? false,
      display_name: data?.display_name ?? null,
    });
  } catch (error) {
    console.error(
      "[account/preferences] unexpected",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json({ ok: false, error: "prefs_failed" }, { status: 500 });
  }
}
