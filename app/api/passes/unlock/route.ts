import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerUser } from "@/lib/auth/supabase-server";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";
import { assertAndConsumePass, isPassEnforceEnabled } from "@/lib/passes/consume-pass";
import { isPassProduct, type PassProduct } from "@/lib/passes/types";

export const runtime = "nodejs";

const BodySchema = z.object({
  product: z.enum(["atmos", "pivot", "match", "syncro", "glyph"]),
  ref_id: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  /** Atmos only: which profile/record this 30-day window binds to */
  atmos_record_key: z.string().min(1).max(200).optional(),
});

/**
 * Unlock a product delivery by consuming 1 Pass.
 * Atmos also grants a 30-day entitlement for the given record.
 */
export async function POST(req: Request) {
  try {
    const user = await getServerUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const product = parsed.data.product as PassProduct;
    if (!isPassProduct(product)) {
      return NextResponse.json({ ok: false, error: "invalid_product" }, { status: 400 });
    }

    if (!isPassEnforceEnabled(product)) {
      return NextResponse.json({
        ok: true,
        enforced: false,
        reason: "enforce_off",
      });
    }

    const atmosRecordKey = parsed.data.atmos_record_key?.trim() ?? "";
    if (product === "atmos" && !atmosRecordKey) {
      return NextResponse.json({ ok: false, error: "atmos_record_required" }, { status: 400 });
    }

    // Atmos: active 30-day window for this account+record → no second Pass charge
    if (product === "atmos" && isSupabaseAdminConfigured()) {
      const admin = createSupabaseAdminClient();
      const { data: ent } = await admin
        .from("atmos_entitlements")
        .select("ends_at")
        .eq("user_id", user.id)
        .eq("record_key", atmosRecordKey)
        .maybeSingle();
      const endsAt = ent?.ends_at ? String(ent.ends_at) : null;
      if (endsAt && new Date(endsAt).getTime() > Date.now()) {
        return NextResponse.json({
          ok: true,
          enforced: true,
          already_entitled: true,
          reason: "atmos_entitled",
          atmos_ends_at: endsAt,
        });
      }
    }

    const consumed = await assertAndConsumePass({
      userId: user.id,
      product,
      refId: parsed.data.ref_id,
      description: parsed.data.description,
    });

    if (!consumed.ok) {
      const status = consumed.reason === "insufficient_balance" ? 402 : 500;
      return NextResponse.json(
        {
          ok: false,
          error: consumed.reason ?? "consume_failed",
          flex_balance: consumed.flexAfter,
          sub_balance: consumed.subAfter,
          pass_balance: consumed.balanceAfter,
        },
        { status },
      );
    }

    let atmosEndsAt: string | null = null;
    if (product === "atmos" && isSupabaseAdminConfigured()) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.rpc("grant_atmos_entitlement", {
        target_user_id: user.id,
        target_record_key: atmosRecordKey,
        target_ref_id: parsed.data.ref_id,
        days_valid: 30,
      });
      if (error) {
        console.error("[passes/unlock] atmos entitlement", error.code ?? error.message);
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.ends_at) atmosEndsAt = String(row.ends_at);
      }
    }

    return NextResponse.json({
      ok: true,
      enforced: true,
      reason: consumed.reason,
      pass_source: consumed.passSource,
      flex_balance: consumed.flexAfter,
      sub_balance: consumed.subAfter,
      pass_balance: consumed.balanceAfter,
      atmos_ends_at: atmosEndsAt,
      already_entitled: false,
    });
  } catch (error) {
    console.error("[passes/unlock]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "unlock_failed" }, { status: 500 });
  }
}
