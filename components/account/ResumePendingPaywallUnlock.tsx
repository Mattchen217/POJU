"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";

import {
  PASSES_CREDITED_EVENT,
  dispatchPassAutoUnlocked,
  dispatchPassSpendToast,
} from "@/lib/passes/pass-client-events";
import {
  markPaywallUnlockCompleted,
  stashPendingPaywallUnlock,
  takePendingPaywallUnlock,
} from "@/lib/passes/pending-paywall-unlock";
import { unlockWithPass } from "@/lib/passes/unlock-with-pass";

/**
 * After checkout credits Passes, if the user came from a paywall buy flow,
 * automatically spend 1 Pass to finish the unlock they were blocked on.
 * Marks completion in sessionStorage so a late-mounted paywall still clears.
 */
export function ResumePendingPaywallUnlock() {
  const locale = useLocale();
  const running = useRef(false);

  useEffect(() => {
    const resume = () => {
      if (running.current) return;
      const pending = takePendingPaywallUnlock();
      if (!pending) return;
      running.current = true;

      void (async () => {
        try {
          const result = await unlockWithPass({
            product: pending.product,
            refId: pending.refId,
            description: pending.description,
            atmosRecordKey: pending.atmosRecordKey,
          });
          if (!result.ok) {
            // Keep intent so the user can tap “Unlock with 1 Pass” manually.
            stashPendingPaywallUnlock(pending);
            return;
          }
          // Sticky first — paywall may mount after this event (checkout return race).
          markPaywallUnlockCompleted(pending);
          dispatchPassAutoUnlocked({
            ...pending,
            already_entitled: result.already_entitled,
          });
          if (!result.already_entitled) {
            dispatchPassSpendToast({ amount: 1, locale });
          }
        } finally {
          running.current = false;
        }
      })();
    };

    window.addEventListener(PASSES_CREDITED_EVENT, resume);
    return () => window.removeEventListener(PASSES_CREDITED_EVENT, resume);
  }, [locale]);

  return null;
}
