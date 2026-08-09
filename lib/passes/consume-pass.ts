import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/auth/supabase";
import { isPassProduct, type PassProduct } from "@/lib/passes/types";

export type ConsumePassResult = {
  ok: boolean;
  reason?: string;
  balanceAfter?: number;
  flexAfter?: number;
  subAfter?: number;
  carryoverAfter?: number;
  /** Spend order: carryover → sub → flex */
  passSource?: "flex" | "sub" | "carryover" | null;
};

/**
 * Which products hard-gate delivery on Pass balance.
 * Default: all five products. Set `PASS_ENFORCE_PRODUCTS=off` to disable,
 * or a comma list / single product for narrower gates.
 */
export function isPassEnforceEnabled(product: PassProduct): boolean {
  const raw = (process.env.PASS_ENFORCE_PRODUCTS ?? "all").trim().toLowerCase();
  if (!raw || raw === "0" || raw === "off" || raw === "none" || raw === "false") {
    return false;
  }
  if (raw === "*" || raw === "all") return true;
  return raw
    .split(/[,|\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(product);
}

/** Monthly renewal quotas (no first-month bonus). */
export const SUBSCRIPTION_MONTHLY_QUOTA: Record<"personal" | "team", number> = {
  personal: 5,
  team: 15,
};

/** First-month grant on checkout (includes limited-time bonus). */
export const SUBSCRIPTION_FIRST_GRANT: Record<"personal" | "team", number> = {
  personal: 7,
  team: 20,
};

/**
 * Unlock boundary: debit 1 Pass + write usage. Idempotent on (user, product, refId).
 * Spend order: prior-plan carryover → current subscription → flex (purchased).
 * Callers with insufficient_balance should open PassPurchaseModal (buy / subscribe).
 */
export async function assertAndConsumePass(params: {
  userId: string;
  product: PassProduct;
  refId: string;
  description?: string;
}): Promise<ConsumePassResult> {
  if (!isPassProduct(params.product)) {
    return { ok: false, reason: "invalid_product" };
  }
  if (!params.refId.trim()) {
    return { ok: false, reason: "invalid_ref" };
  }
  if (!isSupabaseAdminConfigured()) {
    // Local / CI without admin: do not block delivery.
    return { ok: true, reason: "admin_unconfigured", balanceAfter: undefined };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("consume_user_pass", {
      target_user_id: params.userId,
      target_product: params.product,
      target_ref_id: params.refId.trim(),
      usage_desc: params.description ?? null,
    });
    if (error) {
      console.error("[passes] consume_user_pass", error.code ?? error.message);
      return { ok: false, reason: "rpc_error" };
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          ok?: boolean;
          reason?: string;
          balance_after?: number;
          flex_after?: number;
          sub_after?: number;
          carryover_after?: number;
          pass_source?: string | null;
        }
      | null
      | undefined;
    const src = row?.pass_source;
    return {
      ok: Boolean(row?.ok),
      reason: typeof row?.reason === "string" ? row.reason : undefined,
      balanceAfter: typeof row?.balance_after === "number" ? row.balance_after : undefined,
      flexAfter: typeof row?.flex_after === "number" ? row.flex_after : undefined,
      subAfter: typeof row?.sub_after === "number" ? row.sub_after : undefined,
      carryoverAfter:
        typeof row?.carryover_after === "number" ? row.carryover_after : undefined,
      passSource:
        src === "flex" || src === "sub" || src === "carryover" ? src : null,
    };
  } catch (error) {
    console.error("[passes] consume", error instanceof Error ? error.name : "unknown");
    return { ok: false, reason: "rpc_error" };
  }
}
