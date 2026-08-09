import type { PendingPaywallUnlock } from "@/lib/passes/pending-paywall-unlock";

/** Dispatched after checkout credits Passes (ledger write succeeded). */
export const PASSES_CREDITED_EVENT = "poju:passes-credited";

/** Dispatched after a stashed paywall unlock spent 1 Pass post-purchase. */
export const PASS_AUTO_UNLOCKED_EVENT = "poju:pass-auto-unlocked";

/** Request a top-of-page toast after a Pass spend. */
export const PASS_SPEND_TOAST_EVENT = "poju:pass-spend-toast";

export type PassAutoUnlockedDetail = PendingPaywallUnlock & {
  already_entitled?: boolean;
};

export type PassSpendToastDetail = {
  amount: number;
  locale?: string;
};

export function dispatchPassesCredited(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PASSES_CREDITED_EVENT));
}

export function dispatchPassAutoUnlocked(detail: PassAutoUnlockedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PASS_AUTO_UNLOCKED_EVENT, { detail }));
}

export function dispatchPassSpendToast(detail: PassSpendToastDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PASS_SPEND_TOAST_EVENT, { detail }));
}
