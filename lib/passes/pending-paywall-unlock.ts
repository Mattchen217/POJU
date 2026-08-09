import { z } from "zod";

import { PASS_PRODUCTS, type PassProduct } from "@/lib/passes/types";

const STORAGE_KEY = "poju_pending_paywall_unlock";
/** Drop stale intents so an old paywall buy cannot unlock a later session. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const PendingPaywallUnlockSchema = z.object({
  product: z.enum(PASS_PRODUCTS),
  refId: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  atmosRecordKey: z.string().max(200).optional(),
  stashedAt: z.number().int().positive(),
});

export type PendingPaywallUnlock = z.infer<typeof PendingPaywallUnlockSchema>;

export type PendingPaywallUnlockInput = {
  product: PassProduct;
  refId: string;
  description?: string;
  atmosRecordKey?: string;
};

function readRaw(): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeRaw(value: PendingPaywallUnlock | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!value) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function stashPendingPaywallUnlock(input: PendingPaywallUnlockInput): void {
  const parsed = PendingPaywallUnlockSchema.safeParse({
    ...input,
    stashedAt: Date.now(),
  });
  if (!parsed.success) return;
  writeRaw(parsed.data);
}

export function peekPendingPaywallUnlock(): PendingPaywallUnlock | null {
  const parsed = PendingPaywallUnlockSchema.safeParse(readRaw());
  if (!parsed.success) {
    writeRaw(null);
    return null;
  }
  if (Date.now() - parsed.data.stashedAt > MAX_AGE_MS) {
    writeRaw(null);
    return null;
  }
  return parsed.data;
}

/** Read and clear. */
export function takePendingPaywallUnlock(): PendingPaywallUnlock | null {
  const pending = peekPendingPaywallUnlock();
  if (pending) writeRaw(null);
  return pending;
}

export function clearPendingPaywallUnlock(): void {
  writeRaw(null);
}

/** Clear only when the stored intent matches this paywall. */
export function clearPendingPaywallUnlockIfMatch(input: PendingPaywallUnlockInput): void {
  const pending = peekPendingPaywallUnlock();
  if (!pending) return;
  if (pending.product === input.product && pending.refId === input.refId) {
    writeRaw(null);
  }
}
