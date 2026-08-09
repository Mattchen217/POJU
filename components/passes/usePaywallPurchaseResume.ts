"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  PASS_AUTO_UNLOCKED_EVENT,
  type PassAutoUnlockedDetail,
} from "@/lib/passes/pass-client-events";
import {
  clearPendingPaywallUnlockIfMatch,
  stashPendingPaywallUnlock,
  type PendingPaywallUnlockInput,
} from "@/lib/passes/pending-paywall-unlock";
import type { PassProduct } from "@/lib/passes/types";

/**
 * Paywall helper: stash unlock intent before buy/subscribe checkout,
 * then finish unlock when post-purchase auto-spend succeeds.
 */
export function usePaywallPurchaseResume(params: {
  product: PassProduct;
  refId: string;
  description?: string;
  atmosRecordKey?: string;
  onUnlocked: (via: "payment" | "code") => void | Promise<void>;
}): {
  stashForPurchase: () => void;
  clearStash: () => void;
  openPurchase: (setOpen: (open: boolean) => void) => void;
  closePurchase: (setOpen: (open: boolean) => void) => void;
} {
  const onUnlockedRef = useRef(params.onUnlocked);
  onUnlockedRef.current = params.onUnlocked;

  const product = params.product;
  const refId = params.refId;
  const description = params.description;
  const atmosRecordKey = params.atmosRecordKey;

  const stashForPurchase = useCallback(() => {
    const intent: PendingPaywallUnlockInput = {
      product,
      refId,
      description,
      atmosRecordKey,
    };
    stashPendingPaywallUnlock(intent);
  }, [product, refId, description, atmosRecordKey]);

  const clearStash = useCallback(() => {
    clearPendingPaywallUnlockIfMatch({
      product,
      refId,
      description,
      atmosRecordKey,
    });
  }, [product, refId, description, atmosRecordKey]);

  useEffect(() => {
    const onAuto = (ev: Event) => {
      const detail = (ev as CustomEvent<PassAutoUnlockedDetail>).detail;
      if (!detail) return;
      if (detail.product !== product || detail.refId !== refId) return;
      void onUnlockedRef.current("payment");
    };
    window.addEventListener(PASS_AUTO_UNLOCKED_EVENT, onAuto);
    return () => window.removeEventListener(PASS_AUTO_UNLOCKED_EVENT, onAuto);
  }, [product, refId]);

  const openPurchase = useCallback(
    (setOpen: (open: boolean) => void) => {
      stashForPurchase();
      setOpen(true);
    },
    [stashForPurchase],
  );

  const closePurchase = useCallback(
    (setOpen: (open: boolean) => void) => {
      clearStash();
      setOpen(false);
    },
    [clearStash],
  );

  return { stashForPurchase, clearStash, openPurchase, closePurchase };
}
