import { isPassProduct, type PassProduct } from "@/lib/passes/types";

export type UnlockWithPassResult = {
  ok: boolean;
  error?: string;
  reason?: string;
  flex_balance?: number;
  sub_balance?: number;
  pass_balance?: number;
  atmos_ends_at?: string | null;
  already_entitled?: boolean;
};

/**
 * Client helper: spend 1 Pass to unlock a product delivery.
 * Atmos may return already_entitled when a 30-day window is still active.
 */
export async function unlockWithPass(params: {
  product: PassProduct;
  refId: string;
  description?: string;
  atmosRecordKey?: string;
}): Promise<UnlockWithPassResult> {
  if (!isPassProduct(params.product)) {
    return { ok: false, error: "invalid_product" };
  }
  try {
    const res = await fetch("/api/passes/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        product: params.product,
        ref_id: params.refId,
        description: params.description,
        atmos_record_key: params.atmosRecordKey,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as UnlockWithPassResult & {
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error ?? "unlock_failed",
        reason: data.reason,
        flex_balance: data.flex_balance,
        sub_balance: data.sub_balance,
        pass_balance: data.pass_balance,
      };
    }
    return {
      ok: true,
      flex_balance: data.flex_balance,
      sub_balance: data.sub_balance,
      pass_balance: data.pass_balance,
      atmos_ends_at: data.atmos_ends_at,
      already_entitled: data.already_entitled,
    };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function fetchAtmosEntitlement(
  recordKey: string,
): Promise<{ active: boolean; ends_at: string | null }> {
  try {
    const q = new URLSearchParams({ record_key: recordKey });
    const res = await fetch(`/api/passes/atmos-status?${q}`, {
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      active?: boolean;
      ends_at?: string | null;
    };
    if (!res.ok || !data.ok) return { active: false, ends_at: null };
    return { active: Boolean(data.active), ends_at: data.ends_at ?? null };
  } catch {
    return { active: false, ends_at: null };
  }
}
