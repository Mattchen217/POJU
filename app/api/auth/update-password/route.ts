import { NextResponse } from "next/server";
import { z } from "zod";

import { PasswordSchema, mapAuthErrorCode } from "@/lib/auth/auth-helpers";
import { createSupabaseServerClient, getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";

const BodySchema = z
  .object({
    password: PasswordSchema,
    confirm: PasswordSchema.optional(),
  })
  .refine((v) => v.confirm == null || v.confirm === v.password, {
    message: "password_mismatch",
    path: ["confirm"],
  });

/**
 * Update password for the current Cookie session (reset-password flow or change password).
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      const code =
        parsed.error.issues.some((i) => i.message === "password_mismatch")
          ? "password_mismatch"
          : "invalid_payload";
      return NextResponse.json({ ok: false, error: code }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, mocked: true });
    }

    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      console.error("[auth/update-password]", error.name, error.message);
      return NextResponse.json(
        { ok: false, error: mapAuthErrorCode(error.message) },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/update-password] unexpected", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
